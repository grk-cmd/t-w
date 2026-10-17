/* ═══ 🔗 sim-catalog-glb.js — 🔗 카탈로그 GLB 해결 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 카탈로그 GLB 해결 본문 을 parts/character/catalog-glb.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 영구 캐시 · 서버 받기로 메모리 → 캐시 → 서버 차례 · 실패 · 스냅샷 전부).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(resolveCatalogGlb · resolveCatalogGlbAll)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 2줄 그대로 · 부르는 곳은 catalogGlbMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · catalog-glb.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["catalog-glb.js","parts/character/catalog-glb.js","app/parts/character/catalog-glb.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — catalog-glb.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const CSRC = ["catalog-source.js","parts/character/catalog-source.js","app/parts/character/catalog-source.js"].map(read).find(Boolean);   // 서버 provider — 4절은 진짜 Firebase 판을 가짜 window 위에 만든다
const mkSource = (win) => { new Function('window', 'module', CSRC)(win, undefined); return win.TwCatalogSource.createCatalogSource({}); };
const FN_DEPS = [];
const VAL_DEPS = ["catalogSourceMod","glbIdbMod"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["resolveCatalogGlb","resolveCatalogGlbAll"];
const MOVED = ["_glbUrlCache","resolveCatalogGlb","resolveCatalogGlbAll"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  catalogSourceMod: catalogSourceMod,","  glbIdbMod: glbIdbMod,"];

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
    src + '\nreturn window.TwCatalogGlb;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createCatalogGlb(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCatalogGlb = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCatalogGlb(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("CATALOG_GLB_MOD_OFF") && app.includes("const catalogGlbMod = TwCatalogGlb.createCatalogGlb({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const catalogGlbMod = TwCatalogGlb\\.createCatalogGlb\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const catalogGlbMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 catalogGlbMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/catalog-glb.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/catalog-glb.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/catalog-glb.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const catalogGlbMod = TwCatalogGlb.createCatalogGlb({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const catalogGlbMod = TwCatalogGlb.createCatalogGlb({", "const catalogGlbMod = TwCatalogGlb.createCatalogGlb({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCatalogGlb = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const catalogGlbMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('catalogGlbMod.' + x)); if(n){ ls[i] = ls[i].replace('catalogGlbMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createCatalogGlb(deps){', 'function createCatalogGlb(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 영구 캐시 · 서버 받기 위에서 glbUrl → rec.glb 해결(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 카탈로그 GLB 해결(메모리 → 영구 캐시 → 서버)');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  const load = (opt) => {
    const o = opt || {};
    const log = { get: [], put: [], prune: 0, fetch: [], warn: 0 };
    const idb = o.idb || {};
    const fns = {
      _glbIdbGet: async (u) => { log.get.push(u); return idb[u] || null; },
      _glbIdbPut: (u, b) => { log.put.push([u, b]); return o.putHangs ? new Promise(() => {}) : Promise.resolve(); },
      _glbIdbPrune: () => { log.prune++; },
    };
    const fb = o.noApi ? undefined : { fetchCatalogGlb: async (u) => { log.fetch.push(u); if(o.fetchFails) throw new Error('net'); return 'NET:' + u; } };
    const win = { firebaseAPI: fb };
    const cons = { warn: () => { log.warn++; }, log: () => {} };
    let api;
    if(!PREMOVE){
      const w = Object.assign({}, win);
      new Function('window', 'module', 'firebaseAPI', 'console', MOD)(w, undefined, fb, cons);
      api = w.TwCatalogGlb.createCatalogGlb({ glbIdbMod: fns, catalogSourceMod: mkSource(w) });
    } else {
      const a = SRC.indexOf('const _glbUrlCache'), b = SRC.indexOf('/* ═══ 🧹 관리자 콘솔 도구', a);
      api = new Function('window', 'firebaseAPI', 'console', '_glbIdbGet', '_glbIdbPut', '_glbIdbPrune', SRC.slice(a, b) + '\nreturn { resolveCatalogGlb, resolveCatalogGlbAll };')(win, fb, cons, fns._glbIdbGet, fns._glbIdbPut, fns._glbIdbPrune);
    }
    return { api, log };
  };
  (async () => {
    let { api, log } = load();
    chk(await api.resolveCatalogGlb(null) === null && await api.resolveCatalogGlb(undefined) === null, 'rec 가 없으면 null');
    const old = { id: 'o', glb: 'OLD' };
    chk(await api.resolveCatalogGlb(old) === 'OLD' && !log.get.length && !log.fetch.length, '옛 레코드(rec.glb 가 이미 있음)는 그대로 — 캐시 · 서버를 안 본다');
    chk(await api.resolveCatalogGlb({ id: 'n' }) === null && !log.get.length, 'glb · glbUrl 둘 다 없으면 null');
    const r1 = { id: 'a', glbUrl: 'u1' };
    const b1 = await api.resolveCatalogGlb(r1);
    chk(b1 === 'NET:u1' && r1.glb === 'NET:u1' && log.get.join() === 'u1' && log.fetch.join() === 'u1', '처음 보는 url — 영구 캐시에 없으면 서버에서 받아 rec.glb 를 채운다');
    chk(log.put.length === 1 && log.put[0].join() === 'u1,NET:u1', '  받은 것을 영구 캐시에 넣는다');
    const r2 = { id: 'b', glbUrl: 'u1' };
    chk(await api.resolveCatalogGlb(r2) === 'NET:u1' && r2.glb === 'NET:u1' && log.get.length === 1 && log.fetch.length === 1, '  같은 url 두 번째는 메모리에서 — 다른 rec 에도 rec.glb 를 채운다(그래야 rec.glb 를 보는 곳이 안 틀린다)');
    ({ api, log } = load({ idb: { u2: 'DISK' } }));
    const r3 = { id: 'c', glbUrl: 'u2' };
    chk(await api.resolveCatalogGlb(r3) === 'DISK' && r3.glb === 'DISK' && !log.fetch.length && !log.put.length, '영구 캐시에 있으면 서버로 안 나간다(다시 넣지도 않는다)');
    await api.resolveCatalogGlb({ id: 'd', glbUrl: 'u2' });
    chk(log.get.length === 1, '  영구 캐시에서 꺼낸 것도 메모리에 올린다');
    ({ api, log } = load({ noApi: true }));
    const r4 = { id: 'e', glbUrl: 'u3' };
    chk(await api.resolveCatalogGlb(r4) === null && r4.glb === undefined, 'firebaseAPI 가 아직 없으면 null(rec 는 그대로)');
    ({ api, log } = load({ fetchFails: true }));
    const r5 = { id: 'f', glbUrl: 'u4' };
    chk(await api.resolveCatalogGlb(r5) === null && r5.glb === undefined && log.warn === 1 && !log.put.length, '서버 받기가 실패하면 null · 경고 한 줄 · 캐시에 안 넣는다');
    await api.resolveCatalogGlb(r5);
    chk(log.fetch.length === 2, '  실패는 기억하지 않는다 — 다음에 다시 받는다');
    ({ api, log } = load({ putHangs: true }));
    chk(await api.resolveCatalogGlb({ id: 'g', glbUrl: 'u5' }) === 'NET:u5', '영구 캐시 넣기를 기다리지 않는다(넣기가 안 끝나도 바로 돌려준다)');
    ({ api, log } = load({ idb: { k1: 'D1' } }));
    const cat = { x: { glbUrl: 'k1' }, y: { glbUrl: 'k2' }, z: { glb: 'Z' } };
    const back = await api.resolveCatalogGlbAll(cat);
    chk(back === cat && cat.x.glb === 'D1' && cat.y.glb === 'NET:k2' && cat.z.glb === 'Z' && log.prune === 1, 'resolveCatalogGlbAll — 스냅샷 전부를 채워 같은 객체로 돌려주고, 영구 캐시 치우기를 부른다');
    chk(await api.resolveCatalogGlbAll(null) === null && await api.resolveCatalogGlbAll({}) !== null && log.prune === 3, '  빈 스냅샷 · null 도 던지지 않는다(null 은 그대로)');
    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
