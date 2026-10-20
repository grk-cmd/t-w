/* demoji-palette.js — 😊 기본 이모티콘 팔레트 · 보내기(채팅이 없는 워킹룸용)
   app.js «😊 기본 이모티콘 팔레트 · 보내기(채팅이 없는 워킹룸용)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 6줄 —
     Presence · chatUiMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDemojiPalette — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-demoji-palette.js */
(function(){

function createDemojiPalette(deps){
const Presence = deps.Presence;   // 읽는 함수
const _closeChipPopups = deps._closeChipPopups;
const chatUiMod = deps.chatUiMod;   // 읽는 함수
const findMySeat = deps.findMySeat;
const showChatBubble = deps.showChatBubble;
const statusChipMod = deps.statusChipMod;
let _demojiPaletteBuilt = false;
let _lastDemojiSentAt = 0;
function _buildDemojiPalette(){
  const box=document.getElementById('myDemojiBox');
  if(!box || _demojiPaletteBuilt || typeof chatUiMod().DEMOJI_LIST==='undefined') return;
  _demojiPaletteBuilt = true;
  chatUiMod().DEMOJI_LIST.forEach(d=>{
    const b=document.createElement('button');
    b.type='button'; b.className='dmBtn'; b.title=d.cmd;
    const img=document.createElement('img');
    img.src=chatUiMod().DEMOJI_DIR+d.file; img.alt=d.cmd; img.loading='lazy';
    b.appendChild(img);
    b.onclick=(e)=>{ e.stopPropagation(); sendMyDemoji(d.id); };
    box.appendChild(b);
  });
}
function sendMyDemoji(id){
  if(!(typeof Presence()!=='undefined' && Presence().active())) return;      // 방 안에서만
  if(typeof chatUiMod().DEMOJI_BY_ID==='undefined' || !chatUiMod().DEMOJI_BY_ID[id]) return;     // 번들에 있는 id만
  const now=Date.now();
  if(now - _lastDemojiSentAt < 1200) return;                             // 도배 방지(1.2초 쿨다운)
  _lastDemojiSentAt = now;
  const marker=`[demoji:${id}]`;
  const mySeat=findMySeat();
  if(mySeat) showChatBubble(mySeat, marker);   // 내 화면엔 즉시 표시
  if(Presence().sendChat) Presence().sendChat(marker);                       // 상대에겐 chat 필드로 전송(기존 경로 재사용)
  const box=document.getElementById('myDemojiBox'); const btn=document.getElementById('myDemojiBtn');
  if(box) box.classList.add('hidden');
  if(btn) btn.classList.remove('on');
}
(function bindMyDemojiBtn(){
  const btn=document.getElementById('myDemojiBtn'); const box=document.getElementById('myDemojiBox');
  if(!btn||!box) return;
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    const willOpen = box.classList.contains('hidden');
    if(willOpen){ _closeChipPopups('myDemojiBox'); _buildDemojiPalette(); box._cascadeFlipped = false; }   // 새로 열 땐 항상 우측부터 판정
    box.classList.toggle('hidden', !willOpen);
    btn.classList.toggle('on', willOpen);
    if(willOpen) statusChipMod._repositionOpenChipPopups();   // 첫 프레임 위치 즉시 계산(깜빡임 방지)
  });
  // 바깥 클릭 시 닫힘 — 다른 칩 팝업들과 같은 규칙
  document.addEventListener('click', e=>{
    if(!box.classList.contains('hidden') && !box.contains(e.target) && e.target!==btn){
      box.classList.add('hidden'); btn.classList.remove('on');
    }
  });
})();

return {

};
}

const api = { createDemojiPalette };
if(typeof window !== 'undefined') window.TwDemojiPalette = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
