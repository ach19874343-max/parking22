/* ============================================================
   parking.js — 카드 기반 주차도 그리드 / 드래그앤드롭 v2.1
   ============================================================ */
'use strict';

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ──────────────────────── */
function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

/* ── 날짜 문자열로 요일 표시 업데이트 ───────────────────── */
function updateDayLabel(dateStr) {
  const DAYS    = ["일","월","화","수","목","금","토"];
  const DAYS_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const d     = new Date(dateStr + "T00:00:00");
  const mm    = String(d.getMonth() + 1).padStart(2, '0');
  const dd    = String(d.getDate()).padStart(2, '0');
  const day   = DAYS[d.getDay()];
  const dayEn = DAYS_EN[d.getDay()];
  const btn   = document.getElementById("dateDisplayBtn");
  if (!btn) return;
  const mainEl = btn.querySelector('.date-main-text');
  const subEl  = btn.querySelector('.date-sub-text');
  if (mainEl) mainEl.textContent = mm + ' · ' + dd + ' (' + day + ')';
  if (subEl)  subEl.textContent  = d.getFullYear() + ' · ' + dayEn;
  if (!mainEl) btn.textContent = mm + '.' + dd + ' (' + day + ')';
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
let touchDragSlot  = null;   // 모바일 드래그 소스 슬롯 인덱스 (미사용 → 하위호환 유지)
let touchTimer     = null;   // 롱프레스 타이머
let isTouchDrag    = false;  // 모바일 드래그 진행 중 여부 (미사용 → 하위호환 유지)

/* ── 탭-투-스왑 전역 상태 ── */
let tapFirstSlot   = null;   // 첫 번째 탭 슬롯 인덱스 (null 이면 미선택)

/* ── Undo / Redo 스택 (날짜별, 최대 20단계) ── */
const UNDO_LIMIT = 20;
const undoStacks = {};   /* { 'YYYY-MM-DD': [state, ...] } */
const redoStacks = {};   /* { 'YYYY-MM-DD': [state, ...] } */

function currentDate() {
  return document.getElementById('datePicker')?.value || '';
}

function syncHistoryBtns(date) {
  const d    = date || currentDate();
  const undo = document.getElementById('undoBtn');
  const redo = document.getElementById('redoBtn');
  if (undo) undo.disabled = !(undoStacks[d]?.length);
  if (redo) redo.disabled = !(redoStacks[d]?.length);
}

function pushUndo() {
  const date = currentDate();
  if (!date) return;
  if (!undoStacks[date]) undoStacks[date] = [];
  if (!redoStacks[date]) redoStacks[date] = [];
  undoStacks[date].push(JSON.stringify(APP.parkingState));
  if (undoStacks[date].length > UNDO_LIMIT) undoStacks[date].shift();
  /* 새 액션이 생기면 redo 스택 초기화 */
  redoStacks[date] = [];
  syncHistoryBtns(date);
}

function undoAction() {
  const date = currentDate();
  if (!date || !undoStacks[date]?.length) return;
  if (!redoStacks[date]) redoStacks[date] = [];
  /* 현재 상태를 redo 스택에 저장 */
  redoStacks[date].push(JSON.stringify(APP.parkingState));
  const prev = JSON.parse(undoStacks[date].pop());
  APP.parkingState = prev;
  renderCards();
  saveData();
  syncHistoryBtns(date);
}

function redoAction() {
  const date = currentDate();
  if (!date || !redoStacks[date]?.length) return;
  if (!undoStacks[date]) undoStacks[date] = [];
  /* 현재 상태를 undo 스택에 저장 */
  undoStacks[date].push(JSON.stringify(APP.parkingState));
  const next = JSON.parse(redoStacks[date].pop());
  APP.parkingState = next;
  renderCards();
  saveData();
  syncHistoryBtns(date);
}

/* 드래그 고스트 요소 */
const ghost = document.getElementById('dragGhost');

/* ── 슬롯 스왑 ──────────────────────────────────────────── */
function swapSlots(srcIdx, dstIdx) {
  if (srcIdx === dstIdx) return;
  pushUndo();
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
}

/* ── 슬롯 상태 토글 (운행 ↔ 휴차) ─────────────────────── */
function toggleCardState(slotIdx) {
  if (!APP.isAdmin) return;
  if (!APP.parkingState.values[slotIdx]) return; // 빈 슬롯 무시
  pushUndo();
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
      if (tapFirstSlot !== null) {
        const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
        if (prev) prev.classList.remove('tap-selected');
        tapFirstSlot = null;
      }
    }, 500);
  });

  card.addEventListener('mouseup',    () => clearTimeout(mouseTimer));
  card.addEventListener('mouseleave', () => clearTimeout(mouseTimer));

  card.addEventListener('click', () => {
    if (mouseLong) return; /* 롱클릭은 이미 처리됨 */

    if (tapFirstSlot === null) {
      tapFirstSlot = slotIdx;
      card.classList.add('tap-selected');
    } else if (tapFirstSlot === slotIdx) {
      card.classList.remove('tap-selected');
      tapFirstSlot = null;
    } else {
      const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
      if (prev) prev.classList.remove('tap-selected');
      swapSlots(tapFirstSlot, slotIdx);
      tapFirstSlot = null;
    }
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
      if (tapFirstSlot !== null) {
        const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
        if (prev) prev.classList.remove('tap-selected');
        tapFirstSlot = null;
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

    if (tapFirstSlot === null) {
      /* 첫 번째 탭: 이 슬롯을 선택 상태로 표시 */
      tapFirstSlot = slotIdx;
      card.classList.add('tap-selected');
    } else if (tapFirstSlot === slotIdx) {
      /* 같은 슬롯 재탭: 선택 취소 */
      card.classList.remove('tap-selected');
      tapFirstSlot = null;
    } else {
      /* 두 번째 탭: 스왑 실행 */
      const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
      if (prev) prev.classList.remove('tap-selected');
      swapSlots(tapFirstSlot, slotIdx);
      tapFirstSlot = null;
    }
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
    if (!APP.isAdmin) return;
    if (tapFirstSlot === null) return; /* 첫 선택 없으면 무시 */
    if (tapFirstSlot === slotIdx) {
      card.classList.remove('tap-selected');
      tapFirstSlot = null;
      return;
    }
    const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
    if (prev) prev.classList.remove('tap-selected');
    swapSlots(tapFirstSlot, slotIdx);
    tapFirstSlot = null;
  });

  /* ── 모바일: 탭 = 탭-투-스왑 두 번째 대상 ── */
  let emptyTouchMoved = false;
  card.addEventListener('touchstart', () => { emptyTouchMoved = false; }, { passive: true });
  card.addEventListener('touchmove',  () => { emptyTouchMoved = true;  }, { passive: true });
  card.addEventListener('touchend', e => {
    if (!APP.isAdmin || emptyTouchMoved) return;
    if (tapFirstSlot === null) return;
    if (tapFirstSlot === slotIdx) {
      card.classList.remove('tap-selected');
      tapFirstSlot = null;
      return;
    }
    e.preventDefault();
    const prev = document.querySelector(`.slot-card[data-slot="${tapFirstSlot}"]`);
    if (prev) prev.classList.remove('tap-selected');
    swapSlots(tapFirstSlot, slotIdx);
    tapFirstSlot = null;
  }, { passive: false });
}

