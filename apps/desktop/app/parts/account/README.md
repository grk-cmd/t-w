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

## license-api.js · license-premium.js — 프리미엄 판정(classic script `window.TwLicenseApi` · `window.TwLicensePremium`)
- 책임: 프리미엄은 서버가 «이 계정 + 이 기기가 등록돼 있음 + 키 유효» 로 판정한다. `license-api.js` 는 내 라이선스 · 기기 · 라이선스 요청 길(`/v1/me/license*`) 한 벌,
  `license-premium.js` 는 서버 확인(`GET /v1/me` 의 `premium`)을 `isPremium` 에 반영하고 키 등록 · 이 기기 해제를 한다. 이 PC 의 키(`tw.licenseKey`)로 미리 켜지도, 24시간 유예로 버티지도 않는다.
- deps(license-premium): `userApi` · `licenseApi` · `deviceId` · `deviceName` · `setPremium`(account-state `_setPremium` — 바꾸는 곳은 이 한 곳) · `isPremium` · `rtOn` · `notifyError` · `reasonOf` · `resetCustomStatus`.
- 내놓는 것: `start(me)`(켜는 차례 licensePremium — 받아 둔 확인으로 반영 + `license` 알림 걸기) · `refresh()` · `activate(key)` · `deactivate()` → `{ ok, reason? }`.
- 함정:
  - 프리미엄은 **GET /v1/me 응답과 라이선스 쓰기(키 등록 · 이 기기 해제) 응답의 `premium`** 에서만 반영한다(쓰기 하나 = 요청 하나 — 응답에 `premium` 이 없으면 GET /v1/me 를 한 번 더). `PATCH /v1/me` 같은 다른 쓰기 응답은 따르지 않는다. 확인이 도는 중에 쓰기 응답이 오면 끝난 뒤 한 번 더 묻는다(늦은 옛 답이 덮지 않게).
  - 내 라이선스 모양에 `premium`(이 기기 판정) · `deviceLimit`(기기 상한 — 앱에 숫자를 박지 않는다)이 있다. 없거나 모양이 틀리면 `null`(«모름»).
  - 확인 전의 `isPremium=false` 는 «모름» — `acctStateMod.premiumKnown()` 이 참이 된 뒤에야 전용 자산 접기(`pruneUnownedLicenseAssets`)가 돈다. 첫 확인은 값이 그대로여도 알림을 돌려 건너뛴 접기를 돌린다.
  - «전용 책상 · 아이템을 지금 막아야 하나» 는 `acctStateMod.licenseAssetBlocked()` 한 곳에서만 판단한다(모름이면 막지 않음 — 그리기 · 장착 · 생성기 · 프리셋 · 접기). 새로 막는 곳도 조건을 다시 쓰지 말고 이것을 부른다. 캐릭터 코드 불러오기(파츠)는 지우고 저장하는 되돌릴 수 없는 일이라 입구에서 «모름» 이면 아예 멈춘다(`char-code.js`).
  - **기기 등록은 앱이 알아서 하지 않는다** — «키를 직접 넣을 때» 만 등록되고, 프리미엄은 «이미 목록에 있는 기기» 만 켜진다. 라이선스는 있는데 이 기기만 목록에 없는 새 PC 는 «아님» 으로 둔다(기기 관리 화면에서 등록 — D8-2). 켤 때 `GET /v1/me/license` 는 부르지 않는다(프리미엄이 아닌 사용자의 요청 0).
  - 쓰기는 `mine()` 으로 읽은 토큰 주인과 묶는다 — 읽기 전에는 요청 0(`NOT_READ`). provider 의 `putDevice`(이 기기 등록) · `myApplication` · `apply` 는 아직 부르는 곳이 없다 — D8-2(기기 관리 화면 · 요청 구획)에서 부른다.
  - 확인은 한 줄로만 돈다(겹치면 끝난 뒤 한 번 더). 실패해도 혼자 다시 하지 않는다 — E-LIC-01.
- 검사: `checks/sim-license-api.js` · `checks/sim-license-premium.js`.

## login-flow.js — 로그인 흐름(classic script `window.TwLoginFlow`)
- 책임: 로그인(Auth) → 서버 가입 확인(`GET /v1/me`) → realtime 켜기(`TwRtHub.store.start({claim:true})`) · 서버에 닿지 못한 화면에서 기다리기(로컬 모드 없음) · 내 계정 사본(`tw.me` — 로그인 계정과 묶음).
  판정 `confirm()` → `in`(계정 있음) · `signup`(로그인은 됐는데 계정 없음 — 가입 전 · 탈퇴) · `login`(로그인 없음 · 익명 · 토큰 끝남) · `local`(닿지 못함 · 점검).
