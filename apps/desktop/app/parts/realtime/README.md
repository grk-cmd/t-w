# app/parts/realtime — realtime 서버 연결 공통부 사용법

## realtime-link.js — 웹소켓 연결 공통부(ES 모듈)
- 책임: realtime 서버(t-w-server `realtime/`) 웹소켓 하나를 연다 — 열기 · `hello`(인증) · `ready` 기다리기 · 토큰 갱신(만료 5분 전 같은 연결로 다시 `hello`) ·
  다시 붙기 백오프(1 · 2 · 4 · 8 · 15초) · rid 요청과 답 짝짓기 · 쉬면 닫기 · 못 붙은 주소 1분 쉬기.
  무엇을 주고받는지(방 · 친구 접속 상태)는 모른다 — 연결 위의 메시지는 `hooks.onMessage`, 끊김은 `hooks.onClosed(wasReady, fatal)` 로 넘긴다.
  다시 붙을지 · 언제 포기할지는 부르는 쪽이 정한다(`scheduleReconnect()` 를 부르면 그때 백오프로 붙는다).
- 쓰는 곳: `realtime/rt-hub.js`(pv 4 — 로그인 뒤 늘 붙는 연결 하나). 방은 그 위의 방 포트(`room/room-rt.js`)로 — 옛 방 연결(pv 1 · room-server-net.js)은 걷었다.
- pv 2 부터 hello 에 `userId` 를 싣지 않는다(서버는 모르는 칸을 `badRequest` 로 거절 · 신원은 토큰뿐). 연결마다 · 갱신마다 달라지는 칸은 `helloFields(phase)`(`'open'` · `'refresh'`).
- `hooks.onReady(readyMsg)` · `hooks.onClosed(wasReady, fatal, closeCode)` — 닫힘 번호는 부르는 쪽이 판단한다. ready 전 `error` auth · protocol 은 먼저 끊되 서버가 실을 번호(4001 · 4003)를 넘긴다.
- `scheduleReconnect({ delayMs, readyWaitMs })` — 백오프 대신 정한 시간 뒤 · 그 연결의 ready 기다림(서버 재시작 1001). `reconnectNow()` — 기다리는 다시 붙기를 지금 한 번(네트워크 돌아옴).
- 만드는 법: 아무것도 import 하지 않는다. rt-bind.js 가 `createRealtimeLink` 를 import 해 토큰 · 버전 · userId 와 함께 넘긴다.
  ```js
  const link = createRealtimeLink({
    WebSocket, enabled: () => true, target: () => url, switchOk: () => true,
    getToken: (force) => …, getVersion: () => …,
    pv: 2, helloExtra: { scope: 'presence' },                 // hello 선택 칸(없으면 안 싣는다)
    requestKinds: ['presenceGet'], answers: { presence: 'presenceGet' },
    idleCloseMs: 0, busy: () => false, reconnectWanted: () => true,
    hooks: { onReady(){}, onMessage(m){}, onClosed(wasReady, fatal){} },
  });
  ```
- 내보내는 것: `ensureReady(ms, { retry })` → Promise<{ ok, code }> · `request(msg, map)` → Promise<map(답) | null> · `send(o)` · `close()` · `drop()` ·
  `scheduleReconnect(o)` · `reconnectNow()` · `scheduleIdle()` · `cancelIdle()` · `markAuthRetry()`(다음 열기는 새 토큰) · `markFailed()`(그 주소 1분 쉼) · `isReady()` · `state()`.
  순수: `jwtExpMs(token)` · `LINK_TIMING`(연결 5초 · rid 답 4초 · 백오프 · 토큰 · 쉬기 1분).
