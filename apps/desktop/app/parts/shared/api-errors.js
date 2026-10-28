/* api-errors.js — 🧭 서버 오류 봉투 → 앱이 할 일 · 오류 번호 번역표 (검사 sim-api-errors.js)
   [왜] 서버 실패는 봉투 { success:false, code, message, items? } 하나다(api-client.js 가 ApiError 로 푼다). 기능마다 code 를 다시 읽어
     «로그인 화면 · 점검 창 · 다시 받기 · 토스트 번호» 를 따로 정하면 같은 code 가 화면마다 다르게 다뤄진다 — 공통 code 는 여기 한 곳.
   [표] 공통 code → { action, notice }.
     action: 'login'(로그인이 풀림 — 로그인 화면) · 'signup'(이 로그인의 계정이 없음 — 가입 화면 · 이 PC 계정 몫 지움) · 'maintenance'(서버 점검 — 점검 창)
       · 'refetch'(다른 곳에서 먼저 바뀜 — 다시 받고 내 칸만 얹어 한 번 더) · 'later'(너무 잦음 — retryAfterMs 뒤) · 'offline'(닿지 못함 — 연결 필요 안내)
       · 'notice'(그 밖 — 번호 토스트만).
     notice: (notifyError, err) => 번호 알림 — 번호는 error-codes.js 표에 먼저 넣고 notifyError 첫 인자에 **글자 그대로** 쓴다(검사가 찾는다). null 이면 토스트 없음.
   [기능 오류] AVATAR_* · GIFT_* 같은 컨텍스트 code 는 그 묶음이 자기 표를 만들어 넘긴다 — translate(err, 내 표) · notify(err, 내 표).
     내 표가 공통 표보다 먼저다(같은 code 를 기능이 다르게 다룰 수 있게). 표에 없는 4xx 는 'notice' E-NET-08.
   ⚠️ 점검 중엔 error-codes.js 가 토스트를 내지 않는다(muted) — 'maintenance' 는 토스트 없이 할 일만 돌려준다.
   classic script — error-codes.js · api-client.js 다음 · 쓰는 모듈 · app.js 보다 먼저 싣는다(window.TwApiErrors). 화면을 직접 안 만진다. */
(function(){
'use strict';

const ACTION = Object.freeze({
  LOGIN: 'login', SIGNUP: 'signup', MAINTENANCE: 'maintenance', REFETCH: 'refetch', LATER: 'later', OFFLINE: 'offline', NOTICE: 'notice',
});

/* 공통 code — 서버 봉투 code · 통로 code(api-client.js 가 만든 NO_TOKEN 등). 같은 이름은 서버와 같은 뜻이다(서버가 뜻을 바꾸지 않는다). */
const COMMON = Object.freeze({
  AUTH_REQUIRED: { action: ACTION.LOGIN, notice: (notifyError, e) => notifyError('E-NET-01', e) },
  NO_TOKEN: { action: ACTION.LOGIN, notice: (notifyError, e) => notifyError('E-NET-01', e) },
  USER_CODE_NOT_BOUND: { action: ACTION.SIGNUP, notice: null },   // 가입 화면이 곧 안내다
  SERVER_ADMIN_ONLY: { action: ACTION.MAINTENANCE, notice: null },   // 점검 창이 곧 안내다
  ACCESS_DENIED: { action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-02', e) },
  PREMIUM_REQUIRED: { action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-03', e) },
  TOO_MANY_REQUESTS: { action: ACTION.LATER, notice: (notifyError, e) => notifyError('E-NET-04', e) },
  CONCURRENT_UPDATE: { action: ACTION.REFETCH, notice: (notifyError, e) => notifyError('E-NET-05', e) },
  INVALID_REQUEST: { action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-06', e) },
  METHOD_NOT_ALLOWED: { action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-06', e) },
  UNSUPPORTED_MEDIA_TYPE: { action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-06', e) },
  PAYLOAD_TOO_LARGE: { action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-06', e) },
});
/* code 가 표에 없을 때 — 닿지 못함(통로 kind 'unavailable' · 'notReady')과 그 밖 */
const OFFLINE = Object.freeze({ action: ACTION.OFFLINE, notice: (notifyError, e) => notifyError('E-NET-07', e) });
const UNKNOWN = Object.freeze({ action: ACTION.NOTICE, notice: (notifyError, e) => notifyError('E-NET-08', e) });

const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

/* 오류 하나 → { code, action, notice, retryAfterMs, items }. table 은 기능의 표(같은 모양 · 공통보다 먼저).
   SERVER_ADMIN_ONLY 처럼 503 으로 오는 공통 code 는 «닿지 못함» 보다 먼저 본다. */
function translate(err, table){
  const code = String((err && err.code) || '');
  const kind = String((err && err.kind) || '');
  let row = null;
  if(code && own(table, code)) row = table[code];
  else if(code && own(COMMON, code)) row = COMMON[code];
  else if(kind === 'unavailable' || kind === 'notReady' || !kind) row = OFFLINE;
  else row = UNKNOWN;
  return {
    code,
    action: row.action,
    notice: row.notice || null,
    retryAfterMs: (err && typeof err.retryAfterMs === 'number') ? err.retryAfterMs : null,
    items: (err && Array.isArray(err.items)) ? err.items : null,
  };
}

/** @param {{ notifyError: (code: string, err: any, text?: string) => boolean }} deps */
function createApiErrors(deps){
  const notifyError = deps.notifyError;
  /* 번역하고 번호 토스트까지 — 돌려준 action 으로 부르는 쪽이 화면을 고른다(로그인 · 점검 창 · 다시 받기는 부르는 쪽 몫). */
  function notify(err, table){
    const t = translate(err, table);
    if(t.notice) t.notice(notifyError, err);
    return t;
  }
  return { notify, translate };
}

const api = { ACTION, COMMON, OFFLINE, UNKNOWN, translate, createApiErrors };
if(typeof window !== 'undefined'){
  /* 앱 한 벌 — 번호 토스트는 error-codes.js(부를 때 찾는다) */
  api.store = createApiErrors({ notifyError: (...a) => window.TwErrorCodes.notify(...a) });
  window.TwApiErrors = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
