/* ═══ 🎵 sim-playlist-api.js — 플레이리스트 api provider (0.13 앱 묶음 D10) ═══
   [왜] 플레이리스트가 Firebase 대신 우리 서버 공개 API(/v1/me/playlist · /v1/playlists/…)를 쓴다. 서버 모양(tracks[{videoId,title}] ·
     늘 3칸 · listed · 판 version)을 화면 모양(items[{id,title}] · private)으로 맞추는 곳이 provider 하나라 그 맞춤을 실제로 불러서 판정한다.
   ・1절: 읽기 — 내 목록 모양 맞춤 · 빈 목록(객체)과 못 읽음(던짐)을 가름 · 무작위(경로 · exclude) · 들을 것 없음(null) ≠ 실패 · 모양 틀림은 던짐
   ・2절: 남의 목록 — 경로 · 곡 있는 벌만 무작위(경계: 0 · 1 미만) · 곡 없으면 null · 열어 주지 않음(PLAYLIST_FRIENDS_ONLY) · 없는 사용자(USER_NOT_FOUND)는 null · 그 밖 실패는 던짐
   ・3절: 저장 — 읽은 뒤 토큰 주인이 바뀌면 'stale'(진짜 api-client 로) · 본문 모양(version · tracks · listed) · 상한 깎기 · 판 기억(계정별) · 읽은 판 없으면 안 보냄 · 409 는 'conflict'(다시 보내지 않음) · 실패는 'failed'
   ・4절: 배선 — 부르는 곳이 firebaseAPI 로 플레이리스트를 안 부름 · firebase-init 에 옛 메서드가 없음 · html · smoke 순서
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
  API: pick(['playlist-api.js', 'parts/status/playlist-api.js', 'app/parts/status/playlist-api.js']),
  PL: pick(['playlist.js', 'parts/status/playlist.js', 'app/parts/status/playlist.js']),
  ACC: pick(['account.js', 'parts/account/account.js', 'app/parts/account/account.js']),
  PUB: pick(['api-public-reads.js', 'parts/shared/api-public-reads.js', 'app/parts/shared/api-public-reads.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js']),
  AC: pick(['api-client.js', 'parts/shared/api-client.js', 'app/parts/shared/api-client.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w.TwPlaylistApi; };
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');

const tr = (id, title) => ({ videoId: id, title });
const serverSet = (name, ...t) => ({ name, tracks: t });
const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : 'request' });

/* 가짜 authed — 부른 것을 적고, 길마다 정한 답을 낸다 */
function fake(routes){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    const key = method + ' ' + path.split('?')[0];
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key];
    const v = typeof r === 'function' ? r(body, path, log.filter((x) => x.method === method && x.path === path).length) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), put: (p, b, o) => run('PUT', p, b, o) };
}
const mkApi = (src, routes, rnd) => {
  const authed = fake(routes), warns = [];
  const m = load(src).createPlaylistApi({ authed, random: () => (rnd == null ? 0 : rnd), warn: (...a) => warns.push(a.join(' ')) });
  return { m, authed, warns };
};
const LIB_CREATE = (src, deps) => load(src).createPlaylistApi(deps);
const MINE = (over) => Object.assign({
  sets: [serverSet('A', tr('aaaaaaaaaaa', '가'), tr('bbbbbbbbbbb', '')), serverSet('', ), serverSet('C', tr('ccccccccccc', '다'))],
  bio: '안녕', listed: true, homePublic: true, version: 7,
}, over || {});

