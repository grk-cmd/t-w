/* creator-save.js — 🧍 생성기 완료 — 지금 상태 → def · 디자인 용량 재기 · [완료] 저장
   app.js «🧍 생성기 미리보기» 구역의 완료 쪽(_creatorBuildDef · 용량 재기 · [완료] 버튼)을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   생성기 상태는 app.js 에 남아 읽는 · 쓰는 함수로 받는다. 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 45줄 —
     Presence · _blankFaceConfirmed · activeCustomDeskId · cBase · cBotColor · cCam · cDeskColor · cDeskGlbB64 · cDeskLenX · cDeskPos · cDeskScale · cRenderer · cScene · cTopColor · cXform · charsMod · commissionMod · creatorMode · creatorOpen · curSlot · currentCreatorDef · customItems · skinIndex · slotSaveMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setBlankFaceConfirmed · setCreatorOpen · setCurSlot(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 15개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DEF_SIZE_TOAST_MS · _creatorBuildDef · _creatorSizeGrow · _defSizeFile — app.js 는 creatorSaveMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCreatorSave — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-creator-save.js */
(function(){

function createCreatorSave(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const Presence = deps.Presence;   // 읽는 함수
const _blankFaceConfirmed = deps._blankFaceConfirmed;   // 읽는 함수
const _isBlankDraw = deps._isBlankDraw;
const activeCustomDeskId = deps.activeCustomDeskId;   // 읽는 함수
const applyCharToSeat = deps.applyCharToSeat;
const applyDesktopRunClass = deps.applyDesktopRunClass;
const blinkC = deps.blinkC;
const cBase = deps.cBase;   // 읽는 함수
const cBotColor = deps.cBotColor;   // 읽는 함수
const cCam = deps.cCam;   // 읽는 함수
const cDeskColor = deps.cDeskColor;   // 읽는 함수
const cDeskGlbB64 = deps.cDeskGlbB64;   // 읽는 함수
const cDeskLenX = deps.cDeskLenX;   // 읽는 함수
const cDeskPos = deps.cDeskPos;   // 읽는 함수
const cDeskScale = deps.cDeskScale;   // 읽는 함수
const cRenderer = deps.cRenderer;   // 읽는 함수
const cScene = deps.cScene;   // 읽는 함수
const cTopColor = deps.cTopColor;   // 읽는 함수
const cXform = deps.cXform;   // 읽는 함수
const charDef = deps.charDef;
const charsMod = deps.charsMod;   // 읽는 함수
const clampCharY = deps.clampCharY;
const clearStampState = deps.clearStampState;
const collectDeskItems = deps.collectDeskItems;
const commissionMod = deps.commissionMod;   // 읽는 함수
const createSeat = deps.createSeat;
const creatorFlowMod = deps.creatorFlowMod;
const creatorMode = deps.creatorMode;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const curSlot = deps.curSlot;   // 읽는 함수
const currentCreatorDef = deps.currentCreatorDef;   // 읽는 함수
const customItems = deps.customItems;   // 읽는 함수
const faceC = deps.faceC;
const layoutSeats = deps.layoutSeats;
const renderLauncher = deps.renderLauncher;
const renderSeatTabs = deps.renderSeatTabs;
const roomSyncMod = deps.roomSyncMod;
const saveCurSlot = deps.saveCurSlot;
const selectSeat = deps.selectSeat;
const skinIndex = deps.skinIndex;   // 읽는 함수
const slotSaveMod = deps.slotSaveMod;   // 읽는 함수
const slots = deps.slots;
const snapCanvas = deps.snapCanvas;
const toast = deps.toast;
const setBlankFaceConfirmed = deps.setBlankFaceConfirmed;   // 쓰는 함수
const setCreatorOpen = deps.setCreatorOpen;   // 쓰는 함수
const setCurSlot = deps.setCurSlot;   // 쓰는 함수
/* 생성기 지금 상태 → def. [완료] 저장과 📦 용량 재기(forSize)가 같은 함수를 탄다 — 따로 두면 재는 것과 저장하는 것이 갈라진다.
   forSize: 그림은 복사하지 않고(재기에선 URL 자리표시로 바뀐다) 섬네일도 안 찍는다(방에 안 나간다). 결과를 저장에 쓰지 말 것. */
function _creatorBuildDef(forSize){
  const def=charDef(skinIndex(), forSize ? faceC : snapCanvas(faceC), forSize ? blinkC : snapCanvas(blinkC), cTopColor(), cBotColor());
  // ★ 슬롯 섬네일 — 지금 생성기 3D 미리보기를 그대로 찍는다(커미션도 진짜 모습).
  if(!forSize) try{ if(cRenderer() && cScene() && cCam()){ cRenderer().render(cScene(), cCam()); def.thumb = cRenderer().domElement.toDataURL('image/png'); } }catch(e){}
  // 커미션 캐릭터로 진입했다면 GLB·이름·플래그를 새 def에 복사 (안 그러면 기본 GLB로 돌아감)
  if(currentCreatorDef() && currentCreatorDef().isCommission){
    def.isCommission = true;
    def.commName = currentCreatorDef().commName || '커미션';
    def.commGlb = currentCreatorDef().commGlb || null;
  }
  // ★ 꾸미기 파츠는 꾸미기 창에서 정한다 — 새 def 를 만들 때 원래 캐릭터 값을 그대로 이어받는다(빠지면 저장 때마다 파츠가 꺼진다).
  if(currentCreatorDef() && currentCreatorDef().equippedParts) def.equippedParts = currentCreatorDef().equippedParts;
  if(currentCreatorDef() && currentCreatorDef().partXfMemory) def.partXfMemory = currentCreatorDef().partXfMemory;
  // 👂 사람 귀도 꾸미기에서 정한다 — 같은 이유로 그대로 이어받는다(필드는 slotToObj/loadSlots 와 1:1)
  if(currentCreatorDef() && !currentCreatorDef().animal){
    ['earL','earR','earAdj','earPicL','earPicR'].forEach(k=>{ if(currentCreatorDef()[k]!=null) def[k]=currentCreatorDef()[k]; });
  }
  // 🐾 동물 확장 필드도 그대로 이어받는다(빠지면 [완료] 순간 인간 def 로 덮인다). ⚠️ 필드 목록은 slotToObj/loadSlots 와 1:1.
  if(currentCreatorDef() && currentCreatorDef().animal){
    def.animal = true;
    ['animalFace','animalScl','animalEarL','animalEarR','animalEarAdj',
     'animalBody','animalEarPaintL','animalEarPaintR','animalEarBlinkL','animalEarBlinkR','animalBlink'].forEach(k=>{
      if(currentCreatorDef()[k]!=null) def[k]=currentCreatorDef()[k];
    });
    if(!def.thumb && currentCreatorDef().thumb) def.thumb=currentCreatorDef().thumb;   // 캡처 실패 시 동물 창에서 만든 썸네일 유지
  }
  def.xf={s:cXform().s,y:clampCharY(cXform().y),z:0,rot:cXform().rot,x:0};   // 🧍 y=캐릭터 높이 · 🚫 z(앞뒤)는 폐기 — 저장할 때 0 으로 굳는다
  def.deskColor=cDeskColor();
  if(cBase()){
    const di=collectDeskItems(cBase()); def.deskItems=di;   // ★ di가 null(전부 껐을 때)이어도 반드시 반영 — 안 그러면 껐던 아이템이 예전 저장값 그대로 남아있게 됨
    if(di){
    const ci={}; Object.keys(di).forEach(id=>{ const c=customItems()[id]; const rec=commissionMod().savedItems().find(s=>s.id===id);
      // 카탈로그 아이템이면 GLB를 캐릭터에 박아넣지 않음 — 불러올 때 카탈로그 동기화(loadSavedItemsIntoSession)로 자동 채워짐(실시간 교체 반영을 위함)
      if(c && !(rec&&rec.fromCatalog)) ci[id]={name:c.name,glb:c.glb}; });
    if(Object.keys(ci).length) def.customItems=ci; } }
  if(cDeskGlbB64()){
    // 카탈로그(관리자 배포) 책상이면 GLB를 통째로 박아넣는 대신 참조 ID만 저장 — 나중에 관리자가 GLB를 교체해도
    // 이 캐릭터를 불러올 때마다 최신 GLB를 다시 찾아오게 됨(applyDeskCatalogRefToSeat). 로컬 전용(코드로 추가) 책상은 예전처럼 그대로 저장.
    const activeRec = activeCustomDeskId() ? commissionMod().savedDesks().find(d=>d.id===activeCustomDeskId()) : null;
    if(activeRec && activeRec.fromCatalog){ def.deskCatalogId = activeRec.id; }
    else { def.deskGlb=cDeskGlbB64(); }
  }
  if(cDeskScale()!==1) def.deskScale=cDeskScale();
  // 🪑 전부 0(기본 위치)이면 저장하지 않는다 — 옛 저장분과 모양을 갈라놓지 않기 위해서다.
  if(cDeskPos() && (cDeskPos().x || cDeskPos().y || cDeskPos().z)) def.deskPos={x:cDeskPos().x, y:cDeskPos().y, z:cDeskPos().z};
  if(cDeskLenX()!==1) def.deskLenX=cDeskLenX(); else if(def.deskLenX!=null) delete def.deskLenX;
  return def;
}
/* 📦 생성기에서 디자인을 키우기 전에 — patch(def) 로 바꾼 모습을 지금 모습과 견준다(def-size.js).
   실제로 바꾸지 않고 재기만 하므로, 막혀도 되돌릴 것이 없다. 모듈이 없으면 늘 통과(옛 동작). */
const DEF_SIZE_TOAST_MS = 4000;
function _creatorSizeGrow(patch){
  const base = _creatorBuildDef(true);
  const next = Object.assign({}, base);
  if(base.customItems) next.customItems = Object.assign({}, base.customItems);
  patch(next);
  return DefSize.checkGrowth(roomSyncMod.defWireForSize(base), roomSyncMod.defWireForSize(next), roomSyncMod._defSizeNames(next));
}
/* 파일 하나(base64)를 넣기 전 — clear(def) 로 그 파일이 들어갈 자리를 비운 나머지와 견준다. */
function _defSizeFile(restDef, addBytes){
  return DefSize.checkFile(roomSyncMod.defWireForSize(restDef), addBytes);
}
document.getElementById('crDone').addEventListener('click',()=>{
  /* 🛡️ 그림이 있던 캐릭터를 «빈 얼굴»로 저장하려 하면 한 번 묻는다 — saveSlots 의 공백 방어(사고 막기)를 뜻이 있는 저장만 통과시킨다.
     [완료] 는 사용자가 그림을 보고 누르는 유일한 자리라 여기서만 묻는다(자동 저장은 무조건 막는다).
     ⚠️ confirm() 뒤 window.focus() 는 Electron 포커스 함정 보정이다(audit 검사 4). 빼지 말 것. */
  if(currentCreatorDef() && _isBlankDraw(faceC) && !_isBlankDraw(currentCreatorDef().face)){
    if(!confirm('얼굴 그림이 비어 있어요.\n이대로 저장하면 원래 그림은 되돌릴 수 없어요.\n\n정말 저장할까요?')){ window.focus(); return; }
    window.focus();
    setBlankFaceConfirmed(true);   // 바로 아래 saveSlots 1회만 소비한다
  }
  const def=_creatorBuildDef(false);
  /* 📦 마지막 안전망 — 용량을 넘긴 채로 키웠으면 저장하지 않는다(생성기는 열린 채 그대로라 고친 것은 남는다).
     원래 캐릭터보다 커지지 않았으면 통과 — 이미 넘은 옛 캐릭터도 계속 고칠 수 있게. */
  const _sz = DefSize.checkGrowth(currentCreatorDef() ? roomSyncMod.defWireForSize(currentCreatorDef()) : null, roomSyncMod.defWireForSize(def), roomSyncMod._defSizeNames(def));
  if(!_sz.ok){ setBlankFaceConfirmed(false); toast(_sz.message, null, DEF_SIZE_TOAST_MS); return; }
  if(creatorMode().kind==='seat'){
    applyCharToSeat(creatorMode().seat,def);
    // ★ 실행 좌석은 slot 속성이 없다 — 내 좌석이면 curSlot 으로 폴백해 반드시 슬롯에도 저장(안 하면 재시작 때 원복).
    const _slotIdx = (creatorMode().seat.slot!=null) ? creatorMode().seat.slot
                   : (creatorMode().seat.isMe ? curSlot() : null);
    if(_slotIdx!=null){ slots[_slotIdx]=def; if(creatorMode().seat.slot==null) creatorMode().seat.slot=_slotIdx; }
    slotSaveMod().saveSlots();setCreatorOpen(false);document.getElementById('creatorOverlay').classList.remove('on');clearStampState();
    if(creatorMode().seat.isMe && Presence().active()) Presence().updateDef(def);   // 방에 있으면 바뀐 모습을 상대에게도 전송
    // ★ 런처에서 들어왔으면 런처를 되살린다(openCreator 가 꺼 뒀다). 실행 중 수정이면 applyDesktopRunClass 가 화면을 되돌린다.
    if(creatorMode().cameFromLauncher){
      document.getElementById('launcher').classList.add('on'); renderLauncher();
      const wp=document.getElementById('wardrobePanel'); if(wp) wp.classList.remove('on');
      const wdp=document.getElementById('wdPreviewPanel'); if(wdp) wdp.classList.remove('on');
    }
    applyDesktopRunClass();
    toast('수정했어요');return;}
  // ★ [＋]로 진입했으면 그때 확정된 칸을 그대로 쓴다. creatorMode.slot이 없을 때만 예전 폴백(추측)을 탄다.
  let target = creatorMode().edit ? creatorMode().slot
             : (creatorMode().slot!=null ? creatorMode().slot
             : (slots[curSlot()]?slots.findIndex(s=>!s):curSlot()));
  // ⚠️ 상한은 CHAR_SLOT_MAX — 숫자를 박지 말 것(칸을 늘리면 뒤 칸에 만든 캐릭터가 사라진다).
  if(target<0||target>=CHAR_SLOT_MAX){toast('빈 슬롯이 없어요');return;}
  // ★ 최종 방어 — 신규 생성인데 그 칸에 이미 다른 캐릭터가 있으면 덮어쓰지 않고 중단한다(확인 창 아님).
  if(!creatorMode().edit && slots[target]){
    console.warn('[슬롯] 신규 생성 저장 중단 — 대상 칸에 이미 캐릭터가 있음', {target:target, creatorMode:creatorMode()});
    toast('그 칸에 이미 캐릭터가 있어요 — 런처에서 빈 칸을 골라 다시 시도해 주세요'); return;
  }
  /* 🧬 새 캐릭터면 보관함 문턱을 보고 cid 를 준다(켜져 있을 때만 · 수정은 saveSlots 훅이 잡는다). */
  if(!creatorMode().edit && charsMod()._charsBoxFull()) return;
  slots[target]=def;
  if(!creatorMode().edit){ try{ charsMod()._charsOnNew(target); }catch(_){} }
  setCurSlot(target);slotSaveMod().saveSlots();saveCurSlot();
  if(creatorMode().afterApp){const seat=createSeat();applyCharToSeat(seat,def);seat.slot=target;selectSeat(seat);renderSeatTabs();layoutSeats();
    setCreatorOpen(false);document.getElementById('creatorOverlay').classList.remove('on');clearStampState();toast('책상에 추가했어요');}
  else{creatorFlowMod.closeCreator();toast('슬롯에 저장했어요');}});

return {
  DEF_SIZE_TOAST_MS,
  _creatorBuildDef,
  _creatorSizeGrow,
  _defSizeFile,
};
}

const api = { createCreatorSave };
if(typeof window !== 'undefined') window.TwCreatorSave = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
