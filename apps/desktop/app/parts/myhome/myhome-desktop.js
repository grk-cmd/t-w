/* ============================================================ 🖥️ 마이홈 데스크톱 (myhome-desktop.js)
   마이홈 우측 프리뷰(#mhRoomPreview) 미니 바탕화면 — 배경 · 폴더(외부 앱 아이콘) · 환경 설정 · 작업표시줄 · 방문 모드 훅.

   ★ 파일명 이력: adventure-zombie.js → myhome-desktop.js (좀비 어드벤처 은퇴)
     · 좀아칼(좀비 어드벤처) 게임 코드(시뮬 · 캐릭터세팅 · 인벤토리 · 파티 · 전투 · 스토리 · 지도)는 «끄고 별도 파일로 보관» 하기로 한 사용자 결정(2026-11-14 · 설계 Q2)에 따라
       apps/desktop/archive/myhome-game-archive.js 로 옮겼다(D2-6 — 앱 묶음 밖 · 어디에서도 싣지 않는 보관본이라 다시 설계할 때만 꺼내 본다. 게임 창 HTML · 이벤트 연결도 같이 걷었다.
     · 여기 남은 것: 게임 저장 읽기 · 쓰기(tw.advZ.v2 — 지우지 않는다 · 계정 칸) · 게임 CSS 문자열(보관본이 쓰던 .adv-* 규칙 — 같은 css 안에 섞여 있어 남김) · 마이홈 바탕화면 · 외부 앱 등록(window.MYHOME_DESKTOP) · 방문 모드 훅(_advApplyVisitUI).
     · 접두어 adv* / ADV_ / #adv… 와 저장 키 tw.advZ.v2 는 그대로 둔다. 바꾸면 기존 유저의 바탕화면 설정이 초기화되고, 치환 범위가 파일 전체로 번진다.
   ★ 바탕화면 값(배경 · 폴더 숨기기 · 폴더 자리)의 원본은 서버 — 상태 주인(myhome-store.js)이 받고 저장한다(D2-3).
   ★ 모든 창은 #mhRoomPreview 내부 absolute — 화이트리스트 추가 불필요. confirm() 미사용.

   ★ deps (createMyHomeDesktop) — advStore: 계정별 로컬 칸(shared/account-store.js · 바탕화면 저장 tw.advZ.v2 · v1). myhome-desktop-boot.js 가 넘긴다
   ★ app.js 전역 의존 (전부 typeof 가드)
   · focusLevelMod.getFocusLevel(), getDisplayName()
   · firebaseAPI.uploadUserImage(), getMyUserId(), toast(), companion.dsHold()
*/
function createMyHomeDesktop(deps){
/* ★ 좀아칼(좀비 어드벤처) 게임 코드는 이 파일에서 걷어 apps/desktop/archive/myhome-game-archive.js 로 옮겼다(싣지 않는다 — 다시 설계할 때 꺼내 쓴다).
   여기 남은 것은 마이홈 바탕화면(배경 · 폴더 · 작업표시줄 · 환경 설정 · 외부 앱 폴더)과 방문 모드 훅이다. 게임 저장(tw.advZ.v2)은 지우지 않고 그대로 둔다. */
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판(myhome-hooks.js) — 창을 끌 때 마이홈 BGM 창 자리를 다시 보낸다(마이홈 창이 건다)
'use strict';

/* ─────────────────────────── 저장 ─────────────────────────── */
/* 🗂️ 바탕화면 로컬 저장은 계정별 칸(shared/account-store.js) — 계정을 바꾸면 그 계정의 바탕화면이 열린다. 만드는 쪽(myhome-desktop-boot.js)이 넘긴 한 벌. */
const advStore = deps.advStore;
const myhomeStore = deps.myhomeStore;   // 🏠 상태 주인(myhome-store.js) — 바탕화면(배경 · 폴더 숨기기 · 폴더 자리)의 원본은 서버(PUT /v1/me/myhome/desktop)
/* 내 바탕화면 { bg, hideFolders, folderPos } — 상태 주인 값(고치려면 myhomeStore.setDesktop) */
const mhdDesk = () => myhomeStore.mine().desktop;
/* 지금 화면에 그리는 바탕화면 — 친구 집 구경 중이면 그 집 것(openView 가 페이지와 함께 받아 둔 값) · 아니면(방문자 시점 미리보기 포함) 내 것. 판단은 상태 주인 한 곳 */
const mhdShown = () => myhomeStore.desktop();
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
    const d = JSON.parse(advStore.get(ADV_KEY) || 'null');
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
    const o = JSON.parse(advStore.get(ADV_KEY_V1) || 'null');
    if(o){
      const s0 = blankSlot();
      s0.face = o.face || '🧑‍🚒';
      if(o.alloc){ s0.alloc.str=o.alloc.str||0; s0.alloc.agi=o.alloc.agi||0; s0.alloc.int=o.alloc.int||0; s0.alloc.luk=o.alloc.sur||0; }
      return { slots:[s0,blankSlot(),blankSlot()], active:0,
               st:(typeof o.st==='number')?o.st:100, stLevel:null,
               hp:(typeof o.hp==='number')?o.hp:100, inf:0, inv:{}, weapons:[], scene:'camp' };
    }
  }catch(_){}
  return advDefault();
}
/* 계정 칸에 저장본이 없을 때의 기본 — 시작(startBgSync) 전 화면도 이 빈 상태로 그린다 */
function advDefault(){
  return { slots:[blankSlot(),blankSlot(),blankSlot()], active:0, st:100, stLevel:null, hp:100,
           inf:0, inv:{}, weapons:[], scene:'camp' };
}
let advStarted = false;   // 계정 확인을 통과해 계정 칸을 읽은 뒤 true — 그 전에는 저장하지 않는다(빈 기본값이 저장본을 덮지 않게)
function advSave(){
  if(!advStarted) return;
  try{ advStore.set(ADV_KEY, JSON.stringify(ADV)); }catch(_){}
}
/* 🖥️ 바탕화면(배경 · 폴더 숨기기 · 폴더 자리)의 원본은 서버다 — 상태 주인(myhome-store.js)이 받고 PUT desktop 으로 저장한다(자기 판 · 409 는 받은 값 + 알림 · 실패 E-MH-25).
   예전 로컬(tw.advZ.v2 의 bg · bgTs · hideFolders · folderPos)과 서버 advBg 를 «고른 시각(ts)» 으로 맞추던 길(advPullBg · advSaveBgRemote)은 걷었다. */
