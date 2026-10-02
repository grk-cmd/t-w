/* sim-catalog-cache.js — 카탈로그 버전 확인(catalogMeta) + 로컬 캐시 (app/parts/catalog-cache.js)
   [무엇을 보는가] 부팅마다 catalog/parts · gachaParts · items · desks 를 통째로 받던 것을
     catalogMeta/{종류} 버전 확인 + 로컬 캐시로 바꿨다. 이 검사는
       · 카탈로그를 쓰는 함수가 하나도 빠짐없이 버전을 같이 올리는가 (빠지면 사용자가 옛 카탈로그를 본다)
       · 안전장치 ① catalogMeta 가 없거나 거부되면 예전처럼 통째 구독하는가
       · 안전장치 ② 버전이 같아도 캐시가 24시간을 넘으면 다시 받는가
       · 안전장치 ③ 오프라인이라 버전이 안 오면 캐시가 있을 때만 먼저 보여 주는가
       · 캐시 읽기·쓰기·받기가 실패하거나 캐시가 깨져 있어도 화면에 카탈로그가 들어오는가
     를 본다. 웹 관리자 쪽 버전 올림은 web-admin/tests/entities/catalog-version.test.ts 가 본다.
   ・1절: firebase-init.js — import · 구독 연결 · 쓰기가 전부 _catalogUpdate 를 지나는가
   ・2절: firebase-database-rules.json — catalogMeta 규칙
   ・3절: catalog-cache.js — 캐시 판정(순수 함수) 표
   ・4절: catalog-cache.js — 구독기를 가짜 DB · 가짜 저장소로 돌려 본다
   [실행] firebase-init.js · catalog-cache.js · firebase-database-rules.json 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js'), CC = read('catalog-cache.js'), RJ = read('firebase-database-rules.json');
if(!FI){ say('  ? 원본 못 찾음 — firebase-init.js'); process.exit(2); }
if(!CC){ say('  ? 원본 못 찾음 — catalog-cache.js'); process.exit(2); }
if(!RJ){ say('  ? 원본 못 찾음 — firebase-database-rules.json'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
/* firebaseAPI 메서드 본문 — `    이름(` 부터 다음 `\n    },` 까지 */
const body = (name) => {
  const m = new RegExp('\\n    (?:async )?' + name + '\\(').exec(CODE);
  if(!m) return '';
  const i = m.index; const j = CODE.indexOf('\n    },', i);
  return CODE.slice(i, j < 0 ? undefined : j);
};

