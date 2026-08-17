import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../config/design';
import Text from './Text';

// Clean interface for status badge
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'warning' | 'error' | 'success';
  label: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

// Single purpose component for status indication
const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  style,
}) => {
  // Clean utility function for style computation
  const getBadgeStyle = (): ViewStyle => {
    const baseStyle = styles.base;
    const statusStyle = styles[status];
    const sizeStyle = styles[size];
    
    return {
      ...baseStyle,
      ...statusStyle,
      ...sizeStyle,
    };
  };

  const getTextVariant = () => {
    return size === 'sm' ? 'caption' : 'bodySmall';
  };

  return (
    <View style={[getBadgeStyle(), style]}>
      <View style={[styles.dot, { backgroundColor: getDotColor(status) }]} />
      <Text variant={getTextVariant()} color="primary">
        {label}
      </Text>
    </View>
  );
};

// Clean utility function for dot color
const getDotColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    active: colors.success,
    inactive: colors.text.disabled,
    warning: colors.warning,
    error: colors.error,
    success: colors.success,
  };
  
  return colorMap[status] || colors.text.disabled;
};

// Clean, organized styles
const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
  },
  
  // Size variants
  sm: {
    paddingVertical: spacing.xs,
  },
  
  md: {
    paddingVertical: spacing.sm,
  },
  
  // Status variants
  active: {
    backgroundColor: colors.surface.elevated,
  },
  
  inactive: {
    backgroundColor: colors.surface.card,
  },
  
  warning: {
    backgroundColor: colors.surface.elevated,
  },
  
  error: {
    backgroundColor: colors.surface.elevated,
  },
  
  success: {
    backgroundColor: colors.surface.elevated,
  },
  
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    marginRight: spacing.xs,
  },
});

export default StatusBadge; 