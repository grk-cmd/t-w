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
