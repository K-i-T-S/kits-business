import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Info,
  Package,
  Settings,
  ShoppingCart,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  useNotifications,
  type AppNotification,
  type NotificationCategory,
  type NotificationSeverity,
} from '@/context/NotificationContext';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

function getCategoryIcon(category: NotificationCategory) {
  switch (category) {
    case 'inventory': return <Package className="h-4 w-4" />;
    case 'sales': return <ShoppingCart className="h-4 w-4" />;
    case 'employees': return <Users className="h-4 w-4" />;
    case 'finance': return <DollarSign className="h-4 w-4" />;
    case 'system': return <Settings className="h-4 w-4" />;
    case 'ai': return <Sparkles className="h-4 w-4" />;
  }
}

function getSeverityIcon(severity: NotificationSeverity) {
  switch (severity) {
    case 'error': return <AlertCircle className="h-4 w-4" />;
    case 'warning': return <AlertTriangle className="h-4 w-4" />;
    case 'success': return <CheckCircle2 className="h-4 w-4" />;
    case 'info': return <Info className="h-4 w-4" />;
  }
}

const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-500/20 text-red-400',
  success: 'bg-green-500/20 text-green-400',
};

const CATEGORY_ORDER: NotificationCategory[] = [
  'inventory', 'sales', 'finance', 'employees', 'system', 'ai',
];

function groupByCategory(
  notifications: AppNotification[],
): Array<[NotificationCategory, AppNotification[]]> {
  const map = new Map<NotificationCategory, AppNotification[]>();
  for (const n of notifications) {
    const existing = map.get(n.category);
    if (existing) {
      existing.push(n);
    } else {
      map.set(n.category, [n]);
    }
  }
  return CATEGORY_ORDER
    .filter(cat => map.has(cat))
    .map(cat => [cat, map.get(cat)!]);
}

interface NotificationRowProps {
  notification: AppNotification;
  onClose: () => void;
}

function NotificationRow({ notification, onClose }: NotificationRowProps) {
  const { markRead, dismiss } = useNotifications();
  const { t } = useTranslation();

  const timeLabel = useMemo(() => {
    const diff = Date.now() - notification.timestamp;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t('notifications.justNow');
    if (mins < 60) return t('notifications.minsAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('notifications.hoursAgo', { count: hrs });
    return t('notifications.daysAgo', { count: Math.floor(hrs / 24) });
  }, [notification.timestamp, t]);

  const handleClick = useCallback(() => {
    markRead(notification.id);
  }, [markRead, notification.id]);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dismiss(notification.id);
  }, [dismiss, notification.id]);

  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    markRead(notification.id);
    onClose();
  }, [markRead, notification.id, onClose]);

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors cursor-pointer ${
        !notification.read ? 'bg-indigo-500/5' : ''
      }`}
      onClick={handleClick}
      role="listitem"
    >
      <div
        className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${SEVERITY_COLORS[notification.severity]}`}
        aria-hidden="true"
      >
        {getSeverityIcon(notification.severity)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className={`text-sm font-medium leading-snug flex-1 ${notification.read ? 'text-white/60' : 'text-white'}`}>
            {notification.title}
          </p>
          {!notification.read && (
            <div className="mt-1.5 h-2 w-2 rounded-full bg-indigo-400 flex-shrink-0" aria-hidden="true" />
          )}
        </div>

        <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{notification.body}</p>

        <div className="flex items-center gap-3 mt-2">
          <span className="text-[11px] text-white/30">{timeLabel}</span>
          {notification.href && (
            <Link
              to={notification.href}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
              onClick={handleLinkClick}
            >
              {t('notifications.view')}
              <ExternalLink className="h-2.5 w-2.5 ms-0.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/30 hover:text-white/70 transition-all flex-shrink-0"
        aria-label={t('notifications.dismiss')}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const { t } = useTranslation();
  const { visibleNotifications, unreadCount, prefs, markAllRead, clearAll, updatePref } = useNotifications();

  const grouped = useMemo(() => groupByCategory(visibleNotifications), [visibleNotifications]);

  const categoryLabels: Record<NotificationCategory, string> = useMemo(() => ({
    inventory: t('notifications.category.inventory'),
    sales: t('notifications.category.sales'),
    employees: t('notifications.category.employees'),
    finance: t('notifications.category.finance'),
    system: t('notifications.category.system'),
    ai: t('notifications.category.ai'),
  }), [t]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-sm bg-slate-900 border-l border-white/10 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t('notifications.title')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">
              {t('notifications.title')}
            </h2>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                {t('notifications.markAllRead')}
              </button>
            )}
            {visibleNotifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-white/40 hover:text-white/70 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                {t('notifications.clearAll')}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors ms-1"
              aria-label={t('common.cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto" role="list" aria-label={t('notifications.title')}>
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
              <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-white/20" aria-hidden="true" />
              </div>
              <p className="text-white/60 font-medium text-sm">{t('notifications.empty')}</p>
              <p className="text-white/30 text-xs mt-1">{t('notifications.emptyDesc')}</p>
            </div>
          ) : (
            grouped.map(([category, items]) => (
              <Fragment key={category}>
                <div className="px-4 py-2 bg-white/3 border-b border-white/5 sticky top-0 z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/30" aria-hidden="true">
                      {getCategoryIcon(category)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      {categoryLabels[category]}
                    </span>
                    <span className="ms-auto text-[10px] text-white/20">{items.length}</span>
                  </div>
                </div>
                {items.map(n => (
                  <NotificationRow key={n.id} notification={n} onClose={onClose} />
                ))}
              </Fragment>
            ))
          )}
        </div>

        {/* Footer: category preferences */}
        <div className="border-t border-white/10 px-4 py-4 flex-shrink-0 bg-slate-900/95">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2.5">
            {t('notifications.preferences')}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORY_ORDER.map(cat => (
              <button
                key={cat}
                onClick={() => updatePref(cat, !prefs[cat])}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                  prefs[cat]
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : 'bg-white/5 border-white/10 text-white/30'
                }`}
                aria-pressed={prefs[cat]}
              >
                <span aria-hidden="true">{getCategoryIcon(cat)}</span>
                <span className="truncate">{categoryLabels[cat]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
