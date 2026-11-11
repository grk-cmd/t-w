/* ═══ 🧸 sim-gift-api.js — 말랑이 · 선물 api provider (0.13 앱 묶음 D7-1) ═══
   [왜] 말랑이 칸 · 선물함 · 보내기가 Firebase 대신 우리 서버 공개 API(/v1/me/mallangs · /v1/me/gifts · /v1/gifts/{code})를 쓴다.
     서버 모양(slot 번호 · sentAt ISO · 숫자 칸)을 화면 모양으로 맞추는 곳 · 본문을 만드는 곳이 provider 하나라 실제로 불러서 판정한다.
   ・1절: 말랑이 칸 — 읽기(slot 차례로 · 빈 칸 · 못 읽음 던짐 · 모양 틀림 던짐) · 남의 집 · 저장 본문(0부터 다시 매김 · 4칸 상한) · 그림 올리기(형식 · 크기 · 바이트 그대로)
   ・2절: 선물함 — 줄 맞춤(sentAt → ms · 메시지 없음 → '') · 빈 선물함 ≠ 못 읽음 · 깨진 줄만 뺌 · 봤음 · ⭐ · 치움 · 지우기 경로 · 본문
   ・3절: 보내기 — 오늘 보낸 수 · 그 집에 나온 선물 · 보내기 본문은 { requestId, slot, message? } 만 · 응답 모양
   ・4절: 주인 묶기 — 읽기 전 쓰기는 요청 0 · 진짜 api-client 위에서 토큰 주인이 바뀌면 요청 0 · reset 뒤 요청 0 · 남의 집 읽기는 주인을 남기지 않음
   ・5절: 오류 갈래(failOf — 진짜 api-errors.js 의 translate 로) — 안내 · 없는 선물 · 없는 사람 · 그 자리 번호 · 공통 · 409
   ・6절: 배선 — html · smoke 순서 · firebase 를 부르지 않음
   ・7절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['gift-api.js', 'parts/myhome/gift-api.js', 'app/parts/myhome/gift-api.js']),
  AC: pick(['api-client.js', 'parts/shared/api-client.js', 'app/parts/shared/api-client.js']),
  AE: pick(['api-errors.js', 'parts/shared/api-errors.js', 'app/parts/shared/api-errors.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwGiftApi; };
const loadMod = (src) => { const mod = { exports: {} }; new Function('module', 'window', src)(mod, undefined); return mod.exports; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code, message) => Object.assign(new Error(message || code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });   // api-client 와 같은 kind
const slotsRes = (list, version) => ({ slots: list, version: version === undefined ? 3 : version });
const gift = (id, o) => Object.assign({ id, senderName: '보낸이' + id, imageUrl: 'https://img/' + id + '.png', message: 'm' + id, starred: false, hidden: false, sentAt: '2026-11-10T01:02:03Z' }, o || {});
const boxRes = (items, o) => Object.assign({ items, unseenCount: 2, starCount: 1, boxKeep: 30, starMax: 20 }, o || {});
const ME_ROUTES = () => ({
  'GET /v1/me/mallangs': slotsRes([]), 'GET /v1/me/gifts': boxRes([]), 'GET /v1/me/gifts/sent-today': { count: 0, dailyMax: 10 },
});

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
  return { log, get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), put: (p, b, o) => run('PUT', p, b, o),
    patch: (p, b, o) => run('PATCH', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
const mk = (src, routes) => {
  const authed = fake(Object.assign(ME_ROUTES(), routes || {})), warns = [];
  const m = load(src).createGiftApi({ authed, warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, warns };
};
const throws = async (fn) => { try{ await fn(); return null; }catch(e){ return e || {}; } };
const png = (n) => 'data:image/png;base64,' + Buffer.alloc(n, 7).toString('base64');

async function judge(S){
  const LIB = S.API;
  const G = load(LIB);

  say('── 1. 말랑이 칸');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/me/mallangs': slotsRes([
      { slot: 2, imageUrl: 'https://b/2.png', enabled: false }, { slot: 0, imageUrl: 'https://b/0.png', enabled: true },
    ], 7) });
    const r = await m.fetchMine();
    const g = authed.log[0];
    chk(g.path === '/v1/me/mallangs' && g.opts.auth === true && typeof g.opts.onOwner === 'function', '내 칸 — GET /v1/me/mallangs · 로그인 통로 · 토큰 주인을 듣는다');
    chk(r.version === 7 && r.slots.length === 2 && r.slots[0].imageUrl === 'https://b/0.png' && r.slots[0].enabled === true && r.slots[1].enabled === false, '칸은 slot 번호 차례의 배열 · 판은 서버 값');
    chk(Object.keys(r.slots[0]).sort().join() === 'enabled,imageUrl,slot' && r.slots[0].slot === 0 && r.slots[1].slot === 2, '  칸 모양 = { slot, imageUrl, enabled } — 서버 번호를 그대로 든다(0 · 2 처럼 비어도 메우지 않는다)');
    const empty = await mk(LIB, { 'GET /v1/me/mallangs': slotsRes([], 0) }).m.fetchMine();
    chk(Array.isArray(empty.slots) && empty.slots.length === 0 && empty.version === 0, '저장한 적 없으면 빈 칸 · 판 0 — «없음» 이지 실패가 아니다');
    const down = await throws(() => mk(LIB, { 'GET /v1/me/mallangs': apiErr(503, 'X') }).m.fetchMine());
    chk(down && down.status === 503, '못 읽으면 던진다(빈 칸으로 숨기지 않는다)');
    for(const bad of [null, { slots: 'x', version: 1 }, { slots: [] }, slotsRes([{ slot: 0, imageUrl: '', enabled: true }]), slotsRes([{ slot: -1, imageUrl: 'u', enabled: true }]),
      slotsRes([1, 2, 3, 4, 5].map((i) => ({ slot: i, imageUrl: 'u', enabled: true }))),
      slotsRes([{ slot: 1, imageUrl: 'u', enabled: true }, { slot: 1, imageUrl: 'v', enabled: true }]), slotsRes([{ slot: 4, imageUrl: 'u', enabled: true }])]){
      const e = await throws(() => mk(LIB, { 'GET /v1/me/mallangs': bad }).m.fetchMine());
      chk(e && e.code === 'SHAPE', '모양이 틀린 응답(' + JSON.stringify(bad).slice(0, 60) + ')은 던진다');
    }
    const of = mk(LIB, { 'GET /v1/mallangs/F%2F1': slotsRes([{ slot: 0, imageUrl: 'https://f/0.png', enabled: true }], 2) });
    const fr = await of.m.fetchOf('F/1');
    chk(fr.slots.length === 1 && of.authed.log[0].path === '/v1/mallangs/F%2F1' && of.authed.log[0].opts.auth === true, '남의 집 칸 — GET /v1/mallangs/{code}(경로에 인코딩)');
    const nf = await throws(() => mk(LIB, { 'GET /v1/mallangs/X': apiErr(404, 'USER_NOT_FOUND') }).m.fetchOf('X'));
    chk(nf && nf.code === 'USER_NOT_FOUND', '  없는 사람은 서버 코드 그대로 던진다(화면이 «없음» 으로)');
    const noCode = mk(LIB);
    const nc = await throws(() => noCode.m.fetchOf(''));
    chk(nc && nc.code === 'NO_USER' && noCode.authed.log.length === 0, '  코드가 없으면 요청 0 으로 던진다');

    chk(JSON.stringify(G.slotsBody(5, [{ slot: 0, imageUrl: 'a', enabled: true }, { slot: 2, imageUrl: 'c', enabled: false }])) === '{"version":5,"slots":[{"slot":0,"imageUrl":"a","enabled":true},{"slot":1,"imageUrl":"c","enabled":false}]}',
      '저장 본문 = { version, slots:[{ slot 0..n-1, imageUrl, enabled }] } — 들고 있던 서버 번호(0 · 2)는 버리고 당겨 다시 매긴다');
    chk(G.slotsBody(1, [1, 2, 3, 4, 5, 6].map((i) => ({ imageUrl: 'u' + i, enabled: true }))).slots.length === 4, '  4칸 상한');
    chk(G.slotsBody(1, []).slots.length === 0, '  빈 목록 → 빈 칸(다 지움)');

    const sv = mk(LIB, { 'GET /v1/me/mallangs': slotsRes([], 4), 'PUT /v1/me/mallangs': (b) => slotsRes(b.slots, 5) });
    await sv.m.fetchMine();
    const out = await sv.m.saveMallangs(4, [{ imageUrl: 'x', enabled: true }]);
    const put = sv.authed.log.find((x) => x.method === 'PUT');
    chk(put && put.path === '/v1/me/mallangs' && put.body.version === 4 && put.opts && 'expectOwner' in put.opts, '저장 — PUT /v1/me/mallangs · 넘긴 판 · 읽은 주인과 묶음');
    chk(out.version === 5 && out.slots[0].imageUrl === 'x', '  돌려받은 칸 · 새 판');
    const cf = mk(LIB, { 'PUT /v1/me/mallangs': apiErr(409, 'CONCURRENT_UPDATE') });
    await cf.m.fetchMine();
    const ce = await throws(() => cf.m.saveMallangs(3, []));
    chk(ce && ce.code === 'CONCURRENT_UPDATE' && cf.authed.log.filter((x) => x.method === 'PUT').length === 1 && cf.authed.log.filter((x) => x.path === '/v1/me/mallangs' && x.method === 'GET').length === 1,
      '  409 는 던지고 끝 — 여기서 다시 받아 한 번 더 보내지 않는다');

    const up = mk(LIB, { 'POST /v1/me/images': { url: 'https://s/mallang_1.png' } });
    chk((await throws(() => up.m.uploadImage(png(10)))).code === 'NOT_RECEIVED' && up.authed.log.length === 0, '그림 올리기 — 받기 전엔 요청 0');
    await up.m.fetchMine();
    const url = await up.m.uploadImage(png(10));
    const p = up.authed.log.find((x) => x.method === 'POST');
    chk(url === 'https://s/mallang_1.png' && p.path === '/v1/me/images?purpose=mallang' && p.opts.rawType === 'image/png' && p.body instanceof Uint8Array && p.body.length === 10 && 'expectOwner' in p.opts,
      '  POST /v1/me/images?purpose=mallang · 바이트 그대로 · Content-Type png · 주인과 묶음 → { url }');
    const before = up.authed.log.length;
    for(const [what, u] of [['jpeg', 'data:image/jpeg;base64,AAAA'], ['1MB 초과', png(1024 * 1024 + 1)], ['빈 그림', 'data:image/png;base64,'], ['data: 아님', 'https://x/y.png']]){
      const e = await throws(() => up.m.uploadImage(u));
      chk(e && e.code === 'IMAGE_UPLOAD', '  ' + what + ' → 요청 없이 IMAGE_UPLOAD');
    }
    chk(up.authed.log.length === before, '  거른 그림은 요청 0');
    chk(!!(await up.m.uploadImage(png(1024 * 1024))), '  딱 1MB 는 올린다(경계)');
    const bad = mk(LIB, { 'POST /v1/me/images': {} });
    await bad.m.fetchMine();
    chk((await throws(() => bad.m.uploadImage(png(4)))).code === 'SHAPE', '  url 없는 응답은 던진다');
  }

  say('── 2. 선물함');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/me/gifts': boxRes([
      gift('a', { starred: true }), gift('b', { message: null, hidden: true, sentAt: 'x' }), { id: 'c' }, null,
    ], { unseenCount: 3, starCount: 1 }) });
    const b = await m.fetchBox();
    chk(authed.log[0].path === '/v1/me/gifts' && typeof authed.log[0].opts.onOwner === 'function', 'GET /v1/me/gifts · 토큰 주인을 듣는다');
    chk(b.items.length === 2 && b.items[0].id === 'a' && b.items[0].senderName === '보낸이a' && b.items[0].imageUrl === 'https://img/a.png' && b.items[0].message === 'ma' && b.items[0].starred === true,
      '줄 맞춤 — id · 보낸 이름 · 그림 · 메시지 · ⭐(깨진 줄은 빼고 나머지는 보인다)');
    chk(b.items[0].sentAt === Date.parse('2026-11-10T01:02:03Z') && b.items[1].sentAt === 0, '  sentAt ISO → ms · 깨지면 0');
    chk(b.items[1].message === '' && b.items[1].hidden === true, '  메시지 없음 → \'\' · 치움 = hidden');
    chk(b.unseenCount === 3 && b.starCount === 1 && b.boxKeep === 30 && b.starMax === 20, '숫자 칸은 서버 값(새 선물 수 · ⭐ 수 · 보관 상한 · ⭐ 상한)');
    const e0 = await mk(LIB, { 'GET /v1/me/gifts': boxRes([], { unseenCount: 0, starCount: 0 }) }).m.fetchBox();
    chk(e0.items.length === 0 && e0.unseenCount === 0, '빈 선물함은 { items:[] } — 실패가 아니다');
    const d = await throws(() => mk(LIB, { 'GET /v1/me/gifts': apiErr(500, 'X') }).m.fetchBox());
    chk(d && d.status === 500, '못 읽으면 던진다');
    for(const bad of [null, { items: [] }, boxRes('x'), boxRes([], { unseenCount: -1 }), boxRes([], { starMax: '20' })]){
      const e = await throws(() => mk(LIB, { 'GET /v1/me/gifts': bad }).m.fetchBox());
      chk(e && e.code === 'SHAPE', '모양이 틀린 응답(' + JSON.stringify(bad).slice(0, 50) + ')은 던진다');
    }

    const routes = { 'POST /v1/me/gifts/seen': null, 'PATCH /v1/me/gifts/g%2F1': null, 'DELETE /v1/me/gifts/g%2F1': null };
    const w = mk(LIB, routes);
    for(const [name, f] of [['봤음', () => w.m.markSeen()], ['⭐', () => w.m.star('g/1', true)], ['치움', () => w.m.hide('g/1', true)], ['지우기', () => w.m.remove('g/1')]]){
      const e = await throws(f);
      chk(e && e.code === 'NOT_RECEIVED', name + ' — 받기 전엔 NOT_RECEIVED');
    }
    chk(w.authed.log.length === 0, '  받기 전 쓰기는 요청 0');
    await w.m.fetchBox();
    await w.m.markSeen(); await w.m.star('g/1', true); await w.m.star('g/1', false); await w.m.hide('g/1', true); await w.m.hide('g/1', 0); await w.m.remove('g/1');
    const L = w.authed.log.slice(1);
    chk(L[0].method === 'POST' && L[0].path === '/v1/me/gifts/seen' && JSON.stringify(L[0].body) === '{}', '봤음 → POST /v1/me/gifts/seen 본문 {}(시각을 싣지 않는다)');
    chk(L[1].method === 'PATCH' && L[1].path === '/v1/me/gifts/g%2F1' && JSON.stringify(L[1].body) === '{"starred":true}' && JSON.stringify(L[2].body) === '{"starred":false}', '⭐ → PATCH …/{id}(인코딩) { starred }');
    chk(JSON.stringify(L[3].body) === '{"hidden":true}' && JSON.stringify(L[4].body) === '{"hidden":false}', '치움 · 다시 부르기 → PATCH { hidden } (참 · 거짓으로)');
    chk(L[5].method === 'DELETE' && L[5].path === '/v1/me/gifts/g%2F1', '지우기 → DELETE …/{id}');
    chk(L.every((x) => x.opts && 'expectOwner' in x.opts), '  쓰기는 모두 읽은 주인과 묶는다');
    const f = mk(LIB, { 'PATCH /v1/me/gifts/a': apiErr(409, 'GIFT_STAR_FULL') });
    await f.m.fetchBox();
    const fe = await throws(() => f.m.star('a', true));
    chk(fe && fe.code === 'GIFT_STAR_FULL' && f.warns.length === 1, '  서버 거절은 코드 그대로 던진다(진단 로그 한 줄)');
  }

  say('── 3. 보내기');
  {
    const { m, authed } = mk(LIB, {
      'GET /v1/me/gifts/sent-today': { count: 3, dailyMax: 10 },
      'GET /v1/gifts/F1': { items: [{ id: 'v1', imageUrl: 'https://i/1.png', message: null }, { id: 'v2' }], visibleCount: 29, recipientCap: 30 },
      'POST /v1/gifts/F1': { giftId: 'G9', sentToday: 4, dailyMax: 10 },
    });
    const st = await m.fetchSentToday();
    chk(st.count === 3 && st.dailyMax === 10 && authed.log[0].path === '/v1/me/gifts/sent-today', '오늘 보낸 수 — GET /v1/me/gifts/sent-today → { count, dailyMax }');
    const v = await m.fetchVisible('F1');
    chk(v.visibleCount === 29 && v.recipientCap === 30 && v.items.length === 1 && v.items[0].message === '' && Object.keys(v.items[0]).sort().join() === 'id,imageUrl,message',
      '그 집에 나온 선물 — { items:[{ id, imageUrl, message }], visibleCount, recipientCap }(그림 없는 줄은 뺌)');
    const r = await m.send('F1', { requestId: 'R1', mallang: { slot: 2, imageUrl: 'https://b/2.png', enabled: true }, message: '  안녕  ', fromName: '나', fromId: 'ME', date: '2026-11-12', imageUrl: 'https://evil' });
    const p = authed.log.find((x) => x.method === 'POST');
    chk(p.path === '/v1/gifts/F1' && 'expectOwner' in p.opts, '보내기 → POST /v1/gifts/{code} · 읽은 주인과 묶음');
    chk(JSON.stringify(p.body) === '{"requestId":"R1","slot":2,"message":"안녕"}', '  본문은 { requestId, slot, message } 만 — 이름 · 내 코드 · 날짜 · 그림 주소를 싣지 않는다');
    chk(r.giftId === 'G9' && r.sentToday === 4 && r.dailyMax === 10, '  응답 { giftId, sentToday, dailyMax }');
    const sb = (message) => G.sendBody({ requestId: 'R', mallang: { slot: 0 }, message });
    chk(!('message' in sb('   ')) && !('message' in sb(undefined)), '  메시지가 비면 칸을 싣지 않는다');
    chk(sb('x'.repeat(80)).message.length === 50, '  메시지는 UTF-16 50자까지');
    chk(sb('x'.repeat(49) + '😀').message === 'x'.repeat(49), '  50자 경계에 걸린 이모지는 반쪽을 남기지 않고 통째 뺀다(49자)');
    chk(sb('x'.repeat(48) + '😀z').message === 'x'.repeat(48) + '😀', '  경계 안에 다 들어가는 이모지는 남긴다(50자)');
    chk(sb('😀'.repeat(30)).message === '😀'.repeat(25), '  이모지만 — 짝 25개(50자)');
    /* 칸 사이가 빈 응답(0 · 2) — 두 번째 칸을 보내면 본문 slot 은 2(화면 차례 1 이 아니다) */
    const gap = mk(LIB, { 'GET /v1/me/mallangs': slotsRes([{ slot: 2, imageUrl: 'https://b/2.png', enabled: true }, { slot: 0, imageUrl: 'https://b/0.png', enabled: true }]),
      'POST /v1/gifts/F1': { giftId: 'G1', sentToday: 1, dailyMax: 10 } });
    const mine = await gap.m.fetchMine();
    await gap.m.send('F1', { requestId: 'R2', mallang: mine.slots[1] });
    const gp = gap.authed.log.find((x) => x.method === 'POST');
    chk(gp && gp.body.slot === 2, '칸 사이가 빈 응답(0 · 2) — 두 번째 칸을 보내면 본문 slot 은 서버 번호 2');
    const n0 = gap.authed.log.length;
    for(const [what, o] of [['칸 없음', { requestId: 'R' }], ['번호 없는 칸', { requestId: 'R', mallang: { imageUrl: 'u' } }], ['칸 번호 대신 숫자', { requestId: 'R', slot: 1 }], ['범위 밖', { requestId: 'R', mallang: { slot: 4 } }]]){
      const e = await throws(() => gap.m.send('F1', o));
      chk(e && e.code === 'BAD_SLOT', '  ' + what + ' → 요청 없이 BAD_SLOT(화면 차례로 메우지 않는다)');
    }
    chk(gap.authed.log.length === n0, '  고른 칸이 없으면 요청 0');
    const nope = mk(LIB, { 'POST /v1/gifts/F1': apiErr(429, 'GIFT_DAILY_LIMIT', '오늘은 더 보낼 수 없어요 (하루 10번)') });
    chk((await throws(() => nope.m.send('F1', { requestId: 'R', mallang: { slot: 0 } }))).code === 'NOT_RECEIVED' && nope.authed.log.length === 0, '  받기 전엔 보내지 않는다(요청 0)');
    await nope.m.fetchMine();
    const ne = await throws(() => nope.m.send('F1', { requestId: 'R', mallang: { slot: 0 } }));
    chk(ne && ne.code === 'GIFT_DAILY_LIMIT' && /10번/.test(ne.message), '  서버 거절은 코드 · 서버 문구 그대로');
    const bs = mk(LIB, { 'POST /v1/gifts/F1': { giftId: '' } });
    await bs.m.fetchMine();
    chk((await throws(() => bs.m.send('F1', { requestId: 'R', mallang: { slot: 0 } }))).code === 'SHAPE', '  응답 모양이 틀리면 던진다');
    for(const bad of [{ count: -1, dailyMax: 10 }, { count: 1 }]){
      const e = await throws(() => mk(LIB, { 'GET /v1/me/gifts/sent-today': bad }).m.fetchSentToday());
      chk(e && e.code === 'SHAPE', '  오늘 보낸 수 모양 틀림(' + JSON.stringify(bad) + ') → 던짐(«0번 보냄» 으로 숨기지 않는다)');
    }
    const ve = await throws(() => mk(LIB, { 'GET /v1/gifts/F1': apiErr(503, 'X') }).m.fetchVisible('F1'));
    chk(ve && ve.status === 503, '  그 집 선물을 못 읽으면 던진다');
  }

  say('── 4. 주인 묶기');
  {
    const AC = loadMod(S.AC);
    const jwt = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
    const reply = (status, data) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => ({ success: true, data }) });
    const calls = [], tk = { v: jwt('A') };
    const client = AC.createApiClient({ baseUrl: 'https://api.test', getToken: async () => tk.v,
      fetch: async (url, init) => { calls.push(init.method + ' ' + url); return reply(200, url.endsWith('/v1/me/gifts') ? boxRes([]) : url.indexOf('/v1/mallangs/') >= 0 ? slotsRes([]) : null); } });
    const m = load(S.API).createGiftApi({ authed: client, warn: () => {} });
    await m.fetchOf('F1');
    chk((await throws(() => m.star('a', true))).code === 'NOT_RECEIVED' && calls.length === 1, '남의 집 읽기는 주인을 남기지 않는다 — 내 것을 받기 전 쓰기는 요청 0');
    await m.fetchBox();
    await m.star('a', true);
    chk(calls.length === 3, '같은 계정이면 보낸다');
    tk.v = jwt('B');
    const oc = await throws(() => m.hide('a', true));
    chk(oc && oc.code === 'OWNER_CHANGED' && calls.length === 3, '읽은 뒤 토큰 주인이 바뀌면 요청 0 · OWNER_CHANGED — 앞 계정 화면의 누름이 새 계정으로 나가지 않는다');
    chk((await throws(() => m.remove('a'))).code === 'NOT_RECEIVED' && calls.length === 3, '  그 뒤엔 다시 읽기 전까지 계속 안 보낸다');
    await m.fetchBox();
    await m.remove('a');
    chk(calls.length === 5, '  새 계정으로 다시 읽으면 그 계정으로 보낸다');
    m.reset();
    chk((await throws(() => m.markSeen())).code === 'NOT_RECEIVED' && calls.length === 5, 'reset 뒤엔 다시 읽기 전까지 요청 0');
    /* reset 전에 떠난 읽기가 늦게 와도 주인 기억을 되살리지 않는다 */
    let release;
    const slow = fake(Object.assign(ME_ROUTES(), { 'GET /v1/me/gifts': (b, p, o) => new Promise((res) => { release = () => { o.onOwner('A'); res(boxRes([])); }; }), 'POST /v1/me/gifts/seen': null }));
    const sm = load(S.API).createGiftApi({ authed: slow, warn: () => {} });
    const pending = sm.fetchBox();
    sm.reset();
    release(); await pending;
    chk((await throws(() => sm.markSeen())).code === 'NOT_RECEIVED' && !slow.log.some((x) => x.method === 'POST'), '  reset 전에 떠난 읽기 답은 주인을 되살리지 않는다(요청 0)');
  }

  say('── 5. 오류 갈래');
  {
    const AE = loadMod(S.AE);
    const k = (e) => G.failOf(e, AE).kind;
    /* 서버가 실제로 내는 상태 — 403 은 api-client 가 kind 'auth' 로, 429 는 'request' 로 준다 */
    for(const [c, st] of [['GIFT_STAR_FULL', 409], ['GIFT_STARRED', 409], ['GIFT_SELF', 400], ['GIFT_NOT_FRIEND', 403], ['GIFT_NO_MALLANG', 409], ['GIFT_DAILY_LIMIT', 429], ['GIFT_RECIPIENT_FULL', 409], ['GIFT_MESSAGE_INVALID', 400]]){
      chk(k(apiErr(st, c)) === 'guide', c + '(' + st + ') → guide(서버 문구 안내 · 번호 없음)');
    }
    chk(G.failOf(apiErr(429, 'GIFT_DAILY_LIMIT', '하루 10번'), AE).message === '하루 10번', '  안내는 서버 문구를 그대로 돌려준다');
    chk(k(apiErr(404, 'GIFT_NOT_FOUND')) === 'gone', 'GIFT_NOT_FOUND → gone(안내 + 받기 한 번)');
    chk(k(apiErr(404, 'USER_NOT_FOUND')) === 'missing', 'USER_NOT_FOUND → missing(«없음» · 번호 없음)');
    for(const [c, st] of [['GIFT_IMAGE_COPY_FAILED', 503], ['GIFT_MALLANG_INVALID', 400], ['GIFT_INVALID_STATE', 500], ['IMAGE_UPLOAD', 0], ['SHAPE', 0], ['BAD_SLOT', 0]]) chk(k(apiErr(st, c)) === 'site', c + ' → site(그 자리 E-GIFT 번호)');
    chk(k(apiErr(503, '')) === 'site' && k(Object.assign(new Error('x'), { kind: 'unavailable' })) === 'site' && k(apiErr(400, 'SOMETHING_NEW')) === 'site', '닿지 못함 · 모르는 코드 → site(E-NET-07 · 08 이 아니라 그 자리 번호)');
    chk(k(apiErr(403, 'PREMIUM_REQUIRED')) === 'common' && k(apiErr(429, 'TOO_MANY_REQUESTS')) === 'common' && k(apiErr(401, 'AUTH_REQUIRED')) === 'common', '공통 코드 → common(E-NET 표)');
    chk(k(apiErr(409, 'CONCURRENT_UPDATE')) === 'conflict', 'CONCURRENT_UPDATE → conflict(다시 받기 · 알림)');
    chk(k({ code: 'OWNER_CHANGED' }) === 'stale' && k({ code: 'NOT_RECEIVED' }) === 'stale', 'OWNER_CHANGED · NOT_RECEIVED → stale(조용히 버림)');
    chk(Object.keys(G.ERRORS).every((c) => G.ERRORS[c].notice === null), '기능 표는 번호를 정하지 않는다(번호는 그 자리가)');
  }

  say('── 6. 배선');
  {
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    const i = tag('myhome/gift-api.js'), a = tag('app.js');
    chk(i > 0 && a > i, 'html — gift-api.js 가 app.js 보다 먼저');
    chk(/PRELOAD\.push\('gift-api\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 gift-api.js');
    chk(!/firebase|firebaseAPI|localStorage/.test(strip(S.API)), 'provider 는 Firebase · 로컬 저장을 부르지 않는다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 7. 일부러 깨 보기');
  const breaks = [
    ['보내기 본문에 이름을 실음', S.API.replace("const body = { requestId: str(o && o.requestId), slot };", "const body = { requestId: str(o && o.requestId), slot, fromName: o && o.fromName };"), '본문'],
    ['칸 번호를 다시 매기지 않음', S.API.replace("map((s, i) => ({ slot: i,", "map((s, i) => ({ slot: s.slot,"), '0부터'],
    ['못 읽음을 빈 선물함으로', S.API.replace("fetchBox: async () => need(boxOf(await readMine(PATHS.box))),", "fetchBox: async () => { try{ return need(boxOf(await readMine(PATHS.box))); }catch(_){ return { items: [] }; } },"), '던진다'],
    ['쓰기가 주인을 안 묶음', S.API.replace("try{ return await send({ expectOwner: owner }); }", "try{ return await send({}); }"), 'expectOwner'],
    ['읽기 전에도 보냄', S.API.replace("if(owner === undefined) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');", ""), '요청 0'],
    ['reset 이 늦은 읽기를 안 막음', S.API.replace("if(at === epoch) owner = who;", "owner = who;"), 'reset'],
    ['받은 칸이 서버 번호를 버림', S.API.replace("({ slot: s.slot, imageUrl: s.imageUrl, enabled: s.enabled })", "({ imageUrl: s.imageUrl, enabled: s.enabled })"), '서버 번호'],
    ['보내기가 화면 차례로 메움', S.API.replace("if(!cnt(slot) || slot >= LIMITS.SLOTS) return undefined;\n  const body = { requestId: str(o && o.requestId), slot };", "const body = { requestId: str(o && o.requestId), slot: 1 };"), 'slot 2'],
    ['이모지 짝을 깨고 자름', S.API.replace("if(last >= 0xD800 && last <= 0xDBFF) t = t.slice(0, -1);", ""), '이모지 경계'],
    ['겹친 칸 번호를 받음', S.API.replace(" || seen.has(s.slot)", ""), '겹침'],
    ['칸을 slot 차례로 안 줄 세움', S.API.replace("list.sort((a, b) => a.slot - b.slot);", ""), 'slot 차례'],
    ['sentAt 을 ms 로 안 바꿈', S.API.replace("sentAt: msOf(raw.sentAt) };", "sentAt: raw.sentAt };"), 'ms'],
    ['닿지 못함을 공통 번호로', S.API.replace("else kind = KIND.SITE;", "else kind = KIND.COMMON;"), 'site'],
    ['그림 크기를 안 거름', S.API.replace("|| img.bytes.length > LIMITS.IMAGE_BYTES", ""), '1MB'],
    ['jpeg 도 받음', S.API.replace("const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp']);", "const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp', 'image/jpeg']);"), 'jpeg'],
    ['올리기 경로 purpose 틀림', S.API.replace("image: '/v1/me/images?purpose=mallang',", "image: '/v1/me/images?purpose=dday',"), 'purpose'],
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
