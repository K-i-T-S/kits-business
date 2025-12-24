// Responsive utilities and breakpoints for consistent design across the application

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export type Breakpoint = keyof typeof breakpoints;

// Responsive spacing values
export const spacing = {
  padding: {
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  },
  margin: {
    xs: 'm-2',
    sm: 'm-3',
    md: 'm-4',
    lg: 'm-6',
    xl: 'm-8',
  },
  gap: {
    xs: 'gap-2',
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  },
} as const;

// Responsive grid utilities
export const gridCols = {
  auto: 'grid-cols-auto',
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
} as const;

export const responsiveGridCols = {
  sm: {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'sm:grid-cols-6',
    12: 'sm:grid-cols-12',
  },
  md: {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    12: 'md:grid-cols-12',
  },
  lg: {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
    12: 'lg:grid-cols-12',
  },
  xl: {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
    12: 'xl:grid-cols-12',
  },
} as const;

// Responsive text utilities
export const textSizes = {
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
} as const;

export const responsiveTextSizes = {
  sm: {
    xs: 'sm:text-xs',
    sm: 'sm:text-sm',
    base: 'sm:text-base',
    lg: 'sm:text-lg',
    xl: 'sm:text-xl',
    '2xl': 'sm:text-2xl',
    '3xl': 'sm:text-3xl',
    '4xl': 'sm:text-4xl',
  },
  md: {
    xs: 'md:text-xs',
    sm: 'md:text-sm',
    base: 'md:text-base',
    lg: 'md:text-lg',
    xl: 'md:text-xl',
    '2xl': 'md:text-2xl',
    '3xl': 'md:text-3xl',
    '4xl': 'md:text-4xl',
  },
  lg: {
    xs: 'lg:text-xs',
    sm: 'lg:text-sm',
    base: 'lg:text-base',
    lg: 'lg:text-lg',
    xl: 'lg:text-xl',
    '2xl': 'lg:text-2xl',
    '3xl': 'lg:text-3xl',
    '4xl': 'lg:text-4xl',
  },
  xl: {
    xs: 'xl:text-xs',
    sm: 'xl:text-sm',
    base: 'xl:text-base',
    lg: 'xl:text-lg',
    xl: 'xl:text-xl',
    '2xl': 'xl:text-2xl',
    '3xl': 'xl:text-3xl',
    '4xl': 'xl:text-4xl',
  },
} as const;

// Responsive utility functions
export const getResponsiveClasses = (
  base: string,
  sm?: string,
  md?: string,
  lg?: string,
  xl?: string
) => {
  const classes = [base];
  if (sm) classes.push(sm);
  if (md) classes.push(md);
  if (lg) classes.push(lg);
  if (xl) classes.push(xl);
  return classes.join(' ');
};

// Common responsive patterns
export const patterns = {
  // Card layouts
  cardGrid: (cols: number = 4) => getResponsiveClasses(
    'grid-cols-1',
    'sm:grid-cols-2',
    'md:grid-cols-3',
    `lg:grid-cols-${Math.min(cols, 4)}`,
    `xl:grid-cols-${cols}`
  ),
  
  // Stats cards
  statsGrid: (cols: number = 4) => getResponsiveClasses(
    'grid-cols-2',
    'sm:grid-cols-2',
    'md:grid-cols-3',
    `lg:grid-cols-${Math.min(cols, 4)}`,
    `xl:grid-cols-${cols}`
  ),
  
  // Headers
  header: getResponsiveClasses(
    'text-xl',
    'sm:text-xl',
    'md:text-2xl',
    'lg:text-2xl',
    'xl:text-3xl'
  ),
  
  // Subheaders
  subheader: getResponsiveClasses(
    'text-lg',
    'sm:text-lg',
    'md:text-xl',
    'lg:text-xl',
    'xl:text-2xl'
  ),
  
  // Body text
  body: getResponsiveClasses(
    'text-sm',
    'sm:text-sm',
    'md:text-base',
    'lg:text-base',
    'xl:text-base'
  ),
  
  // Padding
  sectionPadding: getResponsiveClasses(
    'p-4',
    'sm:p-4',
    'md:p-6',
    'lg:p-6',
    'xl:p-8'
  ),
  
  // Card padding
  cardPadding: getResponsiveClasses(
    'p-3',
    'sm:p-4',
    'md:p-4',
    'lg:p-6',
    'xl:p-6'
  ),
  
  // Gap
  sectionGap: getResponsiveClasses(
    'gap-4',
    'sm:gap-4',
    'md:gap-6',
    'lg:gap-6',
    'xl:gap-8'
  ),
  
  // Button sizes
  buttonPadding: getResponsiveClasses(
    'px-3 py-2',
    'sm:px-4 py-2',
    'md:px-4 py-3',
    'lg:px-6 py-3',
    'xl:px-6 py-3'
  ),
  
  // Input padding
  inputPadding: getResponsiveClasses(
    'px-3 py-2',
    'sm:px-4 py-2',
    'md:px-4 py-3',
    'lg:px-4 py-3',
    'xl:px-4 py-3'
  ),
  
  // Icon sizes
  iconSmall: getResponsiveClasses(
    'w-4 h-4',
    'sm:w-4 h-4',
    'md:w-5 h-5',
    'lg:w-5 h-5',
    'xl:w-5 h-5'
  ),
  
  iconMedium: getResponsiveClasses(
    'w-5 h-5',
    'sm:w-5 h-5',
    'md:w-6 h-6',
    'lg:w-6 h-6',
    'xl:w-6 h-6'
  ),
  
  iconLarge: getResponsiveClasses(
    'w-6 h-6',
    'sm:w-6 h-6',
    'md:w-8 h-8',
    'lg:w-8 h-8',
    'xl:w-8 h-8'
  ),
} as const;

// Device detection utilities
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < parseInt(breakpoints.sm);
};

export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  const width = window.innerWidth;
  return width >= parseInt(breakpoints.sm) && width < parseInt(breakpoints.lg);
};

export const isDesktop = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= parseInt(breakpoints.lg);
};

export const getCurrentBreakpoint = (): Breakpoint => {
  if (typeof window === 'undefined') return 'md';
  const width = window.innerWidth;
  
  if (width < parseInt(breakpoints.sm)) return 'xs';
  if (width < parseInt(breakpoints.md)) return 'sm';
  if (width < parseInt(breakpoints.lg)) return 'md';
  if (width < parseInt(breakpoints.xl)) return 'lg';
  return 'xl';
};

// Hook for responsive design
export const useResponsive = () => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('md');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isTabletDevice, setIsTabletDevice] = useState(false);
  const [isDesktopDevice, setIsDesktopDevice] = useState(false);

  useEffect(() => {
    const updateBreakpoint = () => {
      const current = getCurrentBreakpoint();
      setBreakpoint(current);
      setIsMobileDevice(isMobile());
      setIsTabletDevice(isTablet());
      setIsDesktopDevice(isDesktop());
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile: isMobileDevice,
    isTablet: isTabletDevice,
    isDesktop: isDesktopDevice,
  };
};

// Import React hooks
import { useState, useEffect } from 'react';
