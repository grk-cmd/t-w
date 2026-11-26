/* mh-pad-pos.js — 마이홈 창 자리 기억: 스티커 여백을 뺀 «마이홈 자리» 로 기억하고, 놓을 때 지금 여백만큼 뺀다
   main.js 의 'moved'(기억)와 _applyConfigMode('myhome')(놓기)가 같이 쓴다. 순수 함수 — DOM · Electron 없음.
   [왜] 예전엔 창 좌상단(여백 포함)을 기억하고 «여백이 바뀐 만큼» 만 옮겼다. Windows 는 setBounds 뒤 'moved' 가 안 와서
     기억이 옛 여백 기준으로 남고, 같은 여백으로 다시 불리면 옛 자리로 돌아가 메뉴를 누를 때마다 마이홈이 움직였다.
     여백 없는 자리로 기억하면 'moved' 가 오든 안 오든 같은 자리에 놓인다.
   내놓는 것: rememberOf(창 좌상단, 지금 얹힌 여백) → 기억할 자리 · placeOf(기억한 자리, 놓을 여백) → 창 좌상단(없으면 null) */
(function(){
'use strict';

const _n = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };

function rememberOf(bounds, applied){
  return { x: _n(bounds && bounds.x) + _n(applied && applied.x), y: _n(bounds && bounds.y) + _n(applied && applied.y) };
}
function placeOf(remembered, pad){
  if(!remembered) return null;
  return { x: _n(remembered.x) - _n(pad && pad.x), y: _n(remembered.y) - _n(pad && pad.y) };
}

const api = { rememberOf, placeOf };
if(typeof window !== 'undefined') window.TwMhPadPos = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
