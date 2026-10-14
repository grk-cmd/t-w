/* purikura-ui.js — 📷 스티커사진 창(화면 쪽) — 촬영 창 · 로비 그리기 · 전용 씬 · 렌더러 · 키 · 매 프레임 · 촬영 · 꾸미기
   app.js 의 일곱 구역(«📷 스티커사진 — 촬영 창 + 무대» ~ «꾸미기» · 창 옮기기 · 배선)을 그대로 옮긴 모듈이다(앱 FSD 3번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 짝인 통신 계층(하루 정원 · 방 통신 · 요금)은 purikura-net.js(window.Purikura) — 이 파일은 그 «화면»이다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 이름을 읽는 방법뿐이다.
       · officeMode → officeMode() · _plPlaying → _plPlaying() · _plPlaying = v → _setPlPlaying(v)
         app.js 가 나중에 다시 대입하는 let 이라(회사원 모드 · 플레이리스트 재생) 값이 아니라 읽는 함수로 받는다.
       · Presence → Presence() · SPINE_AXIS · HEAD_AXIS · HAND_REST · SHAKE_ARM_DROOP → 이름()
         app.js 에서 createPurikuraUi 를 부르는 줄보다 **뒤에** 선언되는 const 라 만들 때 값을 읽으면 TDZ 로 선다 — 읽는 함수로 받는다.
   ★ 세션 입구 _purikura() 는 app.js 에 남겼다(🎲 주사위 · 📷 버튼도 쓴다 — 입구가 하나여야 세션 · 구독이 하나다).
     그 세션 콜백 넷(onPeers · onMeta · onEvent · onShot)은 이 모듈이 내놓는 onPeers · onMeta · onPeerEvent · onShot 으로 들어온다.
   ★ createPurikuraUi 는 app.js 의 원래 자리에서 부른다. 만들 때 바로 도는 것(맨 끝 _pkWire — 버튼 · 창 끌기 · ⎋ 사다리 등록)이
     예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ THREE · Purikura · firebaseAPI · companion · document 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwPurikuraUi — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-purikura-ui.js — 만들 때 배선 · 여닫기 · 회사원 모드 문 · BGM 재우기 · 세션 콜백 · app.js 배선 · html 순서.
         화면 규약은 sim-purikura-stage · -deco · -fish · sim-pk-fit · sim-fix-0923 이 이 파일을 읽어 본다. */
