# app/parts/realtime — realtime 서버 연결 공통부 사용법

## realtime-link.js — 웹소켓 연결 공통부(ES 모듈)
- 책임: realtime 서버(t-w-server `realtime/`) 웹소켓 하나를 연다 — 열기 · `hello`(인증) · `ready` 기다리기 · 토큰 갱신(만료 5분 전 같은 연결로 다시 `hello`) ·
  다시 붙기 백오프(1 · 2 · 4 · 8 · 15초) · rid 요청과 답 짝짓기 · 쉬면 닫기 · 못 붙은 주소 1분 쉬기.
  무엇을 주고받는지(방 · 친구 접속 상태)는 모른다 — 연결 위의 메시지는 `hooks.onMessage`, 끊김은 `hooks.onClosed(wasReady, fatal)` 로 넘긴다.
  다시 붙을지 · 언제 포기할지는 부르는 쪽이 정한다(`scheduleReconnect()` 를 부르면 그때 백오프로 붙는다).
- 쓰는 곳: `room/room-server-net.js`(방 — 방 안일 때만 다시 붙기 · 방 밖 60초 쉬면 닫기) · `friends/presence-ws.js`(친구 접속 상태 — 늘 붙어 있음).
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
  - 검사: `checks/sim-realtime-link.js`(공통부) · `checks/sim-room-server-net.js`(방 연결이 이 위에서 그대로 도는지).
