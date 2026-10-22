/* room-state.js — 🧭 방 공용 상태: 지금 채널 · 들어간 방의 meta 사본 (검사 sim-room-state.js)
   여러 모듈(채팅 · 깜짝쇼 · 주사위 · 룰렛 · 상태칩 · 숨기기 · 단축키 …)이 읽는 값이라 처음 값은 맨 아래 이 파일에 둔다.
   바꾸는 쪽(방 입장 · 나가기 room-entry.js, 채팅 잠금 chat-prefs.js, 채팅 탭 chat-ui.js)에 두면 읽는 모듈이 모두 room-entry 를
   바라보게 되고, room-entry 도 그 모듈들을 부르므로 순환이 된다(checks/sim-dep-cycles.js).
   ・window._activeChannel — 1 워킹룸 · 2 투게더룸(시크릿룸 포함). 방 밖에서는 1 — 나가기(doLeaveRoom)가 되돌리는 값과 같다.
   ・window._roomMetaCache — 들어간 방의 meta(host · channel · chatOff · tabs …). 방 밖에서는 null.
   ・window.TwRoomState — 방장 · 시크릿룸 판정(순수). 채팅 잠금(chat-lock.js) · 방 안 [방 설정](room-info-ui.js)이 같이 쓴다 —
     한쪽이 다른 쪽을 부르면 순환이라 맨 아래 이 파일에 둔다.
   app.js · 읽는 모듈보다 먼저 싣는 classic script. */
window._activeChannel = 1;
window._roomMetaCache = null;
window.TwRoomState = Object.freeze({
  /** 이 meta 의 방장이 나인가 — 내 코드를 모르면 아니다 */
  isHost(meta, me){ const h = meta && meta.host; return !!h && h === me; },
  /** 시크릿룸 코드인가(SCRT-) */
  isSecretCode(code){ return !!code && String(code).indexOf('SCRT-') === 0; },
});
