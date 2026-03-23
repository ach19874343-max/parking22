/* ============================================================
   팀 선택 & 알림 구독 관리
   ============================================================ */

/* ── 내 팀 가져오기/저장 ── */
function getMyTeam() {
  return localStorage.getItem('myTeam') || null; /* 'A' | 'B' | 'ALL' | null */
}
function setMyTeam(team) {
  localStorage.setItem('myTeam', team);
  updateTeamBadgeUI(team);
}

/* ── 하단 메뉴 내 팀 버튼 UI 업데이트 ── */
function updateTeamBadgeUI(team) {
  const label = document.getElementById('myTeamNavLabel');
  const icon  = document.getElementById('myTeamNavIcon');
  const btn   = document.getElementById('myTeamBtn');
  if (!label) return;
  if (!team) {
    label.textContent = '내 팀';
    if (btn) btn.style.color = '';
    return;
  }
  const map = {
    A:   { label: 'A TEAM', color: '#1D4ED8' },
    B:   { label: 'B TEAM', color: '#BE123C' },
    ALL: { label: '모두',   color: '#15803D' },
  };
  const m = map[team] || map.ALL;
  label.textContent = m.label;
  if (btn) btn.style.setProperty('color', m.color);
}

/* ── 팀 선택 모달 표시 ── */
function showTeamSelectModal() {
  const modal = document.getElementById('teamSelectModal');
  if (!modal) return;
  const cur = getMyTeam();
  /* 체크 표시 초기화 */
  ['A','B','ALL'].forEach(t => {
    const el = document.getElementById('check' + (t === 'ALL' ? 'All' : t));
    if (el) el.textContent = cur === t ? '✓' : '';
  });
  /* 클릭 이벤트 */
  ['A','B','ALL'].forEach(t => {
    const btn = document.getElementById('selectTeam' + (t === 'ALL' ? 'All' : t));
    if (btn) btn.onclick = () => {
      ['A','B','ALL'].forEach(tt => {
        const el = document.getElementById('check' + (tt === 'ALL' ? 'All' : tt));
        if (el) el.textContent = tt === t ? '✓' : '';
      });
      btn._selected = t;
      document.getElementById('teamSelectSave')._team = t;
    };
  });
  /* 저장 */
  const saveBtn = document.getElementById('teamSelectSave');
  saveBtn.onclick = async () => {
    const team = saveBtn._team || cur;
    if (!team) { alert('팀을 선택해주세요.'); return; }
    setMyTeam(team);
    /* 알림 구독 시 팀 정보도 같이 저장 */
    if (swRegistration) {
      const sub = await swRegistration.pushManager.getSubscription().catch(() => null);
      if (sub) await savePushToken(sub); /* 팀 정보 포함 재저장 */
    }
    modal.classList.remove('active');
    /* 처음 선택이면 알림 구독 유도 */
    if (Notification.permission === 'default') {
      setTimeout(() => showNotificationPrompt(), 500);
    }
  };
  /* 닫기 */
  document.getElementById('teamSelectClose').onclick = () => modal.classList.remove('active');
  modal.classList.add('active');
}

/* ── 첫 방문 팀 선택 안내 (3초 후) ── */
function checkFirstVisitTeam() {
  if (getMyTeam()) {
    updateTeamBadgeUI(getMyTeam());
    return;
  }
  if (sessionStorage.getItem('teamPromptShown')) return;
  sessionStorage.setItem('teamPromptShown', '1');
  setTimeout(() => showTeamSelectModal(), 3000);
}

/* ============================================================
   notifications.js — 푸시 알림 (Web Push + FCM)
   ============================================================ */
'use strict';

/* ── VAPID 공개키 (Firebase Console > 프로젝트 설정 > 클라우드 메시징 > 웹 푸시 인증서) ──
   아래 키를 본인 Firebase 프로젝트의 VAPID 키로 교체하세요 */
const VAPID_PUBLIC_KEY = 'BE6dScH_0If5WpfqlTU1EykdOy9MGAy5NuynABk2Rs7wIvUzntGW7sNL6-GL8bLSHJ3Si4MQPydEp0wT7-1cBL8';

/* ── FCM 서버키 (Firebase Console > 프로젝트 설정 > 클라우드 메시징 > 서버 키) ──
   Firebase DB에 저장해서 사용 (클라이언트 노출 최소화) */

let swRegistration = null;

/* ── base64 → Uint8Array 변환 ── */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

/* ── 서비스워커 등록 + 알림 구독 ── */
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('./sw.js');
    console.log('SW 등록 완료');
    /* 기존 구독 확인 */
    const existing = await swRegistration.pushManager.getSubscription();
    if (existing) {
      await savePushToken(existing);
    }
  } catch(e) {
    console.error('SW 등록 실패:', e);
  }
}

/* ── 알림 권한 요청 + 구독 ── */
async function requestPushPermission() {
  if (!swRegistration) await initPushNotifications();
  if (!swRegistration) { alert('이 브라우저는 푸시 알림을 지원하지 않습니다.'); return false; }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    alert('알림 권한이 거부됐습니다.\n기기 설정에서 알림을 허용해주세요.');
    return false;
  }

  try {
    const sub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await savePushToken(sub);
    return true;
  } catch(e) {
    console.error('구독 실패:', e);
    return false;
  }
}

