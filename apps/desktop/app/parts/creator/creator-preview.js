/* creator-preview.js — 🧍 생성기 미리보기 — 렌더러 · 카메라 · 크기 맞춤 · 베이스 갈아끼우기 · 조명
   app.js «🧍 생성기 미리보기» 구역의 3D 쪽(렌더러 · 카메라 · fitCreator · 베이스 교체 · 책상 아이템 떼기)과 «💡 생성기 조명»을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   생성기 상태(cBase · cScene · cCam · 카메라 각도 …)는 생성기 묶음 전체(그리기 · 책상 · 기즈모 · animal.js)가 같이 쓰므로 app.js 에 남기고 읽는 · 쓰는 함수로 받는다.
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 111줄 —
     BASE_SCENE · FOCUS_ARM_LIFT · HAND_REST · cAmb · cBase · cBodyDist · cBotColor · cCam · cDesk · cDeskColor · cDeskMat · cFaceDist · cFill · cFloor · cKey · cRenderer · cScene · cTopColor · cXform · camDist · camPitch · camYaw · crStep · creatorOpen · deskCamSaved · faceCamSaved · skinIndex 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCAmb · setCBase · setCBodyDist · setCCam · setCDesk · setCDeskMat · setCFaceDist · setCFill · setCFloor · setCKey · setCRenderer · setCScene · setCamDist · setCamPitch · setCamYaw · setDeskCamSaved · setFaceCamSaved(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 23개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: RIG_TURN · applyCreatorXform · applyStaticHandRest · clearCreatorItems · clearCreatorParts · clearHolderDeskItems · crFlatView · creatorLoop · ensureCreatorPreview · fitCreator · frameDeskCam · swapCreatorBaseToAnimal · swapCreatorBaseToCommission · swapCreatorBaseToDefault · updateCreatorCam · updateCreatorLights — app.js 는 creatorPrevMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCreatorPreview — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-creator-preview.js */
