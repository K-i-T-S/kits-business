import { Key, Zap, Sparkles, Globe, Shield } from 'lucide-react';
import React from 'react';

import Layout from '../Layout';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PLANNED_FEATURES = [
  {
    icon: Key,
    title: 'API Key Management',
    description:
      'Generate and revoke API keys to allow external systems to read or write data securely. Each key can be scoped to specific permissions.',
  },
  {
    icon: Zap,
    title: 'Webhook Events',
    description:
      'Subscribe to real-time events like sale created, product updated, or customer added — push notifications instantly to your external services.',
  },
  {
    icon: Globe,
    title: 'Third-Party Integrations',
    description:
      'Connect your account to accounting software, e-commerce platforms, or CRM tools via a standardized REST API.',
  },
  {
    icon: Shield,
    title: 'Rate Limiting & Security',
    description:
      'Each API key has configurable rate limits and expiry dates. All access is logged for audit purposes.',
  },
];

export default function ApiAndWebhooks() {
  return (
    <Layout>
      <div className="space-y-10 pb-20 lg:pb-0">
        <section className="hero-gradient glass-panel relative overflow-hidden p-6 sm:p-8 text-white">
          <Sparkles className="pointer-events-none absolute right-8 top-6 h-16 w-16 text-white/20" />
          <div className="relative">
            <p className="stat-chip bg-white/10 text-white/80">API & Integration Hub</p>
            <h1 className="mt-3 text-3xl font-semibold">API & Webhooks</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Connect your business systems with external services via a secure REST API and real-time webhooks.
            </p>
          </div>
        </section>

        <div className="rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-6 text-center">
          <Key className="mx-auto h-10 w-10 text-indigo-400 mb-3" />
          <h2 className="text-lg font-semibold text-white">API Integration — Coming Soon</h2>
          <p className="mt-2 text-sm text-white/70 max-w-lg mx-auto">
            The API management module is under development. The features below are planned for the next major release.
            Contact KiTS to request early access or discuss custom integration requirements.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {PLANNED_FEATURES.map((feature) => (
            <Card key={feature.title} className="glass-panel border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white text-base">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                    <feature.icon className="h-4 w-4 text-white/80" />
                  </div>
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/60">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}