- deps: `userApi`(user-api.js) · `translate`(api-errors.js) · `reasonOf` · `auth`(Firebase Auth 원시 — ready · user · signInGoogle · signInPassword · signOut) ·
  `googleWindow`(main 의 구글 창) · `rt`(rt-hub — start · stop · bye · onState) · `leaveRoom`(방 안이면 나가기 — 창 열기 통로 LEAVE_ROOM) · `pending`(request-id createPending) · `storage` · `onSessionLost` · `now`.
- 내놓는 것: `confirm` · `goOnline` · `waitForServer(onBack)` · `retryNow()`(서버에 닿지 못한 화면 — realtime 을 `claim:true` 로 켜 두고 ready 신호 또는 «다시 시도» 가 계정을 한 번 묻는다 · 타이머 없음 · 이 PC 기능만 쓰는 로컬 모드는 없다) · `loginGoogle` · `loginPassword` · `joinPassword` · `joinGoogle` ·
  `patchMe(fields)`(사본 version · 먼저 바뀌었으면 다시 받아 한 번 더) · `logout({ why })`(`logout` · `withdraw`) · `release(why)`(계정 바꾸기 `switch` — 로그인은 둔다) · `meCache` · `mode`.
- 함정:
  - realtime 은 서버가 계정을 돌려준 뒤(`goOnline`) 켜는 것이 기본이다 — 가입 전 토큰으로 hello 하면 서버가 끊는다. 예외는 서버에 닿지 못한 화면: `waitForServer` 가 `claim:true` 로 켜 두고(claim 없으면 다른 기기 세션 때문에 4004 로 끊긴다) ready 신호를 계정 다시 묻기에 쓴다. 계정이 없거나 로그인이 풀린 것으로 드러나면 끈다.
  - 비밀번호 가입은 답을 못 받아 다시 누르면 같은 요청 번호 — 비밀번호를 바꾸면 새 번호(같은 번호면 첫 비밀번호의 계정이 돌아온다).
  - 이 PC 계정 몫 지우기 · 다시 켜기는 부르는 쪽(account.js) 몫 — 여기는 화면 · 저장 키 목록을 모른다.
  - 연결을 놓는 차례(설계 04-realtime-disconnect 4-D-3): 방 leave → left 기다림 → realtime `bye{why}` → 서버 닫힘 기다림(1초) → 그 뒤에 로그인을 놓는다. 거꾸로 하면 방 사람들 · 친구는 유예(20초) 뒤에야 나간 것을 본다.
- 검사: `checks/sim-login-flow.js`.

## first-run-013.js — 0.13 첫 실행(classic script `window.TwFirstRun013`)
- 책임: 이 PC 에 남은 0.12 값을 서버로 올리고 지우는 **차례** 한 곳 — ① 로그인 → ② 캐릭터 올리기(legacy-sync) → ③ 라이선스 키 → ④ 이 PC 키 지우기.
  한 단계라도 ok 가 아니면(실패 · 기다림 · 던짐) 멈추고 아무것도 안 지운다 — 다음 실행에 처음부터. 다 끝나면 `tw.firstRun013` = 내 코드(같은 계정은 건너뜀).
- deps: `steps: { login, legacySync, licenseKey }`(각각 `() => Promise<{ ok, wipe?:[키], pending?, reason? }>`) · `storage` · `userCode()` · `log`.
- 내놓는 것: `run()`. 순수: `pendingStep(이름)`(늘 기다림 — 아직 안 채운 단계 자리) · `licenseKeyStep({ storage, activate })`(이 PC 의 옛 `tw.licenseKey` 를 서버에 등록하고 지우라고 함 — 거절 갈래 · 안내) · `loginStep(isIn)` · `LOGIN_LEGACY_KEYS` · `STEPS` · `DONE_KEY`.
- 자리: 캐릭터 · 라이선스 단계는 진짜 함수(`legacyStep` · `licenseKeyStep`). 라이선스 키는 `license-premium.js activate` 로 올리고, 올린 뒤에야 지운다 — 로그아웃은 `tw.licenseKey` · `tw.licenseOptOut` 을 지우지 않는다. 기다림(`pendingStep`)이 있는 동안 지우기는 돌지 않는다.
- 함정: 단계는 서버 답(`…_DONE`)으로 «이미 했다» 를 알아 같은 결과를 내야 한다(이 파일은 차례만 지킨다). 지울 키는 단계가 돌려준 것만 — 기기 id(`tw.deviceId`) · 내 계정 사본(`tw.me`)은 넣지 않는다.
- 검사: `checks/sim-first-run-013.js`.
