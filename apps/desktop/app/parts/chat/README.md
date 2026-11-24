# chat/ — 대화(투게더룸 · 시크릿룸 대화창)

## `chat-rt.js` — 💬 대화 포트(realtime 연결 하나 + API)
- 책임: 대화창의 서버 경로 한 곳 — 보내기(`chatSay{ requestId, tab, text | game }` → `chatSaid` · 방 전원 `chatLine`) · 지난 기록(`GET /v2/rooms/{코드}/chats?tab=&since=&limit=` → `{ lines, hasMore }`) · 방장 지우기(`chatClear{ tab }` — 지우기 표시 줄은 서버가 만든다) · 내 이모티콘 8칸(`GET · PUT · DELETE /v2/me/emojis`).
- 서버가 정하는 것: 워킹룸 대화 없음(`CHAT_NOT_AVAILABLE`) · 잠금(`CHAT_OFF`) · 5초 8줄(`CHAT_TOO_FAST`) · 글 상한 · 방장 판정 · 주사위 · 날리기 문장. 여기서 다시 판단하지 않는다.
- 모양 바꾸기는 이 파일 한 곳: 서버 줄 `{ id, tab:'GENERAL'|'S1'|'S2', kind, userCode?, name, text, ts }` → 앱 줄 `{ id, uid(=userCode), name, text, ts(ms), tab('general'|'s1'|'s2'), sys:'clr'(CLEAR) }`(대화창 · `chat-history.js` 가 읽던 모양). 탭 이름은 `room/room-rt.js` 의 `historyTabOf` · `tabFromWire` 한 벌.
- 만드는 법: classic script(`window.TwChatRt`) — `rt-hub.js` · `room-rt.js` · `api-client.js` · `request-id.js` 다음 · app.js 보다 먼저. 앱 한 벌 `TwChatRt.store` 를 대화창 · 주사위 · 날리기가 deps `chatNet` 으로 받는다. `firebase-init.js` 의 `chatHistory`(이 PC 화면 캐시 · `chat-history.js`)가 `subscribeSince` · `clear` 를 이 포트에 잇는다.
- 내놓는 것: `sendText(room, text, tab)` · `sendGame(room, { dice:[a,b] } | { fly: userCode }, tab)` → `{ ok, id, ts }` | `{ ok:false, code }` · `clear(room, tab)` · `subscribeSince(room, tab, since, onMsg, onReady)` · `subscribeLog(room, cb, limit, tab, onFail)`(안 읽은 수 · 처음 받기 실패는 onFail 한 번) · `getEmojis()` · `putEmoji(slot, cmd, imageUrl)` · `deleteEmoji(slot)`.
- 시크릿룸도 지난 기록을 서버에서 읽는다(서버 3일 보관 · 사용자 결정 11-09 — 이 PC 저장분(IndexedDB)은 그대로 두고 그 뒤만 이어 받는다). 지난 기록을 못 받으면 `subscribeSince` 의 `onFail` 이 불리고 빈 대화로 끝내지 않는다(E-CHAT-02). 대화창은 맨 위에 «지난 대화를 불러오지 못했어요 + [다시 시도]» 한 줄을 그리고, 누르면 같은 방 · 탭을 처음부터 다시 받는다(`_chatRetryHistory` — 실패하면 E-CHAT-02 를 다시 알린다 · 사람이 연 때 · 누른 때만). 내 이모티콘을 못 받으면 `getEmojis` 가 던진다(E-CHAT-04 · 칸을 잠근다). 글 보내기는 자동으로 다시 보내지 않는다 — 시간 초과(`timeout`) 뒤 사용자가 같은 글을 다시 누르면 같은 `requestId`. `reset()` — 계정이 바뀔 때(`session.onReset`) 줄 · 기다리던 요청을 비운다.
- 함정: `chatLine` 에는 방 코드가 없다 — 지금 방(`roomCode`)의 줄로 본다. `chatSaid` 를 못 받으면(시간 초과) 실패로 끝낸다 — 자동으로 다시 보내지 않는다. 사용자가 같은 글을 같은 방에서 60초 안에 다시 보내면 같은 `requestId`(서버가 처음 줄을 돌려준다). 이모티콘 그림은 Storage `users/{내 코드}/emojis/{칸}.png|gif` 에 올린 주소만 서버가 받는다(`firebaseAPI.uploadEmojiImage`).
- 검사: `checks/sim-chat-rt.js`.

