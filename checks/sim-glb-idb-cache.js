/* ═══ 💾 sim-glb-idb-cache.js — 💾 GLB 영구 캐시(IndexedDB) 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 GLB 영구 캐시(IndexedDB) 본문 을 parts/shared/glb-idb-cache.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 IndexedDB 로 넣기 · 꺼내기 · 치우기 · 실패 삼키기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_glbIdbGet · _glbIdbPrune · _glbIdbPut)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 0줄 그대로 · 부르는 곳은 glbIdbMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · glb-idb-cache.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["glb-idb-cache.js","parts/shared/glb-idb-cache.js","app/parts/shared/glb-idb-cache.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — glb-idb-cache.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = [];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["_glbIdbGet","_glbIdbPrune","_glbIdbPut"];
const MOVED = ["_GLB_IDB_NAME","_GLB_IDB_STORE","_GLB_IDB_TTL","_glbIdbPromise","_glbIdb","_glbIdbGet","_glbIdbPut","_glbIdbPruned","_glbIdbPrune"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = [];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwGlbIdbCache;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createGlbIdbCache(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwGlbIdbCache = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwGlbIdbCache(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("GLB_IDB_MOD_OFF") && app.includes("const glbIdbMod = TwGlbIdbCache.createGlbIdbCache({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const glbIdbMod = TwGlbIdbCache\\.createGlbIdbCache\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const glbIdbMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 glbIdbMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/shared/glb-idb-cache.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/shared/glb-idb-cache.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/shared/glb-idb-cache.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const glbIdbMod = TwGlbIdbCache.createGlbIdbCache({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const glbIdbMod = TwGlbIdbCache.createGlbIdbCache({", "const glbIdbMod = TwGlbIdbCache.createGlbIdbCache({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwGlbIdbCache = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «부르는 곳이 옛 이름» 깨 보기는 없다 — 내놓은 이름은 app.js 가 아니라 catalog-glb.js 가 glbIdbMod 로 받아 부른다 */
  ['만들 때 던짐', m => m.replace('function createGlbIdbCache(deps){', 'function createGlbIdbCache(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 IndexedDB 위에서 넣기 · 꺼내기 · 오래된 것 치우기 · 실패 삼키기(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — GLB 영구 캐시(IndexedDB)');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  /* 가짜 IndexedDB — open(이름, 판) · objectStore get · put · openCursor(delete · continue) 만. 콜백은 다음 차례(setImmediate)에 */
  const mkIDB = (opts) => {
    const o = opts || {};
    const stores = {}; const log = { opens: 0, created: [], puts: 0 };
    const later = (fn) => setImmediate(fn);
    const req = (fn) => { const r = {}; later(() => { try{ r.result = fn(); r.onsuccess && r.onsuccess(); }catch(e){ r.error = e; r.onerror && r.onerror(); } }); return r; };
    const db = {
      createObjectStore(name, cfg){ stores[name] = stores[name] || new Map(); log.created.push([name, cfg && cfg.keyPath]); },
      transaction(name, mode){ if(o.txThrows) throw new Error('tx'); const st = stores[name]; return { objectStore: () => ({
        get: (k) => o.getFails ? (() => { const r = {}; later(() => r.onerror && r.onerror()); return r; })() : req(() => st.get(k)),
        put: (v) => { if(mode !== 'readwrite') throw new Error('readonly'); log.puts++; st.set(v.url, v); return {}; },
        openCursor: () => { const keys = [...st.keys()]; let i = 0; const r = {};
          const step = () => later(() => { if(i >= keys.length){ r.result = null; r.onsuccess && r.onsuccess(); return; }
            const k = keys[i++]; r.result = { value: st.get(k), delete: () => st.delete(k), continue: step }; r.onsuccess && r.onsuccess(); });
          step(); return r; },
      }) }; },
    };
    const idb = { open(name, ver){ log.opens++; log.name = name; log.ver = ver; const r = {};
      later(() => { if(o.openFails){ r.onerror && r.onerror(); return; } r.result = db; if(!log.upgraded){ log.upgraded = true; r.onupgradeneeded && r.onupgradeneeded(); } r.onsuccess && r.onsuccess(); }); return r; } };
    return { idb, stores, log, seed: (name, v) => { (stores[name] = stores[name] || new Map()).set(v.url, v); } };
  };
  const tick = () => new Promise(r => setTimeout(r, 5));
  const DAY = 86400000, NOW = 1800000000000, TTL = 45 * DAY;
  const fakeDate = { now: () => NOW };
  const load = (idb) => {
    const win = idb ? { indexedDB: idb } : {};
    if(!PREMOVE){
      const w = Object.assign({}, win);
      new Function('window', 'module', 'indexedDB', 'Date', MOD)(w, undefined, idb, fakeDate);
      return w.TwGlbIdbCache.createGlbIdbCache({});
    }
    const a = SRC.indexOf('/* 💾 카탈로그 GLB 영구 캐시 (IndexedDB)'), b = SRC.indexOf('const _glbUrlCache', a);
    return new Function('window', 'indexedDB', 'Date', SRC.slice(a, b) + '\nreturn { _glbIdbGet, _glbIdbPut, _glbIdbPrune };')(win, idb, fakeDate);
  };
  (async () => {
    let C = load(null);
    const g0 = await C._glbIdbGet('u'); const p0 = await C._glbIdbPut('u', 'x'); let e0 = null; try{ C._glbIdbPrune(); }catch(e){ e0 = e; }
    chk(g0 === null && p0 === undefined && !e0, 'IndexedDB 가 없으면(사파리 프라이빗 등) 꺼내기 null · 넣기 · 치우기는 조용히 지나간다');
    let F = mkIDB({ openFails: true }); C = load(F.idb);
    chk(await C._glbIdbGet('u') === null && (await C._glbIdbPut('u', 'x')) === undefined, '열기가 실패해도 null · 넣기는 조용히');
    F = mkIDB(); C = load(F.idb);
    await C._glbIdbPut('https://a/1', 'B64-1');
    const g1 = await C._glbIdbGet('https://a/1');
    const rec = F.stores.glb && F.stores.glb.get('https://a/1');
    chk(g1 === 'B64-1' && rec && rec.ts === NOW && rec.b64 === 'B64-1', '넣은 것을 url 로 꺼낸다(레코드 { url, b64, ts })');
    chk(F.log.name === 'tw-glb-cache' && F.log.ver === 1 && F.log.created.join() === 'glb,url', '  DB tw-glb-cache 판 1 · 저장소 glb(keyPath url)');
    await C._glbIdbGet('https://a/1'); await C._glbIdbGet('https://a/2');
    chk(F.log.opens === 1, '  DB 는 한 번만 연다(약속을 들고 있다)');
    chk(await C._glbIdbGet('https://a/2') === null, '  없는 url 은 null');
    F = mkIDB({ getFails: true }); C = load(F.idb);
    chk(await C._glbIdbGet('u') === null, '꺼내기 요청이 실패하면 null');
    F = mkIDB({ txThrows: true }); C = load(F.idb);
    let e1 = null; try{ chk(await C._glbIdbGet('u') === null, '트랜잭션이 던져도 꺼내기는 null'); await C._glbIdbPut('u', 'x'); }catch(e){ e1 = e; }
    chk(!e1, '  넣기도 던지지 않는다');
    F = mkIDB(); C = load(F.idb);
    F.seed('glb', { url: 'old', b64: 'o', ts: NOW - 46 * DAY });
    F.seed('glb', { url: 'edge', b64: 'e', ts: NOW - TTL });
    F.seed('glb', { url: 'edge+1', b64: 'e1', ts: NOW - TTL + 1 });
    F.seed('glb', { url: 'fresh', b64: 'f', ts: NOW - DAY });
    F.seed('glb', { url: 'nots', b64: 'n' });
    C._glbIdbPrune(); for(let i = 0; i < 12; i++) await tick();
    chk([...F.stores.glb.keys()].sort().join() === 'edge+1,fresh', '치우기 — 45일 넘은 것 · 딱 45일 · ts 없는 것은 지우고 그 안쪽은 남긴다');
    F.seed('glb', { url: 'old2', b64: 'o', ts: NOW - 99 * DAY });
    C._glbIdbPrune(); for(let i = 0; i < 6; i++) await tick();
    chk(F.stores.glb.has('old2'), '  치우기는 한 실행(모듈)에 한 번만');
    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
