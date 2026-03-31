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
const WORKER_URL      = 'https://jolly-voice-134c.ach4343.workers.dev/';

/* ── 세션 상태 ──────────────────────────────────────────────── */
const dispatchState = {
  loaded:         false,
  todayNums:      [],   /* [{ num:'714', isEarly:true }, ...] */
  tomorrowNums:   [],
  todayMissing:   [],
  tomorrowMissing:[],
  todayStr:       '',
  tomorrowStr:    '',
  excludedAbsent: {},   /* { 'YYYY-MM-DD': Set<num> } — 날짜별 정비소 제외 목록 */
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
    /* CodeTabs */
    () => go(`https://api.codetabs.com/v1/proxy?quest=${enc}`),
    /* Cloudflare Worker */
    () => go(`${WORKER_URL}?url=${enc}`),
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

/* ── 내일 추출: busNumber별 startTime 최댓값(제일 늦은 시간대) 항목 기준
       → 해당 busNumber 뒤 3자리, startTime 오름차순 정렬 ────── */
function extractTomorrowNums(items) {
  /* 1. groupId 기준으로 그룹화 → busRound 가장 큰 것 선택 */
  const groups = {};

  for (const item of items) {
    const gid = item.groupId;

    if (!groups[gid] || item.busRound > groups[gid].busRound) {
      groups[gid] = item;
    }
  }

  /* 2. groupId 순서대로 정렬 */
  const result = Object.values(groups)
    .sort((a, b) => Number(a.groupId) - Number(b.groupId))
    .map(item => ({
      num: String(item.busNumber).slice(-3),
      isEarly: false
    }));

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
  const early  = numsArr.filter(n => n.isEarly);
  const normal = numsArr.filter(n => !n.isEarly);

  early.forEach(({ num }) => {
    parts.push(`<span class="dc-chip dc-chip--early" data-num="${num}" style="cursor:pointer">${num}</span>`);
  });
  normal.forEach(({ num }) => {
    parts.push(`<span class="dc-chip" data-num="${num}" style="cursor:pointer">${num}</span>`);
  });

  /* 휴차 칩 — 제외 여부에 따라 스타일 분기 */
  const dateStr = document.getElementById('datePicker')?.value || '';
  const excluded = dispatchState.excludedAbsent[dateStr] || new Set();
  missing.forEach(n => {
    if (excluded.has(n)) {
      /* 제외 상태: 취소선 + 회색 */
      parts.push(`<span class="dc-chip dc-chip--absent dc-chip--excluded" data-num="${n}" data-absent="1" style="cursor:pointer"><s>${n}</s></span>`);
    } else {
      parts.push(`<span class="dc-chip dc-chip--absent" data-num="${n}" data-absent="1" style="cursor:pointer">${n}</span>`);
    }
  });
  return parts.join('');
}

/* ── 칩 long press 감지 (0.8초) ────────────────────────────── */
const LONG_PRESS_MS = 800;
const _chipLongTimer = {};  /* { num: timerId } */

function bindChipClickEvents() {
  document.querySelectorAll('.dc-chip').forEach(chip => {
    const num = chip.dataset.num;
    if (!num) return;

    /* ── 휴차 칩(absent): long press → 제외/복귀, 짧은 탭 → 하이라이트 ── */
    if (chip.dataset.absent === '1') {
      let pressStarted = false;
      let longFired = false;

      const startPress = () => {
        pressStarted = true;
        longFired = false;
        _chipLongTimer[num] = setTimeout(() => {
          longFired = true;
          /* 진동 피드백 — Android */
          if (navigator.vibrate) navigator.vibrate(30);
          /* 시각 피드백 — iOS 포함 전 기기 (칩 흔들림) */
          chip.classList.add('dc-chip--shake');
          setTimeout(() => chip.classList.remove('dc-chip--shake'), 400);
          _toggleExcludeAbsent(num);
        }, LONG_PRESS_MS);
      };

      const endPress = () => {
        if (!pressStarted) return;
        pressStarted = false;
        clearTimeout(_chipLongTimer[num]);
        /* long press 아니었으면 → 짧은 탭: 기존 하이라이트 */
        if (!longFired) {
          if (chip.classList.contains('dc-chip--matched')) {
            if (APP.clearDispatchChipHighlight) APP.clearDispatchChipHighlight();
            document.querySelectorAll('.slot-card.dispatch-slot-selected')
              .forEach(c => c.classList.remove('dispatch-slot-selected'));
            if (APP.highlightDispatchChip) APP.highlightDispatchChip(null, null);
          } else {
            if (APP.highlightDispatchChip) APP.highlightDispatchChip(chip, num);
          }
        }
      };

      const cancelPress = () => {
        pressStarted = false;
        clearTimeout(_chipLongTimer[num]);
      };

      /* 터치 이벤트 (모바일) */
      chip.addEventListener('touchstart', e => { startPress(); }, { passive: true });
      chip.addEventListener('touchend',   e => { e.preventDefault(); endPress(); }, { passive: false });
      chip.addEventListener('touchmove',  cancelPress, { passive: true });

      /* 마우스 이벤트 (PC) */
      chip.addEventListener('mousedown', startPress);
      chip.addEventListener('mouseup',   endPress);
      chip.addEventListener('mouseleave',cancelPress);
      return;
    }

    /* ── 운행 칩: 기존 클릭 하이라이트 그대로 ── */
    chip.addEventListener('click', () => {
      if (chip.classList.contains('dc-chip--matched')) {
        if (APP.clearDispatchChipHighlight) APP.clearDispatchChipHighlight();
        document.querySelectorAll('.slot-card.dispatch-slot-selected')
          .forEach(c => c.classList.remove('dispatch-slot-selected'));
        if (APP.highlightDispatchChip) APP.highlightDispatchChip(null, null);
        return;
      }
      if (APP.highlightDispatchChip) APP.highlightDispatchChip(chip, num);
    });
  });
}

/* ── 휴차 제외 토글 ─────────────────────────────────────────── */
function _toggleExcludeAbsent(num) {
  const dateStr = document.getElementById('datePicker')?.value || '';
  if (!dateStr) return;
  if (!dispatchState.excludedAbsent[dateStr]) {
    dispatchState.excludedAbsent[dateStr] = new Set();
  }
  const exSet = dispatchState.excludedAbsent[dateStr];

  if (exSet.has(num)) {
    /* 제외 해제 → 그리드 복원 */
    exSet.delete(num);
    _restoreAbsentToGrid(num, dateStr);
  } else {
    /* 제외 → 그리드에서 제거 + 원위치 기억 */
    exSet.add(num);
    _removeAbsentFromGrid(num, dateStr);
  }

  /* Firebase 저장 */
  _saveExcludedAbsent(dateStr);
  /* 칩 재렌더링 */
  renderDispatchSection();
}

/* ── 제외 시 그리드에서 해당 차 제거 + 원위치 Firebase 저장 ── */
function _removeAbsentFromGrid(num, dateStr) {
  if (!APP.parkingState) return;
  const RC = APP.rowCount || 6;
  let savedSlot = null;
  for (let i = 0; i < RC * 3; i++) {
    if (APP.parkingState.values[i] === num) {
      savedSlot = i;
      APP.parkingState.values[i] = '';
      APP.parkingState.active[i] = false;
      break;
    }
  }
  /* 원위치 기억 — Firebase에 저장 */
  if (savedSlot !== null) {
    if (!APP.excludedSlotMap) APP.excludedSlotMap = {};
    if (!APP.excludedSlotMap[dateStr]) APP.excludedSlotMap[dateStr] = {};
    APP.excludedSlotMap[dateStr][num] = savedSlot;
    APP.set(APP.ref(APP.db, `parking/${dateStr}/excludedSlotMap`),
      APP.excludedSlotMap[dateStr]).catch(() => {});
  }
  if (typeof renderCards === 'function') renderCards();
  if (typeof saveData   === 'function') saveData();
}

/* ── 복귀 시 원위치 또는 빈칸에 복원 ── */
function _restoreAbsentToGrid(num, dateStr) {
  if (!APP.parkingState) return;
  const RC = APP.rowCount || 6;
  /* 이미 그리드에 있으면 패스 */
  for (let i = 0; i < RC * 3; i++) {
    if (APP.parkingState.values[i] === num) return;
  }
  /* 원위치 확인 */
  const savedSlot = APP.excludedSlotMap?.[dateStr]?.[num] ?? null;
  let targetSlot = null;

  if (savedSlot !== null && !APP.parkingState.values[savedSlot]) {
    /* 원위치 비어있으면 원위치 복원 */
    targetSlot = savedSlot;
  } else {
    /* 원위치 차 있거나 기억 없으면 첫 번째 빈칸 */
    for (let i = 0; i < RC * 3; i++) {
      if (!APP.parkingState.values[i]) { targetSlot = i; break; }
    }
  }
  if (targetSlot !== null) {
    APP.parkingState.values[targetSlot] = num;
    APP.parkingState.active[targetSlot] = true; /* 휴차 상태(rest) */
  }
  /* 원위치 기억 삭제 */
  if (APP.excludedSlotMap?.[dateStr]) {
    delete APP.excludedSlotMap[dateStr][num];
    APP.set(APP.ref(APP.db, `parking/${dateStr}/excludedSlotMap`),
      APP.excludedSlotMap[dateStr]).catch(() => {});
  }
  if (typeof renderCards === 'function') renderCards();
  if (typeof saveData   === 'function') saveData();
}

/* ── 제외 목록 Firebase 저장 ── */
function _saveExcludedAbsent(dateStr) {
  const exSet = dispatchState.excludedAbsent[dateStr];
  const arr   = exSet ? [...exSet] : [];
  APP.set(APP.ref(APP.db, `parking/${dateStr}/excludedAbsent`), arr).catch(() => {});
}

/* ── Firebase: 날짜별 저장 ──────────────────────────────────── */
async function saveDispatchToDB(todayStr, payload) {
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

  section.style.display = '';

  const loading   = document.getElementById('dispatchLoading');
  const content   = document.getElementById('dispatchContent');
  const emptyHint = document.getElementById('dispatchEmptyHint');
  const loadBtn   = document.getElementById('dispatchLoadBtn');

  if (!dispatchState.loaded) {
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

  /* 칩 클릭 이벤트 바인딩 */
  bindChipClickEvents();

  /* 출차 순위 뱃지 갱신 */
  if (typeof updateExitRankBadges === 'function') updateExitRankBadges();
  if (APP.renderCards) APP.renderCards();
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

  } catch (err) {
    console.error('배차 로드 실패:', err);
    if (loading) loading.style.display = 'none';
    if (loadBtn) { loadBtn.disabled = false; loadBtn.classList.remove('spinning'); }
    alert('배차 데이터를 불러오지 못했습니다.\n' + err.message);
    return;
  }

  renderDispatchSection();

  /* ── 순서조회 완료 토스트 ── */
  const todayCnt  = (dispatchState.todayNums  || []).filter(n => !(dispatchState.todayMissing  || []).includes(n.num ?? n)).length;
  const tmrCnt    = (dispatchState.tomorrowNums || []).length;
  showDispatchToast('✅ 오늘 입차  ' + todayCnt + '대\n✅ 내일 출차  ' + tmrCnt + '대');
}

/* ── 순서조회 완료 토스트 ──────────────────────────────────────── */
function showDispatchToast(msg) {
  let toast = document.getElementById('dispatchToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'dispatchToast';
    toast.style.cssText = [
      'position:fixed',
      'bottom:calc(80px + env(safe-area-inset-bottom))',
      'left:50%','transform:translateX(-50%)',
      'background:rgba(17,24,39,0.95)',
      'color:#fff',
      'padding:12px 20px',
      'border-radius:16px',
      'font-size:14px','font-weight:700',
      'line-height:1.7',
      'z-index:9999','pointer-events:none',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'box-shadow:0 4px 16px rgba(0,0,0,0.35)',
      'border:1px solid rgba(255,255,255,0.10)',
      'white-space:pre',
      'text-align:center',
      'transition:opacity 0.4s ease',
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
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

  /* 기존 FAB 불러오기 버튼 */
  const loadBtn = document.getElementById('dispatchLoadBtn');
  if (loadBtn) loadBtn.addEventListener('click', loadDispatchData);

  /* ── 통합 버튼: 불러오기 → 자동주차 순서 실행 ── */
  const autoBtn = document.getElementById('dispatchAutoBtn');
  if (autoBtn) {
    autoBtn.addEventListener('click', async () => {
      if (autoBtn.disabled) return;
      autoBtn.disabled = true;
      autoBtn.classList.add('spinning');

      try {
        /* 1단계: 배차 불러오기 (내부적으로 loading UI 처리) */
        await loadDispatchData();

        /* 2단계: 불러오기 성공 시 자동주차 실행 */
        if (dispatchState.loaded && APP.applyAutoParking) {
          setTimeout(() => {
            APP.applyAutoParking();
          }, 250);
        }
      } finally {
        autoBtn.disabled = false;
        autoBtn.classList.remove('spinning');
      }
    });
  }

  /* ※ datePicker change 이벤트는 parking.js changeDate()가 APP.loadDispatchForDate를 호출하므로 여기서 등록하지 않음 */
  const initDate = document.getElementById('datePicker')?.value || getTodayStr();
  loadDispatchForDate(initDate);
}
