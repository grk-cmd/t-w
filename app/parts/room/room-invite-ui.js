/* room-invite-ui.js — 🙋 투게더룸 친구 초대(친구 고르기 창 · 초대 보내기) · 🚪 방 초대 받기(수락 / 거절 팝업 · 3분 자동 거절 · 작업표시줄 깜빡임)
   app.js 의 «🙋 투게더룸 친구 초대» 구역을 그대로 옮긴 모듈이다(앱 FSD 10번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.

   ★ 아래 본문은 app.js 에 있던 글 그대로다 — 들여쓰기도 바꾸지 않았다(옮기기 전 줄과 견주어 볼 수 있게).
     바뀐 것은 한 줄뿐이다 — _myHomeFriends → _myHomeFriends().
     app.js 가 친구 목록 구독마다 다시 대입하는 let 이라 값이 아니라 읽는 함수로 받는다.
   ★ 함수(toast · escHtml · getMyUserId · getDisplayName · startRoom · doLeaveRoom · _friendInRoom)는 app.js 가 화살표로 넘긴다.
     본문의 typeof 가드(typeof startRoom · typeof _friendInRoom · typeof toast)는 예전처럼 늘 통과한다.
     Presence 는 app.js 에서 이 모듈을 만드는 줄보다 앞에 선언되고 다시 대입되지 않는 const 라 값으로 받는다.
   ★ 밖에서 부르는 이름은 없다 — 버튼(#inviteFriendBtn · #fsInviteFriendBtn) 연결과 초대 수신 구독을 전부 만들 때 건다.
     반환값(showPopup · busy)은 검사용이다.
   ★ createRoomInviteUi 는 app.js 의 원래 자리(INIT 뒤)에서 부른다. 만들 때 바로 도는 것(친구 고르기 창 버튼 · 끌기 · resize 연결,
     firebaseAPI 가 있으면 초대 수신 구독 · 없으면 firebase-ready 를 기다림)이 예전과 같은 순서 · 같은 때에 돈다.
   ⚠️ document · window · firebaseAPI · companion · addEventListener · innerWidth 는 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwRoomInviteUi — 크로미움 내장 전역과 겹치는 이름(Scheduler 같은)을 쓰면 typeof 가드가 늘 통과한다(#103).
   검사: checks/sim-room-invite-ui.js — 만들 때 배선 · 친구 고르기 창(방 없음 · 친구 없음 · 순서 · 사진 · 🏠 · 10줄 스크롤) ·
         초대 보내기(다른 방 친구는 한 번 더) · 끌기 · 받기(오래된 것 지움 · 최근 것 · 수락 이동 · 거절 · 3분) · app.js 배선 · html 순서.
         checks/sim-room-invite-wait.js — 팝업이 화면을 막지 않는다 · 3분 · 오래됨 10분. */
