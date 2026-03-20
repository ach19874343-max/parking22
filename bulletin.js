/* ============================================================
   bulletin.js — 게시판 v2.3
   - savePosts: null 슬롯 제거
   - 수정/메모: 인라인 입력창 (바텀시트 제거)
   ============================================================ */
'use strict';

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const todayStr = toDateStr(now);
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const yestStr = toDateStr(yest);
  const dateStr = isoStr.split('T')[0];
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  if (dateStr === todayStr) return '<span class="time-badge today">오늘</span>' + hh + ':' + mm;
  if (dateStr === yestStr)  return '<span class="time-badge yesterday">어제</span>' + hh + ':' + mm;
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return mo + '-' + dd + ' ' + hh + ':' + mm;
}

function filterPosts(postsArray) {
  const now = new Date();
  const todayStr = toDateStr(now);
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const yestStr = toDateStr(yest);
  if (APP.bulletinFilter === 'today')
    return postsArray.filter(p => p.time && p.time.startsWith(todayStr));
  if (APP.bulletinFilter === 'yesterday')
    return postsArray.filter(p => p.time && p.time.startsWith(yestStr));
  return postsArray;
}

async function fetchPosts() {
  const snap = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
  if (!snap.exists()) return [];
  const raw = snap.val();
  return Array.isArray(raw) ? raw : Object.values(raw);
}

async function savePosts(arr) {
  const clean = arr.filter(p => p != null);
  await APP.set(APP.ref(APP.db, 'bulletin/posts'), clean);
}

/* 인라인 수정창 */
function openInlineEdit(container, currentText, placeholder, onSave) {
  if (container.innerHTML !== '') { container.innerHTML = ''; return; }
  container.innerHTML =
    '<div class="reply-input-row">' +
      '<textarea class="inlineEditInput" placeholder="' + placeholder + '" rows="2">' + escHtml(currentText) + '</textarea>' +
      '<div class="reply-action-row">' +
        '<button class="inlineEditSave replySave">저장</button>' +
        '<button class="inlineEditCancel replyCancel">취소</button>' +
      '</div>' +
    '</div>';
  const ta = container.querySelector('.inlineEditInput');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  container.querySelector('.inlineEditCancel').addEventListener('click', () => {
    container.innerHTML = '';
  });
  container.querySelector('.inlineEditSave').addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) return;
    container.innerHTML = '';
    onSave(text);
  });
}

