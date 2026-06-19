import {
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Settings,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { supabase } from '../../utils/supabaseClient';

// ── DB row type ───────────────────────────────────────────────────────────────

interface DbWorkflow {
  id: string;
  name: string;
  trigger_type: 'new_customer' | 'no_purchase_30d' | 'birthday' | 'low_stock';
  action_type: 'send_email' | 'whatsapp_alert';
  action_config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
}

// ── Default workflows to seed on first load ───────────────────────────────────

const DEFAULT_WORKFLOWS: Omit<DbWorkflow, 'id' | 'created_at'>[] = [
  {
    name: 'Welcome New Customer',
    trigger_type: 'new_customer',
    action_type: 'send_email',
    action_config: {
      subject: 'Welcome to our store!',
      body: 'Thank you for joining us. We are excited to have you as a customer.',
    },
    is_active: true,
    last_run_at: null,
    run_count: 0,
  },
  {
    name: 'Re-engagement: No Purchase (30d)',
    trigger_type: 'no_purchase_30d',
    action_type: 'send_email',
    action_config: {
      subject: 'We miss you!',
      body: "It's been a while since your last visit. Come back and check out what's new.",
    },
    is_active: false,
    last_run_at: null,
    run_count: 0,
  },
  {
    name: 'Birthday Offer',
    trigger_type: 'birthday',
    action_type: 'send_email',
    action_config: {
      subject: 'Happy Birthday! A gift from us',
      body: 'Wishing you a wonderful birthday. Enjoy a special discount on your next purchase.',
    },
    is_active: false,
    last_run_at: null,
    run_count: 0,
  },
  {
    name: 'Low Stock Alert',
    trigger_type: 'low_stock',
    action_type: 'whatsapp_alert',
    action_config: {
      message: 'Low stock alert: {product_name} has {stock_count} units remaining.',
    },
    is_active: true,
    last_run_at: null,
    run_count: 0,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTriggerLabel(type: DbWorkflow['trigger_type']): string {
  switch (type) {
    case 'new_customer': return 'New Customer Joins';
    case 'no_purchase_30d': return 'No Purchase in 30 Days';
    case 'birthday': return 'Customer Birthday';
    case 'low_stock': return 'Low Stock Detected';
    default: return type;
  }
}

function getTriggerIcon(type: DbWorkflow['trigger_type']): JSX.Element {
  switch (type) {
    case 'new_customer': return <Users className="h-4 w-4" />;
    case 'no_purchase_30d': return <TrendingUp className="h-4 w-4" />;
    case 'birthday': return <Calendar className="h-4 w-4" />;
    case 'low_stock': return <Target className="h-4 w-4" />;
    default: return <Zap className="h-4 w-4" />;
  }
}

function getActionLabel(type: DbWorkflow['action_type']): string {
  switch (type) {
    case 'send_email': return 'Send Email';
    case 'whatsapp_alert': return 'WhatsApp Alert';
    default: return type;
  }
}

function getActionIcon(type: DbWorkflow['action_type']): JSX.Element {
  switch (type) {
    case 'whatsapp_alert': return <MessageSquare className="h-4 w-4" />;
    default: return <Mail className="h-4 w-4" />;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AutomatedMarketing() {
  const [workflows, setWorkflows] = useState<DbWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  // ── Fetch / seed workflows ──────────────────────────────────────────────────

  async function fetchWorkflows() {
    try {
      const { data, error } = await supabase
        .from('automated_workflows')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as DbWorkflow[];

      if (rows.length === 0) {
        // Seed the 4 default workflows
        const { data: inserted, error: insertErr } = await supabase
          .from('automated_workflows')
          .insert(DEFAULT_WORKFLOWS)
          .select('*');

        if (insertErr) throw insertErr;
        setWorkflows((inserted ?? []) as DbWorkflow[]);
      } else {
        setWorkflows(rows);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workflows';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchWorkflows();
  }, []);

  // ── Toggle active / inactive ────────────────────────────────────────────────

  async function handleToggle(workflow: DbWorkflow) {
    const newActive = !workflow.is_active;

    // Optimistic update
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflow.id ? { ...w, is_active: newActive } : w)),
    );
    setToggling((prev) => new Set(prev).add(workflow.id));

    try {
      const { error } = await supabase
        .from('automated_workflows')
        .update({ is_active: newActive })
        .eq('id', workflow.id);

      if (error) throw error;

      toast.success(
        newActive
          ? `"${workflow.name}" activated`
          : `"${workflow.name}" paused`,
      );
    } catch (err) {
      // Revert on failure
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, is_active: workflow.is_active } : w)),
      );
      const message = err instanceof Error ? err.message : 'Failed to update workflow';
      toast.error(message);
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(workflow.id);
        return next;
      });
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  const activeCount = workflows.filter((w) => w.is_active).length;
  const totalRuns = workflows.reduce((sum, w) => sum + w.run_count, 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">Marketing</p>
          <h2 className="mt-1 text-xl font-bold text-white">Automated Marketing</h2>
          <p className="text-sm text-white/60">Enable or disable automated messaging rules</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50">{activeCount} active</span>
          <span className="inline-flex h-2 w-2 rounded-full bg-green-400" />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Total Rules', value: workflows.length, icon: Settings, accent: 'text-indigo-400' },
          { label: 'Active', value: activeCount, icon: Play, accent: 'text-green-400' },
          { label: 'Total Runs', value: totalRuns.toLocaleString(), icon: Zap, accent: 'text-purple-400' },
          { label: 'Paused', value: workflows.length - activeCount, icon: Pause, accent: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">{label}</p>
                <p className="text-lg font-bold text-white">{value}</p>
              </div>
              <Icon className={`h-6 w-6 ${accent}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Workflow list */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-12 text-center">
            <p className="text-sm text-white/50">Loading workflows…</p>
          </div>
        ) : (
          workflows.map((workflow) => {
            const isToggling = toggling.has(workflow.id);
            return (
              <div
                key={workflow.id}
                className={`rounded-2xl border bg-white/5 p-5 transition-colors ${
                  workflow.is_active ? 'border-white/15' : 'border-white/10 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Trigger icon */}
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      workflow.is_active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/10 text-white/40'
                    }`}>
                      {getTriggerIcon(workflow.trigger_type)}
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-medium text-white">{workflow.name}</h4>

                      {/* Trigger → Action */}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5">
                          <Zap className="h-3 w-3 text-yellow-400" />
                          {getTriggerLabel(workflow.trigger_type)}
                        </span>
                        <span className="text-white/30">→</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5">
                          {getActionIcon(workflow.action_type)}
                          {getActionLabel(workflow.action_type)}
                        </span>
                      </div>

                      {/* Stats row */}
                      <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {workflow.run_count} runs
                        </span>
                        {workflow.last_run_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last run: {formatDate(workflow.last_run_at)}
                          </span>
                        ) : (
                          <span className="text-white/30">Never run</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle button */}
                  <button
                    onClick={() => void handleToggle(workflow)}
                    disabled={isToggling}
                    className={`ml-3 shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      workflow.is_active
                        ? 'bg-yellow-600/80 text-white hover:bg-yellow-600'
                        : 'bg-green-600/80 text-white hover:bg-green-600'
                    }`}
                    title={workflow.is_active ? 'Pause workflow' : 'Activate workflow'}
                  >
                    {workflow.is_active ? (
                      <>
                        <Pause className="h-3 w-3" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3" />
                        Activate
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <div className="flex items-start gap-3">
          <Settings className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
          <div>
            <p className="text-sm font-medium text-white/80">How automation works</p>
            <p className="mt-1 text-xs text-white/50">
              Rules run automatically when the trigger condition is met. The
              <strong className="text-white/70"> Low Stock Alert</strong> fires when product stock
              drops below the threshold you set in Inventory.
              <strong className="text-white/70"> No Purchase 30d</strong> runs daily and targets
              customers who have not bought in 30 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
