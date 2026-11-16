/* ═══ 🌐 sim-api-public-reads.js — 플레이리스트 명함 읽기(api-public-reads.js · window.TwApiPublicReads) ═══════════════
   [왜] 명함을 서버 «명함 묶음» 한 길(GET /v2/myhomes/cards?codes= — 키는 userCode)에서 읽는다 — 못 받으면 Firebase 로 물러나지 않고 던진다(0.13 E-2 · R4: 못 받음 + 알림).
     옛 길 GET /v2/users/{uid}/card 는 서버에 없다(#887 의 실수) — 다시 부르지 않는다(길 목록 대조는 sim-api-routes.js).
     firebaseAPI 에 바꿔 끼우던 wrap 은 걷었다 — app.js 가 만들어 playlist.js 에 deps(fetchPlaylistCard)로 넘긴다.
   1. 모양 — 이 모듈에 파도타기 · 랭킹 · 방 개수 · 걷은 이름이 없다 · wrap 이 없다
   2. 명함 — 진짜 social-api.js fetchCards 위에서: 길 · 키(userCode) · 모양 · 없는 사람 = 빈 명함 · 실패 → 던짐
   2-B. 같은 틱의 여러 명함은 요청 하나로 묶는다(사람 수만큼 따로 부르지 않는다)
   5. 실패 종류 — 닿지 못함 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · 모양이 다름 모두 던짐
   6. 배선 — firebase-init 에 명함 읽기가 없다 · app.js 가 social-api 위에 만들어 playlist.js 에 넘긴다 · playlist.js 는 firebaseAPI 를 안 부른다 · html · 모듈은 import 없음
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
const SRC = read('api-public-reads.js'), FI = read('firebase-init.js'), APP = _MI_JOIN(read('app.js')), AC = read('api-client.js'), PL = read('playlist.js');
for(const [n, v] of [['api-public-reads.js', SRC], ['firebase-init.js', FI], ['app.js', APP], ['api-client.js', AC], ['social-api.js', where('social-api.js')], ['playlist.js', PL]]){
  if(!v){ say('  ? 원본 못 찾음 — ' + n); process.exit(2); }
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };   // classic script — module.exports 로 꺼낸다
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
const mkReads = (authed, Mod) => { const soc = SOC.createSocialApi({ authed, warn: () => {} }); return (Mod || M).createApiPublicReads({ fetchCards: (c) => soc.fetchCards(c) }); };   // { fetchPlaylistCard }
/* 서버 명함 한 장(MyHomeResponse.Card) */
const card = (code, o) => Object.assign({ userCode: code, displayName: '라온', avatarUrl: 'https://img/av.png', bio: '안녕', level: 12, cycle: 1, cycleLevel: 3, starColor: 'gold' }, o || {});
const rej = async (p) => { try{ await p; return null; }catch(e){ return e || new Error('?'); } };