/* ── 카드 렌더링 ────────────────────────────────────────── */
function renderCards() {
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
          if (APP.isAdmin) setupCardEvents(card, slotIdx);
        }
      }

      wrap.appendChild(card);
    }
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
  if (!APP.isAdmin) return;
  const date = document.getElementById('datePicker').value;
  if (!date) return;
  const now = new Date().toISOString();
  APP.set(APP.ref(APP.db, 'parking/' + date), {
    values: APP.parkingState.values,
    active: APP.parkingState.active,
    lastSaved: now
  }).then(() => {
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
    /* Firebase에 데이터 있음 → savedDates 기록 */
    if (!APP.savedDates) APP.savedDates = new Set();
    APP.savedDates.add(date);
    const values = data.values || {};
    const active = data.active || {};
    /* 추가 행 슬롯 빈칸 보장 */
    const totalSlots = (APP.rowCount || 6) * 3;
    for (let i = 0; i < totalSlots; i++) {
      if (values[i] === undefined) values[i] = '';
      if (active[i] === undefined) active[i] = false;
    }
    /* busList에 있지만 슬롯에 없는 차량 → 하단 빈 슬롯에 채우기 */
    syncMissingVehiclesToSlots(values, active);
    APP.parkingState = { values, active };
  } else {
    /* 저장된 데이터 없으면 기본 상태 */
    APP.parkingState = buildDefaultState();
  }

  /* 날짜 이동 시 해당 날짜 Undo/Redo 버튼 상태 동기화 */
  syncHistoryBtns(date);
  /* 오버레이 상태 업데이트 */
  updateParkingOverlay(date);
  /* 날짜별 마지막 저장 시간 표시 */
  updateLastSavedUI(data?.lastSaved || null);
  renderCards();
}

