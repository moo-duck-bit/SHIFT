package expo.modules.mymodule

import android.content.Context
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.SetOptions
import java.text.SimpleDateFormat
import java.util.*

/**
 * Firebase Firestore 서비스
 * 릴스 시청 기록을 클라우드에 저장
 */
class FirebaseService private constructor() {
    companion object {
        private const val TAG = "FirebaseService"
        private var inst: FirebaseService? = null
        
        fun getInstance(): FirebaseService {
            if (inst == null) {
                inst = FirebaseService()
            }
            return inst!!
        }
    }
    
    private val db = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()
    private val log = LogManager.getInstance()
    
    /**
     * 현재 로그인된 사용자 ID 가져오기
     */
    fun getUserId(): String? {
        return try {
            auth.currentUser?.uid
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 ID 조회 오류: ${e.message}")
            null
        }
    }
    
    /**
     * 릴스 시청 기록을 Firestore에 저장
     * 구조: users > userId > instagram > 문서들
     */
    fun saveReelsRecord(
        startTime: Long,
        endTime: Long,
        duration: Double,
        description: String = "릴스",
        platform: String = "instagram"
    ) {
        try {
            log.log("d", TAG, "Firebase 저장 시도 시작...")
            
            val userId = getUserId()
            log.log("d", TAG, "사용자 ID: ${if (userId != null) "존재" else "null"}")
            
            if (userId == null) {
                log.log("w", TAG, "사용자가 로그인되지 않음 - 릴스 기록 저장 건너뜀")
                return
            }
            
            val data = hashMapOf(
                "startTime" to startTime,
                "endTime" to endTime,
                "duration" to duration,
                "description" to description,
                "platform" to platform,
                "timestamp" to FieldValue.serverTimestamp(),
                "date" to SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(startTime))
            )
            
            log.log("d", TAG, "데이터 준비 완료: ${data["date"]} (${duration}초)")
            
            // React Native에서 Firebase 저장을 처리하므로 Android에서는 비활성화
            log.log("i", TAG, "📝 릴스 기록 준비 완료 - React Native에서 Firebase 저장 처리됨")
            log.log("d", TAG, "저장될 데이터: ${data["date"]} (${duration}초, $platform)")
            
        } catch (e: Exception) {
            log.log("e", TAG, "SF(Short-form Video) 기록 저장 오류: ${e.message}")
            log.log("e", TAG, "오류 상세: ${e.javaClass.simpleName}")
        }
    }
    
    /**
     * 사용자 로그인 상태 확인
     */
    fun isUserLoggedIn(): Boolean {
        return try {
            auth.currentUser != null
        } catch (e: Exception) {
            log.log("e", TAG, "로그인 상태 확인 오류: ${e.message}")
            false
        }
    }
    
    /**
     * 사용자 로그아웃
     */
    fun signOut() {
        try {
            auth.signOut()
            log.log("i", TAG, "사용자 로그아웃 완료")
        } catch (e: Exception) {
            log.log("e", TAG, "로그아웃 오류: ${e.message}")
        }
    }
    
    /**
     * 사용자 반응을 Firestore에 저장
     * 구조: users > userId > reaction > 문서들
     */
    fun saveUserReaction(
        reelsCount: Int,
        message: String,
        userAction: String, // "confirm" or "cancel"
        reactionTime: Long = System.currentTimeMillis()
    ) {
        try {
            log.log("d", TAG, "사용자 반응 저장 시도...")
            
            val userId = getUserId()
            log.log("d", TAG, "사용자 ID: ${if (userId != null) "존재" else "null"}")
            
            if (userId == null) {
                log.log("w", TAG, "사용자가 로그인되지 않음 - 반응 기록 저장 건너뜀")
                return
            }
            
            val data = hashMapOf(
                "reelsCount" to reelsCount,
                "message" to message,
                "userAction" to userAction,
                "reactionTime" to reactionTime,
                "timestamp" to FieldValue.serverTimestamp(),
                "date" to SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(reactionTime)),
                "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(reactionTime)),
                "type" to "one_minute_notification" // 알림 타입
            )
            
            log.log("d", TAG, "반응 데이터 준비 완료: ${data["date"]} ${data["time"]} - 릴스 $reelsCount 개, 액션: $userAction")
            
            // 사용자 반응 저장: users > userId > reaction
            db.collection("users")
                .document(userId)
                .collection("reaction")
                .add(data)
                .addOnFailureListener { e ->
                    log.log("e", TAG, "사용자 반응 저장 실패: ${e.message}")
                    log.log("e", TAG, "실패 상세: ${e.javaClass.simpleName}")
                }
                
        } catch (e: Exception) {
            log.log("e", TAG, "사용자 반응 저장 오류: ${e.message}")
            log.log("e", TAG, "오류 상세: ${e.javaClass.simpleName}")
        }
    }

    /**
     * 계획 상호작용을 Firestore에 저장
     * 구조: users > userId > reaction > 문서들 (사용자 요구사항에 맞춤)
     */
    fun savePlanInteraction(
        action: String,
        planActivity: String,
        planTimeSlot: String,
        alternativeAction: String,
        sessionDuration: Int,
        reelsCount: Int,
        message: String = "계획 실천을 위한 개입",
        interactionTime: Long = System.currentTimeMillis()
    ) {
        try {
            log.log("d", TAG, "계획 상호작용 저장 시도...")
            
            val userId = getUserId()
            log.log("d", TAG, "사용자 ID: ${if (userId != null) "존재" else "null"}")
            
            if (userId == null) {
                log.log("w", TAG, "사용자가 로그인되지 않음 - 계획 상호작용 저장 건너뜀")
                return
            }
            
            // userAction 값 매핑
            val userAction = when (action) {
                "plan_executed" -> "plan"
                "dismissed" -> "close"
                "alternative_action" -> alternativeAction
                else -> action
            }
            
            val data = hashMapOf(
                "date" to SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(interactionTime)),
                "message" to message,
                "reactionTime" to com.google.firebase.Timestamp(Date(interactionTime)),
                "reelsCount" to reelsCount,
                "time" to SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(interactionTime)),
                "timestamp" to FieldValue.serverTimestamp(),
                "type" to "one_minute_notification",
                "userAction" to userAction
            )
            
            log.log("d", TAG, "계획 상호작용 데이터 준비 완료: ${data["date"]} ${data["time"]} - 액션: $userAction, 릴스: ${reelsCount}개")
            
            // reaction 컬렉션에 저장 (사용자 요구사항에 맞춤)
            db.collection("users")
                .document(userId)
                .collection("reaction")
                .add(data)
                .addOnFailureListener { e ->
                    log.log("e", TAG, "계획 상호작용 저장 실패: ${e.message}")
                    log.log("e", TAG, "실패 상세: ${e.javaClass.simpleName}")
                }
                
        } catch (e: Exception) {
            log.log("e", TAG, "계획 상호작용 저장 오류: ${e.message}")
            log.log("e", TAG, "오류 상세: ${e.javaClass.simpleName}")
        }
    }
    
    /**
     * 스크린샷 메타데이터를 Firestore에 저장
     */
    fun saveScreenshotMetadata(platform: String, docId: String, imageSize: Int, timestamp: Long) {
        try {
            val userId = getUserId() ?: run {
                log.log("w", TAG, "사용자 미로그인 - 스크린샷 메타데이터 저장 불가")
                return
            }
            
            val metadata = mapOf(
                "docId" to docId,
                "platform" to platform,
                "imageSize" to imageSize,
                "timestamp" to timestamp,
                "created_at" to FieldValue.serverTimestamp()
            )
            
            db.collection("users")
                .document(userId)
                .collection("screenshots")
                .document(docId)
                .set(metadata, SetOptions.merge())
                .addOnFailureListener { e ->
                    log.log("e", TAG, "스크린샷 메타데이터 저장 실패: ${e.message}")
                }
        } catch (e: Exception) {
            log.log("e", TAG, "스크린샷 메타데이터 저장 오류: ${e.message}")
        }
    }
    
    /**
     * VLM 결과를 포함한 릴스 기록 저장
     */
    fun saveReelsRecordWithVLM(
        startTime: Long,
        endTime: Long,
        duration: Double,
        vlmResult: Map<String, Any>?,
        description: String = "릴스",
        platform: String = "instagram"
    ) {
        try {
            val userId = getUserId()
            if (userId == null) {
                log.log("w", TAG, "사용자 미로그인 - VLM 포함 릴스 기록 저장 불가")
                return
            }
            
            val baseData = hashMapOf(
                "startTime" to startTime,
                "endTime" to endTime,
                "duration" to duration,
                "description" to description,
                "platform" to platform,
                "timestamp" to FieldValue.serverTimestamp(),
                "date" to SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date(startTime))
            )
            
            // VLM 결과가 있으면 추가
            if (vlmResult != null) {
                baseData["vlm_docId"] = vlmResult["docId"] as? String ?: ""
                baseData["category"] = vlmResult["category"] as? String ?: "unknown"
                baseData["analysis"] = vlmResult["analysis"] ?: mapOf<String, Any>()
                baseData["vlm_success"] = true
                baseData["vlm_updated_at"] = FieldValue.serverTimestamp()
            }
            
            db.collection("users")
                .document(userId)
                .collection("SF")
                .add(baseData)
                .addOnSuccessListener { documentReference ->
                    val category = vlmResult?.get("category") as? String ?: "no_vlm"
                    log.log("i", TAG, "✅ VLM 포함 SF 기록 Firebase 저장 완료 - DocID: ${documentReference.id}, 카테고리: $category")
                }
                .addOnFailureListener { e ->
                    log.log("e", TAG, "❌ VLM 포함 SF 기록 Firebase 저장 실패: ${e.message}")
                }
                
        } catch (e: Exception) {
            log.log("e", TAG, "VLM 포함 SF 기록 저장 오류: ${e.message}")
        }
    }
}
   