(async () => {
  say('── 1. 모양 — 명함 하나뿐');
  {
    const authed = mkAuthed(() => new Error('?'));
    const R = mkReads(authed);
    chk(Object.keys(R).join() === 'fetchPlaylistCard' && !('wrap' in R) && typeof M.cardOf === 'function' && Object.keys(M).sort().join() === 'cardOf,createApiPublicReads',
      '★ 내놓는 것은 fetchPlaylistCard 하나 — firebaseAPI 에 바꿔 끼우는 wrap 은 없다');
    chk(!/\/v2\/playlists|\/playlist|leaderboard|fetchMyRank|fetchLeaderboardTop|roomCount|randomRooms|fetchAvatar|fetchUserCardApi|findRandomRooms/.test(strip(SRC)) && authed.calls.length === 0,
      '  ↳ 파도타기 · 랭킹 · 방 개수 · 걷은 이름(fetchAvatar · fetchUserCardApi · findRandomRooms)의 길 · 이름이 없다');
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
    const R = mkReads(authed);
    const c = await R.fetchPlaylistCard('uA');
    chk(c.name === '라온' && c.level === 12 && c.cyc === 1 && c.clv === 3 && c.starC === 'gold' && c.avatar === 'https://img/av.png',
      '★ 명함 — 서버 { displayName · level · cycle · cycleLevel · starColor · avatarUrl } → { name · level · cyc · clv · starC · avatar }(원래 모양)');
    chk(authed.calls.join() === '/v2/myhomes/cards?codes=uA', '★ ↳ 길은 GET /v2/myhomes/cards?codes={userCode} 하나(옛 /v2/users/{uid}/card 가 아니다)');
    const cn = await R.fetchPlaylistCard('uNoPic');
    chk(cn.name === null && cn.avatar === null && cn.level === 12, '  ↳ 사진 · 이름이 비면 null(칸이 빈 채 그려진다)');
    const cz = await R.fetchPlaylistCard('uZ');
    chk(cz.name === null && cz.level === null && cz.avatar === null, '  ↳ 서버가 코드를 빼고 주면(없는 사람) 빈 명함');
    chk(!!(await rej(R.fetchPlaylistCard('uDown'))), '★ ↳ 못 받으면 던진다 — 빈 명함 · null 로 꾸미지 않는다(부르는 playlist.js 가 E-PL-03 으로 알린다)');
    chk(!!(await rej(R.fetchPlaylistCard('uBad'))), '  ↳ 모양이 틀려도 던진다');
  }

  say('── 2-B. 같은 틱은 요청 하나로');
  {
    const authed = mkAuthed((p) => {
      const codes = decodeURIComponent(p.split('codes=')[1] || '').split(',');
      return { cards: codes.map((c) => card(c, { displayName: 'N-' + c })) };
    });
    const R = mkReads(authed);
    const [a, b, c2] = await Promise.all([R.fetchPlaylistCard('u1'), R.fetchPlaylistCard('u2'), R.fetchPlaylistCard('u1')]);
    chk(authed.calls.length === 1 && authed.calls[0] === '/v2/myhomes/cards?codes=u1,u2' && a.name === 'N-u1' && b.name === 'N-u2' && c2.name === 'N-u1',
      '★ 한 틱에 세 번 물어도(둘은 같은 사람) 요청 하나 — codes 에 겹침 없이 묶는다 · 각자 제 사람의 명함을 받는다');
    await R.fetchPlaylistCard('u3');
    chk(authed.calls.length === 2 && authed.calls[1] === '/v2/myhomes/cards?codes=u3', '  ↳ 다음 틱은 새 묶음(앞 묶음의 코드가 남지 않는다)');
    let n = 0;
    const flaky = mkAuthed(() => (++n === 1 ? ERR('unavailable', 0, 'NETWORK') : { cards: [card('u1')] }));
    const R2 = mkReads(flaky);
    const rs = await Promise.all([rej(R2.fetchPlaylistCard('u1')), rej(R2.fetchPlaylistCard('u2'))]);
    chk(rs.every((e) => !!e) && flaky.calls.length === 1 && !!(await R2.fetchPlaylistCard('u1')), '  ↳ 묶음이 실패하면 그 묶음 모두 던진다 · 다음 묶음은 새로 시도한다');
  }

  say('── 5. 실패 종류 — 모두 던짐');
  {
    const kinds = [ERR('unavailable', 0, 'NETWORK'), ERR('unavailable', 0, 'TIMEOUT'), ERR('unavailable', 0, 'BACKOFF'), ERR('notReady', 503, 'CONFIG_NOT_READY'),
      ERR('unavailable', 503, 'RTDB_UNAVAILABLE'), ERR('request', 400, 'BAD_REQUEST'), ERR('auth', 401, ''), ERR('noRoute', 404, 'NOT_FOUND'), new TypeError('x')];
    let ok = true;
    for(const k of kinds){
      let threw = false; try{ await mkReads(mkAuthed(() => k)).fetchPlaylistCard('u'); }catch(_){ threw = true; }
      if(!threw) ok = false;
    }
    chk(ok, '★ 닿지 못함 · 시간 초과 · 쉬는 중 · 503 *_NOT_READY · RTDB_UNAVAILABLE · 400 · 401 · 길 없음 · 그 밖 오류 → 모두 던진다');
    /* 깨 보기 — 실패하면 빈 명함으로 꾸미게 되돌리면 위가 빨강 */
    const back = SRC.replace("async function fetchPlaylistCard(userCode){ return cardOf(await ask(String(userCode))); }", "async function fetchPlaylistCard(userCode){ try{ return cardOf(await ask(String(userCode))); }catch(_){ return cardOf(null); } }");
    const bk = mkReads(mkAuthed(() => ERR('unavailable', 0, 'NETWORK')), load(back));
    let bt = false; try{ await bk.fetchPlaylistCard('u'); }catch(_){ bt = true; }
    chk(back !== SRC && !bt, '  깨 보기: 실패에 빈 명함으로 꾸미게 되돌리면 위 판정(던짐)이 빨강');
    /* 깨 보기 — 묶지 않고 사람마다 따로 부르면 2-B 가 빨강 */
    const split = SRC.replace("    if(!batch){", "    if(true){");
    const sa = mkAuthed((p) => ({ cards: decodeURIComponent(p.split('codes=')[1]).split(',').map((c) => card(c)) }));
    const sr = mkReads(sa, load(split));
    await Promise.all([sr.fetchPlaylistCard('u1'), sr.fetchPlaylistCard('u2')]);
    chk(split !== SRC && sa.calls.length !== 1, '  깨 보기: 묶지 않고 사람마다 따로 부르게 하면 2-B 의 «요청 하나» 판정이 빨강');
  }

  say('── 6. 배선');
  {
    const fi = strip(FI), a = strip(APP), pl = strip(PL);
    chk(!/api-public-reads|createApiPublicReads|fetchPlaylistCard|_cardApi/.test(fi), '★ firebase-init.js 에 명함 읽기(옛 Firebase 함수 · wrap)가 없다');
    chk(/const apiPublicReadsMod = TwApiPublicReads\.createApiPublicReads\(\{ fetchCards: \(codes\)=>socialApiMod\.fetchCards\(codes\) \}\);/.test(a) && /fetchPlaylistCard: \(\.\.\.a\)=>apiPublicReadsMod\.fetchPlaylistCard\(\.\.\.a\),/.test(a),
      '  ↳ app.js 가 친구 쪽 social-api(로그인 통로) 위에 만들어 플레이리스트에 deps 로 넘긴다');
    chk(/const fetchPlaylistCard = deps\.fetchPlaylistCard;/.test(pl) && !/firebaseAPI/.test(pl), '  ↳ playlist.js 는 deps 로 받아 부른다 — firebaseAPI 를 안 부르고 «있으면 부르기» 가드도 없다');
    const html = read('desk-companion-prototype.html');
    const iS = html ? html.indexOf('<script src="parts/friends/social-api.js"></script>') : -1, iR = html ? html.indexOf('<script src="parts/shared/api-public-reads.js"></script>') : -1, iA = html ? html.indexOf('<script src="parts/app.js"></script>') : -1;
    chk(iS > 0 && iR > iS && iA > iR, '  ↳ html 이 api-public-reads.js 를 social-api.js 다음 · app.js 앞에 싣는다');
    chk(!/\/v2\/users\/[^'"`]*card/.test(strip(SRC)) && !/\/v2\/users\/[^'"`]*card/.test(fi) && !/readCell|avatarInline/.test(strip(SRC)), '★ 옛 길(/v2/users/{uid}/card) · 사진 칸을 Firebase 에서 따로 읽는 길(readCell · avatarInline)이 없다');
    const s1 = takeFn(a, 'async function _refreshChatProfile('), s2 = takeFn(a, 'async function _miRenderAvatar(');
    const line = /await ensureMyHome\(\{ site: 'quiet' \}\)/;
    chk(!!s1 && !!s2 && line.test(s1) && line.test(s2) && !/getMyHome/.test(s1 + s2), '★ app.js 사진 두 곳(대화창 · 내 정보) — 내 홈 상태 주인에서 읽는다(home 통째 읽기 길 없음)');
    chk(!/^\s*import\s/m.test(SRC) && !/firebase\/|gstatic|getDatabase|fetch\(/.test(strip(SRC)), 'api-public-reads.js 는 아무것도 import 하지 않는다(통로는 deps)');
  }

  say('\n' + pass + ' · ' + fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { fail++; say('  ✗ 예외: ' + (e && e.stack || e)); say('\n' + pass + ' · ' + fail); process.exit(1); });
