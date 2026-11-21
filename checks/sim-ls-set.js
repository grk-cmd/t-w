/* ═══ 💾 sim-ls-set.js — 작은 설정 저장 헬퍼(shared/ls-set.js · app.js 분리 M14) ═══════════════
   ・1절: 성공 · 값이 안 남는 환경 · setItem 이 던지는 환경 · 안내는 세션당 한 번
   ・2절: 연결 — html 순서 · 만드는 줄 · 옛 이름
   ・3절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('shared/ls-set.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function build(src, mode){
  const store = {}, toasts = [], warns = [];
  const ls = { setItem: (k, v) => { if(mode === 'throw') throw new Error('quota'); if(mode !== 'drop') store[k] = v; }, getItem: (k) => (k in store ? store[k] : null) };
  const win = {};
  new Function('window', 'localStorage', 'console', 'module', src)(win, ls, { warn: (...a) => warns.push(a), log(){}, error(){} }, undefined);
  const mod = win.TwLsSet.createLsSet({ toast: (m) => toasts.push(m) });
  return { mod, store, toasts, warns };
}
say('§1 _lsSet');
{
  let b = build(SRC, 'ok');
  chk(b.mod._lsSet('tw.a', 5) === true && b.store['tw.a'] === '5' && b.toasts.length === 0, '남으면 true · 글자로 저장 · 안내 없음');
  b = build(SRC, 'drop');
  chk(b.mod._lsSet('tw.a', 1) === false && b.warns.length === 1 && b.toasts.length === 1, '★ setItem 이 던지지 않아도 값이 안 남으면 실패로 본다(왕복 확인) — 경고 + 안내');
  b = build(SRC, 'throw');
  chk(b.mod._lsSet('tw.a', 1) === false && b.toasts.length === 1, 'setItem 이 던지면 false · 안내');
  b.mod._lsSet('tw.b', 1); b.mod._lsSet('tw.c', 1);
  chk(b.toasts.length === 1 && b.warns.length === 3, '안내는 세션당 한 번 · 콘솔 경고는 매번');
  b = build(SRC, 'ok'); chk(b.mod._lsSet('tw.n', null) === true && b.store['tw.n'] === 'null', 'null · 0 도 글자로 남긴다');
}
say('§2 연결');
{
  const iM = HTML.indexOf('<script src="parts/shared/ls-set.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iM > 0 && iA > iM, 'html — ls-set.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'lsSetMod', 'TwLsSet', 'createLsSet');
  chk(!!pairs && pairs.length === 1 && pairs[0][0] === 'toast' && pairs[0][1] === 'toast', 'app.js — 만든다 · deps 는 toast 하나(함수 선언이라 값으로 넘긴다)');
  chk(/^const _lsSet = lsSetMod\._lsSet;/m.test(code) && !/function _lsSet\b/.test(code), '  옛 이름을 const 로 받고 본문은 안 남음');
}
say('§3 mutation test');
{
  const brk = (a, b) => { const m = SRC.replace(a, b); return m === SRC ? null : m; };
  const m1 = brk("if(localStorage.getItem(key) !== s) throw new Error('값이 남지 않음');", "");
  chk(!!m1 && build(m1, 'drop').mod._lsSet('k', 1) === true, '왕복 확인을 빼면 빨강');
  const m2 = brk("if(!_lsWarned){", "if(true){");
  chk(!!m2 && (() => { const b = build(m2, 'throw'); b.mod._lsSet('a', 1); b.mod._lsSet('b', 1); return b.toasts.length === 2; })(), '세션당 한 번 제한을 빼면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
