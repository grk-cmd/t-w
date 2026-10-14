/* async-prompt.js — ✏️ 인앱 프롬프트(asyncPrompt)
   app.js «✏️ 인앱 프롬프트(asyncPrompt)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 47번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄 —
     바꾼 이름 없음.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: asyncPrompt — app.js 는 asyncPromptMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwAsyncPrompt — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-async-prompt.js */
(function(){

function createAsyncPrompt(deps){

// ✏️ 인앱 프롬프트 — Electron은 window.prompt()가 비활성화(no-op)라서 native prompt를 못 씀.
//   이 함수를 native prompt 대용으로 사용. 취소/× 는 null 반환(prompt와 동일 계약).
function asyncPrompt({title, message, defaultValue, placeholder, maxLength}={}){
  return new Promise(resolve=>{
    const ov=document.getElementById('mhPromptOverlay'); if(!ov){ resolve(null); return; }
    // ★ 방어: 이전 호출의 finish가 안 끝난 상태에서 다시 열리면 listener가 겹쳐 클릭이 씹힘.
    //   이전 호출에서 남겨둔 listener를 오버레이 element에 저장해서 여기서 미리 제거.
    if(ov._cleanup) try{ ov._cleanup(); }catch(_){}
    const inp=document.getElementById('mhPromptInput');
    const msg=document.getElementById('mhPromptMsg');
    const titleEl=document.getElementById('mhPromptTitleText');
    const ok=document.getElementById('mhPromptOk'), cancel=document.getElementById('mhPromptCancel'), x=document.getElementById('mhPromptClose');
    titleEl.textContent = title || '입력';
    msg.textContent = message || '';
    inp.value = defaultValue==null ? '' : String(defaultValue);
    inp.placeholder = placeholder || '';
    inp.maxLength = maxLength || 500;
    ov.classList.add('on');
    // ★ 프롬프트가 열려있는 동안엔 overlay 자체도 pointer 이벤트를 받아 다른 outside-click 핸들러가 뒤에 가려진
    //   요소로 클릭을 흘려보내지 않게(스티커/컬러 팝업의 outside closer가 프롬프트를 통과시켜 뒤 요소를 클릭하고 그 부작용으로 프롬프트 상태가 꼬이던 경우 방지).
    ov.style.pointerEvents = 'auto';
    setTimeout(()=>{ inp.focus(); inp.select(); }, 0);
    let done=false;
    const finish=(val)=>{
      if(done) return; done=true;
      ov.classList.remove('on');
      ov.style.pointerEvents = '';
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      x.removeEventListener('click', onCancel);
      inp.removeEventListener('keydown', onKey);
      ov._cleanup = null;
      resolve(val);
    };
    ov._cleanup = ()=>finish(null);
    const onOk=()=>finish(inp.value);
    const onCancel=()=>finish(null);
    const onKey=(e)=>{
      if(e.key==='Enter'){ e.stopPropagation(); onOk(); }
      else if(e.key==='Escape'){ e.stopPropagation(); onCancel(); }
    };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    x.addEventListener('click', onCancel);
    inp.addEventListener('keydown', onKey);
  });
}
window.asyncPrompt = asyncPrompt;

return {
  asyncPrompt,
};
}

const api = { createAsyncPrompt };
if(typeof window !== 'undefined') window.TwAsyncPrompt = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
