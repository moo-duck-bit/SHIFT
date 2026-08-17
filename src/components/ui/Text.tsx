import React from 'react';
import { Text as RNText, TextStyle, TextProps as RNTextProps } from 'react-native';
import { typography, colors } from '../../config/design';

// Clean interface extending base TextProps
interface TextProps extends RNTextProps {
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'bodyLarge' | 'bodySmall' | 'caption' | 'label' | 'button';
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'disabled' | 'success' | 'warning' | 'error';
  align?: 'left' | 'center' | 'right';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
}

// Single responsibility component for text rendering
const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'primary',
  align = 'left',
  weight,
  style,
  children,
  ...rest
}) => {
  // Clean utility function for style computation
  const getTextStyle = (): TextStyle => {
    const baseStyle = typography[variant];
    const colorStyle = { color: getTextColor(color) };
    const alignStyle = { textAlign: align };
    const weightStyle = weight ? { fontWeight: getFontWeight(weight) } : {};
    
    return {
      ...baseStyle,
      ...colorStyle,
      ...alignStyle,
      ...weightStyle,
    };
  };

  return (
    <RNText style={[getTextStyle(), style]} {...rest}>
      {children}
    </RNText>
  );
};

// Clean utility functions
const getTextColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    primary: colors.text.primary,
    secondary: colors.text.secondary,
    tertiary: colors.text.tertiary,
    inverse: colors.text.inverse,
    disabled: colors.text.disabled,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };
  
  return colorMap[color] || colors.text.primary;
};

const getFontWeight = (weight: string): TextStyle['fontWeight'] => {
  const weightMap: Record<string, TextStyle['fontWeight']> = {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  };
  
  return weightMap[weight] || '400';
};

export default Text; 