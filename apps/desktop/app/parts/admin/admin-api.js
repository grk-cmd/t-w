/* admin-api.js — 🛠️ 앱 관리자 서버 길 provider (검사 sim-admin-api.js)
   책임: 앱 관리자 창이 쓰는 서버 관리자 API(/v1/admin/...) 중 «관리자 확인 · 📣 확성기 · 📰 업데이트 공지 · 📢 런처 배너 · 🛑 방 종료» 의 요청 모양 한 곳.
     서버 모양(imageUrl · linkUrl · publishedAt)을 화면 모양(img · link · ts)으로 맞추는 곳도 여기뿐이다. 화면 · 알림은 모른다 — 실패는 던진다(ApiError).
   관리자 판정은 서버가 한다(토큰의 uid 가 관리자 표에 있어야 하고, 아니면 403 ACCESS_DENIED). 앱에는 «누가 했는지» 를 보내지 않는다.
   deps: authed — 로그인 통로(TwApi.authed — get · post · put · del(…) → Promise<data>)
         pending — 요청 번호 기억(TwRequestId.createPending() — 같은 일을 다시 보내면 같은 번호)
         fetchBoard — 공지 한 판 읽기(noticeApi.fetchBoard — 지금 업데이트 공지의 id 를 거기서 받는다)
   내보냄: createAdminApi(deps) → {
     me() → Promise<{ name, version }> — 서버가 이 계정을 관리자로 아는가(아니면 403 을 던진다).
     announce(text) · clearAnnouncement() → Promise<void> — 확성기(켜는 시간은 서버가 정한다).
     currentUpdateNotice() → Promise<{ id, title, body, ts }|null> · publishUpdateNotice(title, body) → Promise<string|null>(새 공지 id — 응답에 없으면 null) · withdrawUpdateNotice(id) → Promise<void>
     fetchBanner() → Promise<{ version, slides:[{ img, link }] }> · replaceBanner(version, slides) → Promise<void> — 읽은 판(version)을 실어 보낸다(409 면 덮어쓰지 않는다).
     closeAllRooms() → Promise<{ closed:number, missing:number }> — 열린 방 전부 종료.
     ERRORS — 서버 오류 code → 할 일 · 오류 번호(TwApiErrors.store.notify(err, ERRORS) 의 기능 표)
   }
     순수: PATHS · LIMITS · bannerOf(d)
   ⚠️ 여기서 메우지 않는 것: ⚙️ 게임 설정(동물 해금 레벨 — 사용자 앱이 아직 Firebase 에서 읽는다) · 🧹 유령 방 청소(D11-2 에서 걷음).
   검사: checks/sim-admin-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  me: '/v1/admin/admins/me',
  announcements: '/v1/admin/notices/announcements',
  announcementNow: '/v1/admin/notices/announcements/current',
  updateNotices: '/v1/admin/notices/update-notices',
  updateNotice: (id) => '/v1/admin/notices/update-notices/' + encodeURIComponent(id),
  banner: '/v1/admin/notices/launcher-banner',
  roomsClose: '/v1/admin/rooms/close',
});
/* 서버 상한과 같은 값 — 넘기면 서버가 400 으로 거절한다 */
const LIMITS = Object.freeze({ ANNOUNCE: 140, UPDATE_TITLE: 60, UPDATE_BODY: 800, BANNER_SLIDES: 3 });

/* 이 기능의 서버 오류 → 할 일. 공통 표(TwApiErrors)보다 먼저 본다 */
const ERRORS = Object.freeze({
  ACCESS_DENIED: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-05', e) },
  NOTICE_INVALID_URL: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-01', e) },
  NOTICE_TOO_MANY_SLIDES: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-02', e) },
  NOTICE_NOT_FOUND: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-03', e) },
  ROOM_REALTIME_UNAVAILABLE: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-04', e) },
  /* 배너 판이 달라졌다 — 번호 대신 부르는 쪽이 «받아왔어요» 문구를 띄운다(공통 Q10). 공통 표의 E-NET-05 를 덮는다 */
  CONCURRENT_UPDATE: { action: 'refetch', notice: null },
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const msOf = (iso) => { const t = Date.parse(iso); return isFinite(t) ? t : 0; };

/* GET launcher-banner 의 data → 화면 모양. 모양이 틀리면 undefined */
function bannerOf(d){
  if(!isObj(d) || typeof d.version !== 'number' || !Array.isArray(d.slides)) return undefined;
  return { version: d.version, slides: d.slides.filter(isObj).map((s) => ({ img: str(s.imageUrl), link: str(s.linkUrl) })) };
}

function createAdminApi(deps){
  const authed = deps.authed;
  const ids = deps.pending;
  const fetchBoard = deps.fetchBoard;

  /* 새로 만드는 쓰기 — 서버가 답했으면(성공이든 거절이든) 요청 번호를 버리고, 닿지 못했으면 남겨 다시 눌러도 두 번 생기지 않게 */
  async function create(key, send){
    let out;
    try{ out = await send(ids.idFor(key)); }
    catch(e){ if(e && e.status) ids.settle(key); throw e; }
    ids.settle(key);
    return out;
  }

  async function me(){
    const d = await authed.get(PATHS.me);
    if(!isObj(d)) throw shapeError();
    return { name: str(d.name), version: (typeof d.version === 'number') ? d.version : 0 };
  }

  async function announce(text){
    const t = str(text).slice(0, LIMITS.ANNOUNCE);
    await create('announce|' + t, (requestId) => authed.post(PATHS.announcements, { requestId, text: t }));
  }
  async function clearAnnouncement(){ await authed.del(PATHS.announcementNow); }

  async function currentUpdateNotice(){
    const u = (await fetchBoard()).updateNotice;
    return (u && u.id) ? { id: u.id, title: u.title, body: u.body, ts: u.ts } : null;
  }
  async function publishUpdateNotice(title, body){
    const t = str(title).slice(0, LIMITS.UPDATE_TITLE), b = str(body).slice(0, LIMITS.UPDATE_BODY);
    const d = await create('update|' + t + '|' + b, (requestId) => authed.post(PATHS.updateNotices, { requestId, title: t, body: b }));
    return (isObj(d) && d.id) ? str(d.id) || null : null;   // 올린 직후 «내리기» 가 가리킬 id — 이미 올라갔으니 모양이 달라도 던지지 않는다
  }
  async function withdrawUpdateNotice(id){ await authed.del(PATHS.updateNotice(id)); }

  async function fetchBanner(){
    const out = bannerOf(await authed.get(PATHS.banner));
    if(!out) throw shapeError();
    return out;
  }
  async function replaceBanner(version, slides){
    await authed.put(PATHS.banner, { version, slides: slides.map((s) => ({ imageUrl: s.img, linkUrl: s.link })) });
  }

  async function closeAllRooms(){
    const d = await authed.post(PATHS.roomsClose, { all: true });
    if(!isObj(d) || !Array.isArray(d.closed) || !Array.isArray(d.missing)) throw shapeError();
    return { closed: d.closed.length, missing: d.missing.length };
  }

  return { me, announce, clearAnnouncement, currentUpdateNotice, publishUpdateNotice, withdrawUpdateNotice,
    fetchBanner, replaceBanner, closeAllRooms, ERRORS };
}

const api = { createAdminApi, bannerOf, PATHS, LIMITS, ERRORS };
if(typeof window !== 'undefined') window.TwAdminApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
