/* admin-launcher.js — 🛑 전체 방 종료 · 🧹 유령 방 청소 · ⚙️ 게임 설정 · 📢 광고 배너 편집 (관리자 — 런처 관리자 줄의 단발 도구)
   서버에 쓰는 일은 admin-api.js(adminApi)가 한다(방 종료 · 배너). 사용자 쪽(광고 배너 그리기 · 게임 설정 구독)은 launcher/ad-banner.js.
   ★ 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다.
   deps: toast · asyncPrompt — 안내 · 입력 창 · isAdmin — 읽는 함수(app.js 의 let) · adminApi — 서버 길(admin-api.js) · apiErrors — 서버 오류 → 오류 번호(TwApiErrors.store)
   ⚠️ 배너의 원본은 서버다 — 열 때 서버에서 받아 채우고(받기 전에는 창을 안 연다), 저장은 읽은 판을 실어 보낸다. 다른 관리자가 먼저 고쳤으면(409)
     덮어쓰지 않고 지금 서버 값으로 다시 채우고 알린다. 이 PC 에는 사본을 남기지 않는다.
   ⚠️ ⚙️ 게임 설정(동물 해금 레벨)은 멈춰 있다 — 쓰는 길은 서버에 있으나(카탈로그 해금) 사용자 앱이 그 값을 아직 Firebase 에서 읽는다. 읽는 쪽이 서버로 옮겨 가면 이어서 켠다.
   ⚠️ 🧹 유령 방 청소는 아직 Firebase 방 노드를 훑는다(서버 쪽 대응 길이 없다 — 걷기 · 유지는 정해지면).
   ⚠️ document · window · firebaseAPI 는 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminLauncher — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-admin-users-launcher.js */
(function(){

function createAdminLauncher(deps){
const toast = deps.toast;
const asyncPrompt = deps.asyncPrompt;
const isAdmin = deps.isAdmin;                     // 읽는 함수 — 관리자 모드(다시 대입되는 let)
const adminApi = deps.adminApi;
const apiErrors = deps.apiErrors;
const fail = (e)=>apiErrors.notify(e, adminApi.ERRORS);
const GAME_CFG_PAUSED_TEXT = '⚙️ 게임 설정은 서버로 옮기는 중이라 지금은 바꿀 수 없어요';
{
  // ★ 점검용 — 전체 방 종료(관리자). 실수 방지를 위해 '종료'를 직접 입력해야 실행된다(모달이라 Electron 포커스 문제 없음).
  { const _car = document.getElementById('lcCloseAllRooms');
    let closing = false;   // 종료 요청 중 — 연타해도 한 번
    if(_car) _car.onclick = async ()=>{
      if(!isAdmin()){ toast('관리자만 사용할 수 있어요'); return; }
      if(closing) return;
      const typed = await asyncPrompt({
        title:'전체 방 종료',
        message:'지금 열려 있는 모든 방(워킹룸·투게더룸)을 즉시 종료합니다.\n안에 있던 사람들은 방에서 튕겨납니다.\n진행하려면 종료 라고 입력하세요.',
        placeholder:'종료'
      });
      if(typed==null) return;                      // 취소
      if(String(typed).trim() !== '종료'){ toast('입력이 일치하지 않아 취소했어요'); return; }
      closing = true;
      try{
        const r = await adminApi.closeAllRooms();
        toast(`방 ${r.closed}개를 종료했어요`);
      }catch(e){ fail(e); }
      finally{ closing = false; }
    };
  }
  // 🧹 유령 방 청소 — 살아있는 멤버 없이 _meta/chatLog만 남은 방 정리(정상 방은 안 건드림)
  { const _cgr = document.getElementById('lcCleanGhostRooms');
    if(_cgr) _cgr.onclick = async ()=>{
      if(!isAdmin()){ toast('관리자만 사용할 수 있어요'); return; }
      if(!(window.firebaseAPI && firebaseAPI.cleanGhostRooms)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
      // ★ 키워드 확인 제거 — 유령 방(사람 없이 데이터만 남은 방) 정리는 정상 방을 안 건드리는 안전한 작업이라
      //   버튼 클릭 즉시 실행. 연타만 방지.
      if(_cgr._cleaning) return; _cgr._cleaning = true;
      toast('청소 중…');
      const r = await firebaseAPI.cleanGhostRooms();
      _cgr._cleaning = false;   // 완료 — 다음 청소 허용
      if(r && r.ok){
        if(r.cleaned>0) toast(`유령 방 ${r.cleaned}개를 정리했어요` + (r.failed>0?` (실패 ${r.failed}개)`:''));
        else toast('정리할 유령 방이 없어요');
      } else toast('청소에 실패했어요' + (r&&r.error?(' — '+r.error):''));
    };
  }
  const _btn = document.getElementById('lcGameCfg');
  if(_btn) _btn.onclick = ()=>{ toast(GAME_CFG_PAUSED_TEXT); };
}

// 📢 광고 배너 편집 — 원본은 서버. 열 때 받아 채우고, 저장은 읽은 판으로
const BANNER_SLOTS = 3;
let bannerVersion = null;   // 마지막으로 받은 서버 판 — 저장이 싣는다
let bannerBusy = false;     // 받는 중 · 저장하는 중 — 한 번에 하나
const $ = (id)=>document.getElementById(id);
const closeBanner = ()=>{ const o=$('adBannerOverlay'); o.classList.remove('on'); o.style.display='none'; };
async function loadBanner(){
  const b = await adminApi.fetchBanner();
  bannerVersion = b.version;
  for(let i=0;i<BANNER_SLOTS;i++){
    $('adBannerImgInput'+i).value = (b.slides[i]&&b.slides[i].img)||'';
    $('adBannerLinkInput'+i).value = (b.slides[i]&&b.slides[i].link)||'';
  }
}
$('lcAdBannerEdit').onclick=async ()=>{
  if(bannerBusy) return;
  bannerBusy = true;
  try{
    await loadBanner();
    const o=$('adBannerOverlay'); o.classList.add('on'); o.style.display='flex';
  }catch(e){ fail(e); }
  finally{ bannerBusy = false; }
};
$('adBannerCloseBtn').onclick=closeBanner;
$('adBannerSaveBtn').onclick=async ()=>{
  if(bannerBusy || bannerVersion == null) return;
  const slides=[];
  for(let i=0;i<BANNER_SLOTS;i++){
    const imgVal=$('adBannerImgInput'+i).value.trim();
    const linkVal=$('adBannerLinkInput'+i).value.trim();
    if(imgVal) slides.push({img:imgVal, link:linkVal});
  }
  bannerBusy = true;
  try{
    await adminApi.replaceBanner(bannerVersion, slides);
    toast(slides.length ? '배너가 저장됐어요 ('+slides.length+'개)' : '배너가 숨겨졌어요');
    closeBanner();
  }catch(e){
    const t = fail(e);
    if(t.action === 'refetch'){   // 다른 곳에서 먼저 고쳤다 — 덮어쓰지 않고 지금 서버 값으로 다시 채운다
      try{ await loadBanner(); }catch(e2){ fail(e2); }
    }
  }
  finally{ bannerBusy = false; }
};

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminLauncher };
if(typeof window !== 'undefined') window.TwAdminLauncher = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
