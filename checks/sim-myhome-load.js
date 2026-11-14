/* sim-myhome-load.js — 🏠 마이홈 불러오기가 저장한 칸을 빠짐없이 되살리는지 (D2-2 — 받기는 myhome-api.js 가 서버 모양을 맞추고 myhome-store.js 가 들고 있다)
   실행:  node sim-myhome-load.js   (러너 스테이징 — 모듈과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 «[마이홈] 수정 — 제목 바꿨는데 다시 마이홈 수정 눌러보면 1 2 3 으로만 뜹니다».
     👑 디자인 프리셋(themePresets · themePresetCur)은 저장에는 실려 갔지만 불러오기가 칸 이름을 하나하나 적어 새로 만들면서 그 둘을 빠뜨렸다.
     그래서 창을 다시 열면 프리셋 이름이 자리 번호(1 2 3)로 돌아가고, 다음 자동 저장이 서버의 프리셋까지 지웠다.
     지금은 서버 → 화면 모양 맞추기가 myhome-api.js 한 곳(homeOf · pageOf)이고 값은 상태 주인(myhome-store.js)이 들고 있다.
   ★ 무엇을 보는가
     §1 불러오기 한 곳 — loadMyHomePage 는 상태 주인 pullMine 으로 받고 · 친구 홈 구경은 openView 로 받는다(칸 목록을 따로 적지 않는다 · 옛 _mhHomeFromServer 없음)
     §2 서버 → 화면: 화면이 쓰는 칸 전부(상태 주인의 빈 페이지 칸)가 homeOf 결과에 들어 있다
     §3 받기 → 저장 한 바퀴: 프리셋 이름 · 고른 칸이 그대로, 글 하나를 고쳐 저장해도(PATCH) 프리셋을 안 건드리고 디자인을 다시 저장해도 프리셋이 남는다
     §4 프리셋 칸을 빠뜨린 불러오기를 넣으면 §2 · §3 이 빨강이 된다 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'app/parts/myhome/' + f, 'parts/myhome/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = {};
for (const f of ['myhome-api.js', 'myhome-store.js', 'myhome-page.js', 'myhome-visit.js', 'api-errors.js', 'myhome-sticker-rules.js', 'app.js']) { SRC[f] = read(f); if (!SRC[f]) { say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const flush = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

const SERVER = () => ({
  page: { version: 4, avatar: 'https://x/a.jpg', bio: '안녕', postTitle: '제목', post: '글', theme: { tab: '#112233' }, stickers: [], bgm: { url: 'u', title: 't' }, bg: { color: '#000000' },
    presets: [{ name: '봄', theme: { tab: '#ff0000' }, bg: null, withImage: false }, null, { name: '겨울', theme: {}, bg: { color: '#fff' }, withImage: false }], presetCur: 2 },
  desktop: { version: 2, bg: null, hideFolders: false, folderPos: {} },
});

async function judge(apiSrc, quiet){
  let bad = 0;
  const c = quiet ? (ok) => { if (!ok) bad++; } : (ok, msg) => { if (!ok) bad++; chk(ok, msg); };
  const lib = loadMod(apiSrc);
  const rules = loadMod(SRC['myhome-sticker-rules.js']);
  const log = [];
  const api = {
    fetchMine: async () => { const h = lib.homeOf(SERVER()); if (!h) throw new Error('모양'); return h; },
    fetchOf: async () => { const h = lib.homeOf(SERVER()); return { page: h.page, desktop: h.desktop }; },
    patchPage: async (v, f) => { log.push(['PATCH', clone(f)]); return v + 1; },
    putDesign: async (v, d) => { log.push(['PUT', clone(d)]); return v + 1; },
    uploadImage: async () => 'https://x/u.png', reset: () => {},
  };
  const store = loadMod(SRC['myhome-store.js']).createMyHomeStore({ api, lib, errs: loadMod(SRC['api-errors.js']), apiErrors: { notify: () => {} }, notifyError: () => true, toast: () => {}, previewOn: () => false, rules });

  if (!quiet) say('§2 서버 → 화면: 화면이 쓰는 칸이 전부 있다');
  const keys = Object.keys(store.mine().page);
  const got = lib.homeOf(SERVER()).page;
  keys.forEach((k) => c(Object.prototype.hasOwnProperty.call(got, k), '받은 결과에 «' + k + '» 칸'));

  if (!quiet) say('§3 받기 → 저장 한 바퀴');
  await store.pullMine();
  const p = store.page();
  const label = (i) => (p.themePresets && p.themePresets[i] && p.themePresets[i].name) || String(i + 1);
  c(label(0) === '봄' && label(1) === '2' && label(2) === '겨울', '★ 다시 연 디자인 스튜디오 프리셋 이름 — 봄 · 2 · 겨울 (지금: ' + [0, 1, 2].map(label).join(' · ') + ')');
  c(p.themePresetCur === 2, '고른 칸(themePresetCur)이 되살아난다');
  c(p.bio === '안녕' && p.postTitle === '제목' && p.post === '글' && p.avatar === 'https://x/a.jpg' && p.bgm && p.bgm.url === 'u' && p.bg && p.bg.color === '#000000' && p.theme && p.theme.tab === '#112233', '나머지 칸도 그대로(소개 · 제목 · 글 · 사진 · BGM · 배경 · 테마)');
  await store.setField('bio', '바꿈');
  c(log.length === 1 && log[0][0] === 'PATCH' && Object.keys(log[0][1]).join() === 'bio', '글 하나만 고쳐 저장하면 PATCH 에 글만 — 프리셋을 건드리지 않는다');
  await store.setDesign({ theme: { tab: '#abcdef' } });
  const put = log.find((l) => l[0] === 'PUT');
  c(!!put && put[1].presets && put[1].presets[0] && put[1].presets[0].name === '봄' && put[1].presets[2].name === '겨울' && put[1].presetCur === 2, '디자인을 다시 저장해도(프리셋을 안 넘겨도) 프리셋 · 고른 칸이 그대로 실린다');
  const blank = loadMod(SRC['myhome-store.js']).createMyHomeStore({ api, lib, errs: loadMod(SRC['api-errors.js']), apiErrors: { notify: () => {} }, notifyError: () => true, toast: () => {}, previewOn: () => false, rules });
  c(blank.page().bio === '' && blank.page().avatar === null && blank.page().themePresets === null && blank.page().themePresetCur === null && JSON.stringify(blank.page().stickers) === '{}', '받기 전 빈 홈은 기본값(프리셋 없음)');
  c(!JSON.stringify(blank.page()).includes('undefined'), 'undefined 칸 없음');
  return bad;
}

(async () => {
  say('§1 불러오기 한 곳');
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  const PAGE = strip(SRC['myhome-page.js']), VISIT = strip(SRC['myhome-visit.js']), APP = strip(SRC['app.js']);
  chk(/myhomeStore\.pullMine\(/.test(PAGE), 'loadMyHomePage(내 홈)가 상태 주인 pullMine 으로 받는다');
  chk(/myhomeStore\.openView\(/.test(VISIT), 'openFriendHomeView(친구 홈)가 상태 주인 openView 로 받는다');
  chk(!/_mhHomeFromServer|getMyHome|saveMyHome/.test(PAGE + VISIT + APP), '옛 칸별 불러오기(_mhHomeFromServer) · firebaseAPI.getMyHome · saveMyHome 이 어디에도 남아 있지 않다');
  chk(/themePresets:[^\n]*presetsOf/.test(SRC['myhome-api.js']) && /themePresetCur:/.test(SRC['myhome-api.js']), '서버 → 화면 맞추기(pageOf)가 프리셋 두 칸을 싣는다');
  await judge(SRC['myhome-api.js'], false);

  say('§4 프리셋 칸을 빠뜨린 불러오기를 넣으면 빨강');
  const OLD = SRC['myhome-api.js'].replace(/\n    themePresets: hasPresets \? presetsOf\(p\.presets\) : null,\n    themePresetCur: cnt\(p\.presetCur\) \? p\.presetCur : null,/, '');
  chk(OLD !== SRC['myhome-api.js'], '(깰 자리를 찾았다)');
  const oldBad = await judge(OLD, true);
  chk(oldBad >= 3, '프리셋 칸을 뺀 판은 빨강 ' + oldBad + '건 (칸 · 이름 표시 · 고른 칸 · 디자인 저장)');
  say('');
  say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 다시 열어도 프리셋 이름 · 고른 칸이 그대로, 다음 저장이 지우지 않는다');
  process.exit(fail ? 1 : 0);
})();