- 확장할 때: 새 rid 요청은 부르는 쪽 `requestKinds` · `answers` 에 더한다(이 파일은 안 고친다). 답의 t 가 요청과 다르면 answers 로 잇는다(presenceGet → presence).
- 함정:
  - **답 · 오류는 rid 로만 짝짓는다(추측 없음)** — 서버는 rid 를 실어 보낸 요청의 답 · 모든 오류에 같은 rid 를 돌려준다(PROTOCOL rid · `random` · `peek` · `watch` · `presenceGet` · `photoOpen` · `photoStart` · `roomInvite` · `join` · `meta` · `chatClear`). 짝 없는 rid 의 낡은 답(시간 초과로 지워진 요청의 늦은 답)과, rid 없는 요청 종류(`requestKinds`)의 오류는 `console.warn` 후 버린다 — 같은 종류의 먼저 보낸 요청에 붙이지 않는다. rid 없는 밀어 주는 메시지(presence 변화 등)는 `onMessage` 로. 짝 없는 rid 의 오류는 방 · 대화 포트의 요청일 수 있어 `onMessage` 로 넘기고 그쪽이 rid 로 짝짓는다. **서버 `#245` 가 배포된 dev 에서만 돈다**(rid 를 안 돌려주는 옛 서버에서는 방 입장 · meta · 지우기 답이 버려진다).
  - 요청의 거절 `error` 는 그 요청의 rid 를 달고 와 그 rid 의 요청이 **오류 메시지**를 받는다(`badRequest` · `unavailable` 등). ref 가 요청 종류가 아니면(예: `watch`) `onMessage` 로 넘겨 듣는 쪽이 받는다.
  - 연결 시간 초과는 둘로 가른다 — hello 를 보냈는데 ready 가 없으면 fatal `readyTimeout`(서버가 느림 · rt-hub 가 4005 처럼 흩어(jitter) 다시) · 소켓도 못 열었으면 `timeout`(1~15초 백오프).
  - ready 전의 `error` auth · version · protocol 은 서버가 곧 끊는 신호라 바로 닫고 `onClosed(false, fatal, 4001 | 4003 | null)` — auth 를 한 번 더 시도할지는 부르는 쪽(`markAuthRetry`). 토큰을 못 받은 것(이 PC 사정)은 `fatal` auth · 번호 없음.
  - 검사: `checks/sim-realtime-link.js`(공통부) · `checks/sim-rt-hub.js` · `checks/sim-room-rt.js`(연결 하나 · 방 포트가 이 위에서 그대로 도는지).

