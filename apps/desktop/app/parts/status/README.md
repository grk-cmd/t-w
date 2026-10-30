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

## playlist.js — 서버가 원본인 내 목록

- **원본**: 내 세 벌 · 한마디 · 마이홈 공개 · 비공개는 서버(`GET` · `PUT /v1/me/playlist`)다. 이 기기 localStorage 에는 목록을 두지 않는다 — 기기 설정(보는 프리셋 `tw.playlistCur` · 반복 · 음량 · 미니미 · 창 자리)만 남는다. 옛 목록 키(`tw.playlistSets` · `tw.playlist` · `tw.playlistBio` …)는 읽지도 쓰지도 않고, 로그아웃(account.js 지움 목록) 때 지워진다.
- **받기**(`_plPull`): 앱을 켜자마자 · 계정 이어받기(account.js `plMod.reset()` → `plMod.pull()`) · 409 뒤 · [다시 시도] 를 눌렀을 때. 로그인 전(내 코드 없음 · `NO_TOKEN`)이면 서버를 부르지 않고 2초마다 기기 안에서만 확인한다. 못 읽으면(던짐) 30초에서 두 배씩(10분 상한) 다시 받는다. 받는 중에는 창에 「불러오는 중…」, 못 받으면 「못 불러왔어요 · [다시 시도]」, 빈 목록은 빈 화면이다. 같은 계정으로 받는 중에는 또 받지 않는다. 듣는 중에는 **서버를 부르기 전에** 미룬다(30초마다 다시 봄).
- **잠금**(`_plCanEdit` — 남의 목록을 보는 중이 아니고 `_plLoaded` 참): 곡 넣기 · 지우기 · 순서 · 프리셋 이름 · 한마디 · 공개 · 비공개 · 남의 곡 담기가 이 하나로 막힌다. 받기 전과 409 로 다시 받는 동안 잠긴다. 듣기 · 재생 제어는 안 잠긴다.
- **저장**(`_plPublishNow`): 고치면 3초 debounce 뒤 `saveMine`. 한 번에 하나만 보낸다 — 보내는 중에 또 고쳤으면 끝난 뒤 최신 상태로 한 번 더(같은 판으로 두 번 보내면 두 번째가 409). 안 바뀌었으면(지문 같음) 안 쓴다. 결과는 `'ok'` · `'conflict'`(409 — 덮어쓰지 않고 목록을 잠근 채 서버 것을 다시 받아 화면을 바꾸고 「다른 기기에서 바뀐 목록을 불러왔어요」) · `'failed'`(오류 `E-PL-01` 을 이어지는 동안 한 번만 알리고 고친 내용은 화면에 그대로 · 30초 뒤부터 간격을 늘려 다시 올림 · 성공하면 처음으로).
- **함정**: 계정을 놓거나 갈아탈 때 `reset()` 이 목록 · 걸린 저장 예약 · 보내는 중 결과를 모두 버린다(세대 번호) — 안 하면 앞 계정 목록이 새 계정에 올라간다. `reset()` 은 듣는 중인 곡을 멈추지 않는다.
- **검사**: `checks/sim-playlist.js` 5-2절 · `checks/sim-account-switch.js`.

## playlist-api.js — 🌐 플레이리스트 서버 길 provider
- **책임**: 내 프리셋 세 벌 읽기 · 통째 저장(`GET` · `PUT /v1/me/playlist`) · 무작위 파도타기(`GET /v1/playlists/random`) · 남의 목록(`GET /v1/playlists/{userCode}`). 서버 모양(`tracks[{videoId,title}]` · 늘 3칸 · `listed`)을 화면 모양(`items[{id,title}]` · `private`)으로 맞추는 곳은 여기뿐이다. 신원은 토큰(내 것은 `/v1/me/…`) — 남의 것은 사용자 코드(경로의 코드는 데이터 주소일 뿐).
- **만드는 법**: `window.TwPlaylistApi.createPlaylistApi({ authed, random, warn })` — app.js 가 플레이리스트보다 먼저 만들어 playlist.js 에 `playlistApi` deps 로 넘긴다.
- **deps**: `authed`(로그인 API 통로 `TwApi.authed` — `get(path, { auth: true })` · `put(path, body)`) · `random()`(곡 있는 벌을 고를 때) · `warn(...)`(진단 로그).
- **내보내는 것**: `fetchMine(uid)`(빈 목록도 객체 · 못 읽으면 던짐) · `saveMine(uid, sets, meta)` → `'ok'` \| `'conflict'`(409) \| `'failed'` · `fetchRandom(excludeUid)` → 한 벌 \| null(들을 것 없음) · `fetchOf(userCode)` → 한 벌 \| null(곡 있는 벌 없음 · 열어 주지 않음 · 없는 사용자).
- **함정**
  - 서버엔 고친 시각이 없고 판(`version`)이 있다 — 저장은 마지막으로 읽은 판을 싣는다(계정별 기억). 읽은 판이 없으면 보내지 않고 `'failed'`. 409 면 다시 보내지 않고 `'conflict'` 를 돌려주며 판을 버린다 — 부르는 쪽이 `fetchMine` 으로 서버 것을 다시 받는다(남의 고침을 덮어쓰지 않는다).
  - 목록을 전부 비워도 같은 저장이다(빈 세 벌 + 한마디) — 노드를 지우는 길은 없다.
  - 저장은 서버 상한(세 벌 · 곡 20 · 이름 16 · 제목 60 · 한마디 140)으로 깎는다. 서버가 거절하면(400) 다시 보내지 않고 `'failed'`.
  - 파도타기 «없음»(`null`)과 «못 불러옴»(던짐)을 가른다 — 부르는 쪽(playlist.js)은 앞엣것에 «아직 파도탈 목록이 없어요» · 뒤엣것에 «인터넷 연결이 필요해요». 404 `USER_NOT_FOUND` 와 403 `PLAYLIST_FRIENDS_ONLY` 는 «없음» 쪽이다.
  - 명함(이름 · 레벨 · 사진)은 이 서버 길에 없다 — `firebaseAPI.fetchPlaylistCard`(공개 명함 읽기)가 그대로 맡는다.
- **검사**: `checks/sim-playlist-api.js`(가짜 `authed` 로 실제로 불러 판정 · 일부러 깨 보기).
