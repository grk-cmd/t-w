/* mac-tooltip.js — 💬 맥에서 마우스를 올리면 뜨는 설명(title)을 앱이 직접 그린다 (검사 sim-mac-tooltip.js)
   [왜] 실행 화면 창은 캐릭터가 늘 보이게 «항상 위»(overlay-mac.js TOP_LEVEL)로 뜨는데, 맥 OS 툴팁은
     그보다 낮은 단계의 창이라 앱 창 뒤로 깔려 안 보인다. 윈도우는 OS 툴팁이 맨 위라 손대지 않는다(맥에서만 건다).
   [어떻게] 마우스가 [title] 요소에 들어가면 title 을 잠시 data-tw-tip 으로 옮겨(OS 툴팁이 안 뜨게) 같은 글을 화면 안 말풍선(#twMacTip)으로
     그리고, 나가면 title 을 되돌린다 — 화면 코드(title= · .title =)는 그대로 쓴다.
   ⚠️ 마우스가 올라가 있는 동안 그 요소의 title 은 비어 있다. 그 사이 코드가 title 을 새로 쓰면 새 값을 살린다(되돌릴 때 덮지 않는다).
   [자식 창] 방명록 · 디자인 창도 같은 단계라 같은 일이 생긴다 — 열 때 installChild(창 문서, 창) 로 건다(맥이 아니면 안 건다).
     말풍선 모양(CSS)은 이 파일 한 곳에 두고 거는 문서마다 넣는다 — 자식 창은 메인 HTML 의 style 을 못 본다.
   받는 것 없음. 내보냄: window.TwMacTooltip = { isMac, place, install, installChild }. 싣기만 하면 맥에서 스스로 건다 — app.js 보다 먼저 싣는 classic script. */
(function(){

const DELAY_MS = 450;   // OS 툴팁처럼 잠깐 머문 뒤에 — 지나가기만 해도 번쩍이지 않게
const GAP = 14;         // 커서와 말풍선 사이
const EDGE = 6;         // 화면 가장자리 여유
const KEY = 'twTip';    // data-tw-tip — 떼어 둔 title
const CSS_ID = 'twMacTipCss';
/* 토스트와 같은 «쪽지» 모양 · 모든 창 위(10000) · 누르기를 막지 않음. 글꼴 토큰이 없는 자식 창은 뒤 값으로 */
const CSS = '#twMacTip{position:fixed;z-index:10000;display:none;pointer-events:none;max-width:320px;padding:3px 7px;white-space:pre-line;word-break:break-word;'
  + "background:#FFFFE1;color:#000;border:1px solid #000;font-size:12px;line-height:1.45;font-family:var(--tw-font-legacy, Tahoma,'Malgun Gothic',sans-serif);"
  + 'box-shadow:var(--win-drop-el, 2px 2px 0 rgba(0,0,0,.3));}'
  + '#twMacTip.on{display:block;}';

function isMac(nav){
  if(!nav) return false;
  return /Mac/i.test(nav.platform || '') || /Mac OS X/i.test(nav.userAgent || '');
}
/* 커서 오른쪽 아래 — 화면 밖으로 나가면 왼쪽 · 위로 접는다 */
function place(mx, my, w, h, vw, vh){
  let x = mx + GAP, y = my + GAP + 6;
  if(x + w > vw - EDGE) x = Math.max(EDGE, vw - EDGE - w);
  if(y + h > vh - EDGE) y = Math.max(EDGE, my - GAP - h);
  return { x, y };
}

function install(doc, win){
  if(!doc || !win || doc.__twMacTip) return false;
  doc.__twMacTip = true;
  if(!doc.getElementById(CSS_ID)){
    const st = doc.createElement('style'); st.id = CSS_ID; st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  let cur = null, tip = null, timer = null, mx = 0, my = 0;

  const tipEl = () => {
    if(!tip){ tip = doc.createElement('div'); tip.id = 'twMacTip'; tip.setAttribute('role', 'tooltip'); doc.body.appendChild(tip); }
    return tip;
  };
  function hide(){
    if(timer){ win.clearTimeout(timer); timer = null; }
    if(tip) tip.classList.remove('on');
  }
  /* 지금 요소를 놓는다 — 그 사이 코드가 title 을 새로 썼으면 그 값을 살린다 */
  function release(){
    hide();
    if(!cur) return;
    if(!cur.hasAttribute('title') && cur.dataset[KEY] != null) cur.setAttribute('title', cur.dataset[KEY]);
    delete cur.dataset[KEY];
    cur = null;
  }
  function show(){
    timer = null;
    if(!cur || !cur.isConnected) return;
    if(cur.hasAttribute('title')){ cur.dataset[KEY] = cur.getAttribute('title'); cur.removeAttribute('title'); }
    const text = cur.dataset[KEY];
    if(!text) return;
    const t = tipEl();
    t.textContent = text;
    t.classList.add('on');
    const p = place(mx, my, t.offsetWidth, t.offsetHeight, win.innerWidth, win.innerHeight);
    t.style.left = p.x + 'px';
    t.style.top = p.y + 'px';
  }
  doc.addEventListener('mouseover', (e) => {
    mx = e.clientX; my = e.clientY;
    const el = e.target && e.target.closest ? e.target.closest('[title],[data-tw-tip]') : null;
    if(el === cur) return;
    release();
    if(!el || !el.getAttribute('title')) return;   // 빈 title 은 OS 도 안 띄운다
    cur = el;
    cur.dataset[KEY] = cur.getAttribute('title');
    cur.removeAttribute('title');
    timer = win.setTimeout(show, DELAY_MS);
  }, true);
  doc.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, true);
  doc.addEventListener('mouseout', (e) => {
    if(!cur) return;
    const to = e.relatedTarget;
    if(to && cur.contains(to)) return;   // 안쪽 자식으로 옮겨 간 것
    release();
  }, true);
  // 누르기 · 휠 · 키 · 창을 떠남 — OS 툴팁처럼 말풍선만 접는다(title 은 나갈 때 되돌린다)
  ['mousedown', 'wheel', 'keydown'].forEach(t => doc.addEventListener(t, hide, true));
  win.addEventListener('blur', hide);
  return true;
}

/* 자식 창(방명록 · 디자인) — 창을 열고 d.write · d.close 한 뒤에 부른다(document.open 이 리스너를 지운다) */
function installChild(doc, win){
  if(!win || !isMac(win.navigator)) return false;
  return install(doc, win);
}

const api = Object.freeze({ isMac, place, install, installChild });
if(typeof window !== 'undefined'){
  window.TwMacTooltip = api;
  if(isMac(window.navigator)) install(document, window);
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
