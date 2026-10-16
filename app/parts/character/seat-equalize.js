/* seat-equalize.js — 🪑 좌석 크기 평준화 — 내 화면에서만 남의 좌석을 내 캐릭터 크기에 맞추는 배율(k) · 실효 크기
   책임: 좌석 하나의 «실효 크기» 를 정하는 곳 하나 — 배율 k(내 크기 ÷ 그 좌석 크기) · seatScale · 월드 높이 들림(charLiftWorld) ·
     배율이 바뀐 좌석에만 책상 · 캐릭터를 다시 거는 syncSeatEqualize. 켜고 끄는 깃발(seatEqualizeOn · tw.seatEq)도 이 모듈이 든다.
   받는 deps: seats · ANIMAL_RUN_SCALE(값) · findMySeat · clampCharY · fitModel · setDeskScale · setDeskPos · syncSeatDeskZ(함수).
   내보내는 것: seatEqK · seatScale · charLiftWorld · syncSeatEqualize · seatEqualizeOn()/setSeatEqualizeOn(v)(읽는 · 쓰는 함수 — 설정 창이 바꾼다).
   ⚠️ seat.userScale(저장값)은 절대 덮어쓰지 않는다 — 읽는 쪽이 seatScale() 을 지난다. 생성기 UI · saveSeatXf · def 로드는 반대로 raw userScale.
   ★ 방식 C — 좌석 전체(캐릭터 · 책상 · 라벨 높이)에 배율 하나. 캐릭터↔책상 비율은 각자 맞춘 그대로 남는다(B안 «책상 줄까지» 로 바꾸려면 seatEqK 하나만).
   ★ 동물 40%(ANIMAL_RUN_SCALE)는 여기 안 들어간다 — fitModel · setDeskScale 의 별개 곱셈이라 평준화를 켜도 동물은 사람의 40%.
   app.js «🪑 좌석 크기 평준화» 구역의 평준화 몫을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄임). 바뀐 코드 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 6개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: charLiftWorld · seatEqK · seatEqualizeOn · seatScale · syncSeatEqualize — app.js 는 seatEqMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSeatEqualize — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-seat-equalize.js */
