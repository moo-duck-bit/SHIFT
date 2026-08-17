package expo.modules.mymodule

import android.content.Context
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.util.TypedValue
import android.animation.Animator
import android.animation.ObjectAnimator
import android.animation.AnimatorSet
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.view.MotionEvent
import android.content.Intent
import android.provider.Settings
import android.os.PowerManager
import android.os.Build
import android.app.Activity
import android.app.Application
import android.os.Handler
import android.os.Looper
import expo.modules.mymodule.MyModule

/**
 * 계획 기반 릴스 개입 오버레이
 * 계획된 활동 시간에 숏폼 시청 시 나타나는 개입 시스템
 */
class ReelsOverlay(private val context: Context) {
    companion object {
        private const val TAG = "ReelsOverlay"
    }
    
    private val log = LogManager.getInstance()
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isShowing = false
    private var isAnimating = false
    
    // 사용자 반응 추적 변수
    private var overlayShowTime: Long = 0L
    private var userInteractionData: UserInteractionData? = null
    
    // 계획 데이터
    data class PlanData(
        val activity: String,
        val timeSlot: String,
        val alternativeAction: String
    )
    
    // 시청 기록 데이터 클래스 추가
    data class ViewingRecord(
        val docId: String,
        val category: String,
        val duration: Double,
        val startTime: Long,
        val endTime: Long,
        val platform: String,
        val analysis: Map<String, Any>? = null
    )
    
    // 수정된 세션 데이터 클래스
    data class SessionData(
        val sessionDuration: Int, // 분 단위
        val reelsCount: Int,
        val viewingRecords: List<ViewingRecord> = emptyList(),
        val longestViewedContent: ViewingRecord? = null,
        val categoryDurations: Map<String, Double> = emptyMap(),
        val personalizedMessage: String = ""
    )

    data class UserInteractionData(
    val timestamp: Long,
    val action: String, // "plan_executed", "alternative_action", "plan_modified", "dismissed"
    val message: String,
    val planData: PlanData,
    val sessionData: SessionData,
    val interactionDuration: Long = 0L // 오버레이가 떠있던 시간
    )

    
    
    
    // 콜백 인터페이스
    interface OnPlanInteractionListener {
      
        fun onAlternativeAction(planData: PlanData, sessionData: SessionData, action: String)
        fun onPlanModified(planData: PlanData, sessionData: SessionData)
        fun onDismissed(planData: PlanData, sessionData: SessionData)
        fun onPlanExecute(planData: PlanData, sessionData: SessionData)
    }
    
    // 사용자 반응 콜백 인터페이스
    interface OnUserReactionListener {
        fun onConfirm(reelsCount: Int, message: String)
        fun onCancel(reelsCount: Int, message: String)
    }
    
    private var interactionListener: OnPlanInteractionListener? = null
    private var userReactionListener: OnUserReactionListener? = null
    
    fun setOnPlanInteractionListener(listener: OnPlanInteractionListener) {
        this.interactionListener = listener
    }
    
    fun setOnUserReactionListener(listener: OnUserReactionListener) {
        this.userReactionListener = listener
    }
    
