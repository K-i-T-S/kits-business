import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Building2, 
  Shield, 
  Mail, 
  Database, 
  Bell, 
  Plug, 
  Key, 
  Save, 
  X, 
  Check, 
  AlertTriangle,
  User,
  Lock,
  Smartphone,
  Globe,
  Clock,
  RefreshCw,
  Download,
  Upload,
  FileText,
  Users as UsersIcon,
  CreditCard,
  Package,
  TrendingUp,
  HelpCircle,
  Info,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { useAccessibility } from '../providers/AccessibilityProvider';
import { useApp } from '../context/AppContext';
import { BRAND } from '../constants/branding';
import { log } from '../utils/logger';

export default function SystemSettings() {
  const navigate = useNavigate();
  const { currentEmployee } = useApp();
  const { announce, setAriaAttribute, setRole } = useAccessibility();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  const [settings, setSettings] = useState({
    // General Settings
    siteName: BRAND.name,
    siteUrl: 'https://kits-solutions.com',
    timezone: 'Asia/Beirut',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    language: 'English',
    
    // Business Settings
    businessName: 'Kits - Khoder\'s IT Solutions',
    businessEmail: BRAND.supportEmail,
    businessPhone: BRAND.supportWhatsApp,
    businessAddress: 'Beirut, Lebanon',
    taxRate: 15,
    
    // Security Settings
    sessionTimeout: 30,
    passwordMinLength: 8,
    require2FA: false,
    allowedIPs: '',
    loginAttempts: 5,
    
    // Email Settings
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    emailFrom: BRAND.supportEmail,
    emailFromName: BRAND.name,
    
    // Backup Settings
    autoBackup: true,
    backupFrequency: 'daily',
    retentionDays: 30,
    backupLocation: 'cloud',
    
    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    lowStockAlert: true,
    newOrderAlert: true,
    
    // Integration Settings
    paymentGateway: 'stripe',
    shippingProvider: 'dhl',
    analyticsProvider: 'google',
    
    // API Settings
    apiEnabled: true,
    apiRateLimit: 1000,
    webhookUrl: '',
    apiKey: '',
  });

  const [backupHistory, setBackupHistory] = useState([
    { id: 1, date: '2024-01-15 14:30', size: '2.4 MB', type: 'Automatic', status: 'completed' },
    { id: 2, date: '2024-01-14 14:30', size: '2.3 MB', type: 'Automatic', status: 'completed' },
    { id: 3, date: '2024-01-13 14:30', size: '2.3 MB', type: 'Manual', status: 'completed' },
  ]);

  const [systemLogs, setSystemLogs] = useState([
    { id: 1, timestamp: '2024-01-15 15:45:23', level: 'info', message: 'System backup completed successfully', user: 'System' },
    { id: 2, timestamp: '2024-01-15 15:30:12', level: 'warning', message: 'High memory usage detected', user: 'System' },
    { id: 3, timestamp: '2024-01-15 15:15:45', level: 'error', message: 'Failed to send email notification', user: 'System' },
    { id: 4, timestamp: '2024-01-15 14:30:00', level: 'info', message: 'User John Doe logged in', user: 'John Doe' },
  ]);

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Globe },
    { id: 'api', label: 'API', icon: Settings },
  ];

  const handleSettingChange = (category: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      announce('Saving settings...', 'polite');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSaveStatus('success');
      announce('Settings saved successfully!', 'polite');
      
      // Reset status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      announce('Failed to save settings. Please try again.', 'assertive');
    }
  };

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    announce(`Switched to ${tabId} settings`, 'polite');
  }, [announce]);

  const handleBackup = async () => {
    setLoading(true);
    // Simulate backup process
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    
    // Add new backup to history
    const newBackup = {
      id: (backupHistory?.length || 0) + 1,
      date: new Date().toLocaleString(),
      size: '2.5 MB',
      type: 'Manual',
      status: 'completed'
    };
    setBackupHistory([newBackup, ...(backupHistory || [])]);
  };

  const handleRestore = (backupId: number) => {
    // Handle restore logic
    log.info('Restoring backup', { backupId });
  };

  const handleDeleteBackup = (backupId: number) => {
    setBackupHistory((backupHistory || [])?.filter(backup => backup.id !== backupId) || []);
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      case 'info': return <Info className="h-4 w-4 text-blue-400" />;
      default: return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">System Settings</h1>
              <p className="text-white/60">Configure your system preferences and settings</p>
            </div>
            <div className="flex items-center gap-4">
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">Settings saved successfully</span>
                </div>
              )}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Settings Categories</h3>
              <nav className="space-y-1">
                {(tabs || [])?.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              {/* General Settings */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">General Settings</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Site Name</label>
                        <input
                          type="text"
                          value={settings.siteName}
                          onChange={(e) => handleSettingChange('general', 'siteName', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Site URL</label>
                        <input
                          type="url"
                          value={settings.siteUrl}
                          onChange={(e) => handleSettingChange('general', 'siteUrl', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Timezone</label>
                        <select
                          value={settings.timezone}
                          onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="Asia/Beirut" className="bg-slate-800 text-white">Asia/Beirut</option>
                          <option value="Europe/London" className="bg-slate-800 text-white">Europe/London</option>
                          <option value="America/New_York" className="bg-slate-800 text-white">America/New_York</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Currency</label>
                        <select
                          value={settings.currency}
                          onChange={(e) => handleSettingChange('general', 'currency', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="USD" className="bg-slate-800 text-white">USD ($)</option>
                          <option value="EUR" className="bg-slate-800 text-white">EUR (€)</option>
                          <option value="GBP" className="bg-slate-800 text-white">GBP (£)</option>
                          <option value="LBP" className="bg-slate-800 text-white">LBP (ل.ل)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Date Format</label>
                        <select
                          value={settings.dateFormat}
                          onChange={(e) => handleSettingChange('general', 'dateFormat', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="MM/DD/YYYY" className="bg-slate-800 text-white">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY" className="bg-slate-800 text-white">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD" className="bg-slate-800 text-white">YYYY-MM-DD</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Language</label>
                        <select
                          value={settings.language}
                          onChange={(e) => handleSettingChange('general', 'language', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="English" className="bg-slate-800 text-white">English</option>
                          <option value="Arabic" className="bg-slate-800 text-white">العربية</option>
                          <option value="French" className="bg-slate-800 text-white">Français</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Business Settings */}
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Business Information</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Business Name</label>
                        <input
                          type="text"
                          value={settings.businessName}
                          onChange={(e) => handleSettingChange('business', 'businessName', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Business Email</label>
                        <input
                          type="email"
                          value={settings.businessEmail}
                          onChange={(e) => handleSettingChange('business', 'businessEmail', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Business Phone</label>
                        <input
                          type="tel"
                          value={settings.businessPhone}
                          onChange={(e) => handleSettingChange('business', 'businessPhone', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Business Address</label>
                        <input
                          type="text"
                          value={settings.businessAddress}
                          onChange={(e) => handleSettingChange('business', 'businessAddress', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Tax Rate (%)</label>
                        <input
                          type="number"
                          value={settings.taxRate}
                          onChange={(e) => handleSettingChange('business', 'taxRate', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Security Configuration</h2>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">Session Timeout (minutes)</label>
                          <input
                            type="number"
                            value={settings.sessionTimeout}
                            onChange={(e) => handleSettingChange('security', 'sessionTimeout', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">Password Minimum Length</label>
                          <input
                            type="number"
                            value={settings.passwordMinLength}
                            onChange={(e) => handleSettingChange('security', 'passwordMinLength', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">Max Login Attempts</label>
                          <input
                            type="number"
                            value={settings.loginAttempts}
                            onChange={(e) => handleSettingChange('security', 'loginAttempts', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">Allowed IPs (comma-separated)</label>
                          <input
                            type="text"
                            value={settings.allowedIPs}
                            onChange={(e) => handleSettingChange('security', 'allowedIPs', e.target.value)}
                            placeholder="192.168.1.1, 10.0.0.1"
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                          <div>
                            <h3 className="text-lg font-medium text-white">Require Two-Factor Authentication</h3>
                            <p className="text-sm text-white/60">Force all users to enable 2FA</p>
                          </div>
                          <button
                            onClick={() => handleSettingChange('security', 'require2FA', !settings.require2FA)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.require2FA ? 'bg-indigo-500' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings.require2FA ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Settings */}
              {activeTab === 'email' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Email Configuration</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">SMTP Host</label>
                        <input
                          type="text"
                          value={settings.smtpHost}
                          onChange={(e) => handleSettingChange('email', 'smtpHost', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">SMTP Port</label>
                        <input
                          type="number"
                          value={settings.smtpPort}
                          onChange={(e) => handleSettingChange('email', 'smtpPort', parseInt(e.target.value))}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">SMTP Username</label>
                        <input
                          type="text"
                          value={settings.smtpUsername}
                          onChange={(e) => handleSettingChange('email', 'smtpUsername', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">SMTP Password</label>
                        <input
                          type="password"
                          value={settings.smtpPassword}
                          onChange={(e) => handleSettingChange('email', 'smtpPassword', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">From Email</label>
                        <input
                          type="email"
                          value={settings.emailFrom}
                          onChange={(e) => handleSettingChange('email', 'emailFrom', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">From Name</label>
                        <input
                          type="text"
                          value={settings.emailFromName}
                          onChange={(e) => handleSettingChange('email', 'emailFromName', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                        Test Email Configuration
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Settings */}
              {activeTab === 'backup' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold text-white">Backup & Recovery</h2>
                      <button
                        onClick={handleBackup}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Creating Backup...' : 'Create Backup'}
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">Auto Backup</label>
                          <select
                            value={settings.backupFrequency}
                            onChange={(e) => handleSettingChange('backup', 'backupFrequency', e.target.value)}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          >
                            <option value="daily" className="bg-slate-800 text-white">Daily</option>
                            <option value="weekly" className="bg-slate-800 text-white">Weekly</option>
                            <option value="monthly" className="bg-slate-800 text-white">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-white/80 mb-2">Retention Days</label>
                          <input
                            type="number"
                            value={settings.retentionDays}
                            onChange={(e) => handleSettingChange('backup', 'retentionDays', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white">Backup History</h3>
                        <div className="border border-white/10 rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-white/5">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Size</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {(backupHistory || [])?.map((backup) => (
                                <tr key={backup.id} className="hover:bg-white/5">
                                  <td className="px-4 py-3 text-sm text-white">{backup.date}</td>
                                  <td className="px-4 py-3 text-sm text-white">{backup.size}</td>
                                  <td className="px-4 py-3 text-sm text-white">{backup.type}</td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                                      {backup.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleRestore(backup.id)}
                                        className="text-indigo-400 hover:text-indigo-300"
                                        title="Restore"
                                      >
                                        <RefreshCw className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBackup(backup.id)}
                                        className="text-red-400 hover:text-red-300"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Notification Preferences</h2>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                        <div>
                          <h3 className="text-lg font-medium text-white">Email Notifications</h3>
                          <p className="text-sm text-white/60">Send notifications via email</p>
                        </div>
                        <button
                          onClick={() => handleSettingChange('notifications', 'emailNotifications', !settings.emailNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.emailNotifications ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                        <div>
                          <h3 className="text-lg font-medium text-white">SMS Notifications</h3>
                          <p className="text-sm text-white/60">Send notifications via SMS</p>
                        </div>
                        <button
                          onClick={() => handleSettingChange('notifications', 'smsNotifications', !settings.smsNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.smsNotifications ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.smsNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                        <div>
                          <h3 className="text-lg font-medium text-white">Push Notifications</h3>
                          <p className="text-sm text-white/60">Send browser push notifications</p>
                        </div>
                        <button
                          onClick={() => handleSettingChange('notifications', 'pushNotifications', !settings.pushNotifications)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.pushNotifications ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                        <div>
                          <h3 className="text-lg font-medium text-white">Low Stock Alerts</h3>
                          <p className="text-sm text-white/60">Alert when inventory is low</p>
                        </div>
                        <button
                          onClick={() => handleSettingChange('notifications', 'lowStockAlert', !settings.lowStockAlert)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.lowStockAlert ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.lowStockAlert ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg">
                        <div>
                          <h3 className="text-lg font-medium text-white">New Order Alerts</h3>
                          <p className="text-sm text-white/60">Alert when new orders are received</p>
                        </div>
                        <button
                          onClick={() => handleSettingChange('notifications', 'newOrderAlert', !settings.newOrderAlert)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.newOrderAlert ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.newOrderAlert ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Integrations Settings */}
              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Third-Party Integrations</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Payment Gateway</label>
                        <select
                          value={settings.paymentGateway}
                          onChange={(e) => handleSettingChange('integrations', 'paymentGateway', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="stripe" className="bg-slate-800 text-white">Stripe</option>
                          <option value="paypal" className="bg-slate-800 text-white">PayPal</option>
                          <option value="square" className="bg-slate-800 text-white">Square</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Shipping Provider</label>
                        <select
                          value={settings.shippingProvider}
                          onChange={(e) => handleSettingChange('integrations', 'shippingProvider', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="dhl" className="bg-slate-800 text-white">DHL</option>
                          <option value="fedex" className="bg-slate-800 text-white">FedEx</option>
                          <option value="ups" className="bg-slate-800 text-white">UPS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Analytics Provider</label>
                        <select
                          value={settings.analyticsProvider}
                          onChange={(e) => handleSettingChange('integrations', 'analyticsProvider', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="google" className="bg-slate-800 text-white">Google Analytics</option>
                          <option value="mixpanel" className="bg-slate-800 text-white">Mixpanel</option>
                          <option value="segment" className="bg-slate-800 text-white">Segment</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* API Settings */}
              {activeTab === 'api' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">API Configuration</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">API Enabled</label>
                        <button
                          onClick={() => handleSettingChange('api', 'apiEnabled', !settings.apiEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.apiEnabled ? 'bg-indigo-500' : 'bg-white/20'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              settings.apiEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Rate Limit (requests/hour)</label>
                        <input
                          type="number"
                          value={settings.apiRateLimit}
                          onChange={(e) => handleSettingChange('api', 'apiRateLimit', parseInt(e.target.value))}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-white/80 mb-2">Webhook URL</label>
                        <input
                          type="url"
                          value={settings.webhookUrl}
                          onChange={(e) => handleSettingChange('api', 'webhookUrl', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-white/80 mb-2">API Key</label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={settings.apiKey}
                            onChange={(e) => handleSettingChange('api', 'apiKey', e.target.value)}
                            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                          <button className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
                            Generate New
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-6 border-t border-white/10">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