(function(){

function createPurikuraUi(deps){
const _purikura = deps.purikura;               // 📷 세션 입구(app.js) — 통신은 전부 이 하나를 지난다
const toast = deps.toast;
const getMyUserId = deps.getMyUserId;
const getDisplayName = deps.getDisplayName;
const bringWinToFront = deps.bringWinToFront;
const escRegisterWindow = deps.escRegisterWindow;
const _plRender = deps.plRender;
const _plPlaying = deps.plPlaying;             // 🎵 플레이리스트 재생 중 — app.js 의 _plPlaying(다시 대입되는 let)
const _setPlPlaying = deps.setPlPlaying;
const officeMode = deps.officeMode;            // 🏢 회사원 모드 — app.js 의 officeMode(다시 대입되는 let)
const Presence = deps.presence;                // 방 접속 — app.js 에서 이 모듈보다 뒤에 선언되는 const
const _mkFrontFill = deps.mkFrontFill;
const findMySeat = deps.findMySeat;
const setFaceMap = deps.setFaceMap;
const animateRig = deps.animateRig;
const targetFor = deps.targetFor;
const setBone = deps.setBone;
const _hueOBC = deps.hueOBC;
const _trickArmBase = deps.trickArmBase;
const _trickArmSpread = deps.trickArmSpread;
const _trickLegPose = deps.trickLegPose;
const seats = deps.seats;                      // 좌석 배열(같은 배열 — 다시 대입되지 않는다)
const _MAIN_LIGHT_COL = deps.mainLightCol;     // 💡 조명 예산 — 메인 씬과 같은 값(손으로 적지 않는다)
const _MAIN_LIGHT_INT = deps.mainLightInt;
const _KEY_LIGHT_MUL = deps.keyLightMul;
const _FILL_LIGHT_MUL = deps.fillLightMul;
const ANIMAL_HAND_REST = deps.animalHandRest;
const SPINE_AXIS = deps.spineAxis;             // 🦴 리그 상수 넷 — app.js 에서 이 모듈보다 뒤에 선언되는 const
const HEAD_AXIS = deps.headAxis;
const HAND_REST = deps.handRest;
const SHAKE_ARM_DROOP = deps.shakeArmDroop;

/* ═══════════════════════════════════════════════════════════════════════════
   📷 스티커사진 — 촬영 창 + 무대 (핸드오프 6절 4번 · 시안 purikura-design-v9.html 화면 1·2)

   ★ 이 덩이가 지키는 것 넷 — 전부 «틀려도 화면에 표시가 안 나는» 종류다.

     ① 캡처는 메인 렌더러로 못 한다.
        renderer 에 preserveDrawingBuffer 가 없어서 toDataURL() 이 빈 그림을 준다.
        그래서 무대는 **전용 씬 + 전용 렌더러**다(_thumbRenderer·cRenderer 와 같은 방식).
        조명은 메인 씬의 예산(_MAIN_LIGHT_INT · _KEY_LIGHT_MUL · _FILL_LIGHT_MUL)을 그대로 쓴다 —
        여기에 손으로 적은 숫자를 두면 조명 예산이 바뀔 때 이 화면만 조용히 어두워진다.

     ② 무대 비율 = 컷 비율.
        Purikura.stageSize() 하나가 정한다. 여기서 따로 계산하면 «보이는 것»과 «찍히는 것»이
        갈라지고, 그건 다 찍고 나서야 안다. 캡처도 같은 카메라로 컷 해상도만 올려 찍는다.

     ③ 걷기 애니메이션이 없다.
        STATE_KW 는 idle/focus/pet/sleep 넷뿐이라 좌표만 움직이면 캐릭터가 미끄러진다.
        → 이동 중에는 **제자리 흔들림**(좌우 기울기 + 상하 바운스)을 얹어 가린다.
        ⚠️ 걷기 클립이 생기면 _pkPoseChar 의 흔들림을 그 클립으로 갈아끼울 것.

     ④ 키 입력이 겹친다.
        F1~F5·i·t 는 OPEN_MODAL_SEL 에 #pkOverlay.on 을 넣어 막았고, 'b' 조준은 그 핸들러에
        한 줄을 더했다. 나머지(←→↑↓·Space·1~4)는 아래 _pkKey 가 캡처 단계에서 가져간다.
        ⚠️ 입력칸에 포커스가 있으면 손대지 않는다 — 안 그러면 어디서도 글자를 못 친다.

   ★ 요금 — 이 화면이 새로 만드는 통신은 없다.
     좌표·사건·셔터는 전부 purikura-net.js 를 지난다(10Hz · 데드밴드 · 사건은 한 번).
     정원 구독(watchQuota)은 **창이 열려 있는 동안만**이다. 접속자 전원 상시 구독으로
     만들면 아무도 안 보는 화면을 위해 하루 400번의 갱신을 전원에게 뿌리게 된다.
   ═══════════════════════════════════════════════════════════════════════════ */

/* 기본 프레임 3종 — 테두리 «선»이 아니라 여백 전체를 덮는 «판»이다.
   ⚠️ 컷마다 테두리를 그리면 컷 사이 간격이 두 겹으로 겹쳐 두꺼워진다. 구멍 뚫은 판 한 장이라
     그 일이 안 생긴다(시안 v9 fillGutter 와 같은 방식). */
const PK_BASICS = { none:{name:'투명', ink:null}, white:{name:'하양', ink:'#ffffff'},
                    black:{name:'검정', ink:'#111111'} };
/* 컷당 카운트다운(초).
   ★ 2026-08: 10 → 5. 이제 컷이 «자동으로 이어지지» 않고 방장이 📷 를 누를 때 시작하므로,
     자세와 구도를 맞추는 시간은 카운트다운 «밖»에 있다. 10초는 그냥 기다리는 시간이 된다.
   ⚠️ 잠금(3초)이 이 값의 절반을 넘는다 — 카운트다운 중에 필터·카메라를 만질 수 있는 구간이
     2초뿐이라는 뜻이다. 그래도 맞다: 만지는 자리는 이제 «누르기 전»이다. */
const PK_COUNT_SEC = 5;
const PK_AFTER_MS  = 900;     // 셔터 뒤 다음 컷까지의 사이
/* 📷 셔터 직전 «필터 잠금» 구간(초).
   ★ 필터는 방 전체가 같아야 한다 — 캡처는 각자 자기 화면에서 뜨기 때문이다(뒷배경과 같은 이유).
     그런데 셔터 직전에 바꾸면 전파가 늦은 사람의 화면에서만 옛 필터로 찍힌다. 그러면
     «같은 촬영인데 사람마다 다른 사진»이 나오고, 그건 다 찍고 나서야 안다.
   ⚠️ 잠글 때 줄을 감추지 말 것 — 있던 것이 사라지면 «고장»으로 읽힌다. 흐리게 하고 이유를 적는다. */
const PK_FILTER_LOCK_SEC = 3;
/* 🦘 점프 — 초속과 중력을 **초 단위**로 둔다.
   ⚠️ 예전에는 `jy += vy` 처럼 dt 없이 더해서, 같은 값이라도 60fps 와 20fps(비포커스 절전)에서
     점프 높이가 세 배 차이 났다. 그래서 «어떤 컴퓨터에서는 안 뛴다»가 된다.
   ★ 높이 = v0² ÷ 2g · 체공 = 2·v0 ÷ g. **높이와 빠르기는 따로 정할 수 있다** —
     둘 다 두 상수의 조합이라, 중력을 k 배로 하고 초속을 √k 배로 하면 «같은 높이에 k 배 빠른» 점프가 된다.
   ★ 2026-08: «슬로모션 같다»는 제보로 **두 배 빠르게** 했다. 중력 9.8 → 39.2(4배) ·
     초속 √4 배. 높이는 1.40 그대로이고 체공만 1.07초 → **0.53초**가 된다.
     ⚠️ 중력만 올리면 점프가 낮아지고, 초속만 올리면 높아지면서 느려진다. **둘은 한 세트다.**
   ★ 높이 1.40 은 카메라 시안에서 각과 함께 고른 값이다.
   ⚠️ 각 16°에서는 **정점의 머리가 화면 밖으로 나간다**(기본 거리 228px · 가장 멀리 169px).
     16°에서는 어떤 높이로도 못 넣는다(0.2 이하 제외) — 각을 고르면서 정해진 것이지 고장이 아니다.
     되돌리려면 카메라 각부터 다시 정할 것. sim §2 가 이 숫자를 매번 다시 센다.
   ⚠️ 남의 점프는 «눌렀다»만 받고 궤적은 각자 이 상수로 계산한다. 그래서 구버전과 섞이는 동안은
     **남의 점프가 사람마다 다른 높이로 보인다.** 배포가 끝나면 저절로 맞는다. */
const PK_JUMP_V0  = 10.47;    // 점프 초속(월드단위/초) — 높이 1.40 · 체공 0.53초
/* 🔄 몸 방향.
   ★ PK_BODY_YAW 는 «모델에 구워져 있는 기본 각»을 되돌리는 값이다. 실행 화면에서는 캐릭터가
     -0.28rad(≈-16°) 돌아간 채로 서 있고(그 각으로 센터링을 맞춰 뒀다), 메인 카메라도 5° 틀어져
     있어서 그게 자연스럽게 보인다. 무대 카메라는 정면 0° 라 그대로 두면 **몸이 비스듬히 찍힌다.**
   ⚠️ 이 값은 «모델의 기본 각»에 딸린 값이다. 캐릭터 리그의 기본 각을 바꾸면 여기도 같이 봐야 한다.
     맞지 않는 캐릭터가 있으면 Q·E 로 돌려 쓰면 된다 — 그래서 손잡이를 함께 붙였다. */
const PK_BODY_YAW = 0.28;     // 정면을 보게 되돌리는 기준 각(라디안)
/* 🎵 촬영 창 BGM.
   ⚠️ 경로는 «있는 곳 먼저» 순서다 — 때리기·클릭 소리와 같은 관례(parts/ 가 없는 배치에서도 돈다).
   ⚠️ 이 소리는 **효과음이 아니라 배경음**이라 풀(_mkSndPool)을 쓰지 않는다. 겹쳐 날 일이 없고,
     대신 loop 이 필요하다. 인스턴스 하나를 만들어 두고 창을 열 때마다 되감아 쓴다. */
const PK_BGM_SRC = ['parts/purikura-bgm.mp3', 'purikura-bgm.mp3'];
const PK_BGM_VOL = 0.32;      // 유튜브 BGM 보다 조금 낮게 — 셔터 카운트다운을 덮으면 안 된다
const PK_TURN_SPD = 2.0;      // Q·E 로 도는 속도(라디안/초) — 한 바퀴에 약 3.1초

/* 🎵 BGM — 창이 열려 있는 동안만.
   ★ 유튜브 BGM(마이홈·플레이리스트)은 **창 하나를 공유**한다(bgmMode). 그래서 재우는 것은
     `companion.pauseBgm()` **한 번**이면 되고, 대신 «누가 나고 있었는지»를 기억해 뒀다가
     닫을 때 그쪽만 되살린다.
   ⚠️ 되살릴 때 «그 사이에 사용자가 직접 다시 튼 경우»를 확인한다. 그때 또 resume 을 부르면
     두 소리가 겹친다.
   ⚠️ 회사원 모드에서는 아무 소리도 내지 않는다 — 📷 자체가 그 모드에서 안 열리지만,
     소리를 내는 자리는 예외 없이 이 게이트를 지난다는 관례를 여기서도 지킨다(사양 9번). */
let _pkBgmAudio = null, _pkBgmIdx = 0;
function _pkBgmEl(){
  if(_pkBgmAudio) return _pkBgmAudio;
  if(typeof Audio === 'undefined') return null;
  try{
    const a = new Audio(PK_BGM_SRC[_pkBgmIdx]);
    a.loop = true; a.preload = 'auto'; a.volume = PK_BGM_VOL;
    a.addEventListener('error', ()=>{
      /* 경로 폴백 — 다음 후보로 갈아탄다. 다 떨어지면 그냥 소리가 없는 것으로 둔다(창은 그대로 쓴다). */
      if(_pkBgmIdx + 1 < PK_BGM_SRC.length){ _pkBgmIdx++; _pkBgmAudio = null; }
      else console.warn('[스티커사진] BGM 파일을 못 찾았어요 —', PK_BGM_SRC.join(' / '));
    });
    try{ a.load(); }catch(_){}
    _pkBgmAudio = a;
  }catch(_){ _pkBgmAudio = null; }
  return _pkBgmAudio;
}
function _pkBgmStart(){
  if(typeof officeMode !== 'undefined' && officeMode()) return;
  const a = _pkBgmEl(); if(!a) return;
  try{ a.currentTime = 0; }catch(_){}
  a.volume = PK_BGM_VOL;
  const pr = a.play();
  /* 자동재생 잠금에 걸리면 조용히 삼키지 않는다 — 삼키면 «소리가 안 난다»의 원인을 다음에 또 못 찾는다. */
  if(pr && pr.catch) pr.catch(e=>console.warn('[스티커사진] BGM 재생이 막혔어요', e && e.name));
}
function _pkBgmStop(){
  const a = _pkBgmAudio; if(!a) return;
  try{ a.pause(); a.currentTime = 0; }catch(_){}
}
/* 남의 BGM 재우기 / 깨우기 */
function _pkHushOthers(){
  PK.hushed = null;
  if(!(window.companion && companion.pauseBgm)) return;
  const pl   = (typeof _plPlaying !== 'undefined') && !!_plPlaying();
  const home = !!(typeof window._mhBgmPlaying === 'function' && window._mhBgmPlaying());
  if(!pl && !home) return;
  try{ companion.pauseBgm(); }catch(_){}
  /* 각자의 «지금 나는 중» 표시도 내려 준다 — 안 내리면 ▶ 버튼이 재생 중인 척한다. */
  if(pl){ _setPlPlaying(false); if(typeof _plRender === 'function') _plRender(); }
  if(home && typeof window._mhBgmSetPlaying === 'function') window._mhBgmSetPlaying(false);
  PK.hushed = { pl:pl, home:home };
}
function _pkUnhushOthers(){
  const h = PK.hushed; PK.hushed = null;
  if(!h || !(window.companion && companion.resumeBgm)) return;
  /* 그 사이에 사용자가 직접 다시 틀었으면 건드리지 않는다 — 또 resume 하면 겹친다. */
  const plNow   = (typeof _plPlaying !== 'undefined') && !!_plPlaying();
  const homeNow = !!(typeof window._mhBgmPlaying === 'function' && window._mhBgmPlaying());
  if(plNow || homeNow) return;
  try{ companion.resumeBgm(); }catch(_){}
  if(h.pl){ _setPlPlaying(true); if(typeof _plRender === 'function') _plRender(); }
  if(h.home && typeof window._mhBgmSetPlaying === 'function') window._mhBgmSetPlaying(true);
}
const PK_GRAVITY  = 39.2;     // 중력(월드단위/초²) — 9.8 의 4배. ⚠️ PK_JUMP_V0 와 한 세트다
/* 컷 수의 상한. Purikura.cutsFor 가 주는 값이 세로 [1,4] · 가로 [1,2,4] 라 4 가 끝이다.
   ⚠️ 「지금 고른 컷 수(PK.cuts)」와 헷갈리지 말 것. 이건 «있을 수 있는 최대»이고,
     받은 프레임을 훑을 때처럼 **아직 컷 수를 모를 수도 있는 자리**에서 쓴다. */
const PK_MAX_CUTS = 4;

const PK = {
  open:false, slot:-1, host:false, room:null,
  orient:'p', cuts:4, basic:'white',
  up:[],                      // 컷별 올린 프레임 {cv, kb, url}
  frameSrc:{},                // 마지막으로 받은 frames 스냅샷 {컷:URL} — 다시 그릴 근거
  members:[],                 // slots 스냅샷
  peers:{}, me:null, chars:{},
  shots:[], cutIdx:-1, cutAt:0, frozen:false, state:'lobby', mouse:null, turnDirty:false,
  bgSel:['white'], seed:0, camH:0, camP:0, camSend:0, camUI:null, waitCut:-1, evSeen:{}, bgTex:null, hushed:null,
  filter:'none', fxOn:false, fLock:false, scratch:{},
  renderer:null, scene:null, cam:null, raf:0, last:0, charTry:0,
  unwatchQuota:null, unslots:null, unframes:null, quota:null,
  keys:{}, timer:0
};

/* 👑 지금 방장 자리 번호. 계층이 정한다 — 여기서 다시 세면 근거가 둘이 되어 또 갈린다.
   ⚠️ 아직 자리 배치를 못 받았으면 -1 이라 아무 자리에도 왕관이 안 붙는다(잠깐이다). */
function _pkHostSlot(){ const pk = _purikura(); return pk ? pk.hostSlot() : -1; }
function _pkIsOpen(){ return !!PK.open; }
function _pkEl(id){ return document.getElementById(id); }
function _pkP(){ return (typeof Purikura !== 'undefined') ? Purikura : null; }

/* ── 여는 문 ───────────────────────────────────────────────────────────── */
async function openPurikura(){
  if(PK.open) return;
  /* 🏢 회사원 모드 — 마지막 그물이다. 버튼 쪽에서 이미 막지만 문은 여기 하나뿐이라,
     다른 경로(단축키·복구·앞으로 생길 입구)로 들어와도 여기서 걸린다. */
  if(typeof officeMode !== 'undefined' && officeMode()){ toast('🏢 회사원 모드에서는 쓸 수 없어요'); return; }
  const pk = _purikura(); if(!pk) { toast('📷 스티커사진은 아직 준비 중이에요'); return; }
  const room = (typeof Presence()!=='undefined' && Presence().roomCode) ? Presence().roomCode() : null;
  if(!room){ toast('방에 들어간 뒤에 쓸 수 있어요'); return; }

  /* 정원은 문 앞에서 한 번 읽는다. 차감은 「촬영 시작」이다 —
     여기서 깎으면 로비만 구경하다 닫는 사람이 하루치를 갉아먹는다. */
  let q; try{ q = await pk.checkQuota(); }
  catch(e){ console.warn('[스티커사진] 정원 확인 실패', e);
            toast('📷 지금은 확인할 수 없어요 — 잠시 뒤에 다시 눌러 주세요'); return; }
  if(!q.ok){ toast(q.message); return; }

  /* 📷 이미 촬영 중이면 못 들어간다 — 카운트다운이 도는 중에 사람이 늘면 그 컷만 인원이 다르다.
     ★ **자리를 잡기 전에** 본다(peek). pk.open 은 트랜잭션으로 먼저 자리를 집으므로, 잡고 나서
       되돌리면 그 사이에 남이 못 들어온다.
     ★ 꾸미는 중(서버 state 'done')이면 방이 다시 열린다 — 촬영이 이미 끝난 국면이라 막을 이유가 없다.
     ★ 방장이 나가면 저절로 풀린다(peek 의 hostAlive). 여기서 되돌리는 쓰기는 하나도 없다.
     ⚠️ 읽기가 실패하면 peek 이 busy:false 를 준다 — 통신이 흔들렸다고 문을 잠그지 않는다. */
  let pv; try{ pv = await pk.peek(room, getMyUserId()); }catch(_){ pv = null; }
  if(pv && pv.busy){ toast('📷 지금 촬영 중이에요 — 끝나면 들어갈 수 있어요'); return; }

  /* ⚠️ 서버가 자리 쓰기를 거부하면 open 이 던진다 — 받지 않으면 버튼을 눌러도 아무 반응이 없다. */
  let r; try{ r = await pk.open(room, { userId:getMyUserId(), name:getDisplayName() }); }
  catch(e){ console.warn('[스티커사진] 자리 잡기 실패', e); r = null; }
  if(!r || !r.ok){ toast(r && r.reason==='full' ? '자리가 다 찼어요 (4명까지)' : '지금은 들어갈 수 없어요'); return; }

  PK.open = true; PK.room = room; PK.slot = r.slot; PK.host = !!r.host;
  PK.shots = []; PK.cutIdx = -1; PK.state = 'lobby'; PK.up = []; PK.frameSrc = {}; PK.keys = {};
  PK.mouse = null; PK.turnDirty = false; PK.evSeen = {}; PK.charWarn = {}; PK.charTry = 0;
  /* ⚠️ 창을 다시 열 때 반드시 되돌린다 — waitCut·seed·frozen 이 지난 촬영 값으로 남아 있으면
     로비 미리보기가 «지난 촬영의 마지막 컷» 배경 위에 그려진다(_pkCutNow 가 waitCut 을 본다). */
  PK.waitCut = -1; PK.seed = 0; PK.frozen = false; PK.lostWarned = false;
  const ov = _pkEl('pkOverlay'); ov.classList.add('on'); ov.classList.remove('shooting');
  ov.classList.remove('deco');
  _pkApplyWinPos();                      // 지난번에 끌어다 둔 자리로 (없으면 가운데)
  _pkHushOthers(); _pkBgmStart();        // 듣던 것을 재우고 이 창의 BGM 을 건다
  if(typeof bringWinToFront === 'function') bringWinToFront('pkOverlay');
  _pkSetQuota(q);

  /* 창이 열려 있는 동안만 남은 횟수를 지켜본다(창을 연 사람만 = 월 9원). */
  PK.unwatchQuota = pk.watchQuota(_pkSetQuota);
  /* 🪑 같은 스냅샷을 계층에도 넘긴다 — 계층은 slots 를 «직접 구독하지 않는다».
     [왜] 여기서 이미 받고 있는 값이라 넘기기만 하면 추가 읽기가 0건이다. 계층이 따로 구독하면
       같은 값을 두 번 내려받게 된다(4인 방이면 세션당 그만큼).
     ⚠️ 이 한 줄이 빠지면 계층의 hostSlot 이 영영 -1 이라 **아무도 방장이 아니게 된다.** */
  PK.unslots  = firebaseAPI.pkOnValue('rooms/'+room+'/_photo/slots',  o=>{
    PK.members = o || {};
    const pk2 = _purikura(); if(pk2) pk2.adoptSlots(PK.members);
    _pkPaintSlots();
    _pkPaintFilterNote();
  });
  PK.unframes = firebaseAPI.pkOnValue('rooms/'+room+'/_photo/frames', o=>{ _pkOnFrames(o||{}); });

  /* 방장이면 지금 설정을 방에 알린다. 아니면 방장이 정해 둔 것을 받는다. */
  /* ⚠️ 창을 여는 길목이라 토스트를 띄우지 않는다 — 유저가 아직 아무것도 안 골랐는데
     열자마자 경고가 뜨면 «창이 고장났다»로 읽힌다. 거부는 콘솔에만 남기고,
     실제로 못 쓰는 상태라면 유저가 무언가를 고르는 순간 _pkPushConfig 가 알려 준다. */
  if(PK.host) pk.setConfig({orient:PK.orient, cuts:PK.cuts, basic:PK.basic, bg:_pkBgStr(), filter:PK.filter, camH:PK.camH, camP:PK.camP})
    .catch(e=>console.warn('[스티커사진] 첫 설정 전송이 거부됐어요', e));
  /* 🖼️ 방장으로 로비를 잡았으면 **남아 있던 프레임 노드를 비운다.** (제보: 지난 촬영의 프레임이
       다음 판에도 계속 뜬다 — 올린 사람에게는 안 보이고 나머지에게만 보인다)
     [왜 한쪽에만 보였나] _pkOnFrames 는 `if(PK.host) return` 이다. 방장은 자기 그림을 손에 들고
       있으니 노드를 안 읽는다. 그런데 창을 다시 열면 바로 위에서 PK.up 을 [] 로 비운다 —
       **방장의 손은 비었는데 노드는 남는다.** 그래서 남들 화면에만 옛 프레임이 그려지고
       촬영에도 그대로 들어간다. 방장은 무엇이 잘못됐는지 볼 방법이 없다.
     [왜 노드가 남나] 노드를 지우는 곳은 close() 의 «마지막 한 사람» 분기뿐이다. 탭을 그냥 닫거나
       브라우저가 죽으면 onDisconnect 가 slots 만 걷어가고 그 분기는 아예 안 돈다. 꾸미기 중에
       새 사람이 들어와도 slots 가 안 비어서 마찬가지다.
     ★ 그래서 «지우는 쪽»이 아니라 «새로 잡는 쪽»에서 맞춘다 — 방장의 손과 노드를 여기서 한 번
       같은 상태(빈 것)로 맞추면, 어떤 경로로 남았든 다음 판은 깨끗하게 시작한다.
     ⚠️ 로비에서만. 촬영 중 승계에서 부르면 남은 컷의 프레임이 사라진다(_pkOnFrames 가 빈 목록을
       받아 PK.up 을 지운다). 아래 승계 자리도 같은 조건이 걸려 있다. */
  if(PK.host) _pkWipeFrames();

  _pkBuildStage();
  window.addEventListener('keydown', _pkKey, true);
  window.addEventListener('keyup',   _pkKeyUp, true);
  PK.last = performance.now();
  PK.raf = requestAnimationFrame(_pkLoop);
  /* ★ 무대 루프를 **먼저** 건다. 그리기(_pkPaintAll)가 던지면 그 뒤가 통째로 안 돌아서,
     예전에는 루프가 아예 시작되지 않아 «무대가 까맣다»가 됐다(제보 2026-08-29).
     이 순서면 최악이라도 «단추가 덜 그려진다»에서 멈춘다 — 화면이 사라지지는 않는다. */
  _pkPaintAll();
}

/* ── 닫는 문 ──
   ⚠️ 촬영 중에는 못 닫는다. 방장이 나가면 남은 사람들의 카운트다운이 영영 안 끝난다. */
function closePurikura(force){
  if(!PK.open) return false;
  /* ⚠️ «세는 중»에만 막는다. 방장이 빠지면 남은 사람의 카운트다운이 영영 안 끝나기 때문이다.
     기다리는 구간에는 도는 것이 없으므로 닫아도 된다 — 여기까지 막으면 방장이 📷 를 누를 때까지
     아무도 창을 못 닫는데, 그 구간은 이제 «시간 제한이 없다». */
  if(!force && PK.state === 'shooting' && (PK.cutIdx >= 0 || PK.frozen)){
    toast('세는 중에는 닫을 수 없어요'); return false; }
  /* 꾸미기는 서버에 아무것도 안 남긴다 — 닫으면 그대로 사라진다. 그래서 한 번은 되묻는다.
     ⚠️ 브라우저 확인창은 안 쓴다 — Electron 에서 포커스가 멈추는 함정이 있다(audit 검사 4).
       같은 버튼을 4초 안에 한 번 더 누르면 닫힌다. */
  if(!force && PK.state === 'deco' && _pkdDirty() && !(PKD.closeArm && Date.now()-PKD.closeArm < 4000)){
    PKD.closeArm = Date.now();
    toast('저장하지 않은 꾸미기가 사라져요 — 한 번 더 누르면 닫혀요');
    return false;
  }
  _pkCloseDeco();
  _pkBgmStop(); _pkUnhushOthers();       // 내 소리를 끄고, 재웠던 쪽만 되살린다
  PK.open = false;
  cancelAnimationFrame(PK.raf); PK.raf = 0;
  clearInterval(PK.timer); PK.timer = 0;
  _pkHoldStop(); clearTimeout(PK.camSend); PK.camSend = 0;   // 누르던 ▲▼ 도 같이 놓는다
  window.removeEventListener('keydown', _pkKey, true);
  window.removeEventListener('keyup',   _pkKeyUp, true);
  [PK.unwatchQuota, PK.unslots, PK.unframes].forEach(f=>{ if(f) try{ f(); }catch(_){} });
  PK.unwatchQuota = PK.unslots = PK.unframes = null;
  const pk = _purikura(); if(pk) pk.close();
  _pkDisposeStage();
  const ov = _pkEl('pkOverlay'); if(ov){ ov.classList.remove('on'); ov.classList.remove('shooting'); }
  PK.slot = -1; PK.room = null; PK.chars = {}; PK.peers = {};
  return true;
}

function _pkSetQuota(q){
  PK.quota = q;
  const el = _pkEl('pkQuota'); if(el) el.textContent = '오늘 ' + (q ? q.label : '—');
  const sb = _pkEl('pkStartBtn');
  if(sb && PK.state === 'lobby') sb.disabled = !PK.host || !(q && q.ok);
}

/* ══ 로비 그리기 ═══════════════════════════════════════════════════════ */
function _pkPaintAll(){ _pkPaintOrient(); _pkPaintCuts(); _pkPaintBasics(); _pkPaintUp(); _pkPaintBg(); _pkPaintFilter(); _pkPaintCam(); _pkPaintSlots(); _pkPaintHostNote(); }

function _pkPaintHostNote(){
  const n = _pkEl('pkHostNote'); if(!n) return;
  n.textContent = PK.host ? '' : '방향·컷·프레임은 먼저 들어온 분이 정해요';
  const sb = _pkEl('pkStartBtn'); if(sb) sb.disabled = !PK.host || !(PK.quota && PK.quota.ok);
}

function _pkPaintOrient(){
  const row = _pkEl('pkOrientRow'); if(!row) return;
  const P = _pkP();
  row.innerHTML = '';
  [['p','세로형', P.sheetW('p')+' × '+P.sheetH('p')],
   ['l','가로형', P.sheetW('l')+' × '+P.sheetH('l')]].forEach(([k,label,hint])=>{
    const b = document.createElement('button');
    b.className = (k===PK.orient) ? 'on' : '';
    b.innerHTML = label + '<small>' + hint + '</small>';
    b.disabled = !PK.host;
    b.onclick = ()=>{
      if(k === PK.orient) return;
      /* 방향이 바뀌면 컷 규격의 가로세로가 뒤집힌다 — 올린 프레임은 그대로 못 쓴다 */
      const had = PK.up.some(Boolean);
      if(had){ if(!confirm('방향을 바꾸면 프레임 규격의 가로세로가 뒤집혀서 다시 올려야 해요. 바꿀까요?')){ window.focus(); return; } window.focus(); }
      const next = P.fallbackCut(k, PK.cuts);
      /* ★ 세로형에는 2컷이 없다. 말없이 바뀌면 "내가 고른 게 아닌데"가 된다 — 먼저 알린다. */
      if(next !== PK.cuts) toast('세로형에는 2컷이 없어요 — ' + next + '컷으로 바꿨어요');
      PK.orient = k; PK.cuts = next; _pkClearUp(); if(had) _pkWipeFrames();
      _pkPushConfig(); _pkPaintAll(); _pkSizeStage();
    };
    row.appendChild(b);
  });
}

function _pkPaintCuts(){
  const row = _pkEl('pkCutRow'); if(!row) return;
  const P = _pkP();
  row.innerHTML = '';
  P.cutsFor(PK.orient).forEach(n=>{
    const g = P.gridOf(PK.orient, n);
    const hint = (g.cols===1 && g.rows===1) ? '크게 한 장'
               : (g.rows===1) ? ('좌우 '+g.cols+'장')
               : (g.cols===1) ? ('위아래 '+g.rows+'장')
               : (g.cols+'×'+g.rows+' 네 칸');
    const b = document.createElement('button');
    b.className = (n===PK.cuts) ? 'on' : '';
    b.innerHTML = n + '컷<small>' + hint + '</small>';
    b.disabled = !PK.host;
    b.onclick = ()=>{
      if(n === PK.cuts) return;
      const had = PK.up.some(Boolean);
      if(had){ if(!confirm('컷 수를 바꾸면 규격이 달라져서 올린 프레임을 다시 올려야 해요. 바꿀까요?')){ window.focus(); return; } window.focus(); }
      PK.cuts = n; _pkClearUp(); if(had) _pkWipeFrames();
      _pkPushConfig(); _pkPaintAll(); _pkSizeStage();
    };
    row.appendChild(b);
  });
  const note = _pkEl('pkCutNote');
  if(note) note.textContent = (PK.orient === 'p')
    ? '세로형에 2컷은 없어요 — 무대가 좁아 네 명이 서로 가려져요'
    : '가로형은 세로형을 90도 돌린 배치예요';
}

/* 여백 판 — 컷 구멍을 뚫은 판 한 장을 통째로 덮는다.
   ★ 미리보기와 시트 합성이 **이 함수 하나**를 쓴다. 컷마다 테두리를 그리면 컷 사이가 두 겹으로
     겹쳐 두꺼워지고, 그리는 자리가 둘이면 미리보기와 결과물이 갈라진다. */
function _pkFillGutter(g, W, H, rects, ink){
  if(!ink) return;                       // 투명 — 아무것도 안 칠한다
  g.save(); g.beginPath(); g.rect(0,0,W,H);
  rects.forEach(r=>g.rect(r[0], r[1], r[2], r[3]));   // evenodd = 이 사각형들이 «구멍»이 된다
  g.fillStyle = ink; g.fill('evenodd'); g.restore();
}

function _pkPaintBasics(){
  const row = _pkEl('pkBasicRow'); if(!row) return;
  const P = _pkP();
  row.innerHTML = '';
  /* 미리보기는 «지금 고른 방향·컷 수» 그대로 그린다 — 긴 변을 120 에 맞춰 비율을 지킨다.
     이름만 적혀 있으면 세 가지가 어떤 레이아웃으로 나오는지 눌러 봐야 알 수 있다. */
  const LONG = 120;
  const k = LONG / Math.max(P.sheetW(PK.orient), P.sheetH(PK.orient));
  const pw = Math.round(P.sheetW(PK.orient)*k), ph = Math.round(P.sheetH(PK.orient)*k);
  const rects = P.cellRects(PK.orient, PK.cuts, k);
  Object.keys(PK_BASICS).forEach(key=>{
    const b = document.createElement('button');
    b.className = (key===PK.basic) ? 'on' : '';
    b.disabled = !PK.host;
    const box = document.createElement('div');
    box.className = 'pk-fpv'; box.style.width = pw+'px'; box.style.height = ph+'px';
    const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
    const g = cv.getContext('2d');
    g.clearRect(0,0,pw,ph);                            // 바탕은 안 칠한다 — 체크무늬가 비쳐야 «투명»이 읽힌다
    rects.forEach(r=>{ g.fillStyle = '#b9c6d4'; g.fillRect(r[0], r[1], r[2], r[3]); });   // 사진 자리
    _pkFillGutter(g, pw, ph, rects, PK_BASICS[key].ink);
    box.appendChild(cv); b.appendChild(box);
    const s = document.createElement('span'); s.textContent = PK_BASICS[key].name;
    b.appendChild(s);
    b.onclick = ()=>{ PK.basic = key; _pkPushConfig(); _pkPaintBasics(); _pkPaintUp(); _pkSyncFrame(); };
    row.appendChild(b);
  });
}

/* 🎨 뒷배경 줄 — 기본 프레임 줄과 같은 모양이되, 미리보기는 **컷 «안»** 을 보여준다.
   ⚠️ 이름을 «배경»이 아니라 «뒷배경»으로 둔 이유가 있다. 여백을 칠하는 것은 «기본 프레임»이고
     이건 캐릭터 뒤에 깔려 **사진에 함께 찍히는** 판이다. 두 이름이 같으면 어느 쪽을 고르는지 갈린다. */
function _pkPaintBg(){
  const row = _pkEl('pkBgRow'); if(!row) return;
  const P = _pkP();
  row.innerHTML = '';
  P.bgList().forEach(b=>{
    const btn = document.createElement('button');
    btn.className = (PK.bgSel.indexOf(b.id) >= 0) ? 'on' : '';
    btn.disabled = !PK.host;
    const box = document.createElement('div'); box.className = 'pk-bgpv';
    const cv = document.createElement('canvas'); cv.width = 46; cv.height = 62;
    P.drawBg(cv.getContext('2d'), 46, 62, b.id);      // 무대·캡처와 같은 함수다
    box.appendChild(cv); btn.appendChild(box);
    const nm = document.createElement('span'); nm.textContent = b.name; btn.appendChild(nm);
    const sb = document.createElement('small'); sb.textContent = b.sub; btn.appendChild(sb);
    /* 여러 개 고를 수 있다 — 누르면 켜지고 다시 누르면 꺼진다.
       ⚠️ 마지막 하나는 안 꺼진다. «배경 없음»이라는 상태는 없기 때문이다. */
    btn.onclick = ()=>{
      const i = PK.bgSel.indexOf(b.id);
      if(i >= 0){
        if(PK.bgSel.length === 1){ toast('배경은 하나 이상 골라야 해요'); return; }
        PK.bgSel.splice(i, 1);
      }else{
        if(PK.bgSel.length >= _pkP().BG_MAX) return;
        PK.bgSel.push(b.id);
      }
      _pkPushConfig(); _pkPaintBg(); _pkPaintFilter(); _pkApplyBg();
    };
    row.appendChild(btn);
  });
  const note = _pkEl('pkBgNote');
  if(note){
    const nm = PK.bgSel.map(id=>P.bgOf(id).name).join(' · ');
    note.textContent = !PK.host ? ''
      : (PK.bgSel.length === 1
          ? '«' + nm + '» — 같이 찍는 분들도 이 배경으로 찍혀요.'
          : '«' + nm + '» ' + PK.bgSel.length + '개 — 컷마다 골고루 섞여요. 넷 다 같은 순서로 나옵니다.');
  }
}

/* 📷 필터 줄 — 로비와 무대 아래에 **같은 줄**이 선다(시안 filter-v1 의 «안 A»).
   ★ 두 자리가 같은 함수로 그려진다. 따로 만들면 하나만 잠기거나 하나만 갱신되는 날이 온다.
   ⚠️ 축소판은 3D 가 아니라 실루엣이다(계층의 drawFilterSample). 무대를 일곱 번 더 그릴 수는 없고,
     고르는 데 필요한 것은 «색과 결»이라 이걸로 충분하다. 진짜 모습은 바로 위 무대에 있다. */
function _pkFilterLocked(){
  if(PK.state !== 'shooting') return false;
  /* ⏸️ 기다리는 중에는 안 잠근다 — 그 구간이 «마음껏 맞추는» 자리다.
     ⚠️ 이 줄이 없으면 cutAt:0 때문에 남은 초가 0 으로 계산되어 **처음부터 잠긴 채로** 남는다. */
  if(PK.cutIdx < 0 || !PK.cutAt) return false;
  if(PK.frozen) return true;                    // 셔터가 이미 터졌다 — 이번 컷은 끝났다
  const now = (firebaseAPI.serverNow ? firebaseAPI.serverNow() : Date.now());
  const left = Math.max(0, PK_COUNT_SEC - Math.floor((now - PK.cutAt)/1000));
  return left <= PK_FILTER_LOCK_SEC;
}
function _pkPaintFilter(){
  const P = _pkP(), locked = _pkFilterLocked();
  PK.fLock = locked;
  ['pkFilterRow','pkFilterRowLobby'].forEach(id=>{
    const row = _pkEl(id); if(!row) return;
    row.classList.toggle('locked', locked);
    row.innerHTML = '';
    P.filterList().forEach(f=>{
      const btn = document.createElement('button');
      btn.className = (f.id === PK.filter) ? 'on' : '';
      btn.disabled = !PK.host || locked;
      const box = document.createElement('div'); box.className = 'pk-bgpv';
      const cv = document.createElement('canvas'); cv.width = 46; cv.height = 62;
      const g = cv.getContext('2d');
      P.drawFilterSample(g, 46, 62, _pkBgNow());   // 지금 깔릴 뒷배경 위에 걸린 모습으로 보여준다
      /* ⚠️ 축소판만 배율 1 이다 — 46px 안에서 비율대로 줄이면 도트가 0.4px 이 되어 안 보인다. */
      P.applyFilter(g, cv, 46, 62, f.id, 1, _pkScratch);
      box.appendChild(cv); btn.appendChild(box);
      const nm = document.createElement('span'); nm.textContent = f.name; btn.appendChild(nm);
      const sb = document.createElement('small'); sb.textContent = f.sub; btn.appendChild(sb);
      btn.onclick = ()=>_pkSetFilter(f.id);
      row.appendChild(btn);
    });
  });
  _pkPaintFilterNote();
}
/* 필터 안내 글. 자리가 바뀔 때도 부른다(업데이트 안 한 사람이 들어오고 나갈 때) — 축소판은 다시 안 그린다. */
function _pkPaintFilterNote(){
  const P = _pkP(), locked = _pkFilterLocked();
  /* 🆙 업데이트 안 한 참가자는 이 필터를 몰라서 그 사람 사진만 필터 없이 찍힌다. 막지 않고 방장에게만 알린다. */
  const lag = (PK.host && P.filterLaggards) ? P.filterLaggards(PK.members, PK.filter, getMyUserId()) : [];
  const lagMsg = lag.length ? lag.join(' · ') + '님은 업데이트가 필요해서 필터 없이 찍혀요' : '';
  const msg = _pkEl('pkFilterMsg');
  if(msg) msg.textContent = locked ? '곧 찍어요 — 이번 컷은 이대로'
                          : (PK.host ? lagMsg : '방장이 고른 필터예요');
  const note = _pkEl('pkFilterNote');
  if(note) note.textContent = PK.host
    ? (lagMsg || '«' + P.filterOf(PK.filter).name + '» — 사진에 그대로 구워져서 꾸미기에서는 못 되돌려요.')
    : '방장이 고른 필터로 함께 찍혀요.';
}
/* 필터를 고른 순간. ★ 촬영 중과 로비가 **다른 길로 나간다.**
   ⚠️ 촬영 중에 setConfig 를 부르면 안 된다 — 저쪽은 state:'lobby' 를 함께 써서 방 전원을
     촬영 밖으로 되돌린다. 그래서 촬영 중에는 «필터 한 칸만» 쓰는 setFilter 를 쓴다. */
function _pkSetFilter(id){
  const P = _pkP(), pk = _purikura();
  if(!PK.host || !P.filterAllowed(id)) return;
  if(_pkFilterLocked()){ toast('곧 찍어요 — 이번 컷이 끝나면 바꿀 수 있어요'); return; }
  PK.filter = id;
  _pkPaintFilter(); _pkFxSync();
  if(PK.state === 'shooting'){
    if(pk) _pkWriteGuard(pk.setFilter(id), '지금은 필터를 바꿀 수 없어요');
  }else _pkPushConfig();
}
/* 잠김 여부가 «바뀔 때만» 다시 그린다. 카운트다운은 100ms 마다 도는 자리라,
   여기서 매번 그리면 축소판 열두 장을 초당 열 번 다시 그리게 된다. */
function _pkSyncFilterLock(){
  /* 카메라 손잡이도 같은 잠금을 탄다 — 셔터 직전에 구도가 바뀌면 늦게 받은 사람만 옛 구도로
     찍는다. 그때는 «사진마다 사람 크기가 다르다»가 되어 필터보다 훨씬 눈에 띈다. */
  if(_pkFilterLocked() !== PK.fLock){ _pkPaintFilter(); _pkPaintCam(); }
}
/* 필터가 쓰는 딴 캔버스. 크기별로 하나씩 들고 돌려 쓴다 —
   매 프레임 새로 만들면 초당 60장이 쓰레기가 된다. */
/* ⚠️ tag 가 필요하다. 필터가 «자기와 같은 크기»의 딴 캔버스를 달라고 할 때(뽀샤시가 그렇다),
     태그가 없으면 **자기 자신을 돌려받아** 자기를 자기 위에 흐리게 그린다. */
function _pkScratch(w, h, tag){
  const key = (tag || 'fx') + w + 'x' + h;
  let c = PK.scratch[key];
  if(!c){ c = PK.scratch[key] = document.createElement('canvas'); c.width = w; c.height = h; }
  return c;
}

/* 🎨 지금 화면에 깔릴 뒷배경.
   ★ 하나만 골랐으면 그것, 둘 이상이면 «지금 컷»의 것이다. 씨앗은 방 하나에 하나(meta.startedAt)라
     넷이 서로 말을 안 해도 같은 값을 낸다 — 각자 주사위를 굴리면 사람마다 다른 사진이 나온다.
   ⚠️ 로비에서는 아직 컷이 없다(cutIdx = -1). 그때는 0번 컷의 것을 미리 보여준다. */
/* «지금 다루는 컷»의 번호. 세는 중이면 그 컷, 기다리는 중이면 **곧 찍을** 컷이다.
   ⚠️ 기다리는 동안 cutIdx 는 -1 이다. 그걸 0 으로 떨어뜨리면 컷마다 배경이 다른 방에서
     **매번 1번 컷 배경으로 되돌아간다** — 그러면 «촬영을 눌러야만 배경이 바뀐다»가 된다(제보).
     기다리는 구간은 «다음 컷을 미리 보는» 자리이므로 그 컷의 배경이 깔려 있어야 맞다. */
function _pkCutNow(){
  if(PK.cutIdx >= 0) return PK.cutIdx;
  if(PK.waitCut >= 0) return PK.waitCut;
  return Math.min(PK.shots.length, Math.max(0, PK.cuts - 1));
}
function _pkBgNow(){
  const P = _pkP();
  return P.bgForCut(PK.bgSel, _pkCutNow(), PK.seed);
}
function _pkBgStr(){ return _pkP().bgJoin(PK.bgSel); }

/* 🚨 방으로 나가는 쓰기가 «거부»되는 길은 둘인데, 모양이 서로 다르다.
     ① 계층이 막음  — Promise.resolve(false)   (조합·목록이 안 맞는 경우)
     ② 서버가 막음  — Promise.reject(...)      (규칙이 거부 · 통신 실패)
   [무엇을 푸는가] 예전에는 .then(ok=>…) 만 달려 있어서 **②가 통째로 사라졌다.**
     그런데 부르는 쪽은 바로 앞줄에서 자기 화면을 이미 바꿔 둔다(_pkApplyBg 등).
     그래서 ②가 나면 «내 화면만 바뀌고 남들은 그대로»인데 **아무 표시도 안 난다** —
     제보 「간헐적으로 내가 고른 배경이 다른 사람한테 적용이 안 된다」가 이 자리다.
   ★ ②가 실제로 나는 경우: 방장이 둘이 된 상태. 자리(slots)의 at 이 갱신되지 않아
     15분이 지나면 살아 있는 사람도 «죽은 세션»으로 걷어내지고, 그 사이 들어온 사람이
     0번 자리를 가져간다. 그때 옛 방장의 계층은 아직 slot===0 이라 스스로를 방장으로 알지만
     규칙(slots/0/uid === newData.host)은 거부한다.
     ⚠️ 여기는 그 사고를 **막지 않는다. 보이게만 한다.** 뿌리는 at 갱신과 slot 재판정이다.
   ⚠️ 던지지 않는다 — 여기서 다시 throw 하면 처리 안 된 거부로 남아 결국 같은 일이 된다. */
function _pkWriteGuard(p, whenFalse){
  if(!p || typeof p.then !== 'function') return;
  p.then(ok=>{ if(!ok && whenFalse) toast(whenFalse); })
   .catch(e=>{
     console.warn('[스티커사진] 방 설정 쓰기가 거부됐어요', e);
     toast('지금은 설정을 바꿀 수 없어요 — 방장이 바뀌었을 수 있어요');
   });
}

function _pkPushConfig(){
  const pk = _purikura(); if(!pk || !PK.host) return;
  /* ⚠️ false 문구가 «컷 수» 이야기인 이유: 계층이 false 를 주는 길 넷(방장 아님·컷 조합·
     뒷배경 목록·필터) 중, 화면에서 실제로 밟을 수 있는 것은 컷 조합뿐이다.
     나머지 셋은 여기 오기 전에 이미 정규화되어 있다(_pkBgStr 은 bgJoin 을 거친 값이다). */
  _pkWriteGuard(
    pk.setConfig({orient:PK.orient, cuts:PK.cuts, basic:PK.basic, bg:_pkBgStr(), filter:PK.filter, camH:PK.camH, camP:PK.camP}),
    '이 방향에는 그 컷 수를 쓸 수 없어요');
}

function _pkClearUp(){ PK.up = []; }

/* 규격(방향·컷 수)이 바뀌면 **서버 목록도 같이 비운다.**
   ⚠️ 안 비우면 남은 사람들 화면에만 옛 규격 그림이 늘어난 채로 남는다 — 방장은 자기 것을
     지웠는데 노드는 그대로라, 저쪽에는 다시 그릴 계기가 영영 안 온다.
   ★ 지우는 모양은 setFrameUrl 이 이미 쓰는 것과 같다(키에 null 을 얹는 update 한 번).
     규칙의 .validate 는 삭제에는 안 돌므로 URL 모양 검사에 걸리지 않는다.
   ⚠️ 실패해도 삼키고 넘어간다 — 통신이 흔들렸다고 규격 변경 자체를 막을 이유는 없다. */
function _pkWipeFrames(){
  if(!PK.host || !PK.room) return;
  const o = {}; for(let i=0;i<PK_MAX_CUTS;i++) o[i] = null;
  try{
    firebaseAPI.pkUpdate('rooms/'+PK.room+'/_photo/frames', o)
      .catch(e=>console.warn('[스티커사진] 프레임 목록을 못 비웠어요', e));
  }catch(e){ console.warn('[스티커사진] 프레임 목록을 못 비웠어요', e); }
}

/* ── 컷마다 프레임 올리기 ── */
function _pkPaintUp(){
  const grid = _pkEl('pkUpGrid'); if(!grid) return;
  const P = _pkP(), s = P.frameSpec(PK.orient, PK.cuts), W = s[0], H = s[1];
  PK.up.length = PK.cuts;
  for(let i=0;i<PK.cuts;i++) if(PK.up[i] === undefined) PK.up[i] = null;
  const spec = _pkEl('pkUpSpec');
  if(spec) spec.textContent = '— 장당 ' + W + ' × ' + H + ' PNG · ' + PK.cuts + '장';
  grid.style.gridTemplateColumns = 'repeat(' + Math.min(PK.cuts,4) + ',1fr)';
  grid.innerHTML = '';
  /* 미리보기 «높이»에 상한을 둔다.
     [왜] 칸을 컷 수만큼 나누므로 1컷이면 한 칸이 창 폭을 통째로 쓴다. 세로 1컷은 비율이
       1120×1520 이라 그대로 두면 높이가 780px — 로비의 다른 것이 전부 화면 밖으로 밀린다.
       4컷은 네 칸으로 나뉘어 170px 쯤이라, 컷 수만 바꿨는데 화면이 네 배로 길어진다.
     [어떻게] 폭을 «이 높이가 되는 폭»으로 묶고 가운데 정렬한다. 높이를 직접 잡지 않는 이유는
       aspect-ratio 가 폭에서 높이를 내기 때문이다 — 둘 다 잡으면 비율이 깨진다.
     ⚠️ 이건 **미리보기 크기일 뿐**이다. 올릴 파일 규격(frameSpec)은 손대지 않는다. */
  const THUMB_H_MAX = 170;
  const thumbMaxW = Math.round(THUMB_H_MAX * W / H);
  for(let i=0;i<PK.cuts;i++){
    const cell = document.createElement('div'); cell.className = 'pk-upcell';
    const th = document.createElement('div'); th.className = 'pk-thumb';
    th.style.aspectRatio = W + ' / ' + H;
    th.style.maxWidth = thumbMaxW + 'px';
    const f = PK.up[i];
    if(f && f.cv){
      const c = document.createElement('canvas'); c.width=f.cv.width; c.height=f.cv.height;
      c.getContext('2d').drawImage(f.cv,0,0); th.appendChild(c);
    }else{
      const ph = document.createElement('div'); ph.className='pk-ph'; ph.textContent=(i+1)+'번 컷';
      th.appendChild(ph);
    }
    cell.appendChild(th);
    const cap = document.createElement('div'); cap.className='pk-cap';
    cap.textContent = W + '×' + H + (f ? ' · ' + f.kb + 'KB' : '');
    cell.appendChild(cap);
    /* 🗑️ 올린 칸에는 [바꾸기]와 [비우기]가 나란히 선다 (제보: 잘못 올린 프레임을 못 지운다).
       ⚠️ 버튼이 하나일 때도 같은 줄(.pk-upbtns)에 넣는다 — 있을 때만 감싸면 «＋ 올리기» 칸의
         버튼 폭이 다른 칸과 1~2px 어긋나서 격자가 삐뚤어 보인다. */
    const bar = document.createElement('div'); bar.className = 'pk-upbtns';
    const btn = document.createElement('button');
    btn.textContent = f ? '바꾸기' : '＋ 올리기';
    btn.disabled = !PK.host;
    btn.onclick = ()=> _pkPickFrame(i);
    bar.appendChild(btn);
    if(f){
      const del = document.createElement('button');
      del.textContent = '비우기';
      del.title = (i+1) + '번 컷의 프레임을 지워요';
      del.disabled = !PK.host;
      del.onclick = ()=> _pkDropFrame(i);
      bar.appendChild(del);
    }
    cell.appendChild(bar);
    grid.appendChild(cell);
  }
  const n = PK.up.filter(Boolean).length;
  const note = _pkEl('pkLockNote');
  if(note) note.textContent = n
    ? ('올린 프레임 ' + n + '/' + PK.cuts + '장 — 안 올린 칸은 «' + PK_BASICS[PK.basic].name + '» 으로 찍혀요. 같이 들어온 분도 이대로 찍어요.')
    : ('아직 올린 프레임이 없어요 — 전부 «' + PK_BASICS[PK.basic].name + '» 으로 찍혀요.');
  const ko = _pkEl('pkKoBlack'); if(ko) ko.disabled = !PK.host;
}

/* 규격에 맞춰 가운데를 잘라 넣는다. 크기가 달라도 받되 비율은 맞춘다. */
function _pkFitToSpec(img, ko){
  const P = _pkP(), s = P.frameSpec(PK.orient, PK.cuts), W = s[0], H = s[1];
  const cv = document.createElement('canvas'); cv.width=W; cv.height=H;
  const g = cv.getContext('2d');
  const r = Math.max(W/img.width, H/img.height);
  g.drawImage(img, (W-img.width*r)/2, (H-img.height*r)/2, img.width*r, img.height*r);
  if(ko) _pkKnockoutBlack(cv);
  return cv;
}
/* 알파가 없는 PNG·JPG 도 받기 위한 장치. 가운데가 검게 칠해진 템플릿이 흔해서,
   이걸 꺼두면 사진 자리에 검은 네모만 남는다. */
function _pkKnockoutBlack(cv){
  const g = cv.getContext('2d');
  const d = g.getImageData(0,0,cv.width,cv.height), p = d.data;
  for(let i=0;i<p.length;i+=4){
    const v = Math.max(p[i], p[i+1], p[i+2]);
    if(v <= 24) p[i+3] = 0;
    else if(v <= 60) p[i+3] = Math.min(p[i+3], Math.round((v-24)/36*255));
  }
  g.putImageData(d,0,0);
}

/* 🗑️ 올린 프레임 한 칸 지우기 — 내 손과 노드를 같이 비운다.
   ★ 새 통신을 만들지 않는다. setFrameUrl(i, null) 은 _pkWipeFrames 가 이미 쓰는 «키에 null 얹기»와
     같은 모양이고, 규칙의 .validate 는 삭제에는 안 돌아서 URL 모양 검사에 안 걸린다.
   ⚠️ 화면부터 비우고 서버로 보낸다. 반대로 하면 통신이 느릴 때 «눌렀는데 안 지워진다»로 보인다.
     쓰기가 거부되면 _pkWriteGuard 가 알려 주고, 그때는 다음 로비 진입에서 _pkWipeFrames 가 정리한다.
   ⚠️ 되묻지 않는다 — 다시 올리면 그만이고, 이 창은 확인창을 못 띄운다(audit 검사 4).
   ⚠️ Storage 의 파일은 그대로 둔다. 경로가 컷 번호로 고정(…/{i}.webp)이라 다음에 올리는 그림이
     같은 자리를 덮는다 — 지우는 왕복을 한 번 더 도는 값어치가 없다. */
function _pkDropFrame(i){
  if(!PK.host) return;
  if(!PK.up[i]) return;
  PK.up[i] = null;
  _pkPaintUp(); _pkSyncFrame();
  const pk = _purikura(); if(!pk) return;
  _pkWriteGuard(pk.setFrameUrl(i, null), '프레임을 지우지 못했어요');
}

function _pkPickFrame(i){
  if(!PK.host) return;
  const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange = ()=>{
    const file = inp.files && inp.files[0]; if(!file) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{
      URL.revokeObjectURL(url);
      const ko = !!(_pkEl('pkKoBlack') && _pkEl('pkKoBlack').checked);
      const cv = _pkFitToSpec(img, ko);
      /* 전송은 WebP(알파 유지) — 같은 그림이 PNG 464KB → WebP 65KB. */
      cv.toBlob(async b=>{
        PK.up[i] = { cv:cv, kb: b ? Math.round(b.size/1024) : 0, url:null };
        _pkPaintUp(); _pkSyncFrame();
        try{
          const dataUrl = cv.toDataURL('image/webp', 0.9);
          const path = 'purikura/'+PK.room+'/'+getMyUserId()+'/'+i+'.webp';
          const u = await firebaseAPI.pkUploadFrame(path, dataUrl);
          PK.up[i].url = u;
          const pk = _purikura(); if(pk) await pk.setFrameUrl(i, u);
        }catch(e){
          /* ⚠️ 여기서 dataURL 로 폴백하지 말 것 — 그 값이 RTDB 로 가면 다운로드 단가가 40배다.
             (firebase-init.js 의 pkUploadFrame 주석 참고) 못 올렸으면 나만 보고 넘어간다. */
          console.warn('[스티커사진] 프레임 업로드 실패', e);
          toast('프레임을 올리지 못했어요 — 나한테만 보여요');
        }
      }, 'image/webp', 0.9);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); toast('이 파일은 읽지 못했어요 — PNG 나 JPG 를 올려주세요'); };
    img.src = url;
  };
  inp.click();
}

/* 남이 올린 프레임을 받는다. 방장이 아니면 URL 로 받아 그린다. */
function _pkOnFrames(o){
  /* ⚠️ 받은 목록을 **쥐고 있는다.** 이 함수는 frames 노드가 «바뀔 때만» 불린다.
     그런데 규격이 바뀌면 _pkClearUp() 이 PK.up 을 비우는데 노드는 그대로다 —
     다시 불릴 계기가 없어서 프레임이 영영 안 돌아온다. 다시 그릴 근거를 여기 남긴다. */
  PK.frameSrc = o || {};
  if(PK.host) return;                       // 내가 올린 것은 이미 손에 있다
  /* ⚠️ PK.cuts 로 훑지 않는다. meta 보다 frames 가 먼저 도착하면 이 순간의 컷 수는
       «내 지난번 값»이다. 1컷을 쥔 채로 4컷 방에 들어가면 2·3·4번 프레임이 통째로 빠지고,
       노드가 안 바뀌니 다시 받을 길도 없다. 있을 수 있는 만큼 다 받아 두고,
       그중 몇 장을 쓸지는 _pkPaintUp·_pkSyncFrame 이 PK.cuts 를 보고 정한다. */
  let pending = 0;
  for(let i=0;i<PK_MAX_CUTS;i++){
    const u = o[i];
    if(!u){ PK.up[i] = null; continue; }
    if(PK.up[i] && PK.up[i].url === u) continue;
    pending++;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      cv.getContext('2d').drawImage(img,0,0);
      PK.up[i] = { cv:cv, kb:0, url:u };
      _pkPaintUp(); _pkSyncFrame();
    };
    img.onerror = ()=>{ console.warn('[스티커사진] 프레임을 못 받았어요', i); };
    img.src = u;
  }
  if(!pending){ _pkPaintUp(); _pkSyncFrame(); }
}

/* ── 자리 ── */
function _pkPaintSlots(){
  const el = _pkEl('pkSlots'); if(!el) return;
  const P = _pkP();
  el.innerHTML = '';
  for(let i=0;i<P.MAX_SLOTS;i++){
    const m = PK.members[i];
    const d = document.createElement('div');
    d.className = 'pk-slot' + (m ? (i===_pkHostSlot() ? ' host' : '') : ' empty');
    const mine = m && m.uid === getMyUserId();
    d.innerHTML = '<div class="pk-av"></div>'
      + '<div>' + (m ? (mine ? '나' : (m.name || '손님')) : '비어 있음') + '</div>'
      + '<div class="pk-rl">' + (m ? (i===_pkHostSlot() ? '👑 시작 권한' : '참가') : '먼저 온 순서') + '</div>';
    el.appendChild(d);
  }
  /* 👑 방장 판정은 **계층 하나에서만** 나온다(isHost = 살아 있는 자리 중 가장 작은 번호).
     [옛 버그] 예전에는 여기서 slots[0].uid 를, 계층에서는 slot===0 을 각각 봤다. 근거가 둘이라
       자리가 재배치되면 갈렸고, 그때 화면은 「방장」이라는데 서버는 거부하는 상태가 됐다.
       그 거부가 조용해서(_pkWriteGuard 이전) 「내가 고른 배경이 남한테 적용이 안 된다」로 나왔다. */
  const pk3 = _purikura();
  const nowHost = !!(pk3 && pk3.isHost());
  if(nowHost !== PK.host){
    PK.host = nowHost;
    _pkPaintAll();
    /* 👑 막 승계했으면 지금 내 설정을 방에 한 번 알린다.
       [왜] 새 규칙은 meta.host 로 적힌 사람이 방장 자리의 주인인지를 본다. 승계 직후에는
         meta.host 가 아직 «나간 사람»이라, 이걸 안 하면 다음 쓰기가 통째로 거부된다.
       ⚠️ 방장이 «된» 순간에만. 잃은 순간에도 부르면 남의 방에 내 설정을 밀어 넣게 된다. */
    if(nowHost){
      _pkPushConfig();
      /* 🖼️ 승계도 «새로 잡는 쪽»이다 — 나간 방장이 올린 프레임이 노드에 남아 있으면 내 손은
         비었는데 남들 화면에만 그것이 계속 그려진다(위 openPurikura 의 같은 자리 참고).
         ⚠️ 로비에서만. 촬영 중에 부르면 아직 안 찍은 컷의 프레임이 통째로 사라진다. */
      if(PK.state === 'lobby') _pkWipeFrames();
    }
  }
  /* 🪑 자리를 잃은 경우 — 하트비트가 있으면 거의 안 나지만, 통신이 오래 끊겼다 돌아오면 난다.
     그대로 두면 좌표도 안 나가고 단추도 안 먹는데 화면은 멀쩡해 보인다(예전에는 남의 칸에
     좌표를 계속 써서 무대에서 두 사람이 겹쳤다). 한 번만 알리고 판단은 유저에게 맡긴다. */
  if(pk3 && pk3.mySlot() < 0 && !PK.lostWarned){
    PK.lostWarned = true;
    toast('자리를 잃었어요 — 창을 닫았다 다시 열어 주세요');
  }
  _pkSyncChars();
}

/* ══ 무대 — 전용 씬 + 전용 렌더러 ═════════════════════════════════════
   ⚠️ preserveDrawingBuffer:true 가 반드시 필요하다. 이게 없으면 toDataURL() 이 빈 그림을 준다
     (메인 renderer 가 그렇다 — 그래서 메인으로는 캡처를 못 한다). */
function _pkBuildStage(){
  if(PK.renderer) return;
  const cv = _pkEl('pkStage');
  PK.renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, preserveDrawingBuffer:true});
  PK.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  PK.renderer.outputEncoding = THREE.sRGBEncoding;
  PK.renderer.setClearColor(0xffffff, 1);       // 뒷배경이 정하기 전의 기본값 — _pkApplyBg 가 덮는다
  PK.scene = new THREE.Scene();
  /* 💡 조명은 메인 씬과 «같은 예산»을 쓴다.
     ⚠️ 여기에 손으로 적은 숫자를 두면 예산이 바뀔 때 이 화면만 어두워진다 —
       썸네일 렌더러가 실제로 겪었던 사고다(_ensureThumbRig 주석 참고). */
  PK.scene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
  const key = new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL);
  key.position.set(1, 2.5, 2); PK.scene.add(key);
  PK.scene.add(_mkFrontFill(_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));
  const P = _pkP();
  PK.cam = new THREE.PerspectiveCamera(P.CAM_FOV, 1, 0.05, 100);
  /* 카메라는 «눈높이보다 낮은 정면»에 고정이다. 캐릭터가 -z 로 서고, 다가오면 그것만으로 커진다.
     한 점 투영이라 카메라를 옮길 필요가 없다 — 옮기면 컷마다 구도가 흔들린다. */
  if(!PK.camH) PK.camH = P.CAM_HEIGHT;
  if(!PK.camP) PK.camP = P.CAM_PITCH;
  _pkApplyCam();
  _pkBindHoldGlobal();
  _pkSizeStage();
  _pkBindGaze();
  _pkSyncChars();
}
/* 🎚️ 지금 값으로 카메라를 세운다. 살짝 내려다본다 —
   1 앞의 점을 tan(각)만큼 내려서 보면 그게 곧 그 각이다.
   ⚠️ 기본값·한계는 계층이 정한다. 여기에 숫자를 적으면 좌우 한계·검사기와 갈라진다. */
