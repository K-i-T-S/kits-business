import { z } from 'zod';

// Enhanced validation schemas with security constraints
export const SecuritySchemas = {
  // Product validation with XSS protection
  product: z.object({
    name: z.string()
      .min(1, 'Product name is required')
      .max(100, 'Product name too long')
      .refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters in product name'),

    barcode: z.string()
      .min(8, 'Barcode must be at least 8 characters')
      .max(18, 'Barcode too long')
      .refine((val) => /^[0-9A-Za-z]+$/.test(val), 'Barcode can only contain letters and numbers'),

    sku: z.string()
      .min(1, 'SKU is required')
      .max(50, 'SKU too long')
      .refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters in SKU'),

    category: z.string()
      .min(1, 'Category is required')
      .max(50, 'Category too long')
      .refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters in category'),

    supplier: z.string()
      .min(1, 'Supplier is required')
      .max(100, 'Supplier name too long')
      .refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters in supplier name'),

    variants: z.array(z.object({
      id: z.string(),
      attributes: z.record(z.string().refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters')),
      cost: z.number().min(0, 'Cost cannot be negative').max(999999, 'Cost too high'),
      price: z.number().min(0, 'Price cannot be negative').max(999999, 'Price too high'),
      stock: z.number().int().min(0, 'Stock cannot be negative').max(999999, 'Stock too high'),
      reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative').max(999999, 'Reorder level too high'),
    })).min(1, 'At least one variant is required'),
  }),

  // Customer validation with PII protection
  customer: z.object({
    name: z.string()
      .min(1, 'Customer name is required')
      .max(100, 'Name too long')
      .refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters in name'),

    phone: z.string()
      .min(10, 'Phone number too short')
      .max(20, 'Phone number too long')
      .refine((val) => /^[\+0-9\s\-\(\)]+$/.test(val), 'Invalid phone number format'),

    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email too long')
      .toLowerCase(),

    debtBalance: z.number().min(-999999, 'Debt balance out of range').max(999999, 'Debt balance out of range'),
    totalPurchases: z.number().min(0, 'Total purchases cannot be negative').max(9999999, 'Total purchases too high'),
  }).partial(),

  // Employee validation with role security
  employee: z.object({
    name: z.string()
      .min(1, 'Employee name is required')
      .max(100, 'Name too long')
      .refine((val) => !/<|>|'|"|&/.test(val), 'Invalid characters in name'),

    email: z.string()
      .email('Invalid email format')
      .max(255, 'Email too long')
      .toLowerCase(),

    role: z.enum(['admin', 'manager', 'cashier'], {
      errorMap: () => ({ message: 'Invalid role specified' }),
    }),

    commission: z.number()
      .min(0, 'Commission cannot be negative')
      .max(100, 'Commission cannot exceed 100%')
      .optional(),
  }),

  // Sale validation with business rules
  sale: z.object({
    items: z.array(z.object({
      productId: z.string().min(1, 'Product ID is required'),
      variantId: z.string().min(1, 'Variant ID is required'),
      productName: z.string().min(1, 'Product name is required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1000, 'Quantity too high'),
      price: z.number().min(0, 'Price cannot be negative').max(999999, 'Price too high'),
      cost: z.number().min(0, 'Cost cannot be negative').max(999999, 'Cost too high'),
    })).min(1, 'Sale must have at least one item'),

    subtotal: z.number().min(0, 'Subtotal cannot be negative').max(9999999, 'Subtotal too high'),
    total: z.number().min(0, 'Total cannot be negative').max(9999999, 'Total too high'),
    paymentMethod: z.enum(['cash', 'card'], {
      errorMap: () => ({ message: 'Invalid payment method' }),
    }),
    employeeId: z.string().min(1, 'Employee ID is required'),
    customerId: z.string().optional(),
  }),

  // Stock update validation
  stockUpdate: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    variantId: z.string().min(1, 'Variant ID is required'),
    quantity: z.number().int().min(0, 'Quantity cannot be negative').max(10000, 'Quantity too high'),
  }),
};

// Input sanitization utilities
export class InputSanitizer {
  static sanitizeString(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') return '';

    let result = input.substring(0, maxLength);

    // Remove HTML characters - safe character-by-character approach
    result = result.replace(/[<>'"&]/g, '');

    // Remove javascript: protocol - case insensitive, length-limited
    result = result.replace(/javascript:/gi, '');

    // Remove event handlers - limited pattern (on + word chars only)
    result = result.replace(/on[a-z]{2,}=/gi, '');

    return result.trim();
  }

  static sanitizeNumber(input: any, min: number = -Infinity, max: number = Infinity): number {
    const num = Number(input);
    if (isNaN(num) || !isFinite(num)) return 0;
    return Math.max(min, Math.min(max, num));
  }

  static sanitizeEmail(input: string): string {
    if (typeof input !== 'string') return '';

    const email = input.toLowerCase().trim();

    // Safe email validation: no complex regex backtracking
    const emailParts = email.split('@');
    if (emailParts.length !== 2) return '';
    if (!emailParts[0] || !emailParts[1]) return '';
    if (emailParts[0].length === 0 || emailParts[0].length > 64) return '';
    if (!emailParts[1].includes('.') || emailParts[1].length === 0) return '';
    if (email.length > 255) return '';

    // Additional sanitization
    return email.replace(/[<>'"&]/g, '').substring(0, 255);
  }

  static sanitizePhone(input: string): string {
    if (typeof input !== 'string') return '';

    // Keep only valid phone characters - simple character set
    const phone = input.replace(/[^\d\s\-\+\(\)]/g, '').trim();

    // Basic validation - must have at least 10 digits (not including formatting)
    const digitCount = (phone.match(/\d/g) || []).length;
    if (digitCount < 10) return '';

    return phone.substring(0, 20);
  }

  static sanitizeObject(obj: any, maxDepth: number = 10): any {
    if (maxDepth <= 0) return null;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, maxDepth - 1));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys
      const sanitizedKey = String(key).replace(/[<>'"&]/g, '').substring(0, 100);

      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (typeof value === 'number') {
        sanitized[sanitizedKey] = this.sanitizeNumber(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeObject(value, maxDepth - 1);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    return sanitized;
  }
}

// Enhanced validation with security checks
export class SecurityValidator {
  static validateProduct(product: unknown) {
    try {
      const sanitized = InputSanitizer.sanitizeObject(product);
      return SecuritySchemas.product.parse(sanitized);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  static validateCustomer(customer: unknown) {
    try {
      const sanitized = InputSanitizer.sanitizeObject(customer);
      return SecuritySchemas.customer.parse(sanitized);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  static validateEmployee(employee: unknown) {
    try {
      const sanitized = InputSanitizer.sanitizeObject(employee);
      return SecuritySchemas.employee.parse(sanitized);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  static validateSale(sale: unknown) {
    try {
      const sanitized = InputSanitizer.sanitizeObject(sale);
      return SecuritySchemas.sale.parse(sanitized);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  static validateStockUpdate(productId: string, variantId: string, quantity: number) {
    try {
      return SecuritySchemas.stockUpdate.parse({
        productId: InputSanitizer.sanitizeString(productId),
        variantId: InputSanitizer.sanitizeString(variantId),
        quantity: InputSanitizer.sanitizeNumber(quantity, 0, 10000),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }
}
