import { column, Schema, Table } from '@powersync/web';
// OR: import { column, Schema, Table } from '@powersync/react-native';

const tenants = new Table(
  {
    // id column (text) is automatically included
    name: column.text,
    slug: column.text,
    settings: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
    subscription_plan: column.text,
    subscription_status: column.text,
    trial_ends_at: column.text,
    stripe_customer_id: column.text,
    stripe_subscription_id: column.text,
    onboarding_completed: column.integer,
    onboarding_step: column.integer,
    industry: column.text,
    phone: column.text,
    country: column.text,
    currency: column.text,
    business_type: column.text,
    preferred_region: column.text,
    db_provision_status: column.text,
    standalone_supabase_url: column.text,
    standalone_anon_key: column.text,
    db_provisioned_at: column.text,
    db_provision_notes: column.text,
    brand_logo_url: column.text,
    brand_primary: column.text,
    brand_secondary: column.text,
    brand_tagline: column.text,
    tax_rate: column.text,
    secondary_currency: column.text,
    exchange_rate: column.text,
    show_dual_currency: column.integer,
    tin: column.text,
    loyalty_enabled: column.integer,
    loyalty_points_per_dollar: column.text,
    loyalty_points_redeem_rate: column.text,
    qr_menu_palette: column.text,
    qr_menu_promotional_banner: column.text,
  },
  { indexes: {} },
);

const tenant_users = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    user_id: column.text,
    role: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
    custom_role_id: column.text,
  },
  { indexes: {} },
);

const user_active_tenant = new Table(
  {
    // id column (text) is automatically included
    user_id: column.text,
    tenant_id: column.text,
    updated_at: column.text,
  },
  { indexes: {} },
);

const employees = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    name: column.text,
    email: column.text,
    phone: column.text,
    role: column.text,
    commission: column.text,
    is_active: column.integer,
    hire_date: column.text,
    created_at: column.text,
    updated_at: column.text,
    commission_rate: column.text,
    user_id: column.text,
  },
  { indexes: {} },
);

const products = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    name: column.text,
    description: column.text,
    price: column.text,
    cost: column.text,
    sku: column.text,
    barcode: column.text,
    category: column.text,
    stock_quantity: column.integer,
    min_stock_level: column.integer,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
    supplier: column.text,
    validity_date: column.text,
    unit: column.text,
    supplier_id: column.text,
  },
  // trackPrevious is a deliberate addition on top of the CLI-generated
  // schema (not auto-generated) -- needed so the backend connector's
  // uploadData() can compute a delta (new - previous) for stock_quantity
  // instead of blindly overwriting it, per the founder-locked conflict rule
  // that inventory changes apply as deltas. Re-running `powersync generate
  // schema` will drop this -- re-add it if regenerating.
  { indexes: {}, trackPrevious: true },
);

const sales = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    customer_id: column.text,
    employee_id: column.text,
    subtotal: column.text,
    discount: column.text,
    tax_amount: column.text,
    total_amount: column.text,
    payment_method: column.text,
    payment_status: column.text,
    notes: column.text,
    sale_date: column.text,
    created_at: column.text,
    source: column.text,
    table_order_id: column.text,
  },
  { indexes: {} },
);

const sale_items = new Table(
  {
    // id column (text) is automatically included
    sale_id: column.text,
    product_id: column.text,
    quantity: column.integer,
    unit_price: column.text,
    total_price: column.text,
    created_at: column.text,
    unit_cost: column.text,
    product_name: column.text,
  },
  { indexes: {} },
);

const table_orders = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    table_id: column.text,
    status: column.text,
    current_course: column.text,
    notes: column.text,
    opened_at: column.text,
    closed_at: column.text,
    order_flow: column.text,
    payment_mode: column.text,
    branch_id: column.text,
    service_charge_pct: column.text,
    vat_pct: column.text,
    tip_amount_usd: column.text,
    discount_pct: column.text,
    paid_at: column.text,
    payment_method: column.text,
    waiter_id: column.text,
    total_amount: column.text,
    service_charge: column.text,
    tips: column.text,
    covers: column.integer,
    payment_currency: column.text,
    merged_into_order_id: column.text,
  },
  { indexes: {} },
);

const restaurant_order_items = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    order_id: column.text,
    product_name: column.text,
    quantity: column.integer,
    unit_price: column.text,
    modifiers: column.text,
    course: column.text,
    status: column.text,
    notes: column.text,
    sent_at: column.text,
    ready_at: column.text,
    menu_item_id: column.text,
    product_id: column.text,
    created_at: column.text,
    bundle_id: column.text,
  },
  { indexes: {} },
);

const restaurant_tables = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    number: column.integer,
    name: column.text,
    section: column.text,
    seats: column.integer,
    x: column.text,
    y: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} },
);

const restaurant_shifts = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    shift_date: column.text,
    shift_type: column.text,
    start_time: column.text,
    end_time: column.text,
    notes: column.text,
    is_closed: column.integer,
    closed_at: column.text,
    created_at: column.text,
  },
  { indexes: {} },
);

const restaurant_shift_assignments = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    shift_id: column.text,
    employee_id: column.text,
    role: column.text,
    section: column.text,
    station: column.text,
    clocked_in_at: column.text,
    clocked_out_at: column.text,
  },
  { indexes: {} },
);

const restaurant_menu_categories = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    name: column.text,
    name_ar: column.text,
    description: column.text,
    icon: column.text,
    sort_order: column.integer,
    active_breakfast: column.integer,
    active_lunch: column.integer,
    active_dinner: column.integer,
    active_allday: column.integer,
    created_at: column.text,
  },
  { indexes: {} },
);

const restaurant_menu_items = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    category_id: column.text,
    name: column.text,
    name_ar: column.text,
    description: column.text,
    description_ar: column.text,
    photo_url: column.text,
    base_price_usd: column.text,
    base_price_lbp: column.text,
    cost_price_usd: column.text,
    calories: column.integer,
    allergens: column.text,
    is_featured: column.integer,
    is_chef_pick: column.integer,
    is_eighty_sixd: column.integer,
    active_breakfast: column.integer,
    active_lunch: column.integer,
    active_dinner: column.integer,
    sort_order: column.integer,
    is_active: column.integer,
    created_at: column.text,
    product_id: column.text,
  },
  { indexes: {} },
);

const restaurant_modifier_groups = new Table(
  {
    // id column (text) is automatically included
    tenant_id: column.text,
    name: column.text,
    name_ar: column.text,
    min_selections: column.integer,
    max_selections: column.integer,
    is_required: column.integer,
  },
  { indexes: {} },
);

const restaurant_modifiers = new Table(
  {
    // id column (text) is automatically included
    group_id: column.text,
    tenant_id: column.text,
    name: column.text,
    name_ar: column.text,
    price_delta: column.text,
    sort_order: column.integer,
  },
  { indexes: {} },
);

const restaurant_menu_item_modifiers = new Table(
  {
    // id column (text) is automatically included
    menu_item_id: column.text,
    modifier_group_id: column.text,
  },
  { indexes: {} },
);

export const AppSchema = new Schema({
  tenants,
  tenant_users,
  user_active_tenant,
  employees,
  products,
  sales,
  sale_items,
  table_orders,
  restaurant_order_items,
  restaurant_tables,
  restaurant_shifts,
  restaurant_shift_assignments,
  restaurant_menu_categories,
  restaurant_menu_items,
  restaurant_modifier_groups,
  restaurant_modifiers,
  restaurant_menu_item_modifiers,
});

export type Database = (typeof AppSchema)['types'];

