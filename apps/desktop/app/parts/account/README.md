# app/parts/account — 계정 · 로그인 · 가입

## user-api.js — 계정 provider(classic script `window.TwUserApi`)
- 책임: 서버 user · invite 길과 탈퇴 미리보기 · 방문 기록 길(`/v1`)을 부르는 한 벌. 경로 · 본문 모양 · 오류 code 는 여기만 안다.
- deps: `api()`(로그인 통로 `TwApi.authed` — 부를 때 찾음) · `newId()`(요청 번호 `TwRequestId.newId`).
- 내놓는 것: `me` · `joinWithPassword` · `joinWithGoogle` · `updateMe` · `attachPasswordLogin` · `changePassword` · `withdrawalPreview` · `withdraw` ·
  `checkInvite` · `myInvites` · `createInvite` · `findByFriendCode` · `visit`. 순수: `meFrom(서버 Me)` · `reasonOf(err)`(code → 화면 한 줄) · `inviteReasonOf`.
  앱 한 벌은 `TwUserApi.store`.
- 함정:
  - 실패는 ApiError 를 그대로 던진다 — «가입 전(401 `USER_CODE_NOT_BOUND`)» 과 «닿지 못함» 을 부르는 쪽이 가른다. 빈 값으로 바꾸지 않는다.
  - 토큰 없는 길은 셋뿐(초대 확인 · 비밀번호 가입 · 방문 기록). 구글 가입에 `password` · `requestId` 를 실으면 서버가 거절한다.
  - 화면 문구는 `reasonOf` 표로 — 서버 message 를 그대로 보여 주지 않는다.
- 검사: `checks/sim-user-api.js`(진짜 api-client 위에서 · 깨 보기).

## login-flow.js — 로그인 흐름(classic script `window.TwLoginFlow`)
- 책임: 로그인(Auth) → 서버 가입 확인(`GET /v1/me`) → realtime 켜기(`TwRtHub.store.start({claim:true})`) · 로컬 모드 · 내 계정 사본(`tw.me` — 로그인 계정과 묶음).
  판정 `confirm()` → `in`(계정 있음) · `signup`(로그인은 됐는데 계정 없음 — 가입 전 · 탈퇴) · `login`(로그인 없음 · 익명 · 토큰 끝남) · `local`(닿지 못함 · 점검).
- deps: `userApi`(user-api.js) · `translate`(api-errors.js) · `reasonOf` · `auth`(Firebase Auth 원시 — ready · user · signInGoogle · signInPassword · signOut) ·
  `googleWindow`(main 의 구글 창) · `rt`(rt-hub) · `pending`(request-id createPending) · `storage` · `onSessionLost` · `now`.
- 내놓는 것: `confirm` · `goOnline` · `enterLocal(onBack)`(로컬 모드 — realtime 을 claim 없이 켜 두고 ready 신호가 오면 한 번 다시 묻는다 · 타이머 없음) · `loginGoogle` · `loginPassword` · `joinPassword` · `joinGoogle` ·
  `patchMe(fields)`(사본 version · 먼저 바뀌었으면 다시 받아 한 번 더) · `logout` · `meCache` · `premiumNow`(마지막 답 + `premiumGraceSec` — D8 이 쓴다) · `mode`.
- 함정:
  - realtime 은 서버가 계정을 돌려준 뒤에만 켠다(가입 전 토큰으로 hello 하면 서버가 끊는다).
  - 비밀번호 가입은 답을 못 받아 다시 누르면 같은 요청 번호 — 비밀번호를 바꾸면 새 번호(같은 번호면 첫 비밀번호의 계정이 돌아온다).
  - 이 PC 계정 몫 지우기 · 다시 켜기는 부르는 쪽(account.js) 몫 — 여기는 화면 · 저장 키 목록을 모른다.
- 검사: `checks/sim-login-flow.js`.

## first-run-013.js — 0.13 첫 실행(classic script `window.TwFirstRun013`)
- 책임: 이 PC 에 남은 0.12 값을 서버로 올리고 지우는 **차례** 한 곳 — ① 로그인 → ② 캐릭터 올리기(legacy-sync) → ③ 라이선스 키 → ④ 이 PC 키 지우기.
  한 단계라도 ok 가 아니면(실패 · 기다림 · 던짐) 멈추고 아무것도 안 지운다 — 다음 실행에 처음부터. 다 끝나면 `tw.firstRun013` = 내 코드(같은 계정은 건너뜀).
- deps: `steps: { login, legacySync, licenseKey }`(각각 `() => Promise<{ ok, wipe?:[키], pending?, reason? }>`) · `storage` · `userCode()` · `log`.
- 내놓는 것: `run()`. 순수: `pendingStep(이름)`(늘 기다림 — 아직 안 채운 단계 자리) · `loginStep(isIn)` · `LOGIN_LEGACY_KEYS` · `STEPS` · `DONE_KEY`.
- 자리: 캐릭터(D1) · 라이선스(D8) 단계는 app.js 가 `pendingStep` 으로 넘긴다 — 그 묶음이 진짜 함수로 바꾼다. 기다림이 있는 동안 지우기는 돌지 않는다.
- 함정: 단계는 서버 답(`…_DONE`)으로 «이미 했다» 를 알아 같은 결과를 내야 한다(이 파일은 차례만 지킨다). 지울 키는 단계가 돌려준 것만 — 기기 id(`tw.deviceId`) · 내 계정 사본(`tw.me`)은 넣지 않는다.
- 검사: `checks/sim-first-run-013.js`.