/* ── 주차 오버레이 표시/숨김 제어 ──────────────────────── */
function updateParkingOverlay(date) {
  const overlay = document.getElementById('parkingOverlay');
  if (!overlay) return;
  const d = date || document.getElementById('datePicker')?.value || '';
  /* savedDates에 있거나 관리자 모드 → hidden(카드 정상)
     없고 게스트 → 오버레이 표시(카드 희미) */
  const hasSaved = APP.savedDates && APP.savedDates.has(d);
  if (hasSaved || APP.isAdmin) {
    overlay.classList.add('hidden');
  } else {
    overlay.classList.remove('hidden');
  }
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

/* ── 주차도 초기화 ──────────────────────────────────────── */
async function cleanOldParkingData() {
  /* 관리자 로그인 시 & 앱 접속 시 — 30일 지난 데이터 자동 삭제 */
  if (!APP.isAdmin) return; /* 관리자만 실행 */
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    let total = 0;

    /* ── 주차 데이터 삭제 ── */
    const snapP = await APP.get(APP.ref(APP.db, 'parking'));
    if (snapP.exists()) {
      const delP = [];
      snapP.forEach(child => {
        if (child.key < cutoffStr) delP.push(APP.set(APP.ref(APP.db, 'parking/' + child.key), null));
      });
      if (delP.length) { await Promise.all(delP); total += delP.length; }
    }

    /* ── 게시판 데이터 삭제 ── */
    const snapB = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
    if (snapB.exists()) {
      const raw  = snapB.val();
      const arr  = Array.isArray(raw) ? raw : Object.values(raw);
      const cutoffISO = cutoff.toISOString();
      const filtered  = arr.filter(p => p && p.time && p.time > cutoffISO);
      if (filtered.length < arr.length) {
        await APP.set(APP.ref(APP.db, 'bulletin/posts'), filtered);
        total += arr.length - filtered.length;
      }
    }

    if (total > 0) console.log(`🗑️ 30일 지난 데이터 ${total}건 삭제 완료`);
  } catch (err) {
    console.error('오래된 데이터 삭제 실패:', err);
  }
}

