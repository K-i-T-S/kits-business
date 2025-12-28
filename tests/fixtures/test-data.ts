import { MockUser, MockTenant, MockSession, createMockUser, createMockTenant, createMockSession } from '../../src/test-utils/mocks';

// Test data fixtures for consistent testing across all test suites
export const testFixtures = {
  // Standard test users
  users: {
    admin: createMockUser({
      id: 'admin-user-id',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
      user_metadata: { department: 'IT', level: 'super_admin' }
    }),
    
    employee: createMockUser({
      id: 'employee-user-id',
      email: 'employee@example.com',
      name: 'Employee User',
      role: 'employee',
      user_metadata: { department: 'Sales', level: 'staff' }
    }),
    
    owner: createMockUser({
      id: 'owner-user-id',
      email: 'owner@example.com',
      name: 'Business Owner',
      role: 'owner',
      user_metadata: { department: 'Management', level: 'executive' }
    }),
    
    viewer: createMockUser({
      id: 'viewer-user-id',
      email: 'viewer@example.com',
      name: 'Viewer User',
      role: 'viewer',
      user_metadata: { department: 'Support', level: 'readonly' }
    }),
    
    multiTenant: createMockUser({
      id: 'multi-tenant-user-id',
      email: 'multi@example.com',
      name: 'Multi Tenant User',
      role: 'owner',
      user_metadata: { departments: ['IT', 'Sales'], level: 'manager' }
    })
  },

  // Standard test tenants
  tenants: {
    techBusiness: createMockTenant({
      id: 'tech-business-id',
      name: 'Tech Solutions Inc',
      slug: 'tech-solutions',
      userRole: 'owner',
      user_active: true,
      tenant_active: true,
      settings: {
        industry: 'Technology',
        size: 'medium',
        features: ['inventory', 'pos', 'reporting']
      }
    }),
    
    retailStore: createMockTenant({
      id: 'retail-store-id',
      name: 'Retail Store LLC',
      slug: 'retail-store',
      userRole: 'manager',
      user_active: true,
      tenant_active: true,
      settings: {
        industry: 'Retail',
        size: 'small',
        features: ['pos', 'inventory']
      }
    }),
    
    restaurant: createMockTenant({
      id: 'restaurant-id',
      name: 'Fine Dining Restaurant',
      slug: 'fine-dining',
      userRole: 'cashier',
      user_active: true,
      tenant_active: true,
      settings: {
        industry: 'Food Service',
        size: 'small',
        features: ['pos']
      }
    }),
    
    consulting: createMockTenant({
      id: 'consulting-id',
      name: 'Consulting Group',
      slug: 'consulting-group',
      userRole: 'viewer',
      user_active: true,
      tenant_active: true,
      settings: {
        industry: 'Professional Services',
        size: 'large',
        features: ['reporting']
      }
    })
  },

  // Test sessions
  sessions: {
    valid: createMockSession({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User'
    }),
    
    expired: createMockSession({
      id: 'expired-user-id',
      email: 'expired@example.com',
      name: 'Expired User'
    })
  },

  // Product test data
  products: [
    {
      id: 'product-1',
      name: 'Laptop Pro 15',
      sku: 'LP15-2024',
      barcode: '1234567890123',
      category: 'Hardware',
      supplier: 'Tech Supplier Inc',
      variants: [
        {
          id: 'variant-1',
          attributes: { color: 'Space Gray', size: '15"', storage: '512GB' },
          price: 1299.99,
          cost: 999.99,
          stock: 25,
          reorderLevel: 10,
          costHistory: [
            { date: '2024-01-01', cost: 949.99, quantity: 20 },
            { date: '2024-06-01', cost: 999.99, quantity: 25 }
          ]
        },
        {
          id: 'variant-2',
          attributes: { color: 'Silver', size: '15"', storage: '1TB' },
          price: 1499.99,
          cost: 1199.99,
          stock: 15,
          reorderLevel: 8,
          costHistory: [
            { date: '2024-01-01', cost: 1099.99, quantity: 15 },
            { date: '2024-06-01', cost: 1199.99, quantity: 15 }
          ]
        }
      ]
    },
    {
      id: 'product-2',
      name: 'Wireless Mouse',
      sku: 'WM-2024',
      barcode: '2345678901234',
      category: 'Accessories',
      supplier: 'Peripheral Corp',
      variants: [
        {
          id: 'variant-3',
          attributes: { color: 'Black', connectivity: 'Bluetooth' },
          price: 49.99,
          cost: 29.99,
          stock: 100,
          reorderLevel: 20,
          costHistory: [
            { date: '2024-01-01', cost: 24.99, quantity: 80 },
            { date: '2024-06-01', cost: 29.99, quantity: 100 }
          ]
        }
      ]
    },
    {
      id: 'product-3',
      name: 'Gaming Keyboard',
      sku: 'GK-RGB',
      barcode: '3456789012345',
      category: 'Gaming',
      supplier: 'Gaming Gear Ltd',
      variants: [
        {
          id: 'variant-4',
          attributes: { layout: 'Mechanical', lighting: 'RGB' },
          price: 89.99,
          cost: 59.99,
          stock: 5,
          reorderLevel: 15,
          costHistory: [
            { date: '2024-01-01', cost: 54.99, quantity: 30 },
            { date: '2024-06-01', cost: 59.99, quantity: 5 }
          ]
        }
      ]
    }
  ],

  // Sales test data
  sales: [
    {
      id: 'sale-1',
      date: new Date().toISOString(),
      total: 1299.99,
      subtotal: 1299.99,
      tax: 0,
      discount: 0,
      paymentMethod: 'credit_card',
      status: 'completed',
      customerId: 'customer-1',
      employeeId: 'employee-user-id',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          variantId: 'variant-1',
          name: 'Laptop Pro 15',
          price: 1299.99,
          cost: 999.99,
          quantity: 1,
          discount: 0
        }
      ]
    },
    {
      id: 'sale-2',
      date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      total: 139.98,
      subtotal: 139.98,
      tax: 0,
      discount: 0,
      paymentMethod: 'cash',
      status: 'completed',
      customerId: 'customer-2',
      employeeId: 'employee-user-id',
      items: [
        {
          id: 'item-2',
          productId: 'product-2',
          variantId: 'variant-3',
          name: 'Wireless Mouse',
          price: 49.99,
          cost: 29.99,
          quantity: 2,
          discount: 0
        },
        {
          id: 'item-3',
          productId: 'product-3',
          variantId: 'variant-4',
          name: 'Gaming Keyboard',
          price: 39.99,
          cost: 29.99,
          quantity: 1,
          discount: 50 // 50% discount
        }
      ]
    }
  ],

  // Customer test data
  customers: [
    {
      id: 'customer-1',
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1234567890',
      address: '123 Main St, City, State 12345',
      debtBalance: 0,
      totalPurchases: 2599.98,
      loyaltyPoints: 259,
      createdAt: new Date('2024-01-15').toISOString()
    },
    {
      id: 'customer-2',
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      phone: '+0987654321',
      address: '456 Oak Ave, Town, State 67890',
      debtBalance: 150.00,
      totalPurchases: 899.97,
      loyaltyPoints: 89,
      createdAt: new Date('2024-02-20').toISOString()
    }
  ],

  // Employee test data
  employees: [
    {
      id: 'employee-user-id',
      name: 'Employee User',
      email: 'employee@example.com',
      role: 'employee',
      department: 'Sales',
      commission: 5,
      hireDate: new Date('2024-01-01').toISOString(),
      isActive: true,
      permissions: ['pos', 'inventory_view', 'customer_management']
    },
    {
      id: 'admin-user-id',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      department: 'Management',
      commission: 10,
      hireDate: new Date('2023-06-01').toISOString(),
      isActive: true,
      permissions: ['all']
    }
  ]
};

