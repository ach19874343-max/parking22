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

  /* requireAdmin 해제 → 모든 방문자 관리자 권한 */
  if (!s.requireAdmin) {
    APP.isAdmin = true;
    document.body.classList.remove('guest-mode');
    document.body.classList.add('admin-mode');
  }

  /* 게시판 표시/숨김 — bulletin-board + footer-note는 분리 */
  const bulletinBoard   = document.querySelector('.bulletin-board');
  const writePostBtn    = document.getElementById('writePostBtn');
  const bulletinWriteArea = document.getElementById('bulletinWriteArea');
  if (bulletinBoard)   bulletinBoard.style.display     = s.showBulletin !== false ? '' : 'none';
  if (writePostBtn)    writePostBtn.style.display       = s.showBulletin !== false ? '' : 'none';
  if (bulletinWriteArea && s.showBulletin === false) bulletinWriteArea.style.display = 'none';

  /* footer-note */
  applyFooterNotes();

  /* 팀 라벨 갱신 */
  const datePicker = document.getElementById('datePicker');
  if (datePicker?.value) {
    const lbl = document.getElementById('teamLabel');
    if (lbl) lbl.textContent = getTeamByDate(datePicker.value);
  }
}

function getFooterEmoji(text) {
  /* 전화번호 패턴 먼저 */
  if (/\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}/.test(text) || /전화|☎|tel/i.test(text)) return '📞';
  if (/버스|차량|운행|배차|마을버스/.test(text)) return '🚌';
  if (/주의|금지|경고|절대|위험|금/.test(text)) return '⚠️';
  if (/시간|오전|오후|AM|PM|\d+시|스케줄|일정/.test(text)) return '🕐';
  if (/식사|점심|저녁|아침|음식|밥|급식/.test(text)) return '🍽️';
  if (/날씨|비|눈|맑음|흐림|안개/.test(text)) return '🌤️';
  if (/회의|미팅|회식|집합|모임/.test(text)) return '📅';
  if (/공지|안내|알림|공고/.test(text)) return '📢';
  if (/수리|정비|점검|고장/.test(text)) return '🔧';
  if (/주차|차고|주차장/.test(text)) return '🅿️';
  if (/팀장|부팀장|기사|운전/.test(text)) return '👤';
  if (/노선|번호|\d+번/.test(text)) return '🔢';
  return '📌';
}

function linkifyPhones(text) {
  /* 전화번호를 tel: 링크로 변환 (000-0000-0000 / 000 0000 0000 등) */
  return text.replace(
    /(\d{2,4})[-\s](\d{3,4})[-\s](\d{4})/g,
    '<a href="tel:$1$2$3" style="color:inherit;text-decoration:underline;text-underline-offset:2px">$1-$2-$3</a>'
  );
}

function applyFooterNotes() {
  const s = APP.settings;
  const lines = document.querySelectorAll('.footer-line');
  if (lines[0]) lines[0].innerHTML = s.footerLine1 || '';
  if (lines[1]) lines[1].textContent = s.footerLine2 || '';
  if (lines[2]) lines[2].textContent = s.footerLine3 || '';
  const ver = document.getElementById('appVersion');
  if (ver) ver.textContent = s.appVersion || 'v3.1.0';
  /* 추가 줄 4~10 — fn-card 안에 표시 */
  const extra = document.getElementById('footerExtraLines');
  if (extra) {
    extra.innerHTML = '';
    for (let i = 4; i <= 10; i++) {
      const line = s['footerLine' + i];
      if (line && line.trim()) {
        const div = document.createElement('div');
        div.className = 'fn-row';
        const safe = line.replace(/&/g,'&amp;').replace(/</g,'&lt;');
        const emoji = getFooterEmoji(line);
        /* 전화번호 링크 변환 */
        const linked = linkifyPhones(safe);
        div.innerHTML = '<span class="fn-icon">' + emoji + '</span>' +
          '<span class="fn-text footer-extra-line">' + linked + '</span>';
        extra.appendChild(div);
      }
    }
  }
}

