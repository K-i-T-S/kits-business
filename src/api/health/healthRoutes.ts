import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { supabase } from '../../utils/supabaseClient';

const app = new Hono();

app.use('*', cors());

// General health check
app.get('/', async (c) => {
  const start = Date.now();
  
  try {
    // Basic health checks
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    const responseTime = Date.now() - start;
    
    return c.json({
      ...checks,
      responseTime
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      responseTime: Date.now() - start
    }, 500);
  }
});

// Database health check
app.get('/database', async (c) => {
  const start = Date.now();
  
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - start;
    
    if (error) {
      throw error;
    }

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      responseTime,
      testQuery: 'successful'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: (error as Error).message,
      responseTime: Date.now() - start
    }, 503);
  }
});

// Auth service health check
app.get('/auth', async (c) => {
  const start = Date.now();
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    const responseTime = Date.now() - start;
    
    if (error) {
      throw error;
    }

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      auth: 'operational',
      responseTime
    });
  } catch (error) {
    return c.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      auth: 'error',
      error: (error as Error).message,
      responseTime: Date.now() - start
    }, 503);
  }
});

// Storage health check
app.get('/storage', async (c) => {
  const start = Date.now();
  
  try {
    // Test storage by attempting to list a small bucket
    const { data, error } = await supabase.storage.listBuckets();
    
    const responseTime = Date.now() - start;
    
    if (error) {
      throw error;
    }

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      storage: 'operational',
      bucketCount: data?.length || 0,
      responseTime
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      storage: 'error',
      error: (error as Error).message,
      responseTime: Date.now() - start
    }, 503);
  }
});

export default app;
