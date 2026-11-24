/* person-name.js — 🏷️ 사람 이름을 화면 글로 바꾸는 한 곳 (검사 sim-person-name.js)
   이름의 주인은 서버 계정이다. 서버는 이름이 없는 사람을 null 로 준다(우리 화면 모양에서는 '' 로도 온다).
   이름이 없으면 그리는 순간에만 «이름 없음» — 서버 · 이 PC localStorage · 방에 보내는 값에는 «이름 없음» 을 적지 않는다.
   서버가 모르는 사람(탈퇴 · 옛 기록)은 서버가 «알 수 없음» 글자로 주므로 여기서 따로 고르지 않는다. 사용자가 저장한 «나» 는 진짜 이름이라 그대로 그린다.
   classic script(window.TwPersonName) — 쓰는 모듈 · app.js 보다 먼저 싣는다. node 에서는 require. */
(function(){
'use strict';

const NO_NAME = '이름 없음';

/** 화면에 그릴 이름 — 글이 있으면 앞뒤 공백을 trim 한 그 글, 없으면(null · undefined · 빈 글 · 공백뿐 · 글이 아닌 값) «이름 없음». */
function shown(name){
  const s = (typeof name === 'string') ? name.trim() : '';
  return s || NO_NAME;
}

const api = Object.freeze({ NO_NAME, shown });
if(typeof window !== 'undefined') window.TwPersonName = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
