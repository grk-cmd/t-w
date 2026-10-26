/* img-retry.js — 🖼 남의 그림(crossOrigin)을 처음 못 받았을 때 한 번 더 받을 주소 — 규칙 한 곳
   ・내놓는 것: retryUrl(u) — 다시 받을 주소(주소 뒤 RETRY_MARK) · 다시 받지 않을 주소(dataURL 등 http(s) 아닌 것 · 이미 표식이 붙은 것)면 null
              laterRetryMs(u, n) — 두 번 다 못 받은 그림을 n 번째(0부터)로 나중에 다시 받기까지 기다릴 ms · 그만둘 때(http(s) 아님 · 횟수 다 씀)면 null
   ⚠️ 표식은 고정값이다 — 같은 그림이 CORS 없이 먼저 캐시돼 있으면(그냥 <img>) 원래 주소로는 계속 막히는데, 다시 받은 응답이
     이 주소로 캐시돼 다음부터는 요청이 늘지 않는다(Date.now() 를 붙이면 매번 새로 받는다).
   순수 함수(DOM · 네트워크 없음). 쓰는 곳: room/room-sync.js(남의 얼굴 · 감은눈) · character/animal.js(동물 페인트 그림) · room/room-server-net.js(얼굴 못 받은 def 다시 풀기 — room-sync.js 가 hooks 로 넘김).
   검사: checks/sim-img-retry.js */
(function(){

const RETRY_MARK = 'twr=1';
/* 잠깐 끊긴 Storage · 막 올라간 그림은 조금 뒤엔 받힌다 — 늘 받기(폴링)가 되지 않게 세 번까지만, 점점 길게 */
const LATER_RETRY_MS = Object.freeze([5000, 20000, 60000]);

function retryUrl(u){
  const s = String(u == null ? '' : u);
  if(!/^https?:/i.test(s)) return null;
  if(/[?&]twr=1(?:&|$)/.test(s)) return null;   // 이미 다시 받은 주소 — 두 번까지만
  return s + (s.indexOf('?') >= 0 ? '&' : '?') + RETRY_MARK;
}

function laterRetryMs(u, n){
  if(!/^https?:/i.test(String(u == null ? '' : u))) return null;
  return (Number.isInteger(n) && n >= 0 && n < LATER_RETRY_MS.length) ? LATER_RETRY_MS[n] : null;
}

const api = { retryUrl, laterRetryMs, RETRY_MARK, LATER_RETRY_MS };
if(typeof window !== 'undefined') window.TwImgRetry = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
