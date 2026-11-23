/* ═══ 🩺 login-diag.js — 켤 때 로그인 진단(진단 기록 tw-mouse-diag.log 에 `[로그인]` 줄 몇 개 · 켤 때 한 번) ══════════
   켤 때 로그인이 «없음» 으로 끝나는 까닭을 아래 넷 가운데 하나로 가른다.
     A — 8초 대기선이 Firebase 복원보다 먼저 풀렸다(렌더러가 바빠서) → 확인이 «로그인 없음» 을 본다
     B — Firebase 가 저장된 로그인을 찾았지만 되읽기(reload) 오류로 지웠다
     C — 켤 때 저장된 로그인이 아예 없었다
     D — 서버 확인(GET /v2/me)이 401(AUTH_REQUIRED · NO_TOKEN)로 답했다
   적는 줄: ① 시작 — 저장된 로그인 키가 있나(글자 수만) · localStorage 크기 ② 대기선 — 첫 상태 · 시간 초과 · 늦게 온 첫 상태
     ③ 저장된 로그인이 있었는데 첫 상태가 «사용자 없음» ④ 켜고 15초 동안 렌더러를 막은 긴 작업(long task) 합 · 최대 ⑤ 확인(confirm) 결과
   ★ 값은 적지 않는다 — uid · 이메일 · 토큰 · 친구코드 · 유저코드가 들어갈 자리가 없다. 저장된 로그인은 «있음 · 글자 수» 만,
     서버 오류는 HTTP 상태 · 오류 code(대문자 모양만) · Firebase 오류는 code(소문자 모양만)만.
   ★ 로그인 동작은 바꾸지 않는다 — 부르는 쪽(firebase-init.js 대기선 · login-flow.js confirm)은 알리기만 하고 답을 기다리지 않는다. 이 안의 실패는 삼킨다.
   classic script(window.TwLoginDiag) — 긴 작업을 처음부터 재려고 HTML 맨 앞쪽(leave-flush.js 다음)에 싣는다. 앱 한 벌은 `TwLoginDiag.store`.
   검사 sim-login-diag.js. */
