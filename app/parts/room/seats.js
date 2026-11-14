/* seats.js — 🪑 좌석 목록의 주인: 좌석 배열 · 만들기 · 지우기 · 고른 좌석 · 좌석 간격 저장(앱 FSD · app.js 분리 M6)
   app.js SEATS 구역 머리를 글 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(위층을 부르던 세 줄만 attach 로 받은 알림으로 달라짐).
   ・책임: `seats` 배열(좌석 객체의 단 하나의 목록) · createSeat(책상 + 대신 몸 + 앵커로 좌석 하나를 만들어 씬에 올리고 줄 배치) · removeSeat · 고른 좌석(selected) ·
     좌석 간격 솔로 · 멀티(SPACING · MULTIPLAYER_SPACING — 설정 › 캐릭터 슬라이더가 정하고 localStorage 에 저장 · 자리 셈은 room/seat-layout.js).
   ・받는 deps 4 — CHAR_Z · buildDesk · buildPlaceholder · scene. 위층(줄 배치 · 좌석 탭 · 좌석 고르기)은 부르지 않고 attach({ layoutSeats, selectSeat, renderSeatTabs }) 로 app.js 가 걸어 둔 알림만 부른다 —
     seat-layout · seat-panel 이 이 모듈의 값을 읽어 직접 부르면 순환이 된다(sim-dep-cycles). attach 는 createSeat · removeSeat 를 부르기 전에 한 번.
   ・내놓는 것: attach · seats · createSeat · removeSeat · GAP_MIN · GAP_MAX · GAP_STEPS · saveGap · selected() / setSelected(v) · SPACING() / setSPACING(v) · MULTIPLAYER_SPACING() / setMULTIPLAYER_SPACING(v)
     — app.js 는 seats · 간격 상수 · saveGap · createSeat 를 같은 이름 const 로 받고, 다시 대입되는 셋은 `seatsMod.이름()` 으로 읽는다.
   ⚠️ 좌석 간격 저장 키 tw.gapSolo · tw.gapMulti 는 바꾸지 말 것(저장된 값이 사라진다). 최소 -0.3 은 책상 GLB 박스가 판보다 넓어서다.
   검사: checks/sim-seats.js */
