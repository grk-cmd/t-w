# 작업 현황판 — 누가 무엇을 만지는 중인가

여럿이 같은 파일을 동시에 고치다 충돌이 나지 않게 하려고 둔다. **작업을 시작하기 전에 «건드리는 파일» 칸을 보고, 내 파일이 겹치면 그 줄 담당과 먼저 맞춘다.**
머지 담당(검증 세션)이 PR 을 올리거나 머지할 때마다 고친다. 기준: 2026-10-17.

## 0.11.4 기능 멈춤 (10-17 사용자)
- **0.11.4 에 넣을 기능은 여기까지.** 이제부터 만드는 기능 · 옮기기는 요청(PR)까지만 올리고, 0.11.4 릴리스 뒤에 하나씩 합친다.
- 0.11.4 에 넣는 것은 회귀 · 급한 버그 고침만(검증 세션과 먼저 맞춘다).
- 서버로 옮기기(앱은 API 하고만 · Firebase 는 저장소 포트 뒤 · 인증은 Firebase Auth)는 설계 문서(서버 저장소 docs/notes) 차례대로 0.11.4 뒤부터.

## 작업 시작 절차 — 누구든 코드를 만지기 전에 이것부터
1. `git pull` 로 이 파일을 받아 «진행 중» 표를 본다. 내가 고칠 파일이 다른 줄의 «건드리는 파일» 과 겹치면 **시작하지 말고** 그 담당과 먼저 맞춘다.
2. 겹치지 않으면 «진행 중» 표에 한 줄을 더한다 — 묶음 이름 · **담당(사람 또는 세션 이름)** · 내용 · 건드리는 파일 · 제보 번호(있으면).
3. **이 파일 하나만은 PR 없이 main 에 바로 커밋 · push 한다**(`docs(status): <묶음> 시작 — <담당>`). 다른 파일을 같은 커밋에 섞지 않는다 · force push 금지 · push 가 거절되면 `git pull --rebase` 뒤 다시.
4. PR 을 올리면 그 줄에 PR 번호를, 머지되면 줄을 «머지 완료» 로 옮긴다(이것도 main 에 바로).
- 웹 관리자 📋 할 일(`adminTodos`)은 계속 써도 되지만, «지금 누가 어느 파일을 만지는가» 는 이 파일이 정본이다.

