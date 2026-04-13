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

      <div id="apEntryOrderWrap" class="ap-loading-entry-wrap" aria-label="탐색에 사용하는 오늘 입차 순서">
        <div class="ap-loading-entry-label">탐색에 쓰는 오늘 입차 순서</div>
        <div id="apEntryOrderLine" class="ap-loading-entry-line"></div>
      </div>

      <div class="ap-loading-foot">
        백트래킹 DFS 탐색 · 모바일도 정상 작동
      </div>
      <div class="ap-loading-dots">
        <span></span><span></span><span></span>
      </div>
      <button id="apCancelBtn" class="ap-loading-cancel">✕ 취소</button>
    </div>`;

  const apEntryEl = document.getElementById('apEntryOrderLine');
  if (apEntryEl && typeof getTodayEntryOrder === 'function') {
    const eo = getTodayEntryOrder();
    apEntryEl.textContent = eo.length ? eo.join(' → ') : '(입차 대상 없음)';
  } else if (apEntryEl) {
    apEntryEl.textContent = '(순서를 불러올 수 없음)';
  }

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
  }

  // cancelFn 받아서 취소 버튼에 연결
  const cancelFn=computeAutoParking(function(result,top3){
    overlay.style.display='none';
    if(!result){
      if(cancelled) return;
      alert('배치를 찾지 못했습니다.');
      return;
    }
    _resultPages=(top3&&top3.length>1)?top3:[result];
    _resultPageIdx=0;
    showResultModal(_resultPages[0],0);
  },updateApProgress);

  document.getElementById('apCancelBtn').onclick=()=>{
    cancelled=true;
    // 취소는 즉시 UI를 닫고, 백그라운드 탐색도 중단
    overlay.style.display='none';
    if(typeof cancelFn==='function') cancelFn();
  };
}

/* ══════════════════════════════════════════════════════════════
   § 9. 결과 모달 (모바일 최적화)
   ══════════════════════════════════════════════════════════════ */

function showResultModal(result, pageIdx){
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
        <button id="autoResultCancel" class="ap-result-btn cancel">취소</button>
        <button id="autoResultApply" class="ap-result-btn apply">✓ 적용하기</button>
      </div>
    </div>`;

  // 페이지 버튼 바인딩
  const prevEl=document.getElementById('arPagePrev');
  const nextEl=document.getElementById('arPageNext');
  if(prevEl) prevEl.onclick=()=>showResultModal(_resultPages[curPage-1],curPage-1);
  if(nextEl) nextEl.onclick=()=>showResultModal(_resultPages[curPage+1],curPage+1);

  document.getElementById('autoResultCancel').onclick=()=>modal.remove();
  document.getElementById('autoResultApply').onclick=()=>{
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
