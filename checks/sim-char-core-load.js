/* sim-char-core-load.js — 🧬 앱이 캐릭터 코어(packages/char-core 빌드 사본 vendor/char-core/char-core.iife.js)를 싣는가
   실행:  node sim-char-core-load.js   (러너 스테이징 또는 apps/desktop 에서)
   ★ 왜 이 검사가 있는가 — 앱은 번들러가 없어 코어 빌드 결과를 한 벌 두고 classic script 로 싣는다(#432).
     사본이 three 보다 먼저 실리면 r128 확인이 못 돌고, app.js 보다 늦으면 앞으로 app.js 가 부를 때 «정의 안 됨» 으로 선다.
     사본이 빌드와 같은지는 CI «캐릭터 코어» job 이 다시 빌드해 비교한다 — 여기는 앱 쪽(싣는 자리 · 실려서 도는가)만 본다.
   ・1절: 사본을 가짜 전역에서 실제로 돌려 본다 — window.TwCharCore · r128 three 로 만들기 · 다른 판 · three 없음 거절 · 판 머리
   ・2절: 싣는 자리 — three.min.js 다음 · app.js 보다 먼저 · 한 번만
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, path.join('app', f), path.join(__dirname, f), path.join(__dirname, '..', 'apps', 'desktop', 'app', f)]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const CORE = read(path.join('vendor', 'char-core', 'char-core.iife.js'));
const HTML = read('desk-companion-prototype.html');
if (!CORE || !HTML) { say('  ? 원본 못 찾음 — vendor/char-core/char-core.iife.js · desk-companion-prototype.html'); process.exit(2); }

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(String(e && e.message)); } };

/* 브라우저 classic script 처럼 — 맨 위 var 가 전역(window)에 붙는다. window · localStorage 는 일부러 주지 않는다(코어는 안 쓴다). */
function load(src) {
  const g = {};
  new Function('self', 'globalThis', src + '\n;self.TwCharCore = typeof TwCharCore === "undefined" ? undefined : TwCharCore;')(g, g);
  return g.TwCharCore;
}
function scriptOrder(html) {
  return [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]);
}

function judge(core, html) {
  const r = {};
  try {
    const M = load(core);
    r.shape = !!M && typeof M.createCharCore === 'function' && M.THREE_REVISION === '128';
    const c = M.createCharCore({ THREE: { REVISION: '128' } });
    r.made = c.version === M.VERSION && c.threeRevision === '128' && Object.isFrozen(c);
    r.badRev = ['127', '129', ''].every(v => throws(() => M.createCharCore({ THREE: { REVISION: v } }), /r128/));
    r.noThree = throws(() => M.createCharCore({}), /THREE/) && throws(() => M.createCharCore(undefined), /THREE/);
    const head = /^\/\* @tw\/char-core (\S+) — 생성 파일/.exec(core);
    r.head = !!head && SEMVER.test(head[1]) && head[1] === M.VERSION;
  } catch (e) { r.err = String(e && e.message || e); }
  const order = scriptOrder(html);
  const at = (s) => order.indexOf(s);
  const coreAt = at('vendor/char-core/char-core.iife.js');
  r.once = order.filter(s => s === 'vendor/char-core/char-core.iife.js').length === 1;
  r.afterThree = coreAt > at('vendor/three/three.min.js') && at('vendor/three/three.min.js') >= 0;
  r.beforeApp = coreAt >= 0 && coreAt < at('parts/app.js');
  return r;
}
const ok = (r) => !r.err && r.shape && r.made && r.badRev && r.noThree && r.head && r.once && r.afterThree && r.beforeApp;

say('── 1절 · 사본을 실제로 돌려 본다');
const R = judge(CORE, HTML);
if (R.err) say('  · 던진 것: ' + R.err);
chk(R.shape, 'window.TwCharCore 에 createCharCore · THREE_REVISION "128" 이 있다');
chk(R.made, 'r128 three 로 만들면 판 · three 판을 알려 주고 얼어 있다');
chk(R.badRev, '다른 판 three(127 · 129 · 빈 값)는 거절한다');
chk(R.noThree, 'three 가 없으면 거절한다');
chk(R.head, '맨 위 «@tw/char-core <판> — 생성 파일» 머리의 판이 VERSION 과 같다');

say('── 2절 · 싣는 자리');
chk(R.once, 'html 이 한 번만 싣는다');
chk(R.afterThree, 'three.min.js 다음에 싣는다');
chk(R.beforeApp, 'app.js 보다 먼저 싣는다');

say('── 3절 · 일부러 깨 보기');
const MUT = [
  ['판 확인을 뺌', 'core', /if \(THREE\.REVISION !== THREE_REVISION\) \{/, 'if (false) {'],
  ['three 없음을 통과', 'core', /(deps\?\.THREE;\s*)if \(!THREE\) throw/, '$1if (false) throw'],
  ['전역 이름이 다름', 'core', /var TwCharCore = /, 'var TwCore = '],
  ['판 머리가 어긋남', 'core', /@tw\/char-core \d+\.\d+\.\d+/, '@tw/char-core 9.9.9'],
  ['app.js 뒤에 실음', 'html', /<script src="vendor\/char-core\/char-core\.iife\.js"><\/script>[^\n]*\n/, ''],
  ['three 앞에 실음', 'html', /<script src="vendor\/three\/three\.min\.js"><\/script>/, '<script src="vendor/char-core/char-core.iife.js"></script><script src="vendor/three/three.min.js"></script>'],
];
for (const [name, where, re, to] of MUT) {
  const src = where === 'core' ? CORE : HTML;
  if (!re.test(src)) { chk(false, `깨 보기 자리를 못 찾음 — ${name}`); continue; }
  const bad = src.replace(re, to);
  let html = where === 'html' ? bad : HTML;
  if (name === 'app.js 뒤에 실음') html = html.replace(/(<script src="parts\/app\.js"><\/script>)/, '$1<script src="vendor/char-core/char-core.iife.js"></script>');
  const r = judge(where === 'core' ? bad : CORE, html);
  chk(!ok(r), `${name} → 빨강`);
}

say(`\n  결과: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
