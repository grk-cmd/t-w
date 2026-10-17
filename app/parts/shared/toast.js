/* toast.js — 🍞 토스트 · 저장 실패 문구 — 화면 아래 한 줄 알림과 «권한 거부 vs 인터넷» 문구 가르기
   책임: #toast 한 줄 알림을 띄우고 시간이 되면 끈다(toast) · 누르면 그 글을 클립보드로 복사하고 글 끝에 «복사했어요»(onToastClick) · 저장 실패 오류가 규칙 거부(PERMISSION_DENIED)인지 가려 문구를 고른다(_saveFailMsg). 도메인을 모른다.
   받는 deps: 없음(document · navigator.clipboard · 타이머 전역).
   내보내는 것: toast(msg, iconSrc?, ms?) · _saveFailMsg(e, fallback?).
   app.js «🍞 토스트(toast) · 저장 실패 문구» 구역을 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ⚠️ 두 이름은 app.js 150여 곳 · 다른 파일(전역 · window.toast)이 그대로 부른다 — app.js 에 같은 이름의 이음 함수(«옛 전역 이름»)를 두고 부르는 줄은 안 바꿨다.
   ★ 아래 코드는 app.js 에 있던 글 그대로 옮긴 뒤, 눌러 복사(onToastClick · TOAST_COPY_* 상수)만 더했다(사용자 승인 · feat/toast-click-copy).
   ★ 밖에서 부르는 이름: _saveFailMsg · toast — app.js 의 이음 함수 둘이 toastMod.이름 으로 넘긴다.
   ⚠️ document · window · setTimeout 등 브라우저 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwToast — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-toast.js */
(function(){

function createToast(deps){
/* --- toast --- */
/* 🔐 저장 실패가 규칙 거부(PERMISSION_DENIED)인지 인터넷 문제인지 가른다 — 관리자 경로는 admins/$uid 를 보므로 거부면 «로그인 · 명단» 이 원인이다.
   ⚠️ 거부를 조용히 «인터넷 확인» 으로 넘기지 말 것 — 연결을 아무리 봐도 원인을 못 찾는다. */
function _saveFailMsg(e, fallback){
  const s = String((e && (e.code || e.message)) || '');
  if(/permission[_-]?denied/i.test(s)){
    return '권한이 없어요 — 관리자 계정으로 로그인했는지 확인해 주세요';
  }
  return fallback || '저장에 실패했어요 — 인터넷 연결을 확인해 주세요';
}
/* 🍞 두 번째 인자(iconSrc)는 글자 앞에 붙일 작은 그림(이모지가 없는 것용).
   ⚠️ 본문은 textContent 로 넣는다 — 남이 친 글(닉네임 등)이 섞이므로 innerHTML 로 바꾸면 안 된다. 그림은 따로 img 노드로.
   문구 안 \n 은 줄바꿈으로 보인다 — html .toast 의 white-space:pre-line(<br> 를 넣지 말고 \n 을 쓴다). */
const TOAST_DEFAULT_MS = 1900;   // 시간을 안 주면 이만큼 보인다
const TOAST_COPY_EXTRA_MS = 1500;   // 눌러 복사하면 남은 시간에 이만큼 더 보인다(«복사했어요» 를 읽을 틈)
const TOAST_COPIED_MARK = ' (복사했어요)', TOAST_COPY_FAIL_MARK = ' (복사하지 못했어요)';
let toastT=null;
let toastMsg='', toastEnd=0, toastSeq=0, toastMarked=false, toastBound=false;
/* 📋 토스트를 누르면 그 글(오류 번호 E-… 등)을 클립보드로 — 제보에 붙여 넣기 쉽게.
   표시는 새 토스트로 덮지 않고 같은 토스트 글 끝에 붙인다(그림 img 를 지우지 않게 글 노드를 덧붙인다).
   ⚠️ 클릭은 .toast.on 일 때만 받는다(html .toast.on 의 pointer-events:auto) — 꺼진(투명) 토스트가 클릭을 가로채지 않게.
   ⚠️ 복사가 끝나기 전에 새 토스트가 뜨면 표시를 붙이지 않는다(toastSeq). */
function onToastClick(){
  const t=document.getElementById('toast');
  if(!t || !t.classList.contains('on') || !toastMsg) return;
  const seq=toastSeq, text=toastMsg;
  const mark=(m)=>{
    if(seq!==toastSeq || toastMarked) return;
    toastMarked=true;
    t.appendChild(document.createTextNode(m));
    const left=Math.max(0, toastEnd-Date.now());
    toastEnd=Date.now()+left+TOAST_COPY_EXTRA_MS;
    clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),left+TOAST_COPY_EXTRA_MS);
  };
  try{ navigator.clipboard.writeText(text).then(()=>mark(TOAST_COPIED_MARK), ()=>mark(TOAST_COPY_FAIL_MARK)); }
  catch(_){ mark(TOAST_COPY_FAIL_MARK); }   // 클립보드가 없거나 바로 던지면
}
function toast(msg, iconSrc, ms){const t=document.getElementById('toast');t.textContent=msg;
  if(!toastBound){ toastBound=true; t.addEventListener('click', onToastClick); }
  toastMsg=String(msg==null?'':msg); toastSeq++; toastMarked=false;
  if(iconSrc){ const im=document.createElement('img'); im.src=iconSrc;
    im.style.cssText='width:16px;height:16px;vertical-align:-3px;margin-right:5px;'; t.prepend(im); }
  t.classList.add('on');
  const dur=(typeof ms==='number'&&ms>0)?ms:TOAST_DEFAULT_MS; toastEnd=Date.now()+dur;
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),dur);}

return {
  _saveFailMsg,
  toast,
};
}

const api = { createToast };
if(typeof window !== 'undefined') window.TwToast = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
