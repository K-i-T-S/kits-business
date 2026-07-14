import { supabase } from '@/utils/supabaseClient';

import { HUB_WIDGET_CATALOG, type HubKey } from '@/constants/hubWidgets';

export interface ResolvedHubWidget {
  id: string;
  label: string;
  visible: boolean;
}

interface HubWidgetPreferenceRow {
  widget_id: string;
  visible: boolean;
  position: number;
}

/**
 * Resolves the effective widget list for a hub: stored preferences where
 * they exist, falling back to the catalog's default (visible, catalog
 * order) for any widget with no stored row -- so an un-customized tenant
 * (or a widget added to the catalog after a tenant already customized)
 * renders exactly as the hub's own hardcoded default would.
 */
export async function loadHubWidgetConfig(tenantId: string, hubKey: HubKey): Promise<ResolvedHubWidget[]> {
  const catalog = HUB_WIDGET_CATALOG[hubKey];
  const { data, error } = await supabase
    .from('hub_widget_preferences')
    .select('widget_id, visible, position')
    .eq('tenant_id', tenantId)
    .eq('hub_key', hubKey);
  if (error) throw error;

  const stored = new Map<string, HubWidgetPreferenceRow>(
    ((data ?? []) as HubWidgetPreferenceRow[]).map((row) => [row.widget_id, row]),
  );

  return catalog
    .map((widget, catalogIndex) => {
      const pref = stored.get(widget.id);
      return {
        id: widget.id,
        label: widget.label,
        visible: pref?.visible ?? true,
        position: pref?.position ?? catalogIndex,
      };
    })
    .sort((a, b) => a.position - b.position)
    .map(({ id, label, visible }) => ({ id, label, visible }));
}

/** Persists the full ordered widget list for a hub -- called from the Hub Layout settings tab. */
export async function saveHubWidgetConfig(
  tenantId: string,
  hubKey: HubKey,
  widgets: ResolvedHubWidget[],
): Promise<void> {
  const rows = widgets.map((widget, index) => ({
    tenant_id: tenantId,
    hub_key: hubKey,
    widget_id: widget.id,
    visible: widget.visible,
    position: index,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('hub_widget_preferences')
    .upsert(rows, { onConflict: 'tenant_id,hub_key,widget_id' });
  if (error) throw error;
}

/**
 * Convenience for hub components: returns just the ordered list of
 * visible widget ids for a hub, ready to drive a render loop.
 */
export async function loadVisibleWidgetIds(tenantId: string, hubKey: HubKey): Promise<string[]> {
  const resolved = await loadHubWidgetConfig(tenantId, hubKey);
  return resolved.filter((w) => w.visible).map((w) => w.id);
}
