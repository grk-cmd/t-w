/* char-apply.js — 🧬 캐릭터 def 를 좌석에 입히기(앱 FSD · app.js 분리 M12)
   app.js 의 applyCharToSeat 묶음(좌석 파츠 비우기 · 리깅 파츠 xf 다시 굽기 · 동물 좌석 다시 빌드 · placeholder 클릭 판정 · 동물 귀 등록 · applyCharToSeat)을 글 그대로 옮긴 모듈이다.
   동작은 옮기기 전과 같다(뒤에서 만들어지거나 다시 대입되는 값을 읽는 함수로 받는 줄만 `이름()` 으로 달라지고, seats 가 deps 값이 돼 쓸모없어진 `typeof seats` 가드 하나는 걷음).
   ・책임: applyCharToSeat(좌석에 def 를 입힌다 — 라이드 정리 · 파츠 비우기 · 책상 배율 · 커미션/동물/기본 몸 조립 · 크기 주입 · 파츠 · 책상 · 아이템 · 클릭 판정) · _purgeSeatParts · refreshRiggedPartsXf ·
     _setPlaceholderPickable · _registerAnimalEarOn(동물 귀 · 사람 귀 공용 등록) · _sweepAnimalEars · window.rebuildAnimalSeats(animal.js 가 GLB 파싱 뒤에 부른다) · window.registerAnimalEar(animal.js 가 귀가 붙을 때 부른다).
   ・받는 deps 37 — 값 19 · 함수 11 · 읽는 함수 7(BASE_ANIMS · assetCodeMod · curSlot · customItems · deskItemsMod · deskPlaceMod · deskVisualMod — 뒤에서 만들어지거나 다시 대입된다).
   ・내놓는 것: applyCharToSeat · _purgeSeatParts · refreshRiggedPartsXf · _registerAnimalEarOn — app.js 는 같은 이름 const 로 받는다.
   ⚠️ window.rebuildAnimalSeats · window.registerAnimalEar 는 이 모듈을 만들 때 건다(옛 자리와 같은 때) — animal.js 가 window. 로 부른다. 지우면 동물 귀가 안 붙고 동물 캐릭터가 인간으로 남는다.
   ⚠️ 커미션 GLB 가 캐시에 없으면 파싱을 걸고 return 한다 — 그 앞에서 책상 배율 · z 를 한 번 맞춰 두는 까닭이 주석에 있다. 순서를 바꾸지 말 것.
   검사: checks/sim-char-apply.js */
