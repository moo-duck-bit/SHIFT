package expo.modules.mymodule

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.Display
import android.view.WindowManager
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicBoolean

class ScreenshotService private constructor() {
    companion object {
        private const val TAG = "ScreenshotSvc"
        private const val MAX_RETRY = 3
        private const val RETRY_DELAY = 1000L
        private const val THROTTLE_INTERVAL = 1000L
        private const val QUALITY = 80
        
        @Volatile
        private var instance: ScreenshotService? = null
        
        fun getInstance(): ScreenshotService {
            if (instance == null) {
                synchronized(this) {
                    if (instance == null) {
                        instance = ScreenshotService()
                    }
                }
            }
            return instance!!
        }
    }
    
    private val log = LogManager.getInstance()
    private val handler = Handler(Looper.getMainLooper())
    private val isCapturing = AtomicBoolean(false)
    private var lastCaptureTime = 0L
    
    interface ScreenshotListener {
        fun onCaptureSuccess(imageBase64: String, docId: String, timestamp: Long)
        fun onCaptureFailure(error: String, timestamp: Long)
    }
    
    fun captureScreenshot(
        accessibilityService: InstagramReelsTracker,
        listener: ScreenshotListener
    ) {
        try {
            val now = System.currentTimeMillis()
            
            if (now - lastCaptureTime < THROTTLE_INTERVAL) {
                log.log("d", TAG, "스크린샷 캡처 쓰로틀링 적용됨")
                return
            }
            
            if (!isCapturing.compareAndSet(false, true)) {
                log.log("d", TAG, "이미 스크린샷 캡처 진행 중")
                return
            }
            
            lastCaptureTime = now
            val docId = generateDocId()
            
           
            
            when {
                android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R -> {
                    captureWithAccessibilityService(accessibilityService, docId, now, listener)
                }
                android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P -> {
                    captureFallback(accessibilityService, docId, now, listener)
                }
                else -> {
                    isCapturing.set(false)
                    listener.onCaptureFailure("Android 9.0+ 필요", now)
                }
            }
            
        } catch (e: Exception) {
            isCapturing.set(false)
            log.log("e", TAG, "스크린샷 캡처 오류: ${e.message}")
            listener.onCaptureFailure(e.message ?: "오류", System.currentTimeMillis())
        }
    }
    
    @androidx.annotation.RequiresApi(android.os.Build.VERSION_CODES.R)
    private fun captureWithAccessibilityService(
        service: InstagramReelsTracker,
        docId: String,
        ts: Long,
        listener: ScreenshotListener
    ) {
        try {
            handler.post {
                try {
                    service.takeScreenshot(
                        Display.DEFAULT_DISPLAY,
                        { runnable -> handler.post(runnable) },
                        object : android.accessibilityservice.AccessibilityService.TakeScreenshotCallback {
                            override fun onSuccess(result: android.accessibilityservice.AccessibilityService.ScreenshotResult) {
                                try {
                                    //log.log("i", TAG, "스크린샷 캡처 성공")
                                    
                                    val bitmap = extractBitmapUsingReflection(result)
                                    
                                    if (bitmap != null) {
                                      
                                        processBitmap(bitmap, docId, ts, listener)
                                    } else {
                                        isCapturing.set(false)
                                        listener.onCaptureFailure("비트맵 추출 실패", ts)
                                    }
                                    
                                } catch (e: Exception) {
                                    log.log("e", TAG, "스크린샷 처리 오류: ${e.message}")
                                    isCapturing.set(false)
                                    listener.onCaptureFailure("처리 실패: ${e.message}", ts)
                                }
                            }
                            
                            override fun onFailure(code: Int) {
                                isCapturing.set(false)
                                log.log("e", TAG, "스크린샷 캡처 실패: $code")
                                listener.onCaptureFailure("캡처 실패 (코드: $code)", ts)
                            }
                        }
                    )
                } catch (e: Exception) {
                    isCapturing.set(false)
                    log.log("e", TAG, "takeScreenshot 호출 오류: ${e.message}")
                    listener.onCaptureFailure("API 호출 실패: ${e.message}", ts)
                }
            }
        } catch (e: Exception) {
            isCapturing.set(false)
            log.log("e", TAG, "스크린샷 오류: ${e.message}")
            listener.onCaptureFailure(e.message ?: "캡처 실패", ts)
        }
    }
    