say('── 1. firebase-init.js 연결');
{
  chk(/import \{ createCatalogSync \} from "\.\/catalog-cache\.js";/.test(CODE), 'catalog-cache.js 를 import 한다');
  chk(/metaRef:\s*\(kind\) => ref\(db, 'catalogMeta\/' \+ kind\)/.test(CODE) && /catalogRef: \(kind\) => ref\(db, 'catalog\/' \+ kind\)/.test(CODE),
      '경로는 firebase-init.js 가 만든다 (audit 검사 7 이 catalogMeta 를 규칙과 대조한다)');
  chk(/scope: \(firebaseConfig && \(firebaseConfig\.databaseURL/.test(CODE), '캐시 키 앞머리 = DB 주소 (운영/dev 섞임 방지)');
  chk(/subscribeCatalogDesks\(onChange\)\{\s*return _subscribeCatalogKind\('desks', onChange\);/.test(CODE), '책상 구독 → 버전 확인 + 캐시');
  chk(/subscribeCatalogItems\(onChange\)\{\s*return _subscribeCatalogKind\('items', onChange\);/.test(CODE), '아이템 구독 → 버전 확인 + 캐시');
  const sp = body('subscribeCatalogParts');
  chk(/_subscribeCatalogKind\('parts'/.test(sp) && /_subscribeCatalogKind\('gachaParts'/.test(sp), '파츠 구독 → parts · gachaParts 따로 버전 확인');
  chk(/if\(parts === null \|\| gacha === null\) return;/.test(sp), '  ↳ 두 통이 다 도착하기 전엔 콜백하지 않는다 (가챠 파츠 «삭제» 오인 방지 — 그대로)');
  chk(!/onValue\(\s*(?:ref\(db,\s*['`"]catalog\/(?:parts|gachaParts|items|desks)['`"]\)|r1|r2)/.test(CODE),
      'catalog/{parts·gachaParts·items·desks} 를 통째로 onValue 하는 곳이 남지 않았다');

  /* 쓰기 — 네 종류 경로에 set/remove/직접 update 가 남아 있으면 그 쓰기는 버전을 안 올린다 */
  const KIND = '(?:parts|gachaParts|items|desks)';
  chk(!new RegExp('(?:set|remove)\\(ref\\(db,\\s*[`\'"]catalog\\/' + KIND + '\\/').test(CODE), 'catalog/{종류}/… 에 set·remove 를 직접 부르는 곳이 없다');
  chk(!/(?:set|remove)\(ref\(db,\s*`\$\{(?:node|other)\}/.test(CODE), '  ↳ _partPath 로 만든 경로에도 set·remove 를 직접 부르지 않는다');
  const writers = ['publishDesk', 'unpublishDesk', 'publishItem', 'unpublishItem', 'updateDesksOrder', 'updateItemsOrder',
                   'publishPart', 'unpublishPart', 'updatePartsOrder', 'cleanupCatalogBase64', 'migrateGachaCatalog'];
  for(const w of writers){
    const b = body(w);
    chk(!!b && /_catalogUpdate\(/.test(b) && !/await update\(ref\(db\)/.test(b), w + ' — _catalogUpdate 로 쓴다 (버전 같이 올림)');
  }
  chk(/_catalogUpdate\(\{\s*\[`\$\{node\}\/\$\{id\}`\][\s\S]{0,120}\[`\$\{other\}\/\$\{id\}`\]: null,\s*\}, \['parts', 'gachaParts'\]\)/.test(body('publishPart')),
      '  ↳ publishPart 는 반대편 통 정리까지 한 update 로 · 두 통 버전 다');
  chk(/touched\.push\(kind\)/.test(body('cleanupCatalogBase64')) && /_catalogUpdate\(updates, touched\)/.test(body('cleanupCatalogBase64')),
      '  ↳ cleanupCatalogBase64 는 실제로 지운 종류만 버전을 올린다');
  /* 이 파일 안에서 카탈로그 경로에 쓰는 메서드가 위 목록 밖에서 새로 생기면 알린다 */
  /* 여러 줄짜리 메서드만(한 줄짜리 _partPath 는 본문이 다음 메서드까지 번진다) · if/for 같은 문장은 뺀다 */
  const all = [...CODE.matchAll(/\n    (?:async )?(\w+)\([^)]*\)\{\s*\n/g)].map(m => m[1])
    .filter(n => !/^(?:if|for|while|switch|catch|function)$/.test(n));
  const extra = all.filter(n => !writers.includes(n) && /_catalogUpdate\(|`catalog\/(?:parts|gachaParts|items|desks)\/\$\{id\}`\]?\s*[:=]/.test(body(n)));
  chk(extra.length === 0, '목록 밖에서 카탈로그를 쓰는 메서드가 없다' + (extra.length ? ' — ' + extra.join(',') + ' (목록에 넣고 버전 확인)' : ''));
  const cu = (CODE.match(/async function _catalogUpdate\(updates, kinds\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(/withMeta\['catalogMeta\/' \+ k\] = serverTimestamp\(\)/.test(cu), '_catalogUpdate — 같은 update 에 catalogMeta/{종류} = 서버 시각');
  chk(/permission\|PERMISSION_DENIED/.test(cu) && /await update\(ref\(db\), updates\);/.test(cu), '  ↳ 규칙 배포 전(catalogMeta 거부)엔 카탈로그만 다시 쓴다 — 관리자 등록이 멎지 않게');
}

say('── 2. 규칙 — catalogMeta');
{
  const rules = JSON.parse(RJ).rules;
  const m = rules.catalogMeta || {};
  const k = m['$kind'] || {};
  chk(m['.read'] === true, '읽기는 누구나 (버전 숫자 넷뿐)');
  chk(!!k['.write'] && k['.write'] === ((rules.catalog || {}).parts || {})['$partId']['.write'], '쓰기는 catalog/parts 쓰기와 같은 조건 (관리자)');
  chk(/admins/.test(String(k['.write'])), '  ↳ 관리자 조건이다');
  const v = String(k['.validate'] || '');
  chk(/newData\.isNumber\(\)/.test(v) && /newData\.val\(\) > 0/.test(v), '값은 양수 숫자 (서버 시각) — 앱의 isCatalogVer 와 같은 모양');
  chk(/\$kind\.matches\(\/\^\(parts\|gachaParts\|items\|desks\)\$\/\)/.test(v), '종류 이름은 넷만');
  chk(/<= now \+ \d+/.test(v), '미래 시각은 거부 (콘솔에서 잘못 넣은 큰 값이 캐시를 영영 맞게 만들지 않게)');
}

say('── 3. 캐시 판정 (순수 함수)');
const mod = new Function(CC.replace(/^export (const|function) /mg, '$1 ') +
  '\nreturn { CATALOG_CACHE_MAX_AGE_MS, CATALOG_CACHE_SCHEMA, OFFLINE_GRACE_MS, LIVE_COALESCE_MIN_MS, LIVE_COALESCE_SPREAD_MS, isCatalogVer, decideCatalogCache, usableOfflineCache, createCatalogSync, createIdbCatalogStore };')();
const { CATALOG_CACHE_MAX_AGE_MS: AGE, CATALOG_CACHE_SCHEMA: SCH, OFFLINE_GRACE_MS: GRACE,
        LIVE_COALESCE_MIN_MS: LIVE_MIN, LIVE_COALESCE_SPREAD_MS: LIVE_SPREAD, isCatalogVer, decideCatalogCache: D, usableOfflineCache: U } = mod;
{
  const NOW = 1_800_000_000_000, V = 1_790_000_000_000;
  const e = (o) => Object.assign({ schema: SCH, ver: V, savedAt: NOW - 1000, data: { a: { name: 'x' } } }, o);
  chk(AGE === 24 * 3600 * 1000, '캐시 최대 수명 = 24시간');
  chk(!isCatalogVer(null) && !isCatalogVer('1') && !isCatalogVer(0) && !isCatalogVer(-1) && !isCatalogVer(NaN) && isCatalogVer(V), '버전은 양수 숫자만');
  chk(D(e(), null, NOW) === 'full', '버전 없음(catalogMeta 없음) → 통째 구독 (안전장치 ①) — 캐시가 있어도');
  chk(D(e(), '123', NOW) === 'full', '버전 형식이 이상해도 통째 구독');
  chk(D(e(), V, NOW) === 'cache', '같은 버전 · 수명 안 → 캐시');
  chk(D(e(), V + 1, NOW) === 'fetch', '버전 다름 → 다시 받기');
  chk(D(null, V, NOW) === 'fetch', '캐시 없음 → 받기');
  chk(D(e({ savedAt: NOW - AGE }), V, NOW) === 'fetch', '같은 버전이어도 24시간 지남 → 다시 받기 (안전장치 ②)');
  chk(D(e({ savedAt: NOW - AGE + 1 }), V, NOW) === 'cache', '  ↳ 24시간 직전까지는 캐시');
  chk(D(e({ savedAt: NOW + 60000 }), V, NOW) === 'fetch', '캐시 시각이 미래(시계 되돌림) → 낡은 것으로');
  chk(D(e({ schema: SCH + 1 }), V, NOW) === 'fetch', '캐시 모양 판이 다름 → 받기');
  chk(D(e({ data: null }), V, NOW) === 'fetch' && D(e({ data: [] }), V, NOW) === 'fetch', '캐시 데이터가 객체가 아님 → 받기');
  chk(D(e({ data: {} }), V, NOW) === 'cache', '빈 카탈로그({})도 정상 캐시');
  chk(D(e({ savedAt: '1' }), V, NOW) === 'fetch', 'savedAt 이 숫자가 아님 → 받기');
  chk(D('깨진 값', V, NOW) === 'fetch' && D(42, V, NOW) === 'fetch', '캐시 레코드가 객체가 아님(깨짐) → 받기');
  chk(U(e()) && U(e({ savedAt: NOW - AGE * 10 })), '오프라인 먼저 보여 주기 — 수명은 안 본다 (연결되면 다시 판정)');
  chk(!U(null) && !U('x') && !U(e({ schema: SCH + 1 })) && !U(e({ ver: null })) && !U(e({ data: [] })) && !U(e({ data: 'x' })),
      '  ↳ 깨진 캐시(모양 판 · 버전 · 데이터가 이상함)는 오프라인에도 안 쓴다');
}

say('── 4. 구독기 (가짜 DB · 가짜 저장소)');
(async () => {
  const flush = () => new Promise(r => setImmediate(r));
  const V = 1_790_000_000_000;
  const mk = (o = {}) => {
    const env = { log: [], subs: {}, clock: o.clock || 1_800_000_000_000, mem: Object.assign({}, o.mem || {}), timers: [],
                  server: Object.assign({ 'catalog/parts': { p1: { name: '모자', cat: 'hat' } } }, o.server || {}), got: [] };
    const store = {
      read: async (k) => { env.log.push(['read', k]); if(o.readThrows) throw new Error('idb'); return env.mem[k] || null; },
      write: async (k, r) => { env.log.push(['write', k]); if(o.writeThrows) throw new Error('quota'); env.mem[k] = JSON.parse(JSON.stringify(r)); },
    };
    env.sub = mod.createCatalogSync({
      metaRef: (k) => 'catalogMeta/' + k, catalogRef: (k) => 'catalog/' + k,
      onValue: (p, cb, err) => {
        env.log.push(['onValue', p]);
        const s = { cb, err, on: true };
        (env.subs[p] = env.subs[p] || []).push(s);
        return () => { s.on = false; env.log.push(['off', p]); };
      },
      get: async (p) => {
        env.got.push(p);
        if(o.getFails) throw Object.assign(new Error('offline'), { code: 'unavailable' });
        const v = env.server[p];
        return { val: () => (v == null ? null : JSON.parse(JSON.stringify(v))) };
      },
      store, scope: o.scope || 'https://tw.db', now: () => env.clock,
      setTimer: (fn, ms) => { const t = { fn, ms }; env.timers.push(t); return t; },
      clearTimer: (t) => { const i = env.timers.indexOf(t); if(i >= 0) env.timers.splice(i, 1); },
      random: () => (o.random == null ? 0.5 : o.random),
      warn: () => {},
    });
    env.fire = (p, v) => { for(const s of (env.subs[p] || [])) if(s.on) s.cb({ val: () => (v == null ? null : JSON.parse(JSON.stringify(v))) }); };
    env.deny = (p) => { for(const s of (env.subs[p] || [])) if(s.on && s.err) { s.on = false; s.err({ code: 'PERMISSION_DENIED' }); } };
    env.live = (p) => (env.subs[p] || []).filter(s => s.on).length;
    return env;
  };
  const fresh = (env, ver, data, age = 1000) => ({ schema: SCH, ver, savedAt: env.clock - age, data });
  try{
    /* ① catalogMeta 없음 */
    let e = mk(), got = [];
    e.sub('parts', v => got.push(v));
    chk(e.live('catalogMeta/parts') === 1 && e.live('catalog/parts') === 0, '처음엔 버전(catalogMeta/parts)만 구독한다 — 통째 구독 없음');
    e.fire('catalogMeta/parts', null); await flush();
    chk(e.live('catalog/parts') === 1 && e.got.length === 0, 'catalogMeta 없음 → 지금처럼 catalog/parts 통째 onValue (안전장치 ①)');
    e.fire('catalog/parts', { p1: { name: '모자' } });
    chk(got.length === 1 && got[0].p1.name === '모자', '  ↳ 통째 구독 값이 화면에 들어온다');
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.live('catalog/parts') === 0 && e.got.length === 1 && got.length === 2, '  ↳ 나중에 버전이 생기면 통째 구독을 끊고 한 번 받아 캐시로 전환');

    /* ① catalogMeta 구독 거부 (규칙 배포 전 — 루트 차단) */
    e = mk(); got = [];
    e.sub('items', v => got.push(v));
    e.deny('catalogMeta/items'); await flush();
    chk(e.live('catalog/items') === 1, 'catalogMeta 읽기 거부(규칙 배포 전) → 통째 onValue 로 물러난다 (재시도 없이 끊기는 구독)');

    /* 캐시 없음 → 받기 + 캐시 쓰기 */
    e = mk(); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && e.got[0] === 'catalog/parts' && got.length === 1 && got[0].p1.name === '모자', '캐시 없음 → 그 종류만 get 한 번 → 화면');
    chk(e.mem['https://tw.db|parts'] && e.mem['https://tw.db|parts'].ver === V, '  ↳ 캐시에 버전과 함께 남긴다 (키 = DB 주소|종류)');
    chk(e.live('catalog/parts') === 0, '  ↳ 통째 구독은 없다');
    got[0].p1.glb = 'BASE64…';   // 화면 쪽(resolveCatalogGlb)이 rec.glb 를 채운다
    chk(!e.mem['https://tw.db|parts'].data.p1.glb, '  ↳ 화면 쪽이 객체에 glb 를 채워도 캐시는 오염되지 않는다 (따로 뗀 객체)');
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 1, '같은 버전이 다시 와도 받지도 · 다시 넘기지도 않는다');
    e.server['catalog/parts'] = { p1: { name: '모자2' } };
    e.fire('catalogMeta/parts', V + 5); await flush(); await flush();
    const liveOf = (env) => env.timers.find(t => t.ms >= LIVE_MIN && t.ms <= LIVE_MIN + LIVE_SPREAD);
    let lt = liveOf(e);
    chk(e.got.length === 1 && !!lt && lt.ms === LIVE_MIN + LIVE_SPREAD / 2,
        '켜져 있는 동안 버전이 바뀌면 바로 받지 않고 모으는 타이머를 건다 (사람마다 ' + LIVE_MIN / 1000 + '~' + (LIVE_MIN + LIVE_SPREAD) / 1000 + '초로 흩음)');
    e.fire('catalogMeta/parts', V + 6); e.fire('catalogMeta/parts', V + 7); await flush();
    chk(e.timers.filter(t => t.ms >= LIVE_MIN && t.ms <= LIVE_MIN + LIVE_SPREAD).length === 1 && e.got.length === 1,
        '  ↳ 모으는 동안 또 바뀌어도(관리자가 순서를 여러 번 끌어 놓음) 타이머는 하나 · 받기 없음');
    e.timers.splice(e.timers.indexOf(lt), 1); lt.fn(); await flush(); await flush();
    chk(e.got.length === 2 && got.length === 2 && got[1].p1.name === '모자2' && e.mem['https://tw.db|parts'].ver === V + 7,
        '  ↳ 타이머가 끝나면 마지막 버전으로 한 번만 받아 화면 · 캐시에 반영');
    e.fire('catalogMeta/parts', null); await flush();
    chk(e.live('catalog/parts') === 1, '켜져 있는 동안 catalogMeta 가 지워지면 기다리지 않고 통째 구독으로');

    /* 캐시 적중 */
    e = mk({ mem: {} }); e.mem['https://tw.db|desks'] = fresh(e, V, { d1: { name: '책상' } }); got = [];
    e.sub('desks', v => got.push(v));
    e.fire('catalogMeta/desks', V); await flush(); await flush();
    chk(e.got.length === 0 && got.length === 1 && got[0].d1.name === '책상', '같은 버전 · 24시간 안 → 받지 않고 캐시 그대로');
    chk(e.timers.length === 1 && e.timers[0].ms > AGE - 2000 && e.timers[0].ms <= AGE + 1000, '  ↳ 캐시 수명이 끝나는 때 다시 판정하는 타이머를 건다');
    e.clock += AGE; const t = e.timers.shift(); t.fn(); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 2, '  ↳ 앱을 켜 둔 채 24시간이 지나면 버전이 같아도 다시 받는다 (안전장치 ②)');

    /* 오래된 캐시 */
    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V, { old: { name: '옛' } }, AGE + 1); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 1 && got[0].p1, '부팅 때 캐시가 24시간 넘음 → 버전이 같아도 다시 받는다 (옛 관리자 앱이 버전 없이 고친 것 대비)');

    /* 버전 다른 캐시 */
    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V - 1, { old: { name: '옛' } }); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 1 && got[0].p1 && !got[0].old, '버전 다름 → 다시 받아 그것만 넘긴다 (옛 캐시는 화면에 안 나간다)');

    /* 다른 DB(dev) 캐시는 안 쓴다 */
    e = mk({ scope: 'https://dev.db' }); e.mem['https://tw.db|parts'] = fresh(e, V, { old: { name: '운영' } }); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && !got[0].old, '다른 DB(운영↔dev)의 캐시는 안 쓴다');

    /* 캐시 읽기 실패 */
    e = mk({ readThrows: true }); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 1, '캐시 읽기 실패 → 서버에서 받는다 (앱은 그대로)');

    /* 캐시 쓰기 실패 */
    e = mk({ writeThrows: true }); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(got.length === 1 && got[0].p1, '캐시 쓰기 실패(용량 초과 등) → 화면엔 그대로 들어온다');

    /* 받기 실패 */
    e = mk({ getFails: true }); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.live('catalog/parts') === 1, '받기(get) 실패 → 통째 onValue 로 물러난다 (연결되면 채워진다)');

    /* 해제 */
    e = mk(); got = [];
    const un = e.sub('parts', v => got.push(v));
    un();
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.live('catalogMeta/parts') === 0 && got.length === 0 && e.got.length === 0, '해제하면 버전 구독도 끊기고 더 받지 않는다');

    /* 판정이 겹침 — 받는 중에 다시 판정하면 마지막 것만 */
    e = mk(); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', null); e.fire('catalogMeta/parts', V); await flush(); await flush(); await flush();
    chk(got.length === 1 && e.mem['https://tw.db|parts'].ver === V && e.live('catalog/parts') === 0,
        '판정이 겹치면 마지막 판정만 화면·캐시에 반영');

    /* 모으는 중에 해제 */
    e = mk(); got = [];
    const un2 = e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    e.fire('catalogMeta/parts', V + 1); await flush();
    un2();
    chk(!liveOf(e) && e.timers.length === 0, '해제하면 모으는 타이머 · 수명 타이머도 치운다');

    /* 안전장치 ③ — 오프라인 부팅(버전 구독이 답하지 않음) */
    const graceOf = (env) => env.timers.find(t => t.ms === GRACE);
    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V, { c1: { name: '캐시' } }); got = [];
    e.sub('parts', v => got.push(v));
    chk(!!graceOf(e), '구독하면 오프라인 대기 타이머(' + GRACE + 'ms)를 건다');
    let g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    chk(got.length === 1 && got[0].c1 && e.got.length === 0 && e.live('catalog/parts') === 0,
        '버전이 안 오면(오프라인) 캐시를 먼저 보여 준다 — 받기 · 통째 구독 없음');
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(got.length === 1 && e.got.length === 0, '  ↳ 연결돼 같은 버전이 오면 다시 넘기지도 받지도 않는다');

    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V, { old: { name: '옛' } }, AGE * 3); got = [];
    e.sub('parts', v => got.push(v));
    g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    chk(got.length === 1 && got[0].old, '오프라인이면 24시간 지난 캐시라도 먼저 보여 준다 (빈 화면보다 낫다)');
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 2 && got[1].p1, '  ↳ 연결되면 수명 지난 캐시는 다시 받아 바꾼다');

    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V - 1, { old: { name: '옛' } }); got = [];
    e.sub('parts', v => got.push(v));
    g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(got.length === 2 && got[1].p1 && !got[1].old, '  ↳ 연결돼 버전이 다르면 새로 받아 바꾼다');

    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V, { old: { name: '옛' } }); got = [];
    e.sub('parts', v => got.push(v));
    g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    e.fire('catalogMeta/parts', null); await flush();
    e.fire('catalog/parts', { p9: { name: '통째' } });
    chk(got.length === 2 && got[1].p9, '  ↳ 연결돼 catalogMeta 가 없으면 통째 구독 값으로 바꾼다');

    e = mk(); got = [];
    e.sub('parts', v => got.push(v));
    g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    chk(got.length === 0 && e.got.length === 0 && e.live('catalog/parts') === 0,
        '오프라인 · 캐시 없음 → 기다린다 (통째 구독을 미리 걸지 않는다 — 연결되면 버전 구독이 답한다)');
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 1, '  ↳ 연결되면 평소대로 받는다');

    e = mk(); e.mem['https://tw.db|parts'] = { schema: SCH, ver: V, savedAt: e.clock, data: '깨짐' }; got = [];
    e.sub('parts', v => got.push(v));
    g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    chk(got.length === 0, '깨진 캐시는 오프라인에도 보여 주지 않는다');
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(e.got.length === 1 && got.length === 1 && got[0].p1 && e.mem['https://tw.db|parts'].data.p1, '  ↳ 연결되면 받아서 깨진 캐시를 덮어쓴다');

    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V, { c1: { name: '캐시' } }); got = [];
    e.sub('parts', v => got.push(v));
    e.fire('catalogMeta/parts', V); await flush(); await flush();
    chk(!graceOf(e) && got.length === 1, '버전이 제때 오면 오프라인 대기 타이머는 치운다 (두 번 넘기지 않는다)');

    e = mk(); e.mem['https://tw.db|parts'] = fresh(e, V, { c1: { name: '캐시' } }); got = [];
    e.sub('parts', v => got.push(v))();
    chk(!graceOf(e), '해제하면 오프라인 대기 타이머도 치운다');

    /* IndexedDB 가 없는 환경 */
    const st = mod.createIdbCatalogStore(null);
    chk((await st.read('k')) === null && (await st.write('k', {})) === false, 'IndexedDB 가 없으면 저장소는 «캐시 없음» 으로 조용히 동작');
  }catch(err){ chk(false, '실행 오류 — ' + (err && err.stack || err)); }
  done();
})();

function done(){
  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
}
