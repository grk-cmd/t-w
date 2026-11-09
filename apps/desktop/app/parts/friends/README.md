# app/parts/friends — 친구 데이터 포트 · provider 사용법

층: 화면(myhome-inbox · room-invite-ui …) → 도메인(`myhome/friends-sub.js`) → **포트(`friends-port.js`)** → provider(firebase 옛 길 · api · **realtime 접속 상태**).
화면 · 도메인은 Firebase · API 를 모른다. provider 를 갈아 끼우면 위층은 그대로다.

## friends-port.js — 친구 데이터 포트
- 책임: 친구 목록 받기(`listFriends`) · 목록(추가 · 삭제) 듣기(`watchList`) · 접속 상태 듣기(`watchPresence`) · 프로필 듣기(`watchProfile`) 를 provider 로 잇는다.
  목록 받기 · 친구 한 명 받기(`readFriend`)는 **api 먼저 → 못 받으면 옛 길(firebase)**. 접속 상태(듣기 · 읽기)는 **realtime provider 하나**(`friends-presence-rt.js`) — 옛 길로 넘어가지 않는다. 목록 듣기 · 프로필 듣기 · 프로필 새로 읽기(`readProfile`)는 아직 옛 길(`LIVE_SOURCE` 자리).
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
  - `watchPresence(myId, ids, onChange, onStatus)` → 해제 함수 — onChange({ 친구id: { online, lastSeen, room, inRoom } }) · onStatus(`'waiting'` | `'live'`). 목록이 열려 있는 동안만 건다(friends-sub.js).
  - `readPresence(ids)` → Promise<{ 친구id: 접속 상태 }> — 목록이 닫혀 있을 때 그 친구들만 요청 하나로(놀러 가기 · 파도타기 친구 고르기). 못 받으면 던진다.
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
  프로필(이름 · 레벨 · 회차)은 목록이 열려 있는 동안만 친구별로(`watchFriendProfile`). 접속 상태는 realtime 으로 옮겨 이 파일에 없다. 예전 친구별 4개 상시 구독(subscribeMyFriends)은 없앴다.
  프로필은 규칙상 작은 칸 여섯뿐(name ≤20자 · level · cyc · clv · starC · updatedAt — 그 밖은 `.validate: false`)이라 통째로 듣는다. 들은 값은 카드 기억에도 얹는다(다시 열 때 옛 이름이 안 돌아오게).
- 만드는 법(app.js):
  ```js
  const friendsFirebaseMod = TwFriendsFirebase.createFriendsFirebase({
    getList: (...a)=>firebaseAPI.getMyFriendList(...a),          // users/{나}/friends 한 번
    watchList: (...a)=>firebaseAPI.watchMyFriendList(...a),      // 목록 구독 하나(추가 · 삭제)
    getCard: (...a)=>firebaseAPI.getFriendCard(...a),            // 프로필 · 소개 · 사진 세 칸 한 번
    watchProfile: (...a)=>firebaseAPI.watchFriendProfile(...a),  // 친구 한 명 profile 구독(목록이 열려 있는 동안)
    getProfile: (...a)=>firebaseAPI.getFriendProfile(...a),      // 친구 한 명 profile 한 번(마이홈 구경)
    setTimer: (fn, ms)=>setTimeout(fn, ms), clearTimer: (id)=>clearTimeout(id), now: ()=>Date.now(),
  });
  ```
