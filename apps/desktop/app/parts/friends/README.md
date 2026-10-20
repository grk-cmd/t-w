# app/parts/friends — 친구 데이터 포트 · provider 사용법

층: 화면(myhome-inbox · room-invite-ui …) → 도메인(`myhome/friends-sub.js`) → **포트(`friends-port.js`)** → provider(firebase 옛 길 · api · ws 자리).
화면 · 도메인은 Firebase · API 를 모른다. provider 를 갈아 끼우면 위층은 그대로다.

## friends-port.js — 친구 데이터 포트
- 책임: 친구 목록 받기(`listFriends`) · 목록(추가 · 삭제) 듣기(`watchList`) · 접속 상태 듣기(`watchPresence`) · 프로필 듣기(`watchProfile`) 를 provider 로 잇는다.
  목록 받기 · 친구 한 명 받기(`readFriend`)는 **api 먼저 → 못 받으면 옛 길(firebase)**. 듣기 셋 · 프로필 새로 읽기(`readProfile`)는 아직 옛 길(ws 는 다음 단계 — `LIVE_SOURCE` 자리).
- 고르기: 받는 곳은 `shared/source-switch.js`(기능 `'friends'`)가 고르고 넘어가기도 그 `serverFirst` 한 벌이다. 스위치는 원격 설정 `sources.friends`(웹 관리자 «🎚️ 기능 스위치» · 쓰기 원본 Firebase `config/sources/friends`), 칸이 없으면 옛 `flags.friendsApi`(기본 켜짐). api provider 가 없으면 실패가 아니라 바로 옛 길.
  끄면 api 를 부르지도 않고 옛 길만. 비율 · 단계 켜기는 없다.
- 만드는 법(app.js):
  ```js
  const friendsPortMod = TwFriendsPort.createFriendsPort({
    firebase: friendsFirebaseMod,   // 옛 길 provider
    api: friendsApiMod,             // api provider(없으면 null — 옛 길만)
    source: ()=>TwSourceSwitch.store.pick('friends'),
    serverFirst: TwSourceSwitch.serverFirst,
    warn: (...a)=>console.warn(...a),
  });
  ```
- 내보내는 것:
  - `listFriends(myId, opts)` → Promise<{ 친구id: 친구 }> — `opts.idsOnly` 면 id · addedAt 만 있으면 된다(판정용).
  - `readFriend(fid)` → Promise<친구 | null> — 켠 뒤 새로 생긴 친구 한 명의 이름 · 레벨 · 사진(friends-sub 가 늘어난 id 만 부른다 · 목록 전체를 다시 받지 않게). null = 모름(없는 사람 · 옛 길도 못 읽음).
  - `watchList(myId, onChange, onError)` → 해제 함수 — onChange({ 친구id: { addedAt, … } }).
  - `watchPresence(myId, ids, onChange)` → 해제 함수 — onChange({ 친구id: { online, lastSeen, room, inRoom } }). 목록이 열려 있는 동안만 건다(friends-sub.js).
  - `readPresence(fid)` → Promise<접속 상태> — 목록이 닫혀 있을 때 그 친구만 한 번(놀러 가기 · 파도타기 친구 고르기).
  - `watchProfile(myId, ids, onChange)` → 해제 함수 — onChange({ 친구id: { name, level, cyc, clv, starC } }). 접속 상태와 같은 조건 · 같은 수명(목록이 열려 있는 동안 · friends-sub.js).
  - `readProfile(fid)` → Promise<프로필> — 한 번 새로 읽기(10분 기억 안 씀). 목록이 닫혀 있을 때 그 친구 마이홈 구경(friends-sub `refreshProfile`).
  - `lastSource()` → `'api'` · `'firebase'` · null — 마지막 목록 받기가 어디서 왔나(진단).
  - 친구 하나의 모양: `{ addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom }` — 없는 칸은 그 provider 가 모르는 값.
