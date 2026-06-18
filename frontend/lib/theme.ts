export const theme = {
  colors: {
    background: {
      primary: '#0a0a0a',
      secondary: '#111111',
      tertiary: '#1a1a1a',
      card: '#1a1a1a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#ffffffcc',
      tertiary: '#ffffff99',
      muted: '#ffffff66',
    },
    border: {
      primary: '#ffffff1a',
      secondary: '#ffffff0d',
    },
    accent: {
      primary: '#eab308',
      secondary: '#facc15',
      hover: '#ca8a04',
    },
    status: {
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
} as const;

export const darkModeClasses = {
  background: {
    primary: 'bg-[#0a0a0a]',
    secondary: 'bg-[#111111]',
    tertiary: 'bg-[#1a1a1a]',
    card: 'bg-card',
  },
  text: {
    primary: 'text-white',
    secondary: 'text-white/80',
    tertiary: 'text-white/60',
    muted: 'text-white/40',
  },
  border: {
    primary: 'border-white/10',
    secondary: 'border-white/5',
  },
  hover: {
    primary: 'hover:bg-white/5',
    secondary: 'hover:bg-white/10',
  },
} as const;

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark' | 'system') {
  if (typeof window === 'undefined') return;
  
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  
  if (theme === 'system') {
    const systemTheme = getSystemTheme();
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
  
  localStorage.setItem('theme', theme);
}

export function getTheme(): 'light' | 'dark' | 'system' {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
}
