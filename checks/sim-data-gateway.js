/* sim-data-gateway.js — 🚪 범용 데이터 통로(shared/data-gateway.js) 검사
   ・1절: 순수 판단 — matchRoute(표 · 별표 칸 · 모양 틀린 줄) · toServerPath(내 코드만 me) · pathOf · snapshotOf · parseSse
   ・2절: **표가 비면 지금과 똑같다** — 모든 기본 동작이 같은 SDK 함수를 같은 인자로 부르고 그 돌려준 값을 그대로 돌려준다(실제로 돌려 판정)
   ・3절: 표에 걸리면 서버로(POST 본문 · 주소에 매개변수 없음) — 내 코드는 me · 번역표(Firebase 로 / 오류로) · 조건(query) 본문 · 못 보내는 조건 · 로그인 없음 · update 섞임 · push · 듣기 두 단계 · 듣기 끊기면 다시 붙기
   ・4절: 연결 — firebase-init.js 가 SDK 기본 동작을 통로 뒤로만 부른다 · 다른 앱 파일은 Firebase DB 라이브러리를 안 부른다 · 원격 설정 칸 · 규칙 config/dataRoutes · html 차례 · smoke
   ・5절: 일부러 깨 보기 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  GW: pick(at('data-gateway.js', 'shared')),
  SS: pick(at('source-switch.js', 'shared')),
  RC: pick(at('remote-config.js', 'shared')),
  AC: pick(at('api-client.js', 'shared')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
  RULES: stripReadGate(pick(['firebase-database-rules.json'])),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src, name) => { const w = {}; new Function('window', 'module', 'console', src)(w, undefined, { warn(){}, log(){} }); return w[name]; };
const DB = 'https://x-default-rtdb.example.app/';
const fakeRef = (p) => ({ toString: () => DB + p, key: p.split('/').pop() });

/* 가짜 SDK — 부른 함수 · 인자 · 돌려준 값을 남긴다. 돌려주는 값은 부를 때마다 새 물건이라 «그대로 돌려줬나» 를 같음(===)으로 본다. */
function fakeSdk(){
  const calls = [];
  const mk = (name) => (...args) => { const ret = { from: name, n: calls.length }; calls.push({ name, args, ret }); if(name !== 'push') return ret; const key = 'k' + calls.length; const base = String(args[0] && args[0].toString()); return Object.assign(ret, { key, toString: () => base + '/' + key }); };
  return { calls, sdk: { get: mk('get'), set: mk('set'), update: mk('update'), remove: mk('remove'), push: mk('push'), onValue: mk('onValue') } };
}

/* 통로 하나 — 덮어쓸 deps 만 준다 */
const mkGw = (G, SS, F, o) => G.createDataGateway(Object.assign({ sdk: F.sdk, routes: () => [], myCode: () => 'u1', canServer: () => true,
  queryOf: (r) => (r && r.q !== undefined ? r.q : undefined), serverFirst: SS.serverFirst, post: () => Promise.resolve({}), stream: () => () => {}, notifyError(){}, warn(){} }, o || {}));
