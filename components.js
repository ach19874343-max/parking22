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
        <!-- 관리자: 취소/다시 버튼 -->
        <button id="undoBtn" class="header-action-btn admin-ui" aria-label="실행취소" title="실행취소" disabled>
          <span class="btn-arrow">↩</span>
          <span class="btn-label">취소</span>
        </button>
        <button id="redoBtn" class="header-action-btn admin-ui" aria-label="앞으로" title="앞으로" disabled>
          <span class="btn-arrow">↪</span>
          <span class="btn-label">다시</span>
        </button>
        <!-- 게스트: 마지막 저장 시간 -->
        <div id="lastSavedWrap" class="last-saved-wrap">
          <span class="last-saved-dot"></span>
          <span id="lastSavedText" class="last-saved-text">—</span>
        </div>
      </div>
      <span id="teamLabel" class="team-badge"></span>
      <div class="legend">
        <span class="legend-dot run"></span><span class="legend-text">운행</span>
        <span class="legend-dot rest"></span><span class="legend-text">휴차</span>
      </div>
    </div>
  </header>`;
}

/* ── 배차 현황 섹션 (관리자 전용) ─────────────────────────── */
function tmplDispatch() {
  return `
  <section id="dispatchSection" class="dispatch-section" style="display:none">

    <style>
      /* ══════════════════════════════════════
         Dispatch Section — Redesigned v1.3
         (색상 구분 강화, 버튼형 디자인)
         ══════════════════════════════════════ */
      .dispatch-section {
        padding: 0;
        border-bottom: 0.5px solid var(--color-border-tertiary);
        background: var(--color-background-primary);
        overflow: hidden;
      }

      /* ── 오늘 행 (블루 배경) ── */
      .dispatch-row-today {
        background: linear-gradient(135deg, #EEF4FF 0%, #F8FAFF 100%);
        padding: 10px 12px;
        border-left: 3px solid #1D4ED8;
      }
      .dark-mode .dispatch-row-today {
        background: linear-gradient(135deg, #1E3A5F 0%, #1E293B 100%);
        border-left-color: #3B82F6;
      }
      .dispatch-row-today .dispatch-day-label {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .05em;
        color: #1D4ED8;
      }
      .dark-mode .dispatch-row-today .dispatch-day-label {
        color: #60A5FA;
      }

      /* ── 내일 행 (그레이 배경) ── */
      .dispatch-row-tomorrow {
        background: linear-gradient(135deg, #F3F4F6 0%, #F9FAFB 100%);
        padding: 10px 12px;
        border-top: 1px solid var(--color-border-tertiary);
        border-left: 3px solid #9CA3AF;
      }
      .dark-mode .dispatch-row-tomorrow {
        background: linear-gradient(135deg, #374151 0%, #1F2937 100%);
        border-left-color: #6B7280;
      }
      .dispatch-row-tomorrow .dispatch-day-label {
        font-size: 13px;
        font-weight: 800;
        letter-spacing: .05em;
        color: #6B7280;
      }
      .dark-mode .dispatch-row-tomorrow .dispatch-day-label {
        color: #9CA3AF;
      }

      /* ── 행 내 레이아웃 ── */
      .dispatch-row-inner {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .dispatch-date-label {
        font-size: 11px;
        color: var(--color-text-tertiary);
      }

      /* ── 칩 컨테이너 ── */
      .dispatch-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      /* ── 칩 (총6회차 - 기본, 테두리 강조) ── */
      .dc-chip {
        background: #FFFFFF;
        border: 1.5px solid #D1D5DB;
        border-radius: 6px;
        padding: 3px 7px;
        font-size: 16px;
        font-weight: 600;
        color: #374151;
        line-height: 1.5;
        letter-spacing: .01em;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
      .dark-mode .dc-chip {
        background: #4B5563;
        border-color: #6B7280;
        color: #F9FAFB;
      }

      /* ── 총5회차 (파란색) ── */
      .dc-chip--early {
        background: #bbdefb;
        border: 1.5px solid #1E40AF;
        color: #374151;
      }
      .dark-mode .dc-chip--early {
        background: #2563EB;
        border-color: #1D4ED8;
        color: #fff;
      }

      /* ── 휴차 (주황색) ── */
      .dc-chip--absent {
        background: #FEF9C3;
        border: 1.5px solid #EAB308;
        color: #713F12;
      }
      .dark-mode .dc-chip--absent {
        background: #F59E0B;
        border-color: #D97706;
        color: #1F2937;
      }

      /* ── 불러오기 버튼 (버튼형, 크게) ── */
      .dispatch-load-btn-sm {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 6px 14px;
        border-radius: 6px;
        border: none;
        background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all .15s ease;
        white-space: nowrap;
        letter-spacing: .02em;
        box-shadow: 0 2px 4px rgba(29, 78, 216, 0.3);
      }
      .dispatch-load-btn-sm:hover {
        background: linear-gradient(135deg, #2563EB 0%, #1E40AF 100%);
        box-shadow: 0 3px 6px rgba(29, 78, 216, 0.4);
      }
      .dispatch-load-btn-sm:active {
        transform: scale(.97);
      }
      .dark-mode .dispatch-load-btn-sm {
        background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
      }
      .dispatch-load-btn-sm svg {
        width: 12px; height: 12px;
        stroke: currentColor;
        stroke-width: 2.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
        flex-shrink: 0;
        transition: transform .4s ease;
      }
      .dispatch-load-btn-sm.spinning svg {
        animation: dc-spin .7s linear infinite;
      }
      @keyframes dc-spin {
        to { transform: rotate(360deg); }
      }

      /* ── 로딩 ── */
      .dispatch-loading {
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 12px;
        font-size: 11px;
        color: var(--color-text-tertiary);
        background: var(--color-background-secondary);
      }
      .dispatch-loading-dots {
        display: inline-flex; gap: 3px;
      }
      .dispatch-loading-dots span {
        width: 5px; height: 5px;
        border-radius: 50%;
        background: var(--color-text-tertiary);
        animation: dc-bounce 1s ease infinite;
      }
      .dispatch-loading-dots span:nth-child(2) { animation-delay: .15s; }
      .dispatch-loading-dots span:nth-child(3) { animation-delay: .3s; }
      @keyframes dc-bounce {
        0%,80%,100% { transform: scale(.6); opacity:.4; }
        40%         { transform: scale(1);  opacity:1; }
      }

      /* ── 빈 힌트 ── */
      .dispatch-empty-hint {
        padding: 12px;
        font-size: 11px;
        color: var(--color-text-tertiary);
        font-style: italic;
        letter-spacing: .01em;
        text-align: center;
        background: var(--color-background-secondary);
      }
      /* ── 주차 슬롯 탭 선택 시 매칭 칩 (빨간 테두리) ── */
      .dc-chip--matched {
        outline: 2px solid #EF4444 !important;
        outline-offset: 1px;
        box-shadow: 0 0 0 3px rgba(239,68,68,0.25) !important;
        animation: dc-match-pulse 0.7s ease-in-out infinite alternate;
      }
      @keyframes dc-match-pulse {
        from { box-shadow: 0 0 0 0 rgba(239,68,68,0.35); }
        to   { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
      }

      /* ── 휴차 칩 매칭 시 오버라이드 ── */
      .dc-chip--absent.dc-chip--matched {
        outline-color: #EF4444 !important;
      }
    </style>

    <!-- ── 로딩 ── -->
    <div id="dispatchLoading" class="dispatch-loading" style="display:none">
      <div class="dispatch-loading-dots">
        <span></span><span></span><span></span>
      </div>
      배차 정보 조회 중… 잠시만 기다려주세요.......
    </div>

    <!-- ── 빈 힌트 ── -->
    <div id="dispatchEmptyHint" class="dispatch-empty-hint">
      ✚ 버튼 → 불러오기 를 눌러 오늘 · 내일 배차 번호를 불러오세요
    </div>

    <!-- ── 결과 ── -->
    <div id="dispatchContent" class="dispatch-content" style="display:none">
      <!-- 오늘 행 -->
      <div class="dispatch-row-today">
        <div class="dispatch-row-inner">
          <span class="dispatch-day-label">오늘</span>
          <span class="dispatch-date-label" id="dispatchTodayLbl"></span>
        </div>
        <div class="dispatch-chips" id="dispatchTodayChips"></div>
      </div>
      <!-- 내일 행 -->
      <div class="dispatch-row-tomorrow">
        <div class="dispatch-row-inner">
          <span class="dispatch-day-label">내일</span>
          <span class="dispatch-date-label" id="dispatchTomorrowLbl"></span>
        </div>
        <div class="dispatch-chips" id="dispatchTomorrowChips"></div>
      </div>
    </div>

  </section>`;
}

/* ── 주차 슬롯 그리드 ──────────────────────────────────────── */
function tmplParkingGrid() {
  return `
  <main class="parking-main">
    <div class="vehicle-edit-done-bar" id="vehicleEditDoneBar" style="display:none">
      <span class="vehicle-edit-done-label">🚌 차량 수정 모드</span>
      <div class="edit-bar-btns">
        <button id="vehicleEditCancelBtn" class="edit-bar-cancel-btn">✕ 취소</button>
        <button id="vehicleEditDoneBtn"   class="vehicle-edit-done-btn">✅ 수정 완료</button>
      </div>
    </div>
    <div class="row-edit-done-bar" id="rowEditDoneBar" style="display:none">
      <span class="vehicle-edit-done-label">📋 행 수정 모드</span>
      <div class="edit-bar-btns">
        <button id="rowEditCancelBtn" class="edit-bar-cancel-btn">✕ 취소</button>
        <button id="rowEditDoneBtn"   class="vehicle-edit-done-btn">✅ 수정 완료</button>
      </div>
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
      <div class="fn-card">
        <div class="fn-row"><span class="fn-icon">🚌</span><span class="fn-text footer-line"><b>보영운수 22번 주차도</b> &nbsp;|&nbsp; <span class="rest-note">노란색 = 당일 휴차</span></span></div>
        <div class="fn-row"><span class="fn-icon">📅</span><span class="fn-text footer-line">원하는 날짜 선택 시 해당 날짜 마감 주차도를 불러옵니다</span></div>
        <div id="footerExtraLines"></div>
      </div>
      <div class="fn-warn footer-line warn-text">⚠️ 각조 팀장 &amp; 부팀장 허락 없이 수정 절대 금지</div>
      <p class="copyright">Copyright &copy; 2026 ChangHai An. &nbsp;|&nbsp; <span id="appVersion">v3.1.0</span> &nbsp;|&nbsp; <a href="manual.html" target="_blank" class="manual-link">사용설명서</a></p>
    </div>
  </section>`;
}

/* ── FAB 플로팅 버튼 ────────────────────────────────────────── */
function tmplBottomNav() {
  return `
  <!-- FAB 딤 배경 -->
  <div class="fab-backdrop" id="fabBackdrop"></div>

  <!-- FAB 컨테이너: flex-direction: row-reverse → + 우측 고정, 아이템 왼쪽으로 펼침 -->
  <div class="fab-container" id="fabContainer">

    <!-- ⓪ 메인 FAB (+) — DOM 첫 번째 = 가장 오른쪽 -->
    <button class="fab-main" id="fabMain" aria-label="메뉴 열기">
      <svg class="fab-main-icon fab-icon-plus" viewBox="0 0 24 24"
           stroke="currentColor" fill="none" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <svg class="fab-main-icon fab-icon-x" viewBox="0 0 24 24"
           stroke="currentColor" fill="none" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- ① 로그인/로그아웃 — 항상 표시 (+ 바로 왼쪽) -->
    <div class="fab-item" id="fabItemLogin">
      <span class="fab-item-label" id="loginLabel">로그인</span>
      <button class="fab-action-btn" id="adminLoginBtn" aria-label="로그인">
        <span id="loginIcon">
          <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </span>
      </button>
    </div>

    <!-- ② 설정 — 관리자만 -->
    <div class="fab-item admin-ui" id="fabItemSettings">
      <span class="fab-item-label">설정</span>
      <button class="fab-action-btn" id="appSettingsBtn" aria-label="설정">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <!-- ③ 배차 불러오기 — 관리자만 -->
    <div class="fab-item admin-ui" id="fabItemDispatch">
      <span class="fab-item-label">불러오기</span>
      <button class="fab-action-btn fab-action-btn--dispatch" id="dispatchLoadBtn" aria-label="배차 불러오기">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
    </div>

    <!-- ④ 팝업 — 관리자만, 설정으로 표시/숨김 -->
    <div class="fab-item admin-ui" id="fabItemPopup">
      <span class="fab-item-label">팝업</span>
      <button class="fab-action-btn" id="popupSettingBtn" aria-label="팝업 설정">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>
    </div>

    <!-- ⑤ 차량·행 — 관리자만, 설정으로 표시/숨김 -->
    <div class="fab-item admin-ui" id="fabItemVehicle">
      <span class="fab-item-label">차량·행</span>
      <button class="fab-action-btn" id="currentVehicleBtn" aria-label="차량·행">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="2"/>
          <path d="M16 8h4l3 5v4h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </button>
    </div>

    <!-- ⑥ 메모(글쓰기) — 설정에 따라 표시 (가장 왼쪽) -->
    <div class="fab-item" id="fabItemMemo">
      <span class="fab-item-label">메모</span>
      <button class="fab-action-btn" id="writePostBtn" aria-label="메모 작성">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>

  </div>`;
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
      <div class="settings-scroll-body">

      <!-- 권한 설정 -->
      <div class="settings-section">
        <div class="settings-section-title">🔐 권한 설정</div>
        ${[
          ['requireAdmin', '관리자 로그인 필요'],
          ['showBulletin', '게시판 표시 (공지·댓글·작성·수정·삭제 포함)'],
        ].map(([key, label]) => `
        <div class="settings-row">
          <label class="settings-row-label" for="set-${key}">
            ${label}
            <button class="settings-help-btn" type="button" onclick="showSettingsHelp('${key}')">?</button>
          </label>
          <input type="checkbox" class="settings-cb" id="set-${key}">
        </div>`).join('')}
      </div>

      <!-- 메뉴 표시 설정 -->
      <div class="settings-section">
        <div class="settings-section-title">📋 메뉴 표시 설정</div>
        <div class="settings-row">
          <label class="settings-row-label" for="set-showPopupMenu">
            팝업 설정 메뉴 표시
            <button class="settings-help-btn" type="button" onclick="showSettingsHelp('showPopupMenu')">?</button>
          </label>
          <input type="checkbox" class="settings-cb" id="set-showPopupMenu">
        </div>
        <div class="settings-row">
          <label class="settings-row-label" for="set-showVehicleMenu">
            차량·행 설정 메뉴 표시
            <button class="settings-help-btn" type="button" onclick="showSettingsHelp('showVehicleMenu')">?</button>
          </label>
          <input type="checkbox" class="settings-cb" id="set-showVehicleMenu">
        </div>
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

      <!-- 배차 API 설정 -->
      <div class="settings-section">
        <div class="settings-section-title">🔗 배차 API 설정</div>
        <div class="settings-footer-group">
          <label class="settings-label" style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px;display:block">
            배차 API 기본 URL (끝 슬래시 생략)
          </label>
          <input type="text" id="set-dispatchApiBase" class="settings-input"
                 placeholder="https://api.kiki-bus.com/dispatch/126">
          <p style="font-size:11px;color:var(--color-text-tertiary);margin-top:4px;line-height:1.5">
            날짜(YYYY-MM-DD)가 자동으로 붙습니다.<br>
            예: .../dispatch/126 → .../dispatch/126/2026-03-25
          </p>
        </div>
      </div>

      <!-- 하단 안내문 -->
      <div class="settings-section">
        <div class="settings-section-title">📝 하단 안내문</div>
        <div class="settings-footer-group">
          <input type="text" id="set-footerLine1" class="settings-input" placeholder="첫째 줄">
          <input type="text" id="set-footerLine2" class="settings-input" placeholder="둘째 줄">
          <input type="text" id="set-footerLine3" class="settings-input" placeholder="셋째 줄 (경고문)">
          <div id="footerExtraInputs"></div>
          <button type="button" id="addFooterLineBtn" class="footer-add-btn">+ 줄 추가 (최대 10줄)</button>
          <div class="settings-version-row">
            <span class="settings-label">앱 버전</span>
            <input type="text" id="set-appVersion" class="settings-input settings-input-sm" placeholder="v3.1.0">
          </div>
        </div>
      </div>

    </div><!-- scroll end -->
    <div class="settings-btns-fixed">
      <button class="btn-primary" id="appSettingsSave">저장</button>
      <button class="btn-secondary" id="appSettingsCancel">취소</button>
      <button class="btn-danger" id="cleanDataBtn" aria-label="데이터 정리" title="10일 이전 데이터 삭제">🗑️ 데이터 정리</button>
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
      tmplDispatch() +
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

  /* ── FAB 토글 로직 (DOM 삽입 직후 바인딩) ── */
  document.addEventListener('DOMContentLoaded', () => {
    const fabMain     = document.getElementById('fabMain');
    const fabBackdrop = document.getElementById('fabBackdrop');
    const fabContainer = document.getElementById('fabContainer');
    if (!fabMain) return;

    function openFab() {
      fabContainer.classList.add('fab-open');
      fabBackdrop.classList.add('fab-open');
    }
    function closeFab() {
      fabContainer.classList.remove('fab-open');
      fabBackdrop.classList.remove('fab-open');
    }
    function toggleFab() {
      if (fabContainer.classList.contains('fab-open')) closeFab();
      else openFab();
    }

    fabMain.addEventListener('click', toggleFab);
    fabBackdrop.addEventListener('click', closeFab);

    /* 메뉴 아이템 클릭 시 자동 닫기 (+ 버튼 제외) */
    fabContainer.querySelectorAll('.fab-action-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(closeFab, 120));
    });
  });

  /* DocumentFragment로 한 번에 삽입 (리플로우 최소화) */
  const frag = document.createDocumentFragment();
  while (extras.firstChild) frag.appendChild(extras.firstChild);
  body.appendChild(frag);
})();
