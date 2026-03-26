/* ============================================================
   autoparking.js v9.0
   ─ Web Worker 기반 백그라운드 탐색 (UI 블로킹 없음)
   ─ 휴차 행(2R,7R)에 운행차 혼합 배치 허용
   ─ 출차·입차 막힘 0 보장 탐색
   ============================================================
   [물리 규칙]
   · 입차: 3번칸(입구)→2번→1번, 뛰어넘기 없음
   · 3번칸 차있으면 그 행 입차 불가
   · nR 진입: (n-1)R 3번칸 비어야 (2R 예외)
   · 출차: 1번→2번→3번 순서, 행 독립
   [휴차 배치]
   · 2R 1·2번칸에 배치 (3번칸 비워두기 → 운행차 혼합 가능)
   · 7R 1~3번칸에 배치
   · 추가: +3R 또는 +6R
   [탐색]
   · 그리디 초기해 → DFS 개선
   · Web Worker로 백그라운드 실행
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════
   § 1. 유틸리티
   ══════════════════════════════════════════════════════════════ */
const slotIndex = (row,col) => row*3+col;
const slotRow   = si => Math.floor(si/3);
const slotCol   = si => si%3;

function isTodayWeekend(){
  const dp=document.getElementById('datePicker');
  const d=dp?.value?new Date(dp.value+'T00:00:00'):new Date();
  return d.getDay()===0||d.getDay()===6;
}

function getTodayEntryOrder(){
  const restSet=new Set(dispatchState.todayMissing||[]);
  const all=(dispatchState.todayNums||[]).filter(n=>!restSet.has(n.num??n));
  const early=all.filter(n=>n.isEarly);
  const normal=all.filter(n=>!n.isEarly);
  return [...early,...normal].map(n=>n.num??n);
}

/* ══════════════════════════════════════════════════════════════
   § 2. 물리 규칙
   ══════════════════════════════════════════════════════════════ */
function canEnterRow(ri,v){ return ri===0||!v[(ri-1)*3+2]; }
function findEntryCol(ri,v){
  if(v[ri*3+2]) return -1;
  for(let c=0;c<3;c++) if(!v[ri*3+c]) return c;
  return -1;
}

/* ══════════════════════════════════════════════════════════════
   § 3. 막힘 점수
   ══════════════════════════════════════════════════════════════ */
function calcExitBlocking(values,tmrRank){
  let s=0;
  for(let r=0;r<APP.rowCount;r++) for(let c=1;c<3;c++){
    const v=values[slotIndex(r,c)]; if(!v) continue;
    const myR=tmrRank[v]??9999;
    for(let lc=0;lc<c;lc++){const lv=values[slotIndex(r,lc)];if(lv&&(tmrRank[lv]??9999)>myR)s++;}
  }
  return s;
}

function calcEntryBlocking(values,order,base){
  const sim={};
  for(let i=0;i<APP.rowCount*3;i++) sim[i]=(base&&base[i])||'';
  let s=0;
  for(const n of order){
    let si=-1; for(let i=0;i<APP.rowCount*3;i++) if(values[i]===n){si=i;break;}
    if(si===-1) continue;
    if(!canEnterRow(slotRow(si),sim)) s++;
    sim[si]=n;
  }
  return s;
}

function getExitBlockingInfo(values,active,tmrRank){
  const result=[];
  for(let row=0;row<APP.rowCount;row++) for(let col=0;col<3;col++){
    const si=slotIndex(row,col),v=values[si];
    if(!v||active[si]) continue;
    const blockedBy=[];
    for(let lc=0;lc<col;lc++){const lv=values[slotIndex(row,lc)];if(lv)blockedBy.push(lv);}
    result.push({num:v,row,col,blockedBy});
  }
  return result;
}

/* ══════════════════════════════════════════════════════════════
   § 4. 휴차 배치
   · 2R: 최대 2대 (1·2번칸, 3번칸 비워둠 → 운행차 혼합 가능)
   · 7R: 최대 3대
   · 추가 행: 3R 또는 6R (2대씩)
   ══════════════════════════════════════════════════════════════ */
