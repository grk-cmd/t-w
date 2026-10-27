/* seat-refit.js — 🪑 파츠 구성이 바뀐 뒤 좌석 자리 다시 맞추기 — 길마다 따로 쓰던 «장착 끝 → fitModel → layoutSeats → 올라탄 사람 높이» 한 벌
   책임: 파츠를 붙이거나 뗀 좌석을 같은 순서로 다시 맞춘다 — ① 끝난 장착 기다리기(실패해도 다시 맞추기는 한다) ② 아직 그 좌석 · 그 캐릭터인지 ③ fitModel(발밑 깊이 · 리깅 파츠)
     ④ layoutSeats(부르는 쪽이 원할 때만) ⑤ 다시 맞춘 뒤 할 일 알림(onRefitted — 그 좌석 위에 탄 사람 · 그 좌석이 탄 대상 위에 탄 사람의 머리 꼭대기 값 다시 재기).
   받는 deps: fitModel · layoutSeats(함수 — app.js 가 다시 대입하므로 화살표로) · seats(실행 화면 좌석 배열 — 다음 프레임 맞추기는 여기 있는 좌석만) · requestFrame(requestAnimationFrame).
   내보내는 것: refitSeatAfterParts(seat, opts) — opts: { wait: 기다릴 장착 Promise · layout: layoutSeats 도 부를지 · isCurrent: 기다린 뒤에도 같은 좌석 상태인지(아니면 아무것도 안 함) }
     · requestRefit(seat) — 파츠를 뗀 자리(unequipStackablePart · unequipPartFromSeat)가 부른다. 다음 프레임에 한 번 다시 맞춘다 — 같은 프레임에 여러 번 불러도 좌석마다 한 번.
       기다릴 장착이 없어서 그 사이 다른 장착이 남아 있어도(남은 파츠 GLB 받는 중) 뗀 몫은 바로 맞춘다. 실행 화면 좌석(seats)이 아니면(꾸미기 · 생성기 미리보기) 아무것도 안 한다.
     · onRefitted(fn) — 다시 맞춘 뒤 할 일을 건다(app.js 가 탄 동물 팔 높이 rideBenchMod._remeasureRideArm · 올라탄 사람 높이 _remeasureRideHeadTop 을 건다). 다시 맞춘 좌석과 그 좌석이 탄 대상(ridingOn)에 한 번씩 부른다.
   ★ 올라타기 모듈을 deps 로 받지 않고 알림으로 받는 까닭: ride-bench.js 는 꾸미기 · 방 입장과 한 순환 묶음 안에 있어서, 그 둘이 부르는 이 모듈이
     ride-bench 를 부르면 새 순환이 된다(sim-dep-cycles). 이 모듈은 좌석 줄 배치 아래에 있는 잎으로 둔다.
   ★ 부르는 곳: 꾸미기 저장(wardrobe.js 두 곳) · 친구 파츠 변경(room-entry.js) · 좌석 다시 짓기(app.js applyCharToSeat) · 카탈로그가 늦게 와 붙은 파츠(catalog-sync.js) · 관리자 파츠 다시 등록(admin-part-register.js).
     파츠를 떼는 길(가챠 회수 · 카탈로그 삭제 · 관리자 파츠 삭제 · 친구 화면의 파츠 빼기 등)은 app.js 의 unequipStackablePart · unequipPartFromSeat 가 requestRefit 을 부른다.
     새 길이 «파츠가 바뀌었다» 를 만들면 같은 순서를 다시 쓰지 말고 이 함수를 부른다(sim-seat-refit.js 가 길마다 부르는지 본다).
   ⚠️ 매 프레임 부르지 말 것 — 올라탄 사람 높이는 이름표 · 말풍선 자리의 기준이라 값이 프레임마다 흔들리면 라벨이 떤다(ride-bench.js _remeasureRideHeadTop 주석).
   ⚠️ 전역 이름은 TwSeatRefit — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js 앞에 싣는 classic script. 검사: checks/sim-seat-refit.js */
(function(){

function createSeatRefit(deps){
const fitModel = deps.fitModel;
const layoutSeats = deps.layoutSeats;
const requestFrame = deps.requestFrame;
const seats = deps.seats;
const _refitted = [];   // 다시 맞춘 뒤 할 일(onRefitted) — 지금은 올라탄 사람 높이 다시 재기 하나
function onRefitted(fn){ _refitted.push(fn); }
function _notifyRefitted(seat){ _refitted.forEach(fn => { try{ fn(seat); }catch(_){} }); }
/* 다음 프레임에 맞출 좌석 — 파츠 여러 개를 한꺼번에 떼도(가챠 회수 · 카탈로그 삭제 · 옷 겹침 정리) 좌석마다 한 번만 */
const _pending = new Set();
let _frameAsked = false;
function _runPending(){
  _frameAsked = false;
  const list = [..._pending]; _pending.clear();
  list.forEach(seat => { if(seats.includes(seat)) refitSeatAfterParts(seat); });
}
function requestRefit(seat){
  if(!seat || !seats.includes(seat)) return;
  _pending.add(seat);
  if(_frameAsked) return;
  _frameAsked = true;
  requestFrame(_runPending);
}

async function refitSeatAfterParts(seat, opts){
  if(!seat) return false;
  const o = opts || {};
  if(o.wait){
    /* 장착 하나가 실패해도 이미 붙거나 빠진 파츠 몫은 맞춰야 한다 — 예전엔 거부되면 fitModel 까지 건너뛰어 그 자리 그대로 남았다 */
    try{ await o.wait; }catch(e){ console.warn('[파츠] 장착을 기다리다 실패 — 자리는 그래도 다시 맞춘다', e); }
  }
  /* 기다리는 사이 사람이 나가거나 캐릭터가 바뀌면 낡은 좌석에 뒤늦게 발사된다(원격 캐릭터 크기가 튀던 경위) */
  if(o.isCurrent && !o.isCurrent()) return false;
  if(!seat.gltfRoot) return false;
  _pending.delete(seat);   // 지금 맞추니 다음 프레임 몫은 필요 없다(떼기는 이보다 먼저 일어났다)
  try{ fitModel(seat); if(o.layout) layoutSeats(); }catch(_){}
  _notifyRefitted(seat);
  /* 이 좌석이 남의 머리에 타 있으면 그 대상 위 높이도 다시 잰다 — 판단은 여기 한 곳(방 동기화의 «같은 상태면 건너뜀» 은 다시 재기를 막지 않는다) */
  if(seat.ridingOn) _notifyRefitted(seat.ridingOn);
  return true;
}

return {
  onRefitted,
  refitSeatAfterParts,
  requestRefit,
};
}

const api = { createSeatRefit };
if(typeof window !== 'undefined') window.TwSeatRefit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
