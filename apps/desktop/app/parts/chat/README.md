# chat/ — 대화(투게더룸 · 시크릿룸 대화창)

## `chat-rt.js` — 💬 대화 포트(realtime 연결 하나 + API)
- 책임: 대화창의 서버 길 한 곳 — 보내기(`chatSay{ requestId, tab, text | game }` → `chatSaid` · 방 전원 `chatLine`) · 지난 기록(`GET /v1/rooms/{코드}/chats?tab=&since=&limit=` → `{ lines, hasMore }`) · 방장 지우기(`chatClear{ tab }` — 지우기 표시 줄은 서버가 만든다) · 내 이모티콘 8칸(`GET · PUT · DELETE /v1/me/emojis`).
- 서버가 정하는 것: 워킹룸 대화 없음(`CHAT_NOT_AVAILABLE`) · 잠금(`CHAT_OFF`) · 5초 8줄(`CHAT_TOO_FAST`) · 글 상한 · 방장 판정 · 주사위 · 날리기 문장. 여기서 다시 판단하지 않는다.
- 모양 바꾸기는 이 파일 한 곳: 서버 줄 `{ id, tab:'GENERAL'|'S1'|'S2', kind, userCode?, name, text, ts }` → 앱 줄 `{ id, uid(=userCode), name, text, ts(ms), tab('general'|'s1'|'s2'), sys:'clr'(CLEAR) }`(대화창 · `chat-history.js` 가 읽던 모양). 탭 이름은 `room/room-rt.js` 의 `historyTabOf` · `tabFromWire` 한 벌.
- 만드는 법: classic script(`window.TwChatRt`) — `rt-hub.js` · `room-rt.js` · `api-client.js` · `request-id.js` 다음 · app.js 보다 먼저. 앱 한 벌 `TwChatRt.store` 를 대화창 · 주사위 · 날리기가 deps `chatNet` 으로 받는다. `firebase-init.js` 의 `chatHistory`(이 PC 화면 캐시 · `chat-history.js`)가 `subscribeSince` · `clear` 를 이 포트에 잇는다.
- 내놓는 것: `sendText(room, text, tab)` · `sendGame(room, { dice:[a,b] } | { fly: userCode }, tab)` → `{ ok, id, ts }` | `{ ok:false, code }` · `clear(room, tab)` · `subscribeSince(room, tab, since, onMsg, onReady)` · `subscribeLog(room, cb, limit, tab)`(안 읽은 수) · `getEmojis()` · `putEmoji(slot, cmd, imageUrl)` · `deleteEmoji(slot)`.
- 함정: `chatLine` 에는 방 코드가 없다 — 지금 방(`roomCode`)의 줄로 본다. `chatSaid` 를 못 받으면 같은 `requestId` 로 한 번만 다시 보낸다(서버가 처음 줄을 돌려준다). 이모티콘 그림은 Storage `users/{내 코드}/emojis/{칸}.png|gif` 에 올린 주소만 서버가 받는다(`firebaseAPI.uploadEmojiImage`).
- 검사: `checks/sim-chat-rt.js`.
