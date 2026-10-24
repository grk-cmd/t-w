/*
 * 🎰 가챠 트랜잭션 한 길(character/gacha-tx.js) 검사.
 * 1. firebase-init.js 연결 — import · 만들기 · updateGacha 가 이 모듈로만 · 통째 set 없음
 * 2. updateGacha 를 가짜 SDK(get · runTransaction · 연결 · 타이머)로 돌린다 —
 *    첫 시도 cur=null 이면 사전 get 값 · 재시도는 실제 값 · null 이면 안 씀 · 연결 없음 · 거부 · 오류 ·
 *    시간 초과(사전 get 이 걸려도) · 늦게 붙은 저장은 committed 일 때만 onLate 한 번 · 그만둔 뒤 재시도는 쓰지 않음
 * 3. 깨 보기 — 위 판단을 하나씩 지운 판이 빨강인가
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js'), TX = read('gacha-tx.js');
if(!FI){ say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }
if(!TX){ say('  ? 원본 못 찾음 — gacha-tx.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);

say('── 1. firebase-init.js 연결');
chk(/import \{ createGachaTx \} from "\.\/character\/gacha-tx\.js";/.test(CODE), 'gacha-tx.js 를 import 한다');
chk(/const _gachaTx = createGachaTx\(\{ db, ref, get, runTransaction, waitConnected: ms => window\.firebaseAPI\.waitConnected\(ms\), whenAuthReady: _whenAuthReady \}\);/.test(CODE), '  db · SDK · 연결 확인 · 인증 대기를 넘겨 만든다');
chk(/updateGacha\(uid, apply, opt\)\{ return _gachaTx\.updateGacha\(uid, apply, opt\); \}/.test(CODE) && !/saveGachaOwned/.test(CODE), '  updateGacha 는 이 모듈로만 · 통째 쓰기(saveGachaOwned) 없음');
chk(!/from ["']https:\/\/www\.gstatic\.com/.test(strip(TX)), 'gacha-tx.js 는 Firebase 를 직접 import 하지 않는다');

/* ESM 을 함수로 — export 만 떼어 내고, 타이머는 가짜로 갈아 끼운다 */
function load(src){
  const body = src.replace(/^export (const|function)/mg, '$1') + '\nreturn { createGachaTx, gachaFailReason, GACHA_TX_TIMEOUT_MS, GACHA_CONNECT_WAIT_MS };';
  return (clock) => new Function('setTimeout', 'clearTimeout', 'console', body)(clock.setTimeout, clock.clearTimeout, { warn(){} });
}
function mkClock(){
  const ts = []; let id = 0;
  return { ts, setTimeout: (fn, ms) => { ts.push({ id: ++id, fn, ms }); return id; }, clearTimeout: (i) => { const k = ts.findIndex(t => t.id === i); if(k >= 0) ts.splice(k, 1); },
    fire(){ const t = ts.shift(); if(t) t.fn(); return !!t; } };
}
const tick = () => new Promise(r => setImmediate(r));
async function flush(n){ for(let i = 0; i < (n || 6); i++) await tick(); }

/* 가짜 SDK — 서버 값 · 첫 시도 cur=null · 다른 PC 의 쓰기 · 거부 · 걸림 */
function mkSdk(o){
  const env = Object.assign({ srv: null, connected: true, getThrows: null, txThrows: null, getHang: false, txHang: false, raceWith: undefined, runs: [], writes: [] }, o || {});
  let releaseGet = null, releaseTx = null;
  env.sdk = {
    db: {}, ref: (db, p) => ({ p }),
    get: async () => { if(env.getHang) await new Promise(r => { releaseGet = r; }); if(env.getThrows) throw env.getThrows; return { val: () => env.srv }; },
    runTransaction: async (r, fn) => {
      if(env.txThrows) throw env.txThrows;
      if(env.txHang) await new Promise(res => { releaseTx = res; });
      let cur = null;                          // SDK 첫 시도 — 아직 모름
      for(let i = 0; i < 4; i++){
        env.runs.push(cur);
        const next = fn(cur);
        if(next === undefined) return { committed: false, snapshot: { val: () => env.srv } };
        if(i === 0 && env.raceWith !== undefined){ env.srv = env.raceWith; env.raceWith = undefined; cur = env.srv; continue; }   // 다른 PC 가 먼저 씀
        if(JSON.stringify(cur) !== JSON.stringify(env.srv)){ cur = env.srv; continue; }   // 추측이 틀렸다 → 실제 값으로 다시
        env.srv = next; env.writes.push(next);
        return { committed: true, snapshot: { val: () => env.srv } };
      }
      throw new Error('maxretry');
    },
    waitConnected: async () => env.connected,
    whenAuthReady: async () => {},
  };
  env.releaseGet = () => releaseGet && releaseGet();
  env.releaseTx = () => releaseTx && releaseTx();
  return env;
}

