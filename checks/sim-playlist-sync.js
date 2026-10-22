/* sim-playlist-sync.js — ☁️ 플레이리스트 기기 간 맞추기 규칙(status/playlist-sync.js) · 서버 사본 읽기 · 쓰기(firebase-init.js)
   ・1절: decide — 못 읽음 · 새 기기 · 이 기기가 나중 · 서버가 나중 · 같음 · 빈 서버 · 이상한 값(경계 · 0 · 음수 · NaN)
   ・2절: firebase-init — 비어 있음과 못 읽음을 가른다 · ts 를 돌려준다 · 올릴 때 고친 시각을 쓴다 · 비울 때 노드를 지우지 않고 빈 목록 + 시각
   ・3절: 배선 — html 싣는 순서 · app.js deps · smoke
   ・4절: 깨 보기
   (부팅 맞추기를 실제로 굴리는 것은 sim-playlist.js 5-2절) */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = fs.existsSync(path.join(__dirname, 'app')) ? __dirname : path.join(__dirname, '..');
const P = (...a) => path.join(ROOT, ...a);
const find = (rel) => fs.existsSync(P(rel)) ? P(rel) : path.join(__dirname, path.basename(rel));
const need = ['app/parts/status/playlist-sync.js', 'app/parts/firebase-init.js', 'app/desk-companion-prototype.html', 'app/parts/app.js', 'checks/smoke.js'];
const SRC = {};
for(const r of need){ const f = find(r); if(!fs.existsSync(f)){ console.log('  ? 원본 못 찾음 — ' + r); process.exit(2); } SRC[r] = fs.readFileSync(f, 'utf8'); }

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { if(ok){ pass++; say('  ✓ ' + msg); } else { fail++; say('  ✗ ' + msg); } };

const load = (src) => { const w = {}; new Function('window', src)(w); return w; };
const srv = (n, ts) => ({ sets: [{ name: '', items: Array.from({ length: n }, (_, i) => ({ id: 'v' + i })) }], ts });

function behave(src){
  const w = load(src), S = w.TwPlaylistSync, r = {};
  r.only = Object.keys(w).join() === 'TwPlaylistSync' && Object.isFrozen(S) && S.RETRY_MS === 30000;
  r.retry = S.decide(null, 5, true) === 'retry' && S.decide(undefined, 0, false) === 'retry' && S.decide('x', 0, true) === 'retry';
  r.fresh = S.decide(srv(2, 100), 0, true) === 'adopt' && S.decide(srv(0, 100), 0, true) === 'push' && S.decide(srv(0, 0), 0, false) === 'none'
    && S.decide(srv(2, 0), 0, false) === 'adopt';
  r.later = S.decide(srv(2, 100), 101, true) === 'push' && S.decide(srv(2, 101), 100, true) === 'adopt' && S.decide(srv(2, 100), 100, true) === 'none'
    && S.decide(srv(0, 200), 100, true) === 'adopt' && S.decide(srv(0, 0), 100, true) === 'push' && S.decide(srv(0, 0), 100, false) === 'push';
  r.odd = S.decide({ sets: 'x', ts: 'x' }, 0, true) === 'push' && S.decide(srv(2, NaN), 100, true) === 'push' && S.decide(srv(2, -5), -5, true) === 'adopt'
    && S.decide(srv(2, Infinity), 100, true) === 'push' && S.decide(srv(2, 50), NaN, false) === 'adopt';
  r.count = S.countItems([{ items: [1, 2] }, null, { items: 'x' }, { items: [3] }]) === 3 && S.countItems(null) === 0;
  return r;
}
function report(r){
  say('── 1. decide');
  chk(r.only, '싣기만 하면 window.TwPlaylistSync 하나 · 얼린 표 · 다시 시도 30초');
  chk(r.retry, '서버를 못 읽으면(null) — retry(모르는 채로 올리지 않는다)');
  chk(r.fresh, '이 기기에서 고친 적 없음 — 서버에 곡이 있으면 받고 · 없으면 이 기기 것을 올리고 · 둘 다 없으면 그대로');
  chk(r.later, '고친 시각이 나중인 쪽 — 이 기기가 나중이면 올리고 · 서버가 나중이면 받고(비운 것도) · 같으면 그대로');
  chk(r.odd, '  이상한 값 — 모양이 틀린 sets · NaN · 음수 · Infinity ts 는 0 으로 본다');
  chk(r.count, '  곡 수 — 세 벌 합계 · 틀린 칸은 0');
}
const R = behave(SRC['app/parts/status/playlist-sync.js']);
report(R);

say('── 2. firebase-init');
{
  const F = SRC['app/parts/firebase-init.js'];
  const body = (name) => { const a = F.indexOf('async ' + name + '('); const b = F.indexOf('\n    },', a); return a > 0 ? F.slice(a, b) : ''; };
  const fm = body('fetchMyPlaylistSets'), pub = body('publishMyPlaylist'), rm = body('removeMyPlaylist');
  chk(/if\(!pv\) return \{ sets: \[\], bio: '', homePublic: false, ts: 0 \};/.test(fm) && /ts: Number\(pv\.ts\) \|\| 0 \}/.test(fm) && /catch\(e\)\{[^}]*return null; \}/.test(fm),
    '내 사본 읽기 — 비어 있으면 빈 목록(ts 0) · 있으면 ts 까지 · 못 읽으면 null');
  chk(/async publishMyPlaylist\(uid, name, sets, meta, editTs\)/.test(pub) && /const ts = Number\(editTs\) > 0 \? Number\(editTs\) : Date\.now\(\);/.test(pub),
    '올리기 — ts 는 이 기기에서 고친 시각(없으면 지금)');
  chk(/async removeMyPlaylist\(uid, meta, editTs\)/.test(rm) && !/remove\(ref\(db, `users\/\$\{uid\}\/playlist`\)\)/.test(rm)
    && /set\(ref\(db, `users\/\$\{uid\}\/playlist`\), \{ sets: \[\], items: \[\], ts: Number\(editTs\) > 0/.test(rm) && /remove\(ref\(db, `playlistIndex\/\$\{uid\}`\)\)/.test(rm),
    '비우기 — 노드를 지우지 않고 빈 목록 + 고친 시각 · 색인만 지운다(다른 기기가 옛 목록을 되살리지 않게)');
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
  const b2 = br("if(!lTs) return sHas ? 'adopt' : (localHas ? 'push' : 'none');", "if(!lTs) return localHas ? 'push' : 'none';");
  chk(b2 && !b2.fresh, '새 기기가 서버 목록을 안 받으면(옛 사고) 1절이 빨강');
  const b3 = br("if(sTs > lTs) return 'adopt';", "if(sTs > lTs && sHas) return 'adopt';");
  chk(b3 && !b3.later, '비운 서버를 안 따르면 1절이 빨강');
}

say('');
say('결과 ' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
