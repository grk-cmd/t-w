/* gift-box.js — 🎁 선물 상태 주인 — 내 선물함(받기 · ⭐ · 치움 · 지우기 · 봤음 · 서버 신호) · 그 집에 나온 선물 받기 (검사 sim-gift-box.js)
   책임: 선물함의 «원본은 서버» — 앱은 받아서 보여 주고, 고치면 서버에 한 건씩 보낸다(⭐ · 치움 · 지우기는 동작 하나 = 요청 하나). 화면(mallang.js · myhome-inbox.js)은
     값을 직접 고치지 않고 pull · openTab · star · hide · remove · seen 을 부른다. 순서(⭐ 먼저 → 최신순)는 order() 한 곳이다.
   한 줄(lane): 받기 · ⭐ · 치움 · 지우기 · 봤음은 앞 일이 끝난 뒤에 하나씩 돈다 — 받는 사이 ⭐ 가 순서를 바꾸거나 쓰는 사이 받은 판이 바뀌는 엇갈림이 없다.
     대상은 줄에서 차례가 왔을 때 id 로 다시 찾는다(없으면 «이미 없는 선물이에요» + 받기 한 번). 일마다 시작할 때의 gen 을 쥐고, 계정을 놓으면(reset) 아무것도 적지 않고 끝난다.
   pending: 같은 선물에 일이 줄에 있으면(⭐ 연타 · 지우는 중 다시 부르기) 새 일은 요청 없이 'busy' — 칸이 흐려지고 안내는 없다(isBusy). 다른 선물은 줄에 선다.
     pending 은 id → 하는 일('hide' · 'show' · 'star' · 'remove') — 일이 끝나면(성공 · 실패 모두) 지운다.
   🎁 마이홈 화면(stage): «내 선물 중 무엇이 화면에 나와야 하나» 는 이 모듈 하나가 정한다(onScreen). mallang.js 는 그 목록을 그리기만 하고 선물 id 를 따로 들지 않는다.
     onScreen() = 받은 줄에서 치우지 않은 것 + 치우는 중(pending hide)이 아닌 것. 마이홈이 눈앞(enterHome)이고 그 뒤 받기가 한 번 성공(fresh)해야 목록이 있고, 아니면 빈 목록이다.
     낙관(요청 전에 화면을 바꿈)은 치움 하나뿐 — 다시 부르기 · ⭐ · 지우기는 성공해야 바꾼다. 안 되는 답(실패 · 안내)은 일을 지우기만 하면 목록이 서버 값으로 돌아간다(손으로 다시 띄우지 않는다).
     선물 PATCH · DELETE 에는 판(version)이 없다 — 409 길이 없다. GIFT_NOT_FOUND → 안내 + 받기 한 번.
     화면 자리(상한 MAX_LIVE)는 화면의 사실이다 — mallang.js 가 attachScreen({ room(), has(id) }) 로 한 번 알려 준다. 못 들어간 선물은 «나와야 함» 으로 남고 다음 emit 에 다시 시도한다(보정 요청 없음).
   받기 합치기: 줄에 서서 아직 시작 안 한 받기가 있으면 그 하나로 합친다(신호 몰림 · 서브탭 연타). 받는 중에 부르면 끝난 뒤 한 번 더 받는다(줄에 선다).
   서브탭: openTab() = 받기 → 성공하고 안 본 선물이 있으면 봤음(같은 줄에 차례로 — 봤음이 먼저 끝나 받기 답이 배지를 다시 켜지 않게). 봤음 실패는 번호 없이 배지를 남긴다(다음 누름에 한 번).
   보내기: send(code, { mallang, message }) — 본문 {requestId, imageUrl, message?} 만(누른 그림의 주소 — 칸 번호는 보내지 않는다 · 보낸 사람 · 이름 · 날짜는 서버가 토큰에서). requestId 는 받는 사람 코드마다 하나(TwRequestId pending ·
     닿지 못했으면 같은 번호로 다시 · 서버가 거절했으면(4xx) 새 번호). 한 줄(lane)에 서지 않는다 — 누름 하나 = 요청 하나(화면이 보내는 동안 격자 전체를 잠근다).
     오늘 보낸 수: fetchSentToday() — 못 받으면 {ok:false}(막지 않고 «확인하지 못했어요»).
   신호: listen() 이 서버 알림 `gifts` 를 건다 — 선물함이 idle 이 아니면 받기 한 번(번호 없음). idle 이면 요청 0 · reset 뒤엔 구독을 풀어 요청 0.
   실패: 받기는 사용자가 누른 받기(notify)만 E-GIFT-04 · ⭐ · 치움은 E-GIFT-05 · 지우기는 E-GIFT-06. 안내 코드(GIFT_STAR_FULL · GIFT_STARRED · GIFT_NOT_FOUND)는 번호 없이 안내.
     혼자 다시 보내지 않는다. 계정이 바뀌는 중(OWNER_CHANGED · 받기 전)은 조용히 버린다.
   값: 받기 전엔 숫자가 null(모름 — 0 과 가른다). 계정 키 없음 — 서버가 원본이라 이 PC 에 적지 않는다.
   deps: api — createGiftApi 가 돌려준 것(gift-api.js — fetchBox · markSeen · star · hide · remove · fetchVisible · reset)
         giftLib — TwGiftApi(failOf · KIND · ERRORS · LIMITS) · requestIds — TwRequestId.createPending()(idFor · settle) · errs — TwApiErrors · apiErrors — TwApiErrors.store(공통 code 번호 알림) · notifyError — TwErrorCodes.notify · toast(msg) · rtOn(kind, fn) → 해제 함수
   내보냄: createGiftBox(deps) → {
     box() → { load, items:[{ id, senderName, imageUrl, message, starred, hidden, sentAt(ms) }], unseenCount, starCount, boxKeep, starMax } (복사본 · 숫자는 받기 전 null)
     get(id) → 한 줄 복사본 | null · isBusy(id) · onChange(fn) → 해제 함수 · order(items) — 순수(⭐ 먼저 → 최신순)
     attachScreen({ room(), has(id) }) · enterHome() → Promise(받기) · leaveHome() · onScreen() → [{ id, imageUrl, message }]
     pull(notify?) → Promise<'ready'|'failed'|'stale'> · openTab() → 같은 값(받기 뒤 봤음) · seen() → 'ok'|'failed'|'stale'
     star(id, on) → 'ok'|'busy'|'gone'|'full'|'guide'|'failed'|'stale' · remove(id) → 'ok'|'busy'|'gone'|'starred'|'guide'|'failed'|'stale'
     hide(id) → 'ok'|'busy'|'gone'|'guide'|'failed'|'stale' · show(id) → 'ok'|'busy'|'gone'|'already'|'full'|'guide'|'failed'|'stale'
     fetchSentToday() → Promise<{ ok:true, count, dailyMax } | { ok:false }> · send(code, { mallang, message }) → Promise<{ ok:true, sentToday, dailyMax } | { ok:false, kind:'guide'|'failed'|'changed'|'stale', message }>
     fetchVisible(code, { notify }?) → Promise<{ ok:true, items, visibleCount, recipientCap } | { ok:false, kind }> — 그 집에 나온 선물(저장 안 함)
     listen() → 해제 함수(서버 신호) · reset() · LOAD · MSG · MESSAGE_MAX(서버 상한)
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
 *   rtOn: (kind: string, fn: Function) => Function, requestIds: { idFor: (key: string) => string, settle: (key: string) => void },
 * }} deps */
