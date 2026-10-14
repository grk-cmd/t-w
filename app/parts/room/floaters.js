/* floaters.js — 💞 이모지 떠오르기(FLOATERS — 쓰다듬기 · 반응 이모지)
   app.js «💞 이모지 떠오르기(FLOATERS — 쓰다듬기 · 반응 이모지)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     focusCharScale 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: FLOATER_BASE_SCALE · FLOATER_BURST · FLOATER_RISE · MY_PET_ECHO_MS · MY_PET_SEND_GAP_MS · _myPetLocalAt · _myPetSentAt · emojiReactionsEnabled · floaters · spawnFloater — app.js 는 floatersMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFloaters — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-floaters.js */
(function(){

function createFloaters(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const focusCharScale = deps.focusCharScale;   // 읽는 함수
const scene = deps.scene;
const floaters=[];
function spriteChar(ch,color){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  x.font='90px Fredoka, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle=color;x.fillText(ch,64,70);
  // Additive 블렌딩 — 투명 창 뒤로 바탕화면이 비치는 구조라, 일반 블렌딩은 페이드될수록 배경과 섞여 탁해 보였음.
  // 더하기 블렌딩은 배경이 뭐든 항상 밝게/뽀샤시하게 겹쳐져서 탁해지지 않고 파스텔톤으로 보임.
  return new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));}
const _floaterWP=new THREE.Vector3();
let emojiReactionsEnabled = (localStorage.getItem('tw.emojiReactions') !== '0');   // 기본 켜짐
/* 이모지 반응(zzz·♥·💫) 기본 크기(월드 단위).
   ★ 캐릭터 크기 슬라이더(focusCharScale)를 키우면 카메라가 그만큼 가까워지므로(applyCameraAndCanvas의
     dist 계산: / focusCharScale), 월드 크기가 고정이면 화면에서는 이모지도 같이 커진다.
     화면상 크기를 일정하게 유지하려면 월드 크기를 focusCharScale에 반비례시켜야 한다.
     떠오르는 속도·좌우 퍼짐도 같은 비율로 맞춰야 애니메이션 모양이 그대로 유지된다. */
const FLOATER_BASE_SCALE = 0.1;   // ★ 이모지 기본 크기. 커/작아 보이면 이 숫자만 조절.
const FLOATER_SPREAD_X   = 0.25;  // ★ 생성 시 좌우 산포 폭(월드). 좁히려면 줄임.
const FLOATER_DRIFT_X    = 0.15;  // ★ 떠오르며 좌우로 흘러가는 속도.
const FLOATER_RISE       = 0.3;   // ★ 떠오르는 속도(=세로로 퍼지는 범위).
const FLOATER_HEAD_Y     = 0.65;  // ★ 캐릭터 기준 생성 높이. 낮추면 더 아래에서 생겨남(인간 기준, 동물은 자동 40%).
const FLOATER_BURST      = 5;     // ★ 쓰다듬기·어지러움 등 한 번에 터지는 개수(기존 3 → 1.5배).
/* 💗 내 캐릭터 쓰다듬기 방송(제보 #12) — 보내는 간격 · 내 노드로 돌아온 에코를 무시하는 창 */
const MY_PET_SEND_GAP_MS = 500, MY_PET_ECHO_MS = 1500;
let _myPetSentAt = -Infinity, _myPetLocalAt = -Infinity;
function _floaterK(){ return 1 / Math.max(0.1, (typeof focusCharScale()==='number' ? focusCharScale() : 1)); }
function spawnFloater(ch,color,seat){
  if(!emojiReactionsEnabled) return;   // 설정에서 꺼두면 zzz/하트/💫 등 이모지 반응 생성 안 함
  const sp=spriteChar(ch,color);
  // 캐릭터가 드래그로 흔들리는 중일 수 있으므로, group이 아니라 rig(실제 흔들리는 부분)의 월드 좌표를 기준으로.
  let ox=0, oy=1.4, oz=-0.4;
  if(seat && seat.rig){
    seat.rig.getWorldPosition(_floaterWP);
    // 🐾 동물은 인간의 40% 크기라 인간 기준 머리 높이(0.9)를 그대로 쓰면 머리보다 한참 위에서 뜬다.
    //   이름표(seatLabelHeadY)·상태칩과 같은 방식으로 같은 배율을 곱해 머리 바로 위에 오게 함.
    const _ac = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
    ox=_floaterWP.x; oy=_floaterWP.y+FLOATER_HEAD_Y*_ac; oz=_floaterWP.z+0.1;   // 머리 위 정도로 오프셋
  } else if(seat){
    ox=seat.group.position.x;
  }
  const _k=_floaterK(), _base=FLOATER_BASE_SCALE*_k;
  sp.position.set(ox+(Math.random()-0.5)*FLOATER_SPREAD_X*_k,oy,oz); sp.scale.setScalar(_base);
  sp.userData={life:0,dur:ch==='Z'?2.2:1.6,vx:(Math.random()-0.5)*FLOATER_DRIFT_X*_k,base:_base,rise:FLOATER_RISE*_k};
  scene.add(sp);floaters.push(sp);}

return {
  FLOATER_BASE_SCALE,
  FLOATER_BURST,
  FLOATER_RISE,
  MY_PET_ECHO_MS,
  MY_PET_SEND_GAP_MS,
  _myPetLocalAt: ()=>_myPetLocalAt,   // 읽는 함수
  setMyPetLocalAt: (v)=>{ _myPetLocalAt = v; },   // 쓰는 함수 — app.js 가 비운다
  _myPetSentAt: ()=>_myPetSentAt,   // 읽는 함수
  setMyPetSentAt: (v)=>{ _myPetSentAt = v; },   // 쓰는 함수 — app.js 가 비운다
  emojiReactionsEnabled: ()=>emojiReactionsEnabled,   // 읽는 함수
  setEmojiReactionsEnabled: (v)=>{ emojiReactionsEnabled = v; },   // 쓰는 함수 — app.js 가 비운다
  floaters,
  spawnFloater,
};
}

const api = { createFloaters };
if(typeof window !== 'undefined') window.TwFloaters = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
