# app/parts/focus — 포커스(집중 기록 · 레벨 · 태블릿·폰)

이 폴더 모듈의 책임 · deps · 함정. 아직 절이 없는 모듈은 파일 머리 주석이 정본이다.

## mobile-diag.js — 📱 태블릿·폰 연결 진단 줄

- **책임**: PC 가 받은 폰 신호(`mobileLink/{uid}/state`)를 기록하고, 설정 › 포커싱어플 칸에 쓸 한 줄을 만든다(순수 함수 · DOM · firebase 없음). «연동이 자꾸 풀린다» 제보를 캡처 한 장으로 가르려고 둔다.
- **만드는 법**: 만들지 않는다 — 얼린 표 `window.TwMobileDiag`. app.js 가 `mobileDiag: TwMobileDiag` 로 focus-level.js 에 넘긴다.
- **내보내는 것**: `empty()` · `next(기록, 사건)` → 새 기록 · `line(기록, 시각 글자?)` → `🔍 마지막 신호 14:02:10 열림(Procreate) · 그 전 … · 이번 실행 3번`.
  - 사건: `{ kind:'state', v, first }`(구독으로 받은 값 · first = 처음 온 값이라 수에 안 넣음) · `{ kind:'reset', v }`(PC 를 켤 때 «켜짐» 을 내린 원래 값) · `{ kind:'live', has }`(PC 켜짐 표시).
- **함정**
  - 신호 하나 = ts(서버 시각). 같은 ts 가 다시 오면 새 신호가 아니다 — 부팅 초기화는 on 만 내려서 같은 ts 의 «꺼짐» 이 곧 온다.
  - 읽기만 한다 — 켜짐 판정(`_mobileOn`)도, live 를 다시 거는 일도 하지 않는다. 진단으로 원인을 본 뒤 동작을 따로 고친다.
  - 다른 키로 쓴 값은 세지 않는다(focus-level.js `_mobileStart`).
  - 검사: `checks/sim-mobile-diag.js`(규칙 · 잇기를 실제로 돌림 · firebase-init 알림 자리).

## focus-gate.js — 😴 «투게더워킹 창이 앞이면 안 잠듦» 규칙

- **책임**: 앞 창이 바뀔 때 포커싱 어플 게이트(`focusGateSleep`)를 어떻게 둘지, 게이트가 닫혔을 때 어떤 자세로 둘지 정한다. 순수 함수만 있고 DOM · firebase는 쓰지 않는다. 활성 창 처리(`_applyActiveAppState`)와 자세 판정(`seatState`)이 같은 판단을 쓰니까 한 곳에 둔다.
- **만드는 법**: 만들지 않는다 — 얼린 표 `window.TwFocusGate`. app.js 가 `const focusGate = TwFocusGate;` 로 받는다.
- **내보내는 것**: `selfFront(state)`(투게더워킹 창이 맨 앞 · 자기를 등록했으면 아님) · `nextGateSleep(state, { figureMode, mobOn })` → `true` · `false` · `null`(직전 값을 둔다) · `gatedPose(selfFront, idleMs, sleepMs)` → `'idle'` · `'sleep'`.
- **함정**
  - `null` 은 «열기» 가 아니다 — 포커싱 어플에서 넘어오면 깨어 있고, 다른 앱에서 넘어오면 닫힌 채로 둔다.
  - `idleMs` 는 `lastActivity` · `lastAnyInput` 중 늦은 것부터 잰다 — 게이트가 닫혀 있으면 전역 키 · 클릭은 `lastAnyInput` 만 올린다.
  - 피규어 모드 · 폰 켜짐은 투게더워킹 창이 앞이어도 게이트를 연다.
  - 검사: `checks/sim-focus-gate.js`(규칙 · 옛 두 식과 모든 경우 대조 · 연결) · `sim-focus-gate-self.js` · `sim-figure-mode.js` 4절(진짜 함수를 돌림).
