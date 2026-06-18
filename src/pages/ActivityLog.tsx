import {
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  User,
  Package,
  DollarSign,
  Settings,
  ChevronDown,
  RefreshCw,
  FileText,
  X,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../utils/supabaseClient';

// ── DB row shape ──────────────────────────────────────────────────────────────

interface DbActivityLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAction(action: string): string {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getCategoryFromAction(action: string): string {
  if (action.startsWith('product')) return 'inventory';
  if (action.startsWith('sale')) return 'sales';
  if (action.startsWith('customer')) return 'customer';
  if (action.startsWith('employee')) return 'employee';
  return 'system';
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'inventory': return <Package className="h-4 w-4" />;
    case 'sales': return <DollarSign className="h-4 w-4" />;
    case 'customer': return <User className="h-4 w-4" />;
    case 'employee': return <User className="h-4 w-4" />;
    case 'system': return <Settings className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActivityLog() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<DbActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DbActivityLog | null>(null);

  const categories = [
    { value: 'all', label: 'All Categories', icon: FileText },
    { value: 'sales', label: 'Sales', icon: DollarSign },
    { value: 'inventory', label: 'Inventory', icon: Package },
    { value: 'customer', label: 'Customer', icon: User },
    { value: 'employee', label: 'Employee', icon: User },
    { value: 'system', label: 'System', icon: Settings },
  ];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (fetchError) throw fetchError;
      setLogs((data ?? []) as DbActivityLog[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(entry => {
    const category = getCategoryFromAction(entry.action);
    const matchesSearch =
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.entity_type ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.entity_id ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(entry.metadata ?? {}).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleExport = () => {
    const rows = [
      ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Metadata'],
      ...filteredLogs.map(entry => [
        entry.created_at,
        entry.action,
        entry.entity_type ?? '',
        entry.entity_id ?? '',
        JSON.stringify(entry.metadata ?? {}),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto p-6">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Activity Log</h1>
              <p className="text-white/60">Monitor and track all system activities and events</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search actions, entity types, or metadata..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
              </div>
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full max-w-xs bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
            Failed to load activity logs: {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Activity Logs ({filteredLogs.length})
              </h2>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Calendar className="h-4 w-4" />
                Last updated: {new Date().toLocaleString()}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Entity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredLogs.map(entry => {
                  const category = getCategoryFromAction(entry.action);
                  return (
                    <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-white font-medium">
                        {formatAction(entry.action)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-white/70">
                          {getCategoryIcon(category)}
                          <span className="text-sm capitalize">{category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                        {entry.entity_type && (
                          <span className="capitalize">{entry.entity_type}</span>
                        )}
                        {entry.entity_id && (
                          <span className="ml-1 text-white/40 text-xs font-mono">
                            {entry.entity_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedLog(entry)}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && !loading && (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white font-medium mb-2">No activity logs yet</p>
              <p className="text-white/50 text-sm max-w-sm mx-auto">
                Activity logging will record business events — sales, inventory changes, and more — as they happen.
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-10">
              <RefreshCw className="h-6 w-6 text-indigo-400 animate-spin mx-auto mb-2" />
              <p className="text-white/60 text-sm">Loading activity logs…</p>
            </div>
          )}
        </div>

        {/* Detail modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Activity Details</h3>
                <button onClick={() => setSelectedLog(null)} className="text-white/60 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-1">Timestamp</p>
                    <p className="text-white">{formatTimestamp(selectedLog.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-1">Action</p>
                    <p className="text-white">{formatAction(selectedLog.action)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-1">Entity Type</p>
                    <p className="text-white capitalize">{selectedLog.entity_type ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-1">Entity ID</p>
                    <p className="text-white font-mono text-sm">{selectedLog.entity_id ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-1">User ID</p>
                    <p className="text-white font-mono text-sm">{selectedLog.user_id ?? '—'}</p>
                  </div>
                </div>
                {selectedLog.metadata && (
                  <div>
                    <p className="text-sm font-medium text-white/60 mb-2">Metadata</p>
                    <pre className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/80 overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
