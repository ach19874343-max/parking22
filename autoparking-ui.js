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

/* 결과 모달 3페이지 상태 */
let _resultPages=[], _resultPageIdx=0;

/* ══════════════════════════════════════════════════════════════
   § 8. 자동주차 적용
   ══════════════════════════════════════════════════════════════ */
function applyAutoParking(){
  let cancelled=false;

  // dispatch-loading 동일 구조 오버레이
  let overlay=document.getElementById('apLoadingOverlay');
  if(!overlay){overlay=document.createElement('div');overlay.id='apLoadingOverlay';document.body.appendChild(overlay);}
  overlay.style.cssText='position:fixed;inset:0;z-index:9100;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.60);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';
  overlay.innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.20);border-radius:22px;padding:30px 40px 26px;min-width:220px">
      <div style="width:46px;height:46px;border:4px solid rgba(255,255,255,0.22);border-top-color:#3B82F6;border-radius:50%;animation:dc-spin .75s linear infinite"></div>
      <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:.02em;text-align:center;text-shadow:0 1px 4px rgba(0,0,0,0.4)">최적 배치 탐색 중</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.55);text-align:center;margin-top:-8px">휴차 순열·다중 패스로 넓게 탐색합니다(수 분 걸릴 수 있음)</div>
      <div style="display:inline-flex;gap:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:#60A5FA;animation:dc-bounce 1.1s ease infinite;display:inline-block"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:#60A5FA;animation:dc-bounce 1.1s ease infinite .18s;display:inline-block"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:#60A5FA;animation:dc-bounce 1.1s ease infinite .36s;display:inline-block"></span>
      </div>
      <button id="apCancelBtn" style="margin-top:4px;padding:8px 24px;border:1px solid rgba(255,255,255,0.20);border-radius:10px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.70);font-size:13px;font-weight:700;cursor:pointer">✕ 취소</button>
    </div>`;

  document.getElementById('apCancelBtn').onclick=()=>{
    cancelled=true;
    if(_worker){_worker.terminate();_worker=null;}
    overlay.style.display='none';
  };

  _resultPages=[];
  _resultPageIdx=0;

  computeAutoParking(function(result, top3){
    overlay.style.display='none';
    if(cancelled) return;
    if(!result){alert('배치를 찾지 못했습니다.');return;}
    // top3가 있으면 최대 3페이지, 없으면 1페이지
    _resultPages = (top3&&top3.length>1) ? top3 : [result];
    _resultPageIdx=0;
    showResultModal(_resultPages[0], 0);
  });
}

/* ══════════════════════════════════════════════════════════════
   § 9. 결과 모달 (모바일 최적화)
   ══════════════════════════════════════════════════════════════ */

function showResultModal(result, pageIdx){
  // 3페이지 관리
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
    modal.style.cssText=[
      'position:fixed','inset:0','z-index:9000',
      'background:rgba(0,0,0,0.60)',
      'backdrop-filter:blur(6px)','-webkit-backdrop-filter:blur(6px)',
      'display:flex','align-items:flex-end','justify-content:center',
    ].join(';');
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
    <div style="background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);border-bottom:none;border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));width:100%;max-width:600px;max-height:90vh;overflow-y:auto">
      <div style="width:36px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;margin:0 auto 16px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:17px;font-weight:900;color:#fff;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,0.4)">자동 주차 배치 결과</div>
        <div style="font-size:13px;font-weight:700;color:${scoreColor};text-shadow:0 1px 3px rgba(0,0,0,0.3)">${scoreLabel}</div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${es===0?'#34D399':'#F87171'}">${es}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px">출차막힘</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${en===0?'#34D399':'#F87171'}">${en}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px">입차막힘</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:10px;text-align:center">
          <div style="font-size:12px;font-weight:700;color:#fff;margin-top:2px">${result.elapsed?result.elapsed+'ms':'―'}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.85);margin-top:2px">탐색시간</div>
        </div>
      </div>
      ${dotHTML}
      <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:12px">
        <div style="display:flex;gap:4px;margin-bottom:4px">
          <div style="width:28px"></div>
          ${['1번','2번','3번'].map(l=>`<div style="flex:1;font-size:10px;color:rgba(255,255,255,0.80);text-align:center;font-weight:700">${l}</div>`).join('')}
        </div>
        ${gridRows}
      </div>
      ${pageNavHTML}
      <div style="display:flex;gap:8px">
        <button id="autoResultCancel" style="flex:1;height:48px;border:1px solid rgba(255,255,255,0.18);border-radius:14px;background:rgba(255,255,255,0.10);color:rgba(255,255,255,0.80);font-size:15px;font-weight:700;cursor:pointer">취소</button>
        <button id="autoResultApply" style="flex:2;height:48px;border:none;border-radius:14px;background:linear-gradient(135deg,#34D399,#059669);color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 2px 12px rgba(52,211,153,0.35)">✓ 적용하기</button>
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
    /* 오토 그리드 저장 */
    if(typeof saveAutoGrid==='function') saveAutoGrid(date,result.values,result.active);
    /* Firebase autoGrid 필드 저장 */
    if(date&&APP.set&&APP.ref&&APP.db){
      APP.set(APP.ref(APP.db,'parking/'+date+'/autoGrid'),{
        values:result.values,
        active:result.active,
        savedAt:new Date().toISOString(),
      }).catch(()=>{});
    }
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
