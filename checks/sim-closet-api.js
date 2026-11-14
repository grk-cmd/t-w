/* ═══ 🧬 sim-closet-api.js — 옷장 api provider(character/closet-api.js) ═══════════════
   서버가 원본인 옷장(슬롯 5 · 보관함 · 휴지통)의 요청 모양 · 응답 씻기 · 실패 · 계정 묶기를 가짜 통로 위에서 실제로 굴려 본다.
   ・1절: 순수 — headOf · closetOf(모양 · 슬롯 칸과 def 짝) · trashOf · failOf
   ・2절: load — GET 한 번 · 주인 기억 · 모양이 틀리면 던짐 · 빈 옷장은 성공
   ・3절: 쓰기 — 읽기 전엔 보내지 않음 · 경로 · 본문 · 주인 묶기 · 새 요청 이름 · 응답 씻기 · 실패는 그대로 던짐(되풀이 없음)
   ・4절: 휴지통 · 첫 실행 올리기
   ・5절: 깨 보기
   [실행] 저장소 루트에서 node checks/run.js sim-closet-api */
'use strict';
const path = require('path');
const fs = require('fs');
const vm = require('vm');
let pass = 0, fail = 0, done = false;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const FILE = [__dirname, process.cwd()].flatMap(d => ['closet-api.js', 'parts/character/closet-api.js', 'app/parts/character/closet-api.js', 'apps/desktop/app/parts/character/closet-api.js']
  .map(p => path.join(d, p))).find(p => fs.existsSync(p));
if(!FILE){ say('  ? 원본 못 찾음 — closet-api.js'); process.exit(2); }
const SRC = fs.readFileSync(FILE, 'utf8');
const load = (src) => { const ctx = { window: {}, Math, JSON, Object, Array, Number, String, Error, Promise, Date, isFinite, encodeURIComponent }; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.window.TwClosetApi; };

const H = (id, place, slot, extra) => Object.assign({ avatarId: id, place, version: 1, thumbUrl: null, faceUrl: 'https://f/' + id, updatedAt: '2026-11-01T00:00:00Z', legacyCid: null }, slot === null ? {} : { slot }, extra || {}, { place });
const CLOSET = { slots: ['a', null, 'b', null, null], avatars: [H('a', 'SLOT', 0), H('b', 'SLOT', 2), H('c', 'BOX', null)], slotDefs: { a: { skin: 1 }, b: { skin: 2 } } };
const apiErr = (kind, code, status, items) => Object.assign(new Error(kind), { kind, code: code || '', status: status || 0, items: items || null });

function mkAuthed(reply, who){
  const calls = [];
  const mk = (kind) => async (p, a, b) => {
    const c = kind === 'get' ? { kind, path: p, opts: a } : { kind, path: p, body: a, opts: b };
    calls.push(c);
    const r = reply(c);
    if(kind === 'get' && a && a.onOwner) a.onOwner(who || 'uA');
    return r;
  };
  return { calls, get: mk('get'), post: mk('post'), put: mk('put') };
}

