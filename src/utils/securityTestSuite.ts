import { enhancedSecurityMiddleware } from './enhancedSecurityMiddleware';
import { apiSecurityWrapper } from './apiSecurityWrapper';
import { logSecurityEvent } from './auditLogger';

// Security Test Suite for validating all security enhancements
export class SecurityTestSuite {
  static async runAllTests(): Promise<{
    passed: number;
    failed: number;
    results: Array<{ test: string; status: string; error?: string }>;
  }> {
    const results: Array<{ test: string; status: string; error?: string }> = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Rate Limiting
    try {
      await this.testRateLimiting();
      results.push({ test: 'Rate Limiting', status: 'PASSED' });
      passed++;
    } catch (error) {
      results.push({ test: 'Rate Limiting', status: 'FAILED', error: String(error) });
      failed++;
    }

    // Test 2: Input Validation
    try {
      await this.testInputValidation();
      results.push({ test: 'Input Validation', status: 'PASSED' });
      passed++;
    } catch (error) {
      results.push({ test: 'Input Validation', status: 'FAILED', error: String(error) });
      failed++;
    }

    // Test 3: Role-Based Access Control
    try {
      await this.testRoleBasedAccess();
      results.push({ test: 'Role-Based Access Control', status: 'PASSED' });
      passed++;
    } catch (error) {
      results.push({ test: 'Role-Based Access Control', status: 'FAILED', error: String(error) });
      failed++;
    }

    // Test 4: Session Management
    try {
      await this.testSessionManagement();
      results.push({ test: 'Session Management', status: 'PASSED' });
      passed++;
    } catch (error) {
      results.push({ test: 'Session Management', status: 'FAILED', error: String(error) });
      failed++;
    }

    // Test 5: Audit Logging
    try {
      await this.testAuditLogging();
      results.push({ test: 'Audit Logging', status: 'PASSED' });
      passed++;
    } catch (error) {
      results.push({ test: 'Audit Logging', status: 'FAILED', error: String(error) });
      failed++;
    }

    return { passed, failed, results };
  }

  private static async testRateLimiting(): Promise<void> {
    const context = {
      userId: 'test-user',
      tenantId: 'test-tenant',
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent'
    };

    // Test normal rate limiting
    const result1 = await enhancedSecurityMiddleware.checkRateLimit('api', context);
    if (!result1.allowed) {
      throw new Error('Initial rate limit check failed');
    }

    // Test rate limit enforcement (simulate multiple requests)
    let blocked = false;
    for (let i = 0; i < 1005; i++) {
      const result = await enhancedSecurityMiddleware.checkRateLimit('api', context);
      if (!result.allowed) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      throw new Error('Rate limit was not enforced after exceeding threshold');
    }
  }

  private static async testInputValidation(): Promise<void> {
    // Test email validation
    const emailResult = enhancedSecurityMiddleware.validateInput('test@example.com', 'email');
    if (!emailResult.isValid || emailResult.sanitized !== 'test@example.com') {
      throw new Error('Email validation failed');
    }

    // Test invalid email
    const invalidEmailResult = enhancedSecurityMiddleware.validateInput('invalid-email', 'email');
    if (invalidEmailResult.isValid) {
      throw new Error('Invalid email was accepted');
    }

    // Test XSS prevention
    const xssResult = enhancedSecurityMiddleware.validateInput('<script>alert("xss")</script>', 'text');
    if (xssResult.isValid || xssResult.sanitized?.includes('<script>')) {
      throw new Error('XSS prevention failed');
    }

    // Test SQL injection prevention
    const sqlResult = enhancedSecurityMiddleware.validateInput("'; DROP TABLE users; --", 'text');
    if (sqlResult.isValid || sqlResult.sanitized?.includes("DROP TABLE")) {
      throw new Error('SQL injection prevention failed');
    }

    // Test number validation
    const numResult = enhancedSecurityMiddleware.validateInput('123.45', 'number');
    if (!numResult.isValid || numResult.sanitized !== 123.45) {
      throw new Error('Number validation failed');
    }
  }

  private static async testRoleBasedAccess(): Promise<void> {
    const context = {
      userId: 'test-user',
      tenantId: 'test-tenant',
      userRole: 'viewer',
      ipAddress: '127.0.0.1'
    };

    // Test role validation through security check
    const ownerResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'api',
      context,
      [],
      'owner'
    );

