/* ============================================================
   union-fee-firebase-886.js — 조합비·공제회비 Firebase 동기화
   경로: unionFee/ (parking22-886c6 RTDB)
   ============================================================ */
'use strict';

window.UnionFB = {
  db: null,
  ref: null,
  set: null,
  get: null,
  ready: false,
  PATH: 'unionFee',
};

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAcaIcwlhwAOgKPD5BKD3mAuXiAqLKHTu4',
  databaseURL: 'https://parking22-886c6-default-rtdb.asia-southeast1.firebasedatabase.app',
};

async function initUnionFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
    const { getDatabase, ref, set, get } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js');
    const app = initializeApp(FIREBASE_CONFIG);
    UnionFB.db = getDatabase(app);
    UnionFB.ref = ref;
    UnionFB.set = set;
    UnionFB.get = get;
    UnionFB.ready = true;
    return true;
  } catch (err) {
    console.error('Firebase 초기화 실패:', err);
    UnionFB.ready = false;
    return false;
  }
}

async function loadUnionDataFromFirebase() {
  if (!UnionFB.ready) return null;
  try {
    const snap = await UnionFB.get(UnionFB.ref(UnionFB.db, UnionFB.PATH));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.error('Firebase 로드 실패:', err);
    return null;
  }
}

async function saveUnionDataToFirebase(records, members) {
  if (!UnionFB.ready) return { ok: false, reason: 'offline' };
  try {
    await UnionFB.set(UnionFB.ref(UnionFB.db, UnionFB.PATH), {
      records: records || [],
      members: members || 0,
      lastSaved: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err) {
    console.error('Firebase 저장 실패:', err);
    return { ok: false, reason: err.message };
  }
}
