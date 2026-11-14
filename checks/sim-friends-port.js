/* ═══ 👥 sim-friends-port.js — 친구 데이터 포트 · provider (2026-10-17 신설) ═══
   [왜] 친구 정보를 Firebase 구독에서 서버(API)로 옮긴다. 도메인(friends-sub.js) · 화면은 포트 하나만 부르고,
     어디서 받을지는 provider(firebase = 옛 길 · api · ws 자리)가 맡는다.
   ・1절: 포트 — 세 함수가 provider 로 · 목록 받기 · 친구 한 명 받기(readFriend)는 api 먼저 → 못 받으면 옛 길 · 받는 곳이 파이어베이스면 옛 길만
   ・2절: firebase provider(옛 길) — 목록 한 번 읽기 · 목록 구독 · 접속 상태(2-1절: 목록을 열면 1 + n — 프로필 · 접속 상태는 realtime 하나)
   ・2-2절: 서버 provider(friends-api.js — social-api.js 위) — 목록 + 명함 → 친구 칸 · 판정용은 명함 안 받음 · 한 명 받기(친구 아님 · 명함 없음은 null) ·
         목록 듣기(처음 한 번 + friends 알림 · 한 번에 하나 · 해제하면 알림도 끊음 · 못 받으면 onError) · 프로필 듣기(card 알림은 그 친구만) · 끊기(이미 아니면 끝)
   ・2-3절: 끄는 스위치는 없다 — 0.13 설정에 친구 스위치 칸이 없다(받는 곳은 source-switch 한 길)
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
  PRT: pick(at('friends-presence-rt.js', 'friends')),
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
const FRIEND_FB_FNS = ['subscribeMyFriends', 'getMyFriendList', 'watchMyFriendList', 'getFriendCard', 'watchFriendProfile', 'getFriendProfile', 'apiGetAuthed', 'removeFriend'];
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
    };
    const rtp = {
      watchPresence: (ids, ok, st) => { log.push(['pres', ids.join(), typeof ok, typeof st]); return un; },
      readPresence: async (ids) => { log.push(['read', ids.join()]); return { a: { online: true } }; },
      retryWatch: () => { log.push(['retry']); return true; },
    };
    const port = P.createFriendsPort({ firebase: fake, presence: rtp, api: null, source: () => 'server', serverFirst: SW.serverFirst, warn(){} });
    const r = await port.listFriends('ME', { idsOnly: true });
    chk(r && r.f1 && JSON.stringify(log[0]) === JSON.stringify(['list', 'ME', { idsOnly: true }]), 'listFriends(myId, opts) — provider 로 · 값 그대로');
    await port.listFriends('ME');
    chk(log[1][2] && typeof log[1][2] === 'object', '  ↳ opts 를 안 주면 빈 객체');
    const u1 = port.watchList('ME', () => {}, () => {});
    chk(u1 === un && log[2].join() === 'watch,ME,function,function', 'watchList(myId, onChange, onError) — provider 로 · 해제 함수 그대로');
    const u2 = port.watchPresence('ME', ['a', 'b'], () => {}, () => {});
    chk(u2 === un && log[3].join() === 'pres,a,b,function,function', '★ watchPresence(myId, ids, onChange, onStatus) — realtime provider 로(내 코드는 안 넘김) · 해제 함수 그대로');
    const rd = await port.readPresence(['a', 'b']);
    chk(rd.a.online === true && log[4].join() === 'read,a,b', '  ↳ readPresence(ids) — ids 를 한 번에 realtime provider 로 · 옛 길(Firebase)은 안 거친다');
    chk(port.retryPresence() === true && log[5].join() === 'retry', '  ↳ retryPresence() — realtime provider 의 retryWatch 로 · 답 그대로');
  }

  {
    chk(SW.pickSource('friends') === 'server', '받는 곳(source-switch pickSource) — 0.13 한 길: 서버 먼저');
    const mkPort = (o) => {
      const L = { api: 0, fb: [], warn: 0 };
      const port = P.createFriendsPort({
        firebase: { listFriends: async (id, op) => { L.fb.push(op); return { f: { from: 'fb' } }; }, readFriend: async (fid) => { L.fb.push('one:' + fid); return { from: 'fb', fid }; }, watchList(){} },
        api: o.noApi ? null : { listFriends: async (id, op) => { L.api++; L.apiOpts = op; if(o.apiFail) throw Object.assign(new Error('x'), { status: 503 }); return { f: { from: 'api', id } }; },
          readFriend: async (fid) => { L.api++; if(o.apiFail) throw Object.assign(new Error('x'), { status: 503 }); return o.apiNull ? null : { from: 'api', fid }; } },
        source: () => o.src || SW.pickSource('friends'), serverFirst: SW.serverFirst, warn: () => { L.warn++; },
      });
      return { port, L };
    };
    let k = mkPort({});
    let v = await k.port.listFriends('ME', { idsOnly: true });
    chk(v.f.from === 'api' && v.f.id === 'ME' && k.L.api === 1 && !k.L.fb.length && k.port.lastSource() === 'api', '★ 켜짐 — api 에서 받으면 옛 길(Firebase)은 안 읽는다');
    chk(k.L.apiOpts && k.L.apiOpts.idsOnly === true, '  ↳ 판정용(idsOnly)을 서버 provider 에도 넘긴다(명함을 안 받게)');
    k = mkPort({ apiFail: true });
    v = await k.port.listFriends('ME', { idsOnly: true });
    chk(v.f.from === 'fb' && k.L.api === 1 && k.L.fb.length === 1 && k.L.fb[0].idsOnly === true && k.L.warn === 1 && k.port.lastSource() === 'firebase', '★ api 가 끝내 못 받으면 — 옛 길로(opts 그대로) · 진단 한 줄');
    v = await k.port.listFriends('ME');
    chk(k.L.api === 2, '  ↳ 다음에 목록을 열면 다시 서버부터(실패를 기억하지 않음)');
    k = mkPort({ src: 'firebase' });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'fb' && k.L.api === 0 && k.L.fb.length === 1, '★ 받는 곳이 파이어베이스면 — api 를 부르지도 않고 옛 길만');
    k = mkPort({ noApi: true });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'fb' && k.L.warn === 0, '  ↳ api provider 가 없으면 옛 길(실패가 아니라 진단 줄 없음)');
    k = mkPort({});
    v = await k.port.readFriend('u7');
    chk(v.from === 'api' && v.fid === 'u7' && k.L.api === 1 && !k.L.fb.length && k.port.lastSource() === null, '★ readFriend — api 먼저(그 친구 하나) · 옛 길 안 읽음 · lastSource 는 목록 받기만 적는다');
    k = mkPort({ apiNull: true });
    chk((await k.port.readFriend('u7')) === null && !k.L.fb.length, '  ↳ 서버가 «없는 사람»(null) 이면 null · 옛 길로 다시 안 감');
    k = mkPort({ apiFail: true });
    v = await k.port.readFriend('u7');
    chk(v.from === 'fb' && k.L.fb.join() === 'one:u7' && k.L.warn === 1, '  ↳ api 가 못 받으면 옛 길로 · 진단 한 줄');
    k = mkPort({ src: 'firebase' });
    v = await k.port.readFriend('u7');
    chk(v.from === 'fb' && k.L.api === 0, '  ↳ 받는 곳이 파이어베이스면 api 를 부르지도 않고 옛 길만');
    k = mkPort({ noApi: true });
    chk((await k.port.readFriend('u7')).from === 'fb' && k.L.warn === 0, '  ↳ api provider 가 없으면 옛 길');
    chk(!('LIVE_SOURCE' in P), '듣기 길을 못 박은 상수는 없다 — 듣기도 고른 길 하나(아래)');
    const mkWrite = (o) => {
      const L = [];
      const mk = (name) => ({ listFriends: async () => ({}), readFriend: async () => null,
        watchList: (...a) => { L.push([name, 'watchList', a[0]]); return () => {}; }, watchProfile: (...a) => { L.push([name, 'watchProfile', a[0]]); return () => {}; },
        readProfile: async (fid) => { L.push([name, 'readProfile', fid]); if(name === 'api' && o.apiFail) throw new Error('x'); return { name }; },
        removeFriend: async (...a) => { L.push([name, 'removeFriend', a.join()]); if(name === 'api' && o.apiFail) throw new Error('x'); } });
      const port = P.createFriendsPort({ firebase: mk('fb'), presence: {}, api: o.noApi ? null : mk('api'), source: () => o.src || 'server', serverFirst: SW.serverFirst, warn(){} });
      return { port, L };
    };
    let w = mkWrite({});
    w.port.watchList('ME', () => {}, () => {}); w.port.watchProfile('ME', ['a'], () => {}); await w.port.readProfile('a'); await w.port.removeFriend('ME', 'a');
    chk(w.L.map((x) => x[0] + ':' + x[1]).join() === 'api:watchList,api:watchProfile,api:readProfile,api:removeFriend', '★ 받는 곳이 서버면 — 목록 듣기 · 프로필 듣기 · 프로필 읽기 · 끊기 모두 서버 provider');
    chk(w.L[3][2] === 'a', '  ↳ 끊기는 친구 코드만 서버로(내 코드는 토큰이 정한다)');
    w = mkWrite({ src: 'firebase' });
    w.port.watchList('ME', () => {}, () => {}); w.port.watchProfile('ME', ['a'], () => {}); await w.port.readProfile('a'); await w.port.removeFriend('ME', 'a');
    chk(w.L.every((x) => x[0] === 'fb') && w.L[3][2] === 'ME,a', '★ 받는 곳이 파이어베이스면 — 모두 옛 길(끊기는 내 코드 · 친구 코드)');
    w = mkWrite({ noApi: true });
    w.port.watchList('ME', () => {}, () => {}); await w.port.removeFriend('ME', 'a');
    chk(w.L.every((x) => x[0] === 'fb'), '  ↳ 서버 provider 가 없으면 옛 길');
    w = mkWrite({ apiFail: true });
    chk((await w.port.readProfile('a')).name === 'fb' && w.L.map((x) => x[0]).join() === 'api,fb', '★ 프로필 새로 읽기는 서버가 못 받으면 옛 길로(읽기)');
    let ew = null; try{ await w.port.removeFriend('ME', 'a'); }catch(e){ ew = e; }
    chk(ew && w.L.filter((x) => x[1] === 'removeFriend').map((x) => x[0]).join() === 'api', '★ 끊기(쓰기)는 서버가 못 하면 던진다 — 옛 길로 넘기지 않는다(두 곳에 갈라 쓰지 않게)');
  }

  say('── 2. firebase provider(옛 길) — 목록 구독 하나 · 카드는 열 때 한 번 · 프로필은 열려 있는 동안만');
  {
    chk(F.PROFILE_BATCH_MS === 50 && F.CARD_KEEP_MS === 10 * 60 * 1000 && !('presenceOf' in F), '상수(모듈 위) — 프로필 묶기 50ms · 카드 다시 안 읽는 시간 10분');
    const c = F.cardOf({ profile: { name: 'A', level: 3, cyc: 1, clv: 2, starC: 'x' }, bio: 'hi', avatar: 'https://a' });
    chk(c.name === 'A' && c.level === 3 && c.cyc === 1 && c.clv === 2 && c.starC === 'x' && c.bio === 'hi' && c.avatar === 'https://a', 'cardOf(순수) — 이름 · 레벨 · 회차(날것) · 소개 · 사진');
    const c0 = F.cardOf({ profile: null, bio: null, avatar: null }), c1 = F.cardOf({ profile: { level: 0 } }), c2 = F.cardOf(null);
    chk(c0.name === '(이름 없음)' && c0.level === null && c0.bio === '' && c0.avatar === null && c1.level === null && c2.name === '(이름 없음)', '  ↳ 빈 값 — «(이름 없음)» · 레벨 null(1 미만 · 없음) · 소개 \'\' · 사진 null');
    const T = { q: [], set: (fn, ms) => { T.q.push({ fn, ms }); return T.q.length; }, clear: (id) => { if(T.q[id - 1]) T.q[id - 1].fn = null; }, run: () => { const q = T.q.splice(0); q.forEach(t => t.fn && t.fn()); } };
    let t = 0;
    const L = { lists: [], cards: [], subs: [], live: 0, gets: [] };
    const fb = F.createFriendsFirebase({
      getList: async (id) => { L.lists.push(id); return id === 'EMPTY' ? null : { f1: { addedAt: 5 }, f2: { addedAt: 6 } }; },
      watchList: (id, ok, err) => { const w = { id, ok, err, on: true }; L.subs.push(w); L.live++; return () => { if(w.on){ w.on = false; L.live--; } }; },
      getCard: async (fid) => { L.cards.push(fid); if(fid === 'f2' && L.failF2) throw new Error('x'); return { profile: { name: 'N-' + fid }, bio: '', avatar: null }; },
      watchProfile: (fid, cb) => { const w = { fid, cb, on: true }; L.subs.push(w); L.live++; return () => { if(w.on){ w.on = false; L.live--; } }; },
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
    const nCards = L.cards.length;
    const one = await fb.readFriend('f1');
    chk(L.cards.length === nCards && one.name === 'N-f1', 'readFriend — 목록 받기와 같은 카드 기억(10분 안이면 다시 안 읽음)');
    const one9 = await fb.readFriend('f9');
    chk(L.cards.length === nCards + 1 && L.cards[nCards] === 'f9' && one9.name === 'N-f9' && !('addedAt' in one9), '  ↳ 처음 보는 친구는 카드 한 번 읽기(세 칸) · 목록 칸(addedAt) 없이');
    const fresh = F.createFriendsFirebase({ getList: async () => ({ z: { addedAt: 1 } }), getCard: async () => { throw new Error('x'); }, now: () => 0 });
    const fz = await fresh.listFriends('ME');
    chk(fz.z.addedAt === 1 && !('name' in fz.z), '  ↳ 처음부터 실패하면 이름 칸 없이(목록이 자리표시 \'...\' 로 그린다)');
    chk((await fresh.readFriend('z')) === null, '  ↳ readFriend 도 처음부터 실패하면 null(자리표시 그대로)');
    const got = [], errs = [];
    const off = fb.watchList('ME', (f) => got.push(f), (e) => errs.push(e));
    L.subs[0].ok(null); L.subs[0].err(new Error('x'));
    chk(L.subs.length === 1 && got.length === 1 && JSON.stringify(got[0]) === '{}' && errs.length === 1, 'watchList — 목록 구독 하나에 onChange · onError (null 은 {})');
    off();
    chk(L.live === 0, '  ↳ 해제 함수 그대로');
    const pres = [];
    const offP = fb.watchProfile('ME', ['f1', 'f2', 'f3'], (p) => pres.push(p));
    chk(L.live === 3 && L.subs.slice(1).map(w => w.fid).join() === 'f1,f2,f3', 'watchProfile — 친구마다 프로필 구독(n개)');
    L.subs[1].cb({ name: 'A' }); L.subs[2].cb({ name: 'B', level: 3 }); L.subs[1].cb({ name: 'A2' });
    chk(pres.length === 0 && T.q.length === 1 && T.q[0].ms === 50, '  ↳ 한꺼번에 온 콜백은 50ms 에 한 번(타이머 하나)');
    T.run();
    chk(pres.length === 1 && pres[0].f1.name === 'A2' && pres[0].f2.level === 3 && !('f3' in pres[0]), '  ↳ 묶어서 한 번 — 받은 친구만 · 마지막 값');
    L.subs[3].cb({ name: 'C' });
    offP();
    T.run();
    chk(L.live === 0 && pres.length === 1, '  ↳ 풀면 n개 다 풀고 · 기다리던 넘기기도 안 한다');
    L.subs[1].cb({ name: 'late' }); T.run();
    chk(pres.length === 1, '  ↳ 풀린 뒤 늦은 콜백은 버린다');
  }

  say('── 2-1. 상시 구독 수 — firebase-init(가짜 onValue) → provider → 포트 → friends-sub 를 이어서');
  {
    const FS = load(S.FS, 'TwFriendsSub');
    const i0 = S.FI.indexOf('    watchMyFriendList(myId, onChange, onError){'), i1 = S.FI.indexOf('    async getFriendProfile(fid){', i0), i2 = i1 < 0 ? -1 : S.FI.indexOf('\n    },\n', i1);
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
        watchProfile: (...a) => api.watchFriendProfile(...a), getProfile: (...a) => api.getFriendProfile(...a), setTimer: (fn) => { timers.push(fn); return timers.length; }, clearTimer: () => {}, now: () => 0 });
      const port = P.createFriendsPort({ firebase: fbp, presence: { watchPresence: () => () => {}, readPresence: async () => ({}), retryWatch: () => false }, api: null, source: () => 'server', serverFirst: SW.serverFirst, warn(){} });
      let cur = {};
      const sub = FS.createFriendsSub({ subscribe: (...a) => port.watchList(...a), fetchOnce: (id) => port.listFriends(id, { idsOnly: true }), listFriends: (...a) => port.listFriends(...a),
        watchPresence: (...a) => port.watchPresence(...a), readPresence: (...a) => port.readPresence(...a), retryPresence: () => port.retryPresence(),
        watchProfile: (...a) => port.watchProfile(...a), readProfile: (...a) => port.readProfile(...a), current: () => cur, setFriends: (v) => { cur = v; }, getMyUserId: () => 'ME',
        toast(){}, setTimer: (fn) => 0, clearTimer(){}, onUnload(){} });
      const on = () => live.filter(l => l.on).length;
      sub.start('ME', (f) => { cur = f; }, () => {});
      live.filter(l => l.on && l.p === 'users/ME/friends').forEach(l => l.cb({ val: () => list }));
      await flush(); await flush();
      chk(on() === 1 && Object.keys(cur).length === N && cur.f3.name === 'users/f3/profile', '★ 친구 ' + N + '명 — 평소 상시 구독 1개(전에는 1 + 4 × ' + N + ' = ' + (1 + 4 * N) + '개) · 이름은 한 번 읽어 얹음 (지금 ' + on() + ')');
      sub.open('myhome', () => {});
      chk(on() === 1 + N, '★ 친구 탭을 열면 1 + ' + N + '개 — 프로필(이름 · 레벨)뿐(접속 상태는 realtime 하나) (지금 ' + on() + ')');
      sub.open('invite', () => {});
      chk(on() === 1 + N, '  초대 목록까지 열어도 1 + ' + N + '개(겹쳐 걸지 않음)');
      sub.close('myhome'); sub.close('invite');
      chk(on() === 1, '★ 닫으면 다시 1개 (지금 ' + on() + ')');
      sub.stop();
      chk(on() === 0, '  멈추면 0개');
    }
  }

  say('── 2-2. 서버 provider — 목록 + 명함 → 친구 칸 · 알림');
  let FA = null;
  try{ FA = load(S.FAPI, 'TwFriendsApi'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  {
    const CARD = { name: '라온', avatar: 'https://img/av.png', bio: '안녕', level: 12, cyc: 1, clv: 3, starC: 'gold' };
    const k1 = FA.friendOf(CARD);
    chk(k1.name === '라온' && k1.level === 12 && k1.cyc === 1 && k1.clv === 3 && k1.starC === 'gold' && k1.avatar === 'https://img/av.png' && k1.bio === '안녕', 'friendOf(명함) — 이름 · 레벨 · 회차 · 소개 · 사진');
    const k2 = FA.friendOf({ name: '', avatar: null, bio: '', level: null });
    chk(k2.name === '(이름 없음)' && k2.level === null && k2.avatar === null, '  ↳ 이름이 비면 «(이름 없음)» · 레벨 null 은 그대로(배지 숨김)');
    const p = FA.profileOf(CARD);
    chk(p.name === '라온' && p.level === 12 && p.starC === 'gold' && !('bio' in p) && !('avatar' in p), 'profileOf — 이름 · 레벨 · 회차만(소개 · 사진은 덮지 않는다)');
  }
  const mkFake = (o) => {
    o = o || {};
    const L = { friends: 0, one: [], cards: [], removed: [], on: {}, offs: 0, warns: 0 };
    const social = {
      fetchFriends: async () => { L.friends++; if(o.friendsFail) throw new Error('목록 못 받음'); await (o.gate || Promise.resolve()); return o.list || [{ userCode: 'u1', addedAt: 5, lastSeenAt: 9 }, { userCode: 'u2', addedAt: 6, lastSeenAt: null }]; },
      fetchFriend: async (c) => { L.one.push(c); return o.notFriend ? null : { userCode: c, addedAt: 1, lastSeenAt: null }; },
      fetchCards: async (codes) => { L.cards.push(codes.join()); if(o.cardsFail) throw new Error('명함 못 받음'); const out = {}; for(const c of codes) if(!(o.noCard || []).includes(c)) out[c] = { name: 'N-' + c, avatar: null, bio: 'b', level: 2, cyc: 1, clv: 1, starC: 'x' }; return out; },
      removeFriend: async (c) => { L.removed.push(c); if(o.removeErr) throw o.removeErr; },
    };
    const rt = { on: (kind, fn) => { (L.on[kind] = L.on[kind] || []).push(fn); return () => { L.offs++; L.on[kind] = L.on[kind].filter((f) => f !== fn); }; } };
    const fa = FA.createFriendsApi({ social, rt, warn: () => { L.warns++; } });
    const fire = (kind, n) => (L.on[kind] || []).slice().forEach((f) => f(Object.assign({ kind, subject: null, section: null, resync: false }, n)));
    return { fa, L, fire };
  };
  {
    let k = mkFake();
    let v = await k.fa.listFriends('ME');
    chk(Object.keys(v).join() === 'u1,u2' && v.u1.addedAt === 5 && v.u1.name === 'N-u1' && v.u2.level === 2 && !('lastSeenAt' in v.u1) && !('lastSeen' in v.u1) && k.L.cards.join('|') === 'u1,u2',
      '★ listFriends — 목록 1번 + 명함 한 묶음 → { 친구id: { addedAt · 이름 · … } } · «마지막 접속» 은 화면에 안 쓴다(D3-Q1 안 넣음)');
    k = mkFake({ noCard: ['u2'] });
    v = await k.fa.listFriends('ME');
    chk(v.u2.addedAt === 6 && !('name' in v.u2), '  ↳ 명함이 없는 친구는 이름 칸을 덮지 않는다(friends-sub 의 자리표시)');
    k = mkFake();
    v = await k.fa.listFriends('ME', { idsOnly: true });
    chk(v.u1.addedAt === 5 && !('name' in v.u1) && !k.L.cards.length, '★ 판정용(idsOnly) — 명함 요청 0');
    k = mkFake({ friendsFail: true });
    let e1 = null; try{ await k.fa.listFriends('ME'); }catch(e){ e1 = e; }
    chk(e1 && !k.L.cards.length, '  ↳ 목록을 못 받으면 던진다(포트가 옛 길로) · 명함은 묻지 않음');
    k = mkFake({ cardsFail: true });
    e1 = null; try{ await k.fa.listFriends('ME'); }catch(e){ e1 = e; }
    chk(!!e1, '  ↳ 명함을 못 받아도 던진다(한 조각이라도 — 이름이 반쯤 빈 목록을 «받음» 으로 치지 않는다)');
    k = mkFake();
    v = await k.fa.readFriend('u1');
    chk(v.name === 'N-u1' && v.bio === 'b' && k.L.one.join() === 'u1' && k.L.cards.join() === 'u1', '★ readFriend — 친구 한 명 확인 + 명함 한 장');
    k = mkFake({ notFriend: true });
    chk((await k.fa.readFriend('u9')) === null && !k.L.cards.length, '  ↳ 친구가 아니면 null(명함은 묻지 않음)');
    k = mkFake({ noCard: ['u1'] });
    chk((await k.fa.readFriend('u1')) === null, '  ↳ 명함이 없으면 null');
    k = mkFake();
    v = await k.fa.readProfile('u1');
    chk(v.name === 'N-u1' && v.level === 2 && !('bio' in v), 'readProfile — 이름 · 레벨 · 회차');
    k = mkFake({ noCard: ['u1'] });
    let e2 = null; try{ await k.fa.readProfile('u1'); }catch(e){ e2 = e; }
    chk(e2 && e2.code === 'NO_CARD', '  ↳ 명함이 없으면 던진다(포트가 옛 길로)');
    k = mkFake();
    await k.fa.removeFriend('u1');
    chk(k.L.removed.join() === 'u1', '끊기 — 서버로 그 친구 코드');
    k = mkFake({ removeErr: Object.assign(new Error('n'), { code: 'SOCIAL_NOT_FRIEND' }) });
    let e3 = null; try{ await k.fa.removeFriend('u1'); }catch(e){ e3 = e; }
    chk(!e3, '  ↳ 이미 친구가 아니면 끝난 것으로 본다(던지지 않음)');
    k = mkFake({ removeErr: Object.assign(new Error('n'), { code: 'NETWORK' }) });
    e3 = null; try{ await k.fa.removeFriend('u1'); }catch(e){ e3 = e; }
    chk(!!e3, '  ↳ 그 밖의 실패는 던진다(화면이 «삭제 실패»)');
  }
  {
    const got = [], errs = [];
    let k = mkFake();
    const off = k.fa.watchList('ME', (v) => got.push(v), (e) => errs.push(e));
    await flush();
    chk(got.length === 1 && JSON.stringify(got[0]) === '{"u1":{"addedAt":5},"u2":{"addedAt":6}}' && k.L.cards.length === 0, '★ watchList — 처음 한 번 받아 { 친구id: { addedAt } }(명함은 안 묻는다)');
    k.fire('friends'); await flush();
    chk(got.length === 2 && k.L.friends === 2, '  ↳ friends 알림이 오면 다시 받는다');
    k.fire('friends', { resync: true }); await flush();
    chk(got.length === 3, '  ↳ 오래 끊겼다 붙은 다시 받기(resync)도 받는다');
    off();
    chk(k.L.offs === 1 && !(k.L.on.friends || []).length, '  ↳ 해제하면 알림 걸기도 푼다');
    k.fire('friends'); await flush();
    chk(got.length === 3, '  ↳ 푼 뒤 알림은 무시');
    /* 받는 중 알림이 겹쳐도 한 번에 하나 — 끝난 뒤 한 번 더 */
    let open; const gate = new Promise((r) => { open = r; });
    k = mkFake({ gate });
    const got2 = [];
    k.fa.watchList('ME', (v) => got2.push(v), () => {});
    k.fire('friends'); k.fire('friends'); k.fire('friends');
    await flush();
    chk(k.L.friends === 1, '★ 받는 중에 알림이 여럿 와도 요청은 하나(겹쳐 받지 않음)');
    open(); await flush(); await flush();
    chk(k.L.friends === 2 && got2.length === 2, '  ↳ 끝난 뒤 한 번만 더(알림이 몇 번이든)');
    k = mkFake({ friendsFail: true });
    const errs2 = [];
    k.fa.watchList('ME', () => { errs2.push('값'); }, (e) => errs2.push('오류'));
    await flush();
    chk(errs2.join() === '오류' && k.L.friends === 1, '★ 못 받으면 onError 한 번 · 혼자 다시 받지 않는다');
    k = mkFake();
    const off2 = k.fa.watchList('ME', () => { errs.push('늦은 값'); }, () => {});
    off2(); await flush();
    chk(!errs.length, '  ↳ 풀기 전에 시작한 받기가 늦게 끝나도 값을 넘기지 않는다');
  }
  {
    let k = mkFake();
    const got = [];
    const off = k.fa.watchProfile('ME', ['u1', 'u2'], (v) => got.push(v));
    await flush();
    chk(got.length === 1 && got[0].u1.name === 'N-u1' && got[0].u2.level === 2 && !('bio' in got[0].u1) && k.L.cards.join('|') === 'u1,u2', '★ watchProfile — 처음 한 번 명함 한 묶음 → { 친구id: 프로필 }');
    k.fire('card', { subject: 'u2' }); await flush();
    chk(k.L.cards[1] === 'u2' && got.length === 2 && Object.keys(got[1]).join() === 'u2', '★ card 알림은 그 친구 한 명만 다시 받는다');
    k.fire('card', { subject: 'zz' }); await flush();
    chk(k.L.cards.length === 2, '  ↳ 듣는 친구가 아니면 무시');
    k.fire('card', { resync: true }); await flush();
    chk(k.L.cards[2] === 'u1,u2' && got.length === 3, '  ↳ 오래 끊겼다 붙으면(resync) 전부 다시');
    off();
    chk(k.L.offs === 1, '  ↳ 해제하면 알림 걸기도 푼다');
    k.fire('card', { subject: 'u1' }); await flush();
    chk(k.L.cards.length === 3, '  ↳ 푼 뒤 알림은 무시');
    k = mkFake({ cardsFail: true });
    k.fa.watchProfile('ME', ['u1'], () => {});
    await flush();
    chk(k.L.warns === 1 && k.L.cards.length === 1, '  ↳ 못 받으면 진단 한 줄 · 혼자 다시 받지 않음(다음 알림 때)');
    k = mkFake();
    k.fa.watchProfile('ME', [], () => {}); await flush();
    chk(!k.L.cards.length, '  ↳ 듣는 친구가 없으면 요청 0');
  }

  say('── 2-3. 끄는 스위치는 없다 — 0.13 설정(/v2/config)에 친구 스위치 칸이 없다');
  {
    let RCM = null;
    try{ const m = { exports: {} }; new Function('window', 'module', 'console', S.RC)(undefined, m, { warn(){} }); RCM = m.exports; }catch(e){ chk(false, 'remote-config 싣다 던짐 — ' + e.message); }
    if(RCM) chk(!('friendsApi' in RCM.createRemoteConfig()) && !('friendsApi' in RCM.DEFAULTS), '원격 설정에 friendsApi 가 없다 — 받는 곳은 source-switch 한 길(서버 먼저)');
  }

  say('── 3. 배선');
  {
    const a = strip(S.APP);
    chk(/const friendsFirebaseMod = TwFriendsFirebase\.createFriendsFirebase\(\{\n  getList: \(\.\.\.a\)=>firebaseAPI\.getMyFriendList\(\.\.\.a\),\n  watchList: \(\.\.\.a\)=>firebaseAPI\.watchMyFriendList\(\.\.\.a\),\n  getCard: \(\.\.\.a\)=>firebaseAPI\.getFriendCard\(\.\.\.a\),\n  watchProfile: \(\.\.\.a\)=>firebaseAPI\.watchFriendProfile\(\.\.\.a\),[^\n]*\n/.test(a) && !/watchFriendPresence|getFriendPresence/.test(a),
      'app.js — firebase provider 가 firebaseAPI 친구 함수를 deps 로 받는다(목록 한 번 · 목록 구독 · 카드 · 프로필 구독 · 한 번) — 접속 상태 함수는 없다');
    chk(/  watchPresence: \(\.\.\.a\)=>friendsPortMod\.watchPresence\(\.\.\.a\),\n  readPresence: \(\.\.\.a\)=>friendsPortMod\.readPresence\(\.\.\.a\),\n  retryPresence: \(\)=>friendsPortMod\.retryPresence\(\),/.test(a), '  ↳ friends-sub 의 접속 상태 듣기 · 한 번 읽기 · 다시 묻기도 포트로');
    chk(/const friendsPresenceRtMod = TwFriendsPresenceRt\.createFriendsPresenceRt\(\{ rt: TwRtHub\.store \}\);/.test(a) && /const friendsPortMod = TwFriendsPort\.createFriendsPort\(\{\n  firebase: friendsFirebaseMod,\n  presence: friendsPresenceRtMod,\n  api: friendsApiMod,\n  source: \(\)=>TwSourceSwitch\.store\.pick\('friends'\),[^\n]*\n  serverFirst: TwSourceSwitch\.serverFirst,/.test(a), '  ↳ 포트가 provider 셋(옛 길 · realtime 접속 상태 · api) · 스위치(원격 설정 friendsApi — 설정이 없으면 켜짐)를 받는다');
    chk(/const socialApiMod = TwSocialApi\.createSocialApi\(\{ authed: TwApi\.authed,[^\n]*\n/.test(a) && /const friendsApiMod = TwFriendsApi\.createFriendsApi\(\{\n  social: socialApiMod,\n  rt: TwRtHub\.store,/.test(a), '  ↳ 서버 provider 가 서버 길(social-api.js — 로그인 API 통로 TwApi.authed) · realtime 알림 걸기를 받는다');
    const fi = strip(S.FI);
    chk(/window\.TwApi\.bindToken\(_getIdToken\);\n  const _authApi = window\.TwApi\.authed;/.test(fi)
      && /apiGetAuthed\(path, opts\)\{ return _authApi \? _authApi\.get\(path, opts\) : Promise\.reject\(/.test(fi),
      '  ↳ firebase-init — 로그인 API 통로(api-client.js authed — 공용 주소 · 쉬기 끔)에 Firebase ID 토큰을 잇는다 · 없으면 거절(옛 길)');
    chk(/  listFriends: \(\.\.\.a\)=>friendsPortMod\.listFriends\(\.\.\.a\),/.test(a), '  ↳ friends-sub 의 이름 받기(listFriends)도 포트로');
    chk(/  readFriend: \(\.\.\.a\)=>friendsPortMod\.readFriend\(\.\.\.a\),/.test(a), '  ↳ friends-sub 의 새 친구 한 명 받기(readFriend)도 포트로');
    chk(/  remove: \(\.\.\.a\)=>firebaseAPI\.removeFriend\(\.\.\.a\),/.test(a) && /  removeFriend: \(\.\.\.a\)=>friendsPortMod\.removeFriend\(\.\.\.a\),/.test(a), '  ↳ 끊기도 포트로(옛 길 provider 는 firebaseAPI.removeFriend 를 deps 로) — 화면은 firebaseAPI 를 안 부른다');
    chk(/  subscribe: \(\.\.\.a\)=>friendsPortMod\.watchList\(\.\.\.a\),\n  fetchOnce: \(id\)=>friendsPortMod\.listFriends\(id, \{ idsOnly:true \}\),/.test(a), '  ↳ friends-sub 의 subscribe · fetchOnce 는 포트로');
    const iF = a.indexOf('const friendsFirebaseMod'), iR = a.indexOf('const friendsPresenceRtMod'), iA = a.indexOf('const friendsApiMod'), iP = a.indexOf('const friendsPortMod'), iS = a.indexOf('const friendsSubMod');
    chk(iF > 0 && iA > iF && iR > iF && iP > iA && iP > iR && iS > iP, '  ↳ 만드는 순서 provider(옛 길 · api) → 포트 → friends-sub');
    const h = S.HTML;
    const hF = h.indexOf('<script src="parts/friends/friends-firebase.js">'), hP = h.indexOf('<script src="parts/friends/friends-port.js">'), hA = h.indexOf('<script src="parts/app.js">'),
      hI = h.indexOf('<script src="parts/friends/friends-api.js">'), hR = h.indexOf('<script src="parts/friends/friends-presence-rt.js">'), hH = h.indexOf('<script src="parts/realtime/rt-hub.js">'), hC = h.indexOf('<script src="parts/shared/api-client.js">');
    chk(hF > 0 && hP > 0 && hI > 0 && hF < hA && hP < hA && hI < hA && hR > hH && hH > 0 && hR < hP && hC > 0 && hC < hA, 'html — friends-firebase.js · friends-api.js · friends-presence-rt.js(rt-hub.js 다음) · friends-port.js(· api-client.js)를 app.js 보다 먼저 싣는다');
    chk(!/firebaseAPI|firebase-init|\bref\(db|onValue\(/.test(strip(S.PORT)) && !/firebaseAPI|firebase-init|\bref\(db|onValue\(/.test(strip(S.PRT)) && !/firebaseAPI|\bref\(db|onValue\(/.test(strip(S.FBP)) && !/firebaseAPI|\bref\(db|onValue\(|\bfetch\(/.test(strip(S.FAPI)),
      'friends/ 파일은 firebaseAPI · SDK 를 직접 안 부른다(deps 로만)');
    chk(!/firebaseAPI|firebase-init|getIdToken|currentUser/.test(strip(S.AC)), 'shared/api-client.js 는 Firebase 를 모른다(토큰은 getToken deps 로만)');
    const bad = ALL_JS.filter(([f, src]) => f !== 'firebase-init.js' && f !== 'app.js'
      && FRIEND_FB_FNS.some(n => new RegExp('firebaseAPI\\s*\\.\\s*' + n + '\\b').test(strip(src))));
    chk(!bad.length, '화면 · 도메인 파일이 친구 데이터 firebaseAPI 함수(' + FRIEND_FB_FNS.join(' · ') + ')를 직접 안 부른다' + (bad.length ? ' — ' + bad.map(b => b[0]).join(' · ') : ''));
    /* 🗂️ 방 로비 provider 도 로그인 통로(apiGetAuthed)를 쓴다 — 친구 provider 몫이 아니라 빼고 센다 */
    const aFriends = a
      .replace(/^const roomLobbyProvider = TwRoomLobbyProvider\.createRoomLobbyProvider\(.*$/m, '');
    const appCalls = (aFriends.match(/firebaseAPI\.(subscribeMyFriends|getMyFriendList|watchMyFriendList|getFriendCard|watchFriendProfile|getFriendProfile|apiGetAuthed)\(/g) || []).length;
    chk(appCalls === 5, '  ↳ app.js 도 옛 길 provider deps 다섯 줄에서만 (' + appCalls + ')');
    chk(!/subscribeMyFriends/.test(strip(S.FI)) && !/subscribeMyFriends/.test(a), '  ↳ 친구별 4개 구독(subscribeMyFriends)은 어디에도 없다');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PORT', 'firebase.listFriends(myId, opts || {})', 'firebase.listFriends(myId, {})', 'opts 를 버림'],
  ['PORT', 'watchList(myId, onChange, onError); }\n  /* 접속 상태는', 'watchList(myId, onChange); }\n  /* 접속 상태는', '에러 콜백을 안 넘김'],
  ['PORT', 'return presence.watchPresence(ids, onChange, onStatus);', 'presence.watchPresence(ids, onChange, onStatus);', '접속 상태 해제 함수를 안 돌려줌'],
  ['PORT', 'return presence.readPresence(ids);', 'return firebase.readPresence(ids);', '접속 상태 읽기가 옛 길로 감'],
  ['FS', "  const want = (Object.keys(_open).length && _status", "  const want = (_status", '목록이 닫혀 있어도 접속 상태를 들음'],
  ['FBP', 'const ids = (await getList(myId)) || {};', 'const ids = await getList(myId);', '없을 때 null'],
  ['FBP', '    if(opts && opts.idsOnly) return ids;\n', '', '판정용인데 카드까지 읽음'],
  ['FBP', '    if(c && t - c.at < CARD_KEEP_MS) return c.card;\n', '', '열 때마다 카드를 다시 읽음'],
  ['FBP', 'const notify = ()=>{ if(timer == null) timer = setTimer(flush, PROFILE_BATCH_MS); };', 'const notify = ()=>{ onChange(Object.assign({}, combined)); };', '프로필을 콜백마다 넘김(그리기 폭주)'],
  ['FBP', '      for(const off of offs){ try{ off(); }catch(_){} }', '', '풀어도 친구별 구독이 남음'],
  ['FI', "      _listOff = onValue(ref(db, `users/${myId}/friends`), snap=>{\n        if(_dead) return;\n        onChange(snap.val() || {});", "      _listOff = onValue(ref(db, `users/${myId}/friends`), snap=>{\n        if(_dead) return;\n        Object.keys(snap.val() || {}).forEach(fid=>onValue(ref(db, `users/${fid}/profile`), ()=>{}));\n        onChange(snap.val() || {});", '친구별 구독을 되살림'],
  ['APP', '  subscribe: (...a)=>friendsPortMod.watchList(...a),', '  subscribe: (...a)=>firebaseAPI.subscribeMyFriends(...a),', 'friends-sub 가 포트를 건너뜀'],
  ['SS', "  friends: SOURCE.SERVER,", "  friends: SOURCE.FIREBASE,", '친구가 서버를 안 씀'],
  ['SS', "      if(onFail) onFail(e);", "      throw e;", 'api 실패를 옛 길로 안 넘김'],
  ['FI', "  window.TwApi.bindToken(_getIdToken);\n", "", '로그인 통로에 토큰을 안 이음'],
  ['RC', "  inviteGate: true,\n", "  inviteGate: true,\n  friendsApi: false,\n", '원격 설정에 친구 스위치가 되살아남'],
  ['PORT', "      apiProvider ? () => apiProvider.readFriend(fid) : null,", "      null,", '친구 한 명은 서버를 안 봄'],
  ['PORT', "      apiProvider ? () => apiProvider.listFriends(myId, opts || {}) : null,", "      apiProvider ? () => apiProvider.listFriends(myId) : null,", '서버 길에 opts(판정용)를 안 넘김'],
  ['PORT', "  const viaServer = () => !!apiProvider && source() === 'server';", "  const viaServer = () => false;", '듣기 · 끊기가 서버를 안 씀'],
  ['PORT', "function removeFriend(myId, fid){ return viaServer() ? apiProvider.removeFriend(fid) : firebase.removeFriend(myId, fid); }", "async function removeFriend(myId, fid){ try{ return await apiProvider.removeFriend(fid); }catch(e){ return firebase.removeFriend(myId, fid); } }", '끊기를 못 하면 옛 길로 갈라 씀'],
  ['FAPI', "    const cards = idsOnly ? {} : await social.fetchCards(list.map((f) => f.userCode));", "    const cards = await social.fetchCards(list.map((f) => f.userCode));", '판정용인데 명함까지 받음'],
  ['FAPI', "    if(!(await social.fetchFriend(fid))) return null;", "", '친구가 아닌데 명함을 줌'],
  ['FAPI', "      if(flying){ again = true; return; }", "      if(flying){ return; }", '받는 중 알림을 버림(마지막 알림이 안 맞음)'],
  ['FAPI', "    const off = rt.on('friends', () => { w.run(); });", "    const off = { call(){} }.call;", '목록 알림을 안 걸음'],
  ['FAPI', "    return () => { w.stop(); off(); };\n  }\n\n  function watchProfile", "    return () => { };\n  }\n\n  function watchProfile", '목록 듣기를 풀어도 알림이 남음'],
  ['FAPI', "if(n && typeof n.subject === 'string' && want.has(n.subject))", "if(n && typeof n.subject === 'string')", '남의 명함 알림에도 받음'],
  ['FAPI', "      if(n && n.resync) return all();\n", "", '오래 끊긴 뒤 다시 받기를 안 함'],
  ['FAPI', "    catch(e){ if(!(e && e.code === 'SOCIAL_NOT_FRIEND')) throw e; }", "    catch(e){ throw e; }", '이미 친구가 아닌 끊기를 실패로 봄'],
  ['FAPI', "name: card.name || NO_NAME", "    name: card.name", '이름이 비면 빈 이름'],
  ['FAPI', "    if(!card){ const e = new Error('명함 없음'); e.code = 'NO_CARD'; throw e; }", "", '명함 없는데 던지지 않음'],
  ['PORT', "      () => firebase.readFriend(fid),", "      () => null,", '친구 한 명 옛 길이 없음'],
  ['FBP', "  function readFriend(fid){ return _cardOf(fid, now()); }", "  async function readFriend(fid){ return cardOf(await getCard(fid)); }", '친구 한 명이 카드 기억을 안 씀'],
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
