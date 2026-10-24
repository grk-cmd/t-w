/* ═══ 🖼 sim-img-retry.js — 남의 그림을 한 번 더 받을 주소 (shared/img-retry.js) ═══════════════
   ・1절: retryUrl — http(s) 만 · ? 가 있으면 & · 고정 표식(같은 주소 → 같은 결과 = 캐시가 걸린다) · 이미 표식이면 null(두 번까지) · dataURL · 빈 값 null
   ・2절: 쓰는 곳 — room-sync.js · animal.js 가 이 함수를 부르고 표식 규칙을 따로 쓰지 않는다 · html 이 두 파일보다 먼저 싣는다
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
const MOD = read('img-retry.js'), RS = read('room-sync.js'), AN = read('animal.js'), HTML = read('desk-companion-prototype.html');

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
  return r;
}
function judgeUse(rs, an, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  t(/TwImgRetry\.retryUrl\(/.test(rs) && !/twr=/.test(rs), 'room-sync.js 는 TwImgRetry.retryUrl 을 부르고 표식을 따로 쓰지 않는다');
  t(/TwImgRetry\.retryUrl\(/.test(an) && !/twr=/.test(an), 'animal.js 도 같다');
  const iM = html.indexOf('<script src="parts/shared/img-retry.js"></script>');
  const iR = html.indexOf('<script src="parts/room/room-sync.js"></script>'), iA = html.indexOf('<script src="parts/character/animal.js"></script>');
  t(iM > 0 && iM < iR && iM < iA, 'html — img-retry.js 를 room-sync.js · animal.js 보다 먼저 싣는다');
  return r;
}

say('── 1. retryUrl');
judgeFn(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 2. 쓰는 곳');
judgeUse(RS, AN, HTML).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. 일부러 깨 보기');
const breaks = [
  ['표식이 매번 달라짐', () => judgeFn(MOD.replace("const RETRY_MARK = 'twr=1';", "const RETRY_MARK = 'twr=' + Math.random();"))],
  ['? 를 안 가림', () => judgeFn(MOD.replace("(s.indexOf('?') >= 0 ? '&' : '?')", "'?'"))],
  ['dataURL 도 다시 받음', () => judgeFn(MOD.replace("if(!/^https?:/i.test(s)) return null;", ''))],
  ['두 번째도 다시 받음', () => judgeFn(MOD.replace("if(/[?&]twr=1(?:&|$)/.test(s)) return null;", ''))],
  ['room-sync 가 규칙을 따로 씀', () => judgeUse(RS.replace('TwImgRetry.retryUrl(', "(u=>u+'?twr=1')("), AN, HTML)],
  ['html 줄 빠짐', () => judgeUse(RS, AN, HTML.replace('<script src="parts/shared/img-retry.js"></script>', ''))],
];
for(const [name, run] of breaks){
  let rows; try{ rows = run(); }catch(_){ rows = [[false, '던짐']]; }
  chk(rows.some(([ok]) => !ok), name);
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
