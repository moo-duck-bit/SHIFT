import { requireNativeModule } from 'expo-modules-core';
import { MyModuleEvents, AppUsageStatsResult, SocialMediaUsageResult, ReelsStatistics, UsageStatsPermissionDiagnostic } from './MyModule.types';

// 네이티브 모듈 인터페이스 정의
interface MyModuleInterface {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
  
  // 사용 통계 관련 함수
  checkUsageStatsPermission(): Promise<boolean>;
  openUsageAccessSettings(): void;
  diagnoseUsageStatsPermission(): Promise<UsageStatsPermissionDiagnostic>;
  getAppUsageStats(packageNames: string[], startTimeMillis: number, endTimeMillis: number): Promise<AppUsageStatsResult>;
  getSocialMediaUsage(startTimeMillis: number, endTimeMillis: number): Promise<SocialMediaUsageResult>;
  
  // 릴스 트래킹 관련 함수
  isAccessibilityServiceEnabled(): Promise<boolean>;
  openAccessibilitySettings(): Promise<{ success: boolean; message: string }>;
  checkOverlayPermission(): Promise<boolean>;
  openOverlaySettings(): { success: boolean; message: string };
  startReelsTracking(): Promise<any>;
  stopReelsTracking(): Promise<boolean>;
  getReelsStatistics(): Promise<string>;
  resetReelsStatistics(): Promise<boolean>;
  clearVLMResult(docId: string): Promise<boolean>;
  
  // Firebase 관련 함수들
  isUserLoggedIn(): Promise<boolean>;
  signOutUser(): Promise<boolean>;
  
  // 현재 계획 조회 함수
  getCurrentPlan(): Promise<{
    activity: string;
    timeSlot: string;
    alternativeAction: string;
  }>;
  
  // 계획 정보 전달 함수
  setPlanInfo(activity: string, timeSlot: string, alternativeAction: string): Promise<boolean>;
  cacheTodayPlan(slots: Array<{ startTime: string; endTime: string; activity: string; alternativeAction?: string }>): Promise<boolean>;
  cacheTodaySessionData(sessionData: any): Promise<boolean>;
  
  // 계획 오버레이 함수
  showPlanOverlay(activity: string, timeSlot: string, alternativeAction: string, sessionDuration: number, reelsCount: number): Promise<boolean>;
  hidePlanOverlay(): Promise<boolean>;
  cleanupPlanOverlay(): Promise<boolean>;
  
  // VLM 결과 저장 함수
  storeVLMResult(docId: string, category: string, analysis: any): Promise<void>;
  
  // VLM 결과 로컬 저장 관련 함수들
  getPendingVLMResults(): Promise<string[]>;
  readVLMResult(fileName: string): Promise<string | null>;
  deleteVLMResult(fileName: string): Promise<boolean>;
  
  // 사용자 반응 로컬 저장 관련 함수들 (추가)
  getPendingUserInteractions(): Promise<string[]>;
  readUserInteraction(fileName: string): Promise<string | null>;
  deleteUserInteraction(fileName: string): Promise<boolean>;
  
  requestGuidanceText(requestId: string, triggerContext: 'timer_15min', dailyPlansData: any): Promise<boolean>;
  
  // 개인화 메시지 전달 함수
  setPersonalizedMessage(message: string): Promise<boolean>;
  
  // Instagram 상태 리셋 함수
  resetInstagramState(): Promise<boolean>;
  
  // YouTube Shorts 추적 관련 함수들
  startYouTubeShortsTracking(): Promise<any>;
  stopYouTubeShortsTracking(): Promise<boolean>;
  getYouTubeShortsStatistics(): Promise<string>;
  resetYouTubeShortsStatistics(): Promise<boolean>;
  isYouTubeShortsServiceEnabled(): Promise<boolean>;
  
  // 사용자 반응 관련 함수들
  saveUserReaction(reactionData: any): Promise<boolean>;
  saveOverlayInteraction(interactionData: any): Promise<boolean>;
  saveUserInteraction(interactionData: any): Promise<boolean>;
  getUserInteractionHistory(): Promise<string>;
  getTodayUserReactions(): Promise<string>;
  getReactionStats(days?: number): Promise<string>;
}

// 이벤트 리스너 인터페이스
interface EventListener {
  remove: () => void;
}

