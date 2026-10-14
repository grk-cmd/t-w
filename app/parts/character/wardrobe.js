/* wardrobe.js — 🎨 꾸미기 창 — 미리보기 · 초안 · 상세조정 · 색 줄 · 창 그리기 · 파츠 착용
   app.js 꾸미기 다섯 구역(👀 미리보기 · 📝 초안 · 🎛️ 상세조정 · 🎨 색 줄 · 🎨 창 그리기 · 파츠 착용) 본문을 그대로 옮긴 모듈이다(앱 FSD 29번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 다른 모듈이 아직 전역으로 부르는 이름은 app.js 에 «옛 전역 이름» 한 줄씩 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 5개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 70줄 —
     LIGHT_PRESET · PART_CATS · PART_DEFAULT_OFFSET · PART_GROUPS · Presence · WD_DESK_TAB · adminPartReg · gachaMod · isAdmin · partPaintMod · savedParts · slots · wdEar 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 51개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: ORBIT_DRAG_DIR · _clearMultiPanelRef · _wdAfterMainSwap · activeWdAdj · buildFreeColorPicker · clampWdPreviewIntoView · commitWdDraft · createWardrobeAdjPanel · currentWdTab · detachWdGizmo · ensureWdDraft · ensureWdGizmo · placeWdPreview · refreshWdPreviewChar · refreshWdPreviewColorSection · renderWardrobe · setWdGizmoMode · sizeWdPreview · syncWdGizmoToXf · syncWdPreviewOwner · toggleEquip · updateWdCam · updateWdGizmoForActivePanel · wdCam · wdDraftDef · wdGizmo · wdGizmoMode · wdPreviewBase · wdPreviewSavedPos · wdScene — app.js 는 wardrobeMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwWardrobe — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-wardrobe.js */
(function(){

function createWardrobe(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const CHAR_Z = deps.CHAR_Z;
const LIGHT_PRESET = deps.LIGHT_PRESET;   // 읽는 함수
const PART_CATS = deps.PART_CATS;   // 읽는 함수
const PART_DEFAULT_OFFSET = deps.PART_DEFAULT_OFFSET;   // 읽는 함수
const PART_GROUPS = deps.PART_GROUPS;   // 읽는 함수
const Presence = deps.Presence;   // 읽는 함수
const WD_DESK_TAB = deps.WD_DESK_TAB;   // 읽는 함수
const _FILL_LIGHT_MUL = deps._FILL_LIGHT_MUL;
const _KEY_LIGHT_MUL = deps._KEY_LIGHT_MUL;
const _MAIN_LIGHT_COL = deps._MAIN_LIGHT_COL;
const _MAIN_LIGHT_INT = deps._MAIN_LIGHT_INT;
const _attachHumanEars = deps._attachHumanEars;
const _disposeWrapperFromSeat = deps._disposeWrapperFromSeat;
const _hsvToHex = deps._hsvToHex;
const _invalidatePendingEquip = deps._invalidatePendingEquip;
const _mkFrontFill = deps._mkFrontFill;
const _rgbHexToHsv = deps._rgbHexToHsv;
const _sweepOrphanPartWrappers = deps._sweepOrphanPartWrappers;
const _wdLicenseDesks = deps._wdLicenseDesks;
const addEntryToCat = deps.addEntryToCat;
const addPartEntryInstance = deps.addPartEntryInstance;
const adminPartReg = deps.adminPartReg;   // 읽는 함수
const applyClothVisibility = deps.applyClothVisibility;
const applyEquippedPartsToSeat = deps.applyEquippedPartsToSeat;
const applyHueTint = deps.applyHueTint;
const applyPartXf = deps.applyPartXf;
const bindReorderHandle = deps.bindReorderHandle;
const boneSide = deps.boneSide;
const charFootFix = deps.charFootFix;
const clampCharY = deps.clampCharY;
const defToBase = deps.defToBase;
const defaultPartXf = deps.defaultPartXf;
const entriesForCat = deps.entriesForCat;
const equipPartOnSeat = deps.equipPartOnSeat;
const escHtml = deps.escHtml;
const findEntryById = deps.findEntryById;
const findMySeat = deps.findMySeat;
const firstEntryForCat = deps.firstEntryForCat;
const fitModel = deps.fitModel;
const floorClampWrapper = deps.floorClampWrapper;
const gachaMod = deps.gachaMod;   // 읽는 함수
const getCommissionScene = deps.getCommissionScene;
const groupOfCat = deps.groupOfCat;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isDeskPartCat = deps.isDeskPartCat;
const isHueTintMesh = deps.isHueTintMesh;
const measureCharBox = deps.measureCharBox;
const openAssetImport = deps.openAssetImport;
const partCatInfo = deps.partCatInfo;
const partEntryId = deps.partEntryId;
const partEntryInstanceCount = deps.partEntryInstanceCount;
const partEntryInstances = deps.partEntryInstances;
const partEntryXf = deps.partEntryXf;
const partPaintMod = deps.partPaintMod;   // 읽는 함수
const partsInCat = deps.partsInCat;
const partsInCatFor = deps.partsInCatFor;
const partsInGroup = deps.partsInGroup;
const pruneSeatPartsAgainstDef = deps.pruneSeatPartsAgainstDef;
const removeEntryFromCat = deps.removeEntryFromCat;
const removePartEntryInstance = deps.removePartEntryInstance;
const renderWdDeskSection = deps.renderWdDeskSection;
const reorderSavedPart = deps.reorderSavedPart;
const saveSlots = deps.saveSlots;
const savedParts = deps.savedParts;   // 읽는 함수
const seats = deps.seats;
const setPartEntryInstanceXf = deps.setPartEntryInstanceXf;
const slots = deps.slots;   // 읽는 함수
const toast = deps.toast;
const unequipStackablePart = deps.unequipStackablePart;
const wdEar = deps.wdEar;   // 읽는 함수
/* 🎨 꾸미기 미리보기 — 꾸미기 패널 옆에 뜨는 정적 3D 미리보기.
   ★ 실제 실행 화면처럼 타이핑/졸음 등 절차적 애니메이션까지는 재현하지 않고(모델이 그대로 서 있는 정적
   미리보기), 몸통+꾸미기 파츠가 어떻게 보이는지만 확인하는 용도 — defToBase/applyEquippedPartsToSeat
   같은 기존 함수를 그대로 재사용해서 새로 만드는 코드를 최소화함. */
let wdRenderer=null, wdScene=null, wdCam=null, wdPreviewBase=null;
/* 🪑 꾸미기 미리보기에서 '책상 위' 파츠가 설 자리를 만들기 위한 값들(아래 _wdDesk 참고).
   ★ buildDesk 가 책상 그룹 안에 deskAnchor 를 놓는 좌표와 **같은 숫자**여야 한다.
     여기만 따로 정하면 미리보기와 실행 화면이 조용히 어긋난다. */
const WD_PREVIEW_DESK_Y = 0.46, WD_PREVIEW_DESK_Z = 0.50;
/* 미세 조정용 — 미리보기 카메라 화각 밖으로 나가서 안 보이면 여기서 밀어 준다.
   ⚠️ 0 이 아니면 그만큼 실제 위치와 어긋난다. 기본은 0(= 실제와 동일). */
const WD_PREVIEW_DESK_NUDGE = {x:0, y:0, z:0};
function ensureWdPreview(){
  if(wdRenderer) return;
  const canvas=document.getElementById('wdPreviewCanvas'); if(!canvas) return;
  wdRenderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  wdRenderer.setPixelRatio(Math.min(devicePixelRatio,2));
  wdRenderer.outputEncoding=THREE.sRGBEncoding;
  wdScene=new THREE.Scene();
  wdCam=new THREE.PerspectiveCamera(32,1,0.1,100);
  // ★ 조명 색/세기는 실행 화면과 동일하게 유지하되, 주광 위치만 "정수리 바로 위"(0,5,0)에서 살짝
  //   비스듬한 각도로 옮김 — 좁은 미리보기 화면에서 정수리 바로 위 조명은 명암 대비가 거의 없어서
  //   입체감 없이 납작해 보이는 원인이었음(실행 화면은 화면이 넓고 카메라 각도가 달라 덜 티가 났음).
  //   그림자는 요청에 따라 사용하지 않음(그림자 없이 조명 각도만으로 입체감 보완).
  // ★ 조명 세기 보정 이력: 0.75(너무 어두움) → 0.95(실행값 그대로인데 그림자·카메라 차이로 오히려 밝아 보임)
  //   → 0.85(중간값)로 실측 보정. 실행 화면과 체감 밝기가 최대한 비슷하게 맞춘 값.
  wdScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));
  // ★ 조명 위치를 실행 화면과 동일하게 (0,5,0) 정수리 위로 — 얼굴 텍스처 조명 방향 통일(요청사항)
  const wdKey=new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL);
  wdKey.position.set(0, 5, 0); wdScene.add(wdKey);
  const wdFill=new THREE.DirectionalLight(0xbcd0ff,0.12); wdFill.position.set(-3,2,-1); wdScene.add(wdFill);
  wdScene.add(_mkFrontFill(_MAIN_LIGHT_INT * _FILL_LIGHT_MUL));   // ★ 실행 화면과 같은 정면 필
}

