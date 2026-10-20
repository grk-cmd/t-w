/* net-ready.js — 🛰 «네트워크(provider) 준비됨» 을 기다리는 한 곳 (검사 sim-net-ready.js)
   [왜] «연결이 있으면 바로, 없으면 준비 신호를 한 번 기다림» 판단이 15곳에 따로 있었다. 여기 하나로 묶는다.
   ★ 지금 «준비됨» 은 firebase-init.js 가 window.firebaseAPI 를 다 만들고 쏘는 'firebase-ready' 이벤트다.
     서버 이관 때 provider 의 준비 신호로 갈아 끼울 자리는 이 파일(NET_READY_EVENT · isNetReady) 하나뿐이다.
   ★ 이 이벤트에 직접 addEventListener 하는 곳은 이 파일뿐이어야 한다 — sim-net-ready.js 가 센다.
   내보내는 것: whenNetReady(cb, need) — 준비됐으면 바로 cb(), 아니면 신호 한 번(once) 기다림.
                 need(함수 이름 글)를 주면 «firebaseAPI 에 그 함수까지 있을 때» 만 바로 부른다.
               onNetReady(cb) — 신호가 올 때마다(once 없음 — 두 번 오면 두 번).
               waitNetReady(ms) — Promise<boolean>: 준비 신호 또는 ms 뒤 풀림(그때 연결 유무).
   받는 deps 없음. app.js · 쓰는 모듈보다 먼저 싣는 classic script(window.TwNetReady) — 쓰는 곳은 `TwNetReady.이름`. */
(function(){

const NET_READY_EVENT = 'firebase-ready';

function isNetReady(need){
  const api = window.firebaseAPI;
  if(!api) return false;
  return need ? !!api[need] : true;
}
function whenNetReady(cb, need){
  if(isNetReady(need)){ cb(); return; }
  window.addEventListener(NET_READY_EVENT, cb, { once:true });
}
function onNetReady(cb){
  window.addEventListener(NET_READY_EVENT, cb);
}
function waitNetReady(ms){
  return new Promise(res=>{
    if(window.firebaseAPI) return res(true);
    let done = false;
    const fin = ()=>{ if(done) return; done = true; res(!!window.firebaseAPI); };
    try{ window.addEventListener(NET_READY_EVENT, fin, { once:true }); }catch(_){}
    setTimeout(fin, ms);
  });
}

const api = { NET_READY_EVENT, isNetReady, whenNetReady, onNetReady, waitNetReady };
if(typeof window !== 'undefined') window.TwNetReady = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
