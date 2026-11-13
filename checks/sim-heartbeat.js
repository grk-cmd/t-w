/* ═══ 🩺 sim-heartbeat.js — 0.1초 하트비트 모듈 구조(launcher/heartbeat.js) ═══════════════
   app.js 의 하트비트 덩이(창 보임 구독 · 100ms setCharBounds)를 parts/launcher/heartbeat.js 로 옮겼다(글자 그대로 · 바뀐 줄 넷 — 읽는 함수 · deps 로 받은 남의 좌석 원).
   보내는 값 · 창이 안 보일 때 빼는 판단은 sim-heartbeat-policy.js 2절이 모듈을 돌려 본다. 여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 가짜 deps 위에서 던지지 않고 만들어진다 · 창 보임 구독 하나 · 100ms 타이머 하나 · 내놓는 이름(없음)
   ・2절: app.js 연결 — 옮긴 선언 · setCharBounds 가 app.js 에 안 남음 · deps 5줄 그대로 · runCost 는 app.js 한 벌 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] 스테이징(node checks/run.js heartbeat) 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = ['app.js', 'app/parts/app.js'].map(read).find(Boolean), HTML = ['desk-companion-prototype.html', 'app/desk-companion-prototype.html'].map(read).find(Boolean);
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ['heartbeat.js', 'parts/launcher/heartbeat.js', 'app/parts/launcher/heartbeat.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — heartbeat.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ['otherSeatCircles'];
const VAL_DEPS = ['runCost'];
const GET_DEPS = ['_charBadWhy', '_charBoundsLatest', '_twMoveSeenAt'];
const EXPORTS = [];
const MOVED = ['_hbWinShown'];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ['  _charBadWhy: ()=>_charBadWhy,', '  _charBoundsLatest: ()=>_charBoundsLatest,', '  _twMoveSeenAt: ()=>_twMoveSeenAt,', '  otherSeatCircles: (...a)=>statusChipMod.otherSeatCircles(...a),', '  runCost: runCost,'];
const MAKE = 'const heartbeatMod = TwHeartbeat.createHeartbeat({';

/* 만들 때 건 것(구독 · 타이머)을 센다 — 타이머는 돌리지 않는다(돌려 보는 것은 sim-heartbeat-policy 2절) */
function build(src){
  const subs = [], timers = [];
  const companion = { onWinShown: (cb) => subs.push(cb), setCharBounds: () => {} };
  const win = { companion };
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => []; });
  GET_DEPS.forEach(n => { deps[n] = () => null; });
  deps.runCost = { timed: (k, fn) => fn };
  const api = new Function('window', 'companion', 'TwHeartbeatPolicy', 'setInterval', 'module', src + '\nreturn window.TwHeartbeat;')(
    win, companion, { fullStep: () => true }, (fn, ms) => { timers.push(ms); return 1; }, undefined);
  const out = api.createHeartbeat(deps);
  return { out, subs: subs.length, timers };
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let b = null, err = null;
  try{ b = build(mod); }catch(e){ err = e; }
  t(!err && b && b.out && typeof b.out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(b && b.subs === 1 && b.timers.length === 1 && b.timers[0] === 100, '만들 때 창 보임 구독 하나 · 100ms 타이머 하나' + (b ? ' — 받은 값: 구독 ' + b.subs + ' · 타이머 ' + b.timers.join(',') : ''));
  t(b && b.out && EXPORTS.every(n => n in b.out) && Object.keys(b.out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개');
  t(/window\.TwHeartbeat = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwHeartbeat(Tw 접두사)');
  const A = strip(app);
  const left = MOVED.filter(n => new RegExp('^(?:const|let|var)\\s+' + n + '\\b', 'm').test(A));
  t(!left.length && !/companion\.setCharBounds\(/.test(A) && !/companion\.onWinShown\(/.test(A), 'app.js 에 옮긴 선언 · setCharBounds · onWinShown 이 안 남았다' + (left.length ? ' — ' + left.join(' · ') : ''));
  t(/^const runCost = TwRunCostDiag\.page;/m.test(A) && /^const runCost = deps\.runCost;/m.test(mod) && !/TwRunCostDiag/.test(strip(mod)), 'runCost 는 app.js 한 벌(프레임 · 다른 모듈과 같은 것)을 deps 로 받는다');
  const i = app.indexOf(MAKE), iRc = app.indexOf('const runCost = TwRunCostDiag.page;');
  t(i > 0 && iRc > 0 && iRc < i, '만드는 줄 — runCost 선언 뒤(TDZ 없음)');
  const mk = (app.match(/const heartbeatMod = TwHeartbeat\.createHeartbeat\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').join('\n') === GLUE.join('\n'), 'deps ' + GLUE.length + '개 — 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ')');
  const M = strip(mod);
  t(!/statusChipMod/.test(M) && !/\b_charBoundsLatest\s*\|\|/.test(M) && !/\b_twMoveSeenAt\s*\?/.test(M), '모듈은 상태칩 모듈을 직접 안 부르고 · 다시 대입되는 값은 이름() 으로 읽는다');
  const iM = html.indexOf('<script src="parts/launcher/heartbeat.js"></script>'), iP = html.indexOf('<script src="parts/launcher/heartbeat-policy.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM && iP > 0, 'html — parts/launcher/heartbeat.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 4) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/launcher/heartbeat.js"></script>', '')],
  ['deps 하나 빠짐', null, a => a.replace('\n  _twMoveSeenAt: ()=>_twMoveSeenAt,\n  otherSeatCircles', '\n  otherSeatCircles'), null],
  ['전역 이름 안 걺', m => m.replace('window.TwHeartbeat = api;', ''), null, null],
  ['만들 때 던짐', m => m.replace('function createHeartbeat(deps){', 'function createHeartbeat(deps){ throw new Error("깨 봄");'), null, null],
  ['타이머 주기 바뀜', m => m.replace('}), 100);', '}), 1000);'), null, null],
  ['app.js 에 하트비트가 다시 생김', null, a => a + '\nsetInterval(()=>{ companion.setCharBounds({}); }, 100);', null],
  ['모듈이 상태칩을 직접 부름', m => m.replace('others: _hbFull ? otherSeatCircles()', 'others: _hbFull ? statusChipMod.otherSeatCircles()'), null, null],
  ['읽는 함수를 값처럼 씀', m => m.replace('const _b = _charBoundsLatest() ||', 'const _b = _charBoundsLatest ||'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
