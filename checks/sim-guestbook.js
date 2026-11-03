/* ═══ 📖 sim-guestbook.js — 방명록 화면 모듈 (앱 FSD 4번 · 0.13 앱 묶음 D2-4 에서 서버 원본으로) ═══════════════════════════
   화면(guestbook.js)만 굴려 본다 — 받기 · 쓰기 · 알림은 진짜 guestbook-feed.js 를 가짜 서버(api)·가짜 realtime 위에 올려 같이 돈다.
   자식 창 테마 규약(GB_HTML 토큰 · 열 때 applyThemeToChildDoc)은 sim-child-theme 이 이 파일을 읽어 보고, 여기서는 «옮긴 것» 자체를 굴려 본다.
   ・1절: 만들 때 — #mhGuestbookBtn 클릭 연결 · window 고리 여섯 · 반환값이 같은 함수 · DOM 이 없으면 조용히 · 서버 요청 0
   ・2절: 새 글 배지 — 켜면 서버에서 숫자 하나 · 99+ · 관람 중엔 숨김 · 다 읽음(창을 열면) · 끄면 숨김
   ・3절: 창 — 가짜 자식 창에 GB_HTML 을 쓰고 테마를 넣는다 · 받는 중(입력칸 숨김) → 목록(서버 순서 · 내 글만 삭제 · escHtml) · 못 받음(다시 시도) ·
          친구가 아니면(canWrite:false) 입력칸 대신 안내 · 이미 떠 있으면 앞으로만 · 창이 닫히면(pagehide) 받은 것 비우고 «보는 중» 뗌 ·
          👀 관람(친구 것 · 이미지 등록 숨김 · 홈 주인이 바뀌면 열린 창을 닫음)
   ・4절: 쓰기 · 삭제 · 박수 · 폭죽 — 서버에 보내는 모양 · 실패는 창 안 안내줄에도(오류 번호 글) · 박수 하루 몫은 서버 값 · 보내는 중엔 또 안 보냄 · 폭죽 한 글자 · 그림 올리기는 옛 길
   ・5절: 배선 — 정의는 모듈에만 · createGuestbook 은 원래 자리 · deps 모양 · 부르는 곳은 window 고리 그대로 · html 순서 · 옛 장치(친구 목록 게이트 · localStorage 박수 5번)가 없음
   ・6절: 일부러 깨 보기
   [실행] guestbook.js · guestbook-feed.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
globalThis.TwSafeHtml = require([__dirname, process.cwd()].flatMap(d => ['safe-html.js', 'parts/shared/safe-html.js', 'app/parts/shared/safe-html.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🛡️ 모듈이 부르는 공용 씻기 — 진짜 파일
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['guestbook.js', 'guestbook-feed.js', 'api-errors.js', 'error-codes.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const flush = async (n = 8) => { for(let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };
const loadWin = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
const TwApiErrors = loadWin(SRC['api-errors.js'], 'TwApiErrors');
const TwErrorCodes = loadWin(SRC['error-codes.js'], 'TwErrorCodes');
const RT = { READY: 'ready', OFF: 'off', AUTH_FAILED: 'authFailed', SESSION_LOST: 'sessionLost', UPDATE: 'update' };
const apiErr = (status, code, kind) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: kind || (status >= 500 ? 'unavailable' : 'request') });
const deferred = () => { let res; const p = new Promise((a) => { res = a; }); return { p, res }; };

/* DOM 칸 — classList · style · 이벤트 · 자식은 진짜, 나머지는 빈 함수 */
function mkEl(tag, id){
  const cls = new Set(), L = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: { setProperty(k, v){ this[k] = v; } }, dataset: {}, children: [],
    textContent: '', value: '', onclick: null, onchange: null, className: '', files: [],
    classList: { add: (...a) => a.forEach(c => cls.add(c)), remove: (...a) => a.forEach(c => cls.delete(c)), contains: c => cls.has(c) },
    appendChild(c){ el.children.push(c); return c; },
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
    fire(t, ev){ (L[t] || []).forEach(fn => fn(ev || {})); },
    _L: L,
    querySelector(sel){ return (el._q = el._q || {})[sel] || (el._q[sel] = mkEl('span')); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150 }),
    remove(){}, focus(){}, blur(){}, click(){ el.clicked = (el.clicked || 0) + 1; },
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => html, set: (v) => { html = String(v); el.children.length = 0; el._q = null; }, enumerable: true });   // 진짜 DOM 처럼 innerHTML 을 쓰면 자식이 비워진다
  return el;
}
/* 방명록 자식 창 — document.open/write/close 를 받고, 쓴 뒤에만 칸이 있다(_gbAlive 가 #gbBody 를 만져 본다). 창 자신의 이벤트(pagehide)도 받는다 */
function mkChildWin(env){
  const els = {}, L = {}, WL = {};
  const doc = {
    written: '', activeElement: null,
    open(){ doc.written = ''; }, write(h){ doc.written += h; }, close(){},
    getElementById: id => (doc.written ? (els[id] || (els[id] = mkEl('div', id))) : null),
    createElement: t => mkEl(t),
    addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); }, _L: L,
  };
  const w = { closed: false, document: doc, focused: 0, focus(){ w.focused++; }, close(){ w.closed = true; env.childClosed++; }, els,
    addEventListener(t, fn){ (WL[t] = WL[t] || []).push(fn); }, fire(t){ (WL[t] || []).forEach(fn => fn({})); }, _WL: WL };
  return w;
}