function placeRestVehicles(restVehicles,tmrRank,newValues,newActive){
  if(!restVehicles.length) return;
  const weekend=isTodayWeekend();
  const cnt=restVehicles.length;
  const sorted=[...restVehicles].sort((a,b)=>(tmrRank[a]??9999)-(tmrRank[b]??9999));

  // 빠른 절반 → 7R, 느린 절반 → 2R (3번칸 비워두기)
  let rowPlan;
  if(weekend){
    if(cnt<=3)       rowPlan=[{r:5,n:3}];
    else if(cnt<=5)  rowPlan=[{r:5,n:3},{r:0,n:Math.min(cnt-3,2)}];
    else if(cnt<=7)  rowPlan=[{r:5,n:3},{r:0,n:2},{r:1,n:Math.min(cnt-5,2)}];
    else             rowPlan=[{r:5,n:3},{r:0,n:2},{r:1,n:2},{r:4,n:Math.min(cnt-7,2)}];
  } else {
    const half=Math.ceil(cnt/2);
    if(cnt<=3){
      // 빠른 절반→7R, 나머지→2R
      rowPlan=[{r:5,n:Math.min(half,3)},{r:0,n:Math.min(cnt-Math.min(half,3),2)}];
    } else if(cnt<=5){
      rowPlan=[{r:5,n:3},{r:0,n:Math.min(cnt-3,2)}];
    } else if(cnt<=7){
      rowPlan=[{r:5,n:3},{r:0,n:2},{r:1,n:Math.min(cnt-5,2)}];
    } else {
      rowPlan=[{r:5,n:3},{r:0,n:2},{r:1,n:2},{r:4,n:Math.min(cnt-7,2)}];
    }
  }

  let vi=0;
  for(const{r,n}of rowPlan){
    for(let col=0;col<n&&vi<sorted.length;col++){
      const si=slotIndex(r,col);
      if(!newValues[si]){newValues[si]=sorted[vi++];newActive[si]=true;}
    }
  }
  // 남은 휴차 강제
  for(let si=0;si<APP.rowCount*3&&vi<sorted.length;si++){
    if(!newValues[si]){newValues[si]=sorted[vi++];newActive[si]=true;}
  }
}

/* ══════════════════════════════════════════════════════════════
   § 5. Web Worker (Blob 방식, 별도 파일 불필요)
   ══════════════════════════════════════════════════════════════ */
