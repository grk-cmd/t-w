/* chat-lock.js — 🔇 시크릿룸 채팅 잠금(방장 끄기 · 표시)
   app.js «🔇 시크릿룸 채팅 잠금(방장 끄기 · 표시)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     Presence 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 1개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _chatIsHost · _chatIsSecretRoom · _chatOffOn · _chatOffRefreshUI · _chatRoomCode — app.js 는 chatLockMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwChatLock — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-chat-lock.js */
(function(){

function createChatLock(deps){
const Presence = deps.Presence;   // 읽는 함수
const chatPrefsMod = deps.chatPrefsMod;
const chatUiMod = deps.chatUiMod;
const getMyUserId = deps.getMyUserId;
const roomState = deps.roomState;   // 방장 · 시크릿룸 판정(room/room-state.js — 방 안 [방 설정] 과 같은 한 곳)
function _chatRoomCode(){
  try{ return (typeof Presence()!=='undefined' && Presence().roomCode) ? Presence().roomCode() : null; }catch(_){ return null; }
}
function _chatIsSecretRoom(){ return roomState.isSecretCode(_chatRoomCode()); }
function _chatIsHost(){
  try{ return roomState.isHost(window._roomMetaCache, getMyUserId()); }catch(_){ return false; }
}
function _chatOffOn(){
  try{ return _chatIsSecretRoom() && !!(window._roomMetaCache && window._roomMetaCache.chatOff); }catch(_){ return false; }
}
function _chatOffRefreshUI(){
  const el = document.getElementById('chatOffToggle');
  const secret = _chatIsSecretRoom(), off = _chatOffOn(), host = _chatIsHost();
  if(el){
    el.classList.toggle('on', secret);            // 시크릿룸이 아니면 아예 안 보인다
    el.classList.toggle('off', secret && off);
    el.classList.toggle('readonly', secret && !host);   // 참여자에게는 상태 표시일 뿐
    el.textContent = off ? '채팅 꺼짐' : '채팅 켜짐';
    el.title = host ? (off ? '누르면 방 전체 채팅을 다시 켭니다' : '누르면 방 전체 채팅을 잠급니다')
                    : (off ? '방장이 채팅을 껐어요' : '방장만 켜고 끌 수 있어요');
  }
  const inp = document.getElementById('chatInput');
  if(inp) inp.placeholder = off ? '😊 🎲 💣 · /80 · /150 만 쓸 수 있어요' : ('#' + chatUiMod._chatTabName(chatUiMod._chatMyTabId()) + '에 메시지 입력 후 Enter');
  /* 🗑 기록 삭제 버튼도 같은 재료(방 종류·방장)로 정해진다 — 여기서 같이 갱신한다.
     ⚠️ 호출 자리를 따로 두지 않는 이유: 이 함수는 창을 열 때(openChatWindow)와 방 메타가 바뀔 때
       (_onRoomMeta) 양쪽에서 이미 불린다. 별도 함수를 만들어 두 자리에 각각 걸면, 다음에 호출
       지점이 하나 더 생겼을 때 한쪽만 빠져서 "방장인데 버튼이 안 보인다"가 난다. */
  try{ chatPrefsMod._chatDelRefreshUI(); }catch(_){}
  // 🌊 날리기 줄도 같은 재료(채널·레벨)로 정해진다 — 호출 자리를 따로 두지 않는 이유는 위와 같다.
  try{ chatUiMod._chatFlyRefreshUI(); }catch(_){}
}

return {
  _chatIsHost,
  _chatIsSecretRoom,
  _chatOffOn,
  _chatOffRefreshUI,
  _chatRoomCode,
};
}

const api = { createChatLock };
if(typeof window !== 'undefined') window.TwChatLock = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
