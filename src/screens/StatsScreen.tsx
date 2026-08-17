import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Modal,
  Alert,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  LineChart,
  BarChart,
  PieChart,
} from 'react-native-chart-kit';
import Text from '../components/ui/Text';
import { colors, spacing, radius } from '../config/design';

import {
  getSFRecords,
  getDailySFStats,
  getWeeklySFStats,
  getMonthlySFSummary,
  getHourlyDetailRecords,
  getDailyDetailRecords
} from '../config/firebase';

const { width, height } = Dimensions.get('window');

const modernColors = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#fafafa',
  surface: '#ffffff',
  surfaceLight: '#f8fafc',
  surfaceSecondary: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  glass: 'rgba(255, 255, 255, 0.7)',
  glassSecondary: 'rgba(255, 255, 255, 0.5)',
  cardBorder: '#e2e8f0',
  chartColors: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'],
};

interface PlatformStats {
  [platform: string]: number;
}

interface HourlyStatsData {
  count: number;
  duration: number;
  categories: { [category: string]: number };
  platforms: PlatformStats;
}

interface ReportData {
  totalRecords: number;
  totalDuration: number;
  hourlyStats?: { [hour: number]: HourlyStatsData };
  peakHour?: number;
  peakHourCategory?: string;
  weeklyStats?: { [day: number]: { count: number; duration: number; categories: { [category: string]: number } } };
  peakDay?: number;
  peakDayCategory?: string;
  monthlyStats?: { [week: number]: { count: number; duration: number; categories: { [category: string]: number } } };
  categoryStats?: { [category: string]: { count: number; duration: number } };
  platformStats?: { [platform: string]: { count: number; duration: number } };
  startDate?: string;
  endDate?: string;
  date?: string;
}

interface HourDetailAnalysis {
  hour: number;
  totalVideos: number;
  platforms: { youtube: number; instagram: number };
  categories: { [category: string]: number };
  topContent: any[];
  avgDuration: number;
  totalWatchTime: number;
}

