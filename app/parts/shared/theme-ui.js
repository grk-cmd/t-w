/* theme-ui.js — 🎨 테마 — 자식 창(방명록 · 디자인)에 테마 옮기기 · 테마 / 색상 고르기
   app.js «🎨 테마 — 자식 창(방명록 · 디자인)에 테마 옮기기 · 테마 / 색상 고르기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 44번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _themeChildDocs · applyThemeToChildDoc · bindThemeUI · refreshThemeUI — app.js 는 themeUiMod.이름 으로 부른다.
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
function setTheme(t){
  try{
    localStorage.setItem(THEME_KEY, (t==='bubble') ? 'bubble' : 'default');
    // 테마를 바꾸면 그 테마의 기본색으로 따라간다 — 색표가 테마마다 달라서 칸 번호를 그대로 두면
    // 엉뚱한 색(기본의 퍼플 → 버블의 그레이)으로 튀어 "왜 회색이 됐지"가 된다.
    localStorage.setItem(ACCENT_KEY, THEME_DEFAULT_ACCENT[(t==='bubble')?'bubble':'default']);
  }catch(_){}
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
    b.style.background = css; b.title = name;
    b.onclick = ()=>setAccent(id);
    row.appendChild(b);
  });
  if(names) names.innerHTML = set.map(c=>'<span>'+c[1]+'</span>').join('');
}
function bindThemeUI(){
  const bd = document.getElementById('themeOptDefault'), bb = document.getElementById('themeOptBubble');
  if(bd) bd.onclick = ()=>setTheme('default');
  if(bb) bb.onclick = ()=>setTheme('bubble');
  refreshThemeUI();
}

return {
  _themeChildDocs: ()=>_themeChildDocs,   // 읽는 함수
  setThemeChildDocs: (v)=>{ _themeChildDocs = v; },   // 쓰는 함수 — app.js 가 비운다
  applyThemeToChildDoc,
  bindThemeUI,
  refreshThemeUI,
};
}

const api = { createThemeUi };
if(typeof window !== 'undefined') window.TwThemeUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
