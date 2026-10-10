# app.js 구역 지도 — 앱 FSD 1단계

렌더러 본체 `app/parts/app.js` 를 웹 관리자(`web-admin/`)처럼 **층(FSD)** 으로 나눠 옮기기 위한 지도다.
이번 단계는 **코드를 한 줄도 옮기지 않는다** — 지금 무엇이 어디 있는지 적고, 더 커지지 않게 막고(검사 `sim-app-size.js`),
어느 것부터 옮길지 순서를 정한다.

**진행** — 1번(📅 스케줄러 · 🔔 일정 알림 → `app/parts/scheduler.js`) · 2번(👑 달성표 → `app/parts/weekly-challenge.js`) ·
3번(📷 스티커사진 창 → `app/parts/purikura-ui.js`) · 4번(📖 방명록 → `app/parts/guestbook.js`) ·
5번(👥 친구 관리 → `app/parts/friend-manage.js` · 🐞 버그 제보 탭 → `app/parts/bug-board-ui.js` 끝) ·
6번(🍅 뽀모도로 → `app/parts/pomodoro.js`)을 옮겼다.
아래 줄 · 구역 번호는 옮긴 뒤 값이다(`node scripts/app-sections.js` 로 다시 뽑음 · 1번 때 옛 #31 부터 둘씩, 2번 때 옛 #111 부터 다시 둘씩,
3번 때 옛 #53 부터 일곱씩, 4번 때 옛 #37 부터 셋씩, 5번 때 옛 #30 부터 하나씩, 6번 때 옛 #99 부터 하나씩 당겨졌다). 목적 · 층 · 비고는 손으로 적은 것이라 그대로 두고, 씀 · 쓰임은 개수가 바뀐 줄만 새 값으로 갈았다
(관련 모듈은 스크립트 값 그대로).

## 요약

| | 값 |
|---|---|
| `app/parts/app.js` | **40,126줄** · 구역 머리 **100개** (상한 40,326줄 — `checks/app-size-baseline.json`) · 처음 46,147줄 · 116개 |
| `app/parts/firebase-init.js` | **4,444줄** · 구역 머리 31개 (상한 4,544줄) |
| 1,000줄 넘는 구역 | 11개 (#12 #26 #29 #32 #43 #44 #47 #60 #71 #84 #97) |
| 머리와 내용이 어긋난 «섞인» 구역 | 17개 · 19,453줄 (전체의 48%) — 머리 없이 덧붙인 코드가 앞 구역 안에 들어가 있다 |
| 다른 구역이 거의 안 쓰는 구역(쓰임 ≤ 3) | 19개 — 옮기기 쉬운 쪽 |

층별 크기 (구역 머리 기준 — 섞인 구역은 머리 쪽 층으로 셌다):

| 층 | 줄 | 비율 | 구역 |
|---|---:|---:|---:|
| features | 14,903 | 37.1% | 39 |
| widgets | 10,632 | 26.5% | 15 |
| entities | 10,564 | 26.3% | 27 |
| pages | 2,559 | 6.4% | 6 |
| app | 1,176 | 2.9% | 6 |
| shared | 282 | 0.7% | 5 |
| (머리만) | 10 | — | 2 |

shared 가 0.7% 로 작은 것은 공용 도구(`escHtml` · HTML sanitize · 효과음 공장 · 창 겹침)가 따로 구역 없이
다른 구역 안에 묻혀 있어서다(#12 · #19 · #29). 실제 몫은 더 크다.

## 층 — 이 앱(순수 JS · 전역 스코프 렌더러)에서의 뜻

웹 관리자와 같은 여섯 층, 같은 규칙(**위층만 아래층을 부른다**)을 쓴다. 다만 이 앱은 번들러 없이 `<script>` 를 차례로 싣고
전역 이름으로 서로 부르므로, 층을 지키는 수단은 import 가 아니라 **`createXxx(deps)` 로 넘기는 deps** 다 — 모듈이 받는 deps 에
위층 것이 있으면 층을 어긴 것이다.

| 층 | 이 앱에서 | 예 |
|---|---|---|
| **app** | 부팅 · 전역 배선. three.js 렌더러 · 씬 · 카메라를 만들고, 프레임 루프를 돌리고, 모듈을 `createXxx(deps)` 로 이어 붙인다. app.js 에 끝까지 남는 몫 | SETUP · ANIM · INIT · 데스크탑 모드 · 서버 모듈 감시견 |
| **pages** | 창(화면) 하나 통째 — 열기 · 닫기 · 자리 · 그 창만의 상태 | 런처 · 생성기 · 마이홈 창 · [내 정보] · 스티커사진 창 · 방명록 팝업 |
| **widgets** | 한 화면 안의 큰 덩이 — 여러 기능을 모아 보여 준다 | 상태칩 · 설정 패널 · 대화창 · 이름표 · 말풍선 · 경험치 바 · 가챠 보관함 · 달성표 화면 |
| **features** | 사용자 행동 하나(버튼 · 단축키 하나)와 그 흐름 | 때리기 · 깜짝쇼 · 룰렛 · 주사위 · 신고 · 닉네임 저장 · 로그인 · 초대 · 대화 복사 · 생성기 단계 |
| **entities** | 도메인 데이터와 규칙(+ 그 3D 표현). 화면 없이 검사할 수 있는 순수 함수가 많은 곳 | 좌석 · 캐릭터 def · 슬롯 · 파츠 카탈로그 · 레벨 · 포커스 · 가챠 보유분 · 방 연결 · 달성표 규칙 |
| **shared** | 도메인을 모르는 도구 | 셰이더 · 암호화 · HTML 이스케이프 · sanitize · 효과음 공장 · 테마 · 창 겹침 |

데이터 읽기 · 쓰기(`window.firebaseAPI`)는 지금처럼 `firebase-init.js` + ES 모듈(`room-*.js` · `bug-board.js` 등)이 맡는다 —
이 지도의 층은 렌더러 쪽 이야기다.

## 표 읽는 법 · 다시 뽑기

- **줄** 은 «이 머리부터 다음 머리 전까지». 그래서 큰 구역에는 머리 없이 덧붙인 다른 코드가 섞여 있다(비고 «섞임»).
- **씀** = 이 구역이 다른 구역에서 정의한 이름을 쓰는 구역 수(많이 쓰는 셋), **쓰임** = 이 구역의 이름을 쓰는 다른 구역 수.
  구역마다 맨 앞 칸에서 정의한 이름(`function` · `const` · `let` · `var` · `class`)을 모아 다른 구역 본문에 낱말로 나오는지 센
  **근사치**다 — 주석 · 문자열 안도 세고, `key` · `fill` 같은 흔한 이름은 부풀려진다. 순서를 정하는 참고용.
- **관련 모듈** = 이 구역이 부르는 `app/parts/*.js` (모듈의 함수 이름 · `window.X` 로 내놓은 이름 기준).
- 숫자는 `node scripts/app-sections.js` (표) · `--json` (구역마다 정의 · 참조 전부)로 다시 뽑는다.
  `--file app/parts/firebase-init.js --indent 4` 로 firebase-init 도 본다. **층 · 목적 · 비고는 손으로 적은 것**이라 옮길 때 같이 고친다.

## 더 커지지 않게 — `checks/sim-app-size.js`

- app.js · firebase-init.js 줄 수가 상한을 넘으면 빨강: «app.js 가 상한(N줄)을 넘었어요 — 새 로직은 app/parts/<도메인>.js 모듈로 (CLAUDE.md 구조 표)».
  상한 = 기준선을 쓸 때 줄 수 + 여유(app.js 200줄 · firebase-init.js 100줄 — 급한 고침용).
- 구역 머리(`/* ═══ 제목` · `/* ══ 제목` · `/* ==== 제목`, firebase-init 은 4칸 들여쓴 것까지)가 기준선 목록에 없는 것이면 빨강 — 새 기능을 이 파일에 쌓는 신호다.
- **톱니(ratchet)**: 코드를 모듈로 옮겨 줄 수가 여유 + 500줄(firebase-init 은 + 200줄) 넘게 줄면 빨강 — **같은 PR 에서** 상한을 내린다.
  ```bash
  node checks/sim-app-size.js --write-baseline     # 저장소 루트에서. 상한은 내려가기만 한다
  ```
  올려야만 할 때는 `--allow-increase`, 새 구역 머리가 꼭 필요하면(이름만 바꾼 경우 포함) `--allow-new-section` — 왜 이 파일이어야 하는지 PR 본문에 적는다.
- 기준선 파일 `checks/app-size-baseline.json` 은 검사 파일이 아니라 `CHECKS.md` §3 해시 대상이 아니다(`ui-tokens-baseline.json` 과 같은 방식). 바뀌면 PR diff 로 본다.

## 옮기는 순서 (제안)

한 줄 = 앞으로의 PR 하나. 고른 기준: 다른 구역이 덜 쓰고(쓰임 · 밖으로 나가는 이름이 적음) 줄 수가 큰 것부터.
**방법**은 지금 있는 모듈과 같다 — `app/parts/<이름>.js` 를 classic script(IIFE · `window.Xxx = api` · `module.exports`)로 만들고
`desk-companion-prototype.html` 에서 app.js **앞**에 싣는다. app.js 는 `Xxx.createXxx({ … })` 로 필요한 것만 deps 로 넘긴다
(`creator-flat-view.js` · `wd-ear.js` 가 본보기). 옮긴 모듈에는 `sim-<이름>.js` 를 붙여 node 로 실행해 본다.

⚠️ 옮길 때 같이 볼 것
- **app.js 글을 읽는 검사**가 많다(`fs.readFileSync('app.js')` 로 함수 몸통을 찾는 sim). 옮긴 함수를 찾는 검사는 새 파일을 읽게 고친다 — 아래 «먼저 볼 검사». 고치면 `CHECKS.md` §3 해시 · 개정 번호도 같은 커밋에.
- 맨 앞 칸에서 **부팅 때 바로 도는 줄**(구독 시작 · 이벤트 연결)은 실행 순서가 바뀐다. `createXxx` 는 app.js 의 원래 자리에서 부른다.
- 구역 밖에서 쓰는 이름(«밖에서 쓰는 이름»)은 `const xxx = Xxx.createXxx(…)` 의 반환값으로 내놓고 부르는 쪽을 `xxx.이름` 으로 바꾼다.
- 한 PR 에 한 구역 묶음. 옮긴 뒤 `npm run check` 의 `sim-app-size` 톱니가 빨개지면 상한을 내린다.

| 순서 | 무엇 | 구역 | 옮길 줄(약) | 새 파일 | 밖에서 쓰는 이름 / 받아야 할 이름 | 위험 | 먼저 볼 검사 |
|---|---|---|---:|---|---|---|---|
| 1 ✅ | 📅 스케줄러 · 🔔 일정 알림 | (옛 #29 #30) | 1,204 | `scheduler.js` (features) | **옮김** — 내놓는 이름 8개(`renderSchedCalendar` · `renderDdays` · `subscribeMonth` · `setDdays` · `setDdaysVisit` · `refreshBellBadge` · `renderBellList` · `isBellOpen`), 부르는 곳은 #29(친구 탭 D-day 구독 · 수령함 · 공지) · #30(마이홈 관람) / 받는 이름(deps) 12개. `BELL_SEEN_KEY` 는 #68 로그아웃 지움 목록이 같이 써서 app.js 에 둠 · 연결은 #28 끝(원래 자리) | 낮음 | `sim-scheduler`(신설) · `smoke`(scheduler.js 먼저 평가) — `sim-win-layers` · `sim-win-front` 는 그대로 초록 |
| 2 ✅ | 👑 달성표 (규칙 + 화면) | (옛 #109 #110) | 1,188 | `weekly-challenge.js` (entities 규칙 + widgets 화면 — 한 파일) | **옮김** — 내놓는 이름 6개(`syncChalToServer` · `open` · `isOpen` · `focusTick` · `setKeyPlatform` · `resetMemory`) + 검사용 `calc` · `tick` · `state`, 부르는 곳은 #62(런처 동기화) · #68(로그아웃 flush · 메모리 지우기) · #97(활성 앱 판정) · pomodoro.js(뽀모 서랍 — 6번) / 받는 이름(deps) 13개. `CHAL_KEY` 는 #68 로그아웃 지움 목록이 같이 써서 app.js 에 둠 · 다시 대입되던 `chalRec` · `_chalDirty` · `_chalKeyPlatform` 은 `resetMemory` · `setKeyPlatform` 으로 · 연결은 #97 끝(원래 자리) | 낮음 | `sim-weekly-challenge`(신설) · `smoke`(먼저 평가) · `sim-pomodoro` · `sim-mobile-focus` · `sim-account-switch` · `sim-keysof-twin`(weekly-challenge.js 를 읽게) — `sim-google-login` 은 그대로 초록 |
| 3 ✅ | 📷 스티커사진 창 | (옛 #46 ~ #52) | 2,623 | `purikura-ui.js` (pages · `purikura-net.js` 옆) | **옮김** — 내놓는 이름 4개(`open` · `close` · `isOpen` · `phase`) + 세션 콜백 넷(`onPeers` · `onMeta` · `onPeerEvent` · `onShot`) + 검사용 `state` · `deco`, 부르는 곳은 #12(때리기 'b' 조준 키) · #43(📷 버튼 — 대화창 버튼 연결) · #66(회사원 모드 켜기) · #41(세션 입구 `_purikura()` 의 콜백) / 받는 이름(deps) 31개 — 대부분 캐릭터 리그 · 애니메이션 도우미(#85 #13 #16). 다시 대입되는 `officeMode` · `_plPlaying` 과 뒤에 선언되는 const(`Presence` · 리그 상수 넷)는 읽는 함수로 · 세션 입구 `_purikura()` · `_pkSession` 은 #41(🎲 주사위)에 남김(주사위 · 📷 버튼도 씀) · 연결은 #41 끝(원래 자리) | 중간 | `sim-purikura-ui`(신설) · `smoke`(먼저 평가) · `sim-purikura-stage` · `-deco` · `-fish` · `sim-pk-fit` · `sim-fix-0923`(purikura-ui.js 를 읽게) |
| 4 ✅ | 📖 방명록 (새 글 배지 + 독립 팝업 창) | (옛 #34 ~ #36) | 475 | `guestbook.js` (pages) | **옮김** — 내놓는 이름은 예전처럼 window 고리 7개(`_mhGbStartWatch` · `_mhGbStopWatch` · `_mhGbRefreshBadge` · `_mhGbMarkAllRead` · `_mhReSubscribeGuestbook` · `openMyGuestbook` · `_mhGbRefreshWriteUI`) — 부르는 여덟 곳(#29 친구 목록 구독 · 마이홈 열기 · 닫기 · #30 관람 시작 · 끝 · #62 런처로)은 typeof 로 보고 부르므로 그대로(scheduler.js 의 `_closeBellWin` 과 같은 방식) · 반환값도 같은 함수 7개 / 받는 이름(deps) 8개. 다시 대입되는 `_mhViewingUserId` · `_myHomeFriends` 는 읽는 함수로 · `showChatBubble` 은 **남김**(말풍선 widgets — 7개 구역이 쓴다 · 지금은 #32 끝) · 연결은 #32 끝(원래 자리) | 낮음 | `sim-guestbook`(신설) · `smoke`(먼저 평가) · `sim-child-theme`(guestbook.js 를 읽게) — `sim-win-front` 는 그대로 초록 |
| 5 ✅ | 👥 친구 관리 칸 · 🐞 버그 제보 탭 링크 | (옛 #29) | 494 | `friend-manage.js` (widgets) · 버그 탭 62줄은 `bug-board-ui.js` 끝 | **옮김** — 내놓는 이름 11개(`showFriendRequestPopup` · `reqVisible` · `renderFriendManage` · `renderFriendRequests` · `refreshFriendReqBadge` · `lookupName` · `bulkAccept` · `bulkReject` · `setTab` · `tab` · `picked`) + 검사용 `acceptOne` · `seatsLeft`, 부르는 곳은 모두 #29(요청 구독 · 마이홈 열기 · 탭 전환 · 친구 코드 추가 · 서브탭 · 일괄 처리 바 — 열다섯 줄, `friendManage.이름`) / 받는 이름(deps) 10개. 다시 대입되는 `_myFriendRequests` · `_myHomeFriends` · `myHomeOpen` 은 읽는 함수로 · 다시 대입되던 `_fmTab` 은 `setTab` · `tab` 으로 · `FRIEND_MAX` 는 #28 에 남김(다섯 곳이 본다 · 값으로 넘김) · 🐞 버그 제보 탭은 `createXxx` 없이 bug-board-ui.js 끝 맨 앞 칸(게시판 화면과 같은 방식 · app.js 뒤지만 firebase-init(module) 앞이라 구독 때가 같다) · 연결은 #28 끝(원래 자리) | 낮음 | `sim-friend-manage-module`(신설) · `smoke`(먼저 평가) · `sim-friend-manage` · `sim-gift-star`(friend-manage.js 를 읽게) · `sim-scheduler`(자리 기준) — `sim-bug-board` 는 그대로 초록 |
| 6 ✅ | 🍅 뽀모도로 | (옛 #98 앞머리) | 176 | `pomodoro.js` (features) | **옮김** — 옛 #98 948줄 가운데 뽀모 몫인 앞머리 176줄(상태 · 구간 넘기기 · 서랍 그리기 · 버튼 연결)만. 밖에서 부르는 곳은 #88(📊 오늘 기록 전시의 `_focusShowConf`) 한 곳 — 만드는 줄보다 먼저(로드 중) 불려 반환값을 볼 수 없어서 예전처럼 window 고리 `_pomoShowText` + typeof 가드(guestbook.js 와 같은 방식) · 반환값은 같은 함수 + 검사용 `open` · `render` · `tick` · `cfg` · `run` / 받는 이름(deps) 4개(`toast` · `_focusShowPush` 는 화살표, `weeklyChal` · `_pomoSnd` 는 앞에 선언된 const 값). 알림음 풀 `_pomoSnd` 는 #12 효과음 공장에 남김(자동재생 잠금 해제 등록보다 앞이어야 한다) · 지도에 «42개» 로 적었던 입력 판정 · 프레임 상한 몫과 `myHomeOpen` · `applyDesktopRunClass` · 데스크탑 모드 772줄은 뽀모가 아니라 **남김** → 머리가 빠져 #97 에 붙음 · 연결은 👑 달성표 연결 바로 뒤(#97 · 원래 자리) | 낮음 | `sim-pomodoro-module`(신설) · `smoke`(먼저 평가) · `sim-pomodoro` · `sim-weekly-challenge`(pomodoro.js 를 읽게) |
| 7 | 🎨 마이홈 스티커 관리 창 | #32 | 1,454 | `myhome-sticker.js` (widgets) | 6개(#31 · #29) / 43개 — 대부분 마이홈 상태(#30 #31)라 deps 가 길다 | 중간 | `sim-myhome-load` |
| 8 | 🎰 가챠 코어 · 보관함 | #91 #92 | 1,255 | `gacha.js` (entities) + `gacha-inv.js` (widgets) | 27개 / 46개 — 꾸미기(#26 #44 #84)와 얽혀 있다 | 높음 | `sim-gacha-race` · `sim-gacha-prune` · `sim-part-color-entry` · `sim-slot-sync` 등 |

1 ~ 8 을 다 하면 약 9,400줄(app.js 의 20%)이 빠진다. 1번으로 46,147 → 44,966줄(1,181줄 — 옮긴 1,204줄 − 연결 23줄),
2번으로 44,966 → 43,799줄(1,167줄 — 옮긴 1,188줄 − 연결 21줄),
3번으로 43,799 → 41,217줄(2,582줄 — 옮긴 2,623줄 − 연결 41줄),
4번으로 41,217 → 40,761줄(456줄 — 옮긴 475줄 − 연결 19줄),
5번으로 40,761 → 40,288줄(473줄 — 옮긴 494줄 − 연결 21줄),
6번으로 40,288 → 40,126줄(162줄 — 옮긴 176줄 − 연결 14줄).

**0단계(선택 · 위와 따로 해도 된다)** — 섞인 구역에 묻힌 shared 도구(`escHtml` · HTML sanitize(#29) · 효과음 공장(#12) · 창 겹침(#19))를
app.js 앞에 싣는 작은 파일로 옮기면 전역 이름이 그대로라 부르는 곳을 안 고쳐도 되고, 뒤 단계의 deps 가 짧아진다.

**옮기기 전에 쪼갤 것** — #26(2,839줄) · #44(1,733줄) · #60(1,403줄) · #29(1,455줄) · #71(1,206줄) · #84(1,633줄)은 머리 하나에
여러 기능이 섞여 있다. 옮기기 전에 **코드는 그대로 두고 구역 머리만 새로 다는** PR 을 먼저 하면 이 지도가 정확해진다
(이때는 `--allow-new-section` 으로 기준선을 쓴다 — 머리만 늘고 줄 수는 그대로).

## 구역 표 — `app/parts/app.js`

| # | 줄 | 크기 | 목적 | 층 | 관련 모듈 | 씀 | 쓰임 | 비고 |
|---|---|---:|---|---|---|---|---|---|
| 1 | 1–267 | 267 | three.js 캔버스 · 렌더러 · 씬 · 카메라 · 조명 · WebGL 복구 연결 | app | gl-recover.js | 10 (#56 #11 #6) | 73 (#26 #60 #84) | 전역 `renderer` `scene` `camera` 와 조명 `key` `fill` 을 거의 모든 구역이 쓴다 |
| 2 | 268–271 | 4 | GLTF 로더 하나 | app |  | 0 | 3 (#4 #17 #82) |  |
| 3 | 272–328 | 57 | 사람 귀 부착 — human-ear.js 연결 | entities | animal.js ears-glb.js human-ear.js | 8 (#1 #60 #56) | 6 (#44 #61 #12) |  |
| 4 | 329–414 | 86 | 내장 기본 캐릭터 GLB 파싱 · 리깅 | entities | base-glb.js | 6 (#1 #2 #48) | 12 (#60 #48 #61) |  |
| 5 | 415–894 | 480 | 책상 · 소품 3D 빌더 · 기본 책상 덮어쓰기 | entities | desk-item-origin.js | 14 (#84 #1 #44) | 15 (#47 #60 #84) |  |
| 6 | 895–1358 | 464 | 좌석 배열 `seats` · 간격 · 위치/크기 저장 · 이동 한계 | entities | animal.js | 10 (#1 #5 #18) | 58 (#26 #14 #59) | 핵심 상태 — 60개 구역이 쓴다 |
| 7 | 1359–1767 | 409 | 좌석 크기 평준화 배율(k) | entities | animal.js | 17 (#12 #84 #6) | 15 (#12 #13 #85) |  |
| 8 | 1768–1826 | 59 | 🪑 플라잉체어 | features |  | 2 (#14 #44) | 5 (#11 #10 #42) |  |
| 9 | 1827–1930 | 104 | 워킹룸 캐릭터 숨기기 | features | frame-budget.js | 8 (#45 #64 #71) | 9 (#45 #11 #85) |  |
| 10 | 1931–2003 | 73 | 방 이벤트(poke) 신선도 판정 | entities |  | 5 (#8 #12 #11) | 8 (#64 #11 #9) |  |
| 11 | 2004–2308 | 305 | 💃 깜짝쇼 | features | animal.js | 17 (#8 #1 #12) | 14 (#43 #12 #13) |  |
| 12 | 2309–3532 | 1,224 | 🪄 때리기 | features | animal.js key-input.js | 24 (#7 #44 #11) | 22 (#45 #29 #7) | 섞임: 효과음 공장(`_mkSndPool` · 채팅 · 뽀모도로 알림음) · 올라타기(탑) |
| 13 | 3533–3739 | 207 | 상호작용 책상 카탈로그 · 레벨 해금 | entities |  | 10 (#7 #11 #12) | 9 (#85 #14 #26) |  |
| 14 | 3740–4196 | 457 | 멀티좌석 벤치에 앉히기 | features | frame-budget.js | 11 (#6 #1 #13) | 22 (#65 #26 #45) | 섞임: `layoutSeats`(좌석 배치 — 핵심)가 여기 있다 |
| 15 | 4197–4262 | 66 | PS1 색 양자화 · 디더링 셰이더 | shared |  | 1 (#1) | 1 (#14) |  |
| 16 | 4263–4748 | 486 | 캐릭터 머리 · 몸 크기 재기 | entities | animal.js | 13 (#47 #4 #60) | 17 (#47 #26 #60) |  |
| 17 | 4749–4869 | 121 | 모델 불러오기 · 애니메이션 클립 고르기(`setupSeatModel`) | entities | animal.js | 8 (#16 #4 #85) | 5 (#18 #26 #47) |  |
| 18 | 4870–4912 | 43 | 좌석 탭 · 상태 라벨 DOM 고리 | widgets |  | 8 (#6 #44 #17) | 22 (#62 #85 #6) |  |
| 19 | 4913–5460 | 548 | 상태칩 — 활동 상태 · 커스텀 상태 | widgets | folder-free.js | 14 (#1 #26 #59) | 21 (#26 #44 #64) | 섞임: 창 겹침(`escRegisterWindow` · `bringWinToFront`) — shared 로 |
| 20 | 5461–5513 | 53 | 기본 이모티콘 말풍선(워킹룸) | features |  | 5 (#40 #19 #64) | 0 |  |
| 21 | 5514–5536 | 23 | 상태칩 플레이리스트 | widgets |  | 1 (#1) | 4 (#22 #24 #25) |  |
| 22 | 5537–5976 | 440 | 플레이리스트 프리셋 데이터 | entities | scheduler.js | 8 (#1 #26 #30) | 9 (#24 #26 #71) |  |
| 23 | 5977–5983 | 7 | (머리만 · 7줄) | — |  | 0 | 0 |  |
| 24 | 5984–6638 | 655 | 레벨 티어 경계값 · 배지 클래스 | entities |  | 12 (#22 #25 #90) | 10 (#26 #95 #29) | 섞임: 플레이리스트 화면(`_plRender`) |
| 25 | 6639–6882 | 244 | 플레이리스트 프리셋 고르기 | widgets |  | 5 (#22 #24 #1) | 2 (#24 #26) |  |
| 26 | 6883–9721 | 2,839 | 🐕 BGM 재생 감시견 | widgets | animal.js key-input.js scheduler.js | 49 (#22 #19 #6) | 23 (#44 #92 #43) | 섞임(2,839줄): 렌더러 생존 신호 · 상태칩 위치 · ⚙ 설정 패널 · 포커스 기록 팝업 · 이동 모드 · 함수키 · 꾸미기 패널 · 미리보기 · 초안 — 옮기기 전에 쪼갤 것 |
| 27 | 9722–10525 | 804 | 🖍️ 파츠에 직접 그리기 | features | animal.js key-input.js paint-tools.js purikura-ui.js uv-fill.js | 13 (#43 #84 #26) | 18 (#26 #49 #50) |  |
| 28 | 10526–10613 | 88 | 🏠 마이홈 친구 탭 상수 · 상태 | pages | bug-board-ui.js friend-manage.js scheduler.js | 8 (#29 #30 #19) | 10 (#29 #32 #30) | 끝에 📅 스케줄러 · 🔔 일정 알림 연결(`MhScheduler.createScheduler` — scheduler.js · 원래 자리) · 👥 친구 관리 연결(`TwFriendManage.createFriendManage` — friend-manage.js · 옛 #29 자리). 🐞 버그 제보 탭(오픈카톡 기본 링크)은 bug-board-ui.js 끝으로 |
| 29 | 10614–12068 | 1,455 | 🖥️ 한 계정 한 기기 — 밀려난 기기 | widgets | bug-board-ui.js friend-manage.js guestbook.js mallang.js scheduler.js | 22 (#12 #28 #90) | 18 (#43 #28 #31) | 섞임(1,455줄): 우편함 배지 · `escHtml` · 채팅창 투명도 · 글자 크기 · 알림음 · HTML sanitize · 친구 목록 · Ctrl+F 검색 · 수령함 · 선물함 |
| 30 | 12069–12265 | 197 | 🏠 마이홈 데이터 불러오기 · 방문 | pages | guestbook.js mallang.js myhome-desktop.js scheduler.js | 4 (#28 #31 #97) | 11 (#31 #32 #29) |  |
| 31 | 12266–12653 | 388 | 🔬 마이홈 클릭 진단 | pages |  | 8 (#30 #32 #29) | 7 (#32 #29 #30) | 섞임: 마이홈 페이지 그리기 · 스티커 배치(`renderMyHomePage`) |
| 32 | 12654–14134 | 1,481 | 🎨 마이홈 스티커 관리 창 | widgets | guestbook.js scheduler.js | 15 (#31 #30 #28) | 10 (#31 #12 #20) | 섞임: 끝에 📖 방명록 연결(`TwGuestbook.createGuestbook` — guestbook.js · 원래 자리) · `showChatBubble`(머리 위 말풍선 — 7개 구역이 쓴다) |
| 33 | 14135–14345 | 211 | 🌊 채팅 날리기 | features |  | 12 (#44 #1 #11) | 8 (#43 #39 #71) |  |
| 34 | 14346–14366 | 21 | 💬 대화창 코어 | widgets |  | 1 (#29) | 10 (#35 #38 #39) |  |
| 35 | 14367–14678 | 312 | 🔖 읽음 구분선 | features |  | 11 (#38 #34 #39) | 10 (#38 #43 #26) |  |
| 36 | 14679–14718 | 40 | 🔇 시크릿룸 채팅 잠금 | features |  | 6 (#38 #64 #6) | 6 (#37 #38 #64) |  |
| 37 | 14719–14839 | 121 | 🗑 대화 기록 삭제(방장) | features |  | 8 (#36 #38 #35) | 7 (#43 #35 #65) |  |
| 38 | 14840–15130 | 291 | 💬 채팅 탭 | features | chat-tabs.js | 9 (#35 #39 #36) | 8 (#35 #37 #36) | chat-tabs.js 와 짝 |
| 39 | 15131–15425 | 295 | 📋 대화 드래그 · 복사 | features | chat-copy.js | 14 (#33 #40 #13) | 3 (#38 #43 #35) | chat-copy.js 와 짝 |
| 40 | 15426–15603 | 178 | 😊 커스텀 이모티콘 | features |  | 4 (#6 #34 #31) | 5 (#43 #39 #20) |  |
| 41 | 15604–15695 | 92 | 🎲 주사위 | features | animal.js purikura-net.js purikura-ui.js scheduler.js | 15 (#1 #85 #13) | 5 (#43 #12 #39) | 📷 세션 입구 `_purikura()` 와 끝에 📷 스티커사진 창 연결(`TwPurikuraUi.createPurikuraUi` — purikura-ui.js · 원래 자리) |
| 42 | 15696–15768 | 73 | 🎟️ 룰렛 · 주사위 하루 횟수 | features |  | 13 (#1 #43 #11) | 2 (#43 #26) |  |
| 43 | 15769–17012 | 1,244 | 🔫 러시안룰렛 | features | purikura-ui.js | 29 (#29 #84 #64) | 11 (#47 #27 #26) | 섞임: 텍스처 색조 셰이더 · 파츠 그림칸 · UV 구제(21197~) |
| 44 | 17013–18745 | 1,733 | 꾸미기 창 «책상» 탭 | widgets | animal.js ears-glb.js human-ear.js wd-ear.js | 39 (#84 #26 #47) | 32 (#26 #97 #85) | 섞임(1,733줄): 꾸미기 창 그리기 · 귀 탭 · 카탈로그 파츠 페이로드 · 상태 이모지 그림 · 이름표 · 말풍선 · 회사원 모드 라벨 |
| 45 | 18746–19177 | 432 | 캐릭터 끌기 · 흔들기 · 쓰다듬기 | features |  | 22 (#12 #9 #6) | 14 (#9 #11 #12) |  |
| 46 | 19178–19220 | 43 | 머리 위 이모지 반응(floaters) | widgets | animal.js | 5 (#1 #6 #14) | 8 (#45 #85 #7) |  |
| 47 | 19221–20598 | 1,378 | 파츠 부착 — 본 · 오프셋 보정 · 유령 정리 | entities | animal.js | 17 (#84 #43 #5) | 14 (#44 #26 #60) |  |
| 48 | 20599–21022 | 424 | 생성기 · 런처 공통 상태(`charDef` · `slots` · `curSlot`) | pages | animal-edit-route.js animal.js myhome-desktop.js skin-data.js | 17 (#84 #60 #4) | 41 (#60 #50 #79) | 핵심 상태 — 41개 구역이 쓴다 |
| 49 | 21023–21152 | 130 | 생성기 x축 대칭 | features |  | 6 (#48 #27 #45) | 3 (#50 #27 #60) |  |
| 50 | 21153–21886 | 734 | 생성기 이미지 도장 | features | animal.js key-input.js paint-tools.js skin-data.js uv-fill.js | 9 (#48 #60 #49) | 7 (#60 #27 #48) |  |
| 51 | 21887–22239 | 353 | 생성기 5단계 책상 세팅 | features |  | 15 (#84 #83 #5) | 8 (#44 #5 #50) |  |
| 52 | 22240–22469 | 230 | 생성기 아이템 3D 기즈모 | features |  | 13 (#5 #84 #60) | 4 (#53 #60 #5) |  |
| 53 | 22470–22539 | 70 | 생성기 6단계 좌석 세팅 | features |  | 6 (#48 #52 #1) | 3 (#52 #48 #60) |  |
| 54 | 22540–22573 | 34 | 책상 · 아이템 코드 만들기(판매자) | features |  | 1 (#82) | 4 (#26 #71 #92) |  |
| 55 | 22574–22625 | 52 | 커미션 캐릭터 코드 만들기(관리자) | features |  | 2 (#83 #80) | 4 (#26 #71 #92) |  |
| 56 | 22626–22829 | 204 | 책상 · 아이템 코드 가져오기 | features | def-size.js | 9 (#84 #1 #83) | 14 (#84 #60 #1) |  |
| 57 | 22830–22839 | 10 | 관리자 · 초대 게이트 상태(`isAdmin`) | entities |  | 0 | 21 (#60 #5 #13) | 22개 구역이 쓴다 |
| 58 | 22840–22842 | 3 | (머리만 · 3줄) | — |  | 1 (#1) | 0 |  |
| 59 | 22843–23815 | 973 | 🎟️ 초대장 · 가입 흐름 · 프리미엄 상태 | features |  | 15 (#6 #67 #19) | 17 (#60 #71 #67) |  |
| 60 | 23816–25218 | 1,403 | 런처 · 생성기 미리보기 | pages | animal-edit-route.js animal.js creator-flat-view.js def-size.js key-input.js myhome-desktop.js | 35 (#48 #84 #59) | 29 (#50 #61 #48) | 섞임(1,403줄): 라이선스 없는 기기 자산 접기 · 관리자 uid · 생성기/런처 미리보기 렌더러 · 슬롯 섬네일 · 런처 컨트롤 |
| 61 | 25219–25630 | 412 | 커미션 캐릭터 코드 입력 | features | animal.js def-size.js myhome-desktop.js | 21 (#60 #84 #48) | 15 (#12 #47 #1) |  |
| 62 | 25631–25962 | 332 | 설정 › 캐릭터 탭(교체 · 자리 추가) | widgets | guestbook.js myhome-desktop.js weekly-challenge.js | 18 (#48 #14 #97) | 13 (#60 #26 #68) |  |
| 63 | 25963–25979 | 17 | 방 인원 상한 | entities |  | 2 (#64 #65) | 2 (#65 #71) |  |
| 64 | 25980–26876 | 897 | 방 접속 상태(`Presence`) | entities | animal.js noise.js weekly-challenge.js | 33 (#65 #89 #19) | 39 (#43 #74 #60) | 섞임: 🚪 자리비움 자동 퇴장(features) |
| 65 | 26877–27739 | 863 | 🛰 방 연결(Firebase · 방 서버) · 표시 이름 | entities | animal.js chat-tabs.js myhome-desktop.js purikura-ui.js room-server-net.js | 36 (#71 #14 #64) | 31 (#71 #64 #73) |  |
| 66 | 27740–28002 | 263 | 🏷️ 닉네임 저장 | features | name-guard.js purikura-ui.js | 18 (#86 #65 #19) | 6 (#32 #70 #26) |  |
| 67 | 28003–28304 | 302 | 🔑 구글 로그인 | features |  | 14 (#78 #6 #59) | 6 (#59 #68 #70) |  |
| 68 | 28305–28699 | 395 | 🧹 신원을 놓을 때 지우기(로그아웃) | features | weekly-challenge.js | 25 (#74 #91 #22) | 12 (#70 #59 #67) |  |
| 69 | 28700–28758 | 59 | 🪪 [내 정보] 화면 전환 | pages |  | 7 (#70 #78 #68) | 5 (#70 #71 #61) |  |
| 70 | 28759–29416 | 658 | 🏆 [내 정보] 랭킹 · 보관함 · 휴지통 탭 | widgets | myhome-desktop.js | 20 (#78 #90 #69) | 6 (#69 #59 #60) |  |
| 71 | 29417–30622 | 1,206 | 방 입장 · 랜덤 참여 · 라이선스 등록 UI | features | animal.js folder-free.js | 37 (#22 #65 #6) | 16 (#65 #26 #68) | 섞임(1,206줄): 계정 스냅샷 복원 · 방 개수 표시 · 시크릿룸 입장 · 정원 초과 · 게임 설정 · 라이선스 요청 · 발급(관리자) |
| 72 | 30623–30912 | 290 | 관리자 파츠 카테고리 관리 | features |  | 7 (#84 #71 #31) | 2 (#71 #84) |  |
| 73 | 30913–31749 | 837 | 📄 엑셀로 라이선스 일괄 발급(관리자) | features |  | 17 (#48 #1 #65) | 20 (#74 #78 #48) | 섞임: `saveSlots`(슬롯 저장 — 핵심) |
| 74 | 31750–32178 | 429 | ☁️ 슬롯 기기 간 동기화 | entities |  | 14 (#75 #64 #48) | 9 (#75 #78 #68) |  |
| 75 | 32179–32448 | 270 | ☁️ 연동 UI(띠 · 대화상자) | widgets |  | 7 (#74 #68 #48) | 6 (#74 #68 #60) |  |
| 76 | 32449–32503 | 55 | 🧬 캐릭터 병합(순수 함수) | entities |  | 1 (#74) | 4 (#78 #67 #70) |  |
| 77 | 32504–32679 | 176 | 🧬 slots → chars 이관(순수 함수) | entities |  | 10 (#74 #48 #73) | 1 (#78) |  |
| 78 | 32680–33368 | 689 | 🧬 이관 조율 · 서버 쓰기 | entities |  | 12 (#74 #77 #48) | 15 (#70 #60 #67) |  |
| 79 | 33369–33506 | 138 | 🛡️ 얼굴 자동 복구 | entities | animal.js | 8 (#48 #73 #50) | 1 (#98) |  |
| 80 | 33507–33573 | 67 | AES-256-GCM 암호화 | shared |  | 5 (#1 #48 #73) | 8 (#82 #83 #84) |  |
| 81 | 33574–33586 | 13 | GLB 파일 암호화(.dcc) | shared |  | 2 (#1 #80) | 2 (#84 #17) |  |
| 82 | 33587–33611 | 25 | 책상 · 아이템 GLB 코드(DCK1) | entities |  | 3 (#80 #1 #2) | 9 (#56 #54 #60) |  |
| 83 | 33612–33722 | 111 | 커미션 캐릭터 zip 코드 | entities |  | 3 (#80 #1 #84) | 16 (#51 #56 #84) |  |
| 84 | 33723–35355 | 1,633 | 꾸미기 파츠 카탈로그(프리미엄) | entities | animal.js myhome-desktop.js seat-slot.js | 32 (#1 #5 #48) | 35 (#44 #47 #60) | 섞임(1,633줄): 카탈로그 동기화 · IndexedDB 캐시 · 관리자 콘솔 도구 · 책상 위 앵커 · 복제 코드 불러오기/내보내기 |
| 85 | 35356–36015 | 660 | 애니메이션 상태 · 프레임 루프(`frame`) | app | animal.js frame-budget.js | 28 (#13 #7 #1) | 30 (#41 #97 #60) |  |
| 86 | 36016–36136 | 121 | 데스크탑(Electron) 모드 · 피규어 모드 | app |  | 5 (#84 #1 #66) | 17 (#66 #44 #97) |  |
| 87 | 36137–36214 | 78 | 포커스 시간 누적 · 레벨 | entities |  | 2 (#90 #1) | 12 (#90 #26 #68) |  |
| 88 | 36215–36293 | 79 | 📊 오늘 기록 전시 | features | pomodoro.js | 5 (#19 #86 #64) | 4 (#64 #97 #19) |  |
| 89 | 36294–36614 | 321 | 🫧 자리비움 그림 | features |  | 10 (#1 #64 #6) | 6 (#64 #85 #65) |  |
| 90 | 36615–37047 | 433 | 🚩 신고하기 | features |  | 16 (#87 #13 #9) | 21 (#70 #29 #24) | 섞임: 포커스 레벨 · 별 색(`getFocusLevel` · `addFocusSeconds`) — 22개 구역이 쓴다 |
| 91 | 37048–37477 | 430 | 🎰 가챠 코어(보유분 · 확률 · 동기화) | entities |  | 15 (#47 #92 #84) | 12 (#92 #68 #26) |  |
| 92 | 37478–38302 | 825 | 🎰 파츠 보관함(T) · 뽑기 창 | widgets | scheduler.js | 14 (#91 #26 #44) | 6 (#26 #84 #91) |  |
| 93 | 38303–38356 | 54 | 🎨 디자인 테마 | shared |  | 1 (#94) | 2 (#94 #66) |  |
| 94 | 38357–38438 | 82 | 🎨 자식 창 테마 입히기 | shared |  | 1 (#93) | 3 (#66 #93 #32) |  |
| 95 | 38439–38555 | 117 | ⭐ 경험치 바 | widgets |  | 5 (#44 #24 #1) | 6 (#70 #65 #85) |  |
| 96 | 38556–38712 | 157 | 🕒 포커스 누적 기기 간 공유 | entities |  | 9 (#87 #90 #68) | 7 (#68 #71 #26) |  |
| 97 | 38713–39732 | 1,020 | 📱 태블릿 · 폰 포커싱 연결 | features | frame-budget.js pomodoro.js scheduler.js weekly-challenge.js | 27 (#44 #1 #85) | 13 (#29 #62 #30) | 끝에 👑 달성표 연결(`TwWeeklyChallenge.createWeeklyChallenge` — weekly-challenge.js · 원래 자리) · 🍅 뽀모도로 연결(`TwPomodoro.createPomodoro` — pomodoro.js · 원래 자리). 섞임: 그 뒤 `myHomeOpen` · `applyDesktopRunClass` · 데스크탑 모드(업데이트 배너 · 전역 입력 · 실행 화면 입력 판정 · 클릭 통과 · 하트비트) — 옛 🍅 뽀모도로 머리가 빠져 여기 붙었다(app 층 · 머리만 새로 다는 PR 감) |
| 98 | 39733–39747 | 15 | INIT — `resize` · 첫 배치 | app |  | 11 (#60 #18 #79) | 5 (#19 #26 #29) |  |
| 99 | 39748–40017 | 270 | 🙋 투게더룸 친구 초대 | features |  | 9 (#29 #65 #64) | 0 |  |
| 100 | 40018–40126 | 109 | 🛰 서버 모듈 감시견 | app |  | 0 | 0 |  |
