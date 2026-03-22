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
  const DAYS = ["일","월","화","수","목","금","토"];
  const d   = new Date(dateStr + "T00:00:00");
  const day = DAYS[d.getDay()];
  const btn = document.getElementById("dateDisplayBtn");
  if (btn) btn.textContent = dateStr + " (" + day + ")";
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
function buildDefaultState() {
  const values = {}, active = {};
  const SLOTS = 18;
  for (let i = 0; i < SLOTS; i++) {
    values[i] = APP.currentBusList[i] || '';
    active[i] = false;
  }
  return { values, active };
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
  for (let rowIdx = 0; rowIdx < 6; rowIdx++) {
    const wrap = document.getElementById(`row-${rowIdx}`);
    if (!wrap) continue;
    wrap.innerHTML = '';

    for (let col = 0; col < 3; col++) {
      const slotIdx = rowIdx * 3 + col;
      const vehicle = APP.parkingState.values[slotIdx] || '';
      const isRest  = APP.parkingState.active[slotIdx] || false;

      const card = document.createElement('div');
      card.dataset.slot = slotIdx;

      if (!vehicle) {
        card.className = 'slot-card empty';
        setupEmptyCardDrop(card, slotIdx); /* 항상 설정, 내부에서 admin 체크 */
      } else {
        card.className = `slot-card ${isRest ? 'rest' : 'run'}`;
        card.textContent = vehicle;
        if (APP.isAdmin) setupCardEvents(card, slotIdx);
      }

      wrap.appendChild(card);
    }
  }
}

/* ── Firebase에 주차 데이터 저장 ────────────────────────── */
function saveData() {
  if (!APP.isAdmin) return;
  const date = document.getElementById('datePicker').value;
  if (!date) return;
  APP.set(APP.ref(APP.db, 'parking/' + date), {
    values: APP.parkingState.values,
    active: APP.parkingState.active
  });
}

/* ── Firebase에서 주차 데이터 로드 ─────────────────────── */
async function loadData(date) {
  if (!date) return;
  const snap = await APP.get(APP.ref(APP.db, 'parking/' + date));
  const data = snap.val();

  if (data && data.values) {
    /* 저장된 데이터 불러오기 */
    APP.parkingState = {
      values: data.values || {},
      active: data.active || {}
    };
  } else {
    /* 저장된 데이터 없으면 기본 상태 (차량 목록 순서대로, 전부 운행) */
    APP.parkingState = buildDefaultState();
  }

  /* 날짜 이동 시 해당 날짜 Undo/Redo 버튼 상태 동기화 */
  syncHistoryBtns(date);
  renderCards();
}

/* ── 차량 목록 패널 렌더링 ──────────────────────────────── */
function renderVehicleList() {
  const container = document.getElementById('vehicleListContainer');
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
      <button class="vehicle-item-delete" aria-label="${bus} 삭제">&#8722;</button>`;

    /* 삭제 */
    item.querySelector('.vehicle-item-delete').addEventListener('click', () => {
      if (!confirm(`${bus} 차량번호를 삭제하시겠습니까?`)) return;
      APP.currentBusList.splice(idx, 1);
      saveBusListToDB();

      /* 주차 슬롯에서도 즉시 제거 */
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
    item.addEventListener('dragstart', () => {
      APP.draggedItem = item;
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!APP.draggedItem || APP.draggedItem === item) return;
      const all = Array.from(container.querySelectorAll('.vehicle-item'));
      const di = all.indexOf(APP.draggedItem), ti = all.indexOf(item);
      item.parentNode.insertBefore(APP.draggedItem, di < ti ? item.nextSibling : item);
    });
    item.addEventListener('drop', e => e.preventDefault());

    /* 모바일 터치 드래그 */
    let vTouchY = 0, vTimer = null, vDragging = false;

    item.addEventListener('touchstart', e => {
      vTouchY = e.touches[0].clientY;
      vTimer = setTimeout(() => {
        APP.draggedItem = item;
        item.classList.add('dragging');
        vDragging = true;
        if (navigator.vibrate) navigator.vibrate(25);
      }, 400);
    }, { passive: true });

    item.addEventListener('touchmove', e => {
      if (!vDragging) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      const all = Array.from(container.querySelectorAll('.vehicle-item'));
      all.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (y > rect.top && y < rect.bottom && el !== item) {
          el.parentNode.insertBefore(item, y > rect.top + rect.height / 2 ? el.nextSibling : el);
        }
      });
    }, { passive: false });

    item.addEventListener('touchend', () => {
      clearTimeout(vTimer);
      if (vDragging) {
        item.classList.remove('dragging');
        APP.currentBusList = Array.from(
          container.querySelectorAll('.vehicle-item-number')
        ).map(el => el.textContent.trim());
        saveBusListToDB();
        loadData(document.getElementById('datePicker').value);
      }
      vDragging = false;
      APP.draggedItem = null;
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
  /* 앱 접속 시 1달(31일) 이상 지난 주차 데이터 자동 삭제 */
  try {
    const snap = await APP.get(APP.ref(APP.db, 'parking'));
    if (!snap.exists()) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31);
    const cutoffStr = cutoff.toISOString().split('T')[0]; /* YYYY-MM-DD */

    const deletions = [];
    snap.forEach(child => {
      if (child.key < cutoffStr) {
        deletions.push(APP.set(APP.ref(APP.db, 'parking/' + child.key), null));
      }
    });

    if (deletions.length > 0) {
      await Promise.all(deletions);
      console.log(`🗑️ 오래된 주차 데이터 ${deletions.length}건 삭제 완료`);
    }
  } catch (err) {
    console.error('오래된 데이터 삭제 실패:', err);
  }
}

