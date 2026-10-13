/* ═══ 🧹 sim-admin-console.js — 관리자 콘솔 도구 모듈 (2026-10-14 신설 · 관리자 코드 admin 폴더 2번) ═══════════════
   app.js 의 «🧹 관리자 콘솔 도구» 구역을 parts/admin/admin-console.js 로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 만들 때 — window 에 콘솔 함수 일곱을 건다 · 빈 객체를 돌려준다 · 서버는 안 부른다
   ・2절: 미리보기 / 실행 갈래 — 정리(true/false) · 유령 방(!apply) · 초대권 회수(날짜 · 장수 · 미리보기 · 음수 허용) · 진단
   ・3절: 이관 두 가지 — 카탈로그 목록을 읽는 함수로 받아 **다시 대입된 뒤의 목록**을 쓴다 · 이미 옮긴 것은 건너뜀
   ・4절: app.js 연결 — 본문이 안 남음 · 빈 껍데기 · 원래 자리 · deps 셋(읽는 함수) · html 순서 · Tw 접두사
   ・5절: 일부러 깨 보기 — 모듈 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · admin-console.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ['admin-console.js', 'parts/admin/admin-console.js', 'app/parts/admin/admin-console.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — admin-console.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const NAMES = ['previewCatalogCleanup', 'runCatalogCleanup', 'migrateCatalogGlbToStorage', 'analyzeCatalog', 'cleanupGhostRooms', 'reclaimInvitesSince', 'migrateCatalogThumbsToStorage'];

/* 모듈을 가짜 전역 위에서 만든다 — calls 에 서버 호출을 적는다 */
function build(src, lists){
  const calls = [];
  const rec = (name, ret) => async (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  const fb = {
    cleanupCatalogBase64: rec('cleanupCatalogBase64', { willDelete: 2, mb: 1, skipNoUrl: 0, alreadyClean: 3, byKind: {} }),
    analyzeCatalog: rec('analyzeCatalog', { parts: { count: 1, totalKB: 5, base64Fields: 0, top: [] } }),
    cleanupGhostRooms: rec('cleanupGhostRooms', (dry) => dry ? { ok: true, dryRun: true, count: 0, ghosts: [] } : { ok: true, removed: 0, failed: 0 }),
    reclaimInvitesSince: rec('reclaimInvitesSince', (t, n, dry) => dry ? { ok: true, count: 0, targets: [] } : { ok: true, changed: 0, failed: 0 }),
    publishPart: rec('publishPart', undefined), publishDesk: rec('publishDesk', undefined), publishItem: rec('publishItem', undefined),
  };
  const win = { firebaseAPI: fb };
  const quiet = { log(){}, warn(){} };
  const api = new Function('window', 'firebaseAPI', 'console', 'module', src + '\nreturn window.TwAdminConsole;')(win, fb, quiet, undefined);
  const out = api.createAdminConsole({ savedParts: () => lists.parts, savedDesks: () => lists.desks, savedItems: () => lists.items });
  return { win, calls, out };
}

function judge(src, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 1절 */
  let B = null;
  try{ B = build(src, { parts: [], desks: [], items: [] }); }catch(_){ B = null; }
  t(B && NAMES.every(n => typeof B.win[n] === 'function'), '만들 때 window 에 콘솔 함수 일곱을 건다');
  t(B && B.out && typeof B.out === 'object' && !Object.keys(B.out).length, '만들면 빈 객체(밖에서 부르는 이름은 window 쪽)');
  t(B && B.calls.length === 0, '만들 때는 서버를 안 부른다 — 콘솔에서 부를 때만');
  return { r, B };
}

async function judgeRun(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  /* 2절 */
  const lists = { parts: [], desks: [], items: [] };
  let B; try{ B = build(src, lists); }catch(_){ t(false, '모듈을 만들 수 없다'); return r; }
  const w = B.win, last = () => B.calls[B.calls.length - 1] || [];
  try{
    await w.previewCatalogCleanup(); t(last()[0] === 'cleanupCatalogBase64' && last()[1] === true, '정리 미리보기 = cleanupCatalogBase64(true) — 지우지 않는다');
    await w.runCatalogCleanup(); t(last()[0] === 'cleanupCatalogBase64' && last()[1] === false, '정리 실행 = cleanupCatalogBase64(false)');
    await w.cleanupGhostRooms(); t(last()[0] === 'cleanupGhostRooms' && last()[1] === true, '유령 방 — 인자 없으면 미리보기(dry=true)');
    await w.cleanupGhostRooms(true); t(last()[0] === 'cleanupGhostRooms' && last()[1] === false, '유령 방 — cleanupGhostRooms(true) 만 실제 삭제');
    await w.reclaimInvitesSince('2026-07-18');
    const c = last();
    t(c[0] === 'reclaimInvitesSince' && c[1] === new Date('2026-07-18T00:00:00').getTime() && c[2] === 2 && c[3] === true && c[4] === false,
      '초대권 회수 — 날짜는 그 날 00:00(현지) · 기본 2장 · 기본은 미리보기 · 음수 허용 꺼짐');
    await w.reclaimInvitesSince('2026-07-18', 1, true, true);
    const d = last(); t(d[2] === 1 && d[3] === false && d[4] === true, '초대권 회수 — 장수 · 실행 · 음수 허용을 그대로 넘긴다');
    const n0 = B.calls.length; const bad = await w.reclaimInvitesSince('어제');
    t(bad === null && B.calls.length === n0, '날짜가 틀리면 서버를 안 부른다');
    const a = await w.analyzeCatalog(); t(last()[0] === 'analyzeCatalog' && a && a.parts, '진단 — analyzeCatalog 결과를 돌려준다');
  }catch(e){ t(false, '갈래를 굴리다 던짐 — ' + (e && e.message)); }
  /* 3절 */
  try{
    lists.parts = [{ id: 'p1', fromCatalog: true, glb: 'AAA' }, { id: 'p2', fromCatalog: true, glbUrl: 'u' }, { id: 'p3', glb: 'BBB' }];
    lists.desks = [{ id: 'd1', fromCatalog: true, glb: 'CCC' }];
    lists.items = [];
    const n0 = B.calls.length;
    const res = await w.migrateCatalogGlbToStorage();
    const pub = B.calls.slice(n0);
    t(res.parts === 1 && res.desks === 1 && res.skipped === 1 && pub.length === 2, 'GLB 이관 — 지금 목록(다시 대입된 뒤)을 읽는다 · 이미 Storage 인 것과 로컬 것은 건너뜀');
    t(pub[0][0] === 'publishPart' && pub[0][1] === 'p1' && !('id' in pub[0][2]) && !('fromCatalog' in pub[0][2]), 'GLB 이관 — publishXxx(id, 데이터) · id · fromCatalog 는 빼고 넘긴다');
    lists.parts = [{ id: 'p9', fromCatalog: true, thumbnail: 'data:image/png;base64,x' }, { id: 'p8', fromCatalog: true, thumbUrl: 'u' }];
    lists.desks = []; lists.items = [{ id: 'i1', fromCatalog: true, thumbnail: 'https://x' }];
    const n1 = B.calls.length;
    const res2 = await w.migrateCatalogThumbsToStorage();
    t(res2.parts === 1 && res2.skipped === 2 && B.calls.length - n1 === 1 && B.calls[n1][1] === 'p9', '썸네일 이관 — data: 썸네일만 · 이미 thumbUrl 이거나 data: 가 아니면 건너뜀');
  }catch(e){ t(false, '이관을 굴리다 던짐 — ' + (e && e.message)); }
  return r;
}

function judgeWire(src, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!NAMES.some(n => A.includes('window.' + n + ' =')), 'app.js 에 옮긴 콘솔 함수가 남지 않았다');
  t(/const ADMIN_CONSOLE_OFF = \{\};/.test(app), '모듈이 없으면 빈 껍데기 — app.js 만 굴리는 검사가 서지 않는다');
  const mk = (app.match(/const adminConsole = \(typeof TwAdminConsole === 'undefined'\) \? ADMIN_CONSOLE_OFF : TwAdminConsole\.createAdminConsole\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = mk.split('\n').map(l => l.trim()).filter(Boolean);
  t(deps.length === 3 && ['savedParts', 'savedDesks', 'savedItems'].every(n => deps.includes(n + ': ()=>' + n + ',')), 'deps 셋 — 카탈로그 목록을 읽는 함수로(다시 대입되는 let)');
  const h = app.indexOf('/* ═══ 🧹 관리자 콘솔 도구'), m = app.indexOf('const adminConsole ='), n = app.indexOf('/* ═══ 🔄 카탈로그 실시간 동기화');
  t(h > 0 && m > h && n > m, '만드는 줄은 원래 자리(🧹 관리자 콘솔 도구 머리 아래)');
  t(/window\.TwAdminConsole = api;/.test(src) && /module\.exports = api;/.test(src), '전역 이름 TwAdminConsole(Tw 접두사)');
  const iM = html.indexOf('<script src="parts/admin/admin-console.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — admin/admin-console.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const show = (rows) => rows.forEach(([ok, msg]) => chk(ok, msg));
  say('── 1. 만들 때');
  show(judge(MOD, SRC, HTML).r);
  say('── 2 · 3. 미리보기 / 실행 · 이관');
  show(await judgeRun(MOD));
  say('── 4. app.js 연결');
  show(judgeWire(MOD, SRC, HTML));

  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const all = async (src, app, html) => [...judge(src, app, html).r, ...(await judgeRun(src)), ...judgeWire(src, app, html)];
  const breaks = [
    ['정리 미리보기가 실제로 지움', s => s.replace('cleanupCatalogBase64(true)', 'cleanupCatalogBase64(false)'), null, null],
    ['유령 방 갈래 뒤집음', s => s.replace('cleanupGhostRooms(!apply)', 'cleanupGhostRooms(!!apply)'), null, null],
    ['초대권 기본을 실행으로', s => s.replace('const dry = !apply;', 'const dry = false;'), null, null],
    ['목록을 값으로 붙잡음', s => s.replace("const savedParts = deps.savedParts;", "const savedParts = (()=>{ const v = deps.savedParts(); return ()=>v; })();"), null, null],
    ['콘솔 함수 하나 안 걺', s => s.replace('window.analyzeCatalog = async function', 'const _x = async function'), null, null],
    ['이미 옮긴 것도 다시 올림', s => s.replace('if(rec.glbUrl && !rec.glb){ results.skipped++; continue; }', ''), null, null],
    ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/admin/admin-console.js"></script>', '')],
    ['app.js 에 본문이 남음', null, a => a + '\nwindow.analyzeCatalog = async function(){};', null],
    ['deps 하나 빠짐', null, a => a.replace('  savedItems: ()=>savedItems,\n', ''), null],
  ];
  for(const [name, fm, fa, fh] of breaks){
    const s = fm ? fm(MOD) : MOD, a = fa ? fa(SRC) : SRC, h = fh ? fh(HTML) : HTML;
    const changed = s !== MOD || a !== SRC || h !== HTML;
    const rows = await all(s, a, h);
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
