/* ═══ 📖 sim-guestbook-wiring.js — 방명록이 마이홈 열기 · 닫기 · 런처로 · 친구 홈 구경에 제대로 물려 있는가 ═══════════════
   진짜 guestbook.js · guestbook-feed.js 를 가짜 서버 위에 올리고, 그 고리(window._mhGb* · _mhReSubscribeGuestbook)를 부르는 쪽 —
   myhome-ui.js(마이홈 열기 · ✕) · app.js backToLauncher(런처로) · myhome-visit.js(친구 홈 구경) — 의 진짜 글을 돌려 «서버에 무엇이 나가는가» 를 본다.
   sim-guestbook.js 는 고리를 직접 부르고, sim-hook-guards · 5절은 «부르는 줄이 있다» 만 본다 — 여기는 부르는 쪽이 실제로 불러 주는지 본다.
   ・1절: 마이홈 열기 — 새 글 수를 서버에서 한 번 받아 배지에 · 두 번 열어도 알림 걸기는 하나 · 앞 칸이 던져도 · 방명록 시작이 던져도 열기는 끝까지
   ・2절: 마이홈 ✕ — 알림 걸기를 떼고 배지를 숨긴다 · 뗀 뒤엔 알림이 와도 안 받는다
   ・3절: 런처로 돌아가기 — 마이홈이 열려 있었으면 감시를 끈다 · 안 열려 있었으면 건드리지 않는다
   ・4절: 친구 홈 구경 — 들어가면 열린 내 방명록 창을 닫고 배지를 숨긴다 · 돌아오면 배지를 다시 계산
   ・5절: 일부러 깨 보기
   [실행] guestbook.js · guestbook-feed.js · myhome-ui.js · myhome-visit.js · app.js 가 있는 폴더에서. */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const find = (n) => [n, 'parts/myhome/' + n, 'app/parts/myhome/' + n].map(read).find(Boolean);
const SRC = {
  gb: find('guestbook.js'), feed: find('guestbook-feed.js'), ui: find('myhome-ui.js'), visit: find('myhome-visit.js'),
  err: read('api-errors.js') || find('api-errors.js'), codes: read('error-codes.js'), app: read('app.js'),
};
for(const k of Object.keys(SRC)) if(SRC[k] == null){ say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const flush = async (n = 8) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
const loadWin = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
const TwApiErrors = loadWin(SRC.err, 'TwApiErrors');
const TwErrorCodes = loadWin(SRC.codes, 'TwErrorCodes');
const RT = { READY: 'ready', OFF: 'off', AUTH_FAILED: 'authFailed', SESSION_LOST: 'sessionLost', UPDATE: 'update' };
const bookOf = (o) => Object.assign({ entries: [], clap: { count: 0, img: null, emoji: '', todayLeft: 5, dailyMax: 5 }, canWrite: true, version: 1 }, o || {});

/* 가짜 DOM — sim-guestbook.js 와 같은 모양(classList · 이벤트 · 자식 · innerHTML 이 자식을 비움) */
function mkEl(tag, id){
  const cls = new Set(), L = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: { setProperty(k, v){ this[k] = v; } }, dataset: {}, children: [],
    textContent: '', value: '', onclick: null, onchange: null, className: '', files: [],
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c) },
    appendChild(c){ el.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).forEach(fn => fn(ev || {})); }, _L: L,
    querySelector(sel){ return (el._q = el._q || {})[sel] || (el._q[sel] = mkEl('span')); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150 }),
    remove(){}, focus(){}, blur(){}, click(){},
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => html, set: (v) => { html = String(v); el.children.length = 0; el._q = null; }, enumerable: true });
  return el;
}
function mkChildWin(env){
  const els = {}, WL = {};
  const doc = { written: '', activeElement: null, open(){ doc.written = ''; }, write(h){ doc.written += h; }, close(){},
    getElementById: id => (doc.written ? (els[id] || (els[id] = mkEl('div', id))) : null), createElement: t => mkEl(t), addEventListener(){} };
  const w = { closed: false, document: doc, focus(){}, close(){ w.closed = true; }, addEventListener(t, fn){ (WL[t] = WL[t] || []).push(fn); }, fire(t){ (WL[t] || []).forEach(fn => fn({})); } };
  return w;
}

