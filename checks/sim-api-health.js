/* ═══ 🩺 sim-api-health.js — API 가 닿는가 한 곳(shared/api-health.js · window.TwApiHealth) ═══
   [왜] API 배포 중(30초~1분)에 켠 PC 가 켤 때 읽기를 못 받은 채 남았다(B-1128-2 — 레벨 1). 기능마다 타이머로 다시 묻지 않고,
     닿지 않는 동안만 확인 요청 하나를 간격을 두고 보내고, 무엇이든 하나 성공하면 «복귀» 를 한 번 알린다. 그 틀을 가짜 시계로 실제로 돌린다.
   ・1절: 만들 때 타이머 · 요청 0 · 닿지 않음이 아니면 타이머 없음
   ・2절: 닿지 않음 → 확인 간격 10 · 30 · 60 · 120 · 300 · 300초(끝 값에서 멈춤) · 여러 기능이 실패해도 확인은 하나 · 진단 줄
   ・3절: 다른 요청 성공 → 복귀 한 번 · 타이머 멈춤 · 이어지는 성공엔 안 알림 · 확인 요청이 성공해도 복귀 · 확인이 4xx 로 끝나도 다음 간격
   ・4절: reset(계정을 놓을 때) — 타이머 멈춤 · 닿지 않음을 잊음 · 떼면 안 옴 · 구독자가 던져도 다른 구독자는 받는다
   ・5절: mutation test */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', path.join('parts', 'shared'), 'app', path.join('app', 'parts', 'shared'), path.join('apps', 'desktop', 'app', 'parts', 'shared')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const SRC = read('api-health.js'), HTML = read('desk-companion-prototype.html') || read(path.join('..', '..', 'desk-companion-prototype.html'));
if(!SRC){ say('  ? 원본 못 찾음 — api-health.js'); process.exit(2); }
const settle = async () => { for(let i = 0; i < 20; i++) await Promise.resolve(); };

function load(src){ const mod = { exports: {} }; vm.runInNewContext(src, { module: mod, console, Promise, Math }); return mod.exports; }
/* 가짜 시계 — 걸린 타이머를 손으로 돌린다 */
function world(src, o){
  o = o || {};
  const M = load(src);
  const W = { t: 0, q: [], probes: 0, notes: [], probeAns: o.probeAns || [] };
  const setT = (fn, ms) => { const h = { at: W.t + ms, fn, ms }; W.q.push(h); return h; };
  const clrT = (h) => { W.q = W.q.filter((x) => x !== h); };
  W.h = M.createApiHealth({
    probe: () => { W.probes++; const a = W.probeAns.shift() || 'down'; if(a === 'ok'){ W.h.ok(); return Promise.resolve(1); } if(a === '4xx') return Promise.reject(new Error('400')); W.h.down(); return Promise.reject(new Error('503')); },
    setTimeout: setT, clearTimeout: clrT, note: (l) => W.notes.push(l),
  });
  W.run = async (ms) => { const end = W.t + ms; for(;;){ W.q.sort((a, b) => a.at - b.at); const n = W.q[0]; if(!n || n.at > end) break; W.q.shift(); W.t = n.at; n.fn(); await settle(); } W.t = end; await settle(); };
  W.next = () => (W.q.length ? W.q[0].ms : null);
  return W;
}

