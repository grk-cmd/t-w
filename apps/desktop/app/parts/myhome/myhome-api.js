/* myhome-api.js — 🏠 마이홈 api provider (검사 sim-myhome-api.js)
   책임: 내 마이홈 읽기(GET /v1/me/myhome — 페이지 + 바탕화면) · 남의 마이홈(GET /v1/myhomes/{userCode}) · 내 책장(GET /v1/me/myhome/bookshelf) · 남의 공개 책(GET /v1/myhomes/{userCode}/bookshelf) ·
     페이지 칸 저장(PATCH /v1/me/myhome) · 디자인 저장(PUT …/design) · 바탕화면 저장(PUT …/desktop) · 책장 저장(PUT …/bookshelf) · 그림 올리기(POST /v1/me/images?purpose=myhome).
     서버 모양(스티커 목록 · image · 프리셋 withImage · 책 width/titleColor/public/image/addedAt ISO)을 화면 모양(스티커 {sid:…} · img · img:true · w/tcolor/pub/img/at ms)으로 맞추는 곳은 여기뿐이다.
   신원: 늘 토큰의 «나» — 본문에 내 코드 · 이름 · 시각을 싣지 않는다. 경로의 코드는 구경하는 집(데이터 주소)일 뿐.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · post · put · patch(…, { expectOwner, rawType }) → Promise<data>)
         imageBytes — TwImageBytes(shared/image-bytes.js)
         warn(...a)(진단 로그)
   내보냄: createMyHomeApi(deps) → {
     fetchMine() → { page, pageVersion, desktop, desktopVersion } — 빈 홈도 빈 값으로(던지지 않음). 못 읽으면 던진다. 내 홈 읽기만 토큰 주인을 기억한다.
     fetchOf(userCode) → { page(프리셋 없음), desktop } — 주인 기억을 안 바꾼다.
     fetchBookshelf() → { books, version } · fetchBookshelfOf(userCode) → { books }(공개한 책만)
     patchPage(version, fields) → Promise<version> — fields 에 있는 칸만 싣는다(지우기는 null · stickers 는 {sid:…} 통째 → 그리는 순서 목록 · clearTheme:true 는 theme:null)
     putDesign(version, { theme, presets, presetCur, bg? }) → Promise<version> — bg 열쇠가 있을 때만 싣는다
     putDesktop(version, { bg, hideFolders, folderPos }) → Promise<version> — 통째
     putBookshelf(version, books) → Promise<{ books, version }> — 통째(순서 = 목록 순서)
     uploadImage(dataUrl) → Promise<url> — png · webp · jpeg · 8MB 이하. 아니면 요청 없이 IMAGE_UPLOAD 로 던진다.
     reset() — 읽은 토큰 주인 기억을 비운다
   }
     순수: homeOf · pageOf · stickersOf · stickersBody · presetsOf · presetsBody · desktopOf · desktopBody · booksOf · booksBody · failOf · ERRORS · KIND · PATHS · LIMITS (TwMyHomeApi 위)
   ⚠️ 쓰기는 «읽은 토큰의 주인» 과 묶는다(expectOwner) — 읽은 적이 없으면 NOT_RECEIVED 로 요청 0. 계정이 바뀌면 OWNER_CHANGED(요청 0).
   ⚠️ 저장 본문 어디에도 data: 그림을 싣지 않는다 — 있으면 요청 없이 IMAGE_UPLOAD. 먼저 uploadImage 로 올려 받은 주소만 싣는다.
   ⚠️ 409 CONCURRENT_UPDATE 에 여기서 다시 받아 한 번 더 보내지 않는다 — 판(version)은 상태 주인이 들고 넘긴다.
   검사: checks/sim-myhome-api.js */
