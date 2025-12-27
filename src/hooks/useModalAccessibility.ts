import { useEffect, useRef } from "react";
import { ModalAccessibility } from "../utils/modalAccessibility";

export function useModalAccessibility(isOpen: boolean) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      // Initialize modal accessibility
      ModalAccessibility.initializeModal(modalRef.current);
      
      return () => {
        // Cleanup on unmount or close
        if (modalRef.current) {
          ModalAccessibility.closeModal(modalRef.current);
        }
      };
    }
  }, [isOpen]);

  return modalRef;
}

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      // Store current focus
      const previousFocus = document.activeElement as HTMLElement;
      
      // Get focusable elements
      const focusableElements = containerRef.current.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
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
          if (e.key === "Tab") {
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
        
        containerRef.current.addEventListener("keydown", handleTabKey);
        
        return () => {
          containerRef.current?.removeEventListener("keydown", handleTabKey);
          // Restore focus
          previousFocus?.focus();
        };
      }
    }
  }, [isActive]);

  return containerRef;
}