## rt-hub.js — realtime 연결 하나(pv 4 · classic script `window.TwRtHub`)
- 책임: 로그인 뒤 늘 붙어 있는 웹소켓 하나 — `hello { pv:4, token, ver, deviceId, session, claim? }`(`session` 은 연결마다 새로 뽑는 값 — `stop` · `bye` · `quit` 뒤 처음 `session()` · `start` 가 새로 뽑고, 다시 붙기 · 토큰 갱신 · «여기서 계속»은 같은 값 · 기기 등록이 연결보다 먼저 `session()` 으로 같은 값을 싣는다 · 자리는 등록이 정하고 서버는 `claim` 을 보지 않는다) · `ready{ userCode, graceMs }` · 닫힘 번호 표 · 작별(`bye`) · 살아 있음 확인(`ping`) · 알림(`notify`) → 건 함수 표 · 오래 끊겼다 붙으면 한 번씩 다시 받기. 방 · 친구 · 알림함 같은 «무엇» 은 모른다.
- 켜기 · 끄기: `TwRtHub.store.start({ claim })`(로그인 · 가입 확인 뒤 — B 묶음 · 멈춘 뒤 [다시 연결]은 `claim:false`) · `bye(why)`(로그아웃 `logout` · 탈퇴 `withdraw` · 계정 바꾸기 `switch` — 방 leave 는 부르는 쪽이 먼저 · bye 뒤 서버 닫힘 1초 기다림 · Promise) · `stop()`(작별 없이 끄기). 앱 끄기는 `quit()`(bye{quit} 뒤 바로 닫음 — 실릴 때 beforeunload 에 건다).
- 닫힘 번호: `CLOSE_CODES`(서버 통신 규약 7-1 과 같은 이름 · 값) → `closeAction(code, reason)` 한 곳 — 4004 는 닫힘 까닭으로 가른다(`deviceRemoved` = 이 PC 가 지워짐 · `otherDevice` = 계정의 다른 PC 가 지금 쓰는 PC 가 됨 · 그 밖 = 이 PC 의 새 세션) · «서버가 이 PC 연결을 끝냄» 판정은 `isDeviceOff(state)` 한 곳(로그인 흐름 · 방 · 방명록 · 계정이 부른다)(설계 04-realtime-disconnect 4-D-2). 다시 붙기 — 1006(번호 없음) · 1009 · 4008 · 모르는 1000번대(link 백오프 1~15초) · 1001(첫 시도 0~30초 흩고 ready 35초 기다림) · 서버 바쁨(4005 API 로 토큰 확인 못 함 · ready 기다림 시간 초과로 번호 없이 끊김 — 첫 시도 0~60초 흩고 그다음 60 · 120초 기준 [base/2, base] · 상한 120초 · `unavailableDelayMs` · 횟수는 ready 가 `UNAVAILABLE_STABLE_MS`(60초) 넘게 이어진 뒤 끊겼을 때와 `start` 때만 놓는다 — 잠깐 ready 됐다 또 4005 면 계속 는다 · 기다림 동안은 `checkAlive`(online · 깨어남)도 남은 시간을 지킨다) · 4001 한 번(새 토큰). 멈춤 — 1000 끝 · 4001 두 번(ready 전 error auth 도 셈) · 4003 · 4004 · 4006 · 4007 · 모르는 4000번대. 멈춘 뒤엔 사용자 누름 · 서버 신호로만 `start`.
- 살아 있음: `checkAlive()` — 깨어남(main powerMonitor `resume` · `unlock-screen` → preload `companion.onWake`) · 창 `online` 때(실릴 때 건다). 그리고 ready 인 채 `KEEPALIVE_IDLE_MS`(15초) 동안 아무 메시지도 못 받았을 때. ready 면 `ping` → 5초(`PONG_WAIT_MS`) 안에 `pong` 이 없으면 끊고 다시 붙기 · 다시 붙는 중이면 기다림을 건너뛰고 지금. 조용함 확인이 있는 까닭: 서버의 웹소켓 ping 은 브라우저가 알아서 답해 앱 코드가 못 본다 — 서버가 TCP 닫힘 없이 사라지면(`docker pause` 등) 앱은 ready 로 남았다. 이제 늦어도 약 20초 안에 끊고 다시 붙는다. 타이머는 ready 동안 하나(ready 가 될 때 걸고 ready 를 벗어날 때 · `bye` 때 푼다).
- 알림 걸기(D 묶음): `const off = TwRtHub.store.on('friends', (n) => { … n.subject · n.section · n.resync … 자기 자원을 ETag 로 다시 GET })`. 종류는 `KINDS`(서버 규약 6장) — 밖 이름은 던진다. 모르는 종류가 오면 버린다.
- 다시 받기: 서버 유예(`ready.graceMs`)보다 오래 끊겼다 붙으면 건 함수마다 `{ kind, resync:true }` 로 한 번(같은 함수를 여러 종류에 걸어도 한 번). 짧게 끊긴 동안의 알림은 서버가 들고 있다 보낸다. `graceMs` 가 없으면 0(늘 다시 받기).
- 그 밖의 메시지: `onMessage(t, fn)` — `presence` · `announce` · `roomInvited` · `mobileFocus` · `sessionLost` · `error` · 방 메시지(`ROOM_TYPES` — C 묶음 방 포트 자리). 보내기 `send(msg)`(ready 일 때만 true) · 답 있는 요청 `request(msg)`(rid 짝 — `presenceGet` · `random` · `peek`).
- 상태: `onState(fn)` — `off` · `connecting` · `ready` · `retrying` · `sessionLost`(4004) · `deviceRemoved`(4004 · 까닭 deviceRemoved) · `otherDevice`(4004 · 까닭 otherDevice) · `update`(4003) · `authFailed`(4001 두 번) · `maintenance`(4006) · `accountGone`(4007) · `closed`(모르는 4000번대). 마지막 닫힘 번호는 `lastCloseCode()`. 화면은 `rt-status-ui.js`.
- 만드는 법: 연결 공통부(ES 모듈)와 토큰 · 버전은 rt-bind.js(ES 모듈 — firebase-init.js 다음에 싣는다)가 `TwRtHub.store.bind({ createLink, getToken, getVersion })` 로 잇는다 — bind 전 `start()` 는 던진다. 주소는 운영 `wss://realtime.together-working.com` · dev `ws://127.0.0.1:8787`(dev 서버는 이 PC 로컬)(dev 앱만 `tw.realtimeUrl` 시험 주소).
- 함정: 다시 받기는 GET 몰림을 만들 수 있다 — 함수 안에서 또 흩지 말고(서버가 ready 를 0~30초 흩는다) ETag GET 한 번만. 방 안 90초 포기 · 방 자리 이어 붙기(`resume`)는 방 포트 몫.
- 검사: `checks/sim-rt-hub.js`(진짜 realtime-link 위에서 · mutation test).