function _pkApplyCam(){
  if(!PK.cam) return;
  PK.cam.position.set(0, PK.camH, 0);
  PK.cam.lookAt(0, PK.camH - Math.tan(PK.camP * Math.PI / 180), -1);
}
/* ▲▼ 두 쌍. 방장만 만진다 — 구도는 사진에 남는 것이라 방 전체가 하나여야 한다.
   ★ 꾹 누르면 0.4초 뒤부터 계속 움직이고, **우클릭은 큰 눈금**이다(높이 0.30 · 각도 5°).
   ★ 숫자를 누르면 기본값으로 돌아온다 — 마음껏 돌리다 원래 구도를 못 찾는 일을 막는다.
   ⚠️ 서버로는 **모아서** 보낸다(_pkCamPush). 누를 때마다 보내면 ▲ 열 번이 쓰기 열 번이다. */
function _pkPaintCam(){
  const col = _pkEl('pkCamCol'); if(!col) return;
  const P = _pkP(), locked = _pkFilterLocked();
  _pkHoldStop();                       // 다시 그리기 전에 누르고 있던 것을 먼저 놓는다
  col.classList.toggle('locked', locked);
  col.innerHTML = '';
  PK.camUI = {};
  [['높이','camH',P.CAM_H_STEP,P.CAM_H_BIG],
   ['각도','camP',P.CAM_P_STEP,P.CAM_P_BIG]].forEach(g=>{
    const box = document.createElement('div'); box.className = 'pk-camgrp';
    const up = document.createElement('button'); up.textContent = '▲';
    const lb = document.createElement('div'); lb.className = 'pk-cl'; lb.textContent = g[0];
    const vv = document.createElement('div'); vv.className = 'pk-cv';
    const dn = document.createElement('button'); dn.textContent = '▼';
    if(PK.host && !locked){
      _pkBindHold(up, g[1],  1, g[2], g[3]);
      _pkBindHold(dn, g[1], -1, g[2], g[3]);
      vv.title = '기본값으로';
      vv.onclick = ()=>{ PK[g[1]] = (g[1]==='camH') ? P.CAM_HEIGHT : P.CAM_PITCH;
                         _pkApplyCam(); _pkSyncCam(); _pkCamPush(); };
    }
    box.appendChild(up); box.appendChild(lb); box.appendChild(vv); box.appendChild(dn);
    col.appendChild(box);
    PK.camUI[g[1]] = { up:up, dn:dn, vv:vv };
  });
  /* 📷 촬영 — 각도 밑에 붙는다. 구도를 다 맞춘 «뒤에» 누르는 자리라 여기가 맞다.
     ⚠️ 방장만 보인다… 가 아니라 **모두에게 보이되 방장만 눌린다.** 숨기면 «누가 눌러야 하는지»를
       아무도 모르고, 방장이 된 순간 버튼이 갑자기 생기는 것도 «고장»으로 읽힌다
       (회사원 모드 게이트에서 정한 것과 같은 관례다). */
  const sb = document.createElement('button');
  sb.className = 'pk-shoot'; sb.id = 'pkShootBtn';
  col.appendChild(sb);
  PK.camUI.shoot = sb;
  sb.onclick = ()=>{
    if(!PK.host || PK.waitCut < 0) return;
    const i = PK.waitCut;
    PK.waitCut = -1;
    _pkNextCut(i);
  };
  _pkSyncCam();
}
/* 값과 «더 갈 수 있는가»만 제자리에서 고친다.
   ★★ 여기서 다시 «그리면» 안 된다. 누르고 있던 버튼이 사라지면서 그 버튼에 걸린 pointerup 이
     영영 안 오고, **손을 떼도 숫자가 혼자 계속 올라간다.** 실제로 그렇게 터졌다(제보 24.gif).
     꾹 누르는 동안 살아 있어야 하는 것은 «버튼 그 자체»다. */
function _pkSyncCam(){
  const P = _pkP(), U = PK.camUI; if(!U) return;
  if(U.shoot){
    const waiting = PK.state === 'shooting' && PK.waitCut >= 0;
    U.shoot.disabled = !PK.host || !waiting;
    U.shoot.textContent = waiting ? ('📷 ' + (PK.waitCut + 1) + '컷째 찍기')
                                  : (PK.state === 'shooting' ? '📷 세는 중…' : '📷 촬영');
  }
  /* ⚠️ **목록을 못 박는다.** 예전에는 통에 든 키를 «전부» 돌았는데, 나중에 붙인 📷 버튼(U.shoot)이
     같은 통에 들어가면서 «값이 없는 칸»까지 돌아 통째로 던졌다. 그 한 줄이 그리기를 멈추고,
     그리기가 멈추니 무대 루프도 안 돌아 **화면이 까맣게** 남았다(제보). 통에 무엇이 더 들어와도
     여기는 두 칸만 본다. */
  const lim = { camH:[P.CAM_H_MIN, P.CAM_H_MAX, 2, ''], camP:[P.CAM_P_MIN, P.CAM_P_MAX, 0, '°'] };
  ['camH','camP'].forEach(k=>{
    const L = lim[k], u = U[k]; if(!u) return;
    u.vv.textContent = PK[k].toFixed(L[2]) + L[3];
    /* 한계에 닿으면 흐려진다 — 눌러도 반응이 없으면 «고장»으로 읽힌다. */
    u.up.disabled = !PK.host || PK[k] >= L[1] - 1e-9;
    u.dn.disabled = !PK.host || PK[k] <= L[0] + 1e-9;
  });
}
/* 꾹 누르기. 첫 걸음은 바로, 그 다음은 0.4초 뒤부터 90ms 마다.
   ★ 반복은 **하나뿐이다**(_pkHold). 버튼마다 따로 들고 있으면 하나가 살아남는 길이 생긴다 —
     지금 터진 것이 정확히 그 종류다.
   ⚠️ 놓는 것은 **창(window)에서** 받는다. 버튼에만 걸면 «버튼 밖에서 뗀 경우»와
     «버튼이 다시 그려진 경우»에 못 받는다. 창은 안 사라진다. */
