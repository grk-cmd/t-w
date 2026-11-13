# chat/ — 채팅 도메인

## `chat-notice.js` · `chat-notice-net.js` — 📢 시크릿룸 공지(#공지 탭 · 고정 한 줄)

**책임** — 시크릿룸 방장이 채팅창의 «#공지» 탭에서 공지를 쓰고 · 고치고 · 지우고 · 📌 하나를 고정한다. 고정한 공지는 모든 채팅 탭 위에 한 줄로 뜨고(길면 마우스를 올려 흘려 읽는다) 누르면 숨고(다른 공지를 고정하거나 고치면 · 채팅창을 다시 열면 다시 뜬다) 다시 보려면 #공지 탭. 공지는 채팅 말풍선 · 기록으로 나가지 않고, 시크릿룸이 아닌 방에는 탭도 줄도 없다. 참여자는 읽기만.

**데이터** — `rooms/{방}/_notice/{n1..n20} = { text(1~300자), ts, pin? }`. `_` 로 시작해 방 인원으로 안 센다 · 대화 3일 보관(`chat-expire.js`)이 건드리지 않아 **영구 보관**. 자리 이름이 곧 상한(20개 — 규칙에 자식 수 세는 함수가 없다). 고정은 공지 안의 `pin:true` 하나 — 새로 고정하면 같은 묶음에서 옛 고정을 지운다. 서버 방이어도 Firebase 다(탭 기록 `_chatTab` 과 같다).

**만드는 법** — `chat-notice-net.js`(classic script `window.TwChatNoticeNet`)는 firebase-init.js 가 `firebaseAPI.chatNotice` 로 연결만 한다(줄 수 상한 때문에 import 가 아니라 전역). 화면 `chat-notice.js` 는 app.js 가 채팅 모듈보다 먼저 만들어 값으로 넘긴다:

```js
const chatNoticeMod = TwChatNotice.createChatNotice({ document, escHtml, toast, getMyUserId, roomState: TwRoomState, roomCode: ()=>Presence.roomCode(), notifyError, provider: { subscribe, add, edit, remove, pin } });
const chatUiMod = TwChatUi.createChatUi({ …, chatNotice: chatNoticeMod, … });
```

**내놓는 것** — 순수: `list` · `pinnedOf` · `cleanText` · `freeSlot` · `pinClearIds` · `timeText` · `pinHtml` · `itemHtml` · `listHtml`. 컨트롤러: `start` · `stop`(채팅창 열 때 · 닫을 때) · `open` · `close` · `isActive` · `available` · `count` · `hint` · `submit(inp)`(Enter 가 공지면 true) · `act(name, id)` · `onChange(fn)`.

**함정**
- 공지 모듈은 채팅 · 잠금 모듈을 **부르지 않는다**(순환 — `sim-dep-cycles`). 채팅 모듈이 `onChange` 로 «탭 줄 · 입력칸 안내문 다시 그리기» 를 걸어 둔다. 방장 · 시크릿룸 판정은 `room-state.js` 한 곳.
- 남이 쓰는 글이라 화면에는 반드시 `escHtml`(`TwSafeHtml.text`)을 거친다 — 단추 안에 변수째 넣지 않고 그 자리에서 부른다(`audit` 검사 19).
- «방장만 쓴다» 는 앱이 막는다. Firebase 방은 규칙이 열려 있어 고쳐 쓴 앱은 뚫을 수 있다 — 규칙은 모양 · 길이 · 시크릿룸 코드(`SCRT-`)만 지킨다(친구끼리 쓰는 방이라 이 정도로 둔다).
- #공지 는 채팅 탭이 아니라 «보기 상태» — 저장 · 방송 · 안 읽음 숫자가 없고, 채팅 쪽 탭(presence)은 그대로 둔다.
검사: `checks/sim-chat-notice.js`.
