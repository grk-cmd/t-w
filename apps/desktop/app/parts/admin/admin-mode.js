/* admin-mode.js — 🔐 관리자 모드 진입 · 비밀번호 창 · Ctrl+E 끄기 · 관리자 버튼 보이기 · Ctrl(맥 ⌘)+클릭 진입 (관리자)
   app.js «🔐 라이선스 · 초대 게이트 시작 · 관리자 모드 진입» 의 뒤쪽(관리자 모드)과 «📨 라이선스 요청 · 관리자 비밀번호 모달» 의 비밀번호 창 연결을
   그대로 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 7번 — docs/APP_FSD_MAP.md). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(두 덩이를 원래 차례로 · 사이에 빈 줄 하나). 바뀐 줄은 6줄 —
     isAdmin 은 이름() 으로 읽고 isAdmin = … 은 setIsAdmin(…) 으로. app.js 의 let 이라 값이 아니라 읽는 함수 · 쓰는 함수로 받는다.
   ★ 이 모듈이 isAdmin 을 바꾸는 단 한 곳이다(켜기 · 끄기). 권한의 진짜 근거는 서버다 — 비밀번호가 맞고 로그인이 있어도 서버가 이 계정을
     관리자로 알아야(GET /v2/admin/admins/me) 켠다. 아니면 «모드는 켜졌는데 저장이 전부 403» 이 된다.
   ★ 밖에서 부르는 이름은 refreshAdminVisibility 하나 — 부팅 때 관리자 전용 UI 를 숨길 때 app.js 가 부른다. 세션이 끝나면 app-boot 의 adminMode 칸이 NAV.ADMIN_EXIT 로 알려 모드를 조용히 끈다.
   ⚠️ document · window · companion · crypto · TextEncoder · hotkeyLetter(key-input.js) · navigator 는 예전처럼 전역 이름으로 쓴다
     (이 파일은 app.js 앞 · key-input.js 뒤에 싣는 classic script).
   deps: session — 켜는 차례의 세션(appBoot.getSession) · identity — 로그인 흐름의 { email, uid } · twNav — 창 열기 통로(shared/nav.js) · adminApi — 서버 길(admin-api.js, 켜기 전 관리자 확인) · apiErrors — 서버 오류 → 오류 번호(TwApiErrors.store)
   ⚠️ 전역 이름은 TwAdminMode — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-mode.js */
