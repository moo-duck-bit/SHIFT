package expo.modules.mymodule

import android.util.Log

/**
 * 간소화된 로그 관리 클래스
 * 모든 로그 출력, 필터링 없음
 */
class LogManager {
    companion object {
        const val TAG = "LogMgr"
        
        @Volatile
        private var instance: LogManager? = null
        
        fun getInstance(): LogManager {
            return instance ?: synchronized(this) {
                instance ?: LogManager().also { instance = it }
            }
        }
    }
    
    private var reactEventEmitter: ((String, Map<String, Any>) -> Unit)? = null
    private val eventQueue = mutableListOf<Pair<String, Map<String, Any>>>()
    private val maxQueueSize = 100
    
    fun setReactEventEmitter(emitter: (String, Map<String, Any>) -> Unit) {
        reactEventEmitter = emitter
        Log.i(TAG, "React 이벤트 에미터 설정됨, 대기 중인 이벤트: ${eventQueue.size}개")
        
        // 대기 중인 이벤트들 전송
        flushEventQueue()
    }
    
    private fun flushEventQueue() {
        try {
            if (reactEventEmitter != null && eventQueue.isNotEmpty()) {
                Log.i(TAG, "대기 중인 이벤트 ${eventQueue.size}개 전송 시작")
                val eventsToSend = eventQueue.toList()
                eventQueue.clear()
                
                eventsToSend.forEach { (eventName, data) ->
                    try {
                        reactEventEmitter?.invoke(eventName, data)
                    } catch (e: Exception) {
                        Log.e(TAG, "대기 이벤트 전송 오류: ${e.message}")
                    }
                }
                Log.i(TAG, "대기 이벤트 전송 완료")
            }
        } catch (e: Exception) {
            Log.e(TAG, "이벤트 큐 비우기 오류: ${e.message}")
        }
    }
    
    private fun sendEventWithQueue(eventName: String, data: Map<String, Any>) {
        try {
            if (reactEventEmitter != null) {
                // 즉시 전송
                reactEventEmitter?.invoke(eventName, data)
                Log.d(TAG, "이벤트 즉시 전송: $eventName")
            } else {
                // 큐에 저장
                if (eventQueue.size < maxQueueSize) {
                    eventQueue.add(Pair(eventName, data))
                    Log.i(TAG, "이벤트 큐에 저장됨: $eventName (큐 크기: ${eventQueue.size})")
                } else {
                    Log.w(TAG, "이벤트 큐가 가득참, 오래된 이벤트 제거")
                    eventQueue.removeAt(0)
                    eventQueue.add(Pair(eventName, data))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "이벤트 전송 또는 큐 저장 오류: ${e.message}")
        }
    }
    
    fun sendVLMEvent(data: Map<String, Any>) {
        try {
            sendEventWithQueue("onVLMAnalysisRequest", data)
        } catch (e: Exception) {
            Log.e(TAG, "VLM 이벤트 전송 오류: ${e.message}")
            e.printStackTrace()
        }
    }
    

    
    /**
     * 로그 출력 (필터링 없음)
     */
    fun log(level: String, tag: String, message: String) {
        try {
            // 안드로이드 로그 출력
            when (level) {
                "e" -> Log.e(tag, message)
                "w" -> Log.w(tag, message) 
                "i" -> Log.i(tag, message)
                "d" -> Log.d(tag, message)
                else -> Log.v(tag, message)
            }
            
            // React Native로 전송 (큐 사용)
            sendEventWithQueue("onConsoleLog", mapOf(
                "message" to message,
                "tag" to tag,
                "level" to level
            ))
            
        } catch (e: Exception) {
            Log.e(TAG, "로그 출력 오류: ${e.message}")
        }
    }
}