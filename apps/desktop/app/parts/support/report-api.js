/* report-api.js — 🚩 신고 provider — 신고 서버 길(POST /v2/reports) · 관리자 신고 목록 길(/v2/admin/reports*) 한 벌 (검사 sim-report.js)
   [왜] 신고는 서버가 원본이다. 신고한 사람은 서버가 로그인 토큰에서 정한다 — 앱은 내 이름 · 코드를 싣지 않는다.
     신고 창(report.js)은 경로 · 본문 모양 · 서버 종류 이름을 모르고 이 파일의 함수만 부른다.
   [모양] file(target, kind, note) → Promise<void>. 성공이면 끝, 실패는 api-client.js 의 ApiError 그대로 던진다.
     failOf(err) → 갈래 하나(FAIL) — 신고 창은 서버 code 를 모르고 갈래만 보고 문구를 고른다.
     kind 는 신고 창의 사유 이름(char · away · nick · etc) — 서버 이름(KIND)으로 바꾸는 곳은 여기뿐이다.
     보내기 전에 틀린 값(대상 없음 · 모르는 사유 · 사유가 40자를 넘음)이면 요청 없이 code 'INVALID' 로 던진다(갈래 site).
   [신원] target 은 신고할 사람의 사용자 코드 — 데이터 주소일 뿐이다. 같은 사람을 다시 신고하면 서버가 열린 신고를 고친다(같은 결과라 requestId 칸이 없다).
   [관리자] createAdminReportApi(deps) → { page(cursor), dismiss(target), takeDown(target, url), failOf(err) } — 관리자 신고 목록(admin/admin-report.js)이 부른다.
     서로 다른 3명 이상 거르기 · 이름 · 그림 붙이기 · 그림 칸과 파일 지우기는 서버가 한다. 서버 줄 → 화면 줄 바꾸기(targetOf)는 여기 한 곳.
   ⚠️ 실패해도 다시 보내지 않는다 — 다시 하는 길은 사용자가 [신고] · [다시 시도] · 버튼을 다시 누르는 것뿐.
   classic script — api-client.js 다음 · report.js · app.js 보다 먼저 싣는다(window.TwReportApi). Firebase 를 모른다. */
