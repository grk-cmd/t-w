/* part-xf.js — 🎀 파츠 저작 오프셋 · xf 적용(앱 FSD · app.js 분리 T5)
   app.js «캐릭터 본의 바인드 자세 역행렬 · 저작 오프셋 · 머리 높이 보정 · xf 적용» 구역을 0.13 app.js 글 그대로 옮긴 모듈이다. 계산 본문은 캐릭터 코어(createParts)가 하고 여기는 앱 몫(진단 로그 · 동물 머리 보정 · 옛 이름 잇기)이다.
   ・책임: _charBoneBindInverses · _computePartAuthorOffset · _diagPartHeadSpace(머리 계열 파츠 실측 진단) · _measureBodyBoxInLocal · _headTopAboveBone · _baseHeadTopAboveBone · _computeAnimalHeadDy(동물 머리 파츠 세로 보정) · _isLegacyAuthorCompensation · _applyXfToWrapper · applyPartXf(wrapper 와 다중 파츠 extras 에 저장된 xf 를 반영).
   ・받는 deps 8 — 값 partsCore(app.js 가 만든 코어 파츠) · PART_DEFAULT_OFFSET · premiumMod · partPaintMod · lightToneMod · bodyMeasureMod · charMeasureMod · 함수 instantiateBase.
   ・내놓는 것: 위 열 이름 가운데 밖에서 부르는 여섯(_computePartAuthorOffset · _diagPartHeadSpace · _computeAnimalHeadDy · _isLegacyAuthorCompensation · _applyXfToWrapper · applyPartXf) — app.js 는 같은 이름 const 로 받는다.
   ⚠️ _computePartAuthorOffset 의 bb 는 equipPartOnSeat 가 피봇용으로 만든 것과 «같은» 박스여야 한다(part-equip.js) — 한쪽만 고치면 피봇과 실제 위치가 어긋난다.
   검사: checks/sim-part-xf.js */
