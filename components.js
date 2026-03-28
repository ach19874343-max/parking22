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
        <!-- 수동/오토 불러오기 버튼 -->
        <button id="manualLoadBtn" class="header-action-btn admin-ui" aria-label="수동 배치 불러오기" title="수동 배치 불러오기" disabled>
          <span class="btn-label">수동</span>
        </button>
        <button id="autoLoadBtn" class="header-action-btn admin-ui" aria-label="오토 배치 불러오기" title="오토 배치 불러오기" disabled>
          <span class="btn-label">오토</span>
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
         Dispatch Section — Compact Card v2.0
         ══════════════════════════════════════ */
      .dispatch-section {
        padding: 6px 10px 4px;
        background: transparent;
        overflow: hidden;
      }

      /* ── 전체 카드 감싸기 ── */
      .dispatch-content {
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.07);
        box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      }
      .dark-mode .dispatch-content {
        background: #1C1E26;
        border-color: rgba(255,255,255,0.08);
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }

      /* ── 오늘 행 ── */
      .dispatch-row-today {
        background: #F8FAFF;
        padding: 5px 10px 4px;
      }
      .dark-mode .dispatch-row-today {
        background: rgba(37,99,235,0.08);
      }
      .dispatch-row-today .dispatch-day-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        color: #2563EB;
        text-transform: uppercase;
      }
      .dark-mode .dispatch-row-today .dispatch-day-label {
        color: #60A5FA;
      }

      /* ── 내일 행 ── */
      .dispatch-row-tomorrow {
        background: #F5F6FA;
        padding: 5px 10px 4px;
        border-top: 0.5px solid rgba(0,0,0,0.06);
      }
      .dark-mode .dispatch-row-tomorrow {
        background: rgba(255,255,255,0.04);
        border-top-color: rgba(255,255,255,0.06);
      }
      .dispatch-row-tomorrow .dispatch-day-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        color: #9CA3AF;
        text-transform: uppercase;
      }
      .dark-mode .dispatch-row-tomorrow .dispatch-day-label {
        color: #6B7280;
      }

      /* ── 행 내 레이아웃 ── */
      .dispatch-row-inner {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      .dispatch-date-label {
        font-size: 11px;
        font-weight: 600;
        color: #6B7280;
        letter-spacing: .01em;
      }
      .dark-mode .dispatch-date-label {
        color: #9CA3AF;
      }

      /* ── 칩 컨테이너: 7개 고정 그리드 ── */
      .dispatch-chips {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 3px;
        width: 100%;
      }

      /* ── 칩 기본 — 흰색 ── */
      .dc-chip {
        background: #fff;
        border: 1px solid #E5E7EB;
        border-radius: 6px;
        padding: 2px 0;
        font-size: 13px;
        font-weight: 700;
        color: #374151;
        line-height: 1.4;
        letter-spacing: .01em;
        text-align: center;
        min-width: 0;
      }
      .dark-mode .dc-chip {
        background: #2C2F3A;
        border-color: #374151;
        color: #E5E7EB;
      }

      /* ── 총5회차 (파란색) ── */
      .dc-chip--early {
        background: #DBEAFE;
        border-color: #93C5FD;
        color: #1E40AF;
      }
      .dark-mode .dc-chip--early {
        background: rgba(37,99,235,0.35);
        border-color: #3B82F6;
        color: #93C5FD;
      }

      /* ── 휴차 (주황색) ── */
      .dc-chip--absent {
        background: #FEF3C7;
        border-color: #FCD34D;
        color: #92400E;
      }
      .dark-mode .dc-chip--absent {
        background: rgba(245,158,11,0.25);
        border-color: #F59E0B;
        color: #FDE68A;
      }

      /* ── 불러오기 버튼 ── */
      .dispatch-load-btn-sm {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 6px;
        border: none;
        background: #2563EB;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: opacity .15s;
        white-space: nowrap;
        letter-spacing: .02em;
      }
      .dispatch-load-btn-sm:active { opacity: 0.8; transform: scale(.97); }
      .dark-mode .dispatch-load-btn-sm { background: #3B82F6; }
      .dispatch-load-btn-sm svg {
        width: 11px; height: 11px;
        stroke: currentColor; stroke-width: 2.2;
        stroke-linecap: round; stroke-linejoin: round;
        fill: none; flex-shrink: 0;
        transition: transform .4s ease;
      }
      .dispatch-load-btn-sm.spinning svg {
        animation: dc-spin .7s linear infinite;
      }
      @keyframes dc-spin { to { transform: rotate(360deg); } }

      /* ── 로딩 오버레이 ── */
      .dispatch-loading {
        position: fixed; inset: 0; z-index: 9000;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: rgba(0,0,0,0.60);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .dispatch-loading-inner {
        display: flex; flex-direction: column;
        align-items: center; gap: 16px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.20);
        border-radius: 22px; padding: 30px 40px 26px;
      }
      .dark-mode .dispatch-loading-inner {
        background: rgba(28,28,30,0.88);
        border-color: rgba(255,255,255,0.12);
      }
      .dispatch-spinner {
        width: 46px; height: 46px;
        border: 4px solid rgba(255,255,255,0.22);
        border-top-color: #3B82F6; border-radius: 50%;
        animation: dc-spin .75s linear infinite;
      }
      .dispatch-loading-text {
        font-size: 16px; font-weight: 800; color: #fff;
        letter-spacing: .02em; text-align: center;
        text-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .dispatch-loading-dots { display: inline-flex; gap: 6px; }
      .dispatch-loading-dots span {
        width: 8px; height: 8px; border-radius: 50%;
        background: #60A5FA; animation: dc-bounce 1.1s ease infinite;
      }
      .dispatch-loading-dots span:nth-child(2) { animation-delay: .18s; }
      .dispatch-loading-dots span:nth-child(3) { animation-delay: .36s; }
      @keyframes dc-bounce {
        0%,80%,100% { transform: scale(.5); opacity:.3; }
        40%         { transform: scale(1);  opacity:1; }
      }

      /* ── 제외된 휴차 칩 (취소선 + 회색) ── */
      .dc-chip--excluded {
        background: #F3F4F6 !important;
        border-color: #D1D5DB !important;
        color: #9CA3AF !important;
        opacity: 0.75;
      }
      .dc-chip--excluded s {
        text-decoration: line-through;
        text-decoration-color: #6B7280;
      }
      .dark-mode .dc-chip--excluded {
        background: #374151 !important;
        border-color: #4B5563 !important;
        color: #6B7280 !important;
      }
      /* ── 휴차 칩 long press 시각 피드백 ── */
      .dc-chip--absent:active {
        transform: scale(0.94);
        opacity: 0.75;
        transition: transform 0.08s, opacity 0.08s;
      }
      /* 흔들림 피드백 (iOS 포함 전 기기) */
      @keyframes dc-chip-shake {
        0%   { transform: scale(1.08) rotate(-4deg); }
        25%  { transform: scale(1.08) rotate(4deg); }
        50%  { transform: scale(1.08) rotate(-3deg); }
        75%  { transform: scale(1.08) rotate(3deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .dc-chip--shake {
        animation: dc-chip-shake 0.35s ease;
      }
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
      .dc-chip--absent.dc-chip--matched { outline-color: #EF4444 !important; }
    </style>

    <!-- ── 로딩 (전체화면 오버레이) ── -->
    <div id="dispatchLoading" class="dispatch-loading" style="display:none">
      <div class="dispatch-loading-inner">
        <div class="dispatch-spinner"></div>
        <div class="dispatch-loading-text">배차 순서 불러오는 중</div>
        <div class="dispatch-loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- ── 통합 버튼은 하단 탭바로 이동됨 ── -->
    <div id="dispatchEmptyHint" style="display:none"></div>

    <!-- ── 결과 ── -->
    <div id="dispatchContent" class="dispatch-content" style="display:none">
      <!-- 오늘 행 -->
      <div class="dispatch-row-today">
        <div class="dispatch-row-inner">
          <span class="dispatch-day-label">오늘 입차 순서</span>
          <span class="dispatch-date-label" id="dispatchTodayLbl"></span>
        </div>
        <div class="dispatch-chips" id="dispatchTodayChips"></div>
      </div>
      <!-- 내일 행 -->
      <div class="dispatch-row-tomorrow">
        <div class="dispatch-row-inner">
          <span class="dispatch-day-label">내일 출차 순서</span>
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
    <!-- 빈 날짜 안내 -->
    <div id="emptyGridHint" class="empty-grid-hint" style="display:none">
      <div class="empty-grid-icon">🅿️</div>
      <div class="empty-grid-title">주차 데이터 없음</div>
      <div class="empty-grid-desc">하단 <b>Auto Park</b>를 탭하면<br>배차를 불러와 최적 배치를 자동으로 완성합니다</div>
    </div>
    <div class="parking-grid" id="parkingGrid">
    </div>
  </main>`;
}

/* ── 게시판 영역 (하단 안내문) ───────────────────────────────── */
function tmplBulletin() {
  return `
  <footer class="parking-footer">
    <div class="footer-note" id="footerNote">
      <div class="fn-card" id="footerCard">
        <div class="fn-row">
          <span class="fn-icon">🚌</span>
          <span class="fn-text footer-line" id="footerLine1"></span>
        </div>
        <div class="fn-row">
          <span class="fn-icon">📅</span>
          <span class="fn-text footer-line" id="footerLine2"></span>
        </div>
        <div id="footerExtraLines"></div>
      </div>
      <div class="fn-warn" id="footerWarn">
        <span class="footer-line" id="footerLine3"></span>
      </div>
    </div>
    <div class="footer-version-row">
<p class="copyright">Copyright &copy; 2026 ChangHai An. &nbsp;|&nbsp; <span id="appVersion"></span> &nbsp;|&nbsp; <a href="manual.html" target="_blank" class="manual-link">사용설명서</a></p>
    </div>
  </footer>`;
}

function tmplBottomNav() {
  return `
  <!-- 하단 탭바 -->
  <nav class="bottom-nav" id="bottomNav">

    <!-- Auto Park (배차불러오기 + 자동주차 한방) -->
    <button class="bnav-btn bnav-btn--autopark" id="dispatchAutoBtn" aria-label="Auto Park">
      <span class="bnav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
        </svg>
      </span>
      <span class="bnav-label">Auto Park</span>
    </button>

    <!-- Sync 순서 (데이터 불러오기만) -->
    <button class="bnav-btn" id="dispatchLoadBtn" aria-label="Sync 순서">
      <span class="bnav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </span>
      <span class="bnav-label">Sync 순서</span>
    </button>

    <!-- 설정 -->
    <button class="bnav-btn" id="appSettingsBtn" aria-label="설정">
      <span class="bnav-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </span>
      <span class="bnav-label">설정</span>
    </button>

  </nav>`;
}


function tmplPopupSettingsModal() { return ''; }

function tmplPopupNotification() { return ''; }

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


      <!-- 🚌 차량 번호 관리 -->
      <div class="settings-section">
        <div class="settings-section-title">🚌 차량 번호 목록</div>
        <div id="vehicleEditorWrap" class="ve-list"></div>
        <div class="ve-add-row">
          <input id="newVehicleInput" type="text" inputmode="numeric" maxlength="4"
            class="settings-input" placeholder="차량번호 (예: 769)" style="flex:1">
          <button id="addVehicleBtn" type="button" class="btn-secondary ve-add-btn">+ 추가</button>
        </div>
      </div>

      <!-- 📋 주차 행 관리 -->
      <div class="settings-section">
        <div class="settings-section-title">📋 주차 행 목록</div>
        <div id="rowEditorWrap" class="ve-list"></div>
        <div class="ve-add-row">
          <input id="newRowInput" type="text" maxlength="8"
            class="settings-input" placeholder="행 라벨 (예: 8R)" style="flex:1">
          <button id="addRowBtn" type="button" class="btn-secondary ve-add-btn">+ 추가</button>
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
function tmplAdminModal() { return ''; }

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
  /* 앱 래퍼 내부: 헤더 → 주차그리드 → 배차칩 → 하단안내 → 탭바 */
  const wrapper = document.getElementById('app-wrapper');
  if (wrapper) {
    wrapper.innerHTML =
      tmplHeader() +
      tmplParkingGrid() +
      tmplDispatch() +
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

  /* ── FAB 토글 로직 제거됨 — 하단 탭바로 교체 ── */
  document.addEventListener('DOMContentLoaded', () => {
    // 하단 탭바 버튼들은 parking.js / dispatch.js / admin.js 에서 직접 바인딩
  });

  /* DocumentFragment로 한 번에 삽입 (리플로우 최소화) */
  const frag = document.createDocumentFragment();
  while (extras.firstChild) frag.appendChild(extras.firstChild);
  body.appendChild(frag);
})();
