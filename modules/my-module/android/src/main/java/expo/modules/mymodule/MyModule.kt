package expo.modules.mymodule

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import java.util.concurrent.TimeUnit
import android.os.Process
import expo.modules.kotlin.Promise
import java.util.*
import org.json.JSONObject
import android.view.accessibility.AccessibilityManager
import java.text.SimpleDateFormat
import android.accessibilityservice.AccessibilityServiceInfo
import expo.modules.mymodule.LogManager
import android.os.Handler
import android.os.Looper
import android.content.ComponentName
import android.content.pm.PackageManager
import android.Manifest
import androidx.core.content.ContextCompat
import android.net.Uri
import android.os.Build

class MyModule : Module() {
    companion object {
        private var instance: MyModule? = null
        
        fun getInstance(): MyModule? = instance
    }
    
    private val TAG = Constants.TAG_MODULE
    private val logMgr = LogManager.getInstance()
    private var planOverlay: ReelsOverlay? = null
    
    // 개인화 메시지 캐시 관련 변수
    private var personalizedMessage: String? = null
    private var messageTimestamp: Long = 0
    private val MESSAGE_CACHE_DURATION = 30 * 60 * 1000L // 30분으로 늘림

  
      init {
        instance = this
        Log.i(TAG, "MyModule 초기화 시작")
        logMgr.setReactEventEmitter { eventName, params ->
            Log.i(TAG, "React 이벤트 발송: $eventName, 파라미터: $params")
            safeSendEvent(eventName, params)
        }
        Log.i(TAG, "MyModule 초기화 완료 - reactEventEmitter 설정됨")
    }
  
