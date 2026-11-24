# app/parts/account — 계정 · 로그인 · 가입

## user-api.js — 계정 provider(classic script `window.TwUserApi`)
- 책임: 서버 user · invite 길과 탈퇴 미리보기 · 방문 기록 길(`/v2`)을 부르는 한 벌. 경로 · 본문 모양 · 오류 code 는 여기만 안다.
- deps: `api()`(로그인 통로 `TwApi.authed` — 부를 때 찾음) · `newId()`(요청 번호 `TwRequestId.newId`).
- 내놓는 것: `me` · `joinWithPassword` · `joinWithGoogle` · `updateMe` · `attachPasswordLogin` · `changePassword` · `withdrawalPreview` · `withdraw` ·
  `checkInvite` · `myInvites` · `createInvite` · `findByFriendCode` · `visit`. 순수: `meFrom(서버 Me)` · `reasonOf(err)`(code → 화면 한 줄) · `inviteReasonOf`.
  앱 한 벌은 `TwUserApi.store`.
- 함정:
  - 실패는 ApiError 를 그대로 던진다 — «가입 전(401 `USER_CODE_NOT_BOUND`)» 과 «닿지 못함» 을 부르는 쪽이 가른다. 빈 값으로 바꾸지 않는다.
  - 토큰 없는 길은 셋뿐(초대 확인 · 비밀번호 가입 · 방문 기록). 구글 가입에 `password` · `requestId` 를 실으면 서버가 거절한다.
  - 화면 문구는 `reasonOf` 표로 — 서버 message 를 그대로 보여 주지 않는다.
- 검사: `checks/sim-user-api.js`(진짜 api-client 위에서 · mutation test).

## app-version-sync.js — 계정 단위 판 맞추기(classic script `window.TwAppVersionSync`)
- 책임: 계정에 들어간 뒤 이 앱 판을 서버에 알리고(`POST /v2/me/app-version`, 본문 `{ version }` 만 — 계정은 토큰으로 서버가 정한다), 응답이 `behind: true`(이 계정이 더 새 판을 쓰는 기기가 있다)면 업데이트 강제 창으로 막는다. 판 비교는 서버가 한다 — 앱은 `behind` 만 믿는다.
- deps: `authed`(`TwApi.authed`) · `getVersion()`(`window.TwAppVersion.ready` — `shared/app-version.js` 의 `sharedAppVersion` 한 벌을 rt-bind 가 내놓는다) · `block(my, highest)`(app.js 가 `updateFlowMod.forceAccount(highest)` 로 잇는다 — false 를 돌려주면 창을 못 띄운 것이라 경고 한 줄) · `warn`.
- 내놓는 것: `createAppVersionSync(deps)` → `start(session)` → `{ state: 'behind' | 'ok' | 'skipped' | 'stale' }` · `PATH` · `STATE`. 시작은 app-boot 의 `appVersion` 차례 한 곳.
- 함정:
  - 판 모양 규칙은 `shared/app-version.js` 의 `cleanAppVer` 한 곳 — 여기서는 `null`(«모름»)만 거른다.
  - 가입 전(익명) 로그인은 계정 확인이 «로그인 필요» 로 걸러 이 차례에 오지 않는다 — 따로 거르지 않는다.
  - 못 알려도(닿지 못함 · 모양이 다른 답 · 판을 모름) 막지 않는다(잘못 막는 쪽이 더 크다). 숨기지는 않는다 — 까닭을 `console.warn` 한 줄로 남긴다. 다시 보내지 않는다 — 다음에 켤 때 다시 알린다.
  - 답이 오기 전에 세션이 끝났으면(`stale`) 그 답을 버린다 — 옛 계정의 답이 새 로그인을 막지 않게.
  - 창은 `shared/update-flow.js` 의 `forceAccount`(이미 최소 버전 · 통신 판으로 막혔으면 그 창을 둔다).
- 검사: `checks/sim-app-version-sync.js` · `checks/sim-update-flow.js` 6-3절.

