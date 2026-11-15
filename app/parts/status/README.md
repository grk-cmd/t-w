# status/ — 상태칩

상태칩 · 팝업 · 플레이리스트 · 백색소음 · 활동 상태. app.js 가 deps 로 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## user-status-table.js — 🍚 상태 표 · 커스텀 상태 저장값

- **책임**: «활동 상태» 의 값 표(밥 · 자리비움 · 빡일중 · 게임 · 커스텀 — 이모지 · 이름 · 점 색 · 동작 깃발)와 커스텀 상태 문구 저장값(`tw.customStatus` 불러오기 · 자르기). DOM · 방 통신 없음(아래층).
- **만드는 법**: deps 없음 — `const userStatusTableMod = TwUserStatusTable.createUserStatusTable({` / `});`.
- **내보내는 것**: `USER_STATUSES` · `CUSTOM_STATUS_KEY` · `CUSTOM_STATUS_MAXLEN`(12) · `loadCustomStatusFromStorage()` · `customStatusConf()` / `setCustomStatusConf(v)`(app.js 의 saveCustomStatusConf 가 쓴다).
  ```js
  const base = userStatusTableMod.USER_STATUSES[us];   // { emo, label, dot, forceSleep?, opacity?, idleTweak? }
  ```
- **확장할 때 고칠 자리**: 새 상태는 `USER_STATUSES` 에 한 줄(칩 메뉴 HTML 의 `data-st` 와 방 통신 칸도 같이). 동작 깃발(`forceSleep` · `opacity` · `idleTweak`)은 프레임 루프가 읽는다.
- **함정**
  - 내 상태 값(`userStatus`) · 풀이(`statusConfFor`) · 칩 반영 · 커스텀 저장(방에 알림)은 아래 `user-status.js`(앱 FSD 분리 M9)에 있다. 상태칩(status-chip.js) · 포커스 공유(focus-share.js)와 순환이 생기지 않게 그 모듈은 `attachStatusHooks` 알림만 부르고, room-sync.js 가 부르는 `window.setUserStatus` 고리는 app.js 가 건다.
  - 이모지는 `slice(0,2)` — 코드유닛 2개라 겹친 이모지는 잘릴 수 있다(지금 동작).
  - 검사: `checks/sim-user-status-table.js`(4절 — 표 · 불러오기 · 자르기 · 깨진 값).

## chip-popups.js — 🗂️ 상태칩 팝업 «한 번에 하나»

- **책임**: 상태칩 줄 팝업 목록(`_CHIP_POPUPS`)과 «하나를 열 때 나머지를 닫는» 규칙.
- **만드는 법**: `TwChipPopups.createChipPopups({ userStatus: ()=>userStatus })`.
- **내보내는 것**: `_closeChipPopups(exceptId, force)` · `_CHIP_POPUPS`.
  ```js
  chipPopupsMod._closeChipPopups('myChatBox');   // 채팅을 열기 전에 나머지를 닫는다
  ```
- **확장할 때 고칠 자리**: 새 칩 팝업은 `_CHIP_POPUPS` 에 `{ box, btn }` 한 줄 — 계속 켜 두는 창이면 `keep:true`(force 일 때만 닫힌다).
- **함정**: 알림 창(bellWin)은 class 와 함께 `display:none` 도 건다. 지금 커스텀 상태면 커스텀 버튼 ● 를 다시 켠다. 검사: `checks/sim-chip-popups.js`.

## bgm-diag.js — 🔍 플레이리스트 소리 진단 줄