    /**
     * 단순한 오버레이 권한 체크
     */
    private fun hasOverlayPermission(): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val hasPermission = Settings.canDrawOverlays(context.applicationContext)
                log.log("d", TAG, "오버레이 권한 상태: $hasPermission")
                hasPermission
            } else {
                true
            }
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 권한 체크 오류: ${e.message}")
            false
        }
    }
    

    
    /**
     * Context 유효성 확인
     */
    private fun isContextValid(): Boolean {
        return try {
            if (context is Activity) {
                !context.isFinishing && !context.isDestroyed
            } else {
                true
            }
        } catch (e: Exception) {
            false
        }
    }
    
    /**
     * 사용자 반응 오버레이 표시
     */
    fun show(reelsCount: Int) {
        try {
            val message = "${reelsCount}개의 릴스를 시청했습니다. 계속 시청하시겠습니까?"
            userReactionListener?.onConfirm(reelsCount, message)
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 오버레이 표시 오류: ${e.message}")
        }
    }
    
    /**
     * 시청 분석 오버레이 표시
     */
    fun showAnalysisOverlay(planData: PlanData, sessionData: SessionData) {
        try {
            log.log("i", TAG, "오버레이 표시 요청 - 메시지: ${sessionData.personalizedMessage}")
            
            if (isShowing) {
                log.log("d", TAG, "오버레이가 이미 표시 중")
                return
            }

            if (isAnimating) {
                log.log("d", TAG, "오버레이 애니메이션 중")
                return
            }

            // 단순 권한 체크
            if (!hasOverlayPermission()) {
                log.log("e", TAG, "오버레이 권한이 없습니다")
                return
            }

            if (!isContextValid()) {
                log.log("e", TAG, "Context가 유효하지 않습니다")
                return
            }

            forceHide()
            windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            overlayView = createAnalysisOverlayView(planData, sessionData)
            val params = createWindowParams()

            windowManager?.addView(overlayView, params)
            isShowing = true
            
            // 오버레이 표시 시간 기록
            overlayShowTime = System.currentTimeMillis()
            
            animateShow()
            
            log.log("i", TAG, "오버레이 표시 성공 - 릴스 ${sessionData.reelsCount}개 분석 완료")
            
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 표시 실패: ${e.message}")
            resetState()
        }
    }

    /**
     * 계획 기반 오버레이 표시 - 개인화된 메시지와 함께
     */
    fun showPlanOverlay(planData: PlanData, sessionData: SessionData, personalizedMessage: String? = null) {
        try {
            // 중복 호출 방지 (강화)
            if (isShowing) {
                log.log("d", TAG, "오버레이가 이미 표시 중 - 중복 호출 방지")
                return
            }
            
            if (isAnimating) {
                log.log("d", TAG, "오버레이 애니메이션 중 - 중복 호출 방지")
                return
            }
            
            // 권한 확인
            if (!hasOverlayPermission()) {
                log.log("e", TAG, "오버레이 권한이 없습니다")
                return
            }
            
            // Context 유효성 확인
            if (!isContextValid()) {
                log.log("e", TAG, "Context가 유효하지 않습니다")
                return
            }
            
            // 기존 오버레이 정리 (강화)
            forceHide()
            
            // 윈도우 매니저 초기화
            windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
            
            // 오버레이 뷰 생성 (개인화된 메시지 또는 기본 메시지로 시작)
            overlayView = createPlanOverlayView(planData, sessionData, personalizedMessage)
            
            // 윈도우 파라미터 설정
            val params = createWindowParams()
            
            // 오버레이 표시
            windowManager?.addView(overlayView, params)
            
            // 상태 설정 (먼저 설정하여 중복 방지)
            isShowing = true
            
            // 오버레이 표시 시간 기록
            overlayShowTime = System.currentTimeMillis()
            
            // 애니메이션으로 등장
            animateShow()
            
            log.log("i", TAG, "오버레이 표시 완료 - 활동: ${planData.activity}, 개인화 메시지: ${personalizedMessage?.take(30) ?: "기본 메시지"}...")
            
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 표시 오류: ${e.message}")
            resetState()
        }
    }


    
    /**
     * 오버레이 숨기기 - 애니메이션과 함께
     */
    fun hide() {
        try {
            if (!isShowing) {
                log.log("d", TAG, "오버레이가 이미 숨겨져 있음")
                return
            }
            
            if (isAnimating) {
                log.log("d", TAG, "애니메이션 중이므로 대기")
                return
            }
            
            animateHide {
                forceHide()
            }
            
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 숨기기 오류: ${e.message}")
            forceHide()
        }
    }
    
    /**
     * 강제 숨기기 - 즉시 정리
     */
    private fun forceHide() {
        try {
            // 애니메이션 중단
            overlayView?.clearAnimation()
            
            // 윈도우에서 뷰 제거
            if (overlayView != null && windowManager != null) {
                try {
                    windowManager?.removeView(overlayView)
                    log.log("d", TAG, "오버레이 뷰 제거 완료")
                } catch (e: Exception) {
                    log.log("w", TAG, "오버레이 뷰 제거 중 오류 (무시됨): ${e.message}")
                }
            }
            
            // 상태 초기화
            resetState()
            
        } catch (e: Exception) {
            log.log("e", TAG, "강제 숨기기 오류: ${e.message}")
            resetState()
        }
    }
    
    /**
     * 상태 초기화
     */
    private fun resetState() {
        isShowing = false
        isAnimating = false
        overlayView = null
        windowManager = null
    }
    
    /**
     * 리소스 정리 (명시적 정리용)
     */
    fun cleanup() {
        try {
            forceHide()
            interactionListener = null
            userReactionListener = null
            log.log("d", TAG, "오버레이 리소스 정리 완료")
        } catch (e: Exception) {
            log.log("e", TAG, "오버레이 리소스 정리 오류: ${e.message}")
        }
    }
    
    /**
     * 시청 분석 기반 오버레이 뷰 생성
     */
    private fun createAnalysisOverlayView(planData: PlanData, sessionData: SessionData): View {
        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#CC000000"))
            setPadding(dpToPx(20), dpToPx(40), dpToPx(20), dpToPx(40))
        }
        
        val cardView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dpToPx(24), dpToPx(28), dpToPx(24), dpToPx(28))
            background = createCardBackground()
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(dpToPx(16), dpToPx(40), dpToPx(16), dpToPx(40))
            }
        }
        
       
        val closeButton = createCloseButton {
            saveUserInteraction("dismissed", planData, sessionData)
            interactionListener?.onDismissed(planData, sessionData)
            hide()
        }
        
        val topContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        topContainer.addView(closeButton)
        
        // 아이콘 제거 (이모지 미사용)
        
        // 카테고리 기반 메시지
        val categoryMessageText = TextView(context).apply {
            text = if (sessionData.personalizedMessage.isNotEmpty()) {
                sessionData.personalizedMessage
            } else {
                "Wait! What was I trying to do?\n\nYou've watched ${sessionData.reelsCount} short-form items.\nYou planned to do ${planData.activity}."
            }
            textSize = 16f
            setTextColor(Color.parseColor("#1a1a1a"))
            gravity = Gravity.CENTER
            lineHeight = dpToPx(24).toInt()
            setPadding(dpToPx(16), dpToPx(12), dpToPx(16), dpToPx(12))
            setTypeface(null, Typeface.NORMAL)
        }
        
        // 가장 오래 시청한 콘텐츠 정보
        val longestContentView = createLongestContentView(sessionData.longestViewedContent)
        
        // 카테고리별 시청 시간 그래프
        val categoryGraphView = createCategoryGraphView(sessionData.categoryDurations)
        
        // 버튼 컨테이너
        val buttonContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dpToPx(24), 0, 0)
        }
        
        // 계획 실행 버튼
        val execButton = createStyledButton("Execute plan", true) {
            saveUserInteraction("plan_executed", planData, sessionData)
            interactionListener?.onPlanExecute(planData, sessionData)
            hide()
        }

        // 대체 활동 버튼
        val alternativeButton = createStyledButton("${planData.alternativeAction}", false) {
            saveUserInteraction("alternative_action", planData, sessionData)
            performAlternativeAction(planData.alternativeAction)
            interactionListener?.onAlternativeAction(planData, sessionData, planData.alternativeAction)
            hide()
        }
        
        val buttonMargin = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, dpToPx(8), 0, 0)
        }
        
        buttonContainer.addView(execButton)
        buttonContainer.addView(alternativeButton, buttonMargin)
        
        // 카드에 요소 추가
        cardView.addView(topContainer)
        
        cardView.addView(categoryMessageText, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, dpToPx(12), 0, dpToPx(8))
        })
        
        cardView.addView(longestContentView, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, dpToPx(8), 0, dpToPx(8))
        })
        
        cardView.addView(categoryGraphView, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, dpToPx(8), 0, dpToPx(16))
        })
        
        cardView.addView(buttonContainer)
        
        container.addView(cardView)
        return container
    }

    /**
     * 가장 오래 시청한 콘텐츠 뷰 생성
     */
