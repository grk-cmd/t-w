/* ═══ 🎰 sim-gacha-api.js — 가챠 api provider(character/gacha-api.js) ═══════════════
   서버가 뽑고 서버가 저장한다 — 요청 모양 · 응답 씻기 · 실패 이유 · 계정 묶기를 가짜 통로 위에서 실제로 굴려 본다.
   ・1절: 순수 — stateOf(모양 · 0 개 · 모르는 시즌) · resultsOf · reasonOf · clampCount
   ・2절: load — 두 GET · 토큰 주인 기억 · 모양이 틀리면 던짐 · 실패도 던짐
   ・3절: draw — 받기 전 거절 · 본문 · 주인 묶기 · 성공 · 실패 이유 · 틀린 응답
   ・4절: 깨 보기
   [실행] 저장소 루트에서 node checks/run.js sim-gacha-api */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const FILE = [__dirname, process.cwd()].flatMap(d => ['gacha-api.js', 'parts/character/gacha-api.js', 'app/parts/character/gacha-api.js', 'apps/desktop/app/parts/character/gacha-api.js']
  .map(p => path.join(d, p))).find(p => fs.existsSync(p));
if(!FILE){ say('  ? 원본 못 찾음 — gacha-api.js'); process.exit(2); }
const SRC = fs.readFileSync(FILE, 'utf8');
const load = (src) => { const ctx = { window: {}, Math, JSON, Object, Array, Number, String, Error, Promise, isFinite }; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.TwGachaApi; };

const ITEMS = { items: [{ partId: 'a', count: 2, colorUnlocked: false }, { partId: 'b', count: 0 }, { partId: 'c', count: 4, colorUnlocked: true }, { partId: '', count: 1 }, { partId: 'd', count: -1 }, { partId: 'e', count: 1.5 }] };
const GACHA = { earned: 4, bonus: 1, left: 1, season: 'WINTER' };   // 서버 실물 모양(대문자)
const apiErr = (kind, code, status) => Object.assign(new Error(kind), { kind, code: code || '', status: status || 0 });

/* 가짜 로그인 통로 — 부른 것을 적고, reply 가 정한 값을 돌려주거나 던진다. 읽을 때 onOwner 로 주인을 알린다 */
function mkAuthed(reply, who){
  const calls = [];
  return {
    calls,
    get: async (p, o) => { calls.push({ kind: 'get', path: p, opts: o }); const r = reply({ kind: 'get', path: p }); if(o && o.onOwner) o.onOwner(who || 'uA'); return r; },
    post: async (p, b, o) => { calls.push({ kind: 'post', path: p, body: b, opts: o }); return reply({ kind: 'post', path: p, body: b }); },
  };
}
const okReply = (c) => c.kind === 'get' ? (c.path === '/v1/me/collection' ? ITEMS : GACHA) : { results: [{ partId: 'a', count: 3, isNew: false }], items: ITEMS.items, gacha: GACHA };

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + String(e && e.stack || e).split('\n').slice(0, 2).join(' / ')); } };
const M = load(SRC);
const mk = (a, ids) => { let n = 0; return M.createGachaApi({ authed: a, newRequestId: () => 'rid-' + (++n) }); };

