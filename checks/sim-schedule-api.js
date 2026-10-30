/* ═══ 📅 sim-schedule-api.js — 일정 · 디데이 · 일정 알림 api provider (0.13 앱 묶음 D6) ═══
   [왜] 일정 · 디데이 보드 · 친구 태그 알림이 Firebase 대신 우리 서버 공개 API(/v1/me/schedules · /v1/me/ddays · /v1/me/notifications)를 쓴다.
     서버 모양(visibility · countFromOne · bgImage · cards / banners 두 목록 · 판 version)을 화면 모양(public · base1 · bgImg · kind · order)으로 맞추는 곳이
     provider 하나라 그 맞춤을 가짜 authed 위에서 실제로 불러 판정한다.
   ・1절: 일정 읽기 — 경로 · 모양 맞춤 · 다른 달 줄은 버림 · 빈 달({}) ≠ 못 읽음(던짐) · 모양 틀림은 던짐 · 남의 일정 경로
   ・2절: 일정 쓰기 — 본문(requestId · visibility · 태그하면 공개) · 읽은 토큰 주인 묶기(expectOwner) · 받기 전엔 요청 0 · 지우기 경로(판) · 글자 상한
   ・3절: 디데이 보드 읽기 — 두 목록 → 한 맵(order = 목록 순서 · kind · base1 · 그림) · 빈 보드 ≠ 못 읽음 · 남의 보드 · 순서 정렬(order → 만든 순)
   ・4절: 디데이 보드 저장 — 본문(판 · 두 목록 순서 · 새 장은 ddayId 없음 · 배너는 셈법 · 그림 없음) · 태그 위치 · 판 갱신 · 409 뒤엔 다시 받기 전 쓰기 막힘 · 계정 바뀜
   ・5절: 카드 그림 — data: 만 올려 주소로 바꿈 · 올리기 실패면 보드를 보내지 않음
   ・6절: 🔔 알림 — 일정 태그만 · 모양 · 지우기
   ・7절: 배선 — 부르는 곳이 firebaseAPI 로 일정을 안 부름 · firebase-init 에 옛 메서드가 없음 · html · smoke 순서
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
  API: pick(['schedule-api.js', 'parts/myhome/schedule-api.js', 'app/parts/myhome/schedule-api.js']),
  SCH: pick(['scheduler.js', 'parts/myhome/scheduler.js', 'app/parts/myhome/scheduler.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  INIT: pick(['myhome-init.js', 'parts/myhome/myhome-init.js', 'app/parts/myhome/myhome-init.js']),
  VISIT: pick(['myhome-visit.js', 'parts/myhome/myhome-visit.js', 'app/parts/myhome/myhome-visit.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwScheduleApi; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : 'request' });
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', U3 = '33333333-3333-4333-8333-333333333333';

/* 가짜 authed — 부른 것을 적고 길마다 정한 답을 낸다. 읽기는 onOwner 로 주인을, 쓰기는 expectOwner 를 실제 api-client 처럼 견준다 */
function fake(routes, who){
  const log = [];
  const state = { who: who || 'tokenA' };
  const run = async (method, path, body, opts) => {
    if(method !== 'GET' && opts && opts.expectOwner && opts.expectOwner !== state.who) throw Object.assign(new Error('owner'), { code: 'OWNER_CHANGED', kind: 'auth' });   // 요청이 나가기 전에 끝난다(요청 0)
    log.push({ method, path, body, opts });
    if(method === 'GET' && opts && opts.onOwner) opts.onOwner(state.who);
    const key = method + ' ' + path.split('?')[0].replace(/\/v1\/me\/schedules\/[^/]+$/, '/v1/me/schedules/:id').replace(/\/v1\/me\/notifications\/[^/]+$/, '/v1/me/notifications/:id');
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  return { log, state,
    get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), put: (p, b, o) => run('PUT', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
function mk(src, routes, extra){
  const authed = fake(routes, extra && extra.who), warns = [], ups = [];
  let n = 0;
  const m = load(src).createScheduleApi({
    authed, newId: () => 'req-' + (++n) + '-abcdefgh',
    uploadImage: (extra && extra.uploadImage) || (async (d) => { ups.push(d); return { ok: true, url: 'https://storage.example/users/me/dday_x.jpg' }; }),
    warn: (...a) => warns.push(a.join(' ')),
  });
  return { m, authed, warns, ups };
}
const it = (id, date, text, vis, ver) => ({ id, date, text, visibility: vis || 'PRIVATE', version: ver == null ? 1 : ver });
const card = (id, text, date, over) => Object.assign({ ddayId: id, text, date, visibility: 'PRIVATE', notify: false, countFromOne: true, bgColor: null, bgImage: null, createdAt: '2026-10-01T00:00:00Z' }, over || {});
const BOARD = (over) => Object.assign({ version: 5, cards: [card(U1, '만난 날', '2026-01-01', { notify: true, bgColor: '#ffcc00' }), card(U2, '졸업', '2026-02-02', { countFromOne: false })],
  banners: [card(U3, '시험', '2026-12-25', { visibility: 'PUBLIC', countFromOne: false })] }, over || {});
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rej = async (p) => { try{ await p; return null; }catch(e){ return e; } };

async function main(){
const SRC = SRC0.API;

say('── 1. 일정 읽기');
{
  const list = [it('a', '2026-11-03', '회의', 'PUBLIC', 4), it('b', '2026-11-03', '점심', 'PRIVATE', 1), it('c', '2026-12-01', '다른 달', 'PRIVATE', 1)];
  const { m, authed } = mk(SRC, { 'GET /v1/me/schedules': list });
  const d = await m.fetchMonth('me1', '2026-11');
  chk(authed.log[0].path === '/v1/me/schedules?month=2026-11' && authed.log[0].opts.auth === true, '내 달력 — GET /v1/me/schedules?month=YYYY-MM · 로그인 통로');
  chk(eq(Object.keys(d), ['03']) && d['03'].a.text === '회의' && d['03'].a.public === true && d['03'].a.version === 4 && d['03'].b.public === false, '  날짜(DD)별 · public ← visibility · 판 version 을 들고 있다');
  chk(d['03'].a.ts === 1 && d['03'].b.ts === 2, '  ts 는 서버가 준 차례(날짜 → 만든 순)를 잇는 번호');
  chk(!('02' in d) && Object.keys(d).length === 1, '  다른 달 줄은 버린다');
  const e = mk(SRC, { 'GET /v1/me/schedules': [] });
  chk(eq(await e.m.fetchMonth('me1', '2026-11'), {}), '일정이 없는 달은 빈 객체({}) — 못 읽음이 아니다');
  const bad = mk(SRC, { 'GET /v1/me/schedules': [{ id: 'x' }] });
  chk((await rej(bad.m.fetchMonth('me1', '2026-11'))).code === 'SHAPE', '모양이 틀리면 던진다(SHAPE)');
  const nonArr = mk(SRC, { 'GET /v1/me/schedules': { items: [] } });
  chk((await rej(nonArr.m.fetchMonth('me1', '2026-11'))).code === 'SHAPE', '  배열이 아니어도 던진다');
  const down = mk(SRC, { 'GET /v1/me/schedules': apiErr(503, 'X') });
  chk((await rej(down.m.fetchMonth('me1', '2026-11'))).status === 503, '못 읽으면 던진다(빈 달로 바꾸지 않는다)');
  chk((await rej(e.m.fetchMonth('', '2026-11'))).code === 'NO_USER', '내 코드가 없으면 요청 0 · 던진다');
  const o2 = mk(SRC, { 'GET /v1/schedules/f1': list });
  const od = await o2.m.fetchMonthOf('f1', '2026-11');
  chk(o2.authed.log[0].path === '/v1/schedules/f1?month=2026-11' && Object.keys(od['03']).length === 2, '남의 달력 — GET /v1/schedules/{userCode}?month=');
}

say('── 2. 일정 쓰기');
{
  const created = it('n1', '2026-11-05', '병원', 'PUBLIC', 1);
  const { m, authed } = mk(SRC, { 'GET /v1/me/schedules': [], 'POST /v1/me/schedules': created, 'DELETE /v1/me/schedules/:id': null });
  const e0 = await rej(m.createItem('me1', { date: '2026-11-05', text: '병원' }));
  chk(e0 && e0.code === 'NOT_RECEIVED' && authed.log.length === 0, '받기 전(읽은 적 없음)에는 요청 0 · 던진다');
  await m.fetchMonth('me1', '2026-11');
  const r = await m.createItem('me1', { date: '2026-11-05', text: '병원', public: false, tagFriends: ['f1', 'f2'] });
  const p = authed.log.find((x) => x.method === 'POST');
  chk(p.path === '/v1/me/schedules' && p.body.requestId === 'req-1-abcdefgh' && p.body.date === '2026-11-05' && eq(p.body.tagFriends, ['f1', 'f2']), '일정 쓰기 — POST /v1/me/schedules { requestId · date · text · tagFriends }');
  chk(p.body.visibility === 'PRIVATE', '  화면 값(비공개) 그대로 보낸다 — 앱이 혼자 공개로 바꾸지 않는다(태그하면 서버가 공개로 바꾼다 · 화면은 «공개» 를 켜서 잠근다)');
  chk(p.opts.expectOwner === 'tokenA', '  ★ 읽은 토큰의 주인과 묶는다(expectOwner)');
  chk(r.id === 'n1' && r.public === true && r.version === 1 && r.date === '2026-11-05', '  돌려주는 값 — 서버가 만든 일정');
  await m.createItem('me1', { date: '2026-11-05', text: '홀로', public: false });
  const p2 = authed.log.filter((x) => x.method === 'POST')[1];
  await m.createItem('me1', { date: '2026-11-05', text: '공개', public: true, tagFriends: ['f1'] });
  chk(authed.log.filter((x) => x.method === 'POST')[2].body.visibility === 'PUBLIC', '  화면이 켠 공개는 그대로 PUBLIC');
  chk(p2.body.visibility === 'PRIVATE' && !('tagFriends' in p2.body) && p2.body.requestId === 'req-2-abcdefgh', '  태그 없고 비공개면 PRIVATE · tagFriends 칸 없음 · 요청 번호는 새로');
  await m.createItem('me1', { date: '2026-11-05', text: 'x'.repeat(60) });
  chk(authed.log.filter((x) => x.method === 'POST')[3].body.text.length === 40, '  글자는 서버 상한(40)으로 깎는다');
  authed.state.who = 'tokenB';
  const stale = await rej(m.createItem('me1', { date: '2026-11-05', text: '남의 토큰' }));
  chk(stale && stale.code === 'OWNER_CHANGED' && authed.log.filter((x) => x.method === 'POST').length === 4, '읽은 뒤 로그인한 사람이 바뀌면 보내지 않는다(OWNER_CHANGED)');
  authed.state.who = 'tokenA';
  await m.deleteItem('me1', 'n1', 4);
  const d = authed.log.find((x) => x.method === 'DELETE');
  chk(d.path === '/v1/me/schedules/n1?version=4' && d.opts.expectOwner === 'tokenA', '지우기 — DELETE /v1/me/schedules/{id}?version= · expectOwner');
  chk((await rej(m.deleteItem('me1', 'n1', undefined))).code === 'BAD_ITEM', '  판 없이는 보내지 않는다');
  m.reset();
  chk((await rej(m.deleteItem('me1', 'n1', 4))).code === 'NOT_RECEIVED', 'reset 뒤에는 다시 받기 전까지 쓰지 않는다');
}

say('── 3. 디데이 보드 읽기');
{
  const { m, authed } = mk(SRC, { 'GET /v1/me/ddays': BOARD() });
  const b = await m.fetchBoard('me1');
  chk(authed.log[0].path === '/v1/me/ddays', '내 보드 — GET /v1/me/ddays');
  chk(b[U1].kind === 'anniv' && b[U3].kind === 'dday' && b[U1].order === 0 && b[U2].order === 1 && b[U3].order === 0, '두 목록이 한 맵 — cards → anniv · banners → dday · order = 목록 순서');
  chk(b[U1].base1 === true && b[U2].base1 === false && b[U1].notify === true && b[U1].bgColor === '#ffcc00' && b[U3].public === true, '  countFromOne → base1 · notify · bgColor · visibility → public');
  chk(b[U1].bgImg === null && b[U1].ts === Date.parse('2026-10-01T00:00:00Z'), '  그림 없음 → null · createdAt → ts(ms)');
  const withImg = mk(SRC, { 'GET /v1/me/ddays': BOARD({ cards: [card(U1, 'a', '2026-01-01', { bgImage: 'https://s/x.jpg' })], banners: [] }) });
  chk((await withImg.m.fetchBoard('me1'))[U1].bgImg === 'https://s/x.jpg', '  bgImage → bgImg');
  const empty = mk(SRC, { 'GET /v1/me/ddays': { version: 0, cards: [], banners: [] } });
  chk(eq(await empty.m.fetchBoard('me1'), {}), '저장한 적 없는 보드(판 0 · 빈 목록)는 {} — 못 읽음이 아니다');
  const bad = mk(SRC, { 'GET /v1/me/ddays': { version: 1, cards: [{ ddayId: U1 }], banners: [] } });
  chk((await rej(bad.m.fetchBoard('me1'))).code === 'SHAPE', '장 모양이 틀리면 던진다');
  const noVer = mk(SRC, { 'GET /v1/me/ddays': { cards: [], banners: [] } });
  chk((await rej(noVer.m.fetchBoard('me1'))).code === 'SHAPE', '판이 없으면 던진다');
  const o = mk(SRC, { 'GET /v1/ddays/f1': { cards: BOARD().cards, banners: [] } });
  const od = await o.m.fetchBoardOf('f1');
  chk(o.authed.log[0].path === '/v1/ddays/f1' && Object.keys(od).length === 2, '남의 보드 — GET /v1/ddays/{userCode} (판 없음)');
  const ids = m.orderedIds({ a: { kind: 'anniv', order: 2, ts: 1 }, b: { kind: 'anniv', order: 0, ts: 9 }, c: { kind: 'anniv', ts: 1 }, d: { kind: 'anniv', ts: 0 }, e: { kind: 'dday', order: 0 }, f: { order: 1, ts: 5 } }, 'anniv');
  chk(eq(ids, ['b', 'f', 'a', 'd', 'c']), '순서 정렬 — order 작은 쪽 먼저 · order 없으면 맨 뒤 · 같으면 만든 순 · kind 없는 옛 값은 기념일');
}

say('── 4. 디데이 보드 저장');
{
  const saved = BOARD({ version: 6 });
  const { m, authed } = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': () => saved });
  const board = await m.fetchBoard('me1');
  const next = JSON.parse(JSON.stringify(board));
  next['new-1'] = { kind: 'anniv', text: '새 기념일', date: '2027-01-01', public: false, notify: true, base1: true, bgColor: '#ff0000', bgImg: null, order: 2, ts: 5 };
  next['new-2'] = { kind: 'dday', text: '새 배너', date: '2027-02-02', public: true, notify: false, base1: true, bgColor: '#00ff00', bgImg: 'https://s/b.jpg', order: 1, ts: 6 };
  const out = await m.saveBoard('me1', next, { id: 'new-1', userCodes: ['f1'] });
  const put = authed.log.find((x) => x.method === 'PUT');
  chk(put.path === '/v1/me/ddays' && put.body.version === 5 && put.opts.expectOwner === 'tokenA', '보드 통째 저장 — PUT /v1/me/ddays · 마지막으로 읽은 판 · expectOwner');
  chk(put.body.cards.length === 3 && put.body.banners.length === 2 && put.body.cards[0].ddayId === U1 && put.body.cards[1].ddayId === U2, '  두 목록 — 카드 3 · 배너 2 · order 순');
  const nc = put.body.cards[2];
  chk(!('ddayId' in nc) && nc.text === '새 기념일' && nc.visibility === 'PRIVATE' && nc.notify === true && nc.countFromOne === true && nc.bgColor === '#ff0000', '  새 장은 ddayId 를 싣지 않는다(서버가 정한다) · 카드는 countFromOne · bgColor');
  const nb = put.body.banners[1];
  chk(!('countFromOne' in nb) && !('bgColor' in nb) && !('bgImage' in nb) && nb.visibility === 'PUBLIC', '  배너는 셈법 · 배경을 싣지 않는다(카드만)');
  chk(eq(put.body.tagFriends, { kind: 'CARD', index: 2, userCodes: ['f1'] }), '  태그 — 저장한 한 장이 속한 목록의 몇 번째인지(CARD · 2)');
  chk(Object.keys(out).length === 3 && out[U3].kind === 'dday', '  돌려주는 값 — 서버가 돌려준 보드(새 id · 순서)가 정답');
  await m.saveBoard('me1', board, null);
  const put2 = authed.log.filter((x) => x.method === 'PUT')[1];
  chk(put2.body.version === 6 && !('tagFriends' in put2.body), '  저장하면 판이 새 판(6)으로 — 다음 저장은 그 판 · 태그 없으면 칸 없음');
  await m.saveBoard('me1', next, { id: 'new-2', userCodes: ['f1', 'f2'] });
  chk(eq(authed.log.filter((x) => x.method === 'PUT')[2].body.tagFriends, { kind: 'BANNER', index: 1, userCodes: ['f1', 'f2'] }), '  배너 태그 — BANNER · 1');
  await m.saveBoard('me1', next, { id: 'new-1', userCodes: [] });
  chk(!('tagFriends' in authed.log.filter((x) => x.method === 'PUT')[3].body), '  태그할 친구가 없으면 칸을 싣지 않는다');
  const long = JSON.parse(JSON.stringify(board)); long[U1].text = 'ㄱ'.repeat(30);
  await m.saveBoard('me1', long, null);
  chk(authed.log.filter((x) => x.method === 'PUT')[4].body.cards[0].text.length === 20, '  글자는 서버 상한(20)으로 깎는다');
}
{ /* 409 · 계정 바뀜 */
  let calls = 0;
  const { m, authed } = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': () => { calls++; return calls === 1 ? apiErr(409, 'CONCURRENT_UPDATE') : BOARD({ version: 9 }); } });
  const board = await m.fetchBoard('me1');
  const e1 = await rej(m.saveBoard('me1', board, null));
  chk(e1 && e1.status === 409 && e1.code === 'CONCURRENT_UPDATE', '409 는 그대로 던진다(덮어쓰지 않는다)');
  const e2 = await rej(m.saveBoard('me1', board, null));
  chk(e2 && e2.code === 'NOT_RECEIVED' && authed.log.filter((x) => x.method === 'PUT').length === 1, '  ★ 409 뒤에는 다시 받기 전까지 보내지 않는다(같은 판으로 다시 보내 남의 고침을 덮지 않게) — 요청 0');
  await m.fetchBoard('me1');
  await m.saveBoard('me1', board, null);
  chk(authed.log.filter((x) => x.method === 'PUT').length === 2, '  다시 받으면 쓸 수 있다');
  authed.state.who = 'tokenB';
  const e3 = await rej(m.saveBoard('me1', board, null));
  chk(e3 && e3.code === 'OWNER_CHANGED' && authed.log.filter((x) => x.method === 'PUT').length === 2, '읽은 뒤 로그인한 사람이 바뀌면 보내지 않는다(OWNER_CHANGED) · 요청 0');
  const e4 = await rej(m.saveBoard('me1', board, null));
  chk(e4 && e4.code === 'NOT_RECEIVED', '  그 뒤에도 다시 받기 전까지 막힌다');
  const fresh = mk(SRC, { 'PUT /v1/me/ddays': BOARD() });
  const e5 = await rej(fresh.m.saveBoard('me1', {}, null));
  chk(e5 && e5.code === 'NOT_RECEIVED' && fresh.authed.log.length === 0, '받기 전에는 요청 0');
  { /* 읽은 토큰 주인이 다르면 앞 주인의 판을 잇지 않는다 */
    const x = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'GET /v1/me/schedules': [], 'PUT /v1/me/ddays': BOARD() });
    const xb = await x.m.fetchBoard('me1');
    x.authed.state.who = 'tokenB';
    await x.m.fetchMonth('me1', '2026-11');
    const e = await rej(x.m.saveBoard('me1', xb, null));
    chk(e && e.code === 'NOT_RECEIVED' && x.authed.log.filter((y) => y.method === 'PUT').length === 0, '★ 판은 같은 토큰 주인이 읽은 것만 잇는다 — 다른 주인이 달력을 읽은 틈에 앞 주인의 판으로 보드를 덮지 않는다(요청 0)');
  }
  { /* reset 전에 시작한 읽기가 늦게 끝나도 기억을 되살리지 않는다 */
    let release;
    const gate = new Promise((r) => { release = r; });
    const y = mk(SRC, { 'GET /v1/me/schedules': () => gate.then(() => []), 'POST /v1/me/schedules': it('n1', '2026-11-05', 'a') });
    const pending = y.m.fetchMonth('me1', '2026-11');
    y.m.reset(); release(); await pending;
    const e = await rej(y.m.createItem('me1', { date: '2026-11-05', text: 'a' }));
    chk(e && e.code === 'NOT_RECEIVED' && y.authed.log.filter((z) => z.method === 'POST').length === 0, '★ reset 전에 시작한 읽기가 늦게 끝나도 «받음» 기억을 되살리지 않는다 — 쓰기 요청 0');
  }
  const month = mk(SRC, { 'GET /v1/me/schedules': [], 'PUT /v1/me/ddays': BOARD() });
  await month.m.fetchMonth('me1', '2026-11');
  chk((await rej(month.m.saveBoard('me1', {}, null))).code === 'NOT_RECEIVED', '달력만 읽고 보드를 안 읽었으면 보드는 쓰지 않는다(판이 없다)');
  const full = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': apiErr(409, 'SCHEDULE_DDAY_FULL') });
  const fb = await full.m.fetchBoard('me1');
  await rej(full.m.saveBoard('me1', fb, null));
  await rej(full.m.saveBoard('me1', fb, null));
  chk(full.authed.log.filter((x) => x.method === 'PUT').length === 2, '409 라도 상한(SCHEDULE_DDAY_FULL)이면 판은 그대로 — 다시 쓸 수 있다(CONCURRENT_UPDATE 만 잠근다)');
  const bad = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': { ok: 1 } });
  await bad.m.fetchBoard('me1');
  chk((await rej(bad.m.saveBoard('me1', {}, null))).code === 'SHAPE', '저장 답의 모양이 틀리면 던진다');
}

say('── 5. 카드 그림');
{
  const { m, authed, ups } = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD({ version: 6 }) });
  const board = await m.fetchBoard('me1');
  board[U1].bgImg = 'data:image/jpeg;base64,AAAA';
  board[U2].bgImg = 'https://storage.example/old.jpg';
  board[U3].bgImg = 'data:image/jpeg;base64,BBBB';   // 배너에는 그림이 없다 — 올리지도 보내지도 않는다
  await m.saveBoard('me1', board, null);
  const put = authed.log.find((x) => x.method === 'PUT');
  chk(ups.length === 1 && ups[0] === 'data:image/jpeg;base64,AAAA', '새로 고른 그림(data:)만 올린다 — 이미 주소인 것 · 배너 것은 올리지 않는다');
  chk(put.body.cards[0].bgImage === 'https://storage.example/users/me/dday_x.jpg' && put.body.cards[1].bgImage === 'https://storage.example/old.jpg' && !('bgImage' in put.body.banners[0]), '  저장 본문엔 data: 대신 올린 주소 · 있던 주소는 그대로');
  chk(board[U1].bgImg.startsWith('data:'), '  부른 쪽 값은 건드리지 않는다');
  for(const [name, uploadImage] of [['실패(ok:false)', async () => ({ ok: false })], ['던짐', async () => { throw new Error('net'); }], ['주소 없음', async () => ({ ok: true, url: '' })]]){
    const f = mk(SRC, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() }, { uploadImage });
    const b2 = await f.m.fetchBoard('me1'); b2[U1].bgImg = 'data:image/jpeg;base64,AAAA';
    const e = await rej(f.m.saveBoard('me1', b2, null));
    chk(e && e.code === 'IMAGE_UPLOAD' && f.authed.log.filter((x) => x.method === 'PUT').length === 0, '그림 올리기 ' + name + ' → IMAGE_UPLOAD · 보드를 보내지 않는다');
  }
}