## rt-status-ui.js — realtime 끊김 화면(classic script `window.TwRtStatusUi`)
- 책임: rt-hub 상태 → 사용자에게 보이는 것(설계 04-realtime-disconnect 4-D-7). `retrying` 이 15초 넘고 방 밖이면 런처 위 띠 «서버에 다시 연결하는 중…»(V1 · 한 번 붙은 뒤에만 · 붙으면 사라짐) · `authFailed` → E-RT-01 · 로그인 화면(V2) · `accountGone` → E-RT-02 · 로그아웃 처리 · 로그인 화면(V3 · 탈퇴 흐름 중엔 건너뜀) · `update` → 업데이트 강제 창(V4) · `maintenance` → 점검 창 + [다시 시도](V5 · «확인» 으로 닫으면 띠 «서버 점검 중이에요» [다시 연결]) · `closed` → E-RT-03 · 띠 [다시 연결](V6). `sessionLost` 는 로그인 흐름 몫.
- deps: `rt`(TwRtHub.store — onState · state · start) · `inRoom()` · `band`(`createRtBandDom(document)`) · `notifyError` · `toLogin()`(강제 로그아웃 뒤 다시 켜기 — 게이트가 로그인 화면) · `withdrawing()` · `forceUpdate()`(update-flow `forceProtocol`) · `maintenance(retry, onDismiss)`(maintenance-gate `serverClosed`) · `setTimeout` · `clearTimeout`.
- 내놓는 것: `createRtStatusUi(deps)` → `{ dispose }` · `createRtBandDom(doc)` → `{ show(view, onPress), hide }` · `RETRY_BAND_MS` · `BAND_ID`(`#rtBand` — desktop-run.js `UI_HIT_SEL` 에 있어야 단추를 누른다).
- 함정: 멈춘 뒤 다시 붙기는 사용자 누름 · 점검 해제 때만이고 `claim:false`(이 기기가 이미 지금 세션 — 남을 밀지 않는다). 띠 글은 고정 문구만 textContent.
- 검사: `checks/sim-rt-status-ui.js`(상태마다 · 진짜 rt-hub 위 · 띠 화면 · 배선 · mutation test).

## rt-bind.js — realtime 연결 만들기를 rt-hub 에 잇기(ES 모듈)
- 책임: `createRealtimeLink` · 앱 버전 · 토큰(`firebaseAPI.getIdToken`)을 `TwRtHub.store.bind` 로 한 번 건넨다. 켜기 · 끄기는 로그인 흐름 몫.
- 왜 따로: classic script 인 app.js 는 ES 모듈 realtime-link.js 를 못 불러서 모듈인 이 파일이 대신 건다. firebase-init.js 는 realtime 을 모른다.
- 함정: html 에서 `type="module"` 로 firebase-init.js 다음에 싣는다. 토큰은 연결을 만들 때 부르므로 firebaseAPI 가 늦어도 된다.
