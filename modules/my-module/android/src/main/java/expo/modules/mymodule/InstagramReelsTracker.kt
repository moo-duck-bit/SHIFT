package expo.modules.mymodule

import android.accessibilityservice.AccessibilityService
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*
import androidx.core.app.NotificationCompat
import expo.modules.mymodule.Constants
import expo.modules.mymodule.Reels
import androidx.core.app.ServiceCompat

class InstagramReelsTracker : AccessibilityService() {

    companion object {
        private const val TAG = "IGTrak"
        @Volatile
        private var inst: InstagramReelsTracker? = null
        @Volatile
        private var isReady = false
        @Volatile
        private var isConn = false
        @Volatile
        private var isStart = false

        fun getInstance(): InstagramReelsTracker? = inst
        fun isServiceReady(): Boolean = isReady && inst != null && isConn
        
        fun getStatus(): String {
            return when {
                inst == null && !isStart -> "NOT_STARTED"
                inst == null && isStart -> "STARTING"
                inst != null && !isConn -> "CREATED"
                inst != null && isConn && !isReady -> "CONNECTING"
                inst != null && isConn && isReady -> "READY"
                else -> "UNKNOWN"
            }
        }  
        
        fun resetStatus() {
            isReady = false
            isConn = false
            isStart = false
            inst = null
        }  
    }
    // 핵심 상태 변수
    private var inIG = false
    private var inRls = false
    private var lastId = ""
    private var count = 0
    private var startT = 0L

    // Plan overlay 관련 상태 변수
    private var timeSlots: List<Map<String, String>> = emptyList()
    private var planActivity = ""
    private var planTimeSlot = ""
    private var planAlternativeAction = ""
    private var hasPlan = false

    // YouTube 관련 상태 변수
    private var inYT = false
    private var inShrt = false
    private var lastYtId = ""
    private var ytCount = 0
    private var ytStartT = 0L

    // 스크롤 세션 추적 변수 (중복 호출 완전 차단)
    private var isScrolling = false
    private var scrollStartTime = 0L
    private var scrollEndTimer: Runnable? = null
    private var currentScrollSession = ""

    // 타이머 관련 변수들
    private var oneMinTimer: Runnable? = null
    private var minuteStartTime = 0L
    private var minuteReelsCount = 0
    private var hasShownOverlay = false

    // VLM 분석 결과 임시 저장소
    private val vlmResultsMap = mutableMapOf<Long, Map<String, Any>>()
    
    // VLM 결과 캐시 (docId 기반)
    private val vlmResultCache = mutableMapOf<String, Map<String, Any>>()

    // docId 통일화를 위한 전역 관리
    private val globalDocIdMap = mutableMapOf<Long, String>()

    // 시청 기록 추적을 위한 새로운 변수들
    private val sessionViewingRecords = mutableListOf<ViewingRecord>()
    private var longestViewedContent: ViewingRecord? = null

    // 카테고리별 누적 시간 추적
    private val categoryDurations = mutableMapOf<String, Double>()

    // 권한 체크 단순화
    private var hasCheckedOverlayPermission = false

    // 디바운스 처리를 위한 변수들 - 개선
    private var lastCheckTime = 0L
    private var isCheckingShortForm = false
    private var lastPlatform = ""
    private var lastShortFormState = false
    private var lastReelsCheckTime = 0L // 릴스 체크 전용 디바운스

    // 실시간 카테고리 누적 시스템
    private val rtCats = mutableMapOf<String, Double>()
    private var sessionStartTime = 0L

    // 오버레이 관련
    private var overlay: ReelsOverlay? = null

    // 매니저들
    private val log = LogManager.getInstance()
    private val h = Handler(Looper.getMainLooper())
    private var screenshotService: ScreenshotService? = null
    private lateinit var prefs: SharedPreferences
    private val lstnrs = mutableMapOf<String, (JSONObject) -> Unit>()
    private var cachedSessionData: Map<String, Any>? = null

    // MyModule 인스턴스에 직접 이벤트 전송
    fun sendPlanOverlayActionEvent(action: String, planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData, alternativeAction: String? = null) {
        try {
            // plan_modified 액션일 때 앱을 포그라운드로 가져오기
            if (action == "plan_modified") {
                bringAppToForeground()
                
                // 앱 전환 시간을 위한 딜레이
                h.postDelayed({
                    sendPlanOverlayActionEventInternal(action, planData, sessionData, alternativeAction)
                }, 1000)
            } else {
                sendPlanOverlayActionEventInternal(action, planData, sessionData, alternativeAction)
            }
        } catch (e: Exception) {
            log.log("e", TAG, "sendPlanOverlayActionEvent 오류: ${e.message}")
        }
    }

    private fun sendPlanOverlayActionEventInternal(action: String, planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData, alternativeAction: String? = null) {
        try {
            val myModule = expo.modules.mymodule.MyModule.getInstance()
            if (myModule != null) {
                h.post {
                    try {
                        val eventData = mutableMapOf<String, Any>(
                            "action" to action,
                            "planData" to mapOf(
                                "activity" to planData.activity,
                                "timeSlot" to planData.timeSlot,
                                "alternativeAction" to planData.alternativeAction
                            ),
                            "sessionData" to mapOf(
                                "sessionDuration" to sessionData.sessionDuration,
                                "reelsCount" to sessionData.reelsCount
                            )
                        )
                        
                        // 대체 액션이 있으면 추가
                        alternativeAction?.let {
                            eventData["alternativeAction"] = it
                        }
                        
                        // MyModule의 sendEvent를 통해 onPlanOverlayAction 이벤트 발송
                        val sendEventMethod = myModule.javaClass.getDeclaredMethod("safeSendEvent", String::class.java, Map::class.java)
                        sendEventMethod.isAccessible = true
                        sendEventMethod.invoke(myModule, "onPlanOverlayAction", eventData)
                        
                        log.log("i", TAG, "onPlanOverlayAction 이벤트 발송 완료: $action")
                    } catch (e: Exception) {
                        log.log("e", TAG, "onPlanOverlayAction 이벤트 발송 실패: ${e.message}")
                    }
                }
            } else {
                log.log("w", TAG, "MyModule 인스턴스를 찾을 수 없음 - 이벤트 발송 실패")
            }
        } catch (e: Exception) {
            log.log("e", TAG, "sendPlanOverlayActionEventInternal 오류: ${e.message}")
        }
    }

    // VLM 분석 대기 로직
    private fun waitForVLMResults(sessionRecords: List<ViewingRecord>, callback: (List<ViewingRecord>) -> Unit) {
        val maxWaitTime = 10000L // 기본 10초 대기 (오버레이 10초 타이머와 정합)
        val softExtension = 8000L // 진행 중이면 최대 8초 추가 대기
        val progressWindow = 1500L // 최근 진행 판단 윈도우
        val checkInterval = 300L
        var waitedTime = 0L
        var prevCompleted = 0
        var lastProgressAt = 0L
        val handler = Handler(Looper.getMainLooper())

        fun checkVLMStatus() {
            var updatedCount = 0
            sessionRecords.forEach { record ->
                if (record.category == "unknown") {
                    val vlmResult = vlmResultCache[record.docId]
                    if (vlmResult != null) {
                        record.category = vlmResult["category"] as? String ?: "unknown"
                        record.analysis = vlmResult["analysis"] as? Map<String, Any>
                        if (record.category != "unknown") {
                            updatedCount++
                            log.log("i", TAG, "VLM 결과 매칭 성공 - docId: ${record.docId}, category: ${record.category}")
                        }
                    } else {
                        val timeBasedResult = vlmResultsMap[record.startTime]
                        if (timeBasedResult != null) {
                            record.category = timeBasedResult["category"] as? String ?: "unknown"
                            record.analysis = timeBasedResult["analysis"] as? Map<String, Any>
                            if (record.category != "unknown") {
                                updatedCount++
                                log.log("i", TAG, "VLM 결과 시간매칭 성공 - startTime: ${record.startTime}, category: ${record.category}")
                            }
                        }
                    }
                } else {
                    updatedCount++
                }
            }

            val pendingVLM = sessionRecords.count { it.category == "unknown" }
            if (updatedCount > prevCompleted) {
                lastProgressAt = waitedTime
                prevCompleted = updatedCount
            }

            log.log("d", TAG, "VLM 대기 상태 - 전체: ${sessionRecords.size}, 완료: $updatedCount, 대기: $pendingVLM, 경과시간: ${waitedTime}ms")

            if (pendingVLM == 0) {
                log.log("i", TAG, "VLM 대기 완료 - 모두 분석됨: ${updatedCount}개")
                callback(sessionRecords)
                return
            }

            val analyzedRatio = if (sessionRecords.isNotEmpty()) updatedCount.toDouble() / sessionRecords.size else 1.0
            val minSatisfied = updatedCount >= 3 || analyzedRatio >= 0.6
            val exceeded = waitedTime >= maxWaitTime
            val progressedRecently = (waitedTime - lastProgressAt) <= progressWindow
            val withinSoft = waitedTime < (maxWaitTime + softExtension)

            if (exceeded && (minSatisfied || !progressedRecently || !withinSoft)) {
                log.log("i", TAG, "VLM 대기 종료 - 완료:${updatedCount}개, 대기:${pendingVLM}개, 충분조건:${minSatisfied}, 최근진행:${progressedRecently}")
                callback(sessionRecords)
                return
            }

            waitedTime += checkInterval
            handler.postDelayed({ checkVLMStatus() }, checkInterval)
        }

        checkVLMStatus()
    }

