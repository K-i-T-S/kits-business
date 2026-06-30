import { Building2, ChevronDown, Check, MapPin, Phone, Settings } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { useApp } from '../context/AppContext';
import { getStoresByTenant, setStoreContext } from '../utils/storeManager';

interface Store {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
}

export default function StoreSwitcher() {
  const { currentTenant } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);

  useEffect(() => {
    if (currentTenant) {
      void loadStores();
    }
  }, [currentTenant]);

  const loadStores = async () => {
    try {
      if (!currentTenant) return;
      const storeList = await getStoresByTenant(currentTenant.id);
      setStores(storeList || []);

      // Set default store if none selected
      if (storeList && storeList.length > 0 && !currentStore) {
        setCurrentStore(storeList[0]);
      }
    } catch (error) {
      console.error('Failed to load stores:', error);
    }
  };

  const handleStoreSwitch = async (store: Store) => {
    if (store.id === currentStore?.id) {
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      // Update store context in database
      await setStoreContext(store.id);

      setCurrentStore(store);
      toast.success(`Switched to ${store.name}`);
      setIsOpen(false);

      // Reload the page to ensure all data is refreshed
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch store:', error);
      toast.error('Failed to switch store');
    } finally {
      setLoading(false);
    }
  };

  if (!currentTenant || stores.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      {/* Current Store Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
        disabled={loading}
      >
        <Building2 className="h-4 w-4 text-white/70" />
        <div className="flex-1 text-start">
          <div className="text-sm font-medium text-white">{currentStore?.name || 'Select Store'}</div>
          <div className="text-xs text-white/60">{currentStore?.code || 'No store selected'}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <Building2 className="h-4 w-4" />
                Store Locations
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {stores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => { void handleStoreSwitch(store); }}
                  className={`w-full p-3 flex items-start gap-3 hover:bg-white/5 transition-all group ${
                    store.id === currentStore?.id ? 'bg-white/5' : ''
                  }`}
                  disabled={loading}
                >
                  <div className="flex-1 text-start">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-white">{store.name}</div>
                      {store.id === currentStore?.id && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40">
                        {store.code}
                      </span>
                      {store.address && (
                        <div className="flex items-center gap-1 text-xs text-white/40">
                          <MapPin className="h-3 w-3" />
                          {store.address}
                        </div>
                      )}
                    </div>
                    {store.phone && (
                      <div className="flex items-center gap-1 text-xs text-white/40 mt-1">
                        <Phone className="h-3 w-3" />
                        {store.phone}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {stores.length === 0 && (
              <div className="p-6 text-center text-white/60">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">No stores found</div>
              </div>
            )}

            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              >
                <Settings className="h-4 w-4" />
                Manage Stores
              </button>
            </div>
          </div>
        </>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-slate-900/50 rounded-lg flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}
