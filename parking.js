/* ============================================================
   parking.js — 카드 기반 주차도 그리드 / 드래그앤드롭 v2.1
   ============================================================ */
'use strict';

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ──────────────────────── */
function getTodayStr() {
  const t = new Date();
  /* 00:00 ~ 01:59 는 전날로 취급 (날짜 전환 기준: 02:00) */
  if (t.getHours() < 2) t.setDate(t.getDate() - 1);
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

/* ── 날짜 문자열로 요일 표시 업데이트 ───────────────────── */
function updateDayLabel(dateStr) {
  const DAYS = ["일","월","화","수","목","금","토"];
  const d    = new Date(dateStr + "T00:00:00");
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  const day  = DAYS[d.getDay()];
  const mainEl = document.getElementById('dateMainText') ||
                 document.querySelector('.date-pill-text');
  if (!mainEl) return;
  const w = window.innerWidth;
  if (w <= 320) {
    mainEl.textContent = mm + '.' + dd + ' (' + day + ')';
  } else if (w <= 380) {
    mainEl.textContent = yyyy + '.' + mm + '.' + dd + ' (' + day + ')';
  } else {
    mainEl.textContent = yyyy + '년 ' + mm + '월 ' + dd + '일 (' + day + ')';
  }
}

/**
 * 복사 헤더용 저녁주차 A/B조.
 * 고정 기준: 2026-04-01 = B조. 그날(UTC 자정 기준)로부터 하루마다 A↔B만 교대(연도 바뀌어도 끊지 않음).
 */
const EVENING_SHIFT_ZERO_UTC_DAY = Math.floor(Date.UTC(2026, 3, 1) / 86400000);

function getEveningShiftTeamForDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'B';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const dayUtc = Math.floor(Date.UTC(y, mo - 1, d) / 86400000);
  const delta = dayUtc - EVENING_SHIFT_ZERO_UTC_DAY;
  return (delta & 1) === 0 ? 'B' : 'A';
}

/* ── Firebase 에서 차량 목록 로드 ───────────────────────── */
async function loadBusListFromDB() {
  const DEFAULT = ['714','750','751','752','753','754','755','756','757',
                   '768','769','770','771','776','778','780','785'];
  try {
    const snap = await APP.get(APP.ref(APP.db, 'busList'));
    if (snap.exists()) {
      let list = snap.val() || [];
      if (!Array.isArray(list)) list = Object.values(list);
      APP.currentBusList = list;
    } else {
      APP.currentBusList = [...DEFAULT];
    }
  } catch {
    APP.currentBusList = ['714','750','751','752','753','754','755','756','757',
                          '768','769','770','771','776','778','780','785'];
  }
}

/* ── Firebase 에 차량 목록 저장 ────────────────────────── */
async function saveBusListToDB() {
  try {
    await APP.set(APP.ref(APP.db, 'busList'), APP.currentBusList);
  } catch (err) {
    console.error('busList 저장 실패:', err);
  }
}

/* ── 차량 목록 기반 기본 주차 상태 생성 ─────────────────── */
/* ── 기본 행 라벨 ── */
const DEFAULT_ROW_LABELS = ['2R','3R','4R','5R','6R','7R'];

/* ── Firebase에서 행 목록 로드 ── */
async function loadRowsFromDB() {
  try {
    const snap = await APP.get(APP.ref(APP.db, 'rowLabels'));
    if (snap.exists()) {
      const val = snap.val();
      APP.rowLabels = Array.isArray(val) ? val : Object.values(val);
    } else {
      APP.rowLabels = [...DEFAULT_ROW_LABELS];
    }
  } catch {
    APP.rowLabels = [...DEFAULT_ROW_LABELS];
  }
  APP.rowCount = APP.rowLabels.length;
}

/* ── Firebase에 행 목록 저장 ── */
async function saveRowsToDB() {
  try {
    await APP.set(APP.ref(APP.db, 'rowLabels'), APP.rowLabels);
  } catch(e) { console.error('rowLabels 저장 실패', e); }
}

/* ── 행 수정 모드 상태 ── */
let rowEditMode = false;

/* ── 수정 모드 스냅샷 (취소 시 복원용) ── */
let vehicleEditSnapshot = null; /* { busList, values, active } */
let rowEditSnapshot     = null; /* { rowLabels, rowCount, values, active } */

/* ── 그리드 DOM 재렌더링 (행 추가/삭제 시) ── */
function renderGrid() {
  const grid = document.getElementById('parkingGrid');
  if (!grid) return;
  grid.innerHTML = '';
  APP.rowLabels.forEach((label, rowIdx) => {
    const row = document.createElement('div');
    row.className = 'p-row';

    if (rowEditMode) {
      /* 행 수정 모드: 라벨(탭→수정) + 삭제 버튼 가로 배치 */
      const isDefault = rowIdx < DEFAULT_ROW_LABELS.length;

      const wrap = document.createElement('div');
      wrap.className = 'line-label-wrap';
      wrap.style.alignSelf = 'stretch';

      const labelBtn = document.createElement('div');
      labelBtn.className = 'line-label line-label-edit';
      labelBtn.setAttribute('data-row', rowIdx);
      labelBtn.textContent = label;
      labelBtn.style.flex = '1';
      labelBtn.addEventListener('click', () => showRowLabelInput(rowIdx, label));

      const delBtn = document.createElement('button');
      delBtn.className = 'row-del-btn';
      delBtn.textContent = '✕';
      delBtn.disabled = isDefault;
      delBtn.addEventListener('click', () => {
        if (isDefault) return;
        if (!confirm(`${label} 행을 삭제하시겠습니까?`)) return;
        APP.rowLabels.splice(rowIdx, 1);
        APP.rowCount = APP.rowLabels.length;
        /* 해당 행 슬롯 데이터도 제거 */
        const startSlot = rowIdx * 3;
        const newValues = {}, newActive = {};
        let ni = 0;
        for (let i = 0; i < APP.rowCount * 3 + 3; i++) {
          if (i >= startSlot && i < startSlot + 3) continue;
          newValues[ni] = APP.parkingState.values[i] || '';
          newActive[ni] = APP.parkingState.active[i] || false;
          ni++;
        }
        APP.parkingState.values = newValues;
        APP.parkingState.active = newActive;
        /* ※ DB 저장은 수정 완료 버튼 클릭 시에만 */
        renderGrid();
        renderCards();
      });

      wrap.appendChild(labelBtn);
      wrap.appendChild(delBtn);
      row.appendChild(wrap);
    } else {
      const labelEl = document.createElement('div');
      labelEl.className = 'line-label';
      labelEl.setAttribute('data-row', rowIdx);
      labelEl.textContent = label;
      row.appendChild(labelEl);
    }

    const slots = document.createElement('div');
    slots.className = 'slots-wrap';
    slots.id = `row-${rowIdx}`;
    row.appendChild(slots);
    grid.appendChild(row);
  });

  /* 행 추가 버튼 (수정 모드일 때만) */
  if (rowEditMode) {
    const addRow = document.createElement('div');
    addRow.className = 'p-row row-add-row';
    addRow.innerHTML = '<button class="row-add-btn" id="rowAddBtn">+ 행 추가</button>';
    addRow.querySelector('#rowAddBtn').addEventListener('click', () => {
      const nextNum = APP.rowLabels.length + 2; /* 2R부터 시작 */
      const newLabel = nextNum + 'R';
      APP.rowLabels.push(newLabel);
      APP.rowCount = APP.rowLabels.length;
      /* 새 행 슬롯 초기화 */
      const startSlot = (APP.rowCount - 1) * 3;
      for (let i = 0; i < 3; i++) {
        APP.parkingState.values[startSlot + i] = '';
        APP.parkingState.active[startSlot + i] = false;
      }
      /* ※ DB 저장은 수정 완료 버튼 클릭 시에만 */
      renderGrid();
      renderCards();
    });
    grid.appendChild(addRow);
  }
}

