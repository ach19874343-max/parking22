/* ============================================================
   components.js — HTML 컴포넌트 템플릿 v1.0
   각 섹션을 함수로 분리 → index.html 은 뼈대만 유지
   ============================================================ */
'use strict';

/* ── 헤더 ──────────────────────────────────────────────────── */
function tmplHeader() {
  return `
  <header class="app-header">
    <button id="darkModeBtn" class="dark-mode-btn" aria-label="다크모드 전환" title="다크모드">
      <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
    <div class="date-nav">
      <div class="date-center">
        <input type="date" id="datePicker" autocomplete="off"
               style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;">
        <button id="prevDayBtn" class="date-nav-btn" aria-label="이전날">
          <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button id="dateDisplayBtn" class="date-display-btn" aria-label="날짜 선택">
          <span class="date-main-text"></span>
          <span class="date-sub-text"></span>
        </button>
        <button id="nextDayBtn" class="date-nav-btn" aria-label="다음날">
          <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <button id="todayBtn" class="today-chip">오늘</button>
    </div>
    <div class="team-row">
      <div class="header-actions">
        <button id="undoBtn" class="header-action-btn" aria-label="실행취소" title="실행취소" disabled>
          <span class="btn-arrow">↩</span>
          <span class="btn-label">취소</span>
        </button>
        <button id="redoBtn" class="header-action-btn" aria-label="앞으로" title="앞으로" disabled>
          <span class="btn-arrow">↪</span>
          <span class="btn-label">다시</span>
        </button>
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
  return `
  <main class="parking-main">
    <div class="vehicle-edit-done-bar" id="vehicleEditDoneBar" style="display:none">
      <span class="vehicle-edit-done-label">🚌 차량 수정 모드</span>
      <button id="vehicleEditDoneBtn" class="vehicle-edit-done-btn">✅ 수정 완료</button>
    </div>
    <div class="row-edit-done-bar" id="rowEditDoneBar" style="display:none">
      <span class="vehicle-edit-done-label">📋 행 수정 모드</span>
      <button id="rowEditDoneBtn" class="vehicle-edit-done-btn">✅ 수정 완료</button>
    </div>
    <div class="parking-overlay hidden" id="parkingOverlay">
      <div class="parking-overlay-inner">
        <div class="parking-overlay-icon">🅿️</div>
        <div class="parking-overlay-text">주차도 수정 전</div>
        <div class="parking-overlay-sub">관리자 로그인 후 수정 가능합니다</div>
      </div>
    </div>
    <div class="parking-grid" id="parkingGrid">
    </div>
  </main>`;
}

/* ── 게시판 영역 ────────────────────────────────────────────── */
function tmplBulletin() {
  return `
  <section class="bulletin-section">
    <div class="bulletin-board">

      <!-- 탭 메뉴 -->
      <div class="bulletin-tabs">
        <button class="bulletin-tab-btn active" data-tab="all">전체</button>
        <button class="bulletin-tab-btn" data-tab="notice">📢 공지</button>
        <button class="bulletin-tab-btn" data-tab="memo">메모</button>
      </div>

      <!-- 글쓰기 영역 -->
      <div id="bulletinWriteArea" class="bulletin-write-area" style="display:none">
        <div class="reply-input-row">
          <textarea class="bulletinWriteInput"
                    placeholder="내용을 입력해주세요..." rows="3"></textarea>
          <div class="bulletin-write-options" id="noticeCheckboxRow" style="display:none">
            <label class="notice-check-label">
              <input type="checkbox" id="noticeCheckbox">
              <span class="notice-check-text">📢 공지글로 등록</span>
            </label>
          </div>
          <div class="reply-action-row">
            <button id="bulletinWriteSubmit" class="replySave">등록</button>
            <button id="bulletinWriteCancel" class="replyCancel">취소</button>
          </div>
        </div>
      </div>

      <div class="bulletin-posts" id="bulletinPosts"></div>
    </div>
    <div class="footer-note">
      <p class="footer-line">※ 보영운수 22번 주차도&nbsp;&nbsp;|&nbsp;&nbsp;<span class="rest-note">노란색 = 당일 휴차</span></p>
      <p class="footer-line">※ 원하는 날짜 선택 시 해당 날짜 마감 주차도를 불러옵니다.</p>
      <p class="footer-line warn-text">※ 각조 팀장 &amp; 부팀장 허락 없이 수정 절대 금지 ※</p>
      <p class="copyright">Copyright &copy; 2026 ChangHai An. All rights reserved. &nbsp;|&nbsp; <span id="appVersion">v3.1.0</span></p>
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
    <button class="nav-item admin-ui" id="rowEditBtn">
      <span class="nav-icon"><svg viewBox="0 0 24 24">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg></span>
      <span class="nav-label">행</span>
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
    <button class="nav-item admin-ui" id="appSettingsBtn">
      <span class="nav-icon"><svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg></span>
      <span class="nav-label">설정</span>
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

      <!-- 팝업 탭 목록 -->
      <div class="popup-tab-bar" id="popupTabBar">
        <!-- JS로 동적 생성 -->
      </div>

      <!-- 팝업 편집 폼 -->
      <div id="popupEditForm">
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
            ).join('\n            ')}
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
          <button class="btn-primary"   id="popupSettingsSaveBtn">저장</button>
          <button class="btn-danger"    id="popupSettingsDeleteBtn">삭제</button>
          <button class="btn-secondary" id="popupSettingsCancelBtn">취소</button>
        </div>
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
/* ── 차량 목록 패널: 인라인 수정 모드로 교체됨 ── */
function tmplVehiclePanel() { return ''; }


