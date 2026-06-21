import { AlertTriangle, Package, Calendar } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/context/AppContext';
import type { GroceryLot, SupermarketDepartment } from '@/types/supermarket';
import {
  getDaysUntilExpiry,
  getExpiryStatus,
  EXPIRY_STATUS_CONFIG,
} from '@/types/supermarket';
import { supabase } from '@/utils/supabaseClient';

interface EnrichedLot extends GroceryLot {
  daysLeft: number;
  status: 'expired' | 'critical' | 'warning' | 'ok';
  markdownPct: number;
}

export default function ExpiryDashboard() {
  const { t } = useTranslation();
  const { currentTenant } = useApp();
  const tenantId = currentTenant?.id;

  const [lots, setLots] = useState<EnrichedLot[]>([]);
  const [departments, setDepartments] = useState<SupermarketDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const loadLots = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [lotsResult, deptsResult] = await Promise.all([
        supabase.from('grocery_lots').select('*, products(name)').eq('tenant_id', tenantId).gt('quantity_remaining', 0).lte('expiry_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase.from('supermarket_departments').select('*').eq('tenant_id', tenantId),
      ]);

      const rawLots = (lotsResult.data ?? []) as (GroceryLot & { products?: { name: string } })[];
      const enriched: EnrichedLot[] = rawLots.map(lot => {
        const daysLeft = getDaysUntilExpiry(lot.expiry_date);
        const status = getExpiryStatus(daysLeft);
        return {
          ...lot,
          product_name: lot.products?.name ?? lot.product_id,
          daysLeft,
          status,
          markdownPct: EXPIRY_STATUS_CONFIG[status].markdownPct,
        };
      }).sort((a, b) => a.daysLeft - b.daysLeft);

      setLots(enriched);
      setDepartments((deptsResult.data ?? []) as SupermarketDepartment[]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void loadLots(); }, [loadLots]);

  const filtered = deptFilter === 'all' ? lots : lots.filter(l => l.department_id === deptFilter);

  const counts = {
    expired: lots.filter(l => l.status === 'expired').length,
    critical: lots.filter(l => l.status === 'critical').length,
    warning: lots.filter(l => l.status === 'warning').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <div className="text-red-400 text-xl font-bold">{counts.expired}</div>
          <div className="text-red-400/70 text-xs">{t('supermarket.expired', 'Expired')}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
          <div className="text-orange-400 text-xl font-bold">{counts.critical}</div>
          <div className="text-orange-400/70 text-xs">{t('supermarket.expiry1to3', '1–3 Days')}</div>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
          <div className="text-yellow-400 text-xl font-bold">{counts.warning}</div>
          <div className="text-yellow-400/70 text-xs">{t('supermarket.expiry4to7', '4–7 Days')}</div>
        </div>
      </div>

      {/* Department filter */}
      {departments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setDeptFilter('all')}
            className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              deptFilter === 'all' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/50 hover:text-white/80 border border-white/10'
            }`}
          >
            {t('supermarket.allDepts', 'All Departments')}
          </button>
          {departments.map(d => (
            <button
              key={d.id}
              onClick={() => setDeptFilter(d.id)}
              className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                deptFilter === d.id ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-white/50 hover:text-white/80 border border-white/10'
              }`}
            >
              {d.emoji} {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Lot list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-white/40">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>{t('supermarket.noExpiryAlerts', 'All clear — no expiry alerts')}</p>
          <p className="text-xs mt-1">{t('supermarket.noExpiryAlertsSub', 'All lots have more than 30 days remaining')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lot => {
            const cfg = EXPIRY_STATUS_CONFIG[lot.status];
            const dept = departments.find(d => d.id === lot.department_id);
            return (
              <div key={lot.id} className={`flex items-center justify-between p-3 rounded-xl border ${cfg.bg}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-none">
                    {lot.status === 'expired' ? (
                      <AlertTriangle className={`w-4 h-4 ${cfg.color}`} />
                    ) : (
                      <Calendar className={`w-4 h-4 ${cfg.color}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{lot.product_name}</div>
                    <div className="text-white/50 text-xs">
                      {t('supermarket.lotLabel', 'Lot: {{lot}}', { lot: lot.lot_number })}
                      {dept && ` · ${dept.emoji} ${dept.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex-none flex items-center gap-3 ml-2">
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${cfg.color}`}>
                      {lot.status === 'expired'
                        ? t('supermarket.expiredDaysAgo', '{{n}}d ago', { n: Math.abs(lot.daysLeft) })
                        : t('supermarket.daysLeft', '{{n}}d left', { n: lot.daysLeft })}
                    </div>
                    <div className="text-white/40 text-xs">
                      <Package className="w-3 h-3 inline mr-0.5" />
                      {lot.quantity_remaining} {t('supermarket.units', 'units')}
                    </div>
                  </div>
                  {lot.markdownPct > 0 && (
                    <div className="bg-white/10 rounded-lg px-2 py-1 text-center">
                      <div className={`text-xs font-bold ${cfg.color}`}>−{lot.markdownPct}%</div>
                      <div className="text-white/40 text-[10px]">{t('supermarket.markdown', 'markdown')}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
