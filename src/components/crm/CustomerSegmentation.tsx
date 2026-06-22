import {
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Mail,
  MessageSquare,
  Plus,
  Search,
  Send,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type SegmentCriteriaValue = { operator: string; value: number | string };

interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  criteria: object;
  isDynamic: boolean;
  customerCount: number;
  lastCalculated?: string;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalPurchases: number;
  visitCount: number;
  lastVisit?: string;
  createdAt: string;
}

interface CustomerSegmentationProps {
  segments: CustomerSegment[];
  customers: Customer[];
  onCreateSegment?: (segment: Omit<CustomerSegment, 'id' | 'customerCount' | 'createdAt'>) => void;
  onUpdateSegment?: (id: string, segment: Partial<CustomerSegment>) => void;
  onDeleteSegment?: (id: string) => void;
}

export default function CustomerSegmentation({
  segments,
  customers,
  onCreateSegment,
  onUpdateSegment,
  onDeleteSegment,
}: CustomerSegmentationProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    criteria: {} as object,
    isDynamic: true,
  });

  const filteredSegments = useMemo(
    () =>
      segments.filter(
        (segment) =>
          segment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          segment.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [segments, searchQuery],
  );

  const getSegmentCustomers = (segment: CustomerSegment): Customer[] => {
    const count = Math.min(segment.customerCount, customers.length);
    return customers.slice(0, count);
  };

  const getCriteriaDescription = (criteria: object): string => {
    const c = criteria as Record<string, SegmentCriteriaValue | undefined>;
    const descriptions: string[] = [];

    if (c.total_purchases) descriptions.push(`Total purchases ${c.total_purchases.operator} $${c.total_purchases.value}`);
    if (c.days_since_join) descriptions.push(`Joined ${c.days_since_join.operator} ${c.days_since_join.value} days ago`);
    if (c.purchase_count) descriptions.push(`Purchase count ${c.purchase_count.operator} ${c.purchase_count.value}`);
    if (c.days_since_last_purchase) descriptions.push(`Last purchase ${c.days_since_last_purchase.operator} ${c.days_since_last_purchase.value} days ago`);

    return descriptions.length > 0 ? descriptions.join(', ') : 'No criteria set';
  };

  const handleCreateSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (onCreateSegment) {
      onCreateSegment(newSegment);
      setNewSegment({ name: '', description: '', criteria: {}, isDynamic: true });
      setShowCreateModal(false);
    }
  };

  const toggleSegmentExpansion = (segmentId: string) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(segmentId)) {
      newExpanded.delete(segmentId);
    } else {
      newExpanded.add(segmentId);
    }
    setExpandedSegments(newExpanded);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatCurrency = (value: number | undefined | null) =>
    (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="space-y-6 pb-4 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">Segments</p>
          <h2 className="mt-1 text-xl font-bold text-white">Customer Segments</h2>
          <p className="text-sm text-white/60">Group customers based on behavior and characteristics</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Segment
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search segments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/15 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => toast.info('Filtering coming soon')}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
        >
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Segments List */}
      <div className="space-y-4">
        {filteredSegments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-white/20" />
            <h3 className="mt-3 text-sm font-semibold text-white">No segments yet</h3>
            <p className="mt-1 text-sm text-white/50">
              Customer segmentation will be available in a future update.
              <br />
              Segments allow you to group customers by purchase behavior, loyalty, and more.
            </p>
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const segmentCustomers = getSegmentCustomers(segment);
            const isExpanded = expandedSegments.has(segment.id);

            return (
              <div
                key={segment.id}
                className="rounded-2xl border border-white/15 bg-white/5"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSegmentExpansion(segment.id)}
                        className="rounded-xl p-1 hover:bg-white/10"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-white/50" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-white/50" />
                        )}
                      </button>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20">
                        <Target className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{segment.name}</h4>
                        <p className="text-sm text-white/60">{segment.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{segment.customerCount} customers</p>
                        <p className="text-xs text-white/50">
                          {segment.isDynamic ? 'Dynamic' : 'Static'} segment
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {onUpdateSegment && (
                          <button
                            onClick={() => toast.info('Campaign sending coming soon')}
                            className="rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white/70"
                            title="Send campaign"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        )}
                        {onDeleteSegment && (
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this segment?')) {
                                onDeleteSegment(segment.id);
                              }
                            }}
                            className="rounded-xl p-2 text-white/40 hover:bg-red-500/20 hover:text-red-400"
                            title="Delete segment"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <Filter className="h-3 w-3" />
                      {getCriteriaDescription(segment.criteria)}
                    </span>
                    {segment.lastCalculated && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Updated {formatDate(segment.lastCalculated)}
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-white/10 p-4">
                    <div className="mb-4">
                      <h5 className="mb-3 font-medium text-white">Segment Analytics</h5>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-xl bg-white/5 p-3">
                          <p className="text-xs text-white/50">Total Customers</p>
                          <p className="text-lg font-semibold text-white">{segment.customerCount}</p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <p className="text-xs text-white/50">Avg. Purchase Value</p>
                          <p className="text-lg font-semibold text-white">
                            {formatCurrency(
                              segmentCustomers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0) /
                                (segmentCustomers.length || 1),
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <p className="text-xs text-white/50">Total Revenue</p>
                          <p className="text-lg font-semibold text-white">
                            {formatCurrency(
                              segmentCustomers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0),
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/5 p-3">
                          <p className="text-xs text-white/50">Avg. Visits</p>
                          <p className="text-lg font-semibold text-white">
                            {(
                              segmentCustomers.reduce((sum, c) => sum + (c.visitCount || 0), 0) /
                              (segmentCustomers.length || 1)
                            ).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {segmentCustomers.length > 0 && (
                      <div>
                        <h5 className="mb-3 font-medium text-white">Sample Customers</h5>
                        <div className="space-y-2">
                          {segmentCustomers.slice(0, 5).map((customer) => (
                            <div
                              key={customer.id}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-medium text-indigo-300">
                                  {customer.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">{customer.name}</p>
                                  <p className="text-xs text-white/50">{customer.email || customer.phone}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-white">
                                  {formatCurrency(customer.totalPurchases || 0)}
                                </p>
                                <p className="text-xs text-white/50">{customer.visitCount || 0} visits</p>
                              </div>
                            </div>
                          ))}
                          {segmentCustomers.length > 5 && (
                            <p className="text-center text-xs text-white/40">
                              … and {segmentCustomers.length - 5} more customers
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => toast.info('Campaign sending coming soon')}
                        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        <Mail className="h-4 w-4" />
                        Send Campaign
                      </button>
                      <button
                        onClick={() => toast.info('Analytics view coming soon')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                      >
                        <TrendingUp className="h-4 w-4" />
                        View Analytics
                      </button>
                      <button
                        onClick={() => toast.info('Export coming soon')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10"
                      >
                        <Send className="h-4 w-4" />
                        Export List
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Segment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-white">Create Customer Segment</h3>
            <form onSubmit={handleCreateSegment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Segment Name</label>
                <input
                  type="text"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g., VIP Customers"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Description</label>
                <textarea
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Describe this customer segment"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/70">Segment Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      value="true"
                      checked={newSegment.isDynamic}
                      onChange={() => setNewSegment({ ...newSegment, isDynamic: true })}
                      className="accent-indigo-500"
                    />
                    Dynamic (auto-updated)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      value="false"
                      checked={!newSegment.isDynamic}
                      onChange={() => setNewSegment({ ...newSegment, isDynamic: false })}
                      className="accent-indigo-500"
                    />
                    Static (manual)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Create Segment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
