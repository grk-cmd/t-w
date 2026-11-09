# app/parts/realtime — realtime 서버 연결 공통부 사용법

## realtime-link.js — 웹소켓 연결 공통부(ES 모듈)
- 책임: realtime 서버(t-w-server `realtime/`) 웹소켓 하나를 연다 — 열기 · `hello`(인증) · `ready` 기다리기 · 토큰 갱신(만료 5분 전 같은 연결로 다시 `hello`) ·
  다시 붙기 백오프(1 · 2 · 4 · 8 · 15초) · rid 요청과 답 짝짓기 · 쉬면 닫기 · 못 붙은 주소 1분 쉬기.
  무엇을 주고받는지(방 · 친구 접속 상태)는 모른다 — 연결 위의 메시지는 `hooks.onMessage`, 끊김은 `hooks.onClosed(wasReady, fatal)` 로 넘긴다.
  다시 붙을지 · 언제 포기할지는 부르는 쪽이 정한다(`scheduleReconnect()` 를 부르면 그때 백오프로 붙는다).
- 쓰는 곳: `realtime/rt-hub.js`(pv 3 — 로그인 뒤 늘 붙는 연결 하나) · `room/room-server-net.js`(옛 방 연결 pv 1 — 방 묶음이 rt-hub 위로 옮기면 걷는다).
- pv 2 부터 hello 에 `userId` 를 싣지 않는다(서버는 모르는 칸을 `badRequest` 로 거절 · 신원은 토큰뿐). 연결마다 · 갱신마다 달라지는 칸은 `helloFields(phase)`(`'open'` · `'refresh'`).
- `hooks.onReady(readyMsg)` · `hooks.onClosed(wasReady, fatal, closeCode)` — 닫힘 번호는 부르는 쪽이 판단한다. ready 전 `error` auth · protocol 은 먼저 끊되 서버가 실을 번호(4001 · 4003)를 넘긴다.
- `scheduleReconnect({ delayMs, readyWaitMs })` — 백오프 대신 정한 시간 뒤 · 그 연결의 ready 기다림(서버 재시작 1001). `reconnectNow()` — 기다리는 다시 붙기를 지금 한 번(네트워크 돌아옴).
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
  `scheduleReconnect(o)` · `reconnectNow()` · `scheduleIdle()` · `cancelIdle()` · `markAuthRetry()`(다음 열기는 새 토큰) · `markFailed()`(그 주소 1분 쉼) · `isReady()` · `state()`.
  순수: `jwtExpMs(token)` · `LINK_TIMING`(연결 5초 · rid 답 4초 · 백오프 · 토큰 · 쉬기 1분).
- 확장할 때: 새 rid 요청은 부르는 쪽 `requestKinds` · `answers` 에 더한다(이 파일은 안 고친다). 답의 t 가 요청과 다르면 answers 로 잇는다(presenceGet → presence).
- 함정:
  - `ridless` 를 켜면 rid 없는 답을 같은 종류의 가장 먼저 보낸 요청이 가져간다(rid 를 모르는 옛 방 서버용). 밀어 주는 메시지와 답의 t 가 같은 연결(presence)은 꼭 끈다.
  - 요청의 거절 `error` 에는 rid 가 없다 — `badRequest`(ref 가 요청 종류 · ref 없으면 `reflessKind`) · `unavailable`(ref 가 요청 종류 — 서버가 그 요청에 필요한 값을 못 받음, 예: `presenceGet` 의 친구 목록)이면 같은 종류의 **가장 먼저 보낸 요청 하나만** null 로 끝낸다. ref 가 요청 종류가 아니면(예: `watch`) `onMessage` 로 넘겨 듣는 쪽이 받는다.
  - ready 전의 `error` auth · version · protocol 은 서버가 곧 끊는 신호라 바로 닫고 `onClosed(false, fatal, 4001 | 4003 | null)` — auth 를 한 번 더 시도할지는 부르는 쪽(`markAuthRetry`). 토큰을 못 받은 것(이 PC 사정)은 `fatal` auth · 번호 없음.
  - 검사: `checks/sim-realtime-link.js`(공통부) · `checks/sim-room-server-net.js`(방 연결이 이 위에서 그대로 도는지).

