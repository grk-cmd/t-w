/* seat-friend-req.js — 🙋 좌석 우클릭 친구 신청: 친구가 아닌 상대를 두 번 우클릭하면 친구 요청을 보낸다
   app.js «👻 … · DRAG / PET» 안의 친구 신청 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다.
   ・책임: 첫 번째 우클릭은 안내만(5초 안에 한 번 더 누르면 보냄) · 두 번째에 앞단 검사(준비 · 나 · 이미 친구 · 정원) 뒤 firebaseAPI.sendFriendRequest.
   ・받는 deps 5 — 함수 3(getDisplayName · getMyUserId · toast) · 값 FRIEND_MAX · 읽는 함수 _myHomeFriends(친구 구독이 다시 대입).
   ・내놓는 것: _friendReqAsk(uid, seat) — 좌석 우클릭 메뉴(room/seat-menu.js)가 app.js 를 거쳐 부른다.
   ⚠️ firebaseAPI · setTimeout 은 전역 이름 그대로. 전역 이름은 TwSeatFriendReq(Tw 접두사 #103).
   검사: checks/sim-seat-friend-req.js */
(function(){

function createSeatFriendReq(deps){
const FRIEND_MAX = deps.FRIEND_MAX;
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const toast = deps.toast;
/* 🙋 친구가 아닌 상대 우클릭 → 친구 신청 — 확인창 대신 **2단계 확인**(한 번 더 우클릭하면 보낸다).
   [왜] 실행 화면은 투명 전체화면 오버레이라 native 확인 다이얼로그를 못 쓰고, 새 fixed 오버레이는 audit 검사 여럿에 항목이 는다.
   ⚠️ 부르는 쪽(app.js contextmenu)의 회사원 모드 차단보다 뒤에서 불려야 한다 — 그 모드는 토스트도 없어야 한다. */
let _friendReqArmed = null, _friendReqTimer = null;
const FRIEND_REQ_ARM_MS = 5000;   // 이 시간 안에 한 번 더 우클릭하면 전송
function _friendReqAsk(uid, seat){
  const name = (seat && seat.friendName) || '이 사람';
  if(_friendReqArmed !== uid){
    _friendReqArmed = uid;
    clearTimeout(_friendReqTimer);
    _friendReqTimer = setTimeout(()=>{ _friendReqArmed = null; }, FRIEND_REQ_ARM_MS);
    toast(name + '님은 아직 친구가 아니에요 — 한 번 더 우클릭하면 친구 신청을 보내요');
    return;
  }
  clearTimeout(_friendReqTimer); _friendReqArmed = null;
  _friendReqSend(uid, name);
}
async function _friendReqSend(uid, name){
  /* 앞단 검사는 마이홈의 [친구 추가] 와 같은 순서·같은 문구로 맞춘다 — 두 입구가 다른 말을 하지 않게. */
  if(!window.firebaseAPI || !firebaseAPI.sendFriendRequest){ toast('아직 준비 중이에요'); return; }
  try{
    if(uid === getMyUserId()){ toast('내 코드는 추가할 수 없어요'); return; }
    if(_myHomeFriends() && _myHomeFriends()[uid]){ toast('이미 친구예요'); return; }
    if(_myHomeFriends() && Object.keys(_myHomeFriends()).length >= FRIEND_MAX){ toast('친구는 최대 '+FRIEND_MAX+'명까지만 추가할 수 있어요'); return; }
    // 📤 여기는 좌석에서 상대 이름을 알고 있으므로 이름을 이름표로 넘긴다
    const res = await firebaseAPI.sendFriendRequest(getMyUserId(), uid, getDisplayName(), name, null);
    if(res && res.ok) toast(name + '님에게 친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요');
    else if(res && res.reason === 'already') toast('이미 친구예요');
    else if(res && res.reason === 'self') toast('내 코드는 추가할 수 없어요');
    else toast('요청에 실패했어요');
  }catch(e){ toast('요청 중 오류가 발생했어요'); }
}

return {
  _friendReqAsk,
};
}

const api = { createSeatFriendReq };
if(typeof window !== 'undefined') window.TwSeatFriendReq = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
