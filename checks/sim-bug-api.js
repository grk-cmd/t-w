/* ═══ 🐞 sim-bug-api.js — 버그제보 게시판 provider (0.13 앱 묶음 D9-3) ═══
   [왜] 버그제보 탭이 Firebase 대신 서버 공개 API(/v1/bugs* · /v1/me/bugs*)를 쓴다. 서버 모양(대문자 이름 · ISO 시각 · author)을
     화면 모양(소문자 열쇠 · ms · anon)으로 맞추는 곳 · 본문을 만드는 곳 · 실패 갈래를 정하는 곳이 provider 하나라 실제로 불러서 판정한다.
   ・1절: 목록 — 경로(filter · limit · cursor) · 줄 맞춤(공개 범위 · 분류 · 상태 · 내 글 · 안 본 답변 · 익명 · 글쓴이 답글) · 빈 목록 ≠ 못 읽음 · 모양 틀림 던짐 · 공지
   ・2절: 글 — 댓글 차례 · 글쓴이 답글의 공개 범위 · 판(version) · 모양 틀림 던짐
   ・3절: 쓰기 — 새 글 본문(내 이름 · 코드 없음 · 공지는 켤 때만) · 요청 번호(닿지 못함 → 같은 번호 · 서버 답 → 새 번호) · 답글 · 공개 범위 · 👍(응답 수 · 모양 틀림 던짐) · 봤음 · 남은 수
   ・4절: 배지 수 — 받으면 기억 · reset 뒤 null · reset 전에 보낸 받기의 늦은 답은 버림
   ・4-2절: 관리자 — 답변(본 시각 · 요청 번호 · 입력 거름) · 오픈카톡 기본 링크 받기 · 저장(판 · 안내 글 그대로)
   ・5절: 오류 갈래(failOf — 진짜 api-errors.js 의 translate 로)
   ・6절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['bug-api.js', 'parts/support/bug-api.js', 'app/parts/support/bug-api.js', 'apps/desktop/app/parts/support/bug-api.js']),
  AE: pick(['api-errors.js', 'parts/shared/api-errors.js', 'app/parts/shared/api-errors.js', 'apps/desktop/app/parts/shared/api-errors.js']),
  RID: pick(['request-id.js', 'parts/shared/request-id.js', 'app/parts/shared/request-id.js', 'apps/desktop/app/parts/shared/request-id.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src) => { const mod = { exports: {} }; new Function('module', 'window', src)(mod, undefined); return mod.exports; };
const ERRS = loadMod(SRC0.AE);
const RID = loadMod(SRC0.RID);

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const offline = () => Object.assign(new Error('닿지 못함'), { status: 0, code: '', kind: 'unavailable' });
const author = (o) => Object.assign({ userCode: 'U1', name: '에이', anonymous: false }, o || {});
const summary = (n, o) => Object.assign({ number: n, visibility: 'PUBLIC', category: 'BUG', title: '제목' + n, status: 'NEW', notice: false, byAdmin: false,
  author: author(), mine: false, likeCount: 2, answerCount: 1, createdAt: '2026-11-10T01:02:03Z', lastAnswerAt: null, lastAuthorReplyAt: null, unseen: false }, o || {});
const detailRes = (o) => Object.assign({ number: 'B-1110-1', visibility: 'PUBLIC', category: 'UI', title: '제목', body: '본문', env: 'v0.13 · Windows', status: 'CHECKING',
  notice: false, byAdmin: false, author: author(), mine: true, canReply: true, likeCount: 3, liked: false, doneAt: null,
  lastAnswerAt: '2026-11-10T02:00:00Z', lastAuthorReplyAt: null, createdAt: '2026-11-10T01:00:00Z', version: 4, comments: [] }, o || {});

/* 가짜 authed — 부른 것을 적고, 길마다 정한 답을 낸다(함수면 불러서 · Error 면 던짐 · Promise 면 그대로) */
function fake(routes){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    const key = method + ' ' + path.split('?')[0];
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path, opts) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), put: (p, b, o) => run('PUT', p, b, o),
    patch: (p, b, o) => run('PATCH', p, b, o) };
}
const mk = (src, routes) => {
  const authed = fake(routes || {});
  let n = 0;
  const m = loadMod(src).createBugApi({ authed, errs: ERRS, pending: () => RID.createPending({ newId: () => 'req-id-' + (++n) + '-xxxx' }) });
  return { m, authed };
};
const throws = async (fn) => { try{ await fn(); return null; }catch(e){ return e || {}; } };

