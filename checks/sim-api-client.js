/* ═══ 🌐 sim-api-client.js — 앱 공통 API 통로(api-client.js · window.TwApi) ═══════════════
   [왜] 읽기 사본이 있는 것은 우리 API(t-w-server)에서 먼저 읽고, 못 받으면 Firebase 길로 간다. 시간 제한 · 봉투 · 실패 모양 · 쉬기를 한 곳에서.
   1. 주소 — 운영 앱은 운영 API · dev 앱은 dev API(tw.apiBaseUrl 은 dev 만 · CSP 묶음 안 · 운영 API 아님) · 환경은 companion.firebaseEnv
   2. 성공 — 봉투 { success, data } 의 data · 토큰 · 쿠키 없이 · 주소 = 기본 + 경로
   3. 실패 한 모양 — 네트워크 · 시간 초과 · 5xx · 404 · 봉투 아님 → unavailable · *_NOT_READY → notReady · 401/403 → auth · 그 밖 4xx → request · shouldFallback
   4. 쉬기 — unavailable 뒤 BACKOFF_MS 동안 묻지 않고 곧장 실패(BACKOFF) · 지나면 다시 · notReady · 성공은 쉬지 않음
   5. 캐시 · 같은 요청 하나로 · 주소 없음
   6. 모듈 — Firebase 모름 · window.TwApi · 앱 한 벌(client) 주소 · html 차례
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
const PROD = 'https://api.togetherworking.duckdns.org', DEV = 'https://api-dev.togetherworking.duckdns.org';
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => { if(body instanceof Error) throw body; return body; } });
const mkFetch = (fn) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return fn(url, init, calls.length); }; f.calls = calls; return f; };
const err = async (p) => { try{ await p; return null; }catch(e){ return e; } };

(async () => {
  say('── 1. 주소');
  {
    chk(A.API_BASE_PROD === PROD && A.API_BASE_DEV === DEV, '운영 · dev API 주소');
    chk(A.apiBaseFor('prod', memStore({ 'tw.apiBaseUrl': 'https://x.togetherworking.duckdns.org' })) === PROD && A.apiBaseFor(undefined, null) === PROD, '★ 운영 앱은 늘 운영 API(시험 주소 무시)');
    chk(A.apiBaseFor('dev', memStore()) === DEV && A.apiBaseFor('dev', null) === DEV, 'dev 앱은 dev API');
    chk(A.apiBaseFor('dev', memStore({ 'tw.apiBaseUrl': 'https://api-test.togetherworking.duckdns.org/' })) === 'https://api-test.togetherworking.duckdns.org', '  ↳ dev 앱만 tw.apiBaseUrl(끝 / 무시)');
    chk(['https://evil.example', 'http://api-test.togetherworking.duckdns.org', 'https://a.togetherworking.duckdns.org.evil.com', 'https://a.b.togetherworking.duckdns.org', PROD]
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

  say('── 6. 모듈 · 배선');
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
    const iApi = HTML.indexOf('<script src="parts/api-client.js"></script>'), iRc = HTML.indexOf('<script src="parts/remote-config.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iApi > 0 && iApi < iRc && iRc < iApp, 'html — api-client.js → remote-config.js → app.js 차례');
    const csp = [...HTML.matchAll(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/g)].map((m) => (/connect-src ([^;]+);/.exec(m[1]) || [])[1] || '');
    const inCsp = (u) => csp.length === 2 && csp.every((c) => /(^| )https:\/\/\*\.togetherworking\.duckdns\.org( |$)/.test(c)) && A.API_BASE_RE.test(u);
    chk(inCsp(PROD) && inCsp(DEV), '  ↳ 운영 · dev API 주소가 CSP connect-src(https://*.togetherworking.duckdns.org) 안');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
