/* myhome-diag.js — 🔍 마이홈 클릭 진단(__mhClickDiag — 콘솔 도구)
   app.js «🔍 마이홈 클릭 진단(__mhClickDiag — 콘솔 도구)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 44번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     _mhViewingUserId 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeDiag — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-diag.js */
(function(){

function createMyHomeDiag(deps){
const _mhViewingUserId = deps._mhViewingUserId;   // 읽는 함수
window.__mhClickDiag = function(){
  /* 🪟 **여기가 이번 사안의 핵심 값이다.** 버튼 좌표가 음수로 나오면 "무엇이 덮었나"가 아니라
     "창이 화면보다 크거나 엉뚱한 자리에 있나"를 봐야 한다. #myHomeWin 은 폭이 760px 로 고정이라
     뷰포트가 그보다 좁으면 왼쪽 열이 그대로 화면 밖으로 밀린다.
     · 화면      : 지금 렌더러 뷰포트(=OS 창 안쪽). 런처 380 · 마이홈 800 · 생성기 740 이 정상값이다.
     · 창확대    : Ctrl+휠/Ctrl+＋ 로 확대해 두면 뷰포트가 그만큼 좁아진다(380 → 1.28배면 297).
                   화면 폭이 어느 정상값도 아니면 여기를 먼저 의심할 것.
     · 마이홈창  : 실제 사각형과 **인라인 위치**. 드래그로 옮긴 자리가 남아 있으면 여기 값이 찍힌다.
                   open() 은 열 때마다 이걸 비우지만 openFriendHomeView 는 안 비운다.
     · 런처열림  : 창 크기 모드를 정하는 값(applyDesktopRunClass). false 인데 화면이 좁으면 모순이다. */
  const win = document.getElementById('myHomeWin');
  const wr = win ? win.getBoundingClientRect() : null;
  const 창정보 = {
    진단버전: 2,   // ★ 이 값이 1이면 옛 app.js 로 잰 것이다 — 결과를 믿지 말 것
    화면: innerWidth + '×' + innerHeight,
    창확대: (typeof devicePixelRatio === 'number' ? devicePixelRatio : '?'),
    런처열림: !!(document.getElementById('launcher') || {}).classList
              && document.getElementById('launcher').classList.contains('on'),
    마이홈창: wr ? (Math.round(wr.left) + ',' + Math.round(wr.top) + ' / ' +
                    Math.round(wr.width) + '×' + Math.round(wr.height)) : null,
    인라인위치: win ? ((win.style.left || '(없음)') + ' / ' + (win.style.top || '(없음)') +
                       ' / transform:' + (win.style.transform || '(없음)')) : null,
  };
  const TARGETS = [
    ['mhNameEditLink',    '닉네임 수정'],
    ['mhGuestbookBtn',    '방명록 남기기'],
    ['mhAvatarBig',       '프로필 사진'],
    ['mhStickerAddBtn',   '+ 스티커'],
    ['mhPostTitleEditBtn','게시글 제목 수정'],
    ['mhEditHomeBtn',     '마이홈 수정'],
    ['myHomeClose',       '창 닫기 ✕'],
  ];
  /* 요소를 사람이 알아볼 이름으로 — id 가 없으면 클래스로. 범인이 익명 div 여도 최소한
     어느 뭉치인지는 읽힌다. */
  const name = el => {
    if(!el) return null;
    if(el === document.body) return 'body';
    const id = el.id ? '#' + el.id : '';
    const cl = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    return (id + cl) || (el.tagName || '?').toLowerCase();
  };
  const out = {
    창: 창정보,
    마이홈열림: !!(document.getElementById('myHomeOverlay') || {}).classList
                 && document.getElementById('myHomeOverlay').classList.contains('on'),
    관람중: (typeof _mhViewingUserId() !== 'undefined' && _mhViewingUserId()) || null,
    미리보기: !!window._mhPreviewMode,
    항목: {},
  };
  TARGETS.forEach(([id, label])=>{
    const el = document.getElementById(id);
    if(!el){ out.항목[label] = { 있음:false }; return; }
    const r = el.getBoundingClientRect();
    const 보임 = r.width > 0 && r.height > 0;
    const row = { 있음:true, 보임, 좌표: 보임 ? (Math.round(r.left)+','+Math.round(r.top)) : null };
    if(보임){
      const top = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      /* 자기 자신이거나 자기 자손이면 정상이다 — 글자 노드를 감싼 span 이 잡히는 일이 흔하다. */
      const ok = !!(top && (top === el || el.contains(top)));
      row.가려짐 = !ok;
      if(!ok) row.가린것 = name(top);
    }
    out.항목[label] = row;
  });
  return out;
};

return {

};
}

const api = { createMyHomeDiag };
if(typeof window !== 'undefined') window.TwMyHomeDiag = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