// ★ 꾸미기 미리보기 기즈모 — 상세조정 패널이 열려있는 파츠에 이동/회전/크기 핸들을 띄워서
//   버튼 클릭 대신 직접 드래그로 조정할 수 있게 함. THREE.TransformControls 필요(vendor 파일 추가 필요).
let wdGizmo=null, wdGizmoMode='translate', wdGizmoCat=null;
function ensureWdGizmo(){
  if(wdGizmo || !wdRenderer || !wdCam || !wdScene) return;
  if(typeof THREE.TransformControls !== 'function'){
    console.warn('TransformControls가 로드되지 않았어요 — vendor/three/TransformControls.js 파일이 필요합니다.');
    return;
  }
  wdGizmo = new THREE.TransformControls(wdCam, wdRenderer.domElement);
  wdGizmo.setSize(3.2);   // 런처1-1: 기즈모 두 배(1.6 → 3.2)
  wdGizmo.addEventListener('objectChange', ()=>{ if(wdEar().isActive()) wdEar().onGizmoChange(); else syncWdGizmoToXf(); });
  // 드래그가 끝나는 순간에만(매 프레임이 아니라) 상세조정 패널의 숫자 표시를 다시 그림 — 무거운 재렌더를 드래그 중엔 피함
  wdGizmo.addEventListener('dragging-changed', e=>{ if(!e.value) renderWardrobe(); });
  wdScene.add(wdGizmo);
}
let wdGizmoInstanceIdx = 0;   // 런처9: 다중 파츠일 때 지금 조정 중인 인스턴스 (0 = main / 1+ = extra)
let wdGizmoPartId = null;     // 🔗 stackable 파츠 id — stackable은 equippedPartObjs가 아니라 stackedPartObjs[cat][id]에 저장되므로 id로 찾아야 함
function _wdGetActiveWrapperAndXf(){
  if(!wdGizmoCat || !wdPreviewBase || !wdPreviewBase.charDef) return null;
  const def = wdPreviewBase.charDef;
  // 지금 조정 중인 파츠의 entry를 id로 정확히 짚음 — firstEntry만 보면 두 번째 이후
  // 🔗 stackable 파츠를 조정할 때 엉뚱한 파츠(첫 원소)에 저장돼 버린다.
  const entry = (wdGizmoPartId && findEntryById(def, wdGizmoCat, wdGizmoPartId))
             || firstEntryForCat(def, wdGizmoCat);
  if(!entry) return null;
  // 🔗 stackable은 equippedPartObjs가 아니라 stackedPartObjs[cat][id]에 wrapper가 있다.
  // ★ 예전엔 여기서 곧바로 return해 버려서 stackable 파츠는 다중 파츠 인스턴스를 전혀 잡지 못했다
  //   (관리자 모드에서 다중을 켜도 ＋로 늘린 파츠가 선택도, 이동도 안 되던 원인).
  //   이제 stackable과 일반 파츠를 같은 경로로 처리한다.
  const stacked = wdGizmoPartId && wdPreviewBase.stackedPartObjs
    && wdPreviewBase.stackedPartObjs[wdGizmoCat] && wdPreviewBase.stackedPartObjs[wdGizmoCat][wdGizmoPartId];
  const main = stacked || (wdPreviewBase.equippedPartObjs && wdPreviewBase.equippedPartObjs[wdGizmoCat]);
  if(!main) return null;
  const instances = partEntryInstances(entry);   // Firebase 숫자키 맵도 배열로 정규화해서 읽음
  const extras = (main.userData && main.userData.multiExtras) || [];
  let idx = wdGizmoInstanceIdx || 0;
  // extra wrapper가 없으면(단일 파츠거나 아직 로딩 중) 0번으로 되돌린다 —
  // 다른 파츠에서 넘어온 인덱스가 남아 엉뚱한 인스턴스에 값이 새는 걸 막는 안전장치.
  if(idx > 0 && !extras[idx-1]) idx = 0;
  wdGizmoInstanceIdx = idx;
  const wrapper = idx > 0 ? extras[idx-1] : main;
  const xf = instances[idx] || defaultPartXf();
  return { wrapper, xf, entry, idx };
}
function syncWdGizmoToXf(){
  const st = _wdGetActiveWrapperAndXf(); if(!st) return;
  const {wrapper, xf, entry, idx} = st;
  if(!wrapper.userData || !wrapper.userData.baseCenter) return;
  /* 🦶 "책상 위" 카테고리는 바닥 아래로 못 내려가게 여기서 막는다 — 아래로 끌면 그 자리에서 멈춘다.
     [왜 여기인가] applyPartXf 의 바닥 맞춤은 '적용 직후' 에만 걸리므로, 드래그 중에는 화면은 바닥에
       멈춰 있는데 아래 xf.pos 계산은 마우스가 간 곳을 그대로 적는다. 그러면 보이는 자리와 저장값이
       갈라지고, 다음에 열 때 그 저장값이 되살아나 파츠가 갑자기 가라앉는다.
       읽기 **전에** wrapper 를 끌어올려 두면 아래 계산이 자동으로 클램프된 값을 적는다.
     ★ 이동만이 아니라 회전·크기 모드에도 걸린다(돌리거나 키워서 바닥을 뚫는 경우) — 이 함수가
       세 모드 모두의 objectChange 에서 불린다.
     ★ 캐릭터에 붙는 파츠(머리·옷·장식)는 대상이 아니다. 바닥을 뚫어도 되는 것들이고,
       무엇보다 캐릭터를 움직이면 같이 따라다녀서 '바닥' 이 기준이 될 수 없다. */
  try{
    const _gi = partCatInfo(wdGizmoCat);
    if(_gi && isDeskPartCat(_gi)) floorClampWrapper(wrapper, wdGizmoCat, true);
  }catch(_){}
  const c = wrapper.userData.baseCenter;
  const dOff = PART_DEFAULT_OFFSET()[wdGizmoCat] || {x:0,y:0,z:0};
  /* 🐾 _applyXfToWrapper가 동물 머리 보정(animalHeadDy)만큼 wrapper를 이미 내려놨으므로,
     역함수인 여기서도 반드시 되빼야 한다. 이게 빠지면 저장값이 매번 dy씩 부풀어서,
     조정한 뒤 다시 적용될 때마다 파츠가 dy씩 밀린다(= "위치를 고쳐도 안 먹는" 증상).
     authorOff를 되더하는 아래 처리와 정확히 같은 이유·같은 짝이다. */
  const _ahdy = (+wrapper.userData.animalHeadDy || 0);
  if(wrapper.userData.rigged){
    const bc = wrapper.userData.baseCenter || new THREE.Vector3();
    xf.pos = [ wrapper.position.x-bc.x, wrapper.position.y-bc.y-_ahdy, wrapper.position.z-bc.z ];
  } else {
    // 🎩 _applyXfToWrapper가 저작 오프셋(authorOff)만큼 wrapper를 이미 당겨뒀으므로, 여기서 되더해야
    //    정확한 역함수가 된다. 안 더하면 기즈모를 만질 때마다 저장값이 -authorOff씩 밀린다.
    //    이 덕분에 옛 손보정 값을 갖고 있던 유저도 기즈모를 한 번 만지면 깨끗한 값으로 자연 이관된다.
    const ao = wrapper.userData.authorOff || null;
    const ax = ao?ao.x:0, ay = ao?ao.y:0, az = ao?ao.z:0;
    xf.pos = [ wrapper.position.x-c.x-dOff.x+ax, wrapper.position.y-c.y-dOff.y+ay-_ahdy, wrapper.position.z-c.z-dOff.z+az ];
    /* ★ 여기서 쓴 값은 ao 를 이미 되더한 '깨끗한' 값이다 — 옛 손보정 판정을 내려둔다.
       안 내리면 다음 apply 가 legacy 로 보고 +ao 를 또 더해, 만질 때마다 ao 씩 밀린다. */
    wrapper.userData._aoLegacy = false;
  }
  xf.rot = [ wrapper.rotation.x, wrapper.rotation.y, wrapper.rotation.z ];
  xf.scale = wrapper.scale.x;
  // 인스턴스에 맞게 저장 — 어떤 인스턴스를 잡고 있는지는 _wdGetActiveWrapperAndXf가 이미 확정했다.
  //   (예전엔 여기서 wdGizmoPartId 유무로 다시 판단했는데, 호출부가 항상 partId를 넘기는 탓에
  //    늘 0번으로 저장돼 "2번 인스턴스를 드래그해도 안 움직이는" 증상이 됐다.)
  setPartEntryInstanceXf(entry, idx, xf);
  if(wrapper.userData.rigged) applyPartXf(wdPreviewBase, wdGizmoCat);
}
function attachWdGizmo(cat, instanceIdx, partId){
  ensureWdGizmo(); if(!wdGizmo) return;
  wdGizmoCat = cat;
  wdGizmoInstanceIdx = instanceIdx || 0;
  wdGizmoPartId = partId || null;
  // 🔗 stackable / 다중 파츠 / 일반 파츠를 모두 같은 해석기로 처리 — 여기서 wrapper를 직접 뒤지지 않는다.
  const st = _wdGetActiveWrapperAndXf();
  if(st && st.wrapper){ wdGizmo.attach(st.wrapper); setWdGizmoMode(wdGizmoMode); }
  // ★ 파츠 GLB는 비동기로 붙는다. wrapper가 아직 없다고 detachWdGizmo()를 부르면 wdGizmoCat이 null이 돼서
  //   ＋/－ 크기 버튼이 "먼저 파츠 카드를 우클릭해 주세요" 토스트만 띄우고 죽어버렸다.
  //   핸들만 떼고 선택 상태(cat/partId)는 유지 — 부착이 끝나면 updateWdGizmoForActivePanel이 다시 붙인다.
  else wdGizmo.detach();
}
function detachWdGizmo(){
  if(wdGizmo) wdGizmo.detach();
  wdGizmoCat = null;
  wdGizmoPartId = null;
}
// ★ 모드를 바꿀 때 축별(X/Y/Z) 핸들 표시 여부도 같이 조절 — 이 앱은 파츠 크기를 "숫자 하나"(균일 배율)로만
//   저장하는데, TransformControls의 "크기" 모드는 기본적으로 X/Y/Z 축을 따로 늘릴 수 있는 핸들도 같이
//   나와서, 축별로 다르게 늘리면 저장 시 값이 이상해짐(x값만 취해서 나머지가 버려짐). 그래서 크기
//   모드일 때는 축별 핸들을 숨기고 가운데 "균일 크기" 핸들만 남김. 이동/회전은 기존처럼 축별로 다 보여줌.
function setWdGizmoMode(mode){
  wdGizmoMode = mode;
  if(!wdGizmo) return;
  wdGizmo.setMode(mode);
  const isScale = mode==='scale';
  wdGizmo.showX = !isScale; wdGizmo.showY = !isScale; wdGizmo.showZ = !isScale;
}
// 상세조정 패널이 열려있는지 확인해서 기즈모 바를 보이거나 숨기고, 해당 카테고리에 자동으로 부착
function updateWdGizmoForActivePanel(){
  const bar=document.getElementById('wdGizmoBar');
  /* 🐾 귀 탭은 파츠가 아니라 귀에 핸들을 붙인다(wd-ear.js) — 조정할 귀 줄도 거기서 그린다 */
  if(wdEar().isActive()){ wdGizmoCat=null; wdGizmoPartId=null; wdEar().syncGizmo(); try{ partPaintMod().refreshWdPicUI(); }catch(_){} updateWdCam(); sizeWdPreview(); return; }
  if(wdEar().hideRow()){ updateWdCam(); sizeWdPreview(); }   // 귀 탭에서 막 나왔다 — 구도·캔버스 크기 되돌림
  if(activeWdAdj && activeWdAdj.cat){
    if(bar) bar.style.display='flex';
    // 런처9: 다중 파츠의 활성 인스턴스도 복원 (renderWardrobe로 패널 재생성돼도 유지)
    const idx = _wdGetSavedInstanceIdx(activeWdAdj.id);
    attachWdGizmo(activeWdAdj.cat, idx, activeWdAdj.id);
  } else {
    if(bar) bar.style.display='none';
    detachWdGizmo();
  }
  // 🖍️ 연필 버튼은 상세조정과 무관하게 "그림칸이 있는가"로만 뜬다 — 마지막에 한 번 맞춘다.
  try{ partPaintMod().refreshWdPicUI(); }catch(_){}
}
(function bindWdGizmoBar(){
  const bar=document.getElementById('wdGizmoBar'); if(!bar) return;
  bar.querySelectorAll('.wd-gizmo-btn[data-mode]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      bar.querySelectorAll('.wd-gizmo-btn[data-mode]').forEach(b=>b.classList.toggle('on', b===btn));
      setWdGizmoMode(btn.dataset.mode);
    });
  });
  /* 🖍️ 연필 = 그리기 모드 토글. 켜는 순간 좌드래그의 임자가 바뀌므로(기즈모 → 붓)
     두 상태가 화면에 분명히 보여야 한다 — 눌린 버튼과 아래 그리기 줄이 그 표시다. */
  const pencil=document.getElementById('wdPencilBtn');
  if(pencil) pencil.addEventListener('click', ()=>{ partPaintMod()._wdPic.on ? partPaintMod().exitWdPicMode(true) : partPaintMod().enterWdPicMode(); });
  // 런처1(UI 개편): 크기 ＋/－ 와 ↺(크기·회전·위치 초기화)를 미리보기 툴바에서 직접 조작.
  //   활성 카테고리(wdGizmoCat)의 파츠 xf를 즉시 수정하고 applyPartXf로 미리보기에 실시간 반영.
  //   ★ 다중 파츠 지원: wdGizmoInstanceIdx를 반영해 활성 인스턴스의 xf를 반환.
  function _wdActiveXf(){
    if(!wdGizmoCat || !wdPreviewBase || !wdPreviewBase.charDef) return null;
    const def = wdPreviewBase.charDef;
    // ★ 버그 수정: 예전엔 def.equippedParts[cat]을 통째로 entry로 썼다. 🔗 stackable 파츠가 2개 이상이면
    //   그 값은 "배열(또는 Firebase 숫자키 맵)"이라 진짜 entry가 아니고, partEntryXf가 그 컨테이너에
    //   유령 xf를 붙여서 ＋/－ 버튼이 아무 파츠에도 반영되지 않았다(이동/회전은 _wdGetActiveWrapperAndXf를
    //   써서 정상 동작 → "크기만 안 먹힘"의 원인).
    //   기즈모와 동일하게 지금 조정 중인 파츠 id로 entry를 정확히 짚는다.
    const entry = (wdGizmoPartId && findEntryById(def, wdGizmoCat, wdGizmoPartId))
               || firstEntryForCat(def, wdGizmoCat);
    if(!entry || typeof entry!=='object') return null;
    // 🔗 stackable 파츠는 인스턴스(다중 파츠) 개념이 없음 — 항상 0번(entry.xf)
    const isStacked = !!(wdGizmoPartId && wdPreviewBase.stackedPartObjs
      && wdPreviewBase.stackedPartObjs[wdGizmoCat]
      && wdPreviewBase.stackedPartObjs[wdGizmoCat][wdGizmoPartId]);
    // 다중 파츠라면 wdGizmoInstanceIdx(0=main / 1+=extras[i-1])에 맞는 xf를 반환
    const instances = partEntryInstances(entry);
    const idx = isStacked ? 0 : (wdGizmoInstanceIdx || 0);
    let xf = instances[idx];
    if(!xf){ xf = defaultPartXf(); }
    // entry에 반영 유지 — mutate가 저장되도록 setter로 다시 붙임
    setPartEntryInstanceXf(entry, idx, xf);
    return xf;
  }
  function _wdApplyActive(){ if(wdGizmoCat && wdPreviewBase) applyPartXf(wdPreviewBase, wdGizmoCat); }
  const minus=document.getElementById('wdScaleMinus'), plus=document.getElementById('wdScalePlus');
  if(minus) _holdRepeat(minus, (isBig)=>{
    if(wdEar().isActive()){ wdEar().scaleStep(-1, isBig); return; }
    const xf=_wdActiveXf(); if(!xf){ toast('먼저 파츠 카드를 우클릭해서 조정할 파츠를 선택해 주세요'); return; }
    xf.scale = Math.max(0.3, +(xf.scale - (isBig?0.06:0.02)).toFixed(2)); _wdApplyActive();
  });
  if(plus) _holdRepeat(plus, (isBig)=>{
    if(wdEar().isActive()){ wdEar().scaleStep(1, isBig); return; }
    const xf=_wdActiveXf(); if(!xf){ toast('먼저 파츠 카드를 우클릭해서 조정할 파츠를 선택해 주세요'); return; }
    xf.scale = Math.min(2.5, +(xf.scale + (isBig?0.06:0.02)).toFixed(2)); _wdApplyActive();
  });
  // (초기화는 우클릭 조정 패널의 라디오+↺에서 항목별로 — 툴바 ↺는 요청에 따라 제거)
})();

/* 📐 미리보기 창 자리 — 공용 배치기.
   [왜 필요한가] 이 패널의 기본 자리는 CSS 의 `right:352px · width:320px` 로, **꾸미기 창이 오른쪽에
     붙어 있다**는 레이아웃을 전제로 한 값이다. 가챠 보관함처럼 정중앙에 뜨는 창과 같이 쓰면
     창 너비가 1704px 미만일 때 반드시 겹치고, z-index 로 순서만 정하면 어느 쪽이 위로 오든
     한쪽은 가려진다(제보: "왼쪽 미리보기만 안 보인다").
   ⚠️ 드래그 위치는 localStorage('tw.wdPreviewPos')에 저장되는데, 저장할 땐 그때의 창 크기로
     clamp 하고 **복원할 땐 안 했다.** 창이 작아지거나 해상도·배율이 바뀌면 그 좌표가 화면 밖이라
     패널이 통째로 안 보인다 — 재설치(=저장값 소멸)로만 고쳐지던 종류의 증상이다.
   ★ 크기를 재야 하므로 패널이 보이는 상태(.on)에서만 동작한다. */
const WD_PREVIEW_POS_KEY = 'tw.wdPreviewPos';
function wdPreviewSavedPos(){
  try{
    const s = JSON.parse(localStorage.getItem(WD_PREVIEW_POS_KEY) || 'null');
    return (s && typeof s.x === 'number' && typeof s.y === 'number') ? s : null;
  }catch(_){ return null; }
}
function placeWdPreview(x, y){
  const p = document.getElementById('wdPreviewPanel'); if(!p) return;
  const r = p.getBoundingClientRect();
  const w = r.width || 320, h = r.height || 420;
  p.style.left = Math.max(8, Math.min(innerWidth  - w - 8, x)) + 'px';
  p.style.top  = Math.max(8, Math.min(innerHeight - h - 8, y)) + 'px';
  p.style.right = 'auto'; p.style.transform = 'none';
}
function clampWdPreviewIntoView(){
  const p = document.getElementById('wdPreviewPanel');
  if(!p || !p.classList.contains('on')) return;      // 숨은 상태에서는 크기를 못 잰다
  const r = p.getBoundingClientRect(); if(!r.width) return;
  if(r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight) return;
  placeWdPreview(r.left, r.top);
}
/* 창 크기가 바뀌면 다시 끌어온다 — 저장값이 옛 화면 크기 기준일 수 있다. */
addEventListener('resize', ()=>{ try{ clampWdPreviewIntoView(); }catch(_){} });

/* 👀 미리보기 패널의 주인이 둘이다 — 꾸미기(#wardrobePanel)와 파츠보관함(#gachaInvOverlay).
   [제보] "파츠보관함 미리보기창이 안 보인다 · 창 위치 초기화를 눌러도 여전히 안 보인다"
   [경위] 두 창이 같은 패널 하나를 나눠 쓰는데, 각자 자기가 닫힐 때 **조건 없이** .on 을 뗐다.
     · 꾸미기가 열린 채로 보관함 안을 클릭하면 꾸미기의 '바깥 클릭 자동 닫기'가 발동한다
       (그 예외 목록에 보관함 오버레이가 빠져 있었다). 그러면 아직 보관함이 열려 있는데도
       미리보기가 사라진다.
     · 반대로 보관함을 닫으면 꾸미기가 열려 있어도 미리보기가 사라진다.
     반대 방향은 이미 막혀 있었다(_GACHA_KEEP 에 #wardrobePanel·#wdPreviewPanel 이 들어 있다) —
     한쪽만 상대를 알고 있던 비대칭이 원인이다.
   ⚠️ 위치 초기화가 안 듣는 이유가 여기 있다. .on 이 없으면 clampWdPreviewIntoView 는 크기를 잴 수
     없어 즉시 반환하고, resetAllWinPositions 가 지우는 것은 좌표뿐이다 — 애초에 위치 문제가 아니라
     '표시' 문제라서 좌표를 아무리 되돌려도 화면에는 변화가 없다.
   ★ 그래서 '누가 닫혔는가'가 아니라 **'지금 이 패널을 필요로 하는 창이 하나라도 있는가'**로 판정한다.
   ★ z-index 도 같은 자리에서 정한다 — 보관함(.gacha-ov 는 122)이 열려 있으면 그 위로 올리고,
     보관함이 닫히면 꾸미기 기준(CSS 54)으로 되돌린다. 되돌리지 않으면 꾸미기 창에서도 계속 122 위에 남는다. */
function syncWdPreviewOwner(){
  const wp = document.getElementById('wdPreviewPanel'); if(!wp) return;
  const wardrobeOn = !!document.querySelector('#wardrobePanel.on');
  const invOn = gachaMod().isInvOpen()
             || gachaMod().isDrawOpen();
  if(!wardrobeOn && !invOn){ wp.classList.remove('on'); wp.style.zIndex=''; return; }
  wp.classList.add('on');
  wp.style.zIndex = invOn ? '123' : '';
  try{ clampWdPreviewIntoView(); }catch(_){}
}

// ★ 요청사항: 미리보기 창을 드래그로 옮길 수 있게 — 타이틀바(👀 미리보기)를 잡고 끌면 이동되고,
//   옮긴 위치는 localStorage에 저장해서 다음에 창을 열어도 그 자리에 그대로 뜸.
(function bindWdPreviewDrag(){
  const panel=document.getElementById('wdPreviewPanel'); if(!panel) return;
  const handle=panel.querySelector('.wd-top'); if(!handle) return;
  handle.style.cursor='move';
  const POS_KEY=WD_PREVIEW_POS_KEY;
  try{
    const saved=wdPreviewSavedPos();
    if(saved){
      panel.style.left=saved.x+'px'; panel.style.top=saved.y+'px';
      panel.style.right='auto'; panel.style.transform='none';
      // 여기서는 아직 display:none 이라 크기를 못 잰다 — 실제 clamp 는 창을 열 때 한다.
    }
  }catch(e){}
  let dragging=false, startX=0, startY=0, startLeft=0, startTop=0;
  handle.addEventListener('pointerdown', e=>{
    if(e.target.closest('button')) return;   // 혹시 타이틀바에 버튼이 생기더라도 그건 드래그 시작 안 함
    dragging=true; handle.setPointerCapture(e.pointerId);
    const rect=panel.getBoundingClientRect();
    startX=e.clientX; startY=e.clientY; startLeft=rect.left; startTop=rect.top;
    panel.style.left=rect.left+'px'; panel.style.top=rect.top+'px';
    panel.style.right='auto'; panel.style.transform='none';
  });
  handle.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const rect=panel.getBoundingClientRect();
    let nx=startLeft+(e.clientX-startX), ny=startTop+(e.clientY-startY);
    nx=Math.max(0, Math.min(innerWidth-rect.width, nx));
    ny=Math.max(0, Math.min(innerHeight-rect.height, ny));
    panel.style.left=nx+'px'; panel.style.top=ny+'px';
  });
  const endDrag=()=>{
    if(!dragging) return; dragging=false;
    try{ localStorage.setItem(POS_KEY, JSON.stringify({x:parseFloat(panel.style.left), y:parseFloat(panel.style.top)})); }catch(e){}
  };
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
})();

function sizeWdPreview(){
  const c=document.getElementById('wdPreviewCanvas'); if(!c||!wdRenderer) return;
  const w=c.clientWidth||200, h=c.clientHeight||230;
  wdRenderer.setSize(w,h,false);
  wdCam.aspect=w/h; wdCam.updateProjectionMatrix();
}
// 사용자가 휠/방향키로 조절하는 카메라 상태 — 파츠가 바뀌어도 유지됨(매번 정면으로 리셋되지 않게)
let wdYaw=0, wdPitch=0, wdHeightOffset=0, wdZoomMul=1;
/* 🖱️ 좌우 앵글 이동 방향 — **꾸미기 미리보기와 생성기 미리보기가 공유한다.**
   두 화면 모두 카메라를 x=sin(yaw)에 두므로 yaw가 커지면 카메라가 캐릭터의 오른쪽(+x)으로 돈다.
   그건 화면에서 캐릭터가 왼쪽으로 도는 것처럼 보인다 — 즉 끄는 방향과 반대다.
   "오른쪽으로 끌면 오른쪽으로" = 손이 가는 쪽으로 앵글이 따라오게 -1을 준다.
   ⚠️ 이 부호는 두 화면에 걸쳐 일곱 곳(드래그 2 · ←→ 키 4 · ◀▶ 버튼 2)에서 쓰인다. 하나라도 빼먹으면
      같은 창에서 드래그와 방향키가 서로 반대로 돈다. 그래서 상수 하나로 묶었다 — 되돌리려면 이 값만 1로. */
