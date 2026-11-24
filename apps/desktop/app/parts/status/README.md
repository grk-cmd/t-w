# status/ — 상태칩

상태칩 · 팝업 · 플레이리스트 · 백색소음 · 활동 상태. app.js 가 deps 로 이어 주고, 이 폴더 모듈끼리는 서로의 속을 직접 부르지 않는다.
절은 모듈마다 하나 — 다른 사람이 만든 절은 건드리지 않고 자기 절만 더한다.

## user-status-table.js — 🍚 상태 표 · 커스텀 상태 저장값

- **책임**: «활동 상태» 의 값 표(밥 · 자리비움 · 집중(`grind` — 옛 이름 «빡일중») · 게임 · 커스텀 — 이모지 · 이름 · 점 색 · 동작 깃발)와 커스텀 상태 문구 저장값(`tw.customStatus` 불러오기 · 자르기). DOM · 방 통신 없음(아래층).
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
- **함정**: ▾ 두 칸 메뉴 안의 상태 목록(`#myStatusMenu`)은 목록에 넣지 않는다 — 따로 닫으면 메뉴는 열린 채 목록만 사라진다(메뉴째 `myChipMore` 로 여닫는다). 알림 창(bellWin)은 class 와 함께 `display:none` 도 건다. 지금 커스텀 상태면 커스텀 버튼 ● 를 다시 켠다. 검사: `checks/sim-chip-popups.js`.

## status-chip.js — 📍 상태칩(이름표 아래 [💬 채팅 | ▾]) · ▾ 두 칸 메뉴

- **책임**: 내 캐릭터 이름표 아래 가운데에 붙는 한 덩이 버튼(`#myChipGroup`)과 ▾ 두 칸 메뉴(`#myChipMore` — 왼쪽 «내 상태» 목록 `#myStatusMenu` · 맨 아래 «런처로», 오른쪽 «바로가기» 일정 알림 · 플레이리스트(같이 듣기) · 설정 F1 · 꾸미기 F2 · 이동 F3 · 마이홈 F4 · 포커스 기록 · 춤추기 · 러시안룰렛). 칩 자리(매 프레임) · 팝업 자리(`_positionCascade`) · 발 밑 입력창 · Tab 접기 · 책상 위 이모지.
  - 왼쪽 버튼은 방마다 하나: 투게더룸 `#myChatBtn`(💬 채팅) · 워킹룸 `#myDemojiBtn`(😊 이모티콘) · 혼자면 없음. ▾(`#myStatusChipBtn`) 앞 점은 지금 상태 색(app.js `refreshMyStatusUI`), 안 읽은 일정이 있으면 ▾ 에도 빨간 점(CSS `:has(#myBellBadge.on)`).
- **내보내는 것**: `updateMyStatusChipPosition` · `_positionCascade` · `_repositionOpenChipPopups` 등(머리 주석 목록).
- **함정**
  - `#myStatusChipBtn` 은 회사원 모드로 숨겨도 남는 유일한 버튼이고 **우클릭**이 숨김 · 되돌리기다(app.js `bindOfficeHideGesture`). `#myStatusChip` 밖으로 옮기면 클릭 통과 화이트리스트에서 빠져 되돌릴 길이 없다.
  - 메뉴 안 🎵 · 🎧 줄이 연 창은 그 줄이 아니라 ▾ 옆에 놓는다(🔔 일정 창은 예전처럼 발 밑 · 기억한 자리) — 메뉴가 닫히면 줄 자리가 의미가 없다(listen-ui.js 도 같은 기준).
  - F키는 메뉴 안 버튼 id(`myFocusGearBtn` · `myWardrobeBtn` · `myMoveBtn` · `myHomeMenuBtn`)를 클릭한다 — id 를 바꾸지 않는다.
- **검사**: `checks/sim-status-chip.js`(2-2절 — ▾ 열고 닫기 · 투게더룸이면 춤 · 룰렛 숨김 · 상태 고르면 닫힘 · mutation test).

## bgm-diag.js — 🔍 플레이리스트 소리 진단 줄

