/* sim-friend-req-btn.js — 🙋 남의 마이홈 [친구 신청] · 사유 창(myhome/friend-req-btn.js) · 받는 쪽 사유 표시 · 규칙 msg 칸
   실행:  node checks/run.js sim-friend-req-btn
   ★ 왜 이 검사가 있는가 — 단추는 «남의 홈 · 친구 아님 · 보낸 요청 없음» 일 때만 보여야 하고(늦게 온 답에 다음 화면 단추가 켜지면 안 된다),
     보내기 · 앞단 검사는 좌석 친구 신청(seat-friend-req.js sendFriendReq)과 같은 한 벌이어야 한다. 사유는 남이 쓴 글이라 HTML 로 읽히면 안 된다.
   ・1절: 순수 함수 — cleanReason(줄바꿈 · 공백 · 100자) · 결과 → 안내 문구는 seat-friend-req.js resultView 한 벌을 실제로 실어 쓴다
   ・2절: refresh — 내 홈 · 미리보기 · 친구 · 보낸 요청 있음은 숨김 · 없음은 보임 · 확인 못 하면 숨김 · 늦은 답은 버림
   ・3절: 사유 창 — 이름은 글자로 · 100자 · [신청하기] 가 다듬은 사유로 보냄 · 성공이면 닫고 단추 숨김 · 실패는 E-FR-06 · Esc · [취소]
   ・4절: 연결 — html 단추 · 싣는 순서 · app.js 가 친구 홈 구경보다 먼저 만듦 · 관람 화면이 refresh 를 부름 · 받는 쪽 사유(textContent · escHtml) · 보내기에 msg · 규칙 msg ≤100
   ・5절: 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f), path.join('apps', 'desktop', 'app', 'parts', f), path.join('apps', 'desktop', 'app', f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome/friend-req-btn.js'), SEAT = read('myhome/seat-friend-req.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), VISIT = read('myhome/myhome-visit.js'),
  FM = read('myhome/friend-manage.js'), FBI = read('firebase-init.js');
const RP = ['firebase-database-rules.json', '../firebase-database-rules.json', 'firebase/firebase-database-rules.json'].find(p => fs.existsSync(p));
if (!MOD || !SEAT || !APP || !HTML || !VISIT || !FM || !FBI || !RP) { say('  ? 원본 못 찾음 — friend-req-btn.js · app.js · html · myhome-visit.js · friend-manage.js · firebase-init.js · 규칙'); process.exit(2); }
const RULES = fs.readFileSync(RP, 'utf8');
let WINSTACK = read('shared/win-stack.js') || '';
/* win-stack 의 Esc 양보 목록을 실제 배열로 꺼낸다 */
function escYieldList(){ const m = /const ESC_YIELD_SEL = (\[[\s\S]*?\])\.join/.exec(WINSTACK); if (!m) return []; try { return new Function('return ' + m[1])(); } catch (_) { return []; } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const flush = () => new Promise((r) => setImmediate(r));

/* 아주 작은 가짜 DOM — 이 모듈이 쓰는 것만 */
function makeDoc(){
  const byId = {};
  function el(tag){
    const e = { tagName: tag.toUpperCase(), children: [], parent: null, className: '', hidden: false, disabled: false, value: '', _text: '', listeners: {},
      maxLength: -1, rows: 0, placeholder: '', type: '', onclick: null, oninput: null, focused: false,
      append(...k){ for (const c of k){ const n = typeof c === 'string' ? Object.assign(el('#text'), { _text: c }) : c; n.parent = e; e.children.push(n); } },
      appendChild(c){ e.append(c); return c; },
      remove(){ if (e.parent){ e.parent.children = e.parent.children.filter(x => x !== e); e.parent = null; } },
      addEventListener(t, f){ (e.listeners[t] = e.listeners[t] || []).push(f); },
      focus(){ e.focused = true; },
      get textContent(){ return e._text + e.children.map(c => c.textContent).join(''); },
      set textContent(v){ e._text = String(v); e.children = []; },
      set innerHTML(_v){ throw new Error('innerHTML 을 쓰면 안 된다'); },
    };
    return e;
  }
  const body = el('body');
  const keys = [];   // document 의 keydown 처리기 — { fn, capture }
  const doc = { body, keys, createElement: el, createTextNode: (t) => Object.assign(el('#text'), { _text: String(t) }),
    addEventListener: (t, fn, cap) => { if (t === 'keydown') keys.push({ fn, capture: cap === true || !!(cap && cap.capture) }); },
    removeEventListener: (t, fn) => { if (t !== 'keydown') return; const i = keys.findIndex(k => k.fn === fn); if (i >= 0) keys.splice(i, 1); },
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => { const cls = sel.replace(/^\./, ''); const walk = (n) => { if (String(n.className).split(' ').includes(cls)) return n; for (const c of n.children){ const r = walk(c); if (r) return r; } return null; }; return walk(body); } };
  const btn = el('button'); btn.hidden = true; byId.mhFriendReqBtn = btn;
  const win = el('div'); byId.myHomeWin = win; body.append(win);
  return { doc, btn, win, el };
}
function find(n, cls){ if (String(n.className).split(' ').includes(cls)) return n; for (const c of n.children){ const r = find(c, cls); if (r) return r; } return null; }

/* 결과 → 안내 문구는 좌석 친구 신청 모듈의 한 벌을 그대로 싣는다(이 모듈에 따로 두지 않는다) */
function seatResultView(seatSrc){
  const T = new Function('window', 'module', seatSrc + '\nreturn window.TwSeatFriendReq;')({}, undefined);
  return T.createSeatFriendReq({ FRIEND_MAX: 5, _myHomeFriends: () => ({}), friendNet: () => null, getDisplayName: () => '', getMyUserId: () => 'me', toast: () => {} }).resultView;
}
function load(src, o = {}){
  const D = makeDoc();
  const log = { sends: [], toasts: [], notes: [], alive: [] };
  const TwErrorCodes = { notify: (code, err) => log.notes.push([code, err]) };
  const win = {};
  const T = new Function('window', 'document', 'TwErrorCodes', 'module', src + '\nreturn window.TwFriendReqBtn;')(win, D.doc, TwErrorCodes, undefined);
  const mod = T.createFriendReqBtn({
    sendFriendReq: async (...a) => { log.sends.push(a); if (o.throws) throw new Error('x'); return o.res || { ok: true }; },
    resultView: seatResultView(o.seat || SEAT),
    friendNet: () => o.noNet ? null : { isFriendRequestAlive: (to, me) => { log.alive.push([to, me]); if (o.aliveThrows) return Promise.reject(new Error('x')); return o.alivePromise || Promise.resolve(!!o.alive); } },
    friends: () => o.friends || {}, getMyUserId: () => 'me', toast: (m) => log.toasts.push(m),
  });
  return { T, mod, D, log };
}

async function behave(src, seat){
  const r = {};
  try {
    const { T } = load(src, { seat });
    r.view = !/function resultView\b/.test(src) && Object.keys(T).join() === 'createFriendReqBtn,cleanReason,REASON_MAX';
    { const w0 = load(src, { alive: false, res: { ok: false, reason: 'full' }, seat }); await w0.mod.refresh('u2', '민지'); w0.D.btn.onclick();
      const o0 = find(w0.D.win, 'friend-req-ask-ov'); await find(o0, 'friend-req-ask-btns').children[0].onclick(); await flush();
      r.info = w0.log.toasts[0] === '친구는 최대 5명까지만 추가할 수 있어요' && w0.log.notes.length === 0; }
    const C = T.cleanReason;
    r.clean = C('  같이\r\n공부해요 ') === '같이 공부해요' && C(null) === '' && C('a'.repeat(150)).length === 100 && T.REASON_MAX === 100;

    let w = load(src, { alive: false });
    await w.mod.refresh('u2', '민지'); r.show = w.D.btn.hidden === false && JSON.stringify(w.log.alive[0]) === JSON.stringify(['u2', 'me']);
    await w.mod.refresh(null, null); r.hideOwn = w.D.btn.hidden === true;
    w = load(src, { alive: false }); await w.mod.refresh('me', '나'); r.hideSelf = w.D.btn.hidden === true && w.log.alive.length === 0;
    w = load(src, { alive: false, friends: { u2: {} } }); await w.mod.refresh('u2', '민지'); r.hideFriend = w.D.btn.hidden === true && w.log.alive.length === 0;
    w = load(src, { alive: true }); await w.mod.refresh('u2', '민지'); r.hidePending = w.D.btn.hidden === true;
    w = load(src, { aliveThrows: true }); await w.mod.refresh('u2', '민지'); r.hideUnknown = w.D.btn.hidden === true;
    w = load(src, { noNet: true }); await w.mod.refresh('u2', '민지'); r.hideUnknown = r.hideUnknown && w.D.btn.hidden === true;
    w = load(src, { alive: false }); await w.mod.refresh('u2', '민지'); await w.mod.refresh('u2', '민지'); await w.mod.refresh('u2', '민지');
    { const once = w.log.alive.length === 1 && w.D.btn.hidden === false;
      await w.mod.refresh(null, null); await w.mod.refresh('u2', '민지');
      r.dedupe = once && w.log.alive.length === 2 && w.D.btn.hidden === false; }
    /* 좌석 «🏠 마이홈 구경» 처럼 이름 힌트 없이 열면 처음엔 '친구' → 프로필 이름으로 다시 칠한다 — 누를 때 새 이름 */
    w = load(src, { alive: false }); await w.mod.refresh('u2', '친구'); await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    { const ov2 = find(w.D.win, 'friend-req-ask-ov'); const nm2 = ov2 && find(ov2, 'friend-req-ask-lead').children[0].textContent;
      await find(ov2, 'friend-req-ask-btns').children[0].onclick(); await flush();
      r.rename = nm2 === '민지' && w.log.sends[0] && w.log.sends[0][1] === '민지' && w.log.alive.length === 1; }
    /* 같은 uid 를 다시 칠하는 사이 친구가 됨(부팅 직후 빈 친구 목록 · 보는 중 수락) — 숨긴다 */
    { const fr = {}; w = load(src, { alive: false, friends: fr }); await w.mod.refresh('u2', '민지'); const was = w.D.btn.hidden === false;
      fr.u2 = { addedAt: 1 }; await w.mod.refresh('u2', '민지');
      r.becameFriend = was && w.D.btn.hidden === true; }
    { let res; const p = new Promise(x => { res = x; }); w = load(src, { alivePromise: p });
      const first = w.mod.refresh('u2', '민지'); await w.mod.refresh(null, null); res(false); await first; await flush();
      r.stale = w.D.btn.hidden === true; }

    w = load(src, { alive: false }); await w.mod.refresh('u2', '<b>민지</b>');
    w.D.btn.onclick();
    const ov = find(w.D.win, 'friend-req-ask-ov'), ta = ov && find(ov, 'friend-req-ask-msg');
    const lead = ov && find(ov, 'friend-req-ask-lead');
    r.dialog = !!ov && ta && ta.maxLength === 100 && ta.focused && lead && lead.children[0].textContent === '<b>민지</b>';
    ta.value = ' 같이\n해요 ';
    const btns = find(ov, 'friend-req-ask-btns'); const [okB, noB] = btns.children;
    await okB.onclick(); await flush();
    r.send = JSON.stringify(w.log.sends[0]) === JSON.stringify(['u2', '<b>민지</b>', '같이 해요']) && /^<b>민지<\/b>님에게 친구 요청을 보냈어요/.test(w.log.toasts[0])
      && !find(w.D.win, 'friend-req-ask-ov') && w.D.btn.hidden === true;
    w = load(src, { alive: false, res: { ok: false, reason: 'save_failed' } }); await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    { const o2 = find(w.D.win, 'friend-req-ask-ov'); const [b1, b2] = find(o2, 'friend-req-ask-btns').children; await b1.onclick(); await flush();
      r.fail = w.log.notes.length === 1 && w.log.notes[0][0] === 'E-FR-06' && !!find(w.D.win, 'friend-req-ask-ov') && !b1.disabled && !b2.disabled && w.log.toasts.length === 0; }
    const E = new Error('보내기 쪽 오류');
    w = load(src, { alive: false, res: { ok: false, reason: 'error', err: E }, seat }); await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    { const o2 = find(w.D.win, 'friend-req-ask-ov'); await find(o2, 'friend-req-ask-btns').children[0].onclick(); await flush(); r.errRes = w.log.notes.length === 1 && w.log.notes[0][0] === 'E-FR-06' && w.log.notes[0][1] === E && w.log.toasts.length === 0; }
    w = load(src, { alive: false, throws: true }); await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    { const o2 = find(w.D.win, 'friend-req-ask-ov'); await find(o2, 'friend-req-ask-btns').children[0].onclick(); await flush(); r.throwFail = w.log.notes.length === 1 && w.log.notes[0][0] === 'E-FR-06'; }
    w = load(src, { alive: false }); await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    { let stopped = false;
      const capKeys = w.D.doc.keys.filter(k => k.capture);
      r.escCapture = capKeys.length === 1 && w.D.doc.keys.length === 1;   // Esc 는 document 캡처 하나(창 안 버블이 아니라) — win-stack 은 양보 목록으로 비켜 준다
      capKeys.forEach(k => k.fn({ key: 'Escape', preventDefault(){}, stopPropagation(){ stopped = true; } }));
      const escOk = !find(w.D.win, 'friend-req-ask-ov') && stopped && w.D.doc.keys.length === 0;
      w.D.btn.onclick(); w.D.btn.onclick();
      const one = w.D.win.children.filter(c => String(c.className).includes('friend-req-ask-ov')).length === 1;
      find(find(w.D.win, 'friend-req-ask-ov'), 'friend-req-ask-btns').children[1].onclick();
      r.close = escOk && one && !find(w.D.win, 'friend-req-ask-ov') && w.log.sends.length === 0; }
    /* 창을 연 채 다른 사람 · 내 홈으로 넘어가면 창을 닫는다 — 남은 창이 옛 사람에게 보내지 않게 */
    w = load(src, { alive: false }); await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    await w.mod.refresh(null, null);
    const goneOwn = !find(w.D.win, 'friend-req-ask-ov') && w.D.doc.keys.length === 0;
    await w.mod.refresh('u2', '민지'); w.D.btn.onclick();
    await w.mod.refresh('u3', '지수');
    const goneOther = !find(w.D.win, 'friend-req-ask-ov') && w.D.doc.keys.length === 0;
    w.D.btn.onclick();
    const ov3 = find(w.D.win, 'friend-req-ask-ov');
    const newOne = !!ov3 && find(ov3, 'friend-req-ask-lead').children[0].textContent === '지수';
    await find(ov3, 'friend-req-ask-btns').children[0].onclick(); await flush();
    r.switchClose = goneOwn && goneOther && newOne && w.log.sends.length === 1 && w.log.sends[0][0] === 'u3';
  } catch (e) { r.err = e && e.message; }
  return r;
}
const KEYS = ['view', 'info', 'clean', 'show', 'hideOwn', 'hideSelf', 'hideFriend', 'hidePending', 'hideUnknown', 'dedupe', 'rename', 'becameFriend', 'stale', 'dialog', 'send', 'fail', 'errRes', 'throwFail', 'close', 'escCapture', 'switchClose'];
const allOk = (r) => !r.err && KEYS.every(k => r[k]);

function wire(app, html, visit, fm, fbi, rules){
  const o = {};
  const A = strip(app), H = html.replace(/<!--[\s\S]*?-->/g, ' ');
  o.btnHtml = /<div id="mhNameRow">[^\n]*<button type="button" class="mh-friend-req-btn" id="mhFriendReqBtn" hidden>＋ 친구 신청<\/button><\/div>/.test(H);
  const iS = H.indexOf('<script src="parts/myhome/seat-friend-req.js"></script>'), iB = H.indexOf('<script src="parts/myhome/friend-req-btn.js"></script>'), iA = H.indexOf('<script src="parts/app.js"></script>');
  o.order = iB > 0 && iA > iB && iS > 0;
  const iMk = A.indexOf('const friendReqBtnMod = TwFriendReqBtn.createFriendReqBtn({'), iV = A.indexOf('const mhVisitMod = TwMyHomeVisit.createMyHomeVisit({');
  o.make = iMk > 0 && iV > iMk && /sendFriendReq: \(\.\.\.a\)=>seatFriendReqMod\.sendFriendReq\(\.\.\.a\),/.test(A) && /resultView: \(\.\.\.a\)=>seatFriendReqMod\.resultView\(\.\.\.a\),/.test(A) && /friendNet: \(\)=>window\.firebaseAPI,/.test(A.slice(iMk, iV)) && /friendReqBtn: friendReqBtnMod,/.test(A.slice(iV));
  o.visit = /friendReqBtn\.refresh\(realVisit \? _mhViewingUserId\(\) : null, realVisit \? _mhViewingDisplayName\(\) : null\);/.test(strip(visit));
  o.recv = /msg\.textContent = String\(req\.msg\);/.test(fm) && /escHtml\(String\(req\.msg\)\)/.test(fm);
  o.send = /async sendFriendRequest\(fromId, toId, fromName, toName, toCode, msg\)\{/.test(fbi) && /msg \? \{ msg: String\(msg\)\.slice\(0,100\) \} : \{\}/.test(fbi);
  o.yield = escYieldList().includes('#myHomeOverlay.on .friend-req-ask-ov') && /ov\.className = 'friend-req-ask-ov app-popup-ov';/.test(MOD) && /document\.getElementById\('myHomeWin'\)/.test(MOD);
  let rmsg = null; try { rmsg = JSON.parse(rules).rules.friendRequests.$toId.$fromId.msg; } catch (_) {}
  o.rule = !!rmsg && rmsg['.validate'] === 'newData.isString() && newData.val().length <= 100';
  return o;
}

(async () => {
  say('── 1~3. 실제로 돌린다');
  const R = await behave(MOD);
  if (R.err) chk(false, '돌리다 멈춤 — ' + R.err);
  chk(R.view, '결과 → 안내 문구 표를 이 모듈에 따로 두지 않는다(seat-friend-req.js resultView 한 벌을 deps 로)');
  chk(R.info, '  안내 갈래(예: 정원)는 그 한 벌의 문구 그대로 토스트 · 에러코드 없음');
  chk(R.clean, 'cleanReason — 줄바꿈 → 칸 · 앞뒤 공백 · 100자 · null');
  chk(R.show, 'refresh — 남의 홈 · 친구 아님 · 보낸 요청 없음이면 보인다(그 사람 · 나로 물어봄)');
  chk(R.hideOwn && R.hideSelf, '  내 홈 · 미리보기(uid 없음) · 나 자신이면 숨김(묻지도 않음)');
  chk(R.hideFriend, '  이미 친구면 숨김(묻지도 않음)');
  chk(R.hidePending && R.hideUnknown, '  보낸 요청이 살아 있거나 확인을 못 하면(provider 없음 · 던짐) 숨김');
  chk(R.dedupe, '  같은 관람 화면을 여러 번 칠해도 서버는 한 번만 묻고 단추가 깜빡이지 않는다 · 내 홈으로 오면 다시 묻는다');
  chk(R.rename, '  같은 uid 를 이름만 바꿔 다시 칠하면(\'친구\' → \'민지\') 창 · 보내는 이름은 새 이름(서버는 다시 안 물음)');
  chk(R.becameFriend, '  같은 uid 를 다시 칠하는 사이 친구가 되면 숨긴다');
  chk(R.stale, '  묻는 동안 다른 화면으로 넘어가면 늦은 답은 버린다');
  chk(R.dialog, '사유 창 — 이름은 글자로(HTML 아님) · 100자 · 사유 칸에 포커스');
  chk(R.send, '  [신청하기] — 다듬은 사유로 보내고 안내 · 창 닫힘 · 단추 숨김');
  chk(R.fail && R.errRes && R.throwFail, '  실패(저장 실패 · 보내기 쪽 오류 · 던짐)는 E-FR-06(실제 오류를 넘김) · 창은 남고 단추를 다시 누를 수 있다');
  chk(R.close, '  Esc(마이홈까지 안 닫히게 멈춤 · 처리기도 뗌) · [취소]는 안 보내고 닫는다 · 두 번 눌러도 창 하나');
  chk(R.escCapture, '  Esc 는 document 캡처 하나로 받는다(창 안 버블로 받으면 win-stack 캡처가 먼저 마이홈을 닫는다)');
  chk(R.switchClose, '  창을 연 채 내 홈 · 다른 사람으로 넘어가면 창이 닫히고, 새 사람 창이 그 사람 이름으로 열려 그 사람에게 보낸다');

  say('── 4. 연결');
  const W = wire(APP, HTML, VISIT, FM, FBI, RULES);
  chk(W.btnHtml, 'html — 이름 줄(#mhNameRow) 끝에 [＋ 친구 신청] 단추(처음엔 숨김)');
  chk(W.order, 'html — friend-req-btn.js 를 app.js 보다 먼저 싣는다');
  chk(W.make, 'app.js — 친구 홈 구경보다 먼저 만들고, 보내기 · 결과 문구는 seatFriendReqMod 의 한 벌 · 친구 홈 구경에 넘긴다');
  chk(W.visit, 'myhome-visit.js — 관람 화면을 칠할 때 refresh(관람 uid · 이름), 내 홈이면 null');
  chk(W.recv, 'friend-manage.js — 받은 요청 목록은 textContent · 👋 팝업은 escHtml 로 사유를 보인다');
  chk(W.send, 'firebase-init.js — sendFriendRequest 여섯째 인자 msg 를 있을 때만 100자로 싣는다');
  chk(W.yield, 'win-stack — 사유 창(#myHomeOverlay.on .friend-req-ask-ov)이 열려 있으면 Esc 를 양보한다(마이홈을 먼저 닫지 않게)');
  chk(W.rule, '규칙 — friendRequests/$toId/$fromId/msg 는 문자열 · 100자 이하(없어도 됨)');

  say('── 5. 깨 보기');
  const brk = async (from, to) => { const m = MOD.replace(from, to); return m === MOD ? null : await behave(m); };
  const b1 = await brk(' || (friends() || {})[viewUid]){', '){');
  chk(b1 && !allOk(b1), '친구여도 단추를 보이면 빨강');
  const b2 = await brk('if(seq !== _seq || alive) return;', 'if(alive) return;');
  chk(b2 && !allOk(b2), '늦은 답을 안 버리면 빨강');
  const b3 = await brk("nm.textContent = name;", "nm.innerHTML = name;");
  chk(b3 && !allOk(b3), '이름을 innerHTML 로 넣으면 빨강');
  const b4 = await brk("res = await sendFriendReq(uid, name, cleanReason(ta.value));", "res = await sendFriendReq(uid, name, ta.value);");
  chk(b4 && !allOk(b4), '사유를 다듬지 않고 보내면 빨강');
  const b8 = await brk("b.onclick = () => openDialog(viewUid, _name || '이 사람');", "b.onclick = () => openDialog(viewUid, name || '이 사람');");
  chk(b8 && !allOk(b8), '누를 때 처음 받은 이름을 쓰면(친구 님) 빨강');
  const b9 = await (async () => { const m = MOD.replace("if(!viewUid || !me || viewUid === me || (friends() || {})[viewUid]){", "if(!viewUid || !me || viewUid === me){")
    .replace('  _askedFor = viewUid;\n', '  _askedFor = viewUid;\n  if((friends() || {})[viewUid]) return;\n'); return m === MOD ? null : await behave(m); })();
  chk(b9 && !allOk(b9), '친구 판정을 «같은 uid 면 끝» 뒤로 옮기면(다시 칠할 때 안 꺼짐) 빨강');
  const b7 = await brk('if(viewUid === _askedFor) return;', '');
  chk(b7 && !allOk(b7), '같은 uid 를 다시 물으면(깜빡임) 빨강');
  const b5 = await brk("catch(_){ alive = true; }", "catch(_){ alive = false; }");
  chk(b5 && !allOk(b5), '확인을 못 했는데 단추를 보이면 빨강');
  { const s2 = SEAT.replace("if(r === 'error') return { kind:'fail',", "if(r === 'error') return { kind:'info',"); const b6 = s2 === SEAT ? null : await behave(MOD, s2);
    chk(b6 && !allOk(b6), '좌석 쪽 한 벌에서 던짐을 안내로 바꾸면(마이홈이 실패를 못 알림) 빨강'); }
  { const c1 = await brk("document.addEventListener('keydown', onKey, true);", "ov.addEventListener('keydown', onKey);"); chk(c1 && !allOk(c1), 'Esc 를 창 안 버블로 받으면 빨강'); }
  { const c2 = await brk('  if(_dlg && _dlg.uid !== viewUid) _closeDialog();\n', ''); chk(c2 && !allOk(c2), '다른 사람 · 내 홈으로 넘어가도 창을 안 닫으면 빨강'); }
  { const ws = WINSTACK; WINSTACK = ws.replace("  '#myHomeOverlay.on .friend-req-ask-ov',", ''); const c3 = WINSTACK !== ws && !wire(APP, HTML, VISIT, FM, FBI, RULES).yield; WINSTACK = ws;
    chk(c3, 'win-stack 양보 목록에서 사유 창을 빼면 빨강'); }
  const w2 = wire(APP, HTML, VISIT.replace('friendReqBtn.refresh(', 'void ('), FM, FBI, RULES);
  chk(!w2.visit, '관람 화면에서 refresh 를 안 부르면 빨강');
  const w3 = wire(APP, HTML, VISIT, FM.replace('msg.textContent = String(req.msg);', 'msg.innerHTML = String(req.msg);'), FBI, RULES);
  chk(!w3.recv, '받는 쪽이 사유를 innerHTML 로 넣으면 빨강');

  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