async function initParking() {
  /* 다른 모듈에서 사용 */
  APP.loadData    = loadData;
  APP.renderCards = renderCards;
  APP.saveData    = saveData;

  /* 초기 상태 */
  if (!APP.parkingState) {
    APP.parkingState = buildDefaultState();
  }

  const datePicker = document.getElementById('datePicker');
  /* 날짜 표시 버튼 클릭 → datePicker 열기 */
  const dateDisplayBtn = document.getElementById('dateDisplayBtn');
  if (dateDisplayBtn) dateDisplayBtn.addEventListener('click', () => datePicker.showPicker?.() || datePicker.click());
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');
  const todayBtn   = document.getElementById('todayBtn');

  /* 날짜 변경 */
  datePicker.addEventListener('change', () => {
    loadData(datePicker.value);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(datePicker.value);
    updateDayLabel(datePicker.value);
  });

  prevDayBtn.addEventListener('click', () => {
    const d = new Date(datePicker.value);
    d.setDate(d.getDate() - 1);
    const s = d.toISOString().split('T')[0];
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
    updateDayLabel(s);
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
    });
  }

  todayBtn.addEventListener('click', () => {
    const s = getTodayStr();
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
    updateDayLabel(s);
  });

  /* ── 차량 패널 이벤트 ── */
  const vehiclePanel        = document.getElementById('vehiclePanel');
  const currentVehicleBtn   = document.getElementById('currentVehicleBtn');
  const vehiclePanelClose   = document.getElementById('vehiclePanelCloseBtn');
  const vehicleAddBtn       = document.getElementById('vehicleAddBtn');
  const vehicleAddInputCont = document.getElementById('vehicleAddInputContainer');
  const vehicleAddInput     = document.getElementById('vehicleAddInput');
  const vehicleAddConfirmBtn = document.getElementById('vehicleAddConfirmBtn');
  const vehicleAddCancelBtn  = document.getElementById('vehicleAddCancelBtn');

  currentVehicleBtn.addEventListener('click', () => {
    const show = vehiclePanel.style.display !== 'block';
    vehiclePanel.style.display = show ? 'block' : 'none';
    currentVehicleBtn.classList.toggle('active', show);
  });

  vehiclePanelClose.addEventListener('click', () => {
    vehiclePanel.style.display = 'none';
    currentVehicleBtn.classList.remove('active');
  });

  vehicleAddBtn.addEventListener('click', () => {
    vehicleAddBtn.style.display    = 'none';
    vehicleAddInputCont.style.display = 'flex';
    vehicleAddInput.focus();
  });

  const confirmAdd = () => {
    const num = vehicleAddInput.value.trim();
    if (!num) { alert('차량번호를 입력해주세요.'); return; }
    if (APP.currentBusList.includes(num)) { alert('이미 존재하는 차량번호입니다.'); return; }
    APP.currentBusList.push(num);
    saveBusListToDB();
    renderVehicleList();
    loadData(datePicker.value);
    vehicleAddInput.value = '';
    vehicleAddBtn.style.display       = 'block';
    vehicleAddInputCont.style.display = 'none';
  };

  vehicleAddConfirmBtn.addEventListener('click', confirmAdd);
  vehicleAddInput.addEventListener('keypress', e => { if (e.key === 'Enter') confirmAdd(); });

  vehicleAddCancelBtn.addEventListener('click', () => {
    vehicleAddInput.value = '';
    vehicleAddBtn.style.display       = 'block';
    vehicleAddInputCont.style.display = 'none';
  });

  /* ── 초기 데이터 로드 ── */
  renderVehicleList();

  const todayStr = getTodayStr();
  datePicker.value = todayStr;
  document.getElementById('teamLabel').textContent = APP.getTeamByDate(todayStr);
    updateDayLabel(todayStr);
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