/* ── 앱 설정 대시보드 ──────────────────────────────────────── */
function tmplAppSettingsModal() {
  return `
  <div class="modal-overlay" id="appSettingsModal">
    <div class="modal-box settings-modal-box">
      <div class="modal-header">
        <h3>⚙️ 앱 설정</h3>
        <button class="modal-close-btn" id="appSettingsClose" aria-label="닫기">&#10005;</button>
      </div>

      <!-- 권한 설정 -->
      <div class="settings-section">
        <div class="settings-section-title">🔐 권한 설정</div>
        <label class="settings-row">
          <span class="settings-label">관리자 로그인 필요</span>
          <input type="checkbox" class="settings-cb" id="set-requireAdmin">
        </label>
        <label class="settings-row">
          <span class="settings-label">게시판 표시</span>
          <input type="checkbox" class="settings-cb" id="set-showBulletin">
        </label>
        <label class="settings-row">
          <span class="settings-label">게시글 작성</span>
          <input type="checkbox" class="settings-cb" id="set-allowWrite">
        </label>
        <label class="settings-row">
          <span class="settings-label">댓글 작성</span>
          <input type="checkbox" class="settings-cb" id="set-allowComment">
        </label>
        <label class="settings-row">
          <span class="settings-label">수정</span>
          <input type="checkbox" class="settings-cb" id="set-allowEdit">
        </label>
        <label class="settings-row">
          <span class="settings-label">삭제</span>
          <input type="checkbox" class="settings-cb" id="set-allowDelete">
        </label>
        <label class="settings-row">
          <span class="settings-label">공지 등록</span>
          <input type="checkbox" class="settings-cb" id="set-allowNotice">
        </label>
      </div>

      <!-- 팀 표시 -->
      <div class="settings-section">
        <div class="settings-section-title">🏷️ 팀 표시</div>
        <div class="settings-radio-group">
          <label class="settings-radio">
            <input type="radio" name="teamMode" value="ab" id="teamMode-ab">
            <span>A팀 / B팀 (날짜 기준)</span>
          </label>
          <label class="settings-radio">
            <input type="radio" name="teamMode" value="fixed" id="teamMode-fixed">
            <span>22번 TEAM (고정)</span>
          </label>
        </div>
      </div>

      <!-- 하단 안내문 -->
      <div class="settings-section">
        <div class="settings-section-title">📝 하단 안내문</div>
        <div class="settings-footer-group">
          <input type="text" id="set-footerLine1" class="settings-input" placeholder="첫째 줄">
          <input type="text" id="set-footerLine2" class="settings-input" placeholder="둘째 줄">
          <input type="text" id="set-footerLine3" class="settings-input" placeholder="셋째 줄 (경고문)">
          <div class="settings-version-row">
            <span class="settings-label">앱 버전</span>
            <input type="text" id="set-appVersion" class="settings-input settings-input-sm" placeholder="v3.1.0">
          </div>
        </div>
      </div>

      <div class="settings-btns">
        <button class="btn-primary" id="appSettingsSave">저장</button>
        <button class="btn-secondary" id="appSettingsCancel">취소</button>
      </div>
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
  function setAppVh() {
    document.documentElement.style.setProperty('--app-vh', window.innerHeight + 'px');
  }
  setAppVh();
  window.addEventListener('orientationchange', () => setTimeout(setAppVh, 300));
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
    tmplAppSettingsModal() +
    tmplDragGhost();

  /* DocumentFragment로 한 번에 삽입 (리플로우 최소화) */
  const frag = document.createDocumentFragment();
  while (extras.firstChild) frag.appendChild(extras.firstChild);
  body.appendChild(frag);
})();
