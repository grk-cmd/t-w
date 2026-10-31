/* admin-notice.js — 📣 확성기 공지 · 📰 업데이트 공지 편집 (관리자)
   app.js 의 «🛠️ 라이선스 발급 · 공지 · 업데이트 안내(관리자)» 가운데 관리자가 쓰는 공지 두 가지를 그대로 옮긴 관리자 모듈이다
   (관리자 코드 admin 폴더 3번). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다. 사용자가 보는 쪽(앱을 켤 때 업데이트 공지 팝업 _showUpdateNoticeOnce)은 app.js 에 남겼다.
   ★ 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다.
   검사: checks/sim-admin-license.js(관리자 3번 셋을 같이 본다)
   ⚠️ document · window · firebaseAPI · confirm · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminNotice — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminNotice(deps){
const toast = deps.toast;
// 런처5 — 확성기 공지 (관리자 전용)
document.getElementById('lcAnnounce').onclick=()=>{
  const o=document.getElementById('announceOverlay'); if(!o) return;
  o.classList.add('on'); o.style.display='flex';
  document.getElementById('announceInput').value='';
  setTimeout(()=>document.getElementById('announceInput').focus(), 30);
};
document.getElementById('announceCloseBtn').onclick=()=>{
  const o=document.getElementById('announceOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('announceSendBtn').onclick=async ()=>{
  const t=document.getElementById('announceInput').value.trim();
  if(!t){ toast('공지 문구를 입력해주세요'); return; }
  if(!(window.firebaseAPI && firebaseAPI.publishAnnounce)){ toast('네트워크 연결을 확인해 주세요'); return; }
  try{
    await firebaseAPI.publishAnnounce(t, 60000);   // 1분
    toast('공지를 발송했어요 (1분간 표시)');
    const o=document.getElementById('announceOverlay'); o.classList.remove('on'); o.style.display='none';
  } catch(e){ toast('발송 실패 — 다시 시도해주세요'); }
};
document.getElementById('announceClearBtn').onclick=async ()=>{
  if(!(window.firebaseAPI && firebaseAPI.clearAnnounce)){ toast('네트워크 연결을 확인해 주세요'); return; }
  try{ await firebaseAPI.clearAnnounce(); toast('공지를 종료했어요'); }
  catch(e){ toast('종료 실패'); }
};

// 📰 업데이트 공지 (관리자 편집 + 유저 팝업)
document.getElementById('lcUpdateNotice').onclick=async ()=>{
  const o=document.getElementById('updateNoticeAdminOverlay'); if(!o) return;
  o.classList.add('on'); o.style.display='flex';
  // 현재 공지가 있으면 폼에 미리 채워서 수정 가능하게
  if(window.firebaseAPI && firebaseAPI.getUpdateNotice){
    try{
      const cur = await firebaseAPI.getUpdateNotice();
      document.getElementById('updateNoticeTitle').value = cur ? (cur.title||'') : '';
      document.getElementById('updateNoticeBody').value = cur ? (cur.body||'') : '';
    }catch(_){}
  }
  setTimeout(()=>document.getElementById('updateNoticeTitle').focus(), 30);
};
document.getElementById('updateNoticeAdminCloseBtn').onclick=()=>{
  const o=document.getElementById('updateNoticeAdminOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('updateNoticeSaveBtn').onclick=async ()=>{
  const title=document.getElementById('updateNoticeTitle').value.trim();
  const body=document.getElementById('updateNoticeBody').value.trim();
  if(!title || !body){ toast('제목과 본문을 모두 입력해주세요'); return; }
  if(!(window.firebaseAPI && firebaseAPI.publishUpdateNotice)){ toast('네트워크 연결을 확인해 주세요'); return; }
  try{
    await firebaseAPI.publishUpdateNotice(title, body);
    toast('공지를 발행했어요 (유저가 앱을 켤 때 자동 팝업)');
    const o=document.getElementById('updateNoticeAdminOverlay'); o.classList.remove('on'); o.style.display='none';
  } catch(e){ toast('발행 실패 — 다시 시도해주세요'); }
};
document.getElementById('updateNoticeClearBtn').onclick=async ()=>{
  if(!confirm('현재 업데이트 공지를 삭제할까요?')){ window.focus(); return; } window.focus();
  if(!(window.firebaseAPI && firebaseAPI.clearUpdateNotice)){ toast('네트워크 연결을 확인해 주세요'); return; }
  try{
    await firebaseAPI.clearUpdateNotice();
    document.getElementById('updateNoticeTitle').value = '';
    document.getElementById('updateNoticeBody').value = '';
    toast('공지를 삭제했어요');
  }catch(e){ toast('삭제 실패'); }
};

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminNotice };
if(typeof window !== 'undefined') window.TwAdminNotice = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
