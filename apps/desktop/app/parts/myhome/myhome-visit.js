/* myhome-visit.js — 🏠 마이홈 2단계 — 👀 친구 홈 구경(openFriendHomeView · closeFriendHomeView)
   app.js «🏠 마이홈 2단계 — 내 마이홈 데이터(_myHomeData) · 👀 친구 홈 구경(openFriendHomeView · closeFriendHomeView)» 구역을 옮긴 모듈이다(앱 FSD 44번). 받기 · 구경 상태는 myhome-store.js(D2-2).
   화면 동작은 옮기기 전과 같고, 내 홈 · 친구 홈 받기와 «돌아오기» 는 상태 주인(store.openView · closeView · pullMine)이 한다(내 홈 백업 · 복원 없음).
   ★ _myHomeFriends · myHomeOpen 는 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setMyHomeOpen(…).
     스케줄러(달력 · 디데이)는 mhScheduler.startVisit(친구) · endVisit() 하나씩 — 받기 · 끊기는 스케줄러가 한다.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 마이홈 공용 상태(지금 그리는 페이지 · 관람 중 uid · 이름)는 myhome-state.js 가 store 를 비추는 읽는 함수로 내놓는다(모듈 순환 끊기 4) — 쓰는 함수는 없다.
   ★ 밖에서 부르는 이름: _mhApplyVisitUI · closeFriendHomeView · openFriendHomeView — app.js 는 mhVisitMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomeVisit — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-visit.js */
