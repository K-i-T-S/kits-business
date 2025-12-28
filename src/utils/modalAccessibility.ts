import { FocusManager } from './accessibility';

export class ModalAccessibility {
  private static activeModal: HTMLElement | null = null;
  private static previousFocus: HTMLElement | null = null;

  /**
   * Initialize modal with proper accessibility
   */
  static initializeModal(modal: HTMLElement): void {
    // Store previously focused element
    this.previousFocus = document.activeElement as HTMLElement;

    // Set up modal accessibility
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Add focus trap
    this.trapFocus(modal);

    // Set active modal
    this.activeModal = modal;

    // Add escape key listener
    this.addEscapeListener(modal);

    // Announce to screen readers
    this.announceModalOpen(modal);
  }

  /**
   * Close modal with proper accessibility cleanup
   */
  static closeModal(modal: HTMLElement): void {
    // Remove focus trap
    this.releaseFocus();

    // Restore focus to previous element
    if (this.previousFocus) {
      this.previousFocus.focus();
    }

    // Clear active modal
    this.activeModal = null;

    // Announce modal closed
    this.announceModalClose(modal);
  }

  /**
   * Trap focus within modal
   */
  private static trapFocus(modal: HTMLElement): void {
    const focusableElements = FocusManager.getFocusableElements(modal);

    if (focusableElements.length > 0) {
      // Focus first element
      const firstElement = focusableElements[0];
      if (firstElement) {
        firstElement.focus();
      }

      // Add tab key listener
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          FocusManager.handleTabKey(e, modal);
        }
      };

      modal.addEventListener('keydown', handleTabKey);

      // Store listener for cleanup
      (modal as any)._tabKeyListener = handleTabKey;
    }
  }

  /**
   * Release focus trap
   */
  private static releaseFocus(): void {
    if (this.activeModal && (this.activeModal as any)._tabKeyListener) {
      this.activeModal.removeEventListener('keydown', (this.activeModal as any)._tabKeyListener);
      delete (this.activeModal as any)._tabKeyListener;
    }
  }

  /**
   * Add escape key listener
   */
  private static addEscapeListener(modal: HTMLElement): void {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Find close button or trigger close
        const closeButton = modal.querySelector('[aria-label="Close"], .close-button, button[onclick*="close"]');
        if (closeButton) {
          (closeButton as HTMLElement).click();
        }
      }
    };

    modal.addEventListener('keydown', handleEscape);

    // Store listener for cleanup
    (modal as any)._escapeListener = handleEscape;
  }

  /**
   * Announce modal open to screen readers
   */
  private static announceModalOpen(modal: HTMLElement): void {
    const title = modal.querySelector("h1, h2, h3, [role='heading']");
    const titleText = title ? title.textContent : 'Dialog';

    // Create live region announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `${titleText} dialog opened`;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  }

  /**
   * Announce modal close to screen readers
   */
  private static announceModalClose(modal: HTMLElement): void {
    const title = modal.querySelector("h1, h2, h3, [role='heading']");
    const titleText = title ? title.textContent : 'Dialog';

    // Create live region announcement
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = `${titleText} dialog closed`;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);
  }

  /**
   * Check if modal is properly trapped
   */
  static isModalProperlyTrapped(modal: HTMLElement): boolean {
    const hasRole = modal.getAttribute('role') === 'dialog';
    const hasAriaModal = modal.getAttribute('aria-modal') === 'true';
    const hasFocusableElements = FocusManager.getFocusableElements(modal).length > 0;

    return hasRole && hasAriaModal && hasFocusableElements;
  }
}
