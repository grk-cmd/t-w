/* desk-place.js — 📐 책상 자리 · 크기 — 책상 크기 · 길이 · 위치 오프셋 · 동물/평준화 z 보정 · 책상 위 파츠 핀 상쇄
   책임: 책상 그룹의 자리와 크기만 — 크기 · 길이(setDeskScale · setCreatorDeskScale), 위치 오프셋(setDeskPos), 동물 배율 · 평준화로 캐릭터에서 뺀 몫을 책상이 지는 z 보정(seatDeskZCorr · seatDeskPosMul · syncSeatDeskZ), «책상 위» 파츠 핀이 책상 위치 · 슬라이더 크기를 따라가지 않게 상쇄(deskPartAnchorOf · syncDeskPartAnchor).
   받는 deps: CHAR_Z · DESK_SCALE_MIN/MAX/DEFAULT · 생성기 상태(crState).
   내보내는 것: setDeskScale · setCreatorDeskScale · setDeskPos · syncSeatDeskZ · syncDeskPartAnchor · deskPartAnchorOf · DESK_PART_ANCHOR_NAME.
   app.js «🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기» 구역 끝(크기 몫)과 «📌 책상 위 파츠 앵커 · 책상 위치 · 배율» 구역을 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 0줄.
     평준화 가두기(_clampSeatDeskParts)는 평준화 몫이라 seat-eq-clamp.js 로 먼저 뗐다 — 이 모듈은 seat-equalize 를 모른다(순환 없음).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: DESK_PART_ANCHOR_NAME · deskPartAnchorOf · setCreatorDeskScale · setDeskPos · setDeskScale · syncDeskPartAnchor · syncSeatDeskZ — app.js 는 deskPlaceMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDeskPlace — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-desk-place.js */
