// Firebase 설정 (React Native 최적화)
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, User, initializeAuth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp, Timestamp, getDoc, query, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
import { getStorage, } from 'firebase/storage';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { DailyPlan, TimeSlot, OverlayActionRecord, PlanFormData, TodaySessionData } from '../types';
import MyModule from '../../modules/my-module';
import { AppState } from 'react-native';






// 대기열의 다음 요청 처리 함수
const processNextVLMRequest = (docId: string) => {
  const queue = vlmRequestQueue.get(docId);
  if (queue && queue.length > 0) {
    const nextRequest = queue.shift()!;
    console.log(`[VLM] 대기열에서 다음 요청 처리 - docId: ${docId}`);
    processingDocIds.add(docId);
    executeVLMRequest(docId, nextRequest);
  } else {
    vlmRequestQueue.delete(docId);
  }
};

const forceFirebaseSync = async () => {
  try {
    await disableNetwork(db);  // 기존 연결 해제
    await enableNetwork(db);   // 새로운 연결 강제
    console.log('[Firebase] 네트워크 강제 동기화 완료');
  } catch (error) {
    console.warn('[Firebase] 강제 동기화 실패:', error);
  }
};
// export const ensureFirebaseConnection = async (): Promise<void> => {
//   try {
//     await enableNetwork(db);
//     console.log('[Firebase] 네트워크 연결 활성화 완료');
//   } catch (error) {
//     console.warn('[Firebase] 네트워크 연결 활성화 실패:', error);
//   }
// };
// 대기열 상태 확인 함수
export const getVLMQueueStatus = (docId: string): {
  isProcessing: boolean;
  queueLength: number;
} => {
  return {
    isProcessing: processingDocIds.has(docId),
    queueLength: vlmRequestQueue.get(docId)?.length || 0
  };
};

// Firebase 설정은 .env 에서 주입한다 (.env.example 참고).
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only if it hasn't been initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Firebase 서비스 초기화 (React Native 최적화)
export const auth = getAuth(app);
export const db = getFirestore(app);  // 기본 Firestore 사용
export const storage = getStorage(app);






// 사용자 인증 상태 확인 헬퍼 함수
export const ensureUserAuthenticated = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ ensureUserAuthenticated: 사용자가 로그인되지 않음');
    throw new Error('사용자가 로그인되지 않았습니다.');
  }

  try {
    // 토큰 유효성 확인 및 갱신
    await user.getIdToken(true);
    return user.uid;
  } catch (error) {
    console.error('❌ 사용자 토큰 갱신 실패:', error);
    throw new Error('Firebase 인증 토큰이 유효하지 않습니다.');
  }
};

// 사용자 인증 상태 관리
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// 사용자 ID 가져오기
export const getUserId = (): string | null => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('⚠️ Firebase getUserId: 현재 사용자가 없습니다');
    return null;
  }
  
  // 토큰 유효성 확인
  currentUser.getIdToken(true).catch(error => {
    console.error('❌ Firebase 토큰 갱신 실패:', error);
  });
  return currentUser.uid;
};


export const safeParseDuration = (duration: any): number => {
  if (typeof duration === 'number') return duration;
  if (typeof duration === 'string') {
    const parsed = parseFloat(duration);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};




  
// 사용자 반응 저장 함수
export const saveUserReaction = async (data: {
  reelsCount: number;
  message: string;
  userAction: string;
  reactionTime: number;
  date: string;
  time: string;
  type: string;
}): Promise<void> => {
  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error('사용자가 로그인되지 않음');
    }

    // 사용자가 원하는 구조: users > userId > reaction
    const reactionRef = collection(db, 'users', userId, 'reaction');
    
    await addDoc(reactionRef, {
      reelsCount: data.reelsCount,
      message: data.message,
      userAction: data.userAction,
      reactionTime: Timestamp.fromMillis(data.reactionTime),
      timestamp: serverTimestamp(),
      date: data.date,
      time: data.time,
      type: data.type
    });

    console.log('사용자 반응이 Firebase (users > reaction)에 저장되었습니다.');
  } catch (error) {
    console.error('사용자 반응 저장 오류:', error);
    throw error;
  }
};

