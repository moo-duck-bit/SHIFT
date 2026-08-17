import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Alert,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { colors, spacing, radius } from '../config/design';
import Text from '../components/ui/Text';
import { formatDuration } from '../utils/validation';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePermissions } from '../../App';
import { getTodayData, getSFRecords } from '../config/firebase';
import MyModule from '../../modules/my-module';

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

export default function HomeScreen() {
  const { hasPerm, accEnabled, isLoggedIn } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const [todayData, setTodayData] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [yesterdayData, setYesterdayData] = useState<any>(null);

  useEffect(() => {
    console.log('HomeScreen - Permission status:', { hasPerm, accEnabled });
  }, [hasPerm, accEnabled]);

  useEffect(() => {
    // HomeScreen.tsx 수정
    const loadHomeData = async () => {
      try {
        if (!isLoggedIn) {
          console.log('HomeScreen - Not logged in');
          return;
        }
        
        console.log('HomeScreen - Starting home data load');
        
        // Use getSFRecords() instead of getTodayData()
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = await getSFRecords(today, today);
        
        if (todayRecords) {
          // Process data
          let totalDuration = 0;
          let totalCount = todayRecords.length;
          let instagramCount = 0, instagramDuration = 0;
          let youtubeCount = 0, youtubeDuration = 0;
          let sessionCount = Math.max(1, Math.ceil(todayRecords.length / 10));
          
          todayRecords.forEach(record => {
            const duration = Math.round(record.duration / 60);
            totalDuration += duration;
            
            if (record.platform === 'youtube') {
              youtubeCount++;
              youtubeDuration += duration;
            } else {
              instagramCount++;
              instagramDuration += duration;
            }
          });
          
          const todayData = {
            totalDuration,
            totalCount,
            sessionCount,
            averagePerSession: totalCount > 0 ? Math.round((totalDuration / sessionCount) * 10) / 10 : 0,
            lastSessionStart: todayRecords[0]?.startTime?.getTime() || Date.now(),
            platformBreakdown: {
              instagram: { count: instagramCount, duration: instagramDuration },
              youtube: { count: youtubeCount, duration: youtubeDuration }
            }
          };
          
          setTodayData(todayData);
        }

        // 주간, 어제 데이터도 동일하게 getSFRecords() 사용
        const weeklyStats = await getWeeklyStats();
        if (weeklyStats) setWeeklyData(weeklyStats);

        const yesterday = await getYesterdayData();
        if (yesterday) setYesterdayData(yesterday);

      } catch (error) {
        console.error('HomeScreen - Error loading data:', error);
      }
    };


    loadHomeData();
  }, [isLoggedIn]);

  const getWeeklyStats = async () => {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const startDate = sevenDaysAgo.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const records = await getSFRecords(startDate, endDate); // Use existing function
      
      let totalDuration = 0;
      let totalCount = records.length;
      let instagramCount = 0, instagramDuration = 0;
      let youtubeCount = 0, youtubeDuration = 0;
      
      records.forEach(record => {
        const duration = Math.round(record.duration / 60); // Convert to minutes
        totalDuration += duration;
        
        if (record.platform === 'youtube') {
          youtubeCount++;
          youtubeDuration += duration;
        } else {
          instagramCount++;
          instagramDuration += duration;
        }
      });
      
      return {
        totalDuration,
        totalCount,
        averageDaily: Math.round(totalDuration / 7),
        platformBreakdown: {
          instagram: { count: instagramCount, duration: instagramDuration },
          youtube: { count: youtubeCount, duration: youtubeDuration }
        }
      };
    } catch (error) {
      console.error('Error fetching weekly data:', error);
      return null;
    }
  };

  const getYesterdayData = async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const records = await getSFRecords(yesterdayStr, yesterdayStr); // 기존 함수 사용
      
      
      let totalDuration = 0;
      let totalCount = records.length;
      
      records.forEach(record => {
        totalDuration += Math.round(record.duration / 60);
      });
      
      return {
        totalDuration,
        totalCount
      };
    } catch (error) {
      console.error('Error fetching yesterday data:', error);
      return null;
    }
  };

  const handlePermissionRequest = async () => {
    try {
      try {
        MyModule.openUsageAccessSettings();
        if(!hasPerm) {
          Alert.alert(
            '권한 설정',
            'Shocroll 앱을 찾아서 사용량 액세스를 허용해주세요.\n\n경로: 설정 → 앱 → 특별한 앱 액세스 → 기기 또는 기타 앱 사용량 액세스',
            [
              {
                text: '취소',
                style: 'cancel'
              },
              {
                text: '설정 완료',
                onPress: () => {
                  console.log('사용량 통계 권한 설정 완료');
                }
              }
            ]
          );
        }
      } catch (settingsError) {
        console.error("Failed to open settings screen:", settingsError);
      }
    } catch (error) {
      console.error("Permission request error:", error);
      Alert.alert('Error', 'An error occurred while requesting permission');
    }
  };

  const handleAccessibilityRequest = async () => {
    try {
      await MyModule.openAccessibilitySettings();
      if (!accEnabled){
        Alert.alert(
          'Accessibility Service',
          'Please enable Shift accessibility service.\nSettings -> Accessibility -> Installed apps -> Shift',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error("Accessibility service request error:", error);
      Alert.alert('Error', 'An error occurred while requesting accessibility service');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('HomeScreen - Starting refresh');
      if (isLoggedIn) {
        const today = await getTodayData();
        const weekly = await getWeeklyStats();
        const yesterday = await getYesterdayData();
        
        if (today) setTodayData(today);
        if (weekly) setWeeklyData(weekly);
        if (yesterday) setYesterdayData(yesterday);
      }
      console.log('HomeScreen - Refresh completed');
    } catch (error) {
      console.error('HomeScreen - Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderWelcomeCard = () => {
    const totalCount = todayData?.totalCount || 0;
    const totalDuration = todayData?.totalDuration || 0;
    
    return (
      <View style={styles.welcomeWrapper}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.welcomeCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <BlurView intensity={20} style={styles.welcomeBlur}>
            <Text style={styles.welcomeGreeting}>Today's Short-form</Text>
            <Text style={styles.welcomeSubtext}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>
            
            <View style={styles.todayStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{totalCount}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{Math.round(totalDuration)}min</Text>
                <Text style={styles.statLabel}>Total Time</Text>
              </View>
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderInsightCard = () => {
    const todayTotal = todayData?.totalDuration || 0;
    const yesterdayTotal = yesterdayData?.totalDuration || 0;
    const weeklyAverage = weeklyData?.averageDaily || 0;
    
    let insightText = "First short-form viewing of the day!";
    let comparisonText = "";
    
    if (todayTotal > 0) {
      if (yesterdayData && yesterdayTotal > 0) {
        const diff = todayTotal - yesterdayTotal;
        if (diff > 0) {
          comparisonText = `Watched ${diff} minutes more than yesterday`;
        } else if (diff < 0) {
          comparisonText = `Watched ${Math.abs(diff)} minutes less than yesterday`;
        } else {
          comparisonText = "Same viewing time as yesterday";
        }
      }
      
      if (weeklyData && weeklyAverage > 0) {
        const weeklyDiff = todayTotal - weeklyAverage;
        if (weeklyDiff > 0) {
          insightText = `Watched ${weeklyDiff} minutes more than weekly average`;
        } else if (weeklyDiff < 0) {
          insightText = `Watched ${Math.abs(weeklyDiff)} minutes less than weekly average`;
        } else {
          insightText = "Similar usage to weekly average";
        }
      } else {
        insightText = "Insufficient data for this week";
      }
    }

    return (
      <View style={styles.insightWrapper}>
        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>Usage Comparison</Text>
          <Text style={styles.insightText}>{insightText}</Text>
          {comparisonText && (
            <Text style={styles.insightSubtext}>{comparisonText}</Text>
          )}
        </View>
      </View>
    );
  };

  const renderQuickStats = () => {
    const instagramData = todayData?.platformBreakdown?.instagram || { count: 0, duration: 0 };
    const youtubeData = todayData?.platformBreakdown?.youtube || { count: 0, duration: 0 };

    return (
      <View style={styles.quickStatsContainer}>
        <Text style={styles.sectionTitle}>Platform Summary</Text>
        <View style={styles.platformRow}>
          <View style={styles.platformCardWrapper}>
            <View style={styles.platformCard}>
              <View style={styles.platformHeader}>
                <Text style={styles.platformName}>Reels</Text>
                <View style={[styles.platformBadge, { backgroundColor: '#E1306C' }]}>
                  <Text style={styles.platformBadgeText}>{instagramData.count}</Text>
                </View>
              </View>
              <Text style={styles.platformDuration}>{Math.round(instagramData.duration)}min</Text>
            </View>
          </View>
          
          <View style={styles.platformCardWrapper}>
            <View style={styles.platformCard}>
              <View style={styles.platformHeader}>
                <Text style={styles.platformName}>Shorts</Text>
                <View style={[styles.platformBadge, { backgroundColor: '#FF0000' }]}>
                  <Text style={styles.platformBadgeText}>{youtubeData.count}</Text>
                </View>
              </View>
              <Text style={styles.platformDuration}>{Math.round(youtubeData.duration)}min</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderWeeklyComparison = () => {
    const todayTotal = todayData?.totalDuration || 0;
    const weeklyAverage = weeklyData?.averageDaily || 0;
    
    if (!weeklyData || weeklyAverage === 0) {
      return (
        <View style={styles.comparisonWrapper}>
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonTitle}>Compare with Weekly Average</Text>
            <Text style={styles.noDataText}>Insufficient data</Text>
          </View>
        </View>
      );
    }
    
    const isHigherThanAverage = todayTotal > weeklyAverage;
    
    return (
      <View style={styles.comparisonWrapper}>
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>Compare with Weekly Average</Text>
          <View style={styles.comparisonContent}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Today</Text>
              <Text style={styles.comparisonValue}>{Math.round(todayTotal)}min</Text>
            </View>
            <View style={styles.comparisonDivider}>
              <Text style={[
                styles.comparisonIndicator,
                { color: isHigherThanAverage ? lightColors.warning : lightColors.success }
              ]}>
                {isHigherThanAverage ? '↑' : '↓'}
              </Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Weekly Average</Text>
              <Text style={styles.comparisonValue}>{Math.round(weeklyAverage)}min</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPermissionCard = () => {
    if (hasPerm && accEnabled) return null;

    const issues = [];
    if (!hasPerm) issues.push('Usage Statistics');
    if (!accEnabled) issues.push('Short-form Tracking');

    return (
      <View style={styles.permissionCardWrapper}>
        <LinearGradient
          colors={['#f093fb', '#f5576c']}
          style={styles.permissionCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <BlurView intensity={20} style={styles.permissionCardBlur}>
            <Text style={styles.permissionTitle}>Permission Setup Required</Text>
            <Text style={styles.permissionDesc}>
              {issues.join(', ')} permission is required for accurate analysis
            </Text>
            <View style={styles.permissionButtons}>
              {!hasPerm && (
                <TouchableOpacity 
                  style={styles.permissionButton}
                  onPress={handlePermissionRequest}
                >
                  <Text style={styles.permissionButtonText}>Usage Statistics Permission</Text>
                </TouchableOpacity>
              )}
              {!accEnabled && (
                <TouchableOpacity 
                  style={styles.permissionButton}
                  onPress={handleAccessibilityRequest}
                >
                  <Text style={styles.permissionButtonText}>Short-form Tracking Permission</Text>
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={lightColors.background} />
      <SafeAreaView style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={lightColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Shift</Text>
              <Text style={styles.subtitle}>Short-form analysis</Text>
            </View> 

            {renderPermissionCard()}
            {renderWelcomeCard()} 
            {renderInsightCard()}
            {renderQuickStats()}
            {renderWeeklyComparison()}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: lightColors.text,
    marginBottom: spacing.xs,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: lightColors.textSecondary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: lightColors.text,
    marginBottom: spacing.md,
    letterSpacing: -0.3,
  },

  // 환영 카드
  welcomeWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  welcomeCard: {
    borderRadius: radius.xl,
  },
  welcomeBlur: {
    padding: spacing.xl,
  },
  welcomeGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.lg,
  },
  todayStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing.lg,
  },

  // 인사이트 카드
  insightWrapper: {
    marginBottom: spacing.lg,
  },
  insightCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: lightColors.text,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  insightText: {
    fontSize: 16,
    color: lightColors.text,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  insightSubtext: {
    fontSize: 14,
    color: lightColors.textSecondary,
    lineHeight: 20,
  },

  // 빠른 통계
  quickStatsContainer: {
    marginBottom: spacing.lg,
  },
  platformRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  platformCardWrapper: {
    flex: 1,
  },
  platformCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  platformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  platformName: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
  },
  platformBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    minWidth: 24,
    alignItems: 'center',
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  platformDuration: {
    fontSize: 14,
    color: lightColors.textSecondary,
    fontWeight: '500',
  },

  // 주간 비교
  comparisonWrapper: {
    marginBottom: spacing.lg,
  },
  comparisonCard: {
    backgroundColor: lightColors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comparisonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: lightColors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  comparisonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 14,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: lightColors.text,
  },
  comparisonDivider: {
    paddingHorizontal: spacing.lg,
  },
  comparisonIndicator: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  noDataText: {
    fontSize: 14,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },

  // 권한 카드
  permissionCardWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  permissionCard: {
    borderRadius: radius.xl,
  },
  permissionCardBlur: {
    padding: spacing.xl,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButtons: {
    gap: spacing.sm,
  },
  permissionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
