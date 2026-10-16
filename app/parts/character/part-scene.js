/* part-scene.js — 🧊 파츠 GLB 파싱 캐시 · 도트 썸네일 굽기
   책임: 카탈로그 파츠 레코드(rec)의 GLB 를 한 번만 파싱해 id 별로 들고 있고(getPartScene), 그 씬으로 32×32 도트 썸네일을 굽는다(generatePartThumbnail).
   받는 deps: 톤 예산 상수(TONE_FRONT_TOTAL · _MAIN_LIGHT_* · _KEY_LIGHT_MUL · FLAT_EMISSIVE) · _applyPartMatTone · GLB 해결(resolveCatalogGlb · b64ToBuf · assetCodeMod).
   내보내는 것: getPartScene(rec) · generatePartThumbnail(rec) · partSceneCache · _forceOpaqueAlphaOutput(빈 함수 — 부르는 자리 호환).
   app.js «🧊 파츠 GLB 파싱 캐시 · 썸네일» 구역을 그대로 옮겼다(구역 떼기 C · w2 — 관리자 콘솔 다시 굽기는 admin/admin-thumbs.js). 동작은 옮기기 전과 같다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _forceOpaqueAlphaOutput · generatePartThumbnail · getPartScene · partSceneCache — app.js 는 partSceneMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwPartScene — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-part-scene.js */
(function(){

function createPartScene(deps){
const FLAT_EMISSIVE = deps.FLAT_EMISSIVE;
const TONE_FRONT_TOTAL = deps.TONE_FRONT_TOTAL;
const _KEY_LIGHT_MUL = deps._KEY_LIGHT_MUL;
const _MAIN_LIGHT_COL = deps._MAIN_LIGHT_COL;
const _MAIN_LIGHT_INT = deps._MAIN_LIGHT_INT;
const _applyPartMatTone = deps._applyPartMatTone;
const assetCodeMod = deps.assetCodeMod;
const b64ToBuf = deps.b64ToBuf;
const resolveCatalogGlb = deps.resolveCatalogGlb;
/* 파츠 GLB 파싱 캐시: id → THREE.Object3D(원본 씬) */
function _forceOpaqueAlphaOutput(mat){
  // ⚠️ 빈 함수다 — 알파를 1.0 으로 강제하면 반투명 파츠(안경 렌즈 등)가 안 비쳐서 뺐다. 부르는 자리 호환용으로 남김.
}
const partSceneCache = new Map();
async function getPartScene(rec){
  if(partSceneCache.has(rec.id)) return partSceneCache.get(rec.id);
  // rec.glb 없이 glbUrl 만 있으면(로컬 캐시에서 읽은 처음 상태) Storage 에서 먼저 받는다.
  if(!rec.glb && rec.glbUrl){
    try{ await resolveCatalogGlb(rec); }catch(_){}
  }
  if(!rec.glb) throw new Error('파츠 GLB를 찾을 수 없어요: '+rec.id);
  const {scene, animations} = await assetCodeMod.parseGlbFull(b64ToBuf(rec.glb));
  const result = {scene, animations};
  partSceneCache.set(rec.id, result);
  return result;
}
// 파츠 도트 썸네일 — 등록 · 편집 때 32×32 정면으로 구워 rec.thumbnail(PNG)에 채운다(카드는 CSS pixelated 로 키움).
const THUMB_SIZE = 32;
let _thumbRenderer = null, _thumbScene = null, _thumbCam = null;
function _ensureThumbRig(){
  if(_thumbRenderer) return;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE; canvas.height = THUMB_SIZE;
  _thumbRenderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, preserveDrawingBuffer:true});
  _thumbRenderer.setPixelRatio(1);
  _thumbRenderer.setClearColor(0x000000, 0);   // 투명 배경
  _thumbRenderer.outputEncoding = THREE.sRGBEncoding;
  _thumbScene = new THREE.Scene();
  /* 💡 썸네일 광량 배율은 손으로 정하지 않고 계산한다 — «정면 총합(THUMB_FRONT_TOTAL) − FLAT_EMISSIVE» 를 조명이 채운다.
     ⚠️ 박아 둔 숫자는 조명 예산이 바뀔 때 안 따라와 카드만 어두워졌다. _MAIN_LIGHT_INT · _KEY_LIGHT_MUL · FLAT_EMISSIVE 는 여기서 만지지 말 것.
     ⚠️ 흰 파츠가 뭉개지면 THUMB_FRONT_TOTAL 만 내린다. 썸네일은 구워 둔 것이라 값을 바꾸면 generateAllPartThumbnails(true) 로 다시 굽는다. */
  const THUMB_FRONT_TOTAL = TONE_FRONT_TOTAL;   // 장착 화면과 같은 총합
  const _THUMB_LIGHT_AT_1 = (0.95 * _MAIN_LIGHT_INT) + (_MAIN_LIGHT_INT * _KEY_LIGHT_MUL);
  const THUMB_LIGHT_MUL = Math.max(0, Math.min(1.5,
    (THUMB_FRONT_TOTAL - FLAT_EMISSIVE) / (_THUMB_LIGHT_AT_1 || 1)));
  _thumbScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT * THUMB_LIGHT_MUL));
  const key = new THREE.DirectionalLight(_MAIN_LIGHT_COL, 1.0 * _MAIN_LIGHT_INT * _KEY_LIGHT_MUL * THUMB_LIGHT_MUL);
  /* 정수리 위에서 비추면 정면이 어둡고, 정면에서 비추면 음영이 사라져 납작하다 — 비스듬히 위에서 준다. */
  key.position.set(1, 2.5, 2); _thumbScene.add(key);
  _thumbCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  _thumbCam.position.set(0, 0, 3);
  _thumbCam.lookAt(0, 0, 0);
}
async function generatePartThumbnail(rec){
  try{
    _ensureThumbRig();
    const {scene:template} = await getPartScene(rec);
    // 원본을 건드리지 않도록 clone
    const obj = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) ? THREE.SkeletonUtils.clone(template) : template.clone(true);
    /* 💡 장착 화면과 같은 톤을 먹인다.
       ⚠️ 머티리얼을 복제한 뒤 건드릴 것 — 원본은 getPartScene 캐시라 물들이면 그 뒤 장착분에 두 번 먹는다. */
    obj.traverse(o=>{
      if(!o.isMesh) return;
      o.frustumCulled = false;
      const m = (o.material && o.material.clone) ? o.material.clone() : o.material;
      o.material = m;
      _applyPartMatTone(m);
    });
    // 바운딩 박스 재서 프레이밍
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.01);
    // 오브젝트를 원점 중앙에 위치시키기
    obj.position.sub(center);
    // 카메라 프레이밍 — 오브젝트가 딱 맞게 들어오도록 스케일 조정
    const half = maxDim * 0.55;   // 여백 10% 정도
    _thumbCam.left = -half; _thumbCam.right = half;
    _thumbCam.top = half; _thumbCam.bottom = -half;
    _thumbCam.updateProjectionMatrix();
    _thumbScene.add(obj);
    _thumbRenderer.render(_thumbScene, _thumbCam);
    const dataUrl = _thumbRenderer.domElement.toDataURL('image/png');
    _thumbScene.remove(obj);
    return dataUrl;
  }catch(e){
    console.warn('썸네일 생성 실패', rec && rec.id, e);
    return null;
  }
}

return {
  _forceOpaqueAlphaOutput,
  generatePartThumbnail,
  getPartScene,
  partSceneCache,
};
}

const api = { createPartScene };
if(typeof window !== 'undefined') window.TwPartScene = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
