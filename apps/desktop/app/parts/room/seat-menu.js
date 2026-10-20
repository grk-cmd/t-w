/* seat-menu.js — 🖱 좌석 우클릭 메뉴: 좌석(캐릭터 · 이름표)을 우클릭하면 그 자리에 할 수 있는 일을 띄운다
   app.js «DRAG / PET» 안의 메뉴 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄은 읽는 함수 자리 · 입구 가드 · 옛 이야기형 주석 줄이기).
   ・책임: 메뉴 그리기 — 남의 좌석(마이홈 구경 / 친구 신청 · 숨기기 / 다시 보이기 · 때리기 · 신고) · 내 좌석(캐릭터 편집 · 자리비움 토글 · 때리기) ·
     닫기(투명 뒷판 · 바깥 클릭 · 우클릭 · ESC — 캡처 단계에서 끊는다) · 화면 밖으로 넘치면 안쪽으로.
   ・받는 deps 11 — 값 hiddenSeatsMod · mhVisitMod · seatFriendReqMod · tricksMod · 함수 4(_premiumOn · openCreator · setUserStatus · toast) · 읽는 함수 3(_myHomeFriends · reportMod · userStatus).
   ・내놓는 것: _seatCtxMenu(ev, seat) — 캔버스 우클릭(app.js)과 이름표 우클릭(overhead.js — app.js 가 setSeatMenu 로 잇는다)이 부른다.
   ・입구 전제: 이벤트(좌표) · 좌석 · 화면(document.body)이 있어야 연다 — 없으면 아무것도 안 한다.
   ⚠️ document · window._activeChannel · innerWidth · setTimeout 은 전역 이름 그대로. 전역 이름은 TwSeatMenu(Tw 접두사 #103).
   검사: checks/sim-seat-menu.js */
