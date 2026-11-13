# app/parts/focus — 포커스(집중 기록 · 레벨 · 태블릿·폰)

이 폴더 모듈의 책임 · deps · 함정. 아직 절이 없는 모듈은 파일 머리 주석이 정본이다.

## mobile-diag.js — 📱 태블릿·폰 연결 진단 줄

- **책임**: PC 가 받은 폰 신호(`mobileLink/{uid}/state`)를 기록하고, 설정 › 포커싱 칸에 쓸 한 줄을 만든다(순수 함수 · DOM · firebase 없음). «연동이 자꾸 풀린다» 제보를 캡처 한 장으로 가르려고 둔다.
- **만드는 법**: 만들지 않는다 — 얼린 표 `window.TwMobileDiag`. app.js 가 `mobileDiag: TwMobileDiag` 로 focus-level.js 에 넘긴다.
- **내보내는 것**: `empty()` · `next(기록, 사건)` → 새 기록 · `line(기록, 시각 글자?)` → `🔍 마지막 신호 14:02:10 열림(Procreate) · 그 전 … · 이번 실행 3번`.
  - 사건: `{ kind:'state', v, first }`(구독으로 받은 값 · first = 처음 온 값이라 수에 안 넣음) · `{ kind:'reset', v }`(PC 를 켤 때 «켜짐» 을 내린 원래 값) · `{ kind:'live', has }`(PC 켜짐 표시).
- **함정**
  - 신호 하나 = ts(서버 시각). 같은 ts 가 다시 오면 새 신호가 아니다 — 부팅 초기화는 on 만 내려서 같은 ts 의 «꺼짐» 이 곧 온다.
  - 읽기만 한다 — 켜짐 판정(`_mobileOn`)도, live 를 다시 거는 일도 하지 않는다. 진단으로 원인을 본 뒤 동작을 따로 고친다.
  - 다른 키로 쓴 값은 세지 않는다(focus-level.js `_mobileStart`).
  - 검사: `checks/sim-mobile-diag.js`(규칙 · 잇기를 실제로 돌림 · firebase-init 알림 자리).

## `room-focus-sync.js` · `room-focus-net.js` — 📊 시크릿룸 집중 기록 올리기

**책임** — 포커스 누적(`focus-level.js addFocusSeconds`)이 알려 주는 초를, 이 방이 시크릿룸이고 내가 «이 방 기록에 올리기» 를 켠 때만 모았다가 1분에 한 번 서버에 더한다(`room-focus-sync.js`). 서버 읽기 · 쓰기는 `room-focus-net.js`(하루 합 트랜잭션 · 이름 · 12주 합치기 한 묶음 · 내 기록 지우기 · 구독). 보여 주는 쪽은 `chat/chat-focus.js`(#집중 탭).

**데이터** — `rooms/{방}/_focus/{내 id}/{n, d/YYYYMMDD, o}` — 자세한 것은 `chat/README.md` 의 chat-focus 절.

**만드는 법** — `room-focus-net.js` 는 firebase-init.js 가 `firebaseAPI.roomFocus` 로 연결만 한다. app.js: `const roomFocusSync = TwRoomFocusSync.createRoomFocusSync({ provider: { add, setName }, roomCode, isSecretRoom, getMyUserId, getMyName, dayKey, now, storage: localStorage })` · 포커스 모듈 deps `onFocusAdded: (sec)=>roomFocusSync.add(sec)`.

**내놓는 것** — `isOn(room)` · `setOn(room, on)` · `add(sec)` · `dayKeyOf(str)`.

**함정** — ① 켜는 것은 사람마다 · 방마다(`tw.roomFocus.{방}` — 로그아웃해도 이 기기 설정으로 남는다). ② 끄면 모으던 몫은 버린다(다시 켜면 그때부터). ③ 실패한 몫은 다음 때 얹지만 600초를 넘기면 버린다. ④ 방이 바뀌거나 6시를 넘기면 앞 몫은 그 방 · 그 날 칸에 마무리한다. ⑤ 서버가 «하루 합은 줄지 않고 86400 이하» 를 지킨다.
