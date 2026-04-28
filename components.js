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
    <div class="header-row">
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
    </div>
  </header>`;
}

/* ── 배차 현황 섹션 (관리자 전용) ─────────────────────────── */
function tmplDispatch() {
  return `
  <section id="dispatchSection" class="dispatch-section" style="display:none">

    <!-- ── 로딩 (전체화면 오버레이) ── -->
    <div id="dispatchLoading" class="dispatch-loading" style="display:none">
      <div class="dispatch-loading-inner">
        <div class="dispatch-spinner"></div>
        <div class="dispatch-loading-text">배차 순서 불러오는 중</div>
        <div id="dispatchLoadingProgress" class="dispatch-loading-progress"></div>
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

    <!-- Auto Park -->
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

    <!-- 순서조회 -->
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

    <!-- 시뮬 — 하늘 아이콘 -->
    <button class="bnav-btn" id="todayBtn" aria-label="오늘">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#F59E0B">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2.5" x2="16" y2="6"/>
            <line x1="8" y1="2.5" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </span>
        <span class="bnav-label">오늘</span>
      </span>
    </button>

    <!-- 시뮬 (더보기에서만 노출 — 클릭 위임용으로 DOM 유지) -->
    <button class="bnav-btn bnav-desktop-only" id="parkingSimBtn" aria-label="시뮬">
      <span class="bnav-inner">
        <span class="bnav-icon" style="color:#0EA5E9">
          <span style="font-size:18px;line-height:1">🎮</span>
        </span>
        <span class="bnav-label">시뮬</span>
      </span>
    </button>

    <!-- 설정 (더보기에서만 노출 — 클릭 위임용으로 DOM 유지) -->
    <button class="bnav-btn bnav-desktop-only" id="appSettingsBtn" aria-label="설정">
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

    <!-- 더보기 -->
    <div class="bnav-more-wrap" id="morePopWrap">
      <button class="bnav-btn" id="moreMenuBtn" aria-label="더보기">
        <span class="bnav-inner">
          <span class="bnav-icon" style="color:#6B7280">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="5" cy="12" r="1.6"/>
              <circle cx="12" cy="12" r="1.6"/>
              <circle cx="19" cy="12" r="1.6"/>
            </svg>
          </span>
          <span class="bnav-label">더보기</span>
        </span>
      </button>

      <div class="bnav-more-pop" id="morePop" aria-hidden="true">
        <button class="bnav-more-btn" id="moreSettingsBtn" aria-label="설정">
          <span class="bnav-more-icon" style="color:#6B7280">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </span>
          <span class="bnav-more-label">설정</span>
        </button>

        <button class="bnav-more-btn" id="moreSimBtn" aria-label="시뮬">
          <span class="bnav-more-icon" style="color:#0EA5E9">
            <span style="font-size:18px;line-height:1">🎮</span>
          </span>
          <span class="bnav-more-label">시뮬</span>
        </button>

        <button class="bnav-more-btn" id="moreDriverRankBtn" aria-label="고참순위 조회">
          <span class="bnav-more-icon" style="color:#2563EB">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 6h13"/>
              <path d="M8 12h13"/>
              <path d="M8 18h13"/>
              <path d="M3 6h.01"/>
              <path d="M3 12h.01"/>
              <path d="M3 18h.01"/>
            </svg>
          </span>
          <span class="bnav-more-label">고참순위</span>
        </button>

        <button class="bnav-more-btn" id="moreDriverContactBtn" aria-label="연락처 조회">
          <span class="bnav-more-icon" style="color:#059669">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </span>
          <span class="bnav-more-label">연락처</span>
        </button>
      </div>
    </div>

  </nav>`;
}


// (removed unused empty templates: popup settings/notification, vehicle panel)

// (removed unused empty templates: popup notification)

// (removed unused empty templates: vehicle panel)


/* ── 앱 설정 대시보드 ──────────────────────────────────────── */
function tmplAppSettingsModal() {
  return `
  <div class="ap-sheet-modal" id="appSettingsModal">
    <div class="ap-sheet settings settings-modal-box">
      <div class="ap-sheet-grabber"></div>
      <div class="ap-sheet-header">
        <div class="ap-sheet-title">⚙️ 앱 설정</div>
        <button class="ap-sheet-close" id="appSettingsClose" aria-label="닫기">&#10005;</button>
      </div>
      <div class="settings-scroll-body ap-sheet-body">

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

      <!-- 🧠 자동주차 학습 -->
      <div class="settings-section">
        <div class="settings-section-title">🧠 자동주차 학습</div>
        <div class="settings-footer-group">
          <p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:8px;line-height:1.6">
            현재 선택된 날짜의 주차판 배치를 학습합니다.<br>
            입차 순·내일 순위·휴차 수·행별 운행 분포가 비슷한 날의 기록을 가중 합쳐 힌트로 쓰며, 자동주차 탐색에서 슬롯·휴차 후보 순서에 반영됩니다.
          </p>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <button type="button" id="apLearnSaveBtn" class="btn-secondary"
              style="flex:1;min-width:140px">
              🧠 현재 배치 학습 저장
            </button>
            <span id="apLearnCountBadge"
              style="font-size:12px;color:var(--color-text-secondary);white-space:nowrap">
              학습 데이터: —
            </span>
          </div>
          <p id="apLearnStatusMsg"
            style="font-size:12px;margin-top:6px;color:var(--color-success);min-height:18px"></p>

          <!-- 자동주차 옵션 -->
          <div style="margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(0,0,0,0.08)">
            <label class="settings-radio" style="gap:8px">
              <input type="checkbox" id="set-exitChainAllowMissing4R">
              <span style="font-size:13px">
                출차 체인 제약: <b>4R 1번칸이 비면 완화</b> (완벽해가 더 잘 나옴)
              </span>
            </label>
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

