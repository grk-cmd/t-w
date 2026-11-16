/*
 * catalog-api.js — 🧩 카탈로그(파츠 · 책상 · 아이템)를 서버 한 벌 GET /v2/catalog 에서 받는다 (검사 sim-catalog-api.js)
 *
 * [왜] #887 이 /v1 → /v2 로 기계적으로 바꾸며 서버에 없는 GET /v2/catalog/{parts·gachaParts·items·desks}?v= 가 생겼다.
 *   서버 정본은 GET /v2/catalog 한 벌 { categories, shelves, parts, desks, deskProps, products, unlocks, season } 이다(CatalogController).
 *   응답에 ETag 와 no-cache 가 있다 — 앱은 «카탈로그 바뀜» 알림(realtime notify catalog)을 받으면 다시 묻고, 안 바뀌었으면 304 다.
 *
 * [구조]
 *   api   — TwApi.client(로그인 없는 읽기). If-None-Match · 304 · 같은 길 합치기는 api-client.js 가 한다(여기서 다시 만들지 않는다).
 *   unfoldCatalog(data, assetUrl) — 서버 한 벌 → 앱이 아는 목록({ parts · items · desks } — id → 레코드 맵 · categories · unlocks). **이 모양 바꾸기는 이 모듈 한 곳이다.**
 *     categories = { customCats: [운영이 더한 카테고리] · catOverrides: { 기본 코드: { label · icon } — 처음 값에서 바뀐 것만 } }(옛 catalog/customCats · catOverrides 와 같은 뜻) ·
 *     unlocks = { 종류: { 열쇠: { level · label } } }(옛 catalog/gameConfig 의 동물 해금 레벨은 ANIMAL_CHARACTER · animal).
 *     레코드마다 version · modelHash · thumbHash · listingAccess 를 싣는다 — 관리자가 고쳐 쓸 때 되돌려 보낸다.
 *     parts = 옛 catalog/parts + catalog/gachaParts 를 합친 것(가챠는 gacha:true · season) · items = 서버 deskProps · desks = 서버 desks.
 *     파일은 해시만 온다 → glbUrl · thumbUrl 은 GET /v2/catalog/assets/{해시}.{glb|png} 주소로 채운다(이름이 내용 해시라 1년 캐시 · 어느 출처든 읽는다).
 *   createCatalogApi(deps).subscribe(kind, onData) — kind: parts · items · desks · categories · unlocks. 처음 구독이 받기를 시작하고, 알림 · 연결 복구 때 다시 받는다.
 *     받은 값이 지난번과 같은 종류는 다시 넘기지 않는다. 넘기는 값은 늘 새 객체다(받는 쪽이 glb 를 채워 넣는다).
 *
 * [버전 알림 — Firebase catalogMeta 는 걷었다] 설계(contexts/catalog.md §2 «catalogMeta 버전 칸 · IndexedDB 24시간 · API 사본 → 응답 지문 ETag» ·
 *   d13-e-finish §9 · E-2)가 정한 대로다. 서버 한 벌에는 종류별 ver 가 없고(ETag 하나), 서버의 원본은 Postgres 라 Firebase 버전 칸이
 *   서버의 바뀜을 알리지 못한다. 바뀜 알림은 realtime 허브의 catalog 알림(rt-hub.js KINDS)이다. 이 PC 의 IndexedDB 캐시(24시간)도 같이 걷었다 —
 *   조건부 요청이 그 일을 한다. (Firebase 쓰기쪽 _catalogUpdate 의 catalogMeta 올림은 옛 앱 호환이라 firebase-init.js 에 남는다.)
 *
 * [못 받으면] Firebase 로 물러나지 않는다(우회 금지). 던진 오류를 오류 번호 E-CHAR-26 으로 드러내고, 목록은 지난번 것을 그대로 둔다(비우지 않는다).
 *   다시 받기는 알림이 올 때 · 오래 끊겼다 붙을 때(resync) · realtime 연결이 ready 가 될 때(받기에 실패한 적이 있으면)다. 타이머로 다시 두드리지 않는다.
 *
 * deps: api(TwApi.client — get(path, opts) · baseUrl()) · rt(TwRtHub.store — on(kind, fn) · onState(fn)) · notifyError — 오류 번호로 알리는 함수(TwErrorCodes.notify) · warn
 * Firebase 를 직접 import 하지 않는다 — 연결은 firebase-init.js 가 한다.
 */

