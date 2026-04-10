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

function getTodayEntryOrder(){
  const restSet=new Set(dispatchState.todayMissing||[]);
  /* 정비소 제외 차량도 입차 순서에서 제외 */
  const dateStr=document.getElementById('datePicker')?.value||'';
  const exSet=dispatchState.excludedAbsent?.[dateStr]||new Set();
  const all=(dispatchState.todayNums||[]).filter(n=>!restSet.has(n.num??n)&&!exSet.has(n.num??n));
  const so=(n)=>(typeof n.startOrder==='number'?n.startOrder:9999);

  /* startOrder 오름차순 정렬 */
  const sorted=[...all].sort((a,b)=>so(a)-so(b));

  /* 조기(isEarly===true) 중 가장 작은 startOrder → 원형 시작점 */
  const earlyOrders=sorted.filter(n=>n.isEarly).map(n=>so(n));
  if(!earlyOrders.length){
    /* 조기 없으면 그냥 순서대로 */
    return sorted.map(n=>n.num??n);
  }
  const earlyFirst=Math.min(...earlyOrders);
  /* earlyFirst 인덱스부터 끝까지 + 처음부터 earlyFirst 앞까지 (원형) */
  const pivot=sorted.findIndex(n=>so(n)===earlyFirst);
  const ordered=[...sorted.slice(pivot),...sorted.slice(0,pivot)];
  return ordered.map(n=>n.num??n);
}

/* ══════════════════════════════════════════════════════════════
   § 2. 물리 규칙
   ══════════════════════════════════════════════════════════════ */
/**
 * @param {number} ri - 행 인덱스
 * @param {Object} v  - 현재 슬롯 상태
 * @param {boolean} [fallback=false]
 *   false(1단계): 아래 행 2번칸+3번칸 둘 다 비어야 우회 진입 허용
 *   true (2단계): 아래 행 3번칸만 비어도 우회 진입 허용 (더 관대)
 */