/* ── 관리자/게스트에 따라 카드 이벤트 재설정 ────────────── */
function applyPermissionUI() {
  /* 배차 현황 섹션 권한 즉시 반영 */
  if (typeof renderDispatchSection === 'function') renderDispatchSection();
  if (APP.renderDispatchSection) APP.renderDispatchSection();
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
      /* 배차 현황 세션 초기화 */
      if (typeof resetDispatchState === 'function') resetDispatchState();
      if (APP.resetDispatch) APP.resetDispatch();
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

  /* + 줄 추가 버튼 */
  const addFooterBtn = document.getElementById('addFooterLineBtn');
  if (addFooterBtn) addFooterBtn.addEventListener('click', () => {
    const container = document.getElementById('footerExtraInputs');
    if (!container) return;
    const rows = container.querySelectorAll('.footer-input-row');
    const total = 3 + rows.length;
    if (total >= 10) return;
    const newIdx = rows.length + 4;
    addFooterInputRow(container, newIdx, '');
    if (total + 1 >= 10) addFooterBtn.style.display = 'none';
  });
}

/* ── 설정 항목 설명 ── */
const SETTINGS_HELP = {
  requireAdmin:  '체크: 관리자 로그인 시에만 관리자 권한\n해제: 모든 방문자가 관리자 권한을 가집니다',
  showBulletin:  '체크: 게시판과 메모 버튼이 표시됩니다\n해제: 게시판 전체와 메모 버튼이 숨겨집니다',
  allowWrite:    '체크: 누구나 게시글 작성 가능\n해제: 관리자만 게시글 작성 가능',
  allowComment:  '체크: 누구나 댓글 작성 가능\n해제: 관리자만 댓글 작성 가능',
  allowEdit:     '체크: 누구나 수정 가능\n해제: 관리자만 수정 버튼 사용 가능',
  allowDelete:   '체크: 누구나 삭제 가능 (공지는 항상 관리자만)\n해제: 관리자만 삭제 버튼 사용 가능',
  allowNotice:   '체크: 관리자만 공지 등록 가능\n해제: 누구나 공지 등록 가능',
};

function showSettingsHelp(key) {
  /* 기존 툴팁 제거 */
  const existing = document.getElementById('settingsTooltip');
  if (existing) { existing.remove(); return; }
  const tip = document.createElement('div');
  tip.id = 'settingsTooltip';
  tip.className = 'settings-tooltip';
  tip.textContent = SETTINGS_HELP[key] || '';
  document.body.appendChild(tip);
  /* 아무 곳 클릭시 닫기 */
  setTimeout(() => {
    document.addEventListener('click', () => tip.remove(), { once: true });
  }, 10);
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
  setVal('set-dispatchApiBase', s.dispatchApiBase);
  /* 동적 추가 줄 렌더링 */
  renderFooterExtraInputs(s);
}

function renderFooterExtraInputs(s) {
  const container = document.getElementById('footerExtraInputs');
  const addBtn    = document.getElementById('addFooterLineBtn');
  if (!container) return;
  container.innerHTML = '';
  let count = 0;
  for (let i = 4; i <= 10; i++) {
    const val = s['footerLine' + i];
    if (val !== undefined && val !== '') {
      addFooterInputRow(container, i, val);
      count++;
    }
  }
  if (addBtn) addBtn.style.display = (3 + count >= 10) ? 'none' : '';
}

function addFooterInputRow(container, idx, val) {
  const row = document.createElement('div');
  row.className = 'footer-input-row';
  row.dataset.idx = idx;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.id   = 'set-footerLine' + idx;
  inp.className   = 'settings-input';
  inp.placeholder = idx + '번째 줄';
  inp.value = val || '';
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'footer-del-btn';
  delBtn.textContent = '✕';
  delBtn.onclick = () => {
    row.remove();
    reindexFooterInputs();
    const ab = document.getElementById('addFooterLineBtn');
    if (ab) ab.style.display = '';
  };
  row.appendChild(inp);
  row.appendChild(delBtn);
  container.appendChild(row);
}

function reindexFooterInputs() {
  const rows = document.querySelectorAll('#footerExtraInputs .footer-input-row');
  rows.forEach((row, i) => {
    const newIdx = i + 4;
    row.dataset.idx = newIdx;
    const inp = row.querySelector('input');
    if (inp) { inp.id = 'set-footerLine' + newIdx; inp.placeholder = newIdx + '번째 줄'; }
  });
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
    dispatchApiBase: getV('set-dispatchApiBase') || 'https://api.kiki-bus.com/dispatch/126',
  };
  /* 동적 추가 줄 4~10 */
  for (let i = 4; i <= 10; i++) {
    const el = document.getElementById('set-footerLine' + i);
    newSettings['footerLine' + i] = el ? el.value.trim() : '';
  }

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
