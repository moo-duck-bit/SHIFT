package expo.modules.mymodule

/**
 * 앱 전체 상수 정의

 */
object Constants {
    // 태그
    const val TAG_MODULE = "MyMod"
    const val TAG_INST = "IGTrak"
    const val TAG_LOG = "LogMgr"
    const val TAG_FIRE = "FBSvc"
    
    // 앱 관련
    const val PREFS = "prefs"
    const val IG_PKG = "com.instagram.android"
    const val YT_PKG = "com.google.android.youtube"
    
    // 인스타그램 UI 컴포넌트 ID
    const val CAP_CMP = "com.instagram.android:id/caption"
    const val RLS_VWR = "com.instagram.android:id/clips_viewer_view_pager"
    const val RLS_LIKE = "com.instagram.android:id/row_feed_button_like"
    const val RLS_CMT = "com.instagram.android:id/row_feed_button_comment"
    const val RLS_SHARE = "com.instagram.android:id/row_feed_button_share"
    const val RLS_PLAY = "com.instagram.android:id/clips_video_player"
    const val RLS_CONTAINER = "com.instagram.android:id/reel_viewer_container"
    const val RLS_ACTION_BAR = "com.instagram.android:id/action_bar_root"
    
    // 유튜브 UI 컴포넌트 ID
    const val YT_SHORTS_PLAYER = "com.google.android.youtube:id/shorts_player_page"
    const val YT_SHORTS_OVERLAY = "com.google.android.youtube:id/shorts_overlay"
    const val YT_SHORTS_LIKE = "com.google.android.youtube:id/shorts_like_button"
    const val YT_SHORTS_DISLIKE = "com.google.android.youtube:id/shorts_dislike_button"
    const val YT_SHORTS_COMMENT = "com.google.android.youtube:id/shorts_comment_button"
    const val YT_SHORTS_SHARE = "com.google.android.youtube:id/shorts_share_button"
    const val YT_VIDEO_TITLE = "com.google.android.youtube:id/video_title"
    const val YT_PLAYER_VIEW = "com.google.android.youtube:id/player_view"
    
    // 시간 설정

    const val MAX_DUR = 300000L  // 최대 시청시간 (5분)
    const val MIN_VIEW = 1000L   // 최소 시청시간 (1초)
    const val CHK_INT = 30000L   // 체크 간격 (30초)
    
    // 서비스 상태
    const val SVC_NULL = "NULL"
    const val SVC_INIT = "INIT"
    const val SVC_READY = "READY"
    const val SVC_ERROR = "ERROR"
    
    // 로그 레벨
    const val LOG_V = "v"
    const val LOG_D = "d"
    const val LOG_I = "i"
    const val LOG_W = "w"
    const val LOG_E = "e"
    
    // 재시도 설정
    const val RETRY_MAX = 3
    const val RETRY_DLY = 2000L  // 재시도 지연 (2초)
    
    // 파이어베이스 컬렉션
    const val FB_USERS = "users"
    const val FB_STATS = "usage_stats"
    const val FB_LOGS = "error_logs"

    
    // 감지 쿨다운 시간 증가 (과부하 방지)
    const val DET_CD = 1000L // 1초로 증가
    const val SCR_CD = 500L  // 스크롤 쿨다운도 증가
}

/**
 * 카테고리 매핑 객체
 */
object CategoryMapper {
    private val CATEGORY_KOREAN_MAP = mapOf(
        // 기존 카테고리
    "Animation" to "애니메이션",
    "Autos & Vehicles" to "자동차/차량",
    "Hip-Hop" to "힙합",
    "Pets & Animals" to "동물/펫",
    "Sports" to "스포츠",
    "Travel & Events" to "여행/이벤트",
    "Gaming" to "게임",
    "V-logs" to "일상/블로그",
    "Comedy" to "코미디",
    "Movie" to "영화",
    "News & Politics" to "뉴스/정치",
    "How-to & Style" to "꿀팁",
    "Education" to "교육",
    "Science & Technology" to "과학/기술",
    "Shopping" to "쇼핑",
    "Food & Drink" to "음식/요리",
    "K-POP" to "K-POP",
    "Lifestyle" to "라이프스타일",
    "Drama" to "드라마",
    "Variety show" to "예능",
    "Short-form Challenge" to "숏폼 챌린지",
    "MEME" to "밈"
    )
    
    fun getCategoryKoreanName(category: String): String {
        return CATEGORY_KOREAN_MAP[category] ?: category
    }
}
