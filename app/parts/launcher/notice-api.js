/* notice-api.js — 📢 공지 읽기 provider (검사 sim-notice-read.js)
   책임: 공지 한 판 읽기(GET /v2/notices — 📢 소식 · 📰 업데이트 공지 · 📢 런처 배너 한 번에).
     서버 모양(publishedAt · imageUrl · linkUrl · 대문자 tag)을 화면이 쓰던 모양(ts · img · link · 소문자 tag)으로 맞추는 곳은 여기뿐이다.
   읽기는 로그인이 없어도 된다(공개 · ETag 로 같으면 304 — 안 바뀐 판은 몸통을 다시 받지 않는다).
   deps: get(path) → Promise<data> — 로그인 없는 읽기(TwApi.authed.get — 쉬기 없음 · 304 면 기억한 값)
   내보냄: createNoticeApi(deps) → {
     fetchBoard() → Promise<{ updateNotice:{id, title, body, ts}|null, banner:[{img, link}], broadcasts:{id: 소식}, hasMore:boolean }> — 못 읽으면 던진다(실패 ≠ 없음).
       소식 = { tag:'notice'|'update'|'reward', title, body, ts, pinned, version } — 고정 + 최신 한 쪽을 합친 것(고정은 오래돼도 들어 있다).
   }
     순수: broadcastOf(b) · boardOf(data) · PATHS (TwNoticeApi 위)
   ⚠️ 관리자 쓰기(소식 올리기 · 고정 · 내리기 · 업데이트 공지 · 배너 저장)는 아직 옛 길(Firebase)이다 — 이 파일은 읽기만 맡는다.
   ⚠️ 소식 읽음은 서버에 없다 — 읽음 표시는 이 PC(tw.inboxBcRead)에 남는다(myhome-inbox.js).
   classic script — api-client.js 다음 · notice-feed.js · app.js 보다 먼저 싣는다(window.TwNoticeApi). Firebase 를 모른다. */
(function(){
'use strict';

const PATHS = Object.freeze({ board: '/v2/notices' });
const TAGS = Object.freeze(['notice', 'update', 'reward']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const msOf = (iso) => { const t = Date.parse(iso); return isFinite(t) ? t : 0; };

/* 서버 소식 한 건 → 화면 소식. id 가 없거나 모르는 종류면 undefined */
function broadcastOf(b){
  if(!isObj(b) || typeof b.id !== 'string' || !b.id) return undefined;
  const tag = str(b.tag).toLowerCase();
  if(TAGS.indexOf(tag) < 0) return undefined;
  return { tag, title: str(b.title), body: str(b.body), ts: msOf(b.publishedAt), pinned: b.pinned === true,
    version: (typeof b.version === 'number') ? b.version : 0 };
}
function broadcastsOf(list, out){
  if(!Array.isArray(list)) return false;
  for(const b of list){ const m = broadcastOf(b); if(m) out[b.id] = m; }
  return true;
}

/* GET /v2/notices 의 data → 화면 한 판. 모양이 틀리면 undefined */
function boardOf(d){
  if(!isObj(d) || !Array.isArray(d.launcherBanner) || !isObj(d.broadcasts)) return undefined;
  const broadcasts = {};
  if(!broadcastsOf(d.broadcasts.pinned, broadcasts) || !broadcastsOf(d.broadcasts.latest, broadcasts)) return undefined;
  const u = d.updateNotice;
  const updateNotice = isObj(u) ? { id: str(u.id), title: str(u.title), body: str(u.body), ts: msOf(u.publishedAt) } : null;
  const banner = d.launcherBanner.filter((s) => isObj(s) && typeof s.imageUrl === 'string' && s.imageUrl)
    .map((s) => ({ img: s.imageUrl, link: str(s.linkUrl) }));
  return { updateNotice, banner, broadcasts, hasMore: typeof d.broadcasts.nextCursor === 'string' && !!d.broadcasts.nextCursor };
}

/** @param {{ get: (path: string) => Promise<any> }} deps */
function createNoticeApi(deps){
  const get = deps.get;

  async function fetchBoard(){
    const out = boardOf(await get(PATHS.board));
    if(!out) throw shapeError();
    return out;
  }

  return { fetchBoard };
}

const api = { createNoticeApi, broadcastOf, boardOf, PATHS, TAGS };
if(typeof window !== 'undefined') window.TwNoticeApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
