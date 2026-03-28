/* ============================================================
   autoparking.js v10.0
   ─ Web Worker 기반 백그라운드 탐색 (UI 블로킹 없음)
   ─ 휴차 행(2R,7R)에 운행차 혼합 배치 허용
   ─ 오늘 입차 막힘 0 필수, 내일 출차 막힘 0 목표
   ============================================================
   [물리 규칙]
   · 입차: 3번칸(입구)→2번→1번, 뛰어넘기 없음
   · 3번칸 차있으면 그 행 입차 불가
   · nR 진입: (n-1)R 3번칸 비어야 (2R 예외)
   · 출차: 1번→2번→3번 순서, 행 독립
   [휴차 배치]
   · 2R: 1~3번칸 모두 사용 가능 (오늘/내일 영향 없는 경우 3번칸도 허용)
   · 7R 1~3번칸에 배치
   · 추가: +3R 또는 +6R
   [탐색]
   · 휴차 여러 배치 후보 생성 → 각 후보마다 Worker 탐색
   · 오늘 입차 막힘 0이면 조기 종료, 내일 막힘도 0이면 최적
   · 최대 시간까지 탐색하여 최선 결과 반환
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
  /* 정비소 제외 차량도 입차 순서에서 제외 */
  const dateStr=document.getElementById('datePicker')?.value||'';
  const exSet=dispatchState.excludedAbsent?.[dateStr]||new Set();
  const all=(dispatchState.todayNums||[]).filter(n=>!restSet.has(n.num??n)&&!exSet.has(n.num??n));
  const early=all.filter(n=>n.isEarly);
  const normal=all.filter(n=>!n.isEarly);
  return [...early,...normal].map(n=>n.num??n);
}

/* ══════════════════════════════════════════════════════════════
   § 2. 물리 규칙
   ══════════════════════════════════════════════════════════════ */
