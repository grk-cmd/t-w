/* 도움말 테마 — 주소 ?theme=light|dark|classic 을 따르고, 없으면 기기의 밝음 · 어두움을 따른다.
   앱 📘 도움말 칸이 앱 테마를 주소에 실어 연다. */
(function(){
  var t = null;
  try{ t = new URLSearchParams(location.search).get('theme'); }catch(_){}
  if(t !== 'light' && t !== 'dark' && t !== 'classic'){
    t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
