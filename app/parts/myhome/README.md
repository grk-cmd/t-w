# 🏠 `myhome/` — 마이홈 모듈 사용 안내

마이홈 도메인 모듈의 쓰는 법을 모듈마다 한 절씩 적는다. 파일 목록 · 하는 일 한 줄은 `docs/APP_DOMAIN_MAP.md` 4장.
모듈 모양은 모두 같다 — `window.TwXxx = { createXxx(deps) }`, app.js 가 원래 구역 자리에서 `const xMod = TwXxx.createXxx({ … });` 로 만든다.

## `seat-friend-req.js` — 🙋 좌석 우클릭 친구 신청

**책임** — 방에서 친구가 아닌 상대 좌석을 우클릭 → «👤 친구 신청» 을 누르면, 첫 번째는 안내만 하고 5초 안에 같은 사람을 한 번 더 누르면 친구 요청을 보낸다.
보내기 전 앞단 검사(데이터 provider 준비 · 나 자신 · 이미 친구 · 친구 정원)는 마이홈 [친구 추가] 와 같은 순서 · 같은 문구다.

**만드는 법** — app.js «DRAG / PET» 안, 좌석 contextmenu 리스너 바로 앞:

```js
const seatFriendReqMod = TwSeatFriendReq.createSeatFriendReq({
  FRIEND_MAX: FRIEND_MAX,                 // 값 — 친구 정원
  _myHomeFriends: ()=>_myHomeFriends,     // 읽는 함수 — 친구 구독이 다시 대입한다
  friendNet: ()=>window.firebaseAPI,      // 읽는 함수 — 데이터 provider 고르기 한 줄(sendFriendRequest 를 가진 것)
  getDisplayName: (...a)=>getDisplayName(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  toast: (...a)=>toast(...a),
});
```

**내놓는 것** — `_friendReqAsk(uid, seat)` 하나. `uid` 는 상대 userId(`seat.friendUserId`), `seat.friendName` 이 안내 문구 이름(없으면 «이 사람»).

```js
mk('👤 친구 신청', ()=>seatFriendReqMod._friendReqAsk(uid, seat));   // 좌석 우클릭 메뉴(room/seat-menu.js)
```

**확장할 때 고칠 자리** — 기다리는 시간은 `FRIEND_REQ_ARM_MS`. 서버(API)로 옮길 때는 app.js 의 `friendNet:` 한 줄만 그쪽 provider(`sendFriendRequest(나, 상대, 내 이름, 상대 이름, 코드)` → `{ ok, reason }`)로 바꾼다 — 모듈 안에서 `firebaseAPI` 를 직접 부르지 않는다. 앞단 검사를 늘리면 마이홈 [친구 추가](`add-friend.js` 쪽)도 같은 순서 · 문구로 같이 고친다.

**함정** — 확인창(native 다이얼로그 · 새 fixed 오버레이)으로 바꾸지 말 것: 실행 화면은 투명 전체화면이라 다이얼로그가 안 보이고, 새 오버레이는 audit 검사 여럿에 항목이 는다.
회사원 모드에서는 부르는 쪽(app.js)이 먼저 막는다 — 토스트도 뜨면 안 된다.

검사: `checks/sim-seat-friend-req.js` (두 번 눌러 보내기 · 앞단 검사 · 결과 문구 · 연결 · 깨 보기).

## friends-sub.js — 내 친구 목록 구독 한 벌
- 책임: 친구 목록 구독(포트 `friends/friends-port.js` 의 watchList)을 **동시에 하나만** 건다. 실패하면 **목록을 열 때만**(친구 탭 · 워킹룸 초대 목록) 다시 건다 — 타이머 재시도 · 연결 감시는 없다.
  친구 추가 · 수락 판정은 `friendsForCheck()` 로 받은 목록을 쓴다(못 받았으면 이 모듈 한 곳에서만 한 번 읽는다).
  화면은 `notice()` 하나로 «불러오는 중» · «못 불러옴» 을 «친구 없음»(받은 목록이 빈 것)과 따로 그린다.
