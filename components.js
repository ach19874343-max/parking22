/* ============================================================
   components.js — HTML 컴포넌트 템플릿 v1.0
   각 섹션을 함수로 분리 → index.html 은 뼈대만 유지
   ============================================================ */
'use strict';

/* ── 헤더 ──────────────────────────────────────────────────── */
function tmplHeader() {
  return `
  <header class="app-header">
    <div class="date-nav">
      <button id="prevDayBtn" class="date-nav-btn" aria-label="이전날">&#8249;</button>
      <div class="date-center">
        <input type="date" id="datePicker" autocomplete="off"
               style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;">
        <button id="dateDisplayBtn" class="date-display-btn" aria-label="날짜 선택"></button>
        <button id="nextDayBtn" class="date-nav-btn" aria-label="다음날">&#8250;</button>
      </div>
      <button id="todayBtn" class="today-chip">오늘</button>
    </div>
    <div class="team-row">
      <div class="header-actions">
        <button id="undoBtn" class="header-action-btn" aria-label="실행취소" title="실행취소" disabled>&#8634;</button>
        <button id="redoBtn" class="header-action-btn" aria-label="앞으로" title="앞으로" disabled>&#8635;</button>
      </div>
      <span id="teamLabel" class="team-badge"></span>
      <div class="legend">
        <span class="legend-dot run"></span><span class="legend-text">운행</span>
        <span class="legend-dot rest"></span><span class="legend-text">휴차</span>
      </div>
    </div>
  </header>`;
}

/* ── 주차 슬롯 그리드 ──────────────────────────────────────── */
function tmplParkingGrid() {
  const rows = [
    { label: '2R', id: 'row-0', row: 0 },
    { label: '3R', id: 'row-1', row: 1 },
    { label: '4R', id: 'row-2', row: 2 },
    { label: '5R', id: 'row-3', row: 3 },
    { label: '6R', id: 'row-4', row: 4 },
    { label: '7R', id: 'row-5', row: 5 },
  ];
  return `
  <main class="parking-main">
    <div class="parking-grid" id="parkingGrid">
      ${rows.map(r =>
        `<div class="p-row">
          <div class="line-label" data-row="${r.row}">${r.label}</div>
          <div class="slots-wrap" id="${r.id}"></div>
        </div>`
      ).join('\n      ')}
    </div>
  </main>`;
}

/* ── 게시판 영역 ────────────────────────────────────────────── */
function tmplBulletin() {
  return `
  <section class="bulletin-section">
    <div class="bulletin-board">
      <div id="bulletinWriteArea" class="bulletin-write-area" style="display:none">
        <div class="reply-input-row">
          <textarea class="bulletinWriteInput"
                    placeholder="당일 특이사항이 있을 경우 메모해 주세요..." rows="3"></textarea>
          <div class="reply-action-row">
            <button id="bulletinWriteSubmit" class="replySave">등록</button>
            <button id="bulletinWriteCancel" class="replyCancel">취소</button>
          </div>
        </div>
      </div>
      <div class="bulletin-posts" id="bulletinPosts"></div>
    </div>
    <div class="footer-note">
      <p>※ 보영운수 22번 주차도&nbsp;&nbsp;|&nbsp;&nbsp;<span class="rest-note">노란색 = 당일 휴차</span></p>
      <p>※ 원하는 날짜 선택 시 해당 날짜 마감 주차도를 불러옵니다.</p>
      <p class="warn-text">※ 각조 팀장 &amp; 부팀장 허락 없이 수정 절대 금지 ※</p>
      <p class="copyright">Copyright &copy; 2026 ChangHai An. All rights reserved. &nbsp;|&nbsp; v2.1.0</p>
    </div>
  </section>`;
}

/* ── 하단 네비게이션 ────────────────────────────────────────── */
function tmplBottomNav() {
  return `
  <nav class="bottom-nav">
    <button class="nav-item admin-ui" id="currentVehicleBtn">
      <span class="nav-icon"><svg viewBox="0 0 24 24">
        <rect x="1" y="3" width="15" height="13" rx="2"/>
        <path d="M16 8h4l3 5v4h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg></span>
      <span class="nav-label">차량</span>
    </button>
    <button class="nav-item admin-ui" id="popupSettingBtn">
      <span class="nav-icon"><svg viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg></span>
      <span class="nav-label">팝업</span>
    </button>
    <button class="nav-item" id="writePostBtn">
      <span class="nav-icon"><svg viewBox="0 0 24 24">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg></span>
      <span class="nav-label">메모</span>
    </button>
    <button class="nav-item" id="adminLoginBtn">
      <span class="nav-icon" id="loginIcon"><svg viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg></span>
      <span class="nav-label" id="loginLabel">로그인</span>
    </button>
  </nav>`;
}

