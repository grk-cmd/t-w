/* ═══ 🙋 sim-room-invite-ui.js — 투게더룸 친구 초대 · 방 초대 받기 모듈 (2026-10-13 신설 · 앱 FSD 10번) ═══════════════
   app.js 의 «🙋 투게더룸 친구 초대» 구역(친구 고르기 창 · 초대 보내기 · 방 초대 받기 팝업)을 parts/room-invite-ui.js 로 옮겼다.
   동작은 그대로여야 한다 — 여기서는 «옮긴 것» 을 가짜 DOM 위에서 통째로 굴린다.
   ・1절: 만들 때 — 싣기만 하면 window.TwRoomInviteUi 뿐 · 만들면 버튼 둘 · ✕ · 바깥 누름 · 끌기 · resize 연결 · 초대 수신 구독 ·
           firebaseAPI 가 없으면 firebase-ready 를 한 번 기다림 · 창 DOM 이 없어도 수신은 건다
   ・2절: 친구 고르기 창 — 방 없으면 안 열림(안내) · 친구 없음 안내 · 온라인 먼저 이름순 · 사진(data:image · http 만) · 🏠 · 10줄 넘으면 스크롤 · 닫기
   ・3절: 초대 보내기 — 보낸 값 · 완료 · 실패 · 연결 없음 · 🏠 다른 방 친구는 첫 클릭은 알리기만
   ・4절: 창 끌기 — 손떨림(3px 미만)은 무시 · 화면 안으로 가둠 · ✕ 위는 끌기 아님 · 더블클릭 가운데로 · 다시 열면 가둠
   ・5절: 받기 — 오래된 초대(10분)는 지움 · 가장 최근 하나 · 수락이면 나간 뒤 그 방으로 · 거절 · 3분 지나면 거절 · 떠 있는 동안 새 초대 안 띄움 ·
           작업표시줄 깜빡임은 팝업과 수명을 같이 · done 은 한 번만
   ・6절: app.js 배선 — 정의는 모듈에만 · 만드는 곳 한 곳 · 원래 자리(INIT 뒤 · 🛰 감시견 앞) · deps 모양(함수는 화살표 · let 은 읽는 함수 · const 는 값) ·
           빈 껍데기 · html 순서 · 전역 이름
   [실행] room-invite-ui.js · app.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['room-invite-ui.js', 'app.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const APP = _joinRenderer(SRC['app.js']), HTML = SRC['desk-companion-prototype.html'], MOD = SRC['room-invite-ui.js'];
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

/* DOM 칸 — style · 이벤트 · 자식은 진짜. 팝업 상자의 [data-a] 는 innerHTML 을 넣은 뒤 querySelector 로 찾는다. */
function mkEl(tag, id, env){
  const L = {}, q = {};
  const el = {
    tagName: String(tag || 'div').toUpperCase(), id: id || '', style: {}, title: '', disabled: false, onclick: null, className: '',
    children: [], parentElement: null, _text: '', _html: '', draggable: true, src: '',
    get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
    set textContent(v){ this._text = String(v); this.children = []; },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); this.children = []; this._text = ''; for(const k in q) delete q[k]; },
    appendChild(c){ c.parentElement = el; el.children.push(c); return c; },
    remove(){ if(el.parentElement){ const p = el.parentElement; p.children = p.children.filter(c => c !== el); el.parentElement = null; } },
    addEventListener(t, fn, o){ (L[t] = L[t] || []).push({ fn, once: !!(o && o.once) }); }, _L: L,
    fire(t, ev){ (L[t] || []).slice().forEach(h => { if(h.once) L[t] = L[t].filter(x => x !== h); h.fn(Object.assign({ preventDefault(){}, target: el, button: 0 }, ev || {})); }); },
    querySelector(sel){ const m = /^\[data-a="(\w+)"\]$/.exec(sel); if(!m || el._html.indexOf('data-a="' + m[1] + '"') < 0) return null; return q[m[1]] || (q[m[1]] = mkEl('div', '', env)); },
    closest: (sel) => (sel === '.mh-x' && el.className === 'mh-x' ? el : null),
    get offsetWidth(){ return env && el.id === 'roomInvitePickWin' ? env.winW : 0; },
    get offsetHeight(){ return env && el.id === 'roomInvitePickWin' ? env.winH : 0; },
    getBoundingClientRect: () => ({ left: env ? env.winX : 0, top: env ? env.winY : 0, width: 320, height: 200 }),
  };
  return el;
}

