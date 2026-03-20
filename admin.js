/* ============================================================
   admin.js — 관리자 로그인 / 로그아웃 / 권한 UI 제어 v2.1
   ============================================================ */
'use strict';

/* ── 날짜로 팀 계산 ──────────────────────────────────────── */
function getTeamByDate(dateStr) {
  const base   = new Date('2026-03-14');
  const target = new Date(dateStr);
  const diff   = Math.floor((target - base) / 86_400_000);
  const isB    = diff % 2 === 0;
  const label  = document.getElementById('teamLabel');
  if (label) label.setAttribute('data-team', isB ? 'B' : 'A');
  return isB ? '🔴 B TEAM' : '🔵 A TEAM';
}

/* ── 관리자/게스트에 따라 카드 이벤트 재설정 ────────────── */
function applyPermissionUI() {
  /* 카드 재렌더링 (권한에 따라 이벤트 핸들러 유무 결정) */
  if (typeof renderCards === 'function') renderCards();
  if (APP.renderCards) APP.renderCards();
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
    document.getElementById('vehiclePanel').style.display = 'none';
    document.body.classList.add('guest-mode');
    document.body.classList.remove('admin-mode');
  }
}

/* ── 초기화 ───────────────────────────────────────────────── */
function initAdmin() {
  APP.applyPermissionUI = applyPermissionUI;
  APP.updateAdminButton = updateAdminButton;
  APP.getTeamByDate     = getTeamByDate;

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
}
