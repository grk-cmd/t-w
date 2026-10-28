/* sim-api-errors.js — 🧭 서버 오류 봉투 → 할 일 · 오류 번호 번역표(shared/api-errors.js) 검사
   ・1절: 공통 code — 진짜 api-client.js 로 만든 실패(가짜 fetch)가 번역표를 지나 맞는 할 일 · 번호가 된다
   ・2절: 기능 표 — 기능의 code 가 먼저 · 같은 code 도 기능 표가 이긴다 · 표에 없는 4xx 는 E-NET-08 · items · retryAfterMs 를 잇는다
   ・3절: 번호 — 표의 번호는 다 error-codes.js 에 있다 · 점검 · 가입 전은 토스트 없음
   ・4절: 배선 — window.TwApiErrors 한 벌이 TwErrorCodes.notify 를 부를 때 찾는다 · html 차례(error-codes · api-client → api-errors → app.js)
   ・5절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  AE: pick(at('api-errors.js', 'shared')),
  AC: pick(at('api-client.js', 'shared')),
  EC: pick(at('error-codes.js', 'shared')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const asModule = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const PROD = 'https://api.together-working.com';
const res = (status, body, hdr) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => (hdr || {})[k] || null }, json: async () => body });
const fail_ = async (A, fn, call) => { try{ await call(A.createApiClient({ baseUrl: PROD, fetch: async () => fn(), backoffMs: 0, getToken: async () => 't' })); return null; }catch(e){ return e; } };

async function judge(S){
  let E, A, C;
  try{ E = asModule(S.AE); A = asModule(S.AC); C = asModule(S.EC); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  const notes = [];
  const AE = E.createApiErrors({ notifyError: (code, err, text) => { notes.push(code); return true; } });
  const run = async (fn, call, table) => { notes.length = 0; const e = await fail_(A, fn, call || ((c) => c.get('/x', { auth: true }))); return Object.assign(AE.notify(e, table), { notes: notes.slice(), e }); };

  say('── 1. 공통 code');
  const cases = [
    ['401 AUTH_REQUIRED(다시 해도)', () => res(401, { success: false, code: 'AUTH_REQUIRED' }), 'login', 'E-NET-01'],
    ['401 가입 전', () => res(401, { success: false, code: 'USER_CODE_NOT_BOUND' }), 'signup', null],
    ['503 점검', () => res(503, { success: false, code: 'SERVER_ADMIN_ONLY' }), 'maintenance', null],
    ['403 권한', () => res(403, { success: false, code: 'ACCESS_DENIED' }), 'notice', 'E-NET-02'],
    ['403 프리미엄', () => res(403, { success: false, code: 'PREMIUM_REQUIRED' }), 'notice', 'E-NET-03'],
    ['429', () => res(429, { success: false, code: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '5' }), 'later', 'E-NET-04'],
    ['409 동시 수정', () => res(409, { success: false, code: 'CONCURRENT_UPDATE' }), 'refetch', 'E-NET-05'],
    ['400 모양', () => res(400, { success: false, code: 'INVALID_REQUEST' }), 'notice', 'E-NET-06'],
    ['413', () => res(413, { success: false, code: 'PAYLOAD_TOO_LARGE' }), 'notice', 'E-NET-06'],
    ['네트워크', () => { throw new TypeError('Failed to fetch'); }, 'offline', 'E-NET-07'],
    ['500', () => res(500, { success: false, code: 'INTERNAL_ERROR' }), 'offline', 'E-NET-07'],
    ['503 사본 없음', () => res(503, { success: false, code: 'PUBLIC_CONFIG_NOT_READY' }), 'offline', 'E-NET-07'],
    ['모르는 409', () => res(409, { success: false, code: 'SOMETHING_NEW' }), 'notice', 'E-NET-08'],
  ];
  const bad = [];
  for(const [name, fn, action, code] of cases){
    const t = await run(fn);
    if(t.action !== action || (code ? t.notes.join() !== code : t.notes.length !== 0)) bad.push(name + '=' + t.action + '/' + t.notes.join());
  }
  chk(!bad.length, '★ 진짜 통로의 실패 → 할 일 · 번호(로그인 · 가입 · 점검 · 권한 · 프리미엄 · 잦음 · 동시 수정 · 모양 · 닿지 못함 · 모르는 code)' + (bad.length ? ' — 틀림: ' + bad.join(', ') : ''));
  const t429 = await run(() => res(429, { success: false, code: 'TOO_MANY_REQUESTS' }, { 'Retry-After': '5' }));
  chk(t429.retryAfterMs === 5000, '  ↳ 잦음은 retryAfterMs 를 그대로(' + t429.retryAfterMs + ')');
  const tNo = await run(() => res(200, { success: true, data: 1 }), (c) => A.createApiClient({ baseUrl: PROD, fetch: async () => res(200, {}) }).put('/x', {}));
  chk(tNo.action === 'login' && tNo.notes.join() === 'E-NET-01', '  ↳ 토큰 없음(NO_TOKEN — 보내지도 않음)도 로그인');
  chk(E.translate(new Error('x')).action === 'offline' && E.translate(null).action === 'offline', '  ↳ 통로가 아닌 오류 · 빈 값은 닿지 못함으로');

  say('── 2. 기능 표');
  const mine = { GIFT_DAILY_LIMIT: { action: 'later', notice: (n, e) => n('E-TEST-01', e) }, CONCURRENT_UPDATE: { action: 'notice', notice: null } };
  const g = await run(() => res(429, { success: false, code: 'GIFT_DAILY_LIMIT', message: '오늘은 더 보낼 수 없어요.' }), null, mine);
  chk(g.action === 'later' && g.notes.join() === 'E-TEST-01', '기능 code 는 기능 표대로');
  const c2 = await run(() => res(409, { success: false, code: 'CONCURRENT_UPDATE' }), null, mine);
  chk(c2.action === 'notice' && c2.notes.length === 0, '  ↳ 같은 code 도 기능 표가 공통보다 먼저');
  const c3 = await run(() => res(403, { success: false, code: 'ACCESS_DENIED' }), null, mine);
  chk(c3.notes.join() === 'E-NET-02', '  ↳ 기능 표에 없으면 공통 표');
  const it = await run(() => res(409, { success: false, code: 'AVATAR_ITEM_NOT_USABLE', items: [{ itemId: 'p9', reason: 'LOCKED' }] }), (c) => c.put('/v1/me/avatars/1', {}));
  chk(it.action === 'notice' && it.notes.join() === 'E-NET-08' && it.items && it.items[0].itemId === 'p9' && it.code === 'AVATAR_ITEM_NOT_USABLE', '  ↳ 아무 표에도 없는 4xx 는 E-NET-08 · items · code 를 잇는다');
  chk(E.translate({ kind: 'request', code: 'toString' }).action === 'notice' && E.translate({ kind: 'request', code: 'constructor' }).action === 'notice', '  ↳ 표 찾기는 제 칸만(toString 같은 이름에 속지 않음)');

  say('── 3. 번호');
  const rows = Object.values(E.COMMON).concat([E.OFFLINE, E.UNKNOWN]);
  const used = new Set(); rows.forEach((r) => { if(r.notice) r.notice((c) => used.add(c), null); });
  const missing = [...used].filter((c) => !C.CODES[c]);
  chk(used.size >= 8 && !missing.length, '표가 부르는 번호 ' + used.size + '개가 다 error-codes.js 에 있다' + (missing.length ? ' — 없음: ' + missing.join(', ') : ''));
  chk(!E.COMMON.SERVER_ADMIN_ONLY.notice && !E.COMMON.USER_CODE_NOT_BOUND.notice, '  ↳ 점검 · 가입 전은 토스트 없음(점검 창 · 가입 화면이 안내)');

  say('── 4. 배선');
  {
    const calls = [];
    const w = { TwErrorCodes: null };
    new Function('module', 'window', S.AE)(undefined, w);
    w.TwErrorCodes = { notify: (...a) => { calls.push(a[0]); return true; } };   // 실릴 땐 없고 부를 때 찾는다
    const t = w.TwApiErrors && w.TwApiErrors.store ? w.TwApiErrors.store.notify({ kind: 'auth', code: 'ACCESS_DENIED' }) : null;
    chk(t && t.action === 'notice' && calls.join() === 'E-NET-02', 'window.TwApiErrors.store — TwErrorCodes.notify 를 부를 때 찾는다');
    const h = S.HTML, i = (f) => h.indexOf('<script src="parts/shared/' + f + '"></script>');
    chk(i('error-codes.js') > 0 && i('api-client.js') > i('error-codes.js') && i('api-errors.js') > i('api-client.js') && h.indexOf('<script src="parts/app.js"></script>') > i('api-errors.js'),
      'html — error-codes.js · api-client.js → api-errors.js → app.js 차례');
  }
}

(async () => {
await judge(SRC0);

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ['AE', "  if(code && own(table, code)) row = table[code];\n  else if(code && own(COMMON, code)) row = COMMON[code];", "  if(code && own(COMMON, code)) row = COMMON[code];\n  else if(code && own(table, code)) row = table[code];", '공통 표가 기능 표를 덮음'],
  ['AE', "  SERVER_ADMIN_ONLY: { action: ACTION.MAINTENANCE, notice: null },", "", '점검을 닿지 못함으로 봄'],
  ['AE', "  USER_CODE_NOT_BOUND: { action: ACTION.SIGNUP, notice: null },", "  USER_CODE_NOT_BOUND: { action: ACTION.LOGIN, notice: null },", '가입 전을 로그인 풀림으로'],
  ['AE', "  NO_TOKEN: { action: ACTION.LOGIN, notice: (notifyError, e) => notifyError('E-NET-01', e) },", "", '토큰 없음을 모르는 오류로'],
  ['AE', "  else if(kind === 'unavailable' || kind === 'notReady' || !kind) row = OFFLINE;", "  else if(kind === 'unavailable') row = OFFLINE;", '사본 없음을 모르는 오류로'],
  ['AE', "    if(t.notice) t.notice(notifyError, err);", "", '번호 토스트를 안 냄'],
  ['AE', "    retryAfterMs: (err && typeof err.retryAfterMs === 'number') ? err.retryAfterMs : null,", "    retryAfterMs: null,", 'Retry-After 를 버림'],
  ['AE', "const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);", "const own = (o, k) => !!o && k in o;", '표 찾기가 물려받은 이름에 속음'],
  ['AE', "  api.store = createApiErrors({ notifyError: (...a) => window.TwErrorCodes.notify(...a) });", "  api.store = createApiErrors({ notifyError: window.TwErrorCodes ? window.TwErrorCodes.notify : () => false });", '실릴 때 찾아 붙잡음(부를 때 못 찾음)'],
  ['EC', "  'E-NET-03': {", "  'E-NET-93': {", '번호가 error-codes.js 에 없음'],
  ['HTML', '<script src="parts/shared/api-errors.js"></script>', '', 'html 에 안 실음'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, k]) => k === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
