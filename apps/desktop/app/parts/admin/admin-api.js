/* admin-api.js — 🛠️ 앱 관리자 서버 길 provider (검사 sim-admin-api.js)
   책임: 앱 관리자 창이 쓰는 서버 관리자 API(/v2/admin/...) 중 «관리자 확인 · 📣 확성기 · 📰 업데이트 공지 · 📢 런처 배너 · 🛑 방 종료 ·
     🎟️ 라이선스 키(목록 · 발급 · 회수 · 삭제 · 엑셀 미리보기) · 🙋 대기 요청 · 📊 통계 · 🎟️ 초대권 지급 · 회수» 의 요청 모양 한 곳.
     서버 모양(imageUrl · linkUrl · publishedAt)을 화면 모양(img · link · ts)으로 맞추는 곳도 여기뿐이다. 화면 · 알림은 모른다 — 실패는 던진다(ApiError).
   관리자 판정은 서버가 한다(토큰의 uid 가 관리자 표에 있어야 하고, 아니면 403 ACCESS_DENIED). 앱에는 «누가 했는지» 를 보내지 않는다.
   deps: authed — 로그인 통로(TwApi.authed — get · post · put · del(…) → Promise<data>)
         pending — 요청 번호 기억(TwRequestId.createPending() — 같은 일을 다시 보내면 같은 번호)
         fetchBoard — 공지 한 판 읽기(noticeApi.fetchBoard — 지금 업데이트 공지의 id 를 거기서 받는다)
         errs — 공통 오류 표(TwApiErrors — translate · COMMON) — failOf 가 «공통 · 이 기능 표 · 그 밖» 을 가른다
   내보냄: createAdminApi(deps) → {
     me() → Promise<{ name, version }> — 서버가 이 계정을 관리자로 아는가(아니면 403 을 던진다).
     announce(text) · clearAnnouncement() → Promise<void> — 확성기(켜는 시간은 서버가 정한다).
     currentUpdateNotice() → Promise<{ id, title, body, ts }|null> · publishUpdateNotice(title, body) → Promise<string|null>(새 공지 id — 응답에 없으면 null) · withdrawUpdateNotice(id) → Promise<void>
     fetchBanner() → Promise<{ version, slides:[{ img, link }] }> · replaceBanner(version, slides) → Promise<void> — 읽은 판(version)을 실어 보낸다(409 면 덮어쓰지 않는다).
     closeAllRooms() → Promise<{ closed:number, missing:number }> — 열린 방 전부 종료.
     listLicenses({ q, cursor }) → { items:[{ id, key, status, used, note, ownerName, ownerCode, version }], next, total } — 검색 · 쪽 나누기는 서버(q = 키 앞부분 · 메모 · 주인 친구코드).
     issueLicenses(grants, reissue) → [{ friendCode, ok, code, id, key }] — 키는 서버가 만든다 · 친구코드가 있으면 받는 사람 우편도 서버가 보낸다(줄마다 ok · 까닭 code).
     previewLicenses(friendCodes) → [{ friendCode, found, name, hasValid }] — 쓰는 것 없이 «있는 사람 · 이름 · 이미 유효한 키» 만.
     revokeLicense(id, version) · deleteLicense(id, version) → Promise<void> — 키 원문 대신 licenseId + 읽은 판(version)(다르면 409).
     pendingRequests(cursor) → { items:[{ id, name, userCode }], next } · approveRequest(id) · rejectRequest(id) → Promise<void> · approveRequests(ids) → [{ id, ok, code }]
     totals() → { users, premiumUsers, licValid, licUsed } — 서버 총계(가입 수 손보정은 없다).
     grantInvites(target, n) → { changed, left } · revokeInvites(target, joinedSince?) → { changed, left } — target = userCode · 친구코드 · "all". 서버가 사람을 찾는다.
     failOf(err) → 'notice'(이 기능 표 · 번호) | 'refetch'(판이 달라짐 — 다시 받기) | 'common'(공통 표) | 'site'(그 밖 — 부르는 쪽이 자기 번호로)
     ERRORS — 서버 오류 code → 할 일 · 오류 번호(TwApiErrors.store.notify(err, ERRORS) 의 기능 표)
   }
     순수: PATHS · LIMITS · bannerOf(d)
   ⚠️ 여기서 메우지 않는 것: ⚙️ 게임 설정(동물 해금 레벨) · 📁 카테고리 — 쓰는 길은 서버에 있으나 사용자 앱(과 이 창)이 그 값을 아직 Firebase 에서 읽는다. 읽는 쪽이 서버로 옮겨 가면 이어서 켠다.
   검사: checks/sim-admin-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  me: '/v2/admin/admins/me',
  announcements: '/v2/admin/notices/announcements',
  announcementNow: '/v2/admin/notices/announcements/current',
  updateNotices: '/v2/admin/notices/update-notices',
  updateNotice: (id) => '/v2/admin/notices/update-notices/' + encodeURIComponent(id),
  banner: '/v2/admin/notices/launcher-banner',
  roomsClose: '/v2/admin/rooms/close',
  licenses: '/v2/admin/licenses',
  licensePreview: '/v2/admin/licenses/preview',
  license: (id) => '/v2/admin/licenses/' + encodeURIComponent(id),
  licenseRequests: '/v2/admin/license-requests',
  licenseRequestApprove: (id) => '/v2/admin/license-requests/' + encodeURIComponent(id) + '/approve',
  licenseRequestReject: (id) => '/v2/admin/license-requests/' + encodeURIComponent(id) + '/reject',
  licenseRequestsBulk: '/v2/admin/license-requests/bulk-approve',
  totals: '/v2/admin/metrics/totals',
  inviteGrants: '/v2/admin/invite-quotas/grants',
  inviteRevocations: '/v2/admin/invite-quotas/revocations',
});
/* 서버 상한과 같은 값 — 넘기면 서버가 400 으로 거절한다 */
const LIMITS = Object.freeze({ ANNOUNCE: 140, UPDATE_TITLE: 60, UPDATE_BODY: 800, BANNER_SLIDES: 3, LICENSE_NOTE: 100, LICENSE_ITEMS: 500 });