- **책임**: «곡은 넘어가는데 소리만 없다» 를 설치본에서 가르는 한 줄(`#myPlDiag` — 음악 줄 아래). main.js 광고 게이트(`bgmStartAdGate`)가 음소거를 정할 때 본 값을 1초마다 `companion:bgmDiag` 로 보내 오면 그린다(페이지가 답을 안 해도 interval 에서 «답 없음 · 기다리는 확인 수» 를 보낸다). 읽기만 한다 — 음소거 · 음량은 게이트가 정한다.
- **만드는 법**: `TwBgmDiag.createBgmDiag({ companion: window.companion })` — app.js 의 플레이리스트 만드는 줄 바로 아래. 밖에서 부르는 이름 없음.
- **내보내는 것**: 순수 함수 `read(값)` · `suspect(값)`(이 값 하나가 이상한가) · `nextBadSince(since, 값, now)` · `held(since, now)`(5초 이어졌나) · `line(값)` · 기준 `HOLD_MS`(5초) · `PEEK_MS`(10초) · `FAIL_MIN`(8회) · `NO_REPLY_MS`(2초) — 검사가 돌린다.
- **언제 보이나**: ① 광고가 아닌데 앱 음소거가 안 풀림 · 게이트 확인이 8번 잇달아 실패 · 페이지가 2초 넘게 답을 안 함 — 이 상태가 5초 이어질 때만 저절로(곡을 불러오는 짧은 순간에 번쩍이지 않게) ② 음량 아이콘(`#myPlVolIco`)을 누르면 10초 동안(다시 누르면 처음부터 · 저장 안 함).
- **함정**: 곡이 닫히거나(`onBgmClosed`) 마이홈 BGM 이 창을 가져가면(`onBgmMode`) 값을 비운다 — 안 비우면 낡은 값이 남는다. «소리 신호 있음» 은 페이지가 소리를 내는가(`isCurrentlyAudible`)라 앱 음소거 중에도 있음일 수 있다. 글은 `textContent` 로만. 검사: `checks/sim-bgm-diag.js`.

## playlist-sync.js — ☁️ 플레이리스트 기기 간 맞추기 규칙

- **책임**: 부팅 때 서버 사본(`users/{uid}/playlist`)과 이 기기 목록 중 무엇을 따를지 정하는 순수 규칙(`decide`) · 다시 시도 간격(`retryDelay`). DOM · firebase 없음.
- **만드는 법**: 만들지 않는다 — 얼린 표 `window.TwPlaylistSync`. app.js 가 `playlistSync: TwPlaylistSync` 로 playlist.js 에 넘긴다.
- **내보내는 것**: `decide(서버 사본 | null, 이 기기 고친 시각, 이 기기에 곡이 있나)` → `'retry'` · `'adopt'` · `'push'` · `'none'` · `retryDelay(n)`(30초에서 두 배씩 · 10분 상한) · `countItems(sets)`.
- **규칙**: 고친 시각은 이 기기 `tw.playlistEditTs` · 서버 `editTs` 칸(이 판부터 앱만 쓴다 — 옛 앱이 쓴 노드엔 없어서 «모름»).
  - 못 읽으면 retry(모르는 채 올리지 않음).
  - 양쪽 다 알면 나중인 쪽(서버가 비운 것도 따름).
  - 이 기기만 모르면(새 기기 · 이 판 전 저장분) 서버에 곡이 있으면 받는다.
  - 서버가 모르면 양쪽 곡이 있을 때 이 판에서 고친 기기만 올리고, 둘 다 모르면 그대로 둔다(업그레이드 첫 부팅 · 옛 앱과 섞어 쓸 때 좋은 목록을 잃지 않게).
- **함정**
  - 고친 시각은 목록 · 한마디 · 공개가 바뀐 저장에서만 오른다(playlist.js `_plSave`) — 창 위치 · 반복 · 음량까지 올리면 다른 기기 목록을 이긴다.
  - 고친 시각은 그 기기 시계다 — 시계가 많이 빠른 기기가 늘 이긴다(서버 시각으로는 «고친 순간» 을 못 담는다). 다만 받은 사본 위에서 고치면 늘 그 시각보다 뒤가 된다(`max(지금, 앞 시각 + 1)`).
  - «서버가 비운 것도 따름» 은 양쪽 시각을 다 알 때만이다 — 시각 모르는 옛 기기에 곡이 있으면 그 기기 것을 올린다(옛 앱 시절과 같은 결과).
  - 판단은 불러온 때(또는 계정을 놓은 때)의 이 기기 시각으로 한다 — 맞추기 전에 고친 것(받기를 미루는 동안 · 이어받기 직후)이 «이 기기가 나중» 으로 뒤집지 않게(고친 것은 받기 전 백업에). 계정 이어받기(account.js)는 읽기 전에 `resetSync`(저장된 고친 시각까지 지움) · 못 읽으면 `bootSync` 로 다시 맞춘다.
  - 서버 것을 받을 땐 playlist.js `_plAdoptServer` 한 벌만 쓴다(부팅 맞추기 · 계정 연동) — 받기 전 이 기기 목록을 `tw.playlistBackup` 에 남긴다.
  - 맞추기 전(`_plSynced` 거짓)에는 서버에 올리지 않는다 — 3초 뒤 실제로 올리는 순간에 맞춤 상태와 계정(예약 때 uid)을 다시 본다(곡을 고친 직후 계정을 갈아타도 앞 목록이 새 계정에 안 올라가게) · 재생 중이면 받기를 30초 고정 간격으로 미룬다. 계정을 놓을 때(account.js `_wipeAccountLocal`) `plMod.resetSync()` 와 지움 목록(`tw.playlistEditTs` · `tw.playlistBackup`)으로 새 기기처럼 돌린다 — 안 하면 앞 계정 시각이 다음 계정 목록을 비운다.
  - 서버 쪽: 비울 때 노드를 지우지 않고 빈 목록 + 시각을 남긴다(`removeMyPlaylist`) · 읽기는 비어 있음(빈 목록 · editTs 0)과 못 읽음(null)을 가른다.
  - 검사: `checks/sim-playlist-sync.js`(규칙 · firebase-init) · `checks/sim-playlist.js` 5-2절(부팅 맞추기를 실제로 굴림) · `checks/sim-account-switch.js`(계정 놓기 · 연동).

