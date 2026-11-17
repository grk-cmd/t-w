/* ls-set.js — 💾 localStorage 에 쓰고 «실제로 남았는지» 확인하는 한 곳 — 못 남기면 번호로 한 번 알린다
   ・책임: 쓰기 · 지우기 뒤 getItem 으로 왕복 확인 · 실패하면 콘솔 경고(매번) + 번호 안내(번호마다 세션당 한 번) · 성공 true / 실패 false.
     · 설정(작은 값 — 테마 · 토글 · 창 크기 같은 것): lsSet(key, val) · lsUnset(key) → E-SYS-09
     · 사용자가 만든 데이터(계정 · 캐릭터 슬롯 · 숨김 목록 · 상태 같은 것): lsSave(key, val) · lsRemove(key) → E-SYS-10
     값은 setItem 처럼 글자로 바꿔 쓴다. 던지지 않는다 — 쓰던 자리의 try 를 걷어도 된다.
     · JSON 칸: lsSetJson(key, value)(설정) · lsSaveJson(key, value)(데이터) — shared/json-store.js 의 save 로 쓴다.
       저장된 글이 해석이 안 되면 덮어쓰지 않고(blocked) E-SYS-11, 그 밖의 실패는 위와 같은 번호. 성공 true / 실패 false.
     · 읽기 짝: lsLoadJson(key, fallback, { quiet }) — 해석 안 되면 E-SYS-11(막은 쓰기와 같은 번호 · 한 번). quiet 는 서버가 원본인 칸.
   ・받는 deps 2 — notifyError: 번호 · 오류를 받아 알리는 함수(TwErrorCodes.notify — 부를 때 찾는다) · jsonStore: TwJsonStore(load · save).
   ・내놓는 것: createLsSet(deps) → { _lsSet, lsUnset, lsSave, lsRemove, lsSetJson, lsSaveJson, lsLoadJson } · 렌더러에서는 window.TwLsSet 의 같은 이름(_lsSet 은 lsSet · 하나를 만들어 둔다).
     app.js 는 원래 자리에서 createLsSet 로 만들어 옛 이름 _lsSet 으로 받는다(deps 로 받는 모듈 몫).
   ⚠️ «세션당 한 번» 은 이 파일이 실린 동안이다 — 기억을 파일 위에 둬서 app.js 가 만든 것과 window 것이 같이 센다(토글을 누를 때마다 뜨면 못 쓴다).
   ⚠️ 캐시 · 창 위치 · 읽음 표시처럼 못 남겨도 사용자가 잃는 게 없는 값은 여기로 오지 않는다(알리면 소음).
   검사: checks/sim-ls-set.js */
(function(){

const _warned = {};   // 번호 → 이미 알림

function createLsSet(deps){
const notifyError = deps.notifyError;
const jsonStore = deps.jsonStore;
/* 콘솔은 매번, 안내는 번호마다 한 번 — 실제로 띄웠을 때만 «알렸다» 로 적는다(토스트가 아직 없던 부팅 중 실패가 뒤의 안내를 막지 않게). 번호는 글자 그대로(검사 sim-error-codes 가 찾는다). */
function _tell(code, key, e){
  console.warn('[저장] ' + key + ' ' + (code === 'E-SYS-11' ? '저장분을 읽지 못함 — 덮어쓰지 않습니다' : '저장 실패 — 앱을 껐다 켜면 사라집니다'), e);
  if(_warned[code]) return;
  if(code === 'E-SYS-09' && notifyError('E-SYS-09', e) === true) _warned[code] = true;
  if(code === 'E-SYS-10' && notifyError('E-SYS-10', e) === true) _warned[code] = true;
  if(code === 'E-SYS-11' && notifyError('E-SYS-11', e) === true) _warned[code] = true;
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
function _lsSet(key, val){ const e = _write(key, val); if(e) _tell('E-SYS-09', key, e); return !e; }
function lsUnset(key){ const e = _remove(key); if(e) _tell('E-SYS-09', key, e); return !e; }
function lsSave(key, val){ const e = _write(key, val); if(e) _tell('E-SYS-10', key, e); return !e; }
function lsRemove(key){ const e = _remove(key); if(e) _tell('E-SYS-10', key, e); return !e; }
/* JSON 칸 — 해석 안 되는 저장분 위에는 쓰지 않는다(읽기 실패는 빈 칸으로 보여서 그 위에 쓰면 나머지까지 지워진다). */
function lsSetJson(key, value){ const r = jsonStore.save(key, value); if(!r.ok) _tell(r.blocked ? 'E-SYS-11' : 'E-SYS-09', key, r.err); return r.ok; }
function lsSaveJson(key, value){ const r = jsonStore.save(key, value); if(!r.ok) _tell(r.blocked ? 'E-SYS-11' : 'E-SYS-10', key, r.err); return r.ok; }
/* 읽기 짝 — { ok, list, err }(json-store load 그대로). 해석이 안 되면(«없음» 과 다름) E-SYS-11 · 막은 쓰기와 같은 번호라 망가진 칸 하나에 안내는 한 번.
   quiet: 서버가 원본인 칸(로컬은 사본) — 읽을 때는 알리지 않는다. 서버에 못 쓰고 로컬도 막혔을 때 쓰기에서만 알린다. */
function lsLoadJson(key, fallback, opts){ const r = jsonStore.load(key, fallback); if(!r.ok && !(opts && opts.quiet)) _tell('E-SYS-11', key, r.err); return r; }

return {
  _lsSet,
  lsUnset,
  lsSave,
  lsRemove,
  lsSetJson,
  lsSaveJson,
  lsLoadJson,
};
}

const api = { createLsSet };
if(typeof window !== 'undefined'){
  const inst = createLsSet({ notifyError: (...a)=>window.TwErrorCodes.notify(...a), jsonStore: window.TwJsonStore });
  api.lsSet = inst._lsSet;
  api.lsUnset = inst.lsUnset;
  api.lsSave = inst.lsSave;
  api.lsRemove = inst.lsRemove;
  api.lsSetJson = inst.lsSetJson;
  api.lsSaveJson = inst.lsSaveJson;
  api.lsLoadJson = inst.lsLoadJson;
  window.TwLsSet = api;
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
