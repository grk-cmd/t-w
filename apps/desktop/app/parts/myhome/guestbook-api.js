/* guestbook-api.js — 📖 방명록 · 웹박수 api provider (검사 sim-guestbook-api.js)
   책임: 방명록 보기(GET /v1/guestbooks/{userCode}) · 새 글 수(GET /v1/me/guestbook/summary) · 글 쓰기 · 지우기 · 박수(POST · DELETE …/entries · …/claps) ·
     내 폭죽 · 박수 그림 바꾸기(PATCH /v1/me/guestbook). 서버 모양(authorName · createdAt · clap.imageUrl)을 화면이 쓰던 모양(name · ts · img)으로 맞추는 곳은 여기뿐이다.
   신원: 늘 토큰의 «나» — 글쓴이 · 박수 누른 사람은 본문에 싣지 않는다. 경로의 코드는 «어느 방명록인가» 하는 데이터 주소일 뿐이다.
     내 코드(uid)는 «읽은 토큰의 주인 기억 열쇠» 로만 받는다.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · post · patch · del(…, { expectOwner }) → Promise<data>)
         imageBytes — TwImageBytes(shared/image-bytes.js — inspect(dataUrl, { types, maxBytes }) → 올릴 바이트 판정)
         warn(...a)(진단 로그)
   내보냄: createGuestbookApi(deps) → {
     fetchView(uid, owner) → Promise<{ entries:[{ id, name, text, ts, mine }](최신이 위), clap:{ count, img, emoji, todayLeft, dailyMax }, canWrite, version }>
       — 글이 없어도 entries:[](빈 방명록 ≠ 못 읽음). 못 읽으면 던진다. 같은 판이면 api-client 가 ETag(304)로 기억한 값을 돌려준다.
     fetchNewCount(uid, since) → Promise<number> — 내 방명록에서 since(ms) 뒤에 쓴 글 수. 못 읽으면 던진다.
     write(uid, owner, text, requestId) → Promise<{ status, entry?, err? }>
     remove(uid, owner, id) → Promise<{ status, err? }>
     clap(uid, owner, requestId) → Promise<{ status, count?, todayLeft?, dailyMax?, err? }>
     uploadImage(uid, dataUrl) → Promise<{ status, url?, err? }> — 512KB 이하 png/webp/jpeg 만(넘으면 요청 없이 failed)
     changeLook(uid, version, { clapEmoji?, clapImageUrl? }) → Promise<{ status, err? }> — 칸이 null 이면 지움 · 칸이 없으면 그대로
       status = 'ok' | 'stale'(읽은 뒤 로그인한 사람이 바뀌었거나 읽은 적이 없어 보내지 않았다) | 'failed'(err = 서버가 준 오류)
   }
     순수: entryOf · viewOf · PATHS (TwGuestbookApi 위)
   ⚠️ 쓰기는 «읽은 토큰의 주인» 과 묶는다(expectOwner) — 로그인이 바뀌는 틈에 앞 계정의 화면에서 누른 것이 새 계정 토큰으로 나가지 않게.
   ⚠️ 글 쓰기 · 박수는 requestId 를 실어 보낸다(같은 일을 다시 보내도 한 번만 — 번호를 만드는 쪽은 feed).
   ⚠️ 박수 그림은 먼저 uploadImage(POST /v1/me/images?purpose=clap → { url }) 한 뒤 그 url 을 changeLook 의 clapImageUrl 로 보낸다(두 요청 · 서버가 우리 Storage 주소만 받는다).
   검사: checks/sim-guestbook-api.js */
(function(){
'use strict';

const enc = encodeURIComponent;
const PATHS = Object.freeze({
  view: (owner) => '/v1/guestbooks/' + enc(owner),
  entries: (owner) => '/v1/guestbooks/' + enc(owner) + '/entries',
  entry: (owner, id) => '/v1/guestbooks/' + enc(owner) + '/entries/' + enc(id),
  claps: (owner) => '/v1/guestbooks/' + enc(owner) + '/claps',
  summary: (since) => '/v1/me/guestbook/summary?since=' + enc(String(since)),
  look: '/v1/me/guestbook',
  image: '/v1/me/images?purpose=clap',
});
/* 서버 상한과 같은 값 — 넘기면 서버가 413 으로 거절한다 */
const LIMITS = Object.freeze({ IMAGE_BYTES: 512 * 1024 });
const IMAGE_TYPES = Object.freeze(['image/png', 'image/webp', 'image/jpeg']);
const IMAGE_INVALID_CODE = 'IMAGE_INVALID';
const TOO_LARGE_CODE = 'PAYLOAD_TOO_LARGE';
const localError = (code) => Object.assign(new Error(code), { code, kind: 'request' });

const OWNER_CHANGED_CODE = 'OWNER_CHANGED';   // api-client.js — 쓰기 직전 토큰 주인이 읽을 때와 달라졌다

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (typeof v === 'number' && isFinite(v) && v >= 0) ? Math.floor(v) : undefined;
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });

/* 서버 글 한 줄 → 화면 글. 모양이 틀리면(id · 글 없음) undefined */
function entryOf(it){
  if(!isObj(it) || typeof it.id !== 'string' || !it.id || typeof it.text !== 'string') return undefined;
  const ts = Date.parse(it.createdAt);
  return { id: it.id, name: typeof it.authorName === 'string' ? it.authorName : '', text: it.text, ts: isFinite(ts) ? ts : 0, mine: it.mine === true };
}