/* ── 행 라벨 인라인 수정 ── */
function showRowLabelInput(rowIdx, current) {
  const labelEl = document.querySelector(`.line-label-edit[data-row="${rowIdx}"]`);
  if (!labelEl) return;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = current;
  inp.maxLength = 5;
  inp.className = 'row-label-input';
  labelEl.replaceWith(inp);
  inp.focus(); inp.select();
  const done = () => {
    const newVal = inp.value.trim();
    if (newVal) APP.rowLabels[rowIdx] = newVal;
    /* ※ DB 저장은 수정 완료 버튼 클릭 시에만 */
    renderGrid();
    renderCards();
  };
  inp.addEventListener('blur', done);
  inp.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); done(); } });
}

/* ── 행 수정 모드 토글 ── */
function toggleRowEditMode(on) {
  if (on) {
    rowEditSnapshot = {
      rowLabels: [...APP.rowLabels],
      rowCount:  APP.rowCount,
      values:    {...APP.parkingState.values},
      active:    {...APP.parkingState.active},
    };
  }
  rowEditMode = on;
  const parkingMain = document.querySelector('.parking-main');
  if (parkingMain) parkingMain.classList.toggle('row-edit-mode', on);
  const doneBar = document.getElementById('rowEditDoneBar');
  if (doneBar) doneBar.style.display = on ? 'flex' : 'none';
  const rowEditBtn = document.getElementById('rowEditBtn');
  if (rowEditBtn) rowEditBtn.classList.toggle('active', on);
  renderGrid();
  renderCards();
}

function buildDefaultState() {
  /* busList 전체가 들어갈 만큼 행 자동 확장 */
  const needed = Math.ceil(APP.currentBusList.length / 3);
  if (needed > APP.rowCount) {
    const extra = needed - APP.rowCount;
    for (let i = 0; i < extra; i++) {
      const nextNum = APP.rowLabels.length + 2;
      APP.rowLabels.push(nextNum + 'R');
    }
    APP.rowCount = APP.rowLabels.length;
    saveRowsToDB();
  }
  const values = {}, active = {};
  const SLOTS = APP.rowCount * 3;
  /* 하단 행부터 채우기 — 마지막 행(추가 행)에 먼저 */
  const reversed = [...APP.currentBusList].reverse();
  const slotOrder = [];
  for (let row = APP.rowCount - 1; row >= 0; row--) {
    for (let col = 2; col >= 0; col--) {
      slotOrder.push(row * 3 + col);
    }
  }
  slotOrder.forEach((slotIdx, i) => {
    values[slotIdx] = reversed[i] || '';
    active[slotIdx] = false;
  });
  return { values, active };
}

/* ── 빈 상태 생성 (저장 데이터 없는 날짜용) ── */
function buildEmptyState() {
  const values = {}, active = {};
  const SLOTS = APP.rowCount * 3;
  for (let i = 0; i < SLOTS; i++) {
    values[i] = '';
    active[i] = false;
  }
  return { values, active };
}

/* ── 슬롯에 없는 차량을 빈 슬롯(하단부터)에 채워넣기 ── */
function syncMissingVehiclesToSlots(values, active) {
  /* 1. 현재 슬롯에 있는 차량 수집 */
  const inSlot = new Set(Object.values(values).filter(v => v));
  /* 2. 슬롯에 없는 차량 찾기 */
  const missing = APP.currentBusList.filter(b => b && !inSlot.has(b));
  if (!missing.length) return;

  /* 3. 필요시 행 자동 확장 */
  const totalSlots = APP.rowCount * 3;
  const emptySlots = [];
  for (let i = 0; i < totalSlots; i++) {
    if (!values[i]) emptySlots.push(i);
  }
  /* 빈 슬롯 부족하면 행 추가 */
  if (emptySlots.length < missing.length) {
    const rowsNeeded = Math.ceil((missing.length - emptySlots.length) / 3);
    for (let i = 0; i < rowsNeeded; i++) {
      const nextNum = APP.rowLabels.length + 2;
      APP.rowLabels.push(nextNum + 'R');
      const newRow = APP.rowLabels.length - 1;
      for (let c = 0; c < 3; c++) {
        const si = newRow * 3 + c;
        values[si] = '';
        active[si] = false;
        emptySlots.push(si);
      }
    }
    APP.rowCount = APP.rowLabels.length;
    saveRowsToDB();
  }

  /* 4. 하단 행부터 빈 슬롯에 채우기 */
  const emptyFromBottom = emptySlots.sort((a, b) => b - a);
  missing.forEach((bus, i) => {
    if (emptyFromBottom[i] !== undefined) {
      values[emptyFromBottom[i]] = bus;
      active[emptyFromBottom[i]] = false;
    }
  });
}

/* ─────────────────────────────────────────────────────────
   드래그 & 드롭 전역 상태
   ───────────────────────────────────────────────────────── */
let dragSrcSlot    = null;   // PC 드래그 소스 슬롯 인덱스
let touchTimer     = null;   // 롱프레스 타이머

/* ── 탭-투-스왑 전역 상태 ── */
let tapFirstSlot   = null;   // 첫 번째 탭 슬롯 인덱스 (null 이면 미선택)
let tapConfirmSlot = null;   // 두 번째 탭 슬롯 인덱스 (파란 확인 중)

/* ── 탭 상태 완전 초기화 ── */
function clearTapState() {
  if (tapFirstSlot !== null) {
    const c = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
    if (c) { c.classList.remove('tap-selected', 'dispatch-slot-selected'); }
  }
  if (tapConfirmSlot !== null) {
    const c = document.querySelector(`.slot-card[data-slot="${tapConfirmSlot}"]`);
    if (c) { c.classList.remove('tap-confirm'); }
  }
  tapFirstSlot   = null;
  tapConfirmSlot = null;
  clearDispatchChipHighlight();
}

/* ── 배차 칩 하이라이트 해제 ───────────────────────────────── */
function clearDispatchChipHighlight() {
  document.querySelectorAll('.dc-chip.dc-chip--matched').forEach(c => {
    c.classList.remove('dc-chip--matched');
  });
}

/* ── 슬롯 탭 시: 오늘·내일 칩 중 같은 번호 모두 빨간 테두리 ── */
function highlightMatchingChips(num) {
  clearDispatchChipHighlight();
  if (!num) return;
  const last3 = String(num).slice(-3);
  document.querySelectorAll('.dc-chip').forEach(chip => {
    if (chip.textContent.trim() === last3) {
      chip.classList.add('dc-chip--matched');
    }
  });
}

