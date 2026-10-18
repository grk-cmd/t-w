/* ═══ 👥 sim-friends-port.js — 친구 데이터 포트 · provider (2026-10-17 신설) ═══
   [왜] 친구 정보를 Firebase 구독에서 서버(API)로 옮긴다. 도메인(friends-sub.js) · 화면은 포트 하나만 부르고,
     어디서 받을지는 provider(firebase = 옛 길 · api · ws 자리)가 맡는다.
   ・1절: 포트 — 세 함수가 provider 로 · 목록 받기는 api 먼저 → 못 받으면 옛 길 · 끄는 스위치(flags.friendsApi) 끄면 옛 길만
   ・2절: firebase provider(옛 길) — 목록 한 번 읽기 · 목록 구독 · 접속 상태
   ・2-2절: api provider — 응답 모양 · 요청 규칙(5초 · 서버 문제면 1초 · 3초 뒤 두 번 더 · 401 · 400 은 바로) · 가짜 fetch 로 토큰 · X-User-Code 헤더
   ・2-3절: 끄는 스위치 — 원격 설정 flags.friendsApi(기본 켜짐) · 규칙(누구나 읽기 · 불리언)
   ・3절: 배선 — app.js 가 포트 → provider 를 잇는다 · html 순서 · friends/ 파일은 firebaseAPI 를 모른다 ·
         화면 파일이 친구 데이터 firebaseAPI 함수를 직접 안 부른다
   ・4절: 일부러 깨 보기 — 하나라도 못 잡으면 빨강
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  PORT: pick(at('friends-port.js', 'friends')),
  FBP: pick(at('friends-firebase.js', 'friends')),
  FAPI: pick(at('friends-api.js', 'friends')),
  AC: pick(at('api-client.js', 'shared')),
  RC: pick(at('remote-config.js', 'shared')),
  SS: pick(at('source-switch.js', 'shared')),
  RULES: stripReadGate(pick(['firebase-database-rules.json'])),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  FS: pick(at('friends-sub.js', 'myhome')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
/* 화면 · 도메인 파일(스테이징 평면의 .js) — firebase-init.js · app.js(연결) 밖에서는 친구 데이터 firebaseAPI 함수를 안 부른다 */
const FRIEND_FB_FNS = ['subscribeMyFriends', 'getMyFriendList', 'watchMyFriendList', 'getFriendCard', 'watchFriendPresence', 'getFriendPresence', 'apiGetAuthed'];
const ALL_JS = fs.readdirSync('.').filter(f => f.endsWith('.js') && !/^sim-|^smoke\.js$|^run\.js$/.test(f)).map(f => [f, read(f) || '']);

const load = (src, name) => { const win = {}; new Function('window', 'module', 'console', src)(win, undefined, { warn(){}, log(){} }); return win[name]; };
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); };

