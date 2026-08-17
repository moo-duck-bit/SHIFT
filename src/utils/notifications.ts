import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 알림 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 알림 권한 요청
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    }
    return true;
  } catch (error) {
    console.error('알림 권한 요청 오류:', error);
    return false;
  }
};

// 마지막 계획 설정 알림 시간 저장
const LAST_PLAN_NOTIFICATION_KEY = 'lastPlanNotification';
const REMINDER_SCHEDULE_KEY = 'reminderSchedule';
const LAST_REMINDER_KEY = 'lastReminder';
const APP_LAST_ACTIVE_KEY = 'appLastActive';

// 논리적 하루 계산 (오늘 ~ 다음날 새벽 2시)
export const getLogicalToday = (): string => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // 새벽 2시 이전이면 전날로 간주
  if (currentHour < 2) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
  
  return now.toISOString().split('T')[0];
};

// 논리적 하루가 바뀌었는지 확인
export const isNewLogicalDay = (lastDate: string): boolean => {
  return getLogicalToday() !== lastDate;
};

// 재치있는 랜덤 알림 메시지들
const REMINDER_MESSAGES = [
  {
    title: "Plan is waiting for you",
    body: "Make today a great day!"
  },
  {
    title: "Just a moment, have you set your plan?",
    body: "The secret to success is in the plan."
  },
  {
    title: "Shift is curious about you",
    body: "When will you set your if-then plan?"
  },
  {
    title: "A day without a plan is...",
    body: "A day without a plan is like a journey without a direction. Set your plan today!"
  },
  {
    title: "Before watching reels!",
    body: "Set your plan before watching reels!"
  },
  {
    title: "The first step to success",
    body: "Start by setting your plan today!"
  }
];

// 랜덤 리마인더 메시지 선택
const getRandomReminderMessage = () => {
  const randomIndex = Math.floor(Math.random() * REMINDER_MESSAGES.length);
  return REMINDER_MESSAGES[randomIndex];
};

// 계획 설정 알림 표시 (즉시)
export const showPlanReminderIfNeeded = async (): Promise<void> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return;
    }

    // 논리적 오늘 기준으로 체크
    const lastNotification = await AsyncStorage.getItem(LAST_PLAN_NOTIFICATION_KEY);
    const logicalToday = getLogicalToday();
    
    // 논리적 오늘 이미 알림을 보냈다면 스킵
    if (lastNotification === logicalToday) {
      return;
    }

    const message = getRandomReminderMessage();

    // 계획 설정 알림 표시
    await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // 즉시 표시
    });

    // 마지막 알림 시간 저장 (논리적 오늘 기준)
    await AsyncStorage.setItem(LAST_PLAN_NOTIFICATION_KEY, logicalToday);
    console.log('계획 설정 알림이 표시되었습니다.');
  } catch (error) {
    console.error('계획 설정 알림 표시 오류:', error);
  }
};

// 2시간 간격 리마인더 스케줄링
export const schedulePeriodicReminders = async (initialReminderTime: string): Promise<void> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return;
    }

    // 기존 스케줄된 리마인더 취소
    await cancelPeriodicReminders();

    const [hours, minutes] = initialReminderTime.split(':').map(Number);
    const now = new Date();
    const today = getLogicalToday();
    
    // 첫 번째 알림 시간 설정
    let nextReminderTime = new Date();
    nextReminderTime.setHours(hours, minutes, 0, 0);
    
    // 설정한 시간이 이미 지났다면 다음날로 설정
    if (nextReminderTime <= now) {
      nextReminderTime.setDate(nextReminderTime.getDate() + 1);
    }

    // 2시간 간격으로 최대 6번 리마인더 스케줄링 (12시간 동안)
    for (let i = 0; i < 6; i++) {
      const reminderTime = new Date(nextReminderTime.getTime() + (i * 2 * 60 * 60 * 1000));
      const message = getRandomReminderMessage();

             await Notifications.scheduleNotificationAsync({
         content: {
           title: message.title,
           body: message.body,
           sound: 'default',
           priority: Notifications.AndroidNotificationPriority.HIGH,
           data: { type: 'periodic_reminder', scheduleIndex: i }
         },
         trigger: {
           type: 'date',
           date: reminderTime,
         } as any,
         identifier: `periodic_reminder_${i}`
       });
    }

    // 리마인더 스케줄 정보 저장
    await AsyncStorage.setItem(REMINDER_SCHEDULE_KEY, JSON.stringify({
      logicalDay: today,
      initialTime: initialReminderTime,
      scheduledAt: now.toISOString()
    }));

    console.log(`2시간 간격 리마인더가 ${initialReminderTime}부터 시작되도록 스케줄되었습니다.`);
  } catch (error) {
    console.error('정기 리마인더 스케줄링 오류:', error);
  }
};