(function(){

function createMyHomeVisit(deps){
const _myHomeFriends = deps._myHomeFriends;   // 읽는 함수
const applyDesktopRunClass = deps.applyDesktopRunClass;
const getMyUserId = deps.getMyUserId;
const loadMyHomePage = deps.loadMyHomePage;
const mallangMod = deps.mallangMod;   // 🧸 말랑이(mallang.js) — 집을 옮기면 그 집 말랑이로
const mhScheduler = deps.mhScheduler;
const myHomeOpen = deps.myHomeOpen;   // 읽는 함수
const renderMyHomePage = deps.renderMyHomePage;
const toast = deps.toast;
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판(myhome-hooks.js) — 닉네임 입력칸 취소는 편집 묶음이 열 때만 건다
const setMyHomeOpen = deps.setMyHomeOpen;   // 쓰는 함수
const _mhViewingUserId = deps._mhViewingUserId;   // 읽는 함수
const _mhViewingName = deps._mhViewingName;   // 읽는 함수
const _mhViewingDisplayName = deps._mhViewingDisplayName;
const myhomeStore = deps.myhomeStore;   // 🏠 상태 주인(myhome-store.js) — 구경 받기 · 닫기
const fetchCards = deps.fetchCards;   // (codes) → Promise<{ code: 명함 }> — 이름을 모르는 사람 이름 한 줄(D3 social-api.js)
const refreshFriendProfile = deps.refreshFriendProfile;   // (fid) → Promise<bool> — 친구면 이름 · 레벨을 새로 읽어 목록에 얹는다(friends-sub.js)
async function openFriendHomeView(friendId, nameHint){
  if(!friendId || friendId===getMyUserId()) return;
  /* 그 집 페이지 + 바탕화면을 한 번에 받는다 — 못 받으면 지금 보던 집 그대로(E-MH-21 은 store 가 띄운다) · 없는 사람은 서버 문구 안내.
     집을 빨리 옮겨도 늦게 온 앞 집 답은 store 의 gen 이 버린다. */
  try{ if(mhHooks.has(mhHooks.HOOK.FINISH_ARRANGE)) mhHooks.call(mhHooks.HOOK.FINISH_ARRANGE); }catch(_){}   // 폴더를 옮기던 중이면 집을 옮기기 전에 내 배치로 저장(들어간 뒤엔 고치기가 잠겨 저장이 안 된다)
  const r = await myhomeStore.openView(friendId, nameHint);
  if(r !== 'ok') return;
  try{
    window._mhPreviewMode = false;   // 👁 미리보기 중이었으면 해제 (실제 방문으로 전환)
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
    applyDesktopRunClass();
    overlay.querySelectorAll('.mh-tab').forEach(t=>t.classList.toggle('on', t.dataset.tab==='home'));
    overlay.querySelectorAll('.mh-page').forEach(p=>p.classList.toggle('on', p.id==='mhPageHome'));
    _mhApplyVisitUI();
    renderMyHomePage();
    /* 🏷️ 이름은 받아 둔 것(목록 · 힌트)으로 먼저 그리고, 새로 받은 값이 다르면 바꾼다.
       · 친구면 그 친구 프로필만 한 번 새로 읽는다(friends-sub refreshProfile — 목록이 열려 있으면 이미 듣고 있어 읽지 않는다).
         목록은 이름을 실시간으로 듣는 게 «열려 있는 동안» 뿐이라, 닫힌 채 들어오면 목록의 이름이 옛것일 수 있다.
       · 친구가 아니고 이름도 모르면(힌트 없음) 프로필에서 이름 한 줄(명함 fetchCards — 서버 길).
       ⚠️ 조회가 끝나기 전에 다른 홈으로 넘어갔거나 관람을 닫았으면 결과를 버린다 —
          안 그러면 방금 나온 사람의 이름이 다음 화면에 뒤늦게 찍힌다. */
    const shownName = _mhViewingDisplayName();
    Promise.resolve(refreshFriendProfile ? refreshFriendProfile(friendId) : false).catch(()=>false).then(fresh=>{
      if(_mhViewingUserId() !== friendId) return;
      if(fresh){
        if(_mhViewingDisplayName() !== shownName){ _mhApplyVisitUI(); renderMyHomePage(); }
        return;
      }
      if(!_mhViewingName() && !(_myHomeFriends()[friendId] && _myHomeFriends()[friendId].name)){
        Promise.resolve(fetchCards([friendId])).then(cards=>{
          const n = cards && cards[friendId] && cards[friendId].name;
          if(_mhViewingUserId() !== friendId || !n) return;
          myhomeStore.setViewName(String(n));
          _mhApplyVisitUI(); renderMyHomePage();
        }).catch(()=>{});   // 이름을 모르면 «친구»(지금 폴백) · 번호 없음
      }
    });
    window._mhReSubscribeGuestbook();
    window._mhGbRefreshBadge();   // 관람 모드 → 자기 방명록 뱃지 숨김
    // 👀 스케줄러도 친구 것으로 — 달력(공개 일정만) + D-day(공개만)
    mhScheduler.startVisit(friendId);
  }catch(e){ console.warn('친구 마이홈 로드 실패', e); toast('불러오지 못했어요'); }
}
function closeFriendHomeView(){
  if(!_mhViewingUserId()) return;
  myhomeStore.closeView();   // 이름 힌트도 같이 비운다 — 내 홈은 사본 없이 그대로 있다(백업 · 복원 없음)
  /* 내 홈을 받은 적이 없거나 못 받았으면(방에서 곧장 친구 홈으로 들어온 세션) 지금 한 번 받는다 — 못 올린 고침이 있으면 store 가 받지 않는다. */
  if(myhomeStore.mine().load !== myhomeStore.LOAD.READY){
    Promise.resolve(loadMyHomePage()).catch(()=>{});
  }else{
    myhomeStore.pullMine({ site: 'quiet' });   // 돌아올 때 한 번(ETag) — 같으면 304 · 번호 없음(보던 값 그대로)
  }
  _mhApplyVisitUI();
  renderMyHomePage();
  window._mhReSubscribeGuestbook();
  window._mhGbRefreshBadge();   // 자기 홈 복귀 → 뱃지 다시 계산
  // 👀 스케줄러 원복 — 내 달력·내 D-day로
  mhScheduler.endVisit();
}
// 관람 모드 UI 갱신 — 타이틀 라벨/배지/버튼 + 편집 UI 잠금
function _mhApplyVisitUI(){
  // 실제 방문(다른 사람 홈) 또는 방문자 시점 미리보기(내 홈) — 둘 다 편집 UI를 잠근다.
  const realVisit = !!_mhViewingUserId();
  const visiting = realVisit || !!window._mhPreviewMode;
  /* 🛟 두 훅은 **서로 다른 파일**에 있다(myhome-desktop.js · mallang.js).
     맨몸으로 나란히 두면 앞줄이 던질 때 뒷줄이 아예 안 돈다 — 그러면 바탕화면 쪽 사고가
     "말랑이 폴더가 사라졌다"로 나타난다(open() 의 그 주석과 같은 병). 각자 감싼다. */
  // 🖥️ 마이홈 바탕화면 관람모드 연동 (myhome-desktop.js)
  try{ if(window._advApplyVisitUI) window._advApplyVisitUI(visiting, realVisit ? _mhViewingUserId() : getMyUserId()); }
  catch(e){ console.error('[바탕화면] 관람모드 적용 실패', e); }
  // 🧸 말랑이: 실제 방문이면 그 집 주인 이미지로, 미리보기·내 집이면 내 것으로
  try{
    Promise.resolve(mallangMod.applyVisit(visiting, realVisit ? _mhViewingUserId() : getMyUserId()))
      .catch(e=>console.error('[말랑이] 관람모드 적용 실패', e));
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
  if(visiting && mhHooks.has(mhHooks.HOOK.CANCEL_NAME_EDIT)) mhHooks.call(mhHooks.HOOK.CANCEL_NAME_EDIT);
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
  closeFriendHomeView,
  openFriendHomeView,
};
}

const api = { createMyHomeVisit };
if(typeof window !== 'undefined') window.TwMyHomeVisit = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
