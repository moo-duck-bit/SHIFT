// Toss-inspired Design System
// Clean, minimal, accessible design tokens

export const colors = {
  // Primary colors (Toss-inspired blue tones)
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe', 
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // Main brand color
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },
  
  // Grayscale (optimized for dark mode)
  gray: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
  
  // Semantic colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Surface colors (light theme optimized)
  surface: {
    background: '#ffffff',
    card: '#ffffff',
    elevated: '#fafafa',
    border: '#e5e5e5',
    overlay: 'rgba(0, 0, 0, 0.1)',
  },
  
  // Text colors (light theme)
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    inverse: '#ffffff',
    disabled: '#a3a3a3',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// Typography scale (Pretendard font family)
export const typography = {
  // Display sizes
  display: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '900' as const,
    fontFamily: 'Pretendard-Bold',
  },
  
  // Heading sizes
  h1: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800' as const,
    fontFamily: 'Pretendard-Bold',
  },
  h2: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
    fontFamily: 'Pretendard-SemiBold',
  },
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
    fontFamily: 'Pretendard-SemiBold',
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600' as const,
    fontFamily: 'Pretendard-SemiBold',
  },
  
  // Body text
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    fontFamily: 'Pretendard-Regular',
  },
  bodyLarge: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '400' as const,
    fontFamily: 'Pretendard-Regular',
  },
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    fontFamily: 'Pretendard-Regular',
  },
  
  // Caption and labels
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    fontFamily: 'Pretendard-Regular',
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    fontFamily: 'Pretendard-Medium',
  },
  
  // Button text
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontFamily: 'Pretendard-SemiBold',
  },
} as const;

export const animation = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const;

// Component variants
export const variants = {
  button: {
    primary: {
      backgroundColor: colors.primary[500],
      color: colors.text.primary,
    },
    secondary: {
      backgroundColor: colors.surface.elevated,
      color: colors.text.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.text.secondary,
    },
    danger: {
      backgroundColor: colors.error,
      color: colors.text.primary,
    },
  },
} as const;

export const breakpoints = {
  sm: 320,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const; 