(function(){

function createCreatorPreview(deps){
const ANIMAL_HAND_REST = deps.ANIMAL_HAND_REST;
const BASE_SCENE = deps.BASE_SCENE;   // 읽는 함수
const CHAR_Z = deps.CHAR_Z;
const COMMISSION_SCALE_CORRECTION = deps.COMMISSION_SCALE_CORRECTION;
const CREATOR_LIGHT_SL = deps.CREATOR_LIGHT_SL;   // 생성기 빛 채도 · 명도(코어 — 웹 생성기와 같다)
const FLAT_EMISSIVE = deps.FLAT_EMISSIVE;
const FOCUS_ARM_LIFT = deps.FOCUS_ARM_LIFT;   // 읽는 함수
const HAND_REST = deps.HAND_REST;   // 읽는 함수
const LIGHT_PRESET = deps.LIGHT_PRESET;
const M = deps.M;
const _FILL_LIGHT_MUL = deps._FILL_LIGHT_MUL;
const _KEY_LIGHT_MUL = deps._KEY_LIGHT_MUL;
const _setDeskMatColor = deps._setDeskMatColor;
const _sweepOrphanPartWrappers = deps._sweepOrphanPartWrappers;
const allDeskItems = deps.allDeskItems;
const bindPaint = deps.bindPaint;
const boneSide = deps.boneSide;
const buildCreatorBase = deps.buildCreatorBase;
const buildDesk = deps.buildDesk;
const cAmb = deps.cAmb;   // 읽는 함수
const cBase = deps.cBase;   // 읽는 함수
const cBodyCenter = deps.cBodyCenter;
const cBodyDist = deps.cBodyDist;   // 읽는 함수
const cBotColor = deps.cBotColor;   // 읽는 함수
const cCam = deps.cCam;   // 읽는 함수
const cDesk = deps.cDesk;   // 읽는 함수
const cDeskColor = deps.cDeskColor;   // 읽는 함수
const cDeskMat = deps.cDeskMat;   // 읽는 함수
const cFaceCenter = deps.cFaceCenter;
const cFaceDist = deps.cFaceDist;   // 읽는 함수
const cFill = deps.cFill;   // 읽는 함수
const cFloor = deps.cFloor;   // 읽는 함수
const cKey = deps.cKey;   // 읽는 함수
const cRenderer = deps.cRenderer;   // 읽는 함수
const cScene = deps.cScene;   // 읽는 함수
const cTopColor = deps.cTopColor;   // 읽는 함수
const cXform = deps.cXform;   // 읽는 함수
const camDist = deps.camDist;   // 읽는 함수
const camPitch = deps.camPitch;   // 읽는 함수
const camTarget = deps.camTarget;
const camYaw = deps.camYaw;   // 읽는 함수
const charFootFix = deps.charFootFix;
const clampCharY = deps.clampCharY;
const compositeFace = deps.compositeFace;
const crStep = deps.crStep;   // 읽는 함수
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const deskCamSaved = deps.deskCamSaved;   // 읽는 함수
const deskItemOrigin = deps.deskItemOrigin;
const dispTex = deps.dispTex;
const equipDeskItem = deps.equipDeskItem;
const extractBonesInto = deps.extractBonesInto;
const faceCamSaved = deps.faceCamSaved;   // 읽는 함수
const getCommissionScene = deps.getCommissionScene;
const instantiateBase = deps.instantiateBase;
const isAnimalEditing = deps.isAnimalEditing;
const isCommissionEditing = deps.isCommissionEditing;
const matToneMod = deps.matToneMod;
const measureCharBox = deps.measureCharBox;
const measureUnderfootDepth = deps.measureUnderfootDepth;
const mkFaceTex = deps.mkFaceTex;
const normalizeModel = deps.normalizeModel;
const sizeFloorTo = deps.sizeFloorTo;
const skinColorFor = deps.skinColorFor;
const skinIndex = deps.skinIndex;   // 읽는 함수
const toast = deps.toast;
const setCAmb = deps.setCAmb;   // 쓰는 함수
const setCBase = deps.setCBase;   // 쓰는 함수
const setCBodyDist = deps.setCBodyDist;   // 쓰는 함수
const setCCam = deps.setCCam;   // 쓰는 함수
const setCDesk = deps.setCDesk;   // 쓰는 함수
const setCDeskMat = deps.setCDeskMat;   // 쓰는 함수
const setCFaceDist = deps.setCFaceDist;   // 쓰는 함수
const setCFill = deps.setCFill;   // 쓰는 함수
const setCFloor = deps.setCFloor;   // 쓰는 함수
const setCKey = deps.setCKey;   // 쓰는 함수
const setCRenderer = deps.setCRenderer;   // 쓰는 함수
const setCScene = deps.setCScene;   // 쓰는 함수
const setCamDist = deps.setCamDist;   // 쓰는 함수
const setCamPitch = deps.setCamPitch;   // 쓰는 함수
const setCamYaw = deps.setCamYaw;   // 쓰는 함수
const setDeskCamSaved = deps.setDeskCamSaved;   // 쓰는 함수
const setFaceCamSaved = deps.setFaceCamSaved;   // 쓰는 함수
/* 💡 표정 그리기 «원색 보기» 버튼(미리보기 오른쪽 아래). 모듈이 없어도 생성기는 그대로 돈다. */
const crFlatView = (typeof CreatorFlatView === 'undefined') ? null : CreatorFlatView.createCreatorFlatView({
  btn: document.getElementById('cpFlat'), badge: document.getElementById('cpFlatBadge'),
  onChange: ()=>updateCreatorLights()
});
if(crFlatView) document.getElementById('cpFlat').addEventListener('click', ()=>crFlatView.toggle());
function updateCreatorLights(){ if(!cAmb()||!cKey())return;
  const b=LIGHT_PRESET.b, h=LIGHT_PRESET.h, e=LIGHT_PRESET.e;
  cAmb().intensity=0.95*b*e; cKey().intensity=1.0*b*e*_KEY_LIGHT_MUL;   // 밝기(strength) × 노출(조명 페이드) · 키는 정수리 배율까지
  if(cFill()) cFill().intensity=1.0*b*e*_FILL_LIGHT_MUL;                // 정면 필 — 실행 화면과 같은 몫
  const col=new THREE.Color().setHSL(h,CREATOR_LIGHT_SL.s,CREATOR_LIGHT_SL.l);   // 색상(color)
  cKey().color.copy(col); cAmb().color.copy(col); if(cFill()) cFill().color.copy(col);
  /* 💡 원색 보기 — 방향광을 끄고 흰빛 앰비언트 + emissive 합을 1 로. 칠한 색이 그대로 보인다(creator-flat-view.js). */
  if(crFlatView && crFlatView.isOn()){
    cAmb().intensity=CreatorFlatView.flatAmbient(FLAT_EMISSIVE); cAmb().color.setRGB(1,1,1);
    cKey().intensity=0; if(cFill()) cFill().intensity=0;
  }
  const flat=FLAT_EMISSIVE;                                  // 플랫 조명 배율(전역 손잡이)
  if(cBase()){
    if(cBase().faceMat){ if(cBase().faceMat.emissiveMap!==cBase().faceMat.map){cBase().faceMat.emissiveMap=cBase().faceMat.map;cBase().faceMat.needsUpdate=true;} cBase().faceMat.emissive.setScalar(flat); }
    if(cBase().upMat){ if(cBase().upMat.map&&cBase().upMat.emissiveMap!==cBase().upMat.map){cBase().upMat.emissiveMap=cBase().upMat.map;cBase().upMat.needsUpdate=true;} cBase().upMat.emissive.copy(cBase().upMat.color).multiplyScalar(flat); }
    if(cBase().loMat){ if(cBase().loMat.map&&cBase().loMat.emissiveMap!==cBase().loMat.map){cBase().loMat.emissiveMap=cBase().loMat.map;cBase().loMat.needsUpdate=true;} cBase().loMat.emissive.copy(cBase().loMat.color).multiplyScalar(flat); }
    if(cBase().hatMat){ if(cBase().hatMat.map&&cBase().hatMat.emissiveMap!==cBase().hatMat.map){cBase().hatMat.emissiveMap=cBase().hatMat.map;cBase().hatMat.needsUpdate=true;} cBase().hatMat.emissive.copy(cBase().hatMat.color).multiplyScalar(flat); }
  }
}

/* --- 생성기 미리보기 렌더러 --- */
function updateCreatorCam(){if(!cCam())return;
  cCam().position.set(camTarget.x+camDist()*Math.sin(camYaw())*Math.cos(camPitch()),
                    camTarget.y+camDist()*Math.sin(camPitch()),
                    camTarget.z+camDist()*Math.cos(camYaw())*Math.cos(camPitch()));
  cCam().lookAt(camTarget);
  if(crStep()<=3){ setFaceCamSaved({target:camTarget.clone(),dist:camDist(),yaw:camYaw(),pitch:camPitch()}); }   // 1~3단계 각도 기억
  else if(crStep()>=5){ setDeskCamSaved({target:camTarget.clone(),dist:camDist(),yaw:camYaw(),pitch:camPitch()}); }  // 5~6단계 각도 기억
}
// 미리보기용 static 모델에 HAND_REST 각도를 즉시 적용해주는 헬퍼 함수입니다.
function applyStaticHandRest(root, isAnimal, typing) {
  if(!root) return;
  let handL = null, handR = null;
  
  // 메인 화면과 정확히 똑같은 뼈(왼팔, 오른팔) 딱 2개만 찾아냅니다.
  root.traverse(o => {
    if (o.isBone) {
      const n = o.name.toLowerCase();
      if (n.includes('hand') || n.includes('arm')) {
        const s = boneSide(n);
        if (s === 'l' && !handL) handL = o;
        if (s === 'r' && !handR) handR = o;
      }
    }
  });

  // 🐾 동물은 hand 본 rest 자세가 달라 전용 값(ANIMAL_HAND_REST) — 인간 값을 주면 만세 자세가 된다.
  // 🐾 typing=true 면 실행 화면의 타이핑 자세(+ FOCUS_ARM_LIFT)로 — 책상 · 좌석 세팅은 «책상 앞에 앉은 모습»을 보는 곳이다.
  const _restRot = isAnimal ? ANIMAL_HAND_REST : HAND_REST();
  const _liftRot = typing ? FOCUS_ARM_LIFT() : 0;
  const _be = new THREE.Euler(_restRot + _liftRot, 0, 0, 'XYZ');
  const _bq = new THREE.Quaternion().setFromEuler(_be);
  if (handL) handL.quaternion.multiply(_bq);
  if (handR) handR.quaternion.multiply(_bq);
}
function ensureCreatorPreview(){
  if(cRenderer())return;
  setCRenderer(new THREE.WebGLRenderer({canvas:document.getElementById('creatorPreview'),antialias:true,alpha:true,preserveDrawingBuffer:true}));
  cRenderer().setPixelRatio(Math.min(devicePixelRatio,2));cRenderer().outputEncoding=THREE.sRGBEncoding;cRenderer().toneMapping=THREE.NoToneMapping;cRenderer().setSize(222,300,false);
  setCScene(new THREE.Scene());setCAmb(new THREE.AmbientLight(0xfdfbf7,0.95));cScene().add(cAmb());   // 색 왜곡 방지 위해 거의 백색광
  setCKey(new THREE.DirectionalLight(0xfdfaf5,1.0));cKey().position.set(0,4,0);cScene().add(cKey());
  /* ★ 정면 필 — 실행 화면과 같은 배치. 없으면 생성기에서는 옷 앞면이 앰비언트만 받아
     실행 화면보다 어둡게 보인다(두 화면의 톤이 갈라지는 자리다). 세기는 updateCreatorLights 가 정한다. */
  setCFill(new THREE.DirectionalLight(0xfdfaf5,1.0));cFill().position.set(0.5,1.0,3);cScene().add(cFill());
  setCCam(new THREE.PerspectiveCamera(34,222/300,0.1,100));
  const inst=instantiateBase();
  if(inst){ matToneMod.setFaceMap(inst.faceMat, dispTex);
    if(inst.upMat)inst.upMat.color.set(cTopColor()); if(inst.loMat)inst.loMat.color.set(cBotColor());
    if(inst.hatMat)inst.hatMat.color.set(cTopColor());   // 🎩 기본 모자도 상의색
    applyStaticHandRest(inst.root); // 생성창 기본 프리뷰에 팔 높이 반영
    normalizeModel(inst.root,1.45); cScene().add(inst.root);
    setCBase({group:inst.root,faceMat:inst.faceMat,upMat:inst.upMat,loMat:inst.loMat,hatMat:inst.hatMat,face:inst.faceMesh,
      // ★ applyClothVisibility가 파츠 장착 시 기본 메쉬(모자 등)를 숨길 수 있게 좌석과 동일한 참조 세트 유지
      upMesh:inst.upMesh||null,loMesh:inst.loMesh||null,glassesMesh:inst.glassesMesh||null,hatMesh:inst.hatMesh||null,
      maskMesh:inst.maskMesh||null,onepieceMesh:inst.onepieceMesh||null,wingMesh:inst.wingMesh||null,
      handLMesh:inst.handLMesh||null,handRMesh:inst.handRMesh||null,capeMesh:inst.capeMesh||null});
    extractBonesInto(cBase(), inst.root);   // 꾸미기 파츠를 붙일 본(부착점) 정보 채워넣기 — 캐릭터 세팅 미리보기에도 파츠가 보이게
    const fg=inst.faceMesh.geometry;
    cBase().facePos=fg.attributes.position.array; cBase().faceUv=fg.attributes.uv?fg.attributes.uv.array:null;
    cBase().faceIdx=fg.index?fg.index.array:null;
    fg.computeBoundingBox(); cBase().faceCx=(fg.boundingBox.min.x+fg.boundingBox.max.x)/2;
    cBase().equipped={hair:null,accessory:null,clothes:null}; cBase().equippedId={hair:null,accessory:null,clothes:null};
    // 미리보기 책상 (앱과 동일 위치 — 소품을 올려놓는 곳)
    setCDesk(buildDesk(true)); cScene().add(cDesk()); cDesk().visible=false;
const cFloorGeo = new THREE.BoxGeometry(1, 1, 1);
    cFloorGeo.translate(0, -0.5, 0); // 윗면 중앙 피벗
    setCFloor(new THREE.Mesh(cFloorGeo, M(0xcdb88f,0.95)));   // 앱과 동일한 받침대
    cFloor().scale.set(2.4,0.125,2.2); cFloor().position.set(0,0,0.0); cFloor().visible=false; cScene().add(cFloor());
    const dt=cDesk().getObjectByName('deskTop'); if(dt){ dt.material=dt.material.clone(); setCDeskMat(dt.material); _setDeskMatColor(cDeskMat(), cDeskColor()); }
    cBase().deskAnchor=cDesk().userData.deskAnchor; cBase().deskItems={}; cBase().activeDeskItem=null;
    fitCreator('edit');   // 편집 포즈 기준으로 카메라 중심 계산
    const fb=new THREE.Box3().setFromObject(inst.faceMesh), fs=fb.getSize(new THREE.Vector3());
    fb.getCenter(cFaceCenter);
    cFaceCenter.y += 0.12;   // ▲ 한 칸만큼 시선 높임 (얼굴이 화면에 자연스럽게 자리)
    { const fovV=cCam().fov*Math.PI/180, aspect=222/300;
      const dV=(fs.y/2)/Math.tan(fovV/2), dH=(fs.x/2)/Math.tan(Math.atan(Math.tan(fovV/2)*aspect));
      setCFaceDist(Math.max(dV,dH)*0.63 + fs.z*0.5 + 0.10); }   // 얼굴만 확대 (피부/표정/감은눈 단계, 측정 기반)
    const bb=new THREE.Box3().setFromObject(inst.root), bs=bb.getSize(new THREE.Vector3());
    bb.getCenter(cBodyCenter); setCBodyDist(Math.max(bs.x,bs.y)*1.7+0.3);
  } else {
    setCBase(buildCreatorBase(dispTex,dispTex,skinColorFor(skinIndex()),cTopColor(),cBotColor()));cScene().add(cBase().group);
    cFaceCenter.set(0,1.32,0);setCFaceDist(1.15);cBodyCenter.set(0,0.85,0);setCBodyDist(3.9);
  }
  updateCreatorCam();
  updateCreatorLights();   // 미리보기가 열리는 순간 emissive 톤 즉시 반영(1~3단계에서도 적용)
  bindPaint();
}
function creatorLoop(){if(!creatorOpen())return;cRenderer().render(cScene(),cCam());requestAnimationFrame(creatorLoop);}
const RIG_TURN=-0.28;   // 앱 좌석이 매 프레임 적용하는 기본 바라보는 각도 (미리보기도 동일하게)
function fitCreator(mode){ if(!cBase()||!cBase().group)return; const g=cBase().group;
  // ★ 커미션 캐릭터는 COMMISSION_SCALE_CORRECTION 만큼 더 키운다 — 아래 두 분기 모두.
  const commCorr = isCommissionEditing() ? COMMISSION_SCALE_CORRECTION : 1;
  if(mode==='edit'){
    g.scale.set(1,1,1); g.position.set(0,0,0); g.rotation.set(0,0,0); g.updateWorldMatrix(true,true);
    let refBox=measureCharBox(g); if(refBox.isEmpty())return;
    let refSize=refBox.getSize(new THREE.Vector3());
    const s=(refSize.y>1e-4?1.5/refSize.y:1)*commCorr; g.scale.setScalar(s); g.updateWorldMatrix(true,true);
    let b2=measureCharBox(g); const c=b2.getCenter(new THREE.Vector3());
    // 모델 원점(Y=0)을 살립니다.
    /* 🪑 앞뒤(z)는 fitModel 과 같은 규약(재센터링 -c.z 없음) — ⚠️ 바꿀 때는 fitModel 의 같은 줄과 함께. */
    g.position.x+=(0-c.x); g.position.y = charFootFix(b2);   // 🦶 피봇 보정 — fitModel 과 짝(charFootFix 주석)
    // 🦶 바닥 맞춤 — 실행 화면(fitModel)과 같은 보정이어야 한다(한쪽만 넣으면 발밑 파츠 깊이만큼 어긋난다).
    g.position.y += measureUnderfootDepth(g);
  } else {
    g.scale.set(1,1,1); g.position.set(0,0,0); g.rotation.set(0,RIG_TURN+cXform().rot,0); g.updateWorldMatrix(true,true);
    let refBox=measureCharBox(g); if(refBox.isEmpty())return;
    let refSize=refBox.getSize(new THREE.Vector3());
    // 🐾 동물은 측정 대신 확정 공식(animNormScale × 1.45/animNormH × cXform.s) — 측정은 귀 부착 타이밍에 따라 흔들려 책상 비율이 달라졌다.
    //   기록이 없으면(옛 경로) 측정으로 폴백 · 인간 · 커미션은 측정.
    const _anS = (isAnimalEditing() && g.userData && g.userData.animNormScale && g.userData.animNormH)
      ? g.userData.animNormScale * (1.45 / g.userData.animNormH) * cXform().s
      : null;
    const s = (_anS != null) ? _anS : (refSize.y>1e-4?1.45/refSize.y:1)*cXform().s*commCorr;
    g.scale.setScalar(s); g.updateWorldMatrix(true,true);
    let b2=measureCharBox(g); const c=b2.getCenter(new THREE.Vector3());
    // 모델 원점(Y=0)을 살립니다.
    /* 🪑 앞뒤(z)는 fitModel 과 같은 규약(재센터링 -c.z 없음) — ⚠️ 바꿀 때는 fitModel 의 같은 줄과 함께. */
    g.position.x+=(0-c.x);
    /* 🧍 높이(y) — 앞뒤 슬라이더를 대체한 값. 여기가 세 화면(생성기·꾸미기 미리보기·실행)의 기준이다.
       ⚠️ g.scale 에 안 물린 절대값이다 — fitModel 이 _uz 로 나누는 이유가 이것이다.
       🚫 앞뒤(cXform.z)는 폐기 — CHAR_Z(책상과의 기본 간격)만 남는다. 옛 저장값은 로드 때 0 으로 죽는다. */
    g.position.y = clampCharY(cXform().y) + charFootFix(b2); g.position.z+=CHAR_Z;   // 🦶 피봇 보정 — fitModel 과 짝
    g.position.y += measureUnderfootDepth(g);   // 🦶 바닥 맞춤 — 위 'edit' 분기와 같은 이유
  }
}
function applyCreatorXform(){ fitCreator('app'); }   // 캐릭터만 변형 — 카메라는 그대로 두어 책상 크기 고정·회전/시점 유지
function frameDeskCam(keepView){   // 캐릭터+책상 전체가 다 보이도록 거리 자동 조절 (메인 화면과 동일한 스케일 적용)
  if(!cCam()) return;
  const box=new THREE.Box3();
  if(cBase()&&cBase().group) box.expandByObject(cBase().group);
  if(cDesk()&&cDesk().visible) box.expandByObject(cDesk());
  if(!keepView){ setCamYaw(0); setCamPitch(0.13); }
  if(box.isEmpty()){ camTarget.set(0,0.6,-0.1); setCamDist(4.4); updateCreatorCam(); return; }
  
  const c=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  camTarget.copy(c);
  sizeFloorTo(cFloor(), c.x, c.z, sz.x, sz.z);   // 받침대를 캐릭터+책상 크기에 맞춤
  
  const fovV=cCam().fov*Math.PI/180, aspect=222/300;
  
  // 메인 앱의 layoutSeats()와 완전히 동일한 여백(Padding) 계산 적용
  const contentW = sz.x + 0.25;
  const contentH = Math.max(sz.y, 1.3) + 0.18;
  
  const distV=(contentH/2)/Math.tan(fovV/2);
  const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fovV/2)*aspect));
  
  // 메인 앱과 동일한 거리 계산 공식 적용 (*1.3 가중치 제거)
  setCamDist(Math.max(distV,distH) + sz.z*0.45);
  
  updateCreatorCam();
}

