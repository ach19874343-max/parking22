/* ============================================================
   dispatch.js — 배차 API 버스 번호 조회 v2.0
   · 관리자 전용 (게스트 완전 숨김)
   · 성공한 프록시 기억 → 다음번에 우선 시도
   · Firebase 날짜별 저장 / 2일 지난 데이터 자동 삭제
   · 총5회차 판정: busRound 최댓값 === 4
   ============================================================ */
'use strict';

/* ── 성공 프록시 캐시 키 ────────────────────────────────────── */
const PROXY_CACHE_KEY = 'dispatchLastProxyIdx';

/* ── 세션 상태 ──────────────────────────────────────────────── */
const dispatchState = {
  loaded:         false,
  todayNums:      [],   /* [{ num:'714', isEarly:true }, ...] */
  tomorrowNums:   [],
  todayMissing:   [],
  tomorrowMissing:[],
  todayStr:       '',
  tomorrowStr:    '',
};

/* ── 날짜 유틸 ─────────────────────────────────────────────── */
function getDispatchDates() {
  const dp = document.getElementById('datePicker');
  const todayStr = dp?.value || getTodayStr();
  const d = new Date(todayStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return { todayStr, tomorrowStr: `${y}-${mo}-${dy}` };
}

/* ── 프록시 목록 팩토리 ─────────────────────────────────────── */
function buildProxies(targetUrl) {
  const enc = encodeURIComponent(targetUrl);
  const go = url => fetch(url).then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  });
  return [
    /* 0 직접 */
    () => go(targetUrl),
    /* 1 allorigins /raw */
    () => go(`https://api.allorigins.win/raw?url=${enc}`),
    /* 2 thingproxy */
    () => go(`https://thingproxy.freeboard.io/fetch/${targetUrl}`),
    /* 3 codetabs */
    () => go(`https://api.codetabs.com/v1/proxy?quest=${enc}`),
    /* 4 corsproxy.io */
    () => go(`https://corsproxy.io/?url=${enc}`),
  ];
}

/* ── JSON → items 배열 파싱 ────────────────────────────────── */
function parseDispatchJson(json) {
  if (Array.isArray(json))          return json;
  if (Array.isArray(json?.object))  return json.object;
  if (json?.contents) {
    const inner = JSON.parse(json.contents);
    if (Array.isArray(inner?.object)) return inner.object;
  }
  throw new Error('응답 구조 불일치');
}

/* ── API 호출: 성공 프록시 우선, 실패 시 순환 ──────────────── */
async function fetchDispatchItems(dateStr) {
  const base = (APP.settings.dispatchApiBase || 'https://api.kiki-bus.com/dispatch/126')
    .replace(/\/+$/, '');
  const targetUrl = `${base}/${dateStr}`;
  const proxies = buildProxies(targetUrl);

  const savedIdx = parseInt(sessionStorage.getItem(PROXY_CACHE_KEY) ?? '-1', 10);
  /* 성공했던 인덱스를 맨 앞에, 나머지 순서대로 */
  const order = [...new Set([savedIdx, ...proxies.map((_, i) => i)])]
    .filter(i => i >= 0 && i < proxies.length);

  for (const idx of order) {
    try {
      const json  = await proxies[idx]();
      const items = parseDispatchJson(json);
      sessionStorage.setItem(PROXY_CACHE_KEY, String(idx));
      console.log(`[dispatch] 프록시[${idx}] 성공`);
      return items;
    } catch (e) {
      console.warn(`[dispatch] 프록시[${idx}] 실패:`, e.message);
    }
  }
  throw new Error('모든 프록시 실패 — 네트워크 또는 서버 제한');
}

/* ── 오늘 추출: startOrder별 busRound 최댓값 항목
       isEarly = 최대 busRound === 4 (총5회차 → isEarly=true)
       busRound 0~5 인 경우 최대 5 → 일반 ─────────────────── */
function extractTodayNums(items) {
  const groups = {};
  for (const item of items) {
    const so = item.startOrder;
    if (groups[so] === undefined || item.busRound > groups[so].busRound) {
      groups[so] = item;
    }
  }
  const sortedOrders = Object.keys(groups).sort((a, b) => +a - +b);
  const seen   = new Set();
  const result = [];
  for (const key of sortedOrders) {
    const g     = groups[key];
    const last3 = String(g.busNumber).slice(-3);
    if (seen.has(last3)) continue;
    seen.add(last3);
    result.push({ num: last3, isEarly: g.busRound === 4 });
  }
  return result;
}

