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
  });
  ```
- **내보내는 것**
  - `applyCameraAndCanvas(rowCenter, rowSpan)` — `layoutSeats` 가 줄을 다시 잡은 뒤 부른다.
  - `updateCameraOnly()` — 줄은 그대로고 배율만 바뀔 때(캐릭터 크기 슬라이더) 마지막 줄 값으로 다시 맞춘다. 책상 실측을 건너뛰어 가볍다.
- **확장할 때 고칠 자리**: 모듈 위 상수 표 — 화각 `RUN_FOV_DEG` · `PREVIEW_FOV_DEG` · 줌 `CAMERA_ZOOM` · 각도 `PITCH` · `YAW` · 좌우 원근 `SIDE_PERSP`(옆 이동 상한과 같은 `RUN_PAN_X_BASE` 기준으로 짝) · 기본 자리 `RUN_PAN_X_BASE` · `RUN_PAN_Y_BASE` · 여백 `PAD_*` · `PREVIEW_MARGIN_*`.
- **함정**
  - 실행 화면이 아니면 남은 화면 밀기(`camera.view`)를 지운다 — 미리보기에 실행 화면 오프셋이 새지 않게.
  - 도트 렌더면 `renderer.setSize(…, false)` 가 CSS 크기도 바꿔서 바로 뒤에 다시 덮어쓴다.
  - 이동 오프셋을 아무리 밀어도 카메라가 옆으로 가는 양은 상한에서 멈춘다(넘는 몫은 화면 밀기) — 책상이 캐릭터를 가리지 않게.
  - 검사: `checks/sim-seat-camera.js`(4절이 옮기기 전 값 5벌과 같은지 · 캐시 · 상한).

## `presence.js` — 🛰 방 접속 상태(Presence)

**책임** — 지금 들어가 있는 방(provider · 방 코드 · 친구 목록)과, 내가 방에 보내는 값(상태 · 레벨 · 자리비움 그림 · 백색소음 · 채팅 · 올라타기 …)을 한 곳에서 들고 보낸다.
20분 무반응 자동 자리비움과 6시간 자동 퇴장 시계도 내 상태(`myUserStatus`)를 같이 써서 이 안에 있다.

**만드는 법** — app.js «🛰 방 접속 상태(Presence)» 자리:

```js
const presenceMod = TwPresence.createPresence({
  USER_STATUSES: USER_STATUSES,          // 값 — 상태 목록(부팅 때 저장값 검사)
  roomSyncMod: roomSyncMod,              // 값 — Firebase provider · poke 신선도 · 자동 퇴장 안내
  roomNet: ()=>window.firebaseAPI,       // 읽는 함수 — 데이터 provider 고르기 한 줄(준비 확인 · Firebase 방 고르기)
  focusLevelMod: ()=>focusLevelMod,      // 읽는 함수 — 만드는 줄보다 뒤에 선언되는 모듈
  lastAnyInput: ()=>lastAnyInput,        // 읽는 함수 — app.js 가 다시 대입하는 let
  toast: (...a)=>toast(...a),            // 함수
  // … 20개(함수 3 · 값 7 · 읽는 함수 10)
});
const Presence = presenceMod.Presence;   // 옛 전역 이름 — 나머지 코드는 예전처럼 Presence.이름
```

**내놓는 것** — `{ Presence }`. `Presence` 의 함수:

| 함수 | 하는 일 |
|---|---|
| `start(room, def, name, onChange, opts)` | 방에 들어간다. Firebase 방이면 방 코드, `opts.provider`(방 서버)면 `{ ok, code, others, meta }` 를 돌려준다. 데이터 provider(`roomNet()`)가 끝내 없으면 들어가지 않고 알린다 |
| `stop()` | 나간다(서버 삭제를 기다리려면 `await`) |
| `setState` · `setUserStatus` · `setCustomStatus` · `setFocusShow` · `setAwayImg` · `setAwaySz` · `setNoise` · `setLevel` · `setName` | 내 값 하나를 바꾸고 **바뀌었을 때만** 방에 보낸다 |
| `sendChat(text, fly, flyColor, flySize, tab)` | 채팅 한 줄(140자). #일반이 아니면 `chatTab` 칸으로 |
| `poke(friendId, type)` · `pokeSelf(type)` | 남 / 나에게 쓰다듬기 · 흔들기 · 날리기 알림 |
| `updateDef(def)` | 방에 들어간 뒤 바뀐 내 캐릭터를 다시 보낸다 |
| `broadcastRide()` · `broadcastNow()` | 지금 값을 바로 보낸다(올라타기 · 쉬는 시간처럼 틱을 기다리면 늦는 값) |
| `active()` · `roomCode()` · `friendsObj()` · `myDef()` · `serverProvider()` | 읽기 |

```js
if(Presence.active()) Presence.setNoise('pencil');   // 방에 있을 때만 보낸다(방 밖이면 provider 가 없어 아무 일도 없다)
```

**확장할 때 고칠 자리**
- 방에 새 칸을 싣기 → `_basePayload()` 한 곳(매 update 에 같이 나간다). 입장 때도 필요하면 `start()` 의 `provider.join(…)` 객체에도. 규칙 · 방 서버(모르는 칸을 받지 않음)도 같이 본다.
- 새 setter → `setNoise` 모양(값 거르기 → 같으면 return → 바꾸고 `provider.update(_basePayload())`) · 맨 아래 `return { … }` 에 이름 추가.
- 받은 poke 의 새 종류 → `start()` 안 poke 콜백의 `else if` 줄.
- 자동 자리비움 시간 · 틱 → 위쪽 상수 `AUTO_AWAY_MS` · `AUTO_AWAY_TICK_IDLE_MS` · `AUTO_AWAY_TICK_BACK_MS`.
- 채팅 · 탭 · 날리기 칸 길이 · 자리비움 그림 처음 크기 → 파일 위 상수 `CHAT_TEXT_MAX` · `CHAT_TAB_MAX` · `FLY_COLOR_MAX` · `FLY_SIZE_MAX` · `AWAY_SZ_DEFAULT`(채팅 길이는 서버 규칙과 짝).

**함정**
- 모듈 안에서 `firebaseAPI` 를 직접 보지 않는다 — `roomNet()` 으로만. 서버(API)로 옮길 때 app.js 의 `roomNet:` 한 줄만 갈아 끼운다(방 서버 입장은 이미 `opts.provider`).
- 전역 `setUserStatus`(칩 · 캐릭터 모션까지 바꾸는 쪽)는 꼭 `window.setUserStatus` 로 부른다 — 안쪽에 같은 이름 `setUserStatus` 가 있어 가린다.
- `myAwaySz` 처음 값은 숫자(80)로 둔다 — undefined 가 든 payload 는 Firebase 가 통째로 거절한다.
- 자동 퇴장 뒤 시계 되감기는 `window._autoAwayResetClock` — room-sync.js 는 이것을 app.js 가 넘기는 deps 로 부른다(모듈끼리 window 로 서로 부르면 순환 — `sim-dep-cycles`).
- 만들자마자 부팅 상태를 되살리고(`tw.userStatus` · `tw.awayKind`) 첫 자동 자리비움 틱(60초)을 예약한다.

검사: `checks/sim-presence.js` (부팅 상태 · payload · 채팅 · poke 거르기 · 자동 자리비움 · 연결 · 깨 보기).

## ride-chain.js — 🗼 탑 바닥 찾기

- **책임**: `seat.ridingOn` 사슬만 보고 그 좌석이 속한 탑의 맨 아래 좌석을 돌려주는 순수 계산. 올라타기(`ride-bench.js`)와 좌석 줄 배치(`seat-layout.js`)가 같이 쓴다 — 둘이 서로를 부르면 모듈 순환이 생겨 아래층에 따로 둔다.
- **만드는 법**: deps 없음 · ride-bench 를 만들기 전에 `const rideChainMod = TwRideChain.createRideChain({` / `});` 두 줄.
- **내보내는 것**: `_rideBottom(seat)` — 안 탔으면 자기 자신, 빈 값이면 그대로.
  ```js
  // rideBenchMod 를 만들 때
  _rideBottom: (...a)=>rideChainMod._rideBottom(...a),
  ```
- **확장할 때 고칠 자리**: 탑 사슬을 따라가는 다른 순수 계산(깊이 · 위아래 판정)도 옮겨 올 수 있다 — 지금은 `ride-bench.js` 의 `_rideDepth` · `_rideIsAbove` 에 있다.
- **함정**: 순환 방어로 `RIDE_CHAIN_MAX_HOPS`(16)번에서 멈춘다(`_rideDepth` 와 같은 상한) — 바꾸면 둘을 같이. 검사: `checks/sim-ride-chain.js`.
## seat-layout.js — 🪑 좌석 줄 배치

- **책임**: 좌석 줄 자리 계산 하나. 평준화 반영(`syncSeatEqualize`) → 맨 오른쪽 고정(`TwSeatPin.pinFirst`, 옮겼으면 좌석 탭 다시 그림) → 이동 오프셋을 안전 범위로 → 0번(맨 오른쪽 · x=0)부터 왼쪽으로 «앞 반폭 + 여백 + 내 반폭» 씩 `targetX` → 올라탄 좌석은 탑 바닥 자리를 물려받음 → 줄 가운데 · 폭을 캐시하고 `seatCameraMod.applyCameraAndCanvas` 로.
- **만드는 법**(app.js «🪑 좌석 배치» 구역 자리):
  ```js
  const seatLayoutMod = TwSeatLayout.createSeatLayout({
    seats,                                                                // 값
    _rideBottom: (...a)=>rideChainMod._rideBottom(...a),                  // 탑 바닥(ride-chain.js — ride-bench 를 부르면 순환)
    syncSeatEqualize, renderSeatTabs, clampDeskPan, seatDeskHalfWidth,   // 함수(화살표로)
    roomSeatMode: ()=>roomSeatMode, deskPanX: ()=>deskPanX, deskPanY: ()=>deskPanY,
    SPACING: ()=>SPACING, MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING, seatCameraMod: ()=>seatCameraMod,
    setDeskPanX: (v)=>{ deskPanX = v; }, setDeskPanY: (v)=>{ deskPanY = v; },
    setCachedRowCenter: (v)=>{ _cachedRowCenter = v; }, setCachedRowSpan: (v)=>{ _cachedRowSpan = v; },
  });
  function layoutSeats(){ seatLayoutMod.layoutSeatRow(); }   // 이름은 app.js 에 남긴다(아래 함정)
  ```
- **내보내는 것**: `layoutSeatRow()` — 직접 부르지 말고 app.js 의 `layoutSeats()` 를 부른다(좌석이 늘거나 줄 때 · 책상 크기가 바뀔 때 · 창 크기가 바뀔 때).
- **확장할 때 고칠 자리**: 줄 폭 하한 `ROW_SPAN_MIN` · 간격 값은 app.js 의 `SPACING` · `MULTIPLAYER_SPACING`(설정 창이 바꾼다) · 책상 반폭 재기는 app.js `seatDeskHalfWidth` · 고정 규칙은 `seat-pin.js`.
- **함정**
  - app.js 맨 아래 «데스크탑 창 크기» 가 `layoutSeats` 를 감싸 **다시 대입**한다(앱 FSD 32번). 그래서 본문 이름은 `layoutSeatRow` 이고 app.js 에 `layoutSeats` 를 남긴다 — 모듈 안에서 `layoutSeatRow` 를 직접 부르면 창 크기 맞춤이 빠진다.
  - `seats` 배열의 순서 · 내용은 안 바꾼다(좌석 탭 · 슬롯 드래그가 인덱스를 쓴다). 올라탄 좌석은 계산에서만 뺀다.
  - 1번 자리부터 책상 반폭에 줌 상한(1.1)이 걸리는 지금 동작은 `CONFIRM.md` 에 적어 둠(`seats.map(seatDeskHalfWidth)` 가 인덱스를 forZoom 으로 넘김).
  - 검사: `checks/sim-seat-layout.js`(4절 — 혼자 · 셋 · 친구 간격 · 올라탄 좌석 · 고정 · 오프셋 · 폭 0 · 빈 목록).

## label-measure.js — 📐 좌석 라벨 잰 값 기억

- **책임**: 경험치 바 · 이름표 · 공지 · 말풍선이 매 프레임 쓰는 «잰 값»(캔버스 사각형 · 라벨 크기)을 기억해, 자리를 적은 뒤 바로 다시 재는 강제 레이아웃을 없앤다. 순수 모듈(DOM 읽기는 deps).
- **만드는 법**: `overhead.js` 가 만들 때 `TwLabelMeasure.createLabelMeasure({ readCanvasRect, now })` — html · smoke PRELOAD 에서 overhead.js 보다 먼저.
- **내보내는 것**
  - `beginFrame()` — 프레임 맨 앞(app.js `frame()` 이 `overheadMod.beginLabelFrame()`)에서 캔버스 사각형을 비운다. 이번 프레임 첫 `canvasRect()` 가 새로 잰다.
  - `size(el, key)` — `{ w, h }`. 열쇠(글 · 클래스)가 같고 `REFRESH_MS`(500) 안이면 기억한 값, 숨었거나 0 이면 마지막 값.
  - overhead.js 가 밖에 내놓는 이름: `beginLabelFrame` · `labelSize` · `nameplateHeight(seat)`. 바 · 이름표 · 공지는 자리를 적으며 아래변을 `el._bottom` 에 남기고, 뒤에 도는 이름표 · 말풍선 · 공지는 사각형 대신 그것을 읽는다.
- **함정**
  - `beginLabelFrame` 을 빼면 캔버스 사각형이 영영 안 바뀐다(창 크기가 바뀌어도 라벨이 옛 자리) — `checks/sim-label-measure.js` 가 frame 안 자리를 본다.
  - 프레임 루프 순서(바 → 이름표 → 공지 → 말풍선 → 상태칩)가 곧 `_bottom` 이 이번 프레임 값인 까닭이다. 순서를 바꾸면 한 프레임 전 값을 읽는다.
  - 상태칩(`status-chip.js`)은 아직 사각형을 직접 읽는다 — 프레임에 한 번(그 자리에서 이번 프레임 쓰기가 한꺼번에 반영)이라 그대로 뒀다.

## ride-measure.js — 📏 올라타기 실측

- **책임**: 올라타기에 쓰는 «한 번 재서 캐싱하는» 3D 실측 셋. 값만 돌려주고 좌석에 쓰지 않는다(캐싱 · 적용은 `ride-bench.js`).
- **만드는 법**: `const rideMeasureMod = TwRideMeasure.createRideMeasure({ seatEqMod: seatEqMod });`(seatEqMod 를 만든 뒤).
- **내보내는 것**
  - `_measureCircusFootOff(seat, standLeft)` — 묘기(2층+)에서 딛는 다리의 좌석 로컬 오프셋(y=0 · `THREE.Vector3` 새 벡터). 0.3 넘게 떨어지면 측정 실패로 `null` + 경고.
  - `_rideHostSpinY(host)` — 대상이 회전 춤 중이면 몸통이 돌아간 각, 아니면 0.
  - `_measureAnimalArmH(animalSeat)` — 동물 발바닥→팔 높이를 크기 1 기준으로(실효 크기로 나누고 캐릭터 들림은 뺀다). 못 재면 `null`.
  ```js
  // ride-bench 를 만들 때
  _measureAnimalArmH: (...a)=>rideMeasureMod._measureAnimalArmH(...a),
  ```
- **확장할 때 고칠 자리**: 실패 판정 `CIRCUS_FOOT_OFF_MAX`(0.3) · 새 실측은 여기에 더하고 캐싱은 ride-bench 쪽에.
- **함정**
  - 드래그 중(rig 가 들린 채)에 재면 값이 틀린다 — 접지점은 rig 가 원점에 놓인 첫 묘기 프레임, 팔 높이는 bodyWrap 기준.
  - 캐릭터 높이 상쇄는 `_positionRideSeat` 가 `charLiftWorld` 로 한 번 — 여기서도 빼므로 armH 에는 높이가 안 섞인다(두 번 빼지 말 것).
  - 임시 벡터(`_rideFootTmpV` 등)를 돌려주지 않고 `clone()` 한다 — 호출부가 값을 들고 있어도 안전.
  - 검사: `checks/sim-ride-measure.js`(4절 — 실제 three 로 회전 · 위치를 뺀 오프셋 · 경계 0.3 · 들린 rig 상쇄 · 크기 0).

## ride-tuning.js — 🎛️ 올라타기 · 묘기 튜닝 값

- **책임**: 올라타기(`ride-bench.js`) · 상호작용 책상(`interaction-desk.js`) · 동작(app.js `animateRig`)이 같이 읽는 박힌 값 표 하나 — 계산 없이 값만. 같이 돌려 쓰는 three 임시 벡터 · 쿼터니언(`_rideWP` · `_rideQD` …)도 여기서 만든다(매 프레임 new 안 하려고).
- **만드는 법**: deps 없음 — `const rideTuneMod = TwRideTuning.createRideTuning({` / `});`(three 를 실은 뒤 · ride-bench 를 만들기 전에).
- **내보내는 것**: 상수 37개(`RIDE_*` · `CIRCUS_*`) · 임시 객체 13개. 쓰는 모듈에는 app.js 가 deps 로 넘긴다.
  ```js
  // ride-bench 를 만들 때
  RIDE_ARM_SINK: rideTuneMod.RIDE_ARM_SINK,
  _rideWP: rideTuneMod._rideWP,
  ```
- **확장할 때 고칠 자리**: 값만 바꾸면 된다(높이 · 깊이 보정은 «크기 1 기준» 으로). 새 튜닝 값도 여기에 더하고 쓰는 모듈 deps 로.
- **함정**
  - sink · 앞뒤 보정은 대상 크기 1 기준이고 쓰는 쪽이 × 대상 userScale 한다 — 작은 크기에서 맞춘 값을 박지 말 것.
  - 1층(팔 걸치기)과 2층+(발로 딛기)은 앞뒤 보정 부호가 반대라 상수가 따로다(`RIDE_Z_DEPTH_K_ON_ANIMAL` · `CIRCUS_Z_DEPTH_K_ON_ANIMAL`).
  - 임시 객체는 공유된다 — 값을 들고 있으려면 `clone()`.
  - 동물 팔 기본각 `ANIMAL_HAND_REST` 는 animal.js 가 전역으로 읽어 app.js 에 남겼다.
  - 검사: `checks/sim-ride-tuning.js`(4절 — 값 표 50개가 옮기기 전과 같다 · 임시 객체가 따로따로 · 값 범위).

## seat-refit.js — 🪑 파츠 구성이 바뀐 뒤 좌석 다시 맞추기

- **책임**: 파츠를 붙이거나 뗀 좌석을 한 순서로 다시 맞춘다 — 끝난 장착 기다리기(거부돼도 다시 맞추기는 한다) → 아직 같은 좌석 · 같은 캐릭터인지 → `fitModel`(발밑 깊이 · 리깅 파츠) → `layoutSeats`(원할 때만) → 다시 맞춘 뒤 알림(app.js 가 건 올라탄 사람 높이 다시 재기 `rideBenchMod._remeasureRideHeadTop`).
- **만드는 법**(app.js «🪑 좌석 배치» 자리 — `layoutSeats` 바로 뒤 · `rideBenchMod` 보다 뒤):
  ```js
  const seatRefitMod = TwSeatRefit.createSeatRefit({
    fitModel: (...a)=>fitModel(...a),
    layoutSeats: (...a)=>layoutSeats(...a),   // 맨 아래 «데스크탑 창 크기» 가 다시 대입하므로 화살표로
    requestFrame: (...a)=>requestAnimationFrame(...a),
    seats: seats,                              // 다음 프레임 맞추기는 실행 화면 좌석만
  });
  seatRefitMod.onRefitted((s)=>rideBenchMod._remeasureRideHeadTop(s));   // 알림으로 — ride-bench 를 deps 로 받으면 새 순환(sim-dep-cycles)
  ```
  다른 모듈에는 `refitSeatAfterParts: (...a)=>seatRefitMod.refitSeatAfterParts(...a)` 로 넘긴다(wardrobe · room-entry · catalog-sync · admin-part-register).
- **내보내는 것**
  - `refitSeatAfterParts(seat, { wait, layout, isCurrent })` → Promise(다시 맞췄으면 true). 다시 맞춘 좌석과 그 좌석이 탄 대상(`ridingOn`)에 `onRefitted` 알림을 한 번씩.
  - `requestRefit(seat)` — 파츠를 뗀 자리(app.js `unequipStackablePart` · `unequipPartFromSeat` → `_refitAfterUnequip`)가 부른다. 다음 프레임에 한 번(같은 프레임 여러 번이면 좌석마다 한 번) · 실행 화면 좌석만 · 그 전에 장착 뒤 맞추기가 돌았으면 건너뜀.
  - `onRefitted(fn)` — 다시 맞춘 뒤 할 일(지금은 올라탄 사람 높이 다시 재기 하나).
  ```js
  // 친구 파츠가 바뀌었을 때(room-entry.js)
  refitSeatAfterParts(s, { wait: applyEquippedPartsToSeat(s, fdef), layout: true, isCurrent: ()=>s.charDef===fdef });
  // 꾸미기 저장(wardrobe.js) — 끝날 때까지 기다린 뒤 저장 · 방 전송
  await refitSeatAfterParts(mySeat, { wait: applyEquippedPartsToSeat(mySeat, def) });
  ```
- **확장할 때 고칠 자리**: «파츠가 바뀌었다» 를 만드는 새 길은 같은 순서를 다시 쓰지 말고 이 함수를 부른다. 다시 맞출 것이 늘면(예: 이름표 높이) 이 함수 안에 한 줄 — 길마다 더하지 않는다.
- **함정**
  - 매 프레임 부르지 말 것 — 올라탄 사람 높이는 이름표 · 말풍선 자리의 기준이라 프레임마다 다시 재면 라벨이 떤다.
  - `isCurrent` 를 빼면 기다리는 사이 나간 사람 · 바뀐 캐릭터의 좌석에 뒤늦게 `fitModel` 이 발사된다(원격 캐릭터 크기가 튀던 경위).
  - 생성기 미리보기(`fitCreator`) · 꾸미기 미리보기는 다른 맞추기라 이 함수를 쓰지 않는다(`requestRefit` 도 `seats` 밖 좌석은 건너뛴다).
  - 떼기 뒤 바로 재지 않고 다음 프레임인 까닭 — 뗀 뒤 `applyClothVisibility` 가 기본 메쉬(머리카락 등)를 되돌려야 맞는 높이가 나온다.
  - 방 동기화(`_applyRemoteRides`)의 «같은 상태면 건너뜀» 은 그대로 둔다 — 파츠가 바뀐 뒤 높이 다시 재기는 이 모듈이 판단한다.
  - 검사: `checks/sim-seat-refit.js`(순서 · 거부 · 낡은 좌석 · 길마다 부르는지 · 깨 보기).

## `seat-menu.js` — 🖱 좌석 우클릭 메뉴

**책임** — 캐릭터 · 이름표를 우클릭하면 그 좌석에 할 수 있는 일을 띄운다. 남의 좌석: 마이홈 구경(친구) / 친구 신청 · 숨기기(워킹룸 — 신고로 숨긴 사람은 채널과 상관없이 다시 보이기) · 때리기(프리미엄) · 신고. 내 좌석: 캐릭터 편집 · 자리비움 토글 · 때리기. 닫기는 투명 뒷판(실행 화면은 투명 오버레이라 바깥 클릭이 뒤 창으로 흘러서) · 바깥 클릭 · 우클릭 · ESC.

**만드는 법** — app.js «DRAG / PET» 의 캔버스 우클릭 바로 뒤, 그리고 이름표 갈고리:

```js
const seatMenuMod = TwSeatMenu.createSeatMenu({
  hiddenSeatsMod: hiddenSeatsMod, mhVisitMod: mhVisitMod, seatFriendReqMod: seatFriendReqMod, tricksMod: tricksMod,   // 값
  reportMod: ()=>reportMod, _myHomeFriends: ()=>_myHomeFriends, userStatus: ()=>userStatus,                      // 읽는 함수
  // … 함수 4(_premiumOn · openCreator · setUserStatus · toast)
});
overheadMod.setSeatMenu((...a)=>seatMenuMod._seatCtxMenu(...a));   // 이름표 우클릭
```

**내놓는 것** — `_seatCtxMenu(ev, seat)`.

**확장할 때 고칠 자리** — 새 항목은 `mk(라벨, 할 일, 막힘?, 그림)` 한 줄. 남 / 나 갈래 안에, 서로 다른 무리 사이에는 `sep()`(뒤따르는 줄이 있을 때만).

**함정**
- 메뉴 클래스는 `cr-preset-ctx` 를 그대로 쓴다 — 다른 팝업의 바깥 클릭 닫기가 이 이름을 예외로 둔다(새 이름이면 즉시 닫힌다).
- 뒷판은 메뉴와 수명을 같이 한다(지우는 곳은 `close()` 하나) — 남으면 화면 전체가 클릭을 먹는다.
- ESC 는 캡처 단계에서 전파를 끊는다 — 안 끊으면 마이홈까지 같이 닫힌다.
- 이름표(overhead.js)는 메뉴를 deps 로 받지 않는다 — 메뉴가 신고 · 마이홈 · 놀이를 거쳐 이름표로 돌아와 순환이 된다. `setSeatMenu` 갈고리로만.
- 입구 전제 — 이벤트 · 좌석 · 화면(document.body)이 없으면 열지 않는다.

검사: `checks/sim-seat-menu.js`.

## room-settings.js — 방 설정 규칙(제목 · 최대 인원 · 방장 닉네임)

**책임** — 방 만들기 창 · 입장 정원 검사 · 들어간 뒤 자기 퇴장이 같이 부르는 판정 한 곳(순수 함수 · DOM · firebase 없음). 제목 확인(`checkTitle` — 빈 제목 통과 · 20자 · 금칙어), 최대 인원 고르기(`clampMax` — 2 ~ 정원), 방 정원(`roomCap` — `_meta.max` 와 원격 정원 중 작은 쪽), 방장 닉네임(`hostNameOf`).

**만드는 법** — classic script(`window.TwRoomSettings`)를 app.js · firebase-init.js 보다 먼저 싣는다. room-entry 는 deps `roomSettings` 로, firebase-init(모듈)은 `window.TwRoomSettings` 로 부른다(원격 설정 정원을 `window.TwRemoteConfig` 로 읽는 것과 같은 자리).

**내놓는 것** — `TITLE_MAX` · `HOST_NAME_MAX` · `ROOM_MAX_MIN` · `ROOM_MAX_MAX` · `TITLE_ERROR_TEXT` · `checkTitle` · `clampMax` · `roomCap` · `hostNameOf`.

**함정**
- 범위(제목 20 · 닉네임 20 · 인원 2~50)는 규칙 `rooms/$room/_meta` 와 서버 함수 `firebase/functions/room-lobby.js` 와 같아야 한다 — `sim-room-settings` 가 견준다.
- 금칙어 판정은 여기서 다시 쓰지 않는다 — `shared/banned-words.js`(서버 함수와 글자까지 같은 한 벌)를 넘겨받아 부른다.

검사: `checks/sim-room-settings.js`.

## room-create-ui.js — 방 만들기 창

**책임** — 방 만들기 / 참여하기 모달 안의 `#roomCreatePanel`(제목 · 방 종류 · 최대 인원 · 방 목록 공개). 채널 카드를 누르면 카드 · 코드 칸 대신 보이고, [방 만들기] 를 누르면 제목을 확인해 `onCreate(채널, { title, max, open })` 를 부른다. 투게더룸은 보유자만.

