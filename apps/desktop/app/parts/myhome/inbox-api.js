/* inbox-api.js — 📩 우편(알림함 «우편» 칸) api provider (검사 sim-inbox-api.js)
   책임: 내 우편 읽기(GET /v1/me/notifications?section=MAIL) · 읽음(PATCH …/{id}) · 모두 읽음(POST …/read-all) · 지우기(DELETE …/{id}).
     서버 모양(kind · readAt · createdAt · payload)을 화면이 쓰던 모양({tag, title, body, ts, read, bugId})으로 맞추는 곳은 여기뿐이다.
   신원: 늘 토큰의 «나» — 경로·본문에 사용자 코드를 싣지 않는다. 내 코드(uid)는 «읽은 토큰의 주인 기억 열쇠» 로만 받는다.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth, onOwner }) · patch · post · del(…, { expectOwner }) → Promise<data>)
         warn(...a)(진단 로그)
   내보냄: createInboxApi(deps) → {
     fetchMail(uid) → Promise<{ items:{id: 우편}, unread:number, complete:boolean }> — 우편이 없어도 객체(빈 우편 ≠ 못 읽음). 못 읽으면 던진다.
       unread 는 서버가 센 «안 읽은 수» 다(받은 쪽지 수와 다를 수 있다 — complete 가 false 면 오래된 우편은 아직 안 받았다).
     markRead(uid, id) · markAllRead(uid) · remove(uid, id) → Promise<'ok'|'stale'|'failed'>
   }
     순수: mailOf(item) · pageOf(data) · tagOf(kind) · PATHS · LIMITS (TwInboxApi 위)
   ⚠️ 쓰기는 «읽은 토큰의 주인» 과 묶는다(expectOwner) — 로그인이 바뀌는 틈에 앞 계정의 화면에서 누른 것이 새 계정 토큰으로 나가지 않게('stale' = 보내지 않음).
   ⚠️ 읽은 적 없는 계정(fetchMail 전)의 쓰기는 보내지 않는다('stale').
   검사: checks/sim-inbox-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  list: '/v1/me/notifications',
  one: (id) => '/v1/me/notifications/' + encodeURIComponent(id),
  readAll: '/v1/me/notifications/read-all',
});
const SECTION_MAIL = 'MAIL';
/* 서버 쪽 상한(limit 1~50) · 한 번에 받는 쪽 수 — 넘게 쌓인 오래된 우편은 받지 않는다(complete:false) */
const LIMITS = Object.freeze({ PAGE: 50, MAX_PAGES: 4 });
const OWNER_CHANGED_CODE = 'OWNER_CHANGED';   // api-client.js — 쓰기 직전 토큰 주인이 읽을 때와 달라졌다

/* 서버 알림 종류 → 화면 태그(아이콘 · 칸 이름 · 🛠️ 답변 이동). 모르는 종류는 «우편» 으로 보인다 */
const TAG_BY_KIND = Object.freeze({
  LEVEL_UNLOCK: 'reward', LICENSE_ISSUED: 'reward', SECRET_ROOM_ISSUED: 'reward', LEGACY: 'reward', BUG_ANSWERED: 'bug',
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const tagOf = (kind) => TAG_BY_KIND[kind] || 'reward';

/* 서버 알림 한 통 → 화면 우편. 모양이 틀리면(id 없음) undefined */
function mailOf(it){
  if(!isObj(it) || typeof it.id !== 'string' || !it.id) return undefined;
  const ts = Date.parse(it.createdAt);
  const out = { tag: tagOf(it.kind), title: str(it.title), body: str(it.body), ts: isFinite(ts) ? ts : 0, read: !!it.readAt };
  const no = isObj(it.payload) ? str(it.payload.number) : '';
  if(out.tag === 'bug' && no) out.bugId = no;   // 버그제보 글 번호 — 누르면 그 글로 간다
  return out;
}

/* 쪽(data) → { list:[[id, 우편]…], next, unread }. 모양이 틀리면 undefined */
function pageOf(d){
  if(!isObj(d) || !Array.isArray(d.items)) return undefined;
  const list = [];
  for(const it of d.items){ const m = mailOf(it); if(m) list.push([it.id, m]); }
  return { list, next: (typeof d.nextCursor === 'string' && d.nextCursor) ? d.nextCursor : null,
    unread: (typeof d.unreadCount === 'number' && isFinite(d.unreadCount) && d.unreadCount >= 0) ? Math.floor(d.unreadCount) : undefined };
}

function createInboxApi(deps){
  const authed = deps.authed;
  const warn = deps.warn;
  const owners = new Map();   // uid → 마지막으로 읽을 때 쓴 토큰의 주인

  async function fetchMail(uid){
    if(!uid){ const e = new Error('내 코드 없음'); e.code = 'NO_USER'; throw e; }
    const items = {};
    let unread, cursor = null, owner, pages = 0, complete = false;
    while(pages < LIMITS.MAX_PAGES){
      const q = '?section=' + SECTION_MAIL + '&limit=' + LIMITS.PAGE + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      const d = await authed.get(PATHS.list + q, { auth: true, onOwner: (who) => { owner = who; } });
      const p = pageOf(d);
      if(!p) throw shapeError();
      pages++;
      if(unread === undefined) unread = p.unread;
      for(const [id, m] of p.list) items[id] = m;
      cursor = p.next;
      if(!cursor){ complete = true; break; }
    }
    if(unread === undefined) unread = Object.keys(items).filter((id) => !items[id].read).length;   // 서버가 수를 안 주면 받은 것만 센다
    owners.set(uid, owner);
    return { items, unread, complete };
  }

  /* 쓰기 한 번 — 'ok' | 'stale'(읽은 뒤 로그인한 사람이 바뀌었거나 읽은 적 없어 보내지 않았다) | 'failed' */
  async function write(uid, what, send){
    if(!uid || !owners.has(uid)) return 'stale';
    try{
      await send({ expectOwner: owners.get(uid) });
      return 'ok';
    }catch(e){
      if(e && e.code === OWNER_CHANGED_CODE){ owners.delete(uid); return 'stale'; }
      warn('[우편] ' + what + ' 실패', (e && (e.code || e.message)) || e);
      return 'failed';
    }
  }

  return {
    fetchMail,
    markRead: (uid, id) => write(uid, '읽음', (o) => authed.patch(PATHS.one(id), { read: true }, o)),
    markAllRead: (uid) => write(uid, '모두 읽음', (o) => authed.post(PATHS.readAll, {}, o)),
    remove: (uid, id) => write(uid, '지우기', (o) => authed.del(PATHS.one(id), o)),
  };
}

const api = { createInboxApi, mailOf, pageOf, tagOf, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwInboxApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
