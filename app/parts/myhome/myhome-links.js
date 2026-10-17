/* myhome-links.js — 🔗 마이홈 본문 링크 — 시스템 기본 브라우저로 열기
   app.js «🔗 마이홈 본문 링크 — 시스템 기본 브라우저로 열기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 47번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeLinks — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-links.js */
(function(){

function createMyHomeLinks(deps){

/* 🔗 마이홈 본문(자기소개·게시글) 안의 링크 — 시스템 기본 브라우저로 연다.
   [증상] 마이홈 글에 링크를 걸고 누르면 그 페이지가 **앱 창 안에서** 열린다.
   [원인] 마이홈 본문은 contenteditable 리치텍스트라 <a href>가 그대로 들어간다. 내 홈에서 편집 중일
          때는 캐럿만 놓이지만, 친구 홈을 관람할 때는 contenteditable이 꺼져 있어 진짜 내비게이션이 된다.
          이 앱은 단일 페이지 오버레이라 그 순간 캐릭터·씬·상태가 통째로 날아가고 되돌릴 방법이 없다
          (방명록·광고 배너·후원 링크에서 이미 겪은 것과 같은 사고).
   [대응] 캡처 단계에서 가로채 openBrowser(shell.openExternal)로 넘긴다.
   ★ 편집 중에는 열지 않는다 — 글을 고치다 링크를 클릭한 것뿐인데 브라우저가 뜨면 방해가 된다.
     캐럿을 놓는 기본 동작만 남기고, 정말 열고 싶으면 Ctrl(⌘)+클릭.
   ★ http/https가 아닌 주소(#, file:, javascript: 등)는 어떤 경우에도 열지 않고 기본 동작만 막는다.
   ⚠️ 여기를 빠져나가는 링크가 있어도 main.js의 will-navigate가 마지막으로 한 번 더 막는다. */
(function bindMyHomeExternalLinks(){
  const editableAround = el => {
    const b = el.closest && el.closest('[contenteditable]');
    return !!(b && b.getAttribute('contenteditable') !== 'false');
  };
  document.addEventListener('click', e=>{
    if(!e.target || !e.target.closest) return;
    if(!e.target.closest('#myHomeOverlay')) return;
    const a = e.target.closest('a[href]'); if(!a) return;
    const href = a.getAttribute('href') || '';
    if(!/^https?:\/\//i.test(href)){ e.preventDefault(); return; }
    if(editableAround(a) && !(e.ctrlKey || e.metaKey)) return;   // 편집 중 — 캐럿만 놓는다
    e.preventDefault(); e.stopPropagation();
    if(window.companion && companion.openBrowser) companion.openBrowser(href);
    else { try{ window.open(href, '_blank', 'noopener'); }catch(_){} }
  }, true);
})();

return {

};
}

const api = { createMyHomeLinks };
if(typeof window !== 'undefined') window.TwMyHomeLinks = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