async function suite(src, quiet){
  const res = [];
  const ck = (ok, m) => { res.push(ok); if(!quiet) chk(ok, m); };
  const L = load(src);
  const add1 = cur => ({ owned: Object.assign({}, (cur && cur.owned) || {}, { a: (((cur && cur.owned) || {}).a | 0) + 1 }), ts: 5 });

  /* 첫 시도 cur=null → 사전 get 값으로 셈 */
  let clock = mkClock(), e = mkSdk({ srv: { owned: { a: 2 }, ts: 1 } }), M = L(clock).createGachaTx(e.sdk);
  let seen = [];
  let r = await M.updateGacha('u1', cur => { seen.push(cur && cur.owned && cur.owned.a); return add1(cur); });
  ck(r.ok && r.committed && e.srv.owned.a === 3 && seen[0] === 2, '첫 시도 cur=null 이면 사전 get 값(2)으로 센다 → 3 (' + JSON.stringify(seen) + ')');
  ck(r.value && r.value.owned.a === 3, '  돌려주는 값은 저장된 서버 값');

  /* 다른 PC 가 먼저 쓰면 새 값으로 다시 */
  clock = mkClock(); e = mkSdk({ srv: { owned: { a: 1 }, ts: 1 }, raceWith: { owned: { a: 5 }, ts: 2 } }); M = L(clock).createGachaTx(e.sdk);
  r = await M.updateGacha('u1', add1);
  ck(r.ok && e.srv.owned.a === 6, '다른 PC 가 먼저 쓰면 그 값 위에서 다시 센다 → 6');

  /* null → 쓰지 않음 */
  clock = mkClock(); e = mkSdk({ srv: { owned: { a: 1 }, ts: 1 } }); M = L(clock).createGachaTx(e.sdk);
  r = await M.updateGacha('u1', () => null);
  ck(r.ok && r.committed === false && !e.writes.length, 'apply 가 null 이면 쓰지 않는다(committed false)');

  /* 연결 없음 · uid 없음 */
  clock = mkClock(); e = mkSdk({ connected: false }); M = L(clock).createGachaTx(e.sdk);
  r = await M.updateGacha('u1', add1);
  ck(!r.ok && r.reason === 'offline' && !e.runs.length, '연결이 없으면 offline — 트랜잭션을 걸지 않는다');
  r = await M.updateGacha('', add1);
  ck(!r.ok && r.reason === 'error', 'uid 가 없으면 바로 실패');

  /* 거부 · 오류 */
  for(const [where, err, want] of [['get', { code: 'PERMISSION_DENIED' }, 'denied'], ['tx', new Error('permission_denied'), 'denied'], ['tx', new Error('boom'), 'error'], ['get', new Error('net'), 'error']]){
    clock = mkClock(); e = mkSdk({ srv: null, getThrows: where === 'get' ? err : null, txThrows: where === 'tx' ? err : null }); M = L(clock).createGachaTx(e.sdk);
    r = await M.updateGacha('u1', add1);
    ck(!r.ok && r.reason === want, where + ' 실패(' + (err.code || err.message) + ') → ' + want);
  }

  /* 시간 초과 — 트랜잭션이 걸림 → timeout · 늦게 붙으면 onLate 한 번 */
  clock = mkClock(); e = mkSdk({ srv: { owned: {}, ts: 0 }, txHang: true }); M = L(clock).createGachaTx(e.sdk);
  let late = [];
  let p = M.updateGacha('u1', add1, { onLate: v => late.push(v) });
  await flush(); clock.fire();
  r = await p;
  ck(!r.ok && r.reason === 'timeout' && !late.length, '트랜잭션이 걸리면 상한 뒤 timeout');
  e.releaseTx(); await flush();
  ck(late.length === 0 && e.writes.length === 0, '  그만둔 뒤 다시 도는 시도는 쓰지 않는다(gaveUp)');

  /* 시간 초과 — 이미 서버로 간 시도가 늦게 붙는 경우 */
  {
    const c2 = mkClock(), e2 = mkSdk({ srv: { owned: {}, ts: 0 } });
    let resolveLate; e2.sdk.runTransaction = () => new Promise(res => { resolveLate = res; });
    const M2 = L(c2).createGachaTx(e2.sdk); const late2 = [];
    const p2 = M2.updateGacha('u1', add1, { onLate: v => late2.push(v) });
    await flush(); c2.fire(); await p2;
    resolveLate({ committed: true, snapshot: { val: () => ({ owned: { a: 1 }, ts: 9 }) } }); await flush();
    ck(late2.length === 1 && late2[0].owned.a === 1, '  시간 초과 뒤 늦게 committed 되면 onLate 로 한 번 알린다');
    const c3 = mkClock(), e3 = mkSdk({ srv: { owned: {}, ts: 0 } });
    let resolve3; e3.sdk.runTransaction = () => new Promise(res => { resolve3 = res; });
    const M3 = L(c3).createGachaTx(e3.sdk); const late3 = [];
    const p3 = M3.updateGacha('u1', add1, { onLate: v => late3.push(v) });
    await flush(); c3.fire(); await p3;
    resolve3({ committed: false, snapshot: { val: () => null } }); await flush();
    ck(late3.length === 0, '  늦게 «그만둠» 으로 끝나면 onLate 를 부르지 않는다');
  }

  /* 사전 get 이 걸려도 상한이 덮는다 */
  clock = mkClock(); e = mkSdk({ srv: { owned: {}, ts: 0 }, getHang: true }); M = L(clock).createGachaTx(e.sdk);
  p = M.updateGacha('u1', add1);
  await flush(); clock.fire(); r = await p;
  ck(!r.ok && r.reason === 'timeout', '사전 get 이 걸려도 상한 뒤 timeout(뽑기 창이 잠긴 채 남지 않는다)');
  e.releaseGet(); await flush();
  ck(!e.runs.length && !e.writes.length, '  그 뒤 get 이 풀려도 트랜잭션을 걸지 않는다');
  ck(L(mkClock()).GACHA_TX_TIMEOUT_MS === 10000 && L(mkClock()).GACHA_CONNECT_WAIT_MS === 3000, '상수 — 응답 상한 10초 · 연결 확인 3초');
  return res;
}

