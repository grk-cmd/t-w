/* sim-seat-friend-req.js — 🙋 좌석 우클릭 친구 신청(myhome/seat-friend-req.js) 동작 · 연결
   실행:  node sim-seat-friend-req.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 상대 좌석 우클릭 «👤 친구 신청» 은 두 번 눌러야 보낸다(실행 화면은 확인 다이얼로그를 못 띄운다).
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) «언제 보내고 언제 안 보내는가 · 무슨 말을 하는가» 를 입력 → 출력으로 고정한다.
   ・1절: 만들 때 — 던지지 않고 _friendReqAsk · resultView(결과 → 안내 문구 한 벌) · sendFriendReq(보내기 한 벌) 를 내놓는다 — 남의 마이홈 [친구 신청]도 뒤의 둘을 부른다
   ・2절: 두 번 눌러 보내기 — 첫 번째는 안내만 · 같은 사람 두 번째에 보냄 · 다른 사람이면 다시 처음부터 · 5초 지나면 처음부터
   ・3절: 앞단 검사 · 결과 문구 — 준비 안 됨 · 나 · 이미 친구 · 정원(경계 MAX−1 / MAX) · 보낸 요청이 열려 있으면 안 보냄(마이홈에서 적은 사유를 지우지 않게 · 앞단 검사 뒤에만 묻는다 · 못 읽으면 안 보내고 E-FR-07) · 친구 목록 모름이면 안 보냄 · 서버 결과 셋 · 던짐 · sendFriendReq 가 결과만 돌려줌
   ・4절: app.js 연결 · 5절: mutation test */
