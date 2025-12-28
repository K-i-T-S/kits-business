import {
  Key,
  Plus,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  Globe,
  Shield,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Settings,
  Sparkles,
  Eye,
  EyeOff,
  BarChart3,
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import Layout from '../Layout';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  rate_limit: number;
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  retry_count: number;
  created_at: string;
  last_triggered_at?: string;
}

interface ApiLog {
  id: string;
  api_key_id: string;
  method: string;
  endpoint: string;
  status_code: number;
  response_time: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  created_at: string;
  delivered_at?: string;
  error?: string;
}

export default function ApiAndWebhooks() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLog[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateApiKeyOpen, setIsCreateApiKeyOpen] = useState(false);
  const [isCreateWebhookOpen, setIsCreateWebhookOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const [newApiKey, setNewApiKey] = useState({
    name: '',
    permissions: [] as string[],
    rate_limit: 1000,
    expires_at: '',
  });

  const [newWebhookForm, setNewWebhookForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockApiKeys: ApiKey[] = [
        {
          id: '1',
          name: 'Production API Key',
          key_prefix: 'pk_live_',
          permissions: ['read', 'write', 'delete'],
          rate_limit: 1000,
          is_active: true,
          expires_at: '2024-12-31T23:59:59Z',
          last_used_at: '2024-01-15T10:30:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          name: 'Development API Key',
          key_prefix: 'pk_dev_',
          permissions: ['read', 'write'],
          rate_limit: 500,
          is_active: true,
          last_used_at: '2024-01-15T09:15:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: '3',
          name: 'Analytics API Key',
          key_prefix: 'pk_analytics_',
          permissions: ['read'],
          rate_limit: 2000,
          is_active: false,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockWebhooks: Webhook[] = [
        {
          id: '1',
          name: 'Order Created Webhook',
          url: 'https://api.example.com/webhooks/orders',
          events: ['order.created', 'order.updated'],
          secret: 'whsec_1234567890abcdef',
          is_active: true,
          retry_count: 3,
          created_at: '2024-01-01T00:00:00Z',
          last_triggered_at: '2024-01-15T11:45:00Z',
        },
        {
          id: '2',
          name: 'Customer Updates',
          url: 'https://crm.example.com/webhooks/customers',
          events: ['customer.created', 'customer.updated'],
          secret: 'whsec_fedcba0987654321',
          is_active: true,
          retry_count: 5,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockApiLogs: ApiLog[] = [
        {
          id: '1',
          api_key_id: '1',
          method: 'GET',
          endpoint: '/api/v1/products',
          status_code: 200,
          response_time: 145,
          ip_address: '192.168.1.100',
          user_agent: 'MyApp/1.0',
          created_at: '2024-01-15T10:30:00Z',
        },
        {
          id: '2',
          api_key_id: '1',
          method: 'POST',
          endpoint: '/api/v1/orders',
          status_code: 201,
          response_time: 234,
          ip_address: '192.168.1.100',
          user_agent: 'MyApp/1.0',
          created_at: '2024-01-15T10:25:00Z',
        },
        {
          id: '3',
          api_key_id: '2',
          method: 'GET',
          endpoint: '/api/v1/customers',
          status_code: 401,
          response_time: 89,
          ip_address: '192.168.1.101',
          user_agent: 'DevApp/0.1',
          created_at: '2024-01-15T09:15:00Z',
        },
      ];

      const mockWebhookDeliveries: WebhookDelivery[] = [
        {
          id: '1',
          webhook_id: '1',
          event_type: 'order.created',
          payload: { order_id: '12345', total: 99.99 },
          status: 'delivered',
          attempts: 1,
          created_at: '2024-01-15T11:45:00Z',
          delivered_at: '2024-01-15T11:45:02Z',
        },
        {
          id: '2',
          webhook_id: '2',
          event_type: 'customer.created',
          payload: { customer_id: '67890', name: 'John Doe' },
          status: 'failed',
          attempts: 3,
          created_at: '2024-01-15T10:00:00Z',
          error: 'Connection timeout',
        },
      ];

      setApiKeys(mockApiKeys);
      setWebhooks(mockWebhooks);
      setApiLogs(mockApiLogs);
      setWebhookDeliveries(mockWebhookDeliveries);
    } catch (error) {
      toast.error('Failed to load API data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newApiKey.name || newApiKey.permissions.length === 0) {
      toast.error('Please provide API key name and select permissions');
      return;
    }

    try {
      const createdApiKey: ApiKey = {
        id: Date.now().toString(),
        ...newApiKey,
        key_prefix: 'pk_',
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setApiKeys([...apiKeys, createdApiKey]);
      setNewApiKey({
        name: '',
        permissions: [],
        rate_limit: 1000,
        expires_at: '',
      });
      setIsCreateApiKeyOpen(false);
      toast.success('API key created successfully');
    } catch (error) {
      toast.error('Failed to create API key');
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookForm.name || !newWebhookForm.url || newWebhookForm.events.length === 0) {
      toast.error('Please provide webhook name, URL, and select events');
      return;
    }

    try {
      const createdWebhook: Webhook = {
        id: Date.now().toString(),
        ...newWebhookForm,
        is_active: true,
        retry_count: 3,
        created_at: new Date().toISOString(),
      };

      setWebhooks([...webhooks, createdWebhook]);
      setNewWebhookForm({
        name: '',
        url: '',
        events: [],
        secret: '',
      });
      setIsCreateWebhookOpen(false);
      toast.success('Webhook created successfully');
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  };

  const handleToggleApiKey = async (apiKeyId: string) => {
    try {
      setApiKeys(apiKeys.map(key =>
        key.id === apiKeyId ? { ...key, is_active: !key.is_active } : key,
      ));
      toast.success('API key status updated');
    } catch (error) {
      toast.error('Failed to update API key');
    }
  };

  const handleToggleWebhook = async (webhookId: string) => {
    try {
      setWebhooks(webhooks.map(webhook =>
        webhook.id === webhookId ? { ...webhook, is_active: !webhook.is_active } : webhook,
      ));
      toast.success('Webhook status updated');
    } catch (error) {
      toast.error('Failed to update webhook');
    }
  };

  const handleDeleteApiKey = async (apiKeyId: string) => {
    try {
      setApiKeys(apiKeys.filter(key => key.id !== apiKeyId));
      toast.success('API key deleted successfully');
    } catch (error) {
      toast.error('Failed to delete API key');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      setWebhooks(webhooks.filter(webhook => webhook.id !== webhookId));
      toast.success('Webhook deleted successfully');
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  };

  const handleRegenerateWebhookSecret = async (webhookId: string) => {
    try {
      const newSecret = 'whsec_' + Math.random().toString(36).substring(2, 15);
      setWebhooks(webhooks.map(webhook =>
        webhook.id === webhookId ? { ...webhook, secret: newSecret } : webhook,
      ));
      toast.success('Webhook secret regenerated');
    } catch (error) {
      toast.error('Failed to regenerate webhook secret');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getHttpMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'text-green-600';
      case 'POST':
        return 'text-blue-600';
      case 'PUT':
        return 'text-yellow-600';
      case 'DELETE':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-10">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="stat-chip bg-white/10 text-white/80">API & Integration Hub</p>
              <h1 className="mt-3 text-3xl font-semibold">
                API & Webhooks
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Manage API keys, configure webhooks, and monitor integration activity. Connect your business systems with external services.
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCreateWebhookOpen} onOpenChange={setIsCreateWebhookOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                    <Zap className="h-4 w-4 mr-2" />
                    Create Webhook
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Webhook</DialogTitle>
                    <DialogDescription>
                      Create a new webhook endpoint for real-time event notifications
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="webhookName">Webhook Name</Label>
                      <Input
                        id="webhookName"
                        value={newWebhookForm.name}
                        onChange={(e) => setNewWebhookForm({ ...newWebhookForm, name: e.target.value })}
                        placeholder="Enter webhook name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="webhookUrl">Endpoint URL</Label>
                      <Input
                        id="webhookUrl"
                        value={newWebhookForm.url}
                        onChange={(e) => setNewWebhookForm({ ...newWebhookForm, url: e.target.value })}
                        placeholder="https://api.example.com/webhook"
                      />
                    </div>
                    <div>
                      <Label htmlFor="webhookSecret">Secret (Optional)</Label>
                      <Input
                        id="webhookSecret"
                        value={newWebhookForm.secret}
                        onChange={(e) => setNewWebhookForm({ ...newWebhookForm, secret: e.target.value })}
                        placeholder="Enter webhook secret"
                      />
                    </div>
                    <div>
                      <Label>Events</Label>
                      <div className="space-y-2">
                        {['order.created', 'order.updated', 'customer.created', 'customer.updated', 'product.created', 'inventory.updated'].map((event) => (
                          <div key={event} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={event}
                              checked={newWebhookForm.events.includes(event)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewWebhookForm({
                                    ...newWebhookForm,
                                    events: [...newWebhookForm.events, event],
                                  });
                                } else {
                                  setNewWebhookForm({
                                    ...newWebhookForm,
                                    events: newWebhookForm.events.filter(e => e !== event),
                                  });
                                }
                              }}
                            />
                            <Label htmlFor={event} className="text-sm">{event}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateWebhookOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateWebhook}>Create Webhook</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isCreateApiKeyOpen} onOpenChange={setIsCreateApiKeyOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-slate-900 hover:bg-white/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create API Key
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New API Key</DialogTitle>
                    <DialogDescription>
                      Create a new API key for programmatic access
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="apiKeyName">API Key Name</Label>
                      <Input
                        id="apiKeyName"
                        value={newApiKey.name}
                        onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                        placeholder="Enter API key name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rateLimit">Rate Limit (requests per hour)</Label>
                      <Input
                        id="rateLimit"
                        type="number"
                        min="1"
                        value={newApiKey.rate_limit}
                        onChange={(e) => setNewApiKey({ ...newApiKey, rate_limit: parseInt(e.target.value) || 1000 })}
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                      <Input
                        id="expiresAt"
                        type="date"
                        value={newApiKey.expires_at}
                        onChange={(e) => setNewApiKey({ ...newApiKey, expires_at: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Permissions</Label>
                      <div className="space-y-2">
                        {['read', 'write', 'delete', 'admin'].map((permission) => (
                          <div key={permission} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={permission}
                              checked={newApiKey.permissions.includes(permission)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewApiKey({
                                    ...newApiKey,
                                    permissions: [...newApiKey.permissions, permission],
                                  });
                                } else {
                                  setNewApiKey({
                                    ...newApiKey,
                                    permissions: newApiKey.permissions.filter(p => p !== permission),
                                  });
                                }
                              }}
                            />
                            <Label htmlFor={permission} className="text-sm capitalize">{permission}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateApiKeyOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateApiKey}>Create API Key</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <Tabs defaultValue="api-keys" className="space-y-4">
          <TabsList>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="logs">API Logs</TabsTrigger>
            <TabsTrigger value="deliveries">Webhook Deliveries</TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="space-y-4">
            <div className="grid gap-4">
              {apiKeys.map((apiKey) => (
                <Card key={apiKey.id} className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Key className="h-5 w-5" />
                        <CardTitle>{apiKey.name}</CardTitle>
                        <Badge variant={apiKey.is_active ? 'default' : 'secondary'}>
                          {apiKey.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={apiKey.is_active}
                          onCheckedChange={() => handleToggleApiKey(apiKey.id)}
                        />
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                          {apiKey.key_prefix}••••••••••••
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(apiKey.key_prefix + 'demo_key')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>Rate Limit: {apiKey.rate_limit}/hour</span>
                        <span>Created: {new Date(apiKey.created_at).toLocaleDateString()}</span>
                      </div>
                      {apiKey.last_used_at && (
                        <div className="text-sm text-muted-foreground">
                          Last used: {new Date(apiKey.last_used_at).toLocaleString()}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {apiKey.permissions.map((permission) => (
                          <Badge key={permission} variant="outline" className="text-xs capitalize">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <div className="grid gap-4">
              {webhooks.map((webhook) => (
                <Card key={webhook.id} className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Zap className="h-5 w-5" />
                        <CardTitle>{webhook.name}</CardTitle>
                        <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                          {webhook.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={webhook.is_active}
                          onCheckedChange={() => handleToggleWebhook(webhook.id)}
                        />
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRegenerateWebhookSecret(webhook.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono bg-muted px-2 py-1 rounded truncate flex-1">
                          {webhook.url}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(webhook.url)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Secret:</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono">
                            {showSecrets[webhook.id] ? webhook.secret : '••••••••••••'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleSecretVisibility(webhook.id)}
                          >
                            {showSecrets[webhook.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>Retry: {webhook.retry_count}x</span>
                        <span>Created: {new Date(webhook.created_at).toLocaleDateString()}</span>
                      </div>
                      {webhook.last_triggered_at && (
                        <div className="text-sm text-muted-foreground">
                          Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response Time</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className={`font-mono ${getHttpMethodColor(log.method)}`}>
                        {log.method}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono">{log.endpoint}</TableCell>
                    <TableCell>
                      <Badge variant={log.status_code < 400 ? 'default' : 'destructive'}>
                        {log.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.response_time}ms</TableCell>
                    <TableCell>{log.ip_address}</TableCell>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="deliveries" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhookDeliveries.map((delivery) => {
                  const webhook = webhooks.find(w => w.id === delivery.webhook_id);

                  return (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">
                        {webhook?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>{delivery.event_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(delivery.status)}
                          <span className="capitalize">{delivery.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>{delivery.attempts}</TableCell>
                      <TableCell>
                        {new Date(delivery.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {delivery.delivered_at
                          ? new Date(delivery.delivered_at).toLocaleString()
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
