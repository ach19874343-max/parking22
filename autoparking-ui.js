/* ============================================================
   autoparking-ui.js
   ─ 자동주차 적용 (applyAutoParking)
   ─ 결과 모달 (showResultModal)
   ─ 모듈 초기화 (initAutoParking)
   ============================================================
   의존: autoparking-core.js, autoparking-worker.js 먼저 로드 필요
     - getTodayEntryOrder, getExitBlockingInfo, slotRow, slotCol, slotIndex
     - canEnterRow, findEntryCol
    - computeAutoParking
   ============================================================ */
'use strict';

/* 결과 모달 다중 페이지(완벽해 최대 5, 입0·출1은 최대 3) */
let _resultPages=[], _resultPageIdx=0;

/* ══════════════════════════════════════════════════════════════
   § 8. 자동주차 적용
   ══════════════════════════════════════════════════════════════ */
function applyAutoParking(){
  let cancelled=false;
  let apLiveCandidates = []; // 탐색 중 미리보기 후보(최대 5)
  let _lastPreviewKey = ''; // 같은 후보면 재렌더 스킵
  let _prevLiveVehToSlot = new Map(); // vehicle -> slot
  let _prevLiveVehRest = new Map(); // vehicle -> boolean(rest)
  let _animBudget = { maxMoves: 6, durMs: 260 };
  let _lastRenderMs = 0;
  let _lastScoreKey = '';
  let _wakeLock = null;
  let _wakeLockActive = false;

  async function acquireWakeLock(){
    try{
      if (_wakeLockActive) return;
      if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) return;
      _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLockActive = true;
      // 잠금이 풀릴 수 있으므로 상태만 갱신
      _wakeLock.addEventListener('release', () => {
        _wakeLockActive = false;
        _wakeLock = null;
      });
    }catch{
      _wakeLockActive = false;
      _wakeLock = null;
    }
  }
  async function releaseWakeLock(){
    try{
      if (_wakeLock) await _wakeLock.release();
    }catch{}
    _wakeLockActive = false;
    _wakeLock = null;
  }

  // 화면이 다시 보이면 WakeLock 재획득 (모바일에서 흔함)
  const _onVis = () => {
    if (document.visibilityState === 'visible') acquireWakeLock();
  };
  document.addEventListener('visibilitychange', _onVis, { passive: true });
  acquireWakeLock();

  let overlay=document.getElementById('apLoadingOverlay');
  if(!overlay){overlay=document.createElement('div');overlay.id='apLoadingOverlay';document.body.appendChild(overlay);}
  overlay.className='ap-loading-overlay';
  // 이전 실행에서 display:none 으로 숨겨졌을 수 있으니 항상 다시 표시
  overlay.style.display='';
  overlay.innerHTML=`
    <div class="ap-loading-card">
      <div class="ap-loading-spinner"></div>
      <div class="ap-loading-title">최적 배치 탐색 중</div>

      <!-- 퍼센트 크게 표시 -->
      <div id="apPctNum" class="ap-loading-pct">0%</div>

      <!-- 진행바 -->
      <div class="ap-loading-bar-wrap">
        <div id="apProgBar" class="ap-loading-bar"></div>
      </div>

      <!-- 상세 텍스트 -->
      <div id="apProgLine1" class="ap-loading-line1">준비 중…</div>

      <!-- 완벽해 카운터 -->
      <div id="apProgLine2" class="ap-loading-line2">완벽해 0 / 10</div>

      <!-- 현재 후보 미리보기 (탐색 중) -->
      <div id="apLivePreviewWrap" style="width:100%;max-width:min(92vw,460px);margin-top:10px;display:none">
        <div style="font-size:12px;font-weight:800;color:rgba(255,255,255,0.82);text-align:center;margin-bottom:6px">
          현재 후보
        </div>
        <div id="apLivePreviewMeta" style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.65);text-align:center;margin-bottom:8px"></div>
        <div id="apLivePreviewGrid" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:10px"></div>
      </div>

      <div class="ap-loading-dots">
        <span></span><span></span><span></span>
      </div>
      <button id="apCancelBtn" class="ap-loading-cancel">✕ 취소</button>
    </div>`;

  // 후보 버튼 바인딩 (탐색 중 미리보기)
  const renderLiveTitle = (p)=>{
    const wrap = document.getElementById('apLivePreviewWrap');
    const titleEl = wrap ? wrap.querySelector('div') : null;
    if (!titleEl) return;
    const t = p?.liveLabel || '';
    titleEl.textContent = t ? ('현재 탐색: ' + t) : '현재 탐색';
  };

  const renderLivePreview = (cand)=>{
    const wrap = document.getElementById('apLivePreviewWrap');
    const meta = document.getElementById('apLivePreviewMeta');
    const grid = document.getElementById('apLivePreviewGrid');
    if(!wrap || !meta || !grid) return;
    if(!cand || !cand.values){
      wrap.style.display='none';
      return;
    }
    let key='';
    try{ key = JSON.stringify(cand.values); }catch{ key=''; }

    wrap.style.display='';
    const es = cand.exitScore ?? '—';
    const en = cand.entryScore ?? '—';
    meta.textContent = `입차막힘 ${en} · 출차막힘 ${es}`;

    const rows = APP.rowLabels || ['2R','3R','4R','5R','6R','7R'];
    const RC = APP.rowCount || rows.length;
    const values = cand.values || {};
    const active = cand.active || {};

    // 탐색 성능 우선: 움직임 애니메이션은 최소화(점수 변화만 가볍게 강조)
    const reduceMotion = true || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
    const nowPerf = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();

    // ── DOM 구조를 1회만 만들고, 이후에는 값만 갱신 (애니메이션/성능) ──
    if(!grid._built || grid._builtRC !== RC){
      grid._built = true;
      grid._builtRC = RC;
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;gap:4px;margin-bottom:6px';
      head.innerHTML =
        '<div style="width:28px"></div>' +
        ['1','2','3'].map(l=>`<div style="flex:1;font-size:10px;color:rgba(255,255,255,0.75);text-align:center;font-weight:800">${l}</div>`).join('');
      grid.innerHTML = '';
      grid.appendChild(head);
      for(let ri=0;ri<RC;ri++){
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px';
        const label = document.createElement('div');
        label.style.cssText = 'width:28px;font-size:10px;font-weight:900;color:rgba(255,255,255,0.70);text-align:right;flex-shrink:0';
        label.textContent = rows[ri] || '';
        const cells = document.createElement('div');
        cells.style.cssText = 'display:flex;gap:4px;flex:1';
        for(let col=0;col<3;col++){
          const si = ri*3+col;
          const cell = document.createElement('div');
          cell.dataset.slot = String(si);
          cell.style.cssText = 'flex:1;height:32px;border-radius:8px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;box-sizing:border-box';
          cells.appendChild(cell);
        }
        row.appendChild(label);
        row.appendChild(cells);
        grid.appendChild(row);
      }
    } else {
      // 라벨 갱신 (행 라벨이 편집될 수 있으므로)
      const labelEls = grid.querySelectorAll('div[style*="width:28px"][style*="text-align:right"]');
      labelEls.forEach((el, idx)=>{ el.textContent = rows[idx] || ''; });
    }

    // ── 점수 변화 강조(가벼운 펄스) ──
    const scoreKey = String(en) + '|' + String(es);
    if (scoreKey !== _lastScoreKey) {
      _lastScoreKey = scoreKey;
      // meta 텍스트 플래시
      meta.style.transition = 'transform 180ms ease, opacity 180ms ease';
      meta.style.transform = 'scale(1.03)';
      meta.style.opacity = '1';
      setTimeout(() => {
        meta.style.transform = '';
        meta.style.opacity = '';
      }, 220);
      // grid 펄스
      grid.style.transition = 'box-shadow 220ms ease';
      grid.style.boxShadow = '0 0 0 4px rgba(52,211,153,0.25)';
      setTimeout(() => { grid.style.boxShadow = ''; }, 260);
    }

    // ── 값 갱신 + 새 맵 생성 ──
    const newVehToSlot = new Map();
    const newVehRest = new Map();
    for(let si=0;si<RC*3;si++){
      const cell = grid.querySelector(`[data-slot="${si}"]`);
      if(!cell) continue;
      const v = values[si];
      const num = (v!==undefined && v!==null && String(v).trim()!=='') ? String(v).trim() : '';
      if(!num){
        cell.textContent = '';
        cell.style.background = 'rgba(255,255,255,0.04)';
        cell.style.border = '1px solid rgba(255,255,255,0.06)';
        cell.style.color = 'rgba(255,255,255,0.55)';
        continue;
      }
      const isRest = !!active[si];
      const bg = isRest ? 'rgba(254,243,199,0.90)' : 'rgba(219,234,254,0.90)';
      const tc = isRest ? '#78350F' : '#1E40AF';
      cell.style.background = bg;
      cell.style.border = 'none';
      cell.style.color = tc;
      cell.textContent = num + (isRest ? ' 휴' : '');
      newVehToSlot.set(num, si);
      newVehRest.set(num, isRest);
    }

    // 이동 애니메이션(고스트 슬라이드)은 탐색 성능 우선으로 비활성화

    _prevLiveVehToSlot = newVehToSlot;
    _prevLiveVehRest = newVehRest;

    // 같은 key라면 DOM 갱신만으로 충분 → 이후부터는 key 기반 스킵(완전 동일 values)
    if(key) _lastPreviewKey = key;

    const endPerf = (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now();
    _lastRenderMs = endPerf - nowPerf;
  };

  _resultPages=[];
  _resultPageIdx=0;

  function updateApProgress(p){
    const pct=document.getElementById('apPctNum');
    const l1=document.getElementById('apProgLine1');
    const l2=document.getElementById('apProgLine2');
    const bar=document.getElementById('apProgBar');
    if(pct) pct.textContent=`${p.pct}%`;
    if(l1) l1.textContent=`후보 ${p.candDone} / ${p.candTotal} · ${p.phase}`;
    if(l2){
      const cnt=p.perfectCount||0;
      const max=p.perfectMax||10;
      l2.textContent=cnt>0?`완벽해 ${cnt} / ${max} ✅`:`완벽해 탐색 중…`;
      l2.style.color=cnt>0?'#34D399':'#6EE7B7';
    }
    if(bar) bar.style.width=`${p.pct}%`;

    // 탐색 중 후보(topN) 미리보기 갱신
    if(p){
      renderLiveTitle(p);
      const cand = p.live || (Array.isArray(p.top) ? (p.top[0] || null) : null);
      renderLivePreview(cand);
    }
  }

  // cancelFn 받아서 취소 버튼에 연결
  const cancelFn=computeAutoParking(function(result,top3){
    document.removeEventListener('visibilitychange', _onVis, { passive: true });
    releaseWakeLock();
    overlay.style.display='none';
    if(!result){
      if(cancelled) return;
      alert('배치를 찾지 못했습니다.');
      return;
    }
    _resultPages=(top3&&top3.length>1)?top3:[result];
    _resultPageIdx=0;
    showResultModal(_resultPages[0],0,false);
  },updateApProgress);

  document.getElementById('apCancelBtn').onclick=()=>{
    cancelled=true;
    document.removeEventListener('visibilitychange', _onVis, { passive: true });
    releaseWakeLock();
    // 취소는 즉시 UI를 닫고, 백그라운드 탐색도 중단
    overlay.style.display='none';
    if(typeof cancelFn==='function') cancelFn();
  };
}

