import {
  Zap,
  Sparkles,
  Calendar,
  Bell,
  FileText,
  Play,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

import { useApp } from '../../context/AppContext';
import { supabase } from '../../utils/supabaseClient';
import Layout from '../Layout';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AutomatedWorkflow {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
}

// ── Default workflow seeds ────────────────────────────────────────────────────

const DEFAULT_WORKFLOWS: Omit<AutomatedWorkflow, 'id' | 'tenant_id'>[] = [
  {
    name: 'Daily Sales Summary',
    trigger_type: 'daily_summary',
    action_type: 'whatsapp_message',
    action_config: { schedule: '20:00' },
    is_active: false,
    last_run_at: null,
    run_count: 0,
  },
  {
    name: 'Low Stock Alert',
    trigger_type: 'low_stock_alert',
    action_type: 'whatsapp_message',
    action_config: { check_interval: 'daily' },
    is_active: false,
    last_run_at: null,
    run_count: 0,
  },
  {
    name: 'Customer Welcome',
    trigger_type: 'customer_welcome',
    action_type: 'whatsapp_message',
    action_config: {},
    is_active: false,
    last_run_at: null,
    run_count: 0,
  },
  {
    name: 'Scheduled Reminder',
    trigger_type: 'scheduled_reminder',
    action_type: 'internal_notification',
    action_config: { frequency: 'weekly' },
    is_active: false,
    last_run_at: null,
    run_count: 0,
  },
];

// ── Category / icon mapping ───────────────────────────────────────────────────

const WORKFLOW_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; category: string; description: string }
> = {
  daily_summary: {
    icon: FileText,
    category: 'Reports',
    description:
      'Generate and deliver a daily sales summary via WhatsApp each evening.',
  },
  low_stock_alert: {
    icon: Bell,
    category: 'Inventory',
    description:
      'Automatically notify the owner when a product falls below its reorder threshold.',
  },
  customer_welcome: {
    icon: Zap,
    category: 'CRM',
    description:
      'Send a welcome message when a new customer is added to the system.',
  },
  scheduled_reminder: {
    icon: Calendar,
    category: 'Operations',
    description:
      'Set recurring reminders for inventory counts, supplier orders, or bill payments.',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Inventory: 'bg-amber-500/15 text-amber-300',
  CRM: 'bg-sky-500/15 text-sky-300',
  Reports: 'bg-indigo-500/15 text-indigo-300',
  Operations: 'bg-emerald-500/15 text-emerald-300',
};

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900',
        'disabled:opacity-40',
        checked ? 'bg-indigo-600' : 'bg-white/20',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}

// ── Workflow card ─────────────────────────────────────────────────────────────

interface WorkflowCardProps {
  workflow: AutomatedWorkflow;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
  onRunNow: (workflow: AutomatedWorkflow) => Promise<void>;
}

