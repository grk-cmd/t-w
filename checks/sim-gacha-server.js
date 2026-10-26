/* ═══ 🎰 sim-gacha-server.js — 가챠 서버 길(character/gacha-server.js) ═══════════════
   서버가 뽑고 서버가 저장한다 — 이 파일은 요청 모양 · 응답 씻기 · 실패 이유를 가짜 통로 위에서 실제로 굴려 본다.
   ・1절: 순수 — stateOf(모양 · 경계 0 · 상한 · 모르는 시즌) · resultsOf(틀린 줄 버림) · reasonOf · clampCount(0 · 상한 · 숫자 아님)
   ・2절: load — 로그인 통로 GET · 시간 제한 · 모양이 틀리면 던진다
   ・3절: draw — POST 본문(횟수 · 요청 이름 · 로그인) · 성공 모양 · 실패(닿지 못함 · 시간 초과 · 로그인 · 틀린 응답) — 옛 길로 넘기지 않는다
   ・4절: 깨 보기 — 씻기를 빼거나 횟수 상한을 풀면 빨강
   [실행] apps/desktop/app 또는 저장소 루트에서(러너가 스테이징한 폴더 포함). */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const FILE = [__dirname, process.cwd()].flatMap(d => ['gacha-server.js', 'parts/character/gacha-server.js', 'app/parts/character/gacha-server.js', 'apps/desktop/app/parts/character/gacha-server.js']
  .map(p => path.join(d, p))).find(p => fs.existsSync(p));
if(!FILE){ say('  ? 원본 못 찾음 — gacha-server.js'); process.exit(2); }
const SRC = fs.readFileSync(FILE, 'utf8');
const load = (src) => { const ctx = { window: {}, Math, JSON, Object, Array, Number, String, Error, Promise, isFinite }; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.TwGachaServer; };

/* 가짜 로그인 통로 — 부른 것을 적고, reply 가 정한 값을 돌려주거나 던진다 */
function mkPipe(reply){
  const calls = [];
  const fn = (kind) => async (p, a, b) => { const c = kind === 'get' ? { kind, path: p, opts: a } : { kind, path: p, body: a, opts: b }; calls.push(c); return reply(c); };
  return { calls, get: fn('get'), post: fn('post') };
}
const OK = { owned: { a: 2, b: 0, c: -1, d: 1.7, e: 'x', f: 20000 }, ts: 10, earned: 4, left: 1, season: 'winter' };
const apiErr = (kind, code, status) => Object.assign(new Error(kind), { kind, code: code || '', status: status || 0 });

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + String(e && e.stack || e).split('\n').slice(0, 2).join(' / ')); } };
const M = load(SRC);

await sec('── 1. 순수', () => {
  chk(Object.keys(M).includes('createGachaServer') && M.GACHA_PATH === '/v1/me/gacha' && M.DRAWS_PATH === '/v1/me/gacha/draws', '경로 상수 — 서버 규격과 같다');
  const st = M.stateOf(OK);
  chk(st && JSON.stringify(st.owned) === '{"a":2,"d":1,"f":9999}' && st.earned === 4 && st.left === 1 && st.season === 'winter' && st.ts === 10,
      'stateOf — 0 · 음수 · 숫자 아님은 빼고 · 소수는 내림 · 상한 9999 (' + JSON.stringify(st && st.owned) + ')');
  chk(M.stateOf({ owned: {}, earned: 0, left: 0 }).season === null && M.stateOf({ owned: {}, earned: 0, left: 0, season: 'fall' }).season === null, '  모르는 시즌 · 없음은 null(이 PC 시계로)');
  chk(M.stateOf(null) === null && M.stateOf({ owned: [], earned: 1, left: 1 }) === null && M.stateOf({ owned: {}, earned: -1, left: 0 }) === null
      && M.stateOf({ owned: {}, left: 0 }) === null && M.stateOf({ owned: {}, earned: 1, left: 'x' }) === null, '  모양이 틀리면 null — owned 배열 · 음수 · 빠진 칸');
  const rs = M.resultsOf([{ partId: 'a', count: 1, isNew: true }, { partId: '', count: 1 }, { partId: 'b', count: 0 }, null, { partId: 'c', count: 4, colorUnlocked: true }]);
  chk(rs.length === 2 && rs[0].id === 'a' && rs[0].isNew && !rs[0].unlockedColor && rs[1].id === 'c' && rs[1].unlockedColor && !rs[1].isNew, 'resultsOf — 틀린 줄(빈 id · 0개 · null)은 버리고 이름을 앱 모양으로');
  chk(M.resultsOf(null) === null && M.resultsOf([]).length === 0, '  배열이 아니면 null · 빈 배열은 빈 결과');
  chk(M.reasonOf(apiErr('unavailable', 'TIMEOUT')) === 'timeout' && M.reasonOf(apiErr('unavailable', 'NETWORK')) === 'offline' && M.reasonOf(apiErr('notReady'))
      === 'offline' && M.reasonOf(apiErr('auth', 'NO_TOKEN')) === 'nouser' && M.reasonOf(apiErr('request', '', 400)) === 'error' && M.reasonOf(null) === 'error', 'reasonOf — 시간 초과 · 닿지 못함 · 로그인 · 그 밖');
  chk(M.clampCount(0) === 1 && M.clampCount(5) === 5 && M.clampCount(10) === 10 && M.clampCount(11) === 10 && M.clampCount('x') === 1 && M.clampCount(2.9) === 2, 'clampCount — 1..10 · 숫자 아님은 1');
});