export const CATALOG_PATH = '/v2/catalog';
export const CATALOG_ASSET_PATH = '/v2/catalog/assets/';
export const CATALOG_TIMEOUT_MS = 8000;   // 본문이 수백 KB 라 API 공통 시간 제한(2.5초)보다 길게
export const CATALOG_KINDS = Object.freeze(['parts', 'items', 'desks', 'categories', 'unlocks']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const HASH_RE = /^[0-9a-f]{64}$/;

/* 진열 — 이 라이선스(프리미엄) 전용인가. 옛 licenseOnly 깃발과 같은 뜻 */
const licenseOnlyOf = (listing) => !!(isObj(listing) && isObj(listing.access) && listing.access.kind === 'entitlement');

/* 해시 → 파일 주소. 해시 모양이 아니면 null(없는 파일로 본다 — 틀린 주소를 만들지 않는다) */
function urlOf(assetUrl, hash, ext){
  return (typeof hash === 'string' && HASH_RE.test(hash)) ? assetUrl(hash, ext) : null;
}
function put(rec, key, val){ if(val !== null && val !== undefined) rec[key] = val; }

/* 관리자가 고칠 때 되돌려 보낼 서버 칸 — 물건의 version(고치기에 싣는다) · 파일 해시(파일을 안 바꾸면 그대로 쓴다) · 진열 권한(앱이 모르는 종류도 그대로 돌려준다) */
function adminCols(rec, row){
  if(typeof row.version === 'number') rec.version = row.version;
  if(typeof row.model === 'string' && HASH_RE.test(row.model)) rec.modelHash = row.model;
  if(typeof row.thumb === 'string' && HASH_RE.test(row.thumb)) rec.thumbHash = row.thumb;
  if(isObj(row.listing) && isObj(row.listing.access)) rec.listingAccess = row.listing.access;
}
/* 서버 파츠 한 줄 → 옛 catalog/parts · gachaParts 레코드 */
function partRec(p, order, assetUrl){
  const rec = {
    name: str(p.name), icon: str(p.icon), cat: str(p.category),
    glow: p.glow === true, multi: p.multi === true, standalone: p.standalone === true, stackable: p.stackable === true,
    rideTop: p.rideTop === true, noColor: p.noColor === true, animMode: str(p.animMode), charType: str(p.charType) || 'default',
    hides: Array.isArray(p.hides) ? p.hides.filter((h) => typeof h === 'string') : [],
    order,
  };
  adminCols(rec, p);
  put(rec, 'glbUrl', urlOf(assetUrl, p.model, 'glb'));
  put(rec, 'thumbUrl', urlOf(assetUrl, p.thumb, 'png'));
  const t = p.defaultTransform;
  if(isObj(t) && typeof t.scale === 'number' && Array.isArray(t.pos) && Array.isArray(t.rot)){
    rec.defaultXf = { scale: t.scale, pos: t.pos.slice(0, 3), rot: t.rot.slice(0, 3), color: {} };
  }
  const acq = isObj(p.listing) ? p.listing.acquisition : null;
  if(isObj(acq) && acq.kind === 'GACHA'){
    rec.gacha = true;
    rec.season = (acq.season && acq.season !== 'ALWAYS') ? str(acq.season).toLowerCase() : '';   // 앱의 시즌 이름은 소문자(gacha.js) · ''=상시 가챠(옛 모양)
  }
  return rec;
}
/* 서버 책상 · 소품 한 줄 → 옛 catalog/desks · items 레코드 */
function propRec(d, order, assetUrl){
  const play = isObj(d.play) ? d.play : {};
  const rec = { name: str(d.name), icon: str(d.icon), playMode: str(play.playMode) || 'click', autoPlay: play.autoPlay === true, glow: play.glow === true,
    licenseOnly: licenseOnlyOf(d.listing), order };
  adminCols(rec, d);
  put(rec, 'glbUrl', urlOf(assetUrl, d.model, 'glb'));
  put(rec, 'thumbUrl', urlOf(assetUrl, d.thumb, 'png'));
  return rec;
}

/* GET /v2/catalog 의 data → { parts, items, desks }(id → 레코드 맵). 한 벌의 모양이 틀리면(parts · desks · deskProps 가 배열이 아님) 던진다.
   한 줄이 깨졌으면(id 없음) 그 줄만 뺀다. order = 서버 진열 순서(배열 순서) 그대로의 번호. */
/* 서버 카테고리 표 → { customCats: [운영이 더한 것 — 옛 catalog/customCats 줄], catOverrides: { 기본 코드: { label, icon } — 처음 값에서 바뀐 것만 } }.
   group 은 앱 이름(소문자) · 서버 배열 순서가 곧 진열 순서다 */
function foldCategories(list){
  const customCats = [], catOverrides = {};
  list.forEach((c) => {
    if(!isObj(c) || !str(c.code)) return;
    if(c.builtin === true){ if(c.overridden === true) catOverrides[c.code] = { label: str(c.label), icon: str(c.icon) }; }
    else customCats.push({ cat: c.code, label: str(c.label), icon: str(c.icon), group: str(c.group).toLowerCase(), bone: str(c.bone) });
  });
  return { customCats, catOverrides };
}
/* 서버 해금 표 → { 종류: { 열쇠: { level, label } } } */
function foldUnlocks(list){
  const out = {};
  list.forEach((u) => {
    if(!isObj(u) || !str(u.kind) || !str(u.key) || typeof u.level !== 'number') return;
    (out[u.kind] = out[u.kind] || {})[u.key] = { level: u.level, label: str(u.label) };
  });
  return out;
}

export function unfoldCatalog(data, assetUrl){
  if(!isObj(data) || !Array.isArray(data.parts) || !Array.isArray(data.desks) || !Array.isArray(data.deskProps)
    || !Array.isArray(data.categories) || !Array.isArray(data.unlocks)){
    throw Object.assign(new Error('카탈로그 모양이 달라요'), { code: 'SHAPE' });
  }
  const parts = {}, items = {}, desks = {};
  data.parts.forEach((p, i) => { if(isObj(p) && str(p.partId)) parts[p.partId] = partRec(p, i, assetUrl); });
  data.deskProps.forEach((d, i) => { if(isObj(d) && str(d.deskPropId)) items[d.deskPropId] = propRec(d, i, assetUrl); });
  data.desks.forEach((d, i) => { if(isObj(d) && str(d.deskId)) desks[d.deskId] = propRec(d, i, assetUrl); });
  // 책상 레코드엔 소품 칸(attachTo · defaultSize)이 없고, 소품 레코드엔 둘 다 있다
  data.deskProps.forEach((d) => {
    if(!isObj(d) || !str(d.deskPropId)) return;
    put(items[d.deskPropId], 'attachTo', str(d.attachTo) || null);
    if(typeof d.defaultSize === 'number' && isFinite(d.defaultSize)) items[d.deskPropId].defaultSize = d.defaultSize;
  });
  return { parts, items, desks, categories: foldCategories(data.categories), unlocks: foldUnlocks(data.unlocks) };
}

export function createCatalogApi(deps){
  const { api, rt, notifyError } = deps;
  const warn = deps.warn || ((...a) => console.warn(...a));
  const subs = {}, last = {};
  for(const k of CATALOG_KINDS){ subs[k] = new Set(); last[k] = null; }   // 마지막으로 넘긴 종류별 글(JSON) — 같으면 다시 안 넘긴다
  let cur = null;          // 마지막으로 푼 { parts, items, desks }
  let raw = null;          // 마지막으로 받은 서버 data(304 면 같은 객체가 온다)
  let running = null;      // 받는 중
  let again = false;       // 받는 중에 알림이 또 왔다 — 끝나면 한 번 더
  let failed = false;      // 마지막 받기가 실패했다 — realtime 이 붙으면 다시
  let started = false;

  const assetUrl = (hash, ext) => (api.baseUrl() || '') + CATALOG_ASSET_PATH + hash + '.' + ext;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function push(kind, onData){
    try{ onData(clone(cur[kind])); }catch(e){ warn('[catalog] 구독 콜백 오류', kind, e); }
  }
  function publish(){
    for(const kind of CATALOG_KINDS){
      const text = JSON.stringify(cur[kind]);
      if(text === last[kind]) continue;
      last[kind] = text;
      for(const fn of Array.from(subs[kind])) push(kind, fn);
    }
  }

  async function once(){
    const data = await api.get(CATALOG_PATH, { timeoutMs: CATALOG_TIMEOUT_MS });   // 304 면 기억한 같은 객체
    if(data === raw && cur) return;   // 바뀐 것 없음
    const next = unfoldCatalog(data, assetUrl);
    raw = data; cur = next;
    publish();
  }
  /* 받기 — 겹치면 하나로 합치고, 받는 중에 또 요청이 오면 끝난 뒤 한 번 더. 실패는 번호로 드러내고 지난 목록은 그대로 둔다 */
  function load(){
    if(running){ again = true; return running; }
    running = (async () => {
      try{ await once(); failed = false; }
      catch(e){ failed = true; notifyError('E-CHAR-26', e); warn('[catalog] 받기 실패', (e && (e.code || e.message)) || e); }
      finally{ running = null; }
      if(again){ again = false; return load(); }
    })();
    return running;
  }
  function start(){
    if(started) return;
    started = true;
    rt.on('catalog', () => { load(); });   // 바뀜 · 오래 끊겼다 붙음(resync) 모두 같은 일 — 다시 받기(ETag)
    rt.onState((s) => { if(s === 'ready' && failed) load(); });
  }

  function subscribe(kind, onData){
    if(!CATALOG_KINDS.includes(kind)) return () => {};
    subs[kind].add(onData);
    start();
    if(cur) push(kind, onData);
    else if(!running) load();   // 받는 중이면 끝날 때 이 구독자에게도 간다
    return () => { subs[kind].delete(onData); };
  }

  /* 마지막으로 받은 서버 한 벌 그대로(아직 못 받았으면 null) — 관리자 쓰기가 고칠 물건 · 카테고리 · 진열대 · 해금의 version 을 여기서 읽는다(admin/catalog-admin-api.js) */
  const current = () => raw;

  return { subscribe, load, current };
}
