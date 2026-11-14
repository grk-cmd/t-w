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
    readFriend: (...a)=>friendsPortMod.readFriend(...a),              // 새로 생긴 친구 한 명(서버 먼저) — 늘어난 id 만
    watchPresence: (...a)=>friendsPortMod.watchPresence(...a),        // 접속 상태(realtime watch 하나) — 목록이 열려 있는 동안만 · onStatus 로 waiting / live / failed
    readPresence: (...a)=>friendsPortMod.readPresence(...a),          // 접속 상태 한 번(ids 배열 → 요청 하나) — 닫혀 있을 때 그 친구들만
    retryPresence: ()=>friendsPortMod.retryPresence(),               // 듣기가 못 받음(failed)이면 다시 묻기 한 번 — 목록을 다시 열 때만
    notifyError: (...a)=>TwErrorCodes.notify(...a),                   // 놀러 가기 · 파도타기의 접속 상태 한 번 읽기 실패(E-FR-05) 한 번
    watchProfile: (...a)=>friendsPortMod.watchProfile(...a),          // 이름 · 레벨 · 회차 — 접속 상태와 같이 목록이 열려 있는 동안만
    readProfile: (...a)=>friendsPortMod.readProfile(...a),            // 그 친구 프로필 한 번 새로 — 마이홈 구경
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
  `open(key, onUpdate)`(목록이 보이기 시작 — 다시 걸기 · 이름 · 사진 다시 받기 · 접속 상태 듣기 · 열려 있는 동안 바뀌면 onUpdate) · `close(key)`(마지막 목록이 닫히면 접속 상태 구독을 푼다) ·
  `refreshPresence(ids)` → Promise(듣고 있지 않은 친구만 접속 상태 한 번 읽기) ·
  `refreshProfile(fid)` → Promise<bool>(친구면 이름 · 레벨을 새로 — 듣는 중이면 읽지 않고 true · 친구 아니면 false. myhome-visit.js 가 친구 홈을 열 때).
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
  - 소개 · 사진은 실시간이 아니다(켤 때 한 번 + 목록 열 때). 이름 · 레벨 · 회차(프로필)는 목록이 열려 있는 동안 접속 상태와 같이 듣는다 —
    들은 값은 늦게 끝난 목록 받기보다 이긴다. 누가 친구인지(추가 · 삭제)는 늘 구독이 실시간으로 준다.
    켠 뒤 새로 생긴 친구(구독 값에 늘어난 id)는 그 친구만 `readFriend` 로 한 번 받는다 — 목록 전체를 다시 받지 않는다. 실행마다 친구당 한 번 ·
    실패 · 없음이면 자리표시('...') 그대로(타이머 재시도 없음 — 다음 목록 받기가 채운다). 첫 구독 값은 새 친구로 치지 않는다(첫 받기가 실패했을 때 n명을 한 명씩 묻지 않게).
    다시 받은 목록에 없는 지금 친구(서버 사본이 늦음)는 알던 이름을 남긴다.
  - 접속 상태(온라인 · 방)는 목록이 열려 있는 동안만 실시간이다. 닫은 뒤 `_myHomeFriends` 의 online · room 은 **마지막 값**이다 —
    닫힌 채로 접속 상태가 필요한 곳은 `refreshPresence([그 친구])` 를 먼저 부른다(friend-visit.js 놀러 가기 · playlist.js 파도타기 친구 고르기).
    받은 뒤라도 첫 이름 받기 동안은 `notice()` 가 «불러오는 중» 이다(이름 없는 '...' 목록을 잠깐 보이지 않게).
  - `_myHomeFriends` 는 못 받은 동안에도 `{}` 다 — 다른 곳(방명록 게이트 · 스케줄러 · 파도타기)은 예전처럼 «없음» 으로 동작한다. 받았는지는 `status()` 로만 안다.
  - 친구 목록 · 접속 상태 · 프로필을 직접 또 걸지 않는다(포트 · 이 모듈 한 곳 — 겹치면 비용이 곱이 된다). 검사: `checks/sim-friends-sub.js` · `checks/sim-friends-port.js` · `checks/sim-friend-profile-live.js`.
- 내 코드(myId)가 없으면(로그인 전 — `getMyUserId()` 가 null) `start` 입구에서 바로 돌아간다 — 구독 · 읽기 · 다시 걸기 없이 «친구 없음»(`ready` · 빈 목록) · 화면은 main 과 같은 «아직 친구가 없어요». 코드가 생기면 마이홈 시작이 그때 건다.

## `inbox-sections.js` — 📩 우편함 칸 나누기 규칙

**책임** — 알림함(옛 우편함) 탭 안 왼쪽 세로 메뉴(📩 우편 · 📢 소식)의 판단 한 벌: 어느 우편이 어느 칸에 드는지 · 칸마다 순서 · 안 읽은 수 · 탭에 들어올 때 처음 보일 칸.
소식 = 모두에게 보낸(broadcast) 공지 · 업데이트(태그 없음 · 모르는 태그는 공지로). 우편 = 나머지 전부 — 개인 우편 · 🐞 답변 · 모두에게 보낸 «📩 우편»(이벤트 보상 — 사용자 결정).
순수 함수만 — DOM · firebase · localStorage 를 모르고, 받은 값을 고치지 않는다.

**만드는 법** — 만들지 않는다(받는 것 없음 · 실릴 때 바로). `myhome-inbox.js` · app.js 보다 먼저 싣고, 수령함 모듈이 받는다:

```js
const inboxSec = TwInboxSections;   // myhome-inbox.js 머리(고리판 TwMyHomeHooks 와 같은 모양)
```

**내놓는 것** — `SECS`(['mail','news'] — 📘 도움말은 따로 탭 `help-tab.js` · 옛 'help' 값은 `normSec` 이 'mail' 로) · `CATS`(['all','notice','update']) · `tagOf(m)` · `sectionOf(m)` → 'mail' | 'news' ·
`normSec(s)` · `normCat(c)`(옛 필터 값 'reward' · 'gift' → 'all') · `mailIds(merged)` · `newsIds(merged, cat)`(📌 고정은 종류와 상관없이 맨 위) ·
`unread(merged, personalUnread?)` → `{ mail, news, notice, update, total }`(개인 우편의 안 읽은 수는 서버가 센 값 `personalUnread` — 숫자가 아니면 받은 것을 센다) · `firstSec(merged, personalUnread?)`(안 읽은 우편이 있으면 'mail', 없으면 'news').
`merged` 는 `myhome-inbox.js` 의 `_inboxMerged()` 모양(개인 `_src:'personal'` + 공용 `_src:'broadcast'` · 공용 읽음은 이 PC 집합).

**확장할 때 고칠 자리** — 칸을 늘리면 `SECS` · html `#mhInboxRail` 버튼 · `#mhInboxPane-이름` 칸. 새 태그는 `tagOf` · `sectionOf`.

**함정** — 서버 태그 키는 그대로다(`reward` 를 바꾸면 이미 보낸 우편이 전부 공지로 떨어진다). 보이는 글자만 `myhome-inbox.js` 표에서 바꾼다.
우편함 탭 배지 · 🔔 벨 수는 `unread().total` 과 같아야 한다 — 따로 세지 말 것.
검사: `checks/sim-inbox-sections.js`(입력 → 출력 · 경계값 · 연결 · 깨 보기).

## `inbox-api.js` · `mail-feed.js` — 📩 내 우편(서버 원본)

**책임** — 우편의 원본은 서버다(`GET /v1/me/notifications?section=MAIL` · 읽음 `PATCH …/{id}` · 모두 읽음 `POST …/read-all` · 지우기 `DELETE …/{id}` · 읽은 우편 한꺼번에 `POST …/delete-read` — 서버가 내 읽은 우편을 한 번에 지우고 지운 수를 준다).
`inbox-api.js` 는 서버 모양(종류 · `readAt` · `createdAt` · `payload` · 서버가 센 `unreadCount`)을 화면 모양(`{ tag, title, body, ts, read, bugId? }`)으로 맞추는 provider 한 곳.
`mail-feed.js` 는 받아 들고 있는 한 벌 — 받는 중 · 받음 · 못 받음 상태, 새 우편 알림(realtime `notification`)이 오면 다시 받기, 읽음 · 지우기(서버가 됐다 한 뒤에만 화면 값을 고침).
옛 장치는 걷었다: 앱이 세는 안 읽은 수 사본(서버 값을 쓴다) · Firebase 수령함 구독 · 앱이 고치던 읽음 표시.

**만드는 법** — app.js 의 마이홈 처음 준비 만드는 줄 앞에서(그 줄이 `mailFeed` 를 값으로 받는다):

```js
const mailFeed = TwMailFeed.createMailFeed({
  api: TwInboxApi.createInboxApi({ authed: TwApi.authed, warn: (...a)=>console.warn(...a) }),
  rt: TwRtHub.store, notifyError: (...a)=>TwErrorCodes.notify(...a),
});
mailFeed.onChange((e)=>mhInitMod.onMailChanged(e));   // 받은 뒤 화면 · 토스트(처음 받은 판은 새 우편이 아니다)
```

**내놓는 것** — `inbox-api`: `fetchMail(uid)` → `{ items:{id: 우편}, unread, complete }` · `markRead` · `markAllRead` · `remove` → `'ok'|'stale'|'failed'`.
`mail-feed`: `start(uid)`(계정이 바뀌면 앞 계정 우편을 비우고 새로 받는다) · `stop()` · `refresh({ manual }?)`(`manual` = «다시 시도» · 알림함 열기 — 못 받으면 오류 번호) · `status()` · `items()` · `unread()` · `ready()` · `complete()` · `markRead(id)` · `markAllRead()` · `remove(id)` · `removeRead()`(서버가 읽은 우편을 한 번에 지운다 → 지운 수 · 못 지웠으면 null · 성공하면 서버에서 다시 받음 · 지우는 중 또 부르면 건너뜀) · `clearing()` · `onChange(fn)`.
부르는 곳: `myhome-init.js`(켜기 · 받은 뒤 화면) · `myhome-inbox.js`(그리기 · 누름) · `focus-level.js`(해금 안내를 이미 받았는지 — `_myInbox` · `_myInboxReady` 는 `mailFeed.items()` · `ready()`).