(function(){

function createCharApply(deps){
const _attachHumanEars = deps._attachHumanEars;
const _syncHumanEarRig = deps._syncHumanEarRig;
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const applyDeskItemsTo = deps.applyDeskItemsTo;
const applyEquippedPartsToSeat = deps.applyEquippedPartsToSeat;   // 함수
const applyPartXf = deps.applyPartXf;   // 함수
const assetCodeMod = deps.assetCodeMod;   // 읽는 함수
const b64ToBuf = deps.b64ToBuf;   // 함수
const BASE_ANIMS = deps.BASE_ANIMS;   // 읽는 함수
const clampCharY = deps.clampCharY;
const commSceneCache = deps.commSceneCache;
const compositeFace = deps.compositeFace;   // 함수
const creatorPrevMod = deps.creatorPrevMod;
const curSlot = deps.curSlot;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const DEFAULT_DESK_OVERRIDE_ID = deps.DEFAULT_DESK_OVERRIDE_ID;
const defToBase = deps.defToBase;   // 함수
const deskItemsMod = deps.deskItemsMod;   // 읽는 함수
const deskPlaceMod = deps.deskPlaceMod;   // 읽는 함수
const deskVisualMod = deps.deskVisualMod;   // 읽는 함수
const fitModel = deps.fitModel;
const getCommissionScene = deps.getCommissionScene;   // 함수
const instantiateBase = deps.instantiateBase;   // 함수
const lightToneMod = deps.lightToneMod;
const matToneMod = deps.matToneMod;
const mkFaceTex = deps.mkFaceTex;   // 함수
const renderLauncher = deps.renderLauncher;   // 함수
const rideBenchMod = deps.rideBenchMod;
const seatCharZ = deps.seatCharZ;
const seatEqMod = deps.seatEqMod;
const seatModelLoadMod = deps.seatModelLoadMod;
const seatRefitMod = deps.seatRefitMod;
const seats = deps.seats;
const seatsMod = deps.seatsMod;
const slots = deps.slots;
const unequipPartFromSeat = deps.unequipPartFromSeat;   // 함수
const unequipStackablePart = deps.unequipStackablePart;   // 함수
/* full rebuild 전 파츠 전면 정리 —
   ★ 리빌드가 몸(gltfRoot)만 갈아끼우면: headAnchor 등 좌석 영구 노드에 붙은 옛 파츠 wrapper가 살아남고,
     리빌드 "이전"에 시작돼 아직 GLB 로딩 중이던 장착이 뒤늦게 완료되며 새 몸에 낡은 파츠를 붙임 →
     상대 캐릭터에 파츠가 엉뚱한 위치로 이식된 채 안 돌아오는 유령 증상.
   그래서 (1) 기존 wrapper 전부 해제, (2) _equipSeq 전 키 +1로 진행 중이던 낡은 장착을 전부 무효화. */
function _purgeSeatParts(seat){
  try{
    if(seat.stackedPartObjs){
      for(const c in seat.stackedPartObjs){
        Object.keys(seat.stackedPartObjs[c]).forEach(id=>{ try{ unequipStackablePart(seat, c, id); }catch(_){} });
      }
    }
    if(seat.equippedPartObjs){
      Object.keys(seat.equippedPartObjs).forEach(c=>{ try{ unequipPartFromSeat(seat, c, false); }catch(_){} });
    }
  }catch(_){}
  seat.equippedPartObjs = {};
  seat.stackedPartObjs = {};
  if(seat._equipSeq) for(const k in seat._equipSeq) seat._equipSeq[k]++;
}
/* 리깅 파츠의 xf(bindMatrix)를 현재 모델 스케일 기준으로 다시 굽는다.
   캐릭터 크기(userScale)나 fitModel 재계산이 일어난 뒤 호출해야 파츠가 몸을 따라감. */
function refreshRiggedPartsXf(seat){
  if(!seat) return;
  try{
    if(seat.equippedPartObjs){
      Object.keys(seat.equippedPartObjs).forEach(cat=>{
        const w = seat.equippedPartObjs[cat];
        if(w && w.userData && w.userData.rigged) applyPartXf(seat, cat);
      });
    }
    if(seat.stackedPartObjs){
      Object.keys(seat.stackedPartObjs).forEach(cat=>{
        const map = seat.stackedPartObjs[cat] || {};
        const anyRigged = Object.keys(map).some(id=> map[id] && map[id].userData && map[id].userData.rigged);
        if(anyRigged) applyPartXf(seat, cat);   // applyPartXf가 stackable도 id별로 재적용함
      });
    }
  }catch(_){}
}
/* 🐾 동물 GLB 파싱이 늦게 끝나 인간으로 폴백된 좌석을 다시 동물로 재빌드 (animal.js가 호출) */
window.rebuildAnimalSeats=function(){
  try{
    seats.forEach(st=>{
      if(st && st.charDef && st.charDef.animal){
        applyCharToSeat(st, st.charDef);
      }
    });
    // ★ 런처 미리보기(setLauncherChar→defToBase)도 같은 이유로 파싱 전엔 인간으로 폴백된 채 남아 있음.
    //   좌석만 고치면 "껐다 켜면 런처 슬롯이 기본 캐릭터"가 그대로임 — 동물 슬롯이면 여기서 다시 그린다.
    try{
      const _lc=document.getElementById('launcher');
      if(_lc && _lc.classList.contains('on') && slots[curSlot()] && slots[curSlot()].animal) renderLauncher();
    }catch(_){}
    console.log('[동물] 좌석 재빌드 완료');
  }catch(e){ console.warn('[동물] 좌석 재빌드 실패', e); }
};
/* 🐾 안 보이는 placeholder(내장 스탠드인)를 레이캐스트 대상에서 빼거나 되돌린다.
   Three.js r128의 Raycaster는 visible 플래그를 보지 않아서, 숨겨둔 placeholder(몸통 반지름 0.42 · 머리 0.4의
   '인간 크기' 구체)가 계속 클릭 판정에 잡힌다. 인간은 실제 모델과 크기가 비슷해 티가 안 났지만, 40%인 동물은
   자기 몸보다 훨씬 큰 인간 크기 영역이 잡혀서 쓰다듬기/드래그 인식이 어긋났다.
   ★ 안전장치: 원래 raycast 함수를 userData에 보관했다가 그대로 복원한다(인간으로 교체돼도 원상복구).
     mesh를 지우거나 visible을 건드리지 않으므로 렌더·폴백 로직에는 전혀 영향이 없다.
   ★ 적용 조건: 동물이면서 placeholder가 이미 숨겨진(=실제 모델이 올라온) 경우에만 끈다.
     모델 로드 실패로 placeholder가 보이는 상태면 그대로 클릭 가능해야 하므로 건드리지 않는다. */
function _setPlaceholderPickable(seat, on){
  try{
    const root = seat && seat.placeholder && seat.placeholder.root; if(!root) return;
    root.traverse(o=>{
      if(!o.isMesh) return;
      if(on){
        if(o.userData.__origRaycast){ o.raycast = o.userData.__origRaycast; delete o.userData.__origRaycast; }
      }else{
        if(!o.userData.__origRaycast){ o.userData.__origRaycast = o.raycast; o.raycast = function(){}; }
      }
    });
  }catch(_){}
}
/* 🐾 동물 귀 등록 — 동물 GLB의 ear_L/ear_R 본은 스킨 웨이트가 0%라(실측) 본을 돌려도 아무것도 안 움직인다.
   실제 귀는 별도 GLB를 부착한 물체이므로, 인간의 귀 꾸미기 파츠와 똑같이 '부착물 자체'를 seat.bones.ear에
   넣어야 animateRig의 귀 까닥임이 동작한다(app.js의 partEarObjs 처리와 동일한 패턴).
   귀는 비동기로 늦게 붙기 때문에 두 경로로 등록한다: 즉시 스윕(_sweepAnimalEars) + animal.js 콜백(registerAnimalEar). */
function _registerAnimalEarOn(seat, wrap){
  if(!seat || !wrap || !seat.bones) return;
  if(!seat.bones.ear) seat.bones.ear=[];
  if(!seat.boneRest) seat.boneRest={};
  if(!seat.boneRest.ear) seat.boneRest.ear=[];
  if(seat.bones.ear.indexOf(wrap)>=0) return;   // 중복 등록 방지(재빌드·스윕 중복 대비)
  seat.bones.ear.push(wrap);
  seat.boneRest.ear.push(wrap.quaternion.clone());   // ★ head 본에 attach된 '뒤'의 자세가 기준이어야 함
  seat.earTimers=null;   // 개수가 바뀌었으니 타이머 재생성(animateRig가 알아서 다시 만듦)
  /* 🐰 이 좌석 머리 위에 이미 누가 올라타 있다면, 그 좌석이 캐시한 '머리 꼭대기'는 **귀가 없던
     시절의 값**이다. 귀가 방금 붙었으니 여기서 한 번 다시 잰다(_remeasureRideHeadTop 주석 참고).
     ⚠️ 이 함수는 귀 하나마다 불린다(좌·우) — 재측정도 그만큼 돌지만 몇 번뿐이라 부담이 없고,
       한쪽 귀만 붙은 중간 상태에서 잰 값도 다음 귀가 붙을 때 곧바로 덮인다. */
  rideBenchMod._remeasureRideHeadTop(seat);
}
function _sweepAnimalEars(seat, root){
  if(!seat || !root) return;
  try{ root.traverse(o=>{ if(o.userData && o.userData.animalEar) _registerAnimalEarOn(seat, o); }); }catch(_){}
}
window.registerAnimalEar=function(root, wrap){
  try{ const seat = root && root.userData && root.userData.__animalSeat;
       if(seat) _registerAnimalEarOn(seat, wrap); }catch(_){}
};
function applyCharToSeat(seat,def){
  // ★ 라이드 상태 정리 — 이게 없으면 자리 겹침이 난다.
  //   [증상] 동물이 인간 머리 위에 올라탄 상태에서 그 좌석을 인간으로 교체하면, 교체된 캐릭터가
  //          원래 대상과 같은 자리에 겹쳐 보인다.
  //   [원인] 교체는 charDef·모델·책상만 바꾸고 seat.ridingOn을 그대로 둔다. 그러면 매 프레임
  //          _positionRideSeat가 이 좌석을 대상 머리 위로 계속 끌어올려, layoutSeats가 정해준
  //          바닥 자리(targetX)를 덮어써 버린다. (내 위에 누가 타고 있던 경우도 같이 정리해야 한다.)
  //   [대응] unmountRide가 '위에 탄 좌석 재배치 + group.position/회전 원복'을 모두 해주므로 그대로 쓴다.
  try{
    if(seat.ridingOn) rideBenchMod.unmountRide(seat);                 // 내가 남의 머리에 타고 있던 경우
    if(rideBenchMod._rideRiders(seat).length){                        // 내 머리에 누가 타고 있던 경우
      rideBenchMod._rideRiders(seat).slice().forEach(up=>{ try{ rideBenchMod.unmountRide(up); }catch(_){} });
    }
  }catch(_){}
  seat.charDef=def;
  _purgeSeatParts(seat);   // ★ 리빌드 전 옛 파츠·진행 중 장착 정리 (유령 파츠 방지)
  // 🐾 동물이면 책상도 60%. 캐릭터 교체(인간↔동물)에 대비해 항상 명시적으로 갱신한다.
  //   실제 곱셈은 setDeskScale이 하므로 아래 모든 책상 적용 경로(비동기 포함)에 자동 반영됨.
  //   좌석 간격·카메라 줌은 layoutSeats가 책상 폭을 실측(seatDeskHalfWidth)하므로 따로 손댈 필요 없음.
  if(seat.desk) seat.desk.userData.animCorr = def.animal ? ANIMAL_RUN_SCALE : 1;
  /* 🪑 평준화 배율도 같은 자리에서 갱신한다 — def 가 바뀌면 그 좌석의 캐릭터 크기(xf.s)가 바뀌고,
     내 좌석이 바뀐 경우엔 **다른 모든 좌석의** k 까지 달라진다. seat._eqK 를 지워 다음
     syncSeatEqualize(layoutSeats 도입부)가 전 좌석을 다시 계산하게 둔다. */
  if(seat.desk) seat.desk.userData.eqK = seatEqMod.seatEqK(seat);
  try{ seats.forEach(s2=>{ s2._eqK = undefined; }); }catch(_){}
  // 🐾 책상과의 기본 거리도 같은 비율로 — 프레임 루프가 lerp로 수렴시키지만, 교체 직후 한 프레임
  //   튀어 보이지 않게 여기서 바로 맞춰둔다(fitModel이 rig.position을 저장·복원하므로 값은 유지됨).
  try{ if(seat.rig) seat.rig.position.z = seatCharZ(seat); }catch(_){}
  /* 🐾 캐릭터가 CHAR_Z 로 고정된 만큼 **책상이 그 몫을 진다** — 바로 위 두 줄에서 방금
     animCorr·eqK 를 갈아끼웠으니 여기서 즉시 반영한다.
     ⚠️ 아래쪽 setDeskPos(def.deskPos) 가 어차피 같은 일을 하지만, 그 줄에 도달하기 전에
       **되돌아 나가는 갈래**가 있다(커미션 GLB 가 캐시에 없으면 파싱을 걸고 return —
       그 사이 한 화면은 옛 z 로 그려진다). 그래서 여기서 한 번 더 맞춘다. */
  try{ if(seat.desk) deskPlaceMod().syncSeatDeskZ(seat.desk); }catch(_){}
  // 커미션 캐릭터: 커스텀 베이스 GLB로 인스턴스 생성. 캐시 없으면 비동기 파싱 후 재호출
  let customScene = null;
  if(def.commGlb){
    customScene = commSceneCache.get(def.commGlb);
    if(!customScene){
      getCommissionScene(def.commGlb).then(()=>applyCharToSeat(seat,def)).catch(e=>console.warn('comm GLB 파싱 실패', e));
      return;
    }
  }
  // 🐾 동물 캐릭터 — 좌석 생성 경로는 defToBase를 타지 않으므로 여기에도 같은 분기가 필요함.
  //   animal.js(buildAnimalBase)가 전신 페인트·귀까지 전담 조립. GLB 파싱 전이면 null을 돌려주므로
  //   그때는 아래 인간 경로로 폴백하고, 파싱 완료 시 animal.js가 rebuildAnimalSeats로 이 함수를
  //   다시 불러 동물로 재빌드함. 반환 형태가 instantiateBase와 같아서 아래 블록을 그대로 재사용.
  let inst=null, animBase=null;
  if(def.animal && typeof window.buildAnimalBase==='function'){
    animBase=window.buildAnimalBase(def);
    if(animBase){ inst=animBase; inst._animal=true; }
  }
  if(!inst) inst=instantiateBase(customScene);
  if(inst){
    /* 🐾 **이 좌석이 실제로 동물로 조립됐는가.** charDef.animal 은 저장값이라
       "동물 캐릭터인데 GLB 파싱 전이라 인간으로 폴백된" 상태와 구별하지 못한다(바로 위 분기).
       올라타기 판정(mountRide)이 이 값을 본다 — 자세한 경위는 그쪽 주석에 있다.
       ⚠️ 조건 밖에 두면 안 된다. 아래 `if(inst._animal)` 안에 넣으면 폴백일 때 값이
         갱신되지 않아 **직전 캐릭터의 판정이 그대로 남는다.** */
    seat._animalBuilt = !!inst._animal;
    // 동물은 animal.js가 만든 텍스처(몸 무늬+표정 / 감은눈)를 그대로 사용 — 인간용 얼굴 합성 경로를 타지 않음
    const fT=inst._animal ? animBase.fT : mkFaceTex(compositeFace(def.skin,def.face));
    const bT=inst._animal ? animBase.bT : mkFaceTex(compositeFace(def.skin,def.blink));
    matToneMod.setFaceMap(inst.faceMat, fT);
    // 커미션이 아닐 때만 옷색 적용 (커미션은 텍스처 기반이라 머티리얼 색=흰색 유지)
    if(!def.isCommission){
      if(inst.upMat)inst.upMat.color.set(def.top); if(inst.loMat)inst.loMat.color.set(def.bot);
      if(inst.hatMat&&inst.hatMat.color)inst.hatMat.color.set(def.top);   // 🎩 기본 모자는 상의색을 따라감
    }
    matToneMod.applyLightPresetToInstance(inst);   // 생성기와 같은 톤(텍스처 색을 emissive로 평탄화)
    seat.faceMat=inst.faceMat; seat.faceMapOrig=fT; seat.blinkTex=bT;
    /* 👁 새 모델은 뜬 눈 텍스처로 시작한다 — 감김 표시도 같이 «뜸» 으로 되돌려 둔다.
       프레임 루프는 표시가 **바뀔 때만** 텍스처를 바꾸므로, 졸던 중(closed=true)에 모델이 바뀌면
       표시는 감김인데 그림은 뜬 눈으로 남는다(제보 #6 — 편집 → 완성 후 조는데 눈 뜸). 다음 프레임이 다시 감긴다. */
    if(seat.blink) seat.blink.closed = false;
    seat.upMesh=inst.upMesh||null; seat.loMesh=inst.loMesh||null;   // 옷 교체 시 기본 메시 숨김용
    seat.glassesMesh=inst.glassesMesh||null;   // 안경 파츠 장착 시 기본(베이크된) 안경 숨김용
    seat.hatMesh=inst.hatMesh||null; seat.hatMat=inst.hatMat||null; seat.maskMesh=inst.maskMesh||null; seat.onepieceMesh=inst.onepieceMesh||null;
    seat.wingMesh=inst.wingMesh||null; seat.handLMesh=inst.handLMesh||null; seat.handRMesh=inst.handRMesh||null; seat.capeMesh=inst.capeMesh||null;
    if(!inst._animal) _attachHumanEars(inst.root, def);   // setupSeatModel 이 애니메이션을 걸기 전(바인드 자세)
    seatModelLoadMod.setupSeatModel(seat, inst.root, BASE_ANIMS(), '커스텀 캐릭터');
    // 🐾 동물 귀 등록 — setupSeatModel이 seat.bones를 새로 만들기 때문에 반드시 그 '뒤'에 해야 한다.
    //   __animalSeat: 아직 파싱 중인 귀가 나중에 붙을 때 animal.js가 이 좌석을 찾아오기 위한 역참조.
    if(inst._animal){ inst.root.userData.__animalSeat = seat; _sweepAnimalEars(seat, inst.root); }
    else _syncHumanEarRig(seat);   // 🐾 사람 귀 — setupSeatModel 이 seat.bones 를 새로 만든 뒤에 올린다(동물과 같은 이유)
    
    // [수정] 생성기에서 설정한 캐릭터 크기와 위치 데이터를 메인 화면에 확실하게 주입합니다.
    const xf=def.xf;
    if(xf){ 
      seat.userScale=(xf.s!=null && isFinite(xf.s) && xf.s>0) ? xf.s : 1;   // ★ 0.1.0 등 예전 버전 저장 데이터엔 s(크기) 필드가 없을 수 있어서 방어
      /* 🧍 캐릭터 높이 — 생성기 높이 슬라이더 값(xf.y). fitModel 이 _uz 로 나눠 적용한다.
         🚫 앞뒤(xf.z)는 폐기 — 옛 저장본이 무엇을 갖고 있어도 0 으로 읽는다. CHAR_Z(seat.rig.position.z)가
            책상과의 간격을 정하므로 사용자 조정 항은 필요 없다. 다음 저장 때 xf.z 자체가 0 으로 굳는다.
            ⚠️ COMMISSION_Z_OFFSET·DEFAULT_CHAR_Z_EXTRA_OFFSET 은 둘 다 0 이라 함께 사라진다. */
      seat.userY=clampCharY(xf.y);
      seat.userZ=0;
      seat.userRot=xf.rot; 
      seat.userX=(xf.x!=null?xf.x:0.1); 
    } else { 
      seat.userScale=1;
      seat.userRot=0; 
      seat.userX=0.1; 
    }
    fitModel(seat);
    /* ★ 파츠 부착이 끝난 뒤 fitModel을 한 번 더 돌린다.
       ⛔ 폐기된 이유 — 예전 주석: "파츠가 붙으면 바운딩박스 높이가 달라져서 미리보기와 크기가
          어긋나던 원인 → 미리보기와 같은 조건(파츠 포함 박스)으로 재계산." 그 '파츠 포함' 이
          바로 캐릭터가 파츠 크기에 따라 줄어드는 원인이었다(measureCharBox 주석 참고).
          이제 양쪽 다 맨 몸으로 재므로 크기는 이 재호출과 무관하게 항상 같다.
       ★ 그래도 이 재호출은 남긴다 — 발밑 파츠 바닥 맞춤(measureUnderfootDepth)과 리깅 파츠
          bindMatrix 재굽기(refreshRiggedPartsXf)가 파츠가 붙은 뒤에 한 번은 돌아야 한다. */
    //   ★ 레이스 가드: 투게더룸에서 사람이 나가거나 캐릭터가 교체되면 이 비동기 .then이 "낡은 좌석"에
    //     뒤늦게 발사되어 크기가 튀는 문제(원격 캐릭터가 갑자기 커지는 증상)가 있어서, 좌석이 여전히
    //     같은 charDef를 들고 있고 모델도 살아있을 때만 재계산.
    seatRefitMod.refitSeatAfterParts(seat, { wait: applyEquippedPartsToSeat(seat, def), layout: true, isCurrent: ()=>seat.charDef===def });   // fitModel 내부에서 리깅 파츠 xf도 다시 구움
    
    if(seatsMod.selected()===seat){ 
      document.getElementById('sScale').value=seat.userScale; 
      document.getElementById('sY').value=seat.userY;
      document.getElementById('sZ').value=seat.userZ; 
      document.getElementById('sRot').value=seat.userRot; 
    }
  } else {
    // 폴백: 내장 스탠드인 (기본 캐릭터)
    const base=defToBase(def);
    if(seat.gltfRoot)seat.bodyWrap.remove(seat.gltfRoot);
    seat.placeholder.root.visible=false;
    
    seat.bodyWrap.add(base.group);seat.gltfRoot=base.group;
    seat.modelRoot=base.root;   // 🎩 파츠 좌표계 기준 — base.group은 wrap, 본은 base.root 안에 있다(위 setupSeatModel 주석 참고)
    seat.isPlaceholder=false;seat.mixer=null;seat.hasRig=false;
    seat.faceMat=base.faceMat;seat.faceMapOrig=base.fT;seat.blinkTex=base.bT;
    /* 👁 새 모델은 뜬 눈 텍스처로 시작한다 — 감김 표시도 같이 «뜸» 으로 되돌려 둔다.
       프레임 루프는 표시가 **바뀔 때만** 텍스처를 바꾸므로, 졸던 중(closed=true)에 모델이 바뀌면
       표시는 감김인데 그림은 뜬 눈으로 남는다(제보 #6 — 편집 → 완성 후 조는데 눈 뜸). 다음 프레임이 다시 감긴다. */
    if(seat.blink) seat.blink.closed = false;
    seat.headAnchor.position.set(0,1.2,0);seat.bodyAnchor.position.set(0,0.7,0);
    
    // [수정] 폴백 캐릭터일 때도 생성기에서 설정한 크기를 똑같이 주입합니다.
    const xf=def.xf;
    if(xf){ 
      seat.userScale=(xf.s!=null && isFinite(xf.s) && xf.s>0) ? xf.s : 1;   // ★ 0.1.0 등 예전 버전 저장 데이터엔 s(크기) 필드가 없을 수 있어서 방어
      /* 🧍 캐릭터 높이 — 생성기 높이 슬라이더 값(xf.y). fitModel 이 _uz 로 나눠 적용한다.
         🚫 앞뒤(xf.z)는 폐기 — 옛 저장본이 무엇을 갖고 있어도 0 으로 읽는다. CHAR_Z(seat.rig.position.z)가
            책상과의 간격을 정하므로 사용자 조정 항은 필요 없다. 다음 저장 때 xf.z 자체가 0 으로 굳는다.
            ⚠️ COMMISSION_Z_OFFSET·DEFAULT_CHAR_Z_EXTRA_OFFSET 은 둘 다 0 이라 함께 사라진다. */
      seat.userY=clampCharY(xf.y);
      seat.userZ=0;
      seat.userRot=xf.rot; 
      seat.userX=(xf.x!=null?xf.x:0.1); 
    } else { 
      seat.userScale=1;
      seat.userRot=0; 
      seat.userX=0.1; 
    }
    fitModel(seat);
  }

  // 🐾 진단(임시) — 실행 화면 실측. 비동기(책상 GLB) 적용이 끝난 뒤 재야 정확하다.

  // 🐾 클릭/드래그 히트 영역 — 동물일 때만 숨겨진 placeholder를 레이캐스트에서 제외(인간은 원래대로 복원).
  //   placeholder.root.visible이 확정된 이 시점(모델 조립 이후)에 판정해야 정확하다.
  {
    const _phHidden = !!(seat.placeholder && seat.placeholder.root && seat.placeholder.root.visible === false);
    _setPlaceholderPickable(seat, !(def.animal && _phHidden));
  }

  // [수정] 공통 꾸미기 및 책상 크기/색상 적용 파트
  /* 색을 안 고른 옛 저장도 이 함수를 지나야 한다 — 색은 그대로 두고 조명 예산만 맞춘다. */
  if(seat.deskMat) lightToneMod._setDeskMatColor(seat.deskMat, def.deskColor || null);   
  
  // [수정] 생성기에서 조절한 책상 크기(def.deskScale)를 메인 화면의 책상(seat.desk)에 강제로 반영합니다!
  deskPlaceMod().setDeskScale(seat.desk, def.deskScale||1, def.deskLenX||1);
  deskPlaceMod().setDeskPos(seat.desk, def.deskPos);   // 🪑 책상 위치 오프셋 — 없으면 0,0,0 = 예전과 동일
  
  
  (async()=>{  
    if(def.customItems){ for(const id in def.customItems){ if(!customItems()[id]){ const c=def.customItems[id]; try{ const {scene:sc,animations}=await assetCodeMod().parseGlbFull(b64ToBuf(c.glb)); deskItemsMod().registerCustomItem(id,c.name,c.glb,sc,'',animations);}catch(e){} } } }
    deskVisualMod().applyDeskCatalogRefToSeat(seat, def);   // 고른 책상 · 옛 deskGlb · 관리자가 바꿔 둔 기본 책상 · 내장 기본 책상 — 갈래는 desk-visual.js deskBodyPlan 한 곳
    // ★ 새 아이템 목록을 적용하기 전에 기존에 붙어있던 아이템을 먼저 확실히 뗌 — 이 단계가 없어서
    //   실행 중인 캐릭터를 우클릭으로 수정할 때(특히 아이템을 끄거나 다른 걸로 바꿀 때) 예전 아이템이
    //   계속 남아있던 버그의 원인이었음(생성기 미리보기는 clearCreatorItems가 매번 먼저 비워서 문제 없었음).
    creatorPrevMod.clearHolderDeskItems(seat);
    if(def.deskItems) applyDeskItemsTo(seat, def.deskItems);
  })();
}

return {
  applyCharToSeat,
  _purgeSeatParts,
  refreshRiggedPartsXf,
  _registerAnimalEarOn,
};
}

const api = { createCharApply };
if(typeof window !== 'undefined') window.TwCharApply = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
