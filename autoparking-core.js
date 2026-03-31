/* ============================================================
   autoparking-core.js
   ─ 유틸리티, 물리 규칙, 막힘 점수 계산
   ─ 휴차 배치 후보 생성
   ─ 결과 미리보기 텍스트
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
function buildRestState(sorted, rowPlan, RC, tmrRank){
  const values={}, active={};
  for(let i=0;i<RC*3;i++){values[i]='';active[i]=false;}
  let vi=0;
  for(const{r,slots}of rowPlan){
    const rowVehicles=[];
    for(let s=0;s<slots.length;s++){
      if(vi+s>=sorted.length)break;
      rowVehicles.push(sorted[vi+s]);
    }
    vi+=rowVehicles.length;
    // 행 내에서 빠른 차(rank 낮음)를 1번칸(안쪽)에 → 출차 시 막힘 없음
    rowVehicles.sort((a,b)=>(tmrRank[a]??9999)-(tmrRank[b]??9999));
    for(let s=0;s<slots.length;s++){
      if(s>=rowVehicles.length)break;
      const si=r*3+slots[s];
      values[si]=rowVehicles[s]; active[si]=true;
    }
  }
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
  // 내림차순: 내일 휴차(9999)를 앞(2R), 내일 운행차(rank 낮음)를 뒤(7R)
  const sorted=[...restVehicles].sort((a,b)=>(tmrRank[b]??9999)-(tmrRank[a]??9999));
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
      const state=buildRestState(sorted, plan, RC, tmrRank);
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