async function initParking() {
  /* 다른 모듈에서 사용 */
  APP.loadData    = loadData;
  APP.renderCards = renderCards;
  APP.saveData    = saveData;

  /* 행 목록 로드 */
  await loadRowsFromDB();

  /* 초기 상태 */
  if (!APP.parkingState) {
    APP.parkingState = buildDefaultState();
  }

  const datePicker = document.getElementById('datePicker');
  /* 날짜 표시 버튼 클릭 → datePicker 열기 */
  const dateDisplayBtn = document.getElementById('dateDisplayBtn');
  /* iOS Safari 대응: dateDisplayBtn 위에 투명 date input 덮어씌우기 */
  if (dateDisplayBtn) {
    /* 투명 오버레이 input 생성 */
    const iosDateOverlay = document.createElement('input');
    iosDateOverlay.type = 'date';
    iosDateOverlay.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'opacity:0',
      'cursor:pointer',
      'z-index:5',
      'border:none',
      'background:transparent',
      '-webkit-appearance:none',
    ].join(';');
    iosDateOverlay.value = datePicker.value;
    dateDisplayBtn.style.position = 'relative';
    dateDisplayBtn.appendChild(iosDateOverlay);

    /* 오버레이 input 변경 → 실제 datePicker와 동기화 */
    iosDateOverlay.addEventListener('change', (e) => {
      const val = e.target.value;
      if (!val) return;
      datePicker.value = val;
      datePicker.dispatchEvent(new Event('change'));
    });

    /* 기존 click 핸들러도 유지 (Android/PC) */
    dateDisplayBtn.addEventListener('click', (e) => {
      if (e.target === iosDateOverlay) return;
      try { datePicker.showPicker?.(); } catch(e2) {}
    });
  }
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');
  const todayBtn   = document.getElementById('todayBtn');

  /* 날짜 변경 */
  datePicker.addEventListener('change', () => {
    const val = datePicker.value;
    loadData(val);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(val);
    updateDayLabel(val);
    /* 배차 현황 날짜 연동 */
    if (APP.loadDispatchForDate) APP.loadDispatchForDate(val);
  });

  prevDayBtn.addEventListener('click', () => {
    const d = new Date(datePicker.value);
    d.setDate(d.getDate() - 1);
    const s = d.toISOString().split('T')[0];
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
    updateDayLabel(s);
    /* 배차 현황 날짜 연동 */
    if (APP.loadDispatchForDate) APP.loadDispatchForDate(s);
  });

  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      const d = new Date(datePicker.value);
      d.setDate(d.getDate() + 1);
      const s = d.toISOString().split('T')[0];
      datePicker.value = s;
      loadData(s);
      document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
      updateDayLabel(s);
      /* 배차 현황 날짜 연동 */
      if (APP.loadDispatchForDate) APP.loadDispatchForDate(s);
    });
  }

  todayBtn.addEventListener('click', () => {
    const s = getTodayStr();
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
    updateDayLabel(s);
    /* 배차 현황 날짜 연동 */
    if (APP.loadDispatchForDate) APP.loadDispatchForDate(s);
  });

  /* ── 차량 패널 이벤트 ── */
  /* ── 차량·행 버튼: 클릭마다 차량모드 → 행모드 → 종료 순환 ── */
  const currentVehicleBtn = document.getElementById('currentVehicleBtn');
  let vehicleRowState = 0; /* 0=off, 1=차량수정, 2=행수정 */
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

  /* ── 차량 수정 완료 버튼 ── */
  const vehicleEditDoneBtn = document.getElementById('vehicleEditDoneBtn');
  if (vehicleEditDoneBtn) vehicleEditDoneBtn.addEventListener('click', () => {
    vehicleRowState = 0;
    currentVehicleBtn.classList.remove('active');
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
    currentVehicleBtn.classList.remove('active');
    toggleVehicleEditMode(false);
  });

  /* ── 행 수정 완료 버튼 ── */
  const rowEditDoneBtn = document.getElementById('rowEditDoneBtn');
  if (rowEditDoneBtn) rowEditDoneBtn.addEventListener('click', () => {
    vehicleRowState = 0;
    currentVehicleBtn.classList.remove('active');
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
    currentVehicleBtn.classList.remove('active');
    toggleRowEditMode(false);
  });

  /* ── 초기 데이터 로드 ── */
  const todayStr = getTodayStr();
  datePicker.value = todayStr;
  document.getElementById('teamLabel').textContent = APP.getTeamByDate(todayStr);
    updateDayLabel(todayStr);
  renderGrid();
  await loadData(todayStr);

  APP.applyPermissionUI();

  /* ── Undo / Redo 버튼 ── */
  const undoBtn = document.getElementById('undoBtn');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (!APP.isAdmin) return;
      undoAction();
    });
  }

  const redoBtn = document.getElementById('redoBtn');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      if (!APP.isAdmin) return;
      redoAction();
    });
  }

  /* 백그라운드에서 오래된 데이터 정리 (UI 블로킹 없음) */
  cleanOldParkingData();
}
