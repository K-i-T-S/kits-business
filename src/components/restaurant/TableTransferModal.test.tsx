import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: () => ({ eq: (...eqArgs: unknown[]) => mockEq2(...eqArgs) }) };
      },
    }),
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
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    baseProps.onClose = vi.fn();
    baseProps.onSuccess = vi.fn();
  });

  it('lists target tables excluding the source table, flagging occupied ones', () => {
    render(<TableTransferModal {...baseProps} />);
    expect(screen.queryByText(/Table 1/)).not.toBeInTheDocument();
    expect(screen.getByText(/Table 2/)).toBeInTheDocument();
    expect(screen.getByText(/Table 3.*will merge/i)).toBeInTheDocument();
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
      });
    });
    expect(baseProps.onSuccess).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('requires an extra confirmation step before merging into an occupied table', async () => {
    render(<TableTransferModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText(/move to table/i), { target: { value: 'table-3' } });
    fireEvent.click(screen.getByRole('button', { name: /review merge/i }));

    expect(screen.getByText(/combine 3 items from table 1 into table 3/i)).toBeInTheDocument();
    expect(mockRpc).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /combine bills/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_transfer_table_order', {
        p_order_id: 'order-1',
        p_target_table_id: 'table-3',
        p_new_waiter_id: null,
      });
    });
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

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<TableTransferModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
