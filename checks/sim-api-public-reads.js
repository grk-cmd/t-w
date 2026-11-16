/* ═══ 🌐 sim-api-public-reads.js — 공개 읽기를 API 에서(api-public-reads.js) ═══════════════
   [왜] 명함을 서버 «명함 묶음» 한 길(GET /v2/myhomes/cards?codes= — 키는 userCode)에서 읽는다 — 못 받으면 Firebase 로 물러나지 않고 던진다(0.13 E-2 · R4: 못 받음 + 알림).
     옛 길 GET /v2/users/{uid}/card 는 서버에 없다(#887 의 실수) — 다시 부르지 않는다(길 목록 대조는 sim-api-routes.js).
   1. (파도타기는 로그인 길로 옮겼다 — sim-playlist-api.js. 이 모듈에 파도타기가 남지 않았는지만 본다)
   2. 명함 — 진짜 social-api.js fetchCards 위에서: 길 · 키(userCode) · 모양 · 없는 사람 = 빈 명함 · 실패 → 던짐(원래 함수를 안 부름). 사진 하나(fetchAvatar) · 명함 날것(fetchUserCardApi) · 랜덤 참여 후보(findRandomRooms)는 부르는 곳이 없어 걷었다
   2-B. 같은 틱의 여러 명함은 요청 하나로 묶는다(사람 수만큼 따로 부르지 않는다)
   3. 랭킹 — 걷었다: 순위 통로(fetchMyRank · fetchLeaderboardTop)를 달지 않고 /v2/leaderboard 를 묻지 않는다
   4. 방 개수(정원 검사)는 API 를 거치지 않고 늘 Firebase · 걷은 이름(fetchAvatar · fetchUserCardApi · findRandomRooms)을 달지 않는다
   5. 실패 종류 — 닿지 못함 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · 모양이 다름 모두 던짐(Firebase 길 0)
   6. 배선 — firebase-init(import · firebase-ready 전에 wrap · 명함 통로는 social-api) · app.js 사진 두 곳 · 모듈은 import 없음
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
const where = (f) => { for(const d of DIRS){ const p = path.join(d, f); if(fs.existsSync(p)) return p; } return null; };
const SRC = read('api-public-reads.js'), FI = read('firebase-init.js'), APP = _MI_JOIN(read('app.js')), AC = read('api-client.js');
for(const [n, v] of [['api-public-reads.js', SRC], ['firebase-init.js', FI], ['app.js', APP], ['api-client.js', AC], ['social-api.js', where('social-api.js')]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const names = [...SRC.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1]);
const load = (src) => new Function(src.replace(/^export (const|function|async function) /gm, '$1 ') + '\nreturn {' + names.join(',') + '};')();
const M = load(SRC);
const A = new Function('module', 'window', AC + '\nreturn module.exports;')({ exports: {} }, undefined);
const SOC = require(path.resolve(where('social-api.js')));
function takeFn(src, head){
  const i = src.indexOf(head); if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ const c = src[j]; if(c === '{') d++; else if(c === '}'){ d--; if(d === 0) return src.slice(i, j + 1); } }
  return null;
}

/* 가짜 로그인 통로 — routes(path) → 봉투 data | Error(던짐). 부른 경로를 적는다. 진짜 social-api.js 가 그 위에서 fetchCards 를 한다. */
const mkAuthed = (routes) => { const calls = []; return { calls, get: async (p) => { calls.push(p); const v = routes(p); if(v instanceof Error) throw v; return v; } }; };
const ERR = (kind, status, code) => new A.ApiError(kind, status, code);
const mkReads = (authed, Mod) => { const soc = SOC.createSocialApi({ authed, warn: () => {} }); return (Mod || M).createApiPublicReads({ fetchCards: (c) => soc.fetchCards(c) }); };
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
/* 서버 명함 한 장(MyHomeResponse.Card) */
const card = (code, o) => Object.assign({ userCode: code, displayName: '라온', avatarUrl: 'https://img/av.png', bio: '안녕', level: 12, cycle: 1, cycleLevel: 3, starColor: 'gold' }, o || {});
const rej = async (p) => { try{ await p; return null; }catch(e){ return e || new Error('?'); } };

