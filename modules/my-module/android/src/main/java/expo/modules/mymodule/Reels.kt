package expo.modules.mymodule

import android.app.ActivityManager
import android.content.Context
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import expo.modules.mymodule.Constants
import expo.modules.mymodule.LogManager

/**
 * 단순화된 릴스 헬퍼 클래스
 */
object Reels {

    /**
     * 앱 포그라운드 확인
     */
    fun isFG(ctx: Context, pkg: String, log: LogManager, tag: String): Boolean {
        return try {
            val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val tasks = am.getRunningTasks(1)
            
            if (tasks.isNotEmpty()) {
                val top = tasks[0].topActivity
                top?.packageName == pkg
            } else false
            
        } catch (e: Exception) {
            log.log("e", tag, "포그라운드 확인 오류: ${e.message}")
            false
        }
    }

    /**
     * 릴스 캡션 추출
     */
    fun getCapt(node: AccessibilityNodeInfo?): String {
        if (node == null) return "릴스"
        
        return try {
            // 콘텐츠 설명 우선
            node.contentDescription?.toString()?.takeIf { it.isNotBlank() }
                ?: node.text?.toString()?.takeIf { it.isNotBlank() }
                ?: "릴스"
        } catch (e: Exception) {
            "릴스"
        }
    }

    /**
     * 단순 릴스 감지
     */
    fun detect(root: AccessibilityNodeInfo?): Pair<Boolean, String> {
        if (root == null) return false to "릴스"
        
        return try {
            // 1. 캡션 컴포넌트 확인
            val caps = root.findAccessibilityNodeInfosByViewId(Constants.CAP_CMP)
            if (caps.isNotEmpty()) {
                val desc = getCapt(caps[0])
                caps.forEach { try { it.recycle() } catch (_: Exception) {} }
                return true to desc
            }
            
            // 2. 뷰어 확인
            val vwrs = root.findAccessibilityNodeInfosByViewId(Constants.RLS_VWR)
            if (vwrs.isNotEmpty()) {
                vwrs.forEach { try { it.recycle() } catch (_: Exception) {} }
                return true to "릴스"
            }
            
            // 3. 컨트롤 확인
            val likes = root.findAccessibilityNodeInfosByViewId(Constants.RLS_LIKE)
            if (likes.isNotEmpty()) {
                likes.forEach { try { it.recycle() } catch (_: Exception) {} }
                return true to "릴스"
            }
            
            false to "릴스"
            
        } catch (e: Exception) {
            false to "릴스"
        }
    }
}
    

