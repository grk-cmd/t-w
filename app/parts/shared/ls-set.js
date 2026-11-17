/* ls-set.js — 💾 localStorage 에 쓰고 «실제로 남았는지» 확인하는 한 곳 — 못 남기면 번호로 한 번 알린다
   ・책임: 쓰기 · 지우기 뒤 getItem 으로 왕복 확인 · 실패하면 콘솔 경고(매번) + 번호 안내(번호마다 세션당 한 번) · 성공 true / 실패 false.
     · 설정(작은 값 — 테마 · 토글 · 창 크기 같은 것): lsSet(key, val) · lsUnset(key) → E-SYS-09
     · 사용자가 만든 데이터(계정 · 캐릭터 슬롯 · 숨김 목록 · 상태 같은 것): lsSave(key, val) · lsRemove(key) → E-SYS-10
     값은 setItem 처럼 글자로 바꿔 쓴다(JSON 은 부르는 쪽이 만든다). 던지지 않는다 — 쓰던 자리의 try 를 걷어도 된다.
   ・받는 deps 1 — notifyError: 번호 · 오류를 받아 알리는 함수(TwErrorCodes.notify — 부를 때 찾는다).
   ・내놓는 것: createLsSet(deps) → { _lsSet, lsUnset, lsSave, lsRemove } · 렌더러에서는 window.TwLsSet.lsSet · lsUnset · lsSave · lsRemove(하나를 만들어 둔다).
     app.js 는 원래 자리에서 createLsSet 로 만들어 옛 이름 _lsSet 으로 받는다(deps 로 받는 모듈 몫).
   ⚠️ «세션당 한 번» 은 이 파일이 실린 동안이다 — 기억을 파일 위에 둬서 app.js 가 만든 것과 window 것이 같이 센다(토글을 누를 때마다 뜨면 못 쓴다).
   ⚠️ 캐시 · 창 위치 · 읽음 표시처럼 못 남겨도 사용자가 잃는 게 없는 값은 여기로 오지 않는다(알리면 소음).
   검사: checks/sim-ls-set.js */
(function(){

const _warned = {};   // 번호 → 이미 알림

function createLsSet(deps){
const notifyError = deps.notifyError;
/* 처음 난 실패인가 — 콘솔은 매번, 안내는 번호마다 한 번 */
function _first(code, key, e){
  console.warn('[저장] ' + key + ' 저장 실패 — 앱을 껐다 켜면 사라집니다', e);
  if(_warned[code]) return false;
  _warned[code] = true;
  return true;
}
/* 실패면 그 오류, 남았으면 null. setItem 이 던지지 않고도 값이 안 남는 환경이 있어 다시 읽어 본다. */
function _write(key, val){
  const s = String(val);
  try{
    localStorage.setItem(key, s);
    if(localStorage.getItem(key) !== s) throw new Error('값이 남지 않음');
    return null;
  }catch(e){ return e; }
}
function _remove(key){
  try{
    localStorage.removeItem(key);
    if(localStorage.getItem(key) !== null) throw new Error('값이 지워지지 않음');
    return null;
  }catch(e){ return e; }
}
/* 번호는 글자 그대로 쓴다(검사 sim-error-codes 가 찾는다). */
function _lsSet(key, val){ const e = _write(key, val); if(e && _first('E-SYS-09', key, e)) notifyError('E-SYS-09', e); return !e; }
function lsUnset(key){ const e = _remove(key); if(e && _first('E-SYS-09', key, e)) notifyError('E-SYS-09', e); return !e; }
function lsSave(key, val){ const e = _write(key, val); if(e && _first('E-SYS-10', key, e)) notifyError('E-SYS-10', e); return !e; }
function lsRemove(key){ const e = _remove(key); if(e && _first('E-SYS-10', key, e)) notifyError('E-SYS-10', e); return !e; }

return {
  _lsSet,
  lsUnset,
  lsSave,
  lsRemove,
};
}

const api = { createLsSet };
if(typeof window !== 'undefined'){
  const inst = createLsSet({ notifyError: (...a)=>window.TwErrorCodes.notify(...a) });
  api.lsSet = inst._lsSet;
  api.lsUnset = inst.lsUnset;
  api.lsSave = inst.lsSave;
  api.lsRemove = inst.lsRemove;
  window.TwLsSet = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
