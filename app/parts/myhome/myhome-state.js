/* myhome-state.js — 🏠 마이홈 공용 상태: 내 마이홈 데이터 · 불러옴 · 불러온 계정 · 관람 중인 친구 uid · 이름 · 👁 미리보기 깃발 (검사 sim-myhome-state.js)
   마이홈 창 · 페이지 · 편집 · 스티커 · 방명록 · 스케줄러 · 플레이리스트 · 채팅 · 내 정보가 읽는 값이라 맨 아래 이 파일에 둔다.
   친구 홈 구경(myhome-visit.js)에 두면 읽는 모듈이 모두 visit 을 바라보고, visit 도 그 모듈들을 부르므로 순환이 된다(checks/sim-dep-cycles.js).
   ★ 아래 본문은 myhome-visit.js 에 있던 글 그대로다(앱 FSD 44번에서 app.js 로부터 옮긴 그 글). 바꾸는 곳은 셋 —
     페이지 불러오기(myhome-page.js) · 친구 홈 구경(myhome-visit.js) · 편집의 자동 저장(계정이 바뀌면 «불러옴» 을 무효로 — myhome-edit.js)이고, 모두 쓰는 함수(set…)를 거친다.
   ★ 밖에서 부르는 이름: _mhHomeFromServer · _mhViewingDisplayName · _mhViewingName · _mhViewingUserId · _myHomeData · _myHomeLoaded · _myHomeUid(읽는 함수) · set… — app.js 는 mhStateMod.이름 으로 부른다.
   ⚠️ 전역 이름은 TwMyHomeState — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js · 읽는 모듈보다 먼저 싣는 classic script. */
(function(){

/* 👁 방문자 시점 미리보기 깃발 — 마이홈 창(myhome-ui.js)이 켜고 끄고, 친구 홈 구경이 끈다. 관람 · 편집 · 진단이 읽는다. 처음 값은 여기 한 곳 */
window._mhPreviewMode = false;

function createMyHomeState(deps){
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수 — 친구 목록(app.js 의 let · 구독이 다시 대입한다)
let _myHomeData = { avatar:null, bio:'', postTitle:'', post:'', stickers:{}, bgm:null, bg:null, theme:null };
/* 서버에서 받은 users/{uid}/home 을 _myHomeData 모양으로 옮긴다 — 내 홈 · 친구 홈 둘 다 여기를 탄다.
   ⚠️ 저장(saveMyHome)은 _myHomeData 를 홈 노드에 **통째로 set** 한다. 여기서 빠진 칸은 화면에서만
     안 보이는 게 아니라 다음 저장 때 서버에서도 지워진다. _myHomeData 에 새 칸을 만들면 여기에도 넣을 것.
     (👑 디자인 프리셋 themePresets · themePresetCur 가 빠져 있어서, 이름을 바꿔도 다시 열면 1 2 3 으로
     돌아가고 담아 둔 색까지 사라졌다 — sim-myhome-load.js) */
function _mhHomeFromServer(data){
  data = data || {};
  return { avatar:data.avatar||null, bio:data.bio||'', postTitle:data.postTitle||'', post:data.post||'',
    theme:data.theme||null,
    stickers:data.stickers||{}, bgm:data.bgm||null, bg:data.bg||null,
    themePresets:data.themePresets||null,
    themePresetCur:(data.themePresetCur!=null ? data.themePresetCur : null) };
}
let _myHomeLoaded = false;
/* 🪪 [2026-10-08 제보 #2] 마이홈을 **어느 계정 코드로** 불러왔는가. 저장 때 지금 코드와 다르면 거부한다.
   [가설] 계정 탭에서 다른 계정으로 갈아탄 뒤 재시작 전에 자동 저장(창 닫기 · 탭 전환)이 돌면, 먼저 불러온
     **옛 계정의 마이홈(빈 데이터일 수 있다)** 이 새 계정 users/{코드}/home 에 통째로 덮어써졌다.
     _myHomeLoaded 하나로는 «불러왔다» 만 알고 «누구 것을» 은 몰랐다. */
let _myHomeUid = null;

// ★ 마이홈2-B: 친구 마이홈 관람 모드 — null이면 내 마이홈, 아니면 그 유저의 홈을 읽기전용으로 표시.
//   내 홈 데이터는 백업해뒀다가 관람 종료 시 복원(불필요한 firebase 재로드 방지).
let _mhViewingUserId = null;
/* 🏷️ 관람 중인 마이홈 주인의 이름 — 친구 목록에 없는 사람을 위한 자리.
   [경위] 타이틀·프로필 닉네임·방명록 제목 세 곳이 각자 _myHomeFriends[uid] 를 뒤졌다.
     친구 목록을 통한 방문(친구 아바타 클릭·좌석 우클릭)에서는 맞지만, 🎵 파도타기는
     '친구가 아니어도 들어갈 수 있는' 경로라(요청 사양) 조회가 늘 비어서 폴백 '친구' 가
     그대로 화면에 떴다 — "닉네임이 친구로 나온다"는 제보가 이것이다. */
let _mhViewingName = null;
/* 세 곳이 반드시 같은 값을 보게 하는 단일 창구. 우선순위:
     ① 친구 목록(실시간 구독이라 가장 최신) → ② 진입할 때 받은 이름 힌트 → ③ 서버 조회 결과
   폴백 '친구' 는 셋 다 실패했을 때만 남는다. */
function _mhViewingDisplayName(){
  if(!_mhViewingUserId) return '';
  const f = _myHomeFriends()[_mhViewingUserId];
  if(f && f.name) return f.name;
  if(_mhViewingName) return _mhViewingName;
  return '친구';
}

return {
  _mhHomeFromServer,
  _mhViewingDisplayName,
  _mhViewingName: ()=>_mhViewingName,   // 읽는 함수
  setMhViewingName: (v)=>{ _mhViewingName = v; },   // 쓰는 함수 — 친구 홈 구경이 바꾼다
  _mhViewingUserId: ()=>_mhViewingUserId,   // 읽는 함수
  setMhViewingUserId: (v)=>{ _mhViewingUserId = v; },   // 쓰는 함수 — 친구 홈 구경이 바꾼다
  _myHomeData: ()=>_myHomeData,   // 읽는 함수
  setMyHomeData: (v)=>{ _myHomeData = v; },   // 쓰는 함수 — 불러오기 · 친구 홈 구경
  _myHomeLoaded: ()=>_myHomeLoaded,   // 읽는 함수
  setMyHomeLoaded: (v)=>{ _myHomeLoaded = v; },   // 쓰는 함수
  _myHomeUid: ()=>_myHomeUid,   // 읽는 함수
  setMyHomeUid: (v)=>{ _myHomeUid = v; },   // 쓰는 함수
};
}

const api = { createMyHomeState };
if(typeof window !== 'undefined') window.TwMyHomeState = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
