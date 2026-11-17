/* creator-face.js — 🙂 생성기 얼굴 · 피부 캔버스 · 몸 만들기(앱 FSD · app.js 분리 T7)
   app.js 의 얼굴 · 피부 그림판(512 캔버스 · 피부 5종 · 합성 · «완전히 비었나») · 사람 몸 조립(defToBase) 자리를 0.13 app.js 글 그대로 옮긴 모듈이다. 본문은 캐릭터 코어(createFace · createBody.assemble)가 하고, 여기는 코어를 부르는 얇은 이름이다.
   ・책임: faceCore 만들기 · CANVAS_SZ · FACE_SYM_SUM · SYM_PX · newCanvas · _isBlankDraw · snapCanvas · SKIN_COLORS · skinCanvases · skinCanvasFor · skinColorFor · compositeFace · charDef · buildCreatorBase · defToBase.
   ・받는 deps 6 — 값 bodyCore · mkFaceTex · skelShare · COMMISSION_SCALE_CORRECTION · _attachHumanEars(함수 — 뒤에서 만들어지는 모듈로 간다) · animalBuilder(읽는 함수 — 동물 조립은 animal.js 가 window 에 건다).
   ・내놓는 것: 위 이름 전부 — app.js 는 같은 이름 const 로 받는다(옛 전역 이름).
   ⚠️ «비었나» 의 true 에는 저장을 막는 힘이 있다 — 판정할 수 없으면 false(코어 주석 · sim-face-loss). 피부 그림 불러오기(loadSkins)는 creator-canvas.js — 불러온 그림은 skinCanvases 같은 칸에 넣는다(얼굴 자동 복구도 같은 배열).
   ⚠️ #830(같은 뼈대 한 벌) skelShare.shareSkeletons 줄은 defToBase 의 onRoot 에 있다(0.13 글에도 있다 — sim-skeleton-share 가 지킨다).
   검사: checks/sim-creator-face.js */
(function(){

function createCreatorFace(deps){
const bodyCore = deps.bodyCore;
const mkFaceTex = deps.mkFaceTex;
const skelShare = deps.skelShare;
const COMMISSION_SCALE_CORRECTION = deps.COMMISSION_SCALE_CORRECTION;
const _attachHumanEars = deps._attachHumanEars;   // 함수
const animalBuilder = deps.animalBuilder;   // 읽는 함수 — animal.js 가 window 에 거는 동물 조립 함수(안 실렸으면 없음)

/* 🙂 얼굴 · 피부 그림판(512 캔버스 · 대칭축 · 피부 5종 · 피부 위에 그림 얹기 · «완전히 비었나» 판정)은 캐릭터 코어(packages/char-core/src/face.ts · #434).
   ⚠️ «비었나» 의 true 에는 저장을 막는 힘이 있다 — 판정할 수 없으면 false(코어 주석 · sim-face-loss). 피부 그림 불러오기(loadSkins)는 앱 몫 —
   불러온 그림은 skinCanvases 같은 칸에 넣는다(얼굴 자동 복구도 같은 배열). */
const faceCore = TwCharCore.createFace({
  makeCanvas: ()=>document.createElement('canvas'),
  isDrawable: (v)=>v instanceof HTMLCanvasElement || v instanceof HTMLImageElement,
});
const CANVAS_SZ=faceCore.CANVAS_SZ;
const FACE_SYM_SUM=faceCore.FACE_SYM_SUM;
const SYM_PX=FACE_SYM_SUM*CANVAS_SZ;     // 픽셀 기준 미러 합
function newCanvas(){ return faceCore.newCanvas(); }
function _isBlankDraw(cv){ return faceCore.isBlankDraw(cv); }
function snapCanvas(src){ return faceCore.snapCanvas(src); }
const SKIN_COLORS=faceCore.SKIN_COLORS;
const skinCanvases=faceCore.skinCanvases;
function skinCanvasFor(i){ return faceCore.skinCanvasFor(i); }
function skinColorFor(i){ return faceCore.skinColorFor(i); }
function compositeFace(skinIdx,drawCv){ return faceCore.compositeFace(skinIdx,drawCv); }
function charDef(skin,face,blink,top,bot){return {type:'creator',skin,face,blink,top,bot};}

/* --- base body builder (내장 스탠드인. 실제 제품에선 리깅된 베이스 GLB로 교체) --- */
function buildCreatorBase(...a){ return bodyCore.buildCreatorBase(...a); }

function defToBase(def, customScene){
  // 🐾 동물 캐릭터 — animal.js가 전담 조립(전신 페인트 텍스처·귀 포함). 실패(모듈 미로드 등) 시 인간 폴백.
  const buildAnimal=def && def.animal && animalBuilder();
  if(buildAnimal){
    const ab=buildAnimal(def);
    if(ab) return ab;
  }
  const fT=mkFaceTex(compositeFace(def.skin,def.face)), bT=mkFaceTex(compositeFace(def.skin,def.blink));
  return bodyCore.assemble({ customScene, faceTex:fT, blinkTex:bT, top:def.top, bot:def.bot,
    recolor:!def.isCommission, scaleMul:def.isCommission ? COMMISSION_SCALE_CORRECTION : 1,
    skinColor:skinColorFor(def.skin), onRoot:(root)=>{ skelShare.shareSkeletons(skelShare.skinnedMeshesOf(root)); _attachHumanEars(root, def); } });
}

return { CANVAS_SZ, FACE_SYM_SUM, SYM_PX, newCanvas, _isBlankDraw, snapCanvas, SKIN_COLORS, skinCanvases, skinCanvasFor, skinColorFor, compositeFace, charDef, buildCreatorBase, defToBase };
}

window.TwCreatorFace = { createCreatorFace };
})();
