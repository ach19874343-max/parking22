/* ============================================================
   autoparking-ui.js
   ─ 자동주차 적용 (applyAutoParking)
   ─ 결과 모달 (showResultModal)
   ─ 시뮬레이션 공통 UI
   ─ 출차 시뮬레이션 (runExitSimulation)
   ─ 입차 시뮬레이션 (runEntrySimulation)
   ─ 모듈 초기화 (initAutoParking)
   ============================================================
   의존: autoparking-core.js, autoparking-worker.js 먼저 로드 필요
     - getTodayEntryOrder, getExitBlockingInfo, slotRow, slotCol, slotIndex
     - canEnterRow, findEntryCol
     - computeAutoParking, buildPreviewText
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
      <div style="font-size:12px;color:rgba(255,255,255,0.55);text-align:center;margin-top:-8px">입·출차 막힘 없는 배치를 계산합니다</div>
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
   § 10. 시뮬레이션 공통 UI
   ══════════════════════════════════════════════════════════════ */
const _B='border:none;border-radius:12px;cursor:pointer;font-weight:700;font-size:15px;';
const BTN_BLUE=_B+'padding:0 20px;height:44px;background:#3B82F6;color:#fff;';
const BTN_PURPLE=_B+'padding:0 20px;height:44px;background:#7C3AED;color:#fff;';
const BTN_GRAY=_B+'padding:0 16px;height:44px;background:#374151;color:#fff;';

function getOrCreateSimPanel(){
  let p=document.getElementById('simPanel');
  if(!p){
    p=document.createElement('div');
    p.id='simPanel';
    p.style.cssText=[
      'position:fixed','bottom:0','left:0','right:0',
      'z-index:8000','background:#111827','color:#fff',
      'border-radius:20px 20px 0 0',
      'padding:16px 16px calc(16px + env(safe-area-inset-bottom))',
      'max-height:70vh','overflow-y:auto',
      'box-shadow:0 -4px 24px rgba(0,0,0,0.5)',
      "font-family:'Pretendard',-apple-system,sans-serif",
      'display:none',
    ].join(';');
    document.body.appendChild(p);
  }
  return p;
}
function showSimPanel(html){const p=getOrCreateSimPanel();p.innerHTML=html;p.style.display='block';}
function hideSimPanel(){const p=document.getElementById('simPanel');if(p)p.style.display='none';}
function findCardByNum(num){
  return document.querySelector(`.slot-card[data-value="${num}"]`)
      ||[...document.querySelectorAll('.slot-card')].find(c=>c.textContent.trim().startsWith(num));
}
function clearSimHighlight(){
  document.querySelectorAll('.slot-card').forEach(c=>c.classList.remove('sim-target','sim-blocked','sim-done','sim-entry'));
}
function bindSim(onNext,onStop){
  const nb=document.getElementById('simNextBtn'),sb=document.getElementById('simStopBtn');
  if(nb)nb.onclick=onNext;if(sb)sb.onclick=onStop;
}

