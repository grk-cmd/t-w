/* ls-set.js — 💾 작은 설정을 localStorage 에 쓰고 «실제로 남았는지» 확인한다(앱 FSD · app.js 분리 M14)
   app.js 의 _lsSet 을 글 그대로 옮긴 모듈이다. 동작은 옛 자리와 같다.
   ・책임: _lsSet(key, val) — setItem 뒤 getItem 으로 왕복 확인 · 실패하면 콘솔 경고 + 세션당 한 번 토스트 · 성공 true / 실패 false.
   ・받는 deps 1 — toast(함수).
   ・내놓는 것: _lsSet — app.js 는 같은 이름 const 로 받는다(deps 에서 `(...a)=>_lsSet(...a)` 로 넘긴다).
   ⚠️ 설정처럼 작은 값 전용이다 — 슬롯 · 파츠 · 책상 같은 큰 값은 실패 때 할 일이 달라 각자 처리한다.
   검사: checks/sim-ls-set.js */
(function(){

function createLsSet(deps){
const toast = deps.toast;
/* 💾 설정을 저장하고 **실제로 남았는지 확인한다** — 조용한 실패를 없애기 위한 것이다.

   [왜 필요한가] localStorage 쓰기는 이 파일에서 99곳이고 그중 58곳이 `catch(e){}` 로 비어 있다.
     이 앱은 얼굴 PNG·커미션 GLB 까지 로컬에 넣으므로 저장 공간이 실제로 찬다
     (persistSavedParts·persistSavedAssets 가 쓰기를 못 하면 E-CHAR-24 로 알린다 — 그 신호다).
     꽉 차면 **새 키는 만들어지지 않는데 화면에는 아무 표시도 안 난다** — 그러면
     "설정을 켜도 다시 켜면 꺼져 있다"가 되고, 제보에는 원인이 하나도 안 실린다.
     같은 증상이 일부 사용자에게서만 나는 것도 이 성질과 맞는다(그 기기만 저장이 꽉 찼다).
   ★ 왕복 확인까지 한다 — setItem 이 던지지 않고도 값이 안 남는 환경이 있다.
   ⚠️ 안내는 **세션당 한 번**이다. 토글을 누를 때마다 뜨면 그것대로 못 쓴다.
   ⚠️ 이 헬퍼는 '설정' 같은 작은 값 전용이다. 슬롯·파츠·책상처럼 큰 값은 실패했을 때
     할 일이 다르므로(직전 저장값 보존 등) 각자의 처리를 그대로 둔다. */
let _lsWarned = false;
function _lsSet(key, val){
  const s = String(val);
  try{
    localStorage.setItem(key, s);
    if(localStorage.getItem(key) !== s) throw new Error('값이 남지 않음');
    return true;
  }catch(e){
    console.warn('[저장] ' + key + ' 저장 실패 — 이 설정은 앱을 껐다 켜면 사라집니다', e);
    if(!_lsWarned){
      _lsWarned = true;
      try{ toast('⚠ 설정을 저장하지 못했어요 — 저장 공간이 가득 찼을 수 있어요'); }catch(_){}
    }
    return false;
  }
}

return {
  _lsSet,
};
}

const api = { createLsSet };
if(typeof window !== 'undefined') window.TwLsSet = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
