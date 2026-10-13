/* ═══ 🌐 sim-api-public-reads.js — 공개 읽기를 API 사본에서 먼저(api-public-reads.js) ═══════════════
   [왜] 파도타기 · 명함 · 사진 · 랭킹 · 방 개수(표시) · 랜덤 참여 후보를 API 에서 먼저 읽고, 못 받으면 지금 Firebase 길 그대로.
   1. 파도타기 무작위 · 친구 지목 — 모양 같음 · data:null = 없음(Firebase 안 감) · 실패 · 모양 틀림 → 원래 함수(같은 인자)
   2. 명함 · 사진 — avatarUrl · avatarInline(그때만 Firebase 한 칸) · 파도타기에 실려 온 명함 기억 · 실패 → 원래 함수 / Firebase 한 칸
   3. 랭킹 — 내 순위 한 줄(rank · null · 못 받음 undefined) · 100줄(API → 원래 함수)
   4. 방 개수 — 표시용(quick)만 API · 정원 검사(quick 아님)는 늘 Firebase · 랜덤 참여 후보(워킹룸 · SCRT 빼기 · 빈 배열 = 없음)
   5. 실패 종류 — 닿지 못함 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · API 없음 모두 Firebase 길
   6. 배선 — firebase-init(import · firebase-ready 전에 wrap) · app.js 사진 두 곳 · 내 순위 · 모듈은 import 없음
   [실행] 러너 스테이징(평평한 폴더) 또는 checks/ 에서. */
