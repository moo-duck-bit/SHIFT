export type User = {
  uid: string;
  email: string;
  name?: string;
};

export type RlsStat = {
  inRls: boolean;
  total: number;
  count: number;
  scrCnt: number;
  avgTime: number;
  curDur?: number;
  curName?: string;
  lastPause?: number;
  inReelsMode?: boolean;
  totalReelsViewTime?: number;
  reelsViewCount?: number;
  scrollCount?: number;
  averageTimePerReel?: number;
  currentDuration?: number;
  currentReelName?: string;
};

export type UsageStat = {
  ig: string;
  yt: string;
  tt: string;
};

export type TabRoute = 'Home' | 'Stats' | 'Profile' | 'Plan';

// Pretendard font family types
export type FontFamily = 
  | 'Pretendard-Regular'
  | 'Pretendard-Medium' 
  | 'Pretendard-SemiBold'
  | 'Pretendard-Bold';

// Plan related types
export type AlternativeAction = "Turn off display" | "Go back" | "Home button";

export type PlanFormData = {
  startTime: string;
  endTime: string;
  activity: string;
  alternativeAction: AlternativeAction;
};

export type TimeSlot = {
  startTime: string;
  endTime: string;
  activity: string;
  alternativeAction: AlternativeAction;
};

export type DailyPlan = {
  userId: string;
  date: string;
  timeSlots: TimeSlot[];
  createdAt: any;
  updatedAt: any;
};

export type OverlayAction = "dismissed" | "plan_executed" | "alternative_action" | "plan_modified";

export type OverlayActionRecord = {
  userId: string;
  date: string;
  timeSlot: string;
  action: OverlayAction;
  reelsWatchTime: number;
  timestamp: any;
}; 

// 오늘의 숏폼 세션 데이터 (릴스 + 숏츠 통합)
export type TodaySessionData = {
  totalDuration: number;        // 오늘 총 시청 시간 (분)
  totalCount: number;           // 오늘 총 숏폼 개수
  sessionCount: number;         // 오늘 세션 수
  averagePerSession: number;    // 세션당 평균 시청 시간 (분)
  lastSessionStart: number;     // 마지막 세션 시작 시간 (timestamp)
  platformBreakdown: {         // 플랫폼별 분석
    instagram: { count: number; duration: number };
    youtube: { count: number; duration: number };
  };
  peakHours: string[];          // 주로 시청하는 시간대 ["09:00", "14:00", "21:00"]
  averageVideoLength: number;   // 평균 영상 길이 (초)
} 