/* 이 기능의 서버 오류 → 할 일. 공통 표(TwApiErrors)보다 먼저 본다 */
const ERRORS = Object.freeze({
  ACCESS_DENIED: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-05', e) },
  NOTICE_INVALID_URL: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-01', e) },
  NOTICE_TOO_MANY_SLIDES: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-02', e) },
  NOTICE_NOT_FOUND: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-03', e) },
  ROOM_REALTIME_UNAVAILABLE: { action: 'notice', notice: (notifyError, e) => notifyError('E-ADM-04', e) },
  /* 배너 판이 달라졌다 — 번호 대신 부르는 쪽이 «받아왔어요» 문구를 띄운다(공통 Q10). 공통 표의 E-NET-05 를 덮는다 */
  CONCURRENT_UPDATE: { action: 'refetch', notice: null },
  /* 키 · 요청이 그 사이 없어졌다(다른 관리자가 먼저 처리) — 목록을 다시 받아 보인다 */
  LICENSE_NOT_FOUND: { action: 'refetch', notice: null },
  LICENSE_REQUEST_NOT_FOUND: { action: 'refetch', notice: null },
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });
const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
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
  const errs = deps.errs;

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

  /* ── 🎟️ 라이선스 · 🙋 대기 요청 · 📊 통계 · 🎟️ 초대권 — 서버 줄 → 화면 줄 ── */
  const licenseOf = (r) => {
    if(!isObj(r) || !str(r.licenseId) || !str(r.key) || typeof r.version !== 'number') throw shapeError();
    return { id: r.licenseId, key: r.key, status: str(r.status), used: !!str(r.firstRedeemedAt), note: str(r.note), ownerName: str(r.ownerName), ownerCode: str(r.ownerUserCode), version: r.version };
  };
  async function listLicenses(opt){
    const o = opt || {};
    const q = [];
    if(o.q) q.push('q=' + encodeURIComponent(o.q));
    if(o.cursor) q.push('cursor=' + encodeURIComponent(o.cursor));
    const d = await authed.get(PATHS.licenses + (q.length ? '?' + q.join('&') : ''), { auth: true });
    if(!isObj(d) || !Array.isArray(d.items)) throw shapeError();
    return { items: d.items.map(licenseOf), next: str(d.nextCursor) || null, total: (typeof d.total === 'number') ? d.total : null };
  }
  /* 발급 — grants: [{ friendCode?, note? }] ≤ 500. 같은 내용을 답 못 받고 다시 보내면 같은 requestId(서버가 한 번만) */
  async function issueLicenses(grants, reissue){
    if(!Array.isArray(grants) || !grants.length || grants.length > LIMITS.LICENSE_ITEMS) throw Object.assign(new Error('발급 줄은 1~' + LIMITS.LICENSE_ITEMS + '개'), { code: 'INVALID_REQUEST' });
    const body = grants.map((g) => { const o = {}; if(g.friendCode) o.friendCode = g.friendCode; if(g.note) o.note = String(g.note).slice(0, LIMITS.LICENSE_NOTE); return o; });
    const d = await create('lic|' + (reissue ? 1 : 0) + '|' + JSON.stringify(body), (requestId) => authed.post(PATHS.licenses, { requestId, grants: body, reissue: !!reissue }));
    if(!Array.isArray(d) || d.length !== body.length || !d.every(isObj)) throw shapeError();
    return d.map((r) => ({ friendCode: str(r.friendCode) || null, ok: r.ok === true, code: str(r.code) || null, id: str(r.licenseId) || null, key: str(r.key) || null }));
  }
  async function previewLicenses(friendCodes){
    const out = [];
    for(let i = 0; i < friendCodes.length; i += LIMITS.LICENSE_ITEMS){
      const d = await authed.post(PATHS.licensePreview, { friendCodes: friendCodes.slice(i, i + LIMITS.LICENSE_ITEMS) });
      const part = friendCodes.slice(i, i + LIMITS.LICENSE_ITEMS);
      if(!Array.isArray(d) || d.length !== part.length || !d.every(isObj)) throw shapeError();
      d.forEach((r) => out.push({ friendCode: str(r.friendCode), found: r.found === true, name: str(r.name) || null, hasValid: r.hasValidLicense === true }));
    }
    return out;
  }
  async function revokeLicense(id, version){ await authed.patch(PATHS.license(id), { version, status: 'REVOKED' }); }
  async function deleteLicense(id, version){ await authed.del(PATHS.license(id) + '?version=' + encodeURIComponent(version)); }

  async function pendingRequests(cursor){
    const d = await authed.get(PATHS.licenseRequests + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), { auth: true });
    if(!isObj(d) || !Array.isArray(d.items)) throw shapeError();
    return { items: d.items.map((r) => { if(!isObj(r) || !str(r.id)) throw shapeError(); return { id: r.id, name: str(r.name), userCode: str(r.requesterUserCode) }; }), next: str(d.nextCursor) || null };
  }
  async function approveRequest(id){ await authed.post(PATHS.licenseRequestApprove(id)); }
  async function rejectRequest(id){ await authed.post(PATHS.licenseRequestReject(id)); }
  async function approveRequests(ids){
    const d = await authed.post(PATHS.licenseRequestsBulk, { ids });
    if(!Array.isArray(d) || !d.every(isObj)) throw shapeError();
    return d.map((r) => ({ id: str(r.id), ok: r.ok === true, code: str(r.code) || null }));
  }

  async function totals(){
    const d = await authed.get(PATHS.totals, { auth: true });
    if(!isObj(d) || typeof d.users !== 'number' || !isObj(d.licenses)) throw shapeError();
    return { users: num(d.users), premiumUsers: num(d.premiumUsers), licValid: num(d.licenses.valid), licUsed: num(d.licenses.used) };
  }

  const changedOf = (d) => {
    if(!isObj(d) || typeof d.changed !== 'number') throw shapeError();
    return { changed: d.changed, left: (typeof d.invitesLeft === 'number') ? d.invitesLeft : null };
  };
  async function grantInvites(target, n){
    const t = str(target), k = Number(n);
    if(!t || !Number.isInteger(k) || k < 1) throw Object.assign(new Error('초대권 대상 · 장 수가 맞지 않아요'), { code: 'INVALID_REQUEST' });
    return changedOf(await create('inv|' + t + '|' + k, (requestId) => authed.post(PATHS.inviteGrants, { requestId, target: t, n: k })));
  }
  async function revokeInvites(target, joinedSince){
    const t = str(target);
    if(!t) throw Object.assign(new Error('초대권 대상이 없어요'), { code: 'INVALID_REQUEST' });
    const body = { target: t };
    if(joinedSince) body.joinedSince = joinedSince;
    return changedOf(await authed.post(PATHS.inviteRevocations, body));
  }

  /* 실패의 갈래 — 이 기능 표(ERRORS)에 있으면 그 action('notice' · 'refetch') · 공통 code · 닿지 못함이면 'common' · 그 밖이면 'site'(부르는 쪽 번호) */
  function failOf(err){
    const t = errs.translate(err, ERRORS);
    if(own(ERRORS, t.code)) return t.action;
    if(own(errs.COMMON, t.code) || t.action === 'offline') return 'common';
    return 'site';
  }

  return { me, announce, clearAnnouncement, currentUpdateNotice, publishUpdateNotice, withdrawUpdateNotice,
    fetchBanner, replaceBanner, closeAllRooms,
    listLicenses, issueLicenses, previewLicenses, revokeLicense, deleteLicense, pendingRequests, approveRequest, rejectRequest, approveRequests,
    totals, grantInvites, revokeInvites, failOf, ERRORS };
}

const api = { createAdminApi, bannerOf, PATHS, LIMITS, ERRORS };
if(typeof window !== 'undefined') window.TwAdminApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
