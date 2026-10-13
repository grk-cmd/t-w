# app.js 구역 지도 — 앱 FSD 1단계

렌더러 본체 `app/parts/app.js` 를 웹 관리자(`web-admin/`)처럼 **층(FSD)** 으로 나눠 옮기기 위한 지도다.
이번 단계는 **코드를 한 줄도 옮기지 않는다** — 지금 무엇이 어디 있는지 적고, 더 커지지 않게 막고(검사 `sim-app-size.js`),
어느 것부터 옮길지 순서를 정한다.

**진행** — 1번(📅 스케줄러 · 🔔 일정 알림 → `app/parts/scheduler.js`) · 2번(👑 달성표 → `app/parts/weekly-challenge.js`) ·
3번(📷 스티커사진 창 → `app/parts/purikura-ui.js`) · 4번(📖 방명록 → `app/parts/guestbook.js`) ·
5번(👥 친구 관리 → `app/parts/friend-manage.js` · 🐞 버그 제보 탭 → `app/parts/bug-board-ui.js` 끝) ·
6번(🍅 뽀모도로 → `app/parts/pomodoro.js`) · 7번(🎨 마이홈 스티커 관리 창 → `app/parts/myhome-sticker.js`) ·
8번(🎰 가챠 코어 · 보관함 · 뽑기 창 → `app/parts/gacha.js`) ·
7-2번(🏠 마이홈 페이지 편집 묶음 · 👑 디자인 스튜디오 → `app/parts/myhome-edit.js`)을 옮겼다.
그 뒤 **구역 머리만 새로 단 PR**(코드 무변경 · 주석 76줄)로 섞여 있던 큰 구역 16개를 기능 경계에서 나눴다 — 구역 97 → **173개**.
그다음 10번(🙋 투게더룸 친구 초대 → `app/parts/room-invite-ui.js`) · 13번(🕒 포커스 기록 팝업 → `app/parts/focus-log.js`) ·
14번(💬 대화창 배선 → `app/parts/chat-window.js`) · 15번(📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록 → `app/parts/myhome-inbox.js`) ·
16번(🎵 상태칩 플레이리스트 → `app/parts/playlist.js`)을 옮겼다(머리는 그대로 두고 연결만 남김 — 구역 수 · 번호 그대로).
아래 줄 · 구역 번호 · 씀 · 쓰임은 16번 뒤 값이다(`node scripts/app-sections.js` 로 다시 뽑음). 번호가 크게 바뀌어서
순서표 1 ~ 8 · 7-2 줄에 적힌 «#N» 은 **머리를 달기 전(97개) 번호**다 — 아래 «옛 번호 → 새 번호» 로 찾는다.
목적 · 층 · 비고는 손으로 적은 것이라 그대로 두고, 나뉜 구역 · 새 구역만 새로 적었다(관련 모듈은 스크립트 값 그대로).

## 요약