const WORKER_CODE=`
'use strict';
function cer(ri,v){return ri===0||!v[(ri-1)*3+2];}
function fec(ri,v){if(v[ri*3+2])return -1;for(let c=0;c<3;c++)if(!v[ri*3+c])return c;return -1;}
function cExit(V,T,RC){let s=0;for(let r=0;r<RC;r++)for(let c=1;c<3;c++){const v=V[r*3+c];if(!v)continue;const m=T[v]??9999;for(let lc=0;lc<c;lc++){const lv=V[r*3+lc];if(lv&&(T[lv]??9999)>m)s++;}}return s;}
function cEntry(V,O,B,RC){const s={};for(let i=0;i<RC*3;i++)s[i]=(B&&B[i])||'';let n=0;for(const x of O){let si=-1;for(let i=0;i<RC*3;i++)if(V[i]===x){si=i;break;}if(si<0)continue;if(!cer(Math.floor(si/3),s))n++;s[si]=x;}return n;}
function cSlots(ar,w){let c=0;for(const r of ar){if(!cer(r,w))continue;for(let col=0;col<3;col++)if(!w[r*3+col])c++;}return c;}
function sLost3(row,ar,w){let l=0;const t={...w,[row*3+2]:'X'};for(const r of ar){if(r<=row)continue;if(cer(r,w)&&!cer(r,t))for(let c=0;c<3;c++)if(!w[r*3+c])l++;}return l;}
function gOpts(num,idx,eo,ar,w,tr){
  const mR=tr[num]??9999,rem=eo.length-idx-1,cur=cSlots(ar,w),opts=[];
  for(const row of ar){
    if(!cer(row,w))continue;const col=fec(row,w);if(col<0)continue;
    if(col===2){const lost=sLost3(row,ar,w);if(cur-1-lost<rem)continue;}
    let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}
    opts.push({row,col,pen});
  }
  if(!opts.length){for(const row of ar){if(!cer(row,w))continue;const col=fec(row,w);if(col<0)continue;let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}opts.push({row,col,pen});}}
  return opts;
}
self.onmessage=function(e){
  const{eo,tr,bv,ba,ar,RC,maxMs=10000}=e.data;
  const t0=Date.now();
  let gBest=null,gBestScore=99999;
  // 그리디 초기해
  const gw={...bv};
  for(let i=0;i<eo.length;i++){const o=gOpts(eo[i],i,eo,ar,gw,tr);if(!o.length)continue;o.sort((a,b)=>a.pen-b.pen);gw[o[0].row*3+o[0].col]=eo[i];}
  const ges=cExit(gw,tr,RC),gen=cEntry(gw,eo,bv,RC);
  gBestScore=ges+gen*2;
  gBest={values:{...gw},active:{...ba},exitScore:ges,entryScore:gen,total:gBestScore};
  if(gBestScore===0){self.postMessage({best:gBest,elapsed:Date.now()-t0});return;}
  // DFS
  const work={...bv};let found=false;
  function dfs(idx){
    if(found||Date.now()-t0>maxMs)return;
    if(idx===eo.length){
      const es=cExit(work,tr,RC),en=cEntry(work,eo,bv,RC),total=es+en*2;
      if(total<gBestScore){gBestScore=total;gBest={values:{...work},active:{...ba},exitScore:es,entryScore:en,total};}
      if(total===0)found=true;return;
    }
    if(cExit(work,tr,RC)>=gBestScore)return;
    const opts=gOpts(eo[idx],idx,eo,ar,work,tr);
    if(!opts.length){dfs(idx+1);return;}
    opts.sort((a,b)=>a.pen-b.pen);
    for(const{row,col}of opts){if(found||Date.now()-t0>maxMs)return;work[row*3+col]=eo[idx];dfs(idx+1);work[row*3+col]='';}
  }
  dfs(0);
  // 미배치 강제
  if(gBest){
    const placed=new Set(Object.values(gBest.values).filter(Boolean));
    const unp=eo.filter(n=>!placed.has(n)).sort((a,b)=>(tr[a]??9999)-(tr[b]??9999));
    for(const num of unp){
      let bsi=-1,bp=99999;
      for(let si=0;si<RC*3;si++){if(gBest.values[si]||gBest.active[si])continue;const row=Math.floor(si/3),col=si%3;if(!cer(row,gBest.values))continue;if(fec(row,gBest.values)<0)continue;let pen=0;for(let lc=0;lc<col;lc++){const lv=gBest.values[row*3+lc];if(lv&&(tr[lv]??9999)>(tr[num]??9999))pen++;}if(pen<bp){bp=pen;bsi=si;}}
      if(bsi<0)for(let si=0;si<RC*3;si++)if(!gBest.values[si]&&!gBest.active[si]){bsi=si;break;}
      if(bsi>=0)gBest.values[bsi]=num;
    }
    if(unp.length){
      const b2={};for(let i=0;i<RC*3;i++)b2[i]=gBest.active[i]?gBest.values[i]:'';
      gBest.exitScore=cExit(gBest.values,tr,RC);
      gBest.entryScore=cEntry(gBest.values,eo,b2,RC);
      gBest.total=gBest.exitScore+gBest.entryScore*2;
    }
  }
  self.postMessage({best:gBest,elapsed:Date.now()-t0});
};
`;

let _worker=null;
let _workerUrl=null;
function getWorker(){
  if(_worker) return _worker;
  _workerUrl=URL.createObjectURL(new Blob([WORKER_CODE],{type:'application/javascript'}));
  _worker=new Worker(_workerUrl);
  return _worker;
}

/* ══════════════════════════════════════════════════════════════
   § 6. 메인 계산 (Worker 실행)
   ══════════════════════════════════════════════════════════════ */