(function(){

function createDeskPlace(deps){
const CHAR_Z = deps.CHAR_Z;
const DESK_SCALE_DEFAULT = deps.DESK_SCALE_DEFAULT;
const DESK_SCALE_MAX = deps.DESK_SCALE_MAX;
const DESK_SCALE_MIN = deps.DESK_SCALE_MIN;
const crState = deps.crState;
// 책상 길이(lenX)는 그룹 x 배율에만 곱한다 — 책상 위 아이템이 같이 안 늘게 deskAnchor 엔 1/lenX 를 건다.
function setDeskScale(deskGroup,scale,lenX){ if(!deskGroup) return;
  // 🐾 동물 배율(animCorr) · 평준화(eqK)는 여기 한 곳에서 곱한다 — 좌석 책상 경로가 여럿이고 일부는 비동기라 부르는 쪽마다 붙이면 빠진다.
  //   ⚠️ 꾸미기 미리보기(_wdDeskGrp)는 이 함수를 안 타고 ANIMAL_RUN_SCALE 을 직접 곱한다(규약이 다르다).
  /* ⚠️ 크기 없이 부르면(평준화 다시 걸기) 기억해 둔 원본을 쓴다 — (scale||1) 로 읽으면 1 로 굳어 책상이 커지고 원본이 사라진다. */
  const _base = (scale != null) ? scale : deskGroup.userData.deskScaleBase;
  const s = (_base||1) * (deskGroup.userData.animCorr || 1) * (deskGroup.userData.eqK || 1);
  const lx = (lenX!=null) ? lenX : (deskGroup.userData.deskLenX || 1);
  deskGroup.scale.set(s*lx, s, s);
  deskGroup.userData.deskLenX = lx;
  /* 되돌릴 원본 크기를 기억해 둔다(syncSeatEqualize 가 이 값으로 다시 건다). ⚠️ 크기 없이 부른 때는 갱신하지 않는다. */
  if(scale != null) deskGroup.userData.deskScaleBase = (scale||1);
  const anchor = deskGroup.userData.deskAnchor;
  if(anchor){ anchor.scale.set(1/lx, 1, 1); }   // 아이템은 부모의 X 스트레치를 상쇄
  /* 🐾 배율이 바뀌면 z 보정과 파츠 핀 상쇄도 다시 — syncSeatDeskZ 가 끝에서 syncDeskPartAnchor 까지 부른다(빠지면 슬라이더를 만질 때 파츠만 어긋난다). */
  syncSeatDeskZ(deskGroup);
}
// 생성기 미리보기 보정 배율 — 1(미리보기와 실행이 같은 공식). 예전 1.2 는 «실행이 미리보기보다 작다» 로 보였다.
const CREATOR_DESK_VISUAL_OFFSET = 1;
function setCreatorDeskScale(scale){ setDeskScale(crState.cDesk, (scale||1) * CREATOR_DESK_VISUAL_OFFSET, crState.cDeskLenX); }

/* 🪑📌 '책상 위' 파츠가 붙는 핀 — deskAnchor 안의 작은 자식. 파츠의 자리 · 크기는 보관함 상세조정(xf)만 정하게,
   책상 위치 오프셋과 슬라이더 크기 변화를 핀에서 상쇄한다(책상 위 아이템은 그대로 deskAnchor 에 붙어 책상을 따라간다).
   ★ 크기는 «기본값에서 움직인 몫» 만 끊는다(ratio = 기본값 / 슬라이더값) — 통째로 1 로 끊으면 파츠가 5.7 배로 뜬다.
     animCorr · eqK · 길이는 좌석 규약 배율이라 그대로 물려받는다(끊으면 동물 좌석만 2.5 배).
   ⚠️ deskScaleBase 는 setDeskScale 이 심는다 — 그 길을 안 타는 미리보기는 직접 심어야 한다(없으면 ratio 1). */
const DESK_PART_ANCHOR_NAME = '__deskPartAnchor';
function syncDeskPartAnchor(deskGroup){
  if(!deskGroup) return;
  const anchor = (deskGroup.userData && deskGroup.userData.deskAnchor)
              || (deskGroup.getObjectByName && deskGroup.getObjectByName('deskAnchor'));
  if(!anchor || !anchor.getObjectByName) return;
  const pin = anchor.getObjectByName(DESK_PART_ANCHOR_NAME);
  if(!pin) return;                       // 아직 파츠가 안 붙었다 — 만들 때 여기로 다시 온다
  /* 📐 크기 상쇄 — ⚠️ 위치 상쇄보다 먼저(아래 이른 return 때문에 책상을 안 옮긴 사람만 빠진다). */
  const _sBase = deskGroup.userData && deskGroup.userData.deskScaleBase;
  /* ⚠️ 슬라이더 범위 밖이면 손대지 않는다(ratio 1) — 부르는 곳의 `def.deskScale||1` 의 1 은 «모름» 이다. */
  const _ratio = (typeof _sBase === 'number' && isFinite(_sBase)
                  && _sBase >= DESK_SCALE_MIN && _sBase <= DESK_SCALE_MAX)
               ? (DESK_SCALE_DEFAULT / _sBase) : 1;
  pin.scale.set(_ratio, _ratio, _ratio);
  const b = deskGroup.userData && deskGroup.userData.deskPosBase;
  if(!b){ pin.position.set(0,0,0); return; }
  /* 상쇄할 양 = base × setDeskPos 가 곱한 배율. ⚠️ eqK 를 직접 읽지 말고 seatDeskPosMul 로 — 한 글자라도 갈리면 파츠가 책상을 따라간다. */
  const k = seatDeskPosMul(deskGroup);
  /* 부모 사슬(책상 그룹 s·lx → 앵커 1/lx · 회전 없음)의 배율로 성분별로 나눠 로컬 이동량으로. */
  const sx = (deskGroup.scale.x || 1) * (anchor.scale.x || 1);
  const sy = (deskGroup.scale.y || 1) * (anchor.scale.y || 1);
  const sz = (deskGroup.scale.z || 1) * (anchor.scale.z || 1);
  pin.position.set(-(+b.x||0)*k/(sx||1), -(+b.y||0)*k/(sy||1), -(+b.z||0)*k/(sz||1));
}
/* 파츠를 붙일 핀(없으면 만든다) — 좌석 · 생성기 · 런처 · 꾸미기 미리보기가 다 이 길로 온다. 앵커를 만드는 자리가 넷이라 여기서 늦게 만든다. */
function deskPartAnchorOf(seat){
  const anchor = seat && seat.deskAnchor;
  if(!anchor) return null;
  let pin = anchor.getObjectByName && anchor.getObjectByName(DESK_PART_ANCHOR_NAME);
  if(!pin){
    pin = new THREE.Group();
    pin.name = DESK_PART_ANCHOR_NAME;
    anchor.add(pin);
  }
  syncDeskPartAnchor(anchor.parent);   // 앵커의 부모가 곧 책상 그룹이다
  return pin;
}

/* 🪑 책상 위치 — 좌석 원점(캐릭터 발밑) 기준 오프셋. 크기(setDeskScale)와 따로 둔다(scale · position 을 서로 안 밟게).
   ⚠️ 책상 위 아이템은 deskAnchor 자식이라 저절로 따라온다 — 따로 옮기면 두 번 더해진다. '책상 위' 파츠는 핀이 상쇄한다. */
function setDeskPos(deskGroup, pos){
  if(!deskGroup) return;
  const p = pos || {};
  /* 🐾 위치 오프셋도 크기와 같은 배율(animCorr × eqK)을 지난다 — eqK 만 곱했을 땐 동물 좌석에서 옮긴 양이 2.5 배로 들어갔다.
     ⚠️ 배율은 base 에 굽지 않는다(deskPosBase 는 생성기의 100% 원본 — 구우면 열 때마다 누적).
     ⚠️ 이 곱셈은 네 자리가 한 벌 — 여기 · syncSeatDeskZ · syncDeskPartAnchor · 꾸미기 미리보기(_wdDeskGrp). */
  const base = { x:+p.x||0, y:+p.y||0, z:+p.z||0 };
  deskGroup.userData.deskPosBase = base;
  const k = seatDeskPosMul(deskGroup);
  deskGroup.position.set(base.x*k, base.y*k, base.z*k);
  /* z 는 syncSeatDeskZ 가 보정을 얹어 다시 쓰고 파츠 핀 상쇄까지 한다. */
  syncSeatDeskZ(deskGroup);
}
/* 🐾🪑 캐릭터에서 뺀 배율(동물 0.4 · 평준화 k)의 몫을 책상이 진다 — 캐릭터는 CHAR_Z 에 고정하고 잃은 간격을 책상으로 되찾는다.
   공식: deskZ = base.z·a·k + CHAR_Z·(1 − a·k) — 실행 간격 = a·k × 생성기 간격(검산 sim-char-z §3). 사람 · 평준화 꺼짐이면 보정 0.
   ⚠️ deskPosBase 를 건드리지 않는다(보정은 파생값 — 더하면 열 때마다 밀린다).
   ⚠️ base 도 없고 보정도 0 이면 position.z 를 안 건드린다(생성기 기즈모가 직접 쓴 값 보호). */
function seatDeskZCorr(deskGroup){
  const ud = deskGroup && deskGroup.userData;
  if(!ud) return 0;
  const a = +ud.animCorr, k = +ud.eqK;
  const A = (isFinite(a) && a > 0) ? a : 1;      // 없으면(undefined) 1 — 사람·생성기·런처
  const K = (isFinite(k) && k > 0) ? k : 1;
  return CHAR_Z * (1 - A*K);
}
/* 🐾🪑 책상 위치 오프셋이 지나는 배율(animCorr × eqK, 없으면 1) — 정하는 곳은 여기 하나(setDeskPos · syncSeatDeskZ · syncDeskPartAnchor 가 읽는다).
   ⚠️ 꾸미기 미리보기(_wdDeskGrp)는 _wdAnim 을 직접 곱한다 — 값이 같아야 한다. */
function seatDeskPosMul(deskGroup){
  const ud = deskGroup && deskGroup.userData;
  if(!ud) return 1;
  const a = +ud.animCorr, k = +ud.eqK;
  const A = (isFinite(a) && a > 0) ? a : 1;
  const K = (isFinite(k) && k > 0) ? k : 1;
  return A*K;
}
function syncSeatDeskZ(deskGroup){
  if(!deskGroup) return;
  const b = deskGroup.userData && deskGroup.userData.deskPosBase;
  const corr = seatDeskZCorr(deskGroup);
  if(b || corr !== 0){
    const k = seatDeskPosMul(deskGroup);
    deskGroup.position.z = ((b ? (+b.z||0) : 0) * k) + corr;
  }
  /* 📌 파츠 핀 상쇄는 deskPosBase 만 본다(보정은 좌석 전체가 물러난 양이라 파츠도 따라가야 한다).
     ⚠️ 이 줄 덕분에 syncSeatDeskZ 를 부르는 길은 파츠 상쇄를 따로 안 챙긴다 — 빼지 말 것. */
  syncDeskPartAnchor(deskGroup);
}

return {
  DESK_PART_ANCHOR_NAME,
  deskPartAnchorOf,
  setCreatorDeskScale,
  setDeskPos,
  setDeskScale,
  syncDeskPartAnchor,
  syncSeatDeskZ,
};
}

const api = { createDeskPlace };
if(typeof window !== 'undefined') window.TwDeskPlace = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