(function(){
'use strict';

const ADMIN_BASE = '/v2/admin/reports';
const PATHS = Object.freeze({
  file: '/v2/reports',
  adminList: ADMIN_BASE,
  dismissals: ADMIN_BASE + '/dismissals',
  takeDown: (target) => ADMIN_BASE + '/' + encodeURIComponent(target) + '/take-down',
});
/* 신고 창의 사유 이름 → 서버 종류 이름 */
const KIND = Object.freeze({ char: 'CHARACTER', away: 'AWAY_IMAGE', nick: 'NICKNAME', etc: 'ETC' });
/* 서버 종류 이름 → 신고 창의 사유 이름(관리자 목록이 사유 글을 고를 때). 모르는 이름은 null */
const KIND_OF = Object.freeze(Object.keys(KIND).reduce((o, k) => { o[KIND[k]] = k; return o; }, {}));
const NOTE_MAX = 40;   // 서버 상한과 같다 — 넘기면 서버가 거절한다
const INVALID_CODE = 'INVALID';   // 보내기 전에 막은 틀린 값(요청 0)

/* 실패의 갈래 — self = 나 신고(창이 이미 막음) · noAwayImage = 그 사람 그림이 이미 없음 · noteRequired = 기타인데 글 없음
   · common = 공통 code · 닿지 못함(공통 표 api-errors.js 가 다룬다) · site = 그 밖(신고 창의 번호) */
const FAIL = Object.freeze({ SELF: 'self', NO_AWAY_IMAGE: 'noAwayImage', NOTE_REQUIRED: 'noteRequired', COMMON: 'common', SITE: 'site' });
const row = (kind) => Object.freeze({ action: kind, notice: null });
/* 서버 code(계약) → 갈래. TwApiErrors.translate 에 넘기는 기능 표 — 공통 표보다 먼저 본다 */
const ERRORS = Object.freeze({
  REPORT_SELF: row(FAIL.SELF),
  REPORT_NO_AWAY_IMAGE: row(FAIL.NO_AWAY_IMAGE),
  REPORT_NOTE_REQUIRED: row(FAIL.NOTE_REQUIRED),
  [INVALID_CODE]: row(FAIL.SITE),
});
/* 관리자 목록의 갈래 — imageChanged = 본 그림과 지금 그림이 다름(목록 다시 받기) · common · site(관리자 번호 E-ADM-30~32) */
const ADMIN_FAIL = Object.freeze({ IMAGE_CHANGED: 'imageChanged', COMMON: FAIL.COMMON, SITE: FAIL.SITE });
const SHAPE_CODE = 'SHAPE';   // 응답 모양이 계약과 다름
const ADMIN_ERRORS = Object.freeze({
  REPORT_IMAGE_CHANGED: row(ADMIN_FAIL.IMAGE_CHANGED),
  [INVALID_CODE]: row(ADMIN_FAIL.SITE),
  [SHAPE_CODE]: row(ADMIN_FAIL.SITE),
});
const OFFLINE_ACTION = 'offline';   // api-errors.js — 닿지 못함

const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const invalid = (why) => Object.assign(new Error('신고 값이 맞지 않아요 — ' + why), { code: INVALID_CODE });
const shapeError = (why) => Object.assign(new Error('신고 목록 응답 모양이 달라요 — ' + why), { code: SHAPE_CODE });

/* 실패 하나 → 갈래. errs = TwApiErrors(translate · COMMON). 기능 표 → 그 갈래 · 공통 code · 닿지 못함 → common · 그 밖 → site */
function failIn(table, err, errs){
  const t = errs.translate(err, table);
  if(own(table, t.code)) return t.action;
  if(own(errs.COMMON, t.code) || t.action === OFFLINE_ACTION) return FAIL.COMMON;
  return FAIL.SITE;
}
const failOf = (err, errs) => failIn(ERRORS, err, errs);
const adminFailOf = (err, errs) => failIn(ADMIN_ERRORS, err, errs);

const str = (v) => (typeof v === 'string' && v) ? v : null;
const atMs = (v) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return isFinite(t) ? t : 0; };
/* 서버 대상 줄 → 화면 줄 { target, name, friendCode, awayImg, count, reporters:[{ code, friendCode, name, kind, note, at }] }. 신고자는 최근 것이 위.
   신고자 이름은 신고할 때 이름(nameSnapshot)이 먼저 · 없으면(옛 줄) 지금 이름. kind 는 신고 창의 사유 이름(모르는 서버 이름은 null).
   이름 · 친구 코드 · 그림이 없으면(그새 탈퇴 · 그림 없음) null. 모양이 틀리면 null */
function targetOf(t){
  if(!isObj(t) || !str(t.target) || !Array.isArray(t.reporters)) return null;
  const reporters = t.reporters.filter(isObj).map((r) => ({
    code: str(r.userCode), friendCode: str(r.friendCode), name: str(r.nameSnapshot) || str(r.displayName), kind: own(KIND_OF, r.kind) ? KIND_OF[r.kind] : null,
    note: str(r.note), at: atMs(r.at),
  })).sort((a, b) => b.at - a.at);
  const count = (typeof t.openCount === 'number' && isFinite(t.openCount) && t.openCount >= 0) ? Math.floor(t.openCount) : reporters.length;
  return { target: t.target, name: str(t.displayName), friendCode: str(t.friendCode), awayImg: isObj(t.awayImage) ? str(t.awayImage.url) : null, count, reporters };
}
/* 쪽(data) → { items, next, total }. total = 기준을 넘는 대상 전체 수(첫 쪽에만 · 없으면 null). 모양이 틀리면 던진다(SHAPE — «실패 ≠ 없음») */
function pageOf(d){
  if(!isObj(d) || !Array.isArray(d.items)) throw shapeError('items 없음');
  const items = d.items.map(targetOf);
  if(items.some((x) => !x)) throw shapeError('대상 줄');
  const total = (typeof d.total === 'number' && isFinite(d.total) && d.total >= 0) ? Math.floor(d.total) : null;
  return { items, next: str(d.nextCursor), total };
}

/* 보낼 본문 — { target, kind, note? }. 사유 글은 앞뒤 공백을 걷고 비면 싣지 않는다. 틀리면 던진다(요청 0) */
function bodyOf(target, kind, note){
  if(typeof target !== 'string' || !target) throw invalid('대상 없음');
  if(typeof kind !== 'string' || !own(KIND, kind)) throw invalid('모르는 사유');
  const body = { target, kind: KIND[kind] };
  const n = typeof note === 'string' ? note.trim() : '';
  if(n.length > NOTE_MAX) throw invalid('사유가 너무 김');
  if(n) body.note = n;
  return body;
}

/** @param {{ authed: { post: (path: string, body: object) => Promise<any> }, errs: { translate: Function, COMMON: object } }} deps
 *   authed 는 로그인 API 통로(TwApi.authed — 토큰은 통로가 붙인다) · errs 는 TwApiErrors(공통 표) */
function createReportApi(deps){
  const authed = deps.authed;
  const errs = deps.errs;

  /* 신고 한 번 — 성공이면 끝, 실패는 던진다(«실패 ≠ 없음») */
  async function file(target, kind, note){
    const body = bodyOf(target, kind, note);
    await authed.post(PATHS.file, body);
  }

  return { file, failOf: (err) => failOf(err, errs) };
}

/** 관리자 신고 목록 길 — 관리자 판정은 서버가 한다(관리자가 아니면 ACCESS_DENIED → common).
 * @param {{ authed: { get: (path: string, opts: object) => Promise<any>, post: (path: string, body: object) => Promise<any> }, errs: { translate: Function, COMMON: object } }} deps */
function createAdminReportApi(deps){
  const authed = deps.authed;
  const errs = deps.errs;

  /* 한 쪽 — cursor 없으면 첫 쪽. minReporters 는 보내지 않는다(서버 기본 3 = 신고 창 안내 문구 ADMIN_MIN) */
  async function page(cursor){
    const q = cursor ? '?cursor=' + encodeURIComponent(cursor) : '';
    return pageOf(await authed.get(PATHS.adminList + q, { auth: true }));
  }
  /* 문제없음 — 한 사람. 서버는 대상마다 결과를 준다 — 그 사람 줄이 ok 가 아니면 그 code 로 던진다 */
  async function dismiss(target){
    if(!str(target)) throw invalid('대상 없음');
    const d = await authed.post(PATHS.dismissals, { targets: [target] });
    const it = Array.isArray(d) ? d.find((x) => isObj(x) && x.id === target) : null;
    if(!it) throw shapeError('대상 결과 없음');
    if(it.ok !== true) throw Object.assign(new Error('문제없음 처리 거절'), { code: str(it.code) || SHAPE_CODE, kind: 'server' });
  }
  /* 그림 내리기 — url 은 관리자가 목록에서 본 그림(서버가 지금 그림과 다르면 REPORT_IMAGE_CHANGED) */
  async function takeDown(target, url){
    if(!str(target) || !str(url)) throw invalid('대상 · 그림 없음');
    await authed.post(PATHS.takeDown(target), { awayImageUrl: url });
  }

  return { page, dismiss, takeDown, failOf: (err) => adminFailOf(err, errs) };
}

const out = { PATHS, KIND, KIND_OF, NOTE_MAX, FAIL, ERRORS, ADMIN_FAIL, ADMIN_ERRORS, bodyOf, failOf, adminFailOf, targetOf, pageOf,
  createReportApi, createAdminReportApi };
if(typeof window !== 'undefined') window.TwReportApi = out;
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
