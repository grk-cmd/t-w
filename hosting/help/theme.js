/* 앱이 ?theme= 에 자기 테마 이름(default · bubble)을 실어 연다 — 디자인 토큰의 classic · light 로 바꿔 건다.
   앱 테마가 둘뿐이라 밤(dark) · 기기 설정은 따르지 않는다. 모르는 값 · 없음은 앱 기본 테마(classic).
   ?embed=1 은 앱 마이홈 📘 도움말 탭 안 — 바탕을 비워 앱 칸 바탕(흰 칸)이 비치게 하고
   글자 · 여백을 마이홈 칸 크기로 줄인다(help.css [data-embed]). 편 사이를 옮겨 다녀도 이 둘이 이어지게 사이트 안 링크(/…)에 붙인다(도움말 전용 사이트 — 맨 위가 목차). */
(function(){
  var MAP = { 'default': 'classic', 'bubble': 'light' };
  var q = null, t = null, embed = false;
  try{ q = new URLSearchParams(location.search); t = q.get('theme'); embed = q.get('embed') === '1'; }catch(_){}
  var root = document.documentElement;
  var theme = MAP.hasOwnProperty(t) ? t : null;
  root.setAttribute('data-theme', theme ? MAP[theme] : 'classic');
  if(embed) root.setAttribute('data-embed', '');
  var carry = [];
  if(theme) carry.push('theme=' + theme);
  if(embed) carry.push('embed=1');
  if(!carry.length) return;
  root.setAttribute('data-carry', carry.join('&'));   // 나중에 만드는 링크(검색 결과 — search.js)도 같은 것을 붙이게
  document.addEventListener('DOMContentLoaded', function(){
    var links = document.querySelectorAll('a[href^="/"]');
    for(var i = 0; i < links.length; i++) links[i].setAttribute('href', links[i].getAttribute('href') + '?' + carry.join('&'));
  });
})();
