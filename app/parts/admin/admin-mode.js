/* admin-mode.js — 🔐 관리자 모드 진입 · 비밀번호 창 · Ctrl+E 끄기 · 관리자 버튼 보이기 · Ctrl(맥 ⌘)+클릭 진입 (관리자)
   app.js «🔐 라이선스 · 초대 게이트 시작 · 관리자 모드 진입» 의 뒤쪽(관리자 모드)과 «📨 라이선스 요청 · 관리자 비밀번호 모달» 의 비밀번호 창 연결을
   그대로 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 7번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(두 덩이를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 6줄 —
     isAdmin 은 이름() 으로 읽고 isAdmin = … 은 setIsAdmin(…) 으로, savedParts 는 이름() 으로. 둘 다 app.js 의 let 이고(isAdmin 은
     이 모듈이 바꾸는 값 · savedParts 는 뒤에서 선언되고 다시 대입) 값이 아니라 읽는 함수 · 쓰는 함수로 받는다. 자리는 파서로 찾았다.
   ★ 이 모듈이 isAdmin 을 바꾸는 단 한 곳이다(켜기 · 끄기). 권한의 진짜 근거는 서버 규칙(admins/$uid)이다 — 본문 주석 그대로.
   ★ 밖에서 부르는 이름은 refreshAdminVisibility 하나 — 부팅 때 관리자 전용 UI 를 숨길 때 app.js 가 adminMode.refreshAdminVisibility 로 부른다.
   ⚠️ document · window · companion · firebaseAPI · crypto · TextEncoder · hotkeyLetter(key-input.js) · navigator 는 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞 · key-input.js 뒤에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminMode — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-mode.js */
