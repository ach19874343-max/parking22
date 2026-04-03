/* ============================================================
   autoparking-worker.js
   ─ Web Worker Blob 코드 (DFS 탐색 엔진)
   ─ computeAutoParking (휴차 후보별 순차 Worker 탐색)
   ============================================================
   의존: autoparking-core.js 먼저 로드 필요
     - generateRestCandidates
     - getTodayEntryOrder
     - slotIndex
   ============================================================ */
'use strict';

/* ══════════════════════════════════════════════════════════════
   § 5. Web Worker (Blob 방식, 별도 파일 불필요)
   ══════════════════════════════════════════════════════════════ */
const WORKER_CODE=`
'use strict';
function cer(ri,v,RC){
  if(ri===0) return true;
  if(!v[(ri-1)*3+2]) return true;
  // 위 행 3번칸 차 있어도 아래 행 2·3번칸 모두 비어있으면 진입 가능
  if(RC!==undefined&&ri<RC-1&&!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
  return false;
}
function fec(ri,v){if(v[ri*3+2])return -1;for(let c=0;c<3;c++)if(!v[ri*3+c])return c;return -1;}
function cExit(V,T,RC){let s=0;for(let r=0;r<RC;r++)for(let c=1;c<3;c++){const v=V[r*3+c];if(!v)continue;const m=T[v]??9999;for(let lc=0;lc<c;lc++){const lv=V[r*3+lc];if(lv&&(T[lv]??9999)>m)s++;}}return s;}
function cEntry(V,O,B,RC){
  const s={};for(let i=0;i<RC*3;i++)s[i]=(B&&B[i])||'';
  let n=0,col0streak=0; // col0streak: 연속 1번칸 입차 카운트
  for(const x of O){
    let si=-1;for(let i=0;i<RC*3;i++)if(V[i]===x){si=i;break;}
    if(si<0)continue;
    const row=Math.floor(si/3),col=si%3;
    if(!cer(row,s)){n++;s[si]=x;col0streak=col===0?col0streak+1:0;continue;}
    if(col===0&&!canCol0(row,s,RC)){n++;s[si]=x;col0streak=col0streak+1;continue;}
    // 연속 1번칸 3대 금지
    if(col===0&&col0streak>=2){n++;s[si]=x;col0streak=col0streak+1;continue;}
    s[si]=x;
    col0streak=col===0?col0streak+1:0;
  }
  return n;
}
function cSlots(ar,w){let c=0;for(const r of ar){if(!cer(r,w))continue;for(let col=0;col<3;col++)if(!w[r*3+col])c++;}return c;}
function sLost3(row,ar,w){let l=0;const t={...w,[row*3+2]:'X'};for(const r of ar){if(r<=row)continue;if(cer(r,w)&&!cer(r,t))for(let c=0;c<3;c++)if(!w[r*3+c])l++;}return l;}

// 아래 행 2·3번칸이 모두 비어있는지 확인
// 적용 대상: 2R(ri=0) 제외, 7R(ri=RC-1) 제외 (아래 행 없음)
// 아래 행에 이미 배치된 차가 있으면 false
function lowerClear(ri,w,RC){
  if(ri===0) return false;        // 2R 예외
  if(ri>=RC-1) return false;      // 7R(마지막행) 예외 — 아래 행 없음
  const below=ri+1;
  return !w[below*3+1]&&!w[below*3+2]; // 아래 행 2·3번칸 모두 비어있어야
}

// 1번칸(col=0) 배치 가능 여부 확인
// 적용: 4R(idx=2), 5R(idx=3), 6R(idx=4) — 2R·3R 예외
// 7R은 아래 행 없지만 예외 아님 — 7R 자체에 이 규칙 적용 안 함(휴차행)
// 위 행(row-1) 1번칸 또는 아래 행(row+1) 1번칸 중 하나에 차(운행·휴차 모두) 있어야 함
function canCol0(row,w,RC){
  if(row<=1) return true;          // 2R(0)·3R(1) 예외
  if(row>=RC-1) return true;       // 7R(마지막행) — 이 규칙 대상 아님(휴차행)
  const upHas   = w[(row-1)*3+0]; // 위 행 1번칸 (운행차·휴차 모두 포함)
  const downHas = w[(row+1)*3+0]; // 아래 행 1번칸 (운행차·휴차 모두 포함)
  return !!(upHas||downHas);
}

// 내일 출차 순서: 3R 1번이 2R 1번보다 먼저 출차(tr[3R]<tr[2R]). 2R 차량이 오늘·내일 휴차(br)면 비적용
function r23Viol(w,tr,br,enf){
  if(!enf)return false;
  const v2=w[0],v3=w[3];
  if(!v2)return false;
  if(br[v2])return false;
  if(!v3)return true;
  return (tr[v3]??9999)>=(tr[v2]??9999);
}
function r23SlotOk(row,col,num,w,tr,br,enf){
  if(!enf)return true;
  if(row===0&&col===0&&!br[num]){
    const v3=w[3];
    if(v3&&(tr[v3]??9999)>=(tr[num]??9999))return false;
  }
  if(row===1&&col===0){
    const v2=w[0];
    if(v2&&!br[v2]&&(tr[num]??9999)>=(tr[v2]??9999))return false;
  }
  return true;
}

function iterRowsBias(ar,num,tr,biasMid,earlyMax){
  if(!biasMid||(tr[num]??9999)>=earlyMax) return ar;
  const mid=[2,3,4],out=[],seen=new Set();
  for(const r of mid) if(ar.includes(r)){ out.push(r); seen.add(r); }
  for(const r of ar) if(!seen.has(r)) out.push(r);
  return out;
}
function sortOptsBias(opts,num,tr,biasMid,earlyMax){
  if(!biasMid||(tr[num]??9999)>=earlyMax){
    opts.sort((a,b)=>a.pen-b.pen||(b.fallbackPrio?1:0)-(a.fallbackPrio?1:0));
    return;
  }
  const mid=r=>r>=2&&r<=4;
  opts.sort((a,b)=>{
    const am=mid(a.row)?0:1,bm=mid(b.row)?0:1;
    if(am!==bm) return am-bm;
    if(a.col!==b.col) return a.col-b.col;
    if(a.pen!==b.pen) return a.pen-b.pen;
    return(b.fallbackPrio?1:0)-(a.fallbackPrio?1:0);
  });
}
function gOpts(num,idx,eo,ar,w,tr,fallback,RC,col0streak,enf,br,biasMid,earlyMax){
  const mR=tr[num]??9999,rem=eo.length-idx-1,cur=cSlots(ar,w),opts=[];
  for(const row of iterRowsBias(ar,num,tr,biasMid,earlyMax)){
    if(!cer(row,w))continue;const col=fec(row,w);if(col<0)continue;
    if(col===2){const lost=sLost3(row,ar,w);if(cur-1-lost<rem)continue;}
    // ── 1번칸 인접행 규칙: 4R·5R·6R에서 col=0이면 위아래 1번칸 확인 ──
    if(col===0&&!canCol0(row,w,RC)) continue;
    // ── 연속 1번칸 3대 금지 ──
    if(col===0&&(col0streak||0)>=2) continue;
    if(!r23SlotOk(row,col,num,w,tr,br,enf)) continue;
    let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}
    opts.push({row,col,pen});
    // ── 폴백 모드: 아래 행 2·3번칸 비어있으면 3번칸 배치도 선택지에 추가 ──
    if(fallback&&col<2&&lowerClear(row,w,RC)){
      if(!r23SlotOk(row,2,num,w,tr,br,enf)) continue;
      let pen3=0;for(let lc=0;lc<2;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen3++;}
      opts.push({row,col:2,pen:pen3,fallbackPrio:true});
    }
  }
  if(!opts.length){
    for(const row of iterRowsBias(ar,num,tr,biasMid,earlyMax)){
      if(!cer(row,w))continue;const col=fec(row,w);if(col<0)continue;if(!r23SlotOk(row,col,num,w,tr,br,enf))continue;
      let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}opts.push({row,col,pen});
    }
  }
  sortOptsBias(opts,num,tr,biasMid,earlyMax);
  return opts;
}
self.onmessage=function(e){
  const{eo,tr,bv,ba,ar,RC,maxMs=30000,fallback=false,enforce2r3r1=false,bothRest=[],biasMiddleEarly=false,earlyExitRankMax=999}=e.data;
  const br={};
  for(let i=0;i<bothRest.length;i++) br[bothRest[i]]=1;
  // RC 캡처한 cer 재정의 — 아래행 2·3번칸 비면 진입 가능 규칙 포함
  function cer(ri,v){
    if(ri===0) return true;
    if(!v[(ri-1)*3+2]) return true;
    if(ri<RC-1&&!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
    return false;
  }
  const t0=Date.now();
  function score(es,en){return en*1000+es;}
  function isPerfect(es,en,w){
    if(es!==0||en!==0)return false;
    if(enforce2r3r1&&r23Viol(w,tr,br,true))return false;
    return true;
  }
  const perfects=[];
  const perfectKeys=new Set();
  function addPerfect(w,es,en){
    if(perfects.length>=5) return;
    if(!isPerfect(es,en,w)) return;
    const key=JSON.stringify(w);
    if(perfectKeys.has(key)) return;
    perfectKeys.add(key);
    perfects.push({values:{...w},active:{...ba},exitScore:es,entryScore:en,total:0});
  }
  let gBest=null,gBestScore=99999;
  // 그리디 초기해
  const gw={...bv};
  let gStreak=0;
  for(let i=0;i<eo.length;i++){
    const o=gOpts(eo[i],i,eo,ar,gw,tr,fallback,RC,gStreak,enforce2r3r1,br,biasMiddleEarly,earlyExitRankMax);if(!o.length)continue;
    const chosen=o[0];
    gw[chosen.row*3+chosen.col]=eo[i];
    gStreak=chosen.col===0?gStreak+1:0;
  }
  const ges=cExit(gw,tr,RC),gen=cEntry(gw,eo,bv,RC),gs=score(ges,gen);
  if(gs<gBestScore&&!r23Viol(gw,tr,br,enforce2r3r1)){gBestScore=gs;gBest={values:{...gw},active:{...ba},exitScore:ges,entryScore:gen,total:gs};}
  addPerfect(gw,ges,gen);
  // DFS
  const work={...bv};
  function dfs(idx,streak){
    if(Date.now()-t0>maxMs) return;
    if(perfects.length>=5) return;
    if(idx===eo.length){
      if(enforce2r3r1&&r23Viol(work,tr,br,true)) return;
      const es=cExit(work,tr,RC),en=cEntry(work,eo,bv,RC),sc=score(es,en);
      if(sc<gBestScore){gBestScore=sc;gBest={values:{...work},active:{...ba},exitScore:es,entryScore:en,total:sc};}
      addPerfect(work,es,en);
      return;
    }
    const curEs=cExit(work,tr,RC);
    if(gBestScore<1000&&curEs>=gBestScore)return;
    const opts=gOpts(eo[idx],idx,eo,ar,work,tr,fallback,RC,streak,enforce2r3r1,br,biasMiddleEarly,earlyExitRankMax);
    if(!opts.length){dfs(idx+1,0);return;}
    for(const{row,col}of opts){
      if(Date.now()-t0>maxMs) return;
      if(perfects.length>=5) return;
      work[row*3+col]=eo[idx];
      dfs(idx+1,col===0?streak+1:0);
      work[row*3+col]='';
    }
  }
  dfs(0,0);
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
      gBest.total=gBest.entryScore*1000+gBest.exitScore;
    }
  }
  if(gBest&&enforce2r3r1&&r23Viol(gBest.values,tr,br,true)) gBest=null;
  self.postMessage({best:gBest,perfects,elapsed:Date.now()-t0});
};
`;

