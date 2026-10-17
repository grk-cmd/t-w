/* creator-state.js — 🧍 생성기 상태: 캐릭터 생성기 한 세션의 값(미리보기 3D · 카메라 · 단계 · 붓 · 도장 · 책상 세팅 · 코드 가져오기)을 한 곳에 든다
   app.js 곳곳의 꼭대기 let 58개를 처음 값 그대로 모은 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다.
   ・책임: 값을 들고 읽기 · 쓰기 함수(getter · setter)로 내놓는 것뿐 — 그리기 · 저장 · DOM 은 하지 않는다.
   ・받는 deps 1 — 값 DESK_SCALE_DEFAULT(책상 크기 처음 값 — HTML 슬라이더와 짝이라 app.js 에 둔다).
   ・내놓는 것: 이름마다 get · set — app.js 는 crState.이름 으로 읽고 대입한다(crState.cDeskPos.x = 1 처럼 안쪽을 바꾸는 것도 그대로).
     생성기 조각 모듈은 이 객체 하나(crState)를 deps 로 받으면 된다 — 읽는 · 쓰는 함수를 이름마다 따로 넘기지 않는다.
   ⚠️ 여러 곳이 전역으로 직접 읽는 creatorOpen · creatorMode · curSlot(animal.js)은 여기 없다(app.js 에 남김).
   ⚠️ 전역 이름은 TwCreatorState(Tw 접두사 #103).
   검사: checks/sim-creator-state.js */
