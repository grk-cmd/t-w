/* sim-xmas-api.js — 🎄 크리스마스 서버 endpoint provider(parts/xmas/xmas-api.js · 일회성)를 가짜 로그인 통로로 돌려 본다
   실행: node checks/run.js sim-xmas-api
   ・1절 읽기 — 경로(사람 코드를 싣지 않음) · 지금 트리 · 날짜 한 벌(schedule — 틀린 값은 앞 값 유지) · 장식 목록 모양({ k, v, w, id } · 틀린 id 버림) · 빈 트리 ≠ 못 읽음
   ・2절 가입 전(USER_CODE_NOT_BOUND) — 트리는 그리고 mine:null · 편지 · 받은 편지는 auth · 로그인 없음(NO_TOKEN)은 auth
   ・3절 장식 걸기 — 본문(kind · word · previewTree · version · 그림은 img 일 때만) · 판 기억(처음 null → 응답 판) · 읽은 토큰 주인과 묶음 · 409 는 conflict + 다시 읽기
   ・4절 편지 — 맡기기 본문(판 · 곡 모양 · fromReturned) · 거두기 ?version= · 모르는 칸은 요청 0 · 반송 표시 지우기 · 받은 편지 + matched
   ・5절 신고 — 대상 모양(장식 · 받은 편지) · 메모 40자 · 두 번째 dup · 내 장식 invalid-argument
   ・6절 오류 표 — 서버 오류 이름 → 옛 code(설계 6-4 · 23개)
   ・7절 그림 — Storage 주소(이 앱 버킷 · xmas%2F{id}.png · alt=media) · 바이트 → PNG data URL · 16KB 넘음 · 틀린 id 는 받지 않음
   ・8절 배선 — app.js 가 TwApi.authed 로 만들어 net 으로 · html · smoke 순서 · 옛 Firebase 통로(xmas-net) 없음
   ・9절 mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if (!quiet) console.log(s); };
const chk = (ok, msg) => { if (quiet){ if (!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['xmas-api.js', 'parts/xmas/xmas-api.js', 'app/parts/xmas/xmas-api.js', 'apps/desktop/app/parts/xmas/xmas-api.js']),
  RULES: pick(['xmas-rules.js', 'parts/xmas/xmas-rules.js', 'app/parts/xmas/xmas-rules.js', 'apps/desktop/app/parts/xmas/xmas-rules.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
};
for (const k of Object.keys(SRC0)) if (!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
const R = load(SRC0.RULES, 'TwXmasRules');
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code, msg) => Object.assign(new Error(msg || code || String(status)), { status, code: code || '', kind: status === 401 || status === 403 ? 'auth' : status >= 500 ? 'unavailable' : 'request' });
const ID = (c) => c.repeat(32);
const iso = (ms) => new Date(ms).toISOString();
const CUR = { cur: 3, count: 117, max: 300, letterDeadline: iso(R.LETTER_DEADLINE_MS), returnCutoff: iso(R.LETTER_DEADLINE_MS - 60000), eventEnd: iso(R.EVENT_END_MS), lettersViewUntil: iso(R.LETTERS_VIEW_UNTIL_MS), matched: false };
const ME = (o) => Object.assign({ mine: null, letters: {}, returned: {}, received: {} }, o || {});

/* 가짜 authed — 부른 것을 적고, 길마다 정한 답을 낸다(함수면 불러서) */
function fake(routes, owner){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    if (opts && opts.expectOwner && opts.expectOwner !== (owner.who)) throw apiErr(0, 'OWNER_CHANGED');
    const key = method + ' ' + path.split('?')[0];
    if (!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path) : r;
    if (v instanceof Error) throw v;
    if (opts && opts.onOwner) opts.onOwner(owner.who);
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), put: (p, b, o) => run('PUT', p, b, o), post: (p, b, o) => run('POST', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
function mk(src, routes, o){
  const opt = o || {};
  const owner = { who: 'tokA' };
  const authed = fake(routes, owner), warns = [], fetches = [];
  const fetchFn = async (url, init) => { fetches.push({ url, init }); return opt.res ? opt.res(url) : { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer }; };
  const m = load(src, 'TwXmasApi').createXmasApi({ authed, rules: R, myCode: () => 'ME01', storageBucket: () => opt.bucket || 'together-working-dev.firebasestorage.app',
    fetch: fetchFn, warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, owner, warns, fetches };
}
const base = (o) => Object.assign({ 'GET /v2/xmas/trees/current': CUR, 'GET /v2/me/xmas': ME() }, o || {});

async function judge(S){
  const LIB = S.API;

  say('── 1절 읽기');
  {
    const { m, authed } = mk(LIB, base({ 'GET /v2/me/xmas': ME({ mine: { tree: 2, slot: 17, kind: 'img', version: 4, word: null, imageId: ID('a') } }),
      'GET /v2/xmas/trees/2/ornaments': { tree: 2, ornaments: { 0: { kind: 'star', version: 1, word: '메리' }, 17: { kind: 'img', version: 4, imageId: ID('a') }, 9: { kind: 'img', version: 1, imageId: '../x' }, x: { kind: 'star', version: 1 }, 5: { kind: 'bulb' } } } }));
    chk(m.schedule() === null, '읽기 전 날짜 한 벌은 null(화면은 처음 값)');
    chk(m.scheduleNow() === R.SCHEDULE, '  ↳ scheduleNow 는 읽기 전엔 처음 값(창 · 알림함 기다림이 같이 쓴다)');
    const w = await m.where();
    chk(authed.log.map(x => x.method + ' ' + x.path).join() === 'GET /v2/xmas/trees/current,GET /v2/me/xmas' && authed.log.every(x => x.opts.auth === true && !/ME01/.test(x.path)), '지금 트리 · 내 몫 — 로그인 통로 · 경로에 내 코드 없음');
    chk(w.ok && w.cur === 3 && w.matched === false && w.mine.t === 2 && w.mine.s === 17 && w.mine.v === 4 && w.mine.id === ID('a'), '지금 트리 3 · 내 자리(트리 · 자리 · 판 · 그림 id)');
    const sc = m.schedule();
    chk(m.scheduleNow() === sc && sc !== R.SCHEDULE, '  ↳ scheduleNow 는 읽은 뒤엔 서버 값');
    chk(sc && sc.letterDeadline === R.LETTER_DEADLINE_MS && sc.eventEnd === R.EVENT_END_MS && sc.lettersViewUntil === R.LETTERS_VIEW_UNTIL_MS, '날짜 한 벌을 trees/current 에서 남긴다');
    const t = await m.tree(2);
    chk(t.ok && JSON.stringify(t.o) === JSON.stringify({ 0: { k: 'star', v: 1, w: '메리' }, 9: { k: 'img', v: 1 }, 17: { k: 'img', v: 4, id: ID('a') } }), '장식 목록 → { k, v, w, id } · 틀린 그림 id 는 버림 · 틀린 자리 · 판 없는 자리는 뺀다 — ' + JSON.stringify(t.o));
    const e = await mk(LIB, base({ 'GET /v2/xmas/trees/1/ornaments': { tree: 1, ornaments: {} } })).m.tree(1);
    chk(e.ok && JSON.stringify(e.o) === '{}', '빈 트리는 { ok:true, o:{} }');
    const d = await mk(LIB, base({ 'GET /v2/xmas/trees/1/ornaments': apiErr(503, 'DB_BUSY') })).m.tree(1);
    chk(!d.ok && d.code === 'aborted', '못 읽음은 { ok:false } — 빈 트리로 숨기지 않는다');
    const f = await mk(LIB, base({ 'GET /v2/xmas/trees/9/ornaments': apiErr(403, 'XMAS_TREE_FORBIDDEN') })).m.tree(9);
    chk(!f.ok && f.code === 'read', '볼 수 없는 트리 — read');
    chk(!(await m.tree(0)).ok && authed.log.filter(x => /ornaments/.test(x.path)).length === 1, '트리 번호가 틀리면 요청 0');
    const bad = mk(LIB, base({ 'GET /v2/xmas/trees/current': { cur: 1, matched: true, letterDeadline: 'x' } }));
    await bad.m.where();
    chk(bad.m.schedule() === null, '날짜가 틀리면 남기지 않는다');
    const shape = await mk(LIB, base({ 'GET /v2/xmas/trees/current': { cur: 'x' } })).m.where();
    chk(!shape.ok && shape.code === 'read', '모양이 틀린 trees/current 는 못 읽음');
  }

  say('── 2절 가입 전 · 로그인 없음');
  {
    const nb = mk(LIB, base({ 'GET /v2/me/xmas': apiErr(401, 'USER_CODE_NOT_BOUND') }));
    const w = await nb.m.where();
    chk(w.ok && w.cur === 3 && w.mine === null, '가입 전 — 트리는 그리고 내 장식 없음');
    chk((await nb.m.myLetters()).code === 'auth' && (await nb.m.got()).code === 'auth', '  ↳ 편지 · 받은 편지는 auth(«로그인한 뒤»)');
    const h = await nb.m.hang({ kind: 'star' });
    chk(!h.ok && h.code === 'auth' && !nb.authed.log.some(x => x.method === 'PUT'), '  ↳ 장식 걸기는 보내지 않고 auth');
    const nt = await mk(LIB, { 'GET /v2/xmas/trees/current': apiErr(0, 'NO_TOKEN'), 'GET /v2/me/xmas': apiErr(0, 'NO_TOKEN') }).m.where();
    chk(!nt.ok && nt.code === 'auth', '로그인 없음(NO_TOKEN) — auth');
  }

  say('── 3절 장식 걸기');
  {
    let mine = null;
    const routes = base({ 'GET /v2/me/xmas': () => ME({ mine }),
      'PUT /v2/me/xmas/ornament': (b) => { mine = { tree: 1, slot: 0, kind: b.kind, version: (b.version || 0) + 1, word: b.word, imageId: b.image ? ID('b') : null }; return { tree: 1, slot: 0, version: mine.version, moved: true, changed: b.version != null, imageId: mine.imageId }; } });
    const { m, authed, owner } = mk(LIB, routes);
    await m.where();
    const r = await m.hang({ kind: 'star', word: '', preview: 1 });
    const put = authed.log.find(x => x.method === 'PUT');
    chk(JSON.stringify(put.body) === JSON.stringify({ kind: 'star', word: null, previewTree: 1, version: null }), '처음 걸기 — { kind, word:null, previewTree, version:null } · 그림 칸 없음 — ' + JSON.stringify(put.body));
    chk(put.opts.expectOwner === 'tokA', '  ↳ 읽은 토큰의 주인과 묶는다(expectOwner)');
    chk(r.ok && r.tree === 1 && r.slot === 0 && r.version === 1 && r.moved === true && r.changed === false && r.imageId === null, '응답 — 트리 · 자리 · 판 · 옮김 · 바꿈');
    const r2 = await m.hang({ kind: 'img', img: 'data:image/png;base64,AA', word: '안녕', preview: 1 });
    const put2 = authed.log.filter(x => x.method === 'PUT')[1];
    chk(put2.body.version === 1 && put2.body.image === 'data:image/png;base64,AA' && put2.body.word === '안녕' && r2.version === 2 && r2.imageId === ID('b'), '바꾸기 — 마지막 판(1)을 싣고 · 그림은 image 로 · 응답 그림 id');
    const nReads = authed.log.filter(x => x.path === '/v2/me/xmas').length;
    await m.hang({ kind: 'bulb' });
    chk(authed.log.filter(x => x.path === '/v2/me/xmas').length === nReads && authed.log.filter(x => x.method === 'PUT')[2].body.version === 2, '  ↳ 쓴 판을 기억해 다시 읽지 않는다');
    routes['PUT /v2/me/xmas/ornament'] = apiErr(409, 'CONCURRENT_UPDATE');
    const c = await m.hang({ kind: 'bulb' });
    chk(!c.ok && c.code === 'conflict' && authed.log.filter(x => x.method === 'PUT').length === 4, '409 CONCURRENT_UPDATE — 다시 보내지 않고 conflict');
    routes['PUT /v2/me/xmas/ornament'] = { tree: 1, slot: 0, version: 9, moved: false, changed: true, imageId: null };
    await m.hang({ kind: 'gift' });
    chk(authed.log.filter(x => x.path === '/v2/me/xmas').length === nReads + 1, '  ↳ 그 뒤 쓰기 전에 내 몫을 다시 읽어 판을 맞춘다');
    owner.who = 'tokB';
    const st = await m.hang({ kind: 'gift' });
    chk(!st.ok && st.code === 'auth', '읽은 뒤 로그인한 사람이 바뀌면(OWNER_CHANGED) 보내지 않고 auth');
    const fresh = mk(LIB, base({ 'PUT /v2/me/xmas/ornament': { tree: 1, slot: 2, version: 1, moved: false, changed: false, imageId: null } }));
    await fresh.m.hang({ kind: 'star' });
    chk(fresh.authed.log[0].path === '/v2/me/xmas' && fresh.authed.log[1].method === 'PUT', '판을 모르면(창을 안 열었으면) 내 몫을 먼저 읽는다');
    for (const [code, want] of [['XMAS_ENDED', 'failed-precondition'], ['XMAS_WORD_BANNED', 'invalid-argument'], ['TOO_MANY_REQUESTS', 'aborted'], ['STORAGE_UNAVAILABLE', 'aborted'], ['WHAT', 'call']]){
      const x = mk(LIB, base({ 'PUT /v2/me/xmas/ornament': apiErr(code === 'TOO_MANY_REQUESTS' ? 429 : 400, code, '서버 문구') }));
      const rr = await x.m.hang({ kind: 'star' });
      chk(!rr.ok && rr.code === want && rr.msg === '서버 문구', '실패 ' + code + ' → ' + want + ' · 서버 문구 그대로');
    }
  }

  say('── 4절 편지');
  {
    let letters = { l1: { text: '하나', song: null, version: 3, updatedAt: 'x' } };
    const routes = base({ 'GET /v2/me/xmas': () => ME({ letters, returned: { l2: { reason: 'spam', note: null, text: '광고', song: null, returnedAt: 'x' } }, received: { 1: { text: '고마워', song: null, at: 'x' } } }),
      'PUT /v2/me/xmas/letters/l1': (b) => ({ lid: 'l1', version: b.version + 1 }), 'PUT /v2/me/xmas/letters/l2': () => ({ lid: 'l2', version: 1 }),
      'DELETE /v2/me/xmas/letters/l1': null, 'DELETE /v2/me/xmas/returned/l2': null });
    const { m, authed } = mk(LIB, routes);
    const my = await m.myLetters();
    chk(my.ok && my.letters.l1.version === 3 && my.returned.l2.reason === 'spam', '내 편지함 · 반송 — 서버 맵 그대로(rules 가 다듬는다)');
    const s1 = await m.saveLetter('l1', '고침', { id: 'abcdefghijk', title: '캐럴' }, null);
    const p1 = authed.log.find(x => x.path === '/v2/me/xmas/letters/l1' && x.method === 'PUT');
    chk(JSON.stringify(p1.body) === JSON.stringify({ text: '고침', song: { id: 'abcdefghijk', title: '캐럴' }, version: 3, fromReturned: null }) && s1.ok && s1.version === 4, '고치기 — 그 칸의 판(3) · 곡 { id, title } · fromReturned:null');
    await m.saveLetter('l2', '다시 씀', { id: 'abcdefghijk', title: '' }, 'l2');
    const p2 = authed.log.find(x => x.path === '/v2/me/xmas/letters/l2');
    chk(p2.body.version === null && p2.body.fromReturned === 'l2' && JSON.stringify(p2.body.song) === '{"id":"abcdefghijk"}', '새 칸 — version:null · 반송을 다시 쓰면 fromReturned · 제목 없는 곡은 id 만');
    await m.saveLetter('l1', '또', null, null);
    chk(authed.log.filter(x => x.path === '/v2/me/xmas/letters/l1' && x.method === 'PUT')[1].body.version === 4 && authed.log.filter(x => x.path === '/v2/me/xmas/letters/l1').slice(-1)[0].body.song === null, '  ↳ 쓴 판(4)을 기억 · 곡 없으면 null');
    await m.removeLetter('l1');
    const del = authed.log.find(x => x.method === 'DELETE' && /letters/.test(x.path));
    chk(del.path === '/v2/me/xmas/letters/l1?version=5' && del.opts.expectOwner === 'tokA', '거두기 — ?version=(마지막 판) · 주인 묶음');
    const n0 = authed.log.length;
    const r5 = await m.removeLetter('l5');
    chk(r5.ok && authed.log.length === n0, '모르는 칸 거두기는 요청 0(없는 칸 — 이미 비었다)');
    await m.clearReturned('l2');
    chk(authed.log.slice(-1)[0].method === 'DELETE' && authed.log.slice(-1)[0].path === '/v2/me/xmas/returned/l2', '반송 표시 지우기 — DELETE returned/{lid}');
    const g = await m.got();
    chk(g.ok && g.got[1].text === '고마워' && g.matched === false, '받은 편지 · 짝 지었나(matched)');
    for (const [code, want] of [['XMAS_LETTER_CLOSED', 'closed'], ['XMAS_LETTER_INVALID', 'write'], ['CONCURRENT_UPDATE', 'conflict']]){
      const x = mk(LIB, base({ 'PUT /v2/me/xmas/letters/l1': apiErr(409, code) }));
      chk((await x.m.saveLetter('l1', 'x', null, null)).code === want, '맡기기 실패 ' + code + ' → ' + want);
    }
  }

  say('── 5절 신고');
  {
    const { m, authed, owner } = mk(LIB, base({ 'POST /v2/xmas/reports': null, 'DELETE /v2/me/xmas/returned/l2': null }));
    const posts = () => authed.log.filter(x => x.method === 'POST');
    const r = await m.reportOrnament(2, 7, '  ' + '가'.repeat(60) + ' ');
    chk(r.ok && JSON.stringify(posts()[0].body.target) === '{"type":"ornament","tree":2,"slot":7}' && posts()[0].body.note.length === 40, '장식 신고 — 대상 { ornament, tree, slot } · 메모 40자');
    await m.reportLetter(2);
    chk(JSON.stringify(posts()[1].body) === '{"target":{"type":"received","n":2}}', '받은 편지 신고 — { received, n } · 메모 없으면 칸 없음(받는 사람은 서버가 토큰으로)');
    chk(posts().every(x => x.opts.expectOwner === 'tokA') && authed.log[0].path === '/v2/me/xmas', '  ↳ 신고는 읽은 토큰의 주인과 묶는다(판을 모르면 내 몫을 먼저 읽어 주인을 안다)');
    chk(!authed.log.some(x => /ME01/.test(JSON.stringify(x.body) + x.path)), '  ↳ 사람 코드를 싣지 않는다');
    await m.clearReturned('l2');
    chk(authed.log.slice(-1)[0].opts.expectOwner === 'tokA', '반송 표시 지우기도 주인과 묶는다');
    for (const [lab, act] of [['신고', (x) => x.reportLetter(1)], ['반송 표시 지우기', (x) => x.clearReturned('l2')]]){
      const t = mk(LIB, base({ 'POST /v2/xmas/reports': null, 'DELETE /v2/me/xmas/returned/l2': null }));
      await t.m.myLetters(); t.owner.who = 'tokB';
      const rr = await act(t.m);
      chk(!rr.ok && rr.code === 'auth', '★ A 로 읽은 뒤 로그인한 사람이 바뀌면(B 토큰) ' + lab + '를 보내지 않는다 — auth(OWNER_CHANGED)');
    }
    chk((await mk(LIB, base({ 'POST /v2/xmas/reports': apiErr(409, 'XMAS_REPORT_DUPLICATE') })).m.reportOrnament(1, 1)).code === 'dup', '두 번째 신고 — dup');
    chk((await mk(LIB, base({ 'POST /v2/xmas/reports': apiErr(400, 'XMAS_REPORT_SELF') })).m.reportOrnament(1, 1)).code === 'invalid-argument', '내 장식 신고(서버가 막음) — invalid-argument');
  }

  say('── 5-1절 신고 실패 갈래 — 대상 없음만 gone · 나머지는 오류 번호 쪽');
  {
    const cases = [['XMAS_ORNAMENT_NOT_FOUND', 404, 'gone'], ['XMAS_RECEIVED_NOT_FOUND', 404, 'gone'], ['DB_BUSY', 503, 'aborted'], ['NETWORK', 0, 'report'], ['INTERNAL_ERROR', 500, 'report'], ['SHAPE', 200, 'report']];
    for (const [code, st, want] of cases){
      const x = mk(LIB, base({ 'POST /v2/xmas/reports': apiErr(st, code) }));
      const r = await x.m.reportOrnament(1, 1);
      chk(!r.ok && r.code === want, '신고 실패 ' + code + '(' + st + ') → ' + want + (want === 'gone' ? '(«이미 없는 …» 안내)' : '(화면은 오류 번호)'));
    }
  }

  say('── 5-2절 세션 reset · 날짜 한 번 읽기');
  {
    const { m, authed } = mk(LIB, base());
    await m.where();
    chk(m.schedule() !== null, '읽은 뒤 날짜 한 벌이 있다');
    m.reset();
    chk(m.schedule() === null, 'reset — 날짜 한 벌을 버린다(다음 계정은 다시 읽는다)');
    const n0 = authed.log.length;
    const pr = mk(LIB, base({ 'PUT /v2/me/xmas/ornament': { tree: 1, slot: 0, version: 1, moved: false, changed: false, imageId: null } }));
    await pr.m.where(); pr.m.reset(); await pr.m.hang({ kind: 'star' });
    chk(pr.authed.log.filter(x => x.path === '/v2/me/xmas').length === 2, 'reset — 판 기억도 버린다(다음 쓰기 전에 내 몫을 다시 읽는다)');
    const rs = await m.refreshSchedule();
    chk(rs.ok && m.schedule() && authed.log.slice(n0).map(x => x.path).join() === '/v2/xmas/trees/current', 'refreshSchedule — trees/current 한 번만(내 몫은 읽지 않는다)');
    const bad = await mk(LIB, { 'GET /v2/xmas/trees/current': apiErr(503, 'DB_BUSY') }).m.refreshSchedule();
    chk(!bad.ok, '  ↳ 실패는 { ok:false } (날짜는 처음 값 그대로)');
    const lateCase = async (src) => {
      let relMe, relCur;
      const holdMe = new Promise((r) => { relMe = r; }), holdCur = new Promise((r) => { relCur = r; });
      const t = mk(src, { 'GET /v2/xmas/trees/current': () => holdCur.then(() => CUR), 'GET /v2/me/xmas': () => holdMe.then(() => ME({ mine: { tree: 1, slot: 0, kind: 'star', version: 3 } })),
        'PUT /v2/me/xmas/ornament': { tree: 1, slot: 0, version: 1, moved: false, changed: false, imageId: null } });
      const p = t.m.where();
      t.m.reset(); t.owner.who = 'tokB';   // A 로 읽는 사이 세션이 끝나고 B 로
      relMe(); relCur(); const w = await p;
      const schedNull = t.m.schedule() === null;
      const nGet = t.authed.log.filter(x => x.path === '/v2/me/xmas').length;
      const h = await t.m.hang({ kind: 'star' });
      return { stale: !w.ok && w.code === 'stale', schedNull, reread: t.authed.log.filter(x => x.path === '/v2/me/xmas').length === nGet + 1, hangOk: h.ok, put: t.authed.log.find(x => x.method === 'PUT') };
    };
    const lc = await lateCase(LIB);
    chk(lc.stale && lc.schedNull, '★ A 읽기가 걸린 사이 reset → A 답이 와도 판 기억 · 날짜를 채우지 않는다(stale)');
    chk(lc.reread && lc.hangOk && lc.put && lc.put.opts.expectOwner === 'tokB' && lc.put.body.version === 3, '  ↳ B 의 첫 쓰기는 B 로 내 몫을 다시 읽고 B 토큰으로 보낸다(OWNER_CHANGED 로 실패하지 않음)');
    const noGen = S.API.split('    if (g !== gen) throw stale();\n').join('');
    if (noGen !== S.API){ const lb = await lateCase(noGen); chk(!(lb.stale && lb.schedNull), 'mutation test — 늦은 답의 세션을 안 보면 위 검사가 빨강'); }
  }

  say('── 6절 오류 표');
  {
    const T = load(LIB, 'TwXmasApi').ERROR_CODES;
    const WANT = { XMAS_ENDED: 'failed-precondition', XMAS_KIND_INVALID: 'invalid-argument', XMAS_IMAGE_TOO_LARGE: 'invalid-argument', XMAS_IMAGE_INVALID: 'invalid-argument',
      XMAS_WORD_TOO_LONG: 'invalid-argument', XMAS_WORD_BANNED: 'invalid-argument', XMAS_TREE_FORBIDDEN: 'read', XMAS_TREE_NOT_FOUND: 'read', XMAS_LETTER_CLOSED: 'closed',
      XMAS_LETTER_INVALID: 'write', XMAS_REPORT_DUPLICATE: 'dup', XMAS_REPORT_SELF: 'invalid-argument', XMAS_ORNAMENT_NOT_FOUND: 'gone', XMAS_RECEIVED_NOT_FOUND: 'gone',
      XMAS_LETTER_NOT_FOUND: 'write', CONCURRENT_UPDATE: 'conflict', USER_CODE_NOT_BOUND: 'auth', AUTH_REQUIRED: 'auth', TOO_MANY_REQUESTS: 'aborted', DB_BUSY: 'aborted', STORAGE_UNAVAILABLE: 'aborted' };
    const miss = Object.keys(WANT).filter(k => T[k] !== WANT[k]);
    chk(!miss.length, '설계 6-4 표 ' + Object.keys(WANT).length + '개가 같은 code — 다른 것: ' + (miss.join(' · ') || '없음'));
    chk(!('XMAS_BUSY' in T) && !('XMAS_LETTER_CHANGED' in T), '없앤 이름(XMAS_BUSY · XMAS_LETTER_CHANGED)은 없다');
  }

  say('── 7절 그림');
  {
    const { m, fetches } = mk(LIB, base());
    const r = await m.img(ID('c'));
    chk(fetches[0].url === 'https://firebasestorage.googleapis.com/v0/b/together-working-dev.firebasestorage.app/o/xmas%2F' + ID('c') + '.png?alt=media' && fetches[0].init.credentials === 'omit', 'Storage 주소 — 이 앱 버킷 · xmas%2F{id}.png · alt=media(토큰 없음)');
    chk(r.ok && r.d === 'data:image/png;base64,iVBORw==', '바이트 → PNG data URL(IndexedDB 사본 · 트리 텍스처가 쓰는 모양)');
    const bad = await m.img('../../users/x');
    chk(!bad.ok && fetches.length === 1, '틀린 id 는 받지 않는다(요청 0)');
    const big = await mk(LIB, base(), { res: () => ({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array(16 * 1024 + 1).buffer }) }).m.img(ID('d'));
    chk(!big.ok, '16KB 넘는 응답은 그림으로 쓰지 않는다');
    const nf = await mk(LIB, base(), { res: () => ({ ok: false, status: 404 }) }).m.img(ID('e'));
    chk(!nf.ok && nf.code === 'read', '없는 그림(404) — { ok:false, read }');
    const bb = await mk(LIB, base(), { bucket: 'a/b' }).m.img(ID('f'));
    chk(!bb.ok, '버킷 이름이 틀리면 주소를 만들지 않는다');
  }
}

function wiring(S){
  say('── 8절 배선');
  const A = strip(S.APP);
  chk(/const xmasApiMod = TwXmasApi\.createXmasApi\(\{ authed: TwApi\.authed, rules: TwXmasRules,/.test(A) && /net: \(\)=>xmasApiMod/.test(A), 'app.js — 로그인 통로(TwApi.authed)로 만들어 크리스마스 창의 net 으로');
  chk(!/noServer\('xmas'\)/.test(A), '  ↳ 서버 경로 없음 자리(noServer)는 없다');
  const h = S.HTML;
  const at = (n) => h.indexOf('src="parts/xmas/' + n);
  chk(at('xmas-rules.js') > 0 && at('xmas-rules.js') < at('xmas-api.js') && at('xmas-api.js') < at('xmas-window.js') && at('xmas-window.js') < h.indexOf('src="parts/app.js'), 'html — rules → api → window → app.js 차례');
  chk(at('xmas-net.js') < 0 && !/TwXmasNet/.test(S.FI) && !/TwXmasNet/.test(A), '옛 Firebase 통로(xmas-net · TwXmasNet)는 없다');
  const sm = S.SMOKE;
  chk(sm.indexOf("PRELOAD.push('xmas-rules.js')") > 0 && sm.indexOf("PRELOAD.push('xmas-rules.js')") < sm.indexOf("PRELOAD.push('xmas-api.js')"), 'smoke PRELOAD 에 xmas-rules.js → xmas-api.js');
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  wiring(S);
  say('── 9절 mutation test');
  const breaks = [
    ['신고가 주인을 안 묶음', S.API.replace("{ target }, { expectOwner: k.owner })", "{ target }, {})"), '5절 바뀐 토큰'],
    ['reset 이 판을 안 버림', S.API.replace("function reset(){ gen++; known = null; sched = null; }", "function reset(){ gen++; sched = null; }"), '5-2절 판 기억'],
    ['판을 안 실음', S.API.replace('version: k.mine };', 'version: null };'), '3절 바꾸기 판'],
    ['409 뒤 판을 안 버림', S.API.replace("e.code === 'CONCURRENT_UPDATE')) known = null;", "false)) known = null;"), '3절 다시 읽기'],
    ['주인을 안 묶음', S.API.replace("authed.put(PATHS.ornament, body, { expectOwner: k.owner })", "authed.put(PATHS.ornament, body, {})"), '3절 OWNER_CHANGED'],
    ['fromReturned 를 안 실음', S.API.replace('fromReturned: fromReturned || null', 'fromReturned: null'), '4절 반송 다시 쓰기'],
    ['가입 전을 실패로', S.API.replace("if (e && e.code === NOT_BOUND){ known = null; return null; } ", ''), '2절 트리는 그림'],
    ['틀린 그림 id 를 받음', S.API.replace('const IMAGE_ID_RE = /^[0-9a-f]{32}$/;', 'const IMAGE_ID_RE = /./;'), '7절 틀린 id'],
    ['날짜를 안 남김', S.API.replace('if (s) sched = s;', ''), '1절 날짜 한 벌'],
    ['scheduleNow 가 늘 처음 값', S.API.replace('scheduleNow: () => sched || rules.SCHEDULE', 'scheduleNow: () => rules.SCHEDULE'), '1절 scheduleNow 서버 값'],
    ['conflict 를 write 로', S.API.replace("CONCURRENT_UPDATE: 'conflict',", "CONCURRENT_UPDATE: 'write',"), '6절 표'],
  ];
  for (const [name, src, what] of breaks){
    if (src === S.API){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try { await judge(Object.assign({}, S, { API: src })); } catch (_) { qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say(`\n${fail ? '✗' : '✓'} ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
runAll().catch((e) => { console.error(e); process.exit(1); });