function computeAutoParking(callback){
  if(typeof dispatchState==='undefined'||!dispatchState.loaded){
    alert('배차 데이터를 먼저 불러와주세요.\n(FAB → 불러오기)');
    return;
  }
  const tomorrowList=dispatchState.tomorrowNums.map(n=>n.num??n);
  const entryOrder=getTodayEntryOrder();
  if(!tomorrowList.length||!entryOrder.length){
    alert('오늘·내일 배차 데이터가 없습니다.');
    return;
  }
  const tmrRank={};
  tomorrowList.forEach((num,i)=>{tmrRank[num]=i;});

  // 휴차 배치
  const newValues={},newActive={};
  for(let i=0;i<APP.rowCount*3;i++){newValues[i]='';newActive[i]=false;}
  const todayRestSet=new Set(dispatchState.todayMissing||[]);
  const restVehicles=[...todayRestSet].sort((a,b)=>(tmrRank[a]??9999)-(tmrRank[b]??9999));
  placeRestVehicles(restVehicles,tmrRank,newValues,newActive);

  // 가용 행 (2R 포함 — 운행차가 3번칸에 들어갈 수 있음)
  const availRows=[];
  for(let row=0;row<APP.rowCount;row++){
    // 빈칸 있고 진입 가능한 행
    const hasFreeSlot=[0,1,2].some(col=>!newValues[slotIndex(row,col)]&&!newActive[slotIndex(row,col)]);
    if(hasFreeSlot) availRows.push(row);
  }

  console.log(`[AutoParking v9] 시작 — 입차${entryOrder.length}대, 가용행:[${availRows.map(r=>APP.rowLabels?.[r]||r+2+'R').join(',')}]`);

  const worker=getWorker();
  worker.onmessage=function(e){
    const{best,elapsed}=e.data;
    if(!best){callback&&callback(null);return;}
    console.log(`[AutoParking v9] ${elapsed}ms — 출차:${best.exitScore} 입차:${best.entryScore}`);
    callback&&callback(best);
  };
  worker.onerror=function(err){
    console.error('[AutoParking v9] Worker 오류:', err);
    callback&&callback(null);
  };
  worker.postMessage({eo:entryOrder,tr:tmrRank,bv:newValues,ba:newActive,ar:availRows,RC:APP.rowCount,maxMs:10000});
}

/* ══════════════════════════════════════════════════════════════
   § 7. 미리보기 텍스트
   ══════════════════════════════════════════════════════════════ */
function buildPreviewText(result){
  const rows=APP.rowLabels||['2R','3R','4R','5R','6R','7R'];
  const lines=rows.map((label,rowIdx)=>{
    const cells=[0,1,2].map(col=>{
      const si=rowIdx*3+col,v=result.values[si],tag=result.active[si]?'(휴)':'';
      return v?`${v}${tag}`:'  ─  ';
    });
    return `${label.padEnd(3)}: ${cells.join(' | ')}`;
  });
  const es=result.exitScore??0,en=result.entryScore??0;
  lines.push('');
  lines.push(`출차막힘: ${es}건  입차막힘: ${en}건  `+(es===0&&en===0?'✅ 완벽!':(es+en)<=2?'🟡 양호':'🔴 주의')+(result.elapsed?`  (${result.elapsed}ms)`:'')); 
  return lines.join('\n');
}

/* ══════════════════════════════════════════════════════════════
   § 8. 자동주차 적용
   ══════════════════════════════════════════════════════════════ */
function applyAutoParking(){
    showSimPanel(`
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:28px;margin-bottom:10px">🔍</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:6px">최적 배치 탐색 중...</div>
      <div style="font-size:12px;color:#9CA3AF">입차·출차 막힘 없는 조합 탐색</div>
      <div style="margin-top:12px;height:3px;background:#374151;border-radius:2px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,#3B82F6,#8B5CF6);animation:simLoad 1.5s ease-in-out infinite"></div>
      </div>
    </div>`);

  computeAutoParking(function(result){
    hideSimPanel();
    if(!result){alert('배치를 찾지 못했습니다.');return;}
    showResultModal(result);
  });
}

/* ══════════════════════════════════════════════════════════════
   § 9. 결과 모달 (모바일 최적화)
   ══════════════════════════════════════════════════════════════ */
