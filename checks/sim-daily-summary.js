/*
 * 날짜별 숫자 요약(metrics/summary) 검사. functions/daily-summary.js · room-stats.js 를 그대로 불러 가짜 DB 로 돌린다.
 * 1. 요약할 날(어제 · 자정 뒤 여유)  2. 요약 계산(순수)  3. 있으면 안 함 · 없으면 한 번 씀  4. roomStats 연결 · 실패 격리 · 규칙
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (f) => { const s = read(f); if(s == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } return s; };
const RULES = need('firebase-database-rules.json');
need('functions/daily-summary.js');
const RS = need('functions/room-stats.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const quiet = async (fn) => { const q = [console.log, console.warn]; console.log = console.warn = () => {}; try{ return await fn(); } finally { [console.log, console.warn] = q; } };

// 경로 → 값 트리를 가진 가짜 Admin DB. 읽은 경로 · 쓴 경로를 남긴다.
function mkDb(tree, opts){
  const o = opts || {};
  const L = { gets: [], sets: [] };
  const at = (p) => p.split('/').reduce((v, k) => (v && typeof v === 'object') ? v[k] : undefined, tree);
  const db = { ref: (p) => ({
    get: async () => { L.gets.push(p); if(o.failGet && o.failGet(p)) throw new Error('get ' + p); const v = at(p); return { val: () => (v === undefined ? null : v), exists: () => v !== undefined }; },
    set: async (v) => { if(o.failSet) throw new Error('set'); L.sets.push([p, v]); },
    update: async () => {}, remove: async () => {},
    transaction: async (fn) => { const v = fn(null); return { committed: v !== undefined, snapshot: { val: () => v } }; },
  }) };
  return { db, L };
}
const users = (...c) => Object.fromEntries(c.map(x => [x, true]));

(async () => {
  const f = require(path.resolve('functions/daily-summary.js'));
  const T = (iso) => Date.parse(iso);

  say('── 1. 요약할 날');
  {
    chk(f.summaryDateKey(T('2026-10-07T03:00:00Z')) === '2026-10-06', '서울 10-07 정오 → 어제(10-06)');
    chk(f.summaryDateKey(T('2026-10-06T15:05:00Z')) === '2026-10-05', '★ 서울 자정 5분 뒤 → 아직 그저께 — 자정 직전 쓰기가 들어올 틈');
    chk(f.summaryDateKey(T('2026-10-06T15:10:00Z')) === '2026-10-06', '  ↳ 자정 10분 뒤부터 어제');
    chk(f.SUMMARY_GRACE_MS === 10 * 60 * 1000, '여유 10분');
    const ds = f.datesUpTo('2026-10-03', 7);
    chk(ds.length === 7 && ds[0] === '2026-09-27' && ds[6] === '2026-10-03', '그날까지 7일 — 달을 넘어도');
  }

  say('── 2. 요약 계산 (buildSummary)');
  {
    const node = { u: users('ua', 'ub'), ip: users('h1', 'h2', 'h3'), visits: 5, pings: 9 };
    const by = {
      '2026-10-06': ['ua', 'ub'], '2026-10-05': ['ua', 'uc'], '2026-09-30': ['ud'],   // 7일 안
      '2026-09-29': ['ue'],                                                         // 8일 전 — MAU 만
      '2026-09-07': ['uf'],                                                         // 30일 전(그날 포함 30일의 첫날)
      '2026-09-06': ['ug'],                                                         // 31일 전 — 밖
    };
    const s = f.buildSummary(node, by, '2026-10-06', 123);
    chk(JSON.stringify(s) === JSON.stringify({ dau: 2, ipVisitors: 3, visits: 5, pings: 9, wau: 4, mau: 6, at: 123 }),
      'dau · ipVisitors · visits · pings · wau(7일 합집합) · mau(30일 합집합) · at — ' + JSON.stringify(s));
    const z = f.buildSummary(null, {}, '2026-10-06', 1);
    chk(z.dau === 0 && z.ipVisitors === 0 && z.visits === 0 && z.pings === 0 && z.wau === 0 && z.mau === 0, '기록 없는 날은 전부 0');
    chk(f.buildSummary({ visits: 'x', pings: -3 }, {}, '2026-10-06', 1).visits === 0, '숫자가 아니거나 음수면 0');
  }

  say('── 3. 있으면 안 함 · 없으면 한 번 씀 (ensureDailySummary)');
  {
    const now = T('2026-10-07T03:00:00Z');   // 어제 = 10-06
    let { db, L } = mkDb({ metrics: { summary: { '2026-10-06': { dau: 1, at: 5 } } } });
    chk(await f.ensureDailySummary(db, now) === null && L.gets.length === 1 && L.gets[0] === 'metrics/summary/2026-10-06/at' && !L.sets.length,
      '★ 어제 요약이 있으면 점 읽기 1번(at 한 칸)으로 끝 — 1분마다 도는 비용');
    ({ db, L } = mkDb({ metrics: { daily: {
      '2026-10-06': { u: users('ua', 'ub'), ip: users('h1'), visits: 3, pings: 4 },
      '2026-10-01': { u: users('uc') }, '2026-09-10': { u: users('ud') }, '2026-09-01': { u: users('ux') },
    } } }));
    const r = await f.ensureDailySummary(db, now);
    chk(!!r && r.day === '2026-10-06' && L.sets.length === 1 && L.sets[0][0] === 'metrics/summary/2026-10-06', '없으면 계산해 metrics/summary/{어제} 에 한 번 쓴다');
    const v = L.sets[0] && L.sets[0][1];
    chk(!!v && v.dau === 2 && v.ipVisitors === 1 && v.visits === 3 && v.pings === 4 && v.wau === 3 && v.mau === 4 && v.at === now, '  ↳ 값 ' + JSON.stringify(v));
    chk(L.gets.includes('metrics/daily/2026-10-06') && L.gets.filter(p => /^metrics\/daily\/[^/]+\/u$/.test(p)).length === 29,
      '  ↳ 읽기: 어제 노드 하나 + 나머지 29일은 u 목록만');
    chk(!L.gets.includes('metrics/daily') && !L.gets.includes('metrics') && !L.gets.some(p => /\/ip$/.test(p)), '  ↳ metrics 를 통째로 · 다른 날 ip 목록을 받지 않는다');
  }

  say('── 4. roomStats 연결 · 실패 격리 · 규칙');
  {
    const rs = require(path.resolve('functions/room-stats.js'));
    const now = T('2026-10-07T03:00:00Z');
    let { db, L } = mkDb({ roomIndex: {}, metrics: { daily: { '2026-10-06': { u: users('ua') } } } });
    await quiet(() => rs.runRoomStats(db, now));
    chk(L.sets.some(([p]) => p === 'metrics/summary/2026-10-06'), '1분 주기 실행이 어제 요약을 만든다');
    ({ db, L } = mkDb({ roomIndex: {} }));
    await quiet(() => rs.runRoomStats(db, now, { drop: false }));
    chk(!L.gets.some(p => p.startsWith('metrics')), '방 열림 · 닫힘 트리거(light)는 요약을 안 본다');
    ({ db, L } = mkDb({ roomIndex: {} }, { failGet: (p) => p.startsWith('metrics') }));
    let threw = null, sum = null;
    try{ sum = await quiet(() => rs.runRoomStats(db, now)); }catch(e){ threw = e; }
    chk(!threw && !!sum && typeof sum.live === 'number', '★ 요약이 실패해도 roomStats 는 끝까지 돈다(방 집계 · 유령 청소 그대로)');
    ({ db, L } = mkDb({ roomIndex: {} }, { failSet: true }));
    threw = null;
    try{ await quiet(() => rs.runRoomStats(db, now)); }catch(e){ threw = e; }
    chk(!threw, '  ↳ 쓰기가 거부돼도');
    const CODE = strip(RS);
    chk(/if \(!light\)\{\s*try\{\s*const made = await require\('\.\/daily-summary'\)\.ensureDailySummary\(db, now\);/.test(CODE), '연결: !light 일 때 try 안에서 · 늦게 require');
    chk(CODE.indexOf("ensureDailySummary") > CODE.indexOf('sweepRoomAlive(db, now)'), '  ↳ 유령 청소 뒤에 — 본래 일이 먼저');
    chk(!/^const[^\n]*require\(/m.test(strip(need('functions/daily-summary.js')).replace(/^const \{ kstDateKey, METRICS_DAILY \} = require\('\.\/daily-active'\);$/m, '')),
      'daily-summary.js 는 daily-active.js 말고 맨 위에서 아무것도 require 하지 않는다');
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const mr = rules && rules.metrics;
    chk(!!mr && /admins.*auth\.uid/.test(mr['.read']) && !JSON.stringify(Object.assign({}, mr, { improvements: undefined })).includes('.write') && !('summary' in mr),
      '규칙: metrics/summary 도 metrics 아래 — 읽기 관리자만 · 쓰기 규칙 없음');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
