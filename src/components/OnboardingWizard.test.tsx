import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockInvoke, mockFrom, mockUpdate, mockEq, mockInsert, mockSelect } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock('../utils/supabaseClient', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
    from: mockFrom,
  },
}));

import OnboardingWizard from './OnboardingWizard';

describe('OnboardingWizard Step 3 — invite team member', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockImplementation(() => ({
      update: mockUpdate,
      insert: mockInsert,
      select: mockSelect,
    }));
  });

  async function renderAndReachStep3() {
    render(
      <OnboardingWizard tenantId="t1" tenantName="Café Milano" onComplete={vi.fn()} />,
    );

    // Step 1: business name is pre-filled from tenantName; just continue.
    await userEvent.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByText(/Step 2 of 4/i);

    // Step 2: skip product creation.
    await userEvent.click(screen.getByText(/Skip for now/i));
    await screen.findByText(/Step 3 of 4/i);
  }

  it('calls the send-invitation edge function with the invitee details, not a direct employees insert', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, invitation_id: 'inv-1' }, error: null });

    await renderAndReachStep3();

    await userEvent.type(screen.getByPlaceholderText(/Team member name/i), 'Jane Doe');
    await userEvent.type(screen.getByPlaceholderText(/email@example.com/i), 'jane@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Invite & Continue/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('send-invitation', {
        body: expect.objectContaining({
          inviteeEmail: 'jane@example.com',
          inviteeName: 'Jane Doe',
          role: 'cashier',
          tenantId: 't1',
        }),
      });
    });

    // The old buggy behavior inserted directly into `employees` — confirm
    // that path is gone (from('employees').insert(...) is never called from
    // this step; from() is only called for the Step 1 tenants update).
    const employeesInsertCalls = mockFrom.mock.calls.filter(([table]) => table === 'employees');
    expect(employeesInsertCalls).toHaveLength(0);

    await screen.findByText(/You're all set/i);
  });

  it('shows an error and stays on step 3 when the invitation fails', async () => {
    // supabase-js's functions.invoke() rejects with a real Error subclass
    // (FunctionsHttpError etc.), not a plain object — mirror that here.
    mockInvoke.mockResolvedValue({ data: null, error: new Error('Forbidden') });

    await renderAndReachStep3();

    await userEvent.type(screen.getByPlaceholderText(/Team member name/i), 'Jane Doe');
    await userEvent.type(screen.getByPlaceholderText(/email@example.com/i), 'jane@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Invite & Continue/i }));

    await screen.findByText(/Forbidden/i);
    expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
  });
});