- 쓰는 예: friends-sub.js deps — `subscribe: (...a)=>friendsPortMod.watchList(...a)` · `fetchOnce: (id)=>friendsPortMod.listFriends(id, { idsOnly:true })` · `readFriend: (...a)=>friendsPortMod.readFriend(...a)`.
- 확장할 때: 새 provider 는 같은 세 함수를 가진 객체로 만들고 포트 deps 에 더한다. 화면 쪽은 고치지 않는다.
- 함정: 포트 위(도메인 · 화면)에서 `firebaseAPI` 친구 함수를 직접 부르지 않는다(sim-friends-port 3절이 센다).

## friends-firebase.js — 옛 길 provider(Firebase · 나중에 걷음)
- 책임: firebase-init.js 의 친구 함수를 포트 모양으로 바꾼다. firebaseAPI 를 직접 부르지 않고 app.js 가 deps 로 잇는다.
  **상시 구독은 목록(users/{나}/friends) 하나뿐** — 소개 · 사진은 목록을 열 때 한 번(`getFriendCard` · 10분 안이면 다시 안 읽음),
  접속 상태 · 프로필(이름 · 레벨 · 회차)은 목록이 열려 있는 동안만 친구별로(`watchFriendPresence` · `watchFriendProfile`). 예전 친구별 4개 상시 구독(subscribeMyFriends)은 없앴다.
  프로필은 규칙상 작은 칸 여섯뿐(name ≤20자 · level · cyc · clv · starC · updatedAt — 그 밖은 `.validate: false`)이라 통째로 듣는다. 들은 값은 카드 기억에도 얹는다(다시 열 때 옛 이름이 안 돌아오게).
- 만드는 법(app.js):
  ```js
  const friendsFirebaseMod = TwFriendsFirebase.createFriendsFirebase({
    getList: (...a)=>firebaseAPI.getMyFriendList(...a),          // users/{나}/friends 한 번
    watchList: (...a)=>firebaseAPI.watchMyFriendList(...a),      // 목록 구독 하나(추가 · 삭제)
    getCard: (...a)=>firebaseAPI.getFriendCard(...a),            // 프로필 · 소개 · 사진 세 칸 한 번
    watchPresence: (...a)=>firebaseAPI.watchFriendPresence(...a),// 친구 한 명 presence 구독
    getPresence: (...a)=>firebaseAPI.getFriendPresence(...a),    // 친구 한 명 presence 한 번
    watchProfile: (...a)=>firebaseAPI.watchFriendProfile(...a),  // 친구 한 명 profile 구독(목록이 열려 있는 동안)
    getProfile: (...a)=>firebaseAPI.getFriendProfile(...a),      // 친구 한 명 profile 한 번(마이홈 구경)
    setTimer: (fn, ms)=>setTimeout(fn, ms), clearTimer: (id)=>clearTimeout(id), now: ()=>Date.now(),
  });
  ```
- `readFriend(fid)` — 친구 한 명 카드(`getFriendCard`). 목록 받기와 같은 10분 기억을 쓴다 · 못 읽으면 지난 카드 · 없으면 null.
- 순수: `cardOf(raw)`(이름 · 레벨 · 회차 · 소개 · 사진) · `profileOf(raw)`(이름 · 레벨 · 회차 — cardOf 와 같은 거르기) · `presenceOf(raw)`(온라인 · 마지막 · 방 코드 · 방에 있음) · 상수 `PRESENCE_BATCH_MS`(50) · `CARD_KEEP_MS`(10분).
- 함정:
  - 접속 상태 콜백은 친구 수만큼 한꺼번에 온다 — 50ms 창에 한 번만 넘긴다(스로틀 · 뒷날). 디바운스로 바꾸면 계속 오는 동안 영영 안 그린다.
  - «방에 있음»(inRoom)은 코드(room)와 다른 칸이다 — 시크릿룸은 코드를 안 올린다. room 으로 판정하지 말 것.
  - 검사: `checks/sim-friends-port.js`(2-1절이 친구 n명 → 평소 1개 · 목록 열면 1 + 2n 을 센다) · `checks/sim-friend-profile-live.js`(이름이 바뀌면 목록 · 마이홈 구경 값이 바뀌는지).

