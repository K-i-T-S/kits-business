import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';

interface Communication {
  id: string;
  type: 'email' | 'sms' | 'phone' | 'in_person' | 'social_media' | 'other';
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  status: 'draft' | 'sent' | 'delivered' | 'failed' | 'opened' | 'replied';
  scheduledAt?: string;
  sentAt?: string;
  employee?: {
    id: string;
    name: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

interface CustomerCommunicationHistoryProps {
  customerId: string;
  communications: Communication[];
  onAddCommunication?: (communication: Omit<Communication, 'id' | 'createdAt'>) => void;
}

export default function CustomerCommunicationHistory({
  customerId,
  communications,
  onAddCommunication,
}: CustomerCommunicationHistoryProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCommunication, setNewCommunication] = useState({
    type: 'email' as Communication['type'],
    direction: 'outbound' as Communication['direction'],
    subject: '',
    content: '',
    scheduledAt: '',
  });

  const sortedCommunications = useMemo(
    () =>
      [...communications].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [communications],
  );

  const getTypeIcon = (type: Communication['type']) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'phone':
        return <Phone className="h-4 w-4" />;
      case 'in_person':
        return <User className="h-4 w-4" />;
      case 'social_media':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Communication['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'sent':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'delivered':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'opened':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'replied':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: Communication['status']) => {
    switch (status) {
      case 'draft':
        return <Clock className="h-3 w-3" />;
      case 'sent':
        return <Send className="h-3 w-3" />;
      case 'delivered':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      case 'opened':
        return <Mail className="h-3 w-3" />;
      case 'replied':
        return <ArrowRight className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const handleAddCommunication = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddCommunication) {
      onAddCommunication({
        type: newCommunication.type,
        direction: newCommunication.direction,
        subject: newCommunication.subject,
        content: newCommunication.content,
        status: 'draft',
        scheduledAt: newCommunication.scheduledAt || undefined,
      });
      setNewCommunication({
        type: 'email',
        direction: 'outbound',
        subject: '',
        content: '',
        scheduledAt: '',
      });
      setShowAddModal(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Communication History</h3>
          <p className="text-sm text-gray-600">Track all interactions with this customer</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Communication
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {sortedCommunications.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No communications</h3>
            <p className="mt-1 text-sm text-gray-500">Start tracking customer interactions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedCommunications.map((communication, index) => (
              <div key={communication.id} className="relative flex items-start space-x-4">
                {/* Timeline line */}
                {index < sortedCommunications.length - 1 && (
                  <div className="absolute left-4 top-8 h-full w-0.5 bg-gray-200" />
                )}

                {/* Icon */}
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white border-2 border-gray-300">
                  {getTypeIcon(communication.type)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {communication.type.replace('_', ' ')}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(
                            communication.status,
                          )}`}
                        >
                          {getStatusIcon(communication.status)}
                          {communication.status}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            communication.direction === 'inbound'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <ArrowRight
                            className={`h-3 w-3 ${
                              communication.direction === 'inbound' ? 'rotate-180' : ''
                            }`}
                          />
                          {communication.direction}
                        </span>
                      </div>

                      {communication.subject && (
                        <h4 className="font-medium text-gray-900 mb-1">{communication.subject}</h4>
                      )}

                      <p className="text-sm text-gray-600 mb-2">{communication.content}</p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(communication.createdAt)}
                        </span>
                        {communication.employee && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {communication.employee.name}
                          </span>
                        )}
                        {communication.scheduledAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Scheduled: {formatDate(communication.scheduledAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Communication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Communication</h3>
            <form onSubmit={handleAddCommunication} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newCommunication.type}
                  onChange={(e) =>
                    setNewCommunication({
                      ...newCommunication,
                      type: e.target.value as Communication['type'],
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="phone">Phone</option>
                  <option value="in_person">In Person</option>
                  <option value="social_media">Social Media</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Direction</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="outbound"
                      checked={newCommunication.direction === 'outbound'}
                      onChange={(e) =>
                        setNewCommunication({
                          ...newCommunication,
                          direction: e.target.value as Communication['direction'],
                        })
                      }
                      className="mr-2"
                    />
                    Outbound
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="inbound"
                      checked={newCommunication.direction === 'inbound'}
                      onChange={(e) =>
                        setNewCommunication({
                          ...newCommunication,
                          direction: e.target.value as Communication['direction'],
                        })
                      }
                      className="mr-2"
                    />
                    Inbound
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={newCommunication.subject}
                  onChange={(e) =>
                    setNewCommunication({ ...newCommunication, subject: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Communication subject (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={newCommunication.content}
                  onChange={(e) =>
                    setNewCommunication({ ...newCommunication, content: e.target.value })
                  }
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Communication content"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={newCommunication.scheduledAt}
                  onChange={(e) =>
                    setNewCommunication({ ...newCommunication, scheduledAt: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Add Communication
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
