/* gl-context.js — 🧯 3D 장치(WebGL 렌더러)를 만드는 단 한 곳(app.js 분리 F1)
   [왜] `new THREE.WebGLRenderer` 가 화면마다 흩어져 있었고, 그래픽 연결을 못 얻으면 그 줄이 던져 창을 여는 함수가 중간에 멈췄다(창이 반쯤 열린 채).
     메인 무대(stage.js)만 B-1114-5 로 안내를 붙였고 미리보기 여덟 곳은 그대로였다.
   ・make(canvas, opts, role, extra) — role 'main': 못 만들면 extra.guard(메인 안내 · 던짐)에 맡긴다(옛 동작 그대로).
     role 'preview': 못 만들면 던지지 않고 null 을 돌려주고, 실패 번호(E-SYS-06)로 알리고, 그 캔버스를 감싼 칸 안에 «다시 시도» 안내를 그린다. 부르는 쪽은 맨 앞에서 `if(!r) return`.
   ・extra: label(안내에 쓸 이름 — 진단 줄에만) · retry(안내 [다시 시도] 가 부를 함수) · silent 아님(번호 알림은 늘 낸다).
   ・만들기에 성공하면 같은 캔버스에 남아 있던 안내를 지운다(다시 시도 · 다시 열기).
   ・검사: checks/sim-gl-context.js — `new THREE.WebGLRenderer` 가 이 파일 밖에 있으면 빨강(개발용 app/fx-preview.html 만 뺀다).
   deps: makeRenderer(opts) · doc · 번호 알림 함수 · note(진단 한 줄) — 모두 부를 때 찾는다. */
(function(){
'use strict';

const NOTICE_CLASS = 'gl-ctx-notice';
const TEXT = { body: '3D 미리보기를 불러오지 못했어요', retry: '다시 시도' };

function createGlContext(deps){
  const doc = deps.doc;

  function dropNotice(canvas){
    const p = canvas && canvas.parentElement;
    if(!p || !p.querySelectorAll) return;
    p.querySelectorAll('.' + NOTICE_CLASS).forEach(n => { if(n.getAttribute('data-for') === (canvas.id || '')) n.remove(); });
  }

  /* 캔버스를 감싼 칸 안 가운데에 안내 + [다시 시도]. 칸이 없으면(화면 밖 캔버스) 그리지 않는다 */
  function showNotice(canvas, retry){
    const p = canvas && canvas.parentElement;
    if(!p) return null;
    dropNotice(canvas);
    const box = doc.createElement('div');
    box.className = NOTICE_CLASS;
    box.setAttribute('data-for', canvas.id || '');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;text-align:center;font-size:12px;line-height:1.4;background:var(--win-face);color:var(--win-ink,#000);z-index:5;';
    const t = doc.createElement('div'); t.textContent = TEXT.body; box.appendChild(t);
    if(retry){
      const b = doc.createElement('button'); b.type = 'button'; b.textContent = TEXT.retry;
      b.addEventListener('click', () => { box.remove(); retry(); });
      box.appendChild(b);
    }
    if(p.style && !p.style.position){ try{ if(doc.defaultView && doc.defaultView.getComputedStyle(p).position === 'static') p.style.position = 'relative'; }catch(_){} }
    p.appendChild(box);
    return box;
  }

  function make(canvas, opts, role, extra){
    extra = extra || {};
    if(role === 'main') return extra.guard(() => deps.makeRenderer(opts));
    try{
      const r = deps.makeRenderer(opts);
      dropNotice(canvas);
      return r;
    }catch(err){
      try{ deps.note('[WebGL] 미리보기 3D 를 못 만듦 — ' + (extra.label || (canvas && canvas.id) || '?')); }catch(_){}
      try{ deps.notifyError('E-SYS-06', err); }catch(_){}
      showNotice(canvas, extra.retry);
      return null;
    }
  }
  return { make, showNotice, dropNotice };
}

const api = { createGlContext, NOTICE_CLASS, TEXT };
if(typeof window !== 'undefined'){
  /* 렌더러에서는 하나를 만들어 바로 쓴다 — THREE · TwErrorCodes · companion 은 부를 때 찾는다 */
  const g = createGlContext({
    makeRenderer: (opts) => new THREE.WebGLRenderer(opts),
    doc: document,
    notifyError: (...a) => TwErrorCodes.notify(...a),
    note: (m) => { if(window.companion && companion.diagNote) companion.diagNote(m); },
  });
  api.make = g.make; api.showNotice = g.showNotice; api.dropNotice = g.dropNotice;
  window.TwGlContext = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