export default function StatsScreen() {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Existing detailed analysis related state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedHourAnalysis, setSelectedHourAnalysis] = useState<HourDetailAnalysis | null>(null);
  const [loadingHourDetail, setLoadingHourDetail] = useState(false);
  
  // New hourly overall analysis modal state
  const [timelineModalVisible, setTimelineModalVisible] = useState(false);
  const [selectedHourIndex, setSelectedHourIndex] = useState(0);

  const getPlatformCount = (platforms: PlatformStats | undefined, platform: string): number => {
    return platforms && typeof platforms === 'object' && platform in platforms ? platforms[platform] : 0;
  };

  useEffect(() => {
    loadReportData();
  }, [activeTab, selectedDate]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      let rawData: any;
      let transformedData: ReportData;

      switch (activeTab) {
        case 'daily':
          rawData = await getDailySFStats(selectedDate);
          transformedData = {
            totalRecords: rawData.totalRecords || 0,
            totalDuration: rawData.totalDuration || 0,
            hourlyStats: rawData.hourlyStats || {},
            categoryStats: rawData.categoryStats || {},
            platformStats: rawData.platformStats || {},
            peakHour: rawData.peakHour || 0,
            peakHourCategory: rawData.peakHourCategory || 'unknown',
            date: selectedDate
          };
          break;
        case 'weekly':
          const weekStart = getWeekStart(selectedDate);
          const weekEnd = getWeekEnd(selectedDate);
          rawData = await getWeeklySFStats(weekStart, weekEnd);
          transformedData = {
            totalRecords: rawData.totalRecords || 0,
            totalDuration: rawData.totalDuration || 0,
            weeklyStats: rawData.weeklyStats || {},
            categoryStats: rawData.categoryStats || {},
            platformStats: rawData.platformStats || {},
            peakDay: rawData.peakDay || 0,
            peakDayCategory: rawData.peakDayCategory || 'unknown',
            startDate: rawData.startDate || weekStart,
            endDate: rawData.endDate || weekEnd,
            hourlyStats: {},
            peakHour: 0,
            peakHourCategory: 'unknown'
          };
          break;
        case 'monthly':
          const date = new Date(selectedDate);
          rawData = await getMonthlySFSummary(date.getFullYear(), date.getMonth() + 1);
          transformedData = {
            totalRecords: rawData.totalRecords || 0,
            totalDuration: rawData.totalDuration || 0,
            monthlyStats: rawData.monthlyStats || {},
            categoryStats: rawData.categoryStats || {},
            platformStats: rawData.platformStats || {},
            hourlyStats: {},
            weeklyStats: {},
            peakHour: 0,
            peakHourCategory: 'unknown',
            peakDay: 0,
            peakDayCategory: 'unknown'
          };
          break;
        default:
          transformedData = {
            totalRecords: 0,
            totalDuration: 0,
            hourlyStats: {},
            categoryStats: {},
            platformStats: {},
            peakHour: 0,
            peakHourCategory: 'unknown'
          };
      }

      setReportData(transformedData);
    } catch (error) {
      console.error('Error loading report data:', error);
      setReportData({
        totalRecords: 0,
        totalDuration: 0,
        hourlyStats: {},
        categoryStats: {},
        platformStats: {},
        peakHour: 0,
        peakHourCategory: 'unknown'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadHourDetailAnalysis = async (hour: number) => {
    setLoadingHourDetail(true);
    try {
      console.log(`Starting detailed analysis for ${hour}:00`);
      const hourRecords = await getHourlyDetailRecords(selectedDate, hour);
      const hourStats = reportData?.hourlyStats?.[hour];

      if (!hourStats) {
        console.log(`No statistics data for ${hour}:00`);
        return;
      }

      console.log(`Retrieved ${hourRecords.length} actual records for ${hour}:00`);
      console.log(`Statistics for ${hour}:00:`, hourStats);

      const topContent = hourRecords
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(record => ({
          id: record.id,
          platform: record.platform,
          duration: record.duration,
          category: record.analysis?.category || record.category || 'unknown',
          summary: record.analysis?.summary || 'No analysis information',
          startTime: record.startTime,
          vlmSuccess: record.vlm_success || false
        }));

      console.log(`Top content for ${hour}:00:`, topContent.slice(0, 3));

      const avgDuration = hourRecords.length > 0
        ? hourRecords.reduce((sum, r) => sum + (r.duration || 0), 0) / hourRecords.length
        : 0;

      const analysis: HourDetailAnalysis = {
        hour,
        totalVideos: hourStats.count,
        platforms: {
          youtube: getPlatformCount(hourStats.platforms, 'youtube'),
          instagram: getPlatformCount(hourStats.platforms, 'instagram')
        },
        categories: hourStats.categories,
        topContent,
        avgDuration,
        totalWatchTime: hourStats.duration
      };

      console.log(`Analysis completed for ${hour}:00:`, analysis);
      setSelectedHourAnalysis(analysis);
      setDetailModalVisible(true);
    } catch (error) {
      console.error(`Error loading detailed analysis for ${hour}:00:`, error);
      Alert.alert('Error', 'Unable to load detailed analysis.');
    } finally {
      setLoadingHourDetail(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReportData();
    setRefreshing(false);
  };

  const getWeekStart = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekStart = new Date(date.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  };

  const getWeekEnd = (dateStr: string): string => {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + 6;
    const weekEnd = new Date(date.setDate(diff));
    return weekEnd.toISOString().split('T')[0];
  };

  const getWeekNumber = (dateStr: string): number => {
    const date = new Date(dateStr);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return Math.ceil((date.getTime() - yearStart.getTime()) / weekMs);
  };

  const getMonthWeekNumber = (dateStr: string): number => {
    const date = new Date(dateStr);
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDayOfMonth.getDay();
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + dayOfWeek) / 7);
  };

  const formatDurationInMinutes = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }

    return `${minutes}m ${remainingSeconds}s`;
  };

  const changeDateBy = (days: number) => {
    const currentDate = new Date(selectedDate);
    const newDate = new Date(currentDate.setDate(currentDate.getDate() + days));
    const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const todayDate = new Date(todayKST);

    if (newDate > todayDate) {
      console.log('Blocked attempt to navigate to future date:', {
        newDate: newDate.toISOString().split('T')[0],
        today: todayDate.toISOString().split('T')[0]
      });
      return;
    }

    const formattedDate = newDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    console.log('Date changed:', {
      from: selectedDate,
      to: formattedDate,
      days: days
    });
    setSelectedDate(formattedDate);
  };

  const canNavigateNext = (): boolean => {
    const currentDate = new Date(selectedDate);
    const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const todayDate = new Date(todayKST);

    const selectedDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const todayDateOnly = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());

    return selectedDateOnly < todayDateOnly;
  };

  const truncateCategoryName = (name: string, maxLength: number = 4): string => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}..` : name;
  };

  const renderTabButton = (tab: 'daily' | 'weekly' | 'monthly', label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderDateNavigation = () => {
    let displayText = '';
    if (activeTab === 'daily') {
      displayText = new Date(selectedDate).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else if (activeTab === 'weekly') {
      const date = new Date(selectedDate);
      const month = date.getMonth() + 1;
      const weekNum = getMonthWeekNumber(selectedDate);
      displayText = `Week ${weekNum} of ${month}`;
    } else if (activeTab === 'monthly') {
      displayText = new Date(selectedDate).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long'
      });
    }

    return (
      <View style={styles.dateNavWrapper}>
        <LinearGradient
          colors={[modernColors.primary, modernColors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dateNavCard}
        >
          <BlurView intensity={20} style={styles.dateNavBlur}>
            <View style={styles.dateNavigation}>
              <TouchableOpacity
                style={styles.dateNavButton}
                onPress={() => changeDateBy(activeTab === 'weekly' ? -7 : activeTab === 'monthly' ? -30 : -1)}
              >
                <Text style={styles.dateNavButtonText}>‹</Text>
              </TouchableOpacity>
              
              <View style={styles.dateDisplay}>
                <Text style={styles.dateDisplayText}>{displayText}</Text>
              </View>
              
              <TouchableOpacity
                style={[styles.dateNavButton, !canNavigateNext() && styles.dateNavButtonDisabled]}
                onPress={() => changeDateBy(activeTab === 'weekly' ? 7 : activeTab === 'monthly' ? 30 : 1)}
                disabled={!canNavigateNext()}
              >
                <Text style={[styles.dateNavButtonText, !canNavigateNext() && styles.dateNavButtonTextDisabled]}>›</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderSummaryCards = () => {
    if (!reportData) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCardWrapper}>
            <LinearGradient
              colors={[modernColors.primary, modernColors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <BlurView intensity={20} style={styles.summaryCardBlur}>
                <Text style={styles.summaryCardValue}>{reportData.totalRecords}</Text>
                <Text style={styles.summaryCardLabel}>Total Views</Text>
              </BlurView>
            </LinearGradient>
          </View>

          <View style={styles.summaryCardWrapper}>
            <LinearGradient
              colors={[modernColors.accent, modernColors.success]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.summaryCard}
            >
              <BlurView intensity={20} style={styles.summaryCardBlur}>
                <Text style={styles.summaryCardValue}>{formatDurationInMinutes(reportData.totalDuration)}</Text>
                <Text style={styles.summaryCardLabel}>Total Watch Time</Text>
              </BlurView>
            </LinearGradient>
          </View>
        </View>
      </View>
    );
  };

  const renderDailyCharts = () => {
    if (!reportData?.hourlyStats || activeTab !== 'daily') return null;

    const hourlyEntries = Object.entries(reportData.hourlyStats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));

    if (hourlyEntries.length === 0) return null;

    const youtubeData = hourlyEntries.map(([hour, stats]) => {
      const count = getPlatformCount(stats.platforms, 'youtube');
      return count;
    });

    const instagramData = hourlyEntries.map(([hour, stats]) => {
      const count = getPlatformCount(stats.platforms, 'instagram');
      return count;
    });

    const hourlyLabels = hourlyEntries.map(([hour]) => `${hour}:00`);

    const handleChartClick = () => {
      console.log('Chart clicked - opening hourly detail modal');
      setTimelineModalVisible(true);
      setSelectedHourIndex(0);
    };

    return (
      <View style={styles.chartCardWrapper}>
        <LinearGradient
          colors={['#ffffff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.chartCard}
        >
          <BlurView intensity={10} style={styles.chartCardBlur}>
            <Text style={styles.chartTitle}>Hourly Platform Comparison (Tap for Details)</Text>
            
            <TouchableOpacity onPress={handleChartClick} activeOpacity={0.8}>
                          <LineChart
              data={{
                labels: hourlyLabels,
                datasets: [
                  {
                    data: youtubeData.length > 0 ? youtubeData : [0],
                    strokeWidth: 3,
                    color: () => modernColors.danger,
                  },
                  {
                    data: instagramData.length > 0 ? instagramData : [0],
                    strokeWidth: 3,
                    color: () => modernColors.accent,
                  }
                ],
                legend: ['YouTube', 'Instagram']
              }}
              width={width - 80}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: modernColors.surface,
                backgroundGradientTo: modernColors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "6",
                  strokeWidth: "3"
                }
              }}
              bezier
              style={styles.chart}
            />
            </TouchableOpacity>
            
            <Text style={styles.chartHint}>
              Tap the chart to view detailed hourly analysis
            </Text>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderTimelineModal = () => {
    if (!timelineModalVisible || !reportData?.hourlyStats) return null;

    const hourlyEntries = Object.entries(reportData.hourlyStats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b));

    const renderHourCard = ({ item: [hour, stats], index }: { item: [string, HourlyStatsData]; index: number }) => {
      const isSelected = index === selectedHourIndex;
      
      return (
        <TouchableOpacity
          style={[styles.timelineHourCard, isSelected && styles.timelineHourCardSelected]}
          onPress={() => {
            setSelectedHourIndex(index);
            loadHourDetailAnalysis(parseInt(hour));
          }}
        >
          <View style={styles.timelineHourHeader}>
            <Text style={[styles.timelineHourText, isSelected && styles.timelineHourTextSelected]}>
              {hour}:00
            </Text>
            <View style={[styles.timelineCountBadge, isSelected && styles.timelineCountBadgeSelected]}>
              <Text style={[styles.timelineCountText, isSelected && styles.timelineCountTextSelected]}>
                {stats.count}
              </Text>
            </View>
          </View>
          
          <View style={styles.timelinePlatformRow}>
            <View style={styles.timelinePlatformItem}>
              <Text style={styles.timelinePlatformLabel}>YouTube</Text>
              <Text style={styles.timelinePlatformValue}>
                {getPlatformCount(stats.platforms, 'youtube')}
              </Text>
            </View>
            <View style={styles.timelinePlatformItem}>
              <Text style={styles.timelinePlatformLabel}>Instagram</Text>
              <Text style={styles.timelinePlatformValue}>
                {getPlatformCount(stats.platforms, 'instagram')}
              </Text>
            </View>
          </View>
          
          <View style={styles.timelineDurationContainer}>
            <Text style={styles.timelineDurationText}>
              {formatDurationInMinutes(stats.duration)}
            </Text>
          </View>
          
          {Object.keys(stats.categories).length > 0 && (
            <View style={styles.timelineCategoriesContainer}>
              {Object.entries(stats.categories)
                .sort(([,a], [,b]) => (b as number) - (a as number))
                .slice(0, 3)
                .map(([category, count]) => (
                  <View key={category} style={styles.timelineCategoryTag}>
                    <Text style={styles.timelineCategoryTagText}>
                      {truncateCategoryName(category, 6)} ({count as number})
                    </Text>
                  </View>
                ))
              }
            </View>
          )}
        </TouchableOpacity>
      );
    };

    return (
      <Modal
        visible={timelineModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTimelineModalVisible(false)}
      >
        <SafeAreaView style={styles.timelineModalContainer}>
          <View style={styles.timelineModalHeader}>
            <Text style={styles.timelineModalTitle}>
              Hourly Detailed Analysis - {new Date(selectedDate).toLocaleDateString('en-US')}
            </Text>
            <TouchableOpacity
              style={styles.timelineModalCloseButton}
              onPress={() => setTimelineModalVisible(false)}
            >
              <Text style={styles.timelineModalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.timelineModalContent}>
            <Text style={styles.timelineModalSubtitle}>
              Tap each hour to view detailed analysis for that time period
            </Text>
            
            <FlatList
              data={hourlyEntries}
              renderItem={renderHourCard}
              keyExtractor={([hour]) => hour}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.timelineHourList}
              snapToInterval={width * 0.8}
              decelerationRate="fast"
              pagingEnabled={false}
            />
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  const renderWeeklyCharts = () => {
    if (!reportData?.weeklyStats || activeTab !== 'weekly') return null;

    const weeklyData = Object.entries(reportData.weeklyStats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, stats]) => stats.count);

    const weeklyLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (weeklyData.length === 0) return null;

    return (
      <View style={styles.chartCardWrapper}>
        <LinearGradient
          colors={['#ffffff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.chartCard}
        >
          <BlurView intensity={10} style={styles.chartCardBlur}>
            <Text style={styles.chartTitle}>Daily Viewing Pattern</Text>
            <BarChart
              data={{
                labels: weeklyLabels,
                datasets: [{ data: weeklyData }]
              }}
              width={width - 80}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: modernColors.surface,
                backgroundGradientTo: modernColors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
                barPercentage: 0.6,
                propsForVerticalLabels: {
                  fontSize: 12,
                },
              }}
              style={styles.chart}
              fromZero
            />
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderMonthlyCharts = () => {
    if (!reportData?.monthlyStats || activeTab !== 'monthly') return null;

    const monthlyData = Object.entries(reportData.monthlyStats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, stats]) => stats.count);

    const monthlyLabels = Object.keys(reportData.monthlyStats)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(week => `Week ${week}`);

    if (monthlyData.length === 0) return null;

    return (
      <View style={styles.chartCardWrapper}>
        <LinearGradient
          colors={['#ffffff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.chartCard}
        >
          <BlurView intensity={10} style={styles.chartCardBlur}>
            <Text style={styles.chartTitle}>Weekly Viewing Pattern</Text>
            <LineChart
              data={{
                labels: monthlyLabels,
                datasets: [{ data: monthlyData }]
              }}
              width={width - 80}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: modernColors.surface,
                backgroundGradientTo: modernColors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(6, 182, 212, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(15, 23, 42, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: modernColors.accent
                }
              }}
              bezier
              style={styles.chart}
            />
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderCategoryChart = () => {
    if (!reportData?.categoryStats) return null;

    const categories = Object.entries(reportData.categoryStats)
      .sort(([,a], [,b]) => (b as { duration: number }).duration - (a as { duration: number }).duration)
      .slice(0, 5);

    if (categories.length === 0) return null;

    const getCategoryKorean = (category: string): string => {
      const categoryMap: { [key: string]: string } = {};
      return categoryMap[category] || truncateCategoryName(category);
    };

    const pieData = categories.map(([category, stats], index) => ({
      name: truncateCategoryName(getCategoryKorean(category)),
      population: stats.duration,
      color: modernColors.chartColors[index % modernColors.chartColors.length],
      legendFontColor: modernColors.text,
      legendFontSize: 11,
    }));

    return (
      <View style={styles.chartCardWrapper}>
        <LinearGradient
          colors={['#ffffff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.chartCard}
        >
          <BlurView intensity={10} style={styles.chartCardBlur}>
            <Text style={styles.chartTitle}>Watch Time by Category</Text>
            <PieChart
              data={pieData}
              width={width - 80}
              height={200}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="20"
              style={styles.chart}
              hasLegend={true}
            />
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderPlatformComparison = () => {
    if (!reportData?.platformStats) return null;

    const platforms = Object.entries(reportData.platformStats);
    if (platforms.length === 0) return null;

    return (
      <View style={styles.chartCardWrapper}>
        <LinearGradient
          colors={['#ffffff', '#f8fafc']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.chartCard}
        >
          <BlurView intensity={10} style={styles.chartCardBlur}>
            <Text style={styles.chartTitle}>Platform Comparison</Text>
            <View style={styles.platformContainer}>
              {platforms.map(([platform, stats]) => (
                <View key={platform} style={styles.platformItem}>
                  <View style={styles.platformHeader}>
                    <Text style={styles.platformName}>
                      {platform === 'instagram' ? 'Instagram' : 'YouTube'}
                    </Text>
                    <View style={[styles.platformBadge, { backgroundColor: modernColors.primary }]}>
                      <Text style={styles.platformBadgeText}>{stats.count}</Text>
                    </View>
                  </View>
                  <Text style={styles.platformDuration}>
                    {formatDurationInMinutes(stats.duration)}
                  </Text>
                </View>
              ))}
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderInsight = () => {
    if (!reportData) return null;

    let insightText = '';
    if (activeTab === 'daily' && reportData.peakHour !== undefined) {
      const peakHourFormatted = `${reportData.peakHour}:00`;
      const categoryKorean = reportData.peakHourCategory === 'unknown' ? 'Unclassified' : reportData.peakHourCategory;
      insightText = `The most active time was ${peakHourFormatted}, mainly watching ${categoryKorean} content.`;
    } else if (activeTab === 'weekly' && reportData.peakDay !== undefined) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const peakDayName = days[reportData.peakDay] || 'Unknown day';
      const categoryKorean = reportData.peakDayCategory === 'unknown' ? 'Unclassified' : reportData.peakDayCategory;
      insightText = `The most active day was ${peakDayName}, mainly watching ${categoryKorean} content.`;
    } else {
      insightText = `Watched a total of ${reportData.totalRecords} content during this period.`;
    }

    return (
      <View style={styles.insightCardWrapper}>
        <LinearGradient
          colors={[modernColors.warning, modernColors.danger]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.insightCard}
        >
          <BlurView intensity={20} style={styles.insightCardBlur}>
            <Text style={styles.insightTitle}>Primary Viewing Pattern</Text>
            <Text style={styles.insightText}>{insightText}</Text>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  const renderDetailAnalysisModal = () => {
    if (!detailModalVisible || !selectedHourAnalysis) return null;

    const analysis = selectedHourAnalysis;

    const categoryEntries = Object.entries(analysis.categories).sort(([,a], [,b]) => (b as number) - (a as number));
    const categoryPieData = categoryEntries.slice(0, 5).map(([category, count], index) => ({
      name: category,
      population: count,
      color: modernColors.chartColors[index % modernColors.chartColors.length],
      legendFontColor: modernColors.text,
      legendFontSize: 12,
    }));

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.detailModalOverlay}>
          <View style={styles.detailModalContainer}>
            <View style={styles.detailModalHeader}>
              <Text style={styles.detailModalTitle}>
                {analysis.hour}:00 Detailed Analysis
              </Text>
              <TouchableOpacity
                style={styles.detailModalCloseButton}
                onPress={() => setDetailModalVisible(false)}
              >
                <Text style={styles.detailModalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.detailModalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.hourSummaryContainer}>
                <Text style={styles.sectionTitle}>Hourly Summary</Text>
                <View style={styles.summaryStatsRow}>
                  <View style={styles.summaryStatItem}>
                    <Text style={styles.summaryStatValue}>{analysis.totalVideos}</Text>
                    <Text style={styles.summaryStatLabel}>Total Videos</Text>
                  </View>
                  <View style={styles.summaryStatItem}>
                    <Text style={styles.summaryStatValue}>{analysis.platforms.youtube}</Text>
                    <Text style={styles.summaryStatLabel}>YouTube</Text>
                  </View>
                  <View style={styles.summaryStatItem}>
                    <Text style={styles.summaryStatValue}>{analysis.platforms.instagram}</Text>
                    <Text style={styles.summaryStatLabel}>Instagram</Text>
                  </View>
                  <View style={styles.summaryStatItem}>
                    <Text style={styles.summaryStatValue}>{formatDurationInMinutes(analysis.totalWatchTime)}</Text>
                    <Text style={styles.summaryStatLabel}>Total Watch Time</Text>
                  </View>
                </View>
              </View>

              {categoryPieData.length > 0 && (
                <View style={styles.categoryAnalysisContainer}>
                  <Text style={styles.sectionTitle}>Category Analysis</Text>
                  <PieChart
                    data={categoryPieData}
                    width={width - 80}
                    height={180}
                    chartConfig={{
                      color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    }}
                    accessor="population"
                    backgroundColor="transparent"
                    paddingLeft="-1"
                    style={styles.categoryChart}
                    hasLegend={true}
                  />

                  <View style={styles.categoryListContainer}>
                    {categoryEntries.map(([category, count]) => (
                      <View key={category} style={styles.categoryListItem}>
                        <Text style={styles.categoryName}>{category}</Text>
                        <Text style={styles.categoryCount}>{count as number} videos</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {analysis.topContent.length > 0 && (
                <View style={styles.topContentContainer}>
                  <Text style={styles.sectionTitle}>Top {analysis.topContent.length} videos</Text>
                  {analysis.topContent.map((content, index) => (
                    <View key={content.id || index} style={styles.contentItem}>
                      <View style={styles.contentHeader}>
                        <View style={styles.contentRank}>
                          <Text style={styles.contentRankText}>{index + 1}</Text>
                        </View>
                        <View style={styles.contentInfo}>
                          <View style={styles.contentMetaRow}>
                            <Text style={styles.contentPlatform}>
                              {content.platform === 'youtube' ? 'YouTube' : 'Instagram'}
                            </Text>
                            <Text style={styles.contentDuration}>
                              {formatDurationInMinutes(content.duration)}
                            </Text>
                            <Text style={styles.contentTime}>
                              {new Date(content.startTime).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {content.summary && content.summary !== 'No analysis information' && (
                        <View style={styles.contentSummaryContainer}>
                          <Text style={styles.contentSummary}>{content.summary}</Text>
                        </View>
                      )}

                      <View style={styles.contentFooter}>
                        <View style={styles.contentCategoryBadge}>
                          <Text style={styles.contentCategoryText}>{content.category}</Text>
                        </View>
                        {content.vlmSuccess && (
                          <View style={styles.vlmBadge}>
                            <Text style={styles.vlmBadgeText}>AI Analysis Completed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

           
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={modernColors.background} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Detailed viewing pattern analysis</Text>
      </View>

      <View style={styles.tabContainer}>
        {renderTabButton('daily', 'Daily')}
        {renderTabButton('weekly', 'Weekly')}
        {renderTabButton('monthly', 'Monthly')}
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {renderDateNavigation()}
          {renderSummaryCards()}
          {renderPlatformComparison()}
          {renderDailyCharts()}
          {renderWeeklyCharts()}
          {renderMonthlyCharts()}
          {renderCategoryChart()}
          {renderInsight()}
        </View>
      </ScrollView>

      {renderTimelineModal()}
      {renderDetailAnalysisModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: modernColors.textSecondary,
    fontWeight: '400',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: modernColors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: modernColors.cardBorder,
  },
  activeTabButton: {
    backgroundColor: modernColors.primary,
    borderColor: modernColors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  dateNavWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: modernColors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  dateNavCard: {
    borderRadius: radius.xl,
  },
  dateNavBlur: {
    padding: spacing.lg,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: modernColors.glassSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dateNavButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  dateNavButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  dateDisplayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  summaryContainer: {
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCardWrapper: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: modernColors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  summaryCard: {
    borderRadius: radius.xl,
  },
  summaryCardBlur: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  summaryCardValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  summaryCardLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  chartCardWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: modernColors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  chartCard: {
    borderRadius: radius.xl,
    backgroundColor: modernColors.surface,
  },
  chartCardBlur: {
    padding: spacing.lg,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: modernColors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  chart: {
    borderRadius: radius.lg,
  },
  chartHint: {
    fontSize: 12,
    color: modernColors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  platformContainer: {
    gap: spacing.md,
  },
  platformItem: {
    backgroundColor: modernColors.surfaceLight,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: modernColors.cardBorder,
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
    color: modernColors.text,
  },
  platformBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  platformBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  platformDuration: {
    fontSize: 14,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  insightCardWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: modernColors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  insightCard: {
    borderRadius: radius.xl,
  },
  insightCardBlur: {
    padding: spacing.lg,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  insightText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '400',
  },
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalContainer: {
    backgroundColor: modernColors.surface,
    borderRadius: radius.xl,
    width: width * 0.95,
    height: height * 0.9,
    overflow: 'hidden',
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.cardBorder,
    backgroundColor: modernColors.primary,
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  detailModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModalCloseText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  detailModalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: spacing.md,
  },
  hourSummaryContainer: {
    backgroundColor: modernColors.surfaceLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.primary,
    marginBottom: spacing.xs,
  },
  summaryStatLabel: {
    fontSize: 12,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  categoryAnalysisContainer: {
    backgroundColor: modernColors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: modernColors.cardBorder,
  },
  categoryChart: {
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  categoryListContainer: {
    gap: spacing.sm,
  },
  categoryListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: modernColors.surfaceLight,
    borderRadius: radius.md,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
  },
  categoryCount: {
    fontSize: 14,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  topContentContainer: {
    marginBottom: spacing.lg,
  },
  contentItem: {
    backgroundColor: modernColors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: modernColors.cardBorder,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  contentRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: modernColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contentRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  contentInfo: {
    flex: 1,
  },
  contentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  contentPlatform: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.text,
  },
  contentDuration: {
    fontSize: 12,
    color: modernColors.textSecondary,
    fontWeight: '500',
  },
  contentTime: {
    fontSize: 12,
    color: modernColors.textMuted,
  },
  contentSummaryContainer: {
    backgroundColor: modernColors.surfaceLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contentSummary: {
    fontSize: 13,
    color: modernColors.textSecondary,
    lineHeight: 18,
  },
  contentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentCategoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: modernColors.accent,
  },
  contentCategoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  vlmBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: modernColors.success,
  },
  vlmBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  insightContainer: {
    backgroundColor: modernColors.surfaceLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  // 새로운 타임라인 모달 스타일
  timelineModalContainer: {
    flex: 1,
    backgroundColor: modernColors.background,
  },
  timelineModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: modernColors.cardBorder,
    backgroundColor: modernColors.surface,
  },
  timelineModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
    flex: 1,
  },
  timelineModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: modernColors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineModalCloseText: {
    fontSize: 18,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  timelineModalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  timelineModalSubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  timelineHourList: {
    paddingHorizontal: spacing.sm,
  },
  timelineHourCard: {
    width: width * 0.75,
    backgroundColor: modernColors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: modernColors.cardBorder,
    shadowColor: modernColors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineHourCardSelected: {
    borderColor: modernColors.primary,
    backgroundColor: modernColors.surfaceLight,
  },
  timelineHourHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timelineHourText: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
  },
  timelineHourTextSelected: {
    color: modernColors.primary,
  },
  timelineCountBadge: {
    backgroundColor: modernColors.textMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  timelineCountBadgeSelected: {
    backgroundColor: modernColors.primary,
  },
  timelineCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  timelineCountTextSelected: {
    color: '#ffffff',
  },
  timelinePlatformRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  timelinePlatformItem: {
    alignItems: 'center',
  },
  timelinePlatformLabel: {
    fontSize: 12,
    color: modernColors.textMuted,
    marginBottom: spacing.xs,
  },
  timelinePlatformValue: {
    fontSize: 18,
    fontWeight: '700',
    color: modernColors.text,
  },
  timelineDurationContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timelineDurationText: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.textSecondary,
  },
  timelineCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  timelineCategoryTag: {
    backgroundColor: modernColors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  timelineCategoryTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
});
