# Together Working — Claude Code 작업 안내

책상 위에 사는 3D 데스크톱 컴패니언(Electron) + Firebase 백엔드. 이 저장소는 **공개**다.
이 프로젝트를 쓰는 사람 중엔 비개발자도 많다 — 설명은 **한국어로, 쉬운 말로**, 무엇을 바꾸는지 먼저 말하고 진행한다.

## 응답 · 커밋 규칙
- 답변, 문서, 커밋 메시지는 **한국어**. 코드 식별자·명령어는 원문 그대로.
- 커밋 메시지·PR 본문에 **Claude 표기(`Co-Authored-By: Claude…`, `Generated with Claude Code`)를 넣지 않는다.**
- 커밋 형식: `타입(스코프): 무엇을 — 부연` + 빈 줄 + `- 파일: 내용` 목록. 타입: `feat` `fix` `security` `refactor` `perf` `test` `docs` `ci` `build` `chore`. 자세한 건 `docs/GIT_CONVENTION.md`.
- 버그 제보를 고친 커밋 · PR 은 제목 끝에 `(B-MMDD-n)` 을 붙이고(여러 건이면 `(B-1009-1 · B-1009-3)`), 본문 «무엇을» 줄 앞에도 같은 번호를 적는다. 번호는 웹 관리자 🐞 제보에 보이는 고정 번호(«(임시)» 표시가 붙은 번호는 쓰지 않는다).
- 한 커밋에 한 의도. `checks/` 를 바꿨으면 `checks/CHECKS.md` §3 해시를 **같은 커밋**에서 갱신한다.
- 커밋·push 전에 무엇을 올리는지 한 줄로 알리고 진행한다. **force push 는 하지 않는다.**
- **PR**: 한 PR = 한 의도(버그 수정 묶음과 새 기능은 나눈다). 제목은 커밋 제목 형식(이모지 없음), 본문은 `.github/pull_request_template.md` 틀 그대로 — «무엇을» 은 커밋과 1:1. 자세한 건 `docs/GIT_CONVENTION.md` 3장.
- 절대 커밋하지 않는 것: `oauth-config.js`(OAuth 시크릿), `.env*`, `.idea/`, `*.iml`, `dist/`.

## 작업 전 할 일 확인
여럿이 같이 고치니 같은 일을 겹쳐 하지 않게 웹 관리자 📋 할 일(`adminTodos`)을 먼저 본다. 자세한 건 `/todo` 스킬.
1. **확인** — 코드 작업을 시작하기 전에 `node scripts/todo.js find <낱말>` · `brief`. 비슷한 일이 진행 중이면 멈추고 사용자에게 묻는다.
2. **등록** — 겹치지 않으면 `node scripts/todo.js start "<제목>" --type feat|bug`. 나온 id 를 PR 본문 `할 일:` 줄에.
3. **완료** — PR 이 머지되면 `node scripts/todo.js done <id> --release <다음 버전>`.
- 관리자 Google 계정으로 `gcloud auth login` 한 사람만 쓴다. 처음 한 번 `node scripts/todo.js setup`. 세션 시작 때 진행 중인 할 일이 자동으로 보인다(관리자가 아니면 조용히 안 나온다).

