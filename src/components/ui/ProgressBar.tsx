import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../config/design';
import Text from './Text';

// Clean interface with single responsibility
interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercent?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

// Single purpose component for progress visualization
const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercent = false,
  color = 'primary',
  size = 'md',
  style,
}) => {
  // Clean utility functions
  const getProgress = (): number => {
    try {
      return Math.max(0, Math.min(100, progress));
    } catch (error) {
      console.error('Progress calculation error:', error);
      return 0;
    }
  };

  const getBarStyle = (): ViewStyle => {
    const baseStyle = styles.bar;
    let sizeStyle: ViewStyle = {};
    
    switch (size) {
      case 'sm':
        sizeStyle = styles.barSM;
        break;
      case 'md':
        sizeStyle = styles.barMD;
        break;
      case 'lg':
        sizeStyle = styles.barLG;
        break;
    }
    
    return {
      ...baseStyle,
      ...sizeStyle,
    };
  };

  const getFillStyle = (): ViewStyle => {
    const baseStyle = styles.fill;
    const colorStyle = { backgroundColor: getBarColor(color) };
    const widthStyle = { width: `${getProgress()}%` as any };
    
    return {
      ...baseStyle,
      ...colorStyle,
      ...widthStyle,
    };
  };

  const renderLabel = () => {
    if (!label && !showPercent) return null;
    
    return (
      <View style={styles.labelRow}>
        {label && (
          <Text variant="bodySmall" color="secondary">
            {label}
          </Text>
        )}
        {showPercent && (
          <Text variant="bodySmall" color="secondary">
            {getProgress()}%
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {renderLabel()}
      <View style={getBarStyle()}>
        <View style={getFillStyle()} />
      </View>
    </View>
  );
};

// Clean utility function for color mapping
const getBarColor = (color: string): string => {
  const colorMap: Record<string, string> = {
    primary: colors.primary[500],
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };
  
  return colorMap[color] || colors.primary[500];
};

// Clean, organized styles
const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  
  bar: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  
  barSM: {
    height: 4,
  },
  
  barMD: {
    height: 8,
  },
  
  barLG: {
    height: 12,
  },
  
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});

export default ProgressBar; 