const ORBIT_DRAG_DIR = -1;
let wdCamCenter=new THREE.Vector3(), wdCamLookY=0, wdCamBaseDist=1;
/* 🐾 귀 탭 — 기본 구도는 머리 꼭대기에서 잘려 귀가 화면 밖이다. 그 탭에서만 조금 올리고 물러선다.
   (사용자가 휠·방향키로 맞춘 값은 그대로 두고 그 위에 얹는다) */
const WD_EAR_CAM_LIFT = 0.12, WD_EAR_CAM_ZOOM = 1.18;
function _wdEarCamOn(){ try{ return wdEar().isActive(); }catch(_){ return false; } }
function updateWdCam(){
  if(!wdCam) return;
  const _ear = _wdEarCamOn();
  const dist = wdCamBaseDist * wdZoomMul * (_ear ? WD_EAR_CAM_ZOOM : 1);
  const _lift = _ear ? wdCamBaseDist * WD_EAR_CAM_LIFT : 0;
  // ★ 위/아래 방향키 — 예전엔 카메라 "각도"(하이앵글/로우앵글)를 바꿔서 일정 범위 이상 넘어가면
  //   더 이상 안 움직이는 것처럼 보였음. 요청대로 각도는 고정하고 카메라 자체의 "높이"만 위아래로
  //   옮기는 방식으로 변경 — 카메라와 보는 지점(lookAt)을 같이 옮겨서 각도는 그대로 유지됨.
  // ★ wdPitch — 생성기와 동일한 우클릭 드래그 오빗용 상하 앵글(방향키 상하=높이 이동과 별개).
  const cp = Math.cos(wdPitch);
  const x = wdCamCenter.x + dist*Math.sin(wdYaw)*cp;
  const z = wdCamCenter.z + dist*Math.cos(wdYaw)*cp;
  const y = wdCamLookY + wdHeightOffset + _lift + dist*Math.sin(wdPitch);
  wdCam.position.set(x, y, z);
  wdCam.lookAt(wdCamCenter.x, wdCamLookY + wdHeightOffset + _lift, wdCamCenter.z);
}

// ★ 꾸미기 임시본(draft) — 요청사항: 꾸미기 조정은 "미리보기"에서만 즉시 보이고, 실제 실행 중인
//   캐릭터(런처 메인)에는 미리보기의 "저장" 버튼을 눌러야만 반영됨. 그래서 toggleEquip/상세조정은
//   이제 mySeat.charDef를 직접 건드리지 않고, 이 draft(원본을 복제한 임시 def)만 건드림.
let wdDraftDef = null;
function ensureWdDraft(){
  const mySeat=findMySeat(); if(!mySeat||!mySeat.charDef) return null;
  if(!wdDraftDef || wdDraftDef._srcDef !== mySeat.charDef){
    const def = mySeat.charDef;
    // equippedParts/partXfMemory만 깊은 복제(이 둘만 편집 대상) — 나머지(피부/얼굴 등)는 원본 그대로 참조해도
    // 미리보기 렌더링에만 쓰이므로 문제 없음.
    wdDraftDef = Object.assign({}, def, {
      equippedParts: JSON.parse(JSON.stringify(def.equippedParts||{})),
      partXfMemory: JSON.parse(JSON.stringify(def.partXfMemory||{})),
    });
    wdDraftDef._srcDef = def;   // 원본 참조 — 캐릭터가 바뀌면(다른 슬롯 등) draft를 새로 만들기 위한 식별용
    wdEar().copyIntoDraft(wdDraftDef, def);   // 🐾 귀 조정값도 편집 대상이라 깊은 복사
  }
  return wdDraftDef;
}
async function refreshWdPreviewChar(){
  ensureWdPreview(); if(!wdRenderer) return;
  const mySeat=findMySeat(); if(!mySeat||!mySeat.charDef) return;
  const def=ensureWdDraft(); if(!def) return;
  if(wdPreviewBase){
    wdScene.remove(wdPreviewBase.group);
    // 🪑 미리보기용 책상 자리도 같이 치운다 — 안 치우면 미리보기를 열 때마다 빈 Group 이 쌓이고,
    //    거기 붙어 있던 '책상 위' 파츠가 화면에 남는다.
    if(wdPreviewBase.deskGroup) wdScene.remove(wdPreviewBase.deskGroup);
    wdPreviewBase=null;
  }
  let customScene=null;
  if(def.isCommission && def.commGlb){ try{ customScene=await getCommissionScene(def.commGlb); }catch(e){} }
  const base=defToBase(def, customScene);
  const g=base.group;
  g.scale.setScalar((def.xf&&def.xf.s)||1);
  /* 🦶 피봇 보정 — 생성기·실행과 **같은 규약**. y=0 에서 몸 박스를 재고 그 바닥을 원점에 맞춘다.
     한 곳만 빼면 미리보기 캐릭터만 0.048×배율 만큼 떠서 다시 어긋난다(charFootFix 주석의 넷 중 하나). */
  g.position.set(0, 0, 0);
  const _wdFoot = charFootFix(measureCharBox(g));
  g.position.set(0, clampCharY(def.xf&&def.xf.y) + _wdFoot, 0);   // 🧍 캐릭터 높이 — fitCreator·fitModel 과 같은 절대값 규약
  wdScene.add(g);
  // ★ 본(bone) 스캔 — 캐릭터 로드 시(setupSeatModel) 쓰는 것과 동일한 이름 매칭 방식으로,
  //   파츠 부착 함수(equipPartOnSeat 등)가 기대하는 seat.bones 구조를 최소한으로 맞춰줌.
  const bones={spine:null,head:null,handL:null,handR:null,legL:null,legR:null,ear:[]};
  base.root.traverse(o=>{ if(o.isBone){ const n=o.name.toLowerCase();
    if(!bones.spine&&(n.includes('spine')||n.includes('chest')||n.includes('torso')))bones.spine=o;
    if(!bones.head&&n.includes('head'))bones.head=o;
    if(n.includes('hand')||n.includes('arm')){const s=boneSide(n); if(s==='l'&&!bones.handL)bones.handL=o; if(s==='r'&&!bones.handR)bones.handR=o;}
    if(n.includes('leg')||n.includes('thigh')){const s=boneSide(n); if(s==='l'&&!bones.legL)bones.legL=o; if(s==='r'&&!bones.legR)bones.legR=o;}
    if(n.includes('ear'))bones.ear.push(o);
  }});
  const boneRest={}; for(const kk in bones){ boneRest[kk] = kk==='ear' ? bones.ear.map(o=>o.quaternion.clone()) : (bones[kk]&&bones[kk].quaternion.clone()); }
  /* 🪑 미리보기용 책상 자리 — 실제 좌석에서는 seat.deskAnchor(책상 위)가 그 역할이고,
     여기에는 책상이 없어서 파츠가 붙을 자리가 통째로 없다(붙이면 '부착할 자리 없음' 으로 사라진다).

     ★★ 빈 Group 하나로는 안 된다. 실제 deskAnchor 는 **책상 그룹의 자식**이라
        setDeskScale 이 건 배율(보통 0.175)을 통째로 물려받는다. 미리보기에 배율 1 짜리 Group 을
        두면 같은 GLB 가 약 5.7배로 뜬다 — 실제로 그 제보를 받았다
        ("미리보기에서는 엄청나게 큰데 실제 화면에서는 정상").
        그래서 **좌석과 같은 사슬을 그대로 재현한다**: 책상 그룹(배율) → 앵커(X 스트레치 상쇄).
        숫자를 여기서 새로 정하지 않고 setDeskScale·buildDesk 와 같은 식을 쓰는 것이 핵심이다.

     ★ 앞뒤도 좌석 기준으로 맞춘다. 좌석에서는 책상이 원점에, 캐릭터가 z=CHAR_Z 에 있는데
       미리보기는 캐릭터가 원점이므로 책상 쪽을 -CHAR_Z 만큼 밀어야 둘의 간격이 같아진다.
     🐾 동물 보정(animCorr)은 **건다**. 아래 _wdAnim 참고.
     ⛔ 폐기된 지침 — 예전 주석: "동물 보정은 안 건다. 생성기·런처 미리보기가 전부 '캐릭터 100% +
        책상 100%' 규약이라 여기만 줄이면 미리보기끼리 어긋난다."
        그 전제가 이 미리보기에는 성립하지 않는다. 생성기(cBase)는 캐릭터도 100% 로 세우지만,
        여기 캐릭터는 defToBase → buildAnimalBase 가 몸높이를 1.4×ANIMAL_RUN_SCALE(=0.56) 로
        이미 구워서 넘긴다 — 즉 **캐릭터는 40%, 책상만 100%** 인 상태였다.
        그래서 동물 캐릭터에서 '책상 위' 파츠가 2.5배 크게, 2.5배 멀리/높이 떠 보였다
        (제보: 보관함의 책상 카테고리 파츠만 실행 화면과 안 맞음). */
  const _wdDeskGrp = new THREE.Group();
  const _wdS  = (def.deskScale != null) ? def.deskScale : 1;
  const _wdLx = (def.deskLenX  != null) ? def.deskLenX  : 1;
  /* 🐾 setDeskScale 의 animCorr 과 **같은 값**. 여기서 새 상수를 만들지 말 것 —
     실행 화면은 applyCharToSeat 가 seat.desk.userData.animCorr 에 이 값을 심고
     setDeskScale 이 곱한다(= 동물 책상 40%). 미리보기에는 그 경로가 없어서 직접 곱한다. */
  const _wdAnim = (def && def.animal) ? ANIMAL_RUN_SCALE : 1;
  /* 📌 파츠 핀의 상쇄(syncDeskPartAnchor)는 좌석과 **같은 함수**를 쓴다. 그 함수는 배율을
     userData(animCorr·eqK)에서 읽으므로, 여기서만 `_wdAnim` 을 지역변수로 곱하면 핀은 배율 1 로
     상쇄해서 동물 미리보기에서만 '책상 위' 파츠가 책상을 따라 움직인다(deskPos 를 옮겨둔 경우).
     그래서 같은 값을 userData 에도 심어 둔다 — 미리보기에 eqK 는 없다(내 캐릭터 하나만 그린다). */
  _wdDeskGrp.userData.animCorr = _wdAnim;
  /* 📐 파츠 핀의 **크기 상쇄**가 읽는 값 — 좌석에서는 setDeskScale 이 심어 준다.
     이 미리보기는 그 함수를 안 타므로 여기서 직접 심는다. 없으면 핀이 ratio=1 로 떨어져
     이 화면에서만 '책상 위' 파츠가 책상 크기 슬라이더를 따라간다(= 고치려던 그 증상). */
  _wdDeskGrp.userData.deskScaleBase = _wdS;
  _wdDeskGrp.scale.set(_wdS * _wdLx * _wdAnim, _wdS * _wdAnim, _wdS * _wdAnim);   // setDeskScale 과 같은 식
  /* ★ 캐릭터의 앞뒤·좌우 이동값(xf.z · xf.x)까지 셈에 넣어야 한다.
     [경위] 실행 화면에서는 캐릭터가 CHAR_Z 에 **더해** xf.z 만큼 더 움직인다(fitModel 의
       m.position.z += userZ). 그런데 이 미리보기는 캐릭터를 늘 z=0 에 세운다 — xf.z 를 안 쓴다.
       그러면 캐릭터와 책상 사이 간격이 딱 xf.z 만큼 어긋나고, 미리보기에서 맞춘 자리가
       실행 화면에서는 그만큼 밀려 보인다(제보: "실행 화면에서 아이템이 더 뒤에 있다").
       캐릭터를 움직일 수는 없으니(다른 파츠 위치가 전부 따라 흔들린다) 책상 쪽을 반대로 옮긴다.
     🐾 CHAR_Z 에도, xf.z · xf.x 에도 동물 보정을 곱한다 — 실행 화면의 **간격**에 그 배율이 걸려 있다:
          seat.rig.position.z = seatCharZ(seat) = CHAR_Z          ← 배율을 안 곱한다(아래 ⚠️)
          seat.desk.position.z = deskPos.z·a·k + CHAR_Z·(1 − a·k) ← 배율의 몫을 책상이 진다
          → 간격 = a·k × (deskPos.z − CHAR_Z).  k=1 인 이 미리보기에서는 곱할 배율이 a 하나다.
          m.position.z += (userZ × _animPos) / _uz   ← _animPos = ANIMAL_RUN_SCALE
     ⚠️ **`seatCharZ` 는 CHAR_Z 를 그대로 돌려준다.** 예전 이 주석은 "= CHAR_Z × ANIMAL_RUN_SCALE"
       이라고 적어 뒀는데, 그 곱셈은 `syncSeatDeskZ` 의 보정항으로 옮겨진 뒤였다(seatCharZ 주석의
       '두 번의 뒤집기' 참고). 결과식은 우연히 같지만 근거가 낡아서, 이 줄을 믿고 계산하면
       틀린 결론에 간다 — 그래서 고쳤다.
        ⛔ 폐기된 지침 — 예전 주석: "xf.z/xf.x 는 fitModel 이 bodyWrap 스케일을 미리 나눠 상쇄해
           두므로 절대값 그대로 들어간다." /_uz(userScale 상쇄)만 보고 **바로 옆에 붙은 ×_animPos 를
           놓친 것**이다. 그래서 동물에서만 책상↔캐릭터 간격이 (1 − 0.4) × xf.z = 0.6 × xf.z 만큼
           어긋났다 — 제보: "보관함 미리보기보다 실행 화면에서 욕조가 앞에 나와 있다".
           인간은 _animPos = 1 이라 이 항이 0 이므로 원래 증상이 없었다. */
  const _wdXfZ = ((def.xf && def.xf.z) || 0) * _wdAnim;
  const _wdXfX = ((def.xf && def.xf.x) || 0) * _wdAnim;
  _wdDeskGrp.position.set(
    -_wdXfX + WD_PREVIEW_DESK_NUDGE.x,
    WD_PREVIEW_DESK_NUDGE.y,
    -CHAR_Z * _wdAnim - _wdXfZ + WD_PREVIEW_DESK_NUDGE.z);
  /* 🐾 deskPos 에도 동물 보정을 곱한다 — 실행 화면의 setDeskPos 가 `animCorr × eqK` 를 곱하고
       여기 k 는 1 이므로 `_wdAnim` 하나가 그 짝이다.
     [경위] 예전엔 여기서도, 실행에서도 deskPos 를 **원본 단위 그대로** 더했다. 두 화면이 똑같이
       틀려서 서로는 일치했고(앞 핸드오프가 "두 식이 일치한다"고 판정한 게 이 상태다),
       어긋나는 상대는 **생성기**였다 — 기즈모로 옮긴 양이 두 화면에서 2.5배로 들어갔다.
     ⚠️ deskPosBase 에는 곱하지 않는다 — 그건 파츠 핀이 상쇄에 쓰는 100% 단위 원본이고,
       핀 쪽 나눗셈(syncDeskPartAnchor)이 자기 배율을 따로 곱한다. 여기서 미리 곱하면 두 번 걸린다. */
  if(def.deskPos){ _wdDeskGrp.position.x += (+def.deskPos.x||0) * _wdAnim;
                   _wdDeskGrp.position.y += (+def.deskPos.y||0) * _wdAnim;
                   _wdDeskGrp.position.z += (+def.deskPos.z||0) * _wdAnim;
    /* 📌 여기는 setDeskPos 를 안 타고 position 에 직접 더한다(위 좌표에는 deskPos 말고도
       CHAR_Z·xf 보정이 섞여 있어서 position 전체를 상쇄하면 안 된다). 그래서 '상쇄해야 할
       몫'만 따로 적어 둔다 — 파츠 핀은 오직 이 값만 본다. */
    _wdDeskGrp.userData.deskPosBase = { x:+def.deskPos.x||0, y:+def.deskPos.y||0, z:+def.deskPos.z||0 }; }
  const _wdDesk = new THREE.Group();
  _wdDesk.name = 'deskAnchor';
  _wdDesk.position.set(0, WD_PREVIEW_DESK_Y, WD_PREVIEW_DESK_Z);   // buildDesk 와 같은 좌표
  _wdDesk.scale.set(1/_wdLx, 1, 1);                                 // setDeskScale 과 같은 상쇄
  _wdDeskGrp.add(_wdDesk);
  wdScene.add(_wdDeskGrp);
  wdPreviewBase = { group:g, root:base.root, bones, boneRest, equippedPartObjs:{}, charDef:def, isMe:false,
    deskAnchor:_wdDesk, deskGroup:_wdDeskGrp,
    // ★ defToBase가 이제 이 참조들을 같이 반환하므로 그대로 옮겨줌 — 이게 없으면 applyClothVisibility가
    //   아무 메쉬도 못 찾아서 상의/하의/한벌옷 등을 장착해도 커미션에 베이크된 원래 옷이 안 사라지던 원인.
    faceMesh:base.faceMesh, upMesh:base.upMesh, loMesh:base.loMesh, glassesMesh:base.glassesMesh,
    hatMesh:base.hatMesh, hatMat:base.hatMat, maskMesh:base.maskMesh, onepieceMesh:base.onepieceMesh, wingMesh:base.wingMesh,
    handLMesh:base.handLMesh, handRMesh:base.handRMesh, capeMesh:base.capeMesh };
  if(def.equippedParts) await applyEquippedPartsToSeat(wdPreviewBase, def);
  applyClothVisibility(wdPreviewBase);   // ★ 파츠 목록이 비어있어도(전부 해제) 기본 메쉬가 다시 보이도록 항상 한 번 더 반영
  // 런처1-2: 꾸미기창 재진입 시 파츠가 비동기로 나중에 붙는 동안 유저가 상세조정을 열면 기즈모가 null에 붙어서
  //   드래그해도 미리보기에 안 반영되던 문제 — 파츠 부착이 끝난 뒤 기즈모를 다시 붙임.
  updateWdGizmoForActivePanel();
  // ★ 예전엔 여기서 emissive를 일부러 줄여서 입체감을 살리려 했는데, 최종 색이 (지정한 색 × 조명) + emissive
  //   공식으로 합쳐지다 보니 emissive를 줄인 만큼 조명이 더해지는 비중이 커져서 지정한 헥스값과 실제
  //   화면 색이 달라 보이는 부작용이 있었음 — 색상 선택 화면에서는 "입체감"보다 "지정한 색 그대로 보이는 것"이
  //   더 중요하다는 피드백에 따라 이 조정은 제거함(장착 시 설정된 emissive를 그대로 둠).
  // 카메라 기준값만 다시 계산 — yaw/pitch/zoom(사용자가 조절한 값)은 그대로 유지
  const box=new THREE.Box3().setFromObject(g);
  const size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
  wdCamCenter.copy(center);
  wdCamLookY = center.y+size.y*0.12;
  wdCamBaseDist = Math.max(size.y,0.5)*1.5;
  sizeWdPreview();
  updateWdCam();
  refreshWdPreviewColorSection();
}
function wdPreviewLoop(){
  const p=document.getElementById('wdPreviewPanel');
  if(p && p.classList.contains('on') && wdRenderer) wdRenderer.render(wdScene, wdCam);
  requestAnimationFrame(wdPreviewLoop);
}
requestAnimationFrame(wdPreviewLoop);
// ★ 생성기 미리보기처럼 휠로 확대/축소, 방향키로 카메라 앵글 회전
(function bindWdPreviewControls(){
  const canvas=document.getElementById('wdPreviewCanvas'); if(!canvas) return;
  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    wdZoomMul = Math.max(0.4, Math.min(3, wdZoomMul + (e.deltaY>0?0.08:-0.08)));
    updateWdCam();
  }, {passive:false});
  // 🖱️ 생성기와 동일한 우클릭 드래그 오빗 — 드래그하면 앵글 회전(yaw+pitch), 움직임 없이 떼면 아무 일 없음.
  //   기즈모(TransformControls)는 좌클릭에만 반응하므로 충돌 없음.
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  let _wdRcOrbit=null;
  canvas.addEventListener('pointerdown', e=>{
    if(e.button===2){
      _wdRcOrbit={x:e.clientX, y:e.clientY, moved:false};
      try{ canvas.setPointerCapture(e.pointerId); }catch(_){}
    }
  });
  canvas.addEventListener('pointermove', e=>{
    if(!_wdRcOrbit) return;
    const dx=e.clientX-_wdRcOrbit.x, dy=e.clientY-_wdRcOrbit.y;
    if(_wdRcOrbit.moved || Math.abs(dx)+Math.abs(dy)>4){
      _wdRcOrbit.moved=true;
      wdYaw += ORBIT_DRAG_DIR * dx*0.012;   // 오른쪽 드래그 = 앵글도 오른쪽으로 (부호는 ORBIT_DRAG_DIR 한 곳에서 관리)
      wdPitch = Math.max(-0.6, Math.min(1.0, wdPitch + dy*0.008));
      updateWdCam();
      _wdRcOrbit.x=e.clientX; _wdRcOrbit.y=e.clientY;
    }
  });
  const _wdRcEnd=e=>{ if(_wdRcOrbit){ _wdRcOrbit=null; try{ canvas.releasePointerCapture(e.pointerId); }catch(_){} } };
  canvas.addEventListener('pointerup', _wdRcEnd);
  canvas.addEventListener('pointercancel', _wdRcEnd);
  // ★ 런처9: 다중 파츠 미리보기 클릭 → 활성 인스턴스 전환.
  //   조건: 지금 상세조정 패널이 다중 파츠에 열려 있고(window._wdCurrentMultiPanel 존재),
  //   클릭한 오브젝트가 그 카테고리 wrapper(main/extras) 중 하나면 그걸 활성으로 지정.
  const _wdRay = new THREE.Raycaster();
  const _wdPt = new THREE.Vector2();
  canvas.addEventListener('pointerdown', e=>{
    if(e.button!==0) return;   // 좌클릭만 — 우클릭은 위의 오빗 전용
    // 기즈모 조작 중이면 무시 (dragging 상태)
    if(wdGizmo && wdGizmo.dragging) return;
    /* 🐾 귀 탭 — 누른 귀를 조정 대상으로(시안: 미리보기에서 귀를 직접 눌러도 그쪽으로 바뀐다) */
    if(wdEar().isActive()){
      if(partPaintMod()._wdPic.on || !wdPreviewBase) return;
      const r = canvas.getBoundingClientRect();
      _wdPt.x = ((e.clientX-r.left)/r.width)*2 - 1;
      _wdPt.y = -((e.clientY-r.top)/r.height)*2 + 1;
      _wdRay.setFromCamera(_wdPt, wdCam);
      wdEar().pickAt(_wdRay);
      return;
    }
    const multi = window._wdCurrentMultiPanel;
    if(!multi || !wdPreviewBase) return;
    // 🔗 stackable 파츠는 equippedPartObjs에 없다 — 지금 우클릭해둔 파츠 id로 stackedPartObjs도 함께 본다.
    const _sid = (activeWdAdj && activeWdAdj.cat===multi.cat) ? activeWdAdj.id : null;
    const main = (_sid && wdPreviewBase.stackedPartObjs && wdPreviewBase.stackedPartObjs[multi.cat]
                  && wdPreviewBase.stackedPartObjs[multi.cat][_sid])
              || (wdPreviewBase.equippedPartObjs && wdPreviewBase.equippedPartObjs[multi.cat]);
    if(!main) return;
    const rect = canvas.getBoundingClientRect();
    _wdPt.x = ((e.clientX-rect.left)/rect.width)*2 - 1;
    _wdPt.y = -((e.clientY-rect.top)/rect.height)*2 + 1;
    _wdRay.setFromCamera(_wdPt, wdCam);
    // 이 카테고리의 모든 wrapper(main + extras)를 raycast 대상으로
    const wrappers = [main, ...(main.userData.multiExtras||[])];
    const hits = _wdRay.intersectObjects(wrappers, true);
    if(!hits.length) return;
    // 어떤 wrapper에 속하는지 찾기
    let hit = hits[0].object;
    while(hit){
      const idx = wrappers.indexOf(hit);
      if(idx>=0){ multi.setInstance(idx); return; }
      hit = hit.parent;
    }
  });
  document.addEventListener('keydown', e=>{
    const panel=document.getElementById('wdPreviewPanel');
    if(!panel || !panel.classList.contains('on')) return;
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea') return;
    if(e.key==='ArrowLeft'){ wdYaw -= ORBIT_DRAG_DIR * 0.12; updateWdCam(); e.preventDefault(); e.stopPropagation(); }
    else if(e.key==='ArrowRight'){ wdYaw += ORBIT_DRAG_DIR * 0.12; updateWdCam(); e.preventDefault(); e.stopPropagation(); }
    else if(e.key==='ArrowUp'){ wdHeightOffset = Math.min(2, wdHeightOffset+0.06); updateWdCam(); e.preventDefault(); e.stopPropagation(); }
    else if(e.key==='ArrowDown'){ wdHeightOffset = Math.max(-2, wdHeightOffset-0.06); updateWdCam(); e.preventDefault(); e.stopPropagation(); }
  }, true);   // ★ 캡처 단계에서 먼저 가로채서, 혹시 다른 곳에서 ArrowUp을 먼저 처리하고 멈춰버리는 걸 방지
})();
// ★ 요청사항: 저장 버튼을 없애고, 꾸미기 창을 닫을 때(바깥 클릭/X/Escape 전부) 자동으로 저장되게 함.
/* ★ 커밋 직렬화 — 보관함 닫힘(closeGachaInv)과 꾸미기 닫힘(close)이 연달아 부르면
   두 commitWdDraft 가 겹칠 수 있다(둘 다 await 없이 부른다). 같은 draft·같은 좌석을 만지므로
   겹치면 안 되고, 겹침을 막는 것이지 커밋을 건너뛰면 안 된다(닫힘 = 저장이다) —
   진행 중인 커밋을 들고 있다가 이어 붙인다. */
