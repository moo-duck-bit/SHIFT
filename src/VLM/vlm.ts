import Constants from 'expo-constants';
import { saveVLMResult } from '../config/firebase';
import MyModule from '../../modules/my-module';
import { AppState } from 'react-native';

// VLM 분석 요청 데이터 구조
interface VLMAnalysisRequest {
  docId: string;
  platform: 'instagram' | 'youtube';
  timestamp: number;
  imageBase64: string;
}

// VLM 분석 결과 데이터 구조
interface VLMAnalysisResult {
  docId: string;
  platform: string;
  timestamp: number;
  success: boolean;
  analysis?: {
    summary: string;
    category: string;
    confidence: number;
    reasoning: string;
    alternatives: Array<{ category: string; score: number; }>;
  };
  error?: string;
  processingTime: number;
  retryCount: number;
}

// API 설정
const API_CONFIG = {
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: Constants.expoConfig?.extra?.OPENROUTER_API_KEY || (process.env as any).EXPO_PUBLIC_OPENROUTER_API_KEY,
  siteURL: Constants.expoConfig?.extra?.SITE_URL || (process.env as any).EXPO_PUBLIC_SITE_URL,
  siteName: Constants.expoConfig?.extra?.SITE_NAME || (process.env as any).EXPO_PUBLIC_SITE_NAME,
  timeout: 15000, // 15초로 단축
  maxRetries: 1 // 재시도 1회로 제한
};

// 진행 중인 요청 관리
const activeRequests = new Map<string, AbortController>();

/**
 * VLM 분석 요청을 받아 처리하고 결과를 저장하는 메인 핸들러 함수
 */
