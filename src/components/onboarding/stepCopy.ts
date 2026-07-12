import type { Industry } from '@/types/industry';

export interface Step2Copy {
  heading: string;
  subtitle: string;
  nameLabel: string;
  placeholder: string;
  ctaLabel: string;
  stepperLabel: string;
}

// Industry-aware copy for Onboarding Step 2 ("first product"). The underlying
// data model is always a generic `products` row (see handleStep2 in
// OnboardingWizard.tsx) — only the presentation copy adapts per vertical.
export const STEP2_COPY: Record<Industry | '', Step2Copy> = {
  '': {
    heading: 'Add your first product',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Product Name *',
    placeholder: 'e.g. Bottled Water 500ml',
    ctaLabel: 'Add Product & Continue →',
    stepperLabel: 'First Product',
  },
  restaurant: {
    heading: 'Add your first menu item',
    subtitle: 'Step 2 of 4 — Menu setup',
    nameLabel: 'Menu Item Name *',
    placeholder: 'e.g. Chicken Shawarma Plate',
    ctaLabel: 'Add Menu Item & Continue →',
    stepperLabel: 'First Menu Item',
  },
  pharmacy: {
    heading: 'Add your first medication',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Medication Name *',
    placeholder: 'e.g. Panadol 500mg',
    ctaLabel: 'Add Medication & Continue →',
    stepperLabel: 'First Medication',
  },
  supermarket: {
    heading: 'Add your first grocery item',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Item Name *',
    placeholder: 'e.g. Bottled Water 500ml',
    ctaLabel: 'Add Item & Continue →',
    stepperLabel: 'First Grocery Item',
  },
  fashion: {
    heading: 'Add your first garment',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Garment Name *',
    placeholder: "e.g. Men's Cotton T-Shirt",
    ctaLabel: 'Add Garment & Continue →',
    stepperLabel: 'First Garment',
  },
  electronics: {
    heading: 'Add your first product',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Product Name *',
    placeholder: 'e.g. Wireless Mouse',
    ctaLabel: 'Add Product & Continue →',
    stepperLabel: 'First Product',
  },
  mobile: {
    heading: 'Add your first device',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Device Name *',
    placeholder: 'e.g. iPhone 13 128GB',
    ctaLabel: 'Add Device & Continue →',
    stepperLabel: 'First Device',
  },
  retail: {
    heading: 'Add your first product',
    subtitle: 'Step 2 of 4 — Inventory setup',
    nameLabel: 'Product Name *',
    placeholder: 'e.g. Bottled Water 500ml',
    ctaLabel: 'Add Product & Continue →',
    stepperLabel: 'First Product',
  },
};

export const STEP_NARRATIVE: Record<number, { title: string; subtitle: string }> = {
  1: {
    title: "Let's set up your business",
    subtitle: 'A few quick details and your terminal is ready.',
  },
  2: {
    title: 'Stock your first item',
    subtitle: 'Add one now — import the rest anytime from Inventory.',
  },
  3: {
    title: 'Bring your team onboard',
    subtitle: 'Invite staff now, or do it later from Employees.',
  },
  4: {
    title: "You're all set",
    subtitle: "Welcome to KiTS — let's make today count.",
  },
};