function canEnterRow(ri,v,fallback){
  if(ri===0) return true;              // 2R 예외
  /* 3R: 위행(2R) 3번칸 비면 진입 가능.
     위행 3번칸에 차가 있어도 아래행(4R) 3번칸이 비면 진입 가능(아래행 2번칸까지 차 있어도 허용). */
  if(ri===1){
    // 위 행(2R) 3번칸 비어있으면 OK
    if(!v[(ri-1)*3+2]) return true;
    const RC=APP.rowCount;
    // 아래 행(4R) 3번칸 비어있으면 OK (2번칸은 차 있어도 됨)
    if(ri<RC-1 && !v[(ri+1)*3+2]) return true;
    return false;
  }
  if(!v[(ri-1)*3+2]) return true;     // 위 행 3번칸 비어있으면 진입 가능
  const RC=APP.rowCount;
  if(ri<RC-1){
    if(fallback){
      if(!v[(ri+1)*3+2]) return true;
    } else {
      if(!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
    }
  }
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
// 규칙 적용: 5R(idx=3)·6R(idx=4)만 — 위 행 또는 아래 행 1번칸에 차 있어야 col=0 배치 가능
// 예외(상관 없음): 2R(0)·3R(1)·4R(2)·7R(RC-1)
function canEnterCol0(row, sim){
  const RC=APP.rowCount;
  if(row<=2) return true;         // 2R·3R·4R 예외
  if(row>=RC-1) return true;      // 7R — 이 규칙 대상 아님
  return !!(sim[slotIndex(row-1,0)]||sim[slotIndex(row+1,0)]);
}

function calcEntryBlocking(values,order,base,fallback){
  const sim={};
  for(let i=0;i<APP.rowCount*3;i++) sim[i]=(base&&base[i])||'';
  let s=0, col0streak=0;
  for(const n of order){
    let si=-1; for(let i=0;i<APP.rowCount*3;i++) if(values[i]===n){si=i;break;}
    if(si===-1) continue;
    const row=slotRow(si),col=slotCol(si);
    // 행은 반드시 1→2→3 순서(prefix)로만 채워질 수 있음 (점프 배치 금지)
    const firstEmpty=findEntryCol(row,sim);
    if(firstEmpty!==col){s++;sim[si]=n;col0streak=col===0?col0streak+1:0;continue;}
    if(!canEnterRow(row,sim,fallback)){s++;sim[si]=n;col0streak=col===0?col0streak+1:0;continue;}
    if(col===0&&!canEnterCol0(row,sim)){s++;sim[si]=n;col0streak=col0streak+1;continue;}
    // 연속 1번칸 3대 금지
    if(col===0&&col0streak>=2){s++;sim[si]=n;col0streak=col0streak+1;continue;}
    sim[si]=n;
    col0streak=col===0?col0streak+1:0;
  }
  return s;
}

/**
 * 디버그용: 입차 막힘 사유를 상세 로그로 반환
 * - calcEntryBlocking과 동일한 규칙/시뮬레이션을 쓰되, "왜 막혔는지"를 기록
 * @returns {{count:number, events:Array<{num:string, slot:number, row:number, col:number, reason:string}>}}
 */
function explainEntryBlocking(values, order, base, fallback){
  const sim={};
  for(let i=0;i<APP.rowCount*3;i++) sim[i]=(base&&base[i])||'';
  const events=[];
  let col0streak=0;
  for(const n of order){
    let si=-1; for(let i=0;i<APP.rowCount*3;i++) if(values[i]===n){si=i;break;}
    if(si===-1) continue;
    const row=slotRow(si),col=slotCol(si);
    let reason='';
    const firstEmpty=findEntryCol(row,sim);
    if(firstEmpty!==col){
      reason='행 1→2→3 순서(prefix) 위반 (점프 배치 금지)';
      events.push({num:String(n),slot:si,row,col,reason});
      sim[si]=n; col0streak=col===0?col0streak+1:0;
      continue;
    }
    if(!canEnterRow(row,sim,fallback)){
      reason='canEnterRow=false (위행3번칸/아래행2·3번칸 규칙)';
      events.push({num:String(n),slot:si,row,col,reason});
      sim[si]=n; col0streak=col===0?col0streak+1:0;
      continue;
    }
    if(col===0&&!canEnterCol0(row,sim)){
      reason='col0 인접행 규칙 위반 (5R·6R만 적용)';
      events.push({num:String(n),slot:si,row,col,reason});
      sim[si]=n; col0streak=col0streak+1;
      continue;
    }
    if(col===0&&col0streak>=2){
      reason='연속 1번칸 3대 금지';
      events.push({num:String(n),slot:si,row,col,reason});
      sim[si]=n; col0streak=col0streak+1;
      continue;
    }
    sim[si]=n;
    col0streak=col===0?col0streak+1:0;
  }
  return { count: events.length, events };
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

/**
 * 내일 출차 순서 제약(1번칸 기준):
 * - 5R/6R 1번(col0)이 4R 1번보다 먼저 출차해야 함
 * - 4R 1번이 3R 1번보다 먼저 출차해야 함
 * - 3R 1번이 2R 1번보다 먼저 출차해야 함
 * 즉: 5R < 4R < 3R < 2R, 6R < 4R < 3R < 2R (tmrRank가 낮을수록 먼저 출차)
 *
 * 예외: 2R 1번 차량이 오늘·내일 모두 휴차(bothDayRest)이면 2R/3R/4R 체인은 비적용
 * @param {Object} values - 슬롯별 차번
 * @param {Object} tmrRank - 내일 출차 순번(낮을수록 먼저 출차)
 * @param {Set|Object} bothDayRest - 오늘·내일 모두 휴차인 차번 집합
 */
function violates2r3r1ExitOrder(values,tmrRank,bothDayRest){
  const v2=values[0], v3=values[3], v4=values[6], v5=values[9], v6=values[12];
  if(!v2) return false;
  const inBoth=(n)=>{
    if(!n) return false;
    if(bothDayRest instanceof Set) return bothDayRest.has(n);
    return !!(bothDayRest&&bothDayRest[n]);
  };
  if(inBoth(v2)) return false;
  if(!v3) return true;
  if(!v4) return true;
  const r2=tmrRank[v2]??9999, r3=tmrRank[v3]??9999, r4=tmrRank[v4]??9999;
  if(r3>=r2) return true; // 3R이 2R보다 먼저 나가야 함
  if(r4>=r3) return true; // 4R이 3R보다 먼저 나가야 함
  // 5R/6R은 4R보다 먼저(있을 때만)
  if(v5){
    const r5=tmrRank[v5]??9999;
    if(r5>=r4) return true;
  }
  if(v6){
    const r6=tmrRank[v6]??9999;
    if(r6>=r4) return true;
  }
  return false;
}

/* ══════════════════════════════════════════════════════════════
   § 4. 휴차 배치 후보 생성
   ─ 사용 행: 2R(r0), 7R(r5), 3R(r1), 6R(r4) 만 (4·5R는 운행차 전용)
   [제약] (기존과 동일 — 사용자 나열 패턴과 일치시키기 위해 명시 생성)
   · 최대 3개 행에만 휴차 분산 (네 행 동시 사용 불가)
   · 3R 사용 시 2R에 반드시 휴차, 3R 대수 ≤ 2R 대수
   · 6R 사용 시 7R에 반드시 휴차, 6R 대수 ≤ 7R 대수
   · 행당 최대 3칸 → 각 (n2,n3,n6,n7)은 0~3, 합 = 휴차 대수
   · 한 행 안에서는 1번칸(안쪽)부터 연속으로만 배치 — 빈 휴 휴·휴 빈 휴·(단독)2·3번칸 등 불가
   · 후보 생성 후 isValidRestActivePrefix 로 한 번 더 걸러 overflow 등으로 생긴 구멍 배치 제거
   순열: 오늘·내일 휴 / 오늘 휴·내일 출차 번호를 구분해 시드 순서 후 전 순열(상한)
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
 * 휴차(active)만 있는 행에서: 1번칸부터 안쪽으로만 연속이어야 함.
 * 빈 휴 휴·휴 빈 휴·빈 빈 휴·빈 휴 빈 등 구멍 난 휴차 배치 제거용.
 */
function isValidRestActivePrefix(active, RC){
  for(let r=0;r<RC;r++){
    let k=0;
    if(active[r*3+0]) k++;
    if(active[r*3+1]) k++;
    if(active[r*3+2]) k++;
    if(k===0) continue;
    if(!active[r*3+0]) return false;
    if(k>=2&&!active[r*3+1]) return false;
    if(k===3&&!active[r*3+2]) return false;
  }
  return true;
}

/** 구조(행·칸) 하나당 시도할 휴차 번호 순열 상한 — n!이 이보다 작으면 전부 생성 */
const REST_PERM_CAP_PER_PLAN=400000;

function factorialMin(a,b){
  let x=1;
  for(let i=2;i<=a;i++){
    x*=i;
    if(x>=b) return b;
  }
  return x;
}

/**
 * 한 행에 휴차 k대: 반드시 col 0부터 연속 (k=1→[0], k=2→[0,1], k=3→[0,1,2]).
 * rowR는 호환용(미사용). 구멍 난 배치(빈 휴 휴, 휴 빈 휴, 빈 빈 휴 등) 제외.
 */
function slotCombosForRestRow(rowR,k){
  if(k<=0) return [];
  if(k===3) return [[0,1,2]];
  if(k===2) return [[0,1]];
  if(k===1) return [[0]];
  return [];
}

/**
 * 휴차 대수 cnt에 대해 (n2,n3,n6,n7) 유효 조합 — 사용자 예시 1~3대·4대 이상 모두 포괄
 */
function validRestRowCounts(cnt){
  const out=[];
  for(let n2=0;n2<=3;n2++)
    for(let n3=0;n3<=3;n3++)
      for(let n6=0;n6<=3;n6++){
        const n7=cnt-n2-n3-n6;
        if(n7<0||n7>3) continue;
        if(n2+n3+n6+n7!==cnt) continue;
        const rowsUsed=(n2>0)+(n3>0)+(n6>0)+(n7>0);
        if(rowsUsed>3) continue;
        if(n3>0&&n2===0) continue;
        if(n6>0&&n7===0) continue;
        if(n3>n2) continue;
        if(n6>n7) continue;
        out.push([n2,n3,n6,n7]);
      }
  return out;
}

/**
 * 휴차 대수별 선호 행 분배 (2R=n2, 3R=n3, 6R=n6, 7R=n7) — validRestRowCounts 와 교집합만 사용
 * 1~3대: 2R만 또는 7R만 / 4~6대: 2R+7R만 / 7대: 2R+3R+7R 또는 2R+6R+7R 패턴만
 */
function getPreferredRestTuples(cnt){
  if(cnt<=0||cnt>7) return [];
  const valid=validRestRowCounts(cnt);
  const ok=t=>valid.some(u=>u[0]===t[0]&&u[1]===t[1]&&u[2]===t[2]&&u[3]===t[3]);
  /** @type{number[][]} */
  let raw=[];
  if(cnt===1) raw=[[1,0,0,0],[0,0,0,1]];
  else if(cnt===2) raw=[[2,0,0,0],[0,0,0,2]];
  else if(cnt===3) raw=[[3,0,0,0],[0,0,0,3]];
  else if(cnt===4) raw=[[3,0,0,1],[2,0,0,2],[1,0,0,3]];
  else if(cnt===5) raw=[[3,0,0,2],[2,0,0,3]];
  else if(cnt===6) raw=[[3,0,0,3]];
  else if(cnt===7){
    raw=[
      [3,1,0,3],[2,2,0,3],[3,2,0,2],[3,3,0,1],
      [1,0,3,3],[2,0,2,3],[3,0,1,3],[3,0,2,2],
    ];
  }
  return raw.filter(ok);
}

/** rowPlan 조각: ROW_DEFS 순서와 동일하게 2R→7R→3R→6R */
function rowPlansForDistribution(n2,n3,n6,n7){
  const parts=[];
  if(n2>0) parts.push({r:0,opts:slotCombosForRestRow(0,n2)});
  if(n7>0) parts.push({r:5,opts:slotCombosForRestRow(5,n7)});
  if(n3>0) parts.push({r:1,opts:slotCombosForRestRow(1,n3)});
  if(n6>0) parts.push({r:4,opts:slotCombosForRestRow(4,n6)});
  if(!parts.length) return [[]];
  function rec(i,plan){
    if(i===parts.length) return [plan.slice()];
    const{r,opts}=parts[i];
    const acc=[];
    for(const slots of opts) acc.push(...rec(i+1,[...plan,{r,slots}]));
    return acc;
  }
  return rec(0,[]);
}

/**
 * 휴차 차량 배치 순열: 내일 휴차 여부(tomorrowMissing)로 버킷 나누어 시드 후,
 * 전 순열(최대 REST_PERM_CAP_PER_PLAN). visit마다 JSON 키 중복 호출 방지는 호출측에서.
 */
function forEachPermutedRestOrder(restVehicles,tmrRank,tomorrowMissing,visit){
  const n=restVehicles.length;
  if(n===0){visit([]);return;}
  const tm=new Set(tomorrowMissing||[]);
  const both=[],run=[];
  for(const x of restVehicles){
    if(tm.has(x)) both.push(x);
    else run.push(x);
  }
  const desc=(a,b)=>(tmrRank[b]??9999)-(tmrRank[a]??9999);
  const asc=(a,b)=>(tmrRank[a]??9999)-(tmrRank[b]??9999);
  both.sort(desc); run.sort(desc);
  const seedSeen=new Set();
  function seed(perm){
    const k=JSON.stringify(perm);
    if(seedSeen.has(k)) return;
    seedSeen.add(k);
    visit(perm);
  }
  seed([...both,...run]);
  seed([...run,...both]);
  seed([...both].sort(asc).concat([...run].sort(asc)));
  seed([...run].sort(asc).concat([...both].sort(asc)));

  const maxPerm=factorialMin(n,REST_PERM_CAP_PER_PLAN);
  const a=restVehicles.slice();
  let emitted=0;
  function gen(depth){
    if(emitted>=maxPerm) return;
    if(depth===n){
      visit(a.slice());
      emitted++;
      return;
    }
    for(let i=depth;i<n&&emitted<maxPerm;i++){
      [a[depth],a[i]]=[a[i],a[depth]];
      gen(depth+1);
      [a[depth],a[i]]=[a[i],a[depth]];
    }
  }
  gen(0);
}

/**
 * 휴차 배치 후보: validRestRowCounts 로 (n2,n3,n6,n7) 전개 → rowPlansForDistribution 으로 칸 조합 → 순열.
 * tomorrowMissing: 오늘·내일 모두 휴차(내일 배차 없음) 번호 — 순열 시드에 반영. 내일 출차 순서는 tmrRank.
 * @param {number[][]|null} [tupleFilter] — 허용 (n2,n3,n6,n7) 만; 빈 배열이면 후보 없음
 */
function generateRestCandidates(restVehicles,tmrRank,RC,tomorrowMissing,fastExitRankBanMax=3,tupleFilter=null){
  if(!restVehicles.length){
    const values={},active={};
    for(let i=0;i<RC*3;i++){values[i]='';active[i]=false;}
    return [{values,active}];
  }
  const sorted=[...restVehicles].sort((a,b)=>(tmrRank[b]??9999)-(tmrRank[a]??9999));
  const cnt=restVehicles.length;
  const tmrMiss=(tomorrowMissing||[]).map(x=>(typeof x==='object'?x?.num:x));
  const fastBanMax=fastExitRankBanMax??0;

  let tupleList;
  if(tupleFilter!==null&&tupleFilter!==undefined){
    if(!tupleFilter.length) return [];
    const validSet=new Set(validRestRowCounts(cnt).map(t=>JSON.stringify(t)));
    tupleList=tupleFilter.filter(t=>validSet.has(JSON.stringify(t)));
    if(!tupleList.length) return [];
  } else {
    tupleList=validRestRowCounts(cnt);
  }

  const candidates=new Map();

  for(const[n2,n3,n6,n7]of tupleList){
    for(const plan of rowPlansForDistribution(n2,n3,n6,n7)){
      forEachPermutedRestOrder(restVehicles,tmrRank,tmrMiss,(perm)=>{
        const state=buildRestState(perm, plan, RC, tmrRank);
        if(!isValidRestActivePrefix(state.active, RC)) return;
        // 내일 빠른 순번(1~3, tmrRank < 3)은 2R~3R에 휴차 배치 금지
        if(fastBanMax>0){
          for(let r=0;r<=1;r++){
            for(let col=0;col<3;col++){
              const v=state.values[slotIndex(r,col)];
              if(!v) continue;
              if((tmrRank[v]??9999) < fastBanMax) return;
            }
          }
        }
        const key=JSON.stringify(state.values);
        if(!candidates.has(key)) candidates.set(key,state);
      });
    }
  }

  // overflow fallback — 슬롯 0번부터 순서대로만 채워 행별 휴차 접두사 보장
  if(candidates.size===0){
    const fallback={values:{},active:{}};
    for(let i=0;i<RC*3;i++){fallback.values[i]='';fallback.active[i]=false;}
    // prefix 유지: 각 행은 col0부터 연속으로만 채움
    // fast ban 유지: 2R~3R에는 tmrRank(내일순번) 0~2 차량을 넣지 않음
    const rowFilled=Array(RC).fill(0); // 각 행의 현재 채워진 칸 개수(0~3)
    for(let vi=0;vi<sorted.length;vi++){
      const v=sorted[vi];
      const rank=tmrRank[v]??9999;
      let placed=false;
      for(let si=0;si<RC*3;si++){
        const row=Math.floor(si/3), col=si%3;
        if(col!==rowFilled[row]) continue; // 접두사 다음 칸만 허용
        if(row<=1 && fastBanMax>0 && rank < fastBanMax) continue; // 2R~3R 금지
        fallback.values[si]=v;
        fallback.active[si]=true;
        rowFilled[row]++;
        placed=true;
        break;
      }
      if(!placed) break;
    }
    return [fallback];
  }

  // ── 우선순위 정렬 ──
  function rowUsed(v,r){return [0,1,2].some(c=>v[r*3+c]);}
  function rowCount(v,r){return [0,1,2].filter(c=>v[r*3+c]).length;}

  function groupKey(v){
    const u2=rowUsed(v,0),u7=rowUsed(v,5),u3=rowUsed(v,1),u6=rowUsed(v,4);
    const nRows=(u2?1:0)+(u7?1:0)+(u3?1:0)+(u6?1:0);

    if(!u3&&!u6){
      if(!u2&&u7) return 0;   // 7R만
      if(u2&&!u7) return 1;   // 2R만
      if(u2&&u7)  return 2;   // 2R + 7R
    }
    if(u2&&u3&&!u6&&u7) return 3;
    if(u2&&u3&&!u6&&!u7) return 4;
    if(u2&&!u3&&u6&&u7) return 5;
    if(!u2&&u7&&u6&&!u3) return 6;
    return 10+nRows;
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
