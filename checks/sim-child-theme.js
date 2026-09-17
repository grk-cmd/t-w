/* ═══ 🎨 sim-child-theme.js — 방명록·디자인 창이 테마를 따라가는가 (제보 5 · 2026-09-15) ══════════
   [무엇을 지키나] 테마 「버블」이 마이홈 방명록·디자인 창(별도 BrowserWindow = 별도 document)에 안 먹던 것.
     GB_HTML·DS_HTML 의 색을 토큰(var(--win-*))으로 바꾸고, 창을 열 때 applyThemeToChildDoc 가 메인 문서의
     data-theme·data-accent 와 토큰 값을 넣어 준다. applyTheme 는 열린 창에도 다시 건다.
   ・1절: 두 HTML 문자열을 **실제로 조립**해서 CSS 를 본다 — 하드코딩 베젤이 남아 있지 않고, var() 마다 폴백이 있고,
          자식이 쓰는 --win-*·--acc-* 는 전부 THEME_CHILD_TOKENS 에 있다(없으면 조용히 폴백으로 떨어진다).
   ・2절: 디자인 창 타이틀은 두 테마 모두 금색(--win-title-premium) — 액센트(--win-title-grad)를 안 탄다.
   ・3절: 배선 — 열 때 주입, applyTheme 전파, 토큰이 메인 HTML 에 실제로 정의돼 있다.
   [실행] app.js · desk-companion-prototype.html 이 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(name){
  const i = SRC.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let k = SRC.indexOf('{', i), d = 0;
  for(; k < SRC.length; k++){
    if(SRC[k] === '{') d++;
    else if(SRC[k] === '}' && --d === 0) return SRC.slice(i, k + 1);
  }
  return null;
}
/* 문자열 상수를 조립한다 — '…'+ 이어 붙인 순수 리터럴이라 eval 로 그대로 값이 나온다 */
function grabHtml(name){
  const i = SRC.indexOf('const ' + name + ' = ');
  if(i < 0) return null;
  const j = SRC.indexOf("</html>';", i);
  try{ return eval(SRC.slice(i + ('const ' + name + ' = ').length, j + 8)); }catch(_){ return null; }
}
const GB = grabHtml('GB_HTML'), DS = grabHtml('DS_HTML');
if(!GB || !DS){
  huh('GB_HTML / DS_HTML 을 조립하지 못함 — 문자열 모양이 바뀌었다면 이 파일도 같이 고칠 것');
  say('통과 ' + pass + ' · 실패 ' + (fail + 1) + ' · 검사못함 ' + huhs); process.exit(1);
}
const cssOf = (h) => h.slice(h.indexOf('<style>') + 7, h.indexOf('</style>'));
const tokListM = /const THEME_CHILD_TOKENS = \[([\s\S]*?)\];/.exec(SRC);
const TOKENS = tokListM ? [...tokListM[1].matchAll(/'(--[\w-]+)'/g)].map(m => m[1]) : [];

/* ── 1. 자식 CSS ── */
say('── 1. 자식 창 CSS — 토큰을 쓰고, 폴백이 있고, 토큰 목록에 있는 것만 쓴다');
for(const [name, html, own] of [['GB_HTML', GB, /^--gb-/], ['DS_HTML', DS, /^--ds-/]]){
  const css = cssOf(html);
  const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
  chk(o === c && o > 0, name + ' CSS 중괄호 ' + o + '/' + c + ' — 조립이 깨지지 않았다');
  chk(!/border-color:#fff #404040 #404040 #fff/.test(css) && !/border-color:#404040 #fff #fff #404040/.test(css),
      '★ ' + name + ' 에 하드코딩 베젤(#fff/#404040)이 없다');
  chk(!/font-family:Tahoma,sans-serif/.test(css), name + ' 글꼴이 --win-font 를 지난다');
  const used = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]))];
  const winAcc = used.filter(v => /^--(win|acc)-/.test(v));
  const missing = winAcc.filter(v => TOKENS.indexOf(v) < 0);
  chk(missing.length === 0, '★ ' + name + ' 가 쓰는 --win-*·--acc-* ' + winAcc.length + '개가 전부 THEME_CHILD_TOKENS 에 있다' + (missing.length ? ' — 빠짐: ' + missing.join(' ') : ''));
  const noFallback = [...css.matchAll(/var\((--win-[\w-]+)\)/g)].map(m => m[1]);
  chk(noFallback.length === 0, name + ' 의 var(--win-*) 는 전부 폴백이 있다 (토큰이 안 와도 옛 모습)' + (noFallback.length ? ' — ' + noFallback.join(' ') : ''));
  const ownTok = used.filter(v => own.test(v));
  const ownDef = ownTok.filter(v => new RegExp('html\\{[^}]*' + v + ':').test(css));
  chk(ownTok.length > 0 && ownDef.length === ownTok.length, name + ' 고유 토큰 ' + ownTok.length + '개가 html{} 에 기본값이 있다');
  chk(/html\[data-theme=bubble\]\{/.test(css), name + ' 에 버블용 고유 토큰 덮어쓰기가 있다');
  chk(/border-radius:var\(--win-radius,0px\)/.test(css), name + ' 창 모서리가 --win-radius 를 받는다 (버블 12px)');
}
chk(/html\[data-theme=bubble\]\[data-accent=c4\]/.test(cssOf(GB)) && /html\[data-theme=bubble\]\[data-accent=c5\]/.test(cssOf(GB)),
    '방명록: 피치·민트는 박수 상자·라벨을 한 단계 진하게 (옅은 --acc-d 위 흰 글씨 대비)');

