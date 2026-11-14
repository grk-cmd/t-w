/* gift-box.js — 🎁 선물 상태 주인 — 내 선물함(받기 · ⭐ · 치움 · 지우기 · 봤음 · 서버 신호) · 그 집에 나온 선물 받기 (검사 sim-gift-box.js)
   책임: 선물함의 «원본은 서버» — 앱은 받아서 보여 주고, 고치면 서버에 한 건씩 보낸다(⭐ · 치움 · 지우기는 동작 하나 = 요청 하나). 화면(mallang.js · myhome-inbox.js)은
     값을 직접 고치지 않고 pull · openTab · star · hide · remove · seen 을 부른다. 순서(⭐ 먼저 → 최신순)는 order() 한 곳이다.
   한 줄(lane): 받기 · ⭐ · 치움 · 지우기 · 봤음은 앞 일이 끝난 뒤에 하나씩 돈다 — 받는 사이 ⭐ 가 순서를 바꾸거나 쓰는 사이 받은 판이 바뀌는 엇갈림이 없다.
     대상은 줄에서 차례가 왔을 때 id 로 다시 찾는다(없으면 «이미 없는 선물이에요» + 받기 한 번). 일마다 시작할 때의 gen 을 쥐고, 계정을 놓으면(reset) 아무것도 적지 않고 끝난다.
   busy: 같은 선물에 일이 줄에 있으면(⭐ 연타 · 지우는 중 다시 부르기) 새 일은 요청 없이 'busy' — 칸이 흐려지고 안내는 없다(isBusy). 다른 선물은 줄에 선다.
   받기 합치기: 줄에 서서 아직 시작 안 한 받기가 있으면 그 하나로 합친다(신호 몰림 · 서브탭 연타). 받는 중에 부르면 끝난 뒤 한 번 더 받는다(줄에 선다).
   서브탭: openTab() = 받기 → 성공하고 안 본 선물이 있으면 봤음(같은 줄에 차례로 — 봤음이 먼저 끝나 받기 답이 배지를 다시 켜지 않게). 봤음 실패는 번호 없이 배지를 남긴다(다음 누름에 한 번).
   신호: listen() 이 서버 알림 `gifts` 를 건다 — 선물함이 idle 이 아니면 받기 한 번(번호 없음). idle 이면 요청 0 · reset 뒤엔 구독을 풀어 요청 0.
   실패: 받기는 사용자가 누른 받기(notify)만 E-GIFT-04 · ⭐ · 치움은 E-GIFT-05 · 지우기는 E-GIFT-06. 안내 코드(GIFT_STAR_FULL · GIFT_STARRED · GIFT_NOT_FOUND)는 번호 없이 안내.
     혼자 다시 보내지 않는다. 계정이 바뀌는 중(OWNER_CHANGED · 받기 전)은 조용히 버린다.
   값: 받기 전엔 숫자가 null(모름 — 0 과 가른다). 계정 키 없음 — 서버가 원본이라 이 PC 에 적지 않는다.
   deps: api — createGiftApi 가 돌려준 것(gift-api.js — fetchBox · markSeen · star · hide · remove · fetchVisible · reset)
         giftLib — TwGiftApi(failOf · KIND · ERRORS) · errs — TwApiErrors · apiErrors — TwApiErrors.store(공통 code 번호 알림) · notifyError — TwErrorCodes.notify · toast(msg) · rtOn(kind, fn) → 해제 함수
   내보냄: createGiftBox(deps) → {
     box() → { load, items:[{ id, senderName, imageUrl, message, starred, hidden, sentAt(ms) }], unseenCount, starCount, boxKeep, starMax } (복사본 · 숫자는 받기 전 null)
     get(id) → 한 줄 복사본 | null · isBusy(id) · onChange(fn) → 해제 함수 · order(items) — 순수(⭐ 먼저 → 최신순)
     pull(notify?) → Promise<'ready'|'failed'|'stale'> · openTab() → 같은 값(받기 뒤 봤음) · seen() → 'ok'|'failed'|'stale'
     star(id, on) → 'ok'|'busy'|'gone'|'full'|'guide'|'failed'|'stale' · hide(id, on) → 'ok'|'busy'|'gone'|'guide'|'failed'|'stale' · remove(id) → 'ok'|'busy'|'gone'|'starred'|'guide'|'failed'|'stale'
     fetchVisible(code, { notify }?) → Promise<{ ok:true, items, visibleCount, recipientCap } | { ok:false, kind }> — 그 집에 나온 선물(저장 안 함)
     listen() → 해제 함수(서버 신호) · reset() · LOAD · MSG
   }
   ⚠️ 상한(⭐ 20 · 보관 30)은 서버 응답(starMax · boxKeep)이다 — 여기 다시 적지 않는다.
   검사: checks/sim-gift-box.js */