// 일과 계획 관련 함수들
export const saveDailyPlan = async (planData: PlanFormData[], date: string): Promise<void> => {
  try {
    const userId = getUserId();
    if (!userId) throw new Error('사용자가 로그인되지 않았습니다.');

    const timeSlots: TimeSlot[] = planData.map(plan => ({
      startTime: plan.startTime,
      endTime: plan.endTime,
      activity: plan.activity,
      alternativeAction: plan.alternativeAction
    }));

    const docId = `${userId}-plan-${date}`;
    const planRef = doc(db, 'dailyPlans', docId);
    await setDoc(planRef, { 
        timeSlots,
        userId,
        date,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    console.log('일과 계획이 Firebase (dailyPlans)에 저장되었습니다.');
  } catch (error) {
    console.error('일과 계획 저장 오류:', error);
    throw error;
  }
};

export const getDailyPlan = async (date: string): Promise<DailyPlan | null> => {
  try {
    const userId = await ensureUserAuthenticated();
    console.log(`Firebase 계획 조회 시도 - userId: ${userId}, date: ${date}`);
    
    // 올바른 경로: dailyPlans 컬렉션에서 userId-plan-date 형식 문서 ID로
    const docId = `${userId}-plan-${date}`;
    const planRef = doc(db, 'dailyPlans', docId);
    console.log(`dailyPlans 컬렉션에서 문서 조회: ${docId}`);
    
    const planSnap = await getDoc(planRef);
    console.log(`조회 결과: exists=${planSnap.exists()}`);

    if (planSnap.exists()) {
      const data = planSnap.data() as DailyPlan;
      console.log(`계획 발견 - timeSlots 수: ${data.timeSlots?.length || 0}`);
      if (data.timeSlots) {
        data.timeSlots.forEach((slot, index) => {
          console.log(`  슬롯[${index}]: ${slot.startTime}-${slot.endTime} ${slot.activity}`);
        });
      }
      return data;
    }

    console.log('dailyPlans 컬렉션에서 계획을 찾을 수 없습니다.');
    return null;
  } catch (error) {
    console.error('일과 계획 조회 오류:', error);
    throw error;
  }
};

export const updateDailyPlan = async (planData: PlanFormData[], date: string, originalPlans?: PlanFormData[]): Promise<void> => {
  try {
    const userId = getUserId();
    if (!userId) throw new Error('사용자가 로그인되지 않았습니다.');

    const timeSlots: TimeSlot[] = planData.map(plan => ({
      startTime: plan.startTime,
      endTime: plan.endTime,
      activity: plan.activity,
      alternativeAction: plan.alternativeAction
    }));

    const docId = `${userId}-plan-${date}`;
    const planRef = doc(db, 'dailyPlans', docId);
    
    // 기존 문서 조회하여 수정 횟수 확인
    const existingDoc = await getDoc(planRef);
    let modificationCount = 1;
    let originalTimeSlots: any[] = [];
    
    if (existingDoc.exists()) {
      const existingData = existingDoc.data();
      modificationCount = (existingData.modificationCount || 0) + 1;
      originalTimeSlots = existingData.originalTimeSlots || [];
      
      // original 시간 정보 추가 (첫 번째 수정인 경우에만)
      if (originalPlans && originalTimeSlots.length === 0) {
        originalTimeSlots = originalPlans.map(plan => ({
          startTime: plan.startTime,
          endTime: plan.endTime,
          activity: plan.activity,
          alternativeAction: plan.alternativeAction,
          modificationTime: new Date().toISOString()
        }));
      }
    }

    await updateDoc(planRef, {
      timeSlots,
      modificationCount,
      originalTimeSlots,
      updatedAt: serverTimestamp()
    });

    console.log(`일과 계획이 수정되었습니다. (수정 횟수: ${modificationCount})`);
  } catch (error) {
    console.error('일과 계획 수정 오류:', error);
    throw error;
  }
};

export const checkTimeConflict = (newPlan: PlanFormData, existingPlans: TimeSlot[]): boolean => {
  const newStart = new Date(`2000-01-01T${newPlan.startTime}:00`);
  const newEnd = new Date(`2000-01-01T${newPlan.endTime}:00`);

  return existingPlans.some(plan => {
    const existingStart = new Date(`2000-01-01T${plan.startTime}:00`);
    const existingEnd = new Date(`2000-01-01T${plan.endTime}:00`);

    return (newStart < existingEnd && newEnd > existingStart);
  });
};

export const isTimeInPast = (time: string): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetTime = new Date(`${today.toISOString().split('T')[0]}T${time}:00`);
  
  return targetTime < now;
};

export const getCurrentTimeSlot = async (date: string): Promise<TimeSlot | null> => {
  try {
    const plan = await getDailyPlan(date);
    if (!plan) return null;

    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

    return plan.timeSlots.find(slot => {
      return currentTime >= slot.startTime && currentTime <= slot.endTime;
    }) || null;
  } catch (error) {
    console.error('현재 시간대 조회 오류:', error);
    return null;
  }
};

// 오버레이 행동 기록 함수들
export const saveOverlayAction = async (data: {
  timeSlot: string;
  action: OverlayActionRecord['action'];
  reelsWatchTime: number;
  date: string;
}): Promise<void> => {
  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error('사용자가 로그인되지 않았습니다.');
    }

    const record: OverlayActionRecord = {
      userId,
      date: data.date,
      timeSlot: data.timeSlot,
      action: data.action,
      reelsWatchTime: data.reelsWatchTime,
      timestamp: serverTimestamp()
    };

    const recordRef = collection(db, 'overlayActions');
    await addDoc(recordRef, record);

    console.log('오버레이 행동이 Firebase에 기록되었습니다.');
  } catch (error) {
    console.error('오버레이 행동 기록 오류:', error);
    throw error;
  }
};

export const checkCurrentActivePlan = async (): Promise<TimeSlot | null> => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
    
    const plan = await getDailyPlan(today);
    if (!plan) {
      return null;
    }

    const activeSlot = plan.timeSlots.find(slot => {
      return currentTime >= slot.startTime && currentTime <= slot.endTime;
    });

    return activeSlot || null;
  } catch (error) {
    console.error('현재 계획 확인 오류:', error);
    return null;
  }
};



// Native 모듈에 전달하기 위해 오늘의 전체 계획을 포맷하는 함수
export const getFormattedTodayPlan = async (): Promise<TimeSlot[] | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const plan = await getDailyPlan(today);
    return plan?.timeSlots || []; // 계획이 없으면 빈 배열 반환
  } catch (error) {
    console.error('오늘의 계획 포맷 오류:', error);
    return null;
  }
};




