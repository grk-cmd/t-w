/* help-tab.js — 📘 마이홈 «도움말» 탭: 왼쪽 목차(묶음 접고 펴기) · 오른쪽 도움말 웹 페이지(Hosting /help — 틀 안) · 못 불러옴 (검사 sim-help-tab.js)
   [왜] 사용법 글은 앱을 다시 내지 않고 고칠 수 있게 웹 페이지에 두고, 앱은 그 페이지를 칸 안에 보여 준다.
   ★ 목차는 앱에 박지 않는다 — 페이지(hosting/help/embed.js)가 «지금 편 · 목차» 를 보내 오면 그것으로 그린다.
     그래서 페이지 안 «이전 · 다음» 으로 옮겨도 왼쪽 표시가 따라간다. 받은 글은 textContent 로만 넣는다.
   ★ 틀은 sandbox(allow-scripts allow-same-origin) — 페이지 스크립트(테마 · 알림)와 같은 사이트 목차 받기만 된다.
     앱 문서(file://)와 출처가 달라 앱 쪽 window · companion 에 손대지 못한다. 틀이 옮겨 갈 수 있는 주소는
     main.js(will-frame-navigate)가 help-site.js 로 본다 · 앱 CSP frame-src 도 이 사이트 하나.
   ⚠️ 틀 안 HTTP 실패는 밖에서 안 보인다 — 연 뒤 LOAD_MS 안에 페이지 알림이 없으면 «못 불러옴» 으로 그린다.
   deps: getTheme() — 지금 앱 테마('default' | 'bubble', shared/theme.js) · 부를 때 읽는다.
   내놓음: enter(탭에 들어올 때) · themeChanged(테마를 바꾼 뒤) · state(검사용). */
(function(){
'use strict';

const LOAD_MS = 10000;

/** @param {{ getTheme: () => string }} deps */
function createHelpTab(deps){
const getTheme = deps.getTheme;
const helpSite = TwHelpSite;          // 📘 도움말 주소 · 알림 읽기(shared/help-site.js)

let _page = 'index';        // 지금 보는 편 — 페이지 알림이 오면 그 값으로
let _toc = null;            // 받은 목차 — null 이면 아직 못 받음
let _tocFailed = false;     // 페이지는 왔는데 목차가 어긋나거나 못 받음(«없음» 과 구분)
let _openGroup = -1;        // 펼친 묶음 번호
let _theme = null;          // 틀에 실어 연 테마 — 바뀌면 다시 연다
let _frame = null;
let _timer = null;
let _failed = false;

const $ = (id) => document.getElementById(id);

function _setFailed(on){
  _failed = on;
  const fail = $('mhHelpFail');
  if(fail) fail.classList.toggle('on', on);
  if(_frame) _frame.style.visibility = on ? 'hidden' : '';
}
function _load(page){
  const view = $('mhHelpView');
  if(!view) return;
  if(!_frame){
    _frame = document.createElement('iframe');
    _frame.id = 'mhHelpFrame';
    _frame.title = '도움말';
    _frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    _frame.setAttribute('referrerpolicy', 'no-referrer');
    view.appendChild(_frame);
  }
  _theme = getTheme();
  _setFailed(false);
  clearTimeout(_timer);
  _timer = setTimeout(()=>{
    _setFailed(true);
    TwErrorCodes.notify('E-MH-01');   // 번호는 글자 그대로(sim-error-codes 가 찾는다)
  }, LOAD_MS);
  _frame.src = helpSite.pageUrl(page, _theme);
}
function _groupOf(page){
  if(!_toc) return -1;
  return _toc.findIndex(g => g.pages.some(p => p.slug === page));
}
function _renderRail(){
  const rail = $('mhHelpRail');
  if(!rail) return;
  rail.textContent = '';
  if(!_toc){
    if(!_tocFailed) return;     // 아직 못 받음 — 비워 둔다(오른쪽이 «불러오는 중 · 못 불러옴» 을 맡는다)
    const n = document.createElement('div');
    n.className = 'mh-help-note';
    n.textContent = '목차를 불러오지 못했어요';
    rail.appendChild(n);
    return;
  }
  _toc.forEach((g, i)=>{
    const open = i === _openGroup;
    const gb = document.createElement('button');
    gb.type = 'button';
    gb.className = 'mh-help-grp' + (open ? ' open' : '');
    gb.textContent = (open ? '▾ ' : '▸ ') + g.group;
    gb.addEventListener('click', ()=>{ _openGroup = open ? -1 : i; _renderRail(); });
    rail.appendChild(gb);
    if(!open) return;
    g.pages.forEach(p=>{
      const eb = document.createElement('button');
      eb.type = 'button';
      eb.className = 'mh-help-ep' + (p.slug === _page ? ' on' : '');
      eb.title = p.slug + '. ' + p.title;
      const no = document.createElement('b');
      no.textContent = p.slug;
      eb.appendChild(no);
      eb.appendChild(document.createTextNode(p.title));
      eb.addEventListener('click', ()=>{ _page = p.slug; _renderRail(); _load(p.slug); });
      rail.appendChild(eb);
    });
  });
}
function _onMessage(e){
  if(!_frame || e.source !== _frame.contentWindow) return;
  const msg = helpSite.readMessage(e.origin, e.data);
  if(!msg) return;
  clearTimeout(_timer);
  _setFailed(false);
  _page = msg.page;
  if(msg.toc){ _toc = msg.toc; _tocFailed = false; }
  else if(!_toc) _tocFailed = true;
  const g = _groupOf(_page);
  if(g >= 0) _openGroup = g;
  _renderRail();
}
/* 탭에 들어올 때 — 처음이거나 테마가 바뀌었거나 못 불러왔으면 연다(이미 보던 편 그대로) */
function enter(){
  if(!_frame || _failed || _theme !== getTheme()) _load(_page);
  _renderRail();
}
/* 앱 테마를 바꾼 뒤 — 이미 연 틀만 새 테마로 다시 연다(안 연 탭은 들어올 때 연다) */
function themeChanged(){
  if(_frame && _theme !== getTheme()) _load(_page);
}

window.addEventListener('message', _onMessage);
const retry = $('mhHelpRetry');
if(retry) retry.addEventListener('click', ()=>_load(_page));

return {
  enter,
  themeChanged,
  state: ()=>({ page: _page, toc: _toc, tocFailed: _tocFailed, openGroup: _openGroup, theme: _theme, failed: _failed, src: _frame ? _frame.src : null }),
};
}

window.TwHelpTab = { createHelpTab, LOAD_MS };
})();
