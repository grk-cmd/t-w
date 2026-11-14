/* ═══ 📖 sim-guestbook-api.js — 방명록 · 웹박수 api provider (0.13 앱 묶음 D2-4) ═══
   [왜] 방명록이 Firebase(users/{코드}/guestbook · clap) 대신 우리 서버 공개 API(/v2/guestbooks · /v2/me/guestbook)를 쓴다. 서버 모양(authorName · createdAt ·
     clap.imageUrl · canWrite · version)을 화면 모양({name, ts, img, canWrite…})으로 맞추는 곳이 provider 하나라 그 맞춤을 실제로 불러서 판정한다.
   ・1절: 읽기 — 경로 · 모양 맞춤(글 · 박수 · canWrite · 판) · 빈 방명록(entries:[])과 못 읽음(던짐)을 가름 · 모양 틀림은 던짐 · 새 글 수(since)
   ・2절: 쓰기 — 글 쓰기 · 지우기 · 박수 · 겉모습의 경로 · 본문(requestId · 신원은 안 실림) · 읽은 토큰의 주인과 묶음(진짜 api-client 로: 주인이 바뀌면 요청 0 · 'stale') ·
          읽은 적 없으면 안 보냄 · 서버 거절은 'failed' + err(던지지 않음) · 폭죽 null(지움) 과 칸 없음(그대로)을 가름
   ・3절: 배선 — firebase-init 에 옛 방명록 읽기 · 쓰기가 없음(박수 그림 올리기만 남음) · guestbook.js 가 firebaseAPI 로 방명록을 안 부름 · html · smoke 순서
   ・4절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const SRC0 = {
  IMG: pick(['image-bytes.js', 'parts/shared/image-bytes.js', 'app/parts/shared/image-bytes.js']),
  API: pick(['guestbook-api.js', 'parts/myhome/guestbook-api.js', 'app/parts/myhome/guestbook-api.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  UI: pick(['guestbook.js', 'parts/myhome/guestbook.js', 'app/parts/myhome/guestbook.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
  AC: pick(['api-client.js', 'parts/shared/api-client.js', 'app/parts/shared/api-client.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwGuestbookApi; };
let IMGSRC = null;   // 검사 중인 image-bytes.js 원본(깨 보기가 바꿔 끼운다)
const imgMod = () => { const w = {}; new Function('window', 'module', IMGSRC)(w, undefined); return w.TwImageBytes; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : 'request' });
const ent = (id, o) => Object.assign({ id, authorName: '이름' + id, text: '글' + id, createdAt: '2026-11-01T01:02:03.456Z', mine: false }, o || {});
const bookOf = (o) => Object.assign({ entries: [ent('e1', { mine: true }), ent('e2')], clap: { count: 7, imageUrl: null, emoji: null, todayLeft: 3, dailyMax: 5 }, canWrite: true, version: 4 }, o || {});

/* 가짜 authed — 부른 것을 적고, 길마다 정한 답을 낸다. 읽기는 onOwner 로 토큰 주인을 알려 준다 */
function fake(routes, who){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    const key = method + ' ' + path.split('?')[0];
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path, opts) : r;
    if(v instanceof Error) throw v;
    if(method === 'GET' && opts && opts.onOwner) opts.onOwner(who || 'ME01');
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), patch: (p, b, o) => run('PATCH', p, b, o), post: (p, b, o) => run('POST', p, b, o), del: (p, o) => run('DELETE', p, undefined, o) };
}
const mk = (src, routes, who) => {
  const authed = fake(routes, who), warns = [];
  const m = load(src).createGuestbookApi({ authed, imageBytes: imgMod(), warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, warns };
};

async function judge(S){
  IMGSRC = S.IMG;
  const LIB = S.API;

  say('── 1. 읽기');
  {
    const { m, authed } = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf({ clap: { count: 7, imageUrl: 'https://img/x.jpg', emoji: '🎉', todayLeft: 0, dailyMax: 5 } }) });
    const v = await m.fetchView('ME01', 'uOWN00001');
    const g = authed.log[0];
    chk(g.path === '/v2/guestbooks/uOWN00001' && g.opts.auth === true, '경로 — 그 주인의 방명록 · 로그인 통로로');
    chk(v.entries.length === 2 && v.entries[0].id === 'e1' && v.entries[0].name === '이름e1' && v.entries[0].text === '글e1' && v.entries[0].mine === true && v.entries[1].mine === false, '글 — id · 이름(authorName) · 글 · 내 글(mine) · 서버가 준 순서(최신이 위) 그대로');
    chk(v.entries[0].ts === Date.parse('2026-11-01T01:02:03.456Z'), '시각 — createdAt 을 ms 로');
    chk(v.clap.count === 7 && v.clap.img === 'https://img/x.jpg' && v.clap.emoji === '🎉' && v.clap.todayLeft === 0 && v.clap.dailyMax === 5, '박수 — 수 · 그림 · 폭죽 · 오늘 남은 수 · 하루 상한 (서버가 센 값)');
    chk(v.canWrite === true && v.version === 4, '쓸 수 있나(canWrite) · 판(version)');
    const none = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf({ entries: [], canWrite: false }) });
    const e = await none.m.fetchView('ME01', 'uOWN00001');
    chk(Array.isArray(e.entries) && e.entries.length === 0 && e.canWrite === false && e.clap.img === null && e.clap.emoji === '', '글이 없으면 빈 목록 — «없음» 이지 실패가 아니다(그림 · 폭죽은 null · 빈 글)');
    for(const [name, bad] of [['null', null], ['entries 없음', { clap: {}, canWrite: true, version: 1 }], ['canWrite 글자', bookOf({ canWrite: 'yes' })],
      ['version 없음', bookOf({ version: undefined })], ['clap.count 음수', bookOf({ clap: { count: -1, todayLeft: 1, dailyMax: 5 } })], ['clap 없음', bookOf({ clap: null })]]){
      const b = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bad });
      let t = null; try{ await b.m.fetchView('ME01', 'uOWN00001'); }catch(x){ t = x; }
      chk(t && t.code === 'SHAPE', '모양이 틀리면(' + name + ') 던진다 — 빈 방명록으로 숨기지 않는다');
    }
    const odd = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf({ entries: [ent('ok'), { text: 'id 없음' }, null, ent('x', { text: 3 })] }) });
    chk((await odd.m.fetchView('ME01', 'uOWN00001')).entries.length === 1, '모양이 틀린 글 한 줄은 거르고 나머지는 보인다');
    const down = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': apiErr(503, 'X') });
    let thrown = null; try{ await down.m.fetchView('ME01', 'uOWN00001'); }catch(x){ thrown = x; }
    chk(thrown && thrown.status === 503, '못 읽으면 던진다(빈 목록으로 숨기지 않는다)');
    let t2 = null; try{ await m.fetchView('', 'uOWN00001'); }catch(x){ t2 = x; }
    let t3 = null; try{ await m.fetchView('ME01', ''); }catch(x){ t3 = x; }
    chk(t2 && t2.code === 'NO_USER' && t3 && t3.code === 'NO_OWNER', '내 코드 · 주인 코드가 없으면 요청 없이 던진다');
    const sum = mk(LIB, { 'GET /v2/me/guestbook/summary': { newCount: 3 } });
    chk(await sum.m.fetchNewCount('ME01', 1730000000000) === 3 && sum.authed.log[0].path === '/v2/me/guestbook/summary?since=1730000000000', '새 글 수 — since(ms) 뒤 글 수(서버가 센 숫자) · 경로에 내 코드를 싣지 않는다');
    sum.authed.log.length = 0; await sum.m.fetchNewCount('ME01', 0);
    chk(sum.authed.log[0].path.endsWith('since=0'), '  한 번도 안 열었으면(0) 전부');
    let t4 = null; try{ await mk(LIB, { 'GET /v2/me/guestbook/summary': { newCount: 'x' } }).m.fetchNewCount('ME01', 1); }catch(x){ t4 = x; }
    chk(t4 && t4.code === 'SHAPE', '  숫자가 아니면 던진다');
  }

  say('── 2. 쓰기');
  {
    const routes = {
      'GET /v2/guestbooks/uOWN00001': bookOf(), 'GET /v2/me/guestbook/summary': { newCount: 0 },
      'POST /v2/guestbooks/uOWN00001/entries': (b) => ent('new1', { text: b.text, mine: true }),
      'DELETE /v2/guestbooks/uOWN00001/entries/e1': null,
      'POST /v2/guestbooks/uOWN00001/claps': { count: 8, todayLeft: 2, dailyMax: 5 },
      'PATCH /v2/me/guestbook': null,
    };
    const { m, authed } = mk(LIB, routes);
    const before = await m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678');
    chk(before.status === 'stale' && authed.log.length === 0, '읽은 적 없는 계정의 쓰기는 보내지 않는다(stale · 요청 0)');
    await m.fetchView('ME01', 'uOWN00001');
    authed.log.length = 0;
    const w = await m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678');
    const g = authed.log[0];
    chk(w.status === 'ok' && w.entry.id === 'new1' && w.entry.text === 'hi' && w.entry.mine === true, '글 쓰기 — 답의 글을 화면 모양으로');
    chk(g.method === 'POST' && g.path === '/v2/guestbooks/uOWN00001/entries' && JSON.stringify(g.body) === JSON.stringify({ requestId: 'rid-12345678', text: 'hi' }), '  경로 · 본문은 requestId 와 글뿐 — 글쓴이 · 이름 · 시각은 안 싣는다(서버가 토큰으로 정한다)');
    chk(g.opts.expectOwner === 'ME01', '  읽은 토큰의 주인에 묶는다(expectOwner)');
    authed.log.length = 0;
    const d = await m.remove('ME01', 'uOWN00001', 'e1');
    chk(d.status === 'ok' && authed.log[0].method === 'DELETE' && authed.log[0].path === '/v2/guestbooks/uOWN00001/entries/e1' && authed.log[0].opts.expectOwner === 'ME01', '글 지우기 — DELETE …/entries/{id} · 주인 묶음');
    authed.log.length = 0;
    const c = await m.clap('ME01', 'uOWN00001', 'rid-87654321');
    chk(c.status === 'ok' && c.count === 8 && c.todayLeft === 2 && c.dailyMax === 5 && JSON.stringify(authed.log[0].body) === JSON.stringify({ requestId: 'rid-87654321' }) && authed.log[0].path === '/v2/guestbooks/uOWN00001/claps', '박수 — POST …/claps { requestId } · 서버가 센 수 · 남은 수 · 상한');
    authed.log.length = 0;
    await m.changeLook('ME01', 4, { clapEmoji: '🎉' });
    chk(authed.log[0].method === 'PATCH' && authed.log[0].path === '/v2/me/guestbook' && JSON.stringify(authed.log[0].body) === JSON.stringify({ version: 4, clapEmoji: '🎉' }), '폭죽 바꾸기 — PATCH /v2/me/guestbook { version, clapEmoji } (내 것이라 경로에 코드 없음)');
    authed.log.length = 0;
    await m.changeLook('ME01', 4, { clapEmoji: null });
    chk('clapEmoji' in authed.log[0].body && authed.log[0].body.clapEmoji === null && !('clapImageUrl' in authed.log[0].body), '  null 은 «지움» 으로 보낸다 · 안 고치는 칸(그림)은 아예 안 싣는다');

    const other = mk(LIB, routes, 'ME01');
    await other.m.fetchView('ME01', 'uOWN00001');
    other.authed.post = async (p, b, o) => { other.authed.log.push({ p, o }); throw Object.assign(new Error('x'), { code: 'OWNER_CHANGED', kind: 'auth' }); };
    const st = await other.m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678');
    chk(st.status === 'stale', '쓰기 직전 로그인한 사람이 바뀌었으면(OWNER_CHANGED) stale — 조용히 버린다(실패로 알리지 않는다)');
    const st2 = await other.m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678');
    chk(st2.status === 'stale' && other.authed.log.filter((x) => x.p).length === 1, '  그 계정의 읽은 기억을 버려 다시 읽기 전엔 더 보내지 않는다');

    const denied = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf(), 'POST /v2/guestbooks/uOWN00001/entries': apiErr(403, 'GUESTBOOK_NOT_FRIEND'),
      'POST /v2/guestbooks/uOWN00001/claps': apiErr(429, 'GUESTBOOK_CLAP_DAILY_LIMIT'), 'DELETE /v2/guestbooks/uOWN00001/entries/e2': apiErr(503, 'X') });
    await denied.m.fetchView('ME01', 'uOWN00001');
    const f = await denied.m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678');
    chk(f.status === 'failed' && f.err.code === 'GUESTBOOK_NOT_FRIEND', '서버 거절은 던지지 않고 failed + err(부르는 쪽이 이름으로 번호를 고른다)');
    const cl = await denied.m.clap('ME01', 'uOWN00001', 'rid-87654321');
    chk(cl.status === 'failed' && cl.err.code === 'GUESTBOOK_CLAP_DAILY_LIMIT', '  하루 몫을 다 쓴 박수도 failed + err');
    const rm = await denied.m.remove('ME01', 'uOWN00001', 'e2');
    chk(rm.status === 'failed' && rm.err.status === 503 && denied.warns.length === 3, '  닿지 못해도 failed · 진단 기록을 남긴다');
    /* 박수 그림 — 요청 둘 중 첫째 */
    const PNG = 'data:image/png;base64,' + Buffer.from([137, 80, 78, 71, 1, 2, 3]).toString('base64');
    const im = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf(), 'POST /v2/me/images': { url: 'https://firebasestorage.googleapis.com/v0/b/x/o/users%2FME01%2Fclap_1.png' } });
    chk((await im.m.uploadImage('ME01', PNG)).status === 'stale' && im.authed.log.length === 0, '박수 그림 — 읽은 적 없는 계정은 보내지 않는다');
    await im.m.fetchView('ME01', 'uOWN00001'); im.authed.log.length = 0;
    const up = await im.m.uploadImage('ME01', PNG); const ur = im.authed.log[0];
    chk(up.status === 'ok' && /^https:\/\/firebasestorage/.test(up.url) && ur.method === 'POST' && ur.path === '/v2/me/images?purpose=clap' && ur.opts.rawType === 'image/png' && ur.opts.expectOwner === 'ME01', '  POST /v2/me/images?purpose=clap · 형식 그대로(rawType) · 주인 묶음 → url');
    chk(ur.body instanceof Uint8Array && ur.body.length === 7 && ur.body[0] === 137, '  본문은 파일 바이트 그대로(JSON·base64 아님)');
    im.authed.log.length = 0;
    const big = 'data:image/png;base64,' + Buffer.alloc(512 * 1024 + 1).toString('base64');
    const bg = await im.m.uploadImage('ME01', big);
    chk(bg.status === 'failed' && bg.err.code === 'PAYLOAD_TOO_LARGE' && im.authed.log.length === 0, '  512KB 를 넘으면 요청 없이 PAYLOAD_TOO_LARGE');
    const edge = await im.m.uploadImage('ME01', 'data:image/png;base64,' + Buffer.alloc(512 * 1024).toString('base64'));
    chk(edge.status === 'ok', '  딱 512KB 는 보낸다');
    im.authed.log.length = 0;
    for(const bad of ['data:image/gif;base64,AAAA', 'http://x/y.png', '', 'data:image/png;base64,']){
      const b = await im.m.uploadImage('ME01', bad);
      chk(b.status === 'failed' && b.err.code === 'IMAGE_INVALID' && im.authed.log.length === 0, '  형식이 아니면(' + (bad.slice(0, 22) || '빈 값') + ') 요청 없이 IMAGE_INVALID');
    }
    for(const [st, code, kind] of [[400, 'IMAGE_INVALID'], [413, 'PAYLOAD_TOO_LARGE'], [415, 'UNSUPPORTED_MEDIA_TYPE'], [503, 'X']]){
      const f = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf(), 'POST /v2/me/images': apiErr(st, code) });
      await f.m.fetchView('ME01', 'uOWN00001');
      const r = await f.m.uploadImage('ME01', PNG);
      chk(r.status === 'failed' && r.err.status === st && r.err.code === code, '  서버 ' + st + ' 는 failed + err 그대로(부르는 쪽이 구분)');
    }
    const nu = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf(), 'POST /v2/me/images': { nope: 1 } });
    await nu.m.fetchView('ME01', 'uOWN00001');
    chk((await nu.m.uploadImage('ME01', PNG)).err.code === 'SHAPE', '  답에 url 이 없으면 ok 로 치지 않는다');
    await im.m.changeLook('ME01', 4, { clapImageUrl: 'https://x/y' }); const lk = im.authed.log[im.authed.log.length - 1];
    chk(JSON.stringify(lk.body) === JSON.stringify({ version: 4, clapImageUrl: 'https://x/y' }), '  둘째 — PATCH /v2/me/guestbook { version, clapImageUrl }');
    const bad = mk(LIB, { 'GET /v2/guestbooks/uOWN00001': bookOf(), 'POST /v2/guestbooks/uOWN00001/entries': { nope: 1 }, 'POST /v2/guestbooks/uOWN00001/claps': { count: 'x' } });
    await bad.m.fetchView('ME01', 'uOWN00001');
    const bw = await bad.m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678'), bc = await bad.m.clap('ME01', 'uOWN00001', 'rid-87654321');
    chk(bw.status === 'failed' && bw.err.code === 'SHAPE' && bc.status === 'failed' && bc.err.code === 'SHAPE', '  답 모양이 틀리면 ok 로 치지 않는다(failed · SHAPE)');
  }

  say('── 3. 실제 api-client 와 — 주인이 바뀌면 요청 0');
  {
    const AC = (() => { const mod = { exports: {} }; new Function('module', 'window', S.AC)(mod, undefined); return mod.exports; })();
    const jwt = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
    const reply = (status, data) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => ({ success: true, data }) });
    const calls = [], tk = { v: jwt('A') };
    const client = AC.createApiClient({ baseUrl: 'https://api.test', getToken: async () => tk.v,
      fetch: async (url, init) => { calls.push(init.method + ' ' + url); return reply(200, init.method === 'GET' ? bookOf() : ent('n1')); } });
    const m = load(S.API).createGuestbookApi({ authed: client, imageBytes: imgMod(), warn: () => {} });
    await m.fetchView('ME01', 'uOWN00001');
    chk((await m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678')).status === 'ok' && calls.length === 2, '같은 계정이면 보낸다');
    tk.v = jwt('B');   // 그 사이 다른 계정으로 로그인
    chk((await m.write('ME01', 'uOWN00001', 'hi', 'rid-12345678')).status === 'stale' && calls.length === 2, '읽은 뒤 토큰 주인이 바뀌면 요청 0 · stale — 앞 계정 화면의 누름이 새 계정으로 나가지 않는다');
    chk((await m.clap('ME01', 'uOWN00001', 'rid-87654321')).status === 'stale' && (await m.changeLook('ME01', 1, { clapEmoji: null })).status === 'stale' && calls.length === 2, '  박수 · 폭죽도 다시 읽기 전까지 계속 안 보낸다');
  }

  say('── 4. 배선');
  {
    const fi = strip(S.FI);
    chk(!/subscribeGuestbook|addGuestbookEntry|deleteGuestbookEntry|clapOnce|subscribeClap|setClapEmoji/.test(fi), 'firebase-init 에 옛 방명록 읽기 · 쓰기 · 박수 · 폭죽이 없다');
    chk(!/setClapImage/.test(fi), '  박수 그림 올리기(setClapImage)도 없다 — 서버 그림 길(purpose=clap)로');
    const ui = strip(S.UI);
    chk(!/firebaseAPI/.test(ui) && !/localStorage/.test(ui) && !/setClapImage/.test(ui), 'guestbook.js 가 firebaseAPI · localStorage 를 직접 안 만진다(서버 길은 feed 로)');
    const app = strip(S.APP);
    chk(/TwGuestbookApi\.createGuestbookApi\(\{ authed: TwApi\.authed/.test(app) && /TwGuestbookFeed\.createGuestbookFeed\(/.test(app), 'app.js 가 로그인 통로(TwApi.authed)로 provider 를 만들어 feed 에 넘긴다');
    const tag = (f) => S.HTML.indexOf('<script src="parts/' + f + '"></script>');
    const iApi = tag('myhome/guestbook-api.js'), iFeed = tag('myhome/guestbook-feed.js'), iUi = tag('myhome/guestbook.js'), iApp = tag('app.js');
    chk(iApi > 0 && iApi < iFeed && iFeed < iUi && iUi < iApp, 'html 순서 — guestbook-api → guestbook-feed → guestbook → app.js');
    chk(/PRELOAD\.push\('guestbook-api\.js'\)/.test(S.SMOKE) && /PRELOAD\.push\('guestbook-feed\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 둘 다 있다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 5. 일부러 깨 보기');
  const breaks = [
    ['글 이름을 안 읽음', S.API.replace("name: typeof it.authorName === 'string' ? it.authorName : ''", "name: ''"), '이름(authorName)'],
    ['내 글 표시를 항상 참', S.API.replace("mine: it.mine === true", "mine: true"), '내 글(mine)'],
    ['canWrite 를 안 읽음', S.API.replace("canWrite: d.canWrite, version", "canWrite: true, version"), 'canWrite'],
    ['오늘 남은 수를 안 읽음', S.API.replace("todayLeft: left,", "todayLeft: 99,"), '오늘 남은 수'],
    ['모양 틀림을 빈 방명록으로 숨김', S.API.replace("if(!v) throw shapeError();\n    return v;", "return v || { entries: [], clap: { count: 0, img: null, emoji: '', todayLeft: 0, dailyMax: 0 }, canWrite: false, version: 0 };"), '모양이 틀리면'],
    ['쓰기가 주인을 안 묶음', S.API.replace("const data = await send({ expectOwner: owners.get(uid) });", "const data = await send({});"), '주인에 묶는다'],
    ['읽기 전에도 보냄', S.API.replace("if(!uid || !owners.has(uid)) return { status: 'stale' };", "if(!uid) return { status: 'stale' };"), '읽은 적 없는 계정'],
    ['실패를 던짐', S.API.replace("return { status: 'failed', err: e };\n    }\n  }", "throw e;\n    }\n  }"), '던지지 않고 failed'],
    ['글쓴이를 본문에 실음', S.API.replace("{ requestId, text }", "{ requestId, text, uid: uid }"), '글쓴이 · 이름 · 시각은 안 싣는다'],
    ['요청 번호를 안 실음', S.API.replace("{ requestId, text }", "{ text }"), 'requestId'],
    ['지움(null)을 칸 없음으로', S.API.replace("body.clapEmoji = patch.clapEmoji;", "if(patch.clapEmoji != null) body.clapEmoji = patch.clapEmoji;"), '«지움»'],
    ['박수 경로 틀림', S.API.replace("'/claps'", "'/clap'"), '박수'],
    ['그림 용량 상한을 안 봄', S.IMG.replace('img.bytes.length > o.maxBytes', 'false'), '512KB', 'IMG'],
    ['그림을 base64 글자로 보냄', S.API.replace('authed.post(PATHS.image, img.bytes,', 'authed.post(PATHS.image, dataUrl,'), '바이트 그대로'],
    ['그림 쓰임이 틀림', S.API.replace("image: '/v2/me/images?purpose=clap'", "image: '/v2/me/images?purpose=dday'"), 'purpose=clap'],
    ['새 글 수 since 를 안 보냄', S.API.replace("'/v2/me/guestbook/summary?since=' + enc(String(since))", "'/v2/me/guestbook/summary'"), 'since'],
  ];
  for(const [name, src, what, key = 'API'] of breaks){
    if(src === S[key]){ chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    quiet = true; qfail = 0;
    try{ await judge(Object.assign({}, S, { [key]: src })); }catch(_){ qfail++; }
    quiet = false;
    chk(qfail > 0, name + ' → 빨강(' + what + ')');
  }
  say('\n통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
runAll();