    private fun captureFallback(
        service: InstagramReelsTracker,
        docId: String,
        ts: Long,
        listener: ScreenshotListener
    ) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                handler.post {
                    try {
                        log.log("w", TAG, "Android 9-10에서 스크린샷 시도")
                        isCapturing.set(false)
                        listener.onCaptureFailure("Android 9-10 제한됨, Android 11+ 권장", ts)
                    } catch (e: Exception) {
                        isCapturing.set(false)
                        log.log("e", TAG, "Android 9-10 스크린샷 오류: ${e.message}")
                        listener.onCaptureFailure("캡처 실패: ${e.message}", ts)
                    }
                }
            } else {
                isCapturing.set(false)
                listener.onCaptureFailure("Android 9.0+ 필요", ts)
            }
        } catch (e: Exception) {
            isCapturing.set(false)
            log.log("e", TAG, "Fallback 오류: ${e.message}")
            listener.onCaptureFailure("캡처 실패: ${e.message}", ts)
        }
    }
    
    private fun extractBitmapUsingReflection(result: android.accessibilityservice.AccessibilityService.ScreenshotResult): Bitmap? {
        return try {
  
            
            // 1. HardwareBuffer 접근 시도 (API 30+에서 사용 가능)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                try {
                    val hardwareBuffer = result.hardwareBuffer
                    if (hardwareBuffer != null) {
                        //log.log("i", TAG, "HardwareBuffer 획득 성공: ${hardwareBuffer.width}x${hardwareBuffer.height}")
                        return createBitmapFromHardwareBuffer(hardwareBuffer)
                    } else {
                        log.log("w", TAG, "HardwareBuffer가 null")
                    }
                } catch (e: Exception) {
                    log.log("e", TAG, "HardwareBuffer 접근 오류: ${e.message}")
                }
            }
            
            // 2. 리플렉션으로 필드 접근 시도
            val cls = result.javaClass
            log.log("d", TAG, "ScreenshotResult 클래스: ${cls.name}")
            
            val fieldNames = arrayOf(
                "mHardwareBitmap", 
                "hardwareBitmap", 
                "bitmap", 
                "mBitmap",
                "mScreenshot"
            )
            
            for (fieldName in fieldNames) {
                try {
                    val field = cls.getDeclaredField(fieldName)
                    field.isAccessible = true
                    val hwBitmap = field.get(result) as? Bitmap
                    
                    if (hwBitmap != null && !hwBitmap.isRecycled) {
                        //log.log("i", TAG, "리플렉션 필드 성공 - $fieldName: ${hwBitmap.width}x${hwBitmap.height}")
                        return hwBitmap.copy(Bitmap.Config.ARGB_8888, false)
                    }
                } catch (e: NoSuchFieldException) {
                    log.log("d", TAG, "필드 없음: $fieldName")
                } catch (e: Exception) {
                    log.log("w", TAG, "필드 접근 오류 $fieldName: ${e.message}")
                }
            }
            
            // 3. 메서드를 통한 접근 시도
            val methodNames = arrayOf(
                "getHardwareBitmap",
                "getBitmap", 
                "getScreenshot"
            )
            
            for (methodName in methodNames) {
                try {
                    val method = cls.getDeclaredMethod(methodName)
                    method.isAccessible = true
                    val hwBitmap = method.invoke(result) as? Bitmap
                    
                    if (hwBitmap != null && !hwBitmap.isRecycled) {
                        //log.log("i", TAG, "리플렉션 메서드 성공 - $methodName: ${hwBitmap.width}x${hwBitmap.height}")
                        return hwBitmap.copy(Bitmap.Config.ARGB_8888, false)
                    }
                } catch (e: NoSuchMethodException) {
                    log.log("d", TAG, "메서드 없음: $methodName")
                } catch (e: Exception) {
                    log.log("w", TAG, "메서드 접근 오류 $methodName: ${e.message}")
                }
            }
            
            // 4. 디버깅용 정보 출력
            try {
                val allFields = cls.declaredFields
                log.log("d", TAG, "모든 필드 목록: ${allFields.map { it.name }.joinToString(", ")}")
                
                val allMethods = cls.declaredMethods
                log.log("d", TAG, "모든 메서드 목록: ${allMethods.map { it.name }.joinToString(", ")}")
            } catch (e: Exception) {
                log.log("w", TAG, "필드/메서드 목록 출력 실패: ${e.message}")
            }
            
            log.log("e", TAG, "모든 접근 방법 실패")
            null
            
        } catch (e: Exception) {
            log.log("e", TAG, "리플렉션 전체 오류: ${e.message}")
            null
        }
    }
    
    @androidx.annotation.RequiresApi(android.os.Build.VERSION_CODES.R)
    private fun createBitmapFromHardwareBuffer(hardwareBuffer: android.hardware.HardwareBuffer): Bitmap? {
        return try {
            // HardwareBuffer를 Bitmap으로 변환
            val bitmap = Bitmap.wrapHardwareBuffer(hardwareBuffer, null)
            if (bitmap != null) {
                //log.log("i", TAG, "HardwareBuffer->Bitmap 변환 성공: ${bitmap.width}x${bitmap.height}")
                // Hardware bitmap을 software bitmap으로 복사
                return bitmap.copy(Bitmap.Config.ARGB_8888, false)
            } else {
                log.log("w", TAG, "HardwareBuffer->Bitmap 변환 실패")
                null
            }
        } catch (e: Exception) {
            log.log("e", TAG, "HardwareBuffer 처리 오류: ${e.message}")
            null
        }
    }

    private fun processBitmap(
        bmp: Bitmap,
        docId: String,
        ts: Long,
        listener: ScreenshotListener
    ) {
        try {
            val start = System.currentTimeMillis()
            
            val output = ByteArrayOutputStream()
            bmp.compress(Bitmap.CompressFormat.JPEG, QUALITY, output)
            val bytes = output.toByteArray()
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            
            output.close()
            bmp.recycle()
            
            val time = System.currentTimeMillis() - start
            
            log.log("i", TAG, "처리 완료 - docId: $docId, 크기: ${bytes.size} bytes, 시간: ${time}ms")
            
            isCapturing.set(false)
            listener.onCaptureSuccess(base64, docId, ts)
            
        } catch (e: Exception) {
            isCapturing.set(false)
            log.log("e", TAG, "비트맵 처리 오류: ${e.message}")
            listener.onCaptureFailure("처리 실패: ${e.message}", ts)
        }
    }
    
    private fun generateDocId(): String {
        return "ig_${System.currentTimeMillis()}_${(1000..9999).random()}"
    }
    
    fun isCapturing(): Boolean = isCapturing.get()
    
    fun cleanup() {
        try {
            isCapturing.set(false)
            lastCaptureTime = 0L
            log.log("d", TAG, "서비스 정리 완료")
        } catch (e: Exception) {
            log.log("e", TAG, "정리 오류: ${e.message}")
        }
    }
} 