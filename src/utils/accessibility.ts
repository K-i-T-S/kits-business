/**
 * Accessibility Utilities
 * Provides comprehensive accessibility features for WCAG 2.1 AA compliance
 */

export const AccessibilityConstants = {
  // ARIA roles
  ROLES: {
    MAIN: 'main',
    NAVIGATION: 'navigation',
    BANNER: 'banner',
    CONTENTINFO: 'contentinfo',
    COMPLEMENTARY: 'complementary',
    SEARCH: 'search',
    DIALOG: 'dialog',
    ALERT: 'alert',
    STATUS: 'status',
    TIMER: 'timer',
    MARQUEE: 'marquee',
    LOG: 'log',
    REGION: 'region',
    ARTICLE: 'article',
    GROUP: 'group',
    LIST: 'list',
    LISTITEM: 'listitem',
    GRID: 'grid',
    GRIDCELL: 'gridcell',
    ROW: 'row',
    ROWGROUP: 'rowgroup',
    COLUMNHEADER: 'columnheader',
    ROWHEADER: 'rowheader',
    TABLIST: 'tablist',
    TAB: 'tab',
    TABPANEL: 'tabpanel',
    TOOLBAR: 'toolbar',
    MENU: 'menu',
    MENUBAR: 'menubar',
    MENUITEM: 'menuitem',
    MENUITEMCHECKBOX: 'menuitemcheckbox',
    MENUITEMRADIO: 'menuitemradio',
    OPTION: 'option',
    SELECT: 'select',
    COMBOBOX: 'combobox',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    RADIOGROUP: 'radiogroup',
    TEXTBOX: 'textbox',
    SPINBUTTON: 'spinbutton',
    SLIDER: 'slider',
    SWITCH: 'switch',
    BUTTON: 'button',
    LINK: 'link',
    IMG: 'img',
    HEADING: 'heading',
    NONE: 'none',
    PRESENTATION: 'presentation'
  } as const,

  // ARIA properties
  PROPERTIES: {
    LABEL: 'aria-label',
    LABELLEDBY: 'aria-labelledby',
    DESCRIBEDBY: 'aria-describedby',
    REQUIRED: 'aria-required',
    INVALID: 'aria-invalid',
    EXPANDED: 'aria-expanded',
    SELECTED: 'aria-selected',
    CHECKED: 'aria-checked',
    PRESSED: 'aria-pressed',
    DISABLED: 'aria-disabled',
    READONLY: 'aria-readonly',
    MULTILINE: 'aria-multiline',
    MULTSELECTABLE: 'aria-multiselectable',
    ORIENTATION: 'aria-orientation',
    SORT: 'aria-sort',
    LIVE: 'aria-live',
    ATOMIC: 'aria-atomic',
    RELEVANT: 'aria-relevant',
    BUSY: 'aria-busy',
    DROPEFFECT: 'aria-dropeffect',
    DRAGGED: 'aria-dragged',
    HASPOPUP: 'aria-haspopup',
    CONTROLS: 'aria-controls',
    AUTOCOMPLETE: 'aria-autocomplete',
    VALUEMIN: 'aria-valuemin',
    VALUEMAX: 'aria-valuemax',
    VALUENOW: 'aria-valuenow',
    VALUETEXT: 'aria-valuetext',
    POSINSET: 'aria-posinset',
    SETSIZE: 'aria-setsize',
    FLOWTO: 'aria-flowto',
    OWNED: 'aria-owns',
    ACTIVEDESCENDANT: 'aria-activedescendant',
    LEVEL: 'aria-level'
  } as const,

  // Live regions
  LIVE_REGIONS: {
    OFF: 'off',
    POLITE: 'polite',
    ASSERTIVE: 'assertive'
  } as const,

  // Keyboard navigation
  KEYS: {
    TAB: 'Tab',
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    HOME: 'Home',
    END: 'End',
    PAGE_UP: 'PageUp',
    PAGE_DOWN: 'PageDown'
  } as const,

  // Focus management
  TRAPS: {
    NONE: 'none',
    TAB: 'tab',
    MODAL: 'modal'
  } as const
};

// Focus management utilities
export class FocusManager {
  private static focusableElements: HTMLElement[] = [];
  private static previousFocus: HTMLElement | null = null;

  /**
   * Get all focusable elements within a container
   */
  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      'area[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'summary',
      'iframe',
      'embed',
      'object'
    ].join(', ');

    return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
  }

  /**
   * Trap focus within a container (for modals, dropdowns, etc.)
   */
  static trapFocus(container: HTMLElement): void {
    this.focusableElements = this.getFocusableElements(container);
    this.previousFocus = document.activeElement as HTMLElement;
    
    if (this.focusableElements.length > 0) {
      this.focusableElements[0]?.focus();
    }
  }

  /**
   * Release focus trap and restore previous focus
   */
  static releaseFocus(): void {
    if (this.previousFocus) {
      this.previousFocus.focus();
      this.previousFocus = null;
    }
    this.focusableElements = [];
  }

  /**
   * Handle tab key navigation within a focus trap
   */
  static handleTabKey(event: KeyboardEvent, container: HTMLElement): void {
    if (event.key !== 'Tab') return;

    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }
}

// Screen reader announcements
export class ScreenReaderAnnouncer {
  private static announcementElement: HTMLElement | null = null;

  /**
   * Initialize the announcer
   */
  static initialize(): void {
    if (!this.announcementElement) {
      this.announcementElement = document.createElement('div');
      this.announcementElement.setAttribute('aria-live', 'polite');
      this.announcementElement.setAttribute('aria-atomic', 'true');
      this.announcementElement.className = 'sr-only';
      document.body.appendChild(this.announcementElement);
    }
  }

