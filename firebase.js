/* ============================================================
   firebase.js — Firebase 초기화 & 공유 앱 상태
   ============================================================ */
'use strict';

/* 전역 공유 상태 객체 — 모든 모듈이 window.APP 을 통해 공유 */
window.APP = {
  db:             null,
  ref:            null,
  set:            null,
  get:            null,
  isAdmin:        sessionStorage.getItem('isAdmin') === '1',
  currentBusList: [],
  draggedItem:    null,
  bulletinFilter: 'all',
  rowCount:       6,
  /* 앱 설정 (Firebase에서 로드) */
  settings: {
    requireAdmin:    true,   /* 관리자 권한 필요 */
    showBulletin:    true,   /* 게시판 표시 */
    allowWrite:      true,   /* 게시글 작성 */
    allowComment:    true,   /* 댓글 작성 */
    allowEdit:       true,   /* 수정 */
    allowDelete:     true,   /* 삭제 */
    allowNotice:     true,   /* 공지 등록 */
    teamMode:        'ab',   /* 'ab' = A팀/B팀, 'fixed' = 22번TEAM */
    footerLine1:     '※ 보영운수 22번 주차도 | 노란색 = 당일 휴차',
    footerLine2:     '※ 원하는 날짜 선택 시 해당 날짜 마감 주차도를 불러옵니다.',
    footerLine3:     '※ 각조 팀장 & 부팀장 허락 없이 수정 절대 금지 ※',
    appVersion:      'v3.1.0',
  },
};

/* Firebase 프로젝트 설정 */
const FIREBASE_CONFIG = {
  apiKey:      'AIzaSyAcaIcwlhwAOgKPD5BKD3mAuXiAqLKHTu4',
  databaseURL: 'https://parking22-886c6-default-rtdb.asia-southeast1.firebasedatabase.app',
};

/* 앱 초기화 — DOMContentLoaded 이후 실행 (모든 스크립트 로드 완료 시점) */
async function initFirebase() {
  try {
    const { initializeApp } = await import(
      'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js'
    );
    const { getDatabase, ref: dbRef, set: dbSet, get: dbGet } = await import(
      'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js'
    );

    const app    = initializeApp(FIREBASE_CONFIG);
    APP.db       = getDatabase(app);
    APP.ref      = dbRef;
    APP.set      = dbSet;
    APP.get      = dbGet;

    /* 모듈 초기화 순서:
       1) UI (Firebase 불필요)
       2) Admin (권한 상태 설정)
       3) Parking (차량 목록 + 그리드)
       4) Bulletin (게시판)
       5) Popup (자동 팝업 체크) */
    await loadAppSettings();
    initUI();
    initAdmin();
    await loadBusListFromDB();
    await initParking();
    await initBulletin();
    await checkAndShowPopup();

  } catch (err) {
    console.error('Firebase 초기화 실패:', err);
  }
}

/* ── 앱 설정 Firebase 로드 ── */
async function loadAppSettings() {
  try {
    const snap = await APP.get(APP.ref(APP.db, 'appSettings'));
    if (snap.exists()) {
      Object.assign(APP.settings, snap.val());
    }
  } catch(e) { console.error('설정 로드 실패', e); }
}

/* DOMContentLoaded: 모든 <script> 가 실행된 뒤 발생 */
document.addEventListener('DOMContentLoaded', initFirebase);
