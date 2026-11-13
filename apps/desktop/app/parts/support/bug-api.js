/* bug-api.js — 🐞 버그제보 게시판 provider — 서버 길(/v1/bugs* · /v1/me/bugs*) 한 벌 · 새 답변 배지 수 (검사 sim-bug-api.js)
   [왜] 게시판의 원본은 서버다. 글쓴이 · 공감한 사람 · 읽은 사람은 서버가 로그인 토큰에서 정한다 — 앱은 내 이름 · 코드를 싣지 않는다.
     화면(bug-board-ui.js)은 경로 · 본문 모양 · 서버 이름(PUBLIC · BUG · NEW …)을 모르고 이 파일의 함수만 부른다.
     서버 모양(ISO 시각 · 대문자 이름) → 화면 모양(ms · 소문자 열쇠 'pub' · 'bug' · 'new')은 여기 한 곳(rowOf · postOf).
   [관리자] answer(number, { seenLastAnswerAt, text, status, vis, kakaoLink }) · reportConfig() → { version, notice, link } · saveReportLink(cfg, link) → 새 { version, notice, link }
     — 관리자 판정은 서버. 앱 isAdmin 은 화면을 가리는 깃발일 뿐이다. seenLastAnswerAt = 글을 열 때 받은 post.lastAnswerIso(서버 글자 그대로 — 다시 만들지 않는다).
   [모양] list(filter, cursor, limit) → { items:[row], next } · notices() → [row] · detail(number) → post
     row = { number, vis, cat, title, status, notice, byAdmin, anon, name, mine, likeN, ansN, createdAt, answeredAt, authorReplied, unseen }
     post = row 의 글 칸 + { body, env, canReply, liked, version, comments:[{ id, byAuthor, text, kakao, vis, st, at }] }
     write(p) → { number } · reply(number, { text, status }) · setVis(number, version, vis) → { vis, version } · like(number) → { likeN, liked }(누른 뒤 서버의 수) · seen(number) → Promise<void>
     quota() → { dailyMax(관리자는 null), usedToday } · refreshBadge() → Promise<정수> · badgeCount() → 정수 | null(모름) · reset()
     failOf(err) → { kind, code } — 화면은 서버 code 를 모르고 갈래만 본다(KIND).
   [requestId] 글 · 답글은 한 일 한 번호(TwRequestId pending) — 닿지 못해 다시 누르면 같은 번호(서버가 처음 결과를 돌려준다 · 두 번 안 올라감),
     서버가 답했으면(성공 · 거절) 다음엔 새 번호. 👍 · 봤음 · 공개 범위는 PUT · PATCH(판 version)라 번호가 없다.
   ⚠️ 실패해도 다시 보내지 않는다 — 다시 하는 길은 사용자가 누르는 것뿐. 실패는 api-client.js 의 ApiError 를 그대로 던진다(«실패 ≠ 없음»).
   ⚠️ 배지 수는 reset 마다 오르는 epoch 로 묶는다 — 계정을 놓기 전에 보낸 받기가 늦게 와도 새 계정 수를 덮지 않게.
   classic script — api-client.js · request-id.js 다음 · bug-board-ui.js · app.js 보다 먼저 싣는다(window.TwBugApi). Firebase 를 모른다. */
