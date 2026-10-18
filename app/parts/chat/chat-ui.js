/* chat-ui.js — 💬 채팅 — 🌊 날리기 · 🔖 여기까지 읽음 · 💬 채팅 탭 · 📋 드래그 복사 · 😊 커스텀 이모티콘
   app.js 의 채팅 다섯 구역(🌊 날리기 · 🔖 여기까지 읽음 구분선 · 💬 채팅 탭 · 📋 드래그 복사 · 😊 커스텀 이모티콘) 본문을 그대로 옮긴 모듈이다(앱 FSD 24번 — docs/APP_FSD_MAP.md).
   대화창 배선은 chat-window.js. 동작은 옮기기 전과 같다. 기본 이모티콘 목록은 demoji-catalog.js.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 5개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 37줄 —
     CHAT_WIN_POS_KEY · Presence · _chatLogCache · _chatLogUnsub · _danceCmdCooldownAt · _myHomeData · focusLevelMod · isAdmin · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setChatLogCache · setChatLogUnsub · setDanceCmdCooldownAt(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 22개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DEMOJI_BY_CMD · DEMOJI_BY_ID · DEMOJI_DIR · DEMOJI_LIST · EMOJI_SLOTS · FLY_COLOR_LEVEL · _bindChatCopy · _bindChatTabs · _chatClearNow · _chatClearUndo · _chatFlyColor · _chatFlyOn · _chatFlyRefreshUI · _chatFlySize · _chatIsMinimized · _chatMyTabId · _chatTabName · _chatTabOut · _chatTabResolve · _chatTabsOnMeta · _chatTabsRender · _chatWindowIsOpen · _deleteEmoji · _emojiCache · _flyLaneFreeAt · _flySizeOk · _onEmojiFilePicked · _onEmojiSlotClick · _renderChatLog · _saveChatLog · _saveChatWinPos · _sendChatWindowMsg · _setChatMinimized · _syncChatBadgeSub · _toggleEmojiPanel · closeChatWindow · openChatWindow · sendMyChat · showFlyText — app.js 는 chatUiMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwChatUi — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-chat-ui.js */
