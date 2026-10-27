/* sim-gacha-album.js — 📚 도감 규칙(gacha-album.js — 도감 줄 · 모은 수 · 줄 그림 · 쪽)
   실행:  node sim-gacha-album.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 꾸미기 창 «도감» 탭의 줄 목록 · «n / m 모음» · 막대 · 쪽 넘기기가 이 규칙 하나를 쓴다.
     줄을 잘못 세면 없는 도감이 생기거나(빈 시즌) 안 뽑은 파츠 그림이 줄에 새어 나간다.
   ★ 사용자 결정: 도감 = «⭐ 상시» + 시즌(봄 · 여름 · 가을 · 겨울 — 파츠가 있는 것만) · 줄 그림은 뽑은 파츠에서만.
   ・1절: 순수 함수 입력 → 출력 · 경계값(빈 값 · null · 모르는 시즌 · 0개 · 다 모음 · 쪽 끝) · 받은 값을 고치지 않는다
   ・2절: 연결 — html 이 gacha.js · app.js 보다 먼저 싣는다 · smoke 가 싣는다 · gacha.js 가 받아 부른다
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('character/gacha-album.js'), GACHA = read('character/gacha.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !GACHA || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — gacha-album.js · gacha.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const J = JSON.stringify;
const load = (src) => { const win = {}; new Function('window', 'module', src)(win, undefined); return win; };

/* 가챠 파츠 — 상시 셋 · 가을 넷 · 겨울 하나 · 모르는 시즌 하나 · 봄 · 여름은 없음 */
const PARTS = () => [
  { id: 'a3', season: '', order: 3 }, { id: 'a1', order: 1 }, { id: 'a2', season: '', order: 2 },
  { id: 'f4', season: 'autumn', order: 9 }, { id: 'f1', season: 'autumn', order: 5 }, { id: 'f2', season: 'autumn', order: 6 }, { id: 'f3', season: 'autumn', order: 7 },
  { id: 'w1', season: 'winter', order: 1 },
  { id: 'x1', season: 'halloween', order: 1 },
];
const OWN = { a1: 2, a3: 1, f1: 4, f2: 1, f3: 1, f4: 1, x1: 3 };
const count = (id) => OWN[id] | 0;

