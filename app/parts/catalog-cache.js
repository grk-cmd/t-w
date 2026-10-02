/*
 * 카탈로그(catalog/parts · gachaParts · items · desks)를 버전 확인 + 로컬 캐시로 받는다.
 * 부팅마다 네 종류를 통째로 받던 것이 운영 다운로드의 큰 몫이었다 — 관리자가 안 고쳤으면 다시 받을 이유가 없다.
 *
 * [구조]
 *   관리자가 카탈로그를 고칠 때 같은 다중 경로 update 로 catalogMeta/{종류} 에 서버 시각을 함께 쓴다
 *   (앱 firebase-init.js _catalogUpdate · 웹 관리자 entities/catalog catalogCommit).
 *   앱은 catalogMeta/{종류}(숫자 하나)만 실시간 구독한다. 버전이 캐시와 같으면 캐시를 쓰고,
 *   다르거나 캐시가 없으면 그 종류만 get 으로 한 번 받아 캐시를 바꾼다.
 *   켜져 있는 동안 관리자가 고쳐도 버전 구독이 알려 주므로 반영된다. 다만 예전 onValue 는 바뀐 조각만 받았지만
 *   지금은 그 종류를 통째로 다시 받으므로(켜 둔 사람 수 × 노드 크기), 켜져 있는 동안의 바뀜은
 *   LIVE_COALESCE 만큼 모았다가 한 번만 받는다 — 관리자가 순서를 여러 번 끌어 놓아도 사람마다 한 번이고,
 *   기다림을 사람마다 흩어 서버에 한꺼번에 몰리지 않게 한다.
 *
 * [안전장치]
 *   ① catalogMeta 가 없거나 구독이 거부되면(규칙 배포 전 — 루트가 막혀 있다) 예전처럼 catalog/{종류} 를
 *      통째 onValue 한다. 거부된 구독은 재시도 없이 끊기므로 캐시만 믿지 않는다.
 *   ② 옛 관리자 앱은 버전을 안 올리고 카탈로그를 고친다 — 캐시에 최대 수명(24시간)을 두고,
 *      지나면 버전이 같아도 다시 받는다. 앱을 며칠씩 켜 두는 사람이 있어 수명이 다하는 때 타이머로 다시 판정한다.
 *   ③ 오프라인 부팅이면 버전 구독이 연결될 때까지 아무 값도 안 온다. OFFLINE_GRACE_MS 안에 버전이 안 오면
 *      캐시가 있을 때만 (수명과 상관없이) 먼저 보여 준다. 버전이 오면 평소대로 다시 판정한다.
 *      캐시가 없으면 기다린다 — 예전(통째 onValue)도 연결 전엔 아무것도 안 왔다.
 *
 * 캐시는 IndexedDB(tw-catalog-cache)다. localStorage(약 5MB · 동기)는 옛 항목에 base64 glb 가 남은 노드가
 * 수 MB 라 맞지 않는다. 용량 초과를 포함한 열기 · 읽기 · 쓰기 실패는 전부 «캐시 없음» 으로 보고 서버에서 받는다.
 * 받기(get)까지 실패하면 ① 과 같은 옛 방식으로 물러난다.
 * 캐시 키에 DB 주소를 넣는다 — 운영과 dev(start:dev)가 같은 PC 에서 돌 수 있다.
 *
 * Firebase 를 직접 import 하지 않는다 — 경로 · onValue · get 은 firebase-init.js 가 넘긴다(검사 sim-catalog-cache.js).
 */

export const CATALOG_KINDS = ['parts', 'gachaParts', 'items', 'desks'];
export const CATALOG_CACHE_MAX_AGE_MS = 24 * 3600 * 1000;   // 안전장치 ②
export const CATALOG_CACHE_SCHEMA = 1;                       // 캐시 레코드 모양이 바뀌면 올린다(옛 캐시는 «없음» 취급)
export const OFFLINE_GRACE_MS = 5000;                        // 안전장치 ③ — 이만큼 버전이 안 오면 캐시를 먼저 보여 준다
export const LIVE_COALESCE_MIN_MS = 10 * 1000;               // 켜져 있는 동안 바뀜 — 10초 ~ 50초 사이에서 사람마다 흩는다
export const LIVE_COALESCE_SPREAD_MS = 40 * 1000;           // (수명 타이머 MIN_RECHECK_MS 보다 짧게)
const IDB_TIMEOUT_MS = 3000;                                 // IDB 가 막혀(다른 창이 버전 업그레이드 중 등) 안 열리면 기다리지 않는다
const MIN_RECHECK_MS = 60 * 1000;                            // 수명 타이머가 너무 촘촘히 돌지 않게