## user-status.js — 🫧 활동 상태 · 내 칩 · 커스텀 상태 · 좌석 xf 저장

- **책임**: 내 상태 `userStatus`(저장 `tw.userStatus` · 불러오기 · `setUserStatus` → 칩 · 메뉴 · 방에 알림) · 좌석 + 상태키 → 화면에 쓸 상태 설정 `statusConfFor`(커스텀 · 상태가 없을 때 내 좌석에만 «오늘 기록 전시») · 커스텀 문구 저장 `saveCustomStatusConf` · 내 칩 · 메뉴 다시 그리기(`refreshMyStatusUI` · `refreshCustomStatusMenuItem` — 프리미엄이 아니면 커스텀 항목 숨김) · `saveSeatXf`(좌석 크기 · 높이 · 방향을 `def.xf` 와 슬롯에 저장). 상태 표(`USER_STATUSES`)는 `user-status-table.js` 가 가진다. 앱 FSD 분리 M9 — app.js USER STATUS 구역을 글 그대로 옮겼다.
- **만드는 법**: `TwUserStatus.createUserStatus({ clampCharY, findMySeat, isPremium, slots, userStatusTableMod })` 뒤 `userStatusMod.attachStatusHooks({ setCustomStatus, setUserStatus, focusShowMine, hexToRgba, saveSlots })` — 앞은 값 · 함수 · 읽는 함수(`isPremium` 는 다시 대입되는 let, `slots` 는 더 아래 선언). 방 알림 · 오늘 기록 전시 · 슬롯 저장 · 칩 색 변환은 다른 도메인(room · focus · character · status 칩)이라 이 모듈이 그쪽 모듈을 부르면 모듈 순환이 되므로(sim-dep-cycles) app.js 가 알림만 건다 — 상태를 바꾸기 전에 한 번.
- **내보내는 것**: `attachStatusHooks` · `userStatus()`(읽기만 — 바꾸는 곳은 `setUserStatus` · `loadUserStatusFromStorage` 둘) · `_premiumOn` · `saveCustomStatusConf` · `statusConfFor` · `setUserStatus` · `loadUserStatusFromStorage` · `refreshMyStatusUI` · `refreshCustomStatusMenuItem` · `saveSeatXf` — app.js 는 `userStatus` 를 뺀 여덟을 같은 이름 const 로 받는다.
- **함정**
  - `window.setUserStatus` 고리는 **app.js 가** 건다 — `presence.js` · `room-sync.js` 가 `window.` 로 부른다(옛 함수 선언이 자동으로 걸어 주던 전역 · `presence.js` 안쪽 같은 이름이 가려서 꼭 `window.`). `window._premiumOn` 도 마찬가지(마이홈 말랑이가 읽는다).
  - `_premiumOn` 은 `isPremium`(파일 뒤쪽 let)을 `try` 로 읽는다 — 초기화 때 불려도 TDZ 로 죽지 않게.
  - 커스텀 상태 항목은 상태 드롭다운 안의 `stItem` 이라 `textContent` 를 통째로 갈아치우면 안 된다(`.csEmo` · `.csLabel` 이 따로 있다).
  - 상태가 하나라도 있으면 «오늘 기록 전시» 는 안 띄운다(남의 화면과 같은 순서).
  - 검사: `checks/sim-user-status.js`(가짜 DOM · 표로 상태 바꾸기 · 풀이 · 커스텀 · 칩 · 메뉴 · saveSeatXf · 연결 · 깨 보기).