(function(){

function createRoomInviteUi(deps){
const toast = deps.toast;
const escHtml = deps.escHtml;                  // 팝업의 보낸 사람 이름
const getMyUserId = deps.getMyUserId;
const getDisplayName = deps.getDisplayName;    // 초대에 실어 보내는 내 이름
const startRoom = deps.startRoom;              // 수락 — 그 방으로
const doLeaveRoom = deps.doLeaveRoom;          // 수락 — 이미 방에 있으면 먼저 나간다
const _friendInRoom = deps.friendInRoom;       // 🏠 다른 방에 있는 친구 판정 — app.js(마이홈 친구 목록)
const Presence = deps.presence;
const _myHomeFriends = deps.myHomeFriends;     // 읽는 함수 — app.js 가 다시 대입하는 let
const _friendsNotice = deps.friendsNotice;     // 읽는 함수 — 친구 목록을 아직 못 받았으면 안내 문구, 받았으면 null(friends-sub.js · 마이홈 친구 탭과 같은 문구)
const _friendsRetry = deps.friendsRetry;       // 친구 목록을 못 불러왔으면 다시 건다(초대 목록을 열 때)
const _friendsOpen = deps.friendsOpen;         // (key, onUpdate) — 목록을 열었다(이름 · 사진 다시 받기 · 바뀌면 onUpdate)
const _friendsClose = deps.friendsClose;       // (key) — 목록을 닫았다
(function bindRoomInvite(){
  const pickOv   = document.getElementById('roomInvitePickOverlay');
  const pickList = document.getElementById('roomInvitePickList');
  const pickClose= document.getElementById('roomInvitePickClose');
  if(!pickOv) return;

  /* 한 번 연 동안의 상태 — 열려 있는 사이 친구 목록이 바뀌면(이름 · 사진 도착) 다시 그리는데, 보낸 · 보내는 중 · 한 번 알린 버튼은 이어지게.
     gen = 그린 횟수 — 보내기가 끝났을 때 그 줄이 이미 다시 그려졌으면 한 번 더 그린다(새 버튼이 «...» 에 머물지 않게). */
  let _pick = null;   // { code, sent, sending, warned, gen } | null(닫힘)
  function openPick(){
    const code = (typeof Presence!=='undefined' && Presence.active()) ? Presence.roomCode() : null;
    if(!code){ toast('먼저 방에 연결해 주세요'); return; }
    _pick = { code, sent: new Set(), sending: new Set(), warned: new Set(), gen: 0 };
    _friendsRetry();   // 못 불러왔으면 지금 다시 건다(다시 시도는 목록을 열 때만)
    _friendsOpen('invite', ()=>{ if(_pick && pickOv.style.display !== 'none') _renderPick(); });
    _renderPick();
    pickOv.style.display = 'flex';
    /* 옮겨 둔 창은 목록 길이가 달라지면 높이도 달라진다 — 열 때마다 화면 안으로 다시 가둔다.
       (display 를 준 뒤에 재야 offsetHeight 가 실제 높이로 나온다) */
    if(_pickPos) _pickApplyPos();
  }
  function _renderPick(){
    const st = _pick, code = st.code, gen = ++st.gen;
    const top = pickList.scrollTop;
    // 초대 가능한 채널인지 — 채널3(플레이룸)은 준비중이므로 초대도 막힘
    pickList.innerHTML = '';
    const friends = _myHomeFriends() || {};
    const ids = Object.keys(friends);
    const notice = _friendsNotice();
    if(notice){
      const box = document.createElement('div');
      box.style.cssText = 'padding:16px;text-align:center;color:var(--ink-soft);font-size:11px;white-space:pre-line;';   // 안내 두 문장 사이 줄바꿈(friends-sub NOTICE)
      box.textContent = notice;
      pickList.appendChild(box);
      pickList.style.maxHeight = '';
    } else if(!ids.length){
      pickList.innerHTML = '<div style="padding:16px;text-align:center;color:var(--ink-soft);font-size:11px;">아직 친구가 없어요<br>마이홈 > 친구에서 친구를 추가해 보세요</div>';
      pickList.style.maxHeight = '';
    } else {
      /* 🙋 온라인 먼저, 그 안에서 이름순 — 마이홈 친구 목록과 같은 순서다.
         예전엔 Object.keys 순서(사실상 무작위)라 매번 다른 자리에 떠서 눈이 헤맸다. */
      const byName = (a,b)=>String(friends[a].name||'').localeCompare(String(friends[b].name||''), 'ko');
      const sorted = ids.filter(id=>friends[id].online).sort(byName)
              .concat(ids.filter(id=>!friends[id].online).sort(byName));
      sorted.forEach(fid=>{
        const f = friends[fid] || {};
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--win-lo-2);font-size:12px;';

        /* 🖼 프로필 사진 — 닉네임이 겹칠 때 사람을 가르는 첫 단서.
           🛡️ 마이홈 친구 목록과 **같은 관례**를 지킨다: `src` 는 남의 노드에서 온 문자열이므로
             속성 문자열에 보간하지 않고 프로퍼티로 대입하고, 스킴은 data:image/ 와 http(s) 만 통과시킨다.
             (감사 검사 19 가 이 모양을 본다 — 여기를 템플릿 문자열로 되돌리지 말 것) */
        const ava = document.createElement('span');
        ava.style.cssText = 'position:relative;flex:none;width:28px;height:28px;';
        const img = document.createElement('span');
        img.style.cssText = 'display:flex;align-items:center;justify-content:center;width:28px;height:28px;'
          + 'border-radius:50%;overflow:hidden;background:var(--win-face-2, #efefef);'
          + 'border:1px solid var(--win-lo-2);font-size:14px;color:var(--ink-soft);';
        if(f.avatar && /^(data:image\/|https?:)/i.test(String(f.avatar))){
          const im = document.createElement('img');
          im.draggable = false;
          im.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          im.src = f.avatar;
          img.appendChild(im);
        } else {
          img.textContent = '🙂';                     // 사진을 안 올린 친구 — 빈 원보다 덜 허전하다
        }
        const dot = document.createElement('span');
        dot.style.cssText = 'position:absolute;right:-1px;bottom:-1px;width:8px;height:8px;border-radius:50%;'
          + 'border:2px solid var(--win-face);background:' + (f.online ? '#49c96d' : 'var(--win-lo-2)') + ';';
        ava.appendChild(img); ava.appendChild(dot);

        /* 🏠 는 `_friendInRoom` 이 판정한다 — 시크릿룸에 있는 친구에게도 붙는다(코드만 안 보인다).
           f.room 으로 판정하면 시크릿룸 친구만 🏠 가 빠져서 반대 방향 단서가 된다. */
        const inRoom = _friendInRoom(f);
        const nm = document.createElement('span');
        nm.style.cssText = 'color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        nm.textContent = f.name || '(이름 없음)';
        const meta = document.createElement('span');
        meta.style.cssText = 'font-size:10px;color:var(--ink-soft);margin-left:4px;';
        meta.textContent = 'Lv.' + (f.level || 1) + (inRoom ? ' 🏠' : '');
        if(inRoom) meta.title = '지금 다른 방에 있어요';
        nm.appendChild(meta);

        const btn = document.createElement('button'); btn.className='lc-btn'; btn.textContent='초대'; btn.style.cssText='width:56px;flex:none;font-size:11px;padding:4px 0;margin:0;';
        let warned = st.warned.has(fid);
        if(st.sent.has(fid)){ btn.disabled = true; btn.textContent='완료'; }
        else if(st.sending.has(fid)){ btn.disabled = true; btn.textContent='...'; }
        else if(warned){ btn.textContent = '그래도'; btn.title = '한 번 더 누르면 초대를 보냅니다'; }
        const send = async ()=>{
          btn.disabled = true; btn.textContent='...';
          st.sending.add(fid);
          try{
            if(window.firebaseAPI && firebaseAPI.sendRoomInvite){
              await firebaseAPI.sendRoomInvite(fid, getMyUserId(), code, getDisplayName());
              toast((f.name||'친구') + ' 님에게 초대를 보냈어요');
              btn.textContent='완료';
              st.sent.add(fid);
            } else { toast('네트워크 연결이 필요해요'); btn.disabled=false; btn.textContent='초대'; }
          }catch(e){ toast('초대에 실패했어요'); btn.disabled=false; btn.textContent='초대'; }
          st.sending.delete(fid);
          if(_pick === st && st.gen !== gen && pickOv.style.display !== 'none') _renderPick();
        };
        btn.onclick = ()=>{
          /* 🏠 다른 방에 있는 친구 — 첫 클릭은 보내지 않고 알려만 준다.
             [왜 막지 않고 한 번 더 묻나] 닉네임이 겹쳐 엉뚱한 사람을 누르는 것이 이 화면의 문제라
               한 번 세우는 것만으로 사고가 걸러진다. 그렇다고 아예 막으면, 다른 방에 있는 친구를
               우리 방으로 부르는 정상적인 경우까지 못 하게 된다 — 그건 과하다. */
          if(inRoom && !warned){
            warned = true; st.warned.add(fid);
            toast((f.name||'친구') + ' 님은 현재 다른 방에 입장 중입니다');
            btn.textContent = '그래도';
            btn.title = '한 번 더 누르면 초대를 보냅니다';
            return;
          }
          send();
        };
        row.appendChild(ava); row.appendChild(nm); row.appendChild(btn);
        pickList.appendChild(row);
      });
      /* 📜 10줄까지만 보이고 그 아래는 스크롤. 한 줄 높이가 아바타(28) + 위아래 여백(6·6) +
         경계선(1) = 41px 이라 여기서 계산한다 — 마크업에 41 을 박아두면 아바타 크기를 바꿀 때
         한쪽만 고쳐진다. 얇은 스크롤바(8px)는 HTML 의 #roomInvitePickList 규칙이 그린다. */
      const INVITE_ROW_H = 41, INVITE_MAX_ROWS = 10;
      pickList.style.maxHeight = (sorted.length > INVITE_MAX_ROWS)
        ? (INVITE_ROW_H * INVITE_MAX_ROWS) + 'px' : '';
    }
    pickList.scrollTop = top;   // 다시 그려도 보던 자리 그대로
  }
  function closePick(){ pickOv.style.display='none'; _pick = null; _friendsClose('invite'); }

  /* ✥ 타이틀바 드래그로 창 옮기기 — 알림창(#bellWin)과 같은 방식이다.
     [무엇을 바꾸는가] 이 창은 오버레이가 flex 로 가운데 잡아 준다. 드래그를 시작하는 순간
       position:fixed + left/top 으로 **한 번만** 갈아탄다(그 전까지는 가운데 정렬 그대로).
       그래야 옮긴 적 없는 사람은 창 크기가 달라져도 계속 가운데에서 뜬다.
     ★ 이동·놓기 리스너는 document 에 단다 — 커서가 창 밖으로 빨리 나가도 안 끊긴다.
     ★ ✕ 위에서 시작한 것은 닫기다. 드래그로 삼으면 닫기가 안 먹는다.
     ★ 화면 밖으로 못 나가게 가둔다. 타이틀바가 화면 위로 넘어가면 다시 잡을 방법이 없다.
     ⚠️ 위치는 이 세션에만 기억한다(변수). localStorage 에 넣으면 창 크기가 달라진 다음 실행에서
       화면 밖에 떠 있는 일이 생긴다 — 마이홈 창에서 이미 한 번 겪은 문제다. */
  let _pickPos = null;   // {x,y} — null 이면 가운데 정렬 그대로
  const _pickApplyPos = ()=>{
    const win = document.getElementById('roomInvitePickWin');
    if(!win || !_pickPos) return;
    const w = win.offsetWidth || 320, h = win.offsetHeight || 200;
    const x = Math.max(0, Math.min(_pickPos.x, Math.max(0, innerWidth  - w)));
    const y = Math.max(0, Math.min(_pickPos.y, Math.max(0, innerHeight - h)));
    win.style.position = 'fixed';
    win.style.left = x + 'px';
    win.style.top  = y + 'px';
  };
  const head = document.getElementById('roomInvitePickHead');
  if(head){
    head.addEventListener('pointerdown', e=>{
      if(e.button !== 0) return;
      if(e.target && e.target.closest && e.target.closest('.mh-x')) return;   // ✕ 는 닫기
      const win = document.getElementById('roomInvitePickWin');
      if(!win) return;
      e.preventDefault();
      const r = win.getBoundingClientRect();
      const gx = e.clientX - r.left, gy = e.clientY - r.top;   // 잡은 지점 유지 — 창이 커서로 튀지 않게
      const x0 = e.clientX, y0 = e.clientY;
      let moved = false;
      const onMove = ev=>{
        if(!moved && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 3) return;   // 손떨림은 클릭으로 둔다
        moved = true;
        _pickPos = { x: ev.clientX - gx, y: ev.clientY - gy };
        _pickApplyPos();
      };
      const onUp = ()=>{
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    });
    // 타이틀바 더블클릭 = 옮긴 자리를 버리고 가운데로 복귀(알림창과 같은 규약)
    head.addEventListener('dblclick', e=>{
      if(e.target && e.target.closest && e.target.closest('.mh-x')) return;
      _pickPos = null;
      const win = document.getElementById('roomInvitePickWin');
      if(win){ win.style.position = ''; win.style.left = ''; win.style.top = ''; }
    });
  }
  /* 창 크기가 바뀌면 옮겨 둔 창이 화면 밖에 걸릴 수 있다 — 다시 가둔다. */
  addEventListener('resize', ()=>{ if(_pickPos && pickOv.style.display !== 'none') _pickApplyPos(); });

  const b1 = document.getElementById('inviteFriendBtn');
  const b2 = document.getElementById('fsInviteFriendBtn');
  if(b1) b1.addEventListener('click', openPick);
  if(b2) b2.addEventListener('click', openPick);
  if(pickClose) pickClose.addEventListener('click', closePick);
  pickOv.addEventListener('mousedown', e=>{ if(e.target===pickOv) closePick(); });
})();

/* 🚪 방 초대 수신 — 어디에 있든 팝업으로 수락/거절. 수락하면 그 방으로 이동. */
let _roomInviteBusy = false;
/* ⏳ [2026-10-02 제보 «초대 알림이 뜨면 수락·거절 말고 아무것도 못 한다»] 초대는 **3분** 기다린다.
   그동안 화면의 다른 곳(앱 · 뒤의 프로그램)을 그대로 쓸 수 있고, 3분이 지나면 **거절로 본다.**
   ★ 오래된 초대(앱을 꺼 둔 사이에 온 것 등)는 띄우지 않고 지운다 — 몇 시간 전 초대에 수락하면
     이미 비어 있거나 다른 방이 된 방으로 끌려간다.
   ⚠️ 그 «오래됨» 문턱은 3분이 아니라 **10분**이다. ts 는 **보낸 쪽 PC 시계**(Date.now)라, 받는 쪽 시계가 몇 분
     앞서 있으면 방금 온 초대를 «3분 지남» 으로 읽고 버린다. 3분 대기 자체는 팝업이 뜬 순간부터 잰다(아래). */
const ROOM_INVITE_WAIT_MS  = 3 * 60 * 1000;
const ROOM_INVITE_STALE_MS = 10 * 60 * 1000;
function _bindRoomInviteReceiver(){
  if(!(window.firebaseAPI && firebaseAPI.subscribeRoomInvites)) return;
  const myId = getMyUserId();
  firebaseAPI.subscribeRoomInvites(myId, invites=>{
    let ids = Object.keys(invites || {});
    if(!ids.length || _roomInviteBusy) return;
    /* 오래된 초대는 조용히 거절 처리(지우기). 지우면 구독이 다시 불려 남은 것으로 이어진다. */
    const _now = Date.now();
    const _stale = ids.filter(id => (invites[id] && invites[id].ts > 0) && (_now - invites[id].ts > ROOM_INVITE_STALE_MS));
    if(_stale.length){
      _stale.forEach(id => { try{ Promise.resolve(firebaseAPI.clearRoomInvite(myId, id)).catch(()=>{}); }catch(_){} });
      ids = ids.filter(id => _stale.indexOf(id) < 0);
      if(!ids.length) return;
    }
    _roomInviteBusy = true;
    // 가장 최근 초대 하나만 처리 (여러 개면 순차)
    ids.sort((a,b)=> (invites[b].ts||0) - (invites[a].ts||0));
    const fromId = ids[0];
    const inv = invites[fromId];
    showRoomInvitePopup(inv.fromName || '친구', inv.roomCode, async (accepted)=>{
      try{ await firebaseAPI.clearRoomInvite(myId, fromId); }catch(_){}
      if(accepted && inv.roomCode){
        // 이미 다른 방이면 나간 뒤 이동
        try{ if(typeof Presence!=='undefined' && Presence.active()) await doLeaveRoom({ wipeChat: true }); }catch(_){}
        startRoom(inv.roomCode);
      }
      _roomInviteBusy = false;
    });
  });
}
/* 🔔 작업표시줄 깜빡임 — 초대 팝업과 **수명을 정확히 같이 한다.**
   ⚠️ 켜는 곳과 끄는 곳이 갈라지면 안 된다. 그래서 팝업을 만드는 함수 안에서 켜고,
     팝업을 없애는 단 하나의 경로(done)에서 끈다. 수락·거절 어느 쪽이든 done 을 지난다.
   ★ 포커스가 있으면 깜빡이지 않는 판정은 main 이 한다 — 여기서 판단하지 않는다.
     run 모드는 전체화면 투명 오버레이라 "화면에 보인다"와 "포커스가 있다"가 다르고,
     그림 도구에 포커스가 있는 상태에서 초대를 받으면 깜빡이는 것이 맞다.
   ★ Electron 밖(브라우저 미리보기)에서는 window.companion 이 없다 — 조용히 넘어간다. */
function _flashTaskbar(on){
  try{ if(window.companion && typeof companion.flashFrame==='function') companion.flashFrame(!!on); }catch(_){}
}
function showRoomInvitePopup(fromName, roomCode, cb){
  const ov = document.createElement('div');
  ov.className = 'app-popup-ov';   // 마우스 통과 화이트리스트 매칭용
  /* ⏳ [2026-10-02] 배경 판을 뺐다 — 껍데기(ov)는 **pointer-events:none** 이고 상자만 클릭을 받는다.
     예전엔 화면 전체를 덮는 어두운 판(pointer-events:auto)이라, 실행 화면에서 **화면 전체가 클릭을 막았다**
     (앱 버튼도 뒤 프로그램도 못 누름 = 제보). 클릭 통과 영역 수집(_uiRegions)은 none 껍데기를 건너뛰고
     자식(상자)의 사각형만 담으므로 상자 밖은 그대로 뒤로 통과한다. ⚠️ ov 를 다시 auto 로 바꾸지 말 것. */
  ov.style.cssText = 'position:fixed;inset:0;z-index:9600;background:none;display:flex;align-items:center;justify-content:center;pointer-events:none;';
  const box = document.createElement('div');
  box.style.cssText = 'pointer-events:auto;width:300px;background:var(--win-face);border:2px solid;border-color:var(--win-hi) var(--win-lo-2) var(--win-lo-2) var(--win-hi);box-shadow:inset -1px -1px 0 var(--win-lo), inset 1px 1px 0 var(--win-face-2), 4px 4px 0 rgba(0,0,0,.35);font-family:Tahoma,"Malgun Gothic",sans-serif;';
  box.innerHTML =
    '<div style="background:linear-gradient(90deg, var(--win-title-a), var(--win-title-b));color:#fff;padding:5px 8px;font-size:12px;font-weight:bold;">🙋 방 초대</div>' +
    '<div style="padding:16px 14px 8px;color:var(--ink);font-size:12px;line-height:1.6;"><b>' + escHtml(fromName) + '</b> 님이 함께하자고 초대했어요.<br>수락하면 그 방으로 이동해요.</div>' +
    '<div data-a="left" style="padding:0 14px 10px;color:var(--ink-soft);font-size:10.5px;"></div>' +
    '<div style="display:flex;gap:6px;padding:0 14px 14px;justify-content:flex-end;">' +
      '<button class="lc-btn" data-a="ok" style="min-width:70px;">수락</button>' +
      '<button class="lc-btn ghost" data-a="no" style="min-width:70px;">거절</button>' +
    '</div>';
  ov.appendChild(box); document.body.appendChild(ov);
  _flashTaskbar(true);
  /* ⏳ 3분 대기 — 팝업이 뜬 순간부터 잰다(안내한 3분을 그대로 준다). 지나면 거절과 같은 길(done(false))로 간다.
     ★ done 은 한 번만 — 시간 만료와 버튼이 같은 순간에 겹쳐도 cb 가 두 번 불리지 않게. */
  const leftEl = box.querySelector('[data-a="left"]');
  const due = Date.now() + ROOM_INVITE_WAIT_MS;
  let finished = false, tick = null;
  const done = (val)=>{
    if(finished) return; finished = true;
    if(tick){ clearInterval(tick); tick = null; }
    _flashTaskbar(false); try{ ov.remove(); }catch(_){} cb(val);
  };
  const paint = ()=>{
    const ms = due - Date.now();
    if(ms <= 0){ done(false); toast('⏳ 초대에 3분 동안 응답이 없어 거절했어요'); return; }
    const s = Math.ceil(ms / 1000);
    if(leftEl) leftEl.textContent = '⏳ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' 안에 응답이 없으면 자동으로 거절돼요';
  };
  paint();
  tick = setInterval(paint, 1000);
  box.querySelector('[data-a="ok"]').onclick = ()=>done(true);
  box.querySelector('[data-a="no"]').onclick = ()=>done(false);
}
// Firebase 준비되면 수신 구독 시작
if(window.firebaseAPI) _bindRoomInviteReceiver();
else window.addEventListener('firebase-ready', ()=>_bindRoomInviteReceiver(), { once:true });

return {
  showPopup: showRoomInvitePopup,     // 받은 초대 팝업(검사용)
  busy: ()=>_roomInviteBusy,          // 팝업이 떠 있는 동안 true(검사용)
};
}

const api = { createRoomInviteUi };
if(typeof window !== 'undefined') window.TwRoomInviteUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
