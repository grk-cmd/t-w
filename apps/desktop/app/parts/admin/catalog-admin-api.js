/* catalog-admin-api.js — 🛠️ 앱 관리자 카탈로그 쓰기 서버 길 provider (검사 sim-catalog-admin-api.js)
   책임: 파츠 · 책상 · 소품 등록 · 고치기 · 단종 · 진열 순서 · 카테고리 · 레벨 해금을 서버 /v2/admin/catalog/* 로 쓰는 요청 모양 한 곳.
     앱 칸(rec) → 서버 본문 바꾸기도 여기뿐이다(서버 → 앱 쪽은 character/catalog-api.js). 화면은 모른다 — 실패는 던진다(ApiError).
   관리자 판정 · 상한(카테고리당 진열 수 · 파일 크기 · 모양) · 값 거르기는 서버가 한다. 앱이 미리 거절하지 않고 서버 오류를 번호로 보인다.
   고치기에 싣는 version 은 마지막으로 받은 서버 한 벌(catalog.current())에서 읽는다 — 다르면 서버가 409(CONCURRENT_UPDATE)로 거절한다.
   쓰기가 끝나면 한 벌을 한 번 다시 받는다(catalog.load() — realtime «카탈로그 바뀜» 알림은 흩어서 와서 관리자 본인 화면이 늦는다).
   deps: authed — 로그인 통로(TwApi.authed) · catalog — { current() 마지막 서버 한 벌, load() 다시 받기 }(catalog-api.js) ·
         adminApi — 실패 갈래(failOf · notifyFail — admin-api.js) · apiErrors — 서버 오류 → 번호(TwApiErrors.store) · notifyError — 번호 알림(TwErrorCodes.notify) · toast
   내보냄: createCatalogAdminApi(deps) → {
     savePart(id, f, { create, quiet }) · saveDesk(id, f, { create, quiet }) · saveDeskProp(id, f, { create, quiet }) → Promise<void> — quiet 이면 쓴 뒤 다시 받지 않는다(여럿을 이어 쓸 때 — 끝에서 reload)
       f = 앱 칸 — 파일은 glb · thumbPng(Uint8Array — 올린 뒤 해시를 싣는다) 또는 modelHash · thumbHash(안 바꾸면 그대로). create 가 아니면 지금 version 으로 고친다.
     archive(kind, id) — kind: part · desk · deskProp. 단종(진열에서 내림 · 행은 남음) · saveShelf(scope, ids) — 진열 순서 전체 · saveShelfOrReport(scope, ids) → Promise<bool> — 쓰고 실패는 알린다(true 면 서버가 받았다)
     createCategory(code, { group, label, icon, bone }) · renameCategory(code, { label, icon }) · resetCategory(code) · deleteCategory(code)
     saveUnlock(kind, key, level, label) · unlockOf(kind, key) → { level, label, version } | null
     reload() — 서버 한 벌 다시 받기
     reportFail(err, site) → Promise<갈래> — 실패 알림 한 벌(판이 달라졌으면 다시 받고 «받아왔어요»). 그 밖 실패는 site(item · shelf · category · config)의 번호로. 파일 올리기 실패(err.stage 'asset')는 E-ADM-06
   }
     순수: SITE_NOTICE · PATHS · PART_FIELDS · DESK_FIELDS · PROP_FIELDS · partFieldsOf · partBody · deskBody · propBody · accessOf
   검사: checks/sim-catalog-admin-api.js */