/* 생성기의 cBase를 커미션 GLB 인스턴스로 교체 */
async function swapCreatorBaseToCommission(def){
  if(!def || !def.commGlb) return;
  try{
    const scene = await getCommissionScene(def.commGlb);
    const newInst = instantiateBase(scene);
    if(!newInst) return;
    if(cBase() && cBase().group && cBase().group.parent){ cBase().group.parent.add(newInst.root); cBase().group.parent.remove(cBase().group); }
    const fT=mkFaceTex(compositeFace(def.skin,def.face)), bT=mkFaceTex(compositeFace(def.skin,def.blink));
    matToneMod.setFaceMap(newInst.faceMat, fT);
    matToneMod.applyLightPresetToInstance(newInst);
    applyStaticHandRest(newInst.root); // 커미션 모델 불러올 때 팔 높이 반영
    cBase().group = newInst.root; cBase().faceMat = newInst.faceMat; cBase().upMat = newInst.upMat; cBase().loMat = newInst.loMat; cBase().hatMat = newInst.hatMat; cBase().face = newInst.faceMesh; cBase().blinkTex = bT;
    cBase().upMesh=newInst.upMesh||null; cBase().loMesh=newInst.loMesh||null; cBase().glassesMesh=newInst.glassesMesh||null;
    cBase().hatMesh=newInst.hatMesh||null; cBase().maskMesh=newInst.maskMesh||null; cBase().onepieceMesh=newInst.onepieceMesh||null;
    cBase().wingMesh=newInst.wingMesh||null; cBase().handLMesh=newInst.handLMesh||null; cBase().handRMesh=newInst.handRMesh||null; cBase().capeMesh=newInst.capeMesh||null;
    extractBonesInto(cBase(), newInst.root);   // 베이스를 통째로 새로 만들었으니 본(부착점) 정보도 다시 추출
    normalizeModel(cBase().group, 1.45, true);
    applyCreatorXform();
  }catch(e){ console.warn('커미션 GLB 적용 실패', e); toast('커미션 캐릭터 모델 로드 실패'); }
}

