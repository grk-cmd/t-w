/*
 * catalog-api.js — 🧩 카탈로그(파츠 · 책상 · 아이템)를 서버 한 벌 GET /v2/catalog 에서 받는다 (검사 sim-catalog-api.js)
 *
 * [왜] #887 이 /v1 → /v2 로 기계적으로 바꾸며 서버에 없는 GET /v2/catalog/{parts·gachaParts·items·desks}?v= 가 생겼다.
 *   서버 정본은 GET /v2/catalog 한 벌 { categories, shelves, parts, desks, deskProps, products, unlocks, season } 이다(CatalogController).
 *   응답에 ETag 와 no-cache 가 있다 — 앱은 «카탈로그 바뀜» 알림(realtime notify catalog)을 받으면 다시 묻고, 안 바뀌었으면 304 다.
 *
 * [구조]
 *   api   — TwApi.authed(로그인 읽기). If-None-Match · 304 · 같은 길 합치기는 api-client.js 가 한다(여기서 다시 만들지 않는다).
 *     로그인 뒤에만 받는다 — 서버가 보는 사람마다 «못 고르는 것(locked)» 을 정해 주기 때문이다(판정은 서버 · 앱은 그 값을 그대로 쓴다).
 *   unfoldCatalog(data, assetUrl, files?) — 서버 한 벌 → 앱이 아는 목록({ parts · items · desks } — id → 레코드 맵 · categories · unlocks). **이 모양 바꾸기는 이 모듈 한 곳이다.**
 *     categories = { customCats: [운영이 더한 카테고리] · catOverrides: { 기본 코드: { label · icon } — 처음 값에서 바뀐 것만 } }(옛 catalog/customCats · catOverrides 와 같은 뜻) ·
 *     unlocks = { 종류: { 열쇠: { level · label } } }(옛 catalog/gameConfig 의 동물 해금 레벨은 ANIMAL_CHARACTER · animal).
 *     레코드마다 version · modelHash · thumbHash · listingAccess 를 싣는다 — 관리자가 고쳐 쓸 때 되돌려 보낸다.
 *     책상 · 소품의 두 칸: locked = 서버가 이 사람에게 정한 «나에게 잠김» 그대로(막을 때 쓴다 — 앱이 다시 판정하지 않는다) · licenseOnly = 진열 access 가 entitlement 인 «라이선스 전용 분류»(어느 탭 · 목록에 그릴지 — 판정이 아니라 칸 채우기).
 *     parts = 옛 catalog/parts + catalog/gachaParts 를 합친 것(가챠는 gacha:true · season) · items = 서버 deskProps · desks = 서버 desks.
 *     파일은 해시만 온다 → glbUrl · thumbUrl 은 한 벌의 files(해시 → Firebase Storage 다운로드 URL)에 우리 버킷의 맞는 URL 이 있으면 그것을(storageUrlOf),
 *     없거나 틀리면 GET /v2/catalog/assets/{해시}.{glb|png} 주소로 채운다(이름이 내용 해시라 1년 캐시 · 어느 출처든 읽는다 · files 가 없는 옛 서버도 이 endpoint).
 *     files 의 URL 은 그대로 믿지 않는다 — https · 호스트 firebasestorage.googleapis.com · 이 앱의 버킷 하나(files.bucket — deps.storageBucket() = firebase-config.js 의 storageBucket ·
 *     운영 앱은 운영 버킷 · dev 앱은 dev 버킷) · 경로 assets%2F{같은 해시}.{확장자} · alt=media 가 다 맞아야 쓴다. 맵에 있는데 틀린 URL 은 files.onBad(해시)로 알리고(받는 쪽은 앱 실행마다 한 번 warn · URL 은 찍지 않는다) 옛 endpoint 로.
 *   createCatalogApi(deps).subscribe(kind, onData) — kind: parts · items · desks · categories · unlocks. 처음 구독이 받기를 시작하고, 알림(catalog · 내 라이선스가 바뀌면 license) · 연결 복구 때 다시 받는다. 돌려주는 해제 함수로 마지막 구독자가 빠지면 이번 로그인의 값을 모두 비운다(다음 로그인이 앞 사람의 locked 를 받지 않게).
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
 * [GLB 받기] fetchGlb(url) — 카탈로그가 알려 준 파일 주소를 받아 base64 로 돌려준다(웹 캐시를 거치지 않는다 — 깨진 응답이 캐시에 남지 않게 · E-CHAR-14). 받은 것을 남기는 일은 부르는 쪽(catalog-glb.js).
 *
 * deps: api(TwApi.authed — get(path, opts) · baseUrl()) · rt(TwRtHub.store — on(kind, fn) · onState(fn)) · notifyError — 오류 번호로 알리는 함수(TwErrorCodes.notify) · fetch(파일 받기) · warn ·
 *   storageBucket() — 이 앱의 Storage 버킷(firebaseAPI.storageBucket — firebase-config.js · 빈 값이면 files 를 쓰지 않는다)
 * classic script(window.TwCatalogApi) — app.js 가 만들어 catalog-sync · catalog-glb · 관리자 쓰기에 넘긴다. Firebase 를 거치지 않는다.
 */
