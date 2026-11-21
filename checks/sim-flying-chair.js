/* ═══ 🪑 sim-flying-chair.js — 플라잉체어(room/flying-chair.js · app.js 분리 M18) ═══════════════
   ・1절: canFly — 막는 까닭 일곱(좌석 없음 · 이미 남 · 캐릭터 없음 · 미리보기 · 흔들림/고정 · 올라탐(탑 허용 인자) · 벤치)
   ・2절: startFlight — 같은 시드면 같은 궤적 · 속도 범위 · 각도 대역 · _flyActive +1 · quiet · 실패 안내
   ・3절: _flyActive 읽는 · 쓰는 함수 · flySeed 범위 · 상수 · 시드를 안 주면 새로 뽑음
   ・4절: 연결 — deps 모양 · 옛 이름 · app.js 가 _flyActive 를 읽는 함수로 읽음
   ・5절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('room/flying-chair.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function build(src, o){
  o = o || {};
  const win = {}, toasts = [], seats = o.seats || [];
  new Function('window', 'module', src)(win, undefined);
  const mod = win.TwFlyingChair.createFlyingChair({ seats, toast: (m) => toasts.push(m) });
  return { mod, toasts, seats };
}
const M = build(SRC).mod;
say('§1 canFly');
{
  const why = (s, t, seats) => build(SRC, { seats: seats || [] }).mod.canFly(s, t);
  chk(!why(null).ok && why(null).why === '좌석이 없어요', '좌석이 없으면 안 된다');
  chk(why({ fly: {} }).why === '이미 날아가는 중이에요', '이미 날고 있으면 안 된다');
  chk(why({ isPlaceholder: true }).why === '아직 캐릭터가 없어요', '캐릭터가 없으면(placeholder) 안 된다');
  chk(why({ inPreview: true }).why === '미리보기 중에는 안 돼요', '미리보기 중에는 안 된다');
  chk(why({ beingShaken: true }).why === '지금은 날릴 수 없어요' && why({ pinned: true }).why === '지금은 날릴 수 없어요', '흔들리는 중 · 고정(핀)은 안 된다');
  const a = { ridingOn: {} };
  chk(why(a).why === '올라타 있는 동안에는 못 날아가요' && why(a, true).ok === true, '올라탄 좌석은 안 된다 — 단 allowTower 면 된다(룰렛 · 주사위로 나를 날릴 때)');
  const b = {}; const rider = { ridingOn: b };
  chk(why(b, false, [rider, b]).why === '올라타 있는 동안에는 못 날아가요', '누가 내 위에 올라탔어도 안 된다');
  chk(why({ seatedOn: {} }).why === '벤치에 앉아 있을 땐 못 날아가요' && why({ _benchOwnerSit: true }).why === '벤치에 앉아 있을 땐 못 날아가요' && why({ seatedOn: {} }, true).why === '벤치에 앉아 있을 땐 못 날아가요', '벤치에 앉은 좌석은 allowTower 여도 안 된다');
  chk(why({}).ok === true, '아무 걸림 없으면 된다');
}
say('§2 startFlight');
{
  const run = (seed) => { const b = build(SRC); const s = {}; const ok = b.mod.startFlight(s, seed); return { b, s, ok }; };
  const r1 = run(12345), r2 = run(12345), r3 = run(999);
  chk(r1.ok === true && r1.s.fly && r1.s.fly.phase === 'air' && r1.s.fly.dur === 10000 && r1.s.fly.seed === 12345, '날기 시작 — seat.fly 를 채운다(시드 · 공중 · 10초)');
  chk(JSON.stringify([r1.s.fly.vx, r1.s.fly.vy, r1.s.fly.spin]) === JSON.stringify([r2.s.fly.vx, r2.s.fly.vy, r2.s.fly.spin]), '★ 같은 시드면 같은 궤적(남의 화면에서도 같다)');
  chk(r1.s.fly.vx !== r3.s.fly.vx || r1.s.fly.vy !== r3.s.fly.vy, '시드가 다르면 궤적이 다르다');
  let okRange = true;
  for(let sd = 1; sd <= 200; sd++){
    const f = run(sd).s.fly; const spd = Math.hypot(f.vx, f.vy); const ang = Math.atan2(f.vy, Math.abs(f.vx)) * 180 / Math.PI;
    if(!(spd >= 9.5 * 0.8 - 1e-9 && spd <= 9.5 * 1.2 + 1e-9) || !(ang >= 32 - 1e-9 && ang <= 58 + 1e-9) || f.vy <= 0) okRange = false;
  }
  chk(okRange, '시드 200개 — 속력은 9.5 × (0.8 ~ 1.2) · 올라가는 각은 32° ~ 58° 사선 대역 · 늘 위로');
  const b = build(SRC); b.mod.startFlight({}, 1); b.mod.startFlight({}, 2);
  chk(b.mod._flyActive() === 2, '날 때마다 비행 중 수(_flyActive)가 오른다');
  const bb = build(SRC); const s = { fly: {} };
  chk(bb.mod.startFlight(s, 1) === false && bb.toasts[0] === '이미 날아가는 중이에요' && bb.mod._flyActive() === 0, '못 날리면 false · 안내(토스트) · 수는 안 오른다');
  const bq = build(SRC); bq.mod.startFlight({ fly: {} }, 1, true);
  chk(bq.toasts.length === 0, 'quiet 면 안내를 안 띄운다(남의 화면 재생)');
  const bn = build(SRC); const sn = {}; bn.mod.startFlight(sn);
  chk(!!sn.fly && Number.isInteger(sn.fly.seed) && sn.fly.seed >= 0, '시드를 안 주면 새로 뽑는다');
  const bz = build(SRC); const sz = {}; bz.mod.startFlight(sz, 0);
  chk(sz.fly.seed === 0, '시드 0 도 그대로 쓴다(null 만 새로 뽑는다)');
}
say('§3 값');
{
  const b = build(SRC); b.mod.setFlyActive(5); chk(b.mod._flyActive() === 5, '쓰는 함수로 바꾼 값을 읽는 함수가 읽는다');
  const sd = [...Array(50)].map(() => M.flySeed());
  chk(sd.every(x => Number.isInteger(x) && x >= 0 && x <= 0xFFFFFFFF) && new Set(sd).size > 40, 'flySeed — 0 ~ 2^32−1 정수 · 거의 겹치지 않음');
  chk(M.FLY_MS === 10000 && M.FLY_RETURN_MS === 450 && M.FLY_DIZZY_MS === 2500 && M.FLY_MIN_LEVEL === 100 && M.FLY_STREAK === 3 && M.FLY_STREAK_MS === 30000 && M.FLY_COOL_MS === 60000 && M.FLY_EDGE_X === 0.9 && M.FLY_EDGE_TOP === 0.9 && M.FLY_DROP === 0.18, '상수');
  const stripped = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  chk((stripped.match(/Math\.random\(\)/g) || []).length === 1, '★ Math.random() 은 flySeed 한 곳뿐(궤적은 시드로만)');
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/room/flying-chair.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iA > iM, 'html — flying-chair.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'flyChairMod', 'TwFlyingChair', 'createFlyingChair');
  chk(!!pairs && pairs.length === 2 && pairs[0].join() === 'seats,seats' && pairs[1].join() === 'toast,(...a)=>toast(...a)', 'deps 둘 — seats 값 · toast 함수 감싸개');
  chk(['FLY_MS', 'FLY_EDGE_X', 'FLY_EDGE_TOP', 'FLY_DROP', 'FLY_RETURN_MS', 'FLY_DIZZY_MS', 'FLY_MIN_LEVEL', 'FLY_STREAK', 'FLY_STREAK_MS', 'FLY_COOL_MS', 'flySeed', 'canFly', 'startFlight'].every(n => new RegExp('^const ' + n + ' = flyChairMod\\.' + n + ';', 'm').test(code)), '옛 이름 열셋을 const 로 받는다');
  chk(!/^let _flyActive\b/m.test(code) && !/function (canFly|startFlight|flySeed|_flyRng)\b/.test(code), '본문 · let 이 app.js 에 안 남음');
  chk((code.match(/flyChairMod\._flyActive\(\)/g) || []).length >= 3 && /setFlyActive: \(v\)=>\{ flyChairMod\.setFlyActive\(v\); \}/.test(code), '_flyActive 는 읽는 함수로 읽고 쓰는 함수로 쓴다');
}
say('§5 mutation test');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m1 = brk("if(seat.fly)                                 return {ok:false, why:'이미 날아가는 중이에요'};", "");
  chk(!!m1 && build(m1).mod.canFly({ fly: {} }).ok === true, '이미 나는 좌석 검사를 빼면 빨강');
  const m2 = brk("_flyActive++;", "");
  chk(!!m2 && (() => { const b = build(m2); b.mod.startFlight({}, 1); return b.mod._flyActive() === 0; })(), '비행 중 수를 안 올리면 빨강');
  const m3 = brk("const side = (r() < 0.5) ? -1 : 1;", "const side = (Math.random() < 0.5) ? -1 : 1;");
  chk(!!m3 && (m3.replace(/\/\*[\s\S]*?\*\//g, '').match(/Math\.random\(\)/g) || []).length === 2, '시드 대신 Math.random 을 쓰면 빨강(3절이 Math.random 개수를 센다)');
  const m4 = brk("FLY_ANG_MIN   = 32;", "FLY_ANG_MIN   = 0;");
  chk(!!m4 && (() => { let bad = false; for(let sd = 1; sd <= 200; sd++){ const s = {}; build(m4).mod.startFlight(s, sd); const ang = Math.atan2(s.fly.vy, Math.abs(s.fly.vx)) * 180 / Math.PI; if(ang < 32 - 1e-9) bad = true; } return bad; })(), '각도 하한을 풀면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
