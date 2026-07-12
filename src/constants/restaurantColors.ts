/**
 * Restaurant table-status colors — 3D floor plan (Table3D.tsx) and the 2D
 * status legend (RestaurantHub.tsx). Raw hex/rgba values are load-bearing
 * here: Three.js materials and the status-legend swatches need actual
 * color values, not Tailwind classes.
 *
 * DOM styling (backgrounds, borders, text) previously lived here too
 * (base/surface/glass/border/text* etc.) but was pure decoration with no
 * technical need for raw values — migrated to standard Tailwind utility
 * classes (bg-slate-900, border-white/10, text-white/40, ...) matching
 * CLAUDE.md's Dark Theme Standard, the same convention every other page
 * in the app already uses. This file now only holds what genuinely can't
 * be a Tailwind class.
 */

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'alert';

export interface StatusColor {
  fill: string;
  emissive: string;
  glow: string;
}

export const RESTAURANT_COLORS = {
  available: { fill: '#10b981', emissive: '#10b981', glow: 'rgba(16,185,129,0.3)' },
  occupied: { fill: '#f59e0b', emissive: '#f59e0b', glow: 'rgba(245,158,11,0.3)' },
  reserved: { fill: '#8b5cf6', emissive: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' },
  cleaning: { fill: '#64748b', emissive: '#64748b', glow: 'transparent' },
  alert: { fill: '#ef4444', emissive: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
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