## license-api.js · license-premium.js — 프리미엄 판정(classic script `window.TwLicenseApi` · `window.TwLicensePremium`)
- 책임: 프리미엄은 서버가 «이 계정 + 이 기기가 등록돼 있음 + 키 유효» 로 판정한다. `license-api.js` 는 내 라이선스 · 기기 길(`/v2/me/license*`) 한 벌,
  `license-premium.js` 는 서버 확인(`GET /v2/me` 의 `premium`)을 `isPremium` 에 반영하고 키 등록 · 이 기기 해제를 한다. 이 PC 의 키(`tw.licenseKey`)로 미리 켜지도, 24시간 유예로 버티지도 않는다.
- deps(license-premium): `userApi` · `licenseApi` · `deviceId` · `deviceName` · `setPremium`(account-state `_setPremium` — 바꾸는 곳은 이 한 곳) · `isPremium` · `rtOn`(해제 함수를 돌려줌) · `resetKnown`(account-state `resetPremium` — «모름» 으로 되돌림) · `notifyError` · `reasonOf` · `resetCustomStatus` · `storage`(해제 표시 `tw.licenseOptOut` · 기기 가득 안내 기록 `tw.licenseFullNoticed`) · `toast` · `toastFull`([설정 열기] 달린 토스트).
- 내놓는 것: `start(me)`(켜는 차례 licensePremium — 받아 둔 확인으로 반영 + `license` 알림 걸기) · `refresh()` · `activate(key, opts)` · `deactivate(opts)` · `registerDevice()` → `{ ok, reason?, err?, lic? }`(`lic` = 쓰기 응답의 내 라이선스 · `opts.ownerKnown` = 화면이 창 열기에서 이미 읽었으니 쓰기 전 읽기를 건너뜀) · `reset()`(`activate` · `deactivate` 가 쓰기를 기다리는 동안 reset 되면 `{ ok:false, stale:true }` — 부르는 쪽은 알리지 않는다 · 알림 구독을 풀고 gen 을 올려 늦은 답을 버림 · «모름» 으로 — S-4 세션 dispose 가 부를 자리). E-LIC-01 은 사용자가 누른 동작 뒤 확인 실패만.
- 함정:
  - 프리미엄은 **GET /v2/me 응답과 라이선스 쓰기(키 등록 · 이 기기 해제) 응답의 `premium`** 에서만 반영한다(쓰기 하나 = 요청 하나 — 응답에 `premium` 이 없으면 GET /v2/me 를 한 번 더). `PATCH /v2/me` 같은 다른 쓰기 응답은 따르지 않는다. 확인이 도는 중에 쓰기 응답이 오면 끝난 뒤 한 번 더 묻는다(늦은 옛 답이 덮지 않게).
  - 내 라이선스 모양에 `premium`(이 기기 판정) · `deviceLimit`(기기 상한 — 앱에 숫자를 박지 않는다)이 있다. 없거나 모양이 틀리면 `null`(«모름»).
  - 확인 전의 `isPremium=false` 는 «모름» — `acctStateMod.premiumKnown()` 은 캐릭터 코드 불러오기(`char-code.js`)만 쓴다. 전용 자산 접기(`pruneUnownedLicenseAssets`)는 카탈로그의 서버 `locked` 가 온 뒤 레코드마다 돈다(`catalog-sync` 가 카탈로그 도착 때 되돌리기 · 접기를 부른다). 프리미엄 값이 그대로면 알림은 조용하다.
  - «전용 책상 · 아이템을 지금 막아야 하나» 는 `acctStateMod.licenseAssetBlocked()` 한 곳에서만 판단하고, 그 답은 카탈로그 레코드의 서버 `locked` 하나다(그리기 · 장착 · 생성기 · 프리셋 · 접기 — 앱이 프리미엄 · 관리자를 다시 가리지 않는다). 새로 막는 곳도 조건을 다시 쓰지 말고 이것을 부른다. 캐릭터 코드 불러오기(파츠)는 지우고 저장하는 되돌릴 수 없는 일이라 입구에서 `premiumKnown` 이 «모름» 이면 아예 멈춘다(`char-code.js`).
  - **켤 때 자동 등록(0.12 와 같게)** — 확인이 «아님» 이면 `GET /v2/me/license` 를 한 번 읽고, 유효한 라이선스에 이 기기만 없으면 [이 기기 등록] 과 같은 `PUT /v2/me/license/devices/{id}` 로 등록한 뒤 «🎫 계정에 등록된 라이선스를 이 PC에서도 켰어요» 를 띄운다. 프리미엄이 아닌 사용자는 켤 때마다 읽기 한 번이 는다.
    - 해제 표시 `tw.licenseOptOut` 이 그 라이선스(`id:<licenseId>`)를 가리키면 안 한다 — [이 기기에서 해제] 가 적고, 키 등록 · [이 기기 등록] 이 지운다. 0.12 가 남긴 값(해제한 키)은 한 번만 쓴다 — 켜고 첫 확인에서 «유효한데 이 기기만 없음» 이면 `id:<licenseId>` 로 바꾸고(등록 안 함), 그 밖이면 지운다(다른 계정에 남지 않게). 로그아웃은 이 표시를 지우지 않는다.
    - 자동 등록은 켜는 차례 맨 끝 `licenseAutoRegister`(첫 실행 `firstRun` 뒤)에서 한 번 — `autoRegisterAfter(firstRunMod.licenseDone())`. 이번 첫 실행의 라이선스 키 단계가 0.12 키로 등록을 해 봤으면(성공 · 기기 가득) 그쪽 몫이라 건너뛰고 — 그 뒤 단계가 멈춰도 같다 — 아니면(키 없음 · 해제한 키 · 쓸 수 없는 키 · 키 단계 전에 멈춤 · 끝낸 계정) 자동 등록이 한다. 기기 가득이면 `activate` 가 같은 기억에 적어 `showFull` 로 띄울지 알려 준다(글 `FULL_NOTICE` 한 벌 — 요청 · 안내가 두 벌이 되지 않게). 첫 실행의 기기 가득 안내는 기억에 적었으면(`showFull` true) 뒤 단계가 멈춘 자리에서도 띄우고, 적지 못했으면(계정에 라이선스가 아직 없음) 첫 실행이 끝날 때 한 번 띄운다.
    - 표시 이름(`OPT_OUT_KEY`)과 뜻 읽기(`parseOptOut`)는 `license-premium.js` 한 곳. 첫 실행 라이선스 키 단계는 켤 때 본 값(`optOutAtStart`)을 deps 로 받아, 0.12 표시가 이 PC 의 키와 같을 때만 올리지 않는다(다른 키면 낡은 표시 — 키를 올리고 표시를 지운다).
    - 서버가 거절하면 다시 하지 않는다(다음 켜기에 한 번 더) · 번호 없음. 기기 가득(`409 LICENSE_DEVICE_FULL`)이면 «라이선스 기기를 모두 썼어요 — 설정 › 라이선스에서 하나를 빼면 이 PC를 등록할 수 있어요» 토스트([설정 열기] 달림 — `toastFull`)를 라이선스마다 한 번 — `tw.licenseFullNoticed` 에 안내한 라이선스 id 를 최근 8개까지 적고(계정 A → B → A 에도 한 번), 이 기기가 등록되면(자동 · [이 기기 등록] · 키 등록) 그 id 를 뺀다. 그 밖(5xx · 네트워크)은 콘솔에만. 설정 › 라이선스 화면의 [이 기기 등록] 은 그대로다(안내 문구라 오류 번호 없이 — 화면의 «기기를 모두 썼어요» 와 같은 갈래).
  - 쓰기는 `mine()` 으로 읽은 토큰 주인과 묶는다 — 읽기 전에는 요청 0(`NOT_READ`). provider 의 `putDevice`(이 기기 등록)는 `registerDevice()` 가 부른다.
  - 확인은 한 줄로만 돈다(겹치면 끝난 뒤 한 번 더). 실패해도 혼자 다시 하지 않는다 — E-LIC-01.