// 수정된 createFirebaseDoc
export const createFirebaseDoc = async (data: any) => {
  try {
    // 포그라운드가 아니면 처리를 최소화
    if (AppState.currentState !== 'active') {
      console.log(`[Firebase] 백그라운드 상태 - 문서 생성 지연: ${data.docId}`);
      return; // 포그라운드 복귀 시 처리
    }
    
    // 백그라운드 상태에서 Firebase 강제 동기화
    await forceFirebaseSync();
    
    const userId = getUserId();
    if (!userId) throw new Error('사용자가 로그인되지 않았습니다.');

    const { docId, platform, timestamp, contentStartTime, contentEndTime, contentDuration } = data;
    console.log(`[Firebase] 문서 생성 - docId: ${docId}, 앱상태: ${AppState.currentState}`);

    const sfRef = collection(db, 'users', userId, 'SF');
    const targetDocRef = doc(sfRef, docId);

    const docData = {
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
      platform: platform || 'unknown',
      duration: contentDuration || 0,
      startTime: contentStartTime || timestamp || Date.now(),
      endTime: contentEndTime || timestamp || Date.now(),
      date: new Date().toISOString().split('T')[0],
      vlm_success: false,
      vlm_docId: docId,
      analysis: {},
      category: 'unknown'
    };

    await setDoc(targetDocRef, docData);
    console.log(`[Firebase] 문서 생성 성공 - docId: ${docId}`);
    
  } catch (error) {
    console.error(`[Firebase] 문서 생성 오류 - docId: ${data.docId}:`, error);
    throw error;
  }
};


export const saveVLMResult = async (data: any) => {
  // 포그라운드가 아니면 처리를 최소화
  if (AppState.currentState !== 'active') {
    console.log(`[Firebase] 백그라운드 상태 - VLM 결과 저장 지연: ${data.docId || data[1]}`);
    return; // 포그라운드 복귀 시 처리
  }
  
  if (AppState.currentState !== 'active') {
    await forceFirebaseSync();
  }
  try {
    const userId = getUserId();
    if (!userId) throw new Error('사용자가 로그인되지 않았습니다.');
    
    let platform: string;
    let docId: string;
    let result: any;
    
    if (Array.isArray(data)) {
      [platform, docId, result] = data;
    } else {
      platform = data.platform;
      docId = data.docId;
      result = data;
    }
    
    console.log(`VLM 결과 저장 시작 - platform: "${platform}", docId: "${docId}", success: ${result?.success || false}`);
    
    if (!docId || !result) {
      throw new Error('필수 데이터가 누락되었습니다. (docId 또는 result)');
    }
    
    // platform이 빈 문자열이면 기본값 설정
    if (!platform || platform.trim() === '') {
      platform = 'unknown';
      console.log('platform이 빈 문자열이므로 "unknown"으로 설정');
    }
    
    const sfRef = collection(db, 'users', userId, 'SF');
    const targetDocRef = doc(sfRef, docId);
    
    const updateData = {
      analysis: result.analysis || {},
      category: result.analysis?.category || 'unknown',
      vlm_success: result.success || false,
      vlm_processing_time: result.processingTime || 0,
      vlm_retry_count: result.retryCount || 0,
      vlm_updated_at: serverTimestamp(),
      vlm_screenshot_docid: docId
    };
    
    await updateDoc(targetDocRef, updateData);
    console.log(`VLM 결과가 정확한 SF 문서에 업데이트됨 - docId: ${docId}, category: ${updateData.category}`);
    
    // Firebase 저장 성공 후 Android 임시 저장 정리
    try {
      if (MyModule.clearVLMResult && typeof MyModule.clearVLMResult === 'function') {
        await MyModule.clearVLMResult(docId);
        console.log(`Android 임시 저장 정리 완료 - docId: ${docId}`);
      } else {
        console.warn(`clearVLMResult 함수가 존재하지 않음 - docId: ${docId}`);
      }
    } catch (clearError) {
      console.warn(`Android 임시 저장 정리 실패 - docId: ${docId}:`, clearError);
    }
    
  } catch (error) {
    console.error('VLM 결과 업데이트 오류:', error);
    throw error;
  }
};
  // VLM 요청 대기열 관리 시스템 (firebase.ts 파일에 추가)
const vlmRequestQueue = new Map<string, Array<{
  processor: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}>>();
const processingDocIds = new Set<string>();

// VLM 요청 처리 함수
export const processVLMRequest = async (
  docId: string, 
  vlmProcessor: () => Promise<any>
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const requestData = {
      processor: vlmProcessor,
      resolve,
      reject
    };

    if (processingDocIds.has(docId)) {
      console.log(`[VLM] 대기열 추가 - docId: ${docId}`);
      if (!vlmRequestQueue.has(docId)) {
        vlmRequestQueue.set(docId, []);
      }
      vlmRequestQueue.get(docId)!.push(requestData);
    } else {
      console.log(`[VLM] 즉시 처리 시작 - docId: ${docId}`);
      processingDocIds.add(docId);
      executeVLMRequest(docId, requestData);
    }
  });
};

// VLM 요청 실행 함수
const executeVLMRequest = async (docId: string, requestData: {
  processor: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}) => {
  try {
    console.log(`[VLM] API 호출 시작 - docId: ${docId}`);
    const result = await requestData.processor();
    requestData.resolve(result);
  } catch (error) {
    console.error(`[VLM] 처리 실패 - docId: ${docId}:`, error);
    requestData.reject(error);
  } finally {
    processingDocIds.delete(docId);
    processNextVLMRequest(docId);
  }
};



