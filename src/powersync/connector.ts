import { UpdateType } from '@powersync/web';
import type { AbstractPowerSyncDatabase, CrudEntry, PowerSyncBackendConnector, PowerSyncCredentials } from '@powersync/web';

import { supabase } from '@/utils/supabaseClient';

const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL;

// PowerSync's local SQLite has no jsonb type -- these columns are stored
// as JSON-encoded text locally (see AppSchema.ts's column.text). Synced
// back to Supabase as-is, a JSON array/object would arrive as a JSON
// *string value* for a jsonb column, which Postgres stores as a jsonb
// string literal rather than the parsed array/object -- silently breaking
// every downstream reader that expects e.g. restaurant_order_items.modifiers
// to be an array. Re-parsed before every write in applyOp() below.
const JSON_COLUMNS: Record<string, string[]> = {
  restaurant_order_items: ['modifiers'],
  tenants: ['settings'],
};

function reparseJsonColumns(table: string, data: Record<string, unknown>): Record<string, unknown> {
  const columns = JSON_COLUMNS[table];
  if (!columns) return data;
  const result = { ...data };
  for (const column of columns) {
    const value = result[column];
    if (typeof value === 'string') {
      try {
        result[column] = JSON.parse(value);
      } catch {
        // Not valid JSON -- leave as-is rather than throw; a permanent
        // failure on write will surface this instead of masking it here.
      }
    }
  }
  return result;
}

/**
 * Track: offline-first architecture, Phase 1b
 * (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 *
 * Implements the founder-locked per-entity conflict rules for the core-POS
 * v1 offline slice:
 *   - products.stock_quantity applies as a delta (via a Postgres RPC), not
 *     an absolute overwrite -- two terminals decrementing the same item
 *     offline both count instead of the second write clobbering the first.
 *   - restaurant_shift_assignments clock events (clocked_in_at/
 *     clocked_out_at) apply first-write-wins -- an offline-queued write
 *     can never silently overwrite an already-recorded (online or
 *     already-synced) clock time with a stale one.
 *   - Everything else (sales, orders, and all reference tables) is
 *     treated as append-only in practice: a plain upsert/update/delete,
 *     since inserts dominate and a given table/order is normally driven
 *     by one terminal at a time.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      throw error ?? new Error('No active Supabase session -- cannot connect PowerSync');
    }
    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await this.applyOp(op);
      }
      // REQUIRED -- without this the upload queue stalls permanently.
      await transaction.complete();
    } catch (error: unknown) {
      const err = error as { code?: string; status?: number; message?: string };
      // Permanent failures (RLS denial, unique/FK constraint violation):
      // complete the transaction so the queue can advance rather than
      // stalling forever on a write that will never succeed. A 4xx-class
      // failure left un-completed blocks every future write, per
      // PowerSync's own documented error-handling guidance.
      const isPermanent = err.code === '42501' || err.status === 400 || err.code === '23505' || err.code === '23503';
      if (isPermanent) {
        console.error('[PowerSync] Permanent upload error, skipping op:', error);
        await transaction.complete();
        return;
      }
      // Transient failure (network, 5xx) -- throw so PowerSync retries with backoff.
      throw error;
    }
  }

  private async applyOp(op: CrudEntry): Promise<void> {
    const { op: opType, table, id, opData, previousValues } = op;

    if (opType === UpdateType.DELETE) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return;
    }

    if (table === 'products' && opData && 'stock_quantity' in opData) {
      await this.applyProductStockDelta(id, opData, previousValues);
      return;
    }

    if (table === 'restaurant_shift_assignments' && opData &&
        ('clocked_in_at' in opData || 'clocked_out_at' in opData)) {
      await this.applyShiftAssignmentGuarded(id, opData);
      return;
    }

    if (opType === UpdateType.PUT) {
      const { error } = await supabase.from(table).upsert(reparseJsonColumns(table, { ...opData, id }));
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).update(reparseJsonColumns(table, opData ?? {})).eq('id', id);
      if (error) throw error;
    }
  }

  private async applyProductStockDelta(
    id: string,
    opData: Record<string, unknown>,
    previousValues: Record<string, unknown> | undefined,
  ): Promise<void> {
    const { stock_quantity, ...rest } = opData;
    const previousStock = previousValues?.['stock_quantity'];

    if (typeof stock_quantity === 'number' && typeof previousStock === 'number') {
      const delta = stock_quantity - previousStock;
      if (delta !== 0) {
        const { error } = await supabase.rpc('apply_product_stock_delta', {
          p_product_id: id,
          p_delta: delta,
        });
        if (error) throw error;
      }
    } else if (typeof stock_quantity === 'number') {
      // No previous value tracked yet (e.g. the very first local write
      // before this row has ever synced) -- fall back to a direct write
      // rather than silently dropping the change.
      const { error } = await supabase.from('products').update({ stock_quantity }).eq('id', id);
      if (error) throw error;
    }

    if (Object.keys(rest).length > 0) {
      const { error } = await supabase.from('products').update(rest).eq('id', id);
      if (error) throw error;
    }
  }

  private async applyShiftAssignmentGuarded(id: string, opData: Record<string, unknown>): Promise<void> {
    const { clocked_in_at, clocked_out_at, ...rest } = opData;

    if (clocked_in_at !== undefined) {
      const { error } = await supabase
        .from('restaurant_shift_assignments')
        .update({ clocked_in_at })
        .eq('id', id)
        .is('clocked_in_at', null);
      if (error) throw error;
    }

    if (clocked_out_at !== undefined) {
      const { error } = await supabase
        .from('restaurant_shift_assignments')
        .update({ clocked_out_at })
        .eq('id', id)
        .is('clocked_out_at', null);
      if (error) throw error;
    }

    if (Object.keys(rest).length > 0) {
      const { error } = await supabase.from('restaurant_shift_assignments').update(rest).eq('id', id);
      if (error) throw error;
    }
  }
}
