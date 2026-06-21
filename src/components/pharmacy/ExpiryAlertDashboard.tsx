import { AlertTriangle, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { Drug, DrugLot } from '@/types/pharmacy';

interface Props {
  lots: DrugLot[];
  drugs: Drug[];
  onRefresh: () => void;
}

interface AlertItem {
  lot: DrugLot;
  drug: Drug;
  daysRemaining: number;
  status: 'expired' | 'critical' | 'warning' | 'ok';
}

export default function ExpiryAlertDashboard({ lots, drugs, onRefresh }: Props) {
  const { t } = useTranslation();

  const drugMap = useMemo(() => new Map(drugs.map(d => [d.id, d])), [drugs]);

  const alerts = useMemo<AlertItem[]>(() => {
    const now = new Date();
    return lots
      .filter(lot => lot.quantity_remaining > 0)
      .map(lot => {
        const exp = new Date(lot.expiry_date);
        const daysRemaining = Math.floor((exp.getTime() - now.getTime()) / 86400000);
        let status: AlertItem['status'] = 'ok';
        if (daysRemaining < 0) status = 'expired';
        else if (daysRemaining <= 7) status = 'critical';
        else if (daysRemaining <= 30) status = 'warning';
        return { lot, drug: drugMap.get(lot.drug_id)!, daysRemaining, status };
      })
      .filter(a => a.drug && a.status !== 'ok')
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [lots, drugMap]);

  const expired = alerts.filter(a => a.status === 'expired');
  const critical = alerts.filter(a => a.status === 'critical');
  const warning = alerts.filter(a => a.status === 'warning');

  if (alerts.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <p className="text-white font-medium">{t('pharmacy.noExpiryAlerts', 'All clear — no expiry alerts')}</p>
        <p className="text-white/40 text-sm mt-1">{t('pharmacy.noExpiryAlertsDesc', 'All lots have more than 30 days remaining')}</p>
        <button
          onClick={onRefresh}
          className="mt-4 flex items-center gap-2 mx-auto text-white/50 hover:text-white text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{expired.length}</div>
          <div className="text-red-400/80 text-sm mt-0.5">{t('pharmacy.expired', 'Expired')}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-400">{critical.length}</div>
          <div className="text-orange-400/80 text-sm mt-0.5">{t('pharmacy.within7Days', 'Within 7 Days')}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-400">{warning.length}</div>
          <div className="text-amber-400/80 text-sm mt-0.5">{t('pharmacy.within30Days', 'Within 30 Days')}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">{t('pharmacy.expiryAlertList', 'Lots Requiring Attention')}</h3>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      <div className="space-y-2">
        {alerts.map(alert => (
          <div
            key={alert.lot.id}
            className={`flex items-center justify-between p-4 rounded-xl border ${
              alert.status === 'expired'
                ? 'bg-red-500/10 border-red-500/30'
                : alert.status === 'critical'
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3">
              {alert.status === 'expired' ? (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              ) : (
                <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.status === 'critical' ? 'text-orange-400' : 'text-amber-400'}`} />
              )}
              <div>
                <div className="text-white font-medium text-sm">{alert.drug.trade_name}</div>
                <div className="text-white/50 text-xs mt-0.5">
                  {t('pharmacy.lotLabel', 'Lot: {{lot}}', { lot: alert.lot.lot_number })} · {alert.lot.quantity_remaining} {t('pharmacy.units', 'units')}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-medium text-sm ${
                alert.status === 'expired' ? 'text-red-400' :
                  alert.status === 'critical' ? 'text-orange-400' : 'text-amber-400'
              }`}>
                {alert.status === 'expired'
                  ? t('pharmacy.expiredDaysAgo', '{{days}}d ago', { days: Math.abs(alert.daysRemaining) })
                  : t('pharmacy.daysLeft', '{{days}}d left', { days: alert.daysRemaining })}
              </div>
              <div className="text-white/40 text-xs mt-0.5">{alert.lot.expiry_date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