- **책임**: «곡은 넘어가는데 소리만 없다» 를 설치본에서 가르는 한 줄(`#myPlDiag` — 음악 줄 아래). main.js 광고 게이트(`bgmStartAdGate`)가 음소거를 정할 때 본 값을 1초마다 `companion:bgmDiag` 로 보내 오면 그린다(페이지가 답을 안 해도 interval 에서 «답 없음 · 기다리는 확인 수» 를 보낸다). 읽기만 한다 — 음소거 · 음량은 게이트가 정한다.
- **만드는 법**: `TwBgmDiag.createBgmDiag({ companion: window.companion })` — app.js 의 플레이리스트 만드는 줄 바로 아래. 밖에서 부르는 이름 없음.
- **내보내는 것**: 순수 함수 `read(값)` · `suspect(값)`(이 값 하나가 이상한가) · `nextBadSince(since, 값, now)` · `held(since, now)`(5초 이어졌나) · `line(값)` · 기준 `HOLD_MS`(5초) · `PEEK_MS`(10초) · `FAIL_MIN`(8회) · `NO_REPLY_MS`(2초) — 검사가 돌린다.
- **언제 보이나**: ① 광고가 아닌데 앱 음소거가 안 풀림 · 게이트 확인이 8번 잇달아 실패 · 페이지가 2초 넘게 답을 안 함 — 이 상태가 5초 이어질 때만 저절로(곡을 불러오는 짧은 순간에 번쩍이지 않게) ② 음량 아이콘(`#myPlVolIco`)을 누르면 10초 동안(다시 누르면 처음부터 · 저장 안 함).
- **함정**: 곡이 닫히거나(`onBgmClosed`) 마이홈 BGM 이 창을 가져가면(`onBgmMode`) 값을 비운다 — 안 비우면 낡은 값이 남는다. «소리 신호 있음» 은 페이지가 소리를 내는가(`isCurrentlyAudible`)라 앱 음소거 중에도 있음일 수 있다. 글은 `textContent` 로만. 검사: `checks/sim-bgm-diag.js`.

## playlist.js — 서버가 원본인 내 목록

- **원본**: 내 세 벌 · 한마디 · 마이홈 공개 · 비공개는 서버(`GET` · `PUT /v2/me/playlist`)다. 이 기기 localStorage 에는 목록을 두지 않는다 — 기기 설정(반복 · 음량 · 미니미 · 창 자리)만 남는다 — 보는 프리셋 `tw.playlistCur` 은 계정 칸이고(S-4a) 만들 때가 아니라 확인 뒤 `loadLocal` 이 읽는다. 옛 목록 키(`tw.playlistSets` · `tw.playlist` · `tw.playlistBio` …)는 읽지도 쓰지도 않고, 로그아웃(account.js 지움 목록) 때 지워진다.
- **받기**(`_plPull`): 계정 확인을 통과한 뒤(`launcher/app-boot.js` 의 playlist 차례 — `plMod.start(session)`: 받기 다시 시도 · 올리기 3초 타이머와 비우기를 세션이 쥔다) · 계정 이어받기(account.js `plMod.reset()` → `plMod.pull()`) · 409 뒤 · [다시 시도] 를 눌렀을 때. 로그인 전(내 코드 없음 · `NO_TOKEN`)이면 서버를 부르지 않고 2초마다 기기 안에서만 확인한다. 못 읽으면(던짐) 혼자 다시 받지 않는다 — 다시 받는 길은 [다시 시도] 를 누르는 것과 플레이리스트 창을 여는 것(못 받은 상태일 때 한 번 · 받는 중이면 건너뜀)뿐이다. 받는 중에는 창에 「불러오는 중…」, 못 받으면 「못 불러왔어요 · [다시 시도]」, 빈 목록은 빈 화면이다. 같은 계정으로 받는 중에는 또 받지 않는다. 듣는 중에는 **서버를 부르기 전에** 미룬다(`PL_PLAYING_DEFER_MS` 30초마다 다시 봄 — 실패 재시도가 아니라 듣던 곡 보호).
- **잠금**(`_plCanEdit` — 남의 목록을 보는 중이 아니고 `_plLoaded` 참): 곡 넣기 · 지우기 · 순서 · 프리셋 이름 · 한마디 · 공개 · 비공개 · 남의 곡 담기가 이 하나로 막힌다. 받기 전과 409 로 다시 받는 동안 잠긴다. 듣기 · 재생 제어는 안 잠긴다.
- **저장**(`_plPublishNow`): 고치면 3초 debounce 뒤 `saveMine`. 한 번에 하나만 보낸다 — 보내는 중에 또 고쳤으면 끝난 뒤 최신 상태로 한 번 더(같은 판으로 두 번 보내면 두 번째가 409). 안 바뀌었으면(지문 같음) 안 쓴다. 결과는 `'ok'` · `'conflict'`(409 — 덮어쓰지 않고 목록을 잠근 채 서버 것을 다시 받아 화면을 바꾸고 「다른 기기에서 바뀐 목록을 불러왔어요」) · `'failed'`(오류 `E-PL-01` 을 이어지는 동안 한 번만 알리고 고친 내용은 화면에 그대로 · 혼자 다시 올리지 않는다 — 다음에 고치면(3초 뒤) 또는 창을 열면 다시 올리고, 성공하면 다시 알릴 수 있게 풀린다).
- **함정**: 계정을 놓거나 갈아탈 때 `reset()` 이 목록 · 걸린 저장 예약 · 보내는 중 결과를 모두 버린다(세대 번호) — 안 하면 앞 계정 목록이 새 계정에 올라간다. `reset()` 은 듣는 중인 곡을 멈추지 않는다.
- **끌 때 · 로그아웃**: 저장이 실패한 채이거나 고친 뒤 3초 모으기가 안 끝났으면 한 번만 올려 본다(`flushPending(uid)` 한 곳 — 둘이 다 와도 1). 앱을 끌 때(`beforeunload`)는 결과를 기다리지 않고, 로그아웃 올리기(account.js `_acctFlushToServer`)는 다른 항목처럼 기다린다(8초 상한). 되풀이 없음 · 로그인 전이면 요청 0.
- **검사**: `checks/sim-playlist.js` 5-2절 · `checks/sim-account-switch.js`.

