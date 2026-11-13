/* sim-room-focus.js — 📊 시크릿룸 집중 기록 올리기 · 서버 연결 · 규칙
   ・1절: room-focus-net.js 를 진짜로 돌린다(가짜 db) — 하루 합 트랜잭션(더하기만 · 86400 상한) · 이름 · 합치기 한 묶음 · 내 기록 지우기 · 구독(읽기 실패는 null)
   ・2절: room-focus-sync.js 를 진짜로 돌린다 — 꺼져 있으면 안 올림 · 시크릿룸만 · 1분 모아 정수 초 · 방 / 날이 바뀌면 앞 몫은 그 방 그 날에 · 실패 되돌림 · 끄면 버림 · 이름은 바뀔 때만
   ・3절: 규칙 — `_focus/$uid` 식을 실제로 굴린다(앱이 보내는 모양 · 거절 모양) · 칸 모양 · `_focus` 통째 쓰기는 안 열려 있다
   ・4절: 연결 — firebase-init · html 싣는 순서 · app.js 연결 · 포커스 모듈의 알림 · 모듈이 firebaseAPI 를 직접 부르지 않는다
   ・5절: 깨 보기 — 모듈 · 규칙 · 연결을 일부러 고쳐 보고 빨강이 나는지
   [실행] node checks/run.js sim-room-focus */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'apps/desktop/app/parts/' + f, 'apps/desktop/app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {
  net: read('focus/room-focus-net.js'), days: read('shared/room-focus-days.js'), sync: read('focus/room-focus-sync.js'),
  fi: read('firebase-init.js'), app: read('app.js'), html: read('desk-companion-prototype.html'), level: read('focus/focus-level.js'),
  rules: (() => { for (const c of ['firebase-database-rules.json', 'firebase/firebase-database-rules.json']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })(),
};
for (const k of Object.keys(SRC)) if (SRC[k] == null) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadWin = (src, win) => { new Function('window', 'module', src)(win, undefined); return win; };
const tick = () => new Promise((res) => setImmediate(res));

/* 가짜 db — runTransaction 은 콜백을 현재 값(cur)으로 돌려 돌려준 값을 쓴다 */
function mkDb(store){
  const log = [], cancels = [];
  const ref = (d, p) => ({ p: p === undefined ? '' : p });
  return {
    log, cancels, ref,
    runTransaction: async (r, fn) => { const cur = store[r.p] === undefined ? null : store[r.p]; const next = fn(cur); log.push(['tx', r.p, cur, next]); if (next === undefined) return { committed: false }; store[r.p] = next; return { committed: true }; },
    set: async (r, v) => { log.push(['set', r.p, v]); },
    update: async (r, w) => { log.push(['update', r.p, w]); },
    remove: async (r) => { log.push(['remove', r.p]); },
    onValue: (r, f, c) => { log.push(['on', r.p]); f({ val: () => null }); if (c) cancels.push(c); },
    off: (r, e) => { log.push(['off', r.p, e]); },
  };
}
/* 규칙식 실행기 — 스냅샷 흉내(newData · data) */
const snap = (val) => ({
  exists: () => val !== null && val !== undefined, val: () => val,
  isNumber: () => typeof val === 'number', isString: () => typeof val === 'string',
  hasChildren: (ks) => !!val && typeof val === 'object' && (ks ? ks.every((k) => val[k] !== undefined) : Object.keys(val).length > 0),
  child: (k) => snap(val && val[k] !== undefined ? val[k] : null),
});
function ruleRun(expr, vars, nw, old){
  const e = String(expr).replace(/\$(room|uid|day)\.matches\((\/(?:\\.|[^\/])+\/)\)/g, '$2.test($$$1)');
  try { return new Function('$room', '$uid', '$day', 'newData', 'data', 'return (' + e + ');')(vars.room, vars.uid, vars.day, snap(nw), snap(old === undefined ? null : old)) === true; }
  catch (e2) { return false; }
}

