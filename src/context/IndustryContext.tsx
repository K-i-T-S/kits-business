import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { INDUSTRIES, INDUSTRY_VERTICAL_FEATURES } from '../types/industry';
import type { Industry, VerticalFeature } from '../types/industry';

import { useApp } from './AppContext';

interface IndustryContextType {
  industry: Industry | null;
  hasVerticalFeature: (feature: VerticalFeature) => boolean;
}

const IndustryContext = createContext<IndustryContextType | undefined>(undefined);

export function IndustryProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useApp();

  const industry = useMemo<Industry | null>(() => {
    const raw = currentTenant?.industry;
    if (!raw) return null;
    const normalized = raw.toLowerCase() as Industry;
    return (INDUSTRIES as readonly string[]).includes(normalized) ? normalized : null;
  }, [currentTenant?.industry]);

  const hasVerticalFeature = useCallback(
    (feature: VerticalFeature): boolean => {
      if (!industry) return false;
      return INDUSTRY_VERTICAL_FEATURES[industry].includes(feature);
    },
    [industry],
  );

  return (
    <IndustryContext.Provider value={{ industry, hasVerticalFeature }}>
      {children}
    </IndustryContext.Provider>
  );
}

export function useIndustry(): IndustryContextType {
  const ctx = useContext(IndustryContext);
  if (!ctx) throw new Error('useIndustry must be used within IndustryProvider');
  return ctx;
}
