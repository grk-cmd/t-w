/* ═══ 🏠 sim-myhome-api.js — 마이홈 api provider (0.13 앱 묶음 D2-1) ═══
   [왜] 마이홈 · 책장이 Firebase 대신 서버 API 를 쓴다. 서버 모양 → 화면 모양, 저장 본문(바뀐 칸만 · 통째)을 만드는 곳이 provider 하나라 실제로 불러서 판정한다.
   ・1절: 읽기 — 서버 홈 → 화면 홈(스티커 {sid} · img · 프리셋 3칸 · 배경) · 빈 홈 · 못 받음 · 모양 틀림 · 남의 집(프리셋 없음) · 책장
   ・2절: 쓰기 본문 — PATCH 바뀐 칸만 · 지우기 null · 스티커 순서 · 6장 옛 홈 · 디자인 3칸 · 바탕화면 통째 + https · 책 이름 바꿈 · addedAt · data: 없음
   ・3절: 주인 묶기 · 그림 올리기 · 오류 갈래 · 배선 · 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  API: pick(at('myhome-api.js', 'myhome')), IMG: pick(at('image-bytes.js', 'shared')), AE: pick(at('api-errors.js', 'shared')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']), SMOKE: pick(['smoke.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const loadW = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
let IMGSRC = SRC0.IMG;
const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const png = (n) => 'data:image/png;base64,' + Buffer.alloc(n, 7).toString('base64');
const throws = async (fn) => { try{ await fn(); return null; }catch(e){ return e || {}; } };

function fake(routes){
  const log = [];
  const run = async (method, path, body, opts) => {
    log.push({ method, path, body, opts });
    if(opts && typeof opts.onOwner === 'function') opts.onOwner('ME');
    const key = method + ' ' + path.split('?')[0];
    if(!(key in routes)) throw apiErr(404, 'NOT_FOUND');
    const r = routes[key]; const v = typeof r === 'function' ? r(body, path, opts) : r;
    if(v instanceof Error) throw v;
    return v;
  };
  return { log, get: (p, o) => run('GET', p, undefined, o), post: (p, b, o) => run('POST', p, b, o), put: (p, b, o) => run('PUT', p, b, o), patch: (p, b, o) => run('PATCH', p, b, o) };
}
const mk = (S, routes) => {
  const authed = fake(routes || {}), warns = [];
  const M = loadW(S.API, 'TwMyHomeApi');
  const imageBytes = loadW(IMGSRC, 'TwImageBytes');
  return { m: M.createMyHomeApi({ authed, imageBytes, warn: (...a) => warns.push(a.join(' ')) }), authed, warns, M };
};

const SV_STICKER = (id, o) => Object.assign({ id, image: 'https://s/' + id + '.png', link: null, x: 10, y: 20, w: 100, h: 80, size: 1.5, rot: 0, z: 2, locked: false, anim: null, animSpeed: null }, o || {});
const SV_HOME = (o) => Object.assign({
  page: { avatar: 'https://s/a.png', bio: '소개', postTitle: '제목', post: '<b>글</b>', bgm: { url: 'https://youtu.be/abcdefghijk', title: '노래' }, bg: { color: '#fff' },
    stickers: [SV_STICKER('s1'), SV_STICKER('s2', { link: 'https://x.y', locked: true, anim: 'float', animSpeed: 'slow' })], theme: { tab: '#111' },
    presets: [{ name: '하나', theme: { tab: '#222' }, bg: { img: 'https://s/p.jpg' }, withImage: true }, null, { name: '셋', theme: {}, bg: null, withImage: false }], presetCur: 2, version: 7 },
  desktop: { bg: { img: 'https://s/d.jpg' }, hideFolders: true, folderPos: { notes: { x: 0.5, y: 0.25 } }, version: 3 },
}, o || {});
const ME = { 'GET /v1/me/myhome': SV_HOME(), 'GET /v1/me/myhome/bookshelf': { version: 4, books: [] } };

async function judge(S){
  IMGSRC = S.IMG;
  const M0 = loadW(S.API, 'TwMyHomeApi');

  say('── 1. 읽기');
  {
    const { m } = mk(S, ME);
    const h = await m.fetchMine();
    chk(h.pageVersion === 7 && h.desktopVersion === 3 && h.page.bio === '소개' && h.page.avatar === 'https://s/a.png' && h.page.post === '<b>글</b>' && eq(h.page.bgm, { url: 'https://youtu.be/abcdefghijk', title: '노래' }) && eq(h.page.bg, { color: '#fff' }), '내 홈 — 판 둘 · 칸 이름 그대로 · 배경 {color}');
    chk(eq(Object.keys(h.page.stickers), ['s1', 's2']) && h.page.stickers.s1.img === 'https://s/s1.png' && !('image' in h.page.stickers.s1) && !('link' in h.page.stickers.s1) && !('locked' in h.page.stickers.s1), '스티커 목록 → {sid:…} · image → img · 없는 링크 · 잠금 칸은 안 둔다');
    chk(h.page.stickers.s2.link === 'https://x.y' && h.page.stickers.s2.locked === true && h.page.stickers.s2.anim === 'float' && h.page.stickers.s2.animSpeed === 'slow' && h.page.stickers.s1.z === 2, '  링크 · 🔒 · 움직임 · z 는 받은 값 그대로');
    chk(h.page.themePresets.length === 3 && h.page.themePresets[1] === null && h.page.themePresets[0].img === true && !('img' in h.page.themePresets[2]) && eq(h.page.themePresets[0].bg, { img: 'https://s/p.jpg' }) && h.page.themePresetCur === 2, '프리셋 늘 3칸 · withImage → img:true · 빈 칸 null');
    chk(eq(h.desktop, { bg: { img: 'https://s/d.jpg' }, hideFolders: true, folderPos: { notes: { x: 0.5, y: 0.25 } } }), '바탕화면 — 배경 · 폴더 숨기기 · 폴더 자리');
    const empty = await mk(S, { 'GET /v1/me/myhome': { page: { avatar: null, bio: null, postTitle: null, post: null, bgm: null, bg: null, stickers: [], theme: {}, presets: [null, null, null], presetCur: 0, version: 0 }, desktop: { bg: null, hideFolders: false, folderPos: {}, version: 0 } } }).m.fetchMine();
    chk(empty.page.bio === '' && empty.page.avatar === null && empty.page.theme === null && eq(empty.page.stickers, {}) && empty.page.bg === null && empty.desktop.bg === null && empty.pageVersion === 0, '빈 홈 → 빈 값(던지지 않음)');
    const down = await throws(() => mk(S, { 'GET /v1/me/myhome': apiErr(503, 'X') }).m.fetchMine());
    chk(down && down.status === 503, '못 받음 → 던진다(빈 홈으로 돌리지 않는다)');
    for(const [what, bad] of [['page 없음', { desktop: SV_HOME().desktop }], ['스티커가 목록 아님', Object.assign(SV_HOME(), { page: Object.assign({}, SV_HOME().page, { stickers: {} }) })], ['바탕화면 폴더 칸 없음', { page: SV_HOME().page, desktop: { hideFolders: false } }]]){
      const e = await throws(() => mk(S, { 'GET /v1/me/myhome': bad }).m.fetchMine());
      chk(e && e.code === 'SHAPE', '모양 틀림(' + what + ') → SHAPE 로 던진다');
    }
    const broken = SV_HOME(); broken.page.stickers.push({ id: '', image: 'x' }, { id: 'z', image: '' });
    chk(eq(Object.keys((await mk(S, { 'GET /v1/me/myhome': broken }).m.fetchMine()).page.stickers), ['s1', 's2']), '깨진 스티커 줄만 뺀다');
    const vis = SV_HOME(); delete vis.page.presets; delete vis.page.presetCur; delete vis.page.version; delete vis.desktop.version;
    const v = mk(S, { 'GET /v1/myhomes/uF%2F1': vis });
    const vh = await v.m.fetchOf('uF/1');
    chk(vh.page.themePresets === null && vh.page.themePresetCur === null && !('pageVersion' in vh) && vh.desktop.hideFolders === true, '남의 집 — 프리셋 · 판 없음 · 코드는 인코딩');
    chk((await throws(() => v.m.patchPage(1, { bio: 'x' }))).code === 'NOT_RECEIVED' && v.authed.log.length === 1, '  남의 집 읽기는 주인을 남기지 않는다 → 이어 쓰기 요청 0');
    const bs = await mk(S, { 'GET /v1/me/myhome/bookshelf': { version: 4, books: [{ id: 'b1', url: null, title: '책', width: 'thick', height: 'long', color: '#112233', titleColor: '#ffffff', hideTitle: true, public: true, image: 'https://s/b.webp', addedAt: '2026-11-10T01:02:03Z' }] } }).m.fetchBookshelf();
    chk(bs.version === 4 && eq(bs.books[0], { id: 'b1', url: '', title: '책', w: 'thick', h: 'long', color: '#112233', tcolor: '#ffffff', hideTitle: true, pub: true, at: Date.parse('2026-11-10T01:02:03Z'), img: 'https://s/b.webp' }), '책장 — width/titleColor/public/image/addedAt → w/tcolor/pub/img/at(ms)');
    const pub = await mk(S, { 'GET /v1/myhomes/uF/bookshelf': { books: [] } }).m.fetchBookshelfOf('uF');
    chk(eq(pub, { books: [] }), '공개 책 0권 = 빈 목록(못 읽음과 다름)');
    const nf = await throws(() => mk(S, { 'GET /v1/myhomes/uX': apiErr(404, 'USER_NOT_FOUND') }).m.fetchOf('uX'));
    chk(nf && nf.code === 'USER_NOT_FOUND', '없는 사람 → USER_NOT_FOUND 로 던진다');
  }

  say('── 2. 쓰기 본문');
  {
    const t = mk(S, Object.assign({ 'PATCH /v1/me/myhome': { version: 8 }, 'PUT /v1/me/myhome/design': { version: 9 }, 'PUT /v1/me/myhome/desktop': { version: 4 }, 'PUT /v1/me/myhome/bookshelf': { version: 5, books: [] } }, ME));
    chk((await throws(() => t.m.patchPage(7, { bio: 'x' }))).code === 'NOT_RECEIVED' && t.authed.log.length === 0, '내 홈을 받기 전 쓰기 → 요청 0');
    await t.m.fetchMine(); t.authed.log.length = 0;
    const v = await t.m.patchPage(7, { bio: '새 소개' });
    const p = t.authed.log[0];
    chk(v === 8 && p.method === 'PATCH' && p.path === '/v1/me/myhome' && eq(p.body, { version: 7, bio: '새 소개' }) && 'expectOwner' in p.opts, 'PATCH — 바뀐 칸만 {version, bio} · 새 판을 돌려줌 · 주인과 묶음');
    await t.m.patchPage(8, { avatar: null, bgm: null, bg: null, postTitle: '' });
    chk(eq(t.authed.log[1].body, { version: 8, avatar: null, postTitle: '', bgm: null, bg: null }) && !('bio' in t.authed.log[1].body), '지우기는 null · 빈 글은 빈 글 · 안 바뀐 칸은 열쇠가 없음');
    await t.m.patchPage(8, { bgm: { url: 'https://youtu.be/abcdefghijk', title: 'T' }, bg: { color: '#abc' } });
    chk(eq(t.authed.log[2].body, { version: 8, bgm: { url: 'https://youtu.be/abcdefghijk', title: 'T' }, bg: { color: '#abc' } }), 'BGM · 배경 {color} 본문');
    await t.m.patchPage(8, { clearTheme: true });
    chk(eq(t.authed.log[3].body, { version: 8, theme: null }), '남은 테마 지우기 = theme:null(S4)');
    const st = {
      a: { img: 'https://s/a.png', z: 5, x: 1, y: 2, w: 100, h: 50, size: 2, rot: 10, locked: true, link: 'https://l.k', anim: 'bounce', animSpeed: 'fast' },
      b: { img: 'https://s/b.png', z: 1 }, c: { img: 'https://s/c.png' },
    };
    await t.m.patchPage(8, { stickers: st });
    const sb = t.authed.log[4].body.stickers;
    chk(eq(sb.map((s) => s.id), ['c', 'b', 'a']) && sb[2].image === 'https://s/a.png' && sb[2].locked === true && sb[2].z === 5 && sb[1].locked === false && !('z' in sb[0]) && !('link' in sb[1]) && !('anim' in sb[1]), '스티커 본문 — 그리는 순서 목록 · z 없으면 맨 뒤 · 빈 칸은 안 실음');
    const six = {}; for(let i = 0; i < 6; i++) six['s' + i] = { img: 'https://s/' + i + '.png', z: i };
    await t.m.patchPage(8, { stickers: six });
    chk(t.authed.log[5].body.stickers.length === 6, '6장 옛 홈도 그대로 보낸다(새로 붙이기만 앱이 막는다)');
    await t.m.putDesign(9, { theme: { tab: '#1' }, presets: [{ name: 'A', theme: { tab: '#2' }, bg: { img: 'https://s/p.jpg' }, img: true }], presetCur: 1 });
    const d = t.authed.log[6];
    chk(d.method === 'PUT' && d.path === '/v1/me/myhome/design' && eq(d.body, { version: 9, theme: { tab: '#1' }, presets: [{ name: 'A', theme: { tab: '#2' }, bg: { img: 'https://s/p.jpg' }, withImage: true }, null, null], presetCur: 1 }), '디자인 — 프리셋 늘 3칸(빈 칸 null) · img → withImage · 바깥 배경은 열쇠 없으면 안 실음');
    await t.m.putDesign(9, { theme: {}, presets: [null, null, null], presetCur: 0, bg: null });
    chk(eq(t.authed.log[7].body.bg, null) && 'bg' in t.authed.log[7].body, '  bg 열쇠가 있으면(null 도) 싣는다');
    await t.m.putDesktop(3, { bg: { img: 'http://x.y/z.png' }, hideFolders: true, folderPos: { notes: { x: 0.1, y: 0.2, extra: 9 } } });
    chk(eq(t.authed.log[8].body, { version: 3, bg: { img: 'https://x.y/z.png' }, hideFolders: true, folderPos: { notes: { x: 0.1, y: 0.2 } } }) && t.authed.log[8].method === 'PUT', '바탕화면 — 통째 · http:// 는 https:// 로');
    await t.m.putDesktop(3, { bg: null, hideFolders: false, folderPos: {} });
    chk(eq(t.authed.log[9].body, { version: 3, bg: null, hideFolders: false, folderPos: {} }), '  배경 없음 = null · 폴더 자리 빈 객체');
    const r = await t.m.putBookshelf(4, [
      { id: 'n1', url: 'https://a.b', title: '새 책', w: 'thick', h: 'long', color: '#112233', tcolor: '#ffffff', hideTitle: true, pub: true, img: 'https://s/i.webp' },
      { id: 'o1', url: '', title: '옛 책', w: 'thin', h: 'short', color: '#8f5a4a', tcolor: '#ffffff', hideTitle: false, pub: false, at: Date.parse('2026-01-02T03:04:05Z') }]);
    const bb = t.authed.log[10].body;
    chk(t.authed.log[10].path === '/v1/me/myhome/bookshelf' && bb.version === 4 && bb.books[0].width === 'thick' && bb.books[0].titleColor === '#ffffff' && bb.books[0].public === true && bb.books[0].image === 'https://s/i.webp' && bb.books[0].url === 'https://a.b' && !('addedAt' in bb.books[0]), '책 본문 — 이름 바꿈(w → width …) · 새 책은 addedAt 없음');
    chk(bb.books[1].addedAt === '2026-01-02T03:04:05.000Z' && !('url' in bb.books[1]) && !('image' in bb.books[1]) && eq(bb.books.map((b) => b.id), ['n1', 'o1']), '  있던 책은 받은 시각 그대로 · 빈 주소 · 그림은 안 실음 · 목록 차례 = 순서');
    chk(eq(r, { books: [], version: 5 }), '  응답 { books, version } 을 화면 모양으로');
    const noColor = t.M.booksBody([{ id: 'c1', title: 't', w: 'thin', h: 'short' }, { id: 'c2', title: 't', w: 'thin', h: 'short', color: '', tcolor: '' }]);
    chk(noColor.every((b) => !('color' in b) && !('titleColor' in b)), '  색이 없는 옛 책은 color · titleColor 열쇠를 싣지 않는다("" 를 보내면 서버가 400)');
    chk(t.authed.log.every((x) => !/"data:/.test(JSON.stringify(x.body))), '본문 어디에도 data: 없음');
    const before = t.authed.log.length;
    const bads = [['PATCH 스티커', () => t.m.patchPage(8, { stickers: { a: { img: png(5) } } })], ['PATCH 사진', () => t.m.patchPage(8, { avatar: png(5) })], ['디자인 테마', () => t.m.putDesign(9, { theme: { tabImg: png(5) }, presets: [], presetCur: 0 })], ['바탕화면', () => t.m.putDesktop(3, { bg: { img: png(5) }, hideFolders: false, folderPos: {} })], ['책 그림', () => t.m.putBookshelf(4, [{ id: 'b', img: png(5), color: '#112233', tcolor: '#ffffff' }])]];
    for(const [what, f] of bads) chk((await throws(f)).code === 'IMAGE_UPLOAD', 'data: 그림이 실리면 요청 없이 IMAGE_UPLOAD — ' + what);
    chk(t.authed.log.length === before, '  거른 것은 요청 0');
    const noVer = mk(S, Object.assign({ 'PATCH /v1/me/myhome': {} }, ME)); await noVer.m.fetchMine();
    chk((await throws(() => noVer.m.patchPage(1, { bio: 'x' }))).code === 'SHAPE', '저장 답에 version 이 없으면 SHAPE');
  }

  say('── 3. 그림 · 주인 · 오류');
  {
    const up = mk(S, Object.assign({ 'POST /v1/me/images': { url: 'https://s/mh_1.png' } }, ME));
    chk((await throws(() => up.m.uploadImage(png(10)))).code === 'NOT_RECEIVED' && up.authed.log.length === 0, '그림 올리기 — 받기 전엔 요청 0');
    await up.m.fetchMine(); up.authed.log.length = 0;
    const url = await up.m.uploadImage(png(10));
    const p = up.authed.log[0];
    chk(url === 'https://s/mh_1.png' && p.path === '/v1/me/images?purpose=myhome' && p.opts.rawType === 'image/png' && p.body instanceof Uint8Array && p.body.length === 10 && 'expectOwner' in p.opts, 'POST /v1/me/images?purpose=myhome · 바이트 그대로 · png → { url }');
    chk(!!(await up.m.uploadImage('data:image/jpeg;base64,AAAA')) && !!(await up.m.uploadImage(png(8 * 1024 * 1024))), 'jpeg 도 올린다 · 딱 8MB 는 올린다(경계)');
    const before = up.authed.log.length;
    for(const [what, u] of [['8MB 초과', png(8 * 1024 * 1024 + 1)], ['빈 그림', 'data:image/png;base64,'], ['data: 아님', 'https://x/y.png'], ['gif', 'data:image/gif;base64,AAAA']]) chk((await throws(() => up.m.uploadImage(u))).code === 'IMAGE_UPLOAD', what + ' → 요청 없이 IMAGE_UPLOAD');
    chk(up.authed.log.length === before, '  거른 그림은 요청 0');
    const nu = mk(S, Object.assign({ 'POST /v1/me/images': {} }, ME)); await nu.m.fetchMine();
    chk((await throws(() => nu.m.uploadImage(png(3)))).code === 'SHAPE', '  답에 url 이 없으면 SHAPE');
    const o = mk(S, Object.assign({ 'PATCH /v1/me/myhome': () => { throw Object.assign(new Error('o'), { code: 'OWNER_CHANGED' }); } }, ME)); await o.m.fetchMine();
    chk((await throws(() => o.m.patchPage(1, { bio: 'x' }))).code === 'OWNER_CHANGED' && (await throws(() => o.m.patchPage(1, { bio: 'x' }))).code === 'NOT_RECEIVED' && o.authed.log.filter((x) => x.method === 'PATCH').length === 1, '계정이 바뀌면 OWNER_CHANGED 뒤 다시 읽기 전까지 요청 0');
    const r = mk(S, Object.assign({ 'PATCH /v1/me/myhome': { version: 1 } }, ME)); await r.m.fetchMine(); r.m.reset();
    chk((await throws(() => r.m.patchPage(1, { bio: 'x' }))).code === 'NOT_RECEIVED', 'reset 뒤엔 다시 읽기 전까지 요청 0');
    let release;
    const slow = mk(S, { 'GET /v1/me/myhome': (b, p, op) => new Promise((res) => { release = () => { op.onOwner('A'); res(SV_HOME()); }; }) });
    const pend = slow.m.fetchMine(); slow.m.reset(); release(); await pend;
    chk((await throws(() => slow.m.patchPage(1, { bio: 'x' }))).code === 'NOT_RECEIVED', '  reset 전에 떠난 읽기 답은 주인을 되살리지 않는다');

    const AE = loadW(S.AE, 'TwApiErrors');
    const f = (e) => M0.failOf(e, AE);
    chk(['MYHOME_STICKER_FULL', 'MYHOME_BOOKSHELF_FULL', 'MYHOME_INVALID_BGM'].every((c) => f(apiErr(409, c)).kind === 'guide' || f(apiErr(400, c)).kind === 'guide'), '안내(번호 없음) — 스티커 · 책 가득 · BGM 주소');
    chk(f(apiErr(404, 'USER_NOT_FOUND')).kind === 'missing', '없는 사람 → missing');
    chk(['MYHOME_TEXT_TOO_LONG', 'MYHOME_INVALID_IMAGE_URL', 'MYHOME_INVALID_LINK', 'MYHOME_INVALID_THEME', 'MYHOME_INVALID_FOLDER_POS', 'INVALID_REQUEST', 'IMAGE_UPLOAD', 'SHAPE'].every((c) => f(apiErr(400, c)).kind === 'site'), '그 자리 번호 — 글 길이 · 주소 · 링크 · 테마 · 폴더 자리 · 모양 · 올리기');
    chk(f(apiErr(409, 'CONCURRENT_UPDATE')).kind === 'conflict' && f(apiErr(403, 'PREMIUM_REQUIRED')).kind === 'common', '409 → conflict · 프리미엄 → 공통(E-NET-03)');
    chk(f(apiErr(0, '')).kind === 'site' && f(Object.assign(new Error('x'), { code: 'OWNER_CHANGED' })).kind === 'stale' && f(Object.assign(new Error('x'), { code: 'NOT_RECEIVED' })).kind === 'stale', '닿지 못함 → site · 계정 바뀜 · 받기 전 → stale(조용히)');
  }

  say('── 4. 배선');
  {
    const h = S.HTML, i = h.indexOf('<script src="parts/myhome/myhome-api.js"></script>'), a = h.indexOf('<script src="parts/app.js"></script>');
    chk(i > 0 && a > i, 'html — myhome-api.js 가 app.js 보다 먼저');
    chk(/PRELOAD\.push\('myhome-api\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 myhome-api.js');
    chk(!/firebase|firebaseAPI|localStorage/.test(strip(S.API)), 'provider 는 Firebase · 로컬 저장을 부르지 않는다');
  }
}

async function runAll(){
  const S = SRC0;
  await judge(S);
  say('── 5. 일부러 깨 보기');
  const breaks = [
    ['안 바뀐 칸도 실음', S.API.replace("for(const k of ['avatar', 'bio', 'postTitle', 'post']) if(own(f, k))", "for(const k of ['avatar', 'bio', 'postTitle', 'post'])"), '바뀐 칸만'],
    ['data: 를 걸러내지 않음', S.API.replace("if(hasData(body)) throw", "if(false) throw"), 'data:'],
    ['못 받음을 빈 홈으로', S.API.replace("fetchMine: async () => need(homeOf(await readMine(PATHS.mine))),", "fetchMine: async () => { try{ return need(homeOf(await readMine(PATHS.mine))); }catch(_){ return { page: {}, desktop: {} }; } },"), '던진다'],
    ['프리셋 2칸으로 보냄', S.API.replace("for(let i = 0; i < LIMITS.PRESETS; i++){\n    const p = Array", "for(let i = 0; i < 2; i++){\n    const p = Array"), '3칸'],
    ['쓰기가 주인을 안 묶음', S.API.replace("try{ return await send({ expectOwner: owner }); }", "try{ return await send({}); }"), 'expectOwner'],
    ['읽기 전에도 보냄', S.API.replace("if(owner === undefined) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');", ""), '요청 0'],
    ['남의 집 읽기가 주인을 바꿈', S.API.replace("fetchOf: async (userCode) => need(homeOf(await authed.get(PATHS.of(needCode(userCode)), { auth: true }))),", "fetchOf: async (userCode) => need(homeOf(await readMine(PATHS.of(needCode(userCode))))),"), '주인을 남기지'],
    ['새 책에 addedAt 을 싣음', S.API.replace("if(fin(b.at) && b.at > 0) o.addedAt", "o.addedAt"), 'addedAt'],
    ['http 주소를 그대로', S.API.replace("b.img.replace(/^http:\\/\\//i, 'https://')", "b.img"), 'https'],
    ['스티커를 키 차례로 보냄', S.API.replace(".sort((a, b) => (a.z - b.z) || (a.i - b.i))", ""), '그리는 순서'],
    ['reset 이 늦은 읽기를 안 막음', S.API.replace("if(at === epoch) owner = who;", "owner = who;"), 'reset'],
    ['테마 지우기를 안 실음', S.API.replace("if(f.clearTheme === true) body.theme = null;", ""), 'theme:null'],
    ['그림 크기를 안 거름', S.IMG.replace("img.bytes.length > o.maxBytes", "false"), '8MB', 'IMG'],
    ['409 를 site 로', S.API.replace("else if(t.code === CONCURRENT_CODE) kind = KIND.CONFLICT;", ""), 'conflict'],
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