**오류 번호** — `E-MH-08`(받기 실패 · **사용자가 연 · 누른 받기(알림함 열기 · «다시 시도»)에서만** · 이어지는 동안 한 번 — 켤 때 · 새 우편 알림으로 자동 받다 실패하면 번호 없이 못 받음 상태만) · `E-MH-10`(읽음) · `E-MH-11`(지우기). 계정이 바뀌는 중(`stale`)은 번호 없이 버린다.
못 받아도 **혼자 다시 받지 않는다**(타이머 없음) — 다시 받는 길은 새 우편 알림 · «다시 시도» · 알림함이 나타날 때다. 닫힌 동안 실패한 채 알림함이 나타날 때(탭 누르기 · 알림함 탭이 켜진 채 창 열기) `myhome-inbox.js` 의 `retryIfFailed()` 가 manual 로 한 번 다시 받는다(받는 중이면 `busy()` 로 건너뜀).

**함정**
- 쓰기는 «읽은 토큰의 주인» 과 묶는다(`expectOwner`) — 읽은 적 없는 계정이나 주인이 바뀐 뒤에는 요청 0.
- 한 번에 4쪽(200통)까지만 받는다(`complete:false`) — 안 읽은 수는 그래도 서버 값이다. 더 보기 단추는 아직 없다.
- 한 번도 못 받은 동안(받는 중 · 못 받음)은 «모두 읽음» · 읽음 · 지우기를 보내지 않는다. «받은 우편이 없어요» 는 받은 뒤 정말 비었을 때만 그린다.
- 레벨 해금 · 버그 답변 우편은 서버가 만든다(앱이 자기 수령함에 쓰는 `sendInboxMessage` 는 관리자 코드와 옛 해금 안내가 아직 부르는 동안만 남는다).
검사: `checks/sim-inbox-api.js` · `checks/sim-mail-feed.js`(입력 → 출력 · 상태 · 계정 바뀜 · 깨 보기).

## `guestbook-api.js` · `guestbook-feed.js` · `guestbook.js` — 📖 방명록 · 웹박수 (서버가 원본)

**책임** — `guestbook-api.js` 는 서버 모양(`authorName` · `createdAt` · `clap.imageUrl` · `canWrite` · `version`)을 화면 모양(`{ name, ts, img, canWrite… }`)으로 맞추는 provider 한 곳(`/v1/guestbooks/{userCode}` · `/v1/me/guestbook`).
`guestbook-feed.js` 는 받아 들고 있는 한 벌 — 새 글 배지(숫자 하나) · 열어 둔 방명록 · 글 쓰기 · 지우기 · 박수 · 폭죽. `guestbook.js` 는 화면(배지 · 독립 팝업 창)만.
글 30개 정리 · 박수 하루 몫(`todayLeft`) · 쓸 수 있는지(`canWrite` — 주인이거나 친구)는 전부 서버가 정한 값이다. 앱이 세지도 정리하지도 판정하지도 않는다.

**받는 때** — 배지: 마이홈을 열 때 `GET /v1/me/guestbook/summary?since=<마지막으로 연 때>` 한 번, 그 뒤 realtime `guestbook` 알림(`subject` = 내 코드) · 오래 끊겼다 붙을 때만. 방명록: 창을 열 때 `GET`, 열려 있는 동안 알림이 오면 다시 `GET`(ETag).
남의 방명록은 열 때 realtime `guestbookWatch{ owner }` 로 «보는 중» 을 알려야 알림이 오고, 창을 닫으면 `guestbookUnwatch`. 혼자 되풀이해서 받지 않는다 — 못 받으면 창의 «다시 시도» 뿐.
알림 걸기(`rt.on` · `rt.onState`)는 배지나 방명록이 켜져 있는 동안만이고 둘 다 꺼지면 뗀다. 연결 상태가 비우기를 맡는다 — 연결을 끈 것(OFF · 로그아웃)이면 모두 비우고(열린 창도 닫음), 인증 실패 · 다른 기기에 밀림 · 업데이트로 끊긴 것은 받은 것만 거두고 걸기는 둔다(다시 붙으면 배지 · 열린 방명록을 한 번씩 다시 받는다).

**deps** — feed: `api`(guestbook-api) · `rt`(`TwRtHub.store`) · `rtState` · `pending`(`TwRequestId.createPending()`) · `lastRead`(`createLastReadStore(localStorage)` — `tw.mhGbLastRead:<코드>`) · `notifyError` · `translate` · `ACTION` · `now`.
화면: `feed` · `errorText` · `getMyUserId` · `getDisplayName` · `toast` · `escHtml` · `applyThemeToChildDoc` · `watchMaintenanceInput` · `mhViewingUserId` · `mhViewingDisplayName`.

**내놓는 것** — feed: `startBadge(uid)` · `stopBadge()` · `refreshBadge()` · `badgeCount()` · `markRead()` · `openBook(uid, owner)` · `closeBook()` · `refreshBook({ manual }?)` · `view()` · `status()` · `owner()` · `write(text)` · `remove(id)` · `clap()` · `clapBusy()` · `setEmoji(v)` · `setImage(dataUrl)` · `onChange(fn)`.
쓰기는 `{ ok, reason?, code? }` — `reason`: `closed` · `blocked`(`canWrite` 아님) · `empty` · `gone`(그 사이 창을 닫음) · `stale`(로그인이 바뀌는 중 — 조용히) · `busy` · `limit`(하루 몫을 다 씀 — 오류 번호 없는 안내) · `failed`(`code` = 띄운 오류 번호).
화면의 window 고리(`_mhGbStartWatch` · `_mhGbStopWatch` · `_mhGbRefreshBadge` · `_mhGbMarkAllRead` · `_mhReSubscribeGuestbook` · `openMyGuestbook`)는 예전 이름 그대로.

**오류 번호** — `E-GB-01`(방명록 받기 실패 — 연 · 누른 받기만) · `E-GB-02`~`05`(서버 거절) · `E-GB-06`(박수 그림을 쓸 수 없음) · `E-GB-07`(512KB 초과). 그 밖의 실패는 공통 `E-NET-*`.

**함정** — 글 쓰기 · 박수는 `requestId` 를 싣는다. 닿지 못한 일은 같은 번호로 다시(서버가 한 번만 반영), 서버가 답한 일(거절 포함)은 번호를 놓는다.
방명록 창은 main.js 가 blur 에서 닫기도 한다 → `pagehide` 에서 `closeBook()`. 받는 중 · 못 받음에는 입력칸이 보이지 않는다. 박수 그림은 요청 둘이다 — `POST /v1/me/images?purpose=clap`(바이트 그대로 · 512KB 이하 png/webp/jpeg → `{ url }`) 다음 `PATCH /v1/me/guestbook { version, clapImageUrl }`. 첫째가 실패하면 겉모습은 그대로, 둘째가 409 면 다시 받는다. 올리는 사이 연결이 끊기거나(`release()`) 계정 · 주인이 바뀌면 둘째를 보내지 않고 `{ ok:false, reason:'gone' }` — 겉모습을 못 바꿨는데 성공으로 돌려주지 않는다. `setImage(dataUrl)`.

검사: `checks/sim-guestbook-api.js` · `checks/sim-guestbook-feed.js` · `checks/sim-guestbook.js`(입력 → 출력 · 상태 · 계정 바뀜 · 깨 보기).

## `help-tab.js` — 📘 마이홈 «도움말» 탭

**책임** — 마이홈 «도움말» 탭 한 칸: 왼쪽 목차(묶음 접고 펴기) · 오른쪽 도움말 웹 페이지 틀(도움말 전용 Hosting 사이트 `help.together-working.com` · `?embed=1`) · 못 불러옴.
사용법 글은 앱을 다시 내지 않고 고치려고 웹 페이지(`hosting/help/`)에 둔다. 목차는 앱에 박지 않고, 페이지(`hosting/help/embed.js`)가
`postMessage({ type:'tw-help', v:1, page, toc })` 로 보내 오면 그것으로 그린다 — 페이지 안 «이전 · 다음» 으로 옮겨도 왼쪽 표시가 따라간다.

**만드는 법** — app.js 가 마이홈 창(`createMyHomeUi`) 바로 앞에서 만들고 deps `helpTab` 으로 넘긴다. 테마를 바꾸면 `themeMod.onApplied` 로 `themeChanged`:

```js
const helpTabMod = TwHelpTab.createHelpTab({ getTheme: ()=>themeMod.getTheme() });   // getTheme 은 탭에 들어올 때 읽는다
```

**내놓는 것** — `enter()`(탭에 들어올 때 — 처음 · 테마가 바뀜 · 못 불러옴이면 연다) · `themeChanged()`(연 틀만 새 테마로) · `state()`(검사용).