function canEnterRow(ri,v){
  if(ri===0) return true;              // 2R 예외
  if(!v[(ri-1)*3+2]) return true;     // 위 행 3번칸 비어있으면 진입 가능
  // 위 행 3번칸 차 있어도 아래 행 2·3번칸 모두 비어있으면 진입 가능
  // (아래 행이 없는 마지막 행은 해당 없음)
  const RC=APP.rowCount;
  if(ri<RC-1&&!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
  return false;
}
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

// 1번칸 인접행 규칙 (메인 스레드용)
// 4R(idx=2)·5R(idx=3)·6R(idx=4): 위 행 또는 아래 행 1번칸에 차 있어야 col=0 배치 가능
// 2R(0)·3R(1)·7R(RC-1) 예외
function canEnterCol0(row, sim){
  const RC=APP.rowCount;
  if(row<=1) return true;         // 2R·3R 예외
  if(row>=RC-1) return true;      // 7R — 이 규칙 대상 아님
  return !!(sim[slotIndex(row-1,0)]||sim[slotIndex(row+1,0)]);
}

function calcEntryBlocking(values,order,base){
  const sim={};
  for(let i=0;i<APP.rowCount*3;i++) sim[i]=(base&&base[i])||'';
  let s=0, col0streak=0;
  for(const n of order){
    let si=-1; for(let i=0;i<APP.rowCount*3;i++) if(values[i]===n){si=i;break;}
    if(si===-1) continue;
    const row=slotRow(si),col=slotCol(si);
    if(!canEnterRow(row,sim)){s++;sim[si]=n;col0streak=col===0?col0streak+1:0;continue;}
    if(col===0&&!canEnterCol0(row,sim)){s++;sim[si]=n;col0streak=col0streak+1;continue;}
    // 연속 1번칸 3대 금지
    if(col===0&&col0streak>=2){s++;sim[si]=n;col0streak=col0streak+1;continue;}
    sim[si]=n;
    col0streak=col===0?col0streak+1:0;
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
   § 4. 휴차 배치 후보 생성
   ─ 행별 배분 수(n) × 3번칸 사용여부 조합 → 모든 후보 반환
   ─ 사용 행: r0=2R(idx0), r5=7R(idx5), r1=3R(idx1), r4=6R(idx4)
   ─ 2R 3번칸도 허용 (오늘/내일 입차에 영향 없으면 Worker가 판단)
   [제약]
   · 최대 3개 행 사용 (4행 이상 불가)
   · 3R 사용 → 반드시 2R에도 휴차 있어야 함
   · 6R 사용 → 반드시 7R에도 휴차 있어야 함
   ══════════════════════════════════════════════════════════════ */
function buildRestState(sorted, rowPlan, RC){
  // rowPlan: [{r:rowIdx, slots:[col,...]}]  — 실제 칸 목록
  const values={}, active={};
  for(let i=0;i<RC*3;i++){values[i]='';active[i]=false;}
  let vi=0;
  for(const{r,slots}of rowPlan){
    for(const col of slots){
      if(vi>=sorted.length) break;
      const si=r*3+col;
      values[si]=sorted[vi++]; active[si]=true;
    }
  }
  // 남은 휴차 강제 배치 (overflow)
  for(let si=0;si<RC*3&&vi<sorted.length;si++){
    if(!values[si]){values[si]=sorted[vi++];active[si]=true;}
  }
  return {values,active};
}

/**
 * 모든 휴차 배치 후보를 생성한다.
 * 행 순서: 2R(r=0), 7R(r=5), 3R(r=1), 6R(r=4)
 * [제약]
 *   1) 최대 3개 행만 사용 가능
 *   2) 3R(r=1) 사용 시 2R(r=0)에도 반드시 휴차 있어야 함
 *   3) 6R(r=4) 사용 시 7R(r=5)에도 반드시 휴차 있어야 함
 */
function generateRestCandidates(restVehicles, tmrRank, RC){
  if(!restVehicles.length){
    const values={},active={};
    for(let i=0;i<RC*3;i++){values[i]='';active[i]=false;}
    return [{values,active}];
  }
  const sorted=[...restVehicles].sort((a,b)=>(tmrRank[a]??9999)-(tmrRank[b]??9999));
  const cnt=sorted.length;

  // 인덱스: 0=2R(r0), 1=7R(r5), 2=3R(r1), 3=6R(r4)
  // 3R·6R 모두 1~3번칸 허용 (maxN:3)
  const ROW_DEFS=[
    {r:0, maxN:3, cols:[0,1,2]},  // 2R
    {r:5, maxN:3, cols:[0,1,2]},  // 7R
    {r:1, maxN:3, cols:[0,1,2]},  // 3R: 1~3번칸 모두 허용
    {r:4, maxN:3, cols:[0,1,2]},  // 6R: 1~3번칸 모두 허용
  ];

  const candidates=new Map();
  const numRows=ROW_DEFS.length;

  function enumerate(rowIdx, remaining, plan, usedRows, n2R, n7R){
    if(remaining===0 || rowIdx===numRows){
      if(remaining>0) return;
      const state=buildRestState(sorted, plan, RC);
      const key=JSON.stringify(state.values);
      if(!candidates.has(key)) candidates.set(key,state);
      return;
    }
    const{r,maxN,cols}=ROW_DEFS[rowIdx];
    const maxHere=Math.min(maxN,remaining);

    for(let n=0;n<=maxHere;n++){
      const willUse=n>0?1:0;

      // ── 제약 1: 최대 3개 행 ──
      if(usedRows+willUse>3) continue;

      // ── 제약 2: 3R은 2R 있을 때만 ──
      if(rowIdx===2 && n>0 && n2R===0) continue;

      // ── 제약 3: 6R은 7R 있을 때만 ──
      if(rowIdx===3 && n>0 && n7R===0) continue;

      // ── 제약 4: 3R 대수 ≤ 2R 대수 ──
      if(rowIdx===2 && n>n2R) continue;

      // ── 제약 5: 6R 대수 ≤ 7R 대수 ──
      if(rowIdx===3 && n>n7R) continue;

      // ── 제약 6: 휴차 3대 이하는 2R·7R만 사용 (3R·6R 불가) ──
      if(cnt<=3 && (rowIdx===2||rowIdx===3) && n>0) continue;

      // 칸 선택 조합 생성
      const slotCombos=[];
      if(n===0){
        slotCombos.push([]);
      } else if(r===0 && n<=2){
        // 2R: 1~2대일 때 3번칸 포함/제외 두 버전
        slotCombos.push(cols.slice(0,n));
        if(n===1) slotCombos.push([2]);
        if(n===2) slotCombos.push([0,2],[1,2]);
      } else {
        slotCombos.push(cols.slice(0,n));
      }

      for(const slots of slotCombos){
        const next2R = rowIdx===0 ? n : n2R;
        const next7R = rowIdx===1 ? n : n7R;
        enumerate(rowIdx+1, remaining-n, [...plan,{r,slots}], usedRows+willUse, next2R, next7R);
      }
    }
  }

  enumerate(0, cnt, [], 0, 0, 0);

  // overflow fallback
  if(candidates.size===0){
    const fallback={values:{},active:{}};
    for(let i=0;i<RC*3;i++){fallback.values[i]='';fallback.active[i]=false;}
    let vi=0;
    for(let si=0;si<RC*3&&vi<sorted.length;si++){
      if(!fallback.values[si]){fallback.values[si]=sorted[vi++];fallback.active[si]=true;}
    }
    return [fallback];
  }

  // ── 우선순위 정렬 ──
  function rowUsed(v,r){return [0,1,2].some(c=>v[r*3+c]);}
  function rowCount(v,r){return [0,1,2].filter(c=>v[r*3+c]).length;}

  function groupKey(v){
    const u2=rowUsed(v,0),u7=rowUsed(v,5),u3=rowUsed(v,1),u6=rowUsed(v,4);
    const n2=rowCount(v,0),n7=rowCount(v,5),n3=rowCount(v,1),n6=rowCount(v,4);

    // ── 3대 이하: 7R만 > 2R+7R > 2R만 ──
    if(cnt<=3){
      if(!u2&& u7&&!u3&&!u6) return 0; // 7R만
      if( u2&& u7&&!u3&&!u6) return 1; // 2R+7R
      if( u2&&!u7&&!u3&&!u6) return 2; // 2R만
      return 9;
    }

    // ── 4대 이상: 2R+7R > 2R+3R > 2R+7R+3R > 2R+7R+6R > 7R+6R ──
    if( u2&& u7&&!u3&&!u6) return 0; // 2R+7R
    if( u2&&!u7&& u3&&!u6) return 1; // 2R+3R
    if( u2&& u7&& u3&&!u6) return 2; // 2R+7R+3R
    if( u2&& u7&&!u3&& u6) return 3; // 2R+7R+6R
    if(!u2&& u7&&!u3&& u6) return 4; // 7R+6R
    return 9;
  }

  return [...candidates.values()].sort((a,b)=>{
    const ga=groupKey(a.values), gb=groupKey(b.values);
    if(ga!==gb) return ga-gb;
    // 같은 그룹 내: 2R 대수 내림차순 → 7R 대수 내림차순
    const d2=rowCount(b.values,0)-rowCount(a.values,0);
    if(d2!==0) return d2;
    const d7=rowCount(b.values,5)-rowCount(a.values,5);
    if(d7!==0) return d7;
    // 3R 내림차순 → 6R 내림차순
    const d3=rowCount(b.values,1)-rowCount(a.values,1);
    if(d3!==0) return d3;
    return rowCount(b.values,4)-rowCount(a.values,4);
  });
}

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

function gOpts(num,idx,eo,ar,w,tr,fallback,RC,col0streak){
  const mR=tr[num]??9999,rem=eo.length-idx-1,cur=cSlots(ar,w),opts=[];
  for(const row of ar){
    if(!cer(row,w))continue;const col=fec(row,w);if(col<0)continue;
    if(col===2){const lost=sLost3(row,ar,w);if(cur-1-lost<rem)continue;}
    // ── 1번칸 인접행 규칙: 4R·5R·6R에서 col=0이면 위아래 1번칸 확인 ──
    if(col===0&&!canCol0(row,w,RC)) continue;
    // ── 연속 1번칸 3대 금지 ──
    if(col===0&&(col0streak||0)>=2) continue;
    let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}
    opts.push({row,col,pen});
    // ── 폴백 모드: 아래 행 2·3번칸 비어있으면 3번칸 배치도 선택지에 추가 ──
    if(fallback&&col<2&&lowerClear(row,w,RC)){
      let pen3=0;for(let lc=0;lc<2;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen3++;}
      opts.push({row,col:2,pen:pen3,fallbackPrio:true});
    }
  }
  if(!opts.length){for(const row of ar){if(!cer(row,w))continue;const col=fec(row,w);if(col<0)continue;let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}opts.push({row,col,pen});}}
  return opts;
}
self.onmessage=function(e){
  const{eo,tr,bv,ba,ar,RC,maxMs=30000,fallback=false}=e.data;
  // RC 캡처한 cer 재정의 — 아래행 2·3번칸 비면 진입 가능 규칙 포함
  function cer(ri,v){
    if(ri===0) return true;
    if(!v[(ri-1)*3+2]) return true;
    if(ri<RC-1&&!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
    return false;
  }
  const t0=Date.now();
  function score(es,en){return en*1000+es;}
  function isPerfect(es,en){return es===0&&en===0;}
  let gBest=null,gBestScore=99999;
  // 그리디 초기해
  const gw={...bv};
  let gStreak=0;
  for(let i=0;i<eo.length;i++){
    const o=gOpts(eo[i],i,eo,ar,gw,tr,fallback,RC,gStreak);if(!o.length)continue;
    o.sort((a,b)=>a.pen-b.pen||(b.fallbackPrio?1:0)-(a.fallbackPrio?1:0));
    const chosen=o[0];
    gw[chosen.row*3+chosen.col]=eo[i];
    gStreak=chosen.col===0?gStreak+1:0;
  }
  const ges=cExit(gw,tr,RC),gen=cEntry(gw,eo,bv,RC),gs=score(ges,gen);
  if(gs<gBestScore){gBestScore=gs;gBest={values:{...gw},active:{...ba},exitScore:ges,entryScore:gen,total:gs};}
  let found=isPerfect(ges,gen);
  // DFS
  const work={...bv};
  function dfs(idx,streak){
    if(found||Date.now()-t0>maxMs)return;
    if(idx===eo.length){
      const es=cExit(work,tr,RC),en=cEntry(work,eo,bv,RC),sc=score(es,en);
      if(sc<gBestScore){gBestScore=sc;gBest={values:{...work},active:{...ba},exitScore:es,entryScore:en,total:sc};}
      if(isPerfect(es,en))found=true;
      return;
    }
    const curEs=cExit(work,tr,RC);
    if(gBestScore<1000&&curEs>=gBestScore)return;
    const opts=gOpts(eo[idx],idx,eo,ar,work,tr,fallback,RC,streak);
    if(!opts.length){dfs(idx+1,0);return;}
    opts.sort((a,b)=>a.pen-b.pen||(b.fallbackPrio?1:0)-(a.fallbackPrio?1:0));
    for(const{row,col}of opts){
      if(found||Date.now()-t0>maxMs)return;
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
  self.postMessage({best:gBest,elapsed:Date.now()-t0});
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
   ─ 후보마다 Worker 에 투입, 전체 maxMs(30s) 내 best 갱신
   ─ 오늘 입차막힘=0 AND 내일 출차막힘=0 → 완벽, 즉시 종료
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

  const todayRestSet=new Set(dispatchState.todayMissing||[]);
  /* 정비소 제외 차량은 휴차 배치에서도 제외 */
  const dateStr=document.getElementById('datePicker')?.value||'';
  const exSet=dispatchState.excludedAbsent?.[dateStr]||new Set();
  const restVehicles=[...todayRestSet].filter(n=>!exSet.has(n));

  // 모든 휴차 배치 후보 생성
  const candidates=generateRestCandidates(restVehicles,tmrRank,APP.rowCount);
  console.log(`[AutoParking v11] 시작 — 입차:${entryOrder.length}대, 휴차:${restVehicles.length}대, 배치후보:${candidates.length}개, 최대탐색:30s`);

  const TOTAL_MS=30000;
  const t0global=Date.now();
  let globalBest=null;
  let globalBestScore=99999;
  let candIdx=0;
  let fallbackMode=false; // 폴백 모드 플래그

  function runNext(){
    if(candIdx>=candidates.length){
      // 1차 탐색 소진 — 입차막힘 미해결 시 폴백 모드로 재탐색
      if(!fallbackMode && globalBestScore>=1000){
        fallbackMode=true;
        candIdx=0;
        console.log('[AutoParking v11] 폴백 모드 재탐색 시작 (아래행 3번칸 우선 배치)');
      } else {
        finish();return;
      }
    }
    const elapsed=Date.now()-t0global;
    if(elapsed>=TOTAL_MS){finish();return;}

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
    const remaining=TOTAL_MS-(Date.now()-t0global);
    const leftCands=(fallbackMode?candidates.length-candIdx+1:candidates.length*2-candIdx+1);
    const perMs=Math.max(500,Math.floor(remaining/Math.max(1,leftCands)));

    const worker=getWorker();
    worker.onmessage=function(e){
      const{best,elapsed:wMs}=e.data;
      if(best&&best.total<globalBestScore){
        globalBestScore=best.total;
        globalBest=best;
        console.log(`[AutoParking v11]${fallbackMode?' [폴백]':''} 후보${candIdx}/${candidates.length} ${wMs}ms — 입차막힘:${best.entryScore} 출차막힘:${best.exitScore}${best.entryScore===0&&best.exitScore===0?' ✅완벽':best.entryScore===0?' 🟡입차OK':''}`);
      }
      if(globalBestScore===0){finish();return;}
      if(Date.now()-t0global>=TOTAL_MS){finish();return;}
      runNext();
    };
    worker.onerror=function(err){
      console.error('[AutoParking v11] Worker 오류:',err);
      runNext();
    };
    worker.postMessage({
      eo:entryOrder, tr:tmrRank,
      bv, ba, ar:availRows,
      RC:APP.rowCount,
      maxMs:perMs,
      fallback:fallbackMode
    });
  }

  function finish(){
    if(_worker){_worker.terminate();_worker=null;}
    if(!globalBest){callback&&callback(null);return;}
    globalBest.elapsed=Date.now()-t0global;
    console.log(`[AutoParking v11] 완료 ${globalBest.elapsed}ms — 최종 입차막힘:${globalBest.entryScore} 출차막힘:${globalBest.exitScore}`);
    callback&&callback(globalBest);
  }

  runNext();
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
  lines.push(`출차막힘: ${es}건  입차막힘: ${en}건  `+(es===0&&en===0?'✅ 완벽!':en===0?'🟡 입차OK (출차주의)':'🔴 입차막힘 있음')+(result.elapsed?`  (${result.elapsed}ms)`:'')); 
  return lines.join('\n');
}

/* ══════════════════════════════════════════════════════════════
   § 8. 자동주차 적용
   ══════════════════════════════════════════════════════════════ */
function applyAutoParking(){
  let cancelled=false;
  showSimPanel(`
    <div style="text-align:center;padding:16px 0">
      <div style="font-size:28px;margin-bottom:10px">🔍</div>
      <div style="font-size:15px;font-weight:800;margin-bottom:6px">최적 배치 탐색 중...</div>
      <div style="font-size:12px;color:#9CA3AF">입차·출차 막힘 없는 조합 탐색</div>
      <div style="margin-top:12px;height:3px;background:#374151;border-radius:2px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,#3B82F6,#8B5CF6);animation:simLoad 1.5s ease-in-out infinite"></div>
      </div>
      <button id="searchCancelBtn" style="margin-top:16px;padding:10px 28px;border:none;border-radius:10px;background:#374151;color:#9CA3AF;font-size:14px;font-weight:700;cursor:pointer">✕ 닫기</button>
    </div>`);
  document.getElementById('searchCancelBtn').onclick=()=>{
    cancelled=true;
    if(_worker){_worker.terminate();_worker=null;}
    hideSimPanel();
  };

  computeAutoParking(function(result){
    if(cancelled) return;
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
  const entryOk=en===0;
  const scoreColor=ok?'#34D399':entryOk?'#FCD34D':'#F87171';
  const scoreLabel=ok?'✅ 완벽!':entryOk?'🟡 입차OK (출차주의)':'🔴 입차막힘 있음';

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