function judge(mod){
  const r = {};
  try {
    const win = load(mod), A = win.TwGachaAlbum;
    r.only = Object.keys(win).join() === 'TwGachaAlbum';
    r.consts = J(A.ALBUM_KEYS) === J(['', 'spring', 'summer', 'autumn', 'winter']) && Object.isFrozen(A.ALBUM_KEYS) && Object.isFrozen(A.ALBUM_LABEL)
      && A.ALBUM_LABEL[''] === '⭐ 상시' && A.ALBUM_LABEL.autumn === '🍂 가을' && A.ALBUM_THUMBS === 3
      && Object.isFrozen(A.ALBUM_MONTH) && A.ALBUM_MONTH.winter === '12월' && Object.keys(A.ALBUM_MONTH).join() === A.ALBUM_KEYS.filter(Boolean).join();
    r.isKey = A.isAlbumKey('') && A.isAlbumKey('winter') && !A.isAlbumKey('halloween') && !A.isAlbumKey(null) && !A.isAlbumKey(undefined);
    const P = PARTS(), before = J(P);
    r.parts = J(A.albumParts(P, '').map(p => p.id)) === J(['a1', 'a2', 'a3']) && J(A.albumParts(P, 'autumn').map(p => p.id)) === J(['f1', 'f2', 'f3', 'f4'])
      && J(A.albumParts(P, 'spring')) === '[]' && J(A.albumParts(P, 'halloween')) === '[]' && J(A.albumParts(null, '')) === '[]' && J(A.albumParts(P, null)) === '[]';
    const L = A.albumList(P, count);
    r.keys = J(L.map(a => a.key)) === J(['', 'autumn', 'winter']);
    r.counts = J(L.map(a => [a.owned, a.total])) === J([[2, 3], [4, 4], [0, 1]]);
    r.labels = J(L.map(a => a.label)) === J(['⭐ 상시', '🍂 가을', '❄ 겨울']);
    r.thumbs = J(L[0].thumbs.map(p => p.id)) === J(['a1', 'a3']) && J(L[1].thumbs.map(p => p.id)) === J(['f1', 'f2', 'f3']) && L[2].thumbs.length === 0;
    r.empty = J(A.albumList([], count)) === '[]' && J(A.albumList(null, count)) === '[]';
    r.pct = A.albumPct(2, 3) === 67 && A.albumPct(4, 4) === 100 && A.albumPct(0, 1) === 0 && A.albumPct(5, 0) === 0 && A.albumPct(9, 4) === 100 && A.albumPct(-1, 4) === 0;
    r.pages = A.pageCount(0, 12) === 1 && A.pageCount(12, 12) === 1 && A.pageCount(13, 12) === 2
      && A.clampPage(5, 13, 12) === 1 && A.clampPage(-2, 13, 12) === 0 && A.clampPage(undefined, 0, 12) === 0 && A.clampPage(1, 12, 12) === 0;
    const many = Array.from({ length: 30 }, (_, i) => ({ id: 'p' + i }));
    r.pageOf = A.pageOf(many, 'p0', 12) === 0 && A.pageOf(many, 'p11', 12) === 0 && A.pageOf(many, 'p12', 12) === 1 && A.pageOf(many, 'p29', 12) === 2
      && A.pageOf(many, 'zz', 12) === -1 && A.pageOf(null, 'p0', 12) === -1;
    r.pure = J(P) === before;
  } catch (e) { r.err = String(e && e.stack || e).split('\n').slice(0, 2).join(' / '); }
  return r;
}
function wiring(gacha, html, smoke){
  const r = {};
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf('character/gacha-album.js');
  r.order = at >= 0 && at < order.indexOf('character/gacha.js') && at < order.indexOf('app.js');
  const iP = smoke.indexOf("PRELOAD.push('gacha-album.js');"), iG = smoke.indexOf("PRELOAD.push('gacha.js');");
  r.smoke = iP > 0 && iP < iG;
  const code = strip(gacha);
  r.takes = /const gachaAlbum = TwGachaAlbum;/.test(code);
  r.calls = ['albumList', 'albumParts', 'albumPct', 'pageCount', 'clampPage', 'pageOf', 'isAlbumKey'].filter(n => !new RegExp('\\bgachaAlbum\\.' + n + '\\(').test(code));
  /* 같은 판단을 gacha.js 에 다시 쓰지 않는다 — 시즌으로 거르기 · 쪽 수 셈 · 시즌 이름 · 이름표 · 달 표 */
  r.dup = [/\.season \|\| ''\) === /, /Math\.ceil\(list\.length/, /spring\s*:\s*'(🌸|3월|spring)/, /'❄ 겨울'/].filter(re => re.test(code)).map(String);
  return r;
}

const R = judge(MOD), W = wiring(GACHA, HTML, SMOKE);
say('── 1. 순수 함수');
chk(!R.err && R.only && R.consts, '싣기만 하면 window.TwGachaAlbum 하나 · 도감 다섯(상시 + 네 시즌 · 바꿀 수 없음) · 시즌마다 돌아오는 달 · 줄 그림 셋' + (R.err ? ' — ' + R.err : ''));
chk(R.isKey, '아는 도감 이름만 — 모르는 시즌 · null 은 아니다');
chk(R.parts, '도감 파츠 — season 이 비면 상시 · 등록 순서대로 · 모르는 시즌 · 빈 값은 빈 목록');
chk(R.keys && R.labels, '★ 줄은 파츠가 있는 도감만(봄 · 여름 없음 · 모르는 시즌 없음) · 상시 → 시즌 순서');
chk(R.counts, '«n / m 모음» — 뽑은 수 / 전부(다 모음 · 0개 포함)');
chk(R.thumbs, '★ 줄 그림은 뽑은 파츠에서만 · 셋까지 · 하나도 없으면 빈 칸');
chk(R.empty, '빈 값 · null 이면 줄 없음');
chk(R.pct, '막대 — 반올림 · 0 · 100 끝에서 멈춤 · 전부 0 이면 0');
chk(R.pages && R.pageOf, '쪽 — 쪽 수(0개도 1쪽) · 쪽 번호 바로잡기 · 그 파츠가 있는 쪽(없으면 -1)');
chk(R.pure, '받은 값을 고치지 않는다(정렬은 새 배열)');
say('── 2. 연결');
chk(W.order, 'html 이 gacha-album.js 를 gacha.js · app.js 보다 먼저 싣는다');
chk(W.smoke, 'smoke 가 gacha.js 보다 먼저 싣는다');
chk(W.takes && !W.calls.length, 'gacha.js 가 받아 부른다' + (W.calls.length ? ' — 안 부름: ' + W.calls.join(' · ') : ''));
chk(!W.dup.length, '같은 판단을 gacha.js 에 다시 쓰지 않는다(시즌 표 포함)' + (W.dup.length ? ' — ' + W.dup.join(' · ') : ''));

say('── 3. 일부러 깨 보기');
const BREAKS = [
  ['MOD', '    if(!list.length) return;\n', '', '파츠 없는 도감도 줄로', 'keys'],
  ['MOD', 'thumbs: owned.slice(0, ALBUM_THUMBS)', 'thumbs: list.slice(0, ALBUM_THUMBS)', '안 뽑은 파츠 그림이 줄에', 'thumbs'],
  ['MOD', "return typeof key === 'string' && ALBUM_KEYS.includes(key);", 'return true;', '모르는 시즌도 도감으로', 'isKey'],
  ['MOD', '.sort((a, b) => (a.order | 0) - (b.order | 0))', '', '등록 순서를 안 지킴', 'parts'],
  ['MOD', '(p.season || \'\') === key', 'p.season === key', 'season 이 없는 파츠가 상시에서 빠짐', 'parts'],
  ['MOD', 'Math.max(0, Math.min(100, Math.round((owned | 0) * 100 / total)))', 'Math.round(owned * 100 / total)', '막대가 100 을 넘음', 'pct'],
  ['MOD', 'return Math.max(1, Math.ceil((n | 0) / size));', 'return Math.ceil(n / size);', '0개면 0쪽', 'pages'],
  ['MOD', 'const ALBUM_KEYS = Object.freeze(', 'const ALBUM_KEYS = (', '도감 목록을 바꿀 수 있음', 'consts'],
  ['GACHA', 'const pages = gachaAlbum.pageCount(list.length, GACHA_PAGE_SIZE);', 'const pages = Math.max(1, Math.ceil(list.length / GACHA_PAGE_SIZE));', 'gacha.js 가 쪽 셈을 다시 씀', 'W'],
  ['GACHA', 'const GACHA_SEASON_LABEL = gachaAlbum.ALBUM_LABEL;', "const GACHA_SEASON_LABEL = { '':'상시', spring:'🌸 봄', winter:'❄ 겨울' };", 'gacha.js 가 시즌 이름표를 다시 씀', 'W'],
  ['HTML', '<script src="parts/character/gacha-album.js"></script>', '', 'html 이 안 실음', 'W'],
];
const missed = [];
for (const [where, from, to, what, key] of BREAKS) {
  const src = { MOD, GACHA, HTML }[where];
  if (src.indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const bad = src.split(from).join(to);
  let caught;
  if (where === 'MOD') { const r = judge(bad); caught = !!r.err || r[key] === false; }
  else { const w = where === 'GACHA' ? wiring(bad, HTML, SMOKE) : wiring(GACHA, bad, SMOKE); caught = !w.order || !w.takes || w.calls.length > 0 || w.dup.length > 0; }
  if (!caught) missed.push(what);
}
chk(!missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

say('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
