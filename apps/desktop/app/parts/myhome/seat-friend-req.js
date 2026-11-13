/* seat-friend-req.js — 🙋 좌석 우클릭 친구 신청: 친구가 아닌 상대를 두 번 우클릭하면 친구 요청을 보낸다
   app.js «👻 … · DRAG / PET» 안의 친구 신청 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다.
   ・책임: 첫 번째 우클릭은 안내만(5초 안에 한 번 더 누르면 보냄) · 두 번째에 앞단 검사(준비 · 나 · 이미 친구 · 정원) 뒤 friendNet().sendFriendRequest.
   ・받는 deps 6 — 함수 3(getDisplayName · getMyUserId · toast) · 값 FRIEND_MAX · 읽는 함수 2: _myHomeFriends(친구 구독이 다시 대입) ·
     friendNet(데이터 provider — 지금은 app.js 가 window.firebaseAPI 를 넘긴다. 서버 이관 때 app.js 의 그 한 줄만 갈아 끼운다).
   ・내놓는 것: _friendReqAsk(uid, seat) — 좌석 우클릭 메뉴(room/seat-menu.js)가 app.js 를 거쳐 부른다 ·
     sendFriendReq(uid, name, msg) — 보내기 한 벌(앞단 검사 포함 · 결과만 돌려준다) · resultView(res, name) — 결과 → 안내 문구 한 벌.
     남의 마이홈 [친구 신청](friend-req-btn.js)도 이 둘을 부른다(app.js 가 deps 로 잇는다).
   ⚠️ firebaseAPI 를 직접 부르지 않는다(friendNet 으로만). setTimeout 은 전역 이름 그대로. 전역 이름은 TwSeatFriendReq(Tw 접두사 #103).
   검사: checks/sim-seat-friend-req.js */
(function(){

function createSeatFriendReq(deps){
const FRIEND_MAX = deps.FRIEND_MAX;
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const friendNet = deps.friendNet;   // 읽는 함수 — 데이터 provider(sendFriendRequest), 준비 전이면 없음
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const toast = deps.toast;
/* 🙋 친구가 아닌 상대 우클릭 → 친구 신청 — 확인창 대신 **2단계 확인**(5초 안에 메뉴에서 한 번 더 고르면 보낸다).
   [왜] 실행 화면은 투명 전체화면 오버레이라 native 확인 다이얼로그를 못 쓰고, 새 fixed 오버레이는 audit 검사 여럿에 항목이 는다.
   ⚠️ 부르는 쪽(app.js contextmenu)의 회사원 모드 차단보다 뒤에서 불려야 한다 — 그 모드는 토스트도 없어야 한다. */
let _friendReqArmed = null, _friendReqTimer = null;
const FRIEND_REQ_ARM_MS = 5000;   // 이 시간 안에 메뉴에서 한 번 더 고르면 전송
function _friendReqAsk(uid, seat){
  const name = (seat && seat.friendName) || '이 사람';
  if(_friendReqArmed !== uid){
    _friendReqArmed = uid;
    clearTimeout(_friendReqTimer);
    _friendReqTimer = setTimeout(()=>{ _friendReqArmed = null; }, FRIEND_REQ_ARM_MS);
    toast(name + '님은 아직 친구가 아니에요 — ' + (FRIEND_REQ_ARM_MS/1000) + '초 안에 우클릭 › «👤 친구 신청»을 한 번 더 누르면 보내요');
    return;
  }
  clearTimeout(_friendReqTimer); _friendReqArmed = null;
  _friendReqSend(uid, name);
}
/* 보내기 한 벌 — 좌석 두 번 우클릭과 남의 마이홈 [친구 신청](friend-req-btn.js)이 같이 부른다. 앞단 검사 순서 · 판단은 여기 하나.
   msg = 신청 사유(없으면 빈 칸). → { ok } | { ok:false, reason: not_ready · self · already · full · save_failed · error } */
async function sendFriendReq(uid, name, msg){
  const net = friendNet();
  if(!net || !net.sendFriendRequest) return { ok:false, reason:'not_ready' };
  if(uid === getMyUserId()) return { ok:false, reason:'self' };
  if(_myHomeFriends() && _myHomeFriends()[uid]) return { ok:false, reason:'already' };
  if(_myHomeFriends() && Object.keys(_myHomeFriends()).length >= FRIEND_MAX) return { ok:false, reason:'full' };
  try{
    // 📤 상대 이름을 아는 입구라 이름을 이름표로 넘긴다
    const res = await net.sendFriendRequest(getMyUserId(), uid, getDisplayName(), name, null, msg || '');
    return (res && res.ok) ? { ok:true } : { ok:false, reason: (res && res.reason) || 'save_failed' };
  }catch(e){ return { ok:false, reason:'error', err:e }; }
}
/* 결과 → 보일 것 한 벌 — 좌석 · 마이홈 [친구 신청] 두 입구가 같은 말을 하게(마이홈은 fail 이면 문구 대신 E-FR-06).
   → { kind: 'ok' | 'info' | 'fail', text } */
function resultView(res, name){
  const r = res && res.reason;
  if(res && res.ok) return { kind:'ok', text: name + '님에게 친구 요청을 보냈어요 — 상대가 수락하면 친구가 돼요' };
  if(r === 'not_ready') return { kind:'info', text:'아직 준비 중이에요' };
  if(r === 'self') return { kind:'info', text:'내 코드는 추가할 수 없어요' };
  if(r === 'already') return { kind:'info', text:'이미 친구예요' };
  if(r === 'full') return { kind:'info', text:'친구는 최대 '+FRIEND_MAX+'명까지만 추가할 수 있어요' };
  if(r === 'error') return { kind:'fail', text:'요청 중 오류가 발생했어요' };
  return { kind:'fail', text:'요청에 실패했어요' };
}
async function _friendReqSend(uid, name){
  toast(resultView(await sendFriendReq(uid, name, ''), name).text);
}

return {
  _friendReqAsk,
  resultView,
  sendFriendReq,
};
}

const api = { createSeatFriendReq };
if(typeof window !== 'undefined') window.TwSeatFriendReq = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