  // 안전한 이벤트 발송 함수 (메인 스레드에서 실행)
  private fun safeSendEvent(eventName: String, params: Map<String, Any>) {
    try {
      Handler(Looper.getMainLooper()).post {
        sendEvent(eventName, params)
      }
    } catch (e: Exception) {
      Log.e(TAG, "이벤트 발송 오류: ${e.message}")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("MyModule")

    Constants(
      "PI" to Math.PI
    )

    Events("onChange", "onReelsTrackingUpdate", "onYouTubeShortsTrackingUpdate", "onConsoleLog", "onPlanOverlayAction", "onPlanActionRequested", "onVLMAnalysisRequest",  "onUserInteractionSaved", "onUserReactionSave", "onOverlayInteractionSave", "onGuidanceResultSave")

    AsyncFunction("setValueAsync") { value: String ->
      sendEvent("onChange", mapOf<String, Any>("value" to value))
    }
    
    // 계획 오버레이 관련 함수들
    AsyncFunction("showPlanOverlay") { activity: String, timeSlot: String, alternativeAction: String, sessionDuration: Int, reelsCount: Int, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No React context")
        
        if (planOverlay == null) {
          planOverlay = ReelsOverlay(context)
          planOverlay?.setOnPlanInteractionListener(object : ReelsOverlay.OnPlanInteractionListener {

            override fun onAlternativeAction(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData, action: String) {
              sendEvent("onPlanOverlayAction", mapOf<String, Any>(
                "action" to "alternative_action",
                "alternativeAction" to action,
                "planData" to mapOf(
                  "activity" to planData.activity,
                  "timeSlot" to planData.timeSlot,
                  "alternativeAction" to planData.alternativeAction
                ),
                "sessionData" to mapOf(
                  "sessionDuration" to sessionData.sessionDuration,
                  "reelsCount" to sessionData.reelsCount
                )
              ))
            }
            
            override fun onPlanModified(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData) {
              logMgr.log("i", TAG, "계획 수정 요청됨")
              
              // 트래커 정지
              val tracker = InstagramReelsTracker.getInstance()
              tracker?.let {
                  it.stopAllTimersAndTracking()
                  logMgr.log("i", TAG, "계획 수정으로 인한 타이머 정지")
                  
                  // InstagramReelsTracker를 통해 이벤트 발송 (앱 포그라운드 포함)
                  it.sendPlanOverlayActionEvent("plan_modified", planData, sessionData)
                  logMgr.log("i", TAG, "InstagramReelsTracker를 통한 이벤트 발송 완료")
              }
              
              // 이벤트는 InstagramReelsTracker에서 발송됨
              sendEvent("onConsoleLog", mapOf(
                  "level" to "i",
                  "tag" to TAG,
                  "message" to "계획 수정 콜백 처리 완료"
              ))
          }


            
            override fun onDismissed(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData) {
              sendEvent("onPlanOverlayAction", mapOf<String, Any>(
                "action" to "dismissed",
                "planData" to mapOf(
                  "activity" to planData.activity,
                  "timeSlot" to planData.timeSlot,
                  "alternativeAction" to planData.alternativeAction
                ),
                "sessionData" to mapOf(
                  "sessionDuration" to sessionData.sessionDuration,
                  "reelsCount" to sessionData.reelsCount
                )
              ))
            }

            override fun onPlanExecute(planData: ReelsOverlay.PlanData, sessionData: ReelsOverlay.SessionData) {
              // 실행 버튼 콜백 - RN으로 전달
              sendEvent("onPlanOverlayAction", mapOf<String, Any>(
                "action" to "execute_plan",
                "planData" to mapOf(
                  "activity" to planData.activity,
                  "timeSlot" to planData.timeSlot,
                  "alternativeAction" to planData.alternativeAction
                ),
                "sessionData" to mapOf(
                  "sessionDuration" to sessionData.sessionDuration,
                  "reelsCount" to sessionData.reelsCount
                )
              ))
            }
          })
        }
        
        val planData = ReelsOverlay.PlanData(activity, timeSlot, alternativeAction)
        val sessionData = ReelsOverlay.SessionData(sessionDuration, reelsCount)
        
        planOverlay?.showPlanOverlay(planData, sessionData)
        promise.resolve(true)
        
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "계획 오버레이 표시 오류: ${e.message}"
        ))
        promise.reject("PLAN_OVERLAY_ERROR", "Failed to show plan overlay", e)
      }
    }
    
    AsyncFunction("hidePlanOverlay") { promise: Promise ->
      try {
        planOverlay?.hide()
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("PLAN_OVERLAY_ERROR", "Failed to hide plan overlay", e)
      }
    }
    
    // 오버레이 리소스 정리
    AsyncFunction("cleanupPlanOverlay") { promise: Promise ->
      try {
        planOverlay?.cleanup()
        planOverlay = null
        promise.resolve(true)
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "오버레이 리소스 정리 오류: ${e.message}"
        ))
        promise.reject("PLAN_OVERLAY_CLEANUP_ERROR", "Failed to cleanup plan overlay", e)
      }
    }
    
    // VLM 결과 저장
    AsyncFunction("storeVLMResult") { docId: String, category: String, analysis: Map<String, Any>, promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        if (tracker != null) {
          tracker.storeVLMResult(docId, category, analysis)
          promise.resolve(null)
        } else {
          promise.resolve(null)
        }
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "VLM 결과 저장 오류: ${e.message}"
        ))
        promise.resolve(null)
      }
    }
    


    
    // 알림 권한 체크 
    AsyncFunction("checkNotificationPermission") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No React context")
        
        val hasPermission = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
          ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
          ) == PackageManager.PERMISSION_GRANTED
        } else {
          true // 안드로이드 13 이하에서는 자동으로 허용
        }
        
        promise.resolve(hasPermission)
      } catch (e: Exception) {
        promise.reject("NOTIFICATION_PERMISSION_ERROR", "Failed to check notification permission", e)
      }
    }
    
    // 알림 설정 화면 열기
    Function("openNotificationSettings") {
      try {
        val context = appContext.reactContext ?: return@Function mapOf<String, Any>(
          "success" to false,
          "message" to "No React context"
        )
        
        val intent = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          }
        } else {
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
          }
        }
        
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context.startActivity(intent)
        
        return@Function mapOf<String, Any>("success" to true, "message" to "Notification settings opened")
      } catch (e: Exception) {
        logErr("openNotificationSettings", e)
        return@Function mapOf<String, Any>("success" to false, "message" to (e.message ?: "Unknown error"))
      }
    }

    AsyncFunction("checkUsageStatsPermission") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No React context")
        
        // Method 1: UsageStatsManager를 통한 실제 접근 테스트 (가장 안정적)
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val time = System.currentTimeMillis()
        val usageStatsList = usageStatsManager.queryUsageStats(
          UsageStatsManager.INTERVAL_DAILY,
          time - 1000 * 60 * 60 * 24, // 24시간 전
          time
        )
        
        val hasUsageStatsAccess = usageStatsList != null && usageStatsList.isNotEmpty()
        
        // Method 2: AppOpsManager를 통한 백업 확인
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
          appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
          )
        } else {
          @Suppress("DEPRECATION")
          appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
          )
        }
        
        val hasAppOpsPermission = mode == AppOpsManager.MODE_ALLOWED
        
        // 두 방법 중 하나라도 성공하면 권한이 있다고 판단
        val finalResult = hasUsageStatsAccess || hasAppOpsPermission
        
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "d",
            "tag" to TAG,
            "message" to "Usage Stats 권한 확인 - 실제접근: $hasUsageStatsAccess, AppOps: $hasAppOpsPermission, 최종: $finalResult"
        ))
        
        promise.resolve(finalResult)
        
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "e",
            "tag" to TAG,
            "message" to "Usage Stats 권한 확인 오류: ${e.message}"
        ))
        promise.reject("PERMISSION_CHECK_ERROR", "Failed to check usage stats permission", e)
      }
    }
    
    Function("openUsageAccessSettings") {
      try {
        val context = appContext.reactContext ?: return@Function "Failed to get context"
        
        // 앱별 사용량 접근 설정으로 직접 이동
        try {
          val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
          // 특정 앱 설정으로 바로 이동 시도
          if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            intent.data = android.net.Uri.parse("package:${context.packageName}")
          }
          intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
          context.startActivity(intent)
          
          sendEvent("onConsoleLog", mapOf<String, Any>(
              "level" to "i",
              "tag" to TAG,
              "message" to "사용량 접근 설정 화면 열림 (패키지: ${context.packageName})"
          ))
          
          return@Function "Settings opened for package: ${context.packageName}"
        } catch (specificException: Exception) {
          // 특정 앱 설정 실패 시 일반 설정으로 폴백
          val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
          intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
          context.startActivity(intent)
          
          sendEvent("onConsoleLog", mapOf<String, Any>(
              "level" to "w",
              "tag" to TAG,
              "message" to "특정 앱 설정 실패, 일반 설정으로 이동: ${specificException.message}"
          ))
          
          return@Function "Settings opened (general)"
        }
        
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "e",
            "tag" to TAG,
            "message" to "사용량 접근 설정 열기 실패: ${e.message}"
        ))
        return@Function "Failed to open settings: ${e.message}"
      }
    }
    
    AsyncFunction("diagnoseUsageStatsPermission") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No React context")
        val packageName = context.packageName
        
        val diagnosticInfo = mutableMapOf<String, Any>()
        
        // 1. 기본 정보
        diagnosticInfo["packageName"] = packageName
        diagnosticInfo["androidVersion"] = android.os.Build.VERSION.SDK_INT
        diagnosticInfo["buildVersion"] = android.os.Build.VERSION.RELEASE
        
        // 2. UsageStatsManager 테스트
        try {
          val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
          val time = System.currentTimeMillis()
          val usageStatsList = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            time - 1000 * 60 * 60 * 24,
            time
          )
          
          diagnosticInfo["usageStatsAvailable"] = usageStatsList != null
          diagnosticInfo["usageStatsCount"] = usageStatsList?.size ?: 0
          diagnosticInfo["hasUsageStatsData"] = usageStatsList != null && usageStatsList.isNotEmpty()
          
        } catch (e: Exception) {
          diagnosticInfo["usageStatsError"] = e.message ?: "Unknown error"
          diagnosticInfo["usageStatsAvailable"] = false
        }
        
        // 3. AppOpsManager 테스트
        try {
          val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
          val mode = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
              AppOpsManager.OPSTR_GET_USAGE_STATS,
              Process.myUid(),
              packageName
            )
          } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
              AppOpsManager.OPSTR_GET_USAGE_STATS,
              Process.myUid(),
              packageName
            )
          }
          
          diagnosticInfo["appOpsMode"] = mode
          diagnosticInfo["appOpsModeAllowed"] = mode == AppOpsManager.MODE_ALLOWED
          diagnosticInfo["appOpsModeString"] = when(mode) {
            AppOpsManager.MODE_ALLOWED -> "ALLOWED"
            AppOpsManager.MODE_IGNORED -> "IGNORED"
            AppOpsManager.MODE_ERRORED -> "ERRORED"
            AppOpsManager.MODE_DEFAULT -> "DEFAULT"
            else -> "UNKNOWN($mode)"
          }
          
        } catch (e: Exception) {
          diagnosticInfo["appOpsError"] = e.message ?: "Unknown error"
        }
        
        // 4. 권한 상태 요약
        val hasUsageAccess = diagnosticInfo["hasUsageStatsData"] as? Boolean ?: false
        val hasAppOpsAccess = diagnosticInfo["appOpsModeAllowed"] as? Boolean ?: false
        diagnosticInfo["finalPermissionStatus"] = hasUsageAccess || hasAppOpsAccess
        
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "i",
            "tag" to TAG,
            "message" to "사용량 통계 권한 진단 완료: $diagnosticInfo"
        ))
        
        promise.resolve(diagnosticInfo.toMap())
        
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "e",
            "tag" to TAG,
            "message" to "사용량 통계 권한 진단 오류: ${e.message}"
        ))
        promise.reject("DIAGNOSTIC_ERROR", "Failed to diagnose usage stats permission", e)
      }
    }
    
    AsyncFunction("startReelsTracking") { promise: Promise ->
      try {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "d",
            "tag" to TAG,
            "message" to "📱 릴스 트래킹 시작 시도..."
        ))
        
        //  6글자 이하 함수로 분리
        val result = chkAndStart(promise)
        if (result != null) {
          promise.resolve(result)
        }
        
      } catch (e: Exception) {
          sendEvent("onConsoleLog", mapOf<String, Any>(
              "level" to "e",
              "tag" to TAG,
              "message" to "릴스 트래킹 시작 중 예외 발생: ${e.message}"
          ))
          promise.reject("ERR_REELS_TRACKING", "릴스 트래킹 시작 중 오류: ${e.message}", e)
      }
    }
    
    AsyncFunction("stopReelsTracking") { promise: Promise ->
      try {
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERROR", "Error stopping", e)
      }
    }
    
    AsyncFunction("getReelsStatistics") { promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        if (tracker != null) {
          val stats = tracker.getStats()
          promise.resolve(stats.toString())
          return@AsyncFunction
        }
        
        val emptyStats = JSONObject().apply {
          put("inReelsMode", false)
          put("currentReelName", "")
          put("currentDuration", 0)
          put("totalReelsViewTime", 0)
          put("reelsViewCount", 0)
          put("scrollCount", 0)
          put("averageTimePerReel", 0)
        }
        
        promise.resolve(emptyStats.toString())
      } catch (e: Exception) {
        promise.reject("ERROR", "Error getting statistics", e)
      }
    }
    
    AsyncFunction("setPlanInfo") { activity: String, timeSlot: String, alternativeAction: String, promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        
        if (tracker == null) {
          promise.resolve(false)
          return@AsyncFunction
        }
        
        tracker.setPlanInfo(activity, timeSlot, alternativeAction)
        
        safeSendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "i",
          "tag" to TAG,
          "message" to "계획 정보 설정: $activity ($timeSlot)"
        ))
        
        promise.resolve(true)
        
      } catch (e: Exception) {
        safeSendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "계획 정보 설정 오류: ${e.message}"
        ))
        promise.resolve(false)
      }
    }
    
    AsyncFunction("resetReelsStatistics") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No React context")
        val prefs = context.getSharedPreferences(Constants.PREFS, Context.MODE_PRIVATE)
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val today = dateFormat.format(Date())
        
        prefs.edit()
            .putString("reels_sessions_$today", "[]")
            .putString("reels_summary_$today", JSONObject().apply {
              put("date", today)
              put("totalReelsCount", 0L)
              put("totalViewTime", 0L)
              put("totalScrollCount", 0L)
              put("averageTimePerReel", 0L)
            }.toString())
            .apply()
        
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERROR", "Error resetting statistics", e)
      }
    }

    // ============================================
    // 사용자 반응 관련 함수들
    // ============================================

    // 대기 중인 사용자 반응 조회
    AsyncFunction("getPendingUserInteractions") { promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        if (tracker == null) {
          promise.resolve(emptyList<String>())
          return@AsyncFunction
        }
        
        val pendingFiles = tracker.getPendingUserInteractions()
        sendEvent("onConsoleLog", mapOf(
          "level" to "d",
          "tag" to TAG,
          "message" to "대기 중인 사용자 반응 파일 ${pendingFiles.size}개 발견"
        ))
        promise.resolve(pendingFiles)
        
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf(
          "level" to "e",
          "tag" to TAG,
          "message" to "사용자 반응 파일 조회 오류: ${e.message}"
        ))
        promise.reject("GET_PENDING_USER_INTERACTIONS_ERROR", "Failed to get pending user interactions", e)
      }
    }

    // 사용자 반응 파일 읽기
    AsyncFunction("readUserInteraction") { fileName: String, promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        if (tracker == null) {
          promise.resolve(null)
          return@AsyncFunction
        }
        
        val content = tracker.readUserInteraction(fileName)
        promise.resolve(content)
        
      } catch (e: Exception) {
        promise.reject("READ_USER_INTERACTION_ERROR", "Failed to read user interaction", e)
      }
    }

    // 사용자 반응 파일 삭제
    AsyncFunction("deleteUserInteraction") { fileName: String, promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        if (tracker == null) {
          promise.resolve(false)
          return@AsyncFunction
        }
        
        val success = tracker.deleteUserInteraction(fileName)
        promise.resolve(success)
        
      } catch (e: Exception) {
        promise.reject("DELETE_USER_INTERACTION_ERROR", "Failed to delete user interaction", e)
      }
    }

    // ============================================
    // YouTube Shorts 추적 관련 함수들
    // ============================================

    AsyncFunction("startYouTubeShortsTracking") { promise: Promise ->
      try {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "d",
            "tag" to TAG,
            "message" to "📱 통합 추적 서비스 (YouTube Shorts 포함) 시작 시도..."
        ))
        
        // 통합 추적 서비스 시작 (Instagram Reels Tracker가 YouTube도 처리)
        val result = chkAndStart(promise)
        if (result != null) {
          promise.resolve(result)
        }
        
      } catch (e: Exception) {
          sendEvent("onConsoleLog", mapOf<String, Any>(
              "level" to "e",
              "tag" to TAG,
              "message" to "통합 추적 서비스 시작 중 예외 발생: ${e.message}"
          ))
          promise.reject("ERR_YOUTUBE_SHORTS_TRACKING", "통합 추적 서비스 시작 중 오류: ${e.message}", e)
      }
    }

    AsyncFunction("stopYouTubeShortsTracking") { promise: Promise ->
      try {
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERROR", "Error stopping YouTube Shorts tracking", e)
      }
    }

    AsyncFunction("getYouTubeShortsStatistics") { promise: Promise ->
      try {
        val tracker = InstagramReelsTracker.getInstance()
        if (tracker != null) {
          val stats = tracker.getStats()
          promise.resolve(stats.toString())
          return@AsyncFunction
        }
        
        val emptyStats = JSONObject().apply {
          put("inYouTube", false)
          put("inShorts", false)
          put("currentShortsName", "")
          put("currentDuration", 0)
          put("totalShortsViewTime", 0)
          put("shortsViewCount", 0)
          put("scrollCount", 0)
          put("averageTimePerShorts", 0)
        }
        
        promise.resolve(emptyStats.toString())
      } catch (e: Exception) {
        promise.reject("ERROR", "Error getting YouTube Shorts statistics", e)
      }
    }

    AsyncFunction("resetYouTubeShortsStatistics") { promise: Promise ->
      try {
        // YouTube Shorts 통계 리셋 (통합 서비스)
        val context = appContext.reactContext ?: throw Exception("No React context")
        val prefs = context.getSharedPreferences(Constants.PREFS, Context.MODE_PRIVATE)
        val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
        val today = dateFormat.format(Date())
        
        // YouTube Shorts 전용 통계 초기화
        prefs.edit()
            .putInt("yt_total_count", 0)
            .putFloat("yt_total_time", 0f)
            .putLong("yt_last_start", 0L)
            .putLong("yt_last_end", 0L)
            .putString("youtube_sessions_$today", "[]")
            .putString("youtube_summary_$today", JSONObject().apply {
              put("date", today)
              put("totalShortsCount", 0L)
              put("totalViewTime", 0L)
              put("totalScrollCount", 0L)
              put("averageTimePerShort", 0L)
            }.toString())
            .apply()
        
        // 서비스 인스턴스가 있으면 YouTube 카운트 초기화
        InstagramReelsTracker.getInstance()?.let { tracker ->
          tracker.javaClass.getDeclaredField("ytCount").apply {
            isAccessible = true
            set(tracker, 0)
          }
        }
        
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERROR", "Error resetting YouTube Shorts statistics", e)
      }
    }

    // AsyncFunction("isYouTubeShortsServiceEnabled") { promise: Promise ->
    //   try {
    //     val context = appContext.reactContext ?: throw Exception("No React context")
        
    //     // 통합 서비스 상태 확인 (Instagram Reels Tracker가 YouTube도 처리)
    //     val chkSet = chkSets(context)      // Settings 확인
    //     val chkMgrResult = chkMgr(context)   // Manager 확인  
    //     val chkInstResult = chkInst()      // 인스턴스 확인
        
    //     logChkRst(chkSet, chkMgrResult, chkInstResult) // 결과 로깅
        
    //     val isEnabled = chkSet && chkMgrResult && chkInstResult
    //     promise.resolve(isEnabled)
        
    //   } catch (e: Exception) {
    //     logErr("isYouTubeShortsServiceEnabled", e)
    //     promise.resolve(false)
    //   }
    // }
    
    AsyncFunction("isAccessibilityServiceEnabled") { promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw Exception("No React context")
        
        // 여러 방법으로 접근성 서비스 상태 확인
        val chkSet = chkSets(context)      // Settings 확인
        val chkMgrResult = chkMgr(context) // Manager 확인  
        val chkInstResult = chkInst()      // 인스턴스 확인
        
        logChkRst(chkSet, chkMgrResult, chkInstResult) // 결과 로깅
        
        val isEnabled = chkSet && chkMgrResult && chkInstResult
        promise.resolve(isEnabled)
        
      } catch (e: Exception) {
        logErr("isAccessibilityServiceEnabled", e)
        promise.resolve(false)
      }
    }
    
    Function("openAccessibilitySettings") {
      try {
        val context = appContext.reactContext ?: return@Function mapOf<String, Any>(
          "success" to false, 
          "message" to "No React context"
        )
        
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        context.startActivity(intent)
        
        return@Function mapOf<String, Any>("success" to true, "message" to "Settings opened")
      } catch (e: Exception) {
        logErr("openAccessibilitySettings", e)
        return@Function mapOf<String, Any>("success" to false, "message" to (e.message ?: "Unknown error"))
      }
    }
    
    // 오버레이 권한 체크 단순화
    AsyncFunction("checkOverlayPermission") { promise: Promise ->
        try {
            val context = appContext.reactContext ?: throw Exception("No React context")
            
            val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(context.applicationContext)
            } else {
                true
            }
            
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("OVERLAY_PERMISSION_CHECK_ERROR", "Failed to check overlay permission", e)
        }
    }
    
    Function("openOverlaySettings") {
      try {
        val context = appContext.reactContext ?: return@Function mapOf<String, Any>(
          "success" to false,
          "message" to "No React context"
        )
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
          val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:${context.packageName}")
          )
          intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
          context.startActivity(intent)
        }
        
        return@Function mapOf<String, Any>("success" to true, "message" to "Overlay settings opened")
      } catch (e: Exception) {
        logErr("openOverlaySettings", e)
        return@Function mapOf<String, Any>("success" to false, "message" to (e.message ?: "Unknown error"))
      }
    }

    AsyncFunction("cacheTodayPlan") { slots: List<Map<String, String>>, promise: Promise ->
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                logMgr.log("w", TAG, "트래커 인스턴스 없음 - 계획 캐시 실패")
                promise.resolve(false)
                return@AsyncFunction
            }
            
            tracker.cacheTodayPlan(slots)
            logMgr.log("i", TAG, "오늘의 계획 캐시 완료: ${slots.size}개 항목")
            promise.resolve(true)

        } catch (e: Exception) {
            logMgr.log("e", TAG, "계획 캐시 중 오류: ${e.message}")
            promise.reject("PLAN_CACHE_ERROR", "Failed to cache plan", e)
        }
    }

    AsyncFunction("cacheTodaySessionData") { sessionData: Map<String, Any>, promise: Promise ->
        try {
            logMgr.log("i", TAG, "세션 데이터 캐시 요청 수신됨")
            logMgr.log("d", TAG, "전달받은 세션 데이터: $sessionData")
            
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                logMgr.log("w", TAG, "트래커 인스턴스 없음 - 세션 데이터 캐시 실패")
                promise.resolve(false)
                return@AsyncFunction
            }
            
            // 데이터 유효성 검사 및 상세 로깅
            val totalCount = sessionData["totalCount"] as? Number
            val totalDuration = sessionData["totalDuration"] as? Number
            val sessionCount = sessionData["sessionCount"] as? Number
            val platformBreakdown = sessionData["platformBreakdown"] as? Map<String, Any>
            
            logMgr.log("i", TAG, "세션 데이터 검증 - totalCount: $totalCount, totalDuration: ${totalDuration}분, sessionCount: $sessionCount")
            
            if (platformBreakdown != null) {
                val instagram = platformBreakdown["instagram"] as? Map<String, Any>
                val youtube = platformBreakdown["youtube"] as? Map<String, Any>
                logMgr.log("d", TAG, "플랫폼별 세션 - Instagram: ${instagram?.get("count")}개(${instagram?.get("duration")}분), YouTube: ${youtube?.get("count")}개(${youtube?.get("duration")}분)")
            }
            
            // 세션 데이터가 유효한지 확인
            if (totalCount != null && totalCount.toInt() > 0) {
                logMgr.log("i", TAG, "✅ 유효한 세션 데이터 감지 - 총 ${totalCount}개 영상, ${totalDuration}분")
            } else {
                logMgr.log("w", TAG, "⚠️ 세션 데이터가 비어있음 - totalCount: $totalCount")
            }
            
            if (tracker != null) {
                tracker.cacheTodaySessionData(sessionData)
                promise.resolve(true)
            } else {
                logMgr.log("w", TAG, "트래커 인스턴스 없음 - 세션 데이터 캐시 실패")
                promise.resolve(false)
            }

        } catch (e: Exception) {
            logMgr.log("e", TAG, "세션 데이터 캐시 중 오류: ${e.message}")
            promise.reject("SESSION_CACHE_ERROR", "Failed to cache session data", e)
        }
    }

    AsyncFunction("setPersonalizedMessage") { message: String, promise: Promise ->
        try {
            logMgr.log("i", TAG, "개인화 메시지 저장 요청 수신됨: ${message.take(50)}...")
            setPersonalizedMessage(message)
            promise.resolve(true)
        } catch (e: Exception) {
            logMgr.log("e", TAG, "개인화 메시지 저장 중 오류: ${e.message}")
            promise.reject("MESSAGE_SAVE_ERROR", "Failed to save personalized message", e)
        }
    }


    
    AsyncFunction("resetInstagramState") { promise: Promise ->
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "트래커 인스턴스 없음 - 상태 리셋 실패"
                ))
                promise.resolve(false)
                return@AsyncFunction
            }
            
            tracker.resetInstagramState()
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "i",
                "tag" to TAG,
                "message" to "인스타그램 상태가 리셋되었습니다. 이제 인스타그램 진입 시 타이머가 시작됩니다."
            ))
            promise.resolve(true)

        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "e",
                "tag" to TAG,
                "message" to "인스타그램 상태 리셋 오류: ${e.message}"
            ))
            promise.reject("RESET_STATE_ERROR", "Failed to reset Instagram state", e)
        }
    }

    AsyncFunction("clearVLMResult") { docId: String, promise: Promise ->
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "트래커 인스턴스 없음 - VLM 결과 정리 실패"
                ))
                promise.resolve(false)
                return@AsyncFunction
            }
            
            tracker.clearVLMResult(docId)
            promise.resolve(true)

        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "e",
                "tag" to TAG,
                "message" to "VLM 결과 정리 오류: ${e.message}"
            ))
            promise.reject("CLEAR_VLM_ERROR", "Failed to clear VLM result", e)
        }
    }

    // VLM 결과 로컬 저장 관련 함수들
    AsyncFunction("getPendingVLMResults") { promise: Promise ->
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "트래커 인스턴스 없음 - 대기 VLM 결과 조회 실패"
                ))
                promise.resolve(emptyList<String>())
                return@AsyncFunction
            }
            
            val pendingFiles = tracker.getPendingVLMResults()
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "d",
                "tag" to TAG,
                "message" to "대기 VLM 결과 파일 ${pendingFiles.size}개 발견"
            ))
            promise.resolve(pendingFiles)

        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "e",
                "tag" to TAG,
                "message" to "대기 VLM 결과 조회 오류: ${e.message}"
            ))
            promise.reject("GET_PENDING_VLM_ERROR", "Failed to get pending VLM results", e)
        }
    }

    AsyncFunction("readVLMResult") { fileName: String, promise: Promise ->
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "트래커 인스턴스 없음 - VLM 결과 파일 읽기 실패"
                ))
                promise.resolve(null)
                return@AsyncFunction
            }
            
            val content = tracker.readVLMResult(fileName)
            if (content != null) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "d",
                    "tag" to TAG,
                    "message" to "VLM 결과 파일 읽기 성공: $fileName"
                ))
            } else {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "VLM 결과 파일 읽기 실패: $fileName"
                ))
            }
            promise.resolve(content)

        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "e",
                "tag" to TAG,
                "message" to "VLM 결과 파일 읽기 오류: ${e.message}"
            ))
            promise.reject("READ_VLM_ERROR", "Failed to read VLM result", e)
        }
    }

    AsyncFunction("deleteVLMResult") { fileName: String, promise: Promise ->
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker == null) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "트래커 인스턴스 없음 - VLM 결과 파일 삭제 실패"
                ))
                promise.resolve(false)
                return@AsyncFunction
            }
            
            val success = tracker.deleteVLMResult(fileName)
            if (success) {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "d",
                    "tag" to TAG,
                    "message" to "VLM 결과 파일 삭제 성공: $fileName"
                ))
            } else {
                sendEvent("onConsoleLog", mapOf<String, Any>(
                    "level" to "w",
                    "tag" to TAG,
                    "message" to "VLM 결과 파일 삭제 실패: $fileName"
                ))
            }
            promise.resolve(success)

        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "e",
                "tag" to TAG,
                "message" to "VLM 결과 파일 삭제 오류: ${e.message}"
            ))
            promise.reject("DELETE_VLM_ERROR", "Failed to delete VLM result", e)
        }
    }


        // 사용자 반응 저장 함수
    AsyncFunction("saveUserReaction") { reactionData: Map<String, Any>, promise: Promise ->
        try {
            val eventData = mapOf(
                "userAction" to (reactionData["userAction"] ?: "unknown"),
                "reactionType" to (reactionData["reactionType"] ?: "unknown"),
                "timestamp" to System.currentTimeMillis(),
                "context" to (reactionData["context"] ?: "unknown")
            )
            
            // React Native로 Firebase 저장 이벤트 발송
            sendEvent("onUserReactionSave", eventData)
            
            sendEvent("onConsoleLog", mapOf(
                "level" to "i",
                "tag" to TAG,
                "message" to "사용자 반응 저장 이벤트 발송: ${eventData["userAction"]}"
            ))
            
            promise.resolve(true)
        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf(
                "level" to "e",
                "tag" to TAG,
                "message" to "사용자 반응 저장 오류: ${e.message}"
            ))
            promise.resolve(false)
        }
    }

    // 오버레이 상호작용 저장 함수
    AsyncFunction("saveOverlayInteraction") { interactionData: Map<String, Any>, promise: Promise ->
        try {
            val eventData = mapOf(
                "action" to (interactionData["action"] ?: "unknown"),
                "interactionType" to "overlay_interaction",
                "timestamp" to System.currentTimeMillis(),
                "overlayContent" to (interactionData["message"] ?: ""),
                "sessionId" to "session_${System.currentTimeMillis()}"
            )
            
            // React Native로 Firebase 저장 이벤트 발송
            sendEvent("onOverlayInteractionSave", eventData)
            
            sendEvent("onConsoleLog", mapOf(
                "level" to "i",
                "tag" to TAG,
                "message" to "오버레이 상호작용 저장 이벤트 발송: ${eventData["action"]}"
            ))
            
            promise.resolve(true)
        } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf(
                "level" to "e",
                "tag" to TAG,
                "message" to "오버레이 상호작용 저장 오류: ${e.message}"
            ))
            promise.resolve(false)
        }
    }


    }
  
  // 클래스 레벨 private 함수들
  
  //  상태 확인 및 시작 로직을 분리한 6글자 이하 함수
  private fun chkAndStart(promise: Promise): Map<String, Any>? {
    try {
      // Step 1: 설정 확인
      val ctx = appContext.reactContext ?: return mapOf<String, Any>(
        "success" to false,
        "message" to "React context를 가져올 수 없습니다.",
        "status" to "NO_CONTEXT"
      )
      
      val setOk = chkSets(ctx)
      if (!setOk) {
        return mapOf<String, Any>(
          "success" to false,
          "message" to "접근성 서비스가 비활성화되어 있습니다.",
          "status" to "SET_OFF"
        )
      }

      // Step 2: 매니저 확인  
      val mgrOk = chkMgr(ctx)
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "상태 확인 - 설정: $setOk, 매니저: $mgrOk"
      ))

      // Step 3: 인스턴스 확인
      val instOk = chkInst()
      if (instOk) {
        // 즉시 사용 가능
        return setupSvc(promise)
      }

      // Step 4: 재시도 로직
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "w",
          "tag" to TAG,
          "message" to "서비스 준비 중... 재시도"
      ))

      retry(promise)
      return null // async 처리 중
      
    } catch (e: Exception) {
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "상태 확인 오류: ${e.message}"
      ))
      return mapOf<String, Any>(
        "success" to false,
        "message" to "상태 확인 중 오류 발생: ${e.message}",
        "status" to "ERROR"
      )
    }
  }

  //  설정 확인 
  private fun chkSets(ctx: Context): Boolean {
    return try {
      val mgr = ctx.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
      val list = mgr.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      
      // 디버깅을 위한 활성화된 서비스 목록 출력
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "📋 활성화된 접근성 서비스 개수: ${list.size}"
      ))
      
      list.forEach { service ->
        val serviceName = service.resolveInfo.serviceInfo.name
        val packageName = service.resolveInfo.serviceInfo.packageName
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "d",
            "tag" to TAG,
            "message" to "📋 서비스: $packageName/$serviceName"
        ))
      }
      
      // 메인 앱과 모듈의 패키지명이 다르므로 정확한 서비스 이름으로 확인
      val expectedServiceName = "expo.modules.mymodule.InstagramReelsTracker"
      val mainAppPackageName = ctx.packageName // com.yanghayeon.shocroll
      
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "찾는 서비스: $expectedServiceName (메인앱: $mainAppPackageName)"
      ))
      
      // 여러 방식으로 서비스 확인
      val found1 = list.any { it.resolveInfo.serviceInfo.name == expectedServiceName }
      val found2 = list.any { 
        it.resolveInfo.serviceInfo.name == expectedServiceName && 
        it.resolveInfo.serviceInfo.packageName == mainAppPackageName 
      }
      val found3 = list.any { 
        it.resolveInfo.serviceInfo.name.endsWith("InstagramReelsTracker") 
      }
      val found4 = list.any {
        it.resolveInfo.serviceInfo.packageName == mainAppPackageName &&
        it.resolveInfo.serviceInfo.name.contains("InstagramReelsTracker")
      }
      
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "매칭 결과 - 정확한이름: $found1, 패키지+이름: $found2, 끝단어: $found3, 메인앱패키지: $found4"
      ))
      
      val found = found1 || found2 || found3 || found4
      
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "Method1(설정): $found"
      ))
      
      found
    } catch (e: Exception) {
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "설정 확인 오류: ${e.message}"
      ))
      false
    }
  }

  //  매니저 확인 
  private fun chkMgr(ctx: Context): Boolean {
    return try {
      val mgr = ctx.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
      val enabled = mgr.isEnabled
      
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "Method2(매니저): $enabled"
      ))
      
      enabled
    } catch (e: Exception) {
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "매니저 확인 오류: ${e.message}"
      ))
      false
    }
  }

  //  인스턴스 확인   
  private fun chkInst(): Boolean {
    return try {
      val svc = InstagramReelsTracker.getInstance()
      val ready = InstagramReelsTracker.isServiceReady()
      val status = InstagramReelsTracker.getStatus()
      
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "d",
          "tag" to TAG,
          "message" to "인스턴스 상태 - 존재: ${svc != null}, 준비: $ready, 상태: $status"
      ))
      
      svc != null && ready
    } catch (e: Exception) {
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "인스턴스 확인 오류: ${e.message}"
      ))
      false
    }
  }

  //  재시도 로직 
  private fun retry(promise: Promise) {
    sendEvent("onConsoleLog", mapOf<String, Any>(
        "level" to "i",
        "tag" to TAG,
        "message" to "서비스 연결을 위해 5초 대기 중..."
    ))
    
    Handler(Looper.getMainLooper()).postDelayed({
      try {
        val svc = InstagramReelsTracker.getInstance()
        val ready = InstagramReelsTracker.isServiceReady()
        val status = InstagramReelsTracker.getStatus()
        
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "d",
            "tag" to TAG,
            "message" to "재시도 결과 - 인스턴스: ${svc != null}, 준비: $ready, 상태: $status"
        ))
        
        if (svc != null && ready) {
          val result = setupSvc(promise)
          promise.resolve(result)
        } else {
          // 최종 실패 시 상태 리셋 시도
          sendEvent("onConsoleLog", mapOf<String, Any>(
              "level" to "w",
              "tag" to TAG,
              "message" to "상태 리셋 후 재시도를 권장합니다."
          ))
          
          try {
            InstagramReelsTracker.resetStatus()
          } catch (e: Exception) {
            sendEvent("onConsoleLog", mapOf<String, Any>(
                "level" to "w",
                "tag" to TAG,
                "message" to "상태 리셋 실패: ${e.message}"
            ))
          }
          
          promise.resolve(mapOf<String, Any>(
              "success" to false,
              "message" to "접근성 서비스 연결 실패. 설정에서 서비스를 비활성화 후 다시 활성화해주세요.",
              "status" to status,
              "details" to "onServiceConnected가 호출되지 않았습니다. 기기를 재시작하거나 접근성 설정을 다시 확인해주세요."
          ))
        }
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "e",
            "tag" to TAG,
            "message" to "재시도 중 오류: ${e.message}"
        ))
        promise.resolve(mapOf<String, Any>(
            "success" to false,
            "message" to "재시도 중 오류 발생: ${e.message}",
            "status" to "RETRY_ERROR"
        ))
      }
    }, 5000) // 5초 대기
  }

  //  서비스 설정   
  private fun setupSvc(promise: Promise): Map<String, Any> {
    return try {
      val svc = InstagramReelsTracker.getInstance()
          ?: return mapOf<String, Any>(
              "success" to false,
              "message" to "서비스 인스턴스를 가져올 수 없습니다.",
              "status" to "NULL_SVC"
          )

      // 기존 리스너 제거 (에러 무시)
      try {
        svc.rmLstnr("reactNativeListener")
      } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf<String, Any>(
            "level" to "w",
            "tag" to TAG,
            "message" to "기존 리스너 제거 중 오류 (무시됨): ${e.message}"
        ))
      }
      
      // 새 리스너 추가
      svc.addLstnr("reactNativeListener") { eventData ->
          try {
              // JSONObject를 Map으로 변환하여 sendEvent에 전달
              val eventMap = mutableMapOf<String, Any>()
              val keys = eventData.keys()
              while (keys.hasNext()) {
                  val key = keys.next()
                  eventMap[key] = eventData.get(key)
              }


              // 이벤트 맵을 직접 전송 (문자열 변환 없이)
              safeSendEvent("onReelsTrackingUpdate", eventMap)

          } catch (e: Exception) {
              logMgr.log("e", TAG, "리스너 처리 오류: ${e.message}")
          }
      }
      
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "i",
          "tag" to TAG,
          "message" to "릴스 트래킹이 성공적으로 시작되었습니다"
      ))
      
      mapOf<String, Any>("success" to true, "message" to "릴스 트래킹 시작됨")
      
    } catch (e: Exception) {
      sendEvent("onConsoleLog", mapOf<String, Any>(
          "level" to "e",
          "tag" to TAG,
          "message" to "서비스 설정 중 오류: ${e.message}"
      ))
      mapOf<String, Any>(
          "success" to false,
          "message" to "서비스 설정 중 오류: ${e.message}",
          "status" to "SETUP_ERROR"
      )
    }
  }
  
  //  결과 로깅 
  private fun logChkRst(chkSet: Boolean, chkMgrResult: Boolean, chkInstResult: Boolean) {
    safeSendEvent("onConsoleLog", mapOf<String, Any>(
        "level" to "d",
        "tag" to TAG,
        "message" to "상태 확인 결과 - 설정: $chkSet, 매니저: $chkMgrResult, 인스턴스: $chkInstResult"
    ))
  }
  
  //  에러 로깅 
  private fun logErr(func: String, e: Exception) {
    safeSendEvent("onConsoleLog", mapOf<String, Any>(
        "level" to "e",
        "tag" to TAG,
        "message" to "$func 오류: ${e.message}"
    ))
  }

  // 앱을 포그라운드로 가져오는 함수
  private fun bringAppToForeground() {
    try {
        val context = appContext.reactContext ?: return
        
        // 메인 액티비티를 명시적으로 시작
        val packageManager = context.packageManager
        val launchIntent = packageManager.getLaunchIntentForPackage(context.packageName)
        
        if (launchIntent != null) {
            launchIntent.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_BROUGHT_TO_FRONT
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            
            context.startActivity(launchIntent)
            
            sendEvent("onConsoleLog", mapOf(
                "level" to "i",
                "tag" to TAG,
                "message" to "앱을 포그라운드로 가져오기 완료"
            ))
        } else {
            sendEvent("onConsoleLog", mapOf(
                "level" to "e",
                "tag" to TAG,
                "message" to "런치 인텐트를 찾을 수 없음"
            ))
        }
    } catch (e: Exception) {
        sendEvent("onConsoleLog", mapOf(
            "level" to "e",
            "tag" to TAG,
            "message" to "앱을 포그라운드로 가져오기 실패: ${e.message}"
        ))
    }
}

   /**
   * 개인화 메시지를 캐시에 저장하는 함수 (React Native에서 호출)
   * @param message 저장할 개인화 메시지
   */
  fun setPersonalizedMessage(message: String) {
    try {
      logMgr.log("i", TAG, "개인화 메시지 캐시 저장: ${message.take(50)}...")
      personalizedMessage = message
      messageTimestamp = System.currentTimeMillis()
      
      // 개인화 메시지 캐시 저장 완료
      
    } catch (e: Exception) {
      logMgr.log("e", TAG, "개인화 메시지 캐시 저장 오류: ${e.message}")
    }
  }
  





}