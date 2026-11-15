/* ═══ 🌐 sim-api-public-reads.js — 공개 읽기를 API 사본에서 먼저(api-public-reads.js) ═══════════════
   [왜] 명함을 API 한 길에서 읽는다 — 못 받으면 Firebase 로 물러나지 않고 던진다(0.13 E-2 · R4: 못 받음 + 알림).
   1. (파도타기는 로그인 길로 옮겼다 — sim-playlist-api.js. 이 모듈에 파도타기가 남지 않았는지만 본다)
   2. 명함 — avatarUrl · avatarInline(그때만 Firebase 한 칸) · 실패 → 던짐(원래 함수를 안 부름). 사진 하나(fetchAvatar) · 명함 날것(fetchUserCardApi) · 랜덤 참여 후보(findRandomRooms)는 부르는 곳이 없어 걷었다
   3. 랭킹 — 걷었다: 순위 통로(fetchMyRank · fetchLeaderboardTop)를 달지 않고 /v2/leaderboard 를 묻지 않는다
   4. 방 개수(정원 검사)는 API 를 거치지 않고 늘 Firebase · 걷은 이름(fetchAvatar · fetchUserCardApi · findRandomRooms)을 달지 않는다
   5. 실패 종류 — 닿지 못함 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · API 없음 · 사진 칸 읽기 실패 모두 던짐(Firebase 길 0)
   6. 배선 — firebase-init(import · firebase-ready 전에 wrap) · app.js 사진 두 곳 · 모듈은 import 없음
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
    async fetchPlaylistCard(u){ log.push(['card', u]); return { name: 'FB', level: 3, avatar: 'fb.png', FB: 1 }; },
    async getRoomCounts(){ log.push(['counts']); return { total: 1, workingroom: 1, togetherroom: 0, FB: 1 }; },
    getMyHome(){ throw new Error('home 통째 읽기는 쓰지 않는다'); },
  };
  return { fb, log };
}
const CARD = { name: '라온', level: 12, cyc: 1, clv: 3, starC: 'gold', avatarUrl: 'https://img/av.png', avatarInline: false };

(async () => {
  say('── 1. 파도타기는 이 모듈에 없다');
  {
    const { fb, log } = mkFb();
    const api = mkApi(() => new Error('?'));
    M.createApiPublicReads({ api }).wrap(fb);
    chk(!('fetchRandomPlaylist' in fb) && !('fetchPlaylistOf' in fb) && !('randomPlaylist' in M.API_PATHS) && !('userPlaylist' in M.API_PATHS), '★ 무작위 · 친구 지목 파도타기를 바꿔 끼우지도, 길(/v2/playlists · /v2/users/{uid}/playlist)을 갖지도 않는다');
    chk(!('playlistOf' in M) && !('EXCLUDE_MAX' in M) && !('CARD_KEEP_MS' in M) && log.length === 0 && api.calls.length === 0, '  ↳ 목록 모양 맞춤 · 명함 기억 같은 파도타기 잔재도 없다');
  }

  say('── 2. 명함 · 사진');
  {
    let cells = [];
    const api = mkApi((p) => p === '/v2/users/uA/card' ? CARD : p === '/v2/users/uI/card' ? Object.assign({}, CARD, { avatarUrl: null, avatarInline: true })
      : p === '/v2/users/uZ/card' ? null : p === '/v2/users/uBad/card' ? 'x' : ERR('unavailable', 0, 'NETWORK'));
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api, readCell: async (c) => { cells.push(c); return 'data:image/png;base64,AAA'; } }).wrap(fb);
    const c = await fb.fetchPlaylistCard('uA');
    chk(c.name === '라온' && c.level === 12 && c.cyc === 1 && c.clv === 3 && c.starC === 'gold' && c.avatar === 'https://img/av.png' && cells.length === 0 && log.length === 0,
      '★ 명함 — GET /v2/users/{uid}/card → { name · level · cyc · clv · starC · avatar }(원래 모양) · Firebase 안 읽음');
    const ci = await fb.fetchPlaylistCard('uI');
    chk(ci.avatar === 'data:image/png;base64,AAA' && cells.join() === 'users/uI/home/avatar', '★ avatarInline 이면 그때만 Firebase users/{uid}/home/avatar 한 칸');
    const cz = await fb.fetchPlaylistCard('uZ');
    chk(cz.name === null && cz.level === null && cz.avatar === null && log.length === 0, '  ↳ 없는 사람(data:null) → 빈 명함(원래 함수와 같은 모양) · Firebase 안 감');
    const rej = async (p) => { try{ await p; return null; }catch(e){ return e || new Error('?'); } };
    chk(!!(await rej(fb.fetchPlaylistCard('uDown'))) && log.length === 0, '★ ↳ 못 받으면 던진다 — 원래 함수(profile + home/avatar)로 물러나지 않는다(Firebase 읽기 0)');
    chk(!!(await rej(fb.fetchPlaylistCard('uBad'))) && log.length === 0, '  ↳ 모양이 틀려도 던진다 · Firebase 0');
    const failCell = mkFb();
    M.createApiPublicReads({ api: mkApi(() => Object.assign({}, CARD, { avatarUrl: null, avatarInline: true })), readCell: async () => { throw new Error('cell down'); } }).wrap(failCell.fb);
    chk(!!(await rej(failCell.fb.fetchPlaylistCard('uI'))), '  ↳ avatarInline 사진 칸을 못 읽어도 던진다(사진 없는 명함으로 그리지 않는다)');
  }

  say('── 3. 랭킹 — 걷었다');
  {
    const api = mkApi(() => ({ uid: 'u1', rank: 7, sec: 99 }));
    const { fb } = mkFb(); fb.fetchMyRank = async () => 'FB'; fb.fetchLeaderboardTop = async () => 'FB';
    M.createApiPublicReads({ api }).wrap(fb);
    const r = [await fb.fetchMyRank('u1'), await fb.fetchLeaderboardTop()];
    chk(r.every((x) => x === 'FB') && !api.calls.some((c) => /leaderboard/.test(c)), '★ 순위 통로를 바꿔 끼우지 않는다 — /v2/leaderboard 를 묻지 않는다');
    chk(!/leaderboard|fetchMyRank|fetchLeaderboardTop/.test(strip(SRC)), '  ↳ 모듈 글에 랭킹 경로 · 이름이 없다');
    const bare = mkFb(); M.createApiPublicReads({ api: null }).wrap(bare.fb);
    chk(!('fetchMyRank' in bare.fb) && !('fetchLeaderboardTop' in bare.fb), '  ↳ 없던 순위 함수를 새로 달지 않는다');
  }

  say('── 4. 방 개수 · 걷은 이름');
  {
    const api = mkApi(() => new Error('?'));
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api }).wrap(fb);
    const full = await fb.getRoomCounts();
    chk(full.FB === 1 && api.calls.length === 0 && log.length === 1, '★ 방 개수(정원 · 만들기 상한 검사)는 감싸지 않는다 — API 를 묻지 않고 늘 Firebase');
    chk(!('roomCount' in M.API_PATHS) && !('randomRooms' in M.API_PATHS) && !('RANDOM_ROOMS_MAX' in M), '  방 개수 · 랜덤 참여 후보 API 길은 쓰지 않는다(방 목록은 realtime)');
    chk(!('fetchAvatar' in fb) && !('fetchUserCardApi' in fb) && !('findRandomRooms' in fb), '★ 걷은 이름(fetchAvatar · fetchUserCardApi · findRandomRooms)을 새로 달지 않는다');
    chk(!/fetchAvatar|fetchUserCardApi|findRandomRooms/.test(strip(SRC)) && !/fetchAvatar|fetchUserCardApi|findRandomRooms/.test(strip(FI)), '  ↳ 모듈 · firebase-init 글에 걷은 이름이 없다');
  }

  say('── 5. 실패 종류 — 모두 던짐(Firebase 길 0)');
  {
    const kinds = [ERR('unavailable', 0, 'NETWORK'), ERR('unavailable', 0, 'TIMEOUT'), ERR('unavailable', 0, 'BACKOFF'), ERR('notReady', 503, 'CONFIG_NOT_READY'),
      ERR('unavailable', 503, 'RTDB_UNAVAILABLE'), ERR('request', 400, 'BAD_REQUEST'), ERR('auth', 401, ''), new TypeError('x')];
    let ok = true;
    for(const k of kinds){
      const { fb, log } = mkFb();
      M.createApiPublicReads({ api: mkApi(() => k), readCell: async () => null }).wrap(fb);
      let threw = false; try{ await fb.fetchPlaylistCard('u'); }catch(_){ threw = true; }
      if(!threw || log.length !== 0) ok = false;
    }
    chk(ok, '★ 닿지 못함 · 시간 초과 · 쉬는 중 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · 401 · 그 밖 오류 → 던진다 · 원래 Firebase 함수는 부르지 않는다');
    const { fb, log } = mkFb();
    M.createApiPublicReads({ api: null }).wrap(fb);
    let t2 = false; try{ await fb.fetchPlaylistCard('u'); }catch(_){ t2 = true; }
    chk(t2 && log.length === 0, '  ↳ API 통로가 없으면(TwApi 없음) 던진다 · Firebase 0');
    const keep = mkFb(); const before = keep.fb.getMyHome;
    M.createApiPublicReads({ api: null }).wrap(keep.fb);
    chk(keep.fb.getMyHome === before && Object.keys(keep.fb).join() === 'fetchPlaylistCard,getRoomCounts,getMyHome', '  ↳ 다른 함수는 건드리지 않고 새 이름을 더하지도 않는다');
    /* 깨 보기 — 실패하면 원래 함수로 물러나게 되돌리면 위가 빨강 */
    const back = SRC.replace("    fb.fetchPlaylistCard = async (uid) => {\n      const d = await ask(API_PATHS.card(uid));", "    const orig = fb.fetchPlaylistCard.bind(fb);\n    fb.fetchPlaylistCard = async (uid) => {\n      let d; try{ d = await ask(API_PATHS.card(uid)); }catch(_){ return orig(uid); }");
    const MB = new Function(back.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();
    const bk = mkFb(); MB.createApiPublicReads({ api: mkApi(() => ERR('unavailable', 0, 'NETWORK')) }).wrap(bk.fb);
    let bt = false; try{ await bk.fb.fetchPlaylistCard('u'); }catch(_){ bt = true; }
    chk(back !== SRC && !bt && bk.log.length === 1, '  깨 보기: 실패에 Firebase 로 물러나게 되돌리면 위 판정(던짐 · Firebase 0)이 빨강');
  }

  say('── 6. 배선');
  {
    const fi = strip(FI);
    chk(/import \{ createApiPublicReads \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?api-public-reads\.js";/.test(FI), 'firebase-init.js 가 모듈을 들여온다');
    const iw = fi.indexOf('createApiPublicReads({ api: (window.TwApi && window.TwApi.client) || null, readCell: (path) => get(ref(db, path)).then(s => s.val()) }).wrap(window.firebaseAPI);');
    chk(iw > 0 && iw < fi.indexOf("window.dispatchEvent(new Event('firebase-ready'))") && iw > fi.indexOf('window.firebaseAPI = {'), '  ↳ firebaseAPI 를 다 만든 뒤 · firebase-ready 전에 wrap(공통 API 통로 · Firebase 한 칸 읽기)');
    const a = strip(APP);
    const s1 = takeFn(a, 'async function _refreshChatProfile('), s2 = takeFn(a, 'async function _miRenderAvatar(');
    const line = /await ensureMyHome\(\{ site: 'quiet' \}\)/;
    chk(!!s1 && !!s2 && line.test(s1) && line.test(s2) && !/getMyHome/.test(s1 + s2), '★ app.js 사진 두 곳(대화창 · 내 정보) — 내 홈 상태 주인에서 읽는다(home 통째 읽기 길 없음)');
    chk(!/^\s*import\s/m.test(SRC) && !/firebase\/|gstatic|getDatabase|fetch\(/.test(strip(SRC)), 'api-public-reads.js 는 아무것도 import 하지 않는다(API · Firebase 는 deps)');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
