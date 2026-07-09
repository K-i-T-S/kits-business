import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

import SplitTableModal from './SplitTableModal';
import type { RestaurantTable, TableOrder, RestaurantOrderItem } from '@/types/restaurant';

const sourceTable: RestaurantTable = {
  id: 'table-1', tenant_id: 't1', number: 1, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};
const availableTable: RestaurantTable = {
  id: 'table-2', tenant_id: 't1', number: 2, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'available',
};
const occupiedTable: RestaurantTable = {
  id: 'table-3', tenant_id: 't1', number: 3, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};

const sourceOrder: TableOrder = {
  id: 'order-1', tenant_id: 't1', table_id: 'table-1', status: 'open', current_course: 'mains', notes: null, opened_at: '2026-07-10T10:00:00Z', closed_at: null,
};

function makeItem(overrides: Partial<RestaurantOrderItem>): RestaurantOrderItem {
  return {
    id: 'item-1', tenant_id: 't1', order_id: 'order-1', menu_item_id: null,
    product_name: 'Burger', quantity: 1, unit_price: 10, modifiers: [], course: 'mains',
    status: 'pending', bundle_id: null, notes: null, sent_at: null, ready_at: null,
    ...overrides,
  };
}

const itemA = makeItem({ id: 'item-a', product_name: 'Burger' });
const itemB = makeItem({ id: 'item-b', product_name: 'Fries' });
const bundleItem1 = makeItem({ id: 'bundle-1', product_name: 'Prix Fixe — Starter', bundle_id: 'bundle-x' });
const bundleItem2 = makeItem({ id: 'bundle-2', product_name: 'Prix Fixe — Main', bundle_id: 'bundle-x' });

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenantId: 't1',
  sourceTable,
  sourceOrder,
  sourceOrderItems: [itemA, itemB],
  tables: [sourceTable, availableTable, occupiedTable],
};

describe('SplitTableModal', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'new-order-1', error: null });
    baseProps.onClose = vi.fn();
    baseProps.onSuccess = vi.fn();
  });

  it('lists target tables limited to those with status available', () => {
    render(<SplitTableModal {...baseProps} />);
    expect(screen.getByText(/Table 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Table 3/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument();
  });

  it('keeps submit disabled until an item and a target table are both selected', () => {
    render(<SplitTableModal {...baseProps} />);
    const submitButton = screen.getByRole('button', { name: /split/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Burger/i));
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    expect(submitButton).not.toBeDisabled();
  });

  it('disables selecting every item (would empty the source order)', () => {
    render(<SplitTableModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Burger/i));
    fireEvent.click(screen.getByLabelText(/Fries/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    expect(screen.getByRole('button', { name: /split/i })).toBeDisabled();
  });

  it('calls fn_split_table_order with the selected item ids and target table', async () => {
    render(<SplitTableModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Burger/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /split/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_split_table_order', {
        p_source_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_item_ids: ['item-a'],
      });
    });
    expect(baseProps.onSuccess).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('groups bundle rows as one unit — selecting one selects all of that bundle, and they cannot be individually deselected from each other', () => {
    render(
      <SplitTableModal
        {...baseProps}
        sourceOrderItems={[itemA, bundleItem1, bundleItem2]}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Prix Fixe — Starter/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /split/i }));

    return waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_split_table_order', {
        p_source_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_item_ids: expect.arrayContaining(['bundle-1', 'bundle-2']),
      });
    });
  });

  it('maps bundle_split_not_allowed to a friendly message', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'bundle_split_not_allowed' } });
    const { toast } = await import('sonner');
    render(<SplitTableModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText(/Burger/i));
    fireEvent.change(screen.getByLabelText(/target table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /split/i }));

    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<SplitTableModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
