/* ============================================================
   admin.js — 관리자 로그인 / 로그아웃 / 권한 UI 제어 v2.1
   ============================================================ */
'use strict';

/* ── 날짜로 팀 계산 ──────────────────────────────────────── */
function getTeamByDate(dateStr) {
  /* 22번TEAM 고정 모드 */
  if (APP.settings?.teamMode === 'fixed') {
    const label = document.getElementById('teamLabel');
    if (label) label.setAttribute('data-team', '22');
    return '🚌 22번 TEAM';
  }
  const base   = new Date('2026-03-14');
  const target = new Date(dateStr);
  const diff   = Math.floor((target - base) / 86_400_000);
  const isB    = diff % 2 === 0;
  const label  = document.getElementById('teamLabel');
  if (label) label.setAttribute('data-team', isB ? 'B' : 'A');
  return isB ? '🔴 B TEAM' : '🔵 A TEAM';
}

/* ── 앱 설정 전체 적용 ── */
function applyAppSettings() {
  const s = APP.settings;
  /* 게시판 표시/숨김 */
  const bulletinSection = document.querySelector('.bulletin-section');
  const writePostBtn    = document.getElementById('writePostBtn');
  if (bulletinSection) bulletinSection.style.display = s.showBulletin ? '' : 'none';
  if (writePostBtn)    writePostBtn.style.display    = s.showBulletin ? '' : 'none';
  /* footer-note 텍스트 반영 */
  applyFooterNotes();
  /* 팀 라벨 갱신 */
  const datePicker = document.getElementById('datePicker');
  if (datePicker?.value) {
    document.getElementById('teamLabel').textContent = getTeamByDate(datePicker.value);
  }
  /* 관리자 권한 모드 반영 */
  if (!s.requireAdmin) {
    document.body.classList.remove('guest-mode');
    document.body.classList.add('admin-mode');
  }
}

function applyFooterNotes() {
  const s = APP.settings;
  const lines = document.querySelectorAll('.footer-line');
  if (lines[0]) lines[0].innerHTML = s.footerLine1 || '';
  if (lines[1]) lines[1].textContent = s.footerLine2 || '';
  if (lines[2]) lines[2].textContent = s.footerLine3 || '';
  const ver = document.getElementById('appVersion');
  if (ver) ver.textContent = s.appVersion || 'v3.1.0';
}

/* ── 관리자/게스트에 따라 카드 이벤트 재설정 ────────────── */
function applyPermissionUI() {
  /* 주차 카드 재렌더링 (권한에 따라 이벤트 핸들러 유무 결정) */
  if (typeof renderCards === 'function') renderCards();
  if (APP.renderCards) APP.renderCards();
  /* 게시판 재렌더링 — 삭제 버튼 권한 즉시 반영 */
  if (typeof loadBulletinPosts === 'function') loadBulletinPosts();
  if (APP.loadBulletinPosts) APP.loadBulletinPosts();
  /* 주차 오버레이 — 로그인/로그아웃 즉시 반영 */
  if (typeof updateParkingOverlay === 'function') {
    const date = document.getElementById('datePicker')?.value || '';
    updateParkingOverlay(date);
  }
}

/* ── 관리자 버튼 & body 클래스 동기화 ───────────────────── */
function updateAdminButton() {
  const loginIcon  = document.getElementById('loginIcon');
  const loginLabel = document.getElementById('loginLabel');

  if (APP.isAdmin) {
    if (loginIcon)  loginIcon.textContent  = '🔓';
    if (loginLabel) loginLabel.textContent = '로그아웃';
    document.body.classList.add('admin-mode');
    document.body.classList.remove('guest-mode');
  } else {
    if (loginIcon)  loginIcon.textContent  = '👤';
    if (loginLabel) loginLabel.textContent = '로그인';
    document.body.classList.add('guest-mode');
    document.body.classList.remove('admin-mode');
  }
}

