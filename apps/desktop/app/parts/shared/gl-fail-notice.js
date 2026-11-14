/* gl-fail-notice.js — 🧯 3D(WebGL)를 못 쓸 때 «다시 켜기» 안내 (검사 sim-gl-recover.js)
   [왜] WebGL 을 못 만들면 app.js 가 첫 줄에서 죽어 런처 바탕만 덩그러니 남고, 사용자는 앱을 강제로 꺼야 했다(B-1114-5).
     죽기 전에 안내를 띄워 [다시 켜기] 로 GPU 를 새로 잡게 한다. 10분 안에 또 끊겨 gl-recover 가 다시 켜지 않을 때도 이 안내를 쓴다.
   ★ 창 크기는 main 이 정한다 — 화면을 다시 불러오면 main 이 먼저 런처 크기로 되돌리고(launcher/reload-reset.js),
     앱을 새로 켜면 처음부터 런처 크기라 이 안내는 창 안 가운데에 뜬다.
   ★ app.js 보다 먼저 싣는다(classic script · window.TwGlFailNotice). 바뀌지 않는 문구라 DOM 은 textContent 로만 만든다.
   deps: doc(document) · notifyError — 번호 · 오류 · note — 진단 한 줄 · relaunch · quit — 모두 부를 때 찾는다(app.js 가 죽은 뒤에도 돈다). */
(function(){
'use strict';

const OV_ID = 'glFailNotice';
const TEXT = {
  title: '🧯 그래픽(3D) 문제',
  body: '그래픽(3D)을 불러오지 못했어요. 앱을 다시 켜면 대부분 돌아와요.',
  relaunch: '다시 켜기',
  close: '닫기',
};

function createGlFailNotice(deps){
  const doc = deps.doc;
  let shown = false;

  /* kind: 'create'(처음 만들기 실패) · 'lost'(끊긴 채 안 돌아옴) — 기록에만 남는다 */
  function show(kind, err){
    if(shown) return false;
    shown = true;
    try{ deps.note('[WebGL] 안내 띄움 — ' + kind); }catch(_){}
    try{ deps.notifyError('E-SYS-05', err == null ? kind : err); }catch(_){}
    const ov = doc.createElement('div');
    ov.id = OV_ID;
    ov.className = 'app-popup-ov';   // ⚠️ 마우스 통과 화이트리스트(UI_HIT_SEL) 매칭용 — 빼지 말 것
    /* 처음 만들기 실패면 뒤의 런처는 반쯤 죽은 화면이라 덮는다. 실행 중 끊김이면 창이 모니터 전체라 덮지 않고 가운데 상자만 */
    const cover = kind === 'create' ? 'background:var(--win-face);' : 'background:none;pointer-events:none;';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;' + cover + 'display:flex;align-items:center;justify-content:center;';
    const box = doc.createElement('div');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-labelledby', 'glFailBody');
    box.style.cssText = 'pointer-events:auto;width:300px;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);border-radius:var(--win-radius-el);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 4px 4px 0 rgba(0,0,0,.35);font-family:var(--tw-font-legacy);';
    const hd = doc.createElement('div');
    hd.style.cssText = 'background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:var(--win-title-ink);padding:5px 8px;font-size:12px;font-weight:bold;';
    hd.textContent = TEXT.title;
    const body = doc.createElement('div');
    body.id = 'glFailBody';
    body.style.cssText = 'padding:16px 14px 6px;color:var(--win-ink);font-size:13px;line-height:1.6;';
    body.textContent = TEXT.body;
    const row = doc.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;padding:8px 14px 14px;justify-content:flex-end;';
    const close = doc.createElement('button');
    close.className = 'lc-btn ghost'; close.style.minWidth = '70px'; close.textContent = TEXT.close;
    const again = doc.createElement('button');
    again.className = 'lc-btn'; again.style.minWidth = '70px'; again.textContent = TEXT.relaunch;
    close.onclick = () => { try{ deps.quit(); }catch(_){} };
    again.onclick = () => { try{ deps.relaunch(); }catch(_){} };
    row.appendChild(close); row.appendChild(again);
    box.appendChild(hd); box.appendChild(body); box.appendChild(row);
    ov.appendChild(box);
    doc.body.appendChild(ov);
    try{ again.focus(); }catch(_){}
    return true;
  }

  /* 메인 렌더러 만들기 — 던지면 안내를 띄우고 다시 던진다(뒤 코드는 렌더러 없이 돌 수 없다) */
  function guard(make){
    try{ return make(); }
    catch(e){ show('create', e); throw e; }
  }

  return { show, guard, isShown: () => shown };
}

const api = { OV_ID, TEXT, createGlFailNotice };
if(typeof window !== 'undefined') window.TwGlFailNotice = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