say('── 6. 🔔 알림');
{
  const items = [
    { id: 'n1', kind: 'SCHEDULE_TAG', section: 'BELL', title: '친구A 님이 일정에 태그했어요', body: '같이 점심', payload: { date: '2026-11-03', from: 'ucodeA', fromName: '친구A' }, createdAt: '2026-11-01T01:00:00Z' },
    { id: 'n2', kind: 'LEVEL_UNLOCK', section: 'MAIL', title: 'x', body: 'y', payload: {}, createdAt: '2026-11-01T01:00:00Z' },
    { id: 'n3', kind: 'SCHEDULE_TAG', section: 'BELL', title: 't', body: 'b', payload: { from: 'u' }, createdAt: '2026-11-01T01:00:00Z' },
  ];
  const { m, authed } = mk(SRC, { 'GET /v1/me/notifications': { items, nextCursor: null }, 'DELETE /v1/me/notifications/:id': null });
  const b = await m.fetchBell('me1');
  chk(authed.log[0].path === '/v1/me/notifications?section=BELL&limit=50', '🔔 칸 — GET /v1/me/notifications?section=BELL');
  chk(eq(Object.keys(b), ['n1']) && b.n1.fromName === '친구A' && b.n1.fromId === 'ucodeA' && b.n1.text === '같이 점심' && b.n1.date === '2026-11-03' && b.n1.ts === Date.parse('2026-11-01T01:00:00Z'), '  일정 태그만 · 보낸 사람 · 내용 · 날짜 · 시각을 화면 모양으로 · 날짜 없는 줄은 버림');
  const empty = mk(SRC, { 'GET /v1/me/notifications': { items: [], nextCursor: null } });
  chk(eq(await empty.m.fetchBell('me1'), {}), '알림이 없으면 {} — 못 읽음이 아니다');
  chk((await rej(mk(SRC, { 'GET /v1/me/notifications': [] }).m.fetchBell('me1'))).code === 'SHAPE', '모양이 틀리면 던진다');
  await m.deleteBell('me1', 'n1');
  const d = authed.log.find((x) => x.method === 'DELETE');
  chk(d.path === '/v1/me/notifications/n1' && d.opts.expectOwner === 'tokenA', '지우기 — DELETE /v1/me/notifications/{id} · expectOwner');
}

