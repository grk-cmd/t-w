/* oss-licenses.js — 📄 오픈소스 라이선스 창(«개인정보 처리방침» 옆 링크 둘 — 설정 › 시스템 › 프로그램 정보 · 내 정보 맨 아래 · 검사 sim-oss-licenses.js)
   ・목록은 scripts/third-party-notices.js 가 만든 app/licenses/oss-notices.js(window.TwOssNotices — 원문까지 담아 크다) — 처음 열 때만 싣는다.
   ・한 줄 = 이름(누르면 시스템 브라우저로 홈페이지) · 판 · 라이선스 칩 · [원문] 펼치기. 하위 패키지는 그 줄 원문 안에 접혀 있다.
   ・창 크기는 고정(OSS_WIN)이고 목록 · 펼친 원문은 창 안에서만 스크롤한다 — 글 길이 · 긴 줄이 창을 키우지 않게.
   ・창은 처음 열 때 한 번 만들고 그 뒤로는 보이기 · 숨기기만 한다 — ESC 스택(escRegisterWindow)이 늘 있는 요소를 지켜봐야 해서.
     프로그램 설정 위에서 연 이 창 안 클릭이 설정을 닫지 않게 하는 예외는 shared/outside-close.js 에 있다.
   ・못 실으면 «불러오지 못했어요» — 빈 목록과 구분한다.
   ⚠️ 이름 · 원문은 textContent 로만 넣는다(원문에 < > 가 있다). 주소는 href 에 넣지 않고 누를 때 openUrl 로만 연다.
   ⚠️ 껍데기는 app-popup-ov + pointer-events:none — 마우스 통과 목록(UI_HIT_SEL)에 걸리고 화면 전체를 막지 않는다(friend-visit.js 와 같다). */
