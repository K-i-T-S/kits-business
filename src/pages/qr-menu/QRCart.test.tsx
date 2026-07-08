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
        bundleItems={[]}
        tableId="tbl-1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
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
        bundleItems={[]}
        tableId="tbl-1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
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
        bundleItems={[]}
        tableId="tbl-1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('calls qr_place_order with a combined p_items array when the cart has both a regular item and a bundle line', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'direct', order_id: 'order-abcdef' }, error: null });
    const bundleItem = {
      cartKey: 'bk-1',
      bundleId: 'bundle-1',
      bundleName: 'Family Feast',
      pricePerGuestUsd: 18,
      partySize: 4,
      courseSelections: [
        { bundleCourseId: 'c1', menuItemId: 'mi-2', itemName: 'Fattoush' },
        { bundleCourseId: 'c2', menuItemId: 'mi-3', itemName: 'Grilled Chicken' },
      ],
      totalPrice: 72,
    };
    render(
      <QRCart
        items={[cartItem]}
        bundleItems={[bundleItem]}
        tableId="tbl-1"
        totalPrice={82}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('qr_place_order', {
        p_table_id: 'tbl-1',
        p_items: [
          { menu_item_id: 'mi-1', quantity: 2, modifier_ids: ['mod-1'], notes: 'no onions' },
          {
            bundle_id: 'bundle-1',
            party_size: 4,
            course_selections: [
              { bundle_course_id: 'c1', menu_item_id: 'mi-2' },
              { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
            ],
          },
        ],
      });
    });
  });

  it('cart with only a bundle line (no regular items) still enables Place Order and calls the RPC with just the bundle-add element', async () => {
    mockRpc.mockResolvedValue({ data: { mode: 'direct', order_id: 'order-bundleonly' }, error: null });
    const bundleItem = {
      cartKey: 'bk-1',
      bundleId: 'bundle-1',
      bundleName: 'Family Feast',
      pricePerGuestUsd: 18,
      partySize: 2,
      courseSelections: [{ bundleCourseId: 'c1', menuItemId: 'mi-2', itemName: 'Fattoush' }],
      totalPrice: 36,
    };
    render(
      <QRCart
        items={[]}
        bundleItems={[bundleItem]}
        tableId="tbl-1"
        totalPrice={36}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    const placeButton = screen.getByRole('button', { name: /place order/i });
    expect(placeButton).not.toBeDisabled();
    fireEvent.click(placeButton);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('qr_place_order', {
        p_table_id: 'tbl-1',
        p_items: [
          { bundle_id: 'bundle-1', party_size: 2, course_selections: [{ bundle_course_id: 'c1', menu_item_id: 'mi-2' }] },
        ],
      });
    });
  });

  it('onRemoveBundleItem is called with the correct cartKey when a bundle cart line is removed', () => {
    const onRemoveBundleItem = vi.fn();
    const bundleItem = {
      cartKey: 'bk-1',
      bundleId: 'bundle-1',
      bundleName: 'Family Feast',
      pricePerGuestUsd: 18,
      partySize: 2,
      courseSelections: [],
      totalPrice: 36,
    };
    render(
      <QRCart
        items={[]}
        bundleItems={[bundleItem]}
        tableId="tbl-1"
        totalPrice={36}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={onRemoveBundleItem}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove Family Feast'));
    expect(onRemoveBundleItem).toHaveBeenCalledWith('bk-1');
  });

  it('a bundle-related RPC error renders the mapped combo-specific message, not the generic fallback', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'item_not_eligible_for_course: item mi-2 not eligible for course c1' } });
    render(
      <QRCart
        items={[cartItem]}
        bundleItems={[]}
        tableId="tbl-1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/one of your combo selections/i)).toBeInTheDocument();
    });
  });

  it('a non-bundle RPC error still renders the existing generic message, unchanged', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'no_valid_items' } });
    render(
      <QRCart
        items={[cartItem]}
        bundleItems={[]}
        tableId="tbl-1"
        totalPrice={10}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onRemoveBundleItem={vi.fn()}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/one of your combo selections/i)).not.toBeInTheDocument();
  });
});
