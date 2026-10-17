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
