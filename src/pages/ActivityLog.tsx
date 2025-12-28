import { Calendar, Search, Filter, Download, Eye, User, Package, DollarSign, Settings, AlertTriangle, CheckCircle, Info, X, ChevronDown, RefreshCw, Trash2, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { BRAND } from '../constants/branding';
import { useApp } from '../context/AppContext';

interface ActivityLog {
  id: number;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  category: 'system' | 'user' | 'inventory' | 'sales' | 'customer' | 'employee' | 'settings';
  details: string;
  ipAddress: string;
  userAgent: string;
  status: 'success' | 'warning' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export default function ActivityLog() {
  const navigate = useNavigate();
  const { currentEmployee } = useApp();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    {
      id: 1,
      timestamp: '2024-01-15 15:45:23',
      userId: 'user_123',
      userName: 'John Doe',
      action: 'Login',
      category: 'user',
      details: 'User logged in successfully from IP 192.168.1.100',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      status: 'success',
      severity: 'low',
    },
    {
      id: 2,
      timestamp: '2024-01-15 15:30:12',
      userId: 'system',
      userName: 'System',
      action: 'Backup Completed',
      category: 'system',
      details: 'Automatic backup completed successfully. File size: 2.4MB',
      ipAddress: '127.0.0.1',
      userAgent: 'System Scheduler',
      status: 'success',
      severity: 'low',
    },
    {
      id: 3,
      timestamp: '2024-01-15 15:15:45',
      userId: 'user_456',
      userName: 'Jane Smith',
      action: 'Low Stock Alert',
      category: 'inventory',
      details: 'Product "Laptop Dell XPS 15" is below minimum stock level (5 units remaining)',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      status: 'warning',
      severity: 'medium',
    },
    {
      id: 4,
      timestamp: '2024-01-15 14:30:00',
      userId: 'user_789',
      userName: 'Mike Johnson',
      action: 'New Order',
      category: 'sales',
      details: 'Order #1234 created for $1,250.00 - Customer: ABC Corporation',
      ipAddress: '192.168.1.102',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      status: 'success',
      severity: 'medium',
    },
    {
      id: 5,
      timestamp: '2024-01-15 14:15:22',
      userId: 'user_123',
      userName: 'John Doe',
      action: 'Password Changed',
      category: 'user',
      details: 'User changed their password successfully',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      status: 'success',
      severity: 'medium',
    },
    {
      id: 6,
      timestamp: '2024-01-15 13:45:18',
      userId: 'system',
      userName: 'System',
      action: 'Payment Failed',
      category: 'sales',
      details: 'Payment processing failed for Order #1233 - Error: Insufficient funds',
      ipAddress: '127.0.0.1',
      userAgent: 'Payment Gateway',
      status: 'error',
      severity: 'high',
    },
    {
      id: 7,
      timestamp: '2024-01-15 13:30:45',
      userId: 'user_456',
      userName: 'Jane Smith',
      action: 'Product Added',
      category: 'inventory',
      details: 'New product "iPhone 15 Pro" added to inventory - Quantity: 50',
      ipAddress: '192.168.1.105',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      status: 'success',
      severity: 'low',
    },
    {
      id: 8,
      timestamp: '2024-01-15 13:15:30',
      userId: 'user_789',
      userName: 'Mike Johnson',
      action: 'Customer Updated',
      category: 'customer',
      details: 'Customer information updated for "ABC Corporation"',
      ipAddress: '192.168.1.102',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      status: 'success',
      severity: 'low',
    },
    {
      id: 9,
      timestamp: '2024-01-15 12:45:15',
      userId: 'user_123',
      userName: 'John Doe',
      action: 'Settings Modified',
      category: 'settings',
      details: 'System settings updated - Email configuration changed',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      status: 'success',
      severity: 'medium',
    },
    {
      id: 10,
      timestamp: '2024-01-15 12:30:00',
      userId: 'system',
      userName: 'System',
      action: 'Database Error',
      category: 'system',
      details: 'Database connection timeout - Retrying connection...',
      ipAddress: '127.0.0.1',
      userAgent: 'Database Monitor',
      status: 'error',
      severity: 'critical',
    },
  ]);

  const categories = [
    { value: 'all', label: 'All Categories', icon: FileText },
    { value: 'system', label: 'System', icon: Settings },
    { value: 'user', label: 'User Activity', icon: User },
    { value: 'inventory', label: 'Inventory', icon: Package },
    { value: 'sales', label: 'Sales', icon: DollarSign },
    { value: 'customer', label: 'Customer', icon: User },
    { value: 'employee', label: 'Employee', icon: User },
    { value: 'settings', label: 'Settings', icon: Settings },
  ];

  const severities = [
    { value: 'all', label: 'All Severities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  const dateRanges = [
    { value: '1day', label: 'Last 24 Hours' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default: return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getCategoryIcon = (category: string) => {
    const categoryData = categories.find(cat => cat.value === category);
    const Icon = categoryData?.icon || FileText;
    return <Icon className="h-4 w-4" />;
  };

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch = log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || log.category === selectedCategory;
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;

    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const handleExport = () => {
    // Simulate export functionality
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Category', 'Details', 'Status', 'Severity'],
      ...filteredLogs.map(log => [
        log.timestamp,
        log.userName,
        log.action,
        log.category,
        log.details,
        log.status,
        log.severity,
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all activity logs? This action cannot be undone.')) {
      setActivityLogs([]);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
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
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search activities, users, or details..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
              </div>
            </div>

            {/* Filter Toggle */}
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
                onClick={handleRefresh}
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
              <button
                onClick={handleClearLogs}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Severity</label>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    {severities.map(severity => (
                      <option key={severity.value} value={severity.value}>
                        {severity.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">Date Range</label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    {dateRanges.map(range => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Activity Logs Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white/80">
                      {log.timestamp}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center">
                          <User className="h-3 w-3 text-indigo-400" />
                        </div>
                        <span className="text-sm text-white">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">{log.action}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(log.category)}
                        <span className="text-sm text-white/80 capitalize">{log.category}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-sm text-white/80 capitalize">{log.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/60">No activity logs found matching your criteria</p>
            </div>
          )}
        </div>

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Activity Log Details</h3>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-white/60">Timestamp</label>
                    <p className="text-white">{selectedLog.timestamp}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">User</label>
                    <p className="text-white">{selectedLog.userName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">Action</label>
                    <p className="text-white">{selectedLog.action}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">Category</label>
                    <p className="text-white capitalize">{selectedLog.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">Status</label>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedLog.status)}
                      <span className="text-white capitalize">{selectedLog.status}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">Severity</label>
                    <span className={`px-2 py-1 text-xs rounded-full border ${getSeverityColor(selectedLog.severity)}`}>
                      {selectedLog.severity}
                    </span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">IP Address</label>
                    <p className="text-white">{selectedLog.ipAddress}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-white/60">User Agent</label>
                    <p className="text-white text-sm truncate">{selectedLog.userAgent}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-white/60">Details</label>
                  <p className="text-white mt-1">{selectedLog.details}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
