/* sim-seat-menu.js — 🖱 좌석 우클릭 메뉴(room/seat-menu.js) 동작 · 연결
   실행:  node sim-seat-menu.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 메뉴는 «바깥을 눌러도 안 닫힘» · «ESC 에 마이홈까지 닫힘» 제보를 고친 곳이다. app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4)
     가짜 DOM 위에서 남의 좌석 · 내 좌석 메뉴와 닫기를 돌려 고정한다.
   ・1절: 남의 좌석 — 친구면 마이홈 구경 · 아니면 친구 신청(정보 없으면 안내) · 숨기기(워킹룸) · 신고로 숨긴 사람은 다시 보이기 · 신고
   ・2절: 내 좌석 — 캐릭터 편집 · 자리비움 / 해제
   ・3절: 때리기 — 프리미엄만 · 남은 횟수 · 0 이면 눌러도 안내만 · 숨긴 캐릭터는 없음
   ・4절: 닫기 — 뒷판 클릭 · 뒷판 우클릭 · ESC(전파 끊기) · 바깥 클릭 · 다시 열면 앞 메뉴를 지움 · 화면 밖이면 안쪽으로
   ・5절: 입구 전제 · 6절: app.js 연결 · 7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('room/seat-menu.js'), APP = read('app.js'), OVER = read('room/overhead.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !OVER || !HTML) { say('  ? 원본 못 찾음 — seat-menu.js · app.js · overhead.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

function world(src, o = {}) {
  const log = { toasts: [], calls: [] };
  const call = (k) => (...a) => { log.calls.push([k, ...a]); };
  const docL = {}; const nodes = [];
  function el(tag) {
    const L = {};
    const e = { tag, style: {}, className: '', children: [], textContent: '', src: '',
      appendChild(c) { c.parent = this; this.children.push(c); }, prepend(c) { this.children.unshift(c); }, remove() { e.removed = true; const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); },
      contains(x) { for (let q = x; q; q = q.parent) if (q === e) return true; return false; },
      addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, ev) { (L[t] || []).forEach((f) => f(Object.assign({ preventDefault() {} }, ev))); },
      getBoundingClientRect: () => ({ right: o.right || 100, bottom: o.bottom || 100, width: 120, height: 80 }) };
    return e;
  }
  const body = { appendChild(c) { nodes.push(c); } };
  const doc = { body: o.noBody ? null : body, createElement: el, querySelectorAll: (q) => nodes.filter((n) => q.split(', ').some((c) => n.className.split(' ').includes(c.replace('.', '')))),
    addEventListener: (t, f) => { (docL[t] = docL[t] || []).push(f); }, removeEventListener: (t, f) => { docL[t] = (docL[t] || []).filter((x) => x !== f); } };
  const timers = [];
  const hidden = { _hiddenSeatIds: new Set(o.hiddenIds || []), _reportHiddenUids: new Set(o.rptHidden || []), _reportHiddenSave: call('rptSave'), _seatHidden: (s) => !!o.seatHidden };
  const win = { _activeChannel: o.channel === undefined ? 1 : o.channel };
  const T = new Function('window', 'document', 'setTimeout', 'innerWidth', 'innerHeight', 'module', src + '\nreturn window.TwSeatMenu;')(win, doc, (f) => timers.push(f), 300, 200, undefined);
  const out = T.createSeatMenu({
    _myHomeFriends: () => o.friends || {}, _premiumOn: () => !!o.premium, hiddenSeatsMod: hidden,
    mhVisitMod: { openFriendHomeView: call('visit') }, openCreator: call('creator'), reportMod: () => ({ openDialog: call('report') }),
    seatFriendReqMod: { _friendReqAsk: call('friendReq') }, setUserStatus: call('status'), toast: (m) => log.toasts.push(m),
    tricksMod: { _bonkLeft: () => (o.bonkLeft === undefined ? 3 : o.bonkLeft), BONK_DAILY_MAX: 5, BONK_CURSOR_IMG: 'bonk.png', bonkSeat: call('bonk') }, userStatus: () => o.status || null,
  });
  const open = (seat, ev) => { out._seatCtxMenu(ev || { clientX: 10, clientY: 20 }, seat); timers.splice(0).forEach((f) => f()); };
  const menu = () => nodes.find((n) => n.className === 'cr-preset-ctx seat-ctx');
  const backdrop = () => nodes.find((n) => n.className === 'seat-ctx-backdrop');
  const labels = () => (menu() ? menu().children.filter((c) => c.textContent).map((c) => c.textContent) : []);
  const item = (txt) => menu().children.find((c) => c.textContent === txt);
  const calls = (k) => log.calls.filter((c) => c[0] === k);
  return { out, log, hidden, open, menu, backdrop, labels, item, calls, docL, nodes };
}
const lastT = (w) => w.log.toasts[w.log.toasts.length - 1];

function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).join() === '_seatCtxMenu', '만들 때 던지지 않고 _seatCtxMenu 하나를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const friend = { remote: true, friendUserId: 'u1', friendId: 'm1', friendName: '민지' };
  w = world(src, { friends: { u1: {} } }); w.open(friend);
  t(w.labels().join('|') === '🏠 마이홈 구경|🙈 숨기기|🚩 신고하기…' && w.menu().style.cssText.includes('left:10px;top:20px;'), '친구 좌석 — 마이홈 구경 · 숨기기(워킹룸) · 신고 · 누른 자리에');
  w.item('🏠 마이홈 구경').onclick();
  t(JSON.stringify(w.calls('visit')) === '[["visit","u1"]]' && w.menu() === undefined && w.backdrop() === undefined, '마이홈 구경 — 그 사용자 마이홈 · 메뉴와 뒷판을 같이 닫는다');
  w = world(src); w.open(friend); w.item('👤 친구 신청').onclick();
  t(w.calls('friendReq')[0][1] === 'u1' && w.calls('friendReq')[0][2] === friend, '친구가 아니면 친구 신청(두 번 눌러 보내기 모듈로)');
  w = world(src); w.open({ remote: true, friendId: 'm2' }); w.item('👤 친구 신청').onclick();
  t(/정보가 아직 없어요/.test(lastT(w)) && !w.calls('friendReq').length, '사용자 정보가 없는 옛 앱 좌석 — 안내만');
  w = world(src); w.open(friend); w.item('🙈 숨기기').onclick(); w.open(friend);
  t(w.hidden._hiddenSeatIds.has('m1') && w.labels().includes('🙉 다시 보이기'), '숨기기 — 이 방 세션 id 를 숨김 · 다시 열면 «다시 보이기»');
  w.item('🙉 다시 보이기').onclick();
  t(!w.hidden._hiddenSeatIds.has('m1'), '다시 보이기 — 숨김을 푼다');
  w = world(src, { channel: 2 }); w.open(friend);
  t(!w.labels().some((l) => /숨기기|다시 보이기/.test(l)), '투게더룸(채널 2)에서는 숨기기가 없다');
  w = world(src, { channel: 2, rptHidden: ['u1'], hiddenIds: ['m1'] }); w.open(friend); w.item('🙉 다시 보이기').onclick();
  t(!w.hidden._reportHiddenUids.has('u1') && !w.hidden._hiddenSeatIds.has('m1') && w.calls('rptSave').length === 1, '신고로 숨긴 사람 — 채널과 상관없이 «다시 보이기» 로 풀고 저장');
  w = world(src); w.open(friend); w.item('🚩 신고하기…').onclick();
  t(w.calls('report')[0][1] === friend && !w.menu(), '신고하기 — 메뉴를 닫고 신고 창에 그 좌석');

  const me = { isMe: true };
  w = world(src); w.open(me);
  t(w.labels().join('|') === '🎨 캐릭터 편집|🫧 자리비움', '내 좌석 — 캐릭터 편집 · 자리비움(신고 · 친구 없음)');
  w.item('🎨 캐릭터 편집').onclick(); w.open(me); w.item('🫧 자리비움').onclick();
  t(JSON.stringify(w.calls('creator')[0][1]) === JSON.stringify({ kind: 'seat', seat: me }) && w.calls('status')[0][1] === 'away', '편집은 그 좌석으로 생성기 · 자리비움은 away');
  w = world(src, { status: 'away' }); w.open(me); w.item('🔵 비움 해제').onclick();
  t(w.calls('status')[0][1] === null, '자리비움 중이면 «비움 해제» — 온라인(null)으로');

  w = world(src, { premium: true }); w.open(me);
  const sepCount = w.menu().children.filter((c) => !c.textContent).length;
  t(w.labels().includes('때리기 (3/5)') && sepCount === 1 && w.item('때리기 (3/5)').children[0].src === 'bonk.png', '프리미엄 — 때리기(남은 횟수 / 하루 최대 · 그림) · 위에 구분선');
  w.item('때리기 (3/5)').onclick();
  t(w.calls('bonk')[0][1] === me, '때리기 — 그 좌석을');
  w = world(src, { premium: true, bonkLeft: 0 }); w.open(friend); w.item('때리기 (0/5)').onclick();
  t(!w.calls('bonk').length && lastT(w) === '오늘은 다 썼어요', '다 쓴 날 — 눌러도 «오늘은 다 썼어요» 만');
  const wn = world(src); wn.open(me); const wh = world(src, { premium: true, seatHidden: true }); wh.open(friend);
  t(!wn.labels().some((l) => /때리기/.test(l)) && wn.menu().children.filter((c) => !c.textContent).length === 0 && !wh.labels().some((l) => /때리기/.test(l)), '프리미엄이 아니면 · 숨긴 캐릭터면 때리기 줄 없음(구분선도)');

  w = world(src); w.open(friend); w.backdrop().fire('mousedown', {});
  t(!w.menu() && !w.backdrop() && !(w.docL.keydown || []).length && !(w.docL.mousedown || []).length, '뒷판 클릭 — 닫고 리스너 정리');
  w = world(src); w.open(friend); w.backdrop().fire('contextmenu', {});
  t(!w.menu(), '뒷판 우클릭 — 닫는다');
  w = world(src); w.open(friend); let stopped = false;
  (w.docL.keydown || []).forEach((f) => f({ key: 'Escape', stopPropagation() { stopped = true; } }));
  t(!w.menu() && stopped, 'ESC — 닫고 전파를 끊는다(마이홈까지 닫히지 않게)');
  w = world(src); w.open(friend); const m0 = w.menu();
  (w.docL.mousedown || []).forEach((f) => f({ target: m0.children[0] }));
  const stay = !!w.menu();
  (w.docL.mousedown || []).forEach((f) => f({ target: {} }));
  t(stay && !w.menu(), '메뉴 안 클릭은 그대로 · 바깥 클릭은 닫는다');
  w = world(src); w.open(friend); w.open(me);
  t(w.nodes.filter((n) => n.className === 'cr-preset-ctx seat-ctx').length === 1 && w.nodes.filter((n) => n.className === 'seat-ctx-backdrop').length === 1, '다시 열면 앞 메뉴 · 뒷판을 지운다(하나만)');
  w = world(src, { right: 400, bottom: 250 }); w.open(me, { clientX: 290, clientY: 190 });
  t(w.menu().style.left === '176px' && w.menu().style.top === '116px', '화면 밖으로 넘치면 오른쪽 · 아래 끝 안쪽으로 당긴다');

  let threw = false;
  try { const a = world(src); a.out._seatCtxMenu(null, friend); a.out._seatCtxMenu({ clientX: 1, clientY: 1 }, null); const b = world(src, { noBody: true }); b.out._seatCtxMenu({ clientX: 1, clientY: 1 }, friend);
    t(!a.menu() && !b.menu(), '입구 전제 — 이벤트 · 좌석 · 화면이 없으면 던지지 않고 열지 않는다'); } catch (_) { threw = true; }
  if (threw) t(false, '입구 전제 — 없을 때 던졌다');
  return r;
}

function wire(app, html, over) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function _seatCtxMenu\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const seatMenuMod = TwSeatMenu\.createSeatMenu\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim().split(':')[0]).join() === '_myHomeFriends,_premiumOn,hiddenSeatsMod,mhVisitMod,openCreator,reportMod,seatFriendReqMod,setUserStatus,toast,tricksMod,userStatus', '만드는 줄(가드 없이) · deps 11');
  t(/\}\);\noverheadMod\.setSeatMenu\(\(\.\.\.a\)=>seatMenuMod\._seatCtxMenu\(\.\.\.a\)\);/.test(app) && !/_seatCtxMenu: \(\.\.\.a\)=>/.test(app), '이름표 우클릭은 만드는 줄 바로 뒤 setSeatMenu 로 잇는다(이름표 deps 로 받지 않는다 — 순환)');
  t(/let _seatMenuFn = null;[^\n]*\nfunction setSeatMenu\(fn\)\{ _seatMenuFn = fn; \}/.test(over) && /if\(_seatMenuFn\) _seatMenuFn\(e, seat\);/.test(over), 'overhead.js — 갈고리로 받고 · 잇기 전이면 아무것도 안 한다');
  t(/seatMenuMod\._seatCtxMenu\(e, seat\);/.test(A), '캔버스 우클릭은 seatMenuMod._seatCtxMenu');
  const iM = html.indexOf('<script src="parts/room/seat-menu.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — room/seat-menu.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const B = behave(MOD);
B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 남의 좌석', 10: '── 2. 내 좌석', 13: '── 3. 때리기', 17: '── 4. 닫기', 23: '── 5. 입구 전제' }; if (s[i]) say(s[i]); chk(ok, msg); });
say('── 6. app.js 연결');
wire(APP, HTML, OVER).forEach(([ok, msg]) => chk(ok, msg));
chk(!SMOKE || /PRELOAD\.push\('seat-menu\.js'\);/.test(SMOKE), 'smoke 가 seat-menu.js 를 먼저 싣는다');
say('── 7. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['ESC 전파를 안 끊음', (m) => m.replace("if(e.key === 'Escape'){ e.stopPropagation(); close(); return; }", "if(e.key === 'Escape'){ close(); return; }"), null, null, null],
  ['뒷판을 안 지움', (m) => m.replace('    menu.remove();\n    backdrop.remove();', '    menu.remove();'), null, null, null],
  ['투게더룸에도 숨기기', (m) => m.replace('else if(window._activeChannel === 1 && seat.friendId){', 'else if(seat.friendId){'), null, null, null],
  ['다 써도 때림', (m) => m.replace("mk('때리기 (' + left + '/' + tricksMod.BONK_DAILY_MAX + ')', ()=>tricksMod.bonkSeat(seat), left <= 0,", "mk('때리기 (' + left + '/' + tricksMod.BONK_DAILY_MAX + ')', ()=>tricksMod.bonkSeat(seat), false,"), null, null, null],
  ['숨긴 캐릭터도 때리기', (m) => m.replace('if(_premiumOn() && !hiddenSeatsMod._seatHidden(seat)){', 'if(_premiumOn()){'), null, null, null],
  ['비움 해제가 away', (m) => m.replace("setUserStatus(_away ? null : 'away');", "setUserStatus('away');"), null, null, null],
  ['입구 전제 없앰', (m) => m.replace('  if(!ev || !seat || !document.body) return;', ''), null, null, null],
  ['만들 때 던짐', (m) => m.replace('function createSeatMenu(deps){', 'function createSeatMenu(deps){ throw new Error("깨 봄");'), null, null, null],
  ['app.js 에 본문이 남음', null, (a) => a + '\nfunction _seatCtxMenu(ev, seat){}', null, null],
  ['잇는 줄 빠짐', null, (a) => a.replace(/\noverheadMod\.setSeatMenu\([^\n]*/, ''), null, null],
  ['이름표가 잇기 전에 부름', null, null, null, (v) => v.replace('if(_seatMenuFn) _seatMenuFn(e, seat);', '_seatMenuFn(e, seat);')],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/room/seat-menu.js"></script>', ''), null],
];
for (const [name, fm, fa, fh, fo] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML, o2 = fo ? fo(OVER) : OVER;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML || o2 !== OVER;
  let rows; try { rows = (fm ? behave(m2) : []).concat(wire(a2, h2, o2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 좌석 우클릭 메뉴는 room/seat-menu.js 에서'));
process.exit(fail ? 1 : 0);