| | 값 |
|---|---|
| `app/parts/app.js` | **34,967줄** · 구역 머리 **173개** (상한 35,167줄 — `checks/app-size-baseline.json`) · 처음 46,147줄 · 116개 |
| `app/parts/firebase-init.js` | **4,459줄** · 구역 머리 31개 (상한 4,544줄) |
| 1,000줄 넘는 구역 | 1개 (#89 꾸미기 파츠 부착 — 한 기능) · 머리를 달기 전 10개 |
| 머리와 내용이 어긋난 «섞인» 구역 | 3개 · 1,518줄 (전체의 4.3%) — #36 · #126 은 몇십 줄이 끼어 있는 정도, #170 은 `if(desktopMode){…}` 한 덩이라 머리로 못 나눔 · 머리를 달기 전 16개 · 18,204줄(48%) |
| 다른 구역이 거의 안 쓰는 구역(쓰임 ≤ 3) | 56개 — 옮기기 쉬운 쪽 |

층별 크기 (구역 머리 기준 — 섞인 구역은 머리 쪽 층으로 셌다):

| 층 | 줄 | 비율 | 구역 |
|---|---:|---:|---:|
| features | 13,697 | 39.2% | 60 |
| entities | 9,489 | 27.2% | 39 |
| widgets | 5,718 | 16.4% | 25 |
| app | 2,576 | 7.4% | 17 |
| pages | 2,540 | 7.3% | 13 |
| shared | 926 | 2.6% | 12 |
| (머리만) | 22 | — | 7 |

shared 는 머리를 달기 전 0.7% 였다 — 공용 도구가 따로 구역 없이 다른 구역 안에 묻혀 있어서였다. 이제 제 머리가 있다:
효과음 공장(#13) · 창 겹침(#24) · `escHtml`(#48) · HTML sanitize(#51) · `asyncPrompt`(#58) · 토스트(#154).

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
  섞인 구역에 **머리만 새로 다는** PR 은 머리 줄만큼 줄 수가 늘어 둘 다 쓴다(`--write-baseline --allow-new-section --allow-increase` — 상한이 머리 줄 수만큼만 오른다).
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

> 1 ~ 8 · 7-2 줄의 «#N» 은 머리를 새로 달기 전(구역 97개) 번호다. 9 ~ 는 지금(173개) 번호다. 옛 번호 → 새 번호(굵게 = 나뉜 구역):
> #1→1 · #2→2 · #3→3 · #4→4 · #5→5 · #6→6 · #7→7 · #8→8 · #9→9 · #10→10 · #11→11 · **#12→12~15** · #13→16 · **#14→17~18** · #15→19 · #16→20 · #17→21 · #18→22 · **#19→23~25** · #20→26 · #21→27 · #22→28 · #23→29 · **#24→30~31** · #25→32 · **#26→33~42** · #27→43 · #28→44 · **#29→45~54** · #30→55 · **#31→56~62** · #32→63 · #33→64 · #34→65 · #35→66 · #36→67 · #37→68 · #38→69 · #39→70 · #40→71 · #41→72 · **#42→73~78** · **#43→79~86** · #44→87 · #45→88 · #46→89 · #47→90 · #48→91 · #49→92 · #50→93 · #51→94 · #52→95 · #53→96 · #54→97 · #55→98 · #56→99 · #57→100 · #58→101 · **#59→102~108** · #60→109 · #61→110 · #62→111 · **#63→112~114** · #64→115 · #65→116 · #66→117 · #67→118 · #68→119 · #69→120 · **#70→121~130** · #71→131 · **#72→132~135** · #73→136 · #74→137 · #75→138 · #76→139 · #77→140 · #78→141 · #79→142 · #80→143 · #81→144 · #82→145 · **#83→146~154** · #84→155 · #85→156 · #86→157 · #87→158 · #88→159 · **#89→160~162** · #90→163 · #91→164 · #92→165 · #93→166 · **#94→167~170** · #95→171 · #96→172 · #97→173

| 순서 | 무엇 | 구역 | 옮길 줄(약) | 새 파일 | 밖에서 쓰는 이름 / 받아야 할 이름 | 위험 | 먼저 볼 검사 |
|---|---|---|---:|---|---|---|---|
| 1 ✅ | 📅 스케줄러 · 🔔 일정 알림 | (옛 #29 #30) | 1,204 | `scheduler.js` (features) | **옮김** — 내놓는 이름 8개(`renderSchedCalendar` · `renderDdays` · `subscribeMonth` · `setDdays` · `setDdaysVisit` · `refreshBellBadge` · `renderBellList` · `isBellOpen`), 부르는 곳은 #29(친구 탭 D-day 구독 · 수령함 · 공지) · #30(마이홈 관람) / 받는 이름(deps) 12개. `BELL_SEEN_KEY` 는 #67 로그아웃 지움 목록이 같이 써서 app.js 에 둠 · 연결은 #28 끝(원래 자리) | 낮음 | `sim-scheduler`(신설) · `smoke`(scheduler.js 먼저 평가) — `sim-win-layers` · `sim-win-front` 는 그대로 초록 |
| 2 ✅ | 👑 달성표 (규칙 + 화면) | (옛 #109 #110) | 1,188 | `weekly-challenge.js` (entities 규칙 + widgets 화면 — 한 파일) | **옮김** — 내놓는 이름 6개(`syncChalToServer` · `open` · `isOpen` · `focusTick` · `setKeyPlatform` · `resetMemory`) + 검사용 `calc` · `tick` · `state`, 부르는 곳은 #61(런처 동기화) · #67(로그아웃 flush · 메모리 지우기) · #94(활성 앱 판정) · pomodoro.js(뽀모 서랍 — 6번) / 받는 이름(deps) 13개. `CHAL_KEY` 는 #67 로그아웃 지움 목록이 같이 써서 app.js 에 둠 · 다시 대입되던 `chalRec` · `_chalDirty` · `_chalKeyPlatform` 은 `resetMemory` · `setKeyPlatform` 으로 · 연결은 #94 끝(원래 자리) | 낮음 | `sim-weekly-challenge`(신설) · `smoke`(먼저 평가) · `sim-pomodoro` · `sim-mobile-focus` · `sim-account-switch` · `sim-keysof-twin`(weekly-challenge.js 를 읽게) — `sim-google-login` 은 그대로 초록 |
| 3 ✅ | 📷 스티커사진 창 | (옛 #46 ~ #52) | 2,623 | `purikura-ui.js` (pages · `purikura-net.js` 옆) | **옮김** — 내놓는 이름 4개(`open` · `close` · `isOpen` · `phase`) + 세션 콜백 넷(`onPeers` · `onMeta` · `onPeerEvent` · `onShot`) + 검사용 `state` · `deco`, 부르는 곳은 #12(때리기 'b' 조준 키) · #42(📷 버튼 — 대화창 버튼 연결) · #65(회사원 모드 켜기) · #40(세션 입구 `_purikura()` 의 콜백) / 받는 이름(deps) 31개 — 대부분 캐릭터 리그 · 애니메이션 도우미(#84 #13 #16). 다시 대입되는 `officeMode` · `_plPlaying` 과 뒤에 선언되는 const(`Presence` · 리그 상수 넷)는 읽는 함수로 · 세션 입구 `_purikura()` · `_pkSession` 은 #40(🎲 주사위)에 남김(주사위 · 📷 버튼도 씀) · 연결은 #40 끝(원래 자리) | 중간 | `sim-purikura-ui`(신설) · `smoke`(먼저 평가) · `sim-purikura-stage` · `-deco` · `-fish` · `sim-pk-fit` · `sim-fix-0923`(purikura-ui.js 를 읽게) |
| 4 ✅ | 📖 방명록 (새 글 배지 + 독립 팝업 창) | (옛 #34 ~ #36) | 475 | `guestbook.js` (pages) | **옮김** — 내놓는 이름은 예전처럼 window 고리 7개(`_mhGbStartWatch` · `_mhGbStopWatch` · `_mhGbRefreshBadge` · `_mhGbMarkAllRead` · `_mhReSubscribeGuestbook` · `openMyGuestbook` · `_mhGbRefreshWriteUI`) — 부르는 여덟 곳(#29 친구 목록 구독 · 마이홈 열기 · 닫기 · #30 관람 시작 · 끝 · #61 런처로)은 typeof 로 보고 부르므로 그대로(scheduler.js 의 `_closeBellWin` 과 같은 방식) · 반환값도 같은 함수 7개 / 받는 이름(deps) 8개. 다시 대입되는 `_mhViewingUserId` · `_myHomeFriends` 는 읽는 함수로 · `showChatBubble` 은 **남김**(말풍선 widgets — 7개 구역이 쓴다 · 지금은 #31 끝) · 연결은 #31 끝(원래 자리) | 낮음 | `sim-guestbook`(신설) · `smoke`(먼저 평가) · `sim-child-theme`(guestbook.js 를 읽게) — `sim-win-front` 는 그대로 초록 |
| 5 ✅ | 👥 친구 관리 칸 · 🐞 버그 제보 탭 링크 | (옛 #29) | 494 | `friend-manage.js` (widgets) · 버그 탭 62줄은 `bug-board-ui.js` 끝 | **옮김** — 내놓는 이름 11개(`showFriendRequestPopup` · `reqVisible` · `renderFriendManage` · `renderFriendRequests` · `refreshFriendReqBadge` · `lookupName` · `bulkAccept` · `bulkReject` · `setTab` · `tab` · `picked`) + 검사용 `acceptOne` · `seatsLeft`, 부르는 곳은 모두 #29(요청 구독 · 마이홈 열기 · 탭 전환 · 친구 코드 추가 · 서브탭 · 일괄 처리 바 — 열다섯 줄, `friendManage.이름`) / 받는 이름(deps) 10개. 다시 대입되는 `_myFriendRequests` · `_myHomeFriends` · `myHomeOpen` 은 읽는 함수로 · 다시 대입되던 `_fmTab` 은 `setTab` · `tab` 으로 · `FRIEND_MAX` 는 #28 에 남김(다섯 곳이 본다 · 값으로 넘김) · 🐞 버그 제보 탭은 `createXxx` 없이 bug-board-ui.js 끝 맨 앞 칸(게시판 화면과 같은 방식 · app.js 뒤지만 firebase-init(module) 앞이라 구독 때가 같다) · 연결은 #28 끝(원래 자리) | 낮음 | `sim-friend-manage-module`(신설) · `smoke`(먼저 평가) · `sim-friend-manage` · `sim-gift-star`(friend-manage.js 를 읽게) · `sim-scheduler`(자리 기준) — `sim-bug-board` 는 그대로 초록 |
| 6 ✅ | 🍅 뽀모도로 | (옛 #98 앞머리) | 176 | `pomodoro.js` (features) | **옮김** — 옛 #98 948줄 가운데 뽀모 몫인 앞머리 176줄(상태 · 구간 넘기기 · 서랍 그리기 · 버튼 연결)만. 밖에서 부르는 곳은 #87(📊 오늘 기록 전시의 `_focusShowConf`) 한 곳 — 만드는 줄보다 먼저(로드 중) 불려 반환값을 볼 수 없어서 예전처럼 window 고리 `_pomoShowText` + typeof 가드(guestbook.js 와 같은 방식) · 반환값은 같은 함수 + 검사용 `open` · `render` · `tick` · `cfg` · `run` / 받는 이름(deps) 4개(`toast` · `_focusShowPush` 는 화살표, `weeklyChal` · `_pomoSnd` 는 앞에 선언된 const 값). 알림음 풀 `_pomoSnd` 는 #12 효과음 공장에 남김(자동재생 잠금 해제 등록보다 앞이어야 한다) · 지도에 «42개» 로 적었던 입력 판정 · 프레임 상한 몫과 `myHomeOpen` · `applyDesktopRunClass` · 데스크탑 모드 772줄은 뽀모가 아니라 **남김** → 머리가 빠져 #94 에 붙음 · 연결은 👑 달성표 연결 바로 뒤(#94 · 원래 자리) | 낮음 | `sim-pomodoro-module`(신설) · `smoke`(먼저 평가) · `sim-pomodoro` · `sim-weekly-challenge`(pomodoro.js 를 읽게) |
| 7 ✅ | 🎨 마이홈 스티커 관리 창 · 스티커 편집 | (옛 #32 의 두 덩이) | 255 | `myhome-sticker.js` (widgets) | **옮김** — 옛 #32 1,481줄 가운데 스티커 몫 두 덩이(관리 창 119줄 · 편집모드 · 드래그 · 회전 · 크기 136줄)만. 내놓는 이름 9개(`open` · `close` · `render` · `bringIn` · `editStart` · `editEnd` · `bindDrag` · `bindRotate` · `bindResize`), 부르는 곳은 #31(`renderMyHomeStickers` 의 편집 시작 · 끝 · 핸들 셋 · [+ 스티커] · 새 스티커 붙이기) · #29(마이홈 닫기) 여덟 줄 — 모두 마이홈을 연 뒤에 돌아 `myHomeSticker.이름` / 받는 이름(deps) 18개 — 함수 10개는 화살표(`renderMyHomeStickers` 는 `bindMyHomePage` 가 감싸 다시 대입 · `commitMyHomePage` 는 window 이름), 다시 대입되는 `_myHomeData` · `_mhViewingUserId` · `_mhStickerEditSid` 는 읽는 함수, `_mhStickerEditSid` · `_mhStickerDragDist` 에 쓰는 것은 쓰는 함수(둘 다 #31 `renderMyHomeStickers` 가 읽어서 app.js 에 둠), `STICKER_*` 셋은 값. 🔗 마이홈 본문 링크 · 마이홈 페이지 편집 묶음(`bindMyHomePage`) · 📖 방명록 연결 · `showChatBubble` 은 **남김** → 머리가 빠져 #31 에 붙음(7-2) · 연결은 `renderMyHomeStickers` 뒤(#31 · 원래 자리) | 낮음 | `sim-myhome-sticker`(신설) · `smoke`(먼저 평가) — `sim-myhome-load` 는 그대로 초록 |
| 7-2 ✅ | 🏠 마이홈 페이지 편집 묶음 · 👑 디자인 스튜디오 · 프리셋 | (#31 뒤쪽 `bindMyHomePage`) | 1,167 | `myhome-edit.js` (widgets — 디자인 스튜디오 · 프리셋도 한 파일) | **옮김** — 즉시 실행 함수 하나(`bindMyHomePage`)의 본문 1,165줄을 글자 그대로(들여쓰기도). 디자인 스튜디오 · 프리셋(약 470줄)은 따로 떼지 않았다 — [✎ 마이홈 수정] 버튼(묶음 앞쪽)이 `_mhOpenDesignStudio` 를, 스튜디오가 `commitMyHomePage` · `_mhOpenColorPopup` 을 이름으로 부르는 한 몸이라 나누면 글자 그대로가 깨진다. 바뀐 줄 69 — 다시 대입되는 let(`_myHomeData` · `_mhViewingUserId` · `_myHomeLoaded` · `_myHomeUid` · `_mhStickerDragDist` · `isPremium` · `isAdmin`)은 읽는 함수, `_myHomeLoaded = false` · `_mhStickerDragDist` 쓰기는 쓰는 함수, 묶음보다 한참 뒤에 선언되는 `USER_NAME_MAX` 는 읽는 함수(값이면 TDZ), `renderMyHomeStickers` 감싸기는 감싸기 전 함수를 값으로 받고(`getRenderMyHomeStickers` — 화살표면 무한 재귀) 감싼 함수를 `setRenderMyHomeStickers` 로 되돌려 넣는다. 밖으로는 예전처럼 window 고리 11개(`commitMyHomePage` · `_mhOpenColorPopup` · `_mhBeginNameEdit` · `_mhCancelNameEdit` · `_mhBgmRefresh` · `_mhBgmPlaying` · `_mhBgmSetPlaying` · `_bgmDestroy` · `_mhApplyBg` · `_mhApplyTheme` · `_mhDsClose`) — app.js · myhome-sticker.js · purikura-ui.js 가 그 이름으로 부르므로 부르는 곳은 안 고쳤다. 반환값 13개는 검사용(`commit` · `openDesignStudio` · `presets` …) / 받는 이름(deps) 34개 — 함수 15는 화살표, 읽는 함수 9 · 쓰는 함수 3, `myHomeSticker` · `STICKER_*` 둘 · `DS_IMG_*` 넷은 앞에 선언된 const 라 값. 연결은 원래 자리(🔗 마이홈 본문 링크 뒤 · 📖 방명록 연결 앞) | 중간 | `sim-myhome-edit`(신설) · `smoke`(먼저 평가) · `sim-myhome-load` · `sim-child-theme` · `sim-fix-1008` · `sim-myhome-sticker` · `sim-purikura-deco`(새 파일을 읽게) — `sim-myhome-steps` 는 그대로 초록 |
| 8 ✅ | 🎰 가챠 코어 · 보관함 · 뽑기 창 | (옛 #90 #91) | 1,213 | `gacha.js` (entities 규칙 + widgets 화면 — 한 파일) | **옮김** — 옛 #90 · #91 두 구역 1,217줄 가운데 저장 키 세 줄을 뺀 전부(달성표처럼 한 파일 — 보관함 · 뽑기 창이 코어 이름 스무 개 가까이를 그대로 써서 나누면 글자 그대로가 깨진다). 내놓는 이름 16개(`isGachaPart` · `isGachaColorUnlocked` · `gachaCount` · `sceneHasColorGroup` · `DUPES_FOR_COLOR` · `syncGachaToServer` · `pruneUnownedGachaParts` · `renderGachaInv` · `toggleGachaInv` · `isInvOpen` · `isDrawOpen` · `selId` · `owned` · `bonus` · `setBonusLocal` · `resetMemory`) + 검사용 `draw` · `pool` · `state` 등, 부르는 곳은 #26(T 키 · 꾸미기 커밋 · 미리보기 색상 영역) · #43(파츠 등록 · 색 없는 파츠 판정 · 꾸미기 창 거르기) · #61(런처) · #67(로그아웃 flush · 검문 · 메모리 지우기) · #70(연동 pull) · #83(카탈로그 도착 · 썸네일 · 라이선스 접기) · #94(👑 달성표 deps) 스물몇 줄 — 부팅 중 먼저 불리는 곳이 없어(smoke · 헤드리스 main 계측) typeof 고리 대신 `gachaMod.이름` / 받는 이름(deps) 40개 — 함수 28은 화살표, 다시 대입되는 `isAdmin` · `savedParts` · `PART_CATS` · `wdDraftDef` · `activeWdAdj` 는 읽는 함수(+ `activeWdAdj` 쓰는 함수), `seats` · `slots` · `Presence` · 저장 키 셋은 값. 두 구역 사이의 🔑 쓰기 거부 안내(`_warnServerWriteDenied` — 캐릭터 슬롯도 부른다)와 저장 키 세 줄(계정 전환 지움 목록)은 **남김** → 머리가 빠져 #89 에 붙음 · 연결은 옛 #90 머리 자리(원래 자리) · 예전부터 window 에 걸던 `openGachaInv` · `closeGachaInv` · `_gachaRestorePos` 는 그대로 | 높음 | `sim-gacha`(신설) · `smoke`(먼저 평가) · `sim-gacha-prune` · `sim-gacha-race` · `sim-part-color-entry`(gacha.js 를 먼저 평가) · `sim-account-switch` · `sim-key-input` · `sim-weekly-challenge`(gachaMod) — `sim-slot-sync` 는 그대로 초록 |
| 9 ✅ | 📄 엑셀 라이선스 일괄 발급 · 🔒 시크릿룸 발급 (관리자) | #132 #133 | 681 | `admin/admin-license-bulk.js` (features · 관리자 폴더) | **옮김(관리자 코드 admin 폴더 1번)** — 두 구역 680줄을 글자 그대로 `app/parts/admin/` 으로. deps 7개(`escHtml` · `toast` · `_genLicenseKey` · `_saveFailMsg` · `renderLicenseGenList` · `downloadBlob` · `_srFmtDate`) · 밖에서 부르는 이름 0. 처음 계획: 밖에서 쓰는 이름 **0** — 둘 다 버튼을 거는 즉시 실행 함수(`bindLicenseXlsxBulk` · `bindSecretRoomGrant`)와 그 도우미(`_lx*`)뿐 / 받는 이름 약 10개 — `escHtml`(#48) · `_genLicenseKey`(#101) · `renderLicenseGenList`(#130) · `downloadBlob`(#153) · `_saveFailMsg` · `toast`(#154) · `genRoomCode` · `_srFmtDate` · `_mySecretRoomCode` · `_refreshSecretRoomUI`(#115 — 방 서버 provider 안). 연결은 #131 끝(원래 자리) | 낮음 | `sim-license-xlsx`(`_lx*` 를 app.js 에서 읽는다 → 새 파일) · `smoke` |
| 10 ✅ | 🙋 투게더룸 친구 초대 · 🚪 방 초대 받기 | #172 | 268 | `room-invite-ui.js` (features) | **옮김** — 머리 아래 본문 268줄(즉시 실행 함수 `bindRoomInvite` · 받기 `_bindRoomInviteReceiver` · 팝업 `showRoomInvitePopup` · 깜빡임 `_flashTaskbar` · 상수 둘 · 부팅 때 수신을 거는 두 줄)을 글자 그대로(들여쓰기도). 바뀐 줄 1 — `_myHomeFriends`(#44 · 다시 대입되는 let)를 읽는 함수로(`_myHomeFriends()`). 밖에서 쓰는 이름 **0**(반환값 `showPopup` · `busy` 는 검사용) / 받는 이름(deps) 9개 — 함수 7개(`toast` · `escHtml` · `getMyUserId` · `getDisplayName` · `startRoom` · `doLeaveRoom` · `_friendInRoom`)는 화살표, `_myHomeFriends` 는 읽는 함수, `Presence`(#113)는 앞에 선언된 const 라 값. 지도에 적었던 `resize` 는 받지 않는다 — 본문의 `addEventListener('resize', …)` 는 window 이벤트다. 연결은 원래 자리(INIT 뒤 · 머리는 그대로) — 만들 때 창 버튼 · 끌기 · resize 를 걸고 수신 구독(또는 firebase-ready 기다림)이 예전과 같은 때 돈다 | 낮음 | `sim-room-invite-ui`(신설) · `smoke`(먼저 평가) · `sim-room-invite-wait`(room-invite-ui.js 를 읽게) |
| 11 ✅ | 🚩 신고하기 | #160 | 190 | `report.js` (features) · 관리자 목록은 `admin/admin-report.js` | **옮김** — 신고 창 · 공용 도우미 · 팝업 칸은 report.js(바뀐 줄 0), 관리자 신고 목록은 admin-report.js(팝업 칸 · isAdmin 은 읽는 · 쓰는 함수 · 바뀐 줄 6). 메뉴는 `reportMod.openDialog`. 처음 계획: 밖에서 쓰는 이름 1개 — `_openReportDialog` ← #87(DRAG / PET 우클릭 메뉴 · 사람이 누를 때만이라 반환값 `report.openDialog`) / 받는 이름 약 8개 — `_reportHiddenUids` · `_reportHiddenSave`(#9 숨기기) · `_seatLabelName`(#85) · `_awayUrlOk`(#159) · `getDisplayName`(#115) · `getMyUserId` · `MY_FRIEND_CODE_KEY`(#6) · `isAdmin`(#99 — 읽는 함수) | 낮음 | `sim-report-away`(신고 상수 · 창 함수를 app.js 에서 읽는다 → 새 파일) · `smoke` |
| 12 ✅ | 🧹 관리자 콘솔 도구 (F12) | #149 | 146 | `admin/admin-console.js` (features · 관리자 폴더) | **옮김(관리자 코드 admin 폴더 2번)** — 본문 144줄 글자 그대로 · 바뀐 줄 4(카탈로그 목록 셋을 읽는 함수로) · 콘솔 함수 일곱은 예전처럼 window. 처음 계획: 밖에서 쓰는 이름 **0** — 전부 `window.X = async function` 콘솔 함수 7개(`analyzeCatalog` · `cleanupGhostRooms` · `reclaimInvitesSince` · `migrateCatalog*` …)라 이름이 그대로 / 받는 이름 2개 — `savedParts`(#146) · `savedDesks`(#145) — 둘 다 다시 대입되는 let 이라 읽는 함수 + `firebaseAPI` · `toast` | 낮음 | 읽는 검사 없음 — `smoke` 만(새 검사 `sim-admin-console` 로 window 이름 일곱 개 확인) |
| 13 ✅ | 🕒 포커스 기록 팝업 | #37 | 125 | `focus-log.js` (widgets) | **옮김** — 머리 아래 본문 125줄(설명 한 줄 · 즉시 실행 함수 `bindFocusLog` — 미니미 `_ □` · 현재 / 누적 · 오늘 기록 · 매초 갱신 · ESC · 타이틀바 끌기)을 글자 그대로(들여쓰기도). 바뀐 줄 2 — `_focusTotalSec` · `_focusSessionSec`(#157 · 다시 대입되고 만드는 줄보다 한참 뒤에 선언되는 let)를 읽는 함수로(`_focusTotalSec()` · `_focusSessionSec()`). 밖에서 쓰는 이름 **0**(반환값은 빈 객체) — 👑 달성표 · 🍅 뽀모 서랍이 부르는 `window._focusLogClamp` 는 예전처럼 만들 때 건다 / 받는 이름(deps) 6개 — 함수 4개(`formatHMS`(#166) · `_rolloverFocusToday`(#157) · `bringWinToFront` · `escRegisterWindow`(#24))는 화살표, let 둘은 읽는 함수. 지도에 적었던 `_focusTodaySec` 는 받지 않는다 — 본문은 주석에서만 말하고 값은 `_rolloverFocusToday()` 로 읽는다. 연결은 원래 자리(광고 배너 설정 묶음 뒤 · 머리는 그대로) — 만들 때 버튼 · ESC 등록 · 매초 갱신 · 끌기가 예전과 같은 때 걸린다 | 낮음 | `sim-focus-log`(신설) · `smoke`(먼저 평가) — `sim-win-front` · `sim-pomodoro` · `sim-pomodoro-module` · `sim-focus-show` · `sim-weekly-challenge` 는 그대로 초록 |
| 14 ✅ | 💬 대화창 배선 | #74 | 334 | `chat-window.js` (widgets) | **옮김** — 머리 아래 본문 334줄(설명 한 줄 · 즉시 실행 함수 `_wireChatWindow` — 닫기 · ▁ 최소화 · 타이틀바 끌기 · 8방향 크기 · 파일 · 설정(글자 크기 · 🔔 알림음 · ▶) · 🧹 지우기 메뉴 · 🌫️ 투명도 · ESC · 입력 Enter · 링크 · 🌊 날리기 · 🔇 잠금 · 🗑 기록 삭제 · 😊 이모티콘 · 🎲 · 💣 · 📷)을 글자 그대로(들여쓰기도). 바뀐 줄 8 — 읽는 함수 `officeMode()`(두 줄 · #156 · 만드는 줄보다 뒤에 선언) · `isAdmin()`(#99 · 뒤에 선언) · `_flyAiming()`(#11) · `_emojiCache()`(#70), 쓰는 함수 `_setChatFlyOn(x)` · `_setChatFlySize(x)` · `_setChatFlyColor(x)`(#63 세션 변수). 밖에서 쓰는 이름 **0**(반환값은 빈 객체) / 받는 이름(deps) **49개** — 대화창 코어 9(#65 #68 #69 · `toast`) · 기록 3(#65 #69) · 투명도 · 글자 5(#49) · 알림음 6(#50) · 날리기 8(#63 · `getFocusLevel` #161 · `isAdmin`) · 잠금 · 삭제 4(#67) · 이모티콘 6(#70) · 주사위 1(#72) · 💣 5(#11 · `FLY_MIN_LEVEL` #8 · `seats` #6 · `officeMode`) · 📷 2(#71). 함수 37 은 화살표, 상수 셋 · `seats` · `purikuraUi` 는 값. 채팅 구역을 먼저 옮기지 않고 deps 로 받았다. 연결은 원래 자리(🔫 러시안룰렛 뒤 · 머리는 그대로) — 만들 때 버튼 · 메뉴 · 끌기 · 저장값 반영 · 복사 · 탭 묶기가 예전과 같은 순서 · 같은 때 | 중간 | `sim-chat-window`(신설) · `smoke`(먼저 평가) · 옮긴 글을 읽던 `sim-chip-chat-ui` · `sim-chat-sfx` · `sim-mac-0923` · `sim-purikura-deco` · `sim-purikura-ui` 는 chat-window.js 도 읽게(판정 무변경) |
| 15 ✅ | 📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록 | #47 #51 #52 #53 | 560 | `myhome-inbox.js` (widgets) | **옮김** — #47 의 함수(공용 공지 읽음 · 합치기 · 안 읽은 수 · 우편함 탭 배지)와 필터 상태 둘 · #51 sanitize 사이에 끼어 있던 친구 방 표시 둘(`_friendRoomTag` · `_friendInRoom`) · #52 친구 목록 · Ctrl+F 검색 · #53 수령함 · 선물함 그리기 — 560줄을 글자 그대로(들여쓰기도). 바뀐 줄 14 — 읽는 함수 `_myInbox()` · `_inboxBroadcast()`(수령함 · 공지 구독이 다시 대입) · `_myHomeFriends()`(친구 구독) · `isAdmin()`(#99 · 만드는 줄보다 뒤에 선언). 지도에 적었던 «수령함 구독이 `_myInbox` · `_myInboxReady` · `_inboxBroadcast` 에 쓴다 → 쓰는 함수» 대신 그 셋을 app.js(#47 머리 아래)에 남기고 읽는 함수로 넘겼다 — 쓰는 곳(#46 구독 · #161 춤 해금 안내)이 모두 app.js 라 `_myHomeFriends` 와 같은 방식이 바뀌는 줄이 적다. `INBOX_BC_READ_KEY` 도 #118 로그아웃 지움 목록이 같이 써서 app.js 에(값으로). 모듈 상태는 `_mhSelectedFriend` · `_friendFilter` · `_inboxFilter` · `_inboxOpenId` 넷 — #54 가 쓰던 셋은 `setInboxFilter` · `setInboxOpenId` · `setFriendFilter`. 내놓는 이름 **17개**(`renderMyHomeFriendList` · `friendSearchToggle` · `setFriendFilter` · `friendRoomTag` · `friendInRoom` · `renderInbox` · `setInboxFilter` · `setInboxOpenId` · `inboxTagLabel` · `inboxTimeStr` · `inboxUnreadCount` · `inboxBcMarkAllRead` · `refreshFriendTabBadge` · `linkifyText` · `bindExtLinks` · `renderGiftBox` · `giftStat`) + 검사용 `inboxMerged` · `inboxUnreadReward` · `mhHl` · `mhAsk` · `state`, 부르는 곳은 #44(스케줄러 · 친구 관리 deps) · #46(구독) · #54(버튼 연결 · 마이홈 열고 닫기) · #130(업데이트 공지 팝업) · #172(방 초대 deps) · 🏠 놀러 가기 연결 — 전부 만드는 줄보다 늦게 돌아 `inboxMod.이름`(예전 typeof 가드는 `typeof inboxMod.이름` 으로) / 받는 이름(deps) **18개** — 함수 10은 화살표, let 넷은 읽는 함수, `INBOX_BC_READ_KEY` · `FRIEND_MAX` · `mhScheduler` · `friendVisit` 은 앞에 선언된 const 라 값. 연결은 #52 머리 아래(원래 자리) — 🏠 친구 방 놀러 가기 연결(`friendVisit` · 예전 그대로 그 자리)은 남기고 방 코드만 `inboxMod.friendRoomTag` 로, 그 바로 뒤에서 만든다. #52 · #53 머리는 구역 번호가 밀리지 않게 남겼다(#53 은 안내 한 줄) | 중간 | `sim-myhome-inbox`(신설) · `smoke`(먼저 평가) · `audit.py`(검사 8 · 검사 19 ④ 시야) · 옮긴 글을 읽던 `sim-gift-star` · `sim-bug-board` · `sim-fix-1008b` · `sim-friend-visit` · `sim-broadcast-cache` · `sim-mh-sanitize` · `sim-friend-manage` 는 myhome-inbox.js 도 읽게 · `sim-room-invite-ui` 는 deps 줄 모양만(판정 무변경) — `sim-friend-manage-module` · `sim-myhome-steps` · `sim-dance-unlock-mail` · `sim-account-switch` 는 그대로 초록 |
| 16 ✅ | 🎵 플레이리스트 (데이터 · 화면 · 고르기 · 재생 감시견) | #27 #28 #31 #32 #33 | 1,839 | `playlist.js` (entities 데이터 + widgets 화면 + features 재생 — 한 파일) | **옮김** — 다섯 구역 1,839줄(사이의 #29 👤 머리 · #30 🏅 레벨 티어는 남김 — 레벨 배지는 친구 목록 · 좌석도 씀)을 글자 그대로(들여쓰기 · 구역 머리 주석까지). 바뀐 줄 3 — 읽는 함수 `_myHomeLoaded()` · `_myHomeData()`(#55 · 만드는 줄보다 뒤에 선언) · `_myHomeFriends()`(#46 친구 구독). 지도에 적었던 «상태 묶음 getter · setter» 대로 **상태는 모듈에 두고**(모듈 안에서 수백 번 읽고 써서 app.js 에 남기면 바뀌는 줄이 훨씬 많다) 밖에서 쓰던 열세 칸(`sets` · `cur` · `nowSet` · `sel` · `now` · `view` · `nowView` · `bio` · `homePublic` · `private` · `pubSig` · `playing` · `lastBoundsKey`)을 상태 묶음 `plMod.st`(getter · setter)로 — #121 계정 이어받기 복원은 `const pl = plMod.st` 한 줄을 더하고 `_plX = …` → `pl.x = …` 로 줄 모양 그대로, #118 로그아웃 지우기 한 줄 · #71 📷 재생 재우기(`plMod.st.playing`) · #36 화면 배율(`plMod.st.lastBoundsKey`). 내놓는 이름 **15개**(`st` · `PL_MAX` · `PL_BIO_MAX` · `PL_TITLE_MAX` · `render` · `save` · `publish` · `normalizeSets` · `setIdx` · `blankSets` · `pubSigOf` · `mine` · `fillLv` · `ytVideoId` · `syncBgmBounds`) + 검사용(`load` · `state` · `playFrom` · `next` · `watchTick` …), 부르는 곳은 #36(설정 › 화면 배율) · #61(🏠 마이홈 BGM deps `ytVideoId`) · #71(📷 deps) · #118(로그아웃) · #120(👤 내 정보 배지 `fillLv`) · #121(계정 이어받기) — 전부 만드는 줄보다 늦게 돌아 `plMod.이름`. #25 상태칩 팝업 자리(`_repositionOpenChipPopups` — 만드는 줄보다 **위**에 선언) · noise.js 가 typeof 를 걸고 부르는 `_plHasSavedPos` · `_plApplyPos` · `_plSyncBgmBounds` 는 모듈이 **window 고리**로도 건다(부르는 줄 무변경) / 받는 이름(deps) **20개** — 함수 17은 화살표, let 셋은 읽는 함수. 연결은 #27 머리 아래(원래 자리) — 만들 때 예전 `bindMyPlaylist` 가 하던 일(저장값 읽기 · 버튼 · ESC · 끌기 · 미니미 · 300ms 폴링 · BGM 신호 구독 · 음량 한 번 · 🪟 창 위치 초기화 등록)이 돈다. 예전엔 #33 끝에서 돌았지만 그 사이(#29 · #30)는 선언뿐이라 다른 일과의 순서는 같다. #28 · #31 · #32 · #33 머리는 구역 번호가 밀리지 않게 한 줄 머리로 남겼다(아래는 안내) | 높음 | `sim-playlist`(신설) · `smoke`(먼저 평가) · `audit.py`(검사 8 · 검사 19 ④ 시야) · 옮긴 글을 읽던 `sim-pl-loop` · `sim-pl-next` · `sim-pl-watchdog` · `sim-win-layers` · `sim-focus-cap` 은 playlist.js 도 읽게 · `sim-pl-grab-pick` 은 playlist.js 를 먼저 평가하고 plMod 로 · `sim-account-switch` 는 스텁을 plMod 통로로 · `sim-signup` · `sim-purikura-ui` · `sim-myhome-edit` 는 부르는 줄 모양만(판정 무변경) — `sim-noise` · `sim-purikura-deco` 는 그대로 초록 |

1 ~ 8 을 다 하면 약 9,400줄(app.js 의 20%)이 빠진다. 1번으로 46,147 → 44,966줄(1,181줄 — 옮긴 1,204줄 − 연결 23줄),
2번으로 44,966 → 43,799줄(1,167줄 — 옮긴 1,188줄 − 연결 21줄),
3번으로 43,799 → 41,217줄(2,582줄 — 옮긴 2,623줄 − 연결 41줄),
4번으로 41,217 → 40,761줄(456줄 — 옮긴 475줄 − 연결 19줄),
5번으로 40,761 → 40,288줄(473줄 — 옮긴 494줄 − 연결 21줄),
6번으로 40,288 → 40,126줄(162줄 — 옮긴 176줄 − 연결 14줄),
7번으로 40,126 → 39,900줄(226줄 — 옮긴 255줄 + 사이 빈 줄 1 − 연결 30줄),
8번으로 39,900 → 38,741줄(1,159줄 — 옮긴 1,213줄 + 사이 빈 줄 1 − 연결 55줄),
7-2번으로 38,741 → 37,622줄(1,119줄 — 옮긴 1,167줄 − 연결 48줄),
구역 머리만 단 PR 로 37,622 → 37,698줄(+76 — 머리 주석만 · 코드 무변경),
그 뒤 다른 PR 들로 37,698 → 37,876줄,
10번으로 37,876 → 37,627줄(249줄 — 옮긴 268줄 − 연결 19줄),
13번으로 37,627 → 37,517줄(110줄 — 옮긴 125줄 − 연결 15줄),
14번으로 37,517 → 37,245줄(272줄 — 옮긴 334줄 − 연결 62줄),
15번으로 37,245 → 36,718줄(527줄 — 옮긴 560줄 − 연결 33줄),
16번으로 36,718 → 34,927줄(1,791줄 — 옮긴 1,839줄 − 연결 · 머리 · 안내 48줄),
그 뒤 #157(⚙️ 원격 설정)로 34,927 → 34,967줄,
9번(관리자 코드 admin 폴더 1번)으로 34,967 → 34,303줄(664줄 — 옮긴 680줄 − 연결 · 안내 16줄).
9 ~ 15 는 쓰임이 적은 구역(머리를 새로 달아 드러난 것 위주)이라 모두 해서 약 2,300줄, 16(플레이리스트)까지 하면 약 4,100줄이 더 빠진다.

**관리자 코드는 `app/parts/admin/` 에 모은다** (2026-10-14~) — 웹 관리자와 겹치는 기능 걷기(#140, 닫음)보다 먼저, 관리자 몫을 동작 그대로 이 폴더로 옮긴다.
나중에 걷을 때 파일 몇 개만 지우면 되게. 1번 = 위 순서표 9번(`admin-license-bulk.js`). 2번 = 순서표 12번(`admin-console.js`). 3번 = 라이선스 발급 · 공지 · 카테고리 관리(`admin-license.js` · `admin-notice.js` · `admin-category.js` — 옛 #130 의 관리자 몫 · #131, app.js 34,167 → 33,773줄). 4번 = 파츠 · 책상 · 아이템 등록 창 · 파츠 삭제(`admin-part-register.js` — #81 · #82, 값 열세 개는 읽는 함수 · app.js 33,773 → 33,385줄). 5번 = 📊 통계 · 🎟️ 초대권 지급(`admin-users.js` — 초대 창 안쪽) · 🛑 방 종료 · 🧹 유령 방 · ⚙️ 게임 설정 · 📢 광고 배너 편집(`admin-launcher.js`), app.js 33,385 → 33,168줄. 🚩 신고 목록은 FSD 11번(신고하기)과 같이. 6번 = 📦 책상·아이템 코드 · 🎁 커미션 캐릭터 · 🔐 암호화 GLB 불러오기(`admin-asset.js` — 흩어진 덩이 셋). 7번 = 🔐 관리자 모드 진입(`admin-mode.js` — isAdmin 을 바꾸는 단 한 곳 · setIsAdmin). 관리자 신고 목록은 FSD 11번과 함께(`admin-report.js`). 순서표 1 ~ 16 · 관리자 1 ~ 7 끝(2026-10-14) — 남은 구역은 새 순서표. 다음 후보: 🧹 관리자 콘솔 도구(12번) · 🛠️ 라이선스 발급 · 공지 · 업데이트 안내 · 📁 카테고리 관리 ·
🛠️ 파츠 · 책상 · 아이템 등록 창 · 광고 배너 · 게임 설정 편집 · 통계 · 커미션 생성 · GLB 불러오기 · 관리자 모드 진입. 검사 러너는 `parts/admin/` 을 깊은 자리에서 이름으로 끌어올리고, `sim-ui-tokens` · `audit.py` · `smoke` 는 그 자리도 본다.

**0단계(선택 · 위와 따로 해도 된다)** — shared 도구(효과음 공장 #13 · 창 겹침 #24 · `escHtml` #48 · HTML sanitize #51 · `asyncPrompt` #58 · 토스트 #154)를
app.js 앞에 싣는 작은 파일로 옮기면 전역 이름이 그대로라 부르는 곳을 안 고쳐도 되고, 뒤 단계의 deps 가 짧아진다. 이제 다 제 머리가 있어 경계가 분명하다.

**쪼갠 것 ✅ (구역 머리만 새로 단 PR · 코드 무변경)** — 머리 하나에 여러 기능이 섞여 있던 16개 구역에 기능 경계(함수 묶음이 바뀌는 곳)마다
`/* ═══ 제목 ═══ */` 한 줄을 달았다(76개). 옛 #26 → 10개 · 옛 #29 → 10개 · 옛 #70 → 10개 · 옛 #83 → 9개 · 옛 #43 → 8개 · 옛 #31 → 7개 · 옛 #59 → 7개 ·
옛 #42 → 6개 · 옛 #12 → 4개 · 옛 #72 → 4개 · 옛 #94 → 4개 · 옛 #19 → 3개 · 옛 #63 → 3개 · 옛 #89 → 3개 · 옛 #14 · #24 → 2개씩.

**남은 것** — 머리로 못 나눈 곳과 여러 구역에 흩어진 기능(억지로 묶지 않았다 — 옮길 때 같이 본다).
- 섞임(작게): #36 설정 패널 머리 밑 이동 모드 상태 let 셋(#38 · #39 가 씀) · #126 광고 배너 표시와 편집 사이 ⚙️ 게임 설정.
- 섞임(큼): #170 데스크탑 실행 화면 — `if(desktopMode){ … }` 한 덩이(약 740줄)라 맨 앞 칸 머리로는 못 나눈다. 옮길 때 블록 안(업데이트 배너 · 전역 입력 · 클릭 통과 · 하트비트)을 나눈다.
- 흩어진 기능: 🪄 때리기 #12 · #14(사이에 효과음 공장 #13) · 🔑 라이선스 등록 #124 · #127(사이에 런처 타이틀바 · 광고 배너) ·
  🔄 카탈로그 동기화 설명 주석(#148 머리 밑)과 함수(#150).
- 1,000줄 넘는 #89(꾸미기 파츠 부착 · 1,378줄)는 한 기능이라 그대로 뒀다.

## 옮기는 순서 2차 (17 ~ 33) — 2026-10-14

1차(1 ~ 16)와 관리자 코드 admin 폴더(1 ~ 7 · 신고 목록은 11번과 함께)가 끝났다 — app.js 46,147 → 32,832줄.
**끝의 정의**(2026-10-14 사용자 결정): app.js 에는 **부팅 순서 · 모듈 연결 · 3D 핵심**만 남기고 나머지 기능 구역은 모듈로 옮긴다.
남길 핵심(약 4,000줄 · 쓰임이 수십 곳이라 도메인 폴더를 나눌 때 같이 본다): SETUP #1 · BUILDERS #5 · SEATS #6 · 좌석 크기 #7 ·
좌석 배치 #18 · FIT #20 · USER STATUS #23 · CREATOR + LAUNCHER #90 · 방 접속 상태(Presence) #113 · ANIM #155.

고른 기준은 1차와 같다 — 쓰임(다른 구역이 부르는 수)이 적고 줄 수가 큰 것부터, 한 줄 = PR 하나. 구역 번호는 지금(173개) 번호
(`node scripts/app-sections.js` 로 다시 뽑는다 — 아래 «구역 표» 의 줄 범위는 옛 값이라 번호 · 제목으로 찾는다).

| 순서 | 묶음 | 구역 | 줄(약) | 메모 |
|---|---|---|---:|---|
| 17 ✅ | 🏆 [내 정보] 전체 랭킹 → 🪪 [내 정보] 화면 | #119 #120 | 702 | **옮김** — `my-info.js`(앞 구역 «[내 정보] 런처 화면 전환» 과 한 화면이라 같이) · deps 53 · 내놓는 이름 6 · app.js 32,832 → 32,190줄 |
| 18 ✅ | 🧬 캐릭터 보관함(chars) — 병합 · 이관 · 이관 조율 | #138 #139 #140 | 868 | **옮김** — `chars.js` · deps 29 · 내놓는 이름 25 · 공용 `loadImg` 는 app.js 에 남김 · app.js 32,190 → 31,360줄. 검사용 공용 도우미 `checks/sim-renderer-src.js` 신설(옮길 때마다 MODULES 한 줄) |
| 19 ✅ | ☁️ 슬롯 기기 간 동기화 · 연동 UI | #136 #137 | 662 | **옮김** — `slot-sync.js` · deps 19 · 내놓는 이름 27 + 쓰는 함수 3(로그아웃이 비움) · 서버 쓰기 많음 — 나중 `-net` 통로 후보 |
| 20 ⏸ | 🖼️ 이미지 도장 | #92 | 730 | **미룸** — 본문이 생성기 그리기 핵심(붓 · 지우개 · 피부색 · 카메라 궤도 · bindPaint · loadSkins) · 읽는 함수 31 · 쓰는 함수 21 이 필요 → 생성기(#90 · #105)와 한 묶음으로 도메인 단계에서 |
| 21 ✅ | 🖍️ 파츠에 직접 그리기 · 그림칸 | #43 #77 | 972 | **옮김** — `part-paint.js` · `findMySeat` 는 app.js 에 남김 · animal.js 가 부르는 3개는 «옛 전역 이름» 한 줄씩 · app.js 28,537 → 27,605줄 |
| 22 ✅ | 🏠 마이홈 창 버튼 · 🫧 자리비움 그림 | #54 #159 | 734 | **옮김** — 도메인이 달라 둘로: `away-pic.js`(deps 11 · 내놓는 이름 9) · `myhome-ui.js`(deps 23 · 내놓는 이름 1) · app.js 30,724 → 30,035줄 |
| 23 ✅ | 🔑 구글 로그인 · 신원 지우기 · 계정 이전 흔적 | #117 #118 #121 | 823 | **옮김** — `account.js` · 바뀐 줄 49(대부분 뒤에서 선언되는 저장 키를 읽는 함수로) · app.js 25,067 → 24,292줄 |
| 24 ✅ | 💬 채팅 덩이(읽음 구분선 · 탭 · 복사 · 날리기 · 이모티콘) | #63 #65 #68 #69 #70 | 1,279 | **옮김** — `chat-ui.js` · 대화 기록 캐시 · 구독은 app.js(읽는 · 쓰는 함수) · `DEMOJI_BY_ID` · `DEMOJI_DIR` 은 «옛 전역 이름» · app.js 27,092 → 25,863줄 |
| 25 ✅ | 💃 깜짝쇼 · 🪄 때리기 | #11 #12 #14 | 529 | **옮김** — `tricks.js` · deps 41 · 사이의 효과음 공장 #13 은 app.js(공용) · app.js 30,035 → 29,557줄 |
| 26 ✅ | ⭐ 포커스 레벨 · 포커스 공유 · 📱 태블릿 | #161 #166 #167 | 553 | **옮김** — `focus-level.js` · 누적 · 오늘 · 이번 판 초는 읽는 함수 · 쓰는 함수 · `getFocusLevel` 은 «옛 전역 이름» · app.js 27,605 → 27,092줄 |
| 27 ✅ | ⚙ 설정 패널 · 캐릭터 탭 | #36 #110 | 824 | **옮김** — `settings-panel.js` · 이동 모드 let 셋 · 앱 화면 전환(`appMode` · `launchApp` · `backToLauncher` · `applyAppMode` · `showEl`)은 app.js 에 남김 · app.js 22,674 → 21,917줄 |
| 28 ⏸ | 🎁 커미션 코드 입력 · 📦 코드 가져오기 | #109 #98 | 620 | **20번과 함께로 미룸** — 두 구역 뒤쪽은 3D 핵심(조명 · 재질 톤 · `applyCharToSeat`)이라 app.js 에 남고, 창 부분만은 153줄에 받을 이름 49(캐릭터 생성기 상태 `cDesk*` · `cBase` · `savedParts` …) — 생성기 코어(20번)와 같이 옮긴다 |
| 29 ✅ | 🎨 꾸미기 묶음(미리보기 · 초안 · 상세조정 · 색 줄 · 창 그리기) | #41 #42 #75 #78 #80 | 1,703 | **옮김** — `wardrobe.js` 한 파일 · 미리보기 장면 · 카메라 · 기즈모 · 초안은 읽는 함수로 내놓음 · `buildFreeColorPicker` 는 «옛 전역 이름» · app.js 24,292 → 22,674줄 |
| 30 ✅ | 🗼 올라타기 · 🪑 멀티좌석 | #15 #17 | 1,092 | **옮김** — `ride-bench.js` · deps 65(대부분 튜닝 상수) · 내놓는 이름 17 · 사이의 상호작용 책상 카탈로그 #16 은 app.js · app.js 29,557 → 28,537줄 |
| 31 ✅ | 🎟️ 초대장 | #101 | 837 | **옮김** — `license-gate.js` · `isPremium` 은 app.js(keep) · 관리자 통계 · 초대권 만드는 줄은 app.js 로 뺌 · app.js 25,863 → 25,067줄 |
| 32 ✅ | 🖥️ 데스크탑 실행 화면(블록 안에서 쪼개기) | #170 | 750 | **옮김** — `desktop-run.js` · `if(desktopMode){…}` 덩이 통째(만들 때 한 번 돈다) · 창 크기(`applyDesktopRunClass`) · `layoutSeats` 감싸기는 app.js · app.js 21,917 → 21,194줄 |
| 33 ✅ | 🛰 방 서버 provider · 방 입장 · 방 개수 | #115 #122 #123 | 1,400 | **옮김** — `room-entry.js` · 내 이름 도우미 넷은 app.js(keep) · 두 통로 전략 정리는 컨벤션 단계 · app.js 21,194 → 19,851줄 |

**옛 전역 이름 잇기** — 다른 모듈(animal.js 등)이 아직 전역으로 부르는 이름은 app.js 만드는 줄 바로 뒤에 `function 이름(...a){ return mod.이름(...a); }   // 옛 전역 이름 …` 한 줄로 넘긴다. 다른 모듈을 함께 고치지 않으려는 임시 다리다. 도메인 단계에서 그 모듈들이 deps 로 받게 바꾸면서 걷는다(`grep '// 옛 전역 이름'`). 여러 모듈이 쓰는 작은 공용 도우미(`findMySeat` 등)는 옮기지 않고 app.js 에 남긴다(keep).

다 하면 app.js 는 약 1만 5천 줄 안팎(핵심 3D + 작은 구역).

**도구로 미리 본 얽힘(10-14 · 22번 판)** — 바로 옮길 만함: 25 · 30. 얽힘이 큼: 23(읽는 함수 20) · 27(쓰는 함수 13 · 바뀐 줄 67). «다른 모듈이 전역 이름으로 부른다» 로 멈춤: 21(`_picIntersect` · `_stampWrap*` ← animal.js · `findMySeat` ← noise.js) · 24(`DEMOJI_*` ← myhome-desktop.js) · 26(`getFocusLevel` ← animal.js · myhome-desktop.js) · 28(`LIGHT_PRESET` · `applyCharToSeat` ← animal.js) · 29(`buildFreeColorPicker` ← bookmark.js) · 31(`isPremium` ← myhome-desktop.js) · 33(`getDisplayName` ← 여럿). 32 는 본문이 `layoutSeats` 를 다시 대입한다. → 공용 이름은 app.js 에 남기는 «keep» · 옛 전역 이름을 모듈로 넘기는 한 줄을 도구에 더한 뒤 진행. 그다음 순서는 정해 둔 대로 — 도메인 분석 문서 → 도메인 폴더 → 컨벤션
(모듈 모양 · `-net` 통로 · 커서 · 로컬 저장) → 설정 · 기능을 서버 · 관리자로.
옮기는 방법은 1차와 같고, 2차부터는 받을 이름 · 바꿀 자리를 **파서(typescript)로** 뽑는다(관리자 4번 · #165 에서 정규식이 다섯 개를 놓친 뒤).

## 구역 표 — `app/parts/app.js`

| # | 줄 | 크기 | 목적 | 층 | 관련 모듈 | 씀 | 쓰임 | 비고 |
|---|---|---:|---|---|---|---|---|---|
| 1 | 1–267 | 267 | three.js 캔버스 · 렌더러 · 씬 · 카메라 · 조명 · WebGL 복구 연결 | app | gl-recover.js | 10 (#98 #11 #6) | 98 (#106 #18 #155) | 전역 `renderer` `scene` `camera` 와 조명 `key` `fill` 을 거의 모든 구역이 쓴다 |
| 2 | 268–271 | 4 | GLTF 로더 하나 | app |  | 0 | 3 (#4 #21 #144) |  |
| 3 | 272–328 | 57 | 사람 귀 부착 — human-ear.js 연결 | entities | animal.js ears-glb.js human-ear.js | 8 (#1 #6 #15) | 6 (#79 #109 #15) |  |
| 4 | 329–414 | 86 | 내장 기본 캐릭터 GLB 파싱 · 리깅 | entities | base-glb.js | 6 (#1 #2 #89) | 16 (#105 #90 #109) |  |
| 5 | 415–894 | 480 | 책상 · 소품 3D 빌더 · 기본 책상 덮어쓰기 | entities | desk-item-origin.js | 15 (#151 #1 #6) | 19 (#89 #105 #90) |  |
| 6 | 895–1358 | 464 | 좌석 배열 `seats` · 간격 · 위치/크기 저장 · 이동 한계 | entities | animal.js | 10 (#1 #5 #22) | 78 (#18 #36 #101) | 핵심 상태 — 79개 구역이 쓴다 |
| 7 | 1359–1768 | 410 | 좌석 크기 평준화 배율(k) | entities | animal.js seat-pin.js | 19 (#15 #6 #155) | 21 (#15 #16 #155) |  |
| 8 | 1769–1827 | 59 | 🪑 플라잉체어 | features |  | 2 (#18 #84) | 6 (#11 #10 #72) |  |
| 9 | 1828–1931 | 104 | 워킹룸 캐릭터 숨기기 | features | frame-budget.js | 8 (#87 #6 #10) | 9 (#87 #11 #155) |  |
| 10 | 1932–2004 | 73 | 방 이벤트(poke) 신선도 판정 | entities | seat-pin.js | 5 (#8 #15 #6) | 8 (#113 #11 #9) |  |
| 11 | 2005–2309 | 305 | 💃 깜짝쇼 | features | animal.js | 18 (#8 #1 #15) | 16 (#73 #14 #16) |  |
| 12 | 2310–2400 | 91 | 🪄 때리기 — 상수 · 하루 횟수 · 납작 계수 · 매 프레임 | features |  | 7 (#11 #14 #88) | 5 (#14 #13 #87) | 뒷부분은 #14 — 사이에 효과음 공장(#13)이 끼어 있다(때리기 소리 풀을 공장으로 만든다) |
| 13 | 2401–2523 | 123 | 효과음 공장 `_mkSndPool` · 소리 풀(때리기 · 클릭 · 채팅 · 뽀모도로) · 자동재생 잠금 풀기 | shared |  | 5 (#12 #86 #115) | 4 (#50 #14 #87) | 0단계 shared 감. `CHAT_SFX_*` 상수는 #50 채팅 알림음이, `_pomoSnd` 는 pomodoro.js(값으로) 가 쓴다 |
| 14 | 2524–2695 | 172 | 🪄 때리기 — 말풍선 마커 · 재생 · 전파 · 조준 모드(b) | features | key-input.js | 16 (#1 #11 #12) | 8 (#87 #85 #12) | 앞부분은 #12 |
| 15 | 2696–3536 | 841 | 🗼 올라타기(탑) · 벤치 좌석 자리 · 머리 꼭대기 재기 | features | animal.js seat-pin.js | 14 (#7 #20 #6) | 17 (#7 #109 #155) | #7 평준화 배율을 많이 쓴다 |
| 16 | 3537–3743 | 207 | 상호작용 책상 카탈로그 · 레벨 해금 | entities |  | 10 (#7 #11 #15) | 10 (#155 #17 #35) |  |
| 17 | 3744–4000 | 257 | 멀티좌석 벤치에 앉히기 · 상호작용 책상 인벤토리(I키) | features |  | 8 (#16 #7 #155) | 6 (#115 #87 #110) |  |
| 18 | 4001–4203 | 203 | 좌석 배치 `layoutSeats` · 카메라 · 캔버스 · 도트 텍스처 필터 | app | frame-budget.js seat-pin.js | 7 (#6 #1 #15) | 25 (#8 #36 #6) | 핵심 — 25개 구역이 쓴다 |
| 19 | 4204–4269 | 66 | PS1 색 양자화 · 디더링 셰이더 | shared |  | 1 (#1) | 1 (#18) |  |
| 20 | 4270–4755 | 486 | 캐릭터 머리 · 몸 크기 재기 | entities | animal.js | 14 (#4 #89 #1) | 19 (#89 #105 #15) |  |
| 21 | 4756–4876 | 121 | 모델 불러오기 · 애니메이션 클립 고르기(`setupSeatModel`) | entities | animal.js | 8 (#4 #20 #1) | 5 (#22 #42 #89) |  |
| 22 | 4877–4919 | 43 | 좌석 탭 · 상태 라벨 DOM 고리 | widgets |  | 8 (#1 #6 #21) | 19 (#110 #155 #6) |  |
| 23 | 4920–5074 | 155 | 상태칩 — 활동 상태 · 커스텀 상태 · 칩 팝업 하나만 열기 | widgets |  | 7 (#101 #22 #25) | 21 (#35 #113 #87) |  |
| 24 | 5075–5223 | 149 | 창 겹침 — 누른 창 맨 앞(`bringWinToFront`) · ESC 스택(`escRegisterWindow`) | shared | folder-free.js | 2 (#1 #23) | 8 (#33 #36 #37) | 0단계 shared 감 |
| 25 | 5224–5469 | 246 | 상태칩 팝업 · 입력창 자리 계산 · 캐릭터 실측 | widgets | playlist.js | 8 (#35 #6 #1) | 6 (#35 #84 #23) |  |
| 26 | 5470–5522 | 53 | 기본 이모티콘 말풍선(워킹룸) | features |  | 6 (#70 #23 #25) | 0 |  |
| 27 | 5523–5559 | 37 | 🎵 상태칩 플레이리스트 — 모듈 연결(`TwPlaylist.createPlaylist`) | app | playlist.js scheduler.js | 10 (#161 #55 #30) | 10 (#28 #31 #32) | 16번으로 옮김 — 남은 것은 연결(빈 껍데기 `PLAYLIST_OFF` · deps 20)뿐. 프리셋 · 화면 · 고르기 · 파도타기 · 재생 감시견 · 재생 제어 · 버튼 연결 본문은 playlist.js |
| 28 | 5560–5561 | 2 | (머리만 · 2줄) — 🎵 프리셋 세 벌 | — |  | 1 (#27) | 0 | 16번으로 본문은 playlist.js — 구역 번호가 밀리지 않게 머리와 안내 한 줄만 남김 |
| 29 | 5562–5568 | 7 | (머리만 · 7줄) | — |  | 0 | 0 |  |
| 30 | 5569–5614 | 46 | 레벨 티어 경계값 · 배지 클래스 | entities |  | 2 (#161 #157) | 5 (#165 #31 #52) |  |
| 31 | 5615–5616 | 2 | (머리만 · 2줄) — 🎵 플레이리스트 화면 | — |  | 1 (#27) | 0 | 16번으로 본문은 playlist.js — 구역 번호가 밀리지 않게 머리와 안내 한 줄만 남김 |
| 32 | 5617–5618 | 2 | (머리만 · 2줄) — 🎵 프리셋 고르기 | — |  | 1 (#27) | 0 | 16번으로 본문은 playlist.js — 구역 번호가 밀리지 않게 머리와 안내 한 줄만 남김 |
| 33 | 5619–5622 | 4 | (머리만 · 4줄) — 🐕 재생 감시견 | — |  | 1 (#27) | 0 | 16번으로 본문은 playlist.js — 구역 번호가 밀리지 않게 머리와 안내 두 줄만 남김 |
| 34 | 5623–5684 | 62 | 렌더러 생존 신호 · 내 캐릭터 화면 좌표(`_charBoundsLatest`) | app |  | 1 (#35) | 2 (#35 #170) |  |
| 35 | 5685–6208 | 524 | 상태칩 자리(매 프레임) · 칩 클릭 · Tab 접기 | widgets |  | 19 (#23 #25 #16) | 9 (#25 #84 #34) |  |
| 36 | 6209–6795 | 587 | ⚙ 설정 패널 — 포커싱 어플 · 화면 표시 · 캐릭터 크기 · 탭 · 광고 배너 | widgets | gacha.js playlist.js scheduler.js seat-pin.js | 18 (#6 #7 #84) | 6 (#38 #35 #126) | 섞임(작게): 이동 모드 상태(`moveMode` 등 let 셋)가 머리 바로 밑에 있다 — #38 이동 모드 · #39 함수키가 쓴다 |
| 37 | 6796–6811 | 16 | 🕒 포커스 기록 팝업 — 모듈 연결(`TwFocusLog.createFocusLog`) | app | focus-log.js scheduler.js | 4 (#157 #24 #44) | 0 | 13번으로 본문 125줄은 `focus-log.js` 로 — 머리 · 연결 16줄만 남음. 🍅 뽀모 서랍(pomodoro.js)이 그 창 안에 있다 — DOM 만 같이 쓴다 |
| 38 | 6812–6853 | 42 | ✥ 프로그램 이동 모드 | features |  | 6 (#6 #36 #1) | 0 |  |
| 39 | 6854–6959 | 106 | ⌨️ 함수키 단축키(F1 ~ F4) | features | gacha.js key-input.js | 10 (#65 #1 #16) | 0 |  |
| 40 | 6960–7024 | 65 | 🎨 꾸미기 사이드 패널 열고 닫기 | widgets |  | 10 (#41 #42 #1) | 0 |  |
| 41 | 7025–7387 | 363 | 👀 꾸미기 미리보기 — 렌더러 · 기즈모 · 창 자리 · 카메라 | widgets | gamepad-activity.js | 12 (#146 #1 #43) | 13 (#42 #162 #43) |  |
| 42 | 7388–7853 | 466 | 📝 꾸미기 초안(draft) — 미리보기 캐릭터 · 저장(`commitWdDraft`) · 색 영역 | features | animal.js gacha.js | 24 (#41 #146 #1) | 17 (#75 #79 #162) |  |
| 43 | 7854–8657 | 804 | 🖍️ 파츠에 직접 그리기 | features | animal.js key-input.js paint-tools.js purikura-ui.js uv-fill.js | 17 (#146 #41 #77) | 19 (#42 #91 #92) |  |
| 44 | 8658–8745 | 88 | 🏠 마이홈 친구 탭 상수 · 상태 | pages | bug-board-ui.js friend-manage.js myhome-inbox.js scheduler.js | 12 (#55 #118 #79) | 15 (#46 #61 #54) | 끝에 📅 스케줄러 · 🔔 일정 알림 연결(`MhScheduler.createScheduler` — scheduler.js · 원래 자리) · 👥 친구 관리 연결(`TwFriendManage.createFriendManage` — friend-manage.js · 옛 #29 자리). 🐞 버그 제보 탭(오픈카톡 기본 링크)은 bug-board-ui.js 끝으로 |
| 45 | 8746–8776 | 31 | 🖥️ 한 계정 한 기기 — 밀려난 기기 처리 | features |  | 4 (#6 #115 #118) | 2 (#46 #115) |  |
| 46 | 8777–8889 | 113 | 🏠 마이홈 열기(`initMyHome`) · 소유자 쓰기 거부 안내 | pages | bug-board-ui.js friend-manage.js guestbook.js myhome-inbox.js scheduler.js | 9 (#44 #161 #6) | 1 (#35) |  |
| 47 | 8890–8896 | 7 | 📩 수령함 상태 · 안 읽은 수 · 친구 탭 배지 | entities |  | 1 (#161) | 4 (#52 #46 #161) | 15번으로 함수는 myhome-inbox.js 로 — 남은 것은 구독이 다시 대입하는 `_myInbox` · `_myInboxReady` · `_inboxBroadcast` 와 로그아웃이 같이 쓰는 `INBOX_BC_READ_KEY` |
| 48 | 8897–8914 | 18 | 공용 HTML 이스케이프 `escHtml` | shared | myhome-inbox.js | 1 (#64) | 12 (#44 #51 #52) | 0단계 shared 감 |
| 49 | 8915–8986 | 72 | 💬 채팅창 투명도 · 글자 크기(기기별 로컬) | widgets |  | 0 | 1 (#74) |  |
| 50 | 8987–9056 | 70 | 🔔 채팅 알림음 — 상태 · 저장 · 메뉴 | features |  | 3 (#13 #65 #156) | 3 (#74 #115 #116) |  |
| 51 | 9057–9222 | 166 | 리치 텍스트 sanitize · 저장 · 글자 수 | shared |  | 3 (#48 #55 #89) | 3 (#57 #61 #52) | 0단계 shared 감. 사이에 끼어 있던 친구 방 표시 둘(`_friendRoomTag` · `_friendInRoom`)은 15번으로 myhome-inbox.js 로 |
| 52 | 9223–9261 | 39 | 👥 마이홈 친구 목록 · Ctrl+F 검색 | app | friend-visit.js myhome-inbox.js scheduler.js | 14 (#47 #44 #115) | 6 (#44 #46 #53) | 15번으로 옮김 — 남은 것은 연결(🏠 놀러 가기 `TwFriendVisit.createFriendVisit` · `TwMyHomeInbox.createMyHomeInbox` · deps 18)뿐. 친구 목록 · 수령함 · 선물함 본문은 myhome-inbox.js |
| 53 | 9262–9263 | 2 | (머리만 · 2줄) — 📩 수령함 · 💝 선물함 그리기 | — |  | 1 (#52) | 0 | 15번으로 본문은 myhome-inbox.js — 구역 번호가 밀리지 않게 머리와 안내 한 줄만 남김 |
| 54 | 9264–9690 | 427 | 🏠 마이홈 창 버튼 연결(`bindMyHomeUI`) | pages | friend-manage.js guestbook.js mallang.js myhome-edit.js myhome-inbox.js scheduler.js seat-pin.js | 14 (#44 #55 #59) | 2 (#53 #57) |  |
| 55 | 9691–9887 | 197 | 🏠 마이홈 데이터 불러오기 · 방문 | pages | guestbook.js mallang.js myhome-desktop.js myhome-edit.js scheduler.js | 4 (#44 #57 #170) | 13 (#57 #61 #54) |  |
| 56 | 9888–9968 | 81 | 🔬 마이홈 클릭 진단(`__mhClickDiag`) | pages |  | 2 (#55 #170) | 0 |  |
| 57 | 9969–10020 | 52 | 🏠 마이홈 페이지 불러오기 · 그리기(`renderMyHomePage`) | pages | myhome-edit.js | 6 (#55 #51 #6) | 4 (#54 #55 #61) | 끝에 `_mhStickerDragDist`(스티커 드래그 거리 let) 한 줄 |
| 58 | 10021–10069 | 49 | ✏️ 인앱 프롬프트(`asyncPrompt`) | shared |  | 1 (#1) | 6 (#31 #59 #61) |  |
| 59 | 10070–10345 | 276 | 🎨 마이홈 스티커 배치 · 그리기(`renderMyHomeStickers`) | widgets | myhome-edit.js myhome-sticker.js scheduler.js | 7 (#55 #44 #1) | 4 (#61 #54 #57) | 끝에 🎨 스티커 관리 창 연결(`TwMyHomeSticker.createMyHomeSticker` — myhome-sticker.js · 원래 자리) |
| 60 | 10346–10375 | 30 | 🔗 마이홈 본문 링크 — 기본 브라우저로 | features |  | 0 | 0 |  |
| 61 | 10376–10445 | 70 | 🏠 마이홈 페이지 편집 묶음 · 📖 방명록 모듈 연결 | pages | guestbook.js myhome-edit.js scheduler.js | 16 (#44 #55 #59) | 0 | `TwMyHomeEdit.createMyHomeEdit`(myhome-edit.js) · `TwGuestbook.createGuestbook`(guestbook.js) — 둘 다 원래 자리 |
| 62 | 10446–10453 | 8 | 💬 머리 위 채팅 말풍선(`showChatBubble`) | widgets |  | 0 | 9 (#14 #26 #35) | 9개 구역이 쓴다 |
| 63 | 10454–10664 | 211 | 🌊 채팅 날리기 | features |  | 13 (#1 #85 #11) | 8 (#74 #69 #123) |  |
| 64 | 10665–10685 | 21 | 💬 대화창 코어 | widgets |  | 1 (#48) | 10 (#65 #68 #69) |  |
| 65 | 10686–10997 | 312 | 🔖 읽음 구분선 | features |  | 11 (#68 #64 #67) | 11 (#68 #74 #35) |  |
| 66 | 10998–11037 | 40 | 🔇 시크릿룸 채팅 잠금 | features |  | 6 (#68 #6 #63) | 6 (#67 #68 #112) |  |
| 67 | 11038–11159 | 122 | 🗑 대화 기록 삭제(방장) | features |  | 8 (#66 #68 #65) | 7 (#74 #65 #115) |  |
| 68 | 11160–11474 | 315 | 💬 채팅 탭 | features | chat-tabs.js | 9 (#65 #69 #66) | 8 (#67 #65 #66) | chat-tabs.js 와 짝 |
| 69 | 11475–11769 | 295 | 📋 대화 드래그 · 복사 | features | chat-copy.js | 14 (#63 #16 #70) | 3 (#68 #74 #65) | chat-copy.js 와 짝 |
| 70 | 11770–11947 | 178 | 😊 커스텀 이모티콘 | features |  | 4 (#1 #6 #58) | 5 (#74 #69 #26) |  |
| 71 | 11948–12039 | 92 | 🎲 주사위 | features | animal.js purikura-net.js purikura-ui.js scheduler.js | 14 (#1 #155 #16) | 5 (#74 #14 #69) | 📷 세션 입구 `_purikura()` 와 끝에 📷 스티커사진 창 연결(`TwPurikuraUi.createPurikuraUi` — purikura-ui.js · 원래 자리) |
| 72 | 12040–12112 | 73 | 🎟️ 룰렛 · 주사위 하루 횟수 | features |  | 13 (#1 #11 #73) | 3 (#73 #35 #74) |  |
| 73 | 12113–12167 | 55 | 🔫 러시안룰렛 | features |  | 10 (#11 #72 #1) | 2 (#72 #35) |  |
| 74 | 12168–12231 | 64 | 💬 대화창 배선 — 닫기 · 최소화 · 끌기 · 크기 · 메뉴 · 버튼 | app | chat-window.js | 17 (#65 #50 #63) | 0 | 14번으로 옮김 — 남은 것은 연결(`TwChatWindow.createChatWindow` · deps 49)뿐. 본문(즉시 실행 함수 `_wireChatWindow`)은 chat-window.js |
| 75 | 12232–12578 | 347 | 🎛️ 꾸미기 상세조정 패널 · 색 고르기 | widgets |  | 8 (#146 #42 #41) | 8 (#41 #80 #162) |  |
| 76 | 12579–12688 | 110 | 🎨 텍스처 파츠 색조 셰이더 | shared | purikura-ui.js | 0 | 3 (#78 #89 #71) |  |
| 77 | 12689–12879 | 191 | 🖍️ 파츠 그림칸(`_pic`) · UV 구제 · 그림 올리기 | features | gacha.js | 7 (#114 #90 #43) | 4 (#89 #43 #3) |  |
| 78 | 12880–13089 | 210 | 🎨 꾸미기 색 줄(`buildColorRows`) · 탭 상태 | widgets |  | 5 (#76 #1 #75) | 4 (#42 #80 #43) |  |
| 79 | 13090–13241 | 152 | 꾸미기 창 «책상» 탭 · 🐾 귀 탭 연결(wd-ear.js) | widgets | animal.js ears-glb.js human-ear.js wd-ear.js | 19 (#42 #90 #3) | 7 (#80 #93 #3) |  |
| 80 | 13242–13562 | 321 | 꾸미기 창 그리기(`renderWardrobe`) · 파츠 착용(`toggleEquip`) | widgets | gacha.js | 16 (#146 #89 #79) | 15 (#146 #40 #41) |  |
| 81 | 13563–13638 | 76 | 🗂️ 카탈로그 파츠 페이로드 · 파츠 삭제(관리자) | entities |  | 7 (#146 #89 #6) | 5 (#80 #82 #146) |  |
| 82 | 13639–14000 | 362 | 🛠️ 파츠 · 책상 · 아이템 등록 모달(관리자) | features | gacha.js | 17 (#146 #147 #41) | 3 (#162 #80 #93) |  |
| 83 | 14001–14115 | 115 | 🫧 상태 이모지 그림 · UI 아이콘 · 책상 위 이모지 | widgets |  | 4 (#1 #14 #23) | 5 (#123 #14 #23) | UI 아이콘(`uiIconEl` · `_applyUiIcons`)은 shared 감 |
| 84 | 14116–14378 | 263 | 🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너 | widgets | animal.js | 15 (#1 #6 #25) | 8 (#85 #165 #35) |  |
| 85 | 14379–14721 | 343 | 💬 머리 위 말풍선 · 회사원 모드 라벨 | widgets |  | 10 (#84 #14 #70) | 13 (#63 #84 #11) |  |
| 86 | 14722–14829 | 108 | 캐릭터 투명도 · 활동 판정(`seatState`) · 쓰다듬기 | entities | seat-pin.js | 5 (#156 #22 #23) | 19 (#170 #168 #22) | `seatState` · `activity` — 19개 구역이 쓴다 |
| 87 | 14830–15262 | 433 | 캐릭터 끌기 · 흔들기 · 쓰다듬기 | features | seat-pin.js | 28 (#9 #14 #6) | 14 (#9 #11 #14) |  |
| 88 | 15263–15305 | 43 | 머리 위 이모지 반응(floaters) | widgets | animal.js | 5 (#1 #6 #18) | 8 (#87 #155 #7) |  |
| 89 | 15306–16683 | 1378 | 파츠 부착 — 본 · 오프셋 보정 · 유령 정리 | entities | animal.js | 21 (#146 #5 #20) | 23 (#80 #105 #41) |  |
| 90 | 16684–17107 | 424 | 생성기 · 런처 공통 상태(`charDef` · `slots` · `curSlot`) | pages | animal-edit-route.js animal.js myhome-desktop.js skin-data.js | 22 (#4 #5 #105) | 54 (#105 #92 #141) | 핵심 상태 — 54개 구역이 쓴다 |
| 91 | 17108–17237 | 130 | 생성기 x축 대칭 | features |  | 6 (#90 #43 #1) | 3 (#92 #43 #105) |  |
| 92 | 17238–17971 | 734 | 생성기 이미지 도장 | features | animal.js key-input.js paint-tools.js skin-data.js uv-fill.js | 10 (#90 #105 #91) | 7 (#105 #43 #90) |  |
| 93 | 17972–18324 | 353 | 생성기 5단계 책상 세팅 | features |  | 20 (#151 #5 #145) | 10 (#79 #5 #80) |  |
| 94 | 18325–18554 | 230 | 생성기 아이템 3D 기즈모 | features | gamepad-activity.js | 13 (#5 #152 #20) | 4 (#95 #105 #5) |  |
| 95 | 18555–18624 | 70 | 생성기 6단계 좌석 세팅 | features |  | 7 (#90 #94 #1) | 3 (#94 #90 #105) |  |
| 96 | 18625–18658 | 34 | 책상 · 아이템 코드 만들기(판매자) | features |  | 1 (#144) | 4 (#39 #40 #125) |  |
| 97 | 18659–18710 | 52 | 커미션 캐릭터 코드 만들기(관리자) | features |  | 2 (#145 #142) | 4 (#39 #40 #125) |  |
| 98 | 18711–18914 | 204 | 책상 · 아이템 코드 가져오기 | features | def-size.js | 12 (#146 #1 #151) | 19 (#1 #104 #147) |  |
| 99 | 18915–18924 | 10 | 관리자 · 초대 게이트 상태(`isAdmin`) | entities |  | 0 | 26 (#103 #5 #16) | 26개 구역이 쓴다 |
| 100 | 18925–18927 | 3 | (머리만 · 3줄) | — |  | 1 (#1) | 0 |  |
| 101 | 18928–19916 | 989 | 🎟️ 초대장 · 가입 흐름 · 프리미엄 상태 | features | gamepad-activity.js remote-config.js | 16 (#6 #117 #23) | 29 (#103 #117 #118) |  |
| 102 | 19917–20050 | 134 | 라이선스 없는 기기 자산 접기 · 되돌리기 | entities | gacha.js | 14 (#5 #101 #90) | 7 (#114 #79 #101) |  |
| 103 | 20051–20210 | 160 | 🔐 라이선스 · 초대 게이트 시작 · 관리자 모드 진입 · 관리자 uid | features | key-input.js | 5 (#101 #99 #1) | 3 (#121 #129 #171) |  |
| 104 | 20211–20283 | 73 | 💡 얼굴 텍스처 갈아끼우기(`setFaceMap`) · 생성기 조명 | entities | animal.js creator-flat-view.js | 2 (#98 #1) | 10 (#105 #90 #92) |  |
| 105 | 20284–20956 | 673 | 🧍 생성기 미리보기 — 렌더러 · 카메라 · 열기 · 닫기 · 완료 | pages | animal-edit-route.js animal.js def-size.js myhome-desktop.js | 36 (#90 #4 #5) | 19 (#92 #90 #109) |  |
| 106 | 20957–21167 | 211 | 🖼️ 런처 미리보기 · 슬롯 섬네일 | pages | myhome-desktop.js | 19 (#1 #90 #151) | 13 (#171 #109 #110) |  |
| 107 | 21168–21279 | 112 | 🎛️ 런처 컨트롤 — 슬롯 넘기기 · 톱니 메뉴 · 삭제 · 보관함 이동 | pages | myhome-desktop.js | 7 (#140 #90 #110) | 4 (#106 #119 #140) |  |
| 108 | 21280–21335 | 56 | 🐾 종족 선택창 | features |  | 6 (#1 #4 #90) | 2 (#107 #109) |  |
| 109 | 21336–21747 | 412 | 커미션 캐릭터 코드 입력 | features | animal.js def-size.js myhome-desktop.js | 27 (#90 #1 #4) | 17 (#15 #89 #1) |  |
| 110 | 21748–22082 | 335 | 설정 › 캐릭터 탭(교체 · 자리 추가) | widgets | gacha.js guestbook.js myhome-desktop.js myhome-edit.js weekly-challenge.js | 22 (#22 #90 #1) | 16 (#107 #36 #35) |  |
| 111 | 22083–22098 | 16 | 방 인원 상한 | entities |  | 4 (#115 #114 #113) | 3 (#115 #122 #123) |  |
| 112 | 22099–22216 | 118 | 🚪 자리비움 자동 퇴장 | features | weekly-challenge.js | 5 (#66 #1 #23) | 1 (#113) |  |
| 113 | 22217–22621 | 405 | 방 접속 상태(`Presence`) | entities | animal.js noise.js | 24 (#115 #112 #159) | 40 (#7 #9 #11) | 핵심 상태 — 39개 구역이 쓴다 |
| 114 | 22622–22997 | 376 | 📦 방으로 보내는 def — 직렬화 · 얼굴 URL · 델타 전송 · Firebase provider | entities | animal.js gamepad-activity.js | 14 (#90 #102 #145) | 13 (#136 #77 #113) |  |
| 115 | 22998–23875 | 878 | 🛰 방 연결(Firebase · 방 서버) · 표시 이름 | entities | animal.js chat-tabs.js myhome-desktop.js purikura-ui.js room-server-net.js | 43 (#122 #17 #90) | 38 (#113 #122 #123) |  |
| 116 | 23876–24149 | 274 | 🏷️ 닉네임 저장 | features | myhome-edit.js name-guard.js purikura-ui.js | 19 (#156 #115 #1) | 7 (#61 #120 #40) |  |
| 117 | 24150–24451 | 302 | 🔑 구글 로그인 | features |  | 14 (#140 #6 #101) | 6 (#101 #118 #120) |  |
| 118 | 24452–24847 | 396 | 🧹 신원을 놓을 때 지우기(로그아웃) | features | gacha.js weekly-challenge.js | 26 (#136 #28 #137) | 13 (#120 #101 #117) |  |
| 119 | 24848–24906 | 59 | 🪪 [내 정보] 화면 전환 | pages | playlist.js | 7 (#120 #140 #118) | 5 (#120 #125 #109) |  |
| 120 | 24907–25564 | 658 | 🏆 [내 정보] 랭킹 · 보관함 · 휴지통 탭 | widgets | myhome-desktop.js | 21 (#140 #161 #119) | 6 (#119 #101 #106) |  |
| 121 | 25565–25745 | 181 | 📥 계정 스냅샷 복원 · 연동 뒤 플레이리스트 · 가챠 되맞추기 | features | gacha.js playlist.js | 12 (#6 #101 #157) | 8 (#117 #118 #6) |  |
| 122 | 25746–25943 | 198 | 🔢 방 개수 · 방 만들기 · 랜덤 참여 · 갈아타기 | features |  | 6 (#115 #123 #101) | 4 (#123 #115 #36) |  |
| 123 | 25944–26281 | 338 | 🚪 방 입장 · 나가기 · 방장 승계 · 해산 · 코드 입력칸 | features |  | 13 (#122 #115 #63) | 8 (#115 #122 #9) |  |
| 124 | 26282–26318 | 37 | 🔑 라이선스 등록 UI | widgets |  | 2 (#129 #101) | 4 (#101 #116 #127) | 키 등록 · 해제 버튼은 #127 에 떨어져 있다 |
| 125 | 26319–26351 | 33 | 🪟 런처 타이틀바 · 팝업 흐림 | pages | folder-free.js | 6 (#119 #87 #96) | 0 |  |
| 126 | 26352–26498 | 147 | 📢 런처 광고 배너 · ⚙️ 게임 설정 | widgets | animal.js | 3 (#36 #58 #99) | 1 (#36) | 섞임(작게): ⚙️ 게임 설정(`_gameCfg`)이 광고 배너 표시와 편집 사이에 끼어 있다 |
| 127 | 26499–26521 | 23 | 🔑 라이선스 키 등록 · 해제 버튼 | features |  | 4 (#101 #1 #116) | 0 | #124 와 한 몸 |
| 128 | 26522–26560 | 39 | 🪟 팝업 바깥 클릭으로 닫기 | app |  | 0 | 0 |  |
| 129 | 26561–26636 | 76 | 📨 라이선스 요청 · 관리자 비밀번호 모달 | features |  | 7 (#1 #101 #103) | 2 (#124 #118) |  |
| 130 | 26637–26805 | 169 | 🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자) | features |  | 2 (#53 #131) | 2 (#131 #132) |  |
| 131 | 26806–27095 | 290 | 관리자 파츠 카테고리 관리 | features |  | 8 (#146 #130 #1) | 2 (#130 #150) |  |
| 132 | 27096–27533 | 438 | 📄 엑셀로 라이선스 일괄 발급(관리자) | features |  | 6 (#1 #48 #101) | 0 |  |
| 133 | 27534–27776 | 243 | 🔒 시크릿룸 발급(관리자) | features |  | 5 (#115 #1 #99) | 0 |  |
| 134 | 27777–27801 | 25 | 👥 책상에서 친구 추가 | features |  | 7 (#90 #1 #22) | 1 (#110) |  |
| 135 | 27802–27956 | 155 | 💾 슬롯 저장 · 복원(`saveSlots` · `loadSlots`) | entities |  | 9 (#90 #136 #140) | 24 (#140 #136 #90) | 핵심 — 24개 구역이 쓴다 |
| 136 | 27957–28387 | 431 | ☁️ 슬롯 기기 간 동기화 | entities |  | 14 (#114 #137 #90) | 9 (#137 #140 #118) |  |
| 137 | 28388–28657 | 270 | ☁️ 연동 UI(띠 · 대화상자) | widgets |  | 7 (#136 #6 #90) | 6 (#136 #118 #106) |  |
| 138 | 28658–28712 | 55 | 🧬 캐릭터 병합(순수 함수) | entities |  | 1 (#136) | 4 (#140 #117 #120) |  |
| 139 | 28713–28888 | 176 | 🧬 slots → chars 이관(순수 함수) | entities |  | 10 (#136 #90 #114) | 1 (#140) |  |
| 140 | 28889–29581 | 693 | 🧬 이관 조율 · 서버 쓰기 | entities | gamepad-activity.js | 13 (#136 #135 #139) | 16 (#120 #117 #107) |  |
| 141 | 29582–29719 | 138 | 🛡️ 얼굴 자동 복구 | entities | animal.js | 8 (#90 #135 #4) | 1 (#171) |  |
| 142 | 29720–29791 | 72 | AES-256-GCM 암호화 | shared |  | 5 (#1 #90 #135) | 8 (#144 #145 #153) |  |
| 143 | 29792–29804 | 13 | GLB 파일 암호화(.dcc) | shared |  | 2 (#1 #142) | 2 (#153 #21) |  |
| 144 | 29805–29829 | 25 | 책상 · 아이템 GLB 코드(DCK1) | entities |  | 3 (#142 #1 #2) | 12 (#98 #96 #105) |  |
| 145 | 29830–29940 | 111 | 커미션 캐릭터 zip 코드 | entities |  | 3 (#142 #1 #151) | 22 (#93 #98 #97) |  |
| 146 | 29941–30287 | 347 | 꾸미기 파츠 카테고리 · 파츠 엔트리 · `savedParts` | entities | gacha.js | 4 (#80 #81 #152) | 23 (#80 #82 #89) | 핵심 — 23개 구역이 쓴다 |
| 147 | 30288–30452 | 165 | 🧊 파츠 GLB 파싱 캐시 · 썸네일 | entities | gacha.js | 10 (#1 #98 #146) | 6 (#82 #89 #81) |  |
| 148 | 30453–30559 | 107 | 💾 카탈로그 GLB 영구 캐시(IndexedDB) · URL 해결 | entities |  | 1 (#146) | 7 (#79 #82 #90) | 카탈로그 실시간 동기화 설명 주석이 이 머리 바로 밑에 있고 함수는 #150 에 있다 |
| 149 | 30560–30705 | 146 | 🧹 관리자 콘솔 도구 — 카탈로그 정리 · 진단 · 유령 방 · 초대권 회수 | features | gamepad-activity.js | 2 (#145 #146) | 0 | F12 콘솔용 `window.X` 함수뿐 — 다른 구역이 안 부른다 |
| 150 | 30706–30968 | 263 | 🔄 카탈로그 실시간 동기화 — 아이템 · 책상 · 파츠 · 카테고리 | entities | gacha.js | 26 (#146 #151 #15) | 9 (#5 #79 #89) |  |
| 151 | 30969–31173 | 205 | 🪑 책상 · 아이템 등록 · 책상 모양 바꾸기 · 크기 | entities | animal.js | 14 (#5 #98 #152) | 18 (#105 #150 #90) |  |
| 152 | 31174–31384 | 211 | 📌 책상 위 파츠 앵커 · 책상 위치 · 배율 | entities | seat-slot.js | 8 (#6 #1 #7) | 16 (#94 #42 #7) |  |
| 153 | 31385–31557 | 173 | 📦 복제 코드 불러오기 · 내보내기 · 풀 GLB | features | animal.js gacha.js myhome-desktop.js | 22 (#90 #146 #6) | 8 (#90 #93 #98) |  |
| 154 | 31558–31581 | 24 | 🍞 토스트(`toast`) · 저장 실패 문구 | shared |  | 0 | 5 (#54 #129 #131) | 0단계 shared 감. `toast` 는 `let toastT` 와 한 줄이라 근사치가 못 센다 — 실제로는 거의 모든 구역이 부른다 |
| 155 | 31582–32241 | 660 | 애니메이션 상태 · 프레임 루프(`frame`) | app | animal.js frame-budget.js seat-pin.js | 34 (#16 #7 #1) | 33 (#71 #170 #105) |  |
| 156 | 32242–32362 | 121 | 데스크탑(Electron) 모드 · 피규어 모드 | app | playlist.js | 4 (#146 #1 #116) | 23 (#116 #86 #155) |  |
| 157 | 32363–32440 | 78 | 포커스 시간 누적 · 레벨 | entities |  | 2 (#161 #1) | 12 (#161 #37 #118) |  |
| 158 | 32441–32519 | 79 | 📊 오늘 기록 전시 | features | pomodoro.js | 5 (#23 #156 #1) | 4 (#113 #169 #23) |  |
| 159 | 32520–32840 | 321 | 🫧 자리비움 그림 | features |  | 11 (#1 #6 #15) | 6 (#113 #155 #115) |  |
| 160 | 32841–33030 | 190 | 🚩 신고하기 | features |  | 7 (#6 #9 #1) | 1 (#87) |  |
| 161 | 33031–33274 | 244 | ⭐ 포커스 레벨(`getFocusLevel` · `addFocusSeconds`) · 해금 안내 · 회차 별 색 | entities | gacha.js gamepad-activity.js | 11 (#157 #16 #47) | 22 (#120 #46 #31) | 22개 구역이 쓴다 |
| 162 | 33275–33371 | 97 | 🎰 가챠 모듈 연결 · 🔑 쓰기 거부 안내 | app | gacha.js scheduler.js | 20 (#41 #146 #42) | 14 (#118 #39 #41) | `TwGacha.createGacha`(gacha.js · 저장 키 세 줄과 함께 · 원래 자리) · `_warnServerWriteDenied`(가챠 · 캐릭터 슬롯이 부른다) |
| 163 | 33372–33425 | 54 | 🎨 디자인 테마 | shared |  | 1 (#164) | 3 (#164 #116 #61) |  |
| 164 | 33426–33507 | 82 | 🎨 자식 창 테마 입히기 | shared |  | 1 (#163) | 3 (#116 #163 #61) |  |
| 165 | 33508–33624 | 117 | ⭐ 경험치 바 | widgets |  | 6 (#84 #30 #1) | 7 (#120 #115 #155) |  |
| 166 | 33625–33788 | 164 | 🕒 포커스 누적 기기 간 공유 | entities |  | 10 (#157 #161 #42) | 6 (#118 #121 #37) |  |
| 167 | 33789–33971 | 183 | 📱 태블릿 · 폰 포커싱 연결 · 설정 칸 · QR 창 | features |  | 6 (#1 #6 #43) | 6 (#113 #155 #46) |  |
| 168 | 33972–34001 | 30 | 🖥️ 활성 앱 판정(`_applyActiveAppState`) | entities |  | 6 (#86 #156 #1) | 2 (#167 #170) |  |
| 169 | 34002–34039 | 38 | 👑 달성표 · 🍅 뽀모도로 모듈 연결 | app | gacha.js pomodoro.js scheduler.js weekly-challenge.js | 11 (#157 #158 #6) | 5 (#118 #13 #110) | `TwWeeklyChallenge.createWeeklyChallenge` · `TwPomodoro.createPomodoro` — 둘 다 원래 자리 |
| 170 | 34040–34823 | 784 | 🖥️ 데스크탑 실행 화면 — 창 크기 · 업데이트 배너 · 전역 입력 · 클릭 통과 · 하트비트 | app | frame-budget.js gamepad-activity.js | 17 (#1 #86 #155) | 10 (#54 #55 #110) | 섞임: `if(desktopMode){ … }` 한 덩이(약 740줄)라 맨 앞 칸 머리로는 더 못 나눈다 — 옮길 때 블록 안을 나눈다 |
| 171 | 34824–34838 | 15 | INIT — `resize` · 첫 배치 | app |  | 12 (#106 #22 #141) | 5 (#25 #41 #54) |  |
| 172 | 34839–34859 | 21 | 🙋 투게더룸 친구 초대 — 모듈 연결(`TwRoomInviteUi.createRoomInviteUi`) | app | room-invite-ui.js scheduler.js | 8 (#44 #115 #6) | 0 | 10번으로 본문 268줄은 `room-invite-ui.js` 로 — 머리 · 연결 21줄만 남음 |
| 173 | 34860–34968 | 109 | 🛰 서버 모듈 감시견 | app |  | 0 | 0 |  |
