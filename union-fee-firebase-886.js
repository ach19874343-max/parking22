/* ============================================================
   union-fee-firebase-886.js — 조합비·공제회비 Firebase 동기화
   경로: unionFee/ (parking22-886c6 RTDB)
   ============================================================ */
'use strict';

window.UnionFB = {
  db: null,
  ref: null,
  set: null,
  ready: false,
  PATH: 'unionFee',
  _unsubscribe: null,
};

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAcaIcwlhwAOgKPD5BKD3mAuXiAqLKHTu4',
  databaseURL: 'https://parking22-886c6-default-rtdb.asia-southeast1.firebasedatabase.app',
};

async function initUnionFirebase() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
    const { getDatabase, ref, set, onValue, off } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js');

    let app;
    try {
      app = initializeApp(FIREBASE_CONFIG);
    } catch (e) {
      // 앱 중복 초기화 — 기존 인스턴스 재사용
      const { getApp } = await import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js');
      app = getApp();
    }

    UnionFB.db       = getDatabase(app);
    UnionFB.ref      = ref;
    UnionFB.set      = set;
    UnionFB.onValue  = onValue;
    UnionFB.off      = off;
    UnionFB.ready    = true;
    return true;
  } catch (err) {
    console.error('Firebase 초기화 실패:', err);
    UnionFB.ready = false;
    return false;
  }
}

/* 실시간 리스너 — Firebase 데이터가 바뀌면 callback(data) 즉시 호출 */
function startFirebaseSync(callback) {
  if (!UnionFB.ready) return;
  if (UnionFB._unsubscribe) {
    UnionFB._unsubscribe();
    UnionFB._unsubscribe = null;
  }
  const dbRef = UnionFB.ref(UnionFB.db, UnionFB.PATH);
  UnionFB._unsubscribe = UnionFB.onValue(dbRef, (snap) => {
    callback(snap.exists() ? snap.val() : null);
  }, (err) => {
    console.error('Firebase 리스너 오류:', err);
  });
}

function stopFirebaseSync() {
  if (UnionFB._unsubscribe) {
    UnionFB._unsubscribe();
    UnionFB._unsubscribe = null;
  }
}

async function saveUnionDataToFirebase(records, members, settings) {
  if (!UnionFB.ready) return { ok: false, reason: 'offline' };
  try {
    await UnionFB.set(UnionFB.ref(UnionFB.db, UnionFB.PATH), {
      records:    records || [],
      members:    members || 0,
      rate:       (settings && settings.rate      != null) ? settings.rate      : 3,
      deductAmt:  (settings && settings.deductAmt != null) ? settings.deductAmt : 40000,
      ratios:     (settings && settings.ratios    != null) ? settings.ratios    : { large: 85, medium: 10, small: 5 },
      lastSaved:  new Date().toISOString(),
    });
    return { ok: true };
  } catch (err) {
    console.error('Firebase 저장 실패:', err);
    return { ok: false, reason: err.message };
  }
}

/* 하위호환 — 기존 코드에서 loadUnionDataFromFirebase 호출 시 안전하게 처리 */
async function loadUnionDataFromFirebase() {
  return null; // boot()에서 더 이상 사용 안 함 (startFirebaseSync로 대체)
}
