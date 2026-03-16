/* ============================================================
   admin.js — 관리자 로그인 / 로그아웃 / 권한 UI 제어
   ============================================================ */
'use strict';

/* ── 날짜로 팀 계산 ──────────────────────────────────── */
function getTeamByDate(dateStr) {
  const base   = new Date('2026-03-14');
  const target = new Date(dateStr);
  const diff   = Math.floor((target - base) / 86_400_000);
  return diff % 2 === 0 ? '🔴 🅱 TEAM 🔴' : '🔵 🅰 TEAM 🔵';
}

/* ── 관리자/게스트에 따라 주차도 셀 활성화 제어 ─────── */
function applyPermissionUI() {
  const cells    = document.querySelectorAll('.cell');
  const selects  = document.querySelectorAll('.cell select');
  const wrappers = document.querySelectorAll('.cells-wrapper');

  if (APP.isAdmin) {
    cells.forEach(c  => { c.style.pointerEvents = 'auto'; });
    selects.forEach(s => { s.disabled = false; s.style.display = 'block'; });
    wrappers.forEach(w => { w.style.pointerEvents = 'auto'; });
  } else {
    cells.forEach(c  => { c.style.pointerEvents = 'none'; });
    selects.forEach(s => { s.disabled = true; });
    wrappers.forEach(w => { w.style.pointerEvents = 'none'; });
  }
}

/* ── 관리자 버튼 텍스트 & 모드 클래스 동기화 ─────────── */
function updateAdminButton() {
  const btn = document.getElementById('adminLoginBtn');
  if (!btn) return;

  if (APP.isAdmin) {
    btn.textContent = 'Logout';
    document.getElementById('copyVehicleBtn').style.display = 'block';
    document.body.classList.add('admin-mode');
    document.body.classList.remove('guest-mode');
  } else {
    btn.textContent = 'Login';
    document.getElementById('vehiclePanel').style.display   = 'none';
    document.getElementById('copyVehicleBtn').style.display = 'none';
    document.body.classList.add('guest-mode');
    document.body.classList.remove('admin-mode');
  }

  /* 상단 메뉴의 admin 버튼 텍스트 동기화 */
  document.querySelectorAll('.menu-admin').forEach(b => b.textContent = btn.textContent);

  /* 플로팅 게스트 로그인 버튼 표시/숨김 */
  const floating = document.querySelector('.guest-login-floating');
  if (floating) floating.style.display = APP.isAdmin ? 'none' : 'block';
}

/* ── 초기화 ──────────────────────────────────────────── */
function initAdmin() {
  /* 다른 모듈에서 호출할 수 있도록 APP에 등록 */
  APP.applyPermissionUI = applyPermissionUI;
  APP.updateAdminButton = updateAdminButton;
  APP.getTeamByDate     = getTeamByDate;

  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminModal    = document.getElementById('adminModal');
  const adminPw       = document.getElementById('adminPw');

  /* 초기 UI 동기화 */
  updateAdminButton();

  /* ── Login / Logout 버튼 ── */
  adminLoginBtn.addEventListener('click', () => {
    if (APP.isAdmin) {
      APP.isAdmin = false;
      sessionStorage.removeItem('isAdmin');
      applyPermissionUI();
      updateAdminButton();
      alert('Logout 되었습니다');
    } else {
      adminModal.classList.add('active');
      /* 키보드가 올라온 뒤 포커스 — iOS에서 즉시 focus() 하면 화면이 튀는 문제 방지 */
      setTimeout(() => adminPw.focus(), 150);
    }
  });

  /* ── 비밀번호 확인 (Enter 키 지원) ── */
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

  /* ── 모달 닫기 ── */
  document.getElementById('adminCloseBtn').addEventListener('click', () => {
    adminModal.classList.remove('active');
    adminPw.value = '';
  });

  /* ── 초기화 버튼 ── */
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!APP.isAdmin) return;
    const date = document.getElementById('datePicker').value;
    if (!date) { alert('날짜를 선택해주세요.'); return; }
    if (!confirm('선택된 날짜의 차량 번호 설정을 초기화하시겠습니까?')) return;
    APP.set(APP.ref(APP.db, 'parking/' + date), null);
    APP.loadData(date);
    alert('초기화 완료되었습니다.');
  });

  /* ── 복사 버튼 ── */
  document.getElementById('copyVehicleBtn').addEventListener('click', () => {
    const dp = document.getElementById('datePicker');
    let dateText = '';
    if (dp?.value) {
      const d = new Date(dp.value);
      dateText = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    }

    const lines = [];
    document.querySelectorAll('.row').forEach(row => {
      const cars = [];
      row.querySelectorAll('select').forEach(s => { if (s.value) cars.push(s.value); });
      if (cars.length) lines.push(cars.join('-'));
    });

    navigator.clipboard.writeText(dateText + '\n\n' + lines.join('\n'))
      .then(() => alert('차량 목록이 복사되었습니다.'))
      .catch(() => alert('복사에 실패했습니다. 직접 선택하여 복사해주세요.'));
  });
}
