/* dice-games.js — 🎲 주사위 · 🎟️ 하루 횟수 제한(🔫 러시안룰렛 · 🎲 투게더룸 주사위)
   app.js «🎲 주사위» · «🎟️ 하루 횟수 제한 — 러시안룰렛 · 투게더룸 주사위» 두 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 39번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 사이에 있던 📷 스티커사진 입구(_purikura)와 모듈 만드는 줄은 app.js 에 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 6줄 —
     Presence · ROULETTE_FLY_DELAY_MS · officeMode 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 7개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: DAILY_PLAY_MAX · _dailyPlayTake · _diceSvg · _rollDice · _selfFlyAfterDice — app.js 는 diceMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDiceGames — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-dice-games.js */
(function(){

function createDiceGames(deps){
const Presence = deps.Presence;   // 읽는 함수
const ROULETTE_FLY_DELAY_MS = deps.ROULETTE_FLY_DELAY_MS;   // 읽는 함수
const canFly = deps.canFly;
const chatUiMod = deps.chatUiMod;
const findMySeat = deps.findMySeat;
const flySeed = deps.flySeed;
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const officeMode = deps.officeMode;   // 읽는 함수
const showChatBubble = deps.showChatBubble;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
// 점 배치 — 각 눈금(1~6)의 점 좌표(3x3 격자, 0~2). 표준 주사위 배열.
const _DICE_PIPS = {
  1: [[1,1]],
  2: [[0,0],[2,2]],
  3: [[0,0],[1,1],[2,2]],
  4: [[0,0],[2,0],[0,2],[2,2]],
  5: [[0,0],[2,0],[1,1],[0,2],[2,2]],
  6: [[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]
};
// SVG 점주사위 생성. n=1이면 점이 빨강, 그 외 검정.
function _diceSvg(n, px){
  px = px || 30;
  const pips = _DICE_PIPS[n] || _DICE_PIPS[1];
  const pad = px*0.26, gap=(px - pad*2)/2, r=px*0.11;   // pad를 키워 점이 사각 틀 안쪽으로 — 테두리 여백 확보
  const color = (n===1) ? '#d22' : '#222';
  let dots='';
  for(const [cx,cy] of pips){
    const x = pad + cx*gap, y = pad + cy*gap;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}"/>`;
  }
  return `<svg class="cm-dice" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg">`
       + `<rect x="1" y="1" width="${px-2}" height="${px-2}" rx="${px*0.15}" fill="#fff" stroke="#888" stroke-width="1.5"/>`
       + dots + `</svg>`;
}

const DAILY_PLAY_MAX = 6;
function _dailyPlayDay(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
/* kind: 'roulette' | 'dice'. 쓸 수 있으면 한 번 깎고 { ok:true, left } · 다 썼으면 { ok:false, left:0 }. */
function _dailyPlayTake(kind){
  const key = 'tw.dailyPlay.' + kind, day = _dailyPlayDay();
  let rec = null;
  try{ rec = JSON.parse(localStorage.getItem(key) || 'null'); }catch(_){ rec = null; }
  const used = (rec && rec.d === day && rec.n > 0) ? (rec.n | 0) : 0;
  if(used >= DAILY_PLAY_MAX) return { ok:false, left:0 };
  try{ localStorage.setItem(key, JSON.stringify({ d:day, n:used + 1 })); }catch(_){}
  return { ok:true, left:DAILY_PLAY_MAX - used - 1 };
}

// 주사위 굴리기 — 메시지 전송(대화창) + 말풍선
/* 🔫 [2026-09-23] 투게더룸 🎲 도 러시안룰렛이다 — 하나라도 1이면 **굴린 사람이** 날아간다(요청).
   ★ 날리기는 룰렛과 같은 한 곳(_selfFlyAfterDice → pokeSelf)으로 간다.
   ★ 🎲 는 룰렛 버튼과 달리 **굴리기 자체는 막지 않는다**(원래 놀이 도구다). 날 수 없을 때
     (회사원 모드 · 쉬는 시간 · canFly 불가)는 주사위만 나오고 조용히 안 날아간다.
   ★ 대화 기록 문장은 **원래 🎲 문장 그대로**다 — «1이 나와 날아갔어요» 꼬리는 붙이지 않는다(2026-09-23 요청). */
function _rollDice(){
  if(window._activeChannel !== 2) return;
  /* 🎟️ 하루 6번(_dailyPlayTake 주석). */
  const q = _dailyPlayTake('dice');
  if(!q.ok){ toast('🎲 주사위는 하루 ' + DAILY_PLAY_MAX + '번까지예요 — 내일 다시 굴릴 수 있어요'); return; }
  if(q.left === 0) toast('🎲 오늘 마지막 주사위였어요');
  const n1 = 1 + Math.floor(Math.random()*6);
  const n2 = 1 + Math.floor(Math.random()*6);
  const name = getDisplayName();
  const dice2 = `[dice:${n1}][dice:${n2}]`;   // 주사위 2개 나란히
  const mySeat = findMySeat();
  const willFly = (n1 === 1 || n2 === 1) && _selfFlyReady(mySeat);
  // 기록/전송 텍스트에 주사위 마커 삽입 — 렌더 시 SVG로 변환
  const logText = `${name}님이 주사위 ${dice2} 가 나왔습니다.`;
  // 1) 말풍선 — 주사위 2개만(마커). setSeatHeadBubble이 주사위 마커만으로 된 텍스트를 SVG로 렌더.
  if(mySeat) showChatBubble(mySeat, dice2);
  // 💬 🎲 은 대화창 도구라 지금 보는 탭으로 간다(말풍선 · 기록 둘 다). 날아가는 것(willFly)은 방 전체 그대로.
  const _tab = (typeof chatUiMod._chatMyTabId === 'function') ? chatUiMod._chatMyTabId() : 'general';
  if(typeof Presence()!=='undefined' && Presence().active() && Presence().sendChat) Presence().sendChat(dice2, false, '', '', _tab);
  // 2) 대화 기록 — 전체 문장
  const room=(typeof Presence()!=='undefined' && Presence().roomCode)?Presence().roomCode():null;
  if(room && window.firebaseAPI && firebaseAPI.sendChatLog){
    firebaseAPI.sendChatLog(room, { uid:getMyUserId(), name, text:logText }, _tab);
  }
  if(willFly) _selfFlyAfterDice();
}

/* 🔫 주사위로 나를 날릴 수 있는가 — 회사원 모드 · 쉬는 시간 · canFly. 토스트 없이 참/거짓만(🎲 용).
   룰렛 버튼은 같은 판정을 **토스트와 함께** 먼저 한다(_rollRoulette). */
function _selfFlyReady(seat){
  if(typeof officeMode() !== 'undefined' && officeMode()) return false;
  if(!seat) return false;
  if(tricksMod._myFlyCoolUntil() && Date.now() < tricksMod._myFlyCoolUntil()) return false;
  return canFly(seat, true).ok;   // 🗼 탑 안이어도 된다(날리기 직전에 뺀다 — canFly 주석)
}
/* 🔫 주사위 말풍선을 먼저 보여 주고 나를 날린다 — 룰렛 · 🎲 공용 한 곳.
   방이면 pokeSelf(방송이 돌아와 applyRemoteFly 로 재생) · 혼자면 applyRemoteFly 직접. */
function _selfFlyAfterDice(){
  const inRoom = (typeof Presence()!=='undefined' && Presence().active());
  const seed = flySeed();
  setTimeout(()=>{
    if(inRoom && Presence().active() && Presence().pokeSelf){ Presence().pokeSelf('fly:' + seed); return; }
    const me = findMySeat(); if(me) tricksMod.applyRemoteFly(me, String(seed));   // 혼자 — 방송이 없다
  }, ROULETTE_FLY_DELAY_MS());
}

return {
  DAILY_PLAY_MAX,
  _dailyPlayTake,
  _diceSvg,
  _rollDice,
  _selfFlyAfterDice,
};
}

const api = { createDiceGames };
if(typeof window !== 'undefined') window.TwDiceGames = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
