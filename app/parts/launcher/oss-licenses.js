/* oss-licenses.js — 📄 오픈소스 라이선스 창(«개인정보 처리방침» 옆 링크 둘 — 설정 › 시스템 › 프로그램 정보 · 내 정보 맨 아래 · 검사 sim-oss-licenses.js)
   ・글은 scripts/third-party-notices.js 가 만든 app/licenses/oss-notices.js(window.TwOssNoticesText, 130KB 안팎) — 처음 열 때만 싣는다(켤 때마다 읽지 않게).
   ・창 크기는 고정(OSS_WIN)이고 글은 창 안에서만 스크롤한다 — 글 길이 · 긴 줄이 창을 키우지 않게(pre-wrap · 단어 끊기).
   ・못 실으면 «불러오지 못했어요» — 빈 창과 구분한다.
   ⚠️ 글은 textContent 로만 넣는다(라이선스 원문에 < > 가 있다).
   ⚠️ 껍데기는 app-popup-ov + pointer-events:none — 마우스 통과 목록(UI_HIT_SEL)에 걸리고 화면 전체를 막지 않는다(friend-visit.js 와 같다). */
(function(){
'use strict';

const NOTICES_SRC = 'licenses/oss-notices.js';
const OV_ID = 'ossLicensesOverlay';
/* 창 크기 — 화면이 작으면 화면 안으로만 줄어든다 */
const OSS_WIN = { width: 440, height: 460, maxW: '92vw', maxH: '80vh' };

/* 글 싣기 — 이미 실렸으면 그대로 · 못 실으면 null */
function loadNotices(doc, win){
  if(typeof win.TwOssNoticesText === 'string') return Promise.resolve(win.TwOssNoticesText);
  return new Promise((resolve) => {
    const s = doc.createElement('script');
    s.src = 'licenses/oss-notices.js';   // NOTICES_SRC 와 같은 고정 주소(밖에서 받지 않는다)
    s.onload = () => resolve(typeof win.TwOssNoticesText === 'string' ? win.TwOssNoticesText : null);
    s.onerror = () => resolve(null);
    doc.head.appendChild(s);
  });
}

function createOssLicenses(deps){
  const doc = deps.document;
  const win = deps.window;
  const links = deps.links;   // 여는 링크(a 요소) 목록 — 없는 것은 건너뛴다
  const load = deps.load || (() => loadNotices(doc, win));
  let ov = null;

  function isOpen(){ return !!ov; }
  function close(){ if(ov){ ov.remove(); ov = null; } }

  function open(){
    if(ov) return;
    ov = doc.createElement('div');
    ov.id = OV_ID;
    ov.className = 'app-popup-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:var(--z-dialog-program);background:none;display:flex;align-items:center;justify-content:center;pointer-events:none;';
    const box = doc.createElement('div');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '오픈소스 라이선스');
    box.style.cssText = 'pointer-events:auto;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;' +
      'width:' + OSS_WIN.width + 'px;height:' + OSS_WIN.height + 'px;max-width:' + OSS_WIN.maxW + ';max-height:' + OSS_WIN.maxH + ';' +
      'background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);' +
      'box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 4px 4px 0 rgba(0,0,0,.35);font-family:var(--tw-font-legacy);';
    const title = doc.createElement('div');
    title.style.cssText = 'flex:none;background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;';
    title.textContent = '📄 오픈소스 라이선스';
    const body = doc.createElement('pre');
    body.style.cssText = 'flex:1 1 auto;min-height:0;margin:10px 12px 0;padding:8px 10px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;' +
      'background:#fff;color:var(--ink);border:2px solid;border-color:var(--win-lo) var(--win-hi) var(--win-hi) var(--win-lo);font-size:10.5px;line-height:1.5;font-family:var(--tw-font-legacy);';
    body.textContent = '불러오는 중…';
    const foot = doc.createElement('div');
    foot.style.cssText = 'flex:none;display:flex;justify-content:flex-end;padding:8px 12px 12px;';
    const closeBtn = doc.createElement('button');
    closeBtn.className = 'lc-btn ghost';
    closeBtn.style.cssText = 'min-width:70px;margin:0;';
    closeBtn.textContent = '닫기';
    closeBtn.onclick = close;
    foot.appendChild(closeBtn);
    box.append(title, body, foot);
    box.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } });
    ov.appendChild(box);
    doc.body.appendChild(ov);
    try{ closeBtn.focus(); }catch(_){}
    const mine = ov;
    return load().then((text) => {
      if(ov !== mine) return;   // 싣는 사이 닫혔다
      body.textContent = text || '불러오지 못했어요 — 앱을 다시 켠 뒤 열어 주세요.';
      body.scrollTop = 0;
    });
  }

  for(const a of links){
    if(!a) continue;
    a.addEventListener('click', (e) => { e.preventDefault(); open(); });
  }
  return { open, close, isOpen };
}

const api = { OSS_WIN, NOTICES_SRC, loadNotices, createOssLicenses };
if(typeof window !== 'undefined') window.TwOssLicenses = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