'use strict';
globalThis.TwPersonName = require([__dirname, process.cwd()].flatMap(d => ['person-name.js', 'parts/shared/person-name.js', 'app/parts/shared/person-name.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🏷️ 모듈이 부르는 이름 그리기(이름 없음 → «이름 없음») — 진짜 파일
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
  const log = { toasts: [], sends: [], notes: [], checks: 0 };
  globalThis.TwErrorCodes = { notify: (code, err) => { log.notes.push(code); return true; } };   // 모듈이 부르는 오류 번호 알림(E-FR-07)
  const timers = [];
  const log2 = [];
  const api = o.noApi ? undefined : { sendFriendRequest: async (...a) => { log.sends.push(a); if (o.throws) throw new Error('x'); return o.res === undefined ? { ok: true } : o.res; },
    isFriendRequestAlive: async (toId, me) => { log2.push([toId, me]); if (o.aliveThrows) throw new Error('x'); return (o.pending || []).includes(toId); } };
  log.alive = log2;
  const trap = { sendFriendRequest: async () => { log.sends.push(['전역 firebaseAPI 를 불렀다']); return { ok: true }; } };   // 모듈은 friendNet 만 써야 한다
  const win = { firebaseAPI: trap };
  const T = new Function('window', 'firebaseAPI', 'setTimeout', 'clearTimeout', 'module', src + '\nreturn window.TwSeatFriendReq;')(
    win, trap, (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; }, (id) => { if (timers[id - 1]) timers[id - 1].live = false; }, undefined);
  const out = T.createSeatFriendReq({ FRIEND_MAX: MAX, friendsForCheck: async () => { log.checks++; return o.friendsFail ? null : (o.friends || {}); }, friendNet: () => api, getMyUserId: () => 'me', toast: (m) => log.toasts.push(m) });
  return { out, log, timers, fire: () => { const t = timers.filter((x) => x.live).pop(); if (t) { t.live = false; t.fn(); } } };
}
const flush = () => new Promise((r) => setImmediate(r));
const lastT = (w) => w.log.toasts[w.log.toasts.length - 1];

async function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  t(!err && w && Object.keys(w.out).join() === '_friendReqAsk,resultView,sendFriendReq', '만들 때 던지지 않고 _friendReqAsk · resultView · sendFriendReq 를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  { const V = w.out.resultView;
    t(V({ ok: true }, '민지').kind === 'ok' && V({ ok: false, reason: 'already' }, 'a').kind === 'info' && V({ ok: false, reason: 'self' }, 'a').kind === 'info'
      && V({ ok: false, reason: 'full' }, 'a').kind === 'info' && V({ ok: false, reason: 'full' }, 'a').text === '친구는 최대 ' + MAX + '명까지만 추가할 수 있어요' && V({ ok: false, reason: 'not_ready' }, 'a').kind === 'info'
      && V({ ok: false, reason: 'error' }, 'a').kind === 'fail' && V({ ok: false, reason: 'save_failed' }, 'a').kind === 'fail' && V(null, 'a').kind === 'fail',
      'resultView — 성공 · 안내(나 · 이미 친구 · 정원 · 준비 안 됨) · 실패(던짐 · 저장 실패 · 빈 답) 한 벌'); }
  const seat = { friendName: '민지' };
  w.out._friendReqAsk('u2', seat); await flush();
  t(w.log.sends.length === 0 && /^민지님은 아직 친구가 아니에요 — 5초 안에 우클릭 › «👤 친구 신청»을 한 번 더 누르면 보내요$/.test(lastT(w)) && w.timers[0] && w.timers[0].ms === 5000, '첫 번째 — 안내만 · 5초 시계');
  w.out._friendReqAsk('u2', seat); await flush();
  t(w.log.sends.length === 1 && JSON.stringify(w.log.sends[0]) === JSON.stringify(['me', 'u2', '']) && lastT(w) === '민지님에게 친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요',
    '같은 사람 두 번째 — (나, 상대, 빈 사유) 로 보내고 알린다(이름은 싣지 않는다 · 좌석은 사유 칸이 없다)');
  w.out._friendReqAsk('u2', seat); await flush();
  t(w.log.sends.length === 1, '보낸 뒤엔 다시 처음부터(세 번째는 안내만)');
  w = world(src);
  w.out._friendReqAsk('u2', seat); w.out._friendReqAsk('u3', seat); await flush();
  t(w.log.sends.length === 0, '다른 사람을 누르면 다시 처음부터');
  w = world(src);
  w.out._friendReqAsk('u2', {}); w.fire(); w.out._friendReqAsk('u2', {}); await flush();
  t(w.log.sends.length === 0 && /^이름 없음님은/.test(lastT(w)), '5초가 지나면 처음부터 · 좌석 이름이 없으면(null) «이름 없음»(TwPersonName)');
  w = world(src);
  w.out._friendReqAsk('u2', null); await flush();
  t(/^이 사람님은/.test(lastT(w)), '  좌석 자체가 없으면 «이 사람»');

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
  x = await twice({ pending: ['u2'] });
  t(x.log.sends.length === 0 && JSON.stringify(x.log.alive[0]) === JSON.stringify(['u2', 'me']) && lastT(x) === '이미 민지님에게 친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요',
    '보낸 요청이 열려 있으면 다시 보내지 않는다(사유 없이 다시 보내면 마이홈에서 적은 사유가 지워진다) · 안내만');
  { const self = await twice({ pending: ['me'] }, 'me'), fr = await twice({ friends: { u2: {} }, pending: ['u2'] }), full = await twice({ friends: { a: 1, b: 1, c: 1 }, pending: ['u2'] });
    t([self, fr, full].every((y) => y.log.sends.length === 0 && y.log.alive.length === 0) && lastT(fr) === '이미 친구예요' && /^친구는 최대/.test(lastT(full)),
      '  앞단 검사(나 · 이미 친구 · 정원)에 막히면 열려 있나를 묻지 않는다(요청 0) · 그 검사의 문구'); }
  x = await twice({ pending: ['u9'] });
  t(x.log.sends.length === 1 && x.log.alive.length === 1, '  다른 사람에게 보낸 요청만 있으면 보낸다');
  x = await twice({ aliveThrows: true });
  t(x.log.sends.length === 0 && x.log.notes.join() === 'E-FR-07' && x.log.toasts.length === 1, '  ★ 열려 있나를 못 읽으면 보내지 않고 E-FR-07 — «없음» 으로 치고 빈 사유로 보내면 마이홈에서 적은 사유가 지워진다');
  x = await twice({ friendsFail: true });
  t(x.log.sends.length === 0 && x.log.alive.length === 0 && x.log.toasts.length === 1 && x.log.notes.length === 0, '  ★ 친구 목록을 못 읽으면(friendsForCheck null) 보내지 않는다 · 안내는 friends-sub 한 곳(여기서 토스트 더 안 띄움 — 첫 안내 한 줄만)');
  { const y = world(src, { friendsFail: true }); const res = await y.out.sendFriendReq('u2', '민지', 'x');
    t(res.ok === false && res.reason === 'friends_unknown' && y.log.sends.length === 0 && y.out.resultView(res, '민지').kind === 'quiet', '  sendFriendReq — 친구 목록 모름이면 friends_unknown(quiet) · 안 보냄(빈 {} 로 치지 않는다)'); }
  { const y = world(src, { pending: ['u2'] }); const res = await y.out.sendFriendReq('u2', '민지', '새 사유');
    t(res.ok === true && y.log.sends.length === 1 && y.log.alive.length === 0, '  마이홈 [친구 신청](sendFriendReq)은 열린 요청을 묻지 않는다 — 새 사유로 덮는 것이 서버 규칙'); }
  x = await twice({ res: { ok: false, reason: 'already' } });
  t(lastT(x) === '이미 친구예요', '서버 already → «이미 친구예요»');
  x = await twice({ res: { ok: false, reason: 'self' } });
  t(lastT(x) === '내 코드는 추가할 수 없어요', '서버 self → «내 코드는 추가할 수 없어요»');
  x = await twice({ res: null });
  t(lastT(x) === '요청에 실패했어요', '그 밖 → «요청에 실패했어요»');
  x = await twice({ throws: true });
  t(lastT(x) === '요청 중 오류가 발생했어요', '던지면 «요청 중 오류가 발생했어요»');
  /* sendFriendReq — 마이홈 [친구 신청] 이 부르는 한 벌: 토스트 없이 결과만 · 신청 사유를 provider 에 넘긴다 */
  { const y = world(src); const res = await y.out.sendFriendReq('u2', '민지', '같이 공부해요');
    t(res.ok === true && JSON.stringify(y.log.sends[0]) === JSON.stringify(['me', 'u2', '같이 공부해요']) && y.log.toasts.length === 0, 'sendFriendReq — (나, 상대, 사유) 로 보내고 토스트는 안 띄운다'); }
  { const y = world(src, { friends: { u2: {} } }); const res = await y.out.sendFriendReq('u2', '민지', 'x');
    t(res.ok === false && res.reason === 'already' && y.log.sends.length === 0, '  같은 앞단 검사 — 이미 친구면 already · 안 보냄'); }
  { const y = world(src, { friends: { a: 1, b: 1, c: 1 } }); const res = await y.out.sendFriendReq('u2', '민지', 'x');
    t(res.reason === 'full' && y.log.sends.length === 0, '  정원이면 full'); }
  { const y = world(src, { noApi: true }); const res = await y.out.sendFriendReq('u2', '민지', 'x');
    t(res.reason === 'not_ready', '  provider 없으면 not_ready'); }
  { const y = world(src, { res: null }); const res = await y.out.sendFriendReq('u2', '민지', 'x');
    t(res.ok === false && res.reason === 'save_failed', '  서버가 빈 답이면 save_failed'); }
  { const y = world(src, { throws: true }); const res = await y.out.sendFriendReq('u2', '민지', 'x');
    t(res.ok === false && res.reason === 'error', '  던지면 error(삼키고 결과로)'); }
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app), M = strip(read('room/seat-menu.js') || '');   // 좌석 메뉴는 room/seat-menu.js(C 구역 떼기 w4)
  t(!/function _friendReqAsk\b|function _friendReqSend\b|let _friendReqArmed\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const seatFriendReqMod = TwSeatFriendReq\.createSeatFriendReq\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim().replace(/\s*\/\/.*$/, '')).join('|') === 'FRIEND_MAX: FRIEND_MAX,|friendsForCheck: (...a)=>friendsSubMod.friendsForCheck(...a),|friendNet: ()=>({ sendFriendRequest: (...a)=>friendRequestsPortMod.send(...a), isFriendRequestAlive }),|getMyUserId: (...a)=>getMyUserId(...a),|toast: (...a)=>toast(...a),',
    '만드는 줄(가드 없이) · deps 5 — 값 FRIEND_MAX · 판정용 친구 목록(friends-sub friendsForCheck — 못 받은 목록을 빈 {} 로 치지 않는다) · 읽는 함수 friendNet(데이터 provider 고르기 한 줄) · 함수 2');
  t((A.match(/const isFriendRequestAlive = async \(toId, me\)=>\(await friendRequestsPortMod\.sentIds\(me\)\)\.includes\(toId\);/g) || []).length === 1 && !/isFriendRequestAlive: async/.test(A),
    '열려 있나(isFriendRequestAlive)는 app.js 에 한 번만 — 포트 sentIds(GET 한 번 · 이름 없음) · 마이홈 단추와 좌석이 같이 쓴다');
  t(/seatFriendReqMod\._friendReqAsk\(uid, seat\)/.test(M) && !/[^.\w]_friendReqAsk\(/.test(A + M), '부르는 곳(좌석 메뉴)은 seatFriendReqMod._friendReqAsk');
  const iM = html.indexOf('<script src="parts/myhome/seat-friend-req.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — myhome/seat-friend-req.js 를 app.js 보다 먼저 싣는다');
  return r;
}