// 텍스트 모델 안내문 결과를 Firestore에 저장
export const saveGuidanceResult = async (result: {
  requestId: string;
  userId: string;
  triggerContext: string;
  timestamp: number;
  success: boolean;
  guidanceText?: string;
  personalizedMessage?: string;
  error?: string;
  processingTime: number;
  retryCount: number;
}) => {
  try {
    // 사용자 인증 상태 확인
    const userId = result.userId || await ensureUserAuthenticated();
    console.log('✅ 안내문 사용자 ID 확인됨:', userId);

    // 사용자별 안내문 컬렉션: users > userId > guidance
    const guidanceRef = collection(db, 'users', userId, 'guidance');
    
    const docData = {
      timestamp: Timestamp.fromMillis(result.timestamp),
      success: result.success,
      guidance: result.guidanceText || null,
      error: result.error || null,
      createdAt: serverTimestamp(),
      date: new Date(result.timestamp).toISOString().split('T')[0] // YYYY-MM-DD 형식
    };

    // requestId를 문서 ID로 사용하여 중복 방지
    const docRef = doc(guidanceRef, result.requestId);
    
    try {
      // 문서가 이미 존재하는지 확인
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        console.log(`⚠️ 안내문 결과가 이미 존재합니다. requestId: ${result.requestId}`);
        return docRef;
      }
    } catch (error) {
      console.log('문서 존재 여부 확인 중 오류 (무시됨):', error);
    }
    
    // 새 문서 생성 (setDoc 사용으로 중복 방지)
    await setDoc(docRef, docData);
    
    console.log(`안내문 결과가 Firebase (users > user id > guidance)에 저장되었습니다. DocID: ${docRef.id}`);
    
    return docRef;
  } catch (error) {
    console.error('안내문 결과 저장 오류:', error);
    if (error instanceof Error) {
      console.error('에러 타입:', error.constructor.name);
      console.error('에러 메시지:', error.message);
    }
    throw error;
  }
};

// YouTube Shorts 시청 기록 저장 (VLM 정보 포함 가능)
export const saveYouTubeShortsRecord = async (data: {
  startTime: number;
  endTime: number;
  duration: number;
  description?: string;
  category?: string;
  analysis?: any;
  vlm_success?: boolean;
  vlm_docId?: string;
  vlm_updated_at?: Date;
}, docId?: string) => {
  try {
    const userId = await ensureUserAuthenticated();
    const sfRef = collection(db, 'users', userId, 'SF');
    
    // 한국 시간 기준으로 날짜 생성
    const startDate = new Date(data.startTime);
    const dateKST = startDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

    const docData: any = {
      startTime: Timestamp.fromMillis(data.startTime),
      endTime: Timestamp.fromMillis(data.endTime),
      duration: data.duration,
      description: data.description || '쇼츠',
      platform: 'youtube',
      timestamp: serverTimestamp(),
      date: dateKST // 한국 시간 기준 날짜
    };

    if (data.category) {
      docData.category = data.category;
      docData.analysis = data.analysis || {};
      docData.vlm_success = data.vlm_success || false;
      docData.vlm_docId = data.vlm_docId;
      docData.vlm_updated_at = data.vlm_updated_at ? Timestamp.fromDate(data.vlm_updated_at) : serverTimestamp();
      console.log('VLM 정보 포함해서 YouTube Shorts 저장:', data.category);
    }

    console.log('YouTube Firebase에 저장할 데이터:', {
      duration: docData.duration,
      category: docData.category,
      date: docData.date
    });

    let docRef;
    if (docId) {
      const specificDocRef = doc(sfRef, docId);
      await setDoc(specificDocRef, docData);
      docRef = specificDocRef;
      console.log('YouTube Shorts 기록이 지정된 docId로 저장되었습니다. DocID:', docId);
    } else {
      docRef = await addDoc(sfRef, docData);
      console.log('YouTube Shorts 기록이 랜덤 DocID로 저장되었습니다. DocID:', docRef.id);
    }

    return docRef;
  } catch (error) {
    console.error('YouTube Shorts 기록 저장 오류:', error);
    throw error;
  }
};
  export const saveReelsRecord = async (data: {
  startTime: number;
  endTime: number;
  duration: number;
  description?: string;
  platform?: string;
  category?: string;
  analysis?: any;
  vlm_success?: boolean;
  vlm_docId?: string;
  vlm_updated_at?: Date;
}, docId?: string) => {
  try {
    console.log('saveReelsRecord 시작 - 인증 상태 확인 중...');
    const userId = await ensureUserAuthenticated();
    console.log('사용자 ID 확인됨:', userId);

    const sfRef = collection(db, 'users', userId, 'SF');
    
    // 한국 시간 기준으로 날짜 생성
    const startDate = new Date(data.startTime);
    const dateKST = startDate.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

    const docData: any = {
      startTime: Timestamp.fromMillis(data.startTime),
      endTime: Timestamp.fromMillis(data.endTime),
      duration: data.duration,
      description: data.description || '릴스',
      platform: data.platform || 'instagram',
      timestamp: serverTimestamp(),
      date: dateKST // 한국 시간 기준 날짜
    };

    if (data.category) {
      docData.category = data.category;
      docData.analysis = data.analysis || {};
      docData.vlm_success = data.vlm_success || false;
      docData.vlm_docId = data.vlm_docId;
      docData.vlm_updated_at = data.vlm_updated_at ? Timestamp.fromDate(data.vlm_updated_at) : serverTimestamp();
      console.log('VLM 정보 포함해서 Firebase 저장:', data.category);
    }

    console.log('Firebase에 저장할 데이터:', {
      duration: docData.duration,
      category: docData.category,
      date: docData.date,
      platform: docData.platform
    });

    let docRef;
    if (docId) {
    const specificDocRef = doc(sfRef, docId);
    await setDoc(specificDocRef, docData);
    docRef = specificDocRef;
    console.log('릴스 기록이 지정된 docId로 저장되었습니다. DocID:', docId);
    } else {
    docRef = await addDoc(sfRef, docData);
    console.log('릴스 기록이 랜덤 DocID로 저장되었습니다. DocID:', docRef.id);
    }
    
    return docRef;
    } catch (error) {
    console.error('릴스 기록 저장 오류:', error);
    throw error;
    }
    };

