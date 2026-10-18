/* sim-seat-friend-req.js — 🙋 좌석 우클릭 친구 신청(myhome/seat-friend-req.js) 동작 · 연결
   실행:  node sim-seat-friend-req.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 상대 좌석 우클릭 «👤 친구 신청» 은 두 번 눌러야 보낸다(실행 화면은 확인 다이얼로그를 못 띄운다).
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) «언제 보내고 언제 안 보내는가 · 무슨 말을 하는가» 를 입력 → 출력으로 고정한다.
   ・1절: 만들 때 — 던지지 않고 _friendReqAsk 하나를 내놓는다
   ・2절: 두 번 눌러 보내기 — 첫 번째는 안내만 · 같은 사람 두 번째에 보냄 · 다른 사람이면 다시 처음부터 · 5초 지나면 처음부터
   ・3절: 앞단 검사 · 결과 문구 — 준비 안 됨 · 나 · 이미 친구 · 정원(경계 MAX−1 / MAX) · 서버 결과 셋 · 던짐
   ・4절: app.js 연결 · 5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome/seat-friend-req.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — seat-friend-req.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const MAX = 3;

function world(src, o = {}) {
  const log = { toasts: [], sends: [] };
  const timers = [];
  const api = o.noApi ? undefined : { sendFriendRequest: async (...a) => { log.sends.push(a); if (o.throws) throw new Error('x'); return o.res === undefined ? { ok: true } : o.res; } };
  const trap = { sendFriendRequest: async () => { log.sends.push(['전역 firebaseAPI 를 불렀다']); return { ok: true }; } };   // 모듈은 friendNet 만 써야 한다
  const win = { firebaseAPI: trap };
  const T = new Function('window', 'firebaseAPI', 'setTimeout', 'clearTimeout', 'module', src + '\nreturn window.TwSeatFriendReq;')(
    win, trap, (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; }, (id) => { if (timers[id - 1]) timers[id - 1].live = false; }, undefined);
  const out = T.createSeatFriendReq({ FRIEND_MAX: MAX, _myHomeFriends: () => o.friends || {}, friendNet: () => api, getDisplayName: () => '나닉', getMyUserId: () => 'me', toast: (m) => log.toasts.push(m) });
  return { out, log, timers, fire: () => { const t = timers.filter((x) => x.live).pop(); if (t) { t.live = false; t.fn(); } } };
}
const flush = () => new Promise((r) => setImmediate(r));
const lastT = (w) => w.log.toasts[w.log.toasts.length - 1];

async function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).join() === '_friendReqAsk', '만들 때 던지지 않고 _friendReqAsk 하나를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const seat = { friendName: '민지' };
  w.out._friendReqAsk('u2', seat); await flush();
  t(w.log.sends.length === 0 && /^민지님은 아직 친구가 아니에요 — 5초 안에 우클릭 › «👤 친구 신청»을 한 번 더 누르면 보내요$/.test(lastT(w)) && w.timers[0] && w.timers[0].ms === 5000, '첫 번째 — 안내만 · 5초 시계');
  w.out._friendReqAsk('u2', seat); await flush();
  t(w.log.sends.length === 1 && JSON.stringify(w.log.sends[0]) === JSON.stringify(['me', 'u2', '나닉', '민지', null]) && lastT(w) === '민지님에게 친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요',
    '같은 사람 두 번째 — (나, 상대, 내 이름, 상대 이름, null) 로 보내고 알린다');
  w.out._friendReqAsk('u2', seat); await flush();
  t(w.log.sends.length === 1, '보낸 뒤엔 다시 처음부터(세 번째는 안내만)');
  w = world(src);
  w.out._friendReqAsk('u2', seat); w.out._friendReqAsk('u3', seat); await flush();
  t(w.log.sends.length === 0, '다른 사람을 누르면 다시 처음부터');
  w = world(src);
  w.out._friendReqAsk('u2', {}); w.fire(); w.out._friendReqAsk('u2', {}); await flush();
  t(w.log.sends.length === 0 && /^이 사람님은/.test(lastT(w)), '5초가 지나면 처음부터 · 이름 없으면 «이 사람»');

  const twice = async (o, uid = 'u2') => { const x = world(src, o); x.out._friendReqAsk(uid, seat); x.out._friendReqAsk(uid, seat); await flush(); await flush(); return x; };
  let x = await twice({ noApi: true });
  t(x.log.sends.length === 0 && lastT(x) === '아직 준비 중이에요', '데이터 provider(friendNet)가 없으면 «아직 준비 중이에요»');
  x = await twice({}, 'me');
  t(x.log.sends.length === 0 && lastT(x) === '내 코드는 추가할 수 없어요', '나에게는 안 보낸다');
  x = await twice({ friends: { u2: {} } });
  t(x.log.sends.length === 0 && lastT(x) === '이미 친구예요', '이미 친구면 안 보낸다');
  x = await twice({ friends: { a: 1, b: 1, c: 1 } });
  t(x.log.sends.length === 0 && lastT(x) === '친구는 최대 ' + MAX + '명까지만 추가할 수 있어요', '친구가 정원(MAX)이면 안 보낸다');
  x = await twice({ friends: { a: 1, b: 1 } });
  t(x.log.sends.length === 1, '정원 하나 전(MAX−1)이면 보낸다');
  x = await twice({ res: { ok: false, reason: 'already' } });
  t(lastT(x) === '이미 친구예요', '서버 already → «이미 친구예요»');
  x = await twice({ res: { ok: false, reason: 'self' } });
  t(lastT(x) === '내 코드는 추가할 수 없어요', '서버 self → «내 코드는 추가할 수 없어요»');
  x = await twice({ res: null });
  t(lastT(x) === '요청에 실패했어요', '그 밖 → «요청에 실패했어요»');
  x = await twice({ throws: true });
  t(lastT(x) === '요청 중 오류가 발생했어요', '던지면 «요청 중 오류가 발생했어요»');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app), M = strip(read('room/seat-menu.js') || '');   // 좌석 메뉴는 room/seat-menu.js(C 구역 떼기 w4)
  t(!/function _friendReqAsk\b|function _friendReqSend\b|let _friendReqArmed\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const seatFriendReqMod = TwSeatFriendReq\.createSeatFriendReq\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim()).join('|') === 'FRIEND_MAX: FRIEND_MAX,|_myHomeFriends: ()=>_myHomeFriends,|friendNet: ()=>window.firebaseAPI,|getDisplayName: (...a)=>getDisplayName(...a),|getMyUserId: (...a)=>getMyUserId(...a),|toast: (...a)=>toast(...a),',
    '만드는 줄(가드 없이) · deps 6 — 값 FRIEND_MAX · 읽는 함수 2(_myHomeFriends · friendNet 데이터 provider 고르기 한 줄) · 함수 3');
  t(/seatFriendReqMod\._friendReqAsk\(uid, seat\)/.test(M) && !/[^.\w]_friendReqAsk\(/.test(A + M), '부르는 곳(좌석 메뉴)은 seatFriendReqMod._friendReqAsk');
  const iM = html.indexOf('<script src="parts/myhome/seat-friend-req.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — myhome/seat-friend-req.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const B = await behave(MOD);
  B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 만들 때', 1: '── 2. 두 번 눌러 보내기', 6: '── 3. 앞단 검사 · 결과 문구' }; if (s[i]) say(s[i]); chk(ok, msg); });
  say('── 4. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['한 번에 보냄', (m) => m.replace('if(_friendReqArmed !== uid){', 'if(false){'), null, null],
    ['5초를 50초로', (m) => m.replace('const FRIEND_REQ_ARM_MS = 5000;', 'const FRIEND_REQ_ARM_MS = 50000;'), null, null],
    ['정원 검사 >= 를 > 로', (m) => m.replace('.length >= FRIEND_MAX', '.length > FRIEND_MAX'), null, null],
    ['이미 친구 검사 없앰', (m) => m.replace("if(_myHomeFriends() && _myHomeFriends()[uid]){ toast('이미 친구예요'); return; }", ''), null, null],
    ['provider 대신 전역 firebaseAPI 를 부름', (m) => m.replace('await net.sendFriendRequest(', 'await firebaseAPI.sendFriendRequest('), null, null],
    ['만들 때 던짐', (m) => m.replace('function createSeatFriendReq(deps){', 'function createSeatFriendReq(deps){ throw new Error("깨 봄");'), null, null],
    ['app.js 에 본문이 남음', null, (a) => a + '\nfunction _friendReqSend(){}', null],
    ['deps 하나 빠짐', null, (a) => a.replace('createSeatFriendReq({\n  FRIEND_MAX: FRIEND_MAX,\n', 'createSeatFriendReq({\n'), null],
    ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/myhome/seat-friend-req.js"></script>', '')],
  ];
  for (const [name, fm, fa, fh] of breaks) {
    const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
    const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
    let rows; try { rows = (fm ? await behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
    chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 좌석 우클릭 친구 신청은 myhome/seat-friend-req.js 에서'));
  process.exit(fail ? 1 : 0);
})();