async function judge(S){
  const lib = loadMod(S.API);
  say('── 1. 목록');
  {
    const { m, authed } = mk(S.API, { 'GET /v1/bugs': (b, path) => /filter=notices/.test(path)
      ? { items: [summary('B-1101-1', { notice: true, byAdmin: true })], nextCursor: null }
      : { items: [
        summary('B-1110-2', { mine: true, unseen: true, visibility: 'PRIVATE', author: author({ anonymous: true, name: '익명', userCode: null }), category: 'SUGGEST', status: 'REVIEW',
          lastAnswerAt: '2026-11-10T03:00:00Z', lastAuthorReplyAt: '2026-11-10T04:00:00Z' }),
        summary('B-1110-1'),
      ], nextCursor: 'CUR/1' } });
    const r = await m.list('all', null, 8);
    chk(authed.log[0].method === 'GET' && authed.log[0].path === '/v1/bugs?filter=all&limit=8' && authed.log[0].opts && authed.log[0].opts.auth === true,
      '첫 쪽 — GET /v1/bugs?filter=all&limit=8 (로그인 통로 · 커서 없음)');
    const a = r.items[0], b = r.items[1];
    chk(a.number === 'B-1110-2' && a.vis === 'prv' && a.cat === 'suggest' && a.status === 'review' && a.mine === true && a.unseen === true && a.anon === true,
      '줄 맞춤 — PRIVATE → prv · SUGGEST → suggest · REVIEW → review · 내 글 · 안 본 답변 · 익명');
    chk(a.authorReplied === true && b.authorReplied === false && b.answeredAt === 0 && a.answeredAt === Date.parse('2026-11-10T03:00:00Z'),
      '  글쓴이 답글이 운영자 마지막 답변보다 뒤면 authorReplied · 답변 없음은 answeredAt 0');
    chk(b.vis === 'pub' && b.cat === 'bug' && b.status === 'new' && b.mine === false && b.likeN === 2 && b.ansN === 1 && b.name === '에이' && b.createdAt === Date.parse('2026-11-10T01:02:03Z'),
      '  공개 글 — 이름 · 👍 수 · 답변 수 · 시각(ms)');
    chk(r.next === 'CUR/1', '  다음 쪽 커서는 서버 것 그대로');
    await m.list('mine', 'CUR/1', 8);
    chk(authed.log[1].path === '/v1/bugs?filter=mine&limit=8&cursor=CUR%2F1', '다음 쪽 — cursor 를 붙이고 인코딩한다');
    const notes = await m.notices();
    chk(authed.log[2].path === '/v1/bugs?filter=notices' && notes.length === 1 && notes[0].notice === true && notes[0].byAdmin === true, '공지 — filter=notices 한 번 · 공지 줄');
    const bad = await throws(() => m.list('zzz', null, 8));
    chk(!!bad && bad.code === 'INVALID' && authed.log.length === 3, '모르는 필터는 요청 없이 던진다');
  }
  {
    const { m } = mk(S.API, { 'GET /v1/bugs': { items: [], nextCursor: null } });
    const r = await m.list('open', null, 8);
    chk(Array.isArray(r.items) && r.items.length === 0 && r.next === null, '빈 목록 → { items: [], next: null }');
    const down = mk(S.API, { 'GET /v1/bugs': offline() });
    const e = await throws(() => down.m.list('all', null, 8));
    chk(!!e && e.kind === 'unavailable', '못 받음 → 던진다(빈 목록으로 돌리지 않는다 — 실패 ≠ 없음)');
    const shape = mk(S.API, { 'GET /v1/bugs': { nope: 1 } });
    const e2 = await throws(() => shape.m.list('all', null, 8));
    const row = mk(S.API, { 'GET /v1/bugs': { items: [{ number: 'B-1', visibility: 'SECRET', author: author() }], nextCursor: null } });
    const e3 = await throws(() => row.m.list('all', null, 8));
    chk(!!e2 && e2.code === 'SHAPE' && !!e3 && e3.code === 'SHAPE', '모양이 틀리면(items 없음 · 모르는 공개 범위) SHAPE 로 던진다');
  }

  say('── 2. 글');
  {
    const { m, authed } = mk(S.API, { 'GET /v1/bugs/B-1110-1': detailRes({ visibility: 'PRIVATE', comments: [
      { id: 'c2', kind: 'AUTHOR_REPLY', text: '아직이요', kakaoLink: null, visibility: null, statusAfter: 'UNFIXED', createdAt: '2026-11-10T05:00:00Z', updatedAt: '2026-11-10T05:00:00Z' },
      { id: 'c1', kind: 'ADMIN_ANSWER', text: '확인할게요', kakaoLink: 'https://open.kakao.com/o/abc', visibility: 'PRIVATE', statusAfter: 'CHECKING', createdAt: '2026-11-10T02:00:00Z', updatedAt: '2026-11-10T02:00:00Z' },
    ] }) });
    const p = await m.detail('B-1110-1');
    chk(authed.log[0].path === '/v1/bugs/B-1110-1' && p.number === 'B-1110-1' && p.vis === 'prv' && p.cat === 'ui' && p.status === 'checking' && p.version === 4,
      'GET /v1/bugs/{number} → 글(공개 범위 · 분류 · 상태 · 판)');
    chk(p.body === '본문' && p.env === 'v0.13 · Windows' && p.canReply === true && p.mine === true && p.likeN === 3 && p.liked === false && p.answeredAt === Date.parse('2026-11-10T02:00:00Z'),
      '  본문 · 환경 · 답글 칸 · 내 글 · 👍 · 마지막 답변 시각');
    chk(p.comments.map(c => c.id).join() === 'c1,c2' && p.comments[0].byAuthor === false && p.comments[0].kakao === 'https://open.kakao.com/o/abc' && p.comments[0].vis === 'prv',
      '  댓글은 시간순 · 운영자 답변의 오픈카톡 · 공개 범위');
    chk(p.comments[1].byAuthor === true && p.comments[1].vis === 'prv' && p.comments[1].st === 'unfixed', '  글쓴이 답글 — 공개 범위는 글을 따른다 · 고른 상태(소문자)');
    const nov = mk(S.API, { 'GET /v1/bugs/B-1': detailRes({ number: 'B-1', version: undefined }) });
    const e = await throws(() => nov.m.detail('B-1'));
    const nk = mk(S.API, { 'GET /v1/bugs/B-1': detailRes({ number: 'B-1', comments: [{ id: 'x', kind: 'WHAT' }] }) });
    const e2 = await throws(() => nk.m.detail('B-1'));
    chk(!!e && e.code === 'SHAPE' && !!e2 && e2.code === 'SHAPE', '판이 없거나 모르는 댓글 종류면 SHAPE 로 던진다');
  }

  say('── 3. 쓰기');
  {
    let mode = 'ok';
    const { m, authed } = mk(S.API, {
      'POST /v1/bugs': () => mode === 'off' ? offline() : mode === 'limit' ? apiErr(429, 'BUG_DAILY_LIMIT') : { number: 'B-1113-3' },
    });
    const r = await m.write({ vis: 'prv', cat: 'myhome', title: '  제목 ', body: ' 본문  ', env: 'v1 · macOS' });
    const b = authed.log[0].body;
    chk(r.number === 'B-1113-3' && authed.log[0].path === '/v1/bugs', 'POST /v1/bugs → { number }');
    chk(b.visibility === 'PRIVATE' && b.category === 'MYHOME' && b.title === '제목' && b.body === '본문' && b.env === 'v1 · macOS' && !('notice' in b),
      '  본문 — 서버 이름(PRIVATE · MYHOME) · 앞뒤 공백 걷음 · 공지는 켤 때만');
    chk(['name', 'code', 'authUid', 'nick', 'userCode'].every(k => !(k in b)) && Object.keys(b).sort().join() === 'body,category,env,requestId,title,visibility',
      '  내 이름 · 코드 · uid 를 싣지 않는다(글쓴이는 서버가 토큰에서 정한다)');
    await m.write({ vis: 'pub', cat: 'etc', title: 't', body: 'b', notice: true });
    chk(authed.log[1].body.notice === true && !('env' in authed.log[1].body), '공지 글은 notice: true 를 싣는다 · 환경이 없으면 env 칸 없음');
    const id1 = authed.log[0].body.requestId, id2 = authed.log[1].body.requestId;
    mode = 'off';
    await throws(() => m.write({ vis: 'pub', cat: 'bug', title: 't', body: 'b' }));
    await throws(() => m.write({ vis: 'pub', cat: 'bug', title: 't', body: 'b' }));
    const id3 = authed.log[2].body.requestId, id4 = authed.log[3].body.requestId;
    mode = 'limit';
    await throws(() => m.write({ vis: 'pub', cat: 'bug', title: 't', body: 'b' }));
    await throws(() => m.write({ vis: 'pub', cat: 'bug', title: 't', body: 'b' }));
    const id5 = authed.log[4].body.requestId, id6 = authed.log[5].body.requestId;
    chk(id1 !== id2 && id3 === id4 && id5 === id3 && id6 !== id5 && [id1, id2, id3, id6].every(x => /^[A-Za-z0-9_-]{8,64}$/.test(x)),
      '요청 번호 — 성공 뒤 새 번호 · 닿지 못하면 같은 번호(두 번 안 올라감) · 서버가 거절하면 그다음은 새 번호');
    const bad = await throws(() => m.write({ vis: 'secret', cat: 'bug', title: 't', body: 'b' }));
    chk(!!bad && bad.code === 'INVALID' && authed.log.length === 6, '모르는 공개 범위는 요청 없이 던진다');
  }
  {
    const { m, authed } = mk(S.API, {
      'POST /v1/bugs/B-1/replies': null, 'PATCH /v1/bugs/B-1/visibility': { visibility: 'PRIVATE', version: 5 },
      'PUT /v1/bugs/B-1/like': { likeCount: 7, liked: true }, 'PUT /v1/me/bugs/B-1/seen': null, 'GET /v1/me/bugs/quota': { dailyMax: 5, usedToday: 2 },
    });
    await m.reply('B-1', { text: ' 더 알려요 ', status: 'unfixed' });
    const rb = authed.log[0].body;
    chk(authed.log[0].path === '/v1/bugs/B-1/replies' && rb.text === '더 알려요' && rb.status === 'UNFIXED' && /^req-id-/.test(rb.requestId) && Object.keys(rb).length === 3,
      '답글 — { requestId, text, status(대문자) } 만');
    const noSt = await throws(() => m.reply('B-1', { text: 'x', status: '' }));
    chk(!!noSt && noSt.code === 'INVALID' && authed.log.length === 1, '  상태가 없으면 요청 없이 던진다(서버가 상태를 꼭 받는다)');
    const v = await m.setVis('B-1', 4, 'prv');
    chk(authed.log[1].method === 'PATCH' && JSON.stringify(authed.log[1].body) === '{"version":4,"visibility":"PRIVATE"}' && v.vis === 'prv' && v.version === 5,
      '공개 범위 — PATCH /v1/bugs/{number}/visibility { version, visibility } → { vis, version }');
    const lk = await m.like('B-1'); await m.seen('B-1');
    chk(authed.log[2].method === 'PUT' && authed.log[2].path === '/v1/bugs/B-1/like' && authed.log[3].method === 'PUT' && authed.log[3].path === '/v1/me/bugs/B-1/seen',
      '👍 PUT /v1/bugs/{number}/like · 봤음 PUT /v1/me/bugs/{number}/seen');
    chk(!!lk && lk.likeN === 7 && lk.liked === true && Object.keys(lk).length === 2,
      '  👍 응답 수로 그린다 — { likeCount, liked } → { likeN, liked }(본 수 + 1 이 아니라 서버의 수)');
    const zero = mk(S.API, { 'PUT /v1/bugs/B-2/like': { likeCount: 0, liked: false } });
    const z = await zero.m.like('B-2');
    chk(z.likeN === 0 && z.liked === false, '  경계 — 수 0 · liked false 도 그대로 받는다');
    for(const [why, d] of [['응답 없음', null], ['수가 글자', { likeCount: '3', liked: true }], ['음수', { likeCount: -1, liked: true }],
      ['소수', { likeCount: 1.5, liked: true }], ['liked 없음', { likeCount: 3 }]]){
      const bad = mk(S.API, { 'PUT /v1/bugs/B-3/like': d });
      const e = await throws(() => bad.m.like('B-3'));
      chk(!!e && e.code === 'SHAPE', '  👍 응답 모양이 틀리면 던진다 — ' + why);
    }
    const q = await m.quota();
    chk(q.dailyMax === 5 && q.usedToday === 2, '남은 수 — GET /v1/me/bugs/quota → { dailyMax, usedToday }');
    const adm = mk(S.API, { 'GET /v1/me/bugs/quota': { dailyMax: null, usedToday: 9 } });
    chk((await adm.m.quota()).dailyMax === null, '  관리자는 dailyMax null(상한 없음)');
  }

  say('── 4. 배지 수');
  {
    let hold = null, val = 3;
    const { m } = mk(S.API, { 'GET /v1/me/bugs/unseen-count': () => hold ? hold.p : val });
    chk(m.badgeCount() === null, '받기 전엔 null(모름)');
    chk(await m.refreshBadge() === 3 && m.badgeCount() === 3, '받으면 기억한다');
    m.reset();
    chk(m.badgeCount() === null, 'reset → null');
    let res; hold = { p: new Promise(r => { res = r; }) };
    const late = m.refreshBadge();
    m.reset();
    res(7); await late;
    chk(m.badgeCount() === null, 'reset 전에 보낸 받기가 늦게 와도 새 계정 수를 덮지 않는다');
    hold = null; val = 'x';
    const e = await throws(() => m.refreshBadge());
    chk(!!e && e.code === 'SHAPE' && m.badgeCount() === null, '수가 아니면 던지고 기억은 그대로');
  }

  say('── 4-2. 관리자 — 답변 · 오픈카톡 기본 링크');
  {
    const { m, authed } = mk(S.API, { 'POST /v1/admin/bugs/B-1/answers': null });
    const lastIso = '2026-11-10T02:00:00Z';
    await m.answer('B-1', { seenLastAnswerAt: lastIso, text: ' 확인했어요 ', status: 'fixed', vis: 'prv', kakaoLink: ' https://open.kakao.com/o/abc ' });
    const b = authed.log[0].body;
    chk(authed.log[0].method === 'POST' && authed.log[0].path === '/v1/admin/bugs/B-1/answers' && b.text === '확인했어요' && b.status === 'FIXED' && b.visibility === 'PRIVATE'
      && b.seenLastAnswerAt === lastIso && b.kakaoLink === 'https://open.kakao.com/o/abc' && /^req-id-/.test(b.requestId) && Object.keys(b).length === 6,
      '답변 — POST /v1/admin/bugs/{number}/answers { requestId, seenLastAnswerAt(받은 글자 그대로), text, status, visibility, kakaoLink }');
    await m.answer('B-1', { seenLastAnswerAt: null, text: 'x', status: 'checking', vis: 'pub' });
    const b2 = authed.log[1].body;
    chk(b2.seenLastAnswerAt === null && !('kakaoLink' in b2) && !('name' in b2) && !('code' in b2) && !('authUid' in b2), '  답변이 아직 없던 글 — seenLastAnswerAt null · 링크 없으면 칸을 싣지 않는다 · 내 이름 · 코드 없음');
    for(const [why, a] of [['빈 글', { seenLastAnswerAt: null, text: '  ', status: 'new', vis: 'pub' }], ['상태 없음', { seenLastAnswerAt: null, text: 'x', status: '', vis: 'pub' }],
      ['모르는 공개 범위', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'secret' }], ['남의 사이트 링크', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'pub', kakaoLink: 'https://evil.example/' }],
      ['주소만 있는 링크', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'pub', kakaoLink: 'https://open.kakao.com/' }], ['빈 글자 시각', { seenLastAnswerAt: '', text: 'x', status: 'new', vis: 'pub' }]]){
      const n0 = authed.log.length, e = await throws(() => m.answer('B-1', a));
      chk(!!e && e.code === 'INVALID' && authed.log.length === n0, '  ' + why + ' — 요청 없이 던진다');
    }
    const lost = mk(S.API, { 'POST /v1/admin/bugs/B-2/answers': () => offline() });
    await throws(() => lost.m.answer('B-2', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'pub' }));
    await throws(() => lost.m.answer('B-2', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'pub' }));
    chk(lost.authed.log[0].body.requestId === lost.authed.log[1].body.requestId, '  닿지 못해 다시 누르면 같은 요청 번호');
    const conf = mk(S.API, { 'POST /v1/admin/bugs/B-3/answers': () => apiErr(409, 'BUG_ANSWER_CONFLICT') });
    await throws(() => conf.m.answer('B-3', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'pub' }));
    await throws(() => conf.m.answer('B-3', { seenLastAnswerAt: null, text: 'x', status: 'new', vis: 'pub' }));
    chk(conf.authed.log[0].body.requestId !== conf.authed.log[1].body.requestId, '  서버가 거절했으면 다음엔 새 요청 번호');
    chk(lib.KIND.CONFLICT === m.failOf(apiErr(409, 'BUG_ANSWER_CONFLICT')).kind && lib.KIND.GUIDE === m.failOf(apiErr(400, 'BUG_PRIVATE_ANSWER_ONLY')).kind, '  겹침(BUG_ANSWER_CONFLICT)은 겹침 갈래 · 비공개 글의 공개 답변은 안내 갈래');
    const pd = lib.postOf(detailRes());
    chk(pd.lastAnswerIso === '2026-11-10T02:00:00Z' && lib.postOf(detailRes({ lastAnswerAt: null })).lastAnswerIso === null, '  글 받기 — 마지막 운영자 답변 시각을 서버 글자 그대로 기억(없으면 null)');
  }
  {
    const row = (o) => Object.assign({ key: 'bug.report', value: { notice: '안내', link: 'https://open.kakao.com/o/a' }, default: { notice: '기본', link: '' }, version: 3, updatedBy: null, updatedAt: null, appliesOn: 'now' }, o || {});
    const { m, authed } = mk(S.API, {
      'GET /v1/admin/config': [{ key: 'room.limits', value: {}, version: 1 }, row()],
      'PUT /v1/admin/config/bug.report': (b) => row({ value: b.value, version: b.version + 1 }),
    });
    const c = await m.reportConfig();
    chk(authed.log[0].path === '/v1/admin/config' && c.version === 3 && c.notice === '안내' && c.link === 'https://open.kakao.com/o/a' && Object.keys(c).length === 3, '링크 받기 — GET /v1/admin/config 에서 bug.report 줄 → { version, notice, link }');
    const s2 = await m.saveReportLink(c, ' https://open.kakao.com/o/new ');
    chk(authed.log[1].method === 'PUT' && authed.log[1].path === '/v1/admin/config/bug.report' && JSON.stringify(authed.log[1].body) === '{"version":3,"value":{"notice":"안내","link":"https://open.kakao.com/o/new"}}'
      && s2.version === 4 && s2.link === 'https://open.kakao.com/o/new', '저장 — PUT /v1/admin/config/bug.report { version, value:{ notice(받은 그대로), link } } → 새 판');
    const cleared = await m.saveReportLink(c, '');
    chk(authed.log[2].body.value.link === '' && cleared.link === '', '  링크 비우기도 저장(서버가 허용)');
    for(const [why, cfg, l] of [['남의 사이트', c, 'http://evil.example/'], ['주소만', c, 'https://open.kakao.com/'], ['300자 넘음', c, 'https://open.kakao.com/' + 'a'.repeat(300)],
      ['판 없음', { notice: '안내', link: '' }, ''], ['안내 글 없음', { version: 1, notice: '', link: '' }, '']]){
      const n0 = authed.log.length, e = await throws(() => m.saveReportLink(cfg, l));
      chk(!!e && e.code === 'INVALID' && authed.log.length === n0, '  ' + why + ' — 요청 없이 던진다');
    }
    const dflt = mk(S.API, { 'GET /v1/admin/config': [row({ value: null })] });
    chk((await dflt.m.reportConfig()).notice === '기본', '  값이 비었으면 기본값 칸을 쓴다');
    for(const [why, d] of [['목록이 아님', { a: 1 }], ['bug.report 줄 없음', [{ key: 'x', version: 1 }]], ['판 없음', [row({ version: 'a' })]], ['안내 글 없음', [row({ value: { link: '' } })]]]){
      const bad = mk(S.API, { 'GET /v1/admin/config': d });
      const e = await throws(() => bad.m.reportConfig());
      chk(!!e && e.code === 'SHAPE', '  받은 모양이 틀리면 던진다(빈 값으로 돌리지 않는다) — ' + why);
    }
    const conf = mk(S.API, { 'PUT /v1/admin/config/bug.report': () => apiErr(409, 'CONCURRENT_UPDATE') });
    const e = await throws(() => conf.m.saveReportLink(c, ''));
    chk(!!e && conf.m.failOf(e).kind === lib.KIND.CONFLICT, '  판이 다르면(409 CONCURRENT_UPDATE) 겹침 갈래');
  }

  say('── 5. 오류 갈래');
  {
    const { m } = mk(S.API, {});
    const K = lib.KIND;
    const cases = [
      [apiErr(429, 'BUG_DAILY_LIMIT'), K.GUIDE], [apiErr(429, 'BUG_REPLY_TOO_SOON'), K.GUIDE], [apiErr(409, 'BUG_VIS_LOCKED'), K.GUIDE],
      [apiErr(404, 'BUG_NOT_FOUND'), K.MISSING], [apiErr(403, 'BUG_PRIVATE'), K.PRIVATE], [apiErr(409, 'CONCURRENT_UPDATE'), K.CONFLICT],
      [apiErr(401, 'AUTH_REQUIRED'), K.COMMON], [offline(), K.COMMON], [apiErr(400, 'BUG_INVALID'), K.SITE], [Object.assign(new Error('x'), { code: 'SHAPE' }), K.SITE],
    ];
    chk(cases.every(([e, k]) => m.failOf(e).kind === k), '안내 · 없는 글 · 비공개 · 겹침 · 공통 · 닿지 못함 · 그 밖 — ' + cases.map(([e]) => m.failOf(e).kind).join(' · '));
    chk(JSON.stringify(m.KIND) === JSON.stringify(lib.KIND) && JSON.stringify(Object.keys(m.ERRORS)) === JSON.stringify(Object.keys(lib.ERRORS)), '인스턴스가 갈래 · 기능 표를 같이 내놓는다(화면이 전역을 다시 읽지 않게)');
  }
}

