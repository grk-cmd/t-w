/* ═══ 📦 sim-load-state.js — 서버 값 하나를 받는 틀(shared/load-state.js · window.TwLoadState) ═══
   [왜] «모르는 값을 그럴듯한 값으로 바꾸지 않는다» 를 코드로 지키는 자리 — 못 받은 값을 기본값(레벨 1 등)으로 돌려주지 않고,
     못 받은 채 남지 않게 API 복귀 알림 때 한 번 다시 받는다(B-1128-2). 손으로 푸는 가짜 fetch · 가짜 health 위에서 실제로 돌린다.
   ・1절: 만들 때 요청 · 구독 0 · idle 의 value() 는 null · 받는 중 · 못 받음에도 null(기본값 없음) · 받으면 값
   ・2절: 겹친 load 는 같은 약속 · 늦은 답(reset 뒤)은 아무것도 안 바꿈
   ・3절: 알림 — reset 뒤 처음 실패 한 번(notifyOnce) · 이어지는 조용한 실패는 진단만 · [다시 시도] 실패는 notifyRetry · ready · loading 이면 retry 는 요청 0
   ・4절: API 복귀 — failed 일 때만 다시 받기 한 번 · ready · loading · idle 이면 요청 0 · 구독은 처음 load 때 한 번
   ・5절: refresh — ready 일 때만 · 겹치면 하나 · 실패하면 failed(복귀 때 다시)
   ・6절: mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', path.join('parts', 'shared'), 'app', path.join('app', 'parts', 'shared'), path.join('apps', 'desktop', 'app', 'parts', 'shared')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const SRC = read('load-state.js');
if(!SRC){ say('  ? 원본 못 찾음 — load-state.js'); process.exit(2); }
const flush = () => new Promise((r) => setImmediate(r));

function load(src){ const mod = { exports: {} }; vm.runInNewContext(src, { module: mod, console, Promise }); return mod.exports; }
function world(src, o){
  o = o || {};
  const M = load(src);
  const W = { gets: [], values: [], changes: 0, once: [], retries: [], notes: [], subs: [] };
  const health = { onRecover: (fn) => { W.subs.push(fn); } };
  W.ls = M.createLoadState({
    fetch: () => { const d = {}; d.p = new Promise((res, rej) => { d.res = res; d.rej = rej; }); W.gets.push(d); return d.p; },
    onValue: (v, kind) => W.values.push(kind + ':' + v),
    onChange: () => { W.changes++; },
    health: o.noHealth ? undefined : health,
    notifyOnce: (e) => W.once.push(e && e.code),
    notifyRetry: (e) => W.retries.push(e && e.code),
    note: (l) => W.notes.push(l),
  });
  W.recover = () => W.subs.forEach((f) => f());
  W.ok = async (i, v) => { W.gets[i].res(v); await flush(); };
  W.bad = async (i, code) => { W.gets[i].rej(Object.assign(new Error('비밀 글'), { code: code || 'UNAVAILABLE' })); await flush(); };
  return W;
}

async function judge(src){
  const r = [], t = (ok, msg) => r.push([!!ok, msg]);
  let W = world(src);
  t(W.gets.length === 0 && W.subs.length === 0 && W.ls.state() === 'idle' && W.ls.value() === null, '만들 때 요청 · 구독 0 · idle · value() 는 null');
  const p1 = W.ls.load('start'), p2 = W.ls.load('quiet');
  t(p1 === p2 && W.gets.length === 1 && W.ls.state() === 'loading' && W.ls.value() === null && W.subs.length === 1, '★ 겹친 load 는 같은 약속(요청 하나) · 받는 중 value() 는 null · 복귀 구독은 처음 load 때 한 번');
  await W.bad(0, 'NETWORK');
  t(W.ls.state() === 'failed' && W.ls.value() === null && (await p1) === 'failed', '★ 못 받으면 failed · value() 는 null(기본값을 돌려주지 않는다)');
  t(W.once.join() === 'NETWORK' && W.retries.length === 0, '  reset 뒤 처음 실패 → notifyOnce 한 번');
  t(W.notes.join('|') === '받기 시작(start)|못 받음(start) code=NETWORK name=Error' && !W.notes.join().includes('비밀'), '  진단 — 받기 시작 · 못 받음(code · 이름만 · 오류 글 없음)');
  W.ls.load('quiet'); await W.bad(1);
  t(W.once.length === 1 && W.retries.length === 0 && W.subs.length === 1, '  이어지는 조용한 실패는 진단만(번호 다시 안 띄움) · 복귀 구독은 그대로 하나');
  const rr = W.ls.retry(); await W.bad(2, 'TIMEOUT'); await rr;
  t(W.retries.join() === 'TIMEOUT' && W.once.length === 1, '★ [다시 시도] 의 실패 → notifyRetry');
  W.ls.retry(); await W.ok(3, 297);
  t(W.ls.state() === 'ready' && W.ls.value() === 297 && W.values.join() === 'load:297', '  다시 시도 성공 → ready · 값 · onValue(load)');
  await W.ls.retry();
  t(W.gets.length === 4, '  ready 면 retry 는 요청 0');

  W = world(src);
  W.ls.load('start'); W.ls.reset(); await W.ok(0, 5);
  t(W.ls.state() === 'idle' && W.ls.value() === null && W.values.length === 0, '★ reset 뒤 늦은 답은 아무것도 안 바꾼다(idle · 값 null)');
  W.ls.load('start'); await W.bad(1);
  W.ls.reset(); W.ls.load('start'); await W.bad(2);
  t(W.once.length === 2, '  실패 → reset → 다시 처음 실패면 notifyOnce 한 번 더(새 세션)');

  W = world(src);
  W.recover();
  t(W.gets.length === 0, '★ 복귀 — 받기 전(idle)엔 요청 0');
  W.ls.load('start');
  W.recover();
  t(W.gets.length === 1, '  받는 중(loading)이면 요청이 늘지 않는다');
  await W.bad(0);
  W.recover(); await flush();
  t(W.gets.length === 2 && W.notes.includes('복귀로 다시 받음') && W.notes.includes('받기 시작(recover)'), '★ 못 받았으면(failed) 복귀 때 한 번 다시 받는다 · 진단');
  await W.bad(1);
  t(W.once.length === 1 && W.retries.length === 0, '  복귀 다시 받기가 또 실패해도 번호는 안 띄운다(다음 복귀를 기다린다)');
  W.recover(); await W.ok(2, 9);
  W.recover(); await flush();
  t(W.gets.length === 3 && W.ls.value() === 9, '★ 받았으면(ready) 복귀가 와도 다시 받지 않는다');
  W = world(src, { noHealth: true });
  W.ls.load('start'); await W.bad(0);
  t(W.subs.length === 0 && W.ls.state() === 'failed', '  health 가 없으면 복귀 다시 받기도 없다');

  W = world(src);
  W.ls.refresh();
  t(W.gets.length === 0, 'refresh — 받기 전엔 요청 0');
  W.ls.load(); await W.ok(0, 1);
  const f1 = W.ls.refresh(), f2 = W.ls.refresh();
  t(f1 === f2 && W.gets.length === 2 && W.ls.state() === 'ready', '  ready 일 때 한 번 · 겹치면 하나 · 받는 동안 ready 그대로');
  await W.ok(1, 2);
  t(W.ls.value() === 2 && W.values.join() === 'load:1,refresh:2', '  새 값 · onValue(refresh)');
  W.ls.refresh(); await W.bad(2);
  t(W.ls.state() === 'failed' && W.ls.value() === null && W.once.length === 0 && W.retries.length === 0, '  refresh 실패 → failed · value() null · 번호 없음(사용자가 한 일이 아니다)');
  W.recover(); await flush();
  t(W.gets.length === 4, '  그 뒤 복귀 때 다시 받는다');
  return r;
}

(async () => {
  say('── 1~5. load-state 를 실제로 돌린다');
  (await judge(SRC)).forEach(([ok, m]) => chk(ok, m));
  say('── 6. mutation test');
  const BREAKS = [
    ["value: () => (st === 'ready' ? val : null)", "value: () => val", '받지 못했는데 옛 값 · 기본값을 돌려줌'],
    ["    if(run) return run;\n    if(!bound", "    if(!bound", '겹친 load 가 요청을 또 보냄'],
    ["        if(g !== gen) return 'skipped';\n        val = v;", "        val = v;", '늦은 답이 reset 뒤 값을 바꿈'],
    ["    if(st !== 'failed') return;   // 받는 중", "    if(st === 'loading') return;   // 받는 중", '받았는데도 복귀 때 또 받음'],
    ["    if(!bound && health){ bound = true; health.onRecover(recovered); }", "", '복귀 구독을 안 걺(못 받은 채 남음)'],
    ["    if(!bound && health){ bound = true; health.onRecover(recovered); }", "    if(health){ health.onRecover(recovered); }", 'load 마다 복귀 구독을 또 걺'],
    ["    else if(!notified){ notified = true; notifyOnce(e); }", "    else notifyOnce(e);", '실패마다 번호를 또 띄움'],
    ["    if(why === 'user') notifyRetry(e);\n", "", '[다시 시도] 실패를 안 알림'],
    ["    st = 'idle'; val = null; run = null; refreshing = null; notified = false;", "    st = 'idle'; val = null; run = null; refreshing = null;", 'reset 이 첫 실패 표시를 안 비움'],
    ["    if(st === 'ready' || st === 'loading') return Promise.resolve(st);\n    return load('user');", "    return load('user');", 'ready 인데 retry 가 또 받음'],
    ["    if(st !== 'ready' || run) return refreshing || Promise.resolve();", "    if(run) return refreshing || Promise.resolve();", '받기 전에도 refresh'],
    ["        st = 'failed';\n        say('새로 못 받음 ' + errTag(e));", "        say('새로 못 받음 ' + errTag(e));", 'refresh 실패에도 ready 그대로(옛 값을 보임)'],
  ];
  const missed = [];
  for(const [from, to, what] of BREAKS){
    if(SRC.indexOf(from) < 0){ missed.push('글 못 찾음: ' + what); continue; }
    let red = false; try{ const rows = await Promise.race([judge(SRC.split(from).join(to)), new Promise((r) => setTimeout(() => r(null), 2500))]); red = !rows || rows.some(([o]) => !o); }catch(_){ red = true; }   // 멈추면(풀리지 않는 약속) 빨강
    if(!red) missed.push(what);
  }
  chk(!missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { say('  ✗ 검사 자체가 죽음: ' + (e && e.stack || e)); process.exit(1); });
