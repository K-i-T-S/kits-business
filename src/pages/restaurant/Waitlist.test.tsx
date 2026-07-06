import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq2 = vi.fn();
const mockWaitlistSelectResult = { data: [] as unknown[], error: null };
const mockTablesSelectResult = { data: [] as unknown[], error: null };

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => {
      if (table === 'restaurant_waitlist') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => Promise.resolve(mockWaitlistSelectResult),
              }),
            }),
          }),
          insert: (...args: unknown[]) => {
            mockInsert(...args);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'wl-new', ...(args[0] as object) }, error: null }) }) };
          },
          update: (...args: unknown[]) => {
            mockUpdate(...args);
            return { eq: () => ({ eq: (...eqArgs: unknown[]) => mockEq2(...eqArgs) }) };
          },
        };
      }
      // restaurant_tables
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => Promise.resolve(mockTablesSelectResult),
            }),
          }),
        }),
      };
    },
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

import Waitlist from './Waitlist';

const waitingEntry = {
  id: 'wl-1', tenant_id: 't1', guest_name: 'Karim', guest_phone: '+96181290662',
  party_size: 4, status: 'waiting', notes: null, table_id: null,
  created_at: '2026-07-06T10:00:00Z', notified_at: null, seated_at: null,
};
const notifiedEntry = { ...waitingEntry, id: 'wl-2', guest_name: 'Lea', status: 'notified', notified_at: '2026-07-06T10:05:00Z' };
const availableTable = { id: 'tbl-1', number: 5, seats: 4, status: 'available' };

describe('Waitlist', () => {
  beforeEach(() => {
    mockRpc.mockReset().mockResolvedValue({ data: 'order-1', error: null });
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockEq2.mockReset().mockResolvedValue({ data: null, error: null });
    mockWaitlistSelectResult.data = [waitingEntry, notifiedEntry];
    mockTablesSelectResult.data = [availableTable];
  });

  it('renders the queue with guest names and elapsed wait time', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    expect(screen.getByText('Lea')).toBeInTheDocument();
  });

  it('shows Notify, Seat, Cancel for a waiting entry', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    expect(within(karimRow).getByRole('button', { name: /notify/i })).toBeInTheDocument();
    expect(within(karimRow).getByRole('button', { name: /seat/i })).toBeInTheDocument();
    expect(within(karimRow).getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('shows Seat, Cancel, No-show for a notified entry (no Notify button)', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Lea')).toBeInTheDocument(); });
    const leaRow = screen.getByText('Lea').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    expect(within(leaRow).queryByRole('button', { name: /^notify$/i })).not.toBeInTheDocument();
    expect(within(leaRow).getByRole('button', { name: /seat/i })).toBeInTheDocument();
    expect(within(leaRow).getByRole('button', { name: /no-show/i })).toBeInTheDocument();
  });

  it('adds a party to the waitlist via the Add to Waitlist form', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByRole('button', { name: /add to waitlist/i })).toBeInTheDocument(); });
    fireEvent.click(screen.getByRole('button', { name: /add to waitlist/i }));
    fireEvent.change(screen.getByLabelText(/guest name/i), { target: { value: 'Nadim' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '+96170111222' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: 't1', guest_name: 'Nadim', guest_phone: '+96170111222', party_size: 2, status: 'waiting',
      }));
    });
  });

  it('marks an entry notified and does not call an RPC', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /notify/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'notified' }));
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('cancels an entry via a direct update, not an RPC', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'cancelled' });
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('marks a notified entry no-show via a direct update', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Lea')).toBeInTheDocument(); });
    const leaRow = screen.getByText('Lea').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(leaRow).getByRole('button', { name: /no-show/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ status: 'no_show' });
    });
  });

  it('seats a party by calling fn_seat_waitlist_party with the chosen table', async () => {
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /seat/i }));
    await waitFor(() => { expect(screen.getByText(/table 5/i)).toBeInTheDocument(); });
    fireEvent.click(screen.getByText(/table 5/i));
    fireEvent.click(screen.getByRole('button', { name: /confirm seat/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('fn_seat_waitlist_party', { p_waitlist_id: 'wl-1', p_target_table_id: 'tbl-1' });
    });
  });

  it('shows an error toast when an RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { toast } = await import('sonner');
    render(<Waitlist />);
    await waitFor(() => { expect(screen.getByText('Karim')).toBeInTheDocument(); });
    const karimRow = screen.getByText('Karim').closest('div[data-testid="waitlist-row"]') as HTMLElement;
    fireEvent.click(within(karimRow).getByRole('button', { name: /seat/i }));
    await waitFor(() => { expect(screen.getByText(/table 5/i)).toBeInTheDocument(); });
    fireEvent.click(screen.getByText(/table 5/i));
    fireEvent.click(screen.getByRole('button', { name: /confirm seat/i }));
    await waitFor(() => { expect(toast.error).toHaveBeenCalled(); });
  });
});