/* ══════════════════════════════════════════════════════════════
   § 9. 결과 모달 (모바일 최적화)
   ══════════════════════════════════════════════════════════════ */

function showResultModal(result, pageIdx, previewOnly){
  // 다중 페이지(‹ ›)
  if(pageIdx===undefined){
    _resultPages=[result];
    _resultPageIdx=0;
  } else {
    _resultPageIdx=pageIdx;
  }
  const curPage=_resultPageIdx;
  const totalPages=_resultPages.length;

  let modal=document.getElementById('autoResultModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='autoResultModal';
    modal.className='ap-result-modal';
    document.body.appendChild(modal);
  }
  const rows=APP.rowLabels||['2R','3R','4R','5R','6R','7R'];
  const es=result.exitScore??0,en=result.entryScore??0;
  const ok=es===0&&en===0;
  const entryOk=en===0;
  const scoreColor=ok?'#34D399':entryOk?'#FCD34D':'#F87171';
  const scoreLabel=ok?'✅ 완벽!':entryOk?'🟡 입차OK (출차주의)':'🔴 입차막힘 있음';

  // 출차막힘 차량 집합 계산
  const tmrRankModal={};
  (dispatchState?.tomorrowNums||[]).forEach((n,i)=>{tmrRankModal[n.num??n]=i;});
  const blockedNums=new Set();
  for(let r=0;r<(APP.rowCount||6);r++) for(let c=1;c<3;c++){
    const v=result.values[r*3+c]; if(!v||result.active[r*3+c]) continue;
    const myRank=tmrRankModal[v]??9999;
    for(let lc=0;lc<c;lc++){
      const lv=result.values[r*3+lc];
      if(lv&&(tmrRankModal[lv]??9999)>myRank) blockedNums.add(v);
    }
  }

  const gridRows=rows.map((label,ri)=>{
    const cells=[0,1,2].map(col=>{
      const si=ri*3+col,v=result.values[si];
      if(!v) return `<div style="flex:1;height:36px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06)"></div>`;
      const isRest=result.active[si];
      const isBlocked=blockedNums.has(v);
      const bgLight=isRest?'rgba(254,243,199,0.90)':'rgba(219,234,254,0.90)';
      const textColor=isRest?'#78350F':'#1E40AF';
      const borderStyle=isBlocked?'2px solid rgba(239,68,68,0.85)':'none';
      return `<div style="flex:1;height:36px;border-radius:6px;background:${bgLight};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${textColor};border:${borderStyle};box-sizing:border-box">${v}${isRest?'<span style="font-size:9px;margin-left:2px;opacity:.7">휴</span>':''}</div>`;
    }).join('');
    return `<div style="display:flex;gap:4px;align-items:center">
      <div style="width:28px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-align:right;flex-shrink:0">${label}</div>
      <div style="display:flex;gap:4px;flex:1">${cells}</div>
    </div>`;
  }).join('');

  // 페이지 도트
  const dotHTML=totalPages>1?`
    <div style="display:flex;justify-content:center;gap:6px;margin-bottom:12px">
      ${Array.from({length:totalPages},(_,i)=>`<div style="width:${i===curPage?18:6}px;height:6px;border-radius:3px;background:${i===curPage?'#34D399':'rgba(255,255,255,0.25)'}"></div>`).join('')}
    </div>`:'';

  // 페이지 버튼
  const prevBtn=curPage>0?`<button id="arPagePrev" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.20);background:rgba(255,255,255,0.08);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>`:'<div style="width:36px"></div>';
  const nextBtn=curPage<totalPages-1?`<button id="arPageNext" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.20);background:rgba(255,255,255,0.08);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">›</button>`:'<div style="width:36px"></div>';
  const pageLabel=totalPages>1?`<div style="font-size:12px;color:rgba(255,255,255,0.60);font-weight:700">${curPage+1} / ${totalPages}</div>`:'';
  const pageNavHTML=totalPages>1?`<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:12px">${prevBtn}${pageLabel}${nextBtn}</div>`:'';

  modal.innerHTML=`
    <div class="ap-result-sheet">
      <div class="ap-result-grabber"></div>
      <div class="ap-result-header">
        <div class="ap-result-title">자동 주차 배치 결과</div>
        <div style="font-size:13px;font-weight:700;color:${scoreColor};text-shadow:0 1px 3px rgba(0,0,0,0.3)">${scoreLabel}</div>
      </div>
      <div class="ap-result-badges">
        <div class="ap-result-badge">
          <div class="ap-result-badge-num" style="color:${es===0?'#34D399':'#F87171'}">${es}</div>
          <div class="ap-result-badge-label">출차막힘</div>
        </div>
        <div class="ap-result-badge">
          <div class="ap-result-badge-num" style="color:${en===0?'#34D399':'#F87171'}">${en}</div>
          <div class="ap-result-badge-label">입차막힘</div>
        </div>
        <div class="ap-result-badge">
          <div style="font-size:12px;font-weight:700;color:#fff;margin-top:2px">${result.elapsed?result.elapsed+'ms':'―'}</div>
          <div class="ap-result-badge-label">탐색시간</div>
        </div>
      </div>
      ${dotHTML}
      <div class="ap-result-grid">
        <div style="display:flex;gap:4px;margin-bottom:4px">
          <div style="width:28px"></div>
          ${['1번','2번','3번'].map(l=>`<div style="flex:1;font-size:10px;color:rgba(255,255,255,0.80);text-align:center;font-weight:700">${l}</div>`).join('')}
        </div>
        ${gridRows}
      </div>
      ${pageNavHTML}
      <div class="ap-result-actions">
        <button id="autoResultCancel" class="ap-result-btn cancel">${previewOnly?'닫기':'취소'}</button>
        ${previewOnly
          ? `<button id="autoResultBan" class="ap-result-btn cancel" style="flex:1;border-color:rgba(248,113,113,0.35);color:#FCA5A5">🚫 탐색 제외</button>`
          : `<button id="autoResultApply" class="ap-result-btn apply">✓ 적용하기</button>`
        }
      </div>
    </div>`;

  // 페이지 버튼 바인딩
  const prevEl=document.getElementById('arPagePrev');
  const nextEl=document.getElementById('arPageNext');
  if(prevEl) prevEl.onclick=()=>showResultModal(_resultPages[curPage-1],curPage-1);
  if(nextEl) nextEl.onclick=()=>showResultModal(_resultPages[curPage+1],curPage+1);

  document.getElementById('autoResultCancel').onclick=()=>modal.remove();
  const banBtn=document.getElementById('autoResultBan');
  if(banBtn){
    banBtn.onclick=()=>{
      try{
        if(typeof window.apBanAutoParkingCandidateByValues==='function'){
          window.apBanAutoParkingCandidateByValues(result.values);
        }
      }catch{}
      modal.remove();
    };
  }
  const applyBtn=document.getElementById('autoResultApply');
  if(applyBtn) applyBtn.onclick=()=>{
    const date=document.getElementById('datePicker')?.value||'';
    APP.parkingState.values=result.values;
    APP.parkingState.active=result.active;
    renderCards();saveData();
    modal.remove();
    if(es>0){
      const tmrRank={};
      (dispatchState.tomorrowNums||[]).forEach((n,i)=>{tmrRank[n.num??n]=i;});
      const info=getExitBlockingInfo(result.values,result.active,tmrRank)
        .filter(b=>b.blockedBy.some(bv=>(tmrRank[bv]??9999)>(tmrRank[b.num]??9999)));
      if(info.length){
        const rl=APP.rowLabels||['2R','3R','4R','5R','6R','7R'];
        alert('출차 순서 주의:\n\n'+info.map(b=>`⚠️ ${b.num} (${rl[b.row]} ${b.col+1}번칸): [${b.blockedBy.join(', ')}] 먼저 출차 필요`).join('\n'));
      }
    }
  };
}

/* ══════════════════════════════════════════════════════════════
   § 13. 모듈 초기화
   ══════════════════════════════════════════════════════════════ */
function initAutoParking(){
  APP.applyAutoParking   =applyAutoParking;
  APP.getExitBlockingInfo=getExitBlockingInfo;
  APP.calcExitBlocking   =calcExitBlocking;
  APP.calcEntryBlocking  =calcEntryBlocking;
  APP.explainEntryBlocking = explainEntryBlocking;
  APP.computeAutoParking =computeAutoParking;
  APP.canEnterRow        =canEnterRow;
  APP.findEntryCol       =findEntryCol;
  APP.getTodayEntryOrder =getTodayEntryOrder;

  // 하단 탭바의 Auto Park 버튼 — dispatch.js의 dispatchAutoBtn과 공유
  // (dispatch.js에서 배차불러오기 + 자동주차 순서 처리)
  // 별도 자동주차 전용 버튼이 있을 때만 바인딩
  const btn=document.getElementById('autoParKBtn');
  if(btn)btn.addEventListener('click',applyAutoParking);
}
