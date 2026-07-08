import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeSelectChain(data: unknown[]) {
  const p = Promise.resolve({ data, error: null }) as Promise<{ data: unknown[]; error: null }> & {
    eq: () => typeof p;
    order: () => typeof p;
    select: () => typeof p;
  };
  p.eq = () => p;
  p.order = () => p;
  p.select = () => p;
  return p;
}

let mockCategories: unknown[] = [];
let mockItems: unknown[] = [];
let mockBundles: unknown[] = [];
let mockBundleCourses: unknown[] = [];
let mockBundleCourseItems: unknown[] = [];

const callOrder: string[] = [];
const mockBundleInsert = vi.fn();
const mockBundleUpdate = vi.fn();
const mockBundleDelete = vi.fn();
const mockCourseDelete = vi.fn();
const mockCourseInsert = vi.fn();
const mockCourseItemsInsert = vi.fn();

vi.mock('@/utils/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'restaurant_menu_categories') return { select: () => makeSelectChain(mockCategories) };
      if (table === 'restaurant_menu_items') return { select: () => makeSelectChain(mockItems) };
      if (table === 'restaurant_bundle_course_items') {
        return {
          select: () => makeSelectChain(mockBundleCourseItems),
          insert: (rows: unknown) => {
            callOrder.push('bundle_course_items.insert');
            mockCourseItemsInsert(rows);
            return Promise.resolve({ data: rows, error: null });
          },
        };
      }
      if (table === 'restaurant_bundle_courses') {
        return {
          select: () => makeSelectChain(mockBundleCourses),
          delete: () => {
            callOrder.push('bundle_courses.delete');
            mockCourseDelete();
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
          insert: (row: unknown) => {
            callOrder.push('bundle_courses.insert');
            mockCourseInsert(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: `new-course-${callOrder.length}`, ...(row as object) }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'restaurant_bundles') {
        return {
          select: () => makeSelectChain(mockBundles),
          insert: (row: unknown) => {
            callOrder.push('bundles.insert');
            mockBundleInsert(row);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'new-bundle-1', ...(row as object) }, error: null }),
              }),
            };
          },
          update: (row: unknown) => {
            callOrder.push('bundles.update');
            mockBundleUpdate(row);
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
          delete: () => {
            mockBundleDelete();
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      }
      return { select: () => makeSelectChain([]) };
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ currentTenant: { id: 't1' } }),
}));

vi.mock('@/components/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/restaurant/AIContentGeneratorModal', () => ({
  AIContentGeneratorModal: () => null,
}));

import MenuManagement from './MenuManagement';
import { toast } from 'sonner';

const bundleFixture = {
  id: 'bundle-1', tenant_id: 't1', name: 'Family Feast', name_ar: null, description: null,
  price_per_guest_usd: 18, is_active: true, active_breakfast: true, active_lunch: true,
  active_dinner: true, sort_order: 0,
};
const courseFixture = {
  id: 'c1', bundle_id: 'bundle-1', tenant_id: 't1', course: 'appetizers', label: 'Choose your appetizer', sort_order: 0,
};
const courseItemFixture = { bundle_course_id: 'c1', menu_item_id: 'mi-1' };
const menuItemFixture = {
  id: 'mi-1', tenant_id: 't1', category_id: null, name: 'Fattoush', name_ar: null,
  description: null, description_ar: null, photo_url: null, base_price_usd: 5,
  base_price_lbp: null, cost_price_usd: null, calories: null, allergens: [],
  is_featured: false, is_chef_pick: false, is_eighty_sixd: false,
  active_breakfast: true, active_lunch: true, active_dinner: true,
  sort_order: 0, is_active: true,
};

async function openBundlesTab() {
  render(<MenuManagement />);
  fireEvent.click(await screen.findByRole('button', { name: /bundles/i }));
}

describe('MenuManagement — Bundles tab', () => {
  beforeEach(() => {
    mockCategories = [];
    mockItems = [menuItemFixture];
    mockBundles = [bundleFixture];
    mockBundleCourses = [courseFixture];
    mockBundleCourseItems = [courseItemFixture];
    callOrder.length = 0;
    mockBundleInsert.mockClear();
    mockBundleUpdate.mockClear();
    mockBundleDelete.mockClear();
    mockCourseDelete.mockClear();
    mockCourseInsert.mockClear();
    mockCourseItemsInsert.mockClear();
  });

  it('renders the Bundles tab and lists fetched bundles with name and price', async () => {
    await openBundlesTab();
    expect(await screen.findByText('Family Feast')).toBeInTheDocument();
    expect(screen.getByText('$18.00/guest')).toBeInTheDocument();
  });

  it('"Add Bundle" opens BundleFormModal with an empty form', async () => {
    await openBundlesTab();
    fireEvent.click(await screen.findByRole('button', { name: /add bundle/i }));
    expect(screen.getByRole('heading', { name: 'Add Bundle' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Family Feast')).toHaveValue('');
  });

  it('"Edit" opens BundleFormModal pre-filled from the selected bundle data', async () => {
    await openBundlesTab();
    const card = await screen.findByTestId('bundle-card-bundle-1');
    fireEvent.click(within(card).getByLabelText('Edit bundle'));
    expect(screen.getByDisplayValue('Family Feast')).toBeInTheDocument();
  });

  it('attempting to save with no course slots shows a toast.error and does not call insert/update', async () => {
    await openBundlesTab();
    fireEvent.click(await screen.findByRole('button', { name: /add bundle/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Family Feast'), { target: { value: 'New Combo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /create bundle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Add at least one course slot');
    });
    expect(mockBundleInsert).not.toHaveBeenCalled();
  });

  it('attempting to save a course slot with zero eligible items shows a toast.error and does not call insert/update', async () => {
    await openBundlesTab();
    fireEvent.click(await screen.findByRole('button', { name: /add bundle/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Family Feast'), { target: { value: 'New Combo' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /add course slot/i }));
    fireEvent.click(screen.getByRole('button', { name: /create bundle/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Every course slot needs at least one eligible item');
    });
    expect(mockBundleInsert).not.toHaveBeenCalled();
  });

  it('a valid save calls the bundle upsert, then delete-and-reinsert on courses/course_items in that order', async () => {
    await openBundlesTab();
    const card = await screen.findByTestId('bundle-card-bundle-1');
    fireEvent.click(within(card).getByLabelText('Edit bundle'));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      expect(mockBundleUpdate).toHaveBeenCalled();
    });
    expect(callOrder).toEqual(['bundles.update', 'bundle_courses.delete', 'bundle_courses.insert', 'bundle_course_items.insert']);
  });

  it('deleting a bundle prompts confirm() and only deletes when confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    await openBundlesTab();
    const card = await screen.findByTestId('bundle-card-bundle-1');
    const deleteButton = within(card).getByLabelText('Delete bundle');

    confirmSpy.mockReturnValueOnce(false);
    fireEvent.click(deleteButton);
    expect(mockBundleDelete).not.toHaveBeenCalled();

    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(mockBundleDelete).toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });
});
