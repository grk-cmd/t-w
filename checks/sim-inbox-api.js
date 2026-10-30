/* ═══ 📩 sim-inbox-api.js — 우편 api provider (0.13 앱 묶음 D4) ═══
   [왜] 알림함 «우편» 이 Firebase(inbox/{코드}) 대신 우리 서버 공개 API(/v1/me/notifications)를 쓴다. 서버 모양(kind · readAt · createdAt · payload ·
     쪽 · 서버가 센 안 읽은 수)을 화면 모양({tag, title, body, ts, read, bugId})으로 맞추는 곳이 provider 하나라 그 맞춤을 실제로 불러서 판정한다.
   ・1절: 읽기 — 경로 · 질의(section=MAIL · limit) · 모양 맞춤(종류 → 태그 · 시각 · 읽음 · 버그 글 번호) · 빈 우편(객체)과 못 읽음(던짐)을 가름 · 모양 틀림은 던짐
   ・2절: 쪽 — nextCursor 를 따라 이어 받음 · 쪽 상한(오래된 것은 안 받고 complete:false) · 서버가 센 안 읽은 수를 쓴다(받은 쪽지 수와 달라도)
   ・3절: 쓰기 — 읽음 · 모두 읽음 · 지우기의 경로 · 본문 · 읽은 토큰의 주인과 묶음(진짜 api-client 로: 주인이 바뀌면 요청 0 · 'stale') · 읽은 적 없으면 안 보냄 · 실패는 'failed'
   ・4절: 배선 — firebase-init 에 옛 수령함 읽기 · 쓰기가 없음 · 부르는 곳이 firebaseAPI 로 우편을 안 부름 · html · smoke 순서
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  API: pick(['inbox-api.js', 'parts/myhome/inbox-api.js', 'app/parts/myhome/inbox-api.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  INBOX: pick(['myhome-inbox.js', 'parts/myhome/myhome-inbox.js', 'app/parts/myhome/myhome-inbox.js']),
  UI: pick(['myhome-ui.js', 'parts/myhome/myhome-ui.js', 'app/parts/myhome/myhome-ui.js']),
  INIT: pick(['myhome-init.js', 'parts/myhome/myhome-init.js', 'app/parts/myhome/myhome-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
  AC: pick(['api-client.js', 'parts/shared/api-client.js', 'app/parts/shared/api-client.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwInboxApi; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : 'request' });
const item = (id, kind, o) => Object.assign({ id, section: 'MAIL', kind, title: 't' + id, body: 'b' + id, payload: {}, readAt: null, createdAt: '2026-10-30T01:02:03Z' }, o || {});
const page = (items, next, unread) => ({ items, nextCursor: next || null, unreadCount: unread });

/* 가짜 authed — 부른 것을 적고, 길마다 정한 답을 낸다 */
function fake(routes){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    const key = method + ' ' + path.split('?')[0];
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path, log.filter((x) => x.method === method && x.path === path).length, opts) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), patch: (p, b, o) => run('PATCH', p, b, o), post: (p, b, o) => run('POST', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
const mk = (src, routes) => {
  const authed = fake(routes), warns = [];
  const m = load(src).createInboxApi({ authed, warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, warns };
};

async function judge(S){
  const LIB = S.API;

  say('── 1. 읽기');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/me/notifications': page([
      item('a', 'LICENSE_ISSUED'), item('b', 'BUG_ANSWERED', { payload: { number: '1031-2' }, readAt: '2026-10-30T02:00:00Z' }),
      item('c', 'LEVEL_UNLOCK'), item('d', 'SECRET_ROOM_ISSUED'), item('e', 'LEGACY'), item('f', 'NEW_KIND_FROM_FUTURE'),
    ], null, 4) });
    const r = await m.fetchMail('ME01');
    const g = authed.log[0];
    chk(g.path.startsWith('/v1/me/notifications?section=MAIL') && /limit=50/.test(g.path) && g.opts.auth === true && !/ME01/.test(g.path), '경로 — 내 알림 · section=MAIL · limit=50 · 로그인 통로로(내 코드는 경로에 안 실린다)');
    chk(Object.keys(r.items).length === 6 && r.items.a.tag === 'reward' && r.items.b.tag === 'bug' && r.items.c.tag === 'reward' && r.items.d.tag === 'reward' && r.items.e.tag === 'reward', '종류 → 태그 — 라이선스 · 해금 · 시크릿룸 · 옛 글은 reward · 답변은 bug');
    chk(r.items.f.tag === 'reward', '  모르는 종류도 «우편» 으로 보인다(버리지 않는다)');
    chk(r.items.a.title === 'ta' && r.items.a.body === 'ba' && r.items.a.ts === Date.parse('2026-10-30T01:02:03Z') && r.items.a.read === false && r.items.b.read === true, '제목 · 본문 · 시각(ms) · 읽음(readAt 이 있으면 읽음)');
    chk(r.items.b.bugId === '1031-2' && r.items.a.bugId === undefined, '버그 답변은 payload.number 를 bugId 로(누르면 그 글로 간다) · 다른 종류엔 없다');
    chk(r.unread === 4 && r.complete === true, '안 읽은 수는 서버가 센 값 · 다음 쪽이 없으면 complete');
    const empty = mk(LIB, { 'GET /v1/me/notifications': page([], null, 0) });
    const e = await empty.m.fetchMail('ME01');
    chk(typeof e.items === 'object' && Object.keys(e.items).length === 0 && e.unread === 0, '우편이 없으면 빈 객체 — «없음» 이지 실패가 아니다');
    const down = mk(LIB, { 'GET /v1/me/notifications': apiErr(503, 'X') });
    let thrown = null; try{ await down.m.fetchMail('ME01'); }catch(x){ thrown = x; }
    chk(thrown && thrown.status === 503, '못 읽으면 던진다(빈 목록으로 숨기지 않는다)');
    for(const bad of [null, { items: 'x' }, { nextCursor: null }]){
      const b = mk(LIB, { 'GET /v1/me/notifications': bad });
      let t2 = null; try{ await b.m.fetchMail('ME01'); }catch(x){ t2 = x; }
      chk(t2 && t2.code === 'SHAPE', '모양이 틀린 응답(' + JSON.stringify(bad) + ')은 던진다');
    }
    const odd = mk(LIB, { 'GET /v1/me/notifications': page([item('a', 'LEVEL_UNLOCK'), { title: 'id 없음' }, null, 5], null, 1) });
    chk(Object.keys((await odd.m.fetchMail('ME01')).items).join() === 'a', '한 통이 깨져 있어도(id 없음 · 객체 아님) 나머지는 보인다');
    let noUid = null; try{ await empty.m.fetchMail(''); }catch(x){ noUid = x; }
    chk(noUid && noUid.code === 'NO_USER' && empty.authed.log.length === 1, '내 코드가 없으면 요청 0 으로 던진다');
  }

  say('── 2. 쪽');
  {
    const { m, authed } = mk(LIB, { 'GET /v1/me/notifications': (b, path, n) => (path.indexOf('cursor=') < 0 ? page([item('a', 'LEVEL_UNLOCK')], 'C1', 7) : path.indexOf('cursor=C1') >= 0 ? page([item('b', 'LEVEL_UNLOCK', { readAt: 'x' })], null, 0) : null) });
    const r = await m.fetchMail('ME01');
    chk(Object.keys(r.items).join() === 'a,b' && authed.log.length === 2 && /cursor=C1/.test(authed.log[1].path), 'nextCursor 를 따라 이어 받는다');
    chk(r.unread === 7, '안 읽은 수는 첫 쪽의 서버 값 7 — 받은 쪽지에서 센 값(1)이 아니다');
    chk(r.complete === true, '끝까지 받았으면 complete');
    let n = 0;
    const endless = mk(LIB, { 'GET /v1/me/notifications': () => page([item('m' + (n++), 'LEVEL_UNLOCK')], 'MORE', 99) });
    const e = await endless.m.fetchMail('ME01');
    chk(endless.authed.log.length === 4 && e.complete === false && Object.keys(e.items).length === 4, '쪽 상한(4쪽 · 200통)에서 멈추고 complete:false — 끝없이 받지 않는다');
    chk(e.unread === 99, '  못 받은 오래된 우편이 있어도 안 읽은 수는 서버 값');
    const nocount = mk(LIB, { 'GET /v1/me/notifications': { items: [item('a', 'LEVEL_UNLOCK'), item('b', 'LEVEL_UNLOCK', { readAt: 'x' })], nextCursor: null } });
    chk((await nocount.m.fetchMail('ME01')).unread === 1, '서버가 수를 안 주면 받은 것만 센다');
  }

  say('── 3. 쓰기');
  {
    const routes = {
      'GET /v1/me/notifications': page([item('a', 'LEVEL_UNLOCK')], null, 1),
      'PATCH /v1/me/notifications/a': null, 'POST /v1/me/notifications/read-all': null, 'DELETE /v1/me/notifications/a': null,
    };
    const { m, authed } = mk(LIB, routes);
    chk(await m.markRead('ME01', 'a') === 'stale' && authed.log.length === 0, '읽은 적 없는 계정의 쓰기는 보내지 않는다(요청 0 · stale)');
    await m.fetchMail('ME01');
    chk(await m.markRead('ME01', 'a') === 'ok', '읽음 → ok');
    const p = authed.log.find((x) => x.method === 'PATCH');
    chk(p.path === '/v1/me/notifications/a' && JSON.stringify(p.body) === '{"read":true}', '  PATCH /v1/me/notifications/{id} { read: true }');
    chk(await m.markAllRead('ME01') === 'ok' && authed.log.find((x) => x.path === '/v1/me/notifications/read-all').method === 'POST', '모두 읽음 → POST …/read-all');
    chk(await m.remove('ME01', 'a') === 'ok' && authed.log.some((x) => x.method === 'DELETE' && x.path === '/v1/me/notifications/a'), '지우기 → DELETE …/{id}');
    const odd = mk(LIB, Object.assign({}, routes, { 'PATCH /v1/me/notifications/a%2Fb': null }));
    await odd.m.fetchMail('ME01'); await odd.m.markRead('ME01', 'a/b');
    chk(odd.authed.log.some((x) => x.path === '/v1/me/notifications/a%2Fb'), '  id 는 경로에 인코딩해서 싣는다');
    const f = mk(LIB, Object.assign({}, routes, { 'DELETE /v1/me/notifications/a': apiErr(500, 'X') }));
    await f.m.fetchMail('ME01');
    chk(await f.m.remove('ME01', 'a') === 'failed' && f.warns.length === 1, '서버 실패는 failed(진단 로그 한 줄) — 던지지 않는다');
  }
  {
    /* 진짜 api-client 위에서 — 읽은 뒤 로그인한 사람이 바뀌면 요청 0 */
    const AC = (() => { const mod = { exports: {} }; new Function('module', 'window', S.AC)(mod, undefined); return mod.exports; })();
    const jwt = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
    const reply = (status, data) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => ({ success: true, data }) });
    const calls = [], tk = { v: jwt('A') };
    const client = AC.createApiClient({ baseUrl: 'https://api.test', getToken: async () => tk.v,
      fetch: async (url, init) => { calls.push(init.method + ' ' + url); return reply(200, init.method === 'GET' ? page([item('a', 'LEVEL_UNLOCK')], null, 1) : null); } });
    const m = load(LIB).createInboxApi({ authed: client, warn: () => {} });
    await m.fetchMail('ME01');
    chk(await m.markRead('ME01', 'a') === 'ok' && calls.length === 2, '같은 계정이면 보낸다');
    tk.v = jwt('B');   // 그 사이 다른 계정으로 로그인
    chk(await m.markRead('ME01', 'a') === 'stale' && calls.length === 2, '읽은 뒤 토큰 주인이 바뀌면 요청 0 · stale — 앞 계정 화면의 누름이 새 계정으로 나가지 않는다');
    chk(await m.remove('ME01', 'a') === 'stale' && calls.length === 2, '  stale 뒤에는 다시 읽기 전까지 계속 안 보낸다');
    await m.fetchMail('ME01');
    chk(await m.remove('ME01', 'a') === 'ok' && calls.length === 4, '  새 계정으로 다시 읽으면 그 계정으로 보낸다');
  }

  say('── 4. 배선');
  {
    const FI = strip(S.FI);
    chk(!/\b(subscribeInbox|markInboxRead|markAllInboxRead|deleteInboxMessage)\s*\(/.test(FI), 'firebase-init 에 옛 수령함 읽기 · 읽음 · 지우기가 없다(서버가 원본)');
    const callers = [S.INBOX, S.UI, S.INIT].map(strip).join('\n');
    chk(!/firebaseAPI\.(subscribeInbox|markInboxRead|markAllInboxRead|deleteInboxMessage)\b/.test(callers), '부르는 곳이 firebaseAPI 로 우편을 안 부른다');
    const h = S.HTML, tag = (f) => h.indexOf('<script src="parts/' + f + '"></script>');
    const i = tag('myhome/inbox-api.js'), j = tag('myhome/mail-feed.js'), k = tag('app.js');
    chk(i > 0 && j > i && k > j, 'html — inbox-api.js → mail-feed.js → app.js 순서');
    chk(/PRELOAD\.push\('inbox-api\.js'\)/.test(S.SMOKE) && /PRELOAD\.push\('mail-feed\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 inbox-api.js · mail-feed.js');
    const A = strip(S.APP);
    chk(/TwInboxApi\.createInboxApi\(\{\s*authed: TwApi\.authed/.test(A), 'app.js — 로그인 통로(TwApi.authed)를 넘겨 만든다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 5. 일부러 깨 보기');
  const breaks = [
    ['모르는 종류를 버림', S.API.replace("TAG_BY_KIND[kind] || 'reward'", "TAG_BY_KIND[kind]"), '모르는 종류도 «우편»'],
    ['안 읽은 수를 받은 것에서 셈', S.API.replace("if(unread === undefined) unread = p.unread;", "unread = Object.keys(items).length;"), '서버가 센 값'],
    ['쪽 상한을 늘림', S.API.replace('MAX_PAGES: 4', 'MAX_PAGES: 400'), '쪽 상한'],
    ['쓰기가 주인을 안 묶음', S.API.replace("await send({ expectOwner: owners.get(uid) });", "await send({});"), '주인이 바뀌면 요청 0'],
    ['읽기 전에도 보냄', S.API.replace("if(!uid || !owners.has(uid)) return 'stale';", "if(!uid) return 'stale';"), '읽은 적 없는 계정'],
    ['실패를 던짐', S.API.replace("return 'failed';\n    }\n  }", "throw e;\n    }\n  }"), '던지지 않는다'],
    ['읽음 본문 틀림', S.API.replace("{ read: true }", "{ read: false }"), 'PATCH'],
    ['버그 번호 누락', S.API.replace("out.bugId = no;", ""), 'bugId'],
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
