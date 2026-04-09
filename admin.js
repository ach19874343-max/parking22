/* ============================================================
   admin.js v3.0 — 관리자/게스트 구분 없음
   ============================================================ */
'use strict';

/* ── 팀 계산 ── */
function getTeamByDate(dateStr) {
  const base = new Date('2026-03-14');
  let teamKey, teamText;

  if (APP.settings?.teamMode === 'fixed') {
    teamKey  = '22';
    teamText = '22번 TEAM';
  } else {
    const diff = Math.floor((new Date(dateStr) - base) / 86400000);
    const isB  = diff % 2 === 0;
    teamKey  = isB ? 'B' : 'A';
    teamText = isB ? '🔴 B TEAM' : '🔵 A TEAM';
  }

  /* pill 색상 */
  const pillWrap = document.getElementById('datePillWrap') ||
                   document.querySelector('.date-pill-wrap');
  if (pillWrap) pillWrap.dataset.team = teamKey;

  /* 팀 텍스트 — 날짜 바로 옆에 표시 */
  const teamEl = document.getElementById('teamLabel') ||
                 document.querySelector('.date-pill-team');
  if (teamEl) teamEl.textContent = teamText;

  return teamText;
}

/* ── footer 이모지 ── */
function getFooterEmoji(text) {
  if (/\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}/.test(text) || /전화|☎|tel/i.test(text)) return '📞';
  if (/버스|차량|운행|배차/.test(text)) return '🚌';
  if (/주의|금지|경고|절대/.test(text)) return '⚠️';
  if (/공지|안내|알림/.test(text)) return '📢';
  return '📌';
}

function linkifyPhones(text) {
  return text.replace(/(\d{2,4})[-\s](\d{3,4})[-\s](\d{4})/g,
    '<a href="tel:$1$2$3" style="color:inherit;text-decoration:underline">$1-$2-$3</a>');
}

/* ── footer 적용 ── */
function applyFooterNotes() {
  const s = APP.settings;
  const lines = document.querySelectorAll('.footer-line');
  if (lines[0]) lines[0].innerHTML = s.footerLine1 || '';
  if (lines[1]) lines[1].textContent = s.footerLine2 || '';
  if (lines[2]) lines[2].textContent = s.footerLine3 || '';
  const ver = document.getElementById('appVersion');
  if (ver) ver.textContent = s.appVersion || 'v3.1.0';
  const extra = document.getElementById('footerExtraLines');
  if (extra) {
    extra.innerHTML = '';
    for (let i = 4; i <= 10; i++) {
      const line = s['footerLine' + i];
      if (!line || !line.trim()) continue;
      const div = document.createElement('div');
      div.className = 'fn-row';
      const safe = line.replace(/&/g,'&amp;').replace(/</g,'&lt;');
      div.innerHTML = '<span class="fn-icon">' + getFooterEmoji(line) + '</span>' +
        '<span class="fn-text footer-extra-line">' + linkifyPhones(safe) + '</span>';
      extra.appendChild(div);
    }
  }
}

/* ── 앱 설정 적용 ── */
function applyAppSettings() {
  const s = APP.settings;
  applyFooterNotes();
  const dp = document.getElementById('datePicker');
  if (dp?.value) {
    const lbl = document.getElementById('teamLabel');
    if (lbl) lbl.textContent = getTeamByDate(dp.value);
  }
}

/* ── 데이터 정리 ── */
async function cleanAllOldData() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 10);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  let total = 0;
  try {
    for (const path of ['parking', 'dispatch']) {
      const snap = await APP.get(APP.ref(APP.db, path));
      if (!snap.exists()) continue;
      const tasks = [];
      snap.forEach(child => {
        if (child.key < cutoffStr)
          tasks.push(APP.set(APP.ref(APP.db, `${path}/${child.key}`), null));
      });
      if (tasks.length) { await Promise.all(tasks); total += tasks.length; }
    }
    // ※ learnData 경로는 학습 데이터 보호를 위해 데이터 정리 대상에서 제외
    alert(`🗑️ 데이터 정리 완료!\n${total}건 삭제 (기준: ${cutoffStr})\n\n※ 자동주차 학습 데이터는 삭제되지 않습니다.`);
  } catch (err) {
    alert('데이터 정리 중 오류: ' + err.message);
  }
}

/* ── 설정 폼 채우기 ── */
function fillSettingsForm() {
  const s = APP.settings;
  const teamMode = s.teamMode || 'ab';
  const tmEl = document.getElementById('teamMode-' + teamMode);
  if (tmEl) tmEl.checked = true;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('set-footerLine1', s.footerLine1);
  setVal('set-footerLine2', s.footerLine2);
  setVal('set-footerLine3', s.footerLine3);
  setVal('set-appVersion',  s.appVersion);
  setVal('set-dispatchApiBase', s.dispatchApiBase);
  const ec = document.getElementById('set-exitChainAllowMissing4R');
  if (ec) ec.checked = (s.exitChainAllowMissing4R !== false);
  renderFooterExtraInputs(s);
  renderVehicleEditor();
  renderRowEditor();
}