/* 서버 방명록 → 화면 방명록. 모양이 틀리면 undefined */
function viewOf(d){
  if(!isObj(d) || !Array.isArray(d.entries) || !isObj(d.clap) || typeof d.canWrite !== 'boolean') return undefined;
  const version = count(d.version), n = count(d.clap.count), left = count(d.clap.todayLeft), max = count(d.clap.dailyMax);
  if(version === undefined || n === undefined || left === undefined || max === undefined) return undefined;
  const entries = [];
  for(const it of d.entries){ const e = entryOf(it); if(e) entries.push(e); }
  return {
    entries,
    clap: { count: n, img: typeof d.clap.imageUrl === 'string' ? d.clap.imageUrl : null, emoji: typeof d.clap.emoji === 'string' ? d.clap.emoji : '', todayLeft: left, dailyMax: max },
    canWrite: d.canWrite, version,
  };
}

function createGuestbookApi(deps){
  const authed = deps.authed;
  const warn = deps.warn;
  const imageBytes = deps.imageBytes;   // TwImageBytes — data: 그림 → 바이트 판정(shared/image-bytes.js)
  const owners = new Map();   // uid → 마지막으로 읽을 때 쓴 토큰의 주인

  async function read(uid, path){
    if(!uid){ const e = new Error('내 코드 없음'); e.code = 'NO_USER'; throw e; }
    let who;
    const d = await authed.get(path, { auth: true, onOwner: (w) => { who = w; } });
    owners.set(uid, who);
    return d;
  }

  async function fetchView(uid, owner){
    if(!owner){ const e = new Error('방명록 주인 없음'); e.code = 'NO_OWNER'; throw e; }
    const v = viewOf(await read(uid, PATHS.view(owner)));
    if(!v) throw shapeError();
    return v;
  }
  async function fetchNewCount(uid, since){
    const d = await read(uid, PATHS.summary(Math.max(0, Math.floor(Number(since) || 0))));
    const n = isObj(d) ? count(d.newCount) : undefined;
    if(n === undefined) throw shapeError();
    return n;
  }

  /* 쓰기 한 번 — 읽은 적 없으면 보내지 않는다. send({ expectOwner }) 의 답을 { status, data } 로 */
  async function write(uid, what, send){
    if(!uid || !owners.has(uid)) return { status: 'stale' };
    try{
      const data = await send({ expectOwner: owners.get(uid) });
      return { status: 'ok', data };
    }catch(e){
      if(e && e.code === OWNER_CHANGED_CODE){ owners.delete(uid); return { status: 'stale' }; }
      warn('[방명록] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      return { status: 'failed', err: e };
    }
  }

  return {
    fetchView, fetchNewCount,
    async write(uid, owner, text, requestId){
      const r = await write(uid, '글 쓰기', (o) => authed.post(PATHS.entries(owner), { requestId, text }, o));
      if(r.status !== 'ok') return r;
      const entry = entryOf(r.data);
      return entry ? { status: 'ok', entry } : { status: 'failed', err: shapeError() };
    },
    async remove(uid, owner, id){
      const r = await write(uid, '글 지우기', (o) => authed.del(PATHS.entry(owner, id), o));
      return r.status === 'failed' ? { status: 'failed', err: r.err } : { status: r.status };
    },
    async clap(uid, owner, requestId){
      const r = await write(uid, '박수', (o) => authed.post(PATHS.claps(owner), { requestId }, o));
      if(r.status !== 'ok') return r;
      const d = r.data, n = isObj(d) ? count(d.count) : undefined, left = isObj(d) ? count(d.todayLeft) : undefined, max = isObj(d) ? count(d.dailyMax) : undefined;
      if(n === undefined || left === undefined || max === undefined) return { status: 'failed', err: shapeError() };
      return { status: 'ok', count: n, todayLeft: left, dailyMax: max };
    },
    /* 박수 그림 올리기 — data: 그림 → POST /v1/me/images?purpose=clap(바이트 그대로) → { status, url?, err? }.
       형식 · 512KB 를 넘으면 요청 없이 failed(IMAGE_INVALID · PAYLOAD_TOO_LARGE). 서버 거절(400 IMAGE_INVALID · 413 · 415)·503 은 err 그대로 */
    async uploadImage(uid, dataUrl){
      const img = imageBytes.inspect(dataUrl, { types: IMAGE_TYPES, maxBytes: LIMITS.IMAGE_BYTES });
      if(!img.ok) return { status: 'failed', err: localError(img.why === 'large' ? TOO_LARGE_CODE : IMAGE_INVALID_CODE) };
      const r = await write(uid, '박수 그림 올리기', (o) => authed.post(PATHS.image, img.bytes, Object.assign({ rawType: img.type }, o)));
      if(r.status !== 'ok') return r;
      const url = isObj(r.data) && typeof r.data.url === 'string' ? r.data.url : '';
      return url ? { status: 'ok', url } : { status: 'failed', err: shapeError() };
    },
    async changeLook(uid, version, patch){
      const body = { version };
      if(patch && 'clapEmoji' in patch) body.clapEmoji = patch.clapEmoji;
      if(patch && 'clapImageUrl' in patch) body.clapImageUrl = patch.clapImageUrl;
      const r = await write(uid, '겉모습 바꾸기', (o) => authed.patch(PATHS.look, body, o));
      return r.status === 'failed' ? { status: 'failed', err: r.err } : { status: r.status };
    },
  };
}

const api = { createGuestbookApi, entryOf, viewOf, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwGuestbookApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
