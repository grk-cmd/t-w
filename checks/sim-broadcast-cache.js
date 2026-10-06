/* sim-broadcast-cache.js — 공용 공지 버전 확인(inboxBroadcastMeta) + 로컬 캐시 (app/parts/broadcast-cache.js)
   [무엇을 보는가] 부팅마다 inboxBroadcast 를 통째로 onValue 하던 것을 inboxBroadcastMeta 버전 확인 + 로컬 캐시 +
     «최근 30개 + 고정 공지» 받기로 바꿨다. 구독기 자체는 카탈로그와 같은 것(catalog-cache.js createCatalogSync)이라
     안전장치 하나하나는 sim-catalog-cache.js 가 본다. 이 검사는
       · 공지를 쓰는 함수(보내기 · 고정 · 삭제)가 하나도 빠짐없이 버전을 같이 올리는가
       · 버전이 없거나 거부되거나 받기가 실패하면 예전처럼 통째 구독하는가
       · 받을 때 최근 30개 + 고정 공지를 id 로 합치는가 (30개보다 오래된 고정 공지도 들어오는가)
       · 버전이 바뀌면 지운 공지가 사라지는가 · 캐시가 맞으면 받지 않는가 · 오프라인이면 캐시를 먼저 보여 주는가
       · 읽음 표시(각 기기 localStorage)는 그대로인가
     를 본다. 웹 관리자 쪽 버전 올림은 web-admin/tests/entities/broadcast-version.test.ts 가 본다.
   ・1절: firebase-init.js — import · 구독 연결 · 쓰기가 전부 _broadcastUpdate 를 지나는가
   ・2절: firebase-database-rules.json — inboxBroadcastMeta 규칙
   ・3절: broadcast-cache.js — 합치기(순수 함수)
   ・4절: 구독기를 가짜 DB · 가짜 저장소로 돌려 본다
   [실행] firebase-init.js · catalog-cache.js · broadcast-cache.js · app.js · firebase-database-rules.json 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const FI = read('firebase-init.js'), CC = read('catalog-cache.js'), BC = read('broadcast-cache.js'),
      RJ = read('firebase-database-rules.json'), APP = read('app.js');
for(const [n, v] of [['firebase-init.js', FI], ['catalog-cache.js', CC], ['broadcast-cache.js', BC], ['firebase-database-rules.json', RJ], ['app.js', APP]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(FI);
const body = (name) => {
  const m = new RegExp('\\n    (?:async )?' + name + '\\(').exec(CODE);
  if(!m) return '';
  const i = m.index; const j = CODE.indexOf('\n    },', i);
  return CODE.slice(i, j < 0 ? undefined : j);
};

say('── 1. firebase-init.js 연결');
{
  chk(/import \{ createBroadcastSync \} from "\.\/broadcast-cache\.js";/.test(CODE), 'broadcast-cache.js 를 import 한다');
  chk(/\bequalTo\b[^;]*\} from "https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-database\.js"/.test(CODE), '  ↳ equalTo 를 database SDK 에서 들여온다');
  chk(/metaRef:\s*\(\) => ref\(db, 'inboxBroadcastMeta'\)/.test(CODE) && /fullRef:\s*\(\) => ref\(db, 'inboxBroadcast'\)/.test(CODE),
      '경로는 firebase-init.js 가 만든다 (audit 검사 7 이 규칙과 대조한다)');
  chk(/latestQuery:\s*\(n\) => query\(ref\(db, 'inboxBroadcast'\), orderByChild\('ts'\), limitToLast\(n\)\)/.test(CODE), '최근 n 개 = ts 순 limitToLast');
  chk(/pinnedQuery:\s*\(\) => query\(ref\(db, 'inboxBroadcast'\), orderByChild\('pinned'\), equalTo\(true\)\)/.test(CODE), '고정 공지 = pinned equalTo(true)');
  chk(/createBroadcastSync\(\{[\s\S]{0,700}scope: \(firebaseConfig && \(firebaseConfig\.databaseURL/.test(CODE), '캐시 키 앞머리 = DB 주소 (운영/dev 섞임 방지)');
  chk(/liveNow: \(\) => Date\.now\(\) - _broadcastWroteAt < BROADCAST_OWN_WRITE_MS/.test(CODE), '이 기기가 방금 쓴 바뀜은 모으지 않고 바로 받는다 (관리자 화면)');
  const sb = body('subscribeInboxBroadcast');
  chk(/_subscribeBroadcast\(/.test(sb) && !/onValue\(/.test(sb), 'subscribeInboxBroadcast → 버전 확인 + 캐시 (통째 onValue 없음)');
  chk(!/onValue\(\s*(?:ref\(db,\s*['`"]inboxBroadcast['`"]\)|r)\s*,/.test(sb), '  ↳ inboxBroadcast 를 직접 통째 구독하지 않는다');
  chk(!/(?:set|remove)\(ref\(db,\s*[`'"]inboxBroadcast\//.test(CODE), 'inboxBroadcast/… 에 set·remove 를 직접 부르는 곳이 없다');
  const writers = ['sendInboxBroadcast', 'setInboxBroadcastPinned', 'deleteInboxBroadcast'];
  for(const w of writers){
    const b = body(w);
    chk(!!b && /_broadcastUpdate\(/.test(b) && !/await (?:set|update|remove)\(ref\(db/.test(b), w + ' — _broadcastUpdate 로 쓴다 (버전 같이 올림)');
  }
  chk(/_broadcastUpdate\(\{ \[`inboxBroadcast\/\$\{msgId\}\/pinned`\]: pinned \? true : null \}\)/.test(body('setInboxBroadcastPinned')),
      '  ↳ 고정 해제는 키를 지운다 (pinned:false 를 남기지 않는다 — 고정 query 가 equalTo(true))');
  const all = [...CODE.matchAll(/\n    (?:async )?(\w+)\([^)]*\)\{\s*\n/g)].map(m => m[1])
    .filter(n => !/^(?:if|for|while|switch|catch|function)$/.test(n));
  const extra = all.filter(n => !writers.includes(n) && /_broadcastUpdate\(|`inboxBroadcast\/\$\{/.test(body(n)));
  chk(extra.length === 0, '목록 밖에서 공지를 쓰는 메서드가 없다' + (extra.length ? ' — ' + extra.join(',') + ' (목록에 넣고 버전 확인)' : ''));
  const bu = (CODE.match(/async function _broadcastUpdate\(updates\)\{[\s\S]*?\n  \}/) || [''])[0];
  chk(/inboxBroadcastMeta: serverTimestamp\(\)/.test(bu) && /update\(ref\(db\), Object\.assign\(\{\}, updates/.test(bu),
      '_broadcastUpdate — 같은 다중 경로 update 에 inboxBroadcastMeta = 서버 시각');
  chk(/permission\|PERMISSION_DENIED/.test(bu) && /await update\(ref\(db\), updates\);/.test(bu), '  ↳ 규칙 배포 전(inboxBroadcastMeta 거부)엔 공지만 다시 쓴다');
  chk(bu.indexOf('_broadcastWroteAt = Date.now()') >= 0 && bu.indexOf('_broadcastWroteAt = Date.now()') < bu.indexOf('await update('),
      '  ↳ 쓴 시각 표시는 update 보다 먼저 (버전 구독이 update 를 부르는 순간 울린다)');
}

say('── 2. 규칙 — inboxBroadcastMeta');
{
  const rules = JSON.parse(RJ).rules;
  const m = rules.inboxBroadcastMeta || {};
  const ib = rules.inboxBroadcast || {};
  chk(m['.read'] === true, '읽기는 누구나 (버전 숫자 하나)');
  chk(!!m['.write'] && m['.write'] === ib['.write'] && /admins/.test(String(m['.write'])), '쓰기는 inboxBroadcast 쓰기와 같은 조건 (관리자)');
  const v = String(m['.validate'] || '');
  chk(/newData\.isNumber\(\)/.test(v) && /newData\.val\(\) > 0/.test(v), '값은 양수 숫자 (서버 시각) — 앱의 isCatalogVer 와 같은 모양');
  chk(/<= now \+ \d+/.test(v), '미래 시각은 거부');
  const idx = ib['.indexOn'] || [];
  chk(idx.includes('ts') && idx.includes('pinned'), 'inboxBroadcast 색인 ts · pinned 그대로 (최근 n 개 · 고정 query)');
  chk(ib['.read'] === true && !!ib['$msgId'], '옛 앱이 쓰는 inboxBroadcast 통째 읽기 · 공지 검증은 그대로');
}

say('── 3. 합치기 (순수 함수)');
const CCX = CC.replace(/^export (const|function) /mg, '$1 ');
const cat = new Function(CCX + '\nreturn { CATALOG_CACHE_SCHEMA, CATALOG_CACHE_MAX_AGE_MS, OFFLINE_GRACE_MS, LIVE_COALESCE_MIN_MS, LIVE_COALESCE_SPREAD_MS, createCatalogSync };')();
const mod = new Function('createCatalogSync',
  BC.replace(/^import \{ createCatalogSync \} from '\.\/catalog-cache\.js';$/m, '').replace(/^export (const|function) /mg, '$1 ') +
  '\nreturn { BROADCAST_KIND, BROADCAST_LATEST, mergeBroadcasts, createBroadcastSync };')(cat.createCatalogSync);
const { BROADCAST_KIND, BROADCAST_LATEST, mergeBroadcasts: M } = mod;
{
  chk(BROADCAST_LATEST === 30, '최근 30개를 받는다 (웹 관리자 BROADCAST_PAGE 와 같다)');
  chk(!['parts', 'gachaParts', 'items', 'desks'].includes(BROADCAST_KIND), '캐시 키 꼬리가 카탈로그 종류와 겹치지 않는다');
  const r = M({ a: { ts: 2 }, b: { ts: 3 } }, { p: { ts: 1, pinned: true }, b: { ts: 3 } });
  chk(Object.keys(r).sort().join() === 'a,b,p', '최근 + 고정을 id 로 합친다 (겹치는 id 는 하나)');
  chk(Object.keys(M(null, null)).length === 0 && Object.keys(M({ a: { ts: 1 } }, null)).join() === 'a', '어느 쪽이 비어(null) 있어도 된다');
  chk(Object.keys(M({ a: 'x', b: null, c: { ts: 1 } }, [])).join() === 'c', '객체가 아닌 항목 · 배열은 뺀다');
}

say('── 4. 구독기 (가짜 DB · 가짜 저장소)');
(async () => {
  const { CATALOG_CACHE_SCHEMA: SCH, CATALOG_CACHE_MAX_AGE_MS: AGE, OFFLINE_GRACE_MS: GRACE,
          LIVE_COALESCE_MIN_MS: LIVE_MIN, LIVE_COALESCE_SPREAD_MS: LIVE_SPREAD } = cat;
  const flush = async () => { for(let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
  const V = 1_790_000_000_000;
  const KEY = 'https://tw.db|' + BROADCAST_KIND;
  const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
  /* 공지 40개 — b00(가장 오래됨) … b39. b02 는 고정(30개 밖) · b35 도 고정(30개 안). */
  const many = () => {
    const o = {};
    for(let i = 0; i < 40; i++){
      const id = 'b' + String(i).padStart(2, '0');
      o[id] = { tag: 'notice', title: id, ts: 1000 + i };
      if(i === 2 || i === 35) o[id].pinned = true;
    }
    return o;
  };
  const mk = (o = {}) => {
    const env = { subs: {}, clock: o.clock || 1_800_000_000_000, mem: Object.assign({}, o.mem || {}), timers: [],
                  server: o.server || many(), got: [], wrote: !!o.wrote };
    /* query 는 설명 객체로 — 가짜 get 이 그걸 보고 잘라 준다(실제 RTDB 의 orderByChild · limitToLast · equalTo 흉내) */
    const runQuery = (q) => {
      const all = Object.entries(env.server || {});
      if(q.last){
        all.sort(([, a], [, b]) => (a[q.by] ?? 0) - (b[q.by] ?? 0));
        return Object.fromEntries(all.slice(-q.last));
      }
      return Object.fromEntries(all.filter(([, v]) => v[q.by] === q.eq));
    };
    env.sync = mod.createBroadcastSync({
      metaRef: () => 'inboxBroadcastMeta', fullRef: () => 'inboxBroadcast',
      latestQuery: (n) => ({ path: 'inboxBroadcast', by: 'ts', last: n }),
      pinnedQuery: () => ({ path: 'inboxBroadcast', by: 'pinned', eq: true }),
      onValue: (p, cb, err) => {
        const s = { cb, err, on: true };
        (env.subs[p] = env.subs[p] || []).push(s);
        return () => { s.on = false; };
      },
      get: async (q) => {
        env.got.push(q.by + (q.last ? ':last' + q.last : ':eq'));
        if(o.getFails && o.getFails(q)) throw Object.assign(new Error('Index not defined'), { code: 'index' });
        const v = runQuery(q);
        return { val: () => clone(v) };
      },
      store: {
        read: async (k) => env.mem[k] || null,
        write: async (k, r) => { env.mem[k] = clone(r); },
      },
      scope: 'https://tw.db', now: () => env.clock,
      setTimer: (fn, ms) => { const t = { fn, ms }; env.timers.push(t); return t; },
      clearTimer: (t) => { const i = env.timers.indexOf(t); if(i >= 0) env.timers.splice(i, 1); },
      random: () => 0.5,
      liveNow: () => env.wrote,
      warn: () => {},
    });
    env.fire = (p, v) => { for(const s of (env.subs[p] || [])) if(s.on) s.cb({ val: () => clone(v) }); };
    env.deny = (p) => { for(const s of (env.subs[p] || [])) if(s.on && s.err){ s.on = false; s.err({ code: 'PERMISSION_DENIED' }); } };
    env.live = (p) => (env.subs[p] || []).filter(s => s.on).length;
    return env;
  };
  const fresh = (env, ver, data, age = 1000) => ({ schema: SCH, ver, savedAt: env.clock - age, data });
  const liveOf = (env) => env.timers.find(t => t.ms >= LIVE_MIN && t.ms <= LIVE_MIN + LIVE_SPREAD);
  try{
    /* 캐시 없음 → 최근 30 + 고정 */
    let e = mk(), got = [];
    e.sync(v => got.push(v));
    chk(e.live('inboxBroadcastMeta') === 1 && e.live('inboxBroadcast') === 0, '처음엔 버전(inboxBroadcastMeta)만 구독한다 — 통째 구독 없음');
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.got.sort().join() === 'pinned:eq,ts:last30', '캐시 없음 → 최근 30개 + 고정 공지 두 query 를 한 번씩');
    const ids = Object.keys(got[0] || {});
    chk(got.length === 1 && ids.length === 31, '  ↳ 화면엔 30개 + 30개 밖 고정 1개 = 31개 (40개 통째가 아니다)');
    chk(!!got[0].b02 && got[0].b02.pinned === true, '  ↳ 30개보다 오래된 고정 공지(b02)도 들어온다');
    chk(!got[0].b00 && !got[0].b09 && !!got[0].b10 && !!got[0].b39, '  ↳ 고정 아닌 오래된 공지(b00~b09)는 안 온다 · 최근 b10~b39 는 온다');
    chk(e.mem[KEY] && e.mem[KEY].ver === V && Object.keys(e.mem[KEY].data).length === 31, '  ↳ 합친 것을 버전과 함께 캐시 (키 = DB 주소|inboxBroadcast)');
    got[0].b39.pinned = true;   // app.js 고정 토글이 받은 객체를 고친다
    chk(!e.mem[KEY].data.b39.pinned, '  ↳ 화면 쪽이 받은 객체를 고쳐도 캐시는 오염되지 않는다');

    /* 같은 버전 다시 → 아무것도 안 함 */
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.got.length === 2 && got.length === 1, '같은 버전이 다시 와도 받지도 · 다시 넘기지도 않는다');

    /* 켜져 있는 동안 관리자가 공지를 지움 → 모았다가 다시 받으면 사라진다 */
    delete e.server.b39; delete e.server.b02;
    e.fire('inboxBroadcastMeta', V + 5); await flush();
    const lt = liveOf(e);
    chk(e.got.length === 2 && !!lt, '켜져 있는 동안 버전이 바뀌면 10~50초 모으는 타이머를 건다 (바로 받지 않는다)');
    e.timers.splice(e.timers.indexOf(lt), 1); lt.fn(); await flush();
    chk(got.length === 2 && !got[1].b39 && !got[1].b02 && e.mem[KEY].ver === V + 5 && !e.mem[KEY].data.b39,
        '  ↳ 버전이 바뀐 뒤 받으면 지운 공지(b39 · 고정 b02)가 화면 · 캐시에서 사라진다');
    chk(Object.keys(got[1]).length === 30 && !!got[1].b09 && !got[1].b08, '  ↳ 하나 지워지면 그다음 오래된 공지(b09)가 30개 안으로 들어온다 (b02 고정이 빠져 30개)');

    /* 이 기기가 방금 씀(관리자) → 모으지 않고 바로 */
    e = mk({ wrote: true }); got = [];
    e.sync(v => got.push(v));
    e.fire('inboxBroadcastMeta', V); await flush();
    e.server.b40 = { tag: 'notice', title: '새 공지', ts: 9999 };
    e.fire('inboxBroadcastMeta', V + 1); await flush();
    chk(!liveOf(e) && got.length === 2 && !!got[1].b40, '이 기기가 방금 쓴 바뀜(liveNow)은 모으지 않고 바로 받는다 — 관리자 화면에 바로 보인다');

    /* 캐시 적중 */
    e = mk(); e.mem[KEY] = fresh(e, V, { c1: { tag: 'notice', title: '캐시', ts: 1 } }); got = [];
    e.sync(v => got.push(v));
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.got.length === 0 && got.length === 1 && got[0].c1, '같은 버전 · 24시간 안 → 받지 않고 캐시 그대로 (부팅 다운로드 = 버전 숫자 하나)');

    /* 버전 다른 캐시 */
    e = mk(); e.mem[KEY] = fresh(e, V - 1, { c1: { tag: 'notice', title: '옛', ts: 1 } }); got = [];
    e.sync(v => got.push(v));
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.got.length === 2 && got.length === 1 && !got[0].c1 && got[0].b39, '부팅 때 버전이 다르면 새로 받는다 — 옛 캐시는 화면에 안 나간다');

    /* 24시간 지난 캐시 */
    e = mk(); e.mem[KEY] = fresh(e, V, { c1: { tag: 'notice', title: '옛', ts: 1 } }, AGE + 1); got = [];
    e.sync(v => got.push(v));
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.got.length === 2 && !got[0].c1, '캐시가 24시간 넘으면 버전이 같아도 다시 받는다 (옛 앱 관리자가 버전 없이 고친 것 대비)');

    /* 안전장치 — 버전 없음 */
    e = mk(); got = [];
    e.sync(v => got.push(v));
    e.fire('inboxBroadcastMeta', null); await flush();
    chk(e.live('inboxBroadcast') === 1 && e.got.length === 0, 'inboxBroadcastMeta 없음(초깃값 안 넣음) → 예전처럼 inboxBroadcast 통째 onValue');
    e.fire('inboxBroadcast', e.server);
    chk(got.length === 1 && Object.keys(got[0]).length === 40, '  ↳ 통째 구독 값이 그대로 화면에 들어온다 (예전 모양)');
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.live('inboxBroadcast') === 0 && got.length === 2 && Object.keys(got[1]).length === 31, '  ↳ 나중에 버전이 생기면 통째 구독을 끊고 캐시 방식으로');

    /* 안전장치 — 거부 */
    e = mk(); got = [];
    e.sync(v => got.push(v));
    e.deny('inboxBroadcastMeta'); await flush();
    chk(e.live('inboxBroadcast') === 1 && e.got.length === 0, 'inboxBroadcastMeta 읽기 거부(규칙 배포 전) → 통째 onValue');

    /* 안전장치 — 받기 실패(색인 없음 등) */
    e = mk({ getFails: (q) => q.by === 'pinned' }); got = [];
    e.sync(v => got.push(v));
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.live('inboxBroadcast') === 1 && !e.mem[KEY], '두 query 중 하나라도 실패(색인 없음 · 오프라인) → 통째 onValue · 반쪽 캐시 안 남김');

    /* 안전장치 — 오프라인 부팅 */
    const graceOf = (env) => env.timers.find(t => t.ms === GRACE);
    e = mk(); e.mem[KEY] = fresh(e, V, { c1: { tag: 'notice', title: '캐시', ts: 1 } }, AGE * 2); got = [];
    e.sync(v => got.push(v));
    let g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    chk(got.length === 1 && got[0].c1 && e.got.length === 0 && e.live('inboxBroadcast') === 0,
        '버전이 ' + GRACE + 'ms 안에 안 오면(오프라인) 캐시를 먼저 보여 준다 — 수명이 지났어도');
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.got.length === 2 && got.length === 2 && got[1].b39, '  ↳ 연결되면 다시 판정해 새로 받는다');

    e = mk(); got = [];
    e.sync(v => got.push(v));
    g = graceOf(e); e.timers.splice(e.timers.indexOf(g), 1); await g.fn(); await flush();
    chk(got.length === 0 && e.live('inboxBroadcast') === 0, '오프라인 · 캐시 없음 → 기다린다 (예전 통째 구독도 연결 전엔 아무것도 안 왔다)');

    /* 해제 */
    e = mk(); got = [];
    const un = e.sync(v => got.push(v));
    un();
    e.fire('inboxBroadcastMeta', V); await flush();
    chk(e.live('inboxBroadcastMeta') === 0 && got.length === 0 && e.got.length === 0 && e.timers.length === 0, '해제하면 구독 · 타이머 다 치우고 더 받지 않는다');
  }catch(err){ chk(false, '실행 오류 — ' + (err && err.stack || err)); }

  say('── 5. 읽음 표시는 각 기기에 (받는 방법과 무관)');
  {
    const A = strip(APP);
    chk(/const INBOX_BC_READ_KEY = 'tw\.inboxBcRead';/.test(A), '읽음 id 집합은 localStorage tw.inboxBcRead 그대로');
    chk(/firebaseAPI\.subscribeInboxBroadcast\(bc=>\{\s*const prevIds = Object\.keys\(_inboxBroadcast\|\|\{\}\);\s*_inboxBroadcast = bc \|\| \{\};/.test(A),
        '화면은 예전처럼 { id: 공지 } 객체 하나를 받아 통째로 바꾼다 (콜백 모양 그대로)');
    chk(/read: bcRead\.has\(id\)/.test(A), '  ↳ 읽음은 id 로 판정 — 캐시에서 왔든 받았든 같다');
  }
  done();
})();

function done(){
  say(fail ? `\n✗ 실패 ${fail}건` : `\n전부 통과 ✅ (${pass}건)`);
  process.exit(fail ? 1 : 0);
}