/* 진짜 feed · 진짜 guestbook.js 를 가짜 서버 위에 */
function mkEnv(opt){
  opt = opt || {};
  const env = { calls: [], kinds: {}, states: [], wins: [], viewing: null, me: 'uA', answers: Object.assign({ count: 4, view: bookOf({ entries: [{ id: 'g1', name: '밥', text: '안녕', ts: 1.7e12, mine: false }] }) }, opt.answers || {}) };
  const mainEls = {};
  const getEl = id => (mainEls[id] || (mainEls[id] = mkEl('div', id)));
  const ans = (name, args) => { env.calls.push(name + ':' + args.join('|')); const a = env.answers[name]; return typeof a === 'function' ? a(...args) : a; };
  const api = {
    fetchView: async (uid, owner) => ans('view', [uid, owner]),
    fetchNewCount: async (uid, since) => ans('count', [uid, since]),
    write: async () => ({ status: 'ok', entry: { id: 'n1' } }), remove: async () => ({ status: 'ok' }), clap: async () => ({ status: 'ok', count: 1, todayLeft: 4, dailyMax: 5 }),
    uploadImage: async () => ({ status: 'ok', url: 'https://img/u.png' }), changeLook: async () => ({ status: 'ok' }),
  };
  const rt = {
    on: (k, fn) => { (env.kinds[k] = env.kinds[k] || []).push(fn); return () => { const a = env.kinds[k], i = a.indexOf(fn); if(i >= 0) a.splice(i, 1); }; },
    onState: (fn) => { env.states.push(fn); return () => { const i = env.states.indexOf(fn); if(i >= 0) env.states.splice(i, 1); }; },
    send: () => true,
  };
  const ids = new Map();
  const pending = { idFor: (k) => { if(!ids.has(k)) ids.set(k, 'rid-' + ids.size); return ids.get(k); }, settle: (k) => { ids.delete(k); } };
  const FEED = loadWin(SRC.feed, 'TwGuestbookFeed');
  env.ls = {};
  env.feed = FEED.createGuestbookFeed({
    api, rt, rtState: RT, pending, lastRead: FEED.createLastReadStore({ getItem: k => (k in env.ls ? env.ls[k] : null), setItem: (k, v) => { env.ls[k] = String(v); } }),
    notifyError: () => true, translate: (e, t) => TwApiErrors.translate(e, t), ACTION: TwApiErrors.ACTION, now: () => 1.8e12,
  });
  env.notify = (n) => (env.kinds.guestbook || []).slice().forEach(fn => fn(n));
  const ctx = {
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, isFinite, parseInt, parseFloat, Intl,
    console: { warn(){}, log(){}, debug(){} }, document: { getElementById: getEl, createElement: t => mkEl(t) },
    setTimeout: () => 0, clearTimeout(){}, Image: class {}, FileReader: class {}, companion: { gbHold(){} },
  };
  ctx.window = ctx;
  ctx.open = () => { const w = mkChildWin(env); env.wins.push(w); return w; };
  ctx.TwSafeHtml = globalThis.TwSafeHtml; vm.createContext(ctx);
  vm.runInContext(SRC.gb, ctx, { filename: 'guestbook.js' });
  ctx.TwGuestbook.createGuestbook({
    feed: env.feed, errorText: (c) => TwErrorCodes.toastText(c), getMyUserId: () => env.me, getDisplayName: () => '나', toast(){},
    escHtml: (s) => String(s), applyThemeToChildDoc(){}, watchMaintenanceInput(){}, installMacTip(){},
    mhViewingUserId: () => env.viewing, mhViewingDisplayName: () => '친구',
  });
  env.ctx = ctx; env.els = mainEls; env.badge = getEl('mhGuestbookBadge');
  /* 부르는 쪽(myhome-ui · myhome-visit · app.js)이 보는 «전역 + window» — 진짜 방명록 고리, 나머지는 뭐든 받아 주는 가짜 */
  env.any = anything();
  env.win = new Proxy(ctx, { get: (t, k) => (k in t ? t[k] : env.any), set: (t, k, v) => { t[k] = v; return true; } });
  return env;
}
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
const recEl = (any) => { const L = {}; return new Proxy({}, { get: (t, k) => (k === 'addEventListener' ? ((ev, fn) => { (L[ev] = L[ev] || []).push(fn); }) : k === '_L' ? L : any), set: () => true }); };

