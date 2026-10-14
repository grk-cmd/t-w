/* myhome-visit.js — 🏠 마이홈 2단계 — 내 마이홈 데이터(_myHomeData) · 👀 친구 홈 구경(openFriendHomeView · closeFriendHomeView)
   app.js «🏠 마이홈 2단계 — 내 마이홈 데이터(_myHomeData) · 👀 친구 홈 구경(openFriendHomeView · closeFriendHomeView)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 44번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 7줄 —
     _myHomeFriends · _schedDdaysVisitUnsub · myHomeOpen 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setSchedDdaysVisitUnsub · setMyHomeOpen(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _mhApplyVisitUI · _mhHomeFromServer · _mhViewingDisplayName · _mhViewingUserId · _myHomeData · _myHomeLoaded · _myHomeUid · closeFriendHomeView · openFriendHomeView — app.js 는 mhVisitMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeVisit — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-visit.js */
(function(){

function createMyHomeVisit(deps){
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const _schedDdaysVisitUnsub = deps._schedDdaysVisitUnsub;   // 읽는 함수
const applyDesktopRunClass = deps.applyDesktopRunClass;
const getMyUserId = deps.getMyUserId;
const loadMyHomePage = deps.loadMyHomePage;
const mhScheduler = deps.mhScheduler;
const myHomeOpen = deps.myHomeOpen;   // 읽는 함수
const renderMyHomePage = deps.renderMyHomePage;
const toast = deps.toast;
const setSchedDdaysVisitUnsub = deps.setSchedDdaysVisitUnsub;   // 쓰는 함수
const setMyHomeOpen = deps.setMyHomeOpen;   // 쓰는 함수
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
let _mhMyDataBackup = null;
async function openFriendHomeView(friendId, nameHint){
  if(!friendId || friendId===getMyUserId()) return;
  if(!(window.firebaseAPI && firebaseAPI.getMyHome)){ toast('네트워크 연결을 확인해주세요'); return; }
  _mhViewingName = (typeof nameHint==='string' && nameHint.trim()) ? nameHint.trim() : null;
  try{
    const data = await firebaseAPI.getMyHome(friendId);
    // 관람 중에 또 다른 친구 마이홈으로 넘어가는 경우, 원래 내 데이터 백업(_mhMyDataBackup)은 그대로 유지 —
    //   덮어쓰면 나중에 돌아갔을 때 "친구1 데이터가 내 마이홈으로 복원"되는 버그가 생김.
    // ★ 추가 수정: 이번 세션에서 내 마이홈을 서버에서 로드한 적이 없으면(방에서 곧장 우클릭 방문 등)
    //   _myHomeData가 "빈 초기값"이라 이걸 백업하면 복귀 때 마이홈이 초기화된 것처럼 보였다.
    //   미로드 상태면 백업하지 않고(null), 복귀 시 closeFriendHomeView가 서버에서 로드하게 한다.
    if(!_mhViewingUserId){ _mhMyDataBackup = _myHomeLoaded ? _myHomeData : null; }
    window._mhPreviewMode = false;   // 👁 미리보기 중이었으면 해제 (실제 방문으로 전환)
    _mhViewingUserId = friendId;
    // ★ theme 포함 — 관람 모드에서도 친구의 👑 프리미엄 디자인이 그대로 보이게 (loadMyHomePage와 동일한 누락 버그 수정)
    _myHomeData = _mhHomeFromServer(data);
    // 마이홈 창을 안 열려있으면 열기 + 마이홈 탭으로 전환 (loadMyHomePage 트리거 없이 수동 전환)
    const overlay=document.getElementById('myHomeOverlay');
    if(overlay && !overlay.classList.contains('on')){ overlay.classList.add('on'); setMyHomeOpen(true); }
    /* 🪟 **창 크기 전환을 여기서도 부른다.** open() 에만 있고 이 경로에 없던 것이 제보의 원인이었다.
       [증상] 런처(380px 창)에서 친구 마이홈으로 곧장 들어가면 #myHomeWin(760px)이 창 밖으로
         삐져나간다. 왼쪽 열(프로필·닉네임 「수정」·＋스티커)은 **음수 좌표**로 밀려 화면 밖에 있고,
         오른쪽 끝(방명록·마이홈 수정·✕)도 창 너비를 넘는다. 보이는 부분만 눌리니
         "버튼이 안 눌린다"로 제보된다 — 실제로는 그 자리에 아무것도 없는 것이다.
         (__mhClickDiag() 가 `좌표:'-163,320'` · `가린것:null` 로 이걸 잡았다.)
       ★ 「내 마이홈으로」 복귀 경로도 이 상태를 물려받는다 — 그래서 관람 중이 아닌데도 같은 증상이
         남는다. 여기서 한 번 맞춰 두면 그 뒤로는 계속 맞다.
       ⚠️ 오버레이가 **이미 열려 있어도** 부른다. 이 버그로 잘못된 크기인 채 열려 있을 수 있어서,
         if 안에 두면 그 상태를 못 고친다. 같은 값이면 main 쪽에서 어차피 같은 setBounds 다. */
    if(typeof applyDesktopRunClass==='function') applyDesktopRunClass();
    overlay.querySelectorAll('.mh-tab').forEach(t=>t.classList.toggle('on', t.dataset.tab==='home'));
    overlay.querySelectorAll('.mh-page').forEach(p=>p.classList.toggle('on', p.id==='mhPageHome'));
    _mhApplyVisitUI();
    renderMyHomePage();
    /* 🏷️ 이름을 아직 모르면(친구도 아니고 힌트도 없음) 프로필에서 한 번 읽어 온다.
       · getUserNameById 는 users/{uid}/profile 을 읽는데 그 경로의 .read 는 원래 열려 있어서
         규칙 파일은 손댈 게 없다. 이름 한 줄이라 비용도 무시할 수준.
       · 여기 있으니 파도타기뿐 아니라 앞으로 생길 다른 진입 경로도 자동으로 덮인다.
       ⚠️ 조회가 끝나기 전에 다른 홈으로 넘어갔거나 관람을 닫았으면 결과를 버린다 —
          안 그러면 방금 나온 사람의 이름이 다음 화면에 뒤늦게 찍힌다. */
    if(!_mhViewingName && !(_myHomeFriends()[friendId] && _myHomeFriends()[friendId].name) && firebaseAPI.getUserNameById){
      Promise.resolve(firebaseAPI.getUserNameById(friendId)).then(n=>{
        if(_mhViewingUserId !== friendId || !n) return;
        _mhViewingName = String(n);
        _mhApplyVisitUI(); renderMyHomePage();
      }).catch(()=>{});
    }
    if(typeof window._mhReSubscribeGuestbook==='function') window._mhReSubscribeGuestbook();
    if(typeof window._mhGbRefreshBadge==='function') window._mhGbRefreshBadge();   // 관람 모드 → 자기 방명록 뱃지 숨김
    // 👀 스케줄러도 친구 것으로 — 달력(공개 일정만) + D-day(공개만) 구독 전환
    if(_schedDdaysVisitUnsub()){ try{ _schedDdaysVisitUnsub()(); }catch(_){} setSchedDdaysVisitUnsub(null); }
    mhScheduler.setDdaysVisit({});
    if(firebaseAPI.subscribeDdays){
      setSchedDdaysVisitUnsub(firebaseAPI.subscribeDdays(friendId, dd=>{
        const f = {}; for(const k in (dd||{})){ if(dd[k] && dd[k].public) f[k] = dd[k]; }
        mhScheduler.setDdaysVisit(f); mhScheduler.renderDdays();
      }));
    }
    mhScheduler.subscribeMonth();
    mhScheduler.renderDdays();
  }catch(e){ console.warn('친구 마이홈 로드 실패', e); toast('불러오지 못했어요'); }
}
function closeFriendHomeView(){
  if(!_mhViewingUserId) return;
  _mhViewingUserId = null;
  _mhViewingName = null;   // 🏷️ 다음 관람에 이전 사람 이름이 남지 않게
  if(_mhMyDataBackup) _myHomeData = _mhMyDataBackup;
  _mhMyDataBackup = null;
  // ★ 버그 수정("내 마이홈으로" 복귀 시 초기화된 것처럼 보임): 방에서 곧장 친구 홈으로 들어온 세션은
  //   내 마이홈이 서버에서 로드된 적이 없어 복귀 화면이 빈 초기값으로 그려졌다. 실제 데이터는 안전함 —
  //   저장 가드(_myHomeLoaded 전제)가 미로드 세션의 덮어쓰기를 원래부터 막고 있었고, 표시만 문제였다.
  //   미로드 상태면 지금 서버에서 로드(loadMyHomePage가 끝에서 스스로 렌더함).
  if(!_myHomeLoaded && typeof loadMyHomePage==='function'){
    Promise.resolve(loadMyHomePage()).catch(()=>{});
  }
  _mhApplyVisitUI();
  renderMyHomePage();
  if(typeof window._mhReSubscribeGuestbook==='function') window._mhReSubscribeGuestbook();
  if(typeof window._mhGbRefreshBadge==='function') window._mhGbRefreshBadge();   // 자기 홈 복귀 → 뱃지 다시 계산
  // 👀 스케줄러 원복 — 내 달력·내 D-day로
  if(_schedDdaysVisitUnsub()){ try{ _schedDdaysVisitUnsub()(); }catch(_){} setSchedDdaysVisitUnsub(null); }
  mhScheduler.setDdaysVisit(null);
  mhScheduler.subscribeMonth();
  mhScheduler.renderDdays();
}
// 관람 모드 UI 갱신 — 타이틀 라벨/배지/버튼 + 편집 UI 잠금
function _mhApplyVisitUI(){
  // 실제 방문(다른 사람 홈) 또는 방문자 시점 미리보기(내 홈) — 둘 다 편집 UI를 잠근다.
  const realVisit = !!_mhViewingUserId;
  const visiting = realVisit || !!window._mhPreviewMode;
  /* 🛟 두 훅은 **서로 다른 파일**에 있다(myhome-desktop.js · mallang.js).
     맨몸으로 나란히 두면 앞줄이 던질 때 뒷줄이 아예 안 돈다 — 그러면 바탕화면 쪽 사고가
     "말랑이 폴더가 사라졌다"로 나타난다(open() 의 그 주석과 같은 병). 각자 감싼다. */
  // 🖥️ 마이홈 바탕화면 관람모드 연동 (myhome-desktop.js)
  try{ if(window._advApplyVisitUI) window._advApplyVisitUI(visiting, realVisit ? _mhViewingUserId : getMyUserId()); }
  catch(e){ console.error('[바탕화면] 관람모드 적용 실패', e); }
  // 🧸 말랑이: 실제 방문이면 그 집 주인 이미지로, 미리보기·내 집이면 내 것으로
  try{
    if(window._mallangApplyVisit){
      Promise.resolve(window._mallangApplyVisit(visiting, realVisit ? _mhViewingUserId : getMyUserId()))
        .catch(e=>console.error('[말랑이] 관람모드 적용 실패', e));
    }
  }catch(e){ console.error('[말랑이] 관람모드 적용 실패', e); }
  const badge=document.getElementById('mhVisitBadge'); if(badge) badge.style.display = realVisit?'inline':'none';
  const back=document.getElementById('mhBackHomeBtn');  if(back) back.style.display = realVisit?'inline':'none';
  const edit=document.getElementById('mhEditHomeBtn'); if(edit) edit.style.display = visiting?'none':'inline';
  const label=document.getElementById('mhTitleLabel');
  if(label){
    if(realVisit){
      label.textContent = '🏠 ' + _mhViewingDisplayName() + '의 마이홈';
    } else if(window._mhPreviewMode){ label.textContent = '👁 방문자 시점 미리보기'; }
    else label.textContent = '🏠 마이홈';
  }
  // 미리보기 종료 버튼 표시
  const prevExit=document.getElementById('mhPreviewExitBtn');
  if(prevExit) prevExit.style.display = window._mhPreviewMode ? 'inline' : 'none';
  const prevBtn=document.getElementById('mhPreviewBtn');
  if(prevBtn) prevBtn.style.display = (realVisit || window._mhPreviewMode) ? 'none' : 'inline';
  // 관람 모드에선 마이홈 본문의 편집 UI들을 잠금 — contenteditable, 스티커 추가, BGM 등록 등.
  document.querySelectorAll('#myHomeWin [contenteditable]').forEach(el=>{ el.setAttribute('contenteditable', visiting?'false':'true'); el.style.opacity = visiting?'0.85':''; });
  const stickerAdd=document.getElementById('mhStickerAddBtn'); if(stickerAdd) stickerAdd.style.display = visiting?'none':'';
  // 👀 스케줄러 입력 UI — 관람 중 숨김 (일정 입력창/추가/공개 체크/친구 태그)
  ['mhSchedInput','mhSchedAddBtn','mhSchedTagBtn','mhSchedTagInfo'].forEach(sid=>{
    const el=document.getElementById(sid); if(el) el.style.display = visiting?'none':'';
  });
  const pubChkEl=document.getElementById('mhSchedPublic');   // label로 감싸져 있어 label째 숨김
  if(pubChkEl && pubChkEl.closest('label')) pubChkEl.closest('label').style.display = visiting?'none':'';
  const bgmSet=document.getElementById('mhBgmSet'); if(bgmSet) bgmSet.style.display = visiting?'none':'';
  // 스티커 삭제 버튼도 숨김
  document.querySelectorAll('.mh-sticker-del').forEach(el=>{ el.style.display = visiting?'none':''; });
  // 아바타 변경 버튼(있으면) 잠금
  const avatarBtn=document.getElementById('mhAvatarChangeBtn'); if(avatarBtn) avatarBtn.style.display = visiting?'none':'';
  /* 🏷️ 닉네임 「수정」 링크 — 편집 중이면 관람이 아니어도 계속 숨긴다(입력칸이 그 자리를 쓰고 있다).
     관람으로 넘어갔다면 열려 있던 입력칸을 **취소로** 접는다.
     ⚠️ 값을 비우고 blur 하면 안 된다 — blur 는 저장 경로라 그 순간 이름이 '나' 로 덮인다.
        반드시 _mhCancelNameEdit(취소 깃발을 세우고 접는 길)을 쓸 것. */
  if(visiting && typeof window._mhCancelNameEdit==='function') window._mhCancelNameEdit();
  const nameEditLink=document.getElementById('mhNameEditLink');
  if(nameEditLink) nameEditLink.style.display = (visiting || document.getElementById('mhMyNameInput')) ? 'none' : '';
  // 관람 중엔 리치텍스트 툴바(B/I/폰트/색/IMG/URL 등) 자체를 숨김 — 어차피 편집 불가.
  document.querySelectorAll('.mh-rt-toolbar').forEach(t=>{ t.style.display = visiting?'none':''; });
  // 프로필 사진 클릭으로 파일 다이얼로그가 뜨는 것도 관람 중엔 막음
  const avatarBig=document.getElementById('mhAvatarBig'); if(avatarBig) avatarBig.style.pointerEvents = visiting?'none':'';
  // 게시글 제목 편집 툴팁도 관람 중엔 감춤 — 실제 편집도 _mhBeginPostTitleEdit 에서 가드됨
  const postTitle=document.getElementById('mhPostTitle');
  if(postTitle){
    postTitle.title = visiting ? '' : '더블클릭해서 제목 수정';
    postTitle.style.cursor = visiting ? 'default' : '';
  }
  // ✏️ 제목 수정 버튼 — 관람·미리보기 중엔 숨김(다른 편집 UI 와 같은 기준)
  const postTitleEdit=document.getElementById('mhPostTitleEditBtn');
  if(postTitleEdit) postTitleEdit.style.display = visiting ? 'none' : '';
}
window.openFriendHomeView = openFriendHomeView;

return {
  _mhApplyVisitUI,
  _mhHomeFromServer,
  _mhViewingDisplayName,
  _mhViewingUserId: ()=>_mhViewingUserId,   // 읽는 함수
  _myHomeData: ()=>_myHomeData,   // 읽는 함수
  setMyHomeData: (v)=>{ _myHomeData = v; },   // 쓰는 함수 — app.js 가 비운다
  _myHomeLoaded: ()=>_myHomeLoaded,   // 읽는 함수
  setMyHomeLoaded: (v)=>{ _myHomeLoaded = v; },   // 쓰는 함수 — app.js 가 비운다
  _myHomeUid: ()=>_myHomeUid,   // 읽는 함수
  setMyHomeUid: (v)=>{ _myHomeUid = v; },   // 쓰는 함수 — app.js 가 비운다
  closeFriendHomeView,
  openFriendHomeView,
};
}

const api = { createMyHomeVisit };
if(typeof window !== 'undefined') window.TwMyHomeVisit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