/* 사람이 배경을 바꾸는 네 곳(색 · 이미지 · URL · 초기화)이 모두 여기로 온다 */
function advSetBg(bg){
  myhomeStore.setDesktop({ bg: bg || null });
  advApplyBg();
}
let mhdFF = null;        // 📂 폴더 자유배치(folder-free.js) — advApplyFolderHide · mhdMountApp 가 이른 시점에도 보므로 위에 둔다
const ADV = advDefault();

/* ─────────────────────────── 스타일 ─────────────────────────── */
const css = `
  /* ── 미니 바탕화면 ── */
  #advDesktop{position:absolute;inset:0;z-index:3;background:#3a8a8a;overflow:hidden;
    font-family:Tahoma,'맑은 고딕',sans-serif;}
  #advDesktop.adv-visiting .adv-icon{opacity:.75;cursor:default;}
  .adv-icon{position:absolute;width:66px;text-align:center;cursor:pointer;user-select:none;}
  .adv-icon .ic{font-size:30px;line-height:1;filter:drop-shadow(1px 1px 0 rgba(0,0,0,.35));}
  /* 🖼 그림 아이콘 — 이모지(30px 글자)와 같은 자리를 차지하게 */
  .adv-icon .ic .mhd-ic-img{width:34px;height:34px;display:block;margin:0 auto -2px;pointer-events:none;}
  /* 📂 폴더 숨기기 — 외부 앱 폴더(책장·말랑이 등)를 통째로 가린다. setFolderVisible(인라인 display)보다 우선한다. */
  #advDesktop.mhd-hide-folders .mhd-app{display:none !important;}
  /* 📂 [2026-10-02 제보 «폴더 숨기기에서 말랑이 폴더는 안 숨겨진다»] 말랑이 폴더(#mlFolder · mallang.js)는 #advDesktop 안이 아니라
     **그 형제**로 #mhRoomPreview 에 바로 붙는다 — 위 규칙(#advDesktop … .mhd-app)이 닿지 않았다.
     ⇒ advApplyFolderHide 가 같은 표식을 바깥 상자(#mhRoomPreview)에도 걸고, 여기서 말랑이 폴더를 가린다.
     ★ CSS 라서 말랑이 폴더가 나중에(이미지 로드 뒤 refreshFolder) 생겨도 바로 숨는다. mallang.js 는 안 고친다. */
  #mhRoomPreview.mhd-hide-folders #mlFolder{display:none !important;}
  /* 📂 폴더 자유배치(folder-free.js) — 배치 중에는 옮길 수 있는 폴더(외부 앱 · 말랑이)에 점선, 붙박이 아이콘은 흐리게. */
  #mhRoomPreview.mhd-ff-arrange .mhd-app,#mhRoomPreview.mhd-ff-arrange #mlFolder{cursor:grab;touch-action:none;
    outline:1.5px dashed var(--tw-plate-ink);outline-offset:2px;}
  #mhRoomPreview .mhd-ff-drag{cursor:grabbing !important;outline-color:var(--tw-star) !important;}
  #mhRoomPreview.mhd-ff-arrange #advIconSim,#mhRoomPreview.mhd-ff-arrange #advIconChar{opacity:.55;cursor:default;}
  #advFfBand{position:absolute;top:6px;left:50%;transform:translateX(-50%);z-index:40;display:none;align-items:center;gap:6px;
    white-space:nowrap;font-size:10.5px;padding:3px 4px 3px 8px;background:var(--tw-bg-face);color:var(--tw-ink);
    border:2px solid;border-color:var(--tw-bevel-hi) var(--tw-bevel-dark) var(--tw-bevel-dark) var(--tw-bevel-hi);box-shadow:var(--tw-shadow-window);}
  #advFfBand button{font-size:10.5px;padding:1px 8px;cursor:pointer;background:var(--tw-bg-face);color:var(--tw-ink);
    border:1px solid;border-color:var(--tw-bevel-hi) var(--tw-bevel-dark) var(--tw-bevel-dark) var(--tw-bevel-hi);}
  #advFfBand button.ok{font-weight:bold;}
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
  /* 📚 host:'side' — 마이홈 창 **바깥**에 붙는 서랍. 자리는 인라인이 아니라 **여기서** 정한다.
     ⚠️ 인라인으로만 두었더니 뒤에 붙는 한 줄(inset:auto)에 쓸려 창 아래로 떨어졌다(제보 2회).
       규칙으로 못박아 두면 인라인 순서와 무관하게 자리가 유지된다. 좌/우 전환만 인라인으로 덮는다. */
  /* 여기에 inset 을 쓰지 말 것 — inset:auto !important 는 좌/우를 정하는 인라인까지 이긴다
     (!important 가 인라인보다 세다). 위·아래만 못박고 좌/우는 mhdPlaceSide 가 인라인으로 정한다. */
  .adv-win.mhd-side{position:absolute !important;top:0 !important;bottom:0 !important;
    width:320px;height:auto !important;max-width:none !important;max-height:none !important;z-index:150;
    transform:translateX(-18px);opacity:0;transition:transform .18s ease, opacity .18s ease;will-change:transform;}
  .adv-win.mhd-side.on{display:flex;}
  /* 서랍이 스르르 나온다(요청). 여는 순간 한 프레임 뒤에 .mhd-side-open 이 붙고, 닫을 때 먼저 떼고 잠시 뒤 감춘다.
     ⚠️ 시작 위치는 **왼쪽**(-18px)이다 — 창 쪽에서 오른쪽으로 밀려 나오는 방향(→). 양수로 두면 반대로 움직인다(제보). */
  .adv-win.mhd-side.mhd-side-open{transform:translateX(0);opacity:1;}
  /* 창 안쪽으로 접어 넣은 서랍(앱 창이 좁을 때) — 내용 위에 겹치므로 왼쪽에 그림자를 준다. */
  .adv-win.mhd-side.mhd-side-in{box-shadow:-3px 0 10px rgba(0,0,0,.45);}
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
let MHD_VISIT_OWNER = null;

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
     addFolder({id, label, icon, slot, onOpen, onVisit, visitable})  → 아이콘 등록. slot 생략 시 자동 배치.
                                                       visitable:true 면 남의 집에서도 폴더를 열 수 있다(구경용).
     setFolderVisible(id, on) / visitOwner()       → 아이콘 잠깐 감추기 / 관람 중인 집주인 id
     onVisit(visiting, ownerId)                    → 관람 모드 전환 통보(집주인 id 포함)
     removeFolder(id)                              → 아이콘 제거(런타임 토글용)
     addEnvMenu({id, label, items, get, onSelect})  → '환경 설정'에 하위메뉴 추가
     createWindow({id, title, fill, host, onClose})  → Win98 창 껍데기 생성. body 엘리먼트 반환
                                                       host:'home' → 마이홈 창 전체를 덮음(시메지 위)
                                                       host:'side' → 마이홈 창 **오른쪽 바깥**에 붙는 서랍(창을 끌면 같이 따라옴)
     openWindow(id) / closeWindow(id) / isWindowOpen(id)  → 표시 토글 · 열려 있는지
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
const MHD_SIDEWINS = [];    // 그중 마이홈 창 오른쪽 바깥에 붙는 서랍 id (host:'side')
const MHD_VISIT_WINS = [];  // 남의 집에서도 열 수 있는 창 id (createWindow({visitable:true}))
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
  /* 📂 mhd-app — 외부 앱 폴더 표식. «폴더 숨기기»(advApplyFolderHide)가 이 클래스로 한꺼번에 가린다. */
  const ic=h('<div class="adv-icon mhd-app" id="'+esc(a.iconId)+'">'
    +'<div class="ic">'+esc(a.icon||'📁')+'</div>'
    +'<span class="lb">'+esc(a.label||'')+'</span></div>');
  /* 🖼 그림 아이콘 — 문자열로 끼우지 않고 DOM 으로 만든다(경로에 따옴표가 섞여도 마크업이 깨지지 않게).
     그림을 못 읽으면 원래 글자(icon)로 돌아간다 — 빈 칸이 남지 않게. */
  if(a.iconSrc){
    const box=ic.querySelector('.ic');
    const im=document.createElement('img');
    im.src=a.iconSrc; im.alt=''; im.draggable=false; im.className='mhd-ic-img';
    im.onerror=()=>{ box.textContent=a.icon||'📁'; };
    box.textContent=''; box.appendChild(im);
  }
  mhdPlaceIcon(ic, idx);
  ic.addEventListener('click', ()=>{
    /* 남의 집에선 열지 않는다 — 단 visitable 로 등록한 폴더는 예외(구경거리를 내놓는 앱).
       ⚠️ «열린다» 는 것과 «남의 것이 보인다» 는 것은 다른 문제다. 무엇을 보여줄지는 앱이 onVisit(true, 집주인id)
         에서 스스로 갈아 끼운다 — 여기서는 문만 연다. */
    if(advVisiting && !a.visitable) return;
    try{ a.onOpen && a.onOpen(); }
    catch(e){ console.error('[MYHOME_DESKTOP] '+a.id+'.onOpen 실패', e); }
  });
  d.appendChild(ic);
  if(mhdFF) mhdFF.apply();   // 📂 자유배치로 옮겨 둔 자리가 있으면 거기로(늦게 붙는 폴더도)
}

function mhdMountAll(){
  MHD_READY=true;
  MHD_APPS.forEach(a=>{ try{ mhdMountApp(a); }catch(e){ console.error('[MYHOME_DESKTOP] mount 실패', a.id, e); } });
  mhdMountAllEnv();
  MHD_READYCBS.splice(0).forEach(f=>{ try{ f(window.MYHOME_DESKTOP); }catch(e){ console.error('[MYHOME_DESKTOP] onReady 실패', e); } });
}

/* 관람 모드 전파 — _advApplyVisitUI에서 호출한다 */
function mhdNotifyVisit(visiting, ownerId){
  MHD_VISIT_OWNER = visiting ? (ownerId || null) : null;
  MHD_APPS.forEach(a=>{ if(a.onVisit) try{ a.onVisit(!!visiting, MHD_VISIT_OWNER); }catch(e){ console.error('[MYHOME_DESKTOP] '+a.id+'.onVisit 실패', e); } });
}

/* 🔌 외부 앱이 '환경 설정' 메뉴에 하위메뉴를 하나 붙인다.
   ★ 게임이 자기 설정을 바탕화면 메뉴에 노출하려면 이 창구를 쓴다.
     여기 없이 하려면 게임 파일이 #advEnvMenu에 직접 DOM을 꽂아야 하는데,
     그러면 게임을 지울 때 메뉴에 빈 항목이 남거나 이벤트가 새는 지점이 된다. */
function mhdMountEnv(e){
  const menu=document.getElementById('advEnvMenu'); if(!menu) return;
  if(document.getElementById(e.subId)) return;
  const sub=h('<div class="mhd-envsub" id="'+esc(e.subId)+'">'
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

  /* 🚀 계정 확인 뒤 한 번(launcher/app-boot.js) — 게임 저장본을 읽고 내 바탕화면(배경 · 폴더)을 상태 주인에게서 받아 그린다. */
  startBgSync(uid){
    if(!uid) return;
    const loaded = advLoad();   // 계정 칸에서 읽어 기본값 자리에 채운다(ADV 는 여러 곳이 잡고 있어 같은 객체를 유지)
    for(const k of Object.keys(ADV)) delete ADV[k];
    Object.assign(ADV, loaded);
    advStarted = true;
    try{ if(!advStore.get(ADV_KEY)) advSave(); }catch(_){}
    if(!advVisiting) advApplyBg();
    mhdWatchStore();   // 바탕화면은 마이홈 창 안에만 보인다 — 받기는 마이홈을 열 때(myhome-page.js pullMine) 한 번이고, 받으면 onChange 가 다시 칠한다(켤 때 서버 읽기는 걷음)
  },


  /* 폴더 아이콘 등록. advInit 전에 불러도 되고(대기열에 쌓았다가 마운트), 후에 불러도 된다. */
  addFolder(o){
    if(!o || !o.id) return null;
    if(MHD_APPS.some(a=>a.id===o.id)) return MHD_APPS.find(a=>a.id===o.id);
    /* 🖼 [2026-10-02] iconSrc — 이모지 대신 그림 파일로 그릴 수 있다(선택). 없으면 예전처럼 icon 글자.
       ⚠️ 상대 경로만 받는다(앱에 같이 들어 있는 파일). 바깥 주소·스크립트 주소는 받지 않는다. */
    /* 🩹 [2026-10-02 · 개정 77 sim-mhd-hidefolders 4절] 첫 글자는 글자·숫자만 — 예전 `^[\w./-]+` 는 `//서버/a.svg`
       (file:// 에서 네트워크 공유 경로)와 `/절대경로` 를 통과시켰다. 앱 안 상대 경로(parts/icons/…)만 받는다.
       ⚠️ 개정 79(말랑이 폴더 숨기기)를 개정 77 이전 판에 얹어 이 줄이 한 번 되돌아갔었다 — 다시 넣었다. */
    const _src = (typeof o.iconSrc === 'string' && /^[A-Za-z0-9][\w./-]*\.(svg|png|webp)$/i.test(o.iconSrc) && o.iconSrc.indexOf('..') < 0) ? o.iconSrc : '';
    const a={ id:o.id, label:o.label||o.id, icon:o.icon||'📁', iconSrc:_src, slot:o.slot,
              onOpen:o.onOpen, onVisit:o.onVisit, visitable:!!o.visitable, iconId:'mhdIcon_'+o.id };
    MHD_APPS.push(a);
    if(MHD_READY) mhdMountApp(a);
    return a;
  },

  /* 폴더 아이콘을 잠깐 감춘다(지우는 것이 아니다) — 예: 남의 집에 공개된 것이 하나도 없을 때. */
  setFolderVisible(id, on){
    const a=MHD_APPS.find(x=>x.id===id); if(!a) return;
    const n=document.getElementById(a.iconId); if(n) n.style.display = on ? '' : 'none';
  },
  visitOwner(){ return MHD_VISIT_OWNER; },

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
      w=h('<div class="adv-win" id="'+esc(o.id)+'">'
        +'<div class="adv-titlebar"><span class="mhd-title"></span>'
        +'<span class="adv-tb-right"><span class="x">×</span></span></div>'
        +'<div class="mhd-win-body"></div></div>');
      w.querySelector('.mhd-title').textContent=o.title||'';
      if(o.fill!==false){ w.style.cssText+='inset:0;left:0;top:0;transform:none;width:auto;height:auto;max-width:none;max-height:none;z-index:150;'; }
      w.querySelector('.x').addEventListener('click', ()=>{
        /* ⚠️ [제보] 예전엔 여기서 .on 만 뗐다. host:'side' 서랍은 .on 이 아니라 display 로 여닫히므로
           그대로 남아 있었다 — 닫는 길은 advCloseWin 한 곳으로 모은다(관람 모드 일괄 닫기와 같은 길). */
        advCloseWin(o.id);
        if(o.onClose) try{ o.onClose(); }catch(e){ console.error('[MYHOME_DESKTOP] '+o.id+'.onClose 실패', e); }
      });
      advBindWinDrag(w.querySelector('.adv-titlebar'));   // 타이틀바 드래그 = 프로그램 창 이동(기존과 동일)
      d.appendChild(w);
      if(o.host==='home') MHD_HOMEWINS.push(o.id);        // openWindow에서 마이홈 창으로 옮긴다
      /* 📚 host:'side' — 마이홈 창 **바깥 오른쪽**에 붙는 서랍(2026-09-23 · 개정 61 · 계약에 항목만 추가).
         ★ 'home' 과 같은 이유로 부모를 #myHomeWin 으로 옮긴다. 다만 창을 덮는 것이 아니라 left:100% 로
           바깥에 세운다 — #myHomeWin 에 overflow 가 없으므로 잘리지 않고, 창을 끌면 자식이라 같이 따라간다.
         ⚠️ 기존 둘(기본 · 'home')의 동작은 한 줄도 바뀌지 않는다. */
      if(o.visitable && MHD_VISIT_WINS.indexOf(o.id)<0) MHD_VISIT_WINS.push(o.id);   // 남의 집에서도 열리는 창
      if(o.host==='side'){
        MHD_SIDEWINS.push(o.id);
        w.classList.add('mhd-side');            // 자리는 .adv-win.mhd-side 규칙이 잡는다(위 css)
        w.style.display='none';
        mhdPlaceSide(w);
      }
      if(MHD_WINS.indexOf(o.id)<0) MHD_WINS.push(o.id);
    }
    const body=w.querySelector('.mhd-win-body');
    if(body) body.style.cssText+='flex:1;min-height:0;overflow:auto;';
    return body;
  },

  openWindow(id){
    if(advVisiting && MHD_VISIT_WINS.indexOf(id)<0) return;
    const w=document.getElementById(id); if(!w) return;
    /* host:'home' 창은 열 때마다 부모를 확인한다. 생성 시점엔 #myHomeWin이 아직 없을 수도 있고,
       탭 전환 등으로 DOM이 재구성되면 다시 붙여야 하기 때문(캐릭터세팅 창과 동일한 처리). */
    if(MHD_HOMEWINS.indexOf(id)>=0 || MHD_SIDEWINS.indexOf(id)>=0){
      const homeWin=document.getElementById('myHomeWin');
      if(homeWin && w.parentNode!==homeWin) homeWin.appendChild(w);
    }
    if(MHD_SIDEWINS.indexOf(id)>=0){
      mhdPlaceSide(w); w.style.display='flex';
      if(w._mhdSideT){ clearTimeout(w._mhdSideT); w._mhdSideT=0; }
      requestAnimationFrame(()=>requestAnimationFrame(()=>w.classList.add('mhd-side-open')));   // 한 프레임 뒤라야 전환이 돈다
    }
    w.classList.add('on');
  },
  closeWindow(id){ advCloseWin(id); },
  isWindowOpen(id){ return mhdSideOpen(id); },
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

  const style=document.createElement('style'); style.id='advStyle'; style.textContent=css;
  document.head.appendChild(style);

  const desk = h(
    '<div id="advDesktop">'+
      '<div id="advTaskbar"><button id="advEnvBtn" type="button">환경 설정</button></div>'+
      /* 🗂 [2026-10-02 · 시안 확정] 배경 네 줄을 [배경 변경 ▶] 하나로 묶고(옆으로 펼침), [폴더 숨기기]를 더한다.
         ★ 펼침은 외부 앱 하위메뉴와 **같은 모양**(mhd-envsub · mhd-fly)을 쓴다 — 새 CSS 를 만들지 않는다.
         ★ 버튼 id 는 그대로다(advEnvColor·File·Img·Reset) — 아래 advBindEvents 의 연결이 한 줄도 안 바뀐다. */
      '<div id="advEnvMenu">'+
        '<div class="mhd-envsub" id="advEnvBgSub">'+
          '<button type="button" class="hd">배경화면 변경<span>▶</span></button>'+
          '<div class="mhd-fly">'+
            '<button id="advEnvColor" type="button">🎨 색상</button>'+
            '<button id="advEnvFile" type="button">📁 파일</button>'+
            '<button id="advEnvImg" type="button">🌐 URL</button>'+
            '<button id="advEnvReset" type="button">↺ 배경 초기화</button>'+
          '</div>'+
        '</div>'+
        '<button id="advEnvHideFolders" type="button">폴더 숨기기</button>'+
        '<button id="advEnvFreeFolders" type="button">폴더 자유배치</button>'+
      '</div>'+
      '<div id="advUrlBox"><div class="t">배경 이미지 URL</div>'+
        '<input id="advUrlInput" type="text" placeholder="https://... 이미지 주소">'+
        '<div class="row"><button id="advUrlOk" type="button">적용</button><button id="advUrlCancel" type="button">취소</button></div>'+
      '</div>'+
      '<input id="advBgColorInput" type="color" style="display:none;">'+
    '</div>');
  room.appendChild(desk);

  advBindEvents();
  mhdFfInit();     // 📂 폴더 자유배치 — advApplyBg 가 배치까지 맞추므로 그보다 먼저
  advApplyBg();
  mhdMountAll();   // 🔌 외부 앱(mystery-au.js 등) 아이콘 마운트 — 등록된 게 없으면 아무 일도 안 한다
}
function esc(s){ return TwSafeHtml.text(s); }