## `chat-ui.js` — 대화창 화면
- 지난 기록은 deps `chatHistory`(읽는 함수 — `chat-history.js` 의 `open` · `syncTabs`) 한 길로 받는다. 기록 모듈이 없거나 열다 던지거나 서버에서 못 받으면 같은 «지난 대화를 불러오지 못했어요 + [다시 시도]» 줄 + `E-CHAT-02` + `console.warn` — 다른 길(최근 줄 구독 `subscribeLog`)로 돌리지 않는다. `subscribeLog` 는 안 읽은 수 세기(뱃지 · 탭 숫자)에만 쓴다 — 그쪽 실패는 `subscribeLog(…, onFail)` 로 알려 와 뱃지 · 탭 숫자를 «?»(모름 — 0 이 아니다)로 보이고 `console.warn` 을 남기며 `E-CHAT-02` 를 방마다 한 번 알린다. 다시 받으면 숫자로 돌아온다.

## `chat-notice.js` · `chat-notice-net.js` — 📢 시크릿룸 공지(#공지 탭 · 고정 한 줄)
- 🚧 0.13 위(0.14.0): deps `enabled` — `TwServerFeatures.on('chatNotice')` 가 꺼지면 `available()` false(탭 · 구독 없음). provider 는 서버 경로가 생길 때까지 `TwServerFeatures.noServer('chatNotice')`(#1098).

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
- 🚧 0.13 위(0.14.0): deps `enabled` — `TwServerFeatures.on('chatFocus')` 가 꺼지면 탭 · 구독 없음. 올리기(room-focus-sync) · 탭의 provider 는 `TwServerFeatures.noServer('chatFocus')`(#1099).

**책임** — 채팅창의 «#집중» 탭(#공지 다음 · 시크릿룸에서만)을 열면 방 사람들이 «이 방 기록에 올리기» 를 켜고 쌓은 집중 시간이 보인다 — 방 전체 누적(큰 글씨) · 오늘 / 이번 주 · 사람별 순위(오늘 · 이번 주 · 누적 단추). 내 올리기 켜기 · 끄기 · «내 기록 지우기» 도 여기. 채팅 탭이 아니라 «보기 상태» — 저장 · 방송 · 안 읽음이 없다.

**데이터** — `rooms/{방}/_focus/{내 id} = { n(이름 ≤20자), d:{YYYYMMDD:그날 초(0~86400)}, o(12주보다 오래된 날을 합친 초) }`. 구독은 이 탭을 보는 동안만 방 전체 노드 하나(사람 수 × 최대 84일). 12주(84일)보다 오래된 날은 **내 칸만** 열 때 한 번 `o` 로 합친다(저장량 일정). 올리기는 `focus/room-focus-sync.js`(1분 모아 정수 초 · 방에 있는 동안만 · 켠 방만) · 서버는 `focus/room-focus-net.js`. 날 키는 6시 경계 «집중 하루»(`focus-total.js _focusDayStr`) → `shared/room-focus-days.js`(`TwRoomFocusDays` — 이 파일보다 먼저 싣는다).

**만드는 법** — app.js 가 채팅 모듈보다 먼저 `roomFocusSync` 와 `chatFocusMod` 를 만들고 `chatFocus: chatFocusMod` 로 넘긴다. 올리기는 포커스 모듈이 `addFocusSeconds` 끝에서 부르는 `onFocusAdded` 에 건다.

**내놓는 것** — 순수: `stats` · `rank` · `compactPlan` · `fmtDur` · `viewHtml`(날 키 · 주 시작은 `shared/room-focus-days.js`). 컨트롤러: `start`(방이 바뀌면 다시) · `stop`(창 닫을 때) · `open` · `close` · `isActive` · `available` · `hint` · `paint` · `act`(단추 하나 — 검사가 직접 부른다) · `submit`(#집중 에서 Enter — 안내만 · 채팅으로 안 보냄) · `onChange`.

**함정** — ① 켠 사람의 **이름과 시간이 방 사람들에게 보인다**(화면에 그렇게 안내한다). 규칙상 쓰기는 «내 칸» 이어도 앱이 지킬 뿐이다(방 코드를 아는 고쳐 쓴 앱은 남의 칸을 쓸 수 있다 — 공지와 같은 수준). ② 날 칸 규칙이 «줄어들지 않는다» 라 올린 시간은 깎이지 않고, 지우려면 «내 기록 지우기»(내 칸 통째). ③ 앱을 끄거나 방을 나가는 순간 모으던 최대 1분 몫은 못 올린다. ③-2 «내 기록 지우기» 는 그 방에 들어가 있을 때만 된다(방을 떠난 뒤 남은 기록을 지우는 길은 아직 없다). ④ 날 키 모양은 `room-focus-days.js` 한 곳이다(규칙 `$day` 는 `^20[0-9]{6}$`). ⑤ 이름은 남이 쓴 값 — 화면에 넣을 때 반드시 `escHtml`.

- TODO: 0.13 합친 뒤 — `chat-notice-net.js` · `room-focus-net.js` 는 아직 Firebase 방(`rooms/{방}/_notice` · `_focus`)에 직접 읽고 쓴다. 0.13 방은 서버 방이라 서버 길(대화 포트 `chat-rt.js` 와 같은 realtime · API)로 옮겨야 한다.