/**
 * 가장 오래 시청한 콘텐츠 뷰 생성 - 개선됨
 */
private fun createLongestContentView(longestContent: ViewingRecord?): View {
    val container = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL // 가운데 정렬 강화
        setPadding(dpToPx(16), dpToPx(12), dpToPx(16), dpToPx(12))
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(12).toFloat()
            setColor(Color.parseColor("#F3F4F6"))
        }
    }

    val titleText = TextView(context).apply {
        text = "Most Viewed Content"
        textSize = 14f
        setTextColor(Color.parseColor("#374151"))
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
    }

    val contentText = TextView(context).apply {
        text = if (longestContent != null) {
            val duration = longestContent.duration.toInt()
            val categoryKorean = CategoryMapper.getCategoryKoreanName(longestContent.category)
            val platformKorean = when (longestContent.platform) {
                "instagram" -> "Instagram"
                "youtube" -> "YouTube"
                else -> longestContent.platform
            }

            val analysisText = longestContent.analysis?.let { analysis ->
                val title = analysis["title"] as? String
                val description = analysis["description"] as? String
                when {
                    title != null -> "\n\"$title\""
                    description != null -> "\n\"${description.take(30)}...\""
                    else -> ""
                }
            } ?: ""
            
            platformKorean + " " + categoryKorean + " content\n"  + analysisText
        } else {
            "No viewing data"
        }
        textSize = 12f
        setTextColor(Color.parseColor("#6B7280"))
        gravity = Gravity.CENTER
        lineHeight = dpToPx(16).toInt()
    }

    container.addView(titleText)
    container.addView(contentText, LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    ).apply {
        setMargins(0, dpToPx(6), 0, 0)
        gravity = Gravity.CENTER_HORIZONTAL
    })
    
    return container
}

    /**
    * 카테고리 한국어 변환
    */
    private fun getCategoryKoreanName(category: String): String {
        // Map Korean to English for display
        return CategoryMapper.getCategoryKoreanName(category)
            .replace("게임", "Gaming")
            .replace("애니메이션", "Animation")
            .replace("자동차/차량", "Autos & Vehicles")
            .replace("힙합", "Hip-Hop")
            .replace("동물/펫", "Pets & Animals")
            .replace("스포츠", "Sports")
            .replace("여행/이벤트", "Travel & Events")
            .replace("일상/블로그", "V-logs")
            .replace("코미디", "Comedy")
            .replace("영화", "Movie")
            .replace("뉴스/정치", "News & Politics")
            .replace("꿀팁", "How-to & Style")
            .replace("교육", "Education")
            .replace("과학/기술", "Science & Technology")
            .replace("쇼핑", "Shopping")
            .replace("음식/요리", "Food & Drink")
            .replace("K-POP", "K-POP")
            .replace("라이프스타일", "Lifestyle")
            .replace("드라마", "Drama")
            .replace("예능", "Variety show")
            .replace("숏폼 챌린지", "Short-form Challenge")
            .replace("밈", "MEME")
    }

    /**
     * 카테고리별 시청 시간 그래프 뷰 생성
     */
    private fun createCategoryGraphView(categoryDurations: Map<String, Double>): View {
    val container = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dpToPx(16), dpToPx(12), dpToPx(16), dpToPx(12))
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(12).toFloat()
            setColor(Color.parseColor("#F9FAFB"))
        }
    }

    val titleText = TextView(context).apply {
        text = "Top categories"
        textSize = 14f
        setTextColor(Color.parseColor("#374151"))
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
    }

    container.addView(titleText)

    if (categoryDurations.isNotEmpty()) {
        // 카테고리별 개수 계산 (SessionData의 viewingRecords 사용)
        val tracker = InstagramReelsTracker.getInstance()
        val categoryCount = mutableMapOf<String, Int>()
        
        tracker?.let {
            try {
                // 현재 세션의 시청 기록에서 카테고리별 개수 계산
                val sessionRecordsField = it.javaClass.getDeclaredField("sessionViewingRecords")
                sessionRecordsField.isAccessible = true
                val sessionRecords = sessionRecordsField.get(it) as? List<*>
                
                sessionRecords?.forEach { record ->
                    try {
                        val categoryField = record?.javaClass?.getDeclaredField("category")
                        categoryField?.isAccessible = true
                        val category = categoryField?.get(record) as? String ?: "unknown"
                        val koreanCategory = CategoryMapper.getCategoryKoreanName(category)
                        categoryCount[koreanCategory] = (categoryCount[koreanCategory] ?: 0) + 1
                    } catch (e: Exception) {
                        // 개별 레코드 처리 실패는 무시
                    }
                }
            } catch (e: Exception) {
                log.log("e", TAG, "세션 기록 접근 실패: ${e.message}")
            }
        }

        val totalCount = categoryCount.values.sum()
        if (totalCount > 0) {
            categoryCount.entries.sortedByDescending { it.value }.take(3).forEach { (category, count) ->
                val percentage = ((count.toDouble() / totalCount) * 100).toInt()
                val categoryRow = createCategoryCountRow(category, count, percentage)
                container.addView(categoryRow, LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(0, dpToPx(6), 0, 0)
                })
            }
        } else {
            val noDataText = TextView(context).apply {
                text = "No data to analyze"
                textSize = 12f
                setTextColor(Color.parseColor("#9CA3AF"))
                gravity = Gravity.CENTER
            }
            container.addView(noDataText)
        }
    } else {
        val noDataText = TextView(context).apply {
            text = "No data to analyze"
            textSize = 12f
            setTextColor(Color.parseColor("#9CA3AF"))
            gravity = Gravity.CENTER
        }
        container.addView(noDataText)
    }

    return container
}

    private fun createCategoryCountRow(category: String, count: Int, percentage: Int): View {
        val rowContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val categoryText = TextView(context).apply {
            text = category
            textSize = 11f
            setTextColor(Color.parseColor("#4B5563"))
            layoutParams = LinearLayout.LayoutParams(dpToPx(80), ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val progressContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        val progressBar = View(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(4).toFloat()
                setColor(getCategoryColor(category))
            }
            layoutParams = LinearLayout.LayoutParams(
                (dpToPx(100) * percentage / 100).coerceAtLeast(dpToPx(8)),
                dpToPx(8)
            )
        }

        val countText = TextView(context).apply {
            text = "${count}"
            textSize = 10f
            setTextColor(Color.parseColor("#6B7280"))
            setPadding(dpToPx(8), 0, 0, 0)
        }

        progressContainer.addView(progressBar)
        progressContainer.addView(countText)
        rowContainer.addView(categoryText)
        rowContainer.addView(progressContainer)
        
        return rowContainer
    }

    /**
     * 카테고리 행 생성
     */
    private fun createCategoryRow(category: String, seconds: Int, percentage: Int): View {
        val rowContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        
        val categoryText = TextView(context).apply {
            text = category
            textSize = 11f
            setTextColor(Color.parseColor("#4B5563"))
            layoutParams = LinearLayout.LayoutParams(dpToPx(80), ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        
        val progressContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        
        val progressBar = View(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dpToPx(4).toFloat()
                setColor(getCategoryColor(category))
            }
            layoutParams = LinearLayout.LayoutParams(
                (dpToPx(100) * percentage / 100).coerceAtLeast(dpToPx(8)), 
                dpToPx(8)
            )
        }
        
        val timeText = TextView(context).apply {
            text = "${seconds}s"
            textSize = 10f
            setTextColor(Color.parseColor("#6B7280"))
            setPadding(dpToPx(8), 0, 0, 0)
        }
        
        progressContainer.addView(progressBar)
        progressContainer.addView(timeText)
        
        rowContainer.addView(categoryText)
        rowContainer.addView(progressContainer)
        
        return rowContainer
    }
    
    /**
     * 카테고리별 색상 반환
     */
    private fun getCategoryColor(category: String): Int {
        return when (category) {
            "게임" -> Color.parseColor("#EF4444")
            "애니메이션" -> Color.parseColor("#7C3AED")
            "자동차/차량" -> Color.parseColor("#D97706")
            "힙합" -> Color.parseColor("#8B5CF6")
            "동물/펫" -> Color.parseColor("#F59E0B")
            "스포츠" -> Color.parseColor("#3B82F6")
            "여행/이벤트" -> Color.parseColor("#0EA5E9")
            "일상/블로그" -> Color.parseColor("#EC4899")
            "코미디" -> Color.parseColor("#EAB308")
            "영화" -> Color.parseColor("#7C3AED")
            "뉴스/정치" -> Color.parseColor("#DC2626")
            "꿀팁" -> Color.parseColor("#06B6D4")
            "교육" -> Color.parseColor("#10B981")
            "과학/기술" -> Color.parseColor("#059669")
            "쇼핑" -> Color.parseColor("#DB2777")
            "음식/요리" -> Color.parseColor("#F97316")
            "K-POP" -> Color.parseColor("#8B5CF6")
            "라이프스타일" -> Color.parseColor("#06B6D4")
            "드라마" -> Color.parseColor("#7C3AED")
            "예능" -> Color.parseColor("#F59E0B")
            "숏폼 챌린지" -> Color.parseColor("#EAB308")
            "밈" -> Color.parseColor("#EAB308")
            else -> Color.parseColor("#6B7280")
        }
    }


    /**
     * 계획 기반 오버레이 뷰 생성
     */
    private fun createPlanOverlayView(planData: PlanData, sessionData: SessionData, personalizedMessage: String? = null): View {
        val container = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#CC000000"))
            setPadding(dpToPx(20), dpToPx(40), dpToPx(20), dpToPx(40))
        }
        
        // 메인 카드 뷰
        val cardView = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dpToPx(24), dpToPx(28), dpToPx(24), dpToPx(28))
            background = createCardBackground()
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(dpToPx(16), dpToPx(40), dpToPx(16), dpToPx(40))
            }
        }
        
        // X 버튼 (우상단)
        val closeButton = createCloseButton {
            saveUserInteraction("dismissed", planData, sessionData)
            interactionListener?.onDismissed(planData, sessionData)
            hide()
        }
        
        // 상단 컨테이너 (X 버튼 포함)
        val topContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.END
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        topContainer.addView(closeButton)
        
        // 아이콘 제거 (이모지 미사용)
        
        /* 통합된 개인화 메시지 영역 (중복 제거) */
        val personalizedMessageText = TextView(context).apply {
            text = personalizedMessage ?: "잠깐! 내가 뭐하려 했지?"
            textSize = 16f
            setTextColor(Color.parseColor("#1a1a1a"))
            gravity = Gravity.CENTER
            lineHeight = dpToPx(24).toInt()
            setPadding(dpToPx(16), dpToPx(12), dpToPx(16), dpToPx(12))
            setTypeface(null, android.graphics.Typeface.NORMAL)
        }

        // 버튼 컨테이너 (세로 배치로 변경)
        val buttonContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dpToPx(24), 0, 0)
        }
        
       
        val alternativeButton = createStyledButton("🏠 ${planData.alternativeAction}", false) {
            saveUserInteraction("alternative_action", planData, sessionData)
            performAlternativeAction(planData.alternativeAction)
            interactionListener?.onAlternativeAction(planData, sessionData, planData.alternativeAction)
            hide()
        }
        
        // 계획 수정하기 버튼
        val modifyButton = createStyledButton("Edit plan", false) {
            saveUserInteraction("plan_modified", planData, sessionData)
            interactionListener?.onPlanModified(planData, sessionData)
            hide()
        }
        
        // 버튼 간격 설정 (세로 배치용)
        val buttonMargin = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, dpToPx(8), 0, 0)
        }
        
        buttonContainer.addView(alternativeButton)
        buttonContainer.addView(modifyButton, buttonMargin)
        
        // 카드에 요소 추가 (중복 제거)
        cardView.addView(topContainer)
        cardView.addView(personalizedMessageText, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            setMargins(0, dpToPx(12), 0, dpToPx(8))
        })
        cardView.addView(buttonContainer)
        
        container.addView(cardView)
        return container
    }
    
    
    /**
     * X 버튼 생성
     */
    private fun createCloseButton(onClick: () -> Unit): Button {
        return Button(context).apply {
            text = "✕"
            textSize = 18f
            setTextColor(Color.parseColor("#6B7280"))
            background = createCloseButtonBackground()
            setPadding(dpToPx(8), dpToPx(8), dpToPx(8), dpToPx(8))
            minWidth = dpToPx(32)
            minHeight = dpToPx(32)
            setOnClickListener { onClick() }
        }
    }
    
    /**
     * 꿀팁된 버튼 생성
     */
    private fun createStyledButton(text: String, isPrimary: Boolean, onClick: () -> Unit): Button {
        return Button(context).apply {
            this.text = text
            textSize = if (isPrimary) 16f else 14f
            typeface = if (isPrimary) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            minWidth = dpToPx(200)
            minHeight = dpToPx(48)
            setPadding(dpToPx(24), dpToPx(14), dpToPx(24), dpToPx(14))
            
            applyButtonStyle(isPrimary)
            setupButtonAnimation()
            setOnClickListener { 
                performButtonClickAnimation()
                onClick() 
            }
        }
    }
    
    private fun Button.applyButtonStyle(isPrimary: Boolean) {
        if (isPrimary) {
            setTextColor(Color.WHITE)
            background = createPrimaryButtonBackground()
            elevation = dpToPx(2).toFloat()
        } else {
            setTextColor(Color.parseColor("#374151"))
            background = createSecondaryButtonBackground()
            elevation = dpToPx(1).toFloat()
        }
    }

    /**
     * 버튼 호버 애니메이션 설정
     */
    private fun Button.setupButtonAnimation() {
        setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    ObjectAnimator.ofFloat(view, "scaleX", 1.0f, 0.95f).apply {
                        duration = 100
                        start()
                    }
                    ObjectAnimator.ofFloat(view, "scaleY", 1.0f, 0.95f).apply {
                        duration = 100
                        start()
                    }
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    ObjectAnimator.ofFloat(view, "scaleX", 0.95f, 1.0f).apply {
                        duration = 100
                        interpolator = OvershootInterpolator()
                        start()
                    }
                    ObjectAnimator.ofFloat(view, "scaleY", 0.95f, 1.0f).apply {
                        duration = 100
                        interpolator = OvershootInterpolator()
                        start()
                    }
                }
            }
            false
        }
    }
    
    private fun Button.performButtonClickAnimation() {
        val rippleEffect = ObjectAnimator.ofFloat(this, "alpha", 1.0f, 0.7f, 1.0f)
        rippleEffect.duration = 200
        rippleEffect.start()
    }
    
    /**
     * 대체 활동 수행 - 안전성 및 오류 처리 강화
     */
    private fun performAlternativeAction(action: String) {
        try {
            log.log("i", TAG, "대체 활동 시작: $action")
            
            when (action) {
                "Turn off display" -> {
                    performScreenOff()
                }
                "Home button" -> {
                    performGoHome()
                }
                "Go back" -> {
                    performGoBack()
                }
            }
            
            log.log("i", TAG, "대체 활동 완료: $action")
            
        } catch (e: Exception) {
            log.log("e", TAG, "대체 활동 수행 오류 ($action): ${e.message}")
            try {
                performGoHome()
            } catch (fallbackError: Exception) {
                log.log("e", TAG, "기본 동작도 실패: ${fallbackError.message}")
            }
        }
    }
    
    /**
     * 화면 끄기 시도 - AccessibilityService를 통한 개선된 구현
     */
    private fun performScreenOff() {
        try {
            // InstagramReelsTracker 인스턴스를 통해 화면 끄기 시도
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker != null && InstagramReelsTracker.isServiceReady()) {
                val success = tracker.turnOffScreen()
                if (success) {
                    log.log("i", TAG, "AccessibilityService를 통한 화면 끄기 성공")
                } else {
                    log.log("e", TAG, "AccessibilityService를 통한 화면 끄기 실패")
                    fallbackScreenOff()
                }
            } else {
                log.log("w", TAG, "AccessibilityService가 준비되지 않음, 대체 방법 사용")
                fallbackScreenOff()
            }
        } catch (e: Exception) {
            log.log("e", TAG, "화면 끄기 실패: ${e.message}")
            fallbackScreenOff()
        }
    }
    
    /**
     * 대체 화면 끄기 방법
     */
    private fun fallbackScreenOff() {
        try {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                // API 레벨 31 이상에서는 PowerManager.goToSleep() 사용
                try {
                    val goToSleepMethod = powerManager.javaClass.getMethod("goToSleep", Long::class.java)
                    goToSleepMethod.invoke(powerManager, System.currentTimeMillis())
                    log.log("i", TAG, "대체 방법으로 화면 끄기 성공")
                } catch (e: Exception) {
                    log.log("e", TAG, "대체 방법으로 화면 끄기 실패: ${e.message}")
                }
            } else {
                // API 레벨 30 이하에서는 홈 화면으로 이동
                performGoHome()
                log.log("i", TAG, "홈 화면으로 이동하여 화면 끄기 대체")
            }
        } catch (e: Exception) {
            log.log("e", TAG, "대체 화면 끄기 실패: ${e.message}")
        }
    }
    
    /**
     * 홈 화면으로 이동
     */
    private fun performGoHome() {
        try {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            
            if (intent.resolveActivity(context.packageManager) != null) {
                context.startActivity(intent)
                log.log("i", TAG, "홈 화면으로 이동 완료")
            } else {
                log.log("e", TAG, "홈 화면 인텐트를 실행할 수 없습니다")
            }
            
        } catch (e: Exception) {
            log.log("e", TAG, "홈 화면 이동 실패: ${e.message}")
            throw e
        }
    }
    
    /**
     * 시스템 Go back 기능
     */
    private fun performGoBack() {
        try {
            val tracker = InstagramReelsTracker.getInstance()
            if (tracker != null && InstagramReelsTracker.isServiceReady()) {
                val success = tracker.performBackAction()
                if (success) {
                    log.log("i", TAG, "시스템 Go back 완료")
                } else {
                    log.log("e", TAG, "시스템 Go back 실패")
                }
            } else {
                log.log("e", TAG, "AccessibilityService가 준비되지 않음")
            }
        } catch (e: Exception) {
            log.log("e", TAG, "Go back 실패: ${e.message}")
            throw e
        }
    }

    /**
     * 카드 배경 생성 - 현대적 그림자와 라운드 효과
     */
    private fun createCardBackground(): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(20).toFloat()
            setColor(Color.parseColor("#FFFFFF"))
            setStroke(dpToPx(1), Color.parseColor("#E5E7EB"))
        }
    }

    /**
     * 닫기 버튼 배경 생성
     */
    private fun createCloseButtonBackground(): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#F9FAFB"))
            setStroke(dpToPx(1), Color.parseColor("#E5E7EB"))
        }
    }

    /**
     * 기본 버튼 배경 생성
     */
    private fun createPrimaryButtonBackground(): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(16).toFloat()
            colors = intArrayOf(
                Color.parseColor("#6366F1"),
                Color.parseColor("#4F46E5")
            )
            gradientType = GradientDrawable.LINEAR_GRADIENT
            orientation = GradientDrawable.Orientation.TOP_BOTTOM
        }
    }

    /**
     * 보조 버튼 배경 생성
     */
    private fun createSecondaryButtonBackground(): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(16).toFloat()
            setColor(Color.parseColor("#F9FAFB"))
            setStroke(dpToPx(1), Color.parseColor("#D1D5DB"))
        }
    }

    /**
     * 윈도우 파라미터 생성
     */
    private fun createWindowParams(): WindowManager.LayoutParams {
        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }
    }
    
    /**
     * 등장 애니메이션 - 부드러운 스프링 효과
     */
    private fun animateShow() {
        overlayView?.let { view ->
            isAnimating = true
            view.alpha = 0f
            view.scaleX = 0.3f
            view.scaleY = 0.3f
            view.translationY = dpToPx(50).toFloat()
            
            val fadeIn = ObjectAnimator.ofFloat(view, "alpha", 0f, 1f)
            val scaleXAnimator = ObjectAnimator.ofFloat(view, "scaleX", 0.3f, 1.05f, 1f)
            val scaleYAnimator = ObjectAnimator.ofFloat(view, "scaleY", 0.3f, 1.05f, 1f)
            val translateAnimator = ObjectAnimator.ofFloat(view, "translationY", dpToPx(50).toFloat(), 0f)
            
            AnimatorSet().apply {
                playTogether(fadeIn, scaleXAnimator, scaleYAnimator, translateAnimator)
                duration = 500
                interpolator = DecelerateInterpolator(1.5f)
                addListener(object : Animator.AnimatorListener {
                    override fun onAnimationEnd(animation: Animator) {
                        isAnimating = false
                    }
                    override fun onAnimationStart(animation: Animator) {}
                    override fun onAnimationCancel(animation: Animator) {
                        isAnimating = false
                    }
                    override fun onAnimationRepeat(animation: Animator) {}
                })
                start()
            }
        }
    }

    /**
     * 사라지는 애니메이션 - 자연스러운 축소 효과
     */
    private fun animateHide(onComplete: () -> Unit) {
        overlayView?.let { view ->
            isAnimating = true
            val fadeOut = ObjectAnimator.ofFloat(view, "alpha", 1f, 0f)
            val scaleXAnimator = ObjectAnimator.ofFloat(view, "scaleX", 1f, 0.3f)
            val scaleYAnimator = ObjectAnimator.ofFloat(view, "scaleY", 1f, 0.3f)
            val translateAnimator = ObjectAnimator.ofFloat(view, "translationY", 0f, -dpToPx(30).toFloat())
            
            AnimatorSet().apply {
                playTogether(fadeOut, scaleXAnimator, scaleYAnimator, translateAnimator)
                duration = 300
                interpolator = DecelerateInterpolator()
                addListener(object : Animator.AnimatorListener {
                    override fun onAnimationEnd(animation: Animator) {
                        isAnimating = false
                        onComplete()
                    }
                    override fun onAnimationStart(animation: Animator) {}
                    override fun onAnimationCancel(animation: Animator) {
                        isAnimating = false
                        onComplete()
                    }
                    override fun onAnimationRepeat(animation: Animator) {}
                })
                start()
            }
        } ?: run {
            isAnimating = false
            onComplete()
        }
    }
    
    /**
     * dp를 px로 변환
     */
    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
    
    /**
     * 사용자 반응 저장 함수 - VLM 저장 방식과 동일한 패턴 적용
     */
    private fun saveUserInteraction(action: String, planData: PlanData, sessionData: SessionData) {
        try {
            val currentTime = System.currentTimeMillis()
            val interactionDuration = if (overlayShowTime > 0) {
                currentTime - overlayShowTime
            } else 0L

            // 기존 로컬 저장
            val interactionData = mapOf(
                "action" to action,
                "message" to sessionData.personalizedMessage,
                "timestamp" to currentTime,
                "interactionDuration" to interactionDuration,
                "planData" to mapOf(
                    "activity" to planData.activity,
                    "timeSlot" to planData.timeSlot,
                    "alternativeAction" to planData.alternativeAction
                ),
                "sessionData" to mapOf(
                    "sessionDuration" to sessionData.sessionDuration,
                    "reelsCount" to sessionData.reelsCount,
                    "categoryDurations" to sessionData.categoryDurations
                )
            )

            val tracker = InstagramReelsTracker.getInstance()
            tracker?.let {
                it.saveUserInteractionToLocal(interactionData)
            }

            // Firebase 개입 메시지 저장을 위한 추가 이벤트 발송
            if (sessionData.personalizedMessage.isNotEmpty()) {
                val requestId = "${currentTime}_${java.util.UUID.randomUUID().toString().substring(0, 8)}"
                val guidanceData = mapOf(
                    "requestId" to requestId,
                    "userId" to "",
                    "triggerContext" to "overlay_interaction",
                    "timestamp" to currentTime,
                    "success" to true,
                    "guidanceText" to sessionData.personalizedMessage,
                    "personalizedMessage" to sessionData.personalizedMessage,
                    "processingTime" to interactionDuration,
                    "retryCount" to 0,
                    "userAction" to action
                )
                
                try {
                    val myModule = expo.modules.mymodule.MyModule.getInstance()
                    myModule?.let { module ->
                        val sendEventMethod = module.javaClass.getDeclaredMethod("safeSendEvent", String::class.java, Map::class.java)
                        sendEventMethod.isAccessible = true
                        sendEventMethod.invoke(module, "onGuidanceResultSave", guidanceData)
                        
                        log.log("i", TAG, "개입 메시지 Firebase 저장 이벤트 발송: ${sessionData.personalizedMessage.substring(0, minOf(50, sessionData.personalizedMessage.length))}")
                    }
                } catch (e: Exception) {
                    log.log("e", TAG, "개입 메시지 저장 이벤트 발송 오류??????????????: ${e.message}")
                }
            }

            log.log("i", TAG, "사용자 반응 저장 완료: $action")
            
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 저장 오류: ${e.message}")
        }
    }


    /**
     * 현재 표시 중인지 확인
     */
    fun isShowing(): Boolean = isShowing
    

    

} 