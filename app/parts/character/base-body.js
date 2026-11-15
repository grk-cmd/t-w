/* base-body.js — 🧍 기본 몸 모델 공급 · 복제 · 크기(앱 FSD · app.js 분리 T2)
   app.js «기본 캐릭터 GLB» 구역을 0.13 app.js 글 그대로 옮긴 모듈이다. 읽기 · 복제 · 크기는 캐릭터 코어(createBody)가 하고, 여기는 몸 모델 자산(window.BASE_GLB_B64) 공급과 옛 이름 잇기다.
   #830(같은 뼈대 한 벌)의 skelShare.shareSkeletons 줄은 instantiateBase 에 있다(0.13 글에도 있다 — sim-skeleton-share 가 지킨다).
   ・책임: bodyCore(코어 몸) 만들기 · b64ToBuf · loadBaseGLB · instantiateBase(복제 + 뼈대 하나로) · getCommissionScene(커미션 GLB 파싱 캐시) · mkFaceTex · COMMISSION_SCALE_CORRECTION · normalizeModel.
   ・받는 deps 7 — 값 loader · skelShare · _fixGlbMatLighting(함수) · setFaceMap · applyLightPreset(함수 — 뒤에서 만들어지는 matToneMod 로 간다) · assetCodeMod(읽는 함수).
   ・내놓는 것: bodyCore · b64ToBuf · loadBaseGLB · instantiateBase · commSceneCache · getCommissionScene · mkFaceTex · COMMISSION_SCALE_CORRECTION · normalizeModel — app.js 는 같은 이름 const 로 받는다. 기본 몸 장면 · 애니메이션은 bodyCore.baseScene() · baseAnims().
   ⚠️ 몸 모델이 아직 안 읽혔으면 baseScene() 은 없음이다 — 부르는 쪽이 그 값을 본다(제보: 파싱 전에 한 번 불리면 0 이 굳던 자리).
   검사: checks/sim-base-body.js */
(function(){

function createBaseBody(deps){
const loader = deps.loader;
const skelShare = deps.skelShare;
const _fixGlbMatLighting = deps._fixGlbMatLighting;
const assetCodeMod = deps.assetCodeMod;
/* 🧍 사람 몸(기본 몸 모델 · 복제 · 크기 · 조립)은 캐릭터 코어(packages/char-core/src/body.ts · #434).
   몸 모델 바이트(window.BASE_GLB_B64) · 재질 톤 · 귀는 앱이 넘긴다. */
const bodyCore = TwCharCore.createBody({
  THREE,
  gltf: loader,
  fixMatLighting: (m)=>_fixGlbMatLighting(m),
  setFaceMap: (...a)=>deps.setFaceMap(...a),
  applyLightPreset: (...a)=>deps.applyLightPreset(...a),
});

/* ===== 기본 캐릭터 GLB (임베드) — face/cloth_upper/cloth_lower + 리깅 ===== */
/* 읽기 · 복제는 bodyCore(캐릭터 코어) — 여기는 몸 모델 자산 공급과 옛 이름 잇기 */
function b64ToBuf(b64){const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer;}
/* 몸 모델 자산 공급 — 빌드에 base-glb.js 가 없으면(@@ 자리표) 대신 몸. base64 가 깨졌으면 예전처럼 거절된 약속으로. */
function loadBaseGLB(){return new Promise(res=>{
  if(!window.BASE_GLB_B64||window.BASE_GLB_B64.indexOf('@@')===0){res(false);return;}
  res(bodyCore.loadBase(b64ToBuf(window.BASE_GLB_B64)));
});}
/* 복제가 메시마다 Skeleton 을 따로 만든다 — 같은 뼈대는 하나로(shared/skeleton-share.js). 코어 assemble 로 짓는 몸은 defToBase 의 onRoot 가 같은 일을 한다. */
function instantiateBase(customScene){
  const inst = bodyCore.instantiateBase(customScene);
  if(inst) skelShare.shareSkeletons(skelShare.skinnedMeshesOf(inst.root));
  return inst;
}
/* 커미션 GLB 파싱 캐시: base64 → THREE.Scene */
const commSceneCache = new Map();
async function getCommissionScene(glbB64){
  if(commSceneCache.has(glbB64)) return commSceneCache.get(glbB64);
  const buf = b64ToBuf(glbB64);
  const scene = await assetCodeMod().parseGlbBytes(buf);
  commSceneCache.set(glbB64, scene);
  return scene;
}
function mkFaceTex(canvas){const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.encoding=THREE.sRGBEncoding;t.needsUpdate=true;return t;}
// 커미션(유료 제작) 캐릭터 크기 보정 배율 — 블렌더에서 맞춰 내보내도 작게 들어오는 경우가 있어 둔 자리. 지금은 보정 없음(1 · 옛 값 1.15).
const COMMISSION_SCALE_CORRECTION = 1;
function normalizeModel(group,targetH,isComm){ return bodyCore.normalizeModel(group, targetH, isComm ? COMMISSION_SCALE_CORRECTION : 1); }

return {
  bodyCore,
  b64ToBuf,
  loadBaseGLB,
  instantiateBase,
  commSceneCache,
  getCommissionScene,
  mkFaceTex,
  COMMISSION_SCALE_CORRECTION,
  normalizeModel,
};
}

const api = { createBaseBody };
if(typeof window !== 'undefined') window.TwBaseBody = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
