# app/parts/friends — 친구 데이터 포트 · provider 사용법

층: 화면(myhome-inbox · room-invite-ui …) → 도메인(`myhome/friends-sub.js`) → **포트(`friends-port.js`)** → provider(firebase 옛 길 · api · ws 자리).
화면 · 도메인은 Firebase · API 를 모른다. provider 를 갈아 끼우면 위층은 그대로다.

## friends-port.js — 친구 데이터 포트
- 책임: 친구 목록 받기(`listFriends`) · 목록(추가 · 삭제) 듣기(`watchList`) · 접속 상태 듣기(`watchPresence`) 를 provider 로 잇는다.
  목록 받기는 **api 먼저 → 못 받으면 옛 길(firebase)**. 듣기 둘은 아직 옛 길(ws 는 다음 단계 — `LIVE_SOURCE` 자리).
- 고르기: `pickListSource(apiOn, hasApi)` **한 함수**만 고른다. 스위치는 원격 설정 `flags.friendsApi`(기본 켜짐 — 쓰기 원본 Firebase `config/flags/friendsApi`).
  끄면 api 를 부르지도 않고 옛 길만. 비율 · 단계 켜기는 없다.
- 만드는 법(app.js):
  ```js
  const friendsPortMod = TwFriendsPort.createFriendsPort({
    firebase: friendsFirebaseMod,   // 옛 길 provider
    api: friendsApiMod,             // api provider(없으면 null — 옛 길만)
    apiOn: ()=>{ const s = acctStateMod._rcStore(); return s ? s.friendsApi() : true; },
    warn: (...a)=>console.warn(...a),
  });
  ```
- 내보내는 것:
  - `listFriends(myId, opts)` → Promise<{ 친구id: 친구 }> — `opts.idsOnly` 면 id · addedAt 만 있으면 된다(판정용).
  - `watchList(myId, onChange, onError)` → 해제 함수 — onChange({ 친구id: { addedAt, … } }).
  - `watchPresence(myId, ids, onChange)` → 해제 함수 — onChange({ 친구id: { online, lastSeen, room, inRoom } }).
  - `lastSource()` → `'api'` · `'firebase'` · null — 마지막 목록 받기가 어디서 왔나(진단).
  - 친구 하나의 모양: `{ addedAt, name, level, cyc, clv, starC, bio, avatar, online, lastSeen, room, inRoom }` — 없는 칸은 그 provider 가 모르는 값.
- 쓰는 예: friends-sub.js deps — `subscribe: (...a)=>friendsPortMod.watchList(...a)` · `fetchOnce: (id)=>friendsPortMod.listFriends(id, { idsOnly:true })`.
- 확장할 때: 새 provider 는 같은 세 함수를 가진 객체로 만들고 포트 deps 에 더한다. 화면 쪽은 고치지 않는다.
- 함정: 포트 위(도메인 · 화면)에서 `firebaseAPI` 친구 함수를 직접 부르지 않는다(sim-friends-port 3절이 센다).

## friends-firebase.js — 옛 길 provider(Firebase · 나중에 걷음)
- 책임: firebase-init.js 의 친구 함수를 포트 모양으로 바꾼다. firebaseAPI 를 직접 부르지 않고 app.js 가 deps 로 잇는다.
- 만드는 법(app.js):
  ```js
  const friendsFirebaseMod = TwFriendsFirebase.createFriendsFirebase({
    getList: (...a)=>firebaseAPI.getMyFriendList(...a),     // users/{나}/friends 한 번
    watchAll: (...a)=>firebaseAPI.subscribeMyFriends(...a), // 목록 + 친구별 프로필 · 접속 · 소개 · 사진
  });
  ```
- 함정: 옛 구독(watchAll)이 접속 상태까지 실어 오므로 `watchPresence` 는 빈 해제 함수다. 검사: `checks/sim-friends-port.js`.

## friends-api.js — api provider(GET /v1/me/friends · t-w-server)
- 책임: 내 친구 목록(이름 · 레벨 · 소개 · 사진 · 서로 친구)을 서버에서 한 번 받는다. 실패하면 던진다 — 포트가 옛 길로 넘긴다.
- 요청 규칙(사용자 확정 10-17 · 숫자는 모듈 위 상수):
  - 한 번 `REQUEST_TIMEOUT_MS`(5초). 서버 문제(연결 실패 · 시간 초과 · 5xx)면 `RETRY_DELAYS_MS`(1초 · 3초 뒤) 두 번 더 — 총 3번.
  - 401(연결 없는 옛 계정 · 토큰 없음) · 400 · 그 밖의 4xx · 모양이 틀린 응답은 다시 안 묻고 바로 옛 길(400 은 진단 로그).
  - 실패를 기억하지 않는다 — 다음에 목록을 열면 다시 서버부터.
- 헤더: `Authorization: Bearer <Firebase ID 토큰>`(api-client.js `getToken`) · `X-User-Code: <내 코드>`.
- 만드는 법(app.js):
  ```js
  const friendsApiMod = TwFriendsApi.createFriendsApi({
    get: (...a)=>firebaseAPI.apiGetAuthed(...a),   // 로그인 API 통로 — firebase-init.js 가 공용 주소 · ID 토큰 · 쉬기 끔으로 만든다
    wait: (ms)=>new Promise(r=>setTimeout(r, ms)),
    warn: (...a)=>console.warn(...a),
  });
  ```
- 순수: `friendsOf(data)`(응답 → { 친구id: 친구 } · 모양이 틀리면 undefined) · `retryable(err)`.
- 확장할 때: 응답 칸이 늘면 `friendsOf` 한 곳. 다시 묻기 규칙은 상수 둘과 `retryable`.
- 함정:
  - 통로는 쉬기를 끈 **따로 만든 것**(firebase-init.js `_authApi`)을 쓴다 — 토큰을 아는 곳이 거기라 app.js 가 만들면 api-client ↔ firebase-init 순환이 생긴다. 공용 `TwApi.client` 를 쓰면 쉬는 동안 다시 묻기가 묻지도 않고 끝나고, 이 경로 실패 하나가 원격 설정 · 공개 읽기까지 30초 쉬게 한다.
  - 응답 `truncated` 로 잘린 친구 · 서버 사본이 늦어 없는 친구는 이름이 자리표시('...')로 남는다 — 누가 친구인지는 옛 길 목록 구독(watchList)만 본다.
