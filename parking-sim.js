/* ============================================================
   parking-sim.js — 모달 주차 그리드 + 오늘 입차 → 야간 → 내일 출차
   · 입차 순서 차량은 처음엔 칸 비움 → 입차 시 표시
   · 출차 시 칸 비운 뒤 왼쪽으로 이동 애니메이션
   ============================================================ */
'use strict';

(function initParkingSim() {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function findSlotIndexInApp(num) {
    const vals = APP?.parkingState?.values;
    if (!vals) return -1;
    const n = String(num);
    const total = (APP.rowCount || 6) * 3;
    for (let i = 0; i < total; i++) {
      if (String(vals[i] || '') === n) return i;
    }
    return -1;
  }

  function getEntryOrderList() {
    if (typeof getTodayEntryOrder === 'function') return getTodayEntryOrder();
    if (typeof APP?.getTodayEntryOrder === 'function') return APP.getTodayEntryOrder();
    return [];
  }

  function computeBlockedExitSet(vmap, RC) {
    const blockedExitSet = new Set();
    if (typeof dispatchState === 'undefined' || !dispatchState.loaded) return blockedExitSet;
    const tmrRank = APP.parkingState?._tmrRank || {};
    const tmrMissing = new Set(dispatchState.tomorrowMissing || []);
    for (let r = 0; r < RC; r++) {
      for (let c = 1; c < 3; c++) {
        const si = r * 3 + c;
        const v = vmap[si];
        if (!v) continue;
        if (tmrMissing.has(v)) continue;
        const myR = (tmrRank[v] ?? 9999);
        for (let lc = 0; lc < c; lc++) {
          const lv = vmap[r * 3 + lc];
          if (!lv) continue;
          if (tmrMissing.has(lv)) continue;
          const lR = (tmrRank[lv] ?? 9999);
          if (lR > myR) {
            blockedExitSet.add(si);
            break;
          }
        }
      }
    }
    return blockedExitSet;
  }

  /** 오늘 입차 순서에 오는 차만 칸 비움(휴차 등 나머지는 그대로) */
  function buildInitialSimState(entryOrder) {
    const RC = APP.rowCount || 6;
    const total = RC * 3;
    const entrySet = new Set(entryOrder.map(n => String(n)));
    const simValues = {};
    const simActive = {};
    const srcV = APP.parkingState.values;
    const srcA = APP.parkingState.active;
    for (let i = 0; i < total; i++) {
      const raw = srcV[i];
      const v = raw !== undefined && raw !== null && raw !== '' ? String(raw) : '';
      simActive[i] = !!srcA[i];
      if (v && entrySet.has(v)) {
        simValues[i] = '';
      } else {
        simValues[i] = v;
      }
    }
    return { simValues, simActive };
  }

  function renderSimModalGrid(gridEl, simValues, simActive) {
    if (!gridEl) return;
    const RC = APP.rowCount || 0;
    const labels = APP.rowLabels || [];
    const blockedExitSet = computeBlockedExitSet(simValues, RC);
    const tmrRank = APP.parkingState?._tmrRank;

    gridEl.innerHTML = '';
    for (let rowIdx = 0; rowIdx < RC; rowIdx++) {
      const row = document.createElement('div');
      row.className = 'p-row';

      const labelEl = document.createElement('div');
      labelEl.className = 'line-label';
      labelEl.textContent = labels[rowIdx] || '';

      const slots = document.createElement('div');
      slots.className = 'slots-wrap';
      slots.id = 'parking-sim-row-' + rowIdx;

      for (let col = 0; col < 3; col++) {
        const slotIdx = rowIdx * 3 + col;
        const vehicle = simValues[slotIdx] || '';
        const isRest = simActive[slotIdx] || false;

        const card = document.createElement('div');
        card.dataset.slot = String(slotIdx);

        if (!vehicle) {
          card.className = 'slot-card empty';
        } else {
          const isBlockedExit = blockedExitSet.has(slotIdx);
          card.className =
            'slot-card ' + (isRest ? 'rest' : 'run') + (isBlockedExit ? ' blocked-exit' : '');
          card.textContent = vehicle;
          if (tmrRank && tmrRank[vehicle] !== undefined) {
            const b = document.createElement('span');
            b.className = 'exit-rank-badge';
            b.textContent = String(tmrRank[vehicle] + 1);
            card.style.position = 'relative';
            card.appendChild(b);
          }
        }
        slots.appendChild(card);
      }
      row.appendChild(labelEl);
      row.appendChild(slots);
      gridEl.appendChild(row);
    }
  }

  function simSlotCard(slotIdx) {
    return document.querySelector('#parkingSimModalGrid .slot-card[data-slot="' + slotIdx + '"]');
  }

  let simAbort = false;

  function ensureOverlay() {
    let el = document.getElementById('parkingSimOverlay');
    if (el && el.querySelector('#parkingSimModalGrid')) return el;
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'parkingSimOverlay';
    el.className = 'parking-sim-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', '입출차 시뮬레이션');
    el.innerHTML =
      '<div class="parking-sim-backdrop"></div>' +
      '<div class="parking-sim-modal-shell">' +
      '  <div class="parking-sim-modal-head">' +
      '    <div class="parking-sim-hud">' +
      '      <div class="parking-sim-title">입·출차 시뮬</div>' +
      '      <div class="parking-sim-phase"></div>' +
      '    </div>' +
      '    <button type="button" class="parking-sim-close" aria-label="닫기">✕</button>' +
      '  </div>' +
      '  <div class="parking-sim-modal-scroll">' +
      '    <div id="parkingSimModalGrid" class="parking-grid parking-sim-modal-grid-inner"></div>' +
      '  </div>' +
      '</div>' +
      '<div class="parking-sim-stage" id="parkingSimStage" aria-hidden="true"></div>';

    document.body.appendChild(el);

    const backdrop = el.querySelector('.parking-sim-backdrop');
    const closeBtn = el.querySelector('.parking-sim-close');
    const close = () => {
      simAbort = true;
      el.classList.remove('is-open', 'parking-sim-night');
      document.body.classList.remove('parking-sim-active');
      const stage = document.getElementById('parkingSimStage');
      if (stage) stage.innerHTML = '';
      const grid = document.getElementById('parkingSimModalGrid');
      if (grid) grid.innerHTML = '';
      document.querySelectorAll('.parking-sim-slot-highlight').forEach(c => {
        c.classList.remove('parking-sim-slot-highlight');
      });
    };
    backdrop.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    el._parkingSimClose = close;
    return el;
  }

  function animateBus(busEl, x0, y0, x1, y1, dur) {
    return new Promise(resolve => {
      busEl.style.transition = 'none';
      busEl.style.left = x0 + 'px';
      busEl.style.top = y0 + 'px';
      busEl.style.transform = 'translate(-50%, -50%) scale(0.88)';
      busEl.offsetHeight;
      busEl.style.transition =
        'left ' + dur + 'ms cubic-bezier(0.4,0,0.2,1), ' +
        'top ' + dur + 'ms cubic-bezier(0.4,0,0.2,1), ' +
        'transform ' + dur + 'ms cubic-bezier(0.4,0,0.2,1), ' +
        'opacity 220ms ease';
      busEl.style.left = x1 + 'px';
      busEl.style.top = y1 + 'px';
      busEl.style.transform = 'translate(-50%, -50%) scale(1)';
      setTimeout(resolve, dur + 60);
    });
  }

  async function runParkingSimulation() {
    if (typeof dispatchState === 'undefined' || !dispatchState.loaded) {
      alert('먼저 하단 [순서조회]로 배차 데이터를 불러와주세요.');
      return;
    }
    if (!APP?.parkingState?.values) {
      alert('주차 데이터가 없습니다. 날짜를 선택하거나 Auto Park로 배치해 주세요.');
      return;
    }

    const entryOrder = getEntryOrderList();
    if (!entryOrder.length) {
      alert('오늘 입차 순서가 비어 있습니다.');
      return;
    }

    const overlay = ensureOverlay();
    simAbort = false;
    const phaseEl = overlay.querySelector('.parking-sim-phase');
    const titleEl = overlay.querySelector('.parking-sim-title');
    const stage = document.getElementById('parkingSimStage');
    const gridEl = document.getElementById('parkingSimModalGrid');

    const { simValues, simActive } = buildInitialSimState(entryOrder);
    renderSimModalGrid(gridEl, simValues, simActive);

    overlay.classList.add('is-open');
    document.body.classList.add('parking-sim-active');
    if (stage) stage.innerHTML = '';

    const cancelled = () => simAbort || !overlay.classList.contains('is-open');

    const offRight = () => window.innerWidth + 72;
    const offLeft = () => -96;

    titleEl.textContent = '오늘 · 저녁 입차';
    phaseEl.textContent =
      '시뮬 주차판: 입차 예정 차는 빈칸에서 시작합니다 · 오른쪽에서 왼쪽으로 진입 후 칸에 표시됩니다';

    const srcA = APP.parkingState.active;

    for (let i = 0; i < entryOrder.length; i++) {
      if (cancelled()) return;
      const num = entryOrder[i];
      const slotIdx = findSlotIndexInApp(num);
      if (slotIdx < 0) continue;

      const card = simSlotCard(slotIdx);
      if (!card) continue;

      card.classList.add('parking-sim-slot-highlight');
      await sleep(50);

      const r = card.getBoundingClientRect();
      const tx = r.left + r.width / 2;
      const ty = r.top + r.height / 2;

      const bus = document.createElement('div');
      bus.className = 'parking-sim-bus parking-sim-bus-enter';
      bus.innerHTML =
        '<span class="parking-sim-bus-icon" aria-hidden="true">🚌</span>' +
        '<span class="parking-sim-bus-num">' + num + '</span>';
      stage.appendChild(bus);

      await animateBus(bus, offRight(), ty, tx, ty, 760);
      bus.style.opacity = '0.2';
      bus.remove();

      simValues[slotIdx] = String(num);
      simActive[slotIdx] = !!srcA[slotIdx];
      renderSimModalGrid(gridEl, simValues, simActive);

      const afterCard = simSlotCard(slotIdx);
      if (afterCard) afterCard.classList.remove('parking-sim-slot-highlight');
    }

    if (cancelled()) return;

    titleEl.textContent = '야간 · 주차';
    phaseEl.textContent = '오늘 입차 → 내일 아침 출차';
    overlay.classList.add('parking-sim-night');
    await sleep(2400);
    overlay.classList.remove('parking-sim-night');

    if (cancelled()) return;

    const tomorrowList = (dispatchState.tomorrowNums || []).map(n => n.num ?? n);
    titleEl.textContent = '내일 · 출차';
    phaseEl.textContent = tomorrowList.length
      ? '출차 순서대로 칸에서 사라진 뒤 왼쪽으로 빠져나갑니다'
      : '내일 출차 순서 데이터가 없습니다';

    for (let i = 0; i < tomorrowList.length; i++) {
      if (cancelled()) return;
      const num = tomorrowList[i];
      const slotIdx = findSlotIndexInApp(num);
      if (slotIdx < 0) continue;

      const card = simSlotCard(slotIdx);
      if (!card || card.classList.contains('empty')) continue;

      const r = card.getBoundingClientRect();
      const sx = r.left + r.width / 2;
      const sy = r.top + r.height / 2;

      simValues[slotIdx] = '';
      simActive[slotIdx] = false;
      renderSimModalGrid(gridEl, simValues, simActive);

      const bus = document.createElement('div');
      bus.className = 'parking-sim-bus parking-sim-bus-exit';
      bus.innerHTML =
        '<span class="parking-sim-bus-icon" aria-hidden="true">🚌</span>' +
        '<span class="parking-sim-bus-num">' + num + '</span>';
      stage.appendChild(bus);

      await animateBus(bus, sx, sy, offLeft(), sy, 720);
      bus.style.opacity = '0';
      bus.remove();
    }

    if (cancelled()) return;
    phaseEl.textContent = '시뮬레이션을 마쳤습니다 · ✕ 또는 바깥을 눌러 닫기';
  }

  function bind() {
    const btns = [
      document.getElementById('parkingSimBtn'),
    ].filter(Boolean);
    if (!btns.length) return;
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        runParkingSimulation().catch(e => console.error(e));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const o = document.getElementById('parkingSimOverlay');
    if (o?.classList.contains('is-open') && o._parkingSimClose) o._parkingSimClose();
  });
})();