let _pkHold = null;
function _pkHoldStop(){
  if(!_pkHold) return;
  clearTimeout(_pkHold.t0); clearInterval(_pkHold.t1);
  _pkHold = null;
  _pkCamPush();                        // 다 움직인 뒤 한 번만 보낸다
}
function _pkBindHoldGlobal(){
  if(window._pkHoldBound) return;
  window._pkHoldBound = true;
  /* blur 까지 받는다 — 누른 채로 창을 떠나면 pointerup 이 아예 안 온다. */
  ['pointerup','pointercancel','blur'].forEach(ev=>window.addEventListener(ev, _pkHoldStop, true));
}
function _pkBindHold(btn, key, dir, step, big){
  btn.oncontextmenu = e=>{ e.preventDefault(); };      // 우클릭 메뉴는 막는다(큰 눈금이 그 자리다)
  btn.onpointerdown = e=>{
    if(e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    _pkHoldStop();                                     // 누르던 것이 있으면 먼저 놓는다
    const d = (e.button === 2 ? big : step) * dir;     // 우클릭이 큰 눈금이다
    _pkCamStep(key, d);
    const h = _pkHold = { t0:0, t1:0 };
    h.t0 = setTimeout(()=>{
      h.t1 = setInterval(()=>{
        /* 창이 닫혔거나 셔터 직전 잠금이 걸리면 그 자리에서 멎는다 */
        if(!PK.open || !PK.host || _pkFilterLocked()){ _pkHoldStop(); return; }
        _pkCamStep(key, d);
      }, 90);
    }, 400);
  };
}
function _pkCamStep(key, d){
  const P = _pkP();
  const v = (key === 'camH') ? P.camClampH(PK.camH + d) : P.camClampP(PK.camP + d);
  if(v === PK[key]){ _pkHoldStop(); return; }          // 한계에 닿았다 — 반복도 여기서 멎는다
  PK[key] = v;
  _pkApplyCam(); _pkSyncCam();
}
/* 모아서 보낸다 — 손을 뗀 뒤 0.4초. 점프·포즈와 같은 «한 동작에 쓰기 1회»가 된다. */
function _pkCamPush(){
  if(!PK.host) return;
  clearTimeout(PK.camSend);
  PK.camSend = setTimeout(()=>{
    /* ⚠️ 여기는 손잡이를 놓을 때마다 도는 자리라 false 문구를 안 붙인다 —
       계층이 false 를 주는 길은 «방장 아님» 하나뿐이고, 그건 단추가 이미 잠겨 있다.
       잡아야 하는 것은 서버 거부(reject)뿐이고 그건 _pkWriteGuard 가 문구를 낸다. */
    const pk = _purikura(); if(pk) _pkWriteGuard(pk.setCam(PK.camH, PK.camP), null);
  }, 400);
}

function _pkDisposeStage(){
  if(!PK.renderer) return;
  Object.keys(PK.chars).forEach(k=>_pkDropChar(k));
  try{ PK.renderer.dispose(); }catch(_){}
  if(PK.bgTex){ try{ PK.bgTex.dispose(); }catch(_){} PK.bgTex = null; }
  PK.renderer = null; PK.scene = null; PK.cam = null; PK.chars = {};
  PK.scratch = {}; PK.fxOn = false;        // 필터가 쓰던 딴 캔버스도 같이 놓는다
  /* ⚠️ 표시 상태도 함께 되돌린다. 플래그만 내리면 #pkStage 가 visibility:hidden 인 채 남아서
     **다음에 열었을 때 무대가 통째로 안 보인다** — 「나만 캐릭터가 안 나온다」로 읽히는 자리다. */
  const fx0 = _pkEl('pkStageFx'); if(fx0) fx0.style.display = 'none';
  const cv0 = _pkEl('pkStage');   if(cv0) cv0.style.visibility = 'visible';
}

/* 무대·캡처의 배경.
   ★ 단색은 텍스처 없이 clearColor 로 끝낸다 — 판 한 장을 더 그릴 이유가 없다.
   ★ 그라데이션은 캔버스에 그려 CanvasTexture 로 씌운다. THREE 의 setClearColor 는 단색만 된다.
   ⚠️ scene.background 텍스처는 **화면 전체에 늘여서** 깔린다. 그래서 텍스처를 무대와 «같은 비율»로
     그려야 한다 — 방향·컷이 바뀌면 비율이 바뀌므로 _pkSizeStage 에서 다시 그린다.
   ⚠️ 캡처는 렌더 버퍼만 컷 해상도로 키워 찍는다(비율은 같다). 그래서 이 텍스처가 그대로 사진에 들어간다. */
function _pkApplyBg(){
  if(!PK.renderer || !PK.scene) return;
  const P = _pkP(), bg = _pkBgNow(), flat = P.bgFlat(bg);
  if(PK.bgTex){ try{ PK.bgTex.dispose(); }catch(_){} PK.bgTex = null; }
  if(flat){
    PK.scene.background = null;
    PK.renderer.setClearColor(new THREE.Color(flat), 1);
    return;
  }
  const st = P.stageSize(PK.orient, PK.cuts);
  /* 긴 변을 512 로 — 무대(최대 700px)보다 넉넉하면서 텍스처로는 작은 값이다. */
  const k = 512 / Math.max(st.w, st.h);
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.round(st.w * k)); cv.height = Math.max(2, Math.round(st.h * k));
  P.drawBg(cv.getContext('2d'), cv.width, cv.height, bg);      // 로비 미리보기와 같은 함수다
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;      // 안 맞추면 무대에서만 색이 뜬다(sRGB 출력 렌더러다)
  PK.bgTex = tex;
  PK.scene.background = tex;
}

function _pkSizeStage(){
  if(!PK.renderer) return;
  const P = _pkP(), st = P.stageSize(PK.orient, PK.cuts);
  PK.renderer.setSize(st.w, st.h, false);
  const cv = _pkEl('pkStage');
  cv.style.width = st.w+'px'; cv.style.height = st.h+'px';   // 픽셀로 못 박는다 — auto 면 브라우저가 비율을 흔든다
  PK.cam.aspect = st.w/st.h; PK.cam.updateProjectionMatrix();
  const host = _pkEl('pkStageHost');
  host.style.width = st.w+'px'; host.style.height = st.h+'px';
  /* 📷 필터 겹은 **무대와 같은 크기**다(픽셀 비율 1). 그래서 화면 쪽 배율은 언제나 1 이고,
     캡처만 filterScale 배로 커진다 — 「무대 기준」이라는 말이 여기서 성립한다.
     ⚠️ 고해상도 화면에서 필터를 켜면 그만큼 덜 선명하다. 대신 매 프레임 도는 2D 한 겹이
       네 배로 무거워지는 것을 막는다. 사진은 원래 해상도 그대로라 여기서 화질을 안 버린다. */
  const fx = _pkEl('pkStageFx');
  if(fx){ fx.width = st.w; fx.height = st.h; fx.style.width = st.w+'px'; fx.style.height = st.h+'px'; }
  /* 🎚️ 무대가 넓으면 옆에 손잡이를 붙일 자리가 없다 — 창 본문이 578px 다.
     그때는 아래 가로 한 줄로 접는다. ⚠️ 미디어 쿼리로 짐작하지 않는다. 폭을 여기서 «알고» 있다.
     ⚠️ 재는 것은 무대 폭이 아니라 **테두리까지 합친 폭**이다(stageBoxW). 무대만 재면 테두리가
       두꺼운 컷(가로 4컷은 무대의 11%)에서 자리 계산이 어긋나 옆에 붙였다가 넘친다. */
  const row = _pkEl('pkStageRow');
  if(row) row.classList.toggle('wide', P.stageBoxW(PK.orient, PK.cuts) + 54 > 578);
  _pkApplyBg();                 // 비율이 바뀌었을 수 있다 — 그라데이션을 그 비율로 다시 굽는다
  _pkSyncFrame();
}

/* 무대 위 두 겹 — 여백(기본 프레임)과 올린 프레임.
   ★ 둘 다 캡처 대상(#pkStage) 밖이다. 여기 그리면 사진에 구워져서 꾸미기에서 두 겹이 된다. */
function _pkSyncFrame(){
  const host = _pkEl('pkStageHost'), ov = _pkEl('pkStageOv'); if(!host || !ov) return;
  const P = _pkP(), st = P.stageSize(PK.orient, PK.cuts), spec = P.frameSpec(PK.orient, PK.cuts);
  const k = st.w / spec[0];                       // 무대가 컷을 몇 배로 줄여 보여주는가
  host.style.borderWidth = Math.round(P.GUTTER * k) + 'px';
  host.style.borderStyle = 'solid';
  host.style.borderColor = PK_BASICS[PK.basic].ink || 'transparent';
  const i = Math.max(0, Math.min(PK.cuts-1, PK.cutIdx >= 0 ? PK.cutIdx : PK.shots.length));
  ov.width = st.w; ov.height = st.h;
  ov.style.width = st.w+'px'; ov.style.height = st.h+'px';
  const g = ov.getContext('2d'); g.clearRect(0,0,st.w,st.h);
  const uf = PK.up[i];
  if(uf && uf.cv) g.drawImage(uf.cv, 0, 0, st.w, st.h);
  const lbl = _pkEl('pkStageLbl');
  if(lbl) lbl.textContent = uf ? ((i+1)+'번 컷 프레임')
                               : ('«'+PK_BASICS[PK.basic].name+'» 프레임 · 프레임 바깥은 안 찍혀요');
}

/* ── 참가자 캐릭터 ──
   ★ 메인 씬의 좌석을 **복제해서** 무대에 세운다. def 로 다시 만들면 파츠·얼굴·톤을 전부
     다시 붙여야 하고, 그 과정에서 실행 화면과 조금씩 달라진다. 보이는 그대로가 맞다.
   ⚠️ 머티리얼은 반드시 복제할 것 — 원본을 물들이면 실행 화면 캐릭터까지 같이 바뀐다. */
/* ⚠️ **종류가 다른 두 값을 견주지 말 것.** 좌석에는 키가 둘 들어 있다 —
     `s.friendId` = 방 멤버 키(랜덤), `s.friendUserId` = 진짜 유저 ID.
     그런데 slots 에 적히는 uid 는 getMyUserId() 즉 **유저 ID** 다(openPurikura 의 pk.open 인자).
     friendId 로 견주면 영영 안 맞아서 남의 좌석을 못 찾는다.
   ★ 이 버그가 오래 안 보였던 이유 — _pkCloneChar(null) 이 null 을 주면 _pkSyncChars 가 조용히
     넘어간다. 경고도 에러도 없고, 참가자 칸은 slots 만 보고 그리므로 이름은 멀쩡히 뜬다.
     그래서 「양쪽 다 정상인데 무대만 비었다」 모양이 되어 통신 문제로 오해하게 된다.
   ⚠️ 옛 좌석(userId 가 없는 구버전 상대)을 위해 friendId 갈래를 뒤에 남겨 둔다. */
function _pkSeatOf(uid){
  if(uid === getMyUserId()) return (typeof findMySeat==='function') ? findMySeat() : null;
  return seats.find(s=>s.remote && s.friendUserId && s.friendUserId === uid)
      || seats.find(s=>s.remote && s.friendId === uid)
      || null;
}
/* 무대에 세우기 전에 «가만히 서 있는» 자세로 맞춘다.
   ★ 왜 필요한가 — 복제는 «지금 그 순간의 뼈 각도»를 그대로 가져온다. 그런데 캐릭터는 자리에서
     자고 있을 수도(sleep) 있고 빡일 중일 수도(focus) 있다. 그대로 복제하면 무대에서 **잠든 채로
     찍힌다.** 무대에는 그 상태를 계속 굴려 줄 루프가 없어서 그 자세로 굳는다.
   ★ 되돌리지 않아도 된다 — 실행 화면의 frame() 이 **다음 프레임에 상태대로 다시 칠한다.**
     그래서 여기서 건드린 것은 한 프레임 안에 저절로 낫는다(userData 처럼 finally 가 필요 없다).
   ⚠️ 눈은 뼈가 아니라 **얼굴 텍스처**다. sleep·pet·dizzy 는 감은 그림(blinkTex)으로 바꿔 두므로
     여기서 원래 그림(faceMapOrig)으로 돌려놓지 않으면 «눈 감고 찍힌 사진»이 나온다. */
function _pkNeutralPose(seat){
  try{
    if(seat.faceMat && seat.faceMapOrig && seat.blink && seat.blink.closed){
      seat.blink.closed = false;
      if(typeof setFaceMap === 'function') setFaceMap(seat.faceMat, seat.faceMapOrig);
    }
    if(seat.mixer){
      /* 클립이 있는 캐릭터 — idle 클립으로 갈아탄 «결과»가 필요하다. fadeIn 은 시간이 걸리므로
         가중치를 바로 1 로 두고 믹서를 한 번 굴려 뼈에 반영시킨다.
         seat.current 를 비워 두면 다음 프레임의 setClip 이 원래 상태로 다시 갈아준다. */
      const a = seat.actions && seat.actions.idle;
      if(a){
        if(seat.current && seat.current !== a) seat.current.stop();
        a.reset(); a.setEffectiveWeight(1); a.play();
        seat.mixer.update(0.001);
        seat.current = null;
      }
    }else if(seat.hasRig && typeof animateRig === 'function' && typeof targetFor === 'function'){
      const keep = seat.pose;
      seat.pose = Object.assign({}, targetFor('idle'));
      /* 자세값은 idle 인데 **상태만 'shaking'** 을 넘긴다. 그 둘의 유일한 차이가 팔을 아래로
         늘어뜨리는 각(SHAKE_ARM_DROOP)이다 — 무대는 서 있는 자리라 책상에 손을 올린
         평소 각으로 두면 팔이 앞으로 들린 것처럼 보인다.
         ⚠️ 본을 못 찾은 캐릭터(_pkApplyPose 가 그냥 돌아가는 경우)는 **이 한 번이 기본 자세**다. */
      animateRig(seat, performance.now(), 'shaking');
      seat.pose = keep;                          // 다음 프레임이 어차피 다시 칠하지만, 남의 값을 들고 나가지 않는다
    }
  }catch(e){ console.warn('[스티커사진] 자세 초기화 실패 — 지금 자세로 찍습니다', e); }
}

/* out 을 주면 복제된 **얼굴 재질**을 담아 돌려준다(😑 눈 감기에 쓴다).
   ★ 왜 여기서 잡는가 — 복제본에는 「어느 것이 얼굴인가」라는 표시가 없다. 이름으로 다시 찾으면
     좌석을 만들 때 쓴 판정(4519 근처)을 두 곳에 적는 셈이 되어 언젠가 한쪽만 고쳐진다.
     복제 직후에는 복제본의 재질이 **아직 원본과 같은 객체를 가리킨다.** 그래서 재질을 갈아치우는
     바로 그 자리에서 견주면 표식이 필요 없다.
   ⚠️ 🐾 동물은 귀에도 눈이 있다. 귀 재질은 원본 얼굴재질의 userData.animalEars 에 적혀 있는데,
     Material.clone() 은 userData 를 JSON 으로 베끼므로 **복제본의 그 목록은 진짜 재질이 아니다.**
     그대로 두면 setFaceMap 이 귀를 못 찾아 「얼굴은 눈 감았는데 귀만 뜬」 상태가 된다.
     그래서 귀도 여기서 같이 짝지어 담는다. */
/* 📏 **보이는 것만** 재는 상자.
   ★ [무엇이 틀렸나] `Box3.setFromObject` 는 three r128 에서 `visible` 을 **보지 않는다**
     (Raycaster 가 같은 성질이라 _setPlaceholderPickable 이 따로 있는 것과 같은 이유다).
     그런데 좌석의 bodyWrap 에는 실제 모델 말고 **숨겨 둔 placeholder(내장 스탠드인)** 가
     계속 들어 있다 — 모델이 올라오면 visible=false 로 끌 뿐 지우지는 않는다(setupSeatModel).
     그래서 무대에서 키를 1.7 로 맞출 때 「모델과 placeholder 중 큰 쪽」을 재고 있었다.
   ★ [왜 «제각각»으로 보이나] placeholder 는 **인간 크기 고정**(몸통 반지름 0.42 · 머리 0.4)이다.
       · 인간 — 크기가 비슷해서 거의 안 틀린다
       · 🐾 동물 — 40% 라 placeholder 가 이기고, 그 키에 맞춰 줄여서 **훨씬 작게 선다**
       · 큰 커미션 모델 — 모델이 이겨서 제대로 나온다
     세 종류가 각각 다르게 틀리니 「크기가 제각각」으로 보인다. 발바닥 위치(min.y)와
     좌우 중심(min.x·max.x)도 같은 상자에서 나오므로 함께 어긋난다.
   ⚠️ 계산 방식은 setFromObject 와 **똑같이** 맞춘다(지오메트리 상자를 matrixWorld 로 옮겨 합침).
     여기서 방식을 바꾸면 이 화면만 다른 규칙으로 재게 된다.
   ⚠️ 조상이 하나라도 숨겨져 있으면 뺀다 — placeholder 는 root 하나만 꺼져 있고 그 아래
     자식들은 visible=true 다. 자기 자신만 보면 안 걸러진다.
   ★ [2026-09-16 제보 5] noParts=true 면 **꾸미기 파츠(`__partWrap_*` 하위)를 뺀다.**
     [무엇이 틀렸나] 키 1.7 의 분모에 뿔·모자·큰 머리카락이 들어갔다. 파츠가 클수록 상자가 커지고
       그만큼 더 줄이니 **파츠를 쓰면 캐릭터가 작아진다** — 제보 그대로다. 실행 화면은 같은 이유로
       measureCharBox 가 파츠 래퍼 하위를 통째로 빼는데, 이 무대만 그 규칙을 안 따르고 있었다.
     ⚠️ 표식은 **이름**으로 잡는다. _pkCloneChar 가 복제 직전에 userData 를 통째로 떼어놓으므로
       복제본에는 `__twPartWrap` 도 `rigged` 도 없다. Object3D.copy 가 name 은 베끼므로 이름만 남는다.
     ⚠️ 파츠 밑의 **스킨드메시는 noParts 와 무관하게 늘 뺀다** — Box3 는 스키닝 전 원시 상자를 재서
       리깅 파츠는 발 아래로 몇 배씩 뻗은 값이 나온다(measureCharBox 의 _origBind 제외와 같은 이유).
       몸 자체의 스킨드메시(커미션 모델)는 파츠가 아니므로 그대로 잰다.
     ★ 그리기는 그대로다 — 측정에서만 빠진다. 모자는 보인다. */
function _pkVisibleBox(g, noParts){
  /* 🩹 [2026-10-02] 몸 상자(noParts)는 원본과 짝지은 표가 있으면 실행 화면 규칙으로 잰다 — _pkBodyBox 주석.
     표는 _pkCloneChar 가 복제 직후 g.__pkSrcOf 에 달아 둔다. 없으면(검사 무대 · 구 경로) 아래 예전 규칙 그대로다. */
  if(noParts && g && g.__pkSrcOf){
    const _b = _pkBodyBox(g, g.__pkSrcOf, g.__pkPh || null);
    if(_b) return _b;
  }
  g.updateWorldMatrix(true, true);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  let any = false;
  g.traverse(o=>{
    if(!o.isMesh || !o.geometry) return;
    let underPart = false;
    for(let p = o; p; p = p.parent){
      if(p.visible === false) return;
      if(typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0) underPart = true;
    }
    if(underPart && (noParts || o.isSkinnedMesh)) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if(!o.geometry.boundingBox) return;
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(tmp); any = true;
  });
  /* 보이는 메시가 하나도 없으면 예전 방식으로 돌아간다 — 0 으로 나누는 것보다 낫다. */
  return any ? box : new THREE.Box3().setFromObject(g);
}

/* 📏 [2026-10-02 제보] «리깅 파츠를 끼고 스티커사진을 찍으면 캐릭터 크기가 랜덤으로 작아지거나 난리가 난다»
   [원인] 키(1.7) 분모를 _pkVisibleBox(보이는 것만)로 쟀다. 숨은 placeholder 를 빼려던 규칙인데,
     **숨긴 몸 메쉬까지 같이 빠졌다.**
       · 리깅 옷 파츠를 입으면 기본 옷 메쉬가 숨는다(applyClothVisibility) — 한벌옷이면 몸통·다리가 통째로 빠져
         «머리만» 재고 그 키에 맞춰 키운다(난리). 윗옷만 숨으면 어깨가 빠져 폭·중심이 어긋난다.
       · 자리비움 페이드는 몸 메쉬를 visible=false 로 끈다 — 그 순간 찍으면 잴 것이 없어 옛 방식(setFromObject,
         placeholder·파츠 포함)으로 떨어진다.
     입은 파츠·자리비움 여부에 따라 결과가 달라지니 «랜덤» 으로 보였다.
   [대응] 실행 화면(measureCharBox)과 **같은 규칙**으로 잰다 — 숨김 여부와 무관하게 몸 메쉬는 세고,
     placeholder · 꾸미기 파츠(__partWrap_ · rigged · __twPartWrap) · 리깅 파츠 스킨드메시(_origBind)만 뺀다.
   ★ 복제본은 userData 가 비어 있어(_pkCloneChar 주석) **원본과 짝을 지어** 원본의 표식·정체로 판정한다.
     복제는 자식 순서를 그대로 베끼므로 나란히 훑으면 짝이 맞는다(SkeletonUtils 도 같은 방법을 쓴다).
   ⚠️ 계산 방식(지오메트리 상자 × matrixWorld)은 _pkVisibleBox 와 같다 — 이 화면 안에서 규칙이 섞이지 않게. */