## playlist-api.js — 🌐 플레이리스트 서버 경로 provider
- **책임**: 내 프리셋 세 벌 읽기 · 통째 저장(`GET` · `PUT /v2/me/playlist`) · 무작위 파도타기(`GET /v2/playlists/random`) · 남의 목록(`GET /v2/playlists/{userCode}`). 서버 모양(`tracks[{videoId,title}]` · 늘 3칸 · `listed`)을 화면 모양(`items[{id,title}]` · `private`)으로 맞추는 곳은 여기뿐이다. 신원은 토큰(내 것은 `/v2/me/…`) — 남의 것은 사용자 코드(경로의 코드는 데이터 주소일 뿐).
- **만드는 법**: `window.TwPlaylistApi.createPlaylistApi({ authed, random, warn })` — app.js 가 플레이리스트보다 먼저 만들어 playlist.js 에 `playlistApi` deps 로 넘긴다.
- **deps**: `authed`(로그인 API 통로 `TwApi.authed` — `get(path, { auth: true })` · `put(path, body)`) · `random()`(곡 있는 벌을 고를 때) · `warn(...)`(진단 로그).
- **내보내는 것**: `fetchMine(uid)`(빈 목록도 객체 · 못 읽으면 던짐) · `saveMine(uid, sets, meta)` → `'ok'` \| `'conflict'`(409) \| `'failed'` · `fetchRandom(excludeUid)` → 한 벌 \| null(들을 것 없음) · `fetchOf(userCode)` → 한 벌 \| null(곡 있는 벌 없음 · 열어 주지 않음 · 없는 사용자).
- **함정**
  - 서버엔 고친 시각이 없고 판(`version`)이 있다 — 저장은 마지막으로 읽은 판을 싣는다(계정별 기억). 읽은 판이 없으면 보내지 않고 `'failed'`. 409 면 다시 보내지 않고 `'conflict'` 를 돌려주며 판을 버린다 — 부르는 쪽이 `fetchMine` 으로 서버 것을 다시 받는다(남의 고침을 덮어쓰지 않는다).
  - 🔒 **프리셋 나만 보기는 서버가 알 때만** — `fetchMine` 이 `lockable`(세 벌 모두 `locked` 참/거짓을 받았나)을 돌려주고, 그때만 playlist.js 가 자물쇠를 보이고 `saveMine` 이 벌마다 `locked` 를 싣는다. 모르는 서버에 실으면 400, 아는 척하면 잠근 곡이 남에게 보인다. 남의 목록에 잠긴 벌이 실려 와도 고르지 않는다.
  - **서버 쓰기는 읽은 토큰 주인과 묶는다** — `fetchMine` 이 판과 함께 그 토큰의 주인을 기억하고 `saveMine` 이 `expectOwner` 로 보낸다. 읽은 뒤 로그인한 사람이 바뀌었으면 PUT 없이 `'stale'`(playlist.js 는 알림 · 다시 올리기 없이 버린다 — 곧 reset · 다시 받기가 온다).
  - 목록을 전부 비워도 같은 저장이다(빈 세 벌 + 한마디) — 노드를 지우는 길은 없다.
  - 저장은 서버 상한(세 벌 · 곡 20 · 이름 16 · 제목 60 · 한마디 140)으로 깎는다. 서버가 거절하면(400) 다시 보내지 않고 `'failed'`.
  - 파도타기 «없음»(`null`)과 «못 불러옴»(던짐)을 가른다 — 부르는 쪽(playlist.js)은 앞엣것에 «아직 파도탈 목록이 없어요» · 뒤엣것에 «인터넷 연결이 필요해요». 404 `USER_NOT_FOUND` 와 403 `PLAYLIST_FRIENDS_ONLY` 는 «없음» 쪽이다.
  - 명함(이름 · 레벨 · 사진)은 이 provider 가 아니라 deps `fetchPlaylistCard` 가 맡는다 — app.js 가 `shared/api-public-reads.js` 로 만들어 넘긴다(서버 명함 묶음`GET /v2/myhomes/cards?codes={userCode}` · firebaseAPI 를 거치지 않는다). 이 모듈이 다루는 `uid` 는 userCode 라 그대로 키가 된다. 한 틱에 여럿을 물으면 요청 하나로 묶고, 못 받으면 던진다(playlist.js 가 E-PL-03).
