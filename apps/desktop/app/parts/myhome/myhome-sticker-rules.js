/* myhome-sticker-rules.js — 🎨 마이홈 스티커 잠금 · 그리는 순서 규칙(순수 함수 · DOM · firebase 없음)
   ・잠금(locked): 잠긴 스티커는 끌기 · 편집 모드(이동 · 크기 · 회전) · ◎ 데려오기로 움직이지 않는다. 지우기 · 링크 · 움직임은 된다.
   ・순서(z): 작은 수부터 그린다 — 큰 수가 앞. z 가 없는 옛 스티커는 키 순서(만든 차례) 그대로 뒤쪽에 깔린 것으로 본다.
     ⚠️ 키 순서에 기대지 않으려고 z 를 둔다 — 서버(Firebase)는 키를 사전순으로 돌려줘서 키 이름으로 순서를 바꿀 수 없다.
     ⚠️ 옛 앱은 z · locked 를 모른다 — 옛 앱으로 보면 만든 차례로 그려지고 잠금도 없다(데이터는 그대로 남는다).
   내놓음: isLocked · setLocked · orderedIds · nextZ · move
   검사: checks/sim-myhome-sticker-rules.js */
(function(){
'use strict';

function isLocked(s){ return !!(s && s.locked); }
/* 잠그면 true 를, 풀면 칸을 지운다 — 옛 데이터와 같은 모양으로 돌아가게 */
function setLocked(s, on){
  if(!s) return;
  if(on) s.locked = true; else delete s.locked;
}

/* 그리는 순서(뒤 → 앞). z 가 없으면 키 순서 자리를 z 로 친다 — 옛 스티커는 새로 z 를 받은 것보다 늘 뒤다(아래 nextZ). */
function orderedIds(stickers){
  const ids = Object.keys(stickers || {});
  const zOf = (id, i) => {
    const z = stickers[id] && stickers[id].z;
    return (typeof z === 'number' && isFinite(z)) ? z : i - ids.length;
  };
  return ids.map((id, i) => ({ id, i, z: zOf(id, i) }))
    .sort((a, b) => (a.z - b.z) || (a.i - b.i))
    .map(o => o.id);
}

/* 새로 붙이는 스티커의 z — 지금 맨 앞보다 하나 앞 */
function nextZ(stickers){
  let max = -1;
  Object.keys(stickers || {}).forEach(id => {
    const z = stickers[id] && stickers[id].z;
    if(typeof z === 'number' && isFinite(z) && z > max) max = z;
  });
  return max + 1;
}

/* 한 칸 앞(dir=+1 · ▲) 또는 뒤(dir=-1 · ▼)로. 옮겼으면 true.
   옮길 때 모두에게 0,1,2… 를 다시 매긴다 — 옛 스티커(z 없음)도 이때 자리를 받는다. */
function move(stickers, sid, dir){
  if(!stickers || !stickers[sid] || (dir !== 1 && dir !== -1)) return false;
  const order = orderedIds(stickers);
  const i = order.indexOf(sid), j = i + dir;
  if(j < 0 || j >= order.length) return false;
  order[i] = order[j]; order[j] = sid;
  order.forEach((id, k) => { stickers[id].z = k; });
  return true;
}

const api = { isLocked, setLocked, orderedIds, nextZ, move };
if(typeof window !== 'undefined') window.TwMyHomeStickerRules = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
