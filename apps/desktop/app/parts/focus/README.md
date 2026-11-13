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

## focus-api.js — ⏱ 포커스 · 👑 달성표 · 📱 폰 연결 서버 길 provider

**책임** — 서버 `/v1/me/focus*`(진척 · 집중 시간 올리기 · 별 색 · 달성표 한 주 · 오늘 달성 · 보상 칸 · 폰 키)를 요청 하나씩 보내고 답을 화면 모양으로 맞추는 한 곳(날 경계 `dayEndsAt` 은 ms). 줄 세우기 · 미전송분 · 상태 주인은 부르는 쪽(D5 다음 단계) 몫이다.
**deps** — `authed`(`TwApi.authed`) · `warn`.
**내놓는 것** — `createFocusApi(deps)` → `fetchProgress` · `accrue` · `setStarColor` · `fetchChallenge` · `saveChallenge` · `markToday` · `claimReward` · `issueMobileKey` · `unlinkMobile` · `reset`. 순수: `progressOf` · `challengeOf` · `editBody` · `failOf`(`PREMIUM_REQUIRED` 등 갈래) · `PATHS` · `LIMITS`. 읽기는 못 읽으면 던지고, 쓰기는 `{ status: 'ok'|'stale'|'failed', err? }`.
**함정** — 쓰기는 읽은 토큰의 주인(`expectOwner`)과 묶는다(읽은 적 없으면 요청 0). 레벨 · 보상 양은 서버가 센다 — 앱이 센 값을 보내지 않는다.
검사: `checks/sim-focus-api.js`.

## focus-progress.js — ⏱ 포커스 진척(서버 값 · 못 올린 초)

**책임** — 레벨 · 회차 · 별 색은 서버가 준 값 그대로 들고(`load`: idle · loading · ready · failed), 이 PC 는 «아직 못 올린 초»(`pendingSec` · 계정 칸 `tw.focusPendingSec`)만 쌓아 정해진 때 한 번에 올린다. 앱이 누적에서 레벨을 다시 세지 않는다 — 레벨 막대만 `shownTotalSec()`(서버 누적 + 못 올린 몫).
**deps** — `focusApi`(`createFocusApi`) · `focusStore`(계정 칸) · `notifyError` · `setServerDay`(서버 «오늘» → `focus-total.js`) · `addQuitListener`.
**내놓는 것** — `startFocus(code, me, session)`(app-boot `focusLevel` 차례 — `session.onReset` 으로 reset) · `progress()` · `isReady()` · `getFocusLevel()` · `myFocusShow()` · `getStarColor()` · `setStarColor(hex)` · `shownTotalSec()` · `unsentSec()` · `addSeconds(sec)` · `focusEnded()` · `flushPending()`(로그아웃 올리기) · `reload(userOpened)` · `refreshDay()`(하루가 바뀐 때 새 날 한 번) · `legacyAccrue(sec)`(첫 실행의 옛 누적) · `onChange(fn)`.
**올리는 때** — 주기 · 재시도 타이머 없음. ① 미전송분이 600초 칸을 넘을 때 ② 더해서 3600초(다음 레벨) 경계를 넘을 때 ③ 집중이 끝날 때(60초 이상) ④ 켤 때 · 로그아웃 올리기 · 앱 끄기. 실패하면 다음 때까지 기다린다.
**함정**
- 한 줄: 올리는 중이면 `again` 만 켠다. `sent` 를 잡고 답이 오면 `pendingSec -= sent` — 서버가 덜 받아도(`acceptedSec < sent`) 보낸 만큼 뺀다(서버 상한이 원본). 보내는 동안 쌓인 몫은 남는다.
- 늦은 답: `session.onReset` 이 `gen` 을 올려 옛 계정 답은 아무것도 못 바꾼다. 요청 순번(`reqSeq`)이 앞선 요청의 늦은 답이 진척을 덮는 것을 막는다 — 다만 늦게 온 답의 누적이 더 크면 그 몫은 받고(누적은 서버에서 줄지 않는다), 별 색 답의 색은 늘 받는다.
- 새 날 받기(`refreshDay`): `ready` 일 때만, 겹치면 하나로, 실패하면 번호 없이 `failed` 로만 두고 되풀이하지 않는다(설계 7절 — 다음에 창을 열 때 다시 받는다).
- 받기 전(idle · loading · failed)에는 레벨 배지 · 경험치 바를 그리지 않는다(`isReady()` · 막대 null). 해금 레벨은 받기 전 1.
- 번호: `E-FOCUS-01`(사용자가 연 창에서 다시 받기 실패) · `-02`(올리기 실패 — 이어지면 한 번) · `-03`(별 색 실패 — 이전 색으로).
검사: `checks/sim-focus-progress.js`.

## chal-store.js — 👑 달성표 상태(서버 한 주 한 벌)