(async () => {
  const B = await behave(MOD);
  B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 만들 때', 2: '── 2. 두 번 눌러 보내기', 7: '── 3. 앞단 검사 · 결과 문구' }; if (s[i]) say(s[i]); chk(ok, msg); });
  say('── 4. app.js 연결');
  wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. mutation test — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['한 번에 보냄', (m) => m.replace('if(_friendReqArmed !== uid){', 'if(false){'), null, null],
    ['5초를 50초로', (m) => m.replace('const FRIEND_REQ_ARM_MS = 5000;', 'const FRIEND_REQ_ARM_MS = 50000;'), null, null],
    ['정원 검사 >= 를 > 로', (m) => m.replace('.length >= FRIEND_MAX', '.length > FRIEND_MAX'), null, null],
    ['이미 친구 검사 없앰', (m) => m.replace("  if(fr[uid]) return { ok:false, reason:'already' };\n", ''), null, null],
    ['친구 목록 모름을 빈 {} 로(옛 `|| {}`)', (m) => m.replace("  const fr = await friendsForCheck();\n  if(!fr) return { ok:false, reason:'friends_unknown' };", "  const fr = (await friendsForCheck()) || {};"), null, null],
    ['정원 문구를 안내 아닌 실패로', (m) => m.replace("if(r === 'full') return { kind:'info',", "if(r === 'full') return { kind:'fail',"), null, null],
    ['열린 요청에도 보냄', (m) => m.replace("  if(pending === true){ toast(resultView({ ok:false, reason:'pending' }, name).text); return; }\n", ''), null, null],
    ['앞단 검사보다 먼저 열려 있나를 물음', (m) => m.replace("  const blocked = await _blocked(uid);\n  if(blocked){ const v = resultView(blocked, name); if(v.kind !== 'quiet') toast(v.text); return; }\n  const pending = await _sentPending(uid);", "  const pending = await _sentPending(uid);\n  const blocked = await _blocked(uid);\n  if(blocked){ const v = resultView(blocked, name); if(v.kind !== 'quiet') toast(v.text); return; }"), null, null],
    ['열려 있나를 못 읽으면 «없음» 으로 치고 보냄(옛 catch → false)', (m) => m.replace("}catch(e){ return { err: e }; }", "}catch(_){ return false; }"), null, null],
    ['열려 있나를 못 읽어도 E-FR-07 없이 보냄', (m) => m.replace("  if(pending !== false){ TwErrorCodes.notify('E-FR-07', pending && pending.err); return; }   // 보낸 요청이 열려 있는지 모른다 — 보내지 않는다\n", ''), null, null],
    ['app.js 가 열려 있나를 안 이음', null, (a) => a.replace("friendRequestsPortMod.send(...a), isFriendRequestAlive }),", "friendRequestsPortMod.send(...a) }),"), null],
    ['app.js 가 열려 있나를 따로 또 만듦', null, (a) => a.replace("friendRequestsPortMod.send(...a), isFriendRequestAlive }),", "friendRequestsPortMod.send(...a), isFriendRequestAlive: async (toId, me)=>{ const s = await friendRequestsPortMod.listSent(me); return !!(s && s[toId]); } }),"), null],
    ['열려 있나가 이름까지 받음', null, (a) => a.replace("(await friendRequestsPortMod.sentIds(me)).includes(toId);", "!!(await friendRequestsPortMod.listSent(me))[toId];"), null],
    ['사유를 버림', (m) => m.replace('await net.sendFriendRequest(getMyUserId(), uid, msg);', 'await net.sendFriendRequest(getMyUserId(), uid);'), null, null],
    ['provider 대신 전역 firebaseAPI 를 부름', (m) => m.replace('await net.sendFriendRequest(', 'await firebaseAPI.sendFriendRequest('), null, null],
    ['만들 때 던짐', (m) => m.replace('function createSeatFriendReq(deps){', 'function createSeatFriendReq(deps){ throw new Error("mutation");'), null, null],
    ['app.js 에 본문이 남음', null, (a) => a + '\nfunction _friendReqSend(){}', null],
    ['deps 하나 빠짐', null, (a) => a.replace('createSeatFriendReq({\n  FRIEND_MAX: FRIEND_MAX,\n', 'createSeatFriendReq({\n'), null],
    ['app.js 가 판정용 목록 대신 화면 캐시를 넘김', null, (a) => a.replace("  friendsForCheck: (...a)=>friendsSubMod.friendsForCheck(...a),   // 이미 친구 · 정원", "  _myHomeFriends: ()=>_myHomeFriends,   // 이미 친구 · 정원"), null],
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