(function(){

function createSeats(deps){
const CHAR_Z = deps.CHAR_Z;
const buildDesk = deps.buildDesk;
const buildPlaceholder = deps.buildPlaceholder;
const scene = deps.scene;
/* 줄 배치 · 좌석 탭 · 좌석 고르기는 위층(seat-layout · seat-panel)이 한다 — 이 모듈은 위층을 부르지 않고 app.js 가 attach 로 걸어 둔 알림만 부른다(모듈 순환 막기) */
let hooks = null;
function attach(h){ hooks = h; }
const seats=[]; let selected=null;
// ★ 좌석 간격 = 책상 끝끼리 여백(설정 › 캐릭터) — 솔로 · 멀티 따로 저장. 자리 셈은 room/seat-layout.js.
//   GAP_MIN 이 음수인 까닭: 책상 GLB 는 보이는 판보다 박스가 넓은 것이 많아 «끝끼리 0» 이어도 벌어져 보인다 — 맨 왼쪽 칸에선 책상끼리 조금 겹치게 붙는다.
//   책상 없는 좌석은 몸 + 여유(0.15)씩이라 -0.3 이면 몸끼리 맞닿는다(seat-layout.js).
const GAP_MIN = -0.3, GAP_MAX = 1.2, GAP_STEPS = 15;
const GAP_KEY_SOLO='tw.gapSolo', GAP_KEY_MULTI='tw.gapMulti';
function _loadGap(key, def){ try{ const v=parseFloat(localStorage.getItem(key)); if(!isNaN(v)) return Math.max(GAP_MIN,Math.min(GAP_MAX,v)); }catch(e){} return def; }
let SPACING = _loadGap(GAP_KEY_SOLO, 0.3);
let MULTIPLAYER_SPACING = _loadGap(GAP_KEY_MULTI, 0.45);
function saveGap(){ try{ localStorage.setItem(GAP_KEY_SOLO, String(SPACING)); localStorage.setItem(GAP_KEY_MULTI, String(MULTIPLAYER_SPACING)); }catch(e){} }
function createSeat(){
  const group=new THREE.Group();
  const desk=buildDesk(true); group.add(desk);
  const _dt=desk.getObjectByName('deskTop'); let deskMat=null; if(_dt){ _dt.material=_dt.material.clone(); deskMat=_dt.material; }
  const rig=new THREE.Group(); rig.position.set(0,0,CHAR_Z);
  const bodyWrap=new THREE.Group(); rig.add(bodyWrap); group.add(rig);
  const ph=buildPlaceholder(); bodyWrap.add(ph.root);
  const seat={
    group,desk,deskMat,deskGltf:null,rig,bodyWrap,placeholder:ph,contactShadow:null,
    isPlaceholder:true,gltfRoot:null,mixer:null,actions:{},current:null,
    faceMat:null,faceMapOrig:null,blinkTex:null,
    userScale:1,userY:0,userZ:0,userRot:Math.PI,userX:0,
    petStart:-1e9,targetX:0,
    pose:{leanX:0,turnY:0,slumpY:0,breSpd:2,breAmp:0.025,eyeOpen:1,arm:0},
    breathePhase:Math.random()*6.28, swayPhase:Math.random()*6.28, headPhase:Math.random()*6.28,
    smooth:0.0016+Math.random()*0.0012,
    bones:{spine:null,head:null,handL:null,handR:null,legL:null,legR:null,ear:[]}, boneRest:{}, hasRig:false,
    blink:TwBlinkTiming.createBlink(performance.now()),
    // 귀 까닥임(랜덤, 가끔) — ear 본이 있는 캐릭터에서만 동작. 상태(idle/focus 등)와 무관하게 독립적으로 작동.
    earNextAt: performance.now()+3000+Math.random()*5000, earFlickStart:null,
    // 머리 위 레벨/이름 이름표 — group에 직접 붙여서(rig 아님) 드래그/흔들기 중에도 책상처럼 제자리에 고정.
    // 머리 위 이름표/말풍선은 DOM 요소로 지연 생성됨(seat.namePlateEl / seat.bubbleEl) — 여기서 미리 선언 불필요.
  };
  group.userData.seat=seat;
  seat.deskAnchor=desk.userData.deskAnchor; seat.deskItems={}; seat.activeDeskItem=null;
  seat.headAnchor=new THREE.Group(); seat.bodyAnchor=new THREE.Group();
  bodyWrap.add(seat.headAnchor); bodyWrap.add(seat.bodyAnchor);
  seat.headAnchor.position.set(0,1.08,0); seat.bodyAnchor.position.set(0,0.46,0);
  seat.equipped={hair:null,accessory:null,clothes:null}; seat.equippedId={hair:null,accessory:null,clothes:null};
  scene.add(group); seats.push(seat); hooks.layoutSeats(); return seat;
}
function removeSeat(seat){
  const i=seats.indexOf(seat); if(i<0||seats.length<=1) return;
  scene.remove(seat.group); seats.splice(i,1);
  if(selected===seat) hooks.selectSeat(seats[Math.max(0,i-1)]);
  hooks.layoutSeats(); hooks.renderSeatTabs();
}

return {
  seats,
  attach,
  createSeat,
  removeSeat,
  GAP_MIN,
  GAP_MAX,
  GAP_STEPS,
  saveGap,
  selected: ()=>selected,
  setSelected: (v)=>{ selected = v; },
  SPACING: ()=>SPACING,
  setSPACING: (v)=>{ SPACING = v; },
  MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING,
  setMULTIPLAYER_SPACING: (v)=>{ MULTIPLAYER_SPACING = v; },
};
}

const api = { createSeats };
if(typeof window !== 'undefined') window.TwSeats = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