/* 마이홈 창(myhome-ui.js) — 열기 · ✕ 만 진짜. 방명록 고리는 전역 이름으로 부르므로 globalThis 에 진짜 고리를 잇는다 */
const FN_DEPS = ['_mhApplyVisitUI', '_mhCloseStickerAnim', 'applyDesktopRunClass', 'closeFriendHomeView', 'escRegisterWindow', 'friendsForCheck', 'friendsRetry', 'friendsOpen', 'friendsClose', 'getDisplayName', 'getMyUserId', 'loadMyHomePage', 'renderMyHomePage', 'renderMyHomeFriendList'];
function buildUi(env, src, o){
  o = o || {};
  const any = env.any, deps = {};
  const GET = ['_mhViewingUserId', '_myFriendRequests', '_myHomeFriends', 'isAdmin', 'myHomeOpen', 'myHomeSticker'];
  ['FRIEND_MAX', 'MY_FRIEND_CODE_KEY', 'friendManage', 'helpTab', 'inboxMod', 'mallangMod', 'mhScheduler', 'twNav'].forEach(n => { deps[n] = any; });
  GET.forEach(n => { deps[n] = () => any; });
  ['_mhApplyVisitUI', '_mhCloseStickerAnim', 'applyDesktopRunClass', 'closeFriendHomeView', 'escRegisterWindow', 'friendsForCheck', 'friendsRetry', 'friendsOpen', 'friendsClose', 'getDisplayName', 'getMyUserId', 'loadMyHomePage', 'renderMyHomePage'].forEach(n => { deps[n] = () => any; });
  deps.setMyHomeOpen = () => {};
  deps._mhViewingUserId = () => env.viewing;
  Object.assign(deps, o.deps || {});
  const closeBtn = recEl(any), stats = { raf: 0 };
  const doc = { getElementById: (id) => (id === 'myHomeClose' ? closeBtn : any), querySelectorAll: () => ({ forEach(){} }), querySelector: () => any, createElement: () => any, addEventListener(){}, body: any };
  const win = new Proxy(env.ctx, { get: (t, k) => (k in t ? t[k] : any), set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem(){}, removeItem(){} };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'module', 'TwMyHomeHooks', 'TwDragScroll',
    src + '\nreturn window.TwMyHomeUi;')(win, doc, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, (fn) => { stats.raf++; fn(); return 0; }, undefined, any, any);
  api.createMyHomeUi(deps);
  return { open: () => win.openMyHome(), close: () => closeBtn._L.click.forEach(fn => fn({})), stats };
}
/* app.js 의 backToLauncher 한 함수만 떼어, 그 안의 이름을 «뭐든 받아 주는 가짜» 위에서 돌린다 — 방명록 고리와 마이홈 창 깃발만 진짜 */
function cutFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0) return src.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}
function runBackToLauncher(env, src, mhOpen){
  const any = env.any;
  const ov = { on: mhOpen, classList: { contains: () => ov.on, remove(){ ov.on = false; }, add(){} } };
  const O = { document: { getElementById: (id) => (id === 'myHomeOverlay' ? ov : any) }, window: env.win, myHomeOpen: !!mhOpen, Symbol, _mhGbStopWatch: () => env.ctx._mhGbStopWatch() };
  const S = new Proxy(O, { has: () => true, get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : any)), set: (t, k, v) => { t[k] = v; return true; } });
  new Function('S', 'with(S){ return (' + cutFn(src, 'backToLauncher') + ')(); }')(S);
  return ov;
}
/* 친구 홈 구경(myhome-visit.js) — 들어가기 · 돌아오기가 진짜 */
function buildVisit(env, src){
  const any = env.any, deps = {};
  ['mallangMod', 'mhScheduler'].forEach(n => { deps[n] = any; });
  ['applyDesktopRunClass', 'getMyUserId', 'loadMyHomePage', 'renderMyHomePage', 'toast', '_mhHomeFromServer', '_mhViewingDisplayName', 'refreshFriendProfile'].forEach(n => { deps[n] = () => any; });
  ['_myHomeFriends', 'myHomeOpen', '_myHomeData', '_myHomeLoaded', '_mhViewingName'].forEach(n => { deps[n] = () => any; });
  deps.getMyUserId = () => env.me;
  deps._mhViewingUserId = () => env.viewing;
  deps.setMhViewingUserId = (v) => { env.viewing = v; };
  deps.setMyHomeOpen = () => {}; deps.setMyHomeData = () => {}; deps.setMhViewingName = () => {};
  const win = new Proxy(env.ctx, { get: (t, k) => (k in t ? t[k] : any), set: (t, k, v) => { t[k] = v; return true; } });
  const ls = { getItem: () => null, setItem(){}, removeItem(){} };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'TwMyHomeHooks',
    src + '\nreturn window.TwMyHomeVisit;')(win, any, ls, any, { getMyHome: async () => ({}) }, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, any);
  return api.createMyHomeVisit(deps);
}
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };
const quietErr = async (fn) => { const ce = console.error, cw = console.warn; console.error = () => {}; console.warn = () => {}; try{ return await fn(); } finally{ console.error = ce; console.warn = cw; } };
/* 전역 이름으로 부르는 쪽(myhome-ui · app.js)이 보는 방명록 고리 — 만들 때가 아니라 부를 때 찾는다 */
const hookGlobals = (env, over) => { Object.assign(globalThis, { _mhGbStartWatch: () => env.ctx._mhGbStartWatch(), _mhGbStopWatch: () => env.ctx._mhGbStopWatch() }, over || {}); };
const unhook = () => { delete globalThis._mhGbStartWatch; delete globalThis._mhGbStopWatch; };

