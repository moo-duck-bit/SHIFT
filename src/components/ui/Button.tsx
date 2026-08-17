import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TouchableOpacityProps,
} from 'react-native';
import { colors, typography, radius, spacing, shadows } from '../../config/design';

// Clean interfaces following single responsibility principle
interface BaseButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

// Single purpose component for button styling
const Button: React.FC<BaseButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled = false,
  style,
  onPress,
  ...rest
}) => {
  // Clean function for handling press events with error boundary
  const handlePress = (event: any) => {
    try {
      if (loading || disabled) return;
      onPress?.(event);
    } catch (error) {
      console.error('Button press error:', error);
    }
  };

  // Clean utility functions for style computation
  const getBtnStyle = (): ViewStyle => {
    const baseStyle = styles.base;
    const variantStyle = styles[variant];
    const sizeStyle = styles[size];
    const widthStyle = fullWidth ? styles.fullWidth : {};
    const disabledStyle = (disabled || loading) ? styles.disabled : {};
    
    return {
      ...baseStyle,
      ...variantStyle,
      ...sizeStyle,
      ...widthStyle,
      ...disabledStyle,
    };
  };

  const getTxtStyle = (): TextStyle => {
    const baseTextStyle = styles.text;
    const variantTextStyle = styles[`${variant}Text`];
    const sizeTextStyle = styles[`${size}Text`];
    
    return {
      ...baseTextStyle,
      ...variantTextStyle,
      ...sizeTextStyle,
    };
  };

  // Clean conditional rendering
  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator 
          size="small" 
          color={variant === 'ghost' ? colors.text.secondary : colors.text.primary} 
        />
      );
    }
    return <Text style={getTxtStyle()}>{title}</Text>;
  };

  return (
    <TouchableOpacity
      style={[getBtnStyle(), style]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...rest}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

// Clean, organized styles following design system
const styles = StyleSheet.create({
  // Base styles
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...shadows.sm,
  },
  
  // Variant styles
  primary: {
    backgroundColor: colors.primary[500],
  },
  secondary: {
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.error,
  },
  
  // Size styles
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  
  // Width modifier
  fullWidth: {
    width: '100%',
  },
  
  // State styles
  disabled: {
    opacity: 0.5,
  },
  
  // Text styles
  text: {
    ...typography.button,
    textAlign: 'center',
  },
  
  // Variant text styles
  primaryText: {
    color: colors.text.primary,
  },
  secondaryText: {
    color: colors.text.primary,
  },
  ghostText: {
    color: colors.text.secondary,
  },
  dangerText: {
    color: colors.text.primary,
  },
  
  // Size text styles
  smText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mdText: {
    fontSize: 16,
    lineHeight: 24,
  },
  lgText: {
    fontSize: 18,
    lineHeight: 26,
  },
});

export default Button; 