(function(){
'use strict';

const enc = encodeURIComponent;
const PATHS = Object.freeze({
  mine: '/v1/me/myhome',
  of: (userCode) => '/v1/myhomes/' + enc(userCode),
  design: '/v1/me/myhome/design',
  desktop: '/v1/me/myhome/desktop',
  bookshelf: '/v1/me/myhome/bookshelf',
  bookshelfOf: (userCode) => '/v1/myhomes/' + enc(userCode) + '/bookshelf',
  image: '/v1/me/images?purpose=myhome',
});
/* 서버 상한과 같은 값 — 업무 상한(스티커 5 · 책 50)은 앱이 먼저 막고, 옛 홈은 그대로 보낸다 */
const LIMITS = Object.freeze({ STICKERS: 5, BOOKS: 50, PRESETS: 3, FOLDERS: 12, IMAGE_BYTES: 8 * 1024 * 1024 });
const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp', 'image/jpeg']);
const NOT_RECEIVED_CODE = 'NOT_RECEIVED';
const IMAGE_UPLOAD_CODE = 'IMAGE_UPLOAD';
const CONCURRENT_CODE = 'CONCURRENT_UPDATE';

/* 서버 코드 → 화면이 할 일의 갈래(TwApiErrors.translate 에 넘기는 기능 표 — 공통 표보다 먼저 본다).
   guide = 안내(앱 문구 · 번호 없음) · missing = 그 사람이 없음(번호 없음) · site = 그 자리의 E-MH 번호 · stale = 조용히 버림
   (PREMIUM_REQUIRED 는 공통 E-NET-03 · 409 는 conflict) */
const KIND = Object.freeze({ GUIDE: 'guide', MISSING: 'missing', SITE: 'site', STALE: 'stale', CONFLICT: 'conflict', COMMON: 'common' });
const row = (kind) => Object.freeze({ action: kind, notice: null });
const ERRORS = Object.freeze({
  MYHOME_STICKER_FULL: row(KIND.GUIDE), MYHOME_BOOKSHELF_FULL: row(KIND.GUIDE), MYHOME_INVALID_BGM: row(KIND.GUIDE),
  USER_NOT_FOUND: row(KIND.MISSING),
  MYHOME_TEXT_TOO_LONG: row(KIND.SITE), MYHOME_INVALID_IMAGE_URL: row(KIND.SITE), MYHOME_INVALID_LINK: row(KIND.SITE),
  MYHOME_INVALID_THEME: row(KIND.SITE), MYHOME_INVALID_FOLDER_POS: row(KIND.SITE), MYHOME_INVALID_IMAGE: row(KIND.SITE),
  INVALID_REQUEST: row(KIND.SITE), IMAGE_UPLOAD: row(KIND.SITE), SHAPE: row(KIND.SITE),
  OWNER_CHANGED: row(KIND.STALE), NOT_RECEIVED: row(KIND.STALE),
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const str = (v) => (typeof v === 'string' ? v : '');
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const fin = (v) => typeof v === 'number' && isFinite(v);
const cnt = (v) => typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v;
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const codeError = (code, message) => Object.assign(new Error(message || code), { code });
const msOf = (iso) => { const t = Date.parse(iso); return isFinite(t) ? t : 0; };
const hasData = (body) => JSON.stringify(body).indexOf('"data:') >= 0;

/* 실패 하나 → { kind, code, message }. 기능 표 → 그 갈래 · 409 → conflict · 공통 code → common · 그 밖(닿지 못함 · 모르는 code) → site */
function failOf(err, errs){
  const t = errs.translate(err, ERRORS);
  let kind;
  if(own(ERRORS, t.code)) kind = t.action;
  else if(t.code === CONCURRENT_CODE) kind = KIND.CONFLICT;
  else if(own(errs.COMMON, t.code)) kind = KIND.COMMON;
  else kind = KIND.SITE;
  return { kind, code: t.code, message: str(err && err.message) };
}

/* 서버 배경 { color } | { img } | null → 화면 같은 모양. 둘 다 없으면 null */
function bgOf(b){
  if(!isObj(b)) return null;
  if(nonEmpty(b.img)) return { img: b.img };
  if(nonEmpty(b.color)) return { color: b.color };
  return null;
}
/* 화면 배경 → 서버 본문 배경(없으면 null). 바탕화면의 http:// 그림은 https:// 로 바꿔 보낸다(서버는 https 만) */
function bgBody(b, desktop){
  if(!isObj(b)) return null;
  if(nonEmpty(b.img)) return { img: desktop ? b.img.replace(/^http:\/\//i, 'https://') : b.img };
  if(nonEmpty(b.color)) return { color: b.color };
  return null;
}

/* 서버 스티커 목록 → 화면 { sid: { img, link?, x?, … } }(목록 차례 = 그리는 순서). 깨진 줄은 뺀다 */
function stickersOf(list){
  const out = {};
  if(!Array.isArray(list)) return out;
  for(const s of list){
    if(!isObj(s) || !nonEmpty(s.id) || !nonEmpty(s.image)) continue;
    const o = { img: s.image };
    if(nonEmpty(s.link)) o.link = s.link;
    for(const k of ['x', 'y', 'w', 'h', 'size', 'rot', 'z']) if(fin(s[k])) o[k] = s[k];
    if(s.locked === true) o.locked = true;
    if(nonEmpty(s.anim)) o.anim = s.anim;
    if(nonEmpty(s.animSpeed)) o.animSpeed = s.animSpeed;
    out[s.id] = o;
  }
  return out;
}
/* 그리는 순서(뒤 → 앞) — z 가 없으면 키 차례 자리를 z 로 친다(myhome-sticker-rules.orderedIds 와 같은 규칙) */
function stickerOrder(map){
  const ids = Object.keys(map || {});
  const zOf = (id, i) => { const z = map[id] && map[id].z; return fin(z) ? z : i - ids.length; };
  return ids.map((id, i) => ({ id, i, z: zOf(id, i) })).sort((a, b) => (a.z - b.z) || (a.i - b.i)).map((o) => o.id);
}
/* 화면 스티커 → 서버 본문 목록(그리는 순서) — 칸이 없는 값은 싣지 않는다 · z 는 받은 값 그대로 */
function stickersBody(map){
  const out = [];
  for(const id of stickerOrder(map)){
    const s = map[id];
    if(!isObj(s)) continue;
    const o = { id, image: str(s.img) };
    if(nonEmpty(s.link)) o.link = s.link;
    for(const k of ['x', 'y', 'w', 'h', 'size', 'rot', 'z']) if(fin(s[k])) o[k] = s[k];
    o.locked = s.locked === true;
    if(nonEmpty(s.anim)) o.anim = s.anim;
    if(nonEmpty(s.animSpeed)) o.animSpeed = s.animSpeed;
    out.push(o);
  }
  return out;
}

/* 서버 프리셋 [{ name, theme, bg, withImage } | null] → 화면 늘 3칸 [{ name, theme, bg, img? } | null] */
function presetsOf(list){
  const out = new Array(LIMITS.PRESETS).fill(null);
  if(!Array.isArray(list)) return out;
  for(let i = 0; i < LIMITS.PRESETS; i++){
    const p = list[i];
    if(!isObj(p)) continue;
    out[i] = { name: str(p.name), theme: isObj(p.theme) ? Object.assign({}, p.theme) : {}, bg: bgOf(p.bg) };
    if(p.withImage === true) out[i].img = true;
  }
  return out;
}
/* 화면 프리셋 → 서버 본문 늘 3칸(빈 칸 null) */
function presetsBody(list){
  const out = [];
  for(let i = 0; i < LIMITS.PRESETS; i++){
    const p = Array.isArray(list) || isObj(list) ? list[i] : null;
    if(!isObj(p)){ out.push(null); continue; }
    out.push({ name: str(p.name), theme: isObj(p.theme) ? Object.assign({}, p.theme) : {}, bg: bgBody(p.bg, false), withImage: p.img === true });
  }
  return out;
}

/* 서버 페이지 → 화면 페이지. 모양이 틀리면 undefined. 남의 홈은 프리셋 · 판이 없다 */
function pageOf(p){
  if(!isObj(p) || !Array.isArray(p.stickers)) return undefined;
  const bgm = isObj(p.bgm) && nonEmpty(p.bgm.url) ? { url: p.bgm.url, title: str(p.bgm.title) } : null;
  const hasPresets = Array.isArray(p.presets);
  return {
    avatar: nonEmpty(p.avatar) ? p.avatar : null,
    bio: str(p.bio), postTitle: str(p.postTitle), post: str(p.post),
    bgm, bg: bgOf(p.bg), stickers: stickersOf(p.stickers),
    theme: isObj(p.theme) && Object.keys(p.theme).length ? Object.assign({}, p.theme) : null,
    themePresets: hasPresets ? presetsOf(p.presets) : null,
    themePresetCur: cnt(p.presetCur) ? p.presetCur : null,
  };
}

/* 서버 바탕화면 → 화면 { bg, hideFolders, folderPos }. 모양이 틀리면 undefined */
function desktopOf(d){
  if(!isObj(d) || typeof d.hideFolders !== 'boolean' || !isObj(d.folderPos)) return undefined;
  const folderPos = {};
  for(const id of Object.keys(d.folderPos)){
    const p = d.folderPos[id];
    if(isObj(p) && fin(p.x) && fin(p.y)) folderPos[id] = { x: p.x, y: p.y };
  }
  return { bg: bgOf(d.bg), hideFolders: d.hideFolders, folderPos };
}
/* 화면 바탕화면 → 서버 본문(통째) */
function desktopBody(version, d){
  const o = d || {};
  const folderPos = {};
  const pos = isObj(o.folderPos) ? o.folderPos : {};
  for(const id of Object.keys(pos)) if(isObj(pos[id]) && fin(pos[id].x) && fin(pos[id].y)) folderPos[id] = { x: pos[id].x, y: pos[id].y };
  return { version, bg: bgBody(o.bg, true), hideFolders: o.hideFolders === true, folderPos };
}

/* 서버 홈 → { page, pageVersion?, desktop, desktopVersion? }. 모양이 틀리면 undefined */
function homeOf(d){
  if(!isObj(d)) return undefined;
  const page = pageOf(d.page), desktop = desktopOf(d.desktop);
  if(!page || !desktop) return undefined;
  const out = { page, desktop };
  if(cnt(d.page.version)) out.pageVersion = d.page.version;
  if(isObj(d.desktop) && cnt(d.desktop.version)) out.desktopVersion = d.desktop.version;
  return out;
}

/* 서버 책 한 권 → 화면 책. 깨졌으면 undefined */
function bookOf(b){
  if(!isObj(b) || !nonEmpty(b.id)) return undefined;
  const o = {
    id: b.id, url: str(b.url), title: str(b.title),
    w: b.width === 'thick' ? 'thick' : 'thin', h: b.height === 'long' ? 'long' : 'short',
    color: str(b.color), tcolor: str(b.titleColor), hideTitle: b.hideTitle === true, pub: b.public === true, at: msOf(b.addedAt),
  };
  if(nonEmpty(b.image)) o.img = b.image;
  return o;
}
/* 서버 책 목록 → 화면 책 배열(서버 차례 = 꽂힌 차례). 모양이 틀리면 undefined */
function booksOf(list){
  if(!Array.isArray(list)) return undefined;
  const out = [];
  for(const b of list){ const o = bookOf(b); if(o) out.push(o); }
  return out;
}
/* 화면 책 → 서버 본문 목록(배열 차례 = 순서). 새 책(at 없음)은 addedAt 을 싣지 않는다 — 서버가 지금 시각을 넣는다 */
function booksBody(books){
  const out = [];
  for(const b of books || []){
    if(!isObj(b)) continue;
    const o = { id: str(b.id), title: str(b.title), width: b.w === 'thick' ? 'thick' : 'thin', height: b.h === 'long' ? 'long' : 'short',
      color: str(b.color), titleColor: str(b.tcolor), hideTitle: b.hideTitle === true, public: b.pub === true };
    if(nonEmpty(b.url)) o.url = b.url;
    if(nonEmpty(b.img)) o.image = b.img;
    if(fin(b.at) && b.at > 0) o.addedAt = new Date(b.at).toISOString();
    out.push(o);
  }
  return out;
}

/* 페이지 PATCH 본문 — fields 에 열쇠가 있는 칸만. 지우기는 null */
function patchBody(version, fields){
  const f = fields || {};
  const body = { version };
  for(const k of ['avatar', 'bio', 'postTitle', 'post']) if(own(f, k)) body[k] = f[k] === null ? null : str(f[k]);
  if(own(f, 'bgm')) body.bgm = isObj(f.bgm) ? { url: str(f.bgm.url), title: str(f.bgm.title) } : null;
  if(own(f, 'bg')) body.bg = bgBody(f.bg, false);
  if(own(f, 'stickers')) body.stickers = stickersBody(f.stickers);
  if(f.clearTheme === true) body.theme = null;
  return body;
}
/* 디자인 PUT 본문 — 테마 · 프리셋 늘 3칸 · 고른 칸. 바깥 배경은 열쇠가 있을 때만 */
function designBody(version, d){
  const o = d || {};
  const body = { version, theme: isObj(o.theme) ? Object.assign({}, o.theme) : {}, presets: presetsBody(o.presets), presetCur: cnt(o.presetCur) ? o.presetCur : 0 };
  if(own(o, 'bg')) body.bg = bgBody(o.bg, false);
  return body;
}

function createMyHomeApi(deps){
  const authed = deps.authed;
  const imageBytes = deps.imageBytes;
  const warn = deps.warn;
  let owner;          // 마지막으로 내 홈을 읽을 때 쓴 토큰의 주인(undefined = 읽은 적 없음)
  let epoch = 0;      // reset 마다 오른다 — reset 전에 시작한 읽기가 늦게 끝나도 주인 기억을 되살리지 않게

  async function readMine(path){
    let who;
    const at = epoch;
    const d = await authed.get(path, { auth: true, onOwner: (w) => { who = w; } });
    if(at === epoch) owner = who;
    return d;
  }
  /* 쓰기 한 번 — 읽은 적 없으면 요청 0 · data: 그림이 실렸으면 요청 0 */
  async function write(what, body, send){
    if(owner === undefined) throw codeError(NOT_RECEIVED_CODE, '받기 전에는 쓰지 않아요');
    if(hasData(body)) throw codeError(IMAGE_UPLOAD_CODE, '그림을 먼저 올려야 해요');
    try{ return await send({ expectOwner: owner }); }
    catch(e){
      if(e && e.code === 'OWNER_CHANGED') owner = undefined;
      else warn('[마이홈] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      throw e;
    }
  }
  const need = (v) => { if(!v) throw shapeError(); return v; };
  const needCode = (c) => { if(!nonEmpty(c)) throw codeError('NO_USER', '사용자 코드 없음'); return c; };
  const versionOf = (d) => { if(!isObj(d) || !cnt(d.version)) throw shapeError(); return d.version; };

  async function uploadImage(dataUrl){
    const img = imageBytes.inspect(dataUrl, { types: IMAGE_TYPES, maxBytes: LIMITS.IMAGE_BYTES });
    if(!img.ok) throw codeError(IMAGE_UPLOAD_CODE, '그림을 올리지 못했어요');
    const d = await write('그림 올리기', {}, (o) => authed.post(PATHS.image, img.bytes, Object.assign({ rawType: img.type }, o)));
    if(!isObj(d) || !nonEmpty(d.url)) throw shapeError();
    return d.url;
  }

  return {
    fetchMine: async () => need(homeOf(await readMine(PATHS.mine))),
    fetchOf: async (userCode) => need(homeOf(await authed.get(PATHS.of(needCode(userCode)), { auth: true }))),
    fetchBookshelf: async () => {
      const d = await readMine(PATHS.bookshelf);
      const books = isObj(d) ? booksOf(d.books) : undefined;
      if(!books || !cnt(d.version)) throw shapeError();
      return { books, version: d.version };
    },
    fetchBookshelfOf: async (userCode) => {
      const d = await authed.get(PATHS.bookshelfOf(needCode(userCode)), { auth: true });
      return { books: need(isObj(d) ? booksOf(d.books) : undefined) };
    },
    patchPage: async (version, fields) => { const b = patchBody(version, fields); return versionOf(await write('페이지 저장', b, (o) => authed.patch(PATHS.mine, b, o))); },
    putDesign: async (version, d) => { const b = designBody(version, d); return versionOf(await write('디자인 저장', b, (o) => authed.put(PATHS.design, b, o))); },
    putDesktop: async (version, d) => { const b = desktopBody(version, d); return versionOf(await write('바탕화면 저장', b, (o) => authed.put(PATHS.desktop, b, o))); },
    putBookshelf: async (version, books) => {
      const b = { version, books: booksBody(books) };
      const d = await write('책장 저장', b, (o) => authed.put(PATHS.bookshelf, b, o));
      const out = isObj(d) ? booksOf(d.books) : undefined;
      if(!out || !cnt(d.version)) throw shapeError();
      return { books: out, version: d.version };
    },
    uploadImage,
    reset: () => { epoch++; owner = undefined; },
  };
}

const api = { createMyHomeApi, homeOf, pageOf, stickersOf, stickersBody, presetsOf, presetsBody, desktopOf, desktopBody, booksOf, booksBody, failOf, ERRORS, KIND, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwMyHomeApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
