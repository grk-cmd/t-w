/* ═══ 🔁 sim-retry-delay.js — 못 받은 뒤 다시 받기까지 쉬는 시간 (shared/retry-delay.js) ═══
   30초부터 두 배씩, 10분 상한. 경계(0 · 음수 · 소수 · 숫자 아님 · 아주 큰 수)와 html · smoke 순서, 일부러 깨 보기.
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (n) => n.map(read).find(Boolean);
const SRC = pick(['retry-delay.js', 'parts/shared/retry-delay.js', 'app/parts/shared/retry-delay.js']);
const HTML = pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']), SMOKE = read('smoke.js');
if(!SRC || !HTML || !SMOKE){ console.log('  ? 원본 못 찾음'); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwRetryDelay; };
function judge(src){
  const r = [];
  try{
    const D = load(src);
    r.push([[D.delay(0), D.delay(1), D.delay(2), D.delay(3)].join() === '30000,60000,120000,240000', '30초부터 두 배씩']);
    r.push([D.delay(4) === 480000 && D.delay(5) === 600000 && D.delay(50) === 600000 && D.delay(1e9) === 600000, '10분이 상한(아주 큰 수도)']);
    r.push([D.delay(-3) === 30000 && D.delay(NaN) === 30000 && D.delay('x') === 30000 && D.delay(undefined) === 30000 && D.delay(1.9) === 60000, '이상한 값(음수 · 숫자 아님 · 소수)은 처음 값으로']);
  }catch(e){ r.push([false, '던짐 ' + e.message]); }
  return r;
}
const out = judge(SRC); out.forEach(([ok, m]) => chk(ok, m));
const tag = (f) => HTML.indexOf('<script src="parts/' + f + '"></script>');
chk(tag('shared/retry-delay.js') > 0 && tag('shared/retry-delay.js') < tag('myhome/mail-feed.js') && tag('myhome/mail-feed.js') < tag('app.js'), 'html — retry-delay.js 를 mail-feed.js · app.js 보다 먼저');
chk(/PRELOAD\.push\('retry-delay\.js'\)/.test(SMOKE), 'smoke PRELOAD');
say('── 일부러 깨 보기');
for(const [name, from, to] of [['상한이 너무 큼', 'RETRY_MAX_MS = 10 * 60000', 'RETRY_MAX_MS = 1e12'], ['두 배가 아님', 'Math.pow(2, k)', 'k + 1'], ['30초가 아님', 'RETRY_MS = 30000', 'RETRY_MS = 1000'], ['NaN 을 그대로', 'Math.floor(Number(n)) || 0', 'Math.floor(Number(n))']]){
  const bad = SRC.replace(from, to);
  chk(bad !== SRC && judge(bad).some(([ok]) => !ok), name + ' → 빨강');
}
say('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