- 검사: `checks/sim-license-api.js` · `checks/sim-license-premium.js`.

## license-screen.js · license-ui.js · license-key.js — 설정 › 라이선스 구획(classic script `window.TwLicenseScreen` · `window.TwLicenseUi` · `window.TwLicenseKey`)
- 책임: 사용자가 설정 창에서 보는 «내 라이선스 · 기기 목록». `license-screen.js` 는 상태(`load` idle · loading · ready · failed / `lic`)와 동작(키 등록 · 이 기기 해제 · 다른 기기 빼기 · 이 기기 등록)을 쥔다.
  `license-ui.js` 는 `view()` 를 칸에 그리기만, `license-key.js` 는 단추를 동작에 잇기만 한다.
- deps(license-screen): `licenseApi`(`mine` · `removeDevice` · `reasonOf` · `isDeviceFull`) · `licensePremium`(`activate` · `deactivate` · `registerDevice`) · `deviceId` · `isAdmin` · `isShown`(라이선스 구획이 보이는 중인가) · `rtOn`(해제 함수를 돌려줌) · `notifyError` · `toast`.
- 내놓는 것: `open({ ifNeeded? })`(창 열기 = 받기 · `ifNeeded` 는 탭만 누를 때 — 이미 받았으면 건너뜀) · `view()`(그릴 것 한 벌 — `mode` loading · failed · none · revoked · registered · unregistered) · `state()` · `submitKey` · `removeThisDevice` · `removeDevice(id)` · `registerThisDevice` · `onChange(fn)` · `reset()`.
  `license-ui.js` 는 `refreshLicenseUI()`(그리기) · `openLicenseUI(opts)`(받기 + 그리기 — 설정 창이 라이선스 탭을 열 때 부른다).