let _worker=null;
let _workerUrl=null;
function getWorker(){
  if(_worker){_worker.terminate();_worker=null;}
  _workerUrl=URL.createObjectURL(new Blob([WORKER_CODE],{type:'application/javascript'}));
  _worker=new Worker(_workerUrl);
  return _worker;
}

/* ══════════════════════════════════════════════════════════════
   § 6. 메인 계산 — 휴차 후보별 순차 Worker 탐색
   ─ generateRestCandidates 로 후보 목록 생성
   ─ 후보마다 Worker 에 투입, 패스당 긴 시간 예산으로 best 갱신
   ─ 완벽(입0·출0)은 최대 5개까지 수집 후 종료 · 입0·출1(비완벽)이면 대안 페이지 최대 3개만
   ─ 1단계: 내일 출차 빠른 차(tmrRank 상위 ~1/3)는 4R·5R·6R 행 우선·같은 행은 1→2→3칸 순 정렬
     → 완벽해 없으면 2단계: 기존 pen 기준 탐색으로 전체 재시작(출차순 제약 ON→OFF 동일)
    ══════════════════════════════════════════════════════════════ */
/** 완료 시 callback, 탐색 중 진행은 onProgress({ candDone, candTotal, perfectCount, perfectMax, phase, pct }) */
function computeAutoParking(callback, onProgress){
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
  /** 내일 순번 0..(이값-1) = 상위 약 1/3 “빠른 출차” → 1단계에서 4R·5R·6R·1·2·3칸 우선 탐색 */
  const earlyExitRankMax=Math.max(1,Math.ceil(tomorrowList.length/3));

  const todayRestSet=new Set(dispatchState.todayMissing||[]);
  /* 정비소 제외 차량은 휴차 배치에서도 제외 */
  const dateStr=document.getElementById('datePicker')?.value||'';
  const exSet=dispatchState.excludedAbsent?.[dateStr]||new Set();
  const restVehicles=[...todayRestSet].filter(n=>!exSet.has(n));
  const tomorrowRestSet=new Set(dispatchState.tomorrowMissing||[]);
  const bothRestList=[...todayRestSet].filter(n=>tomorrowRestSet.has(n));

  // 모든 휴차 배치 후보 생성
  const candidates=generateRestCandidates(restVehicles,tmrRank,APP.rowCount,dispatchState.tomorrowMissing);
  /** 제약 ON 패스 / 제약 OFF 재탐색 각각 독립 예산(늦게 나와도 더 넓게 탐색) */
  const TOTAL_MS_PER_PASS=420000;
  const MAX_PERFECT_VARIANTS=5;
  /** 비완벽인데 입0·출1일 때 결과 페이지 수(2~3장 정도만 보이게 상한 3) */
  const MAX_NEAR_PERFECT_PAGES=3;
  /** 1단계: 내일 빠른 차 → 4R·5R·6R 우선. 완벽해 없으면 2단계로 기존 탐색만 */
  let middleRowBiasPhase=true;
  let biasMiddleEarly=true;
  console.log(`[AutoParking v12] 시작 — 입차:${entryOrder.length}대, 휴차:${restVehicles.length}대, 후보:${candidates.length}개, 패스당~${Math.round(TOTAL_MS_PER_PASS/60000)}분 | 1단계:내일빠른차→4~6R우선(순번<${earlyExitRankMax})`);

  let t0global=Date.now();
  let globalBest=null;
  let globalBestScore=99999;
  const globalTop3=[];
  const globalPerfects=[];
  const globalPerfectKeys=new Set();
  let candIdx=0;
  let fallbackMode=false; // 폴백 모드 플래그
  /** true: 내일 출차순(3R1 먼저) 제약 적용 탐색 중 — 완벽(막힘0) 불가 시 false로 두 번째 패스 */
  let useExitOrderConstraint=true;

  function phaseLabel(){
    const rowBias=biasMiddleEarly?'4~6R우선':'기본탐색';
    const ex=useExitOrderConstraint?'출차순제약':'무제약';
    const fb=fallbackMode?' · 폴백':'';
    return rowBias+' · '+ex+fb;
  }
  function emitProgress(){
    if(typeof onProgress!=='function') return;
    const total=candidates.length||1;
    const done=Math.min(candIdx,total);
    const pct=Math.min(100,Math.round((done/total)*100));
    onProgress({
      candDone:done,
      candTotal:total,
      perfectCount:globalPerfects.length,
      perfectMax:MAX_PERFECT_VARIANTS,
      phase:phaseLabel(),
      pct,
    });
  }

  function runNext(){
    emitProgress();
    if(candIdx>=candidates.length){
      // 1차 탐색 소진 — 입차막힘 미해결 시 폴백 모드로 재탐색
      if(!fallbackMode && globalBestScore>=1000){
        fallbackMode=true;
        candIdx=0;
        console.log('[AutoParking v12] 폴백 모드 재탐색 시작 (아래행 3번칸 우선 배치)');
      } else {
        finish();return;
      }
    }
    const elapsed=Date.now()-t0global;
    if(elapsed>=TOTAL_MS_PER_PASS){emitProgress();finish();return;}

    const cand=candidates[candIdx++];
    const{values:bv,active:ba}=cand;

    // 가용 행: 휴차 배치 후 빈칸 있는 행
    const availRows=[];
    for(let row=0;row<APP.rowCount;row++){
      const hasFree=[0,1,2].some(col=>!bv[slotIndex(row,col)]&&!ba[slotIndex(row,col)]);
      if(hasFree) availRows.push(row);
    }

    // 남은 시간 균등 배분 (최소 500ms 보장)
    // 폴백 모드에서는 후보 전체를 한 번 더 돌므로 나머지 시간을 후보 수로 나눔
    const remaining=TOTAL_MS_PER_PASS-(Date.now()-t0global);
    const leftCands=(fallbackMode?candidates.length-candIdx+1:candidates.length*2-candIdx+1);
    const perMs=Math.min(90000,Math.max(1500,Math.floor(remaining/Math.max(1,leftCands))));

    const worker=getWorker();
    worker.onmessage=function(e){
      const{best,perfects,elapsed:wMs}=e.data;
      if(perfects&&perfects.length){
        for(const p of perfects){
          const k=JSON.stringify(p.values);
          if(globalPerfectKeys.has(k)) continue;
          globalPerfectKeys.add(k);
          globalPerfects.push({...p});
          if(globalPerfects.length>=MAX_PERFECT_VARIANTS) break;
        }
      }
      if(best&&best.total<globalBestScore){
        globalBestScore=best.total;
        globalBest=best;
        console.log(`[AutoParking v12]${biasMiddleEarly?' [4~6R우선]':''}${useExitOrderConstraint?'':' [무제약]'}${fallbackMode?' [폴백]':''} 후보${candIdx}/${candidates.length} ${wMs}ms — 입차막힘:${best.entryScore} 출차막힘:${best.exitScore}${best.entryScore===0&&best.exitScore===0?' ✅완벽':best.entryScore===0?' 🟡입차OK':''}`);
      }
      // top3 누적
      if(best){
        const dup=globalTop3.some(r=>JSON.stringify(r.values)===JSON.stringify(best.values));
        if(!dup){
          globalTop3.push({...best});
          globalTop3.sort((a,b)=>a.total-b.total);
          const cap=(best.entryScore===0&&best.exitScore===1)?MAX_NEAR_PERFECT_PAGES:3;
          if(globalTop3.length>cap) globalTop3.length=cap;
        }
      }
      if(globalPerfects.length>=MAX_PERFECT_VARIANTS){emitProgress();finish();return;}
      if(Date.now()-t0global>=TOTAL_MS_PER_PASS){emitProgress();finish();return;}
      runNext();
    };
    worker.onerror=function(err){
      console.error('[AutoParking v12] Worker 오류:',err);
      emitProgress();
      runNext();
    };
    worker.postMessage({
      eo:entryOrder, tr:tmrRank,
      bv, ba, ar:availRows,
      RC:APP.rowCount,
      maxMs:perMs,
      fallback:fallbackMode,
      enforce2r3r1:useExitOrderConstraint,
      bothRest:bothRestList,
      biasMiddleEarly,
      earlyExitRankMax
    });
  }

  function finish(){
    if(_worker){_worker.terminate();_worker=null;}
    const hasAnyPerfect=globalPerfects.length>0;
    if(useExitOrderConstraint&&!hasAnyPerfect){
      console.log('[AutoParking v12] 출차순 제약(3R1 먼저)으로 막힘 0 불가 → 후보·폴백·순열 전부 처음부터 무제약 재탐색 (새 패스)');
      useExitOrderConstraint=false;
      candIdx=0;
      fallbackMode=false;
      globalBest=null;
      globalBestScore=99999;
      globalTop3.length=0;
      globalPerfects.length=0;
      globalPerfectKeys.clear();
      t0global=Date.now();
      runNext();
      return;
    }
    if(middleRowBiasPhase&&!hasAnyPerfect){
      console.log('[AutoParking v12] 1단계(4~6R·내일빠른차 우선)에서 완벽해 없음 → 2단계: 기존 탐색 순서로 전체 재시작');
      middleRowBiasPhase=false;
      biasMiddleEarly=false;
      useExitOrderConstraint=true;
      candIdx=0;
      fallbackMode=false;
      globalBest=null;
      globalBestScore=99999;
      globalTop3.length=0;
      globalPerfects.length=0;
      globalPerfectKeys.clear();
      t0global=Date.now();
      runNext();
      return;
    }
    if(globalPerfects.length){
      globalBest=globalPerfects[0];
      globalTop3.length=0;
      globalPerfects.forEach(p=>globalTop3.push({...p}));
    } else if(globalBest&&globalBest.entryScore===0&&globalBest.exitScore===1){
      const only=globalTop3.filter(r=>r.entryScore===0&&r.exitScore===1).sort((a,b)=>a.total-b.total);
      globalTop3.length=0;
      only.slice(0,MAX_NEAR_PERFECT_PAGES).forEach(p=>globalTop3.push(p));
      if(!globalTop3.length) globalTop3.push({...globalBest});
    }
    if(!globalBest){callback&&callback(null,null);return;}
    const elapsed=Date.now()-t0global;
    globalBest.elapsed=elapsed;
    globalTop3.forEach(r=>{r.elapsed=elapsed;});
    console.log(`[AutoParking v12] 완료 ${elapsed}ms — 최종 입차막힘:${globalBest.entryScore} 출차막힘:${globalBest.exitScore} 대안:${globalTop3.length}개${biasMiddleEarly?'':' (2단계·기본탐색)'}${useExitOrderConstraint?'':' (출차순 제약 미적용)'}`);
    callback&&callback(globalBest, globalTop3.length>=1?globalTop3:null);
  }

  runNext();
}
