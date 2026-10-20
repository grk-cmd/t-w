/* ride-measure.js — 📏 올라타기 실측 — 묘기 접지점 오프셋 · 대상 회전 춤 각 · 동물 팔 높이
   책임: 올라타기에 쓰는 «한 번 재서 캐싱하는» 3D 실측 셋 — 값만 돌려주고 좌석에 쓰지 않는다(캐싱 · 적용은 ride-bench.js).
   받는 deps: seatEqMod(값 — 실효 크기 · 캐릭터 들림). 내보내는 것: _measureCircusFootOff(seat, standLeft) · _rideHostSpinY(host) · _measureAnimalArmH(animalSeat).
   app.js «🪑 좌석 크기 평준화» 구역 안 올라타기 튜닝 사이에 있던 실측 함수를 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄임). 바뀐 코드 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: _measureAnimalArmH · _measureCircusFootOff · _rideHostSpinY — app.js 는 rideMeasureMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRideMeasure — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-ride-measure.js */
(function(){

function createRideMeasure(deps){
const seatEqMod = deps.seatEqMod;
const _rideFootTmpV = new THREE.Vector3(), _rideFootGrp = new THREE.Vector3(), _rideFootTmpQ = new THREE.Quaternion();
/* 🦶 딛는 다리가 좌석 원점에서 얼마나 떨어져 있는지 — 좌석 로컬 방향으로 1회 실측(매 프레임 재면 까딱임 · 흔들림으로 몸이 떤다).
   ⚠️ mountRide 안에서 재면 안 된다 — 드래그 중 들린 rig 높이가 섞여 위 캐릭터가 탑 밖으로 날아간다. rig 가 원점에 놓인 첫 묘기 프레임에서 잰다.
   ⚠️ 잰 값은 크기 가드(CIRCUS_FOOT_OFF_MAX)를 꼭 지난다 — 튀면 보정을 포기한다(예전 동작). */
const CIRCUS_FOOT_OFF_MAX = 0.3;   // 이보다 크면 측정 실패로 간주하고 보정하지 않는다(월드 단위)
function _measureCircusFootOff(seat, standLeft){
  try{
    const b = seat && seat.bones; if(!b || !seat.group) return null;
    const leg = standLeft ? b.legL : b.legR;
    if(!leg) return null;
    seat.group.updateMatrixWorld(true);   // 이번 프레임에 방금 바꾼 위치·회전을 반영시킨 뒤 읽는다
    leg.getWorldPosition(_rideFootTmpV);
    _rideFootGrp.setFromMatrixPosition(seat.group.matrixWorld);
    _rideFootTmpV.sub(_rideFootGrp);                                        // 월드 오프셋
    seat.group.getWorldQuaternion(_rideFootTmpQ);
    _rideFootTmpV.applyQuaternion(_rideFootTmpQ.invert());                  // → 좌석 로컬 방향
    _rideFootTmpV.y = 0;                                                    // 높이는 sink 담당
    const _d = Math.hypot(_rideFootTmpV.x, _rideFootTmpV.z);
    if(!isFinite(_d) || _d > CIRCUS_FOOT_OFF_MAX){
      console.warn('[묘기] 접지점 오프셋이 비정상(' + _d.toFixed(4) + ') — 보정을 건너뜁니다');
      return null;
    }
    return _rideFootTmpV.clone();
  }catch(_){ return null; }
}

/* 🌀 대상이 제자리 회전 춤(/150 묘기 회전 · 오르골) 중 몸통이 돌아간 각(rad) — rig.rotation.y 에서 기준선(pose.turnY)을 뺀다.
   그 회전은 머리 본 월드 위치 · _rideQD 에서 상쇄돼 사라지므로 따로 꺼내 위층에 전한다. 춤이 아니면 0. */
function _rideHostSpinY(host){
  if(!host || !host.rig || !host._danceSpin) return 0;
  return host.rig.rotation.y - ((host.pose && host.pose.turnY) || 0);
}
/* 🐾 동물의 '발바닥→팔' 높이를 실측해 크기 1 기준으로 정규화한다 — 올라탈 때 1회 재서 좌석에 캐싱.
   ★ 기준점은 반드시 bodyWrap(rig 의 자식) — group 으로 재면 드래그로 들린 rig 높이가 섞인다. */
function _measureAnimalArmH(animalSeat){
  try{
    const b = animalSeat && animalSeat.bones && (animalSeat.bones.handL || animalSeat.bones.handR);
    const ref = animalSeat && animalSeat.bodyWrap;
    if(!b || !ref) return null;
    animalSeat.group.updateMatrixWorld(true);
    const _hp = new THREE.Vector3(), _gp = new THREE.Vector3();
    b.getWorldPosition(_hp); ref.getWorldPosition(_gp);
    /* 🪑 실측한 팔 높이는 월드값이라 평준화 배율까지 이미 들어가 있다. raw userScale 로 나누면
       그 k 가 armH 안에 남아, 평준화된 좌석 위에 올라탄 동물이 뜨거나 파묻힌다. */
    const s = seatEqMod.seatScale(animalSeat) || 1;
    /* 🧍 캐릭터 높이(userY)로 들어 올린 양은 뺀다 — 팔 높이가 아니다.
       ★ 높이 상쇄는 _positionRideSeat 가 charLiftWorld 로 한 번에 — 두 곳에서 빼면 두 배가 된다. */
    const h = ((_hp.y - _gp.y) - seatEqMod.charLiftWorld(animalSeat)) / (s || 1);   // 크기 1 기준으로 정규화
    return (isFinite(h) && h > 0) ? h : null;
  }catch(_){ return null; }
}

return {
  _measureAnimalArmH,
  _measureCircusFootOff,
  _rideHostSpinY,
};
}

const api = { createRideMeasure };
if(typeof window !== 'undefined') window.TwRideMeasure = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