/* 버전은 서버 시각(ms) 양수만 인정한다 — 규칙 catalogMeta/$kind 도 같은 모양만 받는다.
   null(아직 없음) · 문자열 · 0 이하 · NaN 은 «버전 없음» = 안전장치 ① */
export function isCatalogVer(v){
  return typeof v === 'number' && isFinite(v) && v > 0;
}

function isCatalogData(d){
  return !!d && typeof d === 'object' && !Array.isArray(d);
}

/* 캐시 판정(순수 함수).
   'full'  — 버전이 없다 → 통째 구독(안전장치 ①)
   'cache' — 캐시를 그대로 쓴다
   'fetch' — 그 종류만 서버에서 다시 받는다
   캐시 시각이 미래(PC 시계를 되돌림)면 수명을 셀 수 없으니 낡은 것으로 본다. */
export function decideCatalogCache(entry, ver, now, maxAge){
  if(!isCatalogVer(ver)) return 'full';
  const lim = (typeof maxAge === 'number' && maxAge > 0) ? maxAge : CATALOG_CACHE_MAX_AGE_MS;
  if(!entry || typeof entry !== 'object') return 'fetch';
  if(entry.schema !== CATALOG_CACHE_SCHEMA) return 'fetch';
  if(entry.ver !== ver) return 'fetch';
  if(typeof entry.savedAt !== 'number' || !isFinite(entry.savedAt)) return 'fetch';
  const age = now - entry.savedAt;
  if(!(age >= 0) || age >= lim) return 'fetch';
  if(!isCatalogData(entry.data)) return 'fetch';
  return 'cache';
}

/* 안전장치 ③ — 버전을 모를 때 먼저 보여 줘도 되는 캐시인가. 수명은 보지 않는다(연결되면 다시 판정한다). */
export function usableOfflineCache(entry){
  return !!entry && typeof entry === 'object' && entry.schema === CATALOG_CACHE_SCHEMA &&
    isCatalogVer(entry.ver) && isCatalogData(entry.data);
}

/* IndexedDB 저장소 — { read(key) → 레코드|null, write(key, 레코드) → 성공 여부 }. 둘 다 reject 하지 않는다.
   app.js 의 GLB 캐시(tw-glb-cache)와 DB 를 나눈다 — 같이 쓰면 버전 업그레이드를 서로 맞춰야 한다. */
export function createIdbCatalogStore(idb){
  const DB_NAME = 'tw-catalog-cache', STORE = 'catalog';
  let opening = null;
  const withTimeout = (p) => new Promise(res => {
    let done = false;
    const t = setTimeout(() => { if(!done){ done = true; res(null); } }, IDB_TIMEOUT_MS);
    p.then(v => { if(!done){ done = true; clearTimeout(t); res(v); } },
           () => { if(!done){ done = true; clearTimeout(t); res(null); } });
  });
  const open = () => {
    if(opening) return opening;
    opening = withTimeout(new Promise((res) => {
      try{
        if(!idb) return res(null);
        const rq = idb.open(DB_NAME, 1);
        rq.onupgradeneeded = () => { try{ rq.result.createObjectStore(STORE, { keyPath: 'key' }); }catch(_){} };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
        rq.onblocked = () => res(null);
      }catch(_){ res(null); }
    }));
    return opening;
  };
  return {
    async read(key){
      const db = await open();
      if(!db) return null;
      return withTimeout(new Promise((res) => {
        try{
          const rq = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
          rq.onsuccess = () => res(rq.result || null);
          rq.onerror = () => res(null);
        }catch(_){ res(null); }
      }));
    },
    async write(key, rec){
      const db = await open();
      if(!db) return false;
      return withTimeout(new Promise((res) => {
        try{
          const tx = db.transaction(STORE, 'readwrite');
          /* put 은 부르는 순간 값을 복제한다. 넘겨받은 rec.data 는 화면에 넘기는 객체와 따로 뗀 것이어야 한다
             — 화면 쪽(resolveCatalogGlb)이 rec.glb 를 채워 넣으면 base64 가 캐시에 섞여 들어간다. */
          tx.objectStore(STORE).put(Object.assign({ key }, rec));
          tx.oncomplete = () => res(true);
          tx.onerror = () => res(false);
          tx.onabort = () => res(false);   // 용량 초과(QuotaExceededError)는 여기로 온다 — 캐시만 못 남길 뿐이다
        }catch(_){ res(false); }
      }));
    },
  };
}

