import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeductForMenuItem = vi.fn();
const mockUpdateCalls: unknown[] = [];
const mockOrdersResult = { data: [] as unknown[], error: null };
const mockItemsResult = { data: [] as unknown[], error: null };
const mockTablesResult = { data: [] as unknown[], error: null };

function makeUpdateChain() {
  const chain = {
    eq: () => chain,
    in: () => chain,
    then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
  };
  return chain;
}

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    channel: () => {
      const ch = { on: () => ch, subscribe: () => ({}) };
      return ch;
    },
    removeChannel: () => Promise.resolve(),
    from: (table: string) => {
      if (table === 'restaurant_kds_stations') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }
      if (table === 'table_orders') {
        return { select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve(mockOrdersResult) }) }) }) };
      }
      if (table === 'restaurant_tables') {
        return { select: () => ({ eq: () => Promise.resolve(mockTablesResult) }) };
      }
      // restaurant_order_items — supports both the initial select and the bump updates
      return {
        select: () => ({ eq: () => ({ in: () => ({ order: () => Promise.resolve(mockItemsResult) }) }) }),
        update: (payload: unknown) => {
          mockUpdateCalls.push(payload);
          return makeUpdateChain();
        },
      };
    },
  },
}));

vi.mock('@/hooks/useRecipeDeduction', () => ({
  useRecipeDeduction: () => ({ deductForMenuItem: mockDeductForMenuItem }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ currentTenant: { id: 't1' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import KitchenDisplay from './KitchenDisplay';

const openOrder = {
  id: 'ord-1', tenant_id: 't1', table_id: 'tbl-1', status: 'open',
  current_course: 'mains', opened_at: '2026-07-07T10:00:00Z', closed_at: null,
};
const table = {
  id: 'tbl-1', tenant_id: 't1', number: 5, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};

function pendingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1', tenant_id: 't1', order_id: 'ord-1', menu_item_id: 'mi-1',
    product_name: 'Hummus', quantity: 2, unit_price: 5, modifiers: [], course: 'mains',
    status: 'pending', notes: null, sent_at: '2026-07-07T10:00:00Z', ready_at: null,
    ...overrides,
  };
}

describe('KitchenDisplay recipe deduction wiring', () => {
  beforeEach(() => {
    mockDeductForMenuItem.mockReset();
    mockUpdateCalls.length = 0;
    mockOrdersResult.data = [openOrder];
    mockTablesResult.data = [table];
  });

  it('deducts recipe ingredients when a single item is bumped to ready', async () => {
    mockItemsResult.data = [pendingItem()];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /mark hummus ready/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-1', 2);
    });
  });

  it('does not deduct twice on a rapid double-click of the same item', async () => {
    mockItemsResult.data = [pendingItem()];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /mark hummus ready/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call deduction for an item with no menu_item_id', async () => {
    mockItemsResult.data = [pendingItem({ id: 'item-2', menu_item_id: null })];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /mark hummus ready/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockUpdateCalls.length).toBeGreaterThan(0);
    });
    expect(mockDeductForMenuItem).not.toHaveBeenCalled();
  });

  it('deducts for every item when bumping all pending items at once', async () => {
    mockItemsResult.data = [
      pendingItem({ id: 'item-1', menu_item_id: 'mi-1', quantity: 2 }),
      pendingItem({ id: 'item-3', menu_item_id: 'mi-3', product_name: 'Fries', quantity: 3 }),
    ];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /all ready \(2\)/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-1', 2);
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-3', 3);
    });
  });

  it('deducts for every item when marking all in-progress items ready', async () => {
    mockItemsResult.data = [pendingItem({ status: 'in_progress' })];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /all ready \(1\)/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledWith('mi-1', 2);
    });
  });

  it('does not double-deduct on a rapid double-click of "Bump All"', async () => {
    mockItemsResult.data = [
      pendingItem({ id: 'item-1', menu_item_id: 'mi-1', quantity: 2 }),
      pendingItem({ id: 'item-3', menu_item_id: 'mi-3', product_name: 'Fries', quantity: 3 }),
    ];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /all ready \(2\)/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledTimes(2); // 2 items, each deducted exactly once
    });
  });

  it('does not double-deduct on a rapid double-click of "Mark All Ready"', async () => {
    mockItemsResult.data = [pendingItem({ status: 'in_progress' })];
    render(<KitchenDisplay />);
    const button = await screen.findByRole('button', { name: /all ready \(1\)/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockDeductForMenuItem).toHaveBeenCalledTimes(1);
    });
  });
});
