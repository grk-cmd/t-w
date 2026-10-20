/* devtools-gate.js — 🔒 개발자 도구(F12)를 열어도 되는가 · 메인 프로세스(main.js)가 쓴다
   책임: 설치본에서는 개발자 도구를 막고, 관리자 모드에 들어간 창에서만 연다. 개발 실행(npm start)과 dev 빌드는 늘 연다.
   [왜] 열려 있으면 누구나 콘솔 한 줄로 앱 안 판정(isPremium · localStorage 의 라이선스 · 초대 통과 도장)을 바꾼다.
     앱 안 판정은 원래 우회할 수 있어 진짜 막는 곳은 서버 · 규칙이지만, 가장 쉬운 문은 닫는다.
   [관리자 예외] 관리자 모드(비밀번호 + 구글 로그인 — admin/admin-mode.js)에 들어가면 렌더러가 setAdmin(true) 를 알린다.
     창을 만들 때 webPreferences.devTools 를 false 로 두면 나중에 못 연다 — 그래서 메인 창은 열 수 있게 두고 여기서 막는다:
     F12 는 허용될 때만 토글 · 다른 길로 열려도(devtools-opened) 허용이 아니면 바로 닫는다 · 관리자 모드를 끄면 닫는다.
   createDevtoolsGate({ packaged, env }) → { always, allowed(), setAdmin(on), attach(webContents) }
     always   : 설치본이 아니거나 dev 빌드면 true(관리자 모드와 상관없이 연다). 보조 창(구글 로그인 · 음악)의 webPreferences.devTools 에 그대로 쓴다.
     attach   : 메인 창 webContents 에 F12 토글 · 열림 감시를 건다. 돌려받는 값은 F12 를 처리했는지(테스트용 아님 — 이벤트 처리기가 쓴다)
   검사: checks/sim-devtools-gate.js */
'use strict';

function createDevtoolsGate(opts){
  const o = opts || {};
  const always = !o.packaged || o.env === 'dev';
  let admin = false;
  const targets = new Set();
  const allowed = () => always || admin;

  function closeAll(){
    for(const wc of targets){
      try{ if(!wc.isDestroyed() && wc.isDevToolsOpened()) wc.closeDevTools(); }catch(_){}
    }
  }
  function setAdmin(on){
    admin = !!on;
    if(!allowed()) closeAll();
  }
  /* F12 — frame:false 창은 기본 메뉴 단축키가 없어서 직접 건다. 허용이 아니면 아무것도 안 한다(막는다). */
  function onKey(wc, input){
    if(!input || input.type !== 'keyDown' || input.key !== 'F12') return false;
    if(allowed()) wc.toggleDevTools();
    return true;
  }
  function attach(wc){
    if(!wc) return;
    targets.add(wc);
    wc.on('before-input-event', (_e, input) => { onKey(wc, input); });
    // 메뉴 · 원격 디버깅 같은 다른 길로 열려도 허용이 아니면 닫는다
    wc.on('devtools-opened', () => { if(!allowed()) { try{ wc.closeDevTools(); }catch(_){} } });
    wc.on('destroyed', () => { targets.delete(wc); });
  }
  return { always, allowed, setAdmin, attach, onKey };
}

module.exports = { createDevtoolsGate };