async function judge(S){
  const G = load(S.GW, 'TwDataGateway');
  const SS = load(S.SS, 'TwSourceSwitch');
  if(!G || !SS){ chk(false, '모듈을 못 만듦'); return; }

  say('── 1. 순수 판단');
  chk(G.matchRoute([], 'users/u1') === 'firebase' && G.matchRoute(null, 'users/u1') === 'firebase' && G.matchRoute(undefined, 'a') === 'firebase', 'matchRoute — 표가 비거나 없으면 Firebase');
  chk(G.matchRoute(['users/*/home'], 'users/u1/home/bg') === 'server' && G.matchRoute(['users/*/home'], 'users/u1/homeX') === 'firebase'
    && G.matchRoute(['users/*/home'], 'users/u1') === 'firebase' && G.matchRoute(['bugBoard'], 'bugBoard/list/x') === 'server',
    'matchRoute — 앞부분 칸마다 같거나 별표 · 칸 이름이 앞만 같으면 아님 · 표가 경로보다 길면 아님');
  chk(G.matchRoute(['users/$x', 'a//b', '', 7, '../x'], 'users/$x') === 'firebase', 'matchRoute — 모양 틀린 줄(특수 문자 · 빈 칸 · 글자 아님)은 건너뜀');
  chk(G.toServerPath('users/u12/home', 'u12') === 'users/me/home' && G.toServerPath('users/u123/home', 'u12') === 'users/u123/home'
    && G.toServerPath('users/u9/friends/u12', 'u12') === 'users/u9/friends/me' && G.toServerPath('users/u9/home', 'u12') === 'users/u9/home'
    && G.toServerPath('users/u12/home', null) === 'users/u12/home' && G.toServerPath('users/u12/home', '') === 'users/u12/home',
    'toServerPath — 내 코드와 글자 그대로 같은 칸만 me · 앞부분만 같은 코드 · 남의 코드 · 코드 없음은 그대로');
  chk(G.pathOf(fakeRef('users/u1/home')) === 'users/u1/home' && G.pathOf(fakeRef('a/%ED%95%9C')) === 'a/한' && G.pathOf(fakeRef('')) === '' && G.pathOf({ toString: () => 'zz' }) === null,
    'pathOf — 주소 몫을 떼고 풀어 쓴 경로 · 모르면 null');
  const sn = G.snapshotOf('home', { a: 1, b: { c: 2 } }), sn0 = G.snapshotOf('x', undefined);
  const keys = []; sn.forEach((c) => { keys.push(c.key + '=' + JSON.stringify(c.val())); });
  chk(sn.val().a === 1 && sn.exists() && sn.size === 2 && sn.child('b/c').val() === 2 && sn.hasChild('b') && !sn.hasChild('z') && keys.join() === 'a=1,b={"c":2}'
    && sn0.val() === null && !sn0.exists() && sn0.size === 0 && sn0.forEach(() => true) === false,
    'snapshotOf — val · exists · size · child · hasChild · forEach · 없는 값');
  const ps = G.parseSse('event: value\ndata: {"value":1}\n\ndata: hi\n\nevent: value\ndata: {"va');
  chk(ps.events.length === 2 && ps.events[0].event === 'value' && ps.events[0].data.value === 1 && ps.events[1].event === 'message' && ps.events[1].data === 'hi' && ps.rest === 'event: value\ndata: {"va',
    'parseSse — 사건 · JSON 풀기 · 남은 조각은 다음으로');

  say('── 2. 표가 비면 지금과 똑같다(같은 SDK 함수 · 같은 인자 · 같은 돌려준 값)');
  {
    const F = fakeSdk(); const posts = [];
    const gw = mkGw(G, SS, F, { post: (u, b) => { posts.push(b); return Promise.resolve({}); }, stream: () => { posts.push('stream'); return () => {}; } });
    const r = fakeRef('users/u1/home'), cb = () => {}, cancel = () => {}, v = { a: 1 };
    const q = Object.assign(fakeRef('users/u1/home'), { q: { ref: fakeRef('users/u1/home'), query: { limitToLast: 3 } } });
    const outs = [gw.get(r, 'more'), gw.set(r, v, 'more'), gw.update(fakeRef(''), { 'users/u1/x': 1 }), gw.remove(r), gw.push(r, v), gw.push(r), gw.onValue(r, cb, cancel, { onlyOnce: true }), gw.get(q)];
    const want = [['get', [r, 'more']], ['set', [r, v, 'more']], ['update', [null, null]], ['remove', [r]], ['push', [r, v]], ['push', [r, undefined]], ['onValue', [r, cb, cancel, null]], ['get', [q]]];
    const same = F.calls.length === want.length && F.calls.every((c, i) => c.name === want[i][0] && c.ret === outs[i]
      && (want[i][0] === 'update' ? c.args.length === 2 && c.args[1]['users/u1/x'] === 1 : want[i][1].every((a, j) => a === null || a === c.args[j])));
    chk(same && posts.length === 0, '모든 기본 동작(조건 붙은 읽기 포함)이 SDK 로 그대로 · 돌려준 값도 같은 물건 · 서버로는 0번');
    const F2 = fakeSdk();
    const gw2 = mkGw(G, SS, F2, { routes: () => { throw new Error('설정 없음'); }, post: () => Promise.reject(new Error('부르면 안 됨')) });
    const o = gw2.get(r);
    chk(F2.calls.length === 1 && F2.calls[0].ret === o, '원격 설정을 못 읽으면 표가 빈 것과 같다(Firebase)');
    const F3 = fakeSdk(); const p3 = [];
    const gw3 = mkGw(G, SS, F3, { routes: () => ['users'], canServer: () => false, post: (u, b) => { p3.push(b); return Promise.resolve({}); } });
    const o3 = gw3.get(r);
    chk(F3.calls.length === 1 && F3.calls[0].ret === o3 && !p3.length, '로그인 세션이 없으면(토큰 없음) 표에 걸려도 Firebase');
  }

  say('── 3. 표에 걸리면 서버로 — 번역표대로 Firebase 또는 오류');
  {
    const F = fakeSdk(); const posts = []; let fail = null; const notes = [];
    const streams = [];
    const gw = mkGw(G, SS, F, { routes: () => ['users/*/home'], notifyError: (c, e) => notes.push(c),
      post: (u, b) => { posts.push([u, b]); if(fail) return Promise.reject(fail); return Promise.resolve(u === G.STREAM_PATH ? { key: 'k1' } : { value: { bg: 'x' } }); },
      stream: (req, onData, onError) => { const s = { req, onData, onError, off: 0 }; streams.push(s); return () => { s.off++; }; } });
    const r = fakeRef('users/u1/home');
    const snap = await gw.get(r);
    chk(F.calls.length === 0 && posts[0][0] === G.DATA_PATH && G.DATA_PATH === '/v1/data' && posts[0][1].op === 'get' && posts[0][1].path === 'users/me/home' && !('query' in posts[0][1])
      && snap.val().bg === 'x' && snap.key === 'home', 'get — POST /v1/data 본문(op · path) · 내 코드는 me · 받은 값은 스냅숏 모양');
    await gw.set(fakeRef('users/u2/home/bg'), 'y');
    chk(posts[1][1].op === 'set' && posts[1][1].path === 'users/u2/home/bg' && posts[1][1].value === 'y' && F.calls.length === 0, 'set — 남의 코드 경로는 그대로(권한은 서버 경로 처리기가 본다)');
    const tryCase = async (err) => { fail = err; const n = F.calls.length, m = notes.length; let thrown = null; try{ await gw.set(r, 1); }catch(e){ thrown = e; } fail = null; return { fb: F.calls.length - n, notes: notes.slice(m), thrown }; };
    const fbCases = [{ code: 'NETWORK' }, { code: 'TIMEOUT' }, { code: 'USER_DIRECTORY_NOT_READY', status: 503 }, { code: 'RTDB_UNAVAILABLE', status: 503 },
      { code: 'AUTH_REQUIRED', status: 401 }, { code: 'USER_CODE_NOT_BOUND', status: 403 }, { code: 'NOT_FOUND', status: 404 }, { code: '', status: 502 }, { code: 'NO_TOKEN' }];
    const fbRes = [];
    for(const c of fbCases) fbRes.push(await tryCase(Object.assign(new Error('x'), c)));
    chk(fbRes.every((x) => x.fb === 1 && !x.notes.length && !x.thrown), '번역표 — 준비 안 됨 · 저장소 못 씀 · 연결 실패 · 시간 초과 · 로그인 없음 · 안 묶인 계정 · 모르는 경로(404) · 봉투 없는 5xx → Firebase 길(문구 없음)');
    const errCases = [['ACCESS_DENIED', 403, 'E-DATA-01'], ['INVALID_REQUEST', 400, 'E-DATA-02'], ['CONCURRENT_UPDATE', 409, 'E-DATA-03'], ['SOMETHING_NEW', 500, 'E-DATA-04']];
    const errRes = [];
    for(const [code, status, want] of errCases) errRes.push([await tryCase(Object.assign(new Error('x'), { code, status })), want, code]);
    chk(errRes.every(([x, want, code]) => x.fb === 0 && x.notes.join() === want && x.thrown && x.thrown.twCode === (code === 'SOMETHING_NEW' ? 'UNKNOWN' : code)),
      '번역표 — 권한 없음 · 잘못된 요청 · 동시 수정 · 모르는 code → 부른 쪽에 오류(E-DATA-01~04 알림 · Firebase 로 안 감)');
    chk(G.translate({ code: 'X_NOT_READY', status: 503 }) === 'firebase' && G.translate({ code: 'ACCESS_DENIED' }) === 'ACCESS_DENIED' && G.translate({ code: 'WEIRD', status: 418 }) === 'UNKNOWN' && G.translate(null) === 'firebase',
      'translate(순수) — 이름 끝 _NOT_READY · 아는 오류 · 모르는 code · 오류 모양 없음');
    const qok = Object.assign(fakeRef('users/u1/home'), { q: { ref: fakeRef('users/u1/home'), query: { orderBy: 'ts', limitToLast: 20 } } });
    await gw.get(qok);
    const lastQ = posts[posts.length - 1][1];
    chk(lastQ.op === 'get' && lastQ.path === 'users/me/home' && lastQ.query.orderBy === 'ts' && lastQ.query.limitToLast === 20, '조건 붙은 읽기 — 본문 query 로 서버에(orderBy · limitToLast …)');
    const n0 = F.calls.length; const qbad = Object.assign(fakeRef('users/u1/home'), { q: null }); gw.get(qbad);
    chk(F.calls.length === n0 + 1 && F.calls[n0].name === 'get' && F.calls[n0].args[0] === qbad, '서버로 못 보내는 조건(endBefore 등)은 Firebase');
    gw.update(fakeRef(''), { 'users/u1/home/a': 1, 'users/u1/other': 2 });
    chk(F.calls[F.calls.length - 1].name === 'update', 'update 칸이 서버 · Firebase 로 섞이면 쪼개지 않고 통째로 Firebase');
    const np = posts.length; await gw.update(fakeRef('users'), { 'u1/home/a': 1, 'u1/home/b': 2 });
    chk(posts.length === np + 1 && posts[np][1].op === 'update' && posts[np][1].path === 'users' && posts[np][1].value['me/home/a'] === 1, 'update 칸이 모두 서버 쪽이면 서버로 · 칸 이름의 내 코드도 me');
    const pr = gw.push(r, { t: 1 }); await pr;
    chk(F.calls[F.calls.length - 1].name === 'push' && F.calls[F.calls.length - 1].args.length === 1 && pr.key && posts[posts.length - 1][1].op === 'set', 'push — 키는 Firebase 가 이 기기에서(값 없이) · 값은 set 과 같은 길로 서버');
    const got = []; const before = F.calls.length;
    const off = gw.onValue(qok, (s) => got.push(s.val()));
    streams[0].onData({ value: 5 });
    chk(streams[0].req.path === 'users/me/home' && streams[0].req.query.limitToLast === 20 && got[0] === 5 && F.calls.length === before, '듣기 — 본문(path · query)으로 서버 SSE · 내 코드는 me · 값을 스냅숏으로');
    off();
    chk(streams[0].off === 1, '듣기 끊기 — 서버 쪽도 끊는다');
    const off2 = gw.onValue(r, () => {});
    streams[1].onError(Object.assign(new Error('끊김'), { code: 'NETWORK' }));
    chk(F.calls.length === before + 1 && F.calls[before].name === 'onValue', '첫 값 전에 서버 듣기가 끊기면(연결 실패) Firebase 로 듣는다');
    off2();
    const m0 = notes.length; const off3 = gw.onValue(r, () => {});
    streams[2].onError(Object.assign(new Error('거절'), { code: 'ACCESS_DENIED', status: 403 }));
    chk(F.calls.length === before + 1 && notes.slice(m0).join() === 'E-DATA-01', '듣기가 권한 거절이면 Firebase 로 안 가고 E-DATA-01');
    off3();
  }
  {
    /* 값을 받은 뒤 끊김(서버 배포 · 재시작) — 쉬고 다시 붙는다 · 다시 붙기도 첫 값 전에 끊기면 Firebase · 끊은 듣기는 다시 안 붙음 */
    const F = fakeSdk(); const streams = []; const laters = []; const got = [];
    const gw = mkGw(G, SS, F, { routes: () => ['users/*/home'], later: (f, ms) => laters.push([f, ms]),
      stream: (req, onData, onError) => { const s = { req, onData, onError, off: 0 }; streams.push(s); return () => { s.off++; }; } });
    const r = fakeRef('users/u1/home');
    const off = gw.onValue(r, (s) => got.push(s.val()));
    streams[0].onData({ value: 1 });
    streams[0].onError(Object.assign(new Error('끊김'), { code: 'NETWORK' }));
    chk(laters.length === 1 && laters[0][1] === G.RESUBSCRIBE_DELAY_MS && streams.length === 1 && !F.calls.length, '값을 받은 뒤 끊기면 바로 Firebase 로 가지 않고 쉬었다 다시 붙기를 건다');
    laters[0][0]();
    chk(streams.length === 2 && streams[1].req.path === 'users/me/home', '  ↳ 쉬고 나서 같은 본문으로 서버에 다시 붙는다');
    streams[1].onData({ value: 2 });
    chk(got.join() === '1,2' && !F.calls.length, '  ↳ 다시 붙은 뒤 값이 이어서 온다');
    streams[1].onError(Object.assign(new Error('끊김'), { code: 'NETWORK' }));
    laters[1][0]();
    streams[2].onError(Object.assign(new Error('연결 실패'), { code: 'NETWORK' }));
    chk(F.calls.length === 1 && F.calls[0].name === 'onValue', '  ↳ 다시 붙기가 첫 값 전에 끊기면 Firebase 로 듣는다(조용히 멈추지 않음)');
    off();
    const off2 = gw.onValue(r, () => {});
    const n = streams.length; streams[n - 1].onData({ value: 3 });
    off2();
    streams[n - 1].onError(Object.assign(new Error('끊김'), { code: 'NETWORK' }));
    chk(laters.length === 2, '  ↳ 사용하는 쪽이 끊은 듣기는 다시 붙지 않는다');
  }

  say('── 4. 연결');
  const FI = strip(S.FI);
  const imp = (/import\s*\{([\s\S]*?)\}\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/firebase-database\.js"/.exec(FI) || [])[1] || '';
  const bare = ['get', 'set', 'remove', 'onValue', 'push', 'query', 'update', 'orderByChild', 'orderByKey', 'limitToLast', 'startAt', 'equalTo'].filter((n) => new RegExp('(^|[,\\s])' + n + '\\s*(,|$)').test(imp));
  chk(imp && !bare.length, 'firebase-init.js — 기본 동작은 SDK 이름 그대로 들여오지 않는다(통로 뒤 이름으로만)' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  chk(/sdk:\s*\{\s*get:\s*_sdkGet,\s*set:\s*_sdkSet,\s*update:\s*_dbUpdate,\s*remove:\s*_sdkRemove,\s*push:\s*_sdkPush,\s*onValue:\s*_sdkOnValue\s*\}/.test(FI), '  ↳ SDK 기본 동작은 통로 만들 때 한 번만 넘긴다');
  const direct = ['_sdkGet', '_sdkSet', '_sdkRemove', '_sdkPush', '_sdkOnValue', '_dbUpdate'].filter((n) => (FI.match(new RegExp('\\b' + n + '\\(', 'g')) || []).length > 0);
  chk(!direct.length, '  ↳ 통로를 건너뛰어 SDK 기본 동작을 직접 부르는 줄 없음' + (direct.length ? ' — ' + direct.join(' · ') : ''));
  chk(/const get = \(\.\.\.a\) => _gw\.get\(\.\.\.a\);/.test(FI) && /const onValue = \(\.\.\.a\) => _gw\.onValue\(\.\.\.a\);/.test(FI) && /return _gw\.update\(r, v\);/.test(FI),
    '  ↳ 기능 함수가 쓰는 이름(get · set · update · remove · push · onValue)이 통로를 가리킨다');
  chk(/routes:\s*\(\)\s*=>\s*window\.TwRemoteConfig\.store\.dataRoutes\(\)/.test(FI) && /myCode:\s*\(\)\s*=>\s*window\.getMyUserId\(\)/.test(FI) && /serverFirst:\s*window\.TwSourceSwitch\.serverFirst/.test(FI)
    && /canServer:\s*\(\)\s*=>\s*!!\(auth && auth\.currentUser\)/.test(FI) && /notifyError:\s*\(\.\.\.a\)\s*=>\s*window\.TwErrorCodes\.notify\(\.\.\.a\)/.test(FI),
    '  ↳ 표는 원격 설정 · 내 코드 · 로그인 세션 · 실패 넘기기는 source-switch.js serverFirst(두 벌 아님) · 오류 알림은 TwErrorCodes');
  const gp = (/function _gwPost\(path, body\)\{[\s\S]*?\n  \}/.exec(FI) || [''])[0];
  chk(gp && /_authApi\.post\(path, body, \{ auth: true,/.test(gp) && !/X-User-Code|USER_CODE_HEADER|headers:/.test(gp), '  ↳ 보내기는 로그인 통로 POST 본문 · 머리는 토큰 하나(X-User-Code 없음)');
  chk(/stream: window\.TwDataGateway\.makeStream\(\{ post: \(p, b\) => _gwPost\(p, b\), getToken: \(\) => _getIdToken\(false\)/.test(FI), '  ↳ 듣기는 통로 모듈의 makeStream(같은 로그인 통로 · 토큰)');
  {
    /* makeStream 실제로 — 두 단계 · 주소엔 열쇠만 · 머리는 토큰 하나 · SSE 값 · 오류 사건 */
    const G2 = load(S.GW, 'TwDataGateway'); const posts = [], fetches = [];
    const enc = (t) => new TextEncoder().encode(t);
    const chunks = [enc('event: value\ndata: {"value":1}\n\nevent: va'), enc('lue\ndata: {"value":2}\n\n'), enc('event: error\ndata: {"code":"ACCESS_DENIED","status":403}\n\n')];
    const st = G2.makeStream({ post: (p, b) => { posts.push([p, b]); return Promise.resolve({ key: 'K 1' }); }, getToken: () => Promise.resolve('TOK'), baseUrl: () => 'https://api.x',
      fetch: (u, init) => { fetches.push([u, init]); let i = 0; return Promise.resolve({ ok: true, status: 200, body: { getReader: () => ({ read: () => Promise.resolve(i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }) }) } }); } });
    const vals = []; let err = null;
    await new Promise((res) => { st({ path: 'users/me/home', query: { limitToLast: 2 } }, (d) => vals.push(d.value), (e) => { err = e; res(); }); });
    chk(posts[0][0] === '/v1/data/stream' && posts[0][1].path === 'users/me/home' && posts[0][1].query.limitToLast === 2 && fetches[0][0] === 'https://api.x/v1/data/stream/K%201'
      && fetches[0][1].headers.Authorization === 'Bearer TOK' && !('X-User-Code' in fetches[0][1].headers) && vals.join() === '1,2' && err && err.code === 'ACCESS_DENIED' && err.status === 403,
      'makeStream — POST 본문 → 열쇠 → GET 주소엔 열쇠만 · 조각 난 SSE 를 이어 읽음 · 오류 사건은 code · status 로');
  }
  const qw = (/const query = \(r, \.\.\.cs\) => \{[\s\S]*?\n  \};/.exec(FI) || [''])[0];
  chk(qw && /parts\.every\(\(d\) => d\)/.test(qw) && /orderBy: '\$key'/.test(FI) && /a\.length > 1 \? null : \{ startAt: a\[0\] \}/.test(FI), '  ↳ 조건은 적어 둔 것만 본문 query 로 · 키 붙은 startAt · 적지 않은 조건(endBefore)이 섞이면 Firebase');
  const RC = load(S.RC, 'TwRemoteConfig');
  chk(RC && Array.isArray(RC.DEFAULTS.dataRoutes) && RC.DEFAULTS.dataRoutes.length === 0 && RC.FALLBACK_PATHS.dataRoutes === 'config/dataRoutes'
    && RC.cleanDataRoutes({ 0: 'users/*/home', 1: 7, 2: '' }).join() === 'users/*/home' && RC.cleanDataRoutes(['a', 'b']).join() === 'a,b' && RC.cleanDataRoutes('x').length === 0
    && RC.store.dataRoutes().length === 0,
    '원격 설정 dataRoutes — 기본 빈 표 · Firebase config/dataRoutes · {0:…} 도 받음 · 글자 칸만');
  let rules = null; try{ rules = JSON.parse(S.RULES); }catch(_){ rules = null; }
  const dr = rules && rules.rules && rules.rules.config && rules.rules.config.dataRoutes;
  chk(!!dr && dr['.read'] === true && /admins/.test(dr['.write'] || '') && /\$i\.matches/.test((dr.$i || {})['.validate'] || '') && /isString/.test((dr.$i || {})['.validate'] || ''),
    '규칙 config/dataRoutes — 누구나 읽기 · 관리자만 쓰기 · 칸은 번호 · 글자');
  const H = S.HTML, iSS = H.indexOf('src="parts/shared/source-switch.js"'), iGW = H.indexOf('src="parts/shared/data-gateway.js"');
  /* firebase-init.js 는 type="module"(지연 실행)이라 html 자리와 상관없이 classic 스크립트(통로 포함)가 다 돈 뒤에 돈다 */
  chk(iSS > 0 && iGW > iSS && /<script type="module" src="parts\/firebase-init\.js"><\/script>/.test(H) && !/<script src="parts\/shared\/data-gateway\.js" type="module"/.test(H),
    'html — source-switch.js → data-gateway.js(classic) · firebase-init.js 는 module 이라 그 뒤에 돈다');
  chk(/PRELOAD\.push\('data-gateway\.js'\)/.test(S.SMOKE), 'smoke — data-gateway.js 를 싣는다');
  {
    const AC = load(S.AC, 'TwApi');
    const seen = [];
    const cli = AC.createApiClient({ baseUrl: 'https://api.x', fetch: (u, init) => { seen.push([u, init]); return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve({ success: true, data: { ok: 1 } }) }); }, getToken: () => Promise.resolve('TOK'), backoffMs: 0 });
    const d = await cli.post('/v1/data', { op: 'get', path: 'users/me' }, { auth: true });
    chk(d.ok === 1 && seen[0][0] === 'https://api.x/v1/data' && seen[0][1].method === 'POST' && JSON.parse(seen[0][1].body).path === 'users/me'
      && seen[0][1].headers.Authorization === 'Bearer TOK' && seen[0][1].headers['Content-Type'] === 'application/json', 'api-client.js post — 주소에 매개변수 없이 본문 JSON · 토큰 머리');
  }
  /* 다른 앱 파일이 Firebase DB 라이브러리를 직접 부르면 통로를 건너뛴다 */
  const path = require('path');
  const walk = (d, out) => { let es = []; try{ es = fs.readdirSync(d, { withFileTypes: true }); }catch(_){ return out; } for(const e of es){ const p = path.join(d, e.name); if(e.isDirectory()){ if(e.name !== 'vendor' && e.name !== 'node_modules') walk(p, out); } else if(e.name.endsWith('.js')) out.push(p); } return out; };
  const dir = ['parts', 'app/parts', '../app/parts'].map((d) => path.resolve(d)).find((d) => fs.existsSync(path.join(d, 'shared')));
  const files = dir ? walk(dir, []) : [];
  const offenders = files.filter((f) => path.basename(f) !== 'firebase-init.js' && /firebase-database\.js/.test(strip(fs.readFileSync(f, 'utf8'))));
  chk(files.length > 50 && !offenders.length, '앱 파일 ' + files.length + '개 중 Firebase DB 라이브러리를 부르는 곳은 firebase-init.js 하나' + (offenders.length ? ' — ' + offenders.map((f) => path.basename(f)).join(' · ') : ''));
}

(async () => {
  await judge(SRC0);

  say('── 5. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const BREAKS = [
    ['GW', "  if(!Array.isArray(routes) || !routes.length || typeof path !== 'string') return FIREBASE;", "  if(!Array.isArray(routes) || typeof path !== 'string') return SERVER;", '표가 비어도 서버로'],
    ['GW', "  return path.split('/').map((seg) => (seg === myCode ? ME : seg)).join('/');", "  return path.split(myCode).join(ME);", '앞부분만 같은 코드도 me 로 바꿈'],
    ['GW', "    if(t === null) return sdk.get(r, ...rest);", "    if(t === null) return sdk.get(r);", '표가 비었을 때 인자를 버림'],
    ['GW', "    if(t === null) return sdk.onValue(r, cb, ...rest);", "    if(t === null){ sdk.onValue(r, cb, ...rest); return () => {}; }", '표가 비었을 때 SDK 끊기 함수를 안 돌려줌'],
    ['GW', "    if(!keys.length || sides.some((s) => s !== SERVER)){", "    if(!keys.length || sides.every((s) => s !== SERVER)){", 'update 섞이면 서버로'],
    ['GW', "      () => sdk.set(r, value, ...rest)).then(finish);", "      () => Promise.reject(new Error('x'))).then(finish);", '서버 실패에 Firebase 로 안 넘어감'],
    ['GW', "            if(!got && tr === FIREBASE) return toFirebase(e);", "", '듣기가 끊겨도 Firebase 로 안 넘어감'],
    ['GW', "            if(tr === FIREBASE) later(() => { if(!closed) open(); }, RESUBSCRIBE_DELAY_MS);", "", '값을 받은 뒤 끊기면 다시 안 붙음(조용히 멈춤)'],
    ['GW', "            if(closed) return;", "", '끊은 듣기도 다시 붙음'],
    ['GW', "  const body = (op, t, extra) => Object.assign({ op, path: sp(t.path) },", "  const body = (op, t, extra) => Object.assign({ op, path: t.path },", '서버로 보낼 때 내 코드를 그대로 보냄'],
    ['GW', "  if(status === 404) return FIREBASE;", "", '모르는 경로(404)를 오류로'],
    ['GW', "  ACCESS_DENIED: (notifyError, e) => notifyError('E-DATA-01', e),", "", '권한 거절을 모르는 오류로'],
    ['GW', "  return Object.prototype.hasOwnProperty.call(ERROR_NOTICES, code) ? code : 'UNKNOWN';", "  return FIREBASE;", '모르는 code 를 Firebase 로(오류를 삼킴)'],
    ['GW', "    return ok ? SERVER : FIREBASE;", "    return SERVER;", '로그인 세션이 없어도 서버로'],
    ['GW', "    if(q === null) return null;", "", '못 보내는 조건도 서버로'],
    ['FI', "  const startAt = (...a) => _gwC(_sdkStartAt(...a), a.length > 1 ? null : { startAt: a[0] });", "  const startAt = (...a) => _gwC(_sdkStartAt(...a), { startAt: a[0] });", '키 붙은 startAt 을 서버로'],
    ['FI', "  const get = (...a) => _gw.get(...a);", "  const get = _sdkGet;", '기능 함수의 get 이 통로를 건너뜀'],
    ['FI', "    return _gw.update(r, v);", "    return _dbUpdate(r, v);", 'update 가 통로를 건너뜀'],
    ['RC', "  dataRoutes: Object.freeze([]),", "  dataRoutes: Object.freeze(['users']),", '기본 표가 비어 있지 않음'],
    ['RULES', '"dataRoutes": {\n        ".read": true,', '"dataRoutes": {\n        ".read": false,', '규칙이 표 읽기를 막음'],
    ['SMOKE', "PRELOAD.push('data-gateway.js');", "", 'smoke 가 통로를 안 실음'],
  ];
  const caught = [];
  for(const [where, from, to, what] of BREAKS){
    if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
    quiet = true; qfail = 0;
    let hung = false;
    try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { hung = true; r(); }, 3000))]); }catch(_){ qfail++; }
    if(hung) qfail++;
    quiet = false;
    caught.push([what, qfail]);
  }
  const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
  chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
