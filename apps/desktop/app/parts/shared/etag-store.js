/* etag-store.js — 🏷️ ETag 기억을 껐다 켜도 남게 — IndexedDB(tw-etag-cache) 에 열쇠별 { etag, data } (검사 sim-etag-store.js)
   [왜] api-client.js 는 읽기의 ETag 와 값을 메모리에 기억해 다음 읽기에 If-None-Match 를 싣는다. 메모리라 켤 때마다 비어서
     켤 때의 읽기(설정 · 공지 · 카탈로그 · 옷장 · 보유분 · 포커스 · 친구 · 플레이리스트)가 늘 본문 전체를 받았다. 여기 두면 켤 때도 304 를 받는다.
   [무엇을] 서버가 «안 바뀜(304)» 이라고 답할 때만 이 값을 쓴다 — 서버에 묻기 전에 이 값으로 화면을 그리지 않는다(값의 주인은 서버).
     열쇠는 api-client 의 ETag 열쇠 그대로(«누구(토큰 sub) + 경로») — 다른 계정의 값을 돌려주지 않는다. 계정을 놓으면 통째로 지운다(clear).
   [못 쓰면] IndexedDB 가 없거나 막히면(열기 실패 · onblocked · OPEN_MS 넘김) load 는 null · save · clear 는 조용히 — 그때는 예전처럼 메모리 기억만. 못 연 뒤에는 다음 부름에 다시 연다.
   deps: indexedDB(없으면 window 것) · now()(검사용)
   내놓는 것: load(key) → Promise<{ etag, data } | null> · save(key, etag, data) · clear() · MAX(줄 수 상한 — 넘으면 오래된 것부터 지운다)
   classic script(window.TwEtagStore) — api-client.js 보다 먼저 싣는다. 도메인을 모른다. */
(function(){
'use strict';

const DB_NAME = 'tw-etag-cache', STORE = 'etag';
const MAX = 64;   // api-client ETAG_MAX 와 같은 크기 — 켤 때 읽는 길은 열 개 남짓
const OPEN_MS = 1000;   // DB 열기 상한 — 넘거나 막히면(onblocked) 이번엔 없는 것으로 보고 다음 부름에 다시 연다

/** @param {{ indexedDB?: IDBFactory, now?: () => number }} [deps] */
function createEtagStore(deps){
  const d = deps || {};
  const idb = d.indexedDB || (typeof window !== 'undefined' ? window.indexedDB : null);
  const now = d.now || (() => Date.now());
  let dbP = null;
  function db(){
    if(dbP) return dbP;
    const p = dbP = new Promise((res) => {
      let done = false;
      const ok = (x) => { if(done) return; done = true; res(x); };
      const fail = () => { if(done) return; done = true; if(dbP === p) dbP = null; res(null); };   // 못 열었으면 다음 부름에 다시 연다
      try{
        if(!idb) return ok(null);
        const rq = idb.open(DB_NAME, 1);
        rq.onupgradeneeded = () => { try{ rq.result.createObjectStore(STORE, { keyPath: 'k' }); }catch(_){} };
        rq.onsuccess = () => ok(rq.result);
        rq.onerror = fail;
        rq.onblocked = fail;
        try{ AbortSignal.timeout(OPEN_MS).addEventListener('abort', fail, { once: true }); }catch(_){}
      }catch(_){ fail(); }
    });
    return dbP;
  }
  function tx(mode, fn){
    return db().then((x) => new Promise((res) => {
      if(!x) return res(null);
      try{ fn(x.transaction(STORE, mode).objectStore(STORE), res); }catch(_){ res(null); }
    })).catch(() => null);
  }
  function load(key){
    return tx('readonly', (st, res) => {
      const rq = st.get(key);
      rq.onsuccess = () => { const v = rq.result; res(v && typeof v.etag === 'string' && v.etag ? { etag: v.etag, data: v.data } : null); };
      rq.onerror = () => res(null);
    });
  }
  /* 넣고, 상한을 넘으면 오래 안 쓴 것(ts)부터 지운다 */
  function save(key, etag, data){
    return tx('readwrite', (st, res) => {
      try{ st.put({ k: key, etag, data, ts: now() }); }catch(_){ return res(null); }
      const all = st.getAll();
      all.onsuccess = () => {
        const rows = (all.result || []).sort((a, b) => (a.ts || 0) - (b.ts || 0));
        for(let i = 0; i < rows.length - MAX; i++){ try{ st.delete(rows[i].k); }catch(_){} }
        res(null);
      };
      all.onerror = () => res(null);
    });
  }
  function clear(){
    return tx('readwrite', (st, res) => { try{ const rq = st.clear(); rq.onsuccess = rq.onerror = () => res(null); }catch(_){ res(null); } });
  }
  return { load, save, clear };
}

const api = { DB_NAME, STORE, MAX, OPEN_MS, createEtagStore };
if(typeof window !== 'undefined') window.TwEtagStore = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