## rt-hub.js — realtime 연결 하나(pv 3 · classic script `window.TwRtHub`)
- 책임: 로그인 뒤 늘 붙어 있는 웹소켓 하나 — `hello { pv:3, token, ver, deviceId, session, claim? }` · `ready{ userCode, graceMs }` · 닫힘 번호 표 · 작별(`bye`) · 살아 있음 확인(`ping`) · 알림(`notify`) → 건 함수 표 · 오래 끊겼다 붙으면 한 번씩 다시 받기. 방 · 친구 · 알림함 같은 «무엇» 은 모른다.
- 켜기 · 끄기: `TwRtHub.store.start({ claim })`(로그인 · 가입 확인 뒤 — B 묶음 · 멈춘 뒤 [다시 연결]은 `claim:false`) · `bye(why)`(로그아웃 `logout` · 탈퇴 `withdraw` · 계정 바꾸기 `switch` — 방 leave 는 부르는 쪽이 먼저 · bye 뒤 서버 닫힘 1초 기다림 · Promise) · `stop()`(작별 없이 끄기). 앱 끄기는 `quit()`(bye{quit} 뒤 바로 닫음 — 실릴 때 beforeunload 에 건다).
- 닫힘 번호: `CLOSE_CODES`(서버 `protocol/closeCodes.ts` 와 같은 이름 · 값) → `closeAction(code)` 한 곳(설계 04-realtime-disconnect 4-D-2). 다시 붙기 — 1006(번호 없음) · 1009 · 4005 · 4008 · 모르는 1000번대 · 1001(첫 시도 0~30초 흩고 ready 35초 기다림) · 4001 한 번(새 토큰). 멈춤 — 1000 끝 · 4001 두 번(ready 전 error auth 도 셈) · 4003 · 4004 · 4006 · 4007 · 모르는 4000번대. 멈춘 뒤엔 사용자 누름 · 서버 신호로만 `start`.
- 살아 있음: `checkAlive()` — 깨어남(main powerMonitor `resume` · `unlock-screen` → preload `companion.onWake`) · 창 `online` 때(실릴 때 건다). ready 면 `ping` → 5초 안에 `pong` 이 없으면 끊고 다시 붙기 · 다시 붙는 중이면 기다림을 건너뛰고 지금. 주기 ping 은 없다(서버 몫).
- 알림 걸기(D 묶음): `const off = TwRtHub.store.on('friends', (n) => { … n.subject · n.section · n.resync … 자기 자원을 ETag 로 다시 GET })`. 종류는 `KINDS`(서버 규약 6장) — 밖 이름은 던진다. 모르는 종류가 오면 버린다.
- 다시 받기: 서버 유예(`ready.graceMs`)보다 오래 끊겼다 붙으면 건 함수마다 `{ kind, resync:true }` 로 한 번(같은 함수를 여러 종류에 걸어도 한 번). 짧게 끊긴 동안의 알림은 서버가 들고 있다 보낸다. `graceMs` 가 없으면 0(늘 다시 받기).
- 그 밖의 메시지: `onMessage(t, fn)` — `presence` · `announce` · `roomInvited` · `mobileFocus` · `sessionLost` · `error` · 방 메시지(`ROOM_TYPES` — C 묶음 방 포트 자리). 보내기 `send(msg)`(ready 일 때만 true) · 답 있는 요청 `request(msg)`(rid 짝 — `presenceGet` · `random` · `peek`).
- 상태: `onState(fn)` — `off` · `connecting` · `ready` · `retrying` · `sessionLost`(4004) · `update`(4003) · `authFailed`(4001 두 번) · `maintenance`(4006) · `accountGone`(4007) · `closed`(모르는 4000번대). 마지막 닫힘 번호는 `lastCloseCode()`. 화면은 `rt-status-ui.js`.
- 만드는 법: 연결 공통부(ES 모듈)와 토큰 · 버전은 firebase-init.js 가 `TwRtHub.store.bind({ createLink, getToken, getVersion })` 로 잇는다 — bind 전 `start()` 는 던진다. 주소는 운영 `wss://realtime.together-working.com` · dev `wss://realtime-dev.together-working.com`(dev 앱만 `tw.realtimeUrl` 시험 주소).
- 함정: 다시 받기는 GET 몰림을 만들 수 있다 — 함수 안에서 또 흩지 말고(서버가 ready 를 0~30초 흩는다) ETag GET 한 번만. 방 안 90초 포기 · 방 자리 이어 붙기(`resume`)는 방 포트 몫. 옛 pv 1 방 연결(room-server-net.js)은 pv 3 서버에 붙으면 4003 으로 끊긴다(C 묶음이 걷는다).
- 검사: `checks/sim-rt-hub.js`(진짜 realtime-link 위에서 · 깨 보기).

## rt-status-ui.js — realtime 끊김 화면(classic script `window.TwRtStatusUi`)
- 책임: rt-hub 상태 → 사용자에게 보이는 것(설계 04-realtime-disconnect 4-D-7). `retrying` 이 15초 넘고 방 밖이면 런처 위 띠 «서버에 다시 연결하는 중…»(V1 · 한 번 붙은 뒤에만 · 붙으면 사라짐) · `authFailed` → E-RT-01 · 로그인 화면(V2) · `accountGone` → E-RT-02 · 로그아웃 처리 · 로그인 화면(V3 · 탈퇴 흐름 중엔 건너뜀) · `update` → 업데이트 강제 창(V4) · `maintenance` → 점검 창 + [다시 시도](V5 · «확인» 으로 닫으면 띠 «서버 점검 중이에요» [다시 연결]) · `closed` → E-RT-03 · 띠 [다시 연결](V6). `sessionLost` 는 로그인 흐름 몫.
- deps: `rt`(TwRtHub.store — onState · state · start) · `inRoom()` · `band`(`createRtBandDom(document)`) · `notifyError` · `toLogin()`(강제 로그아웃 뒤 다시 켜기 — 게이트가 로그인 화면) · `withdrawing()` · `forceUpdate()`(update-flow `forceProtocol`) · `maintenance(retry, onDismiss)`(maintenance-gate `serverClosed`) · `setTimeout` · `clearTimeout`.
- 내놓는 것: `createRtStatusUi(deps)` → `{ dispose }` · `createRtBandDom(doc)` → `{ show(view, onPress), hide }` · `RETRY_BAND_MS` · `BAND_ID`(`#rtBand` — desktop-run.js `UI_HIT_SEL` 에 있어야 단추를 누른다).
- 함정: 멈춘 뒤 다시 붙기는 사용자 누름 · 점검 해제 때만이고 `claim:false`(이 기기가 이미 지금 세션 — 남을 밀지 않는다). 띠 글은 고정 문구만 textContent.
- 검사: `checks/sim-rt-status-ui.js`(상태마다 · 진짜 rt-hub 위 · 띠 화면 · 배선 · 깨 보기).