export const getTodaySessionData = async (): Promise<TodaySessionData | null> => {
  try {
    const userId = getUserId();
    if (!userId) {
      console.log('⚠️ 사용자가 로그인되지 않음 - 세션 데이터 조회 불가');
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`📊 오늘의 숏폼 세션 데이터 조회 시작 - userId: ${userId}, date: ${today}`);

    const sfRef = collection(db, 'users', userId, 'SF');
    
    // 복합 인덱스 오류 해결: orderBy 제거하고 클라이언트에서 정렬
    const todayQuery = query(
      sfRef,
      where('date', '==', today),
      limit(100) // 최근 100개로 제한하여 성능 향상
    );

    console.log('🔍 Firebase 쿼리 실행 중... (컬렉션: users/' + userId + '/SF, 날짜: ' + today + ')');

    // 타이메아웃과 함께 실행
    const result = await Promise.race([
      getDocs(todayQuery),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Firebase query timeout')), 300000)
      )
    ]);

    if (!result) {
      console.log('⚠️ Firebase 조회 타이메아웃 - 기본값 반환');
      return getDefaultSessionData();
    }

    // 클라이언트에서 정렬 수행
    const todayRecords = result.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((record: any) => {
        // 추가 날짜 검증 (혹시 모를 데이터 불일치 방지)
        const recordDate = record.date || new Date(record.startTime?.toMillis() || record.timestamp?.toMillis() || Date.now()).toISOString().split('T')[0];
        return recordDate === today;
      })
      .sort((a: any, b: any) => {
        // timestamp 기준으로 내림차순 정렬 (최신순)
        const aTime = a.timestamp?.toMillis?.() || a.startTime?.toMillis?.() || 0;
        const bTime = b.timestamp?.toMillis?.() || b.startTime?.toMillis?.() || 0;
        return bTime - aTime;
      }) as any[];

    console.log(`✅ 오늘의 숏폼 기록 ${todayRecords.length}개 조회됨`);

    if (todayRecords.length === 0) {
      return getDefaultSessionData();
    }

    // 데이터 분석 - 효율성을 위해 early return 추가
    let totalDuration = 0;
    let totalCount = todayRecords.length;
    let instagramCount = 0, instagramDuration = 0;
    let youtubeCount = 0, youtubeDuration = 0;
    const hourCounts: { [hour: string]: number } = {};

    // 세션 구분을 위한 시간 간격 (30분)
    const SESSION_GAP_MS = 30 * 60 * 1000;
    let sessionCount = 1;
    let lastTimestamp = 0;

    todayRecords.forEach((record: any, index) => {
      const duration = record.duration || 0;
      const platform = record.platform || 'instagram';
      const timestamp = record.startTime?.toMillis() || record.timestamp?.toMillis() || Date.now();

      // 총 시청 시간 계산 (초 → 분)
      totalDuration += Math.round(duration / 60);

      // 플랫폼별 분석
      if (platform === 'youtube') {
        youtubeCount++;
        youtubeDuration += Math.round(duration / 60);
      } else {
        instagramCount++;
        instagramDuration += Math.round(duration / 60);
      }

      // 시간대별 분석
      const hour = new Date(timestamp).getHours().toString().padStart(2, '0') + ':00';
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;

      // 세션 구분
      if (index > 0 && lastTimestamp - timestamp > SESSION_GAP_MS) {
        sessionCount++;
      }
      lastTimestamp = timestamp;
    });

    // 피크 시간대 계산 (상위 3개)
    const peakHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => hour);

    // 세션당 평균 시청 시간
    const averagePerSession = sessionCount > 0 ? totalDuration / sessionCount : 0;

    // 평균 영상 길이 (초)
    const averageVideoLength = totalCount > 0 ? 
      todayRecords.reduce((sum: number, record: any) => sum + (record.duration || 0), 0) / totalCount : 0;

    // 마지막 세션 시작 시간
    const lastSessionStart = todayRecords.length > 0 ? 
      (todayRecords[0].startTime?.toMillis() || todayRecords[0].timestamp?.toMillis() || Date.now()) : 0;

    const sessionData: TodaySessionData = {
      totalDuration,
      totalCount,
      sessionCount,
      averagePerSession: Math.round(averagePerSession * 10) / 10,
      lastSessionStart,
      platformBreakdown: {
        instagram: { count: instagramCount, duration: instagramDuration },
        youtube: { count: youtubeCount, duration: youtubeDuration }
      },
      peakHours,
      averageVideoLength: Math.round(averageVideoLength)
    };

    console.log('오늘의 숏폼 세션 데이터 분석 완료 - totalCount:', {
      totalDuration: sessionData.totalDuration + '분',
      totalCount: sessionData.totalCount + '개',
      sessionCount: sessionData.sessionCount + '세션',
      averagePerSession: sessionData.averagePerSession + '분/세션',
      platforms: `Instagram: ${instagramCount}개(${instagramDuration}분), YouTube: ${youtubeCount}개(${youtubeDuration}분)`,
      peakHours: sessionData.peakHours.join(', ')
    });

    return sessionData;

  } catch (error) {
    console.error('오늘의 세션 데이터 조회 오류:', error);
    return getDefaultSessionData();
  }
};