- **검사**: `checks/sim-playlist-api.js`(가짜 `authed` 로 실제로 불러 판정 · mutation test).

## user-status.js — 🫧 활동 상태 · 내 칩 · 커스텀 상태 · 좌석 xf 저장

- **책임**: 내 상태 `userStatus`(계정 칸 `tw.userStatus` 저장 · 불러오기 · `setUserStatus` → 칩 · 메뉴 · 방에 알림) · 좌석 + 상태키 → 화면에 쓸 상태 설정 `statusConfFor`(커스텀 · 상태가 없을 때 내 좌석에만 «오늘 기록 전시») · 커스텀 문구 저장 `saveCustomStatusConf` · 내 칩 · 메뉴 다시 그리기(`refreshMyStatusUI` · `refreshCustomStatusMenuItem` — 프리미엄이 아니면 커스텀 항목 숨김) · `saveSeatXf`(좌석 크기 · 높이 · 방향을 `def.xf` 와 슬롯에 저장). 상태 표(`USER_STATUSES`)는 `user-status-table.js` 가 가진다. 앱 FSD 분리 M9 — app.js USER STATUS 구역을 글 그대로 옮겼다.
- **만드는 법**: `TwUserStatus.createUserStatus({ accountStoreMod, clampCharY, findMySeat, isPremium, slots, userStatusTableMod })` 뒤 `userStatusMod.attachStatusHooks({ setCustomStatus, setUserStatus, focusShowMine, hexToRgba, saveSlots })` — `isPremium` · `slots` 는 읽는 함수. 방 알림 · 오늘 기록 전시 · 슬롯 저장 · 칩 색 변환은 다른 도메인이라 이 모듈이 그쪽 모듈을 부르면 모듈 순환이 되므로(sim-dep-cycles) app.js 가 알림만 건다.
- **내보내는 것**: `attachStatusHooks` · `userStatus()`(읽기만 — 바꾸는 곳은 `setUserStatus` · `loadUserStatusFromStorage` · `resetLocal` 셋) · `resetLocal`(세션이 끝날 때 처음 값 — `launcher/user-local.js` 의 status 조각) · `_premiumOn` · `saveCustomStatusConf` · `statusConfFor` · `setUserStatus` · `loadUserStatusFromStorage` · `refreshMyStatusUI` · `refreshCustomStatusMenuItem` · `saveSeatXf`.
- **함정**
  - `window.setUserStatus` 고리는 **app.js 가** 건다 — `presence.js` · `room-sync.js` 가 `window.` 로 부른다. `_premiumOn` 은 다른 모듈에 deps 로 넘긴다(window 고리 없음).
  - `_premiumOn` 은 `isPremium`(파일 뒤쪽 let)을 `try` 로 읽는다 — 초기화 때 불려도 TDZ 로 죽지 않게.
  - `loadUserStatusFromStorage` 는 먼저 비운다 — 계정 칸이 열리기 전에 자동 자리비움이 바꿨을 수 있어 계정 칸 값만 믿는다.
  - 커스텀 상태 항목은 상태 드롭다운 안의 `stItem` 이라 `textContent` 를 통째로 갈아치우면 안 된다(`.csEmo` · `.csLabel` 이 따로 있다).
  - 검사: `checks/sim-user-status.js`.

