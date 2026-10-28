/* ═══ 🌐 sim-api-client.js — 앱 공통 API 통로(api-client.js · window.TwApi) ═══════════════
   [왜] 읽기 사본이 있는 것은 우리 API(t-w-server)에서 먼저 읽고, 못 받으면 Firebase 길로 간다. 시간 제한 · 봉투 · 실패 모양 · 쉬기를 한 곳에서.
   1. 주소 — 운영 앱은 운영 API · dev 앱은 dev API(tw.apiBaseUrl 은 dev 만 · CSP 묶음 안 · 운영 API 아님) · 환경은 companion.firebaseEnv
   2. 성공 — 봉투 { success, data } 의 data · 토큰 · 쿠키 없이 · 주소 = 기본 + 경로
   3. 실패 한 모양 — 네트워크 · 시간 초과 · 5xx · 404 · 봉투 아님 → unavailable · *_NOT_READY → notReady · 401/403 → auth · 그 밖 4xx → request · shouldFallback
   4. 쉬기 — unavailable 뒤 BACKOFF_MS 동안 묻지 않고 곧장 실패(BACKOFF) · 지나면 다시 · notReady · 성공은 쉬지 않음
   5. 캐시 · 같은 요청 하나로 · 주소 없음
   6. 쓰기 — post · put · patch · del 방법 · 본문 · 로그인 기본 · 쓰기 시간 제한 · 204 · 쉬지 않음
   7. 로그인 — 토큰 · X-Device-Id 머리 · 401 AUTH_REQUIRED 면 새 토큰으로 한 번만 · 가입 전(NOT_BOUND)은 다시 안 함 · 토큰 없음
   8. ETag — 기억 · If-None-Match · 304 면 기억 값 · 계정이 다르면 따로 · 상한 · 오류 봉투(items · Retry-After · 자원 없음 404)
   9. 모듈 — Firebase 모름 · window.TwApi · 앱 한 벌(client · authed · bindToken) 주소 · html 차례
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts'), '..', path.join('..', 'app'), path.join('..', 'app', 'parts')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const where = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const SRC = read('api-client.js'), HTML = read('desk-companion-prototype.html');
for(const [n, v] of [['api-client.js', SRC], ['desk-companion-prototype.html', HTML]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const A = require(path.resolve(where('api-client.js')));
const memStore = (o) => ({ getItem: (k) => (k in (o || {}) ? o[k] : null) });
const PROD = 'https://api.together-working.com', DEV = 'https://api-dev.together-working.com';
const res = (status, body, hdr) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => { const h = hdr || {}; const f = Object.keys(h).find((x) => x.toLowerCase() === String(k).toLowerCase()); return f ? h[f] : null; } }, json: async () => { if(body instanceof Error) throw body; return body; } });
const jwt = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
const mkFetch = (fn) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return fn(url, init, calls.length); }; f.calls = calls; return f; };
const err = async (p) => { try{ await p; return null; }catch(e){ return e; } };

(async () => {
  say('── 1. 주소');
  {
    chk(A.API_BASE_PROD === PROD && A.API_BASE_DEV === DEV, '운영 · dev API 주소');
    chk(A.apiBaseFor('prod', memStore({ 'tw.apiBaseUrl': 'https://x.togetherworking.duckdns.org' })) === PROD && A.apiBaseFor(undefined, null) === PROD, '★ 운영 앱은 늘 운영 API(시험 주소 무시)');
    chk(A.apiBaseFor('dev', memStore()) === DEV && A.apiBaseFor('dev', null) === DEV, 'dev 앱은 dev API');
    chk(A.apiBaseFor('dev', memStore({ 'tw.apiBaseUrl': 'https://api-test.togetherworking.duckdns.org/' })) === 'https://api-test.togetherworking.duckdns.org', '  ↳ dev 앱만 tw.apiBaseUrl(끝 / 무시)');
    chk(A.apiBaseFor('dev', memStore({ 'tw.apiBaseUrl': 'https://api-test.together-working.com' })) === 'https://api-test.together-working.com', '  ↳ 새 도메인 묶음(*.together-working.com)도 시험 주소로');
    chk(['https://evil.example', 'http://api-test.togetherworking.duckdns.org', 'https://a.togetherworking.duckdns.org.evil.com', 'https://a.b.togetherworking.duckdns.org', PROD,
      'https://evil-together-working.com', 'https://a.together-working.com.evil.com', 'https://a.b.together-working.com', 'http://a.together-working.com', 'https://together-working.com']
      .every((u) => A.apiBaseFor('dev', memStore({ 'tw.apiBaseUrl': u })) === DEV), '  ↳ 묶음 밖 · http · 접미사 흉내 · 두 칸 · 운영 API 는 무시(dev API)');
    chk(A.apiBaseFor('dev', { getItem(){ throw new Error('blocked'); } }) === DEV, '  ↳ 저장소가 막혀도 dev API');
    chk(A.envOf({ companion: { firebaseEnv: 'dev' } }) === 'dev' && A.envOf({ companion: {} }) === 'prod' && A.envOf({}) === 'prod' && A.envOf(null) === 'prod', '환경은 preload 의 companion.firebaseEnv(firebase-config.js 와 같은 방식)');
    chk(/^tw\./.test(A.API_BASE_DEV_KEY), '  ↳ 저장 키 tw. 접두사');
    chk(A.TIMEOUT_MS >= 2000 && A.TIMEOUT_MS <= 3000 && A.BACKOFF_MS >= 10000 && A.BACKOFF_MS <= 120000, '시간 제한 2~3초 · 쉬기 10초~2분 (' + A.TIMEOUT_MS + ' · ' + A.BACKOFF_MS + ')');
  }

  say('── 2. 성공');
  {
    const f = mkFetch(() => res(200, { success: true, data: { a: 1 } }));
    const c = A.createApiClient({ baseUrl: PROD + '/', fetch: f });
    const d = await c.get('/v1/config');
    chk(d && d.a === 1, '봉투의 data 를 돌려준다');
    chk(f.calls[0].url === PROD + '/v1/config' && f.calls[0].init.credentials === 'omit' && Object.keys(f.calls[0].init.headers || {}).length === 0, '  ↳ 주소 = 기본(끝 / 정리) + 경로 · 토큰 · 쿠키 없이');
    chk(c.baseUrl() === PROD && !c.resting(), '  ↳ baseUrl · 쉬지 않음');
    const nul = A.createApiClient({ baseUrl: PROD, fetch: mkFetch(() => res(200, { success: true, data: null })) });
    chk((await nul.get('/x')) === null, '  ↳ data 가 null 이어도 성공(없음은 부르는 쪽이 판단)');
  }

  say('── 3. 실패 한 모양');
  {
    const one = async (fn, opts) => err(A.createApiClient(Object.assign({ baseUrl: PROD, fetch: mkFetch(fn), backoffMs: 0 }, opts || {})).get('/v1/x'));
    const cases = [
      ['네트워크(TypeError)', () => { throw new TypeError('Failed to fetch'); }, 'unavailable', 'NETWORK'],
      ['500', () => res(500, { success: false, code: 'INTERNAL' }), 'unavailable', 'INTERNAL'],
      ['502 HTML', () => res(502, new SyntaxError('html')), 'unavailable', ''],
      ['404(배포 전)', () => res(404, { success: false, code: 'NOT_FOUND' }), 'unavailable', 'NOT_FOUND'],
      ['200 인데 봉투 아님(HTML)', () => res(200, new SyntaxError('html')), 'unavailable', ''],
      ['200 인데 success:false', () => res(200, { success: false }), 'unavailable', ''],
      ['503 CONFIG_NOT_READY', () => res(503, { success: false, code: 'CONFIG_NOT_READY' }), 'notReady', 'CONFIG_NOT_READY'],
      ['401', () => res(401, { success: false, code: 'AUTH_REQUIRED' }), 'auth', 'AUTH_REQUIRED'],
      ['403', () => res(403, {}), 'auth', ''],
      ['400', () => res(400, { success: false, code: 'BAD_REQUEST', message: 'x' }), 'request', 'BAD_REQUEST'],
    ];
    let bad = [];
    for(const [name, fn, kind, code] of cases){
      const e = await one(fn);
      if(!(e instanceof A.ApiError) || e.kind !== kind || e.code !== code) bad.push(name + '=' + (e && e.kind) + '/' + (e && e.code));
    }
    chk(bad.length === 0, '★ 네트워크 · 5xx · 404 · 봉투 아님 → unavailable · *_NOT_READY → notReady · 401/403 → auth · 그 밖 4xx → request' + (bad.length ? ' — 틀림: ' + bad.join(', ') : ''));
    const e503 = await one(() => res(503, { success: false, code: 'CONFIG_NOT_READY' }));
    chk(e503.status === 503 && e503.name === 'ApiError' && e503 instanceof Error, '  ↳ 상태 · 이름 · Error 를 잇는다');
    chk(A.shouldFallback(new A.ApiError('unavailable')) && A.shouldFallback(new A.ApiError('notReady')) && !A.shouldFallback(new A.ApiError('auth')) && !A.shouldFallback(new A.ApiError('request')) && !A.shouldFallback(null),
      'shouldFallback — 닿지 못함 · 사본 없음만 Firebase 길로(권한 · 요청 오류는 덮지 않음)');
    const t0 = Date.now();
    const eh = await one(() => new Promise(() => {}), { timeoutMs: 150 });
    chk(eh && eh.kind === 'unavailable' && eh.code === 'TIMEOUT' && Date.now() - t0 < 1000, '★ 답이 없으면 시간 제한에서 끊는다(TIMEOUT · unavailable)');
    let aborted = false;
    await one((url, init) => new Promise(() => { init.signal && init.signal.addEventListener('abort', () => { aborted = true; }); }), { timeoutMs: 50 });
    chk(aborted, '  ↳ 끊을 때 요청도 abort');
    const eb = await one(() => res(200, { then: 1, get json(){ return null; } }), {});
    chk(eb && eb.kind === 'unavailable', '  ↳ 이상한 본문도 unavailable');
    const slowBody = await one(() => ({ ok: true, status: 200, json: () => new Promise(() => {}) }), { timeoutMs: 80 });
    chk(slowBody && slowBody.code === 'TIMEOUT', '  ↳ 본문이 안 와도 시간 제한');
  }

  say('── 4. 쉬기');
  {
    let t = 1000, mode = 'down';
    const f = mkFetch(() => (mode === 'down' ? Promise.reject(new TypeError('x')) : mode === 'ready' ? res(503, { success: false, code: 'CONFIG_NOT_READY' }) : res(200, { success: true, data: 1 })));
    const c = A.createApiClient({ baseUrl: PROD, fetch: f, now: () => t, backoffMs: 30000 });
    const e1 = await err(c.get('/a'));
    const e2 = await err(c.get('/b'));
    chk(e1.code === 'NETWORK' && e2.kind === 'unavailable' && e2.code === 'BACKOFF' && f.calls.length === 1 && c.resting(), '★ 닿지 못하면 쉬는 동안 다른 경로도 묻지 않고 곧장 실패(BACKOFF · 기다림 없음)');
    t += 30001; mode = 'ok';
    chk((await c.get('/a')) === 1 && f.calls.length === 2 && !c.resting(), '  ↳ 쉬기가 지나면 다시 묻고 · 성공하면 풀린다');
    mode = 'ready';
    await err(c.get('/r'));
    const e3 = await err(c.get('/r2'));
    chk(e3 && e3.kind === 'notReady' && f.calls.length === 4, '  ↳ 사본 없음(notReady)은 서버가 살아 있는 것 — 쉬지 않는다');
    mode = 'ok';
    const c0 = A.createApiClient({ baseUrl: PROD, fetch: mkFetch(() => res(401, {})), now: () => t, backoffMs: 30000 });
    await err(c0.get('/x'));
    chk(!c0.resting(), '  ↳ 권한 오류도 쉬지 않는다');
  }

  say('── 5. 캐시 · 같은 요청 · 주소 없음');
  {
    let t = 0, n = 0;
    const f = mkFetch(() => { n++; return res(200, { success: true, data: n }); });
    const c = A.createApiClient({ baseUrl: PROD, fetch: f, now: () => t });
    chk((await c.get('/c', { cacheMs: 1000 })) === 1 && (await c.get('/c', { cacheMs: 1000 })) === 1 && f.calls.length === 1, 'cacheMs 안에서는 메모리 값(요청 없음)');
    t += 1001;
    chk((await c.get('/c', { cacheMs: 1000 })) === 2, '  ↳ 지나면 다시 묻는다');
    chk((await c.get('/n')) === 3 && (await c.get('/n')) === 4, '  ↳ cacheMs 없으면 늘 묻는다');
    c.clearCache();
    let release;
    const g = mkFetch(() => new Promise((r) => { release = () => r(res(200, { success: true, data: 'x' })); }));
    const c2 = A.createApiClient({ baseUrl: PROD, fetch: g });
    const p1 = c2.get('/same'), p2 = c2.get('/same');
    await new Promise((r) => setTimeout(r, 0)); release();
    chk((await p1) === 'x' && (await p2) === 'x' && g.calls.length === 1, '같은 경로를 동시에 부르면 요청은 하나');
    const e = await err(A.createApiClient({ baseUrl: '', fetch: f }).get('/x'));
    const e2 = await err(A.createApiClient({ baseUrl: PROD, fetch: null }).get('/x'));
    chk(e.kind === 'unavailable' && e.code === 'NO_API' && e2.code === 'NO_API', '주소 · fetch 가 없으면 곧장 unavailable(NO_API)');
  }

  say('── 6. 쓰기');
  {
    const f = mkFetch(() => res(200, { success: true, data: 'ok' }));
    const c = A.createApiClient({ baseUrl: PROD, fetch: f, getToken: async () => jwt('u1'), deviceId: () => 'dev-0001' });
    const r = [await c.post('/p', { a: 1 }), await c.put('/u', { b: 2 }), await c.patch('/m', { c: null }), await c.del('/d')];
    const [p, u, m, dl] = f.calls;
    chk(r.every((x) => x === 'ok') && p.init.method === 'POST' && u.init.method === 'PUT' && m.init.method === 'PATCH' && dl.init.method === 'DELETE', 'post · put · patch · del — 방법이 맞고 봉투의 data');
    chk(p.init.body === '{"a":1}' && m.init.body === '{"c":null}' && p.init.headers['Content-Type'] === 'application/json' && dl.init.body === undefined && !('Content-Type' in dl.init.headers),
      '  ↳ 본문은 JSON(null 칸도 그대로 — PATCH 의 «지움») · 본문 없는 DELETE 는 본문 · 형식 머리 없음');
    chk([p, u, m, dl].every((x) => x.init.headers.Authorization === 'Bearer ' + jwt('u1')), '  ↳ 쓰기는 로그인이 기본(토큰을 붙인다)');
    await c.post('/pub', { v: 1 }, { auth: false });
    chk(!('Authorization' in f.calls[4].init.headers) && !('X-Device-Id' in f.calls[4].init.headers), '  ↳ auth:false 일 때만 토큰 · 기기 머리 없이');
    const f204 = mkFetch(() => ({ ok: true, status: 204, headers: { get: () => null }, json: async () => { throw new Error('본문 없음'); } }));
    chk((await A.createApiClient({ baseUrl: PROD, fetch: f204, getToken: async () => 't' }).post('/v', {})) === null, '  ↳ 204(본문 없음)는 null 로 성공');
    let t = 0;
    const down = A.createApiClient({ baseUrl: PROD, fetch: mkFetch(() => { throw new TypeError('x'); }), getToken: async () => 't', now: () => t, backoffMs: 30000 });
    const ew = await err(down.post('/a', {}));
    chk(ew && ew.code === 'NETWORK' && !down.resting(), '  ↳ 쓰기 실패는 쉬기를 걸지 않는다(다음 쓰기 · 읽기를 막지 않게)');
    chk(A.WRITE_TIMEOUT_MS >= 8000 && A.WRITE_TIMEOUT_MS <= 30000 && A.WRITE_TIMEOUT_MS > A.TIMEOUT_MS, '  ↳ 쓰기 시간 제한(' + A.WRITE_TIMEOUT_MS + 'ms)이 읽기보다 길다');
    const slow = await err(A.createApiClient({ baseUrl: PROD, fetch: mkFetch(() => new Promise(() => {})), getToken: async () => 't', writeTimeoutMs: 60 }).put('/s', {}));
    chk(slow && slow.code === 'TIMEOUT', '  ↳ 쓰기도 시간 제한에서 끊는다');
  }

  say('── 7. 로그인');
  {
    const forces = [];
    let n = 0;
    const f = mkFetch((url, init) => (++n === 1 ? res(401, { success: false, code: 'AUTH_REQUIRED' }) : res(200, { success: true, data: init.headers.Authorization })));
    const c = A.createApiClient({ baseUrl: PROD, fetch: f, getToken: async (force) => { forces.push(force); return force ? 'fresh' : 'old'; }, deviceId: () => 'dev-0001' });
    const v = await c.get('/v1/me', { auth: true });
    chk(v === 'Bearer fresh' && forces.join(',') === 'false,true' && f.calls.length === 2, '401 AUTH_REQUIRED(토큰이 막 끝남) → 새 토큰(force)으로 한 번만 다시');
    chk(f.calls[0].init.headers['X-Device-Id'] === 'dev-0001' && A.DEVICE_HEADER === 'X-Device-Id', '  ↳ 로그인 요청에 이 기기 머리 X-Device-Id');
    const g = mkFetch(() => res(401, { success: false, code: 'AUTH_REQUIRED' }));
    const e2 = await err(A.createApiClient({ baseUrl: PROD, fetch: g, getToken: async () => 't' }).get('/x', { auth: true }));
    chk(e2 && e2.kind === 'auth' && g.calls.length === 2, '  ↳ 다시 해도 401 이면 그대로 auth(두 번까지만)');
    const h = mkFetch(() => res(401, { success: false, code: 'USER_CODE_NOT_BOUND' }));
    const e3 = await err(A.createApiClient({ baseUrl: PROD, fetch: h, getToken: async () => 't' }).get('/v1/me', { auth: true }));
    chk(e3 && e3.code === 'USER_CODE_NOT_BOUND' && h.calls.length === 1, '  ↳ 가입 전(USER_CODE_NOT_BOUND)은 다시 안 함');
    const pub = mkFetch(() => res(401, { success: false, code: 'AUTH_REQUIRED' }));
    await err(A.createApiClient({ baseUrl: PROD, fetch: pub, getToken: async () => 't' }).get('/x'));
    chk(pub.calls.length === 1, '  ↳ 로그인 없는 읽기의 401 은 다시 안 함');
    const none = mkFetch(() => res(200, { success: true, data: 1 }));
    const e4 = await err(A.createApiClient({ baseUrl: PROD, fetch: none, getToken: async () => null }).patch('/x', {}));
    const e5 = await err(A.createApiClient({ baseUrl: PROD, fetch: none }).get('/x', { auth: true }));
    chk(e4 && e4.kind === 'auth' && e4.code === 'NO_TOKEN' && e5 && e5.code === 'NO_TOKEN' && none.calls.length === 0, '  ↳ 토큰이 없으면 보내지 않고 auth(NO_TOKEN)');
    const nod = mkFetch(() => res(200, { success: true, data: 1 }));
    await A.createApiClient({ baseUrl: PROD, fetch: nod, getToken: async () => 't', deviceId: () => { throw new Error('x'); } }).get('/x', { auth: true });
    chk(nod.calls.length === 1 && !('X-Device-Id' in nod.calls[0].init.headers), '  ↳ 기기 id 를 못 얻으면 머리 없이(프리미엄만 아님 · 요청은 간다)');
  }

  say('── 8. ETag · 오류 봉투');
  {
    let body = { success: true, data: { v: 1 } };
    const f = mkFetch((url, init) => (init.headers['If-None-Match'] === '"e1"' ? res(304, null) : res(200, body, { ETag: '"e1"' })));
    const c = A.createApiClient({ baseUrl: PROD, fetch: f, getToken: async () => jwt('uA') });
    const a = await c.get('/v1/config');
    const b = await c.get('/v1/config');
    chk(a.v === 1 && b === a && !f.calls[0].init.headers['If-None-Match'] && f.calls[1].init.headers['If-None-Match'] === '"e1"', 'ETag 를 기억해 다음 읽기에 If-None-Match · 304 면 기억한 값');
    const ma = await c.get('/v1/me/x', { auth: true });
    const tok = { cur: jwt('uA') };
    const c2 = A.createApiClient({ baseUrl: PROD, fetch: f, getToken: async () => tok.cur });
    await c2.get('/v1/me/x', { auth: true });
    tok.cur = jwt('uB');
    const n0 = f.calls.length;
    await c2.get('/v1/me/x', { auth: true });
    chk(ma.v === 1 && !f.calls[n0].init.headers['If-None-Match'], '  ↳ 로그인 읽기는 토큰 주인(sub)마다 따로 — 다른 계정은 기억 값을 묻지 않는다');
    c.clearCache();
    await c.get('/v1/config');
    chk(!f.calls[f.calls.length - 1].init.headers['If-None-Match'], '  ↳ clearCache 는 ETag 기억도 지운다');
    const lost = mkFetch(() => res(304, null));
    const el = await err(A.createApiClient({ baseUrl: PROD, fetch: lost, backoffMs: 0 }).get('/z'));
    chk(el && el.kind === 'unavailable' && el.code === 'NOT_MODIFIED', '  ↳ 기억 없이 304 면 닿지 못함으로(빈 값을 돌려주지 않는다)');
    const many = mkFetch((url, init) => (init.headers['If-None-Match'] ? res(304, null) : res(200, { success: true, data: url }, { ETag: '"x"' })));
    const cm = A.createApiClient({ baseUrl: PROD, fetch: many, etagMax: 2 });
    await cm.get('/1'); await cm.get('/2'); await cm.get('/3');
    const k = many.calls.length; await cm.get('/1');
    chk(!many.calls[k].init.headers['If-None-Match'] && A.ETAG_MAX >= 16, '  ↳ 상한을 넘으면 오래된 기억부터 버린다(기본 ' + A.ETAG_MAX + ')');
    const one = async (fn) => err(A.createApiClient({ baseUrl: PROD, fetch: mkFetch(fn), backoffMs: 0, getToken: async () => 't' }).post('/w', {}));
    const ei = await one(() => res(409, { success: false, code: 'AVATAR_ITEM_NOT_USABLE', message: '입을 수 없는 물건', items: [{ itemId: 'p1', reason: 'LOCKED' }] }));
    chk(ei && ei.kind === 'request' && ei.status === 409 && ei.items && ei.items[0].itemId === 'p1' && ei.message === '입을 수 없는 물건', '  ↳ 실패 봉투의 code · message · items 를 잇는다');
    const er = await one(() => res(429, { success: false, code: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '7' }));
    chk(er && er.kind === 'request' && er.retryAfterMs === 7000, '  ↳ 429 는 Retry-After(초)를 retryAfterMs 로');
    chk(A.retryAfterMsOf('0') === 0 && A.retryAfterMsOf('') === null && A.retryAfterMsOf('Wed, 21 Oct 2015') === null && A.retryAfterMsOf(null) === null && A.retryAfterMsOf('-1') === null, '  ↳ Retry-After 경계 — 0 · 빈 값 · 날짜 · 음수');
    const nf = await one(() => res(404, { success: false, code: 'USER_NOT_FOUND' }));
    chk(nf && nf.kind === 'request' && nf.code === 'USER_NOT_FOUND', '  ↳ 자원이 없다는 404(USER_NOT_FOUND)는 request — 길이 없는 404 만 닿지 못함');
    const plain = await one(() => res(400, { success: false, code: 'INVALID_REQUEST' }));
    chk(plain && plain.items === null && plain.retryAfterMs === null, '  ↳ items · Retry-After 가 없으면 null');
    chk(A.tokenOwner(jwt('abc')) === 'abc' && /^t:/.test(A.tokenOwner('garbage')), '  ↳ 토큰 주인 읽기 — 못 읽으면 토큰 끝 글자로');
  }

  say('── 9. 모듈 · 배선');
  {
    const code = strip(SRC);
    chk(!/^\s*import\s/m.test(SRC) && !/firebase\/|firebase-|gstatic|getDatabase|require\(/.test(code), 'api-client.js 는 아무것도 import 하지 않는다(Firebase 모름)');
    const mkWin = (env, ls) => {
      const w = { fetch: () => {}, localStorage: memStore(ls || {}), companion: env ? { firebaseEnv: env } : undefined };
      w.window = w;
      vm.runInNewContext(SRC, { window: w, console, setTimeout, clearTimeout, AbortController, Promise, Map, Error, String, Date, encodeURIComponent });
      return w;
    };
    const wp = mkWin('prod'), wd = mkWin('dev'), wn = mkWin(null), wo = mkWin('dev', { 'tw.apiBaseUrl': 'https://api-x.togetherworking.duckdns.org' });
    chk(wp.TwApi && wp.TwApi.client && wp.TwApi.client.baseUrl() === PROD, 'window.TwApi · 앱 한 벌(client) — 운영 앱은 운영 API');
    chk(wd.TwApi.client.baseUrl() === DEV && wn.TwApi.client.baseUrl() === PROD && wo.TwApi.client.baseUrl() === 'https://api-x.togetherworking.duckdns.org', '  ↳ dev 앱 dev API · companion 없음(웹 · 검사) 운영 · dev 시험 주소');
    {
      const calls = [];
      let down = false;
      const w = { localStorage: memStore({}), TwMaintenance: { store: { touch(){ calls.push('touch'); } } }, TwDeviceId: { store: { get: () => 'dev-abc123' } },
        fetch: async (url, init) => { if(down) throw new TypeError('x'); calls.push(init.headers); return res(200, { success: true, data: 1 }); } };
      w.window = w;
      vm.runInNewContext(SRC, { window: w, console, setTimeout, clearTimeout, AbortController, Promise, Map, Error, String, Date, encodeURIComponent, atob });
      const e0 = await err(w.TwApi.authed.get('/v1/me', { auth: true }));
      w.TwApi.bindToken(async (force) => 'tok-' + (force ? 'f' : 'n'));
      await w.TwApi.authed.put('/v1/me/x', { a: 1 });
      const h = calls.filter((x) => typeof x === 'object').pop();
      chk(e0 && e0.code === 'NO_TOKEN' && h.Authorization === 'Bearer tok-n' && h['X-Device-Id'] === 'dev-abc123' && calls.includes('touch'),
        'authed(로그인 통로) — 토큰을 잇기 전엔 NO_TOKEN · bindToken 뒤 토큰 · 기기 머리(TwDeviceId) · 점검 창 touch');
      down = true;
      const eA = await err(w.TwApi.authed.get('/v1/me/friends', { auth: true }));
      const eC = await err(w.TwApi.client.get('/v1/config'));
      chk(eA && eA.code === 'NETWORK' && !w.TwApi.authed.resting() && eC && w.TwApi.client.resting(), '  ↳ 로그인 통로는 닿지 못해도 쉬지 않는다(다시 묻기를 막지 않게) · 공용 읽기 통로는 쉰다');
    }
    const iApi = HTML.indexOf('<script src="parts/shared/api-client.js"></script>'), iRc = HTML.indexOf('<script src="parts/shared/remote-config.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>'),
      iDev = HTML.indexOf('<script src="parts/shared/device-id.js"></script>'), iMt = HTML.indexOf('<script src="parts/shared/maintenance-gate.js"></script>');
    chk(iMt > 0 && iDev > iMt && iApi > iDev && iApi < iRc && iRc < iApp, 'html — maintenance-gate.js · device-id.js → api-client.js → remote-config.js → app.js 차례');
    const csp = [...HTML.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => (/connect-src ([^;]+);/.exec(m[1]) || [])[1] || '');
    const inCsp = (u) => csp.length === 2 && csp.every((c) => /(^| )https:\/\/\*\.together-working\.com( |$)/.test(c) && /(^| )https:\/\/\*\.togetherworking\.duckdns\.org( |$)/.test(c)) && A.API_BASE_RE.test(u);
    chk(inCsp(PROD) && inCsp(DEV), '  ↳ 운영 · dev API 주소가 CSP connect-src(https://*.together-working.com) 안 · 옛 duckdns 묶음도 그대로 열림');
  }

  say('── 10. 일부러 깨 보기');
  {
    /* 깨진 원본으로 핵심 동작 몇 가지를 다시 돌려 하나라도 틀리는지 본다 */
    const loadSrc = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
    async function probe(src){
      let bad = 0;
      const ok = (c) => { if(!c) bad++; };
      let M; try{ M = loadSrc(src); }catch(_){ return 99; }
      try{
        const f = mkFetch((url, init) => (init.headers['If-None-Match'] === '"e"' ? res(304, null) : res(200, { success: true, data: { u: url } }, { ETag: '"e"' })));
        const c = M.createApiClient({ baseUrl: PROD, fetch: f, getToken: async () => 'tk', deviceId: () => 'dev-0001' });
        const a = await c.get('/a'); const b = await c.get('/a');
        ok(b === a && f.calls.length === 2);
        await c.get('/m', { auth: true });
        ok(f.calls[2].init.headers['X-Device-Id'] === 'dev-0001');
        await c.del('/d');
        ok(f.calls[3].init.method === 'DELETE' && f.calls[3].init.body === undefined && f.calls[3].init.headers.Authorization === 'Bearer tk');
        let n = 0; const forces = [];
        const g = mkFetch(() => (++n === 1 ? res(401, { success: false, code: 'AUTH_REQUIRED' }) : res(200, { success: true, data: 1 })));
        ok((await M.createApiClient({ baseUrl: PROD, fetch: g, getToken: async (x) => { forces.push(x); return 't'; } }).get('/r', { auth: true })) === 1 && forces[1] === true);
        const h = mkFetch(() => res(401, { success: false, code: 'AUTH_REQUIRED' }));
        await err(M.createApiClient({ baseUrl: PROD, fetch: h, getToken: async () => 't' }).get('/r', { auth: true }));
        ok(h.calls.length === 2);
        const nb = mkFetch(() => res(401, { success: false, code: 'USER_CODE_NOT_BOUND' }));
        await err(M.createApiClient({ baseUrl: PROD, fetch: nb, getToken: async () => 't' }).get('/me', { auth: true }));
        ok(nb.calls.length === 1);
        const e1 = await err(M.createApiClient({ baseUrl: PROD, fetch: mkFetch(() => res(404, { success: false, code: 'USER_NOT_FOUND' })), backoffMs: 0 }).get('/x'));
        ok(e1 && e1.kind === 'request');
        const e2 = await err(M.createApiClient({ baseUrl: PROD, fetch: mkFetch(() => res(429, { success: false, code: 'TOO_MANY_REQUESTS', items: [1] }, { 'Retry-After': '3' })), getToken: async () => 't' }).post('/x', {}));
        ok(e2 && e2.retryAfterMs === 3000 && e2.items && e2.items[0] === 1);
        const pb = mkFetch(() => res(200, { success: true, data: 1 }));
        const ep = await err(M.createApiClient({ baseUrl: PROD, fetch: pb }).post('/p', {}));
        ok(ep && ep.code === 'NO_TOKEN' && pb.calls.length === 0);
        const u = mkFetch((url, init) => res(200, { success: true, data: init.headers['If-None-Match'] || null }, { ETag: '"z"' }));
        const tk = { v: jwt('A') };
        const cu = M.createApiClient({ baseUrl: PROD, fetch: u, getToken: async () => tk.v });
        await cu.get('/me', { auth: true }); tk.v = jwt('B');
        ok((await cu.get('/me', { auth: true })) === null);
        const w = { localStorage: memStore({}), TwMaintenance: { store: { touch(){} } }, TwDeviceId: { store: { get: () => 'dev-0001' } }, fetch: async () => { throw new TypeError('x'); } };
        w.window = w;
        vm.runInNewContext(src, { window: w, console, setTimeout, clearTimeout, AbortController, Promise, Map, Error, String, Date, encodeURIComponent, atob });
        w.TwApi.bindToken(async () => 't');
        await err(w.TwApi.authed.get('/x', { auth: true }));
        ok(!w.TwApi.authed.resting());
      }catch(_){ bad++; }
      return bad;
    }
    chk((await probe(SRC)) === 0, '원본은 핵심 동작을 다 지킨다');
    const BREAKS = [
      ["        if(memo) headers['If-None-Match'] = memo.etag;", '', 'If-None-Match 를 안 보냄'],
      ["    if(typeof dev === 'string' && dev) h[DEVICE_HEADER] = dev;", '', '기기 머리를 안 붙임'],
      ["      return once(path, ms, Object.assign({}, o, { force: true }));", "      return once(path, ms, o);", '다시 할 때 새 토큰을 안 받음'],
      ["      if(!(o.auth && e instanceof ApiError && e.status === 401 && e.code === 'AUTH_REQUIRED')) throw e;", "      if(!(e instanceof ApiError && e.status === 401)) throw e;", '가입 전 · 로그인 없는 401 도 다시 보냄'],
      ["    if(status === 404 && NO_ROUTE_CODES.indexOf(code) >= 0)", "    if(status === 404)", '자원 없음 404 를 닿지 못함으로'],
      ["retryAfterMs: status === 429 ? retryAfterMsOf(headerOf(res, 'Retry-After')) : null", "retryAfterMs: null", 'Retry-After 를 버림'],
      ["    o.auth = o.auth !== false;", "", '쓰기가 로그인 없이 감'],
      ["    authed = createApiClient({ baseUrl, fetch: fetchFn, onRequest: touch, backoffMs: 0,", "    authed = createApiClient({ baseUrl, fetch: fetchFn, onRequest: touch,", '로그인 통로가 쉬기를 씀'],
      ["if(method !== 'GET' && !(method === 'DELETE' && o.body === undefined)){", "if(method !== 'GET'){", '본문 없는 DELETE 에 null 본문'],
      ["        memoKey = a.who + ' ' + path;", "        memoKey = path;", 'ETag 기억을 계정끼리 섞음'],
    ];
    const missed = [];
    for(const [from, to, what] of BREAKS){
      if(SRC.indexOf(from) < 0){ missed.push('글 못 찾음: ' + what); continue; }
      if((await probe(SRC.split(from).join(to))) === 0) missed.push(what);
    }
    chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
