# chat/ — 채팅 도메인

## `chat-notice.js` · `chat-notice-net.js` — 📢 시크릿룸 공지(#공지 탭 · 고정 한 줄)

**책임** — 시크릿룸 방장이 채팅창의 «#공지» 탭에서 공지를 쓰고 · 고치고 · 지우고 · 📌 하나를 고정한다. 고정한 공지는 모든 채팅 탭 위에 한 줄로 뜨고(길면 마우스를 올려 흘려 읽는다) 누르면 숨고(다른 공지를 고정하거나 고치면 · 채팅창을 다시 열면 다시 뜬다) 다시 보려면 #공지 탭. 공지는 채팅 말풍선 · 기록으로 나가지 않고, 시크릿룸이 아닌 방에는 탭도 줄도 없다. 참여자는 읽기만.

**데이터** — `rooms/{방}/_notice/{n1..n20} = { text(1~300자), ts, pin? }`. `_` 로 시작해 방 인원으로 안 센다 · 대화 3일 보관(`chat-expire.js`)이 건드리지 않아 **영구 보관**. 자리 이름이 곧 상한(20개 — 규칙에 자식 수 세는 함수가 없다). 고정은 공지 안의 `pin:true` 하나 — 새로 고정하면 같은 묶음에서 옛 고정을 지운다. 서버 방이어도 Firebase 다(탭 기록 `_chatTab` 과 같다).

**만드는 법** — `chat-notice-net.js`(classic script `window.TwChatNoticeNet`)는 firebase-init.js 가 `firebaseAPI.chatNotice` 로 연결만 한다(줄 수 상한 때문에 import 가 아니라 전역). 화면 `chat-notice.js` 는 app.js 가 채팅 모듈보다 먼저 만들어 값으로 넘긴다:

```js
const chatNoticeMod = TwChatNotice.createChatNotice({ document, escHtml, toast, getMyUserId, roomState: TwRoomState, roomCode: ()=>Presence.roomCode(), notifyError, provider: { subscribe, add, edit, remove, pin } });
const chatUiMod = TwChatUi.createChatUi({ …, chatNotice: chatNoticeMod, … });
```

**내놓는 것** — 순수: `list` · `pinnedOf` · `cleanText` · `pinClearIds` · `timeText` · `pinHtml` · `itemHtml` · `listHtml`. 컨트롤러: `start` · `stop`(채팅창 열 때 · 닫을 때) · `open` · `close` · `isActive` · `available` · `count` · `hint` · `submit(inp)`(Enter 가 공지면 true) · `act(name, id)` · `onChange(fn)`.

**함정**
- 공지 모듈은 채팅 · 잠금 모듈을 **부르지 않는다**(순환 — `sim-dep-cycles`). 채팅 모듈이 `onChange` 로 «탭 줄 · 입력칸 안내문 다시 그리기» 를 걸어 둔다. 방장 · 시크릿룸 판정은 `room-state.js` 한 곳.
- 남이 쓰는 글이라 화면에는 반드시 `escHtml`(`TwSafeHtml.text`)을 거친다 — 단추 안에 변수째 넣지 않고 그 자리에서 부른다(`audit` 검사 19).
- «방장만 쓴다» 는 앱이 막는다. Firebase 방은 규칙이 열려 있어 고쳐 쓴 앱은 뚫을 수 있다 — 규칙은 모양 · 길이 · 시크릿룸 코드(`SCRT-`)만 지킨다(친구끼리 쓰는 방이라 이 정도로 둔다).
- #공지 는 채팅 탭이 아니라 «보기 상태» — 저장 · 방송 · 안 읽음 숫자가 없고, 채팅 쪽 탭(presence)은 그대로 둔다.
검사: `checks/sim-chat-notice.js`.

## `chat-focus.js` — 📊 시크릿룸 #집중 탭(방 전체 집중 기록)

**책임** — 채팅창의 «#집중» 탭(#공지 다음 · 시크릿룸에서만)을 열면 방 사람들이 «이 방 기록에 올리기» 를 켜고 쌓은 집중 시간이 보인다 — 방 전체 누적(큰 글씨) · 오늘 / 이번 주 · 사람별 순위(오늘 · 이번 주 · 누적 단추). 내 올리기 켜기 · 끄기 · «내 기록 지우기» 도 여기. 채팅 탭이 아니라 «보기 상태» — 저장 · 방송 · 안 읽음이 없다.

**데이터** — `rooms/{방}/_focus/{내 id} = { n(이름 ≤20자), d:{YYYYMMDD:그날 초(0~86400)}, o(12주보다 오래된 날을 합친 초) }`. 구독은 이 탭을 보는 동안만 방 전체 노드 하나(사람 수 × 최대 84일). 12주(84일)보다 오래된 날은 **내 칸만** 열 때 한 번 `o` 로 합친다(저장량 일정). 올리기는 `focus/room-focus-sync.js`(1분 모아 정수 초 · 방에 있는 동안만 · 켠 방만) · 서버는 `focus/room-focus-net.js`. 날 키는 6시 경계 «집중 하루»(`focus-total.js _focusDayStr`) → `TwRoomFocusSync.dayKeyOf`.

**만드는 법** — app.js 가 채팅 모듈보다 먼저 `roomFocusSync` 와 `chatFocusMod` 를 만들고 `chatFocus: chatFocusMod` 로 넘긴다. 올리기는 포커스 모듈이 `addFocusSeconds` 끝에서 부르는 `onFocusAdded` 에 건다.

**내놓는 것** — 순수: `weekStartKey` · `addDays` · `stats` · `rank` · `compactPlan` · `fmtDur` · `viewHtml`. 컨트롤러: `start`(방이 바뀌면 다시) · `stop`(창 닫을 때) · `open` · `close` · `isActive` · `available` · `hint` · `submit`(#집중 에서 Enter — 안내만 · 채팅으로 안 보냄) · `onChange`.

**함정** — ① 켠 사람의 **이름과 시간이 방 사람들에게 보인다**(화면에 그렇게 안내한다). 규칙상 쓰기는 «내 칸» 이어도 앱이 지킬 뿐이다(방 코드를 아는 고쳐 쓴 앱은 남의 칸을 쓸 수 있다 — 공지와 같은 수준). ② 날 칸 규칙이 «줄어들지 않는다» 라 올린 시간은 깎이지 않고, 지우려면 «내 기록 지우기»(내 칸 통째). ③ 앱을 끄거나 방을 나가는 순간 모으던 최대 1분 몫은 못 올린다. ④ `dayKey` 모양은 `room-focus-sync.js` 한 곳이다(규칙 `$day` 는 `^20[0-9]{6}$`). ⑤ 이름은 남이 쓴 값 — 화면에 넣을 때 반드시 `escHtml`.