function createGiftBox(deps){
  const api = deps.api;
  const giftLib = deps.giftLib;
  const errs = deps.errs;
  const apiErrors = deps.apiErrors;
  const notifyError = deps.notifyError;
  const toast = deps.toast;
  const rtOn = deps.rtOn;
  const requestIds = deps.requestIds;
  const KIND = giftLib.KIND;

  const subs = [];
  let gen = 0;   // reset 마다 오른다 — 앞 계정의 늦은 답이 새 계정 상태를 고치지 않게
  const st = { load: LOAD.IDLE, items: [], unseenCount: null, starCount: null, boxKeep: null, starMax: null };
  let pending = new Map();   // id → 'hide' | 'show' | 'star' | 'remove' — 줄에 선 일(reset 이 새 Map 으로 바꾼다)
  const stage = { on: false, fresh: false };   // 마이홈이 눈앞인가 · 들어온 뒤 받기가 한 번 성공했나
  let homeSeq = 0;   // enterHome 마다 오른다 — 들어오기 전에 시작한 받기는 fresh 로 치지 않는다
  let screen = { room: () => Infinity, has: () => false };   // 화면 자리(mallang.js 가 attachScreen 으로 바꾼다)
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
    send: (e) => notifyError('E-GIFT-08', e),     // 선물 보내기
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
    const hs = homeSeq;
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
    if(stage.on && hs === homeSeq) stage.fresh = true;
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

  /* ── 한 건 쓰기 ── 같은 id 가 줄에 있으면 busy · 대상은 줄에서 차례가 왔을 때 다시 찾는다 · op 는 pending 에 적는다(치움만 화면을 먼저 바꾼다) */
  function act(id, op, run){
    if(pending.has(id)) return Promise.resolve('busy');
    pending.set(id, op);
    emit();
    const g = gen;
    return inLane(async () => {
      try{ return g !== gen ? 'stale' : await run(g); }
      finally{ if(g === gen){ pending.delete(id); emit(); } }   // 옛 계정의 일은 새 pending 을 건드리지 않는다
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
    return act(id, 'star', async (g) => {
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
  /* 치움 — 누르는 즉시 화면에서 빠지고(pending hide) 서버가 받으면 hidden. 안 되면 일만 지워 서버 값으로 돌아간다 */
  function hide(id){
    return act(id, 'hide', async (g) => {
      if(!find(id)) return gone();
      try{ await api.hide(id, true); }
      catch(e){ return g !== gen ? 'stale' : failed(e, 'change'); }
      if(g !== gen) return 'stale';
      const cur = find(id);
      if(cur) cur.hidden = true;
      return 'ok';
    });
  }
  const live = () => stage.on && stage.fresh;
  /* 다시 부르기 — 서버가 «나옴» 으로 받아야(성공) 화면에 뜬다. 순서: 일 중 → 없음 → 이미 화면 → 안 치운 것 → 자리 없음(요청 0) → 서버
     @return 'ok'(화면에 뜸 · 마이홈 밖이면 돌아올 때 뜸) | 'already' | 'full'(화면 자리 없음) | 'busy' | 'gone' | 'guide' | 'failed' | 'stale' */
  function show(id){
    if(pending.has(id)) return Promise.resolve('busy');
    const it = find(id);
    if(!it) return Promise.resolve(gone());
    if(stage.on && screen.has(id)) return Promise.resolve('already');
    if(!it.hidden){
      if(!live()) return Promise.resolve('already');   // 마이홈 밖이거나 아직 받는 중 — 이미 «나옴» 이다
      emit();   // 전에 자리가 없어 못 뜬 것 — 다시 시도
      return Promise.resolve(screen.has(id) ? 'ok' : 'full');
    }
    if(stage.on && screen.room() <= 0) return Promise.resolve('full');   // 서버를 «나옴» 으로 바꿔 놓고 화면에 안 뜨는 일이 없게 — 요청 0
    return act(id, 'show', async (g) => {
      if(!find(id)) return gone();
      try{ await api.hide(id, false); }
      catch(e){ return g !== gen ? 'stale' : failed(e, 'change'); }
      if(g !== gen) return 'stale';
      const cur = find(id);
      if(cur) cur.hidden = false;
      emit();   // 화면이 이 선물을 그린다
      return live() && !screen.has(id) ? 'full' : 'ok';   // 기다리는 사이 화면이 찼다 — 서버는 «나옴» 그대로, 다음 emit 에 뜬다
    });
  }
  function remove(id){
    return act(id, 'remove', async (g) => {
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

  /* ── 🏠 화면 ── 마이홈이 눈앞인 동안만 내 선물이 화면에 나온다 */
  function attachScreen(s){ screen = { room: s.room, has: s.has }; }
  function enterHome(){
    homeSeq++;
    stage.on = true; stage.fresh = false;
    emit();
    return pull(true);   // 이 받기가 성공해야 목록이 생긴다
  }
  function leaveHome(){
    stage.on = false; stage.fresh = false;
    emit();
  }
  /* 화면에 나와야 할 내 선물 — 마이홈이 눈앞이고 받기가 성공한 뒤에만. 치우는 중인 것은 뺀다 */
  function onScreen(){
    if(!live()) return [];
    return st.items.filter((x) => !x.hidden && pending.get(x.id) !== 'hide').map((x) => ({ id: x.id, imageUrl: x.imageUrl, message: x.message }));
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

  /* ── 보내기 ── */
  async function fetchSentToday(){
    const g = gen;
    try{
      const got = await api.fetchSentToday();
      return g !== gen ? { ok: false } : { ok: true, count: got.count, dailyMax: got.dailyMax };
    }catch(e){ return { ok: false }; }   // 막지 않는다 — 부르는 쪽이 «확인하지 못했어요» 만 적는다(판정은 서버)
  }
  async function send(code, o){
    const g = gen;
    const key = 'gift:' + code;
    try{
      const got = await api.send(code, { requestId: requestIds.idFor(key), mallang: o && o.mallang, message: o && o.message });
      requestIds.settle(key);
      return g !== gen ? { ok: false, kind: 'stale', message: '' } : { ok: true, sentToday: got.sentToday, dailyMax: got.dailyMax };
    }catch(e){
      if(g !== gen) return { ok: false, kind: 'stale', message: '' };
      const status = e && e.status;
      if(typeof status === 'number' && status >= 400 && status < 500) requestIds.settle(key);   // 서버가 답했다(거절) — 다음엔 새 번호. 닿지 못했거나 5xx 는 같은 번호로 다시
      const f = failOf(e);
      if(f.kind === KIND.STALE) return { ok: false, kind: 'stale', message: '' };
      if(f.kind === KIND.GUIDE) return { ok: false, kind: 'guide', message: f.message };   // 서버 문구(숫자가 들어 있다) — 번호 없음
      report(e, 'send');   // GIFT_SLOT_CHANGED 도 같은 번호(E-GIFT-08) — 칸 다시 받기는 화면이 'changed' 를 보고 한다
      return { ok: false, kind: f.code === 'GIFT_SLOT_CHANGED' ? 'changed' : 'failed', message: '' };
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
    pending = new Map();   // 옛 계정 일의 finally 는 gen 이 달라 새 Map 을 건드리지 않는다
    stage.on = false; stage.fresh = false;
    queued = null; queuedNotify = false;
    laneTail = Promise.resolve();   // 옛 계정 일은 gen 이 달라 스스로 끝난다 — 새 계정 일은 그것을 기다리지 않는다
    if(unsub) unsub();
    emit();
  }

  return {
    box: () => ({ load: st.load, items: st.items.map((x) => Object.assign({}, x)), unseenCount: st.unseenCount, starCount: st.starCount, boxKeep: st.boxKeep, starMax: st.starMax }),
    get: (id) => { const it = find(id); return it ? Object.assign({}, it) : null; },
    isBusy: (id) => pending.has(id),
    onChange(fn){ subs.push(fn); return () => { const i = subs.indexOf(fn); if(i >= 0) subs.splice(i, 1); }; },
    order, pull, openTab, seen, star, hide, show, remove, fetchVisible, fetchSentToday, send, listen, reset,
    attachScreen, enterHome, leaveHome, onScreen,
    LOAD, MSG, MESSAGE_MAX: giftLib.LIMITS.MESSAGE,
  };
}

const api = { createGiftBox, LOAD, MSG };
if(typeof window !== 'undefined') window.TwGiftBox = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
