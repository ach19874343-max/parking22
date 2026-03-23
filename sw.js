/* ============================================================
   sw.js — Service Worker (푸시 알림 + PWA 캐싱)
   ============================================================ */
const CACHE_NAME = 'parking22-v1';

/* 설치 */
self.addEventListener('install', e => {
  self.skipWaiting();
});

/* 활성화 */
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

/* 푸시 수신 */
self.addEventListener('push', e => {
  if (!e.data) return;
  let payload;
  try { payload = e.data.json(); }
  catch { payload = { title: '보영운수 22번', body: e.data.text() }; }

  const options = {
    body:    payload.body  || '주차도가 업데이트됐습니다.',
    icon:    'https://ach19874343-max.github.io/parking22/f82ad08a-7649-49a3-9783-c426fac7c7f8.png',
    badge:   'https://ach19874343-max.github.io/parking22/f82ad08a-7649-49a3-9783-c426fac7c7f8.png',
    tag:     'parking22-update',
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: payload.url || self.registration.scope },
  };

  e.waitUntil(
    self.registration.showNotification(payload.title || '보영운수 22번 주차도', options)
  );
});

/* 알림 클릭 → 앱 열기 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const c of clients) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