(function(){

const CATALOG_PATH = '/v2/catalog';
const CATALOG_ASSET_PATH = '/v2/catalog/assets/';
const CATALOG_TIMEOUT_MS = 8000;   // 본문이 수백 KB 라 API 공통 시간 제한(2.5초)보다 길게
const CATALOG_KINDS = Object.freeze(['parts', 'items', 'desks', 'categories', 'unlocks']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const HASH_RE = /^[0-9a-f]{64}$/;
/* files 맵의 Storage 다운로드 URL 이 가리켜도 되는 호스트 — 버킷은 부르는 쪽이 넘긴다(이 앱의 firebase-config.js storageBucket 하나) */
const STORAGE_HOST = 'firebasestorage.googleapis.com';
const STORAGE_URL_MAX = 1000;
const STORAGE_PATH_RE = /^\/v0\/b\/([^/]+)\/o\/assets%2F([0-9a-f]{64})\.[a-z0-9]{2,5}$/;

/* files 의 한 값 → 그 해시의 Storage 다운로드 URL. 모양이 하나라도 틀리면 null(→ 서버 파일 endpoint 로 받는다) */
function storageUrlOf(raw, hash, bucket){
  if(typeof bucket !== 'string' || !bucket || typeof raw !== 'string' || raw.length > STORAGE_URL_MAX) return null;
  let u; try{ u = new URL(raw); }catch(_){ return null; }
  if(u.protocol !== 'https:' || u.hostname !== STORAGE_HOST || u.port || u.username || u.password || u.hash) return null;
  const m = STORAGE_PATH_RE.exec(u.pathname);
  if(!m || m[1] !== bucket || m[2] !== hash) return null;   // 다른 버킷(다른 판 포함) · 다른 파일을 가리키면 쓰지 않는다
  return u.searchParams.get('alt') === 'media' ? u.href : null;
}
/* 해시 → 파일 주소(files 의 Storage URL → 없으면 서버 파일 endpoint). 해시 모양이 아니면 null(없는 파일로 본다 — 틀린 주소를 만들지 않는다) */
function urlOf(fileUrl, hash, ext){
  return (typeof hash === 'string' && HASH_RE.test(hash)) ? fileUrl(hash, ext) : null;
}
/* 진열 분류 — «라이선스 전용» 으로 진열된 물건인가(어느 탭 · 목록에 그릴지 · 관리자 칸). 막을지는 이것이 아니라 서버 locked 가 정한다(propRec 의 locked field) */
const licenseOnlyOf = (listing) => !!(isObj(listing) && isObj(listing.access) && listing.access.kind === 'entitlement');
function put(rec, key, val){ if(val !== null && val !== undefined) rec[key] = val; }

/* 관리자가 고칠 때 되돌려 보낼 서버 칸 — 물건의 version(고치기에 싣는다) · 파일 해시(파일을 안 바꾸면 그대로 쓴다) · 진열 권한(앱이 모르는 종류도 그대로 돌려준다) */
function adminCols(rec, row){
  if(typeof row.version === 'number') rec.version = row.version;
  if(typeof row.model === 'string' && HASH_RE.test(row.model)) rec.modelHash = row.model;
  if(typeof row.thumb === 'string' && HASH_RE.test(row.thumb)) rec.thumbHash = row.thumb;
  if(isObj(row.listing) && isObj(row.listing.access)) rec.listingAccess = row.listing.access;
}
/* 서버 파츠 한 줄 → 옛 catalog/parts · gachaParts 레코드 */
function partRec(p, order, fileUrl){
  const rec = {
    name: str(p.name), icon: str(p.icon), cat: str(p.category),
    glow: p.glow === true, multi: p.multi === true, standalone: p.standalone === true, stackable: p.stackable === true,
    rideTop: p.rideTop === true, noColor: p.noColor === true, animMode: str(p.animMode), charType: str(p.charType) || 'default',
    hides: Array.isArray(p.hides) ? p.hides.filter((h) => typeof h === 'string') : [],
    order,
  };
  adminCols(rec, p);
  put(rec, 'glbUrl', urlOf(fileUrl, p.model, 'glb'));
  put(rec, 'thumbUrl', urlOf(fileUrl, p.thumb, 'png'));
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
function propRec(d, order, fileUrl){
  const play = isObj(d.play) ? d.play : {};
  const rec = { name: str(d.name), icon: str(d.icon), playMode: str(play.playMode) || 'click', autoPlay: play.autoPlay === true, glow: play.glow === true,
    licenseOnly: licenseOnlyOf(d.listing), locked: d.locked === true, order };
  adminCols(rec, d);
  put(rec, 'glbUrl', urlOf(fileUrl, d.model, 'glb'));
  put(rec, 'thumbUrl', urlOf(fileUrl, d.thumb, 'png'));
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

/* files = { bucket: 이 앱의 Storage 버킷, onBad(해시): 맵에 있는데 틀린 URL } — 없으면 늘 서버 파일 endpoint */
function unfoldCatalog(data, assetUrl, files){
  if(!isObj(data) || !Array.isArray(data.parts) || !Array.isArray(data.desks) || !Array.isArray(data.deskProps)
    || !Array.isArray(data.categories) || !Array.isArray(data.unlocks)){
    throw Object.assign(new Error('카탈로그 모양이 달라요'), { code: 'SHAPE' });
  }
  const map = isObj(data.files) ? data.files : null;   // 없으면(옛 서버) 늘 서버 파일 endpoint
  const bucket = files && files.bucket, onBad = (files && files.onBad) || (() => {});
  const fileUrl = (hash, ext) => {
    if(!map || !Object.prototype.hasOwnProperty.call(map, hash)) return assetUrl(hash, ext);
    const url = storageUrlOf(map[hash], hash, bucket);
    if(!url) onBad(hash);
    return url || assetUrl(hash, ext);
  };
  const parts = {}, items = {}, desks = {};
  data.parts.forEach((p, i) => { if(isObj(p) && str(p.partId)) parts[p.partId] = partRec(p, i, fileUrl); });
  data.deskProps.forEach((d, i) => { if(isObj(d) && str(d.deskPropId)) items[d.deskPropId] = propRec(d, i, fileUrl); });
  data.desks.forEach((d, i) => { if(isObj(d) && str(d.deskId)) desks[d.deskId] = propRec(d, i, fileUrl); });
  // 책상 레코드엔 소품 칸(attachTo · defaultSize)이 없고, 소품 레코드엔 둘 다 있다
  data.deskProps.forEach((d) => {
    if(!isObj(d) || !str(d.deskPropId)) return;
    put(items[d.deskPropId], 'attachTo', str(d.attachTo) || null);
    if(typeof d.defaultSize === 'number' && isFinite(d.defaultSize)) items[d.deskPropId].defaultSize = d.defaultSize;
  });
  return { parts, items, desks, categories: foldCategories(data.categories), unlocks: foldUnlocks(data.unlocks) };
}

function createCatalogApi(deps){
  const { api, rt, notifyError } = deps;
  const fetchFile = deps.fetch;
  const warn = deps.warn || ((...a) => console.warn(...a));
  const storageBucket = deps.storageBucket;   // 이 앱의 Storage 버킷(app.js — firebaseAPI.storageBucket)
  const subs = {}, last = {};
  for(const k of CATALOG_KINDS){ subs[k] = new Set(); last[k] = null; }   // 마지막으로 넘긴 종류별 글(JSON) — 같으면 다시 안 넘긴다
  let cur = null;          // 마지막으로 푼 { parts, items, desks }
  let raw = null;          // 마지막으로 받은 서버 data(304 면 같은 객체가 온다)
  let running = null;      // 받는 중
  let again = false;       // 받는 중에 알림이 또 왔다 — 끝나면 한 번 더
  let failed = false;      // 마지막 받기가 실패했다 — realtime 이 붙으면 다시
  let gen = 0;             // 로그인 한 번마다 하나 — 끝난 로그인의 늦은 답을 버린다
  const offs = [];         // 알림 · 연결 구독 해제(구독자가 있는 동안만 건다)

  const assetUrl = (hash, ext) => (api.baseUrl() || '') + CATALOG_ASSET_PATH + hash + '.' + ext;
  let badUrlWarned = false;   // 틀린 Storage URL 경고는 앱 실행마다 한 번(해시만 · URL 엔 토큰이 있어 찍지 않는다)
  const onBadUrl = (hash) => { if(badUrlWarned) return; badUrlWarned = true; warn('[catalog] files 의 Storage URL 이 맞지 않아 서버 파일 endpoint(/v2/catalog/assets/{hash}.{ext})로 받는다 — 해시', hash); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const count = () => CATALOG_KINDS.reduce((n, k) => n + subs[k].size, 0);

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

  async function once(g){
    const data = await api.get(CATALOG_PATH, { auth: true, timeoutMs: CATALOG_TIMEOUT_MS });   // 304 면 기억한 같은 객체
    if(g !== gen) return;   // 그 사이 로그인이 끝났다
    if(data === raw && cur) return;   // 바뀐 것 없음
    const next = unfoldCatalog(data, assetUrl, { bucket: storageBucket(), onBad: onBadUrl });
    raw = data; cur = next;
    publish();
  }
  /* 받기 — 겹치면 하나로 합치고, 받는 중에 또 요청이 오면 끝난 뒤 한 번 더. 실패는 번호로 드러내고 지난 목록은 그대로 둔다 */
  function load(){
    if(running){ again = true; return running; }
    const g = gen;
    const p = (async () => {
      try{ await once(g); if(g === gen) failed = false; }
      catch(e){ if(g === gen){ failed = true; notifyError('E-CHAR-26', e); warn('[catalog] 받기 실패', (e && (e.code || e.message)) || e); } }
      finally{ if(g === gen) running = null; }
      if(g === gen && again){ again = false; return load(); }
    })();
    if(g === gen) running = p;
    return p;
  }
  function start(){
    if(offs.length) return;
    offs.push(
      rt.on('catalog', () => { load(); }),   // 바뀜 · 오래 끊겼다 붙음(resync) 모두 같은 일 — 다시 받기(ETag)
      rt.on('license', () => { load(); }),   // 내 라이선스가 바뀌면 서버가 정하는 locked 도 바뀐다
      rt.onState((s) => { if(s === 'ready' && failed) load(); }),
    );
  }
  /* 마지막 구독자가 빠졌다 = 로그인이 끝났다 — 받은 값 · 받는 중인 요청 · 알림 구독을 모두 비운다 */
  function drop(){
    gen++;
    offs.splice(0).forEach((off) => off());
    cur = null; raw = null; running = null; again = false; failed = false;
    for(const k of CATALOG_KINDS) last[k] = null;
  }

  function subscribe(kind, onData){
    if(!CATALOG_KINDS.includes(kind)) throw new Error('[catalog] 모르는 종류 — ' + kind);
    subs[kind].add(onData);
    start();
    if(cur) push(kind, onData);
    else if(!running) load();   // 받는 중이면 끝날 때 이 구독자에게도 간다
    return () => { if(subs[kind].delete(onData) && count() === 0) drop(); };
  }

  async function fetchGlb(url){
    if(!url) throw new Error('empty url');
    const res = await fetchFile(url, { cache: 'no-store' });
    if(!res.ok) throw new Error('storage fetch failed ' + res.status);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // 한 번에 큰 배열로 fromCharCode 하면 stack overflow — 청크로 처리
    let bin = ''; const CHUNK = 0x8000;
    for(let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(bin);
  }

  /* 마지막으로 받은 서버 한 벌 그대로(아직 못 받았으면 null) — 관리자 쓰기가 고칠 물건 · 카테고리 · 진열대 · 해금의 version 을 여기서 읽는다(admin/catalog-admin-api.js) */
  const current = () => raw;

  /* 0.13 판이 GLB 를 받던 서버 endpoint 주소(해시 → 주소) — 그 판이 남긴 영구 캐시 줄의 열쇠(catalog-glb.js 가 옛 줄을 찾는다) */
  const legacyGlbUrl = (hash) => assetUrl(hash, 'glb');

  return { subscribe, load, current, fetchGlb, legacyGlbUrl };
}

const mod = { CATALOG_PATH, CATALOG_ASSET_PATH, CATALOG_TIMEOUT_MS, CATALOG_KINDS, unfoldCatalog, createCatalogApi };
if(typeof window !== 'undefined') window.TwCatalogApi = mod;
if(typeof module !== 'undefined' && module.exports) module.exports = mod;
})();
