import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();
const mockItemCountSelect = vi.fn();
const mockItemCountEq1 = vi.fn();
const mockItemCountEq2 = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      mockFrom(table);
      if (table === 'restaurant_order_items') {
        return {
          select: (...selectArgs: unknown[]) => {
            mockItemCountSelect(...selectArgs);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockItemCountEq1(...eqArgs);
                return { eq: (...eqArgs2: unknown[]) => mockItemCountEq2(...eqArgs2) };
              },
            };
          },
        };
      }
      return {
        update: (...args: unknown[]) => {
          mockUpdate(...args);
          return { eq: () => ({ eq: (...eqArgs: unknown[]) => mockEq2(...eqArgs) }) };
        },
      };
    },
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

import TableTransferModal from './TableTransferModal';
import type { RestaurantTable, TableOrder } from '@/types/restaurant';
import type { Employee } from '@/context/AppContext';

const sourceTable: RestaurantTable = {
  id: 'table-1', tenant_id: 't1', number: 1, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};
const emptyTable: RestaurantTable = {
  id: 'table-2', tenant_id: 't1', number: 2, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'available',
};
const occupiedTable: RestaurantTable = {
  id: 'table-3', tenant_id: 't1', number: 3, name: null, section: 'indoor', seats: 4, x: 0, y: 0, status: 'occupied',
};

const sourceOrder: TableOrder = {
  id: 'order-1', tenant_id: 't1', table_id: 'table-1', status: 'open', current_course: 'mains', notes: null, opened_at: '2026-07-06T10:00:00Z', closed_at: null,
};
const targetOccupiedOrder: TableOrder = {
  id: 'order-2', tenant_id: 't1', table_id: 'table-3', status: 'open', current_course: 'mains', notes: null, opened_at: '2026-07-06T09:00:00Z', closed_at: null,
};

const employees: Employee[] = [
  { id: 'emp-1', name: 'Ahmad', email: 'a@x.com', role: 'cashier', commission: 0, totalSales: 0, shifts: [] },
];

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenantId: 't1',
  sourceTable,
  sourceOrder,
  sourceOrderItemCount: 3,
  currentWaiterId: null,
  tables: [sourceTable, emptyTable, occupiedTable],
  orders: [sourceOrder, targetOccupiedOrder],
  employees,
};

describe('TableTransferModal', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'order-1', error: null });
    mockFrom.mockReset();
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    mockItemCountSelect.mockReset();
    mockItemCountEq1.mockReset();
    mockItemCountEq2.mockReset().mockResolvedValue({ count: 3, error: null });
    baseProps.onClose = vi.fn();
    baseProps.onSuccess = vi.fn();
  });

  it('lists target tables excluding the source table, flagging occupied ones', () => {
    render(<TableTransferModal {...baseProps} />);
    expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Table 2/)).toBeInTheDocument();
    expect(screen.getByText(/Table 3.*will merge/i)).toBeInTheDocument();
  });

  it('fetches a live, unfiltered item count for the source order on open', async () => {
    render(<TableTransferModal {...baseProps} />);
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('restaurant_order_items');
      expect(mockItemCountEq1).toHaveBeenCalledWith('order_id', 'order-1');
      expect(mockItemCountEq2).toHaveBeenCalledWith('tenant_id', 't1');
    });
  });

  it('calls the RPC directly for a simple move (target table has no open order)', async () => {
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_new_waiter_id: null,
        p_allow_merge: false,
      });
    });
    expect(baseProps.onSuccess).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('requires an extra confirmation step before merging into an occupied table, and sends p_allow_merge only once confirmed', async () => {
    // Live count fetch resolves to 3, matching the sourceOrderItemCount prop — the
    // warning text is unaffected either way, but the assertions below confirm the
    // live-fetch path is what's actually driving it (see the dedicated fetch test above).
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-3' } });
    fireEvent.click(screen.getByRole('button', { name: /review merge/i }));

    await waitFor(() => {
      expect(screen.getByText(/combine 3 items from table 1 into table 3/i)).toBeInTheDocument();
    });
    expect(mockRpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /combine bills/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-3',
        p_new_waiter_id: null,
        p_allow_merge: true,
      });
    });
  });

  it('treats a target_occupied_merge_required error as a retroactive merge-confirmation gate, not a generic failure', async () => {
    // Simulates a stale frontend: it believes table-2 is empty (per its local `orders`
    // prop) and attempts a simple move, but the backend discovers the target is now
    // occupied and rejects the unacknowledged merge.
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'target_occupied_merge_required' } });
    const { toast } = await import('sonner');

    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_new_waiter_id: null,
        p_allow_merge: false,
      });
    });

    // Should show the merge-confirmation warning rather than a generic error toast.
    await waitFor(() => {
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(baseProps.onClose).not.toHaveBeenCalled();

    // Confirming from here should retry with p_allow_merge: true.
    mockRpc.mockResolvedValueOnce({ data: 'order-1', error: null });
    fireEvent.click(screen.getByRole('button', { name: /combine bills/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenLastCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-2',
        p_new_waiter_id: null,
        p_allow_merge: true,
      });
    });
    expect(baseProps.onSuccess).toHaveBeenCalled();
  });

  it('uses a direct update (not the RPC) for a waiter-only reassignment', async () => {
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/waiter/i), { target: { value: 'emp-1' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ waiter_id: 'emp-1' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(baseProps.onSuccess).toHaveBeenCalled();
  });

  it('shows an error toast and does not close on RPC failure', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { toast } = await import('sonner');
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-2' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm transfer/i }));

    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  it('labels the empty waiter option as "Unassign waiter" rather than the misleading "No change"', () => {
    render(<TableTransferModal {...baseProps} />);
    expect(screen.getByText('Unassign waiter')).toBeInTheDocument();
    expect(screen.queryByText('No change')).not.toBeInTheDocument();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<TableTransferModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
