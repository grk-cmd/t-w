/* myhome-state.js — 🏠 마이홈 공용 상태 읽는 창구: 지금 그리는 마이홈 페이지 · 불러옴 · 관람 중인 친구 코드 · 이름 · 👁 미리보기 깃발 (검사 sim-myhome-state.js)
   마이홈 창 · 페이지 · 편집 · 스티커 · 방명록 · 스케줄러 · 플레이리스트 · 채팅 · 내 정보가 읽는 값이라 맨 아래 이 파일에 둔다.
   친구 홈 구경(myhome-visit.js)에 두면 읽는 모듈이 모두 visit 을 바라보고, visit 도 그 모듈들을 부르므로 순환이 된다(checks/sim-dep-cycles.js).
   ★ 값의 주인은 myhome-store.js 다 — 여기는 읽는 함수만 내놓는다(예전 이름 그대로라 읽는 모듈을 한 번에 다 고치지 않는다). 쓰는 함수는 없다 — 바꾸려면 store 의 동작 함수.
     _myHomeData() 는 얼려 둔 값이다(관람 중이면 그 집 것 · 받기 전엔 빈 페이지).
   ★ 밖에서 부르는 이름: _mhViewingDisplayName · _mhViewingName · _mhViewingUserId · _myHomeData · _myHomeLoaded — app.js 는 mhStateMod.이름 으로 부른다.
   ⚠️ 전역 이름은 TwMyHomeState — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js · 읽는 모듈보다 먼저 싣는 classic script. */
(function(){

/* 👁 방문자 시점 미리보기 깃발 — 마이홈 창(myhome-ui.js)이 켜고 끄고, 친구 홈 구경이 끈다. 관람 · 편집 · 진단이 읽는다. 처음 값은 여기 한 곳 */
window._mhPreviewMode = false;

/** @param {{ _myHomeFriends: () => Record<string, any>, myhomeStore: { page: Function, mine: Function, viewing: Function, viewName: Function } }} deps */
function createMyHomeState(deps){
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수 — 친구 목록(app.js 의 let · 구독이 다시 대입한다)
const myhomeStore = deps.myhomeStore;                     // 🏠 상태 주인(myhome-store.js)

/* 🏷️ 관람 중인 마이홈 주인의 이름 — 친구 목록에 없는 사람을 위한 자리(이름 힌트).
   세 곳(타이틀 · 프로필 닉네임 · 방명록 제목)이 반드시 같은 값을 보게 하는 단일 창구. 우선순위:
     ① 친구 목록(실시간 구독이라 가장 최신) → ② 진입할 때 받은 이름 힌트(myhomeStore.viewName)
   폴백 '친구' 는 둘 다 없을 때만 남는다. */
function _mhViewingDisplayName(){
  const uid = myhomeStore.viewing();
  if(!uid) return '';
  const f = _myHomeFriends()[uid];
  if(f && f.name) return f.name;
  const hint = myhomeStore.viewName();
  if(hint) return hint;
  return '친구';
}

return {
  _mhViewingDisplayName,
  _mhViewingName: ()=>myhomeStore.viewName(),   // 읽는 함수
  _mhViewingUserId: ()=>myhomeStore.viewing(),   // 읽는 함수
  _myHomeData: ()=>myhomeStore.page(),   // 읽는 함수 — 얼린 값
  _myHomeLoaded: ()=>myhomeStore.mine().load === myhomeStore.LOAD.READY,   // 읽는 함수 — 내 홈을 받았나
};
}

const api = { createMyHomeState };
if(typeof window !== 'undefined') window.TwMyHomeState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
