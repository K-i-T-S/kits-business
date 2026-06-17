import { Zap, Sparkles, Calendar, Bell, FileText } from 'lucide-react';
import React from 'react';

import Layout from '../Layout';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PLANNED_WORKFLOWS = [
  {
    icon: Bell,
    title: 'Low Stock Alerts',
    description: 'Automatically notify the team when a product falls below its reorder threshold.',
    category: 'Inventory',
  },
  {
    icon: FileText,
    title: 'Daily Sales Report',
    description: 'Generate and deliver a daily sales summary at a scheduled time each evening.',
    category: 'Reports',
  },
  {
    icon: Zap,
    title: 'Customer Welcome',
    description: 'Send a welcome message when a new customer is added to the system.',
    category: 'CRM',
  },
  {
    icon: Calendar,
    title: 'Scheduled Reminders',
    description: 'Set recurring reminders for inventory counts, supplier orders, or bill payments.',
    category: 'Operations',
  },
];

export default function WorkflowAutomation() {
  return (
    <Layout>
      <div className="space-y-10 pb-20 lg:pb-0">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">Automation Hub</p>
            <h1 className="mt-3 text-3xl font-semibold">Workflow Automation</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Create automated workflows to streamline your operations — coming in a future update.
            </p>
          </div>
        </section>

        <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-6 text-center">
          <Zap className="mx-auto h-10 w-10 text-indigo-400 mb-3" />
          <h2 className="text-lg font-semibold text-white">Workflow Engine — Coming Soon</h2>
          <p className="mt-2 text-sm text-white/70 max-w-lg mx-auto">
            The workflow automation engine is under development. Below are the workflows planned for launch.
            Contact your KiTS representative to request early access.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {PLANNED_WORKFLOWS.map((wf) => (
            <Card key={wf.title} className="glass-panel border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white text-base">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                    <wf.icon className="h-4 w-4 text-white/80" />
                  </div>
                  <div>
                    <div>{wf.title}</div>
                    <div className="text-xs font-normal text-white/40 mt-0.5">{wf.category}</div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/60">{wf.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