/* 🐾 동물 캐릭터를 생성기 창(cBase)에 탑재 — 책상·좌석 세팅용. buildAnimalBase(animal.js) 재사용. */
async function swapCreatorBaseToAnimal(def){
  if(typeof window.buildAnimalBase!=='function'){ toast('동물 모듈을 불러오지 못했어요'); return; }
  try{
    const ab=window.buildAnimalBase(def);   // {group, root, faceMat, fT, bT, faceMesh...}
    if(!ab) return;
    if(cBase() && cBase().group && cBase().group.parent){ cBase().group.parent.add(ab.root); cBase().group.parent.remove(cBase().group); }
    cBase().group=ab.root; cBase().faceMat=ab.faceMat; cBase().upMat=null; cBase().loMat=null; cBase().hatMat=null;
    cBase().face=ab.faceMesh; cBase().blinkTex=ab.bT;
    cBase().upMesh=null; cBase().loMesh=null; cBase().glassesMesh=null; cBase().hatMesh=null; cBase().maskMesh=null;
    cBase().onepieceMesh=null; cBase().wingMesh=null; cBase().handLMesh=null; cBase().handRMesh=null; cBase().capeMesh=null;
    extractBonesInto(cBase(), ab.root);   // 파츠 부착점 본 재추출 (책상 소품엔 불필요하지만 일관성)
    // 🐾 팔 각도 — 책상 앞에 앉은 모습이라 타이핑 자세(세 번째 인자 true).
    applyStaticHandRest(ab.root, true, true);
    /* ★ 얼굴 기하 캐시(faceCx — 대칭 붓의 축 · facePos · faceUv · faceIdx)도 동물 것으로 — 안 하면 인간 얼굴 축으로 반사한다. */
    try{
      const afg = ab.faceMesh && ab.faceMesh.geometry;
      if(afg){
        cBase().facePos = afg.attributes.position ? afg.attributes.position.array : null;
        cBase().faceUv  = afg.attributes.uv ? afg.attributes.uv.array : null;
        cBase().faceIdx = afg.index ? afg.index.array : null;
        afg.computeBoundingBox();
        cBase().faceCx = (afg.boundingBox.min.x + afg.boundingBox.max.x) / 2;
      }
    }catch(e){ console.warn('[동물] 얼굴 기하 캐시 갱신 실패 — 대칭 붓질이 어긋날 수 있음', e); }
    // buildAnimalBase가 이미 60% 정규화 → 생성기에선 원래 크기로 보이도록 되돌림(책상 비율 맞추기 위해 인간과 같은 1.45)
    normalizeModel(cBase().group, 1.45, true);
    applyCreatorXform();
  }catch(e){ console.warn('[동물] 생성기 탑재 실패', e); toast('동물 모델 로드 실패 (콘솔 확인)'); }
}

