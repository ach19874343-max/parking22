'use strict';
/* ============================================================
   app.js — 앱 초기화 (UA 감지 · PWA 배너)
   다크모드 즉시적용(깜빡임 방지) 코드는 index.html inline 유지
   ============================================================ */

/* ── UA 분석 ── */
const _ua           = navigator.userAgent;
const _isIOS        = /iphone|ipad|ipod/i.test(_ua);
const _isAndroid    = /android/i.test(_ua);
const _isKakao      = /KAKAOTALK|KAKAO/i.test(_ua);  /* 카카오톡 인앱 */
const _isStandalone = window.navigator.standalone === true ||
                      window.matchMedia('(display-mode: standalone)').matches;

const _isIOSInApp = _isIOS && !_isStandalone && (
  /Line\/|Instagram|FBAN|FBAV|Twitter|Snapchat|LinkedIn|Pinterest|Naver|DaumApps/i.test(_ua) ||
  (/AppleWebKit/i.test(_ua) && !/Safari/i.test(_ua)) ||
  /GSA\//i.test(_ua)
);
const _isAndroidInApp = _isAndroid && !_isStandalone && !_isKakao && (
  /Line\/|Instagram|FBAN|FBAV|FB_IAB|Twitter|Snapchat|Naver/i.test(_ua) ||
  /\bwv\b/.test(_ua)
);
const _isIOSSafari = _isIOS && !_isStandalone && !_isIOSInApp && !_isKakao &&
  /Safari/i.test(_ua) && !/Chrome|CriOS/i.test(_ua);

/* ── Android 인앱브라우저: 상단 설치 안내 배너 (카카오톡 제외) ── */
if (_isAndroidInApp && !sessionStorage.getItem('inappDismissed')) {
  const bar = document.createElement('div');
  bar.className = 'inapp-install-banner';
  bar.innerHTML = `
    <div class="inapp-install-banner-text">
      🌐 <b>Chrome 브라우저로 열면</b> 앱 설치 가능!<br>
      우측 ⋮ 메뉴 → <b>Chrome으로 열기</b>
    </div>
    <button class="inapp-install-banner-close" id="inappClose">✕</button>`;
  document.body.appendChild(bar);
  document.getElementById('inappClose').addEventListener('click', () => {
    sessionStorage.setItem('inappDismissed', '1');
    bar.remove();
  });
}

/* ── Android Chrome: PWA 설치 배너 ── */
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  if (!sessionStorage.getItem('pwaDismissed') && !_isStandalone) showAndroidBanner();
});

function showAndroidBanner() {
  if (document.getElementById('pwaBanner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwaBanner';
  banner.className = 'pwa-banner';
  banner.innerHTML = `
    <div class="pwa-banner-icon">
      <img src="https://ach19874343-max.github.io/parking22/f82ad08a-7649-49a3-9783-c426fac7c7f8.png" alt="">
    </div>
    <div class="pwa-banner-text">
      <strong>보영22주차 앱 설치</strong>
      <span>홈 화면에 추가하여 앱처럼 사용</span>
    </div>
    <div class="pwa-banner-btns">
      <button class="pwa-install-btn" id="pwaInstallBtn">설치</button>
      <button class="pwa-dismiss-btn" id="pwaDismissBtn">&#x2715;</button>
    </div>`;
  document.body.appendChild(banner);

  document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.remove();
  });
  document.getElementById('pwaDismissBtn').addEventListener('click', () => {
    sessionStorage.setItem('pwaDismissed', '1');
    banner.remove();
  });
}

/* ── iOS 홈화면 추가 안내 (Safari / 인앱브라우저, 카카오톡 제외) ── */
if ((_isIOSInApp || _isIOSSafari) && !_isStandalone && !_isKakao && !sessionStorage.getItem('iosDismissed')) {
  setTimeout(() => {
    const dim = document.createElement('div');
    dim.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;';
    document.body.appendChild(dim);

    const banner = document.createElement('div');
    banner.style.cssText = [
      'position:fixed','bottom:0','left:0','right:0',
      'background:#1C1C1E','color:#fff',
      'border-radius:24px 24px 0 0',
      'padding:8px 20px calc(20px + env(safe-area-inset-bottom))',
      'z-index:9999',
      'font-family:-apple-system,sans-serif',
      'animation:iosSlideUp 0.4s cubic-bezier(0.32,0.72,0,1)',
    ].join(';');

    banner.innerHTML = `
      <style>
        @keyframes iosSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes iosBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        .ios-step{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.08);border-radius:16px;padding:12px 14px;}
        .ios-step-icon{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .ios-step-num{font-size:10px;font-weight:800;color:rgba(255,255,255,0.4);margin-bottom:2px;letter-spacing:.06em;}
        .ios-step-desc{font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4;margin-top:2px;}
        .ios-step-desc b{color:#60A5FA;}
      </style>
      <div style="width:36px;height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin:10px auto 16px;"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:46px;height:46px;background:#fff;border-radius:12px;overflow:hidden;flex-shrink:0;">
            <img src="https://ach19874343-max.github.io/parking22/f82ad08a-7649-49a3-9783-c426fac7c7f8.png" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div>
            <div style="font-size:17px;font-weight:900;letter-spacing:-.4px;">홈 화면에 추가</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px;">앱처럼 바로 실행 가능</div>
          </div>
        </div>
        <button id="iosClose" style="background:rgba(255,255,255,0.1);border:none;color:rgba(255,255,255,0.6);width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#x2715;</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;" id="iosStepList"></div>`;

    document.body.appendChild(banner);

    const mkStep = (num, color, svgPath, title, desc, bounce) => {
      const el = document.createElement('div');
      el.className = 'ios-step';
      el.innerHTML =
        '<div class="ios-step-icon"' + (bounce ? ' style="animation:iosBounce 1.5s ease infinite"' : '') + '>' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="' + color +
        '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' + svgPath + '</svg>' +
        '</div><div><div class="ios-step-num">STEP ' + num + '</div>' +
        '<div style="font-size:14px;font-weight:800;">' + title + '</div>' +
        '<div class="ios-step-desc">' + desc + '</div></div>';
      return el;
    };

    const svgShare  = '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>';
    const svgSafari = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><polyline points="12 12 15 14"/>';
    const svgAdd    = '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>';

    const list = document.getElementById('iosStepList');
    if (_isIOSInApp) {
      list.appendChild(mkStep(1,'#FBBF24',svgSafari,'Safari로 열기','카카오톡·인스타 등 앱 안에서는 설치 불가<br><b>Safari 브라우저에서 열어주세요</b>',true));
      list.appendChild(mkStep(2,'#60A5FA',svgShare,'Safari 하단 가운데','<b>공유 버튼 (네모+화살표)</b> 탭',false));
      list.appendChild(mkStep(3,'#34D399',svgAdd,'스크롤해서 찾기','<b>"홈 화면에 추가"</b> 선택 → 추가',false));
    } else {
      list.appendChild(mkStep(1,'#60A5FA',svgShare,'Safari 하단 가운데','<b>공유 버튼 (네모+화살표)</b> 탭',true));
      list.appendChild(mkStep(2,'#34D399',svgAdd,'스크롤해서 찾기','<b>"홈 화면에 추가"</b> 선택 → 추가',false));
    }

    const closeFn = () => {
      sessionStorage.setItem('iosDismissed', '1');
      banner.remove();
      dim.remove();
    };
    document.getElementById('iosClose').addEventListener('click', closeFn);
    dim.addEventListener('click', closeFn);
  }, 2000);
}
