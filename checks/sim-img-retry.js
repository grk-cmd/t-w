/* ═══ 🖼 sim-img-retry.js — 남의 그림을 한 번 더 받을 주소 (shared/img-retry.js) ═══════════════
   ・1절: retryUrl — http(s) 만 · ? 가 있으면 & · 고정 표식(같은 주소 → 같은 결과 = 캐시가 걸린다) · 이미 표식이면 null(두 번까지) · dataURL · 빈 값 null
   ・1-2절: loadWithRetry — 받기 함수를 실제로 불러 처음 실패면 표식 주소로 한 번 더 · dataURL · 이미 표식이면 처음 실패 그대로 · 둘 다 실패면 두 번째 실패
   ・2절: 쓰는 곳 — room-sync.js · face-heal.js 는 loadWithRetry, animal.js 는 retryUrl 을 부르고 표식 규칙을 따로 쓰지 않는다 · html 이 먼저 싣는다
   ・3절: 일부러 깨 보기
   [실행] node checks/run.js sim-img-retry */
'use strict';
const fs = require('fs');
const path = require('path');
function findUp(name){
  const stack = ['.'];
  while(stack.length){
    const d = stack.shift();
    const f = path.join(d, name);
    if(fs.existsSync(f)) return f;
    for(const e of fs.readdirSync(d, { withFileTypes: true })) if(e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) stack.push(path.join(d, e.name));
  }
  return null;
}
const read = (n) => { const f = findUp(n); return f ? fs.readFileSync(f, 'utf8') : ''; };
const MOD = read('img-retry.js'), RS = read('room-sync.js'), AN = read('animal.js'), FH = read('face-heal.js'), HTML = read('desk-companion-prototype.html');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };

