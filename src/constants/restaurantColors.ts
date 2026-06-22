/**
 * Restaurant Color System — Dark Luxury Palette
 * Used throughout the F&B vertical: 3D floor plan, KDS, waiter interface, analytics
 *
 * Status colors: available (green), occupied (amber), reserved (purple), cleaning (gray), alert (red)
 * Each status has fill, emissive, and glow properties for 3D rendering and UI effects
 *
 * Backgrounds: 5 dark navy shades from base to glass
 * Accents: gradient-based for premium features (AI, Enterprise)
 */

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'alert';

export interface StatusColor {
  fill: string;
  emissive: string;
  glow: string;
}

export const RESTAURANT_COLORS = {
  // Table status (used in 3D and 2D floor plan)
  available: { fill: '#10b981', emissive: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  occupied: { fill: '#f59e0b', emissive: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  reserved: { fill: '#8b5cf6', emissive: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  cleaning: { fill: '#64748b', emissive: '#64748b', glow: 'transparent' },
  alert: { fill: '#ef4444', emissive: '#ef4444', glow: 'rgba(239,68,68,0.4)' },

  // Backgrounds
  base: '#0a0f1e', // Deepest dark navy — page background
  surface: '#111827', // Cards, panels
  elevated: '#1e2d40', // Modals, dropdowns
  glass: 'rgba(255,255,255,0.04)', // Glassmorphism surface
  border: 'rgba(255,255,255,0.08)',

  // Accents
  primary: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)', // Indigo→Sky
  gold: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // AI features
  premium: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)', // Enterprise features

  // Text colors
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.8)',
  textTertiary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.4)',
} as const;

/**
 * Retrieve color properties for a table status
 * Used in floor plan rendering and status badge components
 */
export function getTableStatusColor(status: TableStatus): StatusColor {
  return RESTAURANT_COLORS[status] as StatusColor;
}

/**
 * Convert hex color to RGB tuple for Three.js and Canvas operations
 * @param hex - Hex color code (e.g., '#10b981')
 * @returns Array of [r, g, b] values in 0-1 range for Three.js or [r, g, b] in 0-255 for Canvas
 */
export function hexToRgb(hex: string, normalized: boolean = true): [number, number, number] {
  // Remove '#' if present
  const cleanHex = hex.replace(/^#/, '');

  // Parse hex to RGB
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  // Return normalized (0-1) for Three.js, or 0-255 for Canvas
  if (normalized) {
    return [r / 255, g / 255, b / 255];
  }
  return [r, g, b];
}
