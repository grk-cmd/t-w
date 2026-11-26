/* seat-camera.js — 🎥 좌석 줄 카메라 · 캔버스 맞춤 — 좌석 줄 폭에 맞춰 카메라 거리 · 각도 · 화면 밀기 · 캔버스 크기
   책임: 좌석 줄(가운데 · 폭)을 받아 메인 카메라와 캔버스 크기를 맞춘다 — 실행 화면(전체 화면 · 이동 오프셋 · 도트 렌더)과 런처 미리보기 두 갈래.
   받는 deps: camera · renderer · canvas · BASE_PXW · DOT_RENDER_SCALE(값) · sizeFactor · focusCharScale · deskPanX/Y · dotRenderEnabled · dotRenderMod · _cachedRowCenter/Span · renderQuality · runLowered(읽는 함수).
   내보내는 것: applyCameraAndCanvas(rowCenter, rowSpan) · updateCameraOnly().
   app.js «🪑 좌석 배치(layoutSeats) · 카메라 · 도트 텍스처 필터» 구역의 카메라 몫을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄임). 바뀐 코드 줄은 12줄 —
     _cachedRowCenter · _cachedRowSpan · deskPanX · deskPanY · dotRenderEnabled · dotRenderMod · focusCharScale · sizeFactor 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: applyCameraAndCanvas · updateCameraOnly — app.js 는 seatCameraMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSeatCamera — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-seat-camera.js */