(function(){
'use strict';

const enc = encodeURIComponent;
const BASE = '/v2/admin/catalog';
const PATHS = Object.freeze({
  assets: BASE + '/assets',
  part: (id) => BASE + '/parts/' + enc(id),
  desk: (id) => BASE + '/desks/' + enc(id),
  deskProp: (id) => BASE + '/desk-props/' + enc(id),
  bulk: BASE + '/listings/bulk',
  shelf: (scope) => BASE + '/shelves/' + enc(scope),
  category: (code) => BASE + '/categories/' + enc(code),
  categoryReset: (code) => BASE + '/categories/' + enc(code) + '/reset',
  unlock: (kind, key) => BASE + '/unlocks/' + enc(kind) + '/' + enc(key),
});
/* 서버 PUT 본문이 받는 칸 — 서버 CatalogRequest 의 PART_FIELDS · DESK_FIELDS · PROP_FIELDS 와 같다(모르는 칸을 보내면 400) */
const PART_FIELDS = Object.freeze(['version', 'name', 'icon', 'category', 'model', 'thumb', 'glow', 'multi', 'standalone', 'stackable', 'rideTop', 'noColor', 'animMode', 'charType', 'defaultTransform', 'hides', 'listing']);
const DESK_FIELDS = Object.freeze(['version', 'name', 'icon', 'model', 'thumb', 'play', 'listing']);
const PROP_FIELDS = Object.freeze(DESK_FIELDS.concat(['attachTo', 'defaultSize']));
const GLB = 'model/gltf-binary', PNG = 'image/png';
const HASH_RE = /^[0-9a-f]{64}$/;
const KIND_LIST = Object.freeze({ part: ['parts', 'partId'], desk: ['desks', 'deskId'], deskProp: ['deskProps', 'deskPropId'] });

/* 갈래 표에도 공통 표에도 없는 실패 — 쓰던 자리의 번호(error-codes.js). 번호는 글자 그대로 써야 검사가 찾는다 */
const SITE_NOTICE = Object.freeze({
  asset: (notifyError, e) => notifyError('E-ADM-06', e),
  item: (notifyError, e) => notifyError('E-ADM-08', e),
  shelf: (notifyError, e) => notifyError('E-ADM-09', e),
  category: (notifyError, e) => notifyError('E-ADM-10', e),
  config: (notifyError, e) => notifyError('E-ADM-11', e),
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
/* 앱이 만든 «서버 한 벌에 그 줄이 없다» · «아직 한 벌을 못 받았다» — 서버가 아니라 앱의 상태라 통로 오류와 같은 모양(code)으로 던진다 */
const missing = (code, what) => Object.assign(new Error(what), { code, kind: 'request' });

/* 이 물건을 쓸 수 있는 사람 — 입력(licenseOnly)이 지금 서버 값(existing)과 같은 뜻이면 서버 값을 그대로 돌려준다(앱이 모르는 종류 · 숨김 표시를 잃지 않게) */
function accessOf(licenseOnly, existing){
  const premium = !!(isObj(existing) && existing.kind === 'entitlement');
  if(isObj(existing) && (licenseOnly === undefined || licenseOnly === premium)) return existing;
  return licenseOnly ? { kind: 'entitlement', key: 'premium', display: 'show' } : { kind: 'everyone' };
}
/* 진열 — 앱에서 등록 · 고치는 물건은 곧바로 진열한다(초안으로 두지 않는다). 얻는 법은 파츠만 가챠 */
function listingOf(f){
  return {
    state: 'ACTIVE',
    access: accessOf(f.licenseOnly, f.listingAccess),
    acquisition: f.gacha ? { kind: 'GACHA', season: f.season ? String(f.season).toUpperCase() : 'ALWAYS' } : { kind: 'GIVEN' },
  };
}
/* 서버 한 벌에서 온 파츠 줄(rec — catalog-api.js)을 savePart 의 칸으로 — 안 바꾸는 칸을 그대로 되돌려 보낸다 */
function partFieldsOf(rec, over){
  return Object.assign({
    name: rec.name, icon: rec.icon, category: rec.cat, modelHash: rec.modelHash, thumbHash: rec.thumbHash,
    glow: rec.glow, multi: rec.multi, standalone: rec.standalone, stackable: rec.stackable, rideTop: rec.rideTop, noColor: rec.noColor,
    animMode: rec.animMode, charType: rec.charType, defaultXf: rec.defaultXf, hides: rec.hides, gacha: rec.gacha, season: rec.season,
    listingAccess: rec.listingAccess,
  }, over || {});
}
function partBody(f){
  const b = {
    name: f.name, icon: f.icon || '', category: f.category, model: f.modelHash,
    glow: !!f.glow, multi: !!f.multi, standalone: !!f.standalone, stackable: !!f.stackable, rideTop: !!f.rideTop,
    animMode: f.animMode === 'active' ? 'active' : 'always', charType: f.charType === 'commission' ? 'commission' : 'default',
    hides: Array.isArray(f.hides) ? f.hides.slice() : [], listing: listingOf(f),
  };
  if(f.thumbHash) b.thumb = f.thumbHash;
  if(typeof f.noColor === 'boolean') b.noColor = f.noColor;   // 판정 못 했으면 칸을 빼 서버 기본(false)을 따른다
  const x = f.defaultXf;
  if(isObj(x) && typeof x.scale === 'number' && Array.isArray(x.pos) && Array.isArray(x.rot)) b.defaultTransform = { scale: x.scale, pos: x.pos.slice(0, 3), rot: x.rot.slice(0, 3) };
  return b;
}
/* 책상 · 소품 공통 — 재생 방식. autoPlay 는 playMode 에서 나온다(서버가 어긋나면 400) */
function playOf(f){ return { playMode: f.playMode || 'click', autoPlay: f.playMode === 'auto', glow: !!f.glow }; }
function deskBody(f){
  const b = { name: f.name, icon: f.icon || '', model: f.modelHash, play: playOf(f), listing: listingOf(Object.assign({}, f, { gacha: false })) };
  if(f.thumbHash) b.thumb = f.thumbHash;
  return b;
}
function propBody(f){
  const b = deskBody(f);
  b.attachTo = f.attachTo || 'desk';
  b.defaultSize = f.defaultSize;
  return b;
}

function createCatalogAdminApi(deps){
  const authed = deps.authed;
  const catalog = deps.catalog;

  const raw = () => {
    const d = catalog.current();
    if(!isObj(d)) throw missing('CATALOG_NOT_LOADED', '카탈로그를 아직 못 받았어요');
    return d;
  };
  /* 고칠 줄의 version — 한 벌에 그 줄이 없으면(다른 곳에서 지움) 서버를 부르지 않고 «없는 물건» 으로 끝낸다 */
  function versionIn(list, key, id){
    const row = (raw()[list] || []).find((r) => isObj(r) && r[key] === id);
    if(!row || typeof row.version !== 'number') throw missing('CATALOG_ITEM_NOT_FOUND', '카탈로그에 없는 물건이에요');
    return row.version;
  }
  const done = async (d, opt) => { if(!(opt && opt.quiet)) await catalog.load(); return d; };

  /* 파일 한 벌 올리기 → 해시. 내용이 같으면 서버가 같은 해시를 돌려준다 */
  async function upload(bytes, type){
    try{
      const d = await authed.post(PATHS.assets, bytes, { rawType: type });
      if(!isObj(d) || !HASH_RE.test(d.hash || '')) throw shapeError();
      return d.hash;
    }catch(e){ if(isObj(e) || e instanceof Error) e.stage = 'asset'; throw e; }
  }
  /* 파일 · 썸네일을 올리고(바뀐 것만) 본문에 해시를 싣는다 — 하나라도 올리지 못하면 물건은 쓰지 않는다 */
  async function withFiles(f){
    const modelHash = f.glb ? await upload(f.glb, GLB) : f.modelHash;
    const thumbHash = f.thumbPng ? await upload(f.thumbPng, PNG) : f.thumbHash;
    return Object.assign({}, f, { modelHash, thumbHash });
  }
  function put(path, body, version){
    return authed.put(path, version == null ? body : Object.assign({ version }, body));
  }

  async function savePart(id, f, opt){
    const g = await withFiles(f);
    const v = (opt && opt.create) ? null : versionIn('parts', 'partId', id);
    await done(await put(PATHS.part(id), partBody(g), v), opt);
  }
  async function saveDesk(id, f, opt){
    const g = await withFiles(f);
    const v = (opt && opt.create) ? null : versionIn('desks', 'deskId', id);
    await done(await put(PATHS.desk(id), deskBody(g), v), opt);
  }
  async function saveDeskProp(id, f, opt){
    const g = await withFiles(f);
    const v = (opt && opt.create) ? null : versionIn('deskProps', 'deskPropId', id);
    await done(await put(PATHS.deskProp(id), propBody(g), v), opt);
  }

  /* 단종 — 물건 하나를 일괄 단종 길(줄마다 ok · code)로. 줄이 ok 가 아니면 그 code 로 던진다 */
  async function archive(kind, id){
    const map = KIND_LIST[kind];
    if(!map) throw missing('INVALID_REQUEST', '모르는 물건 종류예요');
    const version = versionIn(map[0], map[1], id);
    const d = await authed.post(PATHS.bulk, { action: 'ARCHIVE', items: [{ kind, id, version }] });
    if(!Array.isArray(d) || d.length !== 1 || !isObj(d[0])) throw shapeError();
    if(d[0].ok !== true) throw missing(String(d[0].code || 'INVALID_REQUEST'), '단종하지 못했어요');
    await done();
  }

  /* 진열 순서 — scope: CATEGORY:{코드} · DESK · DESK_PROP. 순서 전체를 보낸다(진열대 줄이 아직 없는 범위는 version 0 — 서버 계약) */
  async function saveShelf(scope, ids){
    const row = (raw().shelves || []).find((s) => isObj(s) && s.scope === scope);
    await done(await authed.put(PATHS.shelf(scope), { version: row ? row.version : 0, order: ids.slice() }));
  }

  async function createCategory(code, c){
    await done(await authed.put(PATHS.category(code), { group: String(c.group).toUpperCase(), label: c.label, icon: c.icon, bone: c.bone }));
  }
  async function renameCategory(code, c){
    await done(await authed.put(PATHS.category(code), { version: versionIn('categories', 'code', code), label: c.label, icon: c.icon }));
  }
  async function resetCategory(code){
    await done(await authed.post(PATHS.categoryReset(code) + '?version=' + enc(versionIn('categories', 'code', code))));
  }
  async function deleteCategory(code){
    await done(await authed.del(PATHS.category(code) + '?version=' + enc(versionIn('categories', 'code', code))));
  }

  const unlockRow = (kind, key) => (raw().unlocks || []).find((u) => isObj(u) && u.kind === kind && u.key === key) || null;
  function unlockOf(kind, key){
    const u = unlockRow(kind, key);
    return u ? { level: u.level, label: u.label, version: u.version } : null;
  }
  /* 해금 레벨 — 줄이 있으면 고치기(version) · 없으면 만들기(서버 PUT 은 version 이 없으면 만든다) */
  async function saveUnlock(kind, key, level, label){
    const u = unlockRow(kind, key);
    await done(await put(PATHS.unlock(kind, key), { level, label }, u ? u.version : null));
  }

  /* 실패 알림 한 벌 — 이 기능 표(admin-api.js ERRORS) · 공통 표는 번호로, 판이 달라졌으면 다시 받고 알린다, 그 밖은 siteCode(파일 올리기 실패는 E-ADM-06) */
  async function reportFail(err, site){
    const notice = (err && err.stage === 'asset') ? SITE_NOTICE.asset : SITE_NOTICE[site];
    const kind = deps.adminApi.notifyFail(err, deps.apiErrors, () => notice(deps.notifyError, err));
    if(kind === 'refetch'){ await catalog.load(); deps.toast('다른 곳에서 바꾼 내용을 받아왔어요'); }
    return kind;
  }

  /* 진열 순서 저장 + 실패 알림 — 서버가 받았으면 true. 아니면 번호로 알리고 false(부르는 쪽은 화면 순서를 바꾸지 않는다) */
  async function saveShelfOrReport(scope, ids){
    try{ await saveShelf(scope, ids); return true; }
    catch(e){ await reportFail(e, 'shelf'); return false; }
  }
  const reload = () => catalog.load();

  return { reload, saveShelfOrReport, savePart, saveDesk, saveDeskProp, archive, saveShelf, createCategory, renameCategory, resetCategory, deleteCategory, saveUnlock, unlockOf, reportFail };
}

const api = { createCatalogAdminApi, SITE_NOTICE, PATHS, PART_FIELDS, DESK_FIELDS, PROP_FIELDS, partFieldsOf, partBody, deskBody, propBody, accessOf };
if(typeof window !== 'undefined') window.TwCatalogAdminApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