    if (ownerResult.authorized) {
      throw new Error('Viewer role should not have owner permissions');
    }

    const viewerResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'api',
      context,
      [],
      'viewer'
    );

    if (!viewerResult.authorized) {
      throw new Error('Viewer role should have viewer permissions');
    }

    // Test comprehensive security check
    const securityResult = await enhancedSecurityMiddleware.executeSecurityCheck(
      'api',
      context,
      [{ value: 'test@example.com', type: 'email' }],
      'viewer'
    );

    if (!securityResult.authorized) {
      throw new Error('Security check failed for valid role');
    }
  }

  private static async testSessionManagement(): Promise<void> {
    const context = {
      userId: 'test-user',
      sessionId: 'test-session-123',
      tenantId: 'test-tenant',
      ipAddress: '127.0.0.1'
    };

    // Test session validation
    const sessionResult = await enhancedSecurityMiddleware.validateSession(context);
    if (!sessionResult.valid) {
      throw new Error('Valid session was rejected');
    }

    // Test invalid session
    const invalidSessionResult = await enhancedSecurityMiddleware.validateSession({
      userId: 'test-user',
      sessionId: '',
      tenantId: 'test-tenant'
    });

    if (invalidSessionResult.valid) {
      throw new Error('Invalid session was accepted');
    }
  }

  private static async testAuditLogging(): Promise<void> {
    // Test security event logging
    try {
      await logSecurityEvent(
        'test_event',
        'Test security event',
        'low',
        { test: true }
      );
    } catch (error) {
      throw new Error(`Audit logging failed: ${error}`);
    }

    // Note: In a real test environment, you would verify the log was actually stored
    // For now, we just ensure the function doesn't throw an error
  }

  // Performance test for rate limiting
  static async performanceTest(): Promise<{
    rateLimitingTime: number;
    validationTime: number;
    securityCheckTime: number;
  }> {
    const context = {
      userId: 'perf-test-user',
      tenantId: 'perf-test-tenant',
      ipAddress: '127.0.0.1'
    };

    // Test rate limiting performance
    const rateLimitStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await enhancedSecurityMiddleware.checkRateLimit('api', context);
    }
    const rateLimitingTime = performance.now() - rateLimitStart;

    // Test validation performance
    const validationStart = performance.now();
    for (let i = 0; i < 100; i++) {
      enhancedSecurityMiddleware.validateInput('test@example.com', 'email');
      enhancedSecurityMiddleware.validateInput('test text', 'text');
      enhancedSecurityMiddleware.validateInput('123', 'number');
    }
    const validationTime = performance.now() - validationStart;

    // Test security check performance
    const securityCheckStart = performance.now();
    for (let i = 0; i < 50; i++) {
      await enhancedSecurityMiddleware.executeSecurityCheck(
        'api',
        context,
        [{ value: 'test@example.com', type: 'email' }],
        'viewer'
      );
    }
    const securityCheckTime = performance.now() - securityCheckStart;

    return {
      rateLimitingTime,
      validationTime,
      securityCheckTime
    };
  }

  // Security vulnerability scan
  static async vulnerabilityScan(): Promise<Array<{
    vulnerability: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>> {
    const vulnerabilities: Array<{
      vulnerability: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
    }> = [];

    // Test for common vulnerabilities
    const testCases = [
      {
        input: '<script>alert("xss")</script>',
        type: 'text',
        vulnerability: 'XSS',
        severity: 'high' as const,
        description: 'Cross-site scripting vulnerability'
      },
      {
        input: "'; DROP TABLE users; --",
        type: 'text',
        vulnerability: 'SQL Injection',
        severity: 'high' as const,
        description: 'SQL injection vulnerability'
      },
      {
        input: '../../../etc/passwd',
        type: 'text',
        vulnerability: 'Path Traversal',
        severity: 'medium' as const,
        description: 'Path traversal vulnerability'
      },
      {
        input: '{{7*7}}',
        type: 'text',
        vulnerability: 'Template Injection',
        severity: 'medium' as const,
        description: 'Template injection vulnerability'
      }
    ];

    for (const testCase of testCases) {
      const result = enhancedSecurityMiddleware.validateInput(testCase.input, testCase.type as any);
      
      if (result.isValid || (result.sanitized && result.sanitized === testCase.input)) {
        vulnerabilities.push(testCase);
      }
    }

    return vulnerabilities;
  }
}

// Export for use in tests
export const securityTestSuite = SecurityTestSuite;
