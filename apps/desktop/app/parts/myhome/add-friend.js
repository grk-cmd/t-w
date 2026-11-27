/* add-friend.js — 👥 책상에서 친구 추가(친구 고르기 창 · 얼굴 섬네일)
   app.js «👥 책상에서 친구 추가(친구 고르기 창 · 얼굴 섬네일)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 8개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: drawFaceThumb — app.js 는 addFriendMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAddFriend — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-add-friend.js */
(function(){

function createAddFriend(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const applyCharToSeat = deps.applyCharToSeat;
const createSeat = deps.createSeat;
const layoutSeats = deps.layoutSeats;
const openCreator = deps.openCreator;
const renderSeatTabs = deps.renderSeatTabs;
const selectSeat = deps.selectSeat;
const skinColorFor = deps.skinColorFor;
const slots = deps.slots;
const toast = deps.toast;
/* --- 책상에서 친구 추가: 저장 캐릭터 선택 or 새로 만들기 --- */
function drawFaceThumb(cv,def){const x=cv.getContext('2d');
  x.fillStyle=skinColorFor(def.skin);x.beginPath();x.arc(40,40,33,0,7);x.fill();
  x.fillStyle=def.bot;x.fillRect(16,70,48,12);x.fillStyle=def.top;x.fillRect(16,64,48,12);
  try{x.drawImage(def.face,9,9,62,62);}catch(e){}}
function openAddFriend(){
  const saved=slots.map((d,i)=>({d,i})).filter(o=>o.d);
  if(!saved.length){openCreator({kind:'slot',edit:false,afterApp:true});return;}
  const grid=document.getElementById('fpGrid');grid.innerHTML='';
  saved.forEach(({d,i})=>{const it=document.createElement('div');it.className='fp-item';
    const cv=document.createElement('canvas');cv.width=cv.height=80;drawFaceThumb(cv,d);it.appendChild(cv);
    const sp=document.createElement('span');sp.textContent='슬롯 '+(i+1);it.appendChild(sp);
    it.onclick=()=>{document.getElementById('friendPicker').classList.remove('on');
      const seat=createSeat();applyCharToSeat(seat,d);seat.slot=i;selectSeat(seat);renderSeatTabs();layoutSeats();toast('책상에 추가했어요');};
    grid.appendChild(it);});
  /* ⚠️ 여기 상한에 3 이 박혀 있었다(5칸 확장 잔재) — 4·5번 칸에서 [＋ 새로 만들기]가 안 떴다.
     ⚠️ 이 줄에 // 주석을 붙이지 말 것. 한 줄에 여러 문장이 붙어 있어서 뒤의 innerHTML 이
        통째로 주석에 먹힌다(실제로 한 번 먹혀서 빈 네모만 떴다). 설명은 이렇게 위에 적는다. */
  if(saved.length<CHAR_SLOT_MAX){const nw=document.createElement('div');nw.className='fp-item new';nw.innerHTML='＋<span>새로 만들기</span>';
    nw.onclick=()=>{document.getElementById('friendPicker').classList.remove('on');openCreator({kind:'slot',edit:false,afterApp:true});};
    grid.appendChild(nw);}
  document.getElementById('friendPicker').classList.add('on');}
document.getElementById('fpCancel').onclick=()=>document.getElementById('friendPicker').classList.remove('on');

return {
  drawFaceThumb,
};
}

const api = { createAddFriend };
if(typeof window !== 'undefined') window.TwAddFriend = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
