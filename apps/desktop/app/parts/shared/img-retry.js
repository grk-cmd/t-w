/* img-retry.js — 🖼 남의 그림(crossOrigin)을 처음 못 받았을 때 한 번 더 받을 주소 — 규칙 한 곳
   ・내놓는 것: retryUrl(u) — 다시 받을 주소(주소 뒤 RETRY_MARK) · 다시 받지 않을 주소(dataURL 등 http(s) 아닌 것 · 이미 표식이 붙은 것)면 null
              laterRetryMs(u, n) — 두 번 다 못 받은 그림을 n 번째(0부터)로 나중에 다시 받기까지 기다릴 ms · 그만둘 때(http(s) 아님 · 횟수 다 씀)면 null
              retryOnError(img, onGiveUp) — 화면의 <img> 에 «못 받으면 retryUrl 로 한 번 더» 를 건다 · 그래도 못 받으면 onGiveUp(없으면 조용히)
              loadWithRetry(load, u) — load(u) 가 실패하면 retryUrl(u) 로 한 번 더 load · 다시 받을 주소가 없으면 처음 실패를 그대로 던진다(받기 함수는 부르는 쪽 것)
   ⚠️ 표식은 고정값이다 — 같은 그림이 CORS 없이 먼저 캐시돼 있으면(그냥 <img>) 원래 주소로는 계속 막히는데, 다시 받은 응답이
     이 주소로 캐시돼 다음부터는 요청이 늘지 않는다(Date.now() 를 붙이면 매번 새로 받는다).
   DOM 은 retryOnError 가 받은 <img> 의 src · onerror 만 만진다(네트워크 없음 · 넣는 주소는 TwSafeHtml.safeUrl 을 지난다 — safe-html.js 뒤에 싣는다). 쓰는 곳: room/room-sync.js(남의 얼굴 · 감은눈) · character/face-heal.js(그래픽 리셋 뒤 남의 얼굴 · 동물 그림 다시 그리기 — loadWithRetry) · character/animal.js(동물 페인트 그림) · room/room-rt.js(얼굴 못 받은 def 다시 풀기 — room-sync.js 가 hooks 로 넘김) · myhome/mallang.js · myhome/myhome-inbox.js(말랑이 · 선물 그림 — retryOnError).
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

/* 그냥 <img> 도 실패 응답이 캐시에 남으면 같은 주소로는 계속 빈칸이다 — 표식 주소로 한 번만 다시 받는다(retryUrl 이 두 번째를 막는다).
   ⚠️ src 를 넣기 전에 건다 — 넣은 뒤에 걸면 그 사이 난 실패를 놓친다. */
function retryOnError(img, onGiveUp){
  img.onerror = ()=>{
    const again = TwSafeHtml.safeUrl(retryUrl(img.src), 'image');   // 이미 받아 준 주소 뒤에 표식만 — 넣는 자리는 그래도 safe-html 을 지난다
    if(again){ img.src = again; return; }
    img.onerror = null;
    if(onGiveUp) onGiveUp();
  };
  return img;
}

/* 그림을 받는 함수(load: 주소 → Promise<이미지>)에 «처음 실패하면 표식 주소로 한 번 더» 를 씌운다 */
async function loadWithRetry(load, u){
  try{ return await load(u); }
  catch(e){
    const again = retryUrl(u);
    if(!again) throw e;
    return load(again);
  }
}

const api = { retryUrl, laterRetryMs, retryOnError, loadWithRetry, RETRY_MARK, LATER_RETRY_MS };
if(typeof window !== 'undefined') window.TwImgRetry = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