async function judge(S){
  say('── 1. 포트 — provider 로 그대로');
  let P = null, F = null, SW = null;
  try{ P = load(S.PORT, 'TwFriendsPort'); F = load(S.FBP, 'TwFriendsFirebase'); SW = load(S.SS, 'TwSourceSwitch'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(P && typeof P.createFriendsPort === 'function' && F && typeof F.createFriendsFirebase === 'function', '전역 이름 TwFriendsPort · TwFriendsFirebase');
  {
    const log = [];
    const un = () => log.push('un');
    const fake = {
      listFriends: async (id, o) => { log.push(['list', id, o]); return { f1: { addedAt: 1 } }; },
      watchList: (id, ok, err) => { log.push(['watch', id, typeof ok, typeof err]); return un; },
      watchPresence: (id, ids, ok) => { log.push(['pres', id, ids.join(), typeof ok]); return un; },
    };
    const port = P.createFriendsPort({ firebase: fake, api: null, source: () => 'server', serverFirst: SW.serverFirst, warn(){} });
    const r = await port.listFriends('ME', { idsOnly: true });
    chk(r && r.f1 && JSON.stringify(log[0]) === JSON.stringify(['list', 'ME', { idsOnly: true }]), 'listFriends(myId, opts) — provider 로 · 값 그대로');
    await port.listFriends('ME');
    chk(log[1][2] && typeof log[1][2] === 'object', '  ↳ opts 를 안 주면 빈 객체');
    const u1 = port.watchList('ME', () => {}, () => {});
    chk(u1 === un && log[2].join() === 'watch,ME,function,function', 'watchList(myId, onChange, onError) — provider 로 · 해제 함수 그대로');
    const u2 = port.watchPresence('ME', ['a', 'b'], () => {});
    chk(u2 === un && log[3].join() === 'pres,ME,a,b,function', 'watchPresence(myId, ids, onChange) — provider 로 · 해제 함수 그대로');
  }

  {
    chk(SW.pickSource('friends', null, true) === 'server' && SW.pickSource('friends', null, undefined) === 'server' && SW.pickSource('friends', null, null) === 'server',
      '받는 곳(source-switch pickSource) — 옛 스위치가 켜졌거나 값이 없으면 서버');
    chk(SW.pickSource('friends', null, false) === 'firebase', '  ↳ 옛 스위치(flags.friendsApi)를 끄면 옛 길');
    chk(SW.pickSource('friends', 'firebase', true) === 'firebase' && SW.pickSource('friends', 'server', false) === 'server', '  ↳ 새 자리(sources.friends)가 있으면 그쪽이 이긴다');
    const mkPort = (o) => {
      const L = { api: 0, fb: [], warn: 0 };
      const port = P.createFriendsPort({
        firebase: { listFriends: async (id, op) => { L.fb.push(op); return { f: { from: 'fb' } }; }, watchList(){}, watchPresence(){} },
        api: o.noApi ? null : { listFriends: async (id) => { L.api++; if(o.apiFail) throw Object.assign(new Error('x'), { status: 503 }); return { f: { from: 'api', id } }; } },
        source: () => SW.createSourceSwitch({ valueOf: () => o.value, legacyOf: () => o.apiOn() }).pick('friends'), serverFirst: SW.serverFirst, warn: () => { L.warn++; },
      });
      return { port, L };
    };
    let k = mkPort({ apiOn: () => true });
    let v = await k.port.listFriends('ME', { idsOnly: true });
    chk(v.f.from === 'api' && v.f.id === 'ME' && k.L.api === 1 && !k.L.fb.length && k.port.lastSource() === 'api', '★ 켜짐 — api 에서 받으면 옛 길(Firebase)은 안 읽는다');
    k = mkPort({ apiOn: () => true, apiFail: true });
    v = await k.port.listFriends('ME', { idsOnly: true });
    chk(v.f.from === 'fb' && k.L.api === 1 && k.L.fb.length === 1 && k.L.fb[0].idsOnly === true && k.L.warn === 1 && k.port.lastSource() === 'firebase', '★ api 가 끝내 못 받으면 — 옛 길로(opts 그대로) · 진단 한 줄');
    v = await k.port.listFriends('ME');
    chk(k.L.api === 2, '  ↳ 다음에 목록을 열면 다시 서버부터(실패를 기억하지 않음)');
    k = mkPort({ apiOn: () => false });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'fb' && k.L.api === 0 && k.L.fb.length === 1, '★ 스위치를 끄면 — api 를 부르지도 않고 옛 길만');
    k = mkPort({ apiOn: () => { throw new Error('설정 아직'); } });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'api', '  ↳ 스위치를 못 읽으면(설정 준비 전) 켜짐으로');
    k = mkPort({ apiOn: () => true, value: 'firebase' });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'fb' && k.L.api === 0, '★ 새 자리를 파이어베이스로 — 옛 스위치가 켜져 있어도 api 를 안 부른다');
    k = mkPort({ apiOn: () => false, value: 'server' });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'api', '  ↳ 새 자리를 서버로 — 옛 스위치가 꺼져 있어도 서버 먼저');
    k = mkPort({ apiOn: () => true, noApi: true });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'fb' && k.L.warn === 0, '  ↳ api provider 가 없으면 옛 길(실패가 아니라 진단 줄 없음)');
    chk(P.LIVE_SOURCE === 'firebase', '듣기(목록 · 접속 상태)는 아직 옛 길 — ws 자리(LIVE_SOURCE)');
  }

  say('── 2. firebase provider(옛 길) — 목록 구독 하나 · 카드는 열 때 한 번 · 접속 상태는 열려 있는 동안만');
  {
    chk(F.PRESENCE_BATCH_MS === 50 && F.CARD_KEEP_MS === 10 * 60 * 1000, '상수(모듈 위) — 접속 상태 묶기 50ms · 카드 다시 안 읽는 시간 10분');
    const c = F.cardOf({ profile: { name: 'A', level: 3, cyc: 1, clv: 2, starC: 'x' }, bio: 'hi', avatar: 'https://a' });
    chk(c.name === 'A' && c.level === 3 && c.cyc === 1 && c.clv === 2 && c.starC === 'x' && c.bio === 'hi' && c.avatar === 'https://a', 'cardOf(순수) — 이름 · 레벨 · 회차(날것) · 소개 · 사진');
    const c0 = F.cardOf({ profile: null, bio: null, avatar: null }), c1 = F.cardOf({ profile: { level: 0 } }), c2 = F.cardOf(null);
    chk(c0.name === '(이름 없음)' && c0.level === null && c0.bio === '' && c0.avatar === null && c1.level === null && c2.name === '(이름 없음)', '  ↳ 빈 값 — «(이름 없음)» · 레벨 null(1 미만 · 없음) · 소개 \'\' · 사진 null');
    const p1 = F.presenceOf({ online: true, lastSeen: 9, room: 'SCRT-1', inRoom: true }), p2 = F.presenceOf({ online: true, room: 'PLAY-1' }), p3 = F.presenceOf(null), p4 = F.presenceOf({ online: true, room: 'SCRT-1', inRoom: false });
    chk(p1.online && p1.lastSeen === 9 && p1.room === 'SCRT-1' && p1.inRoom === true && p2.inRoom === true && p3.online === false && p3.lastSeen === 0 && p3.room === null && p3.inRoom === false && p4.room === 'SCRT-1' && p4.inRoom === false,
      'presenceOf(순수) — 온라인 · 마지막 · 방 코드 · 방에 있음(옛 판은 코드 유무로 · 새 판은 inRoom 이 정한다 — 시크릿룸은 코드가 있어도 false) · 없으면 오프라인');
    const T = { q: [], set: (fn, ms) => { T.q.push({ fn, ms }); return T.q.length; }, clear: (id) => { if(T.q[id - 1]) T.q[id - 1].fn = null; }, run: () => { const q = T.q.splice(0); q.forEach(t => t.fn && t.fn()); } };
    let t = 0;
    const L = { lists: [], cards: [], subs: [], live: 0, gets: [] };
    const fb = F.createFriendsFirebase({
      getList: async (id) => { L.lists.push(id); return id === 'EMPTY' ? null : { f1: { addedAt: 5 }, f2: { addedAt: 6 } }; },
      watchList: (id, ok, err) => { const w = { id, ok, err, on: true }; L.subs.push(w); L.live++; return () => { if(w.on){ w.on = false; L.live--; } }; },
      getCard: async (fid) => { L.cards.push(fid); if(fid === 'f2' && L.failF2) throw new Error('x'); return { profile: { name: 'N-' + fid }, bio: '', avatar: null }; },
      watchPresence: (fid, cb) => { const w = { fid, cb, on: true }; L.subs.push(w); L.live++; return () => { if(w.on){ w.on = false; L.live--; } }; },
      getPresence: async (fid) => { L.gets.push(fid); return { online: true, room: 'R' }; },
      setTimer: T.set, clearTimer: T.clear, now: () => t,
    });
    const ids = await fb.listFriends('ME', { idsOnly: true });
    chk(L.lists.join() === 'ME' && ids.f1.addedAt === 5 && !L.cards.length, 'listFriends(idsOnly) — 목록 한 번 읽기만(카드 0)');
    chk(JSON.stringify(await fb.listFriends('EMPTY', { idsOnly: true })) === '{}', '  ↳ 없으면 빈 목록({})');
    const full = await fb.listFriends('ME');
    chk(full.f1.name === 'N-f1' && full.f1.addedAt === 5 && full.f2.name === 'N-f2' && L.cards.join() === 'f1,f2', 'listFriends — 친구마다 카드 한 번 읽기(이름 · 사진)');
    t += F.CARD_KEEP_MS - 1;
    await fb.listFriends('ME');
    chk(L.cards.length === 2, '  ↳ 10분 안에 다시 열면 카드는 다시 안 읽는다(목록만)');
    t += 2; L.failF2 = true;
    const again = await fb.listFriends('ME');
    chk(L.cards.length === 4 && again.f2.name === 'N-f2', '  ↳ 10분이 지나면 다시 읽는다 · 실패한 친구는 지난 카드 그대로');
    const fresh = F.createFriendsFirebase({ getList: async () => ({ z: { addedAt: 1 } }), getCard: async () => { throw new Error('x'); }, now: () => 0 });
    const fz = await fresh.listFriends('ME');
    chk(fz.z.addedAt === 1 && !('name' in fz.z), '  ↳ 처음부터 실패하면 이름 칸 없이(목록이 자리표시 \'...\' 로 그린다)');
    const got = [], errs = [];
    const off = fb.watchList('ME', (f) => got.push(f), (e) => errs.push(e));
    L.subs[0].ok(null); L.subs[0].err(new Error('x'));
    chk(L.subs.length === 1 && got.length === 1 && JSON.stringify(got[0]) === '{}' && errs.length === 1, 'watchList — 목록 구독 하나에 onChange · onError (null 은 {})');
    off();
    chk(L.live === 0, '  ↳ 해제 함수 그대로');
    const pres = [];
    const offP = fb.watchPresence('ME', ['f1', 'f2', 'f3'], (p) => pres.push(p));
    chk(L.live === 3 && L.subs.slice(1).map(w => w.fid).join() === 'f1,f2,f3', 'watchPresence — 친구마다 presence 구독(n개)');
    L.subs[1].cb({ online: true }); L.subs[2].cb({ online: false, lastSeen: 3 }); L.subs[1].cb({ online: true, room: 'PLAY-9' });
    chk(pres.length === 0 && T.q.length === 1 && T.q[0].ms === 50, '  ↳ 한꺼번에 온 콜백은 50ms 에 한 번(타이머 하나)');
    T.run();
    chk(pres.length === 1 && pres[0].f1.room === 'PLAY-9' && pres[0].f1.inRoom === true && pres[0].f2.lastSeen === 3 && !('f3' in pres[0]), '  ↳ 묶어서 한 번 — 받은 친구만 · 마지막 값');
    L.subs[3].cb({ online: true });
    offP();
    T.run();
    chk(L.live === 0 && pres.length === 1, '  ↳ 풀면 n개 다 풀고 · 기다리던 넘기기도 안 한다');
    L.subs[1].cb({ online: false }); T.run();
    chk(pres.length === 1, '  ↳ 풀린 뒤 늦은 콜백은 버린다');
    const rp = await fb.readPresence('f7');
    chk(L.gets.join() === 'f7' && rp.online === true && rp.room === 'R' && rp.inRoom === true && L.live === 0, 'readPresence — 그 친구 한 번 읽기(구독 안 남김)');
  }

  say('── 2-1. 상시 구독 수 — firebase-init(가짜 onValue) → provider → 포트 → friends-sub 를 이어서');
  {
    const FS = load(S.FS, 'TwFriendsSub');
    const i0 = S.FI.indexOf('    watchMyFriendList(myId, onChange, onError){'), i1 = S.FI.indexOf('    async getFriendPresence(fid){', i0), i2 = i1 < 0 ? -1 : S.FI.indexOf('\n    },\n', i1);
    const g0 = S.FI.indexOf('    async getMyFriendList(myId){'), g1 = g0 < 0 ? -1 : S.FI.indexOf('\n    },\n', g0);
    chk(i0 > 0 && i2 > i1 && g1 > g0, 'firebase-init 친구 함수를 떼어 온다');
    if(i0 > 0 && i2 > i1 && g1 > g0){
      const live = [];
      const ref = (db, p) => ({ p });
      const onValue = (r, cb) => { const l = { p: r.p, cb, on: true }; live.push(l); return () => { l.on = false; }; };
      const N = 30, list = {}; for(let k = 0; k < N; k++) list['f' + k] = { addedAt: k };
      const get = async (r) => ({ val: () => r.p === 'users/ME/friends' ? list : /\/profile$/.test(r.p) ? { name: r.p } : null });
      const api = new Function('ref', 'onValue', 'get', 'db', 'console', 'let _myFriendsOff = null;\nconst api = {\n' + S.FI.slice(g0, g1 + 7) + '\n' + S.FI.slice(i0, i2 + 6) + '\n};\nreturn api;')(ref, onValue, get, {}, { warn(){}, log(){} });
      const timers = [];
      const fbp = F.createFriendsFirebase({ getList: (...a) => api.getMyFriendList(...a), watchList: (...a) => api.watchMyFriendList(...a), getCard: (...a) => api.getFriendCard(...a),
        watchPresence: (...a) => api.watchFriendPresence(...a), getPresence: (...a) => api.getFriendPresence(...a), setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => {}, now: () => 0 });
      const port = P.createFriendsPort({ firebase: fbp, api: null, source: () => 'server', serverFirst: SW.serverFirst, warn(){} });
      let cur = {};
      const sub = FS.createFriendsSub({ subscribe: (...a) => port.watchList(...a), fetchOnce: (id) => port.listFriends(id, { idsOnly: true }), listFriends: (...a) => port.listFriends(...a),
        watchPresence: (...a) => port.watchPresence(...a), readPresence: (...a) => port.readPresence(...a), current: () => cur, setFriends: (v) => { cur = v; }, getMyUserId: () => 'ME',
        toast(){}, setTimer: (fn) => 0, clearTimer(){}, onUnload(){} });
      const on = () => live.filter(l => l.on).length;
      sub.start('ME', (f) => { cur = f; }, () => {});
      live.filter(l => l.on && l.p === 'users/ME/friends').forEach(l => l.cb({ val: () => list }));
      await flush(); await flush();
      chk(on() === 1 && Object.keys(cur).length === N && cur.f3.name === 'users/f3/profile', '★ 친구 ' + N + '명 — 평소 상시 구독 1개(전에는 1 + 4 × ' + N + ' = ' + (1 + 4 * N) + '개) · 이름은 한 번 읽어 얹음 (지금 ' + on() + ')');
      sub.open('myhome', () => {});
      chk(on() === 1 + N, '★ 친구 탭을 열면 1 + ' + N + '개 (지금 ' + on() + ')');
      sub.open('invite', () => {});
      chk(on() === 1 + N, '  초대 목록까지 열어도 1 + ' + N + '개(겹쳐 걸지 않음)');
      sub.close('myhome'); sub.close('invite');
      chk(on() === 1, '★ 닫으면 다시 1개 (지금 ' + on() + ')');
      sub.stop();
      chk(on() === 0, '  멈추면 0개');
    }
  }

  say('── 2-2. api provider — 응답 모양 · 요청 규칙');
  let FA = null, AC = null;
  try{ FA = load(S.FAPI, 'TwFriendsApi'); AC = load(S.AC, 'TwApi'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  {
    chk(FA.FRIENDS_PATH === '/v1/me/friends' && FA.REQUEST_TIMEOUT_MS === 5000 && JSON.stringify(FA.RETRY_DELAYS_MS) === '[1000,3000]' && FA.USER_CODE_HEADER === 'X-User-Code',
      '상수(모듈 위) — GET /v1/me/friends · 한 번 5초 · 다시 묻기 1초 · 3초 뒤(총 3번) · X-User-Code');
    const d = { friends: [
      { id: 'u1', addedAt: 5, name: '가나', level: 4, cyc: 2, clv: 7, starC: '#fff', bio: '안녕', avatarUrl: 'https://x/a.jpg', mutual: true },
      { id: 'u2', name: '', level: 0, avatarInline: 'data:image/jpeg;base64,AA' },
      { id: '', name: 'bad' }, null, { name: 'noid' },
    ], total: 5, truncated: false };
    const m = FA.friendsOf(d);
    chk(Object.keys(m).join() === 'u1,u2', 'friendsOf — id 가 있는 줄만 { 친구id: 친구 } 로');
    chk(m.u1.name === '가나' && m.u1.level === 4 && m.u1.addedAt === 5 && m.u1.cyc === 2 && m.u1.clv === 7 && m.u1.starC === '#fff' && m.u1.bio === '안녕' && m.u1.avatar === 'https://x/a.jpg' && m.u1.mutual === true,
      '  ↳ 이름 · 레벨 · 회차(날것) · 소개 · 사진 주소 · 서로 친구');
    chk(m.u2.name === '(이름 없음)' && m.u2.level === null && m.u2.avatar === 'data:image/jpeg;base64,AA' && m.u2.bio === '' && m.u2.addedAt === undefined && m.u2.mutual === false,
      '  ↳ 이름 없으면 «(이름 없음)» · 레벨 1 미만은 null(배지 숨김 — 옛 길과 같음) · 사진은 그 자리 데이터도 · 없는 addedAt 은 목록 칸 그대로(undefined)');
    chk(FA.friendsOf({ friends: [] }) && !Object.keys(FA.friendsOf({ friends: [] })).length && FA.friendsOf(null) === undefined && FA.friendsOf({ friends: {} }) === undefined && FA.friendsOf([]) === undefined,
      '  ↳ 빈 목록은 {} · 모양이 틀리면 undefined(옛 길로)');
    const R = FA.retryable;
    chk(R({ code: 'NETWORK' }) && R({ code: 'TIMEOUT' }) && R({ status: 500 }) && R({ status: 503, code: 'X_NOT_READY' }) && R({ status: 502 }),
      'retryable — 연결 실패 · 시간 초과 · 5xx 는 다시 묻는다');
    chk(!R({ status: 401 }) && !R({ status: 400 }) && !R({ status: 403 }) && !R({ status: 404 }) && !R({ code: 'SHAPE' }) && !R({ code: 'NO_TOKEN', status: 0 }) && !R(null),
      '  ↳ 401 · 400 · 그 밖의 4xx · 모양 틀림 · 토큰 없음은 다시 안 묻는다');
  }
  {
    const run = async (script) => {
      const L = { calls: [], waits: [], warns: [] };
      let i = 0;
      const get = async (p, o) => { L.calls.push([p, o]); const r = script[Math.min(i++, script.length - 1)]; if(r instanceof Error) throw r; return r; };
      const fa = FA.createFriendsApi({ get, wait: async (ms) => { L.waits.push(ms); }, warn: (...a) => L.warns.push(a.join(' ')) });
      let out, err;
      try{ out = await fa.listFriends('ME'); }catch(e){ err = e; }
      return Object.assign(L, { out, err });
    };
    const E = (status, code) => Object.assign(new Error('e'), { status: status || 0, code: code || '' });
    const OK = { friends: [{ id: 'u1', name: 'A' }] };
    let r = await run([OK]);
    chk(r.out && r.out.u1.name === 'A' && r.calls.length === 1 && !r.waits.length, '서버가 받으면 — 1번 · 쉬지 않음');
    const o = r.calls[0][1];
    chk(r.calls[0][0] === '/v1/me/friends' && o.auth === true && o.headers['X-User-Code'] === 'ME' && o.timeoutMs === 5000, '  ↳ 로그인 요청(토큰) · X-User-Code = 내 코드 · 한 번 5초');
    r = await run([E(0, 'NETWORK'), E(0, 'TIMEOUT'), OK]);
    chk(r.out && r.calls.length === 3 && r.waits.join() === '1000,3000', '★ 연결 실패 · 시간 초과 — 1초 · 3초 뒤 다시(3번째에 받음)');
    r = await run([E(500), E(502), E(503)]);
    chk(r.err && r.err.status === 503 && r.calls.length === 3 && r.waits.join() === '1000,3000', '★ 5xx 가 계속되면 — 총 3번 뒤 던진다(포트가 옛 길로)');
    r = await run([E(0, 'NETWORK'), E(401, 'UNAUTHORIZED')]);
    chk(r.err && r.err.status === 401 && r.calls.length === 2 && r.waits.join() === '1000', '  ↳ 다시 묻던 중 401 이면 그 자리에서 멈춤');
    r = await run([E(401), OK]);
    chk(r.err && r.err.status === 401 && r.calls.length === 1 && !r.waits.length && !r.warns.length, '★ 401(연결 없는 옛 계정) — 다시 안 묻고 바로 던짐(옛 길)');
    r = await run([E(0, 'NO_TOKEN'), OK]);
    chk(r.err && r.calls.length === 1, '  ↳ 토큰 없음도 바로');
    r = await run([E(400, 'BAD_REQUEST'), OK]);
    chk(r.err && r.calls.length === 1 && !r.waits.length && r.warns.length === 1 && /400/.test(r.warns[0]), '★ 400 — 다시 안 묻고 바로 · 진단 로그 한 줄');
    r = await run([E(404), OK]);
    chk(r.err && r.calls.length === 1 && !r.warns.length, '  ↳ 404 등 그 밖의 4xx 도 바로(서버 문제가 아님)');
    r = await run([{ nope: 1 }, OK]);
    chk(r.err && r.err.code === 'SHAPE' && r.calls.length === 1, '  ↳ 모양이 틀린 응답도 바로');
    const fa0 = FA.createFriendsApi({ get: async () => { throw new TypeError('통로 없음'); }, wait: async () => {}, warn(){} });
    let e0 = null; try{ await fa0.listFriends('ME'); }catch(e){ e0 = e; }
    chk(e0 && e0 instanceof TypeError, '  ↳ 통로가 고장이면(코드 오류) 다시 안 묻고 바로 던짐');
    let e5 = null; try{ await fa0.listFriends(''); }catch(e){ e5 = e; }
    chk(e5 && e5.code === 'NO_USER', '  ↳ 내 코드가 없으면 묻지 않음');
  }
  {
    /* 진짜 api-client 위에서 — 가짜 fetch · 토큰 */
    const calls = [];
    const mkFetch = (fn) => async (url, init) => { calls.push({ url, init }); return fn(url, init, calls.length); };
    const res = (status, body) => ({ ok: status < 300, status, json: async () => body });
    let tok = 'TOK';
    const c = AC.createApiClient({ baseUrl: 'https://api.togetherworking.duckdns.org', fetch: mkFetch((u, i, n) => n < 3 ? res(503, { success: false, code: 'X' }) : res(200, { success: true, data: { friends: [{ id: 'u9', name: 'Z' }], total: 1, truncated: false } })),
      getToken: async () => tok, backoffMs: 0 });
    const waits = [];
    const fa = FA.createFriendsApi({ get: (...a) => c.get(...a), wait: async (ms) => { waits.push(ms); }, warn(){} });
    const out = await fa.listFriends('uME');
    const h = calls[0].init.headers;
    chk(out.u9.name === 'Z' && calls.length === 3 && waits.join() === '1000,3000', '가짜 fetch — 503 두 번 뒤 받음(통로 쉬기 없이 3번 다 나감)');
    chk(calls[0].url === 'https://api.togetherworking.duckdns.org/v1/me/friends' && h.Authorization === 'Bearer TOK' && h['X-User-Code'] === 'uME' && calls[0].init.credentials === 'omit',
      '  ↳ 헤더 — Authorization: Bearer <Firebase ID 토큰> · X-User-Code · 쿠키 없음');
    calls.length = 0; tok = null;
    let e1 = null; try{ await fa.listFriends('uME'); }catch(e){ e1 = e; }
    chk(e1 && e1.kind === 'auth' && e1.code === 'NO_TOKEN' && calls.length === 0, '  ↳ 토큰이 없으면 보내지 않고 바로 auth(NO_TOKEN) — 옛 길');
    const pub = AC.createApiClient({ baseUrl: 'https://api.togetherworking.duckdns.org', fetch: mkFetch(() => res(200, { success: true, data: 1 })), getToken: async () => 'TOK' });
    calls.length = 0; await pub.get('/v1/config');
    chk(calls.length === 1 && !('Authorization' in calls[0].init.headers), '  ↳ 공개 GET 은 getToken 이 있어도 토큰을 안 붙인다');
    const slow = AC.createApiClient({ baseUrl: 'https://api.togetherworking.duckdns.org', fetch: () => new Promise(() => {}), backoffMs: 0 });
    let e2 = null; const t0 = Date.now(); try{ await slow.get('/v1/me/friends', { auth: true, timeoutMs: 30 }); }catch(e){ e2 = e; }
    chk(e2 && e2.code === 'NO_TOKEN', '  ↳ getToken 이 없는 통로의 로그인 요청은 NO_TOKEN');
    const slow2 = AC.createApiClient({ baseUrl: 'https://api.togetherworking.duckdns.org', fetch: () => new Promise(() => {}), getToken: async () => 'T', backoffMs: 0 });
    let e3 = null; try{ await slow2.get('/v1/me/friends', { auth: true, timeoutMs: 30 }); }catch(e){ e3 = e; }
    chk(e3 && e3.code === 'TIMEOUT' && Date.now() - t0 < 1000, '  ↳ 요청마다 시간 제한(timeoutMs) — 넘으면 TIMEOUT(다시 묻는 실패)');
    const hang = AC.createApiClient({ baseUrl: 'https://api.togetherworking.duckdns.org', fetch: mkFetch(() => res(200, { success: true, data: 1 })), getToken: () => new Promise(() => {}), backoffMs: 0 });
    let e4 = null; try{ await hang.get('/v1/me/friends', { auth: true, timeoutMs: 30 }); }catch(e){ e4 = e; }
    chk(e4 && e4.code === 'TIMEOUT', '  ↳ 토큰 받기가 멈춰도 시간 제한 안에서 끝난다');
  }

  say('── 2-3. 끄는 스위치 — 원격 설정 flags.friendsApi');
  {
    let RCM = null;
    try{ const m = { exports: {} }; new Function('window', 'module', 'console', S.RC)(undefined, m, { warn(){} }); RCM = m.exports; }catch(e){ chk(false, 'remote-config 싣다 던짐 — ' + e.message); }
    if(RCM){
      const st = RCM.createRemoteConfig();
      chk(RCM.DEFAULTS.friendsApi === true && st.friendsApi() === true, '기본 켜짐(값이 없으면 서버 먼저)');
      st.apply({ flags: { friendsApi: false } }, false);
      chk(st.friendsApi() === false, '  ↳ API 사본 flags.friendsApi = false 면 꺼짐');
      st.apply({ flags: { friendsApi: 'no' } }, false);
      chk(st.friendsApi() === true, '  ↳ 불리언이 아니면 기본값(켜짐)');
      chk(RCM.FALLBACK_PATHS.friendsApi === 'config/flags/friendsApi', '  ↳ API 를 못 받으면 Firebase config/flags/friendsApi 한 칸');
    }
    let R = null; try{ R = JSON.parse(S.RULES).rules.config.flags.friendsApi; }catch(_){}
    chk(R && R['.read'] === true && R['.validate'] === 'newData.isBoolean()', '규칙 config/flags/friendsApi — 누구나 읽기 · 불리언만(쓰기는 flags 의 관리자)');
  }

  say('── 3. 배선');
  {
    const a = strip(S.APP);
    chk(/const friendsFirebaseMod = TwFriendsFirebase\.createFriendsFirebase\(\{\n  getList: \(\.\.\.a\)=>firebaseAPI\.getMyFriendList\(\.\.\.a\),\n  watchList: \(\.\.\.a\)=>firebaseAPI\.watchMyFriendList\(\.\.\.a\),\n  getCard: \(\.\.\.a\)=>firebaseAPI\.getFriendCard\(\.\.\.a\),\n  watchPresence: \(\.\.\.a\)=>firebaseAPI\.watchFriendPresence\(\.\.\.a\),\n  getPresence: \(\.\.\.a\)=>firebaseAPI\.getFriendPresence\(\.\.\.a\),\n/.test(a),
      'app.js — firebase provider 가 firebaseAPI 친구 함수 다섯을 deps 로 받는다(목록 한 번 · 목록 구독 · 카드 · 접속 상태 구독 · 한 번)');
    chk(/  watchPresence: \(\.\.\.a\)=>friendsPortMod\.watchPresence\(\.\.\.a\),\n  readPresence: \(\.\.\.a\)=>friendsPortMod\.readPresence\(\.\.\.a\),/.test(a), '  ↳ friends-sub 의 접속 상태 듣기 · 한 번 읽기도 포트로');
    chk(/const friendsPortMod = TwFriendsPort\.createFriendsPort\(\{\n  firebase: friendsFirebaseMod,\n  api: friendsApiMod,\n  source: \(\)=>TwSourceSwitch\.store\.pick\('friends'\),[^\n]*\n  serverFirst: TwSourceSwitch\.serverFirst,/.test(a), '  ↳ 포트가 provider 둘 · 스위치(원격 설정 friendsApi — 설정이 없으면 켜짐)를 받는다');
    chk(/const friendsApiMod = TwFriendsApi\.createFriendsApi\(\{\n  get: \(\.\.\.a\)=>firebaseAPI\.apiGetAuthed\(\.\.\.a\),[^\n]*\n  wait: \(ms\)=>new Promise\(r=>setTimeout\(r, ms\)\),/.test(a), '  ↳ api provider 가 로그인 API 통로(firebase-init apiGetAuthed) · 쉬기를 받는다');
    const fi = strip(S.FI);
    chk(/const _authApi = \(window\.TwApi && window\.TwApi\.client\) \? window\.TwApi\.createApiClient\(\{\n    baseUrl: window\.TwApi\.client\.baseUrl\(\), fetch: \(\.\.\.a\) => window\.fetch\(\.\.\.a\), getToken: \(\) => _getIdToken\(false\), backoffMs: 0,\n  \}\) : null;/.test(fi)
      && /apiGetAuthed\(path, opts\)\{ return _authApi \? _authApi\.get\(path, opts\) : Promise\.reject\(/.test(fi),
      '  ↳ firebase-init — 로그인 API 통로: 공용 주소 · Firebase ID 토큰 · 쉬기 끔(공용 통로를 쉬게 하지 않게) · 없으면 거절(옛 길)');
    chk(/  listFriends: \(\.\.\.a\)=>friendsPortMod\.listFriends\(\.\.\.a\),/.test(a), '  ↳ friends-sub 의 이름 받기(listFriends)도 포트로');
    chk(/  subscribe: \(\.\.\.a\)=>friendsPortMod\.watchList\(\.\.\.a\),\n  fetchOnce: \(id\)=>friendsPortMod\.listFriends\(id, \{ idsOnly:true \}\),/.test(a), '  ↳ friends-sub 의 subscribe · fetchOnce 는 포트로');
    const iF = a.indexOf('const friendsFirebaseMod'), iA = a.indexOf('const friendsApiMod'), iP = a.indexOf('const friendsPortMod'), iS = a.indexOf('const friendsSubMod');
    chk(iF > 0 && iA > iF && iP > iA && iS > iP, '  ↳ 만드는 순서 provider(옛 길 · api) → 포트 → friends-sub');
    const h = S.HTML;
    const hF = h.indexOf('<script src="parts/friends/friends-firebase.js">'), hP = h.indexOf('<script src="parts/friends/friends-port.js">'), hA = h.indexOf('<script src="parts/app.js">'),
      hI = h.indexOf('<script src="parts/friends/friends-api.js">'), hC = h.indexOf('<script src="parts/shared/api-client.js">');
    chk(hF > 0 && hP > 0 && hI > 0 && hF < hA && hP < hA && hI < hA && hC > 0 && hC < hA, 'html — friends-firebase.js · friends-api.js · friends-port.js(· api-client.js)를 app.js 보다 먼저 싣는다');
    chk(!/firebaseAPI|firebase-init|\bref\(db|onValue\(/.test(strip(S.PORT)) && !/firebaseAPI|\bref\(db|onValue\(/.test(strip(S.FBP)) && !/firebaseAPI|\bref\(db|onValue\(|\bfetch\(/.test(strip(S.FAPI)),
      'friends/ 파일은 firebaseAPI · SDK 를 직접 안 부른다(deps 로만)');
    chk(!/firebaseAPI|firebase-init|getIdToken|currentUser/.test(strip(S.AC)), 'shared/api-client.js 는 Firebase 를 모른다(토큰은 getToken deps 로만)');
    const bad = ALL_JS.filter(([f, src]) => f !== 'firebase-init.js' && f !== 'app.js'
      && FRIEND_FB_FNS.some(n => new RegExp('firebaseAPI\\s*\\.\\s*' + n + '\\b').test(strip(src))));
    chk(!bad.length, '화면 · 도메인 파일이 친구 데이터 firebaseAPI 함수(' + FRIEND_FB_FNS.join(' · ') + ')를 직접 안 부른다' + (bad.length ? ' — ' + bad.map(b => b[0]).join(' · ') : ''));
    const appCalls = (a.match(/firebaseAPI\.(subscribeMyFriends|getMyFriendList|watchMyFriendList|getFriendCard|watchFriendPresence|getFriendPresence|apiGetAuthed)\(/g) || []).length;
    chk(appCalls === 6, '  ↳ app.js 도 provider deps 여섯 줄에서만 (' + appCalls + ')');
    chk(!/subscribeMyFriends/.test(strip(S.FI)) && !/subscribeMyFriends/.test(a), '  ↳ 친구별 4개 구독(subscribeMyFriends)은 어디에도 없다');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PORT', 'firebase.listFriends(myId, opts || {})', 'firebase.listFriends(myId, {})', 'opts 를 버림'],
  ['PORT', 'return firebase.watchList(myId, onChange, onError);', 'return firebase.watchList(myId, onChange);', '에러 콜백을 안 넘김'],
  ['PORT', 'return firebase.watchPresence(myId, ids, onChange);', 'firebase.watchPresence(myId, ids, onChange);', '해제 함수를 안 돌려줌'],
  ['FS', "  const want = (Object.keys(_open).length && _status", "  const want = (_status", '목록이 닫혀 있어도 접속 상태를 들음'],
  ['FBP', 'const ids = (await getList(myId)) || {};', 'const ids = await getList(myId);', '없을 때 null'],
  ['FBP', '    if(opts && opts.idsOnly) return ids;\n', '', '판정용인데 카드까지 읽음'],
  ['FBP', '    if(c && t - c.at < CARD_KEEP_MS) return c.card;\n', '', '열 때마다 카드를 다시 읽음'],
  ['FBP', 'const notify = ()=>{ if(timer == null) timer = setTimer(flush, PRESENCE_BATCH_MS); };', 'const notify = ()=>{ onChange(Object.assign({}, combined)); };', '접속 상태를 콜백마다 넘김(그리기 폭주)'],
  ['FBP', '      for(const off of offs){ try{ off(); }catch(_){} }', '', '풀어도 친구별 구독이 남음'],
  ['FBP', "  return { online: !!p.online, lastSeen: p.lastSeen || 0, room: p.room || null, inRoom: (p.inRoom !== undefined) ? !!p.inRoom : !!p.room };", "  return { online: !!p.online, lastSeen: p.lastSeen || 0, room: p.room || null, inRoom: !!p.room };", '시크릿룸 «방에 있음» 을 코드로 판정'],
  ['FI', "      _listOff = onValue(ref(db, `users/${myId}/friends`), snap=>{\n        if(_dead) return;\n        onChange(snap.val() || {});", "      _listOff = onValue(ref(db, `users/${myId}/friends`), snap=>{\n        if(_dead) return;\n        Object.keys(snap.val() || {}).forEach(fid=>onValue(ref(db, `users/${fid}/profile`), ()=>{}));\n        onChange(snap.val() || {});", '친구별 구독을 되살림'],
  ['APP', '  subscribe: (...a)=>friendsPortMod.watchList(...a),', '  subscribe: (...a)=>firebaseAPI.subscribeMyFriends(...a),', 'friends-sub 가 포트를 건너뜀'],
  ['SS', "  friends: Object.freeze({ legacy: (v) => (v === false ? SOURCE.FIREBASE : SOURCE.SERVER),", "  friends: Object.freeze({ legacy: (v) => SOURCE.SERVER,", '옛 스위치를 안 봄'],
  ['SS', "  friends: Object.freeze({ legacy: (v) => (v === false ? SOURCE.FIREBASE : SOURCE.SERVER),", "  friends: Object.freeze({ legacy: (v) => (v === true ? SOURCE.SERVER : SOURCE.FIREBASE),", '값이 없으면 꺼짐으로'],
  ['SS', "  return cleanSource(value) || f.legacy(legacy);", "  return f.legacy(legacy);", '새 자리(sources.friends)를 안 봄'],
  ['SS', "      if(onFail) onFail(e);", "      throw e;", 'api 실패를 옛 길로 안 넘김'],
  ['PORT', "      apiProvider ? () => apiProvider.listFriends(myId) : null,", "      () => apiProvider.listFriends(myId),", 'api provider 가 없어도 서버 길'],
  ['FAPI', "const RETRY_DELAYS_MS = [1000, 3000];", "const RETRY_DELAYS_MS = [1000, 3000, 9000];", '다시 묻기 횟수가 늘어남'],
  ['FAPI', "const REQUEST_TIMEOUT_MS = 5000;", "const REQUEST_TIMEOUT_MS = 2500;", '시간 제한이 달라짐'],
  ['FAPI', "  if(e.code === 'NETWORK' || e.code === 'TIMEOUT') return true;", "  if(e.code === 'NETWORK') return true;", '시간 초과를 다시 안 물음'],
  ['FAPI', "  return typeof e.status === 'number' && e.status >= 500;", "  return typeof e.status === 'number' && e.status >= 400;", '4xx 도 다시 물음'],
  ['FAPI', "      if(i) await wait(RETRY_DELAYS_MS[i - 1]);", "      ", '쉬지 않고 바로 다시 물음'],
  ['FAPI', "    if(last && last.status === 400) warn(", "    if(false) warn(", '400 진단 로그 없음'],
  ['FI', "getToken: () => _getIdToken(false), backoffMs: 0,", "getToken: () => _getIdToken(false),", '로그인 통로가 쉬기를 씀'],
  ['FAPI', "{ auth: true, headers: { [USER_CODE_HEADER]: myId }, timeoutMs: REQUEST_TIMEOUT_MS }", "{ auth: true, timeoutMs: REQUEST_TIMEOUT_MS }", 'X-User-Code 를 안 보냄'],
  ['FAPI', "      level: (typeof f.level === 'number' && f.level >= 1) ? f.level : null,", "      level: f.level,", '레벨 거르기 없음'],
  ['AC', "    h.Authorization = 'Bearer ' + tok;", "    h.Authorization = tok;", '토큰 형식이 틀림'],
  ['AC', "    if(!tok) throw new ApiError('auth', 0, 'NO_TOKEN', '로그인 토큰이 없어요');", "", '토큰 없이도 보냄'],
  ['AC', "      const headers = await Promise.race([authHeaders(o), timeout]);", "      const headers = await authHeaders(o);", '토큰 받기가 멈추면 영영 기다림'],
  ['RC', "  friendsApi: true,", "  friendsApi: false,", '스위치 기본값이 꺼짐'],
  ['RULES', '"friendsApi": {\n          ".read": true,', '"friendsApi": {\n          ".read": false,', '규칙이 읽기를 막음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  /* 깨 본 글이 판정을 영영 기다리게 만들 수 있다(예: 토큰 받기가 멈춤) — 끝나지 않은 약속만 남으면 node 가 0 으로 조용히 끝나
     초록처럼 보인다. 3초 안에 안 끝나면 «멈춤» 으로 잡은 것으로 센다. */
  let _hung = false;
  try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { _hung = true; r(); }, 3000))]); }catch(_){ qfail++; }
  if(_hung) qfail++;
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
