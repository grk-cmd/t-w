/* chat-prefs.js — 🗑 대화 기록 삭제(방장) · 💬 채팅창 투명도 · 글자 크기 · 🔔 채팅 알림음(상태 · 저장 · 메뉴)
   app.js «🗑 대화 기록 삭제 (방장)» · «💬 채팅창 투명도 · 글자 크기» · «🔔 채팅 알림음 — 상태 · 저장 · 메뉴» 세 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 41번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 3개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 9줄 —
     Presence · _chatLogCache · chatUiMod · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 9개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _applyChatFontSize · _applyChatOpacity · _applyChatSfxUI · _chatDelClose · _chatDelOpen · _chatDelRefreshUI · _chatDelRun · _chatNotifyIncoming · _chatOffToggleClick · _chatSfxOfficeLock · _chatSfxOn · _chatSfxPreview · _clampChatOpacity · _refreshChatMembers · _setChatFontSize · _setChatOpacity · _setChatSfxId · _setChatSfxOn — app.js 는 chatPrefsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwChatPrefs — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-chat-prefs.js */
(function(){

function createChatPrefs(deps){
const CHAT_SFX_DEFAULT_ID = deps.CHAT_SFX_DEFAULT_ID;
const CHAT_SFX_DEFAULT_ON = deps.CHAT_SFX_DEFAULT_ON;
const CHAT_SFX_GAP_MS = deps.CHAT_SFX_GAP_MS;
const CHAT_SFX_ID_KEY = deps.CHAT_SFX_ID_KEY;
const CHAT_SFX_LIST = deps.CHAT_SFX_LIST;
const CHAT_SFX_ON_KEY = deps.CHAT_SFX_ON_KEY;
const Presence = deps.Presence;   // 읽는 함수
const _chatEsc = deps._chatEsc;
const _chatIsHost = deps._chatIsHost;
const _chatIsSecretRoom = deps._chatIsSecretRoom;
const _chatLogCache = deps._chatLogCache;   // 읽는 함수
const _chatOffOn = deps._chatOffOn;
const _chatOffRefreshUI = deps._chatOffRefreshUI;
const _chatRoomCode = deps._chatRoomCode;
const _chatSfxPools = deps._chatSfxPools;
const chatUiMod = deps.chatUiMod;   // 읽는 함수
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const officeMode = deps.officeMode;   // 읽는 함수
const seats = deps.seats;
const toast = deps.toast;
/* 💬 채팅창 투명도 (기기별 로컬 저장) — 글자 크기·창 위치와 같은 성격이라 서버에 안 올린다.
   ★ 대상은 요소 전체의 opacity 다. 배경만 흐리게 하는 방법(--win-face 를 rgba 로 합성)도 있었지만,
     "입력창 글자까지 같이 흐려지는 쪽"으로 정했다. 그래서 여기서는 style.opacity 하나만 쓴다 —
     테마 토큰을 건드리지 않으므로 audit 검사 13(하드코딩 색)과도 무관하다.
   ★ 😊 이모티콘 창도 같이 흐려진다. 채팅창 옆에 붙어 뜨는 한 몸이라, 한쪽만 불투명하면
     반투명이 아니라 고장으로 읽힌다.
   ⚠️ 하한은 0 이 아니라 10 이다. 0 이면 창이 통째로 사라져 슬라이더 자체를 못 찾고,
     값이 로컬에 남아 있어서 다시 열어도 여전히 안 보인다 — 되살릴 방법이 없어진다.
     10 은 형체와 슬라이더 위치가 겨우 보이는 선이다. 더 낮추려면 '창을 다시 진하게 하는 길'을
     먼저 만들고 낮출 것. */
const CHAT_OPACITY_KEY = 'tw.chatOpacity';
const CHAT_OPACITY_DEFAULT = 100, CHAT_OPACITY_MIN = 10, CHAT_OPACITY_MAX = 100;
function _clampChatOpacity(v){
  v = Math.round(Number(v));
  if(!isFinite(v)) return CHAT_OPACITY_DEFAULT;
  return Math.max(CHAT_OPACITY_MIN, Math.min(CHAT_OPACITY_MAX, v));
}
function _loadChatOpacity(){
  let v = null;
  try{ v = parseInt(localStorage.getItem(CHAT_OPACITY_KEY), 10); }catch(_){}
  return (v == null || isNaN(v)) ? CHAT_OPACITY_DEFAULT : _clampChatOpacity(v);
}
function _applyChatOpacity(){
  const pct = _loadChatOpacity();
  ['chatWindow', 'chatEmojiWin'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.opacity = (pct >= 100) ? '' : String(pct / 100);
  });
  const sl = document.getElementById('chatOpacity');
  if(sl){
    if(String(sl.value) !== String(pct)) sl.value = String(pct);
    sl.title = '투명도 ' + pct + '%';
  }
  return pct;
}
function _setChatOpacity(v){
  const pct = _clampChatOpacity(v);
  try{ localStorage.setItem(CHAT_OPACITY_KEY, String(pct)); }catch(_){}
  _applyChatOpacity();
}

/* 💬 채팅창 글자 크기 (기기별 로컬 저장) — 창 위치·크기와 같은 성격이라 서버에 올리지 않는다.
   #chatWindow 의 --chat-font 하나만 바꾸면 .chat-messages 와 그 하위(em)가 함께 커진다. */
const CHAT_FONT_KEY = 'tw.chatFontSize';
const CHAT_FONT_DEFAULT = 12;                  // .chat-messages 의 원래 값 — 바꾸면 기존 유저 화면이 바뀐다
const CHAT_FONT_ALLOWED = [11, 12, 14, 16];    // 드롭다운 data-fs 와 같은 목록이어야 한다
function _loadChatFontSize(){
  let v = null;
  try{ v = parseInt(localStorage.getItem(CHAT_FONT_KEY), 10); }catch(_){}
  return CHAT_FONT_ALLOWED.includes(v) ? v : CHAT_FONT_DEFAULT;
}
function _applyChatFontSize(){
  const px = _loadChatFontSize();
  const win = document.getElementById('chatWindow');
  if(win) win.style.setProperty('--chat-font', px + 'px');
  // 현재 선택에 ✓ (폭 고정된 .chk 자리에만 넣어 글자가 밀리지 않게)
  document.querySelectorAll('.chat-fs-item').forEach(it=>{
    const c = it.querySelector('.chk');
    if(c) c.textContent = (parseInt(it.dataset.fs, 10) === px) ? '✓' : '';
  });
  return px;
}
function _setChatFontSize(px){
  if(!CHAT_FONT_ALLOWED.includes(px)) return;
  try{ localStorage.setItem(CHAT_FONT_KEY, String(px)); }catch(_){}
  _applyChatFontSize();
  // 글자가 커지면 스크롤 위치가 어긋나므로 맨 아래로 — 방금 읽던 자리가 화면 밖으로 나가는 게 더 어색하다
  const box = document.getElementById('chatMessages');
  if(box) box.scrollTop = box.scrollHeight;
}

/* 🔔 채팅 알림음 — 상태·저장·메뉴 표시. 소리 풀과 상수는 효과음 공장 옆(CHAT_SFX_LIST)에 있다. */
function _chatSfxOn(){
  let v = null;
  try{ v = localStorage.getItem(CHAT_SFX_ON_KEY); }catch(_){}
  return v == null ? CHAT_SFX_DEFAULT_ON : v === '1';
}
function _chatSfxId(){
  let v = null;
  try{ v = parseInt(localStorage.getItem(CHAT_SFX_ID_KEY), 10); }catch(_){}
  return CHAT_SFX_LIST.some(x => x.id === v) ? v : CHAT_SFX_DEFAULT_ID;
}
/* 🏢 회사원 모드면 알림음은 **꺼진 것으로 보인다.** 저장값(tw.chatSfx)은 건드리지 않는다 —
   모드를 끄면 사용자가 골라 둔 상태 그대로 돌아온다. 소리 자체는 풀(_mkSndPool.play)이 이미 막는다.
   ⚠ officeMode 는 파일 뒤쪽의 let 이라 초기화 전에 부르면 typeof 도 던진다 — try 로 감싼다. */
function _chatSfxOfficeLock(){
  try{ return !!officeMode(); }catch(_){ return false; }
}
function _setChatSfxOn(on){
  try{ localStorage.setItem(CHAT_SFX_ON_KEY, on ? '1' : '0'); }catch(_){}
  _applyChatSfxUI();
}
function _setChatSfxId(id){
  if(!CHAT_SFX_LIST.some(x => x.id === id)) return;
  try{ localStorage.setItem(CHAT_SFX_ID_KEY, String(id)); }catch(_){}
  _applyChatSfxUI();
}
/* 메뉴 표시 — 켜짐이면 ✓ 와 소리 목록(● 고른 것), 꺼짐이면 목록을 통째로 숨긴다(시안 B). */
function _applyChatSfxUI(){
  const lock = _chatSfxOfficeLock();
  const on = _chatSfxOn() && !lock, cur = _chatSfxId();
  const tg = document.getElementById('chatSfxToggle');
  const c = tg && tg.querySelector('.chk'); if(c) c.textContent = on ? '✓' : '';
  if(tg){
    tg.classList.toggle('locked', lock);
    tg.title = lock ? '회사원 모드에서는 알림음이 꺼져 있어요' : '';
    const nt = tg.querySelector('.chat-sfx-note'); if(nt) nt.textContent = lock ? '회사원 모드' : '';
  }
  const list = document.getElementById('chatSfxList');
  if(list) list.style.display = on ? '' : 'none';
  document.querySelectorAll('.chat-sfx-item').forEach(it=>{
    const k = it.querySelector('.chk');
    if(k) k.textContent = (parseInt(it.dataset.sfx, 10) === cur) ? '●' : '○';
  });
}
function _chatSfxPreview(id){
  const P = _chatSfxPools[id];
  if(P) P.play();
}
/* 대화창이 **열려 있는가** — 열려 있으면 알림음을 내지 않는다(2026-09-17 결정 변경).
   ★ 처음엔 «입력칸에 포커스가 있을 때만» 조용했는데, 창을 띄워 두고 다른 일을 하는 동안에도
     새 줄은 이미 화면에 보이므로 소리까지 날 이유가 없다고 정리했다. 소리는 창을 닫아 뒀을 때만 난다.
   ⚠ 최소화(#chatWindow.min)도 «열려 있음» 이다 — 입력줄이 떠 있고, 거기서 치는 중일 수 있다.
   ⚠ 판정은 #chatOverlay 의 display 하나다. openChatWindow 가 'block', 닫기가 'none' 으로 둔다. */
function _chatWinOpen(){
  try{
    const ov = document.getElementById('chatOverlay');
    return !!(ov && ov.style.display && ov.style.display !== 'none');
  }catch(_){ return false; }
}
let _chatSfxLast = 0;
function _chatNotifyIncoming(){
  if(!_chatSfxOn() || _chatSfxOfficeLock()) return;
  if(_chatWinOpen()) return;
  const now = Date.now();
  if(now - _chatSfxLast < CHAT_SFX_GAP_MS) return;
  _chatSfxLast = now;
  _chatSfxPreview(_chatSfxId());   // 회사원 모드 게이트는 풀(_mkSndPool.play) 안에 있다
}

function _chatDelRefreshUI(){
  const el = document.getElementById('chatDelLog');
  if(!el) return;
  const can = (window._activeChannel === 2) && _chatIsHost();
  el.classList.toggle('on', can);
  if(!can) _chatDelClose();     // 방장에서 내려온 순간 열려 있던 확인창도 같이 닫는다
}
function _chatDelClose(){
  const ov = document.getElementById('chatDelOv');
  if(ov) ov.classList.remove('on');
}
function _chatDelOpen(){
  if(!( (window._activeChannel === 2) && _chatIsHost() )){ toast('방장만 지울 수 있어요'); return; }
  const ov = document.getElementById('chatDelOv'); if(!ov) return;
  /* 몇 줄이 지워지는지 보여준다 — 화면에 보이는 줄(_chatVisibleRows)이 아니라 **서버에 있는 줄**이다.
     내가 [지우기]로 접어 둔 것도, 입장 전 대화도 같이 사라지므로 그쪽이 정직한 숫자다. */
  const n = (_chatLogCache() || []).length;
  const what = document.getElementById('chatDelWhat');
  if(what) what.textContent = '#' + chatUiMod()._chatTabName(chatUiMod()._chatMyTabId()) + ' 채널의';
  const cnt = document.getElementById('chatDelCount');
  if(cnt) cnt.textContent = n ? ('지울 대화 ' + n + '줄') : '지울 대화가 없어요';
  const ok = document.getElementById('chatDelOk');
  if(ok){ ok.disabled = !n; ok.textContent = '삭제'; }
  ov.classList.add('on');
}
async function _chatDelRun(){
  const room = _chatRoomCode();
  if(!room){ _chatDelClose(); return; }
  if(!(window.firebaseAPI && firebaseAPI.clearChatLog)){
    _chatDelClose(); toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return;
  }
  const ok = document.getElementById('chatDelOk');
  /* 서버 왕복을 기다리는 동안 버튼을 잠근다 — 두 번 눌러도 두 번 지울 뿐이라 해는 없지만,
     아무 반응이 없으면 사람이 계속 누르고 그게 '눌러도 안 된다'는 인상이 된다.
     ⚠️ 낙관적 반영은 하지 않는다([채팅 켜짐]과 다른 점). 지우기는 되돌릴 수 없어서,
       실패했는데 화면만 빈 상태가 제일 위험하다 — 서버가 지웠다고 답한 뒤에 비운다. */
  if(ok){ ok.disabled = true; ok.textContent = '지우는 중…'; }
  const _ch = firebaseAPI.chatHistory;   // 💬 지우기 표시 줄까지 남겨 각자 PC 저장도 비운다(chat-history.js clear)
  const r = await (_ch ? _ch.clear(room, chatUiMod()._chatMyTabId()) : firebaseAPI.clearChatLog(room, chatUiMod()._chatMyTabId()));   // 지금 보는 탭만
  if(!(r && r.ok)){
    if(ok){ ok.disabled = false; ok.textContent = '삭제'; }
    toast('지우지 못했어요 — 네트워크나 권한을 확인해 주세요');
    return;
  }
  _chatDelClose();
  /* 화면은 subscribeChatLog 가 빈 목록을 물고 오면서 저절로 빈다. 다만 그게 오기 전까지
     방금 지운 대화가 남아 있으면 "안 지워졌나?" 로 읽히므로, 내 화면만 먼저 비워 둔다. */
  try{ chatUiMod()._renderChatLog([]); }catch(_){}
  toast('🗑 대화 기록을 지웠어요');
}
/* 🎛️ 방 메타가 바뀔 때마다 firebase-init 의 _meta 리스너가 부른다.
   방장 승계·채널 변경도 같은 값으로 오므로 멤버줄(👑)도 여기서 같이 갱신한다. */
window._onRoomMeta = function(meta){
  /* 채널도 표지를 따라간다 — 예전에는 입장할 때 한 번만 정해서, 도중에 표지가 바뀌거나 되살아나면 같은 방 안에서
     누구는 채팅 · 누구는 이모티콘으로 갈렸다. 표지가 잠깐 비는 순간(null · channel 없음)은 그대로 둔다. */
  if(meta && (meta.channel === 'togetherroom' || meta.channel === 'workingroom')) window._activeChannel = (meta.channel === 'togetherroom') ? 2 : 1;
  try{ chatUiMod()._chatTabsOnMeta(); }catch(_){}
  try{ _chatOffRefreshUI(); }catch(_){}
  try{ if(typeof _refreshChatMembers==='function') _refreshChatMembers(); }catch(_){}
  try{ if(typeof chatUiMod()._renderChatLog==='function') chatUiMod()._renderChatLog(_chatLogCache()); }catch(_){}   // 안내줄 갱신
};
async function _chatOffToggleClick(){
  if(!_chatIsSecretRoom()) return;
  if(!_chatIsHost()){ toast('방장만 켜고 끌 수 있어요'); return; }
  const room = _chatRoomCode(); if(!room) return;
  const _sp = (Presence().serverProvider && Presence().serverProvider()) || null;   // 🛰 서버 방이면 meta 를 서버로
  if(!_sp && !(window.firebaseAPI && firebaseAPI.setRoomChatOff)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
  const next = !_chatOffOn();
  /* 서버 왕복을 기다리지 않고 먼저 반영한다 — 아무 반응이 없으면 두 번 누르고, 그러면 원위치가 된다.
     실패하면 되돌리고 이유를 말한다. */
  const prev = window._roomMetaCache;
  try{ window._roomMetaCache = Object.assign({}, prev || {}, { chatOff: next }); }catch(_){}
  _chatOffRefreshUI();
  const r = _sp ? await _sp.setMeta({ chatOff: next }) : await firebaseAPI.setRoomChatOff(room, next);
  if(!(r && r.ok)){
    try{ window._roomMetaCache = prev; }catch(_){}
    _chatOffRefreshUI();
    toast('바꾸지 못했어요 — 네트워크를 확인해 주세요');
    return;
  }
  toast(next ? '🔇 방 전체 채팅을 껐어요' : '💬 채팅을 다시 켰어요');
}
// 멤버 목록 + 방장(👑, 볼드) 표시
function _refreshChatMembers(){
  const label=document.getElementById('chatMemberLabel');
  const listEl=document.getElementById('chatMemberList');
  if(!label || !listEl) return;
  // 현재 방 좌석에서 사람 이름을 모음 — 나 + 친구들
  const names=[];   // {name, isHost}
  let hostUserId=null;
  try{ if(window._roomMetaCache) hostUserId=window._roomMetaCache.host; }catch(_){}
  try{
    for(const st of seats){
      if(!st || (!st.isMe && !st.friendName && !st.remote)) continue;
      // 💬 「이 채널」 — 내 탭에 있는 사람만(구버전 · 탭 칸이 없는 사람은 #일반)
      if(!st.isMe && chatUiMod()._chatTabResolve(st.chatTabId || 'general') !== chatUiMod()._chatMyTabId()) continue;
      if(st.isMe){
        names.push({ name:getDisplayName(), isHost:(hostUserId && getMyUserId()===hostUserId) });
      }else if(st.friendName){
        names.push({ name:st.friendName, isHost:(hostUserId && st.friendUserId===hostUserId) });
      }
    }
  }catch(_){}
  // 방장을 맨 앞으로
  names.sort((a,b)=> (b.isHost?1:0)-(a.isHost?1:0));
  label.textContent = `이 채널(${names.length})`;
  listEl.innerHTML = names.map(m =>
    m.isHost ? `<span class="host">👑 ${_chatEsc(m.name)}</span>` : _chatEsc(m.name)
  ).join(', ') || '—';
}

return {
  _applyChatFontSize,
  _applyChatOpacity,
  _applyChatSfxUI,
  _chatDelClose,
  _chatDelOpen,
  _chatDelRefreshUI,
  _chatDelRun,
  _chatNotifyIncoming,
  _chatOffToggleClick,
  _chatSfxOfficeLock,
  _chatSfxOn,
  _chatSfxPreview,
  _clampChatOpacity,
  _refreshChatMembers,
  _setChatFontSize,
  _setChatOpacity,
  _setChatSfxId,
  _setChatSfxOn,
};
}

const api = { createChatPrefs };
if(typeof window !== 'undefined') window.TwChatPrefs = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