(function(){

function createSeatCamera(deps){
const BASE_PXW = deps.BASE_PXW;
const DOT_RENDER_SCALE = deps.DOT_RENDER_SCALE;
const _cachedRowCenter = deps._cachedRowCenter;   // 읽는 함수
const _cachedRowSpan = deps._cachedRowSpan;   // 읽는 함수
const camera = deps.camera;
const canvas = deps.canvas;
const deskPanX = deps.deskPanX;   // 읽는 함수
const deskPanY = deps.deskPanY;   // 읽는 함수
const dotRenderEnabled = deps.dotRenderEnabled;   // 읽는 함수
const dotRenderMod = deps.dotRenderMod;   // 읽는 함수
const focusCharScale = deps.focusCharScale;   // 읽는 함수
const renderer = deps.renderer;
const sizeFactor = deps.sizeFactor;   // 읽는 함수
const renderQuality = deps.renderQuality;   // 읽는 함수 — 프로그램 설정 › 모니터의 화질
const runLowered = deps.runLowered;   // 읽는 함수 — «자동» 이 이번 실행에서 낮췄는가
/* 📐 카메라 · 캔버스 박힌 값 — 바꾸면 실행 화면 · 런처 미리보기의 캐릭터 크기 · 자리가 함께 움직인다 */
const LOOK_Y = 0.5;                 // 카메라가 바라보는 높이(바닥이 화면 가운데쯤 오게 살짝 낮춤)
const ROW_BOX_H = 1.4, ROW_BOX_D = 0.8;   // 좌석 줄 내용 상자 높이 · 깊이(폭은 줄 폭)
const PAD_W = 0.6, PAD_H = 0.5, MIN_CONTENT_H = 1.3;   // 화면 여백(월드) · 최소 내용 높이
const PREVIEW_MARGIN_W = 36, PREVIEW_MARGIN_H = 40;    // 런처 미리보기 캔버스 — 창 가장자리 여백(px)
const RUN_FOV_DEG = 50;             // 🔭 실행 화면 화각(도) — 원근감 손잡이(40~70). dist 가 이 값으로 거리를 맞춰 캐릭터 화면 크기는 거의 그대로
const PREVIEW_FOV_DEG = 34;         // 런처 미리보기 화각
const DEPTH_K = 0.45;               // 거리 계산에 더하는 깊이 몫(sz.z ×)
const CAMERA_ZOOM = 2;              // ★ 카메라 줌 배율 — dist 를 이 값으로 나눈다(키우면 캐릭터가 크게)
const MIN_CHAR_SCALE = 0.1;         // 캐릭터 크기 하한(0 으로 나누지 않게)
const PITCH = 0.09;                 // 상하 각도(라디안) — 실행 화면 · 미리보기 같은 값(사용자 확정)
const YAW = 5 * Math.PI / 180;      // 좌우 각도 — 오른쪽으로 5도
const RUN_PAN_X_BASE = 0.34, RUN_PAN_Y_BASE = 0.28;   // 실행 화면 기본 자리 — 화면 왼쪽(−0.34) · 아래(+0.28) 비율
const SIDE_PERSP = 0.4;             // 🔭 좌우 원근 강도(0~1) — ⚠️ 옆 이동 상한(SIDE_PERSP_CAP)이 같은 RUN_PAN_X_BASE 기준으로 짝
// ★ 좌석 배치는 그대로고 카메라만 다시 맞출 때(캐릭터 크기 슬라이더) — layoutSeats 의 책상 실측(Box3)을 건너뛰고
//   마지막 줄 값(_cachedRowCenter/_cachedRowSpan)만 쓴다. 슬라이더를 빠르게 움직여도 안 버벅이게.
function updateCameraOnly(){
  applyCameraAndCanvas(_cachedRowCenter(), _cachedRowSpan());
}
function applyCameraAndCanvas(rowCenter, rowSpan){
  // 카메라가 바라보는 중심(c.y)을 살짝 낮춰서 바닥이 화면 중앙에 오도록 유도
  const c = new THREE.Vector3(rowCenter, LOOK_Y, 0); 
  const sz = new THREE.Vector3(rowSpan, ROW_BOX_H, ROW_BOX_D);
  
  // 화면 상하좌우 여백(Padding)을 대폭 늘려서 카메라가 뒤로 물러나게 줌아웃
  const _deskRun = document.body.classList.contains('desktop') && document.body.classList.contains('runmode');
  const contentW = sz.x + PAD_W;
  const contentH = Math.max(sz.y, MIN_CONTENT_H) + PAD_H;

  const PXW=BASE_PXW*sizeFactor();
  let canvasH, canvasW;
  if(_deskRun){
    // 데스크톱 실행: 캔버스를 화면 전체로 → 캐릭터를 흔들거나 화면 어디로 드래그해도 안 잘림 (시메지처럼).
    canvasW = innerWidth;
    canvasH = innerHeight;
    // 설정에서 "저해상도(도트) 렌더"를 켰으면 pixelRatio를 낮춰 도트 느낌 (성능도 가벼워짐)
    /* 실행 화면은 화면 전체 크기의 투명 캔버스라 DPR 이 가장 큰 상시 비용이다 — FrameBudget.RUN_MAX_PR(1.5)로 누른다. 도트 렌더면 1. */
    const wantPR = FrameBudget.runPixelRatio(devicePixelRatio, dotRenderEnabled(), renderQuality(), runLowered());
    if(renderer.getPixelRatio() !== wantPR) renderer.setPixelRatio(wantPR);
    canvas.style.imageRendering = dotRenderEnabled() ? 'pixelated' : 'auto';
  } else {
    canvasH=Math.min(Math.round(contentH*PXW), innerHeight-PREVIEW_MARGIN_H);
    canvasW=Math.min(Math.round(contentW*PXW), innerWidth-PREVIEW_MARGIN_W);
  }
  const aspect=canvasW/canvasH;

  const fovDeg = _deskRun ? RUN_FOV_DEG : PREVIEW_FOV_DEG;
  const fov=fovDeg*Math.PI/180;
  camera.fov = fovDeg;   // 투영 행렬에도 반영 (이름표/클릭 판정이 같은 행렬을 씀)
  let dist;
  if(_deskRun){
    // 전체화면 캔버스에서도 캐릭터 크기를 이전(작은 캔버스)과 비슷하게 유지: 캔버스가 커진 배율만큼 카메라를 뒤로.
    const prevCanvasH = Math.min(Math.round(contentH*PXW), innerHeight-PREVIEW_MARGIN_H);
    const zoomOut = canvasH / Math.max(1, prevCanvasH);
    const distV=(contentH/2)/Math.tan(fov/2);
    const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fov/2)*aspect));
    dist=(Math.max(distV,distH)+sz.z*DEPTH_K) * zoomOut / Math.max(MIN_CHAR_SCALE,focusCharScale()) / CAMERA_ZOOM;
  } else {
    const distV=(contentH/2)/Math.tan(fov/2);
    const distH=(contentW/2)/Math.tan(Math.atan(Math.tan(fov/2)*aspect));
    dist=(Math.max(distV,distH)+sz.z*DEPTH_K) / CAMERA_ZOOM;
  }
  
  const pitch = PITCH;
  const yaw = YAW;
  
  camera.aspect=aspect;
  camera.position.set(
    c.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    c.y + Math.sin(pitch) * dist,
    c.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
  let tx=c.x, ty=c.y, tz=c.z;
  if(_deskRun){
    const viewH = 2 * dist * Math.tan(fov/2);
    const viewW = viewH * aspect;
    // deskPanX/Y는 "뷰 비율"(unitless fraction) — 캐릭터 크기(focusCharScale)가 바뀌어도 항상 같은 화면 비율 위치 유지.
    const panX = viewW * (-RUN_PAN_X_BASE + deskPanX());   // 기본: 좌측 + 사용자 오프셋(비율)
    const panY = viewH * (RUN_PAN_Y_BASE + deskPanY());    // 기본: 하단 + 사용자 오프셋(비율)
    // 🔭 좌우(X)는 카메라 이동과 화면 밀기를 섞고(SIDE_PERSP = 원근 강도 0~1), 상하(Y)는 화면 밀기만(pitch 고정).
    /* 카메라가 옆으로 가는 양에는 상한(기본 위치 -0.34 의 각도)을 둔다 — 화면 끝으로 밀면 책상이 캐릭터를 가리던 것을 막는다.
       넘는 몫은 화면 밀기로 보내 목표 자리는 그대로. ⚠️ SIDE_PERSP 를 만지면 이 상한도 같이 본다(같은 0.34 기준). */
    const SIDE_PERSP_CAP = viewW * RUN_PAN_X_BASE * SIDE_PERSP;
    const panXCam = Math.max(-SIDE_PERSP_CAP, Math.min(SIDE_PERSP_CAP, panX * SIDE_PERSP));
    const camPanX = panXCam * Math.cos(yaw);
    tx += camPanX; camera.position.x += camPanX;
    tz -= panXCam * Math.sin(yaw); camera.position.z -= panXCam * Math.sin(yaw);
    // 카메라가 못 간 몫은 전부 화면 밀기로 — (panX - panXCam) 이라 상한에 걸려도 목표 위치는 정확히 맞는다
    const offX =  ((panX - panXCam) / viewW) * canvasW;   // 나머지는 화면만 밀기(각도 불변)
    const offY = -(panY / viewH) * canvasH;
    camera.setViewOffset(canvasW, canvasH, offX, offY, canvasW, canvasH);
  } else if(camera.view){
    camera.clearViewOffset();   // 실행 화면이 아니면 오프셋 잔존 방지 (미리보기 등)
  }
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix();
  
  canvas.style.width=canvasW+'px'; canvas.style.height=canvasH+'px';
  if(_deskRun && dotRenderEnabled()){
    // 실제 렌더 버퍼 해상도를 낮춰서 확실한 도트감(CSS 표시 크기는 그대로 유지, image-rendering:pixelated로 확대)
    const rw=Math.max(2,Math.round(canvasW*DOT_RENDER_SCALE)), rh=Math.max(2,Math.round(canvasH*DOT_RENDER_SCALE));
    renderer.setSize(rw, rh, false);
    canvas.style.width=canvasW+'px'; canvas.style.height=canvasH+'px';   // setSize(false)가 style도 rw/rh로 바꿔버리니 다시 덮어씀
    dotRenderMod().applyDotTextureFilter(true);    // 텍스처 보간을 꺼서 확실히 각진 도트로 (뿌옇게 안 보이게)
    dotRenderMod().applyPS1Shader(true);           // 🕹️ PS1 감성 — 색 양자화 + Bayer 디더링 주입
  } else {
    renderer.setSize(canvasW, canvasH, false);
    if(_deskRun){ dotRenderMod().applyDotTextureFilter(false); dotRenderMod().applyPS1Shader(false); }
  }
}

return {
  applyCameraAndCanvas,
  updateCameraOnly,
};
}

const api = { createSeatCamera };
if(typeof window !== 'undefined') window.TwSeatCamera = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
