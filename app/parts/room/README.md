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

## `presence.js` — 🛰 방 접속 상태(Presence)

**책임** — 지금 들어가 있는 방(provider · 방 코드 · 친구 목록)과, 내가 방에 보내는 값(상태 · 레벨 · 자리비움 그림 · 백색소음 · 채팅 · 올라타기 …)을 한 곳에서 들고 보낸다.
20분 무반응 자동 자리비움과 6시간 자동 퇴장 시계도 내 상태(`myUserStatus`)를 같이 써서 이 안에 있다.

**만드는 법** — app.js «🛰 방 접속 상태(Presence)» 자리:

```js
const presenceMod = TwPresence.createPresence({
  USER_STATUSES: USER_STATUSES,          // 값 — 상태 목록(부팅 때 저장값 검사)
  roomSyncMod: roomSyncMod,              // 값 — Firebase provider · poke 신선도 · 자동 퇴장 안내
  focusLevelMod: ()=>focusLevelMod,      // 읽는 함수 — 만드는 줄보다 뒤에 선언되는 모듈
  lastAnyInput: ()=>lastAnyInput,        // 읽는 함수 — app.js 가 다시 대입하는 let
  toast: (...a)=>toast(...a),            // 함수
  // … 19개(함수 3 · 값 7 · 읽는 함수 9)
});
const Presence = presenceMod.Presence;   // 옛 전역 이름 — 나머지 코드는 예전처럼 Presence.이름
```

**내놓는 것** — `{ Presence }`. `Presence` 의 함수:

| 함수 | 하는 일 |
|---|---|
| `start(room, def, name, onChange, opts)` | 방에 들어간다. Firebase 방이면 방 코드, `opts.provider`(방 서버)면 `{ ok, code, others, meta }` 를 돌려준다. firebaseAPI 가 끝내 없으면 들어가지 않고 알린다 |
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

**함정**
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
- **함정**: 순환 방어로 16번에서 멈춘다(`_rideDepth` 와 같은 상한) — 바꾸면 둘을 같이. 검사: `checks/sim-ride-chain.js`.
