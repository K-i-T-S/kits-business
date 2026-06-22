import type { Product, Sale, Customer, Employee } from '../context/AppContext';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class DataValidator {
  static validateProduct(product: Partial<Product>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!product.name?.trim()) {
      errors.push('Product name is required');
    }

    if (!product.barcode?.trim()) {
      errors.push('Barcode is required');
    } else {
      // Validate barcode: safe character check + length check
      const barcode = product.barcode.trim();
      const hasValidChars = /^[0-9A-Za-z]+$/.test(barcode);
      const hasValidLength = barcode.length >= 8 && barcode.length <= 18;
      if (!hasValidChars || !hasValidLength) {
        warnings.push('Barcode format may be invalid');
      }
    }

    if (!product.sku?.trim()) {
      errors.push('SKU is required');
    }

    if (!product.category?.trim()) {
      errors.push('Category is required');
    }

    if (!product.supplier?.trim()) {
      errors.push('Supplier is required');
    }

    if (product.variants) {
      product.variants.forEach((variant, index) => {
        if (variant.cost < 0) {
          errors.push(`Variant ${index + 1}: Cost cannot be negative`);
        }
        if (variant.price < 0) {
          errors.push(`Variant ${index + 1}: Price cannot be negative`);
        }
        if (variant.price < variant.cost) {
          warnings.push(`Variant ${index + 1}: Price is below cost`);
        }
        if (variant.stock < 0) {
          errors.push(`Variant ${index + 1}: Stock cannot be negative`);
        }
        if (variant.reorderLevel < 0) {
          errors.push(`Variant ${index + 1}: Reorder level cannot be negative`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateSale(sale: Partial<Sale>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sale.items?.length) {
      errors.push('Sale must have at least one item');
    }

    if (sale.items) {
      sale.items.forEach((item, index) => {
        if (!item.productId) {
          errors.push(`Item ${index + 1}: Product ID is required`);
        }
        if (!item.variantId) {
          errors.push(`Item ${index + 1}: Variant ID is required`);
        }
        if (!item.quantity || item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
        }
        if (item.price < 0) {
          errors.push(`Item ${index + 1}: Price cannot be negative`);
        }
        if (item.cost < 0) {
          errors.push(`Item ${index + 1}: Cost cannot be negative`);
        }
      });
    }

    if (sale.total && sale.total < 0) {
      errors.push('Total cannot be negative');
    }

    if (sale.subtotal && sale.subtotal < 0) {
      errors.push('Subtotal cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateCustomer(customer: Partial<Customer>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!customer.name?.trim()) {
      errors.push('Customer name is required');
    }

    if (!customer.phone?.trim()) {
      errors.push('Phone number is required');
    } else {
      // Validate phone: safe character check + minimum length (max 20 chars)
      const phone = customer.phone.trim();
      const hasValidChars = /^[\d\s\-\+\(\)]{1,20}$/.test(phone);
      const hasValidLength = phone.replace(/\D/g, '').length >= 10;
      if (!hasValidChars || !hasValidLength) {
        warnings.push('Phone number format may be invalid');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateEmployee(employee: Partial<Employee>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!employee.name?.trim()) {
      errors.push('Employee name is required');
    }

    if (!employee.email?.trim()) {
      errors.push('Email is required');
    } else {
      // Validate email: safe character check + max length
      const email = employee.email.trim();
      // Simple, non-backtracking email validation (basic format only)
      const emailParts = email.split('@');
      const hasValidFormat = emailParts.length === 2 &&
        emailParts[0] !== undefined &&
        emailParts[0].length > 0 &&
        emailParts[0].length <= 64 &&
        emailParts[1] !== undefined &&
        emailParts[1].includes('.') &&
        emailParts[1].length > 0 &&
        email.length <= 255;
      if (!hasValidFormat) {
        errors.push('Invalid email format');
      }
    }

    if (!employee.role) {
      errors.push('Role is required');
    }

    if (employee.commission !== undefined && (employee.commission < 0 || employee.commission > 100)) {
      errors.push('Commission must be between 0 and 100');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateStockUpdate(productId: string, variantId: string, quantity: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!productId?.trim()) {
      errors.push('Product ID is required');
    }

    if (!variantId?.trim()) {
      errors.push('Variant ID is required');
    }

    if (typeof quantity !== 'number') {
      errors.push('Quantity must be a number');
    } else if (quantity < 0) {
      errors.push('Quantity cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