// Helper functions for test scenarios
export const createTestScenario = (scenario: string) => {
  switch (scenario) {
    case 'admin-with-products':
      return {
        user: testFixtures.users.admin,
        tenant: testFixtures.tenants.techBusiness,
        products: testFixtures.products,
        sales: testFixtures.sales,
        customers: testFixtures.customers
      };
    
    case 'employee-with-sales':
      return {
        user: testFixtures.users.employee,
        tenant: testFixtures.tenants.retailStore,
        products: [testFixtures.products[1]], // Only accessories
        sales: [testFixtures.sales[1]], // Only recent sale
        customers: [testFixtures.customers[1]]
      };
    
    case 'multi-tenant-owner':
      return {
        user: testFixtures.users.multiTenant,
        tenants: [
          testFixtures.tenants.techBusiness,
          testFixtures.tenants.retailStore
        ],
        products: testFixtures.products,
        sales: testFixtures.sales,
        customers: testFixtures.customers
      };
    
    case 'viewer-readonly':
      return {
        user: testFixtures.users.viewer,
        tenant: testFixtures.tenants.consulting,
        products: [], // No products for viewer
        sales: [], // No sales access
        customers: [] // No customer access
      };
    
    default:
      return {
        user: testFixtures.users.owner,
        tenant: testFixtures.tenants.techBusiness,
        products: testFixtures.products,
        sales: testFixtures.sales,
        customers: testFixtures.customers
      };
  }
};

// Mock API response generators
export const mockApiResponse = (endpoint: string, data: any) => {
  const responses: Record<string, any> = {
    '/auth/v1/user': { data: { user: data } },
    '/auth/v1/session': { data: { session: data } },
    '/tenant_user_details': { data: Array.isArray(data) ? data : [data] },
    '/products': { data: data },
    '/sales': { data: data },
    '/customers': { data: data },
    '/employees': { data: data }
  };
  
  return responses[endpoint] || { data };
};

// Test data validation helpers
export const validateTestData = (type: string, data: any) => {
  const validators: Record<string, (data: any) => boolean> = {
    user: (user) => user.id && user.email && user.name,
    tenant: (tenant) => tenant.id && tenant.name && tenant.slug,
    product: (product) => product.id && product.name && product.sku,
    sale: (sale) => sale.id && sale.total && sale.items,
    customer: (customer) => customer.id && customer.name && customer.email
  };
  
  return validators[type]?.(data) || false;
};

// Export default fixtures for easy import
export default testFixtures;