/* ── footer 동적 입력 ── */
function renderFooterExtraInputs(s) {
  const container = document.getElementById('footerExtraInputs');
  const addBtn    = document.getElementById('addFooterLineBtn');
  if (!container) return;
  container.innerHTML = '';
  let count = 0;
  for (let i = 4; i <= 10; i++) {
    const val = s['footerLine' + i];
    if (val !== undefined && val !== '') { addFooterInputRow(container, i, val); count++; }
  }
  if (addBtn) addBtn.style.display = (3 + count >= 10) ? 'none' : '';
}

function addFooterInputRow(container, idx, val) {
  const row = document.createElement('div');
  row.className = 'footer-input-row';
  row.dataset.idx = idx;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.id = 'set-footerLine' + idx;
  inp.className = 'settings-input'; inp.placeholder = idx + '번째 줄'; inp.value = val || '';
  const delBtn = document.createElement('button');
  delBtn.type = 'button'; delBtn.className = 'footer-del-btn'; delBtn.textContent = '✕';
  delBtn.onclick = () => {
    row.remove();
    reindexFooterInputs();
    const ab = document.getElementById('addFooterLineBtn');
    if (ab) ab.style.display = '';
  };
  row.appendChild(inp); row.appendChild(delBtn); container.appendChild(row);
}

function reindexFooterInputs() {
  document.querySelectorAll('#footerExtraInputs .footer-input-row').forEach((row, i) => {
    const newIdx = i + 4; row.dataset.idx = newIdx;
    const inp = row.querySelector('input');
    if (inp) { inp.id = 'set-footerLine' + newIdx; inp.placeholder = newIdx + '번째 줄'; }
  });
}

/* ── 설정 저장 ── */
async function saveAppSettings() {
  const getV = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const teamRadio = document.querySelector('input[name="teamMode"]:checked');
  const getCb = id => { const el = document.getElementById(id); return el ? !!el.checked : false; };
  const newSettings = {
    teamMode:        teamRadio ? teamRadio.value : 'ab',
    footerLine1:     getV('set-footerLine1'),
    footerLine2:     getV('set-footerLine2'),
    footerLine3:     getV('set-footerLine3'),
    appVersion:      getV('set-appVersion'),
    dispatchApiBase: getV('set-dispatchApiBase') || 'https://api.kiki-bus.com/dispatch/126',
    exitChainAllowMissing4R: getCb('set-exitChainAllowMissing4R'),
  };
  for (let i = 4; i <= 10; i++) {
    const el = document.getElementById('set-footerLine' + i);
    newSettings['footerLine' + i] = el ? el.value.trim() : '';
  }
  try {
    await APP.set(APP.ref(APP.db, 'busList'), APP.currentBusList);
    await APP.set(APP.ref(APP.db, 'rowLabels'), APP.rowLabels);
    await APP.set(APP.ref(APP.db, 'appSettings'), newSettings);
    Object.assign(APP.settings, newSettings);
    applyAppSettings();
    if (APP.renderCards) APP.renderCards();
    document.getElementById('appSettingsModal').classList.remove('active');
    alert('설정이 저장되었습니다.');
  } catch(e) {
    alert('저장 중 오류가 발생했습니다.');
  }
}

