# app/parts/friends — 친구 데이터 포트 · provider 사용법

층: 화면(myhome-inbox · room-invite-ui …) → 도메인(`myhome/friends-sub.js`) → **포트(`friends-port.js`)** → provider(firebase 옛 길 · api · **realtime 접속 상태**).
화면 · 도메인은 Firebase · API 를 모른다. provider 를 갈아 끼우면 위층은 그대로다.

## friends-port.js — 친구 데이터 포트
- 책임: 친구 목록 받기(`listFriends`) · 목록(추가 · 삭제) 듣기(`watchList`) · 접속 상태 듣기(`watchPresence`) · 프로필 듣기(`watchProfile`) 를 provider 로 잇는다.
  목록 받기 · 친구 한 명 받기(`readFriend`) · 프로필 새로 읽기(`readProfile`)는 **api 먼저 → 못 받으면 옛 길(firebase)**. 목록 듣기 · 프로필 듣기 · 끊기(`removeFriend`)는 받는 곳이 서버면 api · 아니면 옛 길 — 하나만. 접속 상태(듣기 · 읽기)는 **realtime provider 하나**(`friends-presence-rt.js`) — 옛 길로 넘어가지 않는다.
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
  - `removeFriend(myId, fid)` → Promise — 친구 끊기(서버면 `DELETE /v2/me/friends/{code}` · 아니면 옛 길). 쓰기라 옛 길로 넘기지 않고 못 하면 던진다.
  - `watchPresence(myId, ids, onChange, onStatus)` → 해제 함수 — onChange({ 친구id: { online, lastSeen, room, inRoom } }) · onStatus(`'waiting'` | `'live'` | `'failed'`) · `retryPresence()` → 듣기가 못 받음이면 한 번 다시. 목록이 열려 있는 동안만 건다(friends-sub.js).
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

## friends-api.js — 서버 provider(`social-api.js` 위 — 친구 목록 + 명함 → 친구 칸 · 알림)
- 책임: 포트가 부르는 모양 하나로 서버 친구 데이터를 낸다. 서버 길(경로 · 모양 맞춤 · 오류 갈래)은 `social-api.js`, 여기는 «목록 + 명함 → 친구 칸» 합치기와 realtime 알림(`friends` · `card`)을 받으면 다시 받기뿐이다.
  다시 묻지 않는다 — 못 받으면 던지거나(`listFriends` · `readFriend` · `readProfile` → 포트가 옛 길로) `onError` 로 알린다(`watchList` → friends-sub 가 «못 불러옴» · 목록을 다시 열 때 다시).
- 내보내는 것: `listFriends(myId, opts)`(목록 1번 + 명함 한 묶음 · `opts.idsOnly` 면 명함 없이 addedAt 만) · `readFriend(fid)`(친구 아님 · 명함 없음 → `null`) ·
  `watchList(myId, onChange, onError)`(처음 한 번 + `friends` 알림 · resync 마다 · 받기는 한 번에 하나 — 겹치면 끝난 뒤 한 번 더) · `watchProfile(myId, ids, onChange)`(처음 한 번 + `card` 알림은 듣는 친구 한 명만 · resync 는 전부) ·
  `readProfile(fid)`(명함 없으면 던짐) · `removeFriend(fid)`(이미 친구가 아니면 끝난 것으로 봄). 해제 함수는 알림 걸기도 푼다.
- 만드는 법(app.js):
  ```js
  const socialApiMod = TwSocialApi.createSocialApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) });
  const friendsApiMod = TwFriendsApi.createFriendsApi({ social: socialApiMod, rt: TwRtHub.store, warn: (...a)=>console.warn(...a) });
  ```
- 친구 하나: `{ addedAt, name, level, cyc, clv, starC, bio, avatar }`. 명함이 있는데 이름이 비면 «(이름 없음)» · 명함이 아예 없는 친구는 이름 칸을 덮지 않는다(friends-sub 의 `'...'`). 접속 상태는 realtime(`friends-presence-rt.js`).
  «마지막 접속»(`lastSeenAt`)은 화면에 안 쓴다(설계 D3-Q1 «안 넣음»).
