/* ============================================================
   parking.js — 카드 기반 주차도 그리드 / 드래그앤드롭 v2.1
   ============================================================ */
'use strict';

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ──────────────────────── */
function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
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
let touchDragSlot  = null;   // 모바일 드래그 소스 슬롯 인덱스
let touchTimer     = null;   // 롱프레스 타이머
let isTouchDrag    = false;  // 모바일 드래그 진행 중 여부

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
}

/* ── 슬롯 상태 토글 (운행 ↔ 휴차) ─────────────────────── */
function toggleCardState(slotIdx) {
  if (!APP.isAdmin) return;
  if (!APP.parkingState.values[slotIdx]) return; // 빈 슬롯 무시
  APP.parkingState.active[slotIdx] = !APP.parkingState.active[slotIdx];
  renderCards();
  saveData();
}

/* ── 카드 터치/드래그 이벤트 설정 ──────────────────────── */
function setupCardEvents(card, slotIdx) {
  /* ── PC: Drag & Drop ── */
  card.draggable = true;

  card.addEventListener('dragstart', e => {
    dragSrcSlot = slotIdx;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => card.classList.add('dragging'), 0);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('drag-over'));
    dragSrcSlot = null;
  });

  card.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });

  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

  card.addEventListener('drop', e => {
    e.preventDefault();
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('drag-over'));
    if (dragSrcSlot !== null && dragSrcSlot !== slotIdx) {
      swapSlots(dragSrcSlot, slotIdx);
    }
  });

  /* ── PC: 클릭 = 운행/휴차 토글 ── */
  let clickFromDrag = false;
  card.addEventListener('mousedown', () => { clickFromDrag = false; });
  card.addEventListener('mousemove', () => { clickFromDrag = true; });
  card.addEventListener('click', () => {
    if (!clickFromDrag) toggleCardState(slotIdx);
  });

  /* ── 모바일: 터치 드래그 + 탭 ── */
  let startX, startY, touchMoved = false;

  card.addEventListener('touchstart', e => {
    startX    = e.touches[0].clientX;
    startY    = e.touches[0].clientY;
    touchMoved = false;
    isTouchDrag = false;

    touchTimer = setTimeout(() => {
      isTouchDrag   = true;
      touchDragSlot = slotIdx;
      card.classList.add('dragging');

      /* 고스트 표시 */
      const isRest = APP.parkingState.active[slotIdx];
      ghost.textContent = APP.parkingState.values[slotIdx] || '';
      ghost.className = `drag-ghost ${isRest ? 'rest' : 'run'}`;
      ghost.style.left = (startX - 29) + 'px';
      ghost.style.top  = (startY - 29) + 'px';
      ghost.style.display = 'flex';

      /* 햅틱 피드백 (지원 기기) */
      if (navigator.vibrate) navigator.vibrate(35);
    }, 480);
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    /* 드래그 시작 전 이동이 크면 타이머 취소 (스크롤 허용) */
    if (!isTouchDrag) {
      if (Math.abs(dx) > 9 || Math.abs(dy) > 9) {
        clearTimeout(touchTimer);
        touchMoved = true;
      }
      return;
    }

    e.preventDefault(); /* 드래그 중 스크롤 방지 */

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    /* 고스트 이동 */
    ghost.style.left = (x - 29) + 'px';
    ghost.style.top  = (y - 29) + 'px';

    /* 드롭 대상 강조 */
    ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    ghost.style.display = 'flex';

    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('drag-over'));
    const targetCard = el?.closest('[data-slot]');
    if (targetCard && parseInt(targetCard.dataset.slot) !== touchDragSlot) {
      targetCard.classList.add('drag-over');
    }
  }, { passive: false });

  card.addEventListener('touchend', e => {
    clearTimeout(touchTimer);
    ghost.style.display = 'none';
    document.querySelectorAll('.slot-card').forEach(c =>
      c.classList.remove('drag-over', 'dragging')
    );

    if (isTouchDrag) {
      /* 드롭: 타겟 슬롯 찾기 */
      const x = e.changedTouches[0].clientX;
      const y = e.changedTouches[0].clientY;
      const el = document.elementFromPoint(x, y);
      const targetCard = el?.closest('[data-slot]');

      if (targetCard) {
        const targetSlot = parseInt(targetCard.dataset.slot);
        if (!isNaN(targetSlot) && targetSlot !== touchDragSlot) {
          swapSlots(touchDragSlot, targetSlot);
        }
      }
    } else if (!touchMoved) {
      /* 탭: 운행/휴차 토글 */
      e.preventDefault();
      toggleCardState(slotIdx);
    }

    isTouchDrag   = false;
    touchDragSlot = null;
  }, { passive: false });

  card.addEventListener('touchcancel', () => {
    clearTimeout(touchTimer);
    ghost.style.display = 'none';
    document.querySelectorAll('.slot-card').forEach(c =>
      c.classList.remove('drag-over', 'dragging')
    );
    isTouchDrag   = false;
    touchDragSlot = null;
  });
}

/* ── 빈 슬롯 드롭 이벤트 (항상 설정, admin 모드 체크는 drop 시) ── */
function setupEmptyCardDrop(card, slotIdx) {
  /* PC 드롭 */
  card.addEventListener('dragover', e => {
    if (!APP.isAdmin) return;
    e.preventDefault();
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('drag-over'));
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    if (!APP.isAdmin) return;
    e.preventDefault();
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('drag-over'));
    if (dragSrcSlot !== null && dragSrcSlot !== slotIdx) {
      swapSlots(dragSrcSlot, slotIdx);
    }
  });

  /* 모바일: touchend 시 ghost 숨기고 타겟 체크는 touchend 핸들러에서 처리 */
  card.addEventListener('touchmove', e => {
    if (!isTouchDrag || !APP.isAdmin) return;
    e.preventDefault();
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
  const prevDayBtn = document.getElementById('prevDayBtn');
  const nextDayBtn = document.getElementById('nextDayBtn');
  const todayBtn   = document.getElementById('todayBtn');

  /* 날짜 변경 */
  datePicker.addEventListener('change', () => {
    loadData(datePicker.value);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(datePicker.value);
  });

  prevDayBtn.addEventListener('click', () => {
    const d = new Date(datePicker.value);
    d.setDate(d.getDate() - 1);
    const s = d.toISOString().split('T')[0];
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
  });

  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      const d = new Date(datePicker.value);
      d.setDate(d.getDate() + 1);
      const s = d.toISOString().split('T')[0];
      datePicker.value = s;
      loadData(s);
      document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
    });
  }

  todayBtn.addEventListener('click', () => {
    const s = getTodayStr();
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
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
  await loadData(todayStr);

  APP.applyPermissionUI();
}