// 기본 세션 데이터 생성 함수 추가
const getDefaultSessionData = (): TodaySessionData => {
  return {
    totalDuration: 0,
    totalCount: 0,
    sessionCount: 0,
    averagePerSession: 0,
    lastSessionStart: 0,
    platformBreakdown: {
      instagram: { count: 0, duration: 0 },
      youtube: { count: 0, duration: 0 }
    },
    peakHours: [],
    averageVideoLength: 0
  };
};

// 캐시 시스템
interface CacheData {
  data: TodaySessionData;
  last: number;
  records: any[];
}

const cache = new Map<string, CacheData>();
const CACHE_TTL = 2 * 60 * 1000; // 2분 TTL

// 15분 범위 최적화 쿼리 (경량)
export const getRecentData = async (minutes = 15): Promise<TodaySessionData> => {
  try {
    const userId = await ensureUserAuthenticated();
    console.log(`📊 getRecentData 시작 - userId: ${userId}, minutes: ${minutes}`);

    const cacheKey = `${userId}-${minutes}`;
    const now = Date.now();
    
    // 캐시 확인
    const cached = cache.get(cacheKey);
    if (cached && (now - cached.last) < CACHE_TTL) {
      console.log(`캐시에서 데이터 반환 (${minutes}분 범위)`);
      return cached.data;
    }

    const sfRef = collection(db, 'users', userId, 'SF');
    
    //오늘 하루 데이터 조회
    const recentQuery = query(
      sfRef,
      where('date', '==', new Date().toISOString().split('T')[0])
   
    );


    const startTime = Date.now();

    const result = await Promise.race([
      getDocs(recentQuery),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 10000) 
      )
    ]);

    if (!result) {
      console.log('조회 타임아웃 - 캐시된 데이터 또는 기본값 반환');
      return cached?.data || getDefaultSessionData();
    }

    const records = result.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`최근 ${minutes}분 데이터 조회 완료: ${records.length}개 (${Date.now() - startTime}ms)`);

    // 빠른 계산 (15분 데이터는 적음)
    const sessionData = calcQuick(records);
    
    // 캐시 저장
    cache.set(cacheKey, {
      data: sessionData,
      last: now,
      records
    });

    return sessionData;

  } catch (error) {
    console.error('최근 데이터 조회 오류:', error);
    const cacheKey = `${getUserId()}-${minutes}`;
    return cache.get(cacheKey)?.data || getDefaultSessionData();
  }
};



// 오늘 하루 전체 데이터 조회
export const getTodayData = async (): Promise<TodaySessionData> => {
  try {
    const userId = getUserId();
    if (!userId) {
      console.log('사용자가 로그인되지 않음');
      return getDefaultSessionData();
    }

    const cacheKey = `${userId}-today-all`;
    const now = Date.now();
    
    // 캐시 확인
    const cached = cache.get(cacheKey);
    if (cached && (now - cached.last) < CACHE_TTL) {
      console.log('캐시에서 오늘 전체 데이터 반환');
      return cached.data;
    }

    const sfRef = collection(db, 'users', userId, 'SF');
    
    // 한국 시간 기준 오늘 날짜를 YYYY-MM-DD 형식으로 생성
    const today = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'Asia/Seoul'
    });
    
    // 오늘 하루 전체 데이터 조회
    const todayQuery = query(
      sfRef,
      where('date', '==', today),
      orderBy('startTime', 'desc')
    );

    const startTime = Date.now();

    const result = await Promise.race([
      getDocs(todayQuery),
      
    ]);

    if (!result) {
      console.log('조회 타임아웃 - 캐시된 데이터 또는 기본값 반환');
      return cached?.data || getDefaultSessionData();
    }

    const records = result.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`오늘(${today}) 전체 데이터 조회 완료: ${records.length}개 (${Date.now() - startTime}ms)`);

    // 오늘 전체 데이터 계산
    const sessionData = calcQuick(records);
    
    // 캐시 저장
    cache.set(cacheKey, {
      data: sessionData,
      last: now,
      records
    });

    return sessionData;

  } catch (error) {
    console.error('오늘 전체 데이터 조회 오류:', error);
    const cacheKey = `${getUserId()}-today-all`;
    return cache.get(cacheKey)?.data || getDefaultSessionData();
  }
};