/* 카탈로그 구독기 — subscribe(kind, onData) → 구독 해제 함수.
   deps
     metaRef(kind) · catalogRef(kind) — firebase-init.js 가 만든 ref(경로는 그쪽에 둔다 — audit 검사 7 이 보는 자리)
     onValue(ref, cb, errCb) → 해제 함수 · get(ref) → snapshot — Firebase 것 그대로
     store — { read, write } (기본: createIdbCatalogStore)
     scope — 캐시 키 앞머리(DB 주소)
     now · setTimer · clearTimer · maxAge · graceMs · random · warn — 검사에서 바꿔 끼운다 */
export function createCatalogSync(deps){
  const { metaRef, catalogRef, onValue, get } = deps;
  const store = deps.store || createIdbCatalogStore(typeof indexedDB !== 'undefined' ? indexedDB : null);
  const scope = String(deps.scope || '');
  const now = deps.now || (() => Date.now());
  const setTimer = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer || ((t) => clearTimeout(t));
  const maxAge = deps.maxAge || CATALOG_CACHE_MAX_AGE_MS;
  const graceMs = deps.graceMs || OFFLINE_GRACE_MS;
  const random = deps.random || Math.random;
  const warn = deps.warn || ((...a) => { try{ console.warn(...a); }catch(_){} });

  return function subscribe(kind, onData){
    const key = scope + '|' + kind;
    let stopped = false;
    let fullUnsub = null;        // 안전장치 ① 의 통째 구독 — 켜져 있을 때만 함수
    let metaUnsub = null;
    let metaSeen = false;        // 버전 구독이 한 번이라도 답했나(값 · 거부 모두)
    let seq = 0;                 // 판정이 겹치면(버전이 연달아 바뀜) 마지막 것만 반영
    let lastVer = null;
    let deliveredVer;            // 이미 화면에 넘긴 버전 — 같은 캐시를 두 번 넘기지 않는다
    let timer = null;
    let graceTimer = null;
    let liveTimer = null;

    const emit = (data) => { if(stopped) return; try{ onData(data); }catch(e){ warn('[catalog-cache] onData 오류', kind, e); } };
    const readCache = async () => { try{ return await store.read(key); }catch(_){ return null; } };   // 읽기 실패 = 캐시 없음
    const clearGrace = () => { if(graceTimer !== null){ clearTimer(graceTimer); graceTimer = null; } };
    const clearLive = () => { if(liveTimer !== null){ clearTimer(liveTimer); liveTimer = null; } };
    /* 버전이 바뀌었을 때 — 처음 답 · 버전 없음 · 통째 구독 중이면 바로, 켜져 있는 동안의 새 버전이면 모았다가.
       모으는 동안 또 바뀌면 타이머를 그대로 두고 그때의 마지막 버전(lastVer)으로 판정한다. */
    const onMeta = (ver, first) => {
      if(first || !isCatalogVer(ver) || fullUnsub || ver === deliveredVer){ clearLive(); evaluate(ver); return; }
      if(liveTimer !== null) return;
      const r = Number(random()) || 0;
      const wait = LIVE_COALESCE_MIN_MS + Math.floor(Math.min(Math.max(r, 0), 1) * LIVE_COALESCE_SPREAD_MS);
      liveTimer = setTimer(() => { liveTimer = null; evaluate(lastVer); }, wait);
    };
    const startFull = (why) => {
      if(fullUnsub || stopped) return;
      deliveredVer = undefined;
      warn('[catalog-cache] 버전 없이 통째 구독 —', kind, '(' + why + ')');
      try{
        fullUnsub = onValue(catalogRef(kind), snap => emit(snap.val() || {})) || (() => {});
      }catch(e){ warn('[catalog-cache] 통째 구독 실패', kind, e); }
    };
    const stopFull = () => { if(fullUnsub){ try{ fullUnsub(); }catch(_){} fullUnsub = null; } };
    const arm = (savedAt) => {
      if(timer !== null){ clearTimer(timer); timer = null; }
      if(stopped) return;
      const wait = Math.max(MIN_RECHECK_MS, savedAt + maxAge - now() + 1000);
      timer = setTimer(() => { timer = null; evaluate(lastVer); }, wait);
    };

    async function evaluate(ver){
      const my = ++seq;
      if(!isCatalogVer(ver)){
        if(timer !== null){ clearTimer(timer); timer = null; }   // 통째 구독은 실시간이라 수명 타이머가 필요 없다
        startFull(ver == null ? 'catalogMeta 없음' : '버전 형식 아님');
        return;
      }
      const entry = await readCache();
      if(my !== seq || stopped) return;
      const d = decideCatalogCache(entry, ver, now(), maxAge);
      if(d === 'cache'){
        stopFull();
        if(deliveredVer !== ver){ deliveredVer = ver; emit(entry.data); }
        arm(entry.savedAt);
        return;
      }
      /* get 은 한 번 받고 끝이라 구독 비용이 안 남는다 — 그 뒤 바뀜은 버전 구독이 알려 준다. */
      let snap;
      try{ snap = await get(catalogRef(kind)); }
      catch(e){
        if(my !== seq || stopped) return;
        warn('[catalog-cache] 받기 실패 —', kind, e && (e.code || e.message));
        startFull('get 실패');   // 연결되면 onValue 가 알아서 채운다
        return;
      }
      if(my !== seq || stopped) return;
      stopFull();
      const t = now();
      /* snap.val() 은 부를 때마다 새 객체를 만든다 — 캐시용과 화면용을 따로 뗀다(위 write 주석). */
      try{ Promise.resolve(store.write(key, { schema: CATALOG_CACHE_SCHEMA, ver, savedAt: t, data: snap.val() || {} })).catch(() => {}); }catch(_){}
      deliveredVer = ver;
      emit(snap.val() || {});
      arm(t);
    }

    /* 안전장치 ③ — 버전이 늦으면(오프라인) 캐시를 먼저. 그 뒤 버전이 오면 evaluate 가 다시 판정한다
       (같은 버전 · 수명 안이면 deliveredVer 가 같아 두 번 넘기지 않는다). */
    graceTimer = setTimer(async () => {
      graceTimer = null;
      if(metaSeen || stopped) return;
      const entry = await readCache();
      if(metaSeen || stopped || fullUnsub || deliveredVer !== undefined) return;
      if(!usableOfflineCache(entry)) return;
      warn('[catalog-cache] 버전 확인이 늦어 캐시를 먼저 보여 준다 —', kind);
      deliveredVer = entry.ver;
      emit(entry.data);
    }, graceMs);

    try{
      metaUnsub = onValue(metaRef(kind),
        snap => { if(stopped) return; const first = !metaSeen; metaSeen = true; clearGrace(); lastVer = snap.val(); onMeta(lastVer, first); },
        err => { if(stopped) return; metaSeen = true; clearGrace(); clearLive(); seq++; startFull('catalogMeta 구독 거부: ' + ((err && (err.code || err.message)) || '?')); }
      ) || (() => {});
    }catch(e){ clearGrace(); startFull('catalogMeta 구독 실패'); }

    return () => {
      stopped = true; seq++;
      clearGrace(); clearLive();
      if(timer !== null){ clearTimer(timer); timer = null; }
      try{ metaUnsub && metaUnsub(); }catch(_){}
      stopFull();
    };
  };
}
