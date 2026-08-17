import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
  Switch,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { colors, spacing, radius, shadows } from '../config/design';
import { Button, Text, Card } from '../components/ui';
import AsyncStorage from '../config/storage';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { 
  checkAndShowPlanReminder,
  cancelAllNotifications,
  schedulePeriodicReminders 
} from '../utils/notifications';

type Props = {
  onSignOut: () => void;
};

export default function ProfileScreen({ onSignOut }: Props) {
  const user = auth.currentUser;
  const [reminderTime, setReminderTime] = useState('09:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.95));

  // Light theme color palette (same as StatsScreen)
  const lightColors = {
    primary: '#2563eb',
    secondary: '#7c3aed',
    accent: '#06b6d4',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#ffffff',
    surface: '#f8fafc',
    surfaceLight: '#f1f5f9',
    text: '#1e293b',
    textSecondary: '#64748b',
    glass: 'rgba(255, 255, 255, 0.8)',
    cardBorder: '#e2e8f0',
  };

  useEffect(() => {
    loadNotificationSettings();
    animateIn();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadNotificationSettings = async () => {
    try {
      const savedTime = await AsyncStorage.getItem('reminder_time');
      const savedEnabled = await AsyncStorage.getItem('reminder_enabled');
      
      if (savedTime) {
        setReminderTime(savedTime);
      }
      if (savedEnabled !== null) {
        setReminderEnabled(savedEnabled === 'true');
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveNotificationSettings = async (time: string, enabled: boolean) => {
    try {
      await AsyncStorage.setItem('reminder_time', time);
      await AsyncStorage.setItem('reminder_enabled', enabled.toString());
      
      if (enabled) {
        await schedulePeriodicReminders(time);
        Alert.alert('Settings Complete', `Plan reminders will be sent daily at ${time}.`);
      } else {
        await cancelAllNotifications();
        Alert.alert('Settings Complete', 'Plan reminders have been disabled.');
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('Error', 'An error occurred while saving settings.');
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      const newTime = `${hours}:${minutes}`;
      setReminderTime(newTime);
      
      if (reminderEnabled) {
        saveNotificationSettings(newTime, true);
      }
    }
  };

  const toggleReminder = async () => {
    const newEnabled = !reminderEnabled;
    setReminderEnabled(newEnabled);
    await saveNotificationSettings(reminderTime, newEnabled);
  };

  const testNotification = async () => {
    try {
      await checkAndShowPlanReminder(reminderTime);
      Alert.alert('Test Complete', 'Notifications are working properly.');
    } catch (error) {
      console.error('Notification test error:', error);
      Alert.alert('Error', 'An error occurred during notification test.');
    }
  };

  const handleSignOut = async () => {
    try {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelAllNotifications();
                await signOut(auth);
                onSignOut();
              } catch (error) {
                console.error('Sign out error:', error);
                Alert.alert('Error', 'An error occurred during sign out');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleHelp = () => {
    Alert.alert(
      'Help',
      'Shift tracks viewing time and scroll counts to analyze your short-form usage patterns.\n\nPlease enable accessibility service for accurate tracking.',
      [{ text: 'OK' }]
    );
  };

  const renderMenuItem = (
    label: string,
    onPress: () => void,
    variant: 'default' | 'danger' = 'default',
    rightText?: string
  ) => (
    <TouchableOpacity 
      style={styles.menuItemWrapper} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={variant === 'danger' 
          ? ['#fef2f2', '#fee2e2'] 
          : [lightColors.surface, lightColors.surfaceLight]
        }
        style={styles.menuItem}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.menuItemContent}>
          <Text 
            style={[
              styles.menuItemText,
              { color: variant === 'danger' ? lightColors.danger : lightColors.text }
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {label}
          </Text>
          {rightText && (
            <Text 
              style={styles.menuItemRightText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {rightText}
            </Text>
          )}
        </View>
        <View style={styles.menuItemArrow}>
          <Text style={[
            styles.arrowText,
            { color: variant === 'danger' ? lightColors.danger : lightColors.textSecondary }
          ]}>
            ›
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderSwitchMenuItem = (
    label: string,
    value: boolean,
    onToggle: () => void,
    subtitle?: string
  ) => (
    <View style={styles.menuItemWrapper}>
      <LinearGradient
        colors={[lightColors.surface, lightColors.surfaceLight]}
        style={styles.menuItem}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.switchItemContent}>
          <View style={styles.switchItemText}>
            <Text 
              style={styles.menuItemText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
            {subtitle && (
              <Text 
                style={styles.menuItemSubtitle}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            )}
          </View>
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ 
              false: lightColors.cardBorder, 
              true: lightColors.primary 
            }}
            thumbColor={value ? '#ffffff' : lightColors.textSecondary}
            ios_backgroundColor={lightColors.cardBorder}
          />
        </View>
      </LinearGradient>
    </View>
  );

  const renderUserAvatar = () => {
    const initial = user?.email?.charAt(0).toUpperCase() || 'U';
    
    return (
      <View style={styles.avatarWrapper}>
        <LinearGradient
          colors={[lightColors.primary, lightColors.secondary]}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>
            {initial}
          </Text>
        </LinearGradient>
      </View>
    );
  };

  const renderSectionCard = (title: string, children: React.ReactNode) => (
    <View style={styles.sectionCardWrapper}>
      <LinearGradient
        colors={['#ffffff', lightColors.surface]}
        style={styles.sectionCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <BlurView intensity={20} style={styles.sectionCardBlur}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <View style={styles.sectionContent}>
            {children}
          </View>
        </BlurView>
      </LinearGradient>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={[lightColors.background, lightColors.surface]}
        style={StyleSheet.absoluteFillObject}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Account settings and app information</Text>
          </View>

          {/* User information card */}
          <View style={styles.userCardWrapper}>
            <LinearGradient
              colors={[lightColors.primary, lightColors.secondary]}
              style={styles.userCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <BlurView intensity={40} style={styles.userCardBlur}>
                <View style={styles.userInfo}>
                  {renderUserAvatar()}
                  <View style={styles.userDetails}>
                    <Text 
                      style={styles.userName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {user?.displayName || 'User'}
                    </Text>
                    <Text 
                      style={styles.userEmail}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {user?.email || 'unknown@email.com'}
                    </Text>
                  </View>
                </View>
              </BlurView>
            </LinearGradient>
          </View>

          {/* Notification settings */}
          {renderSectionCard('Notification Settings', (
            <View style={styles.menuList}>
              {renderSwitchMenuItem(
                'Plan Reminder',
                reminderEnabled,
                toggleReminder,
                reminderEnabled ? `Daily at ${reminderTime}` : 'Disabled'
              )}
              
              {renderMenuItem(
                'Reminder Time',
                () => setShowTimePicker(true),
                'default',
                reminderTime
              )}


             
            </View>
          ))}

          {/* App information */}
          {renderSectionCard('App Information', (
            <View style={styles.menuList}>
              {renderMenuItem('Help', handleHelp)}
              {renderMenuItem('Version Info', () => {
                Alert.alert('Version Info', 'Shift v1.0.0');
              }, 'default', 'v1.0.0')}
              {renderMenuItem('Privacy Policy', () => {
                Alert.alert('Privacy Policy', 'This app uses your short-form records to provide personalized guidance.');
              })}
            </View>
          ))}

          {/* Account management */}
          {renderSectionCard('Account Management', (
            <View style={styles.menuList}>
              {renderMenuItem('Sign Out', handleSignOut, 'danger')}
            </View>
          ))}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Shift helps with healthy short-form usage
            </Text>
            <Text style={styles.footerVersion}>
              Version 1.0.0
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* 개선된 시간 선택 모달 */}
      {showTimePicker && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showTimePicker}
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <BlurView intensity={50} style={StyleSheet.absoluteFillObject} />
            <View style={styles.modalContent}>
              <LinearGradient
                colors={['#ffffff', lightColors.surface]}
                style={styles.modalGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.modalHeader}>
                  <TouchableOpacity 
                    onPress={() => setShowTimePicker(false)}
                    style={styles.modalButton}
                  >
                    <Text style={styles.modalButtonText}>취소</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>리마인더 시간</Text>
                  <TouchableOpacity 
                    onPress={() => setShowTimePicker(false)}
                    style={styles.modalButton}
                  >
                    <Text style={[styles.modalButtonText, { color: lightColors.primary }]}>완료</Text>
                  </TouchableOpacity>
                </View>
                
                <RNDateTimePicker
                  mode="time"
                  value={new Date(`2000-01-01T${reminderTime}:00`)}
                  onChange={handleTimeChange}
                  display="spinner"
                  style={styles.timePicker}
                />
              </LinearGradient>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
    paddingTop: spacing.lg,
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: spacing.xs
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  userCardWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  userCard: {
    borderRadius: radius.xl,
  },
  userCardBlur: {
    padding: spacing.lg,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    marginRight: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  sectionCardWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  sectionCard: {
    borderRadius: radius.lg,
  },
  sectionCardBlur: {
    padding: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  sectionContent: {
    // No additional styling needed
  },
  menuList: {
    gap: spacing.sm,
  },
  menuItemWrapper: {
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  menuItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  menuItemRightText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: spacing.sm,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  menuItemArrow: {
    marginLeft: spacing.sm,
  },
  arrowText: {
    fontSize: 18,
    fontWeight: '300',
  },
  switchItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  switchItemText: {
    flex: 1,
    marginRight: spacing.md,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  footerVersion: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  modalGradient: {
    paddingBottom: spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalButton: {
    padding: spacing.sm,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  timePicker: {
    marginTop: spacing.lg,
  },
});