- 함정:
  - 동작은 한 번에 하나(`busy`) · 받는 중에도 쓰기는 거절 — 받은 옛 목록이 쓰기 응답(곧 새 목록)을 덮지 않게. 받기 전 · 못 받음(`failed`)에서는 요청 0.
  - 서버 `license` 알림은 구획이 보일 때만 받고, 동작 중에 온 것은 끝난 뒤로 미룬다. 알림으로 받다 실패하면 번호 없이 «못 불러왔어요» 만 · 같은 받기 실패 번호(E-LIC-03)는 이어지는 동안 한 번.
  - 번호: 받기 E-LIC-03 · 이 기기 해제 E-LIC-02 · 기기 빼기 E-LIC-04 · 이 기기 등록 E-LIC-05 · 키 등록 E-LIC-06(사용자가 못 고치는 실패만 — 없는 키 · 남의 키 · 회수된 키 · 이미 라이선스 · 기기 가득은 입력칸 아래 문구). 로그인이 풀린 실패는 알리지 않는다.
  - «이 기기» 는 기기 id 가 같을 때만 · 기기 상한은 서버 `deviceLimit`(없으면 «모름» — 가득 참을 미리 판단하지 않고 서버 거절 `LICENSE_DEVICE_FULL` 을 따른다). 서버가 준 기기 이름은 `textContent` 로만 넣는다.
  - 이 기기를 «빼기» 로 뺄 수 없다 — 프리미엄 판정을 같이 다시 정해야 해서 «이 기기에서 해제» 로만.
  - 계정이 바뀌면 `reset()` — 알림 구독을 풀고 `gen` 을 올려 늦게 온 옛 답을 버린다(S-4 세션 `dispose` 가 부를 자리).
- 검사: `checks/sim-license-screen.js`(상태 · 그리기 · mutation test) · `checks/sim-license-ui.js` · `checks/sim-license-key.js`(모듈 모양 · 단추 연결).

## login-flow.js — 로그인 흐름(classic script `window.TwLoginFlow`)
- 책임: 로그인(Auth) → 서버 가입 확인(`GET /v2/me`) → (이 PC 등록 뒤 app-boot 가 부르는) realtime 켜기(`TwRtHub.store.start({claim:true})`) · 서버에 닿지 못한 화면에서 기다리기(로컬 모드 없음) · 내 계정 사본(`tw.me` — 로그인 계정과 묶음).
  판정 `confirm({ onRestoreWait })` → `in`(계정 있음) · `signup`(로그인은 됐는데 계정 없음 — 가입 전 · 탈퇴) · `login`(로그인 없음 · 익명 · 토큰 끝남) · `local`(닿지 못함 · 점검 · `restoring:true` 면 저장된 로그인의 첫 답이 60초 안에 안 옴 — 로그인은 둔다).
