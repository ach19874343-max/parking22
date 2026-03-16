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
  bulletinFilter: 'all',    // 탭 제거 → 항상 전체 표시
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

/* DOMContentLoaded: 모든 <script> 가 실행된 뒤 발생 */
document.addEventListener('DOMContentLoaded', initFirebase);