(async () => {
  say('── 2. updateGacha 를 가짜 SDK 로 돌린다');
  await suite(TX, false);
  say('── 3. 깨 보기 — 하나씩 지운 판은 빨강이어야 한다');
  const muts = [
    ['사전 get 값 대신 cur 그대로', TX.replace('apply(cur == null ? pre : cur)', 'apply(cur)')],
    ['그만둔 뒤 재시도 막기 지움', TX.replace('          if(gaveUp) return;                               // undefined = 그만둠\n', '')],
    ['늦은 저장 committed 확인 지움', TX.replace('if(v.ok && v.committed && opt && opt.onLate)', 'if(opt && opt.onLate)')],
    ['연결 확인 지움', TX.replace("if(!(await waitConnected(GACHA_CONNECT_WAIT_MS))) return { ok:false, reason:'offline' };", '')],
    ['get 뒤 그만둠 확인 지움', TX.replace("      if(gaveUp) return { ok:false, reason:'timeout' };\n", '')],
  ];
  for(const [name, src] of muts){
    if(src === TX){ chk(false, '깨 보기 «' + name + '» — 바꿀 글을 못 찾았다(모듈이 바뀌었으면 이 검사도 고친다)'); continue; }
    let r; try{ r = await suite(src, true); }catch(_){ r = [false]; }
    chk(r.some(x => !x), '«' + name + '» → 빨강');
  }
  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  done = true;
  process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
