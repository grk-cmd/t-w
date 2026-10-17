/* toast.js — 🍞 토스트 · 저장 실패 문구 — 화면 아래 한 줄 알림과 «권한 거부 vs 인터넷» 문구 가르기
   책임: #toast 한 줄 알림을 띄우고 시간이 되면 끈다(toast) · 저장 실패 오류가 규칙 거부(PERMISSION_DENIED)인지 가려 문구를 고른다(_saveFailMsg). 도메인을 모른다.
   받는 deps: 없음(document · 타이머 전역).
   내보내는 것: toast(msg, iconSrc?, ms?) · _saveFailMsg(e, fallback?).
   app.js «🍞 토스트(toast) · 저장 실패 문구» 구역을 그대로 옮겼다(구역 떼기 C · w2). 동작은 옮기기 전과 같다.
   ⚠️ 두 이름은 app.js 150여 곳 · 다른 파일(전역 · window.toast)이 그대로 부른다 — app.js 에 같은 이름의 이음 함수(«옛 전역 이름»)를 두고 부르는 줄은 안 바꿨다.
   ★ 아래 코드는 app.js 에 있던 글 그대로다(들여쓰기도 · 옛 이야기형 주석만 «왜 · 함정» 으로 줄였다). 바뀐 코드 줄은 0줄.
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
let toastT=null;function toast(msg, iconSrc, ms){const t=document.getElementById('toast');t.textContent=msg;
  if(iconSrc){ const im=document.createElement('img'); im.src=iconSrc;
    im.style.cssText='width:16px;height:16px;vertical-align:-3px;margin-right:5px;'; t.prepend(im); }
  t.classList.add('on');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),(typeof ms==='number'&&ms>0)?ms:TOAST_DEFAULT_MS);}

return {
  _saveFailMsg,
  toast,
};
}

const api = { createToast };
if(typeof window !== 'undefined') window.TwToast = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