**함정** — 틀 안 HTTP 실패는 밖에서 안 보인다 → 연 뒤 `LOAD_MS` 안에 알림이 없으면 «못 불러옴»(오류 `E-MH-01`) · [다시 시도].
알림은 `e.source` 가 이 틀이고 출처 · 모양이 맞을 때만(`shared/help-site.js` readMessage) · 목차 글은 textContent 로만.
틀은 sandbox `allow-scripts allow-same-origin`(같은 사이트 `toc.json` 받기 · 출처 확인에 필요) — 앱 문서(file://)와 출처가 달라 앱 쪽엔 손대지 못한다.
틀이 옮겨 갈 수 있는 주소는 main.js `will-frame-navigate` 가 같은 `help-site.js` 로 본다 · 앱 CSP `frame-src` 도 그 사이트 하나 — 사이트 주소를 바꾸면 셋을 같이.
도움말 페이지는 Hosting 배포가 따로다(`firebase deploy --only hosting`) — 앱보다 먼저 올라가 있어야 탭이 빈 칸이 안 된다.
검사: `checks/sim-help-tab.js`(가짜 화면에서 돌림 · 깨 보기) · 페이지 쪽은 `checks/sim-help-pages.js`.

## `myhome-preset.js` — 👑 디자인 프리셋 규칙

**책임** — 디자인 스튜디오 프리셋 3칸의 판단 한 벌: «지금 디자인 → 칸»(무엇을 담나) · «칸 → 지금 디자인»(어떻게 얹나) · 저장본 씻기 · 고른 칸 번호 · 그림 키 집합 · 그림 올릴 이름.
칸 한 벌 = 색 + 그림(theme 의 그림 키 · 바깥 배경 `bg.img`) 통째 — 그림까지 담은 칸은 `img: true` 표시. 표시 없는 칸(그림 담기 전에 저장했거나 옛 앱이 다시 쓴 칸)은 예전 규칙(색만 갈고 지금 그림 그대로).
순수 함수만 — DOM · firebase · `_myHomeData` 를 모르고, 받은 값을 고치지 않고 새 값을 돌려준다.

**만드는 법** — 만들지 않는다(받는 것 없음 · 실릴 때 바로). `myhome-edit.js` · app.js 보다 먼저 싣고, 편집 묶음이 아래층으로 받는다:

```js
const mhPreset = TwMyHomePreset;   // myhome-edit.js 머리(고리판 TwMyHomeHooks 와 같은 모양)
```

**내놓는 것** — `MAX`(3) · `NAME_MAX`(8) · `imgKeyOf(row)` · `imgKeys(rows)` → Set · `normalize(raw)` → 3칸 배열 · `cur(raw)` → 0~2 ·
`snapshot(home, imgKeys, name)` → 칸 한 벌 · `apply(home, preset, imgKeys)` → `{ theme, bg }`(부르는 쪽이 상태 주인 `setDesign` 으로 넘긴다).
그림 올릴 파일 이름은 만들지 않는다 — 서버가 올릴 때마다 새 주소를 준다(예전 `uploadSlot` 은 걷었다).

```js
arr[i] = mhPreset.snapshot(_myHomeData(), mhPreset.imgKeys(_MH_DS_ROWS), arr[i] && arr[i].name);   // 저장
const next = mhPreset.apply(_myHomeData(), p, keys); myhomeStore.setDesign({ theme: next.theme, presets, presetCur, bg: next.bg });   // 불러오기
```

**확장할 때 고칠 자리** — 칸에 담는 것을 늘리면 `snapshot` · `apply` · `normalize` 셋을 같이(옛 앱이 새 저장본을 읽는 길도 `normalize` 가 정한다). 칸 수 · 이름 길이는 `MAX` · `NAME_MAX`.
그림 키는 디자인 스튜디오 항목 표(`_MH_DS_ROWS`)에서 뽑는다 — 여기에 따로 적지 않는다.

**함정** — Realtime DB 는 빈 자리가 있는 배열을 `{0:…, 2:…}` 객체로 돌려준다 — `normalize` 를 거치지 않고 배열로 단정하지 말 것.
그림은 올린 주소만 칸에 담는다(올릴 때마다 새 주소 — 칸끼리 같은 파일을 덮지 않는다). 옛 `design_bg.jpg` 같은 파일을 가리키는 칸은 그대로 둔다. `data:` 그림(옛 base64)은 칸에 담지 않는다 — 칸마다 복사되면 홈 노드가 몇 배로 커진다.
옛 앱의 씻기는 `bg.img` · `img` 표시를 버린다 — 옛 앱이 새 저장본을 읽으면 그 칸은 «색만» 칸으로 보인다(깨지지 않는다).
검사: `checks/sim-myhome-preset.js`(입력 → 출력 · 경계값 · 연결 · 깨 보기).

## `presence-lock.js` — 🔒 친구 탭 온라인 고정

**책임** — 친구 탭 하단 «■ 온라인» 토글 · 옆 🔒 버튼 · 앱을 켤 때 처음 온라인 여부. 🔒 를 켜 두면 고른 온라인 · 오프라인을 계정에 기억해(`presencePref/{uid}`) 다음 실행 · 다른 PC 에서도 그 값으로 시작한다. 끄면 예전처럼 늘 온라인으로 시작한다.

**만드는 법** — app.js 가 마이홈 처음 준비보다 먼저 `TwPresenceLock.createPresenceLock(deps)` — deps: `getMyUserId` · `toast` · `notifyError` · `savePref` · `setPresence`(토글 — `setMyPresenceState`). 만들 때 토글 · 🔒 클릭을 건다.

**내놓는 것** — `startOnlineFor(uid, me)` → 처음 온라인 여부(동기). `me` 는 계정 확인(`GET /v1/me`)의 답이고 거기 `presencePref` 에서 고정값을 앉힌다. myhome-init 이 `firebaseAPI.setMyPresenceOnline(myId, 이것)` 으로 넘긴다. 순수 `normalize(v)` · `startOnline(pref)`.

**함정** — 첫 접속 쓰기는 firebase-init `setMyPresenceOnline` 이 이 값이 정해진 뒤에만 한다(재접속 신호가 먼저 와도) — 오프라인 고정인데 «온라인» 이 한 번 보이지 않게. 등록(`_myPresenceRef`)은 바로 한다 — 기기 세션이 밀릴 때 놓는 순서가 그대로이게.
계정 확인을 통과한 뒤에만 시작하니(`launcher/app-boot.js`) 고정값을 따로 읽거나 기다리지 않는다 — 이 PC 사본 · 읽기 시한 · 늦게 온 값 바로잡기는 없다. 받기 전에 사용자가 누르면 누른 값은 지키고 고정 여부는 받은 값을 따른다(받은 값이 고정이면 누른 값을 새 고정값으로 저장).
고정 안 한 토글은 저장하지 않는다(예전과 같다). 다른 PC 에서 바꾼 고정값은 켜져 있는 PC 에 바로 오지 않는다(다음 실행부터).
`presencePref` 는 `users/*`(공개 읽기) 밖 — 친구가 «숨긴 오프라인» 을 알아보지 않게 로그인한 본인만 읽고 쓴다.
검사: `checks/sim-presence-lock.js`.

## `mh-bg-url.js` — 🖼️ 마이홈 배경 그림 주소 규칙

**책임** — 배경 그림 주소가 `http://` 면 `https://` 로 바꿔 그리기(`httpsOf`) · 바꾼 주소를 한 번 불러 보고 못 받으면 «https 주소를 써 주세요»(`E-MH-02`) 안내. 그림 주소 씻기는 하지 않는다 — 부르는 쪽이 `TwSafeHtml.cssUrl(httpsOf(u))` 로 safe-html 에 맡긴다(페이지에 http 주소는 안 들어간다).

**만드는 법** — 만들지 않는다(받는 것 없음 · 실릴 때 바로). safe-html.js · error-codes.js 뒤, `myhome-edit.js` · `myhome-desktop.js` · app.js 보다 먼저 싣는다:

```js
const mhBgUrl = TwMhBgUrl;   // myhome-edit.js 머리 — myhome-desktop.js(옛 IIFE)는 TwMhBgUrl 을 바로 부른다
```

**내놓는 것** — `httpsOf(u)` · `createBgProbe({ makeImage, onFail })` → `probe(raw)`(http 였던 주소만 · 같은 주소 한 번) · `probeOwnerBg(raw)`(앱이 쓰는 한 벌 — 못 받으면 `E-MH-02`).

**함정** — 안내는 **내 배경일 때만** 부른다(바탕화면 `advApplyBg` 는 `!advVisiting`, 창 바깥 `applyMyHomeBg` 는 `!_mhViewingUserId()`) — 친구 홈 구경에서 남의 배경 오류를 띄우지 않는다. 진단 줄에 주소를 싣지 않는다.
검사: `checks/sim-mh-bg-url.js`(입력 → 출력 · 불러 보기 · 그리는 곳 두 군데를 떼어 돌림 · 깨 보기).

## `gift-save.js` — 💾 받은 말랑이 선물 그림 저장

**책임** — 선물함 칸 우클릭 [저장] 에서 선물 그림을 받아 그대로(다시 그리지 않음 — GIF 움직임 유지) `말랑이_보낸사람_받은날짜.확장자` 로 내려받기. 실패하면 `E-MH-03`.

**만드는 법** — app.js 가 수령함 모듈(`createMyHomeInbox`)을 만드는 줄에서 deps `giftSave` 로 넘긴다. error-codes.js · safe-html.js 뒤, `myhome-inbox.js` · app.js 보다 먼저 싣는다:

```js
giftSave: TwGiftSave.createGiftSave({ fetch, document, URL, setTimeout, safeUrl: TwSafeHtml.safeUrl, now: ()=>new Date(), notifyFail: e=>TwErrorCodes.notify('E-MH-03', e) }),
```

**내놓는 것** — `fileName(fromName, when, type)`(순수 — 못 쓰는 글자는 `_` · 빈 이름은 «친구») · `extOf(type)` · `createGiftSave(deps)` → `save(gift)`(`'ok'` · `'fail'`).

**함정** — 저장 위치는 Electron 기본 저장 창이 묻는다(스티커사진 저장과 같다 — main.js 에 다운로드 처리 없음). 사용자가 창에서 취소할 수 있어 «저장했어요» 알림은 띄우지 않는다. 그림 주소는 친구가 정한 값이라 `safeUrl(…, 'image')` 를 거친 주소만 받는다.
검사: `checks/sim-gift-save.js`(파일 이름 경계값 · 저장 흐름 · 실패 · 수령함 우클릭 버튼 · 연결 · 깨 보기).

## `myhome-sticker-rules.js` — 🔒 스티커 잠금 · 그리는 순서

**책임** — 마이홈 스티커의 잠금 판단과 그리는 순서(뒤 → 앞) 한 벌. 순수 함수만 — DOM · firebase 를 모른다(받은 스티커 묶음의 `z` · `locked` 칸만 고친다).

**만드는 법** — 만들지 않는다(받는 것 없음). `myhome-sticker.js` · `myhome-edit.js` · app.js 보다 먼저 싣고 아래층으로 받는다:

```js
const stRules = TwMyHomeStickerRules;          // myhome-sticker.js(관리 창 · 편집 모드)
const mhStickerRules = TwMyHomeStickerRules;   // myhome-edit.js(스티커 끌기 · 새 스티커)
TwMyHomeStickerRules.orderedIds(data)          // app.js renderMyHomeStickers
```

**내놓는 것** — `isLocked(s)` · `setLocked(s, on)`(풀면 칸을 지운다) · `orderedIds(stickers)` → 뒤 → 앞 id 배열 · `nextZ(stickers)` → 새 스티커 z · `move(stickers, sid, ±1)` → 옮겼으면 true(모두에게 0,1,2… 를 다시 매긴다) · `hitsAddBtn(rect, x, y)` → 누른 자리가 [+ 스티커] 버튼 안인가(버튼을 가린 스티커가 그 자리 클릭을 버튼에 넘길 때 — `myhome-edit.js`).

**함정** — 순서를 키 이름으로 바꾸지 말 것: Realtime DB 는 키를 사전순으로 돌려준다. `z` 없는 옛 스티커는 키 순서대로 새 스티커들보다 뒤.
잠금은 편집 모드 밖 끌기(`myhome-edit.js`) · ◎ · 전부 화면 안으로만 막는다. 우클릭 · ✎ 편집 모드(이동 · 크기 · 회전)는 잠겨도 되고 잠금은 그대로 남는다 — ✎ 는 창 밖의 잠긴 스티커도 창 안으로 당긴다. 지우기 · 링크 · 움직임 · 순서도 잠겨도 된다.
옛 앱은 `z` · `locked` 를 모른다 — 만든 차례로 그리고 잠금 없이 움직인다(칸은 지우지 않고 남긴다).
검사: `checks/sim-myhome-sticker-rules.js`.

## 화면에 넣는 값 — `mallang.js` · `myhome-desktop.js` · 마이홈 창 공통

**책임** — 마이홈은 친구 홈 구경 · 선물 · 파티로 **남의 값**(이름 · 사진 주소 · 테마 색 · 배경 그림)을 그대로 그리는 곳이 많다. 그 값은 모두 `shared/safe-html.js`(`TwSafeHtml`)를 지난다.

**쓰는 법** — 마크업 글자는 `TwSafeHtml.text`(파일 안 `esc` · deps `escHtml` 은 그 별칭), 그림 주소는 `TwSafeHtml.safeUrl(u, 'image')` 를 거쳐 **요소로** 만든다(`'<img src="'+url+'"'` 로 붙이지 않는다), 테마 · 배경은 `cssUrl(img) || cssColor(color)`.

**함정** — 토스트 · `title` · `textContent` 는 씻지 않는다(말랑이 선물 토스트가 `&lt;` 를 글자로 보이던 자리). 허용 안 된 주소는 그리지 않고 빈 칸 · 기본 모양으로 둔다.
`myhome-desktop.js` 모험 시나리오는 상수 표의 고정 마크업이라 검사 예외(`checks/sim-safe-html.js` ALLOW)에 이유와 함께 있다. ⚠️ 파티 방장이 보내는 `storyHtml` 은 남은 구멍 — 받은 마크업을 그대로 그린다(비트 id 로 바꾸는 일은 따로 결정).
검사: `checks/sim-safe-html.js`.

## `mh-pad-pos.js` — 🎨 마이홈 창 자리 기억(스티커 여백)

**책임** — 스티커가 창 밖에 있어 마이홈 창을 양쪽으로 넓힐 때(여백), 창 자리를 «여백을 뺀 마이홈 자리» 로 기억하고 놓을 때 지금 여백만큼 뺀다. 렌더러 모듈이 아니라 **main.js 가 `require`** 한다(순수 함수 · deps 없음).

**내놓는 것** — `rememberOf(창 좌상단, 얹힌 여백)` → 기억할 자리 · `placeOf(기억한 자리, 놓을 여백)` → 창 좌상단(기억 없으면 `null` — 가운데에 놓인다). main.js 는 창 자리를 기억하는 곳(`'moved'` · 줌 · 모니터 · 표시설정)이 전부 `_rememberPos` 를 지나고, `_applyConfigMode('myhome')` 이 `placeOf` 로 놓는다.

**함정** — Windows 는 `setBounds` 뒤 `'moved'` 가 안 온다. 창 좌상단(여백 포함)을 기억하면 같은 여백으로 다시 불릴 때(메뉴 누름) 옛 자리로 돌아간다 — 여백 없는 자리로 기억해야 `'moved'` 가 오든 안 오든 같다.

검사: `checks/sim-mh-pad-pos.js` (함수 · 놓는 흐름 — `'moved'` 오는 OS · 안 오는 OS · 깨 보기).

## `schedule-api.js` — 🌐 일정 · 디데이 · 일정 알림 서버 길 provider

- **책임**: 내 달력 한 달 읽기 · 일정 쓰기 · 지우기(`GET` · `POST` · `DELETE /v1/me/schedules`) · 남의 공개 일정(`GET /v1/schedules/{userCode}`) · 디데이 보드 통째 읽기 · 통째 저장(`GET` · `PUT /v1/me/ddays`) · 남의 공개 보드(`GET /v1/ddays/{userCode}`) · 친구가 태그한 알림(`GET` · `DELETE /v1/me/notifications` 의 🔔 칸). 서버 모양(`visibility` · `countFromOne` · `bgImage` · `cards` / `banners` 두 목록)을 화면 모양(`public` · `base1` · `bgImg` · `kind` · `order`)으로 맞추는 곳은 여기뿐이다. 신원은 토큰(`/v1/me/…`) — 남의 것은 사용자 코드(경로의 코드는 데이터 주소일 뿐).
- **만드는 법**: `TwScheduleApi.createScheduleApi({ authed, newId, warn })` — app.js 가 스케줄러보다 먼저 만들어 `scheduleApi` deps 로 넘긴다.
- **deps**: `authed`(`TwApi.authed`) · `newId`(`TwRequestId.newId` — 일정 쓰기의 요청 번호) · `warn`.
- **내보내는 것**: `fetchMonth(uid, ym)` · `fetchMonthOf(userCode, ym)` · `createItem(uid, { date, text, public, tagFriends })` · `deleteItem(uid, id, version)` · `fetchBoard(uid)` · `fetchBoardOf(userCode)` · `saveBoard(uid, ddays, tag)` · `fetchBell(uid)` · `deleteBell(uid, id)` · `orderedIds(ddays, kind)`(그리기와 저장이 같은 순서를 쓰는 순수 함수) · `reset()`. 모두 못 읽으면 던진다 — 빈 달 · 빈 보드 · 알림 없음은 `{}` 로 돌려줘 «못 읽음» 과 가른다.
- **함정**
  - 보드는 **통째**다 — 한 장을 고쳐도 두 목록(카드 · 배너)을 순서대로 다 보낸다. 새 장은 `ddayId` 를 싣지 않고(UUID 가 아닌 임시 열쇠) 서버가 정한 id · 순서로 돌려준 보드가 정답이다. 배너에는 셈법(`countFromOne`) · 배경이 없다.
  - 저장은 마지막으로 읽은 판을 싣는다. **409 `CONCURRENT_UPDATE` 면 판을 버려** 다시 받기(`fetchBoard`) 전에는 쓰지 못한다(같은 판으로 다시 보내 남의 고침을 덮지 않게). 같은 409 라도 `SCHEDULE_DDAY_FULL`(상한)은 판이 그대로다.
  - 쓰기는 읽은 토큰의 주인과 묶는다(`expectOwner`) — 읽은 뒤 로그인한 사람이 바뀌면 요청 0 으로 `OWNER_CHANGED`. 읽은 적이 없으면(받기 전) `NOT_RECEIVED` — 요청 0.
  - 카드 그림은 `data:` 로 들고 있다가 저장할 때만 서버에 올린다(`POST /v1/me/images?purpose=dday` — 바이트 그대로 · `Content-Type` png / webp / jpeg · 1MB 이하 · 응답 `{ url }`, `authed` 의 `rawType` 길). 1MB 를 넘거나 형식이 아니면 요청 없이, 서버가 400 · 413 · 415 로 거절해도 `IMAGE_UPLOAD`(→ `E-MH-05`)로 던지고 보드를 보내지 않는다. 계정이 바뀐 것(`OWNER_CHANGED`)은 조용히 버린다.
  - 친구를 태그하면 서버가 공개로 바꾸고(provider 는 화면 값 그대로 보낸다 — 스케줄러가 태그할 때 «공개» 체크를 켜고 잠그고 까닭을 보이며, 태그를 빼면 원래 값으로 돌린다), **같은 요청이 알림까지 보낸다**(일정만 되고 알림만 빠지는 일이 없다). 보드는 «이번에 저장한 한 장이 속한 목록의 몇 번째» 로 태그를 싣는다.
  - 일정의 `ts` 는 서버가 준 `createdAt` 을 ms 로 옮긴 만든 시각이다(없거나 깨지면 0 = 오래된 것). 🔔 뱃지의 «오늘 내 일정» 은 `tw.bellSeenTs` 뒤에 만든 것만 센다.
- **검사**: `checks/sim-schedule-api.js`(가짜 `authed` 로 실제로 불러 판정 · 일부러 깨 보기).

## `myhome-api.js` — 🏠 마이홈 서버 길 provider

- **책임**: 내 마이홈 읽기(`GET /v1/me/myhome` — 페이지 + 바탕화면 한 번) · 남의 마이홈(`GET /v1/myhomes/{userCode}`) · 내 책장(`GET /v1/me/myhome/bookshelf`) · 남의 공개 책(`GET /v1/myhomes/{userCode}/bookshelf`) · 페이지 칸 저장(`PATCH /v1/me/myhome`) · 디자인(`PUT …/design`) · 바탕화면(`PUT …/desktop`) · 책장(`PUT …/bookshelf`) · 그림 올리기(`POST /v1/me/images?purpose=myhome`). 서버 모양(스티커 목록 · `image` · 프리셋 `withImage` · 책 `width` · `titleColor` · `public` · `addedAt` ISO)을 화면 모양(스티커 `{sid:…}` · `img` · `img:true` · `w` · `tcolor` · `pub` · `at` ms)으로 맞추는 곳은 여기뿐이다. 신원은 토큰.
- **만드는 법**: `TwMyHomeApi.createMyHomeApi({ authed, imageBytes, warn })` — 상태 주인(`myhome-store` · `bookshelf-store`, D2-2 · D2-4)이 받는다.
- **내보내는 것**: `fetchMine()` → `{ page, pageVersion, desktop, desktopVersion }` · `fetchOf(code)` → `{ page, desktop }` · `fetchBookshelf()` → `{ books, version }` · `fetchBookshelfOf(code)` → `{ books }` · `patchPage(version, fields)` · `putDesign(version, d)` · `putDesktop(version, d)` → 새 `version` · `putBookshelf(version, books)` → `{ books, version }` · `uploadImage(dataUrl)` → `url` · `reset()`. 순수: `homeOf` · `stickersOf` · `stickersBody` · `presetsOf` · `presetsBody` · `desktopOf` · `desktopBody` · `booksOf` · `booksBody` · `failOf` · `PATHS` · `LIMITS`.
- **함정**
  - `patchPage` 는 `fields` 에 열쇠가 있는 칸만 싣는다(지우기는 `null` · `stickers` 는 그리는 순서 목록 통째 · `clearTheme:true` 는 `theme:null`). 안 바뀐 칸을 실으면 다른 기기의 고침을 덮는다.
  - 쓰기는 읽은 토큰의 주인과 묶는다(`expectOwner`) — 내 홈을 읽은 적이 없으면 `NOT_RECEIVED` · 계정이 바뀌면 `OWNER_CHANGED`, 둘 다 요청 0. 남의 집 읽기는 주인 기억을 안 바꾼다.
  - 저장 본문에 `data:` 그림이 있으면 요청 없이 `IMAGE_UPLOAD` — 먼저 `uploadImage` 로 올려 받은 주소만 싣는다. 그림은 png · webp · jpeg · 8MB 이하.
  - 바탕화면 그림 주소의 `http://` 는 `https://` 로 바꿔 보낸다(서버는 https 만). 프리셋은 늘 3칸(빈 칸 `null`). 새 책은 `addedAt` 을 싣지 않는다.
  - 409 에 여기서 다시 받아 보내지 않는다 — 판은 상태 주인이 들고 넘기고 `failOf` 가 `conflict` 로 알린다.
- **검사**: `checks/sim-myhome-api.js`.

## `myhome-store.js` — 🏠 마이홈 상태 주인

- **책임**: 내 마이홈 페이지(`load` · 페이지 · 판)와 보고 있는 집. 화면은 값을 직접 고치지 않고 `setField` · `setFields` · `setAvatar` · `addSticker` · `editSticker` · `removeSticker` · `moveSticker` · `setDesign` · `resetBg` 를 부른다. `page()` 는 얼려 둔 값이다.
- **상태 모델**: `server`(서버가 준 · 저장이 성공해 서버가 받은 마지막 페이지 — 받기 · 저장 성공만 바꾼다) + `pending`(못 보낸 고침 — 글 칸 · 스티커 동작 add · edit · remove · move · 디자인 · 지우기 표시 · `rebased`). `page()` = server 에 pending(보내는 중 묶음 포함)을 얹은 값 + 사진 미리보기 — emit 마다 새로 만들어 얼린다. 고친 사본 · dirty · base 를 따로 두지 않으므로 다시 받아도 섞는 규칙이 없다.
- **저장**: 받기 · 저장은 한 줄(`tail.then(job, job)`)에 선다. 저장은 pending 을 batch 로 옮기고 server 에 batch 를 얹은 값에서 본문을 만든다 — server 와 같은 칸은 싣지 않고 바뀐 게 없으면 요청 0. 디자인 PUT 먼저 · 페이지 PATCH 한 번. 올리기는 줄 밖에서 돌고 주소만 돌려주며 고침은 끝난 때 만든다. 망 · 5xx · 로그인 실패는 batch 를 pending 에 되돌리고 번호(E-MH-22 · 23) 한 번 · 혼자 다시 보내지 않는다. 서버가 거절한 값(4xx · 403 — 408 · 429 · 409 · 길 없음 404 제외)은 거절 code 가 가리키는 칸만 버리고 나머지는 한 번 더 보낸다 — 디자인 PUT 이 거절돼도 같은 묶음의 PATCH 는 간다(결과 'failed').
- **409**: 디자인 PUT 이든 페이지 PATCH 든 다시 받은 뒤 글 칸(소개 · 게시글 · 제목)만 새 판에 얹어 한 번 더 보낸다(사용자 결정 2026-11-14 Q1 = 나) — 나머지는 받은 값 + «다른 기기에서 바꾼 내용을 받아왔어요». 그 «한 번» 은 pending 의 `rebased` 로 센다(저장되거나 버려지면 같이 사라짐) — 얹은 글의 저장이 또 409 면 글도 버린다. 다시 받는 사이(`adoptSeq` 가 오른 사이) 끝난 올리기는 `'conflict'`(그림은 쓰지 않음). 다시 받기가 실패하면 잠긴 채 글은 남고 [다시 시도] 가 받은 뒤 남은 글을 한 번 보낸다.
- **deps**: `api`(myhome-api.js) · `lib`(TwMyHomeApi) · `errs` · `apiErrors` · `notifyError` · `toast` · `previewOn` · `rules`(myhome-sticker-rules.js).
- **함정**: 판 없는 받기 답은 못 받음으로 본다. 저장 본문에 `data:` 그림은 없다 — `upload(칸, 그림)` 이 주소를 돌려주면 그 주소로만 저장한다. 스티커 w · h 는 정수. 아직 바탕화면(`desktop`)은 읽기만 한다.
- **검사**: `checks/sim-myhome-store.js`.

## 마이홈 화면 ↔ 상태 주인(D2-2b) — `myhome-state.js` · `myhome-page.js` · `myhome-visit.js` · `myhome-edit.js` · `myhome-sticker.js` · `myhome-sticker-layout.js`

- **읽기**: 화면은 `mhStateMod._myHomeData()`(= `store.page()` — 얼린 값 · 구경 중이면 그 집 것)를 **그릴 때마다** 읽는다. 값을 직접 고치지 않는다(`_myHomeData().X = …` · `delete …stickers[…]` 없음). `myhome-state.js` 는 예전 이름 그대로 읽는 함수만 내놓는다(쓰는 함수 · `_mhHomeFromServer` · 계정 칸 걷음).
- **쓰기**: 글 칸 `setFields`(칸에서 벗어남 · 탭 · 창 닫기) · 사진 `setAvatar` · 스티커 `addSticker` · `editSticker`(끌기 · 회전 · 크기는 **놓을 때** 한 번) · `removeSticker` · `moveSticker` · 디자인 `setDesign` · 배경 `setField('bg')` · 초기화 `resetBg` · 그림 올리기 `upload`(주소만 돌려줌). 저장 줄 · 409 · 실패 번호는 전부 상태 주인 몫이라 화면은 «저장했어요» 를 띄우지 않는다. `upload` · `addSticker` 가 `'conflict'`(다시 받는 사이 끝남)를 돌려주면 `'failed'` 처럼 조용히 넘어간다(안내는 상태 주인).
- **받기**: `loadMyHomePage` = `store.pullMine()`(못 받으면 «마이홈을 못 불러왔어요 [다시 시도]»). 친구 홈 구경은 `store.openView(코드, 이름힌트)` · 돌아오기는 `closeView()` — 내 홈은 사본 없이 그대로라 백업 · 복원이 없다. 이름을 모르면 명함(`social-api.js fetchCards`)으로 한 줄.
- **사진**: 채팅 · 내 정보 · 플레이리스트 명함은 `store.avatar()`(없으면 `ensureMine({ site:'quiet' })` 한 번). 옛 `firebaseAPI.getMyHome` · `saveMyHome` 은 걷었다(`firebase-init.js`).
- **바뀐 것**: 스티커 움직임 속도 칸 이름 `animSpd` → `animSpeed`(서버 이름 하나로). 옛 프로필 사진 200,000자 JPEG 되돌리기는 걷었다(서버가 PNG 도 받는다).
- **로그아웃 · 앱 끄기**: `account.js` 가 `flush()` 뒤 `reset()`, `beforeunload` 가 `flush()`. 마이홈을 닫을 때(`COMMIT` 고리) 글 칸을 넘기고 못 올린 고침을 한 번 보낸다.
- **검사**: `checks/sim-myhome-wire.js`(배선 · 직접 쓰기 없음 · 진짜 상태 주인 위의 읽기 창구) · 각 화면 파일 sim 은 가짜 상태 주인 위에서 «동작 함수를 부른다» 까지.

## `gift-api.js` — 🧸 말랑이 · 🎁 선물 서버 길 provider

- **책임**: 내 말랑이 칸 읽기 · 통째 저장(`GET` · `PUT /v1/me/mallangs`) · 그림 올리기(`POST /v1/me/images?purpose=mallang`) · 남의 집 칸(`GET /v1/mallangs/{userCode}`) · 내 선물함(`GET /v1/me/gifts`) · 봤음(`POST /v1/me/gifts/seen`) · ⭐ · 치움(`PATCH /v1/me/gifts/{id}`) · 지우기(`DELETE /v1/me/gifts/{id}`) · 오늘 보낸 수(`GET /v1/me/gifts/sent-today`) · 그 집에 나온 선물(`GET /v1/gifts/{userCode}`) · 보내기(`POST /v1/gifts/{userCode}`). 서버 모양(`sentAt` ISO)을 화면 모양(`sentAt` ms)으로 맞추는 곳은 여기뿐이다. 신원은 토큰 — 보내기 본문에 내 코드 · 이름 · 날짜 · 그림 주소를 싣지 않는다.
- **만드는 법**: app.js 가 `const giftApiMod = TwGiftApi.createGiftApi({ authed: TwApi.authed, warn })` 로 한 벌 만들어 상태 주인에 넘긴다 — 지금은 말랑이 칸(`mallang-store.js`)이 쓰고, 선물함 · 보내기는 선물 묶음에서 같은 한 벌을 받는다.
- **deps**: `authed`(`TwApi.authed`) · `warn`.
- **내보내는 것**: `fetchMine()` · `fetchOf(userCode)` → `{ slots:[{ slot, imageUrl, enabled }], version }` · `uploadImage(dataUrl)` → `url` · `saveMallangs(version, slots)` · `fetchBox()` → `{ items:[{ id, senderName, imageUrl, message, starred, hidden, sentAt }], unseenCount, starCount, boxKeep, starMax }` · `markSeen()` · `star(id, on)` · `hide(id, on)` · `remove(id)` · `fetchSentToday()` → `{ count, dailyMax }` · `fetchVisible(userCode)` → `{ items:[{ id, imageUrl, message }], visibleCount, recipientCap }` · `send(userCode, { requestId, mallang, message })` → `{ giftId, sentToday, dailyMax }` · `reset()`. 순수 함수(`slotsOf` · `slotsBody` · `boxOf` · `sendBody` · `failOf` 등)는 `TwGiftApi` 위. 모두 못 읽으면 던진다 — 빈 칸 · 빈 선물함은 빈 배열로 돌려줘 «못 읽음» 과 가른다.
- **오류 갈래**: `failOf(err, TwApiErrors)` → `{ kind, code, message }`. `kind` — `guide`(⭐ 가득 · 보내기 거절 같은 안내 — 서버 문구 그대로 · 번호 없음) · `gone`(`GIFT_NOT_FOUND` — 안내 + 받기 한 번) · `missing`(`USER_NOT_FOUND` — «없음») · `site`(그 자리의 `E-GIFT-*` 번호 — 닿지 못함 · 모르는 코드도 여기) · `common`(`PREMIUM_REQUIRED` 같은 공통 코드 — `TwApiErrors.store.notify`) · `conflict`(409 `CONCURRENT_UPDATE` — 다시 받기) · `stale`(계정이 바뀌는 중 · 받기 전 — 조용히). 번호는 표에 두지 않고 부르는 자리가 정한다.
- **함정**
  - 쓰기는 읽은 토큰의 주인과 묶는다(`expectOwner`) — 내 것(칸 · 선물함 · 오늘 보낸 수)을 읽은 적이 없으면 `NOT_RECEIVED` · 읽은 뒤 로그인한 사람이 바뀌면 `OWNER_CHANGED`, 둘 다 요청 0. 남의 집 읽기는 주인 기억을 남기지 않는다.
  - 칸 번호: 받은 칸은 서버 `slot` 을 그대로 든다 — 서버는 0~3 안에서 겹치지 않음만 지키고 이어짐은 지키지 않는다(0 · 2 처럼 빌 수 있다). **보내기는 고른 칸(`mallang`)의 서버 번호**를 싣는다(화면 차례로 보내면 빈 번호에 `GIFT_NO_MALLANG`). 칸이 없으면 요청 없이 `BAD_SLOT`.
  - 칸 저장은 **통째**다 — 그때만 배열 차례로 `slot` 을 0부터 다시 매긴다(지우면 뒤 칸이 당겨지는 화면 그대로). 판은 상태 주인이 들고 넘기고, 409 에 여기서 다시 받아 한 번 더 보내지 않는다.
  - 그림은 png · webp 만(말랑이는 JPEG 를 서버가 받지 않는다) · 1MB 이하 — 아니면 요청 없이 `IMAGE_UPLOAD`. 올리기는 칸을 바꾸지 않는다 — 받은 `url` 을 `saveMallangs` 에 넣어야 칸이 된다.
  - 메시지는 UTF-16 50자까지(입력칸 `maxlength` 와 같은 단위) — 끝이 이모지 짝의 앞 반쪽이면 그것도 뺀다.
  - `requestId` 는 부르는 쪽이 `TwRequestId.createPending()` 으로 정한다(닿지 못했으면 같은 번호로 다시).
- **검사**: `checks/sim-gift-api.js`(가짜 `authed` · 진짜 `api-client` · 진짜 `api-errors` 로 실제로 불러 판정 · 일부러 깨 보기).

## `mallang.js` — 🧸 말랑이 · 🎁 선물 화면

- **책임**: 마이홈 바탕화면의 말랑이 폴더(부르기 · 등록 창) · 떠다니는 말랑이 · 마이홈에 나온 선물 말랑이(치우기) · 선물 보내기 창 · 친구 탭 🎁 배지 · 선물 말랑이를 띄우고 빼는 화면 연출. 말랑이 칸은 상태 주인(`mallang-store.js`) · 받은 선물은 선물 상태 주인(`gift-box.js`)이 서버 길로 받고 고친다 — 이 파일은 그리기 · 누름만. 보내기 창만 아직 옛 길(`firebaseAPI`)이다 — 보내기 묶음에서 옮긴다.
- **만드는 법**: app.js 가 마이홈 수령함(`createMyHomeInbox`)보다 먼저 만든다 — 수령함 · 마이홈 창 · 친구 홈 구경이 값으로 받는다.

```js
const mallangMod = TwMallang.createMallang({
  toast: (...a)=>toast(...a),
  getMyUserId: (...a)=>getMyUserId(...a),
  getDisplayName: (...a)=>getDisplayName(...a),
  premiumOn: (...a)=>_premiumOn(...a),   // 👑 프리미엄 판정 — 전역 window._premiumOn 을 읽지 않는다
  mallangStore: mallangStoreMod,         // 🧸 칸 상태 주인(mallang-store.js) — 이 줄보다 먼저 만든다
  giftBox: giftBoxMod,                   // 🎁 선물 상태 주인(gift-box.js) — 이 줄보다 먼저 만든다
});
```

- **deps**: `toast` · `getMyUserId` · `getDisplayName` · `premiumOn` · `mallangStore` · `giftBox`.
- **내놓는 것**: `onOpen(ownerId, isVisiting)` · `onClose()`(마이홈 창 `myhome-ui.js`) · `applyVisit(isVisiting, ownerId)`(친구 홈 구경 `myhome-visit.js`) · `reset()`(계정을 놓을 때 — 말랑이 · 열린 창 · 배지를 걷음) · `openGift(friendId, name)`(친구 줄 우클릭). 세 모듈은 deps `mallangMod` 로 받는다.
- **함정**
  - `onOpen` · `applyVisit` 은 async 다 — 부르는 쪽은 `Promise.resolve(…).catch` 로 받는다(try/catch 로는 못 잡는다 — `sim-myhome-steps.js`).
  - 만드는 줄은 수령함 · 마이홈 창 · 친구 홈 구경을 만드는 줄보다 앞이어야 한다(값으로 넘긴다 — 뒤면 TDZ).
  - 칸 값을 직접 고치지 않는다 — 등록 · 켜고 끄기 · 지우기는 `mallangStore.add(그림)` · `toggle(i)` · `remove(i)`. 등록 창은 칸이 바뀌면(`onChange`) 다시 그리고, 받기 전 · 받는 중 · 못 받음엔 칸 대신 «불러오는 중…» · «못 불러왔어요 [다시 시도]» 를 그린다.
  - 집을 옮기는 사이 늦게 온 앞 집 칸 · 선물 답은 `openView` 가 false · 집 번호(`houseSeq`)가 달라져 알려 준다 — 그때는 폴더 · 선물을 다시 그리지 않는다.
  - 내 선물 중 무엇이 화면에 나오는지는 선물함(`giftBox.onScreen()`)이 정한다 — 이 파일은 선물함이 바뀔 때마다(`syncGifts`) 목록에 없는 말랑이를 걷고 빠진 것을 자리(`MAX_LIVE`)가 있는 만큼 띄우며, 선물 id 를 따로 들지 않는다. 자리가 없어 못 뜬 선물은 «나와야 함» 으로 남아 자리가 나는 다음 emit 에 뜬다. 우클릭 치움은 `giftBox.hide(id)` — 누르는 즉시 목록에서 빠지고, 안 되면 목록이 서버 값으로 돌아가 다시 뜬다(손으로 다시 띄우지 않는다). 마이홈은 `enterHome()` · 나가면 `leaveHome()`(clearAll). 남의 집에선 `GET /v1/gifts/{code}`(`giftBox.fetchVisible`)로 받는다. 이 PC 에 «치움» 을 적지 않는다.
- **검사**: `checks/sim-mallang-module.js`(가짜 DOM · 가짜 서버로 열기 → 치우기 → 다시 부르기 → 지우기 → 서브탭 → 새 선물 → 남의 집 → 닫기 → 보내기 창 → 계정 놓음을 실제로 불러 부른 순서 · 값을 견줌 · 배선 · 일부러 깨 보기).

## `gift-box.js` — 🎁 선물 상태 주인 (서버가 원본)

- **책임**: 내 선물함(받기 · ⭐ · 치움 · 지우기 · 봤음 · 서버 신호 `gifts`)과 그 집에 나온 선물 받기. 받기 · 쓰기는 **한 줄(lane)** 로 하나씩 — 받는 사이 ⭐ 가 순서를 바꾸거나 쓰는 사이 받은 판이 바뀌는 엇갈림이 없다. 같은 선물에 일이 줄에 있으면 `busy`. 순서(⭐ 먼저 → 최신순)는 `order()` 순수 함수 한 곳.
- **만드는 법**: app.js 가 말랑이 화면 · 수령함 · 마이홈 창보다 먼저 `TwGiftBox.createGiftBox({ api: giftApiMod, giftLib: TwGiftApi, errs, apiErrors, notifyError, toast, rtOn })`. app-boot STEPS `gift` 가 `session.on(giftBoxMod.listen())`(신호만 · 요청 0) · `session.onReset`. 로그아웃 때 `account.js` 가 `reset()`.
- **내보내는 것**: `box()` → `{ load, items, unseenCount, starCount, boxKeep, starMax }`(받기 전 숫자는 null) · `get(id)` · `isBusy(id)` · `onChange(fn)` · `order(items)` · `pull(notify?)` · `openTab()`(받기 → 안 본 게 있으면 봤음) · `seen()` · `star(id, on)` · `hide(id)` · `show(id)` · `remove(id)` → `'ok' | 'busy' | 'gone' | 'already' | 'full' | 'starred' | 'guide' | 'failed' | 'stale'` · `attachScreen({ room(), has(id) })` · `enterHome()` · `leaveHome()` · `onScreen()` · `fetchVisible(code, { notify }?)` · `listen()` · `reset()`.
- **함정**
  - 상한(⭐ 20 · 보관 30)은 서버 응답(`starMax` · `boxKeep`)이다 — 앱에 다시 적지 않는다. 앱이 보관 한도를 넘겨 지우는 일도 없다(서버가 받을 때 정리).
  - 번호: 누른 받기(마이홈 열기 · 서브탭 · [다시 시도])만 `E-GIFT-04` · ⭐ · 치움 `E-GIFT-05` · 지우기 `E-GIFT-06` · 그 집 선물 `E-GIFT-09`. 신호로 받는 것 · 봤음 실패는 번호 없음(배지가 남고 다음 누름에 한 번). 안내 코드(`GIFT_STAR_FULL` · `GIFT_STARRED` · `GIFT_NOT_FOUND`)는 번호 없이 안내(없는 선물이면 받기 한 번).
  - 화면 규칙: `onScreen()` 은 마이홈이 눈앞이고 들어온 뒤 받기가 한 번 성공했을 때만 목록이 있다. 낙관(요청 전에 화면을 바꿈)은 치움 하나뿐 — 다시 부르기 · ⭐ · 지우기는 서버가 받아야 바뀐다. 안 되는 답은 일(`pending`)만 지우면 서버 값으로 돌아간다. 화면이 가득이면 다시 부르기는 `'full'` 로 요청 0.
  - ⭐ 21번째 · ⭐ 지우기는 요청 없이 막는다. 쓰기가 성공하면 그 줄만 고쳐 그린다(서버 재조회 없음).
  - 계정을 놓으면(`reset`) gen 이 올라 늦게 온 답은 아무것도 적지 않는다. 이 PC 에 적는 키 없음 — 옛 `tw.mallangGiftHidden` 은 첫 실행 `mallang` 단계가 지운다.
- **검사**: `checks/sim-gift-box.js`(진짜 모듈을 가짜 서버 길 위에서 — 순서 · 받기 · 한 줄 · busy · 쓰기 · 봤음 · 신호 · reset · 그 집 선물 · 배선 · 옛 길 걷음 · 일부러 깨 보기). 선물함 격자는 `sim-myhome-inbox.js`.

## `mallang-store.js` — 🧸 말랑이 칸 상태 주인 (서버가 원본)

- **책임**: 내 말랑이 칸(받기 · 등록 · 켜고 끄기 · 지우기 · 통째 저장)과 보고 있는 집 칸(내 집이면 내 칸을 가리킴 · 남의 집이면 그 집 칸). 저장은 한 번에 하나 — 저장 중 고침은 끝난 뒤 최신 칸 · 새 판으로 한 번 더. 저장이 끝나면 서버가 돌려준 칸(번호 0부터)을 그대로 받는다.
- **만드는 법**: app.js 가 말랑이 화면보다 먼저 `TwMallangStore.createMallangStore({ api: giftApiMod, giftLib: TwGiftApi, errs: TwApiErrors, apiErrors: TwApiErrors.store, notifyError, toast })`. 앱을 끌 때(`beforeunload`) · 로그아웃 올리기(`account.js`)가 `flush()`, 계정을 놓을 때 `reset()`.
- **내보내는 것**: `mine()` → `{ load, slots, version, saving, uploading }` · `view()` → `{ owner, mine, load, slots }` · `onChange(fn)` · `pullMine({ site }?)` · `openView(code, isMine)` → 아직 그 집인가 · `closeView()` · `add(dataUrl)` · `toggle(i)` · `remove(i)` → `'ok' | 'failed' | 'conflict' | 'stale' | 'locked' | 'busy' | 'full' | 'uploadFailed'` · `flush()` · `reset()` · `LOAD` · `MSG` · `SLOTS`.
- **함정**
  - 받기 전(`load !== 'ready'`)엔 고치지 못한다(`locked` · 요청 0). 저장 중이거나 못 올린 고침이 있으면 내 칸 받기는 요청하지 않는다(받은 판이 고친 칸을 덮지 않게).
  - 409 `CONCURRENT_UPDATE` 는 내 고침을 버리고 서버 것을 받아 «다른 기기에서 바꾼 내용을 받아왔어요». 실패는 화면을 고친 대로 두고 `E-GIFT-03` 한 번 — 혼자 다시 보내지 않는다(타이머 없음). 다음 고침 · `flush()` 가 한 번 보낸다.
  - 올리기(`POST /v1/me/images?purpose=mallang`) 실패는 칸을 그대로 두고 `E-GIFT-02`(PUT 없음). 올리는 중 또 등록은 `busy`. 409 로 다시 받는 사이 올리기가 끝나면 그 그림은 칸에 붙이지 않는다(파일은 남는다 — 탈퇴 때 서버가 지운다).
  - 오류: 받기 `E-GIFT-01`(보내기 창 열기는 `site: 'sendOpen'` → `E-GIFT-07`) · 공통 code(`PREMIUM_REQUIRED` 등)는 `TwApiErrors.store.notify` · 계정이 바뀌는 중(`OWNER_CHANGED` · `NOT_RECEIVED`)은 조용히 · 없는 사람(`USER_NOT_FOUND`)은 «말랑이 없음».
- **검사**: `checks/sim-mallang-store.js`(진짜 모듈을 가짜 서버 길 위에서 — 저장 차례 · 409 · 실패 한 번 · 등록 · 집 gen · reset · 배선 · 일부러 깨 보기).

## `bookshelf-store.js` · `bookmark.js` — 📚 책장 (서버가 원본)

- **책임**: `bookshelf-store.js` — 내 책장(받기 · 통째 저장)과 보고 있는 집의 공개 책. 순서 = 배열 차례, 저장이 끝나면 서버가 돌려준 책(서버가 지금 시각을 넣은 `addedAt` 포함)으로 다시 그린다. 저장은 한 번에 하나 — 저장 중 고침은 끝난 뒤 최신 목록 · 새 판으로 한 번 더. `bookmark.js` — 서랍 · 책등 · 끌어서 순서 · 책 꽂기 창(그리기 · 누름만 — 값은 `put(책 목록)` 으로만 고친다).
- **만드는 법**: app.js 가 `TwBookshelfStore.createBookshelfStore({ api: bookshelfApiMod, lib: TwMyHomeApi, errs, apiErrors, notifyError, toast })` → `TwBookmark.createBookmark({ bookshelfStore, toast, buildFreeColorPicker })`(`bookmark.js` 는 app.js 앞에 실리고 바탕화면에는 `MYHOME_DESKTOP.onReady` 로 붙는다). 앱을 끌 때 · 로그아웃 올리기(`account.js`)가 `flush()`, 계정을 놓을 때 `reset()`. 모듈을 싣기만 해서는 요청 · 타이머가 없다 — 서랍을 처음 열 때(내 집) · 구경을 시작할 때 받는다.
- **내보내는 것(store)**: `mine()` → `{ load, books, version, saving }` · `view()` → `{ owner, load, books }`(`load`: `idle` · `loading` · `ready` · `failed` · `missing`) · `onChange(fn)` · `pullMine()` · `openView(code)` · `retryView()` · `closeView()` · `put(books)` → `'ok' | 'failed' | 'conflict' | 'stale' | 'locked' | 'full'` · `uploadImage(dataUrl)` → `{ ok, url }` · `flush()` · `reset()`.
- **함정**
  - 받기 전(`load !== 'ready'`)엔 고치지 못한다(`locked` · 요청 0 · «불러오는 중이에요» 안내). 이미 받았으면 서랍을 다시 열어도 요청 0. 저장 중이거나 못 올린 고침이 있으면 내 책장 받기는 요청하지 않는다.
  - 409 `CONCURRENT_UPDATE` 는 내 고침을 버리고 서버 것을 받아 «다른 기기에서 바꾼 내용을 받아왔어요». 실패는 화면을 고친 대로 두고 `E-MH-27` 한 번 — 혼자 다시 보내지 않는다. 받기 실패는 서랍의 «못 불러왔어요 [다시 시도]» + `E-MH-26`.
  - 구경: 공개 책을 못 받아도 폴더는 보이고 서랍에 «다시 시도»(시작하며 받다 실패하면 번호 없음 · 누른 다시 시도가 또 실패하면 `E-MH-26`). 없는 사람(`USER_NOT_FOUND`)은 폴더를 숨긴다. 집을 빨리 옮겨도 앞 집 답은 버린다(`gen`).
  - 책등 그림 올리기 실패는 창 안 글(«그림을 올리지 못했어요.»)만 — 그 실패는 `bookmark.js` 가 `E-MH-24` 를 한 번 띄운다(공통 번호를 이미 알렸으면 건너뜀). 새 책은 `addedAt` 을 싣지 않고(서버가 넣는다) 색이 없는 옛 책은 색 칸을 싣지 않는다. 뗀 그림 지우기는 서버 몫이다.
  - 이 PC 사본(`tw.bookmarks`)은 읽지 않는다 — 첫 실행 `myhome` 단계(`first-run-013.js`)가 지운다(올리지 않음).
- **검사**: `checks/sim-bookshelf-store.js`(받기 · 저장 차례 · 409 · 실패 한 번 · 50권 · 구경 gen · reset · 배선 · 일부러 깨 보기) · `checks/sim-bookmark.js`(서랍 화면).

## `scheduler.js` — 📅 스케줄러 · 🔔 일정 알림 (서버가 원본)

- **책임**: 마이홈 [스케줄러] 탭(달력 · 📌 기념일 카드 · ⏳ D-day 배너) · 🔔 알림창(오늘 일정 · 이정표 기념일 · 친구 태그). 받기 · 쓰기는 `schedule-api.js` 로, 화면과 «오늘 날짜를 이 기기 시간대로 보는» 셈만 여기 있다.
- **만드는 법**: app.js 가 `MhScheduler.createScheduler({ scheduleApi, apiErrors, notifyError, rtOn, getMyUserId, viewingUserId, myHomeFriends, toast, uiIconEl, escRegisterWindow, closeChipPopups, positionInputBelowChar, inboxUnreadCount, refreshFriendTabBadge, bellSeenKey, twNav })`. `rtOn(kind, fn)` 는 `TwRtHub.store.on` — 서버가 `schedule`(내 일정 · 보드가 다른 기기에서 바뀜) · `notification`(🔔 칸) · `friendSchedule`(구경 중인 친구의 일정이 바뀜 — `subject` 가 그 친구 코드)이 바뀌었다고 알리면 다시 받는다.
- **내놓는 것**: `renderSchedCalendar` · `renderDdays` · `loadBoard`(로그인 뒤 보드 받기) · `loadMine`(계정 이어받은 뒤 전부 다시 받기) · `reset`(계정을 놓을 때) · `startVisit(친구)` · `endVisit()`(👀 구경) · `refreshBellBadge` · `renderBellList` · `isBellOpen`.
- **화면 상태**: 달력 · 내 보드 · 친구 보드 각각 받는 중 / 받음 / 못 받음. 받는 중·못 받음은 «빈 목록» 문구가 아니라 «불러오는 중이에요» / «불러오지 못했어요 — 눌러서 다시 시도» 를 그 자리에 보이고(탭을 다시 열어도 다시 받는다), **받기 전에는 쓰기 · 편집창을 잠근다**(받은 값이 덮어 고친 것을 지우지 않게). 받기 실패 알림은 `E-MH-04` 한 번(이어지는 동안).
- **쓰기**: 일정은 한 번에 하나 — 서버가 돌려준 일정을 달력에 얹는다(달을 통째로 다시 받지 않는다). 보드는 받기와 저장을 `_boardChain` 한 줄로 세운다 — 보내는 중에 또 고쳐도 끝난 뒤의 최신 값에서 이어 보낸다. 409 면 보내지 않고 서버 값을 다시 받아 그린 뒤 `E-NET-05`. 친구가 아닌 사람 태그(`SCHEDULE_TAG_NOT_FRIEND`)는 오류 번호 없이 «친구가 아닌 사람은 태그할 수 없어요» 토스트만(편집창은 그대로), 그 밖의 태그 거절(자기 태그 등)은 `E-MH-06`, 상한 초과는 `E-MH-07`, 카드 그림 문제는 `E-MH-05`. 계정이 바뀌는 중(`OWNER_CHANGED`)은 조용히 버린다.
- **함정**
  - 🔔 뱃지는 «오늘 내 일정 · 친구 태그 알림» 모두 만든 시각이 `tw.bellSeenTs` 보다 뒤인 것만 센다. 오늘이 이정표인 D-day 만 «오늘 알림창을 열어 봤는가»(날짜)로 센다.
  - 친구 구경 중 `schedule` 알림이 와도 달력은 건드리지 않는다(내 알림이라서) — 내 보드 · 오늘 일정 · 알림만 다시 받는다. 친구 것은 `friendSchedule` 의 `subject` 가 **지금 구경 중인 친구와 같을 때만** 보는 달 · 보드를 조용히 다시 받는다(아니면 요청 0 · 받는 중에 또 오면 끝난 뒤 한 번 더 · 실패하면 번호 없이 지금 화면 유지 · 구경을 끝냈거나 친구를 옮긴 뒤 늦게 온 답은 버림). 오래 끊겼다 붙을 때(`resync` — 친구 코드 없음)도 지금 구경 중인 친구를 같은 길로 한 번 다시 받는다(구경 중이 아니면 요청 0).
  - `reset()` 은 세대 번호를 올려 늦게 오는 앞 계정 답을 버린다 — 새 계정 것은 `loadBoard` / `loadMine` 이 받는다.
  - 계정별로 이 PC 에 남는 값: `tw.bellSeenTs`(app.js `BELL_SEEN_KEY` — 계정 전환 지움 목록). 기기 취향: `tw.annivAreaH`(구분선 높이) · `tw.bellWinPos`(알림창 자리).
- **검사**: `checks/sim-scheduler.js`(진짜 provider + 가짜 authed 위에서 받는 상태 · 잠금 · 저장 줄 세우기 · 409 · 계정 바뀜 · 구경 · 깨 보기).

## `myhome-desktop.js` — 🖥️ 마이홈 바탕화면 · 캐릭터세팅 창

- **책임**: 마이홈 우측 미니 바탕화면(배경 색 · 이미지 · 폴더 · 작업표시줄)의 서버 공유 — 배경 · 폴더 숨기기 · 폴더 자리의 원본은 서버(`PUT /v1/me/myhome/desktop`)이고 상태 주인(`myhome-store.js` `setDesktop`)이 받고 저장한다. 좀비 어드벤처 코드는 꺼진 채 남아 있다(`ADV_GAME_OFF`).
- **만드는 법**: `window.TwMyHomeDesktop.createMyHomeDesktop(deps)` — 만드는 줄은 `myhome-desktop-boot.js` 한 줄.
- **deps**: `myhomeStore` — 상태 주인(지금 그리는 바탕화면은 `desktop()` 한 곳 — 구경 중이면 그 집 것(`openView` 가 페이지와 한 번에 받아 둔 값) · 아니면(미리보기 포함) 내 것. 고리 `FINISH_ARRANGE` 를 걸어 친구 집 · 미리보기로 들어가기 전에 옮기던 폴더 배치를 저장한다 · 바꾸려면 `setDesktop` · 그림은 `upload('desktop:bg')`). `advStore` — 게임 저장(꺼져 있음) 계정별 로컬 칸(`shared/account-store.js`). 바탕화면 저장(`tw.advZ.v2`, 옛 `v1` 읽기)을 계정마다 따로 둔다. 코드가 없거나 계정 확인 전(칸이 닫힘)이면 저장 0건 · 읽으면 기본 바탕화면. 계정을 놓은 틈에는 쓰기가 거절된다.
- **내놓는 것**: `window.MYHOME_DESKTOP`(`addFolder` 등) — 북마크 책장 · 폴더 자유배치가 이걸로 붙는다. 나머지 app.js 전역(`getMyUserId` · `firebaseAPI` · `toast` · `FolderFree`)은 예전처럼 전역 이름으로 읽는다.
- **함정**: 만들 때는 계정 칸을 읽지 않는다 — `ADV` 는 빈 기본값(`advDefault`)으로 서고 `MYHOME_DESKTOP.startBgSync(uid)` 가 계정 확인 뒤 계정 칸에서 읽어 채운다(서버 읽기는 안 한다 — 바탕화면은 마이홈을 열 때 상태 주인이 받는다)(`launcher/app-boot.js` desktopBg 칸). 시작 전 `advSave` 는 아무것도 안 한다(빈 기본값이 저장본을 덮지 못하게). 바탕화면 값은 상태 주인이 받으면 `onChange` 로 다시 칠한다— 옛 «고른 시각(`bgTs`)으로 기기끼리 맞추기» · `advBg` · `tw.advZ.v2` 의 `bg`·`hideFolders`·`folderPos` 칸은 읽지 않는다. `MYHOME_DESKTOP` 은 만들자마자 내놓으므로 다른 스크립트(`bookmark.js` 등)가 쓰기 전에 만들어져야 한다 → boot 는 `myhome-desktop.js` 바로 다음에 싣는다. boot 는 app.js 최상위 `accountStoreMod` 를 읽는다(app.js 가 먼저 실려야 한다).
- 검사: `checks/sim-account-store.js`(저장 칸 고르기 — `advLoad` · `advSave` 를 떼어 계정 A/B 로 불러 본다), `sim-mhd-*` · `sim-folder-free.js`.

### 🧟 좀아칼 옛 게임 코드 — `apps/desktop/archive/myhome-game-archive.js` (D2-6)

- 사용자 결정(2026-11-14 · 설계 Q2): 게임은 **끄고 별도 파일로 보관**한다 — 지우지 않는다. `myhome-desktop.js` 에서 게임 문장(시뮬 · 캐릭터세팅 · 인벤토리 · 파티 · 전투 · 스토리 · 지도 · 칭호 · 세계관) 약 4,300줄과 게임 창 HTML · 이벤트 연결을 걷어 `createMyHomeGameArchive(deps)` 안에 글자 그대로 옮겼고, 바탕화면 쪽에서 걷어 낸 조각은 파일 맨 아래 줄 주석으로 남겼다.
- **싣지 않는다** — html · smoke · 검사 어디도 읽지 않고 앱 묶음(electron-builder `files`)에도 안 들어간다(`apps/desktop/archive/`). 문법만 `node --check` 로 맞다. 다시 설계할 때 참고해 모듈로 새로 짠다(옛 코드는 `firebaseAPI.adv*` Firebase 를 직접 불렀다).
- 바탕화면 쪽에 그대로 남은 것: 게임 저장 읽기 · 쓰기(`tw.advZ.v2` · `advLoad` · `advSave` — 지우지 않는다) · 게임 CSS 문자열(같은 `css` 안에 섞여 있다) · 외부 앱 등록(`window.MYHOME_DESKTOP`) · 방문 모드 훅.

## `myhome-desktop-boot.js` — 🖥️ 바탕화면을 만드는 한 줄

- **책임**: `createMyHomeDesktop({ advStore: accountStoreMod })` 한 줄. 바탕화면은 app.js 뒤에 실리고 싣자마자 돌아야 해서, app.js 가 만든 계정 칸을 deps 로 넘기는 자리를 별도 파일로 둔다.
- **함정**: 순서 — `app.js` → `myhome-desktop.js` → 이 파일. 사이에 다른 스크립트를 끼우지 않는다(`bookmark.js` 는 app.js 가 만들어 앞에 실린다). html 에 `myhome-desktop-boot.js` 가 있는지는 `sim-account-store.js` 가 본다.