(function(){
'use strict';

const NOTICES_SRC = 'licenses/oss-notices.js';
const OV_ID = 'ossLicensesOverlay';
const STYLE_ID = 'ossLicensesStyle';
/* 창 크기 — 화면이 작으면 화면 안으로만 줄어든다 */
const OSS_WIN = { width: 440, height: 460, maxW: '92vw', maxH: '80vh' };

const CSS = [
  '#' + OV_ID + ' .oss-box{pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;width:' + OSS_WIN.width + 'px;height:' + OSS_WIN.height + 'px;max-width:' + OSS_WIN.maxW + ';max-height:' + OSS_WIN.maxH + ';background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), var(--win-drop);font-family:var(--tw-font-ui);}',
  '#' + OV_ID + ' .oss-title{flex:none;background:var(--win-title-grad);color:var(--win-title-ink);padding:5px 8px;font-size:12px;font-weight:bold;}',
  '#' + OV_ID + ' .oss-cap{flex:none;margin:8px 12px 6px;font-size:11px;color:var(--ink-soft);line-height:1.5;}',
  '#' + OV_ID + ' .oss-list{flex:1 1 auto;min-height:0;margin:0 12px;overflow-y:auto;overflow-x:hidden;background:var(--tw-bg-field);border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);}',
  '#' + OV_ID + ' .oss-row{padding:6px 8px;border-bottom:1px solid var(--win-face-2);}',
  '#' + OV_ID + ' .oss-top{display:flex;align-items:center;gap:6px;min-width:0;min-height:24px;}',
  '#' + OV_ID + ' .oss-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:24px;background:none;border:none;padding:0;font:inherit;font-size:12px;font-weight:bold;color:var(--win-select);text-decoration:underline;cursor:pointer;text-align:left;}',
  '#' + OV_ID + ' .oss-name:disabled{color:var(--ink);text-decoration:none;cursor:default;}',
  '#' + OV_ID + ' .oss-ver{flex:none;font-size:10px;color:var(--ink-soft);font-family:var(--win-font-num);}',
  '#' + OV_ID + ' .oss-sp{flex:1 1 auto;}',
  '#' + OV_ID + ' .oss-chip{flex:none;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;line-height:16px;padding:0 6px;border:1px solid currentColor;color:var(--ink-soft);background:var(--win-face-2);}',
  '#' + OV_ID + ' .oss-more{flex:none;min-height:24px;min-width:44px;background:none;border:none;padding:0 4px;font:inherit;font-size:11px;color:var(--ink-soft);cursor:pointer;}',
  '#' + OV_ID + ' .oss-note{margin-top:2px;font-size:10px;color:var(--ink-soft);line-height:1.5;overflow-wrap:anywhere;}',
  '#' + OV_ID + ' .oss-raw{margin:6px 0 0;max-height:150px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;line-height:1.5;padding:6px 8px;background:var(--win-face-2);color:var(--ink);font-family:var(--tw-font-ui);}',
  '#' + OV_ID + ' .oss-msg{padding:16px 12px;font-size:12px;color:var(--ink-soft);text-align:center;}',
  '#' + OV_ID + ' .oss-foot{flex:none;display:flex;justify-content:flex-end;padding:8px 12px 12px;}',
].join('\n');

/* 목록 싣기 — 이미 실렸으면 그대로 · 못 실으면 null */
function loadNotices(doc, win){
  const ok = () => win.TwOssNotices && Array.isArray(win.TwOssNotices.items);
  if(ok()) return Promise.resolve(win.TwOssNotices);
  return new Promise((resolve) => {
    const s = doc.createElement('script');
    s.src = NOTICES_SRC;
    s.onload = () => resolve(ok() ? win.TwOssNotices : null);
    s.onerror = () => resolve(null);
    doc.head.appendChild(s);
  });
}

function createOssLicenses(deps){
  const doc = deps.document;
  const win = deps.window;
  const links = deps.links;       // 여는 링크(a 요소) 목록 — 없는 것은 건너뛴다
  const openUrl = deps.openUrl;   // 주소를 시스템 기본 브라우저로 연다
  const escRegisterWindow = deps.escRegisterWindow;   // ESC 로 맨 위 창부터 닫는 스택(shared/win-stack.js)
  const load = deps.load || (() => loadNotices(doc, win));
  let ov = null;
  let loading = null;   // 목록 싣기 Promise — 한 번만

  function el(tag, cls, text){
    const e = doc.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }

  function ensureStyle(){
    if(doc.getElementById(STYLE_ID)) return;
    const st = el('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function row(item){
    const r = el('div', 'oss-row');
    const top = el('div', 'oss-top');
    const name = el('button', 'oss-name', item.name);
    name.type = 'button';
    if(item.url){ name.title = item.url; name.onclick = () => openUrl(item.url); }
    else name.disabled = true;
    const more = el('button', 'oss-more', '원문 ▾');
    more.type = 'button';
    let raw = null;
    more.onclick = () => {
      if(raw){ raw.remove(); raw = null; more.textContent = '원문 ▾'; return; }
      raw = el('pre', 'oss-raw', item.raw || '');
      r.appendChild(raw);
      more.textContent = '원문 ▴';
    };
    top.append(name);
    if(item.version) top.append(el('span', 'oss-ver', item.version));
    top.append(el('span', 'oss-sp'), el('span', 'oss-chip', item.license), more);
    r.appendChild(top);
    if(item.note) r.appendChild(el('div', 'oss-note', item.note));
    return r;
  }

  function isOpen(){ return !!ov && ov.style.display !== 'none'; }
  function close(){ if(ov) ov.style.display = 'none'; }

  function build(){
    ensureStyle();
    ov = el('div', 'app-popup-ov');
    ov.id = OV_ID;
    ov.style.cssText = 'position:fixed;inset:0;z-index:var(--z-dialog-program);background:none;display:none;align-items:center;justify-content:center;pointer-events:none;';
    const box = el('div', 'oss-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '오픈소스 라이선스');
    const cap = el('div', 'oss-cap', '불러오는 중…');
    const list = el('div', 'oss-list');
    const foot = el('div', 'oss-foot');
    const closeBtn = el('button', 'lc-btn ghost', '닫기');
    closeBtn.style.cssText = 'min-width:70px;margin:0;';
    closeBtn.onclick = close;
    foot.appendChild(closeBtn);
    box.append(el('div', 'oss-title', '📄 오픈소스 라이선스'), cap, list, foot);
    ov.appendChild(box);
    doc.body.appendChild(ov);
    escRegisterWindow({ key: 'ossLicenses', el: ov, isOpen, close });
    return { cap, list, closeBtn };
  }

  let parts = null;
  function open(){
    if(!ov) parts = build();
    ov.style.display = 'flex';
    try{ parts.closeBtn.focus(); }catch(_){}
    if(!loading){
      loading = load().then((data) => {
        if(!data){
          loading = null;   // 다음에 열 때 다시 해 본다
          parts.cap.textContent = '';
          parts.list.textContent = '';
          parts.list.appendChild(el('div', 'oss-msg', '불러오지 못했어요 — 앱을 다시 켠 뒤 열어 주세요.'));
          return;
        }
        parts.cap.textContent = '이 프로그램이 쓰는 오픈소스 ' + data.items.length + '개예요. 이름을 누르면 홈페이지가 열려요.';
        parts.list.textContent = '';
        for(const it of data.items) parts.list.appendChild(row(it));
        parts.list.scrollTop = 0;
      });
    }
    return loading;
  }

  for(const a of links){
    if(!a) continue;
    a.addEventListener('click', (e) => { e.preventDefault(); open(); });
  }
  return { open, close, isOpen };
}

const api = { OSS_WIN, NOTICES_SRC, CSS, loadNotices, createOssLicenses };
if(typeof window !== 'undefined') window.TwOssLicenses = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
