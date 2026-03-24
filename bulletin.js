/* ============================================================
   bulletin.js — 게시판 v3.1
   탭: 전체 / 공지 / 메모
   - 전체탭: 최근 답글 시간 기준 정렬 (답글 달면 위로)
   - 공지/메모탭: 원본 등록 시간 기준 정렬 (답글 영향 없음)
   - 공지: 1줄 요약, 메모: 3줄, 답글: 2줄 — 펼치기▼ 버튼
   - 공지 삭제: 로그인 시에만
   - 공지 체크박스: 로그인 시에만 표시
   - 수정 시 공지 체크박스: 현재 상태 반영, 체크 해제 시 일반 메모
   ============================================================ */
'use strict';

/* ── 유틸 ── */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatTime(iso) {
  if (!iso) return '';
  const d   = new Date(iso);
  const now = new Date();
  const hh  = String(d.getHours()).padStart(2,'0');
  const mm  = String(d.getMinutes()).padStart(2,'0');
  if (iso.startsWith(toDateStr(now)))  return '<span class="time-badge today">오늘</span>' + hh + ':' + mm;
  const yest = new Date(now); yest.setDate(yest.getDate()-1);
  if (iso.startsWith(toDateStr(yest))) return '<span class="time-badge yesterday">어제</span>' + hh + ':' + mm;
  /* 그 외: 년월일만 표시 */
  return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0');
}

/* 글의 "최신 활동 시간" = 마지막 답글 or 원본 시간 */
function latestActivity(post) {
  if (post.replies && post.replies.length) {
    const times = post.replies.map(r => r.time || '').filter(Boolean);
    if (times.length) return times.sort().pop();
  }
  return post.time || '';
}

/* ── Firebase ── */
async function fetchPosts() {
  const snap = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
  if (!snap.exists()) return [];
  const raw = snap.val();
  return Array.isArray(raw) ? raw : Object.values(raw);
}
async function savePosts(arr) {
  await APP.set(APP.ref(APP.db, 'bulletin/posts'), arr.filter(p => p != null));
}

/* ── 인라인 수정창 (공지 체크 옵션 포함) ── */
function openInlineEdit(container, currentText, isCurrentNotice, placeholder, onSave) {
  if (container.innerHTML !== '') { container.innerHTML = ''; return; }
  const canNoticeEdit = APP.isAdmin || APP.settings?.allowNotice === false;
  const noticeRow = canNoticeEdit
    ? `<div class="bulletin-write-options">
         <label class="notice-check-label">
           <input type="checkbox" class="editNoticeCheckbox" ${isCurrentNotice ? 'checked' : ''}>
           <span class="notice-check-text">📢 공지글로 등록</span>
         </label>
       </div>` : '';
  container.innerHTML =
    '<div class="reply-input-row">' +
      '<textarea class="inlineEditInput" placeholder="' + placeholder + '" rows="2">' + escHtml(currentText) + '</textarea>' +
      noticeRow +
      '<div class="reply-action-row">' +
        '<button class="inlineEditSave replySave">저장</button>' +
        '<button class="inlineEditCancel replyCancel">취소</button>' +
      '</div>' +
    '</div>';
  const ta = container.querySelector('.inlineEditInput');
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  container.querySelector('.inlineEditCancel').addEventListener('click', () => { container.innerHTML = ''; });
  container.querySelector('.inlineEditSave').addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) return;
    const cb = container.querySelector('.editNoticeCheckbox');
    const newIsNotice = cb ? cb.checked : isCurrentNotice;
    container.innerHTML = '';
    onSave(text, newIsNotice);
  });
}

/* ── 현재 탭 / 페이지 ── */
let bulletinTab  = 'all';
let bulletinPage = 1;
const POSTS_PER_PAGE = 5;