/* ─────────────────────────── 이미지 업로드 (Storage) ─────────────────────────── */
function advUploadImage(slotKey, maxW, maxH, quality, onUrl, viaStore){
  if(advVisiting) return;
  try{ if(window.companion && companion.dsHold) companion.dsHold(); }catch(_){}
  const hasUploader=!!(window.firebaseAPI && firebaseAPI.uploadUserImage);
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
        if(viaStore){   // 🏠 상태 주인으로 올린다(주소만 돌려받음 · 실패 번호 E-MH-24 는 상태 주인이 띄운다)
          advToast('이미지를 올리는 중…');
          const r = await myhomeStore.upload(slotKey, dataUrl);
          if(r.status === 'ok'){ onUrl(r.url); advToast('저장했어요'); }
        }else if(hasUploader){
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
function advToast(msg){ try{ toast(msg); return; }catch(_){} }

/* ─────────────────────────── 배경 ─────────────────────────── */
function advApplyBg(){
  const d=document.getElementById('advDesktop'); if(!d) return;
  // 방문 중엔 내 배경이 아니라 "그 집 주인"의 배경을 보여준다(mhdShown).
  const bg = mhdShown().bg;
  const bgUrl = bg ? TwSafeHtml.cssUrl(TwMhBgUrl.httpsOf(bg.img)) : '';   // 남의 집 배경일 수 있다 — 허용된 그림 주소 · 색만(http 는 https 로 바꿔 불러 봄)
  if(bg && !advVisiting && !myhomeStore.viewing()) TwMhBgUrl.probeOwnerBg(bg.img);   // 내 배경일 때만(구경 시작 때 openView 알림이 _advApplyVisitUI 보다 먼저라 advVisiting 만으론 남의 배경이 끼어든다)   // 못 받으면 주인에게만 안내
  if(bgUrl) d.style.background=bgUrl+' center/cover no-repeat';
  else if(bg&&bg.color) d.style.background=TwSafeHtml.cssColor(bg.color);
  // 방문 중인데 집주인 배경이 서버에 없으면(상대가 아직 업데이트 전) 청록 단색 대신 투명 처리 —
  //   그러면 그 집 마이홈 테마의 "방 미리보기 배경"이 비쳐 보여서 최소한 주인이 꾸민 색/이미지가 나온다.
  else if(advVisiting) d.style.background='transparent';
  else d.style.background='#3a8a8a';
  advApplyFolderHide();   // 📂 배경과 같은 때(내 집 · 남의 집 전환 · 서버 맞춤)에 같이 맞춘다
}
/* 📂 [2026-10-02] 폴더 숨기기 — 내 집이면 내 설정, 남의 집이면 **그 집 주인의** 설정(mhdShown().hideFolders)을 따른다.
   ★ 주인이 숨겼으면 방문자에게도 안 보인다(요청). 메뉴 줄의 ✔ 는 내 설정만 보여 준다. */
function advApplyFolderHide(){
  const d=document.getElementById('advDesktop'); if(!d) return;
  const on = !!mhdShown().hideFolders;
  d.classList.toggle('mhd-hide-folders', on);
  const room=document.getElementById('mhRoomPreview');   // 📂 말랑이 폴더는 #advDesktop 바깥(형제)이라 바깥 상자에도 같은 표식 — 위 CSS 주석
  if(room) room.classList.toggle('mhd-hide-folders', on);
  const b=document.getElementById('advEnvHideFolders');
  if(b) b.textContent = (mhdDesk().hideFolders ? '✔ ' : '') + '폴더 숨기기';   // ✔ 는 켜짐 표시라 남긴다(아이콘은 뗐다 · 요청)
  if(typeof mhdFF !== 'undefined' && mhdFF) mhdFF.apply();   // 📂 자유배치도 같은 때에 — 남의 집이면 그 집 주인의 배치(검사가 이 함수만 떼어 돌려도 안전하게 typeof)
}

/* 📂 폴더 자유배치(folder-free.js) — 내 집은 내 배치(mhdDesk().folderPos), 남의 집은 **그 집 주인의** 배치(mhdShown().folderPos).
   ★ 옮길 수 있는 것: 외부 앱 폴더(.mhd-app)와 말랑이 폴더(#mlFolder). 둘 다 #mhRoomPreview 를 기준으로
     놓인다(#advDesktop 은 그 안을 꽉 채운다) — 그래서 한 좌표로 다룬다. 붙박이 아이콘(캐릭터세팅 · 좀아칼)은 그대로.
   ★ 옮기지 않은 폴더는 원래 자리 규칙을 그대로 따른다(격자 칸 · 말랑이 오른쪽 아래). */
const MHD_FF_TASKBAR = 20;   // #advTaskbar 높이 — 폴더가 작업표시줄 위로만 가게
function mhdFfItems(){
  const out = [];
  MHD_APPS.forEach(a=>{
    const e = document.getElementById(a.iconId);
    if(e) out.push({ id:a.id, el:e, reset:()=>{ e.style.right = e.style.bottom = ''; mhdPlaceIcon(e, a._slot); } });
  });
  const ml = document.getElementById('mlFolder');
  if(ml) out.push({ id:'mallang', el:ml, reset:()=>{ ml.style.left = ml.style.top = ml.style.right = ml.style.bottom = ''; } });
  return out;
}
function mhdFfPos(){ return mhdShown().folderPos || {}; }
function mhdFfInit(){
  if(mhdFF || typeof FolderFree === 'undefined') return;
  const room = document.getElementById('mhRoomPreview'); if(!room) return;
  const band = h('<div id="advFfBand">✋ 폴더를 끌어서 옮기세요'
    + '<button type="button" class="ok" id="advFfOk">완료</button><button type="button" id="advFfReset">처음 자리로</button></div>');
  room.appendChild(band);
  mhdFF = FolderFree.createFolderFree({
    room:()=>document.getElementById('mhRoomPreview'), items:mhdFfItems, getPos:mhdFfPos, band, bottomInset:MHD_FF_TASKBAR,
    canArrange:()=> advVisiting ? '남의 집에서는 폴더를 옮길 수 없어요'
                  : !myhomeStore.canEdit() ? '지금은 폴더를 옮길 수 없어요(마이홈을 받는 중이거나 미리보기 중이에요)'
                  : (mhdDesk().hideFolders ? '폴더 숨기기가 켜져 있어요 — 먼저 꺼 주세요' : ''),
    toast:(t)=>{ toast(t); },
    onSave:(pos)=>{ myhomeStore.setDesktop({ folderPos: pos }); },   // 바탕화면 한 벌에 실어 서버로(상태 주인)
    onChange:(on)=>{ const b = document.getElementById('advEnvFreeFolders'); if(b) b.textContent = (on ? '✔ ' : '') + '폴더 자유배치'; }
  });
  band.querySelector('#advFfOk').addEventListener('click', e=>{ e.stopPropagation(); mhdFF.finish(); });
  band.querySelector('#advFfReset').addEventListener('click', e=>{ e.stopPropagation(); mhdFF.resetAll(); });
  /* 말랑이 폴더는 늦게 생기고(라이선스 · 이미지 확인 뒤) 지웠다 다시 만들어진다 — 생기면 그때 자리를 잡는다.
     창 크기가 바뀌면 비율로 다시 놓는다. */
  try{ new MutationObserver(()=>mhdFF.apply()).observe(room, { childList:true }); }catch(_){}
  try{ new ResizeObserver(()=>mhdFF.apply()).observe(room); }catch(_){}
  /* 마이홈이 닫히면(어느 길로든) 배치를 끝낸다 — 다시 열었을 때 [완료] 띠가 남지 않게. */
  const ov = document.getElementById('myHomeOverlay');
  try{ mhdFF.watchHost(ov, ()=>!!ov && ov.classList.contains('on')); }catch(_){}
}
/* 📚 서랍 자리 — **바깥 오른쪽 → 바깥 왼쪽 → 창 안쪽 오른쪽** 순으로, 들어갈 수 있는 첫 자리에 세운다.
   ★ [제보 3회] 런처에서 연 마이홈은 **앱 창(Electron) 안**에 있다. 창 밖으로 나간 부분은 CSS 로는 못 살린다 —
     OS 창이 잘라낸다. 그래서 «바깥에 붙인다»만으로는 부족하고, 자리가 없으면 **창 안쪽으로 접어 넣어야** 한다.
     런처 마이홈은 760px 이고 앱 창은 그보다 조금 넓을 뿐이라, 실제로 대개 이 안쪽 자리가 쓰인다.
   ★ 좌/우만 인라인으로 정한다 — 위·아래·폭은 .adv-win.mhd-side 규칙이 잡는다.
   ⚠️ 창을 끌면 서랍은 자식이라 그냥 따라온다. 자리 계산은 열 때와 화면 크기가 바뀔 때만 한다. */
function mhdPlaceSide(w){
  if(!w) return;
  const homeWin=document.getElementById('myHomeWin');
  const width=(w.offsetWidth||320);
  let mode='out-right';
  if(homeWin){
    const r=homeWin.getBoundingClientRect();
    const vw=(window.innerWidth||document.documentElement.clientWidth||0);
    if(r.right + width + 8 <= vw)      mode='out-right';
    else if(r.left - width - 8 >= 0)   mode='out-left';
    else                               mode='in-right';   // 앱 창이 좁다 — 창 안쪽 오른쪽에 접어 넣는다
  }
  w.classList.toggle('mhd-side-in', mode==='in-right');
  /* 안쪽 자리일 때는 창보다 넓어지지 않게 — 좁은 앱 창에서 서랍이 창 왼쪽까지 밀고 나가지 않는다. */
  if(mode==='in-right' && homeWin) w.style.width = Math.max(180, Math.min(320, homeWin.getBoundingClientRect().width - 24)) + 'px';
  else w.style.width = '320px';
  w.style.left        = (mode==='out-right') ? '100%' : 'auto';
  w.style.right       = (mode==='out-left')  ? '100%' : (mode==='in-right' ? '0px' : 'auto');
  w.style.marginLeft  = (mode==='out-right') ? '8px' : '0px';
  w.style.marginRight = (mode==='out-left')  ? '8px' : '0px';
}
window.addEventListener('resize', ()=>{ MHD_SIDEWINS.forEach(id=>{ const w=document.getElementById(id); if(w && w.classList.contains('on')) mhdPlaceSide(w); }); });

function advCloseWin(id){
  const w=document.getElementById(id); if(!w) return;
  w.classList.remove('on');
  /* 📚 host:'side' 서랍은 .on 이 아니라 display 로 여닫는다(마이홈 창 바깥이라 .adv-win 규칙을 안 탄다).
     ⚠️ 관람 모드 진입에서 MHD_WINS 를 이 함수로 일괄로 닫으므로, 여기서 같이 닫아야 남의 집에 서랍이 남지 않는다. */
  if(MHD_SIDEWINS.indexOf(id)>=0){
    w.classList.remove('mhd-side-open');
    if(w._mhdSideT) clearTimeout(w._mhdSideT);
    w._mhdSideT=setTimeout(()=>{ if(!w.classList.contains('mhd-side-open')) w.style.display='none'; w._mhdSideT=0; }, 180);
  }
}
/* 서랍이 지금 열려 있는가 — 폴더를 다시 눌러 닫는 토글에 쓴다(게임 쪽에서 상태를 따로 안 들고 있게). */
function mhdSideOpen(id){ const w=document.getElementById(id); return !!(w && w.classList.contains('on')); }
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
    if(mhHooks.has(mhHooks.HOOK.SYNC_BGM_BOUNDS)) try{ mhHooks.call(mhHooks.HOOK.SYNC_BGM_BOUNDS); }catch(_){}
  });
  const end=e=>{ dragging=false; try{ bar.releasePointerCapture(e.pointerId); }catch(_){} };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
}