## 구조
| 위치 | 내용 |
|---|---|
| `main.js` · `preload.js` | Electron 메인 프로세스, IPC(`window.companion`) |
| `overlay-{win,mac}.js` · `sysinput-{win,mac}.js` | 플랫폼 모듈. 두 파일은 **export 이름이 같아야** 한다 |
| `app/desk-companion-prototype.html` | 렌더러 진입 HTML (CSP 정의) |
| `app/parts/app.js` | 렌더러 본체 (~38k줄, 전역 스코프). `/* ═══ 제목 ═══ */` 구역으로 나뉜다 — 줄 상한 검사 `sim-app-size` · 구역 지도 · 옮길 순서 `docs/APP_FSD_MAP.md` |
| `app/parts/myhome/scheduler.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 1번) — 📅 스케줄러 · 🔔 일정 알림. classic script(`window.MhScheduler` — 크로미움 내장 `Scheduler` 와 겹치지 않게) 를 app.js 앞에 싣고, app.js 가 원래 자리에서 `createScheduler(deps)` |
| `app/parts/focus/weekly-challenge.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 2번) — 👑 달성표(주간 규칙 · 기록 · 보상 · 화면). classic script(`window.TwWeeklyChallenge`) 를 app.js 앞에 싣고, app.js 가 원래 자리에서 `createWeeklyChallenge(deps)` · 부르는 곳은 `weeklyChal.이름` |
| `app/parts/purikura/` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 3번) — 📷 스티커사진 창(촬영 창 · 로비 · 무대 · 촬영 · 꾸미기 — `purikura-ui.js`). 통신 · 요금은 같은 폴더의 짝 `purikura-net.js`(`window.Purikura`), 세션 입구 `_purikura()` 는 app.js. classic script(`window.TwPurikuraUi`) 를 app.js 앞에 싣고, app.js 가 원래 자리에서 `createPurikuraUi(deps)` · 부르는 곳은 `purikuraUi.이름` |
| `app/parts/myhome/guestbook.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 4번) — 📖 방명록(새 글 배지 · 독립 팝업 창 — 웹박수 · 폭죽 · 글 목록 · 쓰기). classic script(`window.TwGuestbook`) 를 app.js 앞에 싣고, app.js 가 원래 자리에서 `createGuestbook(deps)` · 부르는 곳은 예전처럼 window 고리(`openMyGuestbook` · `_mhGb*`) |
| `app/parts/myhome/friend-manage.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 5번) — 👥 친구 관리(받은 요청 · 📤 보낸 요청 · 선물함 서브탭) · 👋 새 친구 요청 팝업 · 친구 탭 배지. classic script(`window.TwFriendManage`) 를 app.js 앞에 싣고, app.js 가 원래 자리에서 `createFriendManage(deps)` · 부르는 곳은 `friendManage.이름`. 같은 구역에 있던 🐞 버그 제보 탭(오픈카톡 기본 링크)은 `bug-board-ui.js` 끝 |
| `app/parts/focus/pomodoro.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 6번) — 🍅 뽀모도로(포커스 기록창 안쪽 서랍 · 집중 / 휴식 타이머 · 미니미 줄). classic script(`window.TwPomodoro`) 를 app.js 앞에 싣고, app.js 가 원래 자리(👑 달성표 연결 뒤)에서 `createPomodoro(deps)`. 머리 위 «🍅 집중 18분» 은 `_focusShowConf` 가 만드는 줄보다 먼저 불려서 예전처럼 window 고리 `_pomoShowText`(typeof 가드) |
| `app/parts/myhome/myhome-sticker.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 7번) — 🎨 마이홈 스티커 관리 창(목록 · ◎ 데려오기 · ✎ · ✨ · 🔗 링크 · × · 전부 화면 안으로) · 스티커 편집모드 · 드래그 · 회전 · 크기 핸들. classic script(`window.TwMyHomeSticker`) 를 app.js 앞에 싣고, app.js 가 원래 자리(`renderMyHomeStickers` 뒤)에서 `createMyHomeSticker(deps)` · 부르는 곳은 `myHomeSticker.이름`. 마이홈 페이지 편집 묶음(옛 `bindMyHomePage` — 자동저장 · 새 스티커 붙이기 · 👑 디자인 스튜디오 등)은 `myhome-edit.js`(7-2) |
| `app/parts/character/gacha.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 8번) — 🎰 파츠 가챠 코어(보유분 · 확률 · 뽑기 · 서버 동기화 · 미보유 파츠 회수) · 파츠 보관함(T) · 뽑기 창(캡슐 연출). classic script(`window.TwGacha`) 를 app.js 앞에 싣고, app.js 가 원래 자리에서 `createGacha(deps)` · 부르는 곳은 `gachaMod.이름`. 저장 키 세 줄(`GACHA_*_KEY` — 계정 전환 지움 목록) · 🔑 쓰기 거부 안내(`_warnServerWriteDenied`)는 app.js. 서버 읽기 · 쓰기는 `firebaseAPI.loadGachaOwned` · `saveGachaOwned`(경로는 firebase-init.js) |
| `app/parts/myhome/myhome-edit.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 7-2) — 🏠 마이홈 페이지 편집 묶음(자동저장 · 프로필 사진 · 글 서식 · 새 스티커 붙이기 · 스티커 끌기 · 닉네임 · 게시글 제목 · 🎵 BGM · 바깥 배경 · 테마) · 👑 디자인 스튜디오 · 프리셋. classic script(`window.TwMyHomeEdit`) 를 app.js 앞에 싣고, app.js 가 원래 자리(🔗 마이홈 본문 링크 뒤)에서 `createMyHomeEdit(deps)`. 바깥에서 부르는 이름은 예전처럼 window 고리(`commitMyHomePage` · `_mhApplyBg` · `_mhApplyTheme` · `_bgmDestroy` · `_mhDsClose` 등). 서버 쓰기는 `firebaseAPI.saveMyHome` · `uploadUserImage` |
| `app/parts/room/room-invite-ui.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 10번) — 🙋 투게더룸 친구 초대(친구 고르기 창 · 초대 보내기 · 창 끌기) · 🚪 방 초대 받기(수락 / 거절 팝업 · 3분 자동 거절 · 작업표시줄 깜빡임). classic script(`window.TwRoomInviteUi`) 를 app.js 앞에 싣고, app.js 가 원래 자리(INIT 뒤)에서 `createRoomInviteUi(deps)` — 밖에서 부르는 이름 없음. 서버는 `firebaseAPI.sendRoomInvite` · `subscribeRoomInvites` · `clearRoomInvite` |
| `app/parts/focus/focus-log.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 13번) — 🕒 포커스 기록 팝업(현재 / 누적 · 오늘 기록 · 미니미 `_ □` · 매초 갱신 · ESC · 타이틀바 끌기). classic script(`window.TwFocusLog`) 를 app.js 앞에 싣고, app.js 가 원래 자리(🕒 포커스 기록 팝업 머리 아래)에서 `createFocusLog(deps)` — 밖에서 부르는 이름 없음(👑 달성표 · 🍅 뽀모 서랍이 부르는 `window._focusLogClamp` 는 예전처럼 만들 때 건다) |
| `app/parts/chat/chat-window.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 14번) — 💬 대화창 배선(닫기 · 최소화 · 끌기 · 크기 · 파일 · 설정 · 지우기 메뉴 · 투명도 · ESC · 입력 Enter · 링크 · 날리기 · 잠금 · 기록 삭제 · 이모티콘 · 🎲 · 💣 · 📷 버튼). classic script(`window.TwChatWindow`) 를 app.js 앞에 싣고, app.js 가 원래 자리(💬 대화창 배선 머리 아래)에서 `createChatWindow(deps)` — 밖에서 부르는 이름 없음 · deps 49개(채팅 구역 함수는 app.js 에 그대로) |
| `app/parts/myhome/myhome-inbox.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 15번) — 📩 수령함(합치기 · 안 읽은 수 · 우편함 탭 배지 · 그리기 · 읽음 · 삭제 · 📌) · 💝 선물함(격자 · ⭐ · 삭제 확인창) · 👥 마이홈 친구 목록(Ctrl+F 검색 · 친구 방 표시). classic script(`window.TwMyHomeInbox`) 를 app.js 앞에 싣고, app.js 가 원래 자리(👥 마이홈 친구 목록 머리 아래)에서 `createMyHomeInbox(deps)` — 부르는 곳은 `inboxMod.이름`. 구독이 쓰는 `_myInbox` · `_inboxBroadcast` 는 app.js 에 두고 읽는 함수로 넘긴다 |
| `app/parts/status/playlist.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 16번) — 🎵 상태칩 플레이리스트(프리셋 세 벌 · 저장 · 서버 사본 · 창 · 명함 · 파도타기 · 📥 담기 · 프리셋 고르기 · 재생 제어 · 🐕 재생 감시견). classic script(`window.TwPlaylist`) 를 app.js 앞에 싣고, app.js 가 원래 자리(🎵 상태칩 플레이리스트 머리 아래)에서 `createPlaylist(deps)` — 부르는 곳은 `plMod.이름`. 상태는 모듈 안 — 밖(계정 이어받기 · 로그아웃 · 📷)은 상태 묶음 `plMod.st` 로 읽고 쓴다. `_plHasSavedPos` · `_plApplyPos` · `_plSyncBgmBounds` 는 window 고리(noise.js · 상태칩 팝업 자리) |
| `app/parts/admin/` | 🛠️ 앱 관리자 코드를 모으는 폴더(관리자 모드에서만 쓰는 창 · 버튼 · 콘솔 도구). 웹 관리자와 겹치는 기능은 나중에 이 폴더에서 걷는다. 지금: `admin-license-bulk.js`(📄 엑셀 라이선스 일괄 발급 · 🔒 시크릿룸 발급 — `window.TwAdminLicenseBulk`, app.js 가 원래 자리에서 `createAdminLicenseBulk(deps)` · 밖에서 부르는 이름 없음) · `admin-console.js`(🧹 F12 콘솔 도구 일곱 — `window.TwAdminConsole`, 콘솔 함수는 예전처럼 window 에 건다) · `admin-license.js`(🎟️ 키 발급 · 목록 · 대기 요청 · 친구코드로 발급 — `adminLicense.renderLicenseGenList`) · `admin-notice.js`(📣 확성기 · 📰 업데이트 공지 편집) · `admin-category.js`(📁 카테고리 관리 — `adminCategory.renderCategoryManager`) · `admin-part-register.js`(🛠️ 파츠 · 책상 · 아이템 등록 창 · 파츠 삭제 — `adminPartReg.이름`) · `admin-users.js`(📊 통계 · 🎟️ 초대권 지급) · `admin-launcher.js`(🛑 방 종료 · 🧹 유령 방 · ⚙️ 게임 설정 · 📢 광고 배너 편집) · `admin-asset.js`(📦 책상·아이템 코드 · 🎁 커미션 캐릭터 · 🔐 암호화 GLB 불러오기) · `admin-mode.js`(🔐 관리자 모드 진입 · 비밀번호 창 · Ctrl+E · 관리자 버튼 보이기 — isAdmin 을 바꾸는 단 한 곳) · `admin-report.js`(🚩 신고 목록 — 창 틀 · 팝업 칸은 report.js 것을 받음). 새 관리자 기능은 app.js 말고 여기에 |
| `app/parts/support/report.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 11번) — 🚩 신고하기(좌석 · 책상 · 이름표 우클릭 → 사유 → 신고 · 내 화면에서 숨김) · 신고 창 공용 도우미(창 틀 · 닫기 · 신고 종류 · 팝업 칸). classic script(`window.TwReport`), app.js 가 원래 자리에서 `createReport(deps)` · 부르는 곳은 `reportMod.openDialog`. 관리자 신고 목록은 `admin/admin-report.js` |
| `app/parts/account/my-info.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 17번) — 🪪 [내 정보] 화면(머리 · 레벨 별 색 · 보관함 · 휴지통 · 이름 바꾸기 · 계정 탭 로그인 연결) · 🏆 전체 랭킹. classic script(`window.TwMyInfo`), app.js 가 원래 자리에서 `createMyInfo(deps)` · 부르는 곳은 `myInfoMod.이름`(`openMyInfo` · `closeMyInfo` 등) |
| `app/parts/character/chars.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 18번) — 🧬 캐릭터 보관함(계정 단위 캐릭터 — 병합 · slots → chars 이관 · 서버 쓰기 · 미리보기 · 휴지통). classic script(`window.TwChars`), 부르는 곳은 `charsMod.이름` |
| `app/parts/character/slot-sync.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 19번) — ☁️ 슬롯(캐릭터) 기기 간 동기화 · 연동 UI(런처 띠 · 계정 탭 기기 연동 구획). classic script(`window.TwSlotSync`), 부르는 곳은 `slotSyncMod.이름`(상태 let 은 `slotSyncMod.이름()` · 비우기는 `slotSyncMod.set이름(…)`). 슬롯 저장 · 복원(`saveSlots` · `loadSlots`)은 app.js |
| `app/parts/room/away-pic.js` · `app/parts/myhome/myhome-ui.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 22번) — 🫧 자리비움 그림(`window.TwAwayPic` · `awayPicMod.이름`) · 🏠 마이홈 창 버튼 연결 bindMyHomeUI(`window.TwMyHomeUi` · `myHomeUiMod.renderMhProfileRail`) |
| `app/parts/room/tricks.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 25번) — 💃 깜짝쇼(날아가기 · 어지러움) · 🪄 때리기(말풍선 · 재생 · 방 전파 · 조준 모드). classic script(`window.TwTricks`), 부르는 곳은 `tricksMod.이름`. 효과음 공장은 app.js |
| `app/parts/room/ride-bench.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 30번) — 🗼 올라타기(탑 · 서커스 흔들림) · 🪑 멀티좌석 책상(2·3인승 벤치 — 끌어서 슬롯에 앉히기). classic script(`window.TwRideBench`), 부르는 곳은 `rideBenchMod.이름` |
| `app/parts/character/part-paint.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 21번) — 🖍️ 파츠에 직접 그리기(그리기 모드 · 광선 · 도장 감싸기) · 파츠 그림칸(_pic) · UV 구제 · 그림 올리기. classic script(`window.TwPartPaint`), 부르는 곳은 `partPaintMod.이름`. animal.js 가 전역으로 부르는 3개는 app.js 에 «옛 전역 이름» 한 줄씩 |
| `app/parts/focus/focus-level.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 26번) — ⭐ 포커스 레벨 · 해금 안내 · 회차 별 색 · 🕒 포커스 누적 기기 간 공유 · 📱 태블릿·폰 포커싱 연결. classic script(`window.TwFocusLevel`), 부르는 곳은 `focusLevelMod.이름`. 누적 초(`_focusTotalSec` 등)는 app.js 에 두고 읽는 · 쓰는 함수로 넘긴다 |
| `app/parts/chat/chat-ui.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 24번) — 💬 채팅 🌊 날리기(흐르는 자막) · 🔖 여기까지 읽음 구분선 · 💬 채팅 탭(채널) · 📋 드래그 복사 · 😊 커스텀 이모티콘. classic script(`window.TwChatUi`), 부르는 곳은 `chatUiMod.이름`. 대화창 배선은 `chat-window.js`, 보내기 · 받기 · 기록 그리기는 app.js |
| `app/parts/account/license-gate.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 31번) — 🎟️ 초대장(앱 접근 제한): 초대 게이트 · 기존 가입 확인 · 라이선스 키(확인 · 활성화 · 해제) · 초대 창. classic script(`window.TwLicenseGate`), 부르는 곳은 `licenseGateMod.이름`. `isPremium` 은 app.js 에 두고(여러 모듈이 읽음) 바꾸는 곳은 `_setPremium` 하나 |
| `app/parts/account/account.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 23번) — 🔑 계정: 구글 · 친구코드 로그인 · 로그아웃 · 신원을 놓을 때 이 기기에서 지우는 것(한 벌) · 계정 이전 흔적. classic script(`window.TwAccount`), 부르는 곳은 `accountMod.이름` |
| `app/parts/character/wardrobe.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 29번) — 🎨 꾸미기 창: 👀 미리보기(렌더러 · 기즈모 · 창 자리 · 카메라) · 📝 초안(commitWdDraft) · 🎛️ 상세조정 패널 · 색 줄 · 창 그리기(renderWardrobe) · 파츠 착용(toggleEquip). classic script(`window.TwWardrobe`), 부르는 곳은 `wardrobeMod.이름`(장면 · 카메라 · 초안 같은 let 은 `wardrobeMod.wdCam()` 처럼 읽는 함수) |
| `app/parts/launcher/settings-panel.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 27번) — ⚙ 설정 패널(포커싱 어플 · 화면 표시 · 캐릭터 크기 · 탭 · 광고 배너) · 캐릭터 탭(캐릭터 교체 · 자리 추가). classic script(`window.TwSettingsPanel`), 부르는 곳은 `settingsMod.이름`. 화면 표시 깃발은 app.js 에 두고 쓰는 함수로 넘긴다 · 앱 화면 전환(`launchApp` · `backToLauncher`)은 app.js |
| `app/parts/launcher/desktop-run.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 32번) — 🖥️ 데스크탑 실행 화면 덩이(`if(desktopMode){…}` — 업데이트 배너 · 활성 앱 · 전역 입력 · 클릭 통과 `UI_HIT_SEL` · 하트비트). classic script(`window.TwDesktopRun`), app.js 가 원래 자리에서 `createDesktopRun(deps)` 하면 한 번 돈다 — 밖에서 부르는 이름 없음. 창 크기 `applyDesktopRunClass` 는 app.js |
| `app/parts/room/room-entry.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 33번) — 🛰 방 서버 provider(관리자 스위치) · 🔢 방 개수 · 방 만들기 · 랜덤 참여 · 갈아타기 · 🚪 방 입장 · 나가기 · 승계 · 해산 · 코드 입력칸. classic script(`window.TwRoomEntry`), 부르는 곳은 `roomEntryMod.이름`(`startRoom` · `doLeaveRoom` 등). 내 이름 도우미(`getDisplayName` 등)는 app.js |
| `app/parts/room/overhead.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 34번) — 💬 머리 위 말풍선 · 회사원 모드 라벨 · 🏷️ 머리 위 이름표 · 상태칩 방향 · 공지 배너. classic script(`window.TwOverhead`), 부르는 곳은 `overheadMod.이름`(이름표 · 칩 방향 깃발은 `overheadMod.nameplateEnabled()` 처럼 읽는 함수) |
| `app/parts/room/room-sync.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 35번) — 📦 방으로 보내는 def(직렬화 · 얼굴 URL · 델타 전송 · Firebase provider) · 🛰 poke 신선도 · 🚪 자리비움 자동 퇴장 · 🛰 서버 모듈 감시견. classic script(`window.TwRoomSync`), 부르는 곳은 `roomSyncMod.이름` |
| `app/parts/status/status-chip.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 36번) — 📍 상태칩 자리 · 칩 클릭 · Tab 접기 · 📐 상태칩 팝업 · 입력창 자리 계산 · 🫧 상태 이모지 그림 · UI 아이콘 · 책상 위 이모지. classic script(`window.TwStatusChip`), 부르는 곳은 `statusChipMod.이름` |
| `app/parts/character/premium-assets.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 37번) — 🎀 캐릭터 꾸미기 파츠(프리미엄 — 카테고리 목록 `PART_CATS` · `PART_GROUPS` · 상한) · 🪑 라이선스 전용 책상(꾸미기 «책상» 탭) · 라이선스 없는 기기의 전용 자산 접기. classic script(`window.TwPremiumAssets`), 부르는 곳은 `premiumMod.이름`(`PART_CATS` 는 `premiumMod.PART_CATS()`) |
| `app/parts/character/char-code.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 38번) — 📦 캐릭터 복제 코드(불러오기 · 내보내기 · 풀 GLB · 암호화 GLB 를 좌석으로). classic script(`window.TwCharCode`), 부르는 곳은 `charCodeMod.이름` |
| `app/parts/room/dice-games.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 39번) — 🎲 주사위(굴리기 · 그림 · 나를 날리기) · 🎟️ 하루 횟수 제한(러시안룰렛 · 투게더룸 주사위). classic script(`window.TwDiceGames`), 부르는 곳은 `diceMod.이름` |
| `app/parts/launcher/program-settings.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 40번) — 🏷️ 닉네임 저장(제자리 편집이 부르는 한 벌 · `commitUserName`) · ⚙️ 프로그램 설정 창(열기 · 닫기 · 회사원 · 피규어 모드). classic script(`window.TwProgramSettings`), 부르는 곳은 `progSettingsMod.이름` |
| `app/parts/chat/chat-prefs.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 41번) — 🗑 대화 기록 삭제(방장) · 💬 채팅창 투명도 · 글자 크기 · 🔔 채팅 알림음(상태 · 저장 · 메뉴). classic script(`window.TwChatPrefs`), 부르는 곳은 `chatPrefsMod.이름` |
| `app/parts/shared/rich-text.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 42번) — 🛡️ 리치 텍스트 sanitize(`_mhSanitizeHtml`) · 저장 · 불러오기(`_mhLoadRT` — 남의 bio · 게시글은 반드시 여기를 거친다) · 글자 수. classic script(`window.TwRichText`), 부르는 곳은 `richTextMod.이름` |
| `app/parts/shared/win-stack.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 42번) — 🪟 창 겹침: 누른 창 맨 앞(`bringWinToFront`) · ESC 스택(`escRegisterWindow`). classic script(`window.TwWinStack`), 부르는 곳은 `winStackMod.이름` |
| `app/parts/shared/sfx.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 42번) — 🔊 효과음 공장(`_mkSndPool` — 풀 · preload · 자동재생 잠금 해제 · 회사원 모드 무음) · 때리기 · 클릭음 · 채팅 알림음 · 뽀모도로 알림음 풀. classic script(`window.TwSfx`), 부르는 곳은 `sfxMod.이름` |
| `app/parts/character/face-heal.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — 🛡️ 얼굴 자동 복구(`repairBlankFaces` — 얼굴 · 피부 캔버스가 비면 저장본으로 같은 캔버스에 다시 그리기 · 감시 주기 `FACE_WATCH_MS`). classic script(`window.TwFaceHeal`), 부르는 곳은 `faceHealMod.이름` |
| `app/parts/character/slot-save.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — 💾 캐릭터 슬롯 저장 · 복원(localStorage `LS_KEY` — `saveSlots` · `loadSlots` · `slotToObj` · 좌석 다시 잇기). classic script(`window.TwSlotSave`), 부르는 곳은 `slotSaveMod.이름` |
| `app/parts/room/interaction-desk.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — 🪑 상호작용 책상 카탈로그(`INTERACTION_DESKS`) · 💃 춤 목록(`DANCE_MOVES` · 춤 명령 · 해금) · 🌀 재주 자세 상수 · 🐾 올라탈 대상 찾기 — 한 구역에 섞여 있던 그대로(폴더 나눌 때 가른다). classic script(`window.TwInteractionDesk`), 부르는 곳은 `iDeskMod.이름` |
| `app/parts/launcher/ad-banner.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — 📢 런처 광고 배너 그리기 · 서버 배너 구독 · ⚙️ 게임 설정 구독(사용자 쪽 — 관리자 편집은 `admin/admin-launcher.js`, 만드는 줄은 app.js 에서 이 모듈 바로 뒤). classic script(`window.TwAdBanner`), 부르는 곳은 `adBannerMod.이름` |
| `app/parts/account/license-request.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — 📨 라이선스 요청(일반 유저 → 관리자 — 요청 보내기 · 대기 / 승인 상태 · 내 요청 구독). classic script(`window.TwLicenseRequest`), 부르는 곳은 `licReqMod.이름` |
| `app/parts/launcher/fn-keys.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — ⌨️ 함수키 단축키(F1 설정 · F2 꾸미기 · F3 이동 · F4 마이홈 등 · 글자 단축키). classic script(`window.TwFnKeys`) — 밖에서 부르는 이름 없음 |
| `app/parts/room/hidden-seats.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 43번) — 🙈 워킹룸 숨기기(숨긴 좌석 · 신고로 숨긴 사람 · 누르기 판정에서 숨긴 · 나는 캐릭터 건너뛰기). 비행 중 수 `_flyActive` 는 app.js(startFlight 가 올림). classic script(`window.TwHiddenSeats`), 부르는 곳은 `hiddenSeatsMod.이름` |
| `app/parts/shared/theme-ui.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 44번) — 🎨 테마 — 자식 창(방명록 · 디자인)에 테마 · 토큰 옮기기(`applyThemeToChildDoc`) · 테마 / 색상 고르기 화면. `applyTheme` 와 최상위 호출은 app.js. classic script(`window.TwThemeUi`), 부르는 곳은 `themeUiMod.이름` |
| `app/parts/myhome/myhome-sticker-layout.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 44번) — 🎨 마이홈 스티커 배치 — 크기 · 자리 계산 · 화면 안으로 · 움직임 효과 창. 그리기 `renderMyHomeStickers` 는 app.js(편집 모듈이 감싸 다시 대입). classic script(`window.TwMyHomeStickerLayout`), 부르는 곳은 `mhStLayoutMod.이름` |
| `app/parts/myhome/myhome-diag.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 44번) — 🔍 마이홈 클릭 진단(`window.__mhClickDiag` — 콘솔 도구). classic script(`window.TwMyHomeDiag`) — 밖에서 부르는 이름 없음 |
| `app/parts/myhome/myhome-visit.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 44번) — 🏠 내 마이홈 데이터(`_myHomeData` · 서버 모양 맞추기) · 👀 친구 홈 구경(`openFriendHomeView` · `closeFriendHomeView`). classic script(`window.TwMyHomeVisit`), 부르는 곳은 `mhVisitMod.이름` |
| `app/parts/character/code-crypto.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 45번) — 🔐 캐릭터 코드 암호화(`encryptCode` · `decryptCode` — base64 · 비밀번호로 키 만들기 · 이미지 줄이기). classic script(`window.TwCodeCrypto`), 부르는 곳은 `codeCryptoMod.이름` |
| `app/parts/character/commission.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 45번) — 📦 커미션 zip 풀기 · 커미션 암호화 · 💾 저장한 책상 · 아이템(`savedDesks` · `savedItems` — localStorage). `customItems` 는 app.js. classic script(`window.TwCommission`), 부르는 곳은 `commissionMod.이름` |
| `app/parts/focus/exp-bar.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 45번) — ⭐ 경험치 바 — 캐릭터 발밑 레벨 진행도 게이지(내 좌석 · 상대 좌석 공용). classic script(`window.TwExpBar`), 부르는 곳은 `expBarMod.이름` |
| `app/parts/focus/focus-total.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 45번) — ⏱️ 포커스 누적 — 전체 · 오늘 · 이번 실행 시간 저장 키 · 6시 날짜 경계 · 회차 상한. 전체 누적 `_focusTotalSec` 는 app.js. classic script(`window.TwFocusTotal`), 부르는 곳은 `focusTotalMod.이름` |
| `app/parts/focus/focus-share.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 45번) — 📊 오늘 기록 전시 — 머리 위 «오늘 n시간» 을 방에 보내기 · 설정 켜기(`_focusShowConf` · `_focusShowPush`). classic script(`window.TwFocusShare`), 부르는 곳은 `focusShareMod.이름` |
| `app/parts/chat/demoji-palette.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 46번) — 😊 기본 이모티콘 팔레트 · 보내기(채팅이 없는 워킹룸용 — 말풍선 그림은 chat-ui.js). classic script(`window.TwDemojiPalette`) — 밖에서 부르는 이름 없음 |
| `app/parts/chat/chat-lock.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 46번) — 🔇 시크릿룸 채팅 잠금(방 코드 · 방장 판정 · 끄기 표시). classic script(`window.TwChatLock`), 부르는 곳은 `chatLockMod.이름` |
| `app/parts/room/roulette.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 46번) — 🔫 러시안룰렛(워킹룸 · 혼자 — 하루 횟수는 dice-games.js). classic script(`window.TwRoulette`), 부르는 곳은 `rouletteMod.이름` |
| `app/parts/room/floaters.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 46번) — 💞 이모지 떠오르기(쓰다듬기 · 반응 이모지 스프라이트 — 움직임은 ANIM 프레임 루프가 `floatersMod.floaters` 를 돈다). classic script(`window.TwFloaters`), 부르는 곳은 `floatersMod.이름` |
| `app/parts/myhome/add-friend.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 46번) — 👥 책상에서 친구 추가(친구 고르기 창 · 얼굴 섬네일 `drawFaceThumb`). classic script(`window.TwAddFriend`), 부르는 곳은 `addFriendMod.이름` |
| `app/parts/account/device-lost.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 46번) — 🖥️ 한 계정 한 기기 — 다른 기기에 밀려난 기기 처리(«여기서 계속» · 안내). classic script(`window.TwDeviceLost`), 부르는 곳은 `deviceLostMod.이름` |
| `app/parts/myhome/myhome-page.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 47번) — 🏠 마이홈 페이지 불러오기 · 그리기(`loadMyHomePage` · `renderMyHomePage` — 관람 중이면 내 데이터로 덮지 않음). classic script(`window.TwMyHomePage`), 부르는 곳은 `mhPageMod.이름` |
| `app/parts/myhome/myhome-links.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 47번) — 🔗 마이홈 본문(자기소개 · 게시글) 링크를 시스템 기본 브라우저로 열기. classic script(`window.TwMyHomeLinks`) — 밖에서 부르는 이름 없음 |
| `app/parts/shared/async-prompt.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 47번) — ✏️ 인앱 프롬프트(`asyncPrompt` — 창 안 입력 대화상자 · `window.asyncPrompt`). classic script(`window.TwAsyncPrompt`), 부르는 곳은 `asyncPromptMod.이름` |
| `app/parts/launcher/launcher-chrome.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 47번) — 🪟 런처 타이틀바(끌기 · 버튼) · 팝업이 뜨면 뒤 런처 흐리게. classic script(`window.TwLauncherChrome`) — 밖에서 부르는 이름 없음 |
| `app/parts/shared/outside-close.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 47번) — 🪟 팝업 바깥 클릭으로 닫기(닫을 오버레이 목록 · 예외 — 엑셀 일괄 창 등). classic script(`window.TwOutsideClose`) — 밖에서 부르는 이름 없음 |
| `app/parts/character/wardrobe-panel.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🎨 꾸미기 사이드 패널 열고 닫기(`bindWardrobe` — 창 그리기는 wardrobe.js). classic script(`window.TwWardrobePanel`) — 밖에서 부르는 이름 없음 |
| `app/parts/creator/race-picker.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🐾 종족 선택창(사람 · 동물 고르기 · 미리보기 렌더러 — [＋] 칸 번호가 저장 대상). classic script(`window.TwRacePicker`), 부르는 곳은 `racePickerMod.이름` |
| `app/parts/focus/lv-tier.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🏅 레벨 티어 — 경계값(`LV_TIERS`)이 사는 유일한 곳 · 배지 · 바 색 클래스. classic script(`window.TwLvTier`), 부르는 곳은 `lvTierMod.이름` |
| `app/parts/shared/theme.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🎨 디자인 테마 — 저장 키 · 색 표 · 지금 테마 · 걸기(`applyTheme` — 열린 자식 창은 theme-ui.js 가 받는다). 최상위 호출은 app.js. classic script(`window.TwTheme`), 부르는 곳은 `themeMod.이름` |
| `app/parts/account/license-ui.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🔑 라이선스 등록 화면 — 상태 표시(`refreshLicenseUI`). classic script(`window.TwLicenseUi`), 부르는 곳은 `licenseUiMod.이름` |
| `app/parts/account/license-key.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🔑 라이선스 키 등록 · 해제 버튼(입력칸 Enter 포함). classic script(`window.TwLicenseKey`) — 밖에서 부르는 이름 없음 |
| `app/parts/character/asset-code.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 48번) — 🔐 에셋 코드 — 풀 GLB 암호화(.dcc) · 책상 · 아이템 GLB 코드(DCK1) · GLB 바이트 읽기. classic script(`window.TwAssetCode`), 부르는 곳은 `assetCodeMod.이름` |
| `app/parts/myhome/myhome-init.js` | app.js 에서 옮긴 렌더러 모듈(앱 FSD 44번 남은 몫) — 🏠 마이홈 시작(`initMyHome` — 접속 표시 · 프로필 · 친구 · 요청 · 우편 · 공지 구독) · 소유자 쓰기 거부 안내. 부르는 곳은 app.js INIT 한 곳(`mhInitMod.initMyHome()`). classic script(`window.TwMyHomeInit`) |
| `app/parts/room/seat-pin.js` | 🪑 방에서 내 자리 «맨 오른쪽 고정»(설정 › 캐릭터) — 저장 · 고정 조건 · 나를 0번으로 · 책상 끌기 자리. classic script(`window.TwSeatPin`)를 app.js 앞에 싣고 app.js 는 layoutSeats · 책상 끌기 · 버튼에서 부르기만 |
| `app/parts/room/room-state.js` | 🧭 방 공용 상태 — `window._activeChannel`(1 워킹룸 · 2 투게더룸) · `window._roomMetaCache`(방 meta 사본)의 처음 값. 여러 모듈이 읽는 값이라 맨 아래 한 곳에 두고 읽는 모듈 · app.js 보다 먼저 싣는다. 바꾸는 곳은 room-entry · chat-prefs · chat-ui 뿐(`sim-room-state.js`) |
| `app/parts/room/friend-visit.js` | 🏠 마이홈 친구 목록의 방 코드를 누르면 «○○ 님이 있는 룸에 놀러 갈까요?» 창 → 그 방으로 이동. classic script(`window.TwFriendVisit`)를 app.js 앞에 싣고 app.js 는 `createFriendVisit(deps)` · 코드 칸에서 `friendVisit.ask(fid)` 만 |
| `app/parts/firebase-init.js` | Firebase SDK 초기화 + `window.firebaseAPI` (DB 경로는 여기서 찾는다) |
| `app/parts/chat/chat-history.js` | 💬 대화 기록(entities) — 서버 3일 · 워킹룸/시크릿룸은 이 PC(IndexedDB)에 저장 · 저장분 뒤만 ts 커서로 이어 받기 · 방장 지우기 표시 줄. `firebase-init.js` 가 `firebaseAPI.chatHistory` 로 연결, app.js 는 부르기만. 서버 정리는 `functions/chat-expire.js` |
| `app/parts/room-*.js` · `invite-account.js` | 도메인 모듈 — `createXxx(deps)` 로 필요한 함수 · 상태를 받는다(Firebase 직접 import 없음). `firebase-init.js` 는 연결만 |
| `firebase-database-rules.json` | **Realtime Database 보안 규칙 — 서버 쪽 검증의 전부** |
| `functions/` | Cloud Functions (비밀번호 변경, 휴지통 청소, 방 개수 집계 `room-stats.js`, 일일 접속 집계 `daily-active.js`, IP 기준 방문자 `visit-ping.js`, 날짜별 요약 `daily-summary.js`, 사용량(비용) 기록 `usage-snapshot.js`, 카탈로그 항목별 장착 사용자 수 `part-equip.js` · 처음 숫자는 `scripts/backfill-part-equip.js`, 버그 제보 고정 번호 `bug-no.js` · 옛 글 번호는 `scripts/backfill-bug-no.js`, 대화 3일 보관 `chat-expire.js`). **자동 배포 대상이 아니다** |
| `hosting/` | Firebase Hosting (폰 연결 안내 페이지). `hosting/admin/` 은 `web-admin` 빌드 결과(커밋 안 함) |
| `web-admin/` | 웹 관리자 페이지 (Vite + React + TS + TanStack Query) — `/admin` 으로 배포. **FSD** 구조(`app` → `pages` → `widgets` → `features` → `entities` → `shared`, 위층만 아래층을 부름 · Steiger 가 검사). 테스트는 `tests/` |
| `checks/` | 자체 검사 (`sim-*.js` · `audit.py` · `run.js` 러너 · `CHECKS.md` 정본 표). app.js 에서 모듈로 옮긴 코드를 app.js 글에서 찾던 검사는 `sim-renderer-src.js` 의 `joinRenderer` 로 «옮기기 전 글» 을 되살려 읽는다 |
| `.github/workflows/` | `checks.yml`(push·PR 마다 검사) · `deploy-dev.yml`(규칙 → dev) · `release-start.yml`(버튼 → 검사 · 버전 태그 · release 실행) · `release.yml`(버전 태그 → 빌드 · 검사 · 자동 공개) · `min-room-ver.yml` · `mac-probe.yml`(맥 빌드, 수동) |

