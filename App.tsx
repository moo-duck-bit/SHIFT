import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { NavigationContainer, useNavigation, createNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, AppState, Alert } from 'react-native';
import { auth, getFormattedTodayPlan, getRecentData, getDailyPlan, saveGuidanceResult } from './src/config/firebase';
import { setupBackgroundListeners } from './src/utils/access';
import { colors, spacing } from './src/config/design';
import SplashScreen from './src/screens/SplashScreen';
import AuthScreen from './src/screens/AuthScreen';
import TabNavigator from './src/navigation/TabNavigator';
import Text from './src/components/ui/Text';
import MyModule from './modules/my-module/src/MyModule';
import { useAuth } from './src/utils/auth';
import { CameraScreen } from './src/screens/CameraScreen';

interface PermissionContextType {
  hasPerm: boolean;
  accEnabled: boolean;
  isLoggedIn: boolean;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

// 전역 네비게이션 참조 생성
const navigationRef = createNavigationContainerRef();

function AppNavigator({ onSignOut }: { onSignOut: () => void }) {
  return <TabNavigator onSignOut={onSignOut} />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const { loading, user, error, isLoggedIn } = useAuth();
  const [hasPerm, setHasPerm] = useState(false);
  const [accEnabled, setAccEnabled] = useState(false);
  const appState = useRef(AppState.currentState);
  const [cam, setCam] = useState(false);
  const [pln, setPln] = useState<{ act: string; ts: string; alt: string } | null>(null);

  const checkPerm = async () => {
    try {
      const perm = await MyModule.checkUsageStatsPermission();
      setHasPerm(perm);
    } catch (error) {
      console.error('App - 사용량 통계 권한 확인 오류:', error);
      setHasPerm(false);
    }
  };

  const checkAccSvc = async () => {
    try {
      const accEnabled = await MyModule.isAccessibilityServiceEnabled();
      setAccEnabled(accEnabled);
      console.log('App - 접근성 서비스 상태:', accEnabled);
    } catch (error) {
      console.error('App - 접근성 서비스 상태 확인 오류:', error);
      setAccEnabled(false);
    }
  };

  const initMyModuleService = async () => {
    try {
      const result = await MyModule.startReelsTracking();
      console.log('App - MyModule 서비스 초기화 완료');
    } catch (error) {
      console.error('App - MyModule 서비스 초기화 실패:', error);
    }
  };

  // 계획 오버레이 액션 처리 함수
  const handlePlanOverlayAction = (event: any) => {
    console.log('계획 오버레이 액션 수신:', event.action);
    
    if (event.action === 'plan_modified') {
        console.log('계획 수정 요청됨 - 네비게이션 시작');
        
        const attemptNavigation = (retryCount = 0) => {
            if (navigationRef.isReady()) {
                try {
                    console.log('Plan 스크린으로 네비게이션 시도');
                    navigationRef.navigate('Plan' as never);
                    console.log('Plan 스크린 네비게이션 성공');
                    return;
                } catch (error) {
                    console.error('Plan 스크린 네비게이션 오류:', error);
                }
            }
            
            // 재시도 로직
            if (retryCount < 5) {
                setTimeout(() => attemptNavigation(retryCount + 1), 200);
            } else {
                console.error('네비게이션 최종 실패');
            }
        };
        
        // 즉시 시도 (딜레이 제거)
        attemptNavigation();
    }

    if (event.action === 'execute_plan') {
        const attemptNavigation = (retryCount = 0) => {
            if (navigationRef.isReady()) {
                try {
                    navigationRef.navigate('Home' as never);
                    const pd = event.planData || {};
                    setPln({ act: pd.activity || '', ts: pd.timeSlot || '', alt: pd.alternativeAction || '' });
                    setCam(true);
                    return;
                } catch (error) {
                    console.error('카메라 전환 네비게이션 오류:', error);
                }
            }
            if (retryCount < 5) setTimeout(() => attemptNavigation(retryCount + 1), 200);
        };
        attemptNavigation();
    }
  };

  // 앱 초기화
  useEffect(() => {
    let isInitialized = false;
    const initializeApp = async () => {
      if (isInitialized) return;
      isInitialized = true;
      console.log('App - 앱 초기화 시작');
      await checkPerm();
      await checkAccSvc();
      await initMyModuleService();
    };
    initializeApp();
  }, []);

  // 백그라운드 리스너 설정
  useEffect(() => {
    console.log('App - 백그라운드 리스너 설정 시작');
    const cleanupBackgroundListeners = setupBackgroundListeners();
    return cleanupBackgroundListeners;
  }, []);

  // 계획 오버레이 액션 리스너 설정 (메인 App 컴포넌트에서 처리)
  useEffect(() => {
    const planOverlayListener = MyModule.addListener('onPlanOverlayAction', handlePlanOverlayAction);
    return () => {
      planOverlayListener?.remove();
    };
  }, []);

  // 개입 메시지 Firebase 저장 리스너 설정
  useEffect(() => {
    const guidanceListener = MyModule.addListener('onGuidanceResultSave', async (event: any) => {
      try {
        console.log('개입 메시지 Firebase 저장 이벤트 수신:', event.personalizedMessage?.substring(0, 50));
        
        await saveGuidanceResult({
          requestId: event.requestId,
          userId: event.userId,
          triggerContext: event.triggerContext,
          timestamp: event.timestamp,
          success: event.success,
          guidanceText: event.guidanceText,
          personalizedMessage: event.personalizedMessage,
          processingTime: event.processingTime,
          retryCount: event.retryCount
        });
        
        console.log('개입 메시지가 Firebase에 성공적으로 저장됨');
        
      } catch (error) {
        console.error('개입 메시지 Firebase 저장 실패:', error);
      }
    });

    return () => {
      guidanceListener?.remove();
    };
  }, []);

  // AppState 변경 감지
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', async (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        console.log('App - 앱이 포그라운드로 전환됨');
        await checkPerm();
        await checkAccSvc();
      }
      appState.current = nextState;
    });

    return () => {
      appStateSub?.remove();
    };
  }, []);

  // 사용자 로그인 시 계획을 InstagramReelsTracker에 전달
  useEffect(() => {
    const loadAndCacheTodayPlan = async () => {
      if (user?.uid) {
        try {
          console.log('App - 사용자 로그인 감지, 오늘의 계획 로드 시작');
          const slots = await getFormattedTodayPlan();
          if (slots && slots.length > 0) {
            await MyModule.cacheTodayPlan(slots);
            console.log('App - 오늘의 계획을 InstagramReelsTracker에 전달 완료:', slots.length, '개 슬롯');
          } else {
            console.log('App - 오늘의 계획이 없음');
          }
        } catch (error) {
          console.error('App - 계획 로드 및 전달 오류:', error);
        }
      }
    };
    loadAndCacheTodayPlan();
  }, [user]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleAuthSuccess = () => {
    // Auth state will be handled by onAuthStateChanged
  };

  const handleSignOut = () => {
    // Auth state will be handled by onAuthStateChanged
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (loading) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="h2">오류 발생</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Text>앱을 다시 시작해주세요.</Text>
      </View>
    );
  }

  return (
    <PermissionContext.Provider value={{ hasPerm, accEnabled, isLoggedIn }}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="auto" />
        {user ? (
          <AppNavigator onSignOut={handleSignOut} />
        ) : (
          <AuthScreen onAuth={handleAuthSuccess} />
        )}
      </NavigationContainer>
      <CameraScreen visible={cam} isInt={true} onClose={() => { setCam(false); }} pln={pln || undefined} />
    </PermissionContext.Provider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorDetail: {
    marginBottom: spacing.md,
  },
});