(function(){

function createSeatEqualize(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const clampCharY = deps.clampCharY;
const findMySeat = deps.findMySeat;
const fitModel = deps.fitModel;
const seats = deps.seats;
const setDeskPos = deps.setDeskPos;
const setDeskScale = deps.setDeskScale;
const syncSeatDeskZ = deps.syncSeatDeskZ;
let seatEqualizeOn = false;
try{ seatEqualizeOn = (localStorage.getItem('tw.seatEq') === '1'); }catch(_){}   // 기본 끄기(들쑥날쑥한 것도 재미)

function seatEqK(seat){
  if(!seatEqualizeOn || !seat || seat.isMe) return 1;
  /* ⚠️ 기준은 **내 주 좌석**이다. 자리추가(isExtra) 좌석도 맞추는 대상에 넣는다 —
     남만 맞추고 내 부캐가 들쑥날쑥하면 화면은 여전히 가지런하지 않다.
     원격만 맞추고 싶으면 위 조건에 `|| seat.isExtra` 를 더하면 된다(여기 한 줄). */
  const me = findMySeat();
  if(!me || me === seat) return 1;
  const mine = (isFinite(me.userScale)   && me.userScale   > 0) ? me.userScale   : 1;
  const his  = (isFinite(seat.userScale) && seat.userScale > 0) ? seat.userScale : 1;
  const k = mine / his;
  return (isFinite(k) && k > 0) ? k : 1;
}
/* 좌석의 **실효 크기** — 3D·라벨 쪽에서 "좌석 크기"가 필요하면 예외 없이 이걸 부른다.
   ⚠️ 저장·생성기 UI(sScale 입력, saveSeatXf, def 로드)는 반대로 **raw seat.userScale** 을 써야 한다.
     그쪽까지 실효값으로 바꾸면 내 화면의 표시 배율이 저장값이 된다. */
function seatScale(seat){
  const s = (seat && isFinite(seat.userScale) && seat.userScale > 0) ? seat.userScale : 1;
  return s * seatEqK(seat);
}
/* 🧍 캐릭터 높이가 **월드에서 실제로 들어 올리는 양**.
   fitModel 이 m.position.y 에 userY × _animPos ÷ raw userScale 을 넣고, 그 위에 bodyWrap.scale(=seatScale)이
   곱해진다 → 월드 값 = userY × _animPos × (seatScale ÷ raw userScale) = userY × _animPos × 평준화 k.
   ★ 필요한 곳은 '월드 y 를 직접 계산해서 좌석을 놓는' 자리다 — 지금은 올라타기(_positionRideSeat) 뿐이다.
     그 함수는 대상 머리 위 좌표를 seat.group.position 에 직접 쓰는데, 모델은 그 group 안에서 이 양만큼
     더 들려 있다. 빼주지 않으면 높이를 올려둔 캐릭터가 그만큼 머리 위에서 떠 보인다.
   🐾 **_animPos 는 fitModel 과 반드시 같아야 한다.** 한쪽만 바꾸면 동물 머리 위에 올라탄 캐릭터가
     그 차이(2.5배)만큼 뜨거나 파고든다. 두 줄은 항상 함께 고칠 것.
   ⚠️ bodyWrap.scale 은 매 프레임 호흡(breathe)으로 흔들리므로 그 값을 읽지 말고 seatScale 을 쓴다. */
function charLiftWorld(seat){
  if(!seat) return 0;
  const raw = (seat.userScale && isFinite(seat.userScale) && seat.userScale > 0) ? seat.userScale : 1;
  const animPos = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
  return clampCharY(seat.userY) * animPos * ((seatScale(seat) || 1) / raw);
}
/* 배율이 바뀐 좌석만 다시 적용한다. layoutSeats 앞에서 부르므로 자주 불리지만,
   k 가 그대로면 숫자 비교 몇 번으로 끝난다(fitModel 은 바뀐 좌석에만 돈다). */
let _eqSyncing = false;
function syncSeatEqualize(){
  if(_eqSyncing) return;
  _eqSyncing = true;
  try{
    seats.forEach(seat=>{
      const k = seatEqK(seat);
      if(seat._eqK === k) return;
      seat._eqK = k;
      /* 책상은 setDeskScale 이 userData 의 곱셈들(animCorr · eqK)을 모아서 건다 —
         호출부가 다섯 곳이라 거기에 직접 곱하면 반드시 한 곳이 빠진다(animCorr 이 그래서 여기 있다). */
      if(seat.desk){
        seat.desk.userData.eqK = k;
        /* ⚠️ deskScaleBase 가 없으면 «아직 모르는 값» 이지 1 이 아니다(def 가 안 얹힌 좌석) — 1 로 걸면 작은 책상이 커져 간격이 벌어진다.
           ★ 없을 때는 책상을 건드리지 않고 eqK 만 심어 둔다 — 다음 setDeskScale 이 userData.eqK 를 읽어 같이 건다. */
        const _base = seat.desk.userData.deskScaleBase;
        if(_base != null) setDeskScale(seat.desk, _base, seat.desk.userData.deskLenX);
        /* 옮겨 둔 책상은 위치 오프셋도 같은 k 를 지난다(안 옮긴 책상은 base 0 이라 그대로). */
        const _pb = seat.desk.userData.deskPosBase;
        if(_pb) setDeskPos(seat.desk, _pb);
        /* 🐾 앞뒤 보정(CHAR_Z·(1−a·k))은 책상을 옮겼는지와 무관하게 k 가 바뀌면 달라진다 — 조건 없이 다시 건다. */
        syncSeatDeskZ(seat.desk);
      }
      if(seat.bodyWrap) fitModel(seat);   // 캐릭터·앵커 높이 재적용
    });
  }catch(_){}
  _eqSyncing = false;
}

return {
  charLiftWorld,
  seatEqK,
  seatEqualizeOn: ()=>seatEqualizeOn,   // 읽는 함수
  setSeatEqualizeOn: (v)=>{ seatEqualizeOn = v; },   // 쓰는 함수 — 설정 창이 켜고 끈다
  seatScale,
  syncSeatEqualize,
};
}

const api = { createSeatEqualize };
if(typeof window !== 'undefined') window.TwSeatEqualize = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
