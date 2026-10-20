/* admin-launcher.js — 🛑 전체 방 종료 · 🧹 유령 방 청소 · ⚙️ 게임 설정 편집 · 📢 광고 배너 편집 (관리자 — 런처 관리자 줄의 단발 도구)
   app.js «📢 런처 광고 배너 · ⚙️ 게임 설정» 구역 가운데 관리자가 쓰는 쪽을 그대로 옮긴 관리자 모듈이다(관리자 코드 admin 폴더 5번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다. 사용자 쪽(광고 배너 그리기 · 서버 배너 구독 · 게임 설정 구독 _applyGameCfg)은 app.js 에 남겼다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(중괄호 블록 하나 + 광고 배너 버튼 셋 · 들여쓰기도 그대로). 바뀐 줄은 4줄 —
     isAdmin · _gameCfg 를 이름() 으로 읽는다. 둘 다 app.js 가 다시 대입하는 let 이라 값이 아니라 읽는 함수로 받는다.
   ★ app.js 함수 셋(toast · asyncPrompt · refreshAdBanner)은 화살표로, AD_BANNER_KEY(앞에서 선언한 const)는 값으로 받는다.
   ★ 밖에서 부르는 이름은 없다 — 버튼 연결을 만들 때 건다.
   검사: checks/sim-admin-users-launcher.js
   ⚠️ document · window · firebaseAPI · localStorage · navigator 는 예전처럼 전역 이름으로 쓴다(이 파일은 app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAdminLauncher — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103). */
(function(){

function createAdminLauncher(deps){
const toast = deps.toast;
const asyncPrompt = deps.asyncPrompt;
const refreshAdBanner = deps.refreshAdBanner;   // 런처 배너 다시 그리기
const AD_BANNER_KEY = deps.adBannerKey;           // 배너 저장 키(tw.adBanner)
const isAdmin = deps.isAdmin;                     // 읽는 함수 — 관리자 모드(다시 대입되는 let)
const _gameCfg = deps.gameCfg;                    // 읽는 함수 — 서버 게임 설정(구독이 다시 대입하는 let)
{
  // ★ 점검용 — 전체 방 종료(관리자). 실수 방지를 위해 '종료'를 직접 입력해야 실행된다(모달이라 Electron 포커스 문제 없음).
  { const _car = document.getElementById('lcCloseAllRooms');
    if(_car) _car.onclick = async ()=>{
      if(!isAdmin()){ toast('관리자만 사용할 수 있어요'); return; }
      const typed = await asyncPrompt({
        title:'전체 방 종료',
        message:'지금 열려 있는 모든 방(워킹룸·투게더룸)을 즉시 종료합니다.\n안에 있던 사람들은 방에서 튕겨납니다.\n진행하려면 종료 라고 입력하세요.',
        placeholder:'종료'
      });
      if(typed==null) return;                      // 취소
      if(String(typed).trim() !== '종료'){ toast('입력이 일치하지 않아 취소했어요'); return; }
      if(!(window.firebaseAPI && firebaseAPI.closeAllRooms)){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return; }
      const r = await firebaseAPI.closeAllRooms();
      if(r && r.ok){
        if(r.failed>0) toast(`방 ${r.count}개 종료 (실패 ${r.failed}개 — 규칙 게시 여부 확인)`);
        else toast(`방 ${r.count}개를 종료했어요`);
      } else toast('종료에 실패했어요' + (r&&r.error?(' — '+r.error):''));
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
  if(_btn) _btn.onclick = ()=>{
    const o=document.getElementById('gameCfgOverlay'); if(!o) return;
    o.classList.add('on'); o.style.display='flex';
    const inp=document.getElementById('gameCfgAnimalLv');
    // 서버값이 없으면 animal.js의 기본값을 보여준다.
    if(inp) inp.value = (_gameCfg().animalUnlockLevel != null) ? _gameCfg().animalUnlockLevel
                        : (window._animalUnlockLevel || 50);
  };
  const _close = ()=>{ const o=document.getElementById('gameCfgOverlay'); if(o){ o.classList.remove('on'); o.style.display='none'; } };
  const _cb = document.getElementById('gameCfgCloseBtn'); if(_cb) _cb.onclick = _close;
  const _sb = document.getElementById('gameCfgSaveBtn');
  if(_sb) _sb.onclick = async ()=>{
    const inp=document.getElementById('gameCfgAnimalLv');
    const n = parseInt(inp && inp.value, 10);
    if(!isFinite(n) || n < 1 || n > 999){ toast('1~999 사이 숫자를 넣어주세요'); return; }
    try{
      await firebaseAPI.publishGameConfig(Object.assign({}, _gameCfg(), { animalUnlockLevel:n }));
      toast('⚙️ 저장했어요 — 동물 해금 Lv.'+n);
      _close();
    }catch(e){ console.warn('[게임설정] 저장 실패', e); toast('저장에 실패했어요'); }
  };
}
document.getElementById('lcAdBannerEdit').onclick=()=>{
  const o=document.getElementById('adBannerOverlay'); o.classList.add('on'); o.style.display='flex';
  try{
    const raw = JSON.parse(localStorage.getItem(AD_BANNER_KEY)||'null');
    const arr = Array.isArray(raw) ? raw : (raw && raw.img ? [raw] : []);   // 예전 단일 객체 저장 방식 호환
    for(let i=0;i<3;i++){
      document.getElementById('adBannerImgInput'+i).value = (arr[i]&&arr[i].img)||'';
      document.getElementById('adBannerLinkInput'+i).value = (arr[i]&&arr[i].link)||'';
    }
  }catch(e){}
};
document.getElementById('adBannerCloseBtn').onclick=()=>{
  const o=document.getElementById('adBannerOverlay'); o.classList.remove('on'); o.style.display='none';
};
document.getElementById('adBannerSaveBtn').onclick=()=>{
  const slides=[];
  for(let i=0;i<3;i++){
    const imgVal=document.getElementById('adBannerImgInput'+i).value.trim();
    const linkVal=document.getElementById('adBannerLinkInput'+i).value.trim();
    if(imgVal) slides.push({img:imgVal, link:linkVal});
  }
  if(slides.length){ localStorage.setItem(AD_BANNER_KEY, JSON.stringify(slides)); toast('배너가 저장됐어요 ('+slides.length+'개)'); }
  else { localStorage.removeItem(AD_BANNER_KEY); toast('배너가 숨겨졌어요'); }
  // 🌐 서버에도 게시 — 예전엔 localStorage에만 저장돼서 관리자 본인 PC에만 보이고
  //   다른 사용자에겐 배너가 전혀 안 나가던 문제. 이제 모든 사용자에게 실시간 반영됨.
  if(window.firebaseAPI && firebaseAPI.publishAdBanner){
    firebaseAPI.publishAdBanner(slides).then(r=>{ if(!(r&&r.ok)) toast('⚠ 서버 게시 실패 — 다른 유저에겐 반영 안 됐어요'); })
      .catch(()=>toast('⚠ 서버 게시 실패 — 다른 유저에겐 반영 안 됐어요'));
  }
  refreshAdBanner();
  const o=document.getElementById('adBannerOverlay'); o.classList.remove('on'); o.style.display='none';
};

return {};   // 밖에서 부르는 이름 없음 — 전부 만들 때 건다
}

const api = { createAdminLauncher };
if(typeof window !== 'undefined') window.TwAdminLauncher = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
