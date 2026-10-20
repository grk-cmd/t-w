/* theme.js — 🎨 디자인 테마 — 저장 키 · 색 표 · 지금 테마 · 걸기(applyTheme)
   app.js «🎨 디자인 테마 — 저장 키 · 색 표 · 지금 테마 · 걸기(applyTheme)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 48번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 곳 하나 — 열린 자식 창에 다시 거는 줄은 theme-ui.js 가
     onApplied 로 건다(아래층이 위층 theme-ui 를 부르던 순환 끊기 — checks/sim-dep-cycles.js).
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: ACCENT_KEY · THEME_COLORS · THEME_DEFAULT_ACCENT · THEME_KEY · applyTheme · getAccent · getTheme · onApplied — app.js 는 themeMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwTheme — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-theme.js */
(function(){

function createTheme(deps){
/* 테마를 건 뒤 부를 함수 — 열린 방명록 · 디자인 창(theme-ui.js)이 만들 때 건다. 이 파일은 아래층이라 theme-ui 를 직접 부르지 않는다 */
const _onAppliedFns = [];
function onApplied(fn){ _onAppliedFns.push(fn); }
const THEME_KEY = 'tw.theme', ACCENT_KEY = 'tw.accent';
/* 칸 번호 → [표시 이름, 칩에 보여줄 그라데이션]. CSS의 --acc-* 값과 짝이 맞아야 한다. */
const THEME_COLORS = {
  default: [
    ['c1','퍼플',   'linear-gradient(90deg,#5B0FBF,#B23DFF)'],
    ['c2','블루',   'linear-gradient(90deg,#000080,#1084D0)'],
    ['c3','그린',   'linear-gradient(90deg,#0A8F2E,#3FE06B)'],
    ['c4','노을',   'linear-gradient(90deg,#FF8A3D,#E82E7B)'],
    ['c5','오로라', 'linear-gradient(90deg,#2FE0C8,#5B3FE0)'],
  ],
  bubble: [
    ['c1','그레이', 'linear-gradient(90deg,#DCE3E9,#AFBAC4)'],
    ['c2','스카이', 'linear-gradient(90deg,#CFEAF7,#86C9E8)'],
    ['c3','그린',   'linear-gradient(90deg,#D8EE9E,#9ED44F)'],
    ['c4','피치',   'linear-gradient(90deg,#FFDCC8,#EFBBD4)'],
    ['c5','민트',   'linear-gradient(90deg,#CBF1E4,#D2D5F4)'],
  ],
};
const THEME_DEFAULT_ACCENT = { default:'c2', bubble:'c3' };   // 기본=블루(Win98 정통), 버블=그린

function getTheme(){
  try{ return (localStorage.getItem(THEME_KEY)==='bubble') ? 'bubble' : 'default'; }catch(_){ return 'default'; }
}
function getAccent(){
  const t = getTheme();
  let a = null; try{ a = localStorage.getItem(ACCENT_KEY); }catch(_){}
  // 저장값이 없거나 이상하면 그 테마의 기본색으로. (테마별로 색이 다르므로 칸 번호만 검사한다)
  return THEME_COLORS[t].some(c=>c[0]===a) ? a : THEME_DEFAULT_ACCENT[t];
}
function applyTheme(){
  try{
    const t = getTheme(), a = getAccent();
    const root = document.documentElement;
    // ★ 색을 '먼저' 건다. 버블 테마의 --win-face 등은 --acc-* 를 폴백 없이 참조하므로,
    //   data-theme 만 걸린 채 data-accent 가 빠지면 그 변수들이 무효값이 되어 창이 통째로 투명해진다.
    //   순서를 이렇게 두면 중간에 실패해도 '기본 테마 + 색만 바뀜'으로 끝나 화면이 안 깨진다.
    root.setAttribute('data-accent', a);
    if(t==='bubble') root.setAttribute('data-theme','bubble'); else root.removeAttribute('data-theme');
  }catch(e){ console.warn('[테마] 적용 실패 — 기본 테마로 둡니다', e); }
  for(const fn of _onAppliedFns){ try{ fn(); }catch(_){} }
}

return {
  ACCENT_KEY,
  THEME_COLORS,
  THEME_DEFAULT_ACCENT,
  THEME_KEY,
  applyTheme,
  getAccent,
  getTheme,
  onApplied,
};
}

const api = { createTheme };
if(typeof window !== 'undefined') window.TwTheme = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