/* ── 초기화 ───────────────────────────────────────────────── */
function initAdmin() {
  APP.applyPermissionUI = applyPermissionUI;
  APP.updateAdminButton = updateAdminButton;
  APP.getTeamByDate     = getTeamByDate;
  APP.applyAppSettings  = applyAppSettings;
  APP.applyFooterNotes  = applyFooterNotes;
  applyAppSettings();

  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminModal    = document.getElementById('adminModal');
  const adminPw       = document.getElementById('adminPw');

  updateAdminButton();

  /* ── Login / Logout ── */
  adminLoginBtn.addEventListener('click', () => {
    if (APP.isAdmin) {
      APP.isAdmin = false;
      sessionStorage.removeItem('isAdmin');
      applyPermissionUI();
      updateAdminButton();
      alert('Logout 되었습니다');
    } else {
      adminModal.classList.add('active');
      setTimeout(() => adminPw.focus(), 150);
    }
  });

  /* ── 비밀번호 확인 ── */
  const doLogin = async () => {
    const pw   = adminPw.value;
    const snap = await APP.get(APP.ref(APP.db, 'admin/password'));
    if (snap.exists() && String(snap.val()) === String(pw)) {
      APP.isAdmin = true;
      sessionStorage.setItem('isAdmin', '1');
      adminModal.classList.remove('active');
      adminPw.value = '';
      applyPermissionUI();
      updateAdminButton();
      /* 로그인 시 30일 지난 데이터 자동 삭제 */
      if (typeof cleanOldParkingData === 'function') cleanOldParkingData();
      alert('Login 되었습니다');
    } else {
      alert('비밀번호 오류');
      adminPw.select();
    }
  };

  document.getElementById('adminLoginOk').addEventListener('click', doLogin);
  adminPw.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });

  document.getElementById('adminCloseBtn').addEventListener('click', () => {
    adminModal.classList.remove('active');
    adminPw.value = '';
  });

  /* ── 앱 설정 대시보드 ── */
  const appSettingsBtn   = document.getElementById('appSettingsBtn');
  const appSettingsModal = document.getElementById('appSettingsModal');
  if (appSettingsBtn) {
    appSettingsBtn.addEventListener('click', () => {
      fillSettingsForm();
      appSettingsModal.classList.add('active');
    });
  }
  ['appSettingsClose','appSettingsCancel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => appSettingsModal.classList.remove('active'));
  });
  const saveBtn = document.getElementById('appSettingsSave');
  if (saveBtn) saveBtn.addEventListener('click', saveAppSettings);
}

/* ── 설정 폼 채우기 ── */
function fillSettingsForm() {
  const s = APP.settings;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  set('set-requireAdmin',  s.requireAdmin  !== false);
  set('set-showBulletin',  s.showBulletin  !== false);
  set('set-allowWrite',    s.allowWrite    !== false);
  set('set-allowComment',  s.allowComment  !== false);
  set('set-allowEdit',     s.allowEdit     !== false);
  set('set-allowDelete',   s.allowDelete   !== false);
  set('set-allowNotice',   s.allowNotice   !== false);
  /* 팀 표시 */
  const teamMode = s.teamMode || 'ab';
  const tmEl = document.getElementById('teamMode-' + teamMode);
  if (tmEl) tmEl.checked = true;
  /* footer */
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('set-footerLine1', s.footerLine1);
  setVal('set-footerLine2', s.footerLine2);
  setVal('set-footerLine3', s.footerLine3);
  setVal('set-appVersion',  s.appVersion);
}

/* ── 설정 저장 ── */
async function saveAppSettings() {
  const get  = id => { const el = document.getElementById(id); return el ? el.checked : true; };
  const getV = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const teamRadio = document.querySelector('input[name="teamMode"]:checked');

  const newSettings = {
    requireAdmin:  get('set-requireAdmin'),
    showBulletin:  get('set-showBulletin'),
    allowWrite:    get('set-allowWrite'),
    allowComment:  get('set-allowComment'),
    allowEdit:     get('set-allowEdit'),
    allowDelete:   get('set-allowDelete'),
    allowNotice:   get('set-allowNotice'),
    teamMode:      teamRadio ? teamRadio.value : 'ab',
    footerLine1:   getV('set-footerLine1'),
    footerLine2:   getV('set-footerLine2'),
    footerLine3:   getV('set-footerLine3'),
    appVersion:    getV('set-appVersion'),
  };

  try {
    await APP.set(APP.ref(APP.db, 'appSettings'), newSettings);
    Object.assign(APP.settings, newSettings);
    applyAppSettings();
    if (typeof renderCards === 'function') renderCards();
    if (typeof loadBulletinPosts === 'function') loadBulletinPosts();
    document.getElementById('appSettingsModal').classList.remove('active');
    alert('설정이 저장되었습니다.');
  } catch(e) {
    console.error('설정 저장 실패', e);
    alert('저장 중 오류가 발생했습니다.');
  }
}
