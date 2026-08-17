import type { StyleProp, ViewStyle } from 'react-native';

export type OnLoadEventPayload = {
  url: string;
};

export type MyModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
  onReelsTrackingUpdate: (params: ReelsTrackingUpdateEvent) => void;
  onYouTubeShortsTrackingUpdate: (params: YouTubeShortsTrackingUpdateEvent) => void;
};

export type ChangeEventPayload = {
  value: string;
};

export type AppUsageStatsResult = {
  [packageName: string]: number;
};

export type SocialMediaUsageResult = {
  instagram: number;
  youtube: number;
  tiktok: number;
};

export type ReelsStatistics = {
  inReelsMode: boolean;
  totalReelsViewTime: number;
  reelsViewCount: number;
  scrollCount: number;
  averageTimePerReel: number;
};

export type ReelsTrackingUpdateEvent = {
  stats: string; // JSON string of ReelsStatistics
};

export type YouTubeShortsStatistics = {
  inYouTube: boolean;
  inShorts: boolean;
  totalShortsViewTime: number;
  shortsViewCount: number;
  scrollCount: number;
  averageTimePerShorts: number;
};

export type YouTubeShortsTrackingUpdateEvent = {
  stats: string; // JSON string of YouTubeShortsStatistics
};

// Firebase 관련 타입
export type FirebaseAuthResult = {
  success: boolean;
  message?: string;
};

export type MyModuleViewProps = {
  url: string;
  onLoad: (event: { nativeEvent: OnLoadEventPayload }) => void;
  style?: StyleProp<ViewStyle>;
};

export type UsageStatsPermissionDiagnostic = {
  packageName: string;
  androidVersion: number;
  buildVersion: string;
  usageStatsAvailable?: boolean;
  usageStatsCount?: number;
  hasUsageStatsData?: boolean;
  usageStatsError?: string;
  appOpsMode?: number;
  appOpsModeAllowed?: boolean;
  appOpsModeString?: string;
  appOpsError?: string;
  finalPermissionStatus: boolean;
};