(function(){
'use strict';

const enc = encodeURIComponent;
const PATHS = Object.freeze({
  list: '/v1/bugs',
  one: (n) => '/v1/bugs/' + enc(n),
  replies: (n) => '/v1/bugs/' + enc(n) + '/replies',
  visibility: (n) => '/v1/bugs/' + enc(n) + '/visibility',
  like: (n) => '/v1/bugs/' + enc(n) + '/like',
  seen: (n) => '/v1/me/bugs/' + enc(n) + '/seen',
  unseenCount: '/v1/me/bugs/unseen-count',
  quota: '/v1/me/bugs/quota',
  answers: (n) => '/v1/admin/bugs/' + enc(n) + '/answers',
  adminConfig: '/v1/admin/config',
  reportConfig: '/v1/admin/config/bug.report',
});
const REPORT_KEY = 'bug.report';
const KAKAO_PREFIX = 'https://open.kakao.com/';
const LINK_MAX = 300;
const FILTERS = Object.freeze(['all', 'open', 'mine']);
const LIMIT_MAX = 20;   // 서버 limit 상한(1~20)
const VIS = Object.freeze({ pub: 'PUBLIC', prv: 'PRIVATE' });
const VIS_OF = Object.freeze({ PUBLIC: 'pub', PRIVATE: 'prv' });
const WRITE_KEY = 'write';
const replyKey = (n) => 'reply:' + n;
const answerKey = (n) => 'answer:' + n;

/* 실패 갈래 — guide = 안내 문구(번호 없음 · 문구는 bug-board.js GUIDE_TEXT) · missing = 없는 글 · private = 남의 비공개 글
   · conflict = 다른 곳에서 먼저 바뀜(다시 받기) · common = 공통 code · 닿지 못함(api-errors.js) · site = 그 자리의 E-BUG 번호 */
const KIND = Object.freeze({ GUIDE: 'guide', MISSING: 'missing', PRIVATE: 'private', CONFLICT: 'conflict', COMMON: 'common', SITE: 'site' });
const row = (kind) => Object.freeze({ action: kind, notice: null });
const SHAPE_CODE = 'SHAPE', INVALID_CODE = 'INVALID';
/* 서버 code(계약) → 갈래. TwApiErrors.translate 에 넘기는 기능 표 — 공통 표보다 먼저 본다 */
const ERRORS = Object.freeze({
  BUG_DAILY_LIMIT: row(KIND.GUIDE), BUG_REPLY_TOO_SOON: row(KIND.GUIDE), BUG_NOT_AUTHOR: row(KIND.GUIDE), BUG_NOTICE_NO_REPLY: row(KIND.GUIDE),
  BUG_VIS_NOT_AUTHOR: row(KIND.GUIDE), BUG_VIS_LOCKED: row(KIND.GUIDE), BUG_NOTICE_MUST_BE_PUBLIC: row(KIND.GUIDE), BUG_NOTICE_ADMIN_ONLY: row(KIND.GUIDE),
  BUG_NOT_FOUND: row(KIND.MISSING),
  BUG_PRIVATE: row(KIND.PRIVATE),
  CONCURRENT_UPDATE: row(KIND.CONFLICT), BUG_ANSWER_CONFLICT: row(KIND.CONFLICT),
  BUG_PRIVATE_ANSWER_ONLY: row(KIND.GUIDE),
  [SHAPE_CODE]: row(KIND.SITE), [INVALID_CODE]: row(KIND.SITE),
});
const OFFLINE_ACTION = 'offline';   // api-errors.js — 닿지 못함

const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
const cnt = (v) => typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v;
const msOf = (iso) => { const t = typeof iso === 'string' ? Date.parse(iso) : NaN; return isFinite(t) ? t : 0; };
const low = (v) => str(v).toLowerCase();
const shapeError = (why) => Object.assign(new Error('제보 응답 모양이 달라요 — ' + why), { code: SHAPE_CODE });
const invalid = (why) => Object.assign(new Error('제보 값이 맞지 않아요 — ' + why), { code: INVALID_CODE });

/* 실패 하나 → { kind, code }. errs = TwApiErrors(translate · COMMON). 기능 표 → 그 갈래 · 공통 code · 닿지 못함 → common · 그 밖 → site */
function failOf(err, errs){
  const t = errs.translate(err, ERRORS);
  let kind;
  if(own(ERRORS, t.code)) kind = t.action;
  else if(own(errs.COMMON, t.code) || t.action === OFFLINE_ACTION) kind = KIND.COMMON;
  else kind = KIND.SITE;
  return { kind, code: t.code };
}

/* 서버 글 줄(Summary · Detail 공통 칸) → 화면 칸. 번호 · 공개 범위가 틀리면 null */
function headOf(s){
  if(!isObj(s) || !nonEmpty(s.number) || !own(VIS_OF, s.visibility) || !isObj(s.author)) return null;
  const lastAnswer = msOf(s.lastAnswerAt), lastReply = msOf(s.lastAuthorReplyAt);
  return {
    number: s.number, vis: VIS_OF[s.visibility], cat: low(s.category), title: str(s.title), status: low(s.status),
    notice: s.notice === true, byAdmin: s.byAdmin === true,
    anon: s.author.anonymous === true, name: str(s.author.name), mine: s.mine === true,
    createdAt: msOf(s.createdAt), answeredAt: lastAnswer,
    authorReplied: lastReply > lastAnswer,   // 관리자 목록 «✍ 글쓴이 답글» — 글쓴이 답글이 운영자의 마지막 답변보다 뒤
  };
}
/* 목록 한 줄 → row. 모양이 틀리면 null */
function rowOf(s){
  const h = headOf(s); if(!h) return null;
  return Object.assign(h, { likeN: cnt(s.likeCount) ? s.likeCount : 0, ansN: cnt(s.answerCount) ? s.answerCount : 0, unseen: s.unseen === true });
}
/* 쪽(data) → { items, next }. 모양이 틀리면 던진다(SHAPE — 빈 목록으로 돌리지 않는다) */
function pageOf(d){
  if(!isObj(d) || !Array.isArray(d.items)) throw shapeError('items 없음');
  const items = d.items.map(rowOf);
  if(items.some((x) => !x)) throw shapeError('글 줄');
  return { items, next: nonEmpty(d.nextCursor) ? d.nextCursor : null };
}
/* 댓글 하나 → 화면 칸. 글쓴이 답글은 공개 범위 칸이 없어 글의 공개 범위를 따른다 */
function commentOf(c, postVis){
  if(!isObj(c) || !nonEmpty(c.id) || (c.kind !== 'ADMIN_ANSWER' && c.kind !== 'AUTHOR_REPLY')) return null;
  return { id: c.id, byAuthor: c.kind === 'AUTHOR_REPLY', text: str(c.text), kakao: nonEmpty(c.kakaoLink) ? c.kakaoLink : null,
    vis: own(VIS_OF, c.visibility) ? VIS_OF[c.visibility] : postVis, st: low(c.statusAfter), at: msOf(c.createdAt) };
}
/* 글 하나(Detail) → post. 댓글은 시간순. 모양이 틀리면 던진다 */
function postOf(d){
  const h = headOf(d);
  if(!h || !Array.isArray(d.comments) || !cnt(d.version)) throw shapeError('글');
  const comments = d.comments.map((c) => commentOf(c, h.vis));
  if(comments.some((x) => !x)) throw shapeError('댓글');
  comments.sort((a, b) => a.at - b.at);
  return Object.assign(h, { body: str(d.body), env: nonEmpty(d.env) ? d.env : null, canReply: d.canReply === true,
    likeN: cnt(d.likeCount) ? d.likeCount : 0, liked: d.liked === true, version: d.version, comments,
    lastAnswerIso: nonEmpty(d.lastAnswerAt) ? d.lastAnswerAt : null });
}
function quotaOf(d){
  if(!isObj(d) || !cnt(d.usedToday) || !(d.dailyMax === null || cnt(d.dailyMax))) throw shapeError('남은 수');
  return { dailyMax: d.dailyMax, usedToday: d.usedToday };
}
/* 새 글 본문 — 분류 · 공개 범위는 서버 이름으로. 공지는 켤 때만 싣는다(서버가 관리자인지 본다). 화면 열쇠가 틀리면 던진다(요청 0) */
function writeBody(requestId, p){
  if(!isObj(p) || !own(VIS, p.vis) || !nonEmpty(p.cat)) throw invalid('공개 범위 · 분류');
  const body = { requestId, visibility: VIS[p.vis], category: p.cat.toUpperCase(), title: str(p.title).trim(), body: str(p.body).trim() };
  const env = str(p.env).trim();
  if(env) body.env = env;
  if(p.notice === true) body.notice = true;
  return body;
}
/* 관리자 설정 목록의 한 줄(bug.report) → { version, notice, link }. 값이 비었으면 기본값 칸을 쓴다. 모양이 틀리면 null */
function reportConfigOf(r){
  if(!isObj(r) || r.key !== REPORT_KEY || !cnt(r.version)) return null;
  const v = isObj(r.value) ? r.value : (isObj(r.default) ? r.default : null);
  if(!v || !nonEmpty(v.notice)) return null;
  return { version: r.version, notice: v.notice, link: str(v.link) };
}
/* 링크 칸 — 비우거나 오픈채팅 주소(서버가 답변 kakaoLink 와 같은 규칙으로 본다) */
const linkOk = (l) => l === '' || (l.length <= LINK_MAX && l.indexOf(KAKAO_PREFIX) === 0 && l.length > KAKAO_PREFIX.length);
const queryOf = (o) => '?' + Object.keys(o).filter((k) => o[k] != null).map((k) => k + '=' + enc(o[k])).join('&');

/** @param {{
 *   authed: { get: (path: string, opts: object) => Promise<any>, post: Function, put: Function, patch: Function },   // 로그인 통로(TwApi.authed)
 *   errs: { translate: Function, COMMON: object },   // TwApiErrors(공통 표)
 *   pending: () => { idFor: (key: string) => string, settle: (key: string) => void },   // 요청 번호 기억 만들기(TwRequestId.createPending)
 * }} deps */
function createBugApi(deps){
  const authed = deps.authed;
  const errs = deps.errs;
  const newPending = deps.pending;
  let ids = newPending();
  let epoch = 0;        // reset 마다 오른다 — 앞 계정의 늦은 배지 답이 새 계정 수를 덮지 않게
  let badge = null;     // 새 답변 배지 수(null = 아직 모름)

  const get = (path) => authed.get(path, { auth: true });
  /* 번호가 있는 쓰기 — 서버가 답했으면(성공 · 거절) 번호를 끝내고, 닿지 못했으면 남겨 다시 눌러도 같은 번호 */
  async function once(key, send){
    const id = ids.idFor(key);
    try{
      const d = await send(id);
      ids.settle(key);
      return d;
    }catch(e){
      if(e && e.status) ids.settle(key);
      throw e;
    }
  }

  async function list(filter, cursor, limit){
    if(FILTERS.indexOf(filter) < 0) throw invalid('필터');
    const n = cnt(limit) && limit >= 1 && limit <= LIMIT_MAX ? limit : null;
    return pageOf(await get(PATHS.list + queryOf({ filter, limit: n, cursor: nonEmpty(cursor) ? cursor : null })));
  }
  async function notices(){
    return pageOf(await get(PATHS.list + queryOf({ filter: 'notices' }))).items;
  }
  async function detail(number){
    if(!nonEmpty(number)) throw invalid('글 번호');
    return postOf(await get(PATHS.one(number)));
  }
  async function write(p){
    const d = await once(WRITE_KEY, (id) => authed.post(PATHS.list, writeBody(id, p)));
    if(!isObj(d) || !nonEmpty(d.number)) throw shapeError('새 글 번호');
    return { number: d.number };
  }
  async function reply(number, a){
    if(!nonEmpty(number)) throw invalid('글 번호');
    const status = str(a && a.status).toUpperCase(), text = str(a && a.text).trim();
    if(!status) throw invalid('상태');
    await once(replyKey(number), (id) => authed.post(PATHS.replies(number), { requestId: id, text, status }));
  }
  async function setVis(number, version, vis){
    if(!nonEmpty(number) || !cnt(version) || !own(VIS, vis)) throw invalid('공개 범위');
    const d = await authed.patch(PATHS.visibility(number), { version, visibility: VIS[vis] });
    if(!isObj(d) || !own(VIS_OF, d.visibility) || !cnt(d.version)) throw shapeError('공개 범위');
    return { vis: VIS_OF[d.visibility], version: d.version };
  }
  /* 관리자 답변 — 요청 번호는 글마다 하나. 쓴 글 · 상태 · 공개 범위 · 링크는 화면이 고른 대로(비공개 글은 비공개만 — 서버가 400) */
  async function answer(number, a){
    if(!nonEmpty(number) || !isObj(a)) throw invalid('글 번호');
    const text = str(a.text).trim(), status = str(a.status).toUpperCase(), kakao = str(a.kakaoLink).trim();
    if(!text || !status || !own(VIS, a.vis)) throw invalid('답변');
    if(kakao && !linkOk(kakao)) throw invalid('오픈카톡 링크');
    if(a.seenLastAnswerAt != null && !nonEmpty(a.seenLastAnswerAt)) throw invalid('본 답변 시각');
    await once(answerKey(number), (id) => {
      const body = { requestId: id, seenLastAnswerAt: a.seenLastAnswerAt == null ? null : a.seenLastAnswerAt, text, status, visibility: VIS[a.vis] };
      if(kakao) body.kakaoLink = kakao;
      return authed.post(PATHS.answers(number), body);
    });
  }
  /* 오픈카톡 기본 링크 — 설정 목록에서 bug.report 한 줄을 찾는다. 없거나 모양이 틀리면 던진다(빈 값으로 돌리지 않는다) */
  async function reportConfig(){
    const d = await get(PATHS.adminConfig);
    if(!Array.isArray(d)) throw shapeError('설정 목록');
    const c = reportConfigOf(d.find((r) => isObj(r) && r.key === REPORT_KEY));
    if(!c) throw shapeError('제보 설정');
    return c;
  }
  /* 저장 — 안내 글(notice)은 받은 값 그대로 싣는다(서버가 두 칸을 한 키로 받는다). 판이 다르면 CONCURRENT_UPDATE */
  async function saveReportLink(cfg, link){
    const l = str(link).trim();
    if(!isObj(cfg) || !cnt(cfg.version) || !nonEmpty(cfg.notice) || !linkOk(l)) throw invalid('오픈카톡 링크');
    const d = await authed.put(PATHS.reportConfig, { version: cfg.version, value: { notice: cfg.notice, link: l } });
    const c = reportConfigOf(d);
    if(!c) throw shapeError('제보 설정');
    return c;
  }
  async function like(number){
    if(!nonEmpty(number)) throw invalid('글 번호');
    const d = await authed.put(PATHS.like(number), {});
    if(!isObj(d) || !cnt(d.likeCount) || typeof d.liked !== 'boolean') throw shapeError('공감 수');
    return { likeN: d.likeCount, liked: d.liked };
  }
  async function seen(number){
    if(!nonEmpty(number)) throw invalid('글 번호');
    await authed.put(PATHS.seen(number), {});
  }
  async function quota(){ return quotaOf(await get(PATHS.quota)); }
  /* 배지 수 한 번 받기 — 받으면 기억하고 돌려준다. 못 받으면 기억은 그대로 두고 던진다 */
  async function refreshBadge(){
    const at = epoch;
    const n = await get(PATHS.unseenCount);
    if(!cnt(n)) throw shapeError('배지 수');
    if(at === epoch) badge = n;
    return n;
  }

  return {
    KIND, ERRORS,   // 화면이 갈래 · 기능 표를 이 인스턴스로 받는다(전역을 다시 읽지 않게)
    list, notices, detail, write, reply, answer, reportConfig, saveReportLink, setVis, like, seen, quota, refreshBadge,
    badgeCount: () => badge,
    failOf: (err) => failOf(err, errs),
    reset: () => { epoch++; badge = null; ids = newPending(); },
  };
}

const out = { PATHS, KIND, ERRORS, VIS, VIS_OF, LIMIT_MAX, reportConfigOf, linkOk, rowOf, postOf, pageOf, quotaOf, writeBody, failOf, createBugApi };
if(typeof window !== 'undefined') window.TwBugApi = out;
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
