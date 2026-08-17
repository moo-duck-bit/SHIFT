import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, shadows } from '../../config/design';

// Clean interface with single responsibility
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

// Single purpose component for card layout
const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  style,
}) => {
  // Clean utility function for style computation
  const getCardStyle = (): ViewStyle => {
    const baseStyle = styles.base;
    const variantStyle = variantStyles[variant];
    const paddingStyle = paddingStyles[padding];
    
    return {
      ...baseStyle,
      ...variantStyle,
      ...paddingStyle,
    };
  };

  return (
    <View style={[getCardStyle(), style]}>
      {children}
    </View>
  );
};

// Clean, organized styles following design system
const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface.card,
  },
});

// Type-safe variant mapping
const variantStyles: Record<string, ViewStyle> = {
  default: {
    backgroundColor: colors.surface.card,
  },
  elevated: {
    backgroundColor: colors.surface.elevated,
    ...shadows.md,
  },
  outlined: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
};

// Type-safe padding mapping
const paddingStyles: Record<string, ViewStyle> = {
  none: {
    padding: 0,
  },
  sm: {
    padding: spacing.md,
  },
  md: {
    padding: spacing.lg,
  },
  lg: {
    padding: spacing.xl,
  },
};

export default Card; 