## 규칙
- **자기 작업은 누구든 직접 합칠 수 있다 — 이 차례대로만.** ① 합치기 직전 `git pull`(main 최신) ② `checks/CHECKS.md` 개정 번호를 «main 다음 번호» 로 다시 매기고 §3 해시 ③ `npm run check` 빨강 0 ④ push 뒤 자동 검사 초록 ⑤ 합치고 이 표에 머지 표시. 둘이 같은 번호를 잡으면 나중 쪽이 «충돌» 로 막히니, 그쪽이 다시 매겨 올리면 된다.
- 작업자 대기열(`docs/local/carve-handoff/QUEUE.md`) · 남의 요청은 검증 세션이 합친다.
- `checks/CHECKS.md` 개정 번호는 머지 직전에 main 다음 번호로 다시 매긴다. PR 을 올릴 땐 임시 번호여도 된다.
- **클릭 통과(setIgnoreMouseEvents)를 정하는 조건은 `app/parts/launcher/click-through-policy.js` 한 곳에만 쓴다.** 다른 파일에 조건을 쓰면 `sim-click-through-policy.js` 가 빨강이다(#315 머지부터).
- **담당 이름은 남과 겹치지 않게** 쓴다(예: «검증-도우미1» · «계정 세션» · 사람 이름). 같은 이름이 둘이면 누가 누군지 못 가린다.
- 버그 제보를 고친 PR 은 제목 끝에 `(B-MMDD-n)` 을 붙이고, 아래 «제보 → 수정» 표에 한 줄 더한다.

## 진행 중 — 검증 · PR 올리는 중
| 묶음 | 담당 | 내용 | 건드리는 파일 | PR |
|---|---|---|---|---|
| ~~통로 듣기 다시 붙기~~ 머지 #360 | 검증 세션 | 서버 듣기가 값을 받은 뒤 끊기면(서버 배포 · 재시작) 조용히 멈추던 것 → 잠깐 뒤 다시 붙고, 못 붙으면 Firebase 로 | `shared/data-gateway.js` · `checks/sim-data-gateway.js` · `CHECKS.md` | — |
| 서버 범용 통로 바닥(요청만 · 0.11.4 뒤 합침) | 서버-통로1 | t-w-server: ① `/v1/config` 에 dataRoutes ② `POST /v1/data` · `/v1/data/stream` + 경로 처리기 등록부 + `me`(토큰 → authUsers) + 모르는 경로 404 — PR 하나씩 · 그 뒤 처리기 1개 = PR 1개(친구 → 방 초대 → 포커스 → 친구코드 → 방명록) | t-w-server `api/` 설정 · 새 data 모듈 | — |
| ~~앱 TS 방향 문서~~ 머지 #357 | 검증 세션 | 앱은 TS 로 간다(React 는 안 함) · 단계 · 지금부터 TS 를 고려해 짜는 법 — 문서만 | `docs/TYPESCRIPT.md`(새) · `CLAUDE.md`(코드 컨벤션 한 줄 · 문서 목록 한 줄) | — |
| ~~ci 릴리스 시작 고침~~ 머지 #356 | 검증 세션 | release-start 가 검사를 직접 돌릴 때 typescript 를 안 깔아 빨강 2 — checks.yml 과 같은 설치 줄 | `.github/workflows/release-start.yml` | — |
| ~~#315~~ 머지 | 검증 세션 | 클릭 통과 판단을 한 곳으로(main #261 의 onUI 조건 포함) | `launcher/click-through-policy.js`(새) · `launcher/desktop-run.js` · `main.js` · 클릭 검사들 | #315 |
| ~~w4 묶음~~ 머지 #326 | 검증-도우미1 | 구역 떼기 C · w4 다섯 줄(코드로 추가하기 · 책상 프리셋 · 책상 세팅 · 박힌 값 상수 · 좌석 우클릭 메뉴) | `creator/asset-import.js` · `desk-preset-store.js` · `desk-preset.js` · `desk-setup.js` · `asset-cards.js` · `room/seat-menu.js`(새) · `app.js` · html · smoke | — |
| ~~wQ 묶음~~ 머지 #320 | 검증-도우미2 | 내 코드가 없으면 친구 · 부팅 · 마이홈 · 일정 · 방명록 · 방 만들기 요청을 안 보낸다 | `myhome/friends-sub.js` · `myhome/myhome-init.js` · 일정 · 방명록 · 방 만들기 창 | — |
| ~~wW 묶음~~ 머지 #324 | 검증-도우미2 | 디자인 프리셋 판단 한 곳 → 프리셋에 그림도 담기 (B-1013-8) | `myhome/myhome-preset.js`(새) · `myhome/myhome-edit.js` | — |
| ~~wY~~ 머지 #328 | 검증-도우미4 | 파츠 바뀐 뒤 좌석 다시 맞추기 한 벌(seat-refit.js) + 399ae08 떠 있던 동물 고침 · 동작 변경 사용자 승인 | `room/seat-refit.js`(새) · `app.js` · `character/wardrobe.js` · `room/room-entry.js` · `character/catalog-sync.js` · `admin/admin-part-register.js` · html | #328 |
| ~~낱개~~ 머지 #321 · #323 · #325 · #327 | 검증-도우미3 | 문서 규칙(429c52b) · 두 번째 실행 10초(wT) · 토스트 문구(wS) · realtime 공통부(wP-C 6d352f0) · 에러코드(4c55c3c — 충돌 크면 다시 얹기) | `CLAUDE.md` · `main.js`(두 번째 실행) · 토스트 · `room/realtime-link.js`(새) · 에러코드 표 | — |
| B-1016-4 창 겹침 근본 | 도우미 1 | 창 앞뒤를 :root «창 층 표» 한 곳으로(동작 무변경) → 편집 · 종족도 창 쌓기 · 연 창이 맨 앞 · 대화상자는 창 쌓기 위 · #258 의 «편집 중 마이홈 숨김» 땜질 걷기 | `desk-companion-prototype.html`(z-index 37곳 · 창 층 표) · `shared/win-stack.js` · `sim-z-layers.js`(새) · `sim-win-front` · `sim-win-layers` · `sim-purikura-stage` · `sim-signup` · `sim-fix-1016` | — |
| ~~설치본 F12 막기~~ 머지 #358 | w2 세션 | 설치본에서 개발자 도구 F12 · 메뉴 단축키를 막고, 관리자 모드에 들어간 창에서만 연다(옛 hotfix/block-devtools 를 main 위로) · 개발 실행(npm start)은 그대로 | `main.js`(before-input-event F12) · `preload.js`(관리자 모드 알림 한 줄) · `admin/admin-mode.js`(들어갈 때 알림) · `sim-devtools`(새) | — |
| ~~비밀번호 초기화(관리자)~~ 머지 #359(함수 · Hosting 배포 필요) | w2 세션 | 비번을 잊은 사용자(🐞 제보로 연락) — 웹 관리자 사용자 상세에서 임시 비밀번호 발급 · 함수 adminResetPassword(관리자만 · 다른 PC 로그인 끊기 · adminLog) · 사용자는 로그인 뒤 [내 정보 › 계정] 에서 바꿈 | `functions/password-reset.js`(새) · `functions/index.js`(export 한 줄) · `web-admin/src/features/user/reset-password/`(새) · `UserDetail.tsx` 붙이는 한 줄은 #153(검증-도우미13) 머지 뒤 | — |
| 날기 천장 재발 막기 검사 | w2 세션 | 파츠가 바뀌어도 날기 기준점이 몸 가운데인지 — 리깅(스킨드) 파츠 · 몸을 가리는 원피스(유령옷) · 겹쳐 입기(stack) 흉내 추가(동작 변경 없음 · 검사만) | `checks/sim-fix-1016.js`(§12) | — |
| 데이터 창구 표(전략 패턴) | w2 세션 | firebaseAPI 함수마다 Firebase 판 · 서버 판을 고르는 표(동작 그대로 · 0.12 관리자 온/오프가 바꿀 자리) — 브랜치 `refactor/data-provider-table` 28d9799 · CHECKS 개정 359(임시) · QUEUE | `firebase-init.js`(묶음 이름 · 맨 아래 내놓기) · `shared/data-provider.js`(새) · `sim-data-provider`(새) · `sim-api-public-reads` · `sim-app-version-gate` · `sim-typeof-guards` | — |
| ~~CI 건너뛰기~~ 머지 #344 | w2 세션 | 바뀐 폴더를 먼저 보고 앱 검사 · 웹 관리자 검사를 필요할 때만(문서만 바뀐 PR 은 검사 없음) · 같은 PR 의 앞 실행 취소 · release-start 는 «npm run check» job 이 실제로 초록일 때만 건너뜀 | `.github/workflows/checks.yml` · `.github/workflows/release-start.yml` | #344 |
| ~~도메인 together-working.com~~ 머지 #343 | w2 세션 | 앱 · 웹 관리자 서버 주소를 together-working.com 으로(운영 API · 방 서버 · CSP) · duckdns 는 옛 앱 · dev 용으로 계속 허용 · 운영 설정 servers 는 그대로(새 앱만 별칭으로 새 주소) — 브랜치 `feat/together-working-domain` 84eb017 · CHECKS 개정 322(임시) · QUEUE | `room/room-server-gate.js` · `shared/api-client.js` · `desk-companion-prototype.html`(CSP meta 두 줄 · 맨 위 — 창 층 표와 다른 자리) · `firebase.json` · `web-admin/src/shared/api/api.ts` · `web-admin/src/entities/room-server/model/roomServer.ts` · `sim-room-server-gate` · `sim-api-client` · `sim-remote-config` · `sim-account-delete` | #343 |
| ~~카탈로그 본문 API 읽기~~ 머지 #293 | w2 세션 | 카탈로그 본문을 API(/v1/catalog — 운영 v0.2.1)에서 먼저 · 실패면 Firebase | `firebase-init.js` · `shared/catalog-cache.js` · `sim-catalog-cache` | #293 |
| ~~회원 탈퇴 안내 자리~~ 머지 #322 | 계정 세션 | [내 정보 › 계정] 탈퇴를 누르면 «로그인 수단 ~ 이 컴퓨터에서 로그아웃» 자리가 탈퇴 안내로 바뀜(머지는 검증 세션) · ⚠️ html css 는 `#creatorOverlay.on` 줄 바로 뒤에 붙어 B-1016-4 와 같은 자리 — 그쪽이 «편집 중 마이홈 숨김» 줄을 걷을 때 우리 세 줄은 남겨 주세요 | `desk-companion-prototype.html`(#acctDeleteZone · css 세 줄) · `account/my-info.js` · `sim-account-delete.js` | #319 |
| ~~게임패드 뒤에서도 읽기 (10-16 제보 7)~~ 머지 #333 | 계정 세션 | 게임이 앞이면 크로미움 Gamepad API 가 값을 안 줘서 Xbox 패드가 활동으로 안 잡힘 → Windows 는 main 이 XInput 을 직접 읽어(koffi) 렌더러에 «패드 활동» 을 보낸다 · mac 은 지금 그대로 | `sysinput-win.js` · `sysinput-mac.js`(같은 이름 빈 함수) · `main.js`(500ms 활성 창 폴링 끝에 한 줄 · IPC) · `preload.js` · `launcher/desktop-run.js` · `focus/gamepad-activity.js` · `package.json` · `package-lock.json` · `checks/sim-gamepad-activity.js` | #333 |
| 이름표 · 경험치 바 끌어 자리 바꾸기 | 계정 세션(머지는 검증 세션) | 책상을 끌 때처럼 이름표 · 경험치 바를 눌러 끌어도 좌석 순서가 바뀐다(같은 `drag` 상태 · 같은 자리 계산 · 누르기만 하면 아무 일 없음) | `room/seat-label-drag.js`(새) · `room/overhead.js`(이름표 pointerdown) · `focus/exp-bar.js` · `app.js`(끌기 시작 함수 · pointerup 한 줄 · 모듈 연결) · `desk-companion-prototype.html`(.seat-exp · .seat-nameplate css 한 줄씩 · script 태그 — 창 층 표와 다른 자리) · `launcher/desktop-run.js`(UI_HIT_SEL 에 .seat-exp) · `checks/sim-seat-label-drag.js`(새) | #334 |
| ~~#265 다시 얹기~~ 머지 | 검증 세션 | 런처 화면 GPU 부하 줄이기 — 미리보기 1초 30번 · 깜빡임은 좌석과 같은 시간표 · 후원 반짝임(사용자 적용 승인 10-17) | `launcher/launcher-preview.js` · `shared/blink-timing.js`(새) · 좌석 깜빡임 · `shared/README.md` · 후원 문구 css | #318 |
| ~~#320 되돌림 고치기~~ 머지 #329 | 검증 세션 | 새 프로필(내 코드 없음) 친구 탭이 «불러오는 중» 에 멈춤 → «아직 친구가 없어요» — 마이홈 시작이 일찍 끝날 때 친구 목록도 «코드 없음» 으로 시작 | `myhome/myhome-init.js` · `checks/sim-myhome-init.js` | — |
| ~~대기열 다섯 줄~~ 끝 | 검증-도우미5 | 머지: #330 친구 목록 실패 토스트 줄바꿈 · #331 네트워크 준비 기다리기 묶기 · #332 평준화 가두기 · 책상 자리. 안 올림: 토스트 누르면 복사(wAE — 보이는 동작 변경 · 승인 대기 CONFIRM) · 몸 크기 재기(wL2 — grk #258 «날기 천장» 과 겹침 · 다시 얹기) | — | #330 · #331 · #332 |
| ~~#334 이름표 끌기 — 공통 판단 묶기 · 도메인 잇기~~ 머지 | 검증-도우미6 | grk #334 위에서 끌기 시작 판단을 캔버스와 한 함수로 · 경험치 바가 방 모듈을 직접 안 부르게(app.js deps) · 합치기 | `room/seat-label-drag.js` · `focus/exp-bar.js` · `room/overhead.js` · `app.js`(캔버스 pointerdown) · 관련 검사 | #339 |
| ~~도메인 직접 호출 검사~~ 머지 #338 | 검증-도우미7 | «도메인끼리 서로의 모듈을 직접 부르지 않는다» 를 검사로 — 지금 수를 기준선으로 두고 늘면 빨강 | `checks/sim-domain-calls.js`(새) · `checks/domain-calls-baseline.json`(새) · `checks/CHECKS.md` | — |
| ~~자동 검사 빠르게~~ 머지 #337 | 검증 세션 | 문서만 바뀌면 앱 검사 건너뛰기 · 웹 관리자가 안 바뀌면 웹 관리자 테스트 건너뛰기 · actions @v5 | `.github/workflows/checks.yml` | — |
| ~~wL3 몸 크기 재기 한 곳~~ 머지 #340 | 검증-도우미8 | body-measure.js 로 묶기 · #258 날기 경로도 거침(동작 무변경) | `character/body-measure.js`(새) · 몸 재기 쓰는 곳 | — |
| ~~B-1016-4 창 겹침~~ 머지 #342 | 검증-도우미8(검증 · 합치기) · 작업 도우미1 | 창 층 표 → 편집 · 종족도 창 쌓기 · grk 탈퇴 안내 css 세 줄 지킴 | `desk-companion-prototype.html` · `shared/win-stack.js` | — |
| ~~서버 주소 together-working.com~~ 머지 #343(웹 관리자 Hosting 배포 필요) | 검증-도우미8 · 작업 w2 | 운영 API · 방 서버 · CSP 새 주소(옛 주소 계속 허용) | html CSP · 주소 상수 | — |
| ~~자동 검사 판정 한 벌~~ 머지 #344 | 검증-도우미8 · 작업 w2 | #337 위에 같은 요청 앞 실행 취소 등 빠진 것만 | `.github/workflows/checks.yml` | — |
| 화질 고르기(프로그램 설정 › 모니터) | 계정 세션(머지는 검증 세션) | 실행 화면 화질을 «선명하게(기본 · 지금 그대로) · 자동(버벅이면 배율 1배로) · 가볍게(배율 1배 + 테두리 다듬기 끔 — 다시 켜면 적용)» 중에서 고른다 · 이 PC 에 저장 | `shared/frame-budget.js` · `room/seat-camera.js` · `launcher/program-settings.js` · `app.js`(렌더러 만드는 줄 · frame 한두 줄 · 만드는 줄 deps) · `desk-companion-prototype.html`(모니터 탭 칸) · 검사 | #364 |
| 이름표 · 경험치 바 레이아웃 강제 계산 줄이기 | 계정 세션(머지는 검증 세션) | 매 프레임 좌석마다 «위치 적기 → 바로 재기» 로 브라우저가 화면 배치를 다시 계산하던 것(사람 많은 방에서 버벅임 후보) → 캔버스 사각형 · 라벨 높이를 기억해 두고 재기를 줄인다(보이는 자리는 그대로) | `room/overhead.js` · `focus/exp-bar.js` · `status/status-chip.js` · `app.js`(frame 안 한두 줄) · 새 검사 | #363 |
| 생성기 프리셋에 책상 파일 통째로 넣지 않기(10-16 제보 8) | 계정 세션 | 프리셋이 카탈로그 책상 GLB 를 base64 로 통째로 담아 이 PC 저장소가 넘침(1MB 책상이면 4번째 칸부터 저장 실패 · 0.11.3 은 실패해도 «저장했어요») → 카탈로그에 있는 책상은 id 만 담고 불러올 때 카탈로그에서 받는다 · 저장할 때 옛 칸도 같은 규칙으로 가볍게 · 책상을 못 찾으면 기본 책상 + 번호 알림 | `creator/desk-preset.js` · `creator/desk-preset-store.js` · `app.js`(만드는 줄 deps) · `shared/error-codes.js`(번호 하나) · `docs/ERROR_CODES.md` · 검사 | — |
| 말랑이 잠깐 숨기기 버튼 | 계정 세션(머지는 검증 세션) | 마이홈 제목줄 «👁 방문자 시점» 옆에 «말랑이 숨기기» — 누르면 떠다니는 말랑이를 잠깐 가린다(다시 누르면 보임 · 집을 옮기거나 마이홈을 닫으면 다시 보임 · 서버 · 저장 없음) | `myhome/mallang.js` · `myhome/myhome-ui.js`(제목줄 끌기 제외 한 줄) · `desk-companion-prototype.html`(제목줄 span 하나) · `checks/sim-mallang-hide.js`(새) | #362 |
| 우편함 개편(우편 · 소식 · 도움말) | 우편함 세션 | 마이홈 우편함 탭 안에 왼쪽 세로 메뉴 📩 우편(카드) · 📢 소식(공지 · 업데이트 — 목록 위 종류 고르기 · 📌 고정은 늘 위 · 오른쪽 본문) · 📘 도움말(준비 중) — 탭 수 그대로 · 서버 · 규칙 · 데이터 그대로 · 디자인 스튜디오 기존 항목(fHead · fTabsBg · fChat)을 새 칸에 이음 · ⚠️ #362 와 `myhome-ui.js`(내 몫은 우편함 연결) · #361 과 `myhome-edit.js`(내 몫은 applyMyHomeTheme) · B-1016-4 와 html(내 몫은 우편함 마크업 · css, z-index 안 건드림) | `myhome/myhome-inbox.js` · `myhome/inbox-sections.js`(새) · `myhome/myhome-ui.js` · `myhome/myhome-edit.js` · `myhome/scheduler.js`(🔔 수령함 확인) · `desk-companion-prototype.html` · `shared/error-codes.js` · `checks/smoke.js` · `sim-myhome-inbox` · `sim-myhome-edit` · `sim-friend-manage` · `sim-inbox-sections`(새) | #365 |
| 마이홈 스티커 잠금 · 순서 바꾸기 | 계정 세션(머지는 검증 세션) | 스티커 관리 창에 🔒 잠금(잠기면 끌기 · 편집 모드 · ◎ 로 안 움직임) · ▲▼ 순서(위로 그릴수록 앞) — 스티커에 `locked` · `z` 칸(규칙 · 서버 모양 그대로, 옛 앱은 무시) · ⚠️ #350 과 `myhome-edit.js` 가 겹침(내 몫은 스티커 끌기 한 줄 · 새 스티커 z 한 줄) | `myhome/myhome-sticker-rules.js`(새) · `myhome/myhome-sticker.js` · `myhome/myhome-edit.js` · `app.js`(renderMyHomeStickers 순서 · 잠금 표시) · html(관리 창 버튼 css · script 태그) · `myhome/README.md` · `checks/smoke.js` · `sim-myhome-sticker` · `sim-myhome-sticker-rules`(새) | #361 |
| #163 다시 얹기 | 검증 세션 | 내 정보 맨 아래 개인정보 처리방침 링크(시스템 기본 브라우저로) | `app/desk-companion-prototype.html`(내 정보 계정 칸 아래) · `room/room-entry.js`(링크 거는 줄) | — |
| ~~토스트 누르면 복사(wAE)~~ 머지 #345 | 검증-도우미8 | 켜진 토스트를 누르면 글 복사 · «(복사했어요)» — 사용자 승인 | `shared/toast.js` · html | #345 |
| ~~편집 중 마이홈 숨기기 되살리기~~ 머지 #346 | 검증-도우미9 | #342 위에 #258 의 숨기기만 다시(창 층 표는 그대로) · B-1016-4 · 사용자 결정 10-17 | `app/desk-companion-prototype.html`(편집 중 숨김 css) · 숨김 검사 | #346 |
| ~~해결된 버그 제보 한 달 뒤 삭제~~ 머지 #347 | 검증-도우미11 | 해결 시각(doneTs) · 자동 정리 함수 · 탈퇴 때 제보 삭제 · 처리방침(제보 · AWS 서울 · 게임패드 · 시행일) | `functions/`(새 함수 · account-delete.js) · `web-admin/src/entities/bug-board` · `features` · `hosting/privacy.html` · `firebase-database-rules.json` · `checks/` | #347 |
| ~~기능별 받는 곳 고르기 통일~~ 머지 #349 | 검증-도우미12 | 친구 · 방 · 카탈로그의 받는 곳을 source-switch.js 한 곳에서 · 웹 관리자 «🎚️ 기능 스위치» — **0.11.4 에 들어감**(스위치만 · 새 칸이 비면 예전과 같음 · 사용자 결정 10-17). 스위치를 쓰려면 운영 규칙 · 웹 관리자 배포 | `shared/source-switch.js`(새) · `shared/remote-config.js` · `friends/friends-port.js` · `room/room-server-gate.js` · `character/catalog-source.js` · `app.js`(연결) · html · 규칙 · `web-admin/src`(새 페이지 · 방 서버 스위치) · checks | — |
| ~~오래된 요청 #255 · #153 합치기~~ 머지 | 검증-도우미13 | #255 앱 크기 기준선 쓰기 · #153 웹 관리자 사용자 목록을 관리자 API 로 | `checks/sim-app-size.js` · `checks/app-size-baseline.json` · `web-admin/src/`(사용자 목록 · 통계) · `checks/CHECKS.md` | #255 · #153 |
| 같은 그림 반복 업로드 줄이기(#39 새로 쓰기) — **요청까지 · 0.11.4 뒤 합침** | 검증-도우미14 | 동시 업로드 합치기 · 썸네일은 외모가 바뀔 때만 · 업로드 캐시 LRU(통째 비우기 없앰) · 마이홈 주소 되쓰기 | `shared/upload-cache.js`(새) · `room/room-sync.js` · `character/slot-sync.js` · `firebase-init.js`(업로드 길) · 마이홈 · 검사 | #350 |
| 테스트 빌드도 운영 DB 로 | 검증 세션 | 깃허브에서 만드는 테스트(beta) 빌드도 운영 Firebase 에 붙게 — 개발 서버는 내 PC 의 `npm run start:dev` 에서만 | `.github/workflows/release.yml` · `release-start.yml` · `CLAUDE.md` · `docs/RELEASE.md` | — |
| ~~빈 카탈로그 사본 막기~~ 취소 | 검증-도우미15 | 취소 — 앱 · 서버 보험 코드 없이 이관 순서로 막음(서버를 다 채운 뒤 앱을 붙인다 · 사용자 결정 10-17). 앱에 «빈 카탈로그를 의심하는 보험» 은 넣지 않는다 | — | — |
| 규칙 크기 · 키 제한(요금 공격 방어) + 0.10.2 이하 앱 쓰기 · 읽기 막기 — ✅ #366 머지(개정 373~375) · 규칙 배포(dev → 운영)는 사용자 · 규칙 크기 세션의 로컬 브랜치 security/rules-size-limits 는 이제 안 씀 | 규칙 크기 세션 → 검증 담당 | 누구나 쓰는 노드에 모르는 키 차단 · 글자 수 상한, `/rooms` 모음 읽기 관리자만, 친추코드 덮어쓰기 · 초대 코드 발급자 바꿔치기 막기 — 0.11.0 이상 앱이 그대로 통과(에뮬레이터 확인). 할 일 tmvd9tah97fmfqm | `firebase-database-rules.json` · `scripts/rules-emu-check.js` · 규칙 검사(`sim-room-meta-cleanup` · `sim-google-login` · `sim-admin-rules` · `sim-rules-keys` · `sim-purikura-rules`) · `checks/CHECKS.md` | — |
| 서버 가지 정리 — 요청 올림(합치기 대기) | 서버 정리 세션 | t-w-server 남은 가지를 dev 위로 다시 얹어 요청으로. 권하는 차례 #51 → #57 → #58 → #52 → #54 → #53 · #55 는 아무 때나. 앱 쪽: 봇 계정 규칙(bugBoard/list · friendRequests 읽기 · 친구 거울 쓰기) · 새 config 칸 .validate | t-w-server 가지들 | t-w-server #51 · #52 · #53 · #54 · #55 · #57 · #58 |
| ~~생성기 프리셋 고침 다시 얹기(B-1015-3)~~ 머지 #353 | 검증-도우미16 | 0.11.4 에 넣음(사용자 결정 10-17) — 프리셋 읽기 · 쓰기 한 곳 · 저장 · 읽기 실패 알림 · 망가진 프리셋 위에 덮어쓰지 않기 | `creator/desk-preset-store.js` · `desk-preset.js` · `character/animal.js`(동물 프리셋) · `shared/error-codes.js` · checks | #353 |
| ~~관리자 제보 목록 API 열어 두기~~ 머지 #351 · 서버 #51(dev) | 검증-도우미17 | 서버 #51(dev) + 앱 wX 세 줄(viaApiOr 한 벌 · bugBoard/list 봇 읽기 규칙 · 제보 목록 쪽 번호) — 관리자 전용 · 서버 없으면 RTDB 폴백 · 기능 멈춤 예외(사용자 10-17) | `web-admin/src/shared/api` · `web-admin` 제보 목록 · `firebase-database-rules.json` · checks | — |
| ~~앱 범용 통로(서버만 배포로 기능 옮기기)~~ 머지 #355 | 검증-도우미18 | firebase-init.js 의 Firebase 기본 동작 앞에 통로 하나 — 원격 설정 dataRoutes 표에 걸린 경로만 서버 POST /v1/data 로, 표가 비면 지금과 똑같이 Firebase · 요청까지만(0.11.4 에 넣을지 사용자 확인) | `app/parts/firebase-init.js` · `app/parts/shared/data-gateway.js`(새) · `shared/remote-config.js` · 규칙 · checks | #355 |

## 대기 — 앞 줄이 머지돼야 올림
| 줄 | 내용 | 기다리는 것 |
|---|---|---|
| wJ 037867e | 같은 자리 여러 번 클릭 → 투게더워킹 활성화 (CONFIRM 38 승인) | #315 머지 · main #261(같은 증상 · 다른 방법) 과 겹치는지 다시 판단 |
| wAD 33d3d60 · f92b0f9 · d4afa40 | 클릭 통과 더 묶기 · 회복 사다리는 캐릭터 · 창 근처 클릭만 (B-1016-7) | wJ 037867e |
| wAE f51962b | 토스트를 누르면 글 복사(오류 번호 붙여 넣기용) | wS |
| wY 399ae08 | 파츠를 떼면 발밑 · 올라탄 사람 높이 다시 맞춤 | wY d4acee2 |
| wAB 3bbdc06 | 네트워크 준비 기다리기 15곳 묶기(net-ready.js) | 순서 |
| wAC 85b8eee · 6e07031 | 평준화 가두기 · 책상 자리를 모듈로 | 순서 |
| wL2 3b15806 · be25e90 · 2b15bbb | 몸 크기 재기 한 곳 → 리깅 모자 날기 위쪽 벽 | 순서 |

## 보류 — 서버 배포가 먼저(서버 브랜치가 아직 main · 배포 전)
| 줄 | 필요한 서버 브랜치(t-w-server) |
|---|---|
| wR 721ae87 친구 목록 스위치 빼기 | `feat/api-me-friends` |
| wP-C 943cc36 · b81d6e2 · ca05542 · bd69537 · 735a70a · e67dbea(규칙) | `feat/realtime-presence` · `feat/api-friends-write` |
| ~~wX a7e6b43 · 7cb3745(규칙) · cbdec78 웹 관리자 제보 목록 API~~ 진행 중으로 옮김 | `feat/api-admin-bugs` |
| (머지됨) #289 · #290 운영 설정 · #293 카탈로그 API | `feat/ops-hot-config` · 카탈로그 GET(앱 릴리스 전 배포) |

## 보류 — 결정 · 다시 얹기 대기
| 줄 | 까닭 |
|---|---|
| #51 안 묶인 uid 쓰기 37곳 잠금(보안) | 비밀번호 초기화(w2 세션)와 같은 계정 · 로그인 자리 — 그 작업이 합쳐진 뒤 그 위에 새로 만든다(검증 세션). 그때까지 구멍은 열려 있음 |
| ~~wAA~~ 진행 중으로 옮김 2c2d0e9 · 36fcf04 · 0353063 (B-1015-3) | w4 `desk-preset-store.js` 와 같은 묶기 — w4 머지 뒤 그 위로 다시 얹기(총괄) |
| wP-C 797d022 | 토스트 줄바꿈이 먼저 들어가야 |
| 머지된 브랜치 정리 — `claude/great-gates-o9jj5g`(#252) · `fix/bugs-1016-easy`(#258) · `fix/bugs-1016-medium`(#261) · `feat/account-delete-swap`(#319 닫힘 — #322 로 대신 머지) · `feat/account-delete-swap-v2`(#322) | 셋 다 머지 끝 · 아직 안 지움. 다른 담당이 이 브랜치 위에 쌓은 일이 없는지 보고 지워도 되면 지운다(검증 세션 · 총괄 확인) |

## 제보 → 수정
| 제보 | 증상 | 수정 PR | 상태 |
|---|---|---|---|
| v0.11.3 제보 | «친구 없음» 인데 추가하면 «이미 친구» | #306 · #307 | 머지 |
| 10-16 제보 1 · 2 · 6 · 10 · 11 · 12 | 알림콩 · 가챠 창 닫힘 · 상태 이모지 · 편집창 겹침 · 날기 천장 | #258 | 머지 |
| 10-16 제보 9 · 13 | 보관함 이동 복제 · 다른 앱 더블클릭 때 앞으로 옴 | #261 | 머지 |
| 10-16 제보 4b | 올라탄 동물을 다른 동물로 바꾸면 이전 위치에 떠 있음 | — (main 40e84b5 에서 재현 안 됨 — 바꾸면 내려와 자기 자리 바닥으로 · 탑 가운데 · 꼭대기 · 아래 사람 바꾸기도 정상 · 4a 는 #328) | 제보자에게 최신 버전으로 다시 확인 요청 · «바꿔도 계속 타고 있기» 를 바란 거면 새 기능(계정 세션) |
| 10-16 제보 7 | Xbox 패드로만 게임하면 기록이 멈추고 잠듦(게임이 앞이면 패드 값을 못 받음) | #333 | 머지 |
| B-1016-4 | 마이홈 띄운 채 편집 열면 마이홈이 위에 겹침 | #342 | 머지 |
| B-1016-7 | 다른 앱 더블클릭을 먹음(회복 사다리) | #261(일부) · wAD | 대기 |
| B-1016-4 | 마이홈을 띄운 채 캐릭터 편집을 열면 마이홈이 위에 겹침 | #258(숨김 땜질) → B-1016-4 창 겹침 근본 | 진행 중 |
| B-1013-8 | 디자인 프리셋에 그림이 안 담김 | #324 | 머지 |
| B-1015-3 | 생성기 프리셋 저장 · 읽기 실패를 안 알림 | #353 | 머지 |
| 리깅 모자 날기 | 모자 쓰고 날면 화면 아래에서 맴돎 | wL2 | 대기 |

## 머지 완료(10-17 검증 세션)
- 10-18: #355 범용 데이터 통로(0.11.4 · 표가 비면 무변경 · 규칙 config/dataRoutes 운영 배포 필요)
- 10-17 밤: #353 생성기 프리셋 저장 · 읽기 실패 알림 · 망가진 프리셋 덮어쓰기 막기(B-1015-3 · 0.11.4)
- 10-17 밤: #351 웹 관리자 제보 목록 관리자 API(전체 쪽 수 · 쪽 번호 · 폴백) + viaApiOr 한 벌 + bugBoard/list 봇 읽기 규칙 · 서버 t-w-server #51 dev 합침 — 운영 배포: 규칙 → 서버 → 웹 관리자
- 10-17 밤: #255 앱 크기 기준선 쓰기(개정 360) · #153 웹 관리자 사용자 목록을 관리자 API 로(못 닿으면 옛 RTDB · 웹 관리자 Hosting 배포 필요)
- 10-17 밤 운영 배포 끝(사용자): 규칙(doneTs) · 함수 bugCleanup · adminDeleteAccount · deleteMyAccount · Hosting(웹 관리자 새 서버 주소 #343 · 처리방침 시행일 2026-10-18)
- 10-17 밤: #347 해결된 버그 제보 한 달 뒤 자동 삭제 · 탈퇴 때 제보 삭제 · 처리방침 보강 — **배포 필요(규칙 · 함수 3 · Hosting)**
- 10-17 밤(검증-도우미8): #340 몸 크기 재기 한 곳 · #342 창 겹침(B-1016-4 · grk 탈퇴 안내 css 지킴) · #343 서버 주소 together-working.com(웹 관리자 Hosting 배포 필요) · #344 자동 검사 판정 한 벌(릴리스 버튼 구멍 막음) · #345 토스트 누르면 복사
- 10-17 저녁: #339 이름표 · 경험치 바 끌어 좌석 바꾸기(grk #334 대신 — 날기 판단 한 줄을 캔버스와 같이 · 경험치 바는 deps 로 · 개정 350 · 351)
- 10-17 저녁: #338 도메인끼리 직접 부르는 곳이 늘면 빨강(sim-domain-calls.js · 기준선 34곳)
- 10-17 저녁: #335 자기 작업 직접 합치기 차례 · #336 공유 코드 규칙 · #337 바뀐 곳만 검사
- 10-17 저녁(계정 세션 · 사용자 요청으로 직접 머지): #333 게임패드 — 게임이 앞이어도 XInput 으로 읽기(개정 348)
- 10-17 저녁(검증-도우미5): #330 친구 목록 실패 토스트 줄바꿈 · #331 네트워크 준비 기다리기 net-ready.js 한 곳 · #332 평준화 가두기 seat-eq-clamp.js · 책상 자리 desk-place.js(28f731c 순환 없이)
- 10-17 저녁(검증-합치기): #320 내 코드 없으면 요청 안 보냄 · #324 디자인 프리셋 그림(B-1013-8) · #326 w4 다섯 줄 · #329 #320 되돌림 고침 · #321 두 번째 실행 10초 · #323 토스트 줄바꿈 · #325 realtime 공통부 · #327 에러코드 · #328 좌석 다시 맞추기(개정 325~343)
- 10-17 오후: #318 런처 GPU 부하 줄이기(#265 대신) · #322 회원 탈퇴 안내를 계정 탭 자리에(grk #319 대신 — 검사 기록 번호만 다시 매김)
- 10-17 오후: #315 클릭 통과 판단 한 곳 · #316 옛 주석 줄이기 규칙 · #317 이 현황판
#255 이후 검증 세션이 올려 머지한 것: #256 · #263 · #269 · #270 · #273 · #281 · #284 · #286 · #288 ~ #312(카탈로그 · 친구 사슬 · 펜 끌기 등). 줄별 기록은 대기열(`docs/local/carve-handoff/QUEUE.md`, 이 PC 에만 있음).