// 확장된 모듈 인터페이스 (이벤트 포함)
interface ExtendedModuleInterface extends MyModuleInterface {
  addListener: (eventName: string, listener: (event: any) => void) => EventListener;
  removeAllListeners: (eventName: string) => void;
}

// 네이티브 모듈 객체 로드
const NativeMyModule = requireNativeModule('MyModule');

// 기본 함수 구현 확인
const hasFunction = (name: string): boolean => {
  return typeof NativeMyModule[name] === 'function';
};

// 커스텀 이벤트 리스너 구현
const createEventListener = (eventName: string, listener: (event: any) => void): EventListener => {
  if (!hasFunction('addEventListener')) {
    console.warn(`Native module doesn't support events`);
    return { remove: () => {} };
  }

  const subscription = NativeMyModule.addEventListener(eventName, listener);
  return {
    remove: () => {
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    }
  };
};

// 커스텀 이벤트 리스너 제거 구현
const removeAllEventListeners = (eventName: string): void => {
  if (hasFunction('removeEventListeners')) {
    NativeMyModule.removeEventListeners(eventName);
  }
};

// 타입 어설션을 통해 모듈 준비
const MyModule: ExtendedModuleInterface = {
  // 기본 함수
  PI: NativeMyModule.PI,
  hello: NativeMyModule.hello || (() => "Hello (fallback)"),
  setValueAsync: NativeMyModule.setValueAsync || ((value: string) => Promise.resolve()),
  
  // 사용 통계 관련 함수
  checkUsageStatsPermission: NativeMyModule.checkUsageStatsPermission || (() => Promise.resolve(false)),
  openUsageAccessSettings: NativeMyModule.openUsageAccessSettings || (() => {}),
  diagnoseUsageStatsPermission: NativeMyModule.diagnoseUsageStatsPermission || (() => Promise.resolve({
    packageName: 'unknown',
    androidVersion: 0,
    buildVersion: 'unknown',
    finalPermissionStatus: false
  } as UsageStatsPermissionDiagnostic)),
  getAppUsageStats: NativeMyModule.getAppUsageStats || (() => Promise.resolve({})),
  getSocialMediaUsage: NativeMyModule.getSocialMediaUsage || (() => Promise.resolve({ instagram: 0, youtube: 0, tiktok: 0 })),
  
  // 릴스 트래킹 관련 함수
  isAccessibilityServiceEnabled: NativeMyModule.isAccessibilityServiceEnabled || (() => Promise.resolve(false)),
  openAccessibilitySettings: NativeMyModule.openAccessibilitySettings || (() => Promise.resolve({ success: false, message: "" })),
  checkOverlayPermission: NativeMyModule.checkOverlayPermission || (() => Promise.resolve(false)),
  openOverlaySettings: NativeMyModule.openOverlaySettings || (() => ({ success: false, message: "Not available" })),
  startReelsTracking: NativeMyModule.startReelsTracking || (() => Promise.resolve(false)),
  stopReelsTracking: NativeMyModule.stopReelsTracking || (() => Promise.resolve(false)),
  getReelsStatistics: NativeMyModule.getReelsStatistics || (() => Promise.resolve('{"inReelsMode":false,"totalReelsViewTime":0,"reelsViewCount":0,"scrollCount":0,"averageTimePerReel":0}')),
  resetReelsStatistics: NativeMyModule.resetReelsStatistics || (() => Promise.resolve(false)),
  
  // Firebase 관련 함수들
  isUserLoggedIn: NativeMyModule.isUserLoggedIn || (() => Promise.resolve(false)),
  signOutUser: NativeMyModule.signOutUser || (() => Promise.resolve(false)),
  
  // 현재 계획 조회 함수
  getCurrentPlan: NativeMyModule.getCurrentPlan || (() => Promise.resolve({ activity: "Unknown", timeSlot: "Unknown", alternativeAction: "Unknown" })),
  
  // 계획 정보 전달 함수
  setPlanInfo: NativeMyModule.setPlanInfo || (() => Promise.resolve(false)),
  cacheTodayPlan: NativeMyModule.cacheTodayPlan || (() => Promise.resolve(false)),
  cacheTodaySessionData: NativeMyModule.cacheTodaySessionData || ((sessionData: any) => Promise.resolve(false)),
  
  // 계획 오버레이 함수
  showPlanOverlay: NativeMyModule.showPlanOverlay || (() => Promise.resolve(false)),
  hidePlanOverlay: NativeMyModule.hidePlanOverlay || (() => Promise.resolve(false)),
  cleanupPlanOverlay: NativeMyModule.cleanupPlanOverlay || (() => Promise.resolve(false)),
  
  // VLM 결과 저장 함수
  storeVLMResult: NativeMyModule.storeVLMResult || ((docId: string, category: string, analysis: any) => Promise.resolve()),
  
  // VLM 결과 로컬 저장 관련 함수들
  getPendingVLMResults: NativeMyModule.getPendingVLMResults || (() => Promise.resolve([])),
  readVLMResult: NativeMyModule.readVLMResult || ((fileName: string) => Promise.resolve(null)),
  deleteVLMResult: NativeMyModule.deleteVLMResult || ((fileName: string) => Promise.resolve(false)),
  
  // 사용자 반응 로컬 저장 관련 함수들 (추가)
  getPendingUserInteractions: NativeMyModule.getPendingUserInteractions || (() => Promise.resolve([])),
  readUserInteraction: NativeMyModule.readUserInteraction || ((fileName: string) => Promise.resolve(null)),
  deleteUserInteraction: NativeMyModule.deleteUserInteraction || ((fileName: string) => Promise.resolve(false)),
  
  // 텍스트 모델 안내문 요청 함수
  requestGuidanceText: NativeMyModule.requestGuidanceText || ((requestId: string, triggerContext: 'timer_15min', dailyPlansData: any) => Promise.resolve(false)),
  
  // 개인화 메시지 전달 함수
  setPersonalizedMessage: NativeMyModule.setPersonalizedMessage || ((message: string) => Promise.resolve(true)),
  
  // Instagram 상태 리셋 함수
  resetInstagramState: NativeMyModule.resetInstagramState || (() => Promise.resolve(false)),
  
  // YouTube Shorts 추적 관련 함수들
  startYouTubeShortsTracking: NativeMyModule.startYouTubeShortsTracking || (() => Promise.resolve(false)),
  stopYouTubeShortsTracking: NativeMyModule.stopYouTubeShortsTracking || (() => Promise.resolve(false)),
  getYouTubeShortsStatistics: NativeMyModule.getYouTubeShortsStatistics || (() => Promise.resolve('{"inShortsMode":false,"totalShortsViewTime":0,"shortsViewCount":0,"scrollCount":0,"averageTimePerShort":0}')),
  resetYouTubeShortsStatistics: NativeMyModule.resetYouTubeShortsStatistics || (() => Promise.resolve(false)),
  isYouTubeShortsServiceEnabled: NativeMyModule.isYouTubeShortsServiceEnabled || (() => Promise.resolve(false)),
  
  // 사용자 반응 관련 함수들
  saveUserReaction: NativeMyModule.saveUserReaction || ((reactionData: any) => Promise.resolve(false)),
  saveOverlayInteraction: NativeMyModule.saveOverlayInteraction || ((interactionData: any) => Promise.resolve(false)),
  saveUserInteraction: NativeMyModule.saveUserInteraction || ((interactionData: any) => Promise.resolve(false)),
  getUserInteractionHistory: NativeMyModule.getUserInteractionHistory || (() => Promise.resolve('[]')),
  getTodayUserReactions: NativeMyModule.getTodayUserReactions || (() => Promise.resolve('[]')),
  getReactionStats: NativeMyModule.getReactionStats || ((days?: number) => Promise.resolve('{}')),
  clearVLMResult: NativeMyModule.clearVLMResult || ((docId: string) => Promise.resolve(false)),
  
  // 이벤트 관련 함수
  addListener: (eventName: string, listener: (event: any) => void) => {
    if (NativeMyModule.addListener) {
      return NativeMyModule.addListener(eventName, listener);
    }
    return createEventListener(eventName, listener);
  },
  
  removeAllListeners: (eventName: string) => {
    if (NativeMyModule.removeAllListeners) {
      NativeMyModule.removeAllListeners(eventName);
      return;
    }
    removeAllEventListeners(eventName);
  }
};

export default MyModule;
