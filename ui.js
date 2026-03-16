/* ============================================================
   ui.js — 메뉴 / 플로팅 버튼 / 팝업 알림 / 팝업 설정
   ============================================================ */
'use strict';

/* ── 팝업 자동 표시 체크 ─────────────────────────────── */
async function checkAndShowPopup() {
  try {
    const snap = await APP.get(APP.ref(APP.db, 'popup/settings'));
    if (!snap.exists()) return;

    const data = snap.val();
    if (!data.content) return;

    const now  = new Date();
    const day  = String(now.getDay());
    const time = now.toTimeString().slice(0, 5);

    if (data.days?.includes(day) && time >= data.startTime && time <= data.endTime) {
      document.getElementById('popupNotificationContent').textContent = data.content;
      document.getElementById('popupNotification').classList.add('active');
      document.getElementById('popupOverlay').classList.add('active');
    }
  } catch (err) {
    console.error('팝업 체크 실패:', err);
  }
}

/* ── UI 초기화 (Firebase 불필요한 부분) ──────────────── */
function initUI() {

  /* ── 게스트 플로팅 로그인 버튼 생성 ── */
  const floating = document.createElement('button');
  floating.textContent = 'Login';
  floating.className   = 'guest-login-floating';
  document.body.appendChild(floating);
  floating.addEventListener('click', () => document.getElementById('adminLoginBtn').click());

  /* ── 상단 메뉴 admin 버튼 ── */
  document.querySelectorAll('.menu-admin').forEach(btn => {
    btn.addEventListener('click', () => document.getElementById('adminLoginBtn').click());
  });

  /* ── 팝업 알림 닫기 ── */
  document.getElementById('popupNotificationClose').addEventListener('click', () => {
    document.getElementById('popupNotification').classList.remove('active');
    document.getElementById('popupOverlay').classList.remove('active');
  });

  /* ── 팝업 설정 모달 열기 ── */
  document.getElementById('popupSettingBtn').addEventListener('click', async () => {
    try {
      const snap = await APP.get(APP.ref(APP.db, 'popup/settings'));
      if (snap.exists()) {
        const d = snap.val();
        document.getElementById('popupContent').value   = d.content   || '';
        document.getElementById('popupStartTime').value = d.startTime || '09:00';
        document.getElementById('popupEndTime').value   = d.endTime   || '18:00';
        document.querySelectorAll('.popup-day-checkbox input').forEach(cb => {
          cb.checked = d.days?.includes(cb.value) || false;
        });
      }
      document.getElementById('popupSettingsModal').classList.add('active');
    } catch (err) {
      console.error('팝업 설정 로드 실패:', err);
    }
  });

  /* ── 팝업 설정 모달 닫기 ── */
  ['popupSettingsClose', 'popupSettingsCancelBtn'].forEach(id => {
    document.getElementById(id).addEventListener('click', () =>
      document.getElementById('popupSettingsModal').classList.remove('active')
    );
  });

  /* ── 팝업 설정 저장 ── */
  document.getElementById('popupSettingsSaveBtn').addEventListener('click', async () => {
    const content   = document.getElementById('popupContent').value.trim();
    const startTime = document.getElementById('popupStartTime').value;
    const endTime   = document.getElementById('popupEndTime').value;
    const days      = [];
    document.querySelectorAll('.popup-day-checkbox input:checked').forEach(cb => days.push(cb.value));

    try {
      await APP.set(APP.ref(APP.db, 'popup/settings'), { content, startTime, endTime, days });
      document.getElementById('popupSettingsModal').classList.remove('active');
      alert('팝업 설정 저장 완료');
    } catch (err) {
      console.error('팝업 설정 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  });
}
