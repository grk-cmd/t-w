/* myhome-init.js — 🏠 마이홈 1단계 — 처음 준비(initMyHome) · 소유권 쓰기 거부 안내
   app.js «🏠 마이홈 1단계 — 처음 준비(initMyHome) · 소유권 쓰기 거부 안내» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 44번 남은 몫 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 24줄 —
     _inboxBroadcast · _myFriendRequests · _myHomeFriends · _myHomeReady · _myInbox · _myInboxReady · focusLevelMod · inboxMod · myHomeOpen 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setInboxBroadcast · setMyFriendRequests · setMyHomeFriends · setMyHomeReady · setMyInbox · setMyInboxReady(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: initMyHome — app.js 는 mhInitMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeInit — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-init.js */
(function(){

function createMyHomeInit(deps){
const MY_FRIEND_CODE_KEY = deps.MY_FRIEND_CODE_KEY;
const _inboxBroadcast = deps._inboxBroadcast;   // 읽는 함수
const _myFriendRequests = deps._myFriendRequests;   // 읽는 함수
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const _myHomeReady = deps._myHomeReady;   // 읽는 함수
const _myInbox = deps._myInbox;   // 읽는 함수
const _myInboxReady = deps._myInboxReady;   // 읽는 함수
const _waitForFirebaseAPI = deps._waitForFirebaseAPI;
const deviceLostMod = deps.deviceLostMod;
const ensureMyFriendCode = deps.ensureMyFriendCode;
const focusLevelMod = deps.focusLevelMod;   // 읽는 함수
const friendManage = deps.friendManage;
const friendsSub = deps.friendsSub;   // 👥 친구 목록 구독 한 벌(friends-sub.js) — 상태 · 자동 다시 걸기
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const inboxMod = deps.inboxMod;   // 읽는 함수
const mhScheduler = deps.mhScheduler;
const myHomeOpen = deps.myHomeOpen;   // 읽는 함수
const presenceLock = deps.presenceLock;   // 🔒 온라인 고정 — 처음 온라인 여부(presence-lock.js)
const toast = deps.toast;
const setInboxBroadcast = deps.setInboxBroadcast;   // 쓰는 함수
const setMyFriendRequests = deps.setMyFriendRequests;   // 쓰는 함수
const setMyHomeFriends = deps.setMyHomeFriends;   // 쓰는 함수
const setMyHomeReady = deps.setMyHomeReady;   // 쓰는 함수
const setMyInbox = deps.setMyInbox;   // 쓰는 함수
const setMyInboxReady = deps.setMyInboxReady;   // 쓰는 함수
let _ownerWriteWarned = false;
function _warnOwnerWriteDenied(what, err){
  const denied = String((err && (err.code || err.message)) || '').toLowerCase().includes('permission');
  console.warn('[마이홈] ' + what + ' 저장 실패' + (denied ? ' (권한 거부)' : ''), err);
  if(!denied || _ownerWriteWarned) return;
  _ownerWriteWarned = true;
  toast('🔑 이 PC의 로그인이 풀려 있어 변경 내용이 저장되지 않아요 — 앱을 다시 시작하면 로그인 화면이 나와요');
}

/* 📢 공용 공지 구독 — 내 코드가 없어도 건다(전체 대상이라 uid 가 필요 없다). */
function _subscribeInboxBroadcast(){
  // 📢 공용 공지 구독 — 전체 대상 공지/업데이트 (개인 inbox와 합쳐서 표시)
  if(firebaseAPI.subscribeInboxBroadcast){
    firebaseAPI.subscribeInboxBroadcast(bc=>{
      const prevIds = Object.keys(_inboxBroadcast()||{});
      setInboxBroadcast(bc || {});
      if(typeof inboxMod().renderInbox === 'function') inboxMod().renderInbox();
      mhScheduler.refreshBellBadge();
      if(mhScheduler.isBellOpen()) mhScheduler.renderBellList();
      Object.keys(_inboxBroadcast()).forEach(id=>{
        if(prevIds.includes(id)) return;
        const m = _inboxBroadcast()[id];
        const lbl = m.tag==='update' ? '🆕 업데이트' : m.tag==='reward' ? '📩 우편' : '📢 공지';
        toast(`📩 ${lbl}: ${m.title||''}`);
      });
    });
  }
}

async function initMyHome(){
  _waitForFirebaseAPI(async ()=>{
    const myId = getMyUserId();
    /* 내 코드가 없으면 내 경로(presence · 프로필 · 친구 · 요청 · 우편)는 걸지 않는다 — 공용 공지만.
       ⚠️ 친구 목록은 «코드 없음» 으로 시작해 둔다(요청 없이 «받음 · 0명») — 안 부르면 친구 탭이 «불러오는 중» 에 멈춘다. */
    if(!myId){ friendsSub.start(null); _subscribeInboxBroadcast(); return; }
    try{
      /* 👥 친구 목록 구독은 맨 먼저 — 아래 쓰기 · await 가 거부되거나 늦어도 목록은 온다(아래 «벽» 주석의 원칙).
         실패하면 friendsSub 가 간격을 늘려 가며 다시 건다. 상태가 바뀌면 친구 탭을 다시 그린다(«불러오는 중» · «못 불러옴»). */
      friendsSub.start(myId, friends=>{
        setMyHomeFriends(friends);
        inboxMod().renderMyHomeFriendList();
        // 📖 방명록 쓰기 게이트는 이 목록으로 판정한다 — 목록이 도착/변경되면 열려 있는 창에 즉시 반영.
        window._mhGbRefreshWriteUI();
      }, ()=>{ try{ inboxMod().renderMyHomeFriendList(); }catch(_){} });
      firebaseAPI.setMyPresenceOnline(myId, presenceLock.startOnlineFor(myId));   // 🔒 첫 쓰기는 고정값을 읽은 뒤(presence-lock.js)
      /* 📱 태블릿·폰 연결 — presence 등록 직후(§4-②). 키가 없는 사람은 아무 일도 안 한다. */
      try{ focusLevelMod()._mobileStart(); }catch(_){}
      /* 🖥️ [2026-09-17 제보 3] 한 계정 한 기기 — 로그인 계정이면 이 기기를 «지금 쓰는 기기» 로 적는다.
         다른 기기가 나중에 적으면 _onDeviceSessionLost 가 불린다. 규칙 미배포·미로그인이면 false 로 조용히 지나간다. */
      try{ if(firebaseAPI.claimDeviceSession) firebaseAPI.claimDeviceSession(myId, deviceLostMod._onDeviceSessionLost); }catch(_){}
      /* 🧱 쓰기와 구독 사이에 벽을 세운다 — **이 두 줄이 예전에는 맨몸이었다.**
         [경위] 규칙 게시 직후 제보: "구글 연동한 유저만 친구 목록이 통째로 사라진다."
           데이터는 RTDB 에 멀쩡히 살아 있었고 읽기 규칙도 열려 있었다. 사라진 것은 목록이
           아니라 **구독** 이었다. setMyProfile 이 permission_denied 로 던지면 이 try 가
           통째로 끊겨서 아래 친구요청·D-day·수령함이 **한 줄도 안 걸렸다.**
           쓰기 하나가 거부됐을 뿐인데 화면에서는 친구·요청·우편이 전부 증발한 것으로 보인다.
         ★ 원칙: 읽기(구독)는 쓰기의 성공에 기대지 않는다. 규칙상 users/{코드} 읽기는 항상
           열려 있으므로, 쓰기가 어떻게 되든 구독은 반드시 걸려야 한다.
         ⚠️ 여기에 await 쓰기를 새로 얹지 말 것. 얹어야 한다면 반드시 자기 try 로 감쌀 것. */
      try{ await focusLevelMod()._adoptStarColorFromProfile(); }catch(_){}   // 🌟 색 받아 오기(읽기) — 아래 첫 프로필 쓰기보다 먼저(개정 71)
      try{ await firebaseAPI.setMyProfile(myId, getDisplayName(), focusLevelMod().getFocusLevel(), focusLevelMod().myStarProfileOut()); }
      catch(e){ _warnOwnerWriteDenied('프로필', e); }
      try{ await ensureMyFriendCode(); }
      catch(e){ console.warn('[마이홈] 친추 코드 확보 실패 — 구독은 그대로 진행', e); }
      // 📌 D-day 구독 (스케줄러 우측 목록)
      if(firebaseAPI.subscribeDdays){
        firebaseAPI.subscribeDdays(myId, dd=>{ mhScheduler.setDdays(dd || {}); mhScheduler.renderDdays(); mhScheduler.refreshBellBadge(); });
      }
      // 👋 나에게 온 친구 요청 구독 — 새 요청이 오면 목록에 뜨고, 처음 도착 시 토스트로 알림.
      //   ★ 이전에는 mhReqSection이 "친구 탭" 안에 있어서 유저가 그 탭을 열지 않으면 요청이 있는지도 모름.
      //     → 요청이 있으면 친구 탭 버튼에 (N) 뱃지 표시 + 마이홈 아이콘에도 자동 뱃지 → 눈에 띄게 함.
      if(firebaseAPI.subscribeFriendRequests){
        firebaseAPI.subscribeFriendRequests(myId, reqs=>{
          const prevIds = Object.keys(_myFriendRequests()||{});
          setMyFriendRequests(reqs || {});
          friendManage.renderFriendRequests();
          // 새로 들어온 요청만 추림 (앱 시작 시 기존 것이 우르르 뜨지 않게)
          const newIds = Object.keys(_myFriendRequests()).filter(id => !prevIds.includes(id));
          newIds.forEach(fromId=>{
            const nm = (_myFriendRequests()[fromId]||{}).name || '누군가';
            toast('👋 '+nm+' 님이 친구 요청을 보냈어요');
          });
          /* 🪟 팝업은 **새로 온 요청**에만, 그리고 그 목록을 지금 보고 있지 않을 때만.
             밀린 요청은 친구 관리 화면이 맡는다(showFriendRequestPopup 주석 참고).
             ⚠️ 여기가 팝업의 **유일한 호출부**다. 마이홈 열 때 자동으로 띄우던 자리는 없앴다 —
               관리 화면이 뜨는 그 순간 모달이 그 앞을 가리기 때문이다. */
          if(myHomeOpen() && newIds.length && !friendManage.reqVisible()){
            friendManage.showFriendRequestPopup(newIds);
          }
        });
      }
      // 📩 수령함 구독 — 새 메시지가 들어오면 토스트로 알림 + 목록 실시간 갱신
      if(firebaseAPI.subscribeInbox){
        firebaseAPI.subscribeInbox(myId, msgs=>{
          const prevIds = Object.keys(_myInbox()||{});
          setMyInbox(msgs || {});
          setMyInboxReady(true);
          /* 💃 수령함이 도착한 지금이 **밀린 해금 안내를 따라잡기 좋은 자리**다 — 여기서만
             "보냈다는 기록은 있는데 실제로는 없다"를 알아볼 수 있다(_danceUnlockPending 참고). */
          try{ if(typeof focusLevelMod()._notifyDanceUnlocks === 'function') focusLevelMod()._notifyDanceUnlocks(focusLevelMod().getFocusLevel()); }catch(_){}
          if(typeof inboxMod().renderInbox === 'function') inboxMod().renderInbox();
          mhScheduler.refreshBellBadge();   // 📩 수령함 변화 → 벨 뱃지 갱신
          if(mhScheduler.isBellOpen()) mhScheduler.renderBellList();
          // 새로 들어온 메시지만 토스트 (앱 시작 시 기존 것이 우르르 뜨지 않게)
          Object.keys(_myInbox()).forEach(id=>{
            if(prevIds.includes(id)) return;
            const m = _myInbox()[id];
            const lbl = inboxMod().inboxTagLabel(m.tag);
            toast(`📩 ${lbl}: ${m.title||''}`);
            // 🐞 답변 알림이 오면 버그제보 탭 배지도 같이(bug-board-ui.js)
            if(m.tag==='bug') window._bugBoardRefreshBadge();
          });
        });
      }
      _subscribeInboxBroadcast();
      setMyHomeReady(true);
      const codeEl=document.getElementById('mhMyCode');
      if(codeEl){ const c=localStorage.getItem(MY_FRIEND_CODE_KEY); if(c) codeEl.textContent=c; }
    }catch(e){ console.warn('마이홈 초기화 실패', e); }
  });
}

return {
  initMyHome,
};
}

const api = { createMyHomeInit };
if(typeof window !== 'undefined') window.TwMyHomeInit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