(async () => {
  say('── 1. 파도타기는 이 모듈에 없다');
  {
    const { fb, log } = mkFb();
    const authed = mkAuthed(() => new Error('?'));
    mkReads(authed).wrap(fb);
    chk(!('fetchRandomPlaylist' in fb) && !('fetchPlaylistOf' in fb) && !/\/v2\/playlists|\/playlist/.test(strip(SRC)), '★ 무작위 · 친구 지목 파도타기를 바꿔 끼우지도, 길(/v2/playlists · /v2/users/{uid}/playlist)을 갖지도 않는다');
    chk(!('playlistOf' in M) && !('EXCLUDE_MAX' in M) && !('CARD_KEEP_MS' in M) && log.length === 0 && authed.calls.length === 0, '  ↳ 목록 모양 맞춤 · 명함 기억 같은 파도타기 잔재도 없다');
  }

  say('── 2. 명함 — GET /v2/myhomes/cards?codes= (키 userCode)');
  {
    const authed = mkAuthed((p) => {
      if(p === '/v2/myhomes/cards?codes=uA') return { cards: [card('uA')] };
      if(p === '/v2/myhomes/cards?codes=uZ') return { cards: [] };
      if(p === '/v2/myhomes/cards?codes=uNoPic') return { cards: [card('uNoPic', { avatarUrl: null, displayName: '' })] };
      if(p === '/v2/myhomes/cards?codes=uBad') return 'x';
      return ERR('unavailable', 0, 'NETWORK');
    });
    const { fb, log } = mkFb();
    mkReads(authed).wrap(fb);
    const c = await fb.fetchPlaylistCard('uA');
    chk(c.name === '라온' && c.level === 12 && c.cyc === 1 && c.clv === 3 && c.starC === 'gold' && c.avatar === 'https://img/av.png' && log.length === 0,
      '★ 명함 — 서버 { displayName · level · cycle · cycleLevel · starColor · avatarUrl } → { name · level · cyc · clv · starC · avatar }(원래 모양) · Firebase 안 읽음');
    chk(authed.calls.join() === '/v2/myhomes/cards?codes=uA', '★ ↳ 길은 GET /v2/myhomes/cards?codes={userCode} 하나(옛 /v2/users/{uid}/card 가 아니다)');
    const cn = await fb.fetchPlaylistCard('uNoPic');
    chk(cn.name === null && cn.avatar === null && cn.level === 12, '  ↳ 사진 · 이름이 비면 null(칸이 빈 채 그려진다)');
    const cz = await fb.fetchPlaylistCard('uZ');
    chk(cz.name === null && cz.level === null && cz.avatar === null && log.length === 0, '  ↳ 서버가 코드를 빼고 주면(없는 사람) 빈 명함(원래 함수와 같은 모양) · Firebase 안 감');
    chk(!!(await rej(fb.fetchPlaylistCard('uDown'))) && log.length === 0, '★ ↳ 못 받으면 던진다 — 원래 함수(profile + home/avatar)로 물러나지 않는다(Firebase 읽기 0)');
    chk(!!(await rej(fb.fetchPlaylistCard('uBad'))) && log.length === 0, '  ↳ 모양이 틀려도 던진다 · Firebase 0');
  }

  say('── 2-B. 같은 틱은 요청 하나로');
  {
    const authed = mkAuthed((p) => {
      const codes = decodeURIComponent(p.split('codes=')[1] || '').split(',');
      return { cards: codes.map((c) => card(c, { displayName: 'N-' + c })) };
    });
    const { fb } = mkFb();
    mkReads(authed).wrap(fb);
    const [a, b, c2] = await Promise.all([fb.fetchPlaylistCard('u1'), fb.fetchPlaylistCard('u2'), fb.fetchPlaylistCard('u1')]);
    chk(authed.calls.length === 1 && authed.calls[0] === '/v2/myhomes/cards?codes=u1,u2' && a.name === 'N-u1' && b.name === 'N-u2' && c2.name === 'N-u1',
      '★ 한 틱에 세 번 물어도(둘은 같은 사람) 요청 하나 — codes 에 겹침 없이 묶는다 · 각자 제 사람의 명함을 받는다');
    await fb.fetchPlaylistCard('u3');
    chk(authed.calls.length === 2 && authed.calls[1] === '/v2/myhomes/cards?codes=u3', '  ↳ 다음 틱은 새 묶음(앞 묶음의 코드가 남지 않는다)');
    let n = 0;
    const flaky = mkAuthed(() => (++n === 1 ? ERR('unavailable', 0, 'NETWORK') : { cards: [card('u1')] }));
    const f2 = mkFb(); mkReads(flaky).wrap(f2.fb);
    const rs = await Promise.all([rej(f2.fb.fetchPlaylistCard('u1')), rej(f2.fb.fetchPlaylistCard('u2'))]);
    chk(rs.every((e) => !!e) && flaky.calls.length === 1 && !!(await f2.fb.fetchPlaylistCard('u1')), '  ↳ 묶음이 실패하면 그 묶음 모두 던진다 · 다음 묶음은 새로 시도한다');
  }

  say('── 3. 랭킹 — 걷었다');
  {
    const authed = mkAuthed(() => ({ uid: 'u1', rank: 7, sec: 99 }));
    const { fb } = mkFb(); fb.fetchMyRank = async () => 'FB'; fb.fetchLeaderboardTop = async () => 'FB';
    mkReads(authed).wrap(fb);
    const r = [await fb.fetchMyRank('u1'), await fb.fetchLeaderboardTop()];
    chk(r.every((x) => x === 'FB') && !authed.calls.some((c) => /leaderboard/.test(c)), '★ 순위 통로를 바꿔 끼우지 않는다 — /v2/leaderboard 를 묻지 않는다');
    chk(!/leaderboard|fetchMyRank|fetchLeaderboardTop/.test(strip(SRC)), '  ↳ 모듈 글에 랭킹 경로 · 이름이 없다');
    const bare = mkFb(); M.createApiPublicReads({ fetchCards: async () => ({}) }).wrap(bare.fb);
    chk(!('fetchMyRank' in bare.fb) && !('fetchLeaderboardTop' in bare.fb), '  ↳ 없던 순위 함수를 새로 달지 않는다');
  }

  say('── 4. 방 개수 · 걷은 이름');
  {
    const authed = mkAuthed(() => new Error('?'));
    const { fb, log } = mkFb();
    mkReads(authed).wrap(fb);
    const full = await fb.getRoomCounts();
    chk(full.FB === 1 && authed.calls.length === 0 && log.length === 1, '★ 방 개수(정원 · 만들기 상한 검사)는 감싸지 않는다 — API 를 묻지 않고 늘 Firebase');
    chk(!/roomCount|randomRooms|RANDOM_ROOMS_MAX/.test(strip(SRC)), '  방 개수 · 랜덤 참여 후보 API 길은 쓰지 않는다(방 목록은 realtime)');
    chk(!('fetchAvatar' in fb) && !('fetchUserCardApi' in fb) && !('findRandomRooms' in fb), '★ 걷은 이름(fetchAvatar · fetchUserCardApi · findRandomRooms)을 새로 달지 않는다');
    chk(!/fetchAvatar|fetchUserCardApi|findRandomRooms/.test(strip(SRC)) && !/fetchAvatar|fetchUserCardApi|findRandomRooms/.test(strip(FI)), '  ↳ 모듈 · firebase-init 글에 걷은 이름이 없다');
  }

  say('── 5. 실패 종류 — 모두 던짐(Firebase 길 0)');
  {
    const kinds = [ERR('unavailable', 0, 'NETWORK'), ERR('unavailable', 0, 'TIMEOUT'), ERR('unavailable', 0, 'BACKOFF'), ERR('notReady', 503, 'CONFIG_NOT_READY'),
      ERR('unavailable', 503, 'RTDB_UNAVAILABLE'), ERR('request', 400, 'BAD_REQUEST'), ERR('auth', 401, ''), ERR('noRoute', 404, 'NOT_FOUND'), new TypeError('x')];
    let ok = true;
    for(const k of kinds){
      const { fb, log } = mkFb();
      mkReads(mkAuthed(() => k)).wrap(fb);
      let threw = false; try{ await fb.fetchPlaylistCard('u'); }catch(_){ threw = true; }
      if(!threw || log.length !== 0) ok = false;
    }
    chk(ok, '★ 닿지 못함 · 시간 초과 · 쉬는 중 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · 401 · 길 없음 · 그 밖 오류 → 던진다 · 원래 Firebase 함수는 부르지 않는다');
    const keep = mkFb(); const before = keep.fb.getMyHome;
    M.createApiPublicReads({ fetchCards: async () => ({}) }).wrap(keep.fb);
    chk(keep.fb.getMyHome === before && Object.keys(keep.fb).join() === 'fetchPlaylistCard,getRoomCounts,getMyHome', '  ↳ 다른 함수는 건드리지 않고 새 이름을 더하지도 않는다');
    /* 깨 보기 — 실패하면 원래 함수로 물러나게 되돌리면 위가 빨강 */
    const back = SRC.replace("    fb.fetchPlaylistCard = async (userCode) => cardOf(await ask(String(userCode)));", "    const orig = fb.fetchPlaylistCard.bind(fb);\n    fb.fetchPlaylistCard = async (userCode) => { try{ return cardOf(await ask(String(userCode))); }catch(_){ return orig(userCode); } };");
    const MB = load(back);
    const bk = mkFb(); mkReads(mkAuthed(() => ERR('unavailable', 0, 'NETWORK')), MB).wrap(bk.fb);
    let bt = false; try{ await bk.fb.fetchPlaylistCard('u'); }catch(_){ bt = true; }
    chk(back !== SRC && !bt && bk.log.length === 1, '  깨 보기: 실패에 Firebase 로 물러나게 되돌리면 위 판정(던짐 · Firebase 0)이 빨강');
    /* 깨 보기 — 묶지 않고 사람마다 따로 부르면 2-B 가 빨강 */
    const split = SRC.replace("    if(!batch){", "    if(true){");
    const MS = load(split);
    const sa = mkAuthed((p) => ({ cards: decodeURIComponent(p.split('codes=')[1]).split(',').map((c) => card(c)) }));
    const sb = mkFb(); mkReads(sa, MS).wrap(sb.fb);
    await Promise.all([sb.fb.fetchPlaylistCard('u1'), sb.fb.fetchPlaylistCard('u2')]);
    chk(split !== SRC && sa.calls.length !== 1, '  깨 보기: 묶지 않고 사람마다 따로 부르게 하면 2-B 의 «요청 하나» 판정이 빨강');
  }

  say('── 6. 배선');
  {
    const fi = strip(FI);
    chk(/import \{ createApiPublicReads \} from "\.\/(?:(?:\.\.\/)?[\w-]+\/)?api-public-reads\.js";/.test(FI), 'firebase-init.js 가 모듈을 들여온다');
    const iw = fi.indexOf('createApiPublicReads({ fetchCards: (codes) => _cardApi.fetchCards(codes) }).wrap(window.firebaseAPI);');
    chk(iw > 0 && iw < fi.indexOf("window.dispatchEvent(new Event('firebase-ready'))") && iw > fi.indexOf('window.firebaseAPI = {'), '  ↳ firebaseAPI 를 다 만든 뒤 · firebase-ready 전에 wrap(명함 통로 = 친구 쪽 social-api fetchCards)');
    chk(/_cardApi = window\.TwSocialApi\.createSocialApi\(\{ authed: window\.TwApi\.authed,/.test(fi) && !/_cardApi \?|TwSocialApi &&/.test(fi), '  ↳ 명함 통로는 로그인 통로(TwApi.authed) 위의 social-api 를 «있으면 부르기» 가드 없이 바로 만든다')
    const html = read('desk-companion-prototype.html');
    chk(!!html && html.indexOf('<script src="parts/friends/social-api.js"></script>') > 0 && html.indexOf('<script type="module" src="parts/firebase-init.js"></script>') > 0,
      '  ↳ html 이 social-api.js 를 일반 스크립트로 싣고 firebase-init.js 는 module(문서를 다 읽은 뒤 돈다) — wrap 이 도는 때 TwSocialApi 가 있다')
    chk(!/\/v2\/users\/[^'"`]*card/.test(strip(SRC)) && !/\/v2\/users\/[^'"`]*card/.test(fi) && !/readCell|avatarInline/.test(strip(SRC)), '★ 옛 길(/v2/users/{uid}/card) · 사진 칸을 Firebase 에서 따로 읽는 길(readCell · avatarInline)이 없다');
    const a = strip(APP);
    const s1 = takeFn(a, 'async function _refreshChatProfile('), s2 = takeFn(a, 'async function _miRenderAvatar(');
    const line = /await ensureMyHome\(\{ site: 'quiet' \}\)/;
    chk(!!s1 && !!s2 && line.test(s1) && line.test(s2) && !/getMyHome/.test(s1 + s2), '★ app.js 사진 두 곳(대화창 · 내 정보) — 내 홈 상태 주인에서 읽는다(home 통째 읽기 길 없음)');
    chk(!/^\s*import\s/m.test(SRC) && !/firebase\/|gstatic|getDatabase|fetch\(/.test(strip(SRC)), 'api-public-reads.js 는 아무것도 import 하지 않는다(통로는 deps)');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
