import React, { forwardRef, useCallback } from 'react';

import { useAccessibility } from '../../providers/AccessibilityProvider';

interface AccessibleToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const AccessibleToggle = forwardRef<HTMLButtonElement, AccessibleToggleProps>(
  ({ checked, onChange, label, description, disabled = false, id, className = '' }, ref) => {
    const { announce } = useAccessibility();

    const handleClick = useCallback(() => {
      if (!disabled) {
        const newChecked = !checked;
        onChange(newChecked);
        announce(`${label} ${newChecked ? 'enabled' : 'disabled'}`, 'polite');
      }
    }, [checked, onChange, label, disabled, announce]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    }, [handleClick]);

    const toggleId = id || `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

    return (
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label
            htmlFor={toggleId}
            className="text-sm font-medium text-gray-700 cursor-pointer"
          >
            {label}
          </label>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <button
          ref={ref}
          id={toggleId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${label} ${checked ? 'enabled' : 'disabled'}`}
          disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${checked ? 'bg-indigo-500' : 'bg-gray-200'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
            ${className}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${checked ? 'translate-x-6' : 'translate-x-1'}
            `}
            aria-hidden="true"
          />
        </button>
      </div>
    );
  },
);

AccessibleToggle.displayName = 'AccessibleToggle';

export default AccessibleToggle;
