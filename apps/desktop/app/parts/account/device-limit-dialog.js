/* device-limit-dialog.js — 🖥️ «등록할 수 있는 PC를 다 썼어요» 확인창 (검사 checks/sim-device-limit-dialog.js)
   [왜] 서버가 정한 상한까지 PC 를 등록한 계정으로 새 PC 에서 들어오면 가장 오래 안 쓴 기기를 지울지 사람에게 묻는다(account/device-register.js 가 부른다). 저절로 지우지 않는다.
   [모양] 디자인 시스템 확인창(260px · 확인창에는 이모지를 쓰지 않는다) — 제목 질문 + 버튼 둘(오른쪽 정렬: [취소] · [지우고 사용]) · 기본 포커스는 [취소] · Esc = 취소 ·
     role="alertdialog" + aria-labelledby. 껍데기는 app-popup-ov + pointer-events:none(클릭 통과 목록에 걸리고 화면 전체를 막지 않는다).
     층은 기기 안내 화면(#deviceSessionOverlay)과 같은 --z-gate-device 로 그 뒤에 붙인다 — «다시 등록» 에서 그 화면 위에 뜬다.
   [글] 대수는 쓰지 않는다 — 상한은 서버가 정한다. 질문은 부르는 쪽(device-register.js limitQuestion)이 만든 글을 받아 textContent 로만 넣는다(HTML 로 읽지 않는다).
   classic script — app.js 보다 먼저 싣는다(window.TwDeviceLimitDialog). */
(function(){
'use strict';

const TEXT = Object.freeze({
  title: '등록할 수 있는 PC를 다 썼어요',
  cancel: '취소',
  ok: '지우고 사용',
});

/** @param {{ document: Document }} deps */
function createDeviceLimitDialog(deps){
  const doc = deps.document;
  let open = null;   // 떠 있는 창 { ov, done }

  function close(answer){
    if(!open) return;
    const o = open; open = null;
    try{ o.ov.remove(); }catch(_){}
    o.done(answer);
  }
  function el(tag, css, text){
    const e = doc.createElement(tag);
    if(css) e.style.cssText = css;
    if(text != null) e.textContent = text;
    return e;
  }
  /* 묻기(question — 묻는 글 한 줄) — [지우고 사용] true · [취소] · Esc false. 떠 있는 창이 있으면 그 창을 취소로 닫고 새로 띄운다 */
  function ask(question){
    close(false);
    return new Promise((done) => {
      const ov = el('div', 'position:fixed;inset:0;z-index:var(--z-gate-device);background:none;display:flex;align-items:center;justify-content:center;pointer-events:none;');
      ov.className = 'app-popup-ov';   // ⚠️ 마우스 통과 목록(UI_HIT_SEL) 매칭용 — 빼지 말 것
      const box = el('div', 'pointer-events:auto;width:260px;max-width:92vw;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 4px 4px 0 rgba(0,0,0,.35);font-family:var(--tw-font-legacy);');
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-labelledby', 'devLimitQ');
      box.appendChild(el('div', 'background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;', TEXT.title));
      const body = el('div', 'padding:14px 14px 4px;color:var(--ink);font-size:12px;line-height:1.6;');
      const q = el('b', 'display:block;font-size:14px;line-height:1.45;margin-bottom:6px;', String(question || ''));
      q.id = 'devLimitQ';
      body.appendChild(q);
      box.appendChild(body);
      const acts = el('div', 'display:flex;gap:6px;padding:8px 14px 14px;justify-content:flex-end;');
      const no = el('button', 'min-width:70px;margin-top:0;width:auto;', TEXT.cancel);
      no.className = 'lc-btn ghost'; no.setAttribute('data-a', 'no');
      const ok = el('button', 'min-width:90px;margin-top:0;width:auto;', TEXT.ok);
      ok.className = 'lc-btn'; ok.setAttribute('data-a', 'ok');
      acts.appendChild(no); acts.appendChild(ok);
      box.appendChild(acts);
      ov.appendChild(box);
      doc.body.appendChild(ov);
      open = { ov, done };
      no.onclick = () => close(false);
      ok.onclick = () => close(true);
      box.addEventListener('keydown', (e) => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(false); } });
      try{ no.focus(); }catch(_){}
    });
  }

  return { ask, isOpen: () => !!open };
}

const api = { TEXT, createDeviceLimitDialog };
if(typeof window !== 'undefined') window.TwDeviceLimitDialog = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
