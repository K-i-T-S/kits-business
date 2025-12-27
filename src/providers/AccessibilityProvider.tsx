import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  FocusManager, 
  ScreenReaderAnnouncer, 
  KeyboardNavigation, 
  HighContrastMode,
  AccessibilityConstants,
  type AccessibilityContextType 
} from '../utils/accessibility';

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  // Initialize accessibility features
  useEffect(() => {
    // Check for high contrast mode preference
    const checkHighContrast = () => {
      const enabled = HighContrastMode.isEnabled();
      setIsHighContrast(enabled);
      if (enabled) {
        HighContrastMode.enable();
      }
    };

    // Check for reduced motion preference
    const checkReducedMotion = () => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setReducedMotion(prefersReduced);
    };

    // Initialize screen reader announcer
    ScreenReaderAnnouncer.initialize();

    // Check preferences and set up listeners
    checkHighContrast();
    checkReducedMotion();

    // Listen for preference changes
    const highContrastMedia = window.matchMedia('(prefers-contrast: high)');
    const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
      if (e.matches) {
        HighContrastMode.enable();
      } else {
        HighContrastMode.disable();
      }
    };

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    highContrastMedia.addEventListener('change', handleHighContrastChange);
    reducedMotionMedia.addEventListener('change', handleReducedMotionChange);

    // Keyboard navigation detection
    const handleKeyDown = (e: KeyboardEvent) => {
      if (KeyboardNavigation.isNavigationKey(e.key)) {
        setIsKeyboardNav(true);
        setFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardNav(false);
      setFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      highContrastMedia.removeEventListener('change', handleHighContrastChange);
      reducedMotionMedia.removeEventListener('change', handleReducedMotionChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Toggle high contrast mode
  const toggleHighContrast = useCallback(() => {
    HighContrastMode.toggle();
    setIsHighContrast(!isHighContrast);
  }, [isHighContrast]);

  // Announce message to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    ScreenReaderAnnouncer.announce(message, priority);
  }, []);

  // Trap focus within a container
  const trapFocus = useCallback((container: HTMLElement) => {
    FocusManager.trapFocus(container);
  }, []);

  // Release focus trap
  const releaseFocus = useCallback(() => {
    FocusManager.releaseFocus();
  }, []);

  // Handle keyboard navigation for lists
  const handleListNavigation = useCallback((
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    orientation: 'horizontal' | 'vertical' = 'vertical'
  ) => {
    return KeyboardNavigation.handleListNavigation(event, items, currentIndex, orientation);
  }, []);

  // Get focusable elements within a container
  const getFocusableElements = useCallback((container: HTMLElement) => {
    return FocusManager.getFocusableElements(container);
  }, []);

  // Set ARIA attributes safely
  const setAriaAttribute = useCallback((
    element: HTMLElement,
    attribute: string,
    value: string | boolean | null
  ) => {
    if (value === null || value === undefined) {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, String(value));
    }
  }, []);

  // Set role safely
  const setRole = useCallback((element: HTMLElement, role: string | null) => {
    if (role === null || role === undefined) {
      element.removeAttribute('role');
    } else {
      element.setAttribute('role', role);
    }
  }, []);

  // Check if element is focusable
  const isFocusable = useCallback((element: HTMLElement): boolean => {
    return FocusManager.getFocusableElements(document.body).includes(element);
  }, []);

  // Focus element safely
  const focusElement = useCallback((element: HTMLElement | null) => {
    if (element && isFocusable(element)) {
      element.focus();
    }
  }, [isFocusable]);

  const contextValue: AccessibilityContextType = {
    isHighContrast,
    isKeyboardNav,
    reducedMotion,
    focusVisible,
    toggleHighContrast,
    announce,
    trapFocus,
    releaseFocus,
    handleListNavigation,
    getFocusableElements,
    setAriaAttribute,
    setRole,
    isFocusable,
    focusElement,
    constants: AccessibilityConstants
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      <div 
        className={`accessibility-root ${isKeyboardNav ? 'keyboard-nav' : ''} ${focusVisible ? 'focus-visible' : ''}`}
        data-high-contrast={isHighContrast}
        data-reduced-motion={reducedMotion}
        data-keyboard-nav={isKeyboardNav}
      >
        {children}
      </div>
    </AccessibilityContext.Provider>
  );
}

// Export types for TypeScript
export type { AccessibilityContextType };
