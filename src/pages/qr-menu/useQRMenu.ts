import { useState, useEffect } from 'react';

import { supabase } from '@/utils/supabaseClient';
import type { QRMenuData } from '@/types/restaurant';

interface UseQRMenuResult {
  data: QRMenuData | null;
  loading: boolean;
  error: string | null;
}

export function useQRMenu(tenantSlug: string): UseQRMenuResult {
  const [data, setData] = useState<QRMenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;

    const fetchMenu = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_public_menu', {
          p_tenant_slug: tenantSlug,
        });

        if (rpcError) {
          setError(rpcError.message);
          return;
        }

        const result = rpcData as { error?: string } & QRMenuData;
        if (result?.error === 'not_found') {
          setError('Menu not found');
          return;
        }

        setData(result as QRMenuData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load menu');
      } finally {
        setLoading(false);
      }
    };

    void fetchMenu();
  }, [tenantSlug]);

  return { data, loading, error };
}
