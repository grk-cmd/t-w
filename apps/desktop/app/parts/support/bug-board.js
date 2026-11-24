/* bug-board.js — 🐞 버그제보 게시판 규칙 — 상수 · 순수 함수만 (검사 sim-bug-board.js)
   [왜] 원본은 서버다(/v2/bugs*). 화면(bug-board-ui.js)과 provider(bug-api.js)가 같이 보는 값 — 분류 · 상태 이름 · 입력 상한 · 안내 문구 — 을 한 곳에 둔다.
     경로 · 서버 모양은 bug-api.js 만 안다. 여기는 요청 · DOM · 저장을 모른다.
   [상한] 서버와 같은 값(제목 60 · 본문 2000 · 환경 120 · 답글 1000) — 넘기면 서버가 거절하니 화면이 먼저 막는다.
   [분류 · 상태] 서버 이름(BUG · SUGGEST · REVIEW …)의 소문자가 화면 열쇠다. 하나 늘리면 서버 값과 같이.
   classic script — bug-api.js · bug-board-ui.js · app.js 보다 먼저 싣는다(window.TwBugBoard). */
(function(){
'use strict';

const BUG_PAGE = 8;          // 한 쪽(전체 · 미해결 · 내 글 모두) — 서버 limit 로 보낸다
const BUG_ANON = '익명';     // 비공개 글 · 익명 글쓴이의 이름 칸
const BUG_TITLE_MAX = 60, BUG_BODY_MAX = 2000, BUG_ENV_MAX = 120, BUG_ANS_MAX = 1000;
const BUG_CATS = Object.freeze([
  ['bug', '오류 · 멈춤'], ['ui', '화면 · 표시'], ['room', '방 · 접속'],
  ['chat', '채팅'], ['myhome', '마이홈'], ['suggest', '건의'], ['etc', '기타'],
]);
/* unfixed 는 글쓴이가 «해결 안 됨» 으로 되돌린 글 · review 는 관리자가 건의를 «검토중» 으로 둔 글(둘 다 미해결 목록에 낀다 — 서버가 거른다) */
const BUG_STATUS = Object.freeze({ new: '접수', checking: '확인 중', review: '검토중', fixed: '수정 완료', norepro: '재현 안 됨', unfixed: '해결 안 됨' });
/* 글쓴이가 답글과 함께 고르는 상태 — 서버가 글쓴이에게 받는 셋과 같다. 버튼 이름은 글쓴이 말투로 */
const BUG_AUTHOR_STATUS = Object.freeze([['checking', '확인 중'], ['unfixed', '해결 안 됨'], ['fixed', '해결 완료']]);
const KAKAO_RE = /^https:\/\/open\.kakao\.com\/.+/;   // 오픈카톡 주소 판정 한 곳(길이 300 은 입력칸 maxlength · 서버가 다시 본다)
const BUG_VIS_NOTE = '공개 범위는 운영자 답변이나 내 답글이 달리기 전까지만 바꿀 수 있어요.';
const BUG_VIS_LOCKED = '운영자 답변이나 내 답글이 달린 글은 공개 범위를 바꿀 수 없어요.';

/* 서버 거절 code → 화면 안내 문구(번호 없음). 갈래(guide)는 bug-api.js ERRORS 가 정한다 — 이 표는 문구만 */
const GUIDE_TEXT = Object.freeze({
  BUG_DAILY_LIMIT: '오늘은 더 제보할 수 없어요 — 내일 다시 써 주세요',
  BUG_REPLY_TOO_SOON: '잠시 뒤에 다시 등록해 주세요',
  BUG_NOT_AUTHOR: '글쓴이만 답글을 달 수 있어요',
  BUG_NOTICE_NO_REPLY: '공지에는 답글을 달 수 없어요',
  BUG_VIS_NOT_AUTHOR: '글쓴이만 바꿀 수 있어요',
  BUG_VIS_LOCKED: BUG_VIS_LOCKED,
  BUG_NOTICE_MUST_BE_PUBLIC: '공지는 공개 글이어야 해요',
  BUG_NOTICE_ADMIN_ONLY: '공지는 관리자만 쓸 수 있어요',
  BUG_PRIVATE: '🔒 비공개 제보예요',
  BUG_PRIVATE_ANSWER_ONLY: '비공개 글이라 답변도 비공개로만 달 수 있어요',
});
const ANSWER_CONFLICT_TEXT = '다른 관리자가 먼저 답했어요 — 새 답변을 확인해 주세요';
const CONFIG_CONFLICT_TEXT = '다른 곳에서 바꾼 내용을 받아왔어요';
const KAKAO_LINK_RULE = '오픈카톡 링크는 https://open.kakao.com/ 으로 시작해야 해요';

/* 새 글 입력 확인 — 서버와 같은 상한. 문제가 없으면 null */
function checkPost(p){
  if(!p) return '내용이 없어요';
  const title = String(p.title || '').trim(), body = String(p.body || '').trim();
  if(!title) return '제목을 적어 주세요';
  if(!body) return '내용을 적어 주세요';
  if(title.length > BUG_TITLE_MAX) return '제목은 ' + BUG_TITLE_MAX + '자까지예요';
  if(body.length > BUG_BODY_MAX) return '내용은 ' + BUG_BODY_MAX + '자까지예요';
  if(p.vis !== 'pub' && p.vis !== 'prv') return '공개 범위를 골라 주세요';
  if(!BUG_CATS.some((c) => c[0] === p.cat)) return '분류를 골라 주세요';
  if(p.notice && p.vis !== 'pub') return GUIDE_TEXT.BUG_NOTICE_MUST_BE_PUBLIC;
  return null;
}
/* 공개 범위 바꾸기 버튼을 켤까 — 내 글 · 공지 아님 · 운영자 답변 · 내 답글이 하나도 없음(서버 공개 범위 바꾸기와 같은 조건).
   post 는 bug-api.js detail 이 준 글(글쓴이에겐 비공개 답변도 다 보인다) */
function canChangeVis(post){
  return !!post && post.mine === true && !post.notice && Array.isArray(post.comments) && post.comments.length === 0;
}

/* 📝 임시저장 — 이 PC 에만(localStorage BUG_DRAFT_KEY) 최대 BUG_DRAFT_MAX 개. 순수 계산만 여기 · 읽고 쓰기는 화면(bug-board-ui.js).
   계정마다 따로 — 저장본에 주인 코드(owner)를 같이 두고, 주인이 다르면 빈 것으로 본다(계정을 바꾸면 account.js ACCOUNT_LOCAL_KEYS 로도 지운다). */
const BUG_DRAFT_KEY = 'tw.bugDrafts';
const BUG_DRAFT_MAX = 3;
const draftOf = (d) => ({ id: String(d.id), ts: Number(d.ts) || 0, cat: typeof d.cat === 'string' ? d.cat.slice(0, 20) : '',
  title: typeof d.title === 'string' ? d.title.slice(0, BUG_TITLE_MAX) : '', body: typeof d.body === 'string' ? d.body.slice(0, BUG_BODY_MAX) : '',
  vis: d.vis === 'prv' ? 'prv' : 'pub' });
const draftIsEmpty = (d) => !d || (!String(d.title || '').trim() && !String(d.body || '').trim());
/* 저장본(글자) → 목록. 깨졌거나 · 주인이 다르거나 · 모양이 틀린 줄은 버린다 · 최근 것부터 · 많아야 MAX */
function draftsRead(raw, owner){
  let v = null;
  try{ v = JSON.parse(raw); }catch(_){ return []; }
  if(!v || typeof v !== 'object' || !owner || v.owner !== owner || !Array.isArray(v.items)) return [];
  return v.items.filter(d => d && typeof d === 'object' && d.id != null && !draftIsEmpty(d)).map(draftOf)
    .sort((x, y) => y.ts - x.ts).slice(0, BUG_DRAFT_MAX);
}
const draftsWrite = (list, owner) => JSON.stringify({ owner, items: list.map(draftOf) });
/* 저장 — 불러온 글(id 가 같은 것)은 덮어쓰고, 새 글은 칸이 있을 때만. { ok, list, id } · 실패면 { ok:false, reason:'empty'|'full' } */
function draftsSave(list, d, now, newId){
  if(draftIsEmpty(d)) return { ok: false, reason: 'empty' };
  const cur = (list || []).slice();
  const i = d.id != null ? cur.findIndex(x => x.id === String(d.id)) : -1;
  if(i < 0 && cur.length >= BUG_DRAFT_MAX) return { ok: false, reason: 'full' };
  const id = i >= 0 ? cur[i].id : String(newId);
  const one = draftOf(Object.assign({}, d, { id, ts: now }));
  if(i >= 0) cur[i] = one; else cur.push(one);
  return { ok: true, id, list: cur.sort((x, y) => y.ts - x.ts) };
}
const draftsRemove = (list, id) => (list || []).filter(x => x.id !== String(id));
/* 지금 쓰는 글이 «저장할 게 있는» 글인가 — 비었으면 아니고, 불러온 그대로(안 고침)여도 아니다 */
function draftDirty(d, loaded){
  if(draftIsEmpty(d)) return false;
  if(!loaded) return true;
  return ['cat', 'title', 'body', 'vis'].some(k => String(d[k] || '') !== String(loaded[k] || ''));
}

/* 🔎 비슷한 제보 — 새 제보를 올리기 전 «이미 제보되어 있어요» 창에 띄울 글을 고른다(순수 계산).
   제목을 낱말로 나눠 조사 · 흔한 말(오류 · 안 돼요 …)을 떼고, 두 글자씩 끊은 조각이 얼마나 겹치는지(0~1)로 본다 —
   «레벨이 안 올라가요» · «레벨이 안올라요» 처럼 띄어쓰기 · 말끝이 달라도 잡히게. 공지는 비교하지 않는다. */
const BUG_SIMILAR_MAX = 3;          // 창에 보일 줄 수
const BUG_SIMILAR_MIN = 0.4;        // 이만큼 겹쳐야 «비슷함»(실제 제보 제목으로 맞춘 값)
const BUG_SIMILAR_FETCH = 20;       // 비교할 글 — 미해결 · 최근 각각 이만큼(서버 목록 limit 로 보낸다)
const SIM_STOP = new Set(['오류', '버그', '문제', '현상', '관련', '문의', '질문', '제보', '에러', '오작동', '안됨', '안돼요', '안되요',
  '안됩니다', '됩니다', '합니다', '해요', '입니다', '있어요', '없어요', '같아요', '것', '좀', '계속', '자꾸', '너무', '갑자기']);
const SIM_TAIL = /(은|는|이|가|을|를|도|에|의|로|으로|에서|이랑|랑|하고|와|과|요|니다|해요|돼요|되요|나요|어요|아요)$/;
function titleWords(t){
  return String(t == null ? '' : t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ')
    .map(w => w.replace(SIM_TAIL, '')).filter(w => w.length >= 2 && !SIM_STOP.has(w));
}
function titleGrams(t){
  const c = titleWords(t).join(''), g = new Set();
  for(let i = 0; i < c.length - 1; i++) g.add(c.slice(i, i + 2));
  return g;
}
function titleSimilarity(a, b){
  const A = titleGrams(a), B = titleGrams(b);
  if(!A.size || !B.size) return 0;
  let n = 0; A.forEach(x => { if(B.has(x)) n++; });
  return 2 * n / (A.size + B.size);
}
/* 받은 글들 중 제목이 비슷한 것 — 겹친 정도 · 최근 순, 같은 글은 한 번만, 많아야 BUG_SIMILAR_MAX */
function similarPosts(title, items, max){
  const lim = max > 0 ? max : BUG_SIMILAR_MAX, seen = new Set();
  return (items || []).filter(it => it && it.id && !it.notice && typeof it.title === 'string' && it.title && !seen.has(it.id) && seen.add(it.id))
    .map(it => ({ it, s: titleSimilarity(title, it.title) })).filter(x => x.s >= BUG_SIMILAR_MIN)
    .sort((x, y) => (y.s - x.s) || ((y.it.ts || 0) - (x.it.ts || 0))).slice(0, lim).map(x => x.it);
}

const out = { BUG_PAGE, BUG_ANON, BUG_TITLE_MAX, BUG_BODY_MAX, BUG_ENV_MAX, BUG_ANS_MAX, BUG_CATS, BUG_STATUS, BUG_AUTHOR_STATUS, KAKAO_RE,
  BUG_VIS_NOTE, BUG_VIS_LOCKED, GUIDE_TEXT, ANSWER_CONFLICT_TEXT, CONFIG_CONFLICT_TEXT, KAKAO_LINK_RULE, checkPost, canChangeVis,
  BUG_DRAFT_KEY, BUG_DRAFT_MAX, draftIsEmpty, draftsRead, draftsWrite, draftsSave, draftsRemove, draftDirty,
  BUG_SIMILAR_MAX, BUG_SIMILAR_MIN, BUG_SIMILAR_FETCH, titleWords, titleSimilarity, similarPosts };
if(typeof window !== 'undefined') window.TwBugBoard = out;
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