function mkEnv(opt){
  opt = opt || {};
  const env = {
    toasts: [], sent: [], cleared: [], left: [], started: [], flashes: [], subs: [], now: 1e12, timers: [], docL: {}, winL: {},
    friends: opt.friends === undefined ? {} : opt.friends, room: opt.room === undefined ? 'ROOM1' : opt.room, active: opt.active !== false,
    sendFail: false, winW: 320, winH: 200, winX: 100, winY: 100,
  };
  const els = {};
  const ids = ['roomInvitePickOverlay', 'roomInvitePickList', 'roomInvitePickClose', 'roomInvitePickHead', 'roomInvitePickWin', 'inviteFriendBtn', 'fsInviteFriendBtn'];
  if(!opt.noDom) ids.forEach(id => { els[id] = mkEl('div', id, env); });
  if(els.roomInvitePickClose) els.roomInvitePickClose.className = 'mh-x';
  const body = mkEl('body', 'body', env);
  const fb = {
    sendRoomInvite: async (...a) => { if(env.sendFail) throw new Error('x'); env.sent.push(a); },
    subscribeRoomInvites: (id, cb) => { env.subs.push({ id, cb }); },
    clearRoomInvite: async (me, from) => { env.cleared.push([me, from]); },
  };
  const ctx = {
    Math, JSON, String, Number, Array, Object, Boolean, parseInt, Error, Promise,
    Date: { now: () => env.now },
    console: { warn(){}, log(){} },
    innerWidth: 800, innerHeight: 600,
    document: {
      body,
      getElementById: (id) => els[id] || null,
      createElement: (t) => mkEl(t, '', env),
      addEventListener: (t, fn) => { (env.docL[t] = env.docL[t] || []).push(fn); },
      removeEventListener: (t, fn) => { env.docL[t] = (env.docL[t] || []).filter(f => f !== fn); },
    },
    setInterval: (fn) => { env.timers.push(fn); return env.timers.length; },
    clearInterval: (h) => { env.timers[h - 1] = null; },
    addEventListener: (t, fn, o) => { (env.winL[t] = env.winL[t] || []).push({ fn, once: !!(o && o.once) }); },
    companion: { flashFrame: (on) => env.flashes.push(on) },
  };
  if(!opt.noFb) ctx.firebaseAPI = fb;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx, { filename: 'room-invite-ui.js' });
  env.ctx = ctx; env.els = els; env.fb = fb;
  env.mk = () => (env.api = ctx.TwRoomInviteUi.createRoomInviteUi({
    toast: (m) => env.toasts.push(m),
    escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    getMyUserId: () => 'ME',
    getDisplayName: () => '나나',
    startRoom: async (c) => { env.started.push(c); },
    doLeaveRoom: async (o) => { env.left.push(o); env.active = false; },
    friendInRoom: (f) => !!f.room,
    myHomeFriends: () => env.friends,
    presence: { active: () => env.active, roomCode: () => env.room },
  }));
  env.fireWin = (t) => { (env.winL[t] || []).slice().forEach(h => { if(h.once) env.winL[t] = env.winL[t].filter(x => x !== h); h.fn({}); }); };
  env.fireDoc = (t, ev) => { (env.docL[t] || []).slice().forEach(fn => fn(ev)); };
  env.open = () => els.inviteFriendBtn.fire('click');
  env.rows = () => els.roomInvitePickList.children;
  env.btnOf = (i) => env.rows()[i].children[2];
  env.nameOf = (i) => env.rows()[i].children[1]._text;
  env.btnBy = (nm) => env.rows().find(r => r.children[1]._text === nm).children[2];
  env.tick = () => env.timers.forEach(fn => fn && fn());
  env.popup = () => body.children[body.children.length - 1];
  return env;
}
const flush = () => new Promise(r => setImmediate(r));

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + (e && e.stack || e).toString().split('\n').slice(0, 2).join(' / ')); } };