async function judge(src){
  const r = [], t = (ok, msg) => r.push([!!ok, msg]);
  let W = world(src);
  t(W.q.length === 0 && W.probes === 0 && !W.h.isDown(), '만들 때 타이머 · 확인 요청 0 · 닿지 않음 아님');
  W.h.ok(); W.h.ok();
  t(W.q.length === 0 && W.notes.length === 0, '  닿는 동안의 성공은 아무것도 안 한다(타이머 없음 · 진단 없음)');

  W = world(src);
  const got = []; W.h.onRecover(() => got.push('r'));
  W.h.down(); W.h.down(); W.h.down();
  t(W.q.length === 1 && W.next() === 10000 && W.h.isDown() && W.notes.join() === '[api] 닿지 않음', '★ 닿지 않음 → 확인 타이머 하나(10초) · 여러 기능이 실패해도 하나 · 진단 «닿지 않음» 한 번');
  await W.run(9999);
  t(W.probes === 0, '  10초 전에는 확인하지 않는다');
  const gaps = [];
  let last = 0;
  for(let i = 0; i < 6; i++){ const ms = W.next(); gaps.push(ms / 1000); await W.run(ms - (i === 0 ? 9999 : 0)); last = W.probes; }
  t(gaps.join() === '10,30,60,120,300,300' && last === 6 && W.q.length === 1, '★ 계속 닿지 않으면 확인 간격 10 · 30 · 60 · 120 · 300 · 300초(5분에서 멈춤 · 그 뒤 5분마다) — ' + gaps.join());
  t(W.notes[1] === '[api] 확인 1번째 · 간격 10초' && W.notes[6] === '[api] 확인 6번째 · 간격 300초', '  진단 «확인 n번째 · 간격» — ' + W.notes.slice(1, 3).join(' | '));
  W.h.ok();
  t(got.join() === 'r' && W.q.length === 0 && !W.h.isDown() && W.notes[W.notes.length - 1] === '[api] 복귀', '★ 다른 요청 하나가 성공 → 복귀 한 번 · 확인 타이머 멈춤 · 진단 «복귀»');
  W.h.ok(); await W.run(600000);
  t(got.length === 1 && W.probes === 6 && W.q.length === 0, '  이어지는 성공엔 다시 안 알린다 · 타이머 없음 — 더 확인하지 않는다');
  W.h.down();
  t(W.next() === 10000, '  다시 닿지 않으면 간격을 처음(10초)부터');

  W = world(src, { probeAns: ['down', 'ok'] });
  const g2 = []; W.h.onRecover(() => g2.push(1));
  W.h.down(); await W.run(10000); await W.run(30000);
  t(W.probes === 2 && g2.length === 1 && W.q.length === 0, '★ 확인 요청이 성공해도 복귀 한 번 · 멈춤');
  W = world(src, { probeAns: ['4xx'] });
  W.h.down(); await W.run(10000);
  t(W.probes === 1 && W.q.length === 1 && W.next() === 30000 && W.h.isDown(), '  확인이 4xx 로 끝나면(복귀도 내려감도 아님) 닿지 않음이 남아 다음 간격(30초)');

  W = world(src);
  const g3 = []; const off = W.h.onRecover(() => g3.push(1));
  W.h.down(); W.h.reset();
  t(W.q.length === 0 && !W.h.isDown(), '★ reset(계정을 놓을 때) — 확인 타이머 멈춤 · 닿지 않음을 잊음');
  W.h.ok();
  t(g3.length === 0, '  reset 뒤의 성공은 복귀가 아니다');
  off(); W.h.down(); W.h.ok();
  t(g3.length === 0, '  떼면(돌려준 함수) 더 안 온다');
  W = world(src);
  const g4 = []; W.h.onRecover(() => { throw new Error('x'); }); W.h.onRecover(() => g4.push(1));
  const w0 = console.warn; console.warn = () => {};
  W.h.down(); W.h.ok();
  console.warn = w0;
  t(g4.length === 1, '  구독자 하나가 던져도 다른 구독자는 받는다');
  return r;
}

(async () => {
  say('── 1~4. api-health 를 가짜 시계로 실제로 돌린다');
  (await judge(SRC)).forEach(([ok, m]) => chk(ok, m));
  if(HTML){
    const order = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
    const iH = order.indexOf('shared/api-health.js'), iC = order.indexOf('shared/api-client.js');
    chk(iH >= 0 && iC > iH, 'html — api-health.js 를 api-client.js 보다 먼저 싣는다');
  }
  say('── 5. mutation test');
  const BREAKS = [
    ["const DELAYS = Object.freeze([10000, 30000, 60000, 120000, 300000]);", "const DELAYS = Object.freeze([10000, 30000, 60000, 120000, 300000, 600000, 1200000]);", '간격 상한(5분)을 없앰'],
    ["    const ms = delays[Math.min(sent, delays.length - 1)];", "    const ms = delays[0];", '간격이 늘지 않음(10초마다)'],
    ["    if(timer != null || !downNow) return;", "    if(!downNow) return;", '실패마다 확인 타이머를 또 걺(여러 개)'],
    ["    if(timer != null){ try{ tClear(timer); }catch(_){} timer = null; }\n    say('복귀');", "    say('복귀');", '복귀해도 확인 타이머가 남음'],
    ["    if(!downNow) return;\n    downNow = false; sent = 0;", "    downNow = false; sent = 0;", '닿는 동안의 성공에도 복귀를 알림'],
    ["    fns.slice().forEach((fn) => { try{ fn(); }catch(e){ console.warn('[api] 복귀 알림 실패', e); } });", "", '복귀를 안 알림'],
    ["    downNow = false; sent = 0;\n    if(timer", "    downNow = false;\n    if(timer", '복귀 뒤 다시 닿지 않으면 간격을 처음부터 안 셈'],
    ["    p.catch(() => {}).then(() => arm());", "    p.catch(() => {});", '확인이 4xx 로 끝나면 멈춤(닿지 않음이 남은 채)'],
    ["function reset(){\n    downNow = false; sent = 0;\n    if(timer != null){ try{ tClear(timer); }catch(_){} timer = null; }", "function reset(){\n    downNow = false; sent = 0;", 'reset 이 타이머를 안 멈춤'],
    ["    say('확인 ' + sent + '번째 · 간격 ' + Math.round(ms / 1000) + '초');", "", '확인 진단 줄을 뺌'],
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
