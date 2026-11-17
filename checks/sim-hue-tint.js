/* ═══ 🎨 sim-hue-tint.js — 색조 셰이더 이름 잇기(shared/hue-tint.js · app.js 분리 T1) ═══════════════
   [왜] app.js 의 여섯 이름을 모듈로 옮겼다(글은 0.13 app.js 와 같다). 본문은 캐릭터 코어 — 여기는 옛 이름을 코어로 잇기만 한다.
   ・1절: 여섯 이름이 코어 이름(rgbHexToHsv · isHueTintMesh · ensureHueUniforms · hueOBC · applyHueTint · hsvToHex)으로 인자 그대로 가고 결과를 그대로 돌려준다
   ・2절: 진짜 코어(빌드 사본)로 — hex → HSV → hex 가 이어지고 색조를 걸면 재질에 색조 칸이 생긴다
   ・3절: 연결(html 순서 · 만드는 줄 · 옛 이름 const 여섯 · app.js 에 본문이 안 남음) · 4절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/hue-tint.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
const CORE = ['vendor/char-core/char-core.iife.js', 'app/vendor/char-core/char-core.iife.js'].map(read).find(Boolean);
if(!SRC || !APP || !HTML || !CORE){ say('  ? 원본 못 찾음 — hue-tint.js · app.js · desk-companion-prototype.html · char-core.iife.js'); process.exit(2); }

const PAIRS = [['_rgbHexToHsv', 'rgbHexToHsv', 1], ['isHueTintMesh', 'isHueTintMesh', 1], ['_ensureHueUniforms', 'ensureHueUniforms', 1], ['_hueOBC', 'hueOBC', 1], ['applyHueTint', 'applyHueTint', 3], ['_hsvToHex', 'hsvToHex', 3]];
function build(src, toneCore){
  const win = {};
  new Function('window', 'module', src)(win, undefined);
  return win.TwHueTint.createHueTint({ lightToneMod: { toneCore } });
}
say('§1 이름 잇기');
{
  const calls = [];
  const tone = {}; for(const [, c] of PAIRS) tone[c] = (...a) => { calls.push([c, a]); return 'r-' + c; };
  const mod = build(SRC, tone);
  chk(Object.keys(mod).sort().join() === PAIRS.map((p) => p[0]).sort().join(), '내놓는 이름 여섯');
  for(const [old, c, n] of PAIRS){
    calls.length = 0; const r = mod[old](1, 2, 3);
    chk(r === 'r-' + c && calls.length === 1 && calls[0][0] === c && calls[0][1].join() === [1, 2, 3].slice(0, n).join(), old + ' → 코어 ' + c + ' (인자 · 결과 그대로)');
  }
}
say('§2 진짜 코어');
{
  const THREE = { Color: function(h){ this.r = 0; this.g = 0; this.b = 0; this.getHSL = (o) => { o.h = 0.5; o.s = 0.5; o.l = 0.5; return o; }; this.setHSL = () => this; this.getHexString = () => 'abcdef'; } };
  let ok = true, why = '';
  try{
    const charCore = new Function('THREE', CORE + '\nreturn TwCharCore;')(THREE);
    const tone = charCore.createTone({ THREE, flatEmissive: 0.4, fixMatLighting(){} });
    const mod = build(SRC, tone);
    const hsv = mod._rgbHexToHsv('#808080');
    ok = hsv && typeof hsv.h === 'number' && typeof mod._hsvToHex(0.5, 0.5, 1) === 'string' && mod.isHueTintMesh({ material: {} }) === false;
  }catch(e){ ok = false; why = String(e && e.message || e).slice(0, 80); }
  chk(ok, '코어 톤에 걸어 여섯 이름이 돈다' + (why ? ' — ' + why : ''));
}
say('§3 연결');
{
  const iO = HTML.indexOf('<script src="parts/shared/hue-tint.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iO > 0 && iA > iO, 'html — hue-tint.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const hueTintMod = TwHueTint\.createHueTint\(\{\s*lightToneMod: lightToneMod,\s*\}\);/.test(code), 'app.js — 만드는 줄(lightToneMod 하나)');
  chk(PAIRS.every(([n]) => new RegExp('const ' + n + ' = hueTintMod\\.' + n + ';').test(code)), '  옛 이름 const 여섯');
  chk(!/function (_rgbHexToHsv|isHueTintMesh|_ensureHueUniforms|_hueOBC|applyHueTint|_hsvToHex)\b|_HUE_GLSL/.test(code), '  app.js 에 본문이 안 남음');
}
say('§4 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('toneCore.hsvToHex(h, sv, v)', 'toneCore.hsvToHex(h, sv)');
  chk(!!m1 && (() => { const c = []; const t = {}; for(const [, k] of PAIRS) t[k] = (...a) => c.push(a.length); build(m1, t)._hsvToHex(1, 2, 3); return c[0] === 2; })(), '인자를 흘리면 빨강');
  const m2 = brk('function applyHueTint(mesh, hex, hsvOpt){ return', 'function applyHueTint(mesh, hex, hsvOpt){');
  chk(!!m2 && (() => { const t = {}; for(const [, k] of PAIRS) t[k] = () => 'x'; return build(m2, t).applyHueTint(1, 2) === undefined; })(), '결과를 안 돌려주면 빨강');
  const m3 = brk('  _hueOBC,\n', '');
  chk(!!m3 && (() => { const t = {}; for(const [, k] of PAIRS) t[k] = () => 1; return build(m3, t)._hueOBC === undefined; })(), '이름 하나를 안 내놓으면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