(async () => {
const sec = async (t, fn) => { say(t); try{ await fn(); }catch(e){ chk(false, '예외 — ' + String(e && e.stack || e).split('\n').slice(0, 2).join(' / ')); } };
const M = load(SRC);
const mk = (a) => { let n = 0; return M.createClosetApi({ authed: a, newRequestId: () => 'rid-' + (++n) }); };
const ready = async (reply) => { const a = mkAuthed(reply || (() => CLOSET)); const c = mk(a); await c.load(); a.calls.length = 0; return { a, c }; };

await sec('── 1. 순수', () => {
  const h = M.headOf(H('a', 'SLOT', 3, { legacyCid: 'cabc123456' }));
  chk(h && h.avatarId === 'a' && h.place === 'SLOT' && h.slot === 3 && h.legacyCid === 'cabc123456' && h.updatedAt === Date.parse('2026-11-01T00:00:00Z'), 'headOf — 칸 · 옛 cid · 시각(ms)');
  chk(M.headOf(H('c', 'BOX', null)).slot === null, '  보관함은 칸이 없다');
  chk(M.headOf(null) === null && M.headOf({ avatarId: 'x', place: 'HOME', version: 1 }) === null && M.headOf(H('x', 'SLOT', 5)) === null && M.headOf(H('x', 'SLOT', null)) === null
      && M.headOf(Object.assign(H('x', 'BOX', null), { version: -1 })) === null && M.headOf(Object.assign(H('x', 'BOX', null), { version: 1.5 })) === null, '  틀린 줄 — 모르는 자리 · 칸 밖 · 슬롯인데 칸 없음 · 음수/소수 판은 null');
  const c = M.closetOf(CLOSET);
  chk(c && c.slots.join() === 'a,,b,,' && c.avatars.length === 3 && c.defs.a.skin === 1 && c.defs.b.skin === 2 && !c.defs.c, 'closetOf — 슬롯 다섯 · 머리 전부 · 슬롯 캐릭터의 def 만');
  chk(M.closetOf({ slots: [null, null, null, null, null], avatars: [], slotDefs: {} }).avatars.length === 0, '  빈 옷장은 성공(빈 목록 ≠ 못 읽음)');
  chk(M.closetOf(null) === null && M.closetOf(Object.assign({}, CLOSET, { slots: ['a', null] })) === null && M.closetOf(Object.assign({}, CLOSET, { avatars: 'x' })) === null,
      '  모양이 틀리면 null — 슬롯 수 · 머리 목록');
  chk(M.closetOf(Object.assign({}, CLOSET, { slotDefs: { a: { skin: 1 } } })) === null, '  슬롯 캐릭터의 def 가 없으면 null — 그 칸을 빈 칸으로 읽지 않는다');
  chk(M.closetOf(Object.assign({}, CLOSET, { slots: ['b', null, 'a', null, null] })) === null, '  슬롯 칸과 머리의 칸이 어긋나면 null');
  const t = M.trashOf({ trashId: 't1', avatarId: 'a', reason: 'OVERWRITTEN', thumbUrl: 'u', faceUrl: null, trashedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-11-11T00:00:00Z' });
  chk(t && t.why === 'overwritten' && t.thumbUrl === 'u' && t.expiresAt - t.trashedAt === 10 * 86400000 && M.trashOf({ trashId: 't', avatarId: 'a', reason: 'DELETED' }).why === 'deleted'
      && M.trashOf({ trashId: 't', avatarId: 'a', reason: '?' }) === null && M.trashOf({}) === null, 'trashOf — 이유 둘 · 모르는 이유/빈 줄은 null');
  const f = M.failOf(apiErr('request', 'AVATAR_ITEM_NOT_USABLE', 409, [{ id: 'p1', reason: 'X' }, null]));
  chk(f.code === 'AVATAR_ITEM_NOT_USABLE' && f.items.length === 1 && M.failOf(null).code === '' && M.failOf(apiErr('unavailable')).items.length === 0, 'failOf — 서버 code · 걸린 물건 줄');
});

await sec('── 2. load', async () => {
  const a = mkAuthed(() => CLOSET);
  const c = await mk(a).load();
  chk(a.calls.length === 1 && a.calls[0].path === '/v1/me/avatars' && a.calls[0].opts.auth === true && a.calls[0].opts.timeoutMs === M.LOAD_TIMEOUT_MS && typeof a.calls[0].opts.onOwner === 'function' && c.slots[0] === 'a',
      '로그인 통로로 GET 한 번 · 시간 제한 · 주인 알림');
  let threw = null;
  try{ await mk(mkAuthed(() => ({ slots: 1 }))).load(); }catch(e){ threw = e; }
  chk(threw && threw.code === 'BAD_SHAPE', '  모양이 틀리면 던진다(못 읽음)');
  threw = null;
  try{ await mk(mkAuthed(() => { throw apiErr('unavailable', 'NETWORK'); })).load(); }catch(e){ threw = e; }
  chk(threw && threw.kind === 'unavailable', '  통로 실패도 그대로 던진다');
});

await sec('── 3. 쓰기', async () => {
  const a0 = mkAuthed(() => ({}));
  const c0 = mk(a0);
  for(const [name, fn] of [['create', () => c0.create(0, {})], ['update', () => c0.update('a', 1, {})], ['move', () => c0.move('a', 'BOX')], ['trash', () => c0.trash(['a'])], ['restore', () => c0.restore('t')], ['legacySync', () => c0.legacySync([])]]){
    let th = null; try{ await fn(); }catch(e){ th = e; }
    chk(th && th.code === 'OWNER_CHANGED', '읽기 전 ' + name + ' — 보내지 않는다(요청 0)');
  }
  chk(a0.calls.length === 0, '  요청이 하나도 안 나갔다');
  const { a, c } = await ready((q) => {
    if(q.kind === 'get' && q.path === '/v1/me/avatars') return CLOSET;
    if(q.kind === 'post' && q.path === '/v1/me/avatars') return { avatarId: 'n1', version: 1 };
    if(q.kind === 'put') return { version: 4 };
    if(q.path.endsWith('/move')) return CLOSET;
    if(q.path === '/v1/me/avatars/trash' && q.kind === 'post') return [{ id: 'a', ok: true }, { id: 'zz', ok: false, code: 'AVATAR_NOT_FOUND' }];
    if(q.path.endsWith('/restore')) return { avatarId: 'r1' };
    if(q.kind === 'get' && q.path.startsWith('/v1/me/avatars/trash')) return { items: [{ trashId: 't1', avatarId: 'a', reason: 'DELETED', thumbUrl: null, faceUrl: null, trashedAt: '2026-11-01T00:00:00Z', expiresAt: '2026-11-04T00:00:00Z' }, { bad: 1 }], nextCursor: 'cur' };
    if(q.kind === 'get') return { def: { skin: 9 }, version: 3, place: 'BOX' };
    return CLOSET;
  });
  let r = await c.create(1, { skin: 1 });
  chk(a.calls[0].kind === 'post' && a.calls[0].path === '/v1/me/avatars' && a.calls[0].body.slot === 1 && a.calls[0].body.def.skin === 1 && a.calls[0].body.requestId === 'rid-1' && a.calls[0].opts.expectOwner === 'uA' && r.avatarId === 'n1',
      'create — POST · 칸 · def · 새 요청 이름 · 읽은 주인과 묶음');
  await c.create(2, {});
  chk(a.calls[1].body.requestId === 'rid-2', '  누를 때마다 새 요청 이름');
  r = await c.update('a b', 3, { skin: 2 });
  chk(a.calls[2].kind === 'put' && a.calls[2].path === '/v1/me/avatars/a%20b' && a.calls[2].body.baseVersion === 3 && a.calls[2].body.def.skin === 2 && a.calls[2].opts.expectOwner === 'uA' && r.version === 4, 'update — PUT · 마지막으로 받은 판 · 주소 글자 막기');
  r = await c.move('a', 'SLOT');
  chk(a.calls[3].path === '/v1/me/avatars/a/move' && a.calls[3].body.to === 'SLOT' && r.slots[0] === 'a', 'move — 옷장을 돌려받는다');
  await c.move('a', '아무거나');
  chk(a.calls[4].body.to === 'BOX', '  모르는 자리는 BOX 로(슬롯으로 잘못 가지 않게)');
  r = await c.trash(['a', 'zz']);
  chk(a.calls[5].path === '/v1/me/avatars/trash' && a.calls[5].body.avatarIds.join() === 'a,zz' && r.length === 2 && r[0].ok && !r[1].ok && r[1].code === 'AVATAR_NOT_FOUND', 'trash — 줄마다 결과(없는 것은 ok:false)');
  const many = []; for(let i = 0; i < 40; i++) many.push('x' + i);
  await c.trash(many);
  chk(a.calls[6].body.avatarIds.length === 25, '  한 번에 25개까지(서버 상한)');
  a.calls.length = 0; r = await c.trash([]);
  chk(r.length === 0 && a.calls.length === 0, '  빈 목록은 요청 0');
  r = await c.restore('t1');
  chk(a.calls[0].path === '/v1/me/avatars/trash/t1/restore' && a.calls[0].body.requestId === 'rid-3' && r.avatarId === 'r1' && r.closet === null, 'restore — 새 요청 이름 · avatarId 만 오면 closet 은 null(판 · 시각을 지어내지 않는다)');
  const q2 = await ready((x) => x.kind === 'post' ? Object.assign({ avatarId: 'r2' }, CLOSET) : CLOSET);
  const r2 = await q2.c.restore('t2');
  chk(r2.avatarId === 'r2' && r2.closet && r2.closet.avatars.length === 3, '  서버가 move 처럼 옷장을 같이 주면 씻어서 돌려준다')
  r = await c.fetchOne('c');
  chk(a.calls[1].path === '/v1/me/avatars/c' && r.def.skin === 9 && r.version === 3 && r.place === 'BOX', 'fetchOne');
  /* 실패는 그대로 던지고 한 번만 */
  for(const err of [apiErr('request', 'AVATAR_BOX_FULL', 409), apiErr('request', 'AVATAR_ITEM_NOT_USABLE', 409, [{ id: 'p' }]), apiErr('unavailable', 'TIMEOUT'), apiErr('auth', 'OWNER_CHANGED')]){
    const q = await ready((x) => { if(x.kind === 'get') return CLOSET; throw err; });
    let th = null; try{ await q.c.move('a', 'BOX'); }catch(e){ th = e; }
    chk(th === err && q.a.calls.length === 1, '실패 ' + (err.code || err.kind) + ' — 그대로 던지고 한 번만(되풀이 없음)');
  }
  let th = null; try{ const q = await ready((x) => x.kind === 'post' ? { avatarId: 5 } : CLOSET); await q.c.create(0, {}); }catch(e){ th = e; }
  chk(th && th.code === 'BAD_SHAPE', '틀린 응답은 BAD_SHAPE');
});

await sec('── 4. 휴지통 · 첫 실행 올리기', async () => {
  const { a, c } = await ready((q) => (q.kind === 'get' && q.path !== '/v1/me/avatars') ? { items: [], nextCursor: null } : CLOSET);
  const p = await c.trashPage({ cursor: 'a=b', limit: 999 });
  chk(a.calls[0].path === '/v1/me/avatars/trash?cursor=a%3Db&limit=50' && p.items.length === 0 && p.nextCursor === null, 'trashPage — 커서는 글자 막아서 · 쪽 크기 상한 50 · 빈 휴지통은 성공');
  await c.trashPage({});
  chk(a.calls[1].path === '/v1/me/avatars/trash?limit=50', '  첫 쪽은 커서 없이');
  await c.legacySync([{ legacyCid: 'cabc123456', def: { skin: 1 }, editedAt: Date.UTC(2026, 9, 1), slot: 2 }, { def: {}, editedAt: 0, slot: null }]);
  const b = a.calls[2].body;
  chk(a.calls[2].path === '/v1/me/avatars/legacy-sync' && b.requestId && b.items.length === 2 && b.items[0].legacyCid === 'cabc123456' && b.items[0].editedAt === '2026-10-01T00:00:00.000Z' && b.items[0].slot === 2
      && b.items[1].legacyCid === null && b.items[1].slot === null && b.items[1].editedAt === '1970-01-01T00:00:00.000Z', 'legacySync — 옛 cid · 시각은 ISO · 칸');
  const many = []; for(let i = 0; i < 30; i++) many.push({ def: {}, editedAt: 1, slot: null });
  await c.legacySync(many);
  chk(a.calls[3].body.items.length === 25, '  25줄까지');
  c.reset();
  let th = null; try{ await c.legacySync([]); }catch(e){ th = e; }
  chk(th && th.code === 'OWNER_CHANGED', 'reset 뒤에는 다시 읽기 전까지 쓰지 않는다');
});

await sec('── 5. 깨 보기', async () => {
  const broke = (from, to) => { const s = SRC.replace(from, to); return s === SRC ? null : load(s); };
  const B1 = broke('head.slot !== i || ', '');
  chk(B1 && B1.closetOf(Object.assign({}, CLOSET, { slots: ['b', null, 'a', null, null] })) !== null, '슬롯 칸 대조를 빼면 1절이 빨강이 된다');
  const B2 = broke('|| !isObj(src[id])) return null;', ') return null;');
  chk(B2 && B2.closetOf(Object.assign({}, CLOSET, { slotDefs: { a: { skin: 1 } } })) !== null, 'def 짝 검사를 빼면 빨강이 된다');
  const B3 = broke("to: to === PLACE.SLOT ? PLACE.SLOT : PLACE.BOX", 'to: to');
  const q = mkAuthed(() => CLOSET), g = B3 && B3.createClosetApi({ authed: q, newRequestId: () => 'r' });
  if(g){ await g.load(); await g.move('a', 'x'); }
  chk(B3 && q.calls[q.calls.length - 1].body.to !== 'BOX', '모르는 자리를 BOX 로 접지 않으면 3절이 빨강이 된다');
  const B4 = broke('expectOwner: owner', 'expectOwner: null');
  const q2 = mkAuthed(() => CLOSET), g4 = B4 && B4.createClosetApi({ authed: q2, newRequestId: () => 'r' });
  if(g4){ await g4.load(); await g4.move('a', 'BOX'); }
  chk(B4 && q2.calls[q2.calls.length - 1].opts.expectOwner !== 'uA', '주인 묶기를 빼면 빨강이 된다');
});

say('');
say(fail ? ('✗ ' + fail + '건 어긋남 · 통과 ' + pass) : ('✅ 전부 통과 ' + pass));
console.log(pass + ' · ' + fail);
done = true;
process.exit(fail ? 1 : 0);
})();
process.on('exit', () => { if(!done){ console.log('  ✗ 끝까지 못 돌았다\n' + pass + ' · ' + (fail + 1)); process.exitCode = 1; } });