(function(){

function createSeatMenu(deps){
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const _premiumOn = deps._premiumOn;
const hiddenSeatsMod = deps.hiddenSeatsMod;
const mhVisitMod = deps.mhVisitMod;
const openCreator = deps.openCreator;
const reportMod = deps.reportMod;   // 읽는 함수
const seatFriendReqMod = deps.seatFriendReqMod;
const setUserStatus = deps.setUserStatus;
const toast = deps.toast;
const tricksMod = deps.tricksMod;
const userStatus = deps.userStatus;   // 읽는 함수
/* 🖱 좌석 우클릭 메뉴 — 책상 프리셋 슬롯의 `cr-preset-ctx` 를 그대로 베낀다.
   ★ 클래스 이름을 새로 짓지 않는다. `cr-preset-ctx` 인 이유가 "다른 팝업의 바깥클릭 닫기에서
     예외 처리하려고" 이고, 새 이름을 쓰면 그 예외 목록에 따로 등록해야 한다(안 하면 다른 팝업
     닫기 로직이 이 메뉴를 즉시 닫아버린다). 식별용으로 `seat-ctx` 만 덧붙인다.
   ⚠️ ESC 는 캡처 단계에서 소비하고 전파를 끊는다 — 안 끊으면 ESC 한 번에 메뉴와 마이홈이 같이 닫힌다. */
function _seatCtxMenu(ev, seat){
  if(!ev || !seat || !document.body) return;   // 입구 전제 — 예전엔 부르는 쪽(우클릭 처리)이 말없이 보장했다
  try{ document.querySelectorAll('.seat-ctx, .seat-ctx-backdrop').forEach(n=>n.remove()); }catch(_){}
  /* 투명 뒷판 — 실행 화면은 투명 오버레이라 커서 아래에 받을 것이 없으면 클릭이 뒤 창으로 흘러 바깥 클릭이 안 닫힌다.
     메뉴가 열린 동안만 화면 전체를 덮는다(_pointHitsInteractive 목록에 있다). ⚠️ 메뉴와 수명을 같이 한다 — 지우는 곳은 close() 하나. */
  const backdrop = document.createElement('div');
  backdrop.className = 'seat-ctx-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9998;background:transparent;';
  const menu = document.createElement('div');
  menu.className = 'cr-preset-ctx seat-ctx';
  menu.style.cssText = 'position:fixed;z-index:9999;background:var(--win-face);'
    + 'border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);'
    + 'box-shadow:2px 2px 4px rgba(0,0,0,.3);padding:3px 0;font-size:11px;min-width:116px;'
    + 'left:' + ev.clientX + 'px;top:' + ev.clientY + 'px;';
  let closer = null, onEsc = null;
  const close = ()=>{
    menu.remove();
    backdrop.remove();
    if(closer) document.removeEventListener('mousedown', closer, true);
    if(onEsc) document.removeEventListener('keydown', onEsc, true);
  };
  /* 4번째 인자 iconSrc = 라벨 앞 작은 그림. 뿅망치처럼 이모지가 없는 항목용(나머지는 그냥 이모지 글자). */
  const mk = (label, fn, disabled, iconSrc)=>{
    const it = document.createElement('div');
    it.textContent = label;
    if(iconSrc){ const im=document.createElement('img'); im.src=iconSrc;
      im.style.cssText='width:15px;height:15px;vertical-align:-3px;margin-right:4px;'; it.prepend(im); }
    /* 여백은 4px 8px — 가장 긴 줄(`[그림] 때리기 (n/5)`)이 min-width 116px 안에 딱 들어오는 값이다.
       ★ 항목이 white-space:nowrap 이므로 이보다 긴 글자가 와도 잘리지 않는다(메뉴가 늘어난다).
         min-width 는 '이보다 좁아지지 않는다'는 하한일 뿐이다. */
    it.style.cssText = 'padding:4px 8px;cursor:' + (disabled ? 'default' : 'pointer') + ';'
      + 'color:' + (disabled ? 'var(--win-lo-2)' : 'var(--ink)') + ';white-space:nowrap;';
    if(!disabled){
      it.onmouseenter = ()=>it.style.background = 'var(--win-select)';
      it.onmouseleave = ()=>it.style.background = '';
      it.onclick = ()=>{ close(); fn(); };
    } else {
      it.onclick = ()=>{ close(); toast('오늘은 다 썼어요'); };
    }
    menu.appendChild(it);
  };
  /* 구분선 — '내 상태'와 '남에게 하는 것'을 가른다. 뒤따르는 줄이 있을 때만 부를 것
     (때리기는 프리미엄에서만 붙으므로, 조건 없이 넣으면 맨 아래에 선만 남는다). */
  const sep = ()=>{
    const d = document.createElement('div');
    d.style.cssText = 'height:1px;margin:3px 0;background:var(--win-lo-2);';
    menu.appendChild(d);
  };
  if(seat.remote){
    // seat.friendId는 방 세션의 memberId(랜덤). 실제 유저 식별은 friendUserId(userId) 필요.
    const uid = seat.friendUserId || null;
    if(uid && _myHomeFriends()[uid]){
      mk('🏠 마이홈 구경', ()=>{ mhVisitMod.openFriendHomeView(uid); });
    } else if(uid){
      mk('👤 친구 신청', ()=>seatFriendReqMod._friendReqAsk(uid, seat));
    } else {
      mk('👤 친구 신청', ()=>toast('이 유저의 정보가 아직 없어요 (버전 업데이트가 필요할 수 있어요)'));
    }
    /* 🙈 숨기기 — 워킹룸에서만. 내 화면 · 이 방에 있는 동안만(_hiddenSeatIds 주석).
       🚩 신고로 숨긴 사람은 채널과 상관없이 «🙉 다시 보이기» 하나로 푼다(신고 기록은 그대로). */
    const _rptHid = !!(seat.friendUserId && hiddenSeatsMod._reportHiddenUids.has(seat.friendUserId));
    if(_rptHid){
      mk('🙉 다시 보이기', ()=>{ hiddenSeatsMod._reportHiddenUids.delete(seat.friendUserId); hiddenSeatsMod._reportHiddenSave(); if(seat.friendId) hiddenSeatsMod._hiddenSeatIds.delete(seat.friendId); });
    }
    else if(window._activeChannel === 1 && seat.friendId){
      const _hid = hiddenSeatsMod._hiddenSeatIds.has(seat.friendId);
      mk(_hid ? '🙉 다시 보이기' : '🙈 숨기기', ()=>{
        if(_hid) hiddenSeatsMod._hiddenSeatIds.delete(seat.friendId); else hiddenSeatsMod._hiddenSeatIds.add(seat.friendId);
      });
    }
  } else {
    // 🎨 편집을 첫 항목에 둔다 — 예전에 우클릭이 곧 편집창이었으므로 손이 가는 거리를 줄인다
    mk('🎨 캐릭터 편집', ()=>openCreator({kind:'seat', seat}));
    /* 자리비움 토글 — 내 좌석에만. 상태 칩 메뉴와 같은 한 줄(setUserStatus 가 저장 · 칩 · 방 전파까지 한다). 해제는 «온라인» — 밥 · 게임 같은 앞 상태로 돌아가지 않는다(칩 메뉴와 같게). */
    let _away = false; try{ _away = (userStatus() === 'away'); }catch(_){}
    mk(_away ? '🔵 비움 해제' : '🫧 자리비움', ()=>{
      setUserStatus(_away ? null : 'away');
    });
    if(_premiumOn()) sep();   // 아래에 때리기 줄이 붙을 때만 — 안 그러면 선이 맨 아래에 남는다
  }
  /* 🪄 때리기 — 프리미엄이 아니면 **줄을 아예 안 넣는다**(파츠 licenseOnly 가 장착을 막는 방식과 같게).
     ★ 남은 횟수를 여기 적는 것이 한도 있는 기능의 최소 예의다 — 누르기 전에 보여야 한다. */
  if(_premiumOn() && !hiddenSeatsMod._seatHidden(seat)){   // 🙈 숨긴 캐릭터는 때릴 대상이 아니다(안 보이는 것을 때리게 되지 않게)
    const left = tricksMod._bonkLeft();
    mk('때리기 (' + left + '/' + tricksMod.BONK_DAILY_MAX + ')', ()=>tricksMod.bonkSeat(seat), left <= 0, tricksMod.BONK_CURSOR_IMG);
  }
  /* 🚩 신고하기 — 남의 좌석 · 모든 채널. 사유는 창에서 고른다(_openReportDialog). */
  if(seat.remote){ sep(); mk('🚩 신고하기…', ()=>reportMod().openDialog(seat)); }
  document.body.appendChild(backdrop);
  document.body.appendChild(menu);
  /* 뒷판을 누르면 닫는다. 우클릭도 마찬가지 — 메뉴가 떠 있는데 다른 곳을 우클릭했을 때
     아무 반응이 없으면 고장으로 읽힌다. */
  backdrop.addEventListener('mousedown', e=>{ e.preventDefault(); close(); });
  backdrop.addEventListener('contextmenu', e=>{ e.preventDefault(); close(); });
  /* 화면 밖으로 넘치면 안쪽으로 당긴다 — 프리셋 메뉴는 패널 안 버튼에서만 열리지만
     좌석 우클릭은 전체화면 캔버스 어디서나 열린다(오른쪽·아래 끝에서 잘린다). */
  try{
    const b = menu.getBoundingClientRect();
    if(b.right > innerWidth - 4) menu.style.left = Math.max(4, innerWidth - b.width - 4) + 'px';
    if(b.bottom > innerHeight - 4) menu.style.top = Math.max(4, innerHeight - b.height - 4) + 'px';
  }catch(_){}
  closer = e=>{ if(!menu.contains(e.target)) close(); };
  /* 단축키(T 가챠 · F2 꾸미기 …)로 창이 열리면 뒷판(9998) 밑에 깔려, 다음 클릭을 뒷판이 받는다 — 그 창은 «바깥 클릭» 으로 저장 · 닫힌다.
     그래서 조합 키가 아닌 키는 메뉴부터 닫고 그대로 흘려보낸다(Esc 만 삼킨다). */
  onEsc = e=>{
    if(e.key === 'Escape'){ e.stopPropagation(); close(); return; }
    if(!/^(Shift|Control|Alt|Meta|CapsLock|Process|Unidentified)$/.test(e.key)) close();
  };
  // setTimeout(…,0) — 지금 이 이벤트에 바로 닫히지 않게(프리셋 메뉴와 같은 이유)
  setTimeout(()=>document.addEventListener('mousedown', closer, true), 0);
  document.addEventListener('keydown', onEsc, true);
}

return {
  _seatCtxMenu,
};
}

const api = { createSeatMenu };
if(typeof window !== 'undefined') window.TwSeatMenu = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