function judgeFn(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let api;
  try{ const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); api = m.exports; }
  catch(e){ t(false, '싣다 던짐 — ' + String(e.message || e).slice(0, 80)); return r; }
  const f = api.retryUrl;
  if(typeof f !== 'function'){ t(false, 'retryUrl 이 없음'); return r; }
  t(f('https://s.test/a.png') === 'https://s.test/a.png?twr=1', '? 없는 주소 — ?twr=1');
  t(f('https://s.test/o/a.png?alt=media&token=x') === 'https://s.test/o/a.png?alt=media&token=x&twr=1', '★ ? 가 있는 주소(Storage) — &twr=1');
  t(f('https://s.test/a.png') === f('https://s.test/a.png'), '★ 같은 주소는 늘 같은 다시 받을 주소(고정 표식 — 다음부터 캐시에 걸린다)');
  t(f('https://s.test/a.png?twr=1') === null && f('https://s.test/a.png?x=1&twr=1') === null, '  이미 다시 받은 주소 — null(두 번까지만)');
  t(f('data:image/png;base64,AA') === null && f('') === null && f(null) === null && f(undefined) === null, '  dataURL · 빈 값 — null');
  t(f('HTTP://S.TEST/A.PNG') === 'HTTP://S.TEST/A.PNG?twr=1', '  대문자 http 도 주소로 본다');
  const g = api.laterRetryMs;
  if(typeof g !== 'function'){ t(false, 'laterRetryMs 가 없음'); return r; }
  const u = 'https://s.test/a.png';
  const w = [0, 1, 2, 3, 4].map((n) => g(u, n));
  t(w[0] > 0 && w[1] > w[0] && w[2] > w[1] && w[3] === null && w[4] === null, '★ 나중 받기 — 점점 길게 세 번까지 · 그 뒤 null(늘 받기 없음)');
  t(g(u + '?twr=1', 0) === w[0], '  다시 받은 주소(표식)도 나중 받기는 같다');
  t(g('data:image/png;base64,AA', 0) === null && g('', 0) === null && g(null, 0) === null, '  dataURL · 빈 값 — null');
  t(g(u, -1) === null && g(u, 1.5) === null, '  이상한 횟수 — null');
  return r;
}
/* 받기 함수를 흉내 — fails 에 든 주소는 실패. 부른 주소를 순서대로 남긴다 */
async function judgeLoad(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let api;
  try{ const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); api = m.exports; }
  catch(e){ t(false, '싣다 던짐 — ' + String(e.message || e).slice(0, 80)); return r; }
  const L = api.loadWithRetry;
  if(typeof L !== 'function'){ t(false, 'loadWithRetry 가 없음'); return r; }
  const mk = (fails) => { const calls = []; const load = async (u) => { calls.push(u); if(fails.includes(u)) throw new Error('x:' + u); return { src: u }; }; return { calls, load }; };
  const U = 'https://s.test/o/a.png?alt=media&token=t';
  const run = async (fails, u) => { const m = mk(fails); try{ return { v: await L(m.load, u), calls: m.calls }; }catch(e){ return { err: e.message, calls: m.calls }; } };
  const a = await run([], U);
  t(a.v && a.v.src === U && a.calls.length === 1, '받히면 — 한 번만 받는다');
  const b = await run([U], U);
  t(b.v && b.v.src === U + '&twr=1' && b.calls.join() === [U, U + '&twr=1'].join(), '★ 처음 실패 — 표식 주소로 한 번 더 받아 그것을 돌려준다');
  const c = await run([U, U + '&twr=1'], U);
  t(c.err === 'x:' + U + '&twr=1' && c.calls.length === 2, '  둘 다 실패 — 두 번째 실패를 던진다(세 번째는 없음)');
  const D = 'data:image/png;base64,AA';
  const d = await run([D], D);
  t(d.err === 'x:' + D && d.calls.length === 1, '★ dataURL — 다시 받지 않고 처음 실패 그대로');
  const e = await run([U + '&twr=1'], U + '&twr=1');
  t(e.err && e.calls.length === 1, '  이미 표식 주소 — 다시 받지 않는다');
  return r;
}
function judgeUse(rs, an, html, fh){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  t(/TwImgRetry\.loadWithRetry\(_loadImgCors,/.test(rs) && !/twr=/.test(rs), 'room-sync.js 는 TwImgRetry.loadWithRetry 를 부르고 표식을 따로 쓰지 않는다');
  t(/TwImgRetry\.loadWithRetry\(loadImgCors,/.test(fh) && !/twr=/.test(fh), 'face-heal.js(그래픽 리셋 뒤 다시 그리기)도 같은 함수를 부른다');
  t(/TwImgRetry\.retryUrl\(/.test(an) && !/twr=/.test(an), 'animal.js 도 같다');
  const iM = html.indexOf('<script src="parts/shared/img-retry.js"></script>');
  const iR = html.indexOf('<script src="parts/room/room-sync.js"></script>'), iA = html.indexOf('<script src="parts/character/animal.js"></script>');
  t(iM > 0 && iM < iR && iM < iA, 'html — img-retry.js 를 room-sync.js · animal.js 보다 먼저 싣는다');
  return r;
}

say('── 1. retryUrl');
judgeFn(MOD).forEach(([ok, msg]) => chk(ok, msg));
(async () => {
say('── 1-2. loadWithRetry');
(await judgeLoad(MOD)).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. 쓰는 곳');
judgeUse(RS, AN, HTML, FH).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기');
const breaks = [
  ['표식이 매번 달라짐', () => judgeFn(MOD.replace("const RETRY_MARK = 'twr=1';", "const RETRY_MARK = 'twr=' + Math.random();"))],
  ['? 를 안 가림', () => judgeFn(MOD.replace("(s.indexOf('?') >= 0 ? '&' : '?')", "'?'"))],
  ['dataURL 도 다시 받음', () => judgeFn(MOD.replace("if(!/^https?:/i.test(s)) return null;", ''))],
  ['나중 받기 상한 없음', () => judgeFn(MOD.replace('(Number.isInteger(n) && n >= 0 && n < LATER_RETRY_MS.length) ? LATER_RETRY_MS[n] : null', 'LATER_RETRY_MS[0]'))],
  ['나중 받기가 dataURL 도 받음', () => judgeFn(MOD.replace("  if(!/^https?:/i.test(String(u == null ? '' : u))) return null;\n", ''))],
  ['두 번째도 다시 받음', () => judgeFn(MOD.replace("if(/[?&]twr=1(?:&|$)/.test(s)) return null;", ''))],
  ['room-sync 가 규칙을 따로 씀', () => judgeUse(RS.replace('TwImgRetry.loadWithRetry(_loadImgCors, url)', "_loadImgCors(url + '?twr=1')"), AN, HTML, FH)],
  ['face-heal 이 다시 받지 않음', () => judgeUse(RS, AN, HTML, FH.replace('TwImgRetry.loadWithRetry(loadImgCors, u)', 'loadImgCors(u)'))],
  ['html 줄 빠짐', () => judgeUse(RS, AN, HTML.replace('<script src="parts/shared/img-retry.js"></script>', ''), FH)],
];
breaks.push(
  ['처음 실패 뒤 다시 안 받음', () => judgeLoad(MOD.replace("    const again = retryUrl(u);\n    if(!again) throw e;\n    return load(again);", '    throw e;'))],
  ['다시 받을 주소 규칙을 안 씀', () => judgeLoad(MOD.replace("    const again = retryUrl(u);", "    const again = u + '?twr=1';"))],
);
for(const [name, run] of breaks){
  let rows; try{ rows = await run(); }catch(_){ rows = [[false, '던짐']]; }
  chk(rows.some(([ok]) => !ok), name);
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