/* ── 토큰을 Firebase DB에 저장 ── */
async function savePushToken(subscription) {
  try {
    const key = btoa(subscription.endpoint).slice(-20).replace(/[^a-zA-Z0-9]/g,'');
    await APP.set(APP.ref(APP.db, 'pushTokens/' + key), {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
        auth:   btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))),
      },
      team:      getMyTeam() || 'ALL', /* 팀 정보 포함 */
      updatedAt: new Date().toISOString(),
    });
  } catch(e) { console.error('토큰 저장 실패:', e); }
}

/* ── 관리자: GitHub Actions 통해 FCM V1 알림 발송 ── */
async function sendPushNotification() {
  if (!APP.isAdmin) return;

  /* 날짜 포함 메시지 자동 생성 */
  const dateEl = document.getElementById('datePicker');
  const dateVal = dateEl?.value || '';
  let dateLabel = '';
  if (dateVal) {
    const d = new Date(dateVal + 'T00:00:00');
    dateLabel = (d.getMonth()+1) + '/' + d.getDate() + ' ';
  }
  const body = dateLabel + '마감 주차도 업데이트';

  try {
    /* Firebase DB에서 구독 토큰 읽기 */
    const tokenSnap = await APP.get(APP.ref(APP.db, 'pushTokens'));
    if (!tokenSnap.exists()) {
      alert('등록된 구독자가 없습니다.\n방문자가 알림을 허용해야 발송할 수 있습니다.');
      return;
    }

    const allTokens = Object.values(tokenSnap.val());

    /* 날짜 기준 팀 계산 */
    let dateTeam = 'ALL';
    if (dateVal) {
      const base   = new Date('2026-03-14');
      const target = new Date(dateVal + 'T00:00:00');
      const diff   = Math.floor((target - base) / 86400000);
      dateTeam = diff % 2 === 0 ? 'B' : 'A';
    }


    /* 팀 필터링 — endpoint 있는 Web Push 구독자만 */
    const filtered = allTokens.filter(t =>
      t.endpoint && (!t.team || t.team === 'ALL' || t.team === dateTeam)
    );

    if (!filtered.length) {
      alert('발송할 구독자가 없습니다.\n먼저 방문자가 알림을 허용해야 합니다.');
      return;
    }

    /* GitHub 설정 확인 */
    const [ghSnap, repoSnap] = await Promise.all([
      APP.get(APP.ref(APP.db, 'appSettings/githubToken')),
      APP.get(APP.ref(APP.db, 'appSettings/githubRepo')),
    ]);

    if (!ghSnap.exists() || !repoSnap.exists()) {
      alert('GitHub 설정이 없습니다.\n앱 설정 > GitHub 토큰과 저장소를 입력해주세요.');
      return;
    }

    const ghToken = ghSnap.val();
    const repo    = repoSnap.val();

    /* Web Push 구독 정보 전체 전달 */
    const subscriptions = filtered.map(t => ({
      endpoint: t.endpoint,
      keys: t.keys,
    }));

    /* GitHub Actions 워크플로우 트리거 */
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        event_type: 'send-notification',
        client_payload: {
          notification: JSON.stringify({ title: '보영운수 22번 주차도', body }),
          subscriptions: JSON.stringify(subscriptions),
        },
      }),
    });

    if (res.status === 204) {
      alert(`알림 발송 요청 완료!\n대상: ${filtered.length}명`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert('발송 실패: ' + (err.message || res.status));
    }
  } catch(e) {
    console.error('발송 실패:', e);
    alert('알림 발송 중 오류가 발생했습니다.');
  }
}


/* ── 앱 시작 시 SW 등록 + 구독 안내 ── */
async function initNotifications() {
  await initPushNotifications();
  /* 첫 방문 팀 선택 체크 */
  checkFirstVisitTeam();

  /* 아직 구독 안 한 방문자에게 알림 배너 표시 */
  if (!swRegistration) return;
  const existing = await swRegistration.pushManager.getSubscription().catch(() => null);
  if (!existing && Notification.permission === 'default') {
    /* 팀 선택 후 알림 배너 표시 (이미 팀 선택했다면 바로) */
    if (getMyTeam()) setTimeout(() => showNotificationPrompt(), 5000);
  }
}

/* ── 알림 구독 유도 배너 ── */
function showNotificationPrompt() {
  if (sessionStorage.getItem('notiPromptDismissed')) return;
  /* 5초 후 표시 (앱 로드 안정화 후) */
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.id = 'notiPromptBanner';
    banner.style.cssText = `
      position:fixed; bottom:calc(var(--nav-h,60px) + var(--safe-b,0px) + 8px);
      left:12px; right:12px;
      background:#1C1C1E; color:#fff;
      border-radius:16px; padding:12px 16px;
      display:flex; align-items:center; gap:12px;
      z-index:300; box-shadow:0 4px 20px rgba(0,0,0,0.3);
      font-family:-apple-system,sans-serif;
    `;
    banner.innerHTML = `
      <span style="font-size:24px;flex-shrink:0;">🔔</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;">주차도 업데이트 알림</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;">업데이트 시 알림을 받을 수 있어요</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button id="notiAllow" style="height:30px;padding:0 14px;border-radius:15px;border:none;background:#fff;color:#1C1C1E;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;">허용</button>
        <button id="notiDeny"  style="height:30px;width:30px;border-radius:50%;border:none;background:rgba(255,255,255,0.12);color:#fff;font-size:14px;cursor:pointer;">✕</button>
      </div>`;
    document.body.appendChild(banner);
    document.getElementById('notiAllow').addEventListener('click', async () => {
      banner.remove();
      await requestPushPermission();
    });
    document.getElementById('notiDeny').addEventListener('click', () => {
      sessionStorage.setItem('notiPromptDismissed', '1');
      banner.remove();
    });
  }, 5000);
}
