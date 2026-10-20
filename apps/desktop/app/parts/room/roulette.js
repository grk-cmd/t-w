/* roulette.js — 🔫 러시안룰렛
   app.js «🔫 러시안룰렛» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 46번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 3줄 —
     Presence · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: ROULETTE_FLY_DELAY_MS · _rollRoulette — app.js 는 rouletteMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRoulette — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-roulette.js */
(function(){

function createRoulette(deps){
const Presence = deps.Presence;   // 읽는 함수
const canFly = deps.canFly;
const diceMod = deps.diceMod;
const findMySeat = deps.findMySeat;
const getDisplayName = deps.getDisplayName;
const officeMode = deps.officeMode;   // 읽는 함수
const showChatBubble = deps.showChatBubble;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const ROULETTE_COOL_MS = 3000;          // 연타 방지 — 말풍선·기록 도배만 막는다
const ROULETTE_FLY_DELAY_MS = 700;      // 주사위 말풍선을 먼저 보여 주고 날린다
let _rouletteAt = 0;
function _rollRoulette(){
  if(typeof officeMode() !== 'undefined' && officeMode()){ toast('🏢 회사원 모드에서는 쓸 수 없어요'); return; }
  const mySeat = findMySeat();
  if(!mySeat){ toast('캐릭터가 없어요'); return; }
  const now = Date.now();
  if(now - _rouletteAt < ROULETTE_COOL_MS){ toast('⏳ 룰렛은 ' + (ROULETTE_COOL_MS/1000) + '초에 한 번!'); return; }
  /* 쉬는 시간(remoteFlyCool 의 내 쪽 값)·지금 못 나는 상태면 굴리지도 않는다 —
     1이 나왔는데 안 날아가면 «고장» 으로 읽힌다. */
  if(tricksMod._myFlyCoolUntil() && now < tricksMod._myFlyCoolUntil()){
    toast('어지러워서 쉬는 중이에요 (' + Math.ceil((tricksMod._myFlyCoolUntil() - now)/1000) + '초)');
    return;
  }
  const c = canFly(mySeat, true);   // 🗼 탑 안이어도 굴린다 — 1 이면 탑에서 튕겨 나간다(A안)
  if(!c.ok){ toast(c.why); return; }
  /* 🎟️ 하루 6번 — 위 게이트를 다 지난 뒤에만 센다(막힌 누름은 안 깎는다 · _dailyPlayTake 주석). */
  if(typeof diceMod._dailyPlayTake === 'function'){
    const q = diceMod._dailyPlayTake('roulette');
    if(!q.ok){ toast('🔫 룰렛은 하루 ' + diceMod.DAILY_PLAY_MAX + '번까지예요 — 내일 다시 돌릴 수 있어요'); return; }
    if(q.left === 0) toast('🔫 오늘 마지막 룰렛이었어요');
  }
  _rouletteAt = now;
  const n1 = 1 + Math.floor(Math.random()*6);
  const n2 = 1 + Math.floor(Math.random()*6);
  const hit = (n1 === 1 || n2 === 1);
  const dice2 = `[dice:${n1}][dice:${n2}]`;
  const inRoom = (typeof Presence()!=='undefined' && Presence().active());
  showChatBubble(mySeat, dice2);
  if(inRoom && Presence().sendChat) Presence().sendChat(dice2);
  const name = getDisplayName();
  if(window._activeChannel === 2){
    tricksMod._flyChatLog(name + '님이 룰렛을 돌려 ' + dice2 + ' 가 나왔습니다.');   // 결과 꼬리 없음(🎲 와 같은 문장 모양 · 2026-09-23 요청)
  }
  if(!hit) return;
  diceMod._selfFlyAfterDice();
}

return {
  ROULETTE_FLY_DELAY_MS,
  _rollRoulette,
};
}

const api = { createRoulette };
if(typeof window !== 'undefined') window.TwRoulette = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
