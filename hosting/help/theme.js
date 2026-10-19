/* 앱이 ?theme= 에 자기 테마 이름(default · bubble)을 실어 연다 — 디자인 토큰의 classic · light 로 바꿔 건다.
   앱 테마가 둘뿐이라 밤(dark) · 기기 설정은 따르지 않는다. 모르는 값 · 없음은 앱 기본 테마(classic). */
(function(){
  var MAP = { 'default': 'classic', 'bubble': 'light' };
  var t = null;
  try{ t = new URLSearchParams(location.search).get('theme'); }catch(_){}
  document.documentElement.setAttribute('data-theme', MAP.hasOwnProperty(t) ? MAP[t] : 'classic');
})();
