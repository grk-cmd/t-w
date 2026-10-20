/* chip-popups.js — 🗂️ 상태칩 팝업 «한 번에 하나» — 하나를 열 때 나머지 칩 팝업을 닫는다(창 표시 keep 은 남김)
   책임: 상태칩 줄 팝업들(상태 메뉴 · 더보기 · 채팅 · 커스텀 상태 · 알림 · 이모티콘 · 플레이리스트)의 목록 하나와 «하나만 열기» 닫기 규칙.
   받는 deps: userStatus(읽는 함수 — 커스텀 상태면 그 버튼 ● 를 다시 켠다). 내보내는 것: _closeChipPopups(exceptId, force).
   app.js «USER STATUS» 구역 끝을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     userStatus 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: _CHIP_POPUPS · _closeChipPopups — app.js 는 chipPopupsMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwChipPopups — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-chip-popups.js */
(function(){

function createChipPopups(deps){
const userStatus = deps.userStatus;   // 읽는 함수
/* 상태칩 팝업들은 한 번에 하나만 — 하나를 열 때 나머지는 모두 닫음(겹쳐서 뜨는 문제 방지).
   exceptId에 지금 열려는 팝업 id를 넘기면 그것만 건드리지 않음.
   ★ keep:true 인 것은 **'지나가는 메뉴'가 아니라 창**이다 — 다른 팝업을 연다고 닫히지 않는다.
     정말 전부 닫아야 하는 자리(오피스 모드 숨김)만 force=true 로 부른다. */
const _CHIP_POPUPS = [
  { box:'myStatusMenu',      btn:'myStatusChipBtn' },
  { box:'myChipMore',        btn:'myChipMoreBtn'   },
  { box:'myChatBox',         btn:'myChatBtn'       },
  { box:'myCustomStatusBox', btn:'myCustomStatusBtn' },   // ✨ 커스텀 상태 입력창
  { box:'bellWin',           btn:'myBellBtn'       },     // 🔔 일정 알림 창
  { box:'myDemojiBox',       btn:'myDemojiBtn'     },     // 😊 기본 이모티콘 팔레트
  /* 🎵 플레이리스트 — 음악을 틀어두고 계속 켜 두는 창이다. ▼ 더보기·상태 메뉴 같은
     **드롭메뉴를 열었다고 음악창이 닫히면** 곡을 고를 때마다 다시 열어야 한다(제보). */
  { box:'myPlaylistBox',     btn:'myPlBtn', keep:true },
];
function _closeChipPopups(exceptId, force){
  _CHIP_POPUPS.forEach(p=>{
    if(p.box === exceptId) return;
    if(p.keep && !force) return;         // 창은 다른 팝업을 여는 것만으로는 안 닫는다
    const box = document.getElementById(p.box);
    // 대부분은 .hidden 클래스로 여닫지만 🔔 창은 style.display를 씀 — 둘 다 처리
    if(box){
      box.classList.add('hidden');
      if(p.box === 'bellWin') box.style.display = 'none';
    }
    if(p.btn){ const b = document.getElementById(p.btn); if(b) b.classList.remove('on'); }
  });
  // ✨ 커스텀 상태 버튼의 'on'은 "팝업이 열림"이 아니라 "그 상태를 쓰는 중"을 뜻하므로,
  //   팝업을 닫아도 지금 custom 상태라면 눌린 표시를 유지해야 함.
  const csBtn = document.getElementById('myCustomStatusBtn');
  if(csBtn && typeof userStatus()!=='undefined' && userStatus()==='custom') csBtn.classList.add('on');
}

return {
  _CHIP_POPUPS,
  _closeChipPopups,
};
}

const api = { createChipPopups };
if(typeof window !== 'undefined') window.TwChipPopups = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
