/* win-stack.js — 🪟 창 겹침 — 누른 창 맨 앞(bringWinToFront) · ESC 스택(escRegisterWindow)
   app.js «🪟 창 겹침 — 누른 창 맨 앞 · ESC 스택» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 42번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _escEditable · bringWinToFront · escRegisterWindow — app.js 는 winStackMod.이름 으로 부른다.
   ★ 실을 때 window.__winPosResetters(창 자리 되돌리기 목록)의 처음 값을 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwWinStack — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-win-stack.js */
(function(){

/* 🪟 창 자리 되돌리기 목록 — 창마다(스케줄러 알림 · 플레이리스트 · 가챠 · 설정) 자기 자리 지우기를 올리고, 설정의 «창 위치 초기화» 가 다 부른다.
   처음 값은 창 관리 이 파일 한 곳(올리는 모듈보다 먼저 싣는다 — 모듈 순환 끊기 4) */
window.__winPosResetters = window.__winPosResetters || [];

function createWinStack(deps){

/* 🪟 창 앞뒤(z-index) — **누른 창이 맨 앞으로 온다.**

   [무엇을 푸는가] 설정·채팅·플레이리스트를 다 열어 두면 앞뒤가 CSS 에 박힌 숫자로만 정해져서,
     뒤에 깔린 창은 아무리 눌러도 영영 뒤에 남았다(채팅 82 > 설정 58 > 상태칩 55).

   ★ 다루는 것은 여기 **나열된 id 뿐**이다. 목록에 없는 창은 CSS 고정값 그대로 남는다.
     - #chatOverlay        💬 대화창 (창은 그 안의 #chatWindow 지만 z 는 겉의 오버레이가 쥔다)
     - #focusSettingsPanel ⚙️ 설정창
     - #myStatusChip       🎵 플레이리스트가 **이 안에** 산다. 칩이 z-index:55 로 스태킹 컨텍스트를
       만들기 때문에 안쪽 창만 따로 올릴 수 없다 — 그래서 칩째로 올린다.
       (칩을 body 로 꺼내면 클릭 통과 화이트리스트가 조상으로 #myStatusChip 을 보는 규약이 깨진다)
     - #focusLogOverlay    ⏱ 포커스기록 (제보: "다른 창을 켜 두면 눌러도 계속 뒤에 있다")
       CSS 기본값이 70 이라 채팅(82)·올라간 창(83~92) 아래에 영영 갇혀 있었다. 목록에 넣으면
       #chatOverlay 와 똑같이 동작한다 — 겉 오버레이는 inset:0 이지만 pointer-events:none 이라
       빈 곳을 눌러도 경로에 안 들어온다(아래 pointerdown 주석과 같은 이유).

     - #bellWin            🔔 다가오는 일정 (제보: "눌러도 계속 뒤에 있다")
       CSS 기본값이 62 라 이 목록의 어떤 창보다도 아래였다. 위 주석은 한동안 "알림창은
       #myStatusChip 안에 있어서 혼자 못 올린다"고 적혀 있었는데 **사실이 아니다** —
       HTML 에서 body 직속이다(칩은 3758줄, 이쪽은 4589줄). 그래서 그냥 한 줄 더하면 된다.
     - #myHomeOverlay      🏠 마이홈 (같은 제보) — 기본값 71.
     - #mhGbOverlay        📖 방명록 — 기본값 74. **마이홈과 함께 올려야 한다.**
       마이홈만 목록에 넣으면 마이홈이 83 이상으로 올라가면서 방명록(74)이 그 뒤로 숨는다.
       마이홈에서 열리는 창이라 "열었는데 안 보인다"가 된다 — 같이 태워야 서로 앞뒤가 잡힌다.

   ⚠️ **83~92 밖으로 나가지 않는다.** 가챠(120)·마이홈 팝업(9200)·색 선택(9999) 같은 위층을
     넘어서면 안 되고, 꾸미기창(93)보다도 아래여야 한다. 천장에 닿으면 지금 앞뒤 순서를
     유지한 채 번호만 다시 매긴다 — 숫자를 무한정 올리지 않는다.
   ⚠️ 시작값 82 는 **채팅창의 CSS 기본값**이다. 첫 raise 가 83 이 되어 어떤 창이든 채팅창 위로
     올라온다. 여기를 낮추면 "처음 한 번은 안 올라온다"가 된다.
   ⚠️ 인라인 style 로 쓴다 — CSS 의 기본값보다 세다. 대신 !important 규칙은 못 이긴다. */
const WIN_Z_MIN = 83, WIN_Z_MAX = 92;
/*     - #pkOverlay         📷 스티커사진 촬영 창 — CSS 기본값이 82(대화창과 같다)라 목록에
       없으면 어떤 창을 눌러도 그 위로 못 올라온다. 대화창의 📷 로 여는 창이라 둘이 같이
       떠 있는 것이 기본 상황이고, 그래서 앞뒤가 바뀌어야 한다. */
/*     - #creatorOverlay · #raceOverlay  🧍 캐릭터 편집 · 🐾 종족 선택(큰 작업창) — 목록 밖 고정값(55)이면 마이홈(71) · 대화창(82)이 늘 위에 겹쳤다(B-1016-4).
       목록에 넣고 «열면 맨 앞» 규칙을 따른다. 그 안에서 여는 대화상자는 창 층 표의 대화상자 층(창 쌓기 위)이라 숨지 않는다. */
const _WIN_Z_LAYERS = ['chatOverlay', 'focusSettingsPanel', 'myStatusChip', 'focusLogOverlay',
                       'bellWin', 'myHomeOverlay', 'mhGbOverlay', 'pkOverlay', 'creatorOverlay', 'raceOverlay'];
let _winZTop = WIN_Z_MIN - 1;
function _winZOf(el){
  const v = parseInt(el && el.style && el.style.zIndex, 10);
  return isFinite(v) ? v : 0;
}
function bringWinToFront(id){
  const el = document.getElementById(id);
  if(!el) return;
  if(_winZTop >= WIN_Z_MIN && _winZOf(el) === _winZTop) return;   // 이미 맨 앞 — 건드릴 것 없다
  if(_winZTop >= WIN_Z_MAX){
    /* 올리려는 창은 빼고 다시 매긴다 — 넣으면 창이 칸 수(10)만큼일 때 마지막 창이 천장을 넘는다(93 = 꾸미기 자리). */
    const order = _WIN_Z_LAYERS.map(x=>document.getElementById(x)).filter(e2=>e2 && e2!==el)
                               .sort((a,b)=>_winZOf(a)-_winZOf(b));
    _winZTop = WIN_Z_MIN - 1;
    order.forEach(e2=>{ e2.style.zIndex = String(++_winZTop); });
  }
  _winZTop++;
  el.style.zIndex = String(_winZTop);
}
/* 누른 순간 올린다 — click 이 아니라 pointerdown 캡처다.
   ① 창 안의 버튼이 stopPropagation 을 해도 캡처 단계는 먼저 지나간다(칩 버튼들이 전부 그렇다).
   ② 드래그로 창을 옮기기 시작할 때도 그 창이 앞으로 와야 한다 — 손을 뗄 때 올라오면 늦다.
   ⚠️ #chatOverlay 는 화면 전체를 덮지만 pointer-events:none 이라 빈 곳을 눌러도 경로에 안 들어온다.
     여기서 따로 걸러낼 필요가 없는 이유다. */
/* 열면 맨 앞 — 목록의 창이 «안 보임 → 보임» 이 되는 순간 올린다(누를 때만 올리면 나중에 연 창이 먼저 있던 창 뒤에 깔린다 — B-1016-4).
   ★ 여는 길(버튼 · F 키 · 다른 창이 여는 경우)마다 훅을 심지 않고 class · style 을 관찰한다 — ESC 스택과 같은 까닭(어느 길로 열려도 맞는다).
   ⚠️ 보임은 계산된 display · visibility 로 본다(창마다 .on · .hidden · style.display 가 섞여 있다). 올릴 때 바꾸는 style.zIndex 는 보임을 안 바꿔 되풀이되지 않는다. */
function _winShown(el){
  try{ const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; }catch(_){ return false; }
}
_WIN_Z_LAYERS.forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  let shown = _winShown(el);
  try{
    new MutationObserver(()=>{ const now = _winShown(el); if(now && !shown) bringWinToFront(id); shown = now; })
      .observe(el, { attributes:true, attributeFilter:['class','style'] });
  }catch(_){}
});
document.addEventListener('pointerdown', e=>{
  const path = (e.composedPath && e.composedPath()) || [e.target];
  for(let i = 0; i < _WIN_Z_LAYERS.length; i++){
    const el = document.getElementById(_WIN_Z_LAYERS[i]);
    if(el && path.indexOf(el) >= 0){ bringWinToFront(_WIN_Z_LAYERS[i]); return; }
  }
}, true);

/* ⎋ ESC 스택 — **연타하면 열려 있는 창이 하나씩 닫힌다.**

   [무엇을 푸는가] ESC 핸들러가 16곳에 흩어져 있고 전부 같은 모양이었다 —
     `document` 캡처에서 "내가 열려 있나?" 를 보고 `stopPropagation()` 으로 한 번에 하나만 닫는다.
     그래서 실제로 닫히는 순서는 **핸들러가 등록된 순서**(= 파일에 적힌 순서)였고, 창을 어떤
     순서로 열었는지는 전혀 반영되지 않았다. 마이홈·플레이리스트·설정창·알림창·포커스기록을
     다 열어 두고 ESC 를 연타하면 늘 같은 순서로만 닫혔다(제보).

   ★ 그래서 **순서를 아는 곳을 하나 만든다.** 창이 열리면 쌓고, 닫히면 뺀다. ESC 는 이 스택의
     꼭대기 하나만 닫는다. 흩어진 16곳을 갈아엎지 않고, **요청된 다섯 개만** 여기에 태운다 —
     나머지는 예전 캡처 핸들러 그대로다(이 핸들러가 아무것도 안 닫으면 전파를 끊지 않으므로
     그쪽 규약이 그대로 살아 있다).

   ★ **여닫힘을 훅으로 잡지 않고 DOM 을 관찰한다.** 이 창들은 닫히는 길이 여러 개다 —
     ✕ 버튼 · 바깥 클릭 · _closeChipPopups · 오피스 모드 숨김 · 다른 창이 열면서 닫는 경우.
     그 자리를 다 찾아 훅을 심으면 반드시 한 곳을 빠뜨리고, 그러면 스택에 유령이 남아
     ESC 한 번이 헛돈다. MutationObserver 로 class·style 만 보면 **어느 길로 닫혀도** 맞는다.
     (이 창들의 class/style 은 자주 바뀌지 않으므로 비용은 사실상 0이다.)

   ⚠️ 입력칸에서는 손대지 않는다 — 캡처 단계는 입력칸 자신의 keydown 보다 **먼저** 지나가므로,
     여기서 창을 닫아버리면 bio 편집·검색어 입력의 "ESC = 취소" 가 영영 안 먹는다.
     (플레이리스트의 옛 ESC 핸들러가 실제로 그랬다 — bio 를 고치다 ESC 를 누르면 창이 닫혔다.)
   ⚠️ ESC_YIELD_SEL — **창 안에 사는 하위 UI**가 열려 있으면 양보한다. 그것들은 자기 ESC 핸들러가
     따로 있고, 창보다 먼저 닫히는 게 맞다(마이홈 친구검색 → 검색만 닫히고 마이홈은 남는다).
     새 하위 UI 를 만들면 여기에 줄을 더할 것. */
const ESC_CLOSE_ORDER = 'lifo';   // 'lifo' = 마지막에 연 것부터 · 'fifo' = 처음 연 것부터. 이 한 단어가 방향의 전부다.
const ESC_YIELD_SEL = [
  '#mhFriendSearch.on',       // 🔍 마이홈 친구검색 줄 — 자기 캡처 핸들러가 먼저 닫는다
  '#myHomeOverlay.on #mhRoomPreview.mhd-ff-arrange',   // 📂 폴더 자유배치 중 — folder-free.js 가 window 캡처에서 먼저 끝낸다
].join(', ');
const _escWins  = [];   // 등록된 창 — [{key, el, isOpen, close}]
const _escOrder = [];   // 열린 순서대로 쌓인 key
/* 창 하나를 스택에 태운다. isOpen 은 **DOM 을 실제로 읽어** 판정할 것(플래그를 따로 들면 어긋난다).
   ⚠️ 창마다 여닫는 방식이 다르다 — .hidden 클래스 · .on 클래스 · style.display 세 가지가 섞여 있어서
     여기서 하나로 통일하지 않고 각자 자기 방식을 넘긴다(통일하려면 다섯 창을 다 고쳐야 한다). */
function escRegisterWindow(w){
  if(!w || !w.el || typeof w.isOpen !== 'function' || typeof w.close !== 'function') return;
  if(_escWins.some(x => x.key === w.key)) return;   // 두 번 등록되면 ESC 한 번에 두 번 닫힌다
  _escWins.push(w);
  try{
    new MutationObserver(_escSync).observe(w.el, { attributes:true, attributeFilter:['class','style'] });
  }catch(_){}
  _escSync();   // 이미 열려 있는 상태로 등록될 수도 있다
}
/* 스택을 DOM 과 맞춘다 — 새로 열린 것은 뒤에 쌓고, 닫힌 것은 뺀다.
   ★ 이 함수가 **유일한 진실 공급원**이다. 관찰이 한 번 새더라도 ESC 를 누를 때 다시 부르므로
     스택이 실제 화면과 어긋난 채로 굳지 않는다. */
function _escSync(){
  _escWins.forEach(w=>{
    let open = false;
    try{ open = !!w.isOpen(); }catch(_){}
    const i = _escOrder.indexOf(w.key);
    if(open && i < 0) _escOrder.push(w.key);
    else if(!open && i >= 0) _escOrder.splice(i, 1);
  });
}
function _escTop(){
  _escSync();
  if(!_escOrder.length) return null;
  const key = (ESC_CLOSE_ORDER === 'fifo') ? _escOrder[0] : _escOrder[_escOrder.length - 1];
  return _escWins.find(w => w.key === key) || null;
}
/* 지금 글자를 넣고 있는 칸인가 — input·textarea·select·contenteditable. */
function _escEditable(t){
  if(!t) return false;
  if(t.isContentEditable) return true;
  const tag = String(t.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
document.addEventListener('keydown', e=>{
  if(e.key !== 'Escape' || e.defaultPrevented) return;
  if(_escEditable(e.target)) return;
  try{ if(ESC_YIELD_SEL && document.querySelector(ESC_YIELD_SEL)) return; }catch(_){}
  const w = _escTop();
  if(!w) return;                        // 태운 창이 하나도 안 열려 있다 — 옛 핸들러들에게 그대로 넘긴다
  e.preventDefault(); e.stopPropagation();
  try{ w.close(); }catch(_){}
  _escSync();                           // 관찰 콜백을 기다리지 않고 즉시 반영 — 연타가 빠를 때를 위해
}, true);

return {
  _escEditable,
  bringWinToFront,
  escRegisterWindow,
};
}

const api = { createWinStack };
if(typeof window !== 'undefined') window.TwWinStack = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