## seat-state.js — 🫧 좌석 활동 판정 · 활동 시각 · 쓰다듬기 시작

- **책임**: `seatState(seat, now)` — 좌석 하나의 지금 상태 키(idle · focus · sleep · pet · shaking · dizzy · dance) 정하기. 활동 시각 `lastActivity`(타이핑 모션용 — 포커싱 게이트에 걸림) · `lastAnyInput`(자동 자리비움용 «실제 입력») · 창 포커스 · 펜 앱(집중 창 4초) · 투게더워킹 창이 맨 앞인지. `triggerPet`(쓰다듬기 시작 · 눈 깜빡임 펄스). 앱 FSD 분리 M10 — 만들 때 mousemove · keydown · wheel · visibilitychange · blur · focus 듣기를 한 번 건다.
- **만드는 법**: `TwSeatState.createSeatState({ desktopMode, figureMode, focusGateSleep, focusLevelMod, seatPanelMod, userStatusMod })` — 앞 넷은 읽는 함수(app.js 가 다시 대입하거나 더 아래에서 선언), 뒤 둘은 값.
- **내보내는 것**: `FOCUS_MS` · `SLEEP_MS` · `PET_MS` · `PEN_FOCUS_MS` · `focusWindowMs` · `activity` · `anyInput` · `seatState` · `triggerPet` · 시각 읽기 `lastActivity()` · `lastAnyInput()` · `penAppFocused()` · 쓰기 `setLastActivity` · `setLastAnyInput` · `setPenAppFocused` · `setSelfAppActive`(`setPenAppFocused` · `setSelfAppActive` 는 app.js `_applyActiveAppState` 가, `setLastActivity` · `setLastAnyInput` 은 `desktop-run.js` 가 건다).
- **함정**
  - `lastActivity` 와 `lastAnyInput` 을 합치지 말 것 — 앞은 포커싱 게이트에 걸려 «타이핑 모션», 뒤는 어떤 앱을 쓰든 «사람이 만지고 있나».
  - 판정 순서가 곧 우선순위다(액자 고정 · 흔들기 · 어지러움 · 쓰다듬기 · 춤 · 자리비움 · 친구 상태 · 수동 · 창 포커스 · 게이트 · 폰 · 입력 간격). 흔들기 · 쓰다듬기는 자리비움보다 위다.
  - `seatPanelMod.manual()` 을 읽고 좌석 패널이 `activity` · `triggerPet` 을 부르는 서로 부름은 M10 전 app.js 때와 같다(모두 부를 때 찾는 읽기). `sim-dep-cycles` 가 옛 이름 별칭을 못 따라가 못 본다 — 별칭 따라가기와 수동 상태 주인 옮기기는 따로 한다.
  - 옛 `lastZ`(선언만 있고 아무도 안 읽던 값)는 옮기지 않았다.
  - 검사: `checks/sim-seat-state.js`(판정 순서 · 시각 · 듣기 · 쓰다듬기 · 연결 · 깨 보기).

## noise.js — 🌙 백색소음

- **책임**: 예전엔 app.js 다음 `<script>` 로 실려 app.js 맨 위 이름을 그냥 불렀다(R7). 지금은 `TwNoise.createNoise(deps)` 로 받는다 — app.js 보다 먼저 싣고(html), app.js 끝의 «화면 모듈 넷(M23)» 줄에서 INIT 뒤에 만든다(옛 «app.js 다음 script» 와 같은 때 · 같은 차례).
- **받는 deps**: 값 `officeModeMod` · `seats` · `hiddenSeatsMod` · `Presence` · 함수 둘(`findMySeat` · `seatState`).
- **함정**: 소리 자료(`noise-sounds.js`)를 이 모듈보다 먼저 싣는다. `_plSyncBgmBounds` · `_plApplyPos` 는 playlist.js 가 건 window 고리(typeof 가드)라 그대로다. 검사: `checks/sim-global-deps.js`(deps 없이 app.js 이름을 부르는 곳 0 · deps 짝 · 연결).