await sec('── 1. 순수', () => {
  chk(M.PATHS.collection === '/v1/me/collection' && M.PATHS.gacha === '/v1/me/gacha' && M.PATHS.draws === '/v1/me/gacha/draws', '경로 상수 — 서버 규격과 같다');
  const st = M.stateOf(ITEMS.items, GACHA);
  chk(st && JSON.stringify(st.owned) === '{"a":2,"c":4,"e":1}' && JSON.stringify(st.unlocked) === '{"c":true}' && st.earned === 4 && st.bonus === 1 && st.left === 1 && st.season === 'winter',
      'stateOf — 0 · 음수 · 빈 id 는 안 가짐으로 · 소수는 내림 · 해금은 서버 값 (' + JSON.stringify(st) + ')');
  chk(M.stateOf([], { earned: 0, bonus: 0, left: 0 }).season === null && M.stateOf([], { earned: 0, bonus: 0, left: 0, season: 'fall' }).season === null, '  모르는 시즌 · 없음은 null');
  chk(M.stateOf([], { earned: 0, bonus: 0, left: 0, season: 'SPRING' }).season === 'spring' && M.stateOf([], { earned: 0, bonus: 0, left: 0, season: 'spring' }).season === 'spring' && M.stateOf([], { earned: 0, bonus: 0, left: 0, season: 7 }).season === null, '  대문자(SPRING)도 소문자 앱 키로 — 서버가 대문자로 준다');
  chk(M.stateOf(null, GACHA) === null && M.stateOf([], null) === null && M.stateOf([], { earned: -1, bonus: 0, left: 0 }) === null && M.stateOf([], { earned: 1, left: 0 }) === null
      && M.stateOf([], { earned: 1, bonus: 0, left: 'x' }) === null, '  모양이 틀리면 null — 목록 아님 · 음수 · 빠진 칸');
  chk(M.stateOf([], GACHA).owned && Object.keys(M.stateOf([], GACHA).owned).length === 0, '  빈 목록은 빈 보유분(성공)');
  const rs = M.resultsOf([{ partId: 'a', count: 1, isNew: true }, { partId: '', count: 1 }, { partId: 'b', count: 0 }, null, { partId: 'c', count: 4, colorUnlocked: true }]);
  chk(rs.length === 2 && rs[0].id === 'a' && rs[0].isNew && !rs[0].unlockedColor && rs[1].id === 'c' && rs[1].unlockedColor && !rs[1].isNew, 'resultsOf — 틀린 줄은 버리고 이름을 앱 모양으로');
  chk(M.resultsOf(null) === null && M.resultsOf([]).length === 0, '  배열이 아니면 null · 빈 배열은 빈 결과');
  chk(M.reasonOf(apiErr('unavailable', 'TIMEOUT')) === 'timeout' && M.reasonOf(apiErr('unavailable', 'NETWORK')) === 'offline' && M.reasonOf(apiErr('notReady')) === 'offline'
      && M.reasonOf(apiErr('auth', 'NO_TOKEN')) === 'nouser' && M.reasonOf(apiErr('auth', 'OWNER_CHANGED')) === 'nouser' && M.reasonOf(apiErr('request', '', 400)) === 'error' && M.reasonOf(null) === 'error',
      'reasonOf — 시간 초과 · 닿지 못함 · 로그인 · 계정 바뀜 · 그 밖');
  chk(M.reasonOf(apiErr('unavailable', 'GACHA_BUSY', 503)) === 'error' && M.reasonOf(apiErr('notReady', 'CATALOG_NOT_READY', 503)) === 'error' && M.reasonOf(apiErr('unavailable', '', 503)) === 'offline',
      '  서버가 살아 있는데 못 하는 것은 «잠시 후 다시»(error)');
  chk(M.clampCount(0) === 1 && M.clampCount(5) === 5 && M.clampCount(10) === 10 && M.clampCount(11) === 10 && M.clampCount('x') === 1 && M.clampCount(2.9) === 2, 'clampCount — 1..10 · 숫자 아님은 1');
});

await sec('── 2. load', async () => {
  const a = mkAuthed(okReply);
  const st = await mk(a).load();
  const paths = a.calls.map(c => c.path).sort().join(',');
  chk(a.calls.length === 2 && paths === '/v1/me/collection,/v1/me/gacha' && a.calls.every(c => c.opts.auth === true && c.opts.timeoutMs === M.LOAD_TIMEOUT_MS && typeof c.opts.onOwner === 'function') && st.left === 1,
      '로그인 통로로 GET 두 번(가진 것 · 뽑기 수) · 시간 제한 · 주인 알림');
  let threw = null;
  try{ await mk(mkAuthed((c) => c.path === '/v1/me/gacha' ? { earned: 1 } : ITEMS)).load(); }catch(e){ threw = e; }
  chk(threw && threw.code === 'BAD_SHAPE', '  모양이 틀리면 던진다(못 읽음 — 착용을 벗기지 않는다)');
  threw = null;
  try{ await mk(mkAuthed((c) => { throw apiErr('unavailable'); })).load(); }catch(e){ threw = e; }
  chk(threw && threw.kind === 'unavailable', '  한쪽이라도 실패하면 던진다');
});

