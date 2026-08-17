// import React, { useState, useEffect, useRef } from 'react';
// import {
//   View,
//   ScrollView,
//   StyleSheet,
//   RefreshControl,
//   TouchableOpacity,
//   Dimensions,
//   StatusBar
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { LinearGradient } from 'expo-linear-gradient';
// import { BlurView } from 'expo-blur';
// import Text from '../components/ui/Text';
// import { colors, spacing, radius } from '../config/design';
// import { formatDuration } from '../utils/validation';
// import { 
//   getSFRecords, 
//   getDailySFStats, 
//   getWeeklySFStats, 
//   getMonthlySFSummary 
// } from '../config/firebase';

// const { width } = Dimensions.get('window');

// const lightColors = {
//   primary: '#2563eb',
//   secondary: '#7c3aed',
//   accent: '#06b6d4',
//   success: '#10b981',
//   warning: '#f59e0b',
//   danger: '#ef4444',
//   background: '#ffffff',
//   surface: '#f8fafc',
//   surfaceLight: '#f1f5f9',
//   text: '#1e293b',
//   textSecondary: '#64748b',
//   glass: 'rgba(255, 255, 255, 0.8)',
//   cardBorder: '#e2e8f0',
// };

// // ReportScreen.tsx 상단의 인터페이스 수정
// interface ReportData {
//     totalRecords: number;
//     totalDuration: number;
//     // For daily data (optional)
//     hourlyStats?: { [hour: number]: { count: number; duration: number; categories: { [category: string]: number } } };
//     peakHour?: number;
//     peakHourCategory?: string;
//     // For weekly data (optional)
//     weeklyStats?: { [day: number]: { count: number; duration: number; categories: { [category: string]: number } } };
//     peakDay?: number;
//     peakDayCategory?: string;
//     // For monthly data (optional)
//     monthlyStats?: { [week: number]: { count: number; duration: number; categories: { [category: string]: number } } };
//     // Common fields (optionally change)
//     categoryStats?: { [category: string]: { count: number; duration: number } };
//     platformStats?: { [platform: string]: { count: number; duration: number } };
//     startDate?: string;
//     endDate?: string;
//     date?: string;
//   }
  

// export default function ReportScreen() {
//   const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
//   const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
//   const [reportData, setReportData] = useState<ReportData | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);

//   useEffect(() => {
//     loadReportData();
//   }, [activeTab, selectedDate]);

//   const loadReportData = async () => {
//     setLoading(true);
//     try {
//       let rawData: any;
//       let transformedData: ReportData;
      
//       switch (activeTab) {
//         case 'daily':
//           rawData = await getDailySFStats(selectedDate);
//           transformedData = {
//             totalRecords: rawData.totalRecords || 0,
//             totalDuration: rawData.totalDuration || 0,
//             hourlyStats: rawData.hourlyStats || {},
//             categoryStats: rawData.categoryStats || {},
//             platformStats: rawData.platformStats || {},
//             peakHour: rawData.peakHour || 0,
//             peakHourCategory: rawData.peakHourCategory || 'unknown',
//             date: selectedDate
//           };
//           break;
          
//         case 'weekly':
//           const weekStart = getWeekStart(selectedDate);
//           const weekEnd = getWeekEnd(selectedDate);
//           rawData = await getWeeklySFStats(weekStart, weekEnd);
          
//           // 주간 데이터를 ReportData 형태로 변환
//           transformedData = {
//             totalRecords: rawData.totalRecords || 0,
//             totalDuration: rawData.totalDuration || 0,
//             weeklyStats: rawData.weeklyStats || {},
//             categoryStats: rawData.categoryStats || {},
//             platformStats: rawData.platformStats || {},
//             peakDay: rawData.peakDay || 0,
//             peakDayCategory: rawData.peakDayCategory || 'unknown',
//             startDate: rawData.startDate || weekStart,
//             endDate: rawData.endDate || weekEnd,
//             // 주간 데이터에서 누락된 필드에 기본값 설정
//             hourlyStats: {},
//             peakHour: 0,
//             peakHourCategory: 'unknown'
//           };
//           break;
          
//         case 'monthly':
//           const date = new Date(selectedDate);
//           rawData = await getMonthlySFSummary(date.getFullYear(), date.getMonth() + 1);
          
