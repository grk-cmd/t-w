/* seat-pin.js — 🪑 방에서 내 자리 «맨 오른쪽 고정» (설정 › 캐릭터 «방에서 내 자리» · 검사 sim-seat-pin.js)
   ・줄 안에 함께(row · 기본) — 예전 그대로. 책상을 끌어 나를 포함해 누구든 자리를 바꿀 수 있다.
   ・맨 오른쪽 고정(right) — 방(다른 사람이 있을 때)에서 나는 늘 줄 맨 오른쪽(seats 0번). 내 책상은 끌어도 안 옮겨지고,
     남의 책상은 0번으로 못 들어온다. 고를 때 내가 0번이 아니면 0번으로 옮긴다.
   [왜 배열을 옮기나] layoutSeats 는 seats 순서대로 0번을 맨 오른쪽에 놓고, 책상 끌기도 같은 순서로 자리를 계산한다.
     자리 계산에서만 나를 앞으로 빼면 끌기 자리와 화면 자리가 어긋난다 — 그래서 고를 때 한 번 0번으로 옮기고, 끌기가 그 자리를 지킨다.
   ⚠️ 카메라 · 크기는 건드리지 않는다(되돌린 #58 의 자동 맞춤 · 휠 · 띠는 넣지 않음). 내 화면에서만 — 서버에 안 쓴다. */
(function(){
'use strict';

const MODE_KEY = 'tw.roomSeatMode';
const ROW = 'row', RIGHT = 'right';

function loadMode(ls){ try{ return ls.getItem(MODE_KEY) === RIGHT ? RIGHT : ROW; }catch(_){ return ROW; } }
function saveMode(ls, mode){ try{ ls.setItem(MODE_KEY, mode === RIGHT ? RIGHT : ROW); }catch(_){} }
/* 지금 고정이 걸리는가 — 맨 오른쪽 고정이고 방에 다른 사람이 있을 때만(혼자 · 자리 추가만 있으면 예전 그대로) */
function pinned(mode, seats){ return mode === RIGHT && (seats || []).some(s => s && s.remote); }
/* 고를 때 · 다른 사람이 들어왔을 때 — 내가 0번이 아니면 0번으로. 옮겼으면 true(부르는 쪽이 좌석 탭을 다시 그린다). */
function pinFirst(seats, mode){
  if(!pinned(mode, seats)) return false;
  const i = seats.findIndex(s => s && s.isMe);
  if(i <= 0) return false;
  seats.unshift(seats.splice(i, 1)[0]);
  return true;
}
/* 책상 끌기로 정한 새 자리(idx)를 고정에 맞춘다 — 내 책상은 제자리, 남의 책상은 0번(내 자리) 대신 1번 */
function dragIndex(idx, seat, seats, mode){
  if(!pinned(mode, seats)) return idx;
  if(seat && seat.isMe) return seats.indexOf(seat);
  return idx === 0 ? 1 : idx;
}
const label = (mode) => mode === RIGHT ? '맨 오른쪽 고정' : '줄 안에 함께';
const next = (mode) => mode === RIGHT ? ROW : RIGHT;

const api = { MODE_KEY, ROW, RIGHT, loadMode, saveMode, pinned, pinFirst, dragIndex, label, next };
if(typeof window !== 'undefined') window.TwSeatPin = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