/* ── 배차 칩 클릭: 오늘·내일 같은 번호 칩 모두 빨간,
   주차 그리드 해당 슬롯 파란(tapFirstSlot 설정) → 다른 슬롯 탭으로 이동 */
function highlightDispatchChip(chipEl, num) {
  /* 기존 탭 상태 전부 초기화 */
  clearTapState();
  document.querySelectorAll('.slot-card.dispatch-slot-selected').forEach(c => {
    c.classList.remove('dispatch-slot-selected');
  });

  if (!chipEl || !num) return;

  const last3 = String(num).slice(-3);

  /* 오늘·내일 칩 빨간 테두리 */
  document.querySelectorAll('.dc-chip').forEach(chip => {
    if (chip.textContent.trim() === last3) {
      chip.classList.add('dc-chip--matched');
    }
  });

  /* 주차 그리드에서 해당 번호 슬롯 → 빨간(tap-selected) + tapFirstSlot 설정 */
  const totalSlots = APP.rowCount * 3;
  for (let i = 0; i < totalSlots; i++) {
    const v = APP.parkingState.values[i];
    if (v && String(v).slice(-3) === last3) {
      const card = document.querySelector(`.slot-card[data-slot="${i}"]`);
      if (card && !card.classList.contains('empty')) {
        card.classList.add('tap-selected');   /* 빨간 — 칩 클릭도 1탭과 동일 */
        tapFirstSlot = i;
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        break;
      }
    }
  }
}
/* ── 수동/오토 그리드 메모리 캐시 (날짜별) ── */
const manualGridCache = {};  /* { 'YYYY-MM-DD': {values, active} } */
const autoGridCache   = {};  /* { 'YYYY-MM-DD': {values, active} } */

function currentDate() {
  return document.getElementById('datePicker')?.value || '';
}

/* ── 수동/오토 버튼 활성화 상태 동기화 ── */
function syncGridBtns(date) {
  const d = date || currentDate();
  const manBtn = document.getElementById('manualLoadBtn');
  const autoBtn = document.getElementById('autoLoadBtn');
  if (manBtn) manBtn.disabled = !manualGridCache[d];
  if (autoBtn) autoBtn.disabled = !autoGridCache[d];
}

/* ── 수동 그리드 저장 (번호 이동 완료 시 호출) ── */
function saveManualGrid() {
  const date = currentDate();
  if (!date) return;
  manualGridCache[date] = {
    values: { ...APP.parkingState.values },
    active: { ...APP.parkingState.active },
  };
  syncGridBtns(date);
  /* Firebase에도 manualGrid 필드 업데이트 */
  APP.set(APP.ref(APP.db, 'parking/' + date + '/manualGrid'), {
    values: APP.parkingState.values,
    active: APP.parkingState.active,
    savedAt: new Date().toISOString(),
  }).catch(() => {});
}

/* ── 오토 그리드 저장 (Auto Park 적용 시 호출) ── */
function saveAutoGrid(date, values, active) {
  const d = date || currentDate();
  if (!d) return;
  autoGridCache[d] = { values: { ...values }, active: { ...active } };
  syncGridBtns(d);
}