let _wdCommitChain = null;
async function commitWdDraft(silent){
  const prev = _wdCommitChain;
  const run = (async ()=>{
    if(prev){ try{ await prev; }catch(_){/* 앞 커밋 실패해도 내 차례는 온다 */} }
    return _commitWdDraftNow(silent);
  })();
  _wdCommitChain = run.catch(()=>{});
  return run;
}
async function _commitWdDraftNow(silent){
  /* 🖍️ 그리던 중에 창이 닫히면(바깥 클릭·X·Escape) 그림도 같이 확정한다.
     이 창은 "닫는 것이 곧 저장"이라 여기서 안 걷어 주면 방금 그린 것만 조용히 사라진다.
     ⚠️ 업로드를 기다린다 — 먼저 await 해야 아래 draft 저장에 URL 이 실린다. */
  if(partPaintMod()._wdPic.on){ try{ await partPaintMod().exitWdPicMode(true); }catch(_){} }
  const mySeat=findMySeat(); if(!mySeat||!mySeat.charDef) return false;
  const draft=wdDraftDef; if(!draft) return false;   // 편집한 적 없으면(초안 자체가 없으면) 저장할 것도 없음
  /* 🔀 초안의 주인이 지금 주 캐릭터가 아니면(꾸미기를 연 채 캐릭터 교체 · 자리 교체) 원래 주인에게 저장한다.
     [왜] 캐릭터 슬롯 버튼이 있는 #focusSettingsPanel 은 꾸미기 창의 «바깥 클릭» 예외라, 창을 연 채 교체할 수 있다.
       예전엔 무조건 지금 주 캐릭터(def=mySeat.charDef)에 썼기 때문에 A 를 꾸미던 초안이 B 를 통째로 덮었다. */
  if(draft._srcDef && draft._srcDef !== mySeat.charDef) return _commitWdDraftToOwner(draft, silent);
  const def=mySeat.charDef;
  def.equippedParts = JSON.parse(JSON.stringify(draft.equippedParts||{}));
  def.partXfMemory = JSON.parse(JSON.stringify(draft.partXfMemory||{}));
  /* 🐾 귀는 파츠 배관 밖이라 따로 옮기고, 바뀌었으면 좌석 귀를 다시 붙인다 */
  try{ if(wdEar().commit(def, draft)) _attachHumanEars(mySeat.modelRoot, def); }catch(e){ console.warn('[사람 귀] 저장', e); }
  /* 💾 저장이 먼저다 — 아래 파츠 GLB 받기는 몇 초 걸려서, 그 사이 앱이 꺼지면 꾸민 것이 통째로 사라졌다 */
  saveSlots();
  // 실제 캐릭터에서 "뺀 파츠"를 먼저 걷어냄 — 🔗 stackable은 id 단위까지 대조 (안 하면 예전 파츠가 유령으로 남음)
  pruneSeatPartsAgainstDef(mySeat, def);
  await applyEquippedPartsToSeat(mySeat, def);   // 남아있는/새로 생긴 파츠는 적용(같은 카테고리 교체도 내부에서 처리됨)
  /* 🦶 파츠가 바뀌면 발밑 깊이도 바뀐다 — 여기서 다시 맞춘다.
     ⚠️ 이 호출이 없으면 욕조를 벗은 뒤에도 캐릭터가 그 깊이만큼 뜬 채로 남아 있다가 다음 실행에서야
       제자리로 돌아온다. 부팅 경로(applyCharToSeat)에는 이미 같은 재계산이 있다. */
  try{ if(mySeat && mySeat.gltfRoot) fitModel(mySeat); }catch(_){}
  saveSlots();   // 적용 중 def 가 정리됐으면(옷 겹침 등) 한 번 더 — 그대로면 아무 일 없다
  if(mySeat.isMe && typeof Presence()!=='undefined' && Presence().active()){
    Presence().updateDef(def);
    if(!silent) toast('저장했어요 — 같은 방 친구에게 바로 반영돼요');
  } else if(!silent){
    toast('저장했어요');
  }
  /* 🎰 착용이 확정되는 자리에서도 한 번 본다 — 초안(wdDraftDef)이 회수보다 오래 열려 있었으면
     여기서 def 로 되살아난다. 보유한 파츠만 착용할 수 있으므로 방금 유저가 고른 것이
     여기서 벗겨지는 일은 없다(보관함의 잠긴 칸에는 onclick 자체가 없다). */
  try{ gachaMod().pruneUnownedGachaParts(); }
  catch(e){ console.warn('[가챠] 커밋 후 정리 실패', e); }
  return true;
}
/* 🔀 주인이 바뀐 초안 — 원래 캐릭터(슬롯 객체 = 앉아 있으면 그 좌석의 charDef)에만 쓰고 초안은 버린다.
   ★ 슬롯에도 좌석에도 없는 객체면(그 사이 슬롯을 다시 불러옴 등) 아무 데도 쓰지 않는다 — 엉뚱한 캐릭터를 덮는 것보다 낫다.
   ⚠️ Presence 는 그 좌석이 지금 «나» 일 때만 — 자리추가 좌석은 로컬 전용이다. */
