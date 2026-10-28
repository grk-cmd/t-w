# app/parts/realtime — realtime 서버 연결 공통부 사용법

## realtime-link.js — 웹소켓 연결 공통부(ES 모듈)
- 책임: realtime 서버(t-w-server `realtime/`) 웹소켓 하나를 연다 — 열기 · `hello`(인증) · `ready` 기다리기 · 토큰 갱신(만료 5분 전 같은 연결로 다시 `hello`) ·
  다시 붙기 백오프(1 · 2 · 4 · 8 · 15초) · rid 요청과 답 짝짓기 · 쉬면 닫기 · 못 붙은 주소 1분 쉬기.
  무엇을 주고받는지(방 · 친구 접속 상태)는 모른다 — 연결 위의 메시지는 `hooks.onMessage`, 끊김은 `hooks.onClosed(wasReady, fatal)` 로 넘긴다.
  다시 붙을지 · 언제 포기할지는 부르는 쪽이 정한다(`scheduleReconnect()` 를 부르면 그때 백오프로 붙는다).
- 쓰는 곳: `realtime/rt-hub.js`(pv 2 — 로그인 뒤 늘 붙는 연결 하나). 방은 그 위의 방 포트(`room/room-rt.js`)로 — 옛 방 연결(pv 1 · room-server-net.js)은 걷었다. pv 1 갈래(`userId` · `ridless` · `reflessKind`)는 쓰는 곳이 없어 다음에 걷는다.
- pv 2 부터 hello 에 `userId` 를 싣지 않는다(서버는 모르는 칸을 `badRequest` 로 거절 · 신원은 토큰뿐). 연결마다 · 갱신마다 달라지는 칸은 `helloFields(phase)`(`'open'` · `'refresh'`).
- `hooks.onReady(readyMsg)` · `hooks.onClosed(wasReady, fatal, closeCode)` — 닫힘 번호(4001 · 4003 · 4004 · 4005)는 부르는 쪽이 판단한다.
- 만드는 법: 아무것도 import 하지 않는다. firebase-init.js 가 `createRealtimeLink` 를 import 해 토큰 · 버전 · userId 와 함께 넘긴다.
  ```js
  const link = createRealtimeLink({
    WebSocket, enabled: () => true, target: () => url, switchOk: () => true,
    getToken: (force) => …, getUserId: () => …, getVersion: () => …,
    pv: 1, helloExtra: { scope: 'presence' },                 // hello 선택 칸(없으면 안 싣는다)
    requestKinds: ['presenceGet'], answers: { presence: 'presenceGet' }, reflessKind: null, ridless: false,
    idleCloseMs: 0, busy: () => false, reconnectWanted: () => true,
    hooks: { onReady(){}, onMessage(m){}, onClosed(wasReady, fatal){} },
  });
  ```
- 내보내는 것: `ensureReady(ms, { retry })` → Promise<{ ok, code }> · `request(msg, map)` → Promise<map(답) | null> · `send(o)` · `close()` · `drop()` ·
  `scheduleReconnect()` · `scheduleIdle()` · `cancelIdle()` · `markAuthRetry()`(다음 열기는 새 토큰) · `markFailed()`(그 주소 1분 쉼) · `isReady()` · `state()`.
  순수: `jwtExpMs(token)` · `LINK_TIMING`(연결 5초 · rid 답 4초 · 백오프 · 토큰 · 쉬기 1분).
- 확장할 때: 새 rid 요청은 부르는 쪽 `requestKinds` · `answers` 에 더한다(이 파일은 안 고친다). 답의 t 가 요청과 다르면 answers 로 잇는다(presenceGet → presence).
- 함정:
  - `ridless` 를 켜면 rid 없는 답을 같은 종류의 가장 먼저 보낸 요청이 가져간다(rid 를 모르는 옛 방 서버용). 밀어 주는 메시지와 답의 t 가 같은 연결(presence)은 꼭 끈다.
  - ready 전의 `error` auth · version · protocol 은 서버가 곧 끊는 신호라 바로 닫고 `onClosed(false, fatal)` — auth 를 한 번 더 시도할지는 부르는 쪽(`markAuthRetry`).
  - 검사: `checks/sim-realtime-link.js`(공통부) · `checks/sim-rt-hub.js` · `checks/sim-room-rt.js`(연결 하나 · 방 포트가 이 위에서 그대로 도는지).

## rt-hub.js — realtime 연결 하나(pv 2 · classic script `window.TwRtHub`)
- 책임: 로그인 뒤 늘 붙어 있는 웹소켓 하나 — `hello { pv:2, token, ver, deviceId, session, claim? }` · `ready{ userCode }` · 끊기면 늘 다시 붙기 · 닫힘 번호 판단 · 알림(`notify`) → 건 함수 표 · 오래 끊겼다 붙으면 한 번씩 다시 받기. 방 · 친구 · 알림함 같은 «무엇» 은 모른다.
- 켜기 · 끄기: `TwRtHub.store.start({ claim })`(로그인 · 가입 확인 뒤 — B 묶음) · `stop()`(로그아웃 · 계정을 놓을 때). `claim` 은 앱을 켤 때 · «여기서 계속» 에만(기본 true).
- 알림 걸기(D 묶음): `const off = TwRtHub.store.on('friends', (n) => { … n.subject · n.section · n.resync … 자기 자원을 ETag 로 다시 GET })`. 종류는 `KINDS`(서버 규약 6장) — 밖 이름은 던진다. 모르는 종류가 오면 버린다.
- 다시 받기: 유예(`RESYNC_AFTER_MS` 20초)보다 오래 끊겼다 붙으면 건 함수마다 `{ kind, resync:true }` 로 한 번(같은 함수를 여러 종류에 걸어도 한 번). 짧게 끊긴 동안의 알림은 서버가 들고 있다 보낸다.
- 그 밖의 메시지: `onMessage(t, fn)` — `presence` · `announce` · `roomInvited` · `mobileFocus` · `sessionLost` · `error` · 방 메시지(`ROOM_TYPES` — C 묶음 방 포트 자리). 보내기 `send(msg)`(ready 일 때만 true) · 답 있는 요청 `request(msg)`(rid 짝 — `presenceGet` · `random` · `peek`).
- 상태: `onState(fn)` — `off` · `connecting` · `ready` · `retrying` · `sessionLost`(4004 — 멈춤) · `update`(4003 — 멈춤 · 업데이트 안내) · `authFailed`(4001 두 번 — 멈춤). 4005 · 그 밖은 다시 붙기.
- 만드는 법: 연결 공통부(ES 모듈)와 토큰 · 버전은 firebase-init.js 가 `TwRtHub.store.bind({ createLink, getToken, getVersion })` 로 잇는다 — bind 전 `start()` 는 던진다. 주소는 운영 `wss://realtime.together-working.com` · dev `wss://realtime-dev.together-working.com`(dev 앱만 `tw.realtimeUrl` 시험 주소).
- 함정: 다시 받기는 GET 몰림을 만들 수 있다 — 함수 안에서 또 흩지 말고(서버가 ready 를 0~30초 흩는다) ETag GET 한 번만. 방 안 90초 포기 · 방 자리 이어 붙기(`resume`)는 방 포트 몫.
- 검사: `checks/sim-rt-hub.js`(진짜 realtime-link 위에서 · 깨 보기).