/* ── 팝업 설정 모달 ─────────────────────────────────────────── */
function tmplPopupSettingsModal() {
  const days = ['월','화','수','목','금','토','일'];
  const vals = [1,2,3,4,5,6,0];
  return `
  <div class="modal-overlay popup-settings-modal" id="popupSettingsModal">
    <div class="modal-box popup-settings-content">
      <div class="modal-header">
        <h3>팝업 설정</h3>
        <button class="modal-close-btn" id="popupSettingsClose" aria-label="닫기">&#10005;</button>
      </div>
      <div class="popup-settings-group">
        <label>내용 입력</label>
        <textarea id="popupContent" placeholder="팝업에 표시될 내용을 입력하세요..."></textarea>
      </div>
      <div class="popup-settings-group">
        <label>요일 선택</label>
        <div class="popup-days-container">
          ${days.map((d, i) =>
            `<div class="popup-day-checkbox">
              <input type="checkbox" id="day-${vals[i]}" value="${vals[i]}">
              <label for="day-${vals[i]}">${d}</label>
            </div>`
          ).join('\n          ')}
        </div>
      </div>
      <div class="popup-settings-group">
        <label>시간 설정</label>
        <div class="popup-time-container">
          <div class="popup-time-input">
            <label style="display:block;font-size:12px;margin-bottom:4px;color:#888">시작</label>
            <input type="time" id="popupStartTime" value="09:00">
          </div>
          <div class="popup-time-input">
            <label style="display:block;font-size:12px;margin-bottom:4px;color:#888">종료</label>
            <input type="time" id="popupEndTime" value="18:00">
          </div>
        </div>
      </div>
      <div class="popup-settings-buttons">
        <button class="btn-primary" id="popupSettingsSaveBtn">저장</button>
        <button class="btn-secondary" id="popupSettingsCancelBtn">취소</button>
      </div>
    </div>
  </div>`;
}

/* ── 팝업 알림 오버레이 ─────────────────────────────────────── */
function tmplPopupNotification() {
  return `
  <div class="popup-overlay" id="popupOverlay"></div>
  <div class="popup-notification" id="popupNotification">
    <div class="popup-notification-content" id="popupNotificationContent"></div>
    <button class="btn-primary" id="popupNotificationClose">닫기</button>
  </div>`;
}

/* ── 차량 목록 패널 ─────────────────────────────────────────── */
function tmplVehiclePanel() {
  return `
  <div id="vehiclePanel">
    <div class="vehicle-panel-header">
      <h3>차량 목록</h3>
      <button id="vehiclePanelCloseBtn" aria-label="닫기">&#10005;</button>
    </div>
    <div class="vehicle-list">
      <button class="vehicle-add-btn" id="vehicleAddBtn">+ 차량번호 추가</button>
      <div id="vehicleAddInputContainer" style="display:none" class="vehicle-add-input-container">
        <input type="text" id="vehicleAddInput" placeholder="숫자 3-4자리 입력"
               maxlength="4" autocomplete="off" inputmode="numeric">
        <div class="vehicle-add-btn-row">
          <button id="vehicleAddConfirmBtn" class="btn-confirm">추가</button>
          <button id="vehicleAddCancelBtn" class="btn-cancel">취소</button>
        </div>
      </div>
      <div id="vehicleListContainer"></div>
    </div>
  </div>`;
}

/* ── 관리자 로그인 모달 ─────────────────────────────────────── */
function tmplAdminModal() {
  return `
  <div class="modal-overlay" id="adminModal">
    <div class="modal-box admin-modal-box">
      <div class="modal-header">
        <h3>관리자 로그인</h3>
        <button id="adminCloseBtn" class="modal-close-btn" aria-label="닫기">&#10005;</button>
      </div>
      <input type="password" id="adminPw" placeholder="비밀번호"
             autocomplete="current-password" inputmode="numeric"
             style="font-size:16px">
      <button id="adminLoginOk" class="btn-primary btn-full">Login</button>
    </div>
  </div>`;
}

/* ── 드래그 고스트 ──────────────────────────────────────────── */
function tmplDragGhost() {
  return `<div id="dragGhost" class="drag-ghost"></div>`;
}

/* ══════════════════════════════════════════════════════════════
   renderComponents — 모든 컴포넌트를 DOM에 삽입
   DOMContentLoaded 전에 동기 실행되므로 즉시 호출
══════════════════════════════════════════════════════════════ */
(function renderComponents() {
  /* 앱 래퍼 내부 (헤더 + 그리드 + 게시판 + 네비) */
  const wrapper = document.getElementById('app-wrapper');
  if (wrapper) {
    wrapper.innerHTML =
      tmplHeader() +
      tmplParkingGrid() +
      tmplBulletin() +
      tmplBottomNav();
  }

  /* 바디 직접 삽입 (모달 / 오버레이 / 패널 / 고스트) */
  const body = document.body;
  const extras = document.createElement('div');
  extras.innerHTML =
    tmplPopupSettingsModal() +
    tmplPopupNotification() +
    tmplVehiclePanel() +
    tmplAdminModal() +
    tmplDragGhost();

  /* DocumentFragment로 한 번에 삽입 (리플로우 최소화) */
  const frag = document.createDocumentFragment();
  while (extras.firstChild) frag.appendChild(extras.firstChild);
  body.appendChild(frag);
})();
