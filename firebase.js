/* ============================================================
   firebase.js
   ============================================================ */
'use strict';

window.APP = {
  db: null, ref: null, set: null, get: null,
  isAdmin: true,
  currentBusList: [],
  draggedItem: null,
  rowCount: 6,
  settings: {
    teamMode: 'ab',
    footerLine1: '※ 보영운수 22번 주차도 | 노란색 = 당일 휴차',
    footerLine2: '※ 원하는 날짜 선택 시 해당 날짜 마감 주차도를 불러옵니다.',
    footerLine3: '※ 각조 팀장 & 부팀장 허락 없이 수정 절대 금지 ※',
    appVersion: 'v3.1.0',
    dispatchApiBase: 'https://api.kiki-bus.com/dispatch/126',
  },
};

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAcaIcwlhwAOgKPD5BKD3mAuXiAqLKHTu4',
  databaseURL: 'https://parking22-886c6-default-rtdb.asia-southeast1.firebasedatabase.app',
};

async function initFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
    const { getDatabase, ref: dbRef, set: dbSet, get: dbGet } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js');
    const app  = initializeApp(FIREBASE_CONFIG);
    APP.db     = getDatabase(app);
    APP.ref    = dbRef;
    APP.set    = dbSet;
    APP.get    = dbGet;
    await loadAppSettings();
    initAdmin();
    await loadBusListFromDB();
    initDispatch();
    initAutoParking();
    await initParking();
  } catch (err) {
    console.error('Firebase 초기화 실패:', err);
  }
}

async function loadAppSettings() {
  try {
    const snap = await APP.get(APP.ref(APP.db, 'appSettings'));
    if (snap.exists()) Object.assign(APP.settings, snap.val());
  } catch(e) { console.error('설정 로드 실패', e); }
}

document.addEventListener('DOMContentLoaded', initFirebase);
