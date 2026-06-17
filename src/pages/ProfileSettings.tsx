import { User, Mail, Phone, Shield, Camera, Save, X, Eye, EyeOff, Key, Bell, Palette, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { supabase } from '../utils/supabaseClient';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const { currentEmployee } = useApp();
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const nameParts = currentEmployee?.name?.split(' ') ?? [];
  const [formData, setFormData] = useState({
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' ') ?? '',
    email: currentEmployee?.email ?? '',
    phone: '',
    role: currentEmployee?.role ?? '',
    department: '',
    bio: '',
    timezone: 'Asia/Beirut',
    language: 'English',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24-hour',
    notifications: {
      email: true,
      push: true,
      sms: false,
      desktop: true,
    },
    theme: 'dark',
    accentColor: 'indigo',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [avatarUrl, setAvatarUrl] = useState('');

  const handleInputChange = (field: keyof typeof formData, value: string | boolean | Record<string, boolean>) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNotificationChange = (type: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: value,
      },
    }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          bio: formData.bio,
          department: formData.department,
          timezone: formData.timezone,
          language: formData.language,
          dateFormat: formData.dateFormat,
          timeFormat: formData.timeFormat,
          theme: formData.theme,
          accentColor: formData.accentColor,
          notifications: formData.notifications,
        },
      });
      if (error) throw error;
      toast.success('Profile saved successfully');
    } catch (err) {
      toast.error('Failed to save profile', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      // Re-authenticate first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: passwordData.currentPassword,
      });
      if (signInError) throw new Error('Current password is incorrect');

      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Failed to update password', {
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 pb-20 lg:pb-0">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Profile Settings</h1>
              <p className="text-white/60">Manage your personal information and preferences</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              {/* Avatar Section */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-white">
                        {formData.firstName?.[0]}{formData.lastName?.[0]}
                      </span>
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center border-2 border-slate-900 hover:bg-indigo-600 transition-colors">
                    <Camera className="h-4 w-4 text-white" />
                  </button>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {formData.firstName} {formData.lastName}
                </h3>
                <p className="text-sm text-white/60">{formData.role}</p>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-1">
                {tabs.map((tab) => {
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
              {/* Personal Information Tab */}
              {activeTab === 'personal' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Personal Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">First Name</label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Last Name</label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Role</label>
                        <input
                          type="text"
                          value={formData.role}
                          disabled
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white/60 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Department</label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => handleInputChange('department', e.target.value)}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-white/80 mb-2">Bio</label>
                      <textarea
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Security Settings</h2>

                    <div className="space-y-6">
                      <div className="p-4 border border-white/10 rounded-lg">
                        <h3 className="text-lg font-medium text-white mb-4">Change Password</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Current Password</label>
                            <div className="relative">
                              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                              <input
                                type={showCurrentPassword ? 'text' : 'password'}
                                value={passwordData.currentPassword}
                                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                                className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
                              >
                                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">New Password</label>
                            <div className="relative">
                              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                              <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={passwordData.newPassword}
                                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                                className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                              />
                              <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
                              >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Confirm New Password</label>
                            <div className="relative">
                              <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                value={passwordData.confirmPassword}
                                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                                className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={handlePasswordUpdate}
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                          >
                            <Key className="h-4 w-4" />
                            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Updating...</> : 'Update Password'}
                          </button>
                        </div>
                      </div>

                      <div className="p-4 border border-white/10 rounded-lg">
                        <h3 className="text-lg font-medium text-white mb-2">Two-Factor Authentication</h3>
                        <p className="text-sm text-white/60 mb-4">Add an extra layer of security to your account</p>
                        <button className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors">
                          Enable 2FA
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preferences Tab */}
              {activeTab === 'preferences' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Preferences</h2>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium text-white mb-4">Appearance</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Theme</label>
                            <select
                              value={formData.theme}
                              onChange={(e) => handleInputChange('theme', e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            >
                              <option value="dark" className="bg-slate-800 text-white">Dark</option>
                              <option value="light" className="bg-slate-800 text-white">Light</option>
                              <option value="auto" className="bg-slate-800 text-white">Auto</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Accent Color</label>
                            <select
                              value={formData.accentColor}
                              onChange={(e) => handleInputChange('accentColor', e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            >
                              <option value="indigo" className="bg-slate-800 text-white">Indigo</option>
                              <option value="blue" className="bg-slate-800 text-white">Blue</option>
                              <option value="purple" className="bg-slate-800 text-white">Purple</option>
                              <option value="green" className="bg-slate-800 text-white">Green</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-white mb-4">Regional Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Language</label>
                            <select
                              value={formData.language}
                              onChange={(e) => handleInputChange('language', e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            >
                              <option value="English" className="bg-slate-800 text-white">English</option>
                              <option value="Arabic" className="bg-slate-800 text-white">العربية</option>
                              <option value="French" className="bg-slate-800 text-white">Français</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Timezone</label>
                            <select
                              value={formData.timezone}
                              onChange={(e) => handleInputChange('timezone', e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            >
                              <option value="Asia/Beirut" className="bg-slate-800 text-white">Asia/Beirut</option>
                              <option value="Europe/London" className="bg-slate-800 text-white">Europe/London</option>
                              <option value="America/New_York" className="bg-slate-800 text-white">America/New_York</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Date Format</label>
                            <select
                              value={formData.dateFormat}
                              onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            >
                              <option value="MM/DD/YYYY" className="bg-slate-800 text-white">MM/DD/YYYY</option>
                              <option value="DD/MM/YYYY" className="bg-slate-800 text-white">DD/MM/YYYY</option>
                              <option value="YYYY-MM-DD" className="bg-slate-800 text-white">YYYY-MM-DD</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">Time Format</label>
                            <select
                              value={formData.timeFormat}
                              onChange={(e) => handleInputChange('timeFormat', e.target.value)}
                              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                            >
                              <option value="12-hour" className="bg-slate-800 text-white">12-hour</option>
                              <option value="24-hour" className="bg-slate-800 text-white">24-hour</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white mb-6">Notification Preferences</h2>

                    <div className="space-y-4">
                      <div className="p-4 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-white">Email Notifications</h3>
                            <p className="text-sm text-white/60">Receive important updates via email</p>
                          </div>
                          <button
                            onClick={() => handleNotificationChange('email', !formData.notifications.email)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData.notifications.email ? 'bg-indigo-500' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.notifications.email ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-white">Push Notifications</h3>
                            <p className="text-sm text-white/60">Get instant updates in your browser</p>
                          </div>
                          <button
                            onClick={() => handleNotificationChange('push', !formData.notifications.push)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData.notifications.push ? 'bg-indigo-500' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.notifications.push ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-white">SMS Notifications</h3>
                            <p className="text-sm text-white/60">Receive text messages for urgent updates</p>
                          </div>
                          <button
                            onClick={() => handleNotificationChange('sms', !formData.notifications.sms)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData.notifications.sms ? 'bg-indigo-500' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.notifications.sms ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 border border-white/10 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-white">Desktop Notifications</h3>
                            <p className="text-sm text-white/60">Show notifications on your desktop</p>
                          </div>
                          <button
                            onClick={() => handleNotificationChange('desktop', !formData.notifications.desktop)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              formData.notifications.desktop ? 'bg-indigo-500' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formData.notifications.desktop ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveProfile}
                      disabled={loading}
                      className="flex items-center gap-2 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
