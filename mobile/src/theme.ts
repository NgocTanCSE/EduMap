/**
 * EduMap Mobile — theme & style tokens.
 * Mirror of web frontend color palette (dark mode) for visual consistency.
 */
export const Colors = {
  primary: '#eab308',      // yellow-500
  primaryDark: '#a17a03',
  background: '#09090b',   // zinc-950
  surface: '#18181b',     // zinc-900
  card: '#27272a',        // zinc-800
  border: '#27272a',
  text: '#ffffff',
  textSecondary: '#a1a1aa', // zinc-400
  textMuted: '#71717a',   // zinc-500
  danger: '#ef4444',      // red-500
  success: '#22c55e',     // green-500
  warning: '#f59e0b',     // amber-500
  info: '#3b82f6',        // blue-500
  overlay: 'rgba(0,0,0,0.6)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const Shadows = {
  card: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
};