function _pkPairMap(src, cl){
  const m = new Map();
  const walk = (a, b)=>{
    if(!a || !b) return;
    m.set(b, a);
    const n = Math.min(a.children.length, b.children.length);
    for(let i = 0; i < n; i++) walk(a.children[i], b.children[i]);
  };
  walk(src, cl);
  return m;
}
function _pkBodyBox(g, srcOf, ph){
  g.updateWorldMatrix(true, true);
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  let any = false;
  g.traverse(o=>{
    if(!o.isMesh || !o.geometry) return;
    const so = srcOf.get(o);
    if(so && so.userData && so.userData._origBind) return;            // 리깅 파츠 스킨드메시
    for(let p = o; p; p = p.parent){
      const sp = srcOf.get(p);
      if(ph && sp === ph) return;                                         // 숨겨 둔 placeholder
      if(typeof p.name === 'string' && p.name.indexOf('__partWrap_') === 0) return;   // 꾸미기 파츠
      if(sp && sp.userData && (sp.userData.rigged || sp.userData.__twPartWrap)) return;
    }
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if(!o.geometry.boundingBox) return;
    tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    box.union(tmp); any = true;
  });
  return any ? box : null;   // 잴 몸이 없으면 null — 부르는 쪽(_pkVisibleBox)이 예전 규칙으로 잰다
}
function _pkCloneChar(seat, out){
  if(!seat || !seat.bodyWrap) return null;
  const src = seat.bodyWrap;
  let g;
  /* ⚠️ userData 를 잠깐 떼어놓고 복제한다.
     [무엇이 터졌나] THREE 의 Object3D.copy 는 userData 를 `JSON.parse(JSON.stringify(...))` 로
       깊은 복사한다. 그런데 이 캐릭터 밑에는 장착 파츠 래퍼가 붙어 있고 거기 userData 에
       AnimationMixer(itemMixer·idleAction)와 좌석(holder)이 들어 있다 — mixer._actions[0]._mixer 가
       자기 자신으로 돌아오는 **순환 구조**라 JSON.stringify 가 통째로 던진다.
       → 복제가 실패하고 null 이 되어 무대에 아무도 안 선다(화면은 그냥 하얗다).
     [왜 이렇게 고치나] THREE 에는 «userData 를 빼고 복제»하는 갈고리가 없다. 원본을 잠깐 비우고
       복제한 뒤 되돌리는 수밖에 없다. 전부 **동기 코드**라 그 사이에 프레임이 그려지지 않는다.
     ⚠️ 되돌리기는 반드시 finally 에서 할 것. 중간에 던지면 실행 화면의 파츠가 애니메이션을
       영영 잃는다 — 그때는 «복제 실패»가 아니라 «메인 화면이 망가짐»이 된다.
     ⚠️ 복제본의 userData 는 빈 채로 둔다. 무대는 그리기만 하므로 쓸 데가 없고, 옮겨 담으면
       거기서도 같은 순환이 생긴다. */
  const stash = [];
  try{
    _pkNeutralPose(seat);                       // 잠든 자세·감긴 눈으로 찍히지 않게
    src.traverse(o=>{
      if(o.userData && typeof o.userData === 'object'){
        for(const _k in o.userData){ stash.push([o, o.userData]); o.userData = {}; break; }
      }
    });
    g = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) ? THREE.SkeletonUtils.clone(src) : src.clone(true);
  }
  catch(e){ console.warn('[스티커사진] 캐릭터 복제 실패', e); g = null; }
  finally{ stash.forEach(p=>{ p[0].userData = p[1]; }); }
  if(!g) return null;
  const srcFace = seat.faceMat || null;
  const srcEars = (srcFace && srcFace.userData && Array.isArray(srcFace.userData.animalEars))
                    ? srcFace.userData.animalEars : [];
  const ears = [];
  /* 😑 [제보 2026-09-23] "동물형으로 찍으면 3 을 눌러도 표정이 안 바뀐다."
     [원인] 재질을 **메시마다 따로** 복제했다. 원본에서 한 재질을 여러 메시가 같이 쓰면 사본은 메시 수만큼
       갈라지고, 짝으로는 **마지막으로 만난 메시의 것 하나만** 남았다. 눈이 그려진 메시가 그 하나가 아니면
       3 을 눌러도 다른 메시의 텍스처만 바뀐다 — 오류도 안 나고 화면만 그대로다.
       (동물은 몸 무늬와 표정이 한 장의 텍스처라 얼굴 재질을 여러 메시가 같이 쓸 수 있다 — animal.js.
        사람은 얼굴 재질을 한 메시만 써서 드러나지 않았다.)
     ★ 원본 재질 하나 → 사본 하나(Map). 같이 쓰던 것은 복제 뒤에도 같이 쓴다 — 짝이 하나로 정해진다.
       배열 재질 안에 든 얼굴·귀도 이제 짝이 된다(예전엔 배열이면 짝짓기를 건너뛰었다). */
  const _cl = new Map();
  /* 🩹 [2026-10-02 제보 #8] «스티커사진에서 염색한 노비 모자·목도리가 기본색으로 보인다»
     m.clone() 은 onBeforeCompile 을 안 옮긴다 → 텍스처 파츠의 색조 셰이더(_hueOBC)가 사본에서 빠진다.
     ★ 원본의 유니폼 객체를 **그대로 공유**한다(값 사본이 아니라). 그래야 무대가 떠 있는 동안 원본에서
       색을 바꿔도 같이 따라가고, 셰이더가 잡는 참조와 userData._hueU 가 한 몸으로 남는다.
     ⚠️ PS1 표식(_ps1Hooked)은 JSON 으로 true 가 따라오지만 사본에는 그 주입이 없다 — 거짓 표식을
       지워 둬야 나중에 사본에 PS1 을 걸 때 «이미 걸림» 으로 건너뛰지 않는다. */
  const _clone = (m)=>{
    if(!m || !m.clone) return m;
    let c = _cl.get(m);
    if(!c){
      c = m.clone();
      const hu = m.userData && m.userData._hueU;
      if(hu && hu.uOn){
        c.userData = c.userData || {};
        c.userData._hueU = hu;
        c.onBeforeCompile = _hueOBC(hu);
        if(c.userData._ps1Hooked){ c.userData._ps1Hooked = false; delete c.userData._ps1PrevOBC; }
        c.needsUpdate = true;
      }
      _cl.set(m, c);
    }
    return c;
  };
  g.traverse(o=>{
    if(!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = o.receiveShadow = false;
    o.material = Array.isArray(o.material) ? o.material.map(_clone) : _clone(o.material);
  });
  if(out){
    if(srcFace && _cl.has(srcFace)) out.faceMat = _cl.get(srcFace);
    for(let i=0;i<srcEars.length;i++){
      const e = srcEars[i];
      if(e && e.mat && _cl.has(e.mat)) ears.push({ mat:_cl.get(e.mat), fT:e.fT, bT:e.bT });
    }
  }
  if(out) out.ears = ears;
  /* 키를 1.7 로 맞추고 발바닥을 y=0 에 놓는다. 좌석마다 userScale 이 달라서 이걸 안 하면
     무대에서만 사람마다 키가 다르게 나온다. */
  /* 몸통 자체의 회전은 지운다 — 춤(등 대고 눕기 rotation.x = -1.5)이나 sleep 의 turnY 가
     그대로 딸려오면 무대에서 누운 채로·비스듬히 선 채로 굳는다. 방향은 아래 연출 겹이 정한다. */
  /* 🩹 [2026-10-02] 원본과 짝을 지어 둔다 — 몸 상자를 실행 화면 규칙으로 재는 데 쓴다(_pkBodyBox 주석:
     리깅 옷·자리비움 때 키가 랜덤이던 원인). 회전을 지우기 전에 달아도 무관하다(구조만 본다). */
  if(typeof _pkPairMap === 'function'){
    g.__pkSrcOf = _pkPairMap(src, g);
    g.__pkPh = (seat && seat.placeholder && seat.placeholder.root) || null;
  }
  g.rotation.set(0,0,0);
  g.updateWorldMatrix(true,true);
  /* ★ [2026-09-16 제보 5] 키는 **몸만** 잰다(noParts) — 파츠까지 재면 파츠가 클수록 캐릭터가 작아진다.
     실행 화면(measureCharBox)과 같은 규칙. 파츠 없는 캐릭터는 두 상자가 같으므로 한 픽셀도 안 바뀐다. */
  const bb = _pkVisibleBox(g, true);              // ⚠️ setFromObject 를 쓰면 숨은 placeholder 가 섞인다
  const h = Math.max(0.2, bb.max.y - bb.min.y);
  /* 🐾 동물은 조금 더 크게 세운다 — 귀 끝까지 1.7 에 맞춰지는 바람에 얼굴과 몸이 사람보다
     작게 남기 때문이다. 배율은 계층(P.ANIMAL_H)이 정한다. 여기에 숫자를 적으면 «무대에서
     보이는 크기»가 두 곳에서 정해져서, 나중에 한쪽만 고쳐진다. */
  const grow = (seat.charDef && seat.charDef.animal) ? _pkP().ANIMAL_H : 1;
  const s = _pkP().CHAR_H * grow / h;
  g.scale.multiplyScalar(s);
  g.updateWorldMatrix(true,true);
  const bb2 = _pkVisibleBox(g, true);             // 좌우 중심도 몸 상자에서 — 옆으로 뻗은 파츠에 밀리지 않게
  /* 🦶 발밑은 «보이는 것 중 가장 아래»에 맞춘다. 욕조·방석처럼 발 아래에 두는 파츠가 있으면 그것이
     바닥에 닿아야 한다(실행 화면의 FLOOR_SNAP 과 같은 뜻). 발 아래에 파츠가 없으면 두 값이 같다.
     ⚠️ 상한을 둔다 — 저작이 어긋난 파츠 하나 때문에 캐릭터가 하늘로 뜨는 것 방지(FLOOR_SNAP_MAX 와 같은 이유). */
  const bbAll = _pkVisibleBox(g, false);
  const lowest = Math.max(bb2.min.y - _pkP().CHAR_H, Math.min(bb2.min.y, bbAll.min.y));
  g.position.y -= lowest;
  g.position.x -= (bb2.min.x + bb2.max.x) / 2;
  return g;
}
/* 👀 시선 — 머리 «본»만 돌린다. 몸은 그대로 정면이다.
   ★ 실행 화면의 «액자 고정»(seat.pinned)이 쓰는 것과 같은 한계값을 쓴다 — 거기서 이미
     «사람 목이 돌아가는 범위»로 맞춰 둔 값이라, 여기서 다른 숫자를 두면 같은 캐릭터가
     화면마다 다르게 꺾인다.
   ⚠️ 마우스 좌표는 **무대 안에서만** 읽는다. 창 전체로 읽으면 대화창을 만지는 동안에도
     고개가 따라 돌아가서 «가만히 있는데 두리번거린다»가 된다. */
/* 👀 시선 — 이 셋은 «한계»가 아니라 **무대 가장자리에서의 각**(라디안)이다.
   ★ 2026-08 에 뜻이 바뀌었다. 예전에는 «마우스 위치 × 고정 배율»을 잘라 쓰는 방식이었는데,
     배율(0.6)이 커서 무대 높이의 **절반쯤에서 이미 한계에 닿았다.** 그 위로는 아무리 올려도
     고개가 안 움직여서 «상단에서는 시선이 안 따라온다»가 됐다(제보).
     거기에 카메라를 16° 기울이면서 보정(0.279)이 예전 위쪽 한계(0.25)를 통째로 먹어서,
     **위로는 처음부터 끝까지 안 움직이는** 상태가 됐다.
   → 지금은 «무대 가장자리 = 최대»로 곧게 이어 붙인다. 무대 안 어디에 있든 고개가 따라 움직이고,
     무대 밖으로 나가면 가장자리 값에서 멈춘다(예전의 «밖에서도 옆을 본다»는 성질은 그대로다).
   ⚠️ 아래(0.45)가 위(0.30)보다 큰 것은 카메라 보정(16°) 때문이다. 보정을 빼고 나면
     실제로 드는 각은 위 33° · 아래 10° 로, 위쪽이 더 넓다. */
const PK_GAZE_YAW = 0.50, PK_GAZE_PITCH_UP = 0.30, PK_GAZE_PITCH_DN = 0.45;
/* 복제본에서 «연출에 쓸 본»을 이름으로 찾아 둔다.
   ★ 실행 화면의 seat.bones/boneRest 를 기준으로 찾는다 — 이름 판별 규칙(spine·head·hand·leg)이
     거기 한 곳에만 있어야 «실행 화면에서는 팔인데 무대에서는 아닌» 일이 안 생긴다.
   ⚠️ rest(기준 자세)도 같이 복사해 둔다. setBone 은 «기준 × 델타»라 기준이 없으면 못 돌린다. */
function _pkFindBones(g, seat){
  const out = {};
  if(!g || !seat || !seat.bones || !seat.boneRest) return out;
  const want = {};
  ['head','spine','handL','handR','legL','legR'].forEach(k=>{
    if(seat.bones[k] && seat.boneRest[k]) want[seat.bones[k].name] = k;
  });
  g.traverse(o=>{
    if(!o.isBone) return;
    const k = want[o.name];
    if(k && !out[k]) out[k] = { bone:o, rest:seat.boneRest[k].clone() };
  });
  return out;
}
function _pkFindHead(g, seat){ const b = _pkFindBones(g, seat); return b.head || null; }
/* 내 시선을 «지금 마우스»에서 다시 낸다. 캐릭터가 화면 어디에 있는지도 함께 본다 —
   화면 왼쪽에 선 캐릭터가 가운데를 보려면 오른쪽으로 고개를 돌려야 한다. */
function _pkAimGaze(c){
  if(!PK.mouse || !PK.cam || !c.group){ c.gz = 0; c.gp = 0; return; }
  const v = new THREE.Vector3();
  /* ★ 기준점은 «진짜 머리»다. 있으면 머리 본을 그대로 쓴다.
     [무엇이 틀렸나] 예전에는 발밑에서 키의 90% 를 더해 «머리 언저리»를 짐작했다. 그 짐작은
       사람 키(1.7)를 전제로 한 것이라, 동물처럼 크기가 다른 캐릭터에서는 **가슴이나 허공**을
       가리켰다. 그러면 마우스를 위로 올려도 «이미 마우스보다 위»라 고개가 안 든다. */
  const hb = c.head && c.head.bone;
  if(hb){ hb.updateWorldMatrix(true, false); v.setFromMatrixPosition(hb.matrixWorld); }
  else{
    c.group.updateWorldMatrix(true, false);
    v.setFromMatrixPosition(c.group.matrixWorld);
    v.y += _pkP().CHAR_H * (c.grow || 1) * 0.9;    // 본이 없는 캐릭터의 짐작값
  }
  v.project(PK.cam);
  /* ★ «머리에서 화면 끝까지 남은 만큼»으로 나눈다 — 그래야 어디에 서 있든 화면 끝에서 최대가 된다.
     [무엇이 틀렸나] 예전에는 차이(dx·dy)를 그냥 ±1 로 잘랐다. 그런데 그 차이가 가질 수 있는
       최대치는 **머리가 화면 어디에 있느냐**에 따라 다르다. 렌즈를 낮추면 캐릭터가 화면 위쪽으로
       올라가고, 머리 위에 남은 공간이 0.2 밖에 안 되면 마우스를 천장까지 올려도 고개가 20% 만 든다
       — 「상단에서 시선이 잘 안 따라간다」가 그것이었다(제보 · 높이 0.65 · 각 14°).
     ⚠️ 나누는 값에 바닥(0.35)을 둔다. 머리가 화면 끝에 붙으면 0 으로 나누게 되고, 그 직전에는
       마우스를 조금만 움직여도 고개가 홱 돌아간다.
     ⚠️ 머리가 화면 밖일 수 있다(낮은 렌즈에서 실제로 그렇다). 기준점을 화면 안으로 접어서
       «위로 올릴 여지»가 사라지지 않게 한다. */
  const cl = (u)=>Math.max(-1, Math.min(1, u));
  const room = (edge)=>Math.max(0.35, edge);
  const vx = cl(v.x), vy = cl(v.y);
  const nx = (PK.mouse.x - vx) / room(PK.mouse.x > vx ? 1 - vx : 1 + vx);
  const ny = (PK.mouse.y - vy) / room(PK.mouse.y > vy ? 1 - vy : 1 + vy);
  /* ★ 렌즈가 아래로 기운 만큼 고개를 든다(음수가 «위»다). 이걸 안 넣으면 마우스를 얼굴에
     맞춰 놔도 고개가 정면을 향해서, 넷 다 **살짝 아래를 보는 사진**이 된다.
     ⚠️ 보정은 자르기 **뒤에** 뺀다. 같이 잘라 버리면 각이 한계에 가까울 때 보정만으로 한계에
       닿아서, 위로는 아예 안 움직이게 된다. */
  const tilt = PK.camP * Math.PI / 180;        // 지금 각이다 — 상수가 아니다(방장이 움직인다)
  c.gz = cl(nx) * PK_GAZE_YAW;
  const aim = (ny > 0) ? -cl(ny) * PK_GAZE_PITCH_UP : -cl(ny) * PK_GAZE_PITCH_DN;
  c.gp = aim - tilt;
}
function _pkApplyGaze(c){
  if(!c.head) return;   // ★ 포즈(_pkApplyPose)보다 **뒤에** 불린다 — 머리는 시선이 마지막에 정한다.
  const g = c.gz || 0, p = c.gp || 0;
  if(typeof setBone === 'function') setBone(c.head.bone, c.head.rest, HEAD_AXIS()*p, g, 0);
}
/* 마우스는 **창 전체**에서 읽는다.
   [처음엔 무대 안에서만 읽었다] 무대를 벗어나면 정면으로 돌렸는데, 그러면 화면 가장자리를
     보게 하려고 마우스를 조금만 밀어도 고개가 툭 돌아와 «밖에서는 안 먹는다»가 됐다.
     시선은 어차피 ±0.5rad 로 잘리므로, 멀리 나가도 옆을 계속 보는 것으로 끝난다.
   ⚠️ 촬영 중일 때만, 그리고 **입력칸에 포커스가 없을 때만** 읽는다. 대화창에 글자를 치는 동안
     고개가 마우스를 쫓아가면 «가만히 있는데 두리번거린다»가 된다. */
function _pkBindGaze(){
  if(window._pkGazeBound) return;
  window._pkGazeBound = true;
  window.addEventListener('pointermove', e=>{
    if(!PK.open || PK.state !== 'shooting' || _pkTyping()){ return; }
    const host = _pkEl('pkStageHost'); if(!host) return;
    const r = host.getBoundingClientRect(); if(!r.width || !r.height) return;
    PK.mouse = { x:((e.clientX-r.left)/r.width)*2-1, y:-((e.clientY-r.top)/r.height)*2+1 };
  }, true);
}

function _pkDropChar(slot){
  const c = PK.chars[slot]; if(!c) return;
  if(c.group && PK.scene) PK.scene.remove(c.group);
  /* ⚠️ 지오메트리는 **버리지 말 것.** SkeletonUtils.clone 은 지오메트리를 원본과 «공유»한다 —
     여기서 dispose 하면 실행 화면의 그 캐릭터가 통째로 사라진다.
     머티리얼은 위에서 복제한 내 것이라 버려도 된다(텍스처는 공유라 안 버려진다). */
  try{ c.group.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m=>{ if(m && m.dispose) m.dispose(); });
  }); }catch(_){}
  delete PK.chars[slot];
}
/* slots 가 바뀔 때마다 무대 인원을 맞춘다.
   ★ 기준은 «칸»이 아니라 **«사람(uid)»** 이다. 이 함수가 칸만 보던 시절에 난 고장이 둘이다.

     ① 같은 사람이 두 칸에 보이는 순간 — **「내 캐릭터만 둘 보인다」의 정체.**
        slots 에서 «한 사람 한 칸»이 지켜지는 것은 open() 의 트랜잭션 **안**에서뿐이다.
        낡은 자리가 걷히는 쓰기와 새 자리가 적히는 쓰기는 서로 다른 쓰기이고, onValue 는
        빠르게 이어지는 변화를 **합쳐서** 한 번만 준다. 그 합쳐진 스냅샷에는 같은 uid 가
        두 칸에 들어 있을 수 있다. 그러면 _pkSeatOf 가 같은 좌석을 두 번 돌려주고,
        무대에 같은 사람이 둘 선다. 내 uid 에 걸리면 내 캐릭터가 둘이 되고, 이건 **받는
        쪽에서만** 일어나므로 상대 화면은 멀쩡하다 — 제보의 모양이 정확히 이것이다.
        ⚠️ 방(rooms) 쪽은 이미 같은 장치를 갖고 있다(firebase-init 의 _byUser 중복제거,
          「캐릭터가 증식돼 보이던 문제」). 같은 사고가 여기서 다시 난 것이라 여기도 거른다.

     ② 자리를 물려받는 순간 — 앞사람이 빠지고 뒷사람이 같은 칸에 들어온 것이 한 스냅샷으로
        합쳐지면, 칸만 보는 «이미 있으니 넘어간다»가 **옛 사람을 무대에 그대로 남긴다.**
        방을 나간 사람이 사진에 찍히고, 새로 온 사람은 영영 안 선다.

   ⚠️ 그러니 `PK.chars[i]` 가 있다고 넘어가지 말 것. **그 칸의 사람이 그대로인지**를 볼 것. */
function _pkSyncChars(){
  if(!PK.scene) return;
  const P = _pkP();
  /* 같은 사람이 여러 칸에 있으면 **앞 칸만** 남긴다. 뒤 칸은 걷히는 중인 낡은 자리다
     (open() 은 빈 칸을 앞에서부터 채우므로, 새 자리가 앞·낡은 자리가 뒤일 수도 있다.
      어느 쪽이든 «한 사람은 한 번만 선다»가 지켜지면 화면은 옳다). */
  const live = {}, seen = {};
  for(let i=0;i<P.MAX_SLOTS;i++){
    const m = PK.members[i];
    if(!m || !m.uid) continue;
    if(seen[m.uid]) continue;
    seen[m.uid] = 1; live[i] = m;
  }
  const n = Object.keys(live).length;
  for(let i=0;i<P.MAX_SLOTS;i++){
    const m = live[i];
    /* ⚠️ 표식도 같이 지운다. 안 지우면 그 칸이 빈 뒤에도 «아직 못 세운 사람»으로 남아서
       무대 루프의 1초 재시도가 촬영이 끝날 때까지 계속 돈다. */
    if(!m){ _pkDropChar(i); if(PK.charWarn) delete PK.charWarn[i]; continue; }
    /* 🆔 사람이 그대로면 그대로 둔다. 바뀌었으면 **버리고 다시 세운다.** */
    if(PK.chars[i] && PK.chars[i].uid === m.uid) continue;
    if(PK.chars[i]) _pkDropChar(i);
    const seat = _pkSeatOf(m.uid);
    const face = {};                            // 😑 복제된 얼굴·귀 재질을 받아 온다
    const g = _pkCloneChar(seat, face);
    /* ★ 여기가 **조용히 실패하던 자리**다. 좌석을 못 찾아도(_pkSeatOf 가 null) 복제가 실패해도
       그냥 넘어가서, 화면에는 「참가자 칸에는 이름이 뜨는데 무대만 비었다」로만 나타났다.
       원인이 통신처럼 보여서 엉뚱한 데를 파게 된다 — 그래서 흔적을 남긴다.
       ⚠️ 토스트는 띄우지 않는다. 남의 사정이고, 촬영 중에 뜨면 사진에 걸린다. */
    if(!g){
      /* ⚠️ 표식을 PK.chars 에 넣지 말 것 — 그 객체는 매 프레임 순회되는 «무대 인원» 목록이다.
         숫자가 아닌 값을 끼우면 _pkPoseChar 가 그것도 캐릭터로 알고 손을 댄다. */
      PK.charWarn = PK.charWarn || {};
      if(!PK.charWarn[i]){ PK.charWarn[i] = 1;   // 자리당 한 번만 — 매 sync 마다 도배하지 않는다
        console.warn('[스티커사진] 무대에 못 세웠어요 — slot ' + i +
          ' · uid=' + m.uid + ' · 좌석 ' + (seat ? '찾음' : '못 찾음') +
          (seat ? (' · bodyWrap ' + (seat.bodyWrap ? '있음' : '없음')) : ''));
      }
      continue;
    }
    if(PK.charWarn) delete PK.charWarn[i];
    /* ★ 겹을 하나 더 둔다: holder(자리) > pose(연출) > g(키·발바닥 보정).
       [왜] 연출(_pkPoseChar)은 매 프레임 scale 과 position.y 를 **덮어쓴다.** 그것을 g 에 바로
         걸면 _pkCloneChar 가 맞춰 놓은 «키 1.7 · 발바닥 y=0» 이 첫 프레임에 통째로 날아간다.
         좌석마다 userScale 이 달라서 그 배율은 0.05 인 경우도 있고, 그러면 캐릭터가 20배로
         커져 카메라가 몸 안에 들어간다 — 뒷면이 잘려 **화면이 하얗게 빈다.**
       ⚠️ 연출을 g 에 직접 걸지 말 것. 이 겹이 있으면 연출은 항등 상태에서 시작한다. */
    const pose = new THREE.Group(); pose.add(g);
    const holder = new THREE.Group(); holder.add(pose);
    /* 처음 서는 자리 — 가운데를 기준으로 좌우로 벌리고, 앞뒤도 조금 어긋나게 둔다.
       완전히 나란히 세우면 겹칠 때 누가 앞인지 안 읽힌다. */
    holder.position.set((i - (Math.max(1,n)-1)/2) * P.BODY_W, 0, -(4.2 + i*0.25));
    PK.scene.add(holder);
    PK.chars[i] = { uid:m.uid,          // ★ 이 칸에 «누가» 서 있는지 — 다음 sync 의 판단 근거다
                    group:holder, inner:pose, wx:holder.position.x, d:4.2 + i*0.25,
                    jy:0, jt:0, pose:0, dir:1, t:Math.random()*9, moving:false, baseRotY:0,
                    bones:_pkFindBones(g, seat), gz:0, gp:0, yaw:0,
                    /* 팔 기본각은 좌석에서 가져온다 — 동물은 사람과 다른 값을 쓴다(ANIMAL_HAND_REST) */
                    armBase:(seat && seat.charDef && seat.charDef.animal) ? ANIMAL_HAND_REST : HAND_REST(),
                    /* 🐾 동물은 더 크게 세운다(ANIMAL_H) — 머리 본이 없는 캐릭터의 짐작값에 쓴다. */
                    grow:(seat && seat.charDef && seat.charDef.animal) ? P.ANIMAL_H : 1,
                    animal:!!(seat && seat.charDef && seat.charDef.animal),
                    /* 😑 눈 감기(3). 텍스처는 좌석 것을 **공유**한다 — 그림을 새로 만들지 않으므로
                       메모리가 안 늘고, _pkDropChar 가 재질만 버려도 좌석 쪽이 멀쩡하다.
                       ⚠️ blinkTex 가 없는 캐릭터가 있다. 그때는 눌러도 아무 일이 없어야 한다. */
                    faceMat:face.faceMat || null, faceMapOrig:(seat && seat.faceMapOrig) || null,
                    blinkTex:(seat && seat.blinkTex) || null, ears:face.ears || [], blinkOn:false,
                    standLeft:(Math.random() < 0.5) };
    PK.chars[i].head = PK.chars[i].bones.head || null;
    _pkClampX(PK.chars[i]);
  }
}
/* 😑 무대 캐릭터의 눈 — 뼈가 아니라 **얼굴 텍스처**다.
   ★ 그래서 포즈(1·2)와 겹쳐도 서로 안 건드린다. 1+3, 2+3 이 저절로 되는 이유가 이것이다.
     같은 변수에 섞지 말 것 — 섞으면 「포즈를 풀면 눈도 떠진다」가 된다.
   ★ 사진에는 따로 처리할 것이 없다. _pkCapture 는 무대를 그대로 굽는다.
   ⚠️ 귀는 setFaceMap 에 못 맡긴다. 그쪽은 재질의 userData 에 적힌 귀 목록을 보는데,
     복제본의 userData 는 JSON 으로 베낀 껍데기라 진짜 재질이 아니다(_pkCloneChar 주석).
     그래서 여기서 _pkCloneChar 가 짝지어 둔 목록으로 직접 갈아 끼운다.
   반환값은 **이유**다 — 'ok' | 'no-mat'(복제에서 얼굴 재질을 못 찾았다) | 'no-tex'(눈감음 그림이 없다).
   ★ 참/거짓 하나로 두면 「눌렀는데 안 된다」의 원인이 둘로 갈리는데 화면에서는 구별이 안 된다.
     하나는 캐릭터에 그림이 없는 것(정상)이고, 하나는 짝짓기가 실패한 것(버그)이다. */
function _pkSetBlink(c, on){
  if(!c) return 'no-mat';
  if(!c.faceMat) return 'no-mat';
  const tex = on ? c.blinkTex : c.faceMapOrig;
  if(!tex) return 'no-tex';
  c.blinkOn = !!on;
  if(typeof setFaceMap === 'function') setFaceMap(c.faceMat, tex);
  (c.ears || []).forEach(e=>{
    const t = on ? e.bT : e.fT;
    if(e.mat && t && e.mat.map !== t){ e.mat.map = t; e.mat.emissiveMap = t; e.mat.needsUpdate = true; }
  });
  return 'ok';
}

