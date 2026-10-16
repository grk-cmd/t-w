/* myhome-page.js — 🏠 마이홈 페이지 불러오기 · 그리기(loadMyHomePage · renderMyHomePage)
   app.js «🏠 마이홈 페이지 불러오기 · 그리기(loadMyHomePage · renderMyHomePage)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 47번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 3개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: _mhStickerDragDist · loadMyHomePage · renderMyHomePage — app.js 는 mhPageMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwMyHomePage — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-myhome-page.js */
(function(){

function createMyHomePage(deps){
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const mhStateMod = deps.mhStateMod;
const myHomeUiMod = deps.myHomeUiMod;
const renderMyHomeStickers = deps.renderMyHomeStickers;
const richTextMod = deps.richTextMod;
const mhHooks = TwMyHomeHooks;   // 🪝 마이홈 고리판(myhome-hooks.js) — BGM · 배경 · 테마 다시 칠하기는 편집 묶음이 건다
async function loadMyHomePage(){
  // ★ 마이홈2-B: 관람 중이면 절대 내 데이터로 덮어쓰지 않음 (친구 홈 데이터가 순간적으로 사라지는 버그 방지)
  if(mhStateMod._mhViewingUserId()) return;
  if(!window.firebaseAPI || !firebaseAPI.getMyHome){ try{ renderMyHomePage(); }catch(_){}; return; }
  try{
    const _loadUid = getMyUserId();
    const data = await firebaseAPI.getMyHome(_loadUid) || {};
    if(mhStateMod._mhViewingUserId()) return;   // ★ 로드가 진행되는 사이 친구 홈 관람으로 전환됐으면 덮어쓰지 않음(비동기 경쟁 방지)
    if(getMyUserId() !== _loadUid) return;   // 🪪 불러오는 사이 계정이 바뀌었다 — 옛 계정 데이터를 붙들지 않는다
    mhStateMod.setMyHomeData(mhStateMod._mhHomeFromServer(data));
    mhStateMod.setMyHomeLoaded(true);
    mhStateMod.setMyHomeUid(_loadUid);
  }catch(e){
    console.warn('마이홈 페이지 로드 실패 — 기본값으로 렌더', e);
    // ★ 로드가 실패해도 마이홈이 통째로 빈 화면이 되지 않게 안전한 기본값으로라도 렌더
    if(!mhStateMod._myHomeData()) mhStateMod.setMyHomeData({ avatar:null, bio:'', postTitle:'', post:'', theme:null, stickers:{}, bgm:null, bg:null });
  }
  try{ renderMyHomePage(); }catch(e){ console.warn('마이홈 렌더 실패', e); }
}
function renderMyHomePage(){
  // 마이홈2-B: 관람 중이면 친구 이름을 표시 (getDisplayName은 항상 내 이름을 반환)
  const nameEl=document.getElementById('mhMyName');
  if(nameEl){
    if(mhStateMod._mhViewingUserId()) nameEl.textContent = mhStateMod._mhViewingDisplayName();
    else nameEl.textContent = getDisplayName();
  }
  // 리치 텍스트 필드 로드 — 옛 저장(순수 텍스트)이면 HTML 이스케이프 후 개행만 <br>로 변환해서 호환
  try{
    const _bioLoad = mhStateMod._myHomeData().bio||'';
    const _postLoad = mhStateMod._myHomeData().post||'';
    const bioBox=document.getElementById('mhBioBox');
    if(bioBox) bioBox.innerHTML = richTextMod._mhLoadRT(_bioLoad);
    const postBox=document.getElementById('mhPostBox');
    if(postBox) postBox.innerHTML = richTextMod._mhLoadRT(_postLoad);
  }catch(e){ console.warn('[마이홈] bio/post 렌더 실패', e); }
  const titleEl=document.getElementById('mhPostTitle'); if(titleEl) titleEl.textContent = mhStateMod._myHomeData().postTitle || '게시글 제목';   // 비어있으면 안내 문구를 그대로 표시
  // 툴바의 글자수 카운트 초기화
  if(typeof richTextMod._mhUpdateRTCount==='function'){ richTextMod._mhUpdateRTCount('mhBioBox'); richTextMod._mhUpdateRTCount('mhPostBox'); }
  const img=document.getElementById('mhAvatarImg'), ph=document.getElementById('mhAvatarPlaceholder');
  if(mhStateMod._myHomeData().avatar){ if(img){img.src=mhStateMod._myHomeData().avatar; img.style.display='block';} if(ph) ph.style.display='none'; }
  else { if(img) img.style.display='none'; if(ph) ph.style.display='flex'; }
  // ★ 각 렌더 단계를 개별 격리 — 한 유저의 손상된 데이터(예: 깨진 스티커/테마 값)로 한 곳이
  //   throw해도 마이홈 전체가 "빈 화면"이 되지 않게. 죽은 단계는 콘솔에 남겨 원인 추적.
  const _safe=(label,fn)=>{ try{ fn(); }catch(e){ console.warn('[마이홈] 렌더 실패:'+label, e); } };
  _safe('stickers', ()=>renderMyHomeStickers());
  _safe('profileRail', ()=>{ if(typeof myHomeUiMod.renderMhProfileRail==='function') myHomeUiMod.renderMhProfileRail(); });
  _safe('bgm', ()=>{ mhHooks.call(mhHooks.HOOK.BGM_REFRESH); });
  _safe('bg', ()=>{ mhHooks.call(mhHooks.HOOK.APPLY_BG); });
  _safe('theme', ()=>{ mhHooks.call(mhHooks.HOOK.APPLY_THEME); });
}
let _mhStickerDragDist = 0;   // 마지막 드래그 이동거리 — 드래그 직후 링크가 열리는 오작동 방지용

return {
  _mhStickerDragDist: ()=>_mhStickerDragDist,   // 읽는 함수
  setMhStickerDragDist: (v)=>{ _mhStickerDragDist = v; },   // 쓰는 함수 — app.js 가 비운다
  loadMyHomePage,
  renderMyHomePage,
};
}

const api = { createMyHomePage };
if(typeof window !== 'undefined') window.TwMyHomePage = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