await sec('── 3. draw', async () => {
  let a = mkAuthed(okReply), G = mk(a);
  let r = await G.draw(3);
  chk(!r.ok && r.reason === 'nouser' && a.calls.length === 0, '읽기 전에는 보내지 않는다(요청 0) — 어느 계정인지 모른다');
  await G.load(); a.calls.length = 0;
  r = await G.draw(25);
  const c = a.calls[0];
  chk(c.path === '/v1/me/gacha/draws' && c.body.count === 10 && c.body.requestId === 'rid-1' && c.opts.auth === true && c.opts.expectOwner === 'uA' && c.opts.timeoutMs === M.DRAW_TIMEOUT_MS,
      'POST 본문 — 횟수 상한 10 · 요청 이름 · 읽은 주인과 묶음 (' + JSON.stringify(c.body) + ')');
  chk(r.ok && r.out.length === 1 && r.out[0].id === 'a' && r.out[0].count === 3 && r.state.left === 1 && r.state.owned.c === 4, '  성공 — 결과 · 뽑은 뒤 상태');
  await G.draw(1);
  chk(a.calls[1].body.requestId === 'rid-2' && a.calls[1].body.count === 1, '  누를 때마다 새 요청 이름');
  const cases = [[apiErr('unavailable', 'TIMEOUT'), 'timeout'], [apiErr('unavailable', 'NETWORK'), 'offline'], [apiErr('auth', 'OWNER_CHANGED'), 'nouser'], [apiErr('request', 'X', 400), 'error']];
  for(const [err, want] of cases){
    const q = mkAuthed((c) => { if(c.kind === 'post') throw err; return okReply(c); }), g = mk(q);
    await g.load(); q.calls.length = 0;
    r = await g.draw(1);
    chk(!r.ok && r.reason === want && q.calls.length === 1, '실패 ' + (err.code || err.kind) + ' → ' + want + ' · 한 번만(되풀이 없음)');
  }
  for(const bad of [null, { results: [] }, { results: 'x', items: [], gacha: GACHA }, { results: [], items: 'x', gacha: GACHA }]){
    const q = mkAuthed((c) => c.kind === 'post' ? bad : okReply(c)), g = mk(q);
    await g.load();
    r = await g.draw(1);
    chk(!r.ok && r.reason === 'error', '  틀린 응답 → error (' + JSON.stringify(bad).slice(0, 40) + ')');
  }
  const q = mkAuthed((c) => c.kind === 'post' ? { results: [], items: [], gacha: GACHA } : okReply(c)), g = mk(q);
  await g.load();
  r = await g.draw(1);
  chk(r.ok && r.out.length === 0, '  빈 결과(남은 뽑기 없음 · 풀 빔)는 성공 — 앱이 이유를 말한다');
  G.reset();
  r = await G.draw(1);
  chk(!r.ok && r.reason === 'nouser', '  reset 뒤에는 다시 읽기 전까지 보내지 않는다');
});

await sec('── 4. 깨 보기', async () => {
  const broke = (from, to) => { const s = SRC.replace(from, to); return s === SRC ? null : load(s); };
  const B1 = broke('if(!n) continue;', '');
  chk(B1 && Object.keys(B1.stateOf(ITEMS.items, GACHA).owned).length !== 2, '0 개 줄을 거르지 않으면 1절이 빨강이 된다');
  const B2 = broke('Math.min(COUNT_MAX, ', 'Math.min(Infinity, ');
  chk(B2 && B2.clampCount(11) !== 10, '횟수 상한을 풀면 빨강이 된다');
  const B3 = broke("if(e.code === 'TIMEOUT') return 'timeout';", '');
  chk(B3 && B3.reasonOf(apiErr('unavailable', 'TIMEOUT')) !== 'timeout', '시간 초과를 따로 안 가르면 빨강이 된다');
  const B4 = broke("if(!owner) return { ok: false, reason: 'nouser' };", '');
  const q = mkAuthed(okReply);
  chk(B4 && (await B4.createGachaApi({ authed: q, newRequestId: () => 'r' }).draw(1), q.calls.length === 1), '주인 확인을 빼면(읽기 전에 보냄) 3절이 빨강이 된다');
  const B5 = broke('expectOwner: owner', 'expectOwner: null');
  const q2 = mkAuthed(okReply), g5 = B5 && B5.createGachaApi({ authed: q2, newRequestId: () => 'r' });
  if(g5){ await g5.load(); await g5.draw(1); }
  chk(B5 && q2.calls[q2.calls.length - 1].opts.expectOwner !== 'uA', '주인 묶기를 빼면 3절이 빨강이 된다');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