/* ── 2. 디자인 창은 금색 ── */
say('── 2. 디자인 창 타이틀은 두 테마 모두 금색 — 액센트를 안 탄다');
const dsCss = cssOf(DS);
chk(/#dsTitle\{[^}]*var\(--win-title-premium,linear-gradient\(90deg,#7a5a10,#c9a227\)\)/.test(dsCss), '★ #dsTitle 이 --win-title-premium (기본 금색 폴백)');
chk(!/--win-title-grad/.test(dsCss), '★ DS_HTML 은 --win-title-grad(액센트 타이틀)를 쓰지 않는다');
chk(/#dsPresets\{[^}]*background:#e8e4d2/.test(dsCss) && /\.ds-group\{[^}]*color:#8a6d1f/.test(dsCss), '프리셋 줄·그룹 제목의 금색은 하드코딩 그대로 (테마 무관)');
chk(/#gbTitle\{[^}]*var\(--win-title-grad,linear-gradient\(90deg,#000080,#1084D0\)\)/.test(cssOf(GB)), '방명록 타이틀은 --win-title-grad (액센트를 탄다)');

/* ── 3. 배선 ── */
say('── 3. 배선');
chk(/d\.write\(GB_HTML\); d\.close\(\);\n\s*applyThemeToChildDoc\(d\);/.test(SRC), '★ 방명록: d.write 직후 applyThemeToChildDoc');
chk(/d\.write\(DS_HTML\); d\.close\(\);\n\s*applyThemeToChildDoc\(d\);/.test(SRC), '★ 디자인: d.write 직후 applyThemeToChildDoc');
const atc = grabFn('applyThemeToChildDoc') || '';
chk(/setAttribute\('data-theme', t\)/.test(atc) && /setAttribute\('data-accent', a\)/.test(atc), '자식 <html> 에 data-theme·data-accent 를 건다');
chk(/removeAttribute\('data-theme'\)/.test(atc), '기본 테마면 data-theme 을 뗀다 (메인과 같은 규칙 — 남겨 두면 버블이 안 풀린다)');
chk(/head\.insertBefore\(st, head\.firstChild\)/.test(atc), '토큰 <style> 은 창 자신의 <style> 보다 앞');
chk(/_themeChildDocs\.push\(d\)/.test(atc), '연 창을 _themeChildDocs 에 기억한다');
const at = grabFn('applyTheme') || '';
chk(/_themeChildDocs = _themeChildDocs\.filter/.test(at) && /applyThemeToChildDoc\(d\)/.test(at), '★ applyTheme 가 열린 창에도 다시 건다');
chk(/d\.defaultView\.closed\) return false/.test(at), '닫힌 창은 목록에서 떨어진다');
const tcc = grabFn('_themeChildCss') || '';
chk(/getComputedStyle\(document\.documentElement\)/.test(tcc) && /getPropertyValue\(k\)/.test(tcc), '토큰 값은 메인 문서 computed style 에서 읽는다 (CSS 두 벌 아님)');
const undefinedInMain = TOKENS.filter(t => !new RegExp(t.replace(/-/g, '\\-') + '\\s*:').test(HTML));
chk(undefinedInMain.length === 0, '★ THEME_CHILD_TOKENS ' + TOKENS.length + '개가 전부 메인 HTML 에 정의돼 있다' + (undefinedInMain.length ? ' — 없음: ' + undefinedInMain.join(' ') : ''));

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);