/* 진짜 feed 를 가짜 서버 위에 — answers 로 길마다 정한 답을 낸다. 서버 알림은 env.notify, 보낸 realtime 메시지는 env.sent */
function mkEnv(opt){
  opt = opt || {};
  const env = { toasts: [], warns: [], ls: {}, calls: [], notes: [], sent: [], kinds: {}, states: [], themed: [], watched: [], wins: [], childClosed: 0, ids: 0,
    viewing: opt.viewing || null, me: 'me' in opt ? opt.me : 'uA', name: '나', answers: Object.assign({}, opt.answers || {}), images: [] };
  const mainEls = {};
  const getEl = id => (opt.noDom ? null : (mainEls[id] || (mainEls[id] = mkEl('div', id))));
  const ans = (name, args) => { env.calls.push(name + ':' + args.join('|')); const a = env.answers[name]; return typeof a === 'function' ? a(...args) : a; };
  const book = (o) => Object.assign({ entries: [], clap: { count: 0, img: null, emoji: '', todayLeft: 5, dailyMax: 5 }, canWrite: true, version: 1 }, o || {});
  const api = {
    fetchView: async (uid, owner) => { const r = await ans('view', [uid, owner]); if(r instanceof Error) throw r; return r === undefined ? book() : r; },
    fetchNewCount: async (uid, since) => { const r = await ans('count', [uid, since]); if(r instanceof Error) throw r; return r === undefined ? 0 : r; },
    write: async (uid, owner, text, rid) => (await ans('write', [uid, owner, text, rid])) || { status: 'ok', entry: { id: 'n1' } },
    remove: async (uid, owner, id) => (await ans('remove', [uid, owner, id])) || { status: 'ok' },
    clap: async (uid, owner, rid) => (await ans('clap', [uid, owner, rid])) || { status: 'ok', count: 1, todayLeft: 4, dailyMax: 5 },
    uploadImage: async (uid, data) => (await ans('upload', [uid, data])) || { status: 'ok', url: 'https://img/u.png' },
    changeLook: async (uid, version, patch) => (await ans('look', [uid, version, JSON.stringify(patch)])) || { status: 'ok' },
  };
  const rt = {
    on: (k, fn) => { (env.kinds[k] = env.kinds[k] || []).push(fn); return () => { const a = env.kinds[k], i = a.indexOf(fn); if(i >= 0) a.splice(i, 1); }; },
    onState: (fn) => { env.states.push(fn); return () => { const i = env.states.indexOf(fn); if(i >= 0) env.states.splice(i, 1); }; },
    send: (m) => { env.sent.push(JSON.stringify(m)); return true; },
  };
  const ids = new Map();
  const pending = { idFor: (k) => { if(!ids.has(k)) ids.set(k, 'rid-' + (++env.ids)); return ids.get(k); }, settle: (k) => { ids.delete(k); } };
  const FEED = loadWin(opt.feedSrc || SRC['guestbook-feed.js'], 'TwGuestbookFeed');
  env.feed = FEED.createGuestbookFeed({
    api, rt, rtState: RT, pending, lastRead: FEED.createLastReadStore({ getItem: k => (k in env.ls ? env.ls[k] : null), setItem: (k, v) => { env.ls[k] = String(v); } }),
    notifyError: (code, err) => { env.notes.push(code); env.toasts.push(TwErrorCodes.toastText(code)); return true; },
    translate: (e, t) => TwApiErrors.translate(e, t), ACTION: TwApiErrors.ACTION, now: () => 1.8e12,
  });
  env.notify = (n) => (env.kinds.guestbook || []).slice().forEach(fn => fn(n));
  const ctx = {
    Math, JSON, String, Number, Array, Object, Promise, Map, Set, Date, Boolean, Error, isFinite, parseInt, parseFloat, Intl,
    console: { warn: (...a) => env.warns.push(a.join(' ')), log(){}, debug(){} },
    document: { getElementById: getEl, createElement: t => mkEl(t) },
    setTimeout: () => 0, clearTimeout(){},
    Image: class {}, FileReader: class {},
    companion: { gbHold(){ env.held = (env.held || 0) + 1; } },
  };
  ctx.window = ctx;
  ctx.open = () => { if(opt.blocked) return null; const w = mkChildWin(env); env.wins.push(w); return w; };
  ctx.TwSafeHtml = globalThis.TwSafeHtml; vm.createContext(ctx);
  vm.runInContext(opt.src || SRC['guestbook.js'], ctx, { filename: 'guestbook.js' });
  env.ctx = ctx; env.els = mainEls;
  env.mk = () => ctx.TwGuestbook.createGuestbook({
    feed: env.feed,
    errorText: (code) => TwErrorCodes.toastText(code),
    getMyUserId: () => env.me,
    getDisplayName: () => env.name,
    toast: (m) => env.toasts.push(m),
    escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    applyThemeToChildDoc: (d) => env.themed.push(d),
    watchMaintenanceInput: (d) => env.watched.push(d),
    mhViewingUserId: () => env.viewing,
    mhViewingDisplayName: () => '친구' + env.viewing,
  });
  return env;
}
const sec = async (title, fn) => { say(title); try{ await fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };
const HOOKS = ['_mhGbStartWatch', '_mhGbStopWatch', '_mhGbRefreshBadge', '_mhGbMarkAllRead', '_mhReSubscribeGuestbook', 'openMyGuestbook'];
const ent = (id, o) => Object.assign({ id, name: '이름' + id, text: '글' + id, ts: 1.7e12, mine: false }, o || {});
const bookOf = (o) => Object.assign({ entries: [], clap: { count: 0, img: null, emoji: '', todayLeft: 5, dailyMax: 5 }, canWrite: true, version: 1 }, o || {});

async function judge(S){
  const MOD = S.MOD;
  await sec('── 1. 만들 때 — 버튼 연결 · window 고리', () => {
    const e = mkEnv({ src: MOD }); const gb = e.mk();
    chk(HOOKS.every(n => typeof e.ctx[n] === 'function') && !('_mhGbRefreshWriteUI' in e.ctx), 'window 고리 여섯 — 부르는 곳(마이홈 열기 · 닫기 · 관람 · 런처)이 부른다 · 친구 목록으로 쓰기를 판정하던 고리는 없다');
    chk(gb.open === e.ctx.openMyGuestbook && gb.startWatch === e.ctx._mhGbStartWatch && gb.stopWatch === e.ctx._mhGbStopWatch
      && gb.refreshBadge === e.ctx._mhGbRefreshBadge && gb.markAllRead === e.ctx._mhGbMarkAllRead
      && gb.reSubscribe === e.ctx._mhReSubscribeGuestbook && !('refreshWriteUI' in gb), '반환값은 window 고리와 같은 함수');
    const btn = e.els.mhGuestbookBtn;
    chk(btn && (btn._L.click || []).length === 1 && btn._L.click[0] === gb.open, '#mhGuestbookBtn 클릭 = 방명록 창 열기 (한 번만)');
    chk(e.wins.length === 0 && e.calls.length === 0 && e.sent.length === 0 && (e.kinds.guestbook || []).length === 0, '만들 때는 창도 서버 요청도 알림 걸기도 없다');
    const e2 = mkEnv({ noDom: true, src: MOD }); let ok = true; try{ e2.mk(); }catch(_){ ok = false; }
    chk(ok && typeof e2.ctx.openMyGuestbook === 'function', 'DOM 이 없어도(#mhGuestbookBtn 없음) 조용히 — 고리는 건다');
  });

  await sec('── 2. 새 글 배지 — 자기 홈 관점', async () => {
    const e = mkEnv({ src: MOD, answers: { count: 2 } }); e.mk(); const badge = e.ctx.document.getElementById('mhGuestbookBadge');
    e.ls['tw.mhGbLastRead:uA'] = '100';
    e.ctx._mhGbStartWatch(); await flush();
    chk(e.calls.join() === 'count:uA|100' && !e.calls.some(c => c.startsWith('view')), '마이홈을 열면 새 글 수 하나만 받는다(마지막으로 연 때 뒤 · 글 목록은 안 받는다)');
    chk(badge.textContent === '2' && !badge.classList.contains('hidden'), '배지 — 2');
    e.answers.count = 120; e.notify({ subject: 'uA' }); await flush();
    chk(badge.textContent === '99+', '서버가 방명록이 바뀌었다고 알리면 숫자만 다시 받는다 · 100개 넘으면 99+');
    e.viewing = 'uB'; e.ctx._mhGbRefreshBadge();
    chk(badge.classList.contains('hidden'), '👀 친구 홈 관람 중엔 숨긴다 (만든 뒤에 바뀐 값을 본다 — 읽는 함수)');
    e.ctx._mhGbMarkAllRead();
    chk(e.ls['tw.mhGbLastRead:uA'] === '100', '  관람 중엔 «다 읽음» 을 안 쓴다');
    e.viewing = null; e.ctx._mhGbRefreshBadge();
    chk(badge.textContent === '99+' && !badge.classList.contains('hidden'), '자기 홈으로 돌아오면 다시 계산');
    e.ctx._mhGbMarkAllRead();
    chk(+e.ls['tw.mhGbLastRead:uA'] > 1e12 && badge.classList.contains('hidden'), '다 읽음 — 지금 시각을 적고 배지를 내린다');
    e.ctx._mhGbStopWatch();
    chk((e.kinds.guestbook || []).length === 0 && badge.classList.contains('hidden'), '마이홈을 닫으면 알림 걸기를 떼고 숨긴다');
    e.calls.length = 0; e.notify({ subject: 'uA' }); await flush();
    chk(e.calls.length === 0 && badge.classList.contains('hidden'), '  뗀 뒤엔 알림이 와도 안 받는다');
    const e3 = mkEnv({ src: MOD, me: null }); e3.mk(); e3.ctx._mhGbStartWatch(); await flush();
    chk(e3.calls.length === 0, '내 코드가 없으면 요청 0');
  });

  await sec('── 3. 창 — 열기 · 받는 중 · 목록 · 못 받음 · 닫힘 · 관람', async () => {
    const e = mkEnv({ src: MOD, answers: { view: bookOf({ entries: [ent('g2', { name: '나', text: '두번째', ts: 20, mine: true }), ent('g1', { name: '밥', text: '<b>안녕</b>', ts: 10 })], clap: { count: 7, img: 'https://img.test/c.png', emoji: '🎉', todayLeft: 5, dailyMax: 5 } }) } });
    e.mk(); e.ctx._mhGbStartWatch(); await flush(); e.calls.length = 0;
    const hold = deferred(); const real = e.answers.view; e.answers.view = () => hold.p;   // 받는 중 모습을 붙잡아 두고 본다
    e.ctx.openMyGuestbook();
    const w = e.wins[0], d = w && w.document;
    chk(!!w && /<div id="gbBody">/.test(d.written) && /<\/html>$/.test(d.written), '자식 창을 열어 GB_HTML 을 쓴다');
    chk(e.themed.length === 1 && e.themed[0] === d, '쓰자마자 applyThemeToChildDoc(자식 문서)');
    chk(e.watched.length === 1 && e.watched[0] === d, '  ↳ 이 창 입력도 점검 판정에 센다(watchMaintenanceInput — 쓴 뒤에)');
    chk(d.getElementById('gbTitleText').textContent === '나 님의 방명록', '제목 — 내 이름');
    chk(e.calls.join() === 'view:uA|uA', '창을 열면 내 방명록을 서버에서 받는다');
    chk(+e.ls['tw.mhGbLastRead:uA'] > 1e12, '창을 열면 새 글 배지는 다 읽음');
    chk(d.getElementById('gbList').children.length === 1 && /불러오는 중/.test(d.getElementById('gbList').children[0].textContent), '받는 중 — «글이 없다» 가 아니라 «불러오는 중»');
    chk(d.getElementById('gbInputRow').style.display === 'none' && d.getElementById('gbGuestNote').style.display === 'none', '  받기 전에는 입력칸도 안내줄도 숨긴다(받기 전에 쓰게 하지 않는다)');
    chk(d.getElementById('gbImgSet').style.display === '' && d.getElementById('gbClapEmoji').style.display === '', '내 홈 — 이미지 등록 · 폭죽 칸이 보인다');
    chk(typeof d.getElementById('gbClose').onclick === 'function' && (d._L.keydown || []).length === 1 && (w._WL.pagehide || []).length === 1, '✕ · ESC 로 닫기 · 창이 닫히는 것을 지켜본다(pagehide)');
    hold.res(real); e.answers.view = real; await flush();
    const list = d.getElementById('gbList');
    chk(list.children.length === 2 && /두번째/.test(list.children[0].innerHTML) && /&lt;b&gt;안녕/.test(list.children[1].innerHTML), '받으면 목록 — 서버가 준 순서(최신이 위) · 글은 escHtml 을 지난다');
    const delOf = (row) => row.querySelector('.gb-meta').children[0];
    chk(delOf(list.children[0]) && delOf(list.children[0]).textContent === '삭제' && !delOf(list.children[1]), '삭제 링크는 서버가 내 글이라고 한(mine) 글에만');
    chk(d.getElementById('gbInputRow').style.display === 'flex' && d.getElementById('gbGuestNote').style.display === 'none', '  서버가 canWrite 라 하니 입력칸이 보인다');
    chk(d.getElementById('gbClapTotal').textContent === 'TOTAL CLAP : 7' && d.getElementById('gbClapImg').style.display === 'block' && d.getElementById('gbClapEmoji').value === '🎉', '박수 — 합계 · 이미지 · 폭죽 이모지');
    e.answers.view = bookOf({ entries: [], clap: { count: 8, img: null, emoji: '', todayLeft: 5, dailyMax: 5 } }); e.notify({ subject: 'uA' }); await flush();
    chk(d.getElementById('gbClapTotal').textContent === 'TOTAL CLAP : 8' && /아직 방명록이 없어요/.test(d.getElementById('gbList').innerHTML), '서버 알림이 오면 열린 창이 다시 그려진다 · 글이 없으면 «첫 글을 남겨보세요»');
    e.ctx.openMyGuestbook();
    chk(e.wins.length === 1 && w.focused >= 2, '이미 떠 있으면 새로 안 만들고 앞으로만');

    /* 창이 닫히면 */
    w.fire('pagehide');
    chk(e.feed.owner() === null && e.feed.view() === null, '창이 닫히면(✕ · ESC · main.js 의 blur 닫기) 받아 둔 방명록을 비운다');
    e.ctx.openMyGuestbook();
    chk(e.wins.length === 2 && e.feed.owner() === 'uA', '  다시 열면 새 창 · 다시 받는다');
    w.fire('pagehide');
    chk(e.feed.owner() === 'uA', '  먼저 닫힌 옛 창의 늦은 pagehide 는 새 창의 방명록을 닫지 않는다');

    /* 못 받음 */
    const f = mkEnv({ src: MOD, answers: { view: apiErr(503, 'X') } }); f.mk(); f.ctx._mhGbStartWatch(); await flush();
    f.ctx.openMyGuestbook(); await flush();
    const fl = f.wins[0].document.getElementById('gbList');
    chk(/불러오지 못했어요/.test(fl.children[0].textContent) && fl.children[0].children[0].textContent === '다시 시도', '못 받음 — «글이 없다» 와 다르게 «불러오지 못했어요 · 다시 시도»');
    chk(f.notes.join() === 'E-GB-01' && f.wins[0].document.getElementById('gbInputRow').style.display === 'none', '  오류 번호(E-GB-01)가 한 번 · 입력칸은 계속 숨김');
    f.answers.view = bookOf({ entries: [ent('z')] }); fl.children[0].children[0].onclick(); await flush();
    chk(f.wins[0].document.getElementById('gbList').children.length === 1 && f.wins[0].document.getElementById('gbInputRow').style.display === 'flex', '  «다시 시도» 가 받으면 그려진다');

    /* 👀 관람 — 홈 주인이 바뀌면 열린 창을 닫는다 */
    e.viewing = 'uB'; e.answers.view = bookOf({ entries: [ent('b1')], canWrite: true });
    const w2cur = e.wins[1];
    e.ctx._mhReSubscribeGuestbook();
    chk(w2cur.closed && e.feed.owner() === null, '홈 주인이 바뀌면 열린 창을 닫고 받은 것을 비운다(_mhViewingUserId 는 읽는 함수)');
    e.calls.length = 0; e.ctx.openMyGuestbook(); await flush();
    const d2 = e.wins[2].document;
    chk(e.calls.join() === 'view:uA|uB' && e.sent.includes('{"t":"guestbookWatch","owner":"uB"}'), '관람 — 친구 것을 받고 «보는 중» 을 서버에 알린다');
    chk(d2.getElementById('gbTitleText').textContent === '친구uB 님의 방명록', '관람 — 제목은 그 사람');
    chk(d2.getElementById('gbImgSet').style.display === 'none' && d2.getElementById('gbClapEmoji').style.display === 'none' && d2.getElementById('gbClapFwLbl').style.display === 'none', '관람 — 이미지 등록 · 폭죽 칸 숨김');
    chk(d2.getElementById('gbInputRow').style.display === 'flex', '친구 홈이고 서버가 canWrite 라 하니 입력칸');
    e.wins[2].close(); e.wins[2].fire('pagehide');
    chk(e.sent[e.sent.length - 1] === '{"t":"guestbookUnwatch"}', '  창을 닫으면 «보는 중» 을 뗀다');
    /* 🚪 친구가 아님 */
    e.viewing = 'uC'; e.ctx._mhReSubscribeGuestbook(); e.answers.view = bookOf({ canWrite: false });
    e.ctx.openMyGuestbook(); await flush();
    const d3 = e.wins[3].document;
    chk(d3.getElementById('gbInputRow').style.display === 'none' && d3.getElementById('gbGuestNote').style.display === 'block', '🚪 서버가 canWrite:false 라 하면 입력칸 대신 안내줄 (친구 목록을 안 본다)');
    const eb = mkEnv({ blocked: true, src: MOD }); eb.mk(); eb.ctx._mhGbStartWatch(); eb.ctx.openMyGuestbook();
    chk(eb.toasts[0] === '방명록 창을 열 수 없어요' && eb.feed.owner() === null, '창이 막히면 안내 · 방명록도 안 연다');
    const en = mkEnv({ me: null, src: MOD }); en.mk(); en.ctx.openMyGuestbook(); await flush();
    chk(en.calls.length === 0 && /불러오지 못했어요/.test(en.wins[0].document.getElementById('gbList').children[0].textContent), '내 코드 없음 → 요청 0 · «불러오지 못했어요»');
  });

  await sec('── 4. 쓰기 · 삭제 · 박수 · 폭죽 · 그림', async () => {
    const e = mkEnv({ src: MOD, answers: { view: bookOf({ entries: [ent('m1', { mine: true })], clap: { count: 3, img: null, emoji: '🎉', todayLeft: 5, dailyMax: 5 }, version: 6 }) } });
    e.mk(); e.ctx._mhGbStartWatch(); await flush(); e.ctx.openMyGuestbook(); await flush(); e.calls.length = 0;
    const d = e.wins[0].document, inp = d.getElementById('gbInput');
    chk(d.getElementById('gbSubmit').onclick && (inp._L.keydown || []).length === 1 && (inp._L.input || []).length === 1, '등록 버튼 · Enter · 입력하면 안내 치움');
    inp.value = '  안녕하세요  '; await d.getElementById('gbSubmit').onclick(); await flush();
    chk(e.calls[0] === 'write:uA|uA|안녕하세요|rid-1' && inp.value === '' && e.calls[1] === 'view:uA|uA', '등록 — 홈 주인 방명록에 · 글(다듬음) · 요청 번호 · 칸 비움 · 서버가 됐다 하면 다시 받는다(이름 · 시각 · 내 코드는 안 보낸다)');
    inp.value = 'x'.repeat(150); inp.fire('keydown', { key: 'Enter' }); await flush();
    chk(e.calls.some(c => c.startsWith('write:uA|uA|' + 'x'.repeat(100) + '|')), '  Enter 로도 · 100자까지');
    e.answers.write = { status: 'failed', err: apiErr(503, 'X') }; inp.value = '실패'; await d.getElementById('gbSubmit').onclick(); await flush();
    const msg = d.getElementById('gbMsg');
    chk(msg.style.display === 'block' && /오류 E-NET-07/.test(msg.textContent) && e.toasts.some(t => /오류 E-NET-07/.test(t)) && inp.value === '실패', '실패 — 창 안 안내줄(오류 번호 글)과 토스트 둘 다 · 쓴 글은 남겨 둔다');
    inp.fire('input'); chk(msg.style.display === 'none', '  다시 쓰기 시작하면 안내를 치운다');
    e.answers.write = { status: 'failed', err: apiErr(403, 'GUESTBOOK_NOT_FRIEND') }; inp.value = '몰래'; await d.getElementById('gbSubmit').onclick(); await flush();
    chk(/오류 E-GB-03/.test(msg.textContent), '서버가 친구가 아니라고 거절하면 E-GB-03 글');
    e.answers.write = undefined;
    /* 삭제 */
    const del = d.getElementById('gbList').children[0].querySelector('.gb-meta').children[0];
    e.calls.length = 0; await del.onclick(); await flush();
    chk(e.calls[0] === 'remove:uA|uA|m1', '삭제 — 홈 주인 방명록의 그 글(id)');
    e.answers.remove = { status: 'failed', err: apiErr(403, 'GUESTBOOK_NOT_AUTHOR') }; await del.onclick(); await flush();
    chk(/오류 E-GB-04/.test(msg.textContent), '  남의 글이라는 거절은 창 안에도');
    /* 박수 — 셈은 서버 */
    const box = d.getElementById('gbClapBox'); e.calls.length = 0; e.toasts.length = 0;
    const hold = deferred(); e.answers.clap = () => hold.p;
    const p1 = box.onclick({ clientX: 10, clientY: 10 });
    const p2 = box.onclick({}); await flush();
    chk(e.calls.filter(c => c.startsWith('clap')).length === 1 && e.toasts.indexOf('박수를 보내는 중이에요 — 잠시만요 👏') >= 0, '보내는 중엔 또 안 보낸다');
    const body = d.getElementById('gbBody');
    chk(body.children.length === 16 && body.children.every(s => s.className === 'gb-fw' && s.textContent === '🎉'), '  🎆 폭죽은 서버 답 전에 터뜨린다(조각 16개) — 한 번만');
    hold.res({ status: 'ok', count: 4, todayLeft: 2, dailyMax: 5 }); await p1; await p2; await flush();
    chk(e.toasts.indexOf('👏 박수! (3/5)') >= 0 && d.getElementById('gbClapTotal').textContent === 'TOTAL CLAP : 4', '  답이 오면 «박수! (3/5)» — 하루 몫은 서버가 준 남은 수(5 - 2) · 합계도 서버 값');
    chk(!Object.keys(e.ls).some(k => /^gbClap:/.test(k)), '  이 PC 에 박수 횟수를 적지 않는다(셈은 서버)');
    e.answers.clap = { status: 'failed', err: apiErr(429, 'GUESTBOOK_CLAP_DAILY_LIMIT') }; e.toasts.length = 0; e.notes.length = 0;
    await box.onclick({}); await flush();
    chk(e.toasts.indexOf('오늘은 이 홈에 박수를 다 쳤어요 👏') >= 0 && e.notes.length === 0, '하루 몫을 다 쓰면 안내만(오류 번호 없음)');
    e.answers.view = bookOf({ clap: { count: 4, img: null, emoji: '🎉', todayLeft: 0, dailyMax: 5 } }); e.feed.refreshBook(); await flush();
    body.children.length = 0; await box.onclick({}); await flush();
    chk(body.children.length === 0, '  오늘 몫이 없다고 서버가 알려 준 홈에서는 폭죽을 터뜨리지 않는다');
    e.answers.clap = { status: 'failed', err: apiErr(503, 'X') }; e.answers.view = bookOf({ clap: { count: 4, img: null, emoji: '🎉', todayLeft: 3, dailyMax: 5 }, version: 6 }); e.feed.refreshBook(); await flush();
    e.toasts.length = 0; await box.onclick({}); await flush();
    chk(/오류 E-NET-07/.test(msg.textContent) && e.toasts.some(t => /오류 E-NET-07/.test(t)), '닿지 못한 박수는 오류 번호 글(창 안에도)');
    /* 🎆 폭죽 — 한 글자만 · 바뀌었을 때만 저장 */
    const em = d.getElementById('gbClapEmoji'); e.calls.length = 0; e.toasts.length = 0; body.children.length = 0;
    e.answers.look = (u, v, pj) => { e.answers.view = bookOf({ clap: { count: 4, img: null, emoji: JSON.parse(pj).clapEmoji || '', todayLeft: 3, dailyMax: 5 }, version: +v + 1 }); };   // 가짜 서버 — 바꾸면 새 판이 된다
    em.value = '🎊🎉 축하'; await em.onchange(); await flush();
    chk(em.value === '🎊' && e.calls[0] === 'look:uA|6|{"clapEmoji":"🎊"}' && e.toasts.indexOf('🎊 폭죽으로 바꿨어요') >= 0, '폭죽 이모지는 한 글자만 · 받은 판(version)으로 저장');
    chk(body.children.length === 16 && body.children.every(s => s.textContent === '🎊'), '  바꾸면 바로 터뜨려 본다(방금 고른 것으로)');
    e.calls.length = 0; em.value = '🎊'; await em.onchange(); await flush();
    chk(e.calls.filter(c => c.startsWith('look')).length === 0, '  안 바뀌었으면(서버 값 그대로) 저장 안 함');
    em.value = ''; await em.onchange(); await flush();
    chk(e.calls.some(c => c === 'look:uA|7|{"clapEmoji":null}') && e.toasts.indexOf('폭죽을 껐어요') >= 0, '  비우면 끈다(null)');
    em.value = '🎊'; await em.onchange(); await flush();   // 다시 켜 둔다(서버 값 🎊)
    e.answers.look = { status: 'failed', err: apiErr(400, 'GUESTBOOK_EMOJI_INVALID') }; em.value = '🎈'; await em.onchange(); await flush();
    chk(/오류 E-GB-05/.test(msg.textContent) && em.value === '🎊', '  저장 실패 — 오류 글 · 입력칸을 서버 값으로 되돌린다');
    /* 그림 — 서버에 길이 생길 때까지 옛 길 */
    d.getElementById('gbImgSet').onclick();
    chk(e.held === 1 && d.getElementById('gbClapImgFile').clicked === 1, '이미지 등록 — 창이 안 닫히게 유예하고 자식 창의 파일 칸을 누른다');
    chk(!/firebaseAPI|setClapImage/.test(strip(MOD)) && /feed\.setImage\(data\)/.test(MOD), '  그림 올리기는 feed.setImage(서버 그림 길 → PATCH)를 부른다 — 모듈이 Firebase 를 안 만진다');
  });

  await sec('── 5. app.js 배선', () => {
    const code = strip(APP);
    chk(!/function (bindGuestbook|bindGuestbookBadge|_gbApplyWriteUI|_gbSubscribeIfNeeded|_gbAlive|gbFirstGrapheme|gbBurst|gbSay)\(|\bconst GB_HTML\b|window\.(openMyGuestbook|_mhGb\w+|_mhReSubscribeGuestbook)\s*=(?!=)/.test(code),
      '방명록 정의 · 고리 등록은 app.js 에 없다(모듈에만)');
    chk(/const GB_HTML = /.test(MOD) && /window\.openMyGuestbook=open;/.test(MOD) && /window\.TwGuestbook = api/.test(MOD), '모듈에 GB_HTML · 고리 · window.TwGuestbook');
    chk((code.match(/TwGuestbook\.createGuestbook\(/g) || []).length === 1, 'createGuestbook 은 한 곳');
    const iMk = APP.indexOf('TwGuestbook.createGuestbook('), iFeed = APP.indexOf('TwGuestbookFeed.createGuestbookFeed('), iPrev = APP.indexOf('🎨 스티커 관리 창'), iNext = APP.indexOf('const CHAT_BUBBLE_MS = 5000;');
    chk(iPrev > 0 && iFeed > iPrev && iMk > iFeed && iNext > iMk, '원래 자리 — 🎨 스티커 관리 창 뒤 · feed 를 먼저 만들고 그다음 화면 · 💬 말풍선(showChatBubble) 앞');
    chk(/function showChatBubble\(seat, text\)/.test(APP) && !/showChatBubble/.test(strip(MOD)), '💬 showChatBubble 은 app.js 에 남는다');
    const call = (APP.match(/TwGuestbook\.createGuestbook\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
    const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
    chk(deps.length === 10 && deps.every(l => /^\w+: (\(\)=>|\(\.\.\.a\)=>|\(\w+(, \w+)?\)=>|guestbookFeed,)/.test(l)), 'deps 10개 — feed 말고는 전부 화살표로 감싼다(부를 때 찾게) (' + deps.length + ')');
    chk(/mhViewingUserId: \(\)=>_mhViewingUserId,/.test(call) && !/myHomeFriends/.test(call), '다시 대입되는 값은 읽는 함수로 · 친구 목록은 더 안 받는다(쓰기 판정은 서버 canWrite)');
    const m = strip(MOD);
    chk(!/_mhViewingUserId(?!\s*\(|!==|\s*===)/.test(m.replace(/const _mhViewingUserId = deps\.mhViewingUserId;/, '')), '모듈 본문은 읽는 함수만 부른다(값으로 쓰면 함수가 늘 참이 된다)');
    chk(!/\bGUESTBOOK_OFF\b/.test(APP), '빈 껍데기 GUESTBOOK_OFF 없음 — 모듈은 늘 싣는다');
    const guarded = (code.match(/typeof (window\.)?(_mhGb\w+|_mhReSubscribeGuestbook)\s*===\s*'function'/g) || []).length;
    const calls = (code.match(/(?<![\w.])(window\.)?(_mhGb(?:StartWatch|StopWatch|RefreshBadge|MarkAllRead)|_mhReSubscribeGuestbook)\(/g) || []).length;
    chk(guarded === 0 && calls >= 6, '부르는 곳(마이홈 열기 · 닫기 · 관람 시작 · 끝 · 런처로)은 window 고리를 가드 없이 부른다 (부르는 곳 ' + calls + ' · 가드 ' + guarded + ')');
    chk(!/_mhGbRefreshWriteUI/.test(code), '친구 목록이 오면 방명록 쓰기 칸을 다시 칠하던 고리가 app.js 쪽에 없다');
    chk(!/gbClap:/.test(m) && !/__gbClapInflight/.test(m) && !/localStorage/.test(m) && !/\bfirebaseAPI\b/.test(m), '옛 장치(하루 5번 localStorage · 응답 대기 목록 · Firebase 직접)가 모듈에 없다');
    const iG = HTML.indexOf('<script src="parts/myhome/guestbook.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>'), iF = HTML.indexOf('<script src="parts/myhome/guestbook-feed.js"></script>');
    chk(iF > 0 && iF < iG && iG < iA, 'html — guestbook-feed.js → guestbook.js → app.js 순서');
    chk(/^Tw[A-Z]/.test('TwGuestbook') && !/window\.Guestbook\s*=/.test(MOD), '전역 이름은 Tw 접두사');
  });
}

(async () => {
  const S = { MOD: SRC['guestbook.js'] };
  await judge(S);
  say('── 6. 일부러 깨 보기');
  const M = S.MOD;
  const breaks = [
    ['친구 목록으로 쓰기를 다시 판정', M.replace("row.style.display = (v && v.canWrite) ? 'flex' : 'none';", "row.style.display = 'flex';"), 'canWrite'],
    ['받는 중에도 입력칸을 보임', M.replace("row.style.display = (v && v.canWrite) ? 'flex' : 'none';", "row.style.display = (!v || v.canWrite) ? 'flex' : 'none';"), '받기 전에는 입력칸'],
    ['못 받음을 «글이 없다» 로 그림', M.replace("if(!v){   // 받는 중", "if(false){   // 받는 중"), '못 받음'],
    ['내 글이 아닌 글에도 삭제', M.replace("if(en.mine){", "if(true){"), '삭제 링크'],
    ['창이 닫혀도 방명록을 안 거둠', M.replace("thisWin.addEventListener('pagehide', ()=>{ if(_gbWin === thisWin){ _gbWin = null; feed.closeBook(); } });", ""), '창이 닫히면'],
    ['옛 창의 pagehide 가 새 방명록을 닫음', M.replace("if(_gbWin === thisWin){ _gbWin = null; feed.closeBook(); }", "{ _gbWin = null; feed.closeBook(); }"), '늦은 pagehide'],
    ['홈 주인이 바뀌어도 방명록을 안 비움', M.replace("    feed.closeBook();\n    _gbCurrentTarget = target;", "    _gbCurrentTarget = target;"), '홈 주인이 바뀌면'],
    ['다 읽음을 관람 중에도 씀', M.replace("    if(_mhViewingUserId()) return;\n    feed.markRead();", "    feed.markRead();"), '관람 중엔'],
    ['배지를 글 목록에서 셈', M.replace("const n = feed.badgeCount();", "const n = (feed.view() && feed.view().entries.length) || 0;"), '숫자 하나'],
    ['박수 폭죽을 오늘 몫 없어도 터뜨림', M.replace("if(v0 && v0.clap.todayLeft > 0){", "if(true){"), '터뜨리지 않는다'],
    ['박수 하루 횟수를 앱이 적음', M.replace("const r=await feed.clap();", "try{ localStorage.setItem('gbClap:x', '1'); }catch(_){}\n      const r=await feed.clap();"), '박수 횟수를 적지'],
    ['박수 중 또 눌러도 보냄', M.replace("if(feed.clapBusy()){ toast('박수를 보내는 중이에요 — 잠시만요 👏'); return; }", ""), '또 안 보낸다'],
    ['하루 몫 남은 수를 앱이 셈', M.replace("(r.dailyMax - r.todayLeft)", "1"), '하루 몫은 서버가 준 남은 수'],
    ['폭죽 저장 실패 때 입력칸을 안 되돌림', M.replace("    renderClap();   // 저장하지 못했다", "    // renderClap();   // 저장하지 못했다"), '서버 값으로 되돌린다'],
    ['실패를 창 안에 안 보임', M.replace("if(r.reason==='failed') gbShow(errorText(r.code || 'E-SYS-01'));   // 오류 번호 알림은 feed 가 이미 띄웠다\n    // closed", "// closed"), '창 안 안내줄'],
  ];
  for(const [name, src, what] of breaks){
    if(src === M){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0; const cw = console.warn; console.warn = () => {};   // 깨 본 모듈이 내는 경고는 소리 없이
    try{ await judge({ MOD: src }); }catch(_){ qfail++; }
    quiet = false; console.warn = cw;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('');
  say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
  console.log(pass + ' · ' + fail);
  done = true;
  process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