/* ── 내일 추출: startOrder 순, isEarly 없음 ─────────────────── */
function extractTomorrowNums(items) {
  const sorted = [...items].sort((a, b) => a.startOrder - b.startOrder);
  const seen   = new Set();
  const result = [];
  for (const item of sorted) {
    const last3 = String(item.busNumber).slice(-3);
    if (seen.has(last3)) continue;
    seen.add(last3);
    result.push({ num: last3, isEarly: false });
  }
  return result;
}

/* ── 누락(휴차) 계산 ────────────────────────────────────────── */
function getMissingNums(numsArr) {
  const set = new Set(numsArr.map(n => n.num));
  return (APP.currentBusList || []).filter(n => !set.has(n));
}

/* ── 칩 HTML 생성 ───────────────────────────────────────────── */
function buildChipsHTML(numsArr, missing) {
  const parts = [];
  numsArr.forEach(({ num, isEarly }) => {
    const cls = isEarly ? 'dc-chip dc-chip--early' : 'dc-chip';
    parts.push(`<span class="${cls}">${num}</span>`);
  });
  missing.forEach(n => {
    parts.push(`<span class="dc-chip dc-chip--absent">${n}</span>`);
  });
  return parts.join('');
}

/* ── Firebase: 날짜별 저장 ──────────────────────────────────── */
async function saveDispatchToDB(todayStr, payload) {
  if (!APP.isAdmin) return;
  try {
    await APP.set(APP.ref(APP.db, `dispatch/${todayStr}`), {
      ...payload,
      savedAt: new Date().toISOString(),
    });
  } catch (e) { console.error('dispatch 저장 실패', e); }
}

/* ── Firebase: 날짜별 로드 ──────────────────────────────────── */
async function loadDispatchFromDB(todayStr) {
  try {
    const snap = await APP.get(APP.ref(APP.db, `dispatch/${todayStr}`));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}

/* ── Firebase: 2일 지난 배차 데이터 자동 삭제 ──────────────── */
async function cleanOldDispatchData() {
  if (!APP.isAdmin) return;
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 2);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const snap = await APP.get(APP.ref(APP.db, 'dispatch'));
    if (!snap.exists()) return;
    const delTasks = [];
    snap.forEach(child => {
      if (child.key < cutoffStr)
        delTasks.push(APP.set(APP.ref(APP.db, `dispatch/${child.key}`), null));
    });
    if (delTasks.length) {
      await Promise.all(delTasks);
      console.log(`🗑️ 오래된 배차 데이터 ${delTasks.length}건 삭제`);
    }
  } catch (e) { console.error('dispatch 삭제 실패', e); }
}

/* ── DB 데이터 → dispatchState 적용 ────────────────────────── */
function applyDBData(saved, todayStr, tomorrowStr) {
  /* Firebase는 배열을 {0:{...},1:{...}} 객체로 반환할 수 있으므로 변환 필요 */
  const toArr = v => !v ? [] : (Array.isArray(v) ? v : Object.values(v));
  dispatchState.loaded          = true;
  dispatchState.todayStr        = saved.todayStr    || todayStr;
  dispatchState.tomorrowStr     = saved.tomorrowStr || tomorrowStr;
  dispatchState.todayNums       = toArr(saved.todayNums);
  dispatchState.tomorrowNums    = toArr(saved.tomorrowNums);
  dispatchState.todayMissing    = toArr(saved.todayMissing);
  dispatchState.tomorrowMissing = toArr(saved.tomorrowMissing);
}

/* ── 섹션 DOM 렌더링 ────────────────────────────────────────── */
function renderDispatchSection() {
  const section = document.getElementById('dispatchSection');
  if (!section) return;

  if (!APP.isAdmin) { section.style.display = 'none'; return; }
  section.style.display = '';

  const btnWrap   = document.getElementById('dispatchBtnWrap');
  const loading   = document.getElementById('dispatchLoading');
  const content   = document.getElementById('dispatchContent');
  const emptyHint = document.getElementById('dispatchEmptyHint');
  const loadBtn   = document.getElementById('dispatchLoadBtn');

  if (!dispatchState.loaded) {
    if (btnWrap)   btnWrap.style.display   = '';
    if (loading)   loading.style.display   = 'none';
    if (content)   content.style.display   = 'none';
    if (emptyHint) emptyHint.style.display = '';
    if (loadBtn)   { loadBtn.disabled = false; loadBtn.classList.remove('spinning'); }
    return;
  }

  if (loading)   loading.style.display   = 'none';
  if (content)   content.style.display   = '';
  if (emptyHint) emptyHint.style.display = 'none';
  if (loadBtn)   { loadBtn.disabled = false; loadBtn.classList.remove('spinning'); }

  const fmt = s => (s || '').slice(5).replace('-', '/');
  const todayLblEl    = document.getElementById('dispatchTodayLbl');
  const tomorrowLblEl = document.getElementById('dispatchTomorrowLbl');
  if (todayLblEl)    todayLblEl.textContent    = fmt(dispatchState.todayStr);
  if (tomorrowLblEl) tomorrowLblEl.textContent = fmt(dispatchState.tomorrowStr);

  const todayEl    = document.getElementById('dispatchTodayChips');
  const tomorrowEl = document.getElementById('dispatchTomorrowChips');
  if (todayEl)
    todayEl.innerHTML    = buildChipsHTML(dispatchState.todayNums,    dispatchState.todayMissing);
  if (tomorrowEl)
    tomorrowEl.innerHTML = buildChipsHTML(dispatchState.tomorrowNums, dispatchState.tomorrowMissing);
}