'use strict';
const _MI_JOIN = require('./sim-renderer-src.js').joinRenderer;   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const DIRS = ['.', 'parts', 'app', path.join('app', 'parts'), '..', path.join('..', 'app'), path.join('..', 'app', 'parts')];
const read = (f) => { for(const d of DIRS){ try{ return fs.readFileSync(path.join(d, f), 'utf8'); }catch(_){} } return null; };
const SRC = read('api-public-reads.js'), FI = read('firebase-init.js'), APP = _MI_JOIN(read('app.js')), AC = read('api-client.js');
for(const [n, v] of [['api-public-reads.js', SRC], ['firebase-init.js', FI], ['app.js', APP], ['api-client.js', AC]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const names = [...SRC.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const M = new Function(SRC.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();
const A = new Function('module', 'window', AC + '\nreturn module.exports;')({ exports: {} }, undefined);
function takeFn(src, head){
  const i = src.indexOf(head); if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ const c = src[j]; if(c === '{') d++; else if(c === '}'){ d--; if(d === 0) return src.slice(i, j + 1); } }
  return null;
}

/* 가짜 API — routes(path) → 값 | Error(던짐). 부른 경로를 적는다. */
const mkApi = (routes) => { const calls = []; return { calls, get: async (p) => { calls.push(p); const v = routes(p); if(v instanceof Error) throw v; return v; } }; };
const ERR = (kind, status, code) => new A.ApiError(kind, status, code);
/* 가짜 firebaseAPI — 원래 함수는 부른 인자를 적고 «FB» 표시가 붙은 값을 돌려준다. */
function mkFb(){
  const log = [];
  const fb = {
    _plPickSet(){ return null; },
    async fetchRandomPlaylist(a, b){ log.push(['random', a, b, this === fb]); return { uid: 'fbU', name: 'FB', items: [{ id: 'x', title: 't' }], setName: '', setIdx: 0, bio: '', homePublic: false, FB: 1 }; },
    async fetchPlaylistOf(u){ log.push(['of', u]); return { uid: u, items: [{ id: 'y', title: '' }], setName: '', setIdx: 0, bio: '', homePublic: false, FB: 1 }; },
    async fetchPlaylistCard(u){ log.push(['card', u]); return { name: 'FB', level: 3, avatar: 'fb.png', FB: 1 }; },
    async fetchLeaderboardTop(){ log.push(['top']); return [{ uid: 'u1', sec: 9, ts: 1, FB: 1 }]; },
    async getRoomCounts(o){ log.push(['counts', !!(o && o.quick)]); return { total: 1, workingroom: 1, togetherroom: 0, FB: 1 }; },
    async findRandomRooms(n){ log.push(['rooms', n]); return ['WORK-FBFB']; },
    getMyHome(){ throw new Error('home 통째 읽기는 쓰지 않는다'); },
  };
  return { fb, log };
}
const SET = { idx: 1, name: '퇴근길', items: [{ id: 'aaa', title: '곡1' }, { id: 'bbb', title: '곡2' }, { bad: 1 }] };
const CARD = { name: '라온', level: 12, cyc: 1, clv: 3, starC: 'gold', avatarUrl: 'https://img/av.png', avatarInline: false };

(async () => {
  say('── 1. 파도타기');
  {
    let cells = [];
    const api = mkApi((p) => p.startsWith('/v1/playlists/random') ? { uid: 'uR', name: '라온', set: SET, bio: '소개', homePublic: true, card: CARD }
      : p === '/v1/users/uF/playlist' ? { uid: 'uF', name: '친구', set: SET, bio: '', homePublic: false, card: null }
      : p === '/v1/users/uN/playlist' ? null : new Error('?'));
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api, readCell: async (c) => { cells.push(c); return null; } }).wrap(fb);
    const r = await fb.fetchRandomPlaylist('uMe', 'uPrev');
    chk(api.calls[0] === '/v1/playlists/random?exclude=uMe,uPrev' && log.length === 0, '★ 무작위 — GET /v1/playlists/random?exclude=나,방금 본 사람 · Firebase 안 읽음');
    chk(r.uid === 'uR' && r.name === '라온' && r.setName === '퇴근길' && r.setIdx === 1 && r.bio === '소개' && r.homePublic === true && r.items.length === 2 && r.items[0].id === 'aaa' && r.items[0].title === '곡1' && !('FB' in r),
      '  ↳ 돌려주는 모양이 원래 함수와 같다(uid · name · items[{id,title}] · setName · setIdx · bio · homePublic · 깨진 곡 줄 빼기)');
    await fb.fetchRandomPlaylist(null, undefined);
    chk(api.calls[1] === '/v1/playlists/random', '  ↳ 뺄 사람이 없으면 exclude 없이');
    const many = M.createApiPublicReads({ api: mkApi(() => null) }).wrap(mkFb().fb);
    chk(M.EXCLUDE_MAX === 10, '  ↳ exclude 는 서버 상한 10');
    chk((await many.fetchRandomPlaylist('a/b', 'c,d')) === null, '★ data:null = 들을 것 없음 → null(Firebase 로 다시 가지 않음)');
    const o = await fb.fetchPlaylistOf('uF');
    chk(o.uid === 'uF' && o.setName === '퇴근길' && o.items.length === 2 && !('name' in o) && log.length === 0, '★ 친구 지목 — GET /v1/users/{uid}/playlist · 이름은 싣지 않음(원래 함수와 같음 — 부르는 쪽이 친구 목록 이름을 쓴다)');
    chk((await fb.fetchPlaylistOf('uN')) === null && log.length === 0, '  ↳ 공개한 목록 없음(data:null) → null · Firebase 안 감');
    const c1 = await fb.fetchPlaylistCard('uR');
    chk(api.calls.filter((p) => p.indexOf('/card') >= 0).length === 0 && c1.name === '라온' && c1.avatar === 'https://img/av.png', '★ 파도타기 응답에 실려 온 명함을 기억 — 바로 뒤 명함은 요청 없음');
    const fb2 = mkFb();
    M.createApiPublicReads({ api: mkApi(() => ({ uid: 'u', set: { idx: 0, items: [] } })) }).wrap(fb2.fb);
    const r2 = await fb2.fb.fetchRandomPlaylist('uMe', 'uX');
    chk(r2.FB === 1 && fb2.log[0][0] === 'random' && fb2.log[0][1] === 'uMe' && fb2.log[0][2] === 'uX' && fb2.log[0][3] === true, '  ↳ 모양이 틀리면(곡 없음) 원래 함수를 같은 인자 · 같은 this 로');
  }

  say('── 2. 명함 · 사진');
  {
    let cells = [];
    const api = mkApi((p) => p === '/v1/users/uA/card' ? CARD : p === '/v1/users/uI/card' ? Object.assign({}, CARD, { avatarUrl: null, avatarInline: true })
      : p === '/v1/users/uZ/card' ? null : p === '/v1/users/uBad/card' ? 'x' : ERR('unavailable', 0, 'NETWORK'));
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api, readCell: async (c) => { cells.push(c); return 'data:image/png;base64,AAA'; } }).wrap(fb);
    const c = await fb.fetchPlaylistCard('uA');
    chk(c.name === '라온' && c.level === 12 && c.cyc === 1 && c.clv === 3 && c.starC === 'gold' && c.avatar === 'https://img/av.png' && cells.length === 0 && log.length === 0,
      '★ 명함 — GET /v1/users/{uid}/card → { name · level · cyc · clv · starC · avatar }(원래 모양) · Firebase 안 읽음');
    const ci = await fb.fetchPlaylistCard('uI');
    chk(ci.avatar === 'data:image/png;base64,AAA' && cells.join() === 'users/uI/home/avatar', '★ avatarInline 이면 그때만 Firebase users/{uid}/home/avatar 한 칸');
    const cz = await fb.fetchPlaylistCard('uZ');
    chk(cz.name === null && cz.level === null && cz.avatar === null && log.length === 0, '  ↳ 없는 사람(data:null) → 빈 명함(원래 함수와 같은 모양) · Firebase 안 감');
    const cf = await fb.fetchPlaylistCard('uDown');
    chk(cf.FB === 1 && log.join() === 'card,uDown', '  ↳ 못 받으면 원래 함수(profile + home/avatar)');
    await fb.fetchPlaylistCard('uBad');
    chk(log.length === 2 && log[1][1] === 'uBad', '  ↳ 모양이 틀려도 원래 함수');
    cells = [];
    chk((await fb.fetchAvatar('uA')) === 'https://img/av.png' && cells.length === 0, '★ 사진 하나(fetchAvatar) — 명함의 avatarUrl · home 통째 읽기 없음');
    chk((await fb.fetchAvatar('uZ')) === null && cells.length === 0, '  ↳ 없는 사람 → null');
    const av = await fb.fetchAvatar('uDown');
    chk(av === 'data:image/png;base64,AAA' && cells.join() === 'users/uDown/home/avatar', '★ API 를 못 받으면 Firebase home/avatar 한 칸(예전 home 통째보다 작다)');
    chk((await fb.fetchAvatar(null)) === null, '  ↳ 코드가 없으면 null');
    const o = mkFb(); const oc = [];
    o.fb.fetchAvatar = async (u) => { oc.push(u); return 'fb-av'; }; o.fb.fetchMyRank = async () => undefined;
    M.createApiPublicReads({ api: mkApi(() => ERR('unavailable', 0, 'NETWORK')), readCell: async () => 'cell' }).wrap(o.fb);
    chk((await o.fb.fetchAvatar('uQ')) === 'fb-av' && oc.join() === 'uQ' && (await o.fb.fetchMyRank('uQ')) === undefined, '  ↳ firebase-init 의 원래 fetchAvatar · fetchMyRank 가 있으면 그것이 대체 길');
  }

  say('── 3. 랭킹');
  {
    const api = mkApi((p) => p === '/v1/leaderboard/rank/u1' ? { uid: 'u1', rank: 7, sec: 99 } : p === '/v1/leaderboard/rank/u2' ? { uid: 'u2', rank: null, sec: null }
      : p === '/v1/leaderboard/rank/u3' ? { uid: 'u3', rank: 0 } : p.startsWith('/v1/leaderboard/top') ? { items: [{ rank: 1, uid: 'uA', sec: 50, ts: 3 }, { rank: 2, uid: 'uB', sec: '40', ts: 4 }, { bad: 1 }] }
      : ERR('notReady', 503, 'RTDB_NOT_READY'));
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api }).wrap(fb);
    chk((await fb.fetchMyRank('u1')) === 7 && (await fb.fetchMyRank('u2')) === null, '★ 내 순위 한 줄 — GET /v1/leaderboard/rank/{uid} → 7 · 표 밖 null');
    chk((await fb.fetchMyRank('u3')) === undefined && (await fb.fetchMyRank('uX')) === undefined && log.length === 0, '  ↳ 모양 틀림 · 못 받음 → undefined(부르는 쪽이 100줄 길로) — 여기서 Firebase 를 읽지 않는다');
    const top = await fb.fetchLeaderboardTop();
    chk(api.calls.includes('/v1/leaderboard/top?n=100') && top.length === 2 && top[1].sec === 40 && top[0].uid === 'uA' && !('rank' in top[0]) && log.length === 0, '  ↳ 100줄 — GET /v1/leaderboard/top?n=100 → [{uid,sec,ts}](원래 모양)');
    const f2 = mkFb(); M.createApiPublicReads({ api: mkApi(() => ERR('unavailable', 0, 'BACKOFF')) }).wrap(f2.fb);
    chk((await f2.fb.fetchLeaderboardTop())[0].FB === 1, '  ↳ 못 받으면 원래 함수(sec 정렬 100줄)');
    const lf = takeFn(APP, 'async function _lbFetchRank('), rr = takeFn(APP, 'function _miRenderRank(');
    chk(!!lf && /if\(firebaseAPI\.fetchMyRank\)\{ const r = await firebaseAPI\.fetchMyRank\(uid\); if\(r !== undefined\) return r; \}/.test(lf) && /rankOf\(rows, uid\)/.test(lf) && /_lbFetchRank\(uid\)/.test(rr || ''),
      'app.js — 내 순위는 _lbFetchRank(API 한 줄 → 못 받으면 100줄 + rankOf) · 화면 함수는 그대로');
  }

  say('── 4. 방 개수 · 랜덤 참여 후보');
  {
    const api = mkApi((p) => p === '/v1/rooms/count' ? { total: 9, workingroom: 6, togetherroom: 3, inclServer: true, source: 'roomStats', at: 1 }
      : p.startsWith('/v1/rooms/random') ? { rooms: ['WORK-AAAA', 'SCRT-BBBB', 7, 'WORK-CCCC'] } : new Error('?'));
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api }).wrap(fb);
    const q = await fb.getRoomCounts({ quick: true });
    chk(q.total === 9 && q.workingroom === 6 && q.togetherroom === 3 && q.inclServer === true && !('source' in q) && log.length === 0, '★ 화면 표시용(quick) — GET /v1/rooms/count → { total · workingroom · togetherroom · inclServer }');
    const full = await fb.getRoomCounts();
    const full2 = await fb.getRoomCounts({});
    chk(full.FB === 1 && full2.FB === 1 && api.calls.filter((p) => p === '/v1/rooms/count').length === 1 && log.length === 2, '★ 정원 · 만들기 상한 검사(quick 아님)는 API 를 묻지 않고 늘 Firebase');
    const r = await fb.findRandomRooms(12);
    chk(api.calls.includes('/v1/rooms/random?channel=workingroom&limit=12') && r.join() === 'WORK-AAAA,WORK-CCCC', '★ 랜덤 참여 후보 — 워킹룸만 · limit · SCRT- · 이상한 값 빼기(들어가기 전 확인은 app.js 그대로)');
    const e = mkFb(); M.createApiPublicReads({ api: mkApi(() => ({ rooms: [] })) }).wrap(e.fb);
    chk((await e.fb.findRandomRooms(12)).length === 0 && e.log.length === 0, '  ↳ 빈 배열 = 후보 없음(Firebase 로 다시 가지 않음)');
    const bad = mkFb(); M.createApiPublicReads({ api: mkApi(() => ({ total: 1, workingroom: -1, togetherroom: 0 })) }).wrap(bad.fb);
    chk((await bad.fb.getRoomCounts({ quick: true })).FB === 1, '  ↳ 숫자가 이상하면 원래 함수');
    const d = mkFb(); M.createApiPublicReads({ api: mkApi(() => ERR('request', 400, 'BAD_CHANNEL')) }).wrap(d.fb);
    chk((await d.fb.findRandomRooms(12))[0] === 'WORK-FBFB' && d.log[0][1] === 12, '  ↳ 못 받으면(400 포함) 원래 함수(roomIndex)');
  }

  say('── 5. 실패 종류 — 모두 Firebase 길');
  {
    const kinds = [ERR('unavailable', 0, 'NETWORK'), ERR('unavailable', 0, 'TIMEOUT'), ERR('unavailable', 0, 'BACKOFF'), ERR('notReady', 503, 'CONFIG_NOT_READY'),
      ERR('unavailable', 503, 'RTDB_UNAVAILABLE'), ERR('request', 400, 'BAD_REQUEST'), ERR('auth', 401, ''), new TypeError('x')];
    let ok = true;
    for(const k of kinds){
      const { fb, log } = mkFb();
      M.createApiPublicReads({ api: mkApi(() => k), readCell: async () => null }).wrap(fb);
      const r = [await fb.fetchRandomPlaylist('a', 'b'), await fb.fetchPlaylistOf('u'), await fb.fetchPlaylistCard('u'), await fb.fetchLeaderboardTop(), await fb.getRoomCounts({ quick: true })];
      if(!r.every((x) => x && (x.FB === 1 || (Array.isArray(x) && x[0].FB === 1))) || log.length !== 5) ok = false;
    }
    chk(ok, '★ 닿지 못함 · 시간 초과 · 쉬는 중 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · 401 · 그 밖 오류 → 원래 Firebase 함수 그대로');
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api: null }).wrap(fb);
    chk((await fb.fetchPlaylistOf('u')).FB === 1 && (await fb.findRandomRooms(3))[0] === 'WORK-FBFB' && log.length === 2, '  ↳ API 통로가 없어도(TwApi 없음) 원래 함수');
    const keep = mkFb(); const before = keep.fb.getMyHome;
    M.createApiPublicReads({ api: null }).wrap(keep.fb);
    chk(keep.fb.getMyHome === before && typeof keep.fb.fetchAvatar === 'function' && typeof keep.fb.fetchMyRank === 'function', '  ↳ 다른 함수는 건드리지 않고 fetchAvatar · fetchMyRank 를 더한다');
  }

  say('── 6. 배선');
  {
    const fi = strip(FI);
    chk(/import \{ createApiPublicReads \} from "\.\/api-public-reads\.js";/.test(FI), 'firebase-init.js 가 모듈을 들여온다');
    const iw = fi.indexOf('createApiPublicReads({ api: (window.TwApi && window.TwApi.client) || null, readCell: (path) => get(ref(db, path)).then(s => s.val()) }).wrap(window.firebaseAPI);');
    chk(iw > 0 && iw < fi.indexOf("window.dispatchEvent(new Event('firebase-ready'))") && iw > fi.indexOf('window.firebaseAPI = {'), '  ↳ firebaseAPI 를 다 만든 뒤 · firebase-ready 전에 wrap(공통 API 통로 · Firebase 한 칸 읽기)');
    const a = strip(APP);
    const s1 = takeFn(a, 'async function _refreshChatProfile('), s2 = takeFn(a, 'async function _miRenderAvatar(');
    const line = /\(firebaseAPI\.fetchAvatar \? \{ avatar: await firebaseAPI\.fetchAvatar\(getMyUserId\(\)\) \} : await firebaseAPI\.getMyHome\(getMyUserId\(\)\)\) \|\| \{\}/;
    chk(!!s1 && !!s2 && line.test(s1) && line.test(s2), '★ app.js 사진 두 곳(대화창 · 내 정보) — home 통째 대신 fetchAvatar(옛 firebaseAPI 면 예전 길)');
    const fa = takeFn(fi, 'async fetchAvatar(uid){') || '';
    chk(/get\(ref\(db, `users\/\$\{uid\}\/home\/avatar`\)\)/.test(fa) && !/home`\)/.test(fa) && /async fetchMyRank\(\)\{ return undefined; \}/.test(fi), 'firebase-init — fetchAvatar 는 home/avatar 한 칸(통째 아님) · fetchMyRank 의 Firebase 길은 undefined');
    chk(!/^\s*import\s/m.test(SRC) && !/firebase\/|gstatic|getDatabase|fetch\(/.test(strip(SRC)), 'api-public-reads.js 는 아무것도 import 하지 않는다(API · Firebase 는 deps)');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