- 만드는 법(app.js):
  ```js
  const friendsSubMod = TwFriendsSub.createFriendsSub({
    subscribe: (...a)=>friendsPortMod.watchList(...a),                // (myId, onChange, onError) → 해제 함수 — 포트(friends/)
    fetchOnce: (id)=>friendsPortMod.listFriends(id, { idsOnly:true }), // 판정용 한 번 읽기 — 부르는 곳은 이 모듈뿐
    listFriends: (...a)=>friendsPortMod.listFriends(...a),            // 이름 · 레벨 · 소개 · 사진(서버 먼저) — 켤 때 + 목록 열 때
    current: ()=>_myHomeFriends,
    setFriends: (v)=>{ _myHomeFriends = v; },
    getMyUserId: (...a)=>getMyUserId(...a),
    toast: (...a)=>toast(...a),
    setTimer: (fn, ms)=>setTimeout(fn, ms),
    clearTimer: (id)=>clearTimeout(id),
    onUnload: (fn)=>window.addEventListener('beforeunload', fn),   // 종료 · 로그아웃 재시작 때 정리
  });
  ```
- 내보내는 것: `start(myId, onFriends, onStatus)`(myhome-init.js 가 부팅 때 한 번) · `stop()` · `status()`(`idle` · `loading` · `error` · `ready`) · `notice()`(문구 또는 null) ·
  `retryIfFailed()`(못 불러왔을 때만 다시 건다 — 목록을 여는 곳이 부른다) · `friendsForCheck()` → Promise<목록 | null> ·
  `open(key, onUpdate)`(목록이 보이기 시작 — 다시 걸기 · 이름 · 사진 다시 받기 · 열려 있는 동안 바뀌면 onUpdate) · `close(key)`.
  순수(`TwFriendsSub` 위): `noticeFor(status)` · `friendOf(entry, card, pres)` · `mergeFriends(ids, details, presence)` · `NOTICE` · `STATUS` · `SUB_WAIT_MS`.
- 쓰는 예:
  - 목록을 그리는 쪽: deps 로 `friendsNotice: (...a)=>friendsSubMod.notice(...a)` — 값이 있으면 그 문구만 그리고 끝낸다(myhome-inbox.js · room-invite-ui.js).
  - 목록을 여는 쪽: `friendsRetry: (...a)=>friendsSubMod.retryIfFailed(...a)` 를 열 때 한 번(myhome-ui.js 친구 탭 · room-invite-ui.js openPick).
  - 목록이 보이는 동안: `friendsOpen('myhome')` · `friendsClose('myhome')`(myhome-ui.js — 마이홈 창 · 친구 탭 두 칸의 class 를 지켜본다) ·
    `friendsOpen('invite', 다시 그리기)` · `friendsClose('invite')`(room-invite-ui.js — 열기 · ✕ · 바깥 누름).
  - 판정하는 쪽: `const fr = await friendsForCheck(); if(!fr) return;` — null 이면 토스트는 이미 떴다. 아무것도 서버로 안 보낸다(myhome-ui.js 친구 추가 · friend-manage.js 수락).
- 확장할 때: 문구는 `NOTICE`, 판정 대기 상한은 `SUB_WAIT_MS` 한 곳. 친구 목록으로 판정하는 새 자리는 `friendsForCheck` 를 쓴다(직접 get 금지 — sim-friends-sub 5-2절이 센다).
- 함정:
  - 구독이 연결 시도 중이면 판정은 따로 읽지 않고 `SUB_WAIT_MS` 까지 기다린다(같은 경로를 두 번 읽지 않게). 진행 중인 판정은 하나 — 부르는 곳 모두가 같은 Promise 를 기다린다.
  - 한 번 읽은 값은 그 판정에만 쓴다(받음으로 치지 않음). 그 사이 구독 값이 왔으면 구독 값이 이긴다.
  - 이름 · 레벨 · 소개 · 사진은 실시간이 아니다(켤 때 한 번 + 목록 열 때). 누가 친구인지(추가 · 삭제)만 구독이 실시간으로 준다.
    받은 뒤라도 첫 이름 받기 동안은 `notice()` 가 «불러오는 중» 이다(이름 없는 '...' 목록을 잠깐 보이지 않게).
  - `_myHomeFriends` 는 못 받은 동안에도 `{}` 다 — 다른 곳(방명록 게이트 · 스케줄러 · 파도타기)은 예전처럼 «없음» 으로 동작한다. 받았는지는 `status()` 로만 안다.
  - subscribeMyFriends 를 직접 또 걸지 않는다(친구 1명당 onValue 4개 — 겹치면 비용이 곱이 된다). 검사: `checks/sim-friends-sub.js`.
- 내 코드(myId)가 없으면(로그인 전 — `getMyUserId()` 가 null) `start` 입구에서 바로 돌아간다 — 구독 · 읽기 · 다시 걸기 없이 «친구 없음»(`ready` · 빈 목록) · 화면은 main 과 같은 «아직 친구가 없어요». 코드가 생기면 마이홈 시작이 그때 건다.