/* ─────────────────────────── 이벤트 ─────────────────────────── */
function advBindEvents(){
  const el=id=>document.getElementById(id);

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
  el('advBgColorInput').addEventListener('input', e=>{ advSetBg({color:e.target.value}); });
  el('advEnvFile').addEventListener('click', ()=>{
    el('advEnvMenu').classList.remove('on');
    advUploadImage('desktop:bg', 960, 720, 0.82, url=>{ advSetBg({img:url}); }, true);   // 올릴 때마다 새 주소를 받는다 — 캐시를 피하려고 주소 끝에 버전을 붙이던 것은 걷었다
  });
  el('advEnvImg').addEventListener('click', ()=>{ el('advEnvMenu').classList.remove('on'); el('advUrlInput').value=(mhdDesk().bg&&mhdDesk().bg.img)||''; el('advUrlBox').classList.add('on'); el('advUrlInput').focus(); });
  el('advUrlOk').addEventListener('click', ()=>{ const v=el('advUrlInput').value.trim(); if(v){ advSetBg({img:v}); } el('advUrlBox').classList.remove('on'); });
  el('advUrlCancel').addEventListener('click', ()=>el('advUrlBox').classList.remove('on'));
  el('advEnvReset').addEventListener('click', ()=>{ el('advEnvMenu').classList.remove('on'); advSetBg(null); });
  /* 🗂 [배경 변경 ▶] 펼침 — 외부 앱 하위메뉴(mhdMountEnv)와 같은 동작: 올리면 열리고, 누르면 토글, 벗어나면 닫힌다.
     ★ 안의 항목을 고르면 펼침도 같이 닫는다 — 안 닫으면 다음에 메뉴를 열 때 펼친 채로 나온다. */
  {
    const sub=el('advEnvBgSub');
    if(sub){
      const hd=sub.querySelector('.hd');
      if(hd) hd.addEventListener('click', ev=>{ ev.stopPropagation(); sub.classList.toggle('on'); });
      sub.addEventListener('mouseenter', ()=>sub.classList.add('on'));
      sub.addEventListener('mouseleave', ()=>sub.classList.remove('on'));
      sub.querySelectorAll('.mhd-fly button').forEach(b=>b.addEventListener('click', ()=>sub.classList.remove('on')));
    }
  }
  /* 📂 [2026-10-02] 폴더 숨기기 — 외부 앱 폴더(책장·말랑이 등)를 내 화면과 **방문자 화면** 모두에서 가린다.
     ★ 바탕화면 한 벌(배경 · 숨기기 · 자리)에 실려 서버로 간다(상태 주인 setDesktop). */
  el('advEnvHideFolders').addEventListener('click', ()=>{
    el('advEnvMenu').classList.remove('on');
    if(mhdFF && mhdFF.isArranging()) mhdFF.finish();   // 숨기기 전에 옮기던 것을 저장해 둔다
    if(!myhomeStore.canEdit()){ myhomeStore.setDesktop({}); return; }   // 받는 중 · 못 받음 · 구경 · 미리보기엔 안 바뀐다 — 안내는 상태 주인이(거짓 «숨겼어요» 를 안 띄운다)
    const hide = !mhdDesk().hideFolders;
    myhomeStore.setDesktop({ hideFolders: hide });
    advApplyFolderHide();
    toast(hide ? '폴더를 숨겼어요 — 방문자에게도 안 보여요' : '폴더를 다시 보여요');
  });

  /* 📂 폴더 자유배치 — 켜면 끌어서 옮기기, 다시 누르면(또는 띠의 [완료] · Esc) 저장. */
  el('advEnvFreeFolders').addEventListener('click', ()=>{
    el('advEnvMenu').classList.remove('on');
    if(mhdFF) mhdFF.toggle();
  });
}

