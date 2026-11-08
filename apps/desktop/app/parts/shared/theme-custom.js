/* theme-custom.js — 👑 테마 «내 색»(프리미엄) 규칙 — 고른 두 색 → 색상 축 변수(--acc-*) · 저장 모양 씻기
   순수 모듈(DOM · localStorage · firebase 없음). theme.js(걸기) · theme-ui.js(고르기 창)가 같이 쓴다.
   ★ 기본 테마는 제목줄 글자가 흰색이라 고른 색을 어둡게, 버블은 글자가 어두워서 밝은 파스텔로 맞춘다 —
     어떤 색을 골라도 제목줄 글자가 읽히게. 나머지 칸(선택 배경 · 테두리 · 창 바탕)은 고른 색을 흰색에 섞어 만든다.
   ★ 저장 모양: { default:{a,b}, bubble:{a,b} } — a 는 제목줄 시작 · b 는 끝(한 가지 색이면 a === b). 값은 '#RRGGBB' 대문자.
     서버 users/$uid/themeCustom 규칙도 이 모양만 받는다.
   검사: checks/sim-theme-custom.js */
(function(){

const THEMES = ['default', 'bubble'];
const POP = '#FFC24B';   // 뱃지 색 — 기본 다섯 칸과 같은 노랑
/* 제목줄 글자가 읽히는 밝기 경계(상대 휘도) — 기본: 흰 글자라 이 아래로 · 버블: 어두운 글자라 이 위로 */
const DEFAULT_MAX_LUM = 0.32, BUBBLE_MIN_LUM = 0.5;

function normHex(v){
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(v == null ? '' : v).trim());
  return m ? '#' + m[1].toUpperCase() : '';
}
/* 저장본 · 서버 값 → 쓸 수 있는 모양만. 테마마다 a · b 가 다 맞아야 남긴다 */
function normCustom(obj){
  const out = {};
  for(const t of THEMES){
    const c = obj && obj[t];
    const a = normHex(c && c.a), b = normHex(c && c.b);
    if(a && b) out[t] = { a, b };
  }
  return out;
}

const _rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const _hex = (c) => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
const _mix = (h, to, t) => { const a = _rgb(h), b = _rgb(to); return _hex(a.map((x, i) => x + (b[i] - x) * t)); };
function lum(h){
  const [r, g, b] = _rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/* 경계를 넘을 때까지 검정(또는 흰색)에 조금씩 섞는다 — 색 느낌은 남기고 밝기만 맞춘다 */
function _toward(h, to, ok){
  let c = h;
  for(let i = 1; i <= 20 && !ok(c); i++) c = _mix(h, to, i / 20);
  return c;
}

/* 고른 두 색 → 그 테마의 --acc-* 값 표. 잘못된 색이면 null(걸지 않는다) */
function derive(theme, a, b){
  a = normHex(a); b = normHex(b);
  if(!a || !b) return null;
  const W = '#FFFFFF', K = '#000000';
  if(theme === 'bubble'){
    const l = _toward(_mix(a, W, 0.55), W, c => lum(c) >= BUBBLE_MIN_LUM + 0.15);
    const m = _toward(_mix(b, W, 0.3), W, c => lum(c) >= BUBBLE_MIN_LUM);
    const d = _toward(a, K, c => lum(c) <= 0.4);
    return {
      '--acc-d': d, '--acc-m': m, '--acc-l': l, '--acc-tint': _mix(a, W, 0.82),
      '--acc-brd': _mix(_mix(a, '#808080', 0.35), W, 0.55), '--acc-face': _mix(a, W, 0.9),
      '--acc-desk': _mix(a, W, 0.62), '--acc-pop': POP, '--acc-sweep': 'none',
    };
  }
  const d = _toward(a, K, c => lum(c) <= DEFAULT_MAX_LUM);
  const m = _toward(b, K, c => lum(c) <= DEFAULT_MAX_LUM + 0.12);
  return {
    '--acc-d': d, '--acc-m': m, '--acc-l': _mix(m, W, 0.65), '--acc-tint': _mix(d, W, 0.87),
    '--acc-brd': _mix(d, W, 0.62), '--acc-face': _mix(d, W, 0.9), '--acc-desk': _mix(d, W, 0.6),
    '--acc-pop': POP, '--acc-sweep': 'none',
  };
}
/* 설정 칸에 보여줄 그라데이션 — 그 테마에서 실제로 보일 제목줄 색으로 */
function chipCss(theme, a, b){
  const v = derive(theme, a, b);
  if(!v) return '';
  return theme === 'bubble'
    ? 'linear-gradient(90deg,' + v['--acc-l'] + ',' + v['--acc-m'] + ')'
    : 'linear-gradient(90deg,' + v['--acc-d'] + ',' + v['--acc-m'] + ')';
}
const VAR_NAMES = Object.keys(derive('default', '#000080', '#1084D0'));

const api = { THEMES, VAR_NAMES, normHex, normCustom, derive, chipCss, lum, mix: (h, to, t) => _mix(normHex(h) || '#000000', normHex(to) || '#FFFFFF', t), DEFAULT_MAX_LUM, BUBBLE_MIN_LUM };
if(typeof window !== 'undefined') window.TwThemeCustom = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