say('── 7. 배선');
{
  const FI = strip(SRC0.FI), APP = strip(SRC0.APP);
  const OLD = ['getScheduleMonth', 'subscribeScheduleMonth', 'addScheduleItem', 'removeScheduleItem', 'setScheduleItemPublic', 'subscribeDdays', 'saveDday', 'removeDday', 'setDdayOrder', 'sendScheduleNotices', 'subscribeSchedNotices', 'removeSchedNotice'];
  chk(OLD.every((n) => !new RegExp('\\b' + n + '\\b').test(FI)), 'firebase-init.js 에 일정 · 디데이 옛 메서드가 없다');
  chk(/async uploadDdayImage\(/.test(FI) && /dday_\$\{key\}\.jpg/.test(FI), '  카드 그림 올리기만 남았다(uploadDdayImage — 서버가 받는 dday_ 이름)');
  const callers = [strip(SRC0.SCH), strip(SRC0.INIT), strip(SRC0.VISIT)].join('\n');
  chk(OLD.every((n) => !new RegExp('firebaseAPI\\.' + n + '\\b').test(callers)) && !/firebaseAPI/.test(strip(SRC0.SCH)), '부르는 곳(scheduler · myhome-init · myhome-visit)이 firebaseAPI 로 일정을 안 부른다');
  chk(/TwScheduleApi\.createScheduleApi\(\{\s*authed: TwApi\.authed,/.test(APP) && /scheduleApi: scheduleApiMod/.test(APP), 'app.js 가 로그인 통로(TwApi.authed)로 provider 를 만들어 스케줄러에 넘긴다');
  const H = SRC0.HTML, a = H.indexOf('<script src="parts/myhome/schedule-api.js"></script>'), s = H.indexOf('<script src="parts/myhome/scheduler.js"></script>'), p = H.indexOf('<script src="parts/app.js"></script>');
  chk(a > 0 && a < s && s < p, 'html — schedule-api.js 가 scheduler.js · app.js 앞');
  chk(/PRELOAD\.push\('schedule-api\.js'\)/.test(SRC0.SMOKE), 'smoke PRELOAD 에 schedule-api.js');
}

say('── 8. 일부러 깨 보기 (빨강이 나야 한다)');
{
  const broken = async (label, patch, scenario) => {
    const src = patch(SRC);
    if(src === SRC){ chk(false, '깨 보기 — ' + label + ' (바뀐 곳이 없다 — 판정 글자를 못 찾음)'); return; }
    quiet = true; qfail = 0;
    try{ await scenario(src); }catch(e){ qfail++; }
    quiet = false;
    chk(qfail > 0, '깨 보기 — ' + label + ' → 빨강');
  };
  const oneSave = async (src) => {
    const { m, authed } = mk(src, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD({ version: 6 }) });
    const board = await m.fetchBoard('me1');
    authed.state.who = 'tokenB';
    chk(!!(await rej(m.saveBoard('me1', board, null))) && authed.log.filter((x) => x.method === 'PUT').length === 0, 'x');
  };
  await broken('expectOwner 를 빼면 로그인이 바뀐 뒤에도 보낸다', (x) => x.replace('{ expectOwner: read.owner });\n      if(!out) throw shapeError();\n      reads.set', '{});\n      if(!out) throw shapeError();\n      reads.set').replace(/\{ expectOwner: read\.owner \}\)\)/g, '{}))'), oneSave);
  await broken('409 뒤에도 판을 남기면 같은 판으로 다시 보낸다', (x) => x.replace('e.code === OWNER_CHANGED_CODE || (e.status === CONFLICT_STATUS && e.code === CONCURRENT_CODE)', 'e.code === OWNER_CHANGED_CODE'), async (src) => {
    let n = 0;
    const { m, authed } = mk(src, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': () => (++n === 1 ? apiErr(409, 'CONCURRENT_UPDATE') : BOARD()) });
    const board = await m.fetchBoard('me1');
    await rej(m.saveBoard('me1', board, null));
    const e = await rej(m.saveBoard('me1', board, null));
    chk(e && e.code === 'NOT_RECEIVED', 'x');
  });
  await broken('다른 토큰 주인의 읽기에도 앞 판을 잇는다', (x) => x.replace('prev && prev.owner === owner ? prev.v : undefined', 'prev ? prev.v : undefined'), async (src) => {
    const x = mk(src, { 'GET /v1/me/ddays': BOARD(), 'GET /v1/me/schedules': [], 'PUT /v1/me/ddays': BOARD() });
    const xb = await x.m.fetchBoard('me1');
    x.authed.state.who = 'tokenB';
    await x.m.fetchMonth('me1', '2026-11');
    chk(!!(await rej(x.m.saveBoard('me1', xb, null))), 'x');
  });
  await broken('reset 뒤 늦게 끝난 읽기가 기억을 되살린다', (x) => x.replace('if(at !== epoch) return d;', ''), async (src) => {
    let release; const gate = new Promise((r) => { release = r; });
    const y = mk(src, { 'GET /v1/me/schedules': () => gate.then(() => []), 'POST /v1/me/schedules': it('n1', '2026-11-05', 'a') });
    const pending = y.m.fetchMonth('me1', '2026-11'); y.m.reset(); release(); await pending;
    chk(!!(await rej(y.m.createItem('me1', { date: '2026-11-05', text: 'a' }))), 'x');
  });
  await broken('새 장에도 ddayId 를 싣는다', (x) => x.replace('if(UUID_RE.test(id)) o.ddayId = id;', 'o.ddayId = id;'), async (src) => {
    const { m, authed } = mk(src, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() });
    const board = await m.fetchBoard('me1'); board['new-1'] = { kind: 'anniv', text: 'n', date: '2027-01-01', order: 5, ts: 1 };
    await m.saveBoard('me1', board, null);
    chk(!('ddayId' in authed.log.find((y) => y.method === 'PUT').body.cards[2]), 'x');
  });
  await broken('배너에도 셈법을 싣는다', (x) => x.replace("if(d.kind !== KIND.BANNER){\n    o.countFromOne", "if(true){\n    o.countFromOne"), async (src) => {
    const { m, authed } = mk(src, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() });
    const board = await m.fetchBoard('me1');
    await m.saveBoard('me1', board, null);
    chk(!('countFromOne' in authed.log.find((y) => y.method === 'PUT').body.banners[0]), 'x');
  });
  await broken('그림 올리기가 실패해도 보드를 보낸다', (x) => x.replace("throw codeError(IMAGE_UPLOAD_CODE, '카드 그림을 올리지 못했어요');", 'void 0;'), async (src) => {
    const f = mk(src, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() }, { uploadImage: async () => ({ ok: false }) });
    const b = await f.m.fetchBoard('me1'); b[U1].bgImg = 'data:image/jpeg;base64,AAAA';
    await rej(f.m.saveBoard('me1', b, null));
    chk(f.authed.log.filter((y) => y.method === 'PUT').length === 0, 'x');
  });
  await broken('받기 전에도 일정을 쓴다', (x) => x.replace("if(!r) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');", 'if(!r) return {};'), async (src) => {
    const { m, authed } = mk(src, { 'POST /v1/me/schedules': it('n1', '2026-11-05', 'a') });
    await rej(m.createItem('me1', { date: '2026-11-05', text: 'a' }));
    chk(authed.log.length === 0, 'x');
  });
  await broken('태그하면 앱이 혼자 PUBLIC 으로 바꿔 보낸다', (x) => x.replace("visibility: o.public ? 'PUBLIC' : 'PRIVATE' };", "visibility: (o.public || tags.length) ? 'PUBLIC' : 'PRIVATE' };"), async (src) => {
    const { m, authed } = mk(src, { 'GET /v1/me/schedules': [], 'POST /v1/me/schedules': it('n1', '2026-11-05', 'a') });
    await m.fetchMonth('me1', '2026-11');
    await m.createItem('me1', { date: '2026-11-05', text: 'a', public: false, tagFriends: ['f1'] });
    chk(authed.log.find((y) => y.method === 'POST').body.visibility === 'PRIVATE', 'x');
  });
  await broken('다른 달 줄을 안 버린다', (x) => x.replace("if(it.date.slice(0, 7) !== ym) continue;", ''), async (src) => {
    const { m } = mk(src, { 'GET /v1/me/schedules': [it('a', '2026-11-03', 'a'), it('c', '2026-12-01', 'c')] });
    chk(Object.keys(await m.fetchMonth('me1', '2026-11')).length === 1, 'x');
  });
  await broken('모양이 틀려도 빈 달로 읽는다', (x) => x.replace("if(!out) throw shapeError();\n    return out;\n  }\n  async function fetchMonthOf", "return out || {};\n  }\n  async function fetchMonthOf"), async (src) => {
    const { m } = mk(src, { 'GET /v1/me/schedules': { not: 'array' } });
    chk(!!(await rej(m.fetchMonth('me1', '2026-11'))), 'x');
  });
  await broken('배너 목록도 카드 목록으로 읽는다', (x) => x.replace('[data.banners, KIND.BANNER]', '[data.banners, KIND.CARD]'), async (src) => {
    const { m } = mk(src, { 'GET /v1/me/ddays': BOARD() });
    chk((await m.fetchBoard('me1'))[U3].kind === 'dday', 'x');
  });
  await broken('태그가 아닌 알림도 🔔 에 올린다', (x) => x.replace("raw.kind !== BELL_KIND || ", ''), async (src) => {
    const { m } = mk(src, { 'GET /v1/me/notifications': { items: [{ id: 'm1', kind: 'LEVEL_UNLOCK', body: 'b', payload: { date: '2026-11-03' }, createdAt: '2026-11-01T00:00:00Z' }], nextCursor: null } });
    chk(Object.keys(await m.fetchBell('me1')).length === 0, 'x');
  });
  await broken('글자 상한을 안 깎는다', (x) => x.replace('str(d.text).slice(0, LIMITS.DDAY_TEXT)', 'str(d.text)'), async (src) => {
    const { m, authed } = mk(src, { 'GET /v1/me/ddays': BOARD(), 'PUT /v1/me/ddays': BOARD() });
    const b = await m.fetchBoard('me1'); b[U1].text = 'ㄱ'.repeat(30);
    await m.saveBoard('me1', b, null);
    chk(authed.log.find((y) => y.method === 'PUT').body.cards[0].text.length === 20, 'x');
  });
}

say(`\n결과: ${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log('  ✗ 검사가 중간에 멈춤 — ' + (e && e.stack || e)); process.exit(1); });