/* ── 날짜별 배차 데이터 로드 ────────────────────────────────── */
async function loadDispatchForDate(dateStr) {
  /* tomorrowStr 계산 */
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const tomorrowStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  resetDispatchState(false);

  const saved = await loadDispatchFromDB(dateStr);
  if (saved && saved.todayNums) {
    applyDBData(saved, dateStr, tomorrowStr);
  }
  renderDispatchSection();
}

/* ── 버튼 클릭: API 호출 후 저장 ───────────────────────────── */
async function loadDispatchData() {
  if (!APP.isAdmin) return;

  const loadBtn   = document.getElementById('dispatchLoadBtn');
  const loading   = document.getElementById('dispatchLoading');
  const emptyHint = document.getElementById('dispatchEmptyHint');

  if (loadBtn)   { loadBtn.disabled = true; loadBtn.classList.add('spinning'); }
  if (loading)   loading.style.display   = '';
  if (emptyHint) emptyHint.style.display = 'none';

  try {
    const { todayStr, tomorrowStr } = getDispatchDates();
    const [todayItems, tomorrowItems] = await Promise.all([
      fetchDispatchItems(todayStr),
      fetchDispatchItems(tomorrowStr),
    ]);

    dispatchState.loaded          = true;
    dispatchState.todayStr        = todayStr;
    dispatchState.tomorrowStr     = tomorrowStr;
    dispatchState.todayNums       = extractTodayNums(todayItems);
    dispatchState.tomorrowNums    = extractTomorrowNums(tomorrowItems);
    dispatchState.todayMissing    = getMissingNums(dispatchState.todayNums);
    dispatchState.tomorrowMissing = getMissingNums(dispatchState.tomorrowNums);

    /* Firebase 저장 */
    await saveDispatchToDB(todayStr, {
      todayNums:       dispatchState.todayNums,
      tomorrowNums:    dispatchState.tomorrowNums,
      todayMissing:    dispatchState.todayMissing,
      tomorrowMissing: dispatchState.tomorrowMissing,
      todayStr,
      tomorrowStr,
    });

    cleanOldDispatchData();

  } catch (err) {
    console.error('배차 로드 실패:', err);
    if (loading) loading.style.display = 'none';
    if (loadBtn) { loadBtn.disabled = false; loadBtn.classList.remove('spinning'); }
    alert('배차 데이터를 불러오지 못했습니다.\n' + err.message);
    return;
  }

  renderDispatchSection();
}

/* ── 상태 리셋 ──────────────────────────────────────────────── */
function resetDispatchState(rerender = true) {
  dispatchState.loaded          = false;
  dispatchState.todayNums       = [];
  dispatchState.tomorrowNums    = [];
  dispatchState.todayMissing    = [];
  dispatchState.tomorrowMissing = [];
  dispatchState.todayStr        = '';
  dispatchState.tomorrowStr     = '';
  if (rerender) renderDispatchSection();
}

/* ── 모듈 초기화 ────────────────────────────────────────────── */
function initDispatch() {
  APP.renderDispatchSection = renderDispatchSection;
  APP.resetDispatch         = () => resetDispatchState(true);
  APP.loadDispatchForDate   = loadDispatchForDate;

  const loadBtn = document.getElementById('dispatchLoadBtn');
  if (loadBtn) loadBtn.addEventListener('click', loadDispatchData);

  /* 날짜 변경 → 해당 날짜 DB 데이터 로드 */
  const datePicker = document.getElementById('datePicker');
  if (datePicker) {
    datePicker.addEventListener('change', () => {
      loadDispatchForDate(datePicker.value);
    });
  }

  /* 초기 날짜 데이터 로드 */
  const initDate = datePicker?.value || getTodayStr();
  loadDispatchForDate(initDate);
}