(function(){

function createChatUi(deps){
const twNav = deps.twNav;   // 🧭 창 열기 통로(nav.js)
const demojiCatalog = deps.demojiCatalog;   // 😊 기본 이모티콘 목록(demoji-catalog.js)
const CHAT_WIN_POS_KEY = deps.CHAT_WIN_POS_KEY;   // 읽는 함수
const Presence = deps.Presence;   // 읽는 함수
const _chatDelClose = deps._chatDelClose;
const _chatEsc = deps._chatEsc;
const _chatIsHost = deps._chatIsHost;
const _chatLinkify = deps._chatLinkify;
const _chatLogCache = deps._chatLogCache;   // 읽는 함수
const _chatLogUnsub = deps._chatLogUnsub;   // 읽는 함수
const _chatOffOn = deps._chatOffOn;
const _chatOffRefreshUI = deps._chatOffRefreshUI;
const _chatRoomCode = deps._chatRoomCode;
const _danceCmdCooldownAt = deps._danceCmdCooldownAt;   // 읽는 함수
const _diceSvg = deps._diceSvg;
const _myHomeData = deps._myHomeData;   // 읽는 함수
const _officeDemojiHtml = deps._officeDemojiHtml;
const _parseDanceCmdChain = deps._parseDanceCmdChain;
const _refreshChatMembers = deps._refreshChatMembers;
const _seatLabelName = deps._seatLabelName;
const asyncPrompt = deps.asyncPrompt;
const bringWinToFront = deps.bringWinToFront;
const escHtml = deps.escHtml;
const findMySeat = deps.findMySeat;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const isAdmin = deps.isAdmin;   // 읽는 함수
const isDanceUnlocked = deps.isDanceUnlocked;
const officeMode = deps.officeMode;   // 읽는 함수
const seats = deps.seats;
const showChatBubble = deps.showChatBubble;
const startMyDance = deps.startMyDance;
const toast = deps.toast;
const setChatLogCache = deps.setChatLogCache;   // 쓰는 함수
const setChatLogUnsub = deps.setChatLogUnsub;   // 쓰는 함수
const setDanceCmdCooldownAt = deps.setDanceCmdCooldownAt;   // 쓰는 함수
const FLY_BAND_PX    = 600;     // 흐르는 띠의 높이 — 화면 한가운데 기준 위아래 300px
/* 레인 한 칸 높이 — 글자 크기를 따라간다.
   27px 글자 × 1.2 줄높이 ≈ 33px, 여기에 테두리가 위아래로 4px 씩 삐져나오고(41px)
   이모티콘(30px)은 이제 글자보다 작다. 64px 이면 옆 칸을 건드리지 않는다.
   ⚠️ 글자 크기를 또 바꾸면 **이 값도 같이 바꿀 것.** 한쪽만 키우면 줄이 서로 겹친다
     (sim-chat-fly §5 가 «레인 ⨉ 칸수가 띠 안에 들어가는가» 로 그 어긋남을 잡는다). */
const FLY_LANE_PX    = 64;
const FLY_LANES      = 9;       // 600 ÷ 64 = 9.4 → 9칸(576px). 남는 24px 은 위아래 여백이 된다
const FLY_JITTER_PX  = 8;       // 레인 안에서 위아래로 흔드는 폭 — 줄이 자로 잰 듯 놓이지 않게
const FLY_MAX_LIVE   = 30;      // 동시 상한. 넘으면 가장 오래된 것부터 지운다
/* 🐢 흐르는 속도 — **초당 몇 px 인가.** 「몇 초에 건너간다」가 아니다.
   [왜 바꿨나] 2026-09-16. 5.5 → 6.5 → 7 → 8.5 초로 네 번 올려도 여전히 빨라 보였다.
     원인은 시간을 고정한 것이었다: 애니메이션이 「화면 폭 전체를 그 시간 안에 건너가라」는
     뜻이라, **화면이 넓을수록 같은 초에 더 빨리 지나간다.**
       목업(1280px · 6.6초) ≈ 224 px/s   ←  적당하다고 정해진 기준
       실기(1920px · 8.5초) ≈ 270 px/s   ←  초를 올렸는데 더 빨랐다
       실기(3840px · 8.5초) ≈ 500 px/s   ←  4K 면 목업의 두 배
     ⚠️ 그래서 같은 방의 두 사람이 **모니터가 다르면 같은 메시지를 다른 속도로 봤다.**
       한 명은 느긋하게 읽고 한 명은 놓치는데, 서로 왜 그런지 알 길이 없다.
   ⇒ 속도를 고정하고 시간을 화면 폭에서 역산한다. 어느 화면에서나 눈에 보이는 속도가 같다.
   ★ 조절할 값이 **이 하나**다. 「조금 느리게」가 필요하면 220 을 200 으로 내리면 되고,
     그 변화가 모든 모니터에 똑같이 적용된다. 초를 올렸다 내렸다 할 일이 없어진다.
   ★ 덤 — 모든 줄이 같은 속도라 **뒷줄이 앞줄을 따라잡지 못한다.** 예전엔 긴 글에 시간을
     더 줘서(FLY_LEN_MS) 줄마다 속도가 달랐고, 같은 레인에서 앞줄을 밀고 들어올 수 있었다. */
/* ★ 확정값. 220 → 240 → 300 → 320 으로 화면 보고 맞춘 끝에 정했다(2026-09-16).
   단위가 px/s 라 **모니터가 달라도 눈에 보이는 속도가 같다** — 그것이 이 단위로 바꾼 이유다.
   ⚠️ px 은 CSS 픽셀이다. OS 배율(125%·200%)이 걸려 있으면 innerWidth 도 글자 크기(27px)도
     같은 배율로 읽히므로 **둘이 함께 움직인다** — 배율이 달라도 체감은 어긋나지 않는다. */
const FLY_SPEED_PX_S = 320;
const FLY_DUR_MIN_MS = 3000;    // 창이 아주 좁을 때 — 너무 휙 지나가지 않게
const FLY_DUR_MAX_MS = 30000;   // 아주 넓은 화면 + 아주 긴 글 — 하염없이 떠 있지 않게
const FLY_LANE_GAP   = 900;     // 같은 레인에 다음 글자가 들어가기까지의 최소 간격(ms)
const FLY_SEND_GAP   = 500;     // 내 연타 억제(ms) — 한 노드가 덮이는 것을 줄인다
const FLY_COLOR_LEVEL = 200;    // 🎨 글자 색(글로우·무지개) 해금 레벨
/* 고를 수 있는 색 — HTML 의 .fsw[data-flycolor] 와 **같은 목록**이어야 한다.
   ⚠️ 받는 쪽이 이 표에 없는 값을 그냥 style 에 꽂으면 안 된다(남이 보낸 문자열이다).
     그래서 표에 있는 것만 통과시킨다 — 임의 URL 을 안 로드하는 이모티콘 규칙과 같은 태도. */
const FLY_COLORS = ['#FF4D9B', '#4DC8FF', '#7CFF5B', '#FFD24D', 'rainbow'];
/* 🔠 글자 크기 — HTML 의 .fsz[data-flysize] · .fly.sz-* 와 **같은 목록**이어야 한다.
   ★ 'l'(대)이 기본이다. 기본값은 payload 에 안 싣는다(색과 같은 이유 — 안 쓰는 사람의
     모든 메시지가 그만큼 커진다). 그래서 받는 쪽은 «없으면 대» 로 읽는다.
   ★ 색과 달리 **레벨 제한이 없다.** 크기는 읽기 편하자고 있는 것이지 치장이 아니다. */
const FLY_SIZES = ['l', 'm', 's'];
let _chatFlyOn    = false;      // 체크 상태 — **세션 변수다.** 저장하지 않는다(끄면 초기화):
                                //   저장하면 다음에 켰을 때 "왜 자꾸 날아가지"가 된다.
let _chatFlyColor = '';         // '' = 흰 글씨(기본). Lv.200 미만은 항상 ''.
let _chatFlySize  = 'l';        // 'l'(대) 기본 — 세션 변수다. 색과 같이 저장하지 않는다.
let _flyLaneFreeAt = [];        // 레인별로 "언제부터 비는가"(ms)
let _flySentAt = 0;             // 마지막으로 내가 날린 시각

/* 내가 지금 날릴 수 있는가 — 연타 억제. 막힌 줄은 **그냥 말풍선으로 나간다**(안 보내지 않는다).
   보내기 자체를 막으면 친 글이 사라져서, 잠금·도배 제한이 글을 돌려주는 관례와 어긋난다. */
function _chatFlySendGate(){
  const now = Date.now();
  if(now - _flySentAt < FLY_SEND_GAP) return false;
  _flySentAt = now;
  return true;
}
/* 🎨 이 색을 인정할 수 있는가. 표에 있고, 레벨이 되면 통과. */
function _flyColorOk(color, level){
  if(!color) return '';
  if((level|0) < FLY_COLOR_LEVEL) return '';
  return FLY_COLORS.indexOf(String(color)) >= 0 ? String(color) : '';
}
/* 🔠 이 크기를 인정할 수 있는가. 표에 있는 것만 통과 — 남이 보낸 문자열을 그대로 class 에
   붙이면 안 된다(색 쪽 _flyColorOk 와 같은 태도다). 모르는 값은 조용히 기본(대)으로 떨어진다. */
function _flySizeOk(size){
  const v = String(size || 'l');
  return FLY_SIZES.indexOf(v) >= 0 ? v : 'l';
}
/* 레인 배정 — **비어 있는 레인 중에서 무작위로** 고른다.
   ★ 순서대로 돌리면(1→2→3…) 글자가 위에서 아래로 계단처럼 내려가는 게 눈에 보인다.
     무작위면 띠 안에 흩어져 보이는데, 겹침은 여전히 막힌다 — «빈 칸 중에서» 고르기 때문이다.
     «완전 무작위 y» 로 하면 두 줄이 1px 차이로 겹쳐 둘 다 못 읽는 순간이 반드시 나온다.
   ★ 전부 차 있으면 제일 빨리 비는 곳으로 보낸다(버리지 않는다 —
     안 보이는 것보다 살짝 붙어 흐르는 편이 낫다). */
function _flyPickLane(now){
  if(_flyLaneFreeAt.length !== FLY_LANES) _flyLaneFreeAt = new Array(FLY_LANES).fill(0);
  const free = [];
  let best = 0;
  for(let i = 0; i < FLY_LANES; i++){
    if(_flyLaneFreeAt[i] <= now) free.push(i);
    if(_flyLaneFreeAt[i] < _flyLaneFreeAt[best]) best = i;
  }
  const lane = free.length ? free[Math.floor(Math.random() * free.length)] : best;
  /* 다음 글자를 언제 받을지 — 앞 글자의 꼬리가 오른쪽 끝을 벗어날 무렵이다.
     정확한 폭을 재려면 레이아웃을 읽어야 하는데(강제 리플로) 그럴 값이 아니다. 고정 간격이면 충분하다. */
  _flyLaneFreeAt[lane] = Math.max(now, _flyLaneFreeAt[lane]) + FLY_LANE_GAP;
  return lane;
}
/* 🌊 한 줄을 띄운다.
   @param seat  보낸 사람의 좌석(이름을 여기서 꺼낸다)
   @param text  보낸 원문(이모티콘 마커가 들어 있을 수 있다)
   @param color 인정된 색('' 이면 흰 글씨). **받는 쪽이 이미 레벨을 확인한 값**이다.
   @param size  'l'(대·기본)·'m'(중)·'s'(소). 모르는 값은 대로 떨어진다. */
function showFlyText(seat, text, color, size){
  const layer = document.getElementById('flyLayer');
  if(!layer || !text) return;
  /* 이름: 내용 — 형식은 하나로 통일한다. 좌석 색은 쓰지 않는다(이름으로 구분한다).
     이름은 이름표(setSeatNamePlate)와 같은 출처를 쓴다 — 여기서 다른 이름을 고르면
     발밑 이름표와 흐르는 글자가 서로 다른 사람처럼 보인다. */
  const name = _seatLabelName(seat);
  const body = String(text).slice(0, 140);
  /* ⚠️ 순서가 중요하다: **이스케이프 먼저, 마커 변환 나중.** 뒤집으면 이스케이프가
     <img> 를 글자로 만들어 버린다(_officeDemojiHtml 주석과 같은 함정). */
  let html = _chatEsc(body);
  html = _officeDemojiHtml(html);
  const nameHtml = name ? (_chatEsc(name) + ': ') : '';
  const inner = nameHtml + html;

  const el = document.createElement('div');
  const sz = _flySizeOk(size);
  el.className = 'fly' + (color === 'rainbow' ? ' rainbow' : (color ? ' glow' : ''))
               + (sz === 'l' ? '' : ' sz-' + sz);   // 대는 기본값이라 클래스가 없다
  if(color && color !== 'rainbow') el.style.setProperty('--fly-glow', color);
  /* ⏱ 시간은 **화면 폭 + 글자 폭**을 속도로 나눠 구한다.
     이 「화면 폭 + 글자 폭」은 CSS 의 `translateX(calc(-100vw - 100%))` 와 **같은 거리다** —
     100vw = 화면 폭, 100% = 자기 글자 폭. 둘 중 하나만 고치면 속도가 어긋난다
     (sim-chat-fly §4 가 두 파일을 맞대어 본다).
   ⚠️ 폭을 재려면 붙인 뒤 offsetWidth 를 읽어야 하고, 그 순간 레이아웃이 한 번 강제된다.
     **메시지 한 줄당 딱 한 번**이라 괜찮다 — 매 프레임 재는 것과는 다른 이야기다.
     재는 동안 애니메이션이 이미 돌면 안 되므로, 붙일 때는 꺼 두었다가 시간을 정한 뒤 켠다.
     길이 보정(옛 FLY_LEN_MS)은 필요 없어졌다 — 긴 글은 자기 폭만큼 거리가 늘어 저절로 오래 걸린다. */
  el.style.animation = 'none';
  const now = Date.now();
  /* 레인 안에서 살짝 흔든다 — 칸에 딱 맞춰 놓으면 줄 간격이 자로 잰 듯 보인다.
     흔드는 폭이 레인 높이보다 훨씬 작아서 옆 레인을 침범하지 않는다. */
  const jitter = Math.round((Math.random() * 2 - 1) * FLY_JITTER_PX);
  el.style.top = Math.max(0, _flyPickLane(now) * FLY_LANE_PX + jitter) + 'px';
  /* 앞(본체)과 뒤(테두리) 두 겹 — 같은 HTML 을 두 번 넣는다. CSS 주석 참고. */
  el.innerHTML = '<span class="fly-out" aria-hidden="true">' + inner + '</span>'
               + '<span class="fly-ink">' + inner + '</span>';
  el.addEventListener('animationend', ()=>{ try{ el.remove(); }catch(_){} });
  layer.appendChild(el);
  // 붙인 뒤에야 폭을 알 수 있다. 여기서 한 번 재고, 시간을 정하고, 애니메이션을 켠다.
  const travelPx = (window.innerWidth || 1920) + (el.offsetWidth || 0);
  const dur = Math.min(FLY_DUR_MAX_MS,
              Math.max(FLY_DUR_MIN_MS, Math.round(travelPx / FLY_SPEED_PX_S * 1000)));
  el.style.setProperty('--fly-dur', dur + 'ms');
  el.style.animation = '';   // CSS 의 flyAcross 로 되돌린다 — 이 순간부터 흐른다
  // 동시 상한 — 넘치면 가장 오래된 것부터. (애니메이션이 끝나면 저절로 빠지므로 평소엔 안 걸린다)
  while(layer.children.length > FLY_MAX_LIVE){ try{ layer.firstChild.remove(); }catch(_){ break; } }
}
/* ☐ 날리기 줄의 표시/상태를 정한다.
   ★ 호출 자리를 따로 만들지 않는다 — `_chatOffRefreshUI` 가 이미 «창을 열 때»와 «방 메타가
     바뀔 때» 양쪽에서 불리므로 거기서 같이 부른다(_chatDelRefreshUI 와 같은 관례).
   ★ 표시 조건은 `_activeChannel === 2` 한 줄 = 투게더룸 + 시크릿룸. 워킹룸에서는 줄째 사라진다. */
function _chatFlyRefreshUI(){
  const row = document.getElementById('chatFlyRow');
  if(!row) return;
  /* 🏢 회사원 모드면 줄째 숨긴다 — 이 모드는 «지금 당장 화면을 조용하게» 라, 화면을 가로지르는 글자는 그 반대다.
     플라잉체어·때리기와 달리 버튼을 남기고 토스트로 막지 않는 이유: 체크박스는 «상태» 라 켜 둔 채 모드를 켜면
     눌러 보기 전엔 모른다. 숨기고, 켜지는 순간 체크도 푼다(아래 토글 핸들러). */
  const on = (window._activeChannel === 2) && !(typeof officeMode() !== 'undefined' && officeMode());
  row.classList.toggle('off', !on);
  if(!on) return;
  const chk = document.getElementById('chatFlyChk');
  if(chk) chk.checked = _chatFlyOn;
  /* ⚠️ 옛 안내 문구(#chatFlyHint)는 뺐다. 체크박스와 색 고르개 사이를 벌려 놓기만 하고,
     「날리기」라는 말이 이미 하는 설명을 한 번 더 했다. 되살리지 말 것. */
  // 🔠 크기 — 레벨 제한이 없으니 고를 수 있는지 여부는 안 본다. 선택 표시만 맞춘다.
  const szBox = document.getElementById('chatFlySizes');
  if(szBox) szBox.querySelectorAll('.fsz').forEach(b=>{
    b.classList.toggle('sel', (b.getAttribute('data-flysize')||'l') === _chatFlySize);
  });
  // 🎨 Lv.200 — 미달이면 색 고르개를 **자리째** 뺀다(자물쇠를 보여주지 않는다).
  const lv = (typeof focusLevelMod().getFocusLevel === 'function') ? focusLevelMod().getFocusLevel() : 1;
  const sw = document.getElementById('chatFlySwatches');
  if(sw){
    const okLv = (lv >= FLY_COLOR_LEVEL) || (typeof isAdmin() !== 'undefined' && isAdmin());
    sw.classList.toggle('on', okLv);
    if(!okLv) _chatFlyColor = '';   // 레벨이 내려갔는데 색만 남는 일이 없게
    sw.querySelectorAll('.fsw').forEach(b=>{
      b.classList.toggle('sel', (b.getAttribute('data-flycolor')||'') === _chatFlyColor);
    });
  }
}

// 내가 채팅 전송 — 멀티모드에서만 상대에게 실제로 전송되고, 내 화면에는 항상 즉시 말풍선으로 보여줌.
/* 🌊 fly 가 참이면 말풍선 대신 «내 화면에도» 날린다 — 니코동 방식. 안 그러면 보낸 사람만
   자기 글이 안 보여서, 날아갔는지 아닌지를 알 수 없다. */
function sendMyChat(text, fly, flyColor, flySize, tab){
  // 🚫 채널 개편: 채널2(채팅룸)가 아니면 전송하지 않음 — 투게더룸은 일에 집중.
  if(window._activeChannel !== 2) return;
  text = String(text).trim().slice(0,140);
  if(!text) return;
  const mySeat = findMySeat();
  if(fly){
    const lv = (typeof focusLevelMod().getFocusLevel === 'function') ? focusLevelMod().getFocusLevel() : 1;
    const col = _flyColorOk(flyColor, lv);
    const sz  = _flySizeOk(flySize);
    if(mySeat) showFlyText(mySeat, text, col, sz);
    if(typeof Presence()!=='undefined' && Presence().active() && Presence().sendChat) Presence().sendChat(text, true, col, sz, tab);
    return;
  }
  if(mySeat) showChatBubble(mySeat, text);
  if(typeof Presence()!=='undefined' && Presence().active() && Presence().sendChat) Presence().sendChat(text, false, '', '', tab);
}

const CHAT_READ_KEY_PREFIX = 'tw_chat_read:';
let _chatReadMarker  = null;    // 이번 세션의 구분선 기준 키 (창을 여는 순간 고정)
let _chatReadRoom    = null;    // 마커를 저장할 방 코드 (방을 옮겨도 안전하게 열 때 캡처)
let _chatJumpToUnread = false;  // 연 직후 첫 렌더에서 맨 아래가 아니라 구분선으로 스크롤

function _chatMsgKey(m){
  if(!m) return '';
  if(m.id) return m.id;
  return (m.ts!=null) ? ('ts'+m.ts) : '';
}
/* 🧹 대화 지우기 — **내 화면에서만** 가린다. 서버 기록은 그대로고 남의 화면도 그대로다.
   ★ 세션 한정이라 저장하지 않는다(회사원 모드 숨김과 같은 이유) — 지운 채로 앱을 껐다 켜서
     아무것도 없으면 기능이 아니라 고장으로 읽힌다. 창을 닫았다 열면 지운 상태는 유지된다.
   ★ 지운 뒤에 오는 새 메시지는 그대로 보인다. '여기까지'를 표시하는 것이지 구독을 끊는 게 아니다.
   ⚠️ 거르는 자리는 **렌더 한 곳뿐**이다. _chatLogCache 는 통째로 남겨둔다 —
     대화 기록 저장(_saveChatLog)과 안 읽음 계산이 그걸 보기 때문이다. */
let _chatClearedTo = {};   // { 방코드: 그 시점의 마지막 메시지 키 }
/* 🚪 처음 들어온 방의 '입장 이전' 대화는 안 보여준다.
   [규칙] 그 방에 **한 번도 들어온 적이 없으면** 입장 시점의 마지막 메시지 키를 표식으로 찍고,
     그보다 뒤만 그린다. 두 번째 입장부터는 이미 표식이 있으므로 그 뒤 대화가 전부 보인다
     (다시 찍지 않는다 — 매번 찍으면 잠깐 나갔다 온 사람이 그동안의 대화를 잃는다).
   ★ 저장 위치는 **localStorage** 다. 기기를 바꾸면 그 방을 처음 보는 것으로 돌아간다.
     RTDB 로 올리면 새 경로 + 규칙(검사 7) + 비용 가드(검사 9)를 같이 손대야 하는데,
     이건 '내 화면에 무엇을 그리는가'라서 서버가 알 필요가 없다.
     ⚠️ 그래서 이건 **화면 가리기**지 접근 차단이 아니다. 서버 기록은 그대로 있고 구독도 그대로 받는다.
       "남이 못 읽게" 가 서버 차원의 요구가 되면 그때는 규칙까지 가야 한다 — 그건 다른 작업이다.
   ★ 표식이 빈 문자열('')일 수 있다: 대화가 하나도 없는 방에 처음 들어온 경우다.
     그때는 아무것도 안 가린다. **없음(null)과 반드시 구분**할 것 — null 은 '아직 안 들어와 봄'이다. */
const CHAT_JOIN_KEY_PREFIX = 'tw_chat_join:';
function _chatJoinKeyOf(room){ return CHAT_JOIN_KEY_PREFIX + (room || '_'); }
function _chatJoinCut(room){
  if(!room) return null;
  try{ return localStorage.getItem(_chatJoinKeyOf(room)); }catch(_){ return null; }
}
/* 그 방 목록을 처음 받은 순간 1회 — 이미 표식이 있으면 아무것도 안 한다.
   ⚠️ 부르는 자리는 **대화 목록이 실제로 도착하는 곳**이어야 한다(방에 들어간 순간이 아니라).
     들어간 순간에는 마지막 메시지가 무엇인지 알 수 없어서 찍을 키가 없다. */
function _noteChatJoin(room, list){
  if(!room) return;
  if(_chatJoinCut(room) !== null) return;   // 들어와 본 적 있는 방
  /* 🔁 옛 이용자 보정 — **한 번만 의미가 있는 마이그레이션**이다.
     [경위] 이 표식은 이 빌드에서 처음 생겼다. 그래서 예전부터 드나들던 방이라도 이 빌드에서
       처음 들어가는 순간이 '첫 입장'으로 찍혀, 그동안의 대화가 통째로 가려진다.
     [보정] 읽음 마커(tw_chat_read:)가 이미 있는 방이라면 **그 사람은 그 방에 들어와 본 적이 있다.**
       그때는 컷을 ''(= 아무것도 안 가림)로 찍어 예전 대화를 그대로 보게 한다.
     ⚠️ **순서가 전제다.** 뱃지 구독(_startChatBadgeSub)은 그 방 첫 방문이면 스스로 읽음 마커를
       심는데, 이 함수가 그보다 **앞**에서 불리기 때문에 진짜 새 방은 여기서 마커를 못 본다.
       그 순서를 바꾸면 모든 방이 '들어와 본 방'이 되어 이 기능이 통째로 죽는다.
     ★ 새로 설치한 사람에게는 읽음 마커도 없으므로 아무 영향이 없다.
     ⚠️ ''(빈 방·옛 이용자)와 null(아직 안 들어와 봄)의 구분은 그대로 지킨다. */
  if(_loadChatReadMarker(room)){
    try{ localStorage.setItem(_chatJoinKeyOf(room), ''); }catch(_){}
    return;
  }
  const last = (list||[])[(list||[]).length-1];
  try{ localStorage.setItem(_chatJoinKeyOf(room), _chatMsgKey(last) || ''); }catch(_){}
}
/* 입장 이후만 남긴다 — 화면과 기록 저장이 **같은 목록**을 보게 하는 것이 목적이다.
   (아래 _chatVisibleRows 의 '지우기'와 달리, 이건 파일로 저장해도 안 딸려 나가야 한다) */
function _chatSinceJoin(list){
  const cut = _chatJoinCut(_chatClearRoom());
  if(!cut) return list || [];      // null(첫 입장 전) · ''(빈 방에 입장) 둘 다 안 가린다
  return (list||[]).filter(m => _chatMsgKey(m) > cut);
}
function _chatClearRoom(){ return _chatReadRoom || null; }
function _chatVisibleRows(list){
  /* 🚪 입장 컷을 **먼저** 건다 — 두 컷은 목적이 달라 합치지 않는다.
     [지우기]는 내가 접은 것이라 [다시 보기]로 되돌아오고 기록 저장에는 그대로 딸려 나가지만,
     [입장 컷]은 되돌아오지 않는다(다시 보기를 눌러도 입장 이전은 안 나온다). */
  const base = _chatSinceJoin(list);
  const cut = _chatClearedTo[_chatClearRoom() || '_'];
  if(!cut) return base;
  return base.filter(m => _chatMsgKey(m) > cut);
}
function _chatClearNow(){
  const list = _chatLogCache() || [];
  const last = list[list.length-1];
  const k = last ? _chatMsgKey(last) : '';
  if(!k){ toast('지울 대화가 없어요'); return; }
  _chatClearedTo[_chatClearRoom() || '_'] = k;
  _renderChatLog(_chatLogCache());
  toast('🧹 내 화면에서만 지웠어요');
}
function _chatClearUndo(){
  delete _chatClearedTo[_chatClearRoom() || '_'];
  _renderChatLog(_chatLogCache());
  toast('지운 대화를 다시 불러왔어요');
}
function _chatReadKeyOf(room){ return CHAT_READ_KEY_PREFIX + (room || '_'); }
function _loadChatReadMarker(room){
  try{ return localStorage.getItem(_chatReadKeyOf(room)) || null; }catch(_){ return null; }
}
function _saveChatReadMarker(room, key){
  if(!room || !key) return;
  try{ localStorage.setItem(_chatReadKeyOf(room), key); }catch(_){}
}
/* 🔖 읽음 표시 — «T<서버 시각>:<id>». 순서를 대화 기록과 같은 기준(ts → id, chat-history.js chatOrder)으로 잰다.
   예전엔 «마지막 메시지 id» 를 저장하고 «id > 표시» 로 셌다. 목록은 ts 순인데 push id 는 보낸 사람 PC 시계로 만들어져
   시계가 어긋난 사람의 메시지가 늘 «안 읽음» 으로 남았다(알림콩이 새 글 없이 뜨고 열어도 안 꺼짐).
   옛 형식(id 만)은 예전 규칙으로 비교하고, 다음 저장 때 새 형식으로 덮는다. */
const CHAT_MARK_RE = /^T(\d+):(.*)$/;
function _chatMsgTs(m){ return (m && typeof m.ts === 'number' && m.ts > 0) ? m.ts : null; }
function _chatMarkOf(m){ const t = _chatMsgTs(m); return t !== null ? ('T' + t + ':' + (m.id || '')) : _chatMsgKey(m); }
function _chatIsAfter(m, mark){
  if(!m || !mark) return false;
  const p = CHAT_MARK_RE.exec(mark);
  if(!p) return _chatMsgKey(m) > mark;
  const t = _chatMsgTs(m), mt = Number(p[1]);
  if(t !== null && t !== mt) return t > mt;
  return String(m.id || '') > p[2];
}
/* 목록에서 가장 나중 메시지(ts → id) */
function _chatLastOf(list){
  let best = null;
  (list || []).forEach(m => { if(m && (!best || _chatIsAfter(m, _chatMarkOf(best)))) best = m; });
  return best;
}
/* 지금 화면에 그려진 메시지까지를 읽음으로 기록 — 새 형식 표시는 뒤로 물리지 않는다(목록 앞이 잘려 와도) */
function _markChatRead(){
  if(!_chatReadRoom) return;
  const last = _chatLastOf(_chatLogCache());
  if(!last) return;
  const old = _loadChatReadMarker(_chatReadRoom);
  if(!old || !CHAT_MARK_RE.test(old) || _chatIsAfter(last, old)) _saveChatReadMarker(_chatReadRoom, _chatMarkOf(last));
}

/* ── 💬 안 읽은 개수 뱃지 ────────────────────────────────────────────────
   대화창이 닫혀 있는 동안에만 얇게 구독해서(최근 CHAT_BADGE_LIMIT건) 마커보다 뒤인 메시지를 센다.
   · 대화창이 열려 있으면 구독을 끊는다 — 본문 구독(100건)과 중복 트래픽을 만들지 않기 위함.
   · 상한을 넘으면 "30+"로 표시. 정확한 개수보다 트래픽을 아끼는 쪽을 택한 값이라, 숫자만 바꾸면 조절된다.
   · 그 방 첫 방문(마커 없음)이면 '지금까지는 다 읽은 것'으로 보고 마커만 심는다 — 입장하자마자
     지난 대화가 전부 안 읽음으로 잡히는 걸 막는다(구분선 동작과 동일한 규칙). */
const CHAT_BADGE_LIMIT = 30;
let _chatBadgeUnsub = null;
let _chatBadgeRoom  = null;

function _chatWindowIsOpen(){
  const ov=document.getElementById('chatOverlay');
  return !!(ov && ov.style.display === 'block');
}
/* ▁ 대화창 최소화 — 타이틀바와 입력줄(😊🎲💣 + 입력칸)만 남긴다.
   ⚠️ 창 크기는 px 로 저장된다(_saveChatWinPos). 최소화한 높이가 저장되면 다음에 찌그러진 채로
     뜨므로, 접기 직전 높이를 여기 기억해 두고 저장은 그 값으로 한다.
   ⚠️ 최소화는 '닫힘'이 아니다 — 구독도 읽음 구분선도 그대로다. 다만 메시지가 안 보이므로
     💬 뱃지로만 알린다(_chatMinSinceKey 기준). 창을 닫으면 최소화도 풀린다. */
let _chatPreMinH = null;     // 접기 직전 인라인 높이(px 문자열) — 펼 때 그대로 되돌린다
let _chatMinSinceKey = null; // 접은 시점의 마지막 메시지 키 — 이 뒤에 온 것만 뱃지로 센다
function _chatIsMinimized(){
  const win=document.getElementById('chatWindow');
  return !!(win && win.classList.contains('min'));
}
function _setChatMinimized(on){
  const win=document.getElementById('chatWindow'); if(!win) return;
  const btn=document.getElementById('chatMinBtn');
  if(on){
    if(win.classList.contains('min')) return;
    _chatPreMinH = win.style.height || (win.offsetHeight ? win.offsetHeight+'px' : '');
    const last = _chatLastOf(_chatLogCache());
    _chatMinSinceKey = last ? _chatMarkOf(last) : null;
    win.classList.add('min');
    win.style.height='';                    // CSS 의 height:auto 가 먹도록 인라인 값을 비운다
    if(btn){ btn.textContent='□'; btn.title='펼치기'; }
    _saveChatWinPos();
  } else {
    if(!win.classList.contains('min')) return;
    win.classList.remove('min');
    if(_chatPreMinH) win.style.height=_chatPreMinH;
    _chatPreMinH = null; _chatMinSinceKey = null;
    if(btn){ btn.textContent='－'; btn.title='최소화 — 입력칸만 남기기'; }
    _setChatBadge(0);
    _renderChatLog(_chatLogCache());           // 접혀 있는 동안 쌓인 것까지 그리고 맨 아래로
    _saveChatWinPos();
  }
}
/* 접혀 있는 동안 새로 온 메시지 수를 💬 뱃지에 올린다 — 렌더 끝에서 부른다.
   ⚠️ 펼쳐져 있을 때는 아무것도 하지 않는다. 그쪽 뱃지는 _syncChatBadgeSub 가 0 으로 잡는다. */
function _syncChatMinBadge(){
  if(!_chatIsMinimized()) return;
  let n=0;
  (_chatLogCache()||[]).forEach(m=>{ if(_chatMsgKey(m) && (!_chatMinSinceKey || _chatIsAfter(m, _chatMinSinceKey))) n++; });
  _setChatBadge(n);
}
function _setChatBadge(n){
  const el=document.getElementById('myChatBadge'); if(!el) return;
  if(!n || n<=0){ el.classList.remove('on'); el.textContent=''; return; }
  el.textContent = (n >= CHAT_BADGE_LIMIT) ? (CHAT_BADGE_LIMIT+'+') : String(n);
  el.classList.add('on');
}
function _stopChatBadgeSub(){
  if(_chatBadgeUnsub){ try{ _chatBadgeUnsub(); }catch(_){} _chatBadgeUnsub=null; }
  _chatBadgeRoom = null;
}
function _startChatBadgeSub(room){
  if(!room || !window.firebaseAPI || !firebaseAPI.subscribeChatLog) return;
  _stopChatBadgeSub();
  _chatBadgeRoom = room;
  _chatBadgeUnsub = firebaseAPI.subscribeChatLog(room, list => {
    /* 🚪 대화창을 안 열어도 방에 들어와 있으면 이 구독이 먼저 도착한다 — 입장 시점은 여기가 더 정확하다.
       ⚠️ 이 구독은 최근 CHAT_BADGE_LIMIT 건만 받는다. 그래도 **마지막 키**는 전체 목록의 마지막과
         같으므로 컷 위치는 정확하다(앞이 잘려도 마지막은 마지막이다). */
    _noteChatJoin(room, list);
    const marker = _loadChatReadMarker(room);
    if(!marker){
      // 첫 방문 — 지금 시점을 읽음으로 심고 뱃지는 안 띄움
      const last=_chatLastOf(list); if(last) _saveChatReadMarker(room, _chatMarkOf(last));
      _setChatBadge(0); return;
    }
    let n=0;
    (list||[]).forEach(m => { if(_chatIsAfter(m, marker)) n++; });
    _setChatBadge(n);
  }, CHAT_BADGE_LIMIT);
}
/* 매 프레임 호출되는 칩 갱신에서 불림 — 방/창 상태가 바뀔 때만 실제로 구독을 갈아끼운다. */
function _syncChatBadgeSub(enabled){
  const room = (typeof Presence()!=='undefined' && Presence().roomCode) ? Presence().roomCode() : null;
  if(!enabled || !room || _chatWindowIsOpen()){
    if(_chatBadgeUnsub) _stopChatBadgeSub();
    /* ▁ 최소화 중에는 0 으로 지우지 않는다 — 그때의 뱃지는 본문 구독이 세고 있다
       (_syncChatMinBadge). 여기서 매 프레임 0 을 쓰면 뱃지가 절대 안 뜬다. */
    if(!(_chatWindowIsOpen() && _chatIsMinimized())) _setChatBadge(0);
    return;
  }
  if(_chatBadgeRoom !== room) _startChatBadgeSub(room);
}
function openChatWindow(){
  const ov=document.getElementById('chatOverlay'); if(!ov) return;
  // 투게더룸(채널2)에서만 의미가 있음 — 그 외엔 조용히 무시(💬 버튼 자체가 채널2에서만 보임)
  if(window._activeChannel !== 2){ return; }
  ov.style.display='block';
  // 🪟 열 때는 맨 앞으로 — 설정창·플레이리스트가 이미 앞에 올라와 있을 수 있다.
  bringWinToFront('chatOverlay');
  _restoreChatWinPos();
  _refreshChatProfile();
  _refreshChatMembers();
  _chatOffRefreshUI();   // 🔇 잠금 상태·토글 표시 + 🗑 삭제 버튼 (창을 다시 열 때마다 확인)
  /* 🗑 확인창은 창 안에 있어서 창을 닫아도 열린 상태가 남는다 — 다시 열었을 때 삭제 확인창이
     먼저 떠 있으면 사고다. 여는 자리에서 반드시 닫아 둔다. */
  _chatDelClose();
  _loadMyEmojis();   // 내 이모티콘 로드(다른 방 가도 유지)
  // 패널은 닫힌 상태로 시작
  const _ep=document.getElementById('chatEmojiWin'); if(_ep) _ep.classList.remove('on');
  // 대화 기록 구독 시작
  const room = (typeof Presence()!=='undefined' && Presence().roomCode) ? Presence().roomCode() : null;
  _stopChatBadgeSub();   // 본문 구독과 중복되지 않게 뱃지 구독 해제
  _setChatBadge(0);
  /* 💬 탭 — 방이 바뀌었으면 그 방에서 마지막에 보던 탭(이 PC 에 기억 · 없으면 #일반). 같은 방이면 그대로. */
  _chatTabSyncRoom(room);
  _chatSubscribeTab(room);
  _chatOffRefreshUI();   // 입력칸 안내문의 #탭 이름을 방 · 탭이 정해진 뒤에 다시
  const inp=document.getElementById('chatInput'); if(inp){ inp.value=''; setTimeout(()=>inp.focus(),0); }
}
function closeChatWindow(){
  // 🔖 닫는 시점까지를 읽음 처리 — 다음에 열면 그 아래로 쌓인 메시지에 구분선이 붙는다.
  _markChatRead();
  _chatTabUnreadStop();   // 💬 다른 탭 안 읽음 구독은 창이 열려 있는 동안만
  /* ▁ 최소화한 채로 닫으면 다음에 열 때 입력칸만 뜬다 — "채팅창이 사라졌다"로 읽힌다.
     닫을 때 항상 원래 크기로 되돌린다(높이 복원도 여기서 같이 일어난다). */
  _setChatMinimized(false);
  _chatCtxClose();
  const ov=document.getElementById('chatOverlay'); if(ov) ov.style.display='none';
  if(_chatLogUnsub()){ try{ _chatLogUnsub()(); }catch(_){} setChatLogUnsub(null); }
}
// 저장된 위치+크기 복원 (없으면 기본). 화면 밖이면 중앙으로 되돌림(해상도 변경 대비).
function _restoreChatWinPos(){
  const win=document.getElementById('chatWindow'); if(!win) return;
  let pos=null;
  try{ pos=JSON.parse(localStorage.getItem(CHAT_WIN_POS_KEY())||'null'); }catch(_){}
  // 크기 먼저 복원 (min/max는 CSS가 강제)
  if(pos && typeof pos.w==='number' && typeof pos.h==='number'){
    win.style.width  = pos.w+'px';
    win.style.height = pos.h+'px';
  }
  if(pos && typeof pos.left==='number' && typeof pos.top==='number'){
    const w=win.offsetWidth||430, h=win.offsetHeight||380;
    if(pos.left>=0 && pos.top>=0 && pos.left <= innerWidth-40 && pos.top <= innerHeight-30){
      win.style.transform='none';
      win.style.left=pos.left+'px';
      win.style.top =pos.top +'px';
      return;
    }
  }
  // 기본: 중앙 (크기는 위에서 복원됐을 수 있음)
  win.style.left='50%'; win.style.top='50%'; win.style.transform='translate(-50%,-50%)';
}
function _saveChatWinPos(){
  const win=document.getElementById('chatWindow'); if(!win) return;
  const r=win.getBoundingClientRect();
  /* ▁ 최소화 중에는 **접기 전 높이**를 저장한다. 지금 높이(입력줄만 남은 60px 남짓)를 저장하면
     다음에 창을 열 때 그 높이로 복원돼, 펼쳐도 메시지 영역이 없는 창이 뜬다. */
  const h = (_chatIsMinimized() && _chatPreMinH) ? parseInt(_chatPreMinH,10) : r.height;
  try{ localStorage.setItem(CHAT_WIN_POS_KEY(), JSON.stringify({
    left:Math.round(r.left), top:Math.round(r.top),
    w:Math.round(r.width), h:Math.round(isFinite(h)?h:r.height)
  })); }catch(_){}
}
// 내 마이홈 프로필 사진 반영
async function _refreshChatProfile(){
  const img=document.getElementById('chatProfileImg');
  const ph=document.getElementById('chatProfilePlaceholder');
  let av = (typeof _myHomeData()!=='undefined' && _myHomeData() && _myHomeData().avatar) ? _myHomeData().avatar : null;
  // ★ 마이홈(F4)을 한 번도 안 열었으면 _myHomeData가 아직 비어 있음 — 프로필 사진만 직접 가져온다.
  if(!av && window.firebaseAPI && firebaseAPI.getMyHome){
    try{
      const data = (firebaseAPI.fetchAvatar ? { avatar: await firebaseAPI.fetchAvatar(getMyUserId()) } : await firebaseAPI.getMyHome(getMyUserId())) || {};   // 사진 한 칸만(home 통째 아님)
      if(data.avatar){
        av = data.avatar;
        if(typeof _myHomeData()!=='undefined' && _myHomeData()) _myHomeData().avatar = data.avatar;   // 캐시
      }
    }catch(_){}
  }
  const avSrc = TwSafeHtml.safeUrl(av, 'image');   // 서버에서 온 프로필 사진 주소 — 허용된 그림 주소만
  if(avSrc){ if(img){ img.src=avSrc; img.style.display='block'; } if(ph) ph.style.display='none'; }
  else  { if(img){ img.style.display='none'; } if(ph) ph.style.display='block'; }
  // 🏠 프로필 사진(내 것) 클릭 → 내 마이홈 열기. 중복 바인딩 방지 플래그.
  const prof=document.getElementById('chatProfile');
  if(prof && !prof._homeBound){
    prof._homeBound = true;
    prof.style.cursor='pointer';
    prof.title='내 마이홈 열기';
    prof.addEventListener('click', ()=>{
      closeChatWindow();   // 채팅창 닫고 마이홈으로
      twNav.go(twNav.NAV.MY_HOME);
    });
  }
}

let _chatMyTab = 'general';
let _chatTabRoom = null;          // _chatMyTab 이 어느 방 것인가 — 방이 바뀌면 그 방의 기억한 탭으로
const CHAT_TAB_LS_PREFIX = 'tw.chatTab.';   // + 방 코드 → 마지막에 보던 탭 id (#일반이면 지운다)
function _chatTabLoad(room){ try{ return (room && localStorage.getItem(CHAT_TAB_LS_PREFIX + room)) || 'general'; }catch(_){ return 'general'; } }
function _chatTabSave(room, id){
  if(!room) return;
  try{ if(id && id !== 'general') localStorage.setItem(CHAT_TAB_LS_PREFIX + room, id); else localStorage.removeItem(CHAT_TAB_LS_PREFIX + room); }catch(_){}
}
/* 방이 바뀌었으면 그 방에서 기억한 탭으로 — 창을 열 때 · 탭 id 를 물을 때(창을 열기 전 말풍선 · presence 도 같은 탭을 보게) */
function _chatTabSyncRoom(room){
  if(!room || _chatTabRoom === room) return;
  _chatTabRoom = room; _chatMyTab = _chatTabLoad(room);
}
const _chatTabUnread = {};        // tabId → 안 읽은 수 (창이 열려 있는 동안, 보고 있지 않은 탭만)
let _chatTabUnreadUnsubs = [];
const CHAT_TAB_UNREAD_LIMIT = 30;
/* 🛰 탭 정의 바꾸기 — 서버 방이면 방 서버 meta(방장만 · 서버가 검사), 아니면 Firebase _meta/tabs.
   서버 방에서 Firebase 에 쓰면 rooms/{방}/_meta/tabs 만 생겨(유령 방 노드) 방장 혼자만 탭을 본다.
   탭별 대화 기록(_chatTab)은 어느 방이든 Firebase 다(#일반 chatLog 와 같다). 반환은 firebaseAPI 쪽과 같은 { ok, id?, reason? }. */
function _chatTabServer(){ try{ return (typeof Presence() !== 'undefined' && Presence().serverProvider && Presence().serverProvider()) || null; }catch(_){ return null; } }
async function _chatTabAdd(room, name){
  const sp = _chatTabServer();
  if(!sp) return firebaseAPI.addChatTab(room, name);
  const id = ChatTabs.freeSlot(_chatTabMeta());
  if(!id) return { ok:false, reason:'채널은 3개까지예요' };
  const r = await sp.setMeta({ tabs: { [id]: { name } } });
  return (r && r.ok) ? { ok:true, id } : { ok:false, reason: (r && r.code === 'forbidden') ? '방장만 바꿀 수 있어요' : '' };
}
async function _chatTabRename(room, id, name){
  const sp = _chatTabServer();
  if(!sp) return firebaseAPI.renameChatTab(room, id, name);
  const r = await sp.setMeta({ tabs: { [id]: { name } } });
  return { ok: !!(r && r.ok) };
}
async function _chatTabDelete(room, id){
  const sp = _chatTabServer();
  if(!sp) return firebaseAPI.deleteChatTab(room, id);
  const r = await sp.setMeta({ tabs: { [id]: null } });
  if(!(r && r.ok)) return { ok:false };
  // 정의는 서버에서 지워졌다 — 기록은 Firebase 에 있으니 따로 지운다(실패해도 탭은 이미 없다 · 같은 자리를 다시 쓰기 전에 정리)
  try{ if(firebaseAPI.clearChatLog) await firebaseAPI.clearChatLog(room, id); }catch(_){}
  return { ok:true };
}
function _chatTabMeta(){ try{ return (window._roomMetaCache && window._roomMetaCache.tabs) || null; }catch(_){ return null; } }
function _chatTabResolve(id){ return window.ChatTabs ? ChatTabs.resolve(id, _chatTabMeta()) : 'general'; }
function _chatMyTabId(){
  if(window._activeChannel !== 2) return 'general';   // 워킹룸에는 탭이 없다
  _chatTabSyncRoom(_chatRoomCode());
  return _chatTabResolve(_chatMyTab);
}
/* presence 에 싣는 값 — #일반이면 null(칸을 지운다 · 구버전과 같은 모양) */
function _chatTabOut(){ const t = _chatMyTabId(); return t === 'general' ? null : t; }
function _chatTabName(id){
  const t = window.ChatTabs ? ChatTabs.list(_chatTabMeta()).find(x => x.id === id) : null;
  return t ? t.name : '일반';
}
function _chatMarkKey(room, tab){ return window.ChatTabs ? ChatTabs.markKey(room, tab) : room; }
/* 지금 탭의 기록을 구독한다 — 창을 열 때 · 탭을 바꿀 때 */
function _chatSubscribeTab(room){
  const tab = _chatMyTabId();
  const key = _chatMarkKey(room, tab);
  // 🔖 이번 세션의 구분선 위치를 여기서 '고정' — 이후 창이 열려 있는 동안 새 메시지가 와도 선은 움직이지 않는다.
  _chatReadRoom = key;
  _chatReadMarker = _loadChatReadMarker(key);
  _chatJumpToUnread = true;   // 첫 렌더에서 구분선이 보이도록 스크롤
  if(_chatLogUnsub()){ try{ _chatLogUnsub()(); }catch(_){} setChatLogUnsub(null); }
  setChatLogCache([]);
  try{ _renderChatLog([]); }catch(_){}
  // 🚪 목록이 도착한 그 순간이 '입장'이다 — 처음이면 여기서 표식을 찍는다(_noteChatJoin 주석 참고).
  const _onList = list => { _noteChatJoin(key, list); _renderChatLog(list); };
  // 💬 이 PC 저장 + 그 뒤만 이어 받기(chat-history.js) — 옛 firebase-init 이면 예전 통째 구독
  if(room && window.firebaseAPI && firebaseAPI.chatHistory) setChatLogUnsub(firebaseAPI.chatHistory.open(room, tab, _onList));
  else if(room && window.firebaseAPI && firebaseAPI.subscribeChatLog) setChatLogUnsub(firebaseAPI.subscribeChatLog(room, _onList, undefined, tab));
  _chatTabUnreadStart(room);
  _chatTabsRender();
}
/* 보고 있지 않은 탭은 작은 limit 로 가볍게 구독해 숫자만 센다(본문은 받지 않는다). */
function _chatTabUnreadStop(){
  _chatTabUnreadUnsubs.forEach(u => { try{ u(); }catch(_){} });
  _chatTabUnreadUnsubs = [];
  Object.keys(_chatTabUnread).forEach(k => delete _chatTabUnread[k]);
}
function _chatTabUnreadStart(room){
  _chatTabUnreadStop();
  if(!room || window._activeChannel !== 2 || !window.ChatTabs || !(window.firebaseAPI && firebaseAPI.subscribeChatLog)) return;
  const cur = _chatMyTabId();
  ChatTabs.list(_chatTabMeta()).forEach(t => {
    if(t.id === cur) return;
    const key = _chatMarkKey(room, t.id);
    _chatTabUnreadUnsubs.push(firebaseAPI.subscribeChatLog(room, list => {
      let mark = _loadChatReadMarker(key);
      const last = _chatLastOf(list);
      // 처음 보는 탭이면 '지금까지는 읽은 것' — 뱃지 구독과 같은 규칙
      if(!mark && last){ mark = _chatMarkOf(last); _saveChatReadMarker(key, mark); }
      _chatTabUnread[t.id] = mark ? list.filter(m => _chatIsAfter(m, mark)).length : 0;
      _chatTabsRender();
    }, CHAT_TAB_UNREAD_LIMIT, t.id));
  });
}
function _chatSwitchTab(id){
  const room = _chatRoomCode(); if(!room) return;
  const next = _chatTabResolve(id);
  if(next === _chatMyTabId()) return;
  _markChatRead();                 // 떠나는 탭은 여기까지 읽음
  _chatMyTab = next; _chatTabRoom = room;
  _chatTabSave(room, next);        // 다음에 이 방에 들어오면(재부팅 포함) 이 탭부터
  _chatSubscribeTab(room);
  _chatOffRefreshUI();             // 입력칸 안내문(#이름)
  _refreshChatMembers();
  if(typeof Presence()!=='undefined' && Presence().broadcastNow) Presence().broadcastNow();   // 내 탭을 방에 알린다
}
/* 방 메타가 바뀌었다 — 내 탭이 지워졌으면 #일반으로, 탭 목록이 바뀌었으면 안 읽음 구독을 다시. */
let _chatTabSig = '';
function _chatTabsOnMeta(){
  if(!window.ChatTabs) return;
  const room = _chatRoomCode();
  const sig = ChatTabs.list(_chatTabMeta()).map(t => t.id + ':' + t.name).join('|');
  _chatTabSyncRoom(room);
  /* 방 메타가 아직 안 왔으면(재부팅 직후) 탭 목록이 비어 보일 뿐이다 — 기억한 탭을 «지워졌다» 로 보지 않는다. */
  if(window._roomMetaCache && room && window.firebaseAPI && firebaseAPI.chatHistory) firebaseAPI.chatHistory.syncTabs(room, _chatTabMeta()).catch(()=>{});   // 지운 채널의 PC 저장
  const metaReady = !!window._roomMetaCache;
  if(metaReady && _chatMyTab !== 'general' && _chatTabResolve(_chatMyTab) === 'general'){
    _chatMyTab = 'general'; _chatTabSave(room, 'general');
    if(_chatWindowIsOpen() && room){ _chatSubscribeTab(room); toast('채널이 삭제되어 #일반으로 옮겼어요'); }
    if(typeof Presence()!=='undefined' && Presence().broadcastNow) Presence().broadcastNow();
  }else if(_chatWindowIsOpen() && room && _chatReadRoom !== _chatMarkKey(room, _chatMyTabId())){
    // 기억한 탭이 메타가 온 뒤에야 풀렸다 — #일반으로 열어 둔 구독을 그 탭으로 옮긴다
    _chatSubscribeTab(room); _chatOffRefreshUI();
    if(typeof Presence()!=='undefined' && Presence().broadcastNow) Presence().broadcastNow();
  }else if(sig !== _chatTabSig && _chatWindowIsOpen()){
    _chatTabUnreadStart(room);
  }
  _chatTabSig = sig;
  _chatTabsRender();
}
/* 탭 줄 — 고정 · 스크롤바 없음. 좁아지면 이름만 줄임표, 인원 · 안 읽음 숫자는 늘 보인다(CSS). */
let _chatTabEdit = null;   // { mode:'add'|'rename', id }
function _chatTabsRender(){
  const bar = document.getElementById('chatTabs'); if(!bar || !window.ChatTabs) return;
  const on = window._activeChannel === 2;
  bar.classList.toggle('on', on);
  if(!on){ bar.innerHTML = ''; return; }
  // 입력 중이면 다시 그리지 않는다 — 치던 글자가 날아간다
  if(_chatTabEdit && bar.querySelector('.ct-edit input') === document.activeElement) return;
  const tabs = ChatTabs.list(_chatTabMeta()), cur = _chatMyTabId();
  const people = seats.filter(st => st && (st.isMe || st.friendName)).map(st => ({ tab: st.isMe ? cur : (st.chatTabId || 'general') }));
  const cnt = ChatTabs.counts(people, _chatTabMeta());
  const host = _chatIsHost();
  const h = tabs.map(t => {
    if(_chatTabEdit && _chatTabEdit.mode === 'rename' && _chatTabEdit.id === t.id) return _chatTabEditHtml(t.name);
    const un = t.id === cur ? 0 : (_chatTabUnread[t.id] || 0);
    return '<span class="ct-tab' + (t.id === cur ? ' on' : '') + '" data-tab="' + escHtml(t.id) + '" title="#' + escHtml(t.name) + '">' +
      '<span class="ct-name">#' + escHtml(t.name) + '</span><span class="ct-n">' + Number(cnt[t.id] || 0) + '</span>' +
      (un ? '<span class="ct-unread">' + (un >= CHAT_TAB_UNREAD_LIMIT ? CHAT_TAB_UNREAD_LIMIT + '+' : Number(un)) + '</span>' : '') + '</span>';
  });
  if(_chatTabEdit && _chatTabEdit.mode === 'add') h.push(_chatTabEditHtml(''));
  else if(ChatTabs.canAdd(host, _chatTabMeta())) h.push('<span class="ct-add" title="채널 추가 (방장)">+</span>');
  bar.innerHTML = h.join('');
  const inp = bar.querySelector('.ct-edit input');
  if(inp){ inp.focus(); inp.select(); }
}
function _chatTabEditHtml(val){
  return '<span class="ct-edit"><input type="text" maxlength="' + (window.ChatTabs ? ChatTabs.NAME_MAX : 10) + '" value="' + escHtml(val) + '" placeholder="채널 이름">' +
    '<button type="button" data-ct="ok">' + (_chatTabEdit && _chatTabEdit.mode === 'rename' ? '바꾸기' : '추가') + '</button><button type="button" data-ct="x">×</button></span>';
}
async function _chatTabEditSubmit(){
  const bar = document.getElementById('chatTabs'), edit = _chatTabEdit;
  const inp = bar && bar.querySelector('.ct-edit input'); if(!edit || !inp) return;
  if(!_chatIsHost()){ toast('방장만 바꿀 수 있어요'); _chatTabEdit = null; _chatTabsRender(); return; }
  const c = ChatTabs.cleanName(inp.value, _chatTabMeta(), edit.id);
  if(c.err){ toast(c.err); inp.focus(); return; }
  const room = _chatRoomCode(); if(!room) return;
  let r = null;
  if(edit.mode === 'add'){
    if(!ChatTabs.canAdd(true, _chatTabMeta())){ toast('채널은 #일반 포함 3개까지예요'); _chatTabEdit = null; _chatTabsRender(); return; }
    r = await _chatTabAdd(room, c.name);
  }else r = await _chatTabRename(room, edit.id, c.name);
  _chatTabEdit = null;
  if(!(r && r.ok)){ toast((r && r.reason) || '바꾸지 못했어요 — 네트워크를 확인해 주세요'); _chatTabsRender(); return; }
  if(edit.mode === 'add' && r.id){
    // 메타가 리스너로 오기 전이라도 바로 그 탭으로 — 캐시에 먼저 넣어 둔다
    try{ const m = window._roomMetaCache = Object.assign({}, window._roomMetaCache || {}); m.tabs = Object.assign({ [r.id]: { name: c.name, ts: Date.now() } }, m.tabs || {}); }catch(_){}   // 이미 온 값(서버 방은 meta 가 먼저 온다)이 이긴다
    _chatSwitchTab(r.id);
  }
  _chatTabsRender();
}
/* 탭 우클릭(방장) — 창 안 확인창. ⚠️ #chatWindow 의 자식으로 붙인다(body 로 빼면 run 모드에서 클릭이 뚫린다). */
function _chatAsk(text, btns){
  const win = document.getElementById('chatWindow'); if(!win) return;
  const old = document.getElementById('chatAskOv'); if(old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'chatAskOv'; ov.className = 'chat-ask-ov';
  ov.innerHTML = '<div class="chat-ask-win"><div class="ca-body">' + escHtml(text) + '</div><div class="ca-foot">' +
    btns.map((b, i) => '<button type="button" data-i="' + i + '"' + (b.danger ? ' class="danger"' : '') + '>' + escHtml(b.label) + '</button>').join('') + '</div></div>';
  ov.addEventListener('mousedown', e => e.stopPropagation());
  ov.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
  ov.addEventListener('click', e => {
    e.stopPropagation();
    if(e.target === ov){ ov.remove(); return; }
    const bt = e.target.closest && e.target.closest('button[data-i]'); if(!bt) return;
    const b = btns[+bt.dataset.i]; ov.remove();
    if(b && typeof b.run === 'function') b.run();
  });
  win.appendChild(ov);
}
function _chatTabMenu(id){
  if(!_chatIsHost()) return;   // 참여자에게는 메뉴가 없다
  if(id === 'general'){ _chatAsk('#일반은 이름을 바꾸거나 지울 수 없어요.', [{ label:'확인' }]); return; }
  const name = _chatTabName(id);
  _chatAsk('#' + name + ' 채널을 삭제할까요?\n대화 기록도 같이 지워지고, 있던 사람은 #일반으로 옮겨져요.', [
    { label:'이름 바꾸기', run: () => { _chatTabEdit = { mode:'rename', id }; _chatTabsRender(); } },
    { label:'삭제', danger:true, run: async () => {
        const r = await _chatTabDelete(_chatRoomCode(), id);
        if(!(r && r.ok)) toast('지우지 못했어요 — 네트워크를 확인해 주세요');
        else toast('🗑 #' + name + ' 채널을 지웠어요');
      } },
    { label:'취소' },
  ]);
}
function _bindChatTabs(){
  const bar = document.getElementById('chatTabs'); if(!bar) return;
  bar.addEventListener('mousedown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    e.stopPropagation();
    const bt = e.target.closest('[data-ct]');
    if(bt){ if(bt.dataset.ct === 'ok') _chatTabEditSubmit(); else { _chatTabEdit = null; _chatTabsRender(); } return; }
    if(e.target.closest('.ct-add')){ if(_chatIsHost()){ _chatTabEdit = { mode:'add' }; _chatTabsRender(); } return; }
    const t = e.target.closest('.ct-tab'); if(t) _chatSwitchTab(t.dataset.tab);
  });
  bar.addEventListener('keydown', e => {
    if(!e.target.closest('.ct-edit')) return;
    e.stopPropagation();
    if(e.isComposing || e.keyCode === 229) return;   // 한글 조합 중 Enter 는 조합 확정에 쓴다(대화 입력칸과 같은 규칙)
    if(e.key === 'Enter'){ e.preventDefault(); _chatTabEditSubmit(); }
    else if(e.key === 'Escape'){ _chatTabEdit = null; _chatTabsRender(); }
  });
  bar.addEventListener('contextmenu', e => {
    e.preventDefault(); e.stopPropagation();
    const t = e.target.closest('.ct-tab'); if(t) _chatTabMenu(t.dataset.tab);
  });
}

// 대화 기록 렌더
function _renderChatLog(list){
  setChatLogCache(list || []);
  const box=document.getElementById('chatMessages'); if(!box) return;
  /* 🧹 지우기 — 화면에 그릴 목록만 거른다(위 _chatVisibleRows 주석 참고). */
  const rows = _chatVisibleRows(_chatLogCache());
  /* 📋 고르는 중이면 그리지 않는다 — 아래 innerHTML 이 통째로 갈아 끼워서 고르던 것이 날아간다.
     최신 list 는 위에서 이미 _chatLogCache 에 받아 두었다. 선택이 풀리면 _chatFlushHeld 가 그린다. */
  if(_chatSelInBox()){
    _chatHeldN = Math.max(0, rows.length - _chatShownRows.length);
    _chatHeldOn = true;
    _chatChipRefresh();
    return;
  }
  _chatHeldOn = false; _chatHeldN = 0;
  _chatShownRows = rows;
  _chatChipRefresh();
  const atBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 30;   // 맨 아래면 자동 스크롤
  // 🔖 구분선 위치 = 마커보다 뒤(=안 읽은) 첫 메시지.
  //    마커가 없으면(그 방 첫 방문) 구분선 없이 전부 읽은 것으로 취급한다.
  let dividerAt = -1;
  if(_chatReadMarker){
    dividerAt = rows.findIndex(m => _chatIsAfter(m, _chatReadMarker));
  }
  const html=[];
  /* 🕘 작성 시각 hh:mm. ts 는 서버 시각(serverTimestamp)이 숫자로 내려온다.
     ⚠️ 방금 보낸 메시지는 서버 값이 확정되기 전이라 ts 가 잠깐 없을 수 있다 — 그때는 시각을
       아예 안 그린다. 그 순간의 로컬 시각을 대신 찍으면 다음 렌더에서 값이 바뀌어 깜빡인다. */
  const _hhmm = ts => {
    const n = +ts;
    if(!isFinite(n) || n <= 0) return '';
    const d = new Date(n);
    if(isNaN(d.getTime())) return '';
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  };
  let _myUid = null; try{ _myUid = getMyUserId(); }catch(_){}
  rows.forEach((m, i)=>{
    if(i===dividerAt) html.push('<div class="cm-unread-sep" id="cmUnreadSep"><span>여기까지 읽었습니다</span></div>');
    const nm=_chatEsc(m.name||'?');
    let tx=_renderChatText(m.text||'');
    // 내 발화는 이름을 테마 강조색으로 — 긴 대화에서 내 줄을 눈으로 찾기 위함(uid 기준이라 동명이인 안전).
    const mine = !!(_myUid && m.uid && m.uid === _myUid);
    const t = _hhmm(m.ts);
    // data-i — 복사는 화면 글자가 아니라 이 번호로 원문(_chatShownRows)을 찾는다(chat-copy.js).
    html.push('<div class="cm-row" data-i="' + i + '"><span class="cm-name' + (mine?' me':'') + '">' + nm + '</span> : ' + tx
      + (t ? '<span class="cm-time">' + t + '</span>' : '') + '</div>');
  });
  /* 🔇 잠겨 있으면 목록 끝에 안내줄 — 서버 기록이 아니라 **화면에만** 그린다.
     기록으로 남기면 껐다 켤 때마다 대화 사이에 줄이 쌓이고, 나중에 들어온 사람에게는
     이미 지난 안내가 대화처럼 보인다. 지금 상태는 토글 글자와 입력칸 안내가 이미 말한다. */
  if(_chatOffOn()) html.push('<div class="cm-row" style="text-align:center;color:#7a2718;">— 방장이 채팅을 껐어요 —</div>');
  box.innerHTML = html.join('');
  // 연 직후 첫 렌더에서는 맨 아래가 아니라 구분선이 화면 위쪽에 오도록 맞춘다(안 읽은 것부터 읽게).
  const jump = _chatJumpToUnread && rows.length;
  if(jump) _chatJumpToUnread = false;
  const sep = (dividerAt>=0) ? document.getElementById('cmUnreadSep') : null;
  if(jump && sep){
    // offsetTop은 offsetParent에 따라 달라져서 rect 차이로 계산(레이아웃 변경에 영향받지 않음)
    box.scrollTop += sep.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
  } else if(atBottom || jump){
    box.scrollTop = box.scrollHeight;
  }
  _syncChatMinBadge();   // ▁ 접혀 있으면 새로 온 만큼 💬 뱃지에 올린다 (펼쳐져 있으면 무동작)
}

let _chatShownRows = [];      // 지금 화면에 그려진 메시지(원문) — .cm-row[data-i] 의 번호가 여기 자리다
let _chatHeldOn = false, _chatHeldN = 0;
function _chatSelInBox(){
  const box = document.getElementById('chatMessages');
  if(!box || !box.getClientRects().length) return false;   // 창이 닫혀(숨어) 있으면 보류하지 않는다
  const sel = window.getSelection ? window.getSelection() : null;
  if(!sel || sel.isCollapsed || !sel.rangeCount) return false;
  return box.contains(sel.anchorNode) || box.contains(sel.focusNode);
}
function _chatChipRefresh(){
  const chip = document.getElementById('chatNewChip'), box = document.getElementById('chatMessages');
  if(!chip || !box) return;
  const on = _chatHeldOn && _chatHeldN > 0;
  chip.classList.toggle('on', on);
  if(!on) return;
  chip.textContent = '새 메시지 ' + _chatHeldN + ' ↓';
  // 대화 칸 오른쪽 아래 — offset 값이라 창의 transform·화면 배율과 무관하다
  const win = document.getElementById('chatWindow');
  if(win) chip.style.bottom = (win.clientHeight - (box.offsetTop + box.offsetHeight) + 8) + 'px';
}
/* 보류해 둔 list 로 그리고 맨 아래로. */
function _chatFlushHeld(){
  if(!_chatHeldOn) return;
  _chatHeldOn = false;
  _renderChatLog(_chatLogCache());
  const box = document.getElementById('chatMessages');
  if(box) box.scrollTop = box.scrollHeight;
}
/* 선택에 걸친 메시지들(원문). 한 메시지 안에서만 고른 것이면 null — 그때는 고른 글자 그대로 복사한다. */
function _chatSelRows(){
  if(!_chatSelInBox()) return null;
  const box = document.getElementById('chatMessages');
  const range = window.getSelection().getRangeAt(0);
  const hit = [...box.querySelectorAll('.cm-row[data-i]')].filter(r => range.intersectsNode(r));
  if(hit.length < 2) return null;
  return hit.map(r => _chatShownRows[+r.dataset.i]).filter(Boolean);
}
function _chatSelText(){
  if(!_chatSelInBox()) return '';
  const rows = _chatSelRows();
  if(rows) return window.ChatCopy ? ChatCopy.textFor(rows) : '';
  return String(window.getSelection().toString() || '').trim();
}
function _chatCopyToast(){
  const t = document.getElementById('chatCopyToast'); if(!t) return;
  t.classList.add('on');
  clearTimeout(_chatCopyToast._t);
  _chatCopyToast._t = setTimeout(()=>t.classList.remove('on'), 900);
}
async function _chatWriteClip(text){
  if(!text) return;
  try{ await navigator.clipboard.writeText(text); _chatCopyToast(); }
  catch(_){ toast('복사하지 못했어요'); }
}
function _chatCtxClose(){
  const m = document.getElementById('chatCtx'); if(m) m.classList.remove('on');
}
function _chatCtxOpen(e){
  const m = document.getElementById('chatCtx'), win = document.getElementById('chatWindow');
  if(!m || !win) return;
  const row = e.target.closest ? e.target.closest('.cm-row[data-i]') : null;
  m._row = row ? _chatShownRows[+row.dataset.i] : null;
  m.querySelector('[data-act="copy"]').classList.toggle('off', !_chatSelText());
  m.querySelector('[data-act="copyMsg"]').classList.toggle('hide', !m._row);
  m.classList.add('on');
  /* 창 기준 좌표. 화면 배율이 걸려 있어도 맞게 rect 와 layout 폭의 비로 되돌린다. */
  const r = win.getBoundingClientRect(), k = r.width ? win.offsetWidth / r.width : 1;
  const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
  m.style.left = Math.max(2, Math.min(x, win.clientWidth - m.offsetWidth - 2)) + 'px';
  m.style.top  = Math.max(2, Math.min(y, win.clientHeight - m.offsetHeight - 2)) + 'px';
}
function _chatCtxRun(act){
  const m = document.getElementById('chatCtx'); if(!m) return;
  const row = m._row;
  _chatCtxClose();
  if(act === 'copy') _chatWriteClip(_chatSelText());
  else if(act === 'copyMsg'){
    const line = (row && window.ChatCopy) ? ChatCopy.lineFor(row) : null;
    if(line) _chatWriteClip(line); else toast('이모티콘만 있는 메시지예요');
  }
  else if(act === 'all'){
    const box = document.getElementById('chatMessages'); if(!box) return;
    const sel = window.getSelection(), rg = document.createRange();
    rg.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(rg);
  }
}
function _bindChatCopy(){
  const box = document.getElementById('chatMessages'), win = document.getElementById('chatWindow');
  if(!box || !win) return;
  /* Ctrl+C / Cmd+C — 대화 칸 선택일 때만 가로챈다. 입력칸의 복사는 건드리지 않는다. */
  document.addEventListener('keydown', e=>{
    if(!(e.ctrlKey || e.metaKey) || e.altKey || String(e.key).toLowerCase() !== 'c') return;
    if(!_chatSelInBox()) return;
    e.preventDefault(); e.stopPropagation();
    _chatWriteClip(_chatSelText());
  }, true);
  // 메뉴 등 다른 길로 오는 복사도 같은 형식으로
  document.addEventListener('copy', e=>{
    if(!_chatSelInBox() || !e.clipboardData) return;
    const t = _chatSelText(); if(!t) return;
    e.clipboardData.setData('text/plain', t); e.preventDefault();
    _chatCopyToast();
  });
  document.addEventListener('selectionchange', ()=>{ if(_chatHeldOn && !_chatSelInBox()) _chatFlushHeld(); });
  box.addEventListener('contextmenu', e=>{ e.preventDefault(); e.stopPropagation(); _chatCtxOpen(e); });
  const m = document.getElementById('chatCtx');
  if(m){
    // ⚠️ mousedown 을 막아야 메뉴를 누르는 순간 선택이 풀리지 않는다([복사]가 빈손이 된다).
    m.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    m.addEventListener('click', e=>{
      e.stopPropagation();
      const it = e.target.closest('.cm-ctx-it'); if(it) _chatCtxRun(it.dataset.act);
    });
    m.addEventListener('contextmenu', e=>{ e.preventDefault(); e.stopPropagation(); });
  }
  document.addEventListener('mousedown', e=>{
    const mm = document.getElementById('chatCtx');
    if(mm && mm.classList.contains('on') && !mm.contains(e.target)) _chatCtxClose();
  }, true);
  const chip = document.getElementById('chatNewChip');
  if(chip){
    chip.addEventListener('mousedown', e=>{ e.preventDefault(); e.stopPropagation(); });
    chip.addEventListener('click', e=>{
      e.stopPropagation();
      try{ window.getSelection().removeAllRanges(); }catch(_){}
      _chatFlushHeld();
    });
  }
}

// 이스케이프된 텍스트 안의 이모티콘 마커를 <img>로. 마커는 [emoji:URL] 형태(URL은 이스케이프되어 &amp; 등 포함 가능).
// (구) 이모티콘 마커 렌더 — 지금은 _renderChatText 파이프라인이 대체(URL 링크화 충돌 방지). 참고용 보존.
function _renderEmojiMarkers(escapedText){
  return escapedText.replace(/\[emoji:(https?:[^\]]+)\]/g, (m, url)=>{
    return `<img class="cm-emoji" src="${url}" alt="이모티콘">`;
  });
}
// [dice:N] → SVG 점주사위 (1~6만 허용)
function _renderDiceMarkers(escapedText){
  return escapedText.replace(/\[dice:([1-6])\]/g, (m, n)=> _diceSvg(parseInt(n,10), 26));
}
// 메시지 텍스트 렌더 파이프라인 — 이모티콘/주사위 마커의 URL이 링크화에 먹히지 않도록
// 마커를 토큰(\u0000i\u0000)으로 먼저 대피시키고, 남은 텍스트만 링크화한 뒤 토큰을 최종 HTML로 복원한다.
function _renderChatText(rawText){
  let t=_chatEsc(rawText);
  const tokens=[];
  t=t.replace(/\[emoji:(https?:[^\]]+)\]/g, (m,u)=>{ tokens.push(`<img class="cm-emoji" src="${TwSafeHtml.safeUrl(u, 'image')}" alt="이모티콘">`); return `\u0000${tokens.length-1}\u0000`; });
  t=t.replace(/\[demoji:(d\d{2})\]/g, (m,id)=>{ const d=DEMOJI_BY_ID[id]; if(!d) return m;
    tokens.push(`<img class="cm-emoji" style="width:${d.w}px;height:${d.h}px" src="${DEMOJI_DIR}${d.file}" alt="${_chatEsc(d.cmd)}">`); return `\u0000${tokens.length-1}\u0000`; });
  t=t.replace(/\[dice:([1-6])\]/g, (m,n)=>{ tokens.push(_diceSvg(parseInt(n,10),26)); return `\u0000${tokens.length-1}\u0000`; });
  t=_chatLinkify(t);   // 남은 http URL만 링크로
  t=t.replace(/\u0000(\d+)\u0000/g, (m,i)=> tokens[+i] || '');   // 토큰 복원
  return t;
}
/* 🚫 채팅 제한 — 이모티콘 연타 · 도배 · 길이. 값은 **여기 한 곳에만** 둔다.
   ★ 판정은 마커로 펼친 뒤(outText)에 한다. 원문(`/ㅋㅋ`)으로 세면 내 이모티콘과 기본 이모티콘의
     명령어가 같을 때(내 것 우선 규칙) 다른 그림인데 같은 것으로 세거나 그 반대가 된다.
   ⚠️ CHAT_OUT_MAX 는 **서버 저장 상한과 짝이다**(firebaseAPI.sendChatLog 의 slice).
     한쪽만 올리면 그 차이만큼이 서버에서 잘려 나가는데, 하필 마커 한가운데가 잘리면
     `[emoji:https://…` 가 닫히지 않은 채로 남아 그 줄이 통째로 깨진다 —
     **커스텀 이모티콘을 연속 세 번 쓰면 깨지던 것의 정체가 이것이었다**(마커 하나가 URL 때문에
     200자 안팎이라 셋이면 예전 상한 500 을 넘겼다). 고칠 때 두 숫자를 같이 옮길 것. */
const CHAT_EMOJI_RUN_MAX = 3;       // 같은 이모티콘을 연달아 붙여 쓸 수 있는 최대 개수
const CHAT_SAME_RUN_MAX  = 3;       // 같은 내용을 연달아 보낼 수 있는 최대 횟수
const CHAT_SAME_COOL_MS  = 10000;   // 그 뒤 같은 내용을 다시 보낼 수 있을 때까지
const CHAT_BURST_N = 8, CHAT_BURST_MS = 5000;   // 5초에 8줄까지
const CHAT_OUT_MAX = 1200;
let _chatSameText='', _chatSameCount=0, _chatSameAt=0, _chatSendTimes=[];
/* 같은 이모티콘이 연달아 몇 개 붙었는가 — 사이에 글자가 하나라도 있으면 연속이 끊긴다.
   (공백만 있는 것은 붙여 쓴 것으로 본다. `/ㅋㅋ /ㅋㅋ /ㅋㅋ /ㅋㅋ` 로 우회되면 규칙이 없는 것과 같다.) */
function _emojiRunTooLong(outText){
  const re=/\[(?:emoji:[^\]]+|demoji:d\d{2})\]/g;
  let m, prev=null, run=0, lastEnd=-1;
  while((m=re.exec(outText))){
    const contiguous = (lastEnd>=0) && /^\s*$/.test(outText.slice(lastEnd, m.index));
    run = (contiguous && m[0]===prev) ? run+1 : 1;
    if(run > CHAT_EMOJI_RUN_MAX) return true;
    prev=m[0]; lastEnd=re.lastIndex;
  }
  return false;
}
/* 막을 이유가 있으면 안내 문구를, 없으면 null. ⚠️ 조용히 안 보내면 "채팅이 안 된다"로 읽힌다 —
   막을 때는 반드시 무엇에 걸렸는지 띄울 것. */
