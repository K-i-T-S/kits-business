import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_target, prop) => prop }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import QRCart from './QRCart';

const cartItem = {
  menuItemId: 'mi-1',
  menuItem: { id: 'mi-1', name: 'Hummus', name_ar: null, base_price_usd: 5, tenant_id: 't1', category_id: null, description: null, description_ar: null, photo_url: null, base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [], is_featured: false, is_chef_pick: false, is_eighty_sixd: false, active_breakfast: true, active_lunch: true, active_dinner: true, sort_order: 0, is_active: true },
  quantity: 2,
  selectedModifiers: { 'grp-1': ['mod-1'] },
  totalPrice: 10,
  notes: 'no onions',
};

describe('QRCart', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('calls qr_place_order with a thin, server-trusted payload (no client-computed price)', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'direct', order_id: 'order-abcdef' }, error: null });
    const onSuccess = vi.fn();
    render(
      <QRCart
        items={[cartItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('qr_place_order', {
        p_table_id: 'tbl-1',
        p_items: [{ menu_item_id: 'mi-1', quantity: 2, modifier_ids: ['mod-1'], notes: 'no onions' }],
      });
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('ABCDEF', 'direct');
    });
  });

  it('passes mode "pending" through to onSuccess when the tenant requires waiter confirmation', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'pending', order_id: 'order-ghijkl' }, error: null });
    const onSuccess = vi.fn();
    render(
      <QRCart
        items={[cartItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('GHIJKL', 'pending');
    });
  });

  it('shows a visible error message instead of failing silently', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'no_valid_items' } });
    render(
      <QRCart
        items={[cartItem]}
        tableId="tbl-1"
        tenantId="t1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
