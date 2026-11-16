/* ═══ 🛠️ sim-catalog-admin-api.js — 앱 관리자 카탈로그 쓰기 서버 길(admin/catalog-admin-api.js · D11-4) ═══════════
   [왜] 파츠 · 책상 · 소품 등록 · 진열 순서 · 카테고리 · 게임 설정이 Firebase 로 쓰이던 것을 서버 /v2/admin/catalog/* 로 옮겼다. 서버가 «어느 칸이 왜» 로 거절하니
     이 검사는 요청 모양(길 · 메서드 · 본문 · version) · 쓰는 차례(파일 → 물건) · 쓴 뒤 다시 받기 · 실패 알림을 가짜 통로 위에서 굴려 지킨다.
   1. 길 · 칸 — 서버 정본의 길 · 본문 칸(PART · DESK · PROP_FIELDS) · 진열 권한 규칙
   2. 파츠 · 책상 · 소품 쓰기 — 만들기(version 없음) · 고치기(지금 version) · 파일 올리기가 먼저 · 올리기 실패면 쓰지 않음 · 쓴 뒤 한 번 다시 받기(quiet 은 안 받음)
   3. 단종 · 진열 순서 — 일괄 단종 길(줄 ok 아니면 code 로 던짐) · 진열대 version(줄 없으면 0) · 순서 전체
   4. 카테고리 · 해금 — 만들기 · 이름 고치기 · 원래대로 · 지우기(?version=) · 해금 만들기 / 고치기
   5. 실패 알림 — 파일 올리기 실패 E-ADM-06 · 판이 달라지면 다시 받고 «받아왔어요» · 그 밖은 쓰던 자리 번호
   6. 일부러 깨 보기
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts'), path.join('parts', 'admin'), path.join('app', 'parts', 'admin'), '..', path.join('..', 'apps', 'desktop', 'app', 'parts', 'admin')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const SRC = read('catalog-admin-api.js'), AAPI = read('admin-api.js');
if(!SRC || !AAPI){ say('  ? 원본 못 찾음 — catalog-admin-api.js · admin-api.js'); process.exit(2); }
const load = (src) => { const m = { exports: {} }; new Function('window', 'module', src)({}, m); return m.exports; };
const H = (c) => c.repeat(64);

/* 가짜 통로 — 부른 것을 차례로 적는다 */
function world(src, o){
  o = o || {};
  const log = [];
  const raw = o.raw === undefined ? {
    parts: [{ partId: 'p1', version: 3 }], desks: [{ deskId: 'd1', version: 2 }], deskProps: [{ deskPropId: 'i1', version: 4 }],
    categories: [{ code: 'cape', version: 6 }, { code: 'scarf', version: 1 }], shelves: [{ scope: 'CATEGORY:hat', order: ['a'], version: 9 }],
    unlocks: [{ kind: 'ANIMAL_CHARACTER', key: 'animal', level: 50, label: '동물 캐릭터', version: 7 }],
  } : o.raw;
  const call = (m) => async (p, b, opt) => {
    log.push([m, p, b, opt]);
    if(o.failAt && o.failAt(m, p)) throw Object.assign(new Error('x'), { code: o.failCode || 'CATALOG_INVALID_FILE', kind: 'request' });
    if(p.endsWith('/assets')) return { hash: H(String(++world.n % 10)) };
    if(p.endsWith('/listings/bulk')) return o.bulk || [{ kind: b.items[0].kind, id: b.items[0].id, ok: true }];
    return {};
  };
  const authed = { get: call('GET'), post: call('POST'), put: call('PUT'), patch: call('PATCH'), del: call('DELETE') };
  const shown = [];
  const catalog = { current: () => raw, load: async () => { log.push(['LOAD']); } };
  const adminApi = { notifyFail: (e, errs, onSite) => { const k = o.kind || 'site'; if(k === 'site') onSite(); return k; } };
  const imageBytes = { parseDataUrl: (u) => u === 'data:image/png;base64,QUJD' ? { type: 'image/png', bytes: new Uint8Array([65, 66, 67]) } : null };
  const api = load(src).createCatalogAdminApi({ imageBytes, authed, catalog, adminApi, apiErrors: {}, notifyError: (c, e) => shown.push([c, e && e.code]), toast: (m) => shown.push(['toast', m]) });
  return { api, log, shown };
}
world.n = 0;
const names = (w) => w.log.map((l) => l[0] + (l[1] ? ' ' + l[1] : '')).join(' | ');
const FILE = new Uint8Array([1, 2, 3]);
const PF = { name: '모자', icon: '🎩', category: 'hat', glow: false, multi: false, standalone: false, stackable: false, rideTop: false, animMode: '', charType: 'default', hides: [] };