    // Firebase 개입 메시지 저장 로직
    private fun savePersonalizedMessageToFirebase(
        message: String, 
        viewingRecords: List<ViewingRecord>, 
        planData: ReelsOverlay.PlanData?
    ) {
        try {
            val currentTime = System.currentTimeMillis()
            val requestId = "${currentTime}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
            
            val guidanceData = mutableMapOf<String, Any>(
                "requestId" to requestId,
                "userId" to (FirebaseService.getInstance()?.getUserId() ?: ""),
                "triggerContext" to "one_minute_intervention",
                "timestamp" to currentTime,
                "success" to true,
                "guidanceText" to message,
                "personalizedMessage" to message,
                "processingTime" to 0L,
                "retryCount" to 0,
                "viewingRecords" to viewingRecords.map { record ->
                    mapOf(
                        "docId" to record.docId,
                        "category" to record.category,
                        "duration" to record.duration,
                        "platform" to record.platform
                    )
                }
            )
            
            planData?.let { plan ->
                guidanceData["planData"] = mapOf(
                    "activity" to plan.activity,
                    "timeSlot" to plan.timeSlot,
                    "alternativeAction" to plan.alternativeAction
                )
            }
            
            // React Native로 이벤트 발송
            val myModule = expo.modules.mymodule.MyModule.getInstance()
            myModule?.let { module ->
                try {
                    val sendEventMethod = module.javaClass.getDeclaredMethod("safeSendEvent", String::class.java, Map::class.java)
                    sendEventMethod.isAccessible = true
                    sendEventMethod.invoke(module, "onGuidanceResultSave", guidanceData)
                    
                    log.log("i", TAG, "개입 메시지 Firebase 저장 이벤트 발송: $message")
                } catch (e: Exception) {
                    log.log("e", TAG, "개입 메시지 저장 이벤트 발송 오류: ${e.message}")
                }
            }
            
        } catch (e: Exception) {
            log.log("e", TAG, "개입 메시지 저장 이벤트 발송 오류: ${e.message}")
        }
    }

    // 시청 기록 데이터 클래스
    data class ViewingRecord(
        val docId: String,
        var category: String,
        val duration: Double,
        val startTime: Long,
        val endTime: Long,
        val platform: String,
        var analysis: Map<String, Any>? = null
    )

    // 통합 docId 생성 함수
    private fun generateUnifiedDocId(startTime: Long, platform: String): String {
        return globalDocIdMap[startTime] ?: run {
            val newDocId = when (platform) {
                "youtube" -> "yt_${startTime}_${(1000..9999).random()}"
                "instagram" -> "ig_${startTime}_${(1000..9999).random()}"
                else -> "${platform}_${startTime}_${(1000..9999).random()}"
            }
            globalDocIdMap[startTime] = newDocId
            newDocId
        }
    }

    private fun addViewingRecord(
    docId: String,
    category: String,
    duration: Double,
    startTime: Long,
    endTime: Long,
    platform: String,
    analysis: Map<String, Any>? = null
) {
    try {
        val record = ViewingRecord(docId, category, duration, startTime, endTime, platform, analysis)
        sessionViewingRecords.add(record)
        
        val categoryName = if (category != "unknown") category else "Other"
        categoryDurations[categoryName] = (categoryDurations[categoryName] ?: 0.0) + duration

        if (longestViewedContent == null || duration > longestViewedContent!!.duration) {
            longestViewedContent = record
        }

        log.log("i", TAG, "시청 기록 추가 완료 - docId: $docId, category: $categoryName, duration: ${duration}초")
    } catch (e: Exception) {
        log.log("e", TAG, "시청 기록 추가 실패: ${e.message}")
    }
}




    private fun generateCategoryMessage(): String {
    try {
        if (sessionViewingRecords.isEmpty()) {
            return "Wait! What was I trying to do?\nTry your original plan: ${planActivity}!"
        }

        val totalCount = sessionViewingRecords.size
        val sessionDurationMinutes = if (sessionStartTime > 0) {
            ((System.currentTimeMillis() - sessionStartTime) / 15000).toInt().coerceAtLeast(1)
        } else 1

        // VLM 분석이 완료된 기록들만 카테고리 분석
        val analyzedRecords = sessionViewingRecords.filter { it.category != "unknown" }
        val categoryCount = mutableMapOf<String, Int>()
        
        analyzedRecords.forEach { record ->
            val koreanCategory = getCategoryKoreanName(record.category)
            categoryCount[koreanCategory] = (categoryCount[koreanCategory] ?: 0) + 1
        }

        log.log("d", TAG, "카테고리 분석 - 전체: $totalCount, 분석완료: ${analyzedRecords.size}, 카테고리: $categoryCount")

        val dominantCategory = categoryCount.maxByOrNull { it.value }
        val dominantCategoryName = dominantCategory?.key ?: "다양한"
        val dominantCategoryCount = dominantCategory?.value ?: 0

        val baseMessage = "Wait! What was I trying to do?\n\n${sessionDurationMinutes} minutes of short-form content viewed."

        if (categoryCount.isEmpty()) {
            return "$baseMessage\nLet's do ${planActivity}!"
        }
        
        val categoryMessage = when (dominantCategoryName) {
            "게임" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} game content.\nInstead of watching game videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} game-related videos.\nLet's try ${planActivity} and feel the sense of accomplishment!",
                    "Watched ${dominantCategoryCount} game content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "애니메이션" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} animation content.\nInstead of watching animation videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} animation-related videos.\nLet's try ${planActivity} and create our own story!",
                    "Watched ${dominantCategoryCount} animation content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "자동차/차량" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} car-related content.\nInstead of watching car videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} car-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} car content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "힙합" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} hip-hop content.\nInstead of watching hip-hop videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} hip-hop-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} hip-hop content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "동물/펫" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} cute animal content.\nInstead of watching cute animal videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} pet-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} pet content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "스포츠" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} sports content.\nInstead of watching sports videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} sports-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} sports content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "여행/이벤트" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} travel content.\nInstead of watching travel videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} event-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} travel content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "일상/블로그" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} daily content.\nInstead of watching daily videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} blog-related videos.\nLet's try ${planActivity} and create our own story!",
                    "Watched ${dominantCategoryCount} daily content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "코미디" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} funny content.\nInstead of watching funny videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} comedy-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} funny content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "영화" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} movie content.\nInstead of watching movie videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} movie-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} movie content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "뉴스/정치" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} news or politics content.\nInstead of watching news or politics videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} news or politics-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} news or politics content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "꿀팁" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} tips content.\nInstead of watching tips videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} tips-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} tips content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "교육" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} education content.\nInstead of watching education videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} education-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} education content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "과학/기술" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} science or technology content.\nInstead of watching science or technology videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} science or technology-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} science or technology content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "쇼핑" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} shopping-related content.\nInstead of watching shopping videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} shopping-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} shopping content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "음식/요리" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} food or cooking content.\nInstead of watching food or cooking videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} cooking-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} food or cooking content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "K-POP" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} K-POP content.\nInstead of watching K-POP videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} K-POP-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} K-POP content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "라이프스타일" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} lifestyle content.\nInstead of watching lifestyle videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} lifestyle-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} lifestyle content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "드라마" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} drama content.\nInstead of watching drama videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} drama-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} drama content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "예능" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} variety show content.\nInstead of watching variety show videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} variety show-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} variety show content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            "숏폼 챌린지" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} short-form challenge content.\nInstead of watching short-form challenge videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} challenge-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} short-form challenge content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }

            "밈" -> {
                val messages = listOf(
                    "Especially watched ${dominantCategoryCount} meme content.\nInstead of watching meme videos, let's try ${planActivity}!",
                    "Watched ${dominantCategoryCount} meme-related videos.\nLet's try ${planActivity} and feel the energy!",
                    "Watched ${dominantCategoryCount} meme content.\nInstead of watching, let's try ${planActivity}!"
                )
                messages.random()
            }
            else -> {
                val messages = listOf(
                    "${dominantCategoryName} content was watched ${totalCount} times.\nLet's try ${planActivity}!",
                    "Watched ${totalCount} different types of videos.\nLet's try ${planActivity}!",
                    "Watched ${totalCount} content.\nLet's try ${planActivity}!"
                )
                messages.random()
            }
        }

