/* sim-open-on-show.js — 🪟 창이 보이면 그 창의 기능 시작을 부탁(launcher/open-on-show.js)
   ・1절: 만들 때는 아무것도 안 함 · 창이 없으면 던짐
   ・2절: start — 이미 보이는 창은 바로 부탁 · 안 보이던 창이 class · style 바뀜으로 보이면 부탁 · 안 보이면 안 부탁
   ・3절: mutation test
   실행: node checks/run.js sim-open-on-show */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('launcher/open-on-show.js');
if (!SRC) { say('  ? 원본 못 찾음 — open-on-show.js'); process.exit(2); }

function judge(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const win = {}; new Function('window', 'module', src)(win, undefined);
  const obs = [];
  class MO { constructor(fn){ this.fn = fn; } observe(el, o){ obs.push({ el, o, fn: this.fn }); } }
  const el = (on) => ({ on });
  const a = el(false), b = el(true), asked = [];
  const mk = (targets) => win.TwOpenOnShow.createOpenOnShow({ open: (n) => asked.push(n), MutationObserver: MO, targets });
  let m;
  try { m = mk([{ name: 'gacha', el: a, shown: (e) => e.on }, { name: 'playlist', el: b, shown: (e) => e.on }]); } catch (e) { m = null; }
  t(m && asked.length === 0 && obs.length === 0, '만들 때는 지켜보기 · 부탁 0');
  let threw = null; try { mk([{ name: 'x', el: null, shown: () => true }]); } catch (e) { threw = e; }
  t(threw && /지켜볼 창이 없어요/.test(threw.message), '  창이 없으면 던진다(id 오타가 조용히 안 걸리지 않게)');
  if (!m) return r;
  m.start();
  t(asked.join() === 'playlist' && obs.length === 2 && obs.every((x) => x.o.attributeFilter.join() === 'class,style'), 'start — 이미 보이는 창은 바로 부탁 · 둘 다 class · style 을 지켜본다');
  obs[0].fn();
  t(asked.join() === 'playlist', '  안 보이는 채 바뀌면 부탁하지 않는다');
  a.on = true; obs[0].fn();
  t(asked.join() === 'playlist,gacha', '  보이게 바뀌면 그 이름으로 부탁한다(두 번째부터는 app-boot 가 무시)');
  return r;
}
say('── 1~2. 돌려 본다');
judge(SRC).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. mutation test');
for (const [name, from, to] of [
  ['처음 확인을 안 함', '      check(t);\n', ''],
  ['보이는지 안 봄', 'if(t.shown(t.el)) open(t.name);', 'open(t.name);'],
  ['style 을 안 봄', "attributeFilter: ['class', 'style']", "attributeFilter: ['class']"],
  ['창이 없어도 통과', "    if(!t || !t.el) throw new Error('[open-on-show] 지켜볼 창이 없어요: ' + (t && t.name));\n", ''],
]) {
  const m2 = SRC.replace(from, to);
  let red = m2 === SRC ? false : true;
  if (m2 !== SRC) { try { red = judge(m2).some(([ok]) => !ok); } catch (_) { red = true; } }
  chk(m2 !== SRC && red, name);
}
say('\n' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
