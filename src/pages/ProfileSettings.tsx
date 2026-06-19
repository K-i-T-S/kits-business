import { Camera, CheckCircle, Eye, EyeOff, Key, Loader2, Save, Shield, ShieldOff, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../utils/supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type LanguageCode = 'en' | 'ar' | 'fr' | 'es' | 'zh';
type ActiveTab = 'profile' | 'password' | 'language' | 'notifications' | 'security';

// ── MFA state machine ─────────────────────────────────────────────────────────

type MfaEnrollState =
  | { phase: 'idle' }
  | { phase: 'enrolling'; factorId: string; qrCode: string; secret: string }
  | { phase: 'verifying'; factorId: string; qrCode: string; secret: string }
  | { phase: 'enrolled'; factorId: string };

interface NotificationPrefs {
  notif_sale: boolean;
  notif_lowstock: boolean;
  notif_daily: boolean;
}

function loadNotificationPrefs(): NotificationPrefs {
  return {
    notif_sale: localStorage.getItem('notif_sale') !== 'false',
    notif_lowstock: localStorage.getItem('notif_lowstock') !== 'false',
    notif_daily: localStorage.getItem('notif_daily') === 'true',
  };
}

// ── Toggle sub-component ──────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
        checked ? 'bg-indigo-500' : 'bg-white/20'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentEmployee } = useApp();
  const { currentLanguage, changeLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Language
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  // Notifications (localStorage-backed)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);

  // 2FA / MFA
  const [mfaState, setMfaState] = useState<MfaEnrollState>({ phase: 'idle' });
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  // Load auth user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setDisplayName((meta['full_name'] as string | undefined) ?? currentEmployee?.name ?? '');
      setAvatarUrl((meta['avatar_url'] as string | undefined) ?? '');
    }).catch(() => {
      // ignore — user may not be authenticated yet
    });
  }, [currentEmployee?.name]);

  // Check existing MFA enrollment on mount
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      if (!data) return;
      const enrolled = data.totp[0];
      if (enrolled) {
        setMfaState({ phase: 'enrolled', factorId: enrolled.id });
      }
    }).catch(() => {
      // ignore — best effort
    });
  }, []);

  // Sync language from context
  useEffect(() => {
    const code = currentLanguage as LanguageCode;
    if (['en', 'ar', 'fr', 'es', 'zh'].includes(code)) {
      setSelectedLanguage(code);
    }
  }, [currentLanguage]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName.trim() },
      });
      if (error) throw error;
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('errors.passwordTooShort'));
      return;
    }
    if (!currentPassword) {
      toast.error('Please enter your current password');
      return;
    }

    setSavingPassword(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (signInError) throw new Error('Current password is incorrect');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success(t('settings.saved'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveLanguage = async () => {
    setSavingLanguage(true);
    try {
      await changeLanguage(selectedLanguage);
      toast.success(t('settings.saved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleNotifChange = (key: keyof NotificationPrefs, value: boolean) => {
    localStorage.setItem(key, String(value));
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
    toast.success(t('settings.saved'));
  };

  // ── 2FA Handlers ──────────────────────────────────────────────────────────

  const handleStartEnroll = async () => {
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      if (!data?.totp) throw new Error('No TOTP data returned');
      setMfaCode('');
      setMfaState({
        phase: 'enrolling',
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Failed to start enrollment');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyEnroll = async () => {
    if (mfaState.phase !== 'enrolling' && mfaState.phase !== 'verifying') return;
    const factorId = mfaState.factorId;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: mfaCode.trim(),
      });
      if (verifyError) {
        if (verifyError.message.toLowerCase().includes('invalid')) {
          throw new Error('Invalid code, try again');
        }
        throw verifyError;
      }
      setMfaState({ phase: 'enrolled', factorId });
      setMfaCode('');
      toast.success('Two-factor authentication enabled');
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (mfaState.phase !== 'enrolling' && mfaState.phase !== 'verifying') return;
    const factorId = mfaState.factorId;
    setMfaLoading(true);
    try {
      await supabase.auth.mfa.unenroll({ factorId });
    } catch {
      // ignore cancel errors
    } finally {
      setMfaState({ phase: 'idle' });
      setMfaCode('');
      setMfaError(null);
      setMfaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (mfaState.phase !== 'enrolled') return;
    const factorId = mfaState.factorId;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setMfaState({ phase: 'idle' });
      setShowDisableConfirm(false);
      toast.success('Two-factor authentication disabled');
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setMfaLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'profile', label: t('settings.profile') },
    { id: 'password', label: t('settings.password') },
    { id: 'language', label: t('settings.language') },
    { id: 'notifications', label: t('settings.notifications') },
    { id: 'security', label: 'Security' },
  ];

  const languageOptions: { code: LanguageCode; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'zh', label: '中文' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 lg:pb-0">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              {t('settings.profile')}
            </h1>
            <p className="mt-1 text-white/60 text-sm">
              {t('navigation.profileSettings')}
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="hidden sm:inline">{t('common.dashboard')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">

              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-600 to-sky-500 flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={t('settings.avatar')}
                        className="h-full w-full object-cover"
                      />
                    ) : initials !== '' ? (
                      <span className="text-xl font-bold text-white">{initials}</span>
                    ) : (
                      <User className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-indigo-600 border-2 border-slate-950 flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    title={t('settings.avatar')}
                  >
                    {uploadingAvatar
                      ? <Loader2 className="h-3 w-3 animate-spin text-white" />
                      : <Camera className="h-3 w-3 text-white" />
                    }
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleAvatarUpload(file);
                    }}
                  />
                </div>
                <p className="mt-3 font-semibold text-white text-sm text-center">
                  {displayName || currentEmployee?.name || '—'}
                </p>
                <p className="text-xs text-white/50 capitalize">
                  {currentEmployee?.role ?? ''}
                </p>
              </div>

              {/* Nav */}
              <nav className="space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-white/60 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">

              {/* ── Profile tab ─────────────────────────────────────────── */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-white">
                    {t('settings.profile')}
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.displayName')}
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      placeholder={t('settings.displayName')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.email')}
                    </label>
                    <input
                      type="email"
                      value={currentEmployee?.email ?? ''}
                      disabled
                      className="w-full px-4 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-white/50 cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-white/40">
                      Email address cannot be changed here.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.avatar')}
                    </label>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white/80 hover:border-white/40 transition-colors disabled:opacity-50"
                    >
                      {uploadingAvatar
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Camera className="h-4 w-4" />
                      }
                      {uploadingAvatar ? t('common.loading') : 'Upload Photo'}
                    </button>
                    {avatarUrl && (
                      <p className="mt-2 text-xs text-white/40 truncate">
                        Current: {avatarUrl}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => void handleSaveProfile()}
                      disabled={savingProfile}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingProfile
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />
                      }
                      {savingProfile ? t('settings.saving') : t('settings.saveChanges')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Password tab ─────────────────────────────────────────── */}
              {activeTab === 'password' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-white">
                    {t('settings.password')}
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                      >
                        {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.newPassword')}
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                      >
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.confirmPassword')}
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        className={`w-full pl-10 pr-12 py-2.5 bg-slate-900 border rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 ${
                          confirmPassword && newPassword !== confirmPassword
                            ? 'border-red-500/50'
                            : 'border-white/20'
                        }`}
                        placeholder="Repeat new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                      >
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-400">{t('settings.passwordMismatch')}</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => void handleSavePassword()}
                      disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingPassword
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Key className="h-4 w-4" />
                      }
                      {savingPassword ? t('settings.saving') : t('settings.saveChanges')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Language tab ─────────────────────────────────────────── */}
              {activeTab === 'language' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-white">
                    {t('settings.language')}
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      {t('settings.language')}
                    </label>
                    <select
                      value={selectedLanguage}
                      onChange={e => setSelectedLanguage(e.target.value as LanguageCode)}
                      className="w-full bg-slate-800 border border-white/20 text-white rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      {languageOptions.map(lang => (
                        <option key={lang.code} value={lang.code} className="bg-slate-800 text-white">
                          {lang.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-white/40">
                      Selecting Arabic will switch the interface to right-to-left layout.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => void handleSaveLanguage()}
                      disabled={savingLanguage}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingLanguage
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Save className="h-4 w-4" />
                      }
                      {savingLanguage ? t('settings.saving') : t('settings.saveChanges')}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Notifications tab ─────────────────────────────────────── */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-white">
                    {t('settings.notifications')}
                  </h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white">Email me when a sale is made</p>
                        <p className="text-xs text-white/50 mt-0.5">Receive an email for each completed sale</p>
                      </div>
                      <Toggle
                        checked={notifPrefs.notif_sale}
                        onChange={v => handleNotifChange('notif_sale', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white">Low stock alerts</p>
                        <p className="text-xs text-white/50 mt-0.5">Get notified when inventory falls below reorder level</p>
                      </div>
                      <Toggle
                        checked={notifPrefs.notif_lowstock}
                        onChange={v => handleNotifChange('notif_lowstock', v)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-white">Daily summary</p>
                        <p className="text-xs text-white/50 mt-0.5">Receive a daily digest of sales and activity</p>
                      </div>
                      <Toggle
                        checked={notifPrefs.notif_daily}
                        onChange={v => handleNotifChange('notif_daily', v)}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-white/40">
                    Notification preferences are saved instantly and stored in this browser.
                  </p>
                </div>
              )}

              {/* ── Security tab ──────────────────────────────────────────── */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-white">Security</h2>

                  {/* ── Enrolled state ── */}
                  {mfaState.phase === 'enrolled' && (
                    <div className="space-y-4">
                      <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <CheckCircle className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-300">Two-Factor Authentication is active</p>
                          <p className="text-xs text-white/50 mt-0.5">
                            Your account is protected with a TOTP authenticator app.
                          </p>
                        </div>
                      </div>

                      {mfaError && (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                          {mfaError}
                        </p>
                      )}

                      {!showDisableConfirm ? (
                        <button
                          onClick={() => { setShowDisableConfirm(true); setMfaError(null); }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm hover:bg-red-500/20 transition-colors"
                        >
                          <ShieldOff className="h-4 w-4" />
                          Disable 2FA
                        </button>
                      ) : (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
                          <p className="text-sm font-medium text-red-300">
                            Are you sure you want to disable two-factor authentication?
                          </p>
                          <p className="text-xs text-white/50">
                            Your account will no longer require a second verification step.
                          </p>
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={() => void handleDisable2FA()}
                              disabled={mfaLoading}
                              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              {mfaLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                              Yes, disable 2FA
                            </button>
                            <button
                              onClick={() => { setShowDisableConfirm(false); setMfaError(null); }}
                              disabled={mfaLoading}
                              className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Idle state (not enrolled) ── */}
                  {mfaState.phase === 'idle' && (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div className="flex items-start gap-3 mb-4">
                          <Shield className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-white">Two-Factor Authentication</p>
                            <p className="text-xs text-white/50 mt-1">
                              Add an extra layer of security. Use any authenticator app (Google Authenticator, Authy, 1Password).
                            </p>
                          </div>
                        </div>
                        {mfaError && (
                          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 mb-3">
                            {mfaError}
                          </p>
                        )}
                        <button
                          onClick={() => void handleStartEnroll()}
                          disabled={mfaLoading}
                          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {mfaLoading
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Shield className="h-4 w-4" />
                          }
                          Enable 2FA
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Enrolling state (QR shown) ── */}
                  {(mfaState.phase === 'enrolling' || mfaState.phase === 'verifying') && (
                    <div className="space-y-5">
                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                        <p className="text-sm font-medium text-white">
                          Step 1 — Scan this QR code with your authenticator app
                        </p>
                        {/* QR code */}
                        <div className="flex justify-center">
                          <div className="bg-white p-3 rounded-xl inline-block">
                            <img
                              src={mfaState.qrCode}
                              alt="TOTP QR Code"
                              className="h-44 w-44 block"
                            />
                          </div>
                        </div>
                        {/* Manual entry */}
                        <div className="text-center">
                          <p className="text-xs text-white/50 mb-1">Or enter this code manually:</p>
                          <code className="text-xs font-mono bg-slate-900 border border-white/20 text-indigo-300 rounded-lg px-3 py-1.5 tracking-widest select-all">
                            {mfaState.secret}
                          </code>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                        <p className="text-sm font-medium text-white">
                          Step 2 — Enter the 6-digit code from your app
                        </p>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={mfaCode}
                          onChange={e => { setMfaCode(e.target.value.replace(/\D/g, '')); setMfaError(null); }}
                          placeholder="000000"
                          className="w-full px-4 py-2.5 bg-slate-900 border border-white/20 rounded-xl text-white text-center text-xl tracking-widest placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                        {mfaError && (
                          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                            {mfaError}
                          </p>
                        )}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => void handleVerifyEnroll()}
                            disabled={mfaLoading || mfaCode.length !== 6}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-sky-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            {mfaLoading
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <CheckCircle className="h-4 w-4" />
                            }
                            Verify &amp; Enable
                          </button>
                          <button
                            onClick={() => void handleCancelEnroll()}
                            disabled={mfaLoading}
                            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
