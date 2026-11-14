/* stage.js — 🎬 3D 무대 한 벌: 렌더러 · 씬 · 카메라 · 바닥(그림자 받이) · GLTF 로더를 만들어 내놓는다(앱 FSD · app.js 분리 M1)
   app.js SETUP 구역의 «무대 만들기» 를 그대로 옮긴 모듈이다. 동작은 옮기기 전과 같다(바뀐 줄 0). 만드는 차례만 다르다 — 바닥 · 로더를 렌더러 바로 뒤에 만든다(옛 글은 조명 · 재질 뒤).
   ・책임: 메인 캔버스(#scene)에 WebGL 렌더러를 만들고(못 만들면 gl-fail-notice 안내 후 던진다) · 연결 끊김 감시(gl-recover)를 붙이고 ·
     씬 · 원근 카메라 · 그림자 바닥 · GLTF(+DRACO) 로더를 만든다. 만들기만 하고 그리지 않는다 — 그리기는 app.js frame().
   ・받는 deps 1 — _renderAA(렌더러 antialias — 저장된 화질에서 app.js 가 정한 값. 화질 상태는 app.js 에 있다).
     THREE · TwGlFailNotice · GlRecover · TwErrorCodes · companion 은 전역 이름 그대로.
   ・내놓는 것: canvas · renderer · scene · camera · floor · sizeFloorTo(mesh, cx, cz, sx, sz) · loader — app.js 가 같은 이름의 const 로 받는다(옛 전역 이름).
   ⚠️ 조명은 여기 없다 — 조명 상수 · 재질 고치기(T0 몫)가 app.js 에 있고 light-tone 이 그 상수를 받아 만든다.
   ⚠️ 새 3D 장치를 만들 때(미리보기 등)는 이 모듈을 쓰지 말 것 — 이 무대는 메인 창 하나다(미리보기 보호는 F1).
   검사: checks/sim-stage.js */
(function(){

function createStage(deps){
const _renderAA = deps._renderAA;
const canvas=document.getElementById('scene');
/* 🧯 3D 를 못 쓸 때 «다시 켜기» 안내(shared/gl-fail-notice.js) — 렌더러를 못 만들면 안내를 띄우고 멈춘다(B-1114-5) */
const glFail = TwGlFailNotice.createGlFailNotice({
  doc: document, notifyError: (...a) => TwErrorCodes.notify(...a),
  note: (m) => { if(window.companion && companion.diagNote) companion.diagNote(m); },
  relaunch: () => companion.relaunchApp(), quit: () => companion.quitApp(),
});
const renderer=glFail.guard(() => new THREE.WebGLRenderer({canvas,antialias:_renderAA,alpha:true,premultipliedAlpha:false,logarithmicDepthBuffer:true}));renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000, 0);   // 항상 투명 배경으로 클리어 (Electron 투명창 흰 화면 예방)
/* 🧯 메인 캔버스 WebGL 연결 끊김 — 기록하고, 6초 안에 안 돌아오면 앱을 다시 켠다 · 10분 안에 또면 안내(parts/gl-recover.js · B-1114-5).
   three.js 자기 리스너가 먼저 붙어 preventDefault 를 하므로 여기는 기록 · 시간 재기만 한다.
   ⚠️ 마지막으로 다시 켠 시각은 localStorage — 앱을 다시 켜도 남아야 무한 재시작을 막는다. */
try{
  GlRecover.createGlRecover({
    log: (m) => { console.warn('[WebGL]', m); try{ if(window.companion && companion.diagNote) companion.diagNote('[WebGL] ' + m); }catch(_){} },
    relaunch: () => companion.relaunchApp(), notice: () => glFail.show('lost'),
    setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (id) => clearTimeout(id), now: () => Date.now(),
    store: { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) },
  }).attach(canvas);
}catch(e){ console.warn('[WebGL] 복구 감시를 못 붙였다', e); }
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,1,0.1,100);   // 생성기와 동일한 원근 렌즈 (WYSIWYG)

// 받침대(바닥)를 콘텐츠 크기에 맞춰 작게 — 네 모서리가 보이도록
function sizeFloorTo(mesh,cx,cz,sx,sz){ if(!mesh)return; const w=Math.max(sx+0.6, 1.0), d=Math.max(sz+0.5,1.5); mesh.scale.set(w,0.125,d); mesh.position.set(cx,0,cz); }
const floorGeo = new THREE.BoxGeometry(1, 1, 1);
floorGeo.translate(0, -0.5, 0); // 윗면 중앙을 피벗으로 설정
// 바닥의 색상(floorMat)을 지우고, 그림자만 남기는 ShadowMaterial을 사용합니다.
const shadowMat = new THREE.ShadowMaterial();
shadowMat.opacity = 0.3; // 여기서 0.3 숫자를 조절해서 그림자 진하기를 바꾸세요.
const floor = new THREE.Mesh(floorGeo, shadowMat);
floor.scale.set(2.4, 0.125, 2.2);
floor.position.set(0, 0, 0.0);
floor.receiveShadow = true;
floor.castShadow = false;
scene.add(floor);

// GLTF 로더 — DRACO 압축 해제기 포함
const loader=new THREE.GLTFLoader();
try{const draco=new THREE.DRACOLoader();draco.setDecoderPath('vendor/draco/');loader.setDRACOLoader(draco);}catch(e){console.warn('DRACO init',e);}

return {
  canvas,
  renderer,
  scene,
  camera,
  floor,
  sizeFloorTo,
  loader,
};
}

const api = { createStage };
if(typeof window !== 'undefined') window.TwStage = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