await sec('── 1. 만들 때', () => {
  const e = mkEnv();
  chk(Object.keys(e.ctx.TwRoomInviteUi).join() === 'createRoomInviteUi' && typeof e.ctx.TwRoomInviteUi.createRoomInviteUi === 'function', '싣기만 하면 window.TwRoomInviteUi(createRoomInviteUi) 하나뿐');
  chk(!e.subs.length && !e.els.inviteFriendBtn._L.click, '  싣기만 해서는 구독도 버튼 연결도 안 한다');
  const api = e.mk();
  chk(Object.keys(api).join() === 'showPopup,busy' && api.busy() === false, '반환값은 검사용 둘(showPopup · busy)');
  chk(e.els.inviteFriendBtn._L.click.length === 1 && e.els.fsInviteFriendBtn._L.click.length === 1, '[🙋 친구 초대하기] 버튼 둘(런처 · 실행 화면)을 건다');
  chk(e.els.roomInvitePickClose._L.click.length === 1 && e.els.roomInvitePickOverlay._L.mousedown.length === 1, '  ✕ · 바깥 누름(닫기)');
  chk(e.els.roomInvitePickHead._L.pointerdown.length === 1 && e.els.roomInvitePickHead._L.dblclick.length === 1 && (e.winL.resize || []).length === 1, '  타이틀바 끌기 · 더블클릭 · 창 크기 바뀜');
  chk(e.subs.length === 1 && e.subs[0].id === 'ME' && !e.winL['firebase-ready'], 'firebaseAPI 가 있으면 바로 내 초대함을 구독한다');
  const n = mkEnv({ noFb: true }); n.mk();
  chk(!n.subs.length && (n.winL['firebase-ready'] || []).length === 1 && n.winL['firebase-ready'][0].once, 'firebaseAPI 가 없으면 firebase-ready 를 한 번(once) 기다린다');
  n.ctx.firebaseAPI = n.fb; n.fireWin('firebase-ready'); n.fireWin('firebase-ready');
  chk(n.subs.length === 1 && n.subs[0].id === 'ME', '  준비되면 그때 구독한다(한 번만)');
  const d = mkEnv({ noDom: true });
  let ok = true; try{ d.mk(); }catch(_){ ok = false; }
  chk(ok && d.subs.length === 1 && !(d.winL.resize || []).length, '고르기 창 DOM 이 없으면 창 연결은 건너뛰고 초대 받기는 건다');
});

