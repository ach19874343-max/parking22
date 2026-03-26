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

      /* ── 로딩 (전체화면 오버레이) ── */
      .dispatch-loading {
        position: fixed;
        inset: 0;
        z-index: 9000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.60);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .dispatch-loading-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.20);
        border-radius: 22px;
        padding: 30px 40px 26px;
      }
      .dark-mode .dispatch-loading-inner {
        background: rgba(28,28,30,0.88);
        border-color: rgba(255,255,255,0.12);
      }
      .dispatch-spinner {
        width: 46px; height: 46px;
        border: 4px solid rgba(255,255,255,0.22);
        border-top-color: #3B82F6;
        border-radius: 50%;
        animation: dc-spin .75s linear infinite;
      }
      .dispatch-loading-text {
        font-size: 16px;
        font-weight: 800;
        color: #ffffff;
        letter-spacing: .02em;
        text-align: center;
        text-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .dispatch-loading-dots {
        display: inline-flex; gap: 6px;
      }
      .dispatch-loading-dots span {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #60A5FA;
        animation: dc-bounce 1.1s ease infinite;
      }
      .dispatch-loading-dots span:nth-child(2) { animation-delay: .18s; }
      .dispatch-loading-dots span:nth-child(3) { animation-delay: .36s; }
      @keyframes dc-bounce {
        0%,80%,100% { transform: scale(.5); opacity:.3; }
        40%         { transform: scale(1);  opacity:1; }
      }

      /* ── 빈 힌트 (크고 잘 보이게) ── */
      .dispatch-empty-hint {
        padding: 14px 16px;
        font-size: 14px;
        font-weight: 700;
        color: #1D4ED8;
        letter-spacing: .01em;
        text-align: center;
        line-height: 1.6;
        background: #EFF6FF;
        border-bottom: 2px solid #BFDBFE;
      }
      .dark-mode .dispatch-empty-hint {
        background: #1E3A5F;
        border-bottom-color: #1D4ED8;
        color: #93C5FD;
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

    <!-- ── 빈 힌트 ── -->
    <div id="dispatchEmptyHint" class="dispatch-empty-hint">
    🚌   ✚ 버튼 → <strong>불러오기</strong>를 눌러 오늘·내일 배차번호를 불러온후<br> ✚ 버튼 →  <strong>자동주차</strong>를 클릭하세요
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
  <div class="fab-backdrop" id="fabBackdrop"></div>

  <!-- FAB 컨테이너: column-reverse → 아래(메인) 고정, 아이템 위로 상승 -->
  <div class="fab-container" id="fabContainer">

    <!-- column-reverse: DOM 위→아래 = 화면 위(멀리)→아래(메인 근처) -->
   
    <!-- ⓪ 메인 FAB — DOM 마지막 = column-reverse에서 맨 아래(화면 우하단) -->
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
    <!-- ① 설정 — 제일 위 -->
    <div class="fab-item" id="fabItemSettings">
      <span class="fab-item-label">설정</span>
      <button class="fab-action-btn" id="appSettingsBtn" aria-label="설정">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </div>

    <!-- ② 출차시뮬 -->
    <div class="fab-item" id="fabItemExitSim">
      <span class="fab-item-label">출차시뮬</span>
      <button class="fab-action-btn fab-action-btn--exitsim" id="exitSimBtn" aria-label="출차 시뮬레이션">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 8 16 12 12 16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- ③ 입차시뮬 -->
    <div class="fab-item" id="fabItemEntrySim">
      <span class="fab-item-label">입차시뮬</span>
      <button class="fab-action-btn fab-action-btn--entrysim" id="entrySimBtn" aria-label="입차 시뮬레이션">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 16 8 12 12 8"/>
          <line x1="16" y1="12" x2="8" y2="12"/>
        </svg>
      </button>
    </div>

    <!-- ④ 불러오기 -->
    <div class="fab-item" id="fabItemDispatch">
      <span class="fab-item-label">불러오기</span>
      <button class="fab-action-btn fab-action-btn--dispatch" id="dispatchLoadBtn" aria-label="배차 불러오기">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>
    </div>

    <!-- ⑤ 자동주차 — 메인 바로 위 -->
    <div class="fab-item" id="fabItemAutoPark">
      <span class="fab-item-label">자동주차</span>
      <button class="fab-action-btn fab-action-btn--autopark" id="autoParKBtn" aria-label="자동 주차 배치">
        <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
        </svg>
      </button>
    </div>

  </div>`;
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

    /* 서브 버튼 클릭 시 닫기 */
    fabContainer.querySelectorAll('.fab-item .fab-action-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(closeFab, 150));
    });
  });

  /* DocumentFragment로 한 번에 삽입 (리플로우 최소화) */
  const frag = document.createDocumentFragment();
  while (extras.firstChild) frag.appendChild(extras.firstChild);
  body.appendChild(frag);
})();