        return "$baseMessage\n$categoryMessage"
    } catch (e: Exception) {
        log.log("e", TAG, "카테고리 메시지 생성 실패: ${e.message}")
        return "Wait! What was I trying to do?\n\nStop short-form viewing and try ${planActivity}!"
    }
}

    private fun getCategoryKoreanName(category: String): String {
        return CategoryMapper.getCategoryKoreanName(category)
    }


    private fun saveVLMResultToLocal(docId: String, vlmResult: Map<String, Any>) {
        try {
            val fileName = "vlm_result_${docId}.json"
            val jsonData = JSONObject(vlmResult).toString()
            val fileOutputStream = applicationContext.openFileOutput(fileName, Context.MODE_PRIVATE)
            fileOutputStream.write(jsonData.toByteArray())
            fileOutputStream.close()

            val notificationData = mapOf(
                "type" to "VLM_RESULT_SAVED_LOCALLY",
                "docId" to docId,
                "fileName" to fileName,
                "timestamp" to System.currentTimeMillis(),
                "category" to ((vlmResult["analysis"] as? Map<*, *>)?.get("category") ?: "unknown")
            )
            log.sendVLMEvent(notificationData)
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 로컬 저장 실패 - docId: $docId, error: ${e.message}")
        }
    }

    private fun onVLMAnalysisComplete(docId: String, result: Map<String, Any>) {
        try {
            vlmResultsMap[System.currentTimeMillis()] = result
            saveVLMResultToLocal(docId, result)
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 처리 실패 - docId: $docId")
        }
    }

    fun getPendingVLMResults(): List<String> {
        return try {
            val files = applicationContext.fileList()
            files.filter { it.startsWith("vlm_result_") && it.endsWith(".json") }.toList()
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 파일 목록 조회 실패: ${e.message}")
            emptyList()
        }
    }

    fun readVLMResult(fileName: String): String? {
        return try {
            val fileInputStream = applicationContext.openFileInput(fileName)
            val content = fileInputStream.bufferedReader().use { it.readText() }
            fileInputStream.close()
            content
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 파일 읽기 실패 - 파일: $fileName")
            null
        }
    }

    fun deleteVLMResult(fileName: String): Boolean {
        return try {
            applicationContext.deleteFile(fileName)
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 파일 삭제 실패 - 파일: $fileName")
            false
        }
    }

    // 사용자 반응 로컬 저장 함수 (VLM과 동일한 패턴)
    fun saveUserInteractionToLocal(interactionData: Map<String, Any>) {
        try {
            val timestamp = System.currentTimeMillis()
            val fileName = "user_interaction_${timestamp}.json"
            val jsonData = JSONObject(interactionData).toString()
            val fileOutputStream = applicationContext.openFileOutput(fileName, Context.MODE_PRIVATE)
            fileOutputStream.write(jsonData.toByteArray())
            fileOutputStream.close()
            
            val notificationData = mapOf(
                "type" to "USER_INTERACTION_SAVED_LOCALLY",
                "fileName" to fileName,
                "timestamp" to timestamp,
                "action" to (interactionData["action"] ?: "unknown")
            )
            log.sendVLMEvent(notificationData)
            
            log.log("i", TAG, "사용자 반응 로컬 저장 완료: $fileName")
            
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 로컬 저장 실패: ${e.message}")
        }
    }

    // 대기 중인 사용자 반응 파일들 조회
    fun getPendingUserInteractions(): List<String> {
        return try {
            val files = applicationContext.fileList()
            files.filter { it.startsWith("user_interaction_") && it.endsWith(".json") }.toList()
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 파일 목록 조회 실패: ${e.message}")
            emptyList()
        }
    }

    // 사용자 반응 파일 읽기
    fun readUserInteraction(fileName: String): String? {
        return try {
            val fileInputStream = applicationContext.openFileInput(fileName)
            val content = fileInputStream.bufferedReader().use { it.readText() }
            fileInputStream.close()
            content
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 파일 읽기 실패 - 파일: $fileName")
            null
        }
    }

    // 사용자 반응 파일 삭제
    fun deleteUserInteraction(fileName: String): Boolean {
        return try {
            applicationContext.deleteFile(fileName)
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 파일 삭제 실패 - 파일: $fileName")
            false
        }
    }

    override fun onCreate() {
        super.onCreate()
        try {
            Log.d(TAG, "서비스 onCreate 호출")
            isStart = true
            initInst()
            initPref()
            initOvrl()
            initScr()
            h.post {
                try {
                    startFgSvc()
                    Log.d(TAG, "onCreate 완료 - 상태: ${getStatus()}")
                } catch (e: Exception) {
                    Log.e(TAG, "포그라운드 서비스 시작 실패: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "onCreate 오류: ${e.message}")
            cleanUp()
        }
    }

    private fun initInst() {
        inst = this
        isReady = false
        isConn = false
    }

    private fun initPref() {
        prefs = getSharedPreferences(Constants.PREFS, Context.MODE_PRIVATE)
        count = prefs.getInt("total_count", 0)
        ytCount = prefs.getInt("yt_total_count", 0)
    }

    private fun initScr() {
        try {
            screenshotService = ScreenshotService.getInstance()
        } catch (e: Exception) {
            log.log("e", TAG, "스크린샷 서비스 초기화 실패: ${e.message}")
            screenshotService = null
        }
    }

    private fun initOvrl() {
        try {
            overlay = ReelsOverlay(this)
            overlay?.setOnPlanInteractionListener(object : ReelsOverlay.OnPlanInteractionListener {
    
                override fun onAlternativeAction(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData, action: String) {
                    log.log("i", TAG, "대체 활동 수행: $action")
                    sendPlanOverlayActionEvent("alternative_action", planData, sessionData, action)
                    handleOverlayDismissed()
                }
                override fun onPlanModified(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData) {
                    log.log("i", TAG, "계획 수정 요청됨")
                    sendPlanOverlayActionEvent("plan_modified", planData, sessionData)
                    handleOverlayDismissed()
                }
                override fun onDismissed(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData) {
                    log.log("i", TAG, "오버레이 닫힘")
                    sendPlanOverlayActionEvent("dismissed", planData, sessionData)
                    handleOverlayDismissed()
                }

                override fun onPlanExecute(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData) {
                    log.log("i", TAG, "계획 실행 선택됨")
                    // 앱을 포그라운드로 전환한 뒤 이벤트 발송 (Camera로 연동)
                    try {
                        bringAppToForeground()
                        h.postDelayed({
                            sendPlanOverlayActionEvent("execute_plan", planData, sessionData)
                        }, 800)
                    } catch (e: Exception) {
                        log.log("e", TAG, "계획 실행 이벤트 처리 오류: ${e.message}")
                        sendPlanOverlayActionEvent("execute_plan", planData, sessionData)
                    }
                    handleOverlayDismissed()
                }
            })
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 초기화 실패: ${e.message}")
            overlay = null
        }
    }

    private fun startFgSvc() {
        try {
            if (Looper.myLooper() == Looper.getMainLooper()) {
                doStartFg()
            } else {
                h.post { doStartFg() }
            }
        } catch (e: Exception) {
            log.log("e", TAG, "포그라운드 서비스 시작 실패: ${e.message}")
        }
    }

    private fun doStartFg() {
        try {
            val chId = "ig_rls_trk"
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                makeChann(nm, chId)
            }
            val noti = makeNoti(chId)
            startForeground(1, noti)
        } catch (e: Exception) {
            log.log("e", TAG, "포그라운드 서비스 실행 오류: ${e.message}")
        }
    }

    private fun makeChann(nm: NotificationManager, chId: String) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val ch = NotificationChannel(
                chId,
                "Reels tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            ch.description = "Tracks Instagram Reels usage"
            nm.createNotificationChannel(ch)
        }
    }

    private fun makeNoti(chId: String): Notification {
        return NotificationCompat.Builder(this, chId)
            .setContentTitle("Reels tracking active")
            .setContentText("Tracking Instagram usage")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        try {
            Log.d(TAG, "서비스 onServiceConnected 호출")
            checkOverlayPermissionOnce()
            connOk()
            Thread {
                try {
                    Thread.sleep(100)
                    sendConnEvt()
                    Log.d(TAG, "서비스 연결 완료 - 상태: ${getStatus()}")
                } catch (e: Exception) {
                    Log.e(TAG, "연결 이벤트 발송 오류: ${e.message}")
                }
            }.start()
        } catch (e: Exception) {
            Log.e(TAG, "onServiceConnected 오류: ${e.message}")
            connFail()
        }
    }

    private fun connOk() {
        inst = this
        isReady = true
        isConn = true
        inIG = false
        inRls = false
        stopAllTimersAndTracking()
    }

    private fun connFail() {
        isReady = false
        isConn = false
        log.log("e", TAG, "서비스 연결 실패")
    }

    private fun sendConnEvt() {
        h.post {
            try {
                sendEvt()
            } catch (e: Exception) {
                log.log("e", TAG, "연결 이벤트 전송 오류: ${e.message}")
            }
        }
    }

    override fun onDestroy() {
        try {
            Log.d(TAG, "서비스 onDestroy 호출")
            cleanUp()
        } catch (e: Exception) {
            Log.e(TAG, "onDestroy 오류: ${e.message}")
        } finally {
            super.onDestroy()
        }
    }

    private fun cleanUp() {
        try {
            isReady = false
            isConn = false
            isStart = false
            inst = null
            stopAllTimersAndTracking()
            overlay?.hide()
            overlay?.cleanup()
            overlay = null
            screenshotService?.cleanup()
            screenshotService = null
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            } catch (e: Exception) {
                Log.w(TAG, "포그라운드 서비스 종료 중 오류: ${e.message}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "cleanUp 오류: ${e.message}")
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        try {
            if (event == null || !isReady) return
            
            val pkg = event.packageName?.toString() ?: return
            
            when (pkg) {
                Constants.IG_PKG -> {
                    handleAppEvent(event, "instagram")
                }
                Constants.YT_PKG -> {
                    handleAppEvent(event, "youtube")
                }
                else -> {
                    // 다른 앱으로 전환 시 강제 종료
                    if (inIG || inYT) {
                        log.log("i", TAG, "다른 앱으로 전환 감지 - 숏폼 앱 종료 처리")
                        handleAppExit()
                    }
                }
            }
        } catch (e: Exception) {
            log.log("e", TAG, "이벤트 처리 오류: ${e.message}")
        }
    }

    // 추가: 포커스 상실 감지
    override fun onInterrupt() {
        try {
            log.log("i", TAG, "AccessibilityService 인터럽트 - 앱 종료 처리")
            if (inIG || inYT) {
                handleAppExit()
            }
        } catch (e: Exception) {
            log.log("e", TAG, "인터럽트 처리 오류: ${e.message}")
        }
    }

    // 접근성 이벤트 필터링 강화
    private var lastAppEventTime = 0L
    private val APP_EVENT_DEBOUNCE = 1000L // 1초

    /**
     * 통합 앱 이벤트 처리 - 접근성 이벤트 필터링 강화
     */
    private fun handleAppEvent(event: AccessibilityEvent, platform: String) {
        val currentTime = System.currentTimeMillis()
        
        val wasInApp = when (platform) {
            "instagram" -> inIG
            "youtube" -> inYT
            else -> false
        }

        if (!wasInApp) {
            when (platform) {
                "instagram" -> {
                    inIG = true
                    log.log("i", TAG, "Instagram 진입")
                }
                "youtube" -> {
                    inYT = true
                    log.log("i", TAG, "YouTube 진입")
                }
            }

            checkCurrentPlan()
            h.postDelayed({
                checkShortFormAndInitialize(platform)
            }, 1000)
            sendEvt()
        } else {
            // 앱 내에서는 스크롤 이벤트만 처리, 다른 이벤트는 디바운스
            if (event.eventType == AccessibilityEvent.TYPE_VIEW_SCROLLED) {
                handleScrollEvent(event, platform)
            } else {
                // 디바운스 강화 - 불필요한 체크 방지
                if (currentTime - lastAppEventTime > APP_EVENT_DEBOUNCE) {
                    lastAppEventTime = currentTime
                    h.postDelayed({
                        checkShortFormAndInitialize(platform)
                    }, 500)
                }
            }
        }
    }

    /**
     * 숏폼 확인 및 초기화 - 로깅 최적화
     */
    private fun checkShortFormAndInitialize(platform: String) {
        try {
            if (isCheckingShortForm) return

            val root = rootInActiveWindow ?: return

            try {
                isCheckingShortForm = true
                val isShortForm = when (platform) {
                    "instagram" -> isReelsScreen(root)
                    "youtube" -> isShortsScreen(root)
                    else -> false
                }

                val stateChanged = (platform != lastPlatform) || (isShortForm != lastShortFormState)

                if (isShortForm) {
                    if (stateChanged) {
                        log.log("i", TAG, "$platform 숏폼 화면 확인됨")
                    }

                    // 계획 확인을 매번 수행 (시간대별 계획 변경 대응)
                    checkCurrentPlan()
                    
                    if (hasPlan) {
                        // log.log("i", TAG, "현재 활성 계획 확인됨: $planActivity ($planTimeSlot)")
                        if (stateChanged || minuteStartTime == 0L) {
                            startTimerAndTracking(platform)
                        }
                    } else {
                        log.log("i", TAG, "현재 활성 계획이 없음 - 추적만 실행")
                        if (stateChanged) {
                            startTrackingOnly(platform)
                        }
                    }
                    startShortFormContent(platform)
                } else {
                    if (stateChanged) {
                        log.log("i", TAG, "$platform 일반 피드 화면 - 모든 타이머와 트래킹 정지")
                        stopAllTimersAndTracking()
                    }
                }

                lastPlatform = platform
                lastShortFormState = isShortForm
            } finally {
                isCheckingShortForm = false
            }
        } catch (e: Exception) {
            log.log("e", TAG, "$platform 숏폼 확인 및 초기화 오류: ${e.message}")
            isCheckingShortForm = false
        }
    }

    private fun hasOverlayPermission(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(applicationContext)
            } else {
                true
            }
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 권한 체크 오류: ${e.message}")
            false
        }
    }

    private fun checkOverlayPermissionOnce() {
        if (hasCheckedOverlayPermission) return

        hasCheckedOverlayPermission = true
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val hasPermission = Settings.canDrawOverlays(applicationContext)
                if (!hasPermission) {
                    log.log("w", TAG, "오버레이 권한이 없습니다")
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                        data = Uri.parse("package:$packageName")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                }
            }
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 권한 확인 오류: ${e.message}")
        }
    }

    private fun startTimerAndTracking(platform: String) {
        try {
            // 앱이 실제로 활성 상태인지 확인
            val isInApp = when (platform) {
                "instagram" -> inIG
                "youtube" -> inYT
                else -> false
            }
            
            if (!isInApp) {
                log.log("w", TAG, "$platform 앱이 비활성 상태 - 타이머 시작 취소")
                return
            }
            
            // 숏폼 화면인지 재확인
            val root = rootInActiveWindow
            if (root == null) {
                log.log("w", TAG, "접근성 노드가 없음 - 타이머 시작 취소")
                return
            }
            
            val isActuallyInShortForm = when (platform) {
                "instagram" -> isReelsScreen(root)
                "youtube" -> isShortsScreen(root)
                else -> false
            }
            
            if (!isActuallyInShortForm) {
                return
            }
            
            // 타이머가 이미 실행 중이 아니고, 계획이 있고, 오버레이를 아직 보여주지 않았을 때만
            if (minuteStartTime == 0L && hasPlan && !hasShownOverlay) {
                log.log("i", TAG, "$platform 10s timer start - plan: $planActivity")
                startOneMinuteTimer()
            } else {
                log.log("d", TAG, "$platform 타이머 시작 조건 미충족 - minuteStartTime: $minuteStartTime, hasPlan: $hasPlan, hasShownOverlay: $hasShownOverlay")
            }
            
        } catch (e: Exception) {
            log.log("e", TAG, "$platform 타이머 시작 오류: ${e.message}")
        }
    }

    private fun startTrackingOnly(platform: String) {
        // 스크롤 트래킹만 활성화
    }

    /**
     * 스크롤 이벤트 처리 - 로깅 최적화
     */
    private fun handleScrollEvent(event: AccessibilityEvent, platform: String) {
        try {
            val deltaY = event.scrollDeltaY
            if (Math.abs(deltaY) < 20) return

            if (isScrolling) {
                extendScrollSession()
                return
            }

            startScrollSession(platform, deltaY)
        } catch (e: Exception) {
            // 스크롤 이벤트에서는 로그 출력하지 않음 (과도한 로깅 방지)
        }
    }

    private fun startScrollSession(platform: String, deltaY: Int) {
        try {
            val root = rootInActiveWindow ?: return
            try {
                val isShortForm = when (platform) {
                    "instagram" -> isReelsScreen(root)
                    "youtube" -> isShortsScreen(root)
                    else -> false
                }

                if (isShortForm) {
                    isScrolling = true
                    scrollStartTime = System.currentTimeMillis()
                    currentScrollSession = "${platform}_${scrollStartTime}"
                    setScrollEndTimer(platform)
                }
            } finally {
                try {
                    // root.recycle()
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            resetScrollSession()
        }
    }

    private fun extendScrollSession() {
        scrollEndTimer?.let { h.removeCallbacks(it) }
        val platform = currentScrollSession.split("_")[0]
        setScrollEndTimer(platform)
    }

    private fun setScrollEndTimer(platform: String) {
        scrollEndTimer = Runnable {
            finishScrollSession(platform)
        }
        h.postDelayed(scrollEndTimer!!, 300)
    }

    private fun finishScrollSession(platform: String) {
    try {
        if (!isScrolling) return
        
        val contentEndTime = System.currentTimeMillis()
        var contentStartTime = 0L
        var shouldSaveToFirebase = false
        
        when (platform) {
            "instagram" -> {
                if (inRls) {
                    contentStartTime = startT
                    shouldSaveToFirebase = true
                    endRls()
                }
            }
            "youtube" -> {
                if (inShrt) {
                    contentStartTime = ytStartT
                    shouldSaveToFirebase = true
                    endYtShrt()
                }
            }
        }

        if (shouldSaveToFirebase && contentStartTime > 0) {
            captureScreenshotAndSendToRN(platform, contentStartTime, contentEndTime)
        }

        h.postDelayed({
            detectNewShortFormContent(platform)
            resetScrollSession()
        }, 100)
    } catch (e: Exception) {
        log.log("e", TAG, "$platform 스크롤 세션 완료 처리 오류: ${e.message}")
        resetScrollSession()
    }
}


    private fun captureScreenshotAndSendToRN(platform: String, startTime: Long, endTime: Long) {
        try {
            if (screenshotService == null) return

            screenshotService!!.captureScreenshot(this, object : ScreenshotService.ScreenshotListener {
                override fun onCaptureSuccess(imageBase64: String, docId: String, timestamp: Long) {
                    sendToReactNative(imageBase64, docId, timestamp, platform, startTime, endTime)
                }
                override fun onCaptureFailure(error: String, timestamp: Long) {
                    log.log("e", TAG, "$platform 스크린샷 캡처 실패: $error")
                }
            })
        } catch (e: Exception) {
            log.log("e", TAG, "$platform 스크린샷 캡처 오류: ${e.message}")
        }
    }

    private fun sendToReactNative(
        imageBase64: String,
        docId: String,
        timestamp: Long,
        platform: String,
        contentStartTime: Long,
        contentEndTime: Long
    ) {
        try {
            val duration = if (contentStartTime > 0) (contentEndTime - contentStartTime) / 1000.0 else 0.0
            
            // 현재 실제 앱 상태에 따른 플랫폼 재확인
            val actualPlatform = when {
                inIG && inRls -> "instagram"
                inYT && inShrt -> "youtube"
                inIG -> "instagram"
                inYT -> "youtube"
                else -> platform // 기본값
            }
            
            val correctDocId = generateUnifiedDocId(contentStartTime, actualPlatform)
            
            // 플랫폼 불일치 로그
            if (actualPlatform != platform) {
                log.log("w", TAG, "플랫폼 불일치 감지 - 요청: $platform, 실제: $actualPlatform")
            }
            
            val createDocData = mapOf(
                "type" to "CREATE_FIREBASE_DOC",
                "docId" to correctDocId,
                "platform" to actualPlatform, // 실제 플랫폼 사용
                "timestamp" to timestamp,
                "contentStartTime" to contentStartTime,
                "contentEndTime" to contentEndTime,
                "contentDuration" to duration
            )
            
            log.sendVLMEvent(createDocData)
            log.log("i", TAG, "Firebase 문서 생성 요청 - 플랫폼: $actualPlatform, docId: $correctDocId")
            
            val vlmData = mapOf(
                "type" to "VLM_ANALYSIS_REQUEST",
                "docId" to correctDocId,
                "platform" to actualPlatform, // 실제 플랫폼 사용
                "timestamp" to timestamp,
                "imageBase64" to imageBase64,
                "imageSize" to imageBase64.length,
                "captureTime" to System.currentTimeMillis(),
                "contentStartTime" to contentStartTime,
                "contentEndTime" to contentEndTime,
                "contentDuration" to duration,
                "hasUser" to true
            )
            
            log.sendVLMEvent(vlmData)
            
        } catch (e: Exception) {
            log.log("e", TAG, "$platform React Native 통신 오류: ${e.message}")
        }
    }

    private fun detectNewShortFormContent(platform: String) {
        try {
            val root = rootInActiveWindow ?: return
            try {
                if (platform == "instagram") {
                    val found = isReelsScreen(root)
                    if (found && !inRls) {
                        startRls("릴스")
                    } else if (!found && inRls) {
                        h.postDelayed({
                            checkReelsEnd()
                        }, 1000)
                    }
                } else if (platform == "youtube") {
                    val found = isShortsScreen(root)
                    if (found && !inShrt) {
                        startYtShrt()
                    } else if (!found && inShrt) {
                        endYtShrt()
                    }
                }
            } finally {
                try {
                    // root.recycle()
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            log.log("e", TAG, "$platform 콘텐츠 감지 오류: ${e.message}")
        }
    }

    private fun checkReelsEnd() {
        try {
            if (!inRls) return
            val root = rootInActiveWindow ?: return
            try {
                val stillInReels = isReelsScreen(root)
                if (!stillInReels) {
                    endRls()
                }
            } finally {
                try {
                    // root.recycle()
                } catch (_: Exception) {}
            }
        } catch (e: Exception) {
            log.log("e", TAG, "릴스 종료 확인 오류: ${e.message}")
        }
    }

    private fun startShortFormContent(platform: String) {
        when (platform) {
            "instagram" -> {
                if (!inRls) {
                    startRls("릴스")
                }
            }
            "youtube" -> {
                if (!inShrt) {
                    startYtShrt()
                }
            }
        }
    }

    private fun startOneMinuteTimer() {
        try {
            // 기존 타이머가 있다면 정지
            stopOneMinuteTimer()
            
            minuteStartTime = System.currentTimeMillis()
            minuteReelsCount = 0
            hasShownOverlay = false
            clearCats()
            sessionStartTime = System.currentTimeMillis()

            oneMinTimer = Runnable {
                try {
            log.log("i", TAG, "10s timer finished - showing overlay")
                    showOverlay()
                } catch (e: Exception) {
                    log.log("e", TAG, "오버레이 표시 오류: ${e.message}")
                }
            }
            h.postDelayed(oneMinTimer!!, 10000)
            log.log("i", TAG, "10s timer started - plan: $planActivity, time: $planTimeSlot")
        } catch (e: Exception) {
            log.log("e", TAG, "10s timer start error: ${e.message}")
        }
    }

    private fun showOverlay() {
        try {
            if (hasShownOverlay) return
            if (!hasPlan) return
            if (!hasOverlayPermission()) return

            hasShownOverlay = true

            if (overlay == null) {
                initOvrl()
            }

            log.log("i", TAG, "VLM 결과 대기 시작 - 총 ${sessionViewingRecords.size}개 기록")
            
            // VLM 분석 대기: 진행 상황에 따라 유연 대기
            waitForVLMResults(sessionViewingRecords) { updatedRecords ->
                try {
                    val analyzedCount = updatedRecords.count { it.category != "unknown" }
                    log.log("i", TAG, "VLM 대기 완료 - 전체: ${updatedRecords.size}, 분석완료: $analyzedCount")
                    
                    val categoryMessage = generateCategoryMessage()
                    val planData = ReelsOverlay.PlanData(
                        activity = planActivity,
                        timeSlot = planTimeSlot,
                        alternativeAction = planAlternativeAction
                    )

                    val convertedViewingRecords = updatedRecords.map { record ->
                        ReelsOverlay.ViewingRecord(
                            docId = record.docId,
                            category = record.category,
                            duration = record.duration,
                            startTime = record.startTime,
                            endTime = record.endTime,
                            platform = record.platform,
                            analysis = record.analysis
                        )
                    }

                    val convertedLongestContent = longestViewedContent?.let { record ->
                        ReelsOverlay.ViewingRecord(
                            docId = record.docId,
                            category = record.category,
                            duration = record.duration,
                            startTime = record.startTime,
                            endTime = record.endTime,
                            platform = record.platform,
                            analysis = record.analysis
                        )
                    }

                    val sessionData = ReelsOverlay.SessionData(
                        sessionDuration = 1,
                        reelsCount = updatedRecords.count { it.category != "unknown" },
                        viewingRecords = convertedViewingRecords,
                        longestViewedContent = convertedLongestContent,
                        categoryDurations = categoryDurations.toMap(),
                        personalizedMessage = categoryMessage
                    )

                    savePersonalizedMessageToFirebase(categoryMessage, updatedRecords, planData)
                    overlay?.showAnalysisOverlay(planData, sessionData)
                    log.log("i", TAG, "시청 분석 오버레이 표시 완료 - 분석된 기록: ${analyzedCount}개")
                } catch (e: Exception) {
                    log.log("e", TAG, "VLM 대기 후 오버레이 표시 오류: ${e.message}")
                    hasShownOverlay = false
                }
            }
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 표시 오류: ${e.message}")
            hasShownOverlay = false
        }
    }

    private fun handleOverlayDismissed() {
        try {
            log.log("i", TAG, "오버레이 닫힘 - 타이머 정지")
            stopOneMinuteTimer()
            overlay?.hide()
            h.postDelayed({
                checkShortFormAndRestartCycle()
            }, 2000)
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 닫힘 처리 오류: ${e.message}")
        }
    }

    private fun checkShortFormAndRestartCycle() {
        try {
            var isWatchingShortForm = false
            var currentPlatform = ""

            if (inIG) {
                val root = rootInActiveWindow
                if (root != null) {
                    try {
                        if (isReelsScreen(root)) {
                            isWatchingShortForm = true
                            currentPlatform = "instagram"
                        }
                    } finally {
                        try {
                            // root.recycle()
                        } catch (_: Exception) {}
                    }
                }
            }

            if (inYT && !isWatchingShortForm) {
                val root = rootInActiveWindow
                if (root != null) {
                    try {
                        if (isShortsScreen(root)) {
                            isWatchingShortForm = true
                            currentPlatform = "youtube"
                        }
                    } finally {
                        try {
                            // root.recycle()
                        } catch (_: Exception) {}
                    }
                }
            }

            if (isWatchingShortForm) {
                log.log("i", TAG, "오버레이 닫기 후 숏폼 시청 중 확인됨 - 2번으로 돌아가서 다시 시작")
                checkShortFormAndInitialize(currentPlatform)
            }
        } catch (e: Exception) {
            log.log("e", TAG, "숏폼 시청 확인 및 재시작 오류: ${e.message}")
        }
    }

    private fun handleAppExit() {
        try {
            log.log("i", TAG, "앱 종료 감지 - 모든 상태 초기화 시작")
            
            // 현재 상태 로깅
            log.log("d", TAG, "종료 시 상태 - inIG: $inIG, inYT: $inYT, inRls: $inRls, inShrt: $inShrt, minuteStartTime: $minuteStartTime")
            
            // 진행 중인 세션 강제 종료
            if (inRls) {
                log.log("i", TAG, "릴스 세션 강제 종료")
                endRls()
            }
            
            if (inShrt) {
                log.log("i", TAG, "YouTube Shorts 세션 강제 종료")
                endYtShrt()
            }
            
            // 앱 상태 강제 초기화
            inIG = false
            inYT = false
            inRls = false
            inShrt = false
            
            // 모든 타이머와 트래킹 정지
            stopAllTimersAndTracking()
            
            // 세션 데이터 정리
            resetScrollSession()
            clearCats()
            
            // 오버레이 숨기기
            overlay?.hide()
            
            // 상태 변경 이벤트 발송
            sendEvt()
            
            log.log("i", TAG, "앱 종료 처리 완료 - 모든 상태 초기화됨")
            
        } catch (e: Exception) {
            log.log("e", TAG, "앱 종료 처리 오류: ${e.message}")
        }
    }

    fun stopAllTimersAndTracking() {
        try {
            stopOneMinuteTimer()
            resetScrollSession()
            clearCats()
            overlay?.hide()
        } catch (e: Exception) {
            log.log("e", TAG, "타이머 및 트래킹 정지 오류: ${e.message}")
        }
    }

    private fun stopOneMinuteTimer() {
        try {
            oneMinTimer?.let {
                h.removeCallbacks(it)
                oneMinTimer = null
            }
            minuteStartTime = 0L
            minuteReelsCount = 0
            hasShownOverlay = false
            sessionViewingRecords.clear()
            longestViewedContent = null
            categoryDurations.clear()
        } catch (e: Exception) {
            log.log("e", TAG, "타이머 정리 오류: ${e.message}")
        }
    }

    private fun resetScrollSession() {
        scrollEndTimer?.let { h.removeCallbacks(it) }
        isScrolling = false
        scrollStartTime = 0L
        currentScrollSession = ""
        scrollEndTimer = null
    }

    /**
     * Instagram 릴스 화면 확인 - 개선된 정확도
     */
    private fun isReelsScreen(root: AccessibilityNodeInfo): Boolean {
        try {
            val currentTime = System.currentTimeMillis()
            
            // 릴스 체크 전용 디바운싱 (100ms)
            if (currentTime - lastReelsCheckTime < 100) {
                return lastShortFormState && lastPlatform == "instagram"
            }
            lastReelsCheckTime = currentTime

            // 1. 릴스 전용 컨테이너 확인 (가장 확실한 방법)
            val reelsContainer = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/clips_viewer_view_pager")
            if (reelsContainer.isNotEmpty()) {
                return true
            }

            // 2. 릴스 비디오 플레이어 확인
            val reelsPlayer = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/clips_media_view")
            if (reelsPlayer.isNotEmpty()) {
                return true
            }

            // 3. 릴스 UI 컴포넌트들 확인
            val capNodes = root.findAccessibilityNodeInfosByViewId(Constants.CAP_CMP)
            val vwrNodes = root.findAccessibilityNodeInfosByViewId(Constants.RLS_VWR)
            val likeNodes = root.findAccessibilityNodeInfosByViewId(Constants.RLS_LIKE)

            // 릴스 특유의 우측 액션 버튼들 확인
            val reelsActionBar = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/clips_action_bar")
            if (reelsActionBar.isNotEmpty()) {
                return true
            }

            // 여러 릴스 컴포넌트가 동시에 감지될 때만 true
            val reelsComponentCount = listOf(capNodes, vwrNodes, likeNodes).count { it.isNotEmpty() }
            if (reelsComponentCount >= 2) {
                return true
            }

            // 4. 텍스트 기반 탭 확인 (최후 수단)
            val reelsTabKr = root.findAccessibilityNodeInfosByText("릴스")
                .firstOrNull { it.isSelected }
            if (reelsTabKr != null) {
                // 탭이 선택되었을 때만, 실제 릴스 콘텐츠가 있는지 한 번 더 확인
                val hasVideoContent = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/video_view")
                return hasVideoContent.isNotEmpty()
            }

            val reelsTabEn = root.findAccessibilityNodeInfosByText("Reels")
                .firstOrNull { it.isSelected }
            if (reelsTabEn != null) {
                val hasVideoContent = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/video_view")
                return hasVideoContent.isNotEmpty()
            }

            // 5. 일반 피드와 구분하기 위한 추가 체크
            // 일반 피드는 리사이클러뷰 구조를 가지지만, 릴스는 ViewPager 구조
            val feedRecycler = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/feed_recycler_view")
            val feedListView = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/feed_list_view")
            
            // 피드 구조가 감지되면 릴스가 아님
            if (feedRecycler.isNotEmpty() || feedListView.isNotEmpty()) {
                // 단, 피드 내 릴스 미리보기인지 확인
                val inlinePeeks = root.findAccessibilityNodeInfosByViewId("com.instagram.android:id/clips_inline_peek")
                if (inlinePeeks.isEmpty()) {
                    return false
                }
            }

            return false
        } catch (e: Exception) {
            log.log("e", TAG, "Instagram 릴스 화면 확인 오류: ${e.message}")
            return false
        }
    }

    private fun isShortsScreen(root: AccessibilityNodeInfo): Boolean {
        try {
            val shortsPlayer = root.findAccessibilityNodeInfosByViewId(Constants.YT_SHORTS_PLAYER)
            if (shortsPlayer.isNotEmpty()) return true

            val shortsOverlay = root.findAccessibilityNodeInfosByViewId(Constants.YT_SHORTS_OVERLAY)
            if (shortsOverlay.isNotEmpty()) return true

            val shortsLike = root.findAccessibilityNodeInfosByViewId(Constants.YT_SHORTS_LIKE)
            if (shortsLike.isNotEmpty()) return true

            val shortsTab = root.findAccessibilityNodeInfosByText("Shorts")
                .firstOrNull { it.isSelected }
            if (shortsTab != null) return true

            return false
        } catch (e: Exception) {
            log.log("e", TAG, "YouTube Shorts 화면 확인 오류: ${e.message}")
            return false
        }
    }

    private fun startRls(desc: String) {
        try {
            val now = System.currentTimeMillis()
            val newId = "rls-$now"
            if (newId == lastId || (inRls && now - startT < 1000)) return

            inRls = true
            lastId = newId
            count++
            startT = now
            if (minuteStartTime > 0 && !hasShownOverlay) {
                minuteReelsCount++
            }

            val timeStr = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(now))
            log.log("i", TAG, "릴스 시작: $timeStr")
            
            // 릴스 시작 시 계획 다시 확인 및 타이머 시작
            checkCurrentPlan()
            if (hasPlan && minuteStartTime == 0L && !hasShownOverlay) {
                log.log("i", TAG, "Re-starting 10s timer with Reels start")
                startOneMinuteTimer()
            }
            
            saveStats(now, desc)
            sendEvt()
        } catch (e: Exception) {
            log.log("e", TAG, "릴스 시작 오류: ${e.message}")
        }
    }

    private fun endRls() {
        try {
            if (!inRls) return
            val now = System.currentTimeMillis()
            val dur = (now - startT) / 1000.0

            // 일관된 docId 생성 (VLM 결과 대기 없이)
            val docId = generateUnifiedDocId(startT, "instagram")
            
            val vlmResult = vlmResultsMap[startT]
            if (vlmResult != null) {
                val category = vlmResult["category"] as? String ?: "unknown"
                val analysis = vlmResult["analysis"] as? Map<String, Any>
                addViewingRecord(docId, category, dur, startT, now, "instagram", analysis)
                log.log("i", TAG, "Instagram Reels 종료 - VLM 결과 포함: $category")
            } else {
                // VLM 결과가 아직 없어도 올바른 docId로 저장 (나중에 업데이트됨)
                addViewingRecord(docId, "unknown", dur, startT, now, "instagram")
                log.log("i", TAG, "Instagram Reels 종료 - VLM 결과 대기 중: $docId")
            }

            inRls = false
            log.log("i", TAG, "Instagram Reels 종료 - 시청시간: ${dur}초, docId: $docId")
            updateStats(now, dur)
            sendEvt()
        } catch (e: Exception) {
            log.log("e", TAG, "endRls 오류: ${e.message}")
        }
    }

    private fun startYtShrt() {
        try {
            if (inShrt) return
            val now = System.currentTimeMillis()
            inShrt = true
            ytStartT = now
            ytCount++
            prefs.edit()
                .putInt("yt_total_count", ytCount)
                .putLong("yt_last_start", now)
                .apply()
            log.log("i", TAG, "YouTube Shorts 시작 - 총 개수: $ytCount")
            
            // YouTube Shorts 시작 시 계획 확인 및 타이머 시작
            checkCurrentPlan()
            if (hasPlan && minuteStartTime == 0L && !hasShownOverlay) {
                log.log("i", TAG, "Re-starting 10s timer with Shorts start")
                startOneMinuteTimer()
            }
            
            sendEvt()
        } catch (e: Exception) {
            log.log("e", TAG, "YouTube Shorts 시작 오류: ${e.message}")
        }
    }
    private fun endYtShrt() {
        try {
            if (!inShrt) return
            val now = System.currentTimeMillis()
            val dur = (now - ytStartT).toDouble() / 1000.0
            if (dur < Constants.MIN_VIEW / 1000.0) {
                inShrt = false
                return
            }

            // 일관된 docId 생성 (VLM 결과 대기 없이)
            val docId = generateUnifiedDocId(ytStartT, "youtube")
            
            val vlmResult = vlmResultsMap[ytStartT]
            if (dur >= Constants.MIN_VIEW / 1000.0 && vlmResult != null) {
                val category = vlmResult["category"] as? String ?: "unknown"
                val analysis = vlmResult["analysis"] as? Map<String, Any>
                addViewingRecord(docId, category, dur, ytStartT, now, "youtube", analysis)
                log.log("i", TAG, "YouTube Shorts 종료 - VLM 결과 포함: $category")
            } else {
                // VLM 결과가 아직 없어도 올바른 docId로 저장 (나중에 업데이트됨)
                addViewingRecord(docId, "unknown", dur, ytStartT, now, "youtube")
                log.log("i", TAG, "YouTube Shorts 종료 - VLM 결과 대기 중: $docId")
            }

            inShrt = false
            log.log("i", TAG, "YouTube Shorts 종료 - 시청 시간: ${dur}초, docId: $docId")
            updateYtStats(now, dur)
            sendEvt()
        } catch (e: Exception) {
            log.log("e", TAG, "YouTube Shorts 종료 오류: ${e.message}")
        }
    }

    private fun saveStats(now: Long, desc: String) {
        try {
            prefs.edit()
                .putInt("total_count", count)
                .putLong("last_start", now)
                .putString("last_desc", desc)
                .apply()
        } catch (e: Exception) {
            log.log("e", TAG, "통계 저장 오류: ${e.message}")
        }
    }

    private fun updateStats(now: Long, dur: Double) {
        try {
            val totalTime = prefs.getFloat("total_time", 0f) + dur.toFloat()
            prefs.edit()
                .putFloat("total_time", totalTime)
                .putLong("last_end", now)
                .apply()
            sendReelsListener(startT, now, dur)
        } catch (e: Exception) {
            log.log("e", TAG, "통계 업데이트 오류: ${e.message}")
        }
    }

    private fun updateYtStats(now: Long, dur: Double) {
        try {
            val totalTime = prefs.getFloat("yt_total_time", 0f) + dur.toFloat()
            prefs.edit()
                .putFloat("yt_total_time", totalTime)
                .putLong("yt_last_end", now)
                .apply()
            sendShortsListener(ytStartT, now, dur)
        } catch (e: Exception) {
            log.log("e", TAG, "YouTube Shorts 통계 업데이트 오류: ${e.message}")
        }
    }

    private fun sendReelsListener(startTime: Long, endTime: Long, duration: Double) {
        try {
            val docId = generateUnifiedDocId(startTime, "instagram")
            var firebaseLogData = "FIREBASE_SAVE_REELS|" +
                    "startTime:$startTime|" +
                    "endTime:$endTime|" +
                    "duration:$duration|" +
                    "platform:instagram|" +
                    "docId:$docId|" +
                    "date:${SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(startTime))}"

            val vlmResult = vlmResultsMap[startTime]
            if (vlmResult != null) {
                firebaseLogData += "|vlm_category:${vlmResult["category"]}" +
                        "|vlm_docId:${vlmResult["docId"]}" +
                        "|vlm_analysis:${JSONObject(vlmResult["analysis"] as Map<*, *>).toString()}"
                vlmResultsMap.remove(startTime)
            }

            log.log("i", TAG, firebaseLogData)
        } catch (e: Exception) {
            log.log("e", TAG, "Instagram 데이터 전송 오류: ${e.message}")
        }
    }

    private fun sendShortsListener(startTime: Long, endTime: Long, duration: Double) {
        try {
            val docId = generateUnifiedDocId(startTime, "youtube")
            var firebaseLogData = "FIREBASE_SAVE_YOUTUBE|" +
                    "startTime:$startTime|" +
                    "endTime:$endTime|" +
                    "duration:$duration|" +
                    "platform:youtube|" +
                    "docId:$docId|" +
                    "date:${SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(startTime))}"

            val vlmResult = vlmResultsMap[startTime]
            if (vlmResult != null) {
                firebaseLogData += "|vlm_category:${vlmResult["category"]}" +
                        "|vlm_docId:${vlmResult["docId"]}" +
                        "|vlm_analysis:${JSONObject(vlmResult["analysis"] as Map<*, *>).toString()}"
                vlmResultsMap.remove(startTime)
            }

            log.log("i", TAG, firebaseLogData)
        } catch (e: Exception) {
            log.log("e", TAG, "YouTube 데이터 전송 오류: ${e.message}")
        }
    }

    private fun sendEvt() {
        try {
            val data = JSONObject().apply {
                put("inIG", inIG)
                put("inRls", inRls)
                put("count", count)
                put("time", System.currentTimeMillis())
                put("inYT", inYT)
                put("inShrt", inShrt)
                put("ytCount", ytCount)
            }

            for (lstnr in lstnrs.values) {
                try {
                    lstnr(data)
                } catch (e: Exception) {
                    log.log("e", TAG, "리스너 호출 오류: ${e.message}")
                }
            }
        } catch (e: Exception) {
            log.log("e", TAG, "이벤트 전송 오류: ${e.message}")
        }
    }

    // 계획 확인 최적화
    private var lastPlanCheckTime = 0L
    private val PLAN_CHECK_DEBOUNCE = 30000L // 30초

    private fun checkCurrentPlan() {
    try {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastPlanCheckTime < PLAN_CHECK_DEBOUNCE) {
            return
        }
        lastPlanCheckTime = currentTime

        val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
        val currentDate = Date(currentTime)
        val timeString = sdf.format(currentDate)

        if (timeSlots.isEmpty()) {
            this.hasPlan = false
            return
        }

        val calendar = Calendar.getInstance()
        calendar.time = currentDate
        val currentMinutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)

        val activeSlot = timeSlots.find { slot ->
            val startTime = slot["startTime"] ?: ""
            val endTime = slot["endTime"] ?: ""
            if (startTime.isEmpty() || endTime.isEmpty()) return@find false

            try {
                val startParts = startTime.split(":")
                val endParts = endTime.split(":")
                val startMinutes = startParts[0].toInt() * 60 + startParts[1].toInt()
                val endMinutes = endParts[0].toInt() * 60 + endParts[1].toInt()

                val isInTimeSlot = if (startMinutes <= endMinutes) {
                    currentMinutes >= startMinutes && currentMinutes <= endMinutes
                } else {
                    currentMinutes >= startMinutes || currentMinutes <= endMinutes
                }

                log.log("d", TAG, "시간대 확인: $startTime-$endTime ($startMinutes-$endMinutes), 현재: $timeString ($currentMinutes), 해당: $isInTimeSlot")
                isInTimeSlot
            } catch (e: Exception) {
                log.log("e", TAG, "시간 파싱 오류: ${e.message}")
                false
            }
        }

        if (activeSlot != null) {
            this.planActivity = activeSlot["activity"] ?: ""
            this.planTimeSlot = "${activeSlot["startTime"]}-${activeSlot["endTime"]}"
            this.planAlternativeAction = activeSlot["alternativeAction"] ?: ""
            this.hasPlan = true
            log.log("i", TAG, "현재 활성 계획 발견: ${this.planActivity} (${this.planTimeSlot})")
        } else {
            this.hasPlan = false
            log.log("d", TAG, "현재 시간 $timeString 에 활성 계획이 없음")
        }
    } catch (e: Exception) {
        this.hasPlan = false
        log.log("e", TAG, "계획 확인 중 오류: ${e.message}")
    }
}


    private fun clearCats() {
        rtCats.clear()
        sessionStartTime = 0L
    }

    // MyModule 연동 메서드들
    fun addLstnr(id: String, lstnr: (JSONObject) -> Unit) {
        lstnrs[id] = lstnr
    }

    fun rmLstnr(id: String) {
        lstnrs.remove(id)
    }

    fun getStats(): JSONObject {
        return try {
            JSONObject().apply {
                put("inIG", inIG)
                put("inRls", inRls)
                put("count", count)
                put("totalTime", prefs.getFloat("total_time", 0f))
                put("inYT", inYT)
                put("inShrt", inShrt)
                put("ytCount", ytCount)
                put("ytTotalTime", prefs.getFloat("yt_total_time", 0f))
            }
        } catch (e: Exception) {
            log.log("e", TAG, "통계 조회 오류: ${e.message}")
            JSONObject()
        }
    }

    fun cacheTodayPlan(slots: List<Map<String, String>>) {
        try {
            this.timeSlots = slots
            log.log("i", TAG, "오늘의 계획 캐시 완료: ${slots.size}개 항목")
        } catch (e: Exception) {
            log.log("e", TAG, "계획 캐시 오류: ${e.message}")
        }
    }

    fun storeVLMResult(docId: String, category: String, analysis: Map<String, Any>) {
        try {
            val vlmData = mapOf(
                "docId" to docId,
                "category" to category,
                "analysis" to analysis,
                "timestamp" to System.currentTimeMillis()
            )
            
            // VLM 결과 캐시에 저장 (docId 기반)
            vlmResultCache[docId] = vlmData
            
            // sessionViewingRecords에서 해당 docId 찾아서 실시간 업데이트
            var updateCount = 0
            sessionViewingRecords.forEach { record ->
                if (record.docId == docId && record.category == "unknown") {
                    record.category = category
                    record.analysis = analysis
                    updateCount++
                    log.log("i", TAG, "세션 기록 실시간 업데이트 - docId: $docId, category: $category")
                }
            }
            
            // 기존 vlmResultsMap 저장 로직 (시간 기반 매칭용)
            val currentTime = System.currentTimeMillis()
            if (startT > 0 && System.currentTimeMillis() - startT < 30000) {
                vlmResultsMap[startT] = vlmData
            } else if (ytStartT > 0 && System.currentTimeMillis() - ytStartT < 30000) {
                vlmResultsMap[ytStartT] = vlmData
            } else {
                vlmResultsMap[currentTime] = vlmData
            }

            log.log("i", TAG, "VLM 결과 임시 저장 완료 - docId: $docId, category: $category, 업데이트: ${updateCount}개")
            onVLMAnalysisComplete(docId, vlmData)
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 저장 오류: ${e.message}")
        }
    }

    fun setPlanInfo(activity: String, timeSlot: String, alternativeAction: String) {
        try {
            this.planActivity = activity
            this.planTimeSlot = timeSlot
            this.planAlternativeAction = alternativeAction
            this.hasPlan = true
            log.log("i", TAG, "계획 정보 설정: $activity ($timeSlot)")
        } catch (e: Exception) {
            log.log("e", TAG, "계획 정보 설정 오류: ${e.message}")
        }
    }

    fun cacheTodaySessionData(sessionData: Map<String, Any>) {
        try {
            log.log("i", TAG, "오늘의 세션 데이터 캐시 완료")
        } catch (e: Exception) {
            log.log("e", TAG, "세션 데이터 캐시 오류: ${e.message}")
        }
    }

    fun resetInstagramState() {
        try {
            inIG = false
            inRls = false
            lastId = ""
            count = 0
            startT = 0L
            minuteStartTime = 0L
            minuteReelsCount = 0
            hasShownOverlay = false
            log.log("i", TAG, "인스타그램 상태 리셋 완료")
        } catch (e: Exception) {
            log.log("e", TAG, "인스타그램 상태 리셋 오류: ${e.message}")
        }
    }

    fun clearVLMResult(docId: String) {
        try {
            val keysToRemove = mutableListOf<Long>()
            vlmResultsMap.forEach { (key, value) ->
                if (value["docId"] == docId) {
                    keysToRemove.add(key)
                }
            }

            keysToRemove.forEach { key ->
                vlmResultsMap.remove(key)
            }

            val docIdKeysToRemove = mutableListOf<Long>()
            globalDocIdMap.forEach { (key, value) ->
                if (value == docId) {
                    docIdKeysToRemove.add(key)
                }
            }

            docIdKeysToRemove.forEach { key ->
                globalDocIdMap.remove(key)
            }

            if (keysToRemove.isNotEmpty() || docIdKeysToRemove.isNotEmpty()) {
                log.log("d", TAG, "VLM 결과 및 docId 맵 정리 완료 - docId: $docId")
            }
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 결과 정리 오류: ${e.message}")
        }
    }

    fun turnOffScreen(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
                log.log("i", TAG, "화면 잠금으로 Turn off display 성공")
                true
            } else {
                performGlobalAction(GLOBAL_ACTION_HOME)
                h.postDelayed({
                    try {
                        val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                        val goToSleepMethod = powerManager.javaClass.getMethod("goToSleep", Long::class.java)
                        goToSleepMethod.invoke(powerManager, System.currentTimeMillis())
                        log.log("i", TAG, "화면 끄기 성공 (API 27 이하)")
                    } catch (e: Exception) {
                        log.log("e", TAG, "화면 끄기 실패 (API 27 이하): ${e.message}")
                    }
                }, 500)
                true
            }
        } catch (e: Exception) {
            log.log("e", TAG, "화면 끄기 실패: ${e.message}")
            false
        }
    }

    fun performBackAction(): Boolean {
        return try {
            performGlobalAction(GLOBAL_ACTION_BACK)
            log.log("i", TAG, "시스템 Go back 실행 성공")
            true
        } catch (e: Exception) {
            log.log("e", TAG, "시스템 Go back 실행 실패: ${e.message}")
            false
        }
    }

    // 앱을 포그라운드로 가져오는 함수
    private fun bringAppToForeground() {
        try {
            log.log("i", TAG, "앱을 포그라운드로 가져오기 시도")
            
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT
                component = android.content.ComponentName(applicationContext.packageName, "${applicationContext.packageName}.MainActivity")
            }
            
            applicationContext.startActivity(intent)
            log.log("i", TAG, "앱을 포그라운드로 가져오기 완료")
            
        } catch (e: Exception) {
            log.log("e", TAG, "앱을 포그라운드로 가져오기 실패: ${e.message}")
            
            // 대체 방법 시도
            try {
                val packageManager = applicationContext.packageManager
                val launchIntent = packageManager.getLaunchIntentForPackage(applicationContext.packageName)
                
                if (launchIntent != null) {
                    launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    applicationContext.startActivity(launchIntent)
                    log.log("i", TAG, "대체 방법으로 앱 포그라운드 전환 완료")
                }
            } catch (fallbackError: Exception) {
                log.log("e", TAG, "대체 방법도 실패: ${fallbackError.message}")
            }
        }
    }

}
