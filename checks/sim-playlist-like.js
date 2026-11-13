/* sim-playlist-like.js — 👍 플레이리스트 «노래가 좋아요»(playlist-like.js · playlist-like-ui.js · 규칙 playlistLikes)
   실행:  node checks/run.js sim-playlist-like
   ★ 왜 이 검사가 있는가 — 받는 사람에게는 숫자만 · 누른 사람은 프리셋 하나에 평생 한 번(사용자 결정 2026-11-13).
     그 «한 번» 과 «숫자를 부풀릴 수 없음» 은 규칙이 지킨다 — 그래서 진짜 규칙식을 진짜 서버 모듈의 쓰기에 걸어 돌린다.
   ・1절: 화면 모양(view) · 프리셋 번호 — 입력 → 출력 · 경계(범위 밖 · 내 것 · 못 읽음 · 누르는 중)
   ・2절: 서버 모듈 + 규칙 — 누르기 · 두 번째는 막힘 · 내 것 · 동시에 누름 다시 하기 · 남이 count 만 올리기 · 남의 이름으로 누르기 · 지우기 · 읽기 권한
   ・3절: 서랍 화면 — 수만 · 열고 닫기(Esc · 바깥) · 보냈어요로 잠김 · 같은 프리셋은 다시 안 읽음 · 닫힌 창은 안 읽음 · 실패 안내
   ・4절: 연결 — html 순서 · app.js · firebase-init.js · 에러 번호
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (...c) => { for (const f of c) for (const p of [f, 'app/parts/' + f, path.join('apps', 'desktop', 'app', 'parts', f), path.basename(f)]) if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8'); return null; };
const SRC = {
  mod: read('status/playlist-like.js'), ui: read('status/playlist-like-ui.js'), ws: read('shared/win-stack.js'), app: read('app.js'), fi: read('firebase-init.js'),
  html: read('desk-companion-prototype.html', '../desk-companion-prototype.html'), codes: read('shared/error-codes.js'),
  rules: read('firebase-database-rules.json', '../firebase-database-rules.json', path.join('firebase', 'firebase-database-rules.json')),
};
for (const [k, v] of Object.entries(SRC)) if (!v) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src, name) => { const win = {}; new Function('window', 'module', 'document', src)(win, undefined, globalThis.document); return win[name]; };

/* ── 규칙 실행기 — 이 노드에 필요한 만큼(cascade .write · 길 위 .validate · $other · .read) */
Object.defineProperty(String.prototype, 'matches', { value: function(re){ return re.test(String(this)); }, configurable: true });
const getAt = (t, p) => p.split('/').filter(Boolean).reduce((o, k) => (o && typeof o === 'object' && k in o) ? o[k] : undefined, t);
const clone = (x) => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
function setAt(t, p, v){
  const ks = p.split('/').filter(Boolean); let o = t;
  for (let i = 0; i < ks.length - 1; i++){ if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
  if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clone(v);
}
function snap(tree, p){
  const v = getAt(tree, p);
  return { exists: () => v !== undefined && v !== null, val: () => v === undefined ? null : v,
    isString: () => typeof v === 'string', isNumber: () => typeof v === 'number',
    child: (k) => snap(tree, p + '/' + k), parent: () => snap(tree, p.split('/').slice(0, -1).join('/')) };
}
function ruleChain(rules, p){   // 'playlistLikes/U1/0/by/U2' → [{node, vars}]
  const ks = p.split('/').filter(Boolean); let node = rules; const vars = {}; const out = [];
  for (const k of ks){
    if (node[k]) node = node[k];
    else { const v = Object.keys(node).find(x => x[0] === '$' && x !== '$other'); if (v){ vars[v] = k; node = node[v]; } else if (node.$other) { node = node.$other; } else return null; }
    out.push({ node, vars: Object.assign({}, vars), path: ks.slice(0, out.length + 1).join('/') });
  }
  return out;
}
function evalRule(expr, ctx){
  if (expr === true || expr === false) return expr;
  const names = ['$ownerId', '$preset', '$authUid'];
  return !!new Function(...names, 'auth', 'root', 'data', 'newData', 'now', 'return (' + expr + ');')(...names.map(n => ctx.vars[n]), ctx.auth, ctx.root, ctx.data, ctx.newData, 1700000000000);
}
function makeServer(R, init){
  const S = { tree: clone(init) || {}, denied: 0 };
  S.canRead = (p, authUid) => {
    const chain = ruleChain(R, p); if (!chain) return false;
    return chain.some(c => c.node['.read'] !== undefined && evalRule(c.node['.read'], { vars: c.vars, auth: authUid ? { uid: authUid } : null, root: snap(S.tree, ''), data: snap(S.tree, c.path) }));
  };
  S.apply = (w, authUid) => {
    const before = S.tree, after = clone(before) || {};
    for (const [p, v] of Object.entries(w)) setAt(after, p, v);
    const auth = authUid ? { uid: authUid } : null;
    for (const p of Object.keys(w)){
      const chain = ruleChain(R, p);
      if (!chain) throw new Error('PERMISSION_DENIED ' + p);
      const okW = chain.some(c => c.node['.write'] !== undefined && evalRule(c.node['.write'], { vars: c.vars, auth, root: snap(before, ''), data: snap(before, c.path), newData: snap(after, c.path) }));
      const okV = w[p] === null || chain.every(c => c.node['.validate'] === undefined || evalRule(c.node['.validate'], { vars: c.vars, auth, root: snap(before, ''), data: snap(before, c.path), newData: snap(after, c.path) }));
      if (!okW || !okV){ S.denied++; throw new Error('PERMISSION_DENIED ' + p); }
    }
    S.tree = after;
  };
  return S;
}
/* firebase 모양 provider — 이 사람(auth)으로 읽고 쓴다 */
function sdkFor(S, authUid, hook){
  const uidFn = () => authUid;
  const ref = (db, p) => ({ p: p || '' });
  const get = async (r) => { if (!S.canRead(r.p, authUid)) throw new Error('PERMISSION_DENIED read ' + r.p); const s = snap(S.tree, r.p); return { val: s.val, exists: s.exists }; };
  const update = async (r, w) => { if (hook) await hook(w); S.apply(w, authUid); };
  return { db: {}, ref, get, update, authUid: uidFn };
}
const AUTH = { userAuth: { uAAAAAAAA1: 'authA', uBBBBBBBB2: 'authB', uOOOOOOOO0: 'authO' } };

/* ── 가짜 DOM(서랍 화면에 필요한 만큼) */
function mkDom(){
  const listeners = [];
  const el = (id) => ({ id, style: {}, textContent: '', title: '', disabled: false, _cls: new Set(), _ev: {}, offsetWidth: 150,
    classList: { add(c){ this._o._cls.add(c); }, remove(c){ this._o._cls.delete(c); }, contains(c){ return this._o._cls.has(c); }, toggle(c, on){ (on === undefined ? !this._o._cls.has(c) : on) ? this._o._cls.add(c) : this._o._cls.delete(c); } },
    addEventListener(t, f){ this._ev[t] = f; }, contains(x){ return x === this; }, getBoundingClientRect: () => ({ left: 100, right: 336, top: 100, bottom: 400 }) });
  const ids = ['myPlLikeRow', 'myPlLikeCnt', 'myPlReact', 'myPlLikeBtn', 'myPlLikeDrawerCnt', 'myPlLikeDrawer', 'myPlaylistBox'];
  const byId = {}; ids.forEach(i => { byId[i] = el(i); byId[i].classList._o = byId[i]; });
  const doc = { getElementById: (i) => byId[i] || null,
    addEventListener: (t, f) => listeners.push([t, f]), removeEventListener: (t, f) => { const i = listeners.findIndex(x => x[0] === t && x[1] === f); if (i >= 0) listeners.splice(i, 1); },
    /* «#id.클래스» 꼴만 알아듣는다 — win-stack 의 양보 목록(ESC_YIELD_SEL)이 쓰는 모양 */
    querySelector: (sel) => { for (const one of String(sel).split(',')) { const m = /^\s*#([\w-]+)((?:\.[\w-]+)*)\s*$/.exec(one); if (!m) continue; const n = byId[m[1]]; if (n && m[2].split('.').filter(Boolean).every(c => n._cls.has(c))) return n; } return null; },
    fire: (t, e) => { const ev = Object.assign({ defaultPrevented: false, stopPropagation(){}, preventDefault(){ ev.defaultPrevented = true; } }, e); listeners.filter(x => x[0] === t).slice().forEach(x => x[1](ev)); } };
  const click = (i) => byId[i]._ev.click({ stopPropagation(){} });
  return { byId, doc, click, listeners };
}
const flush = () => new Promise(r => setImmediate(r));

async function judge(src){
  const r = {};
  try {
    const L = load(src.mod, 'TwPlaylistLike');
    const R = JSON.parse(src.rules).rules;
    /* 1절 */
    const v = L.view;
    r.key = L.presetKey(0) === '0' && L.presetKey('2') === '2' && L.presetKey(3) === null && L.presetKey(-1) === null && L.presetKey(1.5) === null && L.presetKey(null) === null && L.presetKey(undefined) === null;
    const O = { ro: true, ownerId: 'uOOOOOOOO0', myId: 'uAAAAAAAA1', setIdx: 1 };
    r.view = v(null, null).mode === 'none' && v({ ro: true, ownerId: 'x', myId: 'y', setIdx: 5 }, {}).mode === 'none' && v({ ro: true, ownerId: '', myId: 'y', setIdx: 0 }, {}).mode === 'none'
      && v({ ro: false, ownerId: 'uAAAAAAAA1', myId: 'uAAAAAAAA1', setIdx: 0 }, { loaded: true, count: 4 }).mode === 'count'
      && v({ ro: false, ownerId: 'uAAAAAAAA1', myId: 'uAAAAAAAA1', setIdx: 0 }, { loaded: true, count: 4 }).count === 4
      && v({ ro: true, ownerId: 'uAAAAAAAA1', myId: 'uAAAAAAAA1', setIdx: 0 }, { loaded: true }).mode === 'count'
      && v(O, { loaded: true, count: 2 }).mode === 'react' && v(O, { loaded: true, count: 2 }).disabled === false && v(O, { loaded: true, count: 2 }).label === '노래가 좋아요 👍'
      && v(O, { loaded: true, mine: true }).disabled === true && v(O, { loaded: true, mine: true }).label === '보냈어요 👍'
      && v(O, { loaded: false }).disabled === true && v(O, { loaded: true, failed: true }).disabled === true && v(O, { loaded: true, failed: true }).count === null
      && v(O, { loaded: true, busy: true }).disabled === true && v(O, { loaded: true, count: -3 }).count === 0;
    /* 2절 — 진짜 서버 모듈 + 진짜 규칙 */
    const S = makeServer(R, AUTH);
    const A = L.createPlaylistLikeNet(sdkFor(S, 'authA')), B = L.createPlaylistLikeNet(sdkFor(S, 'authB')), Ow = L.createPlaylistLikeNet(sdkFor(S, 'authO'));
    const r1 = await A.like('uOOOOOOOO0', 1, 'uAAAAAAAA1');
    r.like = r1.ok === true && r1.count === 1 && getAt(S.tree, 'playlistLikes/uOOOOOOOO0/1/count') === 1 && getAt(S.tree, 'playlistLikes/uOOOOOOOO0/1/by/authA') === true && getAt(S.tree, 'playlistLikes/uOOOOOOOO0/1/by/uAAAAAAAA1') === undefined;
    const r2 = await A.like('uOOOOOOOO0', 1, 'uAAAAAAAA1');
    r.once = r2.ok === false && r2.reason === 'already' && getAt(S.tree, 'playlistLikes/uOOOOOOOO0/1/count') === 1;
    const rB = await B.like('uOOOOOOOO0', 1, 'uBBBBBBBB2'), rOther = await A.like('uOOOOOOOO0', 0, 'uAAAAAAAA1');
    r.perPreset = rB.ok && rB.count === 2 && rOther.ok && rOther.count === 1;
    r.self = (await Ow.like('uOOOOOOOO0', 1, 'uOOOOOOOO0')).reason === 'self';
    r.readBack = JSON.stringify(await Ow.read('uOOOOOOOO0', 1, 'uOOOOOOOO0')) === '{"count":2,"mine":false}' && JSON.stringify(await A.read('uOOOOOOOO0', 1, 'uAAAAAAAA1')) === '{"count":2,"mine":true}';
    /* 규칙만으로 막혀야 하는 것 — 앱을 거치지 않고 직접 쓴다 */
    const deny = (w, who) => { try { S.apply(w, who); return false; } catch (_){ return true; } };
    const P = 'playlistLikes/uOOOOOOOO0/1/';
    r.rulesBlock = deny({ [P + 'count']: 3 }, 'authA')                                                   // count 만
      && deny({ [P + 'count']: 3, [P + 'last']: 'authA', [P + 'by/authA']: true }, 'authA')                 // 이미 누른 사람
      && deny({ [P + 'count']: 3, [P + 'last']: 'authO', [P + 'by/authO']: true }, 'authO')                 // 내 것에(userAuth/주인 = 나)
      && deny({ [P + 'count']: 3, [P + 'last']: 'authE', [P + 'by/authE']: true }, 'authA')                 // 남의 토큰 칸으로
      && deny({ [P + 'count']: 9, [P + 'last']: 'authC', [P + 'by/authC']: true }, null)                    // 로그인 안 함
      && deny({ [P + 'by/authA']: null }, 'authA') && deny({ [P + 'count']: null }, 'authO')               // 지우기(취소 없음)
      && deny({ [P + 'x']: 1 }, 'authA') && deny({ 'playlistLikes/uOOOOOOOO0/7/count': 1 }, 'authA');        // 모르는 칸 · 프리셋 밖
    r.rulesBlock = r.rulesBlock && deny({ [P + 'count']: 4, [P + 'last']: 'authD', [P + 'by/authD']: true }, 'authD')   // +2 (지금 2 → 4)
      && !deny({ [P + 'count']: 3, [P + 'last']: 'authD', [P + 'by/authD']: true }, 'authD');                         // 정상 한 번
    /* 빈 친구 코드를 새로 내 uid 에 이어 붙여(userAuth) 그 코드로 또 누르기 — 표시가 토큰 칸이라 «이미» 이고, 직접 써도 막힌다 */
    S.tree.userAuth.uNEWCODE99 = 'authA';
    const rNew = await A.like('uOOOOOOOO0', 1, 'uNEWCODE99');
    r.newCode = rNew.ok === false && rNew.reason === 'already' && getAt(S.tree, P + 'count') === 3
      && deny({ [P + 'count']: 4, [P + 'last']: 'authA', [P + 'by/authA']: true }, 'authA')
      && deny({ [P + 'count']: 4, [P + 'last']: 'uNEWCODE99', [P + 'by/uNEWCODE99']: true }, 'authA');
    r.readRule = S.canRead(P + 'count', 'authB') && !S.canRead(P + 'count', null) && S.canRead(P + 'by/authA', 'authA') && !S.canRead(P + 'by/authA', 'authO')
      && !S.canRead(P + 'by/authA', 'authB') && !S.canRead(P + 'last', 'authO') && !S.canRead('playlistLikes/uOOOOOOOO0/1', 'authO') && !S.canRead('playlistLikes/uOOOOOOOO0', 'authO');
    /* 동시에 누름 — 내 쓰기 직전에 다른 사람이 먼저 눌렀다 → 규칙에 막히고 다시 읽어 성공 */
    const S2 = makeServer(R, AUTH); let raced = false;
    const BB = L.createPlaylistLikeNet(sdkFor(S2, 'authB'));
    const AA = L.createPlaylistLikeNet(sdkFor(S2, 'authA', async () => { if (!raced){ raced = true; await BB.like('uOOOOOOOO0', 2, 'uBBBBBBBB2'); } }));
    const rr = await AA.like('uOOOOOOOO0', 2, 'uAAAAAAAA1');
    r.race = raced && rr.ok && rr.count === 2 && S2.denied === 1 && getAt(S2.tree, 'playlistLikes/uOOOOOOOO0/2/count') === 2;
    const dead = L.createPlaylistLikeNet({ db: {}, ref: () => ({}), get: async () => { throw new Error('off'); }, update: async () => { throw new Error('off'); }, authUid: () => 'authA' });
    const noLogin = L.createPlaylistLikeNet(Object.assign(sdkFor(S, null), { authUid: () => null }));
    r.fail = (await dead.read('uOOOOOOOO0', 0, 'uAAAAAAAA1')) === null && (await dead.like('uOOOOOOOO0', 0, 'uAAAAAAAA1')).reason === 'fail'
      && (await dead.like('uOOOOOOOO0', 9, 'uAAAAAAAA1')).reason === 'fail' && (await dead.read('', 0, 'x')) === null
      && (await noLogin.like('uOOOOOOOO0', 0, 'uAAAAAAAA1')).reason === 'fail';   // 로그인 토큰이 없으면 누르지 않는다
    /* 3절 — 서랍 화면 */
    const D = mkDom(); globalThis.document = D.doc; globalThis.window = { innerWidth: 1920 };
    /* ⎋ 앱과 같은 순서 — win-stack(document 캡처 · 먼저 등록)을 먼저 만들고 플레이리스트 창을 올린다 */
    globalThis.MutationObserver = class { observe(){} };
    const WS = load(src.ws, 'TwWinStack').createWinStack({});
    let winClosed = 0;
    WS.escRegisterWindow({ key: 'playlist', el: D.byId.myPlaylistBox, isOpen: () => true, close: () => { winClosed++; } });
    const U = load(src.ui, 'TwPlaylistLikeUi');
    const S3 = makeServer(R, AUTH); let reads = 0; const errs = [];
    const sdk = sdkFor(S3, 'authA'); const g0 = sdk.get; sdk.get = async (x) => { reads++; return g0(x); };
    const net3 = L.createPlaylistLikeNet(sdk);
    S3.apply({ 'playlistLikes/uOOOOOOOO0/1/count': 1, 'playlistLikes/uOOOOOOOO0/1/last': 'authB', 'playlistLikes/uOOOOOOOO0/1/by/authB': true }, 'authB');
    const ui = U.createPlaylistLikeUi({ likeRules: L, net: () => net3, getMyUserId: () => 'uAAAAAAAA1', notifyError: (c, e) => errs.push(c) });
    const $ = D.byId;
    ui.render(null);
    r.closedNoRead = reads === 0 && $.myPlLikeRow.style.display === 'none';
    ui.render({ ro: false, ownerId: 'uAAAAAAAA1', setIdx: 0 }); await flush(); await flush();
    r.mine = $.myPlLikeRow.style.display === '' && $.myPlLikeCnt.style.display === '' && $.myPlLikeCnt.textContent === '👍 0' && $.myPlReact.style.display === 'none';
    const rd = reads; ui.render({ ro: true, ownerId: 'uOOOOOOOO0', setIdx: 1 }); await flush(); await flush();
    r.other = $.myPlReact.style.display === '' && $.myPlLikeCnt.style.display === 'none' && reads === rd + 2;
    const rd2 = reads; ui.render({ ro: true, ownerId: 'uOOOOOOOO0', setIdx: 1 }); ui.render({ ro: true, ownerId: 'uOOOOOOOO0', setIdx: 1 }); await flush();
    r.noReread = reads === rd2;
    D.click('myPlReact');
    r.open = $.myPlLikeDrawer.classList.contains('on') && $.myPlLikeBtn.textContent === '노래가 좋아요 👍' && !$.myPlLikeBtn.disabled && $.myPlLikeDrawerCnt.textContent === '지금까지 👍 1';
    D.doc.fire('keydown', { key: 'Escape' });
    const escClosed = !$.myPlLikeDrawer.classList.contains('on');
    D.click('myPlReact'); D.doc.fire('mousedown', { target: {} });
    const outClosed = !$.myPlLikeDrawer.classList.contains('on');
    D.click('myPlReact'); D.doc.fire('mousedown', { target: $.myPlLikeDrawer });
    r.escYield = escClosed && winClosed === 0;   // 서랍만 닫히고 창은 남는다
    r.close = escClosed && outClosed && $.myPlLikeDrawer.classList.contains('on') && D.listeners.filter(x => x[1].name === 'onKey' || x[1].name === 'onDown').length === 2;
    D.click('myPlLikeBtn'); await flush(); await flush(); await flush(); await flush();
    r.sent = $.myPlLikeBtn.textContent === '보냈어요 👍' && $.myPlLikeBtn.disabled && $.myPlLikeDrawerCnt.textContent === '지금까지 👍 2' && getAt(S3.tree, 'playlistLikes/uOOOOOOOO0/1/by/authA') === true;
    ui.render({ ro: true, ownerId: 'uBBBBBBBB2', setIdx: 0 });
    r.switchCloses = !$.myPlLikeDrawer.classList.contains('on') && D.listeners.filter(x => x[1].name === 'onKey' || x[1].name === 'onDown').length === 0;
    D.doc.fire('keydown', { key: 'Escape', target: {} });
    r.escYield = r.escYield && winClosed === 1;   // 서랍이 닫혀 있으면 Esc 는 예전처럼 창을 닫는다
    await flush(); await flush();
    const bad = U.createPlaylistLikeUi({ likeRules: L, net: () => ({ read: async () => ({ count: 0, mine: false }), like: async () => ({ ok: false, reason: 'fail' }) }), getMyUserId: () => 'uAAAAAAAA1', notifyError: (c) => errs.push(c) });
    bad.render({ ro: true, ownerId: 'uOOOOOOOO0', setIdx: 0 }); await flush(); await flush();
    D.click('myPlLikeBtn'); await flush(); await flush();
    r.err = errs.join() === 'E-SYS-04';
    const gone = U.createPlaylistLikeUi({ likeRules: L, net: () => ({ read: async () => null, like: async () => ({ ok: true }) }), getMyUserId: () => 'uAAAAAAAA1', notifyError: () => {} });
    gone.render({ ro: false, ownerId: 'uAAAAAAAA1', setIdx: 0 }); await flush(); await flush();
    r.failRow = $.myPlLikeRow.style.display === 'none';   // 내 수를 못 읽으면 줄을 숨긴다(0 으로 그리지 않는다)
  } catch (e) { r.err0 = e && (e.stack || e.message); }
  return r;
}

function wire(S){
  const out = []; const w = (ok, m) => out.push([!!ok, m]);
  const H = S.html.replace(/<!--[\s\S]*?-->/g, ' ');
  const at = (f) => H.indexOf('<script src="parts/' + f + '"');
  w(at('status/playlist-like.js') > 0 && at('status/playlist-like-ui.js') > at('status/playlist-like.js') && at('status/playlist.js') > at('status/playlist-like-ui.js') && at('app.js') > at('status/playlist.js') && H.indexOf('<script type="module" src="parts/firebase-init.js"') > 0,
    'html — playlist-like.js → playlist-like-ui.js → playlist.js → app.js (서버 연결은 type=module 이라 늦게)');
  w(/id="myPlLikeRow"[^>]*>[\s\S]*?id="myPlLikeCnt"[\s\S]*?id="myPlReact"/.test(H) && /<div id="myPlLikeDrawer" class="plLikeDrawer"[\s\S]*?id="myPlLikeBtn"[\s\S]*?누가 눌렀는지는 안 보여요[\s\S]*?id="myPlLikeDrawerCnt"/.test(H)
    && H.indexOf('id="myPlLikeDrawer"') > H.indexOf('<div id="myPlaylistBox"') && H.indexOf('id="myPlLikeDrawer"') < H.indexOf('id="myPlSetBar"') && !/익명/.test(H.slice(H.indexOf('id="myPlLikeDrawer"'), H.indexOf('id="myPlSetBar"'))),
    '  반응 줄은 소개칸 안 · 서랍은 플레이리스트 창의 자식(끌면 따라온다) · 익명 체크 없음');
  w(/#myPlaylistBox\.mini #myPlLikeRow,#myPlaylistBox\.mini #myPlLikeDrawer\{display:none !important;\}/.test(S.html) && /\.plLikeDrawer\.left\{left:auto;right:calc\(100% \+ 4px\);\}/.test(S.html), '  접으면 숨김 · 자리가 없으면 왼쪽');
  w(/const plLikeUi = TwPlaylistLikeUi\.createPlaylistLikeUi\(\{ likeRules: TwPlaylistLike, net: \(\)=>firebaseAPI\.playlistLike,/.test(S.app) && S.app.indexOf('const plLikeUi = ') < S.app.indexOf('const plMod = TwPlaylist.createPlaylist(') && /\n  playlistLikeUi: plLikeUi,\n\}\);/.test(S.app),
    'app.js — 반응 칸을 플레이리스트보다 먼저 만들어 넘긴다 · 서버는 firebaseAPI.playlistLike(부를 때 찾는다)');
  w(/playlistLike: window\.TwPlaylistLike\.createPlaylistLikeNet\(\{ db, ref, get, update, authUid: \(\) => \(auth && auth\.currentUser\) \? auth\.currentUser\.uid : null \}\)/.test(S.fi), 'firebase-init.js — 연결 한 줄(로그인 uid 를 넘긴다 · 버그 게시판과 같은 길)');
  w(/'E-SYS-04': \{ msg: '[^']+', where: 'status\/playlist-like-ui\.js/.test(S.codes), '에러 번호 E-SYS-04 가 표에 있다');
  w(!/firebaseAPI|document\.|window\.(?!TwPlaylistLike)/.test(S.mod.replace(/\/\*[\s\S]*?\*\//g, '').replace(/if\(typeof window[^\n]*\n/, '')), 'playlist-like.js 는 DOM · firebaseAPI 를 모른다(규칙 · provider 만)');
  return out;
}

(async () => {
  say('── 1 ~ 3. 화면 모양 · 서버 모듈 + 규칙 · 서랍 (진짜 모듈 · 진짜 규칙을 돌린다)');
  const R = await judge(SRC);
  if (R.err0) chk(false, '돌리다 멈춤 — ' + String(R.err0).split('\n').slice(0, 3).join(' | '));
  chk(R.key, 'presetKey — 0~2 만 · 범위 밖 · 소수 · 빈 값은 null');
  chk(R.view, 'view — 내 것은 수만 · 남의 것은 반응 · 보냈으면 잠김 · 못 읽음 · 누르는 중엔 못 누름 · 음수는 0');
  chk(R.like, '누르기 — count 1 · 내 표시(by) 남음');
  chk(R.once, '  두 번째는 «이미» — 수는 그대로(평생 한 번)');
  chk(R.perPreset, '  다른 사람은 같은 프리셋에 · 나는 다른 프리셋에 또 누를 수 있다');
  chk(R.self, '  내 플레이리스트에는 못 누른다');
  chk(R.readBack, '  읽기 — 수 하나 · 내 표시 하나만(주인은 «누가» 를 못 본다)');
  chk(R.rulesBlock, '★ 규칙 — count 만 올리기 · +2 · 남의 토큰 칸 · 내 것 · 로그인 안 함 · 지우기 · 모르는 칸 · 프리셋 밖 전부 거절, 정상 한 번은 통과');
  chk(R.newCode, '★ 빈 친구 코드를 새로 이어 붙여 또 누르기 — 표시가 로그인 토큰 칸이라 «이미» · 직접 써도 거절');
  chk(R.readRule, '★ 읽기 규칙 — 수는 로그인한 누구나 · 표시(by)는 누른 본인만 · last · 노드 통째는 아무도');
  chk(R.race, '  동시에 누르면 늦은 쪽이 규칙에 한 번 막히고 다시 읽어 성공');
  chk(R.fail, '  서버 오류 · 로그인 없음은 던지지 않고 null · fail');
  chk(R.closedNoRead, '서랍 — 창이 닫혀 있으면(null) 읽지 않고 줄을 숨긴다');
  chk(R.mine, '  내 목록 — 👍 수만 · [💬 반응] 없음');
  chk(R.other, '  남의 목록 — [💬 반응] · 수 하나 · 내 표시 하나를 읽는다');
  chk(R.noReread, '  같은 사람 · 같은 프리셋을 다시 그려도 다시 읽지 않는다');
  chk(R.open, '  [💬 반응] → 서랍: 노래가 좋아요 👍 · 지금까지 수');
  chk(R.close, '  Esc · 바깥 누르기로 닫힘 · 서랍 안 누르기는 안 닫힘');
  chk(R.escYield, '  ⎋ 서랍이 열려 있으면 Esc 는 서랍만 닫는다(win-stack 이 양보 · 창은 남음) · 닫혀 있으면 창을 닫는다');
  chk(R.sent, '  누르면 «보냈어요 👍» 로 잠김 · 수 +1 · 서버에 내 표시');
  chk(R.switchCloses, '  다른 사람 목록으로 넘어가면 서랍이 닫히고 듣기도 걷는다');
  chk(R.err, '  보내기 실패는 E-SYS-04');
  chk(R.failRow, '  내 수를 못 읽으면 줄을 숨긴다(0 으로 그리지 않는다 — 실패 ≠ 없음)');

  say('── 4. 연결');
  wire(SRC).forEach(([ok, m]) => chk(ok, m));

  say('── 5. 일부러 깨 보기');
  const R0 = JSON.parse(SRC.rules);
  const brk = async (label, patch, pick) => {
    const s = Object.assign({}, SRC, patch);
    const x = await judge(s);
    chk(!pick(x), label + ' → 빨강');
  };
  const rulesWith = (f) => { const j = JSON.parse(SRC.rules); f(j.rules.playlistLikes.$ownerId.$preset); return JSON.stringify(j); };
  await brk('count 의 «같은 묶음에서 by 를 처음 만든다» 를 빼면', { rules: rulesWith(n => { n.count['.validate'] = "newData.isNumber() && newData.val() === (data.exists() ? data.val() : 0) + 1"; }) }, x => x.rulesBlock);
  /* 신원은 by · last 두 곳이 서로 받친다(하나만 풀면 다른 쪽이 막는다) — 둘 다 풀어야 남의 이름으로 누를 수 있다 */
  await brk('by · last 의 «누른 본인만» 을 둘 다 빼면', { rules: rulesWith(n => { n.by.$authUid['.write'] = "auth != null && !data.exists() && newData.exists()"; n.last['.write'] = 'auth != null && newData.isString()'; }) }, x => x.rulesBlock);
  await brk('누른 표시를 친구 코드 칸에 두면(새 코드로 또 누르기)', { mod: SRC.mod.replace("w[base(owner, key) + '/by/' + uid] = true;", "w[base(owner, key) + '/by/' + me] = true;").replace("w[base(owner, key) + '/last'] = uid;", "w[base(owner, key) + '/last'] = me;").replace("get(ref(db, base(owner, key) + '/by/' + uid))", "get(ref(db, base(owner, key) + '/by/' + me))") }, x => x.newCode);
  await brk('by 읽기를 누구나로 열면', { rules: rulesWith(n => { n.by.$authUid['.read'] = 'auth != null'; }) }, x => x.readRule);
  await brk('프리셋 번호에서 빈 값 거르기를 빼면', { mod: SRC.mod.replace("  if(idx === null || idx === undefined || idx === '') return null;", '') }, x => x.key);
  await brk('누른 뒤에도 «이미» 를 안 보면', { mod: SRC.mod.replace("if(cur.mine) return { ok: false, reason: 'already', count: cur.count };", '') }, x => x.once);
  await brk('다시 하기를 없애면', { mod: SRC.mod.replace('const RETRY_MAX = 3;', 'const RETRY_MAX = 1;') }, x => x.race);
  await brk('같은 프리셋을 그릴 때마다 다시 읽으면', { ui: SRC.ui.replace("if(k !== key){ key = k; if(open) close(); if(k) load(next); else seq++; }", "key = k; if(k) load(next); else seq++;") }, x => x.noReread);
  await brk('win-stack 양보 목록에서 서랍 줄을 빼면', { ws: SRC.ws.replace("  '#myPlLikeDrawer.on',", '') }, x => x.escYield);
  await brk('Esc 를 안 들으면', { ui: SRC.ui.replace("function onKey(e){ if(open && e.key === 'Escape'){ e.stopPropagation(); close(); } }", 'function onKey(){}') }, x => x.close);
  await brk('못 읽음을 0 으로 그리면', { mod: SRC.mod.replace('const count = (s.loaded && !s.failed) ? Math.max(0, Number(s.count) || 0) : null;', 'const count = Math.max(0, Number(s.count) || 0);') }, x => x.failRow);
  void R0;

  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