- 포트의 고르기: 목록 · 한 명 · 프로필 새로 읽기는 서버 먼저 → 못 받으면 옛 길. **듣기와 끊기(쓰기)는 고른 길 하나** — 받는 곳이 서버면 이 provider · 아니면 옛 길. 쓰기는 옛 길로 넘기지 않는다(두 곳에 갈라 쓰지 않게).
- 옛 provider(5초 제한 · 1초 · 3초 뒤 다시 묻기 · `X-User-Code` 머리 · 옛 응답 모양 `{ friends:[{ id }] }` · 공개 명함 `fetchUserCardApi`)는 걷었다.
- 검사: `checks/sim-friends-port.js` 2-2절.

## social-api.js — 친구 · 친구 요청 · 명함 서버 길 provider(0.13 · 친구 목록 · 명함은 `friends-api.js` 가 부름 · 요청은 다음 PR)
- 책임: 내 친구 목록(`GET /v2/me/friends` — 객체 배열) · 친구 한 명(`GET …/{code}`) · 끊기(`DELETE …/{code}`) · 친구 요청 목록(`GET /v2/me/friend-requests`) · 보내기 · 수락 · 거절 · 취소 · 명함 묶음(`GET /v2/myhomes/cards?codes=`)을 서버에서. 서버 모양(userCode · ISO 시각 · displayName · cycle …)을 화면 모양(친구 칸 `name · level · cyc · clv · starC · bio · avatar` · 시각 ms)으로 맞추는 곳은 여기뿐이다.
- 만드는 법(app.js — `socialApiMod`): `TwSocialApi.createSocialApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) })`. 만들 때 요청 없음.
- 내보내는 것: `fetchFriends()` → `[{ userCode, addedAt, lastSeenAt }]`(오래 사귄 순 · ms · 마지막 접속 기록 없음 `null`) · `fetchFriend(code)` → 한 줄 | `null`(친구가 아님) · `removeFriend(code)` ·
  `fetchRequests()` → `{ received, sent }`(`[{ userCode, requestedAt(ms) }]`) · `sendRequest(to)` · `acceptRequest(from)` · `rejectRequest(from)` · `cancelRequest(to)` ·
  `fetchCards(codes)` → `{ userCode: 명함 }`(없는 코드는 빠짐 · 100개씩 나눠 묻고 합침 · 빈 목록이면 요청 0) · `reset()`.
- 실패: 한 번에 던진다(다시 묻지 않는다 — 다시 받기는 목록을 다시 열거나 realtime 알림 `friends` · `friendRequests` · `card` 가 올 때). «없음»(빈 목록 · 친구 아님 `null`)과 «못 받음»(던짐)을 가른다.
  `failOf(err, TwApiErrors)` → `{ kind, code, message }` — `guide`(나 · 이미 친구 · 친구 100명 — 서버 문구) · `gone`(요청 · 친구가 이미 없음) · `missing`(없는 사람) · `site`(그 자리 E-FR 번호 · 닿지 못함 · 모양 틀림) · `stale`(계정 바뀜 · 받기 전 — 조용히) · `common`(공통 code — `apiErrors.notify`).
- 함정:
  - 쓰기는 **읽은 토큰의 주인**과 묶는다(`expectOwner`) — 내 친구 · 요청을 받기 전엔 `NOT_RECEIVED` 로 요청 0. 명함 · 친구 한 명 읽기는 주인을 남기지 않는다. 계정을 놓을 때 `reset()`.
  - 나는 토큰으로만 — 경로 · 본문에 내 코드 · 이름을 싣지 않는다(보내기 본문은 `{ to }` 만).
  - 이름이 없으면 `''` 그대로 — «(이름 없음)» 자리표시를 여기서 만들지 않는다(화면 한 곳 몫).
  - 마지막 접속(`lastSeenAt`)은 데이터에만 싣는다 — 화면에 쓰지 않는다(설계 D3-Q1 «안 넣음»).
  - 검사: `checks/sim-social-api.js`(가짜 통로 · 진짜 api-client · 진짜 api-errors · 깨 보기).

