/* ═══ 🗼 sim-ride-chain.js — 탑 바닥 찾기(ride-chain.js) 동작 · 연결 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   ride-bench.js 의 _rideBottom 을 순수 모듈 ride-chain.js 로 내렸다(글자 그대로) — 좌석 줄 배치가 올라타기 모듈을 부르지 않고 같이 쓰게.
   ・1절: 동작 — 안 탄 좌석 · 사슬 · 순환(상한 16) · 빈 값
   ・2절: 연결 — app.js 가 ride-bench 보다 먼저 만든다 · ride-bench 는 deps 로 받아 예전처럼 내놓는다 · 정의가 한 벌 · html 순서
   ・3절: 일부러 깨 보기
   [실행] ride-chain.js · ride-bench.js · app.js · desk-companion-prototype.html 이 있는 폴더에서(러너 스테이징). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/parts/room/' + f, 'app/' + f]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('ride-chain.js'), RB = read('ride-bench.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!MOD || !RB || !APP || !HTML){ say('  ? 원본 못 찾음 — ride-chain.js · ride-bench.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function load(src){ const win = {}; new Function('window', 'module', src)(win, undefined); return win.TwRideChain.createRideChain({}); }
say('── 1. 동작');
const C = load(MOD);
const a = { n: 'a' }, b = { n: 'b', ridingOn: a }, c = { n: 'c', ridingOn: b };
chk(C._rideBottom(a) === a, '안 탄 좌석은 자기 자신');
chk(C._rideBottom(b) === a && C._rideBottom(c) === a, '1층 · 2층 모두 맨 아래 좌석');
const x = { n: 'x' }, y = { n: 'y', ridingOn: x }; x.ridingOn = y;
let r, threw = null; try{ r = C._rideBottom(x); }catch(e){ threw = e; }
chk(!threw && (r === x || r === y), '순환(x ↔ y)이어도 16번에서 멈춘다(무한 반복 없음)');
const long = [{ n: 0 }]; for(let i = 1; i <= 20; i++) long.push({ n: i, ridingOn: long[i - 1] });
chk(C._rideBottom(long[20]) === long[4], '경계 — 17번 넘게 쌓이면 16번 올라간 자리에서 멈춘다(옮기기 전과 같다)');
chk(C._rideBottom(null) === null && C._rideBottom(undefined) === undefined, '빈 값은 그대로 돌려준다');

function judge(mod, rb, app, html){
  const out = [];
  const t = (ok, m) => out.push([!!ok, m]);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  t(/function _rideBottom\(seat\)\{/.test(mod) && !/function _rideBottom\(/.test(strip(rb)) && !/function _rideBottom\(/.test(strip(app)), '_rideBottom 정의는 ride-chain.js 한 벌');
  t(/^const _rideBottom = deps\._rideBottom;$/m.test(rb) && /_rideBottom,/.test(rb.slice(rb.lastIndexOf('\nreturn {'))), 'ride-bench 는 deps 로 받아 예전처럼 내놓는다');
  const iC = app.indexOf('const rideChainMod = TwRideChain.createRideChain({'), iB = app.indexOf('const rideBenchMod = TwRideBench.createRideBench({');
  t(iC > 0 && iB > iC, 'app.js 는 ride-chain 을 ride-bench 보다 먼저 만든다');
  const blk = iB > 0 ? app.slice(iB, app.indexOf('\n});', iB)) : '';
  t(/\n  _rideBottom: \(\.\.\.a\)=>rideChainMod\._rideBottom\(\.\.\.a\),/.test(blk), 'ride-bench deps 에 _rideBottom → rideChainMod');
  const hC = html.indexOf('<script src="parts/room/ride-chain.js"></script>'), hA = html.indexOf('<script src="parts/app.js"></script>');
  t(hC > 0 && hA > hC, 'html — ride-chain.js 를 app.js 보다 먼저 싣는다');
  return out;
}
say('── 2. 연결');
judge(MOD, RB, APP, HTML).forEach(([ok, m]) => chk(ok, m));
say('── 3. 일부러 깨 보기');
const breaks = [
  ['ride-bench 에 정의가 다시 생김', [MOD, RB + '\nfunction _rideBottom(s){ return s; }', APP, HTML]],
  ['ride-bench 가 deps 로 안 받음', [MOD, RB.replace('const _rideBottom = deps._rideBottom;', ''), APP, HTML]],
  ['만드는 줄 순서 뒤바뀜', [MOD, RB, APP.replace('const rideChainMod = TwRideChain.createRideChain({', 'const rideChainMod_ = 0; ({') + '\nconst rideChainMod = TwRideChain.createRideChain({', HTML]],
  ['html 줄 빠짐', [MOD, RB, APP, HTML.replace('<script src="parts/room/ride-chain.js"></script>', '')]],
];
for(const [name, args] of breaks){ const rows = judge(...args); chk(rows.some(([ok]) => !ok), name); }
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