await sec('── 2. 친구 고르기 창', () => {
  const e = mkEnv({ room: null }); e.mk();
  e.els.roomInvitePickOverlay.style.display = 'none';
  e.open();
  chk(e.toasts.pop() === '먼저 방에 연결해 주세요' && e.els.roomInvitePickOverlay.style.display === 'none', '방에 없으면 안 열고 안내');
  const z = mkEnv({ active: false }); z.mk(); z.open();
  chk(z.toasts.pop() === '먼저 방에 연결해 주세요', '  Presence 가 꺼져 있어도 같다');
  const f = mkEnv({ friends: {} }); f.mk(); f.open();
  chk(/아직 친구가 없어요/.test(f.els.roomInvitePickList.innerHTML) && f.els.roomInvitePickList.style.maxHeight === '' && f.els.roomInvitePickOverlay.style.display === 'flex', '친구가 없으면 안내 · 창은 열린다');
  const g = mkEnv({ friends: {
    a: { name: '다람', online: false }, b: { name: '가나', online: true, avatar: 'data:image/png;base64,AA', level: 3 },
    c: { name: '나비', online: true, avatar: 'javascript:alert(1)', room: 'R2' }, d: { name: '가람', online: false, avatar: 'https://x/y.png' },
  } });
  g.mk(); g.open();
  chk([0, 1, 2, 3].map(g.nameOf).join() === '가나,나비,가람,다람', '온라인 먼저 · 그 안에서 이름순(가나 · 나비 | 가람 · 다람)');
  const ava = (i) => g.rows()[i].children[0].children[0];
  chk(ava(0).children[0] && ava(0).children[0].src === 'data:image/png;base64,AA' && ava(0).children[0].draggable === false, '사진 — data:image 는 img 프로퍼티로');
  chk(!ava(1).children.length && ava(1)._text === '🙂', '  javascript: 같은 스킴은 버리고 🙂');
  chk(ava(2).children[0] && ava(2).children[0].src === 'https://x/y.png', '  http(s) 도 통과');
  const dot = (i) => g.rows()[i].children[0].children[1].style.cssText;
  chk(/#49c96d/.test(dot(0)) && !/#49c96d/.test(dot(2)), '  온라인 점');
  const meta = (i) => g.rows()[i].children[1].children[0];
  chk(meta(1)._text === 'Lv.1 🏠' && meta(1).title === '지금 다른 방에 있어요' && meta(0)._text === 'Lv.3' && !meta(0).title, '🏠 다른 방에 있는 친구(_friendInRoom) · 레벨');
  chk(g.els.roomInvitePickList.style.maxHeight === '', '10줄 이하면 높이 제한 없음');
  const many = {}; for(let i = 0; i < 11; i++) many['f' + i] = { name: 'n' + String(i).padStart(2, '0') };
  const h = mkEnv({ friends: many }); h.mk(); h.open();
  chk(h.rows().length === 11 && h.els.roomInvitePickList.style.maxHeight === '410px', '11줄이면 10줄(41px × 10)까지만 보이고 스크롤');
  h.friends = {}; h.open();
  chk(h.els.roomInvitePickList.style.maxHeight === '' && !h.rows().length, '  다시 열 때 친구 목록을 새로 읽는다(읽는 함수)');
  h.els.roomInvitePickClose.fire('click');
  chk(h.els.roomInvitePickOverlay.style.display === 'none', '✕ 로 닫는다');
  h.open(); h.els.roomInvitePickOverlay.fire('mousedown', { target: h.els.roomInvitePickWin });
  chk(h.els.roomInvitePickOverlay.style.display === 'flex', '  창 안을 누르면 안 닫힌다');
  h.els.roomInvitePickOverlay.fire('mousedown', { target: h.els.roomInvitePickOverlay });
  chk(h.els.roomInvitePickOverlay.style.display === 'none', '  바깥(덮개)을 누르면 닫힌다');
  h.els.fsInviteFriendBtn.fire('click');
  chk(h.els.roomInvitePickOverlay.style.display === 'flex', '실행 화면 버튼도 같은 창을 연다');
});

await sec('── 3. 초대 보내기', async () => {
  const e = mkEnv({ friends: { a: { name: '가나', online: true }, b: { name: '나비', online: true, room: 'R2' }, c: { online: true } } }); e.mk(); e.open();
  chk([0, 1, 2].map(e.nameOf).join() === '(이름 없음),가나,나비', '이름 없는 친구는 «(이름 없음)» · 이름순 맨 앞');
  const b0 = e.btnBy('가나');
  chk(b0.textContent === '초대' && b0.className === 'lc-btn', '줄마다 [초대] 버튼');
  b0.onclick();
  chk(b0.disabled === true && b0.textContent === '...', '  누르면 잠그고 ...');
  await flush();
  chk(JSON.stringify(e.sent[0]) === JSON.stringify(['a', 'ME', 'ROOM1', '나나']) && e.toasts.pop() === '가나 님에게 초대를 보냈어요' && b0.textContent === '완료', '보낸 값(받는 사람 · 나 · 방 코드 · 내 이름) · 안내 · 완료');
  const b1 = e.btnBy('나비');
  b1.onclick();
  chk(e.sent.length === 1 && b1.textContent === '그래도' && e.toasts.pop() === '나비 님은 현재 다른 방에 입장 중입니다' && b1.title === '한 번 더 누르면 초대를 보냅니다', '🏠 다른 방 친구 — 첫 클릭은 보내지 않고 알리기만');
  b1.onclick(); await flush();
  chk(e.sent.length === 2 && e.sent[1][0] === 'b' && b1.textContent === '완료', '  한 번 더 누르면 보낸다');
  e.sendFail = true;
  const b2 = e.btnBy('(이름 없음)'); b2.onclick(); await flush();
  chk(e.toasts.pop() === '초대에 실패했어요' && b2.disabled === false && b2.textContent === '초대', '실패하면 안내 · 버튼을 되살린다');
  delete e.ctx.firebaseAPI;
  b2.onclick(); await flush();
  chk(e.toasts.pop() === '네트워크 연결이 필요해요' && b2.disabled === false && b2.textContent === '초대', 'firebaseAPI 가 없으면 연결 안내');
  e.ctx.firebaseAPI = e.fb; e.sendFail = false;
  b2.onclick(); await flush();
  chk(e.toasts.pop() === '친구 님에게 초대를 보냈어요', '  이름 없는 친구는 «친구»');
});

await sec('── 4. 창 끌기', () => {
  const e = mkEnv({ friends: { a: { name: '가나' } } }); e.mk(); e.open();
  const head = e.els.roomInvitePickHead, win = e.els.roomInvitePickWin;
  head.fire('pointerdown', { button: 2, clientX: 110, clientY: 105 });
  chk(!(e.docL.pointermove || []).length, '왼쪽 버튼만');
  head.fire('pointerdown', { target: e.els.roomInvitePickClose, clientX: 110, clientY: 105 });
  chk(!(e.docL.pointermove || []).length, '✕ 위에서 시작한 것은 끌기가 아니다');
  head.fire('pointerdown', { clientX: 110, clientY: 105 });
  e.fireDoc('pointermove', { clientX: 111, clientY: 106 });
  chk(!win.style.position, '  손떨림(3px 미만)은 클릭으로 둔다');
  e.fireDoc('pointermove', { clientX: 210, clientY: 205 });
  chk(win.style.position === 'fixed' && win.style.left === '200px' && win.style.top === '200px', '잡은 지점을 유지하며 옮긴다(fixed + left/top)');
  e.fireDoc('pointermove', { clientX: 5000, clientY: -500 });
  chk(win.style.left === '480px' && win.style.top === '0px', '  화면 밖으로 못 나간다(800 - 320 · 0)');
  e.fireDoc('pointerup', {});
  chk(!(e.docL.pointermove || []).length && !(e.docL.pointerup || []).length && !(e.docL.pointercancel || []).length, '놓으면 리스너를 뗀다');
  e.ctx.innerWidth = 600; e.fireWin('resize');
  chk(win.style.left === '280px', '창 크기가 바뀌면 다시 가둔다');
  e.els.roomInvitePickOverlay.style.display = 'none'; e.ctx.innerWidth = 400; e.fireWin('resize');
  chk(win.style.left === '280px', '  닫혀 있으면 건드리지 않는다');
  e.open();
  chk(win.style.left === '80px', '  다시 열 때 가둔다');
  head.fire('dblclick', { target: e.els.roomInvitePickClose });
  chk(win.style.position === 'fixed', '✕ 더블클릭은 가운데로 돌리지 않는다');
  head.fire('dblclick', {});
  chk(win.style.position === '' && win.style.left === '' && win.style.top === '', '타이틀바 더블클릭 — 가운데로');
  win.style.left = 'x'; e.open();
  chk(win.style.left === 'x', '  가운데로 돌린 뒤엔 열 때 건드리지 않는다');
});

await sec('── 5. 방 초대 받기', async () => {
  const e = mkEnv({ active: true }); e.mk();
  const cb = e.subs[0].cb;
  cb(null); cb({});
  chk(e.ctx.document.body.children.length === 0 && !e.api.busy(), '빈 초대함이면 아무것도 안 뜬다');
  cb({ old: { ts: e.now - 11 * 60 * 1000, fromName: '옛', roomCode: 'OLD' } });
  await flush();
  chk(e.ctx.document.body.children.length === 0 && JSON.stringify(e.cleared) === JSON.stringify([['ME', 'old']]), '10분 지난 초대는 띄우지 않고 지운다');
  e.cleared = [];
  cb({ x: { ts: e.now - 9 * 60 * 1000, fromName: '<b>가</b>', roomCode: 'RX' }, y: { ts: e.now - 1000, fromName: '나비', roomCode: 'RY' } });
  const ov = e.popup();
  chk(e.ctx.document.body.children.length === 1 && ov.className === 'app-popup-ov' && e.api.busy(), '팝업 하나 · app-popup-ov · busy');
  const box = ov.children[0];
  chk(/<b>나비<\/b> 님이 함께하자고/.test(box.innerHTML), '가장 최근 초대(나비)를 띄운다 · 9분 된 것은 아직 안 버린다');
  chk(/pointer-events:none/.test(ov.style.cssText) && /^pointer-events:auto;/.test(box.style.cssText), '  껍데기는 클릭 통과 · 상자만 받는다');
  chk(JSON.stringify(e.flashes) === '[true]', '  작업표시줄 깜빡임 켬');
  chk(box.querySelector('[data-a="left"]').textContent === '⏳ 3:00 안에 응답이 없으면 자동으로 거절돼요', '  남은 시간 3:00');
  cb({ z: { ts: e.now, fromName: '또', roomCode: 'RZ' } });
  chk(e.ctx.document.body.children.length === 1, '떠 있는 동안 새 초대는 안 띄운다');
  box.querySelector('[data-a="ok"]').onclick();
  await flush(); await flush();
  chk(e.ctx.document.body.children.length === 0 && JSON.stringify(e.flashes) === '[true,false]', '수락 — 팝업 닫고 깜빡임 끔');
  chk(JSON.stringify(e.cleared) === JSON.stringify([['ME', 'y']]) && JSON.stringify(e.left) === JSON.stringify([{ wipeChat: true }]) && JSON.stringify(e.started) === '["RY"]' && !e.api.busy(),
    '  초대 지움 → 방에 있으면 대화 지우고 나감 → 그 방으로 · busy 풀림');
  box.querySelector('[data-a="ok"]').onclick(); await flush();
  chk(e.started.length === 1 && JSON.stringify(e.flashes) === '[true,false]', '  done 은 한 번만');
  // 거절
  e.cleared = [];
  e.subs[0].cb({ y: { ts: e.now, fromName: '나비', roomCode: 'RY' } });
  e.popup().children[0].querySelector('[data-a="no"]').onclick();
  await flush(); await flush();
  chk(JSON.stringify(e.cleared) === JSON.stringify([['ME', 'y']]) && e.started.length === 1 && e.left.length === 1 && !e.api.busy(), '거절 — 초대만 지우고 이동 안 함');
  // 방에 없으면 나가지 않고 이동
  e.active = false;
  e.subs[0].cb({ y: { ts: e.now, fromName: '나비', roomCode: 'RQ' } });
  e.popup().children[0].querySelector('[data-a="ok"]').onclick();
  await flush(); await flush();
  chk(e.left.length === 1 && e.started[1] === 'RQ', '방에 없으면 나가지 않고 바로 그 방으로');
  // 3분
  e.toasts = []; e.flashes = [];
  e.subs[0].cb({ y: { ts: e.now, fromName: '나비', roomCode: 'RT' } });
  const lb = e.popup().children[0].querySelector('[data-a="left"]');
  e.now += 61 * 1000; e.tick();
  chk(lb.textContent === '⏳ 1:59 안에 응답이 없으면 자동으로 거절돼요', '1초마다 남은 시간(1:59)');
  e.now += 119 * 1000; e.tick();
  await flush(); await flush();
  chk(e.ctx.document.body.children.length === 0 && e.toasts.pop() === '⏳ 초대에 3분 동안 응답이 없어 거절했어요' && e.started.length === 2 && !e.api.busy() && JSON.stringify(e.flashes) === '[true,false]', '3분이 지나면 거절과 같은 길 · 안내');
  chk(e.timers.every(t => t === null), '  타이머 정리');
  const r = mkEnv(); r.mk();
  let shown = null; r.api.showPopup('<i>', 'RC', v => { shown = v; });
  chk(/&lt;i&gt;/.test(r.popup().children[0].innerHTML) && r.flashes[0] === true, '보낸 사람 이름은 escHtml 로 씻는다');
  r.popup().children[0].querySelector('[data-a="no"]').onclick();
  chk(shown === false, '  showPopup 직접 — 거절은 false');
});

await sec('── 6. app.js 배선', () => {
  const code = strip(APP);
  const defs = /function (bindRoomInvite|_bindRoomInviteReceiver|_flashTaskbar|showRoomInvitePopup)\(|ROOM_INVITE_(WAIT|STALE)_MS\s*=|_roomInviteBusy\s*=/;
  chk(!defs.test(code) && defs.test(MOD), '친구 초대 · 초대 받기 정의는 모듈에만');
  chk(!/\b(showRoomInvitePopup|_bindRoomInviteReceiver|_flashTaskbar|_roomInviteBusy|ROOM_INVITE_\w+_MS)\b/.test(code), '  app.js 는 옛 이름을 부르지 않는다');
  chk(/window\.TwRoomInviteUi = api/.test(MOD) && (code.match(/TwRoomInviteUi\.createRoomInviteUi\(/g) || []).length === 1, '모듈은 window.TwRoomInviteUi · 만드는 곳은 한 곳');
  const iInit = APP.indexOf("addEventListener('resize',resize); resize();"), iHead = APP.indexOf('/* ═══════════════ 🙋 투게더룸 친구 초대 ═══════════════ */'),
    iMk = APP.indexOf('TwRoomInviteUi.createRoomInviteUi('), iDog = APP.indexOf('/* ═══════════ 🛰 서버 모듈 감시견');
  chk(iInit > 0 && iHead > iInit && iMk > iHead && iDog > iMk, '원래 자리 — INIT(resize) 뒤 · 구역 머리 아래 · 🛰 서버 모듈 감시견 앞');
  const call = (APP.match(/TwRoomInviteUi\.createRoomInviteUi\(\{([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = call.split('\n').map(s => s.trim()).filter(Boolean);
  const want = [
    /^toast: \(\.\.\.a\)=>toast\(\.\.\.a\),$/, /^escHtml: \(\.\.\.a\)=>escHtml\(\.\.\.a\),$/, /^getMyUserId: \(\.\.\.a\)=>getMyUserId\(\.\.\.a\),$/,
    /^getDisplayName: \(\.\.\.a\)=>getDisplayName\(\.\.\.a\),$/, /^startRoom: \(\.\.\.a\)=>startRoom\(\.\.\.a\),$/, /^doLeaveRoom: \(\.\.\.a\)=>doLeaveRoom\(\.\.\.a\),$/,
    /^friendInRoom: \(\.\.\.a\)=>inboxMod\.friendInRoom\(\.\.\.a\),$/, /^myHomeFriends: \(\)=>_myHomeFriends,$/, /^presence: Presence,$/,
  ];
  const bad = want.map((re, i) => re.test(deps[i] || '') ? null : (i + ':' + (deps[i] || '없음'))).filter(Boolean);
  chk(deps.length === want.length && !bad.length, 'deps 9개 — 함수는 화살표 · let 은 읽는 함수 · const 는 값 (' + deps.length + (bad.length ? ' · 어긋남 ' + bad[0] : '') + ')');
  chk(/^let _myHomeFriends = \{\};/m.test(APP) && /[^.\w]_myHomeFriends = [^=]/.test(code.replace(/let _myHomeFriends = \{\};/, '')), '  _myHomeFriends 는 다시 대입되는 let — 그래서 읽는 함수');
  const iP = APP.indexOf('const Presence=(()=>{');
  chk(iP > 0 && iP < iMk && !/[^.\w]Presence\s*=[^=>]/.test(code.replace('const Presence=(', '')), '  Presence 는 만드는 줄보다 앞의 const · 다시 대입 안 됨 — 그래서 값');
  const m = strip(MOD);
  chk(/const friends = _myHomeFriends\(\) \|\| \{\};/.test(m) && !/[^.\w]_myHomeFriends\s*=[^=]/.test(m.replace('const _myHomeFriends = deps.myHomeFriends;', '')), '모듈은 친구 목록을 부를 때마다 읽는다 · 직접 쓰지 않는다');
  chk(/if\(window\.firebaseAPI\) _bindRoomInviteReceiver\(\);\nelse window\.addEventListener\('firebase-ready', \(\)=>_bindRoomInviteReceiver\(\), \{ once:true \}\);/.test(MOD), '만들 때 수신 구독(또는 firebase-ready) — 예전 부팅 줄 그대로');
  const off = (APP.match(/const ROOM_INVITE_UI_OFF = \{([^\n]*?)\};/) || [])[1] || '';
  chk(/\bshowPopup\(\)\{\}/.test(off) && /\bbusy:\(\)=>false/.test(off), '빈 껍데기 ROOM_INVITE_UI_OFF — 반환값 이름을 다 갖는다');
  const iE = HTML.indexOf('<script src="parts/myhome/myhome-edit.js"></script>'), iS = HTML.indexOf('<script src="parts/room-invite-ui.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iE > 0 && iS > iE && iA > iS, 'html — room-invite-ui.js 를 app.js 앞에 싣는다');
  chk(/^Tw[A-Z]/.test('TwRoomInviteUi') && !/window\.RoomInviteUi\s*=/.test(MOD), '전역 이름은 Tw 접두사(#103 — 크로미움 내장 전역과 겹치지 않게)');
  const wire = (APP.match(/const ROOM_INVITE_UI_OFF = [\s\S]*?\n\}\);/) || [''])[0];
  let got = null; try{ got = vm.runInNewContext(wire + '\nroomInviteUi;', { Presence: {} }); }catch(_){}
  chk(!!got && got.showPopup() === undefined && got.busy() === false, '모듈이 안 실려도 그 자리는 서지 않는다(빈 껍데기)');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
/* 기다리던 약속이 영영 안 풀려 이벤트 고리가 비면 node 는 0 으로 조용히 끝난다 — 판정 줄 없이 끝나면 빨강 */
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다 — 기다리던 응답이 오지 않았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