## friend-requests-port.js · friend-requests-api.js · friend-requests-firebase.js — 👋 친구 요청(0.13)
- 층: 화면(friend-manage · myhome-ui · seat-friend-req · myhome-init) → **포트**(`friend-requests-port.js`) → provider(서버 `friend-requests-api.js` · 옛 길 `friend-requests-firebase.js`). 화면은 Firebase · API 를 모른다.
- 고르기: 친구 목록과 같은 스위치(`pick('friends')`). 받는 곳이 서버고 서버 provider 가 있으면 서버, 아니면 옛 길 — **하나만**. 쓰기(수락 · 거절 · 취소 · 보내기)는 못 해도 옛 길로 넘기지 않는다.
- 포트가 내보내는 것: `watchReceived(myId, onChange, onError)`(→ 해제 함수 · `{ 보낸이id: { name, ts } }`) · `listSent(myId)`(`{ 받는이id: { ts, toName? } }`) · `accept` · `reject`(못 하면 던짐) · `cancel` · `send(myId, toId, myName, toName, toCode)`(→ `{ ok, reason? }` · reason `already` · `self` · 서버 코드) · `lookupName(uid)` · `lookupFriendCode(code)`.
- 서버 provider: 받은 요청은 처음 한 번 + `friendRequests` 알림(· resync)마다 다시 받고 상대 이름은 명함(`fetchCards`)으로 얹는다. 받는 중 알림이 여럿 와도 요청은 하나. 이름을 못 받아도 요청은 그린다. 보낼 때 이름 · 코드는 안 싣는다(서버가 안다).
- 옛 길 provider: 📤 보낸 요청 미러를 읽고 한 건씩 살아 있는지 확인해 죽은 것은 빼고 치운다(전엔 friend-manage 안에 있던 몫).
- 만드는 법: app.js `friendRequestsFirebaseMod` · `friendRequestsApiMod`(`social: socialApiMod`, `rt: TwRtHub.store`) · `friendRequestsPortMod`. 화면 deps 는 `()=>friendRequestsPortMod`(읽는 함수) — 만드는 줄이 화면 모듈보다 뒤다.
- 친구코드(MATE-XXXX)로 찾기: `GET /v2/users?friendCode=`(`social-api.js findByFriendCode`) — 없으면 `null`.
- 검사: `checks/sim-friend-requests.js`.

## friends-presence-rt.js — 접속 상태 provider(realtime 연결 하나 · `TwRtHub.store`)
- 책임: 친구 접속 상태를 realtime 으로. 한 번 읽기 `readPresence(ids)` = `presenceGet`(한 번에 100명 — `PRESENCE_IDS_MAX` — 넘으면 나눠 보내고 합친다). 듣기 `watchPresence(ids, onChange, onStatus)` = `watch` 하나(처음 전체 → 그 뒤 **바뀐 친구만** 서버가 알려 줌 — 친구마다 구독하지 않는다) · 풀면 `unwatch`.
- 만드는 법(app.js): `TwFriendsPresenceRt.createFriendsPresenceRt({ rt: TwRtHub.store })` — 포트의 `presence` 로 넘긴다. 만들 때 요청 · 구독 없음.
- 상태(`onStatus`): `waiting`(처음 전체를 기다림 — 보냄 · 연결이 붙지 않음) · `live`(처음 전체를 받음) · `failed`(서버가 친구 목록을 못 받아 `error{ code:'unavailable', ref:'watch' }` — «친구 없음» 과 다르다 · 서버의 앞 듣기는 그대로). `failed` 에선 타이머로 다시 묻지 않고 `retryWatch()`(friends-sub 가 목록을 다시 열 때) · 다시 붙음 때만 `watch` 를 다시 보낸다. `presenceGet` 의 `unavailable` 은 realtime-link 가 그 종류의 가장 먼저 보낸 요청 하나를 실패로 끝내 `readPresence` 가 바로 던진다. 연결이 멈췄나는 rt-hub 의 판단이고 화면은 끊김 정책 몫이라 여기서 따로 들지 않는다(멈춤 상태 목록을 사본으로 들면 rt-hub 가 늘린 상태와 어긋난다).
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
