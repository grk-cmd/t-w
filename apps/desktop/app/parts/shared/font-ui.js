/* font-ui.js — 🔤 창 글꼴 고르기 — 걸기(창 글씨 토큰 둘) · 설정 › 모니터 › 글꼴 칸 · 👑 내 PC 글꼴 고르기 상자
   규칙(값 → 글꼴 목록 · 씻기)은 font-choice.js. 저장은 이 PC(tw.uiFont) — PC 글꼴은 그 PC 에만 있어서 계정에 안 올린다.
   ★ 기본 · 돋움 · 나눔고딕은 누구나, 내 PC 글꼴은 프리미엄만(끝나면 기본으로 보이고 고른 값은 남긴다).
   ★ 그 글꼴이 없는 PC 에서는 기본 목록으로 떨어진다 — 칸에 «이 PC 에 없음» 을 붙여 알려 준다.
   ★ PC 글꼴 목록은 크로미움 queryLocalFonts(누름 직후에만 부를 수 있다). 못 읽으면 E-SYS-03 · 이름을 직접 써서 고를 수 있다.
   deps: _premiumOn() · refreshChildren()(열린 방명록 · 디자인 창에 토큰을 다시 옮김 — theme.js applyTheme)
   밖에서 부르는 이름: apply · bind · refresh. classic script(window.TwFontUi) — app.js 가 테마 바로 뒤에서 createFontUi(deps).
   검사: checks/sim-font-choice.js */