async function judge(S){
  const LIB = S.API;

  say('── 1. 읽기');
  {
    const { m, authed } = mkApi(LIB, { 'GET /v1/me/playlist': MINE() });
    const r = await m.fetchMine('ME01');
    chk(authed.log[0].path === '/v1/me/playlist' && authed.log[0].opts && authed.log[0].opts.auth === true, '내 목록 — 내 길(/v1/me/playlist) · 로그인 통로로 부른다(내 코드는 경로에 안 실린다)');
    chk(r.sets.length === 3 && r.sets[0].name === 'A' && r.sets[0].items.length === 2 && r.sets[0].items[0].id === 'aaaaaaaaaaa' && r.sets[0].items[0].title === '가', '  tracks[{videoId,title}] → items[{id,title}]');
    chk(r.sets[1].items.length === 0 && r.sets[2].items[0].title === '다' && r.bio === '안녕' && r.homePublic === true, '  빈 벌 · 한마디 · 마이홈 공개');
    chk(r.private === false && !('editTs' in r), '  listed → private 는 반대 · 고친 시각 칸은 없다(서버 원본)');
    const p = mkApi(LIB, { 'GET /v1/me/playlist': MINE({ listed: false }) });
    chk((await p.m.fetchMine('ME01')).private === true, '  목록에 올리지 않음(listed:false) → private:true');
  }
  {
    const empty = MINE({ sets: [serverSet('', ), serverSet('', ), serverSet('', )], bio: '', homePublic: false, version: 0 });
    const { m } = mkApi(LIB, { 'GET /v1/me/playlist': empty });
    const r = await m.fetchMine('ME01');
    chk(r && r.sets.length === 3 && r.sets.every((s) => s.items.length === 0), '★ 비어 있음 — 객체로 돌려준다(못 읽음 null 과 다르다)');
    let thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/me/playlist': apiErr(503, 'RTDB_UNAVAILABLE') }).m.fetchMine('ME01'); }catch(e){ thrown = e; }
    chk(thrown && thrown.status === 503, '★ 못 읽음 — 던진다(빈 목록으로 오해하지 않게)');
    thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/me/playlist': { sets: 'x', listed: true, version: 1 } }).m.fetchMine('ME01'); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'SHAPE', '  모양이 틀린 응답 — 던진다(SHAPE)');
    thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/me/playlist': { sets: [], listed: true } }).m.fetchMine('ME01'); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'SHAPE', '  판(version)이 없는 응답 — 던진다');
    thrown = null;
    try{ await mkApi(LIB, {}).m.fetchMine(''); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'NO_USER', '  내 코드가 없으면 부르기 전에 던진다(얼리 리턴)');
  }
  {
    const pickData = { userCode: 'uFRIEND', displayName: '민서', setNo: 2, set: serverSet('좋아', tr('ddddddddddd', '곡')), bio: '한마디', homePublic: false };
    const { m, authed } = mkApi(LIB, { 'GET /v1/playlists/random': pickData });
    const r = await m.fetchRandom('uOLD');
    chk(authed.log[0].path === '/v1/playlists/random?exclude=uOLD' && authed.log[0].opts.auth === true, '무작위 — 방금 본 사람은 exclude 로(내 코드는 안 싣는다 · 서버가 토큰으로 뺀다)');
    chk(r.uid === 'uFRIEND' && r.name === '민서' && r.setName === '좋아' && r.setIdx === 2 && r.items[0].id === 'ddddddddddd' && r.bio === '한마디' && r.homePublic === false, '  Pick → 화면 모양(uid · name · items · setName · setIdx)');
    await m.fetchRandom(null);
    chk(authed.log[1].path === '/v1/playlists/random', '  제외할 사람이 없으면 물음표 없이');
    const n = mkApi(LIB, { 'GET /v1/playlists/random': null });
    chk((await n.m.fetchRandom(null)) === null, '★ 들을 것 없음(data:null) — null(실패 아님)');
    const noName = mkApi(LIB, { 'GET /v1/playlists/random': Object.assign({}, pickData, { displayName: '' }) });
    chk((await noName.m.fetchRandom(null)).name === '(이름 없음)', '  이름이 비면 «(이름 없음)»');
    let thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/playlists/random': apiErr(503, 'PLAYLIST_NOT_READY') }).m.fetchRandom(null); }catch(e){ thrown = e; }
    chk(thrown && thrown.status === 503, '★ 실패 — 던진다(null 과 다르다)');
    thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/playlists/random': Object.assign({}, pickData, { set: serverSet('x') }) }).m.fetchRandom(null); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'SHAPE', '  곡 없는 Pick(서버 규칙 위반) — 던진다');
  }

  say('── 2. 남의 목록');
  {
    const pub = { userCode: 'uF/1', sets: [serverSet('a', tr('aaaaaaaaaaa', 'x')), serverSet('b'), serverSet('c', tr('ccccccccccc', 'z'))], bio: 'b', homePublic: true };
    const lo = mkApi(LIB, { 'GET /v1/playlists/uF%2F1': pub }, 0);
    const r0 = await lo.m.fetchOf('uF/1');
    chk(lo.authed.log[0].path === '/v1/playlists/uF%2F1' && lo.authed.log[0].opts.auth === true, '경로의 코드는 주소로만 쓴다(인코딩) · 로그인 통로');
    chk(r0.uid === 'uF/1' && r0.setIdx === 0 && r0.setName === 'a' && r0.items[0].id === 'aaaaaaaaaaa' && r0.bio === 'b' && r0.homePublic === true && !('name' in r0), '  random=0 → 곡 있는 첫 벌 · 이름은 안 싣는다(부르는 쪽이 친구 이름을 가짐)');
    const hi = mkApi(LIB, { 'GET /v1/playlists/uF%2F1': pub }, 0.999999);
    const r1 = await hi.m.fetchOf('uF/1');
    chk(r1.setIdx === 2 && r1.setName === 'c', '  random→1 미만 끝 → 곡 있는 마지막 벌(빈 벌 건너뜀 · 범위 밖 없음)');
    const mid = mkApi(LIB, { 'GET /v1/playlists/uF%2F1': pub }, 0.5);
    chk((await mid.m.fetchOf('uF/1')).setIdx === 2, '  0.5 → 곡 있는 두 벌 중 두 번째(번호는 서버 칸 번호 그대로)');
    const none = mkApi(LIB, { 'GET /v1/playlists/uF': { userCode: 'uF', sets: [serverSet('a'), serverSet('b'), serverSet('c')], bio: '', homePublic: false } });
    chk((await none.m.fetchOf('uF')) === null, '★ 곡 있는 벌이 없다 — null(실패 아님)');
    const fo = mkApi(LIB, { 'GET /v1/playlists/uF': apiErr(403, 'PLAYLIST_FRIENDS_ONLY') });
    chk((await fo.m.fetchOf('uF')) === null, '★ 열어 주지 않음(PLAYLIST_FRIENDS_ONLY) — null');
    const nf = mkApi(LIB, { 'GET /v1/playlists/uF': apiErr(404, 'USER_NOT_FOUND') });
    chk((await nf.m.fetchOf('uF')) === null, '★ 없는 사용자(404 USER_NOT_FOUND) — null(«공개한 목록 없음» 갈래 · 연결 문제가 아니다)');
    let thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/playlists/uF': apiErr(500, 'INTERNAL') }).m.fetchOf('uF'); }catch(e){ thrown = e; }
    chk(thrown && thrown.status === 500, '★ 그 밖의 실패 — 던진다');
    thrown = null;
    try{ await mkApi(LIB, { 'GET /v1/playlists/uF': { userCode: 'uF', sets: 5 } }).m.fetchOf('uF'); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'SHAPE', '  모양 틀림 — 던진다');
    thrown = null;
    try{ await mkApi(LIB, {}).m.fetchOf(''); }catch(e){ thrown = e; }
    chk(thrown && thrown.code === 'NO_USER', '  코드가 비면 부르기 전에 던진다');
  }

  say('── 3. 저장');
  const readyApi = async (routes, uid) => { const x = mkApi(LIB, routes); await x.m.fetchMine(uid || 'ME01'); x.authed.log.length = 0; return x; };
  {
    const sets = [{ name: 'A', items: [{ id: 'aaaaaaaaaaa', title: '가' }] }, { name: '', items: [] }, { name: 'C', items: [] }];
    const { m, authed } = await readyApi({ 'GET /v1/me/playlist': MINE({ version: 7 }), 'PUT /v1/me/playlist': (b) => MINE({ version: b.version + 1 }) });
    const ok = await m.saveMine('ME01', sets, { bio: '소개', homePublic: true, private: false });
    const put = authed.log.find((x) => x.method === 'PUT');
    chk(ok === 'ok' && authed.log.length === 1 && put, '읽은 판으로 바로 PUT(저장 전에 몰래 읽지 않는다)');
    chk(put.path === '/v1/me/playlist' && put.body.version === 7 && put.body.listed === true && put.body.homePublic === true && put.body.bio === '소개', '  본문 — version · listed(=private 의 반대) · homePublic · bio');
    chk(put.body.sets.length === 3 && put.body.sets[0].tracks[0].videoId === 'aaaaaaaaaaa' && put.body.sets[0].tracks[0].title === '가' && put.body.sets[0].name === 'A' && put.body.sets[1].tracks.length === 0, '  items{id,title} → tracks{videoId,title} · 빈 벌도 보낸다');
    await m.saveMine('ME01', sets, { bio: '', homePublic: false, private: true });
    const puts = authed.log.filter((x) => x.method === 'PUT');
    chk(authed.log.every((x) => x.method === 'PUT') && puts[1].body.version === 8 && puts[1].body.listed === false, '  저장이 돌려준 판(8)을 기억해 다음 저장에 싣는다 · 비공개는 listed:false');
    const other = await m.saveMine('ME02', sets, {});
    chk(other === 'failed' && authed.log.length === 2, '★ 판은 계정별 — 읽은 적 없는 다른 계정은 앞 계정 판으로 보내지 않고 안 보낸다');
    chk((await m.saveMine('', sets, {})) === 'failed' && authed.log.length === 2, '  내 코드가 없으면 보내지 않고 failed');
  }
  {
    const big = { name: '가'.repeat(30), items: Array.from({ length: 25 }, (_, i) => ({ id: 'v' + String(i).padStart(10, '0'), title: '가'.repeat(80) })) };
    const { m, authed } = await readyApi({ 'GET /v1/me/playlist': MINE(), 'PUT /v1/me/playlist': MINE() });
    await m.saveMine('ME01', [big, big, big, big], { bio: '나'.repeat(200) });
    const b = authed.log.find((x) => x.method === 'PUT').body;
    chk(b.sets.length === 3 && b.sets[0].tracks.length === 20 && b.sets[0].name.length === 16 && b.sets[0].tracks[0].title.length === 60 && b.bio.length === 140, '경계 — 4벌→3벌 · 곡 25→20 · 이름 16자 · 제목 60자 · 한마디 140자(서버 상한)');
    await m.saveMine('ME01', [{ name: '', items: [{ id: '', title: 'x' }, null, { id: 'ok', title: 7 }] }], null);
    const b2 = authed.log.filter((x) => x.method === 'PUT')[1].body;
    chk(b2.sets[0].tracks.length === 1 && b2.sets[0].tracks[0].videoId === 'ok' && b2.sets[0].tracks[0].title === '' && b2.listed === true && b2.homePublic === false, '  id 없는 곡은 버림 · 제목이 문자열이 아니면 빈 값 · meta 가 없으면 올림/마이홈 비공개');
  }
  {
    const empty = [{ name: '', items: [] }, { name: '', items: [] }, { name: '', items: [] }];
    const { m, authed } = await readyApi({ 'GET /v1/me/playlist': MINE(), 'PUT /v1/me/playlist': MINE() });
    await m.saveMine('ME01', empty, { bio: '남김', homePublic: true });
    const b = authed.log.find((x) => x.method === 'PUT').body;
    chk(b.sets.length === 3 && b.sets.every((s) => s.tracks.length === 0) && b.bio === '남김', '비움 — 노드를 지우지 않고 빈 세 벌 + 한마디를 저장(지우는 길이 없다)');
  }
  {
    const one = [{ name: '', items: [] }];
    const c = await readyApi({ 'GET /v1/me/playlist': MINE({ version: 3 }), 'PUT /v1/me/playlist': apiErr(409, 'CONCURRENT_UPDATE') });
    const r = await c.m.saveMine('ME01', one, {});
    chk(r === 'conflict' && c.authed.log.length === 1 && c.warns.length === 0, '★ 409(다른 기기가 먼저) — \'conflict\' 를 돌려주고 다시 보내지 않는다(남의 고침을 덮지 않는다)');
    chk((await c.m.saveMine('ME01', one, {})) === 'failed' && c.authed.log.length === 1, '  충돌 뒤 서버 것을 다시 읽기 전에는 판이 없어 보내지 않는다');
    await c.m.fetchMine('ME01');
    chk((await c.m.saveMine('ME01', one, {})) === 'conflict' && c.authed.log.filter((x) => x.method === 'PUT').length === 2, '  다시 읽으면(fetchMine) 새 판으로 다시 보낼 수 있다');
    const bad = await readyApi({ 'GET /v1/me/playlist': MINE(), 'PUT /v1/me/playlist': apiErr(400, 'PLAYLIST_INVALID') });
    chk((await bad.m.saveMine('ME01', one, {})) === 'failed' && bad.authed.log.length === 1 && bad.warns.length === 1, '  409 가 아닌 실패(400)는 다시 안 보내고 failed + 진단 한 줄');
    const noV = await readyApi({ 'GET /v1/me/playlist': MINE(), 'PUT /v1/me/playlist': { ok: 1 } });
    chk((await noV.m.saveMine('ME01', one, {})) === 'failed', '  저장 답에 판이 없으면(모양 틀림) failed');
  }

  {
    /* 읽은 뒤 로그인한 사람이 바뀌면 — 진짜 API 통로(api-client.js)로 보내기 직전에 막힌다 */
    const AC = (() => { const mod = { exports: {} }; new Function('module', 'window', S.AC)(mod, undefined); return mod.exports; })();
    const jwt = (sub) => 'h.' + Buffer.from(JSON.stringify({ sub })).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.s';
    const reply = (status, data) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => ({ success: true, data }) });
    const methods = [], tk = { v: jwt('A') };
    const client = AC.createApiClient({ baseUrl: 'https://api.test', getToken: async () => tk.v,
      fetch: async (url, init) => { methods.push(init.method); return init.method === 'PUT' ? reply(200, MINE({ version: 8 })) : reply(200, MINE({ version: 7 })); } });
    const warns = [];
    const m = LIB_CREATE(LIB, { authed: client, random: () => 0, warn: (...a) => warns.push(a.join(' ')) });
    await m.fetchMine('ME01');
    const sets1 = [{ name: 'A', items: [{ id: 'aaaaaaaaaaa', title: '가' }] }];
    chk((await m.saveMine('ME01', sets1, {})) === 'ok' && methods.join() === 'GET,PUT', '같은 사람이면 그대로 올라간다(읽은 토큰 주인과 같음)');
    tk.v = jwt('B');
    const r = await m.saveMine('ME01', sets1, {});
    chk(r === 'stale' && methods.join() === 'GET,PUT' && warns.length === 0, '★ 읽은 뒤 토큰 주인이 바뀌면(A→B) PUT 을 보내지 않고 \'stale\' (진단 로그도 안 남김)');
    chk((await m.saveMine('ME01', sets1, {})) === 'failed' && methods.length === 2, '  그 뒤엔 읽은 판이 없어 보내지 않는다(다시 받기 전까지)');
    await m.fetchMine('ME01');
    chk((await m.saveMine('ME01', sets1, {})) === 'ok' && methods.join() === 'GET,PUT,GET,PUT', '  새 주인(B)으로 다시 받으면 그 주인으로 올라간다');
  }

  say('── 4. 배선');
  {
    const FI = strip(S.FI), PL = strip(S.PL), ACC = strip(S.ACC), PUB = strip(S.PUB), APP = strip(S.APP);
    const OLD = ['publishMyPlaylist', 'removeMyPlaylist', 'fetchMyPlaylistSets', 'fetchRandomPlaylist', 'fetchPlaylistOf', '_plPickSet'];
    chk(OLD.every((n) => FI.indexOf(n) < 0), 'firebase-init.js 에 옛 플레이리스트 메서드(내 목록 · 무작위 · 친구)가 없다');
    chk(OLD.every((n) => PL.indexOf('firebaseAPI.' + n) < 0 && ACC.indexOf('firebaseAPI.' + n) < 0 && PUB.indexOf(n) < 0), '부르는 곳(playlist.js · account.js · api-public-reads.js)이 옛 메서드를 안 부른다');
    chk(/playlistApi:\s*TwPlaylistApi\.createPlaylistApi\(\{[^}]*authed:\s*TwApi\.authed/.test(APP.replace(/\s+/g, ' ')) || /createPlaylistApi\(\{[^}]*authed:\s*TwApi\.authed/.test(APP.replace(/\s+/g, ' ')), 'app.js 가 로그인 통로(TwApi.authed)로 provider 를 만든다');
    chk(/const plApi = deps\.playlistApi;/.test(PL) && ['fetchMine(', 'saveMine(', 'fetchRandom(', 'fetchOf('].every((n) => PL.indexOf('plApi.' + n) > 0) && !/playlistApi|plApi/.test(ACC) && /plMod\.reset\(\);\s*plMod\.pull\(\);/.test(ACC), 'playlist.js 가 deps 로 받은 provider 를 부른다(받기 · 올리기 · 파도타기 둘) · account.js 는 provider 를 몰라서 plMod.reset → pull 만 부른다');
    chk(PL.indexOf('firebaseAPI.fetchPlaylistCard') >= 0 || PL.indexOf('fetchPlaylistCard') >= 0, '명함(fetchPlaylistCard)은 이번 묶음 밖 — 그대로 남아 있다');
    const h = S.HTML, i1 = h.indexOf('<script src="parts/status/playlist-api.js">'), i2 = h.indexOf('<script src="parts/status/playlist.js">'), i3 = h.indexOf('<script src="parts/app.js">');
    chk(i1 > 0 && i1 < i2 && i2 < i3, 'html — playlist-api.js 가 playlist.js · app.js 보다 먼저');
    chk(/PRELOAD\.push\('playlist-api\.js'\)/.test(S.SMOKE) && S.SMOKE.indexOf("'playlist-api.js'") < S.SMOKE.indexOf("PRELOAD.push('playlist.js')"), 'smoke PRELOAD — playlist-api.js 가 playlist.js 보다 먼저');
    chk(!/\btypeof\s+\w+\s*===\s*'function'/.test(strip(S.API)) && !/firebase/i.test(strip(S.API)), 'provider 는 Firebase 를 모르고 «있으면 부르기» 가드가 없다');
  }
}

(async () => {
  await judge(SRC0);

  say('── 5. 일부러 깨 보기');
  const BREAKS = [
    ['API', "  return { sets, bio: str(d.bio), homePublic: d.homePublic === true, private: !d.listed };", "  return { sets, bio: str(d.bio), homePublic: d.homePublic === true, private: !!d.listed };", 'listed 를 거꾸로 읽음'],
    ['API', "  return { version, sets: ss, bio: str(m.bio).slice(0, LIMITS.BIO), listed: !m.private, homePublic: !!m.homePublic };", "  return { version, sets: ss, bio: str(m.bio).slice(0, LIMITS.BIO), listed: !!m.private, homePublic: !!m.homePublic };", 'private 를 거꾸로 저장'],
    ['API', "    .map((x) => ({ videoId: x.id, title: str(x.title).slice(0, LIMITS.TITLE) })),", "    .map((x) => ({ id: x.id, title: str(x.title).slice(0, LIMITS.TITLE) })),", '저장에 tracks.videoId 대신 id'],
    ['API', "((s && Array.isArray(s.items)) ? s.items : []).slice(0, LIMITS.TRACKS)", "((s && Array.isArray(s.items)) ? s.items : [])", '곡 20개 상한을 안 깎음'],
    ['API', "const ss = (Array.isArray(sets) ? sets : []).slice(0, LIMITS.SETS).map", "const ss = (Array.isArray(sets) ? sets : []).map", '프리셋 3벌 상한을 안 깎음'],
    ['API', "    name: str(s && s.name).slice(0, LIMITS.NAME),", "    name: str(s && s.name),", '프리셋 이름 16자를 안 깎음'],
    ['API', "      if(!versions.has(uid)) throw Object.assign(new Error('읽은 판 없음'), { code: 'NO_VERSION' });   // 받기 전에는 올리지 않는다\n", "      if(!versions.has(uid)) versions.set(uid, 0);\n", '판을 모르면서 0 으로 보냄'],
    ['API', "      if(e && e.status === CONFLICT_STATUS){ versions.delete(uid); return 'conflict'; }", "      if(e && e.status === CONFLICT_STATUS){ return 'conflict'; }", '충돌 뒤에도 옛 판으로 보냄'],
    ['API', "      if(e && e.status === CONFLICT_STATUS){ versions.delete(uid); return 'conflict'; }", "      if(e && e.status === CONFLICT_STATUS){ versions.delete(uid); return 'failed'; }", '충돌을 일반 실패로 뭉갬'],
    ['API', "  const versions = new Map();", "  let single; const versions = { has: () => single !== undefined, get: () => single, set: (u, v) => { single = v; }, delete: () => { single = undefined; } };", '판을 계정별로 안 기억함'],
    ['API', "    if(d === null) return null;\n    const out = pickOf(d);", "    const out = pickOf(d);", '들을 것 없음(null)을 실패로 봄'],
    ['API', "catch(e){ if(e && (e.code === FRIENDS_ONLY_CODE || e.code === USER_NOT_FOUND_CODE)) return null; throw e; }", "catch(e){ throw e; }", '열어 주지 않음을 실패로 던짐'],
    ['API', " || e.code === USER_NOT_FOUND_CODE", "", '없는 사용자를 연결 문제로 던짐'],
    ['API', "      warn('[플레이리스트] 저장 실패', (e && (e.code || e.message)) || e);\n      return 'failed';", "      return 'ok';", '저장 실패를 성공으로 알림'],
    ['API', "  sets.forEach((s, i) => { if(s.items.length) cand.push({ idx: i, name: s.name, items: s.items }); });", "  sets.forEach((s, i) => { cand.push({ idx: i, name: s.name, items: s.items }); });", '빈 벌도 후보에 넣음'],
    ['API', "Math.min(cand.length - 1, Math.floor(random() * cand.length))", "Math.floor(random() * cand.length) + 1", '고르는 번호가 범위 밖'],
    ['API', "  return { uid: d.userCode, name: str(d.displayName) || '(이름 없음)'", "  return { uid: d.userCode, name: str(d.displayName)", '이름이 비면 빈 칸'],
    ['API', "    if(!uid){ const e = new Error('내 코드 없음'); e.code = 'NO_USER'; throw e; }\n    return readMine(uid);", "    return readMine(uid);", '내 코드 없이도 읽음'],
    ['API', "    const path = PATHS.random + (excludeUid ? '?exclude=' + encodeURIComponent(excludeUid) : '');", "    const path = PATHS.random;", '방금 본 사람을 제외하지 않음'],
    ['API', "  of: (userCode) => '/v1/playlists/' + encodeURIComponent(userCode),", "  of: (userCode) => '/v1/playlists/' + userCode,", '남의 코드를 인코딩 없이 경로에'],
    ['API', "    versions.set(uid, { v, owner });\n    return out;", "    return out;", '읽은 판을 기억하지 않음'],
    ['API', "{ expectOwner: read.owner }", "{}", '쓰기를 읽은 토큰 주인과 안 묶음'],
    ['API', "      if(e && e.code === OWNER_CHANGED_CODE){ versions.delete(uid); return 'stale'; }", "", '주인이 바뀌어 막힌 것을 실패로 알림'],
    ['API', "onOwner: (who) => { owner = who; }", "onOwner: () => {}", '읽을 때 토큰 주인을 기억하지 않음'],
    ['PL', "const plApi = deps.playlistApi;", "const plApi = { fetchMine: async () => null, saveMine: async () => true, fetchRandom: async () => null, fetchOf: async () => null };", '부르는 곳이 provider 를 안 씀'],
    ['FI', "    async lookupFriendCode(code){", "    async fetchPlaylistOf(uid){ return null; },\n    async lookupFriendCode(code){", 'firebase-init 에 옛 친구 파도타기가 되살아남'],
    ['HTML', '<script src="parts/status/playlist-api.js"></script>', '', 'html 에서 provider 를 안 실음'],
    ['SMOKE', "PRELOAD.push('playlist-api.js');", "", 'smoke 가 provider 를 안 싣음'],
  ];
  const caught = [];
  for(const [where, from, to, what] of BREAKS){
    if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
    const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
    quiet = true; qfail = 0;
    let hung = false;
    try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { hung = true; r(); }, 3000))]); }catch(_){ qfail++; }
    if(hung) qfail++;
    quiet = false;
    caught.push([what, qfail]);
  }
  const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
  chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

  console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