- deps: `userApi`(user-api.js) · `translate`(api-errors.js) · `reasonOf` · `auth`(Firebase Auth 원시 — ready · user · restoring · answered · signInGoogle · signInPassword · signOut) ·
  `googleWindow`(main 의 구글 창) · `rt`(rt-hub — start · stop · bye · onState) · `leaveRoom`(방 안이면 나가기 — 창 열기 통로 LEAVE_ROOM) · `pending`(request-id createPending) · `storage` · `onSessionLost(kind)`(`sessionLost` · `deviceRemoved`) · `now` · `onConfirmed(r, info)`(확인 결과 진단 — login-diag.js · 던져도 결과는 그대로).
- 내놓는 것: `confirm` · `goOnline` · `waitForServer(onBack)` · `retryNow()`(서버에 닿지 못한 화면 — realtime 을 켜 두고 서버 신호(ready · 등록 전이라 4004 로 끊김) 또는 «다시 시도» 가 계정을 한 번 묻는다 · 타이머 없음 · 이 PC 기능만 쓰는 로컬 모드는 없다) · `loginGoogle` · `loginPassword` · `joinPassword` · `joinGoogle` ·
  `patchMe(fields)`(사본 version · 먼저 바뀌었으면 다시 받아 한 번 더) · `logout({ why })`(`logout` · `withdraw`) · `release(why)`(계정 바꾸기 `switch` — 로그인은 둔다) · `meCache` · `mode`.
- 함정:
  - realtime 은 서버가 계정을 돌려주고 이 PC 를 등록한 뒤(app-boot → `goOnline`) 켜는 것이 기본이다 — 등록 전 세션으로 hello 하면 서버가 4004 로 끊는다. 예외는 서버에 닿지 못한 화면: `waitForServer` 가 켜 두고 그 신호(ready · 4004)를 계정 다시 묻기에 쓴다(그 4004 는 안내 화면이 아니다). 닿아도 여기서 다시 켜지 않는다 — 등록 뒤 `goOnline` 이 켠다(켜져 있으면 허브가 무시). 계정이 없거나 로그인이 풀린 것으로 드러나면 끈다.
  - 복원 기다림: 8초 대기선(`auth.ready` — 쓰기용)이 풀려도 켤 때 저장된 로그인이 있고 Firebase 첫 답이 없으면(`auth.restoring()`) «로그인 없음» 으로 보지 않고 `RESTORE_WAIT_MS`(60초)까지 기다린다(`onRestoreWait` 한 번 — 게이트가 «연결 중 · 로그인을 확인하는 중» 카드). 넘기면 `local` + `restoring` — 같은 카드에 [다시 시도](다시 기다림) · 늦게 온 첫 답에 혼자 이어 감. Firebase 가 «사용자 없음» 으로 답하면 그때 `login`.
  - 비밀번호 가입은 답을 못 받아 다시 누르면 같은 요청 번호 — 비밀번호를 바꾸면 새 번호(같은 번호면 첫 비밀번호의 계정이 돌아온다).
  - 이 PC 계정 몫 지우기 · 다시 켜기는 부르는 쪽(account.js) 몫 — 여기는 화면 · 저장 키 목록을 모른다.
  - 연결을 놓는 차례(설계 04-realtime-disconnect 4-D-3): 방 leave → left 기다림 → realtime `bye{why}` → 서버 닫힘 기다림(1초) → 그 뒤에 로그인을 놓는다. 거꾸로 하면 방 사람들 · 친구는 유예(20초) 뒤에야 나간 것을 본다.
- 검사: `checks/sim-login-flow.js`.

