/*
 * 카탈로그 항목별 장착 사용자 수 검사. functions/part-equip.js 를 그대로 불러 가짜 DB 로 돌린다.
 * 1. def → id (파츠 모양 셋 · 책상 · 아이템 · 커스텀 제외)  2. 슬롯 여러 칸 · 깨진 JSON  3. 차이(바꿈 · 지움 · 그대로)
 * 4. 처리기(한 번에 update)  5. 백필 합계  6. index.js 연결 · 규칙 · 앱은 안 씀
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
const FX = need('functions/index.js');
need('functions/part-equip.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

(async () => {
  const f = require(path.resolve('functions/part-equip.js'));
  const INC = (n) => ({ inc: n });
  const ids = (def) => { const s = f.addDefIds(def, { parts: new Set(), desks: new Set(), items: new Set() }); return { parts: [...s.parts].sort(), desks: [...s.desks].sort(), items: [...s.items].sort() }; };
  const slots = (...defs) => ({ ts: 1, v: 1, s: Object.fromEntries(defs.map((d, i) => [String(i), typeof d === 'string' ? d : JSON.stringify(d)])) });
  const sets = (v) => { const s = f.slotsEquipSets(v); return { parts: [...s.parts].sort(), desks: [...s.desks].sort(), items: [...s.items].sort() }; };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  say('── 1. def → 카탈로그 id');
  {
    const d = ids({ equippedParts: {
      hat: { id: 'pa1', xf: { scale: 1 } },
      ear: [{ id: 'pb1' }, { id: 'pb2' }],
      tail: { 0: { id: 'pc1' }, 1: { id: 'pc2' }, xf: { scale: 2 } },
      glasses: 'pd1',
    }, deskCatalogId: 'dk1', deskItems: { imx1: { adj: {} }, plant: { adj: {} } } });
    chk(eq(d.parts, ['pa1', 'pb1', 'pb2', 'pc1', 'pc2', 'pd1']), '파츠 — 항목 하나 · 배열(stackable) · 숫자 키 맵(옛 저장 · 엉뚱한 xf 키는 무시) · id 문자열 모두');
    chk(eq(d.desks, ['dk1']), '책상 — deskCatalogId');
    chk(eq(d.items, ['imx1', 'plant']), '아이템 — deskItems 의 키 (기본 아이템 plant 도 catalog/items 에 있다)');
    chk(eq(ids({}).desks, [f.DEFAULT_DESK_ID]) && f.DEFAULT_DESK_ID === '__default_desk__', '책상 고른 게 없으면 기본 책상(__default_desk__)');
    chk(eq(ids({ deskGlbUrl: 'https://x/slotglb_desk.glb' }).desks, []) && eq(ids({ deskGlb: 'AAAA' }).desks, []), '직접 넣은 책상(deskGlb · deskGlbUrl)은 세지 않는다');
    chk(eq(ids({ deskItems: { imx1: {}, cabc1234: {} }, customItems: { cabc1234: { name: '내 아이템', glbUrl: 'https://x' } } }).items, ['imx1']),
        '코드로 추가한 아이템(customItems 에 GLB 째 실린 것)은 뺀다');
    chk(eq(ids({ deskItemsLicenseHold: { imz9: {} }, deskLicenseHold: 'dz9', deskItems: null }).items, []), '라이선스로 잠겨 빠진 아이템은 세지 않는다');
    const bad = ids({ equippedParts: { a: { id: 'x/y' }, b: { id: 'a.b' }, c: { id: '' }, d: { id: 42 }, e: null, f: [null, 'ok1', { id: 'x'.repeat(65) }] },
      deskCatalogId: 'd$1', deskItems: { 'i#1': {}, ok2: {}, off: null } });
    chk(eq(bad.parts, ['ok1']) && eq(bad.desks, []) && eq(bad.items, ['ok2']), '경로 문자 · 빈 값 · 숫자 · 너무 긴 id · 꺼진 아이템(null)은 건너뛴다');
    chk(eq(ids(null).parts, []) && eq(ids([1, 2]).parts, []) && eq(ids('str').desks, []), 'def 가 객체가 아니면 아무것도 없다');
  }

  say('── 2. 슬롯 여러 칸 · 깨진 값');
  {
    const v = slots({ equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' }, { equippedParts: { hat: { id: 'p1' }, ear: { id: 'p2' } }, deskCatalogId: 'd1' });
    chk(eq(sets(v), { parts: ['p1', 'p2'], desks: ['d1'], items: [] }), '두 칸에 같은 파츠 · 책상 → 한 사람에 한 번');
    const broken = { ts: 1, v: 1, s: { 0: '{깨진', 1: JSON.stringify({ equippedParts: { hat: { id: 'p3' } }, deskCatalogId: 'd1' }), 2: 42, 3: '', 4: 'null' } };
    chk(eq(sets(broken), { parts: ['p3'], desks: ['d1'], items: [] }), '깨진 JSON · 숫자 · 빈 문자열 · "null" 칸은 건너뛰고 나머지는 센다');
    const arr = { ts: 1, v: 1, s: [JSON.stringify({ equippedParts: { hat: { id: 'p4' } }, deskCatalogId: 'd1' }), null, JSON.stringify({ deskItems: { i1: {} }, deskCatalogId: 'd2' })] };
    chk(eq(sets(arr), { parts: ['p4'], desks: ['d1', 'd2'], items: ['i1'] }), 'RTDB 가 s 를 배열로 돌려줘도(빈 칸 null) 읽는다');
    chk(eq(sets(null), { parts: [], desks: [], items: [] }) && eq(sets({ ts: 1 }), { parts: [], desks: [], items: [] }), 'slots 없음 · s 없음 → 빈 집합');
  }

  say('── 3. 차이 (equipDiffUpdates)');
  {
    const P = 'metrics/parts/equipped/';
    const A = f.slotsEquipSets(slots({ equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' }));
    const B = f.slotsEquipSets(slots({ equippedParts: { hat: { id: 'p2' } }, deskCatalogId: 'd1' }));
    chk(eq(f.equipDiffUpdates(A, B, INC), { [P + 'parts/p2']: { inc: 1 }, [P + 'parts/p1']: { inc: -1 } }), '모자를 바꾸면 새 것 +1 · 옛 것 -1 · 그대로인 책상은 안 건드린다');
    chk(eq(f.equipDiffUpdates(A, A, INC), {}), '그대로면 아무것도 안 쓴다 (ts 만 바뀐 저장)');
    const two = f.slotsEquipSets(slots({ equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' }, { equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' }));
    const oneLeft = f.slotsEquipSets(slots({ equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' }));
    chk(eq(f.equipDiffUpdates(two, oneLeft, INC), {}), '두 칸에 끼운 파츠를 한 칸에서만 빼면 그 사람은 아직 장착 중 — 줄지 않는다');
    const none = f.slotsEquipSets(null);
    chk(eq(f.equipDiffUpdates(A, none, INC), { [P + 'parts/p1']: { inc: -1 }, [P + 'desks/d1']: { inc: -1 } }), '슬롯을 지우면 전부 -1');
    chk(eq(f.equipDiffUpdates(none, A, INC), { [P + 'parts/p1']: { inc: 1 }, [P + 'desks/d1']: { inc: 1 } }), '처음 만들면 전부 +1');
    chk(f.METRICS_EQUIPPED === 'metrics/parts/equipped' && eq(f.KINDS, ['parts', 'desks', 'items']), '경로 = metrics/parts/equipped/{parts|desks|items}/{id}');
  }

  say('── 4. 처리기 (runPartEquip)');
  {
    const mkDb = () => { const L = []; return { L, db: { ref: (p) => ({ update: async (v) => { L.push([p, v]); } }) } }; };
    const snap = (v) => ({ val: () => v, exists: () => v != null });
    const ev = (b, a) => ({ params: { userId: 'uabc12345' }, data: { before: snap(b), after: snap(a) } });
    const S1 = slots({ equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' });
    const S2 = slots({ equippedParts: { hat: { id: 'p2' } }, deskCatalogId: 'd1', deskItems: { i1: {} } });
    let { db, L } = mkDb();
    await f.runPartEquip(db, ev(S1, S2), INC);
    chk(L.length === 1 && L[0][0] === undefined && Object.keys(L[0][1]).length === 3, '바뀐 것만 한 번의 루트 update (p2 +1 · p1 -1 · i1 +1)');
    ({ db, L } = mkDb());
    await f.runPartEquip(db, ev(S1, Object.assign({}, S1, { ts: 99 })), INC);
    chk(L.length === 0, '장착이 그대로면 쓰지 않는다');
    ({ db, L } = mkDb());
    await f.runPartEquip(db, ev(S1, null), INC);
    chk(L.length === 1 && Object.values(L[0][1]).every(v => v.inc === -1), '지우기 → 전부 -1');
    ({ db, L } = mkDb());
    await f.runPartEquip(db, ev(null, { ts: 1, v: 1, s: { 0: '{깨짐' } }), INC);
    chk(L.length === 0, '깨진 칸만 있으면 아무것도 안 쓴다');
  }

  say('── 5. 백필 합계 (equipTotals)');
  {
    const t = f.equipTotals([
      slots({ equippedParts: { hat: { id: 'p1' } }, deskCatalogId: 'd1' }, { equippedParts: { hat: { id: 'p1' } } }),
      slots({ equippedParts: { hat: { id: 'p1' }, ear: [{ id: 'p2' }] }, deskCatalogId: 'd1', deskItems: { i1: {} } }),
      { ts: 1, s: { 0: '{깨짐' } },
      null,
    ]);
    chk(eq(t, { parts: { p1: 2, p2: 1 }, desks: { d1: 2, __default_desk__: 1 }, items: { i1: 1 } }), '사람 수로 센다 — 한 사람의 여러 칸은 1명 · 책상 없는 칸은 기본 책상');
    const B = need('scripts/backfill-part-equip.js');
    const BC = strip(B);
    chk(/require\('\.\.\/functions\/part-equip'\)/.test(BC) && /equipTotals/.test(BC), '백필 도구는 함수와 같은 계산(part-equip.js)을 쓴다');
    chk(/'--write'/.test(BC) && /if \(!WRITE\)/.test(BC), '  ↳ 기본은 미리 보기 — --write 일 때만 쓴다');
    chk(/if \(!PROJECT\)/.test(BC), '  ↳ --project 가 없으면 멈춘다 (기본 프로젝트가 운영)');
    chk(/'\/users', true\)/.test(BC) && /'\/users\/' \+ ids\[i\] \+ '\/slots'/.test(BC) && !/getJson\('\/users', false\)/.test(BC), '  ↳ users 는 키만(shallow), 사람마다 slots 만 읽는다');
  }

  say('── 6. index.js 연결 · 규칙');
  {
    const CODE = strip(FX);
    const m = CODE.match(/exports\.partEquipCount = onValueWritten\(\{ ref: '\/users\/\{userId\}\/slots'[\s\S]*?\n  \}\);/);
    chk(!!m, 'partEquipCount = onValueWritten(/users/{userId}/slots)');
    chk(!!m && /retry: false/.test(m[0]) && /maxInstances: \d+/.test(m[0]), '  ↳ 다시 시도 안 함(두 번 더하지 않게) · 인스턴스 상한');
    chk(!!m && /require\('\.\/part-equip'\)\.runPartEquip\(getDatabase\(\), event\)/.test(m[0]), '  ↳ 처리는 part-equip.js 에 맡긴다');
    chk(!!m && /require\('firebase-admin\/database'\)/.test(m[0]) && !/^const[^\n]*require\('firebase-admin\/database'\)/m.test(CODE),
        '  ↳ firebase-admin/database 는 실행할 때 읽는다 (배포 때 10초 로딩 제한)');
    chk(/partEquipCount — 카탈로그 항목별 장착 사용자 수/.test(FX), '  ↳ 머리 주석의 함수 목록에도 적었다');
    chk(!/^const[^\n]*require\(/m.test(strip(need('functions/part-equip.js'))), 'part-equip.js 는 맨 위에서 아무것도 require 하지 않는다');
    let rules = null; try{ rules = JSON.parse(RULES).rules; }catch(_){}
    const mr = rules && rules.metrics;
    chk(!!mr && /admins.*auth\.uid/.test(mr['.read']) && !JSON.stringify(mr).includes('.write'), '규칙: metrics 는 관리자만 읽고 쓰기 규칙 없음 — 서버만 쓴다 (규칙 변경 없음)');
    const APP = (read('app.js') || '') + (read('firebase-init.js') || '');
    chk(!!APP && !/metrics\/parts/.test(APP), '앱은 metrics/parts 를 읽거나 쓰지 않는다');
  }

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
