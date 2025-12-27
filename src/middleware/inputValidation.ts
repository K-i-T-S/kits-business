import { z, ZodSchema, ZodError } from 'zod';
import { auditLogger } from '../utils/auditService';

export interface ValidationMiddlewareConfig {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
  strict?: boolean;
  transform?: boolean;
  sanitize?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path: (string | number)[];
}

export interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
}

export class InputValidator {
  private static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return input
        .trim()
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>/g, '');
    }
    
    if (Array.isArray(input)) {
      return input.map(item => InputValidator.sanitizeInput(item));
    }
    
    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = InputValidator.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  private static formatZodError(error: ZodError): ValidationError[] {
    return error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      path: err.path,
    }));
  }

  public static validate(schema: ZodSchema, data: any, options: { sanitize?: boolean } = {}): ValidationResult {
    try {
      let processedData = data;
      
      if (options.sanitize) {
        processedData = InputValidator.sanitizeInput(data);
      }

      const result = schema.parse(processedData);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          errors: InputValidator.formatZodError(error),
        };
      }
      
      return {
        success: false,
        errors: [{
          field: 'unknown',
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          path: [],
        }],
      };
    }
  }
}

export const createValidationMiddleware = (config: ValidationMiddlewareConfig) => {
  return (req: any, res: any, next: Function) => {
    const validationResults: ValidationResult[] = [];
    let hasErrors = false;

    // Validate body
    if (config.body && req.body) {
      const result = InputValidator.validate(config.body, req.body, { sanitize: config.sanitize });
      validationResults.push({ ...result });
      if (!result.success) hasErrors = true;
      else if (config.transform) req.body = result.data;
    }

    // Validate query parameters
    if (config.query && req.query) {
      const result = InputValidator.validate(config.query, req.query, { sanitize: config.sanitize });
      validationResults.push({ ...result });
      if (!result.success) hasErrors = true;
      else if (config.transform) req.query = result.data;
    }

    // Validate route parameters
    if (config.params && req.params) {
      const result = InputValidator.validate(config.params, req.params, { sanitize: config.sanitize });
      validationResults.push({ ...result });
      if (!result.success) hasErrors = true;
      else if (config.transform) req.params = result.data;
    }

    // Validate headers
    if (config.headers && req.headers) {
      const result = InputValidator.validate(config.headers, req.headers, { sanitize: config.sanitize });
      validationResults.push({ ...result });
      if (!result.success) hasErrors = true;
      else if (config.transform) req.headers = result.data;
    }

    if (hasErrors) {
      const allErrors = validationResults
        .filter(result => !result.success)
        .flatMap(result => result.errors || []);

      // Log validation failure for security monitoring
      if (req.user) {
        auditLogger.logSecurityEvent(
          req.user.id,
          'blocked_request',
          'input_validation',
          {
            errors: allErrors,
            url: req.url,
            method: req.method,
            ip: req.ip,
          }
        ).catch(console.error);
      }

      return res.status(400).json({
        error: 'Validation failed',
        message: 'Invalid input data provided',
        errors: allErrors,
      });
    }

    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  // User-related schemas
  userRegistration: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    phone: z.string().optional(),
  }),

  userLogin: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),

  // Product schemas
  productCreate: z.object({
    name: z.string().min(1, 'Product name is required').max(100, 'Product name too long'),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative'),
    category: z.string().min(1, 'Category is required'),
    sku: z.string().min(1, 'SKU is required').max(50, 'SKU too long'),
    stock: z.number().int().min(0, 'Stock must be non-negative integer'),
  }),

  productUpdate: z.object({
    name: z.string().min(1, 'Product name is required').max(100, 'Product name too long').optional(),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be non-negative').optional(),
    category: z.string().min(1, 'Category is required').optional(),
    stock: z.number().int().min(0, 'Stock must be non-negative integer').optional(),
  }),

  // Customer schemas
  customerCreate: z.object({
    name: z.string().min(1, 'Customer name is required').max(100, 'Customer name too long'),
    email: z.string().email('Invalid email format').optional(),
    phone: z.string().optional(),
    address: z.object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zipCode: z.string().optional(),
      country: z.string().optional(),
    }).optional(),
  }),

  // Order schemas
  orderCreate: z.object({
    customerId: z.string().uuid('Invalid customer ID'),
    items: z.array(z.object({
      productId: z.string().uuid('Invalid product ID'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      price: z.number().min(0, 'Price must be non-negative'),
    })).min(1, 'Order must contain at least one item'),
    paymentMethod: z.enum(['cash', 'card', 'transfer']),
  }),

  // Query parameter schemas
  pagination: z.object({
    page: z.string().transform(Number).pipe(z.number().int().min(1)).default('1'),
    limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default('10'),
  }),

  dateRange: z.object({
    startDate: z.string().datetime('Invalid start date'),
    endDate: z.string().datetime('Invalid end date'),
  }).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'End date must be after start date',
    path: ['endDate'],
  }),

  // ID parameter schema
  uuidParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),
};

// React hook for client-side validation
export const useValidation = () => {
  const validate = <T>(schema: ZodSchema<T>, data: unknown): ValidationResult => {
    return InputValidator.validate(schema, data, { sanitize: true });
  };

  const validateField = <T>(schema: ZodSchema<T>, data: unknown, field: string): string | null => {
    try {
      schema.parse(data);
      return null;
    } catch (error) {
      if (error instanceof ZodError) {
        const fieldError = error.errors.find(err => err.path[0] === field);
        return fieldError?.message || 'Invalid value';
      }
      return 'Validation failed';
    }
  };

  return { validate, validateField };
};