async function judge(S){
  await sec('── 1. 마이홈 열기 → 새 글 수 받기', async () => {
    const e = mkEnv(); hookGlobals(e); try{
      const ui = buildUi(e, S.ui);
      chk(e.calls.length === 0 && (e.kinds.guestbook || []).length === 0, '(준비) 마이홈을 열기 전에는 서버 요청 · 알림 걸기가 없다');
      ui.open(); await flush();
      chk(e.calls.join() === 'count:uA|0' && !e.calls.some(c => c.startsWith('view')), '마이홈을 열면 새 글 수 하나만 받는다(내 코드 · 글 목록은 안 받는다)');
      chk(e.badge.textContent === '4' && !e.badge.classList.contains('hidden'), '  배지에 새 글 4');
      ui.open(); await flush();
      chk((e.kinds.guestbook || []).length === 1 && e.states.length === 1, '  다시 열어도 알림 걸기는 하나뿐이다(새는 구독이 없다)');
      e.answers.count = 6; e.notify({ subject: 'uA' }); await flush();
      chk(e.badge.textContent === '6', '  열려 있는 동안 서버 알림이 오면 배지 숫자가 바뀐다');
    } finally{ unhook(); }
    const t = mkEnv(); hookGlobals(t); try{
      const ui = buildUi(t, S.ui, { deps: { loadMyHomePage: () => { throw new Error('page'); }, _mhApplyVisitUI: () => { throw new Error('x'); } } });
      await quietErr(async () => { ui.open(); await flush(); });
      chk(t.calls.join() === 'count:uA|0', '앞 칸(마이홈 페이지 불러오기)이 던져도 방명록 배지 감시는 시작된다');
    } finally{ unhook(); }
    const g = mkEnv(); hookGlobals(g, { _mhGbStartWatch: () => { throw new Error('gb'); } }); try{
      const ui = buildUi(g, S.ui); let threw = false;
      await quietErr(async () => { try{ ui.open(); }catch(_){ threw = true; } await flush(); });
      chk(!threw && ui.stats.raf === 1, '방명록 시작이 던져도 열기는 끝까지 간다(뒤 칸 — BGM 창 자리 맞추기 — 이 돈다)');
    } finally{ unhook(); }
  });

  await sec('── 2. 마이홈 ✕ → 감시 끄기', async () => {
    const e = mkEnv(); hookGlobals(e); try{
      const ui = buildUi(e, S.ui);
      ui.open(); await flush(); e.calls.length = 0;
      ui.close();
      chk((e.kinds.guestbook || []).length === 0 && e.states.length === 0, '✕ 로 닫으면 서버 알림 걸기를 모두 뗀다');
      chk(e.badge.classList.contains('hidden'), '  배지는 숨는다');
      e.notify({ subject: 'uA' }); await flush();
      chk(e.calls.length === 0, '  뗀 뒤엔 알림이 와도 새 글 수를 안 받는다');
      ui.open(); await flush();
      chk(e.calls.join() === 'count:uA|0' && !e.badge.classList.contains('hidden'), '  다시 열면 다시 받는다');
    } finally{ unhook(); }
  });

  await sec('── 3. 런처로 돌아가기(backToLauncher)', async () => {
    const e = mkEnv(); hookGlobals(e); try{
      const ui = buildUi(e, S.ui); ui.open(); await flush();
      e.calls.length = 0;
      const ov = runBackToLauncher(e, S.app, true);
      chk(!ov.on && (e.kinds.guestbook || []).length === 0 && e.badge.classList.contains('hidden'), '마이홈이 열려 있다 런처로 가면 방명록 감시를 끄고 배지를 숨긴다');
      e.notify({ subject: 'uA' }); await flush();
      chk(e.calls.length === 0, '  그 뒤 알림이 와도 안 받는다');
    } finally{ unhook(); }
    const n = mkEnv(); hookGlobals(n); try{
      n.feed.startBadge('uA'); await flush();
      runBackToLauncher(n, S.app, false);
      chk((n.kinds.guestbook || []).length === 1 && !n.badge.classList.contains('hidden'), '마이홈이 안 열려 있었으면 방명록 감시를 건드리지 않는다');
    } finally{ unhook(); }
  });

  await sec('── 4. 친구 홈 구경 ↔ 내 홈', async () => {
    const e = mkEnv(); hookGlobals(e); try{
      const visit = buildVisit(e, S.visit);
      e.ctx._mhGbStartWatch(); await flush(); e.ctx.openMyGuestbook(); await flush();
      const myWin = e.wins[0];
      chk(!myWin.closed && e.badge.classList.contains('hidden'), '(준비) 내 방명록 창이 열려 있다 · 열면 읽음이라 배지는 내려가 있다');
      e.answers.view = bookOf({ entries: [{ id: 'g2', name: '밥', text: '새글', ts: 1.8e12 + 5, mine: false }] }); e.answers.count = 1; e.notify({ subject: 'uA' }); await flush();
      chk(e.badge.classList.contains('hidden') && /새글/.test(myWin.document.getElementById('gbList').children[0].innerHTML), '(준비) 창이 열려 있는 동안 온 새 글은 창에 뜨고 배지는 안 켜진다(이미 본 글이다)');
      await visit.openFriendHomeView('uB', '친구'); await flush();
      chk(e.viewing === 'uB' && myWin.closed && e.feed.owner() === null, '친구 홈에 들어가면 열려 있던 내 방명록 창을 닫고 받은 것을 비운다');
      chk(e.badge.classList.contains('hidden'), '  내 방명록 새 글 배지는 숨긴다(친구 홈에 내 배지가 뜨면 안 된다)');
      e.calls.length = 0;
      e.ctx.openMyGuestbook(); await flush();
      chk(e.calls.join() === 'view:uA|uB' && e.wins[1].document.getElementById('gbTitleText').textContent === '친구 님의 방명록', '  이제 방명록 버튼은 그 친구 것을 연다');
      const fw = e.wins[1];
      visit.closeFriendHomeView(); await flush();
      chk(e.viewing === null && fw.closed, '내 홈으로 돌아오면 친구 방명록 창을 닫는다(새 주인 것은 창을 열 때 받는다)');
    } finally{ unhook(); }
    const m = mkEnv(); hookGlobals(m); try{
      const visit = buildVisit(m, S.visit);
      m.ctx._mhGbStartWatch(); await flush();
      const before = !m.badge.classList.contains('hidden');
      await visit.openFriendHomeView('uB', '친구'); await flush();
      const during = m.badge.classList.contains('hidden');
      visit.closeFriendHomeView(); await flush();
      chk(before && during && !m.badge.classList.contains('hidden') && m.badge.textContent === '4', '배지 — 내 홈에서 보임 → 친구 홈에서 숨김 → 돌아오면 같은 숫자(4)로 다시 보임');
    } finally{ unhook(); }
  });
}

