import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_target, prop) => prop }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import QRBundleDetail from './QRBundleDetail';
import type { QRMenuBundle, QRMenuBundleCourse, RestaurantBundleCourseItem, RestaurantMenuItem } from '@/types/restaurant';

const bundle: QRMenuBundle = {
  id: 'bundle-1', name: 'Family Feast', name_ar: null, description: 'A great combo', price_per_guest_usd: 18, sort_order: 0,
};

const courses: QRMenuBundleCourse[] = [
  { id: 'c1', bundle_id: 'bundle-1', course: 'appetizers', label: 'Choose your appetizer', sort_order: 0 },
  { id: 'c2', bundle_id: 'bundle-1', course: 'mains', label: 'Choose your main', sort_order: 1 },
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
  makeMenuItem({ id: 'mi-4', name: 'Unrelated Dish' }),
];

describe('QRBundleDetail', () => {
  it('renders one section per course with that course label, listing only that course eligible active items', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.getByText('Choose your appetizer')).toBeInTheDocument();
    expect(screen.getByText('Choose your main')).toBeInTheDocument();
    expect(screen.getByText('Fattoush')).toBeInTheDocument();
    expect(screen.getByText('Tabbouleh')).toBeInTheDocument();
    expect(screen.getByText('Grilled Chicken')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated Dish')).not.toBeInTheDocument();
  });

  it('filters out inactive items from a course eligible list', () => {
    const itemsWithInactive = [
      makeMenuItem({ id: 'mi-1', name: 'Fattoush' }),
      makeMenuItem({ id: 'mi-2', name: 'Tabbouleh' }),
      makeMenuItem({ id: 'mi-3', name: 'Grilled Chicken', is_active: false }),
    ];
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={itemsWithInactive} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.queryByText('Grilled Chicken')).not.toBeInTheDocument();
    expect(screen.getByText('Not available right now')).toBeInTheDocument();
  });

  it('a course with zero eligible active items renders a disabled empty state and keeps Confirm disabled', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={[]} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.getAllByText('Not available right now')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /add to order/i })).toBeDisabled();
  });

  it('party size stepper defaults to 1, floors at 1, and the running total recomputes', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Decrease party size'));
    expect(screen.getByText('1')).toBeInTheDocument(); // floors at 1
    fireEvent.click(screen.getByLabelText('Increase party size'));
    fireEvent.click(screen.getByLabelText('Increase party size'));
    expect(screen.getByText('$54.00')).toBeInTheDocument(); // 18 * 3
  });

  it('Confirm is disabled until every course has a selection, enabling once the last one is filled', () => {
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={vi.fn()} onAddToCart={vi.fn()} />,
    );
    const confirmBtn = screen.getByRole('button', { name: /add to order/i });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Fattoush'));
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(screen.getByText('Grilled Chicken'));
    expect(confirmBtn).not.toBeDisabled();
  });

  it('Confirm calls onAddToCart with one selection per course, then calls onClose', () => {
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    render(
      <QRBundleDetail bundle={bundle} courses={courses} courseItems={courseItems} menuItems={menuItems} lang="en" onClose={onClose} onAddToCart={onAddToCart} />,
    );
    fireEvent.click(screen.getByText('Fattoush'));
    fireEvent.click(screen.getByText('Grilled Chicken'));
    fireEvent.click(screen.getByRole('button', { name: /add to order/i }));
    expect(onAddToCart).toHaveBeenCalledWith(bundle, 1, [
      { bundleCourseId: 'c1', menuItemId: 'mi-1', itemName: 'Fattoush' },
      { bundleCourseId: 'c2', menuItemId: 'mi-3', itemName: 'Grilled Chicken' },
    ]);
    expect(onClose).toHaveBeenCalled();
  });
});
