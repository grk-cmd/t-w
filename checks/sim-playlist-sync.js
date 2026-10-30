/* sim-playlist-sync.js — ☁️ 플레이리스트 기기 간 맞추기 규칙(status/playlist-sync.js) · 서버 길(playlist-api.js)이 넘기는 «시각 모름»
   ・1절: decide — 못 읽음 · 양쪽 시각 앎 · 이 기기만 모름 · 서버가 모름(옛 앱) · 이상한 값 · retryDelay
   ・2절: 서버 길 — 서버에는 고친 시각이 없다(판 version 만) → 읽은 결과의 editTs 는 늘 0 = «모름» 이고, 이 규칙이 그것을 «모름» 으로 판단한다(비어 있음 ≠ 못 읽음)
   ・3절: 배선 — html 싣는 순서 · app.js deps · smoke
   ・4절: 깨 보기
   (부팅 맞추기를 실제로 굴리는 것은 sim-playlist.js 5-2절) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const find = (rel) => fs.existsSync(P(rel)) ? P(rel) : path.join(__dirname, path.basename(rel));
const need = ['app/parts/status/playlist-sync.js', 'app/parts/status/playlist-api.js', 'app/desk-companion-prototype.html', 'app/parts/app.js', 'checks/smoke.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const load = (src) => { const w = {}; new Function('window', src)(w); return w; };
const srv = (n, editTs) => ({ sets: [{ name: '', items: Array.from({ length: n }, (_, i) => ({ id: 'v' + i })) }], editTs });

function behave(src){
  const w = load(src), S = w.TwPlaylistSync, r = {};
  r.only = Object.keys(w).join() === 'TwPlaylistSync' && Object.isFrozen(S) && S.RETRY_MS === 30000;
  r.retry = S.decide(null, 5, true) === 'retry' && S.decide(undefined, 0, false) === 'retry' && S.decide('x', 0, true) === 'retry';
  r.known = S.decide(srv(2, 100), 101, true) === 'push' && S.decide(srv(2, 101), 100, true) === 'adopt' && S.decide(srv(2, 100), 100, true) === 'none'
    && S.decide(srv(0, 200), 100, true) === 'adopt' && S.decide(srv(0, 100), 200, true) === 'push';
  r.localUnknown = S.decide(srv(2, 100), 0, true) === 'adopt' && S.decide(srv(2, 100), 0, false) === 'adopt'
    && S.decide(srv(0, 100), 0, true) === 'push' && S.decide(srv(0, 100), 0, false) === 'none';
  r.srvUnknown = S.decide(srv(0, 0), 0, true) === 'push' && S.decide(srv(0, 0), 5, false) === 'none' && S.decide(srv(2, 0), 0, false) === 'adopt'
    && S.decide(srv(2, 0), 0, true) === 'none' && S.decide(srv(2, 0), 5, true) === 'push';
  r.odd = S.decide({ sets: 'x', editTs: 'x' }, 0, true) === 'push' && S.decide(srv(2, NaN), 100, true) === 'push' && S.decide(srv(2, -5), -5, true) === 'none'
    && S.decide(srv(2, Infinity), 100, true) === 'push' && S.decide(srv(2, 50), NaN, false) === 'adopt' && S.decide({ sets: srv(2).sets, ts: 999 }, 0, true) === 'none';
  r.count = S.countItems([{ items: [1, 2] }, null, { items: 'x' }, { items: [3] }]) === 3 && S.countItems(null) === 0;
  r.delay = S.retryDelay(0) === 30000 && S.retryDelay(1) === 60000 && S.retryDelay(4) === 480000 && S.retryDelay(5) === 600000 && S.retryDelay(100) === 600000
    && S.retryDelay(-1) === 30000 && S.retryDelay('x') === 30000;
  return r;
}
function report(r){
  say('── 1. decide · retryDelay');
  chk(r.only, '싣기만 하면 window.TwPlaylistSync 하나 · 얼린 표 · 처음 다시 시도 30초');
  chk(r.retry, '서버를 못 읽으면(null) — retry(모르는 채로 올리지 않는다)');
  chk(r.known, '양쪽 고친 시각을 안다 — 나중인 쪽(이 기기면 올림 · 서버면 받음 · 비운 서버도) · 같으면 그대로');
  chk(r.localUnknown, '이 기기만 모른다(새 기기 · 이 판 전 저장분) — 서버에 곡이 있으면 받는다 · 비운 서버는 이 기기 곡을 지우지 않는다');
  chk(r.srvUnknown, '서버가 모른다(옛 앱이 쓴 노드) — 양쪽 곡이면 이 판에서 고친 기기만 올리고 · 둘 다 모르면 그대로(업그레이드 첫 부팅에 좋은 목록을 잃지 않게)');
  chk(r.odd, '  이상한 값 — 모양이 틀린 sets · NaN · 음수 · Infinity 는 «모름» · 옛 ts 칸은 고친 시각이 아니다');
  chk(r.count, '  곡 수 — 세 벌 합계 · 틀린 칸은 0');
  chk(r.delay, 'retryDelay — 30초에서 두 배씩 · 10분에서 멈춤 · 이상한 값은 처음 간격');
}
const R = behave(SRC['app/parts/status/playlist-sync.js']);
report(R);

say('── 2. 서버 길');
{
  const API = (() => { const w = {}; new Function('window', SRC['app/parts/status/playlist-api.js'])(w); return w.TwPlaylistApi; })();
  const S = load(SRC['app/parts/status/playlist-sync.js']).TwPlaylistSync;
  const mine = (n) => API.mineOf({ sets: [{ name: '', tracks: Array.from({ length: n }, (_, i) => ({ videoId: 'v' + i, title: '' })) }, { name: '', tracks: [] }, { name: '', tracks: [] }], bio: '', listed: true, homePublic: false, version: 4 });
  chk(mine(2).editTs === 0 && mine(0).editTs === 0, '서버 길이 읽은 결과의 고친 시각은 늘 0 = «모름»(서버에는 판 번호만 있다)');
  chk(S.decide(mine(0), 0, true) === 'push' && S.decide(mine(0), 0, false) === 'none', '  빈 서버 + 이 기기에 곡 — 올린다 · 둘 다 비면 그대로(빈 목록은 못 읽음 retry 가 아니다)');
  chk(S.decide(mine(2), 0, false) === 'adopt' && S.decide(mine(2), 0, true) === 'none' && S.decide(mine(2), 5, true) === 'push', '  서버에 곡 — 새 기기는 받는다 · 양쪽 곡이면 이 판에서 고친 기기만 올린다');
  chk(S.decide(null, 0, true) === 'retry', '  못 읽음(provider 가 던져 null 이 됨)은 retry');
}

say('── 3. 배선');
{
  const H = SRC['app/desk-companion-prototype.html'], A = SRC['app/parts/app.js'];
  const iS = H.indexOf('<script src="parts/status/playlist-sync.js"></script>'), iA = H.indexOf('<script src="parts/app.js"></script>');
  chk(iS > 0 && iA > iS, 'html — playlist-sync.js 가 app.js 보다 먼저');
  chk((A.match(/playlistSync: TwPlaylistSync,/g) || []).length === 1, 'app.js — 플레이리스트를 만들 때 deps 로 넘긴다(한 곳)');
  chk(SRC['checks/smoke.js'].indexOf("PRELOAD.push('playlist-sync.js');") > 0, 'smoke PRELOAD 에 playlist-sync.js');
}

say('── 4. 깨 보기');
{
  const M = SRC['app/parts/status/playlist-sync.js'];
  const br = (from, to) => M.includes(from) ? behave(M.replace(from, to)) : null;
  const b1 = br("if(!srv || typeof srv !== 'object') return 'retry';", "if(!srv || typeof srv !== 'object') return 'none';");
  chk(b1 && !b1.retry, '못 읽음을 «같음» 으로 보면 1절이 빨강');
  const b2 = br("if(sTs) return sHas ? 'adopt' : (localHas ? 'push' : 'none');", "if(sTs) return localHas ? 'push' : 'none';");
  chk(b2 && !b2.localUnknown, '새 기기가 서버 목록을 안 받으면(옛 사고) 1절이 빨강');
  const b3 = br("return lTs ? 'push' : 'none';", "return 'adopt';");
  chk(b3 && !b3.srvUnknown, '시각 모르는 서버가 이 기기 목록을 덮으면(업그레이드 첫 부팅) 1절이 빨강');
  const b4 = br("if(sTs && lTs) return sTs > lTs ? 'adopt' : (lTs > sTs ? 'push' : 'none');", "if(sTs && lTs) return sTs > lTs && sHas ? 'adopt' : (lTs > sTs ? 'push' : 'none');");
  chk(b4 && !b4.known, '비운 서버를 안 따르면 1절이 빨강');
  const b5 = br('return Math.min(RETRY_MAX_MS,', 'return (0,');
  chk(b5 && !b5.delay, '다시 시도 간격에 상한이 없으면 1절이 빨강');
}

say('');
say('결과 ' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
