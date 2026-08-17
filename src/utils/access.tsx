import MyModule from "../../modules/my-module";
import { RlsStat } from "../types";
import { auth, saveReelsRecord, saveUserReaction, saveYouTubeShortsRecord, createFirebaseDoc, getUserId, processVLMRequest, saveVLMResult } from "../config/firebase";
import { handleVLMRequest, VLMAnalysisRequest } from "../VLM/vlm";
import { AppState } from 'react-native';
import { collection, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// 포그라운드 복귀 시 대기 중인 VLM 결과 처리
const processPendingVLMResults = async () => {
  try {
    console.log('[VLM] 포그라운드 복귀 - 대기 중인 VLM 결과 처리 시작');
    const pendingFiles = await MyModule.getPendingVLMResults();
    console.log(`[VLM] 대기 중인 VLM 결과: ${pendingFiles.length}개`);

    for (const fileName of pendingFiles) {
      try {
        const vlmResultJson = await MyModule.readVLMResult(fileName);
        if (!vlmResultJson) continue;

        const vlmResult = JSON.parse(vlmResultJson);
        const docId = fileName.replace('vlm_result_', '').replace('.json', '');
        console.log(`[VLM] 대기 결과 처리 시작 - docId: ${docId}`);

        const userId = getUserId();
        if (!userId) continue;

        const sfRef = collection(db, 'users', userId, 'SF');
        const targetDocRef = doc(sfRef, docId);

        try {
          const docSnap = await getDoc(targetDocRef);
          
          if (docSnap.exists()) {
            const docData = docSnap.data();
            // 이미 VLM 데이터가 릴스 데이터와 함께 저장되었으면 처리 건너뛰기
            if (docData.vlm_success === true || docData.analysis) {
              console.log(`[VLM] 이미 VLM 데이터가 저장된 문서 - 건너뛰기: ${docId}`);
              await MyModule.deleteVLMResult(fileName);
              continue;
            }
          } else {
            console.log(`[VLM] 문서 없음 - 새로 생성: ${docId}`);
            await setDoc(targetDocRef, {
              created_at: serverTimestamp(),
              updated_at: serverTimestamp(),
              platform: vlmResult.platform || 'youtube',
              duration: vlmResult.duration || 0,
              startTime: vlmResult.startTime || Date.now(),
              endTime: vlmResult.endTime || Date.now(),
              date: new Date().toISOString().split('T')[0],
              vlm_success: false,
              vlm_docId: docId,
              analysis: {},
              category: 'unknown'
            });
          }

          await saveVLMResult({
            platform: vlmResult.platform || 'youtube',
            docId: docId,
            ...vlmResult
          });
          console.log(`[VLM] 대기 결과 처리 완료 - docId: ${docId}`);
        } catch (updateError) {
          console.error(`[VLM] 문서 처리 실패 - docId: ${docId}:`, updateError);
          continue;
        }

        await MyModule.deleteVLMResult(fileName);
      } catch (error) {
        console.error(`[VLM] 대기 결과 처리 실패 - 파일: ${fileName}`, error);
      }
    }

    console.log('[VLM] 모든 대기 VLM 결과 처리 완료');
  } catch (error) {
    console.error('[VLM] 대기 VLM 결과 처리 오류:', error);
  }
};

// 포그라운드 복귀 시 대기 중인 사용자 반응 처리
const processPendingUserInteractions = async () => {
  try {
    console.log('[UserInteraction] 포그라운드 복귀 - 대기 중인 사용자 반응 처리 시작');
    const pendingFiles = await MyModule.getPendingUserInteractions();
    console.log(`[UserInteraction] 대기 중인 사용자 반응: ${pendingFiles.length}개`);

    for (const fileName of pendingFiles) {
      try {
        const userInteractionJson = await MyModule.readUserInteraction(fileName);
        if (!userInteractionJson) continue;

        const userInteraction = JSON.parse(userInteractionJson);
        console.log(`[UserInteraction] 대기 반응 처리 시작 - action: ${userInteraction.action}`);

        const userId = getUserId();
        if (!userId) continue;

        // userAction 매핑
        let userAction = userInteraction.action;
        if (userInteraction.action === 'plan_executed') {
          userAction = 'plan';
        } else if (userInteraction.action === 'dismissed') {
          userAction = 'close';
        } else if (userInteraction.action === 'alternative_action') {
          userAction = userInteraction.planData?.alternativeAction || '대체활동';
        }

        // Firebase에 사용자 반응 저장
        await saveUserReaction({
          reelsCount: userInteraction.sessionData?.reelsCount || 0,
          message: userInteraction.message || "",
          userAction: userAction,
          reactionTime: userInteraction.timestamp,
          date: new Date(userInteraction.timestamp).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\. /g, '-').replace('.', ''),
          time: new Date(userInteraction.timestamp).toLocaleTimeString('ko-KR', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          type: 'one_minute_notification'
        });

        console.log(`[UserInteraction] 대기 반응 처리 완료 - action: ${userInteraction.action}`);
        await MyModule.deleteUserInteraction(fileName);
      } catch (error) {
        console.error(`[UserInteraction] 대기 반응 처리 실패 - 파일: ${fileName}`, error);
      }
    }

    console.log('[UserInteraction] 모든 대기 사용자 반응 처리 완료');
  } catch (error) {
    console.error('[UserInteraction] 대기 사용자 반응 처리 오류:', error);
  }
};

// AppState 변경 감지
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    console.log('[App] 포그라운드 복귀 감지');
    setTimeout(() => {
      processPendingVLMResults();
      processPendingUserInteractions();
    }, 1000);
  }
});

