import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { INDUSTRY_CONFIGS } from '@/types/industry';
import type { Industry } from '@/types/industry';

interface IndustrySelectorProps {
  value: Industry | '';
  onChange: (value: Industry) => void;
  disabled?: boolean;
}

export default function IndustrySelector({ value, onChange, disabled = false }: IndustrySelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {INDUSTRY_CONFIGS.map((config) => {
        const selected = value === config.key;
        return (
          <button
            key={config.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(config.key)}
            className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? `bg-gradient-to-br ${config.gradient} ${config.borderColor} shadow-lg`
                : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
            }`}
            aria-pressed={selected}
          >
            {selected && (
              <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <span className="text-2xl leading-none" aria-hidden="true">
              {config.emoji}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-snug ${selected ? 'text-white' : 'text-white/80'}`}>
                {t(config.labelKey, config.labelFallback)}
              </p>
              <p className={`mt-0.5 text-xs leading-snug ${selected ? 'text-white/70' : 'text-white/40'}`}>
                {t(config.descriptionKey, config.descriptionFallback)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
