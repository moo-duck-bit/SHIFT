import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '../../config/design';

// Clean icon component interfaces
interface TabIconProps {
  name: 'home' | 'stats' | 'profile' | 'calendar';
  focused: boolean;
  size?: number;
}

// Single purpose icon component for tabs
const TabIcon: React.FC<TabIconProps> = ({ name, focused, size = 24 }) => {
  const iconColor = focused ? colors.primary[500] : colors.text.tertiary;
  const fillColor = focused ? colors.primary[500] : 'transparent';
  
  // Clean icon render functions
  const renderHomeIcon = () => (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      {/* House base */}
      <View style={[
        styles.homeBase,
        { 
          borderColor: iconColor,
          backgroundColor: focused ? colors.primary[100] : 'transparent',
          width: size * 0.7,
          height: size * 0.5,
          bottom: size * 0.1,
        }
      ]} />
      {/* House roof */}
      <View style={[
        styles.homeRoof,
        { 
          borderBottomColor: iconColor,
          borderBottomWidth: 2,
          width: size * 0.8,
          height: size * 0.4,
          top: size * 0.05,
        }
      ]} />
      {/* Door */}
      <View style={[
        styles.homeDoor,
        { 
          backgroundColor: iconColor,
          width: size * 0.2,
          height: size * 0.25,
          bottom: size * 0.1,
        }
      ]} />
    </View>
  );

  const renderStatsIcon = () => (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <View style={[
        styles.statsBar,
        styles.bar1,
        { 
          backgroundColor: iconColor,
          width: size * 0.15,
          height: size * 0.4,
          left: size * 0.2,
        }
      ]} />
      <View style={[
        styles.statsBar,
        styles.bar2,
        { 
          backgroundColor: iconColor,
          width: size * 0.15,
          height: size * 0.7,
          left: size * 0.425,
        }
      ]} />
      <View style={[
        styles.statsBar,
        styles.bar3,
        { 
          backgroundColor: iconColor,
          width: size * 0.15,
          height: size * 0.5,
          left: size * 0.65,
        }
      ]} />
    </View>
  );

  const renderProfileIcon = () => (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      <View style={[
        styles.profileHead,
        { 
          borderColor: iconColor,
          backgroundColor: fillColor,
          width: size * 0.35,
          height: size * 0.35,
          top: size * 0.1,
        }
      ]} />
      <View style={[
        styles.profileBody,
        { 
          borderColor: iconColor,
          backgroundColor: fillColor,
          width: size * 0.6,
          height: size * 0.4,
          bottom: size * 0.05,
        }
      ]} />
    </View>
  );

  const renderCalendarIcon = () => (
    <View style={[styles.iconContainer, { width: size, height: size }]}>
      {/* Calendar body */}
      <View style={[
        styles.calendarBody,
        { 
          borderColor: iconColor,
          backgroundColor: focused ? colors.primary[100] : 'transparent',
          width: size * 0.8,
          height: size * 0.7,
          bottom: size * 0.05,
        }
      ]} />
      {/* Calendar header */}
      <View style={[
        styles.calendarHeader,
        { 
          backgroundColor: iconColor,
          width: size * 0.8,
          height: size * 0.15,
          top: size * 0.1,
        }
      ]} />
      {/* Calendar rings */}
      <View style={[
        styles.calendarRing,
        styles.calendarRingLeft,
        { 
          borderColor: iconColor,
          width: size * 0.15,
          height: size * 0.2,
          left: size * 0.25,
          top: size * 0.05,
        }
      ]} />
      <View style={[
        styles.calendarRing,
        styles.calendarRingRight,
        { 
          borderColor: iconColor,
          width: size * 0.15,
          height: size * 0.2,
          right: size * 0.25,
          top: size * 0.05,
        }
      ]} />
      {/* Calendar dots */}
      <View style={[
        styles.calendarDot,
        { 
          backgroundColor: iconColor,
          width: size * 0.08,
          height: size * 0.08,
          left: size * 0.3,
          bottom: size * 0.25,
        }
      ]} />
      <View style={[
        styles.calendarDot,
        { 
          backgroundColor: iconColor,
          width: size * 0.08,
          height: size * 0.08,
          left: size * 0.46,
          bottom: size * 0.25,
        }
      ]} />
      <View style={[
        styles.calendarDot,
        { 
          backgroundColor: iconColor,
          width: size * 0.08,
          height: size * 0.08,
          right: size * 0.3,
          bottom: size * 0.25,
        }
      ]} />
    </View>
  );

  // Clean icon mapping
  const iconMap = {
    home: renderHomeIcon,
    stats: renderStatsIcon,
    profile: renderProfileIcon,
    calendar: renderCalendarIcon,
  };

  return iconMap[name]();
};

// Clean, organized styles for tab icons
const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // Home icon styles
  homeBase: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    position: 'absolute',
  },

  homeRoof: {
    position: 'absolute',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: '0deg' }],
  },

  homeDoor: {
    borderRadius: 2,
    position: 'absolute',
  },

  // Stats icon styles
  statsBar: {
    position: 'absolute',
    bottom: '25%',
    borderRadius: radius.sm,
  },

  bar1: {
    // Smallest bar
  },

  bar2: {
    // Tallest bar
  },

  bar3: {
    // Medium bar
  },

  // Profile icon styles
  profileHead: {
    borderWidth: 2,
    borderRadius: radius.full,
    position: 'absolute',
  },

  profileBody: {
    borderWidth: 2,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: radius.sm,
    borderBottomRightRadius: radius.sm,
    position: 'absolute',
  },

  // Calendar icon styles
  calendarBody: {
    borderWidth: 2,
    borderTopWidth: 0,
    borderRadius: radius.sm,
    position: 'absolute',
  },

  calendarHeader: {
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    position: 'absolute',
  },

  calendarRing: {
    borderWidth: 2,
    borderBottomWidth: 0,
    borderRadius: radius.sm,
    position: 'absolute',
  },

  calendarRingLeft: {
    // Left ring position
  },

  calendarRingRight: {
    // Right ring position
  },

  calendarDot: {
    borderRadius: radius.full,
    position: 'absolute',
  },
});

export default TabIcon; 