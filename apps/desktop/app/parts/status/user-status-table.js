/* user-status-table.js — 🍚 상태 표 · 커스텀 상태 저장값 — 밥 · 자리비움 · 집중(grind) · 게임 · 커스텀의 이모지 · 이름 · 점 색 · 동작 깃발과 tw.customStatus
   책임: «활동 상태» 의 값 표 하나와 커스텀 상태 문구 저장값(불러오기 · 자르기) — DOM · 방 통신 없음(아래층).
     내 상태 값(userStatus) · 풀이(statusConfFor) · 칩 반영 · 커스텀 저장(saveCustomStatusConf — 방에 알림 · 메뉴 갱신)은 app.js 에 남는다 — 옮기면 상태칩 · 포커스 공유 모듈과 순환이 생기고 window.setUserStatus 전역을 쓰는 곳이 있다.
   받는 deps: 없음. 내보내는 것: USER_STATUSES · CUSTOM_STATUS_KEY · CUSTOM_STATUS_MAXLEN · customStatusConf()/setCustomStatusConf(v)(읽는 · 쓰는 함수) · loadCustomStatusFromStorage.
   app.js «USER STATUS» 구역의 표 · 저장값 몫을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도 · 덩이 2개를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: CUSTOM_STATUS_KEY · CUSTOM_STATUS_MAXLEN · USER_STATUSES · customStatusConf · loadCustomStatusFromStorage — app.js 는 userStatusTableMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwUserStatusTable — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-user-status-table.js */
(function(){

function createUserStatusTable(deps){

const USER_STATUSES = {
  meal:   {emo:'🍚',   label:'밥 먹는 중', idleTweak:true, dot:'#e89b7d'},
  away:   {emo:'🫧',   label:'자리비움',   forceSleep:true, opacity:0.0,  dot:'#9aa0a8'},
  grind:  {emo:'🔥',   label:'집중',       idleTweak:true,                 dot:'#e07a55'},
  gaming: {emo:'🎮',   label:'게임 중',    dot:'#8a8ec9'},
  // ✨ 커스텀 상태 (프리미엄) — emo/label은 유저가 등록한 값으로 렌더 시점에 덮어씀(statusConfFor 참고).
  //   여기 값은 아직 등록 전이거나 친구의 커스텀 문구를 못 받았을 때의 폴백.
  custom: {emo:'✨',   label:'커스텀 상태', dot:'#c9a36a'},
};

/* ✨ 커스텀 상태 (프리미엄) — 확성기(📢 말풍선 고정)를 대체.
   유저가 이모지 1개 + 문구(최대 12자)를 등록해두면 상태 메뉴에서 다른 상태처럼 골라 쓸 수 있음.
   저장: localStorage 'tw.customStatus' = {emo, text}. 친구에겐 Presence로 전파(remoteCustomStatus). */
const CUSTOM_STATUS_KEY = 'tw.customStatus';
const CUSTOM_STATUS_MAXLEN = 12;
let customStatusConf = { emo:'', text:'' };
function loadCustomStatusFromStorage(){
  try{
    const raw = localStorage.getItem(CUSTOM_STATUS_KEY);
    if(!raw) return;
    const v = JSON.parse(raw);
    if(v && typeof v === 'object'){
      customStatusConf = {
        emo:  (typeof v.emo === 'string') ? v.emo.slice(0,2) : '',
        text: (typeof v.text === 'string') ? v.text.slice(0, CUSTOM_STATUS_MAXLEN) : '',
      };
    }
  }catch(e){}
}

return {
  CUSTOM_STATUS_KEY,
  CUSTOM_STATUS_MAXLEN,
  USER_STATUSES,
  customStatusConf: ()=>customStatusConf,   // 읽는 함수
  setCustomStatusConf: (v)=>{ customStatusConf = v; },   // 쓰는 함수 — app.js 가 비운다
  loadCustomStatusFromStorage,
};
}

const api = { createUserStatusTable };
if(typeof window !== 'undefined') window.TwUserStatusTable = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