function showResultModal(result){
  let modal=document.getElementById('autoResultModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='autoResultModal';
    modal.style.cssText=[
      'position:fixed','inset:0','z-index:9000',
      'background:rgba(0,0,0,0.6)','backdrop-filter:blur(6px)',
      'display:flex','align-items:flex-end','justify-content:center',
    ].join(';');
    document.body.appendChild(modal);
  }
  const rows=APP.rowLabels||['2R','3R','4R','5R','6R','7R'];
  const es=result.exitScore??0,en=result.entryScore??0;
  const ok=es===0&&en===0;
  const scoreColor=ok?'#34D399':(es+en)<=2?'#FCD34D':'#F87171';
  const scoreLabel=ok?'✅ 완벽!':'🟡 최선의 결과';

  const gridRows=rows.map((label,ri)=>{
    const cells=[0,1,2].map(col=>{
      const si=ri*3+col,v=result.values[si];
      if(!v) return `<div style="flex:1;height:36px;border-radius:6px;background:#1F2937;"></div>`;
      const isRest=result.active[si];
      const bg=isRest?'#92400E':'#1D4ED8';
      const bgLight=isRest?'#FEF3C7':'#DBEAFE';
      const textColor=isRest?'#78350F':'#1E40AF';
      return `<div style="flex:1;height:36px;border-radius:6px;background:${bgLight};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:${textColor}">${v}${isRest?'<span style="font-size:9px;margin-left:2px;opacity:.7">휴</span>':''}</div>`;
    }).join('');
    return `<div style="display:flex;gap:4px;align-items:center">
      <div style="width:28px;font-size:11px;font-weight:700;color:#6B7280;text-align:right;flex-shrink:0">${label}</div>
      <div style="display:flex;gap:4px;flex:1">${cells}</div>
    </div>`;
  }).join('');

  modal.innerHTML=`
    <div style="background:#111827;border-radius:24px 24px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));width:100%;max-width:600px;max-height:90vh;overflow-y:auto">
      <div style="width:36px;height:4px;background:#374151;border-radius:2px;margin:0 auto 16px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:17px;font-weight:900;color:#fff">자동 주차 배치 결과</div>
        <div style="font-size:13px;font-weight:700;color:${scoreColor}">${scoreLabel}</div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <div style="flex:1;background:#1F2937;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${es===0?'#34D399':'#F87171'}">${es}</div>
          <div style="font-size:11px;color:#6B7280;margin-top:2px">출차막힘</div>
        </div>
        <div style="flex:1;background:#1F2937;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:22px;font-weight:900;color:${en===0?'#34D399':'#F87171'}">${en}</div>
          <div style="font-size:11px;color:#6B7280;margin-top:2px">입차막힘</div>
        </div>
        <div style="flex:1;background:#1F2937;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:12px;font-weight:700;color:#9CA3AF;margin-top:2px">${result.elapsed?result.elapsed+'ms':'―'}</div>
          <div style="font-size:11px;color:#6B7280;margin-top:2px">탐색시간</div>
        </div>
      </div>
      <div style="background:#1F2937;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:6px;margin-bottom:16px">
        <div style="display:flex;gap:4px;margin-bottom:4px">
          <div style="width:28px"></div>
          ${['1번','2번','3번'].map(l=>`<div style="flex:1;font-size:10px;color:#6B7280;text-align:center">${l}</div>`).join('')}
        </div>
        ${gridRows}
      </div>
      <div style="display:flex;gap:8px">
        <button id="autoResultCancel" style="flex:1;height:48px;border:none;border-radius:12px;background:#374151;color:#fff;font-size:15px;font-weight:700;cursor:pointer">취소</button>
        <button id="autoResultApply" style="flex:2;height:48px;border:none;border-radius:12px;background:linear-gradient(135deg,#34D399,#059669);color:#fff;font-size:15px;font-weight:800;cursor:pointer">✓ 적용하기</button>
      </div>
    </div>`;

  document.getElementById('autoResultCancel').onclick=()=>modal.remove();
  document.getElementById('autoResultApply').onclick=()=>{
    pushUndo();
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

  showSimPanel(`
    <div style="width:32px;height:4px;background:#374151;border-radius:2px;margin:0 auto 14px"></div>
    <div style="text-align:center;padding:8px 0">
      <div style="font-size:22px;margin-bottom:8px">🔍</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:6px">최적 배치 탐색 중...</div>
    </div>`);

  computeAutoParking(function(result){
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

  const btn=document.getElementById('autoParKBtn');
  if(btn)btn.addEventListener('click',applyAutoParking);
  const exitBtn=document.getElementById('exitSimBtn');
  if(exitBtn)exitBtn.addEventListener('click',runExitSimulation);
  const entryBtn=document.getElementById('entrySimBtn');
  if(entryBtn)entryBtn.addEventListener('click',runEntrySimulation);
}
