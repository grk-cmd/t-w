# app/parts/focus — 포커스(집중 기록 · 레벨 · 태블릿·폰)

이 폴더 모듈의 책임 · deps · 함정. 아직 절이 없는 모듈은 파일 머리 주석이 정본이다.

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
**내놓는 것** — `startFocus(code, me, session)`(app-boot `focusLevel` 차례 — `session.onReset` 으로 reset) · `progress()` · `isReady()` · `getFocusLevel()` · `myFocusShow()` · `getStarColor()` · `setStarColor(hex)` · `shownTotalSec()` · `unsentSec()` · `addSeconds(sec)` · `focusEnded()` · `flushPending()`(로그아웃 올리기) · `reload(userOpened)` · `whenReady()`(폰 키 만들기 · 끊기가 먼저 부른다 — 받는 중이면 기다리고 못 받았으면 한 번 더 받아 true/false) · `refreshDay()`(하루가 바뀐 때 새 날 한 번) · `legacyAccrue(sec)`(첫 실행의 옛 누적) · `onChange(fn)`.
**올리는 때** — 주기 · 재시도 타이머 없음. ① 미전송분이 600초 칸을 넘을 때 ② 더해서 3600초(다음 레벨) 경계를 넘을 때 ③ 집중이 끝날 때(60초 이상) ④ 켤 때 · 로그아웃 올리기 · 앱 끄기. 실패하면 다음 때까지 기다린다.
**함정**
- 한 줄: 올리는 중이면 `again` 만 켠다. `sent` 를 잡고 답이 오면 `pendingSec -= sent` — 서버가 덜 받아도(`acceptedSec < sent`) 보낸 만큼 뺀다(서버 상한이 원본). 보내는 동안 쌓인 몫은 남는다.
- 늦은 답: `session.onReset` 이 `gen` 을 올려 옛 계정 답은 아무것도 못 바꾼다. 요청 순번(`reqSeq`)이 앞선 요청의 늦은 답이 진척을 덮는 것을 막는다 — 다만 늦게 온 답의 누적이 더 크면 그 몫은 받고(누적은 서버에서 줄지 않는다), 별 색 답의 색은 늘 받는다.
- 새 날 받기(`refreshDay`): `ready` 일 때만, 겹치면 하나로, 실패하면 번호 없이 `failed` 로만 두고 되풀이하지 않는다(설계 7절 — 다음에 창을 열 때 다시 받는다).
- 받기 전(idle · loading · failed)에는 레벨 배지 · 경험치 바를 그리지 않는다(`isReady()` · 막대 null). 해금 레벨은 받기 전 1.
- 번호: `E-FOCUS-01`(사용자가 연 창에서 다시 받기 실패) · `-02`(올리기 실패 — 이어지면 한 번) · `-03`(별 색 실패 — 이전 색으로).
검사: `checks/sim-focus-progress.js`.

## focus-level.js — ⭐ 레벨 표시 이름 · 오늘치 쌓기 · 태블릿

**책임** — `addFocusSeconds`(오늘 시간 · 이번 실행 시간에 더하고 올릴 몫으로 넘김) · 서버 값을 읽는 이름(`getFocusLevel` · `myFocusShow` · `myStarOut` · `getStarColor` · `setStarColor` — 값의 주인은 `focus-progress.js`) · 남의 별 모양(`starFromRemote`) · 별 문자열(`lvStarStr`) · 📱 폰 연결(서버 길 — 아래).
**📱 폰 연결** — 폰 상태는 realtime `mobileFocus{ on, app, at }` 그대로(`startMobile(code, me, session)` 이 `onMessage` 를 걸고 1분 표시 틱을 세션 타이머로 둔다 · `ready` 뒤 서버가 4시간 안의 마지막을 다시 보내 주므로 따로 묻지 않는다). 4시간 상한은 `at`(서버 시각) 기준. 키는 서버가 만들고(`POST /v1/me/focus/mobile-link` · 원문은 그 답에만) 계정 칸 `tw.mobileKey` 에 둔다(QR 다시 보기 · 0.12 의 `{ u, k }` 도 읽음). 만들기 · 끊기(`DELETE`)는 읽은 진척의 주인과 묶이므로 `progress.whenReady()` 뒤에 부르고, 못 받았으면 요청 없이 `E-FOCUS-08` · `-09`. 단추는 끝날 때까지 잠근다.
**함정** — Firebase 프로필 · 마크 · 해금 안내 우편은 걷었다(해금 안내는 서버 알림). 계정 확인 전에는 쌓지 않는다(`_focusTotalStarted`).
검사: `checks/sim-focus-level.js`(모양) · `checks/sim-mobile-focus.js`(폰 연결 동작).

## focus-total.js — ⏱ 오늘 · 이번 실행 시간 · 서버 «오늘»

**책임** — 오늘 시간(계정 칸 `tw.focusTodaySec` · `tw.focusTodayDate`) · 이번 실행 시간 · 진척 답이 준 서버 «오늘»(`serverDay()` — `{ day, isoWeek, dayEndsAt }`). 누적은 서버 값이라 여기 없다.
**하루 경계** — 앱이 날짜를 셈하지 않는다. 날 글자는 서버 `today.day`, 오늘 시간이 0 으로 돌아가는 때는 서버 `dayEndsAt`(한국 06:00 — PC 시간대와 무관). 지나면 요청 없이 0 · 날 글자 비움 · `onDayEnd` 구독자에게 한 번 알림(app.js 가 `focus-progress.js` 의 새 날 받기에 잇는다 — 서로 deps 로 부르면 순환). 서버 답이 오면 날이 같을 때만 이어 쌓는다(0 채움 없는 옛 글자 `2026-11-4` 도 같은 날).
**함정** — `_dayShifted` · `_focusDayStr` · `DAY_START_HOUR` 는 달성표(`weekly-challenge.js`)가 아직 쓴다 — D5-4 에서 서버 날로 바꾸고 걷는다. 오늘 시간은 쓰지 않는다.
검사: `checks/sim-focus-total.js`(모양) · `checks/sim-focus-day.js`(경계 동작).
