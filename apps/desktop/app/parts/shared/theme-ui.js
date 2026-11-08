/* theme-ui.js — 🎨 테마 — 자식 창(방명록 · 디자인)에 테마 옮기기 · 테마 / 색상 고르기
   app.js «🎨 테마 — 자식 창(방명록 · 디자인)에 테마 옮기기 · 테마 / 색상 고르기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 44번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 👑 내 색 — 여섯째 칸 · 만들기 상자(#themeCxBox) · 저장은 이 PC 사본 + 서버(deps.saveCustom) · 로그인 뒤 pullCustom.
   ★ 밖에서 부르는 이름: _themeChildDocs · applyThemeToChildDoc · bindThemeUI · refreshThemeUI · pullCustom · refreshCustom — app.js 는 themeUiMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwThemeUi — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-theme-ui.js */
(function(){

function createThemeUi(deps){
const ACCENT_KEY = deps.ACCENT_KEY;
const THEME_COLORS = deps.THEME_COLORS;
const THEME_DEFAULT_ACCENT = deps.THEME_DEFAULT_ACCENT;
const THEME_KEY = deps.THEME_KEY;
const applyTheme = deps.applyTheme;
const getAccent = deps.getAccent;
const getTheme = deps.getTheme;
const onApplied = deps.onApplied;   // theme.js — 테마를 건 뒤 부를 함수 걸기
const CUSTOM_ID = deps.CUSTOM_ID;   // 👑 내 색 칸 번호(theme.js)
const getCustom = deps.getCustom;   // () => { default:{a,b}?, bubble:{a,b}? }
const setCustom = deps.setCustom;   // (obj) => 씻은 obj — 이 PC 사본에 쓴다
const premiumOn = deps.premiumOn;   // () => bool
const customUsable = deps.customUsable;   // (theme) => bool — 내 색을 쓸 수 있나(theme.js 한 곳)
const getMyUserId = deps.getMyUserId;
const loadCustom = deps.loadCustom; // (uid) => obj | {}(없음) | null(못 읽음) — 서버 users/$uid/themeCustom
const saveCustom = deps.saveCustom; // (uid, obj) => bool
const TC = TwThemeCustom;
const THEME_CHILD_TOKENS = [
  '--win-face','--win-face-2','--win-hi','--win-lo','--win-lo-2','--win-ink','--win-ink-soft','--win-title-ink',
  '--win-error','--win-radius','--win-radius-sm','--win-radius-el','--win-font','--win-title-grad',
  '--win-title-premium','--win-title-premium-ink','--win-btn-grad','--win-face-grad','--win-drop','--win-select',
  '--acc-d','--acc-m','--acc-l','--acc-tint','--acc-brd','--acc-face','--acc-pop',
];
let _themeChildDocs = [];
function _themeChildCss(){
  const cs = getComputedStyle(document.documentElement);
  return 'html{' + THEME_CHILD_TOKENS.map(k=>{ const v = cs.getPropertyValue(k).trim(); return v ? (k + ':' + v + ';') : ''; }).join('') + '}';
}
function applyThemeToChildDoc(d){
  try{
    if(!d || !d.documentElement) return;
    const root = document.documentElement, h = d.documentElement;
    const t = root.getAttribute('data-theme'), a = root.getAttribute('data-accent');
    if(t) h.setAttribute('data-theme', t); else h.removeAttribute('data-theme');
    if(a) h.setAttribute('data-accent', a); else h.removeAttribute('data-accent');
    let st = d.getElementById('twThemeTokens');
    if(!st){
      st = d.createElement('style'); st.id = 'twThemeTokens';
      const head = d.head || d.documentElement;
      head.insertBefore(st, head.firstChild);   // 창 자신의 <style> 보다 앞 — 토큰이 먼저 있어야 var() 가 산다
    }
    st.textContent = _themeChildCss();
    if(_themeChildDocs.indexOf(d) < 0) _themeChildDocs.push(d);
  }catch(_){}
}
// 🎨 [제보 5] 테마를 바꾸면 열려 있는 방명록·디자인 창에도 — 닫힌 창은 여기서 떨어져 나간다
onApplied(()=>{
  _themeChildDocs = _themeChildDocs.filter(d=>{
    try{ if(!d.defaultView || d.defaultView.closed) return false; applyThemeToChildDoc(d); return true; }catch(_){ return false; }
  });
});
function setTheme(t){
  try{
    localStorage.setItem(THEME_KEY, (t==='bubble') ? 'bubble' : 'default');
    // 테마를 바꾸면 그 테마의 기본색으로 따라간다 — 색표가 테마마다 달라서 칸 번호를 그대로 두면
    // 엉뚱한 색(기본의 퍼플 → 버블의 그레이)으로 튀어 "왜 회색이 됐지"가 된다.
    localStorage.setItem(ACCENT_KEY, THEME_DEFAULT_ACCENT[(t==='bubble')?'bubble':'default']);
  }catch(_){}
  _cxClose();   // 만들던 색은 그 테마 것이다
  applyTheme(); refreshThemeUI();
}
function setAccent(a){
  try{ localStorage.setItem(ACCENT_KEY, a); }catch(_){}
  applyTheme(); refreshThemeUI();
}
/* 설정 패널의 테마·색상 칩을 지금 상태에 맞춰 다시 그린다. 패널이 없으면 조용히 넘어간다. */
function refreshThemeUI(){
  const t = getTheme(), a = getAccent();
  const bd = document.getElementById('themeOptDefault'), bb = document.getElementById('themeOptBubble');
  if(bd) bd.classList.toggle('on', t!=='bubble');
  if(bb) bb.classList.toggle('on', t==='bubble');
  const row = document.getElementById('themeColorRow'), names = document.getElementById('themeColorNames');
  if(!row) return;
  const set = THEME_COLORS[t];
  row.innerHTML = '';
  set.forEach(([id,name,css])=>{
    const b = document.createElement('button');
    b.type='button'; b.className='color-chip'+(id===a?' on':'');
    b.style.background = TwSafeHtml.cssColor(css); b.title = name;
    b.onclick = ()=>setAccent(id);
    row.appendChild(b);
  });
  /* 👑 내 색 — 여섯째 칸. 이름 자리는 «👑» 하나(칸 위에 왕관을 붙이지 않는다) */
  const cx = getCustom()[t], prem = premiumOn(), usable = customUsable(t);
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'color-chip' + (a === CUSTOM_ID ? ' on' : '') + (usable ? '' : ' cx-empty');
  b.id = 'themeCxChip'; b.title = '내 색';
  if(usable) b.style.background = TwSafeHtml.cssColor(TC.chipCss(t, cx.a, cx.b)); else b.textContent = '＋';
  b.onclick = _cxChipClick;
  row.appendChild(b);
  if(names) names.innerHTML = set.map(c=>'<span>'+TwSafeHtml.text(c[1])+'</span>').join('') + '<span>👑</span>';
  const lock = document.getElementById('themeCxLock');
  if(lock && prem) lock.style.display = 'none';
  if(!prem) _cxClose();
}

/* ── 👑 내 색 만들기 ── */
let _cxDraft = null;   // { a, b } — 상자가 열린 동안만
const _cxEl = id => document.getElementById(id);
function _cxChipClick(){
  const lock = _cxEl('themeCxLock');
  if(!premiumOn()){ if(lock) lock.style.display = 'block'; return; }
  if(customUsable(getTheme()) && getAccent() !== CUSTOM_ID){ setAccent(CUSTOM_ID); return; }   // 만들어 둔 색이면 먼저 그 색으로
  _cxOpen();
}
/* 처음 만들 땐 지금 칸의 색에서 시작한다 — 빈 칸보다 고치기 쉽다 */
function _cxSeed(t){
  const cx = getCustom()[t];
  if(cx) return { a: cx.a, b: cx.b };
  const cs = getComputedStyle(document.documentElement);
  const a = TC.normHex(cs.getPropertyValue('--acc-d')) || '#000080', b = TC.normHex(cs.getPropertyValue('--acc-m')) || '#1084D0';
  return { a, b };
}
function _cxOpen(){
  const box = _cxEl('themeCxBox'); if(!box) return;
  _cxDraft = _cxSeed(getTheme());
  box.style.display = 'block';
  _cxRender();
}
function _cxClose(){ _cxDraft = null; const box = _cxEl('themeCxBox'); if(box) box.style.display = 'none'; }
function _cxRender(){
  if(!_cxDraft) return;
  const t = getTheme(), d = _cxDraft, one = d.a === d.b;
  const put = (id, v) => { const e = _cxEl(id); if(e && document.activeElement !== e) e.value = v; };
  put('themeCxA', d.a.toLowerCase()); put('themeCxAHex', d.a);
  put('themeCxB', d.b.toLowerCase()); put('themeCxBHex', d.b);
  const oneChk = _cxEl('themeCxOne'); if(oneChk) oneChk.checked = one;
  ['themeCxB', 'themeCxBHex'].forEach(id => { const e = _cxEl(id); if(e) e.disabled = one; });
  const v = TC.derive(t, d.a, d.b); if(!v) return;
  const pt = _cxEl('themeCxPrevT'), pb = _cxEl('themeCxPrevB'), ps = _cxEl('themeCxPrevS');
  if(pt) pt.style.background = TwSafeHtml.cssColor(TC.chipCss(t, d.a, d.b));
  if(pb) pb.style.background = TwSafeHtml.cssColor(v['--acc-face']);
  if(ps){ ps.style.background = TwSafeHtml.cssColor(v['--acc-tint']); ps.style.borderColor = TwSafeHtml.cssColor(v['--acc-brd']); }
}
function _cxSetFrom(key, raw){
  if(!_cxDraft) return;
  const h = TC.normHex(raw); if(!h) return;
  const one = _cxDraft.a === _cxDraft.b;
  _cxDraft[key] = h;
  if(one && key === 'a') _cxDraft.b = h;   // 한 가지 색이면 같이 움직인다
  _cxRender();
}
async function _cxSave(){
  if(!_cxDraft || !premiumOn()) return;
  const t = getTheme(), all = getCustom();
  all[t] = { a: _cxDraft.a, b: _cxDraft.b };
  const saved = setCustom(all);
  _cxClose();
  setAccent(CUSTOM_ID);
  const uid = getMyUserId();
  if(!uid) return;   // 로그인 전 — 이 PC 에만. 로그인 뒤 pullCustom 이 서버가 비었으면 올린다
  const ok = await saveCustom(uid, saved);
  if(!ok) TwErrorCodes.notify('E-SYS-02', new Error('saveThemeCustom'));
}
/* 로그인 뒤 한 번 — 서버 사본이 있으면 이 PC 를 그것으로, 없으면 이 PC 것을 올린다(못 읽으면 아무것도 안 한다) */
async function pullCustom(){
  const uid = getMyUserId();
  if(!uid) return;
  const srv = await loadCustom(uid);
  if(srv === null) return;
  const s = TC.normCustom(srv), local = getCustom();
  if(Object.keys(s).length){ setCustom(s); applyTheme(); refreshThemeUI(); return; }
  if(Object.keys(local).length) await saveCustom(uid, local);
}
function _cxBind(){
  const on = (id, ev, fn) => { const e = _cxEl(id); if(e) e.addEventListener(ev, fn); };
  on('themeCxA', 'input', e => _cxSetFrom('a', e.target.value));
  on('themeCxB', 'input', e => _cxSetFrom('b', e.target.value));
  on('themeCxAHex', 'change', e => { _cxSetFrom('a', e.target.value); _cxRender(); });
  on('themeCxBHex', 'change', e => { _cxSetFrom('b', e.target.value); _cxRender(); });
  on('themeCxOne', 'change', e => { if(!_cxDraft) return; _cxDraft.b = e.target.checked ? _cxDraft.a : TC.mix(_cxDraft.a, '#FFFFFF', 0.45); _cxRender(); });
  on('themeCxReset', 'click', () => { if(_cxDraft){ _cxDraft = _cxSeed(getTheme()); _cxRender(); } });
  on('themeCxCancel', 'click', _cxClose);
  on('themeCxSave', 'click', () => { _cxSave(); });
}
function bindThemeUI(){
  const bd = document.getElementById('themeOptDefault'), bb = document.getElementById('themeOptBubble');
  if(bd) bd.onclick = ()=>setTheme('default');
  if(bb) bb.onclick = ()=>setTheme('bubble');
  _cxBind();
  refreshThemeUI();
}

return {
  _themeChildDocs: ()=>_themeChildDocs,   // 읽는 함수
  applyThemeToChildDoc,
  bindThemeUI,
  refreshThemeUI,
  pullCustom,
  refreshCustom(){ applyTheme(); refreshThemeUI(); },   // 프리미엄이 바뀌었을 때(초대 게이트 _refreshPremiumGatedUI)
};
}

const api = { createThemeUi };
if(typeof window !== 'undefined') window.TwThemeUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