(function(){

function createCreatorState(deps){
const DESK_SCALE_DEFAULT = deps.DESK_SCALE_DEFAULT;
let editingSlot=-1, pendingSlot=0;
let cTopColor='#9dba8a', cBotColor='#d98e73';
let crStep=1, brushColor='#333333', brushSize=11, eraser=false, blinkEdited=false, skinIndex=0;
let currentCreatorDef = null;   // openCreator로 들어온 원본 def — 커미션 여부 판정에 사용
let cXform={s:0.7,y:0,z:0,rot:0}, cDeskColor='#c9a36a', cDeskScale=DESK_SCALE_DEFAULT, cDeskLenX=1;
/* 🪑 책상 위치 오프셋(생성기 세션). 저장은 def.deskPos — 전부 0 이면 아예 저장하지 않는다
(기존 캐릭터 데이터에 없던 필드라, 0 을 굳이 적어 넣으면 옛 저장분과 모양이 갈린다). */
let cDeskPos = {x:0, y:0, z:0};   // 좌석 변형 · 책상 색 · 커스텀 책상 크기 · 책상 길이(X)
let faceCamSaved=null;   // 1~3단계(피부/표정/감은눈) 카메라 각도 유지용
let deskCamSaved=null;   // 5~6단계(책상/좌석) 카메라 각도 유지용
let painting=false, lastPX=null, lastPY=null, lastSX=null, lastSY=null, symmetry=false;
/* 🖌 칠하기 도구(붓 · 페인트통 · 지우개 — paint-tools.js). 아래 도구 줄을 만들 때 채운다. 없으면(모듈 누락) 붓만. */
let crPaintTool=null;
let _pLastScr = null, _pLastUV = null, _pLastPt = null, _pLastSUV = null;
let stampMode=false, stampImg=null;
let stampDirty=false;   // true면 사용자가 크기/회전을 만진 상태 — 새 이미지 불러와도 이전 변형 유지(b안: 가로·세로 그대로)
// placement: 캔버스(미리보기) 픽셀 좌표 기준. cx,cy = 중심, w/h = 화면상 크기, rot = 라디안
let stampPlace={cx:0,cy:0,w:120,h:120,rot:0,aspect:1};
let crItemPage = 0;   // 책상 세팅 - 아이템 목록 현재 페이지(0부터 시작)
let _assetImpKind='item';   // 코드로 추가하기 창을 어느 버튼(책상/아이템/파츠)으로 열었는지 기억 — 코드 자체의 종류가 아니라 이 값을 기준으로 등록함
let _assetImpCat=null;   // kind==='part'일 때, 어느 카테고리(모자/탈/안경 등)에 등록할지
let cRenderer=null, cScene=null, cCam=null, cBase=null, cAmb=null, cKey=null, cFill=null, cDesk=null, cDeskMat=null, cFloor=null;
let camDist=1.5, camYaw=0, camPitch=0.05, orbiting=false, lastMX=0, lastMY=0;
let _rcOrbit=null;   // 우클릭 드래그 회전 상태 — {x,y,moved}. 클릭만이면 스포이드로 폴백
let cFaceDist=1.15, cBodyDist=3.9;
/* 현재 활성 책상의 저장 ID (기본 책상이면 null) — 카드 on 표시용 */
let activeCustomDeskId=null;
let cDeskTemplate=null, cDeskGlbB64=null;   // 생성기 세션의 커스텀 책상

return {
  get cTopColor(){ return cTopColor; }, set cTopColor(v){ cTopColor = v; },
  get cBotColor(){ return cBotColor; }, set cBotColor(v){ cBotColor = v; },
  get editingSlot(){ return editingSlot; }, set editingSlot(v){ editingSlot = v; },
  get pendingSlot(){ return pendingSlot; }, set pendingSlot(v){ pendingSlot = v; },
  get crStep(){ return crStep; }, set crStep(v){ crStep = v; },
  get brushColor(){ return brushColor; }, set brushColor(v){ brushColor = v; },
  get brushSize(){ return brushSize; }, set brushSize(v){ brushSize = v; },
  get eraser(){ return eraser; }, set eraser(v){ eraser = v; },
  get blinkEdited(){ return blinkEdited; }, set blinkEdited(v){ blinkEdited = v; },
  get skinIndex(){ return skinIndex; }, set skinIndex(v){ skinIndex = v; },
  get currentCreatorDef(){ return currentCreatorDef; }, set currentCreatorDef(v){ currentCreatorDef = v; },
  get cXform(){ return cXform; }, set cXform(v){ cXform = v; },
  get cDeskColor(){ return cDeskColor; }, set cDeskColor(v){ cDeskColor = v; },
  get cDeskScale(){ return cDeskScale; }, set cDeskScale(v){ cDeskScale = v; },
  get cDeskLenX(){ return cDeskLenX; }, set cDeskLenX(v){ cDeskLenX = v; },
  get cDeskPos(){ return cDeskPos; }, set cDeskPos(v){ cDeskPos = v; },
  get faceCamSaved(){ return faceCamSaved; }, set faceCamSaved(v){ faceCamSaved = v; },
  get deskCamSaved(){ return deskCamSaved; }, set deskCamSaved(v){ deskCamSaved = v; },
  get painting(){ return painting; }, set painting(v){ painting = v; },
  get lastPX(){ return lastPX; }, set lastPX(v){ lastPX = v; },
  get lastPY(){ return lastPY; }, set lastPY(v){ lastPY = v; },
  get lastSX(){ return lastSX; }, set lastSX(v){ lastSX = v; },
  get lastSY(){ return lastSY; }, set lastSY(v){ lastSY = v; },
  get symmetry(){ return symmetry; }, set symmetry(v){ symmetry = v; },
  get crPaintTool(){ return crPaintTool; }, set crPaintTool(v){ crPaintTool = v; },
  get _pLastScr(){ return _pLastScr; }, set _pLastScr(v){ _pLastScr = v; },
  get _pLastUV(){ return _pLastUV; }, set _pLastUV(v){ _pLastUV = v; },
  get _pLastPt(){ return _pLastPt; }, set _pLastPt(v){ _pLastPt = v; },
  get _pLastSUV(){ return _pLastSUV; }, set _pLastSUV(v){ _pLastSUV = v; },
  get stampMode(){ return stampMode; }, set stampMode(v){ stampMode = v; },
  get stampImg(){ return stampImg; }, set stampImg(v){ stampImg = v; },
  get stampDirty(){ return stampDirty; }, set stampDirty(v){ stampDirty = v; },
  get stampPlace(){ return stampPlace; }, set stampPlace(v){ stampPlace = v; },
  get crItemPage(){ return crItemPage; }, set crItemPage(v){ crItemPage = v; },
  get _assetImpKind(){ return _assetImpKind; }, set _assetImpKind(v){ _assetImpKind = v; },
  get _assetImpCat(){ return _assetImpCat; }, set _assetImpCat(v){ _assetImpCat = v; },
  get cRenderer(){ return cRenderer; }, set cRenderer(v){ cRenderer = v; },
  get cScene(){ return cScene; }, set cScene(v){ cScene = v; },
  get cCam(){ return cCam; }, set cCam(v){ cCam = v; },
  get cBase(){ return cBase; }, set cBase(v){ cBase = v; },
  get cAmb(){ return cAmb; }, set cAmb(v){ cAmb = v; },
  get cKey(){ return cKey; }, set cKey(v){ cKey = v; },
  get cFill(){ return cFill; }, set cFill(v){ cFill = v; },
  get cDesk(){ return cDesk; }, set cDesk(v){ cDesk = v; },
  get cDeskMat(){ return cDeskMat; }, set cDeskMat(v){ cDeskMat = v; },
  get cFloor(){ return cFloor; }, set cFloor(v){ cFloor = v; },
  get camDist(){ return camDist; }, set camDist(v){ camDist = v; },
  get camYaw(){ return camYaw; }, set camYaw(v){ camYaw = v; },
  get camPitch(){ return camPitch; }, set camPitch(v){ camPitch = v; },
  get orbiting(){ return orbiting; }, set orbiting(v){ orbiting = v; },
  get lastMX(){ return lastMX; }, set lastMX(v){ lastMX = v; },
  get lastMY(){ return lastMY; }, set lastMY(v){ lastMY = v; },
  get _rcOrbit(){ return _rcOrbit; }, set _rcOrbit(v){ _rcOrbit = v; },
  get cFaceDist(){ return cFaceDist; }, set cFaceDist(v){ cFaceDist = v; },
  get cBodyDist(){ return cBodyDist; }, set cBodyDist(v){ cBodyDist = v; },
  get activeCustomDeskId(){ return activeCustomDeskId; }, set activeCustomDeskId(v){ activeCustomDeskId = v; },
  get cDeskTemplate(){ return cDeskTemplate; }, set cDeskTemplate(v){ cDeskTemplate = v; },
  get cDeskGlbB64(){ return cDeskGlbB64; }, set cDeskGlbB64(v){ cDeskGlbB64 = v; },
};
}

const api = { createCreatorState };
if(typeof window !== 'undefined') window.TwCreatorState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
