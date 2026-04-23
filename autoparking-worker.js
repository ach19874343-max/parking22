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
function cer(ri,v,RC,fallback){
  if(ri===0) return true;
  // 3R(ri=1): 위행(2R) 3번칸이 비면 OK, 또는 아래행(4R) 3번칸이 비면 OK(2번칸은 차 있어도 됨)
  if(ri===1){
    if(!v[(ri-1)*3+2]) return true;
    if(RC!==undefined&&ri<RC-1&&!v[(ri+1)*3+2]) return true;
    return false;
  }
  if(!v[(ri-1)*3+2]) return true;
  // 위 행 3번칸 차 있어도 아래 행 2·3번칸 모두 비어있으면 진입 가능
  if(RC!==undefined&&ri<RC-1){
    if(fallback){
      // 더 관대: 아래 행 3번칸만 비어도 허용 (아래행 2번칸은 차 있어도 됨)
      if(!v[(ri+1)*3+2]) return true;
    } else {
      if(!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
    }
  }
  return false;
}
function fec(ri,v){if(v[ri*3+2])return -1;for(let c=0;c<3;c++)if(!v[ri*3+c])return c;return -1;}
function cExit(V,T,RC){let s=0;for(let r=0;r<RC;r++)for(let c=1;c<3;c++){const v=V[r*3+c];if(!v)continue;const m=T[v]??9999;for(let lc=0;lc<c;lc++){const lv=V[r*3+lc];if(lv&&(T[lv]??9999)>m)s++;}}return s;}
function cEntry(V,O,B,RC,fallback){
  const s={};for(let i=0;i<RC*3;i++)s[i]=(B&&B[i])||'';
  let n=0,col0streak=0; // col0streak: 연속 1번칸 입차 카운트
  for(const x of O){
    let si=-1;for(let i=0;i<RC*3;i++)if(V[i]===x){si=i;break;}
    if(si<0)continue;
    const row=Math.floor(si/3),col=si%3;
    // 행은 반드시 1→2→3 순서(prefix)로만 채워질 수 있음 (점프 배치 금지)
    const first = fec(row,s);
    if(first!==col){n++;s[si]=x;col0streak=col===0?col0streak+1:0;continue;}
    if(!cer(row,s,RC,fallback)){n++;s[si]=x;col0streak=col===0?col0streak+1:0;continue;}
    if(col===0&&!canCol0(row,s,RC)){n++;s[si]=x;col0streak=col0streak+1;continue;}
    // 연속 1번칸 3대 금지
    if(col===0&&col0streak>=2){n++;s[si]=x;col0streak=col0streak+1;continue;}
    s[si]=x;
    col0streak=col===0?col0streak+1:0;
  }
  return n;
}
function cSlots(ar,w,RC,fallback){let c=0;for(const r of ar){if(!cer(r,w,RC,fallback))continue;for(let col=0;col<3;col++)if(!w[r*3+col])c++;}return c;}
function sLost3(row,ar,w,RC,fallback){let l=0;const t={...w,[row*3+2]:'X'};for(const r of ar){if(r<=row)continue;if(cer(r,w,RC,fallback)&&!cer(r,t,RC,fallback))for(let c=0;c<3;c++)if(!w[r*3+c])l++;}return l;}

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
// 적용: 5R(idx=3), 6R(idx=4)만 — 2R·3R·4R 예외
// 7R은 이 규칙 적용 안 함(휴차행)
// 위 행(row-1) 1번칸 또는 아래 행(row+1) 1번칸 중 하나에 차(운행·휴차 모두) 있어야 함
function canCol0(row,w,RC){
  if(row<=2) return true;          // 2R(0)·3R(1)·4R(2) 예외
  if(row>=RC-1) return true;       // 7R(마지막행) — 이 규칙 대상 아님(휴차행)
  const upHas   = w[(row-1)*3+0]; // 위 행 1번칸 (운행차·휴차 모두 포함)
  const downHas = w[(row+1)*3+0]; // 아래 행 1번칸 (운행차·휴차 모두 포함)
  return !!(upHas||downHas);
}

// 내일 출차 사슬 제약(1번칸 체인)
// chainVer=2: 5R<4R<3R<2R AND 6R<4R<3R<2R
// chainVer=1: 4R<3R<2R (이전 규칙)
// (2R 1번에 해당 차량이 오늘·내일 휴차(br)이면 비적용 — 기존 의미 유지)
function r23Viol(w,tr,br,enf,chainVer,allowMissing4R){
  if(!enf)return false;
  const ver = chainVer||2;
  const v2=w[0], v3=w[3], v4=w[6], v5=w[9], v6=w[12];
  if(!v2) return false;
  if(br[v2]) return false;
  if(!v3) return true;
  const r2=tr[v2]??9999, r3=tr[v3]??9999, r4=tr[v4]??9999;
  if(r3>=r2) return true; // 3R이 2R보다 먼저 나가야 함
  if(!v4){
    // 옵션: 4R 1번칸 비어있으면 체인 완화(4R 관련 비교는 무시)
    return allowMissing4R ? false : true;
  }
  if(r4>=r3) return true; // 4R이 3R보다 먼저 나가야 함
  if(ver>=2){
    if(v5){
      const r5=tr[v5]??9999;
      if(r5>=r4) return true;
    }
    if(v6){
      const r6=tr[v6]??9999;
      if(r6>=r4) return true;
    }
  }
  return false;
}
function r23SlotOk(row,col,num,w,tr,br,enf,chainVer,allowMissing4R){
  if(!enf)return true;
  const ver = chainVer||2;
  // 2R col0를 채울 때: (v3 rank < v2 rank) 유지
  if(row===0&&col===0&&!br[num]){
    const v3=w[3];
    if(v3&&(tr[v3]??9999)>=(tr[num]??9999))return false;
  }
  // 3R col0를 채울 때: (v4 rank < v3 rank) + (v3 rank < v2 rank)
  if(row===1&&col===0){
    const v2=w[0];
    if(v2&&!br[v2]&&(tr[num]??9999)>=(tr[v2]??9999))return false;
    const v4=w[6];
    if(v4){
      if((tr[v4]??9999)>=(tr[num]??9999))return false;
    } else if(!allowMissing4R){
      return false;
    }
  }
  // 4R col0를 채울 때: (v4 rank < v3 rank) + (ver=2면 v5/v6 rank < v4 rank)
  if(row===2&&col===0){
    const v3=w[3];
    if(v3&&(tr[num]??9999)>=(tr[v3]??9999))return false;
    if(ver>=2){
      const v5=w[9];
      if(v5&&(tr[v5]??9999)>=(tr[num]??9999))return false;
      const v6=w[12];
      if(v6&&(tr[v6]??9999)>=(tr[num]??9999))return false;
    }
  }
  if(ver>=2){
    // 5R col0를 채울 때: (v5 rank < v4 rank)
    if(row===3&&col===0){
      const v4=w[6];
      if(v4){
        if((tr[num]??9999)>=(tr[v4]??9999))return false;
      } else if(!allowMissing4R){
        return false;
      }
    }
    // 6R col0를 채울 때: (v6 rank < v4 rank)
    if(row===4&&col===0){
      const v4=w[6];
      if(v4){
        if((tr[num]??9999)>=(tr[v4]??9999))return false;
      } else if(!allowMissing4R){
        return false;
      }
    }
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
function sortOptsBias(opts,num,tr,biasMid,earlyMax,hintSi,learnPref){
  const hRow = (hintSi===0||hintSi) ? Math.floor(hintSi/3) : null;
  const hCol = (hintSi===0||hintSi) ? (hintSi%3) : null;
  const hPri = (o)=> (hRow===null ? 1 : ((o.row===hRow && o.col===hCol) ? 0 : 1));
  const lp = learnPref || null;
  const lRow = (lp && (lp.row===0 || lp.row)) ? lp.row : null;
  const lCol = (lp && (lp.col===0 || lp.col)) ? lp.col : null;
  const lDist = (o) => {
    if (lRow === null || lCol === null) return 0;
    return Math.abs(o.row - lRow) * 2 + Math.abs(o.col - lCol);
  };

  if(!biasMid||(tr[num]??9999)>=earlyMax){
    opts.sort((a,b)=>
      hPri(a)-hPri(b) ||
      lDist(a)-lDist(b) ||
      a.pen-b.pen ||
      (a.lost||0)-(b.lost||0) ||
      (b.fallbackPrio?1:0)-(a.fallbackPrio?1:0)
    );
    return;
  }
  const mid=r=>r>=2&&r<=4;
  opts.sort((a,b)=>{
    const hp=hPri(a)-hPri(b);
    if(hp!==0) return hp;
    const ld = lDist(a)-lDist(b);
    if(ld!==0) return ld;
    const am=mid(a.row)?0:1,bm=mid(b.row)?0:1;
    if(am!==bm) return am-bm;
    if(a.col!==b.col) return a.col-b.col;
    if(a.pen!==b.pen) return a.pen-b.pen;
    const al=(a.lost||0),bl=(b.lost||0);
    if(al!==bl) return al-bl;
    return(b.fallbackPrio?1:0)-(a.fallbackPrio?1:0);
  });
}
function gOpts(num,idx,eo,ar,w,tr,fallback,RC,col0streak,enf,br,biasMid,earlyMax,fastExitRankBanMax,hintSlotsByIdx,learnGroupPref,chainVer,allowMissing4R,rej){
  const mR=tr[num]??9999,rem=eo.length-idx-1,cur=cSlots(ar,w,RC,fallback),opts=[];
  for(const row of iterRowsBias(ar,num,tr,biasMid,earlyMax)){
    // 내일 빠른 순번(1~3, tmrRank < 3)은 2R~3R(0~1행)에 배치 금지
    if(fastExitRankBanMax>0 && row<=1 && mR<fastExitRankBanMax){ if(rej) rej.fastBan=(rej.fastBan||0)+1; continue; }
    if(!cer(row,w,RC,fallback)){ if(rej) rej.cer=(rej.cer||0)+1; continue; }const col=fec(row,w);if(col<0){ if(rej) rej.fec=(rej.fec||0)+1; continue; }
    // 행은 반드시 1→2→3 순서(prefix)로만 채워진다.
    // (fec가 "첫 빈칸"이므로, 이 옵션은 항상 prefix를 만족하지만 안전망으로 한 번 더 체크)
    if(col>0 && !w[row*3+(col-1)]){ if(rej) rej.prefix=(rej.prefix||0)+1; continue; }
    let lost=0;
    if(col===2){
      lost=sLost3(row,ar,w,RC,fallback);
      if(cur-1-lost<rem){ if(rej) rej.col2Lost=(rej.col2Lost||0)+1; continue; }
    }
    // ── 1번칸 인접행 규칙: 4R·5R·6R에서 col=0이면 위아래 1번칸 확인 ──
    if(col===0&&!canCol0(row,w,RC)){ if(rej) rej.canCol0=(rej.canCol0||0)+1; continue; }
    // ── 연속 1번칸 3대 금지 ──
    if(col===0&&(col0streak||0)>=2){ if(rej) rej.col0Streak=(rej.col0Streak||0)+1; continue; }
    if(!r23SlotOk(row,col,num,w,tr,br,enf,chainVer,allowMissing4R)){ if(rej) rej.r23Slot=(rej.r23Slot||0)+1; continue; }
    let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}
    opts.push({row,col,pen,lost});
  }
  if(!opts.length){
    for(const row of iterRowsBias(ar,num,tr,biasMid,earlyMax)){
      if(!cer(row,w,RC,fallback)){ if(rej) rej.cer2=(rej.cer2||0)+1; continue; }const col=fec(row,w);if(col<0){ if(rej) rej.fec2=(rej.fec2||0)+1; continue; }
      if(col>0 && !w[row*3+(col-1)]){ if(rej) rej.prefix2=(rej.prefix2||0)+1; continue; }
      if(!r23SlotOk(row,col,num,w,tr,br,enf,chainVer,allowMissing4R)){ if(rej) rej.r23Slot2=(rej.r23Slot2||0)+1; continue; }
      let pen=0;for(let lc=0;lc<col;lc++){const lv=w[row*3+lc];if(lv&&(tr[lv]??9999)>mR)pen++;}
      const lost=(col===2)?sLost3(row,ar,w,RC,fallback):0;
      opts.push({row,col,pen,lost});
    }
    if(rej&&!opts.length) rej.noOpts=(rej.noOpts||0)+1;
  }
  const hintI = (typeof hintIdxByPos!=='undefined' && hintIdxByPos && hintIdxByPos.length) ? hintIdxByPos[idx] : idx;
  const hintSi = hintSlotsByIdx ? hintSlotsByIdx[hintI] : null;
  const g = (eo && eo.length) ? (hintI / eo.length) : 0;
  const gi = g < 1/3 ? 0 : g < 2/3 ? 1 : 2;
  const learnPref = (learnGroupPref && learnGroupPref[gi]) ? learnGroupPref[gi] : null;
  sortOptsBias(opts,num,tr,biasMid,earlyMax,hintSi,learnPref);
  return opts;
}
self.onmessage=function(e){
  const{eo,tr,bv,ba,ar,RC,maxMs=30000,fallback=false,enforce2r3r1=false,exitChainVer=2,exitChainAllowMissing4R=false,bothRest=[],biasMiddleEarly=false,earlyExitRankMax=999,fastExitRankBanMax=3,hintSlotsByIdx=[],learnGroupPref=null,perfectOnly=false,livePreview=false,livePreviewIntervalMs=200}=e.data;
  // perfectOnly MRV 가 eo 를 swap 하므로, 입차 시뮬(cEntry)은 항상 "불러온 순서" 복사본으로만 계산
  const entryOrderCanonical=eo.slice();
  // gOpts 내부에서 "원래 entryOrder 인덱스" 기반 힌트를 쓰기 위한 매핑(탐색 중 swap됨)
  var hintIdxByPos = Array.from({length: eo.length}, (_,i)=>i);
  const br={};
  for(let i=0;i<bothRest.length;i++) br[bothRest[i]]=1;
  // RC 캡처한 cer 재정의 — 아래행 2·3번칸 비면 진입 가능 규칙 포함
  function cer(ri,v){
    if(ri===0) return true;
    // 3R(ri=1): 위행(2R) 3번칸이 비면 OK, 또는 아래행(4R) 3번칸이 비면 OK(2번칸은 차 있어도 됨)
    if(ri===1){
      if(!v[(ri-1)*3+2]) return true;
      if(ri<RC-1&&!v[(ri+1)*3+2]) return true;
      return false;
    }
    if(!v[(ri-1)*3+2]) return true;
    if(ri<RC-1){
      if(fallback){
        if(!v[(ri+1)*3+2]) return true;
      } else {
        if(!v[(ri+1)*3+1]&&!v[(ri+1)*3+2]) return true;
      }
    }
    return false;
  }
  const t0=Date.now();
  let nodes=0;
  let timedOut=false;
  const rej={};
  let lastLiveMs=0;
  function emitLive(label, values){
    if(!livePreview) return;
    const now=Date.now();
    const iv = (livePreviewIntervalMs===0 || livePreviewIntervalMs) ? livePreviewIntervalMs : 200;
    if(now-lastLiveMs<iv) return;
    lastLiveMs=now;
    try{
      self.postMessage({ live:{ label, values:{...values}, active:{...ba}, nodes } });
    }catch{}
  }
  function score(es,en){return en*1000+es;}
  function isPerfect(es,en,w){
    if(es!==0||en!==0)return false;
    // perfect은 "모든 입차 대상(eo)이 실제로 배치된 상태"에서만 인정
    // (DFS에서 옵션이 없어 스킵되는 경우가 있어, 그때는 값이 일부만 채워져도 막힘 점수만 0이 될 수 있음)
    const placed=new Set();
    for(let i=0;i<RC*3;i++) if(w[i]) placed.add(String(w[i]));
    for(const n of entryOrderCanonical) if(!placed.has(String(n))) return false;
    if(enforce2r3r1&&r23Viol(w,tr,br,true,exitChainVer,exitChainAllowMissing4R))return false;
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
  // (1) Seed: 학습 hint 슬롯에 "가능한 것부터" 먼저 배치 시도
  // - 규칙(접두사/진입/col0 제약/연속 col0 제한)을 만족하는 경우에만 선배치
  const _seedPlaced = {};
  if(hintSlotsByIdx && hintSlotsByIdx.length){
    for(let i=0;i<eo.length;i++){
      const si = hintSlotsByIdx[i];
      if(!(si===0||si)) continue;
      if(gw[si]) continue;             // 이미 차가 있음
      if(ba && ba[si]) continue;       // 휴차(active) 슬롯엔 배치 금지
      const row=Math.floor(si/3), col=si%3;
      if(!cer(row,gw)) continue;
      const first=fec(row,gw);
      if(first<0 || col!==first) continue; // prefix 위반 방지
      if(col===0 && !canCol0(row,gw,RC)) continue;
      if(col===0 && gStreak>=2) continue;
      if(!r23SlotOk(row,col,eo[i],gw,tr,br,enforce2r3r1,exitChainVer,exitChainAllowMissing4R)) continue;
      gw[si]=eo[i];
      _seedPlaced[i]=1;
      gStreak = (col===0) ? (gStreak+1) : 0;
    }
  }
  for(let i=0;i<eo.length;i++){
    // seed에서 이미 배치된 차량은 건너뜀
    if(_seedPlaced[i]) continue;
    const o=gOpts(eo[i],i,eo,ar,gw,tr,fallback,RC,gStreak,enforce2r3r1,br,biasMiddleEarly,earlyExitRankMax,fastExitRankBanMax,hintSlotsByIdx,learnGroupPref,exitChainVer,exitChainAllowMissing4R,rej);if(!o.length)continue;
    const chosen=o[0];
    gw[chosen.row*3+chosen.col]=eo[i];
    gStreak=chosen.col===0?gStreak+1:0;
    emitLive('그리디', gw);
  }
  const ges=cExit(gw,tr,RC),gen=cEntry(gw,entryOrderCanonical,bv,RC,fallback),gs=score(ges,gen);
  if(gs<gBestScore&&!r23Viol(gw,tr,br,enforce2r3r1,exitChainVer,exitChainAllowMissing4R)){gBestScore=gs;gBest={values:{...gw},active:{...ba},exitScore:ges,entryScore:gen,total:gs};}
  addPerfect(gw,ges,gen);
  if(gBest) emitLive('현재최고', gBest.values);
  // DFS
  const work={...bv};
  function lbEntry(idx){
    // Lower bound of additional entry blocks from current partial state.
    // Optimistic assumptions:
    // - ignore col0 streak for future placements (use 0)
    // - use current accessibility only (it never improves as we place more cars)
    const rem = eo.length - idx;
    if(rem<=0) return 0;
    const curSlots = cSlots(ar, work, RC, fallback);
    let lb = Math.max(0, rem - curSlots);
    // If some remaining car has no feasible option even now, it will never become feasible later.
    // (placing cars only reduces free slots / accessibility)
    for(let j=idx;j<eo.length;j++){
      const o = gOpts(eo[j], j, eo, ar, work, tr, fallback, RC, 0, enforce2r3r1, br, biasMiddleEarly, earlyExitRankMax, fastExitRankBanMax, hintSlotsByIdx, learnGroupPref, exitChainVer, exitChainAllowMissing4R, null);
      if(!o.length) lb++;
      if(gBestScore<99999 && lb*1000 >= gBestScore) break;
    }
    return lb;
  }
  function dfs(idx,streak){
    nodes++;
    if(Date.now()-t0>maxMs){ timedOut=true; return; }
    if(perfects.length>=5) return;
    // 현재 탐색 상태 스냅샷(너무 자주 안 보냄)
    if((nodes & 1023)===0) emitLive('DFS', work);
    if(idx===eo.length){
      if(enforce2r3r1&&r23Viol(work,tr,br,true,exitChainVer,exitChainAllowMissing4R)) return;
      const es=cExit(work,tr,RC),en=cEntry(work,entryOrderCanonical,bv,RC,fallback),sc=score(es,en);
      if(sc<gBestScore){gBestScore=sc;gBest={values:{...work},active:{...ba},exitScore:es,entryScore:en,total:sc};}
      addPerfect(work,es,en);
      if(gBest) emitLive('현재최고', gBest.values);
      return;
    }
    const curEs=cExit(work,tr,RC);
    if(gBestScore<1000&&curEs>=gBestScore)return;
    if(gBestScore<99999){
      const lb = lbEntry(idx);
      if(lb*1000 + curEs >= gBestScore){
        rej.lbCut = (rej.lbCut||0) + 1;
        return;
      }
    }
    if(perfectOnly){
      const lb = lbEntry(idx);
      if(lb>0){
        rej.perfectLbCut = (rej.perfectLbCut||0) + 1;
        return;
      }
    }
    // perfectOnly 모드에서는 MRV(선택지 최소)로 다음 차량을 고른다.
    let pick = idx;
    if(perfectOnly){
      let bestLen = 1e9;
      let foundZero = false;
      for(let k=idx;k<eo.length;k++){
        const o = gOpts(eo[k],idx,eo,ar,work,tr,fallback,RC,streak,enforce2r3r1,br,biasMiddleEarly,earlyExitRankMax,fastExitRankBanMax,hintSlotsByIdx,learnGroupPref,exitChainVer,exitChainAllowMissing4R,null);
        const len = o.length;
        if(len===0){ pick=k; foundZero=true; break; }
        if(len<bestLen){ bestLen=len; pick=k; if(bestLen===1) break; }
      }
      if(foundZero){
        rej.perfectMrvZero = (rej.perfectMrvZero||0) + 1;
      }
      if(pick!==idx){
        const tmp=eo[idx]; eo[idx]=eo[pick]; eo[pick]=tmp;
        const ti=hintIdxByPos[idx]; hintIdxByPos[idx]=hintIdxByPos[pick]; hintIdxByPos[pick]=ti;
      }
    }

    const opts=gOpts(eo[idx],idx,eo,ar,work,tr,fallback,RC,streak,enforce2r3r1,br,biasMiddleEarly,earlyExitRankMax,fastExitRankBanMax,hintSlotsByIdx,learnGroupPref,exitChainVer,exitChainAllowMissing4R,rej);
    if(!opts.length){
      if(perfectOnly){
        rej.perfectNoOpts = (rej.perfectNoOpts||0) + 1;
        if(pick!==idx){
          const tmp=eo[idx]; eo[idx]=eo[pick]; eo[pick]=tmp;
          const ti=hintIdxByPos[idx]; hintIdxByPos[idx]=hintIdxByPos[pick]; hintIdxByPos[pick]=ti;
        }
        return;
      }
      dfs(idx+1,0);
      if(pick!==idx){
        const tmp=eo[idx]; eo[idx]=eo[pick]; eo[pick]=tmp;
        const ti=hintIdxByPos[idx]; hintIdxByPos[idx]=hintIdxByPos[pick]; hintIdxByPos[pick]=ti;
      }
      return;
    }
    for(const{row,col}of opts){
      if(Date.now()-t0>maxMs){ timedOut=true; return; }
      if(perfects.length>=5) return;
      work[row*3+col]=eo[idx];
      dfs(idx+1,col===0?streak+1:0);
      work[row*3+col]='';
    }
    if(pick!==idx){
      const tmp=eo[idx]; eo[idx]=eo[pick]; eo[pick]=tmp;
      const ti=hintIdxByPos[idx]; hintIdxByPos[idx]=hintIdxByPos[pick]; hintIdxByPos[pick]=ti;
    }
  }
  dfs(0,0);
  // 미배치 강제
  if(gBest){
    const placed=new Set(Object.values(gBest.values).filter(Boolean));
    const unp=entryOrderCanonical.filter(n=>!placed.has(n)).sort((a,b)=>(tr[a]??9999)-(tr[b]??9999));
    for(const num of unp){
      let bsi=-1,bp=99999;
      for(let si=0;si<RC*3;si++){
        if(gBest.values[si]||gBest.active[si])continue;
        const row=Math.floor(si/3),col=si%3;
        if(!cer(row,gBest.values))continue;
        const first=fec(row,gBest.values);
        if(first<0)continue;
        // 행은 항상 1→2→3 순서로만 채운다 (점프 배치 금지)
        if(col!==first) continue;
        let pen=0;for(let lc=0;lc<col;lc++){const lv=gBest.values[row*3+lc];if(lv&&(tr[lv]??9999)>(tr[num]??9999))pen++;}
        if(pen<bp){bp=pen;bsi=si;}
      }
      if(bsi<0){
        // 물리 규칙이 허용하는 "첫 빈칸"을 못 찾은 경우에만, 남은 첫 빈칸에 순서대로 채움
        for(let row=0;row<RC;row++){
          if(!cer(row,gBest.values)) continue;
          const first=fec(row,gBest.values);
          if(first<0) continue;
          const si=row*3+first;
          if(!gBest.values[si]&&!gBest.active[si]){ bsi=si; break; }
        }
      }
      if(bsi>=0)gBest.values[bsi]=num;
    }
    if(unp.length){
      const b2={};for(let i=0;i<RC*3;i++)b2[i]=gBest.active[i]?gBest.values[i]:'';
      gBest.exitScore=cExit(gBest.values,tr,RC);
      gBest.entryScore=cEntry(gBest.values,entryOrderCanonical,b2,RC,fallback);
      gBest.total=gBest.entryScore*1000+gBest.exitScore;
    }
  }
  if(gBest&&enforce2r3r1&&r23Viol(gBest.values,tr,br,true,exitChainVer,exitChainAllowMissing4R)) gBest=null;
  self.postMessage({best:gBest,perfects,elapsed:Date.now()-t0,stats:{nodes,timedOut,perfectCount:perfects.length,rej}});
};
`;

let _worker=null;
let _workerUrl=null;
function getWorker(opts){
  if(_worker){_worker.terminate();_worker=null;}
  const o = opts || {};
  const code = o.code || WORKER_CODE;
  _workerUrl=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
  _worker=new Worker(_workerUrl);
  return _worker;
}

/* ── 자동주차 후보 제외(세션) ───────────────────────────────── */
const _apBannedCandidateKeys = new Set(); // JSON.stringify(values)
function apBanAutoParkingCandidateByValues(values){
  try{
    if(!values) return;
    const k = JSON.stringify(values);
    _apBannedCandidateKeys.add(k);
  }catch{}
}
function apIsBannedAutoParkingCandidateByValues(values){
  try{
    if(!values) return false;
    const k = JSON.stringify(values);
    return _apBannedCandidateKeys.has(k);
  }catch{ return false; }
}
window.apBanAutoParkingCandidateByValues = apBanAutoParkingCandidateByValues;

/* ══════════════════════════════════════════════════════════════
   § 6. 메인 계산 — 휴차 후보별 순차 Worker 탐색
   ─ generateRestCandidates 로 후보 목록 생성
   ─ 후보마다 Worker 에 투입, 패스당 긴 시간 예산으로 best 갱신
   ─ 완벽(입0·출0)은 최대 5개까지 수집 후 종료 · 입0·출1(비완벽)이면 대안 페이지 최대 3개만
   ─ 1단계: 내일 출차 빠른 차(tmrRank 상위 ~1/3)는 4R·5R·6R 행 우선·같은 행은 1→2→3칸 순 정렬
     → 완벽해 없으면 2단계: 기존 pen 기준 탐색으로 전체 재시작(출차순 제약 ON→OFF 동일)
    ══════════════════════════════════════════════════════════════ */
/** 완료 시 callback, 탐색 중 진행은 onProgress({ candDone, candTotal, perfectCount, perfectMax, phase, pct }) */
function computeAutoParkingSingle(callback, onProgress, opts){
  if(typeof dispatchState==='undefined'||!dispatchState.loaded){
    alert('배차 데이터를 먼저 불러와주세요.\n(FAB → 불러오기)');
    return;
  }
  const AP_DEBUG = false;
  const oTop = opts || {};
  let cancelled = false;
  let cancelFinishFn = null;
  function cancelNow(){
    cancelled = true;
    if(_worker){_worker.terminate();_worker=null;}
    if (typeof cancelFinishFn === 'function') cancelFinishFn();
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
  /** 내일 1~3(=tmrRank 0~2)은 2R~3R(0~1행)에 배치 금지 */
  const fastExitRankBanMax=Math.min(3,tomorrowList.length);

  const todayRestSet=new Set(dispatchState.todayMissing||[]);
  /* 수동 휴차(그리드 노란색)도 휴차 후보에 포함 */
  try{
    const manual = (APP && typeof APP.getManualRestSetForCurrentDate==='function')
      ? APP.getManualRestSetForCurrentDate()
      : new Set();
    manual.forEach(n=>todayRestSet.add(String(n).trim()));
  }catch{}
  /* 정비소 제외 차량은 휴차 배치에서도 제외 */
  const dateStr=document.getElementById('datePicker')?.value||'';
  // 제외(취소선) 차량은 휴차 후보에서도 제외
  const exToday = dispatchState.excludedAbsentToday?.[dateStr] || new Set();
  const exTomorrow = dispatchState.excludedAbsentTomorrow?.[dateStr] || new Set();
  const exSet = new Set([...exToday, ...exTomorrow]);
  const restVehicles=[...todayRestSet].filter(n=>!exSet.has(n));
  const tomorrowRestSet=new Set(dispatchState.tomorrowMissing||[]);
  const bothRestList=[...todayRestSet].filter(n=>tomorrowRestSet.has(n));

  // 학습 힌트 로드(비동기) 후 탐색 시작
  (async ()=>{
    let finished = false;
    /** @type {any|null} */
    let learn = null;
    try {
      learn = await apLearnLoad(entryOrder, tmrRank);
    } catch(e) {
      learn = null;
      if (AP_DEBUG) console.warn('[AutoParking] 학습 힌트 로드 실패:', e?.message||e);
    }
    if (cancelled) return;

    // entryOrder 인덱스별 "우선 시도 slot" 힌트 만들기
    /** @type {(number|null)[]} */
    const hintSlotsByIdx = Array(entryOrder.length).fill(null);
    if (learn && learn.derivedHints && learn.derivedHints.runSlotByEntryIdx) {
      const map = learn.derivedHints.runSlotByEntryIdx || {};
      for (let i = 0; i < entryOrder.length; i++) {
        const si = map[i];
        hintSlotsByIdx[i] = (si === 0 || si) ? si : null;
      }
    } else if (learn && Array.isArray(learn.learnRunSlots) && learn.learnRunSlots.length) {
      const run = learn.learnRunSlots.filter(x => x && (x.slot===0 || x.slot) && (x.tmrRank===0 || x.tmrRank));
      for (let i = 0; i < entryOrder.length; i++) {
        const num = entryOrder[i];
        const rk = tmrRank[num] ?? 9999;
        // 같은 entryIdx 우선, 없으면 내일 출차순 유사(차이 최소)로 매칭
        let best = null;
        let bestScore = 1e9;
        for (const r of run) {
          const dEntry = (r.entryIdx === i) ? 0 : 1;
          const dRank = Math.abs((r.tmrRank ?? 9999) - rk);
          const s = dEntry * 10000 + dRank;
          if (s < bestScore) { bestScore = s; best = r; }
        }
        hintSlotsByIdx[i] = best ? best.slot : null;
      }
    }

    // 휴차 후보도 학습된 휴차 슬롯과 유사한 것을 먼저 탐색
    let learnedRestSlots = null;
    if (learn && learn.derivedHints && Array.isArray(learn.derivedHints.restSlotSet) && learn.derivedHints.restSlotSet.length) {
      learnedRestSlots = new Set(learn.derivedHints.restSlotSet.map(s => +s).filter(s => s === 0 || !!s));
    } else if (learn && Array.isArray(learn.learnRestSlots) && learn.learnRestSlots.length) {
      learnedRestSlots = new Set(learn.learnRestSlots.map(x => x.slot).filter(s => s===0 || s));
    }

    // 모든 휴차 배치 후보 생성
    const candidatesGenerated=generateRestCandidates(restVehicles,tmrRank,APP.rowCount,dispatchState.tomorrowMissing,fastExitRankBanMax);

    // 휴차 슬롯 매칭 수가 큰 후보를 먼저(동률이면 기존 restPrefScore로)
    function restMatchCount(c){
      if (!learnedRestSlots) return 0;
      const a=c.active||{};
      let m=0;
      learnedRestSlots.forEach(si=>{ if(a[si]) m++; });
      return m;
    }

    // (removed) debug-only rest distribution stats

    // 휴차 후보 사전 점수 정렬 (기존 로직 유지)
    const weightByTodayRest=Math.max(1,Math.min(6,Math.floor(restVehicles.length/3)+1));
    function restPrefScore(c){
      const base=calcExitBlocking(c.values,tmrRank); // 0부터 작은 후보부터 탐색
      let penalty=0;
      for(let r=0;r<4;r++){
        const rowMul=(r<=1)?3:1;
        for(let col=0;col<3;col++){
          const v=c.values[slotIndex(r,col)];
          if(!v) continue;
          const rk=tmrRank[v];
          if(rk===undefined) continue;
          const rankTerm=Math.max(0,6-rk);
          penalty += weightByTodayRest*rowMul*rankTerm;
        }
      }
      return base*10 + penalty;
    }

    const allCandidatesSorted=[...candidatesGenerated].sort((a,b)=>{
      const hm = restMatchCount(b) - restMatchCount(a);
      if (hm !== 0) return hm;
      return restPrefScore(a) - restPrefScore(b);
    });

    const PREFILTER_CAP=2500;
    let candidates=allCandidatesSorted;
    let candidatesPrefiltered=false;
    if(allCandidatesSorted.length>PREFILTER_CAP){
      candidates=allCandidatesSorted.slice(0,PREFILTER_CAP);
      candidatesPrefiltered=true;
      if (AP_DEBUG) console.log(`[AutoParking v12] 휴차 후보 사전필터: ${PREFILTER_CAP}/${allCandidatesSorted.length}만 먼저 탐색`);
    }

    // 아래는 기존 computeAutoParking 본문을 그대로 쓰되,
    // worker.postMessage에 hintSlotsByIdx만 추가하면 됨.

    /** 제약 ON 패스 / 제약 OFF 재탐색 각각 독립 예산(늦게 나와도 더 넓게 탐색) */
    const TOTAL_MS_PER_PASS=420000;
    const MAX_PERFECT_VARIANTS=10;
    /** 비완벽인데 입0·출1일 때 결과 페이지 수(2~3장 정도만 보이게 상한 3) */
    const MAX_NEAR_PERFECT_PAGES=3;
    /** 1단계: 내일 빠른 차 → 4R·5R·6R 우선. 완벽해 없으면 2단계로 기존 탐색만 */
    let middleRowBiasPhase=true;
    let biasMiddleEarly=(oTop.biasMiddleEarlyStart!==undefined?!!oTop.biasMiddleEarlyStart:true);
    if (AP_DEBUG) console.log(`[AutoParking v12] 시작 — 입차:${entryOrder.length}대, 휴차:${restVehicles.length}대, 후보:${candidates.length}개, 패스당~${Math.round(TOTAL_MS_PER_PASS/60000)}분 | 1단계:내일빠른차→4~6R우선(순번<${earlyExitRankMax})${learn?' | 학습힌트 적용':''}`);

    let t0global=Date.now();
    let globalBest=null;
    let globalBestScore=99999;
    const globalTop3=[];
    const globalPerfects=[];
    const globalPerfectKeys=new Set();
    let candIdx=0;
    let fallbackMode=false; // 폴백 모드 플래그
    /** true: 출차 체인 제약 적용 탐색 중 */
    let useExitOrderConstraint=(oTop.useExitOrderConstraintStart!==undefined?!!oTop.useExitOrderConstraintStart:true);
    /** 2: 새 체인(5/6<4<3<2), 1: 이전 체인(4<3<2) */
    let exitChainVer=(oTop.exitChainVerStart!==undefined?oTop.exitChainVerStart:2);

    function phaseLabel(){
      const rowBias=biasMiddleEarly?'4~6R우선':'기본탐색';
      const ex=useExitOrderConstraint?(`출차순제약(v${exitChainVer})`):'무제약';
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
        top: (globalPerfects.length ? globalPerfects.slice(0,8) : globalTop3.slice(0,8)),
      });
    }

    function runNext(){
      if (cancelled) return;
      emitProgress();
      if(candIdx>=candidates.length){
        if(!fallbackMode && globalBestScore>=1000){
          fallbackMode=true;
          candIdx=0;
          if (AP_DEBUG) console.log('[AutoParking v12] 폴백 모드 재탐색 시작 (아래행 3번칸 우선 배치)');
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

      const remaining=TOTAL_MS_PER_PASS-(Date.now()-t0global);
      const leftCands=(fallbackMode?candidates.length-candIdx+1:candidates.length*2-candIdx+1);
      const perMs=Math.min(90000,Math.max(1500,Math.floor(remaining/Math.max(1,leftCands))));

      const worker=getWorker({ code: oTop.workerCode || WORKER_CODE });
      worker.onmessage=function(e){
        // live preview 메시지는 결과(best/perfects)와 별도로 들어올 수 있음
        if(e.data && e.data.live){
          try{
            const live = e.data.live;
            // 탐색 중 UI 업데이트
            if(typeof onProgress==='function'){
              onProgress({
                candDone: Math.min(candIdx, candidates.length||1),
                candTotal: (candidates.length||1),
                perfectCount: globalPerfects.length,
                perfectMax: 10,
                phase: phaseLabel(),
                pct: Math.min(100, Math.round((Math.min(candIdx, candidates.length||1)/(candidates.length||1))*100)),
                live: { values: live.values, active: live.active },
                liveLabel: live.label,
              });
            }
          }catch{}
          return;
        }

        let {best,perfects,elapsed:wMs}=e.data;
        // 제외된 후보는 결과 수집/갱신 대상에서 제외
        if(best && apIsBannedAutoParkingCandidateByValues(best.values)) best = null;

        if(perfects&&perfects.length){
          for(const p of perfects){
            if(apIsBannedAutoParkingCandidateByValues(p.values)) continue;
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
          if (AP_DEBUG) console.log(`[AutoParking v12]${biasMiddleEarly?' [4~6R우선]':''}${useExitOrderConstraint?'':' [무제약]'}${fallbackMode?' [폴백]':''} 후보${candIdx}/${candidates.length} ${wMs}ms — 입차막힘:${best.entryScore} 출차막힘:${best.exitScore}${best.entryScore===0&&best.exitScore===0?' ✅완벽':best.entryScore===0?' 🟡입차OK':''}`);
        }
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
        exitChainVer,
        exitChainAllowMissing4R: (APP?.settings?.exitChainAllowMissing4R === true),
        bothRest:bothRestList,
        biasMiddleEarly,
        earlyExitRankMax,
        fastExitRankBanMax,
        hintSlotsByIdx,
        learnGroupPref: (learn && learn.derivedHints && learn.derivedHints.runGroupPref) ? learn.derivedHints.runGroupPref : null,
        livePreview: true,
        // 모바일/저사양에서 렉 방지: live 프리뷰 갱신 간격을 더 길게
        livePreviewIntervalMs: (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) ? 320 : 200,
        // 완벽해(입0·출0) 최우선: 완벽해를 찾기 전까지는 "입차 막힘이 발생하는 가지"를 탐색에서 제외
        perfectOnly: (globalPerfects.length===0 && !fallbackMode)
      });
    }

    function finish(opts){
      if (finished) return;
      const o = opts || {};
      if (o.cancelled) finished = true;
      if(_worker){_worker.terminate();_worker=null;}
      const hasAnyPerfect=globalPerfects.length>0;
      if (o.cancelled) {
        let best = globalBest;
        let top3 = globalTop3.length ? globalTop3 : null;
        if (globalPerfects.length) {
          best = globalPerfects[0];
          top3 = globalPerfects.slice();
        }
        if (best) {
          const elapsed = Date.now() - t0global;
          best.elapsed = elapsed;
          if (top3) top3.forEach(r => { r.elapsed = elapsed; });
        }
        callback && callback(best || null, top3);
        return;
      }
      if(useExitOrderConstraint&&!hasAnyPerfect){
        // 새 체인(v2)에서 완벽이 없으면 → 이전 체인(v1)로 바꿔 전체 재탐색
        if(exitChainVer===2){
          if (AP_DEBUG) console.log('[AutoParking v12] 출차순 제약(v2)으로 완벽해(막힘0) 불가 → 이전 체인(v1)로 전체 재탐색');
          exitChainVer=1;
          if(candidatesPrefiltered){
            if (AP_DEBUG) console.log('[AutoParking v12] 휴차 후보 프리필터 해제 → 전체 후보로 확장');
            candidates=allCandidatesSorted;
            candidatesPrefiltered=false;
          }
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

        if (AP_DEBUG) console.log('[AutoParking v12] 출차순 제약(v1)으로도 완벽해 불가 → 후보·폴백·순열 전부 처음부터 무제약 재탐색 (새 패스)');
        useExitOrderConstraint=false;
        if(candidatesPrefiltered){
          if (AP_DEBUG) console.log('[AutoParking v12] 휴차 후보 프리필터 해제 → 전체 후보로 확장');
          candidates=allCandidatesSorted;
          candidatesPrefiltered=false;
        }
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
        if (AP_DEBUG) console.log('[AutoParking v12] 1단계(4~6R·내일빠른차 우선)에서 완벽해 없음 → 2단계: 기존 탐색 순서로 전체 재시작');
        middleRowBiasPhase=false;
        biasMiddleEarly=false;
        useExitOrderConstraint=true;
        exitChainVer=2;
        if(candidatesPrefiltered){
          if (AP_DEBUG) console.log('[AutoParking v12] 휴차 후보 프리필터 해제 → 전체 후보로 확장');
          candidates=allCandidatesSorted;
          candidatesPrefiltered=false;
        }
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
      if (AP_DEBUG) console.log(`[AutoParking v12] 완료 ${elapsed}ms — 최종 입차막힘:${globalBest.entryScore} 출차막힘:${globalBest.exitScore} 대안:${globalTop3.length}개${biasMiddleEarly?'':' (2단계·기본탐색)'}${useExitOrderConstraint?'':' (출차순 제약 미적용)'}`);
      callback&&callback(globalBest, globalTop3.length>=1?globalTop3:null);
      finished = true;
    }

    // 취소 시: 지금까지 찾은 best/perfect/top3로 즉시 결과를 반환
    cancelFinishFn = () => {
      if (finished) return;
      emitProgress();
      finish({ cancelled: true });
    };

    runNext();
  })().catch((e)=>{
    // 어떤 예외라도 overlay가 영원히 남지 않도록 종료 콜백 호출
    console.error('[AutoParking] 탐색 중 오류:', e);
    if(!cancelled) callback && callback(null, null);
  });

  return function cancelAutoParking(){
    cancelNow();
  };

}

// 단일 엔진 실행(롤백): 기존처럼 1회 탐색만 수행
function computeAutoParking(callback, onProgress){
  return computeAutoParkingSingle(callback, onProgress, null);
}

/* ══════════════════════════════════════════════════════════════
   § 자동주차 학습 데이터 (Firebase)
   - v1: learnData/ap_manual_v1 (차량번호 중심, 기존 유지)
   - v2: learnData/ap_orderpattern_v2 (entryIdx/tmrRank 패턴 중심, 우선 사용)
   ══════════════════════════════════════════════════════════════ */
const AP_LEARN_PATH_V1 = 'learnData/ap_manual_v1';
const AP_LEARN_PATH_V2 = 'learnData/ap_orderpattern_v2';
const AP_LEARN_MAX  = 60;

/* ── 사용자 조작 로그(세션) → 학습 힌트로 반영 ─────────────── */
const AP_EDITLOG_MAX = 200;
const _apEditLog = []; // { ts, dateStr, entryIdx, slot }

function apLearnLogEdit(ev) {
  try {
    const dateStr = ev?.dateStr || document.getElementById('datePicker')?.value || '';
    if (!dateStr) return;
    const updates = Array.isArray(ev?.updates) ? ev.updates : [];
    if (!updates.length) return;

    // entryIdxMap from current entryOrder
    const entryOrder = getTodayEntryOrder();
    const entryIdxMap = {};
    entryOrder.forEach((n, i) => { entryIdxMap[String(n)] = i; });

    const now = Date.now();
    updates.forEach(u => {
      const num = (u?.num !== undefined && u?.num !== null) ? String(u.num).trim() : '';
      const slot = u?.slot;
      if (!num || !(slot === 0 || slot)) return;
      const entryIdx = entryIdxMap[num];
      if (!(entryIdx === 0 || entryIdx)) return; // 입차 대상이 아닌 차는 제외
      _apEditLog.push({ ts: now, dateStr, entryIdx, slot: +slot });
    });

    // cap
    if (_apEditLog.length > AP_EDITLOG_MAX) {
      _apEditLog.splice(0, _apEditLog.length - AP_EDITLOG_MAX);
    }
  } catch {}
}

window.apLearnLogEdit = apLearnLogEdit;

/** 학습 데이터 키 생성: 입차 앞 5대 + 내일 출차 앞 5대 */
function apLearnKey(entryOrder, tmrRank) {
  const entryTop = entryOrder.slice(0,5).join(',');
  const tmrTop = Object.keys(tmrRank)
    .sort((a,b)=>(tmrRank[a]??9999)-(tmrRank[b]??9999))
    .slice(0,5)
    .join(',');
  return entryTop + '|' + tmrTop;
}

/* ── v2: 순서 패턴 기반 토큰 학습 ───────────────────────────── */
function _apLearnV2Fingerprint(entryOrder, tmrRank, opts = {}) {
  const entryK = Math.max(5, Math.min(10, opts.entryK ?? 8));
  const tmrK   = Math.max(5, Math.min(10, opts.tmrK ?? 8));

  const entryLen = entryOrder.length;
  const tmrLen = Object.keys(tmrRank || {}).length;

  const entryTopKRanks = entryOrder
    .slice(0, entryK)
    .map(n => (tmrRank[n] ?? 9999))
    .sort((a, b) => a - b);

  // 내일 상위 K (0..K-1) 존재 여부만 요약 (길이만 있으면 충분하므로 단순화)
  const tmrTopK = Array.from({ length: Math.min(tmrK, tmrLen) }, (_, i) => i);

  const todayRestCount = opts.restCount ?? 0;
  const bothRestCount = opts.bothRestCount ?? 0;

  return {
    entryLen,
    tmrLen,
    entryTopKRanks,
    tmrTopK,
    restCount: todayRestCount,
    bothRestCount,
  };
}

function _apLearnV2TokenizeLayout(values, active, entryOrder, tmrRank, tomorrowMissingSet, RC) {
  const entryIdxMap = {};
  entryOrder.forEach((n, i) => { entryIdxMap[String(n)] = i; });

  /** @type {any[]} */
  const layoutTokens = [];
  const total = RC * 3;

  /** derived hints */
  const runSlotByEntryIdx = {};
  const restSlots = [];

  for (let si = 0; si < total; si++) {
    const raw = values?.[si];
    const num = (raw !== undefined && raw !== null && String(raw).trim() !== '') ? String(raw).trim() : '';
    const isRest = !!(active && active[si]);

    if (!num) {
      layoutTokens.push({ kind: 'empty' });
      continue;
    }

    const rk = (tmrRank[num] ?? 9999);

    if (isRest) {
      const tomorrowRest = tomorrowMissingSet?.has(num) ? 1 : 0;
      layoutTokens.push({ kind: 'rest', tmrRank: rk, tomorrowRest });
      restSlots.push(si);
      continue;
    }

    const entryIdx = (entryIdxMap[num] ?? 9999);
    layoutTokens.push({ kind: 'run', entryIdx, tmrRank: rk });
    if (entryIdx !== 9999 && runSlotByEntryIdx[entryIdx] === undefined) {
      runSlotByEntryIdx[entryIdx] = si;
    }
  }

  // 휴차 분배 튜플(2R/3R/6R/7R) + restSlotSet
  const restRowCounts = { r2: 0, r3: 0, r6: 0, r7: 0 };
  restSlots.forEach(si => {
    const row = Math.floor(si / 3);
    if (row === 0) restRowCounts.r2++;
    else if (row === 1) restRowCounts.r3++;
    else if (row === 4) restRowCounts.r6++;
    else if (row === 5) restRowCounts.r7++;
  });

  return {
    layoutTokens,
    derivedHints: {
      runSlotByEntryIdx,
      restSlotSet: restSlots,
      restRowTuple: [restRowCounts.r2, restRowCounts.r3, restRowCounts.r6, restRowCounts.r7],
    }
  };
}

async function apLearnSaveV2(dateStr) {
  try {
    if (!APP?.set || !APP?.ref || !APP?.db) return { ok: false, msg: 'Firebase 미연결' };

    const snap = await APP.get(APP.ref(APP.db, 'parking/' + dateStr));
    if (!snap.exists()) return { ok: false, msg: '해당 날짜 주차 데이터 없음' };
    const parkData = snap.val();
    const values = parkData.values;
    const active = parkData.active;
    if (!values) return { ok: false, msg: '주차판 데이터 없음' };

    const tomorrowList = (dispatchState.tomorrowNums || []).map(n => n.num ?? n);
    const entryOrder = getTodayEntryOrder();
    if (!tomorrowList.length || !entryOrder.length) return { ok: false, msg: '배차 데이터 없음' };

    const tmrRank = {};
    tomorrowList.forEach((num, i) => { tmrRank[String(num)] = i; });

    const tmrMissSet = new Set((dispatchState.tomorrowMissing || []).map(x => String(x).trim()));

    // 휴차 카운트(오늘 휴차: todayMissing + 수동휴차 포함) — 기존 AutoPark와 동일한 입력 기반
    const todayRestSet = new Set((dispatchState.todayMissing || []).map(x => String(x).trim()));
    try {
      const manual = (APP && typeof APP.getManualRestSetForCurrentDate === 'function')
        ? APP.getManualRestSetForCurrentDate()
        : new Set();
      manual.forEach(n => todayRestSet.add(String(n).trim()));
    } catch {}
    const bothRestCount = [...todayRestSet].filter(n => tmrMissSet.has(n)).length;

    const fp = _apLearnV2Fingerprint(entryOrder, tmrRank, {
      restCount: todayRestSet.size,
      bothRestCount,
    });

    const RC = APP.rowCount || Math.ceil(Object.keys(values).length / 3) || 6;
    const { layoutTokens, derivedHints } =
      _apLearnV2TokenizeLayout(values, active, entryOrder, tmrRank, tmrMissSet, RC);

    // 세션 조작 로그가 있으면 derivedHints를 보강(가장 최신 이벤트 우선)
    try {
      const recent = _apEditLog.filter(e => e.dateStr === dateStr);
      if (recent.length) {
        // 최신이 이김
        const byIdx = { ...(derivedHints.runSlotByEntryIdx || {}) };
        recent.sort((a, b) => (a.ts || 0) - (b.ts || 0)).forEach(e => {
          byIdx[e.entryIdx] = e.slot;
        });
        derivedHints.runSlotByEntryIdx = byIdx;
      }
    } catch {}

    const dbSnap = await APP.get(APP.ref(APP.db, AP_LEARN_PATH_V2));
    let db = [];
    if (dbSnap.exists()) { db = dbSnap.val() || []; if (!Array.isArray(db)) db = Object.values(db); }

    // v2 key는 v1과 동일 규칙을 유지하되(디버깅/중복 제거용), 매칭은 fingerprint 기반으로 수행
    const key = apLearnKey(entryOrder, tmrRank);
    const filtered = db.filter(d => d && d.key !== key);

    filtered.unshift({
      v: 2,
      key,
      meta: {
        ts: Date.now(),
        dateStr,
        rowCount: RC,
        rowLabels: (APP.rowLabels || []).slice(),
      },
      patternFingerprint: fp,
      layoutTokens,
      derivedHints,
    });

    if (filtered.length > AP_LEARN_MAX) filtered.length = AP_LEARN_MAX;
    await APP.set(APP.ref(APP.db, AP_LEARN_PATH_V2), filtered);
    return { ok: true, msg: `학습 완료(v2) (총 ${filtered.length}개 저장됨)` };
  } catch (e) {
    return { ok: false, msg: '오류: ' + e.message };
  }
}

/** 수동 학습 저장 — 현재 선택 날짜의 주차판 배치를 저장 */
async function apLearnSave(dateStr) {
  try {
    if (!APP?.set||!APP?.ref||!APP?.db) return { ok:false, msg:'Firebase 미연결' };
    // 오늘 날짜의 주차 상태
    const snap = await APP.get(APP.ref(APP.db, 'parking/' + dateStr));
    if (!snap.exists()) return { ok:false, msg:'해당 날짜 주차 데이터 없음' };
    const parkData = snap.val();
    const values = parkData.values;
    const active  = parkData.active;
    if (!values) return { ok:false, msg:'주차판 데이터 없음' };

    // 배차 데이터에서 입차/출차 순서 구성
    const tomorrowList = (dispatchState.tomorrowNums||[]).map(n=>n.num??n);
    const entryOrder   = getTodayEntryOrder();
    if (!tomorrowList.length||!entryOrder.length) return { ok:false, msg:'배차 데이터 없음' };
    const tmrRank = {};
    tomorrowList.forEach((num,i)=>{ tmrRank[num]=i; });

    const key = apLearnKey(entryOrder, tmrRank);

    // 기존 DB 로드
    const dbSnap = await APP.get(APP.ref(APP.db, AP_LEARN_PATH_V1));
    let db = [];
    if (dbSnap.exists()) { db = dbSnap.val()||[]; if (!Array.isArray(db)) db = Object.values(db); }

    // 동일 키 중복 제거 후 앞에 추가
    const filtered = db.filter(d => d.key !== key);
    const RC = APP.rowCount || Math.ceil(Object.keys(values).length / 3) || 6;
    const entryIdxMap = {};
    entryOrder.forEach((n,i)=>{ entryIdxMap[n]=i; });
    const tmrMissSet = new Set(dispatchState.tomorrowMissing || []);

    const learnRunSlots = [];
    const learnRestSlots = [];
    for (let si = 0; si < RC * 3; si++) {
      const v = values[si];
      if (!v) continue;
      const isRest = !!(active && active[si]);
      const entryIdx = (entryIdxMap[v] ?? 9999);
      const rk = (tmrRank[v] ?? 9999);
      if (isRest) {
        learnRestSlots.push({
          slot: si,
          tmrRank: rk,
          tomorrowRest: tmrMissSet.has(v) ? 1 : 0
        });
      } else {
        learnRunSlots.push({
          slot: si,
          entryIdx,
          tmrRank: rk
        });
      }
    }

    filtered.unshift({
      key,
      values,
      active,
      entryOrder: entryOrder.slice(0,8),
      tmrTopRanks: tomorrowList.slice(0,8),
      learnRunSlots,
      learnRestSlots,
      dateStr,
      ts: Date.now()
    });
    if (filtered.length > AP_LEARN_MAX) filtered.length = AP_LEARN_MAX;
    await APP.set(APP.ref(APP.db, AP_LEARN_PATH_V1), filtered);

    // v2도 함께 저장 (가능하면)
    let v2 = null;
    try { v2 = await apLearnSaveV2(dateStr); } catch {}
    return { ok:true, msg:`학습 완료 (총 ${filtered.length}개 저장됨)${v2?.ok ? ' + v2' : ''}` };
  } catch(e) {
    return { ok:false, msg:'오류: ' + e.message };
  }
}

/** 학습 데이터 로드 — 현재 탐색 조건과 유사한 배치 반환 */
async function apLearnLoad(entryOrder, tmrRank) {
  try {
    if (!APP?.get||!APP?.ref||!APP?.db) return null;
    // 1) v2 우선 로드/매칭 (entryIdx/tmrRank 패턴 기반)
    try {
      const v2Snap = await APP.get(APP.ref(APP.db, AP_LEARN_PATH_V2));
      if (v2Snap.exists()) {
        let v2db = v2Snap.val() || [];
        if (!Array.isArray(v2db)) v2db = Object.values(v2db);
        v2db = v2db.filter(x => x && (x.v === 2 || x.layoutTokens || x.derivedHints));
        if (v2db.length) {
          const myTodayRestSet = new Set((dispatchState.todayMissing || []).map(x => String(x).trim()));
          try {
            const manual = (APP && typeof APP.getManualRestSetForCurrentDate === 'function')
              ? APP.getManualRestSetForCurrentDate()
              : new Set();
            manual.forEach(n => myTodayRestSet.add(String(n).trim()));
          } catch {}
          const myTmrMissSet = new Set((dispatchState.tomorrowMissing || []).map(x => String(x).trim()));
          const myBoth = [...myTodayRestSet].filter(n => myTmrMissSet.has(n)).length;

          const myFp = _apLearnV2Fingerprint(entryOrder, tmrRank, {
            restCount: myTodayRestSet.size,
            bothRestCount: myBoth,
          });

          const distSum = (a, b) => {
            const n = Math.max(a.length, b.length);
            let s = 0;
            for (let i = 0; i < n; i++) s += Math.abs((a[i] ?? 9999) - (b[i] ?? 9999));
            return s;
          };

          const scored = [];
          for (const rec of v2db) {
            const fp = rec.patternFingerprint || {};
            const dEntry = Math.abs((fp.entryLen ?? 0) - myFp.entryLen);
            const dTmr = Math.abs((fp.tmrLen ?? 0) - myFp.tmrLen);
            // entryTopKRanks 분포 차이 + 휴차 카운트 차이
            const dRanks = distSum(fp.entryTopKRanks || [], myFp.entryTopKRanks || []);
            const dRest = Math.abs((fp.restCount ?? 0) - (myFp.restCount ?? 0));
            const dBoth = Math.abs((fp.bothRestCount ?? 0) - (myFp.bothRestCount ?? 0));

            // 길이가 너무 다르면 사실상 다른 날 → 강패널티
            const score = dEntry * 20000 + dTmr * 20000 + dRanks * 3 + dRest * 200 + dBoth * 200;
            scored.push({ rec, score });
          }

          scored.sort((a, b) => a.score - b.score);
          const topN = scored.slice(0, 3);
          const best = topN[0]?.rec || null;
          if (best) {
            // (3) 앙상블: runSlotByEntryIdx 투표 + restSlotSet 빈도 기반 합성
            const slotVotesByIdx = {};
            const restSlotVotes = {};
            topN.forEach(({ rec }) => {
              const m = rec?.derivedHints?.runSlotByEntryIdx || {};
              Object.keys(m).forEach(k => {
                const idx = +k;
                const si = m[k];
                if (!(si === 0 || si)) return;
                if (!slotVotesByIdx[idx]) slotVotesByIdx[idx] = {};
                slotVotesByIdx[idx][si] = (slotVotesByIdx[idx][si] || 0) + 1;
              });
              const rs = rec?.derivedHints?.restSlotSet || [];
              rs.forEach(si => {
                const s = +si;
                if (!(s === 0 || s)) return;
                restSlotVotes[s] = (restSlotVotes[s] || 0) + 1;
              });
            });

            const combinedRunSlotByEntryIdx = {};
            Object.keys(slotVotesByIdx).forEach(k => {
              const idx = +k;
              const votes = slotVotesByIdx[idx];
              let bestSlot = null, bestCnt = -1;
              Object.keys(votes).forEach(siKey => {
                const cnt = votes[siKey];
                if (cnt > bestCnt) { bestCnt = cnt; bestSlot = +siKey; }
              });
              if (bestSlot === 0 || bestSlot) combinedRunSlotByEntryIdx[idx] = bestSlot;
            });

            const combinedRestSlots = Object.keys(restSlotVotes)
              .map(k => ({ si: +k, c: restSlotVotes[k] }))
              .filter(x => x.c >= 2) // 3개 중 2개 이상에서 반복된 휴차 슬롯만
              .map(x => x.si);

            // best 레코드에 합성 힌트를 덮어씌워 반환(탐색에 직접 사용)
            best.derivedHints = best.derivedHints || {};
            best.derivedHints.runSlotByEntryIdx = { ...(best.derivedHints.runSlotByEntryIdx || {}), ...combinedRunSlotByEntryIdx };
            if (combinedRestSlots.length) best.derivedHints.restSlotSet = combinedRestSlots;

            // soft-constraint용: entryIdx별 선호 row/col (hint가 없으면 그룹 선호)
            const entryLen = myFp.entryLen || entryOrder.length;
            const groupOf = (i) => {
              if (entryLen <= 0) return 0;
              const t = i / entryLen;
              return t < 1/3 ? 0 : t < 2/3 ? 1 : 2;
            };
            const groupVotes = [{}, {}, {}]; // group -> "row,col" vote
            Object.keys(best.derivedHints.runSlotByEntryIdx || {}).forEach(k => {
              const idx = +k;
              const si = best.derivedHints.runSlotByEntryIdx[k];
              if (!(si === 0 || si)) return;
              const row = Math.floor(si / 3), col = si % 3;
              const g = groupOf(idx);
              const key = row + ',' + col;
              groupVotes[g][key] = (groupVotes[g][key] || 0) + 1;
            });
            const groupPref = groupVotes.map(v => {
              let bestK = null, bestC = -1;
              Object.keys(v).forEach(k => { if (v[k] > bestC) { bestC = v[k]; bestK = k; } });
              if (!bestK) return { row: null, col: null };
              const [r, c] = bestK.split(',').map(Number);
              return { row: r, col: c };
            });
            best.derivedHints.runGroupPref = groupPref;

            return best;
          }
        }
      }
    } catch {}

    // 2) v1 폴백 (기존 키 매칭)
    const snap = await APP.get(APP.ref(APP.db, AP_LEARN_PATH_V1));
    if (!snap.exists()) return null;
    let db = snap.val()||[];
    if (!Array.isArray(db)) db = Object.values(db);
    if (!db.length) return null;

    const myKey = apLearnKey(entryOrder, tmrRank);
    const exact = db.find(d => d.key === myKey);
    if (exact) { return exact; }

    const myEntry = entryOrder.slice(0,5).join(',');
    const partial = db.find(d => d.key && d.key.startsWith(myEntry + '|'));
    if (partial) { return partial; }

    return null;
  } catch(e) { return null; }
}

/** 학습 데이터 개수 조회 */
async function apLearnCount() {
  try {
    if (!APP?.get||!APP?.ref||!APP?.db) return 0;
    const snap = await APP.get(APP.ref(APP.db, AP_LEARN_PATH_V2));
    if (snap.exists()) {
      let db = snap.val()||[];
      if (!Array.isArray(db)) db = Object.values(db);
      if (db.length) return db.length;
    }
    const snap1 = await APP.get(APP.ref(APP.db, AP_LEARN_PATH_V1));
    if (!snap1.exists()) return 0;
    let db1 = snap1.val()||[];
    if (!Array.isArray(db1)) db1 = Object.values(db1);
    return db1.length;
  } catch(e) { return 0; }
}

/** 전역 노출 */
window.apLearnSave  = apLearnSave;
window.apLearnLoad  = apLearnLoad;
window.apLearnCount = apLearnCount;