/* ── 운전기사 조회 모달 (더보기 메뉴) ───────────────────────── */
function tmplDriverLookupModal() {
  return `
  <div class="ap-sheet-modal" id="driverLookupModal">
    <div class="ap-sheet settings settings-modal-box" style="max-height:90vh">
      <div class="ap-sheet-grabber"></div>
      <div class="ap-sheet-header">
        <div class="ap-sheet-title">🚌 운전기사 조회</div>
        <button class="ap-sheet-close" id="driverLookupClose" aria-label="닫기">&#10005;</button>
      </div>
      <div class="settings-scroll-body ap-sheet-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <button id="driverLookupRankBtn" type="button" class="btn-secondary" style="flex:1;min-width:140px;border:2px solid #2563eb;background:#eff6ff;color:#2563eb;font-weight:900;">
            고참순위 조회
          </button>
          <button id="driverLookupContactBtn" type="button" class="btn-secondary" style="flex:1;min-width:140px;border:2px solid #059669;background:#ecfdf5;color:#059669;font-weight:900;">
            연락처 조회
          </button>
          <button id="driverLookupCopyBtn" type="button" class="btn-secondary" style="flex:1;min-width:110px;border:2px solid #7c3aed;background:#f5f3ff;color:#7c3aed;font-weight:900;">
            📋 복사
          </button>
        </div>

        <div id="driverLookupStatusMsg" style="font-size:12px;min-height:18px;color:rgba(255,255,255,0.78);margin-bottom:8px;"></div>
        <div id="driverLookupNote" style="font-size:12px;color:rgba(255,255,255,0.72);line-height:1.6;margin:-4px 0 10px;white-space:pre-wrap;">
          ※ 참고: 고참 순위 및 연락처는 솔루션에서 추출한 값이라 실제와 다를 수 있습니다.
        </div>
        <div id="driverLookupErrorBox" style="display:none;background:rgba(248,113,113,0.14);border:1px solid rgba(248,113,113,0.28);border-radius:12px;padding:10px 12px;font-size:12px;color:#fecaca;white-space:pre-wrap;line-height:1.6;margin-bottom:10px;"></div>

        <div id="driverLookupResultArea" style="display:none;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
            <div id="driverLookupTitle" style="font-size:15px;font-weight:900;color:#fff;letter-spacing:-.02em;"></div>
            <div id="driverLookupCount" style="font-size:12px;color:rgba(255,255,255,0.78);background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:2px 10px;"></div>
          </div>
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-radius:14px;overflow-y:auto;overflow-x:hidden;max-height:56vh;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:0;table-layout:fixed;">
              <thead id="driverLookupHead"></thead>
              <tbody id="driverLookupBody"></tbody>
            </table>
          </div>
        </div>
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
  // 모바일 주소창/툴바로 innerHeight가 변하면 하단 행(5R~7R)이 탭바 아래로 숨어 터치가 먹통처럼 될 수 있음
  // → resize/visualViewport resize 때마다 --app-vh를 갱신하여 항상 레이아웃이 맞도록 유지
  let _vhT = null;
  const scheduleVh = () => {
    clearTimeout(_vhT);
    _vhT = setTimeout(setAppVh, 60);
  };
  window.addEventListener('resize', scheduleVh, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(setAppVh, 300), { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleVh, { passive: true });
  }
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
    tmplDriverLookupModal() +
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