- `readFriend(fid)` — 친구 한 명 카드(`getFriendCard`). 목록 받기와 같은 10분 기억을 쓴다 · 못 읽으면 지난 카드 · 없으면 null.
- 순수: `cardOf(raw)`(이름 · 레벨 · 회차 · 소개 · 사진) · `profileOf(raw)`(이름 · 레벨 · 회차 — cardOf 와 같은 거르기) · 상수 `PROFILE_BATCH_MS`(50) · `CARD_KEEP_MS`(10분).
- 함정:
  - 프로필 콜백은 친구 수만큼 한꺼번에 온다 — 50ms 창에 한 번만 넘긴다(스로틀 · 뒷날). 디바운스로 바꾸면 계속 오는 동안 영영 안 그린다.
  - 검사: `checks/sim-friends-port.js`(2-1절이 친구 n명 → 평소 1개 · 목록 열면 1 + n 을 센다) · `checks/sim-friend-profile-live.js`(이름이 바뀌면 목록 · 마이홈 구경 값이 바뀌는지).

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
    get: (...a)=>firebaseAPI.apiGetAuthed(...a),   // 로그인 API 통로 — api-client.js 의 TwApi.authed(쉬기 끔 · 토큰은 bindToken)
    getCard: (...a)=>firebaseAPI.fetchUserCardApi(...a),   // 친구 한 명 명함 — 공개 읽기 통로(api-public-reads.js)
    wait: (ms)=>new Promise(r=>setTimeout(r, ms)),
    warn: (...a)=>console.warn(...a),
  });
  ```
- 순수: `friendsOf(data)`(응답 → { 친구id: 친구 } · 모양이 틀리면 undefined) · `cardOf(c)`(목록 줄 · 명함 → 친구 칸 한 벌 — 명함의 `avatarInline` 은 불리언이라 사진이 안 된다) · `retryable(err)`.
- 확장할 때: 응답 칸이 늘면 `friendsOf` 한 곳. 다시 묻기 규칙은 상수 둘과 `retryable`.
- 함정:
  - 통로는 쉬기를 끈 로그인 통로(`TwApi.authed` — 토큰은 firebase-init 이 `bindToken` 으로 잇는다)를 쓴다. 공용 `TwApi.client` 를 쓰면 쉬는 동안 다시 묻기가 묻지도 않고 끝나고, 이 경로 실패 하나가 원격 설정 · 공개 읽기까지 30초 쉬게 한다.
  - 응답 `truncated` 로 잘린 친구 · 서버 사본이 늦어 없는 친구는 이름이 자리표시('...')로 남는다 — 누가 친구인지는 옛 길 목록 구독(watchList)만 본다.

## friends-presence-rt.js — 접속 상태 provider(realtime 연결 하나 · `TwRtHub.store`)
- 책임: 친구 접속 상태를 realtime 으로. 한 번 읽기 `readPresence(ids)` = `presenceGet`(한 번에 100명 — `PRESENCE_IDS_MAX` — 넘으면 나눠 보내고 합친다). 듣기 `watchPresence(ids, onChange, onStatus)` = `watch` 하나(처음 전체 → 그 뒤 **바뀐 친구만** 서버가 알려 줌 — 친구마다 구독하지 않는다) · 풀면 `unwatch`.
- 만드는 법(app.js): `TwFriendsPresenceRt.createFriendsPresenceRt({ rt: TwRtHub.store })` — 포트의 `presence` 로 넘긴다. 만들 때 요청 · 구독 없음.
- 상태(`onStatus`): `waiting`(처음 전체를 기다림 — 보냄 · 연결이 붙지 않음) · `live`(처음 전체를 받음). 연결이 멈췄나는 rt-hub 의 판단이고 화면은 끊김 정책 몫이라 여기서 따로 들지 않는다(멈춤 상태 목록을 사본으로 들면 rt-hub 가 늘린 상태와 어긋난다).
- 함정:
  - 서버의 듣기는 **연결에 묶여** 있다 — 끊겼다 다시 붙으면 `watch` 를 다시 보낸다(연결 상태 알림으로. 타이머 되풀이 아님).
  - `rid` 가 붙은 presence 는 `presenceGet` 의 답이다 — 시간 초과 뒤 늦게 온 것은 듣기 값이 아니라 버린다.
  - 읽기는 **못 받으면 던진다**(빈 값 `{}` 와 다르다). 조각 중 하나라도 못 받으면 던진다. 서버는 친구가 아닌 id · 친구 목록을 못 받았을 때 그 id 를 답에서 빼니 «답에 없음» 은 «모름» 이다(오프라인으로 꾸미지 않는다).
  - 듣기는 하나뿐 — 새로 걸면 앞의 것을 푼다.
  - 검사: `checks/sim-friends-presence-rt.js`(진짜 rt-hub · 가짜 웹소켓 — 250명 나눠 보내기 · 다시 붙기 · 깨 보기).

## presence-self.js — 내 접속 표시를 realtime 에 알림
- 책임: 친구에게 «온라인 / 오프라인으로 보일지»(`status { visible }`)를 알린다. 서버는 알린 적 없는 사람을 오프라인으로 보므로 `start(visible)`(마이홈 처음 준비 — 🔒 고정값을 앉힌 뒤) 부터, 값이 바뀔 때(`setVisible`) · **연결이 붙을 때마다** 보낸다. 방 · 방 안 여부는 서버가 안다.
- 만드는 법(app.js): `TwPresenceSelf.createPresenceSelf({ rt: TwRtHub.store, onUnload })` — `presence-lock.js` 가 `startVisible` · `setVisible` 로 부른다. `reset()` 은 계정을 놓을 때(friends-sub `stop` 과 같은 `onUnload` 자리) — 값을 시작 전(`null`)으로 되돌리고 연결 상태 구독을 푼다. 없으면 다음 계정이 붙는 순간 앞 계정의 보이기 값을 보낸다.
- 함정: 옛 Firebase presence 쓰기(`setMyPresenceOnline` · `setMyPresenceState`)는 **아직 남아 있다** — 웹 관리자(마지막 접속 · 버전)와 규칙의 버전 검사(`presence/ver`)가 읽는다. 걷으려면 그쪽을 먼저 서버로 옮긴다.