function WorkflowCard({ workflow, onToggle, onRunNow }: WorkflowCardProps) {
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  const meta = WORKFLOW_META[workflow.trigger_type] ?? {
    icon: Zap,
    category: 'General',
    description: workflow.name,
  };
  const Icon = meta.icon;
  const categoryClass =
    CATEGORY_COLORS[meta.category] ?? 'bg-white/10 text-white/60';
  const isRunnable =
    workflow.trigger_type === 'daily_summary' ||
    workflow.trigger_type === 'low_stock_alert';

  return (
    <Card className="glass-panel border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-start justify-between gap-3 text-white text-base">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Icon className="h-4 w-4 text-white/80" />
            </div>
            <div className="min-w-0">
              <div className="truncate">{workflow.name}</div>
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryClass}`}
              >
                {meta.category}
              </span>
            </div>
          </div>
          <ToggleSwitch
            checked={workflow.is_active}
            disabled={toggling}
            onChange={(val) => {
              setToggling(true);
              void onToggle(workflow.id, val).finally(() => setToggling(false));
            }}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/60">{meta.description}</p>

        <div className="flex items-center justify-between text-xs text-white/40">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            <span>Last run: {relativeTime(workflow.last_run_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            <span>{workflow.run_count} runs</span>
          </div>
        </div>

        {isRunnable && (
          <Button
            size="sm"
            disabled={running}
            onClick={() => {
              setRunning(true);
              void onRunNow(workflow).finally(() => setRunning(false));
            }}
            className="w-full bg-white/10 hover:bg-white/20 text-white border-0 rounded-xl text-xs"
          >
            {running ? (
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Play className="mr-1.5 h-3 w-3" />
            )}
            {running ? 'Running…' : 'Run Now'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkflowAutomation() {
  const { currentTenant } = useApp();
  const [workflows, setWorkflows] = useState<AutomatedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [initializing, setInitializing] = useState(false);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('automated_workflows')
        .select('*')
        .order('created_at', { ascending: true })
        .returns<AutomatedWorkflow[]>();

      if (error) {
        // Table may not exist yet — migration pending
        const msg = error.message.toLowerCase();
        if (
          error.code === '42P01' ||
          msg.includes('does not exist') ||
          msg.includes('relation') ||
          msg.includes('undefined')
        ) {
          setTableExists(false);
        } else {
          toast.error('Failed to load workflows');
        }
        setWorkflows([]);
      } else {
        setTableExists(true);
        setWorkflows(data ?? []);
      }
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  const handleToggle = useCallback(async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('automated_workflows')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update workflow');
      return;
    }

    setWorkflows((prev) =>
      prev.map((wf) => (wf.id === id ? { ...wf, is_active: isActive } : wf)),
    );
    toast.success(isActive ? 'Workflow enabled' : 'Workflow disabled');
  }, []);

  const handleRunNow = useCallback(
    async (workflow: AutomatedWorkflow) => {
      if (!currentTenant) {
        toast.error('No active tenant');
        return;
      }

      const invokeResult = await supabase.functions.invoke('trigger-workflows', {
        body: {
          trigger_type: workflow.trigger_type,
          tenant_id: currentTenant.id,
        },
      });

      if (invokeResult.error) {
        const errMsg =
          invokeResult.error instanceof Error
            ? invokeResult.error.message
            : String(invokeResult.error);
        toast.error(`Workflow failed: ${errMsg}`);
        return;
      }

      toast.success(`${workflow.name} completed`);
      void loadWorkflows();
    },
    [currentTenant, loadWorkflows],
  );

  const handleInitialize = useCallback(async () => {
    if (!currentTenant) {
      toast.error('No active tenant');
      return;
    }

    setInitializing(true);
    try {
      const rows = DEFAULT_WORKFLOWS.map((wf) => ({
        ...wf,
        tenant_id: currentTenant.id,
      }));

      const { error } = await supabase.from('automated_workflows').insert(rows);
      if (error) {
        toast.error(`Could not create default workflows: ${error.message}`);
        return;
      }

      toast.success('Default workflows created');
      await loadWorkflows();
    } finally {
      setInitializing(false);
    }
  }, [currentTenant, loadWorkflows]);

  return (
    <Layout>
      <div className="space-y-10 pb-20 lg:pb-0">
        {/* ── Hero ── */}
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">Automation Hub</p>
            <h1 className="mt-3 text-3xl font-semibold">Workflow Automation</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Automate daily operations — low-stock alerts, sales summaries, and
              more delivered straight to WhatsApp.
            </p>
          </div>
        </section>

        {/* ── Table missing banner ── */}
        {!tableExists && (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
            <Zap className="mx-auto h-10 w-10 text-amber-400 mb-3" />
            <h2 className="text-lg font-semibold text-white">
              Workflow table not yet provisioned
            </h2>
            <p className="mt-2 text-sm text-white/70 max-w-lg mx-auto">
              The{' '}
              <code className="font-mono text-amber-300">automated_workflows</code>{' '}
              migration has not been applied yet. Run migration{' '}
              <code className="font-mono text-amber-300">
                000027_campaigns.sql
              </code>{' '}
              in the Supabase Dashboard, then reload this page.
            </p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && tableExists && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="glass-panel border-white/10 animate-pulse">
                <CardHeader>
                  <div className="h-4 w-40 rounded bg-white/10" />
                </CardHeader>
                <CardContent>
                  <div className="h-3 w-full rounded bg-white/10 mb-2" />
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Empty state: table exists but no rows ── */}
        {!loading && tableExists && workflows.length === 0 && (
          <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-8 text-center">
            <Zap className="mx-auto h-10 w-10 text-indigo-400 mb-3" />
            <h2 className="text-lg font-semibold text-white">No workflows yet</h2>
            <p className="mt-2 text-sm text-white/70 max-w-lg mx-auto">
              No workflows are configured for this business. Click below to add
              the default set.
            </p>
            <Button
              className="mt-6 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl px-6"
              disabled={initializing}
              onClick={() => void handleInitialize()}
            >
              {initializing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Zap className="mr-2 h-4 w-4" />
              )}
              {initializing ? 'Creating workflows…' : 'Initialize Default Workflows'}
            </Button>
          </div>
        )}

        {/* ── Workflow grid ── */}
        {!loading && workflows.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onToggle={handleToggle}
                onRunNow={handleRunNow}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
