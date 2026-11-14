/* visit-ping.js — 📈 방문 기록 — 앱이 켜질 때 서버에 한 번(POST /v1/metrics/visits · 204) (검사 sim-visit-ping.js)
   로그인하지 않은 사람도 센다(토큰 없는 길 — 부르는 쪽 user-api.js visit 이 토큰이 있으면 싣고 없거나 거절되면 빼고 보낸다).
   지표가 앱을 막으면 안 된다 — 부팅이 붐비는 때를 피해 조금 뒤에 부르고, 어떤 실패도 삼키며, 다시 시도하지 않는다.
   classic script — app.js 보다 먼저 싣는다(window.TwVisitPing). app.js 가 계정 provider 를 만든 뒤 createVisitPing(deps).start() 한 번. */
(function(){
'use strict';

const VISIT_PING_DELAY_MS = 8000;
// 한 프로세스에 한 번 — 다시 만들어져도(검사 · 모듈 다시 싣기) 창 표시를 보고 그만둔다
const VISIT_PING_FLAG = '__twVisitPingStarted';

/** @param {{ callPing: () => Promise<unknown>, win: { setTimeout: Function }, delayMs?: number }} deps */
function createVisitPing(deps){
  const callPing = deps.callPing;
  const delayMs = typeof deps.delayMs === 'number' ? deps.delayMs : VISIT_PING_DELAY_MS;
  const win = deps.win;

  async function ping(){
    try{ await callPing(); }catch(_){ /* 서버 배포 전 · 오프라인 · CSP 차단 — 지표만 빠진다 */ }
  }
  function start(){
    if(win[VISIT_PING_FLAG]) return false;
    win[VISIT_PING_FLAG] = true;
    try{ win.setTimeout(()=>{ ping(); }, delayMs); }catch(_){}
    return true;
  }
  return { start };
}

const api = { VISIT_PING_DELAY_MS, VISIT_PING_FLAG, createVisitPing };
if(typeof window !== 'undefined') window.TwVisitPing = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