## seat-state.js — 🫧 좌석 활동 판정 · 활동 시각 · 쓰다듬기 시작

- **책임**: `seatState(seat, now)` — 좌석 하나의 지금 상태 키(idle · focus · sleep · pet · shaking · dizzy · dance) 정하기. 활동 시각 `lastActivity`(타이핑 모션용 — 포커싱 게이트에 걸림) · `lastAnyInput`(자동 자리비움용 «실제 입력») · 창 포커스 · 펜 앱(집중 창 4초) · 투게더워킹 창이 맨 앞인지. `triggerPet`(쓰다듬기 시작 · 눈 깜빡임 펄스). 앱 FSD 분리 M10 — 만들 때 mousemove · keydown · wheel · visibilitychange · blur · focus 듣기를 한 번 건다.
- **만드는 법**: `TwSeatState.createSeatState({ desktopMode, figureMode, focusGate, focusGateSleep, focusLevelMod, seatPanelMod, userStatusMod })` — `focusGate` 는 «투게더워킹 창이 앞이면 안 잠듦» 규칙(`focus/focus-gate.js` — `window-mode.js` 와 같은 한 벌).
- **내보내는 것**: `FOCUS_MS` · `SLEEP_MS` · `PET_MS` · `PEN_FOCUS_MS` · `focusWindowMs` · `activity` · `anyInput` · `seatState` · `triggerPet` · 시각 읽기 `lastActivity()` · `lastAnyInput()` · `penAppFocused()` · 쓰기 `setLastActivity` · `setLastAnyInput` · `setPenAppFocused` · `setSelfAppActive`(`setPenAppFocused` · `setSelfAppActive` 는 `launcher/window-mode.js` `_applyActiveAppState` 가, `setLastActivity` · `setLastAnyInput` 은 `desktop-run.js` 가 건다).
- **함정**
  - `lastActivity` 와 `lastAnyInput` 을 합치지 말 것 — 앞은 포커싱 게이트에 걸려 «타이핑 모션», 뒤는 어떤 앱을 쓰든 «사람이 만지고 있나».
  - 판정 순서가 곧 우선순위다(액자 고정 · 흔들기 · 어지러움 · 쓰다듬기 · 춤 · 자리비움 · 친구 상태 · 수동 · 창 포커스 · 게이트 · 폰 · 입력 간격).
  - 검사: `checks/sim-seat-state.js`.

## noise.js — 🌙 백색소음

