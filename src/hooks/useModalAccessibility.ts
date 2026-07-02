import { useEffect, useRef } from 'react';

import { ModalAccessibility } from '../utils/modalAccessibility';

export function useModalAccessibility(isOpen: boolean) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = modalRef.current;
    if (isOpen && el) {
      // Initialize modal accessibility
      ModalAccessibility.initializeModal(el);

      return () => {
        // Cleanup on unmount or close
        ModalAccessibility.closeModal(el);
      };
    }
  }, [isOpen]);

  return modalRef;
}

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (isActive && container) {
      // Store current focus
      const previousFocus = document.activeElement as HTMLElement;

      // Get focusable elements
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) as NodeListOf<HTMLElement>;

      if (focusableElements.length > 0) {
        // Focus first element
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (firstElement) {
          firstElement.focus();
        }

        // Handle tab key
        const handleTabKey = (e: KeyboardEvent) => {
          if (e.key === 'Tab') {
            if (firstElement && lastElement) {
              if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                  e.preventDefault();
                  lastElement.focus();
                }
              } else {
                if (document.activeElement === lastElement) {
                  e.preventDefault();
                  firstElement.focus();
                }
              }
            }
          }
        };

        container.addEventListener('keydown', handleTabKey);

        return () => {
          container.removeEventListener('keydown', handleTabKey);
          // Restore focus
          previousFocus?.focus();
        };
      }
    }
  }, [isActive]);

  return containerRef;
}