(function(){

/* 세션이 끝날 때 관리자 창을 닫으라고 알리는 문서 이벤트 이름 — 이름은 여기 한 곳(TwAdminMode.EXIT_EVENT). 관리자 모듈은 이 이름으로 듣는다 */
const EXIT_EVENT = 'tw-admin-exit';

function createAdminMode(deps){
const toast = deps.toast;
const refreshInviteBtn = deps.refreshInviteBtn;   // 🎟️ 관리자는 초대장 무제한 — 버튼 표시 다시
const ADMIN_PASS_HASH = deps.adminPassHash;       // 비밀번호 SHA-256(앞에서 선언한 const)
const isAdmin = deps.isAdmin;                     // 읽는 함수 — 관리자 모드(app.js 의 let)
const setIsAdmin = deps.setIsAdmin;               // 쓰는 함수 — 켜기 · 끄기는 여기서만
const twNav = deps.twNav;                         // 창 열기 통로 — 세션이 끝나면 app-boot 표가 NAV.ADMIN_EXIT 로 알린다(서로를 모르게 — 순환 없이)
const adminApi = deps.adminApi;
const apiErrors = deps.apiErrors;
let checking = false;                              // 서버에 관리자 확인 중 — 확인 버튼을 또 눌러도 한 번
let gen = 0;                                       // 세션이 끝날 때마다 +1 — 확인 중에 세션이 끝났으면 늦게 온 답을 버린다
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
     [왜 여기에] 서버 규칙이 보는 것은 이 uid 하나다. 관리자를 한 명 더 등록할 때도 운영자가 이 값을
       서버의 관리자 표(admin)에 넣으므로, 확인하려고 개발자도구를 열 일이 없어진다. */
  const line = document.getElementById('adminAuthLine');
  if(line){
    const idn = _identity(), uid = _signedIn() ? idn.uid : null;
    if(uid){
      const mail = idn.email || '';
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
/* 로그인 여부는 켜는 차례의 세션(appBoot.getSession)으로 본다 — 세션이 살아 있어야 «로그인된 계정». 보여 줄 uid · 메일은 로그인 흐름의 identity 로 */
function _signedIn(){ try{ const s = deps.session(); return !!(s && s.alive()); }catch(_){ return false; } }
function _identity(){ try{ return deps.identity() || {}; }catch(_){ return {}; } }
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
         [왜] 실제 권한은 서버가 로그인 토큰의 uid 로 판정한다. 로그인이 없으면 저장이
           전부 거부되는데, 관리자 모드만 켜지면 화면에는 버튼이 다 보인다 — 파츠를 등록하고
           "됐겠지" 하고 창을 닫는 사고가 여기서 난다. 화면과 실제 권한을 어긋나지 않게 맞춘다.
         ⚠️ 이건 **편의를 위한 확인이지 보안이 아니다.** 이 검사는 우회할 수 있고, 막는 것은
           어디까지나 서버다. 여기를 강화한다고 서버 쪽을 느슨하게 하지 말 것. */
      if(!_signedIn()){
        err.innerHTML = '구글 로그인이 필요해요<br>프로그램 설정 › 내 계정에서 로그인해 주세요';
        err.style.display='block';
        return;
      }
      /* 🛡️ 서버가 이 계정을 관리자로 아는가 — 모르면 켜지 않는다(켜 봐야 모든 저장이 403). 닿지 못했을 때도 켜지 않는다: 권한을 확인하지 못했다. */
      if(checking) return;
      checking = true;
      const g = gen;
      try{ await adminApi.me(); }
      catch(e){
        if(g !== gen) return;   // 확인 중에 세션이 끝났다 — 다음 계정 창에 까닭을 띄우지 않는다
        const t = apiErrors.notify(e, adminApi.ERRORS);
        err.textContent = (t.code === 'ACCESS_DENIED') ? '이 계정은 관리자로 등록돼 있지 않아요' : '서버에서 관리자 권한을 확인하지 못했어요';
        err.style.display='block';
        return;
      }
      finally{ if(g === gen) checking = false; }
      if(g !== gen) return;   // 확인 중에 세션이 끝났다 — 끝난 계정의 답으로 모드를 켜지 않는다
      setIsAdmin(true);
      document.body.classList.add('admin');
      if(window.companion && companion.setAdminMode) companion.setAdminMode(true);
      toast('관리자 모드 ON — Ctrl+E로 종료');
      refreshAdminVisibility();
      overlay.classList.remove('on'); overlay.style.display='none';
    } else {
      err.textContent='비밀번호가 틀려요'; err.style.display='block';
    }
  }catch(_){ err.textContent='비밀번호 확인 중 오류'; err.style.display='block'; }
}
/* 끄는 몸통 하나 — exitAdmin(Ctrl+E · 토스트) 과 reset(세션 끝 · 조용히)이 같이 부른다.
   모드를 끄고 관리자 창을 전부 닫는다(주인 모듈의 닫기 — 'tw-admin-exit')(세션이 끝났는데 앞 계정의 관리자 창이 다음 계정 화면에 남지 않게). */
function _closeAdminWindows(){
  /* 창마다 «주인의 닫기» 를 부른다 — 여기서 DOM 을 직접 건드리지 않는다(창마다 .on 클래스 · 인라인 display 로 여닫는 방식이 달라, 인라인 none 을 박으면 다시 안 열리는 창이 있다).
     각 관리자 모듈이 'tw-admin-exit' 를 듣고 자기 닫기로 닫는다. 비밀번호 창만 이 파일이 연다. */
  const o = document.getElementById('adminPassOverlay'); if(o){ o.classList.remove('on'); o.style.display = 'none'; }
  document.dispatchEvent(new Event(EXIT_EVENT));
  /* 표식(data-admin-win)이 달린 창이 아직 열려 있으면 숨기지 않고 알린다 — 주인 모듈이 이 신호를 안 듣는 것이다 */
  document.querySelectorAll('[data-admin-win]').forEach((w)=>{
    if(w.classList.contains('on') || w.style.display === 'flex' || w.style.display === 'block') console.warn('[관리자] 세션 끝 — 닫히지 않은 관리자 창: ' + (w.id || '?'));
  });
}
function _adminOff(announce){
  setIsAdmin(false);
  document.body.classList.remove('admin');
  if(window.companion && companion.setAdminMode) companion.setAdminMode(false);
  _closeAdminWindows();
  if(announce) toast('관리자 모드 OFF');
  refreshAdminVisibility();
}
function exitAdmin(){ _adminOff(true); }
/* 세션이 끝나면(로그아웃 · 계정 바꾸기 · 탈퇴) 관리자 모드를 조용히 끈다 — 토스트 없음.
   확인 중이던 요청의 답도 버린다(gen) — 끝난 계정의 답이 다음 계정의 모드를 켜지 못하게. */
function reset(){
  gen++;
  checking = false;
  if(!isAdmin()){ _closeAdminWindows(); return; }
  _adminOff(false);
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
  window.refreshWardrobe();
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

twNav.on(twNav.NAV.ADMIN_EXIT, reset);   // 세션이 끝나면 모드를 끈다

return { refreshAdminVisibility };   // 부팅 때 관리자 전용 UI 숨기기
}

const api = { createAdminMode, EXIT_EVENT };
if(typeof window !== 'undefined') window.TwAdminMode = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
