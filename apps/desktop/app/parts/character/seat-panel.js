/* seat-panel.js — 🎚️ 좌석 탭 · 상태 버튼 — 좌석 탭 그리기 · 좌석 고르기 · 상태 자동/수동 · 모델 안내 글
   책임: 실행 화면 좌석 패널의 그리기 하나 — 좌석 탭 · 좌석 고르기(안내 글 · 슬라이더 값 채움) · 상태 자동/수동 버튼(만들 때 버튼 줄에 클릭을 건다).
     슬라이더 · 모델 파일 입력의 이벤트 연결은 app.js 에 둔다 — 모델 싣기 · layoutSeats 를 불러 모듈끼리 순환이 생기므로 «모듈 연결» 자리에서 잇는다.
   받는 deps: seats(값) · activity · triggerPet(함수) · selected(읽는 함수) · setSelected(쓰는 함수).
   내보내는 것: renderSeatTabs · selectSeat · setInfo · setManual · manual()(읽는 함수 — 프레임 루프가 수동 상태를 본다) · dot · stateLabel · sliders(DOM).
   app.js «UI» 구역의 앞부분을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 3줄 —
     selected 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setSelected(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 2개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: dot · manual · renderSeatTabs · selectSeat · setInfo · setManual · sliders · stateLabel — app.js 는 seatPanelMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSeatPanel — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-seat-panel.js */
(function(){

function createSeatPanel(deps){
const activity = deps.activity;
const seats = deps.seats;
const selected = deps.selected;   // 읽는 함수
const triggerPet = deps.triggerPet;
const setSelected = deps.setSelected;   // 쓰는 함수
const dot=document.getElementById('dot'),stateLabel=document.getElementById('stateLabel'),autoTag=document.getElementById('autoTag'),
      btnWrap=document.getElementById('btns'),modelInfo=document.getElementById('modelInfo'),sliders=document.getElementById('sliders'),seatsEl=document.getElementById('seats');
function setInfo(seat,html){ if(selected()===seat) modelInfo.innerHTML=html; }
function renderSeatTabs(){
  seatsEl.innerHTML='';
  const emo={focus:'⌨️',idle:'🙂',sleep:'💤',pet:'😊'};
  seats.forEach((s,i)=>{const b=document.createElement('button');b.className='seat'+(s===selected()?' sel':'')+(s.remote?' friend':'');
    const nm=s.isMe?'나':(s.friendName||('친구'+i)); const st=s.remote?(' '+(emo[s.remoteState]||'')):'';
    b.textContent=nm+st; b.onclick=()=>selectSeat(s); seatsEl.appendChild(b);});
}
function selectSeat(s){ setSelected(s); renderSeatTabs();
  modelInfo.innerHTML = s.isPlaceholder?'기본 도형 캐릭터. <b>.glb 드롭</b>으로 교체.':'모델 로드됨';
  sliders.classList.toggle('on', !s.isPlaceholder);
  document.getElementById('sScale').value=s.userScale; document.getElementById('sY').value=s.userY;
  document.getElementById('sZ').value=s.userZ; document.getElementById('sRot').value=s.userRot;
}
let manual=null;
function setManual(s){manual=s;[...btnWrap.children].forEach(b=>b.classList.toggle('active',(s===null&&b.dataset.s==='auto')||b.dataset.s===s));
  autoTag.textContent=s===null?'자동':'수동';autoTag.classList.toggle('manual',s!==null);}
btnWrap.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const s=b.dataset.s;
  if(s==='auto'){setManual(null);activity();}else{setManual(s);if(s==='pet')seats.forEach(triggerPet);}});

return {
  dot,
  manual: ()=>manual,   // 읽는 함수
  renderSeatTabs,
  selectSeat,
  setInfo,
  setManual,
  sliders,
  stateLabel,
};
}

const api = { createSeatPanel };
if(typeof window !== 'undefined') window.TwSeatPanel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
