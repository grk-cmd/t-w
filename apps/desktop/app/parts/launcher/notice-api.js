/* notice-api.js — 📢 공지 api provider (검사 sim-notice-api.js)
   책임: 공지 한 판 읽기(GET /v1/notices — 📢 소식 · 📰 업데이트 공지 · 📢 런처 배너 한 번에) · 관리자 소식 쓰기(올리기 · 📌 고정 · 내리기).
     서버 모양(publishedAt · imageUrl · linkUrl · 대문자 tag)을 화면이 쓰던 모양(ts · img · link · 소문자 tag)으로 맞추는 곳은 여기뿐이다.
   읽기는 로그인이 없어도 된다(공개 · ETag 로 같으면 304 — 안 바뀐 판은 몸통을 다시 받지 않는다). 쓰기는 관리자 토큰 — 관리자 판정은 서버가 한다.
   deps: get(path) → Promise<data> — 로그인 없는 읽기(TwApi.authed.get — 쉬기 없음 · 304 면 기억한 값)
         write — 관리자 쓰기 통로(TwApi.authed — post · patch · del(…) → Promise<data>)
         pending — 요청 번호 기억(TwRequestId.createPending() — 같은 일을 다시 보내면 같은 번호) · warn(...a)(진단 로그)
   내보냄: createNoticeApi(deps) → {
     fetchBoard() → Promise<{ updateNotice:{title, body, ts}|null, banner:[{img, link}], broadcasts:{id: 소식}, hasMore:boolean }> — 못 읽으면 던진다.
       소식 = { tag:'notice'|'update'|'reward', title, body, ts, pinned, version } — 고정 + 최신 한 쪽을 합친 것(고정은 오래돼도 들어 있다).
     sendBroadcast({ tag, title, body, pinned }) → Promise<'ok'|'pinFailed'|'failed'> — 올리고, 고정이 켜져 있으면 이어서 고정한다.
     setPinned(id, version, pinned) · remove(id, version) → Promise<'ok'|'conflict'|'failed'>
   }
     순수: broadcastOf(b) · boardOf(data) · PATHS · LIMITS (TwNoticeApi 위)
   ⚠️ 소식 읽음은 서버에 없다 — 읽음 표시는 이 PC(tw.inboxBcRead)에 남는다(myhome-inbox.js). 계정별 저장이 생기면 그쪽으로.
   ⚠️ 고정은 «읽은 판(version)» 을 실어 보낸다 — 다른 관리자가 먼저 고쳤으면(409) 'conflict' 로 알리고 덮어쓰지 않는다.
   검사: checks/sim-notice-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  board: '/v1/notices',
  broadcasts: '/v1/admin/notices/broadcasts',
  broadcast: (id) => '/v1/admin/notices/broadcasts/' + encodeURIComponent(id),
});
/* 서버 상한과 같은 값 — 넘기면 서버가 400 으로 거절한다 */
const LIMITS = Object.freeze({ TITLE: 80, BODY: 600 });
const TAGS = Object.freeze(['notice', 'update', 'reward']);
const CONFLICT_STATUS = 409;

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

/* GET /v1/notices 의 data → 화면 한 판. 모양이 틀리면 undefined */
function boardOf(d){
  if(!isObj(d) || !Array.isArray(d.launcherBanner) || !isObj(d.broadcasts)) return undefined;
  const broadcasts = {};
  if(!broadcastsOf(d.broadcasts.pinned, broadcasts) || !broadcastsOf(d.broadcasts.latest, broadcasts)) return undefined;
  const u = d.updateNotice;
  const updateNotice = isObj(u) ? { title: str(u.title), body: str(u.body), ts: msOf(u.publishedAt) } : null;
  const banner = d.launcherBanner.filter((s) => isObj(s) && typeof s.imageUrl === 'string' && s.imageUrl)
    .map((s) => ({ img: s.imageUrl, link: str(s.linkUrl) }));
  return { updateNotice, banner, broadcasts, hasMore: typeof d.broadcasts.nextCursor === 'string' && !!d.broadcasts.nextCursor };
}

function createNoticeApi(deps){
  const get = deps.get;
  const write = deps.write;
  const ids = deps.pending;
  const warn = deps.warn;

  async function fetchBoard(){
    const out = boardOf(await get(PATHS.board));
    if(!out) throw shapeError();
    return out;
  }

  /* 쓰기 결과를 'ok' · 'conflict' · 'failed' 로 — 409 는 덮어쓰지 않고 알린다 */
  async function run(what, send){
    try{ await send(); return 'ok'; }
    catch(e){
      if(e && e.status === CONFLICT_STATUS) return 'conflict';
      warn('[소식] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      return 'failed';
    }
  }

  async function sendBroadcast(o){
    const tag = TAGS.indexOf(o && o.tag) >= 0 ? o.tag : 'notice';
    const title = str(o && o.title).slice(0, LIMITS.TITLE), body = str(o && o.body).slice(0, LIMITS.BODY);
    const key = tag + '|' + title + '|' + body;
    let made;
    try{ made = await write.post(PATHS.broadcasts, { requestId: ids.idFor(key), tag: tag.toUpperCase(), title, body }); }
    catch(e){
      if(e && e.status) ids.settle(key);   // 서버가 거절했다 — 다음엔 새 번호. 닿지 못했으면 번호를 남겨 다시 눌러도 두 번 올라가지 않게
      warn('[소식] 올리기 실패', (e && (e.code || e.message)) || e);
      return 'failed';
    }
    ids.settle(key);
    if(!(o && o.pinned)) return 'ok';
    const m = broadcastOf(made);
    if(!m) return 'pinFailed';
    return (await setPinned(made.id, m.version, true)) === 'ok' ? 'ok' : 'pinFailed';
  }
  const setPinned = (id, version, pinned) => run('고정', () => write.patch(PATHS.broadcast(id), { version, pinned: !!pinned }));
  const remove = (id, version) => run('내리기', () => write.del(PATHS.broadcast(id) + '?version=' + encodeURIComponent(version)));

  return { fetchBoard, sendBroadcast, setPinned, remove };
}

const api = { createNoticeApi, broadcastOf, boardOf, PATHS, LIMITS, TAGS };
if(typeof window !== 'undefined') window.TwNoticeApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
