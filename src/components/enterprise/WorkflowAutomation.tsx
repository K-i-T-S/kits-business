import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  FileText,
  Sparkles,
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

interface WorkflowAction {
  type: string;
  config: Record<string, any>;
}

interface WorkflowTrigger {
  type: string;
  config: Record<string, any>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  trigger_config: WorkflowTrigger;
  actions: WorkflowAction[];
  is_active: boolean;
  created_at: string;
  last_run?: string;
  next_run?: string;
}

interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error?: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  trigger_type: string;
  actions: WorkflowAction[];
}

export default function WorkflowAutomation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateWorkflowOpen, setIsCreateWorkflowOpen] = useState(false);

  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger_type: 'event',
    trigger_config: { type: 'event', config: {} } as WorkflowTrigger,
    actions: [] as WorkflowAction[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Mock data for demonstration
      const mockTemplates: WorkflowTemplate[] = [
        {
          id: '1',
          name: 'Low Stock Alert',
          description: 'Send notification when product stock is low',
          category: 'Inventory',
          trigger_type: 'event',
          actions: [
            { type: 'send_notification', config: { message: 'Product is low on stock' } },
            { type: 'create_task', config: { task: 'Reorder product' } },
          ],
        },
        {
          id: '2',
          name: 'Daily Sales Report',
          description: 'Generate and email daily sales report',
          category: 'Reports',
          trigger_type: 'schedule',
          actions: [
            { type: 'generate_report', config: { type: 'sales', period: 'daily' } },
            { type: 'send_email', config: { recipients: ['manager@example.com'] } },
          ],
        },
        {
          id: '3',
          name: 'Customer Welcome',
          description: 'Send welcome email to new customers',
          category: 'Customer',
          trigger_type: 'event',
          actions: [
            { type: 'send_email', config: { template: 'welcome' } },
            { type: 'add_to_list', config: { list: 'new_customers' } },
          ],
        },
      ];

      const mockWorkflows: Workflow[] = [
        {
          id: '1',
          name: 'Low Stock Notification',
          description: 'Alert when inventory is below threshold',
          trigger_type: 'event',
          trigger_config: { type: 'event', config: { event: 'stock_low' } },
          actions: [
            { type: 'send_notification', config: { message: 'Stock is low' } },
          ],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          last_run: '2024-01-15T10:30:00Z',
        },
        {
          id: '2',
          name: 'Daily Sales Summary',
          description: 'Generate daily sales report',
          trigger_type: 'schedule',
          trigger_config: { type: 'schedule', config: { cron: '0 18 * * *' } },
          actions: [
            { type: 'generate_report', config: { type: 'sales' } },
          ],
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          last_run: '2024-01-15T18:00:00Z',
          next_run: '2024-01-16T18:00:00Z',
        },
        {
          id: '3',
          name: 'Customer Onboarding',
          description: 'Welcome new customers',
          trigger_type: 'event',
          trigger_config: { type: 'event', config: { event: 'customer_created' } },
          actions: [
            { type: 'send_email', config: { template: 'welcome' } },
          ],
          is_active: false,
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockExecutions: WorkflowExecution[] = [
        {
          id: '1',
          workflow_id: '1',
          status: 'completed',
          started_at: '2024-01-15T10:30:00Z',
          completed_at: '2024-01-15T10:30:15Z',
        },
        {
          id: '2',
          workflow_id: '2',
          status: 'completed',
          started_at: '2024-01-15T18:00:00Z',
          completed_at: '2024-01-15T18:02:30Z',
        },
        {
          id: '3',
          workflow_id: '1',
          status: 'failed',
          started_at: '2024-01-15T09:15:00Z',
          error: 'Failed to send notification',
        },
      ];

      setTemplates(mockTemplates);
      setWorkflows(mockWorkflows);
      setExecutions(mockExecutions);
    } catch (error) {
      toast.error('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name || newWorkflow.actions.length === 0) {
      toast.error('Please provide workflow name and at least one action');
      return;
    }

    try {
      const createdWorkflow: Workflow = {
        id: Date.now().toString(),
        ...newWorkflow,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      setWorkflows([...workflows, createdWorkflow]);
      setNewWorkflow({
        name: '',
        description: '',
        trigger_type: 'event',
        trigger_config: { type: 'event', config: {} },
        actions: [],
      });
      setIsCreateWorkflowOpen(false);
      toast.success('Workflow created successfully');
    } catch (error) {
      toast.error('Failed to create workflow');
    }
  };

  const handleToggleWorkflow = async (workflowId: string) => {
    try {
      setWorkflows(workflows.map(workflow =>
        workflow.id === workflowId ? { ...workflow, is_active: !workflow.is_active } : workflow,
      ));
      toast.success('Workflow status updated');
    } catch (error) {
      toast.error('Failed to update workflow');
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      const execution: WorkflowExecution = {
        id: Date.now().toString(),
        workflow_id: workflowId,
        status: 'running',
        started_at: new Date().toISOString(),
      };

      setExecutions([execution, ...executions]);
      toast.success('Workflow execution started');

      // Simulate completion
      setTimeout(() => {
        setExecutions(prev => prev.map(e =>
          e.id === execution.id
            ? { ...e, status: 'completed', completed_at: new Date().toISOString() }
            : e,
        ));
      }, 3000);
    } catch (error) {
      toast.error('Failed to execute workflow');
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      setWorkflows(workflows.filter(workflow => workflow.id !== workflowId));
      toast.success('Workflow deleted successfully');
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'schedule':
        return <Calendar className="h-4 w-4" />;
      case 'event':
        return <Zap className="h-4 w-4" />;
      case 'manual':
        return <Settings className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
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
              <p className="stat-chip bg-white/10 text-white/80">Automation Hub</p>
              <h1 className="mt-3 text-3xl font-semibold">
                Workflow Automation
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/80">
                Create and manage automated workflows to streamline your business processes. Set up triggers, actions, and schedules.
              </p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCreateWorkflowOpen} onOpenChange={setIsCreateWorkflowOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-slate-900 hover:bg-white/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Workflow</DialogTitle>
                    <DialogDescription>
                      Create a new automated workflow with triggers and actions
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="workflowName">Workflow Name</Label>
                      <Input
                        id="workflowName"
                        value={newWorkflow.name}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                        placeholder="Enter workflow name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="workflowDescription">Description</Label>
                      <Textarea
                        id="workflowDescription"
                        value={newWorkflow.description}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                        placeholder="Describe the workflow's purpose"
                      />
                    </div>
                    <div>
                      <Label htmlFor="triggerType">Trigger Type</Label>
                      <Select value={newWorkflow.trigger_type} onValueChange={(value) =>
                        setNewWorkflow({ ...newWorkflow, trigger_type: value })
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="Select trigger type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="schedule">Schedule</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateWorkflowOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateWorkflow}>Create Workflow</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>

        <Tabs defaultValue="workflows" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="executions">Executions</TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="space-y-4">
            <div className="grid gap-4">
              {workflows.map((workflow) => (
                <Card key={workflow.id} className="glass-panel">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTriggerIcon(workflow.trigger_type)}
                        <CardTitle>{workflow.name}</CardTitle>
                        <Badge variant={workflow.is_active ? 'default' : 'secondary'}>
                          {workflow.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={workflow.is_active}
                          onCheckedChange={() => handleToggleWorkflow(workflow.id)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExecuteWorkflow(workflow.id)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWorkflow(workflow.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{workflow.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last run:</span>
                        <span>{workflow.last_run ? new Date(workflow.last_run).toLocaleString() : 'Never'}</span>
                      </div>
                      {workflow.next_run && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Next run:</span>
                          <span>{new Date(workflow.next_run).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {workflow.actions.length} actions configured
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <Card key={template.id} className="glass-panel cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                    <Badge variant="outline">{template.category}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        {getTriggerIcon(template.trigger_type)}
                        <span>Trigger: {template.trigger_type}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {template.actions.length} actions
                      </div>
                      <Button className="w-full mt-2" variant="outline">
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="executions" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.map((execution) => {
                  const workflow = workflows.find(w => w.id === execution.workflow_id);
                  const duration = execution.completed_at
                    ? new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()
                    : null;

                  return (
                    <TableRow key={execution.id}>
                      <TableCell className="font-medium">
                        {workflow?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(execution.status)}
                          <span className="capitalize">{execution.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(execution.started_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {duration ? `${(duration / 1000).toFixed(2)}s` : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <FileText className="h-4 w-4" />
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
