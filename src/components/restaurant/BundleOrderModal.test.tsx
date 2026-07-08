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
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

import BundleOrderModal from './BundleOrderModal';
import { toast } from 'sonner';
import type { RestaurantBundle, RestaurantBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';

const bundle: RestaurantBundle = {
  id: 'bundle-1', tenant_id: 't1', name: 'Family Feast', name_ar: null, description: null,
  price_per_guest_usd: 18, is_active: true, active_breakfast: true, active_lunch: true,
  active_dinner: true, sort_order: 0,
};

const courses: RestaurantBundleCourse[] = [
  { id: 'c1', bundle_id: 'bundle-1', tenant_id: 't1', course: 'appetizers', label: 'Choose your appetizer', sort_order: 0 },
  { id: 'c2', bundle_id: 'bundle-1', tenant_id: 't1', course: 'mains', label: 'Choose your main', sort_order: 1 },
];

const courseItems: RestaurantBundleCourseItem[] = [
  { bundle_course_id: 'c1', menu_item_id: 'mi-1' },
  { bundle_course_id: 'c1', menu_item_id: 'mi-2' },
  { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
];

function makeMenuItem(overrides: Partial<RestaurantMenuItem>): RestaurantMenuItem {
  return {
    id: 'mi-x', tenant_id: 't1', category_id: null, name: 'Item', name_ar: null,
    description: null, description_ar: null, photo_url: null, base_price_usd: 5,
    base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
    is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
    active_breakfast: true, active_lunch: true, active_dinner: true,
    sort_order: 0, is_active: true,
    ...overrides,
  };
}

const menuItems: RestaurantMenuItem[] = [
  makeMenuItem({ id: 'mi-1', name: 'Fattoush' }),
  makeMenuItem({ id: 'mi-2', name: 'Tabbouleh' }),
  makeMenuItem({ id: 'mi-3', name: 'Grilled Chicken' }),
  makeMenuItem({ id: 'mi-4', name: 'Not Linked' }),
];

const baseProps = {
  bundle,
  courses,
  courseItems,
  menuItems,
  defaultPartySize: 4,
  tableOrderId: 'order-1',
};

describe('BundleOrderModal', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('renders one section per course slot with the label, listing only that slot eligible items', () => {
    render(<BundleOrderModal {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('Choose your appetizer')).toBeInTheDocument();
    expect(screen.getByText('Choose your main')).toBeInTheDocument();
    expect(screen.getByText('Fattoush')).toBeInTheDocument();
    expect(screen.getByText('Tabbouleh')).toBeInTheDocument();
    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.queryByText('Not Linked')).not.toBeInTheDocument();
  });

  it('Confirm button is disabled until every slot has a selection, enabling after the last one', () => {
    render(<BundleOrderModal {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const confirmBtn = screen.getByRole('button', { name: /add bundle to order/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Fattoush'));
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Grilled Chicken'));
    expect(confirmBtn).not.toBeDisabled();
  });

  it('party size stepper defaults to the passed party size, floors at 1, and the running total recomputes', () => {
    render(<BundleOrderModal {...baseProps} defaultPartySize={4} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByLabelText('Decrease party size'));
    }
    expect(screen.getByText('1')).toBeInTheDocument(); // floors at 1, cannot go below
    fireEvent.click(screen.getByLabelText('Increase party size'));
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/\$36\.00/)).toBeInTheDocument(); // 18 * 2
  });

  it('Confirm calls add_bundle_to_order with the exact selection shape, one entry per slot in render order', async () => {
    mockRpc.mockResolvedValue({ data: { order_id: 'order-1', bundle_id: 'bundle-1', charge_item_id: 'item-1', party_size: 4 }, error: null });
    render(<BundleOrderModal {...baseProps} onClose={vi.fn()} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add bundle to order/i }));
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('add_bundle_to_order', {
        p_table_order_id: 'order-1',
        p_bundle_id: 'bundle-1',
        p_party_size: 4,
        p_course_selections: [
          { bundle_course_id: 'c1', menu_item_id: 'mi-1' },
          { bundle_course_id: 'c2', menu_item_id: 'mi-3' },
        ],
      });
    });
  });

  it('success path shows a success toast and calls onConfirm then onClose', async () => {
    mockRpc.mockResolvedValue({ data: { order_id: 'order-1' }, error: null });
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<BundleOrderModal {...baseProps} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add bundle to order/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('error path shows an error toast and keeps the modal open (does not call onClose)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'order_not_open: status = paid' } });
    const onClose = vi.fn();
    render(<BundleOrderModal {...baseProps} onClose={onClose} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add bundle to order/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a course slot with zero eligible items renders with no selectable pills and keeps Confirm disabled', () => {
    render(
      <BundleOrderModal
        {...baseProps}
        courseItems={[{ bundle_course_id: 'c1', menu_item_id: 'mi-1' }]}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText('Not available right now')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Fattoush'));
    expect(screen.getByRole('button', { name: /add bundle to order/i })).toBeDisabled();
  });
});