**만드는 법** — app.js 의 방 입장 모듈(`roomEntryMod`) 바로 뒤:

```js
TwRoomCreateUi.createRoomCreateUi({
  roomSettings: TwRoomSettings, bannedWords: TwBannedWords, rcStore: ()=>acctStateMod._rcStore(),
  maxPeople: ()=>maxPeople(), isLicensed: ()=>roomEntryMod._myRoomLicensed(),   // 보유자 판정은 방 입장 모듈 한 곳
  onCreate: (ch, settings)=>roomEntryMod.doCreateRoomInChannel(ch, settings),
});
```

**내놓는 것** — `open(채널)` · `close()`(로비의 [방 만들기] 가 연다 · 모달 닫기에 스스로 건다).

**함정**
- 모달(#inviteOverlay) 안이라 클릭 통과 목록(`UI_HIT_SEL`)을 늘리지 않는다 — 창을 모달 밖으로 빼면 거기에 더해야 눌린다.
- 만들기를 room-entry 가 부르면 room-entry ↔ 이 모듈이 서로를 부르는 순환이 된다(`sim-dep-cycles`) — 창은 로비가 deps `openCreate` 로 연다.
- 금칙어는 원격 설정 `bannedWords`(API 를 못 받으면 Firebase `config/bannedWords`) — API 가 이 칸을 아직 안 주면 앱은 거르지 못하고, 목록에는 서버 함수가 한 번 더 거른다.

검사: `checks/sim-room-settings.js`.

## room-lobby-model.js · room-lobby-provider.js · room-lobby-ui.js — 방 목록 로비

**책임**
- `room-lobby-model.js`(순수 · 정원은 `TwRoomSettings.roomCap` — room-settings.js 뒤에 싣는다) — 채널 사본(`roomLobby/{채널}` = `{ at, rooms }`) → 카드 · 상태(`failed` 못 읽음 · `missing` 칸 없음 · `stale` 3분 넘게 그대로 · `ok`) · 정렬(입장 가능 → 인원 많은 순 → 오래 열린 순) · «빈자리 있는 방» 거르기 · 번호 · 쪽(12장) · 빠른시작 고르기.
- `room-lobby-provider.js` — 로비가 읽는 것 한 곳: `listRooms(채널)`(지금은 Firebase 옛 길 · 방 서버 API 가 생기면 여기만 바꾼다) · `mySecretRoom()`(발급 칸 + `secretRooms/{코드}/pub.owner` 가 나일 때 · 만료 전만 — «누구 것인가» 는 세션에 한 번 · 손님 수는 방장을 빼고 열 때마다). F1 «멀티모드» 탭의 시크릿룸 칸(room-entry `_refreshSecretRoomUI`)도 deps `mySecretRoom` 으로 같은 판정을 쓴다.
- `room-lobby-ui.js` — 방 찾기 · 만들기 모달 안 `#lobbyMain`: 탭 · 거르기 · 카드 · 쪽 · [방 만들기] · [빠른시작] · «내 시크릿룸» 줄. 모달을 열 때 · [새로 고침] · 열려 있는 동안 60초마다만 읽는다 — 방 안이면(모달이 «연결된 방» 화면) 읽지 않는다.

**만드는 법** — provider 는 방 입장 모듈보다 먼저(F1 시크릿룸 칸이 같이 쓴다) · 화면은 방 만들기 창 바로 뒤:

```js
const roomLobbyProvider = TwRoomLobbyProvider.createRoomLobbyProvider({ api: ()=>window.firebaseAPI, myUserId: ()=>getMyUserId(), now: ()=>Date.now() });
// … createRoomEntry({ …, mySecretRoom: ()=>roomLobbyProvider.mySecretRoom() })
TwRoomLobbyUi.createRoomLobbyUi({
  model: TwRoomLobbyModel, provider: roomLobbyProvider, inRoom: ()=>Presence.active(),
  maxPeople: ()=>maxPeople(), isLicensed: ()=>roomEntryMod._myRoomLicensed(),
  joinRoom: (code)=>roomEntryMod.startRoom(code), openCreate: (ch)=>roomCreateUi.open(ch),
  toast, notifyError: (...a)=>TwErrorCodes.notify(...a), now: ()=>Date.now(), random: ()=>Math.random(),
});
```

**내놓는 것** — 없음(모달 여는 버튼 `#lcInvite` · `#fsInviteCreate` · 닫기에 스스로 건다).

**함정**
- 카드는 `textContent` 로만 그린다 — 남이 쓴 제목 · 닉네임이 HTML 로 읽히면 안 된다(검사가 `innerHTML` 을 막는다).
- 못 읽음(null)과 빈 목록을 가른다 — 못 읽으면 «못 불러왔어요» + `E-ROOM-03`(사람이 누른 불러오기만 · 60초 갱신은 조용히).
- 탭을 빨리 바꾸면 늦게 온 답을 버린다(`seq`) — 지우면 투게더룸 탭에 워킹룸 목록이 그려진다.
- 목록 숫자는 최대 1분 늦다 — 들어갈 때는 입장 검사가 정원을 다시 본다(목록으로 막지 않는다).
- 60초 타이머는 모달이 닫혔으면(닫기 · 바깥 클릭 · ESC · 입장) 다음 차례에 스스로 멈춘다 — 닫기 버튼에만 기대지 않는다.

검사: `checks/sim-room-lobby-ui.js`.