/* 💡 기본 모델 복구 함수 (비동기 꼬임 방지 + 카메라 타겟 재계산 완벽 복구) */
function swapCreatorBaseToDefault() {
  if(typeof BASE_SCENE() === 'undefined' || !BASE_SCENE()) return;
  const newInst = instantiateBase(BASE_SCENE());
  if(!newInst) return;
  
  if(cBase() && cBase().group && cBase().group.parent){ 
    cBase().group.parent.add(newInst.root); 
    cBase().group.parent.remove(cBase().group); 
  }
  
  matToneMod.setFaceMap(newInst.faceMat, dispTex);
  if(newInst.upMat) newInst.upMat.color.set(cTopColor()); 
  if(newInst.loMat) newInst.loMat.color.set(cBotColor());
  if(newInst.hatMat) newInst.hatMat.color.set(cTopColor());   // 🎩 기본 모자도 상의색
  matToneMod.applyLightPresetToInstance(newInst);
  
  cBase().group = newInst.root;
  cBase().faceMat = newInst.faceMat;
  cBase().upMat = newInst.upMat;
  cBase().loMat = newInst.loMat;
  cBase().hatMat = newInst.hatMat;
  cBase().face = newInst.faceMesh;
  // ★ 기본 메쉬 참조도 갱신 — 안 하면 죽은(제거된) 이전 메쉬를 가리켜 모자 숨김 등이 안 먹음
  cBase().upMesh=newInst.upMesh||null; cBase().loMesh=newInst.loMesh||null; cBase().glassesMesh=newInst.glassesMesh||null;
  cBase().hatMesh=newInst.hatMesh||null; cBase().maskMesh=newInst.maskMesh||null; cBase().onepieceMesh=newInst.onepieceMesh||null;
  cBase().wingMesh=newInst.wingMesh||null; cBase().handLMesh=newInst.handLMesh||null; cBase().handRMesh=newInst.handRMesh||null; cBase().capeMesh=newInst.capeMesh||null;
  extractBonesInto(cBase(), newInst.root);   // 베이스를 통째로 새로 만들었으니 본(부착점) 정보도 다시 추출 — 안 그러면 예전 파츠가 죽은 본을 가리키게 됨

  // 페인팅 및 대칭 데이터 복구
  const fg = newInst.faceMesh.geometry;
  cBase().facePos = fg.attributes.position.array; 
  cBase().faceUv = fg.attributes.uv ? fg.attributes.uv.array : null;
  cBase().faceIdx = fg.index ? fg.index.array : null;
  fg.computeBoundingBox(); 
  cBase().faceCx = (fg.boundingBox.min.x + fg.boundingBox.max.x) / 2;
  
  applyStaticHandRest(cBase().group); // 기본 모델로 복구할 때 팔 높이 반영
  normalizeModel(cBase().group, 1.45, false);
  
  // 💡 캐릭터를 '편집(Edit)' 정자세로 둔 뒤 카메라 타겟을 다시 정확히 측정합니다!

  // (불필요한 applyCreatorXform 호출은 삭제하여 시점이 틀어지는 현상 방지)
  fitCreator('edit'); 
  const fb=new THREE.Box3().setFromObject(newInst.faceMesh);
  const fs=fb.getSize(new THREE.Vector3());
  fb.getCenter(cFaceCenter);
  cFaceCenter.y += 0.12;   // ▲ 한 칸만큼 시선 높임 (기본과 동일)
  
  const fovV=cCam().fov*Math.PI/180, aspect=222/300;
  const dV=(fs.y/2)/Math.tan(fovV/2), dH=(fs.x/2)/Math.tan(Math.atan(Math.tan(fovV/2)*aspect));
  setCFaceDist(Math.max(dV,dH)*0.63 + fs.z*0.5 + 0.10);   // 얼굴 확대 (기본과 동일 계수)
  
  const bb=new THREE.Box3().setFromObject(newInst.root);
  const bs=bb.getSize(new THREE.Vector3());
  bb.getCenter(cBodyCenter); setCBodyDist(Math.max(bs.x,bs.y)*1.7+0.3);
}

