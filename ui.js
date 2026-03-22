/* ============================================================
   ui.js — 팝업 알림 / 팝업 설정 v3.0
   - 다중 팝업 (팝업1, 팝업2, ... + 추가)
   - Firebase: popup/list 배열로 저장
   - 기존 popup/settings 하위 호환 유지
   ============================================================ */
'use strict';

/* ── 현재 편집 중인 팝업 인덱스 ── */
let popupEditIdx = 0;
let popupList    = []; /* 메모리 캐시 */

/* ── Firebase에서 팝업 목록 로드 ── */
async function loadPopupList() {
  try {
    /* 신규: popup/list 배열 */
    const snap = await APP.get(APP.ref(APP.db, 'popup/list'));
    if (snap.exists()) {
      const val = snap.val();
      popupList = Array.isArray(val) ? val : Object.values(val);
      return;
    }
    /* 구버전 하위 호환: popup/settings 단일 객체 */
    const snapOld = await APP.get(APP.ref(APP.db, 'popup/settings'));
    if (snapOld.exists()) {
      popupList = [snapOld.val()];
      return;
    }
    popupList = [];
  } catch { popupList = []; }
}

/* ── Firebase에 팝업 목록 저장 ── */
async function savePopupList() {
  await APP.set(APP.ref(APP.db, 'popup/list'), popupList);
}

/* ── 탭 바 렌더링 ── */
function renderPopupTabs() {
  const bar = document.getElementById('popupTabBar');
  if (!bar) return;
  bar.innerHTML = '';

  popupList.forEach((p, i) => {
    const btn = document.createElement('button');
    btn.className = 'popup-tab-btn' + (i === popupEditIdx ? ' active' : '');
    btn.textContent = p.name || ('팝업' + (i + 1));
    btn.addEventListener('click', () => {
      popupEditIdx = i;
      renderPopupTabs();
      fillPopupForm(i);
    });
    bar.appendChild(btn);
  });

  /* + 추가 버튼 */
  const addBtn = document.createElement('button');
  addBtn.className = 'popup-tab-add';
  addBtn.textContent = '+ 추가';
  addBtn.addEventListener('click', () => {
    popupList.push({ name: '팝업' + (popupList.length + 1), content: '', days: [], startTime: '09:00', endTime: '18:00' });
    popupEditIdx = popupList.length - 1;
    renderPopupTabs();
    fillPopupForm(popupEditIdx);
  });
  bar.appendChild(addBtn);

  /* 팝업 없으면 폼 숨김 */
  const form = document.getElementById('popupEditForm');
  if (form) form.style.display = popupList.length ? 'block' : 'none';
}

/* ── 폼에 팝업 데이터 채우기 ── */
function fillPopupForm(idx) {
  const p = popupList[idx];
  if (!p) return;
  document.getElementById('popupContent').value   = p.content   || '';
  document.getElementById('popupStartTime').value = p.startTime || '09:00';
  document.getElementById('popupEndTime').value   = p.endTime   || '18:00';
  document.querySelectorAll('.popup-day-checkbox input').forEach(cb => {
    cb.checked = p.days?.includes(cb.value) || false;
  });
  /* 삭제 버튼: 팝업이 1개면 비활성 */
  const delBtn = document.getElementById('popupSettingsDeleteBtn');
  if (delBtn) delBtn.disabled = popupList.length <= 1;
}

/* ── 팝업 자동 표시 체크 ── */
async function checkAndShowPopup() {
  try {
    await loadPopupList();
    if (!popupList.length) return;

    const now  = new Date();
    const day  = String(now.getDay());
    const time = now.toTimeString().slice(0, 5);

    /* 조건 맞는 팝업 첫 번째 표시 */
    for (const p of popupList) {
      if (!p.content) continue;
      if (p.days?.includes(day) && time >= p.startTime && time <= p.endTime) {
        document.getElementById('popupNotificationContent').textContent = p.content;
        document.getElementById('popupNotification').classList.add('active');
        document.getElementById('popupOverlay').classList.add('active');
        break;
      }
    }
  } catch (err) {
    console.error('팝업 체크 실패:', err);
  }
}

/* ── UI 초기화 ── */
function initUI() {
  /* 팝업 알림 닫기 */
  document.getElementById('popupNotificationClose').addEventListener('click', () => {
    document.getElementById('popupNotification').classList.remove('active');
    document.getElementById('popupOverlay').classList.remove('active');
  });

  /* 팝업 설정 모달 열기 */
  document.getElementById('popupSettingBtn').addEventListener('click', async () => {
    try {
      await loadPopupList();
      /* 기본 팝업 없으면 하나 생성 */
      if (!popupList.length) {
        popupList = [{ name: '팝업1', content: '', days: [], startTime: '09:00', endTime: '18:00' }];
      }
      popupEditIdx = 0;
      renderPopupTabs();
      fillPopupForm(0);
      document.getElementById('popupSettingsModal').classList.add('active');
    } catch (err) {
      console.error('팝업 설정 로드 실패:', err);
    }
  });

  /* 모달 닫기 */
  ['popupSettingsClose', 'popupSettingsCancelBtn'].forEach(id => {
    document.getElementById(id).addEventListener('click', () =>
      document.getElementById('popupSettingsModal').classList.remove('active')
    );
  });

  /* 저장 */
  document.getElementById('popupSettingsSaveBtn').addEventListener('click', async () => {
    const content   = document.getElementById('popupContent').value.trim();
    const startTime = document.getElementById('popupStartTime').value;
    const endTime   = document.getElementById('popupEndTime').value;
    const days = [];
    document.querySelectorAll('.popup-day-checkbox input:checked')
      .forEach(cb => days.push(cb.value));

    popupList[popupEditIdx] = {
      ...popupList[popupEditIdx],
      content, startTime, endTime, days
    };

    try {
      await savePopupList();
      document.getElementById('popupSettingsModal').classList.remove('active');
      alert('팝업 설정 저장 완료');
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  });

  /* 삭제 */
  document.getElementById('popupSettingsDeleteBtn').addEventListener('click', async () => {
    if (popupList.length <= 1) return;
    const name = popupList[popupEditIdx].name || ('팝업' + (popupEditIdx + 1));
    if (!confirm(`"${name}"을 삭제하시겠습니까?`)) return;
    popupList.splice(popupEditIdx, 1);
    popupEditIdx = Math.max(0, popupEditIdx - 1);
    try {
      await savePopupList();
      renderPopupTabs();
      fillPopupForm(popupEditIdx);
      alert('삭제 완료');
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  });
}
