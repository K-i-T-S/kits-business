interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    lastAccess: number;
  };
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: any) => string;
  onLimitReached?: (request: any, response: any) => void;
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };

    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private getKey(request: any): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Default key generation based on IP and user agent
    const ip = request.headers?.['x-forwarded-for'] ||
               request.headers?.['x-real-ip'] ||
               request.connection?.remoteAddress ||
               'unknown';

    const userAgent = request.headers?.['user-agent'] || 'unknown';

    return `${ip}:${userAgent}`;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      const entry = this.store[key];
      if (entry && entry.resetTime <= now) {
        delete this.store[key];
      }
    });
  }

  public middleware = (request: any, response: any, next?: Function) => {
    const key = this.getKey(request);
    const now = Date.now();

    // Initialize or reset if window expired
    if (!this.store[key] || this.store[key].resetTime <= now) {
      this.store[key] = {
        count: 0,
        resetTime: now + this.config.windowMs,
        lastAccess: now,
      };
    }

    // Update last access time
    this.store[key].lastAccess = now;

    // Check if limit exceeded
    if (this.store[key].count >= this.config.maxRequests) {
      const resetIn = Math.ceil((this.store[key].resetTime - now) / 1000);

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      response.setHeader('X-RateLimit-Remaining', 0);
      response.setHeader('X-RateLimit-Reset', this.store[key].resetTime);
      response.setHeader('Retry-After', resetIn);

      if (this.config.onLimitReached) {
        this.config.onLimitReached(request, response);
      }

      const error = new Error('Rate limit exceeded');
      (error as any).statusCode = 429;
      (error as any).rateLimit = {
        limit: this.config.maxRequests,
        current: this.store[key].count,
        resetTime: this.store[key].resetTime,
        resetIn,
      };

      if (next) {
        return next(error);
      }
      return false;
    }

    // Increment counter
    this.store[key].count++;

    // Set rate limit headers
    response.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    response.setHeader('X-RateLimit-Remaining', this.config.maxRequests - this.store[key].count);
    response.setHeader('X-RateLimit-Reset', this.store[key].resetTime);

    if (next) {
      next();
    }
    return true;
  };

  public getStatus(key: string): any {
    const entry = this.store[key];
    if (!entry) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
        resetIn: Math.ceil(this.config.windowMs / 1000),
      };
    }

    const now = Date.now();
    if (entry.resetTime <= now) {
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        resetIn: Math.ceil(this.config.windowMs / 1000),
      };
    }

    return {
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
      resetIn: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  public reset(key?: string): void {
    if (key) {
      delete this.store[key];
    } else {
      this.store = {};
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store = {};
  }
}

// Predefined rate limiters for common use cases
export const createApiRateLimiter = () => new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyGenerator: (request: any) => {
    const userId = request.user?.id;
    const ip = request.headers?.['x-forwarded-for'] || request.connection?.remoteAddress;
    return userId ? `user:${userId}` : `ip:${ip}`;
  },
});

export const createAuthRateLimiter = () => new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts
  keyGenerator: (request: any) => {
    const ip = request.headers?.['x-forwarded-for'] || request.connection?.remoteAddress;
    const email = request.body?.email || 'unknown';
    return `auth:${ip}:${email}`;
  },
  onLimitReached: (request: any, _response: any) => {
    console.warn(`Rate limit exceeded for auth attempt from IP: ${request.headers?.['x-forwarded-for']}`);
  },
});

export const createUploadRateLimiter = () => new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 uploads per hour
  keyGenerator: (request: any) => {
    const userId = request.user?.id;
    return userId ? `upload:user:${userId}` : `upload:ip:${request.connection?.remoteAddress}`;
  },
});
