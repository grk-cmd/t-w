/* ============================================================ 🕰 미스테리au (mystery-au.js)
   미궁게임 + 추리 + TRPG. 마이홈 바탕화면 위에 폴더로 얹히는 독립 게임 파일.

   ★ 이 파일의 존재 이유 = 걷어낼 때 한 번에 걷어내기 위해서다.
     좀아칼은 게임과 바탕화면이 한 파일에 섞여 있어서 은퇴시킬 때 파일을 통째로 못 지웠고,
     지금도 약 4,000줄이 ADV_GAME_OFF 스위치 뒤에서 잠들어 있다.
     이 게임을 접을 때 할 일은 —
       1) HTML에서 <script src="parts/mystery-au.js"></script> 한 줄 삭제
       2) 이 파일 삭제
     myhome-desktop.js는 한 글자도 건드리지 않는다.
     (HTML의 firebaseAPI.uploadUserPng 는 범용 유틸이라 남겨도 무해하다)

   ★ 규칙
     · myhome-desktop.js를 직접 수정하지 않는다. 필요한 건 MYHOME_DESKTOP API로만 받는다.
     · 전역 이름은 전부 mys* / MYS_ / #mys… / .mys- 접두어.
     · 저장 키는 tw.mys.v1 (좀아칼의 tw.advZ.v2와 분리 — 지워도 바탕화면 설정은 무사)
     · Firebase는 mysGame/{pid} 등 새 경로만 쓴다.
     · CSS는 이 파일 안에서 <style id="mysStyle">로 주입한다.

   ★ 현재 단계
     · 사건일지 창 = 스텁 (의뢰 게시판 자리만)
     · 캐릭터 등록 창 = 동작함. 마이홈 캐릭터세팅을 이 세계관으로 옮겨 대체한 것.
       (myhome-desktop.js의 ADV_HIDE_CHAR=true 로 옛 캐릭터세팅 폴더는 숨겼다)

   ★ 스탯 설계 의도 — 능력의 등급이 아니라 '단서를 캐는 경로'다
     관찰(현장·사물) / 감식(문서·암호 해독) / 심문(사람) / 잠행(닫힌 곳).
     경로로 나눠야 사건 하나가 네 종류의 단서를 품고, 파티원이 각자 다른 걸 들고 와
     맞춰봐야 풀린다(설계 문서 5절 "정보 비대칭"). "관찰력·논리력" 식으로 나누면
     결국 다 '머리가 좋다'의 변주라서 한 스탯 몰빵이 전부를 해결해 버린다.
     ⚠ 그러므로 사건일지 데이터의 모든 단서에는 반드시 경로 태그가 붙어야 한다.
        태그 없이 만들면 특정 스탯이 죽은 스탯이 된다.
     운은 넣지 않았다. 넷 다 이미 주사위라 이중 계산이고, 답을 못 맞힌 원인이 운이면
     화가 난다는 게 설계 원칙이다. 대실패 완충은 스탯이 아니라 소모품으로 준다.

   ★ 아카이브에서 이식할 것 — adventure-zombie-ARCHIVE.js (핸드오프 7절 색인)
     주사위 판정(advD20/advTierRoll/advRollTag/advGradeLabel), 터미널·선택지 UI(advPrompt),
     아이템·툴팁(단서 목록으로 전용), 파티 인프라(2인 실기기 검증 완료).
     ⚠ 이름만 mys*로 바꿔 옮기되 로직은 건드리지 말 것.
   ============================================================ */
(function(){
'use strict';

/* ─────────────────────────── 데스크톱 접점 ───────────────────────────
   로드 순서에 상관없이 안전하다. 콜백은 #advDesktop이 만들어진 뒤에만 불린다. */
function mhdReady(fn){
  if(window.MYHOME_DESKTOP) window.MYHOME_DESKTOP.onReady(fn);
  else (window._MHD_PENDING = window._MHD_PENDING || []).push(fn);
}
let D = null;   // MYHOME_DESKTOP 핸들 (onReady에서 채움)

/* ─────────────────────────── 상수 ─────────────────────────── */
const MYS_KEY     = 'tw.mys.v1';
const MYS_WIN     = 'mysWin';        // 사건일지 창
const MYS_AGENTWIN= 'mysAgentWin';   // 캐릭터 등록 창
const MYS_TITLE   = '미스테리au';
const MYS_SLOTS   = 3;               // 요원 슬롯 수

/* 스탠딩 표정 — 빈 칸은 전부 '평상'으로 대체된다(필수 아님).
   ★ 키는 영문 고정. 나중에 스크립트에서 mysSetExpression('think') 처럼 지정하는데,
     한글 키로 두면 사건일지 데이터에 한글이 섞여 오타를 잡기 어려워진다. */
const STAND_KEYS = ['normal','talk','think','smile','angry','sad','fluster','surprise'];
const STAND_LABEL= { normal:'평상', talk:'대화', think:'고민', smile:'웃음',
                     angry:'분노', sad:'슬픔', fluster:'당황', surprise:'놀람' };
const STAND_W = 200, STAND_H = 600;   // 저장 최대 크기(비율 유지 · 표시는 창에 맞춰 축소)
const PHOTO_W = 300, PHOTO_H = 400;   // 증명사진 3:4
/* 서버에 못 올려 이 기기에 남길 때의 한 장 목표 용량(글자 수).
   ★ localStorage 는 글자당 2바이트로 세고 한도가 약 5MB 다 — PNG 한 장이 500K자면 1MB를 먹고,
     표정 여덟 장이면 그 자리에서 한도를 넘긴다("등록은 됐는데 껐다 켜니 없다"의 실제 경로).
     이 선을 넘으면 알파가 살아 있는 WebP 로 다시 뽑아 본다(대개 1/3~1/5). */
const MYS_IMG_SOFT_MAX = 400 * 1024;

/* 현장 지도 한 칸의 픽셀. ★ MYS_CSS 가 이 값을 템플릿으로 쓰므로 반드시 CSS보다 위에 있어야 한다.
   아래로 내리면 문법은 멀쩡한데 로드 시 TDZ 로 죽고, 앱이 통째로 안 켜진다(audit 검사11). */
const MYS_CELL = 20;   // 24칸 × 20 = 480px — 마이홈 창 760px 안에 우측 패널까지 들어간다
/* 스탠딩 높이(px). ★ 발끝은 스크립트 박스 윗변에 붙는다(CSS 의 bottom:100%) —
   무대 바닥에 매달아 두면 스크립트가 아래에 내려앉은 만큼 사람만 허공에 뜬다.
   ⚠ 여기를 키우면 머리가 위로 자란다. 창이 낮으면 .mys-main 이 잘라낸다. */
const MYS_STAND_H = 280;

/* 글자 크기 — 바탕화면 '환경 설정 ▸ 글자 크기'에서 고른다.
   ★ 창 안의 글자 크기는 전부 이 값에 대한 em이다(아래 CSS). px로 박아두면
     여기서 아무리 바꿔도 그 요소만 안 따라와서 결국 다시 훑어야 한다.
     단, 스탠딩·증명사진 칸의 크기는 px 고정 — 글자 따라 커지면 레이아웃이 무너진다. */
const FONT_SIZES = [ {value:12, label:'작게'}, {value:13, label:'보통'},
                     {value:15, label:'크게'}, {value:17, label:'아주 크게'} ];
const FONT_DEFAULT = 13;

/* 브금 볼륨 단계. ★ 0 = 끄기. 켜기/끄기를 따로 두면 두 값이 어긋나 "껐는데 소리가 난다"가 생긴다. */
const BGM_LEVELS = [ {value:0, label:'끄기'}, {value:15, label:'작게'},
                     {value:35, label:'보통'}, {value:60, label:'크게'} ];

/* 적성 — 단서를 캐는 경로 */
const STAT_KEYS  = ['obsv','anly','intr','infl'];
const STAT_LABEL = { obsv:'관찰', anly:'감식', intr:'심문', infl:'잠행' };
const STAT_CODE  = { obsv:'OBSV', anly:'ANLY', intr:'INTR', infl:'INFL' };
const STAT_DESC  = { obsv:'현장·사물', anly:'문서·암호', intr:'사람', infl:'닫힌 곳' };

/* 나이대 — ★ 표시 라벨 전용. 수치에는 일절 관여하지 않는다.
   예전엔 나이대 계수(mul)로 총 포인트를 깎았으나 제거했다.
   나이는 설정이지 능력이 아니고, 계수가 있으면 '유리한 나이'가 생겨
   성명·성향처럼 자유롭게 정해야 할 항목이 최적화 대상이 되어버린다.
   ⚠ 여기에 mul 같은 수치 필드를 다시 넣지 말 것. 넣는 순간 그게 되살아난다. */
const AGE_TIERS = [
  { max:12,  label:'어린이' },
  { max:17,  label:'청소년' },
  { max:59,  label:'성인'   },
  { max:999, label:'노인'   },
];

/* 등급 — 분배한 적성 총합으로 결정된다(잔여 포인트가 아니라 '채운 양').
   집중 레벨이 올라 총 포인트가 늘어야 위 등급에 닿으므로, 등급이 곧 요원의 연차가 된다.
   ⚠ 위에서부터 훑어 처음 걸리는 칸을 쓴다. 순서를 바꾸면 판정이 뒤집힌다. */
const RANKS = [ {max:10,  name:'F급 요원'},
                {max:20,  name:'C급 요원'},
                {max:30,  name:'B급 요원'},
                {max:44,  name:'A급 요원'},   // 31~44
                {max:49,  name:'S급 요원'},   // 45~49
                {max:Infinity, name:'SS급 요원'} ];   // 50(최대) 도달

/* 오염도 → 증명사진을 위에서부터 덮는 검은 그라데이션의 길이(%).
   단계로 끊는다 — 연속으로 늘리면 변화가 눈에 안 띄어서 '침식되고 있다'는 느낌이 안 산다. */
const TAINT_TIERS = [ {min:100, veil:74}, {min:80, veil:62}, {min:60, veil:49},
                      {min:40, veil:36}, {min:20, veil:22}, {min:0, veil:0} ];

/* 스탠딩용은 값을 따로 둔다.
   같은 %라도 잘라내는 대상이 달라서 보이는 정도가 완전히 다르다 —
   증명사진은 얼굴만 담겨 있어 74%면 얼굴이 거의 다 먹히지만,
   전신 스탠딩에서 74%는 다리만 남아 사람이 사라진 것처럼 보인다.
   머리에서 시작해 최대치에서 허리 언저리까지 내려오는 정도로 잡았다. */
const TAINT_TIERS_STAND = [ {min:100, veil:50}, {min:80, veil:42}, {min:60, veil:33},
                            {min:40, veil:24}, {min:20, veil:15}, {min:0, veil:0} ];

/* ─────────────────────────── 상태 ───────────────────────────
   ⚠ 좀아칼 함정 #1: 상태에 새 필드를 추가하면 로더에도 반드시 넣을 것.
   그래서 '기본값에 얹는' 방식으로 짠다 — 필드를 늘려도 로더가 자동으로 따라온다. */
function blankAgent(){
  return { name:'', age:'', trait:'', photo:null,
           stand:{ normal:null, talk:null, think:null, smile:null,
                   angry:null, sad:null, fluster:null, surprise:null },
           alloc:{ obsv:0, anly:0, intr:0, infl:0 },
           taint:0,            // 오염도는 요원마다 따로 쌓인다(설계 문서 3절)
           suspended:false,    // 사건 상한(튜토리얼 90) 도달 — 교대 필요
           lost:false };       // 오염도 100 — 본부 정화 전까지 사용 불가
}
const MYS_DEFAULT = {
  v:1, active:0, agents:null,
  fontSize:FONT_DEFAULT,
  bgmOn:true, bgmVol:35,   // 브금 — 바탕화면 '환경 설정 ▸ 브금'에서 고른다
  /* 음소거 버튼이 끄기 전에 듣던 볼륨. ★ 여기 기본값이 없으면 로더가 안 따라오고,
     처음 켠 사람이 음소거를 해제할 때 볼륨이 0에서 안 올라온다(v2 함정 #1). */
  bgmLast:35,
  /* 소속은 요원마다가 아니라 계정 전체가 공유한다 — 같은 지부 소속이라는 설정이므로 */
  post:{ planet:'', universe:'', country:'' },
  cleared:[],      // 클리어한 사건일지 id — 파티 매칭 시 대조
  /* 착수 브리핑을 끝까지 본 사건 id. ★ 이게 있어야 2회차부터 [건너뛰기]가 뜬다 —
     처음 듣는 사람에게는 안 뜬다(튜토리얼 브리핑에 오염도 경고가 들어 있다).
     ⚠ 끝까지 본 순간에만 적는다. 착수하자마자 적으면 두 줄 읽고 접은 사람에게도
       다음 착수에 건너뛰기가 뜨고, 그러면 경고를 영영 안 듣는다. */
  briefed:{},
  fragments:0,     // 암거래 조직 단서 조각
  migrated:false,  // 캐릭터세팅에서 1회 이관했는가
  taintReset:false,// 연출 확인용으로 올려둔 오염도를 1회 정리했는가
  purifier:false,  // 정화 시스템 보유 — CASE-001 클리어 보상. 이게 있어야 레벨업 회복이 돈다
  /* 진행 중인 사건 현장. null = 착수 전.
     ★ 여기에 필드를 늘릴 때도 이 객체(또는 mysNewField)에 기본값을 넣을 것 —
       그러면 로더가 자동으로 따라온다(v2 함정 #1 구조적 차단). */
  field:null,
  /* ★ 확정된 파티는 창을 닫아도, 다시 켜도 유지된다. 그래서 코드가 저장에 남는다.
     ⚠ 남의 위치·이름은 저장하지 않는다 — 다음에 열었을 때 없는 사람이 지도에 서 있게 된다.
       살아 있는 사람은 재합류 후 하트비트로 다시 채워진다. */
  party:null,      // { code, locked }
  /* 마지막으로 본 집중 레벨. ⚠ 저장 안 하면 창을 열 때마다 오염도 −30이 반복된다. */
  lastFocus:null
};
let MYS = null;
/* 마지막 저장이 거절됐는가. 등록 화면이 이 값을 보고 경고 줄을 띄운다 —
   토스트는 2초면 사라져서 놓치면 그만이고, 그러면 안 저장되는 채로 계속 등록한다. */
let mysSaveWarned = false;

function normAgents(list){
  const out=[];
  for(let i=0;i<MYS_SLOTS;i++){
    const a=Object.assign(blankAgent(), (list&&list[i])||{});
    a.stand=Object.assign(blankAgent().stand, a.stand||{});
    a.alloc=Object.assign(blankAgent().alloc, a.alloc||{});
    out.push(a);
  }
  return out;
}
function mysLoad(){
  let raw=null;
  try{ raw=localStorage.getItem(MYS_KEY); }catch(_){}
  try{ MYS=Object.assign({}, MYS_DEFAULT, raw?JSON.parse(raw):{}); }
  catch(_){ MYS=Object.assign({}, MYS_DEFAULT); }
  mysLogsLoad();                 // 진행 중이던 사건의 대화 기록을 도로 채운다
  MYS.agents=normAgents(MYS.agents);
  MYS.post=Object.assign({planet:'',universe:'',country:''}, MYS.post||{});
  /* ⚠ 사본을 뜬다. Object.assign 은 얕은 복사라 그냥 두면 MYS.briefed 가
     MYS_DEFAULT.briefed **그 객체**를 가리키고, 적는 순간 기본값이 오염된다. */
  MYS.briefed=Object.assign({}, MYS.briefed||{});
  MYS.active=Math.max(0, Math.min(MYS_SLOTS-1, MYS.active|0));
  /* ★ 옛 저장 보정 — 본 저장 안에 dataURL 로 박혀 있던 그림을 제 칸으로 옮긴다.
     이게 있어야 이미 그렇게 저장된 사람의 본 저장이 가벼워지고, 다음 저장이 거절되지 않는다.
     ⚠ 옮기다 실패하면 그 그림만 버린다(null). 본 저장까지 같이 죽는 것보다 낫다. */
  /* ⚠ 한 장 옮길 때마다 곧바로 저장한다. 모아서 한 번에 저장하면 옮기는 동안
       같은 그림이 본 저장과 제 칸에 두 벌로 앉아 있게 되고, 그 두 배가 한도를 넘긴다.
       한 장씩 저장하면 본 저장이 그때그때 가벼워져 다음 장의 자리를 만들어 준다.
     ⚠ 못 옮긴 그림은 **원본을 그대로 둔다.** 예전에는 null 로 버리고 저장까지 해서,
       용량이 빠듯한 기기에서는 켤 때마다 스탠딩이 영구히 지워졌다
       ("껐다 켜면 스탠딩이 없다"의 진짜 경로다). 무거운 채로 남는 편이 낫다. */
  let _moved=0, _stuck=0;
  const _move=(get,set,slot,name)=>{
    const v=get();
    if(typeof v!=='string' || v.indexOf('data:')!==0) return;
    const ref=mysImgPut(slot,name,v);
    if(ref && mysImgSaved(ref)){ set(ref); _moved++; mysSave(); }
    else { mysImgDrop(ref); _stuck++; }              // 원본은 건드리지 않는다
  };
  MYS.agents.forEach((a,i)=>{
    Object.keys(a.stand||{}).forEach(k=>_move(()=>a.stand[k], v=>{ a.stand[k]=v; }, i, 'stand_'+k));
    _move(()=>a.photo, v=>{ a.photo=v; }, i, 'photo');
  });
  if(_moved) console.log('[미스테리au] 그림 '+_moved+'장을 본 저장 밖으로 옮겼습니다');
  if(_stuck){
    console.warn('[미스테리au] 그림 '+_stuck+'장을 옮기지 못했습니다 — 저장 공간 부족');
    mysToast('저장 공간이 부족해요 — 스탠딩 '+_stuck+'장이 위태롭습니다');
  }
  /* 표만 남고 그림은 없는 칸을 정리한다 — 그대로 두면 '등록됨'으로 보이면서 안 뜬다 */
  mysImgCheckRefs();
  if(!MYS.migrated) mysMigrateFromChar();
  /* 침식 연출을 확인하려고 손으로 올려둔 오염도를 1회 되돌린다.
     아직 오염도가 오를 사건이 없으므로 남아 있는 값은 전부 시험용이다.
     플래그를 두는 이유 — 이게 없으면 나중에 실제로 쌓인 오염도까지 매번 0으로 지워버린다. */
  if(!MYS.taintReset){
    MYS.taintReset=true;
    MYS.agents.forEach(a=>{ a.taint=0; });
    mysSave();
  }
}
/* 저장이 통째로 실패하면 그 판의 모든 변화가 사라진다 — 이름도, 단서도, 진행도.
   ★ 실패는 거의 언제나 스탠딩 dataURL 때문이다. 서버 업로드가 안 되면 그림 한 장이
     수백 KB 짜리 문자열로 저장에 들어가고, localStorage 한도(약 5MB)를 그림 몇 장이 넘긴다.
     그런데 브라우저는 '이 항목만' 거절하지 않는다 — setItem 전체가 거절된다.
     그래서 "스탠딩을 등록했는데 껐다 켜니 통째로 사라졌다"가 된다.
   ⚠ 조용히 넘어가지 말 것. 실패한 판이 무엇이었는지 모른 채 계속 플레이하면
     그 뒤로 쌓은 것도 전부 같이 날아간다. */
function mysSave(){
  try{ localStorage.setItem(MYS_KEY, JSON.stringify(MYS)); mysSaveWarned=false; }
  catch(e){
    console.warn('[미스테리au] 저장 실패', e);
    /* 어느 요원의 어느 표정이 서버에 못 올라갔는지 짚어준다 — '용량 부족'만 뜨면
       무엇을 지워야 할지 알 수가 없다. */
    mysToast('저장 공간이 부족해요 — 저장하지 못했습니다');
    mysSaveWarned=true;
  }
}

/* 캐릭터세팅(tw.advZ.v2)에서 1회 이관 — 이름·나이·성격·프로필만.
   스탯은 좀비 전투용이라 가져오지 않는다(경로 기반 적성과 의미가 다름). */
function mysMigrateFromChar(){
  MYS.migrated=true;
  let old=null;
  try{ old=JSON.parse(localStorage.getItem('tw.advZ.v2')||'null'); }catch(_){}
  if(!old || !Array.isArray(old.slots)) return;
  let moved=0;
  for(let i=0;i<MYS_SLOTS && i<old.slots.length;i++){
    const s=old.slots[i]; if(!s) continue;
    const a=MYS.agents[i];
    if(!a.name && s.name){ a.name=String(s.name).slice(0,12); moved++; }
    if(!a.age && s.age) a.age=s.age;
    if(!a.trait && s.personality) a.trait=String(s.personality).slice(0,20);
    if(!a.photo){ const f=s.faceImgs||{}; a.photo = f.a || s.faceImg || null; }
  }
  mysSave();
  if(moved) console.log('[미스테리au] 캐릭터세팅에서 요원 '+moved+'명 이관');
}

/* ─────────────────────────── 헬퍼 ─────────────────────────── */
function mysEsc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function el(id){ return document.getElementById(id); }
function h(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }
function mysToast(m){ try{ if(typeof toast==='function') toast(m); else console.log('[미스테리au]', m); }catch(_){} }
function myUid(){ try{ return (typeof getMyUserId==='function') ? getMyUserId() : null; }catch(_){ return null; } }
function focusLevel(){ try{ if(typeof getFocusLevel==='function') return getFocusLevel(); }catch(_){} return 1; }

function agent(i){ return MYS.agents[(i==null?MYS.active:i)]; }
function ageNum(a){ const n=parseInt(String((a&&a.age)||''),10); return isNaN(n)?18:Math.max(0,Math.min(120,n)); }
function ageTier(a){ const n=ageNum(a); return AGE_TIERS.find(t=>n<=t.max) || AGE_TIERS[2]; }
/* 총 포인트 = 집중 레벨만으로 결정된다(나이 무관). 인자 a는 호출부 호환을 위해 남겨둔다. */
function totalPoints(a){ return Math.min(50, 10 + Math.floor(focusLevel()/5)); }
function spent(a){ return STAT_KEYS.reduce((n,k)=>n+(a.alloc[k]||0), 0); }
function pointsLeft(a){ return Math.max(0, totalPoints(a)-spent(a)); }
function rankName(a){ const n=spent(a||agent()); return (RANKS.find(r=>n<=r.max)||RANKS[RANKS.length-1]).name; }
function taintOf(a){ return Math.max(0, Math.min(100, (a&&a.taint)|0)); }
function taintVeil(a){ const t=taintOf(a);
  return (TAINT_TIERS.find(x=>t>=x.min)||TAINT_TIERS[TAINT_TIERS.length-1]).veil; }
function taintVeilStand(a){ const t=taintOf(a);
  return (TAINT_TIERS_STAND.find(x=>t>=x.min)||TAINT_TIERS_STAND[TAINT_TIERS_STAND.length-1]).veil; }
/* 소속 표시 — 안 채운 칸은 [ ]로 남겨 '아직 배정 안 됨'이 드러나게 한다 */
function postBlank(v){ const t=String(v||'').trim(); return t ? mysEsc(t) : '<span style="color:#5a6d94">[ ]</span>'; }
function postText(){
  const p=MYS.post||{};
  const j=(v,d)=>{ const t=String(v||'').trim(); return t||d; };
  return '제'+j(p.planet,'?')+'행성 제'+j(p.universe,'?')+'우주 수사국 · '+j(p.country,'?')+' 지부';
}
function agentFilled(a){ return !!(a && (a.name || a.photo || a.stand.normal || spent(a)>0)); }


/* ★ 스탠딩 조회 — 빈 칸은 평상으로 대체한다(필수 아님).
   나중에 대화·스크립트에서 표정을 바꿀 때도 전부 이 함수를 통과시킬 것.
   ⚠ 좀아칼 함정 #5: 진입 경로를 여러 군데로 복사하면 한쪽만 고쳐져 버그가 난다. */
/* ── 그림 보관소 ─────────────────────────────────────────────────────
   ★ 스탠딩·증명사진은 **본 저장(tw.mys.v1) 안에 넣지 않는다.** 제 칸을 따로 쓴다.
     서버에 못 올라간 그림은 dataURL(수백 KB 문자열)로 떨어지는데, 그게 본 저장에 섞이면
     localStorage 한도를 넘기는 순간 브라우저가 **저장 전체를 거절한다** — 그림만 못 쓰는 게
     아니라 이름·적성·진행까지 그 판이 통째로 사라진다.
     ("등록은 잘 되는데 껐다 켜면 스탠딩이 없다"가 정확히 이 증상이다.)
   ★ 본 저장에는 짧은 표만 남는다 — 서버 URL 이면 그대로, 로컬이면 'local:<칸이름>'.
   ⚠ 렌더마다 localStorage 를 읽지 않는다. 한 번 읽은 것은 메모리에 쥐고 있는다 —
     수백 KB 문자열을 지도 갱신마다 다시 읽으면 화면이 눈에 띄게 굼떠진다. */
const MYS_IMG_PREFIX = 'tw.mys.img.';
const mysImgCache = {};
/* 저장소에 못 들어가고 이번 판 메모리로만 들고 있는 그림.
   ★ 이걸 구분하지 않으면 "화면에는 보이는데 껐다 켜면 없다"가 조용히 일어난다.
     화면에 보이는 것과 저장된 것이 같다고 믿게 두면 안 된다. */
const mysImgWeak = {};
function mysImgGet(ref){
  if(typeof ref!=='string' || !ref) return null;
  if(ref.indexOf('local:')!==0) return ref;            // 서버 URL 은 그대로 쓴다
  const k=ref.slice(6);
  if(k in mysImgCache) return mysImgCache[k];
  let v=null; try{ v=localStorage.getItem(k); }catch(_){}
  mysImgCache[k]=v;
  return v;
}
/* 이 참조가 '다음에 켜도 남아 있는가'. 서버 URL 이면 언제나 참이다. */
function mysImgSaved(ref){
  if(typeof ref!=='string' || !ref) return false;
  if(ref.indexOf('local:')!==0) return true;
  return !mysImgWeak[ref.slice(6)];
}
function mysImgWrite(k, url){
  try{ localStorage.setItem(k, url); return true; }
  catch(e){ try{ localStorage.removeItem(k); }catch(_){} return false; }
}
/* 어느 요원도 안 쓰는 그림 칸을 치운다 — 덮어쓰기·삭제가 어긋나 남은 고아들이다.
   ⚠ 자리가 없어 저장이 거절될 때 가장 먼저 해볼 일이고, 지워도 잃는 것이 없다. */
function mysImgGC(){
  let keys=[];
  try{ for(let i=0;i<(localStorage.length|0);i++){ const k=localStorage.key(i);
        if(k && k.indexOf(MYS_IMG_PREFIX)===0) keys.push(k); } }catch(_){}
  if(!keys.length) return 0;
  const live={};
  ((MYS&&MYS.agents)||[]).forEach(a=>{
    Object.keys((a&&a.stand)||{}).forEach(k=>{ const v=a.stand[k];
      if(typeof v==='string' && v.indexOf('local:')===0) live[v.slice(6)]=1; });
    if(typeof (a&&a.photo)==='string' && a.photo.indexOf('local:')===0) live[a.photo.slice(6)]=1;
  });
  let n=0;
  keys.forEach(k=>{ if(live[k]) return;
    try{ localStorage.removeItem(k); }catch(_){} delete mysImgCache[k]; delete mysImgWeak[k]; n++; });
  if(n) console.log('[미스테리au] 쓰지 않는 그림 '+n+'장을 치웠습니다');
  return n;
}
/* 그림 한 장을 제 칸에 넣는다. 서버 URL 이면 넣을 것도 없이 그대로 돌려준다.
   ★ 자리가 없으면 고아를 치우고 한 번 더 해본다.
   ⚠ 그래도 안 들어가면 **참조는 돌려준다.** 예전에는 null 을 돌려줘서 등록한 그림이
     그 자리에서 사라졌다. 지금은 이번 판에서는 보이고, 저장이 안 됐다는 사실은
     mysImgSaved 로 드러난다 — 부르는 쪽이 그걸 보고 사람에게 말해준다. */
function mysImgPut(slot, name, url){
  if(typeof url!=='string' || url.indexOf('data:')!==0) return url || null;
  const k=MYS_IMG_PREFIX+slot+'.'+name;
  let ok=mysImgWrite(k, url);
  if(!ok && mysImgGC()) ok=mysImgWrite(k, url);
  mysImgCache[k]=url;
  if(ok) delete mysImgWeak[k];
  else { mysImgWeak[k]=1; console.warn('[미스테리au] 그림 저장 실패 — 저장 공간 부족', k); }
  return 'local:'+k;
}
function mysImgDrop(ref){
  if(typeof ref!=='string' || ref.indexOf('local:')!==0) return;
  const k=ref.slice(6);
  try{ localStorage.removeItem(k); }catch(_){}
  delete mysImgCache[k]; delete mysImgWeak[k];
}
/* 전체 초기화가 그림 칸까지 치운다 — 안 치우면 지운 요원의 그림이 저장소에 영영 남는다 */
function mysImgClearAll(){
  let keys=[];
  try{ for(let i=0;i<(localStorage.length|0);i++){ const k=localStorage.key(i);
        if(k && k.indexOf(MYS_IMG_PREFIX)===0) keys.push(k); } }catch(_){}
  keys.forEach(k=>{ try{ localStorage.removeItem(k); }catch(_){} delete mysImgCache[k]; delete mysImgWeak[k]; });
}
/* ── 끊어진 참조 청소 ────────────────────────────────────────────────
   본 저장에는 'local:…' 표가 남았는데 그 칸이 비어 있는 경우다(용량 초과로 못 들어갔거나,
   저장소가 통째로 비워졌거나). 표를 그대로 두면 등록칸이 '등록됨'으로 보이면서 그림만 안 뜨고,
   사람은 무엇을 다시 등록해야 하는지 알 수 없다. 표를 지우고 몇 장이 사라졌는지 말해준다. */
function mysImgCheckRefs(){
  let lost=0;
  (MYS.agents||[]).forEach(a=>{
    Object.keys(a.stand||{}).forEach(k=>{
      const v=a.stand[k];
      if(typeof v==='string' && v.indexOf('local:')===0 && !mysImgGet(v)){ a.stand[k]=null; lost++; }
    });
    if(typeof a.photo==='string' && a.photo.indexOf('local:')===0 && !mysImgGet(a.photo)){ a.photo=null; lost++; }
  });
  if(lost){
    mysSave();
    console.warn('[미스테리au] 저장소에서 사라진 그림 '+lost+'장의 표를 정리했습니다');
    mysToast('스탠딩 '+lost+'장이 저장되어 있지 않았어요 — 다시 등록해 주세요');
  }
  return lost;
}
/* ── 서버로 옮기기 ───────────────────────────────────────────────────
   ★ 이 기기에만 있는 그림(local:)을 서버에 올려 URL 로 바꾼다. 두 가지를 동시에 푼다.
     · 저장 공간 — 수백 KB 짜리 문자열이 localStorage 에서 빠져나간다(껐다 켜도 안 사라진다)
     · 파티 — 파티원에게 보낼 수 있는 것은 **서버 URL 뿐이다.** dataURL 은 전송 상한(4096자)을
       넘겨 거부되고, 상한을 올려도 말할 때마다 수백 KB가 오간다
   ⚠ firebase 를 직접 부르지 않는다. 접점은 마이홈이 내주는 firebaseAPI 하나다.
   ⚠ 한 장씩 차례로 올린다. 한꺼번에 던지면 실패가 뭉텅이로 나고 무엇이 올라갔는지 알 수 없다. */
let mysImgSyncing = false;
async function mysImgSync(){
  if(mysImgSyncing || !MYS) return 0;
  const uid = myUid();
  if(!uid || !window.firebaseAPI || !firebaseAPI.uploadUserPng) return 0;
  mysImgSyncing = true;
  let done=0;
  try{
    for(let i=0;i<(MYS.agents||[]).length;i++){
      const a=MYS.agents[i]; if(!a) continue;
      const jobs=Object.keys(a.stand||{}).map(k=>({ get:()=>a.stand[k], set:v=>{ a.stand[k]=v; },
                                                    key:'mysStand'+i+'_'+k }));
      jobs.push({ get:()=>a.photo, set:v=>{ a.photo=v; }, key:'mysPhoto'+i });
      for(const job of jobs){
        const ref=job.get();
        if(typeof ref!=='string' || ref.indexOf('local:')!==0) continue;
        const data=mysImgGet(ref); if(!data) continue;
        let res=null;
        try{ res=await firebaseAPI.uploadUserPng(uid, job.key, data); }catch(_){ res=null; }
        if(!res || !res.ok || !res.url) return done;    // 오프라인 등 — 다음 기회에 다시 한다
        job.set(res.url); mysImgDrop(ref); mysSave(); done++;
      }
    }
  } finally { mysImgSyncing=false; }
  if(done){
    console.log('[미스테리au] 그림 '+done+'장을 서버로 옮겼습니다 — 파티원에게도 보입니다');
    mysNetSendFace();
    mysRender();
  }
  return done;
}
/* ── 스탠딩 고르기 ──────────────────────────────────────────────────
   ★ 순서: 그 표정 → 평상 → **증명사진**. 스탠딩을 한 장도 안 그린 사람이
     장면마다 빈 자리로 남는 것보다, 얼굴 한 장이라도 서 있는 편이 낫다.
     (스탠딩은 그리는 데 품이 많이 든다. 증명사진은 대개 이미 있다.)
   ★ 증명사진인지 아닌지를 같이 돌려준다 — 화면이 비율을 달리 잡아야 한다.
     3:4 사진을 스탠딩처럼 바닥에 세우면 잘린 그림처럼 보인다.
   ⚠ 진입 경로는 여기 하나다. 부르는 자리마다 폴백을 따로 쓰면 반드시 한 군데가 빠진다. */
function standPick(key, i){
  const a=agent(i); if(!a) return null;
  const u = mysImgGet(a.stand[key]) || mysImgGet(a.stand.normal);
  if(u) return { url:u, photo:false };
  const p = mysImgGet(a.photo);
  return p ? { url:p, photo:true } : null;
}
function standUrl(key, i){ const s=standPick(key, i); return s ? s.url : null; }

/* ── 등록 창 안내 ────────────────────────────────────────────────────
   ⚠ 등록 창은 마이홈 전체를 덮는다. 그래서 여기서 mysToast 를 쓰면 안내가 창 뒤로 가려
     사람 눈에 **한 글자도 안 닿는다.** 업로드 실패도, 저장 공간 부족도 그렇게 조용히 지나갔고,
     그 결과가 "등록은 잘 됐는데 재부팅하면 스탠딩이 없다" 였다.
   ★ 창이 떠 있으면 창 안(regMsg)으로, 아니면 토스트로. 진입 경로는 이 함수 하나다. */
function mysRegSay(text, warn){
  if(el('mysMsg')) regMsg(text, !!warn);
  else mysToast(text);
}
/* 표는 남았는데 '다음에 켜면 없을' 그림이 몇 장인가.
   ★ 토스트는 3초면 사라진다 — 놓치면 그만이다. 이 수를 등록 창에 계속 띄워 둔다. */
function mysImgWeakCount(){
  let n=0;
  ((MYS&&MYS.agents)||[]).forEach(a=>{
    if(!a) return;
    Object.keys(a.stand||{}).forEach(k=>{ if(a.stand[k] && !mysImgSaved(a.stand[k])) n++; });
    if(a.photo && !mysImgSaved(a.photo)) n++;
  });
  return n;
}

/* ─────────────────────────── 이미지 업로드 ───────────────────────────
   ★ 반드시 PNG로 저장한다. canvas는 기본이 투명이므로 배경을 칠하지 않으면 알파가 살아남는다.
     JPEG로 뽑으면(=기존 advUploadImage 방식) 투명 부분이 검게 죽는다.
   ★ 업로드 경로도 .png 여야 한다 — firebaseAPI.uploadUserImage 는 .jpg로 저장하므로 쓰면 안 된다. */
function mysUploadPng(key, maxW, maxH, onUrl){
  if(D && D.isVisiting()) return;
  try{ if(window.companion && companion.dsHold) companion.dsHold(); }catch(_){}
  const fi=document.createElement('input');
  fi.type='file'; fi.accept='image/png,image/webp,image/*';
  fi.onchange=()=>{
    const file=fi.files&&fi.files[0]; if(!file) return;
    const rd=new FileReader();
    rd.onload=ev=>{
      const img=new Image();
      img.onload=async()=>{
        const sc=Math.min(1, maxW/img.width, maxH/img.height);   // 확대는 하지 않는다(원본보다 커지면 흐려짐)
        const c=document.createElement('canvas');
        c.width =Math.max(1, Math.round(img.width *sc));
        c.height=Math.max(1, Math.round(img.height*sc));
        const g=c.getContext('2d');
        g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
        g.clearRect(0,0,c.width,c.height);          // 배경을 칠하지 않는다 = 투명 유지
        g.drawImage(img, 0, 0, c.width, c.height);
        let dataUrl=c.toDataURL('image/png');        // PNG여야 알파가 산다
        const uid=myUid();
        if(window.firebaseAPI && firebaseAPI.uploadUserPng && uid){
          mysRegSay('이미지를 올리는 중…');
          try{
            const res=await firebaseAPI.uploadUserPng(uid, key, dataUrl);
            if(res && res.ok){ onUrl(res.url); mysRegSay('저장했어요'); return; }
            mysRegSay((res&&res.reason)||'업로드에 실패했어요 — 이 기기에만 저장됩니다', true);
          }catch(_){ mysRegSay('업로드에 실패했어요 — 이 기기에만 저장됩니다', true); }
        }
        /* 폴백: 서버에 못 올리면 이 기기에 남긴다.
           ★ 그때만 WebP 로 다시 뽑는다 — 알파는 그대로 살고 용량은 대개 1/3 이하다.
             서버로 올라간 그림은 건드리지 않는다(원본 화질을 그대로 둔다).
           ⚠ WebP 를 못 뽑는 환경은 PNG 를 그대로 쓴다. toDataURL 은 지원하지 않는 형식을
             달라고 하면 조용히 PNG 를 돌려주므로, 받은 값의 머리를 보고 판단한다. */
        if(dataUrl.length > MYS_IMG_SOFT_MAX){
          try{
            const w=c.toDataURL('image/webp', 0.92);
            if(typeof w==='string' && w.indexOf('data:image/webp')===0 && w.length < dataUrl.length) dataUrl=w;
          }catch(_){}
        }
        onUrl(dataUrl);
      };
      img.onerror=()=>mysToast('이미지를 읽지 못했어요');
      img.src=ev.target.result;
    };
    rd.readAsDataURL(file);
  };
  fi.click();
}

/* ─────────────────────────── 스타일 ─────────────────────────── */
const MYS_CSS = `
  /* ── 색 ──
     이전 버전이 어둡다는 지적을 받아 전체적으로 한 단계씩 밝혔다.
     배경(#0b0f18)은 그대로 두고 글자 쪽만 올려서 대비를 키웠다 —
     배경을 밝히면 스탠딩 투명 PNG의 가장자리가 지저분해 보인다.
     ── 글자 크기 ──
     본문 크기는 --mys-fs (기본 13px). 창 안의 모든 글자는 이 값에 대한 em이다.
     새 요소를 만들 때 font-size를 px로 박지 말 것 — 그것만 크기 조절에서 빠진다. */
  #${MYS_WIN} .adv-titlebar, #${MYS_AGENTWIN} .adv-titlebar{background:linear-gradient(90deg,#0d1b3a,#20386e);}
  #${MYS_WIN} .adv-titlebar span, #${MYS_AGENTWIN} .adv-titlebar span{font-size:calc(var(--mys-fs, 13px) * .92);}
  #${MYS_WIN} .mhd-win-body, #${MYS_AGENTWIN} .mhd-win-body{background:#0b0f18;color:#dde5f2;
    font-family:'D2Coding',Consolas,'맑은 고딕',monospace;font-size:var(--mys-fs, 13px);
    display:flex;flex-direction:column;}
  /* 잠금 팝업의 기준 좌표계. ★ 현장 창에만 건다 —
     등록 창에도 걸면 그 안의 절대배치 요소(표정칸·침식 베일)의 기준이 바뀐다. */
  #${MYS_WIN} .mhd-win-body{position:relative;}
  .mys-hdr{padding:8px 12px;border-bottom:1px solid #2b3d63;background:#131c30;flex-shrink:0;}
  .mys-hdr .cls{font-size:.82em;letter-spacing:2px;color:#8fa8d4;}
  /* 사건 한 줄 요약과 음소거 버튼이 같은 줄에 선다. 요약이 길어도 버튼은 끝에 남는다 —
     ★ min-width:0 이 없으면 긴 요약이 버튼을 창 밖으로 밀어낸다(flex 기본값이 auto다). */
  .mys-hdr .depline{display:flex;align-items:center;gap:8px;margin-top:2px;}
  .mys-hdr .dep{flex:1;min-width:0;font-size:1.06em;color:#f0f4fb;}
  /* 음소거 — 이모지가 아니라 SVG 다. 이모지는 기기마다 모양·크기가 달라서
     같은 버튼이 어떤 PC 에서는 줄 높이를 밀어낸다. */
  .mys-snd{flex-shrink:0;width:24px;height:24px;padding:0;display:flex;align-items:center;
    justify-content:center;background:#1d2d4e;border:1px solid #4a6bb0;color:#8fa8d4;
    cursor:pointer;font-family:inherit;}
  .mys-snd:hover{background:#2b4a8c;border-color:#6f92d8;color:#dde5f2;}
  .mys-snd.off{color:#5a6d94;border-color:#3c4c6e;}
  .mys-snd svg{width:15px;height:15px;display:block;fill:none;stroke:currentColor;
    stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;}
  .mys-body{flex:1;min-height:0;overflow:auto;padding:14px 12px;line-height:1.7;color:#aebbd6;}
  /* 스크롤은 되되 막대는 감춘다 — Win98 창 안에 회색 스크롤바가 뜨면 화면이 지저분해진다 */
  #${MYS_WIN} .mhd-win-body, #${MYS_AGENTWIN} .mhd-win-body,
  #${MYS_WIN} .mhd-win-body *, #${MYS_AGENTWIN} .mhd-win-body *{scrollbar-width:none;-ms-overflow-style:none;}
  #${MYS_WIN} .mhd-win-body::-webkit-scrollbar, #${MYS_AGENTWIN} .mhd-win-body::-webkit-scrollbar,
  #${MYS_WIN} .mhd-win-body *::-webkit-scrollbar, #${MYS_AGENTWIN} .mhd-win-body *::-webkit-scrollbar{
    width:0;height:0;display:none;}
  .mys-body b{color:#f0f4fb;font-weight:normal;}
  .mys-meta{display:flex;gap:14px;flex-wrap:wrap;padding:6px 12px;border-top:1px solid #2b3d63;
    background:#131c30;font-size:.88em;color:#a9b8d4;flex-shrink:0;}
  .mys-meta b{color:#f0f4fb;font-weight:normal;}
  /* 파티 입구 — 하단 바 오른쪽 끝. 착수 버튼과 나란히 두지 않는다 */
  .mys-meta .pbtn{margin-left:auto;font-size:.95em;padding:2px 9px;background:#243149;
    border:1px solid #4a6bb0;color:#dde5f2;cursor:pointer;font-family:inherit;}

  /* ── 캐릭터 등록 ── */
  .mys-reg{display:flex;flex:1;min-height:0;}
  .mys-tabs{flex-shrink:0;display:flex;flex-direction:column;gap:4px;padding:10px 0 0 5px;}
  .mys-tab{writing-mode:vertical-rl;text-orientation:sideways;font-size:.82em;letter-spacing:1px;
    padding:9px 3px;background:#131c30;color:#8fa8d4;border:1px solid #2b3d63;cursor:pointer;}
  .mys-tab.on{background:#1d2d4e;color:#dde5f2;border-color:#4a6bb0;}
  .mys-tab.empty{color:#5a6d94;}          /* 아직 아무것도 안 채운 슬롯 */
  .mys-tab.empty.on{color:#a9b8d4;}
  .mys-standcol{flex-shrink:0;width:156px;padding:10px 0 10px 8px;}
  .mys-stand{width:148px;height:444px;background:#131c30;border:1px solid #2b3d63;position:relative;
    display:flex;align-items:flex-end;justify-content:center;overflow:hidden;cursor:pointer;}
  .mys-stand img{max-width:100%;max-height:100%;object-fit:contain;object-position:bottom;display:block;}
  .mys-stand .ph{color:#46587f;font-size:62px;padding-bottom:8px;}
  .mys-stand .tag{position:absolute;left:4px;top:4px;font-size:.78em;color:#8fa8d4;letter-spacing:1px;}
  .mys-stand .sz{position:absolute;right:4px;top:4px;font-size:.78em;color:#7f92b8;}
  .mys-hint{font-size:.78em;color:#8b9dc0;text-align:center;padding-top:3px;}
  /* 표정 8칸 = 4열 × 2행 */
  .mys-expr{display:none;grid-template-columns:repeat(4, 1fr);gap:4px;margin-top:6px;
    background:#16203a;border:1px solid #2c4270;padding:5px;}
  .mys-expr.on{display:grid;}
  .mys-ecell{text-align:center;cursor:pointer;}
  .mys-ecell .bx{height:34px;background:#131c30;border:1px solid #2b3d63;color:#46587f;
    display:flex;align-items:center;justify-content:center;font-size:12px;overflow:hidden;}
  .mys-ecell .bx img{max-width:100%;max-height:100%;object-fit:contain;}
  .mys-ecell.has .bx{border-color:#5fd0e0;color:#dde5f2;}
  .mys-ecell .lb{font-size:.75em;color:#8b9dc0;display:block;line-height:1.6;}
  .mys-ecell.has .lb{color:#e6ecf7;}
  .mys-form{flex:1;min-width:0;padding:10px 12px 12px;overflow:auto;}
  .mys-top{display:flex;justify-content:space-between;gap:8px;font-size:.82em;letter-spacing:2px;
    color:#8fa8d4;border-bottom:1px solid #2b3d63;padding-bottom:5px;}
  .mys-h1{font-size:1.18em;letter-spacing:4px;color:#f0f4fb;padding:7px 0 10px;}
  .mys-row{display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #24304c;}
  .mys-row .k{width:76px;font-size:.82em;color:#8fa8d4;letter-spacing:1px;flex-shrink:0;}
  .mys-row input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:#f0f4fb;
    font-family:inherit;font-size:1em;padding:2px 0;height:auto;}
  .mys-row input::placeholder{color:#5a6d94;}
  .mys-row .sub{font-size:.82em;color:#a9b8d4;flex-shrink:0;}
  .mys-row .val{flex:1;color:#f0f4fb;}
  .mys-photo{flex-shrink:0;width:104px;}
  .mys-photo .bx{height:139px;background:#131c30;border:1px solid #2b3d63;position:relative;cursor:pointer;
    display:flex;align-items:center;justify-content:center;color:#46587f;font-size:26px;overflow:hidden;}
  .mys-photo .bx img{width:100%;height:100%;object-fit:cover;display:block;}
  .mys-photo .bx i{position:absolute;width:8px;height:8px;border:0 solid #5fd0e0;}
  /* 오염도 침식 — 위에서부터 검게 덮는다. height는 JS가 단계별로 넣는다.
     증명사진과 스탠딩이 같은 연출을 공유한다(단계 값만 서로 다름). */
  .mys-photo .bx .veil, .mys-stand .veil{position:absolute;left:0;right:0;top:0;pointer-events:none;
    background:linear-gradient(180deg, rgba(0,0,0,.97) 0%, rgba(0,0,0,.93) 40%, rgba(0,0,0,.72) 70%, rgba(0,0,0,0) 100%);
    transition:height .35s ease;}
  /* 소속 — 빈칸을 직접 채운다 */
  .mys-post .postline{font-size:.86em;color:#c3d0e8;line-height:1.9;}
  .mys-post input{background:transparent;border:none;border-bottom:1px solid #6f92d8;border-radius:0;
    color:#f0f4fb;font-family:inherit;font-size:1em;width:2.4em;text-align:center;
    padding:0 2px 1px;margin:0 3px;height:auto;min-height:0;outline:none;}
  .mys-post input:focus{border-bottom-color:#7fe0ee;}
  .mys-post input.wide{width:5.5em;}
  .mys-post input::placeholder{color:#5a6d94;}
  .mys-gauge{flex:1;height:9px;background:#131c30;border:1px solid #2b3d63;position:relative;}
  .mys-gauge span{position:absolute;left:0;top:0;bottom:0;background:#4e9ec0;}
  .mys-sec{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:11px;
    border-bottom:1px solid #2b3d63;padding-bottom:4px;font-size:.82em;letter-spacing:2px;color:#8fa8d4;}
  .mys-sec em{font-style:normal;letter-spacing:0;color:#a9b8d4;}
  .mys-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;padding-top:8px;}
  .mys-st{display:flex;align-items:center;gap:5px;}
  .mys-st .nm{width:2.8em;color:#f0f4fb;}
  .mys-st button{width:1.5em;height:1.5em;min-height:0;background:#1d2d4e;border:1px solid #4a6bb0;
    color:#dde5f2;font-size:.85em;line-height:1;padding:0;cursor:pointer;display:flex;
    align-items:center;justify-content:center;font-family:inherit;flex-shrink:0;}
  .mys-st button:disabled{opacity:.35;cursor:default;}
  .mys-st .vl{width:1.6em;text-align:center;color:#7fe0ee;}
  .mys-st .bar{flex:1;height:5px;background:#131c30;border:1px solid #2b3d63;position:relative;}
  .mys-st .bar i{position:absolute;left:0;top:0;bottom:0;background:#5fd0e0;}
  .mys-note{font-size:.82em;color:#a9b8d4;padding-top:8px;line-height:1.6;}
  .mys-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:11px;
    border-top:1px solid #2b3d63;padding-top:8px;flex-wrap:wrap;}
  .mys-foot .left{font-size:.9em;color:#dde5f2;}
  .mys-foot .left b{color:#7fe0ee;font-weight:normal;}
  /* 게시판 요약 — 제목 줄 바로 아래. 눈에 띄되 제목을 이기면 안 되므로 작고 흐리게. */
  .mys-brief{margin:5px 0 0;font-size:.86em;line-height:1.6;color:#8fa8d4;}
  .mys-foot button{font-size:.9em;padding:3px 9px;min-height:0;background:#1d2d4e;border:1px solid #4a6bb0;
    color:#dde5f2;cursor:pointer;font-family:inherit;margin-left:6px;}
  .mys-foot button.go{background:#2b4a8c;border-color:#6f92d8;color:#f0f4fb;}
  .mys-foot button.go.cur{background:#1d2d4e;border-color:#4a6bb0;color:#8fa8d4;cursor:default;}
  .mys-msg{min-height:1.4em;padding-top:6px;font-size:.86em;color:#7fe0ee;}
  .mys-msg.warn{color:#f0b46a;}

  /* ── 🗺 현장 레이아웃 ──
     지도 480(24칸×20px) + 우측 패널 260 + 여백 = 756. 마이홈 창 760 안에 들어간다.
     ⚠ 칸 크기는 px 고정이다. 글자 크기(--mys-fs)를 따라 커지면 24칸이 창을 넘는다. */
  .mys-field{flex:1;min-height:0;display:flex;gap:10px;padding:8px;}
  /* ★ overflow:hidden — 스탠딩은 스크립트 박스에 매달려 위로 자란다. 창이 낮으면
     머리가 사건 머리말까지 올라오므로 여기서 잘라낸다. */
  .mys-main{width:${MYS_CELL*24}px;flex-shrink:0;display:flex;flex-direction:column;gap:6px;
    overflow:hidden;}
  .mys-stagearea{position:relative;height:${MYS_CELL*14}px;flex-shrink:0;overflow:hidden;}
  .mys-map{display:grid;gap:0;position:relative;border:1px solid #2b3d63;background:#16223c;}
  .mys-map.locked{opacity:.45;}
  /* ── 침식 연출 — 오염도가 임계값을 넘으면 현장이 흔들린다 ──
     ★ 오염도는 '몸이 상하는 것'이 아니라 '자기 시간선이 흐려지는 것'이다(세계관 1절).
       그러면 흐려지는 건 요원이 아니라 요원이 보는 화면이어야 앞뒤가 맞는다.
     ⚠ 칸을 못 누를 정도로 흔들면 안 된다. 이건 벌이 아니라 경고다 —
       움직임은 1px 안쪽, 겹치는 색면은 통과(pointer-events:none)시킨다. */
  .mys-map.tainted{animation:mysGlitch 5.5s infinite;}
  .mys-map.tainted::after{content:'';position:absolute;inset:0;pointer-events:none;
    background:repeating-linear-gradient(0deg,rgba(120,200,255,.05) 0 1px,transparent 1px 3px);
    mix-blend-mode:screen;animation:mysScan 7s linear infinite;}
  @keyframes mysGlitch{
    0%,86%,100%{transform:none;filter:none;}
    87%{transform:translateX(-1px);filter:hue-rotate(12deg);}
    88%{transform:translateX(1px);}
    89%{transform:none;filter:saturate(1.6);}
    93%{transform:none;}
    94%{transform:translateY(1px);filter:hue-rotate(-14deg);}
    95%{transform:none;filter:none;}
  }
  @keyframes mysScan{ from{background-position:0 0;} to{background-position:0 60px;} }
  /* 움직임에 민감한 사람에게는 흔들지 않는다. 정보는 색으로만 남긴다. */
  @media (prefers-reduced-motion:reduce){
    .mys-map.tainted{animation:none;filter:saturate(1.3) hue-rotate(8deg);}
    .mys-map.tainted::after{animation:none;}
  }
  .mys-map .cl{width:${MYS_CELL}px;height:${MYS_CELL}px;display:flex;align-items:center;
    justify-content:center;font-size:11px;font-style:normal;color:#8fa8d4;position:relative;
    box-sizing:border-box;}
  .mys-map .out{background:transparent;}
  .mys-map .fog{background:#05070c;}
  .mys-map .wall{background:#16223c;}
  .mys-map .door{background:#8a742e;color:#f7ecc4;}
  .mys-map .door.lock{background:#8c2f2f;color:#ffdada;}
  .mys-map .spot{color:#7fe0ee;font-weight:bold;}
  .mys-map .npc, .mys-map .body{font-size:13px;}
  .mys-map .slock{font-size:11px;}
  .mys-map .done{color:#5a6d94;}
  .mys-map .seenc{color:#4a5a7a;}
  .mys-map .me{background:#f5c542 !important;}
  .mys-map .me b{color:#16223c;font-weight:normal;}
  /* 파티원 — 나와 같은 ■ 다. 색만 다르다.
     ★ 예전엔 우측 하단 3px 점 하나였는데, 24×14 격자에서 그건 안 보인다.
       "지도에 파티원이 움직이는 것이 보인다"가 파티의 절반인데 그게 안 보였다.
     ⚠ 배경색은 인라인으로 넣는다(사람마다 색이 다르다). .me 만 !important 인 이유는
       내 칸이 남의 칸에 덮이면 안 되기 때문이다 — 겹치면 내 노란 칸이 이긴다. */
  .mys-map .mate b{color:#16223c;font-weight:normal;}
  .mys-map .mt{position:absolute;right:0;bottom:0;font-size:8px;line-height:1;}
  .mys-map .mf{position:absolute;left:0;top:0;font-size:9px;line-height:1;}

  /* 방 이름 — 격자 위에 겹친다. 클릭을 막지 않도록 pointer-events 를 끈다 */
  .mys-rlabel{position:absolute;transform:translate(-50%,-50%);pointer-events:none;
    font-size:10px;color:#9db0d0;opacity:.72;white-space:nowrap;}

  /* 현장 스탠딩 — 스크립트 박스에 매달린다(박스 안의 절대배치 · bottom:100%).
     ★ 무대(.mys-stagearea)에 매달아 두면 스크립트 박스가 아래에 내려앉은 만큼
       사람만 위에 뜬 채로 남는다 — 말하는 사람과 말이 따로 논다. 발끝을 박스 윗변에
       붙여 두면 박스 높이가 변해도(말풍선·두 줄 대사) 둘이 절대 어긋나지 않는다.
     ⚠ 박스를 파고들게(bottom:100% 보다 아래로) 두지 말 것. 스탠딩은 박스의 자식이라
       배경보다 위에 그려지므로, 겹치는 만큼 이름표와 대사를 가린다.
     ⚠ 클래스 이름은 .mys-fstand 다. .mys-stand 는 캐릭터 등록 창의 스탠딩 박스가 이미 쓰고 있어서
       같은 이름을 쓰면 등록 창 스탠딩이 이 규칙에 덮여 찌그러진다(실제로 겪음). */
  .mys-fstand{position:absolute;bottom:100%;margin-bottom:-1px;
    width:100px;height:${MYS_STAND_H}px;pointer-events:none;
    transition:opacity .18s, transform .18s;}
  .mys-fstand.left{left:0;}
  .mys-fstand.right{right:0;}
  /* 파티원 대화 — 나는 왼쪽 고정, 상대는 오른쪽에 좌우반전으로 선다.
     스탠딩 원본이 전부 같은 방향을 보므로 그대로 세우면 둘이 같은 곳을 바라본다 —
     뒤집어야 마주 보고 말하는 그림이 된다.
     ⚠ 증명사진 폴백(.pic)은 뒤집지 않는다 — 사진에 글씨(명찰·배경 문구)가 있으면
       거울 글씨가 되고, 정면 사진은 뒤집어도 얻는 게 없다. */
  .mys-fstand.right.mate:not(.pic) img{transform:scaleX(-1);}
  .mys-fstand.off{opacity:0;transform:translateY(14px);}
  .mys-fstand img{width:100%;height:100%;object-fit:contain;object-position:bottom;}
  /* 증명사진 폴백 — 스탠딩을 한 장도 안 그린 사람의 자리.
     ⚠ 스탠딩과 똑같은 모양으로 바닥에 세우면 '아래가 잘린 그림'처럼 읽힌다.
       액자처럼 테를 둘러 "이건 사진이다"가 드러나게 한다.
     ⚠ 틀을 3:4로 박고 object-fit:cover 로 채우지 말 것. 업로드는 비율을 그대로 두므로
       (mysUploadPng 은 축소만 한다) 정사각형이나 가로 사진이 올라오면 양옆이 잘려 나간다 —
       "사진이 조금 잘린다"가 정확히 이것이었다. 높이를 그림에 맡기고 틀이 따라가게 한다. */
  .mys-fstand.pic{width:100px;height:auto;}
  .mys-fstand.pic img{display:block;width:100%;height:auto;max-height:200px;object-fit:contain;
    border:1px solid #4a6bb0;background:#131c30;}
  .mys-fstand .npcbox{position:absolute;bottom:0;left:0;right:0;height:200px;
    background:linear-gradient(180deg,rgba(20,28,48,0),rgba(20,28,48,.75));
    display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;}
  .mys-fstand .npcbox span{font-size:.9em;color:#dde5f2;border:1px solid #4a6bb0;
    background:#131c30;padding:2px 8px;}
  /* 관계자 버튼 — 예전엔 스탠딩 표시 토글(👤)이 있던 자리다.
     스탠딩은 지도에 마우스만 올려도 알아서 비키므로 토글이 필요 없었고,
     그 자리에 정작 늘 필요한 것(누가 이 사건에 얽혀 있나)을 넣었다.
     ★ 목록은 호버로만 뜬다 — 상태를 만들지 않으니 재렌더와 얽히지 않는다(CSS 전용). */
  .mys-cast{position:absolute;right:2px;top:2px;z-index:8;}
  .mys-cast > button{padding:1px 6px;height:20px;font-size:11px;line-height:1;
    background:#131c30;border:1px solid #4a6bb0;color:#8fa8d4;cursor:default;font-family:inherit;}
  .mys-cast:hover > button{background:#1d2d4e;color:#dde5f2;border-color:#6f92d8;}
  .mys-castlist{display:none;position:absolute;right:0;top:100%;width:232px;
    background:#0d1424;border:1px solid #4a6bb0;padding:6px 8px 7px;}
  .mys-cast:hover .mys-castlist{display:block;}
  .mys-castlist p{margin:0 0 4px;font-size:.8em;line-height:1.45;color:#aebbd6;}
  .mys-castlist p:last-child{margin-bottom:0;}
  .mys-castlist b{color:#f0f4fb;font-weight:normal;}
  .mys-castlist em{font-style:normal;color:#7f92b8;}
  .mys-castlist .nt{display:block;color:#6f7d99;font-size:.92em;}

  /* 스크립트 박스 — 비주얼노벨. ★ NPC 대사만. 캐릭터 채팅은 절대 여기 넣지 말 것
     ★ margin-top:auto — 남는 공간을 위로 몰아 박스를 아래에 붙인다. 위에 붙여 두면
       무대 바로 밑에 큰 판이 서서 화면이 위쪽으로 쏠린다. */
  .mys-script{flex:0 1 auto;min-height:0;margin-top:auto;background:rgba(0,0,0,.82);
    border:1px solid #3a4763;
    padding:10px 12px;color:#ffffff;line-height:1.75;cursor:pointer;position:relative;}
  .mys-script .who{font-size:.9em;color:#7fe0ee;margin-bottom:5px;}
  .mys-script .line{font-size:1.02em;color:#ffffff;}
  /* ★ 읽는 줄(prev 아님)은 한 줄짜리 대사여도 두 줄 높이를 지킨다 — 줄 수에 따라
     박스가 들쭉날쭉하면 대사가 바뀔 때마다 시선이 널뛴다(높이가 낮다는 지적이 이것).
     ⚠ 말풍선(.soft)은 제외 — 화면을 잠그지 않는 가벼운 것이라 얇아야 한다. */
  .mys-script:not(.soft) .line:not(.prev){min-height:3.5em;}
  /* 직전 줄 — 읽을 줄과 헷갈리지 않을 만큼 물러나 있어야 한다 */
  .mys-script .line.prev{color:#7b8aa8;font-size:.94em;margin-bottom:3px;}
  .mys-script .cue{position:absolute;right:10px;bottom:6px;font-size:.78em;color:#9fb0cc;}
  /* 정리 스크립트 — NPC 대사가 아니라 '내 머릿속'이다. 같은 흰 글씨로 흐르면
     플레이어가 누가 한 말인지 헷갈린다. 색으로 출처를 가른다. */
  .mys-script.recap{border-color:#3f7a55;}
  .mys-script.recap .who{color:#8ce39a;}
  .mys-script.recap .line{color:#b7f0c4;}
  .mys-script.recap .line.prev{color:#5f8f6d;}
  /* 조사 결과 — 사람이 하는 말이 아니다. 이름표 자리에는 지점 이름이 들어간다.
     ★ 색이 곧 출처다. 기록 창의 |[조사] 줄과 같은 계열로 둔다. */
  .mys-script.clue{border-color:#44507a;}
  .mys-script.clue .who{color:#9aa8c4;}
  .mys-script.clue .line{color:#dbe3f2;}
  .mys-script.clue .line.prev{color:#6b7794;}
  /* 내 대사 — 기록 창의 lg-me 와 같은 색. 스탠딩이 같이 올라온다. */
  .mys-script.me{border-color:#3f6f7a;}
  .mys-script.me .who{color:#7fe0ee;}
  .mys-script.me .line{color:#e6f7fb;}
  .mys-script.me .line.prev{color:#5b8894;}
  /* 파티원 대사 — 기록 창의 lg-mate 와 같은 계열. NPC(주황)와 갈라 놓는다. */
  .mys-script.mate{border-color:#4a5f8c;}
  .mys-script.mate .who{color:#a9b8d4;}
  .mys-script.mate .line{color:#eaf0fb;}
  .mys-script.mate .line.prev{color:#6b7794;}
  /* 채팅 말풍선 — 화면을 잠그지 않는다는 것이 눈에도 보여야 한다. 옅게, 얇게. */
  .mys-script.soft{flex:0 0 auto;background:rgba(0,0,0,.62);}
  .mys-script.soft .cue{opacity:.7;}
  /* 행동지문 — 대사와 같은 줄에 있되 한 발 물러나 있어야 연기로 읽힌다 */
  .mys-script .act{color:#93a4c4;font-style:italic;}

  /* 우측 패널
     ★ overflow:hidden 이 핵심이다. 이게 없으면 단서·기록이 길어졌을 때
       합계 높이가 패널을 넘어서고, 맨 아래 채팅칸이 창 밖으로 밀려 내려간다.
       '넘치면 안쪽에서 스크롤' 이어야지 '넘치면 밖으로 밀어내기' 가 되면 안 된다. */
  .mys-side{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;overflow:hidden;}
  .mys-loc{border-bottom:1px solid #2b3d63;padding-bottom:4px;flex-shrink:0;}
  .mys-loc b{color:#f0f4fb;font-weight:normal;font-size:1.05em;}
  .mys-loc span{display:block;font-size:.78em;color:#5a6d94;}
  .mys-act{flex-shrink:0;}
  .mys-act button{width:100%;font-size:.86em;padding:5px 8px;background:#2b4a8c;
    border:1px solid #6f92d8;color:#f0f4fb;cursor:pointer;font-family:inherit;text-align:left;}
  .mys-act .dim{color:#5a6d94;font-size:.82em;}
  .mys-act button.no{background:#232d44;border-color:#3c4c6e;color:#7d8dab;cursor:default;}
  .mys-act .warn{color:#f0b46a;font-size:.82em;}
  /* 심문 레디 — 대기 중인 사람이 화면에 없으면 파티는 그냥 멈춘 화면이 된다 */
  .mys-ready{display:flex;align-items:center;gap:5px;margin-top:4px;font-size:.78em;
    color:#c9b3f0;background:#1d1a33;border:1px solid #4a3a8c;padding:3px 6px;}
  .mys-ready span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .mys-ready button{width:auto;flex-shrink:0;background:#4a3a8c;border-color:#9a86e0;
    font-size:1em;padding:2px 8px;}
  /* 파티 명단 — 이름과 색만. 남의 오염도·단서는 여기 없다(정보 비대칭이 설계다).
     ★ 자리는 가장 아랫줄(.mys-meta)이다. 우측 패널은 단서가 받는다. */
  .mys-meta .pmate{color:#a9b8d4;}
  .mys-meta .pmate.me{color:#f0f4fb;}
  .mys-meta .pmate.dim{color:#5a6d94;}
  .mys-meta .pmate.code{color:#7fe0ee;letter-spacing:1px;}
  /* 코드는 불러주고 받아치는 물건이다. 크고 또렷하게. */
  .mys-modal .pcode{font-size:1.6em;letter-spacing:6px;text-align:center;color:#7fe0ee;
    background:#0b0f18;border:1px solid #4a6bb0;padding:8px 0;margin:6px 0 8px;}
  .mys-modal .plist{display:flex;flex-direction:column;gap:2px;margin-bottom:8px;font-size:.86em;}
  .mys-modal .plist b{color:#8ce39a;font-weight:normal;}
  .mys-modal .plist i{color:#5a6d94;font-style:normal;}
  .mys-modal .wait{font-size:.78em;color:#8fa8d4;align-self:center;}
  .mys-modal .lockbtn2{background:#3f7a55;border-color:#8ce39a;}
  .mys-lockbar{flex-shrink:0;}
  .mys-lockbar .lockbtn{width:100%;font-size:.86em;padding:4px 8px;background:#243149;
    border:1px solid #4a6bb0;color:#dde5f2;cursor:pointer;font-family:inherit;}
  .mys-lockbar .ok{color:#7fe0ee;font-size:.9em;}
  /* ★ min-height:0 — flex 항목의 기본값(auto)이면 내용만큼 버텨서 줄어들지 않고,
     그만큼이 그대로 아래쪽(채팅칸)을 밀어낸다. 관계자 영역을 걷어낸 자리를
     단서가 받는다. */
  .mys-clues{flex:1 1 0;min-height:0;overflow:auto;overscroll-behavior:contain;}
  .mys-clues .ttl, .mys-items .ttl{font-size:.78em;color:#8fa8d4;letter-spacing:1px;margin:0 0 3px;}
  .mys-clues p{margin:0 0 5px;font-size:.82em;line-height:1.5;color:#aebbd6;}
  .mys-clues .dim{color:#5a6d94;}
  .mys-clues .tg{display:inline-block;min-width:2.4em;margin-right:4px;padding:0 3px;
    font-size:.9em;background:#1d2d4e;border:1px solid #4a6bb0;color:#7fe0ee;}
  .mys-items{flex:0 1 auto;min-height:0;max-height:118px;overflow:auto;
    overscroll-behavior:contain;border-top:1px solid #2b3d63;padding-top:4px;}
  .mys-items .itm{display:block;width:100%;text-align:left;margin-bottom:3px;font-size:.82em;
    padding:3px 6px;background:#243149;border:1px solid #4a6bb0;color:#dde5f2;cursor:pointer;
    font-family:inherit;}
  .mys-items .itm.lk{border-color:#8c6f2f;color:#e8d6a8;}
  .mys-modal .pad{display:grid;grid-template-columns:repeat(3,44px);gap:8px;
    justify-content:center;margin:12px 0;}
  .mys-modal .dot{width:44px;height:44px;border-radius:50%;background:#0b0f18;
    border:1px solid #4a6bb0;color:#7fe0ee;font-family:inherit;font-size:.9em;cursor:pointer;}
  .mys-modal .dot.on{background:#2b4a8c;border-color:#9ec1ff;color:#f0f4fb;}
  /* 범인 지목 — 되돌릴 수 없는 행동이라 조사 버튼과 색이 같으면 안 된다.
     ⚠ 붉은 계열은 이 화면에서 여기 하나뿐이다. 늘리면 경고가 경고로 안 읽힌다. */
  .mys-act button.accuse{margin-top:4px;background:#7a2b34;border-color:#d88f97;}
  .mys-modal .sus{display:block;width:100%;text-align:left;margin-bottom:4px;padding:5px 8px;
    background:#243149;border:1px solid #4a6bb0;color:#dde5f2;font-size:.86em;}
  .mys-modal .sus b{color:#f0f4fb;}
  .mys-modal .sus span{display:block;font-size:.82em;color:#8fa8d4;margin-top:1px;}
  /* 채팅·기록 — 색이 곧 출처다.
     ⚠ flex-shrink:0 + 고정 높이. 여기서 늘어나기 시작하면 채팅칸이 밀려 내려간다. */
  .mys-log{height:118px;flex:0 0 118px;overflow:auto;overscroll-behavior:contain;
    border-top:1px solid #2b3d63;padding-top:4px;font-size:.8em;line-height:1.55;}
  .mys-log p{margin:0 0 2px;}
  .mys-log .lg-me{color:#7fe0ee;}
  /* 닉네임 발화 — 우측 정렬 · 기울임 · 흐린 색. 캐릭터 대사를 이기면 안 된다. */
  .mys-log .lg-nick{color:#6f7d99;font-style:italic;text-align:right;opacity:.85;}
  /* 행동지문 — 이름표가 없다. 누가 했는지가 아니라 무엇이 일어났는지를 읽는 줄이다. */
  .mys-log .lg-act{color:#9fb0cc;font-style:italic;padding-left:6px;}
  /* 이름표는 대사 줄과 똑같이 — 줄 전체가 기울면 누가 한 말인지가 흔들린다 */
  .mys-log .lg-act .nm{color:#7fe0ee;font-style:normal;}
  .mys-log .lg-act.nick .nm{color:#6f7d99;}
  .mys-log .lg-act.nick{color:#6f7d99;text-align:right;padding-left:0;padding-right:6px;opacity:.85;}
  .mys-log .lg-mate{color:#eaf0fb;}
  /* 대사 안에 섞인 행동지문 — 스크립트 박스와 같은 회색 기울임이어야 한다.
     같은 말이 창을 옮겼다고 다르게 보이면 그게 곧 다른 말로 읽힌다. */
  .mys-log .act{color:#93a4c4;font-style:italic;}
  .mys-log .lg-npc{color:#f0b46a;}
  .mys-log .lg-recap{color:#8ce39a;}
  .mys-log .lg-clue{color:#9aa8c4;}
  .mys-log .lg-dice{color:#c9b3f0;}
  .mys-log .lg-sys{color:#6f8ab8;}
  /* ── 타이핑 알림 ──
     ★ 기록 창 '안'의 맨 아래에 붙는다. 밖에 두면 사람이 칠 때마다 창 높이가 흔들려
       읽고 있던 줄이 아래로 밀린다.
     ★ 색을 죽이고 기울인다 — 이건 아직 일어나지 않은 말이다. 대사와 같은 무게로 찍히면
       "쳤는데 안 보인다"로 읽힌다. */
  .mys-log .lg-typ{color:#5f7398;font-style:italic;opacity:.9;}
  .mys-log .lg-typ b{color:#8fa8d4;font-weight:normal;font-style:normal;}
  .mys-inbar{display:flex;gap:4px;flex-shrink:0;align-items:center;}
  /* 채팅 위 한 줄 — 있는지 없는지 모를 만큼 조용해야 한다. 누를 것이지 읽을 것이 아니다. */
  .mys-chatopt{display:flex;align-items:center;justify-content:space-between;gap:6px;
    flex-shrink:0;font-size:.74em;color:#6f7d99;padding:2px 1px 3px;}
  .mys-chatopt label{display:flex;align-items:center;gap:3px;cursor:pointer;}
  .mys-chatopt input{margin:0;cursor:pointer;}
  .mys-inbar input{flex:1;min-width:0;background:#0b0f18;border:1px solid #4a6bb0;
    color:#f0f4fb;font-family:inherit;font-size:.85em;padding:3px 5px;}
  .mys-inbar .pend{flex:1;min-width:0;font-size:.78em;color:#c9b3f0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap;}
  .mys-inbar button{font-size:.85em;padding:3px 9px;background:#2b4a8c;border:1px solid #6f92d8;
    color:#f0f4fb;cursor:pointer;font-family:inherit;flex-shrink:0;}
  .mys-inbar button.dice{background:#4a3a8c;border-color:#9a86e0;}

  /* 잠금 팝업 */
  .mys-modal{position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(4,7,14,.72);
    display:flex;align-items:center;justify-content:center;z-index:20;}
  .mys-modal .box{width:300px;background:#131c30;border:1px solid #6f92d8;padding:14px;}
  .mys-modal .mt{font-size:1.02em;color:#f0f4fb;margin-bottom:4px;}
  .mys-modal .mh{font-size:.8em;color:#8fa8d4;margin-bottom:8px;}
  .mys-modal .mr{display:flex;gap:5px;}
  /* 나가기 팝업의 버튼 줄 — 세 칸이 서로를 밀어내면 '저장 안 하고 나 / 가기' 처럼
     낱말 한가운데가 끊긴다. 줄바꿈 자리는 <br> 로 직접 잡고, 여기서는 두 가지만 한다 —
     버튼이 안 줄어들게 막고(flex:0 0 auto), 그래도 안 들어가면 낱말이 아니라
     버튼째로 다음 줄에 내린다(flex-wrap). ⚠ 글자 크기를 '아주 크게'로 두면 실제로 그렇게 된다. */
  .mys-modal .mr.two{flex-wrap:wrap;align-items:stretch;row-gap:5px;}
  .mys-modal .mr.two button{flex:0 0 auto;padding:4px 10px;line-height:1.35;text-align:center;}
  .mys-modal input{flex:1;min-width:0;background:#0b0f18;border:1px solid #4a6bb0;
    color:#f0f4fb;font-family:inherit;font-size:.95em;padding:4px 6px;letter-spacing:2px;}
  .mys-modal button{font-size:.9em;padding:4px 12px;background:#2b4a8c;border:1px solid #6f92d8;
    color:#f0f4fb;cursor:pointer;font-family:inherit;}
  .mys-modal .mc{font-size:.75em;color:#5a6d94;margin-top:7px;}
  /* 되돌릴 수 없는 버튼 — 지도의 범인 지목과 같은 붉은 계열이다.
     ⚠ 이 화면에서 붉은색은 '되돌릴 수 없다'는 뜻 하나로만 쓴다. 늘리면 경고가 안 읽힌다. */
  .mys-modal button.danger{background:#7a2b34;border-color:#d88f97;}
  .mys-meta b.bad{color:#f0b46a;}
`;
function mysInjectCss(){
  if(el('mysStyle')) return;
  const s=document.createElement('style'); s.id='mysStyle'; s.textContent=MYS_CSS;
  document.head.appendChild(s);
}

/* 글자 크기 적용 — 두 창의 모든 글자가 이 변수 하나에 매달려 있다.
   :root에 걸어두면 창을 마이홈으로 옮겨도(host:'home') 따라온다. */
function mysApplyFont(){
  const n=(MYS && MYS.fontSize) || FONT_DEFAULT;
  try{ document.documentElement.style.setProperty('--mys-fs', n+'px'); }catch(_){}
}
function mysSetFont(n){
  if(!MYS) return;
  MYS.fontSize = FONT_SIZES.some(f=>f.value===n) ? n : FONT_DEFAULT;
  mysSave(); mysApplyFont();
}

/* ═══════════════════════════ 캐릭터 등록 창 ═══════════════════════════ */
let regBody=null;      // createWindow가 돌려준 body
let editSlot=0;        // 지금 편집 중인 슬롯 (활성 요원과 별개 — 캐릭터세팅과 동일한 개념)
let exprOpen=false;    // 표정 등록 패널 열림 여부
let previewKey='normal';   // 스탠딩 미리보기에 띄운 표정

function regRender(){
  if(!regBody) return;
  const a=agent(editSlot);
  const left=pointsLeft(a), tot=totalPoints(a), tier=ageTier(a);
  const su=standUrl(previewKey, editSlot);

  regBody.innerHTML=
   '<div class="mys-reg">'
    +'<div class="mys-tabs" id="mysTabs"></div>'

    +'<div class="mys-standcol">'
      +'<div class="mys-stand" id="mysStand" title="클릭: 표정 등록 패널 열기">'
        +'<span class="tag">FIG. '+String(editSlot+1).padStart(2,'0')+'</span>'
        +'<span class="sz">'+STAND_W+'×'+STAND_H+'</span>'
        +(su?'<img src="'+mysEsc(su)+'" alt="스탠딩">'
             +'<span class="veil" style="height:'+taintVeilStand(a)+'%"></span>'
           :'<span class="ph">◓</span>')
      +'</div>'
      /* ⚠ 여기는 mysSaveWarned(=본 저장 거절)만 보고 있었다. 그런데 실제로 자주 나는 쪽은
           **본 저장은 멀쩡한데 그림 한 장이 제 칸에 못 들어간** 경우다. 그때는 이 줄이
           '클릭해서 표정 등록'으로 태연히 남아서, 사람은 등록된 줄 알고 창을 닫는다.
           그러고 재부팅하면 그 그림만 사라져 있다. 두 경우를 다 잡는다. */
      +'<div class="mys-hint">'
        + (mysSaveWarned
            ? '<b style="color:#f0b46a">저장되지 않았습니다 — 스탠딩이 서버에 안 올라갔습니다. 우클릭으로 몇 장 지우고 다시 시도할 것</b>'
            : (mysImgWeakCount()
                ? '<b style="color:#f0b46a">그림 '+mysImgWeakCount()+'장이 저장되지 않았습니다 — 지금은 보이지만 창을 닫으면 사라집니다. 우클릭으로 몇 장 지우고 다시 등록할 것</b>'
                : '클릭해서 표정 등록'))
      +'</div>'
      +'<div class="mys-expr'+(exprOpen?' on':'')+'" id="mysExpr"></div>'
    +'</div>'

    +'<div class="mys-form">'
      +'<div class="mys-top"><span>▲▣ CLASSIFIED · FORM A-7</span>'
        +'<span>REG. No.'+String(editSlot+1).padStart(3,'0')+'</span></div>'
      +'<div class="mys-h1">AGENT REGISTRATION</div>'

      +'<div style="display:flex;gap:12px;">'
        +'<div style="flex:1;min-width:0;">'
          +'<div class="mys-row"><span class="k">NAME 성명</span>'
            +'<input id="mysFName" type="text" maxlength="12" placeholder="요원명"></div>'
          +'<div class="mys-row"><span class="k">AGE 연령</span>'
            +'<input id="mysFAge" type="number" min="0" max="120" placeholder="예: 31" style="flex:0 0 60px">'
            +'<span class="sub">'+tier.label+'</span></div>'
          +'<div class="mys-row"><span class="k">TRAIT 성향</span>'
            +'<input id="mysFTrait" type="text" maxlength="20" placeholder="예: 신중함"></div>'
          +'<div class="mys-row"><span class="k">RANK 등급</span>'
            +'<span class="val" id="mysRank">'+mysEsc(rankName(a))+'</span></div>'
          +'<div class="mys-row mys-post" style="border-bottom:none;align-items:flex-start;">'
            +'<span class="k">POST 소속</span>'
            +'<span class="val postline">'
              +'제<input id="mysPPlanet" type="text" maxlength="3" placeholder=" ">행성 '
              +'제<input id="mysPUniv" type="text" maxlength="3" placeholder=" ">우주 수사국<br>'
              +'<input id="mysPCountry" class="wide" type="text" maxlength="10" placeholder="국가">지부'
            +'</span></div>'
        +'</div>'

        +'<div class="mys-photo">'
          +'<div class="bx" id="mysPhoto" title="증명사진 등록 (3:4)">'
            +'<i style="left:3px;top:3px;border-left-width:1px;border-top-width:1px;"></i>'
            +'<i style="right:3px;top:3px;border-right-width:1px;border-top-width:1px;"></i>'
            +'<i style="left:3px;bottom:3px;border-left-width:1px;border-bottom-width:1px;"></i>'
            +'<i style="right:3px;bottom:3px;border-right-width:1px;border-bottom-width:1px;"></i>'
            +(mysImgGet(a.photo)?'<img src="'+mysEsc(mysImgGet(a.photo))+'" alt="증명사진">'
                     +'<span class="veil" id="mysVeil" style="height:'+taintVeil(a)+'%"></span>'
                     :'◐')
          +'</div>'
          +'<div class="mys-hint">증명사진 3:4</div>'
        +'</div>'
      +'</div>'

      +'<div class="mys-row" style="border-bottom:none;padding-top:9px;">'
        +'<span class="k">오염도</span>'
        +'<span class="mys-gauge" id="mysTaint">'
          +'<span style="width:'+Math.max(0,Math.min(100,a.taint|0))+'%"></span></span>'
        +'<span class="sub">'+(a.taint|0)+' / 100</span></div>'

      +'<div class="mys-sec"><span>APTITUDE 적성 분배</span><em>기본 10P + 집중 보너스 · 최대 50</em></div>'
      +'<div class="mys-stats" id="mysStats"></div>'
      +'<div class="mys-note">'
        + STAT_KEYS.map(k=>STAT_LABEL[k]+' = '+STAT_DESC[k]).join(' · ')
      +'</div>'

      +'<div class="mys-foot">'
        +'<span class="left" id="mysLeft">잔여 <b>'+left+'</b>P <span style="color:#8b9dc0">/ '+tot+'P</span></span>'
        +'<span><button type="button" id="mysReset">분배 초기화</button>'
        +'<button type="button" class="go'+(MYS.active===editSlot?' cur':'')+'" id="mysPick">'
          +(MYS.active===editSlot?'파견 중':'이 요원으로 파견')+'</button></span>'
      +'</div>'
      /* 안내는 toast가 아니라 창 안에 띄운다 — 이 창이 마이홈 전체를 덮고 있어서
         바깥에 뜨는 toast는 뒤에 가려 보이지 않는다(버튼이 안 눌린 것처럼 보였던 원인). */
      +'<div class="mys-msg" id="mysMsg"></div>'
    +'</div>'
   +'</div>';

  regRenderTabs();
  regRenderExpr();
  regRenderStats();
  regBindFields();
}

function regRenderTabs(){
  const wrap=el('mysTabs'); if(!wrap) return;
  wrap.innerHTML='';
  for(let i=0;i<MYS_SLOTS;i++){
    const a=MYS.agents[i];
    const label='A-'+String(i+1).padStart(3,'0');
    const cls='mys-tab'+(i===editSlot?' on':'')+(agentFilled(a)?'':' empty');
    const t=h('<div class="'+cls+'">'+mysEsc(label)+(MYS.active===i?' ●':'')+'</div>');
    t.addEventListener('click', ()=>{ editSlot=i; previewKey='normal'; regRender(); });
    wrap.appendChild(t);
  }
}

function regRenderExpr(){
  const wrap=el('mysExpr'); if(!wrap) return;
  wrap.innerHTML='';
  const a=agent(editSlot);
  STAND_KEYS.forEach(k=>{
    /* ★ a.stand[k] 는 그림이 아니라 표('local:칸이름')다. 그대로 <img src> 에 박으면
       보관소로 옮긴 그림이 등록칸에서만 안 보인다 — 큰 미리보기(standUrl)는 멀쩡해서
       "껐다 켜니 표정칸이 비었다"로 읽힌다. 조회는 예외 없이 mysImgGet 을 거친다. */
    const url=mysImgGet(a.stand[k]);
    const cell=h('<div class="mys-ecell'+(url?' has':'')+'" title="'+STAND_LABEL[k]+' — 클릭: 등록 · 우클릭: 삭제">'
      +'<div class="bx">'+(url?'<img src="'+mysEsc(url)+'" alt="">':'＋')+'</div>'
      +'<span class="lb">'+STAND_LABEL[k]+'</span></div>');
    cell.addEventListener('click', ev=>{
      ev.stopPropagation();
      const slot=editSlot, key=k;
      mysUploadPng('mysStand'+slot+'_'+key, STAND_W, STAND_H, url=>{
        const local = (typeof url==='string' && url.indexOf('data:')===0);
        mysImgDrop(MYS.agents[slot].stand[key]);         // 덮어쓰기 전에 옛 칸을 비운다
        const ref = mysImgPut(slot, 'stand_'+key, url);
        MYS.agents[slot].stand[key]=ref;
        mysSave(); previewKey=key;
        /* ★ 서버에 못 올라가면 이 기기 안에만 남는다. 파티원 화면에는 안 뜬다 —
           나중에 드러나는 고장이라 등록하는 그 자리에서 말해준다.
           ⚠ '이 기기에 저장됐다'와 '이번 판에만 떠 있다'는 다른 일이다. 뒤쪽을 같은 말로
             안내하면 껐다 켠 다음에야 없어진 걸 알게 된다. */
        if(!mysImgSaved(ref)) mysRegSay('저장 공간이 부족해요 — 이 그림은 창을 닫으면 사라집니다', true);
        else if(local) mysRegSay('서버에 올리지 못해 이 기기에만 저장됐어요', true);
        else mysNetSendFace();                           // 서버 URL 이면 파티원에게도 보낸다
        regRender();
      });
    });
    cell.addEventListener('contextmenu', ev=>{
      ev.preventDefault(); ev.stopPropagation();
      if(!a.stand[k]) return;
      mysImgDrop(a.stand[k]);          // 제 칸도 같이 비운다 — 안 그러면 저장소에 남는다
      a.stand[k]=null; mysSave();
      if(previewKey===k) previewKey='normal';
      regRender();
    });
    // 등록된 칸에 마우스를 올리면 큰 스탠딩이 그 표정으로 바뀐다 — 확인용
    cell.addEventListener('mouseenter', ()=>{
      const u=mysImgGet(a.stand[k]); if(!u) return;     // ⚠ 여기도 표가 아니라 그림이어야 한다
      const big=el('mysStand'); if(!big) return;
      const img=big.querySelector('img'); if(img) img.src=u;
    });
    cell.addEventListener('mouseleave', ()=>{
      const big=el('mysStand'); if(!big) return;
      const img=big.querySelector('img'); const u=standUrl(previewKey, editSlot);
      if(img && u) img.src=u;
    });
    wrap.appendChild(cell);
  });
}

let statNodes={};      // 스탯 행 노드 참조 — 꾹 누르는 동안 DOM을 갈아엎지 않기 위해
let holdTimer=null;    // 꾹 누르기 반복 타이머(모듈 변수 — 함정 #4)

function regRenderStats(){
  const wrap=el('mysStats'); if(!wrap) return;
  wrap.innerHTML=''; statNodes={};
  const a=agent(editSlot);
  STAT_KEYS.forEach(k=>{
    const row=h('<div class="mys-st">'
      +'<span class="nm">'+STAT_LABEL[k]+'</span>'
      +'<button type="button">−</button>'
      +'<span class="vl">0</span>'
      +'<button type="button">＋</button>'
      +'<span class="bar"><i></i></span></div>');
    const b=row.querySelectorAll('button');
    statNodes[k]={ minus:b[0], plus:b[1], vl:row.querySelector('.vl'), bar:row.querySelector('.bar i') };
    bindHold(b[0], k, -1);
    bindHold(b[1], k,  1);
    wrap.appendChild(row);
  });
  regUpdateStats();
}

/* ★ 꾹 누르면 자동 증감.
   pointerdown에서 1칸 올리고, 0.4초 뒤부터 반복한다(오래 누를수록 빨라짐).
   ⚠ click과 pointerdown을 같이 걸면 한 번 눌러도 2칸 오른다 — pointerdown 하나만 쓴다.
   ⚠ 반복 중에 regRender()로 화면을 다시 그리면 지금 누르고 있는 버튼 노드가 사라져
      pointerup을 못 받고 타이머가 폭주한다. 그래서 반복 중에는 숫자만 갱신한다.
   ⚠ 버튼 밖에서 손을 떼도 멈추도록 document에도 안전망을 건다. */
function bindHold(btn, k, dir){
  btn.addEventListener('contextmenu', e=>{ e.preventDefault(); bump(k, dir*5); });
  btn.addEventListener('pointerdown', e=>{
    if(e.button===2 || btn.disabled) return;
    e.preventDefault();
    bump(k, dir);
    stopHold();
    let n=0;
    holdTimer=setTimeout(function rep(){
      n++;
      const step=(n>18?5:1);                 // 오래 누르면 5씩 — 50P까지 손가락이 안 아프게
      if(!bump(k, dir*step)){ stopHold(); return; }
      holdTimer=setTimeout(rep, n>18?70:(n>6?45:75));
    }, 400);
  });
  btn.addEventListener('pointerup', stopHold);
  btn.addEventListener('pointerleave', stopHold);
  btn.addEventListener('pointercancel', stopHold);
}
function stopHold(){ if(holdTimer){ clearTimeout(holdTimer); holdTimer=null; } }
document.addEventListener('pointerup', stopHold);    // 버튼 밖에서 떼도 멈춘다

/* 숫자·막대·등급·잔여 포인트만 갱신 (DOM 구조는 그대로) */
function regUpdateStats(){
  const a=agent(editSlot), left=pointsLeft(a), tot=totalPoints(a);
  STAT_KEYS.forEach(k=>{
    const n=statNodes[k]; if(!n) return;
    const v=a.alloc[k]|0;
    n.vl.textContent=v;
    n.bar.style.width=Math.min(100, v*10)+'%';
    n.minus.disabled=(v<=0);
    n.plus.disabled=(left<=0);
  });
  const rk=el('mysRank'); if(rk) rk.textContent=rankName(a);           // 등급은 분배 총합으로 바뀐다
  const lf=el('mysLeft'); if(lf) lf.innerHTML='잔여 <b>'+left+'</b>P <span style="color:#8b9dc0">/ '+tot+'P</span>';
}

/* 값이 바뀌었으면 true. 꾹 누르기 반복이 이 반환값으로 멈출 시점을 안다. */
function bump(k, d){
  const a=agent(editSlot);
  const cur=a.alloc[k]|0;
  const next=(d>0) ? cur+Math.min(d, pointsLeft(a)) : Math.max(0, cur+d);
  if(next===cur) return false;
  a.alloc[k]=next; mysSave(); regUpdateStats();
  return true;
}

function regBindFields(){
  const a=agent(editSlot);
  const nm=el('mysFName'), ag=el('mysFAge'), tr=el('mysFTrait');
  if(nm){ nm.value=a.name||''; nm.addEventListener('input', e=>{ a.name=e.target.value.slice(0,12); mysSave(); regRenderTabs(); }); }
  if(tr){ tr.value=a.trait||''; tr.addEventListener('input', e=>{ a.trait=e.target.value.slice(0,20); mysSave(); }); }
  if(ag){
    ag.value=a.age||'';
    /* 나이는 총 포인트에 관여하지 않으므로 분배를 건드릴 이유가 없다.
       (예전엔 나이대가 바뀌면 적성을 통째로 초기화했다 — 계수와 함께 제거) */
    ag.addEventListener('change', e=>{
      a.age=e.target.value;
      mysSave(); regRender();   // 나이대 라벨만 갱신
    });
  }
  const ph=el('mysPhoto');
  if(ph) ph.addEventListener('click', ()=>{
    const slot=editSlot;
    mysUploadPng('mysPhoto'+slot, PHOTO_W, PHOTO_H, url=>{
      mysImgDrop(MYS.agents[slot].photo);
      MYS.agents[slot].photo=mysImgPut(slot, 'photo', url);
      if(!mysImgSaved(MYS.agents[slot].photo))
        mysRegSay('저장 공간이 부족해요 — 이 그림은 창을 닫으면 사라집니다', true);
      mysSave(); regRender();
    });
  });
  const st=el('mysStand');
  if(st) st.addEventListener('click', ()=>{ exprOpen=!exprOpen; const w=el('mysExpr'); if(w) w.classList.toggle('on', exprOpen); });
  /* 소속 — 계정 공유값이라 요원 슬롯을 바꿔도 유지된다 */
  const bindPost=(id, key, max)=>{
    const n=el(id); if(!n) return;
    n.value=(MYS.post&&MYS.post[key])||'';
    n.addEventListener('input', e=>{ MYS.post[key]=e.target.value.slice(0,max); mysSave(); });
  };
  bindPost('mysPPlanet','planet',3);
  bindPost('mysPUniv','universe',3);
  bindPost('mysPCountry','country',10);

  /* 오염도는 사건 중에만 오른다 — 여기서 손으로 만지는 창구는 두지 않는다.
     (연출 확인용 클릭 조작구가 있었으나 확인이 끝나 제거)
     사건일지를 붙일 때는 이 값을 직접 쓰지 말고 판정 결과 쪽에 단일 창구를 만들 것. */

  const rs=el('mysReset');
  if(rs) rs.addEventListener('click', ()=>{ STAT_KEYS.forEach(k=>a.alloc[k]=0); mysSave(); regRender(); });
  const pk=el('mysPick');
  if(pk) pk.addEventListener('click', ()=>{
    const tag='A-'+String(editSlot+1).padStart(3,'0');
    if(MYS.active===editSlot){ regMsg(tag+'은(는) 이미 파견 대기 중입니다.'); return; }
    /* 이름이 비어 있으면 사건일지에서 누가 누군지 구분이 안 된다 — 이름만 필수로 본다 */
    if(!String(a.name||'').trim()){
      regMsg('성명을 먼저 입력해 주세요.', true);
      const nmEl=el('mysFName'); if(nmEl) nmEl.focus();
      return;
    }
    MYS.active=editSlot; mysSave(); regRender(); mysRender();
    regMsg(tag+' '+a.name+' 요원을 파견 대기로 지정했습니다.');
  });
}

/* 창 안 안내문 — 3초 뒤 사라진다 */
let msgTimer=null;
function regMsg(text, warn){
  const n=el('mysMsg'); if(!n) return;
  n.textContent=text; n.classList.toggle('warn', !!warn);
  if(msgTimer){ clearTimeout(msgTimer); msgTimer=null; }
  msgTimer=setTimeout(()=>{ const m=el('mysMsg'); if(m) m.textContent=''; msgTimer=null; }, 3000);
}

function regOpen(){
  if(!D || D.isVisiting()) return;
  editSlot=MYS.active; previewKey='normal'; exprOpen=false;
  regRender();
  D.openWindow(MYS_AGENTWIN);
}

/* ═══════════════════════════ 사건일지 창 ═══════════════════════════ */
let mysBody=null;

function mysRender(){
  if(!mysBody) return;
  /* 진행 중인 사건이 있으면 현장(지도)이 곧 사건일지 화면이다 */
  if(mysField()) return mysRenderField();
  const a=agent();
  const list=Object.keys(MYS_CASES);
  let board='';
  list.forEach(id=>{
    const c=MYS_CASES[id];
    const cleared=(MYS.cleared||[]).indexOf(id)>=0;
    const okc=mysCaseOk(id);
    const blk=okc ? mysPartyStartBlock(id) : '앞 사건을 먼저 끝내야 한다';
    board+='<div class="mys-foot"><span class="left">'+mysEsc(c.id)+' · <b>'+mysEsc(c.title)+'</b>'
      +(cleared?' <span style="color:#7fe0ee">[해결]</span>':'')+'</span>'
      /* ⚠ 못 누르는 이유를 적는다. 버튼만 죽여두면 고장으로 읽힌다(함정 37). */
      +(blk ? '<button type="button" class="go" disabled title="'+mysEsc(blk)+'">🔒 '
               +mysEsc(blk.length>18 ? blk.slice(0,18)+'…' : blk)+'</button>'
            : '<button type="button" class="go" data-case="'+mysEsc(id)+'">'
               +(cleared?'재조사':'착수')+'</button>')
      +'</div>';
    /* 제목만으로는 무슨 사건인지 모른다. 착수 버튼을 누르기 전에 판단할 근거를 준다. */
    if(c.intro || c.brief)
      board+='<p class="mys-brief">'+mysEsc(c.intro || c.brief)+'</p>';
  });
  mysBody.innerHTML=
    '<div class="mys-hdr">'
      +'<div class="cls">▲▣ CLASSIFIED · BUREAU OF TIMELINE INVESTIGATION</div>'
      +'<div class="depline"><div class="dep">'+mysEsc(postText())+'</div>'
        + mysSndBtnHtml() + '</div>'
    +'</div>'
    +'<div class="mys-body">'
      +'<p><b>의뢰 게시판</b></p>'
      +'<p style="font-size:11px;color:#8fa8d4">배정된 사건을 선택하면 현장 도면이 열립니다.</p>'
      +board
      +'<p class="mys-note">※ 이동은 <b>방향키</b>로만 합니다 · Enter/Space = 조사<br>'
      +'※ 지도를 <b>우클릭</b>하면 깃발을 꽂아 파티원에게 위치를 알립니다<br>'
      +'※ 잠긴 문은 그 방향으로 걸어가면 여는 판정을 합니다</p>'
    +'</div>'
    +'<div class="mys-meta">'
      +'<span>요원 <b>'+mysEsc(a && a.name ? a.name : '미등록')+'</b></span>'
      +'<span>등급 <b>'+mysEsc(rankName(a))+'</b></span>'
      +'<span>오염도 <b>'+taintOf(a)+'</b></span>'
      +'<span>해결 <b>'+((MYS.cleared||[]).length)+'</b>건</span>'
      +'<span>단서 조각 <b>'+(MYS.fragments|0)+'</b></span>'
      /* ★ 파티는 여기서만 만들고 나간다. 로비 하단 바 오른쪽 끝 —
         착수 버튼 옆에 두면 "혼자 착수"와 "같이 착수"가 같은 무게로 보인다. */
      + mysPartyBarHtml(true)
    +'</div>'
    + mysModalHtml();
  mysBody._mysLastHtml='';   // ★ 현장으로 돌아갈 때 diff가 변화를 감지하도록 캐시 리셋
  mysBindBoard();
}
/* 게시판의 [착수]도 안정 부모에 위임 — mysBindField 와 같은 이유(재렌더에 살아남는다) */
function mysBindBoard(){
  if(!mysBody || mysBody._mysBoardBound) return;
  mysBody._mysBoardBound=true;
  mysBody.addEventListener('click', ev=>{
    /* ⚠ 이 핸들러와 현장 핸들러(mysBindField)는 **같은 노드**에 둘 다 붙어 있고, 한 번 붙으면
       화면이 바뀌어도 떨어지지 않는다. 그래서 현장에서 누른 클릭이 여기까지 내려와
       같은 data-act 를 한 번 더 실행한다 — 토글이면 눌렀다 뗀 것처럼 원위치한다.
       (음소거를 눌렀더니 꺼졌다 켜지면서 곡이 처음부터 다시 나던 것이 이것이다.)
       현장이 서 있으면 이 핸들러는 남의 일이다. */
    if(mysField()) return;
    const pb=ev.target.closest && ev.target.closest('button[data-party]');
    if(pb){ ev.preventDefault(); mysOpenParty(); return; }
    /* 팝업 안의 버튼. ⚠ 현장 배선(mysBindField)과 같은 data-act 를 쓴다 —
       이름이 갈라지면 로비에서만 안 눌리는 버튼이 생긴다. */
    const ab=ev.target.closest && ev.target.closest('[data-act]');
    if(ab){
      ev.preventDefault();
      const act=ab.dataset.act;
      if(act==='mute')    mysToggleMute();
      else if(act==='partyin'){ const i=el('mysModalInput'); mysJoinCode(i?i.value:''); }
      else if(act==='partynew') mysJoinCode(mysMakeCode());
      else if(act==='partyout')   mysPartyLeave();
      else if(act==='partyready')  mysToggleReady();
      else if(act==='partylock')   mysLockParty();
      else if(act==='partyedit')   mysUnlockParty();
      return;
    }
    if(mysModal && ev.target.closest && ev.target.closest('#mysModal')
       && !ev.target.closest('.box')){ mysModal=null; mysRender(); return; }
    const b=ev.target.closest && ev.target.closest('button[data-case]');
    if(!b) return;
    ev.preventDefault(); mysBeginCase(b.dataset.case);
  });
  /* 로비에는 사건용 키 핸들러(mysBindKeys)가 안 걸려 있다. 팝업만큼은 여기서 받는다 —
     코드를 치고 Enter 를 눌렀는데 아무 일도 안 일어나면 그건 고장으로 읽힌다. */
  mysBody.addEventListener('keydown', ev=>{
    if(!mysModal || mysField()) return;
    if(ev.key==='Escape'){ ev.preventDefault(); mysModal=null; mysRender(); return; }
    if(ev.key==='Enter' && ev.target && ev.target.id==='mysModalInput'){
      ev.preventDefault(); mysJoinCode(ev.target.value);
    }
  });
}

function mysOpen(){
  if(!D || D.isVisiting()) return;
  mysRender();
  if(mysField()) mysBindKeys();
  D.openWindow(MYS_WIN);
}

function mysCleanup(){
  /* ⚠ 함정 #4: setTimeout 핸들은 모듈 변수에 담아 여기서 clear할 것.
     ⚠ 파티 구독(onValue)도 여기서 해제해야 요금이 새지 않는다.
     ⚠ document 방향키 리스너도 여기서 뗀다 — 창이 닫힌 뒤에도 살아 있으면
       바탕화면에서 방향키를 누를 때 게임이 몰래 움직인다. */
  exprOpen=false;
  if(msgTimer){ clearTimeout(msgTimer); msgTimer=null; }
  stopHold();
  mysUnbindKeys();
  mysSceneQueue=[];
  /* ⚠ 창을 닫아도 오디오는 살아 있다. 여기서 안 끄면 바탕화면으로 나간 뒤에도
     브금이 계속 흐르고, 사용자는 소리를 끌 방법을 못 찾는다. */
  mysBgmStop();
}

/* ═══════════════════════════ 🗺 현장 — 타일맵 · 칸 이동 ═══════════════════════════
   ★ 좀아칼(myhome-desktop.js의 advGenMap)과 근본적으로 다른 점 — 지도를 생성하지 않는다.
     좀아칼은 시드로 30×20을 절차 생성했다. 그건 "매번 다른 폐허"에 맞는 방식이고,
     추리는 정반대다. 사건마다 평면도가 고정이어야 단서를 특정 방에 박아둘 수 있고,
     "그 방에 갔는데 없었다"가 정보가 된다. 생성 지도에선 그게 불가능하다.
     그래서 지도는 사건 데이터에 문자열로 박고, 저장에는 seed 대신 caseId만 둔다.

   ★ 좀아칼에서 가져온 것 (거기서 값을 치른 것들)
     · 십자 이동만 허용(대각선 금지) — 건물 안에서 벽을 스쳐 지나가는 걸 막는다
     · innerHTML diff-guard + 안정 부모 클릭 위임 — 파티 콜백 재렌더가 클릭을 삼키던 버그
     · 팀원 좌표를 셀별 색 점으로 표시 (mysMateAt 훅 · 파티는 다음 단계)

   ★ 여기서 버린 것
     · 안개 = 반경 ±4 사각형 → 건물에선 벽을 뚫고 보인다. **방 단위 공개**로 바꿨다.
       한 칸이라도 들어간 방은 전체가 드러나고, 안 들어간 방은 문만 보인다.
     · 기력(스텝 코스트) → 없앴다. 추리에서 걸음 수를 아끼게 만들면 방을 안 뒤진다.

   ⚠ 판정은 주사위가 아니라 결정론적이다(수치 ≥ dc). 설계 1절 "답을 못 맞힌 원인이 운이면
     화가 난다"에 따른 것. 아카이브의 advD20을 이식할 때도 **문 잠금과 조사에는 쓰지 말 것.**

   ⚠⚠ 실패는 재시도로 뚫리지 않는다
     · 잠긴 문: 판정 실패 = **안 열린다.** 오염도만 +3
     · 조사:   판정 실패 = 단서를 못 얻는다. 오염도만 +3
     보정도 없고 재시도도 무의미하다(결정론이므로 결과가 같다). 그래서 같은 대상에 대한
     오염도 청구는 **1회뿐**이다 — 안 그러면 안 열리는 문을 연타해서 오염도만 100이 된다.

     ★ 그러므로 설계 쪽에 제약이 하나 생긴다 —
       **단계 정답의 근거가 잠긴 문 뒤에만 있으면 안 된다.**
       잠행이 낮은 요원은 그 문을 영구히 못 열고, 사건이 거기서 끝난다(교훈 7 위반).
       잠금 뒤의 단서는 '있으면 편한 것'이어야 하고, 정답 근거는 잠금 없이 닿는 곳에 둔다.
       sim-mys-map.js 가 이 조건을 검사하므로 어기면 검증기가 잡는다. */

/* ── 🔊 브금 ─────────────────────────────────────────────────────────
   ★ 오디오 객체는 모듈 변수 하나만 둔다. 착수할 때마다 새로 만들면
     포기·재착수를 반복했을 때 여러 곡이 겹쳐서 흐른다(끄는 쪽을 놓치기 때문).
   ★ 파일이 없거나 브라우저가 막아도 게임은 그대로 돌아가야 한다 — 전부 조용히 넘어간다.
   ⚠ 검증기·하네스는 Audio 가 없는 환경(node)에서 이 파일을 평가한다.
     typeof 로 막지 않으면 최상위가 아니라 착수 시점에 죽는다. */
let mysBgm = null;
/* ── 음소거 버튼 ─────────────────────────────────────────────────────
   ★ 입구는 하나다. 이 버튼도, 바탕화면 '환경 설정 ▸ 브금'도 결국 mysBgmSetVol 하나를 부른다.
     별도의 mute 플래그를 두면 "껐는데 소리가 난다"가 반드시 생긴다 — 볼륨 0 이 곧 끄기다.
   ★ 끄기 전 볼륨을 기억해 둔다(MYS.bgmLast). 안 기억하면 다시 켤 때 기본값으로 튀어서
     작게 듣던 사람이 갑자기 크게 듣는다.
   ⚠ 이모지(🔊)를 쓰지 않는다. 기기마다 모양과 크기가 달라 줄 높이가 밀린다. */
const MYS_SND_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true">'
  +'<path d="M11 5 6 9H3v6h3l5 4z"/>'
  +'<path d="M15.5 8.5a5 5 0 0 1 0 7"/>'
  +'<path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const MYS_SND_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true">'
  +'<path d="M11 5 6 9H3v6h3l5 4z"/>'
  +'<path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>';
function mysBgmMuted(){ return !MYS || MYS.bgmOn === false || (MYS.bgmVol|0) <= 0; }
function mysSndBtnHtml(){
  const off = mysBgmMuted();
  return '<button type="button" class="mys-snd'+(off?' off':'')+'" data-act="mute"'
    +' title="'+(off?'소리 켜기':'음소거')+'" aria-label="'+(off?'소리 켜기':'음소거')+'">'
    +(off ? MYS_SND_OFF : MYS_SND_ON)+'</button>';
}
function mysToggleMute(){
  if(!MYS) return;
  if(mysBgmMuted()){
    /* 기억해 둔 값으로 돌아간다. 없으면(처음부터 0이던 사람) 기본값. */
    const back = (MYS.bgmLast|0) > 0 ? (MYS.bgmLast|0) : 35;
    mysBgmSetVol(back);
  } else {
    MYS.bgmLast = MYS.bgmVol|0;
    mysBgmSetVol(0);
  }
  mysRender();
}
function mysBgmStop(){
  if(!mysBgm) return;
  try{ mysBgm.pause(); mysBgm.currentTime = 0; }catch(_){}
  mysBgm = null;
}
function mysBgmPlay(list){
  mysBgmStop();
  if(!MYS || MYS.bgmOn === false) return;
  if(typeof Audio !== 'function') return;
  const paths = [].concat(list || []).filter(Boolean);
  if(!paths.length) return;
  let i = 0;
  const tryNext = () => {
    if(i >= paths.length){ mysBgm = null; return; }   // 다 없으면 조용히 포기
    const a = new Audio(paths[i++]);
    a.loop = true;
    a.volume = Math.max(0, Math.min(1, (MYS.bgmVol == null ? 35 : MYS.bgmVol) / 100));
    a.onerror = () => { if(mysBgm === a) tryNext(); };
    mysBgm = a;
    /* 자동재생 차단은 예외가 아니라 거부된 Promise 로 온다. 잡지 않으면 콘솔이 빨개진다. */
    const p = a.play();
    if(p && p.catch) p.catch(()=>{});
  };
  tryNext();
}
function mysBgmSetVol(n){
  MYS.bgmVol = Math.max(0, Math.min(100, n|0));
  MYS.bgmOn = MYS.bgmVol > 0;
  if(mysBgm){ try{ mysBgm.volume = MYS.bgmVol/100; }catch(_){} }
  if(!MYS.bgmOn) mysBgmStop();
  else if(!mysBgm && mysCase()) mysBgmPlay(mysCase().bgm);
  mysSave();
}

/* ── 🎲 주사위 ─────────────────────────────────────────
   ★ 항상 1d100 롤언더. **낮을수록 좋다. 예외 없다.**
     심문자 선정 굴림도 낮은 쪽이 이긴다 — 한 화면에 방향이 둘이면 매번 헷갈린다.

   목표치(%) = 50 + (적성 − dc) × 5   [5~95로 자름]
   적성과 dc가 같으면 정확히 반반이다. 플레이어가 계산 없이 감을 잡을 수 있는 게 이 식의 목적이다.
   ⚠ 난이도를 움직일 때는 개별 dc가 아니라 아래 상수 둘을 만질 것.

   성공 등급(TRPG 관례) — 목표치에 비례하므로 잘하는 사람이 극단 성공도 자주 낸다.
     roll ≤ 목표/5  극단 성공   roll ≤ 목표/2  어려운 성공   roll ≤ 목표  보통 성공
     대실패: 목표 ≥ 50 이면 100만, 목표 < 50 이면 96~100 (실력이 낮을수록 사고가 잦다)

   ★ 굴림 자격 — 적성 ≥ dc − 3 이어야 굴린다. 미달이면 손도 못 대고 오염도도 안 붙는다.
     이게 없으면 적성 0으로도 계속 굴려 오염도만 내고 전부 뚫린다. 그러면 적성 분배가
     '언젠가 되긴 되는 것'의 속도 조절로 격하되고, 누가 무엇을 맡을지 정하는 전략이 죽는다. */
const MYS_ROLL_BASE = 50;   // 적성 == dc 일 때의 목표치(%)
const MYS_ROLL_STEP = 5;    // 적성·dc 1당 목표치 증감
const MYS_ROLL_MIN  = 5;    // 확실한 실패는 없다
const MYS_ROLL_MAX  = 95;   // 확실한 성공도 없다
const MYS_GATE      = 3;    // 굴림 자격: 적성 ≥ dc − MYS_GATE

/* ── 오염도 ──────────────────────────────────────────────────────────
   ⚠ 실패는 시도마다 청구한다. (결정론 시절의 '같은 대상 1회만' 규칙은 폐기 —
     주사위에서는 재도전이 정상 플레이이므로 1회 청구면 사실상 무료가 된다) */
const MYS_TAINT_FAIL   = 3;   // 실패
/* ★ 대실패도 +3이다. 예전엔 6이었는데, 굴림 한 번이 오염도의 1/15을 먹으면
   플레이어가 굴리는 것 자체를 피하게 된다 — 조사를 안 하는 게 이득이 되는 순간 게임이 끝난다.
   대실패의 무게는 오염도가 아니라 경로별 부작용(mysFumble)으로 준다. */
const MYS_TAINT_FUMBLE = 3;   // 대실패
/* ★ 극단 성공은 오염도를 되돌린다. 회복 수단이 집중 레벨업뿐이면 오염도는 한 방향으로만 가고,
   그러면 '언제 굴릴까'가 아니라 '몇 번까지 굴려도 되나'를 세는 게임이 된다. */
const MYS_TAINT_HEAL   = 3;   // 극단 성공
const MYS_TAINT_WATCH  = 1;   // 심문 관전자 (심문 구현 시 사용)
const MYS_TAINT_LOST   = 100; // 이 값에 닿으면 요원 Lost — 본부 정화 전까지 사용 불가
const MYS_TAINT_GLITCH = 70;  // 이 값을 넘으면 현장 화면이 흔들린다(자기 시간선이 흐려지는 연출)
const MYS_FOCUS_HEAL   = 30;  // 집중 레벨이 오르면 오염도 −30

const MYS_ZONES = {
  S:{ name:'제7보관실', col:'#3c4c6e' },
  R:{ name:'기록실',    col:'#3c4c6e' },
  A:{ name:'관리자실',  col:'#3c4c6e' },
  M:{ name:'정비실',    col:'#3c4c6e' },
  N:{ name:'숙직실',    col:'#3c4c6e' },
  L:{ name:'로비',      col:'#3c4c6e' },
  C:{ name:'중앙 복도', col:'#4a6a9c' },   // 통로는 방보다 밝게 — 동선이 한눈에 보인다
  B:{ name:'후문 복도', col:'#4a6a9c' },
};
/* 지도 색 — 한곳에 모아둔다. 방 색만 MYS_ZONES 에 두면 나머지가 CSS 로 흩어져
   색을 손볼 때마다 두 군데를 뒤지게 된다. */
/* 지도 아이콘 — 글리프만 바꾸면 되도록 한곳에 모은다.
   SVG 로 갈아끼울 때도 여기 값만 교체하면 렌더는 손대지 않아도 된다. */
/* 잠금 패드의 점을 그리는 순서. 키패드(넘버패드)와 같다 — 윗줄이 7 8 9 다. */
const MYS_PAD_ORDER = [7,8,9,4,5,6,1,2,3];
const MYS_ICON = {
  npc:'🧍',      // 사람이 있는 칸(심문 대상). 사람은 숨기지 않는다
  body:'😵',     // 시신
  /* ⚠ 사물 단서에는 표시가 없다. 예전의 '?' 를 되살리지 말 것 —
     물음표를 찍는 순간 플레이어는 그 칸만 직행하고 방을 뒤지지 않는다. */
  done:'✓',
  lock:'🔒',
  door:'▫',
  looked:'·',
};
const MYS_MAPCOL = {
  fog:'#05070c',      // 미탐색
  wall:'#16223c',     // 벽(= 지도 배경)
  edge:'#6b7ea6',     // 방 윤곽선
  door:'#8a742e',     // 문
  doorLock:'#8c2f2f', // 잠긴 문
  me:'#f5c542',       // 내 위치
  flag:'#e0684a',     // 내 깃발
};

/* ── 조사 공백을 채우는 문구 ────────────────────────────────────────
   ★ 단서가 없는 칸을 눌렀을 때 "조사할 것이 없다"만 뜨면 플레이어는 두 번째 방부터
     칸을 안 누른다. 그러면 단서를 방에 숨겨둔 설계 자체가 무의미해진다.
   ★ 그러므로 플레이버 조사는 판정도 오염도도 없다. 무조건 성공한다.
     여기에 dc나 오염도를 붙이면 "둘러본 죄"로 벌을 주는 셈이고,
     플레이어는 확실한 칸만 누르게 된다 — 정확히 반대 효과다.
   ★ 칸마다 문구를 박으면 방 칸이 200개라 데이터가 감당이 안 된다.
     방별 풀에서 좌표로 고른다(같은 칸은 항상 같은 문구 — 장소가 실재하는 느낌).
   ⚠ 여기에 단서처럼 읽히는 문구를 넣지 말 것. 플레이어를 속이는 것이고,
     진짜 단서를 흘려보내게 만든다. 비어 있음이 분명하게 읽혀야 한다. */
const MYS_FLAVOR_ANY = [
  '먼지만 쌓여 있다.',
  '아무것도 없는 것 같다.',
  '눈에 걸리는 것이 없다.',
  '바닥재 이음선이 살짝 들려 있다. 그뿐이다.',
  '한참 들여다봤지만 그냥 벽이다.',
];

/* ── 사건 데이터 ──────────────────────────────────────────────────────
   ★ "새 편 추가 = 데이터 한 덩이 추가"가 되도록 로직에 사건 내용을 한 글자도 넣지 않는다.
     CASE-002를 만들 때 건드릴 곳은 이 객체 하나뿐이어야 한다.
   ★ spot(조사 지점)과 door(문)의 lock 은 반드시 path 태그를 가진다 —
     태그 없는 단서를 만들면 그 스탯이 죽은 스탯이 된다(설계 2절, 첫 번째 제약). */
const MYS_CASES = {
  'CASE-001': {
    id:'CASE-001', title:'사건의 시작',
    /* 튜토리얼 — 90에서 활동 중지(요원 교대). 이후 사건은 이 값을 빼면 100=Lost 가 된다. */
    taintCap:90,
    floor:'중앙 지부 청사 1층',
    /* ★ 문구는 사건 원문의 '한 줄 요약'을 그대로 쓴다. 여기서 새로 지어내면
         문서와 화면이 갈라진다.
       ⚠ 원문은 하도경의 직위를 한 번은 '정비원', 발견 장소를 한 번은 '후문 복도'로 적었는데
         본문에서는 '관리관'·'중앙 복도'다. 관리관/중앙 복도로 통일했다 —
         정비원은 캬타이고, 후문 복도는 경비 B의 근무 구역이라 발견자가 겹친다.
         무엇보다 제7보관실은 서쪽 끝이라, 접촉 직후 뇌사가 시작된 사람이
         지부를 가로질러 동쪽 후문까지 갔다는 게 성립하지 않는다. */
    brief:'중앙 지부 제7보관실에서 오류물 브랜치가 사라졌다',
    intro:'중앙 지부 제7보관실에서 오류물 브랜치가 사라졌다. '
         +'기록 대장에는 관리관 하도경이 가져간 것으로 적혀 있다. '
         +'그런데 그 글씨는 하도경의 것이 아니고, 하도경은 중앙 복도에서 시신으로 발견됐다.',
    start:'10,11',   // 로비 — 현관으로 들어온 자리

    /* ── 착수 브리핑 ──
       ★ CASE-001은 튜토리얼이다. 세계관 설명을 게시판 글로 깔면 아무도 안 읽는다.
         지부장이 요원들 앞에서 말하는 형태여야 읽힌다.
       ★ 파티를 전제로 말한다("자네들") — 솔로에서도 어색하지 않고,
         파티가 붙었을 때 대사를 다시 쓰지 않아도 된다.
       ⚠ 여기에 단서를 넣지 말 것. 브리핑은 '무엇을 왜 하는가'까지고,
         '어디에 무엇이 있는가'는 현장에서 굴려서 알아내는 것이다.
       ★ 한 줄 = 한 문장(길어도 둘). 클릭 한 번에 문장이 끝나야 읽힌다 —
         문장을 두 줄에 걸치면 반 토막 문장을 읽고 다음 클릭을 기다리게 된다.
       ⚠ 45줄에서 24줄로 줄였다(같은 지적을 받아서). 세계관 상세는 잘랐다 —
         더 줄이려면 내용을 빼야 하는데, 검증기가 '브리핑 20줄 초과'를 요구하므로
         21줄 밑으로는 내리지 말 것. */
    briefingWho:'수사국 지부장',
    briefing:[
      '인사 나눌 것 없다. 한시가 바쁘니까 바로 들어가지.',
      '자네들은 이번 건 하나를 위해 각 지부에서 차출된 요원들이다.',
      '나는 이 사건을 담당한 제3 중앙 지부의 지부장이고.',
      '서로 초면인 것도 안다. 그래도 오늘 안에 맞춰라.',
      '먼저 여기가 어딘지부터. 중앙 지부다.',
      '어느 행성에도, 어느 우주에도 속하지 않는 완충 지대야.',
      '누구의 편도 들지 않는 대신, 어디에도 둘 수 없는 물건을 맡는다.',
      '기밀 등급 오류물이 전부 중앙에 모여 있는 이유다.',
      '그중 하나가 어젯밤 사라졌다.',
      '명칭은 브랜치(Branch). 시간선을 국소적으로 되감는 물건이다.',
      '되감긴 구간에서 다른 선택이 일어나면 시간선이 갈라져 평행 세계가 생긴다.',
      '방치하면 시간선이 기하급수적으로 늘고, 자칫 행성 간 협약이 깨진다.',
      '반드시 회수해야 하는 사안이야. 지금도 각 지부 수사국이 총력으로 움직이고 있다.',
      { t:'경고 하나. 오류물을 발견하거든 맨몸으로 닿지 마라.', e:'angry' },
      '말 그대로 오류다. 장비 없이 닿으면 몸이든 정신이든 오염된다. 죽거나, 사라진다.',
      '미안하지만 사건 현장도 이미 공기에 오류가 노출된 상태다.',
      '장비복은 없다. 청소부를 기다릴 여유도 없고.',
      { t:'...사건을 해결하고 오면 정화 시스템을 건네주마.', e:'normal' },
      '왜 지금 안 주냐고? 가벼운 테스트 같은 거다. 이 정도로 죽는다면 곤란하니까.',
      '사건 개요다. 어젯밤 이곳에서 관리관 하나가 죽었다.',
      '기록 대장에는 그 관리관이 마지막으로 오류물을 반출한 것으로 적혀 있는데,',
      '검사 결과 그 글씨는 본인 것이 아니었다. 용의자 중에 대조되는 글씨도 없어.',
      '자네들이 할 일은 두 가지다. 하나, 브랜치 행방의 단서를 모은다. 둘, 진범을 잡아온다.',
      '해결하면 약속대로 정화 시스템을 주지. 시작해라.',
    ],

    /* ── 브금 ──
       ★ 파일은 게임 파일 옆에 둔다. 릴리스에서 parts/ 로 들어가므로 두 경로를 다 시도한다.
         파일이 없어도 게임은 그대로 돌아간다(조용할 뿐).
       ⚠ 브라우저는 사용자 조작 없이 소리를 못 낸다. 착수는 버튼 클릭이라 통과한다 —
         저장 복구로 자동 재개될 때는 안 울리는 게 정상이다. */
    bgm:['parts/mys-case001.mp3', 'mys-case001.mp3'],

    /* ── 결말 ──
       ★ 브랜치는 회수하지 못한다. 범인을 잡는 것으로 사건은 끝나지만 물건은 밖에 있고,
         그 뒷수습이 이후 사건들의 발단이 된다(설계 7절). 보상은 그 추적선으로 이어지는
         단서 조각뿐이다 — 여기서 물건을 되찾게 하면 다음 사건이 설 자리가 없다.
       ⚠ 조각은 최초 클리어에만 준다. 재조사로 반복 수급되면 수치가 의미를 잃는다. */
    /* clearTaint 는 튜토리얼 전용이다. CASE-002부터는 fragments 만 준다 — 매번 씻어주면
       오염도라는 자원이 사건 단위로 초기화되어 요원 교대도 정화 비용도 의미가 없어진다. */
    reward:{ fragments:3, purifier:true, clearTaint:true },
    epilogue:[
      '제이미 영은 이미 브랜치를 암거래상에게 넘긴 뒤였다. 물건은 회수하지 못한다.',
      '시정국이 뒷정리를 하러 온다. 가지가 몇 개 늘었는지는 아무도 세지 못한다.',
      '바로잡아야 할 사건은 이제부터 늘어나고, 시정국은 인력이 부족하다. 그 뒷수습은 결국 수사국이 맡게 된다.',
    ],

    /* ── 지목 ──
       ★ 마지막은 '입력'이 아니라 '선택'이어야 한다. 이름을 타이핑하게 하면
         띄어쓰기 하나로 막히고, 그 순간 사건이 아니라 맞춤법 싸움이 된다.
       ⚠ 답 자체는 여전히 마지막 단계(stages 의 answer)가 들고 있다. 목록에서 고른 이름을
         같은 제출 경로로 흘려보낸다 — 정답 판정이 두 군데로 갈라지면 한쪽만 고쳐진다. */
    accuse:{ label:'범인 지목',
             note:'용의자 하나를 지목한다. 틀리면 오답으로 쌓인다.' },

    /* ── 종결 연출 ──
       ★ 네 장면으로 끊는다 — 그날 밤(과거) · 체포(현재) · 본인 · 지부장.
         한 덩이로 붙이면 시제와 화자가 섞여서 누구 말인지 안 읽힌다.
       ★ 여기서 새로 밝히는 사실은 없다. 전부 플레이어가 이미 모은 단서의 순서를
         맞춰 보여주는 것이다 — 지목 뒤에 처음 듣는 사실이 나오면 추리가 무의미해진다.
       ⚠ 브랜치는 끝내 회수되지 않는다(설계 7절). 여기서 되찾게 하면 다음 사건이 설 자리가 없다. */
    finale:[
      { who:'그날 밤', kind:'recap', lines:[
        '범행 시간 전 21시 40분. 제이미 영은 며칠 전 빼돌린 관리자 카드로 관리자실에 들어가 CCTV 제어 기록을 끊어두며 장비 보관대에서 장비복 한 벌을 꺼내 입었다.',
        '그리고 제7보관실을 향한다. 카드 인식 소리가 들리며 문이 열렸다.',
        '보관실 안 높은 칸의 상자 하나. 기밀 오류물 브랜치(Branch)를 꺼냈다.',
        '반출 대장에는 하도경의 이름을 적었다. 들키더라도 이것만 빼돌리고 자신은 다른 행성으로 도망치면 된다.',
        '이미 선수금으로 받은 돈이 넉넉하다. 발걸음이 가벼워진 제이미 영은 야근 경비가 오기 전 서둘러 보관실을 나섰지만',
        '중앙 복도에서 하도경과 마주쳤다. 제이미 영에게서 자신의 관리자 카드를 발견한 뒤부터 몰래 경계한 하도경이 뒤를 밟은 것이다.',
        '말싸움이 시작됐다. 장비복으로 얼굴과 목소리가 가려져 시치미를 뗐으나 이미 하도경은 제이미 영이란 것을 알고 있었다.',
        '자식 있는 사람이라 자신보다 어린 제이미 영을 타일러도 보았지만, 들켰다는 압박감에 상대는 극단적인 선택을 한다.',
        '기밀 오류물을 그대로 무기 삼아 하도경에게 휘둘렀다. 하도경은 맨손이었고, 제이미 영은 그의 품에 밀어 넣었다.',
        '하도경이 침식하는 오염에 발버둥치며 제이미 영의 장비복 장갑을 벗겼다.',
        '사건 발생 22시 05분. 두 사람의 워치가 같은 시각에 멈췄다.',
        '제이미 영은 서둘러 장갑을 끼고 도망간다.',
        '22시 20분, 순찰이 시신을 발견했다. 22시 30분, 후문이 안에서 한 번 열렸다.',
      ] },
      { who:'체포', kind:'recap', lines:[
        '기록실 문을 열었을 때 제이미 영은 서류를 정리하고 있었다.',
        '도주도, 변명도 없었다. 손목이 채워지는 동안에도 표정이 거의 변하지 않았다.',
      ] },
      { who:'제이미 영', lines:[
        { t:'…관리관을 죽일 생각은 없었습니다. 라고 말해도 변명일 뿐이죠.', e:'normal' },
        { t:'자식도 있으면 몸을 사렸어야지… 왜 뒤를 따라와서…', e:'angry' },
        { t:'물건은 이미 제 손을 떠났습니다. 중간 운반책한테 줬으니 어딨는지도 몰라요.', e:'talk' },
        { t:'왜 진작에 도망가지 않았냐고요?', e:'normal' },
        { t:'그것까지 알려줄 의무는 없습니다. 이 침묵이 나에게 유리한 시간선을 만들어 줄지도 모르니까요.', e:'smile' },
      ] },
      { who:'수사국 지부장', lines:[
        { t:'수고했다. 첫 건치고는 깔끔했어.', e:'smile' },
        '아직 물건의 행방을 알 수 없지만… 범인을 심문하면 무언가 나오겠지.',
        '제이미 영은 중앙 본부로 넘긴다. 행방과 심문은 그쪽이 맡을 거야.',
        '약속한 건 주지. 정화 시스템이다. 앞으로는 스스로 씻을 수 있을 거야.',
        '사용법이 뭐냐고? 흠… 알아들을 수 있을지 모르겠지만, 이 곳과 무관한 지구라는 행성에서 정직하게 시간을 쌓는 사람들의 기운을 모은 장치라고 해야 할까… 무슨 말인지 모르겠다고?',
        /* ★ 실제 수치(mysApplyFocusHeal 의 −30)를 말로 한 번 짚어준다. 안 짚으면
           보상을 받고도 그게 무엇인지 모른 채 다음 사건으로 넘어간다. */
        '포커싱 어플로 레벨업하면 오염 수치가 -30 내려간다는 소리다. (헛기침을 한다.)',
        { t:'자 그러면 이제 브랜치가 밖에 있는 이상 수많은 사건들이 나타나겠지. 각오하는 게 좋을 거야.', e:'think' },
        { t:'사건이 발생하면 그 때 다시 연락하지.', e:'normal' },
      ] },
      { who:'정리', kind:'recap', lines:[
        '수사국으로 돌아가 사건을 기다리자.',
      ] },
    ],
    /* ★ 말투는 인물마다 다르다. 대사를 lines 로 나눠 담아야 말투가 산다 —
       한 줄로 뭉치면 누가 말해도 같은 사람처럼 읽힌다. */
    suspects:[
      { name:'제이미 영', role:'신입 기록관', note:'반출 대장 담당 · 기록실 문 앞' },
      { name:'하도경',   role:'관리관',     note:'중앙 복도에서 발견' },
      { name:'캬타',     role:'정비원',     note:'정비실 · 제52 행성 출신' },
      { name:'야간 경비 A', role:'경비',    note:'로비 · 화장실에 있었음' },
      { name:'야간 경비 B', role:'경비',    note:'후문 복도 · 시신 발견자' },
    ],
    bodies:[ { at:'12,6', name:'하도경 관리관' } ],

    /* ── NPC 스탠딩 ──
       파일: parts/npc/<img>_<표정>.png · 없으면 parts/npc/<img>.png · 그것도 없으면 이름표.
       표정 키는 STAND_KEYS 와 같다 — normal talk think smile angry sad fluster surprise.
       ★ 지금은 자산이 하나도 없다. 그래도 선언은 해둔다 — 그림을 넣는 날 코드를 고칠 일이
         없어야 하고, 없는 동안에는 지금과 똑같이 이름표로 보인다.
       ⚠ 키는 화자 이름이다. 재심문의 괄호(캬타 (한 번 더))는 엔진이 떼고 찾는다. */
    cast:{
      '수사국 지부장':{ img:'chief' },
      '제이미 영':{ img:'jamie' },
      '캬타':{ img:'kyata' },
      '야간 경비 A':{ img:'guard_a' },
      '야간 경비 B':{ img:'guard_b' },
    },

    /* ── 문 ──
       stage : 그 단계를 통과하면 열린다(암호 잠금의 결과)
       item  : 아이템을 가지고 있으면 열린다. needOpen 이면 그 아이템의 잠금까지 풀려 있어야 한다
       roll  : 판정으로 연다. bypass 아이템이 있으면 판정 없이 열린다
       ★ 관리자실은 판정으로 열리지 않는다. 하도경의 워치에 관리실 NFC가 들어 있고,
         그 워치는 패턴을 풀어야 쓸 수 있다 — 시신 조사 → 패턴 해제 → 관리자실이 사건의 척추다.
         여기에 잠행 우회로를 두면 척추를 통째로 건너뛰고 기록실 락까지 풀려 버린다. */
    doors:[
      { at:'4,5',  name:'제7보관실 문', lock:{ type:'stage', n:1 } },
      { at:'11,5', name:'기록실 문',    lock:{ type:'item', item:'card' } },
      { at:'16,5', name:'관리자실 문',  lock:{ type:'item', item:'watch', needOpen:true } },
      { at:'10,8', name:'로비 문' },
      { at:'3,8',  name:'정비실 문' },
      { at:'17,8', name:'경비 대기실 문' },
      { at:'20,6', name:'후문 복도 통로' },
    ],

    /* ── 아이템 ──
       lock 이 붙은 아이템은 소지품에서 눌러 잠금을 푼다. */
    items:{
      /* ★ hintClue — 잠금 화면 문구는 감식(c207)으로 읽어낸 뒤에만 팝업에 뜬다.
         공짜로 띄우면 설계 6절 ③(감식 6 · 워치 잠금 화면)이 통째로 없는 단계가 된다.
         ⚠ 힌트는 잠금 '앞'에 있다 — 정답 근거를 잠금 뒤에 두지 않는다는 조건(9절)을 지킨다. */
      /* ★ 패턴은 아홉 점 중 '어느 점들인가'다 — 판정은 집합 비교(mysPatternSubmit).
         순서는 보지 않는다. 점을 아무 순서로 찍어도, 숫자를 아무 순서로 쳐도 열린다.
         (예전에는 574269 순서까지 맞춰야 했다 — 난이도를 낮추며 순서 조건을 걷어냈다.)
         입력 방법을 하나로 강제하면 "점은 찍겠는데 어느 게 5번이냐"에서 멈춘다 — 둘 다 받는다.
       ⚠ 어느 점들인지는 잠금 '앞'의 단서(c207 · 감식 6)로만 드러난다. 팝업 힌트도 그 단서를
         얻은 뒤에만 뜬다 — 공짜로 띄우면 감식 경로가 통째로 없는 단계가 된다. */
      /* ★ 아홉 점의 번호는 **키패드(넘버패드) 배열**이다. 계산기와 같다:
             7 8 9
             4 5 6
             1 2 3
         ⚠ 전화기 배열(1 2 3 / 4 5 6 / 7 8 9)이 아니다. 화면의 점도 이 순서로 그린다
           (mysModalHtml) — 데이터와 화면이 어긋나면 "그 점을 찍었는데 안 열린다"가 된다.

         지금 패턴이 켜는 점 — ■ 가 눌러야 할 점이다:
               ■·■        윗줄  : 7 · (8 안 씀) · 9
               ■■■        가운데: 4 · 5 · 6
               ·■·        아랫줄: (1 안 씀) · 2 · (3 안 씀)

         → 켜야 할 키패드 번호의 집합은 {2,4,5,6,7,9} 이다. 어떤 순서로 넣어도 같다. */
      watch:{ name:'하도경의 전자 워치', desc:'22:05에 멈춰 있다.',
              lock:{ type:'pattern', pattern:[5,7,4,2,6,9], hintClue:'c207',
                     /* ⚠ 여기에 정답 순서를 적지 않는다. 적어두면 잠금이 '읽고 옮겨 적기'가 된다.
                        힌트는 '어떻게 넣는가'까지고, '무엇을 넣는가'는 잠금 앞의 단서에서 온다. */
                     hint:'잠금 화면 문구는 "민이야 사랑해". '
                         +'순서는 상관없다 — 해당하는 점을 다 누르거나, 그 숫자를 치면 된다.' },
              opened:'메모패드와 관리실 인식칩이 들어 있다.' },
      card:{ name:'기록관 카드', desc:'제이미 영에게 받았다.' },
      auth:{ name:'전자 책장 해제', desc:'관리자실 인식기가 워치를 읽었다.' },
    },

    /* ── 단계 ──
       code      : 그 칸(at)에 가서 둘러보면 입력창이 열린다
       itemcode  : 소지품의 그 아이템을 눌러야 입력창이 열린다
       condition : 답안 없이, 지정한 단서를 얻으면 넘어간다
       ⚠ 무엇을 넣어야 하는지 알려주지 않는다. 이름은 '그 자리에 뭐가 있는지'까지만. */
    /* ★ reveal — 그 잠금을 풀어야만 나오는 내용. 잠금을 '통과 표시'로만 쓰면
       암호를 맞힌 순간이 그냥 문 열림으로 끝나서, 무엇을 알아냈는지가 사라진다.
       ⚠ 여기에 다음 단계의 정답 근거를 넣지 말 것(9절) — 정서와 확인만 담는다. */
    /* ── hint ──
       ★ hint — 그 단계의 잠금 입력창에 뜨는 한 줄. '무엇을 넣는 자리인가'까지만 적는다.
         화면에 상시 떠 있는 목표줄(goal)은 뺐다 — 방향은 현장에 놓인 단서가 말하게 한다
         (안내문·낙서·플레이버로 같은 정보를 여러 갈래 깔아뒀다. spots 쪽 주석 참조).
       ⚠ 정답(2200 · 832 · 이름)을 적지 말 것. 검증기(잠금 검사)가 힌트에 정답이 있으면
         잡고, 무엇보다 추리가 받아쓰기가 된다. */
    stages:[
      { n:1, type:'code',      at:'4,6', name:'제7보관실 키패드', answer:'2200',
        hint:'그날 먼저 출근 카드를 찍은 경비의 기록 시각. 네 자리.',
        reveal:['키패드가 풀렸다. 제7보관실 문이 열린다.'] },
      { n:2, type:'condition', needClue:'c206', name:'반출 대장 대조',
        reveal:['대장에 적힌 이관 기록은 하도경이 쓴 것이 아니다. 그런데 하도경은 죽어 있다.'] },
      /* ★ 조합해야 나오는 답 — 단서에 '832'가 통째로 적혀 있지 않다.
         제8 행성 + 제32 우주를 붙여야 한다. 검증기가 '정답이 단서에 없다'고 잡지 않도록
         derived 로 표시하고, 근거가 되는 단서를 from 에 적어 존재·도달성만 확인시킨다. */
      /* ★ revealWho — 이 잠금이 감추고 있던 것은 '읽을거리'가 아니라 장면이다.
         기록 창에 조사 로그로 흘리면 여섯 줄이 오른쪽 구석에서 스쳐 지나가고,
         플레이어는 무엇을 열었는지 모른 채 4단계로 넘어간다.
         ⚠ 여기 오려고 시신 앞까지 다시 걸어가게 하지 않는다 — 워치는 소지품이고,
           소지품에서 잠금을 푼 자리에서 곧바로 스크립트가 흐른다. */
      /* ★ revealThen — 잠금이 열린 '다음'에 뜨는 한 마디. 일기를 읽고 나면
         "그래서 이제 뭘 하지"가 곧바로 온다. 답을 말하지 않고 방향만 준다.
         ⚠ 여기에 4단계 정답 근거를 넣지 말 것. 어디를 다시 볼지까지다. */
      { n:3, type:'itemcode',  item:'watch', name:'워치 메모패드', answer:'832',
        hint:'하도경이 사람을 만나면 워치에 적어두던 그 번호. 세 자리.',
        derived:true, from:['c301','c302'],
        revealWho:'하도경의 일기', revealKind:'recap',
        revealThen:{ who:'정리', kind:'recap', lines:[
          '이름은 어디에도 없다. 자물쇠가 열렸다는 것 자체가 답이다.',
          '하도경은 이틀 전에 이미 알고 있었고, 아무한테도 말하지 못한 채 죽었다.',
          '남은 것은 그가 어떻게 죽었는가다. 그날 밤 복도에서 무슨 일이 있었는지 다시 훑어보자.'] },
        reveal:['잠긴 페이지가 열렸다. 날짜는 사건 이틀 전이다.',
                '「내 관리자 카드가 그 아이 손에 있는 것 같다.',
                ' 확신이 없어서 아무한테도 말을 못 했다.',
                ' 그래서 이 장은 그 아이의 번호로 잠가 둔다. 열리지 않기를 바라면서.',
                ' 민이야, 아빠가 틀렸으면 좋겠구나.」',
                '자물쇠가 열렸다. 하도경이 걸어둔 세 자리는 그 아이의 출신 번호였다.'] },
      /* ★ 마지막 단계에는 칸(at)이 없다. 지목은 어느 자리에서든 우측 [범인 지목] 으로 한다 —
         본부 단말까지 걸어가 이름을 타이핑하게 두면 같은 일을 하는 입구가 둘이 되고,
         지목 버튼이 생긴 뒤로는 단말 쪽이 늘 뒷전이라 반드시 한쪽만 고쳐진다.
       ⚠ 답(answer)은 여기 그대로 있다. 정답 판정은 mysSubmit 하나뿐이고,
         지목 팝업에서 고른 이름도 같은 경로로 흘러 들어간다. */
      { n:4, type:'accuse',    name:'범인 지목', answer:'제이미 영' },
    ],

    /* ── 정리 스크립트(recap) ──
       ★ 단서를 다 모아놓고도 "그래서 뭘 입력하라는 거지"에서 멈추는 사람이 있다.
         조각이 전부 손에 들어온 순간 한 번만 짚어준다 — 답은 말하지 않는다.
         답까지 말하면 추리가 아니라 받아쓰기가 된다.
       ⚠ need 에 적은 단서를 마지막으로 얻는 순간 자동으로 뜬다. 한 번만 뜬다. */
    recaps:[
      /* ⚠ 전에는 여기서 "먼저 찍은 쪽은 B" · "22:10은 A의 것" 까지 말했다.
         그러면 남은 일이 받아쓰기뿐이라, 경비 둘의 진술과 기록기가 전부 장식이 된다.
         짚어주는 것은 '무엇을 맞춰봐야 하는가'까지다. 맞추는 건 플레이어가 한다. */
      { id:'r1', need:['c101','c102','c103'], who:'정리',
        lines:['둘의 진술은 일치하는 것으로 보인다.',
               '보관실 암호는 그날 먼저 찍은 경비의 기록 시각이라는데…',
               '…먼저 찍은 쪽은 어느 쪽인가.'] },
      /* ★ 3단계용. 메모패드는 '세 자리'라는 것만 알고는 못 연다 —
         그 세 자리가 무엇을 뜻하는지가 경비 둘의 진술에서 나온다.
         여기서도 답은 말하지 않는다. 적는 방식과 자릿수까지다. */
      /* ★ 2단계 끝 — 반출 대장까지 봤는데 다음에 어디로 가야 하는지가 없었다.
         ⚠ 여기서 곧장 경비에게 보내면 안 된다. 대장은 22:0x의 '범행 시각' 기록이고,
           하도경의 사생활과는 아무 접점이 없다 — 그 둘을 한 줄에 붙이면
           "왜 갑자기 경비에게 일기 얘기를 물으러 가지"가 된다.
           대장에서 답이 끊겼으니 **손목에 남은 유품**으로 넘어가는 것이 순서다.
           사람 쪽으로 돌려세우는 일은 그 유품(c304)이 맡는다. */
      { id:'r3', need:['c206'], who:'정리',
        lines:['필적은 하도경의 것이 아니다. 대장이 말해줄 수 있는 건 여기까지다.',
               '다만 적힌 이관 시각이 22:0x — 하도경이 죽은 바로 그 시간대다.',
               '그 시간에 청사 안에 있던 것은 야간 경비 둘뿐이었다.',
               '그날 밤 무엇을 보고 들었는지, 처음에 못 들은 것이 있지 않을까?'] },
      /* ★ 여기가 사람 쪽으로 돌려세우는 자리다. 잠긴 페이지를 **직접 보고 난 뒤**라
         "왜 물으러 가는가"가 성립한다 — 자물쇠가 세 자리인 것을 이미 봤기 때문이다.
         ⚠ 무엇을 물으라고까지 말하지 않는다. 물어볼 사람이 누구인지까지다. */
      /* ★ 순서가 곧 설득력이다 — 경위(그날 밤) → 사람됨(기록하는 버릇) → 물건(잠긴 메모패드).
         ⚠ 반출 대장에서 곧장 워치로 보내면 안 된다. 대장은 22:0x의 범행 시각 기록이고
           하도경의 기록 습관과는 접점이 없다. 그 사이를 경비의 진술이 메운다. */
      { id:'r5', need:['c305'], who:'정리',
        lines:['깐깐하다는 말은 그런 뜻이었다. 하도경은 사람을 적어두는 사람이었다.',
               '그 손목에 남은 워치를 아직 다 보지 않았다.',
               '그가 마지막으로 잠가둔 한 장에는 무엇이 적혀 있는가?'] },
      { id:'r2', need:['c304','c305','c306'], who:'정리',
        lines:['하도경은 사람을 만나면 출신을 묻고, 그걸 워치에 적어두는 버릇이 있었다.',
               '경비에게 받아 적은 것은 23515 — 제235 행성 제15 우주였다.',
               '잠긴 마지막 장은 세 자리다. 세 자리로 떨어지는 출신은 누구의 것인가?'] },
      /* ★ 4단계 — 경비 둘의 진술을 다 듣고도 "그래서 어디를 보지"가 남았다.
         한쪽은 목소리가 안 들렸고(c403), 22:20에는 이미 쓰러져 있었다(c406).
         그 둘 사이를 메우는 것이 사인(c402)과 손목(c401)이다. 답은 말하지 않는다. */
      { id:'r4', need:['c403','c406'], who:'정리',
        lines:['한쪽 목소리는 벽 너머로 하나도 넘어오지 않았다고 한다.',
               '워치는 22:05에서 멈췄고, 22:20에는 이미 쓰러져 있었다.',
               '그 15분 사이에 무엇이 몸에 닿았는지부터 확인해보자.',
               '그리고 같은 시각에 멈춘 시계가 또 있다면, 그건 누구의 것인가?'] },
    ],

    spots:[
      /* ── 1단계 · 제7보관실 암호 2200 ─────────────────────────────
         두 진술이 "B가 먼저"에 일치 → 선착은 B → 22:00 / 22:10 중 B의 것.
         B는 조기 출근이 못마땅해 정각에 찍었다 → 2200. A의 "10분 지각"이 오답 유도. */
      { at:'10,10', stage:1, path:'intr', dc:4, id:'c101', name:'야간 경비 A',
        /* 어수룩하고 미안해하는 말투. 존댓말에 군더더기가 많다 */
        /* ★ e — 그 줄부터 바뀌는 표정. 다음 지정이 나올 때까지 이어진다.
           줄마다 다시 적게 하면 데이터가 표정으로 뒤덮인다. */
        lines:[{ t:'아이고, 그게… 하필 출근길에 신호가 와서요.', e:'fluster' },
               'B한테 먼저 가라고 말은 해뒀습니다. 걔가 먼저 찍었을 거예요, 아마.',
               { t:'저는… 뭐, 10분쯤 늦었습니다. 죄송합니다.', e:'sad' },
               /* ★ 암호 규칙은 여기서도 나와야 한다. 근무 편성표(감식 5)에만 두면
                  감식이 낮은 요원은 진술을 다 듣고도 그게 암호와 무슨 상관인지 모른다. */
               '아, 보관실 키패드요? 그거 매일 바뀝니다.',
               '그날 둘 중에 먼저 출근 카드 찍은 사람 시각이 그날 암호예요.',
               '누가 먼저 찍었는지는… 저는 화장실에 있었어서 확실히는 모르겠습니다.'],
        /* ★ text 는 우측 '내 단서' 목록에 남는 요약이다. lines 만 두면 장면이 끝난 뒤
           목록에 빈 줄만 남아서, 진술이 기억나지 않으면 되짚을 방법이 없다. */
        text:'경비 A — 출근길에 화장실에 들렀고, B가 먼저 찍었을 거라고 한다. 자기는 10분 지각. '
            +'보관실 암호는 그날 먼저 출근 카드를 찍은 경비의 기록 시각이다.',
        fail:'경비 A가 눈을 피하며 말끝을 흐린다.' },
      { at:'21,10', stage:1, path:'intr', dc:4, id:'c102', name:'야간 경비 B',
        /* 투덜이. 냉소적이고 말이 짧다 */
        lines:[{ t:'근무가 22시인데 왜 30분 전에 나와야 되는 겁니까. 이거 문제 없어요?', e:'angry' },
               'A가 화장실 간다길래 먼저 가서 담배 한 대 피우고 카드 찍었죠.',
               '그러고 나니까 걔가 오더라고요. 한 10분 됐나. 화장실에서 잠이나 잤겠죠.',
               '키패드요? 먼저 찍은 쪽 시각이 그날 암호입니다. 그게 규정이에요.',
               '30분씩 일찍 나오라는 건 규정에 없고요. 저는 규정대로만 합니다.'],
        text:'경비 B — A가 화장실에 간 사이 먼저 들어와 담배를 피우고 카드를 찍었다. A는 10분쯤 뒤. '
            +'조기 출근에 불만이 있고, 자기는 규정대로만 한다고 한다.',
        fail:'경비 B가 대놓고 귀찮은 표정을 짓는다.' },

      /* ── 재심문 ────────────────────────────────────────────────────
         ★ after — 그 단서를 얻은 뒤에만 열리는 조사다. 같은 칸·같은 단계에 겹쳐 두면
           "한 번 더 물어본다"가 그대로 구현된다(칸당 여러 조사는 원래 지원한다).
         ★ noclue — 우측 '내 단서' 목록에 남기지 않는다. 중요 인물이 아닌 관계자에게서
           나오는 건 사건과 무관한 잡담이라, 목록에 쌓이면 수첩이 잡음으로 덮인다.
           그래도 text 는 적어둔다 — 규약이 요구하기도 하고, 나중에 쓸모가 생길 수도 있다.
         ⚠ 여기에 진짜 단서를 넣지 말 것. 잡담 자리는 잡담 자리로 둔다 —
           한 번이라도 여기서 결정적인 게 나오면 플레이어는 모든 NPC를 두 번씩 캔다. */
      { at:'10,10', stage:1, path:'intr', dc:4, id:'c106', name:'야간 경비 A (한 번 더)',
        after:'c101', noclue:true,
        lines:['아, 어젯밤 저녁이요? 컵라면 먹었습니다. 매운 거로요.',
               '국물까지 다 마셨더니 속이 좀 그래서… 그래서 화장실을…',
               '이런 것도 조사에 필요합니까? 아이고, 죄송합니다.'],
        text:'경비 A — 어젯밤 컵라면을 먹었다는 이야기를 한참 한다.',
        fail:'경비 A가 배를 만지며 말끝을 흐린다.' },
      { at:'21,10', stage:1, path:'intr', dc:4, id:'c107', name:'야간 경비 B (한 번 더)',
        after:'c102', noclue:true,
        lines:['또요? 아까 다 말했잖습니까.',
               '저녁은 안 먹었습니다. 여기 야식 수당이 안 나오거든요.',
               '그런 것도 좀 적어가세요. 위에 보고 좀 해주시고요.'],
        text:'경비 B — 야식 수당이 안 나온다는 불평을 한참 한다.',
        fail:'경비 B가 대놓고 한숨을 쉰다.' },
      { at:'8,9',  stage:1, path:'obsv', dc:4, id:'c103', name:'출근 기록기',
        text:'그날 기록은 두 건. 22:00과 22:10. 누가 어느 쪽인지는 표시되지 않는다.',
        fail:'화면에 지문 자국만 잔뜩 남아 있다.' },
      { at:'17,10', stage:1, path:'anly', dc:5, id:'c104', name:'근무 편성표',
        text:'근무 시작 22:00, 조기 출근 21:30 권고. 보관실 암호는 그날 먼저 찍은 경비의 기록 시각.',
        fail:'표가 빽빽해서 어느 줄이 이번 주인지 모르겠다.' },
      { at:'4,7',  stage:1, path:'infl', dc:6, id:'c105', name:'보관실 환기구',
        text:'격자 틈으로 안이 보인다. 높은 칸에 상자 하나 크기만 자리가 비었다.',
        fail:'격자가 단단히 고정되어 있다.' },

      /* ── 2단계 · 아이템 체인 (답안 제출 없음) ───────────────────── */
      /* ★ 시신은 1단계다. 중앙 복도에 처음부터 놓여 있는데 2단계로 묶어두면,
         플레이어가 시신 앞에서 조사를 눌렀을 때 "형광등이 미세하게 깜빡입니다" 같은
         복도 플레이버가 나온다. 실제로 그렇게 보고받았다 — 게임이 고장 난 것처럼 읽힌다.
         워치를 일찍 얻어도 진행이 앞당겨지지는 않는다. 뒤의 조사들이 각자 단계를 갖고 있다. */
      { at:'12,6', stage:1, path:'obsv', dc:5, id:'c201', name:'하도경의 시신',
        text:'외상은 없다. 손목의 전자 워치가 22:05에서 멈춰 있다.',
        give:'watch',
        fail:'가까이 가기가 쉽지 않다.' },
      /* 잠금 화면을 읽어내야 패턴 힌트가 나온다. 이게 없으면 워치가 그냥 열리는 물건이 된다. */
      { at:'12,6', stage:1, path:'anly', dc:6, id:'c207', name:'워치 잠금 화면',
        need:'watch',
        text:'잠금 화면에 문구가 하나 떠 있다 — "민이야 사랑해". '
            +'아홉 점 중 해당하는 점을 고르는 방식이다. 순서는 상관없어 보인다 — 키패드 숫자로 쳐도 된다.',
        fail:'화면 반사가 심해 글자가 잡히지 않는다.' },
      { at:'11,6', stage:2, path:'intr', dc:5, id:'c202', name:'제이미 영',
        /* 신입인데 지나치게 매끄럽다. 문장이 준비된 것처럼 떨어진다 */
        lines:[{ t:'기록실 말씀이시죠. 카드 드리겠습니다. 편하게 쓰십시오.', e:'smile' },
               { t:'어젯밤에는 하도경 관리관님이 오류물을 이관해야 한다고 하셔서 기록을 작성했습니다.', e:'talk' },
               '관리관님이 물건을 가져가시는 것도 제가 직접 봤습니다.'],
        /* ⚠ 거짓 진술이지만 겉보기는 다른 단서와 똑같다. 표시로 구분하면 장치가 죽는다 —
           반출 대장의 필적(c206)과 부딪혀야 알아채는 구조다. */
        text:'제이미 영 — 하도경의 지시로 이관 기록을 작성했고, 물건을 가져가는 것도 봤다고 진술했다.',
        give:'card',
        fail:'제이미 영이 정중하게 다음에 오라고 한다.' },
      /* ★ 카드를 잃어버린 건 캬타가 아니라 하도경이다. 이게 뒤집혀 있으면
         "왜 하필 하도경 워치에 관리실 NFC가 들어 있나"에 답이 없고,
         3단계 일기의 "내 관리자 카드가 그 아이 손에 있는 것 같다"와도 이어지지 않는다.
         잃어버린 게 아니라 제이미 영이 가져간 것이다 — 플레이어는 나중에 그걸 안다. */
      { at:'3,10', stage:2, path:'intr', dc:4, id:'c203', name:'캬타',
        /* 외지인. 밝고 말이 빠르며 어미가 튄다 */
        lines:[{ t:'관리관님이요? 아 맞다, 며칠 전에 관리실 카드를 잃어버리셨댔어요.', e:'surprise' },
               '재발급이 한참 걸린대서, 제가 그 자리에서 워치에 NFC로 넣어드렸거든요.',
               '늘 차고 계시던 거라 그게 제일 낫겠다 싶어서요. 그거 때문에 뭐 잘못됐나요?'],
        text:'캬타 — 하도경이 며칠 전 관리실 카드를 분실해, 늘 차고 다니던 전자 워치에 NFC를 발급했다.',
        fail:'캬타가 공구를 든 채 바쁘다고 손을 젓는다.' },

      /* ── 중요 인물 재심문 ──────────────────────────────────────────
         ★ 경비들의 재심문과 달리 여기서는 진짜가 나온다. 다만 결정타는 아니다 —
           알리바이 하나, 사람 이야기 하나. 사건을 끝내주지는 않지만
           나중에 다른 단서와 부딪히면서 뜻이 생기는 종류다. */
      /* 22:30 은 후문이 열린 시각(c407)이다. 알리바이가 딱 거기서 끝난다는 것이
         나중에 걸린다 — 지금은 그냥 성실한 신입의 진술로 읽힌다. */
      { at:'11,6', stage:2, path:'intr', dc:5, id:'c205', name:'제이미 영 (한 번 더)',
        after:'c202',
        lines:['어젯밤 그 시간이요? 기록실에 있었습니다. 대장을 정리하느라.',
               '나온 건 22시 반쯤이었을 겁니다. 정확히는… 시계를 안 봐서요.',
               '경비분들은 못 뵀습니다. 제가 원래 조용히 다니는 편이라.'],
        text:'기록관의 알리바이 — 22:30까지 기록실에 혼자 있었다고 한다. 본 사람은 없다.',
        fail:'제이미 영이 서류에서 눈을 떼지 않는다.' },
      /* ★ 워치 잠금 화면의 "민이야 사랑해"가 누구를 부르는 말인지 여기서 붙는다.
         패턴을 알려주지는 않는다 — 사람을 알게 될 뿐이다. */
      { at:'3,10', stage:2, path:'intr', dc:4, id:'c208', name:'캬타 (한 번 더)',
        after:'c203',
        lines:[{ t:'관리관님이요? 완전 딸바보세요.', e:'smile' },
               '민이래요, 딸 이름. 워치 배경화면도 그 애 사진이던데요?',
               '뭐 고쳐달라고 오시면 항상 딸 얘기부터 하셨어요. 매번요.'],
        text:'캬타 — 하도경에게는 민이라는 딸이 있다. 워치 배경화면도 딸 사진이다.',
        fail:'캬타가 하던 작업에서 손을 안 뗀다.' },
      /* ★ 판정 없음(auto). 문을 여는 데 이미 워치가 필요했다. 들어와서 인식기에 대는 건
         '해내는' 일이 아니라 결과다 — 여기에 굴림을 두면 문을 뚫고 들어온 요원이
         관찰 판정에서 또 막히고, 관찰이 낮은 배분은 2단계에서 통째로 갇힌다. */
      { at:'17,2', stage:2, path:'obsv', dc:0, id:'c204', name:'관리실 인식기', auto:true,
        need:'watch', needOpen:'watch',
        text:'워치를 대자 인식음이 울린다. 기록실 전자 책장의 잠금이 풀렸다.',
        give:'auth' },
      { at:'11,2', stage:2, path:'anly', dc:6, id:'c206', name:'반출 대장',
        need:'auth',
        text:'22:0x 이관 기록의 필적이 하도경의 것이 아니다. 대장 담당자의 글씨다.',
        fail:'글씨가 눈에 들어오지 않는다.' },

      /* ── 3단계 · 워치 메모패드 암호 832 ─────────────────────────
         제이미 영 = 제8 행성 제32 우주 → 832. 캬타(제52/제1)는 오답 유도. */
      /* ★ '답이 세 자리'라는 사실은 여기서만 나온다. 이게 없으면 플레이어는
         832를 조합해놓고도 그게 답의 형태인지 확신할 수 없다. */
      { at:'12,6', stage:3, path:'anly', dc:5, id:'c304', name:'워치의 일기',
        need:'watch', needOpen:'watch',
        text:'딸 민에게 쓴 일기다. 마지막 한 장만 잠겨 있고, 힌트 표시가 세 자리다.',
        fail:'글자가 눈에 들어오지 않는다.' },
      { at:'12,11', stage:3, path:'obsv', dc:5, id:'c301', name:'인사 게시판',
        text:'신규 배치자 명단. 제이미 영 — 제8 행성 제32 우주.',
        fail:'게시물이 겹겹이 붙어 있어 뒷장이 안 보인다.' },

      /* ── 경비 재심문 — 세 자리가 무엇인지 여기서 나온다 ─────────────
         ★ 이게 없으면 c301·c302 를 손에 들고도 그 숫자를 왜 붙여야 하는지 모른다.
           '세 자리'(c304)와 '출신 번호'(여기) 둘이 다 있어야 832 가 답의 형태가 된다.
         ★ 둘로 나눈다 — 한 사람이 '일기를 쓴다'·'출신을 묻는다'·'이어 붙여 적는다'를
           다 말하면 그건 진술이 아니라 해설이다. 본 사람과 당한 사람이 다르다.
         ⚠ 예시는 경비 자신의 출신(제235 행성 제15 우주 → 23515)이다. 용의자의 것이 아니라
           '적는 방식'만 가르친다 — 답을 흘리지 않으면서 형식을 보여주는 자리다.
         ⚠ after 를 안 쓴다. 1·2단계 진술을 이미 들은 칸이라, 단계만으로 이미 재심문이다. */
      { at:'10,10', stage:3, path:'intr', dc:4, id:'c305', name:'야간 경비 A (한 번 더)',
        lines:[{ t:'그날 밤이요? 22시 좀 넘어서 복도에서 뵀습니다. 관리관님요.', e:'think' },
               '뭘 적고 계시더라고요. 손목에 찬 그거, 워치에다가요.',
               { t:'그 양반이 워낙 깐깐하십니다. 사람 얘기도 다 적어두시더라고요.', e:'normal' },
               '누가 뭐라 했는지, 어디 출신인지, 그런 것까지 적으십니다.',
               '관리자 기질이라 그런 건가… 저야 뭐, 그런갑다 했죠.'],
        text:'경비 A — 22시 넘어 복도에서 하도경을 봤다. 워치에 뭔가 적고 있었다. '
            +'깐깐한 성격이라 사람에 대한 것까지 기록해두는 버릇이 있었다.',
        fail:'경비 A가 기억을 더듬다 만다.' },
      { at:'21,10', stage:3, path:'intr', dc:4, id:'c306', name:'야간 경비 B (한 번 더)',
        lines:[{ t:'그 양반, 저한테 출신을 묻더라고요. 뜬금없이.', e:'surprise' },
               { t:'중앙 지부 관리관이 그런 걸 왜 묻습니까. 좀 께름칙했죠.', e:'think' },
               '제235 행성 제15 우주라고 했더니 워치에 뭐라 적고는 그냥 가버리던데요.',
               '슬쩍 봤는데 23515, 그렇게만 적혀 있었습니다. 그게 무슨 소린지.'],
        text:'경비 B — 하도경이 출신을 물었다. 제235 행성 제15 우주라고 답하자 '
            +'워치에 23515 라고 적고 갔다.',
        fail:'경비 B가 그런 걸 왜 묻냐고 되묻는다.' },

      /* ★ after:'c306' — 출신을 묻는 재심문은 '왜 출신을 묻는가'를 안 뒤에 열린다.
         먼저 열어두면 플레이어가 이유도 모르고 두 사람에게 고향을 캐물어 보게 되고,
         그러면 c305·c306 이 뒤늦게 확인해 주는 각주가 된다.
         ⚠ 규약 15(같은 칸·같은 단계)의 예외다. 여기서는 그게 목적이다 —
           경비의 진술이 캬타·제이미 영에게 다시 갈 이유를 만든다. */
      { at:'11,6', stage:3, path:'intr', dc:4, id:'c302', name:'제이미 영 (출신)',
        after:'c306',
        lines:[{ t:'제 고향이요? 제8 행성 제32 우주입니다.', e:'talk' },
               '여기랑은 시간 감각이 좀 달라서, 처음엔 적응이 힘들었습니다.',
               { t:'…관리관님도 그걸 물으셨습니다. 배치 첫날에요.', e:'fluster' }],
        text:'제이미 영의 출신 — 제8 행성 제32 우주.',
        fail:'제이미 영이 화제를 돌린다.' },
      { at:'3,10', stage:3, path:'intr', dc:4, id:'c303', name:'캬타 (출신)',
        after:'c306',
        lines:['저요? 제52 행성 제1 우주요! 여기서 엄청 멀어요.',
               '고향 얘기 나오니까 갑자기 집 생각 나네…',
               '관리관님도 물어보셨었는데. 다들 궁금한가 봐요?'],
        text:'캬타의 출신 — 제52 행성 제1 우주.',
        fail:'캬타가 딴청을 부린다.' },

      /* ── 4단계 · 지목 ─────────────────────────────────────────── */
      /* ★ afterAll — 경비 둘의 4단계 진술(c403·c406)을 다 듣고 나서야 열린다.
         유도 스크립트 r4 가 "같은 시각에 멈춘 시계가 또 있다면"이라고 돌려세우는 그 자리다.
         먼저 열어두면 플레이어가 시신부터 뒤져 답을 보고, 뒤늦게 경비가
         "말싸움을 들었어요" 하는 각주가 된다 — 순서가 곧 설득력이다. */
      { at:'11,6', stage:4, path:'obsv', dc:5, id:'c401', name:'제이미 영의 손목',
        afterAll:['c403','c406'],
        text:'제이미 영의 워치도 22:05에서 멈춰 있다.',
        fail:'소매에 가려 잘 보이지 않는다.' },
      { at:'12,6', stage:4, path:'anly', dc:5, id:'c402', name:'하도경의 사인',
        afterAll:['c403','c406'],
        text:'무방비 접촉으로 인한 뇌 붕괴. 장비복을 입은 흔적이 없다.',
        fail:'판단할 근거가 부족하다.' },
      { at:'10,10', stage:4, path:'intr', dc:4, id:'c403', name:'야간 경비 A',
        lines:[{ t:'아, 그러고 보니… 화장실에 있는데 말싸움 소리가 들렸어요.', e:'surprise' },
               '한 명은 관리관님 목소리였는데, 다른 한 명은 뭐라는지 하나도 안 들리더라고요.',
               '벽 너머라 그런가 했는데… 아니었나 봅니다.'],
        /* ★ 이 진술 하나로는 아무 의미가 없다. 장비 보관대(c405)의 빈 걸이와 합쳐져야
           "헬멧을 쓰고 있었다"가 된다. 단서 하나로 결론이 나면 나머지 경로가 죽는다. */
        text:'경비 A — 화장실에서 말싸움을 들었다. 한쪽은 하도경, 다른 한쪽은 목소리가 들리지 않았다.',
        fail:'경비 A가 기억이 잘 안 난다고 한다.' },
      { at:'21,10', stage:4, path:'intr', dc:4, id:'c406', name:'야간 경비 B',
        lines:['22시 20분쯤이요. 순찰 돌다가 중앙 복도에서 봤습니다.',
               '처음엔 주무시는 줄 알았어요. 그 자세로.',
               '그 시간에 거기 계실 분이 아닌데 말이죠.'],
        text:'경비 B — 22:20 순찰 중 중앙 복도에서 하도경을 발견했다.',
        fail:'경비 B가 그 얘긴 아까 다 했다고 한다.' },
      { at:'18,3', stage:4, path:'obsv', dc:4, id:'c405', name:'장비 보관대',
        text:'걸이 하나가 비어 있다. 장비복 한 벌이 없다.',
        fail:'보관대에 먼지가 앉아 있다.' },
      /* ★ 관리자실 문이 잠행에서 워치로 바뀌면서 잠행이 1회짜리 스탯이 됐다.
         죽은 스탯을 만들지 않으려고 넣은 자리이자, 결말("이미 암거래상에게 넘어갔다")이
         허공에서 튀어나오지 않게 붙잡아 주는 단서다. 없어도 지목은 가능하다. */
      { at:'21,7', stage:4, path:'infl', dc:5, id:'c407', name:'후문 잠금장치',
        text:'안쪽에서만 열리는 문인데, 그날 밤 22:30에 한 번 열린 기록이 남아 있다. 물건은 그때 나갔다.',
        fail:'덮개가 봉인되어 있어 손을 못 대겠다.' },
      { at:'17,3', stage:4, path:'anly', dc:6, id:'c404', name:'CCTV 제어 기록',
        text:'22:00~22:20 구간이 고의로 정지됐다. 정지 직전 출입자는 캬타와 제이미 영.',
        fail:'로그가 길어 어디를 봐야 할지 모르겠다.' },

      /* ── 배치형 힌트 단서 ──────────────────────────────────────────
         ★ 각 퍼즐의 핵심 정보에 **두 번째 길**을 깐다. 암호 규칙이 편성표(감식 5)에만
           있으면 감식이 낮은 요원은 규칙 자체를 못 만난다 — 같은 정보를 낮은 DC·다른
           적성으로 한 번 더 놓아야 "단서가 없다"가 사라진다.
         ⚠ 정보를 '한 단계 무르게' 반복한다. 같은 말을 똑같이 두 번 적으면 한쪽이 장식이
           되고, 더 진한 말을 적으면 원래 단서가 장식이 된다 — 여기 것은 늘 원본보다
           반 발짝 뒤에 선다(규칙은 알려주되 시각은 기록기로 미룬다, 식으로).
         ⚠ 기존 단서와 같은 칸에 두지 말 것. 한 칸의 조사 순서가 밀리면 검증기의
           고정 경로가 통째로 어긋난다(빈 칸: 로비 13,10 · 기록실 13,2 · 정비실 2,11). */
      { at:'13,10', stage:1, path:'obsv', dc:4, id:'c108', name:'접수대 보안 안내문',
        text:'접수대에 붙은 보안 안내 — "보관실 키패드는 매일 갱신. 당일 최초 출근 기록 시각 네 자리." '
            +'출근 기록은 기록기에 남는다.',
        fail:'안내문이 여러 장 겹쳐 붙어 있다.' },
      { at:'13,2', stage:2, path:'obsv', dc:4, id:'c209', name:'하도경의 자리',
        text:'기록실 안 하도경의 책상. 모니터 옆에 어린 딸의 사진 — 얼굴 위에 손으로 그린 하트 표시가 있다. '
            +'서랍은 비었고, 워치 충전 거치대만 남아 있다.',
        fail:'책상 위가 어질러져 있어 눈에 잡히는 게 없다.' },
      { at:'2,11', stage:3, path:'obsv', dc:4, id:'c307', name:'정비 일지',
        text:'정비 일지 귀퉁이의 낙서 — "관리관님이 또 출신을 물었다. 워치에 뭘 그렇게 적는담." '
            +'캬타의 글씨다.',
        fail:'기름때에 절어 글씨가 번져 있다.' },
    ],

    granted:{},

    /* ── 방별 플레이버 ─────────────────────────────────────────── */
    flavor:{
      /* ★ 어미는 짧은 '~다'로 통일한다. 조사 결과를 읽어주는 목소리는 하나여야 하고,
         칸마다 어미가 달라지면 같은 사람이 어떤 칸에서는 다르게 말하는 것처럼 읽힌다.
         ⚠ '~습니다'는 쓰지 않는다. 조사는 요원이 자기 눈으로 본 것을 스스로 적는 줄이지
           누구에게 보고하는 말이 아니다 — 존댓말이 섞이면 듣는 사람이 있는 것처럼 읽힌다. */
      S:[ '선반 라벨이 절반쯤 떨어져 있다.',
          '보관 상자 세 개. 열어보니 전부 서류철이다.',
          '먼지만 쌓여 있다. 손자국도 없다.',
          '온습도 계기판은 정상 범위를 가리킨다.',
          '바닥에 그어둔 통로선이 낡아서 흐릿하다.',
          '규격 미달로 반출된 빈 상자들이 포개져 있다.' ],
      R:[ '전자 책장 한 칸이 잠겨 있다. 이 칸은 아니다.',
          '결재 대기 서류가 쌓여 있다. 죄다 소모품 청구서다.',
          '책상 밑에 슬리퍼 한 짝. 짝이 안 맞는다.',
          '벽에 붙은 근무표. 이번 달 것이 아니다.',
          '별다른 건 없어 보인다.',
          '프린터에 종이가 걸려 있다. 뽑아보니 백지다.' ],
      A:[ '단말 화면보호기가 지부 로고를 천천히 돌린다.',
          '캐비닛 손잡이가 반질반질하다. 자주 여는 모양인데 안은 비었다.',
          '경고 스티커가 겹겹이 붙어 있다. 제일 아래 것은 읽을 수가 없다.',
          '눈에 걸리는 것이 없다.',
          '바닥에 케이블 자국이 길게 나 있다.' ],
      M:[ '공구 걸이. 렌치 하나가 엉뚱한 칸에 걸려 있다.',
          '기름 냄새가 배어 있다. 바닥에 마른 자국도 있다.',
          '부품 상자를 뒤졌다. 규격이 안 맞는 나사뿐이다.',
          '작업대 위에 식은 커피. 컵 밑 자국이 여러 겹이다.',
          '먼지만 쌓여 있다.',
          '손으로 적은 정비 주기표. 마지막 줄이 지워져 있다.' ],
      L:[ '접수대 위 방문자 명부. 이번 주는 한 명도 없다.',
          '화분 잎이 조금 노랗다. 흙이 말라 있다.',
          '의자가 포근해 보인다. 앉아보니 정말 포근하다.',
          '안내 게시판에 지부 조직도. 오래돼서 없는 부서가 적혀 있다.',
          '별다른 건 없어 보인다.',
          '우산꽂이에 우산 두 개. 둘 다 부러져 있다.' ],
      N:[ '접이식 침대. 담요가 아무렇게나 뭉쳐져 있다.',
          '컵라면 용기 두 개. 하나는 국물이 남았고 하나는 뚜껑도 안 뜯겼다.',
          '의자가 포근해 보인다. 앉으면 일어나기 싫겠다.',
          '사물함 문이 여러 개. 죄다 열려 있고 죄다 비었다.',
          '노동시간 관련 게시물에 누가 형광펜으로 줄을 그어놨다.',
          '전기 주전자. 물이 미지근하다.' ],
      C:[ '형광등 하나가 미세하게 깜빡인다.',
          '게시판에 소화기 점검표. 서명이 전부 같은 필체다.',
          '먼지만 쌓여 있다. 발자국은 지워진 지 오래다.',
          '비상 유도등이 조용히 켜져 있다.',
          '눈에 걸리는 것이 없다.',
          '벽 몰딩이 살짝 떠 있다. 손을 넣어봤지만 아무것도 없다.' ],
      B:[ '환기구 격자. 안쪽은 어둡고 손이 들어가지 않는다.',
          '벽에 대차가 스친 긴 자국. 오래된 것이다.',
          '별다른 건 없어 보인다.',
          '후문 유리에 손자국이 여럿. 겹쳐서 누구 것인지 모르겠다.',
          '바닥 배수구에 마른 낙엽 몇 장이 있다.' ],
    },
    flavorAt:{
      '10,12':'현관 자동문. 밖은 통로 조명만 켜져 있다.',
      '21,12':'후문. 잠겨 있고 안쪽에서만 열린다.',
      '19,7' :'소화전. 유리 안쪽에 먼지가 앉아 있다.',
      /* ★ 둘러보기(판정 없음)에서 나오는 공짜 힌트 — 방향만 가리키고 답은 없다.
         단서 칸이 아닌 데서도 '헛걸음이 아니다'가 되어야 방을 뒤지는 손이 산다. */
      '5,6' :'제7보관실 문 앞. 키패드 숫자 몇 개만 반질거린다 — 매일 눌러온 자리다.',
      '13,6':'복도 바닥에 긁힌 자국이 짧게 나 있다. 시신이 있는 쪽으로 이어진다.',
      '11,7':'천장 CCTV가 복도를 향해 있다. 제어는 관리자실에서 한다는 표지가 붙어 있다.',
    },
    map:[
      '########################',
      '#SSSSSSS#RRRRRR#AAAA#BB#',
      '#SSSSSSS#RRRRRR#AAAA#BB#',
      '#SSSSSSS#RRRRRR#AAAA#BB#',
      '#SSSSSSS#RRRRRR#AAAA#BB#',
      '####+######+####+####BB#',
      '#CCCCCCCCCCCCCCCCCCC+BB#',
      '#CCCCCCCCCCCCCCCCCCC#BB#',
      '###+######+######+###BB#',
      '#MMMMM#LLLLLLL#NNNNN#BB#',
      '#MMMMM#LLLLLLL#NNNNN#BB#',
      '#MMMMM#LLLLLLL#NNNNN#BB#',
      '#MMMMM#LLLLLLL#NNNNN#BB#',
      '########################',
    ],
  },
};

/* ── 상태 ────────────────────────────────────────────────────────────
   MYS.field 는 MYS_DEFAULT 에 들어 있으므로 로더가 자동으로 따라온다(함정 #1 구조적 차단). */
function mysNewField(caseId){
  const c=MYS_CASES[caseId]; if(!c) return null;
  /* ⚠ 여기서 mysReveal 을 부르지 말 것.
     mysReveal → mysZoneChar → mysGrid → mysCase → mysField() → MYS.field 를 타고 지도를 찾는데,
     이 시점엔 MYS.field 가 아직 옛 값(또는 null)이라 지도를 못 찾는다.
     그러면 seen 이 빈 채로 시작해 **첫 화면이 통째로 안개**가 된다.
     움직이면 그때부터 열리기 때문에 이동 테스트로는 안 잡혔다(실제로 겪음). */
  return { caseId, stage:1, pos:c.start, seen:[], opened:[], got:[], looked:[],
           tries:{}, dcUp:{}, shut:{}, wrong:0, flag:null, flags:[], recap:[],
           items:[], unlocked:[] };
}
function mysField(){ return MYS && MYS.field ? MYS.field : null; }
function mysCase(){ const f=mysField(); return f ? MYS_CASES[f.caseId] : null; }

/* 타일맵 파싱 — 사건별로 한 번만. 좀아칼의 _advMapCache 와 같은 이유(매 렌더 재생성 방지). */
let _mysGridCache=null;
function mysGrid(){
  const c=mysCase(); if(!c) return null;
  if(_mysGridCache && _mysGridCache.id===c.id) return _mysGridCache;
  const w=c.map[0].length, h=c.map.length;
  const bad=c.map.filter(r=>r.length!==w).length;
  if(bad) console.warn('[미스테리au] '+c.id+' 타일맵 줄 길이 불일치 '+bad+'줄 — 렌더가 어긋납니다');
  const doors={}, spots={};
  (c.doors||[]).forEach(d=>{ doors[d.at]=d; });
  /* ★ 한 칸에 여러 조사가 있다. 같은 인물을 단계마다 다시 심문하는 구조이기 때문.
     칸당 하나만 담으면 마지막 것만 남아 앞 단계 조사가 통째로 사라진다(실제로 겪음). */
  (c.spots||[]).forEach(s=>{ (spots[s.at]=spots[s.at]||[]).push(s); });
  /* 방 라벨 위치 — 방 칸들의 무게중심. 비정형 방에서도 안쪽에 찍힌다.
     매 렌더마다 24×14를 다시 훑지 않도록 지도 캐시에 같이 담는다. */
  const acc={};
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const t=c.map[y].charAt(x); if(!MYS_ZONES[t]) continue;
    const a=acc[t]||(acc[t]={sx:0,sy:0,n:0}); a.sx+=x; a.sy+=y; a.n++;
  }
  const labels={};
  Object.keys(acc).forEach(k=>{ const a=acc[k];
    labels[k]={ x:(a.sx/a.n)+0.5, y:(a.sy/a.n)+0.5, name:MYS_ZONES[k].name }; });
  _mysGridCache={ id:c.id, w, h, rows:c.map, doors, spots, labels };
  return _mysGridCache;
}
/* 이 칸에서 지금 할 수 있는 조사. 아직 안 얻은 것 중 가장 이른 단계를 고른다.
   전부 끝났으면 표시용으로 마지막 것을 돌려준다. */
function mysSpotAt(key){
  const g=_mysGridCache, f=mysField();
  if(!g || !f) return null;
  const list=(g.spots||{})[key]; if(!list || !list.length) return null;
  /* ★ after — 지정한 단서를 얻은 뒤에만 열리는 조사(재심문). 아직이면 없는 셈 친다. */
  /* ★ afterAll — 여러 단서를 **다** 모아야 열리는 조사. after 와 달리 재심문이 아니므로
     맨 뒤로 밀지 않는다(아래 sort 는 after 만 본다).
     ⚠ 단계의 needClue 와는 다른 물건이다. 저건 단계를 넘기는 조건이고 이건 칸이 열리는 조건이다. */
  const ready = s => (!s.after || mysGotClue(s.after))
    && (!s.afterAll || [].concat(s.afterAll).every(id=>mysGotClue(id)));
  const open=list.filter(s=>s.stage<=f.stage && ready(s));
  if(!open.length) return list[0];                       // 아직 볼 이유가 없는 칸
  const todo=open.filter(s=>!mysGotClue(s.id));
  /* ★ 재심문은 언제나 맨 뒤다. 4단계에 새 진술을 들으러 갔는데 1단계 잡담이 먼저 뜨면
     "한 번 더 물어보기"가 진행을 가로막는 절차가 된다. sort 는 안정 정렬이라
     나머지 순서(단계·작성 순)는 그대로 유지된다. */
  todo.sort((a,b)=>(a.after?1:0)-(b.after?1:0));
  return todo.length ? todo[0] : open[open.length-1];
}
function mysAt(x,y){ const g=mysGrid(); if(!g) return '#';
  if(x<0||y<0||x>=g.w||y>=g.h) return '#';
  return g.rows[y].charAt(x) || '#'; }
function mysKey(x,y){ return x+','+y; }
function mysXY(k){ const p=String(k||'').split(','); return {x:+p[0]||0, y:+p[1]||0}; }
function mysIsWall(x,y){ const t=mysAt(x,y); return t==='#' || t===' '; }
function mysIsDoor(x,y){ return mysAt(x,y)==='+'; }
function mysZoneChar(x,y){ const t=mysAt(x,y); return MYS_ZONES[t] ? t : null; }
function mysZoneName(x,y){
  const z=mysZoneChar(x,y); if(z) return MYS_ZONES[z].name;
  if(mysIsDoor(x,y)){ const g=mysGrid(); const d=g&&g.doors[mysKey(x,y)]; return d?d.name:'문'; }
  return '';
}

/* ── 시야: 방 단위 공개 ──────────────────────────────────────────────
   반경 안개(좀아칼)를 쓰면 벽을 뚫고 옆방이 보인다. 들어간 방만 전체 공개하고,
   그 방에 붙은 문은 '있다는 것만' 보이게 한다 — 평면도가 방 단위로 드러난다. */
function mysReveal(f, atKey){
  const p=mysXY(atKey);
  const z=mysZoneChar(p.x,p.y);
  const set=new Set(f.seen||[]);
  if(z) set.add(z);
  /* 현재 칸이 문이면 양쪽 방을 다 본 것으로 처리(문턱에 서면 안이 보인다) */
  if(mysIsDoor(p.x,p.y)){
    [[0,-1],[0,1],[-1,0],[1,0]].forEach(d=>{ const zz=mysZoneChar(p.x+d[0],p.y+d[1]); if(zz) set.add(zz); });
  }
  f.seen=Array.from(set);
}
function mysZoneSeen(z){ const f=mysField(); return !!(f && z && (f.seen||[]).indexOf(z)>=0); }
/* 문은 양쪽 방 중 하나라도 봤으면 보인다 */
function mysDoorSeen(x,y){
  return [[0,-1],[0,1],[-1,0],[1,0]].some(d=>mysZoneSeen(mysZoneChar(x+d[0],y+d[1])));
}
function mysCellSeen(x,y){
  if(mysIsDoor(x,y)) return mysDoorSeen(x,y);
  const z=mysZoneChar(x,y); if(z) return mysZoneSeen(z);
  /* 벽은 인접한 방을 봤으면 보인다 — 안 그러면 방 윤곽이 안 그려진다 */
  return [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]]
    .some(d=>mysZoneSeen(mysZoneChar(x+d[0],y+d[1])));
}

/* ── 이동 판정 ───────────────────────────────────────────────────────
   ★ 십자만. 대각선을 허용하면 문을 안 거치고 벽 모서리로 방에 들어간다. */
function mysAdjacent(fx,fy,tx,ty){ return Math.abs(tx-fx)+Math.abs(ty-fy)===1; }
function mysDoorAt(x,y){ const g=mysGrid(); return g ? (g.doors[mysKey(x,y)]||null) : null; }
function mysDoorOpen(x,y){
  const d=mysDoorAt(x,y); if(!d || !d.lock) return true;
  const f=mysField(); if(!f) return false;
  const L=d.lock;
  /* 단계 잠금 — 그 단계를 통과하면 저절로 열린다(암호를 맞힌 결과다) */
  if(L.type==='stage') return f.stage > L.n;
  /* 조건 잠금 — 아이템을 가지고 있으면 열린다. 판정도 굴림도 없다.
     ★ needOpen:true 면 '잠금까지 푼' 아이템이어야 한다.
       이게 없으면 잠긴 워치를 손에 쥔 것만으로 문이 열려서, 패턴 잠금을 건너뛰고
       그 뒤의 단서에 먼저 닿는다 — 아이템 체인 전체가 무의미해진다. */
  if(L.type==='item')  return mysHasItem(L.item) && (!L.needOpen || mysItemOpen(L.item));
  /* 판정 잠금 — 우회 아이템이 있으면 굴리지 않고 통과.
     우회 아이템 자신이 잠겨 있으면 아직 쓸 수 없다(위 needOpen 과 같은 이유). */
  if(L.bypass && mysHasItem(L.bypass)){
    const bd=mysItemDef(L.bypass);
    if(!bd || !bd.lock || mysItemOpen(L.bypass)) return true;
  }
  return (f.opened||[]).indexOf(mysKey(x,y))>=0;
}
/* 'ok' | 'locked' | 'no' */
function mysCanEnter(tx,ty){
  const f=mysField(); if(!f) return 'no';
  const p=mysXY(f.pos);
  if(!mysAdjacent(p.x,p.y,tx,ty)) return 'no';
  if(mysIsWall(tx,ty)) return 'no';
  if(mysIsDoor(tx,ty) && !mysDoorOpen(tx,ty)) return 'locked';
  return 'ok';
}

/* ── 오염도 단일 창구 ────────────────────────────────────────────────
   ⚠ 핸드오프 7절 — a.taint 를 여기 말고 어디서도 건드리지 말 것.
     여러 군데서 올리면 나중에 "왜 올랐는지" 추적이 안 된다. */
/* ★ 오염도가 바뀌는 곳은 여기 하나뿐이다. 올리는 것도 내리는 것도 같은 문을 지난다.
   회복만 따로 두면 "왜 내려갔는지"가 로그에 안 남고, 상한 플래그를 되돌리는 규칙이
   두 군데로 갈라져 한쪽만 고쳐진다(v4 함정 9). */
function mysSetTaint(a, to, why){
  if(!a) return 0;
  const before=taintOf(a);
  a.taint=Math.max(0, Math.min(100, to|0));
  const d=a.taint-before;
  if(d) console.log('[미스테리au] 오염도 '+before+'→'+a.taint+' ('+(why||'미기재')+')');
  /* 상한 플래그는 오염도의 함수다 — 내려가면 자동으로 풀린다 */
  const c=mysCase(); const cap=(c && c.taintCap) || MYS_TAINT_LOST;
  if(a.taint < MYS_TAINT_LOST) a.lost=false;
  if(a.taint < cap) a.suspended=false;
  mysCheckTaintLimit(a);
  return d;
}
/* 활성 요원 기준. who 를 주면 그 요원(집중 레벨 회복은 3명 전원에게 적용된다) */
function mysAddTaint(n, why, who){
  const a=who || agent(); if(!a || !n) return 0;
  return mysSetTaint(a, taintOf(a) + n, why);
}
/* 상한 처리 — 사건마다 다르다.
   튜토리얼은 cap 90에서 '활동 중지'(요원 교대), 그 외에는 100에서 'Lost'(본부 정화 전까지 사용 불가). */
function mysCheckTaintLimit(a){
  const c=mysCase();
  const cap=(c && c.taintCap) || MYS_TAINT_LOST;
  if(taintOf(a) < cap) return;
  if(cap < MYS_TAINT_LOST){ if(!a.suspended){ a.suspended=true;
      mysFieldMsg('■ 오염도 '+cap+' — 이 요원은 더 활동할 수 없다. 다른 요원으로 교대할 것.', true); } }
  else if(!a.lost){ a.lost=true;
      mysFieldMsg('■ 요원 Lost — 사건 종료 후 본부 정화를 거쳐야 다시 쓸 수 있다.', true);
      /* ★ 중간 이탈은 이 경로 하나뿐이다. 교대할 요원까지 없으면 그 사람의 사건은 여기서 끝이고,
         파티에 계속 붙어 있으면 지도에 못 움직이는 마커가 남는다. */
      if(mysNetOn() && mysFreeSlot()<0){
        mysFieldMsg('■ 교대할 요원이 없다 — 파티에서 이탈한다.', true);
        mysPartyLeave(true);
      } }
}
/* 집중 레벨이 오르면 오염도 −30.
   ⚠ lastFocus 를 저장하지 않으면 창을 열 때마다 −30이 반복된다(taintReset 과 같은 종류의 함정). */
/* 집중 레벨이 오르면 오염도 −30 — 단, 정화 시스템을 받은 뒤부터다.
   ★ 튜토리얼(CASE-001)은 회복 수단이 없는 상태로 치른다. 지부장이 "해결하고 오면 주마"라고
     한 것이 곧 이 플래그다. 처음부터 회복이 되면 오염도 상한 90도, 요원 교대도,
     "이 정도도 해결 못 하고 죽는다면"이라는 대사도 전부 의미가 없어진다.
   ⚠ lastFocus 는 정화 시스템이 없을 때도 갱신한다. 안 그러면 튜토리얼 동안 오른 레벨이
     보상을 받는 순간 한꺼번에 회복으로 터진다. */
function mysApplyFocusHeal(){
  if(!MYS) return 0;
  const now=focusLevel();
  const last=(MYS.lastFocus==null) ? now : (MYS.lastFocus|0);
  MYS.lastFocus=now;
  if(now<=last) return 0;
  if(!MYS.purifier) return 0;
  let healed=0;
  MYS.agents.forEach(a=>{
    if(!taintOf(a)) return;
    healed += -mysAddTaint(-MYS_FOCUS_HEAL, '집중 레벨 '+last+'→'+now, a);
  });
  if(healed) console.log('[미스테리au] 집중 레벨 '+last+'→'+now+' · 오염도 총 '+healed+' 회복');
  return healed;
}

/* ── 판정 ────────────────────────────────────────────────────────────
   1d100 롤언더. tries 는 이제 오염도 중복 방지가 아니라 '몇 번 굴렸나' 기록이다. */
function mysStat(path){ const a=agent(); return (a && a.alloc && a.alloc[path])|0; }
function mysTried(id){ const f=mysField(); return (f && f.tries && f.tries[id])|0; }
function mysMarkTried(id){ const f=mysField(); if(!f) return; f.tries=f.tries||{}; f.tries[id]=mysTried(id)+1; }

/* 난이도 보정(관찰 대실패로 현장을 흐트러뜨리면 그 지점의 dc가 영구히 오른다) */
function mysDcOf(id, dc){ const f=mysField(); return dc + ((f && f.dcUp && f.dcUp[id])|0); }
/* 목표치. ★ 적성을 인자로 받는 판을 따로 둔다 — 심문 굴림은 파티원 몫도 같이 내야 하는데,
   agent() 를 읽는 판만 있으면 남의 적성으로는 목표치를 낼 수가 없다. */
function mysTargetAt(stat, dc){
  const t = MYS_ROLL_BASE + ((stat|0) - dc) * MYS_ROLL_STEP;
  return Math.max(MYS_ROLL_MIN, Math.min(MYS_ROLL_MAX, t));
}
function mysTarget(path, dc){ return mysTargetAt(mysStat(path), dc); }
function mysCanRoll(path, dc){ return mysStat(path) >= dc - MYS_GATE; }

/* 주사위 소스 — 검증기가 갈아끼울 수 있게 분리해 둔다(_setRng) */
let mysRng = () => Math.random();
function mysRoll(){ return 1 + Math.floor(mysRng() * 100); }

/* 'extreme' | 'hard' | 'normal' | 'fail' | 'fumble' */
function mysGrade(roll, target){
  if(roll <= Math.floor(target/5)) return 'extreme';
  if(roll <= Math.floor(target/2)) return 'hard';
  if(roll <= target)               return 'normal';
  if(roll === 100 || (target < 50 && roll >= 96)) return 'fumble';
  return 'fail';
}
function mysIsWin(g){ return g==='extreme' || g==='hard' || g==='normal'; }
const MYS_GRADE_LABEL = { extreme:'극단 성공', hard:'어려운 성공', normal:'성공',
                          fail:'실패', fumble:'대실패' };

/* 한 번의 판정. 결과 객체를 돌려주고 오염도까지 여기서 청구한다(단일 창구). */
function mysCheck(path, dc, id, why){
  const t=mysTarget(path, dc), r=mysRoll(), g=mysGrade(r, t);
  mysMarkTried(id);
  let taint=0;
  if(g==='fail')    taint=MYS_TAINT_FAIL;
  if(g==='fumble')  taint=MYS_TAINT_FUMBLE;
  /* 극단 성공 = 회복. 오염도가 0이면 아무 일도 안 일어난다(음수로 안 내려간다). */
  if(g==='extreme') taint=-MYS_TAINT_HEAL;
  if(taint) mysAddTaint(taint, (why||id)+' '+MYS_GRADE_LABEL[g]);
  return { roll:r, target:t, grade:g, win:mysIsWin(g), taint:taint,
           text:'🎲 '+r+'/'+t+' — '+MYS_GRADE_LABEL[g] };
}

/* ── 플레이버 조회 ───────────────────────────────────────────────────
   좌표로 고르므로 같은 칸은 항상 같은 문구다. 무작위로 돌리면 같은 자리를 두 번 눌렀을 때
   말이 바뀌어서 "이 방은 실재하지 않는다"는 느낌이 든다. */
function mysFlavor(x,y){
  const c=mysCase(); if(!c) return MYS_FLAVOR_ANY[0];
  const k=mysKey(x,y);
  if(c.flavorAt && c.flavorAt[k]) return c.flavorAt[k];
  const z=mysZoneChar(x,y);
  const pool=(z && c.flavor && c.flavor[z] && c.flavor[z].length) ? c.flavor[z] : MYS_FLAVOR_ANY;
  return pool[(x*7 + y*13) % pool.length];
}
function mysLooked(x,y){ const f=mysField(); return !!(f && (f.looked||[]).indexOf(mysKey(x,y))>=0); }

/* ── 조사 ────────────────────────────────────────────────────────────*/
function mysGotClue(id){ const f=mysField(); return !!(f && (f.got||[]).indexOf(id)>=0); }
/* 우측 목록·개수에 실제로 보일 단서만.
   ★ 얻은 것(f.got)과 보여줄 것(여기)은 다르다 — 잡담 재심문(noclue)은 '다시 묻지 않기'
     위해 f.got 에 들어가야 하지만 수첩에 적힐 물건은 아니다. 이 둘을 한 배열로 합치면
     둘 중 하나가 반드시 틀린다. */
function mysClueIds(){
  const f=mysField(), c=mysCase(); if(!f||!c) return [];
  return (f.got||[]).filter(id=>{
    const raw=String(id).replace(/^!/,'');
    const s=(c.spots||[]).find(x=>x.id===raw) || (c.granted&&c.granted[raw]);
    return !!s && !s.noclue;
  });
}
/* ── 심문 절차 ───────────────────────────────────────────────────────
   ★ 심문은 혼자 하는 일이 아니다. 자격 있는 사람 중 한 명이 대표로 굴리고 나머지는 지켜본다.
     지켜보는 것도 공짜가 아니다 — 현장 공기에 이미 오류가 노출돼 있으므로(세계관 9절)
     관전자도 +1 물든다. 그래야 "나는 심문 안 하니까 따라다니기만 하면 된다"가 안 생긴다.
   ★ 재심문(after)은 이 절차를 타지 않는다. 누구나 아무 때나 한 번 더 물을 수 있다 —
     잡담 한 마디 들으려고 전원 레디를 걸면 아무도 안 쓰는 기능이 된다.
   ⚠ 이 층은 화면을 만들지 않는다. '누가 굴리고 누가 물드는가'만 정한다.
     지금은 솔로뿐이라 mysMates() 가 빈 배열이고, 그래서 모든 판정이 '나 혼자'로 즉시 끝난다 —
     파티가 붙어도 여기를 고치는 게 아니라 mysMates() 하나만 채우면 된다. */
const MYS_READY_MS = 90000;   // 레디 타임아웃 — 안 누른 사람은 빼고 절차를 계속한다

/* 파티원 훅 — 파티를 얹을 때 [{id, name, intr}] 를 돌려주면 절차가 살아난다.
   ⚠ 나는 여기 안 들어간다. 나를 섞으면 '나 혼자인가'를 세는 곳마다 −1 을 해야 한다. */
let mysMateHook = null;
/* ★ 훅이 꽂혀 있으면 훅이 우선이다 — 검증기가 파티 없이 절차만 굴려보기 위한 것이고,
     실기기에서는 네트워크에서 들어온 파티원이 그대로 목록이 된다.
   ⚠ 나는 여기 안 들어간다. 섞으면 '나 혼자인가'를 세는 곳마다 −1 을 해야 한다. */
function mysMates(){
  try{ if(mysMateHook) return mysMateHook()||[]; }catch(_){ return []; }
  try{ return mysNetPeers().map(p=>({ id:p.id, name:p.name, intr:p.intr|0 })); }
  catch(_){ return []; }
}
function mysSolo(){ return !mysMates().length; }

/* 이 심문에 손댈 수 있는 사람들. 자격(적성 ≥ dc − MYS_GATE)을 갖춘 사람만. */
function mysInterroCandidates(dc){
  const a=agent();
  const me={ id:'me', name:(a && a.name) || '요원', intr:mysStat('intr'), mine:true };
  const all=[me].concat(mysMates().map(m=>({ id:m.id, name:m.name||m.id, intr:(m.intr|0) })));
  return all.filter(p => p.intr >= dc - MYS_GATE);
}
/* 담당자 선정 = 판정. ★ 전원이 한 번씩 굴리고, **가장 낮은 숫자**를 낸 사람이 맡는다.
   롤언더라 낮은 것이 곧 잘 굴린 것이고, 그 굴림이 그대로 이 심문의 결과가 된다.
   ⚠ 예전에는 선정 굴림 한 번, 판정 굴림 한 번으로 두 번 굴렸다. 그러면 잘 굴려서 뽑힌
     사람이 곧바로 실패하는 일이 생기고, 플레이어는 무엇 때문에 뽑혔는지 알 수 없게 된다.
     굴림은 하나여야 한다 — 뽑힌 이유와 결과가 같은 숫자여야 납득이 된다.
   ★ 굴림은 한 명씩 전부 기록에 남기고 전원에게 보낸다. 등급까지 적는다 —
     "누가 맡는다"만 뜨면 그 자리에서 무슨 일이 있었는지가 아무 데도 안 남는다.
   ⚠ 목표치는 사람마다 다르다(각자의 심문 적성). 그래서 등급도 그 사람 목표치로 낸다.
   돌려주는 값 — 굴렸으면 true, 굴릴 사람이 나뿐이면 false(예전대로 🎲 를 직접 누른다). */
function mysInterroRolls(s, dc){
  const list=mysInterroCandidates(dc);
  if(list.length<2) return false;
  const rolls=list.map(p=>{
    const t=mysTargetAt(p.intr, dc), r=mysRoll();
    return { id:p.id, name:p.name, mine:!!p.mine, r:r, t:t, g:mysGrade(r,t) };
  });
  /* ⚠ 같은 숫자가 나오면 id 순으로 가른다. 여기서 흔들리면 사람마다 다른 담당이 나온다. */
  rolls.sort((a,b)=> (a.r-b.r) || (a.id<b.id?-1:1));
  const win=rolls[0];
  rolls.forEach(x=>{
    const line='🎲 '+x.name+' '+x.r+'/'+x.t+' — '+MYS_GRADE_LABEL[x.g];
    mysLog('dice', line);
    mysNetSend({ t:'log', k:'dice', x:line });
  });
  const head=s.name+' 심문 — '+mysJosaIGa(win.name)+' 맡는다.';
  mysLog('sys', head); mysNetSend({ t:'log', k:'sys', x:head });

  mysMarkTried(s.id);
  /* 관전자 오염도 — 맡은 사람 빼고 전원 +1. 남의 오염도는 청구서만 보낸다(각자 올린다). */
  mysInterroWatch(list.filter(p=>p.id!==win.id));
  /* 굴림 값의 오염도는 맡은 사람이 낸다. 내가 아니면 그 사람 클라이언트가 올린다. */
  let taint=0;
  if(win.g==='fail')    taint=MYS_TAINT_FAIL;
  if(win.g==='fumble')  taint=MYS_TAINT_FUMBLE;
  if(win.g==='extreme') taint=-MYS_TAINT_HEAL;
  if(taint){
    const why=s.name+' '+MYS_GRADE_LABEL[win.g];
    if(win.mine) mysAddTaint(taint, why);
    else mysNetSend({ t:'taint', to:win.id, n:taint, why:why });
  }
  /* ★ 대성공·대실패를 따로 알리지 않는다. 굴림이 이미 전원에게 공개됐다 —
     한 번 더 "좋은 일이 생긴 것 같다"를 흘리면 같은 말이 두 번 뜬다. */
  if(mysIsWin(win.g)) mysGainSpot(s, win.g);
  else {
    /* 실패한 말도 같이 들은 말이다 — 심문은 사물 조사와 달리 전원이 본다 */
    mysLog('clue', s.fail);
    mysNetSend({ t:'log', k:'clue', x:s.fail });
    if(win.g==='fumble'){ const ex=mysFumble(s); if(ex) mysLog('sys', ex); }
  }
  mysSave(); mysRenderField();
  return true;
}
/* 관전자 오염도 — 지켜본 사람 전원 +1.
   ⚠ 남의 오염도는 그 사람 클라이언트에서만 올릴 수 있다. 여기서는 '누가 물들었는지'까지만
     정하고, 실제 청구는 파티 동기화가 붙을 때 mysSendWatchTaint 로 나간다. */
/* ★ 남의 오염도는 그 사람 클라이언트에서만 오른다. 여기서는 청구서를 보낼 뿐이고,
     받은 쪽이 스스로 올린다(mysNetRecv 의 'taint'). 남의 저장을 내가 쓰지 않는다. */
function mysSendWatchTaint(id, n){
  if(!id || id==='me') return;
  mysNetSend({ t:'taint', to:id, n:n|0, why:'심문 관전' });
}
function mysInterroWatch(watchers){
  (watchers||[]).forEach(w=>{
    if(w.mine) mysAddTaint(MYS_TAINT_WATCH, '심문 관전');
    else mysSendWatchTaint(w.id, MYS_TAINT_WATCH);
  });
}
/* 레디 게이트 — 전원이 모여야 시작한다. 타임아웃이 지나면 안 누른 사람을 빼고 간다.
   ★ 타임아웃이 없으면 한 명이 자리를 비운 사이 사건이 통째로 멈춘다. */
let mysReady = null;   // { spotId, got:{id:true}, since }
function mysReadyGate(s){
  if(mysSolo()) return true;                       // 기다릴 사람이 없다
  if(!mysReady || mysReady.spotId!==s.id){
    mysReady={ spotId:s.id, got:{ me:true }, since:Date.now() };
    /* 남의 화면에 레디 버튼을 띄운다. ⚠ 이게 없으면 파티원은 무엇을 기다리는지 모른 채
       화면이 멈춰 있고, 여는 사람은 90초 타임아웃까지 세워둔다. */
    mysNetSend({ t:'gate', spot:s.id, name:s.name });
  }
  const waiting=mysMates().filter(m=>!mysReady.got[m.id]);
  if(!waiting.length) return true;
  if(Date.now()-mysReady.since >= MYS_READY_MS){
    mysLog('sys', '레디 시간이 지났다 — '+waiting.length+'명을 빼고 시작한다.');
    return true;
  }
  mysFieldMsg('심문 준비 — '+waiting.length+'명 대기 중', true);
  return false;
}
function mysInterroReady(id){
  if(!mysReady) return null;
  mysReady.got[id||'me']=true;
  mysRenderField();
  return Object.keys(mysReady.got).length;
}
/* 심문을 시작할 수 있는가. 'go'(내가 혼자 굴린다) · 'wait'(대기) · 'done'(전원 굴림까지 끝났다)
   ★ 순서 — 전원 레디 → 파티장이 [심문 nn%] 를 누른다 → 그 자리에서 전원이 굴린다.
     레디만으로 저절로 시작하지 않는다. 마지막 한 사람이 레디를 누른 순간 심문이 터지면
     "누가 시작했는지" 없이 장면이 지나간다. 시작은 사람이 누르는 일이어야 한다. */
function mysInterroBegin(s, dc){
  if(s.after) return 'go';                         // 재심문은 절차 없이 누구나
  if(mysSolo()) return 'go';
  if(!mysReadyGate(s)) return 'wait';
  /* ⚠ 시작은 파티장만. 각자 시작할 수 있으면 같은 심문이 사람 수만큼 굴려진다. */
  if(!mysIsLeader()){
    mysFieldMsg('전원 레디 — 심문은 파티장이 시작한다.', true);
    return 'wait';
  }
  mysReady=null;
  return mysInterroRolls(s, dc) ? 'done' : 'go';
}

function mysSearchHere(){
  const f=mysField(); if(!f) return;
  const a=agent();
  if(a && (a.suspended || a.lost))
    return mysFieldMsg('오염도 상한 — 이 요원은 더 활동할 수 없다. 우측에서 교대할 것.', true);
  const lk=mysLockHere();
  if(lk) return mysOpenLock();          // 잠금 칸에서는 둘러보기가 곧 잠금 시도다
  mysGrid(); const s=mysSpotAt(f.pos);
  const p=mysXY(f.pos);
  /* 단서가 없는 칸 = 플레이버. 판정도 오염도도 없다.
     ★ 여기에 실패나 오염도를 붙이면 플레이어가 방을 안 뒤진다. 절대 금지. */
  if(!s || s.stage > f.stage){
    if(!mysLooked(p.x,p.y)) f.looked=(f.looked||[]).concat([f.pos]);
    const fl=mysFlavor(p.x,p.y);
    mysLog('clue', fl);
    mysScene(mysZoneName(p.x,p.y), [fl], 'clue');
    mysSave(); mysRenderField(); return;
  }
  if(mysGotClue(s.id)) return mysFieldMsg('이미 조사했다.', true);
  /* ⚠ 예전엔 여기서 f.shut 으로 심문 대실패 뒤 재질문을 막았다. 지우지 말 것 —
     그 한 줄이 사건을 통째로 막는 유일한 경로였다(카드를 주는 심문에서 대실패하면 끝). */
  /* 아이템 조건 — 없으면 시도 자체가 안 된다. 무엇이 필요한지는 말하지 않는다. */
  if(s.need && !mysHasItem(s.need)) return mysFieldMsg('지금은 손댈 수 없다.', true);
  if(s.needOpen && !mysItemOpen(s.needOpen)) return mysFieldMsg('지금은 손댈 수 없다.', true);
  /* ★ auto — 조건을 이미 갖춰서 '하기만 하면 되는' 일. 굴리지 않고 오염도도 없다.
     조건을 갖춘 뒤에 또 굴리게 하면, 잠금은 뚫었는데 그 다음 판정에서 갇히는 배분이 생긴다. */
  if(s.auto) return mysGainSpot(s);
  const dc=mysDcOf(s.id, s.dc);
  if(!mysCanRoll(s.path, dc))
    return mysFieldMsg('이건 내가 다룰 수 있는 게 아니다. ['+STAT_LABEL[s.path]+' '
      +Math.max(0,dc-MYS_GATE)+' 이상 필요]', true);
  /* ★ 심문만 절차를 탄다. 사물 조사는 혼자 들여다보는 일이라 모을 이유가 없다.
     솔로에서는 mysInterroBegin 이 언제나 'go' 라 아래 한 줄이 없는 것과 같다. */
  if(s.path==='intr'){
    const how=mysInterroBegin(s, dc);
    if(how==='wait') return;                      // 레디 대기 — 안내는 게이트가 이미 남겼다
    /* 'done' — 전원이 굴렸고 결과까지 났다. 여기서 또 🎲 를 띄우면 한 심문을 두 번 굴린다. */
    if(how==='done') return mysRenderField();
  }
  /* 바로 굴리지 않는다 — 우측 버튼이 🎲 로 바뀌고 직접 눌러야 결과가 난다 */
  mysAskRoll('spot', s, s.path, dc, s.name+' ['+STAT_LABEL[s.path]+' '+mysTarget(s.path,dc)+'%]');
}

/* 단서를 실제로 손에 넣는 곳 — 성공 판정과 auto 조사가 함께 지난다.
   ⚠ 좀아칼 함정 #5: 획득 경로를 두 군데로 복사하면 한쪽만 고쳐진다. 반드시 여기 하나만 둔다. */
function mysGainSpot(s, grade){
  const f=mysField(); if(!f||!s) return;
  if(mysGotClue(s.id)) return;
  f.got=(f.got||[]).concat([s.id]);
  if(s.give) mysGiveItem(s.give);
  /* ★ 성공은 파티 전원의 것이다 — 한 명이 성공하면 나머지는 굴리지 않고 그대로 받는다.
     단서(got)와 딸린 아이템(give)을 같이 나눈다. 카드 같은 아이템이 성공한 한 사람에게만
     있으면 아이템 잠금 문이 그 사람에게만 열려, 파티가 문 앞에서 갈라진다.
     ⚠ 받는 쪽 처리는 mysNetRecv 의 'clue' → mysGainShared 하나뿐이다(획득 경로 하나 규칙).
     ⚠ 오정보('!'+id)와 개인 실패는 각자의 것 — 여기(성공)로만 나간다. */
  mysNetSend({ t:'clue', id:s.id, grade:(grade==='extreme'?'extreme':'') });
  /* 대사는 lines, 서술은 text. 심문은 장면으로 재생한다 —
     사람에게 듣는 것과 사물을 보는 것은 화면이 달라야 한다. */
  const lines=(s.lines && s.lines.length) ? s.lines.slice() : [s.text];
  if(grade==='extreme' && s.bonus) lines.push(s.bonus);
  /* 심문 스크립트는 전원이 본다 — 같은 자리에서 같이 들은 말이다(가시성 규칙).
     ⚠ 조사 결과(text)는 안 보낸다. 사물 조사는 나만 본 것이다. */
  if(s.path==='intr'){ mysScene(s.name, lines);
    mysNetSend({ t:'scene', who:s.name, lines:lines, kind:'' }); }
  else {
    /* 기록에 먼저 남기고, 같은 것을 화면에도 세운다. 순서가 이래야
       장면을 안 닫고 창을 꺼도 무엇을 알아냈는지가 남는다. */
    lines.forEach(l=>mysLog('clue', l));
    mysScene(s.name, lines, 'clue');
  }
  mysCheckCondition();
  mysCheckRecap();
  mysSave(); mysRenderField();
}

function mysResolveSpot(s){
  const f=mysField(); if(!f||!s) return;
  const dc=mysDcOf(s.id, s.dc);
  const r=mysCheck(s.path, dc, s.id, s.id);
  mysLog('dice', r.text+' · '+s.name+' ['+STAT_LABEL[s.path]+']');
  mysAnnounceSwing(r.grade);
  if(r.win){
    mysGainSpot(s, r.grade);
  } else {
    mysLog('clue', s.fail);
    if(r.grade==='fumble'){ const ex=mysFumble(s); if(ex) mysLog('sys', ex); }
  }
  mysSave(); mysRenderField();
}

/* 대성공·대실패만 전원에게 알린다. ★ 내용은 밝히지 않는다 —
   무슨 일인지는 본인이 채팅으로 말해야 하고, 그게 대화를 유발한다. */
function mysAnnounceSwing(grade){
  if(grade!=='extreme' && grade!=='fumble') return;
  const a=agent(); const who=(a && a.name) || '요원';
  const t=who+'에게 '+(grade==='extreme'?'좋은':'나쁜')+' 일이 생긴 것 같다.';
  mysLog('sys', t);
  /* ★ 무슨 일인지는 안 밝힌다. 밝히면 채팅으로 말할 이유가 사라진다. */
  mysNetSend({ t:'log', k:'sys', x:t });
}

/* 대실패 부작용 — 경로마다 다르다. 오염도 본체는 mysCheck 가 이미 청구했다.
   ★ 어떤 부작용도 '그 단서를 영영 못 얻게' 만들지 않는다. 재시도는 언제나 열려 있다 —
     한 번의 굴림으로 사건이 막히면 플레이어는 세이브를 되돌리거나 게임을 접는다.
     대실패의 무게는 '닫힘'이 아니라 '비싸짐'으로 준다. */
function mysFumble(s){
  const f=mysField(); if(!f) return '';
  if(s.path==='obsv'){
    /* 현장을 흐트러뜨린다 — 그 지점이 어려워진다.
       ⚠ 지점당 한 번만. 누적시키면 대실패가 반복될수록 사실상 못 얻는 단서가 된다. */
    f.dcUp=f.dcUp||{};
    if(!f.dcUp[s.id]){ f.dcUp[s.id]=1; return '(현장을 흐트러뜨렸다 — 이 지점이 한 단계 어려워졌다)'; }
    return '(이미 흐트러진 자리다. 더 나빠지지는 않는다)';
  }
  if(s.path==='anly' && s.wrongText){
    /* ⚠ 오정보는 기록에서 시각적으로 구분하지 않는다. 구분되면 안 믿으면 그만이라
       장치가 죽는다. 다른 경로 단서와 모순이 생겨 알아채는 구조여야 한다.
       진짜 단서는 여전히 안 얻은 상태라 다시 굴릴 수 있다. */
    f.got=(f.got||[]).concat(['!'+s.id]);
    return '(읽어냈다고 생각했다)';
  }
  if(s.path==='intr'){
    /* 예전엔 '그 단계 동안 재질문 불가'였다. 그게 사건이 통째로 막히는 유일한 경로였다 —
       기록관 카드를 주는 심문에서 대실패하면 2단계가 시작조차 안 됐다. */
    return '(상대가 언짢아졌다. 다시 물어볼 수는 있다)';
  }
  if(s.path==='infl') return '(흔적을 남겼다)';
  return '';
}

/* ── 문 열기 ─────────────────────────────────────────────────────────*/
function mysOpenDoor(x,y){
  const f=mysField(); if(!f) return;
  const d=mysDoorAt(x,y); if(!d || !d.lock) return;
  const a=agent();
  if(a && (a.suspended || a.lost)) return mysFieldMsg('이 요원은 더 활동할 수 없다.', true);
  const L=d.lock;
  /* 굴려서 열 수 있는 문이 아니면 왜 안 열리는지만 말한다.
     ⚠ 무엇이 필요한지는 말하지 않는다 — "카드가 필요합니다"까지 알려주면 추리가 준다. */
  if(L.type==='stage') return mysFieldMsg(d.name+' — 잠겨 있다.', true);
  if(L.type==='item')  return mysFieldMsg(d.name+' — 잠겨 있다. 여는 수단이 없다.', true);
  if(d.stage && d.stage > f.stage) return mysFieldMsg('지금 이 문을 열 이유가 없다.', true);
  if(!mysCanRoll(L.path, L.dc))
    return mysFieldMsg(d.name+' — 손도 못 대겠다. ['+STAT_LABEL[L.path]+' '
      +Math.max(0,L.dc-MYS_GATE)+' 이상 필요]', true);
  mysAskRoll('door', {x:x, y:y}, L.path, L.dc,
    d.name+' ['+STAT_LABEL[L.path]+' '+mysTarget(L.path,L.dc)+'%]');
}

function mysResolveDoor(ref){
  const f=mysField(); if(!f||!ref) return;
  const d=mysDoorAt(ref.x, ref.y); if(!d || !d.lock) return;
  const k=mysKey(ref.x, ref.y);
  const r=mysCheck(d.lock.path, d.lock.dc, 'door:'+k, d.name);
  mysLog('dice', r.text+' · '+d.name);
  mysAnnounceSwing(r.grade);
  if(!r.win){
    /* ★ 실패하면 열리지 않는다. 재도전은 자유이고 시도마다 오염도를 낸다. */
    mysLog('clue', d.name+'은 열리지 않는다.');
    if(r.grade==='fumble'){ mysAddTaint(MYS_TAINT_FAIL, k+' 흔적'); mysLog('sys','흔적을 남겼다.'); }
    mysSave(); mysRenderField(); return;
  }
  f.opened=(f.opened||[]).concat([k]);
  const c=mysCase();
  mysLog('sys', d.name+'이 열렸다.');
  /* 열린 문은 전원 공유 — 사람마다 다른 문이 열려 있으면 지도가 사람마다 다른 게임이 된다 */
  mysNetSend({ t:'door', at:k, name:d.name });
  if(d.grant && c.granted && c.granted[d.grant] && !mysGotClue(d.grant)){
    f.got=(f.got||[]).concat([d.grant]);
    mysLog('clue', c.granted[d.grant].text);
    /* ★ 문이 준 단서도 전원의 것이다 — 문 열림만 공유하고 보상 단서를 안 나누면,
       그 단서가 조건인 정리 스크립트가 연 사람 화면에만 뜬다. */
    mysNetSend({ t:'clue', id:d.grant });
  }
  mysSave(); mysRenderField();
}

/* ── 이동 ────────────────────────────────────────────────────────────*/
function mysMove(tx,ty){
  const f=mysField(); if(!f) return;
  /* ⚠ 채팅 말풍선(soft)은 걸음을 막지 않는다. 막으면 파티원이 한마디 칠 때마다
     전원이 그 자리에 못 박힌다 — 걸으면서 얘기하는 게 파티다.
   ⚠ 굴림 대기(🎲)도 걸음을 막지 않는다. 막아두면 잘못 누른 조사 하나에 갇혀서
     굴리는 것 말고는 할 수 있는 일이 없다. 대신 그 자리를 뜨면 굴림이 취소된다(아래). */
  if((mysInScene() && !mysSoftScene()) || mysModal) return;
  const r=mysCanEnter(tx,ty);
  /* 잠긴 문을 두드리는 것도 그 자리에서 하는 일이다 — 세워둔 굴림부터 접는다 */
  if(r==='locked'){ if(mysPending && mysPending.kind!=='door') mysDropPending();
                    return mysOpenDoor(tx,ty); }
  if(r!=='ok') return;
  mysDropPending();
  f.pos=mysKey(tx,ty);
  mysReveal(f, f.pos);
  /* 이동 자체는 기록에 남기지 않는다 — 남기면 기록 창이 발자국으로 뒤덮여
     정작 단서와 대사가 밀려 올라간다. 현재 위치는 우측 상단에 항상 떠 있다. */
  mysSave(); mysRenderField();
}

/* ── 단계 제출 ───────────────────────────────────────────────────────
   ⚠ 파티: 제출은 파티장만. 문 열림은 파티 공유 상태여야 한다(파티장이 딴 방에 있어도
     문 앞에 선 사람이 열 수 있어야 하므로). 이 둘을 같은 층위에 두지 말 것.
     지금은 솔로뿐이라 mysCanSubmit() 이 항상 true 다 — 파티 붙일 때 여기만 고친다. */
function mysCanSubmit(){ return mysIsLeader(); }
function mysStageDef(){ const c=mysCase(), f=mysField();
  return (c&&f) ? (c.stages||[]).find(s=>s.n===f.stage) : null; }
/* 지금 서 있는 칸에 이번 단계의 잠금이 있는가 */
function mysLockHere(){
  const f=mysField(), st=mysStageDef();
  return (f && st && st.type==='code' && st.at===f.pos) ? st : null;
}
/* 조건 단계 — 답안 없이 지정 단서를 얻으면 넘어간다.
   ★ 아이템 체인처럼 '풀어낸 것 자체가 답'인 단계는 입력창을 띄울 대상이 없다. */
/* 조각이 전부 모이면 한 번만 짚어준다.
   ★ 답은 말하지 않는다 — 마지막 줄은 반드시 질문으로 끝난다(데이터 규약).
     답까지 말하면 추리가 받아쓰기가 되고, 그 단계의 단서 넷이 전부 장식이 된다.
   ⚠ 심문 장면이 이미 떠 있으면 덮어쓰지 않는다. 대사가 통째로 날아간다. */
function mysCheckRecap(){
  const f=mysField(), c=mysCase(); if(!f||!c) return;
  f.recap=f.recap||[];
  (c.recaps||[]).forEach(r=>{
    if(f.recap.indexOf(r.id)>=0) return;
    if(!(r.need||[]).every(id=>mysGotClue(id))) return;
    f.recap.push(r.id);
    /* 심문 장면이 흐르는 중이면 mysScene 이 알아서 대기열에 세운다. */
    mysScene(r.who || '정리', r.lines||[], 'recap');
  });
}

function mysCheckCondition(){
  const f=mysField(), st=mysStageDef();
  if(!f || !st || st.type!=='condition') return;
  if(st.needClue && !mysGotClue(st.needClue)) return;
  f.stage=f.stage+1;
  mysLog('sys', st.name+' — 다음 단계로.');
  mysStageCleared(st);
  mysNetSend({ t:'stage', n:f.stage, v:st.name });
  mysSave();
}
/* 남이 단계를 넘겼을 때 내 쪽을 맞춘다.
   ★ 단계는 전원이 같이 넘어간다 — 사람마다 다른 단계에 서 있으면 같은 칸이
     누구에게는 조사 지점이고 누구에게는 빈 복도가 된다.
   ⚠ 보상은 각자 받는다(MYS.cleared 가 클라이언트마다 따로다). 같이 푼 사건이니 맞다.
   ⚠ 되돌아가지 않는다. 늦게 도착한 옛 메시지가 단계를 되감으면 문이 도로 잠긴다. */
function mysApplyStage(n, why, who){
  const f=mysField(), c=mysCase(); if(!f||!c) return;
  n=n|0; if(n<=f.stage) return;
  const st=(c.stages||[]).find(x=>x.n===f.stage);
  f.stage=n; f.wrong=0; mysModal=null; mysAsk=null;
  mysLog('sys', (who?who+' — ':'')+(why||'')+' · 다음 단계로.');
  mysStageCleared(st);
  if(f.stage > (c.stages||[]).length) mysFinishCase();
  else mysCheckCondition();
  mysSave(); mysRenderField();
}
/* 파티원이 성공해 나눠 준 단서를 받는다.
   ★ 성공은 전원의 것 — 받는 쪽은 굴리지 않고, 오염도도 없다(굴림이 없었으므로).
   ★ 심문(intr)은 장면(t:'scene')이 따로 오므로 여기서는 목록·아이템만 맞추고 입을 다문다 —
     여기서도 대사를 그리면 같은 장면이 두 번 선다.
   ★ 정리(recap)·조건 단계는 받은 쪽에서도 각자 검사한다. 단서가 같으니 결과도 같다 —
     이게 곧 "단서가 모여도 정리 스크립트가 파티원에게 안 보인다"의 수리다.
   ⚠ 획득의 본체는 여전히 mysGainSpot 하나다. 여기는 '남이 얻은 것을 옮겨 적는' 자리라
     판정·오염도·전송을 하나도 하지 않는다(하면 메아리가 돈다 — quiet 가 막고는 있지만). */
function mysGainShared(id, who, grade){
  const f=mysField(), c=mysCase(); if(!f||!c||!id) return;
  if(mysGotClue(id)) return;
  const s=(c.spots||[]).find(x=>x.id===id) || (c.granted && c.granted[id]) || null;
  f.got=(f.got||[]).concat([id]);
  if(s && s.give) mysGiveItem(s.give);
  if(s && s.path!=='intr'){
    mysLog('sys', (who||'파티원')+' — '+(s.name||'조사')+' 성공. 단서를 같이 확보했다.');
    const lines=(s.lines && s.lines.length) ? s.lines.slice() : [s.text];
    if(grade==='extreme' && s.bonus) lines.push(s.bonus);
    lines.forEach(l=>{ if(l) mysLog('clue', l); });
  }
  mysCheckCondition();
  mysCheckRecap();
  mysSave();
}
/* 파티원이 아이템 잠금(워치 패턴 등)을 풀었다 — 내 쪽도 풀린 것으로 맞춘다. */
function mysApplyUnlock(id, who){
  const f=mysField(); if(!f||!id) return;
  if((f.unlocked||[]).indexOf(id)>=0) return;
  f.unlocked=(f.unlocked||[]).concat([id]);
  const d=mysItemDef(id);
  mysLog('sys', (who||'파티원')+'이(가) '+((d&&d.name)||id)+' 잠금을 풀었다.');
  mysSave();
}
/* 잠금을 푼 직후 — 그 잠금이 감추고 있던 내용을 흘린다.
   ★ 통과 표시만 남기면 "암호를 맞혔다"로 끝나서, 무엇을 알아냈는지가 화면에 안 남는다. */
/* ★ revealWho 가 있으면 기록 창이 아니라 스크립트 박스로 흐른다.
   잠금 뒤에 있는 것이 '읽을거리'가 아니라 장면일 때가 있다 — 워치 메모패드가 그렇다.
   조사 로그로 흘리면 오른쪽 구석에서 여섯 줄이 스쳐 지나가고, 무엇을 열었는지가 안 남는다.
   ⚠ 장면 대사는 끝날 때 mysScene 이 알아서 기록 창에도 남긴다. 여기서 또 남기면 두 번 뜬다. */
function mysStageCleared(st){
  if(!st) return;
  if(st.reveal){
    const lines=[].concat(st.reveal);
    if(st.revealWho) mysScene(st.revealWho, lines, st.revealKind||'');
    else lines.forEach(t=>mysLog('clue', t));
  }
  /* ★ revealThen — 잠금이 열린 '다음'에 뜨는 한 마디. 화자가 다르므로 장면을 따로 세운다
     (mysScene 이 알아서 뒤에 줄 세운다). 여기가 없으면 일기를 읽자마자
     "그래서 이제 뭘 하지"가 오고, 플레이어는 지도를 처음부터 다시 돈다. */
  const th=st.revealThen;
  if(th && th.lines && th.lines.length) mysScene(th.who||'정리', th.lines, th.kind||'recap');
}
/* 사건 종결 — 보상은 최초 클리어에만. 재조사로 조각이 반복 수급되면 수치가 의미를 잃는다. */
function mysFinishCase(){
  const c=mysCase(); if(!c) return;
  const first=(MYS.cleared||[]).indexOf(c.id)<0;
  if(first) MYS.cleared=(MYS.cleared||[]).concat([c.id]);
  (c.epilogue||[]).forEach(t=>mysLog('clue', t));
  const rw=c.reward||{};
  const n=(rw.fragments)|0;
  if(first && n){
    MYS.fragments=(MYS.fragments|0)+n;
    mysLog('sys','단서 조각 '+n+'개를 확보했다. (누적 '+(MYS.fragments|0)+')');
  } else if(n){
    mysLog('sys','이미 종결된 사건이다. 단서 조각은 다시 나오지 않는다.');
  }
  /* ★ 정화 시스템 — 지부장이 "해결하고 오면 주마"라고 한 그것이다.
     이걸 받은 뒤부터 집중 레벨업이 오염도를 −30 해준다(mysApplyFocusHeal). */
  if(rw.purifier && !MYS.purifier){
    MYS.purifier=true;
    mysLog('sys','■ 정화 시스템을 지급받았다. 이제 집중 레벨이 오를 때마다 오염도가 내려간다.');
  }
  /* ★ 튜토리얼 뒷정리 — 회복 수단이 없는 채로 치른 사건이라, 여기서 한 번 씻어준다.
     안 그러면 90 가까이 쌓인 오염도를 안고 다음 사건에 들어가게 되고,
     회복 수단을 막아둔 게 그대로 다음 사건의 벌이 된다. */
  if(rw.clearTaint){
    let washed=0;
    MYS.agents.forEach(a=>{ washed += -mysSetTaint(a, 0, '정화'); });
    MYS.agents.forEach(a=>{ a.suspended=false; a.lost=false; });
    if(washed) mysLog('sys','정화가 끝났다. 요원 전원의 오염도가 씻겼다. (총 '+washed+')');
  }
  /* ★ 종결 연출 — 지목이 맞은 뒤에야 흐른다. 장면은 순서가 곧 의미라
     한 덩이로 붙이지 않고 화자별로 세운다(mysScene 이 알아서 대기열에 줄 세운다).
   ⚠ 여기서 새 사실을 밝히지 않는다. 이미 모은 단서의 순서를 맞춰 보여줄 뿐이다 —
     지목 뒤에 처음 듣는 사실이 나오면 앞의 추리가 통째로 무의미해진다. */
  [].concat(c.finale||[]).forEach(sc=>{
    if(sc && sc.lines && sc.lines.length) mysScene(sc.who||'정리', sc.lines, sc.kind||'');
  });
  mysSave();
}

/* ── 범인 지목 ───────────────────────────────────────────────────────
   마지막 단계는 '입력'이 아니라 '선택'이다. 이름을 타이핑하게 하면 띄어쓰기 하나로 막히고,
   그 순간 사건이 아니라 맞춤법 싸움이 된다.
   ★ 정답 판정은 여전히 mysSubmit 하나다. 고른 이름을 같은 경로로 흘려보낸다 —
     판정이 두 군데로 갈라지면 반드시 한쪽만 고쳐진다(좀아칼 함정 #5).
   ★ 조건은 '더 조사할 게 없다'. 마지막 단계에서 그 단계까지의 조사가 전부 끝났을 때만 뜬다.
     일찍 띄우면 단서를 반쯤 들고 찍어 맞히는 게 최적 전략이 된다.
   ⚠ 예전에는 본부 보고 단말(8,11)에서 이름을 타이핑하는 길이 하나 더 있었다. 그건
     '못 얻은 단서가 있어 지목 버튼이 안 뜰 때 사건이 막히는' 것을 막는 뒷문이었다.
     단말을 없앤 지금은 그 뒷문을 mysAccuseLeft 가 대신한다 — 이 요원이 애초에 굴릴 수
     없는 조사는 '남은 조사'로 세지 않는다. 그게 없으면 잠행 0으로 키운 요원이
     후문 잠금장치 하나 때문에 영영 지목을 못 한다. */
/* 마지막 단계에 서 있고, 지목할 목록이 있는가. ★ 버튼이 '보이는' 조건이다. */
function mysAccuseStage(){
  const f=mysField(), c=mysCase(); if(!f||!c) return false;
  const last=(c.stages||[]).length;
  return !!(last && f.stage===last && c.accuse && c.suspects && c.suspects.length);
}
/* 아직 남은 조사. ★ 잡담(noclue)은 세지 않는다 — 컵라면 얘기를 안 들었다고
   범인을 못 잡는 건 말이 안 된다. */
function mysAccuseLeft(){
  const f=mysField(), c=mysCase(); if(!f||!c) return [];
  return (c.spots||[]).filter(s=>{
    if(s.noclue || s.stage>f.stage || mysGotClue(s.id)) return false;
    /* ★ 이 요원이 손도 못 대는 조사는 '남았다'고 세지 않는다. 세면 적성을 한쪽으로 몰아
       키운 요원이 조사 한 곳 때문에 마지막 단계에서 영영 못 나간다(본부 단말이 하던 일). */
    if(!s.auto && s.path && !mysCanRoll(s.path, mysDcOf(s.id, s.dc))) return false;
    return true;
  });
}
function mysAccuseReady(){ return mysAccuseStage() && !mysAccuseLeft().length; }
function mysOpenAccuse(){
  const c=mysCase(); if(!c || !mysAccuseStage()) return;
  const left=mysAccuseLeft();
  if(left.length) return mysFieldMsg('아직 조사할 것이 '+left.length+'곳 남았다.', true);
  mysModal={ type:'accuse', label:(c.accuse&&c.accuse.label)||'범인 지목' };
  mysRenderField();
}
/* 소지품에서 여는 잠금(워치 메모패드 등) */
function mysItemLockStage(itemId){
  const st=mysStageDef();
  return (st && st.type==='itemcode' && st.item===itemId) ? st : null;
}
function mysSubmit(val){
  const f=mysField(), c=mysCase(); if(!f||!c) return;
  const st=mysStageDef(); if(!st) return;
  const inp=el('mysLockInput');
  const v=String(val!=null ? val : ((inp&&inp.value)||'')).trim();
  if(!v) return mysFieldMsg('답안을 입력할 것.', true);
  /* ★ 원격 제출 — 파티원은 '제안'까지다. 값을 그대로 통과시키면 아무나 답을 무한히
     찔러볼 수 있게 되고, 오답 오염도는 파티장이 뒤집어쓴다. */
  if(!mysCanSubmit()){
    mysNetSend({ t:'ask', v:v });
    if(mysModal) mysModal=null;
    return mysFieldMsg('파티장에게 답안을 넘겼다 — "'+v+'"');
  }
  if(v.replace(/\s+/g,'').toUpperCase() === String(st.answer).replace(/\s+/g,'').toUpperCase()){
    f.stage=f.stage+1; f.wrong=0;
    if(inp) inp.value='';
    mysModal=null;                       // 팝업 닫기
    mysAsk=null;
    mysLog('sys', '잠금 해제 — '+v);
    mysStageCleared(st);
    mysNetSend({ t:'stage', n:f.stage, v:'잠금 해제 — '+v });
    if(f.stage > (c.stages||[]).length){
      mysFinishCase();
      mysFieldMsg('■ '+c.title+' 종결. 범인은 '+c.stages[c.stages.length-1].answer+'.');
    } else { mysFieldMsg('■ '+(f.stage-1)+'단계 통과 — 다음 단계로.'); mysCheckCondition(); }
  } else {
    /* ★ 지목 팝업은 틀려도 닫는다. 팝업이 화면을 덮고 있어서 "틀렸다"가 기록 창에 떠도
       그 아래에 가려 안 보인다 — 눌렀는데 아무 일도 안 일어난 것처럼 읽힌다.
       (암호 팝업은 입력칸이 그 자리에 있어야 하므로 그대로 열어둔다) */
    if(mysModal && mysModal.type==='accuse') mysModal=null;
    f.wrong=(f.wrong|0)+1;
    if(f.wrong%3===0){ mysAddTaint(MYS_TAINT_FAIL, '오답 누적');
      mysFieldMsg('틀렸다. 오답이 쌓였다 — 오염도 +'+MYS_TAINT_FAIL, true); }
    else mysFieldMsg('틀렸다. ('+(f.wrong%3)+'/3)', true);
  }
  mysSave(); mysRenderField();
}

/* ── 요원 교대 ────────────────────────────────────────────────────────
   활동 중지·Lost 된 요원을 대신할 슬롯을 찾는다.
   ★ 사건 진행(f)은 그대로 이어받는다. 단서·위치를 초기화하면 여기까지 온 것이 전부 날아가고,
     그건 오염도 상한이 사실상 사건 실패가 된다는 뜻이다. 상한은 '이 사람은 못 간다'까지여야 한다. */
function mysFreeSlot(){
  const c=mysCase(); const cap=(c && c.taintCap) || MYS_TAINT_LOST;
  for(let i=0;i<MYS_SLOTS;i++){
    const a=MYS.agents[i]; if(!a) continue;
    if(i===MYS.active) continue;
    if(a.lost) continue;
    if(taintOf(a) >= cap) continue;
    return i;
  }
  return -1;
}
function mysSwapAgent(){
  const i=mysFreeSlot();
  if(i<0) return mysFieldMsg('교대할 요원이 없다.', true);
  MYS.active=i;
  mysLog('sys', (agent().name||('A-00'+(i+1)))+'이 현장을 이어받았다. 단서와 위치는 인수된다.');
  mysSave(); if(mysBody) mysBody._mysLastHtml=''; mysRenderField();
}

/* ── 아이템 ──────────────────────────────────────────────────────────
   ★ 단서와 아이템은 다르다. 단서는 '안 것'이고 아이템은 '가진 것'이라
     문을 열고 잠금을 푸는 조건이 된다. 섞으면 "알고는 있는데 못 여는" 상태를 표현할 수 없다. */
function mysHasItem(id){ const f=mysField(); return !!(f && (f.items||[]).indexOf(id)>=0); }
function mysItemDef(id){ const c=mysCase(); return (c && c.items && c.items[id]) || null; }
function mysGiveItem(id){
  const f=mysField(); if(!f || !id || mysHasItem(id)) return;
  f.items=(f.items||[]).concat([id]);
  const d=mysItemDef(id);
  mysLog('sys', (d?d.name:id)+' 을(를) 손에 넣었다.');
}
function mysItemOpen(id){ const f=mysField(); return !!(f && (f.unlocked||[]).indexOf(id)>=0); }

/* ── 깃발 ────────────────────────────────────────────────────────────
   우클릭으로 칸을 찍어 "여기 다시 와야 한다"를 표시한다.
   ★ 예전엔 사람당 하나였다. 사물 단서에 표시가 없어진 뒤로는 하나로는 못 쓴다 —
     방을 뒤지다 찾은 자리를 여러 곳 찍어둬야 하고, 그게 곧 플레이어의 수첩이다.
   ★ 상한 10개. 무제한이면 4인 파티에서 지도가 깃발밭이 되어 "지금 어디로"가 죽는다.
     같은 칸을 다시 찍으면 내린다. 꽉 찼는데 새로 꽂으면 가장 오래된 것이 밀려난다. */
const MYS_FLAG_MAX = 10;
const MYS_NOTE_MAX = 24;   // 칸 툴팁 한 줄에 들어가는 길이. 넘기면 수첩이 아니라 일기가 된다
/* ★ 깃발은 { at, note } 다. 지도에서 물음표가 사라진 뒤로 깃발이 곧 플레이어의 수첩인데,
   위치만 찍히면 "여기 뭔가 있었다"까지밖에 못 적는다 — 정작 필요한 건 "여기 감식 6" 이다.
   ⚠ 옛 저장은 문자열 배열('10,11')이거나 단수 f.flag 다. 로드 때 여기서 끌어올린다.
     깨진 저장은 새 코드로도 안 낫는다(함정 #4) — 읽는 자리에서 고쳐야 한다. */
function mysFlags(){
  const f=mysField(); if(!f) return [];
  if(!Array.isArray(f.flags)) f.flags = f.flag ? [f.flag] : [];
  f.flags = f.flags.map(v=>(v && typeof v==='object')
      ? { at:String(v.at||''), note:String(v.note||'') }
      : { at:String(v||''), note:'' }).filter(v=>v.at);
  return f.flags;
}
function mysFlagAt(k){ return mysFlags().find(v=>v.at===k) || null; }
function mysSetFlag(x,y){
  const f=mysField(); if(!f) return;
  if(!mysCellSeen(x,y)) return;                 // 안 본 칸에는 못 꽂는다
  if(mysIsWall(x,y)) return;
  const k=mysKey(x,y), list=mysFlags();
  const i=list.findIndex(v=>v.at===k);
  if(i>=0){ list.splice(i,1); }                 // 내리는 건 조용히. 기록에 남길 사건이 아니다
  else {
    list.push({ at:k, note:'' });
    let msg='깃발 — '+mysZoneName(x,y)+' ('+k+')';
    if(list.length > MYS_FLAG_MAX){
      const old=list.shift();
      msg += ' · 가장 오래된 깃발('+old.at+')을 내렸다';
    }
    mysLog('sys', msg+' ['+list.length+'/'+MYS_FLAG_MAX+']');
  }
  f.flag = list.length ? list[list.length-1].at : null;   // 파티 훅 호환용(마지막 것)
  mysSave(); if(mysBody) mysBody._mysLastHtml=''; mysRenderField();
}
/* 메모 — Shift+우클릭. 깃발이 없는 칸이면 먼저 꽂고 연다.
   ★ prompt() 를 쓰지 않는다. Electron 에는 window.prompt 자체가 없어서 그 자리에서 죽는다.
     이미 있는 잠금 팝업과 같은 틀을 쓴다 — 입력 경로를 둘로 늘리지 않는다. */
function mysFlagNote(x,y){
  const f=mysField(); if(!f) return;
  if(!mysCellSeen(x,y) || mysIsWall(x,y)) return;
  const k=mysKey(x,y);
  if(!mysFlagAt(k)) mysSetFlag(x,y);
  const cur=mysFlagAt(k); if(!cur) return;
  mysModal={ type:'note', label:'깃발 메모 — '+mysZoneName(x,y), at:k, value:cur.note||'' };
  mysRenderField();
  setTimeout(()=>{ const i=el('mysModalInput'); if(i){ i.value=cur.note||''; i.focus(); } }, 0);
}
function mysSaveFlagNote(v){
  if(!mysModal || mysModal.type!=='note') return;
  const t=mysFlagAt(mysModal.at);
  if(t) t.note=String(v||'').trim().slice(0, MYS_NOTE_MAX);
  mysModal=null;
  mysSave(); if(mysBody) mysBody._mysLastHtml=''; mysRenderField();
}
function mysDropFlagNote(){
  if(!mysModal || mysModal.type!=='note') return;
  const p=mysXY(mysModal.at);
  mysModal=null;
  mysSetFlag(p.x, p.y);          // 이미 꽂혀 있으므로 토글 = 내리기
}
/* ═══════════════════════════ 파티 ═══════════════════════════════════
   ★ 게임은 RTDB 를 모른다. 훅 하나(`MYS_NET`)만 알고, 그것이 무엇으로 구현되는지는
     이 파일 밖의 일이다. firebase 를 여기서 직접 부르면 마이홈의 API 가 바뀌는 날
     게임이 같이 죽는다 — `window.MYHOME_DESKTOP` 하나만 본다는 규칙과 같은 이유다.
   어댑터가 채워야 하는 것은 셋뿐이다:
     join(room, me, onMsg)   방에 들어간다. 이후 남의 메시지를 onMsg(msg) 로 흘린다
     leave()                 방을 나간다
     send(msg)               방 전원에게 보낸다
   ⚠ send 한 것이 나에게 되돌아와도 된다 — from 이 나면 버린다(에코 안전).
   ⚠ 어댑터는 '전달'만 한다. 판정·상태 변경을 어댑터에 넣지 말 것. 전송 방식이 바뀌는 날
     게임 규칙이 같이 바뀐다.
   ★ 공유 규칙(개정) — 성공한 단서·딸린 아이템·아이템 잠금 해제도 전원 공유다.
     한 명이 성공하면 나머지는 굴리지 않고 그대로 받는다('clue'·'unlock').
     그 밖에 공유하는 것 — 위치·깃발 좌표·문 열림·단계·심문 장면·채팅.
   ⚠ 여전히 안 나가는 것 — 개인 실패, 오정보('!'+id), 굴림 대기, 남의 오염도 수치.
     실패와 오정보까지 나누면 "누구 말이 맞나"라는 장치가 죽는다. */
const MYS_POS_MS   = 800;     // 위치 전송 스로틀. 좀아칼과 같은 값 — 이보다 짧으면 비용이 튄다
const MYS_BEAT_MS  = 10000;   // 하트비트. 가만히 서 있어도 살아 있다고 알린다
const MYS_PEER_TTL = 35000;   // 이 시간 소식이 없으면 나간 것으로 본다(하트비트 3회 분)
/* 파티원 색. ★ 내 색은 여기 없다 — 나는 지도에서 ■ 다. 섞으면 '누가 나인가'가 흐려진다. */
const MYS_MATE_COL = ['#7fe0ee','#f0b46a','#8ce39a','#c9b3f0','#e08ea0','#eaa0d8'];

let mysNet   = null;    // 어댑터
let mysRoom  = null;    // 방 이름
let mysMe    = null;    // { id, name }
let mysPeers = {};      // id → { id, name, color, intr, pos, flags[], seen }
let mysPosAt = 0, mysBeatAt = 0, mysPosSig = '', mysPosTimer = 0;
/* ⚠ 남의 메시지를 적용하는 동안에는 아무것도 내보내지 않는다. 안 막으면
     A가 문을 열고 → B가 받아서 다시 쏘고 → A가 또 받는 메아리가 돈다. */
let mysNetQuiet = false;
/* 파티원이 올린 답안 제안. 파티장 화면에만 남는다 */
let mysAsk = null;      // { name, v }
/* ── 로비 파티 ──
   ★ 심문 레디(mysReady)와 **다른 물건이다.** 이름이 겹치면 반드시 한쪽이 다른 쪽을 지운다 —
     메시지 종류도 'ready'(심문)와 'lready'(로비)로 갈라 쓴다.
   ★ 정원은 나 포함 5명. 지도 마커가 칸당 3명까지 그리므로 그 이상은 어차피 안 보인다. */
const MYS_PARTY_MAX = 5;
let mysLobbyReady = {};   // id → true (내 id 포함)
let mysLocked = false;    // 파티 확정 여부
/* 남이 연 심문 레디 요청. 내 화면에 레디 버튼을 띄우기 위한 것 */
let mysGateAsk = null;  // { spotId, name, who }

function mysNetOn(){ return !!(mysNet && mysRoom && mysMe); }
/* ── 파티 코드 ──
   ★ 좀아칼과 같은 방식이다. 방 이름을 사람이 주고받는 짧은 문자열로 두고,
     같은 코드를 친 사람끼리 한 팀이 된다. 초대 링크도, 친구 목록도 필요 없다.
   ⚠ 헷갈리는 글자(0·O·1·I)를 뺀다. 코드는 입으로 불러주고 손으로 받아치는 물건이라
     한 글자만 흔들려도 다른 방에 들어가서 "아무도 없다"가 된다. */
const MYS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MYS_CODE_LEN   = 6;
function mysMakeCode(){
  let out='';
  for(let i=0;i<MYS_CODE_LEN;i++)
    out += MYS_CODE_CHARS.charAt(Math.floor(Math.random()*MYS_CODE_CHARS.length));
  return out;
}
/* 받아친 코드를 씻는다 — 소문자·공백·하이픈은 사람이 늘 섞어 친다 */
function mysCleanCode(v){
  return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, MYS_CODE_LEN);
}
/* 소식이 끊긴 파티원을 걷어낸다. ★ 읽는 자리에서 거른다 — 타이머로 지우면
   창이 닫혀 있는 동안 타이머가 안 돌아 유령이 그대로 남는다. */
function mysNetPeers(){
  const now=Date.now(), out=[];
  Object.keys(mysPeers).forEach(id=>{
    if(now - (mysPeers[id].seen||0) > MYS_PEER_TTL){ delete mysPeers[id]; return; }
    out.push(mysPeers[id]);
  });
  out.sort((a,b)=>a.id<b.id?-1:(a.id>b.id?1:0));
  return out;
}
function mysNetSend(msg){
  if(!mysNetOn() || mysNetQuiet) return;
  msg.from=mysMe.id;
  try{ mysNet.send(msg); }catch(e){ console.warn('[미스테리au] 전송 실패', e); }
}
/* ── 스탠딩 주고받기 ─────────────────────────────────────────────────
   ★ 파티원이 말할 때 그 사람의 스탠딩이 서야 한다. 이름과 대사만 흐르면
     현장에서 누가 말하는지가 글자로만 남는다.
   ⚠ 보낼 수 있는 것은 **서버 URL 뿐이다.** dataURL 은 전송 상한(4096자)을 한 장으로 넘겨
     메시지가 통째로 거부되고, 상한을 올려도 말할 때마다 수백 KB가 오간다.
     서버에 없는 그림은 조용히 빠진다 — 그 자리는 이름표가 받는다(mysImgSync 가 나중에 채운다).
   ⚠ 대사마다 URL 을 실어 보내지 않는다. 표는 합류할 때 한 번, 바뀔 때 한 번만 간다.
     대사에는 표정 이름 한 글자만 실린다. */
const MYS_FACE_MAXJ = 2600;   // 표 하나의 상한(문자). 남은 자리는 다른 메시지 몫이다
function mysStandShare(){
  const a=agent(); if(!a) return null;
  const out={};
  STAND_KEYS.forEach(k=>{
    const v=a.stand[k];
    if(typeof v==='string' && /^https?:/.test(v)) out[k]=v;
  });
  /* ★ 증명사진도 같이 보낸다. 스탠딩을 한 장도 안 그린 파티원이 이름만 흐르는 것보다,
     얼굴 한 장이 서는 편이 낫다 — 내 쪽 폴백(standPick)과 같은 규칙이다. */
  if(typeof a.photo==='string' && /^https?:/.test(a.photo)) out.photo=a.photo;
  if(!Object.keys(out).length) return null;
  let j=''; try{ j=JSON.stringify(out); }catch(_){ return null; }
  /* 표정을 다 등록한 사람은 표가 길어진다. 넘치면 평상 한 장(없으면 증명사진)만 보낸다 —
     한 장이라도 서는 편이 통째로 거부되어 아무것도 안 서는 것보다 낫다. */
  if(j.length > MYS_FACE_MAXJ){
    if(out.normal) return { normal:out.normal };
    return out.photo ? { photo:out.photo } : null;
  }
  return out;
}
function mysNetSendFace(){
  if(!mysNetOn()) return;
  const u=mysStandShare();
  mysNetSend({ t:'face', u:u||{} });
}
/* 파티원의 스탠딩 한 장. 그 표정 → 평상 → 증명사진 순으로 떨어진다 —
   내 쪽 규칙(standPick)과 **같은 순서여야 한다.** 한쪽만 고치면 같은 파티원이
   내 화면과 남의 화면에서 다르게 선다. */
function mysMateStandPick(p, expr){
  const u=(p && p.stand) || null; if(!u) return null;
  const s = u[expr] || u.normal;
  if(s) return { url:s, photo:false };
  return u.photo ? { url:u.photo, photo:true } : null;
}
function mysMateStandUrl(p, expr){ const s=mysMateStandPick(p, expr); return s ? s.url : null; }
function mysPeerOf(id, name){
  let p=mysPeers[id];
  if(!p){
    const used=Object.keys(mysPeers).length;
    p=mysPeers[id]={ id:id, name:name||id, color:MYS_MATE_COL[used % MYS_MATE_COL.length],
                     intr:0, pos:'', flags:[], seen:0, stand:null };
    mysLog('sys', (p.name)+'이(가) 현장에 합류했다.');
  }
  if(name) p.name=name;
  p.seen=Date.now();
  return p;
}
/* ── 파티장 ──
   ★ 선거를 하지 않는다. 살아 있는 id 중 사전순으로 가장 앞선 사람이 파티장이다 —
     모든 클라이언트가 같은 목록에서 같은 답을 내므로 합의 절차가 아예 필요 없다.
     파티장이 나가면 다음 사람이 저절로 이어받는다(권한 승계). */
function mysLeader(){
  if(!mysNetOn()) return null;
  const ids=[mysMe.id].concat(mysNetPeers().map(p=>p.id));
  ids.sort();
  return ids[0];
}
function mysIsLeader(){ return !mysNetOn() || mysLeader()===mysMe.id; }
function mysPeerName(id){ const p=mysPeers[id]; return p?p.name:id; }

/* 위치·깃발 알림. ★ 좌표만 흘린다 — 깃발 메모까지 공유하면 수첩이 게시판이 된다.
   ⚠ 렌더에 얹어 돌린다. 타이머로 돌리면 창을 닫아둔 동안에도 계속 쏘게 된다. */
function mysNetBeat(force){
  if(!mysNetOn()) return;
  const f=mysField();
  /* ★ 로비에도 하트비트가 나가야 한다. 현장이 없다고 입을 닫으면 파티 화면에서
     "들어왔는데 아무도 안 보인다"가 된다 — 파티는 로비에서 짜는 물건이다. */
  if(!f){
    const now0=Date.now();
    if(!force && now0-mysBeatAt < MYS_BEAT_MS) return;
    mysBeatAt=now0; mysPosSig='';
    const a0=agent();
    mysNetSend({ t:'pos', name:(a0&&a0.name)||'요원', intr:mysStat('intr'),
                 pos:'', flags:[], stage:0,
                 cleared:(MYS.cleared||[]).slice(), busy:false });
    return;
  }
  const flags=mysFlags().map(v=>v.at);
  const sig=f.pos+'|'+flags.join(' ')+'|'+f.stage;
  const now=Date.now();
  if(!force){
    if(sig===mysPosSig){ if(now-mysBeatAt < MYS_BEAT_MS) return; }
    else if(now-mysPosAt < MYS_POS_MS){
      /* ⚠ 스로틀에 걸린 갱신을 그냥 버리지 말 것. 버리면 걸음을 멈추는 순간의
         마지막 한 칸이 영영 안 나가고, 파티원 화면에서 나는 한 칸 뒤에 서 있게 된다.
         버리는 게 아니라 뒤로 미룬다. */
      if(!mysPosTimer && typeof setTimeout==='function')
        mysPosTimer=setTimeout(()=>{ mysPosTimer=0; mysNetBeat(true); }, MYS_POS_MS);
      return;
    }
  }
  if(mysPosTimer){ try{ clearTimeout(mysPosTimer); }catch(_){} mysPosTimer=0; }
  mysPosSig=sig; mysPosAt=now; mysBeatAt=now;
  const a=agent();
  mysNetSend({ t:'pos', name:(a&&a.name)||'요원', intr:mysStat('intr'),
               pos:f.pos, flags:flags, stage:f.stage,
               cleared:(MYS.cleared||[]).slice(), busy:true });
}
function mysNetJoin(room, adapter){
  room=mysCleanCode(room)||mysMakeCode();
  const a=agent();
  const id=(typeof getMyUserId==='function' && getMyUserId()) || ('me'+Date.now());
  mysNetLeave();
  mysNet = adapter || (typeof window!=='undefined' && window.MYS_NET) || null;
  if(!mysNet) return null;
  mysRoom = room; mysMe = { id:String(id), name:(a&&a.name)||'요원' };
  mysPeers={}; mysPosSig=''; mysAsk=null; mysGateAsk=null;
  try{ mysNet.join(room, mysMe, mysNetRecv); }
  catch(e){ console.warn('[미스테리au] 합류 실패', e); mysNet=null; mysRoom=null; mysMe=null; return null; }
  mysLog('sys', '파티에 합류했다 — 방 '+room);
  /* 인사. 받은 쪽은 한 번만 되인사한다(re) — 안 그러면 인사가 무한히 오간다. */
  mysNetSend({ t:'hi' });
  mysNetBeat(true);
  mysRenderField();
  return mysMe.id;
}
/* 코드로 합류한다. ★ 진입 경로는 여기 하나다 — 팝업 버튼도, Enter 도, API 도 여기로 온다.
   ⚠ 어댑터가 없으면 루프백으로 떨어진다. 그건 **같은 창 안에서만 도는 가짜 파티**다.
     실기기 파티는 MYS_NET 에 RTDB 어댑터가 꽂혀야 시작된다. */
/* ★ 파티 팝업은 로비(게시판)에서도 떠야 한다. 그래서 mysRenderField 가 아니라
   mysRender 를 부른다 — 현장이면 현장이, 아니면 게시판이 알아서 그린다.
   ⚠ 입구는 여기 하나다. 화면마다 팝업을 따로 띄우면 반드시 한쪽만 고쳐진다. */
/* 하단 바(가장 아랫줄)에 붙는 파티 조각. ★ 로비와 현장이 같은 것을 보여야 한다 —
   화면마다 다르게 그리면 "어디서는 보이고 어디서는 안 보인다"가 된다.
   ⚠ 버튼은 로비에만 붙는다. 파티를 만들고 나가는 것은 로비에서만 하기 때문이다. */
function mysPartyBarHtml(withBtn){
  let out='';
  if(mysNetOn()){
    const ps=mysNetPeers(), lead=mysLeader();
    out+='<span class="pmate code">'+mysEsc(mysRoom)+(mysLocked?' 결성':'')+'</span>'
        +'<span class="pmate me">'+(lead===mysMe.id?'★':'')+mysEsc(mysMe.name)
        +(!mysLocked && mysLobbyReady[mysMe.id] ? ' ✔':'')+'</span>';
    ps.forEach(pp=>{ out+='<span class="pmate" style="color:'+pp.color+'">'
      +(lead===pp.id?'★':'')+mysEsc(pp.name)
      +(!mysLocked && mysLobbyReady[pp.id] ? ' ✔':'')+'</span>'; });
    out+='<span class="pmate dim">'+(ps.length+1)+'/'+MYS_PARTY_MAX+'</span>';
  }
  if(withBtn){
    const label = !mysNetOn() ? '＋ 파티 추가/입장'
                : (mysLocked ? '⚙ 파티 수정' : '👥 파티');
    out+='<button type="button" class="pbtn" data-party="1">'+label+'</button>';
  }
  return out;
}
function mysOpenParty(){
  mysModal={ type:'party' };
  mysRender();
  setTimeout(()=>{ const i=el('mysModalInput'); if(i) i.focus(); }, 0);
}
function mysJoinCode(v, quiet){
  const code=mysCleanCode(v);
  if(code.length !== MYS_CODE_LEN)
    return mysFieldMsg('코드는 '+MYS_CODE_LEN+'자다.', true);
  /* ★ 사건을 진행 중인 사람은 파티에 못 들어간다. 들어와도 파티장의 착수를 못 따라가고,
     따라가면 그 사람의 진행이 통째로 날아간다. 애초에 막는 쪽이 맞다. */
  if(mysField()) return mysFieldMsg('사건을 진행 중에는 파티에 들어갈 수 없다.', true);
  const adapter=(typeof window!=='undefined' && window.MYS_NET) || mysNetLocal();
  mysLobbyReady={}; mysLocked=false;
  const id=mysNetJoin(code, adapter);
  if(!id) return mysFieldMsg('파티에 들어가지 못했다.', true);
  mysSaveParty();
  if(!quiet) mysFieldMsg('파티 코드 '+code+' — 합류했다.');
  mysRender();
  return id;
}
/* 확정된 파티는 창을 닫아도 유지된다 — 코드를 저장에 남기고 부팅 때 스스로 다시 들어간다. */
function mysSaveParty(){
  if(!MYS) return;
  MYS.party = mysNetOn() ? { code:mysRoom, locked:!!mysLocked } : null;
  mysSave();
}
function mysRejoinParty(){
  const pt=MYS && MYS.party;
  if(!pt || !pt.code || mysNetOn()) return;
  const adapter=(typeof window!=='undefined' && window.MYS_NET) || mysNetLocal();
  mysLocked=!!pt.locked; mysLobbyReady={};
  if(mysNetJoin(pt.code, adapter)) mysLog('sys', '파티 '+pt.code+' 에 다시 들어갔다.');
}
/* ── 레디 · 확정 · 수정 ──
   ★ 레디는 전원, 확정은 파티장. 확정 버튼은 전원이 레디하기 전에는 파티장 화면에도 안 뜬다.
   ⚠ 심문 레디(mysReadyGate)와 완전히 다른 물건이다. 메시지도 'lready' 로 갈라 쓴다. */
function mysLobbyAllReady(){
  if(!mysNetOn()) return false;
  const ids=[mysMe.id].concat(mysNetPeers().map(p=>p.id));
  return ids.length>1 && ids.every(id=>mysLobbyReady[id]);
}
function mysToggleReady(){
  if(!mysNetOn() || mysLocked) return;
  const on=!mysLobbyReady[mysMe.id];
  mysLobbyReady[mysMe.id]=on;
  mysNetSend({ t:'lready', on:on });
  mysRender();
}
function mysLockParty(){
  if(!mysNetOn() || !mysIsLeader() || mysLocked || !mysLobbyAllReady()) return;
  mysLocked=true; mysNetSend({ t:'plock', on:true });
  mysSaveParty();
  mysLog('sys','■ 파티가 결성됐다. 이제 새로 들어올 수 없다.');
  /* ★ 확정은 파티 화면에서 할 일이 끝났다는 뜻이다. 팝업을 닫고 로비(의뢰 게시판)를 보여준다 —
     여기서 팝업이 그대로 남아 있으면 "확정했는데 뭐가 달라졌는지 모르겠다"가 되고,
     정작 다음에 눌러야 할 [착수]가 팝업 뒤에 가려진다.
   ⚠ 파티원 화면은 'plock' 을 받는 쪽에서 따로 닫는다 — 여기서 닫히는 건 파티장 화면뿐이다. */
  if(mysModal && mysModal.type==='party') mysModal=null;
  mysRender();
}
function mysUnlockParty(){
  if(!mysNetOn() || !mysIsLeader() || !mysLocked) return;
  mysLocked=false; mysLobbyReady={};
  mysNetSend({ t:'plock', on:false });
  mysSaveParty();
  mysLog('sys','파티 구성을 다시 짠다 — 레디가 풀렸다.');
  mysRender();
}
/* 이탈. ★ 사건 중에는 못 나간다(설계: 사건 포기 없음). 나가면 진행이 초기화된다. */
function mysPartyLeave(force){
  const a=agent();
  if(!force && mysField() && !(a && a.lost))
    return mysFieldMsg('사건 중에는 파티에서 나갈 수 없다.', true);
  if(mysField()) mysAbandonCase();      // 착수 중이었다면 착수 안 한 상태로 되돌린다
  mysNetLeave(); mysLocked=false; mysLobbyReady={};
  mysModal=null; MYS.party=null; mysSave();
  mysToast('파티에서 나왔다.');
  mysRender();
}
function mysNetLeave(){
  if(mysNetOn()){ mysNetSend({ t:'bye' }); try{ mysNet.leave(); }catch(_){} }
  mysNet=null; mysRoom=null; mysMe=null; mysPeers={}; mysAsk=null; mysGateAsk=null;
  mysTyping={}; mysTypAt=0;
}
/* 남의 메시지를 상태에 얹는다.
   ⚠ 여기서 부르는 것들이 다시 전송하지 않도록 mysNetQuiet 로 감싼다. */
function mysNetRecv(m){
  if(!m || !mysMe || !m.from || m.from===mysMe.id) return;
  const f=mysField();
  let quick=false;              // 화면을 통째로 다시 그릴 필요가 없는 메시지인가
  mysNetQuiet=true;
  try{
    if(m.t==='bye'){
      delete mysTyping[m.from];        // 나간 사람의 '타이핑 중' 을 남겨두지 않는다
      if(mysPeers[m.from]){ mysLog('sys', mysPeers[m.from].name+'이(가) 현장을 떠났다.'); }
      delete mysPeers[m.from];
    }
    else if(m.t==='hi'){
      /* ★ 문지기는 파티장이다. 각자 알아서 판단하면 사람마다 정원이 다르게 세어진다. */
      if(mysIsLeader() && !mysPeers[m.from]){
        const why = mysLocked ? '이미 결성된 파티다'
                  : (mysNetPeers().length + 2 > MYS_PARTY_MAX ? '정원이 찼다' : '');
        if(why){
          mysNetQuiet=false; mysNetSend({ t:'deny', to:m.from, why:why }); mysNetQuiet=true;
          return;
        }
      }
      mysPeerOf(m.from, m.name);
      /* ⚠ 되인사와 내 위치는 quiet 를 되돌리기 '전에' 보낸다. 순서를 바꾸면
         quiet 에 막혀 늦게 들어온 사람 화면에 내가 영영 안 보인다. */
      /* ★ 스탠딩 표도 이때 보낸다. 늦게 들어온 사람에게도, 먼저 있던 사람에게도
         한 번씩은 가야 한다 — 한쪽만 보내면 그 사람 화면에서만 상대가 이름표로 남는다. */
      if(!m.re){ mysNetQuiet=false; mysNetSend({ t:'hi', re:true }); mysNetBeat(true);
                 mysNetSendFace(); mysNetQuiet=true; }
      else { mysNetQuiet=false; mysNetSendFace(); mysNetQuiet=true; }
    }
    /* ★ 타이핑 알림만은 전체 렌더를 타지 않는다(quick). 남이 한 줄 치는 동안 두세 번 오는데,
       그때마다 화면을 갈아엎으면 내가 치던 글자와 커서가 매번 튄다. */
    else if(m.t==='typ'){
      quick=true;
      if(m.on) mysTyping[m.from]={ name:m.w||mysPeerName(m.from), at:Date.now() };
      else delete mysTyping[m.from];
    }
    /* 스탠딩 표. ⚠ 대사마다 오는 물건이 아니다 — 받아서 그 사람 자리에 얹어두고 계속 쓴다. */
    else if(m.t==='face'){
      const p=mysPeerOf(m.from, m.name);
      p.stand = (m.u && Object.keys(m.u).length) ? m.u : null;
    }
    else if(m.t==='pos'){
      const p=mysPeerOf(m.from, m.name);
      p.pos=m.pos||''; p.flags=m.flags||[]; p.intr=m.intr|0;
      /* 착수 자격은 파티장이 검사한다 — 그러려면 남이 무엇을 깼는지 알아야 한다.
         ⚠ 단서(got)와 다르다. 클리어 목록은 게시판에 이미 공개된 정보다. */
      if(m.cleared) p.cleared=m.cleared;
      p.busy=!!m.busy;
    }
    /* ── 로비 파티 ── */
    else if(m.t==='lready'){ mysLobbyReady[m.from]=!!m.on; }
    else if(m.t==='plock'){
      mysLocked=!!m.on;
      if(!mysLocked) mysLobbyReady={};
      mysSaveParty();
      /* 파티장이 확정했으면 파티원 화면의 팝업도 닫는다 — 파티장만 로비로 나오고
         나머지는 팝업을 붙들고 있으면 "다들 뭘 보고 있는 거냐"가 된다.
         ⚠ 수정(on:false)일 때는 닫지 않는다. 그건 다시 짜자는 뜻이라 명단 앞에 있어야 한다. */
      if(mysLocked && mysModal && mysModal.type==='party') mysModal=null;
      mysLog('sys', mysLocked ? '■ 파티가 결성됐다.' : '파티 구성을 다시 짠다 — 레디가 풀렸다.');
    }
    /* 문지기가 나를 돌려보냈다. ⚠ 여기서 조용히 나가면 "들어갔는데 아무도 없다"가 된다 */
    else if(m.t==='deny' && m.to===mysMe.id){
      const why=m.why||'들어갈 수 없다';
      mysNetQuiet=false; mysNetLeave(); mysNetQuiet=true;
      mysToast('파티에 들어가지 못했다 — '+why);
      mysLog('sys', '파티에 들어가지 못했다 — '+why);
    }
    /* 파티원 하나가 오류 탈출(전체 초기화)을 눌렀다. 나도 같이 지운다 —
       한 사람만 로비로 나오면 나머지는 없는 사람이 서 있는 지도를 계속 본다.
       ⚠ 파티는 그대로 둔다. 다시 짜지 않아도 곧장 같이 착수할 수 있어야 한다. */
    else if(m.t==='reset'){
      mysWipeSave();
      mysLog('sys', (m.w||mysPeerName(m.from))+'이(가) 전부 초기화했다 — 나도 로비로 돌아왔다.');
      mysToast('파티원이 초기화했다 — 사건·기록·단서가 지워졌다(요원 등록은 그대로).');
    }
    /* 파티장이 착수했다. ★ 나는 로비에 있어야만 따라간다 —
       진행 중인 사건을 말없이 덮으면 그 사람이 여기까지 온 것이 통째로 날아간다. */
    else if(m.t==='start'){
      if(mysField()) mysLog('sys', '파티장이 사건에 착수했지만, 나는 다른 사건을 진행 중이다.');
      else { mysNetQuiet=false; mysStartCase(m.caseId); mysNetQuiet=true; }
    }
    /* 문 열림은 공유한다 — 파티장이 딴 방에 있어도 문 앞에 선 사람이 열 수 있어야 하고,
       열린 문이 사람마다 다르면 지도가 사람마다 다른 게임이 된다. */
    else if(m.t==='door' && f){
      if((f.opened||[]).indexOf(m.at)<0){
        f.opened=(f.opened||[]).concat([m.at]);
        mysLog('sys', (m.name||'문')+'이 열렸다. ('+mysPeerName(m.from)+')');
        mysSave();
      }
    }
    /* 단계는 전원이 같이 넘어간다. 사람마다 다른 단계에 서 있으면 같은 칸이
       누구에게는 조사 지점이고 누구에게는 빈 복도가 된다. */
    else if(m.t==='stage' && f) mysApplyStage(m.n, m.v, mysPeerName(m.from));
    /* 성공 공유 — 조사·심문·문 보상의 단서와 딸린 아이템. 한 명이 성공하면 전원이
       굴리지 않고 그대로 받는다. 심문 대사는 아래 'scene' 이 따로 나른다. */
    else if(m.t==='clue' && f) mysGainShared(m.id, mysPeerName(m.from), m.grade||'');
    /* 아이템 잠금 해제 공유 — needOpen 문이 사람마다 다르게 잠기지 않게 */
    else if(m.t==='unlock' && f) mysApplyUnlock(m.id, mysPeerName(m.from));
    /* 심문 장면은 전원이 본다 — 같은 자리에서 같이 들은 말이다 */
    else if(m.t==='scene') mysScene(m.who, m.lines, m.kind, true);
    else if(m.t==='log'){
      mysLog(m.k, m.x, m.w||mysPeerName(m.from), true, m.s);
      /* ★ 파티원의 대사는 말풍선으로도 뜬다 — 오른쪽 구석 기록 창에서만 흐르면
         현장을 보고 있는 동안 "다들 모여봐"를 놓친다.
         ⚠ 조사 중이면 뜨지 않는다(mysChatScene 이 판단한다). 기록에는 이미 남았다. */
      if(m.k==='mate') mysChatScene(m.w||mysPeerName(m.from),
        { t:m.x, seg:(m.s && m.s.length ? m.s : null), e:m.e||'' }, false, m.from);
      /* 말이 도착했으면 그 사람은 다 친 것이다 — 타이핑 알림을 그 자리에서 내린다 */
      mysTypingClear(m.from);
    }
    else if(m.t==='taint'){
      if(m.to===mysMe.id) mysAddTaint(m.n|0, m.why||'심문 관전');
    }
    /* 심문 절차 — 남이 게이트를 열면 내 화면에 레디 버튼이 뜬다 */
    else if(m.t==='gate'){
      mysGateAsk={ spotId:m.spot, name:m.name||'심문', who:mysPeerName(m.from) };
      mysLog('sys', mysGateAsk.who+'이(가) '+mysGateAsk.name+' 심문을 준비한다 — 레디를 누를 것.');
    }
    else if(m.t==='ready') mysInterroReady(m.from);
    /* 원격 제출 — 파티원은 '제안'까지다. 실제 제출은 파티장이 누른다.
       ⚠ 받은 값을 그대로 제출하면 파티원 아무나 답을 무한히 찔러볼 수 있게 되고,
         오답 오염도는 파티장이 뒤집어쓴다. */
    else if(m.t==='ask'){
      if(mysIsLeader()){
        mysAsk={ name:mysPeerName(m.from), v:String(m.v||'') };
        mysLog('sys', mysAsk.name+'이(가) 답안을 넘겼다 — "'+mysAsk.v+'"');
      }
    }
  } finally { mysNetQuiet=false; }
  if(quick) return mysRenderTyping();
  mysRenderField();
}

/* ── 루프백 어댑터 ───────────────────────────────────────────────────
   같은 프로세스 안에서만 도는 가짜 전송이다. RTDB 어댑터가 붙기 전까지
   **절차·마커·레디·권한 승계를 실기기 없이 굴려보기 위한 것**이고,
   검증기가 가짜 파티원을 하나 앉히는 자리이기도 하다.
   ⚠ 실기기 파티가 이걸로 되지는 않는다. 창이 다르면 방도 다르다. */
const MYS_BUS = {};
function mysNetLocal(){
  let room=null, me=null, cb=null;
  return {
    join(r, m, on){ room=r; me=m; cb=on;
      (MYS_BUS[r]=MYS_BUS[r]||[]).push({ id:m.id, on:on }); },
    leave(){ if(room && MYS_BUS[room]) MYS_BUS[room]=MYS_BUS[room].filter(x=>x.id!==me.id);
             room=null; me=null; cb=null; },
    send(msg){ if(!room) return;
      (MYS_BUS[room]||[]).forEach(x=>{ if(x.id!==msg.from){ try{ x.on(msg); }catch(_){} } }); }
  };
}
/* 검증기·2인 테스트용 가짜 파티원. 방에 앉아 메시지를 주고받는다. */
function mysNetPuppet(room, id, name){
  const inbox=[];
  const seat={ id:id, on:m=>inbox.push(m) };
  (MYS_BUS[room]=MYS_BUS[room]||[]).push(seat);
  return {
    id:id,
    send(msg){ msg.from=id; if(msg.name==null && msg.t==='pos') msg.name=name;
      (MYS_BUS[room]||[]).forEach(x=>{ if(x.id!==id){ try{ x.on(msg); }catch(_){} } }); },
    inbox(){ return inbox.slice(); },
    drop(){ MYS_BUS[room]=(MYS_BUS[room]||[]).filter(x=>x!==seat); }
  };
}

/* ── 렌더가 읽는 훅 ──
   ★ 여기만 채우면 지도 마커는 예전 코드 그대로 뜬다. 렌더는 손대지 않는다. */
function mysMateFlags(){
  const out={};
  mysNetPeers().forEach(p=>(p.flags||[]).forEach(k=>{
    (out[k]=out[k]||[]).push({ color:p.color, name:p.name }); }));
  return out;
}
function mysMateAt(){
  const out={};
  mysNetPeers().forEach(p=>{ if(!p.pos) return;
    (out[p.pos]=out[p.pos]||[]).push({ color:p.color, name:p.name }); });
  return out;
}

/* ── 렌더 ────────────────────────────────────────────────────────────
   ⚠ diff-guard + 안정 부모 위임. 좀아칼에서 파티 콜백이 매 좌표 갱신마다 패널을
     innerHTML 로 통째 교체해서 클릭한 노드가 사라지고 클릭이 유실됐다(교훈 3).
     지금은 솔로라 재렌더가 드물지만, 파티를 얹는 순간 같은 일이 벌어진다. */
/* ── 기록 창 ─────────────────────────────────────────────────────────
   ★ 가시성 규칙(개정) — 성공은 전원의 것이다.
     · 조사 '성공' 결과 → 전원(mysGainShared 가 옮겨 적는다)   · 개인 실패·오정보 → 본인만
     · 심문 스크립트 → 전원(같이 봤으므로)   · 정리(recap) → 전원(단서가 같으니 각자 뜬다)
     · 채팅 → 전원
     · 주사위 일반 → 본인만          · 대성공·대실패 → 전원(내용은 안 밝힘)
   지금은 솔로라 전부 내 것이지만, 파티를 얹을 때 kind 별로 전송 여부를 가른다.
   ⚠ 로그는 저장하지 않는다(모듈 변수). 창을 닫으면 사라지고 단서 목록만 남는다.
     대화 기록까지 localStorage 에 쌓으면 저장이 금방 커진다. */
const MYS_LOG_MAX = 60;
/* ── 대화 기록 보관 ─────────────────────────────────────────────────
   ★ 화면에 그리는 것은 마지막 MYS_LOG_MAX 줄뿐이지만, 들고 있는 것은 사건 전문이다.
     내보내기가 '방금 60줄'이면 아무도 안 쓴다 — 착수부터 종결까지가 한 편이어야 한다.
   ★ 본 저장(tw.mys.v1)이 아니라 제 칸에 따로 담는다. 기록은 계속 자라는 것이라
     본 저장에 섞으면 언젠가 한도를 넘기고, 그때 거절되는 것은 항목 하나가 아니라
     setItem 전체다 — 요원도 단서도 진행도 같이 날아간다(교훈 53의 형제).
   ⚠ 지우는 때는 딱 셋이다 — 새 사건 착수 · 현장에서 로비로 나갈 때 · 전체 초기화.
     그 밖에는 창을 닫아도 껐다 켜도 남는다. */
const MYS_LOGKEY = 'tw.mys.log';
const MYS_TX_MAX = 1500;          // 보관 줄 수. 한 사건 완주가 400줄 안팎이다
let mysLogs = [];
let mysLogWarned = false;
function mysLogsSave(){
  try{ localStorage.setItem(MYS_LOGKEY, JSON.stringify(mysLogs)); mysLogWarned=false; return; }
  catch(e){
    /* 자리가 없으면 앞쪽을 버리고 한 번만 더 해본다. 그래도 안 되면 이번 판 메모리에만 둔다 —
       ⚠ 여기서 실패해도 본 저장은 멀쩡하다(키가 다르다). 그게 따로 담은 이유다. */
    mysLogs = mysLogs.slice(-Math.floor(MYS_TX_MAX/4));
    try{ localStorage.setItem(MYS_LOGKEY, JSON.stringify(mysLogs)); }
    catch(_){
      if(!mysLogWarned){
        mysLogWarned=true; console.warn('[미스테리au] 대화 기록 저장 실패', e);
        mysToast('저장 공간이 부족해요 — 대화 기록이 이번 판에만 남습니다');
      }
    }
  }
}
function mysLogsLoad(){
  let raw=null; try{ raw=localStorage.getItem(MYS_LOGKEY); }catch(_){}
  let v=null; try{ v=JSON.parse(raw||'[]'); }catch(_){ v=null; }
  mysLogs = Array.isArray(v) ? v.slice(-MYS_TX_MAX) : [];
}
function mysLogsClear(){
  mysLogs=[]; mysLogWarned=false;
  try{ localStorage.removeItem(MYS_LOGKEY); }catch(_){}
}
/* seg — 대사 줄의 조각(대사/지문). 있으면 지문이 회색 기울임으로 그려진다.
   ⚠ 없으면 예전 그대로 통짜 문자열이다. 조각을 필수로 만들면 부르는 자리 수십 곳을 다 고쳐야 한다. */
function mysLog(kind, text, who, solo, seg){
  mysLogs.push({ k:kind, t:text, w:who||'', s:!!solo, g:(seg && seg.length ? seg : null) });
  if(mysLogs.length > MYS_TX_MAX) mysLogs = mysLogs.slice(-MYS_TX_MAX);
  mysLogsSave();
}
/* 뒤에서 n번째 앞에 끼워 넣는다 — 표정은 대사보다 먼저 일어난 일이라 순서를 지켜야 한다. */
function mysLogBefore(n, kind, text, who, solo){
  const at=Math.max(0, mysLogs.length - n);
  mysLogs.splice(at, 0, { k:kind, t:text, w:who||'', s:!!solo });
  if(mysLogs.length > MYS_TX_MAX) mysLogs = mysLogs.slice(-MYS_TX_MAX);
  mysLogsSave();
}
/* ── 텍스트로 내보내기 ───────────────────────────────────────────────
   ★ 화면 모양이 아니라 '읽히는 모양'으로 적는다. 색과 기울임은 파일에 담기지 않으므로,
     화면에서 색이 하던 일(누가 한 말인가)을 여기서는 이름표와 괄호가 해야 한다.
   ⚠ 문구를 고치면 검증기의 표식도 같이 고칠 것. */
function mysStamp(human){
  const d=new Date(), p=n=>String(n).length<2?'0'+n:String(n);
  const ymd=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  return human ? ymd+' '+p(d.getHours())+':'+p(d.getMinutes())
               : ymd+'_'+p(d.getHours())+p(d.getMinutes());
}
function mysLogLineText(l){
  const nm=l.w||'나';
  if(l.k==='me' || l.k==='mate') return '['+nm+'] '+l.t;
  if(l.k==='nick')     return l.t+' : '+nm;
  /* 지문 — 괄호가 '이건 대사가 아니다'를 대신한다(화면에서는 기울임이 하던 일이다) */
  if(l.k==='act')      return (l.s ? '['+nm+'] ' : '        ')+'('+l.t+')';
  if(l.k==='actnick')  return '        ('+l.t+') : '+nm;
  if(l.k==='npc')      return (l.w||'NPC')+' : '+l.t;
  if(l.k==='recap')    return '['+(l.w||'정리')+'] '+l.t;
  if(l.k==='clue')     return '[조사] '+l.t;
  if(l.k==='dice')     return '        '+l.t;
  return '■ '+l.t;
}
function mysLogText(){
  const c=mysCase(), a=agent();
  const head=['미스테리au — 대화 기록'];
  if(c) head.push(c.id+' · '+c.title);
  head.push('요원 : '+((a && a.name) || '미등록'));
  head.push('내보낸 때 : '+mysStamp(true));
  head.push('줄 수 : '+mysLogs.length);
  head.push('────────────────────────────────────────');
  return head.join('\n')+'\n'+mysLogs.map(mysLogLineText).join('\n')+'\n';
}
/* 파일로 떨군다. 돌려주는 값 — 떨궜으면 true.
   ⚠ 앞에 BOM(\ufeff)을 붙인다. 안 붙이면 윈도 메모장이 한글을 깨서 연다 —
     '저장은 됐는데 열어보니 글자가 깨졌다'가 되고, 그건 저장이 안 된 것과 같다. */
function mysExportLog(){
  if(!mysLogs.length) return false;
  const c=mysCase();
  const name='미스테리au_'+((c&&c.id)||'기록')+'_'+mysStamp(false)+'.txt';
  try{
    const blob=new Blob(['\ufeff'+mysLogText()], { type:'text/plain;charset=utf-8' });
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    /* 곧바로 놓아주면 브라우저가 아직 안 읽었을 수 있다. 한 박자 뒤에 놓는다. */
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(_){} }, 4000);
    mysToast('대화 기록을 내보냈어요 — '+name);
    return true;
  }catch(e){
    console.warn('[미스테리au] 기록 내보내기 실패', e);
    mysToast('기록을 파일로 내보내지 못했어요');
    return false;
  }
}
function mysLogHtml(){
  /* ★ 그리는 것은 꼬리 MYS_LOG_MAX 줄뿐이다. 전문을 다 그리면 재렌더마다 수백 줄을
     새로 만들게 되고(이동·조사마다 일어난다), 스크롤도 늘 맨 위에서 시작한다. */
  return mysLogs.slice(-MYS_LOG_MAX).map(l=>{
    /* 대사 줄은 지문 조각(l.g)이 있으면 그대로 그린다 — 없으면 예전처럼 통짜 문자열이다 */
    const say = l.g ? mysLineHtml({ t:l.t, seg:l.g }) : mysEsc(l.t);
    if(l.k==='me')   return '<p class="lg-me">['+mysEsc(l.w||'나')+'] : '+say+'</p>';
    /* 닉네임 발화 — 캐릭터 대사와 같은 줄에 섞이면 이입이 끊긴다.
       반대쪽 끝으로 밀고 이름을 뒤에 붙여, 읽는 순서 자체를 다르게 만든다. */
    if(l.k==='nick') return '<p class="lg-nick">'+say+' : '+mysEsc(l.w||'나')+'</p>';
    /* ★ 이름표는 대사 줄과 같은 모양이다. 기울임과 회색은 지문 내용에만 건다. */
    if(l.k==='act')  return '<p class="lg-act">'
      + (l.s ? '<span class="nm">['+mysEsc(l.w||'나')+'] : </span>' : '') + say +'</p>';
    if(l.k==='actnick') return '<p class="lg-act nick">'
      + say + (l.s ? '<span class="nm"> : '+mysEsc(l.w||'나')+'</span>' : '') +'</p>';
    if(l.k==='mate') return '<p class="lg-mate">['+mysEsc(l.w)+'] : '+say+'</p>';
    if(l.k==='npc')  return '<p class="lg-npc">|'+mysEsc(l.w||'NPC')+' : '+mysEsc(l.t)+'</p>';
    /* 정리 스크립트 — 스크립트 박스에서 초록이었으니 기록 창에서도 초록이어야 한다.
       색이 곧 출처인데 창을 옮겼다고 색이 바뀌면 그 규칙이 무너진다. */
    if(l.k==='recap') return '<p class="lg-recap">|'+mysEsc(l.w||'정리')+' : '+mysEsc(l.t)+'</p>';
    if(l.k==='clue') return '<p class="lg-clue">|[조사] '+mysEsc(l.t)+'</p>';
    if(l.k==='dice') return '<p class="lg-dice">'+mysEsc(l.t)+'</p>';
    return '<p class="lg-sys">■ '+mysEsc(l.t)+'</p>';
  }).join('');
}
/* ── 타이핑 알림 ─────────────────────────────────────────────────────
   ★ 파티원이 채팅을 치는 동안 기록 창 맨 아래에 "'벼리'가 타이핑 중…" 이 뜬다.
     셋이 동시에 치면 세 줄이 뜬다 — 서로 대사가 겹쳐 나가는 것을 미리 알아채라는 물건이다.
   ★ 안 치면 저절로 사라진다. 그래서 '그만 쳤다'는 신호를 따로 기다리지 않고 **만료로 지운다** —
     상대가 창을 닫거나 인터넷이 끊겨도 알림이 영영 남지 않는다.
   ⚠ 이 알림 때문에 화면 전체를 다시 그리지 말 것. 남이 칠 때마다 innerHTML 이 갈리면
     내가 치던 입력칸이 새로 서고 커서가 끝으로 튄다. 전용 노드 하나만 갈아끼운다.
   ⚠ 기록(mysLogs)에는 넣지 않는다. 넣으면 지워야 할 줄을 찾아 배열을 뒤지게 되고,
     지나간 대화 사이에 "타이핑 중"이 화석처럼 박힌다. */
const MYS_TYP_MS  = 2500;   // 치는 동안 이만큼마다 한 번씩 알린다(스로틀)
const MYS_TYP_TTL = 6000;   // 이만큼 소식이 없으면 내린다
let mysTyping = {};         // id → { name, at }
let mysTypAt = 0;           // 마지막으로 내가 알린 시각
let mysTypTimer = 0;
/* 살아 있는 것만 남기고 돌려준다. ★ 읽는 자리에서 거른다 —
   타이머로 지우면 창이 닫혀 있는 동안 타이머가 안 돌아 유령이 남는다(파티원 목록과 같은 규칙). */
function mysTypingList(){
  const now=Date.now(), out=[];
  Object.keys(mysTyping).forEach(id=>{
    if(now - (mysTyping[id].at||0) > MYS_TYP_TTL){ delete mysTyping[id]; return; }
    out.push(mysTyping[id]);
  });
  return out;
}
function mysTypingClear(id){ if(mysTyping[id]){ delete mysTyping[id]; mysRenderTyping(); } }
function mysTypingHtml(){
  return mysTypingList().map(t=>
    '<p class="lg-typ"><b>\''+mysEsc(t.name)+'\'</b>가 타이핑 중…</p>').join('');
}
/* 전용 노드만 갈아끼운다. ⚠ 노드가 없으면(로비·아직 안 그림) 아무 일도 하지 않는다 —
   여기서 전체 렌더를 부르면 위 ⚠ 의 커서 튐이 그대로 돌아온다. */
function mysRenderTyping(){
  const box=el('mysTyping'); if(!box) return;
  const html=mysTypingHtml();
  if(box.innerHTML!==html){
    const lg=el('mysLog');
    const pinned = !lg || (lg.scrollHeight - lg.scrollTop - lg.clientHeight) < 24;
    box.innerHTML=html;
    if(lg && pinned) lg.scrollTop=lg.scrollHeight;
  }
  /* 소식이 끊긴 줄을 스스로 내리기 위한 한 박자. 남은 사람이 없으면 타이머도 끈다 —
     아무도 안 치는 동안 초마다 도는 타이머를 남겨둘 이유가 없다. */
  if(mysTypTimer){ try{ clearTimeout(mysTypTimer); }catch(_){} mysTypTimer=0; }
  if(Object.keys(mysTyping).length && typeof setTimeout==='function')
    mysTypTimer=setTimeout(()=>{ mysTypTimer=0; mysRenderTyping(); }, 1200);
}
/* 내가 치는 중이라고 알린다. ★ 글자마다 보내지 않는다 — 한 줄 치는 동안 스무 번이 나간다.
   ⚠ 비우면 곧바로 내려준다. 그건 '안 보낼 생각'이라는 뜻이라 기다릴 이유가 없다. */
function mysTypingPing(v){
  if(!mysNetOn() || !mysField()) return;
  const a=agent();
  const who = mysNickOn ? mysNickName() : ((a && a.name) || '나');
  if(!String(v||'').trim()){ mysTypAt=0; mysNetSend({ t:'typ', on:false }); return; }
  const now=Date.now();
  if(now - mysTypAt < MYS_TYP_MS) return;
  mysTypAt=now;
  mysNetSend({ t:'typ', on:true, w:who });
}
function mysFieldMsg(text, warn){
  if(!text) return;
  mysLog(warn ? 'sys' : 'sys', text);
  /* ⚠ 로비에는 기록 창이 없다. 사건 전에 나가는 안내(파티 코드 등)는 토스트로도 띄운다 —
     안 그러면 아무 데도 안 뜨고 "눌렀는데 반응이 없다"가 된다. */
  if(!mysField()) mysToast(text);
  mysRenderField();
}

/* ── 장면(스크립트 박스) ─────────────────────────────────────────────
   ★ 여기에는 NPC 대사만 흐른다. 캐릭터 채팅은 절대 넣지 말 것 —
     비주얼노벨 박스에 잡담이 섞이면 장면이 장면으로 안 읽힌다. 채팅은 우측 기록 창으로. */
let mysSceneState = null;   // { who, lines[], i }
/* ★ 장면 대기열. 심문 대사가 흐르는 중에 정리 스크립트가 겹치면 둘 중 하나가 사라진다.
   덮어쓰지도, 로그로 흘려보내지도 않고 뒤에 세운다 — 대사는 순서가 곧 의미다. */
let mysSceneQueue = [];
/* kind — ''(NPC 대사) · 'recap'(정리) · 'clue'(조사 결과) · 'me'(내 대사).
   ★ 색을 가르기 위한 것이다. 정리는 NPC가 하는 말이 아니라 내 머릿속에서 정리되는 것인데,
     같은 흰 글씨로 흐르면 플레이어가 그것도 누가 한 말인 줄 안다.
   ★ 'clue' 와 'me' 는 **이미 기록 창에 남은 것을 화면에도 한 번 더 보여주는 것**이다.
     그래서 장면이 끝날 때 또 남기지 않는다(MYS_SCENE_ECHO) — 남기면 같은 줄이 두 번 뜬다.
   ⚠ 순서가 곧 의미다. 조사 결과를 로그에만 흘리면 화면 오른쪽 구석에서 스쳐 지나가고,
     플레이어는 방금 무엇을 알아냈는지 모르는 채로 다음 칸으로 걸어간다. */
const MYS_SCENE_ECHO = { clue:1, me:1, mate:1 };
/* ★ 대사 한 줄은 문자열이거나 { t:'대사', e:'표정' } 이다. 표정은 NPC 스탠딩을 바꾼다.
   ★ seg 는 채팅 한 줄을 대사/지문 조각으로 쪼갠 것이다({k:'say'|'act', t}).
     지문을 회색 기울임으로 그리려면 "어디부터 어디까지가 지문인가"를 화면까지 들고 가야 한다.
     괄호를 다시 찾아 파싱하지 않는다 — 대사에 든 괄호까지 지문으로 읽힌다.
   ⚠ 여기서 한 번만 정규화한다. 읽는 자리마다 '문자열인가 객체인가'를 따지기 시작하면
     반드시 한 군데를 빠뜨리고, 그 자리에서 [object Object] 가 화면에 찍힌다. */
function mysSceneLines(lines){
  return (lines||[]).map(l => (l && typeof l==='object')
    ? { t:String(l.t==null?'':l.t), e:l.e||'', seg:(l.seg && l.seg.length ? l.seg : null) }
    : { t:String(l==null?'':l), e:'', seg:null });
}
/* 대사 한 줄을 HTML 로. 지문 조각은 괄호를 씌워 회색 기울임으로 물러나 앉힌다 —
   대사와 같은 무게로 찍히면 누가 한 말인지와 무엇을 한 짓인지가 섞인다. */
function mysLineHtml(line){
  if(!line) return '';
  if(!line.seg) return mysEsc(line.t||'');
  return line.seg.map(g => g.k==='act'
    ? '<i class="act">('+mysEsc(g.t)+')</i>' : mysEsc(g.t)).join(' ');
}
function mysScene(who, lines, kind, remote){
  const norm=mysSceneLines(lines);
  /* 채팅으로 떠 있던 말풍선은 대사 앞에서 비킨다 — 대기열에 세우면 NPC가 입을 열기 전에
     방금 친 잡담을 한 번 더 읽어야 한다. 그건 이미 기록 창에 남아 있다. */
  if(mysSoftScene()) mysSceneState=null;
  if(mysSceneState){ mysSceneQueue.push({ who:who, lines:norm, kind:kind||'' }); return; }
  mysSceneState = { who:who, lines:norm, i:0, kind:kind||'' };
  mysRenderField();
}
/* ── 채팅 말풍선(소프트 장면) ────────────────────────────────────────
   ★ 파티원끼리 주고받는 말은 NPC 대사와 같은 박스에 뜨지만 **화면을 잠그지 않는다.**
     방향키로 걸으면서 얘기할 수 있어야 한다 — 걸음이 멈추면 아무도 말을 안 하게 된다.
   ★ 내가 조사 중(굴림 대기·팝업·NPC 장면)이면 박스를 뺏지 않고 기록 창에만 남긴다.
     조사하다 말고 "다들 모여봐"를 읽어야지, 조사가 통째로 끊기면 안 된다.
   ⚠ 소프트 장면은 대기열에 세우지 않는다. 채팅은 흐르는 물건이라 뒤에 세워두면
     한참 뒤에 남의 말이 뒤늦게 떠오른다. */
function mysSoftScene(){ return !!(mysSceneState && mysSceneState.soft); }
/* by — 파티원 대사면 보낸 사람의 id. ★ 이름이 아니라 id 로 들고 있는다.
   같은 이름을 쓰는 사람이 둘이면 이름으로는 누구 스탠딩인지 고를 수 없다. */
function mysChatScene(who, line, mine, by){
  if(mysModal || mysPending) return false;               // 조사 중 — 기록 창으로
  if(mysSceneState && !mysSoftScene()) return false;     // NPC 장면 중 — 기록 창으로
  mysSceneState = { who:who, lines:mysSceneLines([line]), i:0,
                    kind:(mine?'me':'mate'), soft:true, by:by||null };
  return true;
}
/* 지금 줄의 표정. 지정이 없으면 앞줄에서 지정한 표정이 그대로 이어진다 —
   줄마다 다시 적게 하면 데이터가 표정으로 뒤덮인다. */
function mysSceneExpr(){
  const s=mysSceneState; if(!s) return 'normal';
  for(let i=s.i; i>=0; i--){ if(s.lines[i] && s.lines[i].e) return s.lines[i].e; }
  return 'normal';
}
function mysSceneNext(){
  if(!mysSceneState) return;
  mysSceneState.i++;
  if(mysSceneState.i >= mysSceneState.lines.length){
    /* 장면이 끝나면 대사를 기록 창에 남긴다 — 나중에 다시 읽을 수 있어야 한다 */
    const kind=mysSceneState.kind;
    if(!MYS_SCENE_ECHO[kind])
      mysSceneState.lines.forEach(l=>mysLog(kind==='recap'?'recap':'npc', l.t, mysSceneState.who));
    /* ★ 브리핑을 끝까지 본 사건을 적어둔다 — 다음 착수부터 [건너뛰기]가 뜬다.
       건너뛰기도 이 경로로 끝나므로(mysSkipBriefing 은 마지막 줄을 넘긴다) 여기 한 곳이면 된다. */
    if(mysSceneState.tag==='briefing'){
      const f=mysField();
      if(f && f.caseId){ MYS.briefed=MYS.briefed||{}; MYS.briefed[f.caseId]=1; mysSave(); }
    }
    mysSceneState = null;
    const nx = mysSceneQueue.shift();
    if(nx) mysSceneState = { who:nx.who, lines:nx.lines, i:0, kind:nx.kind||'' };
  }
  mysRenderField();
}
function mysInScene(){ return !!mysSceneState; }
/* ── 브리핑 건너뛰기 ─────────────────────────────────────────────────
   ★ 한 번 끝까지 본 사건에서만 뜬다. 처음 듣는 사람에게는 안 뜬다 —
     CASE-001 브리핑에는 "맨몸으로 닿지 마라"가 들어 있고, 그걸 못 들으면
     오염도가 왜 오르는지 모르는 채로 현장을 걷게 된다.
   ⚠ 자동으로 건너뛰지 않는다. 다시 읽고 싶은 사람이 있고, 무엇보다
     저장이 옮겨다니는 물건이라(기기·계정) '봤다'는 기록을 100% 믿을 수 없다. */
function mysCanSkipBriefing(){
  const s=mysSceneState, f=mysField();
  return !!(s && s.tag==='briefing' && f && MYS.briefed && MYS.briefed[f.caseId]);
}
/* ★ 마지막 줄로 옮기고 평소의 넘김을 한 번 태운다 — 대사를 기록 창에 남기는 일도,
   대기열을 잇는 일도 mysSceneNext 하나가 한다. 여기서 상태를 직접 지우면
   그 두 가지가 통째로 빠져 브리핑이 기록에도 안 남는다(진입 경로 하나 규칙). */
function mysSkipBriefing(){
  if(!mysCanSkipBriefing()) return;
  mysSceneState.i = mysSceneState.lines.length - 1;
  mysSceneNext();
  mysFieldMsg('브리핑을 건너뛰었다 — 전문은 기록 창에 남아 있다.');
}

/* ── 판정 대기 ───────────────────────────────────────────────────────
   조사 버튼을 눌러도 바로 굴리지 않는다. 우측 버튼이 🎲 로 바뀌고,
   플레이어가 직접 눌러야 결과가 나온다. 굴리는 행위 자체가 이벤트여야 한다. */
let mysPending = null;   // { kind:'spot'|'door', ref, path, dc, label }
function mysAskRoll(kind, ref, path, dc, label){
  /* ★ 어느 칸에서 세운 굴림인지 같이 들고 있는다. 그 자리를 뜨면 없던 일이 된다 —
     아래 mysDropPending 이 그걸 본다. */
  mysPending = { kind:kind, ref:ref, path:path, dc:dc, label:label,
                 at:(mysField() ? mysField().pos : '') };
  mysRenderField();
}
/* 굴림을 세워둔 자리를 떠나면 없던 일이 된다.
   ★ 굴리지 않고 걸어 나가는 것은 '안 하기로 했다'는 뜻이다. 들고 다니게 두면
     엉뚱한 칸에서 🎲 를 눌러 저쪽 방의 문이 열린다.
   ★ 대신 화면을 잠그지 않는다 — 굴림 대기 중에도 걸을 수 있어야 물러설 자유가 생긴다.
     다시 그 칸에 서서 조사를 누르면 그때 다시 선다. */
function mysDropPending(){
  if(!mysPending) return false;
  mysLog('sys', mysPending.label+' — 그 자리를 떠났다. 굴림은 없던 일이 된다.');
  mysPending = null;
  return true;
}
function mysDoRoll(){
  const p = mysPending; if(!p) return;
  mysPending = null;
  if(p.kind==='spot') mysResolveSpot(p.ref);
  else                mysResolveDoor(p.ref);
}

/* ── 잠금 팝업 ───────────────────────────────────────────────────────
   암호는 지도·채팅과 분리해 창 중앙에 띄운다. 파티에서는 파티장만 입력하고
   파티원에게는 같은 팝업이 읽기 전용으로 뜬다(무엇을 기다리는지 보여야 한다). */
let mysModal = null;   // { type:'code', label, onOk }
function mysUseItem(id){
  const d=mysItemDef(id); if(!d || !mysHasItem(id)) return;
  /* 잠긴 아이템 — 패턴을 먼저 풀어야 안을 본다 */
  if(d.lock && !mysItemOpen(id)){
    /* ★ hintClue 가 걸려 있으면 그 단서를 얻기 전엔 문구를 안 보여준다.
       보여주면 감식 판정을 건너뛰고도 힌트가 손에 들어와 그 경로가 죽는다. */
    const hintOk = !d.lock.hintClue || mysGotClue(d.lock.hintClue);
    mysModal={ type:'pattern', label:d.name, item:id, path:[],
               hint: hintOk ? d.lock.hint
                            : '잠금 화면에 뭔가 적혀 있지만 읽어내지 못했다.' };
    mysRenderField();
    setTimeout(()=>{ const i=el('mysModalInput'); if(i) i.focus(); }, 0);
    return;
  }
  /* 이번 단계의 잠금이 이 아이템에 걸려 있으면 입력창을 연다 */
  const st=mysItemLockStage(id);
  if(st){ mysModal={ type:'code', label:st.name, hint:st.hint }; mysRenderField();
          setTimeout(()=>{ const i=el('mysModalInput'); if(i) i.focus(); }, 0); return; }
  mysFieldMsg((d.opened && mysItemOpen(id)) ? d.opened : d.desc);
}
function mysPatternTap(n){
  if(!mysModal || mysModal.type!=='pattern') return;
  const p=mysModal.path;
  if(p.indexOf(n)>=0) return;          // 한 점을 두 번 지나지 않는다(한붓그리기)
  p.push(n);
  /* ★ 길이가 찼으면 확인을 누르지 않아도 그 자리에서 판정한다. 실제 잠금화면이 그렇다 —
     다 그려놓고 버튼을 한 번 더 누르는 잠금은 없다.
     ⚠ 길이는 데이터에서 읽는다. 여기에 6을 박으면 패턴을 바꾼 날 조용히 어긋난다. */
  const d=mysItemDef(mysModal.item);
  const need=((d && d.lock && d.lock.pattern) || []).length;
  if(need && p.length>=need) return mysPatternSubmit();
  mysRenderField();
}
function mysPatternSubmit(typedIn){
  if(!mysModal || mysModal.type!=='pattern') return;
  const id=mysModal.item, d=mysItemDef(id);
  /* 타이핑한 번호가 있으면 그쪽을 본다. 점을 몇 개 찍다 말고 숫자를 친 경우
     둘을 섞으면 무엇을 제출했는지 아무도 모른다 — 친 것이 있으면 친 것이 답이다. */
  /* typedIn — 검증기가 화면 없이 숫자 입력을 재현하기 위한 것.
     ⚠ 화면이 있을 때는 절대 넘기지 않는다. 입력칸이 곧 사실이어야 한다. */
  const i=el('mysModalInput');
  const raw = (typedIn != null) ? typedIn : ((i && i.value) || '');
  const typed=String(raw).replace(/[^1-9]/g,'');
  /* ★ 순서는 보지 않는다 — '어느 점들인가'만 맞으면 열린다(난이도 하향).
     점을 아무 순서로 찍어도, 숫자를 아무 순서로 쳐도(474269 ❌ / 967245 ⭕) 같은 답이다.
     타이핑 쪽은 같은 숫자를 두 번 쳐도 한 번으로 센다. 점 쪽은 애초에 중복이 안 찍힌다.
     ⚠ 집합이 '정확히' 같아야 한다. 부분집합으로 열면 아홉 점을 다 누르는 게 만능 정답이 된다. */
  const setOf=a=>{ const u=[]; a.forEach(n=>{ n=+n; if(u.indexOf(n)<0) u.push(n); }); return u.sort().join(','); };
  const want=setOf(d.lock.pattern||[]);
  const got = typed ? setOf(typed.split('')) : setOf(mysModal.path);
  if(want===got){
    const f=mysField(); f.unlocked=(f.unlocked||[]).concat([id]);
    mysModal=null;
    mysLog('sys', d.name+' 잠금이 풀렸다. '+(d.opened||''));
    /* ★ 잠금 해제도 전원 공유 — needOpen 문(관리자실)이 사람마다 다르게 잠겨 있으면
       카드 문에서 났던 사고(파티장만 들어간다)가 거기서 또 난다. */
    mysNetSend({ t:'unlock', id:id });
    mysSave();
  } else {
    mysModal.path=[];
    if(i) i.value='';
    mysLog('sys', '맞지 않는다.');
  }
  mysRenderField();
}
function mysOpenLock(){
  const st=mysLockHere(); if(!st) return;
  if(mysAccuseStage()) return mysOpenAccuse();   // 지목 칸은 지목 팝업으로
  mysModal = { type:'code', label:st.name, hint:st.hint };
  mysRenderField();
  setTimeout(()=>{ const i=el('mysModalInput'); if(i) i.focus(); }, 0);
}
function mysCloseModal(){ mysModal=null; mysRenderField(); }

/* ── 스탠딩 ──────────────────────────────────────────────────────────
   평상시엔 숨긴다. 지도 좌우를 각 5칸씩 가리기 때문 —
   하필 로비와 정비실 자리다. 장면 중에만 올라온다. */
let mysStandHidden = false;   // 지도에 마우스를 올리면 비킨다(수동 토글은 없앴다 — 그 자리는 👥 관계자)
/* ── NPC 스탠딩 ──────────────────────────────────────────────────────
   ★ 자산은 게임 파일 옆에 둔다(브금과 같은 규칙). 릴리스에서 parts/ 로 들어가므로
     두 경로를 다 시도한다. 파일이 없어도 게임은 그대로 돌아간다 — 이름표로 떨어질 뿐이다.
   ★ 파일 이름은 <img>_<표정>.png, 그 표정이 없으면 <img>.png 다.
     표정을 다 그릴 때까지 기다릴 이유가 없다 — 평상 한 장만 넣어도 바로 붙는다.
   ⚠ 화자 이름으로 찾는다. 재심문은 이름이 '캬타 (한 번 더)' 라서 괄호를 떼고 본다 —
     안 떼면 재심문에서만 스탠딩이 사라진다. */
const MYS_NPC_DIR = ['parts/npc/', 'npc/'];
/* 후보를 순서대로 시도하고 다 실패하면 조용히 사라진다(뒤의 이름표가 드러난다).
   ⚠ 인라인 onerror 에는 큰따옴표를 쓰지 말 것 — 속성이 그 자리에서 끊긴다.
   ★ 엑박 차단은 두 겹이다:
     (1) visibility:hidden 으로 세우고 onload 에서만 보인다 — 실패 순간의 깨진 아이콘이
         화면에 안 그려진다(alt 를 비워도 브라우저에 따라 테두리가 뜬다).
     (2) 실패한 경로는 MYS_IMG_DEAD 에 기억한다 — 재렌더가 잦아서(이동·채팅마다)
         기억 없이는 같은 파일을 매번 다시 찔러 보고, 그때마다 한 번씩 깜빡인다. */
window.MYS_IMG_DEAD = window.MYS_IMG_DEAD || {};
const MYS_IMG_NEXT = "if(this.dataset.cur)MYS_IMG_DEAD[this.dataset.cur]=1;"
  + "var a=(this.dataset.alt||'').split('|').filter(Boolean);"
  + "if(a.length){this.dataset.cur=a[0];this.dataset.alt=a.slice(1).join('|');this.src=a[0];}"
  + "else{this.style.display='none';}";
const MYS_IMG_OK = "this.style.visibility='visible'";
function mysCastKey(who){ return String(who||'').replace(/\s*\([^)]*\)\s*$/, '').trim(); }
function mysNpcStand(who, expr){
  const c=mysCase(); if(!c || !c.cast) return [];
  const d=c.cast[mysCastKey(who)]; if(!d || !d.img) return [];
  const names=[];
  if(expr && expr!=='normal') names.push(d.img+'_'+expr+'.png');
  names.push(d.img+'.png');
  const out=[];
  names.forEach(n=>MYS_NPC_DIR.forEach(dir=>out.push(dir+n)));
  return out;
}
function mysStandHtml(){
  /* ★ 표정 명령(/당황)이 여기로 들어온다. standUrl 이 없는 표정은 평상으로 떨어지므로
     등록 안 한 표정을 지정해도 화면이 비지 않는다(진입 경로 하나 규칙). */
  const kind = mysSceneState ? mysSceneState.kind : null;
  /* ★ 왼쪽은 언제나 나다. NPC 심문이든 파티원 대화든 내 자리는 좌측 고정 —
     장면 종류에 따라 내 스탠딩이 좌우로 옮겨 다니면 '내가 어느 쪽인가'를 매번 다시 찾는다.
     파티원은 오른쪽(반전)에 선다 — 아래 mate 블록. */
  let pick = null;
  if(kind==='' || kind==='me' || kind==='mate') pick = standPick(mysExprKey, MYS.active);
  const url = pick ? pick.url : null;
  /* ★ 조사·정리 장면에는 스탠딩이 안 선다. 말하는 사람이 없는 장면인데 서 있으면
     플레이어가 그 글을 누가 한 말로 읽는다. 깜빡임도 그만큼 줄어든다. */
  const show = mysInScene() && !!url;
  let out='';
  if(show) out+='<div class="mys-fstand left'+(mysStandHidden?' off':'')
      +(pick.photo?' pic':'')+'">'
      +'<img src="'+mysEsc(url)+'" alt=""></div>';
  /* 오른쪽 = 심문 상대(NPC). 스탠딩이 있으면 그림, 없으면 이름표다.
     ★ 정리 스크립트는 예외다 — 말하는 사람이 없다. 이름표에 '정리'가 뜨면
       그런 이름의 인물이 서 있는 것처럼 읽힌다.
     ★ 죽은 것으로 기억된 경로는 아예 안 세운다 — 후보가 전멸이면 img 자체를 안 만들고
       이름표만 남는다(엑박이 나올 자리가 없다). */
  if(mysInScene() && mysSceneState.kind===''){
    const who=mysSceneState.who;
    const cand=mysNpcStand(who, mysSceneExpr()).filter(u=>!MYS_IMG_DEAD[u]);
    out+='<div class="mys-fstand right'+(mysStandHidden?' off':'')+'">'
      +'<div class="npcbox"><span>'+mysEsc(who)+'</span></div>'
      +(cand.length ? '<img src="'+mysEsc(cand[0])+'" alt="" style="visibility:hidden"'
          +' data-cur="'+mysEsc(cand[0])+'"'
          +' data-alt="'+mysEsc(cand.slice(1).join('|'))+'"'
          +" onload=\""+MYS_IMG_OK+"\""
          +" onerror=\""+MYS_IMG_NEXT+"\">" : '')
      +'</div>';
  }
  /* 오른쪽 = 파티원. 나와 마주 보도록 좌우반전(.mate — CSS scaleX(-1))으로 선다.
     ⚠ 파티원 스탠딩은 서버 URL 로 받은 것뿐이다(mysStandShare). 없으면 아무것도 안 세운다 —
       이름은 스크립트 박스와 기록 창에 이미 있으므로 빈 이름표를 하나 더 세울 이유가 없다. */
  else if(mysInScene() && kind==='mate'){
    const mp=mysMateStandPick(mysSceneState.by ? mysPeers[mysSceneState.by] : null, mysSceneExpr());
    if(mp) out+='<div class="mys-fstand right mate'+(mysStandHidden?' off':'')
      +(mp.photo?' pic':'')+'">'
      +'<img src="'+mysEsc(mp.url)+'" alt=""></div>';
  }
  return out;
}

/* 관계자 — 지도 우상단 버튼에 마우스를 올리면 펼쳐진다.
   ★ 우측 패널에서 뺐다. 사건 내내 바뀌지 않는 목록이라 늘 자리를 차지할 이유가 없고,
     그 자리는 계속 늘어나는 단서가 받는 게 맞다.
   ★ 여는 방식이 호버뿐이라 상태가 없다 — 열림/닫힘을 JS로 들고 있지 않으니
     재렌더가 아무리 잦아도 열려 있던 목록이 저 혼자 닫히지 않는다. */
function mysCastHtml(){
  const c=mysCase(); const list=(c && c.suspects) || [];
  if(!list.length) return '';
  let out='<div class="mys-cast"><button type="button" data-act="cast">👥 관계자</button>'
        +'<div class="mys-castlist">';
  list.forEach(s=>{
    out+='<p><b>'+mysEsc(s.name)+'</b> <em>'+mysEsc(s.role||'')+'</em>'
      +(s.note?'<span class="nt">'+mysEsc(s.note)+'</span>':'')+'</p>';
  });
  return out+'</div></div>';
}

function mysMapHtml(){
  const f=mysField(), g=mysGrid(); if(!f||!g) return '';
  const p=mysXY(f.pos), mates=mysMateAt(), mflags=mysMateFlags();
  const c=mysCase(), st=mysStageDef();
  /* 채팅 말풍선은 지도를 어둡게 하지 않는다 — 걸을 수 있는데 못 걷는 화면으로 보이면 안 된다 */
  const lock = mysInScene() && !mysSoftScene();
  /* 오염도가 임계값을 넘으면 화면이 흔들린다. 숫자를 못 보고 있어도 몸으로 알아채야 한다. */
  const tainted = taintOf(agent()) >= MYS_TAINT_GLITCH;
  const C=MYS_MAPCOL;
  let out='<div class="mys-map'+(lock?' locked':'')+(tainted?' tainted':'')+'" id="mysMap"'
    +' style="grid-template-columns:repeat('+g.w+','+MYS_CELL+'px)">';
  for(let y=0;y<g.h;y++){
    for(let x=0;x<g.w;x++){
      const t=mysAt(x,y), k=mysKey(x,y);
      if(t===' '){ out+='<i class="cl out"></i>'; continue; }
      if(!mysCellSeen(x,y)){ out+='<i class="cl fog"></i>'; continue; }
      if(t==='#'){ out+='<i class="cl wall"></i>'; continue; }
      const here=(x===p.x&&y===p.y);
      const z=mysZoneChar(x,y);
      const cls=['cl'];
      let inner='', style='', title=mysZoneName(x,y);
      if(t==='+'){
        cls.push('door');
        const d=mysDoorAt(x,y);
        if(d && d.lock && !mysDoorOpen(x,y)){ cls.push('lock'); inner=MYS_ICON.lock;
          title=d.name+' · 잠김 ['+STAT_LABEL[d.lock.path]+' '+d.lock.dc+']'; }
        else inner=MYS_ICON.door;
      } else if(z){
        style='background:'+MYS_ZONES[z].col+';';
        /* 방 윤곽선 — 이웃 칸의 방이 다르면 그쪽에만 선을 긋는다.
           칸마다 격자선을 그리면 지저분하고, 방 단위 블록으로 안 읽힌다. */
        const e='1px solid '+C.edge;
        if(mysZoneChar(x,y-1)!==z) style+='border-top:'+e+';';
        if(mysZoneChar(x,y+1)!==z) style+='border-bottom:'+e+';';
        if(mysZoneChar(x-1,y)!==z) style+='border-left:'+e+';';
        if(mysZoneChar(x+1,y)!==z) style+='border-right:'+e+';';
        const s=mysSpotAt(k);
        const body=(c.bodies||[]).find(b=>b.at===k);
        /* ★ 시신이 있는 칸은 무엇보다 시신이다. 예전엔 그 칸의 조사 지점이 먼저 걸려서
           시신이 '?' 로 찍혔다 — 복도에 물음표 하나 놓인 화면이 됐다. */
        if(body){ cls.push('body'); inner=MYS_ICON.body; title=body.name||'시신';
          if(s && mysGotClue(s.id)) cls.push('done'); }
        else if(s && s.stage<=f.stage){
          /* ★ 사람은 사람으로 보여야 한다 — 어느 방에 누가 있는지는 숨길 것이 아니다.
             ★ 사물 단서는 아무 표시도 하지 않는다. 예전엔 '?' 를 찍었는데,
               그러면 플레이어가 물음표만 직행하고 방을 뒤지지 않는다 —
               "그 방에 갔는데 없었다"가 정보가 되는 구조 자체가 죽는다.
               조사한 뒤에는 ✓ 를 남긴다. 이미 아는 것을 숨길 이유는 없다. */
          const isNpc=(s.path==='intr');
          if(mysGotClue(s.id)){ cls.push('done');
            inner=isNpc?MYS_ICON.npc:MYS_ICON.done; title=s.name+' · 조사 완료'; }
          else if(isNpc){ cls.push('npc'); inner=MYS_ICON.npc;
            title=s.name+' ['+STAT_LABEL[s.path]+' '+s.dc+']'; }
          else if(mysLooked(x,y)){ cls.push('seenc'); inner=MYS_ICON.looked; }
        }
        else if(mysLooked(x,y)){ cls.push('seenc'); inner=MYS_ICON.looked; }
        if(st && st.at===k && !inner){ cls.push('slock'); inner=MYS_ICON.lock; title=st.name; }
      }
      /* 깃발은 칸 내용을 덮지 않는다 — 단서 '?' 위에 꽂으면 그 단서가 안 보이게 된다 */
      const myflag=mysFlagAt(k);
      /* 메모는 칸 툴팁에 붙인다 — 지도에 글자를 얹으면 24×14 칸이 금방 안 읽힌다 */
      if(myflag && myflag.note) title += ' · ⚑ ' + myflag.note;
      if(here){ cls.push('me'); inner='<b>■</b>'; }
      const md=mates[k];
      if(md && md.length){
        const dots=n=>'<span class="mt">'+n.slice(0,3)
          .map(m=>'<em style="color:'+m.color+'">●</em>').join('')+'</span>';
        if(here){
          /* ★ 내 칸과 겹칠 때만 작은 점이다. 여기서도 칸을 칠하면 내가 어디 서 있는지가
             남의 색에 덮인다 — 내 위치는 무엇에도 가려지면 안 된다. */
          inner+=dots(md);
          title += ' · ' + md.map(m=>m.name).join(' · ');
        } else {
          cls.push('mate');
          style+='background:'+md[0].color+';';
          inner='<b>■</b>' + (md.length>1 ? dots(md.slice(1)) : '');
          title = md.map(m=>m.name).join(' · ') + ' · ' + title;
        }
      }
      const mf=mflags[k];
      if(myflag || (mf && mf.length)) inner+='<span class="mf">'
        +(myflag?'<em style="color:'+C.flag+'">'+(myflag.note?'⚐':'⚑')+'</em>':'')
        +((mf||[]).slice(0,2).map(m=>'<em style="color:'+m.color+'">⚑</em>').join(''))+'</span>';
      out+='<i class="'+cls.join(' ')+'" data-x="'+x+'" data-y="'+y+'"'
        +(style?' style="'+style+'"':'')+' title="'+mysEsc(title)+'">'+inner+'</i>';
    }
  }
  /* 방 이름 — 격자 위에 겹쳐 찍는다. 본 방만 보인다. */
  Object.keys(g.labels||{}).forEach(z=>{
    if(!mysZoneSeen(z)) return;
    const L=g.labels[z];
    out+='<span class="mys-rlabel" style="left:'+(L.x*MYS_CELL)+'px;top:'+(L.y*MYS_CELL)+'px">'
      +mysEsc(L.name)+'</span>';
  });
  return out+'</div>';
}

function mysScriptHtml(){
  if(!mysInScene()) return '';
  const s=mysSceneState;
  /* ★ 두 줄을 보여준다. 한 줄만 뜨면 옆에서 채팅을 치는 동안 앞말이 사라져서
     대사를 놓친다. 직전 줄은 흐리게 — 지금 읽을 줄이 어느 것인지가 흔들리면 안 된다. */
  const prev = (s.i > 0 && s.lines[s.i-1]) ? mysLineHtml(s.lines[s.i-1]) : '';
  const now  = s.lines[s.i] ? mysLineHtml(s.lines[s.i]) : '';
  /* ★ 스탠딩은 박스 안에 담아 박스 위로 세운다(.mys-fstand · bottom:100%).
     무대에 두면 박스가 아래로 내려앉은 만큼 사람만 위에 남아, 말과 말하는 사람이 갈라진다. */
  return '<div class="mys-script'+(s.kind?' '+s.kind:'')+(s.soft?' soft':'')+'" id="mysScript">'
    + mysStandHtml()
    +'<div class="who">'+mysEsc(s.who)+'</div>'
    +(prev ? '<div class="line prev">'+prev+'</div>' : '')
    +'<div class="line">'+now+'</div>'
    +'<div class="cue">'+(s.soft ? '▼ 닫기 · 이동 가능'
        : (s.i < s.lines.length-1 ? '▼ 계속' : '▼ 닫기'))+'</div>'
    +'</div>';
}

function mysSideHtml(){
  const f=mysField(), c=mysCase(), g=mysGrid(); if(!f||!c) return '';
  const p=mysXY(f.pos);
  const a=agent();
  const done=f.stage > (c.stages||[]).length;
  const sp=mysSpotAt(f.pos);
  let out='<div class="mys-side">';

  out+='<div class="mys-loc"><b>'+mysEsc(mysZoneName(p.x,p.y))+'</b>'
      +'<span>'+mysEsc(c.floor)+' · '+f.pos+'</span></div>';

  /* 행동 — ★ 칸에 뭔가 있으면 버튼은 반드시 보인다.
     자격 미달일 때 버튼을 아예 지우면 "여긴 아무것도 없다"로 읽힌다(실제로 그렇게 보고받았다).
     비활성으로 두되 무엇이 얼마나 모자란지 적는다. */
  const lk=mysLockHere();
  out+='<div class="mys-act">';
  if(a && (a.suspended || a.lost)){
    const alt=mysFreeSlot();
    out+='<span class="warn">오염도 상한 — 이 요원은 더 활동할 수 없다.</span>';
    if(alt>=0) out+='<button type="button" data-act="swap">🔁 '
      +mysEsc(agent(alt).name||('A-00'+(alt+1)))+'(으)로 교대</button>';
    else out+='<span class="warn">교대할 요원이 없다 — 본부 정화가 필요하다.</span>';
  } else if(mysInScene() && !mysSoftScene()){
    out+='<span class="dim">장면 진행 중 — 지도를 눌러 넘긴다. 채팅은 그대로 쓸 수 있다.</span>';
    /* ★ 2회차부터의 [건너뛰기]. 처음 듣는 사람에게는 이 줄 자체가 없다. */
    if(mysCanSkipBriefing())
      out+='<button type="button" data-act="skipbrief" style="margin-top:4px">'
        +'⏩ 브리핑 건너뛰기</button>';
  } else if(lk && mysAccuseStage()){
    /* ★ 마지막 단계의 잠금 칸은 '이름을 타이핑하는 곳'이 아니라 '지목하는 곳'이다.
       같은 자리에서 같은 팝업이 뜬다 — 입구가 둘이면 하나는 반드시 안 고쳐진다. */
    out+='<button type="button" class="accuse" data-act="accuse">🔴 '
      +mysEsc(lk.name)+'</button>';
  } else if(lk){
    out+='<button type="button" data-act="lock">🔒 '+mysEsc(lk.name)+'</button>';
  } else if(sp && sp.stage<=f.stage && !mysGotClue(sp.id)){
    const dc=mysDcOf(sp.id, sp.dc);
    const icon=(sp.path==='intr') ? MYS_ICON.npc : '🔍';
    /* auto 는 굴리지 않으므로 확률을 적지 않는다. 적으면 굴림이 있는 줄 알고 요원을 바꾼다. */
    if(sp.auto)
      out+='<button type="button" data-act="search">'+icon+' '+mysEsc(sp.name)+'</button>';
    else if(mysCanRoll(sp.path, dc))
      out+='<button type="button" data-act="search">'+icon+' '+mysEsc(sp.name)
        +' ['+STAT_LABEL[sp.path]+' '+mysTarget(sp.path,dc)+'%]</button>';
    else
      out+='<button type="button" class="no" disabled>'+icon+' '+mysEsc(sp.name)
        +' — '+STAT_LABEL[sp.path]+' '+Math.max(0,dc-MYS_GATE)+' 이상 필요</button>';
  } else if(sp && sp.stage<=f.stage){
    out+='<span class="dim">조사 완료 — '+mysEsc(sp.name)+'</span>';
  } else {
    out+='<button type="button" data-act="search">'
      +(mysLooked(p.x,p.y)?'👁 다시 둘러보기':'👁 둘러보기')+'</button>';
  }
  /* ── 심문 절차 표시 ──
     ★ 결정 층(누가 굴리고 누가 물드는가)은 이미 서 있다. 여기는 그걸 화면에 올리는 자리다.
       이게 없으면 파티원은 무엇을 기다리는지 모른 채 멈춰 있는 화면을 본다. */
  if(mysGateAsk){
    out+='<div class="mys-ready"><span>'+mysEsc(mysGateAsk.who)+' — '
      +mysEsc(mysGateAsk.name)+' 심문 준비</span>'
      +'<button type="button" data-act="ready">✋ 레디</button></div>';
  } else if(mysReady && !mysSolo()){
    const wait=mysMates().filter(m=>!mysReady.got[m.id]);
    out+='<div class="mys-ready"><span>심문 준비 — '
      +(wait.length ? wait.map(m=>mysEsc(m.name)).join(' · ')+' 대기 중'
                    : '전원 레디. 다시 눌러 시작한다')+'</span></div>';
  }

  /* ★ 범인 지목 — 조사가 다 끝난 뒤에만, 그리고 어느 칸에서든 뜬다.
     조사 버튼을 밀어내지 않고 아래에 붙는다. 조사할 게 남아 있으면 애초에 안 뜬다. */
  /* ⚠ 조건이 안 맞는다고 버튼을 아예 지우지 말 것. 지우면 "마지막 단계인데 지목할 데가
     없다"가 되고, 플레이어는 본부 단말 앞에서 이름을 타이핑하려 든다(실제로 그렇게 보고받았다).
     비활성으로 두되 무엇이 얼마나 남았는지 적는다 — 자격 미달 조사 버튼과 같은 규칙이다. */
  if((!mysInScene() || mysSoftScene()) && !(a && (a.suspended || a.lost)) && mysAccuseStage()){
    const ac=mysCase().accuse||{};
    const left=mysAccuseLeft();
    if(!left.length)
      out+='<button type="button" class="accuse" data-act="accuse">🔴 '
        +mysEsc(ac.label||'범인 지목')+'</button>';
    else
      out+='<button type="button" class="no" disabled>🔴 '+mysEsc(ac.label||'범인 지목')
        +' — 남은 조사 '+left.length+'곳</button>';
  }
  out+='</div>';

  /* 사건 종결 — 표시만 두면 플레이어가 다 끝난 현장에 갇힌다. 돌아갈 문을 같이 둔다.
     ⚠ 자동으로 닫지 않는다. 종결 장면이 흐르는 중에 현장이 사라지면 마지막 대사가 통째로 날아간다. */
  if(done) out+='<div class="mys-lockbar"><span class="ok">■ 사건 종결</span>'
    +((mysInScene() && !mysSoftScene())?'':'<button type="button" class="lockbtn" data-act="leave" '
      +'style="margin-top:4px">📋 수사국으로 돌아가기</button>')+'</div>';

  /* ── 파티 ──
     ★ 이름과 색만 둔다. 남의 오염도·단서는 안 보여준다 — 정보 비대칭이 설계 그 자체다.
       위치는 지도의 색 점이 이미 말하고 있으므로 여기서 또 적지 않는다. */
  /* 내 단서 — 잡담(noclue)은 세지도, 적지도 않는다 */
  const shown=mysClueIds();
  out+='<div class="mys-clues"><p class="ttl">내 단서 '+shown.length+'</p>';
  if(!shown.length) out+='<p class="dim">아직 없다.</p>';
  shown.forEach(id=>{
    const raw=String(id).replace(/^!/,'');
    const s=(c.spots||[]).find(x=>x.id===raw) || (c.granted&&c.granted[raw]);
    if(!s) return;
    /* ⚠ 오정보(!접두)도 겉보기는 똑같다. 구분해서 보여주면 장치가 죽는다. */
    const txt=(String(id)[0]==='!' && s.wrongText) ? s.wrongText : s.text;
    out+='<p><span class="tg">'+STAT_LABEL[s.path]+'</span>'+mysEsc(txt)+'</p>';
  });
  out+='</div>';

  /* 소지품 — 누르면 쓴다. 잠긴 아이템은 여기서 푼다 */
  const items=(f.items||[]);
  if(items.length){
    out+='<div class="mys-items"><p class="ttl">소지품</p>';
    items.forEach(id=>{ const d=mysItemDef(id); if(!d) return;
      const locked=!!(d.lock && !mysItemOpen(id));
      out+='<button type="button" class="itm'+(locked?' lk':'')+'" data-act="item" data-item="'+id+'">'
        +(locked?'🔒 ':'')+mysEsc(d.name)+'</button>'; });
    out+='</div>';
  }

  /* 관계자 목록은 여기에 없다 — 지도 우상단 👥 버튼의 호버 패널로 옮겼다(mysCastHtml).
     비워둔 자리는 위의 단서 영역이 받는다. */

  /* 채팅 · 기록 */
  /* ★ 타이핑 알림 자리. 여기서는 늘 비워둔다 — 내용은 mysRenderTyping 이 채운다.
     ⚠ html 문자열에 알림을 섞으면 diff-guard(_mysLastHtml)가 남이 칠 때마다 달라져
       화면 전체가 다시 그려지고, 내가 치던 커서가 튄다. */
  out+='<div class="mys-log" id="mysLog">'+mysLogHtml()
     +'<div id="mysTyping"></div></div>';
  /* 채팅 위 한 줄 — 닉네임 토글.
     ★ 문법 안내(//지문// · /고민)는 걷어냈다. 한 번 배우면 끝인 것을 화면에 붙박아 두면
       사건 내내 자리만 먹고, 테마에 따라 회색 덩어리로 보인다.
     ★ 굴림 대기 중에는 채팅 자리가 주사위 버튼으로 바뀌므로 이 줄도 같이 감춘다.
       남겨두면 누를 수 없는 체크박스가 떠 있게 된다. */
  if(!mysPending){
    out+='<div class="mys-chatopt">'
      +'<label><input type="checkbox" data-act="nick"'+(mysNickOn?' checked':'')+'>닉네임</label>'
      +'</div>';
  }
  out+='<div class="mys-inbar">';
  if(mysPending){
    out+='<span class="pend">'+mysEsc(mysPending.label)+'</span>'
      +'<button type="button" class="dice" data-act="roll">🎲 주사위</button>';
  } else {
    out+='<input id="mysChatInput" type="text" maxlength="80" autocomplete="off" placeholder="말하기">'
      +'<button type="button" data-act="say">전송</button>';
  }
  out+='</div>';
  return out+'</div>';
}

function mysModalHtml(){
  if(!mysModal) return '';
  if(mysModal.type==='pattern'){
    /* ★ 키패드(넘버패드) 배열로 그린다 — 7 8 9 / 4 5 6 / 1 2 3.
       ⚠ 1부터 9까지 그냥 늘어놓으면 전화기 배열이 되어 위아래가 뒤집힌다.
         데이터의 패턴은 키패드 기준이므로, 그리는 순서가 어긋나면 플레이어는
         모양을 정확히 따라 그리고도 못 연다. */
    let dots='';
    MYS_PAD_ORDER.forEach(n=>{
      /* ★ 점에 순서 번호를 적지 않는다 — 판정이 순서를 안 보게 된 뒤로(집합 비교)
         번호가 붙어 있으면 '순서를 지켜야 하나'로 오히려 헷갈린다. 켜짐 색이 전부다. */
      const on=mysModal.path.indexOf(n)>=0;
      dots+='<button type="button" class="dot'+(on?' on':'')+'" data-act="dot" data-n="'+n+'"></button>';
    });
    /* ★ 두 가지 입력을 같은 잠금에 둔다 — 점을 눌러도 되고, 그 번호를 그대로 쳐도 된다.
       아홉 점에는 키패드와 같은 번호가 매겨져 있으니 같은 것이다.
       ★ 순서는 보지 않는다 — 켜야 할 점(숫자)이 다 모이면 열린다(mysPatternSubmit). */
    return '<div class="mys-modal" id="mysModal"><div class="box">'
      +'<div class="mt">🔒 '+mysEsc(mysModal.label)+'</div>'
      +(mysModal.hint?'<div class="mh">'+mysEsc(mysModal.hint)+'</div>':'')
      +'<div class="pad">'+dots+'</div>'
      +'<div class="mr"><input id="mysModalInput" type="text" maxlength="9" autocomplete="off"'
        +' inputmode="numeric" placeholder="번호로 입력">'
        +'<button type="button" data-act="dotok">확인</button></div>'
      +'<div class="mr" style="justify-content:flex-end;margin-top:5px">'
        +'<button type="button" data-act="dotclear">지우기</button></div>'
      +'<div class="mc">순서는 상관없다 — 해당하는 점을 다 누르거나, 그 숫자를 치면 된다 · Esc 닫기</div>'
      +'</div></div>';
  }
  /* ── 전체 초기화 확인 ──
     ★ 무엇이 사라지는지 하나씩 적는다. "정말 초기화할까요?" 만 띄우면 무엇이 날아가는지
       모른 채 확인을 누르게 되고, 그건 물어보지 않은 것과 같다.
     ⚠ 기본 동작은 '취소'다. 확인 버튼을 오른쪽 끝에 혼자 두는 이유도 같다. */
  if(mysModal.type==='reset'){
    return '<div class="mys-modal" id="mysModal"><div class="box">'
      +'<div class="mt">⚠ 사건 초기화</div>'
      +'<div class="mh">진행 중인 사건 · 대화 기록 · 클리어 기록 · 단서 조각 · 정화 시스템 ·'
      +' 요원들의 오염도가 지워지고 로비로 돌아간다. 되돌릴 수 없다.'
      +'<br>요원 등록(이름 · 증명사진 · 스탠딩 · 적성)은 그대로 남는다.'
      +(mysNetOn() ? '<br>파티원 화면도 같이 지워진다. 파티 자체는 유지된다.' : '')
      +'</div>'
      +'<div class="mr" style="justify-content:flex-end">'
        +'<button type="button" data-act="resetno">취소</button>'
        +'<button type="button" class="danger" data-act="resetok">초기화</button></div>'
      +'<div class="mc">Esc 닫기</div>'
      +'</div></div>';
  }
  /* ── 나가기 전 대화 기록 ──
     ⚠ 어느 쪽도 기본값으로 강조하지 않는다. 내보내기는 되돌릴 수 있고(다시 못 만들지만)
       버리는 쪽은 못 되돌리므로, 버리는 버튼만 위험 색으로 세워 손이 미끄러지지 않게 한다. */
  if(mysModal.type==='savelog'){
    return '<div class="mys-modal" id="mysModal"><div class="box">'
      +'<div class="mt">📋 대화 기록</div>'
      +'<div class="mh">지금까지 나눈 대화 '+mysLogs.length+'줄을 텍스트 파일로 저장할까?'
      +'<br>저장하지 않고 나가면 이 기록은 사라진다.</div>'
      /* ⚠ 안내줄(.mc)을 두지 않는다 — 버튼 셋이 이미 갈 수 있는 길을 다 적고 있어서
         'Esc 닫기'는 한 줄을 더 쓰면서 아무것도 더 말해주지 않는다. Esc 는 그대로 먹는다. */
      +'<div class="mr two" style="justify-content:center;margin-top:12px">'
        +'<button type="button" data-act="resetno">취소</button>'
        +'<button type="button" class="danger" data-act="logskip">저장 안 하고<br>나가기</button>'
        +'<button type="button" data-act="logsave">저장하고<br>나가기</button></div>'
      +'</div></div>';
  }
  /* 용의자 목록 — 관계자 패널과 같은 이름·역할·비고를 쓴다.
     ⚠ 여기서만 쓰는 별도 목록을 만들지 말 것. 두 목록이 갈라지면
       "패널에는 있는데 지목에는 없는 사람"이 생긴다. */
  if(mysModal.type==='accuse'){
    const c=mysCase(), ac=(c&&c.accuse)||{};
    let list='';
    (c.suspects||[]).forEach(s=>{
      list+='<button type="button" class="sus" data-act="pick" data-name="'+mysEsc(s.name)+'">'
        +'<b>'+mysEsc(s.name)+'</b> · '+mysEsc(s.role||'')
        +(s.note?'<span>'+mysEsc(s.note)+'</span>':'')+'</button>';
    });
    return '<div class="mys-modal" id="mysModal"><div class="box">'
      +'<div class="mt">🔴 '+mysEsc(mysModal.label)+'</div>'
      +'<div class="mh">'+mysEsc(ac.note||'용의자 하나를 지목한다.')+'</div>'
      +list
      +'<div class="mc">Esc 닫기</div>'
      +'</div></div>';
  }
  /* ── 파티 코드 팝업 ──
     ★ 코드를 만드는 쪽과 받아치는 쪽이 같은 창에 있다. 화면을 둘로 나누면
       "나는 어느 쪽을 눌러야 하나"가 매번 생긴다. */
  if(mysModal.type==='party'){
    if(mysNetOn()){
      const ps=mysNetPeers(), lead=mysLeader();
      const mine=!!mysLobbyReady[mysMe.id];
      let list='<div class="plist"><span'+(lead===mysMe.id?' class="lead"':'')+'>'
        +(lead===mysMe.id?'★ ':'')+mysEsc(mysMe.name)+' (나)'
        +(mysLocked?'':(mine?' <b>✔ 레디</b>':' <i>대기</i>'))+'</span>';
      ps.forEach(pp=>{ list+='<span style="color:'+pp.color+'">'
        +(lead===pp.id?'★ ':'')+mysEsc(pp.name)
        +(mysLocked?'':(mysLobbyReady[pp.id]?' <b>✔ 레디</b>':' <i>대기</i>'))+'</span>'; });
      list+='</div>';
      /* ★ 레디는 전원, 확정은 파티장. 확정 버튼은 전원이 레디하기 전에는
         파티장 화면에도 안 뜬다 — 뜨는데 안 눌리면 그건 고장으로 읽힌다. */
      let act='';
      if(mysLocked){
        act = mysIsLeader()
          ? '<button type="button" data-act="partyedit">⚙ 파티 수정</button>'
          : '<span class="wait">파티장이 착수하기를 기다린다</span>';
      } else if(mysIsLeader() && mysLobbyAllReady()){
        act = '<button type="button" class="lockbtn2" data-act="partylock">파티 확정</button>';
      } else {
        act = '<button type="button" data-act="partyready">'
            + (mine?'레디 취소':'레디') + '</button>';
        if(mysIsLeader() && ps.length)
          act += '<span class="wait">전원 레디하면 확정할 수 있다</span>';
        if(!ps.length) act += '<span class="wait">코드를 불러줄 것</span>';
      }
      return '<div class="mys-modal" id="mysModal"><div class="box">'
        +'<div class="mt">👥 파티'+(mysLocked?' · 결성됨':'')+'</div>'
        +'<div class="mh">이 코드를 같이 할 사람에게 불러준다. (최대 '+MYS_PARTY_MAX+'명)</div>'
        +'<div class="pcode">'+mysEsc(mysRoom)+'</div>'
        + list
        +'<div class="mr">'+act+'</div>'
        +'<div class="mr" style="justify-content:flex-end;margin-top:5px">'
          +'<button type="button" data-act="partyout">파티 나가기</button></div>'
        +'<div class="mc">'+(mysLocked?'결성된 파티에는 새로 들어올 수 없다'
                                      :'파티장(★)이 확정하면 결성된다')+' · Esc 닫기</div>'
        +'</div></div>';
    }
    return '<div class="mys-modal" id="mysModal"><div class="box">'
      +'<div class="mt">👥 파티</div>'
      +'<div class="mh">코드를 만들어 부르거나, 받은 코드를 친다.</div>'
      +'<div class="mr"><input id="mysModalInput" type="text" maxlength="'+MYS_CODE_LEN+'"'
        +' autocomplete="off" placeholder="코드 '+MYS_CODE_LEN+'자">'
        +'<button type="button" data-act="partyin">참가</button></div>'
      +'<div class="mr" style="justify-content:flex-end;margin-top:5px">'
        +'<button type="button" data-act="partynew">코드 만들기</button></div>'
      +'<div class="mc">같은 코드를 친 사람끼리 한 팀이 된다 · Esc 닫기</div>'
      +'</div></div>';
  }
  if(mysModal.type==='note'){
    return '<div class="mys-modal" id="mysModal"><div class="box">'
      +'<div class="mt">⚑ '+mysEsc(mysModal.label)+'</div>'
      +'<div class="mh">이 자리에 한 줄 적어둔다. 칸에 마우스를 올리면 보인다.</div>'
      +'<div class="mr"><input id="mysModalInput" type="text" maxlength="'+MYS_NOTE_MAX+'"'
      +' autocomplete="off" placeholder="예: 여기 감식 6">'
      +'<button type="button" data-act="noteok">확인</button></div>'
      +'<div class="mr" style="justify-content:flex-end;margin-top:5px">'
      +'<button type="button" data-act="notedel">깃발 내리기</button></div>'
      +'<div class="mc">우클릭 = 꽂기·내리기 · Shift+우클릭 = 메모 · Esc 닫기</div>'
      +'</div></div>';
  }
  /* 파티원이 넘긴 답안. ★ 자동으로 제출하지 않는다 — 누르는 것은 파티장이다.
     받은 값을 그대로 통과시키면 아무나 답을 무한히 찔러볼 수 있게 되고,
     오답 오염도는 파티장이 뒤집어쓴다. */
  const ask=(mysAsk && mysIsLeader())
    ? '<div class="mr" style="margin-top:5px"><button type="button" data-act="takeask">'
      + mysEsc(mysAsk.name)+'의 답안 "'+mysEsc(mysAsk.v)+'" 제출</button></div>' : '';
  return '<div class="mys-modal" id="mysModal"><div class="box">'
    +'<div class="mt">🔒 '+mysEsc(mysModal.label)+'</div>'
    /* ★ 단계의 hint 가 있으면 '무엇을 넣는 자리인가'를 적는다.
       "잠겨 있다"만 있으면 자릿수도 종류도 모른 채 찍게 된다(어렵다는 지적의 절반). */
    +'<div class="mh">'+mysEsc(mysModal.hint || '잠겨 있다.')+'</div>'
    +'<div class="mr"><input id="mysModalInput" type="text" maxlength="12" autocomplete="off">'
    +'<button type="button" data-act="submit">'+(mysCanSubmit()?'제출':'파티장에게')+'</button></div>'
    +ask
    +'<div class="mc">'+(mysCanSubmit()?'제출은 파티장이 한다':'답안은 파티장에게 넘어간다')
    +' · Esc 닫기</div>'
    +'</div></div>';
}

/* ★ 시야 안전망. 어떤 경로로 들어왔든(새 사건·옛 저장·상태 주입) 시야가 비면 한 번 연다.
   ⚠ 창(mysBody) 유무와 무관하게 돌아야 한다 — 창이 없다고 상태를 안 고치면
     다음에 창을 열 때 또 안개다. */
function mysEnsureSeen(){
  const f=mysField();
  if(f && !(f.seen||[]).length){ mysReveal(f, f.pos); mysSave(); }
}
function mysRenderField(){
  mysEnsureSeen();
  /* ★ 위치 알림은 렌더에 얹어 돌린다. 타이머로 돌리면 창을 닫아둔 동안에도 계속 쏘고,
     그건 곧 아무도 안 보는 화면 때문에 나가는 비용이다. */
  mysNetBeat();
  if(!mysBody) return;
  const f=mysField(); if(!f) return mysRender();
  const a=agent(), c=mysCase();
  const html='<div class="mys-hdr">'
      +'<div class="cls">▲▣ '+mysEsc(c.id)+' · '+mysEsc(c.title)+'</div>'
      /* ★ 착수하면 곧장 지도로 떨어지므로, 여기가 없으면 '무슨 일인지'가 화면 어디에도 없다.
         소속 표기는 게시판 머리말에 있다 — 현장에서 더 급한 건 상황이다. */
      +'<div class="depline"><div class="dep">'+mysEsc(c.brief || c.intro || '')+'</div>'
        + mysSndBtnHtml() + '</div>'
    +'</div>'
    +'<div class="mys-field" id="mysFieldWrap">'
      +'<div class="mys-main">'
        +'<div class="mys-stagearea" id="mysStageArea">'
          + mysMapHtml() + mysCastHtml()
        +'</div>'
        + mysScriptHtml()
      +'</div>'
      + mysSideHtml()
    +'</div>'
    +'<div class="mys-meta">'
      +'<span>요원 <b>'+mysEsc(a && a.name ? a.name : '미등록')+'</b></span>'
      +'<span>등급 <b>'+mysEsc(rankName(a))+'</b></span>'
      +'<span>오염도 <b'+(a&&(a.suspended||a.lost)?' class="bad"':'')+'>'+taintOf(a)+'</b>'
        +'/'+((c.taintCap)||MYS_TAINT_LOST)+'</span>'
      +'<span>단계 <b>'+f.stage+'</b></span>'
      +'<span>단서 <b>'+mysClueIds().length+'</b></span>'
      + mysPartyBarHtml(false)
    +'</div>'
    + mysModalHtml();
  /* ★ 스크롤 위치는 갱신 '전에' 재어둔다. 바닥에 붙어 있었을 때만 다시 바닥으로 내린다 —
     무조건 내리면 위로 올려 앞 대사를 읽는 동안 새 줄이 하나 뜰 때마다 도로 끌려 내려간다.
     (재렌더는 이동·조사마다 일어나므로 사실상 못 읽는다) */
  const lgOld=el('mysLog');
  const pinned = !lgOld || (lgOld.scrollHeight - lgOld.scrollTop - lgOld.clientHeight) < 24;
  const keep = lgOld ? lgOld.scrollTop : 0;
  if(mysBody._mysLastHtml!==html){
    /* 입력 중인 값은 살린다 — 재렌더가 잦아서 이게 없으면 타이핑이 계속 날아간다 */
    const ci=el('mysChatInput'), mi=el('mysModalInput');
    const cv=ci?ci.value:'', mv=mi?mi.value:'';
    /* ★ 커서 자리도 같이 살린다. 값만 살리면 글자는 남고 커서만 끝으로 튀어서,
       파티원 위치 알림이 한 번 올 때마다 문장 중간을 고치던 손이 끊긴다.
       (타이핑 알림이 생기면서 재렌더가 잦아졌다 — 그전에도 있던 흠이 그때부터 아프다) */
    const cf=(ci && typeof document!=='undefined' && document.activeElement===ci);
    const cs=ci?ci.selectionStart:null, ce=ci?ci.selectionEnd:null;
    mysBody.innerHTML=html; mysBody._mysLastHtml=html;
    const ci2=el('mysChatInput');
    if(ci2){
      if(cv) ci2.value=cv;
      /* ★ 값이 비어 있어도 포커스는 살린다. 값이 있을 때만 살리면 전송 직후와 이동 직후처럼
         칸이 빈 순간마다 포커스가 죽어서, 한마디 칠 때마다 입력칸을 다시 눌러야 한다 —
         "이동할 때마다 채팅칸이 꺼진다"의 정체가 이 조건이었다. */
      if(cf){ try{ ci2.focus(); if(cv && cs!=null) ci2.setSelectionRange(cs, ce); }catch(_){} }
    }
    const mi2=el('mysModalInput'); if(mi2 && mv) mi2.value=mv;
  }
  mysRenderTyping();
  const lg=el('mysLog');
  if(lg) lg.scrollTop = pinned ? lg.scrollHeight : keep;
  mysBindField();
}

/* ── 부드러운 휠 스크롤 ──────────────────────────────────────────────
   기본 휠은 한 번에 100px 안팎을 순간이동시킨다. 기록 창 높이가 118px 뿐이라
   한 칸 굴리면 화면이 통째로 갈아치워져서, 어디를 읽고 있었는지가 매번 끊긴다.
   목표 위치만 누적해 두고 프레임마다 그쪽으로 조금씩 따라간다 —
   빠르게 여러 번 굴려도 목표가 더해질 뿐 애니메이션이 겹치지 않는다.
   ⚠ 재렌더가 노드를 갈아치우면 여기 붙은 값도 같이 사라진다. 그래도 되는 구조다 —
     다음 휠에서 현재 scrollTop 부터 다시 시작할 뿐이다. */
const MYS_WHEEL_STEP = 0.42;   // 브라우저 기본 이동량의 비율. 작을수록 잘게 내려간다
const MYS_WHEEL_EASE = 0.26;   // 프레임당 따라가는 비율
function mysSmoothWheel(box, dy){
  const max = Math.max(0, box.scrollHeight - box.clientHeight);
  if(max <= 0) return false;
  const from = (box._mysTo == null) ? box.scrollTop : box._mysTo;
  const to = Math.max(0, Math.min(max, from + dy));
  /* 이미 끝에 닿아 있고 더 그쪽으로 굴리는 중이면 창 전체 스크롤에 양보한다 */
  if(to === from) return false;
  box._mysTo = to;
  if(box._mysRaf) return true;
  const tick=()=>{
    if(box._mysTo == null){ box._mysRaf=0; return; }
    const d = box._mysTo - box.scrollTop;
    if(Math.abs(d) < 0.7){ box.scrollTop = box._mysTo; box._mysTo=null; box._mysRaf=0; return; }
    box.scrollTop += d * MYS_WHEEL_EASE;
    box._mysRaf = requestAnimationFrame(tick);
  };
  box._mysRaf = requestAnimationFrame(tick);
  return true;
}

/* 클릭·호버는 안정 부모(창 body)에 한 번만 위임 — 재렌더에도 살아 있다 */
function mysBindField(){
  if(!mysBody || mysBody._mysBound) return;
  mysBody._mysBound=true;

  mysBody.addEventListener('click', ev=>{
    if(!mysField()) return;
    const b=ev.target.closest && ev.target.closest('[data-act]');
    if(b){
      ev.preventDefault();
      const act=b.dataset.act;
      if(act==='search') mysSearchHere();
      else if(act==='roll')   mysDoRoll();
      else if(act==='lock')   mysOpenLock();
      else if(act==='submit'){ const i=el('mysModalInput'); mysSubmit(i?i.value:''); }
      else if(act==='say')    mysSay();
      /* ⚠ 위에서 preventDefault 를 부르므로 체크박스가 스스로 켜지지 않는다.
         상태는 mysNickOn 하나만 두고, 화면은 재렌더가 맞춘다(진입 경로 하나 규칙). */
      else if(act==='nick')   mysToggleNick();
      else if(act==='mute')   mysToggleMute();
      else if(act==='swap')   mysSwapAgent();
      else if(act==='item')   mysUseItem(b.dataset.item);
      else if(act==='dot')    mysPatternTap(+b.dataset.n);
      else if(act==='dotclear'){ mysModal.path=[]; mysRenderField(); }
      else if(act==='dotok')  mysPatternSubmit();
      else if(act==='noteok'){ const i=el('mysModalInput'); mysSaveFlagNote(i?i.value:''); }
      else if(act==='notedel') mysDropFlagNote();
      else if(act==='accuse')  mysOpenAccuse();
      /* ★ 고른 이름을 그대로 제출로 흘린다 — 정답 판정은 mysSubmit 하나뿐이다 */
      else if(act==='pick')    mysSubmit(b.dataset.name);
      else if(act==='leave')   mysLeaveField();
      else if(act==='skipbrief') mysSkipBriefing();
      else if(act==='logsave'){ mysExportLog(); mysCloseModal(); mysAbandonCase(); }
      else if(act==='logskip'){ mysCloseModal(); mysAbandonCase(); }
      else if(act==='ready'){ mysNetSend({ t:'ready', spot:mysGateAsk?mysGateAsk.spotId:'' });
                              mysGateAsk=null; mysFieldMsg('레디를 보냈다.'); }
      else if(act==='resetok')  mysDoReset();
      else if(act==='resetno')  mysCloseModal();
      else if(act==='takeask'){ const v=mysAsk?mysAsk.v:''; if(v) mysSubmit(v); }
      else if(act==='party')   mysOpenParty();
      else if(act==='partyin'){ const i=el('mysModalInput'); mysJoinCode(i?i.value:''); }
      else if(act==='partynew') mysJoinCode(mysMakeCode());
      else if(act==='partyout')   mysPartyLeave();
      else if(act==='partyready')  mysToggleReady();
      else if(act==='partylock')   mysLockParty();
      else if(act==='partyedit')   mysUnlockParty();
      /* act==='cast' 는 하는 일이 없다 — 목록은 CSS 호버로 뜬다.
         그래도 data-act 를 달아둔 이유는 여기서 걸러야 장면 중에 눌러도 대사가 안 넘어가기 때문이다. */
      return;
    }
    /* ★ 장면 중 클릭은 대사 넘기기다. 다만 채팅칸·버튼 위에서는 넘기지 않는다 —
       NPC 대사를 듣는 동안 옆에서 연기를 치는 게 이 게임의 절반인데,
       입력칸을 누르는 순간 대사가 넘어가 버리면 그걸 아예 못 한다. */
    if(mysInScene()){
      const inbar = ev.target.closest && ev.target.closest('.mys-inbar, .mys-chatopt, .mys-cast');
      if(inbar) return;
      ev.preventDefault(); mysSceneNext(); return;
    }
    if(mysModal && ev.target.closest && ev.target.closest('#mysModal')
       && !ev.target.closest('.box')){ mysCloseModal(); return; }
    /* ★ 좌클릭으로는 이동하지 않는다. 이동은 방향키 전용.
       클릭 이동을 두면 조사·잠금 버튼을 누르려다 지도를 스쳐 엉뚱한 칸으로 가고,
       재렌더가 잦은 화면에서 그 오작동이 특히 잦다. */
  });

  /* 우클릭 = 깃발(꽂기·내리기). Shift+우클릭 = 메모.
     ★ 꽂는 것 자체는 한 동작으로 남겨둔다 — 메모를 필수로 만들면 "일단 찍어두기"가 느려지고,
       급할 때 쓰라고 만든 물건이 급할 때 못 쓰는 물건이 된다. */
  mysBody.addEventListener('contextmenu', ev=>{
    const cell=ev.target.closest && ev.target.closest('i.cl[data-x]');
    if(!cell) return;
    ev.preventDefault();
    const x=+cell.dataset.x, y=+cell.dataset.y;
    if(ev.shiftKey) mysFlagNote(x,y); else mysSetFlag(x,y);
  });

  /* ⚠ passive:false — preventDefault 를 부르려면 반드시 명시해야 한다.
     기본값(브라우저에 따라 passive)이면 기본 스크롤이 그대로 같이 일어나 두 배로 튄다. */
  mysBody.addEventListener('wheel', ev=>{
    const box = ev.target.closest && ev.target.closest('.mys-log, .mys-clues, .mys-items');
    if(!box) return;
    /* deltaMode 1=줄 단위, 2=페이지 단위. px 로 환산하지 않으면 3px 씩 기어간다. */
    const unit = ev.deltaMode===1 ? 16 : (ev.deltaMode===2 ? box.clientHeight : 1);
    const dy = ev.deltaY * unit * MYS_WHEEL_STEP;
    if(mysSmoothWheel(box, dy)) ev.preventDefault();
  }, { passive:false });

  /* 번호로 칠 때도 자릿수가 차면 확인 없이 판정한다 — 점으로 찍는 쪽과 손이 같아야 한다.
     ⚠ 재렌더가 입력칸을 갈아치우므로 리스너는 안정 부모(창 body)에 위임한다. */
  mysBody.addEventListener('input', ev=>{
    /* 채팅칸에 손이 닿는 동안 파티원 화면에 '타이핑 중'이 뜬다 */
    if(ev.target && ev.target.id==='mysChatInput'){ mysTypingPing(ev.target.value); return; }
    if(!ev.target || ev.target.id!=='mysModalInput') return;
    if(!mysModal || mysModal.type!=='pattern') return;
    const d=mysItemDef(mysModal.item);
    const need=((d && d.lock && d.lock.pattern) || []).length;
    const v=String(ev.target.value||'').replace(/[^1-9]/g,'');
    if(need && v.length>=need) mysPatternSubmit(v);
  });

  mysBody.addEventListener('keydown', ev=>{
    if(ev.key!=='Enter') return;
    const id=ev.target && ev.target.id;
    /* ★ 같은 입력칸이 두 잠금에서 쓰인다. 어느 쪽인지 보고 보내야 한다 —
       패턴 팝업에서 Enter 를 쳤는데 단계 답안 제출로 가면 "574269 오답" 이 뜬다. */
    if(id==='mysModalInput'){
      ev.preventDefault();
      if(mysModal && mysModal.type==='pattern') mysPatternSubmit();
      else if(mysModal && mysModal.type==='note') mysSaveFlagNote(ev.target.value);
      else if(mysModal && mysModal.type==='party') mysJoinCode(ev.target.value);
      else mysSubmit(ev.target.value);
    }
    else if(id==='mysChatInput'){
      ev.preventDefault();
      if(String(ev.target.value||'').trim()) return mysSay();
      /* ★ '빈 칸'의 Enter 는 현장 조작이다 — 방향키(빈 칸=이동)와 같은 규칙.
         포커스가 입력칸에 늘 살아 있게 되면서, 여기서 안 받으면 대사 넘기기와
         조사를 키보드로는 영영 못 하게 된다(입력칸이 Enter 를 다 먹으므로). */
      if(mysSoftScene()) mysSceneState=null;
      if(mysInScene())      mysSceneNext();
      else                  mysSearchHere();
    }
  });

  /* 지도 호버 시 스탠딩 숨김. 장면 중에는 숨기지 않는다 —
     대사 중에 스탠딩이 깜빡이면 장면이 끊긴다. */
  mysBody.addEventListener('mouseover', ev=>{
    if(mysInScene() && !mysSoftScene()) return;
    const inMap = ev.target.closest && ev.target.closest('#mysMap');
    if(inMap && !mysStandHidden){ mysStandHidden=true; mysBody._mysLastHtml=''; mysRenderField(); }
  });
  mysBody.addEventListener('mouseleave', ev=>{
    if(mysInScene() && !mysSoftScene()) return;
    if(ev.target && ev.target.id==='mysMap' && mysStandHidden){
      mysStandHidden=false; mysBody._mysLastHtml=''; mysRenderField(); }
  }, true);
}

/* ── 채팅 ────────────────────────────────────────────────────────────
   한 줄에 세 가지가 섞여 들어온다. 파서를 한 곳에 모아둔다 —
   흩어놓으면 "지문 안에서 표정 명령을 쓰면 어떻게 되나" 같은 걸 매번 다시 정한다.

     //…//   행동지문. 이름표 없이 기울임체로 흐른다
     /당황   표정 명령. 스탠딩만 바꾸고 채팅에는 남기지 않는다
     그 외    대사

   ★ 닉네임 체크는 '말하는 사람'만 바꾼다. 캐릭터 이입을 깨지 않으려고 만든 것이므로
     표시도 캐릭터 대사보다 약해야 한다 — 우측 정렬 · 기울임 · 흐린 색. */
let mysNickOn = false;

/* 표정 명령이 남기는 지문 문구. '웃음한다'처럼 읽히지 않게 동사를 따로 둔다.
   ⚠ STAND_LABEL(표정 이름)과 섞지 말 것 — 등록 창의 라벨과 기록 창의 문장은 쓰임이 다르다. */
const STAND_ACT = { normal:'표정을 지운다', talk:'입을 연다', think:'생각에 잠긴다',
                    smile:'웃는다', angry:'분노한다', sad:'슬퍼한다',
                    fluster:'당황한다', surprise:'놀란다' };
/* 받침 유무로 이/가를 고른다. 한글이 아니면 '이(가)'로 둔다. */
function mysJosaIGa(name){
  const s=String(name||''); const ch=s.charCodeAt(s.length-1);
  if(!(ch>=0xAC00 && ch<=0xD7A3)) return s+'이(가)';
  return s + (((ch-0xAC00)%28) ? '이' : '가');
}

/* 표정 명령 — 한글 라벨(당황·분노…)로 받는다. 영문 키를 외우게 하지 않는다. */
function mysExprCmd(word){
  const w=String(word||'').trim();
  if(!w) return null;
  if(STAND_KEYS.indexOf(w)>=0) return w;                      // /angry 도 받아준다
  const hit=STAND_KEYS.find(k=>STAND_LABEL[k]===w);
  return hit || null;
}

/* 한 줄을 조각으로 쪼갠다 — 대사와 지문을 섞어 쓸 수 있어야 한다.
     그렇군. //턱을 만진다// 그럼 다시 물어보지. /고민
   ★ 지문을 따로 한 줄 더 치게 만들면 아무도 안 쓴다. 한 호흡에 들어가야 연기가 된다.
   ★ 표정 명령은 조각이 아니라 줄 전체에 걸린다. 한 줄에 여러 개면 마지막 것이 남는다 —
     "표정을 바꾸고 말한다"가 자연스러운 순서라 앞의 것을 남기면 어긋난다.
   ⚠ 닫히지 않은 //는 지문으로 보지 않는다. 오타로 대사가 통째로 사라지면 안 된다. */
function mysParseChat(v){
  const out={ expr:null, parts:[] };
  const src=String(v==null?'':v);
  const pushSay=t=>{
    /* 대사 조각에서 표정 명령만 걷어낸다. 남은 말이 있으면 그게 대사다.
       ★ 앞에 띄어쓰기를 요구하지 않는다. 예전엔 (^|\s) 를 붙여 뒀는데, 그래서
         "화가 난다/분노" 처럼 붙여 친 명령이 통째로 안 먹고 대사에 '/분노' 가 그대로 찍혔다 —
         화면에서는 "명령이 아무 반응이 없다"로 보인다.
       ⚠ 느슨하게 풀어도 문장 속 슬래시는 안전하다. 걷어내는 것은 mysExprCmd 가 아는
         여덟 낱말뿐이라, "회의는 3/4 에" 의 '4' 는 표정이 아니므로 글자로 남는다.
       ⚠ 앞의 공백까지 같이 먹는다(\s*). 안 그러면 "그렇군 /분노 그럼" 이 두 칸 띄어진다. */
    const rest=t.replace(/\s*\/([^\s/]+)/g, (m, w)=>{
      const k=mysExprCmd(w);
      if(!k) return m;             // 표정이 아니면 그냥 글자다(날짜 3/4 같은 것)
      out.expr=k; return '';
    }).trim();
    if(rest) out.parts.push({ k:'say', t:rest });
  };
  let i=0;
  const re=/\/\/([\s\S]*?)\/\//g;
  let m;
  while((m=re.exec(src))){
    pushSay(src.slice(i, m.index));
    const t=m[1].trim();
    if(t) out.parts.push({ k:'act', t:t });
    i=re.lastIndex;
  }
  pushSay(src.slice(i));
  return out;
}

/* 오류 탈출 명령. 받는 꼴은 슬래시-별표로 감싼 '초기화' 한 가지이고, 앞뒤 공백만 씻는다.
   ★ 여기서는 묻기만 한다. 되돌릴 수 없는 일을 한 줄 쳤다고 그 자리에서 해버리면
     오타 한 번에 저장이 통째로 날아간다.
   돌려주는 값 — 명령으로 먹었으면 true(대사로는 흘리지 않는다). */
const MYS_RESET_RE = /^\/\*\s*초기화\s*\*\/$/;
function mysResetCmd(v){
  if(!MYS_RESET_RE.test(String(v||'').trim())) return false;
  mysModal={ type:'reset' };
  mysRenderField();
  return true;
}
/* ── 전체 초기화 ─────────────────────────────────────────────────────
   ★ 저장(tw.mys.v1)을 통째로 지우고 기본값으로 다시 세운다 — 요원·클리어 기록·단서 조각·
     진행 중 사건까지 전부. 저장이 어딘가 깨져서 무엇을 해도 같은 자리에 갇힐 때
     빠져나오는 마지막 수단이라, 반쯤만 지우면 정작 깨진 값이 그대로 남는다.
   ⚠ 파티만 남긴다. 사건을 접는 것과 파티를 나가는 것은 다른 일이고(교훈 47),
     여기서 방까지 나가면 한 사람 화면이 꼬였다고 파티가 통째로 흩어진다.
     전송선(mysNet·mysRoom·mysMe)은 저장이 아니라 모듈 상태라 지워지지 않는다. */
function mysWipeSave(){
  mysBgmStop();
  mysSceneState=null; mysSceneQueue=[]; mysModal=null; mysPending=null;
  mysReady=null; mysGateAsk=null; mysAsk=null; mysLogsClear();
  _mysGridCache=null; mysUnbindKeys();
  /* ★ 지우는 것은 **사건 쪽뿐이다.** 요원 등록(이름·나이·성향·소속·증명사진·스탠딩·적성)은 남는다.
     ⚠ 그래서 tw.mys.v1 을 통째로 지우지 않는다. 지우면 로더가 '새로 깐 상태'로 다시 세우면서
       캐릭터세팅 이관(mysMigrateFromChar)이 한 번 더 돌아 **이름·증명사진만 되살아나고
       스탠딩만 사라진다.** "초기화하면 스탠딩만 지워진다"의 정체가 이 재이관이었다.
     ⚠ mysImgClearAll 도 부르지 않는다 — 그림 칸을 비우면 남기기로 한 스탠딩이 표만 남고
       다음에 켤 때 통째로 깨진다. */
  MYS.field=null; MYS.cleared=[]; MYS.fragments=0;
  /* 브리핑 기록도 같이 턴다 — 처음부터 다시 하는 것이므로 브리핑도 처음부터다.
     ⚠ 안 털면 초기화 직후 착수에 [건너뛰기]가 뜨고, 그건 '초기화'라는 말과 어긋난다. */
  MYS.briefed={};
  /* 정화 시스템은 클리어 보상이다(단서 조각과 같은 자리에서 나온다) — 클리어 기록을 지우면 같이 간다 */
  MYS.purifier=false;
  /* 오염도·정지·Lost 는 등록 정보가 아니라 사건이 남긴 흔적이다. 같이 턴다 —
     ⚠ 안 털면 Lost 인 요원이 그대로 남는데, 그를 되살릴 정화 시스템은 방금 지워져
       오류를 빠져나오려던 사람이 못 쓰는 요원만 들고 갇힌다. */
  (MYS.agents||[]).forEach(a=>{ if(!a) return; a.taint=0; a.suspended=false; a.lost=false; });
  /* ★ 파티는 저장에서 베껴 오지 않고 **살아 있는 방**을 다시 적는다.
     저장이 깨져서 부르는 명령이므로, 그 저장에 적힌 방을 믿으면 안 된다.
     지금 붙어 있는 방이 사실이다(mysSaveParty 가 mysNetOn 을 본다). */
  MYS.party=null;
  mysSaveParty();                // 이 안에서 mysSave 까지 한다
  mysRender();
}
/* 내가 눌러서 초기화한다. ★ 파티원 화면도 같이 지운다 —
   한 사람만 로비로 나오면 나머지는 없는 사람이 서 있는 지도를 계속 보게 된다.
   ⚠ 받는 쪽은 다시 묻지 않는다. 물어봐야 무엇에 대한 확인인지 알 수가 없고,
     한 명이라도 안 누르면 그 사람만 옛 사건에 남는다. */
function mysDoReset(){
  const a=agent();
  mysNetSend({ t:'reset', w:(a && a.name) || '요원' });
  mysWipeSave();
  mysFieldMsg('■ 사건을 초기화했다 — 진행·클리어 기록·단서 조각까지. 요원 등록과 파티는 그대로다.');
}
function mysSay(){
  const i=el('mysChatInput'); if(!i) return;
  const v=String(i.value||'').trim(); if(!v) return;
  i.value='';
  /* 말이 나갔으면 '치는 중'은 끝났다. 만료(6초)를 기다리면 이미 뜬 대사 밑에
     그 사람이 아직 치고 있다는 줄이 남아 붙는다. */
  mysTypAt=0; mysNetSend({ t:'typ', on:false });
  const a=agent();
  const who = mysNickOn ? mysNickName() : ((a && a.name) || '나');

  const p=mysParseChat(v);
  /* ── 초기화 명령(슬래시-별표로 감싼 '초기화') — 오류 탈출구 ──────────
     ★ 진행 중인 사건을 접고 로비로 돌아간다. 화면이 어딘가에서 걸려 아무 버튼도 안 먹을 때,
       창을 껐다 켜도 저장된 사건이 그대로 다시 열려 같은 자리에 갇히는 것을 푸는 유일한 길이다.
     ⚠ 파티는 건드리지 않는다. 사건을 접는 것과 파티를 나가는 것은 다른 일이다 —
       여기서 방까지 나가면 확정된 파티가 사건 하나 때문에 통째로 흩어진다.
     ⚠ 단서가 통째로 사라지는 명령이다. 그래서 표정 명령처럼 짧게 두지 않고 감싼 꼴로 받는다 —
       한두 글자면 오타 한 번에 사건이 날아간다. */
  if(mysResetCmd(v)) return;
  /* 줄 전체가 슬래시 명령 하나인데 표정이 아니면 오타로 본다.
     ★ 문장 속의 슬래시(회의는 3/4에)는 그냥 글자로 남긴다 — 그건 명령이 아니다.
       줄 전체가 /단어 하나일 때만 "명령을 치려다 틀렸다"로 읽는 게 맞다. */
  if(/^\/[^\s/]+$/.test(v) && !p.expr){
    mysFieldMsg('그런 표정은 등록되어 있지 않다. ('+STAND_KEYS.map(k=>STAND_LABEL[k]).join(' · ')+')', true);
    if(mysBody) mysBody._mysLastHtml='';
    mysRenderField(); return;
  }
  if(p.expr){ mysSetSceneExpr(p.expr); }
  /* ── 표정 자동 ────────────────────────────────────────────────────
     표정 명령을 안 쳤으면 줄의 생김새가 표정을 정한다 — 말이 섞여 있으면 '대화',
     지문만이면 '평상'.
     ★ 한마디마다 /대화 를 치게 만들면 아무도 안 친다. 그러면 스탠딩은 사건 내내
       평상 한 장으로 굳고, 표정을 여덟 장 그린 보람이 화면에 안 나온다.
     ★ 손으로 친 표정은 언제나 이긴다(위 줄). 자동은 '안 골랐을 때의 기본값'이다.
     ⚠ 기록에는 남기지 않는다. 자동으로 고른 것까지 지문으로 적으면 한마디 칠 때마다
       '입을 연다'가 따라붙어 기록 창이 반쯤 그 문장으로 찬다.
     ⚠ 닉네임 발화는 캐릭터가 하는 말이 아니다(체크박스의 뜻이 그것이다) —
       그때는 잡아둔 표정을 그대로 둔다. */
  else if(p.parts.length && !mysNickOn){
    mysSetSceneExpr(p.parts.some(seg=>seg.k==='say') ? 'talk' : 'normal');
  }
  /* ★ 지문이 단독이면 이름을 붙인다 — 대사와 같은 줄 형태라야 누가 한 짓인지 읽힌다.
     대사와 섞여 있으면 붙이지 않는다. 한 호흡 안에서 이름이 세 번 반복되면 읽기가 끊긴다. */
  /* ★ 대사와 지문이 한 호흡에 들어오면 한 줄로 붙인다 — 지문은 괄호로 감싼다.
     예전엔 조각마다 줄을 갈랐는데, 그러면 "그렇군." 아래에 "턱을 만진다"가 따로 떨어져
     한 호흡이 두 사람 말처럼 읽혔다. 지문은 대사와 같은 줄에 있어야 연기가 된다.
   ⚠ 지문만 친 경우는 예전 그대로 이름표 붙은 기울임 줄이다. 그건 대사가 아니라 행동이다. */
  const solo = (p.parts.length===1 && p.parts[0].k==='act');
  if(solo){
    const seg=p.parts[0];
    /* ★ 조각을 같이 남긴다. 이름표([이름] :)는 대사 줄과 똑같이 보이고, 지문 내용만
       괄호를 씌워 회색 기울임으로 물러난다 — 줄 전체가 기울면 이름표까지 딴 사람 말처럼 읽힌다. */
    const segs=[{ k:'act', t:seg.t }];
    mysLog(mysNickOn ? 'actnick' : 'act', seg.t, who, true, segs);
    mysNetSend({ t:'log', k:'act', x:seg.t, w:who, s:segs });
  } else if(p.parts.length){
    const one=p.parts.map(seg=> seg.k==='act' ? '('+seg.t+')' : seg.t).join(' ');
    const segs=p.parts.map(seg=>({ k:seg.k, t:seg.t }));
    mysLog(mysNickOn ? 'nick' : 'me', one, who, false, segs);
    /* ★ 채팅은 전원에게 간다. 남의 화면에서는 '내 대사'(lg-me)가 아니라
       '파티원 대사'(lg-mate)로 흘러야 한다 — 색이 곧 누구 말인지다.
       ⚠ 조각(s)도 같이 보낸다. 안 보내면 남의 화면에서만 지문이 통짜 글씨로 찍힌다.
       ★ 표정 이름(e)만 실어 보낸다 — 그림은 합류할 때 보낸 표(t:'face')에서 고른다.
         URL 을 대사마다 실으면 한마디에 수백 자가 붙는다. */
    mysNetSend({ t:'log', k:'mate', x:one, w:who, s:segs, e:mysExprKey });
  }
  /* 표정 명령을 지문으로 남기는 것은 **명령만 친 줄**뿐이다.
     ★ 대사와 같이 쳤으면 남기지 않는다 — 한 호흡으로 친 한 줄인데 기록에는
       '시온이 분노한다.' 가 따로 한 줄 서고 그 밑에 대사가 붙어, 연기가 두 동강 난다.
       그때 명령이 해야 할 일은 스탠딩을 바꾸는 것 하나이고, 화가 났다는 건 이미 대사가 말한다.
     ⚠ 명령만 친 줄에서까지 지우지는 말 것. 그 줄은 대사도 지문도 안 남기므로,
       이걸 지우면 화면에 아무 자국이 없어 '먹었는지 아닌지' 를 알 길이 없다. */
  if(p.expr && !p.parts.length){
    const line=mysJosaIGa(who)+' '+(STAND_ACT[p.expr]||STAND_LABEL[p.expr]+'한다')+'.';
    mysLog(mysNickOn?'actnick':'act', line, who, true);
  }
  /* ★ 내 대사도 스크립트 박스에 선다. 내가 친 말만 오른쪽 구석 기록 창으로 빠지면
     연기하는 사람만 화면 밖에 있게 된다 — 스탠딩도 이때 같이 올라온다.
   ⚠ 다만 이건 말풍선이지 장면이 아니다. 걸음도, 조사도 막지 않는다(mysChatScene).
     조사 중이면 아예 안 뜬다 — 방금 기록 창에 남겼으니 사라지는 말은 없다. */
  if(p.parts.length){
    const say=p.parts.map(seg=> seg.k==='act' ? '('+seg.t+')' : seg.t).join(' ');
    mysChatScene(who, { t:say, seg:p.parts.map(seg=>({ k:seg.k, t:seg.t })) }, true);
  }

  if(mysBody) mysBody._mysLastHtml='';
  mysRenderField();
  /* ★ 말을 보낸 뒤에도 입력칸은 켜져 있어야 한다 — 연달아 치는 게 채팅이다.
     [전송] 버튼으로 보내면 포커스가 버튼에 가 있어서, 렌더의 복원(포커스가 있던 경우만)
     으로는 안 살아난다. 여기서 한 번 더 쥐여준다. */
  const ni=el('mysChatInput'); if(ni){ try{ ni.focus(); }catch(_){} }
}

/* 닉네임 — 마이홈이 주면 그걸 쓰고, 없으면 저장해 둔 값을 쓴다.
   ⚠ 요원 이름으로 떨어지면 안 된다. 그러면 체크박스가 아무것도 안 하는 것처럼 보인다. */
function mysNickName(){
  try{ if(typeof getMyNickname==='function'){ const n=getMyNickname(); if(n) return String(n).slice(0,16); } }catch(_){}
  return String((MYS && MYS.nick) || '나').slice(0,16);
}
function mysToggleNick(){
  mysNickOn=!mysNickOn;
  if(mysBody) mysBody._mysLastHtml='';
  mysRenderField();
}

/* 장면 중 스탠딩 표정 — 장면이 아니면 다음 장면까지 들고 있는다.
   ⚠ 스탠딩은 장면 중에만 화면에 뜬다. 장면 밖에서 바꾼 표정을 버리면
     "대화 들어가기 전에 표정을 잡아두는" 쓰임이 통째로 사라진다. */
let mysExprKey='normal';
function mysSetSceneExpr(key){
  mysExprKey = (STAND_KEYS.indexOf(key)>=0) ? key : 'normal';
  if(mysBody) mysBody._mysLastHtml='';
}

/* 방향키 이동 — ⚠ document 리스너는 mysCleanup 에서 반드시 떼야 한다(함정 #4의 형제).
   창이 닫혀 있는데 방향키가 살아 있으면 바탕화면 조작이 게임으로 새어 들어간다. */
let mysKeyHandler=null;
function mysBindKeys(){
  if(mysKeyHandler) return;
  mysKeyHandler=ev=>{
    if(!mysField() || !mysBody || !mysBody.offsetParent) return;
    if(ev.key==='Escape'){ if(mysModal){ ev.preventDefault(); mysCloseModal(); } return; }
    if(ev.target && (ev.target.tagName==='INPUT' || ev.target.tagName==='TEXTAREA')){
      /* ★ 채팅칸이 '비어 있을 때'의 방향키는 이동이다 — 입력칸을 떠나지 않고 걷고,
         멈춰 서면 그대로 친다. 이게 없으면 걸으려고 칸 밖을 누르고, 치려고 칸을 다시 누른다.
         ⚠ 글자가 한 자라도 있으면 방향키는 커서 이동으로 돌려준다. 문장 중간을 고치는
           중에 캐릭터가 걸어가 버리면 그게 더 큰 사고다.
         ⚠ Enter·Space 는 넘기지 않는다 — 채팅칸의 Enter 는 전송이다(mysBindField). */
      const chatWalk = ev.target.id==='mysChatInput' && !String(ev.target.value||'')
        && (ev.key==='ArrowUp'||ev.key==='ArrowDown'||ev.key==='ArrowLeft'||ev.key==='ArrowRight');
      if(!chatWalk) return;
    }
    if(mysModal) return;
    if(ev.key==='Enter' || ev.key===' '){
      ev.preventDefault();
      /* ★ 말풍선은 Enter 를 먹지 않는다. 남이 한마디 쳤다고 조사 버튼이 한 번 죽으면
         "왜 안 눌리지"가 된다 — 풍선은 비키고 원래 하려던 일이 그대로 일어난다. */
      if(mysSoftScene()) mysSceneState=null;
      if(mysInScene())      mysSceneNext();   // 대사 넘기기
      else if(mysPending)   mysDoRoll();      // 주사위
      else                  mysSearchHere();
      return;
    }
    const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[ev.key];
    if(d){ ev.preventDefault(); const p=mysXY(mysField().pos); mysMove(p.x+d[0], p.y+d[1]); }
  };
  document.addEventListener('keydown', mysKeyHandler);
}
function mysUnbindKeys(){
  if(!mysKeyHandler) return;
  document.removeEventListener('keydown', mysKeyHandler);
  mysKeyHandler=null;
}
/* 이 사건에 들어갈 자격이 있는가. ★ 앞 사건을 안 깬 사람은 못 들어간다 —
   003 을 여는데 001 만 깬 사람이 섞이면 그 사람에게는 사건 절반이 처음 듣는 얘기다. */
function mysCaseOk(caseId, cleared){
  const c=MYS_CASES[caseId]; if(!c) return true;
  const done=cleared || (MYS.cleared||[]);
  return (c.requires||[]).every(r=>done.indexOf(r)>=0);
}
/* 파티장이 착수를 누를 수 있는가. 못 누르면 '누가 왜' 를 돌려준다 —
   ⚠ 이유를 안 돌려주면 버튼이 그냥 안 먹는 것처럼 보인다. */
function mysPartyStartBlock(caseId){
  if(!mysNetOn() || !mysLocked) return '';
  if(!mysIsLeader()) return '착수는 파티장이 한다';
  const bad=mysNetPeers().filter(p=>!mysCaseOk(caseId, p.cleared||[]));
  if(bad.length) return bad.map(p=>p.name).join(' · ')+' — 앞 사건을 아직 안 끝냈다';
  const busy=mysNetPeers().filter(p=>p.busy);
  if(busy.length) return busy.map(p=>p.name).join(' · ')+' — 다른 사건 진행 중';
  return '';
}
function mysStartCase(id){
  const c=MYS_CASES[id]; if(!c) return;
  _mysGridCache=null;                                   // 사건이 바뀌면 지도 캐시부터 버린다
  mysLogsClear();                                       // 새 사건 = 새 기록. 앞 사건 대사를 물려받지 않는다
  MYS.field=mysNewField(id);
  if(MYS.field) mysReveal(MYS.field, MYS.field.pos);    // ★ 대입한 뒤에 공개한다
  /* 착수하면 곧바로 지도로 떨어진다. 기록 창 맨 위에 상황을 한 번 남겨두지 않으면
     플레이어는 자기가 어디에 왜 서 있는지 모르는 채로 방향키부터 누르게 된다.
     ★ 기록은 이제 껐다 켜도 남는다(tw.mys.log). 그래도 머리말(c.brief)은 그대로 둔다 —
       기록 창은 60줄에서 잘려 위로 밀려 올라가므로, 한참 뒤에 켠 사람에게는 안 보인다. */
  if(c.intro) mysLog('sys', '■ '+c.id+' '+c.title+' — '+c.intro);
  mysBgmPlay(c.bgm);
  /* ★ 브리핑은 지도를 띄운 뒤에 얹는다. 장면 중에는 이동이 막히므로
     플레이어는 다 듣고 나서야 걷기 시작한다 — 그게 튜토리얼에 필요한 순서다.
     ★ tag:'briefing' — 이 표식 하나로 [건너뛰기] 버튼과 시청 기록이 붙는다.
       kind 로 가르지 않는 이유는 kind 가 색·이름표를 정하기 때문이다(지부장은 NPC 대사다). */
  if(c.briefing && c.briefing.length){
    mysScene(c.briefingWho || '수사국 지부장', c.briefing);
    if(mysSceneState) mysSceneState.tag='briefing';
  }
  mysSave(); mysRenderField(); mysBindKeys();
}
/* 게시판의 [착수]. ★ 확정된 파티에서는 파티장만 누르고, 전원이 같이 들어간다. */
function mysBeginCase(id){
  if(!mysCaseOk(id)) return mysFieldMsg('앞 사건을 먼저 끝내야 한다.', true);
  const blk=mysPartyStartBlock(id);
  if(blk) return mysFieldMsg('착수할 수 없다 — '+blk, true);
  if(mysNetOn() && mysLocked) mysNetSend({ t:'start', caseId:id });
  mysStartCase(id);
}
/* ⚠ 사건을 접는 것과 파티를 나가는 것은 다른 일이다. 여기서 방까지 나가면
   확정된 파티가 사건 하나에 묶이게 되고, 로비로 나온 순간 팀이 흩어진다.
   파티에서 나가는 입구는 mysPartyLeave 하나다. */
function mysAbandonCase(){
  mysBgmStop(); mysSceneQueue=[];
  MYS.field=null; _mysGridCache=null; mysUnbindKeys();
  /* ★ 현장을 뜨면 그 사건의 대화 기록도 같이 접는다. 남겨두면 다음 사건의 기록 창이
     지난 사건의 대사로 시작하고, 내보내기가 두 사건을 한 파일에 섞어 담는다. */
  mysLogsClear();
  mysSave(); mysRender();
}
/* 📋 수사국으로 돌아가기 — 지우기 전에 한 번 묻는다.
   ★ 되돌릴 수 없는 일은 묻고 한다(초기화와 같은 규칙). 다 읽고 나간 사람에게는
     한 번 더 누르는 일이지만, 안 물으면 한 판의 대화가 말없이 사라진다.
   ⚠ 기록이 없으면 묻지 않는다. 물을 것이 없는데 묻는 팝업은 그냥 걸림돌이다. */
function mysLeaveField(){
  if(!mysLogs.length) return mysAbandonCase();
  mysModal={ type:'savelog' };
  if(mysBody) mysBody._mysLastHtml='';
  mysRenderField();
}

/* ═══════════════════════════ 외부 공개 API ═══════════════════════════
   나중에 대화·사건 스크립트에서 스탠딩을 갈아끼울 때 쓴다.
   ★ 표정 조회는 전부 standUrl()을 통과하므로 없는 표정을 지정해도 평상으로 떨어진다.
     즉 스크립트가 mysSetExpression('angry')를 불렀는데 분노 그림이 없어도 화면이 비지 않는다. */
window.MYSTERY_AU = {
  version: 1,
  expressions: STAND_KEYS.slice(),
  getAgent(i){ return MYS ? agent(i) : null; },
  /* 등급·침식 단계는 사건일지 쪽에서도 쓰게 될 값이라 밖으로 연다 */
  rankOf(a){ return MYS ? rankName(a) : null; },
  taintVeil(a){ return MYS ? taintVeil(a) : 0; },
  taintVeilStand(a){ return MYS ? taintVeilStand(a) : 0; },
  getPost(){ return MYS ? MYS.post : null; },
  /* 지정한 표정의 스탠딩 URL. 없으면 평상, 평상도 없으면 null */
  standUrl(key, i){ return MYS ? standUrl(key, i) : null; },
  /* 등록 창에 떠 있는 큰 스탠딩을 바꾼다(대화 연출용 미리보기) */
  setExpression(key){
    if(!MYS) return null;
    previewKey = STAND_KEYS.indexOf(key)>=0 ? key : 'normal';
    const big=el('mysStand'); const u=standUrl(previewKey, editSlot);
    if(big){ const img=big.querySelector('img'); if(img && u) img.src=u; }
    return u;
  },
  /* ── 현장(지도) ──
     사건 스크립트에서 현재 위치·단서 보유를 물어볼 때 쓴다. */
  cases(){ return Object.keys(MYS_CASES); },
  startCase(id){ if(!MYS) return false; mysStartCase(id); return !!mysField(); },
  abandonCase(){ if(MYS) mysAbandonCase(); },
  getField(){ const f=mysField(); return f ? JSON.parse(JSON.stringify(f)) : null; },
  hasClue(id){ return mysGotClue(id); },
  /* 우측 목록에 실제로 보이는 단서만 — 잡담 재심문(noclue)은 빠진다 */
  _clues(){ return mysClueIds(); },
  /* ★ 검증기(sim-mys-map.js)가 쓰는 순수 조회 — MYS 상태가 없어도 동작해야 한다.
     지도 데이터는 상수이므로 로드 직후에도 읽을 수 있다. */
  _caseData(id){ const c=MYS_CASES[id]; return c ? JSON.parse(JSON.stringify(c)) : null; },
  _zones(){ return JSON.parse(JSON.stringify(MYS_ZONES)); },
  /* 검증기가 실제 이동·조사·제출을 굴려보기 위한 조작구. 화면 없이 동작한다.
     ⚠ 게임 로직을 여기에 넣지 말 것 — 전부 위임만 한다. */
  _moveTo(k){ const p=mysXY(k); mysMove(p.x, p.y); const f=mysField(); return f?f.pos:null; },
  _search(){ mysSearchHere(); const f=mysField(); return f?(f.got||[]).slice():[]; },
  _submit(v){ mysSubmit(v); const f=mysField(); return f?f.stage:null; },
  _taint(){ const a=agent(); return a?taintOf(a):0; },
  /* 주사위를 갈아끼운다 — 검증기가 결과를 고정해 시나리오를 재현하기 위한 것.
     인자 없이 부르면 원래 Math.random 으로 되돌린다. */
  _setRng(fn){ mysRng = (typeof fn==='function') ? fn : (()=>Math.random()); },
  _target(path, dc){ return mysTarget(path, dc); },
  _canRoll(path, dc){ return mysCanRoll(path, dc); },
  _grade(roll, target){ return mysGrade(roll, target); },
  /* 조사·문은 이제 2단계다 — _search()로 굴림을 세우고 _roll()로 굴린다 */
  _pending(){ return mysPending ? { kind:mysPending.kind, label:mysPending.label } : null; },
  _roll(){ mysDoRoll(); const f=mysField(); return f?(f.got||[]).slice():[]; },
  _logs(){ return mysLogs.slice(); },
  _scene(){ return mysSceneState ? { who:mysSceneState.who, i:mysSceneState.i,
                                     n:mysSceneState.lines.length,
                                     kind:mysSceneState.kind||'', soft:!!mysSceneState.soft,
                                     tag:mysSceneState.tag||'' } : null; },
  _sceneNext(){ mysSceneNext(); },
  /* 브리핑 건너뛰기 — 자격(2회차인가)과 실행을 따로 연다.
     한 번 완주한 뒤에야 _canSkipBrief() 가 참이 되는 것이 이 기능의 전부다. */
  _canSkipBrief(){ return mysCanSkipBriefing(); },
  _skipBrief(){ mysSkipBriefing(); },
  _briefed(){ return Object.assign({}, MYS.briefed||{}); },
  _agentFlags(){ const a=agent(); return a ? { slot:MYS.active, taint:taintOf(a),
      suspended:!!a.suspended, lost:!!a.lost, free:mysFreeSlot() } : null; },
  _swap(){ mysSwapAgent(); return MYS.active; },
  _useItem(id){ mysUseItem(id); return mysModal?mysModal.type:null; },
  /* 지금 떠 있는 팝업 — 확정하면 파티 화면이 닫히는지 보는 데 쓴다 */
  _modal(){ return mysModal ? mysModal.type : null; },
  /* 그림 보관소 — 본 저장 밖에 따로 있다. 검증기가 그 경계를 확인하는 데 쓴다. */
  _stand(key, i){ return standUrl(key, i); },
  _putImg(slot, name, url){ return mysImgPut(slot, name, url); },
  /* 이 참조가 다음에 켜도 남아 있는가 · 표만 남고 그림이 없는 칸을 정리한 수 */
  _imgSaved(ref){ return mysImgSaved(ref); },
  _imgCheck(){ return mysImgCheckRefs(); },
  _imgSync(){ return mysImgSync(); },
  /* 파티원에게 보내는 스탠딩 표(서버 URL 만) · 왼쪽에 서는 스탠딩 */
  _face(){ return mysStandShare(); },
  /* 지금 선 것이 스탠딩이 아니라 증명사진인가 */
  _standPhoto(){ const k=mysSceneState?mysSceneState.kind:null;
    const p = (k==='mate') ? mysMateStandPick(mysSceneState.by?mysPeers[mysSceneState.by]:null, mysSceneExpr())
            : ((k===''||k==='me') ? standPick(mysExprKey, MYS.active) : null);
    return p ? !!p.photo : null; },
  _standNow(){ const k=mysSceneState?mysSceneState.kind:null;
    if(k==='mate') return mysMateStandUrl(mysSceneState.by?mysPeers[mysSceneState.by]:null, mysSceneExpr());
    if(k===''||k==='me') return standUrl(mysExprKey, MYS.active);
    return null; },
  /* 타이핑 알림 — 지금 누가 치고 있는가 · 내가 치는 시늉 */
  _typing(){ return mysTypingList().map(t=>t.name); },
  _typingHtml(){ return mysTypingHtml(); },
  _type(v){ mysTypingPing(v); return mysTypAt; },
  /* 저장을 지금 한 번 시도한다 · 마지막 저장이 거절됐는가 (용량 초과 재현용) */
  _forceSave(){ mysSave(); return !mysSaveWarned; },
  _saveWarned(){ return mysSaveWarned; },
  /* 음소거 버튼을 누른 것과 같다 · 지금 소리 상태 */
  _mute(){ mysToggleMute(); return mysBgmMuted(); },
  _sound(){ return { muted:mysBgmMuted(), vol:MYS?(MYS.bgmVol|0):0, last:MYS?(MYS.bgmLast|0):0 }; },
  /* 확인 팝업의 [초기화]·[취소] 를 누른 것과 같다. 검증기가 버튼을 못 누르므로 뚫어둔다. */
  _resetOk(){ mysDoReset(); return !mysField(); },
  _resetNo(){ mysCloseModal(); return mysModal ? mysModal.type : null; },
  /* 검증기가 초기화를 시험한 뒤 원래 저장으로 되돌려 놓기 위한 것.
     ⚠ 게임 안에서 부를 일이 없다. 초기화는 되돌릴 수 없는 일이 맞다. */
  _restore(o){ try{ localStorage.setItem(MYS_KEY, JSON.stringify(o||{})); }catch(_){}
               mysLoad(); mysRender(); return !!MYS; },
  /* 저장에 실제로 무엇이 남아 있는가 — 초기화가 반쯤만 지웠는지 보는 데 쓴다 */
  _save(){ let raw=null; try{ raw=localStorage.getItem(MYS_KEY); }catch(_){}
           try{ return raw ? JSON.parse(raw) : null; }catch(_){ return null; } },
  _openParty(){ mysOpenParty(); return mysModal ? mysModal.type : null; },
  /* ── 파티 ──
     ★ 전송 어댑터는 밖에서 꽂는다. 게임은 join/leave/send 셋만 안다.
       인자를 안 주면 같은 프로세스 안에서만 도는 루프백을 쓴다(실기기 파티가 아니다). */
  netJoin(room, adapter){ return mysNetJoin(room||mysMakeCode(), adapter || mysNetLocal()); },
  /* 화면에서 코드를 친 것과 같은 경로 */
  netCode(v){ return mysJoinCode(v); },
  netReady(){ mysToggleReady(); return mysNetOn()?!!mysLobbyReady[mysMe.id]:null; },
  netLock(){ mysLockParty(); return mysLocked; },
  netUnlock(){ mysUnlockParty(); return mysLocked; },
  netPartyLeave(force){ mysPartyLeave(force); return mysNetOn(); },
  netParty(){ return mysNetOn()
      ? { code:mysRoom, locked:mysLocked, allReady:mysLobbyAllReady(),
          max:MYS_PARTY_MAX, size:mysNetPeers().length+1,
          ready:Object.keys(mysLobbyReady).filter(k=>mysLobbyReady[k]) } : null; },
  /* 게시판의 [착수]와 같은 경로. 파티가 확정돼 있으면 전원이 같이 들어간다. */
  beginCase(id){ mysBeginCase(id); return mysField()?mysField().caseId:null; },
  _startBlock(id){ return mysPartyStartBlock(id); },
  _caseOk(id, cleared){ return mysCaseOk(id, cleared); },
  netNewCode(){ return mysMakeCode(); },
  netLeave(){ mysNetLeave(); mysRenderField(); },
  netState(){ return mysNetOn()
      ? { room:mysRoom, me:mysMe.id, name:mysMe.name, leader:mysLeader(),
          isLeader:mysIsLeader(),
          peers:mysNetPeers().map(p=>({ id:p.id, name:p.name, color:p.color, pos:p.pos })) }
      : null; },
  /* 검증기가 가짜 파티원을 앉히기 위한 것. 화면 없이 메시지를 주고받는다. */
  _puppet(room, id, name){ return mysNetPuppet(room||'mys', id, name); },
  _netRecv(m){ mysNetRecv(m); },
  /* 스로틀에 걸려 대기 중인 위치를 지금 내보낸다. 검증기가 800ms 를 기다리지 않기 위한 것. */
  _netFlush(){ mysNetBeat(true); },
  _gateAsk(){ return mysGateAsk ? { spotId:mysGateAsk.spotId, who:mysGateAsk.who } : null; },
  _ask(){ return mysAsk ? { name:mysAsk.name, v:mysAsk.v } : null; },
  _mateAt(){ return mysMateAt(); },
  _mateFlags(){ return mysMateFlags(); },
  _canSubmit(){ return mysCanSubmit(); },
  /* ── 스탠딩 ──
     자산이 없어도 후보 경로는 나온다. '그림을 넣으면 붙는가'를 파일 없이 확인하기 위한 것. */
  _npcStand(who, expr){ return mysNpcStand(who, expr); },
  _sceneExpr(){ return mysSceneExpr(); },
  /* ── 범인 지목 ──
     화면 없이 '버튼이 떴는가'와 '고르면 제출로 가는가'를 확인하기 위한 것.
     ⚠ 판정은 여기 없다 — mysSubmit 으로 위임만 한다. */
  _accuseReady(){ return mysAccuseReady(); },
  _accuse(name){ mysOpenAccuse(); mysSubmit(name); const f=mysField(); return f?f.stage:null; },
  _dot(n){ mysPatternTap(n); },
  _dotok(v){ mysPatternSubmit(v); },
  /* ★ 깃발 본체는 {at,note} 지만 여기서는 위치 문자열 배열로 돌려준다 —
     검증기가 indexOf('10,11') 로 확인하고, 파티 훅도 좌표만 필요하다.
     메모까지 보고 싶으면 _flagNote 를 쓴다. */
  /* ★ 상수를 밖으로 연다. 검증기가 숫자를 박아두면 값을 바꾼 날 조용히 어긋난다 —
     워치 패턴을 박아뒀다가 이동 실패 20여 개를 무더기로 본 적이 있다(v7 교훈 23). */
  _consts(){ return { TAINT_WATCH:MYS_TAINT_WATCH, TAINT_GLITCH:MYS_TAINT_GLITCH,
                      READY_MS:MYS_READY_MS, GATE:MYS_GATE,
                      FLAG_MAX:MYS_FLAG_MAX, NOTE_MAX:MYS_NOTE_MAX, LOG_MAX:MYS_LOG_MAX }; },
  _flag(x,y){ mysSetFlag(x,y); return mysFlags().map(v=>v.at); },
  /* ── 심문 절차 ──
     파티가 없어서 실기기로는 확인할 수 없다. 파티원 훅을 갈아끼워 절차만 굴려본다. */
  _setMates(fn){ mysMateHook = (typeof fn==='function') ? fn : null; return mysMates().length; },
  _interroCandidates(dc){ return mysInterroCandidates(dc).map(p=>({ id:p.id, intr:p.intr })); },
  _interroBegin(spotId, dc){
    const c=mysCase(); const s=(c&&(c.spots||[]).find(x=>x.id===spotId))||{ id:spotId };
    return mysInterroBegin(s, dc);
  },
  _interroReady(id){ return mysInterroReady(id); },
  _readyState(){ return mysReady ? { spotId:mysReady.spotId,
                                     got:Object.keys(mysReady.got), since:mysReady.since } : null; },
  /* 레디 타임아웃을 기다리지 않고 재현하기 위한 것 */
  _readyAge(ms){ if(mysReady) mysReady.since = Date.now() - (ms|0); return !!mysReady; },
  _flagNote(x,y,note){
    if(note==null) { const t=mysFlagAt(mysKey(x,y)); return t?t.note:null; }
    mysFlagNote(x,y); mysSaveFlagNote(note);
    const t=mysFlagAt(mysKey(x,y)); return t?t.note:null;
  },
  /* 검증기가 깨진 저장 상태를 재현하기 위한 것 */
  _forceField(f){ if(!MYS) return null; MYS.field=f; mysEnsureSeen(); mysRenderField(); return mysField(); },
  /* 오염도를 직접 세팅 — 테스트에서 상한 상황을 재현하고 되돌리기 위한 것 */
  _setTaint(n){ const a=agent(); if(!a) return null;
    mysSetTaint(a, n, '테스트 조작');
    mysSave(); if(mysBody) mysBody._mysLastHtml=''; mysRenderField(); return a.taint; },
  _setStat(path, n){ const a=agent(); if(a&&a.alloc&&path in a.alloc){ a.alloc[path]=n|0; return true; } return false; },
  /* 채팅 문법·정화 검사용. 화면 없이 돌아야 하므로 입력칸이 없으면 값을 직접 받는다. */
  _say(text){ const i=el('mysChatInput'); if(i && text!=null) i.value=text; mysSay(); return mysLogs[mysLogs.length-1]||null; },
  _nick(on){ if(on!=null && !!on!==mysNickOn) mysToggleNick(); return mysNickOn; },
  _expr(){ return mysExprKey; },
  /* 기록 보관·내보내기 훅 — 검증기가 '껐다 켜도 남는가'를 굴려보는 자리 */
  _logText(){ return mysLogText(); },
  _logsReload(){ mysLogsLoad(); return mysLogs.length; },
  _logsClear(){ mysLogsClear(); },
  _leave(){ mysLeaveField(); },
  _logSave(){ mysExportLog(); mysCloseModal(); mysAbandonCase(); },
  _logSkip(){ mysCloseModal(); mysAbandonCase(); },
  _focusHeal(){ return mysApplyFocusHeal(); },
  _purifier(){ return !!(MYS && MYS.purifier); }
};

/* ═══════════════════════════ 부팅 ═══════════════════════════ */
mhdReady(desk => {
  D = desk;
  mysInjectCss();
  mysLoad();
  /* ★ 옛 저장 보정 — seen 이 빈 채로 저장된 사건을 열면 화면이 통째로 안개다.
     (초기 버전이 MYS.field 대입 전에 시야를 열어 seen 을 못 채운 채 저장했다)
     로드 때 현재 위치를 한 번 공개해 스스로 낫게 한다. 저장을 지우게 하지 않으려는 것. */
  mysEnsureSeen();
  mysApplyFocusHeal();   // 집중 레벨이 올랐으면 오염도 회복
  mysApplyFont();

  mysBody = D.createWindow({ id:MYS_WIN,      title:'🕰 '+MYS_TITLE,   host:'home', onClose:mysCleanup });
  regBody = D.createWindow({ id:MYS_AGENTWIN, title:'캐릭터 등록',     host:'home', onClose:mysCleanup });
  if(!mysBody || !regBody){ console.warn('[미스테리au] 창 생성 실패 — 데스크톱을 찾지 못했습니다'); return; }

  /* slot 지정 — 캐릭터 등록은 옛 캐릭터세팅이 있던 1번 칸(left:90px)에 그대로 앉힌다.
     등록 순서에 기대면 나중에 폴더가 늘 때 자리가 밀리므로 칸을 명시한다. */
  D.addFolder({ id:'mys',      label:MYS_TITLE,   icon:'📁', slot:0, onOpen:mysOpen, onVisit:v=>{ if(v) mysCleanup(); } });
  D.addFolder({ id:'mysAgent', label:'캐릭터 등록', icon:'📁', slot:1, onOpen:regOpen, onVisit:v=>{ if(v) mysCleanup(); } });

  /* 바탕화면 '환경 설정 ▸ 글자 크기' — 게임을 지우면 이 항목도 같이 사라진다 */
  D.addEnvMenu({
    id:'mysFont', label:'🔤 글자 크기',
    items: FONT_SIZES.map(f=>({ value:f.value, label:f.label })),
    get: ()=> (MYS && MYS.fontSize) || FONT_DEFAULT,
    onSelect: v => mysSetFont(v)
  });

  /* 🔊 브금 — 글자 크기와 같은 자리에 둔다. 게임을 지우면 이 항목도 같이 사라진다.
     ★ 볼륨을 0으로 두는 것이 곧 끄기다. 항목을 둘로 나누면 "껐는데 소리가 난다"가 생긴다. */
  D.addEnvMenu({
    id:'mysBgm', label:'🔊 브금',
    items: BGM_LEVELS.map(b=>({ value:b.value, label:b.label })),
    get: ()=> (MYS && MYS.bgmVol != null) ? MYS.bgmVol : 35,
    onSelect: v => mysBgmSetVol(v)
  });

  /* ★ 확정된 파티는 창을 닫아도, 다시 켜도 유지된다. 저장에 코드가 남아 있으면 스스로 들어간다.
     ⚠ 어댑터가 없으면 루프백으로 떨어진다 — 그건 같은 창 안에서만 도는 가짜 파티다. */
  mysRejoinParty();

  /* ★ 이 기기에만 있는 그림을 서버로 옮긴다. 두 가지가 같이 풀린다 —
       · localStorage 에서 수백 KB 짜리 문자열이 빠져나가 저장이 다시 가벼워진다
       · 서버 URL 이 된 그림만 파티원 화면에 설 수 있다(dataURL 은 전송 상한을 넘는다)
     ⚠ 부팅 경로를 막지 않는다. 네트워크가 느리거나 끊겨 있어도 게임은 그대로 켜지고,
       못 옮긴 것은 다음에 켤 때 다시 해본다. */
  if(typeof setTimeout==='function') setTimeout(()=>{ try{ mysImgSync(); }catch(_){} }, 3000);

  console.log('[미스테리au] 등록 완료 — 폴더 2개 · 창 2개 · 환경설정 1개');
});

})();