async function runAll(){
  const S = Object.assign({}, SRC0);
  await judge(S);
  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['줄 맞춤에서 mine 을 뺌', S.API.replace("mine: s.mine === true,", 'mine: false,'), '«내 글» 표시'],
    ['못 받음을 빈 목록으로 돌림', S.API.replace("return pageOf(await get(PATHS.list + queryOf({ filter, limit: n, cursor: nonEmpty(cursor) ? cursor : null })));",
      "try{ return pageOf(await get(PATHS.list + queryOf({ filter, limit: n, cursor: nonEmpty(cursor) ? cursor : null }))); }catch(_){ return { items: [], next: null }; }"), '실패 ≠ 없음'],
    ['닿지 못해도 번호를 끝냄', S.API.replace('if(e && e.status) ids.settle(key);', 'ids.settle(key);'), '두 번 올라감'],
    ['배지 epoch 를 안 봄', S.API.replace('if(at === epoch) badge = n;', 'badge = n;'), '늦은 답이 새 계정 수를 덮음'],
    ['👍 응답을 안 보고 본 수 + 1', S.API.replace("return { likeN: d.likeCount, liked: d.liked };", "return { likeN: 1, liked: true };"), '서버 수로 그림'],
    ['👍 응답 모양을 안 봄', S.API.replace("if(!isObj(d) || !cnt(d.likeCount) || typeof d.liked !== 'boolean') throw shapeError('공감 수');", ''), '모양 틀림 던짐'],
    ['답변에 본 시각을 안 실음', S.API.replace("seenLastAnswerAt: a.seenLastAnswerAt == null ? null : a.seenLastAnswerAt,", ''), '겹침을 서버가 못 가림'],
    ['링크 저장에 판을 안 실음', S.API.replace('{ version: cfg.version, value: { notice: cfg.notice, link: l } }', '{ value: { notice: cfg.notice, link: l } }'), '두 관리자가 덮어씀'],
    ['링크 모양을 안 거름', S.API.replace("const linkOk = (l) => l === '' ||", 'const linkOk = (l) => true ||'), '남의 주소가 저장됨'],
    ['새 글에 내 코드를 실음', S.API.replace('const body = { requestId,', "const body = { code: 'ME', requestId,"), '신원은 토큰에서만'],
  ];
  for(const [name, src, what] of breaks){
    if(src === S.API){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { API: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  if(!fail) say('전부 통과');
  process.exit(fail ? 1 : 0);
}
runAll();