/* 각을 -π~π 안으로 접는다. 안 접으면 계속 돌릴 때 숫자가 끝없이 커져
   전송 자릿수가 늘고(규칙의 길이 상한 24) 보간도 엉뚱한 쪽으로 돈다. */
function _pkWrapPi(a){
  a = a % (Math.PI*2);
  if(a >  Math.PI) a -= Math.PI*2;
  if(a < -Math.PI) a += Math.PI*2;
  return a;
}
function _pkClampX(c){
  const P = _pkP();
  /* 화면 밖으로 못 나가게 — 거리에 따라 허용 폭이 달라지므로 **월드 좌표로** 잘라야 한다.
     몸통 반쪽을 빼서 어깨가 잘리지 않게 한다. */
  /* ⚠️ «지금 카메라»를 넘긴다. 방장이 높이·각을 움직이면 화면에 담기는 폭도 같이 바뀐다 —
     상수를 그대로 쓰면 가장자리에서 몸이 살짝 잘리고, 그건 눈에 잘 안 띈다.
     ⚠️ 여기서 다시 계산하지 않는다. «얼마나 걸쳐 나가도 되는가»는 계층(xLimit)이 정한다 —
       화면이 따로 빼면 내 화면에서만 더 갈 수 있게 되고, 남의 화면에서는 툭 멈춰 보인다. */
  const half = P.xLimit(PK.orient, PK.cuts, c.d, PK.camH, PK.camP);
  c.wx = Math.max(-half, Math.min(half, c.wx));
}

/* ══ 키 ══════════════════════════════════════════════════════════════
   ⚠️ 캡처 단계에서 가져가되, **입력칸에 포커스가 있으면 손대지 않는다.**
     안 그러면 촬영 창이 열린 동안 어디서도 글자를 못 친다(대화창이 같이 떠 있는 게 기본이다). */
/* WASD 도 화살표와 **같은 자리**로 접는다.
   ⚠️ 대문자·한글 자판까지 받는다. CapsLock 이 켜져 있거나 한글 상태면 e.key 가 'W'·'ㅈ' 로 오는데,
     그때 안 먹으면 «어떤 사람에게만 안 되는» 종류가 된다(글자를 치는 자리가 아니라 조작키다).
   ⚠️ 입력칸에 포커스가 있으면 _pkKey 가 먼저 손을 뗀다 — 여기서 걸러도 대화창에 W 를 못 치게 된다. */
const _PK_MOVE_KEY = {
  ArrowLeft:'L', ArrowRight:'R', ArrowUp:'U', ArrowDown:'D',
  a:'L', d:'R', w:'U', s:'D',
  A:'L', D:'R', W:'U', S:'D',
  'ㅁ':'L', 'ㅇ':'R', 'ㅈ':'U', 'ㄴ':'D',
  /* 🔄 Q·E — 몸 돌리기. 이동과 같은 표를 쓴다(누름/뗌 처리가 한 곳이면 어긋날 데가 없다). */
  q:'QL', e:'QR', Q:'QL', E:'QR', 'ㅂ':'QL', 'ㄷ':'QR'
};
function _pkMoveOf(k){ return _PK_MOVE_KEY[k] || null; }
function _pkOwns(k){
  return !!_pkMoveOf(k) || k===' ' || k==='1' || k==='2' || k==='3';
}
function _pkTyping(){
  const a = document.activeElement;
  return !!(a && (a.tagName==='INPUT' || a.tagName==='TEXTAREA' || a.isContentEditable));
}
function _pkKey(e){
  if(!PK.open || _pkTyping()) return;
  if(!_pkOwns(e.key)) return;
  e.preventDefault(); e.stopImmediatePropagation();     // Space 스크롤·숫자 단축키를 통째로 막는다
  if(e.repeat) return;
  const mv = _pkMoveOf(e.key); if(mv) PK.keys[mv] = true;
  const me = PK.chars[PK.slot]; if(!me || PK.frozen) return;
  const pk = _purikura();
  if(e.key === ' ' && !me.jt){ me.jt = performance.now(); if(pk) pk.sendEvent('jump', null); }
  /* 포즈는 둘뿐이다(1 = 살랑살랑 · 2 = 묘기 회전). 같은 번호를 다시 누르면 기본 자세로 돌아온다 —
     «푸는 방법»이 없으면 한 번 누른 사람은 그 자세로 넉 장을 다 찍게 된다. */
  if(e.key === '1' || e.key === '2'){
    const n = (me.pose === +e.key) ? 0 : +e.key;
    me.pose = n; if(pk) pk.sendEvent('pose', n);
  }
  /* 😑 3 = 눈 감기. 포즈와 **다른 값**을 쓴다 — 뼈(포즈)와 텍스처(눈)는 서로 안 겹치므로
     1+3 · 2+3 이 그대로 된다. 한 변수에 섞으면 포즈를 풀 때 눈도 같이 떠진다.
     ⚠️ pose 값에 끼워 보내는 우회(v = pose + 4 같은 것)를 만들지 말 것. 옛 클라이언트가
       Math.min(2, ev.v) 로 접어서 **엉뚱한 포즈(묘기 회전)로 보인다.** 별도의 k 를 쓴다. */
  if(e.key === '3'){
    const r = _pkSetBlink(me, !me.blinkOn);
    if(r === 'ok'){ if(pk) pk.sendEvent('blink', me.blinkOn ? 1 : 0); }
    else{
      /* 조용히 무시하면 「눌렀는데 반응이 없다」가 된다. 다만 두 경우를 구별해서 알린다 —
         'no-tex' 는 그 캐릭터에 그림이 없는 것(정상), 'no-mat' 은 짝짓기가 실패한 것(버그)이다. */
      toast(r === 'no-tex' ? '😑 이 캐릭터는 눈감기 그림이 없어요'
                           : '😑 지금은 눈감기를 쓸 수 없어요');
      if(!PK.blinkWarned){ PK.blinkWarned = true;
        console.warn('[스티커사진] 눈 감기 실패 — ' + r +
          ' · 얼굴재질 ' + (me.faceMat ? '있음' : '없음') +
          ' · 눈감음그림 ' + (me.blinkTex ? '있음' : '없음') +
          ' · 원래그림 ' + (me.faceMapOrig ? '있음' : '없음') +
          ' · 귀 ' + ((me.ears && me.ears.length) || 0) + '쌍' +
          ' · 동물 ' + (me.animal ? 'O' : 'X'));
      }
    }
  }
}
function _pkKeyUp(e){
  if(!PK.open) return;
  if(!_pkOwns(e.key)) return;
  e.stopImmediatePropagation();
  const mv = _pkMoveOf(e.key);
  if(mv) PK.keys[mv] = false;
  /* 🔄 몸을 다 돌리고 손을 뗀 순간 한 번 보낸다 — 점프·포즈와 같은 «한 동작에 쓰기 1회»다.
     회전은 눈에 크게 띄어서, 남들이 셔터까지 못 보고 있으면 «안 돌아갔다»로 읽힌다. */
  if((mv === 'QL' || mv === 'QR') && PK.turnDirty && !PK.keys.QL && !PK.keys.QR){
    PK.turnDirty = false;
    const me = PK.chars[PK.slot], pk = _purikura();
    if(me && pk && !PK.frozen) pk.sendPos(me.wx, me.d, true, me.gz, me.gp, me.yaw);
  }
  /* ⚠️ Shift 를 눌렀다 떼면 keydown 은 'A' 인데 keyup 은 'a' 로 온다(또는 그 반대).
     한 짝만 지우면 **누른 적 없는 키가 계속 눌린 상태**로 남아 캐릭터가 혼자 걸어간다.
     그래서 같은 방향의 짝을 통째로 지운다. */
  if(mv) for(const k in _PK_MOVE_KEY) if(_PK_MOVE_KEY[k] === mv) PK.keys[mv] = false;
}

/* ══ 매 프레임 ═══════════════════════════════════════════════════════ */
function _pkLoop(now){
  if(!PK.open || !PK.renderer) return;      // 무대를 못 만든 경우 — 로비는 그대로 쓸 수 있다
  PK.raf = requestAnimationFrame(_pkLoop);
  const dt = Math.min(0.05, (now - PK.last)/1000); PK.last = now;
  const P = _pkP(), pk = _purikura();

  /* 🕗 아직 무대에 못 세운 사람이 있으면 1초마다 다시 해 본다.
     [왜] _pkSyncChars 는 **slots 가 바뀔 때만** 돈다. 그런데 남의 좌석을 찾는 열쇠
       (friendUserId)는 방 쪽 동기화가 «뒤늦게» 채워 넣는 값이라, 막 들어온 사람은
       그 순간에 못 찾는 것이 정상이다. 한 번 실패하고 끝내면 그 사람은 slots 가 또
       바뀔 때까지 영영 안 선다 — 「참가자 칸에는 이름이 뜨는데 무대만 비었다」가 이것이다.
     ⚠️ 1초에 한 번이다. 매 프레임 돌리면 못 찾는 내내 60Hz 로 좌석을 훑게 된다. */
  if(PK.charWarn && now - (PK.charTry || 0) > 1000){
    PK.charTry = now;
    for(const k in PK.charWarn){ _pkSyncChars(); break; }
  }

  const me = PK.chars[PK.slot];
  if(me && !PK.frozen){
    const sp = 1.8 * me.d * dt;             // 멀수록 화면상 속도가 같아 보이게 거리에 비례
    let moved = false;
    if(PK.keys.L){ me.wx -= sp; me.dir = -1; moved = true; }
    if(PK.keys.R){ me.wx += sp; me.dir =  1; moved = true; }
    if(PK.keys.U){ me.d = Math.max(P.CAM_NEAR, me.d - 2.7*dt); moved = true; }
    if(PK.keys.D){ me.d = Math.min(P.CAM_FAR,  me.d + 2.7*dt); moved = true; }
    /* 🔄 몸 돌리기. 좌표가 아니라 **자세**라 moved 로 안 친다 —
       moved 로 치면 돌리는 동안 10Hz 쓰기가 계속 나가서 요금이 는다. 대신 손을 뗄 때 한 번 보낸다. */
    if(PK.keys.QL || PK.keys.QR){
      me.yaw = _pkWrapPi(me.yaw + (PK.keys.QR ? 1 : -1) * PK_TURN_SPD * dt);
      PK.turnDirty = true;
    }
    me.moving = moved;
    _pkClampX(me);
    _pkAimGaze(me);                          // 내 시선은 매 프레임 마우스에서 다시 낸다
    /* ⚠️ 시선은 «보낼지»를 정하지 않는다 — 좌표 때문에 나가는 메시지에 얹기만 한다.
       마우스를 흔든다고 쓰기가 늘면 이 화면의 요금이 두 배가 된다(계층 sendPos 주석). */
    if(pk) pk.sendPos(me.wx, me.d, false, me.gz, me.gp, me.yaw);
  }

  /* 남의 좌표는 구독으로 온다. 10Hz 라 그대로 쓰면 툭툭 끊겨 보인다 — 부드럽게 따라간다. */
  Object.keys(PK.chars).forEach(k=>{
    const i = +k, c = PK.chars[i];
    if(i !== PK.slot){
      const p = PK.peers[i];
      if(p){
        const nx = c.wx + (p.wx - c.wx) * Math.min(1, dt*12);
        const nd = c.d  + (p.d  - c.d ) * Math.min(1, dt*12);
        c.moving = (Math.abs(nx-c.wx) + Math.abs(nd-c.d)) > 0.0015;
        c.wx = nx; c.d = nd;
        /* 시선도 같이 따라간다. 10Hz 로 띄엄띄엄 오므로 그대로 넣으면 고개가 툭툭 꺾인다. */
        c.gz += ((p.gz||0) - c.gz) * Math.min(1, dt*12);
        c.gp += ((p.gp||0) - c.gp) * Math.min(1, dt*12);
        /* ⚠️ 각은 «가까운 쪽으로» 돌려야 한다. 그냥 빼면 +170° → -170° 가 340° 를 도는 길로 간다. */
        c.yaw = _pkWrapPi(c.yaw + _pkWrapPi((p.yaw||0) - c.yaw) * Math.min(1, dt*12));
      } else c.moving = false;
    }
    /* 🦘 높이를 «뛴 뒤 흐른 시간»에서 바로 낸다 — 속도를 프레임마다 더해 가지 않는다.
       ★ 더해 가면(오일러 적분) 프레임이 성길수록 정점이 낮아진다. 예전 값에서는 오차가 작아
         넘어갔지만, 중력을 4배로 올린 지금은 20fps(비포커스 절전)에서 12% 낮게 뛴다 —
         「어떤 컴퓨터에서는 덜 뛴다」가 되는 자리다. 시각에서 내면 프레임 수와 **무관하게** 같다.
       ⚠️ 그래서 속도 값은 아예 없앴다. 점프 상태는 «언제 눌렀는가»(jt) 하나로 들고 있는다. */
    if(c.jt){
      const jt = (now - c.jt) / 1000, v0 = _pkJumpV0(c);
      c.jy = v0*jt - 0.5*PK_GRAVITY*jt*jt;
      if(c.jy <= 0){ c.jy = 0; c.jt = 0; }
    }
    c.t += dt;
    _pkPoseChar(c);
  });

  _pkPaintDots();
  PK.renderer.render(PK.scene, PK.cam);
  _pkFx();
}

/* 📷 필터 한 겹 — 무대를 2D 캔버스로 옮겨 그리고 계층의 applyFilter 를 부른다.
   ★ 캡처(_pkCapture)가 부르는 함수와 **같은 함수**다. 다른 것은 배율(k) 하나뿐이라
     「보이는 것」과 「찍히는 것」이 갈라질 자리가 없다.
   ⚠️ 촬영 중에만 돈다. 로비에서는 무대가 안 보이므로 한 겹을 얹을 이유가 없다 —
     여기에 조건을 안 걸면 로비에 앉아 있는 내내 2D 한 겹이 매 프레임 돈다. */
function _pkFx(){
  const fx = _pkEl('pkStageFx'); if(!fx) return;
  const on = (PK.state === 'shooting') && PK.filter && PK.filter !== 'none';
  if(on !== PK.fxOn){                       // 스타일은 «바뀔 때만» 건드린다
    PK.fxOn = on;
    fx.style.display = on ? 'block' : 'none';
    const cv = _pkEl('pkStage'); if(cv) cv.style.visibility = on ? 'hidden' : 'visible';
  }
  if(!on) return;
  /* ⚠️ 여기서 던지면 **무대가 통째로 안 보인다.** #pkStage 를 숨겨 둔 채 이 겹만 그리기 때문에,
     한 줄이라도 실패하면 화면에 아무것도 안 남는다(까맣거나 빈 화면이 된다).
     → 실패하면 필터를 그 자리에서 끄고 무대를 다시 보이게 한다. 필터가 안 걸리는 것이
       화면이 사라지는 것보다 낫다. 원인은 콘솔에 한 번만 남긴다. */
  const P = _pkP(), g = fx.getContext('2d');
  try{
    g.save();
    g.globalCompositeOperation = 'copy';    // 지난 프레임을 지우는 일까지 이 한 번으로 끝낸다
    g.drawImage(PK.renderer.domElement, 0, 0, fx.width, fx.height);
    g.restore();
    P.applyFilter(g, fx, fx.width, fx.height, PK.filter, 1, _pkScratch);
  }catch(e){
    if(!PK.fxWarned){ PK.fxWarned = true; console.warn('[스티커사진] 필터 겹 실패 — 필터를 끕니다', e); }
    PK.filter = 'none'; PK.fxOn = false;
    fx.style.display = 'none';
    const cv2 = _pkEl('pkStage'); if(cv2) cv2.style.visibility = 'visible';
    _pkPaintFilter();
  }
}
/* 필터를 고른 직후처럼 «루프를 기다릴 수 없는» 자리에서 한 번 더 부른다. */
function _pkFxSync(){ if(PK.renderer) _pkFx(); }

/* 🚶 걷기 애니메이션 대체 — **제자리 흔들림.**
   [왜] STATE_KW 에 걷기 클립이 없다(idle/focus/pet/sleep 넷뿐). 좌표만 움직이면 발이 땅에
     붙은 채로 미끄러진다. 새 GLB 없이 쓸 수 있는 길은 셋뿐이었고 그중 이것을 골랐다.
   ⚠️ 걷기 클립이 생기면 이 함수의 흔들림을 그 클립 재생으로 갈아끼울 것 — 그때 지울 코드다. */
/* 🐾 그 캐릭터의 점프 초속. 동물은 사람의 절반 «높이»로 뛴다.
   ★ 높이 = v0² ÷ 2g 라서 높이를 절반으로 하려면 초속은 √0.5 배다. 비율은 계층이 정한다 —
     여기에 숫자를 적으면 «남의 점프»를 계산하는 자리와 갈라져서, 같은 점프가 사람마다
     다른 높이로 보이게 된다(궤적은 각자 계산한다).
   ⚠️ 내 점프와 남의 점프가 **같은 함수**를 지나야 한다. 이 함수 하나가 그 자리다. */
function _pkJumpV0(c){
  return PK_JUMP_V0 * ((c && c.animal) ? Math.sqrt(_pkP().ANIMAL_JUMP) : 1);
}
function _pkPoseChar(c){
  /* ⚠️ inner 는 **연출 전용 겹**이다(_pkSyncChars 의 pose). 여기서 scale·position 을 덮어쓰므로
     키·발바닥 보정이 걸린 g 를 여기에 넣으면 첫 프레임에 그 보정이 통째로 날아간다. */
  const g = c.group, inner = c.inner;
  g.position.set(c.wx, c.jy, -c.d);
  const w = c.moving ? Math.sin(c.t*13) : 0;
  inner.rotation.z = w * 0.055;                              // 좌우로 갸웃
  inner.position.y = c.moving ? Math.abs(Math.sin(c.t*13))*0.032 : 0;   // 상하 바운스
  inner.rotation.y = PK_BODY_YAW + (c.yaw||0) + (c.moving ? c.dir*0.12 : 0);
  inner.scale.setScalar(1);
  _pkApplyPose(c);
  _pkApplyGaze(c);
}

/* 🕺 포즈 — 실행 화면의 춤 «자세»만 가져온다. 움직임은 없다.
   ★ 왜 자세만인가 — 춤은 시간에 따라 도는 연출이라, 셔터가 언제 터지느냐에 따라 매번 다른
     순간이 찍힌다. 사진은 «고른 자세»가 그대로 나와야 한다. 그래서 진행률을 1 로 고정한
     **끝난 자세**를 쓴다(`_trickArmBase(...,1)` 처럼 e=1).
   ★ 각도·벌림은 실행 화면의 그 상수들을 그대로 부른다. 여기에 숫자를 새로 적으면
     춤 자세를 조정했을 때 무대만 옛 자세로 남는다.
   ⚠️ 기본 자세(0)는 **드래그했을 때의 팔 처짐**이다(SHAKE_ARM_DROOP). 평소 앉은 자세는
     책상에 손을 올린 각이라, 서 있는 무대에서는 팔이 앞으로 들린 것처럼 보인다. */
function _pkApplyPose(c){
  const B = c.bones; if(!B || !B.handL || !B.handR) return;
  if(typeof setBone !== 'function') return;
  const base = c.armBase, P = c.pose|0;
  const put = (k, x, y, z)=>{ if(B[k]) setBone(B[k].bone, B[k].rest, x, y, z); };

  if(P === 1){
    /* 1️⃣ /80 «살랑살랑» — 팔을 옆으로 벌리고 한쪽은 위, 한쪽은 아래로 든 그 순간에서 멈춘다. */
    const SPREAD = 0.7, FLAP = 0.9;
    put('handL', base - 0.1 + FLAP, 0, -SPREAD);
    put('handR', base - 0.1 - FLAP, 0,  SPREAD);
    put('spine', SPINE_AXIS()*0.02, 0.08, 0.10);
    put('legL',  0.12, 0, 0);
    put('legR', -0.12, 0, 0);
  }else if(P === 2){
    /* 2️⃣ /150 «묘기 회전» — 양팔을 좌우로 곧게 뻗고 한 발로 선 자세. 회전은 없다. */
    const armBase = _trickArmBase(base, false, 1), spread = _trickArmSpread(1);
    put('handR', armBase, 0,  spread);
    put('handL', armBase, 0, -spread);
    put('spine', SPINE_AXIS()*0.02, 0, 0);
    const lp = _trickLegPose(c.standLeft, 1);
    put('legL', lp.legL.x, 0, lp.legL.z);
    put('legR', lp.legR.x, 0, lp.legR.z);
  }else{
    /* 0️⃣ 기본 — 드래그했을 때처럼 팔을 아래로 늘어뜨린다. */
    put('handL', base + SHAKE_ARM_DROOP(), 0, 0);
    put('handR', base + SHAKE_ARM_DROOP(), 0, 0);
    put('spine', SPINE_AXIS()*0.0, 0, 0);
    put('legL', 0, 0, 0);
    put('legR', 0, 0, 0);
  }
}

function _pkPaintDots(){
  const el = _pkEl('pkDots'); if(!el) return;
  if(el.childElementCount !== PK.cuts){
    el.innerHTML = '';
    for(let i=0;i<PK.cuts;i++) el.appendChild(document.createElement('i'));
  }
  for(let i=0;i<PK.cuts;i++){
    const d = el.children[i];
    /* 기다리는 중에도 «곧 찍을 컷»을 표시한다 — 어느 컷 차례인지가 점에서 읽혀야 한다. */
    d.className = (i < PK.shots.length) ? 'done' : (i === _pkCutNow() ? 'now' : '');
  }
}

/* ══ 촬영 ═════════════════════════════════════════════════════════════
   방장이 컷의 시작 시각(meta.cutAt)을 적고, 카운트다운은 **모두가 그 시각에서 계산한다.**
   각자 자기 타이머로 세면 기기마다 1~2초씩 어긋나 늦은 사람은 셔터 뒤에도 움직인다. */
async function _pkStart(){
  const pk = _purikura(); if(!pk || !PK.host) return;
  const sb = _pkEl('pkStartBtn'); if(sb) sb.disabled = true;
  const r = await pk.start();                 // takeQuota 가 여기서 돈다 — 정원 차감은 이 순간이다
  if(!r || !r.ok){
    if(sb) sb.disabled = false;
    toast((r && r.message) || '지금은 시작할 수 없어요');
    return;
  }
  PK.shots = [];
  _pkEnterShooting();
  _pkWaitCut(0);              // ★ 바로 세지 않는다 — 방장이 구도를 맞추고 📷 를 누를 때 시작한다
}
function _pkEnterShooting(){
  PK.state = 'shooting';
  const ov = _pkEl('pkOverlay'); ov.classList.add('shooting');
  _pkSizeStage();
}
/* ⏸️ «기다리는» 구간 — 컷과 컷 사이. 카운트다운이 안 돌고, 방장이 📷 를 누르면 그때 시작한다.
   ★ 이 구간이 생긴 이유: 카메라 손잡이를 붙이고 나니 «구도를 맞출 시간»이 필요해졌다.
     카운트다운 안에서 맞추게 하면 남은 초를 보며 서두르게 되고, 그러면 손잡이가 있으나 마나다.
   ⚠️ 남에게는 cutAt:0 이 곧 «아직 안 눌렀다»는 표시다. 지난 촬영의 cutAt 이 노드에 남아 있어서,
     비우지 않으면 남은 사람들이 옛 값을 보고 혼자 카운트다운을 시작한다(start 주석 참고). */
function _pkWaitCut(i){
  clearInterval(PK.timer); PK.timer = 0;
  /* ⚠️ waitCut 을 «배경을 굽기 전»에 세운다. 순서가 뒤집히면 그 프레임만 옛 컷 배경으로 굽는다. */
  PK.cutIdx = -1; PK.cutAt = 0; PK.waitCut = i; PK.frozen = false;
  if(PK.host){
    const pk = _purikura();
    if(pk) pk.setCut(i, 0);                  // cutAt:0 — «i 번 컷을 기다리는 중»
  }
  _pkSyncFrame(); _pkApplyBg(); _pkPaintFilter(); _pkPaintCam(); _pkPaintDots(); _pkSyncCam();
  const ce = _pkEl('pkCount'); if(ce){ ce.textContent = String(PK_COUNT_SEC); ce.classList.remove('hot'); }
  const lb = _pkEl('pkLockbar');
  if(lb) lb.textContent = PK.host
    ? '📷 를 누르면 ' + PK_COUNT_SEC + '초를 셉니다 — 남은 컷 ' + (PK.cuts - i) + '장'
    : '방장이 📷 를 누르면 ' + PK_COUNT_SEC + '초를 셉니다 — 남은 컷 ' + (PK.cuts - i) + '장';
}
function _pkNextCut(i){                       // 방장 전용 — 다음 컷을 «연다»
  if(i >= PK.cuts){ _pkFinish(); return; }
  const pk = _purikura();
  const at = (firebaseAPI.serverNow ? firebaseAPI.serverNow() : Date.now());
  if(pk) pk.setCut(i, at);
  _pkRunCountdown(i, at);
}
/* 카운트다운은 방장도 남도 **같은 함수**를 돈다. 다른 것은 «셔터를 쓰느냐» 한 줄뿐이다.
   ⚠️ 남은 초를 자기 타이머로 세지 말 것 — 매번 서버 시각에서 다시 계산한다. 그래야 탭이
     백그라운드에 들어갔다 나와도 숫자가 안 어긋난다(setInterval 은 그때 멈춘다). */
