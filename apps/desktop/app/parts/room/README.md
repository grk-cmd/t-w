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
  roomSyncMod: roomSyncMod,              // 값 — 직렬화 · poke 신선도 · 자동 퇴장 안내
  focusLevelMod: ()=>focusLevelMod,      // 읽는 함수 — 만드는 줄보다 뒤에 선언되는 모듈
  lastAnyInput: ()=>seatStateMod.lastAnyInput(),   // 읽는 함수 — 활동 시각은 status/seat-state.js 가 갖는다
  toast: (...a)=>toast(...a),            // 함수
  // … 16개(함수 2 · 값 7 · 읽는 함수 7)
});
const Presence = presenceMod.Presence;   // 옛 전역 이름 — 나머지 코드는 예전처럼 Presence.이름
```

**내놓는 것** — `{ Presence }`. `Presence` 의 함수:

| 함수 | 하는 일 |
|---|---|
| `start(room, def, onChange, opts)` | 방에 들어간다. `opts.provider`(방 포트 — room-entry `makeRoomProvider`)로 `{ ok, code, others, meta }` 를 돌려준다. provider 가 없으면 가짜 방(개발 표식 `tw.mockRoom=1`)일 때만 · 아니면 `{ ok:false, code:'noProvider' }` |
| `stop()` | 나간다(서버 삭제를 기다리려면 `await`) |
| `setState` · `setUserStatus` · `setCustomStatus` · `setFocusShow` · `setAwayImg` · `setAwaySz` · `setNoise` · `setLevel` | 내 값 하나를 바꾸고 **바뀌었을 때만** 방에 보낸다(`setLevel` 은 회차 칸만 — 이름 · 레벨은 서버가 채운다 · pv 4) |
| `sendChat(text, fly, flyColor, flySize, tab)` | 채팅 한 줄(140자). #일반이 아니면 `chatTab` 칸으로 |
| `poke(friendId, type)` · `pokeSelf(type)` | 남 / 나에게 쓰다듬기 · 흔들기 · 날리기 알림 |
| `updateDef(def)` | 방에 들어간 뒤 바뀐 내 캐릭터를 다시 보낸다 |
| `broadcastRide()` · `broadcastNow()` | 지금 값을 바로 보낸다(올라타기 · 쉬는 시간처럼 틱을 기다리면 늦는 값) |
| `active()` · `roomCode()` · `friendsObj()` · `myDef()` · `serverProvider()` | 읽기 |

```js
if(Presence.active()) Presence.setNoise('pencil');   // 방에 있을 때만 보낸다(방 밖이면 provider 가 없어 아무 일도 없다)
```

**확장할 때 고칠 자리**
- 방에 새 칸을 싣기 → `_basePayload()` 한 곳(매 update 에 같이 나간다). 입장 때도 필요하면 `start()` 의 `provider.join(…)` 객체에도. 방 포트 `room-rt.js MEMBER_FIELDS` · 서버 통신 규약 3장(모르는 칸을 받지 않음)도 같이 본다(`sim-room-parity`).
- 새 setter → `setNoise` 모양(값 거르기 → 같으면 return → 바꾸고 `provider.update(_basePayload())`) · 맨 아래 `return { … }` 에 이름 추가.
- 받은 poke 의 새 종류 → `start()` 안 poke 콜백의 `else if` 줄.
- 자동 자리비움 시간 · 틱 → 위쪽 상수 `AUTO_AWAY_MS` · `AUTO_AWAY_TICK_IDLE_MS` · `AUTO_AWAY_TICK_BACK_MS`.
- 채팅 · 탭 · 날리기 칸 길이 · 자리비움 그림 처음 크기 → 파일 위 상수 `CHAT_TEXT_MAX` · `CHAT_TAB_MAX` · `FLY_COLOR_MAX` · `FLY_SIZE_MAX` · `AWAY_SZ_DEFAULT`(채팅 길이는 서버 규칙과 짝).

**함정**
- 모듈 안에서 `firebaseAPI` 를 보지 않는다 — 방 통신은 `opts.provider` 하나. 신원(`userId`) · 프리미엄(`lic`)은 싣지 않는다(서버가 토큰 · 라이선스로 안다 — 실으면 서버가 badRequest).
- 전역 `setUserStatus`(칩 · 캐릭터 모션까지 바꾸는 쪽)는 꼭 `window.setUserStatus` 로 부른다 — 안쪽에 같은 이름 `setUserStatus` 가 있어 가린다.
- `myAwaySz` 처음 값은 숫자(80)로 둔다 — 서버는 모르는 모양의 칸이 든 patch 를 통째로 거절한다.
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

- **책임**: 좌석 줄 자리 계산 하나. 평준화 반영(`syncSeatEqualize`) → 맨 오른쪽 고정(`TwSeatPin.pinFirst`, 옮겼으면 좌석 탭 다시 그림) → 이동 오프셋을 안전 범위로 → 0번(맨 오른쪽 · x=0)부터 왼쪽으로 «앞 반폭 + 여백 + 내 반폭» 씩 `targetX`(반폭 = 책상 반폭과 «캐릭터 몸 반폭 + 여유 `BODY_ROOM` 0.15» 중 넓은 쪽 — 책상이 작거나 없는 캐릭터가 옆 책상과 안 겹치게 · 🚫 «책상 없음»(`desk.userData.noDesk`)이면 몸을 잰 뒤엔 책상 폭을 안 센다) → 올라탄 좌석은 탑 바닥 자리를 물려받음 → 줄 가운데 · 폭을 캐시하고 `seatCameraMod.applyCameraAndCanvas` 로.
- **책상 끌기 자리** `slotIndexAt(x, seat)` — 끄는 좌석을 뺀 나머지 순서는 그대로 두고, 칸마다 «여기 넣으면 설 자리» 를 줄 배치와 같은 셈으로 내서 x 에서 가장 가까운 칸 번호(splice 번호). app.js 책상 끌기가 부르고 «맨 오른쪽 고정» 은 그 뒤 `TwSeatPin.dragIndex`. ⚠️ 지금 자리(targetX) 중 가장 가까운 것을 고르면 폭이 섞일 때 두 칸을 오가며 떨린다 · 간격으로 나누면 음수 간격에서 방향이 뒤집힌다.
- **좌석 반폭** `seatHalfWidth(s)` — 줄 배치와 같은 규칙(책상 · 🚫 책상 없음 · 몸 폭, 줌 상한 없음)을 좌석 하나에. 평준화 가두기(`character/seat-eq-clamp.js`)가 deps 로 받는다 — 두 곳이 자리 폭을 따로 재면 «책상 없음» 좌석의 파츠가 옆으로 넘어간다. 몸 폭은 마지막 줄 배치에서 잰 값.
- **만드는 법**(app.js «🪑 좌석 배치» 구역 자리):
  ```js
  const seatLayoutMod = TwSeatLayout.createSeatLayout({
    seats,                                                                // 값
    _rideBottom: (...a)=>rideChainMod._rideBottom(...a),                  // 탑 바닥(ride-chain.js — ride-bench 를 부르면 순환)
    syncSeatEqualize, renderSeatTabs, clampDeskPan, seatDeskHalfWidth,   // 함수(화살표로)
    measureCharBox: (...a)=>charMeasureMod.measureCharBox(...a),         // 캐릭터 몸 박스(파츠 제외 · 월드)
    roomSeatMode: ()=>roomSeatMode, deskPanX: ()=>deskPanX, deskPanY: ()=>deskPanY,
    SPACING: ()=>SPACING, MULTIPLAYER_SPACING: ()=>MULTIPLAYER_SPACING, seatCameraMod: ()=>seatCameraMod,
    setDeskPanX: (v)=>{ deskPanX = v; }, setDeskPanY: (v)=>{ deskPanY = v; },
    setCachedRowCenter: (v)=>{ _cachedRowCenter = v; }, setCachedRowSpan: (v)=>{ _cachedRowSpan = v; },
  });
  function layoutSeats(){ seatLayoutMod.layoutAndNotify(); }   // 이름은 app.js 에 남긴다(모든 부르는 곳이 이 이름을 본다)
  seatLayoutMod.onLaidOut(()=>{ /* 데스크탑 창 크기 맞춤 */ });
  ```
- **내보내는 것**: `layoutSeatRow()`(계산만) · `layoutAndNotify()`(계산 뒤 알림 — app.js 의 `layoutSeats()` 가 부른다. 좌석이 늘거나 줄 때 · 책상 크기가 바뀔 때 · 창 크기가 바뀔 때) · `onLaidOut(fn)` · `seatHalfWidth(s)` · `slotIndexAt(x, seat)`.
- **배치한 뒤 알림**(F4) `layoutAndNotify()`(app.js 의 `layoutSeats()` 가 부른다) = `layoutSeatRow()` 뒤에 `onLaidOut(fn)` 으로 건 일을 거는 차례대로 부른다 — app.js 가 데스크탑 창 크기 맞춤(`resizeWidget` · `applyDesktopRunClass`)을 건다(옛: `layoutSeats` 를 감싸 다시 대입). `layoutSeatRow` 가 일찍 끝나도 알림은 간다.
- **확장할 때 고칠 자리**: 줄 폭 하한 `ROW_SPAN_MIN` · 간격 값은 seats.js 의 `SPACING` · `MULTIPLAYER_SPACING`(설정 창이 바꾼다) · 책상 반폭 재기는 app.js `seatDeskHalfWidth` · 고정 규칙은 `seat-pin.js`.
- **함정**
  - 모듈 안에서 `layoutSeatRow` 를 직접 부르면 알림(데스크탑 창 크기 맞춤)이 빠진다 — 밖에서는 app.js 의 `layoutSeats()` 만 부른다.
  - `seats` 배열의 순서 · 내용은 안 바꾼다(좌석 탭 · 슬롯 드래그가 인덱스를 쓴다). 올라탄 좌석은 계산에서만 뺀다.
  - 1번 자리부터 책상 반폭에 줌 상한(1.1)이 걸리는 지금 동작은 `CONFIRM.md` 에 적어 둠(`seatDeskHalfWidth(s, i)` 가 인덱스를 forZoom 으로 넘김 — 몸 폭 규칙을 넣으면서도 그대로 뒀다).
  - 검사: `checks/sim-seat-layout.js`(4절 — 혼자 · 셋 · 친구 간격 · 올라탄 좌석 · 고정 · 오프셋 · 폭 0 · 빈 목록 · 책상 없는 좌석 몸 자리 · 🚫 책상 없음 표시).

## label-measure.js — 📐 좌석 라벨 잰 값 기억

- **책임**: 경험치 바 · 이름표 · 공지 · 말풍선이 매 프레임 쓰는 «잰 값»(캔버스 사각형 · 라벨 크기)을 기억해, 자리를 적은 뒤 바로 다시 재는 강제 레이아웃을 없앤다. 순수 모듈(DOM 읽기는 deps).
- **만드는 법**: `overhead.js` 가 만들 때 `TwLabelMeasure.createLabelMeasure({ readCanvasRect, now })` — html · smoke PRELOAD 에서 overhead.js 보다 먼저.
- **내보내는 것**
  - `beginFrame()` — 프레임 맨 앞(app.js `frame()` 이 `overheadMod.beginLabelFrame()`)에서 캔버스 사각형을 비운다. 이번 프레임 첫 `canvasRect()` 가 새로 잰다.
  - `size(el, key)` — `{ w, h }`. 열쇠(글 · 클래스)가 같고 `REFRESH_MS`(500) 안이면 기억한 값, 숨었거나 0 이면 마지막 값.
  - overhead.js 가 밖에 내놓는 이름: `beginLabelFrame` · `canvasRect`(히트 맵 — seat-hit-targets.js 가 같은 사각형을 쓴다) · `labelSize` · `nameplateHeight(seat)`. 바 · 이름표 · 공지는 자리를 적으며 아래변을 `el._bottom` 에 남기고, 뒤에 도는 이름표 · 말풍선 · 공지는 사각형 대신 그것을 읽는다.
- **함정**
  - `beginLabelFrame` 을 빼면 캔버스 사각형이 영영 안 바뀐다(창 크기가 바뀌어도 라벨이 옛 자리) — `checks/sim-label-measure.js` 가 frame 안 자리를 본다.
  - 프레임 루프 순서(바 → 이름표 → 공지 → 말풍선 → 상태칩)가 곧 `_bottom` 이 이번 프레임 값인 까닭이다. 순서를 바꾸면 한 프레임 전 값을 읽는다.
  - 상태칩(`status-chip.js`)은 아직 사각형을 직접 읽는다 — 프레임에 한 번(그 자리에서 이번 프레임 쓰기가 한꺼번에 반영)이라 그대로 뒀다.

## seat-sync-diff.js — 🪑 친구 좌석 맞추기 뒤 «줄 배치를 다시 할지»

- **책임**: `syncFriendSeats`(room-entry.js) 끝에서 지난번 모양과 이번 모양을 견줘 `{ layout, tabs }` 를 낸다. 순수 함수(DOM · 서버 없음). 상태 · 경험치 같은 칸만 바뀐 메시지에 좌석 줄 전체(모든 좌석 몸 · 책상 재기 · 창 크기 IPC · 탭 innerHTML · 상태칩)를 다시 하지 않게.
- **만드는 법**: 없음(값 모듈). `room-entry.js` 가 `const seatSyncDiff = TwSeatSyncDiff;` 로 받는다 — html · smoke PRELOAD 에서 room-entry.js 보다 먼저.
- **내보내는 것**
  - `snapshot(seats, friends, ids)` — `{ members, shape, tabs }`. members 는 멤버마다 «배치에 닿는 칸» 열쇠(NON_LAYOUT_FIELDS 밖의 칸 + 좌석의 def 지문 셋), shape 는 좌석 순서 · 올라타기 · 벤치 · 책상(보이는 자식 · 크기 · 자리) · 몸 모델 · 크기 배율, tabs 는 탭 글(이름 · 친구 상태).
  - `plan(prev, next)` — 멤버 출입 · 멤버 열쇠 · 모양 중 하나라도 다르면 `layout`, 아니면 탭 글이 다를 때만 `tabs`. 처음(prev 없음)은 다 한다.
  - `NON_LAYOUT_FIELDS` · `memberKey` · `seatShapeKey` · `seatTabsKey`.
- **함정**
  - `NON_LAYOUT_FIELDS` 에는 «좌석에 값만 적고 프레임 반복 · 클릭이 그때그때 읽는» 칸만 둔다. 모르는 칸은 늘 다시 배치한다(새 판이 보낸 칸이 배치에 닿을 수 있다).
  - 책상 GLB 는 비동기로 늦게 붙고 그 자리에서 줄 배치를 부르지 않는다 — 모양(shape)에 책상 자식을 넣은 까닭이다. 빼면 늦게 붙은 책상이 옆 책상과 겹친 채 남는다.
  - 매 프레임 흔들리는 값(group.position · rig · bodyWrap.scale 호흡)을 모양에 넣으면 늘 «바뀜» 이라 건너뛰기가 죽는다.
  - 검사: `checks/sim-seat-sync-diff.js`(표 · 실제 syncFriendSeats 부른 수 · 깨 보기).

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
  - 팔 높이는 좌석 기울임을 지우고 잰다(대상 머리 재기와 같은 규칙) — 탄 채로 다시 재면(`_remeasureRideArm`) 대상 고개 기울기가 섞인다.
  - 임시 벡터(`_rideFootTmpV` 등)를 돌려주지 않고 `clone()` 한다 — 호출부가 값을 들고 있어도 안전.
  - 검사: `checks/sim-ride-measure.js`(4절 — 실제 three 로 회전 · 위치를 뺀 오프셋 · 경계 0.3 · 들린 rig 상쇄 · 크기 0 · 기울어진 채 잰 팔 높이).

## seat-hit-targets.js — 🎯 좌석의 누를 수 있는 조각 · 히트 맵 만들기

- **책임**: 좌석 group 아래에서 스스로 raycast 를 가진 자손(three `intersectObject` 처럼 layers 도 봄)을 조각으로 모아, 조각마다 경계 구를 `launcher/hit-map.js` 로 화면 사각형에 올린다. 지도는 판정이 찾을 때(`pick`) 지금 지도가 마지막으로 그린 장(`markRendered`) 것이 아니면 그때 한 번 만든다 — 마우스를 안 움직이면 비용 0. 새 판정 `pick(ray, x, y, allowRay)` 은 커서를 덮는 조각에만 광선을 쏜다 — 지도를 못 만들었으면 모든 좌석에 광선(지금 판정과 같은 길). 결과는 늘 같은 객체. 다를 때 줄 재료는 `describe`.
- **조각에서 빼는 것**: 통과 판정이 히트에서 빼는 것과 같다 — 날아가는 몸 · 숨은 책상(`hidden-seats.js` `_partSkipped` 한 곳). 숨은 자리비움 몸은 넣는다(쓰다듬기).
- **경계 구**: 메시 = `Mesh.raycast` 와 같은 구(boundingSphere × matrixWorld · 없으면 그때 셈) · 스프라이트 = 자리 + 크기(center · 회전까지 덮는 반지름) · 그 밖(InstancedMesh · Line · 끈 raycast · 거리로 크기를 바꾸는 스프라이트) = «전체»(늘 후보 — 모르는 것을 멀다로 치지 않는다).
- **만드는 법**: `TwSeatHitTargets.createSeatHitTargets(deps)` — app.js 가 1분 진단 바로 앞에서. deps: `THREE` · `hitMap`(TwHitMap) · `seats` · `camera` · `ray`(통과 판정의 Raycaster) · `canvasRect`(= `overheadMod.canvasRect` — 이번 장에 한 번 잰 값) · `officeHidden` · `configHidden`(= app.js `_configHidesScene` — 그리기를 건너뛰는 조건과 같은 판단) · `isRunmode` · `partSkipped` · `skipHits`(= `hiddenSeatsMod._partSkipped` · `_skipUnhittable`) · `now` · `noteBuild`(= `hitShadow.build`).
- **부르는 곳**: `frame()` 의 `renderer.render` 바로 뒤 `seatHitMod.markRendered()` 한 줄(표시만) · desktop-run 의 그림자 운행(`pick` · `describe`). 빈 지도 까닭(회사원 숨김 · 설정 화면 · 실행 화면 아님)은 모듈이 deps 로 판단한다.
- **함정**: «파츠가 바뀌면 비운다» 같은 무효화를 두지 않는다 — 장 번호가 바뀌면 다시 만든다. 같은 장 안에서 지도를 만든 뒤 누가 `updateMatrixWorld` 를 따로 부르면(누르기 · 몸 재기) 광선은 새 행렬, 지도는 그 전 행렬을 본다 — 여유 8px 이 덮는지는 그림자 운행의 `지도만통과` 가 본다.
- **검사**: `checks/sim-seat-hit-targets.js` — 진짜 three 좌석 넷(앉음 · 날아감 · 올라탐 · 자리비움 + 스프라이트 · 끈 대역 · 선)에서 화면 격자 1만 점을 옛 판정과 견줌 · 낡음 · 못 만듦 · 건너뜀 · 깨 보기.

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
  - 동물 팔 기본각 `ANIMAL_HAND_REST` 는 app.js 에 남아 있다(animal.js 는 deps 로 받는다).
  - 검사: `checks/sim-ride-tuning.js`(4절 — 값 표 50개가 옮기기 전과 같다 · 임시 객체가 따로따로 · 값 범위).

## seat-refit.js — 🪑 파츠 구성이 바뀐 뒤 좌석 다시 맞추기

- **책임**: 파츠를 붙이거나 뗀 좌석을 한 순서로 다시 맞춘다 — 끝난 장착 기다리기(거부돼도 다시 맞추기는 한다) → 아직 같은 좌석 · 같은 캐릭터인지 → `fitModel`(발밑 깊이 · 리깅 파츠) → `layoutSeats`(원할 때만) → 다시 맞춘 뒤 알림(app.js 가 건 올라탄 사람 높이 다시 재기 `rideBenchMod._remeasureRideHeadTop`).
- **만드는 법**(app.js «🪑 좌석 배치» 자리 — `layoutSeats` 바로 뒤 · `rideBenchMod` 보다 뒤):
  ```js
  const seatRefitMod = TwSeatRefit.createSeatRefit({
    fitModel: (...a)=>fitModel(...a),
    layoutSeats: (...a)=>layoutSeats(...a),   // 부를 때 찾게 화살표로
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

## room-settings.js — 방 설정 규칙(제목 · 보일 제목 · 최대 인원 · 방장 닉네임)

**책임** — 방 만들기 창 · 방 안 [방 설정] · 로비 카드 · 입장 정원 검사 · 들어간 뒤 자기 퇴장이 같이 부르는 판정 한 곳(순수 함수 · DOM · firebase 없음). 제목 확인(`checkTitle` — 빈 제목 통과 · 20자 · 금칙어), 보일 제목(`displayTitle` — 비었거나 금칙어면 «닉네임 님의 방» · 닉네임도 없으면 «이름 없는 방»), «공개» 안내 글(`OPEN_HINT`), 최대 인원 고르기(`clampMax` — 2 ~ 정원), 방 정원(`roomCap` — `_meta.max` 와 원격 정원 중 작은 쪽), 방장 닉네임(`hostNameOf`), 방 서버 만들기 칸(`serverCreateOf` — `join.create` 의 `{ channel, open, title?, max?, music? }` · 빈 칸은 뺀다 · 방장 이름은 서버가 정해서 안 싣는다), 방 서버 join 에 실을 create 고르기(`serverJoinCreate` — 만들기면 `serverCreateOf` · 시크릿룸을 주인이 열면 `{ channel: 'togetherroom', music }` · 그 밖은 null).

**만드는 법** — classic script(`window.TwRoomSettings`)를 app.js · firebase-init.js 보다 먼저 싣는다. room-entry 는 deps `roomSettings` 로, firebase-init(모듈)은 `window.TwRoomSettings` 로 부른다(원격 설정 정원을 `window.TwRemoteConfig` 로 읽는 것과 같은 자리).

**내놓는 것** — `TITLE_MAX` · `HOST_NAME_MAX` · `ROOM_MAX_MIN` · `ROOM_MAX_MAX` · `TITLE_ERROR_TEXT` · `OPEN_HINT` · `checkTitle` · `displayTitle` · `clampMax` · `roomCap` · `hostNameOf` · `serverCreateOf` · `serverJoinCreate`.

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

## room-info-ui.js — 방 안 제목 줄 · [방 설정]

**책임** — 방 안 정보 칸(`#inviteActive`) 맨 위 방 제목 줄과, 현재 방장에게만 보이는 [⚙ 방 설정](제목 · 공개 바꾸기). 제목은 `_meta.title` 을 `displayTitle` 로 그린다(금칙어 · 빈 제목 → 기본값). 저장은 deps `saveInfo` 한 곳 — 방 포트 `meta{ title, open }`(provider `setMeta` · 방장만 · 서버가 판정). 서버 거절(`title` 금칙어 · `forbidden` 방장 아님)은 칸 아래 글로, 그 밖의 실패는 `E-ROOM-04`.

**만드는 법** — app.js 에서 방 입장 모듈보다 먼저:

```js
const roomInfoUi = TwRoomInfoUi.createRoomInfoUi({ roomSettings: TwRoomSettings, bannedWords: TwBannedWords, rcStore: ()=>acctStateMod._rcStore(),
  isHost: ()=>TwRoomState.isHost(window._roomMetaCache, TwRoomRt.store.myCode()), isSecretRoom: ()=>TwRoomState.isSecretCode(…),   // 채팅 잠금과 같은 판정(room-state.js)
  roomCode: ()=>(Presence.active() ? Presence.roomCode() : null), meta: ()=>window._roomMetaCache,
  saveInfo: (room, info)=>(Presence.serverProvider() ? Presence.serverProvider().setMeta(info) : Promise.resolve({ ok:false, code:'notInRoom' })),
  notifyError: (...a)=>TwErrorCodes.notify(...a) });
// … createRoomEntry({ …, paintRoomInfo: ()=>{ roomInfoUi.paint(); listenUi.sync(); } })   // 같이 듣기도 같은 자리(listen-ui.js)
```

**내놓는 것** — `paint()`. 방 입장 모듈이 들어감 · 나감(`refreshInviteUI`) · 서버 meta 때 부른다.

**함정**
- 서버가 «방장만» 을 지킨다(`forbidden`) — 화면의 방장 판정은 버튼을 보일지만 정한다.
- 방 포트 setMeta 는 이미 그 값이면 보내지 않고 바로 ok 다 — 바뀐 게 없으면 서버가 meta 를 안 보낼 수 있어 기다리면 시간 초과로 끝난다.
- 시크릿룸은 «공개» 칸이 없고 공개를 쓰지 않는다(목록에 원래 안 나온다).
- `_roomMetaCache` 를 이 모듈이 고쳐 쓰지 않는다(`sim-room-state` — 쓰는 곳은 정해져 있다) — 저장 뒤 제목 줄은 서버가 방 전원에게 보내는 meta 가 다시 그린다.
- 최대 인원 · 같이 듣기는 만들 때만 정한다(설계 5.1).

검사: `checks/sim-room-info-ui.js`.

## recent-rooms.js · recent-rooms-ui.js — 🕘 최근 들어간 방

**책임** — 방에 연결되면 코드 · 제목 · 시각을 이 PC 에 남기고(최대 3개 · 같은 방은 맨 앞으로), 로비 코드 칸을 비운 채 누르면 위로 펼쳐 보여 준다. 줄을 누르면 로비 카드와 같은 길(`roomEntryMod.joinRoom` — 입장 중이면 넘김)로 들어간다. 시크릿룸도 남긴다(사용자 결정).

**만드는 법** — app.js 가 방 입장 모듈 바로 뒤에서:

```js
const recentRooms = TwRecentRooms.createRecentRooms({ storage: localStorage, getMyUserId, now, isRoomCode: roomEntryMod.isRoomCode });
roomEntryMod.onRoomJoined((code, meta)=>recentRooms.record(code, TwRoomSettings.displayTitle(meta && meta.title, meta && meta.hostName,
  TwBannedWords.cleanBannedList(acctStateMod._rcStore().bannedWords()), TwBannedWords).text));
TwRecentRoomsUi.createRecentRoomsUi({ document, recent: recentRooms, agoText: TwRecentRooms.agoText, now, joinRoom: (code)=>roomEntryMod.joinRoom(code) });
```

room-entry 는 이 모듈을 모른다 — «방에 연결됨» 알림(`onRoomJoined`)에 위층이 건다(`onRoomChanged` 와 같은 방식).

**내놓는 것** — `parse(raw, isCode)` · `add(list, code, title, at, isCode)` · `agoText(ms)`(순수 — 방 코드 모양은 room-entry `isRoomCode` 한 곳을 받는다) · `createRecentRooms(deps)` → `{ list(), record(code, title) }` · `createRecentRoomsUi(deps)` → `{ show(), hide() }`.

**함정** — 저장 키는 계정마다(`tw.recentRooms.<내 id>`) — 한 PC 를 둘이 써도 앞 사람의 방 코드가 안 보인다 · 내 id 가 없으면 기록 · 목록 없음. 서버에 올리지 않는다(읽기 · 쓰기 0). 방 제목은 남이 정한 값이라 textContent 로만 그리고, 기록할 때 방 안 제목 칸과 같이 금칙어를 거른다. 계정마다 3줄씩 이 PC 에 남는다(로그아웃 지움 목록에는 안 넣었다 — 키가 계정마다라 섞이지 않는다). 목록은 칸이 비었을 때만 — 글자를 치면 접힌다.
검사: `checks/sim-recent-rooms.js`.

## room-lobby-model.js · room-lobby-provider.js · room-lobby-ui.js — 방 목록 로비

**책임**
- `room-lobby-model.js`(순수 · 정원은 `TwRoomSettings.roomCap` — room-settings.js 뒤에 싣는다) — 채널 목록(`{ at, rooms: { 코드: { t, n, max, hn, mu, since } } }` — provider 가 API 답을 이 모양으로 바꾼다) → 카드 · 상태(`failed` 못 읽음 · `missing` 칸 없음 · `stale` 3분 넘게 그대로 · `ok`) · 정렬(입장 가능 → 인원 많은 순 → 오래 열린 순) · «빈자리 있는 방» 거르기 · 번호 · 쪽(12장) · 빠른시작 고르기.
- `room-lobby-provider.js` — 로비가 읽는 것 한 곳: `listRooms(채널)`(API `GET /v2/rooms/lobby?channel=` — realtime 서버가 지금 연 공개 방 · 못 받거나 모양이 틀리면 `null`) · `mySecretRoom()`(`GET /v2/me/secret-room` → `{ code, name, expiresAt }` — 로그인마다 한 번 읽고 기억 · 만료 전만 · `null` 은 «없음» 뿐 — 읽기 실패 · 읽는 중 계정이 바뀜은 던진다. 비우는 일은 `reset()`(session.onReset · license 알림)만, uid 를 견주어 스스로 비우지 않는다) · `secretGuests(코드)`(손님 수 — 방 포트 `peek` · 내가 그 방 안이면 나를 뺀다 · 로비 줄만 부른다). F1 «멀티모드» 탭의 시크릿룸 칸 · 방 입장(내 시크릿룸이면 주인이 늘 `create{ music }` 를 싣는다 — 비었는지는 서버가 가른다)도 deps `mySecretRoom` 으로 같은 판정을 쓴다. 방 입장은 내 방인지 읽기가 실패하면 손님으로 들어가지 않고 `E-ROOM-08` 로 멈춘다.
- `room-lobby-ui.js` — 방 찾기 · 만들기 모달 안 `#lobbyMain`: 탭 · 거르기 · 카드(위 띠 «입장 가능» / «가득 참») · 쪽 · [방 만들기] · [빠른시작] · 아래 줄 방 코드 칸과 [입장](room-entry 가 건다 — 빈 칸이면 «방 코드를 입력하세요» 만 · 랜덤 입장은 [빠른시작] 하나) · «내 시크릿룸» 줄. 모달을 열 때 · [새로 고침] · 탭을 바꿀 때만 읽는다(주기 갱신 없음) — 방 안이면(모달이 «연결된 방» 화면) 읽지 않는다.

**만드는 법** — provider 는 방 입장 모듈보다 먼저(F1 시크릿룸 칸이 같이 쓴다) · 화면은 방 만들기 창 바로 뒤:

```js
const roomLobbyProvider = TwRoomLobbyProvider.createRoomLobbyProvider({ apiGet: (p, o)=>TwApi.authed.get(p, o), peek: (code)=>TwRoomRt.store.peek(code),   // 로그인 API 통로 · 방 포트
  roomCode: ()=>(Presence.active() ? Presence.roomCode() : null), myUserId: ()=>getMyUserId(), now: ()=>Date.now() });
// … createRoomEntry({ …, mySecretRoom: ()=>roomLobbyProvider.mySecretRoom() })
TwRoomLobbyUi.createRoomLobbyUi({
  model: TwRoomLobbyModel, provider: roomLobbyProvider, inRoom: ()=>Presence.active(), twNav,
  maxPeople: ()=>maxPeople(), isLicensed: ()=>roomEntryMod._myRoomLicensed(),
  joinRoom: (code)=>roomEntryMod.joinRoom(code), openCreate: (ch)=>roomCreateUi.open(ch),
  toast, notifyError: (...a)=>TwErrorCodes.notify(...a), now: ()=>Date.now(), random: ()=>Math.random(),
});
```

**내놓는 것** — 없음(모달 여는 버튼 `#lcInvite` · `#fsInviteCreate` · 닫기에 스스로 건다).

**함정**
- 카드는 `textContent` 로만 그린다 — 남이 쓴 제목 · 닉네임이 HTML 로 읽히면 안 된다(검사가 `innerHTML` 을 막는다).
- 못 읽음(null)과 빈 목록을 가른다 — 못 읽으면 «못 불러왔어요» + `E-ROOM-03`(모달 열기 · 새로 고침 · 탭 바꾸기 — 모두 사람이 한 일).
- 탭을 빨리 바꾸면 늦게 온 답을 버린다(`seq`) — 지우면 투게더룸 탭에 워킹룸 목록이 그려진다.
- 목록 숫자는 읽은 때의 것이다 — 들어갈 때는 입장 검사가 정원을 다시 본다(목록으로 막지 않는다).
- 방 안에서 모달을 열면 로비는 안 읽는다. 모달이 열린 채 방을 나오면(나가기 · 해산 · 정원 초과) room-entry `refreshInviteUI` 가 «방 안 → 밖» 순간에 `twNav.go(NAV.ROOM_LOBBY)` 로 알리고, 로비가 그때 읽는다 — 서로의 모듈을 부르지 않게 창 열기 통로를 쓴다.
- 방 만들기 창의 [방 만들기](`doCreateRoomInChannel`)도 같은 깃발을 입장이 끝날 때까지 쥔다 — 빨리 두 번 누르면 «방에 들어가는 중» 안내(0.12.3 은 조용히 버림 · 0.13 은 사용자 확인으로 안내) · 창은 먼저 닫혀 친 제목은 남지 않는다.
- 카드 · [빠른시작] · «내 시크릿룸» 입장은 room-entry `joinRoom` 으로 — «입장 중» 깃발(`_joiningRoom`) 하나를 코드 칸 [입장] · F1 칸 · 🕘 최근 방과 같이 쓴다. 로비에 따로 깃발을 두지 않는다(두면 서로를 못 막는다). 입장 중에 또 누르면 «방에 들어가는 중이에요 — 잠시만 기다려 주세요» 토스트(`_joinBusy` 한 곳).

검사: `checks/sim-room-lobby-ui.js`.

## listen-model.js · listen-provider.js · listen-ui.js — 🎧 같이 듣기

**책임** (설계 `docs/LISTEN_TOGETHER.md`)
- `listen-model.js`(순수 · `TwListenModel`) — 지금 위치(`posOf` — 서버 시각 기준) · 보낼 위치(`wirePos` — `posOf` 를 0~`MUSIC_POS_MAX`(86400초 · 방 서버 `music.pos` 범위)로 자름) · 어긋남(5초 넘고 광고가 아닐 때만 `needSeek`) · **지금 DJ 판정 한 곳**(`djOf` — 방에 있는 현재 방장 · 없으면 null) · 곡 끝 예비 판정(`isEnded` — 길이 + 3초) · 다음 · 이전 곡(`stepIndex` · `playableFrom`) · `_music` 한 줄(`makeMusic` · `paused` · `resumed` · `withDur` — 차례 +1 · 상한 10억) · 하트비트 읽기(`parseBeat`). 범위는 규칙 `rooms/$room/_music` 과 같다.
- `listen-provider.js` — 곡 칸 구독(부르자마자 `undefined` = 불러오는 중 → 값 | `null` = 틀 곡 없음) · 쓰기 · `now()` · `lastSeq()`(칸이 빈 뒤 첫 곡의 앞 차례 — 서버가 마지막으로 받아들인 차례 · 방 밖이면 -1). 부를 때마다 deps `server()`(지금 방의 방 포트 provider) 로 — 서버 `music` 메시지(`onMusic` · `sendMusic` · `serverNow` = welcome · music 의 `now` 로 맞춘 시계 — 방 밖이거나 아직 못 맞췄으면 `null`, PC 시계로 대신하지 않는다: `now()` 도 `null` · 곡 쓰기는 `{ err:'noClock' }` + `console.warn`). 방 밖이면 아무 일 없음.
- `listen-ui.js`(`TwListenUi`) — 같이 듣기 방(`_meta.music === true` — 방 서버 방도)에 있는 동안만 구독 · 상태칩 🎵 버튼을 🎧 로 바꿔 `#listenBox`(칩 안 팝업) 를 연다 · 재생 창 세 번째 주인 `listen` 으로 곡을 지금 위치부터 연다 · DJ 만 곡 칸을 쓴다(빈 칸 → 첫 곡 · 곡 끝 → 다음 · 옛 DJ 곡 다음은 내 첫 곡 · 옛 DJ 가 멈춘 채 나갔으면 다시) · 다른 음악이 재생 창을 가져가면 «[다시 듣기]» · 나가면 닫는다(내 플레이리스트는 멈춘 채). 소리 크기 · 음소거는 이 기기(`tw.listenVol` · `tw.listenMute`).

**만드는 법** — app.js 에서 방 입장 모듈보다 먼저 만들고, 방 입장 모듈의 «방이 바뀜» 알림(`onRoomChanged` — 들어감 · 나감 · meta)에 `sync` 를 건다. 방 입장 모듈은 같이 듣기를 모른다(deps 로 넘기면 방 입장 → 같이 듣기 → 플레이리스트 → … 순환):

```js
const listenUi = TwListenUi.createListenUi({ model: TwListenModel,
  provider: TwListenProvider.createListenProvider({ server: ()=>Presence.serverProvider(), model: TwListenModel }),
  companion: ()=>window.companion, roomCode, meta, isSecretRoom, myId, memberIds, nameOf,
  djItems: ()=>plMod.mine().slice(), stopPersonal: ()=>plMod.stopIfPlaying(), positionPopup: (el, btn)=>statusChipMod._positionCascade(el, btn, 'right'),
  escRegisterWindow, notifyError });
// … const roomEntryMod = createRoomEntry({ … })
roomEntryMod.onRoomChanged(()=>listenUi.sync());
```

**내놓는 것** — `sync()`(들어감 · 나감 · meta) · `djId()`(이름표 «🎧 DJ» 딱지 — app.js 가 `setSeatNamePlate` 다섯째 인자로).

**함정**
- 같이 듣기는 방을 만들 때(`join.create.music`)만 정한다. 시크릿룸은 **주인이 빈 방을 열 때만** 정한다(손님이 들어올 때마다 쓰면 듣던 곡이 지워진다 · F1 «내 시크릿룸을 같이 듣기로 열기» `tw.secretRoomMusic`).
- 곡 쓰기의 `by` · `at` 은 서버가 정한다 — 지금 위치(`pos`)는 `listen-provider.js` 가 `model.wirePos`(서버 시계 · 0~86400 으로 자른 `posOf`)로 재서 넘기고, `room-rt.js musicToWire` 는 칸 이름만 바꾼다(위치 계산은 listen-model 한 곳).
- 방 서버는 곡을 지운 뒤에도 마지막 차례를 기억한다(`welcome.musicSeq` · `music.seq`) — 칸이 빈 뒤 첫 곡은 `provider.lastSeq()` 다음 차례로 쓴다(-1 로 쓰면 stale 로 늘 거절된다).
- 곡을 열 때 내 플레이리스트 창을 닫지 않는다(닫기는 늦게 끝나 막 연 곡까지 닫는다) — 여는 쪽이 창을 넘겨받고 플레이리스트는 `onBgmMode` 로 진다. 닫는 건 틀 곡이 없거나 멈춤일 때만.
- 재생 창 «닫힘» 알림은 늦게 올 수 있다 — 내가 닫은 수(`selfCloses`)를 세어 «다른 음악이 이김» 과 가르고, 그 사이 내가 연 곡이 같이 닫혔으면 다시 연다.
- 이어받은 DJ 가 멈추거나 다시 튼 곡은 쓴 사람(`by`)을 그 DJ 로 바꾼다 — «옛 DJ 가 멈춘 채 나감» 으로 다시 읽혀 멈춤이 바로 풀리지 않게.
- 다음 곡 쓰기가 막히면 그 차례 표시를 되돌린다(⏭ 로 다시 넘길 수 있게) · 저절로 다시 쓰지 않는다 — 사람이 누른 버튼 · 서버가 보낸 새 곡 신호 · 방 옮김이 풀어 준다(R4).
- 재생 창 알림은 처음 방에 들어갈 때 건다 — 앱 밖(웹 미리보기 · smoke)에는 companion 이 없다.
- 같은 곡은 열쇠 `id|at` 로 가린다 — 길이만 적힌 쓰기(at 그대로)는 다시 안 열고, 다시 틀기(at 이 바뀜)는 멈춘 자리에서 새로 연다.
- 창(`#listenBox`)은 상태칩 팝업 규칙표(`status/chip-popups.js`)에 플레이리스트 창처럼 `keep` 으로 든다 — 드롭메뉴를 열어도 남고 회사원 모드 숨김(force)에만 닫힌다 · 열 때는 드롭메뉴를 닫는다(deps `closeChipPopups`).
- 방 만들기 창의 «🎧 같이 듣기 방» 칸은 늘 보인다(방은 서버 하나라 같이 듣기를 받는다).
- 실패 번호: `E-ROOM-05` 쓰기 실패(DJ) · `E-ROOM-06` 못 트는 곡(곡마다 한 번) (`E-ROOM-07` 구독 거부는 realtime 으로 옮기며 걷음 — 구독이 거부될 길이 없다).

검사: `checks/sim-listen-model.js` · `checks/sim-listen-provider.js` · `checks/sim-listen-ui.js`.

## `room-rt.js` — 🛰 방 포트(realtime 연결 하나 위 · 서버 통신 규약 pv 4)
- 책임: 방 하나에 들어가 있는 동안의 통신(`join` · `patch` · `def` · `chat` 말풍선 · `poke` · `meta` · `music` · `leave`)과 방 밖의 `random` · `peek`. 받은 메시지는 presence.js 가 받던 친구 객체 모양으로 바꿔 넘긴다. 연결 · 토큰 · 다시 붙기는 `realtime/rt-hub.js` 몫 — 여기는 «방 안이면 다시 붙을 때 `resume`» · «15초 넘게 끊기면 알림» · «90초(`room.timing.clientGiveUpMs`) 못 돌아오면 포기» 만 본다.
- 서버가 정하는 것(정원 · 같은 계정 중복 · 승계 · 해산 · 채널 · 시크릿룸 입장 · 방 상한 · 버전)은 다시 판단하지 않는다 — 거절은 `join` 의 `{ ok:false, code }` 로 돌려준다(`full` · `channelFull` · `secretClosed` · `forbidden` · `title` · `version` · `unavailable` · `timeout` · `off` · `auth` · `sessionLost`).
- 앱과 서버의 모양 차이는 이 파일 한 곳: 대화 탭 앱 `s1` · `s2` ↔ 서버 `S1` · `S2`(`tabToWire` · `tabFromWire` · 대화 기록은 `historyTabOf` → `GENERAL` · `S1` · `S2`) · 친구 객체 `userId` = 서버가 붙인 `userCode` · `me.userId` · `lic` · `name` · `level` 은 싣지 않는다(서버 badRequest — 이름 · 레벨은 서버가 계정에서 채워 멤버 · `patch{ memberId, name, level }` · `meta.hostName` 으로 준다 · `name` 은 문자열 | `null`(이름 없음 — 그릴 때 «나», `shared/person-name.js`)).
- 만드는 법: classic script(`window.TwRoomRt`) — `rt-hub.js` · `remote-config.js` 다음 · app.js 보다 먼저. 앱 한 벌은 `TwRoomRt.store`(`TwRtHub.store` 위). provider 는 `store.makeProvider(hooks, { create })` — hooks: `serializeDef` · `deserializeDef` · `retryDefAfter` · `getExp` · `onMeta` · `onDisband` · `onReplaced`(내 자리 `left{replaced}` — 같은 계정이 다른 PC 에서 이 방에 들어옴 · 연결은 그대로) · `onLost(code)`(이 PC 연결이 4004 로 끊기면 `sessionLost`) · `onReconnecting(on)` · `onJoined` · `onLeft`.
- 내놓는 것: `makeProvider` · `random(limit, channel)` · `peek(code)`(못 물으면 `null`) · `roomCode()`(들어가 있는 방) · `myCode()`(연결의 나 — 방장 · 글쓴이 · 사진 자리 판정은 이 값) · `isReady()` · `inRoom()`.
- 함정: 연결이 꺼져 있으면(로그인 전 · 로그아웃) 입장은 바로 `off` — 켜기(`TwRtHub.store.start`)는 로그인 흐름 몫이다. `error.ref` 가 방 요청(`join` · `meta` · `music` …)인 것만 받는다 — 대화(`chatSay`) · 사진(`photo*`) · 초대 오류는 그 포트가 받는다.
- 검사: `checks/sim-room-rt.js`(진짜 rt-hub · 연결 공통부 위에서 · 깨 보기).

## `room-invite-rt.js` — 🙋 방 초대 포트(realtime 연결 하나)
- 책임: 초대 보내기 `roomInvite{ to }` · 받기 `roomInvited{ from, fromName, room, ts }` · 지우기 `roomInviteClear{ from }`. 방 코드 · 보낸 이름은 서버가 채운다(이름이 없으면 `fromName` 은 빈 글 — 그대로 들고, 화면이 그릴 때 «이름 없음») · 친구가 아니면 `ROOM_INVITE_NOT_FRIEND` · 한 쌍에 하나 · 10분 보관(로그인 뒤 붙으면 남은 초대를 서버가 다시 보낸다).
- 만드는 법: classic script(`window.TwRoomInviteRt`) — `rt-hub.js` 다음 · app.js 보다 먼저. 앱 한 벌 `TwRoomInviteRt.store` 를 `room-invite-ui.js` 가 deps `invites` 로 받는다.
- 내놓는 것: `send(to)` → `{ ok }` | `{ ok:false, code }` · `onInvites(fn)`(지금 것을 바로 한 번 · `{ 보낸 사람: { fromName, roomCode, ts } }`) · `clear(from)`.
- 함정: 보내기는 rid 요청이다 — 성공은 서버 `roomInviteSent` · 실패는 같은 rid 의 `error`(`ROOM_INVITE_NOT_FRIEND` 등) · 답이 안 오면 `timeout`(조용하다고 성공으로 보지 않는다). 앱은 받은 초대의 `ts` 를 PC 시계와 견주지 않는다(서버가 10분 보관 · 남은 것만 다시 보낸다). 받는 사람은 userCode — 친구 목록이 userCode 로 바뀌어야(친구 묶음) 맞는 사람에게 간다.
- 검사: `checks/sim-room-invite-rt.js`.

## desk-build.js — 🪑 기본 책상 · 소품 · 대신 몸 만들기

- **책임**: 재질 헬퍼 `M(색, 거칠기, 금속)` 과 이름 붙은 재질 아홉 · 기본 책상(`buildDesk(plain)` — 상판 · 다리 넷 · 소품 자리 `deskAnchor` · plain 이 아니면 화분) · 책상 위 소품 셋(`DESK_ITEMS` — 화분 · 머그컵 · 책) · 3D 몸을 못 불러왔을 때의 대신 몸(`buildPlaceholder`). 만들기만 한다 — 좌석에 올리기 · 저장은 app.js · `desk-*.js`. 앱 FSD 분리 M3 — app.js 에서 글 그대로 옮겼다.
- **만드는 법**: `const deskBuildMod = TwDeskBuild.createDeskBuild({});` — 받는 deps 없음(THREE 는 전역). app.js SETUP 에서(재질을 쓰는 `floorMat` 보다 앞) 만들고, 아래 여덟을 옛 이름 const 로 받는다.
- **내보내는 것**: `M` · `matWood` · `matWoodD`(승차 벤치가 deps 로 받는다) · `DESK_ITEMS` · `DEFAULT_DESK_OVERRIDE_ID` · `NO_DESK_ID` · `buildDesk` · `buildPlaceholder`
- **함정**
  - `DEFAULT_DESK_OVERRIDE_ID`(`__default_desk__`) · `NO_DESK_ID`(`__no_desk__`)는 `deskCatalogId` 로 **저장되는 값**이다 — 글자를 바꾸면 옛 앱 · 방 서버가 못 읽는다.
  - 상판 이름 `deskTop` · `deskAnchor` 는 다른 곳(책상 크기 · 소품 장착)이 이름으로 찾는다.
  - 검사: `checks/sim-desk-build.js`(진짜 three 로 상판 · 다리 · 소품 · 대신 몸 · 연결 · 깨 보기).

## seats.js — 🪑 좌석 목록 · 만들기 · 지우기 · 고른 좌석 · 간격

- **책임**: `seats` 배열(좌석 객체의 단 하나의 목록) · `createSeat`(책상 + 대신 몸 + 앵커로 좌석 하나를 만들어 씬에 올리고 줄 배치) · `removeSeat` · 고른 좌석(`selected`) · 좌석 간격 솔로 · 멀티(`SPACING` · `MULTIPLAYER_SPACING` — 설정 › 캐릭터 슬라이더가 정하고 localStorage `tw.gapSolo` · `tw.gapMulti` 에 저장). 자리 셈은 `seat-layout.js`. 앱 FSD 분리 M6 — app.js SEATS 구역 머리를 글 그대로 옮겼다.
- **만드는 법**: `TwSeats.createSeats({ CHAR_Z, buildDesk, buildPlaceholder, scene })` 뒤 `seatsMod.attach({ layoutSeats, selectSeat, renderSeatTabs })` — 줄 배치 · 좌석 탭 · 좌석 고르기는 위층(seat-layout · seat-panel)이 하는 일이라 deps 로 부르면 모듈 순환이 된다(sim-dep-cycles). app.js 가 seatPanelMod 를 만든 뒤 알림만 걸고, 이 모듈은 그것만 부른다(`createSeat` · `removeSeat` 보다 먼저). app.js 는 `seats` · `GAP_MIN` · `GAP_MAX` · `GAP_STEPS` · `saveGap` · `createSeat` 를 같은 이름 const 로 받는다.
- **내보내는 것**: 위 여섯 + `removeSeat` + 다시 대입되는 셋의 읽는 · 쓰는 함수(`selected()` / `setSelected(v)` · `SPACING()` / `setSPACING(v)` · `MULTIPLAYER_SPACING()` / `setMULTIPLAYER_SPACING(v)`) — app.js 는 값으로 복사하지 않고 `seatsMod.selected()` 로 읽는다.
- **함정**
  - 간격 저장 키는 바꾸지 말 것(저장된 값이 사라진다). 최소 -0.3 은 책상 GLB 박스가 보이는 판보다 넓어서 «끝끼리 0» 이어도 벌어져 보이기 때문이다.
  - `removeSeat` 는 한 칸만 남으면 아무것도 안 한다. 고른 좌석을 지우면 바로 앞(`max(0, i-1)`) 좌석을 고른다.
  - 상판 재질은 좌석마다 복제한다(책상 색을 좌석별로 바꾸려고).
  - 검사: `checks/sim-seats.js`(진짜 three · desk-build 로 좌석 만들기 · 지우기 · 간격 읽기 쓰기 · 깨 보기).

## char-place.js — 🧍 캐릭터 높이 · 깊이 · 자리 · 크기 저장 · 끌기 한계 · 책상 반폭

- **책임**: 캐릭터 기본 앞뒤 자리 `CHAR_Z` · 높이 상한 `CHAR_Y_MAX` · `clampCharY` · `seatCharZ` / 프로그램 이동 위치(`deskPanX` · `deskPanY` — localStorage `tw.deskPan`)의 저장 · 복원 · 안전 범위 `clampDeskPan`(실측 여백 `_myPanHalfFrac` · 없으면 폴백 0.02) / 실행 화면 캐릭터 크기 `focusCharScale` 의 모니터별 저장 · 복원(`tw.focusCharScale` — 디스플레이 id → 해상도 지문 → default 세 겹) · `refreshCharScaleForCurrentDisplay` / 책상 반폭 실측 `seatDeskHalfWidth` / 동물 실행 크기 `ANIMAL_RUN_SCALE`. 앱 FSD 분리 M7 — app.js 에서 글 그대로 옮겼다.
- **만드는 법**: `TwCharPlace.createCharPlace({ camera, bodyMeasureMod, seats })` 뒤 `charPlaceMod.attachLayout({ layoutSeats })` — `seats` 는 더 아래에서 만들어져 읽는 함수. 줄 배치는 위층(`seat-layout`)이라 deps 로 부르면 모듈 순환이 되므로 app.js 가 알림만 건다(`layoutSeats` 는 뒤에서 정의돼 부를 때 찾는다). app.js 는 옛 이름 열하나를 const 로 받고, `window.ANIMAL_RUN_SCALE`(animal.js 가 읽는 고리)도 app.js 가 건다.
- **내보내는 것**: `CHAR_Z` · `CHAR_Y_MAX` · `clampCharY` · `seatCharZ` · `BASE_PXW` · `ANIMAL_RUN_SCALE` · `saveCharPos` · `saveCharScale` · `refreshCharScaleForCurrentDisplay` · `clampDeskPan` · `seatDeskHalfWidth` · `attachLayout` + 다시 대입되는 여섯(`sizeFactor` · `deskPanX` · `deskPanY` · `focusCharScale` · `_cachedRowCenter` · `_cachedRowSpan`)의 읽는 · 쓰는 함수(`이름()` / `set이름(v)`) — app.js 는 `charPlaceMod.deskPanX()` 로 읽는다.
- **함정**
  - 크기는 id · 지문 · default 세 곳에 같이 쓴다 — id 하나만 쓰면 재부팅 · 드라이버 갱신으로 id 가 바뀌는 순간 저장값이 미아가 된다.
  - `ANIMAL_RUN_SCALE` 은 `_animalPanExtra` 가 부를 때 읽는다(값을 미리 굳히면 TDZ 로 앱이 죽었던 자리).
  - `seatDeskHalfWidth` 는 `updateWorldMatrix(true, true)` 로 조상부터 세운다(`fitModel` 직후 `matrixWorld` 캐시가 옛 값이라 간격이 부풀던 자리). 책상 위 아이템(`deskAnchor`)과 숨은 자식은 뺀다.
  - 검사: `checks/sim-char-place.js`(저장 · 복원 · 모니터 바뀜 · 끌기 한계 표 · 책상 반폭 · 깨 보기).

## seat-opacity.js — 👻 캐릭터 투명도(자리비움 영혼 효과)

- **책임**: `setSeatOpacity(seat, op)` — 좌석 몸(`bodyWrap`) 아래 모든 mesh 의 material 투명도를 상태 투명도 × 파츠 원본 투명도로 쓰고, 자리비움(op≈0)이면 mesh 를 끈다. 앱 FSD 분리 M10 — app.js 캐릭터 투명도 구역을 글 그대로 옮겼다.
- **만드는 법**: `TwSeatOpacity.createSeatOpacity({})` — deps 없음(좌석 객체만 읽고 쓴다). app.js 는 `setSeatOpacity` 를 같은 이름 const 로 받는다(`frame` 이 매 프레임 부른다).
- **함정**
  - 파츠 원본 투명도(`_baseOpacity` · `_baseTransparent`)는 **불투명할 때(op≥0.999) · 건드리기 전(`_opTouched` 없음)** 에만 잰다 — 숨은 동안 처음 만난 머티리얼의 0 이 원본으로 굳으면 머리가 영영 안 보인다(앱을 껐다 켜야 돌아옴).
  - `seat._bodyOff` 는 `hidden-seats.js` 가 읽는다(몸을 껐다는 표시 — 투명도 기준은 여기 한 곳). `userData._prevVisible` 은 파츠 `hides` 로 숨긴 mesh 가 풀릴 때 다시 보이지 않게 하는 기억이다.
  - 검사: `checks/sim-seat-opacity.js`(자리비움 풀림 사고 시나리오 — 이 파일의 본문을 떼어 돌린다) · `checks/sim-seat-opacity-mod.js`(자리비움 켜고 끄기 · 원본 투명도 기억 · 연결 · 깨 보기).

## seat-pointer.js — 🖱 캔버스 누르기 · 끌기 · 흔들기 · 쓰다듬기 · 우클릭

- **책임**: 캔버스 `contextmenu`(끄는 중 우클릭 = 그 자리 고정 · 조준 취소 · 좌석 메뉴) · `pointerdown`(좌석 잡기 · 조준 가로채기) · `pointermove`(흔들기 · 책상 끌기로 슬롯 옮기기 · 어지러움 누적) · `pointerup`(쓰다듬기 · 아이템 · 벤치 앉기 · 동물 얹기 · 어지러움 확정) · `pointercancel` · `blur` 안전망 · 이름표 끌기 시작(`_beginLabelSlotDrag`) · 전역 마우스 NDC. 끄는 중 상태 `drag` 의 주인. 앱 FSD 분리 M11 — app.js DRAG / PET 구역을 글 그대로 옮겼다.
- **만드는 법**: `TwSeatPointer.createSeatPointer({ … 24개 })` — 값 13 · 함수 4 · 읽는 함수 6(`Presence` · `floatersMod` · `officeMode` · `roomSeatMode` · `seatMenuMod` · `suppressNextContextMenu`) · 쓰는 함수 1(`setSuppressNextContextMenu`). 만들 때 캔버스 · window 듣기를 한 번 건다.
- **내보내는 것**: `ray` · `ndc` · `seatFromObject`(app.js 가 같은 이름 const 로 받아 다른 모듈 deps 에 넘긴다) · `drag()`(읽기만) · `mouseNdcX()` · `mouseNdcY()` · `_beginLabelSlotDrag`(이름표 끌기가 쓴다).
- **함정**
  - `pointerup` 본문은 `try/finally` 로 `drag = null` 을 보장한다 — 서버가 끊겨 `Presence.poke` 가 던지면 `drag` 가 남아 클릭 통과 판정 루프가 모든 mousemove 를 삼킨다(앱이 유령이 된다).
  - 우클릭 메뉴는 preventDefault · 억제 깃발 · drag · 레이캐스트 · 회사원 모드 확인 **뒤**에 열어야 한다 — 앞에 붙이면 드래그 중 고정과 이동 확정이 깨진다.
  - 옛 `typeof seats !== 'undefined'` 가드 하나는 걷었다(`seats` 는 이제 deps 값).
  - 이름표 끌기 모듈(`seat-label-drag.js`)이 `beginDrag` 로 이 모듈의 `_beginLabelSlotDrag` 를 쓰고, 이 모듈이 `TwSeatLabelDrag.canGrabSeat` 를 부른다(순수 판단 한 줄) — 서로 부름이 `sim-dep-cycles` 기준선에 2건 올랐다. 이슈 #903.
  - 검사: `checks/sim-seat-pointer.js`(듣기 · 우클릭 · 누르기 · 끌기 · 쓰다듬기 · 어지러움 · try/finally · 안전망 · 연결 · 깨 보기 · 가짜 THREE).

## flying-chair.js — 🪑 플라잉체어

- **책임**: `FLY_*` 상수 · `_flyRng`(시드 난수 — 같은 시드면 같은 궤적) · `flySeed` · `canFly`(막는 까닭 일곱 — 올라탄 좌석은 `allowTower` 면 허용) · `startFlight`(`seat.fly` 를 채우고 `_flyActive` 를 올림) · `_flyActive`(지금 날고 있는 좌석 수 — 프레임 상한이 비행 동안만 비켜 간다).
- **만드는 법**: `TwFlyingChair.createFlyingChair({ seats, toast })`. **내보내는 것**: 상수 · `flySeed` · `canFly` · `startFlight`(app.js 가 같은 이름 const 로) · `_flyActive()` · `setFlyActive(v)`.
- **함정**: `Math.random()` 은 `flySeed` 한 곳뿐이다(검사가 센다). 비행을 매 프레임 움직이는 쪽은 `tricks.js` · 프레임 루프. 검사: `checks/sim-flying-chair.js`.
