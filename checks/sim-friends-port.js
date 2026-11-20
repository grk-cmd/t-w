/* ═══ 👥 sim-friends-port.js — 친구 데이터 포트 · provider (2026-10-17 신설) ═══
   [왜] 친구 정보를 Firebase 구독에서 서버(API)로 옮긴다. 도메인(friends-sub.js) · 화면은 포트 하나만 부르고,
     어디서 받을지는 provider(api · realtime)가 맡는다.
   ・1절: 포트 — 모든 함수가 서버 provider(api) · realtime provider(접속 상태)로 그대로 · 못 받으면 던진다(옛 Firebase 경로로 물러나지 않는다 — D13 E-2)
   ・2-2절: 서버 provider(friends-api.js — social-api.js 위) — 목록 + 명함 → 친구 칸 · 판정용은 명함 안 받음 · 한 명 받기(친구 아님 · 명함 없음은 null) ·
         목록 듣기(처음 한 번 + friends 알림 · 한 번에 하나 · 해제하면 알림도 끊음 · 못 받으면 onError) · 프로필 듣기(card 알림은 그 친구만) · 끊기(이미 아니면 끝)
   ・2-3절: 끄는 스위치는 없다 — 0.13 설정에 친구 스위치 칸이 없다(서버 한 길)
   ・3절: 배선 — app.js 가 포트 → provider 를 잇는다(옛 경로 provider · source-switch 는 없다) · html 순서 · friends/ 파일은 firebaseAPI 를 모른다 ·
         화면 파일이 친구 데이터 firebaseAPI 함수를 직접 안 부른다
   ・4절: mutation test — 하나라도 못 잡으면 빨강
   [실행] 러너 스테이징(평면)에서. */