**책임** — 이번 주 한 벌(`GET …/challenges/current`)을 받아 들고, 쓰기 셋(PUT 한 벌 · POST 오늘 달성 · POST 보상 칸)을 **주 한 줄**로 세워 보내고, «오늘 목표를 채웠나»(이 PC 만 아는 앱 사용 시간 · 🔁 [했다] · 📋 체크)를 판정하고, 서버가 열어 준 보상 칸(`claimable`)을 받는다. 오늘 · 주 · 단계 · 보상 양 · 쉬는 날 · «안 센 날» · 다음 날 목표 적용은 모두 서버 값이다.
**상태** — `load`: idle · loading · ready · failed · locked(`PREMIUM_REQUIRED` — 실패 아님). 받기 전에는 쓰지도 판정하지도 않는다. 오늘 진행은 계정 칸 `tw.chalToday`(`{ day, sec, done, checks, anchor, fail, posted }` — 서버 날이 달라지면 새로 시작).
**deps** — `chalApi`(`createFocusApi`) · `focusPure`(`TwFocusApi`) · `chalCell`(계정 칸) · `notifyError` · `premiumOn` · `serverDay` · `rolloverToday` · `now` · `appMode` · `addQuitListener`.
**내놓는 것** — `startChal(code, me, session)` · `view()` · `arcView(단계)` · `start` · `edit` · `setAutoNext` · `giveUp` · `retryPost` · `claimNow` · `addFocusSec` · `check` · `repeatAnswer` · `openDrawer` · `reload` · `dayEnded` · `tick` · `adoptLegacyToday` · `flush` · `onChange` · `onEvent`. 순수 셈(`TwChalStore`): 날 글자 → 요일 · 단계 · 주의 월요일 · 지난 주 이름 · 칸 · 서버 목표 ↔ 화면 목표.
**함정** — 409 는 덮지 않고 잠근 뒤 그 주를 받아 온다(다시 보내지 않음). 같은 하루 경계에서 이번 주를 다시 받는 것은 3번까지다(PC 시계가 서버보다 빠를 때). 목표를 «포기» 하면 목표를 지우지 않고 그 단계를 쉬게 한다 — 다음 주 자동 시작이 이어받는다. 20초 틱은 요청을 되풀이하지 않는다(판정 · 반복 알림 · 경계 훑기만).
검사: `checks/sim-chal-store.js`.

## weekly-challenge.js — 👑 달성표 화면

**책임** — 서랍(불러오는 중 · 못 불러옴 [다시 시도] · 프리미엄 잠김 · 종류 고르기 · 설정 · 진행 중 · 지난 기록) · 팝업(🔁 반복 · 🏅 정산) · 🎯 집중 시간 쌓기(판정 키가 맞을 때만 `store.addFocusSec`). 상태는 `chal-store.js`.
**deps** — `chalStore` · `toast` · `escHtml` · `formatHMS` · `premiumOn` · `appMode`. app.js 가 저장소를 먼저 만들어 넘긴다.
**내놓는 것** — `startChallenge` · `dayEnded` · `flush` · `open` · `isOpen` · `focusTick` · `setKeyPlatform` · `calc`.
**함정** — 설정 화면은 틱이 다시 그리지 않는다(입력 중 글자가 사라짐). 서버에 못 적은 것은 서랍 버튼으로만 다시 보낸다(`[다시 적기]` · `[보상 받기]`). `_chalKeysOf` 는 `main.js keysOf` 와 같은 규칙의 한 벌이다(`sim-keysof-twin.js`).
검사: `checks/sim-weekly-challenge.js`.

## focus-level.js — ⭐ 레벨 표시 이름 · 오늘치 쌓기 · 태블릿

**책임** — `addFocusSeconds`(오늘 시간 · 이번 실행 시간에 더하고 올릴 몫으로 넘김) · 서버 값을 읽는 이름(`getFocusLevel` · `myFocusShow` · `myStarOut` · `getStarColor` · `setStarColor` — 값의 주인은 `focus-progress.js`) · 남의 별 모양(`starFromRemote`) · 별 문자열(`lvStarStr`) · 📱 폰 연결(D5-5 에서 서버 길로).
**함정** — Firebase 프로필 · 마크 · 해금 안내 우편은 걷었다(해금 안내는 서버 알림). 계정 확인 전에는 쌓지 않는다(`_focusTotalStarted`).
검사: `checks/sim-focus-level.js`.

## focus-total.js — ⏱ 오늘 · 이번 실행 시간 · 서버 «오늘»

**책임** — 오늘 시간(계정 칸 `tw.focusTodaySec` · `tw.focusTodayDate`) · 이번 실행 시간 · 진척 답이 준 서버 «오늘»(`serverDay()` — `{ day, isoWeek, dayEndsAt }`). 누적은 서버 값이라 여기 없다.
**하루 경계** — 앱이 날짜를 셈하지 않는다. 날 글자는 서버 `today.day`, 오늘 시간이 0 으로 돌아가는 때는 서버 `dayEndsAt`(한국 06:00 — PC 시간대와 무관). 지나면 요청 없이 0 · 날 글자 비움 · `onDayEnd` 구독자에게 한 번 알림(app.js 가 `focus-progress.js` 의 새 날 받기에 잇는다 — 서로 deps 로 부르면 순환). 서버 답이 오면 날이 같을 때만 이어 쌓는다(0 채움 없는 옛 글자 `2026-11-4` 도 같은 날).
**함정** — 앱 날짜 셈(`_dayShifted` · `_focusDayStr` · `DAY_START_HOUR`)은 없다 — 오늘 시간 · 달성표 모두 서버 날(`serverDay()`)을 읽는다.
검사: `checks/sim-focus-total.js`(모양) · `checks/sim-focus-day.js`(경계 동작).