/* ── 게시글 렌더링 ── */
async function loadBulletinPosts() {
  const container = document.getElementById('bulletinPosts');
  if (!container) return;
  try {
    const snap = await APP.get(APP.ref(APP.db, 'bulletin/posts'));
    container.innerHTML = '';
    if (!snap.exists()) {
      container.innerHTML = '<p class="bulletin-empty">게시글이 없습니다.</p>';
      return;
    }

    const raw    = snap.val();
    const allArr = Array.isArray(raw) ? raw : Object.values(raw);
    const indexed = allArr.map((p, i) => ({ ...p, _origIdx: i }));

    let list;
    if (bulletinTab === 'notice') {
      /* 공지 탭: 공지만, 원본 시간 내림차순 */
      list = indexed.filter(p => p.isNotice).sort((a,b) => (b.time||'').localeCompare(a.time||''));
    } else if (bulletinTab === 'memo') {
      /* 메모 탭: 메모만, 원본 시간 내림차순 */
      list = indexed.filter(p => !p.isNotice).sort((a,b) => (b.time||'').localeCompare(a.time||''));
    } else {
      /* 전체 탭: 최근 활동(답글) 시간 기준 내림차순 */
      list = indexed.slice().sort((a,b) => latestActivity(b).localeCompare(latestActivity(a)));
    }

    if (!list.length) {
      container.innerHTML = '<p class="bulletin-empty">게시글이 없습니다.</p>';
      return;
    }

    /* ── 페이지네이션 계산 ── */
    const totalPages = Math.ceil(list.length / POSTS_PER_PAGE);
    if (bulletinPage > totalPages) bulletinPage = totalPages;
    const pageStart  = (bulletinPage - 1) * POSTS_PER_PAGE;
    const pageList   = list.slice(pageStart, pageStart + POSTS_PER_PAGE);

    pageList.forEach(post => {
      const oi        = post._origIdx;
      const isNotice  = !!post.isNotice;
      const canDelete = isNotice
        ? APP.isAdmin
        : (APP.settings?.allowDelete !== false || APP.isAdmin);

      /* ── 답글 HTML ── */
      const replyCount = post.replies ? post.replies.length : 0;
      let repliesHTML = '';
      if (replyCount > 0) {
        /* 최신 답글(마지막): 1줄 미리보기 항상 표시 */
        const r0 = post.replies[post.replies.length - 1];
        repliesHTML +=
          '<div class="reply-preview">' +
            '<span class="reply-arrow">└</span>' +
            '<span class="reply-preview-text">' + escHtml(r0.text) + '</span>' +
            (replyCount > 1
              ? '<span class="reply-count-badge">+' + (replyCount - 1) + '</span>'
              : '') +
          '</div>';

        /* 전체 댓글 목록 — 최신이 위로 (역순) */
        repliesHTML += '<div class="reply-list-full" style="display:none">';
        const sortedReplies = post.replies.map((r, i) => ({ ...r, _origIdx: i })).reverse();
        sortedReplies.forEach((r) => {
          const rIdx = r._origIdx;
          repliesHTML +=
            '<div class="reply-item" data-ridx="' + rIdx + '">' +
              '<div class="reply-item-header">' +
                '<span class="reply-arrow">└</span>' +
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
        repliesHTML += '</div>';
      }

      /* ── 게시글 카드 ── */
      const el = document.createElement('div');
      el.className = 'bulletin-post' + (isNotice ? ' notice-post' : '');
      /* 답글 있으면 펼치기 버튼 포함 */
      const replyToggleBtn = replyCount > 0
        ? '<button class="reply-toggle-btn" aria-label="댓글 펼치기">댓글 ' + replyCount + '개 ▼</button>'
        : '';
      el.innerHTML =
        (isNotice ? '<div class="notice-badge">📢 공지</div>' : '') +
        '<div class="bulletin-post-header">' +
          '<div class="bulletin-post-content post-collapsed" data-lines="1">' + escHtml(post.text) + '</div>' +
          '<button class="post-expand-btn" aria-label="펼치기">▼</button>' +
        '</div>' +
        '<div class="bulletin-post-time">' + formatTime(post.time) + '</div>' +
        '<div class="post-buttons">' +
          '<button class="replyBtn">댓글</button>' +
          '<button class="editBtn">수정</button>' +
          (canDelete ? '<button class="bulletin-post-delete">삭제</button>' : '') +
        '</div>' +
        '<div class="edit-area"></div>' +
        '<div class="reply-area"></div>' +
        (replyCount > 0
          ? '<div class="reply-section">' +
              repliesHTML +
              replyToggleBtn +
            '</div>'
          : '<div class="reply-list"></div>');

      /* 게시글 본문 펼치기/접기 */
      const expandBtn   = el.querySelector('.post-expand-btn');
      const postContent = el.querySelector('.bulletin-post-content');
      expandBtn.addEventListener('click', () => {
        const isOpen = expandBtn.textContent === '▲';
        if (isOpen) {
          postContent.classList.add('post-collapsed');
          expandBtn.textContent = '▼';
        } else {
          postContent.classList.remove('post-collapsed');
          expandBtn.textContent = '▲';
        }
      });

      /* 답글 전체 펼치기/접기 */
      const replyToggle = el.querySelector('.reply-toggle-btn');
      if (replyToggle) {
        const preview  = el.querySelector('.reply-preview');
        const fullList = el.querySelector('.reply-list-full');
        replyToggle.addEventListener('click', () => {
          const isOpen = fullList.style.display !== 'none';
          if (isOpen) {
            fullList.style.display = 'none';
            preview.style.display  = '';
            replyToggle.textContent = '댓글 ' + replyCount + '개 ▼';
          } else {
            fullList.style.display = 'block';
            preview.style.display  = 'none';
            replyToggle.textContent = '댓글 접기 ▲';
          }
        });
      }

      /* ── 댓글 달기 ── */
      el.querySelector('.replyBtn').addEventListener('click', () => {
        if (APP.settings?.allowComment === false && !APP.isAdmin) return;
        const area = el.querySelector('.reply-area');
        if (area.innerHTML !== '') { area.innerHTML = ''; return; }
        area.innerHTML =
          '<div class="reply-input-row">' +
            '<input class="replyInput" placeholder="댓글을 입력하세요...">' +
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
          if (!arr[oi].replies) arr[oi].replies = [];
          arr[oi].replies.push({ text, time: new Date().toISOString() });
          await savePosts(arr);
          loadBulletinPosts();
        });
      });

      /* ── 게시글 수정 ── */
      el.querySelector('.editBtn').addEventListener('click', async () => {
        if (APP.settings?.allowEdit === false && !APP.isAdmin) return;
        const area = el.querySelector('.edit-area');
        const arr  = await fetchPosts();
        openInlineEdit(area, arr[oi].text, !!arr[oi].isNotice, '수정할 내용을 입력하세요...', async (newText, newIsNotice) => {
          arr[oi].text     = newText;
          arr[oi].isNotice = newIsNotice;
          await savePosts(arr);
          loadBulletinPosts();
        });
      });

      /* ── 게시글 삭제 ── */
      const delBtn = el.querySelector('.bulletin-post-delete');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (!confirm('이 글을 삭제하시겠습니까?')) return;
          const arr = await fetchPosts();
          arr.splice(oi, 1);
          await savePosts(arr);
          loadBulletinPosts();
        });
      }

      /* ── 답글 수정/삭제 ── */
      const replyListEl = el.querySelector('.reply-list-full') || el.querySelector('.reply-list');
      if (replyListEl) replyListEl.addEventListener('click', async e => {
        const ri = e.target.closest('.reply-item');
        if (!ri) return;
        const rIdx = parseInt(ri.dataset.ridx);
        if (e.target.classList.contains('reply-del-btn')) {
          if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
          const arr = await fetchPosts();
          arr[oi].replies.splice(rIdx, 1);
          await savePosts(arr);
          loadBulletinPosts();
          return;
        }
        if (e.target.classList.contains('reply-edit-btn')) {
          const area = ri.querySelector('.reply-edit-area');
          const arr  = await fetchPosts();
          openInlineEdit(area, arr[oi].replies[rIdx].text, false, '댓글을 수정하세요...', async (newText) => {
            arr[oi].replies[rIdx].text = newText;
            await savePosts(arr);
            loadBulletinPosts();
          });
        }
      });

      container.appendChild(el);
    });

    /* ── 페이지네이션 UI ── */
    if (totalPages > 1) {
      const pager = document.createElement('div');
      pager.className = 'bulletin-pager';

      /* 이전 버튼 */
      const prevBtn = document.createElement('button');
      prevBtn.className = 'pager-btn pager-prev';
      prevBtn.textContent = '‹';
      prevBtn.disabled = bulletinPage === 1;
      prevBtn.addEventListener('click', () => { bulletinPage--; loadBulletinPosts(); });
      pager.appendChild(prevBtn);

      /* 페이지 번호 */
      const maxShow = 5;
      let startP = Math.max(1, bulletinPage - 2);
      let endP   = Math.min(totalPages, startP + maxShow - 1);
      if (endP - startP < maxShow - 1) startP = Math.max(1, endP - maxShow + 1);

      for (let p = startP; p <= endP; p++) {
        const pb = document.createElement('button');
        pb.className = 'pager-btn pager-num' + (p === bulletinPage ? ' active' : '');
        pb.textContent = p;
        pb.addEventListener('click', (function(pg){ return () => { bulletinPage = pg; loadBulletinPosts(); }; })(p));
        pager.appendChild(pb);
      }

      /* 다음 버튼 */
      const nextBtn = document.createElement('button');
      nextBtn.className = 'pager-btn pager-next';
      nextBtn.textContent = '›';
      nextBtn.disabled = bulletinPage === totalPages;
      nextBtn.addEventListener('click', () => { bulletinPage++; loadBulletinPosts(); });
      pager.appendChild(nextBtn);

      container.appendChild(pager);
    }

  } catch (err) {
    console.error('게시판 로드 실패:', err);
  }
}

