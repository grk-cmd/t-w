/* sim-os-drag.js — 🪟 런처 화면에서 창 제목줄을 끌면 앱 창(OS 창)째 옮기는가(shared/os-drag.js · xmas-window.js)
   실행:  node checks/run.js sim-os-drag
   ★ 왜 — 런처 화면은 앱 창이 런처 카드 크기라, 그 안의 창을 DOM 으로 끌면 앱 창 테두리 밖으로 못 나간다(크리스마스 창 제보).
     런처가 켜져 있으면 main 의 끌기(win-drag.js)로 앱 창째 옮긴다 — 마이홈 창과 같은 규칙 한 벌.
   ・1절: createOsDrag 를 실제로 — 런처 켬 · 끔 · 통로 없음 · start/move/end 차례 · end 두 번 · 끌기 아닐 때 move/end 는 아무것도 안 함
   ・2절: 배선(싣는 순서 · smoke · app.js 가 크리스마스 창 deps 로) · 3절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('os-drag.js') || read('shared/os-drag.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js'), APP = read('app.js');
if (!MOD || !HTML || !SMOKE || !APP) { say('  ? 원본 못 찾음 — os-drag.js · desk-companion-prototype.html · smoke.js · app.js'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwOsDrag; };

function world(M, o){
  const calls = [];
  const launcher = o.noLauncher ? null : { classList: { contains: (c) => c === 'on' && !!o.launcherOn } };
  const comp = o.noComp ? null : (o.noDrag ? {} : { dragWindow: (p) => calls.push(p) });
  const d = M.createOsDrag({ doc: { getElementById: (id) => (id === 'launcher' ? launcher : null) }, companion: () => comp });
  return { d, calls };
}
function run(M){
  const r = {};
  { const w = world(M, { launcherOn: true });
    r.osBegin = w.d.begin() === true && w.calls.join() === 'start' && w.d.active();
    w.d.move(); w.d.move(); w.d.end();
    r.osSeq = w.calls.join() === 'start,move,move,end' && !w.d.active();
    w.d.end(); w.d.move();
    r.osAfter = w.calls.length === 4; }
  { const w = world(M, { launcherOn: false });
    r.domBegin = w.d.begin() === false && w.calls.length === 0;
    w.d.move(); w.d.end();
    r.domQuiet = w.calls.length === 0; }
  r.noComp = world(M, { launcherOn: true, noComp: true }).d.begin() === false;
  r.noDrag = world(M, { launcherOn: true, noDrag: true }).d.begin() === false;
  r.noLauncher = world(M, { noLauncher: true }).d.begin() === false;
  { const w = world(M, { launcherOn: true }); w.d.begin(); w.d.end();   // 끝난 뒤 다시 누르면 새 끌기
    r.again = w.d.begin() === true && w.calls.join() === 'start,end,start'; }
  return r;
}

say('── 1절 앱 창째 끌기 판단 · 차례');
const M = load(MOD);
const R = run(M);
chk(R.osBegin, '★ 런처가 켜져 있으면 앱 창째 — begin 이 true 이고 main 에 start');
chk(R.osSeq, '  ↳ move · move · end 가 그대로 main 에');
chk(R.osAfter, '  ↳ 끝난 뒤 end · move 는 아무것도 안 보낸다(main 끌기가 두 번 끝나지 않게)');
chk(R.domBegin && R.domQuiet, '★ 실행 화면(런처 꺼짐)이면 앱 창을 건드리지 않는다 — DOM 끌기');
chk(R.noComp && R.noDrag && R.noLauncher, '  ↳ companion 없음 · dragWindow 없음 · 런처 요소 없음이면 DOM 끌기');
chk(R.again, '  ↳ 끝난 뒤 다시 누르면 새로 start');

say('── 2절 배선');
const at = (s) => HTML.indexOf('src="parts/' + s + '"');
chk(at('shared/os-drag.js') > 0 && at('shared/os-drag.js') < at('app.js'), 'os-drag.js 를 app.js 보다 먼저 싣는다');
chk(/PRELOAD\.push\('os-drag\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 os-drag.js');
chk(/osDrag: TwOsDrag\.createOsDrag\(\{ doc: document, companion: \(\)=>window\.companion \}\)/.test(APP), 'app.js 가 크리스마스 창에 osDrag 를 deps 로');

say('── 3절 mutation test');
const mut = (from, to) => { if (!MOD.includes(from)) return null; const m = run(load(MOD.replace(from, to))); return Object.keys(R).some(k => R[k] !== m[k]); };
chk(mut("launcher.classList.contains('on') && ", '') === true, '★ 런처 켬 판단을 빼면 빨강');
chk(mut("function end(){ if (!on) return; on = false;", 'function end(){') === true, '  끝난 뒤 end 막기를 빼면 빨강');
chk(mut("function move(){ if (on) ", 'function move(){ ') === true, '  끌기 아닐 때 move 막기를 빼면 빨강');

say('');
say(fail ? `✗ ${pass} 통과 · ${fail} 실패` : `✓ ${pass} 통과`);
process.exit(fail ? 1 : 0);