## login-diag.js — 켤 때 로그인 진단(classic script `window.TwLoginDiag`)
- 책임: 켤 때 한 번 진단 기록(`tw-mouse-diag.log` · `companion.diagNote`)에 `[로그인]` 줄을 남겨 «다시 켜면 자동 로그인이 풀림» 을 가른다 — 시작(저장된 로그인 키 `firebase:authUser:` 있음 · 글자 수 · IndexedDB 저장소 · localStorage 크기) · 대기선(첫 상태 먼저 · 8초 시간 초과 먼저 · 늦게 도착) · 저장된 로그인이 있었는데 첫 상태가 «사용자 없음»(Firebase 가 지움) · 켜고 15초 긴 작업(long task) 합 · 최대 · 확인(confirm) 결과(state · HTTP 상태 + 오류 code · NO_TOKEN · network).
- deps: `note` · `now`(performance.now) · `storage` · `idbNames` · `observeLongTasks(cb)`(잴 수 없으면 null) · `later`. 앱 한 벌은 `TwLoginDiag.store`(실리며 만든다 — 긴 작업을 처음부터 재려고 html 맨 앞쪽).
- 내놓는 것: `store.authStart(hasAuth)` · `authState(user)` · `authError(e)` · `barrierTimeout()`(auth-barrier.js 대기선) · `confirmed(r, info)`(login-flow.js deps `onConfirmed` — info.restore 면 확인 줄 끝에 «복원 기다림 n ms» · 답 없음이면 «복원 답 없음 — 로그인 둠»). 순수: `storageInfo` · `hasStoredLogin`(저장된 로그인 판정 한 곳 — auth-barrier.js 가 쓴다) · `userKind` · `errTag` · 줄 만들기.
- 함정:
  - 값은 적지 않는다 — 저장된 로그인은 있음 · 글자 수만, 서버 · Firebase 오류는 code 모양이 맞을 때만(서버 message 는 안 적음). uid · 이메일 · 토큰 · 친구코드 · 유저코드가 들어갈 자리를 만들지 않는다.
  - 알리기만 한다 — 대기선 · 확인 결과를 바꾸지 않고, 안의 실패는 삼킨다. 확인 줄은 첫 답 하나(첫 답이 local 이면 다음 답까지).
- 검사: `checks/sim-login-diag.js`.

## auth-barrier.js — 로그인 복원 대기선(classic script `window.TwAuthBarrier`)
- 책임: Firebase Auth 가 저장된 로그인을 되읽고 처음 답할 때까지의 기다림 둘을 나눈다 — `ready()`(소유권이 걸린 쓰기 · 첫 답 또는 8초 뒤 반드시 풀림) · `answered(maxMs)`(켤 때 «누구인가» 판정 — 첫 답이면 true · 상한이면 false · maxMs 를 빼면 상한 없음) · `restoring()`(켤 때 저장된 로그인이 있었고 아직 첫 답 없음).
- deps: `subscribe(onUser, onError)`(onAuthStateChanged — Auth 초기화 실패면 null) · `storedLogin`(TwLoginDiag.hasStoredLogin) · `later` · `diag`(login-diag store — authState · authError · barrierTimeout) · `warn`. 만드는 곳은 firebase-init.js 하나(`firebaseAPI.authReady` · `authRestoring` · `authAnswered`).
- 함정:
  - 8초 시간 초과는 `ready` 만 푼다 — `answered` 를 같이 풀면 바쁜 PC 가 켤 때마다 로그인 화면으로 떨어진다(예전 동작).
  - 상한에 «답함» 을 지어내지 않는다 — 시간 초과는 false, 로그인은 그대로 둔다(지우지 않는다).
- 검사: `checks/sim-auth-barrier.js`.

## device-register.js · device-limit-dialog.js · device-lost.js — 계정마다 PC 는 서버가 정한 상한까지(classic script `window.TwDeviceRegister` · `window.TwDeviceLimitDialog` · `window.TwDeviceLost`)
- 책임: 한 계정은 PC 를 서버가 정한 상한까지 쓴다(앱은 대수를 모른다 — 글에 숫자를 쓰지 않는다). 자리는 서버가 정한다 — 켤 때 realtime 보다 먼저 이 PC 를 등록(`POST /v2/me/devices { deviceId, session, os }` — `device-register.js ensure()` → `ok` · `canceled` · `failed`).
  다 찬 계정에 새 PC 면 서버가 409 `USER_DEVICE_LIMIT` 와 가장 오래 안 쓴 기기(`items[0]`)를 준다 → 확인창(`device-limit-dialog.js`) «가장 오래된 기기 Windows PC (11월 3일 등록) · 마지막 사용 11월 10일 — 이 기기를 지우고 이 PC를 쓸까요?» [취소] · [지우고 사용].
  [지우고 사용]이면 보여 준 그 기기 id 를 `replaceOldest` 로 다시 — 그사이 바뀌었으면 서버가 또 409(새 기기로 다시 묻는다). [취소]면 등록하지 않고 로그인 화면(app-boot `toLogin`). 저절로 지우지 않는다.
  realtime 이 이 연결을 4004 로 끊으면(까닭 `deviceRemoved` — 다른 PC 가 이 기기를 지움 · `sessionLost` — 이 PC 에서 앱을 새로 엶) `device-lost.js` 안내 화면 · 단추는 같은 등록 흐름 → 되면 같은 realtime 연결로 다시.