- **책임**: 예전엔 app.js 다음 `<script>` 로 실려 app.js 맨 위 이름을 그냥 불렀다. 지금은 `TwNoise.createNoise(deps)` 로 받는다 — app.js 보다 먼저 싣고(html), app.js 끝의 «화면 모듈 둘(M23)» 줄에서 INIT 뒤에 만든다.
- **받는 deps**: 값 `officeModeMod` · `seats` · `hiddenSeatsMod` · `Presence` · 함수 둘(`findMySeat` · `seatState`).
- **함정**: 소리 자료(`noise-sounds.js`)를 이 모듈보다 먼저 싣는다. 검사: `checks/sim-global-deps.js`.
## playlist-like.js · playlist-like-ui.js — 👍 플레이리스트 «노래가 좋아요»
- 🚧 0.13 위(0.14.0): deps `enabled` — `TwServerFeatures.on('playlistLike')` 가 꺼지면 줄을 숨기고 읽지 않는다. net 은 `TwServerFeatures.noServer('playlistLike')`(#1100).

- **책임**: 남의 플레이리스트(프리셋 하나)에 «노래가 좋아요 👍» 를 한 번 남긴다. 받는 사람(주인)만 그 프리셋의 👍 수를 본다 — 누가 눌렀는지는 안 보이고, 누르는 사람에게는 수가 안 보인다(사용자 결정).
  - `playlist-like.js`(순수 · DOM 없음): `presetKey` · `view`(무엇을 보일지) · `createPlaylistLikeNet({ db, ref, get, update })` → `{ read, like }`. firebase-init.js 가 `firebaseAPI.playlistLike` 로 잇는다.
  - `playlist-like-ui.js`: 소개칸의 반응 줄(내 목록 👍 수 · 남의 목록 [💬 반응]) · 창 옆 서랍. app.js 가 플레이리스트보다 먼저 만들어 `playlistLikeUi` 로 넘긴다.
- **deps**(ui): `likeRules`(TwPlaylistLike) · `net`(`() => firebaseAPI.playlistLike` — 서버 연결이 늦게 붙어 부를 때 찾는다) · `getMyUserId` · `notifyError`.
- **내놓는 것**(ui): `render({ ro, ownerId, setIdx } | null)` — playlist.js `_plLikeSync` 가 소개칸을 그릴 때 · 창을 열고 닫고 접을 때 부른다(null 이면 읽지 않고 숨김) · `close()`.
- **서버 자리**: `playlistLikes/{주인 코드}/{프리셋 0~2}` — `count`(로그인한 누구나 읽음) · `by/{누른 사람 auth uid}`(true · 본인만 읽음) · `last`(이번에 누른 auth uid · 아무도 못 읽음).
- **함정**
  - «한 번» · «숫자 부풀리기 막기» 는 규칙이 지킨다: by 는 로그인 토큰 칸(`auth.uid === $authUid`)에 처음 만들 때만, count 는 그 같은 묶음에서 +1 만(last 가 새 by 를 가리켜야 한다). 지우기 · 취소는 없다.
  - ⚠️ 표시를 친구 코드 칸에 두지 말 것 — 빈 코드를 내 uid 에 새로 이어 붙일 수 있어(userAuth) 코드를 바꿔 가며 끝없이 누를 수 있다. 친구 코드는 «내 것인가» 를 가를 때만(userAuth/{주인} !== auth.uid).
  - 둘이 동시에 누르면 늦은 쪽이 규칙에 막힌다 — 다시 읽고 `RETRY_MAX` 번까지 다시 쓴다.
  - 프리셋 번호는 주인의 프리셋 «자리» 다. 이름 · 곡을 바꿔도 수는 그 자리에 남는다.
  - 읽기는 «누구의 몇 번 프리셋» 이 바뀔 때만 한 번 — 내 것이면 수 하나 · 남의 것이면 내 표시 하나. 수는 누를 때만 읽는다(규칙이 «이전 값 +1» 만 받는다). 창이 닫혀 있으면 읽지 않는다.
  - 규칙의 count 읽기는 로그인한 누구나 그대로다 — 앱이 +1 을 쓰려면 읽어야 한다. 읽기까지 막으려면 함수가 대신 올려야 한다(나중).
  - 내 수를 못 읽으면 줄을 숨긴다(0 으로 그리지 않는다).
  - 검사: `checks/sim-playlist-like.js`(진짜 규칙식을 진짜 서버 모듈 쓰기에 걸어 돌린다) · `sim-playlist.js`(넘기는 값).
