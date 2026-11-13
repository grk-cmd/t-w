/* ═══ 👥 sim-social-api.js — 친구 · 친구 요청 · 명함 api provider (0.13 앱 묶음 D3 친구 목록 1) ═══
   [왜] 친구 목록 · 요청 · 명함을 Firebase 대신 우리 서버 공개 API(/v1/me/friends · /v1/me/friend-requests · /v1/myhomes/cards)로 받는다.
     서버 모양(userCode · ISO 시각 · displayName · cycle …)을 화면 모양으로 맞추는 곳 · 쓰기를 토큰 주인과 묶는 곳이 provider 하나라 실제로 불러서 판정한다.
   ・1절: 친구 목록 — 객체 배열 → 같은 차례 · 시각 ms · 마지막 접속 없음 = null · 빈 목록 ≠ 못 읽음 · 깨진 줄 · 겹친 코드 뺌 · 모양 틀림 던짐
   ・2절: 친구 한 명 · 끊기 — 친구가 아니면 null(실패와 다름) · 그 밖 실패는 던짐 · 끊기 경로
   ・3절: 친구 요청 — 목록 모양 · 보내기 본문 { to } 만(내 코드 · 이름 없음) · 수락 · 거절 · 취소 경로
   ・4절: 명함 — 화면 칸 이름 · 이름 없음은 '' 그대로 · 레벨 거르기 · 빈 목록 요청 0 · 겹침 하나로 · 100 · 101 · 250 나눠 묻기 · 한 조각 실패면 던짐
   ・5절: 주인 묶기 — 읽기 전 쓰기는 요청 0 · 진짜 api-client 위에서 토큰 주인이 바뀌면 요청 0 · reset 뒤 요청 0 · 명함 · 친구 한 명 읽기는 주인을 남기지 않음
   ・6절: 오류 갈래(failOf — 진짜 api-errors.js 의 translate 로)
   ・7절: 배선 — html · smoke 순서 · Firebase · 다시 묻기 타이머를 부르지 않음
   ・8절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['social-api.js', 'parts/friends/social-api.js', 'app/parts/friends/social-api.js']),
  AC: pick(['api-client.js', 'parts/shared/api-client.js', 'app/parts/shared/api-client.js']),
  AE: pick(['api-errors.js', 'parts/shared/api-errors.js', 'app/parts/shared/api-errors.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwSocialApi; };
const loadMod = (src) => { const mod = { exports: {} }; new Function('module', 'window', src)(mod, undefined); return mod.exports; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code, message) => Object.assign(new Error(message || code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });   // api-client 와 같은 kind
const T1 = '2026-11-01T00:00:00Z', T2 = '2026-11-10T09:30:00Z';
const fr = (code, o) => Object.assign({ userCode: code, addedAt: T1, lastSeenAt: T2 }, o || {});
const card = (code, o) => Object.assign({ userCode: code, displayName: '이름' + code, avatarUrl: 'https://img/' + code + '.png', bio: '소개' + code, level: 3, cycle: 1, cycleLevel: 2, starColor: '#ffcc00' }, o || {});
const ME_ROUTES = () => ({ 'GET /v1/me/friends': [], 'GET /v1/me/friend-requests': { received: [], sent: [] } });

/* 가짜 authed — 부른 것을 적고, 길마다 정한 답을 낸다 */
function fake(routes){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    if(opts && typeof opts.onOwner === 'function') opts.onOwner('ME');   // 진짜 통로처럼 읽을 때 토큰 주인을 알린다
    const key = method + ' ' + path.split('?')[0];
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path, opts) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
const mk = (src, routes) => {
  const authed = fake(Object.assign(ME_ROUTES(), routes || {})), warns = [];
  const m = load(src).createSocialApi({ authed, warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, warns };
};
const throws = async (fn) => { try{ await fn(); return null; }catch(e){ return e || {}; } };
const codesIn = (path) => (path.split('codes=')[1] || '').split(',').filter(Boolean).map(decodeURIComponent);

async function judge(S){
  const LIB = S.API;
  const G = load(LIB);

  say('── 1. 친구 목록');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/me/friends': [fr('B'), fr('A', { lastSeenAt: null })] });
    const r = await m.fetchFriends();
    const g = authed.log[0];
    chk(g.method === 'GET' && g.path === '/v1/me/friends' && g.opts.auth === true && typeof g.opts.onOwner === 'function', 'GET /v1/me/friends · 로그인 통로 · 토큰 주인을 듣는다');
    chk(r.length === 2 && r[0].userCode === 'B' && r[1].userCode === 'A', '서버 차례(오래 사귄 순) 그대로');
    chk(r[0].addedAt === Date.parse(T1) && r[0].lastSeenAt === Date.parse(T2), '  시각은 ISO → ms');
    chk(r[1].lastSeenAt === null, '  마지막 접속 기록 없음 = null(0 으로 꾸미지 않는다)');
    chk(Object.keys(r[0]).sort().join() === 'addedAt,lastSeenAt,userCode', '  줄 모양 = { userCode, addedAt, lastSeenAt }');
    const empty = await mk(LIB).m.fetchFriends();
    chk(Array.isArray(empty) && empty.length === 0, '친구 없음 → 빈 배열 — «없음» 이지 실패가 아니다');
    const down = await throws(() => mk(LIB, { 'GET /v1/me/friends': apiErr(503, '') }).m.fetchFriends());
    chk(down && down.status === 503, '못 읽으면 던진다(빈 목록으로 숨기지 않는다)');
    for(const bad of [null, {}, { friends: [] }, 'x']){
      const e = await throws(() => mk(LIB, { 'GET /v1/me/friends': bad }).m.fetchFriends());
      chk(e && e.code === 'SHAPE', '배열이 아닌 응답(' + JSON.stringify(bad) + ')은 던진다 — 옛 모양 { friends:[…] } 도');
    }
    const messy = await mk(LIB, { 'GET /v1/me/friends': [fr('A'), null, { userCode: '' , addedAt: T1 }, fr('C', { addedAt: 'x' }), fr('A'), fr('D', { lastSeenAt: '모름' })] }).m.fetchFriends();
    chk(messy.map((f) => f.userCode).join() === 'A,D', '깨진 줄(코드 없음 · 친구가 된 시각 못 읽음) · 겹친 코드는 뺀다');
    chk(messy[1].lastSeenAt === null, '  못 읽는 마지막 접속은 null');
  }

  say('── 2. 친구 한 명 · 끊기');
  {
    const one = mk(LIB, { 'GET /v1/me/friends/F%2F1': fr('F/1') });
    const r = await one.m.fetchFriend('F/1');
    chk(r && r.userCode === 'F/1' && one.authed.log[0].path === '/v1/me/friends/F%2F1' && one.authed.log[0].opts.auth === true, 'GET /v1/me/friends/{code}(경로에 인코딩)');
    const nf = mk(LIB, { 'GET /v1/me/friends/X': apiErr(404, 'SOCIAL_NOT_FRIEND') });
    chk((await nf.m.fetchFriend('X')) === null, '친구가 아니면 null(요청 중 · 나 · 없는 사람)');
    const down = await throws(() => mk(LIB, { 'GET /v1/me/friends/X': apiErr(503, '') }).m.fetchFriend('X'));
    chk(down && down.status === 503, '  그 밖 실패는 던진다(null 과 다름)');
    const sh = await throws(() => mk(LIB, { 'GET /v1/me/friends/X': { userCode: 'X' } }).m.fetchFriend('X'));
    chk(sh && sh.code === 'SHAPE', '  모양이 틀리면 던진다');
    const nc = mk(LIB);
    chk((await throws(() => nc.m.fetchFriend(''))).code === 'NO_USER' && nc.authed.log.length === 0, '  코드가 없으면 요청 0 으로 던진다');

    const rm = mk(LIB, { 'DELETE /v1/me/friends/F%2F1': null });
    await rm.m.fetchFriends();
    await rm.m.removeFriend('F/1');
    const d = rm.authed.log.find((x) => x.method === 'DELETE');
    chk(d && d.path === '/v1/me/friends/F%2F1' && d.opts && 'expectOwner' in d.opts, '끊기 — DELETE /v1/me/friends/{code} · 읽은 주인과 묶음');
  }

  say('── 3. 친구 요청');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/me/friend-requests': { received: [{ userCode: 'A', requestedAt: '2026-11-01T00:00:00Z' }, { userCode: 'B', requestedAt: '2026-11-02T00:00:00Z' }, { userCode: 'A', requestedAt: '2026-11-03T00:00:00Z' }, 'x', { userCode: '', requestedAt: '2026-11-01T00:00:00Z' }, { userCode: 'D' }], sent: [{ userCode: 'C', requestedAt: '2026-11-04T00:00:00Z' }] } });
    const r = await m.fetchRequests();
    chk(authed.log[0].path === '/v1/me/friend-requests' && typeof authed.log[0].opts.onOwner === 'function', 'GET /v1/me/friend-requests · 토큰 주인을 듣는다');
    chk(r.received.map((x) => x.userCode).join() === 'A,B' && r.received[0].requestedAt === Date.parse('2026-11-01T00:00:00Z') && r.sent[0].userCode === 'C', '{ received, sent } — 차례 그대로 · 시각 ms · 겹침 · 깨진 줄(코드 · 시각 없음) 뺌');
    for(const bad of [null, { received: [] }, { received: 'A', sent: [] }]){
      const e = await throws(() => mk(LIB, { 'GET /v1/me/friend-requests': bad }).m.fetchRequests());
      chk(e && e.code === 'SHAPE', '모양이 틀린 응답(' + JSON.stringify(bad) + ')은 던진다');
    }
    const down = await throws(() => mk(LIB, { 'GET /v1/me/friend-requests': apiErr(503, '') }).m.fetchRequests());
    chk(down && down.status === 503, '못 읽으면 던진다');

    const w = mk(LIB, { 'POST /v1/me/friend-requests': null, 'POST /v1/me/friend-requests/A%20B/accept': null, 'POST /v1/me/friend-requests/A%20B/reject': null, 'DELETE /v1/me/friend-requests/C': null });
    await w.m.fetchRequests();
    await w.m.sendRequest('A B');
    await w.m.acceptRequest('A B');
    await w.m.rejectRequest('A B');
    await w.m.cancelRequest('C');
    const writes = w.authed.log.filter((x) => x.method !== 'GET');
    chk(writes.length === 4 && writes.every((x) => x.opts && 'expectOwner' in x.opts), '쓰기 넷 모두 읽은 주인과 묶음');
    chk(writes[0].path === '/v1/me/friend-requests' && JSON.stringify(writes[0].body) === '{"to":"A B"}', '보내기 — POST /v1/me/friend-requests { to } 만(내 코드 · 이름을 싣지 않는다)');
    chk(writes[1].path === '/v1/me/friend-requests/A%20B/accept' && writes[2].path === '/v1/me/friend-requests/A%20B/reject', '수락 · 거절 — POST …/{from}/accept · reject(경로에 인코딩)');
    chk(writes[3].method === 'DELETE' && writes[3].path === '/v1/me/friend-requests/C', '취소 — DELETE …/{to}');
    const nc = mk(LIB);
    await nc.m.fetchRequests();
    for(const f of ['sendRequest', 'acceptRequest', 'rejectRequest', 'cancelRequest', 'removeFriend']){
      chk((await throws(() => nc.m[f](''))).code === 'NO_USER', '  ' + f + ' — 코드가 없으면 던진다');
    }
    chk(nc.authed.log.length === 1, '  그때 요청 0');
    const full = mk(LIB, { 'POST /v1/me/friend-requests/A/accept': apiErr(409, 'SOCIAL_FRIEND_FULL', '100명') });
    await full.m.fetchRequests();
    const fe = await throws(() => full.m.acceptRequest('A'));
    chk(fe && fe.code === 'SOCIAL_FRIEND_FULL' && full.authed.log.filter((x) => x.method === 'POST').length === 1, '실패는 한 번에 던진다 — 다시 보내지 않는다');
  }

  say('── 4. 명함');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/myhomes/cards': { cards: [card('A'), card('B', { displayName: '', avatarUrl: null, bio: null, level: 0 })] } });
    const r = await m.fetchCards(['A', 'B']);
    const g = authed.log[0];
    chk(g.path === '/v1/myhomes/cards?codes=A,B' && g.opts.auth === true, 'GET /v1/myhomes/cards?codes=a,b · 로그인 통로');
    chk(typeof g.opts.onOwner !== 'function', '  명함 읽기는 토큰 주인을 남기지 않는다(내 것이 아님)');
    chk(JSON.stringify(r.A) === JSON.stringify({ name: '이름A', avatar: 'https://img/A.png', bio: '소개A', level: 3, cyc: 1, clv: 2, starC: '#ffcc00' }),
      '명함 → 친구 칸 이름 { name, avatar, bio, level, cyc, clv, starC }');
    chk(r.B.name === '' && r.B.avatar === null && r.B.bio === '' && r.B.level === null, '  이름 없음은 \'\' 그대로(자리표시는 화면 몫) · 사진 없음 null · 레벨 0 → null(배지 숨김)');
    const none = mk(LIB);
    chk(JSON.stringify(await none.m.fetchCards([])) === '{}' && JSON.stringify(await none.m.fetchCards(['', null])) === '{}' && none.authed.log.length === 0, '빈 목록 · 빈 코드만 → 요청 0 · {}');
    const dup = mk(LIB, { 'GET /v1/myhomes/cards': (b, p) => ({ cards: codesIn(p).map((c) => card(c)) }) });
    await dup.m.fetchCards(['A', 'A', 'B']);
    chk(dup.authed.log.length === 1 && codesIn(dup.authed.log[0].path).join() === 'A,B', '겹친 코드는 하나로');
    chk(codesIn(G.PATHS.cards(['a,b', 'c d'])).length === 2 && G.PATHS.cards(['a,b']) === '/v1/myhomes/cards?codes=a%2Cb', '  코드 안의 쉼표 · 공백은 인코딩(나누는 쉼표와 섞이지 않게)');
    for(const n of [100, 101, 250]){
      const codes = Array.from({ length: n }, (_, i) => 'U' + i);
      const t = mk(LIB, { 'GET /v1/myhomes/cards': (b, p) => ({ cards: codesIn(p).map((c) => card(c)) }) });
      const out = await t.m.fetchCards(codes);
      const sizes = t.authed.log.map((x) => codesIn(x.path).length);
      chk(sizes.length === Math.ceil(n / 100) && sizes.every((s) => s <= 100) && Object.keys(out).length === n, n + '명 → ' + Math.ceil(n / 100) + '번(한 번에 100개 이하) · 다 합침');
    }
    let k = 0;
    const half = mk(LIB, { 'GET /v1/myhomes/cards': (b, p) => (k++ === 1 ? apiErr(503, '') : { cards: codesIn(p).map((c) => card(c)) }) });
    const he = await throws(() => half.m.fetchCards(Array.from({ length: 150 }, (_, i) => 'U' + i)));
    chk(he && he.status === 503, '한 조각이라도 못 받으면 던진다(반쪽 명함을 «다 받음» 으로 안 줌)');
    const miss = await mk(LIB, { 'GET /v1/myhomes/cards': { cards: [card('A'), { displayName: 'x' }, null] } }).m.fetchCards(['A', 'Z']);
    chk(Object.keys(miss).join() === 'A', '없는 코드 · 깨진 장은 빠진다(«모름»)');
    for(const bad of [null, [], { cards: 'x' }]){
      const e = await throws(() => mk(LIB, { 'GET /v1/myhomes/cards': bad }).m.fetchCards(['A']));
      chk(e && e.code === 'SHAPE', '모양이 틀린 응답(' + JSON.stringify(bad) + ')은 던진다');
    }
  }

  say('── 5. 주인 묶기');
  {
    const AC = loadMod(S.AC);
    const jwt = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
    const reply = (status, data) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => ({ success: true, data }) });
    const calls = [], tk = { v: jwt('A') };
    const client = AC.createApiClient({ baseUrl: 'https://api.test', getToken: async () => tk.v,
      fetch: async (url, init) => { calls.push(init.method + ' ' + url); return reply(200, url.endsWith('/v1/me/friends') ? [] : url.indexOf('/v1/myhomes/cards') >= 0 ? { cards: [] } : url.indexOf('/v1/me/friends/') >= 0 ? fr('F') : null); } });
    const m = load(S.API).createSocialApi({ authed: client, warn: () => {} });
    await m.fetchCards(['F']);
    await m.fetchFriend('F');
    chk((await throws(() => m.removeFriend('F'))).code === 'NOT_RECEIVED' && calls.length === 2, '명함 · 친구 한 명 읽기는 주인을 남기지 않는다 — 내 목록을 받기 전 쓰기는 요청 0');
    await m.fetchFriends();
    await m.sendRequest('F');
    chk(calls.length === 4, '같은 계정이면 보낸다');
    tk.v = jwt('B');
    const oc = await throws(() => m.acceptRequest('F'));
    chk(oc && oc.code === 'OWNER_CHANGED' && calls.length === 4, '읽은 뒤 토큰 주인이 바뀌면 요청 0 · OWNER_CHANGED — 앞 계정 화면의 누름이 새 계정으로 나가지 않는다');
    chk((await throws(() => m.cancelRequest('F'))).code === 'NOT_RECEIVED' && calls.length === 4, '  그 뒤엔 다시 읽기 전까지 계속 안 보낸다');
    await m.fetchFriends();
    await m.rejectRequest('F');
    chk(calls.length === 6, '  새 계정으로 다시 읽으면 그 계정으로 보낸다');
    m.reset();
    chk((await throws(() => m.sendRequest('F'))).code === 'NOT_RECEIVED' && calls.length === 6, 'reset 뒤엔 다시 읽기 전까지 요청 0');
    let release;
    const slow = fake(Object.assign(ME_ROUTES(), { 'GET /v1/me/friend-requests': (b, p, o) => new Promise((res) => { release = () => { o.onOwner('A'); res({ received: [], sent: [] }); }; }), 'POST /v1/me/friend-requests': null }));
    const sm = load(S.API).createSocialApi({ authed: slow, warn: () => {} });
    const pending = sm.fetchRequests();
    sm.reset();
    release(); await pending;
    chk((await throws(() => sm.sendRequest('F'))).code === 'NOT_RECEIVED' && !slow.log.some((x) => x.method === 'POST'), '  reset 전에 떠난 읽기 답은 주인을 되살리지 않는다(요청 0)');
  }

  say('── 6. 오류 갈래');
  {
    const AE = loadMod(S.AE);
    const k = (e) => G.failOf(e, AE).kind;
    for(const [c, st] of [['SOCIAL_SELF', 400], ['SOCIAL_ALREADY_FRIEND', 409], ['SOCIAL_FRIEND_FULL', 409]]) chk(k(apiErr(st, c)) === 'guide', c + '(' + st + ') → guide(서버 문구 안내 · 번호 없음)');
    chk(G.failOf(apiErr(409, 'SOCIAL_FRIEND_FULL', '친구가 100명이에요'), AE).message === '친구가 100명이에요', '  안내는 서버 문구를 그대로 돌려준다');
    for(const c of ['SOCIAL_REQUEST_NOT_FOUND', 'SOCIAL_NOT_FRIEND']) chk(k(apiErr(404, c)) === 'gone', c + ' → gone(이미 없음 — 안내 + 목록 다시 받기)');
    chk(k(apiErr(404, 'USER_NOT_FOUND')) === 'missing', 'USER_NOT_FOUND → missing(그 사람이 없음)');
    chk(k({ code: 'SHAPE' }) === 'site' && k({ code: 'NO_USER' }) === 'site', 'SHAPE · NO_USER → site(그 자리 E-FR 번호)');
    chk(k(apiErr(503, '')) === 'site' && k(Object.assign(new Error('x'), { kind: 'unavailable' })) === 'site' && k(apiErr(400, 'SOMETHING_NEW')) === 'site', '닿지 못함 · 모르는 코드 → site');
    chk(k(apiErr(401, 'AUTH_REQUIRED')) === 'common' && k(apiErr(429, 'TOO_MANY_REQUESTS')) === 'common' && k(apiErr(400, 'INVALID_REQUEST')) === 'common', '공통 코드 → common(apiErrors.notify — E-NET 표)');
    chk(k({ code: 'OWNER_CHANGED' }) === 'stale' && k({ code: 'NOT_RECEIVED' }) === 'stale', 'OWNER_CHANGED · NOT_RECEIVED → stale(조용히 버림)');
    chk(Object.keys(G.ERRORS).every((c) => G.ERRORS[c].notice === null), '기능 표는 번호를 정하지 않는다(번호는 그 자리가)');
  }

  say('── 7. 배선');
  {
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    const i = tag('friends/social-api.js'), c = tag('shared/api-client.js'), a = tag('app.js');
    chk(i > 0 && a > i && c > 0 && c < i, 'html — social-api.js 가 api-client.js 다음 · app.js 보다 먼저');
    chk(/PRELOAD\.push\('social-api\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 social-api.js');
    const code = strip(S.API);
    chk(!/firebase|firebaseAPI|localStorage/.test(code), 'provider 는 Firebase · 로컬 저장을 부르지 않는다');
    chk(!/setTimeout|setInterval/.test(code), '다시 묻기 타이머가 없다(자동 다시 시도 안 함)');
    chk(!/이름 없음/.test(code), '«(이름 없음)» 자리표시를 새로 만들지 않는다(화면 한 곳 몫)');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 8. 일부러 깨 보기');
  const breaks = [
    ['보내기 본문에 내 코드를 실음', S.API.replace("authed.post(PATHS.requests, { to: c }, o)", "authed.post(PATHS.requests, { to: c, from: 'ME' }, o)"), '본문'],
    ['쓰기가 주인을 안 묶음', S.API.replace("try{ return await send({ expectOwner: owner }); }", "try{ return await send({}); }"), 'expectOwner'],
    ['읽기 전에도 보냄', S.API.replace("if(owner === undefined) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');", ""), '요청 0'],
    ['reset 이 늦은 읽기를 안 막음', S.API.replace("if(at === epoch) owner = who;", "owner = who;"), 'reset'],
    ['못 읽음을 빈 목록으로', S.API.replace("fetchFriends: async () => need(friendsOf(await readMine(PATHS.friends))),", "fetchFriends: async () => { try{ return need(friendsOf(await readMine(PATHS.friends))); }catch(_){ return []; } },"), '던진다'],
    ['친구 아님 말고도 null', S.API.replace("catch(e){ if(e && e.code === NOT_FRIEND_CODE) return null; throw e; }", "catch(e){ return null; }"), 'null 과 다름'],
    ['옛 모양 { friends } 를 받음', S.API.replace("if(!Array.isArray(d)) return undefined;", "if(isObj(d) && Array.isArray(d.friends)) d = d.friends; if(!Array.isArray(d)) return undefined;"), '옛 모양'],
    ['마지막 접속 없음을 0 으로', S.API.replace("lastSeenAt: msOrNull(raw.lastSeenAt) };", "lastSeenAt: msOrNull(raw.lastSeenAt) || 0 };"), 'null'],
    ['시각을 ms 로 안 바꿈', S.API.replace("return { userCode: raw.userCode, addedAt, lastSeenAt", "return { userCode: raw.userCode, addedAt: raw.addedAt, lastSeenAt"), 'ms'],
    ['겹친 친구를 그대로', S.API.replace("if(!f || seen.has(f.userCode)) continue;", "if(!f) continue;"), '겹친 코드'],
    ['명함을 나누지 않음', S.API.replace("const LIMITS = Object.freeze({ CARD_CODES: 100 });", "const LIMITS = Object.freeze({ CARD_CODES: 1000 });"), '100개 이하'],
    ['빈 명함 목록에도 요청', S.API.replace("const list = codesOf(Array.isArray(codes) ? codes : []);", "const list = codesOf(Array.isArray(codes) ? codes : []); if(!list.length) await authed.get(PATHS.cards([]), { auth: true });"), '요청 0'],
    ['반쪽 명함을 다 받음으로', S.API.replace("map(async (part) => need(cardsOf(await authed.get(PATHS.cards(part), { auth: true })))));", "map(async (part) => { try{ return need(cardsOf(await authed.get(PATHS.cards(part), { auth: true }))); }catch(_){ return {}; } }));"), '한 조각'],
    ['이름 없음을 자리표시로', S.API.replace("name: str(c.displayName),", "name: str(c.displayName) || '(이름 없음)',"), '자리표시'],
    ['레벨 0 을 배지로', S.API.replace("(typeof c.level === 'number' && c.level >= 1) ? c.level : null", "(typeof c.level === 'number') ? c.level : null"), '배지 숨김'],
    ['코드를 인코딩 안 함', S.API.replace("const enc = (c) => encodeURIComponent(c);", "const enc = (c) => c;"), '인코딩'],
    ['닿지 못함을 공통으로', S.API.replace("else kind = KIND.SITE;", "else kind = KIND.COMMON;"), 'site'],
    ['명함 읽기가 주인을 남김', S.API.replace("need(cardsOf(await authed.get(PATHS.cards(part), { auth: true })))", "need(cardsOf(await readMine(PATHS.cards(part))))"), '주인'],
  ];
  for(const [name, src, what] of breaks){
    if(src === S.API){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { API: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