await sec('── 2. load', async () => {
  const p = mkPipe(() => OK);
  const G = M.createGachaServer({ get: p.get, post: p.post, newRequestId: () => 'rid-1' });
  const st = await G.load();
  chk(p.calls.length === 1 && p.calls[0].kind === 'get' && p.calls[0].path === '/v1/me/gacha' && p.calls[0].opts.auth === true && p.calls[0].opts.timeoutMs === M.LOAD_TIMEOUT_MS && st.left === 1,
      '로그인 통로로 GET 한 번 · 시간 제한');
  let threw = null;
  try{ await M.createGachaServer({ get: async () => ({ owned: 1 }), post: p.post, newRequestId: () => 'r' }).load(); }catch(e){ threw = e; }
  chk(threw && threw.code === 'BAD_SHAPE', '  모양이 틀리면 던진다(부르는 쪽은 «못 읽음» — 착용을 벗기지 않는다)');
  threw = null;
  try{ await M.createGachaServer({ get: async () => { throw apiErr('unavailable'); }, post: p.post, newRequestId: () => 'r' }).load(); }catch(e){ threw = e; }
  chk(threw && threw.kind === 'unavailable', '  통로 실패도 그대로 던진다');
});

await sec('── 3. draw', async () => {
  let ids = 0;
  const p = mkPipe((c) => Object.assign({ results: [{ partId: 'a', count: 3 }] }, OK));
  const G = M.createGachaServer({ get: p.get, post: p.post, newRequestId: () => 'rid-' + (++ids) });
  let r = await G.draw(25);
  const c = p.calls[0];
  chk(c.kind === 'post' && c.path === '/v1/me/gacha/draws' && c.body.count === 10 && c.body.requestId === 'rid-1' && c.opts.auth === true && c.opts.timeoutMs === M.DRAW_TIMEOUT_MS,
      'POST 본문 — 횟수는 상한 10 · 요청 이름 · 로그인 · 뽑기 시간 제한 (' + JSON.stringify(c.body) + ')');
  chk(r.ok && r.out.length === 1 && r.out[0].id === 'a' && r.out[0].count === 3 && r.state.left === 1, '  성공 — 결과 · 서버 상태');
  await G.draw(1);
  chk(p.calls[1].body.requestId === 'rid-2' && p.calls[1].body.count === 1, '  누를 때마다 새 요청 이름');
  const cases = [[apiErr('unavailable', 'TIMEOUT'), 'timeout'], [apiErr('unavailable', 'NETWORK'), 'offline'], [apiErr('auth', 'USER_CODE_NOT_BOUND', 401), 'nouser'], [apiErr('request', 'X', 400), 'error']];
  for(const [err, want] of cases){
    const q = mkPipe(() => { throw err; });
    r = await M.createGachaServer({ get: q.get, post: q.post, newRequestId: () => 'r' }).draw(1);
    chk(!r.ok && r.reason === want && q.calls.length === 1, '실패 ' + (err.code || err.kind) + ' → ' + want + ' · 한 번만(옛 길로 넘기지 않음)');
  }
  for(const bad of [null, { results: [] }, Object.assign({}, OK), Object.assign({ results: 'x' }, OK)]){
    const q = mkPipe(() => bad);
    r = await M.createGachaServer({ get: q.get, post: q.post, newRequestId: () => 'r' }).draw(1);
    chk(!r.ok && r.reason === 'error', '  틀린 응답 → error (' + JSON.stringify(bad).slice(0, 40) + ')');
  }
  const q = mkPipe(() => Object.assign({ results: [] }, OK));
  r = await M.createGachaServer({ get: q.get, post: q.post, newRequestId: () => 'r' }).draw(1);
  chk(r.ok && r.out.length === 0, '  빈 결과(남은 뽑기 없음 · 풀 빔)는 성공 — 앱이 이유를 말한다');
});

await sec('── 4. 깨 보기', async () => {
  const broke = (from, to) => { const s = SRC.replace(from, to); return s === SRC ? null : load(s); };
  const B1 = broke('if(n) out[k] = Math.min(OWNED_MAX, n);', 'out[k] = raw[k];');
  chk(B1 && JSON.stringify(B1.stateOf(OK).owned) !== '{"a":2,"d":1,"f":9999}', '보유분 씻기를 빼면 1절 판정이 빨강이 된다');
  const B2 = broke('Math.min(COUNT_MAX, ', 'Math.min(Infinity, ');
  chk(B2 && B2.clampCount(11) !== 10, '횟수 상한을 풀면 빨강이 된다');
  const B3 = broke("if(e.code === 'TIMEOUT') return 'timeout';", '');
  chk(B3 && B3.reasonOf(apiErr('unavailable', 'TIMEOUT')) !== 'timeout', '시간 초과를 따로 안 가르면 빨강이 된다');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
