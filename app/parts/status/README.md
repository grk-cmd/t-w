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
  - 내 상태 값(`userStatus`) · 풀이(`statusConfFor`) · 칩 반영 · 커스텀 저장(방에 알림)은 app.js 에 남았다 — 옮기면 상태칩(status-chip.js) · 포커스 공유(focus-share.js)와 순환이 생기고, room-sync.js 가 `window.setUserStatus` 전역을 부른다.
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