const calcQuick = (records: any[]): TodaySessionData => {
  if (records.length === 0) return getDefaultSessionData();

  let totalDuration = 0;
  let insta = 0, instaDur = 0;
  let yt = 0, ytDur = 0;

  records.forEach(r => {
    const duration = safeParseDuration(r.duration);
    const durInMinutes = Math.round(duration / 60);
    totalDuration += durInMinutes;

    if (r.platform === 'youtube') {
      yt++;
      ytDur += durInMinutes;
    } else {
      insta++;
      instaDur += durInMinutes;
    }
  });

  const sessionCount = Math.max(1, Math.ceil(records.length / 10));
  
  return {
    totalDuration,
    totalCount: records.length,
    sessionCount,
    averagePerSession: records.length > 0 ? Math.round((totalDuration / sessionCount) * 10) / 10 : 0,
    lastSessionStart: records[0]?.startTime?.toMillis?.() || Date.now(),
    platformBreakdown: {
      instagram: { count: insta, duration: instaDur },
      youtube: { count: yt, duration: ytDur }
    },
    peakHours: [],
    averageVideoLength: records.length > 0 ? Math.round(records.reduce((sum, r) => sum + safeParseDuration(r.duration), 0) / records.length) : 0
  };
};
// 증분 업데이트 함수
export const updateCache = async (userId: string): Promise<void> => {
  try {
    const sfRef = collection(db, 'users', userId, 'SF');
    const fiveMin = Date.now() - 5 * 60 * 1000;
    const since = new Timestamp(Math.floor(fiveMin / 1000), 0);
    
    const newQuery = query(
      sfRef,
      where('startTime', '>=', since),
      orderBy('startTime', 'desc'),
      limit(20)
    );

    const result = await getDocs(newQuery);
    const newRecords = result.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 모든 캐시 업데이트
    cache.forEach((cached, key) => {
      if (key.startsWith(userId)) {
        // 중복 제거하고 새 데이터 추가
        const existing = cached.records.filter(r => 
          !newRecords.some(nr => nr.id === r.id)
        );
        
        const updated = [...newRecords, ...existing].slice(0, 50);
        const newData = calcQuick(updated);
        
        cache.set(key, {
          data: newData,
          last: Date.now(),
          records: updated
        });
      }
    });

    console.log(`캐시 업데이트 완료: ${newRecords.length}개 새 레코드`);
  } catch (error) {
    console.error('캐시 업데이트 오류:', error);
  }
};

// 캐시 정리 함수
export const clearCache = (): void => {
  cache.clear();
  console.log('캐시 정리 완료');
};

// 백그라운드 캐시 업데이트 (App.tsx에서 주기적 호출용)
export const bgUpdate = (userId: string): void => {
  setTimeout(() => updateCache(userId), 100); // 비동기 실행
};







// statsScreen
export const getSFRecords = async (startDate?: string, endDate?: string) => {
  try {
    const userId = getUserId();
    if (!userId) {
      throw new Error('사용자가 로그인되지 않았습니다.');
    }

    const sfRef = collection(db, 'users', userId, 'SF');
    let q = query(sfRef);

    if (startDate && endDate) {
      q = query(sfRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
    }

    const querySnapshot = await getDocs(q);
    const records: any[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      records.push({
        id: doc.id,
        ...data,
        duration: safeParseDuration(data.duration), // 안전한 duration 파싱
        startTime: data.startTime?.toDate?.() || new Date(data.startTime),
        endTime: data.endTime?.toDate?.() || new Date(data.endTime),
        timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
      });
    });

    return records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch (error) {
    console.error('SF 기록 조회 오류:', error);
    throw error;
  }
};


export const getDailySFStats = async (date: string): Promise<{
  totalRecords: number;
  totalDuration: number;
  hourlyStats: { [hour: number]: { count: number; duration: number; categories: { [category: string]: number }; platforms: { [platform: string]: number } } };
  categoryStats: { [category: string]: { count: number; duration: number } };
  platformStats: { [platform: string]: { count: number; duration: number } };
  peakHour: number;
  peakHourCategory: string;
  date: string;
}> => {
  try {
    console.log('getDailySFStats 시작, 날짜:', date);
    const records = await getSFRecords(date, date);
    console.log('조회된 레코드 수:', records.length);
    
    if (records.length > 0) {
      console.log('첫 번째 레코드 샘플:', {
        platform: records[0].platform,
        category: records[0].category,
        duration: records[0].duration,
        startTime: records[0].startTime,
        date: records[0].date
      });
    }

    const hourlyStats: { [hour: number]: { count: number; duration: number; categories: { [category: string]: number }; platforms: { [platform: string]: number } } } = {};
    const categoryStats: { [category: string]: { count: number; duration: number } } = {};
    const platformStats: { [platform: string]: { count: number; duration: number } } = {};

    let totalDuration = 0;

    records.forEach((record, index) => {
      const hour = record.startTime.getHours();
      const category = record.category || 'unknown';
      const platform = record.platform || 'unknown';
      const duration = safeParseDuration(record.duration);

      console.log(`레코드 ${index + 1}: 시간=${hour}, 플랫폼=${platform}, 카테고리=${category}, 시간=${duration}초`);

      totalDuration += duration;

      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { count: 0, duration: 0, categories: {}, platforms: {} };
      }
      hourlyStats[hour].count++;
      hourlyStats[hour].duration += duration;
      
      if (!hourlyStats[hour].categories[category]) {
        hourlyStats[hour].categories[category] = 0;
      }
      hourlyStats[hour].categories[category]++;

      if (!hourlyStats[hour].platforms[platform]) {
        hourlyStats[hour].platforms[platform] = 0;
      }
      hourlyStats[hour].platforms[platform]++;

      console.log(`${hour}시 플랫폼 통계 업데이트:`, hourlyStats[hour].platforms);

      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, duration: 0 };
      }
      categoryStats[category].count++;
      categoryStats[category].duration += duration;

      if (!platformStats[platform]) {
        platformStats[platform] = { count: 0, duration: 0 };
      }
      platformStats[platform].count++;
      platformStats[platform].duration += duration;
    });

    let peakHour = 0;
    let maxHourCount = 0;
    Object.entries(hourlyStats).forEach(([hour, stats]) => {
      if (stats.count > maxHourCount) {
        maxHourCount = stats.count;
        peakHour = parseInt(hour);
      }
    });

    let peakHourCategory = 'unknown';
    if (peakHour in hourlyStats && hourlyStats[peakHour].categories) {
      let maxCategoryCount = 0;
      Object.entries(hourlyStats[peakHour].categories).forEach(([category, count]) => {
        if (count > maxCategoryCount && category !== 'unknown') {
          maxCategoryCount = count;
          peakHourCategory = category;
        }
      });
    }

    console.log('최종 hourlyStats:', hourlyStats);
    console.log('최종 platformStats:', platformStats);

    const result = {
      totalRecords: records.length,
      totalDuration,
      hourlyStats,
      categoryStats,
      platformStats,
      peakHour,
      peakHourCategory,
      date
    };

    console.log('getDailySFStats 결과:', result);
    return result;
  } catch (error) {
    console.error('일간 SF 통계 계산 오류:', error);
    throw error;
  }
};