// 백그라운드 이벤트 리스너 설정 함수
export const setupBackgroundListeners = () => {
  const rlsSub = MyModule.addListener(
    'onReelsTrackingUpdate',
    (event: any) => {
      // 현재 실제 데이터는 onConsoleLog를 통해 처리됨
    }
  );

  const ytShortsSub = MyModule.addListener(
    'onYouTubeShortsTrackingUpdate',
    (event: { stats: string }) => {
      // 현재 실제 데이터는 onConsoleLog를 통해 처리됨
    }
  );

  const logSub = MyModule.addListener(
    'onConsoleLog',
    (event: { message: string, tag?: string, level?: string }) => {
      const { message } = event;
      console.log(`[네이티브로그] ${message}`);

      // Firebase 저장 이벤트 처리
      if (message.startsWith('FIREBASE_SAVE_REELS|')) {
        try {
          console.log('릴스 Firebase 저장 이벤트 처리 시작:', message);
          const userId = getUserId();
          if (!userId) {
            console.warn('[Background] 릴스 저장: 사용자가 로그인되지 않음');
            return;
          }

          const parts = message.split('|');
          const data: any = {};
          parts.slice(1).forEach(part => {
            const colonIndex = part.indexOf(':');
            if (colonIndex === -1) return;
            const key = part.substring(0, colonIndex);
            const value = part.substring(colonIndex + 1);
            if (key === 'startTime' || key === 'endTime') {
              data[key] = parseInt(value);
            } else if (key === 'duration') {
              data[key] = parseFloat(value);
            } else if (key === 'vlm_analysis') {
              try {
                data[key] = JSON.parse(value);
              } catch (e) {
                console.warn('VLM 분석 데이터 파싱 실패:', e);
                data[key] = {};
              }
            } else {
              data[key] = value;
            }
          });

          console.log('Firebase에 저장할 릴스 데이터 - duration:', data.duration, 'platform:', data.platform);

          const reelsData: any = {
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration,
            platform: data.platform
          };

          if (data.vlm_category) {
            reelsData.category = data.vlm_category;
            reelsData.analysis = data.vlm_analysis || {};
            reelsData.vlm_success = true;
            reelsData.vlm_docId = data.vlm_docId;
            reelsData.vlm_updated_at = new Date();
            console.log('VLM 정보와 함께 저장:', data.vlm_category);
          }

          const targetDocId = data.docId || data.vlm_docId;
          saveReelsRecord(reelsData, targetDocId).then((docRef: any) => {
            if (docRef && docRef.id) {
              console.log('릴스 Firebase 저장 성공 DocID:', docRef.id);
            } else {
              console.log('릴스 Firebase 저장 성공 (docRef 없음)');
            }
          }).catch(error => {
            console.error('릴스 Firebase 저장 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            console.error('에러 스택:', error.stack);
          });
        } catch (error) {
          console.error('릴스 파싱 오류:', error);
        }
      }
      else if (message.startsWith('FIREBASE_SAVE_USER_REACTION|')) {
        try {
          const userId = getUserId();
          if (!userId) {
            console.warn('[Background] 사용자 반응 저장: 사용자가 로그인되지 않음');
            return;
          }

          const parts = message.split('|');
          const data: any = {};
          parts.slice(1).forEach(part => {
            const colonIndex = part.indexOf(':');
            if (colonIndex === -1) return;
            const key = part.substring(0, colonIndex);
            const value = part.substring(colonIndex + 1);
            if (key === 'reelsCount') {
              data[key] = parseInt(value);
            } else if (key === 'reactionTime') {
              data[key] = parseInt(value);
            } else {
              data[key] = value;
            }
          });

          console.log('파싱된 사용자 반응 데이터 - reelsCount:', data.reelsCount, 'userAction:', data.userAction);

          saveUserReaction({
            reelsCount: data.reelsCount,
            message: data.message,
            userAction: data.userAction,
            reactionTime: data.reactionTime,
            date: data.date,
            time: data.time,
            type: 'one_minute_notification'
          }).then(() => {
            console.log('사용자 반응 Firebase 저장 성공');
          }).catch((error: any) => {
            console.error('사용자 반응 Firebase 저장 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
          });
        } catch (error) {
          console.error('사용자 반응 파싱 오류:', error);
        }
      }
      else if (message.startsWith('VLM_ANALYSIS_FAILED|')) {
        try {
          console.log('VLM 분석 실패 이벤트 수신:', message);
          const jsonPart = message.substring('VLM_ANALYSIS_FAILED|'.length);
          const data = JSON.parse(jsonPart);
          console.log('VLM 분석 실패 데이터:', data);
        } catch (error) {
          console.error('VLM 분석 실패 이벤트 처리 오류:', error);
        }
      }
      else if (message.startsWith('PLAN_INTERACTION|')) {
        try {
          const userId = getUserId();
          if (!userId) {
            console.warn('[Background] 계획 상호작용: 사용자가 로그인되지 않음');
            return;
          }

          const jsonStr = message.substring('PLAN_INTERACTION|'.length);
          const data = JSON.parse(jsonStr);
          console.log('파싱된 계획 상호작용 데이터 - action:', data.action, 'timeSlot:', data.timeSlot);

          let userAction = data.action;
          if (data.action === 'plan_executed') {
            userAction = 'plan';
          } else if (data.action === 'dismissed') {
            userAction = 'close';
          } else if (data.action === 'alternative_action') {
            userAction = data.additionalData || data.planData?.alternativeAction || '대체활동';
          }

          saveUserReaction({
            reelsCount: data.sessionData?.reelsCount || 0,
            message: "",
            userAction: userAction,
            reactionTime: data.interactionTime,
            date: new Date(data.interactionTime).toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).replace(/\. /g, '-').replace('.', ''),
            time: new Date(data.interactionTime).toLocaleTimeString('ko-KR', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            }),
            type: 'one_minute_notification'
          }).then(() => {
            console.log('계획 상호작용 Firebase 저장 성공');
          }).catch((error: any) => {
            console.error('계획 상호작용 Firebase 저장 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
          });
        } catch (error) {
          console.error('계획 상호작용 파싱 오류:', error);
        }
      }
      else if (message.startsWith('FIREBASE_SAVE_YOUTUBE|')) {
        try {
          console.log('YouTube Shorts Firebase 저장 이벤트 처리 시작:', message);
          const userId = getUserId();
          if (!userId) {
            console.warn('[Background] YouTube Shorts 저장: 사용자가 로그인되지 않음');
            return;
          }

          const parts = message.split('|');
          const data: any = {};
          parts.slice(1).forEach(part => {
            const colonIndex = part.indexOf(':');
            if (colonIndex === -1) return;
            const key = part.substring(0, colonIndex);
            const value = part.substring(colonIndex + 1);
            if (key === 'startTime' || key === 'endTime') {
              data[key] = parseInt(value);
            } else if (key === 'duration') {
              data[key] = parseFloat(value);
            } else if (key === 'vlm_analysis') {
              try {
                data[key] = JSON.parse(value);
              } catch (e) {
                console.warn('VLM 분석 데이터 파싱 실패:', e);
                data[key] = {};
              }
            } else {
              data[key] = value;
            }
          });

          console.log('YouTube Shorts 파싱된 데이터 - duration:', data.duration, 'platform:', data.platform);

          if (!data.startTime || !data.endTime || !data.duration) {
            console.error('YouTube Shorts 필수 데이터 누락:', data);
            return;
          }

          const shortsData: any = {
            startTime: data.startTime,
            endTime: data.endTime,
            duration: data.duration,
            description: '쇼츠'
          };

          if (data.vlm_category) {
            shortsData.category = data.vlm_category;
            shortsData.analysis = data.vlm_analysis || {};
            shortsData.vlm_success = true;
            shortsData.vlm_docId = data.vlm_docId;
            shortsData.vlm_updated_at = new Date();
            console.log('VLM 정보 포함해서 YouTube Shorts 저장:', data.vlm_category);
          }

          const targetDocId = data.docId || data.vlm_docId;
          saveYouTubeShortsRecord(shortsData, targetDocId).then((docRef: any) => {
            if (docRef && docRef.id) {
              console.log('YouTube Shorts Firebase 저장 성공! DocID:', docRef.id);
            } else {
              console.log('YouTube Shorts Firebase 저장 성공 (docRef 없음)');
            }
          }).catch(error => {
            console.error('YouTube Shorts Firebase 저장 실패:', error);
            console.error('에러 코드:', error.code);
            console.error('에러 메시지:', error.message);
            console.error('에러 스택:', error.stack);
          });
        } catch (error) {
          console.error('YouTube Shorts 파싱 오류:', error);
        }
      }
    }
  );

  const vlmProcessingMap = new Map();

  const vlmSub = MyModule.addListener(
    'onVLMAnalysisRequest',
    async (event: any) => {
      try {
        // console.log('[Background] VLM 이벤트 수신:', event?.type, 'docId:', event?.docId);
        const userId = getUserId();
        if (!userId) {
          console.warn('[Background] 사용자가 로그인되지 않음');
          return;
        }

        if (event?.type === 'CREATE_FIREBASE_DOC') {
          if (AppState.currentState === 'active') {
            try {
              await createFirebaseDoc(event);
              // console.log(`[Background] Firebase 문서 생성 완료 - docId: ${event.docId}`);
            } catch (error) {
              console.error(`[Background] Firebase 문서 생성 실패 - docId: ${event.docId}:`, error);
            }
          } else {
            // console.log(`[Background] 백그라운드 상태 - 문서 생성 건너뜀: ${event.docId}`);
          }
        } else if (event?.type === 'VLM_RESULT_SAVED_LOCALLY') {
          // console.log(`[Background] VLM 결과 로컬 저장 완료 - docId: ${event.docId}, category: ${event.category}`);
        } else if (event?.type === 'USER_INTERACTION_SAVED_LOCALLY') {
          // console.log(`[Background] 사용자 반응 로컬 저장 완료 - action: ${event.action}`);
        } else if (event?.type === 'VLM_ANALYSIS_REQUEST' && event?.imageBase64) {
          const docId = event.docId;
          if (vlmProcessingMap.has(docId) && vlmProcessingMap.get(docId)) {
            // console.warn(`[Background] VLM 중복 요청 완전 차단 - docId: ${docId}`);
            return;
          }

          vlmProcessingMap.set(docId, true);
          // console.log(`[Background] VLM 처리 시작 - docId: ${docId}`);
          try {
            const vlmRequest: VLMAnalysisRequest = {
              docId: docId,
              platform: event.platform,
              timestamp: event.timestamp,
              imageBase64: event.imageBase64
            };

            await handleVLMRequest(vlmRequest);
            console.log(`[Background] VLM 처리 완료 - docId: ${docId}`);
          } catch (error) {
            console.error('[Background] VLM 분석 처리 오류:', error);
          } finally {
            vlmProcessingMap.set(docId, false);
          }
        }
      } catch (error) {
        console.error('[Background] VLM 분석 이벤트 처리 오류:', error);
      }
    }
  );

  return () => {
    console.log('백그라운드 리스너 정리 시작');
    rlsSub?.remove();
    ytShortsSub?.remove();
    logSub?.remove();
    vlmSub?.remove();
    console.log('백그라운드 리스너 정리 완료');
  };
};