- 기기 이름: OS + 처음 등록한 날(`deviceLabel` — «Windows PC (11월 3일 등록)» · «Mac (…)» · 모르면 «PC»), 마지막 사용은 따로. **호스트 이름은 쓰지 않는다**(사람 이름이 든 경우가 많다).
- deps: register — `registerDevice` · `limitOldestOf`(user-api.js) · `deviceId`(device-id.js) · `session`(rt-hub `session()` — hello.session 과 같은 값) · `os`(`osOf(navigator)`) · `ask(question)`(확인창) · `notifyError`. dialog — `document`. lost — `twNav` · `continueHere`(등록 → realtime).
- 함정: 같은 계정이 다른 PC 에서 같은 방에 들어온 것(`left{replaced}`)은 이 화면이 아니다 — 방에서만 나오고 «다른 PC에서 이 방에 들어왔어요» 한 줄(room-entry.js). 등록 실패(E-ACC-04)는 그대로 이어 간다 — realtime 이 안 들이면 안내 화면이 [다시 등록]을 준다.
- 검사: `checks/sim-device-register.js` · `checks/sim-device-limit-dialog.js` · `checks/sim-device-lost.js`.

## first-run-013.js — 0.13 첫 실행(classic script `window.TwFirstRun013`)
- 책임: 이 PC 에 남은 0.12 값을 서버로 올리고 지우는 **차례** 한 곳 — ① 로그인 → ② 캐릭터 올리기(legacy-sync) → ③ 라이선스 키 → ④ 이 PC 키 지우기.
  한 단계라도 ok 가 아니면(실패 · 기다림 · 던짐) 멈추고 아무것도 안 지운다 — 다음 실행에 처음부터. 다 끝나면 `tw.firstRun013` = 내 코드(같은 계정은 건너뜀).
- deps: `steps: { login, legacySync, licenseKey }`(각각 `() => Promise<{ ok, wipe?:[키], pending?, reason? }>`) · `storage` · `userCode()` · `log`.
- 내놓는 것: `run()`. 순수: `pendingStep(이름)`(늘 기다림 — 아직 안 채운 단계 자리) · `licenseKeyStep({ storage, activate })`(이 PC 의 옛 `tw.licenseKey` 를 서버에 등록하고 지우라고 함 — 거절 갈래 · 안내) · `loginStep(isIn)` · `LOGIN_LEGACY_KEYS` · `STEPS` · `DONE_KEY`.
- 자리: 캐릭터 · 라이선스 단계는 진짜 함수(`legacyStep` · `licenseKeyStep`). 라이선스 키는 `license-premium.js activate` 로 올리고, 올린 뒤에야 지운다 — 로그아웃은 `tw.licenseKey` · `tw.licenseOptOut` 을 지우지 않는다. 기다림(`pendingStep`)이 있는 동안 지우기는 돌지 않는다.
- 함정: 단계는 서버 답(`…_DONE`)으로 «이미 했다» 를 알아 같은 결과를 내야 한다(이 파일은 차례만 지킨다). 지울 키는 단계가 돌려준 것만 — 기기 id(`tw.deviceId`) · 내 계정 사본(`tw.me`)은 넣지 않는다.
- 검사: `checks/sim-first-run-013.js`.

## google-confirm.js — 🔑 구글을 계정에 처음 붙이기 전에 묻기