function _chatBlockReason(text, outText){
  if(_emojiRunTooLong(outText)) return '😊 같은 이모티콘은 '+CHAT_EMOJI_RUN_MAX+'개까지만!';
  if(outText.length > CHAT_OUT_MAX) return '😊 이모티콘이 너무 많아요';
  const now = Date.now();
  _chatSendTimes = _chatSendTimes.filter(t => now - t < CHAT_BURST_MS);
  if(_chatSendTimes.length >= CHAT_BURST_N) return '⏳ 조금 천천히 보내주세요';
  if(text === _chatSameText){
    if(_chatSameCount >= CHAT_SAME_RUN_MAX && now - _chatSameAt < CHAT_SAME_COOL_MS)
      return '⏳ 같은 내용은 '+CHAT_SAME_RUN_MAX+'번까지만!';
  }
  return null;
}
function _chatNoteSent(text){
  const now = Date.now();
  if(text === _chatSameText && now - _chatSameAt < CHAT_SAME_COOL_MS) _chatSameCount++;
  else { _chatSameText = text; _chatSameCount = 1; }
  _chatSameAt = now;
  _chatSendTimes.push(now);
}
// 대화창에서 메시지 전송 (Enter)
function _sendChatWindowMsg(){
  const inp=document.getElementById('chatInput'); if(!inp) return;
  let text=inp.value.trim(); if(!text) return;
  inp.value='';
  if(window._activeChannel !== 2) return;                 // 투게더룸에서만
  // 💃 춤 명령(/80 /150) — 채팅으로 보내지 않고 이모트로 처리. 해금 레벨 미달이면 안내만.
  //   `/80/80/80` 처럼 같은 명령을 이어 쓸 수 있다(💃💥 깜짝쇼). 춤 자체는 한 번만 시작된다.
  {
    const hit = _parseDanceCmdChain(text);
    if(hit){
      const def = hit.def;
      if(isDanceUnlocked(def)){
        // ⏳ 춤 명령 쿨다운 5초(개인) — 남발 방지. 남이 건 춤(수신)은 쿨다운과 무관하게 언제든 교체됨(댄스배틀).
        //   이어쓰기는 전송 한 번이라 쿨다운도 한 번만 먹는다.
        const nowMs = Date.now();
        if(nowMs - _danceCmdCooldownAt() < 5000){
          toast('⏳ 춤 명령은 5초에 한 번!');
          return;
        }
        setDanceCmdCooldownAt(nowMs);
        startMyDance(def, { cmd: hit.cmd, repeat: hit.repeat });
      }
      else toast('🔒 Lv.'+def.reqLevel+' 달성 시 사용할 수 있어요');
      return;   // 명령은 대화 기록/전송에 싣지 않음
    }
  }
  // 슬래시 명령(/ㅋㅋ)을 이모티콘 마커([emoji:URL])로 치환 — 실제 전송/기록에 실리는 텍스트
  const outText = _applyEmojiCommands(text);
  /* 🔇 채팅 잠금 — 이 자리가 마지막 문이다.
     ★ 위 춤 명령(/80·/150)은 이미 return 으로 빠져나갔으므로 여기 안 온다.
     ★ **이모티콘만으로 된 줄은 통과**시킨다 — 마커를 걷어내고 남는 글자가 없으면 이모티콘뿐이다.
       (글자가 섞이면 그건 하고 싶은 말이므로 막는다)
     ⚠️ 친 글은 입력칸에 돌려준다 — 지우면 길게 쓴 줄이 통째로 날아간다(_chatBlockReason 과 같은 관례). */
  if(_chatOffOn()){
    /* ⚠️ 마커는 커스텀 `[emoji:URL]` 과 기본 `[demoji:id]` 두 가지다 — 앞글자 d 하나 차이라
       `(?:de)?emoji` 로 쓰면 'deemoji' 를 찾게 되어 기본 이모티콘이 통째로 안 걸린다. */
    const bare = String(outText).replace(/\[d?emoji:[^\]]*\]/g, '').trim();
    if(bare){
      toast('🔇 방장이 채팅을 껐어요 — 😊 🎲 💣 와 /80 · /150 은 쓸 수 있어요');
      inp.value = text;
      return;
    }
  }
  /* 🚫 제한에 걸리면 보내지 않고 친 글을 입력창에 돌려준다 — 지워버리면 길게 쓴 줄이 통째로 날아간다. */
  {
    const why = _chatBlockReason(text, outText);
    if(why){ toast(why); inp.value = text; return; }
    _chatNoteSent(text);
  }
  // 1) 말풍선 + 실시간 전파(기존 경로 재사용). 기본 이모티콘만 마커로(말풍선이 이미지로 렌더), 커스텀은 원문 유지.
  const bubbleText = _applyDefaultEmojiOnly(text);
  /* 🌊 날리기 — 체크돼 있어도 0.5 초 안에 두 번째면 **그 줄만 말풍선으로** 나간다.
     한 노드가 마지막 하나만 들고 있어서, 연타하면 앞 줄이 상대 화면에 뜨기도 전에 덮인다.
     보내기를 막지는 않는다 — 친 글을 잃지 않는 것이 이 창의 관례다(잠금·도배 제한 참고). */
  const _fly = !(typeof officeMode() !== 'undefined' && officeMode()) && _chatFlyOn && _chatFlySendGate();   // 🏢 회사원 모드면 안 날린다
  sendMyChat(bubbleText, _fly, _fly ? _chatFlyColor : '', _chatFlySize, _chatMyTabId());
  // 2) 대화 기록 저장 — 마커가 든 outText 저장(다른 사람도 이모티콘을 URL로 렌더)
  const room=(typeof Presence()!=='undefined' && Presence().roomCode)?Presence().roomCode():null;
  if(room && window.firebaseAPI && firebaseAPI.sendChatLog){
    /* ⚠️ 서버가 거부한 줄은 **내 화면에 한 번 떴다가 사라진다** — RTDB 가 낙관적으로 먼저
       반영하고 거부가 돌아오면 되돌리기 때문이다. 예전엔 그 실패가 어디에도 안 남아서,
       보내는 사람에게는 «쳤는데 없어지거나 순서가 뒤엉킨» 것으로만 보였다.
       ★ 친 글은 입력칸에 돌려준다 — 잠금·도배 제한과 같은 관례다(길게 쓴 줄을 날리지 않는다). */
    Promise.resolve(firebaseAPI.sendChatLog(room, { uid:getMyUserId(), name:getDisplayName(), text:outText }, _chatMyTabId()))
      .then(r=>{
        if(r && r.ok === false){
          toast('전송에 실패했어요 — 잠시 뒤 다시 보내주세요');
          const el=document.getElementById('chatInput');
          if(el && !el.value) el.value = text;   // 그 사이에 새로 친 글이 있으면 덮지 않는다
        }
      })
      .catch(()=>{});
  }
}
// 대화 기록 텍스트 파일로 저장
function _saveChatLog(){
  const room=(typeof Presence()!=='undefined' && Presence().roomCode)?Presence().roomCode():'room';
  // 🚪 입장 이전 대화는 파일로도 안 나간다 — 화면에서 가려놓고 저장 버튼 한 번으로 다 보이면 의미가 없다.
  //    ⚠️ [지우기]로 접은 것은 그대로 저장된다(예전 동작 유지 — 그건 내가 잠시 접어둔 것뿐이다).
  const lines=_chatSinceJoin(_chatLogCache()).map(m => `${m.name||'?'} : ${m.text||''}`);
  const header=`대화 기록 — ${room}\n저장 시각: ${new Date().toLocaleString()}\n${'='.repeat(30)}\n`;
  const blob=new Blob([header+lines.join('\n')], {type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`chat_${room}_${Date.now()}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

let _emojiCache = {};          // { slot: {cmd, url, gif} }  — 내 이모티콘 (다른 방 가도 유지)
let _emojiPendingSlot = null;  // 파일 선택 중인 슬롯
const EMOJI_SLOTS = 8;

// ★ 기본 이모티콘 목록은 demoji-catalog.js(마이홈 바탕화면 · 말풍선도 같이 읽는 맨 아래 표).
const DEMOJI_DIR = demojiCatalog.DIR;
const DEMOJI_LIST = demojiCatalog.LIST;
const DEMOJI_BY_ID = demojiCatalog.BY_ID, DEMOJI_BY_CMD = demojiCatalog.BY_CMD;


// 내 이모티콘 로드 (대화창 열 때 1회)
async function _loadMyEmojis(){
  try{
    if(window.firebaseAPI && firebaseAPI.getEmojis){
      _emojiCache = await firebaseAPI.getEmojis(getMyUserId()) || {};
    }
  }catch(_){ _emojiCache = {}; }
  _renderEmojiPanel();
}
// 이모티콘 창 렌더 — [기본 32개] → [내 이모티콘(× 삭제)] → [＋ 등록] 인라인 나열
function _renderEmojiPanel(){
  const grid=document.getElementById('emojiGrid'); if(!grid) return;
  let html='';
  // 기본 이모티콘 (앱 번들 — 모든 유저 공용)
  for(const d of DEMOJI_LIST){
    html += `<div class="emoji-chip" data-cmd="${_chatEsc(d.cmd)}" title="/${_chatEsc(d.cmd)} 삽입">`
         +  `<img src="${DEMOJI_DIR}${_chatEsc(d.file)}" alt="${_chatEsc(d.cmd)}">`
         +  `<span class="ec-cmd">/${_chatEsc(d.cmd)}</span></div>`;
  }
  // 내 이모티콘 (등록된 것만 — × 삭제)
  for(let i=0;i<EMOJI_SLOTS;i++){
    const e=_emojiCache[i];
    if(e && e.url){
      html += `<div class="emoji-chip" data-slot="${i}" title="/${_chatEsc(e.cmd)} 삽입">`
           +  `<img src="${_chatEsc(TwSafeHtml.safeUrl(e.url, 'image'))}" alt="${_chatEsc(e.cmd)}">`
           +  `<span class="ec-cmd">/${_chatEsc(e.cmd)}</span>`
           +  `<button class="es-del" data-del="${i}" title="삭제">×</button></div>`;
    }
  }
  // ＋ 새 이모티콘 등록 — 기존 등록 흐름(빈 슬롯 → 파일 → 명령어 → 저장) 그대로 재사용
  html += `<button class="emoji-add-btn" data-add="1" title="내 이모티콘 등록 (최대 ${EMOJI_SLOTS}개)">＋</button>`;
  grid.innerHTML=html;
}
// 이모티콘 창 토글 — 채팅창 오른쪽에 배치(공간 없으면 왼쪽, 화면 안으로 클램프)
function _toggleEmojiPanel(){
  const win=document.getElementById('chatEmojiWin'); if(!win) return;
  if(win.classList.contains('on')){ win.classList.remove('on'); return; }
  _renderEmojiPanel();
  win.classList.add('on');
  const cw=document.getElementById('chatWindow');
  if(cw){
    const r=cw.getBoundingClientRect();
    const w=win.offsetWidth||308, h=win.offsetHeight||220;
    let x=r.right+8, y=r.top;
    if(x+w>innerWidth-4) x=r.left-w-8;          // 오른쪽 공간 없으면 왼쪽
    x=Math.max(4, Math.min(innerWidth-w-4, x)); // 화면 안 클램프
    y=Math.max(4, Math.min(innerHeight-h-4, y));
    win.style.left=x+'px'; win.style.top=y+'px';
  }
}
// 슬롯 클릭 — 등록된 건 명령어 삽입, 빈 칸은 파일 선택
function _onEmojiSlotClick(slot){
  const e=_emojiCache[slot];
  if(e && e.cmd){
    // 입력창에 /명령어 삽입 (바로 전송 안 함)
    const inp=document.getElementById('chatInput');
    if(inp){ const add = '/'+e.cmd+' '; inp.value = (inp.value||'') + add; inp.focus(); }
  }else{
    // 빈 칸 → 파일 선택
    _emojiPendingSlot = slot;
    const fi=document.getElementById('emojiFileInput'); if(fi){ fi.value=''; fi.click(); }
  }
}
// 파일 선택됨 → 리사이즈(정지) 또는 원본(gif) → 명령어 입력 → 저장
async function _onEmojiFilePicked(file){
  const slot=_emojiPendingSlot; _emojiPendingSlot=null;
  if(file==null || slot==null) return;
  const isGif = /gif$/i.test(file.type) || /\.gif$/i.test(file.name||'');
  // GIF 용량 상한 500KB (원본 유지)
  if(isGif && file.size > 500*1024){ toast('GIF는 500KB 이하만 등록할 수 있어요'); return; }
  // 명령어 입력 (공백 없이 10자 이내)
  let cmd = await asyncPrompt({ title:'이모티콘 명령어', message:'슬래시 뒤에 쓸 이름을 정하세요. 예: ㅋㅋ → /ㅋㅋ\n(공백 없이 10자 이내)', placeholder:'ㅋㅋ', maxLength:10 });
  if(cmd==null) return;
  cmd = String(cmd).replace(/\s+/g,'').slice(0,10);
  if(!cmd){ toast('명령어를 입력해 주세요'); return; }
  // 중복 명령어 방지
  for(const k in _emojiCache){ if(String(k)!==String(slot) && _emojiCache[k] && _emojiCache[k].cmd===cmd){ toast('이미 쓰고 있는 명령어예요'); return; } }
  // 이미지 준비 — 정지는 30x30 리사이즈, gif는 원본 dataURL
  let dataUrl;
  try{
    if(isGif){
      dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
    }else{
      dataUrl = await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=e=>{ const img=new Image(); img.onload=()=>{
          const SZ=30; const c=document.createElement('canvas'); c.width=SZ; c.height=SZ;
          const ctx=c.getContext('2d');
          const side=Math.min(img.width,img.height);
          ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,SZ,SZ);
          res(c.toDataURL('image/png'));
        }; img.onerror=rej; img.src=e.target.result; };
        r.onerror=rej; r.readAsDataURL(file);
      });
    }
  }catch(_){ toast('이미지를 읽지 못했어요'); return; }
  // 저장
  if(!(window.firebaseAPI && firebaseAPI.saveEmoji)){ toast('앱을 재시작한 후 사용할 수 있어요'); return; }
  toast('이모티콘 등록 중…');
  const r = await firebaseAPI.saveEmoji(getMyUserId(), slot, cmd, dataUrl, isGif);
  if(r && r.ok){ _emojiCache[slot]={cmd,url:r.url,gif:isGif}; _renderEmojiPanel(); toast('이모티콘을 등록했어요'); }
  else toast('등록에 실패했어요');
}
// 이모티콘 삭제
async function _deleteEmoji(slot){
  if(!(window.firebaseAPI && firebaseAPI.deleteEmoji)) return;
  const r = await firebaseAPI.deleteEmoji(getMyUserId(), slot);
  if(r && r.ok){ delete _emojiCache[slot]; _renderEmojiPanel(); }
}
// 슬래시 명령을 이모티콘 마커로 치환 — 전송 직전 호출. "/ㅋㅋ" → "[emoji:URL]"
function _applyEmojiCommands(text){
  return String(text).replace(/\/([^\s\/]{1,10})/g, (m, cmd)=>{
    for(const k in _emojiCache){
      const e=_emojiCache[k];
      if(e && e.cmd===cmd && e.url) return `[emoji:${e.url}]`;
    }
    const d=DEMOJI_BY_CMD[cmd];   // ★ 기본 이모티콘 — 같은 명령어면 내 것이 우선
    if(d) return `[demoji:${d.id}]`;
    return m;   // 매칭 안 되면 그대로 텍스트
  });
}

// 말풍선용 — 기본 이모티콘 명령만 [demoji:id]로. 커스텀(URL)은 말풍선에선 지금처럼 텍스트 유지.
function _applyDefaultEmojiOnly(text){
  return String(text).replace(/\/([^\s\/]{1,10})/g, (m, cmd)=>{
    for(const k in _emojiCache){ const e=_emojiCache[k]; if(e && e.cmd===cmd && e.url) return m; }   // 내 것 우선 규칙 유지
    const d=DEMOJI_BY_CMD[cmd];
    return d ? `[demoji:${d.id}]` : m;
  });
}

return {
  DEMOJI_BY_CMD,
  DEMOJI_BY_ID,
  DEMOJI_DIR,
  DEMOJI_LIST,
  EMOJI_SLOTS,
  FLY_COLOR_LEVEL,
  _bindChatCopy,
  _bindChatTabs,
  _chatClearNow,
  _chatClearUndo,
  _chatFlyColor: ()=>_chatFlyColor,   // 읽는 함수
  setChatFlyColor: (v)=>{ _chatFlyColor = v; },   // 쓰는 함수 — app.js 가 비운다
  _chatFlyOn: ()=>_chatFlyOn,   // 읽는 함수
  setChatFlyOn: (v)=>{ _chatFlyOn = v; },   // 쓰는 함수 — app.js 가 비운다
  _chatFlyRefreshUI,
  _chatFlySize: ()=>_chatFlySize,   // 읽는 함수
  setChatFlySize: (v)=>{ _chatFlySize = v; },   // 쓰는 함수 — app.js 가 비운다
  _chatIsMinimized,
  _chatMyTabId,
  _chatTabName,
  _chatTabOut,
  _chatTabResolve,
  _chatTabsOnMeta,
  _chatTabsRender,
  _chatWindowIsOpen,
  _deleteEmoji,
  _emojiCache: ()=>_emojiCache,   // 읽는 함수
  _flyLaneFreeAt: ()=>_flyLaneFreeAt,   // 읽는 함수
  setFlyLaneFreeAt: (v)=>{ _flyLaneFreeAt = v; },   // 쓰는 함수 — app.js 가 비운다
  _flySizeOk,
  _onEmojiFilePicked,
  _onEmojiSlotClick,
  _renderChatLog,
  _saveChatLog,
  _saveChatWinPos,
  _sendChatWindowMsg,
  _setChatMinimized,
  _syncChatBadgeSub,
  _toggleEmojiPanel,
  closeChatWindow,
  openChatWindow,
  sendMyChat,
  showFlyText,
};
}

const api = { createChatUi };
if(typeof window !== 'undefined') window.TwChatUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