/* ─────────────────────────── 관람 모드 훅 (app.js가 호출) ─────────────────────────── */
/* 폴더를 옮기던 중이면 지금 저장하고 끝낸다 — 친구 집 구경 · 방문자 시점 미리보기로 들어가기 «전에» 부른다(들어간 뒤에는 상태 주인이 고치기를 잠가 저장이 안 된다) */
mhHooks.on(mhHooks.HOOK.FINISH_ARRANGE, ()=>{ if(mhdFF && mhdFF.isArranging()) mhdFF.finish(); });
window._advApplyVisitUI = function(visiting, ownerId){
  if(mhdFF && mhdFF.isArranging()) mhdFF.finish();   // 📂 안전망 — 들어가기 «전에» FINISH_ARRANGE 고리가 저장한다(여기 오면 이미 고치기가 잠겨 있을 수 있다)
  advVisiting=!!visiting;
  // 🖥️ 방문 중 바탕화면은 openView 가 페이지와 함께 이미 받아 뒀다(요청 0 · mhdShown). 내 집으로 돌아오면 «내 홈 한 번 받기»(myhome-visit.js closeFriendHomeView)가 따로 돈다
  const d=document.getElementById('advDesktop');
  if(d) d.classList.toggle('adv-visiting', advVisiting);
  const tb=document.getElementById('advEnvBtn');
  if(tb) tb.style.display=advVisiting?'none':'';
  mhdNotifyVisit(advVisiting, ownerId);   // 🔌 외부 앱에 관람 모드 전환 통보(집주인 id 도 같이 — 구경용 자료를 받으라고)
  if(advVisiting){
    MHD_WINS.forEach(advCloseWin);   // 🔌 외부 창도 같이 닫는다
    ['advEnvMenu','advUrlBox','advFacePick'].forEach(id=>{ const e=document.getElementById(id); if(e) e.classList.remove('on'); });
  }
  advApplyBg();
};

/* 상태 주인의 값이 바뀌면(받기 끝 · 409 로 다시 받음 · 계정 바뀜) 내 바탕화면을 다시 그린다 — 같은 값이면 안 그린다 */
let _mhdSig = null, _mhdWatching = false;
function mhdWatchStore(){
  if(_mhdWatching) return;
  _mhdWatching = true;
  myhomeStore.onChange(()=>{
    const sig = JSON.stringify(mhdShown());
    if(sig === _mhdSig) return;
    _mhdSig = sig;
    advApplyBg();   // 받기 끝 · 409 · 계정 바뀜 · (미리보기 중 받기 끝)마다 지금 그리는 바탕화면으로
  });
}

/* ─────────────────────────── 초기화 ─────────────────────────── */
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', advInit);
else advInit();

}

window.TwMyHomeDesktop = { createMyHomeDesktop };   // 만드는 줄은 myhome-desktop-boot.js(app.js 가 만든 계정 칸을 deps 로 넘긴다)
