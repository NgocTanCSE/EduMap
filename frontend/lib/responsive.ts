export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const mediaQueries = {
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  '2xl': `(min-width: ${breakpoints['2xl']}px)`,
} as const;

export const containerClasses = {
  default: 'w-full mx-auto px-4 sm:px-6 lg:px-8',
  narrow: 'w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8',
  wide: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
} as const;

export const gridClasses = {
  '1': 'grid grid-cols-1 gap-4',
  '2': 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  '3': 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
  '4': 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
} as const;

export const textClasses = {
  h1: 'text-2xl sm:text-3xl lg:text-4xl font-bold',
  h2: 'text-xl sm:text-2xl lg:text-3xl font-bold',
  h3: 'text-lg sm:text-xl lg:text-2xl font-semibold',
  body: 'text-sm sm:text-base',
  small: 'text-xs sm:text-sm',
} as const;

export const paddingClasses = {
  page: 'py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8',
  section: 'py-6 sm:py-8 lg:py-12',
  card: 'p-4 sm:p-5 lg:p-6',
} as const;

export const gapClasses = {
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
} as const;
