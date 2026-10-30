/* retry-delay.js — 🔁 못 받은 뒤 스스로 다시 받기까지 쉬는 시간 한 곳 (검사 sim-retry-delay.js)
   규칙: 30초부터 두 배씩, 10분이 상한. n = 이어서 실패한 횟수(첫 실패 뒤 다시 받기 전은 0). 성공하면 부르는 쪽이 n 을 0 으로 되돌린다.
   쓰는 곳: myhome/mail-feed.js · launcher/notice-feed.js. (status/playlist.js 의 같은 규칙은 아직 자기 상수 — 옮기면 이 파일로.)
   classic script(window.TwRetryDelay) — 쓰는 모듈 · app.js 보다 먼저 싣는다. 순수 함수만. */
(function(){
'use strict';

const RETRY_MS = 30000;
const RETRY_MAX_MS = 10 * 60000;
const EXP_MAX = 10;   // 지수가 커져 넘치지 않게

function delay(n){
  const k = Math.max(0, Math.min(EXP_MAX, Math.floor(Number(n)) || 0));
  return Math.min(RETRY_MAX_MS, RETRY_MS * Math.pow(2, k));
}

const api = { delay, RETRY_MS, RETRY_MAX_MS };
if(typeof window !== 'undefined') window.TwRetryDelay = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