async function loadBulletinPosts() {
  const container = document.getElementById('bulletinPosts');
  try {
    const snap = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
    container.innerHTML = '';

    if (!snap.exists()) {
      container.innerHTML = '<p class="bulletin-empty">게시글이 없습니다.</p>';
      return;
    }

    const raw     = snap.val();
    const allArr  = Array.isArray(raw) ? raw : Object.values(raw);
    const indexed = allArr.map((post, origIdx) => ({ ...post, _origIdx: origIdx }));
    const filtered = filterPosts(indexed.slice().reverse());

    if (filtered.length === 0) {
      container.innerHTML = '<p class="bulletin-empty">해당 날짜의 게시글이 없습니다.</p>';
      return;
    }

    filtered.forEach(post => {
      const origIdx = post._origIdx;

      let repliesHTML = '';
      if (post.replies) {
        post.replies.forEach((r, rIdx) => {
          repliesHTML +=
            '<div class="reply-item" data-ridx="' + rIdx + '">' +
              '<div class="reply-item-header">' +
                '<span class="reply-arrow">\u2514</span>' +
                '<span class="reply-text">' + escHtml(r.text) + '</span>' +
              '</div>' +
              '<div class="reply-meta">' +
                '<span class="reply-time">' + formatTime(r.time) + '</span>' +
                '<div class="reply-btns">' +
                  '<button class="reply-edit-btn">수정</button>' +
                  '<button class="reply-del-btn">삭제</button>' +
                '</div>' +
              '</div>' +
              '<div class="reply-edit-area"></div>' +
            '</div>';
        });
      }

      const el = document.createElement('div');
      el.className = 'bulletin-post';
      el.innerHTML =
        '<div class="bulletin-post-content">' + escHtml(post.text) + '</div>' +
        '<div class="bulletin-post-time">' + formatTime(post.time) + '</div>' +
        '<div class="post-buttons">' +
          '<button class="replyBtn">답글</button>' +
          '<button class="editBtn">수정</button>' +
          (APP.isAdmin ? '<button class="bulletin-post-delete">삭제</button>' : '') +
        '</div>' +
        '<div class="edit-area"></div>' +
        '<div class="reply-area"></div>' +
        '<div class="reply-list">' + repliesHTML + '</div>';

      /* 답글 */
      el.querySelector('.replyBtn').addEventListener('click', () => {
        const area = el.querySelector('.reply-area');
        if (area.innerHTML !== '') { area.innerHTML = ''; return; }
        area.innerHTML =
          '<div class="reply-input-row">' +
            '<input class="replyInput" placeholder="답글을 입력하세요...">' +
            '<div class="reply-action-row">' +
              '<button class="replySave">등록</button>' +
              '<button class="replyCancel">취소</button>' +
            '</div>' +
          '</div>';
        area.querySelector('.replyInput').focus();
        area.querySelector('.replyCancel').addEventListener('click', () => { area.innerHTML = ''; });
        area.querySelector('.replySave').addEventListener('click', async () => {
          const text = area.querySelector('.replyInput').value.trim();
          if (!text) return;
          const arr = await fetchPosts();
          if (!arr[origIdx].replies) arr[origIdx].replies = [];
          arr[origIdx].replies.push({ text, time: new Date().toISOString() });
          await savePosts(arr);
          loadBulletinPosts();
        });
      });

      /* 게시글 수정 → 인라인 */
      el.querySelector('.editBtn').addEventListener('click', async () => {
        const area = el.querySelector('.edit-area');
        const arr  = await fetchPosts();
        openInlineEdit(area, arr[origIdx].text, '수정할 내용을 입력하세요...', async newText => {
          arr[origIdx].text = newText;
          await savePosts(arr);
          loadBulletinPosts();
        });
      });

      /* 게시글 삭제 */
      const deleteBtn = el.querySelector('.bulletin-post-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('이 글을 삭제하시겠습니까?')) return;
          const arr = await fetchPosts();
          arr.splice(origIdx, 1);
          await savePosts(arr);
          loadBulletinPosts();
        });
      }

      /* 답글 수정/삭제 */
      el.querySelector('.reply-list').addEventListener('click', async e => {
        const replyItem = e.target.closest('.reply-item');
        if (!replyItem) return;
        const rIdx = parseInt(replyItem.dataset.ridx);

        if (e.target.classList.contains('reply-del-btn')) {
          if (!confirm('이 답글을 삭제하시겠습니까?')) return;
          const arr = await fetchPosts();
          arr[origIdx].replies.splice(rIdx, 1);
          await savePosts(arr);
          loadBulletinPosts();
          return;
        }

        if (e.target.classList.contains('reply-edit-btn')) {
          const area = replyItem.querySelector('.reply-edit-area');
          const arr  = await fetchPosts();
          openInlineEdit(area, arr[origIdx].replies[rIdx].text, '답글을 수정하세요...', async newText => {
            arr[origIdx].replies[rIdx].text = newText;
            await savePosts(arr);
            loadBulletinPosts();
          });
        }
      });

      container.appendChild(el);
    });

  } catch (err) {
    console.error('게시판 로드 실패:', err);
  }
}

async function initBulletin() {
  APP.loadBulletinPosts = loadBulletinPosts;

  /* 메모 버튼 → 게시판 상단 인라인 입력창 */
  document.getElementById('writePostBtn').addEventListener('click', () => {
    const area = document.getElementById('bulletinWriteArea');
    if (area.style.display !== 'none' && area.style.display !== '') {
      area.style.display = 'none';
      return;
    }
    area.style.display = 'block';
    area.querySelector('.bulletinWriteInput').value = '';
    setTimeout(() => area.querySelector('.bulletinWriteInput').focus(), 80);
  });

  document.getElementById('bulletinWriteCancel').addEventListener('click', () => {
    document.getElementById('bulletinWriteArea').style.display = 'none';
  });

  document.getElementById('bulletinWriteSubmit').addEventListener('click', async () => {
    const input = document.getElementById('bulletinWriteArea').querySelector('.bulletinWriteInput');
    const text  = input.value.trim();
    if (!text) { alert('내용을 입력해주세요.'); return; }
    try {
      const arr = await fetchPosts();
      arr.push({ text, time: new Date().toISOString() });
      await savePosts(arr);
      input.value = '';
      document.getElementById('bulletinWriteArea').style.display = 'none';
      loadBulletinPosts();
    } catch (err) {
      console.error('게시판 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  });

  await loadBulletinPosts();

  /* ── 1달 이상 지난 게시글 자동 정리 ── */
  cleanOldBulletinPosts();
}

async function cleanOldBulletinPosts() {
  try {
    const arr = await fetchPosts();
    if (!arr.length) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 31);
    const cutoffISO = cutoff.toISOString();
    const filtered = arr.filter(p => p && p.time && p.time > cutoffISO);
    if (filtered.length < arr.length) {
      await savePosts(filtered);
      console.log('🗑️ 오래된 게시글 ' + (arr.length - filtered.length) + '건 삭제');
    }
  } catch (err) {
    console.error('게시판 정리 실패:', err);
  }
}
