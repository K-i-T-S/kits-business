import {
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
import { toast } from 'sonner';

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
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface CustomerCommunicationHistoryProps {
  customerId: string;
  communications: Communication[];
  onAddCommunication?: (communication: Omit<Communication, 'id' | 'createdAt'>) => void;
}

export default function CustomerCommunicationHistory({
  customerId: _customerId,
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
      case 'email':        return <Mail className="h-4 w-4" />;
      case 'sms':          return <MessageSquare className="h-4 w-4" />;
      case 'phone':        return <Phone className="h-4 w-4" />;
      case 'in_person':    return <User className="h-4 w-4" />;
      case 'social_media': return <MessageSquare className="h-4 w-4" />;
      default:             return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: Communication['status']) => {
    switch (status) {
      case 'draft':     return 'bg-white/10 text-white/60 border-white/20';
      case 'sent':      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'delivered': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'failed':    return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'opened':    return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'replied':   return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default:          return 'bg-white/10 text-white/60 border-white/20';
    }
  };

  const getStatusIcon = (status: Communication['status']) => {
    switch (status) {
      case 'draft':     return <Clock className="h-3 w-3" />;
      case 'sent':      return <Send className="h-3 w-3" />;
      case 'delivered': return <CheckCircle2 className="h-3 w-3" />;
      case 'failed':    return <XCircle className="h-3 w-3" />;
      case 'opened':    return <Mail className="h-3 w-3" />;
      case 'replied':   return <ArrowRight className="h-3 w-3" />;
      default:          return <Clock className="h-3 w-3" />;
    }
  };

  const handleAddCommunication = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAddCommunication) {
      onAddCommunication({
        type: newCommunication.type,
        direction: newCommunication.direction,
        subject: newCommunication.subject || undefined,
        content: newCommunication.content,
        status: 'draft',
        scheduledAt: newCommunication.scheduledAt || undefined,
      });
      setNewCommunication({ type: 'email', direction: 'outbound', subject: '', content: '', scheduledAt: '' });
      setShowAddModal(false);
    } else {
      toast.info('Communication history coming soon');
      setShowAddModal(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-medium">History</p>
          <h2 className="mt-1 text-xl font-bold text-white">Communication History</h2>
          <p className="text-sm text-white/60">Track all interactions with this customer</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Communication
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {sortedCommunications.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-white/20" />
            <h3 className="mt-3 text-sm font-semibold text-white">No communications yet</h3>
            <p className="mt-1 text-sm text-white/50">
              Communication history will be available in a future update.
              <br />
              Track emails, calls, in-person visits, and more per customer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedCommunications.map((communication, index) => (
              <div key={communication.id} className="relative flex items-start space-x-4">
                {index < sortedCommunications.length - 1 && (
                  <div className="absolute left-4 top-8 h-full w-0.5 bg-white/10" />
                )}

                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/60">
                  {getTypeIcon(communication.type)}
                </div>

                <div className="min-w-0 flex-1 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium capitalize text-white">
                          {communication.type.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusColor(communication.status)}`}>
                          {getStatusIcon(communication.status)}
                          {communication.status}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          communication.direction === 'inbound'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-white/10 text-white/60'
                        }`}>
                          <ArrowRight className={`h-3 w-3 ${communication.direction === 'inbound' ? 'rotate-180' : ''}`} />
                          {communication.direction}
                        </span>
                      </div>

                      {communication.subject && (
                        <h4 className="mb-1 font-medium text-white">{communication.subject}</h4>
                      )}

                      <p className="mb-2 text-sm text-white/70">{communication.content}</p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold text-white">Add Communication</h3>
            <form onSubmit={handleAddCommunication} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Type</label>
                <select
                  value={newCommunication.type}
                  onChange={(e) =>
                    setNewCommunication({ ...newCommunication, type: e.target.value as Communication['type'] })
                  }
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
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
                <label className="mb-2 block text-sm font-medium text-white/70">Direction</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      value="outbound"
                      checked={newCommunication.direction === 'outbound'}
                      onChange={(e) =>
                        setNewCommunication({ ...newCommunication, direction: e.target.value as Communication['direction'] })
                      }
                      className="accent-indigo-500"
                    />
                    Outbound
                  </label>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="radio"
                      value="inbound"
                      checked={newCommunication.direction === 'inbound'}
                      onChange={(e) =>
                        setNewCommunication({ ...newCommunication, direction: e.target.value as Communication['direction'] })
                      }
                      className="accent-indigo-500"
                    />
                    Inbound
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Subject</label>
                <input
                  type="text"
                  value={newCommunication.subject}
                  onChange={(e) => setNewCommunication({ ...newCommunication, subject: e.target.value })}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Communication subject (optional)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Content</label>
                <textarea
                  value={newCommunication.content}
                  onChange={(e) => setNewCommunication({ ...newCommunication, content: e.target.value })}
                  rows={4}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-indigo-500 focus:outline-none"
                  placeholder="Communication content"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-white/70">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={newCommunication.scheduledAt}
                  onChange={(e) => setNewCommunication({ ...newCommunication, scheduledAt: e.target.value })}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
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