/* ── 초기화 ── */
async function initBulletin() {
  APP.loadBulletinPosts = loadBulletinPosts;

  /* 탭 이벤트 */
  document.querySelectorAll('.bulletin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bulletinTab  = btn.dataset.tab;
      bulletinPage = 1;
      document.querySelectorAll('.bulletin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadBulletinPosts();
    });
  });

  /* 메모 버튼 */
  document.getElementById('writePostBtn').addEventListener('click', () => {
    if (APP.settings?.allowWrite === false && !APP.isAdmin) return;
    const area = document.getElementById('bulletinWriteArea');
    const isHidden = !area.style.display || area.style.display === 'none';
    area.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
      area.querySelector('.bulletinWriteInput').value = '';
      const cb = document.getElementById('noticeCheckbox');
      if (cb) cb.checked = false;
      /* 공지 체크박스: 로그인 시에만 표시 */
      const noticeRow = document.getElementById('noticeCheckboxRow');
      const canNoticeWrite = APP.isAdmin || APP.settings?.allowNotice === false;
      if (noticeRow) noticeRow.style.display = canNoticeWrite ? 'flex' : 'none';
      setTimeout(() => area.querySelector('.bulletinWriteInput').focus(), 80);
    }
  });

  document.getElementById('bulletinWriteCancel').addEventListener('click', () => {
    document.getElementById('bulletinWriteArea').style.display = 'none';
  });

  document.getElementById('bulletinWriteSubmit').addEventListener('click', async () => {
    const input = document.getElementById('bulletinWriteArea').querySelector('.bulletinWriteInput');
    const cb    = document.getElementById('noticeCheckbox');
    const text  = input.value.trim();
    if (!text) { alert('내용을 입력해주세요.'); return; }
    try {
      const arr      = await fetchPosts();
      const isNotice = (APP.isAdmin || APP.settings?.allowNotice === false) && cb && cb.checked;
      arr.push({ text, time: new Date().toISOString(), isNotice });
      await savePosts(arr);
      input.value = '';
      if (cb) cb.checked = false;
      document.getElementById('bulletinWriteArea').style.display = 'none';
      loadBulletinPosts();
    } catch (err) {
      console.error('저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  });

  await loadBulletinPosts();
  /* 게시판 오래된 글 정리 — 관리자 로그인 시 cleanOldParkingData()가 bulletin도 함께 처리 */
}

async function cleanOldBulletinPosts() {
  try {
    const arr = await fetchPosts();
    if (!arr.length) return;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 31);
    const filtered = arr.filter(p => p && p.time && p.time > cutoff.toISOString());
    if (filtered.length < arr.length) {
      await savePosts(filtered);
    }
  } catch (err) { console.error('게시판 정리 실패:', err); }
}
