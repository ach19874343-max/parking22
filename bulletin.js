/* ============================================================
   bulletin.js — 게시판 (오늘 / 어제 / 전체 탭 필터)
   ============================================================ */
'use strict';

/* ── HTML 이스케이프 (XSS 방지) ─────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ── ISO 날짜 문자열 헬퍼 ────────────────────────────── */
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

/* ── 시간 포맷 (오늘/어제 표시) ──────────────────────── */
function formatTime(isoStr) {
  if (!isoStr) return '';
  const d        = new Date(isoStr);
  const now      = new Date();
  const todayStr = toDateStr(now);
  const yest     = new Date(now); yest.setDate(yest.getDate() - 1);
  const yestStr  = toDateStr(yest);
  const dateStr  = isoStr.split('T')[0];

  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');

  if (dateStr === todayStr) return `<span class="time-badge today">오늘</span>${hh}:${mm}`;
  if (dateStr === yestStr)  return `<span class="time-badge yesterday">어제</span>${hh}:${mm}`;

  const mo = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${mo}-${dd} ${hh}:${mm}`;
}

/* ── 탭 필터 적용 ────────────────────────────────────── */
function filterPosts(postsArray) {
  const now      = new Date();
  const todayStr = toDateStr(now);
  const yest     = new Date(now); yest.setDate(yest.getDate() - 1);
  const yestStr  = toDateStr(yest);

  if (APP.bulletinFilter === 'today')
    return postsArray.filter(p => p.time?.startsWith(todayStr));
  if (APP.bulletinFilter === 'yesterday')
    return postsArray.filter(p => p.time?.startsWith(yestStr));
  return postsArray;   // 'all'
}

/* ── 게시글 렌더링 ────────────────────────────────────── */
async function loadBulletinPosts() {
  const container = document.getElementById('bulletinPosts');
  try {
    const snap = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
    container.innerHTML = '';

    if (!snap.exists()) {
      container.innerHTML = '<p class="bulletin-empty">게시글이 없습니다.</p>';
      return;
    }

    const raw      = snap.val();
    const allArr   = Array.isArray(raw) ? raw : Object.values(raw);
    /* 최신 글이 위에 오도록 역순 + 원본 인덱스 보존 */
    const indexed  = allArr.map((post, origIdx) => ({ ...post, _origIdx: origIdx }));
    const reversed = indexed.slice().reverse();
    const filtered = filterPosts(reversed);

    if (filtered.length === 0) {
      container.innerHTML = '<p class="bulletin-empty">해당 날짜의 게시글이 없습니다.</p>';
      return;
    }

    filtered.forEach(post => {
      const origIdx = post._origIdx;

      /* 답글 HTML */
      let repliesHTML = '';
      if (post.replies) {
        post.replies.forEach(r => {
          repliesHTML += `
            <div class="reply">
              └ ${escHtml(r.text)}
              <span class="reply-time">${formatTime(r.time)}</span>
            </div>`;
        });
      }

      const el = document.createElement('div');
      el.className = 'bulletin-post';
      el.innerHTML = `
        <div class="bulletin-post-content">${escHtml(post.text)}</div>
        <div class="bulletin-post-time">${formatTime(post.time)}</div>
        <div class="post-buttons" style="display:flex">
          <button class="replyBtn">답글</button>
          <button class="editBtn">수정</button>
          ${APP.isAdmin ? `<button class="bulletin-post-delete">삭제</button>` : ''}
        </div>
        <div class="reply-area"></div>
        <div class="reply-list">${repliesHTML}</div>`;

      /* ── 답글 ── */
      el.querySelector('.replyBtn').addEventListener('click', async () => {
        const area = el.querySelector('.reply-area');
        area.innerHTML = `
          <input class="replyInput" placeholder="답글을 입력하세요...">
          <button class="replySave">등록</button>`;
        area.querySelector('.replyInput').focus();
        area.querySelector('.replySave').addEventListener('click', async () => {
          const text = area.querySelector('.replyInput').value.trim();
          if (!text) return;
          const fresh = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
          const arr   = Array.isArray(fresh.val()) ? fresh.val() : Object.values(fresh.val());
          if (!arr[origIdx].replies) arr[origIdx].replies = [];
          arr[origIdx].replies.push({ text, time: new Date().toISOString() });
          await APP.set(APP.ref(APP.db, 'bulletin/posts'), arr);
          loadBulletinPosts();
        });
      });

      /* ── 수정 ── */
      el.querySelector('.editBtn').addEventListener('click', async () => {
        const fresh   = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
        const arr     = Array.isArray(fresh.val()) ? fresh.val() : Object.values(fresh.val());
        const newText = prompt('게시글 수정', arr[origIdx].text);
        if (newText === null) return;
        arr[origIdx].text = newText;
        await APP.set(APP.ref(APP.db, 'bulletin/posts'), arr);
        loadBulletinPosts();
      });

      /* ── 삭제 (관리자만 버튼 표시 → null 체크 필수) ── */
      const deleteBtn = el.querySelector('.bulletin-post-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('이 글을 삭제하시겠습니까?')) return;
          const fresh = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
          const arr   = Array.isArray(fresh.val()) ? fresh.val() : Object.values(fresh.val());
          arr.splice(origIdx, 1);
          await APP.set(APP.ref(APP.db, 'bulletin/posts'), arr);
          loadBulletinPosts();
        });
      }

      container.appendChild(el);
    });

  } catch (err) {
    console.error('게시판 로드 실패:', err);
  }
}

/* ── 초기화 ──────────────────────────────────────────── */
async function initBulletin() {
  APP.loadBulletinPosts = loadBulletinPosts;

  /* ── 게시글 작성 (postSubmit) ── */
  document.getElementById('postSubmit').addEventListener('click', async () => {
    const input = document.getElementById('bulletinInput');
    const text  = input.value.trim();
    if (!text) { alert('내용을 입력해주세요.'); return; }

    try {
      const snap = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
      let posts  = [];
      if (snap.exists()) {
        const data = snap.val();
        posts = Array.isArray(data) ? data : Object.values(data);
      }
      posts.push({ text, time: new Date().toISOString() });
      await APP.set(APP.ref(APP.db, 'bulletin/posts'), posts);
      input.value = '';
      document.getElementById('writePopup').style.display = 'none';
      loadBulletinPosts();
    } catch (err) {
      console.error('게시판 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  });

  /* ── 글쓰기 플로팅 버튼 ── */
  document.getElementById('writePostBtn').addEventListener('click', () => {
    document.getElementById('writePopup').style.display = 'flex';
    setTimeout(() => document.getElementById('bulletinInput').focus(), 150);
  });

  /* ── 취소 버튼 ── */
  document.getElementById('postCancel').addEventListener('click', () => {
    document.getElementById('writePopup').style.display = 'none';
  });

  await loadBulletinPosts();
}
