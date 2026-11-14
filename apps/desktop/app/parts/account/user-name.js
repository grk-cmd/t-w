/* user-name.js — 🏷️ 닉네임 저장 — 제자리 편집(마이홈 이름 · 내 정보)이 부르는 한 벌(commitUserName) · 길이 상한(USER_NAME_MAX) (검사 sim-user-name.js)
   app.js «🏷️ 닉네임 저장 — 모달이 아니라 제자리 편집이 부르는 한 벌» 구역 본문을 그대로 옮긴 글이다(앱 FSD 40번에서 program-settings.js 로 갔던 그 글).
   설정 창(program-settings.js)에 같이 있어서 마이홈 편집 · 내 정보가 설정 창을 바라봤다 — 설정 창은 다른 기능을 많이 부르는 위층이라 순환이 됐다(모듈 순환 끊기 7).
   ★ 아래 본문은 옮기기 전 글 그대로다. isAdmin 은 이름() 으로 읽는다(app.js 가 다시 대입하거나 뒤에서 만들어지는 값).
   ★ 운영진처럼 보이는 이름 막기는 name-guard.js(isStaffName — app.js 앞에 싣는 classic script)를 부른다.
   ★ 밖에서 부르는 이름: USER_NAME_MAX · commitUserName — app.js 는 userNameMod.이름 으로 부른다. window.commitUserName 도 예전처럼 건다.
   ⚠️ 전역 이름은 TwUserName — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   app.js 앞에 싣는 classic script. */
(function(){

function createUserName(deps){
const Presence = deps.Presence;
const getDisplayName = deps.getDisplayName;
const getMyUserId = deps.getMyUserId;
const getUserName = deps.getUserName;
const isAdmin = deps.isAdmin;   // 읽는 함수
const setUserName = deps.setUserName;
const toast = deps.toast;
const saveNameOnServer = deps.saveNameOnServer;   // (name) => Promise<{ ok, err }> — 서버 계정 이름(PATCH /v1/me — login-flow patchMe)
const notifyError = deps.notifyError;   // 번호 토스트(error-codes.js)
const USER_NAME_MAX = 12;   // ⚠️ 옛 모달은 이 값을 HTML 의 maxlength 로 들고 있었다. 이제 여기가 유일한 자리다.
function commitUserName(raw){
  const v = String(raw==null?'':raw).trim().slice(0, USER_NAME_MAX);
  // 운영진처럼 보이는 이름(name-guard.js)은 저장하지 않는다 — 규칙도 프로필에서 막는다(관리자 · 이미 그 이름인 사람은 예외).
  if(isStaffName(v) && v !== getUserName().trim() && !(typeof isAdmin() !== 'undefined' && isAdmin())){
    toast('운영진과 헷갈리는 이름은 쓸 수 없어요');
    return;
  }
  const prev = getUserName();
  const next = v || '나';
  setUserName(next);
  refreshNameViews();
  // ★ 이름의 원본은 서버 계정(0.13) — 친구 화면 · 명함이 거기서 읽는다. 서버가 거절하면 이 PC 에도 남기지 않고 이전 이름으로 되돌린다(다음 켤 때 서버 이름으로 덮이므로).
  if(!getMyUserId()){ toast('이름이 저장됐어요'); return; }
  Promise.resolve(saveNameOnServer(next)).then((r) => {
    if(r && r.ok){ toast('이름이 저장됐어요'); return; }
    if(getUserName() === next){ setUserName(prev); refreshNameViews(); }   // 그 사이 또 고쳤으면 그쪽을 둔다
    const e = r && r.err;
    if(e && e.code === 'USER_RESERVED_NAME') toast('운영진과 헷갈리는 이름은 쓸 수 없어요');
    else notifyError('E-ACC-01', e);
  });
}
// 🏷️ 방에 들어가 있으면 친구 화면의 내 이름표도 즉시 갱신 — 예전엔 방을 다시 들어가야 바뀌었다. 마이홈 페이지가 열려있으면 표시도 같이.
function refreshNameViews(){
  try{ if(typeof Presence!=='undefined' && Presence.active() && Presence.setName) Presence.setName(getDisplayName()); }catch(_){}
  const nameEl=document.getElementById('mhMyName'); if(nameEl) nameEl.textContent=getDisplayName();
}
window.commitUserName = commitUserName;

return {
  USER_NAME_MAX,
  commitUserName,
};
}

const api = { createUserName };
if(typeof window !== 'undefined') window.TwUserName = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