## 명령
```bash
npm install          # 의존성 (postinstall 로 node-window-manager 패치)
npm start            # 앱 실행 (운영 Firebase)
npm run start:dev    # dev Firebase(together-working-dev)로 실행 — 테스트는 이걸로
npm run check        # 검사 전체 — 마지막 줄 «빨강 0» 이면 통과. 첫 바퀴의 ✗ 는 다음 바퀴에서 통과하면 정상

# 웹 관리자 (처음 한 번 npm --prefix web-admin install)
npm run admin:dev    # 로컬 개발 서버 (dev DB · firebase login 필요) → http://localhost:5173/admin/
npm run admin:test   # vitest
npm --prefix web-admin run lint   # oxlint + steiger(FSD 층 규칙) — CI 에서도 돈다
```

## 코드 컨벤션
- 앱(Electron)은 순수 JS, 번들러·TS 없음. **`web-admin/` 은 예외** — Vite + React + TS(strict), Prettier(`npm --prefix web-admin run format`), 조각 전용 스타일은 옆에 `*.module.css`. 여러 경로를 함께 쓰는 쓰기는 `db.commit` 한 묶음으로. `const` 위주, 2칸 들여쓰기, 작은따옴표, 세미콜론. 앱 쪽은 `if(`, `functions/` 는 `if (`.
- 새 로직은 `firebase-init.js` · `app.js` 에 쌓지 말고 도메인 모듈 파일로 만든다(위 구조 표). 모듈마다 검사(`sim-*.js`)를 붙인다. 두 파일은 줄 상한 · 새 구역 머리를 `sim-app-size` 가 막는다 — 옮겨서 줄었으면 같은 PR 에서 `node checks/sim-app-size.js --write-baseline`(지도 `docs/APP_FSD_MAP.md`).
- UI 를 고치거나 새로 만들 때는 `docs/design-system/` (원칙 · 토큰 · 부품 지침)을 따른다. 그 폴더를 고쳤으면 `npm run design:build` 로 `hosting/design/` 도 다시 만든다.
- 주석은 한국어로, **코드만 봐서는 모를 이유**만 짧게. 변경 이력 · 날짜 · 실측치는 커밋 메시지와 PR 에 적고, 이모지 꼬리표는 쓰지 않는다. 할 일은 `TODO:`.
- 여러 곳에서 쓰는 값(채널 이름, 접두사 등)은 상수로 둔다.
- localStorage 키는 `tw.` 접두사.
- 서버 데이터는 **Firebase Realtime Database**(JSON 트리). 요금은 **내려받은 바이트**로 나온다 —
  노드를 통째로 `get`/`onValue` 하지 말고 필요한 하위 경로만 읽는다. 반복 폴링·부팅마다 전체 받기를 새로 만들지 않는다.
