# app.js 구역 지도 — 앱 FSD 1단계

렌더러 본체 `app/parts/app.js` 를 웹 관리자(`web-admin/`)처럼 **층(FSD)** 으로 나눠 옮기기 위한 지도다.
이번 단계는 **코드를 한 줄도 옮기지 않는다** — 지금 무엇이 어디 있는지 적고, 더 커지지 않게 막고(검사 `sim-app-size.js`),
어느 것부터 옮길지 순서를 정한다.

**진행** — 1번(📅 스케줄러 · 🔔 일정 알림 → `app/parts/scheduler.js`) · 2번(👑 달성표 → `app/parts/weekly-challenge.js`) ·
3번(📷 스티커사진 창 → `app/parts/purikura-ui.js`) · 4번(📖 방명록 → `app/parts/guestbook.js`) ·
5번(👥 친구 관리 → `app/parts/friend-manage.js` · 🐞 버그 제보 탭 → `app/parts/bug-board-ui.js` 끝) ·
6번(🍅 뽀모도로 → `app/parts/pomodoro.js`) · 7번(🎨 마이홈 스티커 관리 창 → `app/parts/myhome-sticker.js`) ·
8번(🎰 가챠 코어 · 보관함 · 뽑기 창 → `app/parts/gacha.js`)을 옮겼다.
아래 줄 · 구역 번호는 옮긴 뒤 값이다(`node scripts/app-sections.js` 로 다시 뽑음 · 1번 때 옛 #31 부터 둘씩, 2번 때 옛 #111 부터 다시 둘씩,
3번 때 옛 #53 부터 일곱씩, 4번 때 옛 #37 부터 셋씩, 5번 때 옛 #30 부터 하나씩, 6번 때 옛 #99 부터 하나씩, 7번 때 옛 #33 부터 하나씩, 8번 때 옛 #92 부터 둘씩 당겨졌다). 목적 · 층 · 비고는 손으로 적은 것이라 그대로 두고, 씀 · 쓰임은 개수가 바뀐 줄만 새 값으로 갈았다
(관련 모듈은 스크립트 값 그대로).

## 요약

| | 값 |
|---|---|
| `app/parts/app.js` | **38,741줄** · 구역 머리 **97개** (상한 38,941줄 — `checks/app-size-baseline.json`) · 처음 46,147줄 · 116개 |
| `app/parts/firebase-init.js` | **4,444줄** · 구역 머리 31개 (상한 4,544줄) |
| 1,000줄 넘는 구역 | 11개 (#12 #26 #29 #31 #42 #43 #46 #59 #70 #83 #94) |
| 머리와 내용이 어긋난 «섞인» 구역 | 16개 · 19,323줄 (전체의 50%) — 머리 없이 덧붙인 코드가 앞 구역 안에 들어가 있다 |
| 다른 구역이 거의 안 쓰는 구역(쓰임 ≤ 3) | 21개 — 옮기기 쉬운 쪽 |

층별 크기 (구역 머리 기준 — 섞인 구역은 머리 쪽 층으로 셌다):

| 층 | 줄 | 비율 | 구역 |
|---|---:|---:|---:|
| features | 14,999 | 38.7% | 39 |
| entities | 10,134 | 26.2% | 26 |
| widgets | 8,326 | 21.5% | 13 |
| pages | 3,814 | 9.8% | 6 |
| app | 1,176 | 3.0% | 6 |
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
| 1 ✅ | 📅 스케줄러 · 🔔 일정 알림 | (옛 #29 #30) | 1,204 | `scheduler.js` (features) | **옮김** — 내놓는 이름 8개(`renderSchedCalendar` · `renderDdays` · `subscribeMonth` · `setDdays` · `setDdaysVisit` · `refreshBellBadge` · `renderBellList` · `isBellOpen`), 부르는 곳은 #29(친구 탭 D-day 구독 · 수령함 · 공지) · #30(마이홈 관람) / 받는 이름(deps) 12개. `BELL_SEEN_KEY` 는 #67 로그아웃 지움 목록이 같이 써서 app.js 에 둠 · 연결은 #28 끝(원래 자리) | 낮음 | `sim-scheduler`(신설) · `smoke`(scheduler.js 먼저 평가) — `sim-win-layers` · `sim-win-front` 는 그대로 초록 |
| 2 ✅ | 👑 달성표 (규칙 + 화면) | (옛 #109 #110) | 1,188 | `weekly-challenge.js` (entities 규칙 + widgets 화면 — 한 파일) | **옮김** — 내놓는 이름 6개(`syncChalToServer` · `open` · `isOpen` · `focusTick` · `setKeyPlatform` · `resetMemory`) + 검사용 `calc` · `tick` · `state`, 부르는 곳은 #61(런처 동기화) · #67(로그아웃 flush · 메모리 지우기) · #94(활성 앱 판정) · pomodoro.js(뽀모 서랍 — 6번) / 받는 이름(deps) 13개. `CHAL_KEY` 는 #67 로그아웃 지움 목록이 같이 써서 app.js 에 둠 · 다시 대입되던 `chalRec` · `_chalDirty` · `_chalKeyPlatform` 은 `resetMemory` · `setKeyPlatform` 으로 · 연결은 #94 끝(원래 자리) | 낮음 | `sim-weekly-challenge`(신설) · `smoke`(먼저 평가) · `sim-pomodoro` · `sim-mobile-focus` · `sim-account-switch` · `sim-keysof-twin`(weekly-challenge.js 를 읽게) — `sim-google-login` 은 그대로 초록 |
| 3 ✅ | 📷 스티커사진 창 | (옛 #46 ~ #52) | 2,623 | `purikura-ui.js` (pages · `purikura-net.js` 옆) | **옮김** — 내놓는 이름 4개(`open` · `close` · `isOpen` · `phase`) + 세션 콜백 넷(`onPeers` · `onMeta` · `onPeerEvent` · `onShot`) + 검사용 `state` · `deco`, 부르는 곳은 #12(때리기 'b' 조준 키) · #42(📷 버튼 — 대화창 버튼 연결) · #65(회사원 모드 켜기) · #40(세션 입구 `_purikura()` 의 콜백) / 받는 이름(deps) 31개 — 대부분 캐릭터 리그 · 애니메이션 도우미(#84 #13 #16). 다시 대입되는 `officeMode` · `_plPlaying` 과 뒤에 선언되는 const(`Presence` · 리그 상수 넷)는 읽는 함수로 · 세션 입구 `_purikura()` · `_pkSession` 은 #40(🎲 주사위)에 남김(주사위 · 📷 버튼도 씀) · 연결은 #40 끝(원래 자리) | 중간 | `sim-purikura-ui`(신설) · `smoke`(먼저 평가) · `sim-purikura-stage` · `-deco` · `-fish` · `sim-pk-fit` · `sim-fix-0923`(purikura-ui.js 를 읽게) |
| 4 ✅ | 📖 방명록 (새 글 배지 + 독립 팝업 창) | (옛 #34 ~ #36) | 475 | `guestbook.js` (pages) | **옮김** — 내놓는 이름은 예전처럼 window 고리 7개(`_mhGbStartWatch` · `_mhGbStopWatch` · `_mhGbRefreshBadge` · `_mhGbMarkAllRead` · `_mhReSubscribeGuestbook` · `openMyGuestbook` · `_mhGbRefreshWriteUI`) — 부르는 여덟 곳(#29 친구 목록 구독 · 마이홈 열기 · 닫기 · #30 관람 시작 · 끝 · #61 런처로)은 typeof 로 보고 부르므로 그대로(scheduler.js 의 `_closeBellWin` 과 같은 방식) · 반환값도 같은 함수 7개 / 받는 이름(deps) 8개. 다시 대입되는 `_mhViewingUserId` · `_myHomeFriends` 는 읽는 함수로 · `showChatBubble` 은 **남김**(말풍선 widgets — 7개 구역이 쓴다 · 지금은 #31 끝) · 연결은 #31 끝(원래 자리) | 낮음 | `sim-guestbook`(신설) · `smoke`(먼저 평가) · `sim-child-theme`(guestbook.js 를 읽게) — `sim-win-front` 는 그대로 초록 |
| 5 ✅ | 👥 친구 관리 칸 · 🐞 버그 제보 탭 링크 | (옛 #29) | 494 | `friend-manage.js` (widgets) · 버그 탭 62줄은 `bug-board-ui.js` 끝 | **옮김** — 내놓는 이름 11개(`showFriendRequestPopup` · `reqVisible` · `renderFriendManage` · `renderFriendRequests` · `refreshFriendReqBadge` · `lookupName` · `bulkAccept` · `bulkReject` · `setTab` · `tab` · `picked`) + 검사용 `acceptOne` · `seatsLeft`, 부르는 곳은 모두 #29(요청 구독 · 마이홈 열기 · 탭 전환 · 친구 코드 추가 · 서브탭 · 일괄 처리 바 — 열다섯 줄, `friendManage.이름`) / 받는 이름(deps) 10개. 다시 대입되는 `_myFriendRequests` · `_myHomeFriends` · `myHomeOpen` 은 읽는 함수로 · 다시 대입되던 `_fmTab` 은 `setTab` · `tab` 으로 · `FRIEND_MAX` 는 #28 에 남김(다섯 곳이 본다 · 값으로 넘김) · 🐞 버그 제보 탭은 `createXxx` 없이 bug-board-ui.js 끝 맨 앞 칸(게시판 화면과 같은 방식 · app.js 뒤지만 firebase-init(module) 앞이라 구독 때가 같다) · 연결은 #28 끝(원래 자리) | 낮음 | `sim-friend-manage-module`(신설) · `smoke`(먼저 평가) · `sim-friend-manage` · `sim-gift-star`(friend-manage.js 를 읽게) · `sim-scheduler`(자리 기준) — `sim-bug-board` 는 그대로 초록 |
| 6 ✅ | 🍅 뽀모도로 | (옛 #98 앞머리) | 176 | `pomodoro.js` (features) | **옮김** — 옛 #98 948줄 가운데 뽀모 몫인 앞머리 176줄(상태 · 구간 넘기기 · 서랍 그리기 · 버튼 연결)만. 밖에서 부르는 곳은 #87(📊 오늘 기록 전시의 `_focusShowConf`) 한 곳 — 만드는 줄보다 먼저(로드 중) 불려 반환값을 볼 수 없어서 예전처럼 window 고리 `_pomoShowText` + typeof 가드(guestbook.js 와 같은 방식) · 반환값은 같은 함수 + 검사용 `open` · `render` · `tick` · `cfg` · `run` / 받는 이름(deps) 4개(`toast` · `_focusShowPush` 는 화살표, `weeklyChal` · `_pomoSnd` 는 앞에 선언된 const 값). 알림음 풀 `_pomoSnd` 는 #12 효과음 공장에 남김(자동재생 잠금 해제 등록보다 앞이어야 한다) · 지도에 «42개» 로 적었던 입력 판정 · 프레임 상한 몫과 `myHomeOpen` · `applyDesktopRunClass` · 데스크탑 모드 772줄은 뽀모가 아니라 **남김** → 머리가 빠져 #94 에 붙음 · 연결은 👑 달성표 연결 바로 뒤(#94 · 원래 자리) | 낮음 | `sim-pomodoro-module`(신설) · `smoke`(먼저 평가) · `sim-pomodoro` · `sim-weekly-challenge`(pomodoro.js 를 읽게) |
| 7 ✅ | 🎨 마이홈 스티커 관리 창 · 스티커 편집 | (옛 #32 의 두 덩이) | 255 | `myhome-sticker.js` (widgets) | **옮김** — 옛 #32 1,481줄 가운데 스티커 몫 두 덩이(관리 창 119줄 · 편집모드 · 드래그 · 회전 · 크기 136줄)만. 내놓는 이름 9개(`open` · `close` · `render` · `bringIn` · `editStart` · `editEnd` · `bindDrag` · `bindRotate` · `bindResize`), 부르는 곳은 #31(`renderMyHomeStickers` 의 편집 시작 · 끝 · 핸들 셋 · [+ 스티커] · 새 스티커 붙이기) · #29(마이홈 닫기) 여덟 줄 — 모두 마이홈을 연 뒤에 돌아 `myHomeSticker.이름` / 받는 이름(deps) 18개 — 함수 10개는 화살표(`renderMyHomeStickers` 는 `bindMyHomePage` 가 감싸 다시 대입 · `commitMyHomePage` 는 window 이름), 다시 대입되는 `_myHomeData` · `_mhViewingUserId` · `_mhStickerEditSid` 는 읽는 함수, `_mhStickerEditSid` · `_mhStickerDragDist` 에 쓰는 것은 쓰는 함수(둘 다 #31 `renderMyHomeStickers` 가 읽어서 app.js 에 둠), `STICKER_*` 셋은 값. 🔗 마이홈 본문 링크 · 마이홈 페이지 편집 묶음(`bindMyHomePage`) · 📖 방명록 연결 · `showChatBubble` 은 **남김** → 머리가 빠져 #31 에 붙음(7-2) · 연결은 `renderMyHomeStickers` 뒤(#31 · 원래 자리) | 낮음 | `sim-myhome-sticker`(신설) · `smoke`(먼저 평가) — `sim-myhome-load` 는 그대로 초록 |
| 7-2 | 🏠 마이홈 페이지 편집 묶음 · 👑 디자인 스튜디오 | #31 뒤쪽(`bindMyHomePage`) | 1,167 | `myhome-edit.js` (widgets) — 디자인 스튜디오 · 프리셋(약 470줄)은 `myhome-design.js` 로 나눌 수 있다 | 하나의 IIFE 라 밖으로는 window 고리 열몇 개(`commitMyHomePage` · `_mhOpenColorPopup` · `_mhBeginNameEdit` · `_mhBgmRefresh` · `_mhApplyBg` · `_mhApplyTheme` · `_mhDsClose` · `_bgmDestroy` 등)뿐이지만, app.js 의 let 에 **쓴다**(`_myHomeLoaded = false` · `_mhStickerDragDist`) · `renderMyHomeStickers` 를 감싸 **다시 대입한다** · `DS_HTML` 에 색이 많다(ui-tokens 기준선) | 중간 | `sim-myhome-steps` · `sim-myhome-load` · `sim-child-theme` · `sim-fix-1008`(이 묶음 글을 읽는다) |
| 8 ✅ | 🎰 가챠 코어 · 보관함 · 뽑기 창 | (옛 #90 #91) | 1,213 | `gacha.js` (entities 규칙 + widgets 화면 — 한 파일) | **옮김** — 옛 #90 · #91 두 구역 1,217줄 가운데 저장 키 세 줄을 뺀 전부(달성표처럼 한 파일 — 보관함 · 뽑기 창이 코어 이름 스무 개 가까이를 그대로 써서 나누면 글자 그대로가 깨진다). 내놓는 이름 16개(`isGachaPart` · `isGachaColorUnlocked` · `gachaCount` · `sceneHasColorGroup` · `DUPES_FOR_COLOR` · `syncGachaToServer` · `pruneUnownedGachaParts` · `renderGachaInv` · `toggleGachaInv` · `isInvOpen` · `isDrawOpen` · `selId` · `owned` · `bonus` · `setBonusLocal` · `resetMemory`) + 검사용 `draw` · `pool` · `state` 등, 부르는 곳은 #26(T 키 · 꾸미기 커밋 · 미리보기 색상 영역) · #43(파츠 등록 · 색 없는 파츠 판정 · 꾸미기 창 거르기) · #61(런처) · #67(로그아웃 flush · 검문 · 메모리 지우기) · #70(연동 pull) · #83(카탈로그 도착 · 썸네일 · 라이선스 접기) · #94(👑 달성표 deps) 스물몇 줄 — 부팅 중 먼저 불리는 곳이 없어(smoke · 헤드리스 main 계측) typeof 고리 대신 `gachaMod.이름` / 받는 이름(deps) 40개 — 함수 28은 화살표, 다시 대입되는 `isAdmin` · `savedParts` · `PART_CATS` · `wdDraftDef` · `activeWdAdj` 는 읽는 함수(+ `activeWdAdj` 쓰는 함수), `seats` · `slots` · `Presence` · 저장 키 셋은 값. 두 구역 사이의 🔑 쓰기 거부 안내(`_warnServerWriteDenied` — 캐릭터 슬롯도 부른다)와 저장 키 세 줄(계정 전환 지움 목록)은 **남김** → 머리가 빠져 #89 에 붙음 · 연결은 옛 #90 머리 자리(원래 자리) · 예전부터 window 에 걸던 `openGachaInv` · `closeGachaInv` · `_gachaRestorePos` 는 그대로 | 높음 | `sim-gacha`(신설) · `smoke`(먼저 평가) · `sim-gacha-prune` · `sim-gacha-race` · `sim-part-color-entry`(gacha.js 를 먼저 평가) · `sim-account-switch` · `sim-key-input` · `sim-weekly-challenge`(gachaMod) — `sim-slot-sync` 는 그대로 초록 |

1 ~ 8 을 다 하면 약 9,400줄(app.js 의 20%)이 빠진다. 1번으로 46,147 → 44,966줄(1,181줄 — 옮긴 1,204줄 − 연결 23줄),
2번으로 44,966 → 43,799줄(1,167줄 — 옮긴 1,188줄 − 연결 21줄),
3번으로 43,799 → 41,217줄(2,582줄 — 옮긴 2,623줄 − 연결 41줄),
4번으로 41,217 → 40,761줄(456줄 — 옮긴 475줄 − 연결 19줄),
5번으로 40,761 → 40,288줄(473줄 — 옮긴 494줄 − 연결 21줄),
6번으로 40,288 → 40,126줄(162줄 — 옮긴 176줄 − 연결 14줄),
7번으로 40,126 → 39,900줄(226줄 — 옮긴 255줄 + 사이 빈 줄 1 − 연결 30줄),
8번으로 39,900 → 38,741줄(1,159줄 — 옮긴 1,213줄 + 사이 빈 줄 1 − 연결 55줄).

**0단계(선택 · 위와 따로 해도 된다)** — 섞인 구역에 묻힌 shared 도구(`escHtml` · HTML sanitize(#29) · 효과음 공장(#12) · 창 겹침(#19))를
app.js 앞에 싣는 작은 파일로 옮기면 전역 이름이 그대로라 부르는 곳을 안 고쳐도 되고, 뒤 단계의 deps 가 짧아진다.

**옮기기 전에 쪼갤 것** — #26(2,839줄) · #43(1,733줄) · #59(1,403줄) · #29(1,455줄) · #70(1,206줄) · #83(1,633줄) · #31(1,643줄 — 7번 뒤 남은 마이홈 페이지 편집 묶음)은 머리 하나에
여러 기능이 섞여 있다. 옮기기 전에 **코드는 그대로 두고 구역 머리만 새로 다는** PR 을 먼저 하면 이 지도가 정확해진다
(이때는 `--allow-new-section` 으로 기준선을 쓴다 — 머리만 늘고 줄 수는 그대로).

## 구역 표 — `app/parts/app.js`

| # | 줄 | 크기 | 목적 | 층 | 관련 모듈 | 씀 | 쓰임 | 비고 |
|---|---|---:|---|---|---|---|---|---|
| 1 | 1–267 | 267 | three.js 캔버스 · 렌더러 · 씬 · 카메라 · 조명 · WebGL 복구 연결 | app | gl-recover.js | 10 (#55 #11 #6) | 70 (#26 #59 #83) | 전역 `renderer` `scene` `camera` 와 조명 `key` `fill` 을 거의 모든 구역이 쓴다 |
| 2 | 268–271 | 4 | GLTF 로더 하나 | app |  | 0 | 3 (#4 #17 #81) |  |
| 3 | 272–328 | 57 | 사람 귀 부착 — human-ear.js 연결 | entities | animal.js ears-glb.js human-ear.js | 8 (#1 #59 #55) | 6 (#43 #60 #12) |  |
| 4 | 329–414 | 86 | 내장 기본 캐릭터 GLB 파싱 · 리깅 | entities | base-glb.js | 6 (#1 #2 #47) | 12 (#59 #47 #60) |  |
| 5 | 415–894 | 480 | 책상 · 소품 3D 빌더 · 기본 책상 덮어쓰기 | entities | desk-item-origin.js | 14 (#83 #1 #43) | 15 (#46 #59 #83) |  |
| 6 | 895–1358 | 464 | 좌석 배열 `seats` · 간격 · 위치/크기 저장 · 이동 한계 | entities | animal.js | 10 (#1 #5 #18) | 56 (#26 #14 #58) | 핵심 상태 — 60개 구역이 쓴다 |
| 7 | 1359–1767 | 409 | 좌석 크기 평준화 배율(k) | entities | animal.js | 17 (#12 #83 #6) | 15 (#12 #13 #84) |  |
| 8 | 1768–1826 | 59 | 🪑 플라잉체어 | features |  | 2 (#14 #43) | 5 (#11 #10 #41) |  |
| 9 | 1827–1930 | 104 | 워킹룸 캐릭터 숨기기 | features | frame-budget.js | 8 (#44 #63 #70) | 9 (#44 #11 #84) |  |
| 10 | 1931–2003 | 73 | 방 이벤트(poke) 신선도 판정 | entities |  | 5 (#8 #12 #11) | 8 (#63 #11 #9) |  |
| 11 | 2004–2308 | 305 | 💃 깜짝쇼 | features | animal.js | 17 (#8 #1 #12) | 14 (#42 #12 #13) |  |
| 12 | 2309–3532 | 1,224 | 🪄 때리기 | features | animal.js key-input.js | 24 (#7 #43 #11) | 22 (#44 #29 #7) | 섞임: 효과음 공장(`_mkSndPool` · 채팅 · 뽀모도로 알림음) · 올라타기(탑) |
| 13 | 3533–3739 | 207 | 상호작용 책상 카탈로그 · 레벨 해금 | entities |  | 10 (#7 #11 #12) | 9 (#84 #14 #26) |  |
| 14 | 3740–4196 | 457 | 멀티좌석 벤치에 앉히기 | features | frame-budget.js | 11 (#6 #1 #13) | 22 (#64 #26 #44) | 섞임: `layoutSeats`(좌석 배치 — 핵심)가 여기 있다 |
| 15 | 4197–4262 | 66 | PS1 색 양자화 · 디더링 셰이더 | shared |  | 1 (#1) | 1 (#14) |  |
| 16 | 4263–4748 | 486 | 캐릭터 머리 · 몸 크기 재기 | entities | animal.js | 13 (#46 #4 #59) | 17 (#46 #26 #59) |  |
| 17 | 4749–4869 | 121 | 모델 불러오기 · 애니메이션 클립 고르기(`setupSeatModel`) | entities | animal.js | 8 (#16 #4 #84) | 5 (#18 #26 #46) |  |
| 18 | 4870–4912 | 43 | 좌석 탭 · 상태 라벨 DOM 고리 | widgets |  | 8 (#6 #43 #17) | 22 (#61 #84 #6) |  |
| 19 | 4913–5460 | 548 | 상태칩 — 활동 상태 · 커스텀 상태 | widgets | folder-free.js | 14 (#1 #26 #58) | 21 (#26 #43 #63) | 섞임: 창 겹침(`escRegisterWindow` · `bringWinToFront`) — shared 로 |
| 20 | 5461–5513 | 53 | 기본 이모티콘 말풍선(워킹룸) | features |  | 5 (#39 #19 #63) | 0 |  |
| 21 | 5514–5536 | 23 | 상태칩 플레이리스트 | widgets |  | 1 (#1) | 4 (#22 #24 #25) |  |
| 22 | 5537–5976 | 440 | 플레이리스트 프리셋 데이터 | entities | gacha.js scheduler.js | 8 (#1 #26 #30) | 9 (#24 #26 #70) |  |
| 23 | 5977–5983 | 7 | (머리만 · 7줄) | — |  | 0 | 0 |  |
| 24 | 5984–6638 | 655 | 레벨 티어 경계값 · 배지 클래스 | entities |  | 12 (#22 #25 #89) | 10 (#26 #92 #29) | 섞임: 플레이리스트 화면(`_plRender`) |
| 25 | 6639–6882 | 244 | 플레이리스트 프리셋 고르기 | widgets |  | 5 (#22 #24 #1) | 2 (#24 #26) |  |
| 26 | 6883–9721 | 2,839 | 🐕 BGM 재생 감시견 | widgets | animal.js gacha.js key-input.js scheduler.js | 48 (#22 #19 #6) | 22 (#43 #89 #42) | 섞임(2,839줄): 렌더러 생존 신호 · 상태칩 위치 · ⚙ 설정 패널 · 포커스 기록 팝업 · 이동 모드 · 함수키 · 꾸미기 패널 · 미리보기 · 초안 — 옮기기 전에 쪼갤 것 |
| 27 | 9722–10525 | 804 | 🖍️ 파츠에 직접 그리기 | features | animal.js key-input.js paint-tools.js purikura-ui.js uv-fill.js | 13 (#42 #83 #26) | 17 (#26 #48 #49) |  |
| 28 | 10526–10613 | 88 | 🏠 마이홈 친구 탭 상수 · 상태 | pages | bug-board-ui.js friend-manage.js scheduler.js | 8 (#29 #30 #19) | 10 (#29 #31 #30) | 끝에 📅 스케줄러 · 🔔 일정 알림 연결(`MhScheduler.createScheduler` — scheduler.js · 원래 자리) · 👥 친구 관리 연결(`TwFriendManage.createFriendManage` — friend-manage.js · 옛 #29 자리). 🐞 버그 제보 탭(오픈카톡 기본 링크)은 bug-board-ui.js 끝으로 |
| 29 | 10614–12068 | 1,455 | 🖥️ 한 계정 한 기기 — 밀려난 기기 | widgets | bug-board-ui.js friend-manage.js guestbook.js mallang.js scheduler.js | 21 (#12 #28 #89) | 16 (#42 #28 #31) | 섞임(1,455줄): 우편함 배지 · `escHtml` · 채팅창 투명도 · 글자 크기 · 알림음 · HTML sanitize · 친구 목록 · Ctrl+F 검색 · 수령함 · 선물함 |
| 30 | 12069–12265 | 197 | 🏠 마이홈 데이터 불러오기 · 방문 | pages | guestbook.js mallang.js myhome-desktop.js scheduler.js | 4 (#28 #31 #94) | 10 (#31 #29 #28) |  |
| 31 | 12266–13908 | 1,643 | 🔬 마이홈 클릭 진단 | pages | guestbook.js myhome-sticker.js scheduler.js | 15 (#30 #28 #29) | 14 (#29 #30 #12) | 섞임(1,643줄): 마이홈 페이지 그리기 · 스티커 배치(`renderMyHomePage`) · 끝에 🎨 스티커 관리 창 연결(`TwMyHomeSticker.createMyHomeSticker` — myhome-sticker.js · 원래 자리) · 🔗 마이홈 본문 링크 · 마이홈 페이지 편집 묶음(`bindMyHomePage` 1,167줄 — 자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 닉네임 · 🎵 BGM · 배경 · 테마 · 👑 디자인 스튜디오 · 프리셋) · 📖 방명록 연결(`TwGuestbook.createGuestbook`) · `showChatBubble`(머리 위 말풍선 — 7개 구역이 쓴다) — 옛 🎨 머리가 빠져 여기 붙었다(7-2 · 머리만 새로 다는 PR 감) |
| 32 | 13909–14119 | 211 | 🌊 채팅 날리기 | features |  | 12 (#43 #1 #11) | 8 (#42 #38 #70) |  |
| 33 | 14120–14140 | 21 | 💬 대화창 코어 | widgets |  | 1 (#29) | 10 (#34 #37 #38) |  |
| 34 | 14141–14452 | 312 | 🔖 읽음 구분선 | features |  | 11 (#37 #33 #38) | 10 (#37 #42 #26) |  |
| 35 | 14453–14492 | 40 | 🔇 시크릿룸 채팅 잠금 | features |  | 6 (#37 #63 #6) | 6 (#36 #37 #63) |  |
| 36 | 14493–14613 | 121 | 🗑 대화 기록 삭제(방장) | features |  | 8 (#35 #37 #34) | 7 (#42 #34 #64) |  |
| 37 | 14614–14904 | 291 | 💬 채팅 탭 | features | chat-tabs.js | 9 (#34 #38 #35) | 8 (#34 #36 #35) | chat-tabs.js 와 짝 |
| 38 | 14905–15199 | 295 | 📋 대화 드래그 · 복사 | features | chat-copy.js | 14 (#32 #39 #13) | 3 (#37 #42 #34) | chat-copy.js 와 짝 |
| 39 | 15200–15377 | 178 | 😊 커스텀 이모티콘 | features |  | 4 (#6 #33 #31) | 5 (#42 #38 #20) |  |
| 40 | 15378–15469 | 92 | 🎲 주사위 | features | animal.js purikura-net.js purikura-ui.js scheduler.js | 15 (#1 #84 #13) | 5 (#42 #12 #38) | 📷 세션 입구 `_purikura()` 와 끝에 📷 스티커사진 창 연결(`TwPurikuraUi.createPurikuraUi` — purikura-ui.js · 원래 자리) |
| 41 | 15470–15542 | 73 | 🎟️ 룰렛 · 주사위 하루 횟수 | features |  | 13 (#1 #42 #11) | 2 (#42 #26) |  |
| 42 | 15543–16786 | 1,244 | 🔫 러시안룰렛 | features | gacha.js purikura-ui.js | 28 (#29 #83 #63) | 11 (#46 #27 #26) | 섞임: 텍스처 색조 셰이더 · 파츠 그림칸 · UV 구제(21197~) |
| 43 | 16787–18519 | 1,733 | 꾸미기 창 «책상» 탭 | widgets | animal.js ears-glb.js gacha.js human-ear.js wd-ear.js | 37 (#83 #26 #46) | 30 (#26 #94 #84) | 섞임(1,733줄): 꾸미기 창 그리기 · 귀 탭 · 카탈로그 파츠 페이로드 · 상태 이모지 그림 · 이름표 · 말풍선 · 회사원 모드 라벨 |
| 44 | 18520–18951 | 432 | 캐릭터 끌기 · 흔들기 · 쓰다듬기 | features |  | 22 (#12 #9 #6) | 14 (#9 #11 #12) |  |
| 45 | 18952–18994 | 43 | 머리 위 이모지 반응(floaters) | widgets | animal.js | 5 (#1 #6 #14) | 8 (#44 #84 #7) |  |
| 46 | 18995–20372 | 1,378 | 파츠 부착 — 본 · 오프셋 보정 · 유령 정리 | entities | animal.js | 17 (#83 #42 #5) | 14 (#43 #26 #59) |  |
| 47 | 20373–20796 | 424 | 생성기 · 런처 공통 상태(`charDef` · `slots` · `curSlot`) | pages | animal-edit-route.js animal.js myhome-desktop.js skin-data.js | 17 (#83 #59 #4) | 40 (#59 #49 #78) | 핵심 상태 — 41개 구역이 쓴다 |
| 48 | 20797–20926 | 130 | 생성기 x축 대칭 | features |  | 6 (#47 #27 #44) | 3 (#49 #27 #59) |  |
| 49 | 20927–21660 | 734 | 생성기 이미지 도장 | features | animal.js key-input.js paint-tools.js skin-data.js uv-fill.js | 9 (#47 #59 #48) | 7 (#59 #27 #47) |  |
| 50 | 21661–22013 | 353 | 생성기 5단계 책상 세팅 | features |  | 15 (#83 #82 #5) | 8 (#43 #5 #49) |  |
| 51 | 22014–22243 | 230 | 생성기 아이템 3D 기즈모 | features |  | 13 (#5 #83 #59) | 4 (#52 #59 #5) |  |
| 52 | 22244–22313 | 70 | 생성기 6단계 좌석 세팅 | features |  | 6 (#47 #51 #1) | 3 (#51 #47 #59) |  |
| 53 | 22314–22347 | 34 | 책상 · 아이템 코드 만들기(판매자) | features |  | 1 (#81) | 3 (#26 #70 #94) |  |
| 54 | 22348–22399 | 52 | 커미션 캐릭터 코드 만들기(관리자) | features |  | 2 (#82 #79) | 3 (#26 #70 #94) |  |
| 55 | 22400–22603 | 204 | 책상 · 아이템 코드 가져오기 | features | def-size.js | 9 (#83 #1 #82) | 13 (#83 #59 #1) |  |
| 56 | 22604–22613 | 10 | 관리자 · 초대 게이트 상태(`isAdmin`) | entities |  | 0 | 19 (#59 #5 #13) | 22개 구역이 쓴다 |
| 57 | 22614–22616 | 3 | (머리만 · 3줄) | — |  | 1 (#1) | 0 |  |
| 58 | 22617–23589 | 973 | 🎟️ 초대장 · 가입 흐름 · 프리미엄 상태 | features |  | 15 (#6 #66 #19) | 17 (#59 #70 #66) |  |
| 59 | 23590–24992 | 1,403 | 런처 · 생성기 미리보기 | pages | animal-edit-route.js animal.js creator-flat-view.js def-size.js gacha.js key-input.js myhome-desktop.js | 34 (#47 #83 #58) | 29 (#49 #60 #47) | 섞임(1,403줄): 라이선스 없는 기기 자산 접기 · 관리자 uid · 생성기/런처 미리보기 렌더러 · 슬롯 섬네일 · 런처 컨트롤 |
| 60 | 24993–25404 | 412 | 커미션 캐릭터 코드 입력 | features | animal.js def-size.js myhome-desktop.js | 21 (#59 #83 #47) | 15 (#12 #46 #1) |  |
| 61 | 25405–25736 | 332 | 설정 › 캐릭터 탭(교체 · 자리 추가) | widgets | gacha.js guestbook.js myhome-desktop.js weekly-challenge.js | 18 (#47 #14 #94) | 13 (#59 #26 #67) |  |
| 62 | 25737–25753 | 17 | 방 인원 상한 | entities |  | 2 (#63 #64) | 2 (#64 #70) |  |
| 63 | 25754–26650 | 897 | 방 접속 상태(`Presence`) | entities | animal.js noise.js weekly-challenge.js | 33 (#64 #88 #19) | 39 (#42 #73 #59) | 섞임: 🚪 자리비움 자동 퇴장(features) |
| 64 | 26651–27513 | 863 | 🛰 방 연결(Firebase · 방 서버) · 표시 이름 | entities | animal.js chat-tabs.js myhome-desktop.js purikura-ui.js room-server-net.js | 36 (#70 #14 #63) | 30 (#70 #63 #72) |  |
| 65 | 27514–27776 | 263 | 🏷️ 닉네임 저장 | features | name-guard.js purikura-ui.js | 18 (#85 #64 #19) | 6 (#31 #69 #26) |  |
| 66 | 27777–28078 | 302 | 🔑 구글 로그인 | features |  | 14 (#77 #6 #58) | 6 (#58 #67 #69) |  |
| 67 | 28079–28473 | 395 | 🧹 신원을 놓을 때 지우기(로그아웃) | features | gacha.js weekly-challenge.js | 24 (#73 #89 #22) | 12 (#69 #58 #66) |  |
| 68 | 28474–28532 | 59 | 🪪 [내 정보] 화면 전환 | pages |  | 7 (#69 #77 #67) | 5 (#69 #70 #60) |  |
| 69 | 28533–29190 | 658 | 🏆 [내 정보] 랭킹 · 보관함 · 휴지통 탭 | widgets | myhome-desktop.js | 20 (#77 #89 #68) | 6 (#68 #58 #59) |  |
| 70 | 29191–30396 | 1,206 | 방 입장 · 랜덤 참여 · 라이선스 등록 UI | features | animal.js folder-free.js gacha.js | 35 (#22 #64 #6) | 16 (#64 #26 #67) | 섞임(1,206줄): 계정 스냅샷 복원 · 방 개수 표시 · 시크릿룸 입장 · 정원 초과 · 게임 설정 · 라이선스 요청 · 발급(관리자) |
| 71 | 30397–30686 | 290 | 관리자 파츠 카테고리 관리 | features |  | 7 (#83 #70 #31) | 2 (#70 #83) |  |
| 72 | 30687–31523 | 837 | 📄 엑셀로 라이선스 일괄 발급(관리자) | features |  | 17 (#47 #1 #64) | 20 (#73 #77 #47) | 섞임: `saveSlots`(슬롯 저장 — 핵심) |
| 73 | 31524–31952 | 429 | ☁️ 슬롯 기기 간 동기화 | entities |  | 14 (#74 #63 #47) | 9 (#74 #77 #67) |  |
| 74 | 31953–32222 | 270 | ☁️ 연동 UI(띠 · 대화상자) | widgets |  | 7 (#73 #67 #47) | 6 (#73 #67 #59) |  |
| 75 | 32223–32277 | 55 | 🧬 캐릭터 병합(순수 함수) | entities |  | 1 (#73) | 4 (#77 #66 #69) |  |
| 76 | 32278–32453 | 176 | 🧬 slots → chars 이관(순수 함수) | entities |  | 10 (#73 #47 #72) | 1 (#77) |  |
| 77 | 32454–33142 | 689 | 🧬 이관 조율 · 서버 쓰기 | entities |  | 12 (#73 #76 #47) | 15 (#69 #59 #66) |  |
| 78 | 33143–33280 | 138 | 🛡️ 얼굴 자동 복구 | entities | animal.js | 8 (#47 #72 #49) | 1 (#95) |  |
| 79 | 33281–33347 | 67 | AES-256-GCM 암호화 | shared |  | 5 (#1 #47 #72) | 8 (#81 #82 #83) |  |
| 80 | 33348–33360 | 13 | GLB 파일 암호화(.dcc) | shared |  | 2 (#1 #79) | 2 (#83 #17) |  |
| 81 | 33361–33385 | 25 | 책상 · 아이템 GLB 코드(DCK1) | entities |  | 3 (#79 #1 #2) | 9 (#55 #53 #59) |  |
| 82 | 33386–33496 | 111 | 커미션 캐릭터 zip 코드 | entities |  | 3 (#79 #1 #83) | 16 (#50 #55 #83) |  |
| 83 | 33497–35129 | 1,633 | 꾸미기 파츠 카탈로그(프리미엄) | entities | animal.js gacha.js myhome-desktop.js seat-slot.js | 30 (#1 #5 #47) | 34 (#43 #46 #59) | 섞임(1,633줄): 카탈로그 동기화 · IndexedDB 캐시 · 관리자 콘솔 도구 · 책상 위 앵커 · 복제 코드 불러오기/내보내기 |
| 84 | 35130–35789 | 660 | 애니메이션 상태 · 프레임 루프(`frame`) | app | animal.js frame-budget.js | 28 (#13 #7 #1) | 30 (#40 #94 #59) |  |
| 85 | 35790–35910 | 121 | 데스크탑(Electron) 모드 · 피규어 모드 | app |  | 5 (#83 #1 #65) | 17 (#65 #43 #94) |  |
| 86 | 35911–35988 | 78 | 포커스 시간 누적 · 레벨 | entities |  | 2 (#89 #1) | 12 (#89 #26 #67) |  |
| 87 | 35989–36067 | 79 | 📊 오늘 기록 전시 | features | pomodoro.js | 5 (#19 #85 #63) | 4 (#63 #94 #19) |  |
| 88 | 36068–36388 | 321 | 🫧 자리비움 그림 | features |  | 10 (#1 #63 #6) | 6 (#63 #84 #64) |  |
| 89 | 36389–36917 | 529 | 🚩 신고하기 | features | gacha.js scheduler.js | 26 (#26 #86 #43) | 22 (#67 #69 #29) | 섞임: 포커스 레벨 · 별 색(`getFocusLevel` · `addFocusSeconds`) — 22개 구역이 쓴다 · 끝에 🎰 가챠 연결(`TwGacha.createGacha` — gacha.js · 옛 #90 · #91 자리 · 저장 키 세 줄과 함께) · 🔑 쓰기 거부 안내(`_warnServerWriteDenied` — 가챠 · 캐릭터 슬롯이 부른다 · 옛 #90 · #91 사이) |
| 90 | 36918–36971 | 54 | 🎨 디자인 테마 | shared |  | 1 (#91) | 2 (#91 #65) |  |
| 91 | 36972–37053 | 82 | 🎨 자식 창 테마 입히기 | shared |  | 1 (#90) | 3 (#65 #90 #31) |  |
| 92 | 37054–37170 | 117 | ⭐ 경험치 바 | widgets |  | 5 (#43 #24 #1) | 6 (#69 #64 #84) |  |
| 93 | 37171–37327 | 157 | 🕒 포커스 누적 기기 간 공유 | entities |  | 9 (#86 #89 #67) | 6 (#67 #70 #26) |  |
| 94 | 37328–38347 | 1,020 | 📱 태블릿 · 폰 포커싱 연결 | features | frame-budget.js gacha.js pomodoro.js scheduler.js weekly-challenge.js | 25 (#43 #1 #84) | 14 (#29 #61 #30) | 끝에 👑 달성표 연결(`TwWeeklyChallenge.createWeeklyChallenge` — weekly-challenge.js · 원래 자리) · 🍅 뽀모도로 연결(`TwPomodoro.createPomodoro` — pomodoro.js · 원래 자리). 섞임: 그 뒤 `myHomeOpen` · `applyDesktopRunClass` · 데스크탑 모드(업데이트 배너 · 전역 입력 · 실행 화면 입력 판정 · 클릭 통과 · 하트비트) — 옛 🍅 뽀모도로 머리가 빠져 여기 붙었다(app 층 · 머리만 새로 다는 PR 감) |
| 95 | 38348–38362 | 15 | INIT — `resize` · 첫 배치 | app |  | 11 (#59 #18 #78) | 5 (#19 #26 #29) |  |
| 96 | 38363–38632 | 270 | 🙋 투게더룸 친구 초대 | features |  | 9 (#29 #64 #63) | 0 |  |
| 97 | 38633–38741 | 109 | 🛰 서버 모듈 감시견 | app |  | 0 | 0 |  |