(function(){

function createFontUi(deps){
const _premiumOn = deps._premiumOn;   // () => bool — 이름은 app.js 와 같게(검사가 옮기기 전 글로 합친다)
const refreshChildren = deps.refreshChildren;
const FC = TwFontChoice;
const KEY = 'tw.uiFont';
const $ = (id) => document.getElementById(id);

function stored(){ try{ return FC.norm(localStorage.getItem(KEY)); }catch(_){ return 'base'; } }
function save(v){ try{ localStorage.setItem(KEY, FC.norm(v)); }catch(_){} }
/* 지금 실제로 거는 값 — PC 글꼴은 프리미엄일 때만 */
function effective(){ const v = stored(); return (FC.isPc(v) && !_premiumOn()) ? 'base' : v; }

/* 부팅 때는 이것만 — 열린 자식 창이 없다. 고를 때는 _set 이 자식 창까지 다시 옮긴다 */
function apply(){
  const css = FC.cssFor(effective()), root = document.documentElement;
  for(const k of FC.TOKENS){ if(css) root.style.setProperty(k, css); else root.style.removeProperty(k); }
}
function _set(v){ save(v); apply(); refreshChildren(); refresh(); }
/* 이 PC 에 그 글꼴이 있나 — 없는 글꼴은 뒤 글꼴로 그려져 폭이 같아진다(세 가지 기준 글꼴과 다 같으면 없음) */
function hasFont(family){
  try{
    const c = document.createElement('canvas').getContext('2d'), s = '가나다라 abcdefghij 0123';
    return ['monospace', 'serif', 'sans-serif'].some(b => {
      c.font = '20px ' + b; const w0 = c.measureText(s).width;
      c.font = "20px '" + FC.cleanFamily(family) + "'," + b; return c.measureText(s).width !== w0;
    });
  }catch(_){ return true; }   // 잴 수 없으면 «없음» 을 붙이지 않는다
}
function _missing(v){
  if(FC.isPc(v)) return !hasFont(FC.pcName(v));
  if(v === 'nanum') return !hasFont('NanumGothic') && !hasFont('Nanum Gothic') && !hasFont('나눔고딕');
  if(v === 'dotum') return !hasFont('Dotum') && !hasFont('돋움');
  return false;
}

function _row(v, on){
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'font-opt' + (on ? ' on' : '');
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = FC.label(v);
  const pv = document.createElement('span'); pv.className = 'pv'; pv.textContent = '오늘도 집중! 가나다 ABC 123';
  pv.style.fontFamily = FC.cssFor(v) || FC.BASE_TAIL;
  b.appendChild(nm); b.appendChild(pv);
  if(_missing(v)){ const x = document.createElement('span'); x.className = 'miss'; x.textContent = '이 PC 에 없음'; b.appendChild(x); }
  b.onclick = () => _set(v);
  return b;
}
function refresh(){
  const row = $('fontPickRow'); if(!row) return;
  const cur = stored(), eff = effective();
  row.innerHTML = '';
  FC.OPTIONS.forEach(o => row.appendChild(_row(o[0], eff === o[0])));
  if(FC.isPc(cur)){
    const r = _row(cur, eff === cur);
    if(eff !== cur) r.classList.add('locked');   // 프리미엄이 끝났다 — 남겨 두되 흐리게
    const x = document.createElement('span'); x.className = 'del'; x.textContent = '✕'; x.title = '지우기';
    x.onclick = (e) => { e.stopPropagation(); _set('base'); };
    r.appendChild(x); row.appendChild(r);
  }
  const lock = $('fontPcLock'); if(lock && _premiumOn()) lock.style.display = 'none';
  if(!_premiumOn()) _pcClose();
}

/* ── 👑 내 PC 글꼴 고르기 ── */
let _pcFamilies = null, _pcDraft = '';
function _pcClose(){ _pcDraft = ''; const b = $('fontPcBox'); if(b) b.style.display = 'none'; }
async function _pcOpen(){
  if(!_premiumOn()){ const l = $('fontPcLock'); if(l) l.style.display = 'block'; return; }
  const box = $('fontPcBox'); if(!box) return;
  box.style.display = 'block'; _pcDraft = FC.pcName(stored());
  const s = $('fontPcSearch'); if(s) s.value = '';
  if(_pcFamilies === null) _pcFamilies = await _loadFamilies();
  _pcRender();
}
async function _loadFamilies(){
  try{
    const list = await window.queryLocalFonts();
    return Array.from(new Set(list.map(f => FC.cleanFamily(f.family)).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
  }catch(e){
    TwErrorCodes.notify('E-SYS-03', e);
    return [];
  }
}
function _pcRender(){
  const list = $('fontPcList'); if(!list) return;
  const q = (($('fontPcSearch') || {}).value || '').trim().toLowerCase();
  const fams = (_pcFamilies || []).filter(f => !q || f.toLowerCase().includes(q)).slice(0, 300);
  list.innerHTML = '';
  if(!(_pcFamilies || []).length){
    const m = document.createElement('div'); m.className = 'msg';
    m.textContent = '글꼴 목록을 읽지 못했어요 — 위 칸에 글꼴 이름을 그대로 쓰고 [이 글꼴로] 를 눌러도 돼요';
    list.appendChild(m);
  }
  fams.forEach(f => {
    const d = document.createElement('div'); d.className = 'it' + (f === _pcDraft ? ' on' : '');
    const b = document.createElement('b'); b.textContent = f;
    const p = document.createElement('span'); p.textContent = '오늘도 집중! 가나다'; p.style.fontFamily = "'" + f + "'," + FC.BASE_TAIL;
    d.appendChild(b); d.appendChild(p);
    d.onclick = () => { _pcDraft = f; _pcRender(); };
    list.appendChild(d);
  });
}
function _pcOk(){
  if(!_premiumOn()) return;
  const typed = FC.cleanFamily(($('fontPcSearch') || {}).value || '');
  const f = _pcDraft || (!(_pcFamilies || []).length ? typed : '');
  if(!f) return;
  _pcClose(); _set(FC.PC_PREFIX + f);
}
function bind(){
  const on = (id, ev, fn) => { const e = $(id); if(e) e.addEventListener(ev, fn); };
  on('fontPcMore', 'click', () => { _pcOpen(); });
  on('fontPcSearch', 'input', _pcRender);
  on('fontPcCancel', 'click', _pcClose);
  on('fontPcOk', 'click', _pcOk);
  refresh();
}

return { apply, bind, refresh, KEY };
}

const api = { createFontUi };
if(typeof window !== 'undefined') window.TwFontUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
