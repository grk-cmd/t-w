/* 앱 우편함 📘 도움말 칸 안(?embed=1)에서만 — 지금 보는 편과 목차(toc.json)를 앱에 알린다.
   앱은 이것으로 왼쪽 메뉴를 그리고, 페이지 안 «이전 · 다음» 으로 옮겨도 메뉴 표시가 따라간다.
   앱 화면은 file:// 이라 받는 쪽 origin 을 정할 수 없어 '*' 로 보낸다 — 실어 보내는 것은 공개된 목차 · 편 이름뿐이다. */
(function(){
  if(!document.documentElement.hasAttribute('data-embed') || window.parent === window) return;
  var m = /^\/help\/([\w-]*?)(?:\.html)?\/?$/.exec(location.pathname);
  if(!m) return;
  var page = (m[1] === '' || m[1] === 'index') ? 'index' : m[1];
  fetch('/help/toc.json').then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }).then(function(toc){
    window.parent.postMessage({ type: 'tw-help', v: 1, page: page, toc: toc }, '*');
  });
})();