// ★ 이 좌석(생성기 cBase · 실행 seat 둘 다)의 책상 아이템을 전부 뗀다 — 새 목록을 붙이기 전에 반드시 먼저(커스텀 아이템까지 allDeskItems 로).
function clearHolderDeskItems(holder){
  if(!holder || !holder.deskItems) return;
  allDeskItems().forEach(def=>{ if(holder.deskItems[def.id]) equipDeskItem(holder,def,false); });
  // ★ 목록(customItems)에 없어도 holder 에 남은 아이템은 강제로 뗀다 — 다른 캐릭터 편집으로 넘어갈 때 목록이 먼저 비워진다.
  for(const id in holder.deskItems){
    const p=holder.deskItems[id];
    if(p){ try{ if(p.parent) p.parent.remove(p); }catch(_){} holder.deskItems[id]=null; }
  }
  holder.activeDeskItem=null;
}
function clearCreatorItems(){ clearHolderDeskItems(cBase()); if(deskItemOrigin) deskItemOrigin.clear(); }
/* 🪑 생성기 미리보기에 남은 파츠 wrapper 를 전부 걷어낸다 — 창을 열 때마다. 책상(cDesk)과 cBase 는 창을 닫아도 살아 있어
   '책상 위' 파츠 · 등록부가 다음 편집에 남는다(실행 화면은 좌석마다 책상을 새로 만들어 이 증상이 없다).
   ★ 등록부를 먼저 비우고 청소한다(남아 있으면 살아 있는 파츠로 보고 지나친다). ⚠️ _equipSeq 는 일부러 안 지운다(파싱 중인 옛 장착이 다시 붙는다). */
function clearCreatorParts(){
  if(!cBase()) return;
  cBase().equippedPartObjs = {};
  cBase().stackedPartObjs = {};
  _sweepOrphanPartWrappers(cBase());
}

return {
  RIG_TURN,
  applyCreatorXform,
  applyStaticHandRest,
  clearCreatorItems,
  clearCreatorParts,
  clearHolderDeskItems,
  crFlatView,
  creatorLoop,
  ensureCreatorPreview,
  fitCreator,
  frameDeskCam,
  swapCreatorBaseToAnimal,
  swapCreatorBaseToCommission,
  swapCreatorBaseToDefault,
  updateCreatorCam,
  updateCreatorLights,
};
}

const api = { createCreatorPreview };
if(typeof window !== 'undefined') window.TwCreatorPreview = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