function simStepPanel(step,total,icon,titleColor,title,descHTML,rowPreviewHTML,btnStyle){
  return `
    <div style="width:32px;height:4px;background:#374151;border-radius:2px;margin:0 auto 14px"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:12px;color:#6B7280">${step} / ${total}</div>
      <div style="font-size:11px;color:#4B5563">다음 버튼으로 진행</div>
    </div>
    <div style="font-size:22px;font-weight:900;color:${titleColor};margin-bottom:4px">${icon} ${title}</div>
    <div style="font-size:13px;color:#D1D5DB;line-height:1.6;margin-bottom:10px">${descHTML}</div>
    <div style="display:flex;gap:4px;margin-bottom:14px;background:#1F2937;border-radius:10px;padding:10px">
      ${rowPreviewHTML}
    </div>
    <div style="display:flex;gap:8px">
      <button id="simStopBtn" style="${BTN_GRAY}">종료</button>
      <button id="simNextBtn" style="${btnStyle};flex:1">다음 ▶</button>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════
   § 11. 출차 시뮬레이션
   ══════════════════════════════════════════════════════════════ */
function runExitSimulation(){
    if(typeof dispatchState==='undefined'||!dispatchState.loaded){alert('배차 데이터를 먼저 불러와주세요.');return;}

  const tomorrowList=(dispatchState.tomorrowNums||[]).map(n=>n.num??n);
  const tmrRank={};tomorrowList.forEach((n,i)=>{tmrRank[n]=i;});
  const simValues={...APP.parkingState.values};
  const rowLabels=APP.rowLabels||['2R','3R','4R','5R','6R','7R'];
  const exited=new Set();
  let step=0,running=false;

  function rowPreview(row,vals,targetNum,blocked){
    return [0,1,2].map(c=>{
      const v=vals[slotIndex(row,c)];
      const isTarget=v===targetNum;
      const isBlocked=blocked.includes(v);
      const bg=isTarget?'#FEF3C7':isBlocked?'rgba(239,68,68,0.2)':'#374151';
      const tc=isTarget?'#92400E':isBlocked?'#FCA5A5':'#9CA3AF';
      return `<div style="flex:1;height:36px;border-radius:8px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${tc}">${v||'─'}</div>`;
    }).join('');
  }

  function doStep(){
    if(running)return;running=true;
    clearSimHighlight();
    exited.forEach(n=>{const c=findCardByNum(n);if(c)c.classList.add('sim-done');});
    if(step>=tomorrowList.length){
      hideSimPanel();clearSimHighlight();renderCards();
      alert('✅ 출차 시뮬레이션 완료!');running=false;return;
    }
    const target=tomorrowList[step];
    let targetSI=-1;
    for(let si=0;si<APP.rowCount*3;si++)if(simValues[si]===target){targetSI=si;break;}
    if(targetSI===-1){
      showSimPanel(`
        <div style="width:32px;height:4px;background:#374151;border-radius:2px;margin:0 auto 14px"></div>
        <div style="font-size:15px;font-weight:700;color:#6B7280;text-align:center;margin-bottom:16px">${target} — 그리드 없음 스킵</div>
        <div style="display:flex;gap:8px"><button id="simStopBtn" style="${BTN_GRAY}">종료</button><button id="simNextBtn" style="${BTN_BLUE};flex:1">다음 ▶</button></div>`);
      step++;exited.add(target);
      bindSim(()=>{running=false;doStep();},()=>{hideSimPanel();clearSimHighlight();renderCards();});
      running=false;return;
    }
    const col=slotCol(targetSI),row=slotRow(targetSI);
    const blocked=[];
    for(let lc=0;lc<col;lc++){const lv=simValues[slotIndex(row,lc)];if(lv)blocked.push(lv);}
    const card=findCardByNum(target);
    if(card)card.classList.add('sim-target');
    blocked.forEach(bv=>{const bc=findCardByNum(bv);if(bc)bc.classList.add('sim-blocked');});
    const isBlocked=blocked.length>0;
    const icon=isBlocked?'🚧':'✅';
    const titleColor=isBlocked?'#FCA5A5':'#6EE7B7';
    const title=`${target} → ${rowLabels[row]} ${col+1}번칸`;
    const desc=isBlocked?`막힘! <span style="color:#FCA5A5;font-weight:700">[${blocked.join(', ')}]</span> 먼저 출차 필요`:'출차 가능';
    const rp=rowPreview(row,simValues,target,blocked);
    showSimPanel(simStepPanel(step+1,tomorrowList.length,icon,titleColor,title,desc,rp,BTN_BLUE));
    step++;exited.add(target);simValues[targetSI]='';
    bindSim(()=>{running=false;doStep();},()=>{hideSimPanel();clearSimHighlight();renderCards();});
    running=false;
  }

  if(!confirm('내일 출차 순서 시뮬레이션을 시작합니다.'))return;
  doStep();
}

/* ══════════════════════════════════════════════════════════════
   § 12. 입차 시뮬레이션
   ══════════════════════════════════════════════════════════════ */
function runEntrySimulation(){
    if(typeof dispatchState==='undefined'||!dispatchState.loaded){alert('배차 데이터를 먼저 불러와주세요.');return;}

  let cancelled=false;
  showSimPanel(`
    <div style="width:32px;height:4px;background:#374151;border-radius:2px;margin:0 auto 14px"></div>
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:22px;margin-bottom:8px">🔍</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:6px">최적 배치 탐색 중...</div>
      <div style="margin-top:8px;height:3px;background:#374151;border-radius:2px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,#7C3AED,#3B82F6);animation:simLoad 1.5s ease-in-out infinite"></div>
      </div>
      <button id="searchCancelBtn" style="margin-top:14px;padding:10px 28px;border:none;border-radius:10px;background:#374151;color:#9CA3AF;font-size:14px;font-weight:700;cursor:pointer">✕ 닫기</button>
    </div>`);
  document.getElementById('searchCancelBtn').onclick=()=>{
    cancelled=true;
    if(_worker){_worker.terminate();_worker=null;}
    hideSimPanel();
  };

  computeAutoParking(function(result){
    if(cancelled) return;
    if(!result){hideSimPanel();return;}
    const entryOrder=getTodayEntryOrder();
    const rowLabels=APP.rowLabels||['2R','3R','4R','5R','6R','7R'];
    const simValues={};
    for(let i=0;i<APP.rowCount*3;i++)simValues[i]='';
    for(let si=0;si<APP.rowCount*3;si++)if(result.active[si])simValues[si]=result.values[si];

    let step=0,running=false;
    const entered=new Set();

    function rowPreview(row,vals,newNum,actualCol){
      return [0,1,2].map(c=>{
        const ex=vals[slotIndex(row,c)];
        const isNew=c===actualCol&&newNum;
        const bg=isNew?'#FEF3C7':(ex?'#1F2937':'#111827');
        const tc=isNew?'#92400E':(ex?'#D1D5DB':'#4B5563');
        const border=isNew?'2px solid #F59E0B':(ex?'1px solid #374151':'1px solid #1F2937');
        return `<div style="flex:1;height:36px;border-radius:8px;background:${bg};border:${border};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${tc}">${isNew?newNum:(ex||'─')}</div>`;
      }).join('');
    }

    function doStep(){
      if(running)return;running=true;
      clearSimHighlight();
      entered.forEach(n=>{const c=findCardByNum(n);if(c)c.classList.add('sim-done');});
      if(step>=entryOrder.length){
        hideSimPanel();clearSimHighlight();
        showResultModal(result);
        running=false;return;
      }
      const num=entryOrder[step];
      let targetSI=-1;
      for(let si=0;si<APP.rowCount*3;si++)if(result.values[si]===num&&!result.active[si]){targetSI=si;break;}
      if(targetSI===-1){step++;running=false;doStep();return;}
      const row=slotRow(targetSI),col=slotCol(targetSI);
      const canPass=canEnterRow(row,simValues);
      const actualCol=findEntryCol(row,simValues);
      if(!canPass&&row>0){const an=simValues[(row-1)*3+2];if(an){const c=findCardByNum(an);if(c)c.classList.add('sim-blocked');}}
      for(let c=0;c<3;c++){const sv=simValues[slotIndex(row,c)];if(sv){const card=findCardByNum(sv);if(card)card.classList.add('sim-entry');}}
      let icon,titleColor,title,desc;
      if(!canPass){
        const an=simValues[(row-1)*3+2]||'?';
        icon='🚧';titleColor='#FCA5A5';
        title=`${rowLabels[row]} 진입 통로 막힘`;
        desc=`${rowLabels[row-1]} 3번칸 [${an}] 이 통로를 막고 있음`;
      }else if(actualCol<0){
        icon='🚫';titleColor='#FCA5A5';title=`${rowLabels[row]} 만석`;desc='3번칸 이미 차있음';
      }else{
        const last=actualCol===2;
        icon=last?'🟡':'✅';titleColor=last?'#FDE68A':'#6EE7B7';
        title=`${num} → ${rowLabels[row]} ${['1번칸','2번칸','3번칸'][actualCol]}`;
        desc=last?`⚠️ 3번칸 채움 → 이 행 이후 입차 불가`:`오늘 ${step+1}번째 입차`;
      }
      const rp=rowPreview(row,simValues,canPass&&actualCol>=0?num:null,actualCol);
      showSimPanel(simStepPanel(step+1,entryOrder.length,icon,titleColor,title,desc,rp,BTN_PURPLE));
      if(canPass&&actualCol>=0)simValues[slotIndex(row,actualCol)]=num;
      entered.add(num);step++;
      bindSim(()=>{running=false;doStep();},()=>{hideSimPanel();clearSimHighlight();renderCards();});
      running=false;
    }
    doStep();
  });
}

/* ══════════════════════════════════════════════════════════════
   § 13. 모듈 초기화
   ══════════════════════════════════════════════════════════════ */
function initAutoParking(){
  APP.applyAutoParking   =applyAutoParking;
  APP.runExitSimulation  =runExitSimulation;
  APP.runEntrySimulation =runEntrySimulation;
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
  // 시뮬 버튼은 제거됨 — null 안전 처리
  const exitBtn=document.getElementById('exitSimBtn');
  if(exitBtn)exitBtn.addEventListener('click',runExitSimulation);
  const entryBtn=document.getElementById('entrySimBtn');
  if(entryBtn)entryBtn.addEventListener('click',runEntrySimulation);
}