'use strict';
globalThis.TwPersonName = require([__dirname, process.cwd()].flatMap(d => ['person-name.js', 'parts/shared/person-name.js', 'app/parts/shared/person-name.js'].map(p => require('path').join(d, p))).find(p => require('fs').existsSync(p)));   // 🏷️ 모듈이 부르는 이름 그리기 — 진짜 파일
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
  PRT: pick(at('friends-presence-rt.js', 'friends')),
  FAPI: pick(at('friends-api.js', 'friends')),
  AC: pick(at('api-client.js', 'shared')),
  RC: pick(at('remote-config.js', 'shared')),
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
  let P = null;
  try{ P = load(S.PORT, 'TwFriendsPort'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(P && typeof P.createFriendsPort === 'function', '전역 이름 TwFriendsPort');
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
    const port = P.createFriendsPort({ presence: rtp, api: fake });
    const r = await port.listFriends('ME', { idsOnly: true });
    chk(r && r.f1 && JSON.stringify(log[0]) === JSON.stringify(['list', 'ME', { idsOnly: true }]), 'listFriends(myId, opts) — provider 로 · 값 그대로');
    await port.listFriends('ME');
    chk(log[1][2] && typeof log[1][2] === 'object', '  ↳ opts 를 안 주면 빈 객체');
    const u1 = port.watchList('ME', () => {}, () => {});
    chk(u1 === un && log[2].join() === 'watch,ME,function,function', 'watchList(myId, onChange, onError) — provider 로 · 해제 함수 그대로');
    const u2 = port.watchPresence('ME', ['a', 'b'], () => {}, () => {});
    chk(u2 === un && log[3].join() === 'pres,a,b,function,function', '★ watchPresence(myId, ids, onChange, onStatus) — realtime provider 로(내 코드는 안 넘김) · 해제 함수 그대로');
    const rd = await port.readPresence(['a', 'b']);
    chk(rd.a.online === true && log[4].join() === 'read,a,b', '  ↳ readPresence(ids) — ids 를 한 번에 realtime provider 로 · 옛 경로(Firebase)은 안 거친다');
    chk(port.retryPresence() === true && log[5].join() === 'retry', '  ↳ retryPresence() — realtime provider 의 retryWatch 로 · 답 그대로');
  }

  {
    const mkPort = (o) => {
      const L = { api: [], warn: 0 };
      const api = {
        listFriends: async (id, op) => { L.api.push(['list', op]); if(o.fail) throw Object.assign(new Error('x'), { status: 503 }); return { f: { from: 'api', id } }; },
        readFriend: async (fid) => { L.api.push(['one', fid]); if(o.fail) throw Object.assign(new Error('x'), { status: 503 }); return o.apiNull ? null : { from: 'api', fid }; },
        readProfile: async (fid) => { L.api.push(['prof', fid]); if(o.fail) throw new Error('x'); return { name: 'api' }; },
        watchList: (...a) => { L.api.push(['watchList', a[0]]); return () => {}; },
        watchProfile: (...a) => { L.api.push(['watchProfile', a[0]]); return () => {}; },
        removeFriend: async (...a) => { L.api.push(['removeFriend', a.join()]); if(o.fail) throw new Error('x'); },
      };
      return { port: P.createFriendsPort({ api, presence: {} }), L };
    };
    let k = mkPort({});
    let v = await k.port.listFriends('ME', { idsOnly: true });
    chk(v.f.from === 'api' && v.f.id === 'ME' && k.L.api.length === 1, '★ 목록 받기 — 서버 provider 한 길');
    chk(k.L.api[0][1] && k.L.api[0][1].idsOnly === true, '  ↳ 판정용(idsOnly)을 서버 provider 에도 넘긴다(명함을 안 받게)');
    k = mkPort({ fail: true });
    let e1 = null; try{ await k.port.listFriends('ME'); }catch(e){ e1 = e; }
    chk(e1 && e1.status === 503 && k.L.api.length === 1, '★ 못 받으면 던진다 — 옛 경로(Firebase)로 물러나 다시 읽지 않는다');
    k = mkPort({});
    v = await k.port.readFriend('u7');
    chk(v.from === 'api' && v.fid === 'u7', '★ readFriend — 서버 provider 로(그 친구 하나)');
    k = mkPort({ apiNull: true });
    chk((await k.port.readFriend('u7')) === null, '  ↳ 서버가 «없는 사람»(null) 이면 null');
    k = mkPort({ fail: true });
    e1 = null; try{ await k.port.readFriend('u7'); }catch(e){ e1 = e; }
    chk(!!e1 && k.L.api.length === 1, '  ↳ readFriend 도 못 받으면 던진다');
    chk(!('lastSource' in k.port) && !('SOURCE' in P) && !('LIVE_SOURCE' in P), '받는 곳을 기억하는 자리(lastSource · SOURCE)는 없다 — 길이 하나');
    k = mkPort({});
    k.port.watchList('ME', () => {}, () => {}); k.port.watchProfile('ME', ['a'], () => {}); await k.port.readProfile('a'); await k.port.removeFriend('ME', 'a');
    chk(k.L.api.map((x) => x[0]).join() === 'watchList,watchProfile,prof,removeFriend', '★ 목록 듣기 · 프로필 듣기 · 프로필 읽기 · 끊기 모두 서버 provider');
    chk(k.L.api[3][1] === 'a', '  ↳ 끊기는 친구 코드만 서버로(내 코드는 토큰이 정한다)');
    k = mkPort({ fail: true });
    let e2 = null; try{ await k.port.readProfile('a'); }catch(e){ e2 = e; }
    let e3 = null; try{ await k.port.removeFriend('ME', 'a'); }catch(e){ e3 = e; }
    chk(!!e2 && !!e3 && k.L.api.length === 2, '★ 프로필 읽기 · 끊기도 못 하면 던진다(옛 경로로 넘기지 않는다)');
  }

  say('── 2-2. 서버 provider — 목록 + 명함 → 친구 칸 · 알림');
  let FA = null;
  try{ FA = load(S.FAPI, 'TwFriendsApi'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  {
    const CARD = { name: '라온', avatar: 'https://img/av.png', bio: '안녕', level: 12, cyc: 1, clv: 3, starC: 'gold' };
    const k1 = FA.friendOf(CARD);
    chk(k1.name === '라온' && k1.level === 12 && k1.cyc === 1 && k1.clv === 3 && k1.starC === 'gold' && k1.avatar === 'https://img/av.png' && k1.bio === '안녕', 'friendOf(명함) — 이름 · 레벨 · 회차 · 소개 · 사진');
    const k2 = FA.friendOf({ name: '', avatar: null, bio: '', level: null });
    chk(k2.name === '' && k2.level === null && k2.avatar === null && TwPersonName.shown(k2.name) === '이름 없음', '  ↳ 이름이 비면 \'\' 그대로(placeholder 없음 — 그릴 때 «이름 없음») · 레벨 null 은 그대로(배지 숨김)');
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
    chk(e1 && !k.L.cards.length, '  ↳ 목록을 못 받으면 던진다(포트가 옛 경로로) · 명함은 묻지 않음');
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
    chk(e2 && e2.code === 'NO_CARD', '  ↳ 명함이 없으면 던진다(포트가 옛 경로로)');
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
    if(RCM) chk(!('friendsApi' in RCM.createRemoteConfig()) && !('friendsApi' in RCM.DEFAULTS), '원격 설정에 friendsApi 가 없다 — 서버 한 길');
  }

  say('── 3. 배선');
  {
    const a = strip(S.APP);
    chk(!/friendsFirebaseMod|friendRequestsFirebaseMod|TwFriendsFirebase|TwFriendRequestsFirebase|TwSourceSwitch/.test(a), 'app.js — 옛 경로 provider(Firebase) · 받는 곳 고르기(source-switch)가 없다');
    chk(/  watchPresence: \(\.\.\.a\)=>friendsPortMod\.watchPresence\(\.\.\.a\),\n  readPresence: \(\.\.\.a\)=>friendsPortMod\.readPresence\(\.\.\.a\),\n  retryPresence: \(\)=>friendsPortMod\.retryPresence\(\),/.test(a), '  ↳ friends-sub 의 접속 상태 듣기 · 한 번 읽기 · 다시 묻기도 포트로');
    chk(/const friendsPresenceRtMod = TwFriendsPresenceRt\.createFriendsPresenceRt\(\{ rt: TwRtHub\.store \}\);/.test(a) && /const friendsPortMod = TwFriendsPort\.createFriendsPort\(\{\n  presence: friendsPresenceRtMod,\n  api: friendsApiMod,\n\}\);/.test(a),
      'app.js — 포트는 realtime provider(접속 상태) · 서버 provider 둘만 받는다(옛 경로 · 받는 곳 고르기 · 진단 줄 없음)');
    chk(/const socialApiMod = TwSocialApi\.createSocialApi\(\{ authed: TwApi\.authed,[^\n]*\n/.test(a) && /const friendsApiMod = TwFriendsApi\.createFriendsApi\(\{\n  social: socialApiMod,\n  rt: TwRtHub\.store,/.test(a), '  ↳ 서버 provider 가 서버 경로(social-api.js — 로그인 API 통로 TwApi.authed) · realtime 알림 걸기를 받는다');
    const fi = strip(S.FI);
    chk(/window\.TwApi\.bindToken\(_getIdToken\);/.test(fi) && !/apiGetAuthed|_authApi/.test(fi),
      '  ↳ firebase-init — 로그인 API 통로(api-client.js authed)에 Firebase ID 토큰만 잇는다 · 따로 부르는 길(apiGetAuthed)은 없다');
    chk(/  listFriends: \(\.\.\.a\)=>friendsPortMod\.listFriends\(\.\.\.a\),/.test(a), '  ↳ friends-sub 의 이름 받기(listFriends)도 포트로');
    chk(/  readFriend: \(\.\.\.a\)=>friendsPortMod\.readFriend\(\.\.\.a\),/.test(a), '  ↳ friends-sub 의 새 친구 한 명 받기(readFriend)도 포트로');
    chk(!/firebaseAPI\.removeFriend/.test(a) && /  removeFriend: \(\.\.\.a\)=>friendsPortMod\.removeFriend\(\.\.\.a\),/.test(a), '  ↳ 끊기도 포트로 — 화면은 firebaseAPI 를 안 부른다');
    chk(/  subscribe: \(\.\.\.a\)=>friendsPortMod\.watchList\(\.\.\.a\),\n  fetchOnce: \(id\)=>friendsPortMod\.listFriends\(id, \{ idsOnly:true \}\),/.test(a), '  ↳ friends-sub 의 subscribe · fetchOnce 는 포트로');
    const iR = a.indexOf('const friendsPresenceRtMod'), iA = a.indexOf('const friendsApiMod'), iP = a.indexOf('const friendsPortMod'), iS = a.indexOf('const friendsSubMod');
    chk(iA > 0 && iR > 0 && iP > iA && iP > iR && iS > iP, '  ↳ 만드는 순서 provider(api · realtime) → 포트 → friends-sub');
    const h = S.HTML;
    const hF = h.indexOf('<script src="parts/friends/friends-firebase.js">'), hS = h.indexOf('source-switch.js'), hP = h.indexOf('<script src="parts/friends/friends-port.js">'), hA = h.indexOf('<script src="parts/app.js">'),
      hI = h.indexOf('<script src="parts/friends/friends-api.js">'), hR = h.indexOf('<script src="parts/friends/friends-presence-rt.js">'), hH = h.indexOf('<script src="parts/realtime/rt-hub.js">'), hC = h.indexOf('<script src="parts/shared/api-client.js">');
    chk(hF < 0 && hS < 0 && hP > 0 && hI > 0 && hP < hA && hI < hA && hR > hH && hH > 0 && hR < hP && hC > 0 && hC < hA, 'html — 옛 경로 provider(friends-firebase.js) · source-switch.js 는 없고 friends-api.js · friends-presence-rt.js(rt-hub.js 다음) · friends-port.js(· api-client.js)를 app.js 보다 먼저 싣는다');
    chk(!/firebaseAPI|firebase-init|\bref\(db|onValue\(/.test(strip(S.PORT)) && !/firebaseAPI|firebase-init|\bref\(db|onValue\(/.test(strip(S.PRT)) && !/firebaseAPI|\bref\(db|onValue\(|\bfetch\(/.test(strip(S.FAPI)),
      'friends/ 파일은 firebaseAPI · SDK 를 직접 안 부른다(deps 로만)');
    chk(!/firebaseAPI|firebase-init|getIdToken|currentUser/.test(strip(S.AC)), 'shared/api-client.js 는 Firebase 를 모른다(토큰은 getToken deps 로만)');
    const bad = ALL_JS.filter(([f, src]) => f !== 'firebase-init.js' && f !== 'app.js'
      && FRIEND_FB_FNS.some(n => new RegExp('firebaseAPI\\s*\\.\\s*' + n + '\\b').test(strip(src))));
    chk(!bad.length, '화면 · 도메인 파일이 친구 데이터 firebaseAPI 함수(' + FRIEND_FB_FNS.join(' · ') + ')를 직접 안 부른다' + (bad.length ? ' — ' + bad.map(b => b[0]).join(' · ') : ''));
    /* 🗂️ 방 로비 provider 도 로그인 통로(apiGetAuthed)를 쓴다 — 친구 provider 몫이 아니라 빼고 센다 */
    const aFriends = a
      .replace(/^const roomLobbyProvider = TwRoomLobbyProvider\.createRoomLobbyProvider\(.*$/m, '');
    const appCalls = (aFriends.match(/firebaseAPI\.(subscribeMyFriends|getMyFriendList|watchMyFriendList|getFriendCard|watchFriendProfile|getFriendProfile|apiGetAuthed)\(/g) || []).length;
    chk(appCalls === 0, '  ↳ app.js 도 친구 데이터 firebaseAPI 함수를 안 부른다 (' + appCalls + ')');
    chk(!/subscribeMyFriends/.test(strip(S.FI)) && !/subscribeMyFriends/.test(a), '  ↳ 친구별 4개 구독(subscribeMyFriends)은 어디에도 없다');
  }
}

(async () => {
await judge(SRC0);

say('── 4. mutation test — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PORT', 'apiProvider.listFriends(myId, opts || {})', 'apiProvider.listFriends(myId, {})', 'opts 를 버림'],
  ['PORT', 'watchList(myId, onChange, onError); }\n  /* 접속 상태는', 'watchList(myId, onChange); }\n  /* 접속 상태는', '에러 콜백을 안 넘김'],
  ['PORT', 'return presence.watchPresence(ids, onChange, onStatus);', 'presence.watchPresence(ids, onChange, onStatus);', '접속 상태 해제 함수를 안 돌려줌'],
  ['PORT', 'return presence.readPresence(ids);', 'return apiProvider.readPresence(ids);', '접속 상태 읽기가 서버 provider 로 감'],
  ['APP', '  subscribe: (...a)=>friendsPortMod.watchList(...a),', '  subscribe: (...a)=>firebaseAPI.subscribeMyFriends(...a),', 'friends-sub 가 포트를 건너뜀'],
  ['FI', "  window.TwApi.bindToken(_getIdToken);\n", "", '로그인 통로에 토큰을 안 이음'],
  ['RC', "  inviteGate: true,\n", "  inviteGate: true,\n  friendsApi: false,\n", '원격 설정에 친구 스위치가 되살아남'],
  ['FAPI', "    const cards = idsOnly ? {} : await social.fetchCards(list.map((f) => f.userCode));", "    const cards = await social.fetchCards(list.map((f) => f.userCode));", '판정용인데 명함까지 받음'],
  ['FAPI', "    if(!(await social.fetchFriend(fid))) return null;", "", '친구가 아닌데 명함을 줌'],
  ['FAPI', "      if(flying){ again = true; return; }", "      if(flying){ return; }", '받는 중 알림을 버림(마지막 알림이 안 맞음)'],
  ['FAPI', "    const off = rt.on('friends', () => { w.run(); });", "    const off = { call(){} }.call;", '목록 알림을 안 걸음'],
  ['FAPI', "    return () => { w.stop(); off(); };\n  }\n\n  function watchProfile", "    return () => { };\n  }\n\n  function watchProfile", '목록 듣기를 풀어도 알림이 남음'],
  ['FAPI', "if(n && typeof n.subject === 'string' && want.has(n.subject))", "if(n && typeof n.subject === 'string')", '남의 명함 알림에도 받음'],
  ['FAPI', "      if(n && n.resync) return all();\n", "", '오래 끊긴 뒤 다시 받기를 안 함'],
  ['FAPI', "    catch(e){ if(!(e && e.code === 'SOCIAL_NOT_FRIEND')) throw e; }", "    catch(e){ throw e; }", '이미 친구가 아닌 끊기를 실패로 봄'],
  ['FAPI', "return { name: card.name, level", "return { name: card.name || '(이름 없음)', level", '이름이 비면 자리표시를 다시 만듦'],
  ['FAPI', "    if(!card){ const e = new Error('명함 없음'); e.code = 'NO_CARD'; throw e; }", "", '명함 없는데 던지지 않음'],
  ['PORT', "function readFriend(fid){ return apiProvider.readFriend(fid); }", "function readFriend(fid){ return null; }", '친구 한 명은 서버를 안 봄'],
  ['PORT', "function removeFriend(myId, fid){ return apiProvider.removeFriend(fid); }", "async function removeFriend(myId, fid){ try{ return await apiProvider.removeFriend(fid); }catch(e){ return undefined; } }", '끊기 실패를 삼킴'],
  ['PORT', "function listFriends(myId, opts){ return apiProvider.listFriends(myId, opts || {}); }", "async function listFriends(myId, opts){ try{ return await apiProvider.listFriends(myId, opts || {}); }catch(e){ return {}; } }", '목록을 못 받으면 빈 목록으로 삼킴'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  /* 망가뜨린 글이 판정을 영영 기다리게 만들 수 있다(예: 토큰 받기가 멈춤) — 끝나지 않은 약속만 남으면 node 가 0 으로 조용히 끝나
     초록처럼 보인다. 3초 안에 안 끝나면 «멈춤» 으로 잡은 것으로 센다. */
  let _hung = false;
  try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { _hung = true; r(); }, 3000))]); }catch(_){ qfail++; }
  if(_hung) qfail++;
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
