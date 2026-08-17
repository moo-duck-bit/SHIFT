import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
import { colors, spacing, radius, shadows, typography } from '../config/design';
import Text from '../components/ui/Text';
import TabIcon from '../components/ui/TabIcon';
import HomeScreen from '../screens/HomeScreen';
import StatsScreen from '../screens/StatsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PlanScreen from '../screens/PlanScreen';

const Tab = createBottomTabNavigator();

type Props = {
  onSignOut: () => void;
};

// Clean tab configuration
const tabConfig = {
  Home: {
    label: 'Home',
    iconName: 'home' as const,
  },
  Plan: {
    label: 'Plan',
    iconName: 'calendar' as const,
  },
  Stats: {
    label: 'Stats',
    iconName: 'stats' as const,
  },
  Profile: {
    label: 'Profile',
    iconName: 'profile' as const,
  },
} as const;

export default function TabNavigator({ onSignOut }: Props) {
  
  // Clean animated tab icon component with proper animation handling
  const renderTabIcon = (focused: boolean, routeName: string) => {
    const config = tabConfig[routeName as keyof typeof tabConfig];
    if (!config) return null;

    return (
      <View style={[styles.tabIconContainer, focused && styles.tabIconContainerActive]}>
        <View style={styles.tabIcon}>
          <TabIcon 
            name={config.iconName}
            focused={focused}
            size={24}
          />
        </View>
        <Text 
          variant="caption" 
          color={focused ? 'primary' : 'tertiary'}
          style={[styles.tabLabel, focused && styles.tabLabelActive]}
        >
          {config.label}
        </Text>
      </View>
    );
  };

  // Clean tab label component (now handled in renderTabIcon)
  const renderTabLabel = () => null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <View style={styles.tabBarBackground} />
        ),
        tabBarIcon: ({ focused }) => renderTabIcon(focused, route.name),
        tabBarLabel: renderTabLabel,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarShowLabel: false, // We'll handle labels ourselves
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: false,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarTestID: 'home-tab',
        }}
        listeners={{
          focus: () => console.log('TabNavigator - Home tab focused'),
          blur: () => console.log('TabNavigator - Home tab blurred'),
        }}
      />
      <Tab.Screen 
        name="Plan" 
        component={PlanScreen}
        options={{
          tabBarTestID: 'plan-tab',
        }}
      />
      <Tab.Screen 
        name="Stats" 
        component={StatsScreen}
        options={{
          tabBarTestID: 'stats-tab',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        children={() => <ProfileScreen onSignOut={onSignOut} />}
        options={{
          tabBarTestID: 'profile-tab',
        }}
      />
    </Tab.Navigator>
  );
}

// Clean, organized styles following Toss design principles
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    height: 84,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...shadows.lg,
  },

  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },

  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
    paddingVertical: spacing.xs,
  },

  tabIconContainerActive: {
    backgroundColor: colors.primary[50],
  },

  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },

  tabLabel: {
    textAlign: 'center',
    ...typography.caption,
  },

  tabLabelActive: {
    fontWeight: '600',
  },
}); 