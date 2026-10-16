/* ═══ 🔌 sim-catalog-source.js — 카탈로그 데이터 provider (2026-10-17 신설 · 구역 떼기 C · w2 · 서버 이관) ═══════════════
   카탈로그 도메인(catalog-sync · catalog-glb · admin-thumbs)이 firebaseAPI 를 직접 부르지 않고 character/catalog-source.js 를 거친다.
   지금은 Firebase 판(옛 길) 하나 — 서버 API 판이 생기면 app.js 의 고르는 줄만 바꾼다.
   ・1절: 모양 — 만들 때 던지지 않음 · 내놓는 이름 · 전역 이름
   ・2절: 연결 — app.js 가 세 모듈보다 먼저 한 줄로 고르고 deps 로 넘긴다 · 세 모듈에 firebaseAPI 직접 호출 0 · html(app.js 앞)
   ・3절: 동작 — 가짜 window 위에서 연결 기다리기 · 할 수 있는지 · 넘기기(인자 · 돌려받는 값) · firebaseAPI 를 부를 때마다 읽기
   [실행] app.js · desk-companion-prototype.html · catalog-source.js · 세 모듈이 있는 폴더에서(러너 스테이징). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const find = (rel) => [rel.split('/').pop(), 'parts/' + rel, 'app/parts/' + rel].map(read).find(Boolean);
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html'), MOD = find('character/catalog-source.js');
const USERS = { 'catalog-sync.js': find('character/catalog-sync.js'), 'catalog-glb.js': find('character/catalog-glb.js'), 'admin-thumbs.js': find('admin/admin-thumbs.js') };
if(!SRC || !HTML || !MOD || Object.values(USERS).some(v => !v)){ say('  ? 원본 못 찾음 — app.js · html · catalog-source.js · 세 모듈'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const EXPORTS = ['catalogSrcReady', 'catalogSrcCan', 'catalogSrcSubscribe', 'catalogSrcMigrateGacha', 'catalogSrcFetchGlb', 'catalogSrcPublishPart'];
const make = (win) => { new Function('window', 'module', MOD)(win, undefined); return win.TwCatalogSource.createCatalogSource({}); };

say('── 1. 모양');
{
  let api = null, err = null;
  try{ api = make({ addEventListener(){} }); }catch(e){ err = e; }
  chk(!err && api, '만들 때 던지지 않는다(연결이 없어도)');
  chk(api && EXPORTS.every(n => typeof api[n] === 'function') && Object.keys(api).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개 — ' + EXPORTS.join(' · '));
  chk(/window\.TwCatalogSource = api;/.test(MOD) && /module\.exports = api;/.test(MOD), '전역 이름 TwCatalogSource(Tw 접두사)');
}

say('── 2. 연결');
{
  const A = strip(SRC);
  const at = (s) => A.indexOf(s);
  const iSrc = at('const catalogSourceMod = TwCatalogSource.createCatalogSource({');
  const users = [['adminThumbs = TwAdminThumbs.createAdminThumbs({', 'admin-thumbs.js'], ['catalogGlbMod = TwCatalogGlb.createCatalogGlb({', 'catalog-glb.js'], ['catalogSyncMod = TwCatalogSync.createCatalogSync({', 'catalog-sync.js']];
  chk(iSrc > 0 && (A.match(/TwCatalogSource\.createCatalogSource\(/g) || []).length === 1, 'app.js 가 provider 를 한 줄로 한 번 고른다');
  chk(users.every(([mk]) => { const i = at(mk); const body = A.slice(i, A.indexOf('});', i)); return i > iSrc && /\n  catalogSourceMod: catalogSourceMod,/.test(body); }), '  세 모듈(admin-thumbs · catalog-glb · catalog-sync)보다 먼저 만들고 deps 로 넘긴다');
  const direct = Object.entries(USERS).filter(([, src]) => /firebaseAPI\s*[.&)]|firebaseAPI\[/.test(strip(src))).map(([f]) => f);
  chk(!direct.length, '세 모듈에 firebaseAPI 직접 호출이 없다(provider 를 거친다)' + (direct.length ? ' — ' + direct.join(' · ') : ''));
  const iS = HTML.indexOf('<script src="parts/character/catalog-source.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iS > 0 && iS < iA, 'html 이 catalog-source.js 를 app.js 앞에 싣는다');
}

say('── 3. 동작 — 가짜 window 위의 Firebase 판');
{
  const mkWin = (fb) => { const ls = []; return { firebaseAPI: fb, ls, addEventListener: (ev, fn, opt) => ls.push([ev, fn, opt]) }; };
  /* 연결 기다리기 */
  let w = mkWin({}), S = make(w), ran = 0;
  S.catalogSrcReady(() => ran++);
  chk(ran === 1 && !w.ls.length, 'catalogSrcReady — 연결이 있으면 바로 부른다');
  w = mkWin(undefined); S = make(w); ran = 0;
  S.catalogSrcReady(() => ran++); S.catalogSrcReady(() => ran++);
  chk(ran === 0 && w.ls.length === 2 && w.ls.every(l => l[0] === 'firebase-ready' && l[2] && l[2].once === true), '  없으면 부를 때마다 firebase-ready 를 한 번만(once) 기다린다');
  w.ls.forEach(l => l[1]());
  chk(ran === 2, '  firebase-ready 가 오면 그때 부른다');
  /* 할 수 있는지 */
  const OPS = { items: 'subscribeCatalogItems', desks: 'subscribeCatalogDesks', parts: 'subscribeCatalogParts', customCats: 'subscribeCustomCats', catOverrides: 'subscribeCatOverrides', migrateGacha: 'migrateGachaCatalog', fetchGlb: 'fetchCatalogGlb', publishPart: 'publishPart' };
  const full = {}; Object.values(OPS).forEach(n => { full[n] = () => {}; });
  S = make(mkWin(full));
  chk(Object.keys(OPS).every(op => S.catalogSrcCan(op) === true), 'catalogSrcCan — 여덟 가지 일 모두 Firebase 판 함수에 잇는다');
  chk(S.catalogSrcCan('nope') === false && make(mkWin(undefined)).catalogSrcCan('items') === false && make(mkWin({ subscribeCatalogItems: () => {} })).catalogSrcCan('desks') === false, '  경계 — 모르는 일 · 연결 없음 · 그 함수만 없음은 false');
  /* 넘기기 */
  const log = [];
  const fb = {};
  Object.entries(OPS).forEach(([op, n]) => { fb[n] = (...a) => { log.push([n, ...a]); return 'ret:' + op; }; });
  w = mkWin(fb); S = make(w);
  const cb = () => {};
  const rs = ['items', 'desks', 'parts', 'customCats', 'catOverrides'].map(k => S.catalogSrcSubscribe(k, cb));
  chk(log.slice(0, 5).map(l => l[0]).join() === 'subscribeCatalogItems,subscribeCatalogDesks,subscribeCatalogParts,subscribeCustomCats,subscribeCatOverrides' && log.slice(0, 5).every(l => l[1] === cb && l.length === 2) && rs[0] === 'ret:items', 'catalogSrcSubscribe — 종류별 구독에 콜백을 그대로 넘기고 돌려받는 값도 그대로');
  chk(S.catalogSrcMigrateGacha() === 'ret:migrateGacha' && S.catalogSrcFetchGlb('u') === 'ret:fetchGlb' && S.catalogSrcPublishPart('id', { a: 1 }) === 'ret:publishPart'
      && log[5].length === 1 && log[6][1] === 'u' && log[7][1] === 'id' && log[7][2].a === 1, '  가챠 옮기기 · GLB 받기 · 파츠 올리기 — 인자 · 돌려받는 값(약속) 그대로');
  /* 부를 때마다 읽기 */
  w = mkWin(undefined); S = make(w);
  w.firebaseAPI = { fetchCatalogGlb: (u) => 'late:' + u };
  chk(S.catalogSrcCan('fetchGlb') && S.catalogSrcFetchGlb('x') === 'late:x', '  firebaseAPI 는 부를 때마다 읽는다 — 만든 뒤에 생겨도 쓴다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