async function handleVLMRequest(request: VLMAnalysisRequest): Promise<void> {
  const startTime = Date.now();
  console.log(`[VLM] 처리 시작 - docId: ${request.docId}`);

  // 기존 요청이 진행 중이면 취소
  if (activeRequests.has(request.docId)) {
    const existingController = activeRequests.get(request.docId);
    existingController?.abort();
    activeRequests.delete(request.docId);
    console.log(`[VLM] 기존 요청 취소됨 - docId: ${request.docId}`);
  }

  const abortController = new AbortController();
  activeRequests.set(request.docId, abortController);

  // 독립적인 마이크로태스크에서 처리하여 이벤트 루프 간섭 최소화
  Promise.resolve().then(async () => {
    let retryCount = 0;
    let lastError = '';

    while (retryCount <= API_CONFIG.maxRetries && !abortController.signal.aborted) {
      try {
        const analysis = await performVLMAnalysis(request, abortController.signal);

        if (abortController.signal.aborted) {
          console.log(`[VLM] 요청이 취소됨 - docId: ${request.docId}`);
          return;
        }

        if (analysis && typeof analysis === 'object') {
          //console.log(`[VLM] 분석 성공 - docId: ${request.docId}`);
          
          const result: VLMAnalysisResult = {
            ...request,
            success: true,
            analysis: analysis,
            processingTime: Date.now() - startTime,
            retryCount: retryCount,
          };

          // VLM 결과를 Android에만 임시 저장 (앱 복귀 시 릴스 데이터와 함께 Firebase에 저장됨)
          setImmediate(async () => {
            try {
              await MyModule.storeVLMResult(request.docId, analysis.category, analysis);
              console.log(`[VLM] Android 임시 저장 완료 - docId: ${request.docId}, category: ${analysis.category}`);
            } catch (saveError) {
              console.error(`[VLM] Android 임시 저장 오류 - docId: ${request.docId}:`, saveError);
            }
          });
          
          activeRequests.delete(request.docId);
          return;
        } else {
          throw new Error('API로부터 유효하지 않은 분석 객체를 받았습니다.');
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          console.log(`[VLM] 요청이 취소됨 - docId: ${request.docId}`);
          return;
        }

        retryCount++;
        const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
        lastError = errorMsg;
        
        console.error(`[VLM] 시도 ${retryCount}/${API_CONFIG.maxRetries + 1} 실패 - docId: ${request.docId}, 오류: ${errorMsg}`);
        
        if (retryCount <= API_CONFIG.maxRetries && !abortController.signal.aborted) {
          const delay = Math.min(1000 * retryCount, 3000); // 최대 3초
          console.log(`[VLM] ${delay}ms 후 재시도 - docId: ${request.docId}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 모든 재시도 실패 또는 취소됨
    if (!abortController.signal.aborted) {
      console.error(`[VLM] 모든 재시도 실패 - docId: ${request.docId}, 최종 오류: ${lastError}`);
      
      const result: VLMAnalysisResult = {
        ...request,
        success: false,
        error: `${lastError} (${retryCount - 1}회 재시도 후 실패)`,
        processingTime: Date.now() - startTime,
        retryCount: retryCount - 1,
      };

      // VLM 실패 시 Android에만 임시 저장 (앱 복귀 시 릴스 데이터와 함께 Firebase에 저장됨)
      setImmediate(async () => {
        try {
          await MyModule.storeVLMResult(request.docId, 'unknown', {});
          console.log(`[VLM] 실패 케이스 - Android 임시 저장 완료 - docId: ${request.docId}`);
        } catch (saveError) {
          console.error(`[VLM] 실패 결과 Android 임시 저장 오류 - docId: ${request.docId}:`, saveError);
        }
      });
    }

    activeRequests.delete(request.docId);
  }).catch((error) => {
    console.error(`[VLM] 마이크로태스크 오류 - docId: ${request.docId}:`, error);
    activeRequests.delete(request.docId);
  });
}

/**
 * XMLHttpRequest를 사용하여 OpenRouter API를 직접 호출하는 함수
 */
async function performVLMAnalysis(request: VLMAnalysisRequest, signal: AbortSignal): Promise<any> {
  console.log(`[VLM] API 호출 시작 - docId: ${request.docId}`);

  const payload = {
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this ${request.platform} screenshot and classify it. Return ONLY a valid JSON object matching this exact schema: {"summary": "string", "category": "string", "confidence": "number(0-100)", "reasoning": "string", "alternatives": [{"category": "string", "score": "number(0-100)"}]}. Available categories: Animation, Autos & Vehicles, Hip-Hop, Pets & Animals, Sports, Travel & Events, Gaming, V-logs, Comedy, Movie, News & Politics, How-to & Style, Education, Science & Technology, Shopping, Food & Drink, K-POP, Lifestyle, Drama, Variety show, Short-form Challenge, MEME'`
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${request.imageBase64}` }
          }
        ]
      }
    ],
    max_tokens: 400,
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // AbortSignal 연결
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('요청이 취소되었습니다.'));
      });
    }

    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      xhr.abort();
      reject(new Error(`요청 타임아웃 (${API_CONFIG.timeout}ms)`));
    }, API_CONFIG.timeout);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        clearTimeout(timeoutId);
        
        try {
          console.log(`[VLM] API 응답 수신 - docId: ${request.docId}, status: ${xhr.status}`);
          
          if (xhr.status === 200) {
            const responseData = JSON.parse(xhr.responseText);
            
            if (!responseData.choices || !responseData.choices[0] || 
                !responseData.choices[0].message || !responseData.choices[0].message.content) {
              reject(new Error('API 응답 형식이 올바르지 않습니다.'));
              return;
            }

            const content = responseData.choices[0].message.content;
            
            try {
              // 마크다운 코드 블록 마커 제거
              const cleanedContent = content
                .replace(/^```json\s*/, '')  // 시작 부분의 ```json 제거
                .replace(/```\s*$/, '')      // 끝 부분의 ``` 제거
                .trim();
              
              const parsed = JSON.parse(cleanedContent);
              //console.log(`[VLM] 응답 파싱 성공 - docId: ${request.docId}`);
              resolve(parsed);
            } catch (jsonError) {
              console.error(`[VLM] JSON 파싱 실패 - docId: ${request.docId}`, content);
              reject(new Error('API 응답을 JSON 형식으로 파싱하는 데 실패했습니다.'));
            }
          } else {
            const errorText = xhr.responseText || `HTTP ${xhr.status}`;
            reject(new Error(`API 요청 실패: ${xhr.status} - ${errorText}`));
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error('응답 처리 중 오류가 발생했습니다.'));
        }
      }
    };

    xhr.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('네트워크 오류가 발생했습니다.'));
    };

    xhr.ontimeout = () => {
      clearTimeout(timeoutId);
      reject(new Error(`요청 타임아웃 (${API_CONFIG.timeout}ms)`));
    };

    // 요청 시작
    try {
      xhr.open('POST', `${API_CONFIG.baseURL}/chat/completions`, true);
      
      // 헤더 설정
      xhr.setRequestHeader('Authorization', `Bearer ${API_CONFIG.apiKey}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (API_CONFIG.siteURL) {
        xhr.setRequestHeader('HTTP-Referer', API_CONFIG.siteURL);
      }
      if (API_CONFIG.siteName) {
        xhr.setRequestHeader('X-Title', API_CONFIG.siteName);
      }
      
      // 요청 전송
      xhr.send(JSON.stringify(payload));
      
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error('요청 전송 중 오류가 발생했습니다.'));
    }
  });
}

export { 
  handleVLMRequest,
  VLMAnalysisRequest,
  VLMAnalysisResult
};

// =============================================
// 계획 실행 검증 API
// =============================================

export interface PlanVerifyResult {
  verified: boolean;
  reason: string;
}

export async function verifyPlanEvidence(imageBase64: string, plan: { activity: string; timeSlot?: string }): Promise<PlanVerifyResult> {
  const payload = {
    model: "google/gemini-2.5-flash-lite",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "You are a strict verifier.",
              "Given the user's planned activity and a single image, decide if the image is strong evidence that the user is executing the plan now.",
              "Return ONLY a JSON object: {\"verified\": boolean, \"reason\": string}.",
              "Rules:",
              "- verified is true only if the visual content clearly shows the planned activity in progress.",
              "- If ambiguous or unrelated, set verified=false and explain succinctly in reason.",
              `Planned activity: ${plan.activity}${plan.timeSlot ? " during "+plan.timeSlot : ""}.`,
            ].join("\n")
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }
    ],
    max_tokens: 200,
    temperature: 0,
    response_format: { type: "json_object" },
  };

  return new Promise<PlanVerifyResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeoutId = setTimeout(() => {
      try { xhr.abort(); } catch {}
      reject(new Error(`요청 타임아웃 (${API_CONFIG.timeout}ms)`));
    }, API_CONFIG.timeout);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        clearTimeout(timeoutId);
        try {
          if (xhr.status === 200) {
            const responseData = JSON.parse(xhr.responseText);
            const content = responseData?.choices?.[0]?.message?.content;
            if (!content || typeof content !== 'string') {
              reject(new Error('API 응답 형식 오류'));
              return;
            }
            const cleaned = content.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
            const parsed = JSON.parse(cleaned);
            const res: PlanVerifyResult = {
              verified: !!parsed.verified,
              reason: typeof parsed.reason === 'string' ? parsed.reason : ''
            };
            resolve(res);
          } else {
            reject(new Error(`API 요청 실패: ${xhr.status}`));
          }
        } catch (e) {
          reject(e instanceof Error ? e : new Error('응답 처리 오류'));
        }
      }
    };

    xhr.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('네트워크 오류'));
    };

    try {
      xhr.open('POST', `${API_CONFIG.baseURL}/chat/completions`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${API_CONFIG.apiKey}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (API_CONFIG.siteURL) xhr.setRequestHeader('HTTP-Referer', API_CONFIG.siteURL);
      if (API_CONFIG.siteName) xhr.setRequestHeader('X-Title', API_CONFIG.siteName);
      xhr.send(JSON.stringify(payload));
    } catch (e) {
      clearTimeout(timeoutId);
      reject(e instanceof Error ? e : new Error('요청 전송 오류'));
    }
  });
}