- 권한 검사는 서버에 없고 규칙 파일뿐이다. 남의 데이터에 쓰는 기능을 만들면 규칙도 같이 본다.
- **규칙이 바뀌는 기능 개발 · 수정은 PR 본문에 «서버(AWS) 이관» 안내를 쓴다**(바뀐 경로 · 칸 · 권한 · 앱에서 쓰는 곳, 방에 오가는 칸인지). 자체 서버(`t-w-server`, 비공개 · 방 서버는 모르는 칸을 받지 않음)로 옮기는 중이라 관리자가 이 안내로 서버에 옮긴다. 형식은 `docs/GIT_CONVENTION.md` 4.1 · `.github/pull_request_template.md`.

## Firebase 규칙 · 배포
- `firebase deploy` 는 **모든 사용자에게 즉시 적용**된다. 기본 프로젝트(`.firebaserc`)는 **운영 `together-working`**.
- 규칙을 바꾸면 순서: ① 앱에서 그 경로를 쓰는 곳을 전부 grep(`firebase-init.js`, `app.js`, `purikura-net.js`, `purikura-ui.js`, `functions/`) ② `npm run check` ③ **dev 에 먼저**: `firebase deploy --only database --project together-working-dev` ④ 확인 후 운영 배포.
- 규칙 함정: 상위 `.write` 가 하위 삭제를 대신 받아 주는 곳이 있다(예: `rooms/$room` ↔ `_photo`). 삭제(null)에는 `.validate` 가 안 돈다. 권한이 거부된 `onValue` 구독은 재시도 없이 끊긴다.
- 자동화(GitHub Actions): `main` 에 규칙이 바뀌어 push 되면 `deploy-dev.yml` 이 **dev 에 자동 반영**, 운영 규칙은 **사람이 태그 전에 직접** 배포한다(`release.yml` 은 규칙을 다루지 않는다). `config/minRoomVer` 는 웹 관리자 ⚙️ 설정에서(최신 릴리스까지만 · 작업 기록에 남음). `min-room-ver.yml` 은 운영 권한 변수가 생기기 전까지 동작하지 않는다. 릴리스 절차는 `docs/RELEASE.md`.
- 운영 DB 데이터를 대량으로 읽거나 고치기 전에는 몇 건·무엇을 읽는지 먼저 말하고 확인받는다.