(function(){

function createAdminMode(deps){
const toast = deps.toast;
const refreshInviteBtn = deps.refreshInviteBtn;   // 🎟️ 관리자는 초대장 무제한 — 버튼 표시 다시
const ADMIN_PASS_HASH = deps.adminPassHash;       // 비밀번호 SHA-256(앞에서 선언한 const)
const isAdmin = deps.isAdmin;                     // 읽는 함수 — 관리자 모드(app.js 의 let)
const setIsAdmin = deps.setIsAdmin;               // 쓰는 함수 — 켜기 · 끄기는 여기서만
const savedParts = deps.savedParts;               // 읽는 함수 — 카탈로그 파츠(뒤에서 선언 · 다시 대입되는 let)
async function _sha256Hex(s){
  /* ★ 실패하면 null — 계정 이전 쪽 같은 이름 함수(뒤에 있어 이기고 있던 판)와 동작을 맞췄다(개정 16 에서 그쪽을 걷음). */
  try{
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){ return null; }
}
function tryEnterAdmin(){
  const overlay=document.getElementById('adminPassOverlay');
  const input=document.getElementById('adminPassInput');
  const err=document.getElementById('adminPassErr');
  if(!overlay) return;
  err.style.display='none'; input.value='';
  /* 🔑 지금 어느 계정으로 로그인돼 있는지 먼저 보여준다.
     [왜 여기에] 서버 규칙이 보는 것은 이 uid 하나다. 관리자를 한 명 더 등록할 때도 이 값을
       콘솔의 admins 노드에 넣으면 되므로, 확인하려고 개발자도구를 열 일이 없어진다. */
  const line = document.getElementById('adminAuthLine');
  if(line){
    const uid = _myAuthUid();
    if(uid){
      let mail = '';
      try{ mail = (firebaseAPI.authCurrentEmail && firebaseAPI.authCurrentEmail()) || ''; }catch(_){}
      line.textContent = '로그인됨' + (mail ? ' · ' + mail : '') + '\nuid ' + uid;
      line.style.whiteSpace = 'pre-line';
      line.style.color = 'var(--ink-soft)';
    } else {
      line.textContent = '⚠ 로그인 안 됨 — 프로그램 설정 › 내 계정에서 구글 로그인이 필요해요';
      line.style.whiteSpace = '';
      line.style.color = 'var(--win-error)';
    }
  }
  overlay.classList.add('on'); overlay.style.display='flex';
  setTimeout(()=>input.focus(), 50);
}
/* 🔑 이 기기의 Firebase 로그인 uid — 관리자 권한의 **진짜 근거**다.
   ⚠️ getMyUserId() 와 헷갈리지 말 것. 그쪽은 localStorage 에 저장되는 앱 자체 id 라 누구나
     자기 값을 바꿔 넣을 수 있고, 방 멤버 노드에 실려 남들에게도 보인다. 권한에 쓸 수 없다. */
function _myAuthUid(){
  try{ return (window.firebaseAPI && firebaseAPI.authCurrentUid) ? firebaseAPI.authCurrentUid() : null; }
  catch(_){ return null; }
}
async function _submitAdminPass(){
  const input=document.getElementById('adminPassInput');
  const err=document.getElementById('adminPassErr');
  const overlay=document.getElementById('adminPassOverlay');
  const pass=input.value;
  if(!pass) return;
  try{
    const h = await _sha256Hex(pass);
    if(h === ADMIN_PASS_HASH){
      /* 🔐 비밀번호가 맞아도 **구글 로그인이 없으면 켜지 않는다.**
         [왜] 실제 권한은 서버 규칙(admins/$uid)이 auth.uid 로 판정한다. 로그인이 없으면 저장이
           전부 거부되는데, 관리자 모드만 켜지면 화면에는 버튼이 다 보인다 — 파츠를 등록하고
           "됐겠지" 하고 창을 닫는 사고가 여기서 난다. 화면과 실제 권한을 어긋나지 않게 맞춘다.
         ⚠️ 이건 **편의를 위한 확인이지 보안이 아니다.** 이 검사는 우회할 수 있고, 막는 것은
           어디까지나 규칙이다. 여기를 강화한다고 서버 쪽을 느슨하게 하지 말 것. */
      if(!_myAuthUid()){
        err.innerHTML = '구글 로그인이 필요해요<br>프로그램 설정 › 내 계정에서 로그인해 주세요';
        err.style.display='block';
        return;
      }
      setIsAdmin(true);
      document.body.classList.add('admin');
      if(window.companion && companion.setAdminMode) companion.setAdminMode(true);
      toast('관리자 모드 ON — Ctrl+E로 종료');
      refreshAdminVisibility();
      overlay.classList.remove('on'); overlay.style.display='none';
      /* 🎰 이관 과도기 — 카탈로그 첫 스냅샷이 이미 지나간 뒤에 관리자가 됐을 수 있다.
         옛 경로 표식(_legacyGacha)이 로컬 목록에 남아 있으면 여기서도 한 번 옮긴다. */
      if(!window.__gachaMigrated && window.firebaseAPI && window.firebaseAPI.migrateGachaCatalog
         && savedParts().some(p=>p && p._legacyGacha)){
        window.__gachaMigrated = true;
        window.firebaseAPI.migrateGachaCatalog()
          .then(r=>{ if(r && r.moved && r.moved.length) toast('🎰 가챠 파츠 '+r.moved.length+'개를 새 카탈로그 경로로 옮겼어요 (구버전 노출 차단)'); })
          .catch(()=>{ window.__gachaMigrated = false; });
      }
    } else {
      err.textContent='비밀번호가 틀려요'; err.style.display='block';
    }
  }catch(_){ err.textContent='비밀번호 확인 중 오류'; err.style.display='block'; }
}
function exitAdmin(){
  setIsAdmin(false);
  document.body.classList.remove('admin');
  if(window.companion && companion.setAdminMode) companion.setAdminMode(false);
  toast('관리자 모드 OFF');
  refreshAdminVisibility();
}
// 관리자 모드 표시는 배지(클릭 버튼) 대신 Ctrl+E 단축키로 종료 — run 모드 클릭통과와 충돌하지 않게.
document.addEventListener('keydown', e=>{
  if(isAdmin() && e.ctrlKey && hotkeyLetter(e)==='e'){ e.preventDefault(); exitAdmin(); }
});
/* 관리자 전용 UI 표시 토글 — DOM에 .admin-only 클래스가 있으면 isAdmin일 때만 보임 */
function refreshAdminVisibility(){
  /* 표시 여부의 기본값은 CSS(body:not(.admin) .admin-only)가 잡는다 — JS가 죽어도 안 드러나게.
     여기서는 관리자 모드가 켜지고 꺼질 때 인라인 값을 맞춰줄 뿐이다.
     ⚠️ isAdmin일 때 '' 로 지우는 게 맞다. 'block' 같은 값을 박으면 버튼(inline-block)·구분점(inline)이
       전부 줄바꿈되어 런처 하단이 세로로 길어진다. */
  document.querySelectorAll('.admin-only').forEach(el=>{
    el.style.display = isAdmin() ? '' : 'none';
  });
  // 꾸미기 패널이 열려 있으면 등록/삭제 버튼 표시가 바뀌므로 다시 렌더
  if(typeof window.refreshWardrobe==='function') window.refreshWardrobe();
  // 🎟️ 관리자는 초대장 무제한 — 버튼 표시도 그에 맞게 갱신
  refreshInviteBtn();
}
/* 진입 트리거: Ctrl + ("후원" 또는 "캐릭터 생성" 또는 🎨 꾸미기 또는 광고배너) **한 번** 클릭
   [왜 5연타를 걷었나] 연타는 "비밀번호 창이 뜨는 것 자체"를 숨기려는 장치였다. 그런데 이제
     실제 권한은 서버 규칙(admins/$uid)이 쥐고 있어서, 창이 떠도 로그인 없이는 아무것도 못 한다.
     숨길 이유가 사라진 자리에 남은 건 관리자 본인의 불편(연타가 안 먹혀 몇 번씩 다시 시도)뿐이라
     Ctrl+클릭 한 번으로 줄인다.
   ★ Ctrl 을 누른 클릭은 기본 동작(생성창·꾸미기 열기)을 반드시 막는다 — 안 막으면 비밀번호 창
     뒤로 그 창들이 같이 열린다.
   ★ 캐릭터 생성 버튼이 비활성화(슬롯 꽉 참)되면 클릭 이벤트 자체가 안 나가므로, 항상 클릭
     가능한 후원 버튼·광고배너도 함께 받는다. */
(function bindAdminTrigger(){
  // Windows 에서 metaKey 는 Win 키다. Win 키와 같이 누른 클릭으로 열리지 않게 Meta 는 Mac 에서만 받는다.
  const isMac = /Mac/i.test(navigator.platform || '');
  document.addEventListener('click', e=>{
    if(isAdmin()) return;
    if(!(e.ctrlKey || (isMac && e.metaKey))) return;
    const target = e.target.closest && (e.target.closest('#lcDonateBtn') || e.target.closest('#lcCreate') || e.target.closest('#myWardrobeBtn') || e.target.closest('#lcAdBanner'));
    if(!target) return;
    e.preventDefault();
    e.stopPropagation();
    tryEnterAdmin();
  }, true);   // capture 단계에서 가로채기 — 일반 클릭 핸들러보다 먼저
})();

/* --- 관리자 비밀번호 모달 바인딩 --- */
document.getElementById('adminPassOk').onclick=_submitAdminPass;
document.getElementById('adminPassCancel').onclick=()=>{
  const o=document.getElementById('adminPassOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('adminPassInput').addEventListener('keydown', e=>{ if(e.key==='Enter') _submitAdminPass(); });

return { refreshAdminVisibility };   // 부팅 때 관리자 전용 UI 숨기기
}

const api = { createAdminMode };
if(typeof window !== 'undefined') window.TwAdminMode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
