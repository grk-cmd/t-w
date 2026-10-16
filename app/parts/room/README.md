# room/ — 방(워킹룸 · 투게더룸)

방 입장 · 동기화 · 방 서버 · 방 안 놀이 · 좌석 배치. app.js 가 deps 로 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## seat-camera.js — 🎥 좌석 줄 카메라 · 캔버스 맞춤

- **책임**: 좌석 줄(가운데 x · 폭)을 받아 메인 카메라(거리 · 각도 · 화각 · 화면 밀기)와 캔버스 크기(CSS · 렌더 버퍼)를 맞춘다. 두 갈래 — 실행 화면(`body.desktop.runmode` · 화면 전체 캔버스 · 이동 오프셋 · 도트 렌더)과 런처 미리보기(작은 캔버스 · 화각 34도).
- **만드는 법**(app.js «🪑 좌석 배치» 구역 자리):
  ```js
  const seatCameraMod = TwSeatCamera.createSeatCamera({
    BASE_PXW, DOT_RENDER_SCALE, camera, canvas, renderer,          // 값
    _cachedRowCenter: ()=>_cachedRowCenter, _cachedRowSpan: ()=>_cachedRowSpan,   // 읽는 함수(layoutSeats 가 다시 대입)
    deskPanX: ()=>deskPanX, deskPanY: ()=>deskPanY, dotRenderEnabled: ()=>dotRenderEnabled,
    dotRenderMod: ()=>dotRenderMod, focusCharScale: ()=>focusCharScale, sizeFactor: ()=>sizeFactor,
    setDeskCanvasH: (v)=>{ _deskCanvasH = v; }, setDeskViewH: (v)=>{ _deskViewH = v; },
  });
  ```
- **내보내는 것**
  - `applyCameraAndCanvas(rowCenter, rowSpan)` — `layoutSeats` 가 줄을 다시 잡은 뒤 부른다.
  - `updateCameraOnly()` — 줄은 그대로고 배율만 바뀔 때(캐릭터 크기 슬라이더) 마지막 줄 값으로 다시 맞춘다. 책상 실측을 건너뛰어 가볍다.
- **확장할 때 고칠 자리**: 실행 화면 화각 `RUN_FOV_DEG` · 줌 `CAMERA_ZOOM` · 각도 `pitch` · `yaw` · 좌우 원근 `SIDE_PERSP`(상한 `SIDE_PERSP_CAP` 과 같은 기준 0.34 로 짝) · 기본 자리(-0.34 · 0.28).
- **함정**
  - 실행 화면이 아니면 남은 화면 밀기(`camera.view`)를 지운다 — 미리보기에 실행 화면 오프셋이 새지 않게.
  - 도트 렌더면 `renderer.setSize(…, false)` 가 CSS 크기도 바꿔서 바로 뒤에 다시 덮어쓴다.
  - 이동 오프셋을 아무리 밀어도 카메라가 옆으로 가는 양은 상한에서 멈춘다(넘는 몫은 화면 밀기) — 책상이 캐릭터를 가리지 않게.
  - 검사: `checks/sim-seat-camera.js`(4절이 옮기기 전 값 5벌과 같은지 · 캐시 · 상한).