// 정기 리마인더 취소
export const cancelPeriodicReminders = async (): Promise<void> => {
  try {
    // 스케줄된 리마인더들 취소
    for (let i = 0; i < 6; i++) {
      await Notifications.cancelScheduledNotificationAsync(`periodic_reminder_${i}`);
    }
    
    await AsyncStorage.removeItem(REMINDER_SCHEDULE_KEY);
    console.log('정기 리마인더가 취소되었습니다.');
  } catch (error) {
    console.error('정기 리마인더 취소 오류:', error);
  }
};

// 계획 설정 완료 시 리마인더 중지
export const stopRemindersAfterPlanSet = async (): Promise<void> => {
  try {
    await cancelPeriodicReminders();
    
    const logicalToday = getLogicalToday();
    await AsyncStorage.setItem(LAST_REMINDER_KEY, logicalToday);
    
    console.log('계획 설정 완료로 인해 리마인더가 중지되었습니다.');
  } catch (error) {
    console.error('리마인더 중지 오류:', error);
  }
};

// 앱 백그라운드 상태 모니터링 시작
export const startAppStateMonitoring = (): (() => void) => {
  let appStateSubscription: any;
  let backgroundTimer: NodeJS.Timeout | null = null;

  const handleAppStateChange = async (nextAppState: string) => {
    try {
      const currentTime = Date.now();
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // 앱이 백그라운드로 갔을 때
        await AsyncStorage.setItem(APP_LAST_ACTIVE_KEY, currentTime.toString());
        
        // 30초 후 앱이 여전히 백그라운드에 있다면 알림 스케줄링
        backgroundTimer = setTimeout(async () => {
          await scheduleAppReturnReminder();
        }, 3000);
        
      } else if (nextAppState === 'active') {
        // 앱이 포그라운드로 돌아왔을 때
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
        }
        
        // 앱 복귀 알림 취소
        await cancelAppReturnReminder();
        
        // 마지막 활성 시간 업데이트
        await AsyncStorage.setItem(APP_LAST_ACTIVE_KEY, currentTime.toString());
      }
    } catch (error) {
      console.error('앱 상태 변경 처리 오류:', error);
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // 정리 함수 반환
  return () => {
    if (appStateSubscription) {
      appStateSubscription.remove();
    }
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
    }
  };
};

// 앱 복귀 알림 스케줄링
const scheduleAppReturnReminder = async (): Promise<void> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return;
    }

    // 5분 후 알림
    const reminderTime = new Date(Date.now() + 5 * 60 * 1000);

         await Notifications.scheduleNotificationAsync({
       content: {
         title: "Shift가 기다리고 있어요",
         body: "앱을 완전히 끄지 말고 백그라운드에서 실행해주세요",
         sound: 'default',
         priority: Notifications.AndroidNotificationPriority.HIGH,
         data: { type: 'app_return_reminder' }
       },
       trigger: {
         type: 'date',
         date: reminderTime,
       } as any,
       identifier: 'app_return_reminder'
     });

    console.log('앱 복귀 알림이 5분 후로 스케줄되었습니다.');
  } catch (error) {
    console.error('앱 복귀 알림 스케줄링 오류:', error);
  }
};

// 앱 복귀 알림 취소
const cancelAppReturnReminder = async (): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync('app_return_reminder');
  } catch (error) {
    console.error('앱 복귀 알림 취소 오류:', error);
  }
};

// 특정 시간에 맞춰 계획 알림 표시 여부 확인
export const checkAndShowPlanReminder = async (reminderTime: string): Promise<void> => {
  try {
    const now = new Date();
    const [hours, minutes] = reminderTime.split(':').map(Number);
    
    // 현재 시간이 설정된 알림 시간과 같은지 확인 (5분 오차 허용)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const isTimeMatch = (
      currentHour === hours && 
      Math.abs(currentMinute - minutes) <= 5
    );

    if (isTimeMatch) {
      await showPlanReminderIfNeeded();
      // 첫 알림 후 2시간 간격 리마인더 시작
      await schedulePeriodicReminders(reminderTime);
    }
  } catch (error) {
    console.error('계획 알림 시간 확인 오류:', error);
  }
};

// 모든 스케줄된 알림 취소
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(LAST_PLAN_NOTIFICATION_KEY);
    await AsyncStorage.removeItem(REMINDER_SCHEDULE_KEY);
    await AsyncStorage.removeItem(LAST_REMINDER_KEY);
    console.log('모든 알림이 취소되었습니다.');
  } catch (error) {
    console.error('모든 알림 취소 오류:', error);
  }
}; 