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
  RULES: pick(['firebase-database-rules.json']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
/* 화면 · 도메인 파일(스테이징 평면의 .js) — firebase-init.js · app.js(연결) 밖에서는 친구 데이터 firebaseAPI 함수를 안 부른다 */
const FRIEND_FB_FNS = ['subscribeMyFriends', 'getMyFriendList'];
const ALL_JS = fs.readdirSync('.').filter(f => f.endsWith('.js') && !/^sim-|^smoke\.js$|^run\.js$/.test(f)).map(f => [f, read(f) || '']);

const load = (src, name) => { const win = {}; new Function('window', 'module', 'console', src)(win, undefined, { warn(){}, log(){} }); return win[name]; };
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); };

async function judge(S){
  say('── 1. 포트 — provider 로 그대로');
  let P = null, F = null;
  try{ P = load(S.PORT, 'TwFriendsPort'); F = load(S.FBP, 'TwFriendsFirebase'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(P && typeof P.createFriendsPort === 'function' && F && typeof F.createFriendsFirebase === 'function', '전역 이름 TwFriendsPort · TwFriendsFirebase');
  {
    const log = [];
    const un = () => log.push('un');
    const fake = {
      listFriends: async (id, o) => { log.push(['list', id, o]); return { f1: { addedAt: 1 } }; },
      watchList: (id, ok, err) => { log.push(['watch', id, typeof ok, typeof err]); return un; },
      watchPresence: (id, ids, ok) => { log.push(['pres', id, ids.join(), typeof ok]); return un; },
    };
    const port = P.createFriendsPort({ firebase: fake, api: null, apiOn: () => true, warn(){} });
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
    chk(P.pickListSource(true, true) === 'api' && P.pickListSource(undefined, true) === 'api' && P.pickListSource(null, true) === 'api',
      'pickListSource(순수) — 스위치가 켜졌거나 값이 없으면 api');
    chk(P.pickListSource(false, true) === 'firebase' && P.pickListSource(true, false) === 'firebase', '  ↳ 끄면 · api provider 가 없으면 옛 길');
    const mkPort = (o) => {
      const L = { api: 0, fb: [], warn: 0 };
      const port = P.createFriendsPort({
        firebase: { listFriends: async (id, op) => { L.fb.push(op); return { f: { from: 'fb' } }; }, watchList(){}, watchPresence(){} },
        api: o.noApi ? null : { listFriends: async (id) => { L.api++; if(o.apiFail) throw Object.assign(new Error('x'), { status: 503 }); return { f: { from: 'api', id } }; } },
        apiOn: o.apiOn, warn: () => { L.warn++; },
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
    k = mkPort({ apiOn: () => true, noApi: true });
    v = await k.port.listFriends('ME');
    chk(v.f.from === 'fb', '  ↳ api provider 가 없으면 옛 길');
    chk(P.LIVE_SOURCE === 'firebase', '듣기(목록 · 접속 상태)는 아직 옛 길 — ws 자리(LIVE_SOURCE)');
  }

  say('── 2. firebase provider(옛 길)');
  {
    const reads = [], subs = [];
    const fb = F.createFriendsFirebase({
      getList: async (id) => { reads.push(id); return id === 'EMPTY' ? null : { f1: { addedAt: 5 } }; },
      watchAll: (id, ok, err) => { const s = { id, ok, err, on: true }; subs.push(s); return () => { s.on = false; }; },
    });
    const v = await fb.listFriends('ME', { idsOnly: true });
    chk(reads.join() === 'ME' && v.f1 && v.f1.addedAt === 5, 'listFriends — users/{나}/friends 한 번 읽기(getList) 그대로');
    chk(JSON.stringify(await fb.listFriends('EMPTY')) === '{}', '  ↳ 없으면 빈 목록({})');
    const got = [], errs = [];
    const off = fb.watchList('ME', (f) => got.push(f), (e) => errs.push(e));
    subs[0].ok({ f1: { name: 'A' } }); subs[0].err(new Error('x'));
    chk(subs.length === 1 && got.length === 1 && got[0].f1.name === 'A' && errs.length === 1, 'watchList — 옛 구독(watchAll)에 onChange · onError 그대로');
    off();
    chk(!subs[0].on, '  ↳ 해제 함수 그대로');
    const p = fb.watchPresence('ME', ['f1'], () => { throw new Error('부르면 안 됨'); });
    chk(typeof p === 'function' && subs.length === 1, 'watchPresence — 옛 길은 목록 구독이 접속 상태를 실어 와서 따로 걸지 않는다(빈 해제 함수)');
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
    chk(/const friendsFirebaseMod = TwFriendsFirebase\.createFriendsFirebase\(\{\n  getList: \(\.\.\.a\)=>firebaseAPI\.getMyFriendList\(\.\.\.a\),\n  watchAll: \(\.\.\.a\)=>firebaseAPI\.subscribeMyFriends\(\.\.\.a\),\n\}\);/.test(a),
      'app.js — firebase provider 가 firebaseAPI 를 deps 로 받는다(목록 한 번 · 옛 구독)');
    chk(/const friendsPortMod = TwFriendsPort\.createFriendsPort\(\{\n  firebase: friendsFirebaseMod,\n  api: friendsApiMod,\n  apiOn: \(\)=>\{ const s = acctStateMod\._rcStore\(\); return s \? s\.friendsApi\(\) : true; \},/.test(a), '  ↳ 포트가 provider 둘 · 스위치(원격 설정 friendsApi — 설정이 없으면 켜짐)를 받는다');
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
    chk(!/firebaseAPI|firebase/i.test(strip(S.AC).replace(/Firebase 길|Firebase 를 모른다|Firebase 요금|firebaseEnv/g, '')), 'shared/api-client.js 는 Firebase 를 모른다(토큰은 getToken deps 로만)');
    const bad = ALL_JS.filter(([f, src]) => f !== 'firebase-init.js' && f !== 'app.js'
      && FRIEND_FB_FNS.some(n => new RegExp('firebaseAPI\\s*\\.\\s*' + n + '\\b').test(strip(src))));
    chk(!bad.length, '화면 · 도메인 파일이 친구 데이터 firebaseAPI 함수(' + FRIEND_FB_FNS.join(' · ') + ')를 직접 안 부른다' + (bad.length ? ' — ' + bad.map(b => b[0]).join(' · ') : ''));
    const appCalls = (a.match(/firebaseAPI\.(subscribeMyFriends|getMyFriendList)\(/g) || []).length;
    chk(appCalls === 2, '  ↳ app.js 도 provider deps 두 줄에서만 (' + appCalls + ')');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PORT', 'await firebase.listFriends(myId, opts || {});', 'await firebase.listFriends(myId, {});', 'opts 를 버림'],
  ['PORT', 'return firebase.watchList(myId, onChange, onError);', 'return firebase.watchList(myId, onChange);', '에러 콜백을 안 넘김'],
  ['PORT', 'return firebase.watchPresence(myId, ids, onChange);', 'firebase.watchPresence(myId, ids, onChange);', '해제 함수를 안 돌려줌'],
  ['FBP', 'return (await getList(myId)) || {};', 'return await getList(myId);', '없을 때 null'],
  ['FBP', 'function watchPresence(){ return NOOP; }', 'function watchPresence(){ return null; }', '접속 상태 해제 함수 없음'],
  ['APP', '  subscribe: (...a)=>friendsPortMod.watchList(...a),', '  subscribe: (...a)=>firebaseAPI.subscribeMyFriends(...a),', 'friends-sub 가 포트를 건너뜀'],
  ['PORT', "  return (apiOn !== false && hasApi) ? SOURCE.API : SOURCE.FIREBASE;", "  return hasApi ? SOURCE.API : SOURCE.FIREBASE;", '스위치를 안 봄'],
  ['PORT', "  return (apiOn !== false && hasApi) ? SOURCE.API : SOURCE.FIREBASE;", "  return (apiOn === true && hasApi) ? SOURCE.API : SOURCE.FIREBASE;", '값이 없으면 꺼짐으로'],
  ['PORT', "        warn('[친구 목록] 서버에서 못 받음", "        throw e; warn('[친구 목록] 서버에서 못 받음", 'api 실패를 옛 길로 안 넘김'],
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
