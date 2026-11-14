/* admin-notice.js — 📣 확성기 공지 · 📰 업데이트 공지 편집 (관리자)
   관리자가 쓰는 공지 두 가지의 화면. 서버에 쓰는 일은 admin-api.js(adminApi)가 한다 — 여기는 입력 확인 · 잠금 · 알림만.
   사용자가 보는 쪽(앱을 켤 때 업데이트 공지 팝업 _showUpdateNoticeOnce)은 app.js 에 있다.
   ★ 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다.
   deps: toast — 안내 토스트 · adminApi — 서버 길(admin-api.js) · apiErrors — 서버 오류 → 오류 번호(TwApiErrors.store)
   ⚠️ 보내는 중에는 같은 버튼을 다시 눌러도 요청이 하나만 나간다(busy). 실패하면 창을 닫지 않는다(쓴 글이 사라지지 않게).
   ⚠️ 업데이트 공지 창은 지금 공지를 받는 동안 입력 · 저장 · 내리기를 잠근다 — 늦게 온 값이 쓰던 글을 덮지 않게(열 때마다 openGen +1 — 닫고 다시 열면 옛 답은 버림).
     못 받으면 «내리기» 는 가리킬 id 가 없어 잠긴 채고, 새 공지 올리기는 된다. 내리기는 창에서 본(또는 방금 올린) 공지의 id 로 요청 한 번.
   ⚠️ document · window · confirm 은 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminNotice — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-notice.js */
(function(){

function createAdminNotice(deps){
const toast = deps.toast;
const adminApi = deps.adminApi;
const apiErrors = deps.apiErrors;
const $ = (id)=>document.getElementById(id);
const fail = (e)=>{ apiErrors.notify(e, adminApi.ERRORS); };
const hide = (id)=>{ const o=$(id); o.classList.remove('on'); o.style.display='none'; };
let busy = false;   // 서버에 보내는 중 — 확성기 · 업데이트 공지 버튼이 같이 쓴다(한 번에 하나)
async function exclusive(job){
  if(busy) return;
  busy = true;
  try{ await job(); } finally { busy = false; }
}

// 런처5 — 확성기 공지 (관리자 전용)
$('lcAnnounce').onclick=()=>{
  const o=$('announceOverlay'); if(!o) return;
  o.classList.add('on'); o.style.display='flex';
  $('announceInput').value='';
  setTimeout(()=>$('announceInput').focus(), 30);
};
$('announceCloseBtn').onclick=()=>hide('announceOverlay');
$('announceSendBtn').onclick=()=>exclusive(async ()=>{
  const t=$('announceInput').value.trim();
  if(!t){ toast('공지 문구를 입력해주세요'); return; }
  try{
    await adminApi.announce(t);
    toast('공지를 발송했어요 (1분간 표시)');
    hide('announceOverlay');
  } catch(e){ fail(e); }
});
$('announceClearBtn').onclick=()=>exclusive(async ()=>{
  try{ await adminApi.clearAnnouncement(); toast('공지를 종료했어요'); }
  catch(e){ fail(e); }
});

// 📰 업데이트 공지 (관리자 편집 + 유저 팝업)
/* 창이 보여 주는 공지 — 받아서 채운 것 · 방금 올린 것. «내리기» 는 이 id 로만 내린다(그 사이 다른 관리자가 올린 새 공지를 잘못 내리지 않게). */
let load = 'idle';      // 'idle' | 'loading' | 'ready' | 'failed'
let shownId = null;     // 창이 가리키는 공지 id — 없으면 «내리기» 잠금
let openGen = 0;        // 창을 열 때마다 +1 — 늦게 온 옛 받기 답이 폼을 덮거나 잠금을 풀지 않게
const lockForm = (on)=>{ for(const id of ['updateNoticeTitle', 'updateNoticeBody', 'updateNoticeSaveBtn']) $(id).disabled = on; };
const syncClear = ()=>{ $('updateNoticeClearBtn').disabled = (load === 'loading' || shownId == null); };
const closeUpdate = ()=>{ openGen++; hide('updateNoticeAdminOverlay'); };
$('lcUpdateNotice').onclick=async ()=>{
  const o=$('updateNoticeAdminOverlay'); if(!o) return;
  o.classList.add('on'); o.style.display='flex';
  // 지금 공지가 있으면 폼에 미리 채워서 수정 가능하게 — 받는 동안은 잠근다
  const gen = ++openGen;
  load = 'loading'; shownId = null;
  lockForm(true); syncClear();
  let cur = null, ok = false;
  try{ cur = await adminApi.currentUpdateNotice(); ok = true; }
  catch(e){ if(gen === openGen) fail(e); }
  if(gen !== openGen) return;   // 그 사이 닫았거나 다시 열었다 — 옛 답은 버린다
  $('updateNoticeTitle').value = cur ? cur.title : '';
  $('updateNoticeBody').value = cur ? cur.body : '';
  shownId = cur ? cur.id : null;
  load = ok ? 'ready' : 'failed';
  lockForm(false); syncClear();   // 못 받았으면 shownId 가 없어 «내리기» 는 잠긴 채 — 새 공지 올리기는 된다
  setTimeout(()=>$('updateNoticeTitle').focus(), 30);
};
$('updateNoticeAdminCloseBtn').onclick=closeUpdate;
$('updateNoticeSaveBtn').onclick=()=>exclusive(async ()=>{
  const title=$('updateNoticeTitle').value.trim();
  const body=$('updateNoticeBody').value.trim();
  if(!title || !body){ toast('제목과 본문을 모두 입력해주세요'); return; }
  try{
    const id = await adminApi.publishUpdateNotice(title, body);
    shownId = id; syncClear();
    toast('공지를 발행했어요 (유저가 앱을 켤 때 자동 팝업)');
    closeUpdate();
  } catch(e){ fail(e); }
});
$('updateNoticeClearBtn').onclick=()=>exclusive(async ()=>{
  const id = shownId;
  if(id == null) return;
  if(!confirm('현재 업데이트 공지를 삭제할까요?')){ window.focus(); return; } window.focus();
  try{
    await adminApi.withdrawUpdateNotice(id);   // 창에서 본 공지를 id 로 한 번에 내린다 — 이미 내려갔으면 서버가 «없음»(E-ADM-03)
    shownId = null; syncClear();
    $('updateNoticeTitle').value = '';
    $('updateNoticeBody').value = '';
    toast('공지를 삭제했어요');
  }catch(e){ fail(e); }
});

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminNotice };
if(typeof window !== 'undefined') window.TwAdminNotice = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
