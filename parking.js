/* ============================================================
   parking.js — 주차도 그리드 / 차량 목록 / 드래그 로직
   ============================================================ */
'use strict';

/* ── 오늘 날짜 문자열 (YYYY-MM-DD) ──────────────────── */
function getTodayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

/* ── Firebase 에서 차량 목록 로드 ─────────────────────── */
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
    APP.currentBusList = [...DEFAULT];
  }
}

/* ── Firebase 에 차량 목록 저장 ───────────────────────── */
async function saveBusListToDB() {
  try {
    await APP.set(APP.ref(APP.db, 'busList'), APP.currentBusList);
  } catch (err) {
    console.error('busList 저장 실패:', err);
  }
}

/* ── select 옵션 갱신 (이미 배정된 차량은 다른 셀에서 숨김) ── */
function refreshOptions(selects) {
  const used = [...selects].map(s => s.value).filter(v => v);
  selects.forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value=""></option>';
    APP.currentBusList.forEach(num => {
      if (!used.includes(num) || num === cur) {
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = num;
        if (num === cur) opt.selected = true;
        sel.appendChild(opt);
      }
    });
  });
}

/* ── 차량 목록 패널 렌더링 ────────────────────────────── */
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
        <span class="vehicle-item-drag-handle">⋮⋮</span>
        <span class="vehicle-item-number">${bus}</span>
      </div>
      <button class="vehicle-item-delete" aria-label="${bus} 삭제">−</button>`;

    /* 삭제 */
    item.querySelector('.vehicle-item-delete').addEventListener('click', () => {
      if (!confirm(`${bus} 차량번호를 삭제하시겠습니까?`)) return;
      APP.currentBusList.splice(APP.currentBusList.indexOf(bus), 1);
      saveBusListToDB();
      renderVehicleList();
      refreshOptions(document.querySelectorAll('.cell select'));
    });

    /* PC 드래그 */
    item.addEventListener('dragstart', () => {
      APP.draggedItem = item;
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!APP.draggedItem || APP.draggedItem === item) return;
      const all = Array.from(container.querySelectorAll('.vehicle-item'));
      const di  = all.indexOf(APP.draggedItem);
      const ti  = all.indexOf(item);
      item.parentNode.insertBefore(APP.draggedItem, di < ti ? item.nextSibling : item);
    });
    item.addEventListener('drop', e => e.preventDefault());

/* 모바일 터치 드래그 */

let touchStartY = 0;
let pressTimer = null;
let isDragging = false;

item.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;

  pressTimer = setTimeout(() => {
    APP.draggedItem = item;
    item.classList.add('dragging');
    isDragging = true;
  }, 1500); // 1.5초 길게 터치해야 드래그 시작

}, { passive: true });


item.addEventListener('touchmove', e => {

  if (!isDragging) return; // 드래그 아닐때는 스크롤 허용

  e.preventDefault();

  const y = e.touches[0].clientY;
  const all = Array.from(container.querySelectorAll('.vehicle-item'));

  all.forEach(el => {
    const rect = el.getBoundingClientRect();

    if (y > rect.top && y < rect.bottom && el !== item) {
      el.parentNode.insertBefore(
        item,
        y > (rect.top + rect.height / 2) ? el.nextSibling : el
      );
    }

  });

}, { passive: false });


item.addEventListener('touchend', () => {

  clearTimeout(pressTimer);

  if (isDragging) {

    item.classList.remove('dragging');

    APP.currentBusList = Array.from(
      container.querySelectorAll('.vehicle-item-number')
    ).map(el => el.textContent.trim());

    saveBusListToDB();

  }

  isDragging = false;
  APP.draggedItem = null;

});


container.appendChild(item);
});

  /* PC 드래그 종료 후 순서 저장 */
  container.addEventListener('dragend', () => {
    APP.currentBusList = Array.from(container.querySelectorAll('.vehicle-item-number'))
      .map(el => el.textContent.trim());
    saveBusListToDB();
  });
}

/* ── 주차도 초기화 ────────────────────────────────────── */
async function initParking() {
  const selects    = document.querySelectorAll('.cell select');
  const cells      = document.querySelectorAll('.cell');
  const wrappers   = document.querySelectorAll('.cells-wrapper');
  const datePicker = document.getElementById('datePicker');
  const prevDayBtn = document.getElementById('prevDayBtn');
  const todayBtn   = document.getElementById('todayBtn');

  /* ── Firebase 에서 주차 데이터 로드 ── */
  async function loadData(date) {
    if (!date) return;

    /* 옵션 초기화 */
    selects.forEach(s => {
      s.innerHTML = '<option value=""></option>';
      APP.currentBusList.forEach(num => {
        const opt = document.createElement('option');
        opt.value = num; opt.textContent = num;
        s.appendChild(opt);
      });
      s.value = '';
    });
    cells.forEach(c => c.classList.remove('active'));
    wrappers.forEach(w => (w.style.transform = 'translateX(0px)'));

    const snap = await APP.get(APP.ref(APP.db, 'parking/' + date));
    const data  = snap.val();
    if (data) {
      const vals = data.values ? Object.values(data.values) : [];
      selects.forEach((s, i) => (s.value = vals[i] || ''));
      cells.forEach((c, i)   => c.classList.toggle('active', !!data.active?.[i]));
      wrappers.forEach((w, i) => (w.style.transform = `translateX(${data.drag?.[i] || 0}px)`));
    }
    refreshOptions(selects);
  }

  /* ── Firebase 에 주차 데이터 저장 ── */
  function saveData() {
    if (!APP.isAdmin) return;
    const date = datePicker.value;
    if (!date) return;

    const values = {}, active = {}, drag = {};
    selects.forEach((s, i)  => (values[i] = s.value));
    cells.forEach((c, i)    => (active[i] = c.classList.contains('active')));
    wrappers.forEach((w, i) => {
      const m  = w.style.transform.match(/-?\d+/);
      drag[i]  = m ? parseInt(m[0]) : 0;
    });
    APP.set(APP.ref(APP.db, 'parking/' + date), { values, active, drag });
  }

  /* 다른 모듈에서 날짜 변경 시 사용 */
  APP.loadData = loadData;

  /* ── 이벤트 바인딩 ── */
  selects.forEach(s => s.addEventListener('change', () => {
    if (APP.isAdmin) { refreshOptions(selects); saveData(); }
  }));

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

  todayBtn.addEventListener('click', () => {
    const s = getTodayStr();
    datePicker.value = s;
    loadData(s);
    document.getElementById('teamLabel').textContent = APP.getTeamByDate(s);
  });

  /* ── 셀 롱프레스 → 활성(노란색) 토글 ── */
  cells.forEach(cell => {
    let timer;
    const startPress = () => {
      timer = setTimeout(() => {
        if (!APP.isAdmin) return;
        cell.classList.toggle('active');
        saveData();
      }, 600);
    };
    const endPress = () => clearTimeout(timer);
    cell.addEventListener('pointerdown',  startPress);
    cell.addEventListener('pointerup',    endPress);
    cell.addEventListener('pointerleave', endPress);
    cell.addEventListener('pointercancel',endPress);
  });

  /* ── 셀 래퍼 드래그 (오프셋 표시) ── */
  wrappers.forEach(wrapper => {
    let startX = 0, isDragging = false;

    wrapper.addEventListener('pointerdown', e => {
      if (!APP.isAdmin || e.target.tagName === 'SELECT') return;
      isDragging = true;
      startX = e.clientX - (parseInt(wrapper.style.transform.replace(/[^\d\-]/g, '')) || 0);
      wrapper.setPointerCapture(e.pointerId);
    });
    wrapper.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(18, e.clientX - startX));
      wrapper.style.transform = `translateX(${x}px)`;
    });
    wrapper.addEventListener('pointerup', e => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.releasePointerCapture(e.pointerId);
      saveData();
    });
    wrapper.addEventListener('pointercancel', () => (isDragging = false));
  });

  /* ── 차량 패널 이벤트 ── */
  const vehiclePanel         = document.getElementById('vehiclePanel');
  const currentVehicleBtn    = document.getElementById('currentVehicleBtn');
  const vehiclePanelCloseBtn = document.getElementById('vehiclePanelCloseBtn');
  const vehicleAddBtn        = document.getElementById('vehicleAddBtn');
  const vehicleAddInputCont  = document.getElementById('vehicleAddInputContainer');
  const vehicleAddInput      = document.getElementById('vehicleAddInput');
  const vehicleAddConfirmBtn = document.getElementById('vehicleAddConfirmBtn');
  const vehicleAddCancelBtn  = document.getElementById('vehicleAddCancelBtn');

  currentVehicleBtn.addEventListener('click', () => {
    const show = vehiclePanel.style.display !== 'block';
    vehiclePanel.style.display = show ? 'block' : 'none';
    currentVehicleBtn.classList.toggle('active', show);
  });
  vehiclePanelCloseBtn.addEventListener('click', () => {
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
    if (!num)                           { alert('차량번호를 입력해주세요.'); return; }
    if (APP.currentBusList.includes(num)) { alert('이미 존재하는 차량번호입니다.'); return; }
    APP.currentBusList.push(num);
    saveBusListToDB();
    renderVehicleList();
    refreshOptions(selects);
    vehicleAddInput.value             = '';
    vehicleAddBtn.style.display       = 'block';
    vehicleAddInputCont.style.display = 'none';
  };
  vehicleAddConfirmBtn.addEventListener('click', confirmAdd);
  vehicleAddInput.addEventListener('keypress', e => { if (e.key === 'Enter') confirmAdd(); });

  vehicleAddCancelBtn.addEventListener('click', () => {
    vehicleAddInput.value             = '';
    vehicleAddBtn.style.display       = 'block';
    vehicleAddInputCont.style.display = 'none';
  });

  /* ── 초기 데이터 로드 ── */
  renderVehicleList();
  refreshOptions(selects);

  const todayStr = getTodayStr();
  datePicker.value = todayStr;
  document.getElementById('teamLabel').textContent = APP.getTeamByDate(todayStr);
  await loadData(todayStr);

  APP.applyPermissionUI();
}
