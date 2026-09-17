/* ============================================================ 🖥️ 마이홈 데스크톱 (myhome-desktop.js)
   마이홈 우측 프리뷰(#mhRoomPreview) 미니 바탕화면 + 캐릭터세팅 창.

   ★ 파일명 이력: adventure-zombie.js → myhome-desktop.js (좀비 어드벤처 은퇴)
     · 게임은 아래 ADV_GAME_OFF=true 로 꺼져 있고, HTML의 firebaseAPI.adv* 는 전부 빈 껍데기다.
       즉 게임 코드는 남아 있지만 화면에도 안 나오고 서버에도 닿지 않는다(비용 0).
     · 살아있는 것은 '마이홈 바탕화면' 뿐 — 배경 색/이미지, 환경설정, 작업표시줄,
       배경 서버 공유(users/{uid}/advBg), 방문 모드 훅(_advApplyVisitUI), 그리고 캐릭터세팅 창.
     · 잠자는 게임 코드(약 4,000줄) 실제 삭제는 단독 작업으로 분리한다 —
       advBindEvents 하나에 바탕화면·캐릭터세팅·시뮬 이벤트가 전부 얽혀 있어서
       '삭제'가 아니라 재배선이고, 다른 변경과 섞으면 안 되는 규모다(HANDOFF 1-1).
     · 접두어 adv* / ADV_ / #adv… 와 저장 키 tw.advZ.v2 는 그대로 둔다.
       바꾸면 기존 유저의 바탕화면 설정이 초기화되고, 치환 범위가 파일 전체로 번진다.

   (아래는 게임 시절 원본 주석 — 잠자는 코드를 읽을 때 참고용으로 남긴다)
   🧟 좀비 텍스트 어드벤처: 시뮬/캐릭터세팅/인벤토리 창.

   ★ 설계 방침 (핸드오프 준수)
   · app.js와 파일 분리 — app.js에는 _mhApplyVisitUI 훅 1줄만.
   · 엔진 ↔ 콘텐츠 분리 — ADV_WORLD(스탯명/아이템/씬)만 교체하면 다른 장르 확장 가능.
   · 저장: localStorage(tw.advZ.v2 확장). 이미지(배경/프로필)만 Firebase Storage.
   · 모든 창은 #mhRoomPreview 내부 absolute — 화이트리스트 추가 불필요. confirm() 미사용.

   ★ 파생 스탯/전투 공식 (사용자 지정)
   · 공격력 = 힘×1.5 + 민첩×0.5 (+무기 보너스)
   · 방어력 = 힘×1.0 + 민첩×0.5
   · 크리티컬 확률 = 지능×2 + 운×3 (%) [최대 50] / 크리 배율 1.5
   · 회피(피격 시) = 운×2.5 + 방어력 (%) [최대 85]
   · 감염 회피(피격 후) = 운×2 + 방어력 (%) [최대 90] — 실패 시 감염률 상승

   ★ 파티(친구 협동)
   · 이번 단계는 UI/규칙 자리만: 파티 바 + 협동 선택지 (0/3) 표시.
   · 실시간 연동(Firebase parties)은 다음 단계 — advPartyAdd에서 안내만.

   ★ app.js 전역 의존 (전부 typeof 가드)
   · getFocusLevel(), _focusTotalSec, getDisplayName()
   · firebaseAPI.uploadUserImage(), getMyUserId(), toast(), companion.dsHold()
*/
(function(){
/* ══════════════════════════════════════════════════════════════════════════════
   ★ 좀아칼 중단 스위치 — 바탕화면은 남기고 '게임만' 끈다
   ADV_GAME_OFF = true 일 때:
     · '좀아칼au' 폴더 아이콘을 만들지 않는다 → 게임에 들어갈 방법이 없음
     · fbReady()가 항상 false → 파티·전투·채팅 등 실시간 Firebase 연결 전면 차단(요금 지점)
     · 게임 BGM 로드 안 함
   그대로 살아있는 것 (마이홈 바탕화면 컨셉):
     · 미니 바탕화면, 배경 색/이미지 변경, 환경설정, 작업표시줄
     · 배경 서버 동기화(users/{uid}/advBg) — 방문자에게 내 바탕화면이 보이는 기능.
       이건 fbReady()를 거치지 않고 firebaseAPI.saveAdvBg를 직접 쓰므로 차단 대상이 아니다.
       배경 바꿀 때만 쓰기 1회라 비용도 사실상 없다.
     · 방문 모드 훅(_advApplyVisitUI)
   ADV_HIDE_CHAR = true 로 하면 '캐릭터세팅' 폴더도 같이 숨길 수 있다(기본은 유지).
   되살리려면 ADV_GAME_OFF 를 false 로.
   ══════════════════════════════════════════════════════════════════════════════ */
const ADV_GAME_OFF = true;
/* ★ 캐릭터세팅 폴더는 미스테리au의 '캐릭터 등록'이 대신한다(2026-08 교체).
   데이터(tw.advZ.v2)는 지우지 않고 그대로 둔다 — mystery-au.js가 1회 읽어 이관하고,
   되돌리고 싶으면 이 값만 false로 바꾸면 예전 캐릭터세팅이 그대로 돌아온다. */
const ADV_HIDE_CHAR = true;
'use strict';

/* ─────────────────────────── 저장 ─────────────────────────── */
const ADV_KEY = 'tw.advZ.v2';
const ADV_KEY_V1 = 'tw.advZ.v1';

function blankSlot(){
  return { name:'', age:'', personality:'', face:'🧑‍🚒', faceImg:null,
           faceImgs:{a:null,b:null,c:null,d:null},   // ★ 상태별 프로필 4장 (a평상/b부상/c감염/d위중·사망흑백)
           keepsake:null, keepsakeDesc:'',            // 🎗 유품 이미지(20×20 투명 PNG data URL) + 설명(140자)
           alloc:{str:0, agi:0, int:0, luk:0}, weapon:null,   // weapon: {id, dur}
           bonus:{str:0, agi:0, int:0, luk:0},                // 정찰로 얻은 영구 보너스 (총합 5 상한)
           kills:0, explores:0, outlaws:0, good:0, evil:0, title:null };
}
function advLoad(){
  try{
    const d = JSON.parse(localStorage.getItem(ADV_KEY) || 'null');
    if(d && Array.isArray(d.slots)){
      const slots = [0,1,2].map(i => Object.assign(blankSlot(), d.slots[i] || {},
        { faceImgs: (function(sd){ const f=Object.assign({a:null,b:null,c:null,d:null},(sd&&sd.faceImgs)||{});
            if(!f.a && sd && sd.faceImg) f.a=sd.faceImg; return f; })(d.slots[i]),   // ★ 레거시 1장 → a로 이관
          alloc: Object.assign({str:0,agi:0,int:0,luk:0}, (d.slots[i]||{}).alloc || {}),
          bonus: Object.assign({str:0,agi:0,int:0,luk:0}, (d.slots[i]||{}).bonus || {}),
          weapon: (d.slots[i]&&d.slots[i].weapon) || null,
          kills: (d.slots[i]&&d.slots[i].kills)||0,
          explores: (d.slots[i]&&d.slots[i].explores)||0,
          outlaws:(d.slots[i]&&d.slots[i].outlaws)||0,
          good:(d.slots[i]&&d.slots[i].good)||0,
          evil:(d.slots[i]&&d.slots[i].evil)||0,
          title: (d.slots[i]&&d.slots[i].title)||null }));
      return {
        slots,
        active:(typeof d.active==='number'&&d.active>=0&&d.active<3)?d.active:0,
        st:(typeof d.st==='number')?d.st:100,
        stLevel:(typeof d.stLevel==="number")?d.stLevel:null,
        hp:(typeof d.hp==='number')?d.hp:100,
        inf:(typeof d.inf==='number')?d.inf:0,          // 감염률 0~100
        inv:(d.inv&&typeof d.inv==='object')?d.inv:{},   // 공용 소모품 인벤토리 {itemId:count}
        armor:(typeof d.armor==='number')?d.armor:0,      // 🛡 현재 방어력(실드)
        armorItem:d.armorItem||null,                      // 장착 방어구 id
        weapons:Array.isArray(d.weapons)?d.weapons:[],   // 무기 개체 풀 [{id,dur}] (내구도 개별, 미장착분)
        scene:d.scene||'camp',                          // 진행 중인 씬
        homeCamp:d.homeCamp||null,                       // 저장된 캠프 씬 (복귀 지점)
        bg:d.bg||null,
        map:(d.map&&typeof d.map==='object')?d.map:null,   // 🗺️ {seed,pos:{x,y},stepped:['x,y'],found:[bldgIdx]}
        deeds:Array.isArray(d.deeds)?d.deeds:[],          // 선택 기록(과거 흔적·목격) — 재접속 복원
        runStart:(typeof d.runStart==='number')?d.runStart:null,   // 생존 타이머 시작 — 재접속 복원
        runKills:(typeof d.runKills==='number')?d.runKills:0,       // 세션 좀비 킬 — 재접속 복원
        runStartSt:(typeof d.runStartSt==='number')?d.runStartSt:null,   // 세션 시작 기력 — 긴급 초기화 되돌리기용
        runOutlaws:(typeof d.runOutlaws==='number')?d.runOutlaws:0, // 세션 무법자 킬 — 재접속 복원
        story:(d.story&&typeof d.story==='object')?d.story:null,    // 진행 중 스토리 씬 — 재접속 복원
        inLobby:(typeof d.inLobby==='boolean')?d.inLobby:false,     // ★ 로비(모드 미선택) 상태 — 껐다 켜도 로비 유지
        sessionMode:(d.sessionMode==='solo'||d.sessionMode==='together')?d.sessionMode:null,   // ★ 버그수정: 이 줄이 없어서 껐다 켜면 sessionMode가 사라지고
                                                                                              //   advRouteOnOpen의 재개 판정(sessionMode && runStart)이 항상 실패 → 진행 중이던 세션이 로비로 초기화됐다.
        partyPid:(typeof d.partyPid==='string')?d.partyPid:null,     // ★ 파티 대기실 코드 — 앱 재시작 후 대기실 복원용
        bgmMuted:(typeof d.bgmMuted==='boolean')?d.bgmMuted:false,    // 🎵 BGM 음소거 상태 유지
      };
    }
  }catch(_){}
  // v1 마이그레이션
  try{
    const o = JSON.parse(localStorage.getItem(ADV_KEY_V1) || 'null');
    if(o){
      const s0 = blankSlot();
      s0.face = o.face || '🧑‍🚒';
      if(o.alloc){ s0.alloc.str=o.alloc.str||0; s0.alloc.agi=o.alloc.agi||0; s0.alloc.int=o.alloc.int||0; s0.alloc.luk=o.alloc.sur||0; }
      return { slots:[s0,blankSlot(),blankSlot()], active:0,
               st:(typeof o.st==='number')?o.st:100, stLevel:null,
               hp:(typeof o.hp==='number')?o.hp:100, inf:0, inv:{}, weapons:[], scene:'camp', bg:o.bg||null };
    }
  }catch(_){}
  return { slots:[blankSlot(),blankSlot(),blankSlot()], active:0, st:100, stLevel:null, hp:100,
           inf:0, inv:{}, weapons:[], scene:'camp', bg:null };
}
function advSave(){ try{ localStorage.setItem(ADV_KEY, JSON.stringify(ADV)); }catch(_){} }
// 🖥️ 바탕화면 배경을 서버에도 저장 — 방문자가 집주인 바탕화면을 볼 수 있게(로컬 저장만으론 공유 불가).
function advSaveBgRemote(){
  try{
    if(!window.firebaseAPI || !firebaseAPI.saveAdvBg || typeof getMyUserId!=='function') return;
    const uid = getMyUserId(); if(!uid) return;
    Promise.resolve(firebaseAPI.saveAdvBg(uid, ADV.bg || null)).then(r=>{
      if(r && r.ok) console.log('[바탕화면] 서버 저장 완료', ADV.bg||'(없음)');
      else console.warn('[바탕화면] 서버 저장 실패 — Firebase 규칙(users/{uid}/advBg)이 콘솔에 게시됐는지 확인하세요.');
    }).catch(()=>console.warn('[바탕화면] 서버 저장 실패(네트워크)'));
  }catch(_){}
}
// 앱 시작 시 내 배경을 서버와 맞춤 — 사용자ID·firebase 준비가 늦을 수 있어 준비될 때까지 재시도.
//   (예전엔 1회 플래그 방식이라, 저장이 실패해도 플래그가 찍혀 영영 재시도하지 않는 문제가 있었음)
function advSyncBgOnStart(){
  let tries = 0;
  const tick = ()=>{
    tries++;
    const uid = (typeof getMyUserId==='function') ? getMyUserId() : null;
    if(window.firebaseAPI && firebaseAPI.saveAdvBg && uid){
      if(ADV.bg) advSaveBgRemote();
      return;
    }
    if(tries < 20) setTimeout(tick, 500);
  };
  tick();
}
let advVisitBg = null;   // 방문 중일 때 표시할 "집주인의" 배경 ({img}|{color}|null)
const ADV = advLoad();
let editSlot = ADV.active;
try{ if(!localStorage.getItem(ADV_KEY)) advSave(); }catch(_){}

function curSlot(){ return ADV.slots[editSlot]; }
function activeSlot(){ return ADV.slots[ADV.active]; }

/* ─────────────────────────── 집중 연동 ─────────────────────────── */
function advFocusLevel(){ try{ if(typeof getFocusLevel==='function') return getFocusLevel(); }catch(_){} return 1; }
function advFocusSec(){ try{ if(typeof _focusTotalSec==='number') return _focusTotalSec; }catch(_){} return 0; }
// ★ 나이대별 스탯 포인트 계수 (어린이·노인은 적게). 경계·배율은 여기서 조정.
const AGE_TIERS = [
  { max:12,  mul:0.6,  label:'어린이' },
  { max:17,  mul:0.85, label:'청소년' },
  { max:59,  mul:1.0,  label:'성인'   },
  { max:999, mul:0.7,  label:'노인'   },
];
function ageNum(s){ const n=parseInt(String((s&&s.age)||''),10); return (isNaN(n)?18:Math.max(0,Math.min(120,n))); }  // 숫자 없으면 성인(18)
function ageTier(s){ const a=ageNum(s); return AGE_TIERS.find(t=>a<=t.max) || AGE_TIERS[2]; }
function advTotalPoints(s){ const mul=(s?ageTier(s).mul:1); return Math.min(50, 10 + Math.floor(advFocusLevel()*mul/5)); }   // 기본 10 + 집중레벨 보너스(레벨 5당 +1, 나이계수 적용) → 레벨 200에서 50, 최대 50
function slotSpent(s){ const a=s.alloc; return a.str+a.agi+a.int+a.luk; }
function slotPointsLeft(s){ return Math.max(0, advTotalPoints(s)-slotSpent(s)); }
function advTitleMod(s,k){ if(!s||!s.title) return 0; const t=titleById(s.title); if(!t||!t.mod) return 0; if((s[t.stat]||0)<t.need) return 0; return t.mod[k]||0; }
function slotStat(s,k){ return Math.max(0, (s.alloc[k]||0) + (s.bonus&&s.bonus[k]||0) + advTitleMod(s,k)); }   // 표시치: 분배 + 정찰 + 칭호 (0 시작 — 기본치 없음)
function statEff(s,k){ return Math.max(1, slotStat(s,k) + 1); }   // 전투/판정용 유효치(0분배=유효1 → 구 기본10 밸런스와 동일)

// 기력 회복 = 집중 레벨이 오를 때마다 full 회복 (일해서 레벨업 → 게임할 기력).
//   stLevel: 마지막으로 기력을 채운 시점의 집중 레벨. 현재 레벨이 더 높으면 100으로 채움.
/* ★ #9: 기력 소비 단일 창구 — 선택·이동·전투 1턴 = 무조건 1.
   기존엔 감소는 되는데 advRenderSim()을 안 불러 좌측 게이지가 그대로라 '안 줄어든다'로 보였음. */
const ADV_ST_COST=1;
function advSpendSt(n){
  ADV.st=Math.max(0, ADV.st-(typeof n==='number'?n:ADV_ST_COST));
  advSave();
  if(document.getElementById('advTerm')) advRenderSim();
}
function advRefreshStamina(){
  const lv = advFocusLevel();
  if(ADV.stLevel===null || ADV.stLevel===undefined){ ADV.stLevel=lv; return; }   // 최초 기록만
  if(lv > ADV.stLevel){ ADV.st=100; ADV.stLevel=lv; advSave(); }                 // 레벨업 → full 회복
}

/* ─────────────────────────── 파생 스탯 (전투 공식) ─────────────────────────── */
// 슬롯이 장착한 무기의 공격 보너스 (내구도 0이면 효과 없음)
function slotWeaponBonus(s){
  const w=s&&s.weapon; if(!w) return 0;
  const it=ADV_WORLD.items[w.id]; if(!it||!it.weapon) return 0;
  return (w.dur>0)?it.weapon:0;
}
// 무기 내구도 퍼센트
function weaponDurPct(w){
  if(!w) return 0;
  const it=ADV_WORLD.items[w.id]; const max=(it&&it.maxDur)||1;
  return Math.max(0, Math.round((w.dur/max)*100));
}
function statAtk(s){ return Math.round(statEff(s,'str')*1.5 + statEff(s,'agi')*0.5 + slotWeaponBonus(s)); }
function statDef(s){ return Math.round(statEff(s,'str')*1.0 + statEff(s,'agi')*0.5); }
function critChance(s){ return Math.min(50, statEff(s,'int')*2 + statEff(s,'luk')*3); }
function dodgeChance(s){ return Math.min(85, Math.round(statEff(s,'luk')*2.5 + statDef(s))); }
function infectAvoidChance(s){ return Math.min(90, statEff(s,'luk')*2 + statDef(s)); }
// ★ 상태별 프로필 사진 — 위중도 우선순위로 a/b/c/d 결정 (경계값은 여기서 조정)

/* ═══ 🗺️ 맵 생성기 (v5 검증본) — 30×20 격자 · 분기 테마 · 건물 footprint ═══
   같은 시드 = 같은 맵(결정론, 파티 공유용). 그리드는 저장하지 않고 시드에서 매번 재생성. */
const ADV_MAP_W=30, ADV_MAP_H=20;
const ADV_MATE_COLORS=['#4ae8c8','#e8934a','#c86ae8','#9ee84a','#e86a9e','#6aa8e8'];   // D#1 동료 마커 색(고정 배정)
const ADV_MAP_GOAL={x:29,y:10};
const ADV_MAP_VIS=4;          // 시야 = 너비 8칸(±4)
const ADV_BLDG_SPOT=4;        // 건물 원거리 발견 거리(가장자리 3~4칸)
const ADV_THEMES={
  ruin:  {name:'폐허거리',  color:'#b0876a', bldgs:[['무너진아파트',2,3],['폐공장',3,2],['잔해더미',1,1],['폐주유소',1,1],['무너진육교',2,1],['폐창고',2,1]]},
  shop:  {name:'상가거리',  color:'#7ab8ff', bldgs:[['백화점',3,2],['마트',2,2],['카페',1,1],['편의점',1,1],['상가건물',2,2],['영화관',2,2]]},
  home:  {name:'주택거리',  color:'#9fd88a', bldgs:[['아파트',2,3],['단독주택',1,1],['빌라',2,1],['학교',3,2],['놀이터',1,1],['교회',1,2]]},
  infra: {name:'인프라거리',color:'#d8c47a', bldgs:[['병원',2,2],['경찰서',2,2],['소방서',2,2],['우체국',1,1],['발전소',3,2],['정수장',2,2]]},
  park:  {name:'놀이공원',  color:'#ff7ad9', bldgs:[['대관람차',2,2],['롤러코스터',3,2],['회전목마',1,1],['매표소',1,1],['유령의집',2,2],['푸드코트',2,1]]},
  mil:   {name:'군사구역',  color:'#e0e0e0', bldgs:[['벙커',1,1],['초소',1,1],['막사',2,1],['무기고',2,2],['헬기장',2,2],['레이더기지',2,2]]},
};
const ADV_OPEN_DIST=[{e:.55,c:.15,s:.16,v:.14},{e:.52,c:.26,s:.10,v:.12},{e:.50,c:.36,s:.04,v:.10}];   // v=미니이벤트
const ADV_BLDG_DIST=[{s:.60},{s:.45},{s:.30}];
function advRngMake(seed){ let a=seed>>>0; return function(){ a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function advGenMap(seed){
  const r=advRngMake(seed), ri=(lo,hi)=>lo+Math.floor(r()*(hi-lo+1));
  const pool=Object.keys(ADV_THEMES).slice(), themes=[];
  for(let i=0;i<3;i++) themes.push(pool.splice(Math.floor(r()*pool.length),1)[0]);
  const grid=Array.from({length:ADV_MAP_H},()=>Array.from({length:ADV_MAP_W},()=>({kind:'empty',band:0})));
  for(let y=0;y<ADV_MAP_H;y++)for(let x=0;x<ADV_MAP_W;x++)grid[y][x].band=Math.min(2,Math.floor(x/10));
  const occ=Array.from({length:ADV_MAP_H},()=>Array(ADV_MAP_W).fill(false)); occ[ADV_MAP_GOAL.y][ADV_MAP_GOAL.x]=true;
  const buildings=[];
  for(let b=0;b<3;b++){
    const set=ADV_THEMES[themes[b]].bldgs, n=ri(7,9);
    for(let i=0;i<n;i++){
      const bt=set[Math.floor(r()*set.length)];
      for(let tries=0;tries<40;tries++){
        const x=ri(b*10,b*10+10-bt[1]), y=ri(0,ADV_MAP_H-bt[2]);
        let ok=true;
        for(let yy=y;yy<y+bt[2]&&ok;yy++)for(let xx=x;xx<x+bt[1];xx++)if(occ[yy][xx]){ok=false;break;}
        if(!ok)continue;
        for(let yy=y;yy<y+bt[2];yy++)for(let xx=x;xx<x+bt[1];xx++)occ[yy][xx]=true;
        buildings.push({t:bt[0],x,y,w:bt[1],h:bt[2],band:b,story:false,door:['up','down','left','right'][Math.floor(r()*4)]}); break;
      }
    }
  }
  for(let b=0;b<3;b++){ const c=buildings.filter(bd=>bd.band===b); if(c.length)c[Math.floor(r()*c.length)].story=true; }
  const camps=[], campX=[[8,10],[18,20],[24,26]];
  for(let i=0;i<3;i++)for(let t=0;t<60;t++){ const x=ri(campX[i][0],campX[i][1]),y=ri(3,ADV_MAP_H-4);
    if(occ[y][x])continue; occ[y][x]=true; camps.push({name:'ABC'[i],x,y}); break; }
  let start=null;
  for(let t=0;t<60;t++){ const y=ri(0,ADV_MAP_H-1); if(!occ[y][0]){start={x:0,y};break;} }
  if(!start) start={x:0,y:0};
  const bmap=Array.from({length:ADV_MAP_H},()=>Array(ADV_MAP_W).fill(null));
  buildings.forEach((bd,bi)=>{for(let yy=bd.y;yy<bd.y+bd.h;yy++)for(let xx=bd.x;xx<bd.x+bd.w;xx++)bmap[yy][xx]=bi;});
  for(let y=0;y<ADV_MAP_H;y++)for(let x=0;x<ADV_MAP_W;x++){
    const cell=grid[y][x], band=cell.band;
    if(x===ADV_MAP_GOAL.x&&y===ADV_MAP_GOAL.y){cell.kind='goal';continue;}
    if(camps.some(c=>c.x===x&&c.y===y)){cell.kind='camp';continue;}
    if(start.x===x&&start.y===y){cell.kind='start';continue;}
    const bi=bmap[y][x];
    if(bi!==null){ const bd=buildings[bi];
      if(bd.story){cell.kind='storybldg'; cell.bldg=bi; continue;}
      cell.kind=r()<ADV_BLDG_DIST[band].s?'resource':'combat'; cell.bldg=bi;
    }else{ const d=ADV_OPEN_DIST[band],x0=r();
      cell.kind = x0<d.e ? 'empty'
        : x0<d.e+d.c ? 'combat'
        : x0<d.e+d.c+d.s ? 'resource'
        : 'minievent'; }
  }
  return {seed,grid,buildings,camps,start,goal:ADV_MAP_GOAL,themes};
}

/* ═══ ⚔️ 전투 시스템 — 언더롤 1d20 하이브리드 (설계 3.12장, 시뮬 검증) ═══ */
const ADV_ENEMIES={
  zombie: {name:'일반 감염자', icon:'🧟', hp:190, atk:22, agi:2, dc:14, hitDc:14, infect:true },
  outlaw: {name:'무법자',     icon:'🔪', hp:105, atk:20, agi:4, dc:11, hitDc:14, infect:false},
  soldier:{name:'군인 감염자', icon:'🧟‍♂️', hp:190, atk:28, agi:3, dc:10, hitDc:14, infect:true },
  horde:  {name:'좀비 무리',   icon:'🧟‍♀️', hp:480, atk:35, agi:8, dc:8,  hitDc:15, infect:true, boss:true},
};
const ADV_BAND_SPAWN=[   // 분기별 일반 조우 분포 (보스는 스토리건물 전용)
  [['zombie',.70],['outlaw',.30]],
  [['zombie',.55],['soldier',.45]],
  [['zombie',.40],['soldier',.40],['outlaw',.20]],
];
const ADV_LOOT={   // 처치 전리품 [확률, 아이템 후보] — ★ 무기·조합 재료로 다양화
  zombie: [.42,['can','flash','nail','tape','pipe']],
  outlaw: [.65,['med','can','bat','knife','pistol','part','tape']],
  soldier:[.58,['med','guard','axe','wrench','part','powder','nail']],
  horde:  [1.0,['labkey']],
};
const ADV_POOLS={
  combat:[  // theme 일치 씬 우선, 없으면 공용(null)
    {theme:null,  intro:'골목 어귀에서 <span class="bad">{E}</span>이(가) 튀어나온다!'},
    {theme:null,  intro:'무너진 잔해 사이 — <span class="bad">{E}</span>이(가) 이쪽을 알아챘다.'},
    {theme:'park',intro:'멈춘 회전목마 뒤에서 신음이 들린다… <span class="bad">{E}</span>다!'},
    {theme:'shop',intro:'깨진 진열장 너머로 <span class="bad">{E}</span>이(가) 어슬렁거린다.'},
    {theme:'mil', intro:'초소 그늘에서 <span class="bad">{E}</span>이(가) 걸어 나온다.'},
  ],
  resource:[
    { intro:'버려진 배낭이 눈에 띈다. 주인은 보이지 않는다.',
      choices:[
        {label:'뒤진다 (운 판정)',        check:['luk',13], ok:{item:'rand'},  fail:{ambush:true, txt:'배낭 뒤에서 그림자가 일어선다…!'}},
        {label:'조심히 살핀다 (지능 판정)', check:['int',11], ok:{item:'rand1'}, fail:{txt:'아무것도 남아있지 않았다.'}},
        {label:'지나친다', skip:true} ] },
    { intro:'반쯤 열린 자판기. 안에 뭔가 남아 있을지도.',
      choices:[
        {label:'비집어 연다 (힘 판정)',    check:['str',12], ok:{item:'can'},   fail:{txt:'손잡이만 부러졌다. 허탕이다.'}},
        {label:'동전 반환구를 뒤진다 (운 판정)', check:['luk',10], ok:{item:'flash'}, fail:{txt:'먼지뿐이다.'}},
        {label:'지나친다', skip:true} ] },
    { intro:'구급상자가 벽에 걸려 있다. 겉면이 피로 얼룩져 있다.',
      choices:[
        {label:'열어본다 (운 판정)',       check:['luk',12], ok:{item:'med'},   fail:{ambush:true, txt:'상자를 여는 순간, 등 뒤에서 인기척이…!'}},
        {label:'지나친다', skip:true} ] },
  ],
};
let ADV_COMBAT=null;   // {ekey,ehp,pFirst} — 저장 안 함(창 닫으면 조우 리셋: 핸드오프 참조)

function advD20(){ return 1+Math.floor(Math.random()*20); }
function advPDef(){ const s=activeSlot(); return statEff(s,'str')*1.0+statEff(s,'agi')*0.5; }
/* 🛡 방어력 = HP 위의 실드(장착 방어구). 피격 시 방어력부터 소모, 0이면 방어구 파괴 */
function advArmorValue(base){
  const s=activeSlot(); const mul=(typeof ageTier==='function'?ageTier(s).mul:1);   // 나이 계수 반영
  return Math.max(1, Math.round((base + statEff(s,'str')*0.5 + statEff(s,'agi')*0.5 + statEff(s,'luk')*0.3) * mul));
}
function advEquipArmor(id){
  const it=ADV_WORLD.items[id]; if(!it||!it.armor) return;
  ADV.armorItem=id; ADV.armor=advArmorValue(it.armor); advSave(); advRenderSim();
}
function advApplyDamage(dmg){   // 방어력 우선 차감 → 넘치면 HP
  let toHp=dmg, absorbed=0;
  if((ADV.armor||0)>0){ absorbed=Math.min(ADV.armor, dmg); ADV.armor-=absorbed; toHp-=absorbed;
    if(ADV.armor<=0){ ADV.armor=0; if(ADV.armorItem){ ADV.armorItem=null; if(typeof advToast==='function') advToast('🛡 방어구가 부서졌다'); } } }
  if(toHp>0) ADV.hp=Math.max(0, ADV.hp-toHp);
  return {absorbed, toHp};
}
function advPAtk(ekey){
  const s=activeSlot();
  let a=statEff(s,'str')*1.5+statEff(s,'agi')*0.5+slotWeaponBonus(s);
  if(ekey==='outlaw' && s.title==='out1') a*=2;   // 인간혐오자
  return a;
}
function advInfAvoid(){ const s=activeSlot(); return Math.min(90, 15 + statEff(s,'luk')*3 + advPDef()*2); }   // 감염 회피(낮을수록 감염↑)
function advTierRoll(dc){
  // ★ #8: 판정값 비교를 화면에 보여주기 위해 보정값(eff)·목표값(dc)을 항상 함께 반환
  const s=activeSlot(); const roll=advD20();
  const luk=Math.floor(statEff(s,'luk')/2);
  const eff=roll-luk;
  if(roll===1)  return {roll, eff, dc, luk, tier:'대성공'};
  if(roll===20) return {roll, eff, dc, luk, tier:'대실패'};
  if(eff<=Math.ceil(dc/2)) return {roll, eff, dc, luk, tier:'크리티컬'};
  if(eff<=dc) return {roll, eff, dc, luk, tier:'명중'};
  return {roll, eff, dc, luk, tier:'빗나감'};
}
// ★ #8: (나온값/성공값) 표기 — 굴림·행운보정·목표를 한눈에
function advRollTag(r){
  if(!r) return '';
  const e=(typeof r.eff==='number')?r.eff:r.roll;
  return '<span class="roll">🎲'+r.roll+'</span> <span class="sys" style="font-size:10px">('+e+'/'+r.dc+')</span>';
}
// ★ #8: 5단계 등급 라벨 (대실패 · 실패 · 보통 · 성공 · 대성공)
function advGradeLabel(tier){
  return {'대실패':'<span class="bad">대실패</span>','빗나감':'<span class="bad">실패</span>',
          '명중':'보통','크리티컬':'<span class="crit">성공</span>','대성공':'<span class="crit">대성공</span>'}[tier]||tier;
}
function advPickEnemy(band){
  const t=ADV_BAND_SPAWN[Math.min(2,band)]; const x=Math.random(); let acc=0;
  for(const [k,p] of t){ acc+=p; if(x<acc) return k; }
  return t[0][0];
}
function advRollLoot(ekey){
  const L=ADV_LOOT[ekey]; if(!L||Math.random()>=L[0]) return null;
  return L[1][Math.floor(Math.random()*L[1].length)];
}
/* ★ 요청2: 처치 시 희박한 확률로 조합 재료가 추가로 나온다(기본 전리품과 별개 굴림).
   적 종류에 따라 나오는 재료가 다르다 — 군인 감염자 쪽이 쓸 만한 부품을 갖고 있다. */
const ADV_SCRAP_CHANCE=0.15;
const ADV_SCRAP_POOL={
  zombie: ['nail','tape'],
  outlaw: ['nail','tape','part'],
  soldier:['part','powder','nail','tape'],
};
function advRollScrap(ekey){
  const pool=ADV_SCRAP_POOL[ekey]; if(!pool) return null;
  if(Math.random()>=ADV_SCRAP_CHANCE) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}
function advCloseMapView(){
  const v=document.getElementById('advMapView');
  if(v) v.style.display='none';
  if(_advMapBlinkT){ clearInterval(_advMapBlinkT); _advMapBlinkT=null; }
  if(_advMoveBlinkT){ clearInterval(_advMoveBlinkT); _advMoveBlinkT=null; }
}

/* ─── D#4 다인 전투: 스토리 건물 보스(좀비 무리)를 파티가 함께 — 적 HP 파티 스케일·협공·막타 귀속 ───
   솔로/일반 필드 전투는 불변(shared=false). advGame/$pid/combat 노드 사용(호스트 함수 없으면 자동 솔로 폴백). */
function advHostCombat(){ try{ return !!(window.firebaseAPI && firebaseAPI.advWriteCombat && firebaseAPI.advWatchCombat); }catch(_){ return false; } }
function advPublishCombat(patch){ if(fbReady() && PARTY.pid && firebaseAPI.advWriteCombat){ try{ firebaseAPI.advWriteCombat(PARTY.pid, patch); }catch(_){} } }
/* ★ 내 판정 한 줄을 공유 전투 슬롯에 게시 — 동료 화면의 전투 로그에 그대로 뜬다.
   HTML은 보내지 않는다(평문만). 받는 쪽에서 esc 후 감싼다. */
function advPublishCombatAct(text){
  if(!text) return;
  advPublishCombat({ lastAct:text, lastUid:myUid(), lastTs:Date.now() });
}
function advSubscribeCombat(){
  if(!advHostCombat() || !PARTY.pid) return;
  try{ PARTY.unsubCombat && PARTY.unsubCombat(); }catch(_){}
  PARTY.unsubCombat = firebaseAPI.advWatchCombat(PARTY.pid, data=>advSyncCombat(data));
}
function advEndSharedCombat(){ try{ PARTY.unsubCombat && PARTY.unsubCombat(); }catch(_){} PARTY.unsubCombat=null;
  if(advIsParty() && PARTY.pid && PARTY.started) advSubscribeCombat();   // ★ #3: 전투 종료 후에도 '도착 감지'용 구독 유지
}
function advSyncCombat(data){
  PARTY.combatNode = data || null;   // ★ #3: 도착 감지용으로 항상 캐시(내가 전투 중이 아니어도)
  // ★ #3: 관전 중이면 관전 화면 갱신 / 종료 감지
  if(ADV._combatSpectate){
    if(!data || data.active===false || (typeof data.ehp==='number' && data.ehp<=0)){
      ADV._combatSpectate=null;
      advPrompt('<p class="sys">교전이 끝났다.</p>', [{label:'🚶 나아간다', cls:'adv-reveal', on:advOpenMove}]);
    } else advRenderCombatSpectate(data);
    return;
  }
  if(!data || !ADV_COMBAT || !ADV_COMBAT.shared) return;
  if(ADV_COMBAT.field && data.cell && ADV_COMBAT.cell && data.cell!==ADV_COMBAT.cell) return;   // ★ #3: 슬롯이 다른 칸 전투로 바뀜 → 내 전투와 무관, 무시
  if(ADV_COMBAT.field && typeof data.parts==='number' && data.parts>(ADV_COMBAT.parts||1)){   // ★ 누군가 합류 → 나도 순서 재계산
    ADV_COMBAT.parts=data.parts;
    advRecalcInitiative(ADV_COMBAT.cell, null);
    if(!ADV._inReward && document.getElementById('advTerm')) advCombatRender();
  }
  // ★ 동료의 판정 결과 — 로그에 찍고, 순서 표시줄의 노란 테두리를 그 동료 칩으로 잠깐 옮긴다.
  if(data.lastAct && data.lastUid && data.lastUid!==myUid() && data.lastTs && data.lastTs!==ADV_COMBAT._actTs){
    ADV_COMBAT._actTs=data.lastTs;
    const M2=partyMembers(), mm=M2[data.lastUid]||{};
    const nm=mm.charName||mm.nick||'동료';
    ADV_COMBAT.log.push('<p class="adv-mate-act"><b>'+esc(nm)+'</b> '+esc(String(data.lastAct).slice(0,200))+'</p>');
    ADV_COMBAT.actUid=data.lastUid;
    if(_advActT) clearTimeout(_advActT);
    _advActT=setTimeout(()=>{ _advActT=null;
      if(ADV_COMBAT){ ADV_COMBAT.actUid=null; if(!ADV._inReward && document.getElementById('advTerm')) advCombatRender(); } }, 1400);
    if(!ADV._inReward && document.getElementById('advTerm')) advCombatRender();
  }
  if(typeof data.ehp==='number' && data.ehp!==ADV_COMBAT.ehp){ ADV_COMBAT.ehp=data.ehp; if(!ADV._inReward && document.getElementById('advTerm')) advCombatRender(); }
  if(data.rewards){ ADV._rewards=data.rewards; if(ADV._inReward) advRenderRewards(ADV_COMBAT.killer); }   // D#5 보상 동기화
  if(data.active===false && !ADV_COMBAT._won){ ADV_COMBAT._won=true;
    if(ADV_COMBAT.field) advFieldSharedWin(data.killer);   // ★ #3: 필드 협공은 로컬 마무리(참가자만)
    else advSharedWin(data.killer); }   // D#4 horde: 다른 동료가 막타
}
/* ─── #3 필드 협공: 팀원 전투 칸 도착 시 끼어들기/관전/후퇴 (공유 슬롯 재사용, 결정 A·B 추천안) ─── */
function advFieldName(uid){ return advChatName(uid) || '동료'; }
/* ★ 합류 시 선공(턴 순서) 재계산 — 그 칸에 있는 참가자 중 가장 빠른 민첩으로 적과 비교.
   (동료 민첩은 파티에 공유되는 charInfo.agi 사용. 각자 버프까지는 반영 못 하는 근사치.) */
function advPartyBestAgi(cellKey){
  const s=activeSlot(); let best=statEff(s,'agi'), who='나';
  const M=partyMembers();
  for(const uid in M){ if(uid===myUid()) continue;
    const c=advMateCoord(uid); if(!c || (c.x+','+c.y)!==cellKey) continue;   // 같은 칸(=참가 중)만
    const a=(M[uid].charInfo && +M[uid].charInfo.agi)||0;
    if(a>best){ best=a; who=(M[uid].charName||M[uid].nick||'동료'); }
  }
  return {agi:best, who};
}
/* ★ 전투 순서 표시줄 — 민첩 내림차순, 적도 순서 안에 포함. 이름만(이모지·숫자 없음).
   현재 차례를 노란 테두리로 강조. ★ 강조 기준은 ADV_COMBAT.phase(턴 페이즈):
   'enemy'면 적 칩, 그 외(=내 입력 대기)면 내 칩. (예전엔 pFirst 고정이라 테두리가 안 움직였다.) */
function advOrderStripHtml(){
  if(!ADV_COMBAT) return '';
  const e=ADV_ENEMIES[ADV_COMBAT.ekey]; if(!e) return '';
  const s=activeSlot();
  const list=[{name:advMyCharName(), agi:statEff(s,'agi'), me:true}];
  if(ADV_COMBAT.shared){   // 협공 참가자 — 필드전투는 같은 칸에 있는 동료, 무리전(horde)은 파티 전원
    const cell=ADV_COMBAT.cell||'', M=partyMembers();
    for(const uid in M){ if(uid===myUid()) continue;
      if(ADV_COMBAT.field){ const c=advMateCoord(uid); if(!c || (c.x+','+c.y)!==cell) continue; }
      list.push({name:(M[uid].charName||M[uid].nick||'동료'), agi:(M[uid].charInfo&&+M[uid].charInfo.agi)||0, uid:uid});
    }
  }
  list.push({name:e.name, agi:e.agi, enemy:true});
  list.sort((a,b)=> (b.agi-a.agi) || (a.enemy?1:-1));   // 민첩 동률이면 아군이 앞(동점 시 선공)
  // 현재 차례 = ① 방금 행동한 동료(잠깐) → ② 적 차례 → ③ 나(입력 대기 중인 사람).
  let curIdx=0;
  const actI = ADV_COMBAT.actUid ? list.findIndex(x=>x.uid===ADV_COMBAT.actUid) : -1;
  if(actI>=0) curIdx=actI;
  else if(ADV_COMBAT.phase==='enemy'){ const ei=list.findIndex(x=>x.enemy); if(ei>=0) curIdx=ei; }
  else { const mi=list.findIndex(x=>x.me); const ai=list.findIndex(x=>!x.enemy); curIdx = mi>=0?mi:(ai>=0?ai:0); }
  const chips=list.map((x,i)=>{
    const cls='adv-turn-chip'+(x.enemy?' enemy':'')+(x.me?' me':'')+(i===curIdx?' now':'');
    return '<span class="'+cls+'">'+esc(x.name)+'</span>';
  }).join('<span class="adv-turn-arrow">›</span>');
  const spect=(ADV_COMBAT.shared && ADV_COMBAT.spectators)?('<span class="adv-turn-spect">관전 '+ADV_COMBAT.spectators+'</span>'):'';
  return '<div class="adv-turn-order"><span class="adv-turn-lb">순서</span>'+chips+spect+'</div>';
}
function advRecalcInitiative(cellKey, joinerUid){
  if(!ADV_COMBAT) return;
  const e=ADV_ENEMIES[ADV_COMBAT.ekey]; if(!e) return;
  const b=advPartyBestAgi(cellKey||ADV_COMBAT.cell||'');
  const was=!!ADV_COMBAT.pFirst;
  ADV_COMBAT.pFirst = b.agi>=e.agi;
  const jn = joinerUid ? advFieldName(joinerUid) : '동료';
  ADV_COMBAT.log.push('<p class="sys">'+esc(jn)+' 합류 — 순서 재계산: '
    +(ADV_COMBAT.pFirst?('<span class="good">우리가 먼저</span> (최속 '+esc(b.who)+' 민첩 '+b.agi+' vs 적 '+e.agi+')')
                       :('<span class="bad">적이 먼저</span> (최속 '+esc(b.who)+' 민첩 '+b.agi+' vs 적 '+e.agi+')'))
    +(was!==ADV_COMBAT.pFirst?' — 선공이 바뀌었다!':'')+'</p>');
}
function advOfferCombatJoin(cn, cellKey){   // 도착 감지 → 3선택지
  const e=(cn&&ADV_ENEMIES[cn.ekey])||{}; const who=advFieldName(cn&&cn.initiator);
  advPrompt('<p><span class="loc">[ 교전 중 ]</span></p>'
    +'<p><span class="good">'+esc(who)+'</span>'+(typeof advJosa==='function'?advJosa(who,'이','가'):'이(가)')+' '+(e.icon||'')+' '+esc(e.name||'적')+'와(과) 싸우고 있다.</p>'
    +'<p class="sys">적 HP '+Math.max(0,cn?cn.ehp:0)+'/'+((cn&&cn.ehpMax)||'?')+'</p>',
    [ {label:'⚔ 끼어든다', cls:'adv-reveal', on:()=>advJoinCombat(PARTY.combatNode||cn, cellKey)},
      {label:'👁 관전', on:()=>advSpectateCombat(PARTY.combatNode||cn, cellKey)},
      {label:'🏃 물러난다', on:advRetreatFromTile} ]);
}
function advJoinCombat(cn, cellKey){   // 끼어들기 — 현재 공유 ehp 이어받아 협공(결정A: 재스케일 없음)
  if(!cn || cn.active===false || !(typeof cn.ehp==='number' && cn.ehp>0)){ advToast('이미 정리된 전투예요'); advOpenMove(); return; }
  const e=ADV_ENEMIES[cn.ekey]; if(!e){ advOpenMove(); return; }
  const s=activeSlot();
  advClearPhaseTimer();
  ADV_COMBAT={ekey:cn.ekey, ehp:cn.ehp, ehpMax:cn.ehpMax||e.hp, pFirst:(statEff(s,'agi')>=e.agi), log:[], shared:true, field:true, cell:cellKey, parts:(cn.parts||1)+1, phase:'player'};
  ADV_COMBAT.log.push('<p class="sys">교전에 뛰어들었다! 함께 적을 노린다.</p>');
  advRecalcInitiative(cellKey, myUid());   // ★ 합류 시점부터 턴 순서 재계산
  advPublishCombat({parts:ADV_COMBAT.parts, active:true});
  advSubscribeCombat();
  advSave(); advRenderSim(); advCombatRender();
}
function advSpectateCombat(cn, cellKey){   // 관전 — 피격·데미지 없음, 노드 갱신마다 갱신
  ADV._combatSpectate={cell:cellKey};
  advSubscribeCombat();
  advRenderCombatSpectate(cn);
}
function advRenderCombatSpectate(data){
  const e=(data&&ADV_ENEMIES[data.ekey])||{}; const who=advFieldName(data&&data.initiator);
  advPrompt('<p><span class="loc">[ 관전 ]</span></p>'
    +'<p><span class="good">'+esc(who)+'</span>의 교전을 지켜본다.</p>'
    +'<p><span class="bad">'+(e.icon||'')+' '+esc(e.name||'적')+'</span> HP '+Math.max(0,data?data.ehp:0)+'/'+((data&&data.ehpMax)||'?')+'</p>',
    [ {label:'⚔ 끼어든다', cls:'adv-reveal', on:()=>{ const cell=ADV._combatSpectate&&ADV._combatSpectate.cell; ADV._combatSpectate=null; advJoinCombat(PARTY.combatNode||data, cell||(data&&data.cell)||''); }},
      {label:'🏃 물러난다', on:()=>{ ADV._combatSpectate=null; advRetreatFromTile(); }} ]);
}
function advRetreatFromTile(){   // 물러난다 — 직전 칸으로 복귀(미개입)
  const prev=ADV.map && ADV.map._prev;
  if(prev && typeof prev.x==='number' && typeof prev.y==='number'){ ADV.map.pos={x:prev.x,y:prev.y}; advSave(); advSyncMyCoord(); }
  advOpenMove();
}
function advFieldSharedWin(killer){   // 다른 참가자가 막타 → 로컬 마무리(참가자 킬 크레딧, 전리품은 막타자만)
  advClearPhaseTimer();   // ★ 동료가 먼저 끝냈다 → 내 적 차례 예약 취소
  if(ADV_COMBAT){ advForgetWounded(ADV_COMBAT.wcell); advClearCombatCell(ADV_COMBAT.wcell); }   // 처치됐으니 칸 정리
  advEndSharedCombat();
  const who=advFieldName(killer);
  ADV_COMBAT=null; advSave(); advRenderSim();
  advPrompt('<p class="good">'+esc(who)+'가 적을 쓰러뜨렸다! 함께 정리했다.</p>', [{label:'🚶 나아간다', cls:'adv-reveal', on:advOpenMove}]);
}
function advSharedWin(killer){
  if(!ADV_COMBAT) return;
  advClearPhaseTimer();   // ★ 적 차례 예약 취소
  advForgetWounded(ADV_COMBAT.wcell); advClearCombatCell(ADV_COMBAT.wcell);
  ADV_COMBAT._won=true; ADV_COMBAT.killer=killer;
  const parts=ADV_COMBAT.parts||partyCount();
  ADV._inReward=true;
  if(iAmLeader() && !ADV._rewards){ const rw=advGenRewards(parts); ADV._rewards=rw; advPublishCombat({rewards:rw, phase:'reward', active:false}); }
  advRenderRewards(killer);
}
/* ─── D#5 전투 보상 선택제: 공유전투 승리 시 전리품 풀을 나열 → 각자 골라 집기(이름태그) ─── */
const ADV_BOSS_REWARDS=['vest','guard','med','med','bat','can','flash'];
function advGenRewards(parts){
  const out=[], n=Math.max(1, parts||1);   // 인원수만큼 전리품
  for(let i=0;i<n;i++){ const id=ADV_BOSS_REWARDS[Math.floor(Math.random()*ADV_BOSS_REWARDS.length)]; out.push({item:id, by:null}); }
  return out;
}
function advRewardWho(by){ if(!by) return null; if(by===myUid()) return '나';
  const m=partyMembers()[by]; return (m&&(m.charName||m.nick))||'동료'; }
function advRenderRewards(killer){
  const rw=ADV._rewards||[];
  const km=killer&&partyMembers()[killer], kn=(killer===myUid())?'나':((km&&(km.charName||km.nick))||'동료');
  let html='<p><span class="loc">[ 전투 보상 ]</span></p>'
    +'<p class="crit">🏁 막타 — '+esc(kn)+'!</p>'
    +'<p class="sys">전리품을 나눠 갖는다. 원하는 것을 집으세요. ('+rw.length+'개)</p>';
  rw.forEach(r=>{ const it=ADV_WORLD.items[r.item]||{}; const who=advRewardWho(r.by);
    html+='<p>'+(it.icon||'📦')+' '+esc(it.name||r.item)+(who?' <span class="good">— '+esc(who)+'</span>':' <span class="sys">(비어있음)</span>')+'</p>'; });
  const btns=[];
  rw.forEach((r,i)=>{ if(!r.by){ const it=ADV_WORLD.items[r.item]||{}; btns.push({label:'✋ '+(it.icon||'📦')+' '+(it.name||r.item), on:()=>advClaimReward(i)}); } });
  btns.push({label:'▶ 완료 (계속)', cls:'adv-reveal', on:advFinishRewards});
  advPrompt(html, btns);
}
function advClaimReward(i){
  const rw=(ADV._rewards||[]).slice(); if(!rw[i] || rw[i].by) return;
  rw[i]=Object.assign({}, rw[i], {by:myUid()}); ADV._rewards=rw;
  advGiveItem(rw[i].item);   // 내 인벤에 추가(방어구면 착용)
  advPublishCombat({rewards:rw});
  advRenderRewards(ADV_COMBAT && ADV_COMBAT.killer);
}
function advFinishRewards(){
  ADV._inReward=false; advClearPhaseTimer();
  const wasBoss = !!(ADV_COMBAT && ADV_ENEMIES[ADV_COMBAT.ekey] && ADV_ENEMIES[ADV_COMBAT.ekey].boss);
  advEndSharedCombat(); ADV._rewards=null;
  if(wasBoss){ advBossVictory(); }   // 전원 카드키 스토리(+킬10) — ADV_COMBAT은 advBossVictory에서 정리
  else { ADV_COMBAT=null; advSave(); advRenderSim(); advOpenMove(); }
}
/* ★ 요청1: 후퇴해도 적의 상처가 남는다 — 칸 단위로 적 상태를 기억(ADV.map.wounded)
   완전히 쓰러뜨렸을 때만 지운다. 보스(무리)·공유 전투는 별도 슬롯이 있으므로 제외.
   ADV.map에 얹으므로 저장되고(껐다 켜도 유지), 세션이 끝나 맵이 리셋되면 같이 사라진다. */
function advWoundKey(){ return ADV.map && ADV.map.pos ? (ADV.map.pos.x+','+ADV.map.pos.y) : ''; }
function advRememberWounded(){   // 후퇴 시 호출 — 남은 HP를 그 칸에 기록
  if(!ADV_COMBAT || !ADV_COMBAT.wcell || ADV_COMBAT.shared || ADV_COMBAT.field) return;
  if(!(ADV_COMBAT.ehp>0)) return;
  ADV.map.wounded=ADV.map.wounded||{};
  ADV.map.wounded[ADV_COMBAT.wcell]={ekey:ADV_COMBAT.ekey, ehp:ADV_COMBAT.ehp};
}
function advForgetWounded(cell){   // 처치 시 호출 — 그 칸의 기록 제거
  if(cell && ADV.map && ADV.map.wounded){ delete ADV.map.wounded[cell]; }
}
function advClearCombatCell(cell){   // 처치했을 때만 '밟은 칸'으로 확정(= 다시 와도 적이 없다)
  if(!cell || !ADV.map) return;
  const st=(ADV.map.stepped=ADV.map.stepped||[]);
  if(!st.includes(cell)) st.push(cell);
}
function advStartCombat(band, forceKey){
  advClearPhaseTimer();   // ★ 이전 전투의 적 차례 예약이 남아있지 않게
  const m=advEnsureMap();
  const wcell=advWoundKey();
  const wnd=(ADV.map.wounded||{})[wcell];
  // 같은 칸에 물러섰던 적이 남아 있으면 그놈을 이어서 상대한다(종류 지정 전투면 종류가 같을 때만)
  const resume = (wnd && ADV_ENEMIES[wnd.ekey] && !ADV_ENEMIES[wnd.ekey].boss && wnd.ehp>0
                  && (!forceKey || forceKey===wnd.ekey)) ? wnd : null;
  const ekey=resume?resume.ekey:(forceKey||advPickEnemy(band));
  const e=ADV_ENEMIES[ekey];
  const s=activeSlot();
  const pFirst = statEff(s,'agi') >= e.agi;
  ADV_COMBAT={ekey, ehp:(resume?resume.ehp:e.hp), pFirst, log:[], phase:'player'};   // ★ phase: 'player'=내 입력 대기 / 'enemy'=적 차례 자동 진행
  if(!e.boss) ADV_COMBAT.wcell=wcell;   // 이 칸의 적 — 후퇴하면 여기에 상처가 기록된다
  // 조우 씬 문구 (테마 우선)
  const themeKey=m.themes[Math.min(2,band)];
  const cands=ADV_POOLS.combat.filter(c=>c.theme===themeKey);
  const pool=cands.length?cands.concat(ADV_POOLS.combat.filter(c=>!c.theme)):ADV_POOLS.combat.filter(c=>!c.theme);
  const sc=pool[Math.floor(Math.random()*pool.length)];
  ADV_COMBAT.log.push('<p>'+sc.intro.replace('{E}', e.icon+' '+e.name)+'</p>');
  if(resume) ADV_COMBAT.log.push('<p class="sys">아까 물러섰던 그 '+e.name+'다. 상처가 그대로 남아 있다. (HP '+resume.ehp+'/'+e.hp+')</p>');
  if(!pFirst) ADV_COMBAT.log.push('<p class="sys">'+e.name+'이(가) 더 빠르다. 먼저 움직여야 한다.</p>');
  // D#4: 스토리 보스(좀비 무리)를 파티가 함께 → 공유 전투(적 HP ×인원)
  if(forceKey==='horde' && advIsParty() && partyCount()>1 && advHostCombat()){
    ADV_COMBAT.shared=true; ADV_COMBAT.parts=partyCount();
    ADV_COMBAT.ehp=ADV_COMBAT.ehpMax=e.hp*ADV_COMBAT.parts;
    ADV_COMBAT.log.push('<p class="sys">동료 '+ADV_COMBAT.parts+'명과 함께 맞선다! (좀비 무리 HP ×'+ADV_COMBAT.parts+')</p>');
    if(iAmLeader()) advPublishCombat({ekey:forceKey, ehp:ADV_COMBAT.ehp, ehpMax:ADV_COMBAT.ehpMax, active:true, killer:'', field:false, cell:'', initiator:''});   // ★ field/cell 명시 초기화: advWriteCombat은 update(병합)이라 이전 필드전투의 cell이 남아 보스전에 '끼어들기'가 잘못 뜰 수 있음
    advSubscribeCombat();
  }
  else if(ADV._fieldCell && advIsParty() && partyCount()>1 && advHostCombat()){   // ★ #3: 파티 필드전투 → 공유 슬롯 게시(합류 가능). 결정A: 일반 HP·재스케일 없음.
    ADV_COMBAT.shared=true; ADV_COMBAT.field=true; ADV_COMBAT.cell=ADV._fieldCell; ADV_COMBAT.parts=1; ADV_COMBAT.ehpMax=e.hp;
    advPublishCombat({ekey, ehp:ADV_COMBAT.ehp, ehpMax:e.hp, active:true, killer:'', field:true, cell:ADV._fieldCell, initiator:myUid(), parts:1});
    advSubscribeCombat();
    ADV_COMBAT.log.push('<p class="sys">같은 칸에 도착한 동료가 합류할 수 있다.</p>');
  }
  advCombatRender();   // 선공 없음 — [공격한다]를 눌러야 교전 시작
}
function advCombatRender(){
  if(!ADV_COMBAT) return;
  if(ADV.hp<=0){ advCombatDeath(); return; }   // 안전망
  const e=ADV_ENEMIES[ADV_COMBAT.ekey];
  const ehpMax=ADV_COMBAT.ehpMax||e.hp;
  const hpBar='<p><span class="bad">'+e.icon+' '+e.name+'</span> HP '+Math.max(0,ADV_COMBAT.ehp)+'/'+ehpMax
    +(e.boss?' <span class="crit">[BOSS]</span>':'')+(ADV_COMBAT.shared?' <span class="sys">·협공 '+ADV_COMBAT.parts+'인</span>':'')+'</p>';
  let banner='';
  if(ADV.story && ADV.story.ret){   // 스토리에서 전환된 전투 → 페이즈 배너
    const pct=Math.max(0,Math.min(100,Math.round(ADV_COMBAT.ehp/ehpMax*100)));
    banner=advPhaseBanner('combat', e.icon+' '+e.name+' <span class="adv-gauge hp"><i style="width:'+pct+'%"></i></span>');
  }
  // ★ 자가 복구: 적 차례인데 예약된 타이머가 없다 = 어떤 이유로든 차례가 끊긴 상태.
  //   그대로 두면 '⏳ 적의 차례…'에서 버튼이 잠긴 채 영영 멈춘다(2인 테스트 제보). 내 차례로 되돌린다.
  if(ADV_COMBAT.phase==='enemy' && !_advPhaseT) ADV_COMBAT.phase='player';
  const ePhase=(ADV_COMBAT.phase==='enemy');   // ★ 적 차례 — 버튼 잠금 + 대기 문구(로그엔 안 남김)
  const wait=ePhase?('<p class="sys adv-eturn">'+(e.icon||'')+' '+esc(e.name)+advJosa(e.name,'이','가')+' 움직인다…</p>'):'';
  const html=banner+hpBar+advOrderStripHtml()+'<hr style="border-color:#333">'+ADV_COMBAT.log.slice(-10).join('')+wait;
  advPrompt(html, [
    {label:ePhase?'⏳ 적의 차례…':'⚔ 공격한다', cls:ePhase?'adv-locked':'adv-reveal', on:advCombatAttack, dis:ePhase},
    {label:'🏃 후퇴한다', on:advCombatRetreat, dis:ePhase},
  ]);
  if(document.getElementById('advMovePanel')) advRenderMoveNav();   // 전투 중 이동 패널 비활성 즉시 반영
}
/* ─── ★ 전투 턴 페이즈화 — 적 차례를 별도 페이즈로 분리 ────────────────────────────
   ADV_COMBAT.phase: 'player'(내 입력 대기) | 'enemy'(적 차례 자동 진행). ADV_COMBAT은 비영속이라 저장되지 않는다.
   한 라운드([공격한다] 1회 = 기력 -1)에 들어가는 판정·데미지·감염·내구도는 예전과 완전히 동일하다.
   달라진 건 표현뿐: 적 차례 동안 순서 표시줄의 노란 테두리가 적으로 옮겨가고 버튼이 잠기며,
   ADV_PHASE_MS 뒤에 적 공격 스크립트가 자동으로 출력된다.
   타이머는 모듈 변수 _advPhaseT에 둔다(ADV_COMBAT이 null이 된 뒤에도 취소 가능해야 하므로).
   콜백은 시작 시점의 ADV_COMBAT 객체와 같은지 확인해 유령 타이머를 스스로 무시한다(이 게임의 고질 패턴 방지). */
const ADV_PHASE_MS=850;
let _advPhaseT=null;
let _advActT=null;   // 동료 차례 강조를 되돌리는 타이머
function advClearPhaseTimer(){
  if(_advPhaseT){ clearTimeout(_advPhaseT); _advPhaseT=null; }
  if(_advActT){ clearTimeout(_advActT); _advActT=null; }
}
function advEnemyPhase(after){
  if(!ADV_COMBAT) return;
  const cRef=ADV_COMBAT;
  advClearPhaseTimer();
  ADV_COMBAT.phase='enemy';
  // ★ 타이머를 렌더보다 먼저 건다. 렌더가 예외로 죽더라도 적 차례는 반드시 진행되게 —
  //   예전 순서(렌더 → 타이머)에서는 렌더 중 예외가 나면 phase가 'enemy'로 굳어 버튼이 영영 잠겼다.
  _advPhaseT=setTimeout(()=>{
    _advPhaseT=null;
    if(ADV_COMBAT!==cRef) return;          // 그 사이 전투가 끝났거나 다른 전투로 교체됨 → 무시
    try{ advEnemyTurn(); }                 // 적 공격 스크립트(판정·데미지·감염) — 로직은 손대지 않음
    catch(err){ try{ console.error('[좀아칼] 적 차례 오류', err); }catch(_){}
      ADV_COMBAT.log.push('<p class="sys">적이 잠시 주춤한다.</p>'); }
    if(ADV_COMBAT!==cRef) return;
    ADV_COMBAT.phase='player';             // 무슨 일이 있어도 내 차례로 돌려놓는다
    if(ADV.hp<=0){ advCombatDeath(); return; }
    try{ if(typeof after==='function') after(); }
    catch(err){ try{ console.error('[좀아칼] 턴 마무리 오류', err); }catch(_){} advCombatRender(); }
  }, ADV_PHASE_MS);
  advCombatRender();                       // 테두리가 적으로 이동 + 입력 잠금
}
function advPlayerStrike(){
  const e=ADV_ENEMIES[ADV_COMBAT.ekey];
  const r=advTierRoll(e.dc);
  const atk=advPAtk(ADV_COMBAT.ekey);
  let dmg=0, line='';
  const _tag=advRollTag(r)+' → '+advGradeLabel(r.tier);   // ★ #8: (나온값/목표값) + 5단계 등급
  if(r.tier==='대실패'){ ADV.hp=Math.max(0,ADV.hp-1); line=_tag+' — 헛손질에 균형을 잃었다. (HP -1)'; }
  else if(r.tier==='대성공'){ dmg=Math.round(atk*3); line=_tag+' — 회심의 일격! '+dmg+' 피해!'; }
  else if(r.tier==='크리티컬'){ dmg=Math.round(atk*1.5); line=_tag+' — 깊게 파고들었다. '+dmg+' 피해!'; }
  else if(r.tier==='명중'){ dmg=Math.round(atk); line=_tag+' — '+dmg+' 피해.'; }
  else { line=_tag+' — 빗나갔다!'; }
  ADV_COMBAT.log.push('<p>'+line+'</p>');
  ADV_COMBAT.ehp-=dmg;
  if(ADV_COMBAT.shared){   // D#4: 공유 적HP 갱신 게시(동시타 레이스는 last-write-wins — 라이브 테스트로 확인)
    const newE=Math.max(0,ADV_COMBAT.ehp); const patch={ehp:newE};
    if(newE<=0){ patch.active=false; patch.killer=myUid(); }
    advPublishCombat(patch);
    // ★ 2인 테스트 제보: 동료 차례에 아무 반응이 없고 적 HP만 줄었다 → 판정 결과가 공유되지 않았기 때문.
    //   HP 패치와 '따로' 쓴다. 규칙이 이 필드를 막아도 기존 HP 동기화는 그대로 살아있게 하려는 것.
    advPublishCombatAct(String(line).replace(/<[^>]+>/g,'').slice(0,160));
  }
  advUseWeaponDur(dmg>0);
}
function advCombatAttack(){
  if(!ADV_COMBAT) return;
  if(ADV_COMBAT.phase==='enemy') return;   // ★ 적 차례엔 입력 무시(연타 방지)
  advSpendSt(1);   // ★ #9: 전투 1턴 = 기력 -1 (라운드 단위 — 페이즈화 후에도 클릭 1회당 1)
  // 민첩 순서대로 한 라운드 진행 (선공 없음 — 이 버튼을 눌러야 시작)
  if(ADV_COMBAT.pFirst){
    advPlayerStrike();
    if(ADV_COMBAT.ehp<=0){ advCombatWin(); return; }
    if(ADV.hp<=0){ advCombatDeath(); return; }   // 대실패 자해로 쓰러진 경우
    advSave(); advRenderSim();
    advEnemyPhase(()=>{ advSave(); advRenderSim(); advCombatRender(); });
  }else{
    advSave(); advRenderSim();
    advEnemyPhase(()=>{   // 적 선공 — 적 차례가 끝난 뒤 내 공격
      advPlayerStrike();
      if(ADV_COMBAT.ehp<=0){ advCombatWin(); return; }
      if(ADV.hp<=0){ advCombatDeath(); return; }
      advSave(); advRenderSim(); advCombatRender();
    });
  }
}
function advEnemyTurn(){
  const e=ADV_ENEMIES[ADV_COMBAT.ekey];
  const hits = e.boss ? 1 : 1;   // 파티 스케일(인원수 공격)은 파티 차수에서
  for(let i=0;i<hits;i++){
    const roll=advD20();
    if(roll>e.hitDc){ ADV_COMBAT.log.push('<p class="sys">'+e.name+'의 공격 🎲'+roll+' — 빗나갔다. 아슬아슬하게 피했다!</p>'); continue; }
    const dmg=Math.max(1, Math.round(e.atk - advPDef()));
    const ap=advApplyDamage(dmg);
    let ln=e.name+'의 공격 🎲'+roll+' — ';
    if(ap.absorbed>0 && ap.toHp>0) ln+='<span class="sys">🛡 '+ap.absorbed+' 방어</span> · <span class="bad">'+ap.toHp+' 피해</span>.';
    else if(ap.absorbed>0) ln+='<span class="sys">🛡 '+ap.absorbed+' 방어</span>로 막아냈다.';
    else ln+='<span class="bad">'+ap.toHp+' 피해</span>를 입었다.';
    if(e.infect){
      // 감염 롤 — 키퍼(솔로=항체 보유자)는 면역
      if(advIsKeeperNow()){ ln+=' <span class="sys">…항체가 감염을 태워버린다.</span>'; }
      else{
        const avoid=advInfAvoid();
        if(Math.random()*100>=avoid){ const gain=10+Math.floor(Math.random()*6); ADV.inf=Math.min(100,ADV.inf+gain);
          ln+=' <span class="bad">감염 +'+gain+'%!</span>'; }
        else ln+=' <span class="sys">감염은 피했다. ('+Math.round(avoid)+'%)</span>';
      }
    }
    ADV_COMBAT.log.push('<p>'+ln+'</p>');
  }
}
function advUseWeaponDur(hit){
  if(!hit) return;
  const s=activeSlot(); const w=s&&s.weapon; if(!w||w.dur<=0) return;
  w.dur--;
  if(w.dur<=0){ const it=ADV_WORLD.items[w.id];
    if(ADV_COMBAT) ADV_COMBAT.log.push('<p class="bad">'+((it&&it.name)||'무기')+'이(가) 부러졌다!</p>'); }
}
function advIsKeeperNow(){ return PARTY.mode!=='together' || iAmLeader(); }   // 솔로=키퍼 / 파티=방장(항체 보유자)만 면역, crew는 감염 가능
function advCombatWin(){
  advClearPhaseTimer();   // ★ 적 차례 예약 취소(유령 타이머 방지)
  if(ADV_COMBAT && ADV_COMBAT.field){   // ★ #3: 필드 협공 막타 — 공유 슬롯 종료 통지 후 로컬 승리(전리품은 막타자)
    advPublishCombat({active:false, killer:myUid()});
    advEndSharedCombat();
    ADV_COMBAT.shared=false; ADV_COMBAT.field=false;   // 아래 일반(로컬) 승리 처리로 진행
  }
  if(ADV_COMBAT && ADV_COMBAT.shared){ ADV_COMBAT._won=true; advSharedWin(myUid()); return; }   // D#4: 내가 막타
  const e=ADV_ENEMIES[ADV_COMBAT.ekey], ekey=ADV_COMBAT.ekey;
  const s=activeSlot();
  if(e.boss){ advBossVictory(); return; }   // 보스=무리: 전용 스토리 스크립트 → 카드키
  let out='<p><span class="good">'+e.icon+' '+e.name+'을(를) 쓰러뜨렸다!</span></p>';
  if(ekey==='outlaw'){
    s.outlaws=(s.outlaws||0)+1;
    ADV.runOutlaws=(ADV.runOutlaws||0)+1;   // 세션 전용(보고서용)
    out+=advCheckTitleUnlock(s,'outlaws');
    out+='<p class="sys">인간을 상대로 한 승리다. 뒷맛이 쓰다. (무법자 처치 '+s.outlaws+')</p>';
  }else{
    const gain=e.boss?10:1;
    out+=advAddKill(gain);
    if(e.boss) out+='<p class="crit">보스 처치! 전원 킬 카운트 +10</p>';
  }
  const loot=advRollLoot(ekey);
  if(loot){ advGrantItem(loot,1);   // ★ #4: 무기면 ADV.weapons로(장착 가능)
    const it=ADV_WORLD.items[loot];
    out+='<p class="good">'+(it.icon||'📦')+' '+it.name+'을(를) 손에 넣었다!'+(it.weapon?' (더블클릭으로 장착)':'')+'</p>'; }
  const scrap=advRollScrap(ekey);   // ★ 요청2: 희박한 확률로 조합 재료가 더 나온다
  if(scrap){ advGrantItem(scrap,1);
    const si=ADV_WORLD.items[scrap];
    out+='<p class="good">'+si.icon+' 잔해를 뒤지다 '+si.name+'을(를) 챙겼다.</p>'; }
  advForgetWounded(ADV_COMBAT.wcell);   // ★ 완전히 처리했으니 이 칸의 적 기록을 지운다
  advClearCombatCell(ADV_COMBAT.wcell);  // ★ 이제서야 '지나온 칸'으로 확정(무시·후퇴로는 소비되지 않는다)
  ADV_COMBAT=null;
  advSave(); advRenderSim();
  if(advStoryAfterCombat('win', out)) return;   // 스토리 전투였으면 그 씬으로 복귀
  advPrompt(out, []);   // 이동은 우측 패널(#2)
}
function advStoryAfterCombat(kind, txt){   // 스토리 발 전투 종료 → 지정 비트로 복귀 (kind:'win'|'flee')
  if(!(ADV.story && ADV.story.ret)) return false;
  const to = kind==='win' ? ADV.story.ret.onWin : ADV.story.ret.onFlee;
  ADV.story.ret=null; advSave();
  advPrompt(txt, [ {label:'▶ 계속', cls:'adv-reveal', on:()=>{ if(!to||to==='end') advEndStory(); else advGotoStoryBeat(to,''); }} ]);
  return true;
}
/* 🧟‍♀️ 보스(좀비 무리) 승리 — 2비트 스토리 스크립트 → 연구소 카드키 */
function advBossVictory(){
  advAddKill(10);   // 전원 킬 카운트 +10 (알림은 스크립트에 녹임)
  ADV_COMBAT=null; advSave(); advRenderSim();
  advPrompt(
    '<p>마지막 한 마리가 버티지 못하고 쓰러졌다.</p>'
    +'<p>교전 끝에 힘이 풀리고 손 끝이 미세하게 떨려와 주먹을 쥐었다.</p>'
    +'<p class="sys">무리를 모두 정리했다. 도륙난 살점들이 뿜어내는 썩은 냄새에 코가 익숙해진지 오래였다.</p>',
    [ {label:'🔍 안을 뒤진다', cls:'adv-reveal', on:advBossLoot} ]);
}
function advBossLoot(){
  ADV.inv.labkey=(ADV.inv.labkey||0)+1;
  advSave(); advRenderSim();
  const it=ADV_WORLD.items.labkey;
  advPrompt(
    '<p>흩뿌려지고 응고된 피와 시체들 사이를 뒤진다. 핏물에 적셔진 의사 가운을 입은 시체를 발견했다.</p>'
    +'<p class="good">안주머니를 뒤적이자 '+(it.icon||'💳')+' '+it.name+'를 손에 넣었다.</p>'
    +'<p class="sys">이제 목표 지점이었던 <span class="good">▲▣ 연구소</span>에 들어갈 수 있다.</p>',
    []);   // 이동은 우측 패널(#2)
}
function advCombatRetreat(){
  if(!ADV_COMBAT) return;
  if(ADV_COMBAT.phase==='enemy') return;   // ★ 적 차례엔 입력 무시
  const e=ADV_ENEMIES[ADV_COMBAT.ekey];
  const doRoll=()=>{
    const s=activeSlot();
    const roll=advD20(), eff=roll-Math.floor((statEff(s,'agi')+statEff(s,'luk'))/2);
    if(eff<=12){
      advClearPhaseTimer();
      advRememberWounded();   // ★ 요청1: 후퇴해도 적의 남은 HP는 그 칸에 남는다
      advEndSharedCombat(); ADV_COMBAT=null; advSave(); advRenderSim();
      const rtxt='<p><span class="roll">🎲'+roll+'</span> <span class="good">후퇴 성공!</span> 어둠 속으로 빠져나왔다.</p>';
      if(advStoryAfterCombat('flee', rtxt)) return;   // 스토리 전투였으면 복귀(보통 씬 종료=밖으로)
      advPrompt(rtxt, []);   // 이동은 우측 패널(#2)
    }else{
      ADV_COMBAT.log.push('<p><span class="roll">🎲'+roll+'</span> <span class="bad">후퇴 실패!</span> 길이 막혔다 — 싸울 수밖에 없다.</p>');
      advEnemyPhase(()=>{ advSave(); advRenderSim(); advCombatRender(); });   // ★ 반격도 적 차례 페이즈로
    }
  };
  if(e.boss){
    advPrompt('<p class="bad">⚠️ 후퇴하면 무리가 재집결합니다 — 보스 HP가 초기화됩니다.</p><p>그래도 후퇴할까?</p>',
      [ {label:'🏃 후퇴한다 (민첩·운 판정)', on:doRoll},
        {label:'⚔ 계속 싸운다', cls:'adv-reveal', on:advCombatRender} ]);
  } else doRoll();
}
const ADV_EPILOGUE_SOLO=[
  '당신은 차가운 아스팔트 위에서 천천히 눈을 감았다.',
  '라디오는 여전히 울리고 있지만, 이제 당신은 듣지 못한다.',
  '당신이 걸어온 거리만이, 당신을 기억할 것이다.',
  '항체는 끝내 연구소에 닿지 못했다. 도시는 계속 가라앉는다.',
];
function advCombatDeath(){
  advClearPhaseTimer();   // ★ 적 차례 예약 취소
  advEndSharedCombat(); ADV_COMBAT=null;
  // ★ 파티 사망 정리(버그2): 파티장 사망 → 파티 해산(팀원 세션 종료 신호) / 파티원 사망 → 명단에서 이탈
  if(advIsParty() && PARTY.pid){
    const pid=PARTY.pid, leader=iAmLeader();
    try{ PARTY.unsubParty&&PARTY.unsubParty(); }catch(_){}   // 내 사망화면이 해산 콜백에 덮이지 않게 먼저 구독 해제
    PARTY.unsubParty=null; PARTY.pid=null; PARTY.data=null; ADV.partyPid=null;
    if(fbReady()){
      if(leader){
        if(firebaseAPI.advUpdateMember){ try{ firebaseAPI.advUpdateMember(pid, myUid(), {ended:'dead'}); }catch(_){} }   // 종료 사유 전달(팀원 문구 분기)
        if(firebaseAPI.advDisbandParty){ try{ firebaseAPI.advDisbandParty(pid); }catch(_){} }
      }
      else if(!leader && firebaseAPI.advLeaveParty){ try{ firebaseAPI.advLeaveParty(pid, myUid()); }catch(_){} }
    }
  }
  advSave(); advRenderSim();
  const epi=ADV_EPILOGUE_SOLO[Math.floor(Math.random()*ADV_EPILOGUE_SOLO.length)];
  advPrompt('<p class="bad">시야가 흐려진다… 당신은 쓰러졌다.</p><p class="sys">'+epi+'</p>',
    [ {label:'📄 결과 보고서', cls:'adv-reveal', on:()=>advShowReport('bad')} ]);
}

/* 🧭 탐색 프롬프트 — 탐색 페이즈의 기본 화면. 씬이 끝나면 여기로 복귀. */
function advShowExplorePrompt(first){
  if(ADV.hp<=0){ advCombatDeath(); return; }   // 안전망
  const m=advEnsureMap();
  const band=Math.min(2, Math.floor(ADV.map.pos.x/10));
  const themeName=ADV_THEMES[m.themes[band]].name;
  let html='';
  if(first){
    html+='<p><span class="loc">[ '+themeName+' — 어딘가 ]</span></p>'
      +'<p>눈을 뜨니 낯선 거리다. 라디오가 말한 <span class="good">▲▣</span>은 동쪽 — 해가 뜨는 방향이다.</p>'
      +'<p class="sys">지도(🗺️)로 지형을 확인하고, 이동하며 물자를 모으자. 동쪽 끝, 연구소까지.</p>'
      +'<p class="bad">★캠프에 도착할 때까지 파티 결성이 어렵습니다.</p>';
  }else{
    html+='<p><span class="loc">[ '+themeName+' ]</span></p><p class="sys">주위는 고요하다. 어디로 갈까.</p>';
  }
  advPrompt(html, []);   // 선택지 없음 — 이동은 우측 패널에서, 이벤트 선택지만 가운데 하단에
  ADV._onExplore=true;   // 지금 탐색 화면
  advRenderMoveNav();    // 우측 이동 패널(상시)
  advUpdateChatPanel();  // 하단 채팅 패널(파티 상시 · 토글 없음)
}
// 하단 채팅 패널 — 파티(2인+)면 상시 표시, 솔로면 숨김. 입력은 한 번만 바인딩(입력 중 깜빡임/입력불가 방지 = 버그5 수정)
function advUpdateChatPanel(){
  const panel=document.getElementById('advChatPanel'); if(!panel) return;
  const inParty = advIsParty() && partyCount()>1;
  if(!inParty || !PARTY.started){ panel.classList.add('hidden'); panel.innerHTML=''; return; }   // 로비(시작 전)·솔로 → 숨김
  panel.classList.remove('hidden');
  const near=advNearMates();
  const nearHtml = near.length ? ('📡 근처에 동료: '+near.map(mt=>'<span style="color:'+mt.color+'">●</span>'+esc(mt.name)).join(' ')) : '';
  if(document.getElementById('advChatInput')){   // 이미 바인딩됨 → 메시지·근접표시만 갱신(입력 유지)
    const nb=document.getElementById('advChatNear'); if(nb) nb.innerHTML=nearHtml;
    advRenderChatBox(); return;
  }
  panel.innerHTML='<div class="adv-chat-near" id="advChatNear"></div>'+advChatBoxHtml();
  const nb=document.getElementById('advChatNear'); if(nb) nb.innerHTML=nearHtml;
  advBindChat();
}
// 좌표/근접 변화 시 채팅 패널 갱신(입력은 유지)
function advRefreshExploreChat(){ advUpdateChatPanel(); }

/* 🎭 미니이벤트 — 벌판 랜덤 배치. 선택 → 보상/전투/다크서사 분기. (윤리 롤플레잉) */
/* (advBackToMove 제거됨 — 이동은 우측 패널 상시) */
/* ★ #4 수정: 아이템 지급 단일 창구.
   전투 전리품·이벤트 보상이 ADV.inv(소모품)에 들어가면 장착 로직(ADV.weapons)이 못 봐서
   무기를 얻어도 더블클릭 장착이 안 됐음. 무기는 개체(내구도 포함)로 ADV.weapons에 넣는다. */
/* ★ 무기 초기화 버그 수정: 초기화 지점들이 ADV.inv만 비우고 ADV.weapons(무기 풀)와
   슬롯 장착 무기(s.weapon)는 안 지워서, 초기화 후에도 무기가 아이템창에 남았음.
   무기·방어구는 세션 전리품이므로 세션 정리 시 전부 함께 비운다. */
function advClearSessionGear(){
  ADV.inv={}; ADV.armor=0; ADV.armorItem=null;
  ADV.weapons=[];
  (ADV.slots||[]).forEach(sl=>{ if(sl) sl.weapon=null; });
}
function advGrantItem(id, n){
  const it=ADV_WORLD.items[id]; if(!it) return;
  n=Math.max(1, n||1);
  if(it.armor){ advEquipArmor(id); return; }                        // 방어구는 즉시 착용
  if(it.weapon){ for(let k=0;k<n;k++) ADV.weapons.push({ id, dur: it.maxDur||1 }); return; }
  ADV.inv[id]=(ADV.inv[id]||0)+n;
}
function advGiveItem(id){ const it=ADV_WORLD.items[id];
  if(it && it.armor){ advEquipArmor(id); return '<p class="good">'+(it.icon||'🛡')+' '+it.name+'을(를) 착용했다. (방어력 '+ADV.armor+')</p>'; }
  advGrantItem(id,1); advSave(); advRenderSim();
  return '<p class="good">'+(it.icon||'📦')+' '+it.name+'을(를) 얻었다.'+(it.weapon?' (더블클릭으로 장착)':'')+'</p>'; }
function advIsParty(){ return !!(typeof PARTY!=='undefined' && PARTY && PARTY.mode==='together'); }
function advBumpAlign(stat, n){   // 선행/악행 카운터 +n, 임계(50/100) 넘으면 칭호 해금 알림
  const s=activeSlot(); if(!s||!n) return;
  const before=s[stat]||0; s[stat]=before+n;
  ADV_TITLES.filter(t=>t.stat===stat && before<t.need && s[stat]>=t.need).forEach(t=>{
    if(!s.title) s.title=t.id; if(typeof advToast==='function') advToast('🏅 새 칭호: 「'+t.name+'」'); });
}
const ADV_DEED_ALIGN = {   // 선행/악행 분류 (미분류=중립)
  helped_wounded:'good', treated_infected:'good', shared_supply:'good', fed_child:'good', saved_child:'good',
  killed_wounded:'evil', robbed_scared:'evil', cheated:'evil', robbed_shelter:'evil', robbed_weak:'evil',
  looted_trapped:'evil', robbed_survivor:'evil', robbed_child:'evil',
};
function advRecordDeed(tag){
  (ADV.deeds=ADV.deeds||[]).push({tag, at:ADV.map&&{x:ADV.map.pos.x,y:ADV.map.pos.y}, t:Date.now()});   // 위치 스냅샷
  const al=ADV_DEED_ALIGN[tag];
  if(al) advBumpAlign(al==='good'?'good':'evil', 1);
  advSave();
}
/* 🩸 완료된 서사 이벤트 자리 재방문 시 뜨는 '과거' 스크립트 (deeds 위치 기반) */
const ADV_DEED_AFTERMATH={
  killed_wounded:  '<p class="sys">전에 지났던 자리다.</p><p class="bad">벽에 기댄 채 싸늘하게 식은 시체가 그대로 있다. 당신이 남긴 흔적이다.</p>',
  helped_wounded:  '<p class="sys">약을 건넸던 자리다. 그는 보이지 않는다 — 스스로 일어설 힘을 얻은 모양이다.</p>',
  treated_infected:'<p class="sys">약으로 진정시켰던 사람이 있던 자리다. 지금은 비어 있다. 어디로 갔는지는 알 수 없다.</p>',
  mercy_kill:      '<p class="sys">그를 보내준 자리다.</p><p class="bad">아직 좀비가 되지 않은 시체가 조용히 누워 있다. 누가 먼저 손을 썼는지, 지나는 이는 알 리 없다.</p>',
  left_infected:   '<p class="sys">물린 사람을 두고 떠났던 자리다.</p><p class="bad">핏자국과 끌린 흔적만 남았다. 그는… 더는 사람이 아닐 것이다.</p>',
  infected_turned: '<p class="sys">눈앞에서 사람이 무너졌던 자리다.</p><p class="bad">쓰러뜨린 잔해가 굳어 있다. 비린내가 아직 가시지 않았다.</p>',
  robbed_scared:   '<p class="sys">겁에 질린 이에게서 빼앗았던 자리다. 떨어뜨린 물건 몇 개가 나뒹군다. 주인은 없다.</p>',
  cheated:         '<p class="sys">사기당했던 그 모닥불 자리다. 재만 남아 차게 식었다.</p>',
  looted_trapped:  '<p class="sys">잔해가 깔린 자리다.</p><p class="bad">삐져나온 손이 여전히 무언가를 꼭 쥔 채 굳어 있다. 당신이 두고 간 것이다.</p>',
  robbed_survivor: '<p class="sys">셔터 앞, 빈손이 된 생존자가 주저앉아 있던 자리다. 지금은 아무도 없다.</p>',
  shared_supply:   '<p class="sys">누군가와 물자를 나눈 자리다. 셔터는 활짝 열려 있다.</p>',
  fed_child:       '<p class="sys">벽장 문이 조금 열려 있다. 아이는 떠난 뒤다 — 배는 곯지 않았기를.</p>',
  robbed_child:    '<p class="sys">텅 빈 벽장.</p><p class="bad">작은 흐느낌의 잔향이 아직 벽에 배어 있는 듯하다.</p>',
  saved_child:     '<p class="sys">아이를 데리고 나왔던 자리다. 멈춘 회전목마 위로, 잠깐 웃음소리가 스친다.</p>',
};
function advMiniEventAftermath(x,y){
  const ds=(ADV.deeds||[]).filter(d=>d.at && d.at.x===x && d.at.y===y);
  if(!ds.length) return null;
  return ADV_DEED_AFTERMATH[ds[ds.length-1].tag] || null;   // 최신 기록의 결과 스크립트
}

const ADV_MINIEVENTS=[
  { id:'wounded', intro:'다리를 다친 생존자가 벽에 기대 신음한다. "제발… 약 좀…"',
    choices:[
      {label:'의약품을 나눠준다', need:['med',1], run:()=>{ ADV.inv.med--; advRecordDeed('helped_wounded');
        return '<p>당신은 약을 건넸다. 그는 떨리는 손으로 받아 든다.</p><p class="good">"고맙소… 이 은혜는 잊지 않겠소." (선행이 기록되었다)</p>'; }},
      {label:'못 본 척 지나친다', run:()=>'<p class="sys">당신은 발길을 돌렸다. 등 뒤로 신음이 멀어진다.</p>'},
      {label:'조용히 해친다', run:()=>{ advRecordDeed('killed_wounded'); return '<p class="bad">…당신은 손을 더럽혔다. 이 도시에선 흔한 일이다.</p><p class="sys">(무언가가 기록되었다.)</p>'; }},
    ]},
  { id:'infected', intro:'한 사람이 팔을 움켜쥐고 떤다. 물린 자국이 선명하다. "아직… 아직 난 인간이야…"',
    choices:[
      {label:'약품으로 진정시킨다', need:['med',1], run:()=>{ ADV.inv.med--; advRecordDeed('treated_infected');
        return '<p>약이 잠시 그를 붙든다. 하지만 얼마나 갈지는 모른다.</p><p class="sys">그는 힘없이 고개를 끄덕인다.</p>'; },
        noItem:()=>{ advRecordDeed('infected_turned'); return '<p class="bad">약이 없다. 손쓸 방법이 없다.</p><p class="bad">그의 눈이 허옇게 뒤집힌다 — "크르륵…" 인간이었던 것이 이빨을 드러내며 달려든다!</p>'; },
        noItemEnemy:'zombie' },
      {label:'지금 끝내준다', run:()=>{ advRecordDeed('mercy_kill'); return '<p class="bad">그가 좀비가 되기 전에… 당신은 방아쇠를 당겼다.</p><p class="sys">(누군가 나중에 이 자리를 지날지도 모른다.)</p>'; }},
      {label:'그냥 두고 간다', run:()=>{ advRecordDeed('left_infected'); return '<p class="sys">당신은 등을 돌렸다. 곧 그는… 생각하지 않기로 했다.</p>'; }},
    ]},
  { id:'scared', intro:'겁에 질린 사람이 가방을 끌어안고 뒷걸음친다. "다, 다가오지 마!"',
    choices:[
      {label:'설득한다 (운 판정)', check:['luk',12], ok:()=>advGiveItem(['can','flash'][Math.floor(Math.random()*2)])+'<p>그는 경계를 풀고 물건을 나눠줬다.</p>',
        fail:()=>'<p class="sys">그는 끝내 달아났다.</p>'},
      {label:'빼앗는다', combat:true, pre:()=>{ advRecordDeed('robbed_scared'); return '<p class="bad">당신이 다가서자 그가 칼을 빼든다 — 궁지에 몰린 쥐다!</p>'; }},
      {label:'지나친다', run:()=>'<p class="sys">당신은 그를 지나쳤다.</p>'},
    ]},
  { id:'dog_supply', intro:'강아지 한 마리가 당신의 바짓단을 물고 어딘가로 끈다. 자꾸 뒤돌아보며 낑낑댄다 — 따라오라는 듯이.',
    choices:[
      {label:'따라간다', run:()=>advGiveItem('med')+advGiveItem('can')+'<p class="good">강아지가 이끈 곳엔 주인이 남긴 배낭이 있었다. 약과 통조림을 챙긴다.</p><p class="sys">강아지는 배낭 옆에 앉아, 오지 않을 누군가를 기다린다.</p>'},
      {label:'쓰다듬고 보내준다', run:()=>'<p class="sys">한참을 쓰다듬어 주자, 강아지는 골목 어귀에서 몇 번이나 뒤돌아보다 사라졌다.</p>'},
    ]},
  { id:'dog_owner', intro:'강아지가 다급하게 짖으며 골목으로 이끈다. 누군가를 구해달라는 듯, 절박하게 당신을 올려다본다.',
    choices:[
      {label:'따라간다', combat:true, combatKey:'zombie',
        pre:()=>'<p>골목 끝, 강아지가 지키고 선 앞에 — 이미 좀비가 된 주인이 강아지를 향해 손을 뻗고 있다.</p><p class="bad">강아지는 물러서지 않는다. 당신이 나설 수밖에 없다.</p>'},
      {label:'외면하고 지나간다', run:()=>{ advRecordDeed('left_dog'); return '<p class="sys">강아지의 울음이 등 뒤에서 오래도록 멀어졌다.</p>'; }},
    ]},
  { id:'trade', intro:'후드를 쓴 상인이 손짓한다. "거래 안 하겠소? 손해 보는 장사는 아닐 거요."',
    choices:[
      {label:'통조림과 무기를 바꾼다', need:['can',1], run:()=>{ ADV.inv.can--; return advGiveItem('bat')+'<p>거래는 성사됐다.</p>'; }},
      {label:'거절한다', run:()=>'<p class="sys">상인은 어깨를 으쓱하곤 사라졌다.</p>'},
    ]},
  { id:'gamble', intro:'모닥불 가에 둘러앉은 무리가 카드를 섞는다. "한 판 어때? 운 좋으면 크게 먹지."',
    choices:[
      {label:'건다 (운 판정)', check:['luk',11], ok:()=>advGiveItem('med')+advGiveItem('flash')+'<p class="good">당신이 이겼다! 판돈을 쓸어 담는다.</p>',
        fail:()=>{ if(ADV.inv.can>0)ADV.inv.can--; advSave();advRenderSim(); return '<p class="bad">졌다. 가진 걸 조금 잃었다.</p>'; }},
      {label:'끼지 않는다', run:()=>'<p class="sys">당신은 자리를 떴다.</p>'},
    ]},
  { id:'cheater', intro:'유난히 친절한 무리가 도박을 권한다. 눈빛이 어딘가 미끄럽다. "자자, 부담 갖지 말고~"',
    choices:[
      {label:'건다', run:()=>{ if(ADV.inv.can>0)ADV.inv.can--; if(ADV.inv.flash>0)ADV.inv.flash--; advSave();advRenderSim();
        ADV_PENDING_COMBAT=true; advRecordDeed('cheated'); return '<p class="bad">…속임수다! 당신은 홀랑 털렸다.</p><p>분노가 치민다. 되찾으려면 힘으로 뺏는 수밖에.</p>'; }, maybeCombat:true},
      {label:'수상해서 거절한다 (지능 판정)', check:['int',11], ok:()=>'<p class="good">당신은 낌새를 챘다. "됐수." 무리가 아쉬운 듯 흩어진다.</p>',
        fail:()=>'<p class="sys">그냥 지나쳤지만… 뭔가 놓친 기분이다.</p>'},
    ]},
  /* ── 테마 전용 미니이벤트 (해당 분기에서만 등장) ── */
  { id:'ruin_trapped', theme:'ruin', intro:'무너진 콘크리트 더미 아래에서 희미한 신음이 들린다. 삐져나온 손이 무언가를 꼭 쥔 채 떤다.',
    choices:[
      {label:'잔해를 치워 구해준다 (힘 판정) 〔선〕', check:['str',12],
        ok:()=>{ advRecordDeed('helped_wounded'); return advGiveItem('can')+'<p class="good">가까스로 사람을 끌어냈다. 그는 가진 물자를 나눠주고 절뚝이며 떠났다.</p>'; },
        fail:()=>'<p class="bad">잔해가 다시 무너져 내렸다. 더는 손쓸 수 없었다.</p>' },
      {label:'구할 시간에 소지품만 빼서 간다 〔악〕', run:()=>{ advRecordDeed('looted_trapped'); return advGiveItem('med')+'<p class="bad">떨리는 손을 억지로 펴 물건을 빼냈다. 신음이 원망으로 바뀌는 걸, 당신은 듣지 않으려 했다.</p>'; }},
      {label:'못 본 척 지나친다', run:()=>'<p class="sys">신음은 곧 잦아들었다. 당신은 걸음을 재촉했다.</p>'},
    ]},
  { id:'shop_shutter', theme:'shop', intro:'잠긴 셔터 너머로 손대지 않은 물자가 보인다. 그 앞에 지친 생존자가 이미 셔터를 붙들고 낑낑대고 있다.',
    choices:[
      {label:'힘을 합쳐 열고 나눈다 (힘 판정) 〔선〕', check:['str',11],
        ok:()=>{ advRecordDeed('shared_supply'); return advGiveItem('can')+'<p class="good">둘이 힘을 모으자 셔터가 올라갔다. 그는 웃으며 물자를 나눠 준다.</p>'; },
        fail:()=>'<p class="sys">둘이 붙어도 셔터는 꿈쩍하지 않았다. 서로 멋쩍게 돌아섰다.</p>' },
      {label:'밀치고 혼자 차지한다 〔악〕', run:()=>{ advRecordDeed('robbed_survivor'); return advGiveItem('med')+advGiveItem('can')+'<p class="bad">당신은 그를 밀쳐냈다. 셔터 안의 것은 전부 당신 몫이 됐다. 등 뒤의 시선은 무시했다.</p>'; }},
      {label:'시끄러워지기 전에 물러난다', run:()=>'<p class="sys">괜한 다툼은 화를 부른다. 당신은 조용히 자리를 떴다.</p>'},
    ]},
  { id:'home_dinner', theme:'home', intro:'온기가 남은 식탁. 안쪽 벽장이 달칵인다 — 겁에 질린 아이가 숨죽여 숨어 있다.',
    choices:[
      {label:'먹을 것을 나눠주고 떠난다 〔선〕', run:()=>{ if(ADV.inv.can>0){ ADV.inv.can--; } advRecordDeed('fed_child'); advRenderSim(); return '<p class="good">통조림 하나를 벽장 앞에 놓아두었다. 조그만 손이 조심스레 그것을 끌어갔다.</p>'; }},
      {label:'아이 몫까지 전부 털어간다 〔악〕', run:()=>{ advRecordDeed('robbed_child'); return advGiveItem('can')+advGiveItem('flash')+'<p class="bad">당신은 집 안의 모든 걸 쓸어 담았다. 벽장 안에서 새어 나온 흐느낌을, 당신은 애써 못 들은 척했다.</p>'; }},
      {label:'못 본 척 조용히 나온다', run:()=>'<p class="sys">누군가의 삶이 멈춘 자리다. 당신은 조용히 문을 닫았다.</p>'},
    ]},
  { id:'infra_clinic', theme:'infra', intro:'약국 안쪽, 유리 캐비닛에 약품이 남아 있다. …그런데 문틈에 가느다란 낚싯줄이 걸려 있다.',
    choices:[
      {label:'조심스럽게 함정을 피해 연다 (민첩 판정)', check:['agi',12],
        ok:()=>advGiveItem('med')+advGiveItem('med')+'<p class="good">낚싯줄을 피해 약품을 통째로 챙겼다.</p>',
        fail:()=>{ const ap=advApplyDamage(15); return '<p class="bad">줄을 건드렸다 — 터진 파편에 '+(ap.absorbed>0?'🛡 '+ap.absorbed+' 방어 후 ':'')+ap.toHp+' 피해를 입었다.</p>'; } },
      {label:'위험하니 포기한다', run:()=>'<p class="sys">욕심을 접었다. 목숨보다 소중한 약은 없다.</p>'},
    ]},
  { id:'park_cry', theme:'park', intro:'멈춘 회전목마 너머에서 아이 울음소리가 들린다. …이런 곳에, 아이가?',
    choices:[
      {label:'아이를 찾아 구하러 나선다 〔선〕', run:()=>{ if(Math.random()<0.55){ ADV_PENDING_COMBAT=true; return '<p class="bad">울음소리의 정체는 낡은 스피커였다 — 미끼였다. 매복한 감염자가 덮친다!</p>'; } advRecordDeed('saved_child'); return '<p class="good">진짜였다. 관람차 밑에 웅크린 아이를 찾아 안전한 곳까지 데려다주었다.</p><p class="sys">아이는 아무 말 없이, 당신의 소매를 오래 붙잡고 있었다.</p>'; }, maybeCombat:true},
      {label:'함정 같으니 돌아선다', run:()=>'<p class="sys">놀이공원의 웃음소리는, 이제 아무것도 뜻하지 않는다.</p>'},
    ]},
  { id:'mil_crate', theme:'mil', intro:'버려진 검문소 옆, 군용 보급 상자가 놓여 있다. 자물쇠엔 붉은 경보 장치가 달려 있다.',
    choices:[
      {label:'경보를 무시하고 연다 (⚔ 위험)', combat:true, combatKey:'soldier',
        pre:()=>'<p class="bad">뚜껑을 열자 경보가 울린다 — 순찰 중이던 군인 감염자가 달려온다!</p>'},
      {label:'배선을 끊고 조용히 연다 (지능 판정)', check:['int',13],
        ok:()=>advGiveItem('guard')+advGiveItem('can')+'<p class="good">경보 배선을 끊고 상자를 열었다. 보호구와 보급품이 들어 있다.</p>',
        fail:()=>'<p class="sys">배선이 복잡해 손대지 못했다. 상자는 그대로 두고 물러났다.</p>' },
    ]},
];
let ADV_PENDING_COMBAT=false;

// ★ #2/#3: 자원·이벤트 칸을 '실제로 선택'했을 때만 소비 처리(+기력 1) — 지나치면 남아서 재방문 가능
function advConsumeEventTile(){
  const p=ADV.map&&ADV.map.pos; if(!p) return;
  const key=p.x+','+p.y;
  if(!(ADV.map.stepped||[]).includes(key)) (ADV.map.stepped=ADV.map.stepped||[]).push(key);
  advSpendSt(1);   // ★ #9
}
function advOpenMiniEvent(band){
  const m=advEnsureMap(); const theme=m.themes[Math.min(2,band)];
  const pool=ADV_MINIEVENTS.filter(e=>!e.theme || e.theme===theme);   // 테마 전용 이벤트는 해당 분기에서만
  const ev=(pool.length?pool:ADV_MINIEVENTS)[Math.floor(Math.random()*(pool.length?pool.length:ADV_MINIEVENTS.length))];
  advRenderMiniEvent(ev, band);
}
function advRenderMiniEvent(ev, band){
  const btns=ev.choices.map(c=>({label:c.label + (c.need?(' ('+ADV_WORLD.items[c.need[0]].name+')'):''), on:()=>advMiniChoice(ev,c,band)}));
  advPrompt('<p><span class="loc">[ ? ]</span></p><p>'+ev.intro+'</p>', btns);
}
function advMiniChoice(ev, c, band){
  const s=activeSlot();
  // 아이템 필요 조건
  if(c.need && (ADV.inv[c.need[0]]||0) < c.need[1]){
    if(c.noItem){   // ★ 아이템 없을 때 전용 결과 (예: 감염자 → 좀비 발현 → 전투)
      advConsumeEventTile();
      const pre=c.noItem();
      advPrompt(pre, [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(band, c.noItemEnemy||undefined)} ]);
      return;
    }
    advPrompt('<p class="bad">'+ADV_WORLD.items[c.need[0]].name+'이(가) 없다.</p>', [ {label:'↩ 돌아간다', on:()=>advRenderMiniEvent(ev, band)} ]);
    return;   // 소비 안 함 — 아이템 구해서 다시 올 수 있음
  }
  advConsumeEventTile();   // ★ 실제 선택 → 이벤트 소비 + 기력 -1 (#2/#3)
  // 전투 직행
  if(c.combat){ const pre=c.pre?c.pre():''; advPrompt(pre, [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(band, c.combatKey||undefined)} ]); return; }
  // 판정형
  if(c.check){
    const roll=advD20(), eff=roll-Math.floor(statEff(s,c.check[0])/2), ok=eff<=c.check[1];
    let out='<p><span class="roll">🎲'+roll+'</span> '+(ok?'<span class="good">성공!</span>':'<span class="bad">실패…</span>')+'</p>'+(ok?c.ok():c.fail());
    advPrompt(out, []); return;   // 이동은 우측 패널로(#2 — 계속 버튼 제거)
  }
  // 일반 run
  ADV_PENDING_COMBAT=false;
  const out=c.run?c.run():'';
  if(c.maybeCombat && ADV_PENDING_COMBAT){ ADV_PENDING_COMBAT=false;
    advPrompt(out, [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(band)} ]); return; }
  advPrompt(out, []);
}

/* 💰 자원 씬 — 판정형 선택지 */
function advOpenResourceScene(band){
  const sc=ADV_POOLS.resource[Math.floor(Math.random()*ADV_POOLS.resource.length)];
  const btns=[];
  sc.choices.forEach(c=>{
    if(c.skip){ btns.push({label:c.label, on:()=>advPrompt('<p class="sys">모른 척 지나쳤다. (나중에 다시 올 수 있다)</p>',[])}); return; }   // ★ 소비 안 함 — 재방문 시 다시(#2)
    btns.push({label:c.label, on:()=>{
      advConsumeEventTile();   // ★ 실제 선택 → 소비 + 기력 -1 (#2/#3)
      const s=activeSlot();
      const roll=advD20(), eff=roll-Math.floor(statEff(s, c.check[0])/2);
      const ok = eff<=c.check[1];
      let out='<p><span class="roll">🎲'+roll+'</span> '+(ok?'<span class="good">판정 성공!</span>':'<span class="bad">판정 실패…</span>')+'</p>';
      if(ok){
        let id=c.ok.item;
        if(id==='rand') id=['can','med','flash','bat'][Math.floor(Math.random()*4)];
        if(id==='rand1') id=['can','flash'][Math.floor(Math.random()*2)];
        advGrantItem(id,1);   // ★ #4: 무기면 ADV.weapons로
        const it=ADV_WORLD.items[id];
        out+='<p class="good">'+(it.icon||'📦')+' '+it.name+'을(를) 손에 넣었다!'+(it.weapon?' (더블클릭으로 장착)':'')+'</p>';
        advSave(); advRenderSim();
        advPrompt(out, []);
      }else{
        out+='<p>'+(c.fail.txt||'허탕이다.')+'</p>';
        if(c.fail.ambush){
          advPrompt(out, [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(band)} ]);
        }else{
          advPrompt(out, []);
        }
      }
    }});
  });
  advPrompt('<p>'+sc.intro+'</p>', btns);
}

/* ⭐ 스토리 건물 (보스전·서사는 다음 차수 — 지금은 안내 스텁) */
/* ─────────────────────── 🏚️ 스토리 건물 씬 (분기별 풀, 경계심 게이지) ───────────────────────
   ADV.story(저장): { id, band, bldg, beat, wary }  — 엔진과 콘텐츠 분리, 함수는 데이터에 둠(미니이벤트와 동일 스타일). */
const ADV_STORY = {
  0:[ /* ── 1분기 ── */
    {
      id:'shelter',
      gauge:{ low:0, high:100, init:50, highTo:'shot' },
      waryReact:[   // 경계심 구간별 반응 대사 (변할 때마다 1개, 한 번 나온 건 다시 안 나옴)
        { lo:10, hi:20, pool:[
          '굳었던 어깨가 조금 풀린다. 목소리에서 날이 빠졌다.',
          '"…당신, 아주 나쁜 사람은 아닌 것 같군." 상대가 중얼거린다.',
          '경계하던 눈빛이 한결 누그러졌다. 이제야 말이 통하기 시작한다.' ]},
        { lo:30, hi:40, pool:[
          '여전히 문틈으로만 대화하지만, 아까보다는 말이 부드럽다.',
          '"…무슨 사정인지는 알겠어." 상대가 낮게 한숨을 쉰다.',
          '총을 쥔 손의 힘이 조금 빠진 게 보인다.' ]},
        { lo:50, hi:60, pool:[
          '당신을 못미더운 눈으로 바라본다.',
          '아직 미심쩍지만, 그래도 얘기는 들어보려 하는 것 같다.',
          '눈썹을 씰룩거리며 당신을 위아래로 훑어본다.' ]},
        { lo:70, hi:90, pool:[
          '상대의 손가락이 방아쇠에 닿는다. "허튼짓하면 쏜다."',
          '"경고했어. 한 발짝만 더 와봐." 목소리가 파르르 떨린다.',
          '총구가 정확히 당신의 미간을 겨눈다. 분위기가 험악하다.',
          '"당신 같은 놈들 여럿 봤어. 다 똑같지." 상대가 이를 간다.' ]},
      ],
      beats:{
        start:{
          text:'<p><span class="loc">[ 대피소 ]</span></p>'
            +'<p>반쯤 주저앉은 건물. 철문에 출처를 알 수 없는 피와 살점으로 쓴 글씨가 적혀 있다.</p>'
            +'<p class="bad">"들어오지 마시오. 경고했음."</p>'
            +'<p>안에서 인기척이 난다. 깨진 유리창 너머로 웅크린 생존자가 보인다.</p>',
          choices:[
            {label:'문을 두드린다', to:'gate'},
            {label:'조용히 물러난다', to:'end', txt:'<p class="sys">당신은 발길을 돌렸다. 등 뒤로 인기척이 멀어진다.</p>'},
          ]
        },
        gate:{
          phase:'talk', meter:true,
          text:st=>{ if(st.gateSeen) return ''; st.gateSeen=true;
            return '<p>두드리는 소리에 생존자가 화들짝 놀라 철문 쪽으로 다가온다. 깨진 유리창 너머로 당신을 훑어본다.</p>'
              +'<p class="bad">"들어오지 말라는 글자 못 읽었어? 당장 꺼져!"</p>'; },
          choices:[
            {label:'동정심을 유발해 대화를 유도한다 (운 판정)', moral:'good', check:['luk',12],
              ok:{ wary:-10, low:'pity' },
              fail:{ wary:+10 },
              to:'gate' },
            {label:'속임수를 써 대피소 안으로 들어가려 한다 (지능 판정)', check:['int',12],
              ok:{ wary:-10, low:'inside' },
              fail:{ wary:+10 },
              to:'gate' },
            {label:'힘으로 문을 부수고 강행한다 (⚔ 전투)', moral:'evil',
              combat:'outlaw', onWin:'forced_in', onFlee:'end',
              txt:'<p class="bad">더는 말이 통하지 않는다. 당신은 어깨로 철문을 들이받았다 — 안에서 비명이 터진다.</p>' },
            {label:'조용히 물러난다', to:'end', txt:'<p class="sys">더는 자극하지 않기로 했다. 당신은 물러섰다.</p>'},
          ]
        },
        forced_in:{
          phase:'talk',
          onEnter:{ items:[['med',2],['can',2]], deed:'robbed_shelter' },
          text:'<p>문이 부서지고, 짧은 몸싸움 끝에 상대는 구석으로 밀려났다.</p>'
            +'<p class="sys">당신은 필요한 것을 챙긴다. (💊 약품 상자 ×2 · 🥫 통조림 ×2)</p>'
            +'<p class="bad">등 뒤의 눈빛이 오래 따라붙는다. (무언가가 기록되었다.)</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
        shot:{
          onEnter:{ hp:-15 },
          text:'<p class="bad">"경고했다고 했지."</p>'
            +'<p class="bad">총성이 울린다. 어깨를 스친 통증에 당신은 뒷걸음질친다. (HP -15)</p>',
          choices:[ {label:'🚶 물러난다', to:'end'} ]
        },
        pity:{
          onEnter:{ items:[['pistol',1],['med',3],['can',3]] },
          text:'<p>한참을 노려보던 상대가 총을 내린다.</p>'
            +'<p class="good">"…젠장. 이거라도 갖고 가. 두 번은 없어."</p>'
            +'<p class="sys">철문 틈으로 권총 한 자루와 물자가 밀려 나온다. (🔫 권총 · 💊 약품 상자 ×3 · 🥫 통조림 ×3)</p>',
          choices:[ {label:'🚶 고맙다고 말하고 떠난다', to:'end'} ]
        },
        inside:{
          phase:'talk',
          text:'<p>당신의 말에 넘어간 상대가 철문을 연다. 어두운 대피소 안, 궁색한 살림이 눈에 들어온다.</p>',
          choices:[
            {label:'상황을 얘기하고 물자를 조금 얻어간다', to:'talked', moral:'good'},
            {label:'몰래 훔친다 (⚔ 발각 시 전투)', moral:'evil',
              combat:'outlaw', onWin:'stole', onFlee:'end',
              txt:'<p class="bad">몰래 손을 뻗는 순간 들켰다 — "이 도둑놈!" 상대가 달려든다!</p>' },
            {label:'우리보다 약해 보이니 빼앗는다 (⚔ 전투)', moral:'evil',
              combat:'outlaw', onWin:'rob', onFlee:'end',
              txt:'<p class="bad">당신이 다가서자 상대가 필사적으로 저항하며 달려든다!</p>' },
          ]
        },
        talked:{
          onEnter:{ items:[['med',1],['can',1]] },
          text:'<p>당신은 사정을 털어놓았다. 상대는 말없이 통조림과 약을 조금 나눠준다.</p>'
            +'<p class="good">"…살아남아. 그게 복수야."</p>',
          choices:[ {label:'🚶 감사히 받고 떠난다', to:'end'} ]
        },
        stole:{
          onEnter:{ items:[['med',2],['can',2]], deed:'robbed_shelter' },
          text:'<p>거칠게 제압한 뒤, 필요한 것만 챙겨 빠져나온다.</p>'
            +'<p class="sys">(💊 약품 상자 ×2 · 🥫 통조림 ×2)</p>'
            +'<p class="bad">(무언가가 기록되었다.)</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
        rob:{
          onEnter:{ items:[['pistol',1],['med',3],['can',3]], deed:'robbed_weak' },
          text:'<p class="bad">저항하던 상대를 끝내 제압했다.</p>'
            +'<p class="sys">권총과 물자를 챙긴다. 등 뒤에서 낮은 흐느낌이 들렸지만, 돌아보지 않았다.</p>'
            +'<p class="bad">(무언가가 기록되었다.)</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
      }
    },
    {
      id:'outlaw_den',
      gauge:{ low:0, high:100, init:0, highTo:'caught', label:'발각도', meterCls:'hp' },
      beats:{
        start:{
          phase:'talk',
          text:'<p><span class="loc">[ 무법자 소굴 ]</span></p>'
            +'<p>약탈한 물자를 산더미처럼 쌓아둔 소굴. 입구엔 총을 든 보초가 어슬렁거린다.</p>'
            +'<p class="sys">아직 당신을 눈치채지 못했다. 어떻게 접근할까.</p>',
          choices:[
            {label:'몰래 잠입한다', to:'den'},
            {label:'정면으로 강습한다 (⚔ 전투)', combat:'outlaw', onWin:'raided', onFlee:'end',
              txt:'<p class="bad">당신은 은신을 버리고 뛰어들었다. 보초가 총을 겨눈다!</p>'},
            {label:'건드리지 않고 물러난다', to:'end', txt:'<p class="sys">괜히 벌집을 쑤실 필요는 없다. 당신은 조용히 물러섰다.</p>'},
          ]
        },
        den:{
          phase:'talk', meter:true,
          text:'<p>쌓인 물자 사이를 살핀다. 보초의 시선이 오갈 때마다 심장이 뛴다.</p>',
          choices:[
            {label:'몰래 물자를 챙긴다 (민첩 판정)', check:['agi',12],
              ok:{ wary:10, give:()=>advGiveItem(Math.random()<0.5?'can':'med') },
              fail:{ wary:30, txt:'<p class="bad">발을 헛디뎠다 — 무언가 요란하게 넘어진다. 보초가 두리번거린다.</p>' },
              to:'den' },
            {label:'이만 챙겨서 빠져나간다', to:'escaped'},
            {label:'들키기 전에 선제 강습한다 (⚔ 전투)', combat:'outlaw', onWin:'raided', onFlee:'end',
              txt:'<p class="bad">더는 운을 시험할 수 없다. 당신이 먼저 덮쳤다!</p>'},
          ]
        },
        caught:{
          phase:'talk',
          text:'<p class="bad">"거기 누구야!" — 발각됐다. 무법자들이 총을 들고 몰려든다!</p>',
          choices:[
            {label:'각오하고 맞선다', combat:'outlaw', onWin:'raided', onFlee:'end', txt:'<p class="bad">피할 길은 없다.</p>'},
          ]
        },
        escaped:{
          text:'<p class="good">챙긴 것을 품에 안고, 당신은 그림자 속으로 빠져나왔다.</p>'
            +'<p class="sys">보초는 끝내 눈치채지 못했다.</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
        raided:{
          onEnter:{ items:[['guard',1],['med',2],['can',3]] },
          text:'<p>마지막 하나까지 쓰러뜨린 뒤, 소굴을 뒤졌다.</p>'
            +'<p class="good">쌓여 있던 물자를 쓸어 담는다. (🛡 보호구 · 💊 약품 상자 ×2 · 🥫 통조림 ×3)</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
      }
    }
  ],
  1:[ /* ── 2분기 ── */
    {
      id:'wounded_courier',
      beats:{
        start:{
          phase:'talk', vote:true,
          text:'<p><span class="loc">[ 부상당한 생존자 ]</span></p>'
            +'<p>피투성이가 된 남자가 무너진 벽에 기대 헐떡인다. 다리 한쪽이 성치 않다. 당신을 보자 경계하면서도, 살았다는 안도가 스친다.</p>'
            +'<p>"…난 연구원을 <span class="bad">▲▣</span>에 데려가는 무리에 있었어. 연구원이 그러더라 — <span class="bad">▲▣</span>는 지하 방공호라 안전하다고. 자기가 <span class="good">연구소 카드키</span>가 있으니, 엄호해주면 같이 데려가겠다고."</p>'
            +'<p>"근데 그 빌어먹을 <span class="bad">좀비 무리</span>한테… 다 당했어. 나만 겨우 기어 나왔다."</p>'
            +'<p>"연구원이 카드키만큼 중요하게 여기는 물건이 있길래… 이거 하나라도 챙겨 나왔어. 얘기 듣기론 <span class="sys">항체 보유자의 피를 백신으로 변형시켜주는 간이 기기</span>라고 해. 날 <span class="good">B캠프</span>까지만 데려다주면 이걸 줄게. …난 더 이상 그 좀비 무리를 마주치고 싶지 않아."</p>',
          choices:[
            {label:'B캠프까지 데려다준다', moral:'good', to:'escort'},
            {label:'물렸을지 모른다 — 죽여서 뺏는다', moral:'evil', to:'kill'},
            {label:'못 본 척 지나친다', to:'end', txt:'<p class="sys">당신은 그의 눈을 피해 발걸음을 옮겼다.</p>'},
          ]
        },
        escort:{
          onEnter:{ good:5, give:()=>{ if(advIsParty()){ advGiveItem('medkit'); } else { advGiveItem('med'); advGiveItem('med'); } }, camp:'B' },
          text:st=>'<p>당신은 그를 부축했다. 절뚝이는 걸음으로 며칠을 함께 걸었다.</p>'
            +'<p class="good">마침내 B캠프의 불빛이 보인다. 그는 약속대로 '+(advIsParty()?'🧪 백신 의료기기':'물건')+'를 건넨다.</p>'
            +(advIsParty()?'':'<p class="sys">"…당신은 안 물렸으니 이 기계는 필요 없겠지. 대신 이거라도 챙겨." 그는 챙겨둔 약을 나눠준다. (💊 약품 상자 ×2)</p>')
            +'<p class="sys">▶ 데려다주면 B캠프로 이동합니다.</p>',
          choices:[ {label:'🚶 B캠프로 들어간다', to:'end'} ]
        },
        kill:{
          onEnter:{ evil:10, give:()=>{ if(advIsParty()) advGiveItem('medkit'); else advGiveItem('med'); } },
          text:st=>'<p class="bad">그가 뭐라 말하기도 전에, 당신은 손을 썼다. 저항은 없었다 — 그럴 힘도 없었으니까.</p>'
            +'<p class="sys">식어가는 몸에서 '+(advIsParty()?'간이 기기를':'쓸 만한 것을')+' 챙긴다. 물린 흔적 같은 건, 애초에 없었다.</p>'
            +'<p class="bad">(무언가가 깊이 기록되었다.)</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
      }
    },
    {
      id:'panic_researcher',
      beats:{
        start:{
          phase:'talk',
          text:'<p><span class="loc">[ 패닉에 빠진 연구원 ]</span></p>'
            +'<p>흰 가운의 남자가 구석에 웅크린 채 덜덜 떤다. 초점 없는 눈, 갈라진 목소리.</p>'
            +'<p class="bad">"친구가… 눈앞에서 뜯겼어. 난 그냥… 도망쳤고… 죽여줘. 제발 날 죽여줘, 더는 못 살겠어."</p>'
            +'<p class="sys">"…<span class="bad">▲▣ 연구소</span>도 제정신이 아니야. 거긴… 거긴 가면 안 돼. 아무도 몰라, 아무도…"</p>'
            +'<p class="sys">대화가 통하지 않는다. 그는 자기 세계에 갇혀 있다.</p>',
          choices:[
            {label:'주변을 살핀다', to:'look'},
            {label:'그의 호소를 들어준다 (보내준다)', to:'mercy'},
            {label:'그냥 지나친다', to:'end', txt:'<p class="sys">그의 중얼거림을 뒤로하고, 당신은 자리를 떴다.</p>'},
          ]
        },
        mercy:{
          onEnter:{ deed:'mercy_kill' },
          text:'<p>당신은 말없이 그의 부탁을 들어주었다. 짧은 순간이었고 — 그는 처음으로 편안해 보였다.</p>'
            +'<p class="sys">…이게 자비인지 포기인지, 당신은 오래 생각하지 않기로 했다.</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
        look:{
          phase:'talk',
          onEnter:{ give:()=>{ if(advIsParty()) advGiveItem('medkit'); else advGiveItem('med'); } },
          text:st=>'<p>연구원 옆, 뒤집힌 가방 속에서 '+(advIsParty()?'🧪 백신 의료기기':'💊 약품 상자')+'를 발견했다.</p>'
            +'<p class="sys">챙길 건 챙겼다. 이제 이 자리를 뜨는 게 좋겠다.</p>',
          choices:[
            {label:'자리를 뜬다', combat:'outlaw', onWin:'after_kill', onFlee:'end',
              txt:'<p class="bad">등을 돌리는 순간 — "죽여달라니까!!" 연구원이 광기에 찬 얼굴로 달려든다!</p>'},
          ]
        },
        after_kill:{
          text:'<p>발버둥이 멎었다. 당신은 한참을 서 있었다.</p>'
            +'<p class="sys">…미쳐가는 세상에서, 끝까지 멀쩡하게 살아남으려는 게 정말 정상인 걸까.</p>'
            +'<p class="sys">답 없는 질문을 삼키며, 당신은 자리를 떴다.</p>',
          choices:[ {label:'🚶 떠난다', to:'end'} ]
        },
      }
    }
  ]
};
function advFindStory(id){ for(const b of [0,1,2]){ const s=(ADV_STORY[b]||[]).find(x=>x.id===id); if(s) return s; } return null; }
function advPhaseBanner(phase, meter){
  const talk = phase!=='combat';
  const name = talk ? '💬 화술 페이즈' : '⚔ 전투 페이즈';
  return '<div class="adv-phase '+(talk?'talk':'fight')+'"><span class="adv-phase-name">'+name+'</span>'
    +(meter?'<span class="adv-phase-meter">'+meter+'</span>':'')+'</div>';
}
function advWaryMeter(st, gauge){ const w=Math.max(0,Math.min(100,st.wary||0)); const lbl=(gauge&&gauge.label)||'경계심'; const cls=(gauge&&gauge.meterCls)||'warn'; return lbl+' <span class="adv-gauge '+cls+'"><i style="width:'+w+'%"></i></span> '+w; }
function advPickWaryLine(sc, st){
  const b=(sc.waryReact||[]).find(z=> st.wary>=z.lo && st.wary<=z.hi);
  if(!b || !b.pool.length) return '';
  return '<p style="color:#d9b38c">'+b.pool[Math.floor(Math.random()*b.pool.length)]+'</p>';   // 로테이션(반복 허용)
}
function advStoryEffects(e){
  if(!e) return;
  if(e.items) e.items.forEach(p=>{ const id=p[0],n=p[1]||1;
    advGrantItem(id,n); });   // ★ #4: 방어구=착용 / 무기=ADV.weapons / 그 외=inv
  if(typeof e.hp==='number') ADV.hp=Math.max(0, Math.min(100, ADV.hp+e.hp));
  if(e.deed) advRecordDeed(e.deed);
  if(e.good) advBumpAlign('good', e.good);
  if(e.evil) advBumpAlign('evil', e.evil);
  if(typeof e.give==='function') e.give();   // 조건부 보상(파티/솔로 분기 등)
  if(e.camp && ADV.map){ const m=advEnsureMap(); const c=(m.camps||[]).find(cc=>cc.name===e.camp);
    if(c){ ADV.map.pos={x:c.x,y:c.y}; if(typeof advMarkSeen==='function') advMarkSeen(m,c.x,c.y); } }   // 캠프로 이동
  if(e.items||typeof e.hp==='number'||e.give) advRenderSim();
}
function advStartStoryScene(band, bldg){
  const pool=ADV_STORY[band]||[]; if(!pool.length) return false;
  const sc=pool[Math.floor(Math.random()*pool.length)];
  ADV.story={ id:sc.id, band, bldg, beat:'start', wary:(sc.gauge?sc.gauge.init:0) };
  advSave(); advGotoStoryBeat('start',''); return true;
}
function advGotoStoryBeat(beatId, prefix){
  const st=ADV.story; if(!st) return;
  const sc=advFindStory(st.id); if(!sc){ advEndStory(); return; }
  const beat=sc.beats[beatId]; if(!beat){ advEndStory(); return; }
  st.beat=beatId; advStoryEffects(beat.onEnter); advSave();
  if(ADV.hp<=0){ advCombatDeath(); return; }   // 총격 등으로 사망 시 안전망
  if(advVotableNow(beat) && iAmLeader()){ advOpenVote(beatId); return; }   // D#7: 파티 투표 비트 → 투표 개시
  if(beat.meter && sc.gauge && advGaugeShared() && iAmLeader()){ advOpenGauge(sc, beatId); return; }   // D#6: 화술 게이지 → 공유 라운드 개시
  let banner='';
  if(beat.phase){ banner=advPhaseBanner(beat.phase, (beat.phase!=='combat' && beat.meter && sc.gauge)?advWaryMeter(st, sc.gauge):''); }
  const html=banner + (prefix||'') + (typeof beat.text==='function'?beat.text(st):(beat.text||''));
  if(advIsParty() && partyCount()>1 && iAmLeader() && fbReady() && PARTY.pid){   // ★ #7: 진행 비트를 팀원에게 방송(전원이 함께 본다)
    try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {storyHtml:String(html).slice(0,8000), storyTs:Date.now()}); }catch(_){}
  }
  const btns=(beat.choices||[]).map(c=>{
    let cls=c.cls||'';
    if(c.moral==='good') cls+=' adv-good'; else if(c.moral==='evil') cls+=' adv-evil';
    const lbl=(typeof c.label==='function'?c.label(st):c.label);
    if(c.moral && st.align && st.align!==c.moral){   // 이미 반대 성향 택함 → 잠금
      return {label:lbl+' 🔒', cls:(cls+' adv-locked').trim(), on:()=>advToast('이미 마음을 정했다.')};
    }
    return {label:lbl, cls:cls.trim(), on:()=>advStoryChoice(c)};
  });
  advPrompt(html, btns);
}
function advStoryChoice(c){
  const st=ADV.story; if(!st) return;
  const sc=advFindStory(st.id); if(!sc){ advEndStory(); return; }
  if(c.moral){ if(st.align && st.align!==c.moral) return;   // 반대 성향 잠금(안전망)
    if(!st.align){ st.align=c.moral; advSave(); } }
  if(c.need && (ADV.inv[c.need[0]]||0)<c.need[1]){
    advPrompt('<p class="bad">'+ADV_WORLD.items[c.need[0]].name+'이(가) 없다.</p>', [ {label:'↩ 돌아간다', on:()=>advGotoStoryBeat(st.beat,'')} ]); return;
  }
  let branch=c, prefix='';
  if(c.check){
    const s=activeSlot(); const roll=advD20(), eff=roll-Math.floor(statEff(s,c.check[0])/2), ok=eff<=c.check[1];
    branch = ok?c.ok:c.fail;
    prefix='<p><span class="roll">🎲'+roll+'</span> '+(ok?'<span class="good">성공</span>':'<span class="bad">실패…</span>')+'</p>';
  }
  if(typeof branch.wary==='number' && sc.gauge){ st.wary=Math.max(sc.gauge.low, Math.min(sc.gauge.high, st.wary+branch.wary)); }
  advStoryEffects(branch);
  let react='';
  if(sc.gauge && sc.waryReact && typeof branch.wary==='number') react=advPickWaryLine(sc, st);   // 경계심 변할 때 반응 대사(1회성)
  const btxt = prefix + (typeof branch.txt==='function'?branch.txt(st):(branch.txt||'')) + react;
  advSave();
  if(branch.combat){ const band=st.band, key=branch.combat;
    if(branch.onWin || branch.onFlee){   // 전투 후 스토리로 복귀(페이즈 전환)
      ADV.story.ret={ onWin:branch.onWin||'end', onFlee:branch.onFlee||'end' }; advSave();
      advPrompt(btxt, [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(band, key)} ]); return;
    }
    ADV.story=null; advSave();   // 복귀 지정 없으면 씬 종료 후 전투
    advPrompt(btxt, [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(band, key)} ]); return;
  }
  let to = branch.to || c.to;
  if(sc.gauge){
    if(st.wary>=sc.gauge.high) to=sc.gauge.highTo;
    else if(st.wary<=sc.gauge.low && branch.low) to=branch.low;
  }
  if(!to || to==='end'){
    if(btxt.trim()){ advPrompt(btxt, [ {label:'▶ 이야기를 마친다', cls:'adv-reveal', on:advEndStory} ]); }
    else { advEndStory(); }
    return;
  }
  advGotoStoryBeat(to, btxt);
}
function advEndStory(){
  const st=ADV.story;
  advBroadcastWitness();   // D#8: 관전자에게 도덕 결과 방송(방장만)
  if(advIsParty() && iAmLeader() && fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {storyHtml:null, storyTs:Date.now()}); }catch(_){} }   // ★ #7: 공유 종료
  if(st && ADV.map){ const dn=(ADV.map.storyDone=ADV.map.storyDone||[]); if(!dn.includes(st.bldg)) dn.push(st.bldg); }
  ADV.story=null; advSave(); advOpenMove();
}

/* ───────────────── ⛺ 캠프 (휴식 + 물자·방어구 거래) ───────────────── */
function advCurrentCamp(){ const m=advEnsureMap(); return (m.camps||[]).find(c=>c.x===ADV.map.pos.x && c.y===ADV.map.pos.y); }
function advInvSummary(){   // ★ 보유 표기는 이모지 대신 이름으로(헷갈림 방지) — 예: 통조림×4 · 약품 상자×1
  const keys=Object.keys(ADV.inv||{}).filter(id=>ADV.inv[id]>0 && ADV_WORLD.items[id]);
  return keys.length? keys.map(id=>ADV_WORLD.items[id].name+'×'+ADV.inv[id]).join(' · ') : '없음';
}
function advMatSummary(){   // 조합 재료만 추린 보유 표기
  const t=ADV_CRAFT_MATS.filter(id=>(ADV.inv[id]||0)>0).map(id=>ADV_WORLD.items[id].name+'×'+ADV.inv[id]);
  return t.length? t.join(' · ') : '없음';
}
function advCostText(list){ return list.map(g=>ADV_WORLD.items[g[0]].name+'×'+g[1]).join(' · '); }
function advOpenCamp(camp){
  ADV.scene='camp'; advSave();
  // 파티: 캠프 도착 알림 → 늦은 합류 재허용(방장이 parties/$pid/atCamp=true), 내 위치 동기화
  if(advIsParty() && PARTY.pid){
    advSyncMyLocation();
    if(iAmLeader() && fbReady() && firebaseAPI.advSetAtCamp){ try{ firebaseAPI.advSetAtCamp(PARTY.pid, true); }catch(_){} }
  }
  const nm=camp?camp.name:'?';
  const arm = ADV.armorItem ? (ADV_WORLD.items[ADV.armorItem].icon+' '+ADV_WORLD.items[ADV.armorItem].name+' · 방어력 '+ADV.armor) : '없음';
  // ★ #2 수정: 캠프 대화창을 스토리 스크립트 영역(#advTerm)에 넣지 않는다.
  //   기존엔 여기에 advChatBoxHtml()를 append해 스토리 영역에 대화창이 떴고, #advChatInput 이 하단 패널과 이중 생성됐음.
  //   파티 채팅은 하단 전용 패널(#advChatPanel)에서만 유지 → 여기선 안내 문구만.
  let chtml='<p><span class="loc">[ 캠프 '+nm+' ]</span></p>'
    +'<p class="sys">모닥불이 타오른다. 잠시 숨을 돌릴 수 있는 안전한 곳.</p>'
    +'<p>❤ HP '+ADV.hp+'/100 · 🛡 방어구: '+arm+'</p>'
    +'<p class="sys">보유 물자: '+advInvSummary()+'</p>';
  if(advIsParty() && partyCount()>1) chtml += '<p class="sys" style="color:#7fd0e0">🏕 여긴 파티 허브 — 동료와의 대화는 아래 채팅 패널에서 계속돼요.</p>';
  if(ADV._campLog) chtml += ADV._campLog;   // 거래·조합 결과 한 줄(패널 조작 → 가운데엔 결과만)
  if(_advPanel!=='move') chtml += '<p class="sys" style="color:#8fd0a0">→ 오른쪽 '+(_advPanel==='craft'?'작업대':'거래대')+'에서 칸을 눌러 진행하세요.</p>';
  advPrompt(chtml,
    (function(){
      const b=[
        {label:'🛏 휴식한다 (HP·기력 회복)', cls:'adv-reveal', on:advCampRest},
        {label:'🛒 물자를 거래한다', cls:(_advPanel==='shop'?'adv-good':'adv-reveal'), on:()=>advOpenCampPanel('shop')},
        {label:'🔨 무기를 조합한다', cls:(_advPanel==='craft'?'adv-good':'adv-reveal'), on:()=>advOpenCampPanel('craft')},
        {label:'🚶 캠프를 나선다', cls:'adv-reveal', on:advOpenMove},
      ];
      // 캠프는 안전지대 — 파티에서 이탈 가능(솔로 전환)
      if(advIsParty() && partyCount()>1){ b.push({label:'🚪 파티에서 나가기', on:()=>{
        advPrompt('<p class="sys">캠프에서 파티를 떠나 혼자 나아갈까요? (되돌릴 수 없어요)</p>',
          [ {label:'✔ 나간다', cls:'adv-reveal', on:()=>advCampLeaveParty(camp)}, {label:'↩ 취소', on:()=>advOpenCamp(camp)} ]);
      }}); }
      return b;
    })());
  advUpdateChatPanel();   // ★ #2: 하단 전용 채팅 패널을 캠프에서도 표시/갱신(파티만) — 스토리 영역엔 대화창을 넣지 않음
  if(document.getElementById('advMovePanel')) advRenderMoveNav();   // 오른쪽 패널(이동/거래/조합) 동기화
}
function advCampRest(){
  ADV._campLog='';
  ADV.hp=100; ADV.st=100; advSave(); advRenderSim();
  advPrompt('<p class="good">불 곁에서 한숨 돌렸다. 체력과 기력을 회복했다. (HP·기력 100%)</p>',
    [ {label:'↩ 돌아간다', cls:'adv-reveal', on:()=>advOpenCamp(advCurrentCamp())} ]);
}
/* ─── 🏕 캠프 거래 · 무기 조합 ─────────────────────────────────────────────────
   ★ 요청: 거래/조합 스크립트를 가운데가 아니라 **오른쪽 이동 영역 패널**에 칸 배치로 띄운다.
   패널 모드는 _advPanel('move'|'shop'|'craft') — 모듈 변수(비영속)라 껐다 켜면 항상 이동으로 복귀한다.
   조합은 캠프에서만(작업대). 재료 무기는 소모된다. 조합 결과 최대 공격력 +6(권총 +5 바로 위). */
const ADV_CRAFT_MATS=['nail','tape','part','powder'];
const ADV_CAMP_OFFERS=[
  { give:[['can',3]],           get:{armor:'guard'} },
  { give:[['can',6],['med',2]], get:{armor:'vest'}  },
  { give:[['med',1]],           get:{items:[['can',2]]} },
  { give:[['can',1]],           get:{items:[['flash',1]]} },
  // ★ 조합 재료 판매 — 통조림·약품으로 산다
  { give:[['can',1]],           get:{items:[['nail',2]]} },
  { give:[['can',2]],           get:{items:[['tape',1]]} },
  { give:[['med',1]],           get:{items:[['part',1]]} },
  { give:[['can',3]],           get:{items:[['powder',1]]} },
];
/* 조합표 — base:소모되는 무기(전부 있어야 함) · mats:소모되는 재료 · out:결과 무기
   repair는 특수 항목(장착 무기 내구도 회복). */
const ADV_CRAFT=[
  { out:'nailbat', base:['bat'],          mats:[['nail',2],['tape',1]] },
  { out:'spear',   base:['pipe','knife'], mats:[['tape',1]] },
  { out:'axeplus', base:['axe'],          mats:[['part',1],['nail',2]] },
  { out:'zipgun',  base:['pipe'],         mats:[['powder',2],['part',1]] },
  { out:'', repair:3, base:[],            mats:[['tape',1]] },
];
function advOfferGive(o){ return advCostText(o.give); }
function advOfferOut(o){   // 거래 결과를 칸에 표시하기 위한 {id, n}
  if(o.get.armor) return {id:o.get.armor, n:1};
  return {id:o.get.items[0][0], n:o.get.items[0][1]};
}
function advOfferGet(o){
  if(o.get.armor){ const it=ADV_WORLD.items[o.get.armor]; return it.name+' 착용'; }
  return advCostText(o.get.items)+'로 교환';
}
function advCanAfford(list){ return list.every(g=>(ADV.inv[g[0]]||0)>=g[1]); }
function advPayItems(list){ list.forEach(g=>{ ADV.inv[g[0]]=(ADV.inv[g[0]]||0)-g[1]; if(ADV.inv[g[0]]<=0) delete ADV.inv[g[0]]; }); }
/* 무기 재고 — 풀(ADV.weapons) + 장착 슬롯을 함께 센다 */
function advWeaponCount(id){
  let n=(ADV.weapons||[]).filter(w=>w.id===id).length;
  const s=activeSlot(); if(s && s.weapon && s.weapon.id===id) n++;
  return n;
}
function advTakeWeapon(id){   // 조합 재료로 무기 1개 소모 — 풀에서 먼저, 없으면 장착 중인 것을 뺀다
  const i=(ADV.weapons||[]).findIndex(w=>w.id===id);
  if(i>=0){ ADV.weapons.splice(i,1); return true; }
  const s=activeSlot();
  if(s && s.weapon && s.weapon.id===id){ s.weapon=null; return true; }
  return false;
}
function advCraftLack(r){   // 부족한 것을 문구로 — 없으면 ''
  const miss=[];
  const need={}; r.base.forEach(id=>need[id]=(need[id]||0)+1);
  for(const id in need){ if(advWeaponCount(id)<need[id]) miss.push(ADV_WORLD.items[id].name); }
  r.mats.forEach(g=>{ if((ADV.inv[g[0]]||0)<g[1]) miss.push(ADV_WORLD.items[g[0]].name+'×'+g[1]); });
  if(r.repair){ const s=activeSlot(), w=s&&s.weapon;
    if(!w) miss.push('장착한 무기');
    else if(w.dur>=((ADV_WORLD.items[w.id]||{}).maxDur||1)) miss.push('(이미 멀쩡함)'); }
  return miss.join(' · ');
}
function advCraftCostText(r){
  const parts=r.base.map(id=>ADV_WORLD.items[id].name);
  return parts.concat(r.mats.map(g=>ADV_WORLD.items[g[0]].name+'×'+g[1])).join(' + ');
}
function advDoCraft(i){
  const r=ADV_CRAFT[i]; if(!r) return;
  if(advCraftLack(r)){ advToast('재료가 부족해요'); return; }
  let msg='';
  if(r.repair){
    const s=activeSlot(), w=s.weapon, it=ADV_WORLD.items[w.id];
    advPayItems(r.mats);
    w.dur=Math.min(it.maxDur||1, w.dur+r.repair);
    msg='<p class="good">🧰 '+esc(it.name)+'을(를) 손봤다. 내구도 '+w.dur+'/'+(it.maxDur||1)+'.</p>';
  }else{
    r.base.forEach(id=>advTakeWeapon(id));
    advPayItems(r.mats);
    advGrantItem(r.out,1);   // 무기는 ADV.weapons로(더블클릭 장착)
    const it=ADV_WORLD.items[r.out];
    msg='<p class="good">'+it.icon+' '+esc(it.name)+'을(를) 완성했다! (공격력 +'+it.weapon+' · 내구도 '+it.maxDur+')</p>'
       +'<p class="sys">아이템 창에서 더블클릭하면 장착돼요.</p>';
  }
  advSave(); advRenderSim();
  advCampLog(msg);
  advRenderMoveNav();   // 패널 즉시 갱신(재료 소모 반영)
}
function advCampBuy(i){
  const o=ADV_CAMP_OFFERS[i]; if(!o) return;
  if(!advCanAfford(o.give)){ advToast('물자가 부족하다'); return; }
  advPayItems(o.give);
  let msg='';
  if(o.get.armor){ advEquipArmor(o.get.armor); msg='<p class="good">'+esc(ADV_WORLD.items[o.get.armor].name)+'을(를) 착용했다. 방어력 '+ADV.armor+'.</p>'; }
  if(o.get.items){ o.get.items.forEach(g=>advGrantItem(g[0], g[1]));
    msg='<p class="good">'+esc(advCostText(o.get.items))+'을(를) 받았다.</p>'; }
  advSave(); advRenderSim();
  advCampLog(msg);
  advRenderMoveNav();
}
/* 캠프 화면(가운데)은 그대로 두고 결과 한 줄만 덧붙인다 — 패널 조작이 가운데 화면을 갈아엎지 않게 */
function advCampLog(html){
  ADV._campLog=html;
  advOpenCamp(advCurrentCamp());
}
function advOpenCampPanel(mode){   // 캠프 선택지 → 오른쪽 패널을 거래/조합으로 전환
  _advPanel=mode;
  ADV._campLog='';
  advOpenCamp(advCurrentCamp());
  advRenderMoveNav();
}

/* ─── D#8 목격 시스템: 파티 비보스 스토리는 방장(키퍼)이 진행 · crew는 관전 → 종료 시 도덕 결과를 목격 ───
   결정적 규칙(방장=진행자)이라 레이스 없음. ‘먼저 연 사람 진행’은 호스트 트랜잭션이 있으면 확장 가능. */
const ADV_STORY_WITNESS={
  good:   '<p class="sys">문틈으로 안을 엿본다.</p><p><span class="good">{actor}</span>가 상대에게 온정을 베푸는 모습이 보였다. 조용한 안도가 스친다.</p>',
  evil:   '<p class="sys">문틈으로 안을 엿본다.</p><p class="bad">{actor}가 서슴없이 손을 쓰는 걸 목격했다. 등줄기가 서늘해진다.</p>',
  neutral:'<p class="sys">문틈으로 안을 엿본다.</p><p><span class="good">{actor}</span>가 아무것도 건드리지 않고 조용히 물러나는 걸 보았다.</p>',
};
function advStoryDriver(){ return !advIsParty() || partyCount()<=1 || iAmLeader(); }   // 방장=진행자, crew=관전
function advStorySpectate(bi){
  ADV._spectate=bi;
  const dn=advPartyLeaderName();
  const d=PARTY.data, lm=d&&d.leader&&d.members&&d.members[d.leader];
  const sh=lm && lm.storyHtml;   // ★ #7: 방장이 방송한 진행 비트 — 전원이 같은 이야기를 본다
  let html;
  if(sh){
    html = sh + '<hr style="border-color:#333">'
      + '<p class="sys">★ <span class="good">'+esc(dn)+'</span>'+advJosa(dn,'이','가')+' 일행을 대표해 선택한다. 함께 지켜보는 중…</p>';
  }else{
    html = '<p><span class="loc">[ ★ 함께 진입 ]</span></p>'
      + '<p class="sys">일행이 함께 안으로 들어섰다. <span class="good">'+esc(dn)+'</span>'+advJosa(dn,'이','가')+' 앞장선다…</p>';
  }
  advPrompt(html, []);
}
function advBroadcastWitness(){   // 방장(진행자)이 스토리 종료 시 도덕 결과를 방송 → 관전자 목격
  if(!advIsParty() || !iAmLeader() || !fbReady() || !PARTY.pid) return;
  const st=ADV.story; if(!st || typeof st.bldg!=='number') return;
  const moral = st.align || 'neutral';
  try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {witnessMoral:moral, witnessActor:myNick(), witnessBldg:st.bldg, witnessTs:Date.now()}); }catch(_){}
}
/* ─── D#7 파티 투표: votable 비트(예: wounded_courier)는 crew도 투표로 참여, 방장이 집계해 진행 ─── */
function advVotableNow(beat){ return !!(beat && beat.vote && advIsParty() && partyCount()>1); }
function _voteBeatId(tok){ return String(tok||'').split('#')[0]; }   // 토큰 → 실제 비트id
function advVoteTally(tok){   // {counts:{idx:n}, voted, winner} — 토큰 단위 격리
  const M=partyMembers(), counts={}; let voted=0;
  for(const uid in M){ const mm=M[uid]; if(mm && mm.voteBeat===tok && typeof mm.voteChoice==='number'){ counts[mm.voteChoice]=(counts[mm.voteChoice]||0)+1; voted++; } }
  let winner=null, best=-1;
  Object.keys(counts).forEach(k=>{ const i=+k; if(counts[i]>best){ best=counts[i]; winner=i; } });   // 동점→낮은 인덱스
  return {counts, voted, winner};
}
function advOpenVote(beatId){   // 방장이 투표 개시(고유 토큰) + 투표 화면
  const st=ADV.story; if(!st) return;
  const tok=beatId+'#'+Date.now();
  ADV._voteStory=st.id; ADV._voteBeat=tok;
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {voteStory:st.id, voteBeat:tok, voteBldg:st.bldg, voteOpenTs:Date.now(), voteChoice:null}); }catch(_){} }
  advRenderVote(st.id, tok);
}
function advCastVote(i){
  if(ADV._voteBeat==null) return;
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {voteChoice:i, voteBeat:ADV._voteBeat, voteTs:Date.now()}); }catch(_){} }
  advRenderVote(ADV._voteStory, ADV._voteBeat);
}
function advRenderVote(storyId, tok){
  const sc=advFindStory(storyId); if(!sc) return; const beat=sc.beats[_voteBeatId(tok)]; if(!beat) return;
  ADV._voteStory=storyId; ADV._voteBeat=tok;
  const M=partyMembers(), t=advVoteTally(tok);
  const myVote=(M[myUid()] && M[myUid()].voteBeat===tok && typeof M[myUid()].voteChoice==='number') ? M[myUid()].voteChoice : null;
  const choices=beat.choices||[]; const stForText = ADV.story || {};
  let html='<p><span class="loc">[ 파티 투표 ]</span></p>'
    +'<p class="sys">동료들과 함께 결정한다. ('+t.voted+'/'+partyCount()+' 투표'+(iAmLeader()?' · 방장이 집계':'')+')</p>'
    +(typeof beat.text==='function'?beat.text(stForText):(beat.text||''));
  const btns=choices.map((c,i)=>{
    const lbl=(typeof c.label==='function'?c.label(stForText):c.label);
    const cnt=t.counts[i]||0, mine=myVote===i;
    let cls=c.moral==='good'?'adv-good':(c.moral==='evil'?'adv-evil':'');
    return {label:(mine?'✔ ':'')+lbl+' <span class="sys">('+cnt+')</span>', cls:cls, on:()=>advCastVote(i)};
  });
  if(iAmLeader()) btns.push({label:'📊 집계하고 진행', cls:'adv-reveal', on:()=>advResolveVote(storyId, tok)});
  else html+='<p class="sys">방장이 집계하길 기다리는 중…</p>';
  advPrompt(html, btns);
}
function advResolveVote(storyId, tok){   // 방장만: 최다표 선택으로 진행
  const sc=advFindStory(storyId); if(!sc) return; const beat=sc.beats[_voteBeatId(tok)]; if(!beat) return;
  const t=advVoteTally(tok);
  let win = (t.winner!=null) ? t.winner : ((mv=>(mv&&typeof mv.voteChoice==='number')?mv.voteChoice:0)(partyMembers()[myUid()]));
  const c=(beat.choices||[])[win]; if(!c) return;
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {voteOpenTs:0}); }catch(_){} }
  ADV._voteBeat=null; ADV._voteStory=null;
  advStoryChoice(c);   // 방장이 결정대로 진행(도덕/보상/전투 등은 기존 로직)
}
/* ─── D#6 스토리 게이지 라운드제: 화술(경계심) 페이즈를 파티 공유 — 각자 1굴림/라운드, 임계 도달 시 막타 접근으로 결말 귀속 ───
   솔로/1인은 기존 advStoryChoice 그대로. advGame/$pid/gauge 사용(호스트 함수 없으면 자동 솔로 폴백). */
function advHostGauge(){ try{ return !!(window.firebaseAPI && firebaseAPI.advWriteGauge && firebaseAPI.advWatchGauge); }catch(_){ return false; } }
function advGaugeShared(){ return advIsParty() && partyCount()>1 && advHostGauge(); }
function advWriteGauge(patch){ if(fbReady() && PARTY.pid && firebaseAPI.advWriteGauge){ try{ firebaseAPI.advWriteGauge(PARTY.pid, patch); }catch(_){} } }
function advSubscribeGauge(){ if(!advHostGauge() || !PARTY.pid) return; try{ PARTY.unsubGauge && PARTY.unsubGauge(); }catch(_){}
  PARTY.unsubGauge = firebaseAPI.advWatchGauge(PARTY.pid, d=>advSyncGauge(d)); }
function advEndGaugeSub(){ try{ PARTY.unsubGauge && PARTY.unsubGauge(); }catch(_){} PARTY.unsubGauge=null; }
function advOpenGauge(sc, beatId){   // 방장이 게이지 라운드 개시
  const st=ADV.story;
  const init={ storyId:sc.id, beatId, bldg:st.bldg, wary:(typeof st.wary==='number'?st.wary:(sc.gauge.init||0)), round:1, rolled:{}, lastRoller:'', lastLow:'', done:false, openTs:Date.now() };
  ADV._gauge=init; advWriteGauge(init); advRenderGauge();
}
function advSyncGauge(d){
  if(!d){ ADV._gauge=null; return; }
  ADV._gauge=d;
  if(d.done){
    if(!iAmLeader()){ ADV._gauge=null; if(ADV._spectate!=null) advStorySpectate(ADV._spectate); }   // crew: 결말 목격 대기
    return;
  }
  const involved = iAmLeader() || (ADV._spectate!=null && ADV._spectate===d.bldg) || (ADV.story && ADV.story.bldg===d.bldg);
  if(d.openTs && involved) advRenderGauge();
}
function advRenderGauge(){
  const g=ADV._gauge; if(!g) return;
  const sc=advFindStory(g.storyId); if(!sc) return; const beat=sc.beats[g.beatId]; if(!beat) return;
  const gg=sc.gauge, w=Math.max(gg.low, Math.min(gg.high, g.wary||0));
  const rolled=g.rolled||{}, iRolled=rolled[myUid()]!=null;
  const rollers=Object.keys(rolled).length, total=partyCount();
  let html='<p><span class="loc">[ 화술 · 라운드 '+(g.round||1)+' ]</span></p>'
    +'<p>'+advWaryMeter({wary:w}, gg)+'</p>'
    +'<p class="sys">이번 라운드 굴림 ('+rollers+'/'+total+')'+(iRolled?' · 나: 완료 ✔':'')+'</p>';
  const btns=[];
  (beat.choices||[]).forEach((c,i)=>{
    const isRoll = !!(c.check || (c.ok&&typeof c.ok.wary==='number') || typeof c.wary==='number');
    const lbl=(typeof c.label==='function'?c.label(ADV.story||{}):c.label);
    if(isRoll){
      const cls=(c.moral==='good'?'adv-good':(c.moral==='evil'?'adv-evil':''));
      if(iRolled) btns.push({label:lbl+' 🔒', cls:(cls+' adv-locked').trim(), on:()=>advToast('이번 라운드는 이미 굴렸어요')});
      else btns.push({label:lbl, cls:cls, on:()=>advGaugeRoll(i)});
    } else if(iAmLeader()){
      btns.push({label:lbl+' <span class="sys">(방장)</span>', cls:(c.moral==='evil'?'adv-evil':''), on:()=>advGaugeLeaderDecide(i)});
    }
  });
  advPrompt(html, btns);
}
function advGaugeRoll(idx){
  const g=ADV._gauge; if(!g || (g.rolled && g.rolled[myUid()]!=null)) return;
  const sc=advFindStory(g.storyId); const beat=sc.beats[g.beatId]; const c=beat.choices[idx]; const gg=sc.gauge;
  const s=activeSlot();
  let branch=c, ok=true;
  if(c.check){ const roll=advD20(), eff=roll-Math.floor(statEff(s,c.check[0])/2); ok=eff<=c.check[1]; branch=ok?c.ok:c.fail; }
  const delta=(typeof branch.wary==='number')?branch.wary:(typeof c.wary==='number'?c.wary:0);
  const w=Math.max(gg.low, Math.min(gg.high, (g.wary||0)+delta));
  const rolled=Object.assign({}, g.rolled||{}); rolled[myUid()]=idx;
  const patch={ wary:w, rolled, lastRoller:myUid(), lastLow:(ok&&branch.low)?branch.low:(g.lastLow||'') };
  if(w<=gg.low){ patch.done=true; patch.outcomeTo=(ok&&branch.low)?branch.low:(g.lastLow||branch.low||'end'); }
  else if(w>=gg.high){ patch.done=true; patch.outcomeTo=gg.highTo; }
  else if(Object.keys(rolled).length>=partyCount()){ patch.round=(g.round||1)+1; patch.rolled={}; }   // 전원 굴림 → 다음 라운드
  ADV._gauge=Object.assign({}, g, patch);
  advWriteGauge(patch);
  advToast('🎲 '+(ok?'설득이 먹혔다':'분위기가 굳었다')+' (경계심 '+w+')');
  if(patch.done && iAmLeader()) advGaugeFinish(patch.outcomeTo, patch.lastRoller);
  else advRenderGauge();
}
function advGaugeLeaderDecide(idx){   // 방장 전용 결정적 선택(전투/물러남) → 게이지 종료 후 기존 로직
  const g=ADV._gauge; if(!g) return;
  advWriteGauge({done:true}); advEndGaugeSub(); ADV._gauge=null;
  const sc=advFindStory(g.storyId); const beat=sc.beats[g.beatId]; const c=beat.choices[idx];
  advStoryChoice(c);
}
function advGaugeFinish(to, roller){   // 방장: 막타 결말로 진행
  advWriteGauge({done:true}); ADV._gauge=null;
  const rm=roller && partyMembers()[roller];
  const rn=(roller===myUid())?'나':((rm&&(rm.charName||rm.nick))||'동료');
  const prefix='<p class="sys">🏁 결정적 접근: <span class="good">'+esc(rn)+'</span></p>';
  if(!to || to==='end') advEndStory();
  else advGotoStoryBeat(to, prefix);
}
function advOpenStoryStub(bi){
  const m=advEnsureMap(); const bd=m.buildings[bi];
  if(bd.band===2){   // 3분기 ★건물 = 보스전 (좀비 무리 → 연구소 카드키)
    advPrompt('<p><span class="loc">[ ★ '+bd.t+' ]</span></p>'
      +'<p>문을 밀자 비릿한 공기가 왈칵 쏟아진다. 어둠 속, 수십 개의 눈이 일제히 이쪽으로 돌아간다.</p>'
      +'<p class="bad">🧟‍♀️ 좀비 무리다. 연구소 카드키는 저 안에 있다 — 뚫고 지나가는 수밖에 없다.</p>',
      [ {label:'⚔ 맞선다!', cls:'adv-reveal', on:()=>advStartCombat(2,'horde')} ]);
    return;
  }
  if(!advStoryDriver()){ advStorySpectate(bi); return; }   // D#8: crew는 관전(방장이 진행)
  if(ADV.story && ADV.story.bldg===bi){ advGotoStoryBeat(ADV.story.beat,''); return; }   // 진행 중 씬 재개
  const done=(ADV.map.storyDone||[]).includes(bi);
  if(!done && advStartStoryScene(bd.band, bi)) return;   // 그 분기 풀에서 새 씬 시작
  advPrompt('<p><span class="loc">[ ★ '+bd.t+' ]</span></p><p class="sys">'
    +(done?'이미 지나온 곳이다. 남은 건 정적뿐.':'무거운 공기가 감돈다… 이 분기의 이야기는 다음 업데이트에서 열립니다.')+'</p>',
    [ {label:'🚶 물러난다', cls:'adv-reveal', on:advOpenMove} ]);
}

/* ◎ 목표(연구소) 도달 — 열쇠 체크 */
function advOpenGoal(){
  const hasKey=(ADV.inv.labkey||0)>0;
  let html='<p><span class="loc">[ ▲▣ 연구소 ]</span></p><p>거대한 강철 문. 라디오 방송의 목적지다.</p>';
  const btns=[];
  if(hasKey){
    html+='<p class="good">💳 연구소 카드키가 손에 있다.</p>';
    btns.push({label:'🔓 입장한다', cls:'adv-reveal', on:advReachNormalEnding});
  }else{
    html+='<p class="bad">문은 굳게 잠겨 있다. 카드키가 필요하다.</p><p class="sys">3분기 어딘가 — ★ 건물의 \'무리\'가 카드키를 갖고 있다는 소문이 있다.</p>';
    btns.push({label:'🔒 입장한다 (카드키 필요)', on:()=>{}});
  }
  btns.push({label:'🚶 물러난다', on:advOpenMove});
  advPrompt(html, btns);
}

/* ▲▣ 노말엔딩 — 연구소 입장 성공 → 서사 → 리절트 보고서 */
function advReachNormalEnding(){
  // ★ 파티장이 엔딩 도달 → 세션 종료: 사유 전달 후 해산(팀원은 실종 보고서 흐름)
  if(advIsParty() && PARTY.pid && iAmLeader()){
    const pid=PARTY.pid;
    try{ PARTY.unsubParty&&PARTY.unsubParty(); }catch(_){}
    PARTY.unsubParty=null; PARTY.pid=null; PARTY.data=null; ADV.partyPid=null;
    if(fbReady()){
      if(firebaseAPI.advUpdateMember){ try{ firebaseAPI.advUpdateMember(pid, myUid(), {ended:'clear'}); }catch(_){} }
      if(firebaseAPI.advDisbandParty){ try{ firebaseAPI.advDisbandParty(pid); }catch(_){} }
    }
  }
  advPrompt('<p class="good">문이 열린다. 오랜 도피가 끝났다.</p>'
    +'<p>연구소 안, 흰 방역복의 사람들이 카드키를 확인한다. 그들의 표정이 바뀐다 — <span class="good">"항체 보유자다."</span></p>'
    +'<p class="sys">당신이 지나온 길이 한 장의 기록으로 정리된다.</p>',
    [ {label:'📄 결과 보고서', cls:'adv-reveal', on:()=>advShowReport('normal')} ]);
}

/* 📄 리절트 보고서 (노말=SURVIVED / 배드=FAILED 공용, kind로 분기) */
function advSurvivalText(){
  const start = ADV.runStart || Date.now();
  const hours = Math.max(0, Math.floor((Date.now()-start)/60000));   // 1분 = 1시간
  const d=Math.floor(hours/24), h=hours%24;
  return (d>0?(d+'일 '):'')+h+'시간';
}
function advBuildReport(kind){
  const s=activeSlot()||{};
  const items=Object.keys(ADV.inv||{}).filter(id=>ADV.inv[id]>0 && ADV_WORLD.items[id])
    .map(id=>ADV_WORLD.items[id].name+'×'+ADV.inv[id]);
  return { kind:kind, name:(s.name || (typeof defaultName==='function'?defaultName():'생존자')), age:s.age||'',
    title: slotTitleName(s) || (kind==='normal'?'생존자':'실종자'),
    kills:ADV.runKills||0, outlaws:ADV.runOutlaws||0,
    items: items.length?items.join(', '):'없음',
    face: slotFaceUrl(s, faceStateKey()), faceEmoji:s.face||'🧑‍🚒',
    verdict: kind==='bad'?'FAILED':(kind==='missing'?'MISSING':'SURVIVED'), surv:advSurvivalText(), ts:new Date() };
}
function advReportFileNo(d){ return 'No.'+String(1000+((d.kills*7+d.outlaws*13)%9000)).padStart(4,'0'); }
function advReportDateStr(d){ const t=d.ts; return t.getFullYear()+'.'+String(t.getMonth()+1).padStart(2,'0')+'.'+String(t.getDate()).padStart(2,'0'); }
function advReportCardHtml(d){
  const photo = d.face ? '<img src="'+d.face+'" alt="">' : d.faceEmoji;
  const vcls = d.kind==='normal'?'ok':'bad';   // 실종(missing)도 적색 판정
  return '<div class="adv-report" id="advReportCard">'
    +'<div class="adv-rpt-head"><span>▲▣ CLASSIFIED</span><span>'+advReportFileNo(d)+'</span></div>'
    +'<div class="adv-rpt-title">SURVIVOR REPORT</div>'
    +'<div class="adv-rpt-main"><div class="adv-rpt-photo'+(d.kind==='bad'?' dead':'')+'">'+photo+'</div>'
    +'<div class="adv-rpt-fields">'
    +'<div class="adv-rpt-row"><span>성명</span><b>'+esc(d.name)+(d.age?(' ('+esc(String(d.age))+')'):'')+'</b></div>'
    +'<div class="adv-rpt-row"><span>분류</span><b>'+esc(d.title)+'</b></div>'
    +'<div class="adv-rpt-row"><span>좀비 처치</span><b>'+d.kills+'</b></div>'
    +'<div class="adv-rpt-row"><span>무법자 처치</span><b>'+d.outlaws+'</b></div>'
    +'<div class="adv-rpt-row"><span>확보 물자</span><b>'+esc(d.items)+'</b></div>'
    +'<div class="adv-rpt-row"><span>기록일</span><b>'+advReportDateStr(d)+'</b></div>'
    +'</div></div>'
    +'<div class="adv-rpt-verdict '+vcls+'">판정 · '+d.verdict+'</div>'
    +'<div class="adv-rpt-surv">당신은 <b>'+d.surv+'</b> 동안 생존했습니다.</div>'
    +'<div class="adv-rpt-stamp">TOP SECRET</div></div>';
}
function advShowReport(kind, lead){
  const d=advBuildReport(kind); ADV._lastReport=d;
  const btns=[ {label:'📥 이미지로 저장', on:advDownloadReport} ];
  if((ADV._chat||[]).length || (ADV._fb||[]).length){ btns.push({label:'📝 채팅 기록 저장', on:advDownloadChatLog}); }   // 파티 대화/피드백이 있으면 txt 저장
  btns.push({label:'⟲ 로비로', cls:'adv-reveal', on:()=>{ ADV.hp=100; ADV.inf=0; ADV.map=null; _advMapCache=null; ADV.deeds=[]; ADV.story=null; advClearSessionGear(); advSave(); advRenderSim(); advShowModeSelect(); }});
  advPrompt((lead||'')+advReportCardHtml(d), btns);
}
// 📝 파티 대화 기록 → .txt 다운로드 (demoji/이미지 마커는 읽기 좋게 변환)
function advDownloadChatLog(){
  const arr=(ADV._chat||[]).filter(m=>!m.sys);   // ★ #6: 로컬 안내는 기록에서 제외
  const fb=(ADV._fb||[]).slice().sort((a,b)=>(a.ts||0)-(b.ts||0));
  if(!arr.length && !fb.length){ advToast('저장할 대화가 없어요'); return; }
  const clean=(t)=>String(t||'')
    .replace(/\[imgs:(\S+?)\]/g, '[이미지: $1]')
    .replace(/\[demoji:(d\d{2})\]/g, (m,id)=>{ const d=(typeof DEMOJI_BY_ID!=='undefined')&&DEMOJI_BY_ID[id]; return d?('/'+d.cmd):'[이모티콘]'; });
  const pad=n=>String(n).padStart(2,'0');
  const line=m=>{ const dt=new Date(m.ts||Date.now());
    return '['+pad(dt.getHours())+':'+pad(dt.getMinutes())+'] '+advChatName(m.uid, m.name, m.asNick)+': '+clean(m.text); };   // ★ 요청1/2: 닉/캐릭터명
  const fbLine=m=>{ const dt=new Date(m.ts||Date.now());
    return '['+pad(dt.getHours())+':'+pad(dt.getMinutes())+'] ('+m.x+','+m.y+') '+advChatName(m.uid, m.name)+': '+clean(m.text); };   // ★ 요청1: 피드백(좌표 태그)
  const now=new Date();
  const head='좀아칼 SURVIVE — 파티 대화 기록\n'
    +now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+' '+pad(now.getHours())+':'+pad(now.getMinutes())+'\n'
    +'────────────────────────────\n';
  let body=arr.map(line).join('\n');
  if(fb.length){ body+=(body?'\n':'')+'\n──── 🗨 피드백 (칸별 한마디) ────\n'+fb.map(fbLine).join('\n'); }
  try{
    const blob=new Blob([head+body+'\n'], {type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='좀아칼_대화기록_'+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes())+'.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }catch(_){ advToast('저장에 실패했어요'); }
}
/* 📥 보고서 PNG 저장 — 라이브러리 없이 canvas 직접 렌더(서버·CORS 무관, 오염 시 사진만 제외) */
function advDownloadReport(){
  const d=ADV._lastReport; if(!d) return;
  const W=340, H=322, S=2;
  const paint=(img)=>{
    const cv=document.createElement('canvas'); cv.width=W*S; cv.height=H*S;
    const g=cv.getContext('2d'); g.scale(S,S); g.textBaseline='top';
    g.fillStyle='#e7e1cd'; g.fillRect(0,0,W,H);
    g.strokeStyle='#b3a884'; g.lineWidth=1; g.strokeRect(4,4,W-8,H-8);
    g.fillStyle='#7a2020'; g.font='bold 12px "Courier New",monospace'; g.textAlign='left'; g.fillText('▲▣ CLASSIFIED',18,16);
    g.textAlign='right'; g.fillText(advReportFileNo(d),W-18,16);
    g.fillRect(18,32,W-36,2);
    g.fillStyle='#171310'; g.font='bold 16px "Courier New",monospace'; g.textAlign='center'; g.fillText('SURVIVOR REPORT',W/2,44);
    const px=22,py=74,ps=82;
    g.fillStyle='#cbc4ab'; g.fillRect(px,py,ps,ps);
    if(img){ if(d.kind==='bad'){ g.filter='grayscale(1) brightness(.85)'; } g.drawImage(img,px+2,py+2,ps-4,ps-4); g.filter='none'; }
    else { g.fillStyle='#5a5346'; g.font='40px serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(d.faceEmoji||'🧑',px+ps/2,py+ps/2); g.textBaseline='top'; }
    g.strokeStyle='#453f32'; g.lineWidth=2; g.strokeRect(px,py,ps,ps); g.lineWidth=1;
    const fx=px+ps+16; let fy=76;
    const rows=[['성명',d.name+(d.age?(' ('+d.age+')'):'')],['분류',d.title],['좀비 처치',String(d.kills)],['무법자 처치',String(d.outlaws)],['확보 물자',d.items],['기록일',advReportDateStr(d)]];
    g.font='11px "Courier New",monospace';
    rows.forEach(r=>{
      g.fillStyle='#6a6250'; g.textAlign='left'; g.fillText(r[0],fx,fy);
      g.fillStyle='#171310'; g.textAlign='right';
      let v=String(r[1]); while(g.measureText(v).width>(W-18-fx-58) && v.length>3){ v=v.slice(0,-2)+'…'; }
      g.fillText(v,W-18,fy);
      g.strokeStyle='#a89d7c'; g.setLineDash([2,2]); g.beginPath(); g.moveTo(fx,fy+15); g.lineTo(W-18,fy+15); g.stroke(); g.setLineDash([]);
      fy+=19;
    });
    const vok=d.kind!=='bad', vc=vok?'#1a5a2a':'#7a2020';
    g.strokeStyle=vc; g.lineWidth=2; g.strokeRect(22,H-78,W-44,22); g.lineWidth=1;
    g.fillStyle=vc; g.font='bold 12px "Courier New",monospace'; g.textAlign='center'; g.fillText('판정 · '+d.verdict,W/2,H-72);
    g.fillStyle='#4a4436'; g.font='11px "Courier New",monospace'; g.textAlign='center'; g.fillText('당신은 '+d.surv+' 동안 생존했습니다.',W/2,H-46);
    g.save(); g.translate(W-70,H-24); g.rotate(-13*Math.PI/180);
    g.strokeStyle='rgba(150,20,20,.68)'; g.lineWidth=3; g.strokeRect(-46,-14,92,28);
    g.fillStyle='rgba(150,20,20,.68)'; g.font='bold 14px "Courier New",monospace'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('TOP SECRET',0,0);
    g.restore();
    try{
      const url=cv.toDataURL('image/png');
      const a=document.createElement('a'); a.href=url; a.download='survivor_report_'+advReportFileNo(d).replace('No.','')+'.png';
      document.body.appendChild(a); a.click(); a.remove();
      advToast('보고서를 저장했어요');
    }catch(e){
      if(img){ advToast('사진은 CORS로 제외하고 저장합니다'); paint(null); }
      else advToast('이미지 저장에 실패했어요');
    }
  };
  if(d.face){ const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>paint(im); im.onerror=()=>paint(null); im.src=d.face; }
  else paint(null);
}

const FACE_THRESH = { bHp:75, cHp:50, dHp:25 };   // HP 단계별 프로필: a평상≥75 / b부상 50~74 / c감염 25~49 / d위중 <25
function faceStateKey(){
  if(ADV.hp<FACE_THRESH.dHp) return 'd';   // 위중
  if(ADV.hp<FACE_THRESH.cHp) return 'c';   // 감염(중상)
  if(ADV.hp<FACE_THRESH.bHp) return 'b';   // 부상
  return 'a';                              // 평상
}
function slotFaceUrl(slot, key){   // 폴백: 지정 상태 → a → 레거시 faceImg → (없으면 이모지)
  const f=(slot&&slot.faceImgs)||{};
  return (key&&f[key]) || f.a || (slot&&slot.faceImg) || null;
}
function statusText(){
  if(ADV.inf>=70) return '☣ 감염 위험';
  if(ADV.hp<40) return '🩸 부상';
  if(ADV.inf>=30) return '⚠ 오염 노출';
  return '정상';
}
/* ★ 몸 상태 문구 — 감염률 아래에 붉은 글씨로. 양호하면 아무것도 안 나온다.
   grp별로 '가장 심한 것 하나'만 고른다(위에서부터 먼저 걸리는 것). 문구 수정은 여기 한 곳. */
const ADV_BODY_SIGNS=[
  { grp:'inf',  lv:2, when:()=>ADV.inf>=70, txt:'몸에 열이 오른다. 손이 떨린다.' },
  { grp:'inf',  lv:1, when:()=>ADV.inf>=45, txt:'몸살을 느낀다. 관절이 쑤신다.' },
  { grp:'inf',  lv:1, when:()=>ADV.inf>=20, txt:'물린 자리가 욱신거린다.' },
  { grp:'hp',   lv:2, when:()=>ADV.hp<=25,  txt:'출혈이 크다. 시야가 흐려진다.' },
  { grp:'hp',   lv:1, when:()=>ADV.hp<=50,  txt:'상처에서 피가 배어 나온다.' },
  { grp:'hp',   lv:0, when:()=>ADV.hp<=75,  txt:'몸 여기저기가 쓸렸다.' },
  { grp:'st',   lv:1, when:()=>ADV.st<=15,  txt:'숨이 가쁘다. 다리가 무겁다.' },
  { grp:'st',   lv:0, when:()=>ADV.st<=35,  txt:'피로가 쌓였다.' },
  { grp:'gear', lv:0, when:()=>{ const w=activeSlot()&&activeSlot().weapon; return !!w && weaponDurPct(w)<=25; },
                      txt:'무기가 곧 부서질 것 같다.' },
];
function advBodySigns(){
  const seen={}, out=[];
  ADV_BODY_SIGNS.forEach(sg=>{ if(seen[sg.grp]) return;
    let hit=false; try{ hit=!!sg.when(); }catch(_){}
    if(!hit) return; seen[sg.grp]=1; out.push(sg); });
  return out;
}
function advRenderBody(){
  const box=document.getElementById('advBody'); if(!box) return;
  const html=advBodySigns().map(sg=>'<div class="adv-body-line lv'+sg.lv+'">'+sg.txt+'</div>').join('');
  if(box._advLastHtml!==html){ box.innerHTML=html; box._advLastHtml=html; }   // diff-guard(파티 콜백 재렌더 대비)
}

/* ─────────────────────────── 세계관 콘텐츠 (좀비) ───────────────────────────
   판타지 팩 확장 시 이 객체만 교체. 씬 그래프: choices[].next로 이동. */
const ADV_WORLD = {
  id:'zombie',
  title:'🧟 SURVIVE — 감염 구역',
  folderName:'좀아칼au',
  statNames:{str:'💪 힘', agi:'🏃 민첩', int:'🧠 지능', luk:'🍀 운'},
  items:{
    can:  {name:'통조림',    icon:'🥫', desc:'사용 시 HP +15', use:{hp:15}},
    med:  {name:'약품 상자', icon:'💊', desc:'사용 시 HP +30', use:{hp:30}},
    flash:{name:'손전등',    icon:'🔦', desc:'사용 시 기력 +10', use:{st:10}},
    bat:  {name:'야구방망이', icon:'🏏', desc:'무기 · 공격력 +3 · 내구도 소모', weapon:3, maxDur:5},
    pipe: {name:'쇠파이프',   icon:'🔧', desc:'무기 · 공격력 +2 · 튼튼하다', weapon:2, maxDur:7},
    knife:{name:'등산용 칼',  icon:'🔪', desc:'무기 · 공격력 +3 · 금방 무뎌진다', weapon:3, maxDur:4},
    wrench:{name:'대형 렌치', icon:'🛠', desc:'무기 · 공격력 +2 · 좀처럼 망가지지 않는다', weapon:2, maxDur:9},
    axe:  {name:'소방도끼',   icon:'🪓', desc:'무기 · 공격력 +4 · 묵직하다', weapon:4, maxDur:5},
    pistol:{name:'권총',     icon:'🔫', desc:'무기 · 공격력 +5 · 내구도 소모', weapon:5, maxDur:6},
    /* ★ 조합 전용 결과물 — 캠프 작업대에서만 만들 수 있다(ADV_CRAFT) */
    nailbat:{name:'못박은 방망이', icon:'🪵', desc:'조합품 · 공격력 +6 · 험하게 부서진다', weapon:6, maxDur:4},
    spear:{name:'급조 창',    icon:'🔱', desc:'조합품 · 공격력 +5 · 사거리가 길어 오래 버틴다', weapon:5, maxDur:7},
    axeplus:{name:'강화 소방도끼', icon:'⛏', desc:'조합품 · 공격력 +6 · 균형이 잘 잡혔다', weapon:6, maxDur:6},
    zipgun:{name:'사제 산탄총', icon:'💥', desc:'조합품 · 공격력 +6 · 몇 발 못 간다', weapon:6, maxDur:3},
    /* ★ 조합 재료 — 캠프에서 통조림·약품으로 사거나 필드에서 줍는다 */
    nail: {name:'못',        icon:'🔩', desc:'조합 재료. 무엇이든 박아 넣을 수 있다.'},
    tape: {name:'청테이프',   icon:'🩹', desc:'조합 재료. 세상 대부분은 이걸로 붙는다.'},
    part: {name:'고철 부품',  icon:'⚙️', desc:'조합 재료. 쓸 만한 금속 조각.'},
    powder:{name:'화약',     icon:'🧨', desc:'조합 재료. 다루기 위험하다.'},
    medkit:{name:'백신 의료기기', icon:'🧪', desc:'키퍼의 피로 간이 백신을 만드는 장치. (파티 전용 · 우클릭 → 백신 추출)'},
    vaccine:{name:'간이 백신', icon:'💉', desc:'동료의 감염을 낮춘다. (우클릭 → 동료 선택 · 감염 −40 / 키퍼 HP −20)'},
    guard:{name:'보호구',     icon:'🛡', desc:'착용 시 방어력이 되어 HP 대신 소모된다.', armor:12},
    vest: {name:'방탄복',     icon:'🦺', desc:'착용 시 두꺼운 방어력을 준다. HP 대신 소모.', armor:24},
    key:  {name:'낡은 열쇠',  icon:'🗝', desc:'어딘가의 문을 열 수 있을 것 같다'},
    labkey:{name:'연구소 카드키', icon:'💳', desc:'▲▣ 연구소의 문을 여는 카드키. 노말엔딩의 조건.'},
  },
  scenes:{
    /* ── 챕터0 튜토리얼: 무너진 캠프 ── */
    camp:{  // 씬1 — 인트로 (모드별 첫 문장 분기)
      introTogether:[
        '<p><span class="loc">[안전 캠프 · 폐허가 된 쇼핑몰 · 밤]</span></p>',
        '<p>좀비가 세상을 삼킨 지 6개월. 살아남은 이들은 이 쇼핑몰에 모여 하루하루를 버텨왔다.</p>',
        '<p>오늘 밤, 북쪽 방어선이 무너졌다. 비명과 함께 감염자들이 쏟아져 들어온다.</p>',
        '<p><span class="npc">지훈</span> "뛰어! 여기 있으면 다 죽어!"</p>',
        '<p class="good">갑작스러운 혼란에 친구들과 함께 도망쳤다.</p>'
      ],
      introSolo:[
        '<p><span class="loc">[안전 캠프 · 폐허가 된 쇼핑몰 · 밤]</span></p>',
        '<p>좀비가 세상을 삼킨 지 6개월. 살아남은 이들은 이 쇼핑몰에 모여 하루하루를 버텨왔다.</p>',
        '<p>오늘 밤, 북쪽 방어선이 무너졌다. 비명과 함께 감염자들이 쏟아져 들어온다.</p>',
        '<p><span class="npc">지훈</span> "뛰어! 여기 있으면 다 죽어!"</p>',
        '<p class="bad">갑작스러운 혼란에 친구들과 뿔뿔이 흩어졌다.</p>'
      ],
      choices:[
        {label:'일단 도망친다', need:null, cost:0, next:'escape', result:[
          '<p>생각할 겨를이 없다. 무작정 출구를 향해 달렸다.</p>']},
      ]
    },
    escape:{  // 씬2 — 도망 (민첩/운)
      intro:[
        '<p><span class="loc">[쇼핑몰 뒷계단 · 비상구]</span></p>',
        '<p>감염자들이 바로 뒤까지 쫓아온다. 숨이 턱끝까지 차오른다.</p>'
      ],
      choices:[
        {label:'전력으로 계단을 뛰어내려간다', need:['agi',2], cost:10, next:'first', result:[
          '<p><span class="roll">[민첩 판정: 성공]</span></p>',
          '<p class="good">아슬아슬하게 비상구를 빠져나왔다. 등 뒤로 문이 쾅 닫힌다.</p>']},
        {label:'운에 맡기고 몸을 던진다', need:['luk',2], cost:10, next:'first', result:[
          '<p><span class="roll">[운 판정: 성공]</span></p>',
          '<p class="good">굴러떨어지듯 내려가 겨우 벗어났다. 무릎이 까졌지만 살았다.</p>']},
      ]
    },
    first:{  // 씬3 — 첫 감염자 (미니 상황)
      intro:[
        '<p><span class="loc">[비상구 밖 골목]</span></p>',
        '<p>벽에 기댄 채 숨을 고르는데, 그림자 하나가 비틀거리며 다가온다. 감염자다. 아직 하나뿐이다.</p>'
      ],
      choices:[
        {label:'조용히 물러선다', need:['agi',2], cost:8, next:'weapon', result:[
          '<p><span class="roll">[민첩 판정: 성공]</span></p>',
          '<p class="good">소리 없이 뒷걸음쳐 놈의 시야에서 벗어났다.</p>']},
        {label:'돌을 던져 주의를 돌린다', need:['luk',2], cost:8, next:'weapon', result:[
          '<p><span class="roll">[운 판정: 성공]</span></p>',
          '<p class="good">돌이 엉뚱한 곳에 맞고, 감염자가 그쪽으로 절뚝인다. 그 틈에 빠져나왔다.</p>']},
      ]
    },
    weapon:{  // 씬4 — 무기 조달
      intro:[
        '<p><span class="loc">[상가 1층 · 철물점 앞]</span></p>',
        '<p>셔터가 반쯤 내려진 철물점. 안쪽에 쓸 만한 게 보인다.</p>'
      ],
      choices:[
        {label:'야구방망이를 집는다', need:null, cost:5, gain:[['bat',1]], next:'shutter', result:[
          '<p class="good">🏏 야구방망이를 얻었다! (인벤토리에 저장)</p>',
          '<p class="sys">💡 [인벤토리] 폴더에서 [장착]하면 공격력이 올라요.</p>']},
        {label:'주변을 더 뒤진다', need:['int',2], cost:8, gain:[['bat',1],['flash',1]], next:'shutter', result:[
          '<p><span class="roll">[지능 판정: 성공]</span></p>',
          '<p class="good">🏏 야구방망이 + 🔦 손전등까지 챙겼다.</p>',
          '<p class="sys">💡 [인벤토리]에서 야구방망이를 [장착]해보세요.</p>']},
      ]
    },
    shutter:{  // 씬5 — 셔터 아래 (장착 확인 미니 전투)
      intro:[
        '<p><span class="loc">[철물점 안쪽]</span></p>',
        '<p>안쪽으로 들어서자, 진열대 뒤에서 감염자가 튀어나온다!</p>'
      ],
      choices:[
        {label:'무기로 밀쳐낸다', need:null, cost:10, weaponCheck:true, next:'food', result:[
          '<p class="good">야구방망이로 놈을 쳐내고 문을 닫았다.</p>'],
          resultNoWeapon:[
          '<p class="bad">맨손이라 제대로 막지 못했다. 가까스로 몸으로 밀쳐냈다. (HP -10)</p>'], hpNoWeapon:10},
        {label:'재빨리 몸을 피한다', need:['agi',3], cost:10, next:'food', result:[
          '<p><span class="roll">[민첩 판정: 성공]</span></p>',
          '<p class="good">옆으로 굴러 피했다.</p>']},
      ]
    },
    food:{  // 씬6 — 식량 조달
      intro:[
        '<p><span class="loc">[편의점 잔해]</span></p>',
        '<p>텅 빈 진열대 사이, 굴러다니는 통조림 몇 개가 눈에 띈다.</p>'
      ],
      choices:[
        {label:'통조림을 챙긴다', need:null, cost:5, gain:[['can',2]], next:'zombie', result:[
          '<p class="good">🥫 통조림 ×2를 얻었다. (사용하면 HP 회복)</p>',
          '<p class="sys">💡 다치면 [인벤토리]에서 [사용]해 HP를 회복할 수 있어요.</p>']},
        {label:'계산대 안쪽까지 살핀다', need:['luk',3], cost:8, gain:[['can',2],['med',1]], next:'zombie', result:[
          '<p><span class="roll">[운 판정: 성공]</span></p>',
          '<p class="good">🥫 통조림 ×2 + 💊 약품 상자를 발견했다.</p>']},
      ]
    },
    zombie:{  // 씬7 — 좀비 조우 (강제 전투)
      intro:[
        '<p><span class="loc">[골목 어귀]</span></p>',
        '<p>앞을 가로막는 감염자. 좁은 골목이라 피할 곳이 없다.</p>'
      ],
      choices:[
        {label:'도망친다', need:null, cost:5, forceCombat:true, next:'info', result:[
          '<p class="bad">빠져나갈 틈이 없다! 놈이 달려든다 — 싸울 수밖에 없다!</p>']},
        {label:'무기를 들고 맞선다', need:null, cost:15, combat:true, next:'info'},
      ]
    },
    info:{  // 씬8 — 집결 관문 + 다른 캠프 정보
      gather:true,
      intro:[
        '<p><span class="loc">[무너진 버스 정류장]</span></p>',
        '<p>벽에 누군가 남긴 낙서와 화살표. 다른 캠프의 위치 같다.</p>'
      ],
      choices:[
        {label:'낙서를 해독한다', need:['int',2], cost:8, next:'arrive', result:[
          '<p><span class="roll">[지능 판정: 성공]</span></p>',
          '<p class="good">"남쪽 지하철역… 안전. 물자 있음." 새 캠프의 위치를 알아냈다.</p>']},
        {label:'함께 벽을 조사한다', need:null, cost:8, gatherCoop:true, next:'arrive', result:[
          '<p class="good">흩어졌던 동료들이 하나둘 모였다. 여럿이 단서를 맞추자 위치는 물론 안전한 경로까지 파악했다!</p>']},
        {label:'감으로 남쪽을 향한다', need:null, cost:10, next:'arrive', result:[
          '<p>확신은 없지만 발걸음을 옮긴다.</p>']},
      ]
    },
    arrive:{  // 씬9 — 캠프 도착 (종료 + 저장)
      intro:[
        '<p><span class="loc">[남쪽 지하철역 입구]</span></p>',
        '<p>마침내 새 은신처가 보인다. 입구를 지키던 생존자가 손짓한다.</p>'
      ],
      choices:[
        {label:'지하철역 캠프로 들어간다', need:null, cost:0, saveCamp:'hub', next:'hub', result:[
          '<p class="good">무사히 새 캠프에 도착했다. 지친 몸을 뉜다.</p>',
          '<p class="sys">💾 [캠프 위치가 저장되었습니다.] 앞으로 정찰 후 복귀하면 이곳으로 돌아옵니다.</p>',
          '<p class="good">★ 튜토리얼 완료! 곧 본편이 시작됩니다.</p>']},
      ]
    },
    hub:{  // 씬10 — 지하철역 캠프 (허브 · 파티 관리)
      hub:true,
      intro:[
        '<p><span class="loc">[남쪽 지하철역 캠프]</span></p>',
        '<p>안쪽은 제법 정돈돼 있다. 생존자들이 흩어져 있고, 캠프 밖으로는 아직 가보지 못한 구역이 남아 있다.</p>'
      ],
      choices:[
        {label:'🧭 주변을 정찰한다', need:null, cost:15, scout:true},
        {label:'🎒 짐을 정리한다', need:null, cost:0, openInv:true},
      ]
    }
  },
  enemy:{ name:'감염자', atk:8, def:4, infect:15 }
};
const STAT_KEYS = ['str','agi','int','luk'];

/* ─────────────────────────── 칭호 (타이틀) ───────────────────────────
   슬롯별 누적 카운터로 해금. 여러 개 해금 시 캐릭터세팅에서 대표 칭호 선택.
   치유 계열은 선물하기 기능 구현 시 추가 예정. */
const ADV_TITLES = [
  // id, 표시명, 계열 카운터 키, 필요치
  { id:'kill1', name:'무자비한',     stat:'kills',    need:100 },
  { id:'kill2', name:'도살자',       stat:'kills',    need:300 },
  { id:'kill3', name:'좀비 사냥꾼',  stat:'kills',    need:500 },
  { id:'out1',  name:'인간혐오자',   stat:'outlaws',  need:100 },   // 히든 — 착용 시 무법자 공격력 ×2
  { id:'good1', name:'선량한',       stat:'good',     need:50,  mod:{luk:4} },              // 착용 시 운 +4
  { id:'good2', name:'순환하는',     stat:'good',     need:100, mod:{luk:6} },              // 착용 시 운 +6
  { id:'evil1', name:'제멋대로인',   stat:'evil',     need:50,  mod:{luk:-4, str:1, agi:1, int:1} },   // 운 -4 / 힘·민첩·지능 +1
  { id:'evil2', name:'무법자',       stat:'evil',     need:100, mod:{luk:-6, str:2, agi:2, int:2} },   // 운 -6 / 힘·민첩·지능 +2
  { id:'exp1',  name:'믿음직한',     stat:'explores', need:100 },
  { id:'exp2',  name:'탐색꾼',       stat:'explores', need:200 },
  { id:'exp3',  name:'길잡이',       stat:'explores', need:300 },
  { id:'exp4',  name:'개척자',       stat:'explores', need:500 },
];
function titleById(id){ return ADV_TITLES.find(t=>t.id===id)||null; }
// 방금 카운터가 오른 뒤, 새로 해금된 칭호가 있으면 알림 반환 + 첫 칭호는 자동 대표 설정
function advCheckTitleUnlock(s, stat){
  let out='';
  ADV_TITLES.filter(t=>t.stat===stat).forEach(t=>{
    if((s[stat]||0)===t.need){   // 정확히 도달한 순간
      out+='<p class="crit">🏅 새 칭호 획득: 「'+t.name+'」</p>';
      if(!s.title) s.title=t.id;   // 대표 칭호가 없으면 자동 장착
    }
  });
  return out;
}
// 슬롯이 해금한 칭호 목록
function unlockedTitles(s){ return ADV_TITLES.filter(t=>(s[t.stat]||0)>=t.need); }
// 슬롯의 대표 칭호명 (선택된 게 아직 유효하면 그것, 아니면 없음)
function slotTitleName(s){
  if(!s) return '';
  if(s.title){ const t=titleById(s.title); if(t && (s[t.stat]||0)>=t.need) return t.name; }
  return '';
}

/* ─────────────────────────── 스타일 ─────────────────────────── */
const css = `
  /* ── 미니 바탕화면 ── */
  #advDesktop{position:absolute;inset:0;z-index:3;background:#3a8a8a;overflow:hidden;
    font-family:Tahoma,'맑은 고딕',sans-serif;}
  #advDesktop.adv-visiting .adv-icon{opacity:.75;cursor:default;}
  .adv-icon{position:absolute;width:66px;text-align:center;cursor:pointer;user-select:none;}
  .adv-icon .ic{font-size:30px;line-height:1;filter:drop-shadow(1px 1px 0 rgba(0,0,0,.35));}
  .adv-icon .lb{display:inline-block;margin-top:3px;font-size:10px;color:#fff;padding:1px 3px;line-height:1.3;
    text-shadow:1px 1px 0 rgba(0,0,0,.55);}
  .adv-icon:not(.disabled):hover .lb{background:#000080;}
  #advIconSim{left:12px;top:14px;}
  #advIconChar{left:90px;top:14px;}
  #advTaskbar{position:absolute;left:0;right:0;bottom:0;height:20px;background:#c0c0c0;
    border-top:1px solid #fff;display:flex;align-items:center;padding:0 3px;gap:4px;z-index:4;}
  #advEnvBtn{font-size:10px;padding:1px 8px;background:#c0c0c0;cursor:pointer;
    border:1px solid;border-color:#fff #404040 #404040 #fff;}
  #advEnvBtn:active{border-color:#404040 #fff #fff #404040;}
  #advEnvMenu{position:absolute;left:4px;bottom:22px;z-index:6;background:#c0c0c0;display:none;
    border:2px solid;border-color:#fff #404040 #404040 #fff;box-shadow:2px 2px 0 rgba(0,0,0,.3);
    flex-direction:column;min-width:170px;}
  #advEnvMenu.on{display:flex;}
  #advEnvMenu button{font-size:10.5px;text-align:left;padding:5px 10px;background:none;border:none;cursor:pointer;}
  #advEnvMenu button:hover{background:#000080;color:#fff;}
  /* 🔌 외부 앱이 추가한 환경설정 하위메뉴 (MYHOME_DESKTOP.addEnvMenu)
     ⚠️ 펼침 칸 클래스는 **mhd-fly** 다. '.fly' 로 되돌리지 말 것 —
       desk-companion-prototype.html 에 채팅 「날리기」의 전역 '.fly{animation:flyAcross; pointer-events:none; font:700 27px …}'
       가 있어서, 이름이 같으면 서브메뉴가 그 애니메이션을 받아 옆으로 흘러가 버린다(2026-09-17 제보). sim-mhd-envsub 가 본다. */
  .mhd-envsub{position:relative;display:flex;flex-direction:column;}
  .mhd-envsub>.hd{display:flex;justify-content:space-between;align-items:center;gap:10px;}
  .mhd-envsub .mhd-fly{display:none;position:absolute;left:100%;bottom:0;z-index:7;background:#c0c0c0;
    border:2px solid;border-color:#fff #404040 #404040 #fff;box-shadow:2px 2px 0 rgba(0,0,0,.3);
    flex-direction:column;min-width:104px;}
  .mhd-envsub.on .mhd-fly{display:flex;}
  .mhd-envsub .mhd-fly button.sel::before{content:'· ';}
  #advUrlBox{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9;display:none;
    background:#c0c0c0;border:2px solid;border-color:#fff #404040 #404040 #fff;box-shadow:3px 3px 0 rgba(0,0,0,.35);
    padding:8px;width:78%;}
  #advUrlBox.on{display:block;}
  #advUrlBox .t{font-size:10.5px;font-weight:bold;margin-bottom:5px;}
  #advUrlBox input{width:100%;font-size:11px;padding:2px 4px;box-sizing:border-box;}
  #advUrlBox .row{display:flex;justify-content:flex-end;gap:5px;margin-top:7px;}
  #advUrlBox .row button{font-size:10.5px;padding:2px 12px;background:#c0c0c0;cursor:pointer;
    border:1px solid;border-color:#fff #404040 #404040 #fff;}

  /* ── 공용 Win98 팝업 창 ── */
  .adv-win{position:absolute;z-index:20;background:#c0c0c0;display:none;flex-direction:column;
    border:2px solid;border-color:#fff #000 #000 #fff;
    box-shadow:inset -1px -1px 0 #808080,inset 1px 1px 0 #d4d0c8,3px 3px 0 rgba(0,0,0,.4);
    font-family:Tahoma,'맑은 고딕',sans-serif;max-width:calc(100% - 12px);max-height:calc(100% - 26px);}
  .adv-win.on{display:flex;}
  .adv-titlebar{background:linear-gradient(90deg,#5a0000,#a01010);color:#fff;font-weight:bold;font-size:11.5px;
    padding:3px 7px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .adv-titlebar .x{width:16px;height:14px;font-size:9px;background:#c0c0c0;color:#000;cursor:pointer;
    border:1px solid;border-color:#fff #000 #000 #fff;display:flex;align-items:center;justify-content:center;}
  .adv-tb-right{display:flex;align-items:center;gap:8px;}
  .adv-bgm-btn{cursor:pointer;display:flex;align-items:center;line-height:1;opacity:.9;}
  .adv-bgm-btn:hover{opacity:1;}

  /* ── 시뮬 창: 바탕화면 꽉 채움 · 다크 게임 UI ── */
  /* 시뮬 창: 열리면 마이홈 창(#myHomeWin) 전체를 덮음 (스티커·탭까지) */
  #advSimWin{position:absolute;inset:0;width:auto;height:auto;max-width:none;max-height:none;transform:none;z-index:150;}
  #advSimWin.on{display:flex;}
  #advSimInner{display:flex;flex-direction:column;flex:1;min-height:0;background:#000;position:relative;}
  .adv-sim-main{display:flex;flex:1;min-height:0;position:relative;}   /* position: 아이템 툴팁(#advTip)의 기준 */
  /* ★ 몸 상태 문구 — 감염률 아래. 양호하면 비어 있어 높이도 0 */
  .adv-body{padding:1px 7px 3px;display:flex;flex-direction:column;gap:1px;}
  .adv-body-line{font-size:9.5px;line-height:1.45;color:#c86a6a;}
  .adv-body-line.lv1{color:#e05a5a;}
  .adv-body-line.lv2{color:#ff5252;font-weight:bold;animation:advBodyPulse 1.8s ease-in-out infinite;}
  @keyframes advBodyPulse{0%,100%{opacity:.62}50%{opacity:1}}
  /* ★ 아이템 설명 툴팁 */
  .adv-tip{position:absolute;z-index:40;display:none;max-width:190px;padding:6px 8px;
    background:rgba(10,14,11,0.98);border:1px solid #3a5a44;border-radius:4px;
    box-shadow:0 4px 12px rgba(0,0,0,0.65);pointer-events:none;font-family:Tahoma,'맑은 고딕',sans-serif;}
  .adv-tip.on{display:flex;flex-direction:column;gap:2px;}
  .adv-tip b{font-size:10.5px;color:#e8e8d8;}
  .adv-tip .eff{font-size:10px;color:#5fd06a;}
  .adv-tip .dur{font-size:9px;color:#c9a83a;}
  /* 좌측 패널 */
  .adv-left{width:158px;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid #444;}
  .adv-id-row{display:flex;border-bottom:1px solid #444;}
  .adv-portrait{width:56px;height:56px;flex-shrink:0;background:#1a3a8a;color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden;
    border-right:1px solid #444;}
  .adv-portrait img{width:100%;height:100%;object-fit:cover;}
  .adv-id-meta{flex:1;min-width:0;padding:4px 6px;color:#eee;font-size:9.5px;line-height:1.5;background:#0a0a0a;
    display:flex;flex-direction:column;justify-content:center;}
  .adv-id-meta b{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .adv-id-meta .lv{color:#e0c060;font-size:8.5px;}
  .adv-rows{flex:1;overflow-y:auto;min-height:0;}
  .adv-row{display:flex;align-items:center;border-bottom:1px solid #333;font-size:9.5px;min-height:19px;}
  .adv-row .k{width:52px;flex-shrink:0;background:#1a1a1a;color:#ddd;padding:2px 5px;border-right:1px solid #333;}
  .adv-row .v{flex:1;min-width:0;color:#eee;padding:2px 5px;display:flex;align-items:center;gap:4px;}
  .adv-row .bar{flex:1;height:10px;background:#222;border:1px solid #555;position:relative;overflow:hidden;}
  .adv-row .bar>i{display:block;height:100%;}
  .adv-row .bar.hp>i{background:#c0392b;}
  .adv-row .bar.st>i{background:#2a7ac0;}
  .adv-row .bar.inf>i{background:#7a2a8a;}
  .adv-row .num{font-size:8.5px;color:#bbb;flex-shrink:0;}
  /* 우측 스크립트 영역 */
  .adv-stage{flex:1;min-width:0;display:flex;flex-direction:column;}
  .adv-stage-top{flex:1;min-height:0;display:flex;}
  .adv-center{flex:1;min-width:0;display:flex;flex-direction:column;position:relative;}
  .adv-fb-btn{position:absolute;top:5px;right:6px;z-index:6;width:24px;height:22px;padding:0;font-size:13px;line-height:20px;text-align:center;cursor:pointer;background:#12324a;color:#dff;border:1px solid #3a6a8a;border-radius:4px;}
  .adv-fb-btn.on{background:#2a5a3a;border-color:#4a9a6a;}
  .adv-fb-btn.has-new::after{content:'';position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:#ff5b5b;border:1px solid #0d0f0c;}
  .adv-fb-pop{position:absolute;top:30px;right:6px;bottom:6px;left:6px;z-index:5;display:flex;flex-direction:column;background:rgba(8,12,10,0.97);border:1px solid #2a4a3a;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,0.6);}
  .adv-fb-pop.hidden{display:none;}
  .adv-fb-hd{flex:0 0 auto;display:flex;align-items:center;gap:4px;padding:6px 8px;border-bottom:1px solid #1e3a2c;color:#bfe8cf;font-size:12px;font-weight:bold;}
  .adv-fb-hd .adv-fb-sub{font-weight:normal;color:#6f8f7c;font-size:10px;}
  .adv-fb-x{margin-left:auto;background:none;border:0;color:#7fae8f;font-size:12px;cursor:pointer;padding:0 2px;}
  .adv-fb-list{flex:1;min-height:0;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:8px;}
  .adv-fb-empty{color:#5f7a6a;font-size:11px;text-align:center;line-height:1.8;margin:auto;}
  .adv-fb-item{display:flex;gap:8px;align-items:flex-start;}
  .adv-fb-face{flex:0 0 auto;width:38px;height:38px;border-radius:5px;overflow:hidden;background:#12201a;border:1px solid #2a4a3a;display:flex;align-items:center;justify-content:center;}
  .adv-fb-face img{width:100%;height:100%;object-fit:cover;display:block;}
  .adv-fb-face .emo{font-size:20px;}
  .adv-fb-body{flex:1;min-width:0;}
  .adv-fb-who{font-size:10px;color:#9fd8b4;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .adv-fb-who .adv-fb-at{color:#6a8a9a;margin-left:5px;}
  .adv-fb-bubble{position:relative;background:#132b20;color:#e6f2ea;border:1px solid #2f5a44;border-radius:4px 10px 10px 10px;padding:5px 9px;line-height:1.35;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
  .adv-fb-in{flex:0 0 auto;display:flex;gap:4px;padding:6px 8px;border-top:1px solid #1e3a2c;}
  .adv-fb-in input{flex:1;min-width:0;background:#0a0f0c;color:#dfe;border:1px solid #2a4a3a;border-radius:3px;padding:4px 6px;font-size:11px;outline:none;box-shadow:none;}
  .adv-fb-in input:focus{border-color:#3a7a5a;}
  .adv-fb-in button{font-size:11px;padding:4px 10px;cursor:pointer;background:#1c4a34;color:#dfe;border:1px solid #3a7a5a;border-radius:3px;white-space:nowrap;}
  .adv-move-panel{width:232px;flex-shrink:0;display:flex;flex-direction:column;border-left:1px solid #333;
    background-color:#0b0b0b;overflow-y:auto;padding:8px 8px 10px;}   /* background 단축 금지: 눈 background-image가 지워진다 */
  .adv-move-panel.disabled{opacity:.4;pointer-events:none;}
  .adv-move-panel.hidden{display:none;}   /* 로비(시작 전) — 가운데가 전체 영역 사용 */
  .adv-move-flavor{color:#b9b19a;font-family:'Courier New',monospace;font-size:11px;line-height:1.5;margin:0 0 5px;}
  .adv-chat-panel{flex-shrink:0;height:150px;display:flex;flex-direction:column;border-top:1px solid #333;background:#0c1116;}
  .adv-chat-panel.hidden{display:none;}
  .adv-chat-near{font-size:11px;font-style:italic;color:#7fd0e0;padding:4px 9px 0;}
  .adv-chat-panel .adv-chat{margin:0;border:none;border-radius:0;background:transparent;flex:1;display:flex;flex-direction:column;min-height:0;}
  .adv-chat-panel .adv-chat-msgs{flex:1;min-height:0;max-height:none;}   /* ★ #4: 78px 캡 해제 → 입력칸이 패널 맨 아래에 붙음 */
  .adv-chat-msgs img.adv-demoji{vertical-align:middle;image-rendering:auto;}   /* /명령어 이모티콘(demoji) */
  .adv-chat-msgs img.adv-chat-img{display:block;max-width:70%;max-height:96px;border-radius:4px;border:1px solid #1c3440;margin:2px 0;}
  .adv-img-spoiler{display:inline-block;cursor:pointer;font-size:10.5px;color:#7fd0e0;margin:2px 0;}
  .adv-img-spoiler u{text-underline-offset:2px;}
  .adv-img-spoiler:hover{color:#aee8f5;}
  .adv-img-pop{display:flex;align-items:center;gap:6px;padding:4px 6px;background:#0a141c;border-top:1px solid #1c3440;font-size:10.5px;color:#9cc;flex-wrap:wrap;}
  .adv-img-pop input[type=text]{flex:1;min-width:120px;background:#0a0f14;color:#dff;border:1px solid #2a4a5a;border-radius:3px;padding:3px 6px;font-size:10.5px;outline:none;}
  .adv-img-sp{display:flex;align-items:center;gap:3px;white-space:nowrap;cursor:pointer;}
  #advChatImgBtn{font-size:12px;padding:2px 7px;background:#0a0f14;color:#7fd0e0;border:1px solid #2a4a5a;border-radius:3px;cursor:pointer;flex-shrink:0;}
  #advChatImgBtn:hover{background:#12222c;}
  /* ─── ❄ 눈 내리는 배경 — 스크립트 영역과 이동 영역 ────────────────────────────
     사용자 확정 수치(미리보기 도구): 속도 3초 · 슬라이드 -1 · 회전 -60도 ±26
     · 속도 편차 40% · 방향 편차 3단계 · 흐림 4px · 3.2×14.4px · 밀도 7 · 밝기 0.2
     눈송이 하나 = 작은 SVG 타일(data URI). radial-gradient는 회전이 안 돼서 SVG로 그린다.
     3겹 깊이감: 앞층일수록 크고 흐릿하고(feGaussianBlur) 빠르다. 뒤로 갈수록 작고 선명하고 어둡다.
     입자별 속도·방향 편차 = 타일 크기를 조금씩 다르게 준 결과(각 입자는 자기 타일 크기의 정수배만큼
     이동해야 반복 이음매가 안 보인다 → 타일이 작으면 같은 시간에 덜 움직이니 느려진다).
     background-attachment 기본값이 '요소에 고정'이라 터미널 글이 스크롤돼도 눈은 제자리.
     ★ 두 선택자에서 background 단축 속성을 쓰면 이 background-image가 통째로 지워진다. background-color로만 쓸 것.
     끄려면 animation:none. 수치를 바꾸려면 gen-snow.js의 V를 고쳐 다시 생성. */
  .adv-terminal, .adv-move-panel{
    background-image:
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22219%22%20height%3D%22219%22%20viewBox%3D%220%200%20219%20219%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2273%22%20cy%3D%22171%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-83.2%2073%20171)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22115%22%20height%3D%22115%22%20viewBox%3D%220%200%20115%20115%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2237%22%20cy%3D%2242%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-42.0%2037%2042)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22181%22%20height%3D%22181%22%20viewBox%3D%220%200%20181%20181%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22141%22%20cy%3D%2238%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-72.8%20141%2038)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22211%22%20height%3D%22211%22%20viewBox%3D%220%200%20211%20211%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22116%22%20cy%3D%2248%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-70.5%20116%2048)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22146%22%20height%3D%22146%22%20viewBox%3D%220%200%20146%20146%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22109%22%20cy%3D%2236%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-62.5%20109%2036)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22142%22%20height%3D%22142%22%20viewBox%3D%220%200%20142%20142%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2249%22%20cy%3D%2238%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-76.5%2049%2038)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22131%22%20height%3D%22131%22%20viewBox%3D%220%200%20131%20131%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%224.00%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2232%22%20cy%3D%2224%22%20rx%3D%221.60%22%20ry%3D%227.20%22%20transform%3D%22rotate(-62.0%2032%2024)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.200%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22234%22%20height%3D%22234%22%20viewBox%3D%220%200%20234%20234%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%221.60%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2244%22%20cy%3D%2228%22%20rx%3D%221.09%22%20ry%3D%224.90%22%20transform%3D%22rotate(-39.8%2044%2028)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.164%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22197%22%20height%3D%22197%22%20viewBox%3D%220%200%20197%20197%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%221.60%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2283%22%20cy%3D%22183%22%20rx%3D%221.09%22%20ry%3D%224.90%22%20transform%3D%22rotate(-69.8%2083%20183)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.164%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22230%22%20height%3D%22230%22%20viewBox%3D%220%200%20230%20230%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%221.60%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22146%22%20cy%3D%22156%22%20rx%3D%221.09%22%20ry%3D%224.90%22%20transform%3D%22rotate(-59.8%20146%20156)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.164%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22235%22%20height%3D%22235%22%20viewBox%3D%220%200%20235%20235%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%221.60%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22134%22%20cy%3D%22135%22%20rx%3D%221.09%22%20ry%3D%224.90%22%20transform%3D%22rotate(-34.9%20134%20135)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.164%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22225%22%20height%3D%22225%22%20viewBox%3D%220%200%20225%20225%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%221.60%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2228%22%20cy%3D%22192%22%20rx%3D%221.09%22%20ry%3D%224.90%22%20transform%3D%22rotate(-42.4%2028%20192)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.164%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22123%22%20height%3D%22123%22%20viewBox%3D%220%200%20123%20123%22%3E%3Cdefs%3E%3Cfilter%20id%3D%22b%22%20x%3D%22-80%25%22%20y%3D%22-80%25%22%20width%3D%22260%25%22%20height%3D%22260%25%22%3E%3CfeGaussianBlur%20stdDeviation%3D%221.60%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22110%22%20cy%3D%2292%22%20rx%3D%221.09%22%20ry%3D%224.90%22%20transform%3D%22rotate(-39.0%20110%2092)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.164%22%20filter%3D%22url(%23b)%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22115%22%20height%3D%22115%22%20viewBox%3D%220%200%20115%20115%22%3E%3Cdefs%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2249%22%20cy%3D%2226%22%20rx%3D%220.74%22%20ry%3D%223.31%22%20transform%3D%22rotate(-63.3%2049%2026)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.132%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22189%22%20height%3D%22189%22%20viewBox%3D%220%200%20189%20189%22%3E%3Cdefs%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2269%22%20cy%3D%2232%22%20rx%3D%220.74%22%20ry%3D%223.31%22%20transform%3D%22rotate(-45.7%2069%2032)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.132%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22230%22%20height%3D%22230%22%20viewBox%3D%220%200%20230%20230%22%3E%3Cdefs%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2296%22%20cy%3D%22111%22%20rx%3D%220.74%22%20ry%3D%223.31%22%20transform%3D%22rotate(-76.9%2096%20111)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.132%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22135%22%20height%3D%22135%22%20viewBox%3D%220%200%20135%20135%22%3E%3Cdefs%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%22100%22%20cy%3D%2230%22%20rx%3D%220.74%22%20ry%3D%223.31%22%20transform%3D%22rotate(-34.4%20100%2030)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.132%22%2F%3E%3C%2Fsvg%3E"),
      url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22189%22%20height%3D%22189%22%20viewBox%3D%220%200%20189%20189%22%3E%3Cdefs%3E%3C%2Fdefs%3E%3Cellipse%20cx%3D%2241%22%20cy%3D%22179%22%20rx%3D%220.74%22%20ry%3D%223.31%22%20transform%3D%22rotate(-71.1%2041%20179)%22%20fill%3D%22%23e2f0ff%22%20fill-opacity%3D%220.132%22%2F%3E%3C%2Fsvg%3E");
    background-size:219px 219px, 115px 115px, 181px 181px, 211px 211px, 146px 146px, 142px 142px, 131px 131px, 234px 234px, 197px 197px, 230px 230px, 235px 235px, 225px 225px, 123px 123px, 115px 115px, 189px 189px, 230px 230px, 135px 135px, 189px 189px;
    background-repeat:repeat;
    animation:advSnowFall 3s linear infinite;
  }
  @keyframes advSnowFall{
    from{ background-position:0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0, 0 0; }
    to  { background-position:1752px 1314px, 920px 690px, 1629px 1086px, 1688px 1266px, 1314px 876px, 852px 852px, 1179px 786px, 468px 936px, 394px 788px, 1380px 920px, 1410px 940px, 1125px 900px, 492px 492px, 0px 345px, 945px 567px, 920px 690px, 540px 405px, 567px 567px; }
  }
  @media (prefers-reduced-motion: reduce){ .adv-terminal, .adv-move-panel{ animation:none; } }
  .adv-terminal{flex:1;min-height:0;background-color:#0d0f0c;color:#d0d4cc;font-family:'Courier New',monospace;   /* background 단축 금지: 눈 background-image가 지워진다 */
    font-size:11.5px;line-height:1.55;padding:8px 10px;overflow-y:auto;}
  .adv-terminal .loc{color:#e0c060;font-weight:bold;}
  .adv-terminal .npc{color:#7fd4ff;}
  .adv-terminal .sys{color:#8a8f86;font-style:italic;}
  .adv-terminal .roll{color:#e0c060;}
  .adv-terminal .good{color:#8fe38f;}
  .adv-terminal .bad{color:#e37f7f;}
  .adv-terminal .crit{color:#ffb0ff;font-weight:bold;}
  .adv-terminal p{margin:0 0 7px;}
  .adv-choices{flex-shrink:0;padding:5px 6px;display:flex;flex-direction:column;gap:3px;background:#0a0a0a;
    border-top:1px solid #333;max-height:96px;overflow-y:auto;}
  /* ★ 선택지가 4개 이상이면(캠프 등) 스크롤 대신 세로로 늘린다 — advPrompt가 .tall을 붙인다.
     .has-chat 뒤에 오면 채팅 확장(220px)을 덮어쓰므로 반드시 그 앞에 둘 것. */
  .adv-choices.tall{max-height:186px;}
  /* advPrompt를 거치지 않고 직접 버튼을 채우는 화면(advRenderChoices 등)도 같이 늘어나게 */
  .adv-choices:has(> .adv-choice:nth-child(4)){max-height:186px;}
  .adv-choices.has-chat{max-height:220px;}   /* 💬 탐색 채팅 열림 시 높이 확장 */
  .adv-choice{text-align:left;font-family:Tahoma,'맑은 고딕',sans-serif;font-size:10px;padding:4px 8px;cursor:pointer;
    background:#1a1a1a;color:#dfe;border:1px solid #444;}
  .adv-choice:hover{background:#24302a;border-color:#4a7a5a;}
  .adv-choice .req{float:right;font-size:8.5px;color:#888;}
  .adv-choice.locked{color:#666;cursor:not-allowed;background:#111;}
  .adv-choice.locked:hover{background:#111;border-color:#444;}
  .adv-choice .req.ok{color:#6fc48f;}
  .adv-choice .req.no{color:#d07070;}
  .adv-choice .coop{color:#e0c060;font-weight:bold;}
  .adv-choice.adv-reveal{text-align:center;color:#e0c060;background:#1a1a12;border-color:#5a5a2a;font-weight:bold;}
  .adv-choice.adv-reveal:hover{background:#2a2a18;border-color:#8a8a4a;}
  .adv-choice.adv-depart{color:#e0a060;border-color:#5a4a2a;}
  .adv-gather{text-align:center;color:#e0c060;font-size:10px;padding:4px;background:#1a1a12;border:1px dashed #5a5a2a;margin-bottom:2px;}
  .adv-surv{display:flex;align-items:center;gap:6px;background:#141414;border:1px solid #333;padding:4px 8px;font-size:10.5px;color:#dfe;margin-bottom:3px;}
  .adv-surv .dot{width:7px;height:7px;border-radius:50%;background:#888;flex-shrink:0;}
  .adv-surv .dot.on{background:#2a9a3f;}
  .adv-surv .nm{font-weight:bold;flex-shrink:0;}
  .adv-surv .st{flex:1;min-width:0;color:#9a9;display:flex;align-items:center;gap:5px;}
  .adv-surv .st .off{color:#777;}
  .adv-surv .st button{font-size:9px;padding:1px 8px;background:#1a3a2a;color:#8fe38f;cursor:pointer;
    border:1px solid #3a6a4a;}
  .adv-surv .st button:disabled{color:#666;border-color:#333;}
  /* 하단 파티 바 */
  .adv-party{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:8px;
    background:#050505;border-top:1px solid #444;padding:3px 8px;font-size:9.5px;color:#dfe;}
  .adv-party .mates{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #advPartyAdd{color:#5fdf7f;cursor:pointer;font-weight:bold;flex-shrink:0;background:none;border:none;font-size:9.5px;}
  #advPartyAdd:hover{text-decoration:underline;}
  .adv-party .mate{cursor:pointer;color:#bfe;}
  .adv-party .mate:not(.me):hover{text-decoration:underline;color:#fff;}
  .adv-party .mate.me{color:#9fe;cursor:default;}
  .adv-party-btns{display:flex;gap:5px;flex-shrink:0;}
  .adv-pbtn{color:#5fdf7f;cursor:pointer;background:none;border:none;font-size:9.5px;font-weight:bold;white-space:nowrap;padding:0;}
  .adv-pbtn:hover{text-decoration:underline;color:#fff;}
  /* 시뮬 창 내부 오버레이 팝업 */
  #advFriendPop,#advMemberPop{position:absolute;inset:0;z-index:40;display:none;
    background:rgba(0,0,0,.55);align-items:center;justify-content:center;}
  #advFriendPop.on,#advMemberPop.on{display:flex;}
  .adv-pop-box{width:230px;max-width:90%;max-height:86%;background:#c0c0c0;display:flex;flex-direction:column;
    border:2px solid;border-color:#fff #000 #000 #fff;box-shadow:3px 3px 0 rgba(0,0,0,.4);}
  .adv-pop-title{background:linear-gradient(90deg,#00007a,#1084d0);color:#fff;font-weight:bold;font-size:11px;
    padding:3px 7px;display:flex;justify-content:space-between;align-items:center;}
  .adv-pop-title .x{width:15px;height:13px;font-size:9px;background:#c0c0c0;color:#000;cursor:pointer;
    border:1px solid;border-color:#fff #000 #000 #fff;display:flex;align-items:center;justify-content:center;}
  .adv-pop-note{font-size:9px;color:#555;padding:4px 8px 2px;}
  .adv-fr-list{overflow-y:auto;padding:4px 6px 6px;display:flex;flex-direction:column;gap:3px;min-height:60px;}
  .adv-fr-row{display:flex;align-items:center;gap:6px;background:#fff;padding:3px 6px;font-size:10.5px;
    border:1px solid;border-color:#808080 #fff #fff #808080;}
  .adv-fr-row .dot{width:7px;height:7px;border-radius:50%;background:#aaa;flex-shrink:0;}
  .adv-fr-row .dot.on{background:#2a9a3f;}
  .adv-fr-row .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .adv-fr-row button{font-size:9px;padding:1px 8px;background:#c0c0c0;cursor:pointer;flex-shrink:0;
    border:1px solid;border-color:#fff #404040 #404040 #fff;}
  .adv-fr-row button:disabled{color:#888;}
  .adv-fr-row .in{font-size:8.5px;color:#2a7a3f;flex-shrink:0;}
  .adv-fr-empty{text-align:center;color:#777;font-size:10px;padding:20px 6px;line-height:1.6;}
  .adv-mi-body{padding:9px 11px;font-size:10.5px;color:#222;display:flex;flex-direction:column;gap:5px;}
  .adv-mi-head{display:flex;gap:9px;align-items:center;}
  .adv-mi-face{width:56px;height:56px;flex-shrink:0;background:#1a3a8a;color:#fff;overflow:hidden;
    display:flex;align-items:center;justify-content:center;border:2px solid;border-color:#000 #fff #fff #000;}
  .adv-mi-face img{width:100%;height:100%;object-fit:cover;}
  .adv-mi-face .emo{font-size:30px;}
  .adv-mi-namebox{flex:1;min-width:0;}
  .adv-mi-name{font-size:13px;font-weight:bold;}
  .adv-mi-nick{font-size:9.5px;color:#666;}
  .adv-mi-row b{color:#5a0000;font-weight:bold;margin-right:4px;}
  .adv-mi-loc{color:#00007a;font-size:10px;background:#eef;padding:3px 6px;border:1px solid #ccd;}
  .adv-sim-empty{padding:24px 16px;text-align:center;color:#ccc;font-size:11px;line-height:1.8;background:#000;flex:1;}
  .adv-sim-empty b{color:#e0c060;}

  /* ── 인벤토리 창 ── */
  #advInvWin{left:50%;top:50%;transform:translate(-50%,-50%);width:300px;}
  .adv-inv-body{background:#d4d0c8;padding:6px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;min-height:0;}
  .adv-inv-note{font-size:9px;color:#666;padding:0 2px 2px;}
  .adv-inv-item{display:flex;align-items:center;gap:6px;background:#fff;padding:4px 6px;font-size:10.5px;
    border:1px solid;border-color:#808080 #fff #fff #808080;}
  .adv-inv-item .ic{font-size:16px;flex-shrink:0;}
  .adv-inv-item .nm{flex:1;min-width:0;}
  .adv-inv-item .nm small{display:block;color:#777;font-size:8.5px;}
  .adv-inv-item .ct{font-size:9.5px;color:#333;flex-shrink:0;}
  .adv-inv-item button{font-size:9px;padding:1px 7px;background:#c0c0c0;cursor:pointer;flex-shrink:0;
    border:1px solid;border-color:#fff #404040 #404040 #fff;}
  .adv-inv-item button.eq{background:#2a7a3f;color:#fff;}
  .adv-inv-empty{text-align:center;color:#888;font-size:10px;padding:18px 0;}

  /* ── 캐릭터세팅 창 (시뮬과 동일하게 마이홈 창 전체를 덮음 · 말랑이 위) ── */
  #advCharWin{position:absolute;inset:0;left:0;top:0;transform:none;width:auto;height:auto;max-width:none;max-height:none;z-index:150;}
  #advCharWin.on{display:flex;}
  .adv-char-main{display:flex;flex:1;min-height:0;justify-content:center;padding:14px 44px 0;}
  #advSlotTabs{display:flex;flex-direction:column;gap:4px;background:transparent;padding-top:14px;flex-shrink:0;align-self:flex-start;}
  .adv-slot-tab{writing-mode:vertical-rl;text-orientation:sideways;writing-mode:sideways-lr;text-align:center;
    font-family:'Courier New',monospace;font-size:12px;letter-spacing:1px;padding:11px 5px;cursor:pointer;
    background:#cbc4ab;color:#6a6250;border:1px solid #b3a884;}
  .adv-slot-tab.on{background:#e7e1cd;color:#7a2020;font-weight:bold;border-right:2px solid #7a2020;}
  .adv-slot-tab.active-slot{color:#7a2020;}
  .adv-slot-tab .dot{color:#7a2020;}
  .adv-char-body{padding:12px 15px 16px;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:#2a2620;
    font-family:'Courier New',monospace;position:relative;
    background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.022) 3px 4px),#e7e1cd;
    border:1px solid #b3a884;box-shadow:2px 3px 7px rgba(0,0,0,.35);
    overflow-y:auto;min-height:0;flex:1;width:100%;max-width:720px;margin:0;box-sizing:border-box;}
  .adv-char-body::after{content:'TOP SECRET';position:absolute;bottom:26px;right:30px;transform:rotate(-12deg);
    font-size:16px;font-weight:bold;letter-spacing:2px;color:rgba(150,20,20,.5);
    border:3px solid rgba(150,20,20,.5);padding:2px 10px;border-radius:3px;pointer-events:none;z-index:0;}
  .adv-rpt-topbar{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#7a2020;
    font-weight:bold;letter-spacing:1px;border-bottom:2px solid #7a2020;padding-bottom:3px;position:relative;z-index:1;}
  .adv-rpt-heading{text-align:center;font-size:17px;font-weight:bold;letter-spacing:2px;margin:6px 0 2px;color:#171310;position:relative;z-index:1;}
  .adv-char-top,.adv-char-stats,.adv-equip,.adv-derived,.adv-char-foot{position:relative;z-index:1;}
  .adv-char-body .adv-title{color:#8a5a10;}
  .adv-char-top{display:flex;gap:8px;}
  .adv-face-col{display:flex;flex-direction:column;gap:2px;align-items:center;flex-shrink:0;position:relative;}
  .adv-face-big{width:74px;height:74px;background:#cbc4ab;color:#6a6250;font-size:10px;font-weight:bold;text-align:center;
    display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;
    border:2px solid #453f32;filter:grayscale(.3) contrast(1.04);}
  .adv-face-big img{width:100%;height:100%;object-fit:cover;}
  .adv-face-emoji{font-size:32px;}
  .adv-dead{filter:grayscale(1);}   /* ★ 사망 시 프로필 흑백 */
  /* 🌀 세계관 글리치 (은은 · 초록 통일) */
  @keyframes advFlick{0%,97%,100%{opacity:1}98%{opacity:.72}99%{opacity:.9}}
  .adv-gl{animation:advFlick 4s infinite;}
  /* 색분리 shift — 이전 ▲▣에 쓰던 딱 그 강도 */
  @keyframes advShift{0%,100%{text-shadow:.6px 0 #f0f,-.6px 0 #0ff;transform:translateX(0)}
    25%{text-shadow:-1px 0 #f0f,1px 0 #0ff;transform:translateX(.5px)}
    50%{text-shadow:1px 0 #f0f,-1px 0 #0ff;transform:translateX(-.5px)}
    75%{text-shadow:-.6px 0 #f0f,.6px 0 #0ff}}
  /* 라디오 — 초록(볼드 없음) + 아주 은은한 색분리(더 약하게, 느리게) */
  @keyframes advShiftSoft{0%,100%{text-shadow:.5px 0 rgba(255,0,255,.6),-.5px 0 rgba(0,255,255,.6);transform:translateX(0)}
    50%{text-shadow:-.5px 0 rgba(255,0,255,.6),.5px 0 rgba(0,255,255,.6);transform:translateX(.3px)}}
  .adv-radio{color:#5fd06a;font-style:italic;animation:advShiftSoft .9s steps(2) infinite;}
  .adv-glx{display:inline-block;color:#5fd06a;animation:advShiftSoft .9s steps(2) infinite;}
  .adv-reveal-line{margin-top:8px;font-size:14px;font-weight:bold;color:#fff;}
  .adv-face-slots{display:flex;gap:4px;width:100%;margin:3px 0 1px;}
  .adv-fslot{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;}
  .adv-fslot .box{width:100%;aspect-ratio:1;background:#1a3a8a;border:1px solid #000;overflow:hidden;
    display:flex;align-items:center;justify-content:center;color:#8ab;font-size:14px;}
  .adv-fslot .box img{width:100%;height:100%;object-fit:cover;}
  .adv-fslot .lb{font-size:8px;color:#333;line-height:1;white-space:nowrap;}
  .adv-fslot:hover .box{outline:1px solid #dfe8f6;}
  .adv-face-hint{font-size:10px;color:#6a6250;}
  /* 🗺️ 지도 뷰 */
  .adv-items{flex:1;overflow-y:auto;padding:3px 5px;display:flex;flex-direction:column;gap:1px;border-top:1px solid #333;margin-top:2px;}
  .adv-item{font-size:9.5px;color:#5fd06a;cursor:pointer;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .adv-item:hover{color:#8fe89a;}
  .adv-item.eqp{color:#e8d27a;}
  .adv-items-hint{font-size:8.5px;color:#3a5a3a;margin-bottom:2px;}
  .adv-item:hover{color:#8fe89a;}
  .adv-items-empty{font-size:9px;color:#3a5a3a;padding:2px 0;}
  .adv-tools{display:flex;gap:10px;justify-content:flex-start;padding:5px 6px;border-top:1px solid #333;}
  .adv-tools button{font-size:19px;padding:0;cursor:pointer;background:none;border:none;line-height:1;}
  .adv-tools button:hover{transform:scale(1.15);}
  .adv-keep-icon{display:inline-flex;align-items:center;}
  .adv-keep-icon img{width:22px;height:22px;object-fit:contain;image-rendering:auto;cursor:help;}
  .adv-recv-keeps{display:inline-flex;align-items:center;gap:2px;margin-left:3px;}
  .adv-recv-keep{display:inline-flex;width:18px;height:18px;border:1px dashed #6a8aad;border-radius:3px;overflow:hidden;}
  .adv-recv-keep img{width:100%;height:100%;object-fit:contain;cursor:help;}
  .adv-map-view{position:absolute;inset:0;z-index:8;overflow:auto;background:#0a0a0a;padding:8px;display:none;}
  .adv-map-close{margin-left:auto;font-size:11px;color:#cfe;cursor:pointer;background:#222;border:1px solid #4a6a8a;border-radius:3px;padding:2px 9px;}
  .adv-map-close:hover{color:#fff;background:#2a3a4a;}
  .adv-map-themes{font-size:10px;margin-bottom:4px;display:flex;gap:10px;}
  .adv-map-tbl{border-collapse:collapse;margin:0 auto;}
  .adv-map-td{width:20px;height:20px;min-width:20px;text-align:center;vertical-align:middle;
    font-size:13px;font-family:'Courier New',monospace;border:1px solid #222;padding:0;line-height:1;}
  .adv-map-bandedge{border-left:1px solid #555 !important;}
  .adv-map-foot{font-size:10px;color:#888;margin-top:5px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
  .adv-map-foot button{font-size:10px;padding:1px 6px;cursor:pointer;margin-left:auto;}
  #advMapTip{position:absolute;transform:translate(-50%,-100%);background:#000;color:#fff;border:1px solid #4a6a8a;
    padding:2px 6px;border-radius:3px;font-size:10px;white-space:nowrap;pointer-events:none;z-index:30;display:none;}
  #advMapTip.on{display:block;}
  .adv-map-td.adv-mate-cell{cursor:help;}
  /* 근접(3칸) 채팅 */
  .adv-chat{margin-top:8px;border:1px solid #2a4a5a;border-radius:4px;background:#0c1116;overflow:hidden;}
  .adv-chat-hd{font-size:10px;color:#7fd0e0;background:#12222c;padding:3px 7px;}
  .adv-chat-msgs{max-height:78px;overflow-y:auto;padding:4px 7px;font-size:11px;line-height:1.5;color:#cfe;}
  .adv-chat-msgs b{font-size:11px;}
  .adv-chat-in{display:flex;gap:4px;padding:4px 6px;border-top:1px solid #1c3440;}
  .adv-chat-in input{flex:1;min-width:0;background:#0a0f14;color:#dff;border:1px solid #2a4a5a;border-radius:3px;padding:3px 6px;font-size:11px;outline:none;box-shadow:none;}
  .adv-chat-in input:focus{outline:none;box-shadow:none;border-color:#3a6a8a;}
  .adv-chat-in button{font-size:11px;padding:3px 9px;cursor:pointer;background:#12324a;color:#dff;border:1px solid #3a6a8a;border-radius:3px;}
  .adv-whisper{border-left:2px solid #3a4450;padding-left:6px;margin-left:1px;}
  .adv-whisper b{color:#8a94a0;font-weight:bold;}
  .adv-whisper .w-body{color:#8a94a0;}
  .adv-act{color:#c9a6e8;font-style:italic;}
  .adv-whisper .adv-act{color:#8f88a0;}
  .adv-chat-nick{display:flex;align-items:center;gap:2px;white-space:nowrap;cursor:pointer;font-size:10px;color:#9fb8c8;user-select:none;flex:0 0 auto;}
  .adv-chat-nick:has(input:checked), .adv-chat-nick.on{color:#8a94a0;}
  .adv-chat-nick input{flex:0 0 auto;width:13px;height:13px;min-width:0;margin:0;padding:0;background:none;border:0;border-radius:0;box-shadow:none;cursor:pointer;}
  .adv-move-title{color:#ffdd44;font-size:14px;font-weight:bold;margin-bottom:4px;}
  .adv-move-sub{color:#cfe;font-size:12px;margin-bottom:10px;}
  .adv-move-tbl{border-collapse:separate;border-spacing:4px;margin:0 auto;}
  .adv-move-cell{width:36px;height:33px;text-align:center;vertical-align:middle;font-size:14px;position:relative;
    background:#141414;border:1px solid #2a2a2a;font-family:'Courier New',monospace;}
  .adv-move-cell .mm{position:absolute;top:-1px;right:1px;font-size:7px;line-height:1;letter-spacing:-1px;pointer-events:none;}
  .adv-move-cell .mm i{font-style:normal;}
  .adv-move-cell .me-stack{display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;gap:2px;width:100%;}
  .adv-move-cell .me-stack .sq{font-size:14px;display:block;width:100%;text-align:center;}
  .adv-move-cell .mm-row{display:flex;justify-content:center;gap:2px;width:100%;}
  .adv-move-cell .mm-row i{display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;font-size:0;line-height:0;}
  .adv-move-cell.go{cursor:pointer;background:#1c1c1c;border-color:#4a6a8a;}
  .adv-move-cell.go:hover{background:#26323e;border-color:#7ab8ff;}
  .adv-move-cell.go.visited{border-color:#333;background:#131313;}
  .adv-move-cell.go.visited:hover{border-color:#555;background:#1a1a1a;}
  .adv-move-cell.ctx{background:#101010;border-color:#1e1e1e;font-size:13px;opacity:.85;}
  .adv-turn-order{display:flex;align-items:center;gap:5px;flex-wrap:wrap;background:#111a14;border:1px solid #2f4a38;border-radius:4px;padding:4px 7px;margin:5px 0 6px;}
  .adv-turn-lb{font-size:9px;color:#6f8f7c;letter-spacing:1px;flex:0 0 auto;}
  .adv-turn-chip{display:inline-block;font-size:11px;background:#16241c;border:1px solid #2f4a38;border-radius:3px;padding:1px 7px;color:#cfe6d8;white-space:nowrap;}
  .adv-turn-chip.enemy{background:#2a1414;border-color:#6a2a2a;color:#ffb0b0;}
  .adv-turn-chip.now{border-color:#ffd83d;color:#ffe08a;box-shadow:0 0 0 1px #ffd83d inset;}
  .adv-turn-chip.enemy.now{color:#ffd0a0;}
  .adv-turn-arrow{color:#3f5a48;font-size:10px;flex:0 0 auto;}
  .adv-turn-spect{font-size:9px;color:#6a7a8a;margin-left:auto;flex:0 0 auto;}
  .adv-mate-act{color:#7fd0e0;}   /* 동료의 판정 결과 한 줄 */
  .adv-eturn{color:#ffb0b0!important;animation:advETurn 1.1s ease-in-out infinite;}   /* ★ 적 차례 대기 문구(로그 아님) */
  @keyframes advETurn{0%,100%{opacity:.45}50%{opacity:1}}
  .adv-move-refresh-row{display:flex;justify-content:flex-end;margin-top:6px;padding:0 2px;}
  .adv-move-btm{display:flex;align-items:center;gap:6px;margin-top:6px;padding:0 2px;}
  .adv-move-btm-sp{flex:1;}
  .adv-flag-banner{display:flex;align-items:center;gap:5px;margin:0 0 6px;padding:3px 6px;background:#2a1c10;border:1px solid #7a4a1a;border-radius:4px;font-size:10px;color:#ffb066;}
  .adv-flag-banner .fl{font-size:12px;}
  .adv-flag-banner .fc{font-weight:bold;color:#ffcf9a;}
  .adv-flag-banner .fd{color:#e0a060;}
  .adv-flag-x{margin-left:auto;background:none;border:0;color:#c98a4a;font-size:11px;cursor:pointer;padding:0 2px;line-height:1;}
  .adv-nav-dot{position:relative;width:40px;height:40px;flex:0 0 auto;border:1px solid #5a3a1a;border-radius:50%;background:#1a1408;}
  .adv-nav-dot .ctr{position:absolute;left:19px;top:19px;width:2px;height:2px;border-radius:50%;background:#7a6a4a;}
  .adv-nav-dot .pt{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#ff8f4a;box-shadow:0 0 4px #ff8f4a;}
  .adv-nav-dot.arrived{border-color:#4ae87a;}
  .adv-nav-dot .ok{position:absolute;left:0;right:0;top:9px;text-align:center;color:#4ae87a;font-size:16px;}
  .adv-map-flag{position:absolute;font-size:11px;left:0;top:-1px;pointer-events:none;}
  .adv-flag-cell{position:relative;outline:1px solid #ff8f4a;}
  .adv-move-refresh{font-family:'Courier New',monospace;font-size:10.5px;color:#9aa3b0;background:#1a1f27;
    border:1px solid #35404c;border-radius:5px;padding:3px 8px;cursor:pointer;line-height:1.2;}
  .adv-move-refresh:hover{color:#cfe;background:#232b35;border-color:#5a7a9a;}
  .adv-move-refresh:active{transform:scale(.97);}
  .adv-move-cell.wall{background:#0b0b0b;border-color:#1a1a1a;color:#2a2a2a;}
  /* 🏕 거래·조합 패널 칸 배치 */
  .adv-cell-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;}
  .adv-pcell{background:#141414;border:1px solid #2f4a38;padding:5px 3px;text-align:center;cursor:pointer;
    display:flex;flex-direction:column;align-items:center;gap:1px;}
  .adv-pcell:hover{background:#1b2a20;border-color:#5fbf8f;}
  .adv-pcell.off{opacity:.38;cursor:not-allowed;}
  .adv-pcell.off:hover{background:#141414;border-color:#2f4a38;}
  .adv-pcell .ic{font-size:17px;line-height:1.3;}
  .adv-pcell .nm{font-size:10px;color:#cfe6d8;line-height:1.25;}
  .adv-pcell .cost{font-size:9px;color:#e0c060;line-height:1.25;}
  .adv-pcell.off .cost{color:#d07070;}
  .adv-pcell .atk{font-size:9px;color:#8fd0a0;line-height:1.25;}
  .adv-pcell .mat{font-size:9px;color:#8a8a8a;line-height:1.3;margin-top:1px;}
  .adv-panel-back{width:100%;margin-top:7px;font-family:Tahoma,'맑은 고딕',sans-serif;font-size:10px;padding:4px;
    background:#1a1a12;color:#e0c060;border:1px solid #5a5a2a;cursor:pointer;}
  .adv-panel-back:hover{background:#2a2a18;border-color:#8a8a4a;}
  .adv-move-cell.cur{background:#2a2408;border-color:#6a5a20;}
  .adv-arrow{font-weight:bold;font-size:16px;}
  .adv-fields{flex:1;display:flex;flex-direction:column;gap:3px;justify-content:flex-start;min-width:0;}
  .adv-keepsake-col{display:flex;flex-direction:column;gap:2px;align-items:center;flex-shrink:0;position:relative;}
  .adv-keepsake-box{width:74px;height:74px;background:#cbc4ab;color:#6a6250;font-size:22px;
    display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;
    border:2px solid #453f32;}
  .adv-keepsake-box img{width:100%;height:100%;object-fit:contain;image-rendering:auto;}
  .adv-keepsake-box:hover{outline:1px solid #dfe8f6;}
  .adv-keep-pop{position:absolute;top:0;right:70px;z-index:20;width:150px;background:#d4d0c8;
    border:2px solid;border-color:#fff #000 #000 #fff;padding:5px;display:flex;flex-direction:column;gap:4px;box-shadow:2px 2px 6px rgba(0,0,0,.4);}
  .adv-keep-pop textarea{width:100%;height:52px;resize:none;font-size:9.5px;font-family:inherit;
    background:#fff;color:#000;border:1px solid;border-color:#000 #fff #fff #000;padding:3px;box-sizing:border-box;}
  .adv-keep-pop button{align-self:flex-end;font-size:10px;padding:2px 12px;cursor:pointer;
    background:#c0c0c0;border:1px solid;border-color:#fff #000 #000 #fff;}
  .adv-field-row{display:flex;align-items:center;gap:5px;padding:2px 0;border-bottom:1px dotted #a89d7c;}
  .adv-field-row label{width:38px;flex-shrink:0;color:#6a6250;font-size:12.5px;}
  .adv-field-row input{flex:1;min-width:0;font-size:12.5px;padding:0 2px;box-sizing:border-box;text-align:right;
    background:transparent;border:none;color:#171310;font-family:'Courier New',monospace;outline:none;}
  .adv-char-stats{background:transparent;padding:0;display:flex;flex-direction:column;gap:3px;margin-top:5px;}
  .adv-char-stats .hd{font-size:12.5px;color:#7a2020;font-weight:bold;letter-spacing:.5px;
    border-bottom:1px solid #b3a884;padding-bottom:2px;margin-bottom:2px;}
  .adv-cs-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;}
  .adv-cs-row{display:flex;align-items:center;gap:6px;font-size:12.5px;padding:2px 0;border-bottom:1px dotted #a89d7c;}
  .adv-cs-row .nm{flex:1;min-width:0;color:#3a352a;}
  .adv-cs-row .vl{width:24px;text-align:center;font-weight:bold;color:#171310;font-size:13.5px;}
  .adv-cs-row button{width:21px;height:20px;font-size:13px;line-height:1;font-family:'Courier New',monospace;
    background:#ddd6bf;color:#453f32;cursor:pointer;border:1px solid #a89d7c;padding:0;}
  .adv-cs-row button:hover:not(:disabled){background:#cbc4ab;}
  .adv-cs-row button:disabled{color:#b3a884;cursor:default;}
  .adv-derived{font-size:12px;color:#4a4436;background:transparent;padding:5px 0 2px;
    border-top:1px dashed #a89d7c;line-height:1.6;margin-top:4px;}
  .adv-derived b{color:#171310;}
  .adv-equip{display:flex;align-items:center;gap:8px;font-size:12.5px;background:transparent;padding:3px 0;
    border-bottom:1px dotted #a89d7c;}
  .adv-equip .lbl{color:#7a2020;font-weight:bold;flex-shrink:0;}
  .adv-equip .cur{flex:1;min-width:0;color:#171310;text-align:right;}
  .adv-equip .eqbtn{font-size:11.5px;padding:2px 9px;background:#ddd6bf;cursor:pointer;flex-shrink:0;
    color:#453f32;border:1px solid #a89d7c;}
  .adv-equip .eqbtn:hover:not(:disabled){background:#cbc4ab;}
  .adv-equip .eqbtn:disabled{color:#b3a884;cursor:default;}
  .adv-title{color:#e0c060;font-weight:bold;font-size:0.92em;}
  .adv-title-select{flex:1;min-width:0;font-size:12px;height:22px;font-family:'Courier New',monospace;
    background:#f0ead6;color:#171310;border:1px solid #a89d7c;}
  .adv-mi-name .adv-title{font-size:11px;}
  .adv-char-foot{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;
    margin-top:9px;padding-top:7px;border-top:1px solid #b3a884;}
  .adv-char-foot .sp{color:#4a4436;}
  .adv-char-foot .sp b{color:#7a2020;font-size:14.5px;}
  #advCharReset{font-size:11px;padding:2px 7px;background:#ddd6bf;cursor:pointer;color:#6a6250;
    border:1px solid #a89d7c;margin-left:6px;font-family:'Courier New',monospace;}
  #advCharReset:hover{background:#cbc4ab;}
  #advCharSelect{font-family:'Courier New',monospace;font-size:13.5px;font-weight:bold;letter-spacing:1px;
    padding:4px 14px;background:transparent;cursor:pointer;color:#1a5a2a;border:2px solid #1a5a2a;}
  #advCharSelect:hover{background:rgba(26,90,42,.08);}
  #advCharSelect.is-active{background:#1a5a2a;color:#e7e1cd;}
  .adv-face-pick{display:none;position:absolute;top:68px;left:0;z-index:30;background:#c0c0c0;padding:5px;flex-wrap:wrap;gap:2px;width:172px;
    border:2px solid;border-color:#fff #000 #000 #fff;box-shadow:3px 3px 0 rgba(0,0,0,.35);}
  .adv-face-pick.on{display:flex;}
  .adv-face-pick .emo{font-size:17px;cursor:pointer;padding:1px 3px;border:1px solid transparent;}
  .adv-face-pick .emo:hover{border-color:#808080;background:#dfe8f6;}
  .adv-face-pick .file{width:100%;font-size:9.5px;padding:2px;margin-top:2px;background:#c0c0c0;cursor:pointer;
    border:1px solid;border-color:#fff #404040 #404040 #fff;}
  /* 📄 노말/배드 엔딩 리절트 보고서 (TOP SECRET) */
  .adv-report{position:relative;width:284px;margin:6px auto 2px;padding:11px 13px 15px;background:#e7e1cd;color:#2a2620;
    font-family:'Courier New',monospace;border:1px solid #b3a884;box-shadow:2px 3px 7px rgba(0,0,0,.45);overflow:hidden;}
  .adv-report::before{content:'';position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.022) 3px 4px);}
  .adv-rpt-head{display:flex;justify-content:space-between;align-items:center;font-size:8.5px;color:#7a2020;
    font-weight:bold;letter-spacing:1px;border-bottom:2px solid #7a2020;padding-bottom:3px;}
  .adv-rpt-title{text-align:center;font-size:12px;font-weight:bold;letter-spacing:2px;margin:7px 0;color:#171310;}
  .adv-rpt-main{display:flex;gap:11px;align-items:flex-start;position:relative;z-index:1;}
  .adv-rpt-photo{width:72px;height:72px;flex-shrink:0;border:2px solid #453f32;background:#cbc4ab;
    display:flex;align-items:center;justify-content:center;font-size:36px;overflow:hidden;filter:grayscale(.35) contrast(1.05);}
  .adv-rpt-photo img{width:100%;height:100%;object-fit:cover;display:block;}
  .adv-rpt-fields{flex:1;min-width:0;}
  .adv-rpt-row{display:flex;justify-content:space-between;gap:8px;font-size:10px;padding:2px 0;border-bottom:1px dotted #a89d7c;}
  .adv-rpt-row span{color:#6a6250;white-space:nowrap;}
  .adv-rpt-row b{color:#171310;text-align:right;overflow:hidden;text-overflow:ellipsis;}
  .adv-rpt-verdict{margin-top:9px;text-align:center;font-size:11px;letter-spacing:2px;padding:3px;font-weight:bold;position:relative;z-index:1;}
  .adv-rpt-verdict.ok{color:#1a5a2a;border:2px solid #1a5a2a;}
  .adv-rpt-verdict.bad{color:#7a2020;border:2px solid #7a2020;}
  .adv-rpt-surv{margin-top:6px;text-align:center;font-size:10px;color:#4a4436;position:relative;z-index:1;}
  .adv-rpt-surv b{color:#171310;}
  .adv-rpt-photo.dead{filter:grayscale(1) contrast(1.05) brightness(.85);}
  .adv-phase{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-2px 0 8px;padding:5px 9px;border-radius:3px;font-size:11px;}
  .adv-phase.talk{background:linear-gradient(90deg,rgba(216,162,74,.22),rgba(216,162,74,.04));border-left:3px solid #d8a24a;}
  .adv-phase.fight{background:linear-gradient(90deg,rgba(192,65,58,.24),rgba(192,65,58,.05));border-left:3px solid #c0413a;}
  .adv-phase-name{font-weight:bold;letter-spacing:1px;}
  .adv-phase.talk .adv-phase-name{color:#e8bd76;}
  .adv-phase.fight .adv-phase-name{color:#e07a72;}
  .adv-phase-meter{display:flex;align-items:center;gap:5px;font-size:9.5px;color:#9fb09f;}
  .adv-gauge{display:inline-block;width:66px;height:9px;border:1px solid #3a4a3a;background:#12160f;border-radius:2px;overflow:hidden;vertical-align:middle;}
  .adv-gauge>i{display:block;height:100%;}
  .adv-gauge.warn>i{background:#d8a24a;}
  .adv-gauge.hp>i{background:#c0413a;}
  .adv-choice.adv-good{border-color:#3f8f4f;color:#bfeacb;}
  .adv-choice.adv-good:hover{background:#16301c;border-color:#5fbf6f;}
  .adv-choice.adv-evil{border-color:#a03a3a;color:#eabfbf;}
  .adv-choice.adv-evil:hover{background:#301616;border-color:#c85a5a;}
  .adv-choice.adv-locked{opacity:.38;cursor:not-allowed;filter:grayscale(.6);}
  .adv-choice.adv-locked:hover{background:inherit;}
  .adv-rpt-stamp{position:absolute;bottom:9px;right:-8px;transform:rotate(-13deg);font-size:14px;font-weight:bold;
    letter-spacing:2px;color:rgba(150,20,20,.68);border:3px solid rgba(150,20,20,.68);padding:1px 7px;border-radius:3px;pointer-events:none;z-index:2;}
`;

/* ─────────────────────────── 상태 ─────────────────────────── */
let advVisiting = false;

/* ─────────────────────────── 파티 상태 (실시간) ─────────────────────────── */
const PARTY = {
  mode: null,        // null(미선택) | 'solo' | 'together'
  started: false,    // 인트로 시작 확정 여부 (팀 확인 [네] 후 true)
  pid: null,         // 현재 파티 id (없으면 솔로)
  data: null,        // 최신 parties/{pid} 스냅샷
  invites: {},       // 내게 온 개인 초대
  unsubParty: null, unsubInv: null,
};
function fbReady(){ if(ADV_GAME_OFF) return false; return !!(window.firebaseAPI && firebaseAPI.advCreateParty && typeof getMyUserId==='function' && getMyUserId()); }   // ★ ADV_OFF: 파티·전투·채팅 통신의 단일 관문 — 여기서 막으면 읽기·쓰기·구독이 전부 멈춘다
function advHasLicense(){ try{ return !!((typeof isPremium!=='undefined' && isPremium) || (typeof isAdmin!=='undefined' && isAdmin)); }catch(_){ return false; } }   // app.js와 동일 판정
function advPartyMax(){ return advHasLicense() ? 5 : 2; }   // 라이선스=5인 / 미보유=2인
function advPartyLeaderName(){ const d=PARTY.data; if(d&&d.members&&d.leader){ const lm=d.members[d.leader]; if(lm&&lm.charName) return lm.charName; } return '팀장'; }
function advEnterRun(keepMap){   // 실제 게임 진입(솔로/파티 공통) — 파티원은 1a로 파티장 시드 상속
  PARTY.started=true; ADV.inLobby=false; ADV.partyPid=null;
  ADV.sessionMode=(PARTY.mode==='together')?'together':'solo';   // ★ #7: 실제로 고른 모드 기록(꺼다 켜기 재개 판단용)   // ★ 실제 진입 → 로비/대기실 상태 해제
  ADV.scene=''; ADV._gate=null;
  _advPanel='move'; ADV._campLog='';   // ★ 캠프 패널 잔재 정리
  advClearPhaseTimer(); ADV_COMBAT=null;   // ★ 이전 세션의 전투 잔재(비영속 모듈 변수) → 남아 있으면 새 세션에서 이동이 '전투 중'으로 잠긴다
  if(!keepMap){ ADV.map=null; _advMapCache=null; }   // ★ 이전 세션 잔재 리셋(버그3) · 방장은 방금 만든 맵 유지(keepMap)
  ADV.runStart=Date.now(); ADV.runKills=0; ADV.runOutlaws=0; ADV.runStartSt=ADV.st; ADV.story=null; advClearSessionGear();
  // ★ 요청1: 피드백 수명 = 세션. advSave가 ADV를 통째 저장하므로 새 세션 시작 때 비워야 이전 세션 피드백이 되살아나지 않음.
  //   (종료 시점에 지우면 '기록 저장'이 비어버리므로 시작 시 초기화)
  ADV._fb=[]; ADV._chat=[]; ADV._fbOpen=false; ADV._fbSeenTs=Date.now();
  if(ADV.map) ADV.map.flag=null;   // ★ #4-B: 목표 깃발도 세션 한정
  const _fbp=document.getElementById('advFbPop'); if(_fbp){ _fbp.classList.add('hidden'); _fbp._advFbShell=false; _fbp.innerHTML=''; }
  advEnsureMap(); advSyncMyLocation(); advSyncMyCoord(); advSubscribeCoords(); advSubscribeChat(); advSubscribeGauge(); advSubscribeCombat(); advSave(); advRenderSim(); advShowExplorePrompt(true);
}
function myNick(){ try{ if(typeof getDisplayName==='function') return getDisplayName(); }catch(_){} return '나'; }
function defaultName(){ try{ if(typeof getDisplayName==='function'){ const n=getDisplayName(); if(n) return String(n); } }catch(_){} return '생존자'; }   // 이름 없는 슬롯 폴백(크래시 방지)
function myUid(){ try{ return getMyUserId()||null; }catch(_){} return null; }
// ★ 요청2: 채팅/피드백 표시 이름 = 각자 선택한 캐릭터 이름(닉네임 아님). 내 것도 '나' 대신 캐릭터명.
function advMyCharName(){ const s=activeSlot(); return (s && s.name) ? String(s.name) : defaultName(); }
function advChatName(uid, fallback, asNick){
  if(asNick) return fallback || '?';   // ★ 요청1: 닉네임으로 보낸 메시지 → 저장된 이름(닉) 그대로 표시(캐릭터명 조회 안 함)
  if(uid && uid===myUid()) return advMyCharName();
  const m=uid && partyMembers()[uid];
  return (m && (m.charName||m.nick)) || fallback || '?';
}
// 파티에 올릴 내 멤버 페이로드 (선택된 캐릭터 기준)
function myMemberPayload(location){
  const s=activeSlot();
  const w=s.weapon&&ADV_WORLD.items[s.weapon.id];
  return {
    nick: String(myNick()).slice(0,20),
    charName: String(s.name||defaultName()).slice(0,20),
    title: slotTitleName(s)||'',
    face: slotFaceUrl(s, faceStateKey()) ? '' : (s.face||'🧑‍🚒'),
    faceImg: (function(){ const u=slotFaceUrl(s, faceStateKey()); return u ? String(u).slice(0,300) : ''; })(),
    charInfo: { age:String(s.age||''), personality:String(s.personality||''),
      str:slotStat(s,'str'), agi:slotStat(s,'agi'), int:slotStat(s,'int'), luk:slotStat(s,'luk'),
      atk:statAtk(s), def:statDef(s),
      weapon: w ? (w.icon+' '+w.name) : '맨손',
      status: statusText() },
    location: location || ADV.scene || 'camp',
  };
}
function partyMembers(){ return (PARTY.data && PARTY.data.members) || {}; }
function partyCount(){ return Object.keys(partyMembers()).length; }
function iAmLeader(){ return PARTY.data && PARTY.data.leader === myUid(); }
// 같은 위치(씬)에 있는 파티원 수 — 협동 선택지 카운트용
function sameLocationCount(loc){
  const M=partyMembers(); let n=0;
  for(const uid in M){ if((M[uid].location||'camp')===loc) n++; }
  return n||1;
}
function advTeardownParty(){
  [PARTY.unsubParty, PARTY.unsubInv, PARTY.unsubChat, PARTY.unsubCombat, PARTY.unsubGauge, PARTY.unsubCoords].forEach(f=>{ try{ f&&f(); }catch(_){} });
  PARTY.unsubParty=PARTY.unsubInv=PARTY.unsubChat=PARTY.unsubCombat=PARTY.unsubGauge=PARTY.unsubCoords=null;
}
function advSyncMyLocation(){
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), { location: ADV.scene }); }catch(_){} }
}
/* ─── D#1 분산 탐색: 내 좌표 동기화 + [새로고침]으로 동료 위치 마커 ───
   좌표는 parties/$pid/members 에 얹음(advSeed/ready 와 동일) → 규칙/호스트 함수 추가 불필요.
   ※ 후일 트래픽 분리가 필요하면 advGame/$pid 로 이전(advUpdateGameMember/advWatchGame). */
/* 좌표는 가벼운 advGame/$pid/pos 노드로 분리(트래픽↓). 호스트 미지원 시 parties 멤버로 폴백. */
function advHostCoord(){ try{ return !!(window.firebaseAPI && firebaseAPI.advWriteCoord && firebaseAPI.advWatchCoords); }catch(_){ return false; } }
let _coordT=null, _coordLast=0, _coordPend=null;
function advSyncMyCoord(){
  if(!advIsParty() || !fbReady() || !PARTY.pid || !ADV.map) return;
  const p=ADV.map.pos; if(!p) return;
  if(ADV._myCoord && ADV._myCoord.x===p.x && ADV._myCoord.y===p.y) return;   // 안 움직였으면 skip
  _coordPend={x:p.x, y:p.y};
  const flush=()=>{ _coordT=null; _coordLast=Date.now(); const c=_coordPend; _coordPend=null; if(!c) return; ADV._myCoord=c;
    try{ if(firebaseAPI.advWriteCoord) firebaseAPI.advWriteCoord(PARTY.pid, myUid(), c);   // 가벼운 pos 노드
         else firebaseAPI.advUpdateMember(PARTY.pid, myUid(), c); }catch(_){}                // 폴백(기존)
  };
  const gap=Date.now()-_coordLast;
  if(gap>=800) flush(); else if(!_coordT) _coordT=setTimeout(flush, 800-gap);   // ~0.8초 스로틀(마지막 위치는 보장)
}
function advSubscribeCoords(){
  if(!advHostCoord() || !PARTY.pid) return;   // 폴백 모드면 parties 구독으로 좌표가 들어옴
  try{ PARTY.unsubCoords && PARTY.unsubCoords(); }catch(_){}
  PARTY.unsubCoords = firebaseAPI.advWatchCoords(PARTY.pid, data=>{ ADV._coords = data || {}; advRefreshExploreChat();
    if(document.getElementById('advMovePanel')) advRenderMoveNav();   // ★ 동료 좌표 갱신 시 이동 패널 마커도 실시간 반영(diff-guard로 변화 있을 때만 실제 재렌더)
  });
}
function advMateCoord(uid){   // 동료 좌표 소스: pos 노드(있으면) or parties 멤버(폴백)
  if(advHostCoord()){ const c=(ADV._coords||{})[uid]; return (c && typeof c.x==='number' && typeof c.y==='number')?c:null; }
  const m=partyMembers()[uid]; return (m && typeof m.x==='number' && typeof m.y==='number')?{x:m.x,y:m.y}:null;
}
// 동료 고정 색: 파티 uid 정렬 인덱스 기준(나 제외)
function advMateColor(uid){
  const ids=Object.keys(partyMembers()).filter(u=>u!==myUid()).sort();
  const i=ids.indexOf(uid); return ADV_MATE_COLORS[(i<0?0:i)%ADV_MATE_COLORS.length];
}
// [새로고침]: 현재 파티 스냅샷에서 동료 좌표를 떠서 마커용으로 고정(실시간 아님 — 눌러야 갱신)
function advFetchMates(){
  const M=partyMembers(), out=[];
  for(const uid in M){ if(uid===myUid()) continue; const c=advMateCoord(uid); if(!c) continue;
    out.push({uid, x:c.x, y:c.y, name:(M[uid].charName||M[uid].nick||'?'), color:advMateColor(uid)});
  }
  ADV._mates=out; ADV._matesTs=Date.now();
  advRenderMap();
}
/* ─── D#2 근접(3칸) 채팅 — advGame/$pid/chat 노드 사용(호스트 함수 필요, 없으면 조용히 비활성) ─── */
function advNearMates(){   // 내 좌표 기준 체비쇼프 3칸 이내 동료(라이브 좌표)
  if(!advIsParty() || !ADV.map) return [];
  const p=ADV.map.pos, M=partyMembers(), out=[];
  for(const uid in M){ if(uid===myUid()) continue; const c=advMateCoord(uid); if(!c) continue;
    if(Math.abs(c.x-p.x)<=3 && Math.abs(c.y-p.y)<=3) out.push({uid, name:(M[uid].charName||M[uid].nick||'?'), color:advMateColor(uid)});
  }
  return out;
}
function _advChatArr(list){ if(Array.isArray(list)) return list.slice();
  const o=list||{}; return Object.keys(o).map(k=>o[k]).filter(Boolean).sort((a,b)=>(a.ts||0)-(b.ts||0)); }
function advSubscribeChat(){
  if(!advIsParty() || !fbReady() || !PARTY.pid || !firebaseAPI.advWatchGameChat) return;   // 호스트 미구현이면 skip
  try{ PARTY.unsubChat && PARTY.unsubChat(); }catch(_){}
  PARTY.unsubChat = firebaseAPI.advWatchGameChat(PARTY.pid, list=>{
    const all=_advChatArr(list);
    ADV._chat = all.filter(mm=>!mm.fb);   // 채팅창엔 피드백 제외
    ADV._fb   = all.filter(mm=>mm.fb);     // ★ 요청1: 피드백(fb)은 별도 팝업 스트림
    advRenderChatBox();
    advUpdateFeedbackBtn();
    if(ADV._fbOpen) advRenderFeedbackPopup();
  });
}
// /명령어 → [demoji:id] 마커 (앱 기본 이모티콘과 동일 규칙 — 기록엔 마커만, 각 클라가 로컬 번들에서 렌더)
function advDemojify(text){
  if(typeof DEMOJI_BY_CMD==='undefined') return text;
  // ★ #1 수정: URL을 먼저 토큰으로 보호. 안 그러면 demoji '/명령어' 치환이 URL 경로(예: .../img, .../png)를
  //   [demoji:..]로 바꿔 주소를 훼손 → 채팅에서 이미지가 임베드되지 않음(직접 붙여넣기 전송 경로).
  const urls=[];
  let s=String(text).replace(/https?:\/\/[^\s<>]+/gi, u=>{ urls.push(u); return '\u0001'+(urls.length-1)+'\u0001'; });
  s=s.replace(/\/([^\s\/]{1,10})/g, (m, cmd)=>{ const d=DEMOJI_BY_CMD[cmd]; return d ? '[demoji:'+d.id+']' : m; });
  return s.replace(/\u0001(\d+)\u0001/g, (m,i)=>urls[+i]);
}
function advSendChat(text, opts){
  const _lim=(opts&&(opts.raw||opts.img))?500:200;   // ★ #2: 이미지 주소는 길어서 200자에 잘리면 전송이 깨짐
  text=String(text||'').trim().slice(0,_lim); if(!text) return;
  // ★ #6: 근접(3칸) 동료가 없으면 말이 닿지 않는다 — 전송하지 않고 채팅창에 안내만 표시(로컬)
  if(advIsParty() && partyCount()>1 && !advNearMates().length){ advLocalChatNotice('주변에 아무도 없습니다.'); return; }
  if(!opts||!opts.raw) text=advDemojify(text);   // ★ demoji 명령어 변환 (#8) — 이미지 전송은 raw(URL 보호)
  const asNick=!!(opts&&opts.asNick);             // ★ 요청1: 체크 시 캐릭터명 대신 닉네임으로 말하기
  const name=asNick ? myNick() : advMyCharName();
  if(fbReady() && PARTY.pid && firebaseAPI.advSendGameChat){ try{ firebaseAPI.advSendGameChat(PARTY.pid, {uid:myUid(), name, asNick, text, ts:Date.now()}); }catch(_){} }
}
/* ─── 요청1: 피드백 팝업 — 좌표에 고정된 한마디. 밟은 칸(또는 내 것)만 보임. 채팅 스트림에 fb:true로 실어 호스트 함수 0개. ─── */
function advSendFeedback(text){
  text=String(text||'').trim().slice(0,200); if(!text) return;   // 텍스트 전용(데모지/이미지 임베드 없음)
  const p=(ADV.map&&ADV.map.pos)||{x:0,y:0};
  if(fbReady() && PARTY.pid && firebaseAPI.advSendGameChat){
    try{ firebaseAPI.advSendGameChat(PARTY.pid, {uid:myUid(), name:advMyCharName(), text, ts:Date.now(), fb:true, x:p.x, y:p.y}); }catch(_){}
  }
}
function advFbVisibleList(){   // 밟은 칸(stepped) + 지금 서 있는 칸 + 내가 남긴 것 — 시간순
  //   ※ 자원/미니이벤트 칸은 '선택'해야 stepped에 등록되므로(스킵 시 미등록), 현재 위치도 포함해야 실제로 '밟은' 느낌과 일치.
  const stepped=new Set((ADV.map&&ADV.map.stepped)||[]); const me=myUid();
  const p=(ADV.map&&ADV.map.pos)||null; const hereKey=p?(p.x+','+p.y):null;
  return (ADV._fb||[]).filter(f=>{ if(!f) return false;
      const k=f.x+','+f.y;
      return f.uid===me || stepped.has(k) || (hereKey && k===hereKey); })
    .sort((a,b)=>(a.ts||0)-(b.ts||0));
}
function advFbProfile(uid){   // 프로필 사진 + 캐릭터명 + 나이 (자신=슬롯, 동료=파티 데이터)
  if(uid===myUid()){ const s=activeSlot(); const url=(typeof slotFaceUrl==='function')?slotFaceUrl(s, faceStateKey()):null;
    return {name:(s&&s.name)||advMyCharName(), age:(s&&s.age)||'', img:url||'', emoji:(s&&s.face)||'🧑‍🚒'}; }
  const m=partyMembers()[uid]||{};
  return {name:m.charName||m.nick||'?', age:(m.charInfo&&m.charInfo.age)||'', img:m.faceImg||'', emoji:m.face||'🧑‍🚒'};
}
function advRenderFeedbackPopup(){
  const pop=document.getElementById('advFbPop'); if(!pop) return;
  // ★ 재렌더 churn 방지: 동료 채팅/피드백이 올 때마다 팝업 전체를 갈아끼우면 입력 중인 글·포커스가 날아감.
  //   → 껍데기(헤더/입력창)는 1회만 생성하고, 이후엔 목록만 diff 갱신한다.
  if(!pop._advFbShell){
    pop._advFbShell=true;
    pop.innerHTML='<div class="adv-fb-hd">🗨 피드백 <span class="adv-fb-sub">· 밟은 칸에 남겨진 한마디</span><button type="button" class="adv-fb-x" id="advFbClose" title="닫기">✕</button></div>'
      +'<div class="adv-fb-list" id="advFbList"></div>'
      +'<div class="adv-fb-in"><input id="advFbInput" type="text" maxlength="200" placeholder="이 칸에 한마디…" autocomplete="off"><button type="button" id="advFbSend">남기기</button></div>';
    const cl=pop.querySelector('#advFbClose'); if(cl) cl.onclick=advToggleFeedback;
    const inp=pop.querySelector('#advFbInput'), snd=pop.querySelector('#advFbSend');
    const go=()=>{ if(inp&&inp.value.trim()){ advSendFeedback(inp.value); inp.value=''; } if(inp) inp.focus(); };
    if(snd) snd.onclick=go;
    if(inp) inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); go(); } };
  }
  const here=(ADV.map&&ADV.map.pos)?(ADV.map.pos.x+','+ADV.map.pos.y):'?';
  const inp=pop.querySelector('#advFbInput');
  if(inp) inp.placeholder='이 칸('+here+')에 한마디…';   // 이동해도 현재 좌표 반영
  const lst=pop.querySelector('#advFbList'); if(!lst) return;
  const list=advFbVisibleList();
  let html;
  if(!list.length) html='<div class="adv-fb-empty">아직 볼 수 있는 피드백이 없어요.<br>밟은 칸에서 아래에 한마디 남겨보세요.</div>';
  else html=list.map(f=>{ const pr=advFbProfile(f.uid);
      const len=(f.text||'').length; const fs= len>90?11 : len>50?12 : len>24?13 : 14;   // 길수록 축소(최대 3줄은 CSS clamp)
      const pic= pr.img ? '<img src="'+esc(pr.img)+'" alt="">' : '<span class="emo">'+esc(pr.emoji)+'</span>';
      return '<div class="adv-fb-item">'
        +'<div class="adv-fb-face">'+pic+'</div>'
        +'<div class="adv-fb-body">'
          +'<div class="adv-fb-who">'+esc(pr.name)+(pr.age?(' ('+esc(String(pr.age))+')'):'')+'<span class="adv-fb-at">@'+f.x+','+f.y+'</span></div>'
          +'<div class="adv-fb-bubble" style="font-size:'+fs+'px">'+esc(f.text||'')+'</div>'
        +'</div></div>'; }).join('');
  if(lst._advLastHtml!==html){   // 내용 동일하면 DOM 손대지 않음(스크롤·포커스 안정)
    const atBottom = (lst.scrollHeight - lst.scrollTop - lst.clientHeight) < 24;
    lst.innerHTML=html; lst._advLastHtml=html;
    if(atBottom) lst.scrollTop=lst.scrollHeight;   // 아래를 보고 있었을 때만 자동 스크롤(위로 읽는 중이면 유지)
  }
}
function advToggleFeedback(){
  const pop=document.getElementById('advFbPop'); if(!pop) return;
  ADV._fbOpen=!ADV._fbOpen;
  pop.classList.toggle('hidden', !ADV._fbOpen);
  if(ADV._fbOpen){ ADV._fbSeenTs=Date.now(); advRenderFeedbackPopup(); }
  advUpdateFeedbackBtn();
}
function advUpdateFeedbackBtn(){
  const btn=document.getElementById('advFbBtn'); if(!btn) return;
  const party=advIsParty() && partyCount()>1;
  btn.style.display = party ? '' : 'none';
  if(!party){ ADV._fbOpen=false; const pop=document.getElementById('advFbPop'); if(pop) pop.classList.add('hidden'); return; }
  const seen=ADV._fbSeenTs||0;
  const pop=document.getElementById('advFbPop');
  if(pop){ pop.classList.toggle('hidden', !ADV._fbOpen); if(ADV._fbOpen) advRenderFeedbackPopup(); }   // ★ 저장된 열림 상태와 DOM 동기화(재접속 시 버튼/팝업 불일치 방지)
  const unseen=advFbVisibleList().some(f=> (f.ts||0)>seen && f.uid!==myUid());
  btn.classList.toggle('has-new', !!unseen && !ADV._fbOpen);
  btn.classList.toggle('on', !!ADV._fbOpen);
}
/* ★ #6: 서버로 보내지 않고 내 채팅창에만 띄우는 시스템 안내 */
function advLocalChatNotice(msg){
  ADV._chat=(ADV._chat||[]).concat([{uid:'__sys', name:'', text:msg, ts:Date.now(), sys:true}]);
  advRenderChatBox();
}
function advRenderChatBox(){
  const box=document.getElementById('advChatMsgs'); if(!box) return;
  const list=(ADV._chat||[]).slice(-8);
  // [demoji:id] 마커 → 번들 이미지 (esc 이후 치환 — 아는 id만 렌더, 임의 URL 로드 없음)
  const rend=(t)=>{ t=esc(t||''); const tok=[]; const put=h=>{ tok.push(h); return '\u0000'+(tok.length-1)+'\u0000'; };
    if(typeof DEMOJI_BY_ID!=='undefined' && typeof DEMOJI_DIR!=='undefined'){
      t=t.replace(/\[demoji:(d\d{2})\]/g, (m,id)=>{ const d=DEMOJI_BY_ID[id]; if(!d) return m;
        return put('<img class="adv-demoji" style="width:'+d.w+'px;height:'+d.h+'px" src="'+DEMOJI_DIR+d.file+'" alt="'+esc(d.cmd)+'">'); });
    }
    // 🖼 스포일러 이미지 마커 [imgs:URL] — 클릭 전엔 칩, 공개했으면 이미지 (토큰으로 보호 → 이중치환 방지)
    t=t.replace(/\[imgs:(https:\/\/[^\s\]<>"']+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s\]<>"']*)?)\]/gi, (m,u)=>{
      if(ADV._imgOpen && ADV._imgOpen.has(u.replace(/&amp;/g,'&')))
        return put('<img class="adv-chat-img" src="'+u+'" alt="이미지" loading="lazy" onerror="this.outerHTML=\'<span style=&quot;color:#678&quot;>(이미지 로드 실패)</span>\'">');
      return put('<span class="adv-img-spoiler" data-src="'+u+'">🖼 이미지 — <u>클릭해서 보기</u></span>');
    });
    // 🖼 이미지 URL 임베드 — https + 이미지 확장자만
    t=t.replace(/https:\/\/[^\s<>"']+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"']*)?/gi,
      m=>put('<img class="adv-chat-img" src="'+m+'" alt="이미지" loading="lazy" onerror="this.outerHTML=\'<span style=&quot;color:#678&quot;>(이미지 로드 실패)</span>\'">'));
    // ★ **행동지문** → 기울임 + 전용 색. 이미지/데모지는 이미 토큰으로 보호돼 있어 주소가 훼손되지 않음.
    t=t.replace(/\*\*([^*\u0000]{1,120}?)\*\*/g, (m,inner)=> inner.trim() ? '<em class="adv-act">'+inner+'</em>' : m);
    return t.replace(/\u0000(\d+)\u0000/g, (m,i)=>tok[+i]); };
  box.innerHTML = list.length ? list.map(mm=>{
    if(mm.sys) return '<div style="color:#7f9aa8;font-size:10px">※ '+esc(mm.text)+'</div>';   // ★ #6 로컬 안내
    const meMsg=mm.uid===myUid(); const col=meMsg?'#ffe08a':advMateColor(mm.uid);
    if(mm.asNick){   // ★ 닉네임 발화 = 귓속말 톤(B안): 이름표·본문 회색 + 왼쪽 세로선 — 캐릭터 대사 몰입을 깨지 않게
      return '<div class="adv-whisper"><b>'+esc(advChatName(mm.uid, mm.name, true))+'</b>: <span class="w-body">'+rend(mm.text)+'</span></div>';
    }
    return '<div><b style="color:'+col+'">'+esc(advChatName(mm.uid, mm.name, mm.asNick))+'</b>: '+rend(mm.text)+'</div>'; }).join('')
    : '<div style="color:#678">아직 대화가 없어요</div>';
  box.scrollTop=box.scrollHeight;
}
function advChatBoxHtml(){
  return '<div class="adv-chat" id="advChatBox">'
    +'<div class="adv-chat-hd">💬 파티 대화</div>'
    +'<div class="adv-chat-msgs" id="advChatMsgs"></div>'
    +'<div class="adv-img-pop" id="advImgPop" style="display:none">'
      +'<input id="advImgUrl" type="text" placeholder="이미지 주소 (https://…png/jpg/gif/webp)" autocomplete="off">'
      +'<label class="adv-img-sp"><input id="advImgSpoiler" type="checkbox"> 클릭해야 펼쳐지기</label>'
    +'</div>'
    +'<div class="adv-chat-in"><input id="advChatInput" type="text" maxlength="200" placeholder="메시지…" autocomplete="off"><label class="adv-chat-nick" title="체크하면 캐릭터 이름 대신 닉네임으로 말해요"><input id="advChatNick" type="checkbox">닉</label><button id="advChatImgBtn" type="button" title="이미지 보내기">🖼</button><button id="advChatSend" type="button">보내기</button></div>'
    +'</div>';
}
function advBindChat(){
  const panel=document.getElementById('advChatPanel');
  const inp=document.getElementById('advChatInput'), snd=document.getElementById('advChatSend'); if(!inp||!snd) return;
  const q=id=>document.getElementById(id);
  const asNick=()=>{ const c=q('advChatNick'); return !!(c&&c.checked); };
  // 🖼 이미지 전송 — ★ #2 수정: 조건에 안 맞으면 조용히 무시돼 '보내기가 안 눌린다'로 보였음.
  //   이제 이유를 채팅창에 남기고, http(s)·확장자 없는 주소도 허용(임베드는 안 되지만 링크로 전달).
  const sendImg=()=>{
    const iu=q('advImgUrl'), isp=q('advImgSpoiler'), pop=q('advImgPop');
    const u=(iu&&iu.value.trim())||'';
    if(!u){ advLocalChatNotice('이미지 주소를 입력해 주세요.'); return false; }
    if(!/^https?:\/\/\S+$/i.test(u)){ advLocalChatNotice('http(s):// 로 시작하는 주소만 보낼 수 있어요.'); return false; }
    const isImg=/^https:\/\/\S+?\.(?:png|jpe?g|gif|webp)(?:\?\S*)?$/i.test(u);
    const msg = (isp&&isp.checked && isImg) ? '[imgs:'+u+']' : u;
    if(msg.length>500){ advLocalChatNotice('주소가 너무 길어요 (500자 제한).'); return false; }
    advSendChat(msg, {raw:true, asNick:asNick(), img:true});
    if(!isImg) advLocalChatNotice('이미지 확장자(png/jpg/gif/webp)가 아니라 링크로만 전달돼요.');
    if(iu) iu.value=''; if(pop) pop.style.display='none'; inp.focus(); return true;
  };
  const go=()=>{
    const iu=q('advImgUrl'), pop=q('advImgPop');
    if(pop && pop.style.display!=='none' && iu && iu.value.trim()){ sendImg(); return; }   // 팝업 열림+URL 있음 → 이미지 전송
    const t=inp.value.trim();
    if(t){ advSendChat(t, {asNick:asNick()}); inp.value=''; }
    inp.focus();
  };
  // ★ #2 수정: 버튼 핸들러를 개별 노드(onclick)에 걸면 패널이 다시 그려질 때 유실될 수 있다.
  //   안정 부모(#advChatPanel)에 1회 위임 → 재렌더에도 '보내기'가 계속 동작.
  if(panel && !panel._advChatDeleg){
    panel._advChatDeleg=true;
    panel.addEventListener('click', ev=>{
      const t=ev.target; if(!t||!t.closest) return;
      if(t.closest('#advChatSend')){ ev.preventDefault(); advChatGo(); return; }
      if(t.closest('#advChatImgBtn')){ ev.preventDefault();
        const pop=q('advImgPop'), iu=q('advImgUrl');
        if(pop){ pop.style.display=(pop.style.display==='none')?'flex':'none'; if(pop.style.display!=='none'&&iu) iu.focus(); }
        return; }
      const sp=t.closest('.adv-img-spoiler');   // 스포일러 이미지 펼치기
      if(sp){ const u=sp.getAttribute('data-src')||''; if(!/^https:\/\//.test(u)) return;
        (ADV._imgOpen=ADV._imgOpen||new Set()).add(u); advRenderChatBox(); }
    });
    panel.addEventListener('change', ev=>{   // ★ '닉' 체크 상태를 라벨 색에 반영(:has() 미지원 대비)
      const t=ev.target; if(!t||!t.closest) return;
      const cb=t.closest('#advChatNick'); if(!cb) return;
      const lb=cb.closest('.adv-chat-nick'); if(lb) lb.classList.toggle('on', !!cb.checked);
    });
    panel.addEventListener('keydown', ev=>{
      const t=ev.target; if(!t||!t.closest) return;
      if(t.closest('#advChatInput') && ev.key==='Enter'){ ev.preventDefault(); advChatGo(); return; }
      if(t.closest('#advImgUrl')){
        if(ev.key==='Enter'){ ev.preventDefault(); advChatSendImg(); }
        else if(ev.key==='Escape'){ const pop=q('advImgPop'), iu=q('advImgUrl'); if(iu) iu.value=''; if(pop) pop.style.display='none'; inp.focus(); }
      }
    });
  }
  advChatGo=go; advChatSendImg=sendImg;   // 위임 핸들러가 최신 클로저를 쓰도록 참조 갱신
  advRenderChatBox();
}
let advChatGo=()=>{}, advChatSendImg=()=>{};
/* ─── 파티 공유 월드 (1a): 맵 시드 공유 — 맵은 랜덤, 파티장 것을 팀원이 상속 ─── */
function advLeaderSeed(){ const d=PARTY.data; if(!d||!d.members||!d.leader) return null;
  const lm=d.members[d.leader]; return (lm && typeof lm.advSeed==='number') ? lm.advSeed : null; }
function advPublishSeedIfLeader(){
  if(fbReady() && PARTY.pid && iAmLeader() && ADV.map && typeof ADV.map.seed==='number'){
    const lm=partyMembers()[myUid()];
    if(!lm || lm.advSeed!==ADV.map.seed){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {advSeed:ADV.map.seed}); }catch(_){} }
  }
}
function advSyncSharedMap(){   // 파티원: 파티장 시드가 도착/변경되면 그 맵으로 수렴
  if(!advIsParty() || !PARTY.pid) return;
  if(iAmLeader()){ advPublishSeedIfLeader(); return; }
  const ls=advLeaderSeed();
  if(ls!=null && (!ADV.map || ADV.map.seed!==ls)){
    const m=advGenMap(ls);
    ADV.map={ seed:ls, pos:{x:m.start.x,y:m.start.y}, stepped:[m.start.x+','+m.start.y], found:[], seen:[] };
    advMarkSeen(m, m.start.x, m.start.y); _advMapCache=null; advSave();
    if(document.getElementById('advTerm')) advRenderSim();
  }
}
/* ─── 파티 입장 게이트 (D#3): 캠프·스토리 건물은 혼자 입장 불가 → 전원 모여 레디 → 키퍼(방장)가 입장 ───
   레디/입장 신호는 별도 노드 없이 parties/$pid/members 에 얹는다(advSeed/go/max 와 동일). 새 호스트 함수는 advSetAtCamp 뿐. */
/* ★ 요청4: 캠프를 잠깐 나갔다 돌아왔는데 동료 전원이 그대로 캠프에 있으면 집결/레디를 생략한다.
   두 조건을 모두 만족할 때만 — ① 동료 location이 'camp'(advSyncMyLocation이 ADV.scene을 게시)
   ② 동료 좌표가 이 캠프 칸과 동일. 한 명이라도 빠지면 예전처럼 집결소를 연다. */
function advMatesAlreadyAtCamp(camp){
  if(!camp) return false;
  if(!advIsParty() || partyCount()<=1) return false;   // 솔로는 advPartyGate가 어차피 바로 통과시킨다
  const M=partyMembers(); let tot=0, here=0;
  for(const uid in M){
    if(uid===myUid()) continue;
    tot++;
    const c=advMateCoord(uid);
    if((M[uid].location||'')==='camp' && c && c.x===camp.x && c.y===camp.y) here++;
  }
  return tot>0 && here===tot;
}
function advPartyGate(stageKey, enterFn, camp){
  if(!advIsParty() || partyCount()<=1){ enterFn(); return; }   // 솔로/1인은 바로 입장
  ADV._gate={ key:stageKey, fn:enterFn, prev:(ADV.scene||''), camp:(camp||null) };   // camp: 이미 안에 있는 동료 판별용
  ADV.scene=stageKey; advSave();
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {location:stageKey, ready:false, enter:null}); }catch(_){} }
  advRenderGate();
}
/* ★ 이미 안(캠프)에 들어가 있는 동료는 '집결 완료 + 레디' 취급.
   안 그러면 3인 중 1명만 잠깐 나갔다 와도 나머지 2명의 location은 'camp'라 집결 인원에 안 잡혀
   전원 레디가 영영 성립하지 않는다(집결소에서 교착). 결과적으로 나갔다 온 사람과 나만 레디하면 된다. */
function advGateInside(uid){
  const g=ADV._gate; if(!g || !g.camp) return false;
  const m=partyMembers()[uid]||{};
  if((m.location||'')!=='camp') return false;
  const c=advMateCoord(uid);
  return !!(c && c.x===g.camp.x && c.y===g.camp.y);
}
function advGatePresent(){   // 이 집결지에 모인 파티원 uid (이미 안에 있는 동료 포함)
  const key=ADV._gate&&ADV._gate.key, M=partyMembers(), out=[];
  for(const uid in M){ if((M[uid].location||'')===key || advGateInside(uid)) out.push(uid); }
  return out;
}
function advGateAllReady(){
  const p=advGatePresent(), M=partyMembers();
  // 전원 모여 + 전원 레디. 단 이미 안에 있는 동료는 레디한 것으로 본다.
  return p.length===partyCount() && p.length>=2 && p.every(uid=>advGateInside(uid) || !!(M[uid]&&M[uid].ready));
}
function advSetMyReady(v){
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {ready:!!v}); }catch(_){} }
  advRenderGate();
}
function advRenderGate(){
  const g=ADV._gate; if(!g || ADV.scene!==g.key) return;
  const M=partyMembers(), present=advGatePresent(), total=partyCount();
  const meReady=!!(M[myUid()]&&M[myUid()].ready), allReady=advGateAllReady();
  const roster=present.length? present.map(uid=>{ const m=M[uid]||{};
    const mark = advGateInside(uid) ? ' 🏕' : (m.ready?' ✅':' …');   // 🏕 = 이미 안에 있어 레디 불필요
    return '<span class="mate'+(uid===myUid()?' me':'')+'">'+esc(uid===myUid()?'나':(m.charName||m.nick||'?'))+mark+'</span>'; }).join(' ') : '(아직 없음)';
  let html='<p><span class="loc">[ 집결소 ]</span></p>'
    +'<p class="sys">여긴 혼자 들어갈 수 없어. 동료가 모여 레디하면 방장이 입장을 결정해.</p>'
    +(present.some(u=>advGateInside(u))?'<p class="sys" style="color:#8fd0a0">🏕 표시는 이미 안에 있는 동료 — 레디를 기다릴 필요 없어요.</p>':'')
    +'<p>모인 인원 ('+present.length+'/'+total+'): '+roster+'</p>';
  const btns=[ {label: meReady?'⏸ 레디 해제':'✅ 레디', cls:'adv-reveal', on:()=>advSetMyReady(!meReady)} ];
  if(iAmLeader()){
    if(allReady) btns.push({label:'▶ 입장 (전원 레디)', cls:'adv-reveal', on:advGateLeaderEnter});
    else html+='<p class="sys">전원 모여 레디되면 입장 버튼이 열려.</p>';
  } else {
    html+='<p class="sys">방장이 입장을 누르길 기다리는 중…</p>';
  }
  btns.push({label:'🚶 물러난다', on:advGateLeave});
  advPrompt(html, btns);
}
function advGateLeaderEnter(){
  const g=ADV._gate; if(!g) return; const key=g.key, fn=g.fn; ADV._gate=null;
  // 입장 신호는 유지(즉시 null 처리 시 파티원이 놓칠 수 있음). 다음 집결 때 advPartyGate 가 enter:null 로 리셋.
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {enter:key, ready:false}); }catch(_){} }
  fn();
}
function advGateConsumeEnter(){
  const g=ADV._gate; if(!g) return; const fn=g.fn; ADV._gate=null;
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {ready:false, enter:null}); }catch(_){} }
  fn();
}
function advGateLeave(){
  const g=ADV._gate; ADV._gate=null;
  ADV.scene=(g&&g.prev)||''; advSave();
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {location:ADV.scene, ready:false, enter:null}); }catch(_){} }
  advShowExplorePrompt(false);
}
function advCloseSim(){ advCloseWin('advSimWin'); advTeardownParty(); advBgmStop(); }

/* 🎵 좀아칼 BGM — 창 열면 50% 볼륨 반복재생 · 마이홈 BGM(유튜브)은 자동 종료 · 음소거 상태 유지 */
let _advBgm=null;
function advBgmPlay(){
  if(ADV_GAME_OFF) return;   // ★ 중단 상태 — 게임 BGM은 로드하지 않는다
  try{ if(window.companion && companion.closeBgm) companion.closeBgm(); }catch(_){}   // 마이홈 BGM 듣고 있었다면 자동 종료
  try{
    if(!_advBgm){ _advBgm=new Audio('parts/adv-bgm.mp3'); _advBgm.loop=true; _advBgm.volume=0.5; }
    if(ADV.bgmMuted){ _advBgm.pause(); return; }   // 음소거 상태면 재생 안 함
    _advBgm.play().catch(()=>{});   // 자동재생 차단 등 실패는 조용히 무시
  }catch(_){}
}
function advBgmStop(){ try{ _advBgm && _advBgm.pause(); }catch(_){} }
function advBgmToggle(){
  ADV.bgmMuted=!ADV.bgmMuted; advSave();
  if(ADV.bgmMuted) advBgmStop(); else advBgmPlay();
  advRenderBgmBtn();
}
// 🔊/🔇 SVG 스피커 아이콘 렌더 (음소거 시 빨간 X)
function advBgmIconSvg(muted){
  return '<svg width="18" height="15" viewBox="0 0 22 18" aria-hidden="true">'
    +'<path d="M3 6.5h3.5L11 3v12L6.5 11.5H3z" fill="#fff"/>'
    +(muted
      ? '<path d="M15 6l4 6M19 6l-4 6" stroke="#ff5a5a" stroke-width="1.7" fill="none" stroke-linecap="round"/>'
      : '<path d="M14 6.5c1.6 1.2 1.6 3.8 0 5" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
        +'<path d="M16 4.5c3 2.2 3 6.8 0 9" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>')
    +'</svg>';
}
function advRenderBgmBtn(){
  const b=document.getElementById('advBgmBtn'); if(!b) return;
  b.innerHTML=advBgmIconSvg(!!ADV.bgmMuted);
  b.title=ADV.bgmMuted?'BGM 켜기':'BGM 끄기';
}

function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

/* ══════════════════════════════════════════════════════════════════════════════
   🔌 외부 앱 등록 API — window.MYHOME_DESKTOP
   바탕화면(껍데기)과 게임(내용물)을 파일 단위로 갈라놓기 위한 유일한 접점이다.
   게임 파일(mystery-au.js 등)은 이 API로 '폴더 하나 + 창 하나'만 등록하고,
   이 파일은 그 게임이 무엇인지 전혀 모른다.

   ★ 왜 이걸 만드는가 (좀아칼의 교훈)
     좀아칼은 게임과 바탕화면이 한 파일에 섞여 advBindEvents 하나에 전부 얽혀 있었다.
     그래서 은퇴시킬 때 파일을 통째로 지우지 못하고 ADV_GAME_OFF 스위치로 재우는
     수밖에 없었고, 지금도 약 4,000줄이 잠들어 있다.
     이 API를 거치면 게임을 걷어낼 때 할 일은 딱 두 가지다 —
       1) HTML에서 <script src="mystery-au.js"> 한 줄 삭제
       2) mystery-au.js 파일 삭제
     이 파일은 한 글자도 건드리지 않는다. 등록된 앱이 0개면 아무 일도 안 일어난다.

   ★ 사용법 (게임 파일 쪽)
     function mhdReady(fn){                       // 로드 순서에 상관없이 안전
       if(window.MYHOME_DESKTOP) window.MYHOME_DESKTOP.onReady(fn);
       else (window._MHD_PENDING = window._MHD_PENDING || []).push(fn);
     }
     mhdReady(D => {
       const win = D.createWindow({ id:'mysWin', title:'🕰 미스테리au', onClose(){} });
       D.addFolder({ id:'mys', label:'미스테리au', icon:'📁', onOpen(){ D.openWindow('mysWin'); } });
     });

   ★ 계약 (이 아래 항목은 게임 파일이 믿고 쓰는 것 — 시그니처를 바꾸지 말 것)
     addFolder({id, label, icon, slot, onOpen, onVisit})  → 아이콘 등록. slot 생략 시 자동 배치.
     removeFolder(id)                              → 아이콘 제거(런타임 토글용)
     addEnvMenu({id, label, items, get, onSelect})  → '환경 설정'에 하위메뉴 추가
     createWindow({id, title, fill, host, onClose})  → Win98 창 껍데기 생성. body 엘리먼트 반환
                                                       host:'home' → 마이홈 창 전체를 덮음(시메지 위)
     openWindow(id) / closeWindow(id)               → 표시 토글
     isVisiting()                                   → 남의 집 관람 중이면 true
     desktop()                                      → #advDesktop 엘리먼트
     onReady(fn)                                    → advInit 완료 시점 콜백

   ★ 관람(방문) 모드는 이 파일이 책임진다
     방문이 시작되면 등록된 창은 전부 자동으로 닫히고, onVisit(true)가 불린다.
     게임 파일은 구독 해제 같은 정리만 onVisit에서 하면 된다.
   ══════════════════════════════════════════════════════════════════════════════ */
const MHD_APPS = [];        // 등록된 외부 앱 목록
const MHD_WINS = [];        // 등록된 외부 창 id — 관람 모드 진입 시 일괄 닫기 대상
const MHD_HOMEWINS = [];    // 그중 마이홈 창 전체를 덮는 창 id (host:'home')
const MHD_ENV = [];         // 환경 설정 메뉴에 붙일 외부 하위메뉴
const MHD_READYCBS = [];    // onReady 대기열
let   MHD_READY = false;    // advInit이 #advDesktop을 만든 뒤 true

/* 아이콘 자동 배치 — 바탕화면을 78×66 격자로 보고 '빈 칸'을 찾아 넣는다.
   ★ 단순히 '기존 아이콘 개수'를 자리 번호로 쓰면 안 된다.
     내장 아이콘 좌표는 CSS에 박혀 있고(#advIconSim=0번칸/12px · #advIconChar=1번칸/90px),
     ADV_GAME_OFF=true면 0번 칸이 비고 개수는 1이 된다 → 새 아이콘이 1번 칸으로 가서
     캐릭터세팅과 정확히 겹친다. 그래서 '있는 칸'을 예약 목록으로 세고 빈 칸을 준다.
     (게임이 꺼진 지금은 새 앱이 0번 칸에 들어가 빈자리를 메운다) */
const MHD_COL_W=78, MHD_ROW_H=66, MHD_X0=12, MHD_Y0=14;

function mhdNextSlot(prefer){
  const used=new Set();
  if(document.getElementById('advIconSim'))  used.add(0);   // 좀아칼 폴더 = 0번 칸(CSS left:12px)
  if(document.getElementById('advIconChar')) used.add(1);   // 캐릭터세팅 = 1번 칸(CSS left:90px)
  MHD_APPS.forEach(a=>{ if(a._slot!=null && document.getElementById(a.iconId)) used.add(a._slot); });
  /* slot을 지정한 앱은 그 칸을 우선 받는다 — "캐릭터세팅이 있던 자리에" 같은 요구를
     등록 순서에 의존하지 않고 코드에 명시해 두기 위한 것. 이미 찬 칸이면 다음 빈 칸으로 밀린다. */
  if(typeof prefer==='number' && prefer>=0 && !used.has(prefer)) return prefer;
  let i=0; while(used.has(i)) i++;
  return i;
}

function mhdPlaceIcon(node, idx){
  const d=document.getElementById('advDesktop');
  const w=(d && d.clientWidth) || 300;
  const cols=Math.max(1, Math.floor((w-MHD_X0)/MHD_COL_W));
  node.style.left=(MHD_X0 + (idx%cols)*MHD_COL_W)+'px';
  node.style.top =(MHD_Y0 + Math.floor(idx/cols)*MHD_ROW_H)+'px';
}

function mhdMountApp(a){
  const d=document.getElementById('advDesktop'); if(!d) return;
  if(document.getElementById(a.iconId)) return;                 // 중복 마운트 방지
  const idx = (a._slot = mhdNextSlot(a.slot));                  // 지정 칸 우선, 없으면 빈 칸
  const ic=h('<div class="adv-icon" id="'+a.iconId+'">'
    +'<div class="ic">'+esc(a.icon||'📁')+'</div>'
    +'<span class="lb">'+esc(a.label||'')+'</span></div>');
  mhdPlaceIcon(ic, idx);
  ic.addEventListener('click', ()=>{
    if(advVisiting) return;                                     // 남의 집에선 열지 않는다
    try{ a.onOpen && a.onOpen(); }
    catch(e){ console.error('[MYHOME_DESKTOP] '+a.id+'.onOpen 실패', e); }
  });
  d.appendChild(ic);
}

function mhdMountAll(){
  MHD_READY=true;
  MHD_APPS.forEach(a=>{ try{ mhdMountApp(a); }catch(e){ console.error('[MYHOME_DESKTOP] mount 실패', a.id, e); } });
  mhdMountAllEnv();
  MHD_READYCBS.splice(0).forEach(f=>{ try{ f(window.MYHOME_DESKTOP); }catch(e){ console.error('[MYHOME_DESKTOP] onReady 실패', e); } });
}

/* 관람 모드 전파 — _advApplyVisitUI에서 호출한다 */
function mhdNotifyVisit(visiting){
  MHD_APPS.forEach(a=>{ if(a.onVisit) try{ a.onVisit(!!visiting); }catch(e){ console.error('[MYHOME_DESKTOP] '+a.id+'.onVisit 실패', e); } });
}

/* 🔌 외부 앱이 '환경 설정' 메뉴에 하위메뉴를 하나 붙인다.
   ★ 게임이 자기 설정을 바탕화면 메뉴에 노출하려면 이 창구를 쓴다.
     여기 없이 하려면 게임 파일이 #advEnvMenu에 직접 DOM을 꽂아야 하는데,
     그러면 게임을 지울 때 메뉴에 빈 항목이 남거나 이벤트가 새는 지점이 된다. */
function mhdMountEnv(e){
  const menu=document.getElementById('advEnvMenu'); if(!menu) return;
  if(document.getElementById(e.subId)) return;
  const sub=h('<div class="mhd-envsub" id="'+e.subId+'">'
    +'<button type="button" class="hd">'+esc(e.label)+'<span>▶</span></button>'
    +'<div class="mhd-fly"></div></div>');
  const fly=sub.querySelector('.mhd-fly');
  (e.items||[]).forEach(it=>{
    const b=h('<button type="button">'+esc(it.label)+'</button>');
    b.dataset.v=String(it.value);
    b.addEventListener('click', ev=>{
      ev.stopPropagation();
      sub.classList.remove('on'); menu.classList.remove('on');
      try{ e.onSelect && e.onSelect(it.value); }catch(err){ console.error('[MYHOME_DESKTOP] '+e.id+'.onSelect 실패', err); }
      mhdMarkEnv(e);
    });
    fly.appendChild(b);
  });
  const hd=sub.querySelector('.hd');
  hd.addEventListener('click', ev=>{ ev.stopPropagation(); sub.classList.toggle('on'); });
  sub.addEventListener('mouseenter', ()=>sub.classList.add('on'));
  sub.addEventListener('mouseleave', ()=>sub.classList.remove('on'));
  menu.appendChild(sub);
  mhdMarkEnv(e);
}
/* 현재 선택된 항목에 표시 — 메뉴를 열었을 때 지금 값이 뭔지 보이게 */
function mhdMarkEnv(e){
  const sub=document.getElementById(e.subId); if(!sub) return;
  let cur=null; try{ cur = e.get ? String(e.get()) : null; }catch(_){}
  sub.querySelectorAll('.mhd-fly button').forEach(b=>b.classList.toggle('sel', cur!=null && b.dataset.v===cur));
}
function mhdMountAllEnv(){ MHD_ENV.forEach(e=>{ try{ mhdMountEnv(e); }catch(err){ console.error('[MYHOME_DESKTOP] env mount 실패', e.id, err); } }); }

window.MYHOME_DESKTOP = {
  version: 1,

  /* 폴더 아이콘 등록. advInit 전에 불러도 되고(대기열에 쌓았다가 마운트), 후에 불러도 된다. */
  addFolder(o){
    if(!o || !o.id) return null;
    if(MHD_APPS.some(a=>a.id===o.id)) return MHD_APPS.find(a=>a.id===o.id);
    const a={ id:o.id, label:o.label||o.id, icon:o.icon||'📁', slot:o.slot,
              onOpen:o.onOpen, onVisit:o.onVisit, iconId:'mhdIcon_'+o.id };
    MHD_APPS.push(a);
    if(MHD_READY) mhdMountApp(a);
    return a;
  },

  removeFolder(id){
    const i=MHD_APPS.findIndex(a=>a.id===id); if(i<0) return;
    const n=document.getElementById(MHD_APPS[i].iconId); if(n) n.remove();
    MHD_APPS.splice(i,1);
  },

  /* '환경 설정'에 하위메뉴를 붙인다.
     items: [{value, label}] · get(): 현재 값(표시용) · onSelect(value): 선택 시 */
  addEnvMenu(o){
    if(!o || !o.id) return null;
    if(MHD_ENV.some(e=>e.id===o.id)) return null;
    const e={ id:o.id, label:o.label||o.id, items:o.items||[], get:o.get, onSelect:o.onSelect,
              subId:'mhdEnv_'+o.id };
    MHD_ENV.push(e);
    if(MHD_READY) mhdMountEnv(e);
    return e;
  },

  /* Win98 창 껍데기 생성 → 내용을 채울 body 엘리먼트를 돌려준다.
     fill:true(기본)면 붙은 곳을 꽉 채운다.
     host:'home' 이면 미니 바탕화면이 아니라 #myHomeWin(마이홈 창) 전체를 덮는다.
       ★ 왜 붙이는 곳을 바꿔야 하는가 — z-index만 올려선 안 된다.
         말랑이 시메지 레이어(#mlLayer, z-index:120)는 #myHomeWin의 자식이고,
         미니 바탕화면(#advDesktop)은 #mhRoomPreview 안의 z-index:3짜리 자식이다.
         부모가 이미 아래 깔려 있으니 자식 창을 z-index 9999로 줘도 시메지를 못 덮는다.
         그래서 창 자체를 #myHomeWin의 자식으로 옮겨야 한다(캐릭터세팅 창과 같은 방식). */
  createWindow(o){
    const d=document.getElementById('advDesktop'); if(!d || !o || !o.id) return null;
    let w=document.getElementById(o.id);
    if(!w){
      w=h('<div class="adv-win" id="'+o.id+'">'
        +'<div class="adv-titlebar"><span class="mhd-title"></span>'
        +'<span class="adv-tb-right"><span class="x">×</span></span></div>'
        +'<div class="mhd-win-body"></div></div>');
      w.querySelector('.mhd-title').textContent=o.title||'';
      if(o.fill!==false){ w.style.cssText+='inset:0;left:0;top:0;transform:none;width:auto;height:auto;max-width:none;max-height:none;z-index:150;'; }
      w.querySelector('.x').addEventListener('click', ()=>{
        w.classList.remove('on');
        if(o.onClose) try{ o.onClose(); }catch(e){ console.error('[MYHOME_DESKTOP] '+o.id+'.onClose 실패', e); }
      });
      advBindWinDrag(w.querySelector('.adv-titlebar'));   // 타이틀바 드래그 = 프로그램 창 이동(기존과 동일)
      d.appendChild(w);
      if(o.host==='home') MHD_HOMEWINS.push(o.id);        // openWindow에서 마이홈 창으로 옮긴다
      if(MHD_WINS.indexOf(o.id)<0) MHD_WINS.push(o.id);
    }
    const body=w.querySelector('.mhd-win-body');
    if(body) body.style.cssText+='flex:1;min-height:0;overflow:auto;';
    return body;
  },

  openWindow(id){
    if(advVisiting) return;
    const w=document.getElementById(id); if(!w) return;
    /* host:'home' 창은 열 때마다 부모를 확인한다. 생성 시점엔 #myHomeWin이 아직 없을 수도 있고,
       탭 전환 등으로 DOM이 재구성되면 다시 붙여야 하기 때문(캐릭터세팅 창과 동일한 처리). */
    if(MHD_HOMEWINS.indexOf(id)>=0){
      const homeWin=document.getElementById('myHomeWin');
      if(homeWin && w.parentNode!==homeWin) homeWin.appendChild(w);
    }
    w.classList.add('on');
  },
  closeWindow(id){ advCloseWin(id); },
  isVisiting(){ return advVisiting; },
  desktop(){ return document.getElementById('advDesktop'); },
  onReady(fn){ if(typeof fn!=='function') return; if(MHD_READY) fn(window.MYHOME_DESKTOP); else MHD_READYCBS.push(fn); }
};

/* 이 파일보다 먼저 로드된 게임 파일이 쌓아둔 예약을 소화한다(로드 순서 무관하게 만들기).
   ★ 여기서 바로 부르지 않고 onReady로 넘긴다 — 이 시점엔 advInit이 아직 안 돌아
   #advDesktop이 없으므로, 바로 부르면 createWindow가 null을 돌려주고 게임이 안 뜬다. */
if(Array.isArray(window._MHD_PENDING)){
  window._MHD_PENDING.splice(0).forEach(f=>{ try{ window.MYHOME_DESKTOP.onReady(f); }catch(e){ console.error('[MYHOME_DESKTOP] pending 실패', e); } });
}

/* ─────────────────────────── DOM 생성 ─────────────────────────── */
function advInit(){
  const room = document.getElementById('mhRoomPreview');
  if(!room) return;
  if(document.getElementById('advDesktop')) return;

  // 🖥️ 내 바탕화면을 서버와 동기화 — 예전엔 로컬에만 저장돼 방문자가 볼 수 없었음.
  try{ advSyncBgOnStart(); }catch(_){}

  const style=document.createElement('style'); style.id='advStyle'; style.textContent=css;
  document.head.appendChild(style);

  const desk = h(
    '<div id="advDesktop">'+
      (ADV_GAME_OFF?'':'<div class="adv-icon" id="advIconSim"><div class="ic">📁</div><span class="lb">'+ADV_WORLD.folderName+'</span></div>')+
      (ADV_HIDE_CHAR?'':'<div class="adv-icon" id="advIconChar"><div class="ic">📁</div><span class="lb">캐릭터세팅</span></div>')+
      '<div id="advTaskbar"><button id="advEnvBtn" type="button">환경 설정</button></div>'+
      '<div id="advEnvMenu">'+
        '<button id="advEnvColor" type="button">🎨 배경 색상 변경</button>'+
        '<button id="advEnvFile" type="button">📁 배경 이미지 (파일에서)</button>'+
        '<button id="advEnvImg" type="button">🖼 배경 이미지 (URL로)</button>'+
        '<button id="advEnvReset" type="button">↺ 기본 배경으로</button>'+
      '</div>'+
      '<div id="advUrlBox"><div class="t">배경 이미지 URL</div>'+
        '<input id="advUrlInput" type="text" placeholder="https://... 이미지 주소">'+
        '<div class="row"><button id="advUrlOk" type="button">적용</button><button id="advUrlCancel" type="button">취소</button></div>'+
      '</div>'+
      '<input id="advBgColorInput" type="color" style="display:none;">'+
      /* 시뮬 창 (꽉 채움) */
      '<div class="adv-win" id="advSimWin">'+
        '<div class="adv-titlebar"><span>'+ADV_WORLD.title+'</span><span class="adv-tb-right"><span class="adv-bgm-btn" id="advBgmBtn" title="BGM 끄기"></span><span class="x" id="advSimClose">×</span></span></div>'+
        '<div id="advSimInner"></div>'+
        /* 친구 초대 팝업 (시뮬 창 내부 오버레이) */
        '<div id="advFriendPop"><div class="adv-pop-box">'+
          '<div class="adv-pop-title">👥 파티 초대 <span class="x" id="advFriendClose">×</span></div>'+
          '<div class="adv-pop-note">친구만 초대할 수 있어요.</div>'+
          '<div id="advFriendList" class="adv-fr-list"></div>'+
        '</div></div>'+
        /* 구성원 정보 팝업 */
        '<div id="advMemberPop"><div class="adv-pop-box">'+
          '<div class="adv-pop-title">🧟 구성원 정보 <span class="x" id="advMemberClose">×</span></div>'+
          '<div id="advMemberBody" class="adv-mi-body"></div>'+
        '</div></div>'+
      '</div>'+
      /* 인벤토리 창 */
      '<div class="adv-win" id="advInvWin">'+
        '<div class="adv-titlebar"><span>🎒 인벤토리 (캐릭터 공용)</span><span class="x" id="advInvClose">×</span></div>'+
        '<div class="adv-inv-body" id="advInvBody"></div>'+
      '</div>'+
      /* 캐릭터세팅 창 */
      '<div class="adv-win" id="advCharWin">'+
        '<div class="adv-titlebar"><span>🧟 캐릭터세팅</span><span class="x" id="advCharClose">×</span></div>'+
        '<div class="adv-char-main">'+
        '<div id="advSlotTabs"></div>'+
        '<div class="adv-char-body">'+
          '<div class="adv-rpt-topbar"><span>▲▣ CLASSIFIED</span><span id="advRptNo">No.001</span></div>'+
          '<div class="adv-rpt-heading">SURVIVOR REGISTRATION</div>'+
          '<div class="adv-char-top">'+
            '<div class="adv-face-col">'+
              '<div class="adv-face-big" id="advFaceBig"></div>'+
              '<span class="adv-face-hint">클릭해서 변경</span>'+
              '<div class="adv-face-pick" id="advFacePick"></div>'+
            '</div>'+
            '<div class="adv-fields">'+
              '<div class="adv-field-row"><label>이름</label><input id="advFName" type="text" maxlength="12" placeholder="이름"></div>'+
              '<div class="adv-field-row"><label>나이</label><input id="advFAge" type="number" min="0" max="120" maxlength="3" placeholder="예: 27"></div>'+
              '<div class="adv-field-row"><label>성격</label><input id="advFPers" type="text" maxlength="20" placeholder="예: 침착함"></div>'+
            '</div>'+
            '<div class="adv-keepsake-col">'+
              '<div class="adv-keepsake-box" id="advKeepBox" title="좌클릭: 유품 등록 · 우클릭: 설명">＋</div>'+
              '<span class="adv-face-hint">유품 (우클릭=설명)</span>'+
              '<div class="adv-keep-pop" id="advKeepPop" style="display:none">'+
                '<textarea id="advKeepDesc" maxlength="140" placeholder="유품 설명 (140자)"></textarea>'+
                '<button id="advKeepDone" type="button">완료</button>'+
              '</div>'+
            '</div>'+
          '</div>'+
          '<div class="adv-char-stats" id="advCharStats"></div>'+
          '<div class="adv-equip" id="advEquip"></div>'+
          '<div class="adv-equip" id="advTitleSel"></div>'+
          '<div class="adv-derived" id="advDerived"></div>'+
          '<div class="adv-char-foot">'+
            '<span class="sp">남은 포인트: <b id="advCharSp">0</b><button id="advCharReset" type="button">분배 초기화</button></span>'+
            '<button id="advCharSelect" type="button">캐릭터 선택</button>'+
          '</div>'+
        '</div>'+
        '</div>'+
      '</div>'+
    '</div>');
  room.appendChild(desk);

  advBindEvents();
  advApplyBg();
  mhdMountAll();   // 🔌 외부 앱(mystery-au.js 등) 아이콘 마운트 — 등록된 게 없으면 아무 일도 안 한다
}

/* ─────────────────────────── 시뮬: 좌측 패널 + 우측 스크립트 ─────────────────────────── */
function slotFilled(s){ return !!(s && (s.name || s.faceImg || slotSpent(s)>0)); }

function advBuildSimInner(){
  const inner=document.getElementById('advSimInner'); if(!inner) return;
  if(!slotFilled(activeSlot())){
    inner.innerHTML='<div class="adv-sim-empty">아직 <b>선택된 캐릭터</b>가 없어요.<br>📁 캐릭터세팅에서 캐릭터를 만들고<br><b>[캐릭터 선택]</b>을 눌러 주세요.</div>';
    return;
  }
  inner.innerHTML=
    '<div class="adv-sim-main">'+
      '<div class="adv-left">'+
        '<div class="adv-id-row">'+
          '<div class="adv-portrait" id="advSimFace"></div>'+
          '<div class="adv-id-meta"><b id="advSimName">-</b><span id="advSimAge"></span><span class="lv" id="advSimLv"></span></div>'+

        '</div>'+
        '<div class="adv-rows">'+
          '<div class="adv-row"><span class="k">체력</span><span class="v"><span class="bar hp"><i id="advHpFill"></i></span><span class="num" id="advHpNum"></span></span></div>'+
          '<div class="adv-row"><span class="k">기력</span><span class="v"><span class="bar st"><i id="advStFill"></i></span><span class="num" id="advStNum"></span></span></div>'+
          '<div class="adv-row"><span class="k">공격력</span><span class="v" id="advAtk"></span></div>'+
          '<div class="adv-row"><span class="k">방어력</span><span class="v" id="advDef"></span></div>'+
          '<div class="adv-row"><span class="k">착용 무기</span><span class="v" id="advWeapon"></span></div>'+
          '<div class="adv-row"><span class="k">상태</span><span class="v" id="advStatus"></span></div>'+
          '<div class="adv-row"><span class="k">감염률</span><span class="v"><span class="bar inf"><i id="advInfFill"></i></span><span class="num" id="advInfNum"></span></span></div>'+
        '</div>'+
        '<div class="adv-body" id="advBody"></div>'+   /* ★ 몸 상태 문구 — 감염률 바로 아래. 양호하면 비어 있다 */
        '<div class="adv-items" id="advSimItems"></div>'+
        '<div class="adv-tools"><button id="advMapBtn" type="button" title="지도">🗺️</button><span id="advKeepIcon" class="adv-keep-icon" style="display:none"></span><span id="advRecvKeeps" class="adv-recv-keeps"></span></div>'+
      '</div>'+
      '<div class="adv-stage">'+
        '<div class="adv-stage-top">'+
          '<div class="adv-center">'+
            '<button class="adv-fb-btn" id="advFbBtn" type="button" title="피드백 열기/닫기" style="display:none">🗨</button>'+
            '<div class="adv-terminal" id="advTerm"></div>'+
            '<div class="adv-choices" id="advChoices"></div>'+
            '<div class="adv-fb-pop hidden" id="advFbPop"></div>'+
          '</div>'+
          '<div class="adv-move-panel" id="advMovePanel"></div>'+
        '</div>'+
        '<div class="adv-chat-panel hidden" id="advChatPanel"></div>'+
      '</div>'+
      '<div class="adv-map-view" id="advMapView"></div>'+
      '<div class="adv-tip" id="advTip"></div>'+   /* ★ 아이템 설명 툴팁(마우스오버) — adv-items가 overflow로 잘라내므로 바깥에 둔다 */
    '</div>'+
    '<div class="adv-party">'+
      '<span class="mates" id="advPartyMates"></span>'+
      '<span class="adv-party-btns" id="advPartyBtns"></span>'+
    '</div>';
  const mb=document.getElementById('advMapBtn');
  if(mb) mb.onclick=advToggleMap;
  const fbb=document.getElementById('advFbBtn');   // ★ 요청1: 피드백 팝업 토글
  if(fbb) fbb.onclick=advToggleFeedback;
  const kis=document.getElementById('advKeepIcon');   // D#10 우클릭 = 유품 전달
  if(kis) kis.addEventListener('contextmenu', ev=>{ ev.preventDefault(); advKeepTransfer(); });
  const sf=document.getElementById('advSimFace');     // 🆘 프로필 우클릭 = 긴급 초기화(세션 종료) 확인창
  if(sf){ sf.title='우클릭: 세션 종료(긴급 초기화)'; sf.addEventListener('contextmenu', ev=>{ ev.preventDefault(); advEmergencyReset(); }); }
  advRenderSim();
  advRouteOnOpen();   // ★ 진입 라우터 — PARTY.started 아니면 모드선택→세계관 인트로, 시작됐으면 현재 씬
}


/* ═══ 🗺️ 지도 뷰 — 안개 렌더 · ▼깜빡임 · (1차: 이동 없음, 보기만) ═══ */
let _advMapBlinkT=null, _advMapCache=null;
function advMarkSeen(m, cx, cy){
  if(!ADV.map.seen) ADV.map.seen=[];
  const set=new Set(ADV.map.seen);
  for(let dy=-ADV_MAP_VIS;dy<=ADV_MAP_VIS;dy++)for(let dx=-ADV_MAP_VIS;dx<=ADV_MAP_VIS;dx++){
    const x=cx+dx, y=cy+dy;
    if(x<0||y<0||x>=ADV_MAP_W||y>=ADV_MAP_H) continue;
    set.add(x+','+y);
  }
  ADV.map.seen=Array.from(set);
}
function advEnsureMap(){
  if(!ADV.map || typeof ADV.map.seed!=='number'){
    let seed=null;
    if(advIsParty() && PARTY.pid && !iAmLeader()){ const ls=advLeaderSeed(); if(ls!=null) seed=ls; }   // 파티원 = 파티장 시드 상속
    if(seed==null) seed=(Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0;   // 솔로/파티장 = 랜덤
    const m=advGenMap(seed);
    ADV.map={ seed, pos:{x:m.start.x,y:m.start.y}, stepped:[m.start.x+','+m.start.y], found:[], seen:[] };
    advMarkSeen(m, m.start.x, m.start.y);
    advSave();
    advPublishSeedIfLeader();   // 파티장이면 팀원에게 시드 공유
  }
  if(!ADV.map.seen){ ADV.map.seen=[]; advMarkSeen(advGenMap(ADV.map.seed), ADV.map.pos.x, ADV.map.pos.y); }
  if(!_advMapCache || _advMapCache.seed!==ADV.map.seed) _advMapCache=advGenMap(ADV.map.seed);
  return _advMapCache;
}

/* 🗺️ 이동 판정 — from(현재)에서 to로 갈 수 있나. 건물은 입구 면 직교 진입만 허용. */
function advCellBldg(m, x, y){ const c=(m.grid[y]&&m.grid[y][x]); return (c&&c.bldg!==undefined)?c.bldg:-1; }
function advCanEnter(m, fx, fy, tx, ty){
  if(tx<0||ty<0||tx>=ADV_MAP_W||ty>=ADV_MAP_H) return false;
  const dx=tx-fx, dy=ty-fy;
  if(Math.abs(dx)>1||Math.abs(dy)>1||(dx===0&&dy===0)) return false;   // 인접만
  if(dx!==0 && dy!==0) return false;   // ★ 대각선 금지 — 십자(상하좌우)만 이동
  const fromB=advCellBldg(m,fx,fy), toB=advCellBldg(m,tx,ty);
  const OUT={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  // 같은 건물 내부 이동 자유
  if(fromB>=0 && toB===fromB) return true;
  // 건물 안 → 밖: 반드시 문 칸에서 문 바깥 방향으로만 (건물 안에선 문 전까지 건물 이동만)
  if(fromB>=0 && toB<0){
    const out=OUT[m.buildings[fromB].door];
    return advIsDoorCell(m,fromB,fx,fy) && dx===out[0] && dy===out[1];
  }
  // 건물 안 → 다른 건물: 직접 불가(밖으로 나가 문으로 재진입해야)
  if(fromB>=0 && toB>=0) return false;
  // 밖 → 밖(벌판/캠프/목표): 자유
  if(toB<0) return true;
  // 밖 → 건물 진입: 입구 면 직교 진입만
  const bd=m.buildings[toB]; const need=OUT[bd.door];
  if(need[0]===-dx && need[1]===-dy){
    if(bd.door==='up'||bd.door==='down') return fx>=bd.x && fx<bd.x+bd.w;
    else return fy>=bd.y && fy<bd.y+bd.h;
  }
  return false;
}


/* 이동 상황 플레이버 — 빈 벌판에 도착 시 랜덤 1줄. 근처(±2)에 미확인 전투 있으면 힌트. */
const ADV_FLAVOR_PLAIN=[
  '평범한 도로다. 아무것도 없다.','텅 빈 거리. 바람에 종잇조각만 날린다.',
  '부서진 차 몇 대가 널브러져 있다.','깨진 유리가 발밑에서 밟힌다. 조용하다.',
  '무너진 담벼락 사이를 지난다.','한때 사람이 살았을 골목. 지금은 적막하다.',
  '멀리 까마귀 울음소리만 들린다.','녹슨 표지판이 바람에 삐걱인다.'];
const ADV_FLAVOR_NEAR=[
  '…어디선가 낮은 신음이 들린다. 감염자가 가깝다.','바스락 — 근처에서 인기척인지 뭔지 모를 소리가 났다.',
  '피 냄새가 희미하게 감돈다. 조심해야겠다.'];
function advMoveFlavor(){
  const m=advEnsureMap(), p=ADV.map.pos;
  // 근처 ±2에 아직 안 밟은 전투칸이 있으면 힌트 확률
  let near=false;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const x=p.x+dx,y=p.y+dy; if(x<0||y<0||x>=ADV_MAP_W||y>=ADV_MAP_H)continue;
    const c=m.grid[y][x]; if(c.kind==='combat' && !(ADV.map.stepped||[]).includes(x+','+y)) near=true;
  }
  if(near && Math.random()<0.5) return ADV_FLAVOR_NEAR[Math.floor(Math.random()*ADV_FLAVOR_NEAR.length)];
  return ADV_FLAVOR_PLAIN[Math.floor(Math.random()*ADV_FLAVOR_PLAIN.length)];
}
let _advMoveFlavor='';
/* 🚶 [이동] — 주변 3×3에서 한 칸 선택 이동. 8방향·건물 입구 규칙·기력(벌판0/이벤트5). */
let _advMoveBlinkT=null;
function advIsDoorCell(m, bi, x, y){
  const bd=m.buildings[bi];
  if(bd.door==='up')   return y===bd.y;
  if(bd.door==='down') return y===bd.y+bd.h-1;
  if(bd.door==='left') return x===bd.x;
  return x===bd.x+bd.w-1;   // right
}
// 발견된 건물 칸의 채색 {bg, inner} — 몸통=테마색 반투명, 문 면=진한 테마색.
function advBldgFill(m, bi, x, y){
  const bd=m.buildings[bi];
  const col=bd.story?'#ffd83d':ADV_THEMES[m.themes[bd.band]].color;
  const door=advIsDoorCell(m,bi,x,y);
  const bg=col+'40';   // 균일 채색(문 구분 없음)
  const inner=bd.story?'<span style="color:#3a2e00;font-weight:bold">★</span>':'';
  const edge = door ? bd.door : '';   // 문 면 → 그 방향 외곽선만 진하게
  return {bg,inner,door,edge};
}
// 문 면 방향 → 해당 변만 진한 테두리 CSS (지도/이동칸 공용)
function advDoorBorderStyle(edge){
  if(!edge) return '';
  const c='#ffe066';
  const m={up:'border-top',down:'border-bottom',left:'border-left',right:'border-right'};
  return m[edge]+':2px solid '+c+';';
}
function advCellChar(m, x, y, stepped, found){
  const cell=m.grid[y][x], key=x+','+y;
  if(cell.kind==='camp'){ const c=m.camps.find(c=>c.x===x&&c.y===y); return ['<span style="color:#4a9de8">'+{A:'Ⓐ',B:'Ⓑ',C:'Ⓒ'}[c.name]+'</span>','캠프 '+c.name]; }
  if(cell.kind==='goal') return ['<span style="color:#4ae87a">◎</span>','목표'];
  if(cell.bldg!==undefined){   // 이동칸: 건물 항상 표시(±4 시야 안이니까)
    const f=advBldgFill(m,cell.bldg,x,y); const bd=m.buildings[cell.bldg];
    return [f.inner, bd.t+(f.door?' (입구)':''), f.bg, advDoorBorderStyle(f.edge)];
  }
  if(stepped.has(key)){
    if(cell.kind==='combat') return ['<span style="color:#3a3a3a">·</span>','처리된 곳','',''];
    if(cell.kind==='resource') return ['<span style="color:#3a3a3a">·</span>','수거한 곳','',''];
    if(cell.kind==='minievent') return ['<span style="color:#6f6f6f">?</span>','지나온 자리 (흔적)','',''];
    return ['<span style="color:#565656">·</span>','빈 곳','',''];
  }
  // 이동칸은 ±4 시야라 이벤트도 보임(전투/자원 미리보기)
  if(cell.kind==='combat') return ['<span style="color:#e84a4a">×</span>','전투 지역','',''];
  if(cell.kind==='resource') return ['<span style="color:#9d7ae8">$</span>','물자','',''];
  if(cell.kind==='minievent') return ['<span style="color:#e8c84a">?</span>','수상한 기척','',''];
  if(cell.kind==='camp') { const c=m.camps.find(c=>c.x===x&&c.y===y); return ['<span style="color:#4a9de8">'+{A:'Ⓐ',B:'Ⓑ',C:'Ⓒ'}[c.name]+'</span>','캠프','',''];}
  if(cell.kind==='goal') return ['<span style="color:#4ae87a">◎</span>','목표','',''];
  return ['<span style="color:#3c3c3c">·</span>','빈 곳','','']; // 벌판
}
function advOpenMove(){
  if(ADV.hp<=0){ advCombatDeath(); return; }   // 안전망
  _advPanel='move'; ADV._campLog='';   // ★ 캠프를 나서면 오른쪽은 다시 이동 패널
  // ★ 버그수정(캠프에서 나와도 이동 불가): ADV.scene='camp'를 푸는 곳이 어디에도 없었다.
  //   advCanMoveNow()가 scene==='camp'면 false라, [캠프를 나선다]를 눌러도 이동 패널이 계속 잠겨 있었음.
  if(ADV.scene==='camp'){ ADV.scene=''; advSave(); advSyncMyLocation(); }
  _advMoveFlavor=advMoveFlavor();
  advShowExplorePrompt(false);   // 이동은 우측 패널에서 상시 — 가운데는 탐색 스크립트로 복귀
}
function advMoveArrowColor(m,x,y,stepped){
  const cell=m.grid[y][x];
  if(ADV.map && ADV.map.wounded && ADV.map.wounded[x+','+y]) return '#e84a4a';   // ★ 후퇴한 적이 아직 버티고 있는 칸
  if(stepped && stepped.has(x+','+y)) return '#8a8a8a';   // 갔던 곳
  if(cell.bldg!==undefined) return '#c9b45a';             // 건물(입구)
  if(cell.kind==='combat') return '#e84a4a';
  if(cell.kind==='resource') return '#9d7ae8';
  if(cell.kind==='minievent') return '#e8c84a';
  if(cell.kind==='camp') return '#4a9de8';
  if(cell.kind==='goal') return '#4ae87a';
  return '#7ab8ff';   // 빈 벌판 = 파란 화살표
}
function advCanMoveNow(){
  if(ADV.hp<=0) return false;
  if(typeof ADV_COMBAT!=='undefined' && ADV_COMBAT) return false;   // 전투 중
  if(ADV.story && ADV.story.beat) return false;                     // 스토리 진행 중
  if(ADV.scene==='camp') return false;                              // 캠프
  return true;
}
function advMoveBlockReason(){   // ★ 이동 불가 사유 표시 — 원인 모를 '잠김' 상태를 바로 진단할 수 있게
  if(ADV.hp<=0) return '쓰러짐';
  if(typeof ADV_COMBAT!=='undefined' && ADV_COMBAT) return '전투 중';
  if(ADV.story && ADV.story.beat) return '이야기 진행 중';
  if(ADV.scene==='camp') return '캠프에 있음';
  return '알 수 없음';
}
// 🧭 우측 패널 — 기본은 이동. 캠프에서 거래/조합을 고르면 같은 자리에 칸 배치로 뜬다(_advPanel).
let _advPanel='move';   // 'move' | 'shop' | 'craft' — 비영속(껐다 켜면 이동으로 복귀)
function advRenderMoveNav(){
  const panel=document.getElementById('advMovePanel'); if(!panel) return;
  if(!PARTY.started || !ADV.map){ panel.classList.add('hidden'); panel.innerHTML=''; panel._advLastHtml=''; _advPanel='move'; return; }   // 로비(시작 전)엔 숨김 → 가운데가 전체 영역 사용 (★#6: 재표시 시 diff가 변화를 감지하도록 캐시 리셋)
  panel.classList.remove('hidden');
  if(_advPanel!=='move' && ADV.scene!=='camp') _advPanel='move';   // ★ 캠프를 벗어나면 무조건 이동 패널로 복귀
  if(_advPanel!=='move'){ advRenderCampPanel(panel); return; }
  const m=advEnsureMap(); const p=ADV.map.pos;
  const stepped=new Set(ADV.map.stepped||[]); const found=advMapVisibleBldgs(m);
  const enabled=advCanMoveNow();
  // ★ #1: 파티원 위치 → 셀별 마커 맵 ("x,y" → [{color,name}])
  const mateAt={};
  if(advIsParty() && partyCount()>1){
    const M=partyMembers();
    for(const uid in M){ if(uid===myUid()) continue; const c=advMateCoord(uid); if(!c) continue;
      const k=c.x+','+c.y; (mateAt[k]=mateAt[k]||[]).push({color:advMateColor(uid), name:(M[uid].charName||M[uid].nick||'?')}); }
  }
  const mateDots=(x,y)=>{ const a=mateAt[x+','+y]; if(!a) return '';
    return '<span class="mm" title="'+esc(a.map(m=>m.name).join(', '))+'">'+a.slice(0,3).map(m=>'<i style="color:'+m.color+'">●</i>').join('')+'</span>'; };
  let html='<p class="adv-move-title">[ 이동 ]</p>';
  html+='<p class="adv-move-flavor">'+(enabled?(_advMoveFlavor||'어느 곳으로 갈까.'):('지금은 이동할 수 없다. <span style="opacity:.7">('+advMoveBlockReason()+')</span>'))+'</p>';
  html+='<p class="sys" style="font-size:10px;margin:0 0 6px">어느 곳으로 이동할까? (기력 '+ADV.st+')</p>';
  // ★ #4-B: 목표 깃발 배너 + 하단우측 방향 점 (guidance-only)
  let _navDot='';
  const _fl=advActiveFlag();   // ★ #1: 내 깃발 없으면 팀장 깃발
  if(_fl){
    const dx=_fl.x-p.x, dy=_fl.y-p.y, tot=Math.abs(dx)+Math.abs(dy);
    const ew = dx>0?('동 '+dx):(dx<0?('서 '+(-dx)):'');
    const ns = dy>0?('남 '+dy):(dy<0?('북 '+(-dy)):'');
    const dirs = [ew,ns].filter(Boolean).join(' · ');
    html+='<div class="adv-flag-banner"><span class="fl">🚩</span><span class="fc">'+_fl.x+','+_fl.y+(_fl.byLeader?' <span style="font-size:9px">팀장</span>':'')+'</span>'
      +'<span class="fd">'+(tot===0?'도착!':('총 '+tot+'칸'+(dirs?' · '+dirs:'')))+'</span>'
      +(_fl.mine?'<button type="button" class="adv-flag-x" title="깃발 해제">✕</button>':'')+'</div>';
    if(tot>0){ const ang=Math.atan2(dy,dx); const nx=Math.round(20+15*Math.cos(ang)), ny=Math.round(20+15*Math.sin(ang));
      _navDot='<div class="adv-nav-dot" title="목표 방향"><i class="ctr"></i><i class="pt" style="left:'+nx+'px;top:'+ny+'px"></i></div>';
    } else _navDot='<div class="adv-nav-dot arrived" title="도착"><i class="ok">◎</i></div>';
  }
  html+='<table class="adv-move-tbl">';
  for(let dy=-2;dy<=2;dy++){
    html+='<tr>';
    for(let dx=-2;dx<=2;dx++){
      const x=p.x+dx, y=p.y+dy;
      if(dx===0&&dy===0){
        const md=mateAt[x+','+y];
        const mrow = md ? '<span class="mm-row" title="'+esc(md.map(m=>m.name).join(', '))+'">'+md.slice(0,4).map(m=>'<i style="color:'+m.color+'">●</i>').join('')+'</span>' : '';
        html+='<td class="adv-move-cell cur"><span class="me-stack"><span class="sq cur" style="color:#ffdd44">■</span>'+mrow+'</span></td>'; continue;
      }
      const inb=(x>=0&&y>=0&&x<ADV_MAP_W&&y<ADV_MAP_H);
      if(!inb){ html+='<td class="adv-move-cell wall"></td>'; continue; }
      const [cc,label,cbg,cedge]=advCellChar(m,x,y,stepped,found);
      const stStyle = (cbg?'background:'+cbg+';':'')+(cedge||'');
      const bgStyle = stStyle?(' style="'+stStyle+'"'):'';
      const isAdj = (Math.abs(dx)+Math.abs(dy)===1);   // 십자 인접
      const can = enabled && isAdj && advCanEnter(m,p.x,p.y,x,y);
      if(can){
        const arrow={'0,-1':'▲','0,1':'▼','-1,0':'◀','1,0':'▶'}[dx+','+dy];
        const acol=advMoveArrowColor(m,x,y,stepped);   // 화살표 색 = 그 칸 내용
        const wnd=!!(ADV.map.wounded && ADV.map.wounded[x+','+y]);   // ★ 후퇴한 적이 남은 칸은 '갔던 곳'으로 흐리게 처리하지 않는다
        const visited=stepped.has(x+','+y) && !wnd;
        html+='<td class="adv-move-cell go'+(visited?' visited':'')+'" data-x="'+x+'" data-y="'+y+'" title="'+label+(wnd?' · 상처 입은 적이 버티고 있다':(visited?' · 갔던 곳':''))+'"'+bgStyle+'><span class="adv-arrow" style="color:'+acol+'">'+arrow+'</span>'+mateDots(x,y)+'</td>';
      } else {
        html+='<td class="adv-move-cell ctx" title="'+(label||'')+'"'+bgStyle+'>'+cc+mateDots(x,y)+'</td>';
      }
    }
    html+='</tr>';
  }
  html+='</table>';
  const _refreshBtn = (advIsParty() && partyCount()>1) ? '<button type="button" class="adv-move-refresh" title="동료 위치 새로고침">🔄 동료 위치</button>' : '';
  if(_refreshBtn || _navDot){   // ★ 하단 행: 새로고침(좌) + 목표 방향 점(하단우측)
    html+='<div class="adv-move-btm">'+_refreshBtn+'<span class="adv-move-btm-sp"></span>'+_navDot+'</div>';
  }
  panel.classList.toggle('disabled', !enabled);
  // ★ #6 수정: 파티 콜백(advRenderSim)이 매 좌표 갱신마다 이 패널을 innerHTML 통째 교체 → 화살표 클릭 순간과 겹치면
  //   클릭한 노드가 교체돼 클릭이 유실됨(간헐적 "이동 안 됨" · 닫았다 켜면 새 패널이라 잠시 정상).
  //   (1) 내용 동일하면 DOM 교체 안 함(노드 안정)  (2) 클릭은 안정 부모(panel)에 위임(1회) → 재렌더에도 살아있음.
  if(panel._advLastHtml!==html){ panel.innerHTML=html; panel._advLastHtml=html; panel.scrollTop=0; }
  advBindPanelDeleg(panel);
  if(_advMoveBlinkT) clearInterval(_advMoveBlinkT);
  let flip=false;
  _advMoveBlinkT=setInterval(()=>{ const a=panel.querySelector('span.cur');
    if(!a){ clearInterval(_advMoveBlinkT); _advMoveBlinkT=null; return; } flip=!flip; a.textContent=flip?'□':'■'; },500);
}
/* 🏕 거래·조합 패널 — 이동 패널과 같은 자리, 같은 위임/diff 규칙을 쓴다(핸들러 유실 방지 패턴 유지) */
function advRenderCampPanel(panel){
  if(_advMoveBlinkT){ clearInterval(_advMoveBlinkT); _advMoveBlinkT=null; }   // 이동 커서 깜빡임 정지
  panel.classList.remove('disabled');   // ★ 캠프에선 advCanMoveNow()가 false지만 이 패널은 눌러야 한다
  const shop=(_advPanel==='shop');
  let html='<p class="adv-move-title">[ '+(shop?'거래':'조합')+' ]</p>';
  html+='<p class="adv-move-flavor">'+(shop?'보급관이 상자를 연다. 필요한 걸 골라.':'작업대 위에 부품을 늘어놓는다.')+'</p>';
  html+='<p class="sys" style="font-size:10px;margin:0 0 6px">보유 '+esc(shop?advInvSummary():advMatSummary())+'</p>';
  html+='<div class="adv-cell-grid">';
  if(shop){
    ADV_CAMP_OFFERS.forEach((o,i)=>{
      const out=advOfferOut(o), it=ADV_WORLD.items[out.id], ok=advCanAfford(o.give);
      html+='<div class="adv-pcell'+(ok?'':' off')+'" data-buy="'+i+'" title="'+esc(advOfferGive(o)+' → '+advOfferGet(o))+'">'
        +'<span class="ic">'+it.icon+'</span>'
        +'<span class="nm">'+esc(it.name)+(out.n>1?(' ×'+out.n):'')+'</span>'
        +'<span class="cost">'+esc(advCostText(o.give))+'</span></div>';
    });
  }else{
    ADV_CRAFT.forEach((r,i)=>{
      const lack=advCraftLack(r);
      const it=r.repair?{icon:'🧰', name:'무기 수리'}:ADV_WORLD.items[r.out];
      const sub=r.repair?('내구도 +'+r.repair):('공격 +'+it.weapon+' · 내구 '+it.maxDur);
      html+='<div class="adv-pcell'+(lack?' off':'')+'" data-craft="'+i+'" title="'+esc(advCraftCostText(r)+(lack?(' / 부족: '+lack):''))+'">'
        +'<span class="ic">'+it.icon+'</span>'
        +'<span class="nm">'+esc(it.name)+'</span>'
        +'<span class="atk">'+esc(sub)+'</span>'
        +'<span class="mat">'+esc(advCraftCostText(r))+'</span></div>';
    });
  }
  html+='</div>';
  if(!shop) html+='<p class="sys" style="font-size:9px;margin:6px 0 0;line-height:1.5">재료 무기는 조합에 쓰이면 사라져요.</p>';
  html+='<button type="button" class="adv-panel-back">↩ 캠프로</button>';
  if(panel._advLastHtml!==html){ panel.innerHTML=html; panel._advLastHtml=html; panel.scrollTop=0; }
  advBindPanelDeleg(panel);
}
/* ★ #6 패턴: 클릭은 안정 부모(panel)에 1회만 위임 — 재렌더로 노드가 갈려도 살아있다 */
function advBindPanelDeleg(panel){
  if(panel._advMoveDeleg) return;
  panel._advMoveDeleg=true;
  panel.addEventListener('click',ev=>{
    const cl=(sel)=>(ev.target&&ev.target.closest)?ev.target.closest(sel):null;
    const bk=cl('.adv-panel-back');
    if(bk&&panel.contains(bk)){ ev.preventDefault(); _advPanel='move'; ADV._campLog=''; advOpenCamp(advCurrentCamp()); advRenderMoveNav(); return; }
    const pc=cl('.adv-pcell');
    if(pc&&panel.contains(pc)){ ev.preventDefault();
      if(pc.classList.contains('off')){ advToast(_advPanel==='shop'?'물자가 부족해요':'재료가 부족해요'); return; }
      if(pc.dataset.buy!==undefined) advCampBuy(parseInt(pc.dataset.buy,10));
      else if(pc.dataset.craft!==undefined) advDoCraft(parseInt(pc.dataset.craft,10));
      return; }
    const fx=cl('.adv-flag-x');
    if(fx&&panel.contains(fx)){ ev.preventDefault(); advClearFlag(); return; }   // ★ #4-B: 깃발 해제
    const rf=cl('.adv-move-refresh');
    if(rf&&panel.contains(rf)){ ev.preventDefault(); advRefreshMates(); return; }   // ★ 새로고침 버튼
    const td=cl('.adv-move-cell.go');
    if(!td||!panel.contains(td)) return;
    const x=parseInt(td.dataset.x,10), y=parseInt(td.dataset.y,10);
    if(!isNaN(x)&&!isNaN(y)) advDoMove(x,y);
  });
}
function advRefreshMates(){   // ★ 상단요청: 동료 위치 강제 새로고침 — 끊긴 좌표 구독 복구 + 이동 패널 즉시 재렌더
  if(!(advIsParty() && partyCount()>1)){ advToast('파티 진행 중에만 쓸 수 있어요'); return; }
  try{ advSubscribeCoords(); }catch(_){}                                   // 혹시 끊긴 좌표 구독 복구
  const panel=document.getElementById('advMovePanel'); if(panel) panel._advLastHtml='';   // diff 무시하고 강제 재렌더
  advRenderMoveNav();
  advToast('🔄 동료 위치를 새로고침했어요');
}
function advDoMove(x,y){
  if(!advCanMoveNow()) return;   // 전투·스토리·캠프 중엔 이동 불가(패널 갱신 레이스 방지)
  ADV._combatSpectate=null;   // ★ #3: 그 칸을 떠나면 관전 종료(안 지우면 이동 후에도 전투 갱신마다 관전 화면이 덮어씀)
  const m=advEnsureMap();
  if(!advCanEnter(m,ADV.map.pos.x,ADV.map.pos.y,x,y)) return;
  ADV.map._prev={x:ADV.map.pos.x, y:ADV.map.pos.y};   // ★ #3: 직전 칸 기억(협공 '물러난다'용)
  ADV.map.pos={x,y};
  if(ADV.map.flag && ADV.map.flag.x===x && ADV.map.flag.y===y){ ADV.map.flag=null; advPublishFlag(); if(typeof toast==='function') toast('🚩 목표 지점 도착!'); }   // ★ #4-B: 깃발 도착 → 해제
  advMarkSeen(m, x, y);   // 이동한 곳 주변 ±4 = 확인됨(지도에 기록)
  const key=x+','+y;
  const wasNew=!(ADV.map.stepped||[]).includes(key);
  const cell=m.grid[y][x];
  const isEvent = (cell.kind==='combat'||cell.kind==='resource'||cell.kind==='minievent'||cell.kind==='storybldg'||(cell.bldg!==undefined));
  // ★ 자원·이벤트는 '실제 선택'해야, 전투 칸은 '적을 쓰러뜨려야' 소비된다.
  //   버그: 전투 칸이 밟는 즉시 stepped에 들어가서, 무시하거나 후퇴하면 적이 사라진 것처럼 보였다.
  //   이제 이 칸의 stepped 기록은 advCombatWin(=처치)에서만 한다.
  const defer = (cell.kind==='resource'||cell.kind==='minievent'||cell.kind==='combat');
  if(wasNew && !defer) (ADV.map.stepped=ADV.map.stepped||[]).push(key);
  advSpendSt(1);   // ★ #9: 이동 1칸 = 기력 -1 (즉시 화면 반영)
  advSyncMyCoord();   // D#1: 파티에 내 새 좌표 게시(안 움직였으면 내부에서 skip)
  if(document.getElementById('advMovePanel')) advRenderMoveNav();   // ★ 스킵버그 수정: 이동 후 이동패널을 '새 위치' 기준으로 즉시 갱신.
  advUpdateFeedbackBtn();   // ★ 요청1: 새로 밟은 칸의 피드백이 즉시 보이도록 팝업/뱃지 갱신(열려 있으면 목록도 재계산)
  //   자원/미니이벤트 씬이 뜨면 아래서 early-return 하는데, 그전엔 패널이 '이전 위치' 화살표를 그대로 들고 있어
  //   눌러도 새 위치에선 인접칸이 아니라 advCanEnter가 막아 무반응이었음 → 지금은 새 위치 화살표라 스킵(이동)됨.
  // ★ 이벤트 디스패치 — 처음 밟는 칸만 발동(밟은 칸은 해소)
  const band=cell.band;
  if(cell.kind==='goal'){ advCloseMapView(); advOpenGoal(); return; }
  if(cell.kind==='camp'){ advCloseMapView(); const _cp=m.camps.find(c=>c.x===x&&c.y===y);
    if(advMatesAlreadyAtCamp(_cp)){ advOpenCamp(_cp); return; }   // ★ 전원이 이미 이 캠프에 있으면 집결 레디 생략
    advPartyGate('stage_camp_'+((_cp&&_cp.name)||'?'), ()=>advOpenCamp(_cp), _cp?{x:_cp.x,y:_cp.y}:null); return; }
  if(cell.kind==='storybldg'){
    const sbd=m.buildings[cell.bldg];
    const bossPending = sbd && sbd.band===2 && !(ADV.inv.labkey>0);   // 보스 미격파면 후퇴해도 재도전 가능
    const storyPending = ADV.story && ADV.story.bldg===cell.bldg;     // 진행 중 스토리 씬이면 재개
    // ★ 버그: 건물도 밟는 즉시 stepped라, 씬을 안 끝내고 나갔다 오면 이벤트가 사라졌다.
    //   실제 완료 여부는 ADV.map.storyDone이 들고 있으니 그걸 기준으로 삼는다.
    //   (보스 건물은 storyDone을 안 쓰므로 예전대로 labkey 보유로 판단 — 안 그러면 클리어 후 무리전이 재발동한다.)
    const storyDone = (ADV.map.storyDone||[]).includes(cell.bldg);
    const reenter = (sbd && sbd.band===2) ? bossPending : !storyDone;
    if(wasNew || storyPending || reenter){ advCloseMapView(); const _bi=cell.bldg; advPartyGate('stage_bldg_'+_bi, ()=>advOpenStoryStub(_bi)); return; }
  }
  // ★ 버그수정: 후퇴한 적이 남아 있는 칸은 '이미 밟은 칸'이어도 다시 교전이 붙어야 한다.
  //   예전엔 전투 칸에 처음 들어선 순간 stepped에 기록돼서(wasNew=false) 되돌아와도 아무 일이 없었고,
  //   ADV.map.wounded에 적어둔 남은 HP가 영영 쓰이지 않았다(= 후퇴하면 적이 사라진 것처럼 보임).
  const woundPending = !!(ADV.map.wounded && ADV.map.wounded[key]);
  if((wasNew || woundPending) && cell.kind==='combat'){
    advCloseMapView();
    const cellKey=x+','+y, cn=PARTY.combatNode;
    if(advIsParty() && partyCount()>1 && cn && cn.active!==false && cn.field && cn.cell===cellKey && cn.initiator!==myUid() && typeof cn.ehp==='number' && cn.ehp>0){
      advOfferCombatJoin(cn, cellKey); return;   // ★ #3: 팀원이 이 칸에서 교전 중 → 끼어들기/관전/후퇴
    }
    ADV._fieldCell = (advIsParty() && partyCount()>1 && advHostCombat()) ? cellKey : null;   // ★ #3: 파티면 공유 슬롯에 게시(합류 가능)
    advStartCombat(band); ADV._fieldCell=null; return;
  }
  if(wasNew && isEvent){
    advCloseMapView();
    if(cell.kind==='resource'){ advOpenResourceScene(band); return; }
    if(cell.kind==='minievent'){ advOpenMiniEvent(band); return; }
  }
  if(!wasNew && cell.kind==='minievent'){   // ★ 완료한 서사 이벤트 자리 재방문 → 과거 흔적 스크립트
    const after=advMiniEventAftermath(x,y);
    if(after){ advCloseMapView(); advPrompt(after, []); return; }   // 이동은 우측 패널(#2)
  }
  _advMoveFlavor=advMoveFlavor();   // 이동할 때마다 새 상황 문구
  advShowExplorePrompt(false);      // 가운데 스크립트 + 우측 이동 패널 갱신
}

function advToggleMap(){
  const v=document.getElementById('advMapView');
  if(!v) return;
  const wasMove = v.dataset.mode==='move';
  const open = getComputedStyle(v).display==='none' || wasMove;
  v.dataset.mode='map';
  v.style.display = open?'block':'none';
  if(open){
    if(advIsParty() && partyCount()>1){ try{ advSubscribeCoords(); }catch(_){} advFetchMates(); }   // ★ #5: 지도를 열 때마다 동료 위치 자동 새로고침(advFetchMates가 내부에서 advRenderMap 호출)
    else advRenderMap();
  }
  else if(_advMapBlinkT){ clearInterval(_advMapBlinkT); _advMapBlinkT=null; }
}
/* ★ #1: 깃발 공유 — 내 멤버 노드에 좌표를 실어 보내고(advUpdateMember), 팀원은 파티 감시로 받는다.
   표시 규칙: 내가 찍은 깃발이 있으면 그것, 없으면 팀장이 찍은 깃발을 목표로 본다. */
function advPublishFlag(){
  if(!(advIsParty() && fbReady() && PARTY.pid && firebaseAPI.advUpdateMember)) return;
  const f=(ADV.map&&ADV.map.flag)||null;
  try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), f? {flagX:f.x, flagY:f.y} : {flagX:null, flagY:null}); }catch(_){}
}
function advPartyFlag(){   // 팀장이 찍은 깃발(내 것이 없을 때 사용)
  const d=PARTY.data; if(!advIsParty() || !d || !d.members || !d.leader) return null;
  const lm=d.members[d.leader]; if(!lm || typeof lm.flagX!=='number' || typeof lm.flagY!=='number') return null;
  if(d.leader===myUid()) return null;
  return {x:lm.flagX, y:lm.flagY, byLeader:true};
}
function advActiveFlag(){   // 화면에 표시할 목표 = 내 깃발 우선, 없으면 팀장 깃발
  const mine=(ADV.map&&ADV.map.flag)||null;
  return mine ? {x:mine.x, y:mine.y, mine:true} : advPartyFlag();
}
/* ─── #4-B 목표 깃발 내비: 지도 우클릭으로 깃발 지정 → 이동패널에 목표 배너 + 하단우측 방향 점(guidance-only, 자동이동 없음) ─── */
function advSetFlag(x,y){
  if(!ADV.map) return;
  const cur=ADV.map.flag;
  if(cur && cur.x===x && cur.y===y){ ADV.map.flag=null; if(typeof toast==='function') toast('🚩 목표 깃발 해제'); }
  else { ADV.map.flag={x:x,y:y}; if(typeof toast==='function') toast('🚩 목표 깃발 → '+x+','+y); }
  advPublishFlag();   // ★ #1: 파티원에게 공유(안 하면 나만 보임)
  advSave();
  if(document.getElementById('advMapView')) advRenderMap();
  if(document.getElementById('advMovePanel')) advRenderMoveNav();
}
function advClearFlag(){
  if(ADV.map) ADV.map.flag=null; advPublishFlag(); advSave();
  if(document.getElementById('advMovePanel')) advRenderMoveNav();
  const v=document.getElementById('advMapView'); if(v && getComputedStyle(v).display!=='none' && v.dataset.mode==='map') advRenderMap();
}
function advMapVisibleBldgs(m){
  // 발견된 건물(저장) + 현재 위치에서 ADV_BLDG_SPOT 이내 건물 (전체 footprint 공개)
  const found=new Set(ADV.map.found||[]);
  const p=ADV.map.pos;
  m.buildings.forEach((bd,bi)=>{
    if(found.has(bi)) return;
    for(let y=bd.y;y<bd.y+bd.h;y++)for(let x=bd.x;x<bd.x+bd.w;x++){
      if(Math.abs(x-p.x)<=ADV_BLDG_SPOT && Math.abs(y-p.y)<=ADV_BLDG_SPOT){
        found.add(bi);
        ADV.map.found=Array.from(found); advSave();
        if(typeof toast==='function') toast('🔭 저 멀리 '+bd.t+'이(가) 보인다…');
        return;
      }
    }
  });
  return found;
}
function advRenderMap(){
  const v=document.getElementById('advMapView'); if(!v) return;
  const m=advEnsureMap();
  const _afMap=advActiveFlag();   // ★ #1: 표시할 목표 깃발(내 것 우선, 없으면 팀장) — 루프 밖 1회 계산
  const p=ADV.map.pos;
  const stepped=new Set(ADV.map.stepped||[]);
  const seen=new Set(ADV.map.seen||[]);
  const found=advMapVisibleBldgs(m);
  const campAt={}; m.camps.forEach(c=>campAt[c.x+','+c.y]=c.name);
  // D#1 동료 마커: 마지막 새로고침 스냅샷(ADV._mates)만 표시(실시간 아님)
  const mateAt={};
  if(advIsParty() && partyCount()>1){ (ADV._mates||[]).forEach(mt=>{ (mateAt[mt.x+','+mt.y]=mateAt[mt.x+','+mt.y]||[]).push(mt); }); }
  const CH={empty:['·','#565656'],combat:['×','#e84a4a'],resource:['$','#9d7ae8'],minievent:['?','#e8c84a'],start:['☆','#cccccc'],goal:['◎','#4ae87a']};
  let html='';
  html+='<div class="adv-map-themes">'+m.themes.map((k,i)=>'<span style="color:'+ADV_THEMES[k].color+'">◆'+(i+1)+'분기 '+ADV_THEMES[k].name+'</span>').join(' ')+'</div>';
  html+='<table class="adv-map-tbl">';
  for(let y=0;y<ADV_MAP_H;y++){
    html+='<tr>';
    for(let x=0;x<ADV_MAP_W;x++){
      const cell=m.grid[y][x], key=x+','+y;
      const isSeen=seen.has(key);
      let inner='', bg='#0d0d0d', edgeStyle='';
      if(p.x===x&&p.y===y){ inner='<span class="cur" style="color:#ffdd44">▼</span>'; bg='#2a2408'; }
      else if(cell.bldg!==undefined){   // ★ 건물 = 지형지물, 항상 표시(채색 균일 + 문 외곽선)
        const f=advBldgFill(m,cell.bldg,x,y); inner=f.inner; bg=f.bg; edgeStyle=advDoorBorderStyle(f.edge);
      }
      else if(cell.kind==='camp'){ inner='<span style="color:#4a9de8">'+{A:'Ⓐ',B:'Ⓑ',C:'Ⓒ'}[campAt[key]]+'</span>'; }
      else if(cell.kind==='goal'){ inner='<span style="color:#4ae87a">◎</span>'; }
      else if(cell.kind==='start'){ inner='<span style="color:#cccccc">☆</span>'; }
      else if(cell.kind==='combat'||cell.kind==='resource'||cell.kind==='minievent'){
        const near = Math.abs(x-p.x)<=2 && Math.abs(y-p.y)<=2;   // 이벤트 마커는 현재 위치 25칸(±2)만
        if(stepped.has(key)){ inner='<span style="color:#3a3a3a">·</span>'; bg='#101010'; }   // ★ 처리 완료 → 빈 곳으로
        else if(near){ const ci=CH[cell.kind]; inner='<span style="color:'+ci[1]+'">'+ci[0]+'</span>'; bg='#111'; }
        else if(isSeen){ inner='<span style="color:#565656">·</span>'; bg='#141414'; }   // 탐색했지만 이벤트는 근처만 표시
        else { inner=''; bg='#0d0d0d'; }   // 미확인
      }
      else { // 벌판
        if(isSeen){ inner='<span style="color:#565656">·</span>'; bg='#141414'; }
        else { inner=''; bg='#0d0d0d'; }
      }
      const be=(x===10||x===20)?' adv-map-bandedge':'';
      let mateAttr='', mateCls='';
      const mates=mateAt[key];
      if(mates && mates.length){
        mateCls=' adv-mate-cell';
        mateAttr=' data-mate="'+esc(mates.map(mt=>mt.name).join(', '))+'"';
        if(!(p.x===x&&p.y===y)){   // 내 칸이 아니면 동료 마커로 표시
          inner='<span style="color:'+mates[0].color+';font-weight:bold">●</span>'
            +(mates.length>1?'<sub style="color:#fff;font-size:8px">'+mates.length+'</sub>':'');
          bg='#1a1a12';
        }
      }
      const isFlag = _afMap && _afMap.x===x && _afMap.y===y;
      if(isFlag) inner='<span class="adv-map-flag">🚩</span>'+inner;
      html+='<td class="adv-map-td'+be+mateCls+(isFlag?' adv-flag-cell':'')+'" data-x="'+x+'" data-y="'+y+'"'+mateAttr+' style="background:'+bg+';'+edgeStyle+'">'+inner+'</td>';
    }
    html+='</tr>';
  }
  html+='</table>';
  html+='<div class="adv-map-foot"><span style="color:#ffdd44">▼</span>현재 <span style="color:#e84a4a">×</span>전투 <span style="color:#9d7ae8">$</span>자원 <span style="color:#ffd83d">★</span>스토리 <span style="color:#4a9de8">ⒶⒷⒸ</span>캠프 <span style="color:#4ae87a">◎</span>목표 <span style="color:#ff8f4a">🚩</span>깃발<span style="color:#666">(우클릭)</span><button class="adv-map-close" type="button" id="advMapClose" title="닫기">✕ 닫기</button></div>';
  // D#1 동료 위치 범례 + 새로고침(파티 2인+ 에서만)
  if(advIsParty() && partyCount()>1){
    const mates=ADV._mates||[];
    let mf;
    if(mates.length){
      const ago=ADV._matesTs?Math.max(0,Math.round((Date.now()-ADV._matesTs)/1000)):0;
      const same=mates.filter(mt=>mt.x===p.x&&mt.y===p.y).length;
      mf='<span>동료: '+mates.map(mt=>'<span style="color:'+mt.color+'">●</span>'+esc(mt.name)+' ('+mt.x+','+mt.y+')'+((mt.x===p.x&&mt.y===p.y)?' 같은 칸':'')).join('  ')+' <span style="color:#666">· '+ago+'초 전</span></span>';
    } else {
      mf='<span style="color:#888">🔄 새로고침을 눌러 동료 위치를 표시</span>';
    }
    html+='<div class="adv-map-foot">'+mf+'<button class="adv-map-refresh" type="button" id="advMapRefresh" title="동료 위치 새로고침">🔄 새로고침</button></div>';
  }
  v.innerHTML=html;
  if(!v._advFlagDeleg){   // ★ #4-B: 지도 우클릭 = 목표 깃발 지정/해제(위임, 1회 바인딩)
    v._advFlagDeleg=true;
    v.addEventListener('contextmenu', ev=>{
      const td=(ev.target&&ev.target.closest)?ev.target.closest('td.adv-map-td'):null;
      if(!td||!v.contains(td)) return;
      ev.preventDefault();
      const fx=parseInt(td.dataset.x,10), fy=parseInt(td.dataset.y,10);
      if(!isNaN(fx)&&!isNaN(fy)) advSetFlag(fx,fy);
    });
  }
  const mc=document.getElementById('advMapClose');
  if(mc) mc.onclick=advToggleMap;
  const mr=document.getElementById('advMapRefresh');
  if(mr) mr.onclick=advFetchMates;
  // 동료 마커 호버 → 이름표(플로팅). overflow:auto 컨테이너라 CSS ::after 대신 JS로 안전 표시.
  let tip=document.getElementById('advMapTip');
  if(!tip){ tip=document.createElement('div'); tip.id='advMapTip'; v.appendChild(tip); }
  v.querySelectorAll('td.adv-mate-cell').forEach(td=>{
    td.addEventListener('mouseenter', ()=>{
      tip.textContent=td.getAttribute('data-mate')||'';
      const r=td.getBoundingClientRect(), vr=v.getBoundingClientRect();
      tip.style.left=(r.left-vr.left+v.scrollLeft+r.width/2)+'px';
      tip.style.top =(r.top -vr.top +v.scrollTop -2)+'px';
      tip.classList.add('on');
    });
    td.addEventListener('mouseleave', ()=>tip.classList.remove('on'));
  });
  if(_advMapBlinkT) clearInterval(_advMapBlinkT);
  let flip=false;
  _advMapBlinkT=setInterval(()=>{
    const el=v.querySelector('.cur');
    if(!el){ clearInterval(_advMapBlinkT); _advMapBlinkT=null; return; }   // 뷰 닫힘/재렌더 시 자가 정리
    flip=!flip; el.textContent=flip?'▽':'▼';
  },500);
}

function setFaceEl(el, slot, emojiClass, url){
  if(!el) return;
  const u = (url!==undefined) ? url : slotFaceUrl(slot, 'a');   // 기본은 a
  if(u) el.innerHTML='<img src="'+u+'" alt="">';
  else el.innerHTML='<span class="'+(emojiClass||'')+'">'+(slot.face||'🧑‍🚒')+'</span>';
}

// 소모품 사용 — 세션 아이템 목록에서 클릭. (무기는 캐릭터세팅에서 장착)
function advUseItem(id){
  const it=ADV_WORLD.items[id]; if(!it) return;
  if(id==='medkit'){ advVaxExtract(); return; }   // D#9
  if(id==='vaccine'){ advVaxGive(); return; }      // D#9
  if(!it.use){
    if(it.weapon){   // ★ #4 구제: 예전 세이브에서 inv에 들어가 버린 무기 → 무기 풀로 이관 후 바로 장착
      if(ADV.inv[id]>0){ ADV.inv[id]--; if(ADV.inv[id]<=0) delete ADV.inv[id];
        ADV.weapons.push({ id, dur: it.maxDur||1 }); advSave(); advEquipWeaponById(id); return; }
    }
    advToast('지금은 쓸 수 없어요'); return;
  }
  if(!ADV.inv[id] || ADV.inv[id]<=0) return;
  ADV.inv[id]--;
  if(it.use.hp) ADV.hp=Math.min(100, ADV.hp+it.use.hp);
  if(it.use.st) ADV.st=Math.min(100, ADV.st+it.use.st);
  advToast(it.name+' 사용!');
  advSave(); advRenderSim();
}
/* ─── D#9 간이 백신 (파티 키퍼=방장 전용) ─── */
function advVaxExtract(){
  if(!advIsParty() || partyCount()<=1){ advToast('백신은 파티에서만 만들 수 있어요'); return; }
  if(!iAmLeader()){ advToast('항체 보유자(키퍼)만 백신을 만들 수 있어요'); return; }
  if(!ADV.inv.medkit || ADV.inv.medkit<=0){ advToast('백신 의료기기가 없어요'); return; }
  ADV.inv.vaccine=(ADV.inv.vaccine||0)+1;   // 기기는 재사용(소모하지 않음)
  advToast('💉 간이 백신을 추출했다.'); advSave(); advRenderSim();
}
function advVaxGive(){
  if(!advIsParty() || partyCount()<=1){ advToast('파티 전용이에요'); return; }
  if(!iAmLeader()){ advToast('키퍼만 백신을 놓을 수 있어요'); return; }
  if(!ADV.inv.vaccine || ADV.inv.vaccine<=0){ advToast('백신이 없어요'); return; }
  const doGive=()=> advPickTeammate('백신 전달', (uid,m)=>{
    ADV.inv.vaccine--; ADV.hp=Math.max(1, ADV.hp-20);
    if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, uid, {vaxTs:Date.now(), vaxFrom:myNick()}); }catch(_){} }
    advToast('💉 '+(m.charName||m.nick||'동료')+'에게 백신을 놓았다. (내 HP −20)');
    advSave(); advRenderSim(); advRouteOnOpen();
  });
  if(ADV.hp<20){ advPrompt('<p class="bad">HP가 낮습니다('+ADV.hp+'). 백신을 놓으면 HP가 −20 됩니다. 진행할까요?</p>',
    [ {label:'✔ 진행', cls:'adv-reveal', on:doGive}, {label:'↩ 취소', on:()=>advRouteOnOpen()} ]); }
  else doGive();
}
/* ─── D#10 유품 전달 (파티) ─── */
function advKeepTransfer(){
  const s=activeSlot();
  if(!advIsParty() || partyCount()<=1){ advToast('파티에서만 유품을 전달할 수 있어요'); return; }
  if(!s.keepsake){ advToast('전달할 유품이 없어요'); return; }
  advPickTeammate('유품 전달', (uid,m)=>{
    if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, uid,
      {giftImg:String(s.keepsake).slice(0,4000), giftDesc:String(s.keepsakeDesc||'').slice(0,140), giftFrom:myNick(), giftTs:Date.now()}); }catch(_){} }
    advToast('🎗 '+(m.charName||m.nick||'동료')+'에게 유품을 전했다.');
    advRouteOnOpen();
  });
}
// 파티원 선택 프롬프트 (나 제외)
function advPickTeammate(title, onPick){
  const M=partyMembers(), ids=Object.keys(M).filter(u=>u!==myUid());
  if(!ids.length){ advToast('전달할 동료가 없어요'); return; }
  const btns=ids.map(uid=>{ const m=M[uid]; return {label:'👤 '+esc(m.charName||m.nick||'?'), cls:'adv-reveal', on:()=>onPick(uid, m)}; });
  btns.push({label:'↩ 취소', on:()=>advRouteOnOpen()});
  advPrompt('<p><span class="loc">['+esc(title)+']</span></p><p class="sys">전달할 동료를 선택하세요.</p>', btns);
}
// 🧟 처치 누적 훅 — 전투 차수에서 호출. 슬롯 영구 누적(B) + 타이틀 해금 알림.
function advAddKill(n){
  const s=activeSlot(); if(!s) return '';
  s.kills=(s.kills||0)+(n||1);
  ADV.runKills=(ADV.runKills||0)+(n||1);   // 세션 전용(보고서용) — 슬롯 누적과 별도
  const note=advCheckTitleUnlock(s,'kills');
  advSave();
  return note;   // 해금 알림 HTML(있으면 씬 로그에 붙여 표시)
}
/* ★ 요청3: 아이템에 마우스를 올리면 설명 툴팁. (기존 title= 기본 툴팁은 느리고 서식이 없다)
   .adv-items가 overflow로 잘라내므로 툴팁은 #advTip(패널 바깥)에 띄우고 좌표만 계산한다. */
function advItemEffect(it){
  if(it.use){ const p=[]; if(it.use.hp) p.push('체력 '+it.use.hp+' 회복'); if(it.use.st) p.push('기력 '+it.use.st+' 회복');
    if(it.use.inf) p.push('감염 '+it.use.inf+' 감소'); if(p.length) return '사용 시 '+p.join(' · '); }
  if(it.weapon) return '공격력 +'+it.weapon+' · 내구도 '+(it.maxDur||1);
  if(it.armor)  return '방어력 +'+advArmorValue(it.armor);
  return it.desc||'';   // 효과가 없는 물건(열쇠·재료)만 설명으로 대체
}
/* ★ 툴팁은 이름 + 효과 한 줄만. (설명이 효과와 중복되고, 조작 힌트 줄은 회색 띠처럼 보여서 걷어냈다) */
function advItemTipHtml(id, opt){
  const it=ADV_WORLD.items[id]; if(!it) return '';
  opt=opt||{};
  const eff=advItemEffect(it);
  let h='<b>'+(it.icon||'📦')+' '+esc(it.name||id)+'</b>';
  if(eff) h+='<span class="eff">'+esc(eff)+'</span>';
  if(opt.dur!=null) h+='<span class="dur">남은 내구도 '+opt.dur+'%</span>';
  return h;
}
function advShowTip(anchor, html){
  const tip=document.getElementById('advTip'); if(!tip||!html) return;
  const root=tip.parentNode; if(!root) return;
  tip.innerHTML=html; tip.classList.add('on');
  const a=anchor.getBoundingClientRect(), r=root.getBoundingClientRect(), t=tip.getBoundingClientRect();
  let left=a.right-r.left+8, top=a.top-r.top-4;
  if(left+t.width > r.width-4) left=Math.max(4, a.left-r.left-t.width-8);   // 오른쪽이 좁으면 왼쪽으로
  if(top+t.height > r.height-4) top=Math.max(4, r.height-t.height-4);
  tip.style.left=left+'px'; tip.style.top=top+'px';
}
function advHideTip(){ const tip=document.getElementById('advTip'); if(tip){ tip.classList.remove('on'); tip.innerHTML=''; } }
function advRenderItems(){
  const box=document.getElementById('advSimItems'); if(!box) return;
  const inv=ADV.inv||{}; const ids=Object.keys(inv).filter(k=>inv[k]>0);
  const s=activeSlot(); const eq=s&&s.weapon;
  const wCount={}; (ADV.weapons||[]).forEach(w=>{ wCount[w.id]=(wCount[w.id]||0)+1; });
  const wIds=Object.keys(wCount);
  if(!ids.length && !wIds.length && !eq){ const eh='<div class="adv-items-empty">획득한 아이템 없음</div>'; if(box._advLastHtml!==eh){ box.innerHTML=eh; box._advLastHtml=eh; } return; }
  let html='<div class="adv-items-hint">더블클릭 사용/장착 · 우클릭 전달</div>';
  // 장착 중 무기 (활성 슬롯)
  if(eq){ const it=ADV_WORLD.items[eq.id];
    html+='<div class="adv-item eqp" data-w="'+eq.id+'" data-eq="1" data-tip="'+esc(advItemTipHtml(eq.id,{dur:weaponDurPct(eq)}))+'">'
      +(it?it.icon:'🗡')+' '+esc(it?it.name:eq.id)+' <span style="color:#c9a83a">⭐장착중 '+weaponDurPct(eq)+'%</span></div>'; }
  // 미장착 무기 풀
  wIds.forEach(id=>{ const it=ADV_WORLD.items[id]; if(!it) return;
    const best=Math.max(...ADV.weapons.filter(w=>w.id===id).map(w=>weaponDurPct(w)));
    html+='<div class="adv-item" data-w="'+id+'" data-tip="'+esc(advItemTipHtml(id,{dur:best}))+'">'
      +it.icon+' '+esc(it.name)+' ×'+wCount[id]+'<span style="color:#3a5a3a"> · '+best+'%</span></div>'; });
  // 소모품
  html+=ids.map(id=>{ const it=ADV_WORLD.items[id]; if(!it) return '';
    return '<div class="adv-item" data-item="'+id+'" data-tip="'+esc(advItemTipHtml(id))+'">'
      +(it.icon||'📦')+' '+esc(it.name||id)+' ×'+inv[id]+'</div>'; }).join('');
  // ★ #5 수정: 파티 콜백(advRenderSim)이 매 좌표 갱신마다 재렌더 → innerHTML 교체가 더블클릭 두 클릭 사이에 끼면
  //   노드가 교체돼 브라우저가 더블클릭을 인식 못함(솔로는 재렌더 적어 티 안 남).
  //   (1) 내용 동일하면 DOM 교체 안 함 → 노드 안정 → 더블클릭 성립  (2) 리스너는 안정 부모(box)에 위임 바인딩(1회).
  if(box._advLastHtml!==html){ box.innerHTML=html; box._advLastHtml=html; }
  if(!box._advDelegBound){
    box._advDelegBound=true;
    const itemAt=ev=>{ const t=ev.target; const el=(t&&t.closest)?t.closest('.adv-item'):null; return (el&&box.contains(el))?el:null; };
    box.addEventListener('dblclick',ev=>{
      const el=itemAt(ev); if(!el) return;
      const cid=el.getAttribute('data-item'), wid=el.getAttribute('data-w'), isEq=el.getAttribute('data-eq');
      if(cid){ if(typeof advUseItem==='function') advUseItem(cid); }
      else if(wid){ if(isEq) advUnequipSlot(ADV.active); else advEquipWeaponById(wid); }
    });
    box.addEventListener('mouseover',ev=>{   // ★ 툴팁 — 위임이라 재렌더에도 살아있다
      const el=itemAt(ev); if(!el){ advHideTip(); return; }
      advShowTip(el, el.getAttribute('data-tip')||'');
    });
    box.addEventListener('mouseleave', advHideTip);
    box.addEventListener('scroll', advHideTip);
    box.addEventListener('contextmenu',ev=>{
      const el=itemAt(ev); if(!el) return; ev.preventDefault();
      const cid=el.getAttribute('data-item'), wid=el.getAttribute('data-w'), isEq=el.getAttribute('data-eq');
      if(cid) advItemTransfer(cid,'c');
      else if(wid && !isEq) advItemTransfer(wid,'w');
      else if(isEq) advToast('장착 중인 무기는 해제(더블클릭) 후 전달할 수 있어요');
    });
  }
}
// 🗡 세션에서 바로 장착 — 해당 종류 중 내구도 높은 개체를 활성 캐릭터에 (기존 장착품은 목록으로 반납)
function advEquipWeaponById(id){
  const s=activeSlot(); if(!s) return;
  const arr=ADV.weapons.map((w,i)=>({w,i})).filter(x=>x.w.id===id);
  if(!arr.length){ advToast('장착할 무기가 없어요'); return; }
  arr.sort((a,b)=>weaponDurPct(b.w)-weaponDurPct(a.w));
  const pick=arr[0]; ADV.weapons.splice(pick.i,1);
  if(s.weapon) ADV.weapons.push(s.weapon);   // 착용하던 무기 → 아이템 목록으로 복귀(내구도 유지)
  s.weapon=pick.w;
  advSave(); advRenderSim();
  const it=ADV_WORLD.items[id]; advToast((it?it.name:'무기')+' 장착!');
}
// 📦 아이템/무기 팀원에게 전달 — 유품 전달과 같은 멤버 inbox 방식
function advItemTransfer(id, kind){
  if(!advIsParty() || partyCount()<=1){ advToast('파티에서만 전달할 수 있어요'); return; }
  if(typeof ADV_COMBAT!=='undefined' && ADV_COMBAT){ advToast('전투 중엔 전달할 수 없어요'); return; }
  if((ADV.story&&ADV.story.beat) || ADV._gate || ADV._spectate!=null){ advToast('이야기 진행 중엔 전달할 수 없어요'); return; }
  const it=ADV_WORLD.items[id]; if(!it) return;
  if(kind==='c' && (!ADV.inv[id]||ADV.inv[id]<=0)) return;
  if(kind==='w' && !ADV.weapons.some(w=>w.id===id)) return;
  advPickTeammate(it.name+' 전달', (uid,m)=>{
    let dur=0;
    if(kind==='c'){ if(!ADV.inv[id]||ADV.inv[id]<=0) return; ADV.inv[id]--; }
    else{ const arr=ADV.weapons.map((w,i)=>({w,i})).filter(x=>x.w.id===id);
      if(!arr.length) return;
      arr.sort((a,b)=>weaponDurPct(b.w)-weaponDurPct(a.w));
      dur=arr[0].w.dur; ADV.weapons.splice(arr[0].i,1); }
    if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, uid,
      {itemGiftId:id, itemGiftKind:kind, itemGiftDur:dur, itemGiftFrom:myNick(), itemGiftTs:Date.now()}); }catch(_){} }
    advSave(); advRenderSim();
    advToast('📦 '+(m.charName||m.nick||'동료')+'에게 '+it.name+'을(를) 보냈다.');
    advRouteOnOpen();
  });
}
function advRenderSim(){
  advRefreshStamina();
  const el=id=>document.getElementById(id);
  const s=activeSlot();
  { const _fk=faceStateKey(); const _fe=el('advSimFace');
    setFaceEl(_fe, s, '', slotFaceUrl(s,_fk));
    if(_fe) _fe.classList.toggle('adv-dead', ADV.hp<=0); }   // ★ 사망 시 흑백
  advRenderItems();
  { const ki=el('advKeepIcon');   // 🎗 유품 아이콘 (지도 옆) — 마우스오버 = 설명 · 우클릭 = 동료에게 전달
    if(ki){ if(s.keepsake){ ki.style.display='inline-flex'; ki.innerHTML='<img src="'+s.keepsake+'" alt="유품" title="'+esc((s.keepsakeDesc||'유품')+(advIsParty()&&partyCount()>1?' · 우클릭: 동료에게 전달':''))+'">'; }
      else { ki.style.display='none'; ki.innerHTML=''; } }
    const rk=el('advRecvKeeps');   // D#10 받은 유품
    if(rk){ const list=ADV.recvKeeps||[];
      rk.innerHTML=list.map(k=>'<span class="adv-recv-keep" title="'+esc('🎗 원소유자: '+k.from+(k.desc?(' · '+k.desc):''))+'"><img src="'+esc(k.img)+'" alt="유품"></span>').join(''); } }
  if(el('advSimName')){
    const tt=slotTitleName(s);
    el('advSimName').innerHTML=(tt?'<span class="adv-title">'+esc(tt)+'</span> ':'')+esc(s.name||defaultName())+(s.age?(' ('+esc(s.age)+')'):'');
  }
  if(el('advSimAge')) el('advSimAge').textContent='';
  if(el('advSimLv')) el('advSimLv').textContent='집중 Lv.'+advFocusLevel();
  const hp=Math.round(ADV.hp), st=Math.round(ADV.st), inf=Math.round(ADV.inf);
  if(el('advHpFill')) el('advHpFill').style.width=hp+'%';
  if(el('advHpNum'))  el('advHpNum').textContent=hp+'/100';
  if(el('advStFill')) el('advStFill').style.width=st+'%';
  if(el('advStNum'))  el('advStNum').textContent=st+'/100';
  if(el('advInfFill')) el('advInfFill').style.width=inf+'%';
  if(el('advInfNum'))  el('advInfNum').textContent=inf+'%';
  if(el('advAtk')){
    const wb=slotWeaponBonus(s);
    el('advAtk').innerHTML=statAtk(s)+(wb?' <small style="color:#9a9">(무기 +'+wb+')</small>':'')+' <small style="color:#c9a0e0">(crit '+critChance(s)+'%)</small>';
  }
  if(el('advDef')) el('advDef').textContent = ADV.armorItem ? ('🛡 '+ADV.armor+' ('+ADV_WORLD.items[ADV.armorItem].name+')') : statDef(s);
  if(el('advWeapon')){
    const w=s.weapon;
    if(w){
      const it=ADV_WORLD.items[w.id]; const pct=weaponDurPct(w);
      el('advWeapon').innerHTML=(it?it.icon+' '+it.name:'무기')+' <small style="color:'+(pct<=30?'#e37f7f':'#9a9')+'">('+pct+'%)</small>';
    } else el('advWeapon').textContent='맨손';
  }
  if(el('advStatus')) el('advStatus').textContent=statusText();
  advRenderBody();   // ★ 몸 상태 문구
  const pm=el('advPartyMates');
  if(pm){
    advRenderPartyBar();
  }
  if(document.getElementById('advMovePanel')) advRenderMoveNav();   // 우측 이동 패널 동기화(전투 중 비활성 등)
  if(document.getElementById('advChatPanel')) advUpdateChatPanel(); // 하단 채팅 패널 동기화(파티/솔로)
  advUpdateFeedbackBtn();   // ★ 요청1: 피드백 버튼 표시/뱃지 동기화(파티에서만 노출)
}

// 하단 파티 바: "구성원: 나(캐릭), 친구A(캐릭)…" + 상황별 버튼
function advRenderPartyBar(){
  const pm=document.getElementById('advPartyMates');
  const btns=document.getElementById('advPartyBtns');
  if(!pm||!btns) return;
  const M=partyMembers();
  const uids=Object.keys(M);
  if(!PARTY.pid || uids.length<=1){
    const s=activeSlot();
    pm.innerHTML='구성원: 나('+esc(s.name||defaultName())+')';
  }else{
    pm.innerHTML='구성원: ';
    uids.forEach((uid,idx)=>{
      const m=M[uid];
      const isMe=(uid===myUid());
      const tag=h('<span class="mate'+(isMe?' me':'')+'">'+esc(isMe?'나':m.nick)+'('+esc(m.charName)+')'+(uid===(PARTY.data&&PARTY.data.leader)?'👑':'')+'</span>');
      if(!isMe) tag.addEventListener('click', ()=>advShowMemberInfo(uid, m));
      pm.appendChild(tag);
      if(idx<uids.length-1) pm.appendChild(document.createTextNode(', '));
    });
  }
  // 버튼 구성
  btns.innerHTML='';
  const cnt=partyCount();
  // (친구 초대 제거 — 파티는 코드로만 결성)
  // (🚪 나가기 버튼 제거 — 파티 이탈은 캠프 선택지에서만 (#5))
  if(PARTY.pid && !iAmLeader() && !PARTY.started){
    const leave=h('<button type="button" class="adv-pbtn">🚪 나가기</button>');   // 대기실에서만: 파티 나가기
    leave.addEventListener('click', advLeaveMyParty);
    btns.appendChild(leave);
  }
}
// 🆘 갇힘 해제 — 옛 저장 상태/홀로 남은 파티로 이동이 막혔을 때 스스로 복구 (콘솔 대체)
function advEmergencyReset(){
  advPrompt('<p class="bad">🆘 세션 종료</p>'
    +'<p>세션이 그대로 종료되고 로비로 돌아갑니다.</p>'
    +'<p class="sys">이 세션에서 잡은 좀비와 쓴 기력은 시작 전으로 되돌아가요. 캐릭터·레벨·칭호·유품은 유지됩니다.</p>',
    [ {label:'돌아간다.', cls:'adv-reveal', on:advDoEmergencyReset},
      {label:'취소', on:()=>advRouteOnOpen()} ]);
}
function advDoEmergencyReset(){
  // ↩ 이 세션 되돌리기: 잡은 좀비(슬롯 누적)·쓴 기력을 시작 전으로 원복
  try{ const s=activeSlot();
    if(s && ADV.runKills) s.kills=Math.max(0, (s.kills||0) - ADV.runKills);
  }catch(_){}
  if(typeof ADV.runStartSt==='number') ADV.st=Math.max(0, Math.min(100, ADV.runStartSt));
  ADV.runKills=0; ADV.runOutlaws=0; ADV.runStartSt=null;
  try{ const pid=PARTY.pid||ADV.partyPid;
    if(pid && window.firebaseAPI){
      try{ firebaseAPI.advLeaveParty && firebaseAPI.advLeaveParty(pid, myUid()); }catch(_){}
      try{ firebaseAPI.advDisbandParty && firebaseAPI.advDisbandParty(pid); }catch(_){}   // 홀로 남은 방 정리(둘 다 시도해도 무해)
    }
  }catch(_){}
  try{ advTeardownParty(); }catch(_){}   // 협동 구독 정리
  advClearPhaseTimer(); ADV_COMBAT=null; ADV.story=null; ADV._gate=null; ADV.scene='';
  ADV.map=null; _advMapCache=null; ADV.partyPid=null; ADV.inLobby=true; ADV.sessionMode=null; ADV.runStart=null;
  PARTY.pid=null; PARTY.data=null; PARTY.mode=null; PARTY.started=false; PARTY._leaderLocal=false; PARTY._inLobby=false;
  ADV.hp=100; ADV.inf=0; advClearSessionGear();
  advSave(); advRenderSim(); advToast('세션 종료 — 로비로 돌아왔어요'); advShowModeSelect();
}

// 구성원 클릭 → 캐릭터 정보 팝업
function advShowMemberInfo(uid, m){
  const pop=document.getElementById('advMemberPop'); if(!pop) return;
  const body=document.getElementById('advMemberBody');
  const ci=m.charInfo||{};
  const faceHtml = m.faceImg ? '<img src="'+esc(m.faceImg)+'" alt="">' : '<span class="emo">'+esc(m.face||'🧑‍🚒')+'</span>';
  body.innerHTML=
    '<div class="adv-mi-head">'+
      '<div class="adv-mi-face">'+faceHtml+'</div>'+
      '<div class="adv-mi-namebox"><div class="adv-mi-name">'+(m.title?'<span class="adv-title">'+esc(m.title)+'</span> ':'')+esc(m.charName)+(ci.age?(' ('+esc(ci.age)+')'):'')+'</div>'+
        '<div class="adv-mi-nick">'+esc(m.nick)+'</div></div>'+
    '</div>'+
    '<div class="adv-mi-row"><b>성격</b> '+esc(ci.personality||'-')+'</div>'+
    '<div class="adv-mi-row"><b>착용 무기</b> '+esc(ci.weapon||'맨손')+'</div>'+
    '<div class="adv-mi-row"><b>상태</b> '+esc(ci.status||'정상')+'</div>'+
    '<div class="adv-mi-loc">📍 현재 위치: '+esc(sceneLabel(m.location))+'</div>';
  pop.classList.add('on');
}
function sceneLabel(id){ const map={camp:'쇼핑몰 캠프', escape:'비상구', first:'골목', weapon:'철물점', shutter:'철물점 안', food:'편의점', zombie:'골목 어귀', info:'버스 정류장', arrive:'지하철역 입구', hub:'지하철역 캠프'}; return map[id]||id||'-'; }

// 캠프 허브: 생존자 무리 살펴보기 = 친구를 게임 내 만남으로 (초대/합치기)
function advShowSurvivors(){
  const term=document.getElementById('advTerm');
  if(!fbReady()){
    if(term){ term.innerHTML='<p><span class="loc">[생존자들]</span></p><p class="bad">네트워크 연결이 필요해요. (혼자라면 이곳에서 잠시 쉬어가세요)</p>'; }
    advShowHubReturn(); return;
  }
  if(term){ term.innerHTML='<p><span class="loc">[이곳의 생존자들]</span></p><p class="sys">친구 목록을 살펴보는 중…</p>'; }
  const box=document.getElementById('advChoices'); if(box) box.innerHTML='';
  firebaseAPI.advGetFriends(myUid()).then(async friends=>{
    const ids=Object.keys(friends||{});
    let body='<p><span class="loc">[이곳의 생존자들]</span></p><p>이곳엔 다른 생존자들도 흘러들어와 있다.</p>';
    if(!ids.length) body+='<p class="sys">아직 아는 얼굴이 없다. (친구 탭에서 친구를 추가해보세요)</p>';
    if(term) term.innerHTML=body;
    if(!box) return;
    box.innerHTML='';
    for(const fid of ids){
      const f=friends[fid];
      const lp=await firebaseAPI.advFindLeaderParty(fid).catch(()=>null);
      const row=h('<div class="adv-surv"><span class="dot '+(f.online?'on':'')+'"></span><span class="nm">'+esc(f.name)+'</span><span class="st"></span></div>');
      const st=row.querySelector('.st');
      if(!f.online){ st.textContent='· 오프라인'; st.classList.add('off'); }
      else if(lp && lp.pid){
        st.innerHTML='· 무리의 리더('+lp.count+')';   // 합치기 제거 — 코드 파티만 사용
      } else {
        st.innerHTML='· 혼자 떠도는 중 ';
        const b=h('<button type="button">파티 초대</button>');
        b.addEventListener('click', ()=>{
          advEnsureMyParty(()=>{
            const sl=activeSlot();
            firebaseAPI.advSendInvite(fid, myUid(), PARTY.pid, myNick(), sl.name||defaultName()).then(()=>{ advToast(esc(f.name)+'에게 초대를 보냈어요'); b.textContent='보냄'; b.disabled=true; });
          });
        });
        st.appendChild(b);
      }
      box.appendChild(row);
    }
    const back=h('<button class="adv-choice adv-reveal" type="button" style="margin-top:5px;">↩ 캠프 둘러보기로</button>');
    back.addEventListener('click', advRenderScene);
    box.appendChild(back);
  }).catch(()=>{ if(term) term.innerHTML+='<p class="bad">친구 목록을 불러오지 못했어요.</p>'; advShowHubReturn(); });
}

// 협동 선택지가 화면에 있으면 카운트만 갱신 (실시간 구독 콜백에서 호출)
function advRenderChoices2IfCoop(){
  const box=document.getElementById('advChoices');
  if(box && box.querySelector('.coop')) advRenderChoices();
}

/* ─────────────────────────── 씬/선택지 렌더 ─────────────────────────── */
function curScene(){ return ADV_WORLD.scenes[ADV.scene]||ADV_WORLD.scenes.camp; }

/* ── 특수 프롬프트: 스크립트 영역에 임시 텍스트 + 선택지 버튼 ── */
function advPrompt(html, buttons){
  ADV._onExplore=false;   // 탐색 외 화면으로 전환됨(근접 채팅 자동갱신 대상 아님)
  const term=document.getElementById('advTerm');
  if(term){ term.innerHTML=html; term.scrollTop=term.scrollHeight; }
  const box=document.getElementById('advChoices'); if(!box) return;
  box.classList.remove('has-chat');   // 탐색 채팅 확장 모드 초기화(다른 화면 오염 방지)
  box.classList.toggle('tall', (buttons||[]).length>=4);   // ★ 선택지 4개 이상이면 스크롤 대신 영역을 늘림(캠프: 휴식/거래/조합/나서기[/파티나가기])
  box.innerHTML='';
  buttons.forEach(b=>{
    // b.dis=true → 눌리지 않는 버튼(적 차례 등). 핸들러를 아예 안 붙여 연타/큐잉을 원천 차단.
    const btn=h('<button class="adv-choice'+(b.cls?(' '+b.cls):'')+(b.dis?' adv-locked':'')+'" type="button"'+(b.dis?' disabled':'')+'>'+b.label+'</button>');
    if(!b.dis && b.on) btn.addEventListener('click', b.on);
    box.appendChild(btn);
  });
}

// [파티를 결성할까? 혼자 시작할까?]
// 🌍 세계관 + 안내 (role: 'keeper'=항체보유자(솔로/방장) / 'crew'=호송 생존자(파티원, 파티차수))
// 한글 조사 헬퍼 — 받침 있으면 a(이/은/과), 없으면 b(가/는/와). 한글 아니면 병기.
function advJosa(w, a, b){
  const ch=String(w||'').trim().slice(-1).charCodeAt(0);
  if(ch>=0xAC00 && ch<=0xD7A3) return ((ch-0xAC00)%28)? a : b;
  return a+'('+b+')';
}
function advShowWorldIntro(role, onStart){
  // role: 'keeper'=항체 보유자(솔로/방장) / 'crew'=호송자(파티원)
  let html;
  if(role==='crew'){
    const kn = esc(advPartyLeaderName());
    const iga = advJosa(kn,'이','가'), eunn = advJosa(kn,'은','는'), gwa = advJosa(kn,'과','와');
    html =
      '<p><span class="loc">[ SURVIVE — 감염 도시 ]</span></p>'
      + '<p class="adv-gl">도시는 무너졌다. 감염은 걷잡을 수 없이 퍼졌고, 생존자들은 기약 없는 희망을 찾거나 '
        + '살아남는 법을 터득한 무법자가 되어 서로 얽히며 살아간다.</p>'
      + '<p>오늘도 살아남기 위해 주변을 조사하던 중 <span class="good">'+kn+'</span>'+iga+' <span class="bad">좀비에게 물린 것</span>을 목격한다.</p>'
      + '<p class="sys">이것은 희망인가, 덧없는 꿈인가?</p>'
      + '<p>며칠이 지나도 <span class="good">'+kn+'</span>'+eunn+' 여전히 인간인 채 살아있다.</p>'
      + '<p>혼란스러워하는 당신 너머로 라디오 방송이 울린다.</p>'
      + '<p class="adv-radio">’─ 우리는 살아남은 연구원들입니다. <span class="good">항체 보유자</span>를 찾고 있습니다. '
        + '미래를 되찾을 유일한 열쇠입니다. 이 방송을 듣고 있다면 <span class="adv-glx" data-txt="▲▣">▲▣</span>으로 오십시오. '
        + '다시 알려드립니다. 우리는<span class="adv-glx" data-txt="...">...</span>’</p>'
      + '<p>당신은 <span class="good">'+kn+'</span>'+gwa+' 함께 <span class="adv-glx" data-txt="▲▣">▲▣</span>까지 가기로 결심한다.</p>'
      + '<p class="bad">그가 쓰러지면 이 여정은 실패와 다를 바 없다.</p>'
      + '<p class="adv-reveal-line">당신은 ‘<span class="good">호송자</span>’다.</p>';
  } else {
    const who = '당신';
    html =
      '<p><span class="loc">[ SURVIVE — 감염 도시 ]</span></p>'
      + '<p class="adv-gl">도시는 무너졌다. 감염은 걷잡을 수 없이 퍼져갔고, 생존자들은 기약 없는 희망을 찾거나 '
        + '살아남는 법을 터득한 무법자들이 어지럽히고 얽히며 살아간다.</p>'
      + '<p>'+who+'은 살아남기 위해 발버둥 쳤으나, 결국 <span class="bad">좀비에게 물리고 말았다.</span></p>'
      + '<p>하지만 며칠이 지나도 여전히 인간인 채 살아있다. <span class="sys">이것은 축복인가, 저주인가?</span></p>'
      + '<p>혼란스러워하는 '+who+' 너머로 라디오 방송이 울린다.</p>'
      + '<p class="adv-radio">’─ 우리는 살아남은 연구원들입니다. <span class="good">항체 보유자</span>를 찾고 있습니다. '
        + '미래를 되찾을 유일한 열쇠입니다. 이 방송을 듣고 있다면 <span class="adv-glx" data-txt="▲▣">▲▣</span>으로 오십시오. '
        + '다시 알려드립니다. 우리는<span class="adv-glx" data-txt="...">...</span>’</p>'
      + '<p class="adv-reveal-line">'+who+'은 ‘<span class="good">항체 보유자</span>’다.</p>';
  }
  advPrompt(html, [ {label:'▶ 계속하기', cls:'adv-reveal', on:()=>{ if(typeof onStart==='function') onStart(); }} ]);
}
/* ───────────── 👥 투게더 파티 인트로 흐름 (파티 코드 · 역할 인트로) ───────────── */
function advStartTogether(){
  PARTY._leaderLocal=false;   // 참여 흐름에서 이전 방장 플래그 잔재 제거(파티원이 시작버튼 못 보게)
  if(!fbReady()){ advPrompt('<p><span class="loc">[ 투게더 모드 ]</span></p><p class="bad">지금은 파티에 연결할 수 없어요.</p>', [{label:'↩ 뒤로', cls:'adv-reveal', on:advShowModeSelect}]); return; }
  advPrompt('<p><span class="loc">[ 투게더 모드 ]</span></p>'
    +'<p class="sys">파티 코드로 함께 살아남는 협동 모드. (라이선스 최대 '+advPartyMax()+'인'+(advHasLicense()?'':' · 라이선스 없으면 2인')+')</p>',
    [
      {label:'🏕 파티 만들기 (방장)', cls:'adv-reveal', on:advCreatePartyRoom},
      {label:'🔑 코드로 참여하기', on:advJoinByCodePrompt},
      {label:'↩ 뒤로', on:advShowModeSelect},
    ]);
}
function advCreatePartyRoom(){
  PARTY.mode='together'; PARTY._introShown=false; PARTY._confirmShown=false; PARTY._leaderLocal=true; PARTY._checkJoin=false;
  firebaseAPI.advCreateParty(myUid(), Object.assign(myMemberPayload('lobby'), {max:advPartyMax()})).then(pid=>{
    PARTY.pid=pid; advSubscribeParty(pid); advPartyLobby();
  }).catch(()=>{ advPrompt('<p class="bad">파티를 만들지 못했어요.</p>', [{label:'↩ 뒤로', cls:'adv-reveal', on:advStartTogether}]); });
}
function advJoinByCodePrompt(){
  advPrompt('<p><span class="loc">[ 코드로 참여 ]</span></p><p class="sys">방장에게 받은 파티 코드를 입력하세요.</p>'
    +'<p><input id="advJoinCode" type="text" placeholder="파티 코드" autocomplete="off" style="width:88%;padding:5px;font-size:12px;background:#111;color:#cfe;border:1px solid #4a6a8a;border-radius:3px;"></p>',
    [
      {label:'참여하기', cls:'adv-reveal', on:()=>{ const el=document.getElementById('advJoinCode'); const code=((el&&el.value)||'').trim();
        if(!code){ advToast('코드를 입력하세요'); return; } advDoJoinByCode(code); }},
      {label:'↩ 뒤로', on:advStartTogether},
    ]);
}
function advDoJoinByCode(code){
  PARTY.mode='together'; PARTY._introShown=false; PARTY._confirmShown=false; PARTY._checkJoin=true; PARTY._leaderLocal=false;
  firebaseAPI.advJoinParty(code, myUid(), myMemberPayload('lobby'), null).then(res=>{
    if(res && res.ok===false){ PARTY._checkJoin=false; advPrompt('<p class="bad">'+esc(res.reason||'참여하지 못했어요.')+'</p>', [{label:'↩ 뒤로', cls:'adv-reveal', on:advJoinByCodePrompt}]); return; }
    PARTY.pid=code; advSubscribeParty(code);   // 대기실은 콜백에서 검증 후 표시
  }).catch(()=>{ PARTY._checkJoin=false; advPrompt('<p class="bad">코드를 확인해주세요. 참여하지 못했어요.</p>', [{label:'↩ 뒤로', cls:'adv-reveal', on:advJoinByCodePrompt}]); });
}
function advPartyJoinRejected(msg){
  try{ if(fbReady()&&PARTY.pid && firebaseAPI.advLeaveParty) firebaseAPI.advLeaveParty(PARTY.pid, myUid()); }catch(_){}
  try{ PARTY.unsubParty&&PARTY.unsubParty(); }catch(_){}
  PARTY.unsubParty=null; PARTY.pid=null; PARTY.data=null; PARTY.mode=null; PARTY._inLobby=false; PARTY._checkJoin=false;
  advPrompt('<p class="bad">'+esc(msg)+'</p>', [{label:'↩ 뒤로', cls:'adv-reveal', on:advStartTogether}]);
}
// ★ 진행 중 파티 해산(파티장 사망/엔딩) → 팀원 세션 자동 종료(버그2) — 살아있는 팀원은 실종 보고서
function advPartySessionEnded(){
  advTeardownParty();                       // 협동 구독(채팅/전투/좌표/게이지) 정리
  PARTY.pid=null; PARTY.data=null; PARTY.mode=null; PARTY.started=false; PARTY._leaderLocal=false; PARTY._inLobby=false;
  advClearPhaseTimer(); ADV_COMBAT=null; ADV.story=null; ADV._gate=null;
  ADV.partyPid=null; ADV.inLobby=true; ADV.sessionMode=null; ADV.runStart=null; advSave();
  advRenderSim();
  const reason=ADV._sessEndReason; ADV._sessEndReason=null;
  const msg = (reason==='clear')
    ? '<p class="bad">📻 …항체 보유자가 연구소에 도착해 세션이 종료되었습니다.</p><p class="sys">당신의 행방은 기록되지 않았다.</p>'
    : '<p class="bad">📻 …항체 보유자가 사망하여 세션이 종료되었습니다.</p><p class="sys">무전이 끊겼다. 당신의 행방은 기록되지 않았다.</p>';
  advPrompt(msg, [ {label:'📄 실종 보고서', cls:'adv-reveal', on:()=>advShowReport('missing')} ]);
}
function advPartyLobby(){
  PARTY._inLobby=true; PARTY._worldShown=false; PARTY._goReady=false; PARTY._confirmShown=false; PARTY._worldReading=false;   // 대기실 = 확정 전 → 인트로/시작 상태 전부 리셋(재접속·재플레이 시 스턱 방지)
  if(PARTY.pid && ADV.partyPid!==PARTY.pid){ ADV.partyPid=PARTY.pid; advSave(); }   // ★ 대기실 코드 저장(앱 재시작 복원용)
  const d=PARTY.data, code=PARTY.pid||'';
  const M=partyMembers(); const uids=Object.keys(M);
  const leader = d && d.leader;
  const max = (leader && M[leader] && M[leader].max) || advPartyMax();
  const over = uids.length>max;
  const others = uids.filter(u=>u!==leader);
  const readyN = others.filter(u=>M[u] && M[u].lready).length;
  // 명단: 👑방장 / 파티원 = 레디하면 초록, 안 하면 하양
  const roster = uids.map(uid=>{ const m=M[uid], meTag=(uid===myUid()?' (나)':'');
    const nm=esc(m.charName||'?')+'('+esc(m.nick||'?')+')';
    if(uid===leader) return '<div style="color:#ffd83d">👑 '+nm+meTag+'</div>';
    const rdy=!!m.lready;
    return '<div style="color:'+(rdy?'#5fe08a':'#ffffff')+'">'+nm+meTag+' — '+(rdy?'레디 완료 ✅':'대기 중')+'</div>';
  }).join('');
  let html='<p><span class="loc">[ 파티 대기실 ]</span></p>'
    +'<p class="sys">파티 코드 <b class="good" style="user-select:all;font-size:13px">'+esc(code)+'</b> — 친구에게 알려주세요.</p>'
    +'<p>구성원 ('+uids.length+'/'+max+')'+(others.length?' · 레디 '+readyN+'/'+others.length:'')+'</p>'
    +'<div style="margin:4px 0">'+roster+'</div>'
    +(over?'<p class="bad">정원을 초과했습니다.</p>':'');
  const amLeader = iAmLeader() || (PARTY._leaderLocal && (!d || !d.leader));
  const btns=[];
  if(amLeader){
    const allReady = others.length>0 && readyN===others.length;
    html+='<p class="sys">'+(others.length===0 ? '파티원이 들어오길 기다리는 중…' : (allReady ? '전원 레디 완료! 확정하세요.' : '파티원의 레디를 기다리는 중…'))+'</p>';
    btns.push({label:'✔ 확정하기', cls:'adv-reveal', on:advConfirmParty});
  } else {
    const iReady=!!(M[myUid()] && M[myUid()].lready);
    btns.push({label:iReady?'⬜ 레디 해제':'✅ 레디하기', cls:iReady?'':'adv-reveal', on:advLobbyReadyToggle});
    html+='<p class="sys">'+(iReady?'방장이 확정하길 기다리는 중…':'준비되면 레디하세요.')+'</p>';
  }
  btns.push({label:'🚪 나가기', on:()=>{ PARTY._inLobby=false; advLeaveMyParty(); }});
  advPrompt(html, btns);
}
// 파티원: 대기실 레디 토글
function advLobbyReadyToggle(){
  const M=partyMembers(), cur=!!(M[myUid()] && M[myUid()].lready);
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {lready:!cur}); }catch(_){} }
  advPartyLobby();
}
// 방장: 확정하기 → 전원 공유 인트로
function advConfirmParty(){
  if(!iAmLeader()){ advToast('방장만 확정할 수 있어요'); return; }
  const M=partyMembers(), leader=PARTY.data.leader, others=Object.keys(M).filter(u=>u!==leader);
  if(others.length===0){ advToast('파티원이 들어와야 시작할 수 있어요'); return; }
  if(others.some(u=>!M[u].lready)){ advToast('아직 레디하지 않은 파티원이 있어요'); return; }
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {confirmed:Date.now()}); }catch(_){} }   // 전원에게 확정 신호
  advShowPartyIntro();
}
// 공유 인트로 스크립트 (방장·파티원 모두에게 표시)
function advShowPartyIntro(){
  PARTY._inLobby=false; PARTY._confirmShown=true;
  if(!PARTY._worldShown){ PARTY._worldShown=true; PARTY._worldReading=true;   // ★ 세계관 인트로 먼저 — 읽는 동안엔 재렌더로 안 끊음
    advShowWorldIntro(iAmLeader()?'keeper':'crew', ()=>{ PARTY._worldReading=false; advShowPartyIntroBody(); }); return; }
  PARTY._worldReading=false;
  advShowPartyIntroBody();
}
function advShowPartyIntroBody(){
  const M=partyMembers(), d=PARTY.data, leader=d&&d.leader;
  const ln = leader && M[leader] ? (M[leader].charName||M[leader].nick||'?') : '?';
  const crew = Object.keys(M).filter(u=>u!==leader).map(u=>M[u].charName||M[u].nick||'?');
  const crewTxt = crew.length ? crew.map(esc).join(' · ') : '동료들';
  let html='<p><span class="loc">[ SURVIVE — 감염 도시 ]</span></p>'
    +'<p>항체 보유자 <span class="good">'+esc(ln)+'</span> 와(과) 호송대 <span class="npc">'+crewTxt+'</span> 이(가) 함께 무너진 도시로 들어선다.</p>'
    +'<p class="sys">그가 쓰러지면 모두 실패한다 — 끝까지 지켜라.</p>'
    +'<p>이 일행으로 시작할까요?</p>';
  const btns=[];
  const lm = leader && M[leader];
  const goLive = !!(PARTY._goReady || (lm && lm.go));   // ★ 신호를 데이터에서 직접 파생 — 원샷 플래그 유실돼도 버튼 표시
  if(iAmLeader()){ btns.push({label:'▶ 시작하기', cls:'adv-reveal', on:advLeaderStartRun}); }
  else if(goLive){   // 방장이 출발함 → 팀원도 각자 시작(방장 시드 상속·같은 위치)
    PARTY._goReady=true;
    html+='<p class="good">방장이 출발했다! 뒤따라 출발하자.</p>';
    btns.push({label:'▶ 시작하기', cls:'adv-reveal', on:advCrewStartRun});
  }
  else { html+='<p class="sys">방장이 출발하길 기다리는 중…</p>'; }
  advPrompt(html, btns);
}
// 팀원 시작 — 방장 시드가 도착했는지 확인 후 진입(같은 맵·같은 시작 위치)
function advCrewStartRun(){
  if(advLeaderSeed()==null){ advToast('방장이 먼저 출발해야 해요'); return; }
  PARTY._introShown=true; PARTY._inLobby=false;
  advEnterRun();   // 맵 리셋 → advEnsureMap이 방장 시드 상속 → 같은 시작 지점
}
function advLeaderStartRun(){
  if(!iAmLeader()){ advToast('방장(키퍼)만 시작할 수 있어요'); return; }   // ★ 하드 가드
  PARTY._inLobby=false;
  ADV.map=null; _advMapCache=null; advEnsureMap();   // ★ 새 런 맵을 먼저 생성 — 시드 확정
  const seed=ADV.map.seed;
  if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {go:1, advSeed:seed}); }catch(_){} }   // ★ 시작 신호+시드를 한 번에 → 팀원이 같은 맵·같은 시작 위치
  advEnterRun(true);   // 방금 만든 맵 유지한 채 진입
}
function advShowModeSelect(){
  ADV.inLobby=true; advSave();   // ★ 로비 진입 표시 — 껐다 켜도 로비 유지
  advPrompt(
    '<p>함께 살아남을 동료를 구할까, 혼자 나설까?</p>',
    [
      {label:'👥 투게더 모드', cls:'adv-reveal', on:advStartTogether},
      {label:'🚶 솔로 모드', on:()=>{
        advDissolveForSolo();   // 투게더로 만든 파티가 있으면 와해
        PARTY.mode='solo'; PARTY.started=true; ADV.inLobby=false; advSave();   // ★ 솔로 확정 → 로비 이탈
        // ★ 버그수정(이동 잠김): 예전엔 여기서 advEnterRun의 일부만 손으로 복사해 썼다.
        //   빠져 있던 것: ADV.scene='' · ADV._gate=null · ADV.map 리셋 · ADV.sessionMode · _fb/_chat 초기화.
        //   → 이전 세션이 캠프(scene='camp')에서 끝났으면 그 값이 그대로 남아 advCanMoveNow()가 false,
        //     즉 시작하자마자 이동 불가('캠프에 있음'). 껐다 켜면 advRouteOnOpen의 캠프 잔재 정리가 돌아 풀렸다.
        //     sessionMode도 안 써서 솔로 세션은 껐다 켜면 재개가 아니라 모드선택으로 떨어졌다.
        //   진입은 advEnterRun 단일 창구로만 한다(파티/솔로 공통).
        advShowWorldIntro('keeper', ()=>advEnterRun());
      }},
    ]
  );
}
// 파티원을 모은 뒤 투게더 재선택 → "이 팀으로 진행할까요?"
// 솔로 전환 시: 내 파티를 와해(파티장=해체, 파티원=탈퇴)
function advDissolveForSolo(){
  if(!PARTY.pid) return;
  const pid=PARTY.pid;
  if(fbReady()){
    if(iAmLeader()) firebaseAPI.advDisbandParty(pid);
    else firebaseAPI.advLeaveParty(pid, myUid());
  }
  try{ PARTY.unsubParty&&PARTY.unsubParty(); }catch(_){}
  PARTY.unsubParty=null; PARTY.pid=null; PARTY.data=null; ADV.partyPid=null; advSave();
}
// 파티 탈퇴 (파티원)
function advLeaveMyParty(){
  if(!fbReady()||!PARTY.pid){ PARTY.pid=null; PARTY.mode=null; PARTY._leaderLocal=false; advShowModeSelect(); return; }
  const pid=PARTY.pid;
  const others=Object.keys(partyMembers()).filter(u=>u!==myUid());   // 나 말고 남는 사람
  const fin=()=>{ try{ PARTY.unsubParty&&PARTY.unsubParty(); }catch(_){}
    PARTY.unsubParty=null; PARTY.pid=null; PARTY.data=null; PARTY.mode=null; PARTY._leaderLocal=false; ADV.partyPid=null; advSave();
    advToast('파티에서 나왔어요'); advRenderSim(); advShowModeSelect(); };
  firebaseAPI.advLeaveParty(pid, myUid()).then(()=>{
    if(others.length===0 && firebaseAPI.advDisbandParty){ try{ firebaseAPI.advDisbandParty(pid); }catch(_){} }   // 나가면 아무도 없음 → 빈 방 삭제
    fin();
  }).catch(fin);
}
// 캠프에서 파티 이탈 → 모드선택으로 리셋하지 않고 솔로로 캠프에서 이어가기
function advCampLeaveParty(camp){
  const pid=PARTY.pid;
  const others=pid?Object.keys(partyMembers()).filter(u=>u!==myUid()):[];
  const done=()=>{ try{ PARTY.unsubParty&&PARTY.unsubParty(); }catch(_){}
    PARTY.unsubParty=null; PARTY.pid=null; PARTY.data=null; PARTY.mode='solo'; PARTY.started=true; PARTY._leaderLocal=false; ADV.partyPid=null; advSave();
    advToast('파티에서 나와 홀로 나아간다'); advRenderSim(); advOpenCamp(camp); };
  if(fbReady() && pid){ firebaseAPI.advLeaveParty(pid, myUid()).then(()=>{
    if(others.length===0 && firebaseAPI.advDisbandParty){ try{ firebaseAPI.advDisbandParty(pid); }catch(_){} }   // 빈 방 삭제
    done();
  }).catch(done); } else done();
}
// 내 파티가 없으면 생성 (투게더 최초 진입)
function advEnsureMyParty(cb){
  if(PARTY.pid){ cb&&cb(); return; }
  if(!fbReady()){ advToast('네트워크 연결이 필요해요'); return; }
  firebaseAPI.advCreateParty(myUid(), myMemberPayload(ADV.scene||'camp')).then(pid=>{
    PARTY.pid=pid; advSubscribeParty(pid); cb&&cb();
  }).catch(()=>advToast('파티 생성에 실패했어요'));
}

// [상대닉(캐릭터)가 파티를 요청했습니다] 수락/거절
function advShowInvitePrompt(fromUid, inv){
  advPrompt(
    '<p><span class="loc">[무전 수신]</span></p><p><span class="npc">'+esc(inv.fromNick)+'</span>('+esc(inv.charName)+')가 파티를 요청했습니다.</p><p class="sys">함께하시겠습니까?</p>',
    [
      {label:'✅ 수락', cls:'adv-reveal', on:()=>{
        firebaseAPI.advJoinParty(inv.pid, myUid(), myMemberPayload(ADV.scene||'camp'), null).then(()=>{
          PARTY.pid=inv.pid; PARTY.mode='together'; PARTY.started=true; advSubscribeParty(inv.pid);
          firebaseAPI.advClearInvite(myUid(), fromUid);
          advToast('파티에 합류했어요'); advRenderScene(); advRenderSim();
        }).catch(()=>advToast('합류에 실패했어요'));
      }},
      {label:'❌ 거절', on:()=>{
        firebaseAPI.advClearInvite(myUid(), fromUid);
        advRouteOnOpen();
      }},
    ]
  );
}
// [상대파티가 합류를 요청 (n명)] 수락/거절 — 내가 파티장
// 친구 목록에서 파티 초대 (팝업)
function advOpenFriendInvite(){
  if(!fbReady()){ advToast('네트워크 연결이 필요해요'); return; }
  const pop=document.getElementById('advFriendPop'); if(!pop) return;
  const list=document.getElementById('advFriendList');
  const title=pop.querySelector('.adv-pop-title'); if(title) title.firstChild.textContent='👥 파티 초대 ';
  const note=pop.querySelector('.adv-pop-note'); if(note) note.textContent='친구만 초대할 수 있어요.';
  list.innerHTML='<div class="adv-fr-empty">친구 목록을 불러오는 중…</div>';
  pop.classList.add('on');
  firebaseAPI.advGetFriends(myUid()).then(friends=>{
    const ids=Object.keys(friends||{});
    if(!ids.length){ list.innerHTML='<div class="adv-fr-empty">아직 친구가 없어요.<br>친구 탭에서 친구를 추가해보세요.</div>'; return; }
    list.innerHTML='';
    const inParty=partyMembers();
    ids.forEach(fid=>{
      const f=friends[fid];
      const already=!!inParty[fid];
      const row=h('<div class="adv-fr-row"><span class="dot '+(f.online?'on':'')+'"></span>'+
        '<span class="nm">'+esc(f.name)+'</span>'+
        (already?'<span class="in">파티중</span>':'<button type="button">초대</button>')+'</div>');
      const btn=row.querySelector('button');
      if(btn) btn.addEventListener('click', ()=>{
        advEnsureMyParty(()=>{
          const s=activeSlot();
          firebaseAPI.advSendInvite(fid, myUid(), PARTY.pid, myNick(), s.name||defaultName())
            .then(()=>{ advToast(esc(f.name)+'에게 초대를 보냈어요'); btn.textContent='보냄'; btn.disabled=true; });
        });
      });
      list.appendChild(row);
    });
  }).catch(()=>{ list.innerHTML='<div class="adv-fr-empty">친구 목록을 불러오지 못했어요.</div>'; });
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function sceneIntro(sc){
  if(PARTY.mode==='together' && sc.introTogether) return sc.introTogether;
  if(sc.introSolo) return sc.introSolo;
  return sc.intro || [];
}
function advRenderScene(){
  const sc=curScene();
  const term=document.getElementById('advTerm');
  if(term){ term.innerHTML=sceneIntro(sc).join(''); term.scrollTop=0; }
  if(sc.gather && PARTY.pid && PARTY.data && PARTY.data.departed){ advShowFollowGate(); return; }
  advShowRevealGate();
}
// 집결 지점 뒤늦게 도착 → 따라가기
function advShowFollowGate(){
  const term=document.getElementById('advTerm');
  if(term){ term.innerHTML+='<p class="sys">팀원들은 먼저 캠프로 이동한 것 같다. 따라가서 합류하자.</p>'; term.scrollTop=term.scrollHeight; }
  const box=document.getElementById('advChoices'); if(!box) return;
  box.innerHTML='';
  const follow=h('<button class="adv-choice adv-reveal" type="button">🏃 따라가기 — 캠프로 합류</button>');
  follow.addEventListener('click', ()=>{
    const nx=(curScene().choices[0]&&curScene().choices[0].next)||'arrive';
    ADV.scene=nx; advSave(); advSyncMyLocation(); advRenderScene();
  });
  box.appendChild(follow);
}
// 스크립트를 먼저 읽게 하고, 버튼을 눌러야 선택지가 펼쳐지도록 하는 게이트
function advShowRevealGate(){
  const box=document.getElementById('advChoices'); if(!box) return;
  box.innerHTML='';
  const btn=h('<button class="adv-choice adv-reveal" type="button">▼ 선택지 보기</button>');
  btn.addEventListener('click', advRenderChoices);
  box.appendChild(btn);
}
function advRenderChoices(){
  const box=document.getElementById('advChoices'); if(!box) return;
  const s=activeSlot();
  const sc=curScene();
  box.innerHTML='';
  const collapse=h('<button class="adv-choice adv-reveal" type="button">▲ 선택지 접기</button>');
  collapse.addEventListener('click', advShowRevealGate);
  box.appendChild(collapse);
  // 집결 관문 대기 표시
  if(sc.gather && PARTY.mode==='together' && PARTY.pid && partyCount()>1){
    const arrived=sameLocationCount(ADV.scene), total=partyCount();
    if(arrived<total){
      box.appendChild(h('<div class="adv-gather">⏳ 동료를 기다리는 중… ('+arrived+'/'+total+' 도착)</div>'));
      if(iAmLeader()){
        const go=h('<button class="adv-choice adv-depart" type="button">▶ 먼저 출발하기 (도착한 '+arrived+'명과 이동)</button>');
        go.addEventListener('click', advLeaderDepart);
        box.appendChild(go);
      }
    }
  }
  sc.choices.forEach((c,i)=>{
    let reqTxt='조건 없음', ok=true;
    if(c.need){ const [k,v]=c.need; ok=statEff(s,k)>=v; reqTxt=ADV_WORLD.statNames[k].replace(/^\S+\s/,'')+' '+(v+9)+' 필요'; }
    const stOk=ADV.st>=c.cost;
    let coopTag='', locked=false;
    if(c.gatherCoop){
      if(PARTY.mode!=='together' || partyCount()<=1) return;   // 솔로/1인 숨김
      const arrived=sameLocationCount(ADV.scene), total=partyCount();
      coopTag=' <span class="coop">('+Math.min(arrived,total)+'/'+total+')</span>';
      if(arrived<total) locked=true;
    }
    const showReq = (c.need||c.cost);
    const btn=h('<button class="adv-choice" type="button">'+c.label+coopTag+
      (showReq?(' <span class="req '+(ok?'ok':'no')+'">'+reqTxt+(c.cost?' · 기력 '+ADV_ST_COST:'')+'</span>'):'')+'</button>');
    if(!ok||!stOk||locked) btn.classList.add('locked');
    if(!stOk){ const r=btn.querySelector('.req'); if(r){ r.classList.remove('ok'); r.classList.add('no'); } }
    btn.addEventListener('click', ()=>advPickChoice(i));
    box.appendChild(btn);
  });
}
// 파티장 먼저 출발
function advLeaderDepart(){
  if(fbReady() && PARTY.pid && firebaseAPI.advSetDeparted){ try{ firebaseAPI.advSetDeparted(PARTY.pid, true); }catch(_){} }
  const c=curScene().choices.find(x=>x.next)||curScene().choices[0];
  ADV.scene=(c&&c.next)||'arrive'; advSave(); advSyncMyLocation(); advRenderScene();
}

function advPickChoice(i){
  const c=curScene().choices[i]; if(!c) return;
  const s=activeSlot();
  const term=document.getElementById('advTerm');
  if(c.gatherCoop){
    const arrived=sameLocationCount(ADV.scene), total=partyCount();
    if(arrived<total){
      if(term){ term.innerHTML+='<p class="bad">아직 도착하지 않은 동료가 있습니다. ('+arrived+'/'+total+')</p>'; term.scrollTop=term.scrollHeight; }
      return;
    }
  }
  const _cost=(c.cost?ADV_ST_COST:0);   // ★ #9: 선택지 비용은 종류 불문 1
  const okSt=ADV.st>=_cost;
  if(!okSt){
    if(term){ term.innerHTML+='<p class="bad">기력이 부족합니다. 집중 세션을 완료하고 다시 시도하세요.</p>'; term.scrollTop=term.scrollHeight; }
    return;
  }
  // 허브 특수 선택지
  if(c.survivors){ advShowSurvivors(); return; }
  if(c.openInv){ advOpenInv(); return; }
  if(c.scout){ advDoScout(c); return; }

  if(_cost) advSpendSt(_cost);   // ★ #9
  let html='';
  if(c.combat || c.forceCombat){
    if(c.forceCombat) html=(c.result||[]).join('');
    html+=advDoCombat(s);
  } else {
    if(c.weaponCheck && !slotWeaponBonus(s)){
      html=(c.resultNoWeapon||c.result||[]).join('');
      if(c.hpNoWeapon) ADV.hp=Math.max(0, ADV.hp-c.hpNoWeapon);
    } else {
      html=(c.result||[]).join('');
    }
    if(c.gain){ html+=advGainItems(c.gain); }
    // 탐색 집계: 스탯 판정(need)이 붙은 비전투 선택지
    if(c.need){ s.explores=(s.explores||0)+1; html+=advCheckTitleUnlock(s, 'explores'); }
  }
  if(c.saveCamp) ADV.homeCamp=c.saveCamp;
  advSave();
  if(term){ term.innerHTML=html; term.scrollTop=0; }
  advRenderSim();
  const box=document.getElementById('advChoices');
  if(box){
    box.innerHTML='';
    if(ADV.hp<=0){ advHandleFaint(box); }
    else if(c.next){
      const nx=h('<button class="adv-choice adv-reveal" type="button">▶ 다음 장소로 이동</button>');
      nx.addEventListener('click', ()=>{ ADV.scene=c.next; if(c.saveCamp) ADV.homeCamp=c.saveCamp; advSave(); advSyncMyLocation(); advRenderScene(); });
      box.appendChild(nx);
    } else {
      advShowHubReturn();
    }
  }
}
// 기절 (튜토리얼: 죽지 않고 캠프 이송)
function advHandleFaint(box){
  const term=document.getElementById('advTerm');
  const together=(PARTY.mode==='together' && partyCount()>1);
  const msg = together
    ? '<p class="sys">기절한 당신을, 동료들이 이끌고 캠프로 이동했다.</p>'
    : '<p class="sys">정신을 잃었다… 얼마나 지났을까. 누군가 당신을 발견해 캠프로 데려갔다.</p>';
  if(term){ term.innerHTML+=msg; term.scrollTop=term.scrollHeight; }
  const btn=h('<button class="adv-choice adv-reveal" type="button">🏕 캠프에서 눈을 뜬다</button>');
  btn.addEventListener('click', ()=>{ ADV.hp=50; ADV.inf=Math.min(ADV.inf,50); ADV.scene='hub'; ADV.homeCamp='hub'; advSave(); advSyncMyLocation(); advRenderSim(); advRenderScene(); });
  box.appendChild(btn);
}
function advShowHubReturn(){
  const box=document.getElementById('advChoices'); if(!box) return;
  box.innerHTML='';
  const back=h('<button class="adv-choice adv-reveal" type="button">↩ 캠프 둘러보기로</button>');
  back.addEventListener('click', advRenderScene);
  box.appendChild(back);
}

// 정찰로 얻은 보너스 총합 (슬롯별, 상한 5)
const SCOUT_BONUS_MAX = 5;
const SCOUT_CHANCE = 0.03;   // 3%
function slotBonusTotal(s){ const b=s.bonus||{}; return (b.str||0)+(b.agi||0)+(b.int||0)+(b.luk||0); }

// 캠프 정찰 — 기력 소모(cost는 호출 전 확인됨), 희박한 확률로 랜덤 스탯 영구 +1
function advDoScout(c){
  const s=activeSlot();
  const term=document.getElementById('advTerm');
  advSpendSt(ADV_ST_COST);   // ★ #9: 정찰도 1
  let out='<p><span class="loc">[캠프 주변 정찰]</span></p>';
  const total=slotBonusTotal(s);
  if(total>=SCOUT_BONUS_MAX){
    out+='<p class="sys">여기서 더 배울 건 없는 것 같다. 이미 충분히 단련됐다.</p>';
  } else if(Math.random() < SCOUT_CHANCE){
    // 랜덤 스탯 +1
    const k=STAT_KEYS[Math.floor(Math.random()*STAT_KEYS.length)];
    if(!s.bonus) s.bonus={str:0,agi:0,int:0,luk:0};
    s.bonus[k]=(s.bonus[k]||0)+1;
    const nm=ADV_WORLD.statNames[k].replace(/^\S+\s/,'');
    out+='<p class="crit">✨ 정찰 중 무언가를 깨달았다! '+nm+'이(가) 영구히 +1 되었다. (성장 '+slotBonusTotal(s)+'/'+SCOUT_BONUS_MAX+')</p>';
  } else {
    // 실패 — 소소한 결과
    const flavor=['별다른 소득 없이 돌아왔다.','폐허만 둘러보다 왔다.','수상한 기척에 서둘러 복귀했다.','아무것도 찾지 못했다.'];
    out+='<p>'+flavor[Math.floor(Math.random()*flavor.length)]+'</p>';
  }
  advSave();
  if(term){ term.innerHTML=out; term.scrollTop=0; }
  advRenderSim();
  // 다시 정찰 또는 돌아가기
  const box=document.getElementById('advChoices'); if(!box) return;
  box.innerHTML='';
  if(ADV.st>=(c.cost||15) && slotBonusTotal(s)<SCOUT_BONUS_MAX){
    const again=h('<button class="adv-choice" type="button">🧭 계속 정찰한다 <span class="req">기력 '+ADV_ST_COST+'</span></button>');
    again.addEventListener('click', ()=>advDoScout(c));
    box.appendChild(again);
  }
  const back=h('<button class="adv-choice adv-reveal" type="button">↩ 캠프 둘러보기로</button>');
  back.addEventListener('click', advRenderScene);
  box.appendChild(back);
}

/* ─────────────────────────── 전투 ───────────────────────────
   공격력=힘×1.5+민첩×0.5(+무기) / 방어력=힘×1.0+민첩×0.5
   크리=지능×2+운×3 % (배율 1.5) / 회피=운×2.5+방어 % / 감염회피=운×2+방어 % */
function advDoCombat(s){
  const E=ADV_WORLD.enemy;
  const atk=statAtk(s), def=statDef(s);
  let out='<p><span class="loc">['+E.name+'과(와) 교전!]</span></p>';
  // 내 공격
  const isCrit=Math.random()*100 < critChance(s);
  let dmg=Math.max(1, atk - E.def);
  if(isCrit){ dmg=Math.round(dmg*1.5); out+='<p><span class="crit">[크리티컬!]</span> <span class="roll">공격 '+atk+' vs 방어 '+E.def+'</span> → '+E.name+'에게 '+dmg+' 피해!</p>'; }
  else out+='<p><span class="roll">[공격 '+atk+' vs 방어 '+E.def+']</span> '+E.name+'에게 '+dmg+' 피해!</p>';
  // 무기 내구도 소모 (장착 무기가 있으면)
  if(s.weapon && s.weapon.dur>0){
    s.weapon.dur--;
    const it=ADV_WORLD.items[s.weapon.id];
    if(s.weapon.dur<=0){
      out+='<p class="bad">💥 '+(it?it.name:'무기')+'이(가) 부러져 못 쓰게 되었다!</p>';
      s.weapon=null;   // 완전 소멸
    } else {
      out+='<p class="sys">'+(it?it.name:'무기')+' 내구도 '+weaponDurPct(s.weapon)+'%</p>';
    }
  }
  const killed=dmg>=10;   // 간이 처치 판정 (감염자 체력 10)
  if(killed){
    out+='<p class="good">'+E.name+'이(가) 쓰러졌다!</p>';
    s.kills=(s.kills||0)+1;
    out+=advCheckTitleUnlock(s, 'kills');
    out+=advGainItems([['bat',1]]);
  }else{
    // 반격 → 회피 판정
    const dodge=dodgeChance(s);
    if(Math.random()*100 < dodge){
      out+='<p><span class="roll">[회피 '+dodge+'%: 성공]</span> <span class="good">'+E.name+'의 반격을 피했다!</span></p>';
    }else{
      const hit=Math.max(1, E.atk - Math.round(def*0.5));
      ADV.hp=Math.max(0, ADV.hp-hit);
      out+='<p><span class="roll">[회피 '+dodge+'%: 실패]</span> <span class="bad">반격당했다! HP -'+hit+'</span></p>';
      // 감염 회피 판정
      const iav=infectAvoidChance(s);
      if(Math.random()*100 < iav){
        out+='<p><span class="roll">[감염 회피 '+iav+'%: 성공]</span> <span class="good">상처는 얕다. 감염되지 않았다.</span></p>';
      }else{
        ADV.inf=Math.min(100, ADV.inf+E.infect);
        out+='<p><span class="roll">[감염 회피 '+iav+'%: 실패]</span> <span class="bad">☣ 감염률 +'+E.infect+'%</span></p>';
      }
    }
    out+='<p class="sys">'+E.name+'이(가) 비틀거리며 물러난다… 지금이 지나갈 기회다.</p>';
  }
  if(ADV.hp<=0) out+='<p class="bad">시야가 흐려진다…</p>';
  return out;
}

/* ─────────────────────────── 인벤토리 ─────────────────────────── */
function advGainItems(gains){
  let out='';
  gains.forEach(([id,n])=>{
    const it=ADV_WORLD.items[id];
    if(it && it.weapon){
      // 무기는 개체로 — 내구도 가득 채워 n개 추가
      for(let k=0;k<n;k++) ADV.weapons.push({ id, dur: it.maxDur||1 });
    } else {
      ADV.inv[id]=(ADV.inv[id]||0)+n;
    }
    if(it) out+='<p class="sys">+ '+it.icon+' '+it.name+' ×'+n+' (인벤토리)</p>';
  });
  return out;
}
function advRenderInv(){
  const body=document.getElementById('advInvBody'); if(!body) return;
  body.innerHTML='<div class="adv-inv-note">더블클릭 = 사용/장착 (무기는 게임 화면 좌측 목록에서도 바로 장착돼요)</div>';
  const cIds=Object.keys(ADV.inv).filter(id=>ADV.inv[id]>0);
  const wCount={};   // 무기 종류별 개수 집계 (미장착 풀)
  ADV.weapons.forEach(w=>{ wCount[w.id]=(wCount[w.id]||0)+1; });
  const wIds=Object.keys(wCount);
  if(!cIds.length && !wIds.length){ body.appendChild(h('<div class="adv-inv-empty">아직 아이템이 없어요.<br>모험에서 물자를 모아보세요!</div>')); return; }
  // 소모품
  cIds.forEach(id=>{
    const it=ADV_WORLD.items[id]; if(!it) return;
    const row=h('<div class="adv-inv-item"><span class="ic">'+it.icon+'</span>'+
      '<span class="nm">'+it.name+'<small>'+it.desc+'</small></span>'+
      '<span class="ct">×'+ADV.inv[id]+'</span></div>');
    row.addEventListener('dblclick', ()=>{ if(typeof advUseItem==='function') advUseItem(id); advRenderInv(); });
    if(it.use){
      const b=h('<button type="button">사용</button>');
      b.addEventListener('click', ()=>{
        if(ADV.inv[id]<=0) return;
        ADV.inv[id]--;
        if(it.use.hp) ADV.hp=Math.min(100,ADV.hp+it.use.hp);
        if(it.use.st) ADV.st=Math.min(100,ADV.st+it.use.st);
        advSave(); advRenderInv(); advRenderSim();
        advToast(it.name+' 사용!');
      });
      row.appendChild(b);
    }
    body.appendChild(row);
  });
  // 무기 (미장착 풀) — 각 개체의 내구도 퍼센트 나열
  if(wIds.length){
    body.appendChild(h('<div class="adv-inv-note" style="margin-top:4px;">🗡 무기 · 더블클릭으로 선택 캐릭터에 장착</div>'));
    wIds.forEach(id=>{
      const it=ADV_WORLD.items[id]; if(!it) return;
      const durs=ADV.weapons.filter(w=>w.id===id).map(w=>weaponDurPct(w));
      const row=h('<div class="adv-inv-item"><span class="ic">'+it.icon+'</span>'+
        '<span class="nm">'+it.name+'<small>'+it.desc+' · 내구도 '+durs.map(p=>p+'%').join(', ')+'</small></span>'+
        '<span class="ct">×'+wCount[id]+'</span></div>');
      row.style.cursor='pointer';
      row.addEventListener('dblclick', ()=>{ advEquipWeaponById(id); advRenderInv(); });
      body.appendChild(row);
    });
  }
}
// 무기 장착/해제 (캐릭터세팅 슬롯에서) — 개체 단위로 슬롯에 귀속, 미장착 풀과 교환
function advEquipToSlot(slotIdx){
  // 미장착 무기 중 하나를 이 슬롯에 장착 (가장 내구도 높은 것 우선)
  const s=ADV.slots[slotIdx];
  if(ADV.weapons.length===0){ advToast('장착할 무기가 없어요'); return; }
  ADV.weapons.sort((a,b)=>weaponDurPct(b)-weaponDurPct(a));
  const w=ADV.weapons.shift();       // 풀에서 꺼냄
  if(s.weapon) ADV.weapons.push(s.weapon);   // 기존 장착품은 풀로 반납(내구도 유지)
  s.weapon=w;
  advSave(); advRenderChar(); advRenderSim();
  advToast((ADV_WORLD.items[w.id]?ADV_WORLD.items[w.id].name:'무기')+' 장착!');
}
function advUnequipSlot(slotIdx){
  const s=ADV.slots[slotIdx];
  if(!s.weapon) return;
  ADV.weapons.push(s.weapon);   // 내구도 유지한 채 풀로 반납
  s.weapon=null;
  advSave(); advRenderChar(); advRenderSim();
}

/* ─────────────────────────── 캐릭터세팅 ─────────────────────────── */
function advRenderChar(){
  advRenderSlotTabs();
  const s=curSlot();
  const el=id=>document.getElementById(id);
  if(el('advRptNo')) el('advRptNo').textContent='No.'+String(editSlot+1).padStart(3,'0');
  setFaceEl(el('advFaceBig'), s, 'adv-face-emoji');
  if(el('advFName')) el('advFName').value=s.name||'';
  if(el('advFAge'))  el('advFAge').value=s.age||'';
  if(el('advFPers')) el('advFPers').value=s.personality||'';
  if(el('advKeepBox')){ el('advKeepBox').innerHTML = s.keepsake?'<img src="'+s.keepsake+'" alt="유품">':'＋';
    el('advKeepBox').title = s.keepsake?(s.keepsakeDesc||'유품'):'유품 이미지 (클릭해서 등록 · 투명 PNG 20×20)'; }
  if(el('advKeepDesc')) el('advKeepDesc').value=s.keepsakeDesc||'';
  const cs=el('advCharStats');
  if(cs){
    const left=slotPointsLeft(s);
    { const _t=ageTier(s); cs.innerHTML='<div class="hd">스탯 분배 · 기본 10P + 집중 레벨 보너스 · '+_t.label+' ×'+_t.mul+' (포인트 최대 50)</div>'; }
    const grid=h('<div class="adv-cs-grid"></div>');
    for(const k of STAT_KEYS){
      const row=h('<div class="adv-cs-row"><span class="nm">'+ADV_WORLD.statNames[k]+'</span>'+
        '<button type="button" data-k="'+k+'" data-d="-1">−</button>'+
        '<span class="vl">'+slotStat(s,k)+'</span>'+
        '<button type="button" data-k="'+k+'" data-d="1">＋</button></div>');
      const b=row.querySelectorAll('button');
      b[0].disabled=(s.alloc[k]<=0);
      b[1].disabled=(left<=0);
      grid.appendChild(row);
    }
    cs.appendChild(grid);
  }
  const eq=el('advEquip');
  if(eq){
    eq.innerHTML='<span class="lbl">🗡 장비</span>';
    if(s.weapon){
      const it=ADV_WORLD.items[s.weapon.id]; const pct=weaponDurPct(s.weapon);
      eq.appendChild(h('<span class="cur">'+(it?it.icon+' '+it.name:'무기')+' <small style="color:'+(pct<=30?'#c0392b':'#2a7a3f')+'">('+pct+'%)</small></span>'));
      const un=h('<button type="button" class="eqbtn">해제</button>');
      un.addEventListener('click', ()=>advUnequipSlot(editSlot));
      eq.appendChild(un);
    } else {
      const avail=ADV.weapons.length;
      eq.appendChild(h('<span class="cur" style="color:#888;">맨손</span>'));
      const b=h('<button type="button" class="eqbtn"'+(avail?'':' disabled')+'>'+(avail?'장착 (보유 '+avail+')':'무기 없음')+'</button>');
      if(avail) b.addEventListener('click', ()=>advEquipToSlot(editSlot));
      eq.appendChild(b);
    }
  }
  const ts=el('advTitleSel');
  if(ts){
    const unlocked=unlockedTitles(s);
    ts.innerHTML='<span class="lbl">🏅 칭호</span>';
    if(!unlocked.length){
      ts.appendChild(h('<span class="cur" style="color:#888;">아직 없음 (좀비 100 처치 / 탐색 100회부터)</span>'));
    } else {
      const sel=document.createElement('select'); sel.className='adv-title-select';
      const none=document.createElement('option'); none.value=''; none.textContent='(표시 안 함)'; sel.appendChild(none);
      unlocked.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name; if(s.title===t.id) o.selected=true; sel.appendChild(o); });
      sel.addEventListener('change', ()=>{ s.title=sel.value||null; advSave(); advRenderChar(); advRenderSim(); });
      ts.appendChild(sel);
    }
  }
  const dv=el('advDerived');
  if(dv) dv.innerHTML='⚔ 공격력 <b>'+statAtk(s)+'</b> · 🛡 방어력 <b>'+statDef(s)+'</b> · ✨ 크리티컬 <b>'+critChance(s)+'%</b> · 💨 회피 <b>'+dodgeChance(s)+'%</b>'+
    '<br>🧟 처치 <b>'+(s.kills||0)+'</b> · 🔦 탐색 <b>'+(s.explores||0)+'</b>';
  if(el('advCharSp')) el('advCharSp').textContent=slotPointsLeft(s);
  const sel=el('advCharSelect');
  if(sel){
    if(editSlot===ADV.active){ sel.textContent='✔ 선택된 캐릭터'; sel.classList.add('is-active'); }
    else { sel.textContent='캐릭터 선택'; sel.classList.remove('is-active'); }
  }
}
function advRenderSlotTabs(){
  const tabs=document.getElementById('advSlotTabs'); if(!tabs) return;
  tabs.innerHTML='';
  for(let i=0;i<3;i++){
    const s=ADV.slots[i];
    const t=h('<div class="adv-slot-tab'+(i===editSlot?' on':'')+(i===ADV.active?' active-slot':'')+'">슬롯'+(i+1)+(slotFilled(s)?'<span class="dot">●</span>':'')+'</div>');
    t.addEventListener('click', ()=>{ editSlot=i; advRenderChar(); });
    tabs.appendChild(t);
  }
}

/* ─────────────────────────── 이미지 업로드 (Storage) ─────────────────────────── */
function advUploadImage(slotKey, maxW, maxH, quality, onUrl){
  if(advVisiting) return;
  try{ if(window.companion && companion.dsHold) companion.dsHold(); }catch(_){}
  const hasUploader=!!(window.firebaseAPI && firebaseAPI.uploadUserImage && typeof getMyUserId==='function');
  const fi=document.createElement('input'); fi.type='file'; fi.accept='image/*';
  fi.onchange=()=>{
    const file=fi.files&&fi.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=async()=>{
        const scale=Math.min(1, maxW/img.width, maxH/img.height);
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        const dataUrl=c.toDataURL('image/jpeg', quality);
        if(hasUploader){
          try{
            advToast('이미지를 올리는 중…');
            const res=await firebaseAPI.uploadUserImage(getMyUserId(), slotKey, dataUrl);
            if(res&&res.ok){ onUrl(res.url); advToast('저장했어요'); }
            else advToast((res&&res.reason)||'업로드에 실패했어요');
          }catch(_){ advToast('업로드에 실패했어요'); }
        }else onUrl(dataUrl);   // Storage 불가 환경 폴백
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  };
  fi.click();
}
function advToast(msg){ try{ if(typeof toast==='function'){ toast(msg); return; } }catch(_){} }

/* ─────────────────────────── 배경 ─────────────────────────── */
function advApplyBg(){
  const d=document.getElementById('advDesktop'); if(!d) return;
  // 방문 중엔 내 배경이 아니라 "그 집 주인"의 배경을 보여준다(서버에서 받아온 advVisitBg).
  const bg = advVisiting ? advVisitBg : ADV.bg;
  if(bg&&bg.img) d.style.background='url('+bg.img+') center/cover no-repeat';
  else if(bg&&bg.color) d.style.background=bg.color;
  // 방문 중인데 집주인 배경이 서버에 없으면(상대가 아직 업데이트 전) 청록 단색 대신 투명 처리 —
  //   그러면 그 집 마이홈 테마의 "방 미리보기 배경"이 비쳐 보여서 최소한 주인이 꾸민 색/이미지가 나온다.
  else if(advVisiting) d.style.background='transparent';
  else d.style.background='#3a8a8a';
}

/* ─────────────────────────── 창 열기/닫기 ─────────────────────────── */
// ★ 좀아칼 단계적 해제 — 준비된 창만 연다. (전부 열려면 셋 다 false)
//   1단계: 캐릭터세팅만 오픈(char:false). 시뮬/인벤은 배틀로얄 엔진 완성 후 해제.
const ADV_LOCK = { sim:false, char:false, inv:false };  // TEST본 — 프리뷰 전용, 배포 금지
function advLockedMsg(){ if(typeof toast==='function') toast('🚧 좀아칼au는 공사중입니다… 곧 만나요!'); }
function advOpenSim(){
  if(ADV_GAME_OFF) return;   // ★ 중단 상태 — 게임 창은 열지 않는다(파티 구독도 시작되지 않음)
  if(advVisiting) return;
  if(ADV_LOCK.sim){ advLockedMsg(); return; }
  advBuildSimInner();
  const w=document.getElementById('advSimWin');
  const homeWin=document.getElementById('myHomeWin');
  if(w && homeWin && w.parentNode!==homeWin){ homeWin.appendChild(w); }   // 마이홈 창 전체를 덮도록 이동
  if(w) w.classList.add('on');
  advBgmPlay();   // 🎵 좀아칼 BGM 시작(50%·반복) + 마이홈 BGM 자동 종료
  advStartPartyWatch();
  advRouteOnOpen();
}
// 파티 관련 실시간 구독 (시뮬 열려있는 동안)
function advStartPartyWatch(){
  if(!fbReady()) return;
  const uid=myUid();
  if(!PARTY.pid && ADV.partyPid && !PARTY.started){ PARTY.pid=ADV.partyPid; PARTY.mode='together'; PARTY._inLobby=true; }   // ★ 앱 재시작 후 파티 대기실 복원
  if(PARTY.pid && !PARTY.unsubParty) advSubscribeParty(PARTY.pid);
  if(PARTY.pid && PARTY.started && advIsParty()){   // ★ #7: 창 껐다 켜면 협동 구독(채팅·좌표·게이지) 재연결 — 채팅 공유 끊김 수정
    advSubscribeChat(); advSubscribeCoords(); advSubscribeGauge(); advSubscribeCombat();
  }
}
function advSubscribeParty(pid){
  if(!fbReady()) return;
  try{ PARTY.unsubParty && PARTY.unsubParty(); }catch(_){}
  PARTY.unsubParty = firebaseAPI.advWatchParty(pid, data=>{
    PARTY.data = data;
    if(!data){ PARTY.pid=null; PARTY.unsubParty=null;
      if(PARTY.started && PARTY.mode==='together'){ advPartySessionEnded(); return; }   // ★ 진행 중 해산(파티장 사망 등) → 팀원 세션 자동 종료(버그2)
      if(!PARTY.started && ADV.partyPid){ ADV.partyPid=null; advSave(); if(document.getElementById('advTerm')) advShowModeSelect(); return; }   // ★ 복원 실패(방 사라짐) → 모드선택
    }
    advSyncSharedMap();          // 파티장 시드로 공유 맵 수렴 (1a)
    // D#9/D#10: 나에게 전달된 백신·유품 수령
    if(data){
      const me=data.members && data.members[myUid()];
      if(me){
        if(me.vaxTs && me.vaxTs!==ADV._lastVax){ ADV._lastVax=me.vaxTs;
          if(ADV.inf>0){ ADV.inf=Math.max(0, ADV.inf-40); advToast('💉 '+esc(me.vaxFrom||'동료')+'가 백신을 놓아줬다! 감염 −40'); advSave(); advRenderSim(); } }
        if(me.giftTs && me.giftTs!==ADV._lastGift){ ADV._lastGift=me.giftTs;
          if(me.giftImg){ (ADV.recvKeeps=ADV.recvKeeps||[]).push({img:me.giftImg, desc:me.giftDesc||'', from:me.giftFrom||'동료'});
            if(ADV.recvKeeps.length>6) ADV.recvKeeps=ADV.recvKeeps.slice(-6);
            advToast('🎗 '+esc(me.giftFrom||'동료')+'의 유품을 받았다.'); advSave(); advRenderSim(); } }
        // 📦 아이템/무기 전달 수신 (우클릭 전달 inbox) — 수신 즉시 서버 inbox 비움(재시작 중복 방지)
        if(me.itemGiftTs && me.itemGiftTs!==ADV._lastItemGift){ ADV._lastItemGift=me.itemGiftTs;
          const gid=me.itemGiftId, git=gid&&ADV_WORLD.items[gid];
          if(git){
            if(me.itemGiftKind==='w') ADV.weapons.push({id:gid, dur:(me.itemGiftDur||git.maxDur||1)});
            else ADV.inv[gid]=(ADV.inv[gid]||0)+1;
            advToast('📦 '+esc(me.itemGiftFrom||'동료')+'에게서 '+git.name+'을(를) 받았다!');
            advSave(); advRenderSim();
          }
          if(fbReady() && PARTY.pid){ try{ firebaseAPI.advUpdateMember(PARTY.pid, myUid(), {itemGiftTs:0, itemGiftId:null, itemGiftKind:null, itemGiftDur:0, itemGiftFrom:null}); }catch(_){} }
        }
      }
      // D#8: 관전 중 방장(진행자)의 목격 결과 도착
      if(ADV._spectate!=null){
        const lu=data.leader, lm=lu&&data.members&&data.members[lu];
        if(lm && lm.witnessTs && lm.witnessTs!==ADV._lastWitness && lm.witnessBldg===ADV._spectate){
          ADV._lastWitness=lm.witnessTs; ADV._spectate=null;
          const tpl=ADV_STORY_WITNESS[lm.witnessMoral||'neutral']||ADV_STORY_WITNESS.neutral;
          const txt=tpl.replace(/\{actor\}/g, esc(lm.witnessActor||'동료'));
          advPrompt('<p><span class="loc">[ 목격 ]</span></p>'+txt, [{label:'🚶 물러난다', cls:'adv-reveal', on:advOpenMove}]);
        }
        if(ADV._spectate!=null && lm && lm.storyTs && lm.storyTs!==ADV._specStoryTs && ADV._voteBeat==null && !ADV._gauge){
          ADV._specStoryTs=lm.storyTs; advStorySpectate(ADV._spectate);   // ★ #7: 방장 비트 진행 → 실시간 함께 보기
        }
      }
      // D#7: 파티 투표 — crew 투표창 열림 감지 / 실시간 tally / 방장 집계 시 닫힘
      if(!iAmLeader()){
        const lu=data.leader, lm=lu&&data.members&&data.members[lu];
        if(lm && lm.voteOpenTs && lm.voteOpenTs!==ADV._lastVoteOpen && ADV._spectate!=null && lm.voteBldg===ADV._spectate){
          ADV._lastVoteOpen=lm.voteOpenTs; advRenderVote(lm.voteStory, lm.voteBeat);   // 투표 화면 진입
        } else if(ADV._voteBeat!=null){
          if(lm && (!lm.voteOpenTs || lm.voteOpenTs===0)){ ADV._voteBeat=null; ADV._voteStory=null; if(ADV._spectate!=null) advStorySpectate(ADV._spectate); }   // 집계됨 → 관전 복귀
          else advRenderVote(ADV._voteStory, ADV._voteBeat);   // tally 실시간 갱신
        }
      } else if(ADV._voteBeat!=null){
        advRenderVote(ADV._voteStory, ADV._voteBeat);   // 방장도 실시간 tally 갱신
      }
    }
    // 합류 검증: 이미 출발했거나(캠프 전) 정원 초과면 차단
    if(data && PARTY._checkJoin){
      PARTY._checkJoin=false;
      const lu=data.leader, lm=lu&&data.members&&data.members[lu];
      const cnt=Object.keys(data.members||{}).length, max=(lm&&lm.max)||advPartyMax();
      if(lm && lm.go && !data.atCamp){ advPartyJoinRejected('이미 출발한 파티예요. 캠프에 도착해야 합류할 수 있어요.'); return; }
      if(cnt>max){ advPartyJoinRejected('정원이 가득 찼어요. ('+max+'인)'); return; }
      PARTY._inLobby=true; advPartyLobby(); return;
    }
    // 파티원(crew): 방장 확정 → 공유 인트로 / 방장 시작 → 전원 자동 진입
    if(data && PARTY.mode==='together' && !iAmLeader()){
      const lu=data.leader, lm=lu&&data.members&&data.members[lu];
      if(lm && lm.ended) ADV._sessEndReason=lm.ended;   // ★ 세션 종료 사유(dead/clear) 선수신 — 해산 문구 분기용
    }
    // 파티원(crew): 방장 플래그(confirmed/go)로 매 콜백마다 화면 재계산 — 로컬 원샷 플래그 스테일에도 안 멈춤
    if(data && PARTY.mode==='together' && !PARTY.started && !iAmLeader() && !PARTY._checkJoin){
      const lu=data.leader, lm=lu&&data.members&&data.members[lu];
      const confirmed=!!(lm&&lm.confirmed), go=!!(lm&&lm.go);
      if(!confirmed){ PARTY._confirmShown=false; advPartyLobby(); }                                 // 방장 미확정 → 대기실(스테일 리셋)
      else if(!PARTY._confirmShown){ advShowPartyIntro(); }                                         // 확정 → 세계관 인트로 진입
      else if(go && !PARTY._worldReading){ PARTY._goReady=true; advShowPartyIntroBody(); }          // 시작 신호 → 명단 '시작하기'
      // else: 인트로/명단 화면 유지(재렌더 안 함 — 세계관 읽는 중 안 끊음)
    }
    else if(!PARTY.started && PARTY.pid && !PARTY._confirmShown && !ADV._gate && iAmLeader()){ advPartyLobby(); }   // 방장 대기실(확정 전)
    // 입장 게이트: 방장이 입장 누르면 집결한 파티원도 함께 입장 + 레디 상태 실시간 갱신
    if(data && ADV._gate){
      if(!iAmLeader()){
        const lu=data.leader, lm=lu&&data.members&&data.members[lu];
        if(lm && lm.enter && lm.enter===ADV._gate.key && ADV.scene===ADV._gate.key){ advGateConsumeEnter(); }
      }
      if(ADV._gate && ADV.scene===ADV._gate.key) advRenderGate();
    }
    advRenderSim();
    advRenderChoices2IfCoop();   // 협동 카운트 갱신
    advRefreshExploreChat();     // 동료 근접 변화 시 탐색 채팅 자동 노출
  });
}
// 열 때 라우팅: 개인 초대 > 병합 요청 > (파티 없으면)모드 선택 > (있으면)씬
function advRouteOnOpen(){
  const term=document.getElementById('advTerm'); if(!term) return;
  // 1) 아직 시작 확정 안 됨 → 코드 파티면 대기실, 없으면 모드 선택
  if(!PARTY.started){
    if(PARTY.pid){ PARTY.mode='together'; advPartyLobby(); return; }   // 코드 파티 대기실 복원
    if(ADV.inLobby){ advShowModeSelect(); return; }   // ★ 로비(모드 미선택) 상태면 껐다 켜도 로비 유지
    // ★ 재개 판정: 실제로 시작한 세션만(맵 시드 + runStart). 세션 종료·로비 복귀는 ADV.map을 null로 만들므로
    //   '맵 잔재로 자동 솔로 시작'(#7)은 여전히 일어나지 않는다.
    //   sessionMode가 없는 옛 세이브(예전 솔로 시작 경로에서 기록 안 됨)는 솔로로 보정 → 껐다 켜면 로비로 튕기던 문제 해결.
    else if(ADV.map && typeof ADV.map.seed==='number' && ADV.runStart){
      if(!ADV.sessionMode){ ADV.sessionMode='solo'; advSave(); }
      PARTY.mode=ADV.sessionMode; PARTY.started=true; }
    // ★ #7 수정: 예전엔 '맵만 있으면' 솔로로 간주해서, 모드를 고른 적이 없어도 이전 잔재 맵 때문에
    //   껐다 켜면 자동으로 솔로가 시작됐다. 이제 실제로 시작한 세션(advEnterRun에서 sessionMode/runStart 기록)만 재개한다.
    else { advShowModeSelect(); return; }
  }
  // 3) 그 외(진행 중 세션) → 전투 > 캠프 > 스토리 > 탐색 순 복원
  if(typeof ADV_COMBAT!=='undefined' && ADV_COMBAT){ advCombatRender(); return; }
  if(ADV.scene==='camp'){ const c=advCurrentCamp(); if(c){ advOpenCamp(c); return; }
    ADV.scene=''; advSave(); }   // ★ 캠프 잔재 정리: scene은 'camp'인데 실제 캠프 칸이 아니면 복원 불가 → 그냥 두면 advCanMoveNow가 계속 false(이동 영구 불가)
  // ★ 껐다 켜기 복구: 스토리 진행 중(ADV.story.beat)이면 그 씬을 복원한다.
  //   이걸 빼먹으면 스토리 화면은 사라지고 잠금만 남아 이동이 영구 차단됨(재개하려면 그 칸으로 '이동'해야 하는데 이동이 막혀 있어 탈출 불가).
  if(ADV.story && ADV.story.beat){
    const _m=advEnsureMap(); const _bi=ADV.story.bldg;
    if(_m && _m.buildings && typeof _bi==='number' && _m.buildings[_bi]){ advOpenStoryStub(_bi); return; }
    ADV.story=null; advSave();   // 복원 대상이 없으면(맵 재생성 등) 잠금 해제 — 갇히지 않게
  }
  advShowExplorePrompt(false);
}
function advOpenInv(){ if(advVisiting) return;
  if(ADV_LOCK.inv){ advLockedMsg(); return; }
  advRenderInv(); const w=document.getElementById('advInvWin'); if(w) w.classList.add('on'); }
function advOpenChar(){ if(advVisiting) return;
  if(ADV_LOCK.char){ advLockedMsg(); return; }
  editSlot=ADV.active; advRenderChar();
  const w=document.getElementById('advCharWin');
  const homeWin=document.getElementById('myHomeWin');
  if(w && homeWin && w.parentNode!==homeWin){ homeWin.appendChild(w); }   // 마이홈 창 전체를 덮도록 이동(시메지·폴더 가림)
  if(w) w.classList.add('on'); }
function advCloseWin(id){ const w=document.getElementById(id); if(w) w.classList.remove('on'); }
// 게임 창(시뮬·캐릭터세팅) 타이틀바 드래그 → 프로그램 창 이동 (마이홈 타이틀 드래그와 동일 방식)
function advBindWinDrag(bar){
  if(!bar || bar._advDragBound) return; bar._advDragBound=true; bar.style.cursor='move';
  let dragging=false, sx=0, sy=0, offX=0, offY=0, osMove=false;
  bar.addEventListener('pointerdown', e=>{
    if(e.target.closest && e.target.closest('.x, .adv-bgm-btn')) return;   // 닫기·BGM 버튼은 제외
    //   ★ #3 수정: BGM 버튼이 빠져 있어 스피커를 누르면 창 드래그가 시작되고 preventDefault+포인터캡처로 click이 아예 발생하지 않아 음소거가 안 됐음.
    dragging=true;
    const win=document.getElementById('myHomeWin');
    const launcherOn = !!(document.getElementById('launcher') && document.getElementById('launcher').classList.contains('on'));
    osMove = !!(launcherOn && window.companion && companion.moveWindow);   // 런처=OS창 이동 / 그 외=마이홈 창 DOM 이동
    if(osMove){ sx=e.screenX; sy=e.screenY; }
    else if(win){ const r=win.getBoundingClientRect(); offX=e.clientX-r.left; offY=e.clientY-r.top; win.style.transform='none'; win.style.left=r.left+'px'; win.style.top=r.top+'px'; }
    try{ bar.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });
  bar.addEventListener('pointermove', e=>{
    if(!dragging) return;
    if(osMove){ try{ companion.moveWindow(e.screenX-sx, e.screenY-sy); }catch(_){} sx=e.screenX; sy=e.screenY; return; }
    const win=document.getElementById('myHomeWin'); if(!win) return;
    win.style.left=(e.clientX-offX)+'px'; win.style.top=(e.clientY-offY)+'px';
    if(window._mhSyncBgmBounds) try{ window._mhSyncBgmBounds(); }catch(_){}
  });
  const end=e=>{ dragging=false; try{ bar.releasePointerCapture(e.pointerId); }catch(_){} };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}

/* ─────────────────────────── 이벤트 ─────────────────────────── */
function advBindEvents(){
  const el=id=>document.getElementById(id);

  { const si=el('advIconSim'); if(si) si.addEventListener('click', advOpenSim); }       // 숨겨져 있으면 노드가 없다
  { const ci=el('advIconChar'); if(ci) ci.addEventListener('click', advOpenChar); }
  el('advSimClose').addEventListener('click', advCloseSim);
  { const bb=el('advBgmBtn'); if(bb){ bb.addEventListener('click', advBgmToggle); advRenderBgmBtn(); } }
  el('advInvClose').addEventListener('click', ()=>advCloseWin('advInvWin'));
  el('advCharClose').addEventListener('click', ()=>advCloseWin('advCharWin'));
  advBindWinDrag(document.querySelector('#advSimWin .adv-titlebar'));    // 시뮬 창 드래그 = 프로그램 창 이동
  advBindWinDrag(document.querySelector('#advCharWin .adv-titlebar'));   // 캐릭터세팅 창 드래그 = 프로그램 창 이동
  el('advFriendClose').addEventListener('click', ()=>el('advFriendPop').classList.remove('on'));
  el('advMemberClose').addEventListener('click', ()=>el('advMemberPop').classList.remove('on'));

  el('advEnvBtn').addEventListener('click', e=>{ if(advVisiting) return; e.stopPropagation();
    const m=el('advEnvMenu');
    m.classList.toggle('on');
    if(!m.classList.contains('on')) m.querySelectorAll('.mhd-envsub.on').forEach(s=>s.classList.remove('on'));
    else MHD_ENV.forEach(mhdMarkEnv);   // 열 때 현재 선택값 갱신
  });
  document.addEventListener('click', e=>{
    const m=el('advEnvMenu');
    if(m&&m.classList.contains('on')&&!e.target.closest('#advEnvMenu,#advEnvBtn')){
      m.classList.remove('on');
      m.querySelectorAll('.mhd-envsub.on').forEach(s=>s.classList.remove('on'));
    }
    const fp=el('advFacePick');
    if(fp&&fp.classList.contains('on')&&!e.target.closest('#advFacePick,#advFaceBig')) fp.classList.remove('on');
  });
  el('advEnvColor').addEventListener('click', ()=>{ el('advEnvMenu').classList.remove('on'); el('advBgColorInput').click(); });
  el('advBgColorInput').addEventListener('input', e=>{ ADV.bg={color:e.target.value}; advSave(); advSaveBgRemote(); advApplyBg(); });
  el('advEnvFile').addEventListener('click', ()=>{
    el('advEnvMenu').classList.remove('on');
    advUploadImage('adv-bg', 960, 720, 0.82, url=>{ ADV.bg={img:url}; advSave(); advSaveBgRemote(); advApplyBg(); });
  });
  el('advEnvImg').addEventListener('click', ()=>{ el('advEnvMenu').classList.remove('on'); el('advUrlInput').value=(ADV.bg&&ADV.bg.img)||''; el('advUrlBox').classList.add('on'); el('advUrlInput').focus(); });
  el('advUrlOk').addEventListener('click', ()=>{ const v=el('advUrlInput').value.trim(); if(v){ ADV.bg={img:v}; advSave(); advSaveBgRemote(); advApplyBg(); } el('advUrlBox').classList.remove('on'); });
  el('advUrlCancel').addEventListener('click', ()=>el('advUrlBox').classList.remove('on'));
  el('advEnvReset').addEventListener('click', ()=>{ el('advEnvMenu').classList.remove('on'); ADV.bg=null; advSave(); advSaveBgRemote(); advApplyBg(); });

  el('advFName').addEventListener('input', e=>{ curSlot().name=e.target.value; advSave(); advRenderSlotTabs(); });
  el('advFAge').addEventListener('input', e=>{
    const sl=curSlot();
    let v=String(e.target.value).replace(/[^0-9]/g,'').slice(0,3);
    if(v!=='') v=String(Math.min(120, parseInt(v,10)));
    if(e.target.value!==v) e.target.value=v;
    const prevTier=ageTier(sl);
    sl.age=v;
    const newTier=ageTier(sl);
    if(newTier.mul!==prevTier.mul && slotSpent(sl)>0){   // ★ 나이대 계수가 바뀌고 이미 분배돼 있으면 자동 초기화(A)
      sl.alloc={str:0,agi:0,int:0,luk:0};
      advToast('나이대가 바뀌어 스탯 분배를 초기화했어요 ('+newTier.label+' 포인트 ×'+newTier.mul+')');
    }
    advSave(); advRenderChar();
  });
  el('advFPers').addEventListener('input', e=>{ curSlot().personality=e.target.value; advSave(); });

  const pick=el('advFacePick');
  // ★ 상태별 프로필 4칸 (a평상/b부상/c감염/d위중) — 각 칸 클릭 시 200×200 업로드
  const FACE_LABELS={a:'평상',b:'부상',c:'감염',d:'위중'};
  const faceSlotsWrap=h('<div class="adv-face-slots"></div>');
  function renderFaceSlots(){
    faceSlotsWrap.innerHTML='';
    const sl=curSlot(); const f=sl.faceImgs||(sl.faceImgs={a:null,b:null,c:null,d:null});
    ['a','b','c','d'].forEach(k=>{
      const cell=h('<div class="adv-fslot" title="'+FACE_LABELS[k]+' 상태 사진 (200×200)"><div class="box">'+
        (f[k]?'<img src="'+f[k]+'" alt="">':'＋')+'</div><span class="lb">'+FACE_LABELS[k]+'</span></div>');
      cell.addEventListener('click', ev=>{ ev.stopPropagation();
        const mySlot=editSlot, key=k;
        advUploadImage('adv-char'+mySlot+'-'+key, 200, 200, 0.82, url=>{
          ADV.slots[mySlot].faceImgs[key]=url; advSave(); renderFaceSlots(); advRenderChar(); });
      });
      faceSlotsWrap.appendChild(cell);
    });
  }
  renderFaceSlots();
  pick.appendChild(faceSlotsWrap);
  /* 🎗 유품 이미지 — 투명 PNG 20×20 리사이즈, 로컬 data URL 저장(사용량 0) */
  function advUploadKeepsake(onUrl){
    const fi=document.createElement('input'); fi.type='file'; fi.accept='image/png,image/*';
    fi.onchange=()=>{ const file=fi.files&&fi.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=e=>{ const img=new Image();
        img.onload=()=>{ const S=20, c=document.createElement('canvas'); c.width=S; c.height=S;
          const g=c.getContext('2d'); g.imageSmoothingEnabled=true; g.imageSmoothingQuality='medium';   // 살짝 부드럽게(깨짐 완화)
          const sc=Math.min(S/img.width, S/img.height), w=Math.round(img.width*sc), hh=Math.round(img.height*sc);
          g.drawImage(img, Math.floor((S-w)/2), Math.floor((S-hh)/2), w, hh);   // 비율 유지·중앙·투명 배경
          onUrl(c.toDataURL('image/png')); };   // PNG = 투명 보존
        img.src=e.target.result; };
      reader.readAsDataURL(file); };
    fi.click();
  }
  function renderKeepsake(){
    const sl=curSlot(), box=el('advKeepBox'), desc=el('advKeepDesc'); if(!box) return;
    box.innerHTML = sl.keepsake ? '<img src="'+sl.keepsake+'" alt="유품">' : '＋';
    box.title = sl.keepsake ? (sl.keepsakeDesc||'유품') : '유품 이미지 (클릭해서 등록 · 투명 PNG 20×20)';
    if(desc && desc.value!==(sl.keepsakeDesc||'')) desc.value=sl.keepsakeDesc||'';
  }
  { const box=el('advKeepBox'), desc=el('advKeepDesc'), pop=el('advKeepPop'), done=el('advKeepDone');
    if(box){
      box.addEventListener('click', ev=>{ ev.stopPropagation();
        advUploadKeepsake(url=>{ curSlot().keepsake=url; advSave(); renderKeepsake(); advRenderSim(); }); });
      box.addEventListener('contextmenu', ev=>{ ev.preventDefault(); ev.stopPropagation();   // 우클릭 = 설명 팝오버
        if(desc) desc.value=curSlot().keepsakeDesc||'';
        if(pop){ pop.style.display='flex'; if(desc) desc.focus(); } });
    }
    if(desc) desc.addEventListener('input', ev=>{ curSlot().keepsakeDesc=ev.target.value.slice(0,140); advSave(); renderKeepsake(); advRenderSim(); });
    if(done) done.addEventListener('click', ev=>{ ev.stopPropagation(); if(pop) pop.style.display='none'; });
    renderKeepsake();
  }
  // (이모지 선택 목록 제거 — 프로필은 사진 4칸으로만. 미등록 시 기본 얼굴은 setFaceEl 폴백)
  el('advFaceBig').addEventListener('click', e=>{ e.stopPropagation(); const opening=!pick.classList.contains('on'); if(opening) renderFaceSlots(); pick.classList.toggle('on'); });

  // #4 스탯 +/- : 클릭=1, 꾹 누르기=연속, 우클릭=5씩
  const _statBumpN=(k,d,n)=>{ const s=curSlot(); let did=false;
    for(let i=0;i<n;i++){
      if(d>0){ if(slotPointsLeft(s)>0){ s.alloc[k]=(s.alloc[k]||0)+1; did=true; } else break; }
      else    { if((s.alloc[k]||0)>0){ s.alloc[k]--; did=true; } else break; }
    }
    if(did){ advSave(); advRenderChar(); } return did; };
  let _statHoldT=null, _statHoldI=null;
  const _statHoldStop=()=>{ if(_statHoldT){ clearTimeout(_statHoldT); _statHoldT=null; } if(_statHoldI){ clearInterval(_statHoldI); _statHoldI=null; } };
  const cstats=el('advCharStats');
  cstats.addEventListener('mousedown', e=>{
    if(e.button!==0) return;   // 좌클릭만 (우클릭은 contextmenu에서)
    const b=e.target.closest('button[data-k]'); if(!b||b.disabled) return;
    const k=b.dataset.k, d=+b.dataset.d;
    _statBumpN(k,d,1);   // 즉시 1
    _statHoldStop();
    _statHoldT=setTimeout(()=>{ _statHoldI=setInterval(()=>{ if(!_statBumpN(k,d,1)) _statHoldStop(); }, 80); }, 350);   // 0.35s 후 연속
    e.preventDefault();
  });
  cstats.addEventListener('contextmenu', e=>{
    const b=e.target.closest('button[data-k]'); if(!b) return;
    e.preventDefault();
    _statBumpN(b.dataset.k, +b.dataset.d, 5);   // 우클릭 = 5씩
  });
  document.addEventListener('mouseup', _statHoldStop);
  cstats.addEventListener('mouseleave', _statHoldStop);
  el('advCharReset').addEventListener('click', ()=>{ curSlot().alloc={str:0,agi:0,int:0,luk:0}; advSave(); advRenderChar(); });
  el('advCharSelect').addEventListener('click', ()=>{ ADV.active=editSlot; advSave(); advRenderChar(); advToast('슬롯'+(editSlot+1)+' 캐릭터를 선택했어요'); });
}

/* ─────────────────────────── 관람 모드 훅 (app.js가 호출) ─────────────────────────── */
window._advApplyVisitUI = function(visiting, ownerId){
  advVisiting=!!visiting;
  // 🖥️ 방문 시작 → 집주인 바탕화면을 서버에서 받아와 적용 (내 집 복귀 시엔 초기화)
  if(advVisiting){
    advVisitBg = null;
    try{
      if(ownerId && window.firebaseAPI && firebaseAPI.getAdvBg){
        firebaseAPI.getAdvBg(ownerId).then(bg=>{
          console.log('[바탕화면] 방문 대상('+ownerId+') 배경:', bg||'(서버에 없음)');
          if(advVisiting){ advVisitBg = bg || null; advApplyBg(); }
        }).catch(()=>console.warn('[바탕화면] 방문 대상 배경 조회 실패'));
      } else console.warn('[바탕화면] 배경 조회 건너뜀 — ownerId:', ownerId, '/ getAdvBg 사용가능:', !!(window.firebaseAPI&&window.firebaseAPI.getAdvBg));
    }catch(_){}
  } else advVisitBg = null;
  const d=document.getElementById('advDesktop');
  if(d) d.classList.toggle('adv-visiting', advVisiting);
  const tb=document.getElementById('advEnvBtn');
  if(tb) tb.style.display=advVisiting?'none':'';
  mhdNotifyVisit(advVisiting);   // 🔌 외부 앱에 관람 모드 전환 통보(구독 해제 등은 각 게임이 알아서)
  if(advVisiting){
    ['advSimWin','advInvWin','advCharWin'].concat(MHD_WINS).forEach(advCloseWin);   // 🔌 외부 창도 같이 닫는다
    advTeardownParty();
    ['advEnvMenu','advUrlBox','advFacePick'].forEach(id=>{ const e=document.getElementById(id); if(e) e.classList.remove('on'); });
  }
  advApplyBg();
};

/* ─────────────────────────── 초기화 ─────────────────────────── */
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', advInit);
else advInit();

})();