(async () => {
  const M = load(SRC);
  say('── 1. 길 · 칸');
  chk(M.PATHS.part('a b') === '/v2/admin/catalog/parts/a%20b' && M.PATHS.deskProp('i') === '/v2/admin/catalog/desk-props/i' && M.PATHS.unlock('ANIMAL_CHARACTER', 'animal') === '/v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal'
    && M.PATHS.assets === '/v2/admin/catalog/assets' && M.PATHS.bulk === '/v2/admin/catalog/listings/bulk' && M.PATHS.shelf('CATEGORY:hat') === '/v2/admin/catalog/shelves/CATEGORY%3Ahat', '길 — 서버 컨트롤러의 길(경로 값은 인코딩)');
  chk(M.DESK_FIELDS.join() === 'version,name,icon,model,thumb,play,listing' && M.PROP_FIELDS.join() === 'version,name,icon,model,thumb,play,listing,attachTo,defaultSize', '책상 · 소품 본문 칸 — 서버 DESK_FIELDS · PROP_FIELDS 와 같다');
  const ent = { kind: 'entitlement', key: 'premium', display: 'hide' }, sign = { kind: 'signedIn' };
  chk(M.accessOf(undefined, ent) === ent && M.accessOf(true, ent) === ent && M.accessOf(false, sign) === sign && M.accessOf(false, ent).kind === 'everyone' && M.accessOf(true, sign).kind === 'entitlement' && M.accessOf(true, undefined).key === 'premium' && M.accessOf(false, undefined).kind === 'everyone',
    '진열 권한 — 입력이 서버 값과 같은 뜻이면 서버 값을 그대로(앱이 모르는 종류 · 숨김 표시 보존) · 다르면 전용(premium) / 모두');
  const d = M.deskBody({ name: 'd', icon: '', modelHash: H('a'), playMode: 'auto', glow: true, licenseOnly: true });
  chk(d.play.playMode === 'auto' && d.play.autoPlay === true && d.play.glow === true && d.listing.access.kind === 'entitlement' && d.listing.acquisition.kind === 'GIVEN' && !('thumb' in d) && !('attachTo' in d), '책상 본문 — autoPlay 는 playMode 에서 · 전용이면 entitlement · 얻는 법은 늘 GIVEN');
  const pr = M.propBody({ name: 'p', modelHash: H('a'), playMode: 'click', attachTo: 'handL', defaultSize: 0.5, thumbHash: H('b') });
  chk(pr.attachTo === 'handL' && pr.defaultSize === 0.5 && pr.thumb === H('b') && pr.play.autoPlay === false, '소품 본문 — attachTo · defaultSize · 있는 썸네일 해시');

  say('── 2. 파츠 · 책상 · 소품 쓰기');
  let w = world(SRC);
  await w.api.savePart('pNew', Object.assign({ glb: FILE, thumbPng: FILE }, PF), { create: true });
  const seq = w.log.map((l) => l[0] + ' ' + (l[1] || ''));
  chk(seq.join('|') === 'POST /v2/admin/catalog/assets|POST /v2/admin/catalog/assets|PUT /v2/admin/catalog/parts/pNew|LOAD ', '★ 만들기 — 파일(GLB · 썸네일)을 먼저 올리고 → 물건 PUT → 서버 한 벌 한 번 다시 받기');
  chk(w.log[0][3].rawType === 'model/gltf-binary' && w.log[0][2] === FILE && w.log[1][3].rawType === 'image/png', '  ↳ 파일은 바이트 그대로 · GLB · PNG 종류를 Content-Type 으로');
  const put = w.log[2][2];
  chk(!('version' in put) && put.model === H('1') && put.thumb === H('2') && put.category === 'hat' && put.listing.state === 'ACTIVE', '  ↳ 만들기 본문은 version 이 없다 · 올린 해시가 model · thumb 으로 · 곧바로 ACTIVE');
  w = world(SRC); await w.api.savePart('p1', Object.assign({ modelHash: H('c'), thumbHash: H('d') }, PF));
  chk(names(w) === 'PUT /v2/admin/catalog/parts/p1 | LOAD' && w.log[0][2].version === 3 && w.log[0][2].model === H('c') && w.log[0][2].thumb === H('d'), '★ 고치기 — 파일을 안 바꾸면 올리지 않고 해시를 그대로 · 마지막으로 받은 한 벌의 version(3)을 싣는다');
  w = world(SRC); await w.api.savePart('p1', Object.assign({ modelHash: H('c'), thumbDataUrl: 'data:image/png;base64,QUJD' }, PF), { quiet: true });
  chk(names(w) === 'POST /v2/admin/catalog/assets | PUT /v2/admin/catalog/parts/p1' && w.log[0][3].rawType === 'image/png' && Array.from(w.log[0][2]).join() === '65,66,67' && /^[0-9a-f]{64}$/.test(w.log[1][2].thumb), '구운 썸네일(data:image/png 글)은 풀어 PNG 로 올리고 해시를 싣는다(deps.imageBytes)');
  w = world(SRC); let ep = null; try{ await w.api.savePart('p1', Object.assign({ modelHash: H('c'), thumbDataUrl: 'data:broken' }, PF)); }catch(e){ ep = e; }
  chk(ep && ep.stage === 'asset' && ep.code === 'SHAPE' && !w.log.length, '  풀 수 없는 그림이면 물건도 쓰지 않고 던진다(조용히 빼지 않는다)');
  w = world(SRC); await w.api.savePart('p1', Object.assign({ modelHash: H('c') }, PF), { quiet: true });
  chk(names(w) === 'PUT /v2/admin/catalog/parts/p1', '  quiet 이면 다시 받지 않는다(여럿을 이어 쓸 때 — 끝에서 reload)');
  w = world(SRC, { failAt: (m, p) => p.endsWith('/assets') });
  let e1 = null; try{ await w.api.savePart('pNew', Object.assign({ glb: FILE }, PF), { create: true }); }catch(e){ e1 = e; }
  chk(e1 && e1.stage === 'asset' && e1.code === 'CATALOG_INVALID_FILE' && !w.log.some((l) => l[0] === 'PUT') && !w.log.some((l) => l[0] === 'LOAD'), '★ 파일을 못 올리면 물건은 쓰지 않는다(던진 오류에 stage:asset)');
  w = world(SRC); let e2 = null; try{ await w.api.savePart('없는id', Object.assign({ modelHash: H('c') }, PF)); }catch(e){ e2 = e; }
  chk(e2 && e2.code === 'CATALOG_ITEM_NOT_FOUND' && !w.log.length, '고칠 줄이 마지막 한 벌에 없으면 서버를 부르지 않고 «없는 물건» 으로 끝낸다');
  w = world(SRC, { raw: null }); let e3 = null; try{ await w.api.savePart('p1', Object.assign({ modelHash: H('c') }, PF)); }catch(e){ e3 = e; }
  chk(e3 && e3.code === 'CATALOG_NOT_LOADED' && !w.log.length, '한 벌을 아직 못 받았으면 서버를 부르지 않고 던진다(version 을 짐작하지 않는다)');
  w = world(SRC); await w.api.saveDesk('d1', { name: '책상', modelHash: H('c'), playMode: 'click' }); await w.api.saveDeskProp('i1', { name: '소품', modelHash: H('c'), playMode: 'idle', attachTo: 'desk', defaultSize: 0.8 }); await w.api.saveDesk('dNew', { name: '새', glb: FILE, playMode: 'click' }, { create: true });
  const puts = w.log.filter((l) => l[0] === 'PUT');
  chk(puts[0][1] === '/v2/admin/catalog/desks/d1' && puts[0][2].version === 2 && puts[1][1] === '/v2/admin/catalog/desk-props/i1' && puts[1][2].version === 4 && !('version' in puts[2][2]), '책상 · 소품 — 각자 길 · 지금 version · 만들기는 version 없음');

  say('── 3. 단종 · 진열 순서');
  w = world(SRC); await w.api.archive('part', 'p1');
  chk(names(w) === 'POST /v2/admin/catalog/listings/bulk | LOAD' && JSON.stringify(w.log[0][2]) === '{"action":"ARCHIVE","items":[{"kind":"part","id":"p1","version":3}]}', '★ 단종 — 일괄 단종 길에 물건 하나(종류 · id · 지금 version)');
  w = world(SRC); await w.api.archive('deskProp', 'i1'); await w.api.archive('desk', 'd1');
  chk(w.log.filter((l) => l[0] === 'POST').map((l) => l[2].items[0].kind + l[2].items[0].version).join() === 'deskProp4,desk2', '  소품 · 책상도 같은 길(종류 이름은 서버 응답의 이름)');
  w = world(SRC, { bulk: [{ kind: 'part', id: 'p1', ok: false, code: 'CONCURRENT_UPDATE' }] }); let e4 = null; try{ await w.api.archive('part', 'p1'); }catch(e){ e4 = e; }
  chk(e4 && e4.code === 'CONCURRENT_UPDATE' && !w.log.some((l) => l[0] === 'LOAD'), '줄이 ok 가 아니면 그 code 로 던진다(다시 받기는 알림 쪽 몫)');
  w = world(SRC); let e5 = null; try{ await w.api.archive('product', 'x'); }catch(e){ e5 = e; }
  chk(e5 && e5.code === 'INVALID_REQUEST' && !w.log.length, '앱이 다루지 않는 종류는 서버를 부르지 않는다');
  w = world(SRC); await w.api.saveShelf('CATEGORY:hat', ['b', 'a']); await w.api.saveShelf('DESK', ['x']);
  const sh = w.log.filter((l) => l[0] === 'PUT');
  chk(sh[0][1] === '/v2/admin/catalog/shelves/CATEGORY%3Ahat' && JSON.stringify(sh[0][2]) === '{"version":9,"order":["b","a"]}' && JSON.stringify(sh[1][2]) === '{"version":0,"order":["x"]}',
    '★ 진열 순서 — 순서 전체를 진열대 version 과 함께(진열대 줄이 아직 없는 범위는 version 0 — 서버 계약)');

  w = world(SRC); const so1 = await w.api.saveShelfOrReport('DESK', ['x']);
  w = world(SRC, { failAt: (m, p) => m === 'PUT', failCode: 'CATALOG_INVALID_ITEM', kind: 'site' }); const so2 = await w.api.saveShelfOrReport('DESK', ['x']);
  chk(so1 === true && so2 === false && w.shown.map((x) => x[0]).join() === 'E-ADM-09' && !w.log.some((l) => l[0] === 'LOAD'), '★ 진열 순서 saveShelfOrReport — 서버가 받으면 true · 못 받으면 쓰던 자리 번호(E-ADM-09)로 알리고 false(부르는 쪽이 화면 순서를 안 바꾼다)');
  say('── 4. 카테고리 · 해금');
  w = world(SRC);
  await w.api.createCategory('muffler', { group: 'cloth', label: '머플러', icon: '🧣', bone: 'spine' });
  await w.api.renameCategory('cape', { label: '겉옷', icon: '🧥' });
  await w.api.resetCategory('cape'); await w.api.deleteCategory('scarf');
  const cl = w.log.filter((l) => l[0] !== 'LOAD');
  chk(cl[0][0] === 'PUT' && cl[0][1] === '/v2/admin/catalog/categories/muffler' && JSON.stringify(cl[0][2]) === '{"group":"CLOTH","label":"머플러","icon":"🧣","bone":"spine"}', '카테고리 만들기 — 코드 · 묶음(대문자) · 이름 · 아이콘 · 본(version 없음)');
  chk(JSON.stringify(cl[1][2]) === '{"version":6,"label":"겉옷","icon":"🧥"}' && cl[2][0] === 'POST' && cl[2][1] === '/v2/admin/catalog/categories/cape/reset?version=6' && cl[3][0] === 'DELETE' && cl[3][1] === '/v2/admin/catalog/categories/scarf?version=1',
    '  이름 고치기 · 원래대로 · 지우기 — 지금 version(PUT 은 본문 · POST reset · DELETE 는 ?version=)');
  w = world(SRC); await w.api.saveUnlock('ANIMAL_CHARACTER', 'animal', 40, '동물 캐릭터'); await w.api.saveUnlock('DANCE', '300', 300, '새 춤');
  const ul = w.log.filter((l) => l[0] === 'PUT');
  chk(ul[0][1] === '/v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal' && JSON.stringify(ul[0][2]) === '{"version":7,"level":40,"label":"동물 캐릭터"}' && JSON.stringify(ul[1][2]) === '{"level":300,"label":"새 춤"}', '★ 해금 레벨 — 줄이 있으면 지금 version 으로 고치기 · 없으면 만들기(version 없음) · 범위(1~999)는 서버가 본다');
  chk(w.api.unlockOf('ANIMAL_CHARACTER', 'animal').level === 50 && w.api.unlockOf('ANIMAL_CHARACTER', 'animal').label === '동물 캐릭터' && w.api.unlockOf('DANCE', 'x') === null, 'unlockOf — 마지막 한 벌의 레벨 · 이름 · 없으면 null');

  say('── 5. 실패 알림');
  w = world(SRC, { kind: 'site' }); let ea = Object.assign(new Error('x'), { stage: 'asset' });
  let k = await w.api.reportFail(ea, 'item');
  chk(k === 'site' && w.shown.join() === 'E-ADM-06,' , '파일 올리기 실패(stage asset)는 E-ADM-06');
  w = world(SRC, { kind: 'site' }); await w.api.reportFail(new Error('x'), 'item'); await w.api.reportFail(new Error('x'), 'shelf'); await w.api.reportFail(new Error('x'), 'category'); await w.api.reportFail(new Error('x'), 'config');
  chk(w.shown.map((x) => x[0]).join() === 'E-ADM-08,E-ADM-09,E-ADM-10,E-ADM-11', '그 밖 실패는 쓰던 자리의 번호(물건 08 · 순서 09 · 카테고리 10 · 게임 설정 11)');
  w = world(SRC, { kind: 'refetch' }); k = await w.api.reportFail(new Error('x'), 'item');
  chk(k === 'refetch' && w.log.some((l) => l[0] === 'LOAD') && w.shown.join() === 'toast,다른 곳에서 바꾼 내용을 받아왔어요', '★ 판이 달라졌으면 번호 없이 서버 한 벌을 다시 받고 «다른 곳에서 바꾼 내용을 받아왔어요»');
  w = world(SRC, { kind: 'common' }); await w.api.reportFail(new Error('x'), 'item');
  chk(!w.shown.length && !w.log.length, '공통 표 실패는 admin-api 의 notifyFail 이 알린다(여기서 번호를 또 붙이지 않는다)');
  /* 서버 오류 code → 번호 표(admin-api.js ERRORS) */
  const AA = load(AAPI);
  const srv = ['CATALOG_INVALID_FILE', 'CATALOG_STORE_FULL', 'CATALOG_INVALID_ITEM', 'CATALOG_UNKNOWN_CATEGORY', 'CATALOG_UNKNOWN_ASSET', 'CATALOG_UNKNOWN_ITEM', 'CATALOG_GACHA_PARTS_ONLY', 'CATALOG_INVALID_UNLOCK_LEVEL', 'CATALOG_ALREADY_EXISTS', 'CATALOG_CATEGORY_FULL', 'CATALOG_BUILTIN_CATEGORY', 'CATALOG_CATEGORY_IN_USE', 'CATALOG_ITEM_NOT_FOUND'];
  chk(srv.every((c) => AA.ERRORS[c]) && AA.ERRORS.CATALOG_ITEM_NOT_FOUND.action === 'refetch' && AA.ERRORS.CATALOG_CATEGORY_FULL.action === 'notice', '서버 카탈로그 오류 code 열세 개가 admin-api.js 갈래 표에 있다(없는 물건은 다시 받기 · 나머지는 번호)');
  const got = []; AA.ERRORS.CATALOG_CATEGORY_FULL.notice((c, e, t) => got.push([c, t]), { message: '이 카테고리에 진열 중인 일반 파츠는 30개까지예요' });
  chk(got[0][0] === 'E-ADM-07' && /30개/.test(got[0][1]), '  거절 번호(E-ADM-07)에 서버가 준 «어느 칸이 왜» 글을 싣는다');

  w = world(SRC); w.api.notifyLocalOnly();
  chk(w.shown.join() === 'E-ADM-12,' && !w.log.length, '서버에 없는(이 PC 에만 있는) 파츠를 고치려 하면 서버를 부르지 않고 E-ADM-12 로 알린다');
  say('── 6. 일부러 깨 보기');
  const breaks = [
    ['고치기에 version 안 실음', (s) => s.replace('return authed.put(path, version == null ? body : Object.assign({ version }, body));', 'return authed.put(path, body);')],
    ['파일 올리기 전에 물건부터 씀', (s) => s.replace('const g = await withFiles(f);\n    const v = (opt && opt.create) ? null : versionIn(\'parts\', \'partId\', id);', 'const v = (opt && opt.create) ? null : versionIn(\'parts\', \'partId\', id); const g = f;')],
    ['쓴 뒤 다시 안 받음', (s) => s.replace('const done = async (d, opt) => { if(!(opt && opt.quiet)) await catalog.load(); return d; };', 'const done = async (d) => d;')],
    ['진열 순서 실패에 true', (s) => s.replace('catch(e){ await reportFail(e, \'shelf\'); return false; }', 'catch(e){ await reportFail(e, \'shelf\'); return true; }')],
    ['진열대 version 0 고정', (s) => s.replace('version: row ? row.version : 0', 'version: 0')],
    ['단종 줄 실패를 삼킴', (s) => s.replace("if(d[0].ok !== true) throw", "if(false) throw")],
    ['카테고리 묶음을 소문자로', (s) => s.replace('String(c.group).toUpperCase()', 'String(c.group)')],
    ['올리기 실패에 stage 안 붙임', (s) => s.replace("e.stage = 'asset'; throw e;", 'throw e;')],
    ['판 달라짐에 다시 안 받음', (s) => s.replace("if(kind === 'refetch'){ await catalog.load(); deps.toast", "if(kind === 'refetch'){ deps.toast")],
  ];
  for(const [name, f] of breaks){
    const s2 = f(SRC);
    if(s2 === SRC){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let bad = false;
    try{
      const A = load(s2);
      const wq = (o) => { const x = world(s2, o); return x; };
      let x = wq(); await x.api.savePart('p1', Object.assign({ modelHash: H('c') }, PF)); if(x.log.find((l) => l[0] === 'PUT')[2].version !== 3) bad = true; if(!x.log.some((l) => l[0] === 'LOAD')) bad = true;
      x = wq(); await x.api.savePart('n', Object.assign({ glb: FILE }, PF), { create: true }); if(x.log[0][1].endsWith('/assets') === false) bad = true;
      x = wq(); await x.api.saveShelf('CATEGORY:hat', ['a']); if(x.log[0][2].version !== 9) bad = true;
      x = wq({ bulk: [{ kind: 'part', id: 'p1', ok: false, code: 'X' }] }); try{ await x.api.archive('part', 'p1'); bad = true; }catch(_){ /* 던져야 한다 */ }
      x = wq(); await x.api.createCategory('c', { group: 'cloth', label: 'l', icon: 'i', bone: 'b' }); if(x.log[0][2].group !== 'CLOTH') bad = true;
      x = wq({ failAt: (m, p) => p.endsWith('/assets') }); try{ await x.api.savePart('n', Object.assign({ glb: FILE }, PF), { create: true }); }catch(e){ if(e.stage !== 'asset') bad = true; }
      x = wq({ failAt: (m) => m === 'PUT', kind: 'site' }); if(await x.api.saveShelfOrReport('DESK', ['x']) !== false) bad = true;
      x = wq({ kind: 'refetch' }); await x.api.reportFail(new Error('x'), 'item'); if(!x.log.some((l) => l[0] === 'LOAD')) bad = true;
      void A;
    }catch(_){ bad = true; }
    chk(bad, name);
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { chk(false, '던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
