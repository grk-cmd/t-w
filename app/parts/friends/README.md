# app/parts/friends — 친구 데이터 포트 · provider 사용법

층: 화면(myhome-inbox · room-invite-ui …) → 도메인(`myhome/friends-sub.js`) → **포트(`friends-port.js`)** → provider(firebase 옛 길 · api · ws 자리).
화면 · 도메인은 Firebase · API 를 모른다. provider 를 갈아 끼우면 위층은 그대로다.

## friends-port.js — 친구 데이터 포트
- 책임: 친구 목록 받기(`listFriends`) · 목록(추가 · 삭제) 듣기(`watchList`) · 접속 상태 듣기(`watchPresence`) 를 provider 로 잇는다.
- 만드는 법(app.js):
  ```js
  const friendsPortMod = TwFriendsPort.createFriendsPort({
    firebase: friendsFirebaseMod,   // 옛 길 provider
  });
  ```
- 내보내는 것:
  - `listFriends(myId, opts)` → Promise<{ 친구id: 친구 }> — `opts.idsOnly` 면 id · addedAt 만 있으면 된다(판정용).
  - `watchList(myId, onChange, onError)` → 해제 함수 — onChange({ 친구id: { addedAt, … } }).
  - `watchPresence(myId, ids, onChange)` → 해제 함수 — onChange({ 친구id: { online, lastSeen, room, inRoom } }).
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
