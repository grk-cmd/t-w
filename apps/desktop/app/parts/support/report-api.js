/* report-api.js — 🚩 신고 provider — 신고 서버 길(POST /v1/reports) 한 벌 (검사 sim-report.js)
   [왜] 신고는 서버가 원본이다. 신고한 사람은 서버가 로그인 토큰에서 정한다 — 앱은 내 이름 · 코드를 싣지 않는다.
     신고 창(report.js)은 경로 · 본문 모양 · 서버 종류 이름을 모르고 이 파일의 함수만 부른다.
   [모양] file(target, kind, note) → Promise<void>. 성공이면 끝, 실패는 api-client.js 의 ApiError 그대로 던진다.
     kind 는 신고 창의 사유 이름(char · away · nick · etc) — 서버 이름(KIND)으로 바꾸는 곳은 여기뿐이다.
     보내기 전에 틀린 값(대상 없음 · 모르는 사유 · 사유가 40자를 넘음)이면 요청 없이 code 'INVALID' 로 던진다.
   [신원] target 은 신고할 사람의 사용자 코드 — 데이터 주소일 뿐이다. 같은 사람을 다시 신고하면 서버가 열린 신고를 고친다(같은 결과라 requestId 칸이 없다).
   ⚠️ 실패해도 다시 보내지 않는다 — 다시 하는 길은 사용자가 [신고] 를 다시 누르는 것뿐.
   classic script — api-client.js 다음 · report.js · app.js 보다 먼저 싣는다(window.TwReportApi). Firebase 를 모른다. */
(function(){
'use strict';

const PATHS = Object.freeze({ file: '/v1/reports' });
/* 신고 창의 사유 이름 → 서버 종류 이름 */
const KIND = Object.freeze({ char: 'CHARACTER', away: 'AWAY_IMAGE', nick: 'NICKNAME', etc: 'ETC' });
const NOTE_MAX = 40;   // 서버 상한과 같다 — 넘기면 서버가 거절한다
/* 서버 오류 code(계약) — 신고 창이 갈래를 가를 때 쓴다 */
const CODE = Object.freeze({ SELF: 'REPORT_SELF', NOTE_REQUIRED: 'REPORT_NOTE_REQUIRED', NO_AWAY_IMAGE: 'REPORT_NO_AWAY_IMAGE', INVALID: 'INVALID' });

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const invalid = (why) => Object.assign(new Error('신고 값이 맞지 않아요 — ' + why), { code: CODE.INVALID });

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

/** @param {{ authed: { post: (path: string, body: object) => Promise<any> } }} deps
 *   authed 는 로그인 API 통로(TwApi.authed — 토큰은 통로가 붙인다) */
function createReportApi(deps){
  const authed = deps.authed;

  /* 신고 한 번 — 성공이면 끝, 실패는 던진다(«실패 ≠ 없음») */
  async function file(target, kind, note){
    const body = bodyOf(target, kind, note);
    await authed.post(PATHS.file, body);
  }

  return { file };
}

const out = { PATHS, KIND, NOTE_MAX, CODE, bodyOf, createReportApi };
if(typeof window !== 'undefined') window.TwReportApi = out;
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