function _pkRunCountdown(i, at){
  const pk = _purikura();
  PK.cutIdx = i; PK.cutAt = at; PK.frozen = false;
  _pkSyncFrame();
  /* 🎨 컷마다 배경이 다를 수 있다 — 이 컷의 것으로 다시 굽는다.
     ⚠️ 컷이 열리는 «순간»에 바꾼다. 셔터 때 바꾸면 카운트다운 내내 다음 컷 배경이 안 보인다. */
  _pkApplyBg(); _pkPaintFilter();
  PK.waitCut = -1;
  _pkSyncCam();                  // 📷 버튼이 «세는 중»으로 바뀐다 (다시 그리지 않는다)
  const lb = _pkEl('pkLockbar');
  if(lb) lb.textContent = '🔒 세는 중에는 창을 닫을 수 없어요 — 남은 컷 ' + (PK.cuts - i) + '장';
  clearInterval(PK.timer);
  PK.timer = setInterval(()=>{
    const now = (firebaseAPI.serverNow ? firebaseAPI.serverNow() : Date.now());
    const left = Math.max(0, PK_COUNT_SEC - Math.floor((now - PK.cutAt)/1000));
    const ce = _pkEl('pkCount');
    if(ce){ ce.textContent = String(left); ce.classList.toggle('hot', left <= 3); }
    _pkSyncFilterLock();          // 3초를 지나는 순간 필터 줄을 잠근다(바뀔 때만 다시 그린다)
    if(left <= 0){
      clearInterval(PK.timer); PK.timer = 0;
      if(PK.host && pk) pk.fireShutter(i);     // 신호는 방장만 쓴다
    }
  }, 100);
}

/* ── 방장이 정한 것을 따라간다 ──
   ⚠️ 방장 자신도 이 콜백을 받는다(자기가 쓴 값이 되돌아온다). 그때 다시 그리면 누르는 족족
     화면이 깜빡이므로, 설정 반영은 «방장이 아닐 때»만 한다. 진행(cut)은 둘 다 본다. */
function _pkOnMeta(m){
  if(!PK.open || !m) return;
  if(!PK.host){
    let spec = false, inkOnly = false;
    /* 규격이 바뀌는 것은 이 둘뿐이다 — 컷의 가로세로가 달라지므로 올린 그림을 그대로 못 쓴다. */
    if(m.orient && m.orient !== PK.orient){ PK.orient = m.orient; spec = true; }
    if(m.cuts   && m.cuts   !== PK.cuts  ){ PK.cuts   = m.cuts;   spec = true; }
    /* ⚠️ 기본 프레임(basic)은 «여백 색»이다. 규격은 그대로라 올린 프레임을 지울 이유가 없다.
       [옛 버그] 예전에는 이것도 changed 에 넣어서 _pkClearUp() 이 돌았다. 방장이 프레임을
         고른 **뒤에** 여백 색을 한 번이라도 바꾸면 그 순간 남은 사람들 화면에서만 프레임이
         사라졌다. frames 노드는 그대로라 _pkOnFrames 가 다시 불릴 계기가 없어서 영영 안 돌아왔다.
         방장 쪽은 자기 손에 그림이 있으니 멀쩡했다 — 「방장한테만 보인다」의 정체가 이것이다.
       ★ 방장 쪽 단추(_pkPaintBasics 의 onclick)와 **같은 일**만 한다: 다시 그리기 셋. */
    if(m.basic  && m.basic  !== PK.basic ){ PK.basic  = m.basic;  inkOnly = true; }
    /* 뒷배경만 바뀐 경우에는 올린 프레임을 지우지 않는다 — 규격이 그대로라 다시 올릴 이유가 없다. */
    if(m.bg && m.bg !== _pkBgStr()){
      PK.bgSel = _pkP().bgParse(m.bg);      // 모르는 값·중복은 여기서 걸러진다
      _pkPaintBg(); _pkPaintFilter(); _pkApplyBg();
    }
    /* 📷 필터. 뒷배경과 같이 «컷 안»의 값이라 올린 프레임은 안 지운다.
       ⚠️ 촬영 «중»에도 이 길로 온다 — 방장이 컷 사이에 바꾸면 남은 사람 화면도 그때 같이 바뀐다.
         셔터 직전 3초는 방장 쪽에서 잠가 두므로, 여기 도착하는 값은 언제나 컷 사이의 값이다. */
    /* ⚠️ filterIn 으로 받는다 — 구버전이 보내는 «만화»는 목록에 없으므로 «없음»으로 접힌다.
       그냥 무시하면 내 화면에만 옛 필터가 남아서 사람마다 다른 사진이 나온다. */
    if(m.filter){
      const nf = _pkP().filterIn(m.filter);
      if(nf !== PK.filter){ PK.filter = nf; _pkPaintFilter(); _pkFxSync(); }
    }
    /* 🎚️ 방장이 맞춘 구도를 그대로 받는다. 안 받으면 «사진마다 사람 크기가 다르다»가 된다. */
    if(m.camH !== undefined || m.camP !== undefined){
      const P2 = _pkP();
      const h = P2.camClampH(m.camH === undefined ? PK.camH : m.camH);
      const p2 = P2.camClampP(m.camP === undefined ? PK.camP : m.camP);
      if(h !== PK.camH || p2 !== PK.camP){ PK.camH = h; PK.camP = p2; _pkApplyCam(); _pkSyncCam(); }
    }
    if(spec){
      _pkClearUp(); _pkPaintAll(); _pkSizeStage();
      /* ★ 비운 뒤에 **쥐고 있던 목록으로 다시 그린다.** meta 가 frames 보다 늦게 오는 경우가
         있어서다 — 그때 그냥 비우기만 하면 이미 도착해 있던 프레임이 그대로 날아간다.
         (그림 자체는 브라우저 캐시에 있어서 다시 받는 값은 거의 없다.)
         ⚠️ 규격이 진짜로 바뀐 경우에는 방장이 frames 노드도 같이 비운다(_pkWipeFrames).
           그 빈 목록이 곧 도착해서 여기서 되살린 옛 그림을 덮는다 — 스스로 낫는다. */
      /* ⚠️ 구독이 살아 있을 때만. 꾸미기(_pkOpenDeco)는 frames 구독을 떼고 노드를 지우므로,
         거기서 되살리면 완성본 위에 옛 프레임이 다시 얹힌다. */
      if(PK.unframes) _pkOnFrames(PK.frameSrc);
    }else if(inkOnly){
      _pkPaintBasics(); _pkPaintUp(); _pkSyncFrame();
    }
  }
  /* 🎲 씨앗 — 방장이 촬영을 시작하며 적은 시각 하나가 컷별 배경을 정한다.
     ★ 방장도 이 값을 «되받아서» 쓴다. 자기가 쓴 값이지만 서버 시각이라 손에 없다.
     ⚠️ 그래서 도착이 한 박자 늦을 수 있다 — 도착하면 그때 배경을 다시 굽는다.
       안 그러면 첫 컷만 목록 순서대로 나오고 남들과 갈린다. */
  if(m.startedAt && +m.startedAt !== PK.seed){
    PK.seed = +m.startedAt;
    if(PK.bgSel.length > 1){ _pkApplyBg(); _pkPaintFilter(); }
  }
  if(m.state === 'shooting'){
    if(PK.state !== 'shooting') _pkEnterShooting();
    const i = m.cut | 0, at = +m.cutAt || 0;
    /* 방장은 이미 자기 손으로 돌고 있다 — 되돌아온 값으로 다시 걸면 두 번 돈다. */
    if(!PK.host){
      /* cutAt:0 = «방장이 아직 📷 를 안 눌렀다». 그때는 세지 않고 기다린다. */
      if(!at){ if(PK.cutIdx >= 0 || PK.waitCut !== i) _pkWaitCut(i); }
      else if(i !== PK.cutIdx || at !== PK.cutAt) _pkRunCountdown(i, at);
    }
  }else if(m.state === 'done' && PK.state === 'shooting' && !PK.host){
    _pkFinish();
  }
}

/* 남의 점프·포즈. 값이 아니라 «눌렀다»가 오므로 궤적은 여기서 똑같이 계산한다 —
   그래서 점프 한 번에 쓰기가 1회다(연속으로 보내면 10Hz × 1초 = 10회). */
function _pkOnPeerEvent(slot, ev){
  if(!PK.open || !ev) return;
  const c = PK.chars[slot]; if(!c || PK.frozen) return;
  /* ⚠️ ev 노드는 **자리마다 한 칸씩 남아 있고**, 누구 하나가 쓰면 ev 전체가 바뀌어 구독이
     다시 돈다 — 그때 «남아 있던 남의 옛 사건»이 통째로 다시 배달된다.
     그래서 A 가 점프한 뒤 B 가 포즈만 눌러도 A 가 한 번 더 뛴다. 본인 화면에서만 그러니
     A 는 모른다(_pkOnShot 의 «옛 shot 신호»와 같은 함정이다).
     → 자리마다 마지막으로 본 시각을 기억하고, 그 시각이면 흘려보낸다. */
  const ts = +ev.ts || 0;
  if(ts && PK.evSeen[slot] === ts) return;
  PK.evSeen[slot] = ts;
  if(ev.k === 'jump' && !c.jt) c.jt = performance.now();
  else if(ev.k === 'pose') c.pose = Math.max(0, Math.min(2, ev.v | 0));
  /* 😑 남의 눈 감기. 눈감음 그림이 없는 캐릭터면 _pkSetBlink 가 false 를 주고 아무 일도 안 한다 —
     여기서는 안내하지 않는다. 남의 캐릭터 사정을 내 화면에 띄울 이유가 없다. */
  else if(ev.k === 'blink') _pkSetBlink(c, !!(ev.v | 0));
}
/* 셔터 신호를 받으면 그 자리에 멈추고 최종 좌표를 한 번 더 보낸 뒤, FREEZE_MS 를 기다렸다 찍는다.
   ★ 그래야 넷이 «같은 사진»을 갖는다. 늦게 오는 좌표를 기다리는 시간이 그 400ms 다. */
