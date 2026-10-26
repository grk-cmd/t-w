/* mh-bg-url.js — 🖼️ 마이홈 배경 그림 주소 규칙 (검사 sim-mh-bg-url.js)
   [왜] 그림 주소는 safe-html 이 https 만 받는다. 그 전 판은 http 주소 배경도 그렸고 그렇게 저장된 배경이 남아 있어서,
     http 는 https 로 바꿔 불러 본다(그림 사이트 대부분이 둘 다 준다). 페이지에 http 주소는 넣지 않는다.
   ⚠️ https 로도 못 받으면 주인에게만 알린다 — 친구 홈을 구경하는 사람에게 남의 배경 오류를 띄우지 않는다(부르는 쪽이 고른다).
   받는 것 없음(실릴 때 바로). 내보냄: window.TwMhBgUrl = { httpsOf, createBgProbe, probeOwnerBg }.
   safe-html.js 뒤 · myhome-edit.js · myhome-desktop.js · app.js 보다 먼저 싣는 classic script. */
(function(){

const HTTP_RE = /^\s*http:\/\//i;

/* http 주소면 https 로 바꾼 주소, 아니면 받은 그대로. 씻기는 부르는 쪽이 TwSafeHtml.cssUrl(httpsOf(u)) 로 safe-html 에 맡긴다 */
function httpsOf(u){
  if(typeof u !== 'string' || !HTTP_RE.test(u)) return u;
  return 'https://' + u.trim().slice(7);
}

/* https 로 바꾼 주소를 한 번 불러 보고 못 받으면 onFail — 같은 주소는 한 번만(다시 그릴 때마다 요청하지 않게).
   deps: makeImage() → Image 같은 것 · onFail(), 원래 https 거나 data: 인 주소는 보지 않는다(바꾼 것만 책임진다) */
function createBgProbe(deps){
  const seen = new Set();
  return function probe(raw){
    if(typeof raw !== 'string' || !HTTP_RE.test(raw)) return false;
    const u = TwSafeHtml.safeUrl(httpsOf(raw), 'image');
    if(!u || seen.has(u)) return false;
    seen.add(u);
    const im = deps.makeImage();
    im.onerror = ()=>deps.onFail();
    im.src = u;
    return true;
  };
}

const api = { httpsOf, createBgProbe };
if(typeof window !== 'undefined'){
  /* 진단 줄에 남의 주소를 싣지 않는다 — 원인은 고정 글 */
  api.probeOwnerBg = createBgProbe({
    makeImage: ()=>new Image(),
    onFail: ()=>TwErrorCodes.notify('E-MH-02', 'https 배경 그림 못 받음'),
  });
  window.TwMhBgUrl = Object.freeze(api);
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