- **책임**: 처음 보는 구글 계정이 이 PC 의 계정(친구 코드)에 묶이기 전에, 가린 주소(`mi***@gmail.com`)와 친구 코드를 보이고 묻는다. 구글을 여러 개 쓰는 사람이 다른 구글을 골라 빈 계정에 묶이는 실수(«데이터가 사라졌다»)를 막는다.
- **만드는 법**: app.js 가 초대 게이트 · 계정보다 먼저 `const googleConfirmMod = TwGoogleConfirm.createGoogleConfirm({ friendCode, signInWithGoogle })` · 두 모듈에 deps `googleConfirmMod` 로 넘긴다.
- **내놓는 것**
  - `ask(email, mode, code?)` → `'yes' | 'other' | 'cancel'` — `bind`(로그인) · `signup`(구글로 가입 — 제목만 «이 구글 계정으로 가입할까요?» · 새 아이디를 넘긴다) · `link`(로그인된 계정에 구글 붙이기). 로그인 · 가입은 `firebaseAPI.authSignInWithGoogle(idToken, userCode, ask)` 의 세 번째 인자로 넘겨, **처음 보는 구글을 묶기 직전에만** 불린다(이미 연결된 구글 · 묶을 코드가 없을 때는 안 묻는다). 아니면 `{ declined }` — 막 생긴 구글 로그인 계정은 지운다.
  - `pickForLink()` — 구글 창 → 묻기 → [다른 구글 고르기]면 다시 → `{ ok, idToken }`. 내 정보 [연결하기] · 가입 완료 [구글도 연결하기].
  - `maskEmail` · `tokenEmail` — 순수 함수.
- **함정**
  - 기본 포커스는 [다른 계정으로 로그인] — 잘못 묶은 쪽이 되돌리기 어렵다.
  - 창(`#gConfirmOverlay`)은 게이트 · 가입 완료 위(`--z-gate-confirm`) · 바탕화면 실행 화면 클릭 통과 목록(`UI_HIT_SEL`)에 있어야 눌린다.
  - `tokenEmail` 은 보여 주기만 한다 — 신원은 서버(Firebase Auth)가 정한다.
- TODO: 0.13 합친 뒤 — 로그인 · 구글 가입은 login-flow.js(서버 `GET /v2/me`)로 바뀌어 `ask(…, 'bind' | 'signup')` 를 부르는 곳이 없다. 지금은 `pickForLink`(구글 붙이기) · `pickCurrent` · `pickForChange`(구글 바꾸기)만 쓴다 — 로그인 · 가입 때 묻기는 서버 흐름 위로 다시 걸어야 한다.
- **검사**: `sim-google-confirm.js`(창 · 순수 함수 · 연결)

## google-change-net.js — 🔁 구글 계정 바꾸기(서버 쪽 순서)

- **책임**: 로그인된 계정(같은 Auth uid · 유저 코드)의 **구글 연결만** 새 구글로 갈아 끼운다 — 친구 · 마이홈 · 라이선스 · 서버 데이터 · 규칙은 그대로. 순서: 지금 구글로 본인 확인(reauth) → 지금 구글 끊기(unlink) → 새 구글 붙이기(link). 새 구글을 못 붙이면 지금 구글을 다시 붙여 되돌린다.
- **만드는 법**: ES 모듈. firebase-init.js 가 `authChangeGoogle: createGoogleChange({ currentUser, credential, reauth, unlink, link }).change` 로 잇는다.
- **화면**: 내 정보 › 계정 › 로그인 수단의 구글 줄 — 지금 구글(가린 주소) · [바꾸기]. 흐름은 account.js `_acctChangeGoogle`(google-confirm.js `pickCurrent` → `pickForChange` → 이 모듈).
- **함정**
  - 비밀번호(친구 코드 + 비밀번호)가 있는 계정만 — Firebase 는 한 계정에 구글을 하나만 붙여서 새 구글이 남의 것인지는 끊은 뒤에야 안다. 되돌리기까지 실패해도 로그인할 길이 남아야 한다.
  - 이 PC 를 구글로 로그인했다면 표시 이메일(`tw.loginEmail`)도 새 구글로 — 친구 코드로 로그인했으면 그대로.
- **검사**: `sim-google-change.js`(막기 · 확인 · 바꾸기 · 되돌리기) · `sim-google-confirm.js` 5절(고르기 · 묻는 창) · `sim-signup.js` 10절(구글 줄 그리기)
