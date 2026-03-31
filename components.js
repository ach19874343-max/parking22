/* ============================================================
   components.js — HTML 컴포넌트 템플릿 v2.1
   각 섹션을 함수로 분리 → index.html 은 뼈대만 유지
   ============================================================ */
'use strict';

/* ── 헤더 ──────────────────────────────────────────────────── */
function tmplHeader() {
  return `
  <header class="app-header">
    <input type="date" id="datePicker" autocomplete="off"
           style="position:absolute;opacity:0;width:0;height:0;pointer-events:none;">
    <div class="date-nav">
      <div class="date-pill-wrap" id="datePillWrap">

        <button id="prevDayBtn" class="date-nav-arrow" aria-label="이전날">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div class="date-display-pill">
          <span id="dateMainText" class="date-pill-text"></span>
          <span id="teamLabel" class="date-pill-team"></span>
        </div>

        <button id="nextDayBtn" class="date-nav-arrow" aria-label="다음날">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

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
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.05);
        box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      }

      /* ── 오늘 행 ── */
      .dispatch-row-today {
        background: #F8FAFF;
        padding: 5px 10px 4px;
      }
      .dispatch-row-today .dispatch-day-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        color: #2563EB;
        text-transform: uppercase;
      }

      /* ── 내일 행 ── */
      .dispatch-row-tomorrow {
        background: #F5F6FA;
        padding: 5px 10px 4px;
        border-top: 0.5px solid rgba(0,0,0,0.06);
      }
      .dispatch-row-tomorrow .dispatch-day-label {
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        color: #9CA3AF;
        text-transform: uppercase;
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

      /* ── 칩 컨테이너: 7개 고정 그리드 ── */
      .dispatch-chips {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 3px;
        width: 100%;
      }

      /* ── 칩 기본 ── */
      .dc-chip {
        background: #fff;
        border: 1px solid #E5E7EB;
        border-radius: 6px;
        padding: 3px 0;
        font-size: clamp(10px, 3vw, 13px);
        font-weight: 700;
        color: #374151;
        line-height: 1.4;
        letter-spacing: .01em;
        text-align: center;
        min-width: 0;
        overflow: hidden;
      }

      /* ── 총5회차 (연한 파랑) ── */
      .dc-chip--early {
        background: #EFF6FF;
        border-color: #BFDBFE;
        color: #2563EB;
      }

      /* ── 휴차 (연한 노랑) ── */
      .dc-chip--absent {
        background: #FEFCE8;
        border-color: #FEF08A;
        color: #92400E;
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
      <div class="empty-grid-desc">하단 <b>Auto Park</b>를 탭하면<br>차량번호를 불러와 최적 주차도를<br>자동으로 완성합니다.</div>
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
  <nav class="bottom-nav" id="bottomNav">

    <!-- Auto Park — 파란 아이콘 -->
    <button class="bnav-btn" id="dispatchAutoBtn" aria-label="Auto Park">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#0B7EF4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>
          </svg>
        </span>
        <span class="bnav-label">Auto Park</span>
      </span>
    </button>

    <!-- 배차순서조회 — 초록 아이콘 -->
    <button class="bnav-btn" id="dispatchLoadBtn" aria-label="순서조회">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#16A34A">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
        </span>
        <span class="bnav-label">순서조회</span>
      </span>
    </button>

    <!-- 오늘 — 주황 아이콘 -->
    <button class="bnav-btn" id="todayBtn" aria-label="오늘">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#EA580C">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
            <circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        <span class="bnav-label">오늘</span>
      </span>
    </button>

    <!-- 복사 — 보라 아이콘 -->
    <button class="bnav-btn" id="copyGridBtn" aria-label="복사">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#7C3AED">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </span>
        <span class="bnav-label">복사</span>
      </span>
    </button>

    <!-- 설정 — 회색 아이콘 -->
    <button class="bnav-btn" id="appSettingsBtn" aria-label="설정">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#6B7280">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </span>
        <span class="bnav-label">설정</span>
      </span>
    </button>

  </nav>`;
}


// (removed unused empty templates: popup settings/notification, vehicle panel)

// (removed unused empty templates: popup notification)

// (removed unused empty templates: vehicle panel)


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
// (removed unused empty templates: admin login modal)

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