async function judge(S){
  const out = [];
  const t = (ok, msg) => out.push([!!ok, msg]);
  try {
    /* ── 1절 net ── */
    const N = loadWin(S.net, {}).TwRoomFocusNet;
    const store = {}, db = mkDb(store);
    const net = N.createRoomFocusNet({ db: {}, ref: db.ref, update: db.update, remove: db.remove, set: db.set, onValue: db.onValue, off: db.off, runTransaction: db.runTransaction });
    t((await net.add('SCRT-AB12', 'MATE-1', '20261113', 120)).ok === true && store['rooms/SCRT-AB12/_focus/MATE-1/d/20261113'] === 120, '하루 합 더하기 — 없던 날은 그 초부터');
    await net.add('SCRT-AB12', 'MATE-1', '20261113', 30.9);
    t(store['rooms/SCRT-AB12/_focus/MATE-1/d/20261113'] === 150, '  이어서 더한다(소수 초는 버린다)');
    store['rooms/SCRT-AB12/_focus/MATE-1/d/20261113'] = 86390; await net.add('SCRT-AB12', 'MATE-1', '20261113', 500);
    t(store['rooms/SCRT-AB12/_focus/MATE-1/d/20261113'] === 86400, '  하루 상한 86400 에서 멈춘다');
    store['rooms/SCRT-AB12/_focus/MATE-1/d/20261114'] = 'x'; await net.add('SCRT-AB12', 'MATE-1', '20261114', 60);
    t(store['rooms/SCRT-AB12/_focus/MATE-1/d/20261114'] === 60, '  숫자가 아닌 옛 값은 0 부터');
    t((await net.add('', 'MATE-1', '20261113', 5)).ok === false && (await net.add('SCRT-AB12', '', '20261113', 5)).ok === false && (await net.add('SCRT-AB12', 'MATE-1', '', 5)).ok === false && (await net.add('SCRT-AB12', 'MATE-1', '20261113', 0)).ok === false, '  방 · 내 id · 날 · 초 가 없으면 아무것도 안 한다');
    db.log.length = 0;
    await net.setName('SCRT-AB12', 'MATE-1', '가'.repeat(30));
    t(db.log[0][0] === 'set' && db.log[0][1] === 'rooms/SCRT-AB12/_focus/MATE-1/n' && db.log[0][2].length === 20, '이름은 20자까지 내 칸 n 에');
    db.log.length = 0;
    await net.compact('SCRT-AB12', 'MATE-1', { newO: 9000, keys: ['20260101', '20260102'] });
    t(db.log.length === 1 && db.log[0][0] === 'update' && JSON.stringify(db.log[0][2]) === JSON.stringify({ 'rooms/SCRT-AB12/_focus/MATE-1/o': 9000, 'rooms/SCRT-AB12/_focus/MATE-1/d/20260101': null, 'rooms/SCRT-AB12/_focus/MATE-1/d/20260102': null }), '합치기 — o 올리기 + 옛 날 지우기가 한 번의 update');
    t((await net.compact('SCRT-AB12', 'MATE-1', { newO: 1, keys: [] })).ok === false && (await net.compact('SCRT-AB12', 'MATE-1', null)).ok === false, '  합칠 날이 없으면 아무것도 안 한다');
    db.log.length = 0; await net.removeMine('SCRT-AB12', 'MATE-1');
    t(db.log[0][0] === 'remove' && db.log[0][1] === 'rooms/SCRT-AB12/_focus/MATE-1', '내 기록 지우기 — 내 칸 통째(남의 칸 · 방 전체가 아니다)');
    db.log.length = 0; db.cancels.length = 0; const got = [];
    const off = net.subscribe('SCRT-AB12', (x) => got.push(x)); db.cancels[0] && db.cancels[0](); off();
    t(db.log[0][1] === 'rooms/SCRT-AB12/_focus' && JSON.stringify(got) === '[{},null]' && db.log.some((x) => x[0] === 'off' && x[2] === 'value'), '구독은 방 전체 노드 하나 · 읽기 거절은 null(빈 {} 와 구분) · 해제하면 off');
    const bad = N.createRoomFocusNet({ db: {}, ref: db.ref, update: async () => { throw new Error('x'); }, remove: async () => { throw new Error('x'); }, set: async () => { throw new Error('x'); }, onValue(){}, off(){}, runTransaction: async () => { throw new Error('x'); } });
    t((await bad.add('SCRT-AB12', 'M1', '20261113', 5)).ok === false && (await bad.setName('SCRT-AB12', 'M1', 'a')).ok === false && (await bad.compact('SCRT-AB12', 'M1', { newO: 1, keys: ['20260101'] })).ok === false && (await bad.removeMine('SCRT-AB12', 'M1')).ok === false, '서버 오류는 던지지 않고 { ok:false }');

    /* ── 2절 sync ── */
    const Y = loadWin(S.sync, {}).TwRoomFocusSync;
    const DY = loadWin(S.days, {}).TwRoomFocusDays;
    t(DY.dayKeyOf('2026-11-3') === '20261103' && DY.dayKeyOf('2026-1-13') === '20260113' && DY.dayKeyOf('') === '' && DY.dayKeyOf('x') === '' && DY.dayKeyOf('2026-11-13x') === '', '날 키 — dayKeyOf: 월 · 일을 두 자리로 · 틀리면 빈 글');
    t(DY.isDayKey('20261113') && !DY.isDayKey('19990101') && !DY.isDayKey('2026-11-13') && !DY.isDayKey('202611130') && !DY.isDayKey(''), '  isDayKey: 20xx + 6자리(규칙 $day 와 같은 모양)');
    t(DY.weekStartKey('20261113') === '20261109' && DY.weekStartKey('20261109') === '20261109' && DY.weekStartKey('20261115') === '20261109' && DY.weekStartKey('20261116') === '20261116', '  이번 주 시작은 월요일 — 금요일 · 월요일 당일 · 일요일(전 주 월요일) · 다음 월요일');
    t(DY.weekStartKey('20260301') === '20260223' && DY.addDays('20261231', 1) === '20270101' && DY.addDays('20260301', -1) === '20260228' && DY.addDays('20261113', -84) === '20260821', '  달 · 해가 넘어가도 맞다');
    const mk = (o) => {
      o = o || {};
      const st = Object.assign({}, o.store || {}), calls = [], clock = { t: 1000000 }, cur = { room: o.room === undefined ? 'SCRT-AB12' : o.room, day: '20261113', name: '꿀곰', fail: false };
      const provider = {
        add: async (room, uid, day, sec) => { calls.push(['add', room, uid, day, sec]); return cur.fail ? { ok: false } : { ok: true }; },
        setName: async (room, uid, name) => { calls.push(['name', room, uid, name]); return { ok: true }; },
      };
      const storage = { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } };
      const uidNow = { v: o.uid === undefined ? 'umu00pdxvk6d9x8mx' : o.uid };
      const s = Y.createRoomFocusSync({ provider, roomCode: () => cur.room, isSecretRoom: () => /^SCRT-/.test(cur.room), getMyUserId: () => uidNow.v, getMyName: () => cur.name, dayKey: () => cur.day, now: () => clock.t, storage });
      return { s, calls, clock, cur, st, uidNow };
    };
    { const m = mk(); m.s.add(30); m.clock.t += 61000; m.s.add(30); await tick();
      t(m.calls.length === 0 && m.s.isOn('SCRT-AB12') === false, '켜지 않았으면 아무것도 안 올린다(기본 꺼짐)'); }
    { const m = mk({ room: 'WORK-AB12' }); m.s.setOn('WORK-AB12', true); m.s.add(30); m.clock.t += 61000; m.s.add(30); await tick();
      t(m.calls.length === 0, '시크릿룸이 아닌 방에서는 켜져 있어도 안 올린다'); }
    { const m = mk({ uid: '' }); m.s.setOn('SCRT-AB12', true); m.s.add(30); m.clock.t += 61000; m.s.add(30); await tick();
      t(m.calls.length === 0, '내 id 가 없으면 안 올린다'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true);
      m.s.add(30.5); await tick();
      t(m.calls.some((c) => c[0] === 'name' && c[3] === '꿀곰') && m.calls.filter((c) => c[0] === 'add').length === 1, '처음 쌓이면 바로 한 번 올린다(1분 간격은 그 뒤부터) — 이름도 함께');
      const first = m.calls.filter((c) => c[0] === 'add');
      t(first.length === 1 && first[0][4] === 30 && first[0][1] === 'SCRT-AB12' && first[0][2] === 'umu00pdxvk6d9x8mx' && first[0][3] === '20261113', '  정수 초(30)만 올리고 소수는 남긴다');
      m.calls.length = 0; m.clock.t += 30000; m.s.add(20); await tick();
      t(m.calls.length === 0, '  1분이 안 지났으면 더 모으기만 한다');
      m.clock.t += 31000; m.s.add(10); await tick();
      const adds = m.calls.filter((c) => c[0] === 'add');
      t(adds.length === 1 && adds[0][4] === 30 && m.calls.every((c) => c[0] !== 'name'), '  1분이 지나면 모은 몫을 올린다(20.5+10 → 30) · 이름은 안 바뀌었으면 다시 안 쓴다');
      m.calls.length = 0; m.cur.name = '파니니'; m.clock.t += 61000; m.s.add(5); await tick();
      t(m.calls.some((c) => c[0] === 'name' && c[3] === '파니니'), '  이름이 바뀌면 다시 쓴다'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.s.add(40); await tick(); m.calls.length = 0; m.s.add(25);
      m.cur.room = 'SCRT-ZZ99'; m.s.setOn('SCRT-ZZ99', true); m.s.add(7); await tick();
      const a = m.calls.filter((c) => c[0] === 'add');
      t(a.length === 1 && a[0][1] === 'SCRT-AB12' && a[0][4] === 25, '방이 바뀌면 앞 방에서 모으던 몫은 그 방에 마무리하고 새 방은 새로 모은다'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.s.add(40); await tick(); m.calls.length = 0; m.s.add(25);
      m.cur.day = '20261114'; m.s.add(7); await tick();
      const a = m.calls.filter((c) => c[0] === 'add');
      t(a.length === 1 && a[0][3] === '20261113' && a[0][4] === 25, '6시를 넘겨 날이 바뀌면 앞 몫은 그 날 칸에 마무리'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.cur.fail = true; m.s.add(40); await tick(); m.cur.fail = false;
      m.calls.length = 0; m.clock.t += 61000; m.s.add(10); await tick();
      const a = m.calls.filter((c) => c[0] === 'add');
      t(a.length === 1 && a[0][4] === 50, '서버가 못 받으면 그 몫을 쥐고 있다가 다음에 함께(40 + 10)'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.cur.fail = true; m.s.add(700); await tick(); m.cur.fail = false;
      m.calls.length = 0; m.clock.t += 61000; m.s.add(10); await tick();
      const a = m.calls.filter((c) => c[0] === 'add');
      t(a.length === 1 && a[0][4] === 10, '  쥐는 상한(600초)을 넘긴 몫은 버린다'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.s.add(40); await tick(); m.calls.length = 0; m.s.add(25); m.s.setOn('SCRT-AB12', false);
      m.clock.t += 61000; m.s.add(5); await tick();
      t(m.calls.length === 0 && m.s.isOn('SCRT-AB12') === false && Object.keys(m.st).length === 0, '끄면 그 뒤로 안 올린다(저장 표시도 지움)');
      m.s.setOn('SCRT-AB12', true); m.clock.t += 61000; m.s.add(5); await tick();
      const a = m.calls.filter((c) => c[0] === 'add');
      t(a.length === 1 && a[0][4] === 5, '  끄기 전에 모으던 몫은 버렸다 — 다시 켜면 그때부터(5)만 올라간다'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.s.setOn('SCRT-ZZ99', false);
      t(m.st['tw.roomFocus.umu00pdxvk6d9x8mx.SCRT-AB12'] === '1' && m.s.isOn('SCRT-AB12') === true && m.s.isOn('SCRT-ZZ99') === false, '켜는 것은 방마다(저장 키 tw.roomFocus.{내 id}.{방})');
      m.uidNow.v = 'uother00000000001'; t(m.s.isOn('SCRT-AB12') === false, '★ 같은 PC 에서 다른 계정이 들어오면 켜져 있지 않다(그 사람 동의 없이 올라가지 않는다)');
      m.s.add(30); m.clock.t += 61000; m.s.add(30); await tick(); t(m.calls.length === 0, '  다른 계정은 올리지 않는다'); }
    { const m = mk(); m.s.setOn('SCRT-AB12', true); m.s.add(30); await tick(); m.calls.length = 0;
      m.s.forgetName('SCRT-AB12'); m.clock.t += 61000; m.s.add(10); await tick();
      t(m.calls.some((c) => c[0] === 'name' && c[3] === '꿀곰') && m.calls.some((c) => c[0] === 'add'), '내 기록을 지운 뒤(forgetName) 다음 올리기에 이름을 다시 쓴다 — 안 그러면 방 사람들 화면에 «이름 없음»'); }

    /* ── 3절 규칙 ── */
    const R = JSON.parse(S.rules).rules.rooms.$room._focus;
    const U = (R && R.$uid) || {};
    const VU = U['.validate'] || '', VN = (U.n || {})['.validate'] || '', VO = (U.o || {})['.validate'] || '', VD = ((U.d || {}).$day || {})['.validate'] || '';
    const room = 'SCRT-AB12', uid = 'umu00pdxvk6d9x8mx';
    t(!!R && R['.write'] === undefined && R['.validate'] === undefined && U['.write'] === true, '규칙 — rooms/$room/_focus 는 내 칸($uid)에만 쓰기가 열려 있다(방 전체를 한 번에 지울 수 없다)');
    t(Object.keys(U).filter((x) => x[0] !== '.').sort().join() === '$other,d,n,o' && U.$other['.validate'] === false, '  칸은 n · o · d 뿐 · 모르는 칸 거절');
    t(ruleRun(VU, { room, uid }, { n: '꿀곰', d: { '20261113': 60 } }) && ruleRun(VU, { room, uid: 'U0ABCDEFGH' }, { o: 5 }), '통과: 시크릿룸 · 내 id 모양 · 칸이 있다');
    t(!ruleRun(VU, { room: 'WORK-AB12', uid }, { n: 'a' }) && !ruleRun(VU, { room, uid: 'a' }, { n: 'a' }) && !ruleRun(VU, { room, uid: 'undefined' }, { n: 'a' }) && !ruleRun(VU, { room, uid: 'null' }, { n: 'a' }) && !ruleRun(VU, { room, uid: 'MATE-1234' }, { n: 'a' }) && !ruleRun(VU, { room, uid }, {}), '거절: 시크릿룸이 아닌 방 · undefined · null · 짧거나 이상한 id · 빈 칸');
    t(ruleRun(VN, {}, '가'.repeat(20)) && !ruleRun(VN, {}, '가'.repeat(21)) && !ruleRun(VN, {}, 5), '이름: 20자까지 · 문자열만');
    t(ruleRun(VO, {}, 9000, 5000) && ruleRun(VO, {}, 360000000) && !ruleRun(VO, {}, 360000001) && !ruleRun(VO, {}, -1) && !ruleRun(VO, {}, 4000, 5000) && !ruleRun(VO, {}, '5'), '합친 초(o): 0~360000000 · 줄어들지 않는다 · 숫자만');
    t(ruleRun(VD, { day: '20261113' }, 120) && ruleRun(VD, { day: '20261113' }, 86400) && ruleRun(VD, { day: '20261113' }, 200, 120) && !ruleRun(VD, { day: '20261113' }, 86401) && !ruleRun(VD, { day: '20261113' }, 100, 120) && !ruleRun(VD, { day: '20261113' }, -1) && !ruleRun(VD, { day: '20261113' }, '5'), '하루 합: 0~86400 · 줄어들지 않는다(옛 값 이상) · 숫자만');
    t(!ruleRun(VD, { day: '2026-11-13' }, 5) && !ruleRun(VD, { day: '19990101' }, 5) && !ruleRun(VD, { day: '202611130' }, 5), '  날 칸 이름은 YYYYMMDD(20xx)만');
    t(((U.d || {})['.validate'] || '').indexOf('hasChildren') > 0, '  d 자체는 칸을 가진 객체(숫자 하나를 넣는 길을 닫는다)');

    /* ── 4절 연결 ── */
    t(!/import[^\n]*room-focus-net/.test(S.fi) && /roomFocus: window\.TwRoomFocusNet\.createRoomFocusNet\(\{ db, ref, update, remove, set, onValue, off, runTransaction \}\)/.test(S.fi), 'firebase-init.js — 연결 한 줄만(전역 TwRoomFocusNet)');
    const H = S.html;
    const iDays = H.indexOf('<script src="parts/shared/room-focus-days.js"'), iNet = H.indexOf('<script src="parts/focus/room-focus-net.js"'), iSync = H.indexOf('<script src="parts/focus/room-focus-sync.js"'), iFocus = H.indexOf('<script src="parts/chat/chat-focus.js"'), iUi = H.indexOf('<script src="parts/chat/chat-ui.js"'), iApp = H.indexOf('<script src="parts/app.js"');
    t(iDays > 0 && iDays < iSync && iDays < iFocus && iNet > 0 && iSync > 0 && iFocus > 0 && iSync < iApp && iFocus < iUi && iUi < iApp, 'html — 날 키 규칙이 올리기 · 집중 탭보다 먼저, 둘 다 chat-ui · app.js 보다 먼저 실린다');
    const A = S.app;
    t(/const roomFocusSync = TwRoomFocusSync\.createRoomFocusSync\(\{[\s\S]*?firebaseAPI\.roomFocus\.add\(\.\.\.a\)[\s\S]*?storage: localStorage,\n\}\);\nconst chatFocusMod = TwChatFocus\.createChatFocus\(\{[\s\S]*?sync: roomFocusSync[\s\S]*?firebaseAPI\.roomFocus\.removeMine\(\.\.\.a\)[\s\S]*?\n\}\);\nconst chatUiMod/.test(A), 'app.js — 올리기와 집중 탭을 채팅 모듈보다 먼저 만든다(서버는 firebaseAPI.roomFocus 한 곳)');
    t(/dayKey: \(\)=>TwRoomFocusDays\.dayKeyOf\(focusTotalMod\._focusDayStr\(\)\)/.test(A) && /todayKey: \(\)=>TwRoomFocusDays\.dayKeyOf\(focusTotalMod\._focusDayStr\(\)\)/.test(A) && !/dayKeyOf|function keyOfDate|dateOfKey/.test(S.sync.replace(/\/\*[\s\S]*?\*\//g, '')), '날 키는 한 곳(TwRoomFocusDays) — 올리기 · 집중 탭이 같은 함수를 쓰고 올리기 모듈에 따로 없다');
    t(/const focusLevelMod = TwFocusLevel\.createFocusLevel\(\{\n  onFocusAdded: \(sec\)=>roomFocusSync\.add\(sec\),/.test(A) && /\}catch\(e\)\{\}\n  onFocusAdded\(sec\);   \/\/ 저장이 끝난 뒤에 알린다/.test(S.level), '포커스 누적이 쌓일 때마다 올리기에 알린다(addFocusSeconds → onFocusAdded → roomFocusSync.add)');
    t(!/firebaseAPI|window\.firebase/.test(S.sync.replace(/\/\*[\s\S]*?\*\//g, '')) && !/chat-focus|chat-ui|Presence/.test(S.sync.replace(/\/\*[\s\S]*?\*\//g, '')), '올리기 모듈은 firebaseAPI · 채팅 모듈을 직접 부르지 않는다(provider · deps 로만)');
  } catch (err) {
    t(false, '돌리다 오류 — ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
  }
  return out;
}

(async () => {
  say('── 1 ~ 4. 서버 연결 · 올리기 · 규칙 · 연결 (진짜 모듈을 돌린다)');
  const base = await judge(SRC);
  base.forEach(([ok, msg]) => chk(ok, msg));
  say('── 5. 일부러 깨 보기 — 빨강이 나야 한다');
  const BREAKS = [
    ['net', 'return Math.min(MAX_DAY_SEC, base + Math.floor(sec));', 'return base + Math.floor(sec);', '하루 상한 86400 이 없어짐'],
    ['net', 'return Math.min(MAX_DAY_SEC, base + Math.floor(sec));', 'return Math.min(MAX_DAY_SEC, Math.floor(sec));', '더하지 않고 덮어씀'],
    ['net', "plan.keys.forEach(k => { w[path(room, uid, 'd/' + k)] = null; });", '', '합친 뒤 옛 날을 안 지움'],
    ['net', "await remove(ref(db, path(room, uid)));", "await remove(ref(db, path(room)));", '내 기록 지우기가 방 전체를 지움'],
    ['net', 'onValue(r, snap => cb(snap.val() || {}), () => cb(null));', 'onValue(r, snap => cb(snap.val() || {}));', '읽기 거절을 알리지 않음'],
    ['sync', 'if(!room || !isSecretRoom() || !isOn(room) || !getMyUserId()) return;', 'if(!room || !isOn(room) || !getMyUserId()) return;', '시크릿룸이 아닌 방에서도 올림'],
    ['sync', 'if(!room || !isSecretRoom() || !isOn(room) || !getMyUserId()) return;', 'if(!room || !isSecretRoom() || !getMyUserId()) return;', '켜지 않아도 올림'],
    ['sync', "if(!on) pending = null;", "", '끌 때 모으던 몫을 안 버림'],
    ['sync', 'if(now() - lastFlush >= FLUSH_MS){', 'if(true){', '1분 간격 없이 매번 올림'],
    ['sync', 'const old = pending; pending = null; send(old);', 'pending = null;', '방 · 날이 바뀔 때 앞 몫을 버림'],
    ['sync', 'pending.sec += whole;', '', '실패한 몫을 되돌리지 않음'],
    ['sync', 'if(nameSent[p.room] !== name){', 'if(true){', '이름을 매번 다시 씀'],
    ['sync', "const keyOf = (room) => KEY_PREFIX + getMyUserId() + '.' + room;", "const keyOf = (room) => KEY_PREFIX + room;", '켜짐 표시가 계정과 상관없이 기기에 남음'],
    ['sync', 'function forgetName(room){ delete nameSent[room]; }', 'function forgetName(room){}', '지운 뒤에 이름을 다시 안 씀'],
    ['days', "return addDays(todayKey, -((d.getDay() + 6) % 7));", "return addDays(todayKey, -d.getDay());", '날 키 — 주 시작이 일요일이 됨'],
    ['days', "return m[1] + m[2].padStart(2, '0') + m[3].padStart(2, '0');", "return m[1] + m[2] + m[3];", '날 키 — 월 · 일 두 자리 맞춤이 빠짐'],
    ['days', "const isDayKey = (k) => /^20\\d{6}$/.test(String(k));", "const isDayKey = (k) => /^\\d{8}$/.test(String(k));", '날 키 모양이 규칙($day)과 어긋남'],
    ['rules', " && $uid.matches(/^[uU][0-9a-zA-Z]{8,40}$/) && $uid !== 'undefined'", '', '내 id 모양을 안 봄'],
    ['rules', " && $uid !== 'undefined'", '', "id 'undefined' 를 막지 않음"],
    ['rules', '$room.matches(/^SCRT-/) && $uid', '$uid', '시크릿룸이 아닌 방에도 열림'],
    ['rules', 'newData.val() <= 86400 && (!data.exists() || newData.val() >= data.val())', 'newData.val() <= 864000', '하루 합 상한 · 줄어듦 막기가 풀림'],
    ['rules', '"$uid": {\n            ".write": true,', '".write": true,\n          "$uid": {\n            ".write": true,', '_focus 통째 쓰기(방 전체 지우기)가 열림'],
    ['fi', 'roomFocus: window.TwRoomFocusNet.createRoomFocusNet({ db, ref, update, remove, set, onValue, off, runTransaction }),', '', '서버 연결 줄이 없음'],
    ['level', '  onFocusAdded(sec);   // 저장이 끝난 뒤에 알린다(알림이 던져도 누적 저장은 이미 끝났다)\n', '', '포커스 누적이 올리기에 알리지 않음'],
    ['level', '  }catch(e){}\n  onFocusAdded(sec);', '  onFocusAdded(sec);\n  }catch(e){}\n', '알림이 저장보다 먼저 가서 던지면 저장이 건너뛰어짐'],
    ['app', '  onFocusAdded: (sec)=>roomFocusSync.add(sec),\n', '', 'app.js 가 알림을 걸지 않음'],
    ['html', '<script src="parts/focus/room-focus-sync.js"></script>', '', '올리기 모듈을 html 이 안 실음'],
  ];
  for (const [k, from, to, why] of BREAKS) {
    if (SRC[k].indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
    const s2 = Object.assign({}, SRC, { [k]: SRC[k].replace(from, to) });
    let rows;
    try { rows = await judge(s2); } catch (e) { rows = [[false, String(e)]]; }
    chk(rows.some(([ok]) => !ok), why + ' → 빨강');
  }
  say('');
  say(fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ — 켠 사람만 · 시크릿룸 방 안에서만 · 1분 모아 정수 초로 올라가고, 규칙이 모양 · 범위 · 줄어듦을 막는다');
  process.exit(fail ? 1 : 0);
})();