/* ── 비번 확인 ── */
async function verifySettingsPassword() {
  return new Promise(resolve => {
    let modal = document.getElementById('settingsPwModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'settingsPwModal';
      modal.className = 'ap-sheet-modal center';
      modal.innerHTML = `
        <div class="ap-sheet center">
          <div class="ap-sheet-grabber"></div>
          <div class="ap-sheet-header">
            <div>
              <div class="ap-sheet-title">⚙️ 설정</div>
              <div class="ap-pw-sub">비밀번호를 입력하세요</div>
            </div>
            <button class="ap-sheet-close" id="settingsPwClose" aria-label="닫기">&#10005;</button>
          </div>
          <div class="ap-sheet-body">
            <input id="settingsPwInput" class="ap-pw-input" type="password" inputmode="numeric"
              placeholder="••••" maxlength="20">
            <div class="ap-pw-actions">
              <button class="ap-pw-btn cancel" id="settingsPwCancel">취소</button>
              <button class="ap-pw-btn ok" id="settingsPwOk">확인</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    modal.classList.add('active');
    const inp = modal.querySelector('#settingsPwInput');
    inp.value = '';
    setTimeout(() => inp.focus(), 80);
    async function doCheck() {
      const pw = inp.value.trim();
      try {
        const snap = await APP.get(APP.ref(APP.db, 'admin/password'));
        if (snap.exists() && String(snap.val()) === String(pw)) {
          modal.remove();
          resolve(true);
        } else {
          inp.style.border = '1.5px solid #EF4444'; inp.value = '';
          inp.placeholder = '틀렸습니다';
          setTimeout(() => { inp.style.border = ''; inp.placeholder = '••••'; }, 1500);
        }
      } catch {
        modal.remove();
        resolve(true);
      }
    }
    const okBtn = modal.querySelector('#settingsPwOk');
    const cancelBtn = modal.querySelector('#settingsPwCancel');
    const closeBtn = modal.querySelector('#settingsPwClose');
    const cancelFn = () => { modal.remove(); resolve(false); };
    if (okBtn) okBtn.onclick = doCheck;
    if (cancelBtn) cancelBtn.onclick = cancelFn;
    if (closeBtn) closeBtn.onclick = cancelFn;
    // ESC / Enter
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); doCheck(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelFn(); }
    };
    // backdrop click closes
    modal.onclick = (e) => { if (e.target === modal) cancelFn(); };
  });
}

/* ── 차량 편집 ── */
function renderVehicleEditor() {
  const wrap = document.getElementById('vehicleEditorWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  (APP.currentBusList || []).forEach((num, idx) => {
    const item = document.createElement('div');
    item.className = 've-item';
    item.innerHTML = `<span class="ve-num">${num}</span>
      <input class="ve-input" type="text" inputmode="numeric" maxlength="4" value="${num}" style="display:none">
      <div class="ve-btns">
        <button class="ve-btn edit">✏️</button>
        <button class="ve-btn del">✕</button>
      </div>`;
    item.querySelector('.edit').addEventListener('click', () => {
      const sp = item.querySelector('.ve-num'), ip = item.querySelector('.ve-input'), eb = item.querySelector('.edit');
      if (ip.style.display === 'none') { sp.style.display='none'; ip.style.display=''; ip.focus(); eb.textContent='✓'; }
      else { const v=ip.value.trim(); if(v&&v!==num) APP.currentBusList[idx]=v; sp.textContent=APP.currentBusList[idx]; sp.style.display=''; ip.style.display='none'; eb.textContent='✏️'; }
    });
    item.querySelector('.del').addEventListener('click', () => {
      if (!confirm(`${num} 삭제?`)) return;
      APP.currentBusList.splice(idx, 1); renderVehicleEditor();
    });
    wrap.appendChild(item);
  });
}

function addVehicle() {
  const inp = document.getElementById('newVehicleInput'); if (!inp) return;
  const num = inp.value.trim(); if (!num) return;
  if ((APP.currentBusList||[]).includes(num)) { alert('이미 등록된 번호입니다.'); return; }
  APP.currentBusList = APP.currentBusList || [];
  APP.currentBusList.push(num); inp.value = ''; renderVehicleEditor();
}

/* ── 행 편집 ── */
function renderRowEditor() {
  const wrap = document.getElementById('rowEditorWrap'); if (!wrap) return;
  wrap.innerHTML = '';
  (APP.rowLabels || []).forEach((label, idx) => {
    const item = document.createElement('div');
    item.className = 've-item';
    item.innerHTML = `<span class="ve-num">${label}</span>
      <input class="ve-input" type="text" maxlength="8" value="${label}" style="display:none">
      <div class="ve-btns">
        <button class="ve-btn edit">✏️</button>
        <button class="ve-btn del">✕</button>
      </div>`;
    item.querySelector('.edit').addEventListener('click', () => {
      const sp = item.querySelector('.ve-num'), ip = item.querySelector('.ve-input'), eb = item.querySelector('.edit');
      if (ip.style.display === 'none') { sp.style.display='none'; ip.style.display=''; ip.focus(); eb.textContent='✓'; }
      else { const v=ip.value.trim(); if(v) APP.rowLabels[idx]=v; sp.textContent=APP.rowLabels[idx]; sp.style.display=''; ip.style.display='none'; eb.textContent='✏️'; }
    });
    item.querySelector('.del').addEventListener('click', () => {
      if (APP.rowCount <= 1) { alert('최소 1개 행이 필요합니다.'); return; }
      if (!confirm(`${label} 행 삭제?`)) return;
      APP.rowLabels.splice(idx, 1); APP.rowCount = APP.rowLabels.length; renderRowEditor();
    });
    wrap.appendChild(item);
  });
}

function addRow() {
  const inp = document.getElementById('newRowInput'); if (!inp) return;
  const label = inp.value.trim(); if (!label) return;
  APP.rowLabels = APP.rowLabels || []; APP.rowLabels.push(label);
  APP.rowCount = APP.rowLabels.length; inp.value = ''; renderRowEditor();
}

/* ── initAdmin ── */
function initAdmin() {
  APP.isAdmin = true;
  APP.getTeamByDate = getTeamByDate; /* parking.js에서 호출 */

  /* body 클래스 정리 */
  document.body.classList.remove('guest-mode');
  document.body.classList.add('admin-mode');

  /* 설정 버튼 */
  const appSettingsBtn   = document.getElementById('appSettingsBtn');
  const appSettingsModal = document.getElementById('appSettingsModal');
  if (appSettingsBtn && appSettingsModal) {
    appSettingsBtn.addEventListener('click', async () => {
      const ok = await verifySettingsPassword();
      if (!ok) return;
      fillSettingsForm();
      appSettingsModal.classList.add('active');
      // 학습 데이터 개수 갱신
      if (window.apLearnCount) {
        window.apLearnCount().then(count => {
          const badge = document.getElementById('apLearnCountBadge');
          if (badge) badge.textContent = `학습 데이터: ${count}개`;
        }).catch(()=>{});
      }
    });
  }
  ['appSettingsClose','appSettingsCancel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => appSettingsModal?.classList.remove('active'));
  });
  const saveBtn = document.getElementById('appSettingsSave');
  if (saveBtn) saveBtn.addEventListener('click', saveAppSettings);

  /* 차량 추가 */
  const addVehicleBtn = document.getElementById('addVehicleBtn');
  if (addVehicleBtn) addVehicleBtn.addEventListener('click', addVehicle);
  const newVehicleInput = document.getElementById('newVehicleInput');
  if (newVehicleInput) newVehicleInput.addEventListener('keypress', e => { if (e.key==='Enter') addVehicle(); });

  /* 행 추가 */
  const addRowBtn = document.getElementById('addRowBtn');
  if (addRowBtn) addRowBtn.addEventListener('click', addRow);
  const newRowInput = document.getElementById('newRowInput');
  if (newRowInput) newRowInput.addEventListener('keypress', e => { if (e.key==='Enter') addRow(); });

  /* 데이터 정리 */
  const cleanDataBtn = document.getElementById('cleanDataBtn');
  if (cleanDataBtn) cleanDataBtn.addEventListener('click', () => {
    if (!confirm('10일 이전의 주차도 / 배차 데이터를 모두 삭제합니다.\n계속하시겠습니까?')) return;
    cleanAllOldData();
  });

  /* 🧠 자동주차 학습 버튼 */
  const apLearnSaveBtn = document.getElementById('apLearnSaveBtn');
  if (apLearnSaveBtn) {
    apLearnSaveBtn.addEventListener('click', async () => {
      const dateStr = document.getElementById('datePicker')?.value;
      if (!dateStr) { alert('날짜를 먼저 선택해주세요.'); return; }
      const statusMsg = document.getElementById('apLearnStatusMsg');
      apLearnSaveBtn.disabled = true;
      apLearnSaveBtn.textContent = '저장 중…';
      if (statusMsg) statusMsg.textContent = '';
      try {
        const result = await window.apLearnSave(dateStr);
        if (statusMsg) {
          statusMsg.textContent = result.ok ? '✅ ' + result.msg : '❌ ' + result.msg;
          statusMsg.style.color = result.ok ? 'var(--color-success)' : 'var(--color-danger)';
        }
        // 개수 갱신
        const count = await window.apLearnCount();
        const badge = document.getElementById('apLearnCountBadge');
        if (badge) badge.textContent = `학습 데이터: ${count}개`;
      } catch(e) {
        if (statusMsg) { statusMsg.textContent = '❌ 오류 발생'; statusMsg.style.color='var(--color-danger)'; }
      } finally {
        apLearnSaveBtn.disabled = false;
        apLearnSaveBtn.textContent = '🧠 현재 배치 학습 저장';
      }
    });
  }

  /* footer 줄 추가 */
  const addFooterBtn = document.getElementById('addFooterLineBtn');
  if (addFooterBtn) addFooterBtn.addEventListener('click', () => {
    const container = document.getElementById('footerExtraInputs'); if (!container) return;
    const rows = container.querySelectorAll('.footer-input-row');
    const total = 3 + rows.length; if (total >= 10) return;
    addFooterInputRow(container, rows.length + 4, '');
    if (total + 1 >= 10) addFooterBtn.style.display = 'none';
  });

  /* 로그인 버튼 숨김 */
  const fabItemLogin = document.getElementById('fabItemLogin');
  if (fabItemLogin) fabItemLogin.style.display = 'none';

  /* 앱 설정 적용 */
  applyAppSettings();
}
