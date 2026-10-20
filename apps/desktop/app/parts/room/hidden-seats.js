/* hidden-seats.js — 🙈 워킹룸 숨기기(_hiddenSeatIds)
   app.js «🙈 워킹룸 숨기기(_hiddenSeatIds)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     _flyActive 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _clearHiddenSeats · _hiddenSeatIds · _hitsSkipHidden · _preferVisibleHit · _reportHiddenSave · _reportHiddenUids · _seatHidden · _skipFlyingRigs · _skipHiddenDesk — app.js 는 hiddenSeatsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwHiddenSeats — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-hidden-seats.js */
(function(){

function createHiddenSeats(deps){
const _flyActive = deps._flyActive;   // 읽는 함수
const seatFromObject = deps.seatFromObject;
const seats = deps.seats;
const _hiddenSeatIds = new Set();
/* 🚩 신고로 숨긴 사람 — **계정(friendUserId) 기준 · 모든 방 · 내 컴퓨터에만 기억**(tw.reportHidden).
   ★ 숨기기(_hiddenSeatIds · 워킹룸 · 이 방 동안)와 모양은 같고 범위만 다르다. 신고해 놓고 다음 방에서
     다시 보이면 이상하므로. 푸는 길은 같다 — 책상 · 이름표 우클릭 «🙉 다시 보이기»(신고는 그대로 남는다).
   ⚠️ 서버에는 쓰지 않는다 — 숨김은 내 화면 일이다. 신고 기록(reports/)과 별개. */
const REPORT_HIDDEN_KEY = 'tw.reportHidden';
const REPORT_HIDDEN_MAX = 200;
const _reportHiddenUids = new Set();
try{ const _rh = JSON.parse(localStorage.getItem(REPORT_HIDDEN_KEY) || '[]'); if(Array.isArray(_rh)) _rh.slice(-REPORT_HIDDEN_MAX).forEach(u=>{ if(typeof u === 'string' && u) _reportHiddenUids.add(u); }); }catch(_){}
function _reportHiddenSave(){
  try{ localStorage.setItem(REPORT_HIDDEN_KEY, JSON.stringify(Array.from(_reportHiddenUids).slice(-REPORT_HIDDEN_MAX))); }catch(_){}
}
function _seatHidden(seat){
  if(!(seat && seat.remote)) return false;
  if(seat.friendUserId && _reportHiddenUids.has(seat.friendUserId)) return true;   // 🚩 모든 채널
  return !!(seat.friendId && window._activeChannel === 1 && _hiddenSeatIds.has(seat.friendId));
}
/* 🩹 [2026-10-02 제보 #7] «머리 잡고 끌면 옆으로 빠지고 올라타기가 안 됨 · 캐릭터 위쪽 다른 앱 클릭을 앱이 가로챔»
   [원인] 동물이 머리 위에 올라타면 그 좌석의 **책상은 desk.visible=false 로 숨기기만** 한다(mountRide).
     좌석 group 은 대상의 머리 높이로 옮겨지므로, 보이지 않는 책상 덩어리가 머리 위 허공에 떠 있게 된다.
     three r128 레이캐스트는 visible 을 안 보므로(위 ⚠️) 그 허공이
       ① 클릭 통과 판정(_pointHitsInteractive)에서 «캐릭터 위» 로 잡혀 다른 앱 클릭을 가로채고
       ② 잡기에서 hit[0] 이 되어 classifyHit → 'desk' → 슬롯 이동 모드(x축만 움직임)로 빠진다.
          올라타기는 흔들기 모드에만 있어 아예 안 일어난다.
   [대응] 숨겨진 **책상**(그 자체 또는 그 아래의 숨겨진 메쉬)에 맞은 것은 버린다.
   ⚠️ visible=false 전부를 거르지 않는다 — 자리비움 중엔 몸통 메쉬를 visible=false 로 숨기는데(applySeatOpacity),
     그것까지 거르면 자리비움 캐릭터를 못 잡게 된다. 지금 문제는 책상뿐이라 책상만 거른다.
   ★ 커스텀 책상을 쓰면 기본 책상 메쉬가 숨겨진 채 남는데(deskGroup defaults) 그것도 같이 걸러진다 — 같은 종류의 유령이다. */
function _hitInHiddenDesk(obj){
  let hidden = false;
  for(let o = obj; o; o = o.parent){
    if(o.visible === false) hidden = true;
    if(hidden){ for(let i = 0; i < seats.length; i++){ if(seats[i].desk === o) return true; } }
  }
  return false;
}
/* 🩹 #7 — 숨긴 책상 히트를 뺀다. 뺄 것이 없으면 **같은 배열**을 돌려준다(_hitsSkipHidden 과 같은 약속).
   ⚠️ _hitsSkipHidden 안에 넣지 않는다 — 그 함수는 sim-seat-hide 가 따로 떼어 돌리는 단위라 바깥 함수에 기대면 안 된다.
     호출부에서 `_skipHiddenDesk(_hitsSkipHidden(...))` 로 겹쳐 쓴다. */
function _skipHiddenDesk(hits){
  if(!hits || !hits.length) return hits;
  let drop = false;
  for(let i = 0; i < hits.length; i++){ if(_hitInHiddenDesk(hits[i].object)){ drop = true; break; } }
  return drop ? hits.filter(h=>!_hitInHiddenDesk(h.object)) : hits;
}
/* 🩹 날아가는 캐릭터(💣 · 🔫 룰렛 · 🎲 · 깜짝쇼)는 클릭 통과 판정에서 뺀다.
   [제보] «날리기 할 때 클릭 통과가 안 먹어서 뒤의 작업이 막힌다.»
   [원인] 비행 중인 rig 는 10초 동안 화면 전체를 튕겨 다닌다. 다른 앱을 쓰던 커서 밑을 지나가면
     _pointHitsInteractive 의 레이캐스트가 «캐릭터 위» 로 잡아 클릭받기로 바꾸고, 그 순간의 클릭이
     투명 창에 꽂혀 쓰던 앱의 포커스를 뺏는다.
   [왜 빼도 되나] 날아가는 캐릭터는 누를 일이 없다 — 잡기(pointerdown)는 seat.fly 면 그냥 돌아가고,
     💣 · 🪄 조준도 비행 중인 표적은 거절한다. 받아 봐야 쓸 데 없는 클릭이다.
   ★ rig(움직이는 몸)만 뺀다. 같은 좌석의 책상은 제자리에 있으므로 예전처럼 판정한다.
   ⚡ 날고 있는 좌석이 없으면 같은 배열을 그대로 돌려준다 — 빈 공간 판정의 추가 비용 0. */
function _hitInFlyingRig(obj){
  for(let o = obj; o; o = o.parent){
    for(let i = 0; i < seats.length; i++){ if(seats[i].fly && seats[i].rig === o) return true; }
  }
  return false;
}
function _skipFlyingRigs(hits){
  if(!_flyActive() || !hits || !hits.length) return hits;   // startFlight 가 바로 올리고, 매 프레임 다시 센다
  return hits.filter(h=>!_hitInFlyingRig(h.object));
}
/* 🩹 [2026-10-08 제보 #7] 잡기 — **보이는 것에 맞은 히트를 먼저.** 없으면 예전처럼 첫 히트.
   [증상] 자리비움 이미지를 건 사람 머리 위의 동물을 눌러도 안 내려오고, 그 사람(이미지째)이 흔들린다.
   [원인] 자리비움이면 몸 메시를 visible=false 로 숨기는데(setSeatOpacity) three r128 레이캐스트는 visible 을 안 본다.
     이미지가 있으면 탑승자를 이미지 윗변에 내려 앉히므로 숨은 몸 윤곽 안으로 들어가고, 숨은 몸이 hit[0] 이 된다.
   ⚠️ 안 보이는 히트를 **버리지 않는다** — 이미지 없는 자리비움 캐릭터는 몸 전체가 숨어 있어서, 버리면 그 사람을
     쓰다듬지 못하게 된다(_hitInHiddenDesk 위 주석의 결정). 순서만 바꾼다.
   ★ 클릭 통과 판정(_pointHitsInteractive)은 «맞았는가» 만 보므로 순서와 무관 — 호버와 클릭이 어긋나지 않는다. */
function _hitVisible(obj){
  for(let o = obj; o; o = o.parent){ if(o.visible === false) return false; }
  return true;
}
function _preferVisibleHit(hits){
  if(!hits || hits.length < 2 || _hitVisible(hits[0].object)) return hits;
  for(let i = 1; i < hits.length; i++){
    if(_hitVisible(hits[i].object)) return [hits[i]].concat(hits.slice(0, i), hits.slice(i + 1));
  }
  return hits;
}
function _hitsSkipHidden(hits){
  if(!_hiddenSeatIds.size && !_reportHiddenUids.size) return hits;
  return hits.filter(h=>!_seatHidden(seatFromObject(h.object)));
}
function _clearHiddenSeats(){ _hiddenSeatIds.clear(); }


return {
  _clearHiddenSeats,
  _hiddenSeatIds,
  _hitsSkipHidden,
  _preferVisibleHit,
  _reportHiddenSave,
  _reportHiddenUids,
  _seatHidden,
  _skipFlyingRigs,
  _skipHiddenDesk,
};
}

const api = { createHiddenSeats };
if(typeof window !== 'undefined') window.TwHiddenSeats = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
