/* sim-etag-store.js — 🏷️ ETag 기억을 껐다 켜도 남게(shared/etag-store.js)
   ・1절: 가짜 IndexedDB 위에서 — 넣기 · 꺼내기 · 없는 열쇠 null · 상한을 넘으면 오래된 것부터 · 지우기
   ・2절: 못 쓸 때 — IndexedDB 없음 · 열기 실패는 null · 조용히
   ・3절: html 차례(api-client.js 보다 먼저) · mutation test
   실행: node checks/run.js sim-etag-store */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/etag-store.js'), HTML = read('desk-companion-prototype.html');
if (!SRC || !HTML) { say('  ? 원본 못 찾음 — etag-store.js · desk-companion-prototype.html'); process.exit(2); }

/* 가짜 IndexedDB — open · get · put · getAll · delete · clear. 콜백은 다음 차례에 */
function mkIDB(o){
  o = o || {};
  const rows = new Map(); const later = (fn) => setImmediate(fn);
  const req = (fn) => { const r = {}; later(() => { r.result = fn(); r.onsuccess && r.onsuccess(); }); return r; };
  const db = { createObjectStore(){}, transaction(){ return { objectStore: () => ({
    get: (k) => req(() => rows.get(k)), put: (v) => { rows.set(v.k, v); return {}; }, getAll: () => req(() => [...rows.values()]),
    delete: (k) => { rows.delete(k); return {}; }, clear: () => req(() => { rows.clear(); }) }) }; } };
  const st = { opens: 0 };
  return { rows, st, idb: { open(){ st.opens++; const r = {}; later(() => { if(o.hang) return; if(o.blocked && st.opens === 1){ r.onblocked && r.onblocked(); return; } if(o.fail){ r.onerror && r.onerror(); return; } r.result = db; r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess && r.onsuccess(); }); return r; } } };
}
const load = (src, deps) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwEtagStore.createEtagStore(deps); };
const flush = () => new Promise((r) => setTimeout(r, 5));

async function judge(src){
  const r = []; const t = (ok, m) => r.push([!!ok, m]);
  let clock = 1000;
  const F = mkIDB(); const S = load(src, { indexedDB: F.idb, now: () => clock++ });
  await S.save('u1 /v2/me/avatars', '"e1"', { v: 1 }); await flush();
  const got = await S.load('u1 /v2/me/avatars');
  t(got && got.etag === '"e1"' && got.data.v === 1 && await S.load('없음') === null, '넣은 것을 열쇠로 꺼낸다 · 없는 열쇠는 null');
  for(let i = 0; i < 70; i++){ await S.save('k' + i, '"x"', i); }
  await flush();
  t(F.rows.size === 64 && !F.rows.has('u1 /v2/me/avatars') && F.rows.has('k69'), '상한(64)을 넘으면 오래된 것부터 지운다');
  await S.clear(); await flush();
  t(F.rows.size === 0, 'clear — 통째로 지운다(계정을 놓을 때)');
  const N = load(src, { indexedDB: null });
  t(await N.load('a') === null && (await N.save('a', 'e', 1)) === null && (await N.clear()) === null, 'IndexedDB 가 없으면 꺼내기 null · 넣기 · 지우기는 조용히');
  const X = load(src, { indexedDB: mkIDB({ fail: true }).idb });
  t(await X.load('a') === null, '  열기가 실패해도 null');
  const K = mkIDB({ blocked: true }); const KB = load(src, { indexedDB: K.idb });
  const k1 = await KB.load('a'); await KB.save('a', '"e"', 1); await flush(); const k2 = await KB.load('a');
  t(k1 === null && K.st.opens === 2 && k2 && k2.etag === '"e"', '열기가 막히면(onblocked) 이번엔 null · 다음 부름에 다시 연다');
  const H = mkIDB({ hang: true }); const HS = load(src, { indexedDB: H.idb, openMs: 40 });
  const keep = setTimeout(() => {}, 2000);   // AbortSignal.timeout 타이머는 Node 에서 프로세스를 붙잡지 않는다 — 기다리는 동안 붙잡아 둔다
  const t0 = Date.now(); const h1 = await HS.load('a'); const hms = Date.now() - t0; await HS.load('a');
  clearTimeout(keep);
  t(h1 === null && hms >= 30 && hms < 500 && H.st.opens === 2, '열기가 끝나지 않으면 상한(openMs)쯤 null · 다음 부름에 다시 연다 (' + hms + 'ms · 열기 ' + H.st.opens + '번)');
  const FL = mkIDB({ fail: true }); const FS = load(src, { indexedDB: FL.idb });
  await FS.load('a'); await FS.load('a');
  t(FL.st.opens === 2, '  열기가 실패해도 다음 부름에 다시 연다');
  const B = mkIDB(); const E = load(src, { indexedDB: B.idb });
  await E.save('a', '', 1); await flush();
  t(await E.load('a') === null, '빈 ETag 로 남은 줄은 없는 것으로 본다');
  return r;
}
(async () => {
  say('── 1~2. 돌려 본다');
  (await judge(SRC)).forEach(([ok, m]) => chk(ok, m));
  say('── 3. html · mutation test');
  const scripts = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map((x) => x[1]);
  chk(scripts.indexOf('shared/etag-store.js') > 0 && scripts.indexOf('shared/etag-store.js') < scripts.indexOf('shared/api-client.js'), 'html — etag-store.js 를 api-client.js 보다 먼저 싣는다');
  for(const [name, from, to] of [
    ['상한을 안 지킴', 'for(let i = 0; i < rows.length - MAX; i++)', 'for(let i = 0; i < 0; i++)'],
    ['지우기가 안 지움', 'const rq = st.clear();', 'const rq = st.getAll();'],
    ['열기 상한이 없음', "        try{ AbortSignal.timeout(openMs).addEventListener('abort', fail, { once: true }); }catch(_){}", ""],
    ['실패해도 다시 안 엶', "        rq.onerror = fail;", "        rq.onerror = () => res(null);"],
    ['막혀도 다시 안 엶', "        rq.onblocked = fail;", "        rq.onblocked = () => res(null);"],
    ['빈 ETag 도 돌려줌', "v && typeof v.etag === 'string' && v.etag ?", 'v ?'],
  ]){
    const m2 = SRC.replace(from, to);
    let red = false; if(m2 !== SRC){ try{ red = await Promise.race([judge(m2).then((rows) => rows.some(([ok]) => !ok)), new Promise((r) => setTimeout(() => r(true), 3000))]); }catch(_){ red = true; } }   // 멈추면(열기 상한 없음) 빨강
    chk(m2 !== SRC && red, name);
  }
  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})();