(async () => {
  const S = { ui: SRC.ui, visit: SRC.visit, app: SRC.app };
  await judge(S);
  say('── 5. 일부러 깨 보기');
  const cut = (src, a, b) => src.replace(a, b);
  const UI_START = "_step('방명록 뱃지', ()=>{ _mhGbStartWatch(); });", UI_STOP = "_step('방명록 뱃지', ()=>{ _mhGbStopWatch(); });";
  const breaks = [
    ['마이홈을 열어도 배지 감시를 안 켬', { ui: cut(S.ui, UI_START, '') }, '새 글 수 하나만'],
    ['방명록 시작을 칸으로 안 감쌈(던지면 열기가 멈춤)', { ui: cut(S.ui, UI_START, '_mhGbStartWatch();') }, '열기는 끝까지'],
    ['앞 칸을 칸으로 안 감쌈(던지면 배지가 안 켜짐)', { ui: cut(S.ui, "_step('마이홈 페이지', ()=>{ loadMyHomePage(); });", 'loadMyHomePage();') }, '앞 칸'],
    ['마이홈을 닫아도 감시를 안 끔', { ui: cut(S.ui, UI_STOP, '') }, '모두 뗀다'],
    ['런처로 갈 때 감시를 안 끔', { app: cut(S.app, /(mhOv\.classList\.remove\('on'\); myHomeOpen = false;\s*)_mhGbStopWatch\(\);/, '$1') }, '런처로 가면'],
    ['친구 홈에 들어가도 열린 창을 안 닫음', { visit: cut(S.visit, /(if\(!\(window\.firebaseAPI[^\n]*\n[\s\S]*?)window\._mhReSubscribeGuestbook\(\);/, '$1') }, '열려 있던 내 방명록 창'],
    ['친구 홈에 들어가도 배지를 안 숨김', { visit: cut(S.visit, 'window._mhGbRefreshBadge();   // 관람 모드', '// 관람 모드') }, '배지는 숨긴다'],
    ['내 홈으로 돌아와도 창을 안 닫음', { visit: S.visit.replace(/window\._mhReSubscribeGuestbook\(\);\n  window\._mhGbRefreshBadge\(\);   \/\/ 자기 홈 복귀/, 'window._mhGbRefreshBadge();   // 자기 홈 복귀') }, '친구 방명록 창을 닫는다'],
    ['내 홈으로 돌아와도 배지를 안 되돌림', { visit: cut(S.visit, 'window._mhGbRefreshBadge();   // 자기 홈 복귀', '// 자기 홈 복귀') }, '같은 숫자'],
  ];
  for(const [name, over, what] of breaks){
    const src = Object.assign({}, S, over);
    if(Object.keys(over).every(k => src[k] === S[k])){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(src); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  done = true;
  process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