export const getWeeklySFStats = async (startDate: string, endDate: string) => {
  try {
    const records = await getSFRecords(startDate, endDate);

    const weeklyStats: { [day: number]: { count: number; duration: number; categories: { [category: string]: number } } } = {};
    const categoryStats: { [category: string]: { count: number; duration: number } } = {};
    const platformStats: { [platform: string]: { count: number; duration: number } } = {};

    let totalDuration = 0;

    records.forEach(record => {
      const day = record.startTime.getDay();
      const category = record.category || 'unknown';
      const platform = record.platform || 'unknown';
      const duration = safeParseDuration(record.duration);

      totalDuration += duration;

      if (!weeklyStats[day]) {
        weeklyStats[day] = { count: 0, duration: 0, categories: {} };
      }
      weeklyStats[day].count++;
      weeklyStats[day].duration += duration;
      
      if (!weeklyStats[day].categories[category]) {
        weeklyStats[day].categories[category] = 0;
      }
      weeklyStats[day].categories[category]++;

      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, duration: 0 };
      }
      categoryStats[category].count++;
      categoryStats[category].duration += duration;

      if (!platformStats[platform]) {
        platformStats[platform] = { count: 0, duration: 0 };
      }
      platformStats[platform].count++;
      platformStats[platform].duration += duration;
    });

    let peakDay = 0;
    let maxDayCount = 0;
    Object.entries(weeklyStats).forEach(([day, stats]) => {
      if (stats.count > maxDayCount) {
        maxDayCount = stats.count;
        peakDay = parseInt(day);
      }
    });

    let peakDayCategory = 'unknown';
    if (peakDay in weeklyStats && weeklyStats[peakDay].categories) {
      let maxCategoryCount = 0;
      Object.entries(weeklyStats[peakDay].categories).forEach(([category, count]) => {
        if (count > maxCategoryCount && category !== 'unknown') {
          maxCategoryCount = count;
          peakDayCategory = category;
        }
      });
    }

    return {
      totalRecords: records.length,
      totalDuration,
      weeklyStats,
      categoryStats,
      platformStats,
      peakDay,
      peakDayCategory,
      startDate,
      endDate
    };
  } catch (error) {
    console.error('주간 SF 통계 계산 오류:', error);
    throw error;
  }
};

// getMonthlySFSummary 함수 수정
export const getMonthlySFSummary = async (year: number, month: number) => {
  try {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    const records = await getSFRecords(startDate, endDate);

    const dailyStats: { [date: string]: { count: number; duration: number } } = {};
    const categoryStats: { [category: string]: { count: number; duration: number } } = {};
    const platformStats: { [platform: string]: { count: number; duration: number } } = {};

    let totalDuration = 0;

    records.forEach(record => {
      const date = record.date;
      const category = record.category || 'unknown';
      const platform = record.platform || 'unknown'; 
      const duration = safeParseDuration(record.duration);

      totalDuration += duration;

      if (!dailyStats[date]) {
        dailyStats[date] = { count: 0, duration: 0 };
      }
      dailyStats[date].count++;
      dailyStats[date].duration += duration;

      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, duration: 0 };
      }
      categoryStats[category].count++;
      categoryStats[category].duration += duration;

      if (!platformStats[platform]) {
        platformStats[platform] = { count: 0, duration: 0 };
      }
      platformStats[platform].count++;
      platformStats[platform].duration += duration;
    });

    return {
      totalRecords: records.length,
      totalDuration,
      dailyStats,
      categoryStats,
      platformStats,
      averageDaily: records.length / lastDay,
      year,
      month
    };
  } catch (error) {
    console.error('월간 SF 통계 계산 오류:', error);
    throw error;
  }
};





// 특정 시간대의 상세 레코드 조회 함수 추가
export const getHourlyDetailRecords = async (date: string, hour: number): Promise<any[]> => {
  try {
    const userId = await ensureUserAuthenticated();
    const sfRef = collection(db, 'users', userId, 'SF');
    
    const records = await getSFRecords(date, date);
    
    // 해당 시간대의 레코드만 필터링
    const hourlyRecords = records.filter(record => {
      const recordHour = new Date(record.startTime).getHours();
      return recordHour === hour;
    });
    
    // 시청 시간 순으로 정렬 (내림차순)
    return hourlyRecords.sort((a, b) => b.duration - a.duration);
    
  } catch (error) {
    console.error('시간대별 상세 레코드 조회 오류:', error);
    return [];
  }
};

// 전체 일간 레코드 조회 (차트용)
export const getDailyDetailRecords = async (date: string): Promise<any[]> => {
  try {
    const userId = await ensureUserAuthenticated();
    return await getSFRecords(date, date);
  } catch (error) {
    console.error('일간 상세 레코드 조회 오류:', error);
    return [];
  }
};


export default app; 