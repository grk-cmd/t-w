/* ═══ 🧹 sim-http-cache-reset.js — 웹 캐시 재발 방지(http-cache-reset.js · firebase-init.js fetchCatalogGlb) ═══════════════
   [왜] 웹 캐시에 깨진 응답이 남으면 앱이 서버에 다시 묻지 않고 그것만 꺼내 책상 · 장신구(E-CHAR-14)와 썸네일이 계속 안 떴다.
   ・1절: 버전이 바뀐 뒤 첫 실행에만 비운다 · 같은 버전이면 안 비운다 · 표시 파일 · 못 비우면 표시를 안 남김 · 오래 걸리면 기다리기를 그만둠
   ・2절: 책상 · 장신구 GLB 받기는 웹 캐시를 거치지 않는다(fetch cache: 'no-store') — firebase-init.js 의 함수를 떼어 돌린다
   ・3절: 배선 — main.js 가 창을 띄우기 전에 부른다 · 설치 목록(package.json files)
   ・4절: 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', '..', 'app', path.join('app', 'parts'), 'parts', path.join('..', 'apps', 'desktop'), path.join('..', 'apps', 'desktop', 'app', 'parts')];
const find = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const read = (f) => { const p = find(f); return p ? fs.readFileSync(p, 'utf8') : null; };
const MODP = find('http-cache-reset.js'), MOD = read('http-cache-reset.js'), MAIN = read('main.js'), FB = read('firebase-init.js'), PKG = read('package.json');
for(const [n, v] of [['http-cache-reset.js', MOD], ['main.js', MAIN], ['firebase-init.js', FB], ['package.json', PKG]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const load = (src) => { const m = { exports: {} }; new Function('module', 'require', src)(m, require); return m.exports; };

/* 가짜 fs · session — 표시 파일과 비우기 호출을 센다 */
function rig(o){
  const files = Object.assign({}, o.files || {});
  const fsx = { readFileSync: (f) => { if(!(f in files)) throw new Error('ENOENT'); return files[f]; }, writeFileSync: (f, v) => { files[f] = String(v); } };
  const s = { cleared: 0, clearCache(){ this.cleared++; return o.clear ? o.clear() : Promise.resolve(); } };
  const logs = [];
  return { files, fsx, s, logs };
}
async function behave(src){
  const M = load(src), r = {};
  const mk = (R, version, waitMs) => M.createHttpCacheReset({ fs: R.fsx, path, dir: '/ud', version, session: R.s, log: (m) => R.logs.push(m), waitMs });
  const F = path.join('/ud', M.MARK);
  let R = rig({});
  r.first = (await mk(R, '0.13.0').run()) === true && R.s.cleared === 1 && R.files[F] === '0.13.0' && /0\.13\.0/.test(R.logs.join());
  r.same = (await mk(R, '0.13.0').run()) === false && R.s.cleared === 1;
  r.bump = (await mk(R, '0.13.1').run()) === true && R.s.cleared === 2 && R.files[F] === '0.13.1';
  R = rig({ files: { [F]: '0.13.0\n' } });
  r.trim = mk(R, '0.13.0').needed() === false;
  r.noVer = mk(rig({}), '').needed() === false;
  R = rig({ clear: () => Promise.reject(new Error('busy')) });
  r.fail = (await mk(R, '0.13.0').run()) === 'fail' && !(F in R.files) && mk(R, '0.13.0').needed() === true;
  R = rig({ clear: () => new Promise(() => {}) });
  const t0 = Date.now();
  r.timeout = (await mk(R, '0.13.0', 30).run()) === 'timeout' && Date.now() - t0 < 1000 && !(F in R.files);
  return r;
}
/* firebase-init.js 의 fetchCatalogGlb 를 떼어 가짜 fetch 로 돌린다 */
function fetchGlbOf(src){
  const i = src.indexOf('async fetchCatalogGlb(url){');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) break; }
  const body = src.slice(i, j + 1);
  return (fetchFn) => new Function('fetch', 'btoa', 'return {' + body + '};')(fetchFn, (s) => Buffer.from(s, 'binary').toString('base64'));
}
async function glbFetch(src){
  const mk = fetchGlbOf(src); if(!mk) return null;
  const calls = [];
  const api = mk(async (u, opt) => { calls.push([u, opt]); return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([103, 108, 84, 70]).buffer }; });
  const b64 = await api.fetchCatalogGlb('https://x/o/a.glb?alt=media');
  return { b64, calls };
}

(async () => {
  say('── 1. 버전이 바뀐 뒤 첫 실행에만 웹 캐시 비우기');
  const b = await behave(MOD);
  chk(b.first, '★ 처음(표시 없음) — 비우고 지금 버전을 표시 파일에 적는다 · 기록 한 줄');
  chk(b.same, '★ 같은 버전으로 다시 켜면 안 비운다(실행마다 그림을 다시 받지 않게)');
  chk(b.bump, '  업데이트하면 한 번 더 비운다');
  chk(b.trim && b.noVer, '  표시 파일의 줄바꿈은 무시 · 버전을 모르면 안 비운다');
  chk(b.fail, '  못 비우면 표시를 안 남긴다 — 다음 실행에 다시 해 본다');
  chk(b.timeout, '  오래 걸리면 기다리기를 그만둔다(창 띄우기를 붙잡지 않음)');

  say('── 2. 책상 · 장신구 GLB 받기는 웹 캐시를 거치지 않는다');
  const g = await glbFetch(FB);
  chk(!!g && g.calls.length === 1 && g.calls[0][1] && g.calls[0][1].cache === 'no-store', "★ fetchCatalogGlb 가 fetch(url, { cache: 'no-store' }) 로 받는다");
  chk(!!g && g.b64 === 'Z2xURg==', '  받은 바이트는 예전처럼 base64 로 돌려준다');

  say('── 3. 배선');
  const iRun = MAIN.indexOf('createHttpCacheReset({'), iWin = MAIN.indexOf('createWindow();', MAIN.indexOf('app.whenReady().then('));
  chk(/require\('\.\/http-cache-reset'\)/.test(MAIN) && iRun > 0 && iWin > iRun && /await createHttpCacheReset\(\{[^\n]*session: session\.defaultSession[^\n]*\}\)\.run\(\);/.test(MAIN), 'main.js — 창을 띄우기 전에 기다려 부른다(기본 세션 · userData · 앱 버전)');
  chk(/"http-cache-reset\.js"/.test(PKG), '설치 목록(package.json files)에 http-cache-reset.js — 빠지면 설치본이 켜지지 않는다');

  say('── 4. 깨 보기');
  const b1 = await behave(MOD.replace('return !!o.version && lastVersion() !== String(o.version);', 'return !!o.version;'));
  chk(!b1.same, '같은 버전도 비우면 위 «같은 버전이면 안 비운다» 가 빨강');
  const b2 = await behave(MOD.replace("    await o.session.clearCache();\n    try{ o.fs.writeFileSync(file, String(o.version)); }catch(_){}", "    try{ o.fs.writeFileSync(file, String(o.version)); }catch(_){}\n    await o.session.clearCache();"));
  chk(!b2.fail, '비우기 전에 표시를 남기면 위 «못 비우면 표시를 안 남긴다» 가 빨강');
  const g2 = await glbFetch(FB.replace("await fetch(url, { cache: 'no-store' })", 'await fetch(url)'));
  chk(!!g2 && !(g2.calls[0][1] && g2.calls[0][1].cache === 'no-store'), "fetch 에서 cache: 'no-store' 를 빼면 위 2절이 빨강");

  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { chk(false, '던짐 — ' + (e && e.stack || e)); process.exit(1); });