(function(){
'use strict';

const LOAD = Object.freeze({ IDLE: 'idle', LOADING: 'loading', READY: 'ready', FAILED: 'failed' });
const MSG = Object.freeze({
  gone: '이미 없는 선물이에요',
  starFull: (max) => '즐겨찾기는 ' + max + '개까지예요',
  starred: '즐겨찾기한 선물은 지울 수 없어요 — ⭐ 를 먼저 풀어 주세요',
});

/** @param {{
 *   api: { fetchBox: Function, markSeen: Function, star: Function, hide: Function, remove: Function, fetchVisible: Function, reset: Function },
 *   giftLib: { failOf: Function, KIND: Record<string, string>, ERRORS: object },
 *   errs: object, apiErrors: { notify: Function }, notifyError: (code: string, err?: any) => boolean, toast: (msg: string) => void,
 *   rtOn: (kind: string, fn: Function) => Function,
 * }} deps */
function createGiftBox(deps){
  const api = deps.api;
  const giftLib = deps.giftLib;
  const errs = deps.errs;
  const apiErrors = deps.apiErrors;
  const notifyError = deps.notifyError;
  const toast = deps.toast;
  const rtOn = deps.rtOn;
  const KIND = giftLib.KIND;

  const subs = [];
  let gen = 0;   // reset 마다 오른다 — 앞 계정의 늦은 답이 새 계정 상태를 고치지 않게
  const st = { load: LOAD.IDLE, items: [], unseenCount: null, starCount: null, boxKeep: null, starMax: null };
  const busy = new Set();
  let laneTail = Promise.resolve();
  const inLane = (job) => { const p = laneTail.then(job); laneTail = p.catch(() => {}); return p; };
  let queued = null, queuedNotify = false;   // 줄에 서서 아직 시작하지 않은 받기
  let unsub = null;

  function emit(){
    for(const fn of subs.slice()){ try{ fn(); }catch(err){ console.warn('[선물함] 받는 쪽 처리 실패', err); } }
  }
  const failOf = (e) => giftLib.failOf(e, errs);
  const find = (id) => st.items.find((x) => x.id === id);
  const recount = () => { st.starCount = st.items.filter((x) => x.starred).length; };

  /* 그 자리 번호 — 부르는 곳마다 하나(번호는 글자 그대로 — sim-error-codes 가 찾는다) */
  const SITE = Object.freeze({
    pull: (e) => notifyError('E-GIFT-04', e),     // 선물함 받기(마이홈 열기 · 서브탭 · [다시 시도])
    change: (e) => notifyError('E-GIFT-05', e),   // ⭐ · 치움 · 다시 부르기
    remove: (e) => notifyError('E-GIFT-06', e),   // 삭제
    visit: (e) => notifyError('E-GIFT-09', e),    // 그 집 선물 받기(집 옮기기)
  });
  /* 실패 하나를 알린다 — 계정이 바뀌는 중(stale)은 조용히 · 공통 code 는 공통 번호 · 그 밖은 그 자리 번호. @return failOf 결과 */
  function report(e, site){
    const f = failOf(e);
    if(f.kind === KIND.STALE) return f;
    if(f.kind === KIND.COMMON) apiErrors.notify(e, giftLib.ERRORS);
    else SITE[site](e);
    return f;
  }

  /* 선물함 순서 — ⭐(최신순) → 나머지(최신순). 같은 시각이면 받은 차례를 그대로(정렬이 안정적이다). 순수 함수 */
  function order(items){
    const list = (items || []).slice();
    const byNew = (a, b) => (b.sentAt || 0) - (a.sentAt || 0);
    return list.filter((x) => x.starred).sort(byNew).concat(list.filter((x) => !x.starred).sort(byNew));
  }

  /* ── 받기 ── */
  function pull(notify){
    if(queued){ if(notify) queuedNotify = true; return queued; }
    if(notify) queuedNotify = true;
    if(st.load !== LOAD.READY && st.load !== LOAD.LOADING){ st.load = LOAD.LOADING; emit(); }
    const g = gen;
    queued = inLane(async () => {
      if(g !== gen) return 'stale';   // 옛 계정의 줄에 남은 받기 — 새 계정의 줄에 선 받기 표시(queued)를 건드리지 않는다
      const n = queuedNotify;
      queued = null; queuedNotify = false;
      return runPull(n, g);
    });
    return queued;
  }
  async function runPull(notify, g){
    let got;
    try{ got = await api.fetchBox(); }
    catch(e){
      if(g !== gen) return 'stale';
      if(st.load === LOAD.LOADING) st.load = LOAD.FAILED;
      if(notify) report(e, 'pull');
      emit();
      return 'failed';
    }
    if(g !== gen) return 'stale';
    st.items = got.items; st.unseenCount = got.unseenCount; st.starCount = got.starCount; st.boxKeep = got.boxKeep; st.starMax = got.starMax;
    st.load = LOAD.READY;
    emit();
    return 'ready';
  }

  /* 서브탭 — 받기 → 성공하고 안 본 선물이 있으면 봤음 */
  async function openTab(){
    const r = await pull(true);
    if(r === 'ready' && st.unseenCount > 0) await seen();
    return r;
  }
  function seen(){
    const g = gen;
    return inLane(async () => {
      if(g !== gen) return 'stale';
      try{ await api.markSeen(); }
      catch(e){ if(g === gen) console.warn('[선물함] 봤음 실패 — 배지는 남고 다음 누름에 한 번', e && (e.code || e.message)); return g !== gen ? 'stale' : 'failed'; }
      if(g !== gen) return 'stale';
      st.unseenCount = 0;
      emit();
      return 'ok';
    });
  }

  /* ── 한 건 쓰기 ── 같은 id 가 줄에 있으면 busy · 대상은 줄에서 차례가 왔을 때 다시 찾는다 */
  function act(id, run){
    if(busy.has(id)) return Promise.resolve('busy');
    busy.add(id);
    emit();
    const g = gen;
    return inLane(async () => {
      try{ return g !== gen ? 'stale' : await run(g); }
      finally{ if(g === gen){ busy.delete(id); emit(); } }
    });
  }
  function gone(){
    toast(MSG.gone);
    pull(false);   // 줄에 서서 한 번 — 이 일 뒤에 돈다
    return 'gone';
  }
  /* 쓰기 실패 하나 → 반환값. 안내(번호 없음) · 이미 없음 · 번호 */
  function failed(e, site){
    const f = failOf(e);
    if(f.kind === KIND.STALE) return 'stale';
    if(f.kind === KIND.GONE) return gone();
    if(f.kind === KIND.GUIDE){
      if(f.code === 'GIFT_STAR_FULL') toast(MSG.starFull(st.starMax != null ? st.starMax : ''));
      else if(f.code === 'GIFT_STARRED') toast(MSG.starred);
      else if(f.message) toast(f.message);   // 서버 문구
      if(f.code === 'GIFT_STARRED' || f.code === 'GIFT_STAR_FULL') pull(false);   // 화면이 서버와 어긋났다 — 한 번 맞춘다
      return f.code === 'GIFT_STARRED' ? 'starred' : (f.code === 'GIFT_STAR_FULL' ? 'full' : 'guide');
    }
    report(e, site);
    return 'failed';
  }

  function star(id, on){
    return act(id, async (g) => {
      const it = find(id);
      if(!it) return gone();
      if(on && !it.starred && st.starMax != null && st.starCount >= st.starMax){ toast(MSG.starFull(st.starMax)); return 'full'; }
      try{ await api.star(id, !!on); }
      catch(e){ return g !== gen ? 'stale' : failed(e, 'change'); }
      if(g !== gen) return 'stale';
      const cur = find(id);
      if(cur){ cur.starred = !!on; recount(); }
      return 'ok';
    });
  }
  function hide(id, on){
    return act(id, async (g) => {
      if(!find(id)) return gone();
      try{ await api.hide(id, !!on); }
      catch(e){ return g !== gen ? 'stale' : failed(e, 'change'); }
      if(g !== gen) return 'stale';
      const cur = find(id);
      if(cur) cur.hidden = !!on;
      return 'ok';
    });
  }
  function remove(id){
    return act(id, async (g) => {
      const it = find(id);
      if(!it) return gone();
      if(it.starred){ toast(MSG.starred); return 'starred'; }   // 확인창이 미리 막지만 여기서 한 번 더 — ⭐ 는 요청 없이 막는다
      try{ await api.remove(id); }
      catch(e){ return g !== gen ? 'stale' : failed(e, 'remove'); }
      if(g !== gen) return 'stale';
      st.items = st.items.filter((x) => x.id !== id);
      recount();
      return 'ok';
    });
  }

  /* ── 그 집에 나온 선물 ── 저장하지 않는다(집을 옮기면 버린다). 못 받으면 번호는 부르는 쪽이 정한다(notify) */
  async function fetchVisible(code, opts){
    const g = gen;
    try{
      const got = await api.fetchVisible(code);
      if(g !== gen) return { ok: false, kind: KIND.STALE };
      return { ok: true, items: got.items, visibleCount: got.visibleCount, recipientCap: got.recipientCap };
    }catch(e){
      if(g !== gen) return { ok: false, kind: KIND.STALE };
      const f = failOf(e);
      if(f.kind === KIND.MISSING) return { ok: false, kind: f.kind };   // 없는 사람 — 번호 없이 «선물 없음»
      if(opts && opts.notify) report(e, 'visit');
      return { ok: false, kind: f.kind };
    }
  }

  /* 서버 신호 `gifts` — 선물함이 idle 이 아닐 때만 받기 한 번(번호 없음). 해제 함수는 부르는 쪽(세션)이 들고 있고, reset 도 푼다 */
  function listen(){
    if(unsub) return unsub;
    const off = rtOn('gifts', () => { if(st.load !== LOAD.IDLE) pull(false); });
    unsub = () => { off(); if(unsub) unsub = null; };
    return unsub;
  }

  function reset(){
    gen++;
    api.reset();
    st.load = LOAD.IDLE; st.items = []; st.unseenCount = null; st.starCount = null; st.boxKeep = null; st.starMax = null;
    busy.clear();
    queued = null; queuedNotify = false;
    laneTail = Promise.resolve();   // 옛 계정 일은 gen 이 달라 스스로 끝난다 — 새 계정 일은 그것을 기다리지 않는다
    if(unsub) unsub();
    emit();
  }

  return {
    box: () => ({ load: st.load, items: st.items.map((x) => Object.assign({}, x)), unseenCount: st.unseenCount, starCount: st.starCount, boxKeep: st.boxKeep, starMax: st.starMax }),
    get: (id) => { const it = find(id); return it ? Object.assign({}, it) : null; },
    isBusy: (id) => busy.has(id),
    onChange(fn){ subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    order, pull, openTab, seen, star, hide, remove, fetchVisible, listen, reset,
    LOAD, MSG,
  };
}

const api = { createGiftBox, LOAD, MSG };
if(typeof window !== 'undefined') window.TwGiftBox = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