async function _commitWdDraftToOwner(draft, silent){
  const src = draft._srcDef;
  const seat = seats.find(s => !s.remote && s.charDef === src) || null;
  const inSlots = (typeof slots() !== 'undefined') && slots().indexOf(src) >= 0;
  wdDraftDef = null;   // 다음에 꾸미기를 열면 지금 주 캐릭터로 새 초안을 만든다
  if(!seat && !inSlots){ console.warn('[꾸미기] 초안의 원래 캐릭터를 찾지 못해 저장하지 않았다'); return false; }
  src.equippedParts = JSON.parse(JSON.stringify(draft.equippedParts||{}));
  src.partXfMemory = JSON.parse(JSON.stringify(draft.partXfMemory||{}));
  /* 🐾 귀도 원래 주인에게 — _commitWdDraftNow 와 같은 짝. 빠지면 교체 직전에 고른 귀만 사라진다 */
  let _earChanged = false;
  try{ _earChanged = wdEar().commit(src, draft); }catch(e){ console.warn('[사람 귀] 저장', e); }
  saveSlots();   // 💾 파츠 받기를 기다리기 전에 — _commitWdDraftNow 와 같은 이유
  if(seat){
    if(_earChanged) _attachHumanEars(seat.modelRoot, src);
    pruneSeatPartsAgainstDef(seat, src);
    await applyEquippedPartsToSeat(seat, src);
    try{ if(seat.gltfRoot) fitModel(seat); }catch(_){}
    saveSlots();
  }
  if(seat && seat.isMe && typeof Presence()!=='undefined' && Presence().active()) Presence().updateDef(src);
  if(!silent) toast('꾸민 내용은 원래 캐릭터에 저장했어요');
  try{ gachaMod().pruneUnownedGachaParts(); }catch(_){}
  return true;
}
/* 🔀 주 캐릭터가 바뀐 직후 — 열려 있던 꾸미기 초안을 원래 캐릭터에 저장하고, 미리보기를 새 캐릭터로 다시 그린다. */
function _wdAfterMainSwap(){
  if(!wdDraftDef) return;
  const wd = document.getElementById('wardrobePanel'), gi = document.getElementById('gachaInvOverlay');
  const editing = (wd && wd.classList.contains('on')) || (gi && gi.style.display && gi.style.display !== 'none');
  /* 창이 닫혀 있으면 닫힐 때 이미 저장됐다 — 다시 쓰지 않고 남은 초안만 버린다(다른 경로가 옛 초안을 읽지 않게). */
  if(!editing){ wdDraftDef = null; return; }
  commitWdDraft(true).then(()=>{
    const wp = document.getElementById('wdPreviewPanel');
    if(wp && wp.classList.contains('on')){
      try{ refreshWdPreviewChar(); }catch(_){}
      try{ if(typeof window.refreshWardrobe==='function') window.refreshWardrobe(); }catch(_){}
    }
  }).catch(e=>console.warn('[꾸미기] 교체 뒤 저장 실패', e));
}
// ★ 요청사항: 우클릭으로 상세조정 패널을 안 열어도, 미리보기 바로 아래에 "지금 보고 있는 카테고리에
//   장착된 파츠"의 색상(_col)을 바로 바꿀 수 있는 영역을 상시 표시. _col이 없는 파츠거나 아무것도
//   장착 안 했으면 이 영역 자체가 숨겨짐.
function refreshWdPreviewColorSection(){
  const container = document.getElementById('wdPreviewColorSection'); if(!container) return;
  const _wasShown = container.style.display!=='none';
  container.innerHTML = '';
  partPaintMod().setWdActivePartRef(null);   // 🖍️ 아래에서 대상이 정해지면 채운다 — 조기 return 은 "대상 없음"이 맞다
  const _finish = ()=>{
    const _nowShown = container.style.display!=='none';
    if(_nowShown!==_wasShown){ sizeWdPreview(); updateWdCam(); }
    // 🖍️ 어느 경로로 끝나든 그림칸 UI 를 같이 맞춘다(연필 버튼·그리기 줄).
    try{ partPaintMod().refreshWdPicUI(); }catch(_){}
  };
  if(!wdPreviewBase || !wdPreviewBase.equippedPartObjs){ container.style.display='none'; _finish(); return; }
  const def = wdPreviewBase.charDef;
  let cat, entry;
  /* 🎰 파츠 보관함이 열려 있으면 이 영역은 '지금 보고 있는 가챠 파츠'의 것이다.
     ⚠️ 안 그러면 꾸미기 창에서 마지막으로 보던 탭(currentWdTab)의 파츠 색상이 그대로 뜬다 —
        보관함에서 가챠 파츠를 누르고 있는데 엉뚱한 모자 색이 나오는 화면이 된다. */
  if(gachaMod().isInvOpen()){
    const gRec = gachaMod().selId() ? savedParts().find(p=>p.id===gachaMod().selId()) : null;
    if(!gRec){ container.style.display='none'; _finish(); return; }
    cat = gRec.cat;
    entry = findEntryById(def, cat, gRec.id);
    if(!entry){
      // 착용 중이 아니면 조정할 대상 자체가 없다 — 숨기지 말고 왜 없는지 적는다.
      container.style.display='flex';
      const h=document.createElement('div'); h.className='wd-preview-color-head';
      h.textContent = (gRec.name||'파츠') + ' 색상';
      container.appendChild(h);
      const p=document.createElement('div'); p.className='wd-color-locked';
      p.textContent = '먼저 착용하면 색을 바꿀 수 있어요.';
      container.appendChild(p);
      _finish(); return;
    }
  } else {
    if(!currentWdTab){ container.style.display='none'; _finish(); return; }
    cat = currentWdTab;
    /* 🎨 **어느 파츠를 만지는가를 id 하나로 먼저 정한다.** 아래에서 entry(저장 대상)와
         wrapper(색칠 대상)를 둘 다 이 id 로 되찾는다.
       [경위] 예전엔 entry 는 `activeWdAdj || firstEntryForCat`, wrapper 는 `activeWdAdj || 메인
         wrapper` 로 **각각 따로** 골랐다. 우클릭을 안 한 상태에서 카테고리에 파츠가 둘 이상이면
         (🔗 stackable 귀 파츠 + 평범한 모자) 둘이 서로 다른 파츠를 가리켰다 —
         화면에서는 모자가 물들고 저장은 귀 entry 에 붙어, 다시 들어오면 색이 사라진 것처럼 보였다.
         어긋나는 조건이 **착용 조합과 착용 순서**라 개발자 화면에서는 멀쩡하고 일부 유저에게만
         재현됐다. (sim-part-color-entry.js 가 이 조합들을 그대로 재현한다)
       ★ 기본값은 메인 wrapper 의 partId 다 — 예전에 실제로 색이 칠해지던 그 파츠라 동작이 그대로다.
         메인이 없으면(카테고리에 🔗 파츠만 있는 경우) 첫 entry 로 간다. 예전엔 이 경우
         wrapper 가 undefined 라 **색상 영역이 통째로 안 떴다.** */
    const _mainW0 = wdPreviewBase.equippedPartObjs[cat];
    const _pickId = (activeWdAdj && activeWdAdj.cat===cat && activeWdAdj.id)
                 || (_mainW0 && _mainW0.userData && _mainW0.userData.partId)
                 || partEntryId(firstEntryForCat(def, cat));
    entry = (_pickId && findEntryById(def, cat, _pickId)) || firstEntryForCat(def, cat);
    if(!entry){ container.style.display='none'; _finish(); return; }
  }
  /* 🎰 색상 게이트 — 가챠 파츠는 같은 파츠를 4개 모아야 색을 바꿀 수 있다.
     🔴 게이트는 가챠 파츠에만 건다. 기존 꾸미기 파츠의 색상은 지금 조건 없이 열려 있고,
        전체에 걸면 기존 유저가 쓰던 기능을 잃는다 — 가챠 설계에서 내내 피해 온 종류의 사고다.
     ★ 숨기지 않고 잠긴 채로 보여준다. 영역이 통째로 사라지면 "이 파츠는 색이 없나 보다"로 읽힌다. */
  const _colId = partEntryId(entry);
  const _colRec = _colId ? savedParts().find(p=>p.id===_colId) : null;
  if(gachaMod().isGachaPart(_colRec) && !gachaMod().isGachaColorUnlocked(_colId)){
    const have = gachaMod().gachaCount(_colId);
    container.style.display='flex';
    const gh = document.createElement('div'); gh.className='wd-preview-color-head';
    gh.textContent = '🔒 ' + (_colRec.name || '이 파츠') + ' 색상';
    container.appendChild(gh);
    const gp = document.createElement('div'); gp.className='wd-color-locked';
    gp.textContent = '●'.repeat(have) + '○'.repeat(Math.max(0, gachaMod().DUPES_FOR_COLOR-have))
      + '  ' + have + '/' + gachaMod().DUPES_FOR_COLOR + ' — '
      + (gachaMod().DUPES_FOR_COLOR - have) + '개 더 모으면 색상 변경이 열려요';
    container.appendChild(gp);
    _finish(); return;
  }
  // 런처9: 다중 파츠면 현재 활성 인스턴스의 xf/wrapper 사용
  const multi = window._wdCurrentMultiPanel;
  const activeIdx = (multi && multi.cat===cat && typeof multi.getCurrent==='function') ? multi.getCurrent() : 0;
  const instances = partEntryInstances(entry);
  const xf = instances[activeIdx] || partEntryXf(entry);
  if(!xf.color) xf.color = {};
  /* 🎨 색칠 대상 wrapper 를 **저장 대상 entry 와 같은 id** 로 되찾는다(위 주석 참고).
     🔗 stackable 파츠는 equippedPartObjs 에 없고 stackedPartObjs[cat][id] 에 있다. */
  const _eid = partEntryId(entry);
  const main = wdPreviewBase.equippedPartObjs[cat];
  const stackedW = (wdPreviewBase.stackedPartObjs && wdPreviewBase.stackedPartObjs[cat]
    && wdPreviewBase.stackedPartObjs[cat][_eid]) || null;
  /* ⚠️ 메인 wrapper 는 **partId 가 이 entry 와 같을 때만** 쓴다 — 다르면 남의 파츠 메쉬라
     거기에 색을 칠하면 다시 어긋난다. 아직 장착이 안 끝나 wrapper 가 없으면 아래 buildColorRows 가
     빈 배열을 돌려줘 영역이 잠시 숨고, 장착이 끝나 refresh 가 다시 돌면 뜬다.
     (partId 가 없는 옛 wrapper 는 예전 동작대로 메인을 쓴다 — 하위호환) */
  // 🔗 stackable도 다중 파츠를 가질 수 있으므로 base를 정한 뒤 동일하게 인스턴스를 고른다.
  const _base = stackedW
    || ((main && (!main.userData || !main.userData.partId || main.userData.partId===_eid)) ? main : null);
  let wrapper = _base;
  if(activeIdx>0 && _base && _base.userData && _base.userData.multiExtras){
    wrapper = _base.userData.multiExtras[activeIdx-1] || _base;
  }
  /* 🖍️ 그림칸 UI 는 **여기서 정해진 대상을 그대로 물려받는다.**
     [왜 따로 안 고르는가] 이 함수 위쪽 주석이 말하는 그 사고 — entry(저장 대상)와 wrapper(칠하는 대상)를
       각각 따로 고르면 착용 조합에 따라 둘이 다른 파츠를 가리킨다. 그림은 색보다 티가 크게 난다
       (모자에 그렸는데 저장은 귀에 붙는다). 그래서 고르는 코드를 한 벌만 두고 결과를 넘긴다.
     ⚠️ 위쪽 조기 return(장착 안 함 · 가챠 색상 잠김 등)은 ref 를 null 로 남긴다 = 연필도 안 뜬다. */
  partPaintMod().setWdActivePartRef({ cat: cat, entry: entry, xf: xf, wrapper: wrapper });
  const rows = buildColorRows(cat, xf, wrapper, ()=>{});
  if(!rows.length){ container.style.display='none'; _finish(); return; }
  container.style.display='flex';
  const info = partCatInfo(cat);
  const head = document.createElement('div'); head.className='wd-preview-color-head';
  head.textContent = (info ? (info.icon+' '+info.label) : '') + ' 색상' + (activeIdx>0 ? (' (인스턴스 '+(activeIdx+1)+')') : '');
  container.appendChild(head);
  rows.forEach(r=>container.appendChild(r));
  _finish();
}

/* 꾸미기 패널 콘텐츠 렌더링 및 파츠 조절 로직 */
let activeWdAdj = null;
// 런처9: 다중 파츠 상세조정 패널의 현재 활성 인스턴스 — 패널이 재생성돼도 유지되도록 모듈 스코프에 보관.
//   키는 파츠 id로. 다른 파츠로 넘어가면 자동 리셋.
let _wdMultiActiveIdx = { id:null, idx:0 };
function _wdGetSavedInstanceIdx(id){
  return (_wdMultiActiveIdx && _wdMultiActiveIdx.id === id) ? _wdMultiActiveIdx.idx : 0;
}
function _wdSetSavedInstanceIdx(id, idx){
  _wdMultiActiveIdx = { id, idx };
}
// 런처9: 다중 파츠 상세조정 패널이 열려있을 때만 미리보기 클릭이 인스턴스 전환으로 동작 — 패널 바뀔 때마다 초기화.
function _clearMultiPanelRef(){ window._wdCurrentMultiPanel = null; _wdMultiActiveIdx = { id:null, idx:0 }; }
let wdAdjAxis = 'y';

/* 길게 누르기 헬퍼 — pointerdown 즉시 1회 + 300ms 후 60ms 간격 연속 */
function _holdRepeat(btn, action){
  let t=null, iv=null;
  const stop = ()=>{ if(t){clearTimeout(t);t=null;} if(iv){clearInterval(iv);iv=null;} };
  btn.addEventListener('pointerdown', e=>{
    if(e.button!==0) return;   // 좌클릭만 — 우클릭은 아래 contextmenu에서 별도 처리
    e.preventDefault();
    btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
    action(false);
    t = setTimeout(()=>{ iv = setInterval(()=>action(false), 60); }, 300);
  });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('pointerleave', stop);
  // ★ 우클릭 = 0.5씩 성큼성큼 이동(값을 빠르게 크게 바꾸고 싶을 때). 길게 누르기는 지원 안 함(클릭당 1번).
  btn.addEventListener('contextmenu', e=>{ e.preventDefault(); action(true); });
}