function _pkOnShot(s){
  if(!PK.open || PK.frozen || !s) return;
  /* ⚠️ shot 노드는 찍은 뒤에도 남아 있다. 촬영 도중에 들어온 사람은 그 «옛 신호»를 받자마자
     엉뚱한 컷을 찍게 된다 — 지금 세고 있는 컷일 때만 반응한다. */
  if((s.n|0) !== PK.cutIdx) return;
  const pk = _purikura(); if(!pk) return;
  PK.frozen = true;
  PK.keys = {};
  _pkSyncFilterLock();            // 셔터가 터졌다 — 이번 컷은 이미 결정됐다

  const me = PK.chars[PK.slot];
  if(me){ _pkAimGaze(me); pk.sendPos(me.wx, me.d, true, me.gz, me.gp, me.yaw); }   // force — 데드밴드도 간격도 무시
  /* ★ 사진에 남는 시선은 **이 한 번**이다. 카운트다운 동안 남의 고개가 조금 늦게 따라와도
     셔터 직전의 이 전송이 넷의 화면을 같은 값으로 맞춘다. */
  const ce = _pkEl('pkCount'); if(ce) ce.textContent = '📷';
  setTimeout(()=>{
    const shot = _pkCapture();
    PK.shots[s.n|0] = shot;
    const f = _pkEl('pkFlash');
    if(f){ f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    _pkPaintDots();
    /* ★ 자동으로 다음 컷을 열지 않는다 — 다시 «기다리는» 구간으로 간다.
       마지막 컷이었으면 그대로 꾸미기로 넘어간다. */
    setTimeout(()=>{
      const next = (s.n|0) + 1;
      if(next >= PK.cuts){ if(PK.host) _pkFinish(); return; }
      _pkWaitCut(next);
    }, PK_AFTER_MS);
  }, pk.freezeMs());
}
/* 컷 해상도로 한 장 굽는다.
   ★ 카메라는 그대로 두고 렌더 버퍼만 키운다 — 화각이 같으므로 무대에 보이던 구도가 그대로다.
     여기서 카메라를 만지면 «보이는 것과 찍히는 것»이 갈라진다. */
function _pkCapture(){
  const P = _pkP(), spec = P.frameSpec(PK.orient, PK.cuts);
  const st = P.stageSize(PK.orient, PK.cuts);
  const pr = PK.renderer.getPixelRatio();
  try{
    PK.renderer.setPixelRatio(1);
    PK.renderer.setSize(spec[0], spec[1], false);
    PK.renderer.render(PK.scene, PK.cam);
    if(!PK.filter || PK.filter === 'none') return PK.renderer.domElement.toDataURL('image/png');
    /* 📷 필터가 걸렸을 때만 2D 한 겹을 더 지난다. ★ 배율은 계층이 정한다(filterScale = 1.76) —
       여기에 1 을 넣으면 사진에서만 도트가 잘아지고 번짐이 약해진다. 화면으로는 안 보이는 종류다. */
    const fcv = _pkScratch(spec[0], spec[1], 'shot'), fg = fcv.getContext('2d');
    fg.save(); fg.globalCompositeOperation = 'copy';
    fg.drawImage(PK.renderer.domElement, 0, 0, spec[0], spec[1]);
    fg.restore();
    P.applyFilter(fg, fcv, spec[0], spec[1], PK.filter, P.filterScale(PK.orient, PK.cuts), _pkScratch);
    return fcv.toDataURL('image/png');
  }catch(e){
    console.warn('[스티커사진] 캡처 실패', e); return null;
  }finally{
    PK.renderer.setPixelRatio(pr);
    PK.renderer.setSize(st.w, st.h, false);
    const cv = _pkEl('pkStage'); cv.style.width = st.w+'px'; cv.style.height = st.h+'px';
  }
}
/* 시트 합성 — 컷 넉 장을 한 장으로. 여백 판과 올린 프레임을 그 «위»에 얹는다.
   ⚠️ 컷마다 테두리를 그리지 않는다. 구멍 뚫은 판 한 장이라 컷 사이가 두 겹으로 안 겹친다. */
function _pkComposeSheet(){
  const P = _pkP();
  const W = P.sheetW(PK.orient), H = P.sheetH(PK.orient);
  const rects = P.cellRects(PK.orient, PK.cuts, 1);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  return Promise.all(PK.shots.map((d,i)=>new Promise(res=>{
    if(!d) return res(null);
    const im = new Image(); im.onload = ()=>res(im); im.onerror = ()=>res(null); im.src = d;
  }))).then(imgs=>{
    imgs.forEach((im,i)=>{ const r = rects[i]; if(im && r) g.drawImage(im, r[0], r[1], r[2], r[3]); });
    _pkFillGutter(g, W, H, rects, PK_BASICS[PK.basic].ink);   // 미리보기와 같은 함수다
    PK.up.forEach((f,i)=>{ const r = rects[i]; if(f && f.cv && r) g.drawImage(f.cv, r[0], r[1], r[2], r[3]); });
    return cv;
  });
}
async function _pkFinish(){
  const pk = _purikura();
  PK.cutIdx = -1; PK.frozen = false; PK.state = 'done';
  clearInterval(PK.timer); PK.timer = 0;
  if(PK.host && pk) pk.setDone();
  const ce = _pkEl('pkCount'); if(ce){ ce.textContent = '✓'; ce.classList.remove('hot'); }
  const lb = _pkEl('pkLockbar');
  if(lb) lb.textContent = '✅ 촬영 끝 — 꾸미기로 넘어갑니다';
  try{ PK.sheet = await _pkComposeSheet(); }catch(e){ console.warn('[스티커사진] 시트 합성 실패', e); }
  window._pkSheet = PK.sheet || null;
  /* 시트를 못 만들었으면 꾸미기로 넘어가지 않는다 — 빈 시트에 스티커만 붙이게 된다.
     이 경우는 촬영 자체가 헛것이므로 여기서 멈추고 안내한다. */
  if(!PK.sheet){
    if(lb) lb.textContent = '사진을 합치지 못했어요 — 창을 닫고 다시 찍어 주세요';
    return;
  }
  _pkOpenDeco();
}

/* ═══════════════════════════════════════════════════════════════════════════
   🎨 꾸미기 (시안 purikura-design-v9.html 화면 3)

   ★ 이 화면이 지키는 것 넷 — 앞의 셋과 마찬가지로 **화면에 표시가 안 나는** 종류다.

     ① 화면과 저장은 «같은 데이터를 다른 배율로 다시 그린 것»이다.
        화면 그림(360px)을 확대해 저장하면 선이 뭉갠다. 그래서 획은 **점 목록**으로만 들고
        있다가 그릴 때마다 다시 그리고, 그리는 함수는 Purikura.penRender **하나**다.
        ⚠️ 점은 언제나 저장 해상도(1200×1600) 좌표다. 화면 좌표로 담으면 배율이 두 번
          곱해져 커서와 선이 어긋난다.

     ② 속 빈 펜은 딴 캔버스를 거친다.
        destination-out 을 시트에 바로 쓰면 **밑의 사진까지 뚫린다.** 어느 펜이 그런지는
        계층이 안다(Purikura.needsScratch) — 여기서 종류 이름을 다시 적지 않는다.

     ③ 되돌리기는 «꾸미기 상태를 통째로» 찍는다.
        획은 배열이고 스티커는 DOM 이라 각각 되돌리기를 만들면 둘의 순서가 엉킨다 —
        스티커를 지우고 Ctrl+Z 를 눌렀는데 획이 사라지는 식이 된다.
        ⚠️ commit 은 **손을 뗀 순간**에만 부른다. 드래그 중간마다 쌓으면 Ctrl+Z 를
          스무 번 눌러야 스티커 하나가 제자리로 간다.

     ④ 통신이 없다.
        시트도 획도 스티커도 내 컴퓨터 안에만 있다. 완성본은 **서버에 안 올린다** —
        내려받기로 끝낸다. 여기서 무언가를 올리기 시작하면 방 전원이 그것을 내려받게 되고
        RTDB 단가($5/GB)로 계산된다. 이 화면은 요금을 하나도 안 쓴다.
   ═══════════════════════════════════════════════════════════════════════════ */

const PKD = {
  on:false, strokes:[], drawing:false, penOn:false,
  type:'solid', color:'#e0567a', w:7,
  sel:null, z:1, hist:[], hi:-1, saved:true, closeArm:0, wired:false
};
let _pkdScratch = null;

function _pkdDirty(){
  if(PKD.saved) return false;
  const host = _pkEl('pkSheetHost');
  return PKD.strokes.length > 0 || !!(host && host.querySelector('.pk-stk'));
}

function _pkOpenDeco(){
  const P = _pkP(); if(!P) return;
  PK.state = 'deco';
  /* 무대는 여기서 버린다 — 돌아갈 길이 없고, 복제한 캐릭터와 WebGL 컨텍스트를 붙들고 있을
     이유도 없다. ⚠️ 지오메트리는 메인 씬과 «공유»라 _pkDropChar 가 머티리얼만 버린다. */
  _pkDisposeStage();
  const ov = _pkEl('pkOverlay'); if(ov){ ov.classList.remove('shooting'); ov.classList.add('deco'); }
  /* 📷 여기서 **자리를 놓는다** — 그래야 방이 다시 열린다.
     ★ 방을 여는 것만으로는 모자라다. 방장이 slot 0 을 붙잡은 채 꾸미기를 하면, 새로 들어온
       사람은 방장이 못 되어 「촬영 시작」을 아무도 못 누른다.
     ★ 마지막 사람이 놓는 순간 pk.release 가 _photo 노드를 통째로 치운다 — 그것이 곧 초기화다.
     ⚠️ 구독을 **먼저** 뗀다. 안 떼면 노드가 지워지는 순간 _pkOnFrames 가 빈 목록을 받아
       PK.up 을 지우고, 참가자 칸에는 다음 팀 사람들이 뜬다. 꾸미기는 통신이 없는 화면이다.
     ⚠️ 시트는 이 위에서 이미 다 구웠다(_pkFinish 가 _pkComposeSheet 를 await 한다).
       프레임도 사진도 전부 손에 있으므로 지금 놓아도 잃을 것이 없다. */
  [PK.unslots, PK.unframes].forEach(f=>{ if(f) try{ f(); }catch(_){} });
  PK.unslots = PK.unframes = null;
  PK.members = {};
  { const pk0 = _purikura(); if(pk0) try{ pk0.release(); }catch(e){ console.warn('[스티커사진] 자리 반납 실패', e); } }
  _pkClampWin();                         // 600 → 840px 로 넓어졌다 — 오른쪽이 화면 밖으로 나갈 수 있다
  PKD.on = true; PKD.strokes = []; PKD.sel = null; PKD.z = 1;
  PKD.hist = []; PKD.hi = -1; PKD.saved = true; PKD.closeArm = 0;
  PKD.type = 'solid'; PKD.color = P.PEN_COLORS[0]; PKD.w = P.PEN_W_DEF;
  const host = _pkEl('pkSheetHost');
  if(host) host.querySelectorAll('.pk-stk').forEach(el=>el.remove());
  _pkdBuildUI();
  _pkdResetTools();             // 옆줄은 한 번만 만들지만 «골라진 표시»는 매번 되돌린다
  _pkdSetPen(false);
  _pkdPaint(); _pkdPenPreview();
  _pkdCommit();                 // 빈 상태를 첫 칸으로 — 없으면 첫 획을 Ctrl+Z 로 못 지운다
  /* 그 첫 칸은 «고친 것»이 아니다 — 여기서 되돌려 놔야 아무것도 안 한 채 닫을 때 안 되묻는다 */
  PKD.saved = true;
  window.addEventListener('keydown', _pkdKey, true);
}
function _pkCloseDeco(){
  if(!PKD.on) return;
  PKD.on = false;
  window.removeEventListener('keydown', _pkdKey, true);
  const host = _pkEl('pkSheetHost');
  if(host){ host.querySelectorAll('.pk-stk').forEach(el=>el.remove()); host.classList.remove('penmode'); }
  PKD.strokes = []; PKD.hist = []; PKD.hi = -1; PKD.sel = null; PKD.closeArm = 0;
  const ov = _pkEl('pkOverlay'); if(ov) ov.classList.remove('deco');
  PK.sheet = null; window._pkSheet = null;
  _pkdScratch = null;
}

/* ── 그리기 ──
   ★ 시트 본체(사진 + 프레임)는 _pkComposeSheet 가 **저장 해상도로 이미 만들어 둔 것**을
     줄여서 얹는다. 여기서 다시 합성하지 않는다 — 합성이 두 곳이면 언젠가 한쪽만 고쳐진다.
     저장할 때는 같은 캔버스를 배율 없이 그대로 쓰므로 사진 화질이 안 깎인다. */
function _pkdSize(){
  const P = _pkP(), D = P.DECO_DISP;
  return { D:D, W:Math.round(P.sheetW(PK.orient)*D), H:Math.round(P.sheetH(PK.orient)*D) };
}
function _pkdBlit(g, group, k, W, H){
  const P = _pkP();
  if(P.needsScratch(group[0].t)){
    if(!_pkdScratch) _pkdScratch = document.createElement('canvas');
    const sc = _pkdScratch;
    if(sc.width !== W || sc.height !== H){ sc.width = W; sc.height = H; }
    else sc.getContext('2d').clearRect(0,0,W,H);
    P.penRender(sc.getContext('2d'), group, k);
    g.drawImage(sc, 0, 0);
  }else{
    P.penRender(g, group, k);
  }
}
function _pkdPaint(){
  const cv = _pkEl('pkSheet'), host = _pkEl('pkSheetHost'); if(!cv || !host) return;
  const P = _pkP(), s = _pkdSize();
  if(cv.width !== s.W || cv.height !== s.H){
    cv.width = s.W; cv.height = s.H;
    host.style.width = s.W+'px'; host.style.height = s.H+'px';
  }
  const g = cv.getContext('2d');
  g.clearRect(0,0,s.W,s.H);                       // 흰색으로 안 채운다 — «투명»이 진짜 투명이어야 한다
  if(PK.sheet) g.drawImage(PK.sheet, 0, 0, s.W, s.H);
  P.strokeGroups(PKD.strokes).forEach(gp=>_pkdBlit(g, gp, s.D, s.W, s.H));
}

/* ── 스티커 ──
   ★ 만드는 자리는 이 함수 하나뿐이다. 되돌리기 복원도 여기를 쓴다 —
     만드는 곳이 둘이면 새 속성을 더할 때 한쪽만 고쳐진다. */
function _pkdApplyStk(el){
  const s = +el.dataset.scale, r = +el.dataset.rot, f = el.dataset.flip==='1' ? -1 : 1;
  el.style.transform = 'translate(-50%,-50%) rotate('+r+'deg) scale('+(s*f)+','+s+')';
  /* 손잡이는 스티커를 따라 커지면 안 된다 — 역배율로 원래 크기를 지킨다.
     반전됐을 때 X 를 한 번 더 뒤집어야 ✕·⇄ 글자가 거울이 안 된다. */
  el.querySelectorAll('.pk-hnd').forEach(h=>{
    h.style.transform = 'translate(-50%,-50%) scale('+(1/s*f)+','+(1/s)+')';
  });
  const bx = el.querySelector('.pk-box');
  if(bx) bx.style.borderWidth = (1/s)+'px';
}
function _pkdMakeStk(ch, d){
  const host = _pkEl('pkSheetHost'), cv = _pkEl('pkSheet');
  const el = document.createElement('div');
  el.className = 'pk-stk';
  el.style.left = (d ? d.l : cv.width/2)+'px';
  el.style.top  = (d ? d.t : cv.height/2)+'px';
  el.style.zIndex  = d ? d.z : ++PKD.z;
  el.dataset.rot   = d ? d.r : '0';
  el.dataset.scale = d ? d.s : '1';
  el.dataset.flip  = d ? d.f : '0';
  el.dataset.ch = ch;
  el.innerHTML = '<div class="pk-box"></div><div class="pk-gl"></div>'
    + '<div class="pk-hnd rot" title="회전">↻</div>'
    + '<div class="pk-hnd scl" title="크기">⤡</div>'
    + '<div class="pk-hnd flip" title="좌우 반전">⇄</div>'
    + '<div class="pk-hnd del" title="삭제">✕</div>';
  el.querySelector('.pk-gl').textContent = ch;     // 글리프는 textContent 로 — 마크업에 안 섞는다
  host.appendChild(el); _pkdBindStk(el); _pkdApplyStk(el);
  return el;
}
function _pkdSelect(el){
  const host = _pkEl('pkSheetHost'); if(!host) return;
  host.querySelectorAll('.pk-stk').forEach(s=>s.classList.remove('sel'));
  /* ⚠️ DOM 으로 옮기면(appendChild) 그 순간 포인터 캡처가 끊겨 드래그가 멈춘다.
     z-index 만 올린다 — 화면 결과는 같고 드래그는 안 끊긴다. */
  if(el){ el.classList.add('sel'); el.style.zIndex = ++PKD.z; _pkdApplyStk(el); }
  PKD.sel = el;
}
function _pkdCenter(el){ return [parseFloat(el.style.left), parseFloat(el.style.top)]; }
function _pkdBindStk(el){
  const cv = _pkEl('pkSheet');
  let mode = null, sx0 = 0, sy0 = 0, ox = 0, oy = 0, base = 0, ang0 = 0, rot0 = 0;
  const rect = ()=>_pkEl('pkSheetHost').getBoundingClientRect();
  /* 시트 밖으로는 못 나간다 — 나가면 화면에는 보이는데 저장한 그림에는 없다. */
  const clampC = (x,y)=>[Math.max(0, Math.min(cv.width, x)), Math.max(0, Math.min(cv.height, y))];

  el.addEventListener('pointerdown', e=>{
    if(PKD.penOn) return;
    if(e.target.classList.contains('pk-hnd')) return;    // 손잡이는 아래에서 따로
    mode = 'move'; _pkdSelect(el); el.setPointerCapture(e.pointerId);
    sx0 = e.clientX; sy0 = e.clientY;
    const c = _pkdCenter(el); ox = c[0]; oy = c[1];
    e.stopPropagation(); e.preventDefault();
  });
  el.addEventListener('pointermove', e=>{
    if(mode !== 'move') return;
    const c = clampC(ox + e.clientX - sx0, oy + e.clientY - sy0);
    el.style.left = c[0]+'px'; el.style.top = c[1]+'px';
  });
  el.addEventListener('pointerup', ()=>{ if(mode === 'move') _pkdCommit(); mode = null; });

  el.querySelector('.pk-hnd.del').onclick = e=>{ e.stopPropagation(); el.remove(); PKD.sel = null; _pkdCommit(); };
  el.querySelector('.pk-hnd.flip').onclick = e=>{
    e.stopPropagation();
    el.dataset.flip = el.dataset.flip === '1' ? '0' : '1';
    _pkdApplyStk(el); _pkdCommit();
  };

  const scl = el.querySelector('.pk-hnd.scl');
  scl.addEventListener('pointerdown', e=>{
    e.stopPropagation(); e.preventDefault();
    _pkdSelect(el); scl.setPointerCapture(e.pointerId);
    const r = rect(), c = _pkdCenter(el);
    base = Math.hypot(e.clientX-r.left-c[0], e.clientY-r.top-c[1]) / (+el.dataset.scale);
    mode = 'scale';
  });
  scl.addEventListener('pointermove', e=>{
    if(mode !== 'scale') return;
    const r = rect(), c = _pkdCenter(el);
    const d = Math.hypot(e.clientX-r.left-c[0], e.clientY-r.top-c[1]);
    el.dataset.scale = _pkP().stkClamp(d / (base || 1)).toFixed(3);
    _pkdApplyStk(el);
  });
  scl.addEventListener('pointerup', ()=>{ if(mode === 'scale') _pkdCommit(); mode = null; });

  const rot = el.querySelector('.pk-hnd.rot');
  rot.addEventListener('pointerdown', e=>{
    e.stopPropagation(); e.preventDefault();
    _pkdSelect(el); rot.setPointerCapture(e.pointerId);
    const r = rect(), c = _pkdCenter(el);
    ang0 = Math.atan2(e.clientY-r.top-c[1], e.clientX-r.left-c[0]);
    rot0 = +el.dataset.rot; mode = 'rot';
  });
  rot.addEventListener('pointermove', e=>{
    if(mode !== 'rot') return;
    const r = rect(), c = _pkdCenter(el);
    const a = Math.atan2(e.clientY-r.top-c[1], e.clientX-r.left-c[0]);
    let deg = rot0 + (a-ang0)*180/Math.PI;
    if(e.shiftKey) deg = Math.round(deg/15)*15;          // Shift = 15° 단위
    el.dataset.rot = deg.toFixed(1); _pkdApplyStk(el);
  });
  rot.addEventListener('pointerup', ()=>{ if(mode === 'rot') _pkdCommit(); mode = null; });
}

/* ── 옆줄(스티커·펜) 만들기 — 창이 사는 동안 한 번만 ── */
function _pkdBuildUI(){
  if(PKD.wired) return; PKD.wired = true;
  const P = _pkP();
  const pal = _pkEl('pkPalette');
  if(pal) P.STICKERS.forEach(ch=>{
    const b = document.createElement('button');
    b.textContent = ch;
    b.onclick = ()=>{
      /* 스티커를 누른 것 = 붙이고 옮기겠다는 뜻이다. 펜을 켜둔 채 넣으면 «안 움직인다»가 된다. */
      _pkdSetPen(false);
      _pkdSelect(_pkdMakeStk(ch, null)); _pkdCommit();
    };
    pal.appendChild(b);
  });
  const pt = _pkEl('pkPenTypes');
  if(pt) P.PEN_TYPES.forEach(t=>{
    const b = document.createElement('button');
    b.textContent = t.name; b.dataset.pen = t.id;
    b.onclick = ()=>{
      PKD.type = t.id;
      Array.prototype.forEach.call(pt.children, c=>c.classList.toggle('on', c === b));
      const sw = _pkEl('pkPenColors');
      if(sw) sw.classList.toggle('off', t.id === 'rainbow');   // 무지개는 색을 스스로 정한다
      _pkdPenPreview(); _pkdSetPen(true);                      // 펜을 고른 것 = 그리겠다는 뜻
    };
    pt.appendChild(b);
  });
  const box = _pkEl('pkPenColors');
  if(box) P.PEN_COLORS.forEach(c=>{
    const d = document.createElement('div');
    d.className = 'pk-sw'; d.style.background = c; d.dataset.color = c;
    d.onclick = ()=>{
      PKD.color = c;
      Array.prototype.forEach.call(box.children, x=>x.classList.toggle('on', x === d));
      _pkdPenPreview(); _pkdSetPen(true);
    };
    box.appendChild(d);
  });
  const th = _pkEl('pkThick');
  if(th) th.oninput = ()=>{
    PKD.w = P.penWClamp(+th.value);
    const v = _pkEl('pkThickVal'); if(v) v.textContent = PKD.w;
    _pkdPenPreview(); _pkdSetPen(true);
  };

  /* 시트 위에서 그린다. 캔버스 좌표가 아니라 **저장 좌표**로 담는다. */
  const cv = _pkEl('pkSheet');
  if(cv){
    const at = e=>{
      const r = cv.getBoundingClientRect(), D = P.DECO_DISP;
      return [(e.clientX-r.left)*cv.width/r.width/D, (e.clientY-r.top)*cv.height/r.height/D];
    };
    cv.addEventListener('pointerdown', e=>{
      if(!PKD.penOn){ _pkdSelect(null); return; }
      PKD.drawing = true; cv.setPointerCapture(e.pointerId);
      PKD.strokes.push({ t:PKD.type, c:PKD.color, w:PKD.w/P.DECO_DISP, p:[at(e)], hue0:Math.random()*360 });
      _pkdPaint();
    });
    cv.addEventListener('pointermove', e=>{
      if(!PKD.drawing) return;
      PKD.strokes[PKD.strokes.length-1].p.push(at(e)); _pkdPaint();
    });
    cv.addEventListener('pointerup', ()=>{ if(PKD.drawing) _pkdCommit(); PKD.drawing = false; });
  }
}
/* ✋/✏️ 모드는 **누른 것으로 정해진다** — 버튼을 따로 누를 필요가 없다.
     펜 종류·색·굵기를 건드리면 → ✏️ 그리기      스티커를 누르면 → ✋ 옮기기
   ★ 위의 두 버튼은 없애지 않았다. «지금 어느 모드인가»를 보여주는 표시이자 손으로 되돌리는
     길이기도 하다(시트 왼쪽 위 배지와 같은 값을 가리킨다).
   ⚠️ 자동 전환을 «그리기 시작할 때»가 아니라 «도구를 고를 때»에 건다. 그리기 시작을 기다리면
     첫 획이 스티커 고르기로 먹혀서 «펜을 골랐는데 안 그려진다»가 된다. */
/* 옆줄은 창이 사는 동안 한 번만 만든다. 그래서 두 번째 촬영에서는 **표시만** 남아 있다 —
   지난번에 글로우를 골랐으면 버튼은 글로우인데 실제 펜은 기본으로 돌아가 있다.
   ⚠️ «고른 것과 보이는 것이 다르다»는 눌러 보기 전에는 모른다. 열 때마다 여기서 맞춘다. */
function _pkdResetTools(){
  const pt = _pkEl('pkPenTypes');
  if(pt) Array.prototype.forEach.call(pt.children, c=>c.classList.toggle('on', c.dataset.pen === PKD.type));
  const box = _pkEl('pkPenColors');
  if(box){
    box.classList.toggle('off', PKD.type === 'rainbow');
    Array.prototype.forEach.call(box.children, d=>d.classList.toggle('on', d.dataset.color === PKD.color));
  }
  const th = _pkEl('pkThick'); if(th) th.value = PKD.w;
  const tv = _pkEl('pkThickVal'); if(tv) tv.textContent = PKD.w;
}
function _pkdSetPen(on){
  PKD.penOn = !!on;
  const tp = _pkEl('pkToolPen'), tm = _pkEl('pkToolMove'),
        cv = _pkEl('pkSheet'), host = _pkEl('pkSheetHost'), b = _pkEl('pkModeBadge');
  if(tp) tp.classList.toggle('on', PKD.penOn);
  if(tm) tm.classList.toggle('on', !PKD.penOn);
  if(cv) cv.style.cursor = PKD.penOn ? 'crosshair' : '';
  if(host) host.classList.toggle('penmode', PKD.penOn);
  if(b){ b.textContent = PKD.penOn ? '✏️ 그리는 중 — 스티커는 안 움직여요' : '✋ 옮기는 중';
         b.classList.toggle('pen', PKD.penOn); }
  if(PKD.penOn) _pkdSelect(null);
}
function _pkdPenPreview(){
  const pp = _pkEl('pkPenPreview'); if(!pp) return;
  const P = _pkP(), g = pp.getContext('2d');
  g.clearRect(0,0,pp.width,pp.height);
  g.fillStyle = '#555'; g.fillRect(0,0,pp.width,pp.height);
  const pts = [];
  for(let i=0;i<=28;i++){ const t = i/28; pts.push([10 + t*(pp.width-20), 17 + Math.sin(t*Math.PI*2.1)*9]); }
  _pkdBlit(g, [{t:PKD.type, c:PKD.color, w:PKD.w, p:pts, hue0:0}], 1, pp.width, pp.height);
}

/* ── 되돌리기 / 앞으로 ── */
function _pkdSnapshot(){
  const host = _pkEl('pkSheetHost');
  return JSON.stringify({
    st: PKD.strokes,
    sk: [].slice.call(host ? host.querySelectorAll('.pk-stk') : []).map(el=>({
      ch:el.dataset.ch, l:parseFloat(el.style.left), t:parseFloat(el.style.top),
      r:+el.dataset.rot, s:+el.dataset.scale, f:el.dataset.flip, z:+el.style.zIndex || 1
    }))
  });
}
function _pkdRestore(json){
  const v = JSON.parse(json), host = _pkEl('pkSheetHost');
  PKD.strokes = v.st;
  if(host) host.querySelectorAll('.pk-stk').forEach(el=>el.remove());
  PKD.sel = null; PKD.z = 1;
  v.sk.forEach(d=>{ _pkdMakeStk(d.ch, d); PKD.z = Math.max(PKD.z, d.z); });
  PKD.saved = false;
  _pkdPaint(); _pkdSyncHist();
}
function _pkdCommit(){
  const now = _pkdSnapshot();
  if(PKD.hi >= 0 && PKD.hist[PKD.hi] === now) return;    // 안 바뀌었으면 안 쌓는다
  PKD.hist = PKD.hist.slice(0, PKD.hi+1);                // 되돌린 뒤 새로 그리면 앞쪽 기록은 버린다
  PKD.hist.push(now); PKD.hi = PKD.hist.length - 1;
  const P = _pkP();
  if(PKD.hist.length > P.HIST_MAX){ PKD.hist.shift(); PKD.hi--; }
  PKD.saved = false;
  _pkdSyncHist();
}
function _pkdUndo(){ if(PKD.hi > 0){ PKD.hi--; _pkdRestore(PKD.hist[PKD.hi]); } }
function _pkdRedo(){ if(PKD.hi < PKD.hist.length-1){ PKD.hi++; _pkdRestore(PKD.hist[PKD.hi]); } }
function _pkdSyncHist(){
  const u = _pkEl('pkUndoBtn'), r = _pkEl('pkRedoBtn');
  if(u) u.disabled = PKD.hi <= 0;
  if(r) r.disabled = PKD.hi >= PKD.hist.length-1;
}
/* Ctrl+Z / Ctrl+Shift+Z (Ctrl+Y 도 받는다 — 윈도 프로그램의 오랜 관습)
   ⚠️ 입력칸에 포커스가 있으면 손대지 않는다. 캡처 단계에서 가져가되 여기서만 멈춘다 —
     캐릭터 만들기 창에도 같은 조합이 걸려 있어서 흘려보내면 양쪽이 함께 되돌린다. */
function _pkdKey(e){
  if(!PKD.on || _pkTyping()) return;
  if(!(e.ctrlKey || e.metaKey)) return;
  const k = (e.key || '').toLowerCase();
  if(k === 'z'){ e.preventDefault(); e.stopImmediatePropagation(); e.shiftKey ? _pkdRedo() : _pkdUndo(); }
  else if(k === 'y'){ e.preventDefault(); e.stopImmediatePropagation(); _pkdRedo(); }
}

/* ── 저장 — 1200×1600 으로 **다시 그린다** ──
   화면 그림을 확대하는 게 아니라 같은 데이터를 큰 좌표로 다시 그리는 것이라 선과 글자가 선명하다.
   ⚠️ 서버에 안 올린다. 이 화면 전체에서 유일하게 바깥으로 나가는 길이 «내 컴퓨터로 내려받기»다. */
function _pkdSave(){
  const P = _pkP(), host = _pkEl('pkSheetHost');
  const S = 1 / P.DECO_DISP;
  const out = document.createElement('canvas');
  out.width = P.sheetW(PK.orient); out.height = P.sheetH(PK.orient);
  const o = out.getContext('2d');
  o.imageSmoothingQuality = 'high';
  if(PK.sheet) o.drawImage(PK.sheet, 0, 0);            // 이미 저장 해상도다 — 확대가 아니다
  P.strokeGroups(PKD.strokes).forEach(gp=>_pkdBlit(o, gp, 1, out.width, out.height));
  (host ? host.querySelectorAll('.pk-stk') : []).forEach(el=>{
    const c = _pkdCenter(el);
    const sc = +el.dataset.scale, rt = (+el.dataset.rot)*Math.PI/180, f = el.dataset.flip==='1' ? -1 : 1;
    o.save();
    o.translate(c[0]*S, c[1]*S);
    o.rotate(rt); o.scale(sc*f, sc);
    o.font = (P.STK_FONT*S)+'px serif'; o.textAlign = 'center'; o.textBaseline = 'middle';
    o.fillText(el.dataset.ch, 0, 0);
    o.restore();
  });
  out.toBlob(b=>{
    if(!b){ toast('저장하지 못했어요 — 잠시 뒤에 다시 눌러 주세요'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = '스티커사진_' + _pkStamp() + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    PKD.saved = true; PKD.closeArm = 0;
    toast('내 컴퓨터에 저장했어요');
  }, 'image/png');
}
/* 파일 이름에 붙일 시각. 같은 이름이 겹치면 (1) 이 붙어서 어느 게 어느 건지 못 알아본다. */
function _pkStamp(){
  const d = new Date(), p = n=>String(n).padStart(2,'0');
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
}

/* ── 창 옮기기 ──
   ★ 대화창·마이홈과 같은 관례다: 타이틀바를 잡아 끌고, 누르는 순간 앞으로 온다.
     앞으로 오는 것과 ⎋ 는 이미 붙어 있다 — `_WIN_Z_LAYERS` 의 pointerdown 캡처와
     `escRegisterWindow` 가 각각 맡는다. 여기서 새로 붙이는 것은 **드래그뿐**이다.
   ⚠️ 위치는 localStorage 에 안 남기고 **세션 동안만** 들고 있다. 이 창은 꾸미기로 넘어갈 때
     600 → 840px 로 넓어져서, 껐다 켠 뒤 옛 위치를 그대로 쓰면 오른쪽이 화면 밖으로 나간다.
     그래서 열 때·넓어질 때마다 _pkClampWin 으로 다시 가둔다. */
let _pkWinPos = null;                       // {left, top} — 창을 한 번이라도 끌었을 때만 생긴다
function _pkClampWin(){
  const w = _pkEl('pkWin'); if(!w || !_pkWinPos) return;
  const maxL = Math.max(0, innerWidth - w.offsetWidth), maxT = Math.max(0, innerHeight - w.offsetHeight);
  _pkWinPos.left = Math.max(0, Math.min(maxL, _pkWinPos.left));
  _pkWinPos.top  = Math.max(0, Math.min(maxT, _pkWinPos.top));
  w.style.left = _pkWinPos.left+'px'; w.style.top = _pkWinPos.top+'px';
}
function _pkApplyWinPos(){
  const w = _pkEl('pkWin'); if(!w) return;
  if(!_pkWinPos){ w.style.transform = ''; w.style.left = ''; w.style.top = ''; return; }
  w.style.transform = 'none';               // 가운데 정렬을 풀고 절대 좌표로 넘어간다
  _pkClampWin();
}
function _pkBindWinDrag(){
  const win = _pkEl('pkWin'), bar = win && win.querySelector('.pk-tbar');
  if(!win || !bar) return;
  let dragging = false, offX = 0, offY = 0;
  bar.addEventListener('pointerdown', e=>{
    /* 닫기 버튼은 드래그 시작 안 함 — 타이틀바가 손잡이라 빼주지 않으면 누를 때마다 창이 끌린다
       (#chatCloseBtn·#gachaInvHead 와 같은 관례). */
    if(e.target.closest && e.target.closest('#pkCloseBtn')) return;
    dragging = true;
    const r = win.getBoundingClientRect();
    offX = e.clientX - r.left; offY = e.clientY - r.top;
    win.style.transform = 'none';
    _pkWinPos = { left:r.left, top:r.top };
    win.style.left = r.left+'px'; win.style.top = r.top+'px';
    try{ bar.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  });
  bar.addEventListener('pointermove', e=>{
    if(!dragging) return;
    _pkWinPos = { left:e.clientX-offX, top:e.clientY-offY };
    _pkClampWin();
  });
  const end = e=>{ if(!dragging) return; dragging = false;
                   try{ bar.releasePointerCapture(e.pointerId); }catch(_){} };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);
  /* 화면 크기가 바뀌면 밖으로 나간 창을 데려온다 — 안 하면 «창이 사라졌다»가 된다. */
  window.addEventListener('resize', ()=>{ if(PK.open) _pkClampWin(); });
}

/* ── 배선 (한 번만) ── */
(function _pkWire(){
  const ov = _pkEl('pkOverlay'); if(!ov) return;
  _pkBindWinDrag();
  const cb = _pkEl('pkCloseBtn'); if(cb) cb.onclick = e=>{ e.stopPropagation(); closePurikura(false); };
  const lb = _pkEl('pkLeaveBtn'); if(lb) lb.onclick = e=>{ e.stopPropagation(); closePurikura(false); };
  const sb = _pkEl('pkStartBtn'); if(sb) sb.onclick = e=>{ e.stopPropagation(); _pkStart(); };
  const ko = _pkEl('pkKoBlack');
  if(ko) ko.onchange = ()=>{ if(PK.up.some(Boolean)) toast('이미 올린 프레임에는 적용되지 않아요 — 다시 올려주세요'); };
  /* 🎨 꾸미기 — 저장 버튼은 **이 하나뿐**이다. 촬영이 끝난 자리에 하나 더 두면
     «어느 것이 완성본인가»가 갈린다(그래서 촬영 쪽에는 안 붙였다). */
  const tp = _pkEl('pkToolPen');  if(tp) tp.onclick = e=>{ e.stopPropagation(); _pkdSetPen(true); };
  const tm = _pkEl('pkToolMove'); if(tm) tm.onclick = e=>{ e.stopPropagation(); _pkdSetPen(false); };
  const ub = _pkEl('pkUndoBtn');  if(ub) ub.onclick = e=>{ e.stopPropagation(); _pkdUndo(); };
  const rb = _pkEl('pkRedoBtn');  if(rb) rb.onclick = e=>{ e.stopPropagation(); _pkdRedo(); };
  const clb = _pkEl('pkClearBtn');
  if(clb) clb.onclick = e=>{
    e.stopPropagation();
    const h = _pkEl('pkSheetHost');
    PKD.strokes = [];
    if(h) h.querySelectorAll('.pk-stk').forEach(s=>s.remove());
    PKD.sel = null; _pkdPaint(); _pkdCommit();
  };
  const sv = _pkEl('pkSaveBtn'); if(sv) sv.onclick = e=>{ e.stopPropagation(); _pkdSave(); };
  /* ⎋ ESC 사다리에 태운다 — 마지막에 연 창부터 닫히는 그 순서에 합류한다.
     ⚠️ isOpen 은 **DOM 을 읽어** 판정할 것(플래그를 따로 들면 어긋난다). */
  if(typeof escRegisterWindow === 'function') escRegisterWindow({
    key:'purikura', el:ov,
    isOpen:()=>ov.classList.contains('on'),
    close:()=>closePurikura(false)
  });
})();

return {
  open: openPurikura,                     // 📷 버튼(이모티콘 줄) — 정원 · 촬영 중 · 자리 잡기는 전부 이 안에서
  close: closePurikura,                   // 🏢 회사원 모드 켜기 — close(true)
  isOpen: _pkIsOpen,                      // 🪄 때리기 'b' 조준 — 창이 열려 있으면 키는 무대의 것
  phase: ()=>PK.state,                    // 'lobby' · 'shooting' · … — 회사원 모드는 촬영 중엔 안 닫는다
  /* _purikura() 세션 콜백 — ⚠️ 창이 닫혀 있는 동안에도 불린다(각 핸들러가 PK.open 을 먼저 본다) */
  onPeers(p){ PK.peers = p || {}; },
  onMeta: _pkOnMeta,
  onPeerEvent: _pkOnPeerEvent,
  onShot: _pkOnShot,
  /* 화면 없이 검사하는 상태 — sim-purikura-ui.js */
  state: ()=>PK,
  deco: ()=>PKD,
};
}

const api = { createPurikuraUi };
if(typeof window !== 'undefined') window.TwPurikuraUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