//           // 월간 데이터를 ReportData 형태로 변환
//           transformedData = {
//             totalRecords: rawData.totalRecords || 0,
//             totalDuration: rawData.totalDuration || 0,
//             monthlyStats: rawData.monthlyStats || {},
//             categoryStats: rawData.categoryStats || {},
//             platformStats: rawData.platformStats || {},
//             // 월간 데이터에서 누락된 필드에 기본값 설정
//             hourlyStats: {},
//             weeklyStats: {},
//             peakHour: 0,
//             peakHourCategory: 'unknown',
//             peakDay: 0,
//             peakDayCategory: 'unknown'
//           };
//           break;
          
//         default:
//           transformedData = {
//             totalRecords: 0,
//             totalDuration: 0,
//             hourlyStats: {},
//             categoryStats: {},
//             platformStats: {},
//             peakHour: 0,
//             peakHourCategory: 'unknown'
//           };
//       }
      
//       setReportData(transformedData);
//     } catch (error) {
//       console.error('리포트 데이터 로드 오류:', error);
//       // 오류 시 빈 데이터로 설정
//       setReportData({
//         totalRecords: 0,
//         totalDuration: 0,
//         hourlyStats: {},
//         categoryStats: {},
//         platformStats: {},
//         peakHour: 0,
//         peakHourCategory: 'unknown'
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleRefresh = async () => {
//     setRefreshing(true);
//     await loadReportData();
//     setRefreshing(false);
//   };

//   const getWeekStart = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     const day = date.getDay();
//     const diff = date.getDate() - day;
//     const weekStart = new Date(date.setDate(diff));
//     return weekStart.toISOString().split('T')[0];
//   };

//   const getWeekEnd = (dateStr: string): string => {
//     const date = new Date(dateStr);
//     const day = date.getDay();
//     const diff = date.getDate() - day + 6;
//     const weekEnd = new Date(date.setDate(diff));
//     return weekEnd.toISOString().split('T')[0];
//   };

//   const changeDateBy = (days: number) => {
//     const currentDate = new Date(selectedDate);
//     currentDate.setDate(currentDate.getDate() + days);
//     setSelectedDate(currentDate.toISOString().split('T')[0]);
//   };

//   const renderTabButton = (tab: 'daily' | 'weekly' | 'monthly', label: string) => (
//     <TouchableOpacity
//       style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
//       onPress={() => setActiveTab(tab)}
//     >
//       <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
//         {label}
//       </Text>
//     </TouchableOpacity>
//   );

//   const renderDateNavigation = () => (
//     <View style={styles.dateNavWrapper}>
//       <LinearGradient
//         colors={[lightColors.primary, lightColors.secondary]}
//         style={styles.dateNavCard}
//         start={{ x: 0, y: 0 }}
//         end={{ x: 1, y: 1 }}
//       >
//         <BlurView intensity={20} style={styles.dateNavBlur}>
//           <View style={styles.dateNavigation}>
//             <TouchableOpacity
//               style={styles.dateNavButton}
//               onPress={() => changeDateBy(-1)}
//             >
//               <Text style={styles.dateNavButtonText}>◀</Text>
//             </TouchableOpacity>
            
//             <View style={styles.dateDisplay}>
//               <Text style={styles.dateDisplayText}>
//                 {new Date(selectedDate).toLocaleDateString('ko-KR', {
//                   year: 'numeric',
//                   month: 'long',
//                   day: 'numeric'
//                 })}
//               </Text>
//             </View>
            
//             <TouchableOpacity
//               style={styles.dateNavButton}
//               onPress={() => changeDateBy(1)}
//             >
//               <Text style={styles.dateNavButtonText}>▶</Text>
//             </TouchableOpacity>
//           </View>
//         </BlurView>
//       </LinearGradient>
//     </View>
//   );

//   const renderSummaryCards = () => {
//     if (!reportData) return null;

//     return (
//       <View style={styles.summaryContainer}>
//         <View style={styles.summaryRow}>
//           <View style={styles.summaryCardWrapper}>
//             <LinearGradient
//               colors={[lightColors.success, lightColors.accent]}
//               style={styles.summaryCard}
//               start={{ x: 0, y: 0 }}
//               end={{ x: 1, y: 1 }}
//             >
//               <BlurView intensity={20} style={styles.summaryCardBlur}>
//                 <Text style={styles.summaryCardValue}>{reportData.totalRecords}</Text>
//                 <Text style={styles.summaryCardLabel}>총 시청 횟수</Text>
//               </BlurView>
//             </LinearGradient>
//           </View>
          
//           <View style={styles.summaryCardWrapper}>
//             <LinearGradient
//               colors={[lightColors.warning, lightColors.danger]}
//               style={styles.summaryCard}
//               start={{ x: 0, y: 0 }}
//               end={{ x: 1, y: 1 }}
//             >
//               <BlurView intensity={20} style={styles.summaryCardBlur}>
//                 <Text style={styles.summaryCardValue}>{formatDuration(reportData.totalDuration)}</Text>
//                 <Text style={styles.summaryCardLabel}>총 시청 시간</Text>
//               </BlurView>
//             </LinearGradient>
//           </View>
//         </View>
//       </View>
//     );
//   };

//   const renderPlatformComparison = () => {
//     if (!reportData?.platformStats) return null;

//     const platforms = Object.entries(reportData.platformStats);
//     if (platforms.length === 0) return null;

//     return (
//       <View style={styles.chartCardWrapper}>
//         <LinearGradient
//           colors={[lightColors.glass, lightColors.surface]}
//           style={styles.chartCard}
//         >
//           <BlurView intensity={30} style={styles.chartCardBlur}>
//             <Text style={styles.chartTitle}>플랫폼별 비교</Text>
//             <View style={styles.platformContainer}>
//               {platforms.map(([platform, stats]) => (
//                 <View key={platform} style={styles.platformItem}>
//                   <View style={styles.platformHeader}>
//                     <Text style={styles.platformName}>
//                       {platform === 'instagram' ? 'Instagram' : 'YouTube'}
//                     </Text>
//                     <View style={[
//                       styles.platformBadge,
//                       { backgroundColor: platform === 'instagram' ? lightColors.danger : lightColors.primary }
//                     ]}>
//                       <Text style={styles.platformBadgeText}>{stats.count}</Text>
//                     </View>
//                   </View>
//                   <Text style={styles.platformDuration}>{formatDuration(stats.duration)}</Text>
//                 </View>
//               ))}
//             </View>
//           </BlurView>
//         </LinearGradient>
//       </View>
//     );
//   };

//   const renderHourlyAnalysis = () => {
//     if (!reportData?.hourlyStats) return null;

//     const hourlyData = Object.entries(reportData.hourlyStats)
//       .sort(([a], [b]) => parseInt(a) - parseInt(b))
//       .slice(0, 6); // 상위 6개 시간대만 표시

//     if (hourlyData.length === 0) return null;

//     return (
//       <View style={styles.chartCardWrapper}>
//         <LinearGradient
//           colors={[lightColors.glass, lightColors.surface]}
//           style={styles.chartCard}
//         >
//           <BlurView intensity={30} style={styles.chartCardBlur}>
//             <Text style={styles.chartTitle}>시간대별 분석</Text>
//             <View style={styles.hourlyContainer}>
//               {hourlyData.map(([hour, stats]) => {
//                 const percentage = (stats.count / reportData.totalRecords) * 100;
//                 return (
//                   <View key={hour} style={styles.hourlyItem}>
//                     <View style={styles.hourlyHeader}>
//                       <Text style={styles.hourlyTime}>{hour}:00</Text>
//                       <Text style={styles.hourlyCount}>{stats.count}개</Text>
//                     </View>
//                     <View style={styles.hourlyBarContainer}>
//                       <View 
//                         style={[
//                           styles.hourlyBar,
//                           { width: `${Math.max(percentage, 5)}%` }
//                         ]}
//                       />
//                     </View>
//                     <Text style={styles.hourlyDuration}>{formatDuration(stats.duration)}</Text>
//                   </View>
//                 );
//               })}
//             </View>
//           </BlurView>
//         </LinearGradient>
//       </View>
//     );
//   };

//   const renderCategoryAnalysis = () => {
//     if (!reportData?.categoryStats) return null;

//     const categories = Object.entries(reportData.categoryStats)
//       .sort(([,a], [,b]) => b.duration - a.duration)
//       .slice(0, 5); // 상위 5개 카테고리만 표시

//     if (categories.length === 0) return null;

//     const getCategoryKorean = (category: string): string => {
//       const categoryMap: { [key: string]: string } = {
//         'Animation': '애니메이션',
//         'Autos & Vehicles': '자동차/차량',
//         'Hip-Hop': '힙합',
//         'Pets & Animals': '동물/펫',
//         'Sports': '스포츠',
//         'Travel & Events': '여행/이벤트',
//         'Gaming': '게임',
//         'V-logs': '일상/블로그',
//         'Comedy': '코미디',
//         'Movie': '영화',
//         'News & Politics': '뉴스/정치',
//         'How-to & Style': '꿀팁',
//         'Education': '교육',
//         'Science & Technology': '과학/기술',
//         'Shopping': '쇼핑',
//         'Food & Drink': '음식/요리',
//         'K-POP': 'K-POP',
//         'Lifestyle': '라이프스타일',
//         'Drama': '드라마',
//         'Variety show': '예능',
//         'Short-form Challenge': '숏폼 챌린지',
//         'MEME': '밈'
//       };
//       return categoryMap[category] || category;
//     };

//     return (
//       <View style={styles.chartCardWrapper}>
//         <LinearGradient
//           colors={[lightColors.glass, lightColors.surface]}
//           style={styles.chartCard}
//         >
//           <BlurView intensity={30} style={styles.chartCardBlur}>
//             <Text style={styles.chartTitle}>카테고리별 분석</Text>
//             <View style={styles.categoryContainer}>
//               {categories.map(([category, stats]) => (
//                 <View key={category} style={styles.categoryItem}>
//                   <View style={styles.categoryHeader}>
//                     <Text style={styles.categoryName}>{getCategoryKorean(category)}</Text>
//                     <Text style={styles.categoryCount}>{stats.count}개</Text>
//                   </View>
//                   <Text style={styles.categoryDuration}>{formatDuration(stats.duration)}</Text>
//                 </View>
//               ))}
//             </View>
//           </BlurView>
//         </LinearGradient>
//       </View>
//     );
//   };

//   // 주간 분석을 위한 새로운 렌더링 함수
//   const renderWeeklyAnalysis = () => {
//     if (!reportData?.weeklyStats || activeTab !== 'weekly') return null;

//     const weeklyData = Object.entries(reportData.weeklyStats)
//       .sort(([a], [b]) => parseInt(a) - parseInt(b));

//     if (weeklyData.length === 0) return null;

//     const getDayName = (dayIndex: number): string => {
//       const days = ['일', '월', '화', '수', '목', '금', '토'];
//       return days[dayIndex] || '알 수 없음';
//     };

//     return (
//       <View style={styles.chartCardWrapper}>
//         <LinearGradient
//           colors={[lightColors.glass, lightColors.surface]}
//           style={styles.chartCard}
//         >
//           <BlurView intensity={30} style={styles.chartCardBlur}>
//             <Text style={styles.chartTitle}>요일별 분석</Text>
//             <View style={styles.hourlyContainer}>
//               {weeklyData.map(([day, stats]) => {
//                 const percentage = (stats.count / reportData.totalRecords) * 100;
//                 return (
//                   <View key={day} style={styles.hourlyItem}>
//                     <View style={styles.hourlyHeader}>
//                       <Text style={styles.hourlyTime}>{getDayName(parseInt(day))}</Text>
//                       <Text style={styles.hourlyCount}>{stats.count}개</Text>
//                     </View>
//                     <View style={styles.hourlyBarContainer}>
//                       <View 
//                         style={[
//                           styles.hourlyBar,
//                           { width: `${Math.max(percentage, 5)}%` }
//                         ]}
//                       />
//                     </View>
//                     <Text style={styles.hourlyDuration}>{formatDuration(stats.duration)}</Text>
//                   </View>
//                 );
//               })}
//             </View>
//           </BlurView>
//         </LinearGradient>
//       </View>
//     );
//   };

//   const renderPeakInsight = () => {
//     if (!reportData) return null;

//     let insightText = '';
    
//     if (activeTab === 'daily' && reportData.peakHour !== undefined) {
//       const peakHourFormatted = `${reportData.peakHour}:00`;
//       const categoryKorean = reportData.peakHourCategory === 'unknown' ? '분류 없음' : reportData.peakHourCategory;
//       insightText = `가장 활발한 시간대는 ${peakHourFormatted}이며, 주로 ${categoryKorean} 콘텐츠를 시청했습니다.`;
//     } else if (activeTab === 'weekly' && reportData.peakDay !== undefined) {
//       const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
//       const peakDayName = days[reportData.peakDay] || '알 수 없는 요일';
//       const categoryKorean = reportData.peakDayCategory === 'unknown' ? '분류 없음' : reportData.peakDayCategory;
//       insightText = `가장 활발한 요일은 ${peakDayName}이며, 주로 ${categoryKorean} 콘텐츠를 시청했습니다.`;
//     } else {
//       insightText = `이 기간 동안 총 ${reportData.totalRecords}개의 콘텐츠를 시청했습니다.`;
//     }

//     return (
//       <View style={styles.insightCardWrapper}>
//         <LinearGradient
//           colors={[lightColors.secondary, lightColors.primary]}
//           style={styles.insightCard}
//           start={{ x: 0, y: 0 }}
//           end={{ x: 1, y: 1 }}
//         >
//           <BlurView intensity={20} style={styles.insightCardBlur}>
//             <Text style={styles.insightTitle}>주요 시청 패턴</Text>
//             <Text style={styles.insightText}>
//               {insightText}
//             </Text>
//           </BlurView>
//         </LinearGradient>
//       </View>
//     );
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor={lightColors.background} />
      
//       {/* 헤더 */}
//       <View style={styles.header}>
//         <Text style={styles.title}>시청 분석 리포트</Text>
//         <Text style={styles.subtitle}>상세한 시청 패턴 분석</Text>
//       </View>

//       {/* 탭 버튼 */}
//       <View style={styles.tabContainer}>
//         {renderTabButton('daily', '일간')}
//         {renderTabButton('weekly', '주간')}
//         {renderTabButton('monthly', '월간')}
//       </View>

//       <ScrollView
//         style={styles.scrollView}
//         contentContainerStyle={styles.content}
//         refreshControl={
//           <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
//         }
//         showsVerticalScrollIndicator={false}
//       >
//         {/* 날짜 네비게이션 */}
//         {renderDateNavigation()}

//         {/* 요약 카드 */}
//         {renderSummaryCards()}

//         {/* 플랫폼 비교 */}
//         {renderPlatformComparison()}

//         {/* 조건부 렌더링 - 탭에 따라 다른 분석 표시 */}
//         {activeTab === 'daily' && renderHourlyAnalysis()}
//         {activeTab === 'weekly' && renderWeeklyAnalysis()}

//         {/* 카테고리별 분석 */}
//         {renderCategoryAnalysis()}

//         {/* 인사이트 */}
//         {renderPeakInsight()}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: lightColors.background,
//   },
//   scrollView: {
//     flex: 1,
//   },
//   content: {
//     padding: spacing.lg,
//     paddingBottom: spacing.xxxl,
//   },
//   header: {
//     alignItems: 'center',
//     paddingVertical: spacing.lg,
//     paddingHorizontal: spacing.lg,
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: 'bold',
//     color: lightColors.text,
//     marginBottom: spacing.xs,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: lightColors.textSecondary,
//   },
//   tabContainer: {
//     flexDirection: 'row',
//     paddingHorizontal: spacing.lg,
//     marginBottom: spacing.lg,
//     gap: spacing.sm,
//   },
//   tabButton: {
//     flex: 1,
//     paddingVertical: spacing.md,
//     paddingHorizontal: spacing.lg,
//     borderRadius: radius.lg,
//     backgroundColor: lightColors.surface,
//     alignItems: 'center',
//   },
//   activeTabButton: {
//     backgroundColor: lightColors.primary,
//   },
//   tabButtonText: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: lightColors.textSecondary,
//   },
//   activeTabButtonText: {
//     color: '#ffffff',
//   },
//   dateNavWrapper: {
//     marginBottom: spacing.lg,
//     borderRadius: radius.xl,
//     overflow: 'hidden',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   dateNavCard: {
//     borderRadius: radius.xl,
//   },
//   dateNavBlur: {
//     padding: spacing.lg,
//   },
//   dateNavigation: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//   },
//   dateNavButton: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     backgroundColor: 'rgba(255, 255, 255, 0.2)',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   dateNavButtonText: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: '#ffffff',
//   },
//   dateDisplay: {
//     flex: 1,
//     alignItems: 'center',
//   },
//   dateDisplayText: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#ffffff',
//   },
//   summaryContainer: {
//     marginBottom: spacing.lg,
//   },
//   summaryRow: {
//     flexDirection: 'row',
//     gap: spacing.md,
//   },
//   summaryCardWrapper: {
//     flex: 1,
//     borderRadius: radius.xl,
//     overflow: 'hidden',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   summaryCard: {
//     borderRadius: radius.xl,
//   },
//   summaryCardBlur: {
//     padding: spacing.lg,
//     alignItems: 'center',
//   },
//   summaryCardValue: {
//     fontSize: 24,
//     fontWeight: 'bold',
//     color: '#ffffff',
//     marginBottom: spacing.xs,
//   },
//   summaryCardLabel: {
//     fontSize: 12,
//     color: 'rgba(255, 255, 255, 0.8)',
//     textAlign: 'center',
//   },
//   chartCardWrapper: {
//     marginBottom: spacing.lg,
//     borderRadius: radius.lg,
//     overflow: 'hidden',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   chartCard: {
//     borderRadius: radius.lg,
//   },
//   chartCardBlur: {
//     padding: spacing.lg,
//   },
//   chartTitle: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: lightColors.text,
//     marginBottom: spacing.lg,
//     textAlign: 'center',
//   },
//   platformContainer: {
//     gap: spacing.md,
//   },
//   platformItem: {
//     backgroundColor: lightColors.surface,
//     padding: spacing.md,
//     borderRadius: radius.md,
//   },
//   platformHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: spacing.xs,
//   },
//   platformName: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: lightColors.text,
//   },
//   platformBadge: {
//     paddingHorizontal: spacing.sm,
//     paddingVertical: spacing.xs,
//     borderRadius: radius.sm,
//   },
//   platformBadgeText: {
//     fontSize: 12,
//     fontWeight: 'bold',
//     color: '#ffffff',
//   },
//   platformDuration: {
//     fontSize: 14,
//     color: lightColors.textSecondary,
//   },
//   hourlyContainer: {
//     gap: spacing.md,
//   },
//   hourlyItem: {
//     backgroundColor: lightColors.surface,
//     padding: spacing.md,
//     borderRadius: radius.md,
//   },
//   hourlyHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: spacing.xs,
//   },
//   hourlyTime: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: lightColors.text,
//   },
//   hourlyCount: {
//     fontSize: 12,
//     color: lightColors.textSecondary,
//   },
//   hourlyBarContainer: {
//     height: 4,
//     backgroundColor: lightColors.surfaceLight,
//     borderRadius: 2,
//     marginVertical: spacing.xs,
//   },
//   hourlyBar: {
//     height: '100%',
//     backgroundColor: lightColors.primary,
//     borderRadius: 2,
//   },
//   hourlyDuration: {
//     fontSize: 12,
//     color: lightColors.textSecondary,
//   },
//   categoryContainer: {
//     gap: spacing.md,
//   },
//   categoryItem: {
//     backgroundColor: lightColors.surface,
//     padding: spacing.md,
//     borderRadius: radius.md,
//   },
//   categoryHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: spacing.xs,
//   },
//   categoryName: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: lightColors.text,
//   },
//   categoryCount: {
//     fontSize: 12,
//     color: lightColors.textSecondary,
//   },
//   categoryDuration: {
//     fontSize: 12,
//     color: lightColors.textSecondary,
//   },
//   insightCardWrapper: {
//     marginBottom: spacing.lg,
//     borderRadius: radius.xl,
//     overflow: 'hidden',
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.1,
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   insightCard: {
//     borderRadius: radius.xl,
//   },
//   insightCardBlur: {
//     padding: spacing.lg,
//   },
//   insightTitle: {
//     fontSize: 16,
//     fontWeight: 'bold',
//     color: '#ffffff',
//     marginBottom: spacing.sm,
//     textAlign: 'center',
//   },
//   insightText: {
//     fontSize: 14,
//     color: 'rgba(255, 255, 255, 0.9)',
//     textAlign: 'center',
//     lineHeight: 20,
//   },
// });