## friends-api.js — api provider(GET /v1/me/friends · 친구 한 명 명함 · t-w-server)
- 책임: 내 친구 목록(이름 · 레벨 · 소개 · 사진 · 서로 친구)을 서버에서 한 번 받는다. 실패하면 던진다 — 포트가 옛 길로 넘긴다.
- 친구 한 명(`readFriend(fid)`): 공개 명함 `GET /v1/users/{uid}/card` 한 번(다시 묻기 없음). 경로 · 통로는 공개 읽기 한 곳(`shared/api-public-reads.js` — firebase-init 이 단 `fetchUserCardApi`)을 쓴다.
  `data: null` = 없는 사람 → null(옛 길로 다시 안 감). 모양이 틀리거나 못 받으면 던진다(옛 길로). 명함엔 소개가 없어 `bio: ''` — 다음 목록 받기(앱 시작 · 목록 첫 열기)가 채운다.
- 요청 규칙(사용자 확정 10-17 · 숫자는 모듈 위 상수):
  - 한 번 `REQUEST_TIMEOUT_MS`(5초). 서버 문제(연결 실패 · 시간 초과 · 5xx)면 `RETRY_DELAYS_MS`(1초 · 3초 뒤) 두 번 더 — 총 3번.
  - 401(연결 없는 옛 계정 · 토큰 없음) · 400 · 그 밖의 4xx · 모양이 틀린 응답은 다시 안 묻고 바로 옛 길(400 은 진단 로그).
  - 실패를 기억하지 않는다 — 다음에 목록을 열면 다시 서버부터.
- 헤더: `Authorization: Bearer <Firebase ID 토큰>`(api-client.js `getToken`) · `X-User-Code: <내 코드>`.
- 만드는 법(app.js):
  ```js
  const friendsApiMod = TwFriendsApi.createFriendsApi({
    get: (...a)=>firebaseAPI.apiGetAuthed(...a),   // 로그인 API 통로 — firebase-init.js 가 공용 주소 · ID 토큰 · 쉬기 끔으로 만든다
    getCard: (...a)=>firebaseAPI.fetchUserCardApi(...a),   // 친구 한 명 명함 — 공개 읽기 통로(api-public-reads.js)
    wait: (ms)=>new Promise(r=>setTimeout(r, ms)),
    warn: (...a)=>console.warn(...a),
  });
  ```
- 순수: `friendsOf(data)`(응답 → { 친구id: 친구 } · 모양이 틀리면 undefined) · `cardOf(c)`(목록 줄 · 명함 → 친구 칸 한 벌 — 명함의 `avatarInline` 은 불리언이라 사진이 안 된다) · `retryable(err)`.
- 확장할 때: 응답 칸이 늘면 `friendsOf` 한 곳. 다시 묻기 규칙은 상수 둘과 `retryable`.
- 함정:
  - 통로는 쉬기를 끈 **따로 만든 것**(firebase-init.js `_authApi`)을 쓴다 — 토큰을 아는 곳이 거기라 app.js 가 만들면 api-client ↔ firebase-init 순환이 생긴다. 공용 `TwApi.client` 를 쓰면 쉬는 동안 다시 묻기가 묻지도 않고 끝나고, 이 경로 실패 하나가 원격 설정 · 공개 읽기까지 30초 쉬게 한다.
  - 응답 `truncated` 로 잘린 친구 · 서버 사본이 늦어 없는 친구는 이름이 자리표시('...')로 남는다 — 누가 친구인지는 옛 길 목록 구독(watchList)만 본다.
