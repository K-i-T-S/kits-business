import { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Send,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  criteria: Record<string, any>;
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
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [newSegment, setNewSegment] = useState({
    name: '',
    description: '',
    criteria: {} as Record<string, any>,
    isDynamic: true,
  });

  const filteredSegments = useMemo(
    () =>
      segments.filter(
        (segment) =>
          segment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          segment.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [segments, searchQuery]
  );

  const getSegmentCustomers = (segmentId: string) => {
    // In a real implementation, this would query the database
    // For now, we'll return a mock subset of customers
    return customers.slice(0, Math.floor(Math.random() * customers.length));
  };

  const getCriteriaDescription = (criteria: Record<string, any>) => {
    const descriptions: string[] = [];
    
    if (criteria.total_purchases) {
      const { operator, value } = criteria.total_purchases;
      descriptions.push(`Total purchases ${operator} $${value}`);
    }
    
    if (criteria.days_since_join) {
      const { operator, value } = criteria.days_since_join;
      descriptions.push(`Joined ${operator} ${value} days ago`);
    }
    
    if (criteria.purchase_count) {
      const { operator, value } = criteria.purchase_count;
      descriptions.push(`Purchase count ${operator} ${value}`);
    }
    
    if (criteria.days_since_last_purchase) {
      const { operator, value } = criteria.days_since_last_purchase;
      descriptions.push(`Last purchase ${operator} ${value} days ago`);
    }
    
    return descriptions.length > 0 ? descriptions.join(', ') : 'No criteria set';
  };

  const handleCreateSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (onCreateSegment) {
      onCreateSegment(newSegment);
      setNewSegment({
        name: '',
        description: '',
        criteria: {},
        isDynamic: true,
      });
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (value: number | undefined | null) => {
    return (value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Customer Segments</h3>
          <p className="text-sm text-gray-600">Group customers based on behavior and characteristics</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create Segment
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search segments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      {/* Segments List */}
      <div className="space-y-4">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No segments found</h3>
            <p className="mt-1 text-sm text-gray-500">Create your first customer segment to get started</p>
          </div>
        ) : (
          filteredSegments.map((segment) => {
            const segmentCustomers = getSegmentCustomers(segment.id);
            const isExpanded = expandedSegments.has(segment.id);
            
            return (
              <div key={segment.id} className="rounded-lg border border-gray-200 bg-white">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSegmentExpansion(segment.id)}
                        className="rounded-lg p-1 hover:bg-gray-100"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                        <Target className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{segment.name}</h4>
                        <p className="text-sm text-gray-600">{segment.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{segment.customerCount} customers</p>
                        <p className="text-xs text-gray-500">
                          {segment.isDynamic ? 'Dynamic' : 'Static'} segment
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {onUpdateSegment && (
                          <button
                            onClick={() => {
                              // Handle edit
                            }}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-100 hover:text-red-600"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
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

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-900 mb-2">Segment Analytics</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-600">Total Customers</p>
                          <p className="text-lg font-semibold text-gray-900">{segment.customerCount}</p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-600">Avg. Purchase Value</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(
                              segmentCustomers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0) /
                                (segmentCustomers.length || 1)
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-600">Total Revenue</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(
                              segmentCustomers.reduce((sum, c) => sum + (c.totalPurchases || 0), 0)
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-50 p-3">
                          <p className="text-xs text-gray-600">Avg. Visits</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {(
                              segmentCustomers.reduce((sum, c) => sum + (c.visitCount || 0), 0) /
                              (segmentCustomers.length || 1)
                            ).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-900 mb-2">Sample Customers</h5>
                      <div className="space-y-2">
                        {segmentCustomers.slice(0, 5).map((customer) => (
                          <div
                            key={customer.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                                {customer.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                                <p className="text-xs text-gray-500">{customer.email || customer.phone}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(customer.totalPurchases || 0)}
                              </p>
                              <p className="text-xs text-gray-500">{customer.visitCount || 0} visits</p>
                            </div>
                          </div>
                        ))}
                        {segmentCustomers.length > 5 && (
                          <p className="text-xs text-gray-500 text-center">
                            ... and {segmentCustomers.length - 5} more customers
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                        <Mail className="h-4 w-4" />
                        Send Campaign
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <TrendingUp className="h-4 w-4" />
                        View Analytics
                      </button>
                      <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Customer Segment</h3>
            <form onSubmit={handleCreateSegment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segment Name</label>
                <input
                  type="text"
                  value={newSegment.name}
                  onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g., VIP Customers"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newSegment.description}
                  onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Describe this customer segment"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segment Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="true"
                      checked={newSegment.isDynamic}
                      onChange={(e) =>
                        setNewSegment({ ...newSegment, isDynamic: e.target.value === 'true' })
                      }
                      className="mr-2"
                    />
                    Dynamic (auto-updated)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="false"
                      checked={!newSegment.isDynamic}
                      onChange={(e) =>
                        setNewSegment({ ...newSegment, isDynamic: e.target.value === 'true' })
                      }
                      className="mr-2"
                    />
                    Static (manual)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
