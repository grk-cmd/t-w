/* seat-refit.js — 🪑 파츠 구성이 바뀐 뒤 좌석 자리 다시 맞추기 — 길마다 따로 쓰던 «장착 끝 → fitModel → layoutSeats → 올라탄 사람 높이» 한 벌
   책임: 파츠를 붙이거나 뗀 좌석을 같은 순서로 다시 맞춘다 — ① 끝난 장착 기다리기(실패해도 다시 맞추기는 한다) ② 아직 그 좌석 · 그 캐릭터인지 ③ fitModel(발밑 깊이 · 리깅 파츠)
     ④ layoutSeats(부르는 쪽이 원할 때만) ⑤ 다시 맞춘 뒤 할 일 알림(onRefitted — 그 좌석 위에 탄 사람의 머리 꼭대기 값 다시 재기).
   받는 deps: fitModel · layoutSeats(함수 — app.js 가 다시 대입하므로 화살표로).
   내보내는 것: refitSeatAfterParts(seat, opts) — opts: { wait: 기다릴 장착 Promise · layout: layoutSeats 도 부를지 · isCurrent: 기다린 뒤에도 같은 좌석 상태인지(아니면 아무것도 안 함) }
     · onRefitted(fn) — 다시 맞춘 뒤 할 일을 건다(app.js 가 올라탄 사람 높이 다시 재기 rideBenchMod._remeasureRideHeadTop 을 건다).
   ★ 올라타기 모듈을 deps 로 받지 않고 알림으로 받는 까닭: ride-bench.js 는 꾸미기 · 방 입장과 한 순환 묶음 안에 있어서, 그 둘이 부르는 이 모듈이
     ride-bench 를 부르면 새 순환이 된다(sim-dep-cycles). 이 모듈은 좌석 줄 배치 아래에 있는 잎으로 둔다.
   ★ 부르는 곳: 꾸미기 저장(wardrobe.js 두 곳) · 친구 파츠 변경(room-entry.js) · 좌석 다시 짓기(app.js applyCharToSeat) · 카탈로그가 늦게 와 붙은 파츠(catalog-sync.js) · 관리자 파츠 다시 등록(admin-part-register.js).
     새 길이 «파츠가 바뀌었다» 를 만들면 같은 순서를 다시 쓰지 말고 이 함수를 부른다(sim-seat-refit.js 가 길마다 부르는지 본다).
   ⚠️ 매 프레임 부르지 말 것 — 올라탄 사람 높이는 이름표 · 말풍선 자리의 기준이라 값이 프레임마다 흔들리면 라벨이 떤다(ride-bench.js _remeasureRideHeadTop 주석).
   ⚠️ 전역 이름은 TwSeatRefit — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js 앞에 싣는 classic script. 검사: checks/sim-seat-refit.js */
(function(){

function createSeatRefit(deps){
const fitModel = deps.fitModel;
const layoutSeats = deps.layoutSeats;
const _refitted = [];   // 다시 맞춘 뒤 할 일(onRefitted) — 지금은 올라탄 사람 높이 다시 재기 하나
function onRefitted(fn){ _refitted.push(fn); }
function _notifyRefitted(seat){ _refitted.forEach(fn => { try{ fn(seat); }catch(_){} }); }

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
  try{ fitModel(seat); if(o.layout) layoutSeats(); }catch(_){}
  _notifyRefitted(seat);
  return true;
}

return {
  onRefitted,
  refitSeatAfterParts,
};
}

const api = { createSeatRefit };
if(typeof window !== 'undefined') window.TwSeatRefit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
