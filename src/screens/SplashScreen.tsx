import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../config/design';
import Text from '../components/ui/Text';

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    try {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(onFinish, 2500);
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('Splash animation error:', error);
      onFinish();
    }
  }, [fadeAnim, scaleAnim, onFinish]);

  return (
    <LinearGradient
      colors={[colors.surface.background, colors.surface.card]}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text variant="display" color="primary" style={styles.title}>
          Shift
        </Text>
        <Text variant="bodyLarge" color="secondary">
          Healthy daily short-form consumption
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

// Clean styles using design system
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  
  title: {
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
}); 