  /**
   * Announce a message to screen readers
   */
  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.initialize();
    
    if (this.announcementElement) {
      this.announcementElement.setAttribute('aria-live', priority);
      this.announcementElement.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (this.announcementElement) {
          this.announcementElement.textContent = '';
        }
      }, 1000);
    }
  }
}

// Keyboard navigation utilities
export class KeyboardNavigation {
  /**
   * Check if a key is a navigation key
   */
  static isNavigationKey(key: string): boolean {
    const navigationKeys = [
      'Tab',
      'Enter',
      ' ',
      'Escape',
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      'PageUp',
      'PageDown'
    ];
    return navigationKeys.includes(key as any);
  }

  /**
   * Handle keyboard navigation for lists/grids
   */
  static handleListNavigation(
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    orientation: 'horizontal' | 'vertical' = 'vertical'
  ): number {
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        newIndex = (currentIndex + 1) % items.length;
        break;
      
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
        break;
      
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      
      case 'End':
        event.preventDefault();
        newIndex = items.length - 1;
        break;
    }

    if (newIndex !== currentIndex && items[newIndex]) {
      items[newIndex]?.focus();
    }

    return newIndex;
  }
}

// High contrast mode utilities
export class HighContrastMode {
  private static isHighContrast = false;

  /**
   * Check if high contrast mode is enabled
   */
  static isEnabled(): boolean {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-contrast: high)').matches ||
             window.matchMedia('(prefers-color-scheme: contrast)').matches;
    }
    return false;
  }

  /**
   * Toggle high contrast mode
   */
  static toggle(): void {
    this.isHighContrast = !this.isHighContrast;
    document.documentElement.setAttribute('data-high-contrast', this.isHighContrast.toString());
    
    // Announce to screen readers
    ScreenReaderAnnouncer.announce(
      `High contrast mode ${this.isHighContrast ? 'enabled' : 'disabled'}`,
      'polite'
    );
  }

  /**
   * Enable high contrast mode
   */
  static enable(): void {
    this.isHighContrast = true;
    document.documentElement.setAttribute('data-high-contrast', 'true');
    ScreenReaderAnnouncer.announce('High contrast mode enabled', 'polite');
  }

  /**
   * Disable high contrast mode
   */
  static disable(): void {
    this.isHighContrast = false;
    document.documentElement.setAttribute('data-high-contrast', 'false');
    ScreenReaderAnnouncer.announce('High contrast mode disabled', 'polite');
  }
}

// Skip links utilities
export class SkipLinks {
  /**
   * Create skip links for keyboard navigation
   */
  static createSkipLinks(): HTMLElement {
    const skipLinksContainer = document.createElement('div');
    skipLinksContainer.className = 'skip-links';
    
    const skipLinks = [
      { href: '#main-content', text: 'Skip to main content' },
      { href: '#navigation', text: 'Skip to navigation' },
      { href: '#search', text: 'Skip to search' }
    ];

    skipLinks.forEach(link => {
      const skipLink = document.createElement('a');
      skipLink.href = link.href;
      skipLink.textContent = link.text;
      skipLink.className = 'skip-link';
      skipLinksContainer.appendChild(skipLink);
    });

    return skipLinksContainer;
  }
}

// Accessibility testing utilities
export class AccessibilityTester {
  /**
   * Check for missing alt text on images
   */
  static checkMissingAltText(): HTMLElement[] {
    const images = document.querySelectorAll('img');
    const missingAlt: HTMLElement[] = [];
    
    images.forEach(img => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        missingAlt.push(img as HTMLElement);
      }
    });
    
    return missingAlt;
  }

  /**
   * Check for missing labels on form inputs
   */
  static checkMissingLabels(): HTMLElement[] {
    const inputs = document.querySelectorAll('input, select, textarea');
    const missingLabels: HTMLElement[] = [];
    
    inputs.forEach(input => {
      const hasLabel = document.querySelector(`label[for="${input.id}"]`) ||
                      input.getAttribute('aria-label') ||
                      input.getAttribute('aria-labelledby');
      
      if (!hasLabel) {
        missingLabels.push(input as HTMLElement);
      }
    });
    
    return missingLabels;
  }

  /**
   * Check for proper heading structure
   */
  static checkHeadingStructure(): { issues: string[], headings: HTMLElement[] } {
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const issues: string[] = [];
    let lastLevel = 0;

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (index === 0 && level !== 1) {
        issues.push(`First heading should be h1, found h${level}`);
      }
      
      if (level > lastLevel + 1) {
        issues.push(`Heading level skipped: h${lastLevel} to h${level}`);
      }
      
      lastLevel = level;
    });

    return { issues, headings: Array.from(headings) as HTMLElement[] };
  }
}

// Accessibility context type definition
export interface AccessibilityContextType {
  isHighContrast: boolean;
  isKeyboardNav: boolean;
  reducedMotion: boolean;
  focusVisible: boolean;
  toggleHighContrast: () => void;
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  trapFocus: (container: HTMLElement) => void;
  releaseFocus: () => void;
  handleListNavigation: (
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    orientation?: 'horizontal' | 'vertical'
  ) => number;
  getFocusableElements: (container: HTMLElement) => HTMLElement[];
  setAriaAttribute: (element: HTMLElement, attribute: string, value: string | boolean | null) => void;
  setRole: (element: HTMLElement, role: string | null) => void;
  isFocusable: (element: HTMLElement) => boolean;
  focusElement: (element: HTMLElement | null) => void;
  constants: typeof AccessibilityConstants;
}

export default {
  AccessibilityConstants,
  FocusManager,
  ScreenReaderAnnouncer,
  KeyboardNavigation,
  HighContrastMode,
  SkipLinks,
  AccessibilityTester
};