// ★ 완전히 자유로운 색상 선택(요청사항) — 프리셋 몇 개가 아니라 채도/명도 박스 + 색상환(hue) 슬라이더로
//   어떤 색이든 고를 수 있게 함. 네이티브 <input type=color>는 이 앱(투명·항상위 Electron 창)에서 팝업이
//   창 뒤로 숨는 문제가 있어서(위 설명 참고) 계속 우리 DOM/캔버스로 직접 그림.
function hsvToHex(h,s,v){
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  const R=Math.round((r+m)*255), G=Math.round((g+m)*255), B=Math.round((b+m)*255);
  return '#'+[R,G,B].map(n=>Math.max(0,Math.min(255,n)).toString(16).padStart(2,'0')).join('');
}
function hexToHsv(hex){
  hex = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#ffffff';
  const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0;
  if(d!==0){
    if(max===r) h=60*(((g-b)/d)%6);
    else if(max===g) h=60*((b-r)/d+2);
    else h=60*((r-g)/d+4);
  }
  if(h<0) h+=360;
  const s=max===0?0:d/max, v=max;
  return {h,s,v};
}
// anchorHex: 열 당시의 현재 색, onPick(hex): 값이 바뀔 때마다(드래그 중 계속) 호출
function buildFreeColorPicker(anchorHex, onPick){
  const wrap=document.createElement('div'); wrap.className='wd-color-palette wd-free-picker';
  let {h,s,v} = hexToHsv(anchorHex);
  const SV_W=140, SV_H=100;
  const svCanvas=document.createElement('canvas'); svCanvas.width=SV_W; svCanvas.height=SV_H; svCanvas.className='wd-sv-canvas';
  const cursor=document.createElement('div'); cursor.className='wd-sv-cursor';
  const svWrap=document.createElement('div'); svWrap.className='wd-sv-wrap'; svWrap.appendChild(svCanvas); svWrap.appendChild(cursor);
  const hueSlider=document.createElement('input'); hueSlider.type='range'; hueSlider.min=0; hueSlider.max=360; hueSlider.step=1; hueSlider.className='wd-hue-slider'; hueSlider.value=Math.round(h);

  // ★ 런처8: 최근 사용 색 5개 (생성기+꾸미기 공용, 마이홈 팔레트와는 별도) — localStorage에 저장.
  const CHAR_RECENT_KEY = 'tw.charColorHistory';
  function loadRecent(){ try{ return JSON.parse(localStorage.getItem(CHAR_RECENT_KEY)||'[]'); }catch(_){ return []; } }
  function saveRecent(hex){
    hex = (hex||'').toLowerCase(); if(!/^#[0-9a-f]{6}$/.test(hex)) return;
    let arr = loadRecent().filter(c=>c!==hex);
    arr.unshift(hex);
    arr = arr.slice(0,5);
    try{ localStorage.setItem(CHAR_RECENT_KEY, JSON.stringify(arr)); }catch(_){}
    renderRecent();
  }
  const recentRow=document.createElement('div'); recentRow.className='wd-recent-row';
  recentRow.style.cssText='display:flex;gap:3px;margin-top:6px;padding:0 2px;';
  function renderRecent(){
    recentRow.innerHTML='';
    const arr=loadRecent();
    for(let i=0;i<5;i++){
      const b=document.createElement('button'); b.type='button'; b.className='wd-recent-sw';
      b.style.cssText='width:20px;height:20px;padding:0;cursor:'+(arr[i]?'pointer':'default')+';'
        + 'border:1px solid;border-color:#404040 #fff #fff #404040;'
        + (arr[i]? 'background:'+arr[i]+';' : 'background:#eee;opacity:.4;');
      b.title = arr[i] || '';
      if(arr[i]) b.addEventListener('click', ev=>{ ev.stopPropagation(); const c=arr[i];
        const hsv=hexToHsv(c); h=hsv.h; s=hsv.s; v=hsv.v;
        hueSlider.value=Math.round(h); drawSV(); updateCursor();
        onPick(c); saveRecent(c);
      });
      recentRow.appendChild(b);
    }
  }

  function drawSV(){
    const ctx=svCanvas.getContext('2d');
    ctx.fillStyle=hsvToHex(h,1,1); ctx.fillRect(0,0,SV_W,SV_H);
    const satGrad=ctx.createLinearGradient(0,0,SV_W,0);
    satGrad.addColorStop(0,'rgba(255,255,255,1)'); satGrad.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=satGrad; ctx.fillRect(0,0,SV_W,SV_H);
    const valGrad=ctx.createLinearGradient(0,0,0,SV_H);
    valGrad.addColorStop(0,'rgba(0,0,0,0)'); valGrad.addColorStop(1,'rgba(0,0,0,1)');
    ctx.fillStyle=valGrad; ctx.fillRect(0,0,SV_W,SV_H);
  }
  function updateCursor(){ cursor.style.left=(s*SV_W)+'px'; cursor.style.top=((1-v)*SV_H)+'px'; }
  drawSV(); updateCursor(); renderRecent();

  let dragging=false;
  function pickFromEvent(e){
    const rect=svCanvas.getBoundingClientRect();
    const x=Math.max(0,Math.min(SV_W,e.clientX-rect.left));
    const y=Math.max(0,Math.min(SV_H,e.clientY-rect.top));
    s=x/SV_W; v=1-y/SV_H;
    updateCursor();
    onPick(hsvToHex(h,s,v));
  }
  svCanvas.addEventListener('pointerdown', e=>{ dragging=true; svCanvas.setPointerCapture(e.pointerId); pickFromEvent(e); });
  svCanvas.addEventListener('pointermove', e=>{ if(dragging) pickFromEvent(e); });
  svCanvas.addEventListener('pointerup', ()=>{ dragging=false; saveRecent(hsvToHex(h,s,v)); });   // 마우스 뗄 때 최근색 저장
  hueSlider.addEventListener('input', ()=>{ h=+hueSlider.value; drawSV(); onPick(hsvToHex(h,s,v)); });
  hueSlider.addEventListener('change', ()=>{ saveRecent(hsvToHex(h,s,v)); });

  wrap.appendChild(svWrap);
  wrap.appendChild(hueSlider);
  wrap.appendChild(recentRow);
  return wrap;
}
// ★ 런처8: buildFreeColorPicker를 어떤 트리거 요소 위에 팝업으로 띄우는 헬퍼 — 생성기/꾸미기의 color 픽커
//   호출부에서 재사용. 팔레트를 fixed 위치로 body에 붙이고, 바깥 클릭 시 자동 닫힘.
function openCharColorPicker(anchorEl, curHex, onPick){
  // 같은 앵커에서 이미 열려있으면 토글로 닫기
  const existing=document.querySelector('.wd-free-picker[data-owner]');
  if(existing && existing.dataset.owner === anchorEl.id) { existing.remove(); return; }
  if(existing) existing.remove();
  const pop=buildFreeColorPicker(curHex||'#888888', onPick);
  pop.dataset.owner = anchorEl.id || '';
  pop.style.position='fixed';
  const rect=anchorEl.getBoundingClientRect();
  pop.style.left=rect.left+'px'; pop.style.top=(rect.bottom+4)+'px'; pop.style.zIndex='9999';
  document.body.appendChild(pop);
  requestAnimationFrame(()=>{
    const pr=pop.getBoundingClientRect();
    if(pr.bottom>innerHeight) pop.style.top=(rect.top-pr.height-4)+'px';
    if(pr.right>innerWidth) pop.style.left=Math.max(4,innerWidth-pr.width-4)+'px';
  });
  const closer=(e)=>{ if(!pop.contains(e.target) && e.target!==anchorEl){ pop.remove(); document.removeEventListener('mousedown', closer, true); } };
  setTimeout(()=>document.addEventListener('mousedown', closer, true), 0);
}
window.openCharColorPicker = openCharColorPicker;
function createWardrobeAdjPanel(cat, id) {
  const def = ensureWdDraft();
  const previewSeat = wdPreviewBase;
  // ★ 버그 수정: def.equippedParts[cat]을 통째로 잡으면 🔗 stackable(배열/Firebase 숫자키 맵) 카테고리에서
  //   컨테이너에 유령 xf가 붙어 ↺ 초기화 버튼이 먹지 않고, entriesForCat 판정까지 깨졌다.
  //   지금 우클릭한 파츠 id의 entry를 정확히 짚는다.
  let entry = findEntryById(def, cat, id) || firstEntryForCat(def, cat);
  if(entry && typeof entry==='object'){
    if(!entry.xf) entry.xf = defaultPartXf();
    if(!entry.xf.color) entry.xf.color = {};
  }
  const rec = savedParts().find(p=>p.id===id);
  // 다중 파츠는 rec.multi === true인 경우만 (엄격 체크로 이전 false/undefined 값과 확실히 구분)
  const isMulti = !!(rec && rec.multi === true);

  // 런처9: 다중 파츠일 땐 현재 편집 인스턴스 인덱스를 로컬에 유지 — 기본은 0(main).
  // 다른 함수들에서 xf를 새로 잡을 수 있도록 getXf()로 캡슐화.
  let currentInstanceIdx = isMulti ? _wdGetSavedInstanceIdx(id) : 0;
  // 유효 범위 clamp (인스턴스 개수보다 크면 마지막으로)
  if(isMulti){
    const totalNow = partEntryInstanceCount(entry);
    if(currentInstanceIdx >= totalNow) currentInstanceIdx = totalNow-1;
    if(currentInstanceIdx < 0) currentInstanceIdx = 0;
  }
  const getXf = ()=>{
    const inst = partEntryInstances(entry);
    return inst[currentInstanceIdx] || defaultPartXf();
  };
  // xf 참조 — mutate 대상. 인스턴스가 바뀔 때마다 재할당.
  let xf = getXf();
  if(!xf.color) xf.color = {};
  /* 🩹 [2026-10-02 제보] «세부 조정 뒤 초기화를 눌러도 안 된다»
     패널이 만들어질 때의 미리보기(previewSeat)를 그대로 잡고 있으면, 그 뒤 미리보기가 다시 지어졌을 때
     (카탈로그 동기화·재장착 등 refreshWdPreviewChar) 화면에 없는 옛 캐릭터에 적용하게 된다.
     기즈모는 늘 **지금의** wdPreviewBase 를 보므로 조정은 먹고 초기화만 안 먹는 모양이 된다. */
  const sync = () => {
    const b = wdPreviewBase || previewSeat;
    if(b) applyPartXf(b, cat);
  };

  const panel = document.createElement('div');
  panel.className = 'wd-adj';

  // 다중 파츠 인스턴스 선택 — [파츠 추가] [◀] [1/N] [▶]
  if(isMulti){
    const multiRow = document.createElement('div');
    multiRow.className = 'wd-adj-row';
    multiRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const rerender = ()=>{
      const total = partEntryInstanceCount(entry);
      const label = multiRow.querySelector('.wd-multi-lbl');
      if(label) label.textContent = (currentInstanceIdx+1) + ' / ' + total;
      _wdSetSavedInstanceIdx(id, currentInstanceIdx);   // 패널 재생성 시 복원용
    };
    multiRow.innerHTML = `
      <span style="font-size:11px;color:#888;">다중 파츠</span>
      <button class="wd-multi-prev" title="이전 인스턴스" style="font-size:14px;padding:2px 8px;">◀</button>
      <span class="wd-multi-lbl" style="font-size:11px;min-width:36px;text-align:center;">1 / 1</span>
      <button class="wd-multi-next" title="다음 인스턴스" style="font-size:14px;padding:2px 8px;">▶</button>
      <button class="wd-multi-add" title="파츠 하나 더 추가 (최대 5)" style="font-size:14px;padding:2px 10px;margin-left:8px;color:#2a7f3f;font-weight:bold;">＋</button>
      <button class="wd-multi-remove" title="현재 활성 인스턴스 삭제" style="font-size:14px;padding:2px 10px;color:#c0392b;font-weight:bold;">－</button>
      <span style="font-size:10px;color:#8a8a8a;margin-left:auto;">미리보기 클릭 = 활성 전환</span>`;
    panel.appendChild(multiRow);
    rerender();
    // ◀ 이전 인스턴스
    multiRow.querySelector('.wd-multi-prev').onclick = ()=>{
      const total = partEntryInstanceCount(entry);
      currentInstanceIdx = (currentInstanceIdx - 1 + total) % total;
      xf = getXf(); if(!xf.color) xf.color = {};
      rerender();
      attachWdGizmo(cat, currentInstanceIdx, id);
      refreshWdPreviewColorSection();
    };
    // ▶ 다음 인스턴스
    multiRow.querySelector('.wd-multi-next').onclick = ()=>{
      const total = partEntryInstanceCount(entry);
      currentInstanceIdx = (currentInstanceIdx + 1) % total;
      xf = getXf(); if(!xf.color) xf.color = {};
      rerender();
      attachWdGizmo(cat, currentInstanceIdx, id);
      refreshWdPreviewColorSection();
    };
    // ＋ 파츠 추가
    multiRow.querySelector('.wd-multi-add').onclick = async ()=>{
      const total = partEntryInstanceCount(entry);
      if(total>=5){ toast('한 파츠에 최대 5개까지 붙일 수 있어요'); return; }
      addPartEntryInstance(entry);
      currentInstanceIdx = total;
      _wdSetSavedInstanceIdx(id, currentInstanceIdx);
      // 미리보기 전체 재빌드 — 부분 재장착 시 일부 미리보기 갱신 실패하던 문제를 확실히 회피
      await refreshWdPreviewChar();
      renderWardrobe();
    };
    // － 현재 활성 인스턴스 삭제
    multiRow.querySelector('.wd-multi-remove').onclick = async ()=>{
      const total = partEntryInstanceCount(entry);
      if(total<=1){ toast('마지막 인스턴스는 지울 수 없어요 (파츠 자체를 안함으로 바꿔주세요)'); return; }
      removePartEntryInstance(entry, currentInstanceIdx);
      currentInstanceIdx = Math.max(0, currentInstanceIdx-1);
      _wdSetSavedInstanceIdx(id, currentInstanceIdx);
      await refreshWdPreviewChar();
      renderWardrobe();
    };
    // 미리보기 클릭으로 활성 인스턴스 전환
    window._wdCurrentMultiPanel = {
      cat,
      setInstance: (idx)=>{
        currentInstanceIdx = Math.max(0, Math.min(partEntryInstanceCount(entry)-1, idx));
        xf = getXf(); if(!xf.color) xf.color = {};
        rerender();
        attachWdGizmo(cat, currentInstanceIdx, id);
        refreshWdPreviewColorSection();
      },
      getCurrent: ()=>currentInstanceIdx,
    };
  }

  // 상세조정 개편(v2): 위치/회전/크기 조작은 미리보기 기즈모로 전담.
  //   여기 남는 건 (1) 다중 파츠 인스턴스 컨트롤(위) (2) 초기화 4버튼(아래).
  //   색상은 미리보기 아래 "색상" 섹션에 별도로 표시됨(refreshWdPreviewColorSection).
  const resetRow = document.createElement('div');
  resetRow.className = 'wd-adj-row';
  resetRow.style.cssText = 'display:flex;gap:4px;margin-top:6px;';
  resetRow.innerHTML = `
    <button class="wd-reset-pos"   title="위치를 기본값으로 되돌림" style="flex:1;font-size:11px;padding:4px;">↺ 위치</button>
    <button class="wd-reset-rot"   title="회전을 기본값으로 되돌림" style="flex:1;font-size:11px;padding:4px;">↺ 회전</button>
    <button class="wd-reset-scale" title="크기를 기본값으로 되돌림" style="flex:1;font-size:11px;padding:4px;">↺ 크기</button>
    <button class="wd-reset-all"   title="전체(위치·회전·크기) 초기화" style="flex:1;font-size:11px;padding:4px;background:#ffe4e0;color:#a03020;font-weight:bold;">↺ 전체</button>`;
  // 개별 초기화 함수 — defaultXf가 있으면 그 값으로, 없으면 원점(0/1)
  const rec4reset = savedParts().find(p=>p.id===id);
  const defXf = rec4reset && rec4reset.defaultXf;
  /* 🩹 [2026-10-02 제보] 초기화는 **누르는 순간** 값을 다시 찾는다 — 기즈모(_wdGetActiveWrapperAndXf)와 같은 출처.
     [원인] 예전엔 패널을 만들 때 잡아 둔 entry·xf 를 고쳤다. 그 사이 미리보기·draft 가 새로 지어지면
       (refreshWdPreviewChar · ensureWdDraft 가 새 draft 를 만드는 경우) 기즈모가 만진 값과 다른 객체를 고치게 되어
       눌러도 화면이 그대로였다.
     [대응] 지금 미리보기의 charDef 와 지금 draft 양쪽에서 이 파츠·인스턴스의 xf 를 찾아 **둘 다** 되돌린다
       (둘이 같은 객체면 한 번). 패널이 잡아 둔 xf 도 같이 — 패널의 다른 동작이 옛 값을 다시 쓰지 않게.
     ★ 저작 오프셋 옛 보정 표식(_aoLegacy)도 내린다. 초기화로 쓴 값은 «깨끗한» 값이라, 표식이 남아 있으면
       authorOff 만큼 밀린 자리로 «초기화» 된다(기즈모가 sync 에서 내리는 것과 같은 이유). */
  const _resetTargets = ()=>{
    const out = [];
    const defs = [];
    const b = wdPreviewBase;
    if(b && b.charDef) defs.push(b.charDef);
    /* ⚠️ ensureWdDraft() 를 부르지 않는다 — 원본이 바뀐 경우 새 draft 를 만들어 지금까지의 편집을 버릴 수 있다.
       저장(_commitWdDraftNow)이 읽는 그 전역(wdDraftDef)을 그대로 본다. */
    const dr = (typeof wdDraftDef !== 'undefined') ? wdDraftDef : null;
    if(dr && defs.indexOf(dr) < 0) defs.push(dr);
    defs.forEach(d=>{
      const e = findEntryById(d, cat, id) || firstEntryForCat(d, cat);
      if(!e || typeof e !== 'object') return;
      const insts = partEntryInstances(e);
      let x = insts[currentInstanceIdx];
      if(!x){ x = defaultPartXf(); setPartEntryInstanceXf(e, currentInstanceIdx, x); }
      if(out.indexOf(x) < 0) out.push(x);
    });
    if(xf && out.indexOf(xf) < 0) out.push(xf);
    return out;
  };
  const _clearAoLegacy = ()=>{
    const b = wdPreviewBase; if(!b) return;
    const ws = [];
    const m = b.equippedPartObjs && b.equippedPartObjs[cat];
    if(m) ws.push(m);
    const st = b.stackedPartObjs && b.stackedPartObjs[cat] && b.stackedPartObjs[cat][id];
    if(st) ws.push(st);
    ws.slice().forEach(w=>{ ((w.userData && w.userData.multiExtras) || []).forEach(ex=>ws.push(ex)); });
    ws.forEach(w=>{ if(w && w.userData) w.userData._aoLegacy = false; });
  };
  const resetOne = (kind)=>{
    _resetTargets().forEach(x=>{
      if(kind==='pos')   x.pos   = (defXf && Array.isArray(defXf.pos))   ? defXf.pos.slice()  : [0,0,0];
      if(kind==='rot')   x.rot   = (defXf && Array.isArray(defXf.rot))   ? defXf.rot.slice()  : [0,0,0];
      if(kind==='scale') x.scale = (defXf && typeof defXf.scale==='number') ? defXf.scale     : 1;
    });
    if(kind==='pos') _clearAoLegacy();
    sync();
  };
  resetRow.querySelector('.wd-reset-pos').onclick   = ()=>resetOne('pos');
  resetRow.querySelector('.wd-reset-rot').onclick   = ()=>resetOne('rot');
  resetRow.querySelector('.wd-reset-scale').onclick = ()=>resetOne('scale');
  resetRow.querySelector('.wd-reset-all').onclick   = ()=>{
    resetOne('pos'); resetOne('rot'); resetOne('scale');
  };
  panel.appendChild(resetRow);
  // 색상(_col) 조정 UI는 미리보기 패널 하단("○○ 색상" 섹션)에만 표시
  return panel;
}
// ★ 색상(_col) 조정 UI를 만드는 부분을 재사용 가능하게 분리 — 우클릭 상세조정 패널과, 미리보기 아래
//   "항상 보이는 색상 탭"(요청사항: 우클릭 안 해도 바로 색 바꿀 수 있게) 양쪽에서 같이 씀.
//   syncFn은 색을 바꾼 뒤 호출할 콜백(위치조정 패널에서는 위치도 다시 반영하는 sync, 미리보기
//   전용 섹션에서는 딱히 할 일이 없으면 빈 함수를 넘기면 됨).

function buildColorRows(cat, xf, wrapper, syncFn){
  const rows=[];
  const colorGroups = wrapper && wrapper.userData && wrapper.userData.colorGroups;
  if(!colorGroups || !Object.keys(colorGroups).length) return rows;
  xf.color = xf.color || {};
  // 그룹 이름(col1,col2...)을 번호 순으로 정렬해서 "색상1","색상2"... 순서로 보여줌
  const keys = Object.keys(colorGroups).sort((a,b)=> (parseInt(a.replace('col',''))||1) - (parseInt(b.replace('col',''))||1) );
  keys.forEach((key, idx)=>{
    const meshes = colorGroups[key];
    const colorRow = document.createElement('div');
    colorRow.className = 'wd-adj-row';
    const firstOrig = (meshes[0].userData.origColor) || 'ffffff';
    const curColor = xf.color[key] || ('#'+firstOrig);
    // 🎨 텍스처가 있는 그룹은 "색조"로 표기 — 원본 색을 덮는 게 아니라 색조만 도는 거라 동작이 다름
    const hueMode = meshes.some(isHueTintMesh);
    const baseLab = hueMode ? '색조' : '색상';
    const label = keys.length>1 ? (baseLab+(idx+1)) : baseLab;
    /* 🎚️ 텍스처 파츠(색조 모드)는 팔레트 대신 색조·채도·밝기 슬라이더 3개를 낸다(요청 사양).
       [왜] 팔레트는 "이 색으로 칠한다"는 뜻인데 색조 모드는 원본 무늬를 유지한 채 색상환만
         돌리는 것이라, 고른 색과 결과가 달라 보여 계속 어긋난다. 돌리는 양을 직접 잡는 편이 맞다.
       [저장] 진짜 값은 xf.colorHSV[key] = {h,s,v} 다. xf.color[key] 에도 같은 값을 hex 로 함께
         적어 둔다 — 스와치·썸네일 같은 표시용 경로와, 한 그룹에 텍스처 없는 메쉬가 섞여 있을 때의
         플랫 경로가 여전히 hex 를 읽기 때문이다. 둘이 어긋나지 않게 항상 같이 쓴다.
       ⚠️ 팔레트(과거 색 5개 저장 포함)는 **텍스처 없는 파츠에서 그대로 쓴다** — 건드리지 않았다. */
    if(hueMode){
      const _hsv0 = (xf.colorHSV && xf.colorHSV[key]) ? xf.colorHSV[key]
                  : (xf.color[key] ? (()=>{ const t=_rgbHexToHsv(xf.color[key]); return {h:t.h, s:t.s, v:1}; })()
                                   : null);
      // 손 안 댄 상태의 기본값: 색조 0 · 채도 0(= 슬라이더 가운데 = 원본 채도 유지) · 밝기 1(중립).
      // uOn 은 아직 꺼져 있다.
      let _h = _hsv0 ? (_hsv0.h||0) : 0;
      let _s = _hsv0 ? (_hsv0.s||0) : 0;
      let _v = _hsv0 ? (_hsv0.v==null?1:_hsv0.v) : 1;
      colorRow.style.flexDirection = 'column'; colorRow.style.alignItems = 'stretch'; colorRow.style.gap = '3px';
      const mk = (lab, min, max, val, unit)=>{
        const r = document.createElement('div'); r.className = 'wd-adj-row';
        r.innerHTML = `<span class="wd-adj-lab">${lab}</span>`
                    + `<input type="range" min="${min}" max="${max}" step="1" value="${val}">`
                    + `<span class="wd-adj-num">${val}${unit}</span>`;
        return r;
      };
      const head = document.createElement('div');
      head.className = 'wd-adj-row';
      head.innerHTML = `<span class="wd-adj-lab">${label}</span>`
                     + `<span class="wd-adj-swatch" style="flex:1;background:${curColor};"></span>`
                     + `<button class="wd-adj-reset" title="원본 색으로">↺</button>`;
      const rowH = mk('색조', 0, 359, Math.round(_h*360), '°');
      /* 🎚️ 채도만 양음(-100~100)이다. 가운데 0 이 '원본 그대로'이고, 왼쪽 끝이 회색이다.
         ⚠️ 최소값을 0 으로 되돌리지 말 것 — 그러면 왼쪽 끝이 곧 중립이라 아무리 밀어도
            색이 안 빠진다. 저장값 s 의 범위도 -1~1 로 넓어졌지만, 옛 저장값은 전부 0 이상이라
            뜻이 그대로다(0=중립, 양수=올림). */
      const rowS = mk('채도', -100, 100, Math.round(_s*100), '%');
      const rowV = mk('밝기', 40, 160, Math.round(_v*100), '%');
      const swatch = head.querySelector('.wd-adj-swatch');
      let _hsvRAF = null;
      const applyHSV = ()=>{
        xf.colorHSV = xf.colorHSV || {};
        xf.colorHSV[key] = { h:_h, s:_s, v:_v };
        const hex = _hsvToHex(_h, _s, _v);
        xf.color[key] = hex;                 // 표시용·플랫 메쉬용 사본
        swatch.style.background = hex;
        meshes.forEach(m=>{
          if(!m.material) return;
          if(isHueTintMesh(m)){ applyHueTint(m, hex, xf.colorHSV[key]); m.material.needsUpdate = true; return; }
          if(m.material.color) m.material.color.set(hex);
          if(m.material.emissive){
            const baseFlat = (m.material.userData && m.material.userData.baseFlat!=null)
              ? m.material.userData.baseFlat
              : (1 - (typeof LIGHT_PRESET()!=='undefined' ? LIGHT_PRESET().e : 0.5));
            m.material.emissive.set(hex).multiplyScalar(baseFlat);
          }
          m.material.needsUpdate = true;
        });
        // 드래그 중 매 입력마다 저장하면 무거워진다 — 화면은 즉시, 저장은 프레임당 한 번.
        if(_hsvRAF) return;
        _hsvRAF = requestAnimationFrame(()=>{ _hsvRAF=null; syncFn(); });
      };
      const bind = (row, unit, setter)=>{
        const inp = row.querySelector('input'); const num = row.querySelector('.wd-adj-num');
        inp.oninput = ()=>{ num.textContent = inp.value + unit; setter(parseFloat(inp.value)); applyHSV(); };
      };
      bind(rowH, '°', v => { _h = v/360; });
      bind(rowS, '%', v => { _s = v/100; });
      bind(rowV, '%', v => { _v = v/100; });
      head.querySelector('.wd-adj-reset').onclick = ()=>{
        delete xf.color[key];
        if(xf.colorHSV) delete xf.colorHSV[key];
        _h = 0; _s = 0; _v = 1;
        rowH.querySelector('input').value = 0;   rowH.querySelector('.wd-adj-num').textContent = '0°';
        rowS.querySelector('input').value = 0;   rowS.querySelector('.wd-adj-num').textContent = '0%';
        rowV.querySelector('input').value = 100; rowV.querySelector('.wd-adj-num').textContent = '100%';
        meshes.forEach(m=>{
          if(!m.material) return;
          if(isHueTintMesh(m)){ applyHueTint(m, null); m.material.needsUpdate = true; return; }   // 색조 해제 = 원본 텍스처
          if(!m.userData.origColor) return;
          const hex = '#'+m.userData.origColor;
          if(m.material.color) m.material.color.set(hex);
          if(m.material.emissive){
            const baseFlat = (m.material.userData && m.material.userData.baseFlat!=null)
              ? m.material.userData.baseFlat
              : (1 - (typeof LIGHT_PRESET()!=='undefined' ? LIGHT_PRESET().e : 0.5));
            m.material.emissive.set(hex).multiplyScalar(baseFlat);
          }
          m.material.needsUpdate = true;
        });
        swatch.style.background = '#'+firstOrig;
        syncFn();
      };
      const box = document.createElement('div');
      box.className = 'wd-adj-row'; box.style.flexDirection='column'; box.style.alignItems='stretch'; box.style.gap='3px';
      box.appendChild(head); box.appendChild(rowH); box.appendChild(rowS); box.appendChild(rowV);
      rows.push(box);
      return;   // 아래 팔레트 경로는 타지 않는다
    }
    colorRow.innerHTML = `<span class="wd-adj-lab">${label}</span>
                          <span class="wd-adj-swatch" style="background:${curColor};"></span>
                          <input type="text" class="wd-adj-hex" value="${curColor}" maxlength="7" spellcheck="false">
                          <button class="wd-adj-reset" title="원본 색으로">↺</button>`;
    const swatchBtn = colorRow.querySelector('.wd-adj-swatch');
    const hexInput = colorRow.querySelector('.wd-adj-hex');
    let _colorSyncRAF = null;
    const applyColor = (val)=>{
      if(!/^#[0-9a-fA-F]{6}$/.test(val)) return;   // 올바른 6자리 헥스코드가 아니면 무시
      xf.color[key] = val;
      swatchBtn.style.background = val;
      // ★ meshes는 미리보기 좌석의 메쉬라 여기서 바로 미리보기에 반영됨. 드래그 중 여러 번 호출될 수
      //   있어 화면 갱신은 즉시(가벼움), syncFn 호출은 프레임당 한 번만.
      //   ★ emissive도 함께 갱신 — 이 앱은 emissive(평면 조명)로 실제 화면 색이 결정되기 때문에 color만
      //     바꾸면 미리보기가 원래 색을 유지해 어둡게 보임(요청사항 4번). applyPartXf와 동일 공식 사용.
      meshes.forEach(m=>{
        if(!m.material) return;
        // 🎨 텍스처 파츠는 색조만 회전 (아래 flat 경로와 달리 무늬가 탁해지지 않음)
        if(isHueTintMesh(m)){ applyHueTint(m, val); m.material.needsUpdate = true; return; }
        if(m.material.color) m.material.color.set(val);
        if(m.material.emissive){
          const baseFlat = (m.material.userData && m.material.userData.baseFlat!=null)
            ? m.material.userData.baseFlat
            : (1 - (typeof LIGHT_PRESET()!=='undefined' ? LIGHT_PRESET().e : 0.5));
          m.material.emissive.set(val).multiplyScalar(baseFlat);
        }
        m.material.needsUpdate = true;
      });
      if(_colorSyncRAF) return;
      _colorSyncRAF = requestAnimationFrame(()=>{ _colorSyncRAF=null; syncFn(); });
    };
    hexInput.oninput = ()=> applyColor(hexInput.value);
    // ★ 네이티브 <input type="color">는 이 앱처럼 투명·항상위 Electron 창에서 색상 선택 팝업이
    //   창 뒤로 숨어버리는 알려진 문제가 있어서(브라우저 크롬 레벨 UI라 우리 z-index가 안 먹힘),
    //   완전히 우리 DOM으로 그리는 스와치 팔레트 팝업으로 대체함.
    let paletteEl=null;
    const closePalette=()=>{ if(paletteEl){ paletteEl.remove(); paletteEl=null; document.removeEventListener('mousedown', onOutside, true); } };
    const onOutside=(e)=>{ if(paletteEl && !paletteEl.contains(e.target) && e.target!==swatchBtn) closePalette(); };
    swatchBtn.onclick = ()=>{
      if(paletteEl){ closePalette(); return; }
      // ★ 팝업이 이전 색으로 여는 버그 대응: hex input의 value가 어떤 경로로든 stale해지는
      //   경우가 있어 (rows 재생성 타이밍 등), 저장된 xf.color[key]를 최우선으로 사용.
      //   hex input과 스와치 배경도 방어적으로 실제 저장값에 맞춰 리셋해서 세 표시(스와치·hex·팝업)가
      //   서로 어긋나지 않게 함.
      const savedColor = xf.color[key] || hexInput.value || ('#'+firstOrig);
      if(hexInput.value !== savedColor) hexInput.value = savedColor;
      swatchBtn.style.background = savedColor;
      paletteEl = buildFreeColorPicker(savedColor, (val)=>{ hexInput.value=val; applyColor(val); });
      // ★ colorRow 안(스크롤되는 색상 영역 등)에 그냥 넣으면 조상의 overflow:hidden/auto에 잘려 보이는
      //   문제가 있어서, body에 position:fixed로 붙이고 스와치 위치를 기준으로 좌표를 직접 계산함.
      paletteEl.style.position='fixed';
      const rect=swatchBtn.getBoundingClientRect();
      paletteEl.style.left=rect.left+'px';
      paletteEl.style.top=(rect.bottom+4)+'px';
      paletteEl.style.zIndex='9999';
      document.body.appendChild(paletteEl);
      // 화면 아래로 넘치면 스와치 위쪽에 뜨도록 보정
      requestAnimationFrame(()=>{
        const pRect=paletteEl.getBoundingClientRect();
        if(pRect.bottom>innerHeight) paletteEl.style.top=(rect.top-pRect.height-4)+'px';
        if(pRect.right>innerWidth) paletteEl.style.left=Math.max(4,innerWidth-pRect.width-4)+'px';
      });
      setTimeout(()=>document.addEventListener('mousedown', onOutside, true), 0);
    };
    colorRow.querySelector('.wd-adj-reset').onclick = ()=>{
      delete xf.color[key];
      // ★ 저장해둔 원본 색(userData.origColor)으로 이 그룹의 메쉬들을 직접 복원 — applyPartXf는
      //   xf.color[key]가 없으면 아예 안 건드리는 방식이라(원본을 몰라서), 여기서 명시적으로 되돌림.
      //   emissive도 원본 색 기준으로 재계산.
      meshes.forEach(m=>{
        if(!m.material) return;
        if(isHueTintMesh(m)){ applyHueTint(m, null); m.material.needsUpdate = true; return; }   // 🎨 색조 해제 = 원본 텍스처
        if(!m.userData.origColor) return;
        const hex = '#'+m.userData.origColor;
        if(m.material.color) m.material.color.set(hex);
        if(m.material.emissive){
          const baseFlat = (m.material.userData && m.material.userData.baseFlat!=null)
            ? m.material.userData.baseFlat
            : (1 - (typeof LIGHT_PRESET()!=='undefined' ? LIGHT_PRESET().e : 0.5));
          m.material.emissive.set(hex).multiplyScalar(baseFlat);
        }
        m.material.needsUpdate = true;
      });
      hexInput.value = '#'+firstOrig;
      swatchBtn.style.background = '#'+firstOrig;
      syncFn();
    };
    rows.push(colorRow);
  });
  return rows;
}

let currentWdTab = null;   // 현재 선택된 꾸미기 서브카테고리 탭 — null이면 첫 카테고리로 자동 지정
let currentWdGroup = null; // ★ Phase 2: 현재 선택된 상위 그룹 (head/cloth/deco/hand)

function renderWardrobe(){
  const wrap=document.getElementById('wardrobeContent');
  const tabsWrap=document.getElementById('wardrobeTabs');
  if(!wrap)return;
  // ★ 실제 캐릭터(mySeat.charDef)가 아니라 편집용 임시본(draft) 기준으로 화면을 그림 —
  //   저장 버튼을 누르기 전까지는 진짜 캐릭터에 반영 안 되므로, 카드 선택 표시도 draft를 따라야 함.
  const def=ensureWdDraft();
  const equipped=(def&&def.equippedParts)||{};

  /* 🪑 파츠가 하나도 없어도 «책상» 탭은 열려야 한다 — 전용 책상만 등록된 기기가 있을 수 있다. */
  if(savedParts().length===0 && !isAdmin() && !_wdLicenseDesks().length){
    if(tabsWrap) tabsWrap.innerHTML='';
    wrap.innerHTML='<div class="wd-empty"><span class="ic">🧺</span>아직 등록된 파츠가 없어요.<br>관리자가 모자·안경·옷·헤어·날개·손 파츠를<br>추가하면 여기에 나타나요.</div>';
    return;
  }

  // ★ Phase 2: 상위 그룹(4개) 탭 + 그 아래 하위 카테고리 탭으로 재구성.
  //   기존엔 10개 서브 카테고리를 한 줄에 나열해서 시각적으로 복잡했음.
  /* 🪑 «책상» 은 PART_CATS 에 없는 **가상 탭**이다(WD_DESK_TAB 주석) — 유효성 검사에서 빼 준다.
     안 빼면 그 탭을 고르는 순간 첫 카테고리(모자)로 튕긴다. */
  /* 🐾 동물로 바뀌었는데 귀 탭이면 머리 첫 칸(모자)으로 돌린다 — 동물은 생성기에서 귀를 정한다 */
  if(currentWdTab === wdEar().TAB && !wdEar().available(def)) currentWdTab = (partsInGroup('head')[0] || PART_CATS()[0]).cat;
  if(currentWdTab !== wdEar().TAB && currentWdTab !== WD_DESK_TAB() && (!currentWdTab || !PART_CATS().find(c=>c.cat===currentWdTab))) currentWdTab = PART_CATS()[0].cat;
  currentWdGroup = (currentWdTab === WD_DESK_TAB()) ? 'desk' : (currentWdTab === wdEar().TAB) ? 'head' : (groupOfCat(currentWdTab) || PART_GROUPS()[0].group);

  if(tabsWrap){
    tabsWrap.innerHTML='';
    // 1단계: 상위 그룹 탭
    const groupRow=document.createElement('div'); groupRow.className='wd-group-row';
    PART_GROUPS().forEach(g=>{
      const btn=document.createElement('button');
      btn.className='wd-tab-btn wd-group-btn'+(g.group===currentWdGroup?' on':'');
      btn.textContent=g.icon+' '+g.label;
      btn.onclick=()=>{
        currentWdGroup=g.group;
        // 그룹 바뀌면 그 그룹의 첫 서브카테고리로 자동 이동
        /* 🪑 책상 그룹의 첫 칸은 «책상»(가상 탭)이다 — 시안에서 정한 순서(◉ 책상 · ○ 책상 위). */
        if(g.group === 'desk'){ currentWdTab = WD_DESK_TAB(); }
        else { const firstSub = partsInGroup(g.group)[0]; if(firstSub) currentWdTab = firstSub.cat; }
        activeWdAdj=null; _clearMultiPanelRef();
        renderWardrobe();
      };
      groupRow.appendChild(btn);
    });
    tabsWrap.appendChild(groupRow);
    // 2단계: 하위 카테고리 탭 (선택된 그룹의 하위만)
    const subRow=document.createElement('div'); subRow.className='wd-sub-row';
    if(currentWdGroup === 'desk'){
      /* 🪑 책상 **본체** — 같은 그룹의 «책상 위»(deskitem)와 나란히 서지만 배관이 다르다(WD_DESK_TAB 주석). */
      const dbtn=document.createElement('button');
      dbtn.className='wd-tab-btn wd-sub-btn'+(currentWdTab===WD_DESK_TAB()?' on':'');
      dbtn.textContent='🪑 책상';
      dbtn.onclick=()=>{ currentWdTab=WD_DESK_TAB(); activeWdAdj=null; _clearMultiPanelRef(); renderWardrobe(); };
      subRow.appendChild(dbtn);
    }
    partsInGroup(currentWdGroup).forEach(info=>{
      const btn=document.createElement('button');
      btn.className='wd-tab-btn wd-sub-btn'+(info.cat===currentWdTab?' on':'');
      btn.textContent=info.icon+' '+info.label;
      btn.onclick=()=>{ currentWdTab=info.cat; activeWdAdj=null; _clearMultiPanelRef(); renderWardrobe(); };
      subRow.appendChild(btn);
    });
    /* 🐾 머리 › 귀 — 모자·탈·안경 옆. 동물 캐릭터에는 없다 */
    if(currentWdGroup === 'head' && wdEar().available(def)){
      const ebtn=document.createElement('button');
      ebtn.className='wd-tab-btn wd-sub-btn'+(currentWdTab===wdEar().TAB?' on':'');
      ebtn.textContent='🐾 귀';
      ebtn.onclick=()=>{ currentWdTab=wdEar().TAB; activeWdAdj=null; _clearMultiPanelRef(); renderWardrobe(); };
      subRow.appendChild(ebtn);
    }
    tabsWrap.appendChild(subRow);
  }

  /* 🪑 «책상» 가상 탭 — 파츠 그리드 배관을 타지 않고 여기서 갈라진다(WD_DESK_TAB 주석). */
  /* 🐾 «귀» 가상 탭 — 기즈모·조정할 귀 줄은 updateWdGizmoForActivePanel 이 wd-ear.js 로 넘긴다.
     책상 탭도 같이 맞춘다 — 안 부르면 귀 탭에서 넘어올 때 귀 핸들·줄이 남는다. */
  if(currentWdTab === WD_DESK_TAB() || currentWdTab === wdEar().TAB){
    wrap.innerHTML='';
    if(currentWdTab === WD_DESK_TAB()) renderWdDeskSection(wrap); else wdEar().render(wrap);
    refreshWdPreviewColorSection();
    updateWdGizmoForActivePanel();
    return;
  }
  const info = PART_CATS().find(c=>c.cat===currentWdTab);
  wrap.innerHTML='';
  /* 🎰 가챠 파츠는 여기 안 나온다 — 뽑아서 얻고 [파츠 보관함](T키)에서 착용한다.
     ⚠️ 이건 "내가 가진 것만 보여준다"가 아니다. 그 필터는 기존 유저가 쓰던 파츠를 잃게 만든다.
        여기서 거르는 것은 gacha 플래그가 켜진 파츠뿐이고, 지금 등록된 파츠 중에는 하나도 없다
        (= 기존 유저의 화면은 한 칸도 안 바뀐다). partsInCat 자체는 안 건드린다 —
        관리자 등록 시 카테고리 상한 계산에는 가챠 파츠도 같이 세어야 하기 때문이다. */
  const list=partsInCat(info.cat).filter(p=>!gachaMod().isGachaPart(p));
  const sec=document.createElement('div'); sec.className='wd-cat';
  const head=document.createElement('div'); head.className='wd-cat-head';
  head.innerHTML='<h3>'+info.icon+' '+info.label+'</h3>';  const actions=document.createElement('div'); actions.className='wd-cat-head-actions';
  const addCode=document.createElement('button'); addCode.className='wd-add-code'; addCode.textContent='+ 코드로 추가';
  addCode.title='코드+비밀번호로 받은 커미션 파츠를 이 기기에만 추가해요';
  addCode.onclick=()=>openAssetImport('part', info.cat);
  actions.appendChild(addCode);
  if(isAdmin()){
    const add=document.createElement('button'); add.className='wd-add'; add.textContent='+ 등록';
    add.onclick=()=>adminPartReg().openPartRegister(info.cat);
    actions.appendChild(add);
  }
  head.appendChild(actions);
  sec.appendChild(head);
  /* 🎰 이 카테고리의 가챠 파츠가 몇 개인지 관리자에게 알린다.
     [왜] 가챠 파츠는 여기서 통째로 걸러지는데(위 필터), 화면에는 아무 흔적도 안 남아서
       "등록했는데 안 보인다" 또는 반대로 "가챠로 등록한 줄 알았는데 여기 있다"를 구분할 수가 없다.
       숫자를 적어두면 🎰 체크를 빠뜨린 사고가 그 자리에서 드러난다. */
  if(isAdmin()){
    const gcnt = partsInCatFor(info.cat, true).length;
    if(gcnt){
      const note=document.createElement('div');
      note.style.cssText='font-size:10px;color:var(--ink-soft);opacity:.85;margin:-2px 2px 6px;';
      note.textContent='🎰 가챠 전용 '+gcnt+'개는 여기 안 보여요 — 파츠 보관함(T)에서 관리해요';
      sec.appendChild(note);
    }
  }
  if(list.length===0 && !isAdmin()){
    const empty=document.createElement('div'); empty.className='wd-empty';
    empty.innerHTML='<span class="ic">'+info.icon+'</span>아직 등록된 '+info.label+' 파츠가 없어요.';
    sec.appendChild(empty);
    wrap.appendChild(sec);
    return;
  }
  // ★ Phase 2: charType 기준으로 두 섹션으로 나눔 (기본 캐릭터 / 커미션 전용).
  //   각 섹션은 자체 그리드 + 구분선을 가짐. "안 함" 카드는 첫 섹션(기본)에만 표시.
  const defaultList = list.filter(r=>r.charType!=='commission');
  const commissionList = list.filter(r=>r.charType==='commission');

  const renderPartCard = (rec, grid)=>{
    // 🔗 stackable: 카테고리가 배열(다중 착용)이면 원소 중 id 매칭, 단일이면 기존 방식
    const equippedInCat = equipped[info.cat];
    const isEquipped = Array.isArray(equippedInCat)
      ? equippedInCat.some(e => partEntryId(e) === rec.id)
      : partEntryId(equippedInCat) === rec.id;
    const card=document.createElement('div'); card.className='wd-card'+(isEquipped?' on':'');
    // Phase 4: 도트 썸네일이 있으면 img로, 없으면 이모지 아이콘 사용
    const _thumbSrc = rec.thumbUrl || rec.thumbnail;   // Storage URL 우선, 구버전 base64도 지원
    /* 🛡️ 파츠 이름·썸네일 주소는 이스케이프한다(보안 핸드오프 2-4 의 🟡 자리). 지금은 관리자가
         발행한 값이지만 이름이 **파일명 유래**라 `"` 나 `&` 가 섞일 수 있고, 그 한 글자가
         `src=` 속성을 빠져나온다. 값의 출처를 믿는 것보다 여기서 막는 편이 싸다. */
    const thumbHtml = _thumbSrc
      ? '<img class="wd-thumb" src="'+escHtml(_thumbSrc)+'" alt="">'
      : '<span>'+escHtml(rec.icon||info.icon)+'</span>';
    card.innerHTML = thumbHtml + '<span class="nm">'+escHtml(rec.name||'파츠')+'</span>';
    // 🔗 다른 파츠와 함께 착용 가능한 파츠는 우상단에 뱃지 표시
    if(rec.stackable){
      const stackBadge = document.createElement('div');
      stackBadge.className = 'wd-card-stack-badge';
      stackBadge.textContent = '🔗';
      stackBadge.title = '다른 파츠와 함께 착용 가능';
      card.appendChild(stackBadge);
    }
    card.onclick=()=>toggleEquip(info.cat,rec.id);
    card.oncontextmenu=e=>{
      e.preventDefault();
      if(!isEquipped) { toast('먼저 파츠를 착용해 주세요'); return; }
      if(activeWdAdj && activeWdAdj.id===rec.id) { activeWdAdj = null; _clearMultiPanelRef(); }
      else activeWdAdj = {cat: info.cat, id: rec.id};
      renderWardrobe();
    };
    if(isAdmin()){
      const x=document.createElement('div'); x.className='wd-card-x'; x.textContent='×';
      x.onclick=ev=>{ ev.stopPropagation(); activeWdAdj=null; adminPartReg().deletePart(rec.id); };
      card.appendChild(x);
      card.ondblclick=ev=>{ ev.stopPropagation(); adminPartReg().openPartRegister(info.cat, rec); };
      const handle=document.createElement('div'); handle.className='wd-card-drag'; handle.textContent='☰';
      handle.title='드래그해서 순서 바꾸기';
      card.appendChild(handle);
      card.dataset.reorderId = rec.id;
      bindReorderHandle(handle, card, rec.id, (draggedId, targetId)=>reorderSavedPart(draggedId, targetId, info.cat));
    }
    grid.appendChild(card);
    if(activeWdAdj && activeWdAdj.id === rec.id) {
      grid.appendChild(createWardrobeAdjPanel(info.cat, rec.id));
    }
  };

  // 섹션 1 — 기본 캐릭터
  if(defaultList.length || !isAdmin()){
    const dv=document.createElement('div'); dv.className='wd-divider';
    dv.innerHTML='<span>기본 캐릭터</span><div class="wd-divider-line"></div>';
    sec.appendChild(dv);
    const grid=document.createElement('div'); grid.className='wd-grid';
    /* 🎰 [안 함] 의 선택 표시는 **꾸미기 파츠만** 본다. 가챠 파츠는 이 창에 안 보이므로,
       보관함에서 착용한 파츠 하나 때문에 [안 함] 이 안 켜지면 "안 함을 눌렀는데 표시가 안 된다" 가 된다.
       (toggleEquip 의 [안 함] 처리와 판정 기준을 반드시 같이 맞춰야 한다 — 조회 실패는 '가챠로 취급'.) */
    const _wornWardrobe = entriesForCat(def, info.cat).some(e=>{
      const eid = partEntryId(e); if(!eid) return false;
      const eRec = savedParts().find(p=>p.id===eid);
      return !!eRec && !gachaMod().isGachaPart(eRec);
    });
    const noneCard=document.createElement('div'); noneCard.className='wd-card none-card'+(!_wornWardrobe?' on':'');
    noneCard.textContent='안 함';
    noneCard.onclick=()=>{ activeWdAdj=null; _clearMultiPanelRef(); toggleEquip(info.cat,null); };
    grid.appendChild(noneCard);
    defaultList.forEach(rec=>renderPartCard(rec, grid));
    sec.appendChild(grid);
  }

  // 섹션 2 — 커미션 전용 (있을 때만 표시)
  if(commissionList.length){
    const dv=document.createElement('div'); dv.className='wd-divider';
    dv.innerHTML='<span>커미션 전용</span><span class="wd-divider-badge">🔒</span><div class="wd-divider-line"></div>';
    sec.appendChild(dv);
    const grid=document.createElement('div'); grid.className='wd-grid';
    commissionList.forEach(rec=>renderPartCard(rec, grid));
    sec.appendChild(grid);
  }

  wrap.appendChild(sec);
  refreshWdPreviewColorSection();
  updateWdGizmoForActivePanel();
}

/* 파츠 착용/해제 — 즉시 def 갱신 + 좌석 반영 + 저장
   ★ def.partXfMemory: 카테고리별로 하나만 남는 equippedParts와 별개로, "파츠 id별 마지막 조정값"을 따로 기억.
   안함으로 껐다가 같은 파츠를 다시 켜도 예전에 맞춰둔 크기/회전/위치가 그대로 돌아오게 하기 위함
   (예전엔 equippedParts[cat]을 통째로 delete해서 xf가 같이 날아갔음). */
async function toggleEquip(cat, id){
  // ★ 요청사항: 여기서 하는 조정은 미리보기에만 즉시 보이고, 실제 실행 중인 캐릭터(mySeat)는
  //   미리보기의 "저장" 버튼을 눌러야 반영됨 — 그래서 mySeat이 아니라 draft/미리보기 좌석을 건드림.
  const def=ensureWdDraft();
  if(!def){ toast('먼저 캐릭터를 만들어 주세요'); return; }
  def.equippedParts = def.equippedParts || {};
  def.partXfMemory = def.partXfMemory || {};
  ensureWdPreview();
  if(!wdPreviewBase || wdPreviewBase.charDef!==def){ await refreshWdPreviewChar(); }   // 미리보기가 아직 없으면 먼저 만들어둠(장착 대상 좌석 필요)
  const previewSeat = wdPreviewBase;
  if(!id){
    /* [안 함] — 이 카테고리의 **꾸미기 파츠만** 정리한다. 🎰 가챠 파츠는 남긴다.
       [경위] 예전엔 delete def.equippedParts[cat] + unequipPartFromSeat(.., true) 로 카테고리를
         통째로 비웠다. 가챠 파츠는 stackable 강제라 같은 카테고리 컨테이너에 들어가므로,
         보관함(T)에서 착용한 파츠가 꾸미기 창의 [안 함] 한 번에 같이 벗겨졌다(제보).
         꾸미기 창은 애초에 가챠 파츠를 한 칸도 안 보여주므로(renderWardrobe 의 !isGachaPart 필터),
         여기서 벗기는 것은 유저가 보고 있지도 않은 것을 건드리는 셈이다.
       ⚠️ savedParts 조회 실패는 '남긴다'로 떨어뜨린다 — 카탈로그 동기화 직전에 조회가 빈 경우
         '가챠 아님'으로 단정하면 착용 파츠를 지우는 사고가 된다(pruneSeatPartsAgainstDef 가 그랬다).
         못 지우면 유저가 한 번 더 누르면 되지만, 지워버린 것은 되돌릴 방법이 없다. */
    const _drop = [], _keep = [];
    entriesForCat(def, cat).forEach(e => {
      const eid = partEntryId(e); if(!eid) return;
      const eRec = savedParts().find(p => p.id === eid);
      if(!eRec || gachaMod().isGachaPart(eRec)) _keep.push(eid);   // 가챠 · 조회 실패 → 유지
      else _drop.push({ id:eid, xf:partEntryXf(e), stackable:!!eRec.stackable });
    });
    _drop.forEach(d => {
      def.partXfMemory[cat+':'+d.id] = d.xf;
      removeEntryFromCat(def, cat, d.id);
      if(!previewSeat) return;
      if(d.stackable){
        unequipStackablePart(previewSeat, cat, d.id);
      } else {
        // ★ includeStackable=false — 로딩 중인 가챠 파츠의 대기표까지 무효화하면 안 된다.
        _invalidatePendingEquip(previewSeat, cat, null, false);
        if(previewSeat.equippedPartObjs && previewSeat.equippedPartObjs[cat]){
          _disposeWrapperFromSeat(previewSeat, previewSeat.equippedPartObjs[cat]);
          delete previewSeat.equippedPartObjs[cat];
        }
      }
    });
    if(!_keep.length) delete def.equippedParts[cat];   // 남는 게 없으면 키까지 지운다(기존과 동일)
    if(previewSeat){
      _sweepOrphanPartWrappers(previewSeat);   // 등록 안 된 채 남은 wrapper 정리(기존 경로가 하던 몫)
      applyClothVisibility(previewSeat);
    }
  } else {
    const rec=savedParts().find(p=>p.id===id&&p.cat===cat);
    if(!rec)return;
    const alreadyEquipped = findEntryById(def, cat, id);
    if(alreadyEquipped){
      // 이미 착용 중이면 그 파츠만 해제 (stackable/non-stackable 동일)
      def.partXfMemory[cat+':'+id] = partEntryXf(alreadyEquipped);
      removeEntryFromCat(def, cat, id);
      if(previewSeat){
        if(rec.stackable){
          unequipStackablePart(previewSeat, cat, id);
        } else {
          // non-stackable 파츠만 제거, stackable 파츠는 유지
          // ★ 아래 가드는 wrapper가 있을 때만 도는데, 로딩 중이면 wrapper가 없다 — 무효화는 가드 밖에서.
          _invalidatePendingEquip(previewSeat, cat, null, false);
          if(previewSeat.equippedPartObjs && previewSeat.equippedPartObjs[cat]){
            _disposeWrapperFromSeat(previewSeat, previewSeat.equippedPartObjs[cat]);
            delete previewSeat.equippedPartObjs[cat];
          }
        }
      }
      if(previewSeat) applyClothVisibility(previewSeat);
    } else {
      // 새로 착용 — xf 계산: partXfMemory 우선, 없으면 rec.defaultXf, 없으면 기본
      const remembered = def.partXfMemory[cat+':'+id];
      const partDefault = rec.defaultXf ? JSON.parse(JSON.stringify(rec.defaultXf)) : null;
      const xf = remembered || partDefault || defaultPartXf();
      if(rec.stackable){
        // 🔗 stackable: 배열에 추가 (기존 파츠들 그대로)
        addEntryToCat(def, cat, {id, xf});
        if(previewSeat) await equipPartOnSeat(previewSeat, cat, rec, { stackableXf: xf });
      } else {
        // non-stackable: 이 카테고리의 기존 non-stackable 파츠 하나만 교체.
        //   stackable 파츠들은 유지. def에서도 non-stackable만 찾아서 제거.
        const currentEntries = entriesForCat(def, cat);
        const oldNonStackable = currentEntries.find(e => {
          const eid = partEntryId(e);
          const eRec = savedParts().find(p => p.id === eid);
          return eRec && !eRec.stackable;
        });
        if(oldNonStackable){
          const oldId = partEntryId(oldNonStackable);
          def.partXfMemory[cat+':'+oldId] = partEntryXf(oldNonStackable);
          removeEntryFromCat(def, cat, oldId);
        }
        addEntryToCat(def, cat, {id, xf});
        if(previewSeat) await equipPartOnSeat(previewSeat, cat, rec);   // non-stackable 모드
      }
    }
  }
  renderWardrobe();
}

return {
  ORBIT_DRAG_DIR,
  _clearMultiPanelRef,
  _wdAfterMainSwap,
  activeWdAdj: ()=>activeWdAdj,   // 읽는 함수
  setActiveWdAdj: (v)=>{ activeWdAdj = v; },   // 쓰는 함수 — app.js 가 비운다
  buildFreeColorPicker,
  clampWdPreviewIntoView,
  commitWdDraft,
  createWardrobeAdjPanel,
  currentWdTab: ()=>currentWdTab,   // 읽는 함수
  detachWdGizmo,
  ensureWdDraft,
  ensureWdGizmo,
  placeWdPreview,
  refreshWdPreviewChar,
  refreshWdPreviewColorSection,
  renderWardrobe,
  setWdGizmoMode,
  sizeWdPreview,
  syncWdGizmoToXf,
  syncWdPreviewOwner,
  toggleEquip,
  updateWdCam,
  updateWdGizmoForActivePanel,
  wdCam: ()=>wdCam,   // 읽는 함수
  wdDraftDef: ()=>wdDraftDef,   // 읽는 함수
  wdGizmo: ()=>wdGizmo,   // 읽는 함수
  wdGizmoMode: ()=>wdGizmoMode,   // 읽는 함수
  wdPreviewBase: ()=>wdPreviewBase,   // 읽는 함수
  wdPreviewSavedPos,
  wdScene: ()=>wdScene,   // 읽는 함수
};
}

const api = { createWardrobe };
if(typeof window !== 'undefined') window.TwWardrobe = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