## 릴리스 순서: ① 서버 → ② 버전 태그(→ 자동 공개)
1. **서버** (바뀐 것만): 함수는 자동 배포가 없으니 `firebase deploy --only functions:<이름> --project together-working` 을 앱 릴리스 **전에** 직접. 운영 규칙도 바뀌었으면 태그 전에 직접 `firebase deploy --only database --project together-working`. 옛 앱이 깨지지 않는지 확인한다.
2. **버전 태그**: Actions › **release-start** › Run workflow(patch · minor · beta) 버튼, 또는 main 에서 `git pull --rebase` → `npm run check` → `npm version patch -m "chore: %s"` → `git push --follow-tags`. 태그가 올라가면 `release.yml` 이 Windows · Mac 빌드 → 설치 파일 검사(dmg 열림 · 버전 · arch · 켜짐 · yml sha512 · 업로드 sha256) → **통과하면 공개**까지 자동. 빨강이면 초안으로 남는다. 버튼의 «공개 방식» 을 `초안으로 대기` 로 고르면 검사까지 같고 공개만 Releases 에서 사람이 누른다(정식은 «Set as the latest release» 체크 확인). 버튼은 main 의 그 커밋에 `checks.yml` 이 이미 초록이면 검사를 건너뛴다(없으면 직접 돌림). 테스트 빌드는 `npm version prerelease --preid=beta`(dev 에 붙고 일반 사용자에겐 안 감).
3. 방 통신 형식이 바뀐 버전이면, 사용자 대부분이 업데이트한 뒤 웹 관리자 ⚙️ 설정의 «방 입장 최소 버전» 으로 `config/minRoomVer` 를 올린다(올리면 낮은 앱은 방 입장이 막힌다). 자세한 절차는 `docs/RELEASE.md`.

## 문서
- `docs/GIT_CONVENTION.md` 커밋·브랜치·릴리스 규칙
- `docs/GUIDE_NON_DEVELOPER.md` 비개발자용 VS Code · Claude Code · git 안내
- `docs/design-system/` 디자인 시스템(원칙 · 토큰 · 부품) — 웹으로는 https://together-working.web.app/design/
- `handoff-*.md` 세션 인수인계 기록 (설계 배경)