(function(){

function createPartXf(deps){
const partsCore = deps.partsCore;
const PART_DEFAULT_OFFSET = deps.PART_DEFAULT_OFFSET;
const premiumMod = deps.premiumMod;
const partPaintMod = deps.partPaintMod;
const lightToneMod = deps.lightToneMod;
const bodyMeasureMod = deps.bodyMeasureMod;
const charMeasureMod = deps.charMeasureMod;
const instantiateBase = deps.instantiateBase;
/* 캐릭터 본의 '바인드 자세' 역행렬(boneInverse) 모음 — 파츠 저작 오프셋은 반드시 이걸로 계산한다.

   [왜] bone.getWorldPosition() / bone.worldToLocal()은 **지금 자세**를 쓴다. 그런데
        ・꾸미기 미리보기: 애니메이션이 없어 항상 rest 포즈
        ・실행 화면: 숨쉬기·고개짓·타이핑 클립이 돌아 spine/head가 기울어져 있다
        오프셋(≈본에서 머리끝까지, 크기 2 수준)을 기울어진 프레임에서 환산해 굳혀버리면
        기울기만큼 그대로 밀린다. 30°만 기울어도 1.0 가까이 어긋나서 모자가 얼굴 밑으로 내려간다.
        → "미리보기는 정상인데 실행 화면에서만 어긋난다"의 정체.
   [해결] boneInverse는 GLB에 굳어 있는 바인드 자세 값이라 애니메이션과 무관하다.
        모델 좌표의 점에 곱하면 곧바로 그 본의 바인드 로컬 좌표가 된다.
        wrapper는 본의 자식이므로, 바인드 기준으로 앉혀두면 이후 본이 어떻게 움직여도 함께 따라간다.
   ※ 파츠 자신의 스킨드메시는 제외한다 — 그건 캐릭터 리그가 아니라 파츠 리그다. */
function _charBoneBindInverses(modelRoot){ return partsCore.charBoneBindInverses(modelRoot); }
function _computePartAuthorOffset(bb, center, bone, modelRoot, cat, charBones){
  return partsCore.computeAuthorOffset(bb, center, bone, modelRoot, cat, charBones, PART_DEFAULT_OFFSET);
}
/* 🩺 머리 계열 파츠 실측 — "동물에 모자를 씌우면 자리가 틀리다"의 원인을 숫자로 확정하기 위한 진단.

   머리 파츠는 부착 본(head) 로컬 좌표에 놓이는데, 그 단위는 **리그 원본 단위**다. 그래서 파츠가
   제자리를 찾으려면 '저작 당시의 캐릭터'와 '지금 입는 캐릭터'가 같은 리그 비율이어야 한다.
   동물은 그 전제가 깨져 있다 — 실측(animal-glb.js, base2.glb):
       head 본 y = 1.469 / 보이는 머리 꼭대기 y = 2.33~3.31(선택한 얼굴에 따라 다름)
       → 머리가 본보다 0.86~1.84 위까지 뻗는다. 사람 리그는 이 여유가 훨씬 작다.
   그래서 사람 기준으로 저작된 모자는 동물의 큰 머리 '안쪽'에 박힌다.

   보정 계수를 눈으로 맞추지 않기 위해(1-3) 두 캐릭터의 실측값을 같은 형식으로 남긴다.
   인간·동물 각각 한 번씩 로그를 받아 두 박스의 비율로 보정을 유도하는 것이 다음 단계다. */
function _measureBodyBoxInLocal(modelRoot, refNode){
  // refNode 로컬 좌표계에서 캐릭터 '본체' 박스 — 꾸미기 파츠·리깅 파츠(동물 귀 포함)·숨은 메쉬 제외.
  // 파츠 판정은 옛 규칙(리깅 · 이름 — isPartByRigOrName). 월드가 아니라 지정한 노드 기준으로 잰다(frame).
  return bodyMeasureMod.measureBodyBox(modelRoot, { excludeParts: true, partTest: bodyMeasureMod.isPartByRigOrName, visibleOnly: true, frame: refNode });
}
function _diagPartHeadSpace(cat, modelRoot, bone, bb, center, seat, isRigged){
  try{
    if(!modelRoot || !bone || !bb || bb.isEmpty()) return;
    const f = v => (v>=0?' ':'') + v.toFixed(3);
    const kind = (seat && seat.charDef && seat.charDef.animal) ? '동물'
               : (seat && seat.charDef && seat.charDef.isCommission) ? '커미션' : '인간';
    const ctx = (seat && seat.modelRoot) ? '실행좌석' : (seat && seat.root) ? '미리보기' : '기타';
    // 부착 본 위치 (리그 원본 단위)
    const bp = bone.getWorldPosition(new THREE.Vector3()); modelRoot.worldToLocal(bp);
    // 캐릭터 본체 박스 (같은 단위) — 머리 꼭대기까지의 여유가 핵심 숫자
    const body = _measureBodyBoxInLocal(modelRoot, modelRoot);
    const size = bb.getSize(new THREE.Vector3());
    const bs = new THREE.Vector3(); modelRoot.getWorldScale(bs);
    let msg = '[파츠 머리공간] ' + cat + ' — ' + kind + '/' + ctx + (isRigged ? '/리깅' : '/비리깅')
      + '\n    부착본 ' + (bone.name||'?') + ' (' + f(bp.x) + ',' + f(bp.y) + ',' + f(bp.z) + ')'
      + '  본 자체 scale (' + f(bone.scale.x) + ',' + f(bone.scale.y) + ',' + f(bone.scale.z) + ')'
      + '\n    파츠 박스 크기 (' + f(size.x) + ',' + f(size.y) + ',' + f(size.z) + ')'
      + '  중심 (' + f(center.x) + ',' + f(center.y) + ',' + f(center.z) + ')';
    if(!body.isEmpty()){
      msg += '\n    캐릭터 본체 y ' + f(body.min.y) + ' ~ ' + f(body.max.y)
        + ' / x ±' + f(Math.max(Math.abs(body.min.x), Math.abs(body.max.x)))
        + '  → 머리 꼭대기가 부착본보다 ' + f(body.max.y - bp.y) + ' 위';
    }
    msg += '\n    정규화 배율 ' + f(bs.x) + ' (이 값이 화면 크기를 결정 — 파츠 좌표는 이 배율 이전 단위)';
    console.log(msg);
  }catch(e){ console.warn('[파츠 머리공간] 진단 실패', e); }
}
/* 🎩 부착본 위로 머리가 얼마나 뻗는지(리그 원본 단위) — 동물 머리 파츠 보정의 유일한 입력값.
   기본 모자·탈·안경 메쉬는 제외한다. 그건 머리가 아니라 '머리에 얹힌 것'이고, 파츠를 끼면
   applyClothVisibility가 어차피 숨기므로 포함하면 측정이 착용 순서에 따라 흔들린다.
   (실측: 인간 base GLB의 기본 모자를 포함하면 머리 꼭대기가 3.994 → 4.099로 부풀려진다)
   ★ 제외 목록은 HEAD_DECOR_MESH_KEYS 하나뿐이다 — 올라타기 측정(measureHeadBoxNoParts)이
     같은 목록을 쓴다. 여기에 항목을 따로 더하지 말 것. */
function _headTopAboveBone(modelRoot, bone, meshHost){
  if(!modelRoot || !bone) return 0;
  const skip = charMeasureMod.headDecorMeshSet(meshHost);
  modelRoot.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(modelRoot.matrixWorld).invert();
  const bp = bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  // 숨은 메쉬(얼굴 변형 미선택 등) · 리깅 부착물(동물 귀 등) · 이름 파츠 · 장식 메쉬 제외 — 모델 좌표계(frame)로 메쉬마다 잰다
  const boxes = [];
  bodyMeasureMod.measureBodyBox(modelRoot, { excludeParts: true, partTest: bodyMeasureMod.isPartByRigOrName, visibleOnly: true, skipMeshes: skip, frame: modelRoot, updateWorld: false, outBoxes: boxes });
  let top = -Infinity;
  boxes.forEach(b=>{ if(b.max.y > top) top = b.max.y; });
  return (top > -Infinity) ? (top - bp.y) : 0;
}
/* 사람(기본 GLB) 기준 머리 여유 — 파츠가 저작된 리그의 값. 1회 측정 후 캐시.
   ★ 상수로 박지 않는다. base GLB를 손보면 이 값도 같이 따라가야 하고, 숫자를 박아두면 조용히 어긋난다.
   ★ 실패했을 땐 캐시하지 않는다 — BASE_SCENE 파싱 전에 한 번 불리면 0이 영구히 굳어 보정이 죽는다. */
let _BASE_HEAD_TOP = null;
function _baseHeadTopAboveBone(){
  if(_BASE_HEAD_TOP != null) return _BASE_HEAD_TOP;
  try{
    const inst = instantiateBase();
    if(!inst || !inst.root) return 0;   // BASE_SCENE 아직 없음 — 캐시하지 않고 다음 기회에 다시 잰다
    let hb = null;
    inst.root.traverse(o=>{ if(!hb && o.isBone && String(o.name||'').toLowerCase().indexOf('head') >= 0) hb = o; });
    if(!hb) return 0;
    const v = _headTopAboveBone(inst.root, hb, inst);
    if(!(v > 0)) return 0;
    _BASE_HEAD_TOP = v;
    console.log('[파츠 머리보정] 사람 기준 머리 여유 ' + v.toFixed(3) + ' (리그 원본 단위 · 기본 모자 제외)');
  }catch(e){ console.warn('[파츠 머리보정] 사람 기준 측정 실패', e); }
  return _BASE_HEAD_TOP || 0;
}
/* 🐾 동물 머리 파츠 세로 보정량 — 파츠는 사람 리그에 씌운 채 저작되는데, 동물 리그는 머리가 더 낮다.

   실측(base-glb.js / animal-glb.js 디코드):
     ・두 리그는 x·z가 완전히 동일하다(ear_L x = 0.787 양쪽 같음) = 같은 아마추어를 세로로만 옮긴 것
     ・head 본:  사람 y 1.987  vs  동물 y 1.469
     ・머리 꼭대기(본 위): 사람 2.007  vs  동물 1.846/1.304/1.411/0.857 (face1~4, 선택한 얼굴마다 다름)
     ⇒ 파츠가 사람 머리 꼭대기 기준으로 앉으므로, 동물에선 그 차이만큼 머리 위로 떠 있다.
       face2/3/4는 몸 높이의 19~36%나 되는 양이라 눈에 그대로 보인다.

   ★ 크기는 건드리지 않는다. 정규화 배율이 사람 0.3528 / 동물 0.1765(비율 0.500)이고,
     동물 머리 폭이 사람보다 조금 넓어서(±1.151 vs ±1.098) 화면상 파츠/머리 비율이 이미 96% 맞는다.
     세로 위치만 틀렸다 — 여기서 스케일까지 손대면 맞는 것을 망친다.

   적용 조건 (하나라도 어긋나면 0 = 기존 동작 그대로)
     1) 동물 캐릭터만. 사람·커미션은 기준 리그 본인이라 손댈 이유가 없다.
     2) 머리 그룹(group==='head')만.
     3) PART_DEFAULT_OFFSET에 y가 이미 박힌 카테고리(탈·안경 y:-1.95)는 제외 — 눈으로 눌러 맞춰둔
        값과 겹쳐 이중 보정이 된다(_computePartAuthorOffset의 같은 판단과 한 쌍).
     4) 비리깅이면 authorOff가 있는 파츠만. authorOff가 null인 파츠는 원점 저작 = 본에 붙는 게 정상이라
        내리면 오히려 머리 밑으로 꺼진다. (리깅 파츠는 boneInverse가 곧 '사람에 씌운 채 저작'이라 항상 적용) */
function _computeAnimalHeadDy(seat, info, cat, bone, modelRoot, isRigged, authorOff){
  try{
    if(!(seat && seat.charDef && seat.charDef.animal)) return 0;
    if(!info || info.group !== 'head') return 0;
    const dOff = PART_DEFAULT_OFFSET[cat];
    if(dOff && Math.abs(dOff.y || 0) > 1e-6) return 0;
    if(!isRigged && !authorOff) return 0;
    const Ha = _headTopAboveBone(modelRoot, bone, seat);
    const Hh = _baseHeadTopAboveBone();
    if(!(Ha > 0) || !(Hh > 0)) return 0;
    const dy = Ha - Hh;
    if(!isFinite(dy) || Math.abs(dy) < 1e-3) return 0;
    console.log('[파츠 머리보정] ' + cat + ' — 동물 머리 여유 ' + Ha.toFixed(3)
      + ' vs 사람 ' + Hh.toFixed(3) + ' → 세로 ' + dy.toFixed(3) + ' 보정'
      + (isRigged ? ' (리깅: bindMatrix에 굽기)' : ' (비리깅)'));
    return dy;
  }catch(e){ console.warn('[파츠 머리보정] 계산 실패', e); return 0; }
}
/* 어떤 위치값(pos)이 "떠 있던 파츠를 반대로 눌러 맞춰둔 보정값"인지 판정.
   ao(이번에 새로 상쇄하는 양)의 정확히 반대 방향으로 ao 크기의 절반 이상 밀려 있으면 그렇게 본다.
   두 곳에서 쓴다 — (a) 유저가 기즈모로 눌러둔 xf.pos, (b) 카테고리 상수 PART_DEFAULT_OFFSET.

   ★ 저장된 xf.pos를 일괄 변환하지 않는다(핸드오프 3장 0번 ⚠️: 유저 데이터 형태가 균일하지 않다).
     적용 시점에만 판단하므로 형태가 제각각이어도 안전하고, 결과가 멱등이다.
       - 눌러둔 유저: 보던 위치 그대로 유지 → 기즈모를 한 번 만지면 깨끗한 값(≈0)으로 자연 이관
       - 안 눌러둔 유저: 그대로 제자리로 내려옴
   ★ 임계 0.5는 "정상적인 미세조정"과 구분하기 위한 값. 저작 오프셋은 보통 캐릭터 키 수준(≈1.4)이라
     그 0.5배(≈0.7)를 반대 방향으로 미는 조정은 손보정 말고는 나오기 어렵다. */
function _isLegacyAuthorCompensation(pos, ao){ return partsCore.isLegacyAuthorCompensation(pos, ao); }
/* wrapper에 카테고리 기본 오프셋 + 캐릭터별 xf 적용 (부착 시·슬라이더 변경 시 호출) */
// wrapper 하나에 xf(위치/회전/스케일/색상)를 적용하는 공통 로직.
//   기존 applyPartXf(카테고리 단위)와 stackable 파츠 개별 wrapper 양쪽에서 재사용.
function _applyXfToWrapper(wrp, xf, cat){
  partsCore.applyXfToWrapper(wrp, xf, cat, { defaultXf:()=>premiumMod.defaultPartXf(), defaultOffsets:PART_DEFAULT_OFFSET,
    /* 🖍️ 그림칸 — 저장된 그림(URL)을 얹는다. 색과 같은 자리의 인스턴스 값이라 내 파츠든 친구 파츠든 같은 길로 들어온다. */
    applyPic:(w, pic)=>{ if(partPaintMod.wrapperHasPic(w)) partPaintMod.applyPartPic(w, pic); } });
}

/* 파츠 wrapper들에 저장된 xf를 반영.
   ★ 예전엔 seat.charDef.equippedParts[cat]을 통째로 entry로 썼는데, 🔗 stackable로 여러 개를 착용하면
     그 값은 배열(또는 Firebase 숫자키 맵)이라 진짜 entry가 아니다. 게다가 stackable 분기는
     multiExtras를 아예 건드리지 않아서 "다중 파츠를 늘려도 추가된 파츠가 움직이지 않는" 원인이 됐다.
     이제 wrapper.userData.partId로 각자의 entry를 정확히 짚고, 두 분기 모두 인스턴스를 extras까지 적용한다. */
function applyPartXf(seat, cat){
  if(!seat || !seat.charDef) return;
  const def = seat.charDef;
  // wrapper 하나 + 그 다중 파츠 extras에 entry의 인스턴스 xf를 순서대로 적용
  const applyEntryTo = (wrp, entry)=>{
    if(!wrp || !wrp.userData || !wrp.userData.baseCenter) return;
    const instances = premiumMod.partEntryInstances(entry);
    _applyXfToWrapper(wrp, instances[0], cat);
    const extras = wrp.userData.multiExtras || [];
    extras.forEach((ex, i)=> _applyXfToWrapper(ex, instances[i+1] || premiumMod.defaultPartXf(), cat));
  };
  const mainWrp = seat.equippedPartObjs && seat.equippedPartObjs[cat];
  if(mainWrp && mainWrp.userData && mainWrp.userData.baseCenter){
    const mainEntry = premiumMod.findEntryById(def, cat, mainWrp.userData.partId) || premiumMod.firstEntryForCat(def, cat);
    if(mainEntry) applyEntryTo(mainWrp, mainEntry);
  }
  // 🔗 stackable 파츠 — id별 entry를 찾아 각각 적용(다중 파츠 extras 포함)
  if(seat.stackedPartObjs && seat.stackedPartObjs[cat]){
    premiumMod.entriesForCat(def, cat).forEach(entry=>{
      const wrp = seat.stackedPartObjs[cat][premiumMod.partEntryId(entry)];
      if(wrp) applyEntryTo(wrp, entry);
    });
  }
  /* 🪑🦶 "책상 위" 파츠의 바닥 맞춤 — 파츠 **자신**을 들어 올린다.
     [왜 따로 있는가] 이 카테고리는 seat.deskAnchor 에 붙어 gltfRoot **밖**이다(일부러 그렇게 만들었다 —
       캐릭터를 안 따라오는 것이 이 카테고리의 존재 이유다). 그래서 캐릭터를 들어 올리는 쪽의
       바닥 맞춤(measureUnderfootDepth → fitModel)은 이 파츠를 애초에 세지 않고, 센다 해도
       캐릭터만 올라가고 파츠는 제자리에 남아 아무것도 해결되지 않는다.
     ⚠️ 미리보기와 실행 **양쪽이 이 함수를 거친다.** 그래서 한 곳만 고쳐도 둘이 같이 맞는다 —
       한쪽에만 넣으면 미리보기와 실행이 그만큼 어긋난다(이 건의 원래 증상이 그것이었다).
     ★ 실제 계산은 floorClampWrapper 하나로 모아 뒀다(그 주석에 기준·환산 이유가 있다).
       기즈모 드래그(syncWdGizmoToXf)도 같은 함수를 쓴다 — 두 곳이 갈라지면 보이는 자리와
       저장되는 값이 어긋난다. */
  try{
    const _info = premiumMod.partCatInfo(cat);
    if(_info && premiumMod.isDeskPartCat(_info)){
      const _lift = w=>{ if(w) charMeasureMod.floorClampWrapper(w, cat); };
      const _main = seat.equippedPartObjs && seat.equippedPartObjs[cat];
      if(_main){ _lift(_main); (_main.userData.multiExtras || []).forEach(_lift); }
      if(seat.stackedPartObjs && seat.stackedPartObjs[cat]){
        const m = seat.stackedPartObjs[cat];
        Object.keys(m).forEach(id=>{ const w = m[id]; if(w){ _lift(w); (w.userData.multiExtras || []).forEach(_lift); } });
      }
    }
  }catch(_){}
}

return {
  _charBoneBindInverses,
  _computePartAuthorOffset,
  _diagPartHeadSpace,
  _measureBodyBoxInLocal,
  _headTopAboveBone,
  _baseHeadTopAboveBone,
  _computeAnimalHeadDy,
  _isLegacyAuthorCompensation,
  _applyXfToWrapper,
  applyPartXf,
};
}

const api = { createPartXf };
if(typeof window !== 'undefined') window.TwPartXf = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