(function(){
'use strict';

const TAG = '[로그인]';
const LINE_MAX = 200;                       // preload diagNote 가 자르는 길이 — 넘기지 않게 여기서 맞춘다
const AUTH_KEY_PREFIX = 'firebase:authUser:';   // Firebase Auth 가 localStorage 에 로그인을 적는 키 머리(browserLocalPersistence)
const IDB_NAME = 'firebaseLocalStorageDb';  // Firebase Auth 의 IndexedDB 저장소 이름 — 키가 localStorage 에 없을 때 저쪽에 있었나
const IDB_WAIT_MS = 1000;                   // IndexedDB 이름 목록을 기다리는 상한 — 못 받으면 «모름»
const LONGTASK_WINDOW_MS = 15000;           // 켜고 이만큼 긴 작업을 잰다
const CONFIRM_MAX = 2;                      // 확인 줄 상한 — 첫 답이 local(서버에 닿지 못함)이면 다음 답 하나까지
const API_CODE = /^[A-Z0-9_]{1,40}$/;       // 서버 오류 code 모양 — 다른 모양(글 · 값)은 적지 않는다
const FB_CODE = /^[a-z0-9/-]{1,60}$/;       // Firebase 오류 code 모양(auth/network-request-failed)

const yn = (v) => (v ? 'y' : 'n');
const ms = (v) => Math.max(0, Math.round(Number(v) || 0));
const clip = (s) => String(s).replace(/[\r\n]+/g, ' ').slice(0, LINE_MAX);

/* 저장된 로그인 · localStorage 크기 — 키 이름 · 값 길이만 읽는다(값 내용은 보지 않는다). 못 읽으면 ok:false */
function storageInfo(storage){
  const r = { ok: false, has: false, len: 0, total: 0, keys: 0 };
  try{
    const n = storage.length;
    for(let i = 0; i < n; i++){
      const k = storage.key(i);
      if(k == null) continue;
      const v = storage.getItem(k);
      const vl = v == null ? 0 : String(v).length;
      r.keys++;
      r.total += String(k).length + vl;
      if(String(k).indexOf(AUTH_KEY_PREFIX) === 0){ r.has = true; r.len = vl; }
    }
    r.ok = true;
  }catch(_){ r.ok = false; }
  return r;
}

/* Firebase 사용자 → 있음 · 익명 · 수단(google · password · other) — uid · 이메일은 읽지 않는다 */
function userKind(u){
  if(!u) return { present: false, anonymous: false, kind: '-' };
  const ids = (Array.isArray(u.providerData) ? u.providerData : []).map((p) => (p && p.providerId) || '');
  const kind = ids.indexOf('google.com') >= 0 ? 'google' : (ids.indexOf('password') >= 0 ? 'password' : (u.isAnonymous ? 'anonymous' : 'other'));
  return { present: true, anonymous: !!u.isAnonymous, kind };
}
const userPart = (k) => '사용자 있음 ' + yn(k.present) + ' · 익명 ' + yn(k.anonymous) + ' · 수단 ' + k.kind;

/* 확인 실패 → 짧은 표 — 401 AUTH_REQUIRED · NO_TOKEN · network · 그 밖은 kind(모양이 맞을 때만) */
function errTag(e){
  if(!e) return '';
  const code = API_CODE.test(String(e.code || '')) ? String(e.code) : '';
  const status = Number(e.status) || 0;
  if(code === 'NO_TOKEN') return 'NO_TOKEN';
  if(status > 0) return status + (code ? ' ' + code : '');
  const kind = String(e.kind || '');
  if(!kind || kind === 'unavailable' || kind === 'notReady') return 'network' + (code ? ' ' + code : '');
  return (API_CODE.test(kind.toUpperCase()) ? kind : 'other') + (code ? ' ' + code : '');
}
function fbErrTag(e){ const c = String((e && e.code) || ''); return FB_CODE.test(c) ? c : 'unknown'; }

/* 줄 만들기 — 검사가 같은 글을 본다 */
function startLine(s, idb, pageMs, hasAuth){
  const stored = !s.ok ? '저장된 로그인 모름(읽기 실패)' : (s.has ? '저장된 로그인 있음(' + s.len + '자)' : '저장된 로그인 없음');
  return clip(TAG + ' 켤 때 · ' + stored + ' · IndexedDB 저장소 ' + (idb == null ? '모름' : yn(idb))
    + ' · localStorage 약 ' + s.total + '자 · 키 ' + s.keys + '개 · 페이지 ' + ms(pageMs) + ' ms · Auth ' + (hasAuth ? '준비' : '초기화 실패'));
}
const longPart = (lt) => (lt.supported ? '긴 작업 합 ' + ms(lt.sum) + ' ms(최대 ' + ms(lt.max) + ')' : '긴 작업 잴 수 없음');
function firstLine(k, t, lt){ return clip(TAG + ' 대기선: 첫 상태 먼저 ' + ms(t) + ' ms · ' + userPart(k) + ' · ' + longPart(lt)); }
function errorLine(e, t, lt){ return clip(TAG + ' 대기선: 상태 오류 먼저 ' + ms(t) + ' ms · ' + fbErrTag(e) + ' · ' + longPart(lt)); }
function timeoutLine(t, lt){ return clip(TAG + ' 대기선: 8초 시간 초과 먼저 ' + ms(t) + ' ms · ' + longPart(lt)); }
function lateLine(k, t){ return clip(TAG + ' 늦게 도착 ' + ms(t) + ' ms · ' + userPart(k)); }
function clearedLine(len, still){ return clip(TAG + ' 저장된 로그인(' + len + '자)이 있었는데 첫 상태가 «사용자 없음» — Firebase 가 복원 중 지움 · 지금 키 남음 ' + yn(still)); }
function longLine(lt){
  if(!lt.supported) return clip(TAG + ' 켜고 15초 긴 작업 잴 수 없음');
  return clip(TAG + ' 켜고 15초 긴 작업 ' + lt.count + '번 · 합 ' + ms(lt.sum) + ' ms · 가장 긴 ' + ms(lt.max) + ' ms');
}
/* r: confirm 결과 · info: { hadUser, anonymous, err } · barrier: 'first' · 'error' · 'timeout' · null(아직) */
function confirmLine(r, info, t, barrier){
  const i = info || {};
  let why = '';
  if(i.err) why = errTag(i.err);
  else if(!i.hadUser) why = 'Firebase 사용자 없음';
  else if(i.anonymous) why = '익명';
  const bar = barrier === 'timeout' ? '시간 초과 뒤' : (barrier ? '첫 상태 뒤' : '대기선 전');
  return clip(TAG + ' 확인 → ' + String((r && r.state) || '?') + (why ? ' · ' + why : '') + ' · 시작 뒤 ' + ms(t) + ' ms · 대기선 ' + bar);
}

/** @param {{
 *   note: (line: string) => void,          // 진단 기록에 한 줄(companion.diagNote)
 *   now: () => number,                     // ms(performance.now — 페이지 시작 기준)
 *   storage: { length: number, key: (i: number) => string|null, getItem: (k: string) => string|null },
 *   idbNames: () => Promise<string[]|null>, // IndexedDB 이름 목록(못 읽으면 null)
 *   observeLongTasks: (cb: (durationMs: number) => void) => (null | (() => void)),   // 잴 수 없으면 null · 되면 끊는 함수
 *   later: (fn: Function, ms: number) => void,
 * }} deps */
function createLoginDiag(deps){
  const note = (line) => { try{ deps.note(line); }catch(_){} };
  const lt = { supported: false, count: 0, sum: 0, max: 0 };
  let t0 = null, stored = null, barrier = null, firstSeen = false, confirmDone = false, confirmCount = 0;

  /* 긴 작업 — 만들 때(HTML 맨 앞쪽) 시작해 15초 뒤 한 줄 */
  try{
    const stop = deps.observeLongTasks((d) => { const v = Number(d) || 0; lt.count++; lt.sum += v; if(v > lt.max) lt.max = v; });
    lt.supported = !!stop;
    deps.later(() => { try{ if(stop) stop(); }catch(_){} note(longLine(lt)); }, LONGTASK_WINDOW_MS);
  }catch(_){ lt.supported = false; }

  const since = () => { try{ return t0 == null ? deps.now() : deps.now() - t0; }catch(_){ return 0; } };

  /* firebase-init.js 시작 — 저장된 로그인 · 크기 한 줄. 두 번 불려도(감시견이 다시 꽂음) 한 번만 */
  function authStart(hasAuth){
    if(t0 != null) return;
    try{
      t0 = deps.now();
      stored = storageInfo(deps.storage);
      const snap = stored, page = t0;
      let sent = false;
      const send = (idb) => { if(sent) return; sent = true; note(startLine(snap, idb, page, hasAuth)); };
      deps.later(() => send(null), IDB_WAIT_MS);
      Promise.resolve().then(() => deps.idbNames()).then((names) => send(Array.isArray(names) ? names.indexOf(IDB_NAME) >= 0 : null), () => send(null));
      if(!hasAuth){ barrier = 'error'; note(clip(TAG + ' 대기선: Auth 초기화 실패 — 바로 통과')); }
    }catch(_){}
  }
  /* 첫 onAuthStateChanged — 대기선보다 먼저면 «먼저» 줄, 시간 초과 뒤면 «늦게 도착» 줄. 그 뒤 상태 바뀜(로그인 · 로그아웃)은 안 적는다 */
  function authState(u){
    if(firstSeen) return;
    firstSeen = true;
    try{
      const k = userKind(u), t = since();
      if(barrier === 'timeout') note(lateLine(k, t));
      else { barrier = 'first'; note(firstLine(k, t, lt)); }
      if(stored && stored.has && !k.present) note(clearedLine(stored.len, storageInfo(deps.storage).has));
    }catch(_){}
  }
  function authError(e){
    if(firstSeen) return;
    firstSeen = true;
    try{
      if(barrier === 'timeout') note(clip(TAG + ' 늦게 도착 ' + ms(since()) + ' ms · 상태 오류 ' + fbErrTag(e)));
      else { barrier = 'error'; note(errorLine(e, since(), lt)); }
    }catch(_){}
  }
  function barrierTimeout(){
    if(barrier) return;
    barrier = 'timeout';
    try{ note(timeoutLine(since(), lt)); }catch(_){}
  }
  /* login-flow.js confirm 결과 — 켜고 첫 확인 한 번. 첫 답이 «서버에 닿지 못함(local)» 이면 다음 답 하나를 더 적는다 */
  function confirmed(r, info){
    if(confirmDone) return;
    confirmCount++;
    confirmDone = !(r && r.state === 'local') || confirmCount >= CONFIRM_MAX;
    try{ note(confirmLine(r, info, since(), barrier)); }catch(_){}
  }
  return { authStart, authState, authError, barrierTimeout, confirmed };
}

/* 이 앱의 진짜 재료 — 브라우저(렌더러)에서만 */
function realDeps(w){
  return {
    note: (line) => { if(w.companion && w.companion.diagNote) w.companion.diagNote(line); },   // 브라우저 미리보기 · 검사엔 companion 이 없다
    now: () => w.performance.now(),
    storage: w.localStorage,
    idbNames: () => ((w.indexedDB && w.indexedDB.databases) ? w.indexedDB.databases().then((l) => (l || []).map((d) => d && d.name)) : Promise.resolve(null)),
    observeLongTasks: (cb) => {
      const PO = w.PerformanceObserver;
      if(!PO || !Array.isArray(PO.supportedEntryTypes) || PO.supportedEntryTypes.indexOf('longtask') < 0) return null;
      const o = new PO((list) => { for(const e of list.getEntries()) cb(e.duration); });
      try{ o.observe({ type: 'longtask', buffered: true }); }catch(_){ o.observe({ entryTypes: ['longtask'] }); }
      return () => o.disconnect();
    },
    later: (fn, t) => setTimeout(fn, t),   // 시간이 규칙이다 — 켜고 15초 창 · IndexedDB 답 기다림 상한(이름 붙은 상수 · 린트 기준선 한 줄)
  };
}

const api = { TAG, LINE_MAX, AUTH_KEY_PREFIX, IDB_NAME, LONGTASK_WINDOW_MS, storageInfo, userKind, errTag, fbErrTag,
  startLine, firstLine, errorLine, timeoutLine, lateLine, clearedLine, longLine, confirmLine, createLoginDiag, realDeps };
if(typeof window !== 'undefined'){
  let store = null;
  try{ store = createLoginDiag(realDeps(window)); }catch(_){ store = null; }
  const noop = () => {};
  api.store = store || { authStart: noop, authState: noop, authError: noop, barrierTimeout: noop, confirmed: noop };   // 만들다 죽어도 부르는 쪽(firebase-init)이 멈추지 않게
  window.TwLoginDiag = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
