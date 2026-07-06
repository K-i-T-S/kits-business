import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();
const mockSelectResult = { data: [] as unknown[], error: null };

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(mockSelectResult),
        }),
      }),
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
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ currentTenant: { id: 't1' } }),
}));

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/RoleGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/FeatureGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import DeliveryOrders from './DeliveryOrders';

const newOrder = {
  id: 'do-1', tenant_id: 't1', branch_id: null, platform: 'toters', external_order_id: 'TO-100',
  customer_name: 'Karim', customer_phone: '+96181290662', delivery_address: 'Hamra St.',
  items: [{ name: 'Chicken Shawarma', quantity: 2, unit_price: 8.5, notes: '', modifiers: [] }],
  subtotal_usd: 17, delivery_fee_usd: 2, total_usd: 19,
  status: 'new', estimated_pickup_at: null, table_order_id: null, notes: null,
  received_at: '2026-07-06T10:00:00Z', accepted_at: null, ready_at: null,
};
const acceptedOrder = { ...newOrder, id: 'do-2', status: 'accepted', table_order_id: 'ord-1' };
const preparingOrder = { ...newOrder, id: 'do-3', status: 'preparing', table_order_id: 'ord-2' };
const readyOrder = { ...newOrder, id: 'do-4', status: 'ready', table_order_id: 'ord-3' };

describe('DeliveryOrders', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'result-id', error: null });
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    mockSelectResult.data = [newOrder, acceptedOrder, preparingOrder, readyOrder];
  });

  it('groups orders into the correct status columns', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getByText('New')).toBeInTheDocument(); });
    expect(screen.getAllByText('TO-100')).toHaveLength(4);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('Preparing')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('calls accept_delivery_order when Accept is clicked', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /accept/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /accept/i })[0]!);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('accept_delivery_order', { p_delivery_order_id: 'do-1' });
    });
  });

  it('calls reject_delivery_order when Reject is clicked', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /reject/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /reject/i })[0]!);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('reject_delivery_order', { p_delivery_order_id: 'do-1' });
    });
  });

  it('uses a direct update (not an RPC) for Start Prep', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /start prep/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /start prep/i })[0]!);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'preparing' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('uses a direct update (not an RPC) for Mark Ready', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /mark ready/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /mark ready/i })[0]!);
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'ready' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('calls complete_delivery_order when Mark Picked Up is clicked', async () => {
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /mark picked up/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /mark picked up/i })[0]!);
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('complete_delivery_order', { p_delivery_order_id: 'do-4' });
    });
  });

  it('shows an error toast when an RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { toast } = await import('sonner');
    render(<DeliveryOrders />);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: /accept/i })[0]).toBeInTheDocument(); });
    fireEvent.click(screen.getAllByRole('button', { name: /accept/i })[0]!);
    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
  });
});