/* ── 확인 팝업 ── */
function showConfirm(message, onConfirm) {
  /* 기존 팝업 있으면 제거 */
  document.getElementById('gridConfirmOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'gridConfirmOverlay';
  overlay.style.cssText = [
    'position:fixed','inset:0','z-index:9000',
    'background:rgba(0,0,0,0.5)',
    'display:flex','align-items:center','justify-content:center',
    'padding:20px',
  ].join(';');

  overlay.innerHTML = `
    <div style="
      background:var(--surface,#fff);
      border-radius:18px;
      padding:24px 20px 20px;
      width:100%;max-width:300px;
      box-shadow:0 20px 60px rgba(0,0,0,0.3);
      font-family:var(--font,-apple-system,sans-serif);
    ">
      <div style="font-size:15px;font-weight:700;color:var(--text-pri,#1A1F36);text-align:center;line-height:1.5;margin-bottom:20px;">
        ${message}
      </div>
      <div style="display:flex;gap:8px;">
        <button id="gridConfirmCancel" style="
          flex:1;height:44px;border-radius:12px;
          border:1px solid var(--border,rgba(0,0,0,0.1));
          background:var(--bg,#F2F2F7);
          font-size:15px;font-weight:600;
          color:var(--text-sec,#6B7280);cursor:pointer;
          font-family:inherit;
        ">취소</button>
        <button id="gridConfirmOk" style="
          flex:1;height:44px;border-radius:12px;
          border:none;
          background:linear-gradient(135deg,#2563EB,#1D4ED8);
          font-size:15px;font-weight:700;
          color:#fff;cursor:pointer;
          font-family:inherit;
        ">적용</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  document.getElementById('gridConfirmOk').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  document.getElementById('gridConfirmCancel').addEventListener('click', () => {
    overlay.remove();
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}

/* 드래그 고스트 요소 */
const ghost = document.getElementById('dragGhost');

/* ── 슬롯 스왑 ──────────────────────────────────────────── */
function swapSlots(srcIdx, dstIdx) {
  if (srcIdx === dstIdx) return;
  const sv = APP.parkingState.values[srcIdx];
  const dv = APP.parkingState.values[dstIdx];
  const sa = APP.parkingState.active[srcIdx];
  const da = APP.parkingState.active[dstIdx];

  APP.parkingState.values[srcIdx]  = dv;
  APP.parkingState.values[dstIdx]  = sv;
  APP.parkingState.active[srcIdx]  = da;
  APP.parkingState.active[dstIdx]  = sa;

  renderCards();
  saveData();
  saveManualGrid();  /* 번호 이동 완료 → 수동 그리드 자동 저장 */
}

/* ── 슬롯 상태 토글 (운행 ↔ 휴차) ─────────────────────── */
function toggleCardState(slotIdx) {
  if (!APP.parkingState.values[slotIdx]) return;
  APP.parkingState.active[slotIdx] = !APP.parkingState.active[slotIdx];
  renderCards();
  saveData();
}

/* ── 카드 터치/드래그 이벤트 설정 ──────────────────────── */
function setupCardEvents(card, slotIdx) {
  /* ── PC: 클릭 = 탭-투-스왑 / 꾹클릭(500ms) = 휴차토글 ── */
  let mouseTimer = null, mouseLong = false;

  card.addEventListener('mousedown', () => {
    mouseLong  = false;
    mouseTimer = setTimeout(() => {
      mouseLong = true;
      toggleCardState(slotIdx);
      /* 첫 탭 선택 중이었으면 취소 */
      if (tapFirstSlot !== null || tapConfirmSlot !== null) {
        clearTapState();
      }
    }, 500);
  });

  card.addEventListener('mouseup',    () => clearTimeout(mouseTimer));
  card.addEventListener('mouseleave', () => clearTimeout(mouseTimer));

  card.addEventListener('click', () => {
    if (mouseLong) return;

    /* ── 파란(확인) 상태일 때 ── */
    if (tapConfirmSlot !== null) {
      if (slotIdx === tapConfirmSlot) {
        /* 같은 파란 슬롯 재탭 → 취소 */
        clearTapState();
      } else {
        /* 다른 슬롯 탭 → 스왑 후 새 빨간 선택 시작 */
        const src = tapConfirmSlot;
        clearTapState();
        swapSlots(src, slotIdx);
      }
      return;
    }

    /* ── 빨간(선택) 상태일 때 ── */
    if (tapFirstSlot !== null) {
      if (slotIdx === tapFirstSlot) {
        /* 같은 빨간 슬롯 재탭 → 파란(이동 확인)으로 전환 */
        card.classList.remove('tap-selected', 'dispatch-slot-selected');
        tapConfirmSlot = slotIdx;
        tapFirstSlot   = null;
        card.classList.add('tap-confirm');
      } else {
        /* 다른 슬롯 탭 → 기존 빨간 해제 + 새 슬롯 빨간 선택 */
        const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
        if (prev) { prev.classList.remove('tap-selected', 'dispatch-slot-selected'); }
        tapFirstSlot = slotIdx;
        card.classList.add('tap-selected');
        highlightMatchingChips(APP.parkingState.values[slotIdx]);
      }
      return;
    }

    /* ── 아무것도 선택 안 된 상태 → 첫 번째 탭(빨간) ── */
    tapFirstSlot = slotIdx;
    card.classList.add('tap-selected');
    highlightMatchingChips(APP.parkingState.values[slotIdx]);
  });

  /* ── 모바일: 롱프레스 → 휴차토글 / 탭 → 탭-투-스왑 ── */
  let startX, startY, touchMoved = false, longPressed = false;

  card.addEventListener('touchstart', e => {
    startX      = e.touches[0].clientX;
    startY      = e.touches[0].clientY;
    touchMoved  = false;
    longPressed = false;

    /* 롱프레스 타이머: 480ms 꾹 누르면 휴차 토글 */
    touchTimer = setTimeout(() => {
      if (touchMoved) return;
      longPressed = true;
      toggleCardState(slotIdx);
      if (navigator.vibrate) navigator.vibrate(35);

      /* 첫 탭 선택 중이었으면 취소 */
      if (tapFirstSlot !== null || tapConfirmSlot !== null) {
        clearTapState();
      }
    }, 480);
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 9 || dy > 9) {
      touchMoved = true;
      clearTimeout(touchTimer);
    }
  }, { passive: true });

  card.addEventListener('touchend', e => {
    clearTimeout(touchTimer);
    if (touchMoved || longPressed) return; /* 스크롤 or 롱프레스 → 무시 */

    e.preventDefault(); /* 탭 처리 */

    if (tapConfirmSlot !== null) {
      /* ── 파란 확인 중 ── */
      if (slotIdx === tapConfirmSlot) {
        clearTapState();
      } else {
        const src = tapConfirmSlot;
        clearTapState();
        swapSlots(src, slotIdx);
      }
      return;
    }

    if (tapFirstSlot !== null) {
      /* ── 빨간 선택 중 ── */
      if (slotIdx === tapFirstSlot) {
        /* 같은 빨간 슬롯 재탭 → 파란(이동 확인)으로 전환 */
        card.classList.remove('tap-selected', 'dispatch-slot-selected');
        tapConfirmSlot = slotIdx;
        tapFirstSlot   = null;
        card.classList.add('tap-confirm');
      } else {
        /* 다른 슬롯 탭 → 기존 빨간 해제 + 새 슬롯 빨간 선택 */
        const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
        if (prev) { prev.classList.remove('tap-selected', 'dispatch-slot-selected'); }
        tapFirstSlot = slotIdx;
        card.classList.add('tap-selected');
        highlightMatchingChips(APP.parkingState.values[slotIdx]);
      }
      return;
    }

    /* 첫 번째 탭: 빨간 */
    tapFirstSlot = slotIdx;
    card.classList.add('tap-selected');
    highlightMatchingChips(APP.parkingState.values[slotIdx]);
  }, { passive: false });

  card.addEventListener('touchcancel', () => {
    clearTimeout(touchTimer);
    touchMoved  = false;
    longPressed = false;
  });
}

/* ── 빈 슬롯 드롭 이벤트 (항상 설정, admin 모드 체크는 drop 시) ── */
function setupEmptyCardDrop(card, slotIdx) {
  /* ── PC: 클릭 = 탭-투-스왑 두 번째 대상 ── */
  card.addEventListener('click', () => {
  
    if (tapConfirmSlot !== null) {
      /* 파란 상태 → 빈 슬롯 탭: 스왑 */
      const src = tapConfirmSlot;
      clearTapState();
      swapSlots(src, slotIdx);
      return;
    }

    if (tapFirstSlot === null) return;
    /* 빨간 상태 → 빈 슬롯 탭: 선택 취소 */
    clearTapState();
  });

  /* ── 모바일: 탭 = 탭-투-스왑 두 번째 대상 ── */
  let emptyTouchMoved = false;
  card.addEventListener('touchstart', () => { emptyTouchMoved = false; }, { passive: true });
  card.addEventListener('touchmove',  () => { emptyTouchMoved = true;  }, { passive: true });
  card.addEventListener('touchend', e => {
    if (emptyTouchMoved) return;
    e.preventDefault();

    if (tapConfirmSlot !== null) {
      const src = tapConfirmSlot;
      clearTapState();
      swapSlots(src, slotIdx);
      return;
    }

    if (tapFirstSlot === null) return;
    /* 빨간 → 빈 슬롯: 선택 취소 */
    clearTapState();
  }, { passive: false });
}

/* ── 카드 렌더링 ────────────────────────────────────────── */
/* 배차 로드 후 출차 순위 맵 갱신 → renderCards 호출 */
function updateExitRankBadges() {
  if (typeof dispatchState === 'undefined' || !dispatchState.loaded) return;
  const tmrList = (dispatchState.tomorrowNums || []).map(n => n.num ?? n);
  const rank = {};
  tmrList.forEach((n, i) => { rank[n] = i; });
  if (!APP.parkingState) APP.parkingState = {};
  APP.parkingState._tmrRank = rank;
  renderCards();
}

function renderCards() {
  /* 빈 그리드 안내 표시/숨김 */
  const hint = document.getElementById('emptyGridHint');
  if (hint && APP.parkingState) {
    const RC = APP.rowCount || 6;
    const hasAny = Object.values(APP.parkingState.values).some(v => v);
    hint.style.display = hasAny ? 'none' : 'flex';
  }

  for (let rowIdx = 0; rowIdx < APP.rowCount; rowIdx++) {
    const wrap = document.getElementById(`row-${rowIdx}`);
    if (!wrap) continue;
    wrap.innerHTML = '';

    for (let col = 0; col < 3; col++) {
      const slotIdx = rowIdx * 3 + col;
      const vehicle = APP.parkingState.values[slotIdx] || '';
      const isRest  = APP.parkingState.active[slotIdx] || false;

      const card = document.createElement('div');
      card.dataset.slot = slotIdx;

      if (vehicleEditMode) {
        /* ── 차량 수정 모드: 오버레이 버튼 표시 ── */
        if (!vehicle) {
          card.className = 'slot-card empty vehicle-edit-empty';
          const addBtn = document.createElement('button');
          addBtn.className = 'slot-add-btn';
          addBtn.textContent = '+';
          addBtn.addEventListener('click', () => showSlotAddInput(slotIdx));
          card.appendChild(addBtn);
        } else {
          card.className = `slot-card ${isRest ? 'rest' : 'run'} vehicle-edit-card`;
          card.innerHTML = '';
          /* I 디자인: 흰 오버레이 + 번호 + 태그 버튼 */
          const overlay = document.createElement('div');
          overlay.className = 'slot-edit-overlay';
          overlay.innerHTML =
            `<span class="slot-edit-num">${vehicle}</span>` +
            `<div class="slot-edit-btns">` +
              `<button class="slot-edit-btn edit">✏️ 수정</button>` +
              `<button class="slot-edit-btn del">✕</button>` +
            `</div>`;
          overlay.querySelector('.slot-edit-btn.edit').addEventListener('click', e => {
            e.stopPropagation();
            showSlotEditInput(slotIdx, vehicle);
          });
          overlay.querySelector('.slot-edit-btn.del').addEventListener('click', e => {
            e.stopPropagation();
            if (!confirm(`${vehicle} 차량을 삭제하시겠습니까?`)) return;
            const li = APP.currentBusList.indexOf(vehicle);
            if (li !== -1) APP.currentBusList.splice(li, 1);
            APP.parkingState.values[slotIdx] = '';
            APP.parkingState.active[slotIdx] = false;
            /* ※ DB 저장은 수정 완료 버튼 클릭 시에만 */
            renderCards();
          });
          card.appendChild(overlay);
        }
      } else {
        /* ── 일반 모드 ── */
        if (!vehicle) {
          card.className = 'slot-card empty';
          setupEmptyCardDrop(card, slotIdx);
        } else {
          card.className = `slot-card ${isRest ? 'rest' : 'run'}`;
          card.textContent = vehicle;
          const _r = APP.parkingState && APP.parkingState._tmrRank;
          if (_r && _r[vehicle] !== undefined) {
            const _b = document.createElement('span');
            _b.className = 'exit-rank-badge';
            _b.textContent = _r[vehicle] + 1;
            card.style.position = 'relative';
            card.appendChild(_b);
          }
          setupCardEvents(card, slotIdx);
        }
      }

      wrap.appendChild(card);
    }
  }

  /* renderCards 후 탭 상태 시각 복원 */
  if (tapFirstSlot !== null) {
    const sel = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
    if (sel && !sel.classList.contains('empty')) {
      sel.classList.add('tap-selected');           /* 빨간 복원 */
      const num = APP.parkingState.values[tapFirstSlot];
      if (num) highlightMatchingChips(num);
    }
  }
  if (tapConfirmSlot !== null) {
    const sel = document.querySelector(`.slot-card[data-slot="${tapConfirmSlot}"]`);
    if (sel) sel.classList.add('tap-confirm');     /* 파란 복원 */
  }
}

/* ── 슬롯 번호 수정 인풋 ── */
function showSlotEditInput(slotIdx, current) {
  const card = document.querySelector(`.slot-card[data-slot="${slotIdx}"]`);
  if (!card) return;
  card.innerHTML = '';
  card.className = card.className; /* 유지 */

  /* 인풋 + 확인 버튼 래퍼 */
  const wrap = document.createElement('div');
  wrap.className = 'slot-edit-input-wrap';

  const inp = document.createElement('input');
  inp.type      = 'text';
  inp.value     = current;
  inp.maxLength = 4;
  inp.inputMode = 'numeric';
  inp.className = 'slot-inline-input';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'slot-confirm-btn';
  confirmBtn.textContent = '✓';

  wrap.appendChild(inp);
  wrap.appendChild(confirmBtn);
  card.appendChild(wrap);
  inp.focus(); inp.select();

  let done = false;
  const doConfirm = () => {
    if (done) return;
    const newNum = inp.value.trim();
    if (!newNum) { done = true; renderCards(); return; }
    if (newNum !== current && APP.currentBusList.includes(newNum)) {
      alert('이미 존재하는 차량번호입니다.');
      done = false;
      setTimeout(() => inp.focus(), 50);
      return;
    }
    done = true;
    const li = APP.currentBusList.indexOf(current);
    if (li !== -1) APP.currentBusList[li] = newNum;
    APP.parkingState.values[slotIdx] = newNum;
    /* ※ DB 저장은 수정 완료 버튼 클릭 시에만 */
    renderCards();
  };
  confirmBtn.addEventListener('mousedown', e => e.preventDefault()); /* blur 방지 */
  confirmBtn.addEventListener('click', doConfirm);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); doConfirm(); }
    if (e.key === 'Escape') { done = true; renderCards(); }
  });
  inp.addEventListener('blur', () => setTimeout(() => { if (!done) doConfirm(); }, 150));
}

/* ── 빈 슬롯 차량 추가 인풋 ── */
function showSlotAddInput(slotIdx) {
  const card = document.querySelector(`.slot-card[data-slot="${slotIdx}"]`);
  if (!card) return;
  card.innerHTML = '';
  card.className = 'slot-card empty vehicle-edit-empty';

  const wrap = document.createElement('div');
  wrap.className = 'slot-edit-input-wrap';

  const inp = document.createElement('input');
  inp.type        = 'text';
  inp.maxLength   = 4;
  inp.inputMode   = 'numeric';
  inp.placeholder = '번호';
  inp.className   = 'slot-inline-input';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'slot-confirm-btn';
  confirmBtn.textContent = '✓';

  wrap.appendChild(inp);
  wrap.appendChild(confirmBtn);
  card.appendChild(wrap);
  inp.focus();

  let done = false;
  const doConfirm = () => {
    if (done) return;
    const newNum = inp.value.trim();
    if (!newNum) { done = true; renderCards(); return; }
    if (APP.currentBusList.includes(newNum)) {
      alert('이미 존재하는 차량번호입니다.');
      done = false;
      setTimeout(() => inp.focus(), 50);
      return;
    }
    done = true;
    APP.currentBusList.push(newNum);
    APP.parkingState.values[slotIdx] = newNum;
    APP.parkingState.active[slotIdx] = false;
    /* ※ DB 저장은 수정 완료 버튼 클릭 시에만 */
    renderCards();
  };
  confirmBtn.addEventListener('mousedown', e => e.preventDefault());
  confirmBtn.addEventListener('click', doConfirm);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doConfirm(); }
    if (e.key === 'Escape') { done = true; renderCards(); }
  });
  inp.addEventListener('blur', () => setTimeout(() => { if (!done) doConfirm(); }, 150));
}

/* ── Firebase에 주차 데이터 저장 ────────────────────────── */
function saveData() {
  const date = document.getElementById('datePicker').value;
  if (!date) return;
  const now = new Date().toISOString();
  const base = 'parking/' + date;
  /* 각 필드를 독립 경로로 저장 → manualGrid/autoGrid/excludedAbsent 등 절대 덮어쓰지 않음 */
  APP.set(APP.ref(APP.db, base + '/values'),    APP.parkingState.values).catch(() => {});
  APP.set(APP.ref(APP.db, base + '/active'),    APP.parkingState.active).catch(() => {});
  APP.set(APP.ref(APP.db, base + '/lastSaved'), now).then(() => {
    if (!APP.savedDates) APP.savedDates = new Set();
    APP.savedDates.add(date);
    updateParkingOverlay(date);
    updateLastSavedUI(now);
  }).catch(() => {});
}

/* ── 마지막 저장 시간 UI 업데이트 ── */
function updateLastSavedUI(isoStr) {
  const el = document.getElementById('lastSavedText');
  if (!el) return;
  if (!isoStr) { el.textContent = '갱신 기록 없음'; return; }
  const d    = new Date(isoStr);
  const now  = new Date();
  const hm   = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString();
  let label;
  if (isToday)          label = hm + ' 갱신';
  else if (isYesterday) label = '어제 ' + hm;
  else                  label = (d.getMonth()+1) + '/' + d.getDate() + ' ' + hm;
  el.textContent = label;
}

/* ── Firebase에서 주차 데이터 로드 ─────────────────────── */
async function loadData(date) {
  if (!date) return;
  const snap = await APP.get(APP.ref(APP.db, 'parking/' + date));
  const data = snap.val();

  if (data && data.values) {
    if (!APP.savedDates) APP.savedDates = new Set();
    APP.savedDates.add(date);
    const values = data.values || {};
    const active = data.active || {};
    const totalSlots = (APP.rowCount || 6) * 3;
    for (let i = 0; i < totalSlots; i++) {
      if (values[i] === undefined) values[i] = '';
      if (active[i] === undefined) active[i] = false;
    }
    syncMissingVehiclesToSlots(values, active);

    /* 수동 그리드 캐시 로드 */
    if (data.manualGrid?.values) {
      manualGridCache[date] = {
        values: data.manualGrid.values,
        active: data.manualGrid.active || {},
      };
    } else {
      delete manualGridCache[date];
    }
    /* 오토 그리드 캐시 로드 */
    if (data.autoGrid?.values) {
      autoGridCache[date] = {
        values: data.autoGrid.values,
        active: data.autoGrid.active || {},
      };
    } else {
      delete autoGridCache[date];
    }

    /* 제외 목록 — data에 포함된 필드 바로 사용 (추가 쿼리 없음) */
    if (!dispatchState.excludedAbsent) dispatchState.excludedAbsent = {};
    if (data.excludedAbsent) {
      const arr  = data.excludedAbsent;
      const list = Array.isArray(arr) ? arr : Object.values(arr || {});
      dispatchState.excludedAbsent[date] = new Set(list);
    } else {
      dispatchState.excludedAbsent[date] = new Set();
    }
    /* 원위치 맵 */
    if (!APP.excludedSlotMap) APP.excludedSlotMap = {};
    APP.excludedSlotMap[date] = data.excludedSlotMap || {};

    /* 제외 차량 values에서 제거 — renderCards 전에 처리 (깜빡임 방지) */
    const exSet = dispatchState.excludedAbsent[date];
    if (exSet.size > 0) {
      for (let i = 0; i < totalSlots; i++) {
        if (exSet.has(values[i])) {
          values[i] = '';
          active[i] = false;
        }
      }
    }

    APP.parkingState = { values, active };
  } else {
    APP.parkingState = buildEmptyState();
    delete manualGridCache[date];
    delete autoGridCache[date];
    if (!dispatchState.excludedAbsent) dispatchState.excludedAbsent = {};
    dispatchState.excludedAbsent[date] = new Set();
  }

  syncGridBtns(date);
  updateParkingOverlay(date);
  updateLastSavedUI(data?.lastSaved || null);
  renderCards();  /* 딱 한 번 */

  if (typeof dispatchState !== 'undefined' && dispatchState.loaded && dispatchState.tomorrowNums?.length) {
    if (typeof updateExitRankBadges === 'function') updateExitRankBadges();
  }
  if (typeof dispatchState !== 'undefined' && dispatchState.loaded) {
    if (typeof renderDispatchSection === 'function') renderDispatchSection();
  }
}

/* ── 주차 오버레이 표시/숨김 제어 ──────────────────────── */
function updateParkingOverlay(date) {
  /* 오버레이 항상 숨김 — 관리자/게스트 구분 없음 */
  const overlay = document.getElementById('parkingOverlay');
  if (overlay) overlay.classList.add('hidden');
}

/* ── 차량 수정 모드 상태 ── */
let vehicleEditMode = false;

/* ── 수정 모드 토글 ── */
function toggleVehicleEditMode(on) {
  if (on) {
    vehicleEditSnapshot = {
      busList: [...APP.currentBusList],
      values:  {...APP.parkingState.values},
      active:  {...APP.parkingState.active},
    };
  }
  vehicleEditMode = on;
  const parkingMain = document.querySelector('.parking-main');
  if (parkingMain) parkingMain.classList.toggle('vehicle-edit-mode', on);
  const doneBar = document.getElementById('vehicleEditDoneBar');
  if (doneBar) doneBar.style.display = on ? 'flex' : 'none';
  renderCards();
}

/* ── 수정 완료: 현재 슬롯 순서 기반으로 목록 재구성 후 저장 ── */
function saveVehicleEditDone() {
  /* 슬롯에 배치된 차량 순서대로 목록 재구성 */
  const newList = [];
  if (APP.parkingState?.values) {
    const totalSlots = APP.rowCount * 3;
    for (let i = 0; i < totalSlots; i++) {
      const v = APP.parkingState.values[i];
      if (v && !newList.includes(v)) newList.push(v);
    }
  }
  /* 슬롯에 없는 차량도 유지 */
  APP.currentBusList.forEach(b => { if (!newList.includes(b)) newList.push(b); });
  APP.currentBusList = newList;
  vehicleEditSnapshot = null;
  saveBusListToDB();
  saveData();
  toggleVehicleEditMode(false);
}

/* ── 차량 목록 패널 렌더링 ──────────────────────────────── */
function renderVehicleList() {
  const container = document.getElementById('vehicleListContainer');
  if (!container) return; /* 패널 없으면 스킵 */
  container.innerHTML = '';

  APP.currentBusList.forEach((bus, idx) => {
    const item = document.createElement('div');
    item.className = 'vehicle-item';
    item.draggable  = true;
    item.dataset.index = idx;
    item.innerHTML = `
      <div class="vehicle-item-content">
        <span class="vehicle-item-drag-handle">&#8285;&#8285;</span>
        <span class="vehicle-item-number">${bus}</span>
      </div>
      <div class="vehicle-item-btns">
        <button class="vehicle-item-edit"   aria-label="${bus} 수정">✏️</button>
        <button class="vehicle-item-delete" aria-label="${bus} 삭제">✕</button>
      </div>`;

    /* 수정 */
    item.querySelector('.vehicle-item-edit').addEventListener('click', () => {
      const span = item.querySelector('.vehicle-item-number');
      const cur  = span.textContent.trim();
      const inp  = document.createElement('input');
      inp.type      = 'text';
      inp.value     = cur;
      inp.maxLength = 4;
      inp.inputMode = 'numeric';
      inp.className = 'vehicle-item-edit-input';
      span.replaceWith(inp);
      inp.focus(); inp.select();
      const confirm = () => {
        const newNum = inp.value.trim();
        if (!newNum) { inp.replaceWith(span); return; }
        if (newNum !== cur && APP.currentBusList.includes(newNum)) {
          alert('이미 존재하는 차량번호입니다.'); inp.focus(); return;
        }
        /* 목록 업데이트 */
        APP.currentBusList[idx] = newNum;
        /* 주차 슬롯 내 번호도 변경 */
        if (APP.parkingState?.values) {
          Object.keys(APP.parkingState.values).forEach(i => {
            if (APP.parkingState.values[i] === cur) APP.parkingState.values[i] = newNum;
          });
          renderCards();
        }
        span.textContent = newNum;
        inp.replaceWith(span);
        saveBusListToDB();
      };
      inp.addEventListener('blur', confirm);
      inp.addEventListener('keypress', e => { if (e.key === 'Enter') { e.preventDefault(); confirm(); } });
    });

    /* 삭제 */
    item.querySelector('.vehicle-item-delete').addEventListener('click', () => {
      if (!confirm(`${bus} 차량번호를 삭제하시겠습니까?`)) return;
      APP.currentBusList.splice(idx, 1);
      saveBusListToDB();
      if (APP.parkingState?.values) {
        Object.keys(APP.parkingState.values).forEach(i => {
          if (APP.parkingState.values[i] === bus) {
            APP.parkingState.values[i] = '';
            APP.parkingState.active[i] = false;
          }
        });
        renderCards();
        saveData();
      }
      renderVehicleList();
    });

    /* PC 드래그 */
    item.addEventListener('dragstart', () => { APP.draggedItem = item; item.classList.add('dragging'); });
    item.addEventListener('dragend',   () => item.classList.remove('dragging'));
    item.addEventListener('dragover',  e => {
      e.preventDefault();
      if (!APP.draggedItem || APP.draggedItem === item) return;
      const all = Array.from(container.querySelectorAll('.vehicle-item'));
      const di  = all.indexOf(APP.draggedItem), ti = all.indexOf(item);
      item.parentNode.insertBefore(APP.draggedItem, di < ti ? item.nextSibling : item);
    });
    item.addEventListener('drop', e => e.preventDefault());

    /* 모바일 터치 드래그 */
    let vTouchY = 0, vTimer = null, vDragging = false;
    item.addEventListener('touchstart', e => {
      vTouchY = e.touches[0].clientY;
      vTimer  = setTimeout(() => {
        APP.draggedItem = item; item.classList.add('dragging');
        vDragging = true;
        if (navigator.vibrate) navigator.vibrate(25);
      }, 400);
    }, { passive: true });
    item.addEventListener('touchmove', e => {
      if (!vDragging) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      Array.from(container.querySelectorAll('.vehicle-item')).forEach(el => {
        const r = el.getBoundingClientRect();
        if (y > r.top && y < r.bottom && el !== item)
          el.parentNode.insertBefore(item, y > r.top + r.height / 2 ? el.nextSibling : el);
      });
    }, { passive: false });
    item.addEventListener('touchend', () => {
      clearTimeout(vTimer);
      if (vDragging) {
        item.classList.remove('dragging');
        APP.currentBusList = Array.from(container.querySelectorAll('.vehicle-item-number'))
          .map(el => el.textContent.trim());
        saveBusListToDB();
        loadData(document.getElementById('datePicker').value);
      }
      vDragging = false; APP.draggedItem = null;
    });

    container.appendChild(item);
  });

  /* PC 드래그 완료 후 순서 저장 */
  container.addEventListener('dragend', () => {
    APP.currentBusList = Array.from(container.querySelectorAll('.vehicle-item-number'))
      .map(el => el.textContent.trim());
    saveBusListToDB();
    loadData(document.getElementById('datePicker').value);
  });
}

async function initParking() {
  /* 다른 모듈에서 사용 */
  APP.loadData                   = loadData;
  APP.renderCards                = renderCards;
  APP.saveData                   = saveData;
  APP.highlightDispatchChip      = highlightDispatchChip;
  APP.clearDispatchChipHighlight = clearDispatchChipHighlight;
  APP.updateParkingOverlay       = updateParkingOverlay;

  /* 행 목록 로드 */
  await loadRowsFromDB();

  /* 초기 상태 — 빈 그리드 (loadData에서 실제 데이터 로드) */
  if (!APP.parkingState) {
    APP.parkingState = buildEmptyState();
  }

  const datePicker = document.getElementById('datePicker');
  /* 날짜 표시 버튼 클릭 → datePicker 열기 */
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');
  const todayBtn   = document.getElementById('todayBtn');

  /* ── 날짜 변경 공통 헬퍼 ── */
  function changeDate(s) {
    clearTapState();
    datePicker.value = s;
    loadData(s);
    if (APP.getTeamByDate) APP.getTeamByDate(s); /* 팀 표시 + pill 색상 모두 처리 */
    updateDayLabel(s);
    if (APP.loadDispatchForDate) APP.loadDispatchForDate(s);
  }

  /* 날짜 변경 */
  datePicker.addEventListener('change', () => changeDate(datePicker.value));

  prevDayBtn.addEventListener('click', () => {
    const d = new Date(datePicker.value);
    d.setDate(d.getDate() - 1);
    changeDate(d.toISOString().split('T')[0]);
  });

  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      const d = new Date(datePicker.value);
      d.setDate(d.getDate() + 1);
      changeDate(d.toISOString().split('T')[0]);
    });
  }

  todayBtn.addEventListener('click', () => changeDate(getTodayStr()));

  /* ── 차량 패널 이벤트 ── */
  /* ── 차량·행 버튼: 클릭마다 차량모드 → 행모드 → 종료 순환 ── */
  const currentVehicleBtn = document.getElementById('currentVehicleBtn');
  let vehicleRowState = 0;
  if (currentVehicleBtn) {
    currentVehicleBtn.addEventListener('click', () => {
      vehicleRowState = (vehicleRowState + 1) % 3;
      if (vehicleRowState === 0) {
        toggleVehicleEditMode(false);
        toggleRowEditMode(false);
        currentVehicleBtn.classList.remove('active');
      } else if (vehicleRowState === 1) {
        toggleRowEditMode(false);
        toggleVehicleEditMode(true);
        currentVehicleBtn.classList.add('active');
      } else {
        toggleVehicleEditMode(false);
        toggleRowEditMode(true);
        currentVehicleBtn.classList.add('active');
      }
    });
  }

  /* ── 차량 수정 완료 버튼 ── */
  const vehicleEditDoneBtn = document.getElementById('vehicleEditDoneBtn');
  if (vehicleEditDoneBtn) vehicleEditDoneBtn.addEventListener('click', () => {
    vehicleRowState = 0;
    if (currentVehicleBtn) currentVehicleBtn.classList.remove('active');
    saveVehicleEditDone();
  });

  /* ── 차량 수정 취소 버튼 ── */
  const vehicleEditCancelBtn = document.getElementById('vehicleEditCancelBtn');
  if (vehicleEditCancelBtn) vehicleEditCancelBtn.addEventListener('click', () => {
    if (vehicleEditSnapshot) {
      APP.currentBusList          = [...vehicleEditSnapshot.busList];
      APP.parkingState.values     = {...vehicleEditSnapshot.values};
      APP.parkingState.active     = {...vehicleEditSnapshot.active};
      vehicleEditSnapshot = null;
    }
    vehicleRowState = 0;
    if (currentVehicleBtn) currentVehicleBtn.classList.remove('active');
    toggleVehicleEditMode(false);
  });

  /* ── 행 수정 완료 버튼 ── */
  const rowEditDoneBtn = document.getElementById('rowEditDoneBtn');
  if (rowEditDoneBtn) rowEditDoneBtn.addEventListener('click', () => {
    vehicleRowState = 0;
    if (currentVehicleBtn) currentVehicleBtn.classList.remove('active');
    rowEditSnapshot = null;
    saveRowsToDB();
    saveData();
    toggleRowEditMode(false);
  });

  /* ── 행 수정 취소 버튼 ── */
  const rowEditCancelBtn = document.getElementById('rowEditCancelBtn');
  if (rowEditCancelBtn) rowEditCancelBtn.addEventListener('click', () => {
    if (rowEditSnapshot) {
      APP.rowLabels               = [...rowEditSnapshot.rowLabels];
      APP.rowCount                = rowEditSnapshot.rowCount;
      APP.parkingState.values     = {...rowEditSnapshot.values};
      APP.parkingState.active     = {...rowEditSnapshot.active};
      rowEditSnapshot = null;
    }
    vehicleRowState = 0;
    if (currentVehicleBtn) currentVehicleBtn.classList.remove('active');
    toggleRowEditMode(false);
  });

  /* ── 초기 데이터 로드 ── */
  const todayStr = getTodayStr();
  datePicker.value = todayStr;
  if (APP.getTeamByDate) APP.getTeamByDate(todayStr); /* 팀 표시 + pill 색상 */
  updateDayLabel(todayStr);
  renderGrid();
  await loadData(todayStr);

  /* ── 날짜선택 탭 버튼 → datePicker 열기 ── */
  const datePickerBtn = document.getElementById('datePickerBtn');
  if (datePickerBtn) {
    datePickerBtn.addEventListener('click', () => {
      datePicker.showPicker ? datePicker.showPicker() : datePicker.click();
    });
  }


  /* ── 수동 / 오토 불러오기 버튼 ── */
  const manualLoadBtn = document.getElementById('manualLoadBtn');
  if (manualLoadBtn) {
    manualLoadBtn.addEventListener('click', () => {
      const date = currentDate();
      if (!manualGridCache[date]) return;
      showConfirm('수동으로 만든 주차 배치를\n현재 그리드에 적용할까요?', () => {
        const g = manualGridCache[date];
        const values = { ...g.values };
        const active  = { ...g.active };
        /* 제외 차량 제거 */
        const exSet = dispatchState.excludedAbsent?.[date];
        if (exSet && exSet.size > 0) {
          const RC = APP.rowCount || 6;
          for (let i = 0; i < RC * 3; i++) {
            if (exSet.has(values[i])) { values[i] = ''; active[i] = false; }
          }
        }
        APP.parkingState = { values, active };
        renderCards();
        saveData();
      });
    });
  }

  const autoLoadBtn = document.getElementById('autoLoadBtn');
  if (autoLoadBtn) {
    autoLoadBtn.addEventListener('click', () => {
      const date = currentDate();
      if (!autoGridCache[date]) return;
      showConfirm('Auto Park로 만든 주차 배치를\n현재 그리드에 적용할까요?', () => {
        const g = autoGridCache[date];
        const values = { ...g.values };
        const active  = { ...g.active };
        /* 제외 차량 제거 */
        const exSet = dispatchState.excludedAbsent?.[date];
        if (exSet && exSet.size > 0) {
          const RC = APP.rowCount || 6;
          for (let i = 0; i < RC * 3; i++) {
            if (exSet.has(values[i])) { values[i] = ''; active[i] = false; }
          }
        }
        APP.parkingState = { values, active };
        renderCards();
        saveData();
      });
    });
  }

  /* 백그라운드 자동 데이터 정리 제거 — 수동(데이터 정리 버튼)으로만 운영 */

  /* 화면 크기 변경 시 날짜 포맷 갱신 (가로/세로 회전, 리사이즈) */
  const _onResize = () => {
    const cur = datePicker.value || getTodayStr();
    updateDayLabel(cur);
  };
  window.addEventListener('resize', _onResize, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(_onResize, 200), { passive: true });

  /* ── 복사 버튼 ── */
  const copyGridBtn = document.getElementById('copyGridBtn');
  if (copyGridBtn) copyGridBtn.addEventListener('click', copyParkingGrid);
}

/* ── 주차 그리드 복사 ── */
function copyParkingGrid() {
  const dateStr = document.getElementById('datePicker')?.value || '';
  const rows    = APP.rowLabels || ['2R','3R','4R','5R','6R','7R'];
  const values  = APP.parkingState?.values || {};

  // 날짜 포맷: MM.DD
  let dateFmt = '';
  if (dateStr) {
    const [,mo,dd] = dateStr.split('-');
    dateFmt = mo + '.' + dd;
  }

  // 팀: A조 / B조
  const team = dateStr ? getEveningShiftTeamForDate(dateStr) : '';
  const teamFmt = team ? team + '조' : '';

  // 헤더
  const headerLine1 = '🅿️ 마감 주차';
  const headerLine2 = dateFmt || teamFmt
    ? '【' + [dateFmt, teamFmt].filter(Boolean).join('｜') + '】'
    : '';

  // 각 행: 있는 차량만 · 로 연결, ▶ 접두사
  const lines = rows.map((label, ri) => {
    const cars = [0,1,2]
      .map(col => values[ri*3+col])
      .filter(v => v);
    return cars.length ? '▶ ' + cars.join(' · ') : null;
  }).filter(line => line !== null);

  const parts = [headerLine1];
  if (headerLine2) parts.push(headerLine2);
  parts.push(''); // 헤더와 행 사이 빈 줄
  parts.push(...lines);
  const text = parts.join('\n');

  navigator.clipboard.writeText(text)
    .then(() => {
      let toast = document.getElementById('copyToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'copyToast';
        toast.style.cssText = [
          'position:fixed','bottom:calc(80px + env(safe-area-inset-bottom))',
          'left:50%','transform:translateX(-50%)',
          'background:rgba(30,30,30,0.92)','color:#fff',
          'padding:10px 20px','border-radius:20px',
          'font-size:14px','font-weight:700',
          'z-index:9999','pointer-events:none',
          'backdrop-filter:blur(8px)',
          'box-shadow:0 2px 12px rgba(0,0,0,0.3)',
          'white-space:nowrap',
        ].join(';');
        document.body.appendChild(toast);
      }
      toast.textContent = '✅ 주차도 복사됨';
      toast.style.opacity = '1';
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    })
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      alert('복사됨!');
    });
}
