/* bug-board.js — 🐞 버그제보 게시판 규칙 — 상수 · 순수 함수만 (검사 sim-bug-board.js)
   [왜] 원본은 서버다(/v1/bugs*). 화면(bug-board-ui.js)과 provider(bug-api.js)가 같이 보는 값 — 분류 · 상태 이름 · 입력 상한 · 안내 문구 — 을 한 곳에 둔다.
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
const KAKAO_RE = /^https:\/\/open\.kakao\.com\//;
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

const out = { BUG_PAGE, BUG_ANON, BUG_TITLE_MAX, BUG_BODY_MAX, BUG_ENV_MAX, BUG_ANS_MAX, BUG_CATS, BUG_STATUS, BUG_AUTHOR_STATUS, KAKAO_RE,
  BUG_VIS_NOTE, BUG_VIS_LOCKED, GUIDE_TEXT, ANSWER_CONFLICT_TEXT, CONFIG_CONFLICT_TEXT, KAKAO_LINK_RULE, checkPost, canChangeVis };
if(typeof window !== 'undefined') window.TwBugBoard = out;
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
