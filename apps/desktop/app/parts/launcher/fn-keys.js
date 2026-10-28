/* fn-keys.js — ⌨️ 함수키 단축키(F1 ~)
   app.js «⌨️ 함수키 단축키(F1 ~)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 3줄 —
     chatUiMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 0개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFnKeys — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-fn-keys.js */
(function(){

function createFnKeys(deps){
const chatUiMod = deps.chatUiMod;   // 읽는 함수
const iDeskMod = deps.iDeskMod;
const rideBenchMod = deps.rideBenchMod;
/* ⌨️ 함수키 단축키 — F1 ⚙설정 / F2 🎨꾸미기 / F3 ✥이동(드래그) / F4 🏠마이홈
   ── 안전장치:
     · 실행 모드에서만 동작 (런처·생성기·config 모드는 무시)
     · 입력창(input/textarea/contenteditable)에서 타이핑 중이면 무시 — 마이홈 게시글/채팅 등 방어
     · 다른 모달(관리자·파츠 등록·이름 설정 등)이 이미 열려있으면 무시 — 배경 창이 겹쳐 열리는 사고 방지
     · 브라우저 기본 동작(F1 도움말 등)은 preventDefault로 차단, 키 반복(e.repeat)도 무시
   ── 구현 방식: 각 실제 버튼의 click()을 프로그래매틱하게 발동 → 기존 토글·가드·자동저장 로직을 그대로 재사용.
     (예: F2를 다시 누르면 꾸미기 창이 닫히면서 commitWdDraft로 자동 저장까지 자동 처리) */
(function bindHotkeys(){
  // 이미 열려있으면 스킵할 모달 셀렉터 — updateMyStatusChipPosition 근처의 다른 모달 셀렉터와 동일한 세트.
  const OPEN_MODAL_SEL = '#partRegOverlay.on, #deskRegOverlay.on, #assetImpOverlay.on, #assetGenOverlay.on, #glbEncOverlay.on, #glbLoadOverlay.on, #exportOverlay.on, #adminPassOverlay.on, #licenseGenOverlay.on, #announceOverlay.on, #adBannerOverlay.on, #commGenOverlay.on, #inviteOverlay.on, #raceOverlay.on, #codeOverlay.on, #focusSettingsPanel.fs-in-launcher.on, #pkOverlay.on';
  function isTyping(){
    const a = document.activeElement;
    if(!a) return false;
    if(a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') return true;
    if(a.isContentEditable) return true;
    return false;
  }
  function isRunMode(){
    // body.config = 설정 모드(런처/생성기 창 크기 모드)
    if(document.body.classList.contains('config')) return false;
    const launcher = document.getElementById('launcher');
    if(launcher && launcher.classList.contains('on')) return false;
    const creator = document.getElementById('creatorOverlay');
    if(creator && creator.classList.contains('on')) return false;
    return true;
  }
  function toggleMyHomeShortcut(){
    const overlay = document.getElementById('myHomeOverlay');
    if(overlay && overlay.classList.contains('on')){
      // 이미 열려있으면 닫음 — close 함수는 IIFE 내부에 있어서 직접 못 부르므로 실제 × 버튼 클릭 트리거.
      //   (그러면 관람 모드 종료·commit·BGM 정리·디자인 스튜디오 close까지 원래 로직대로 진행)
      const closeBtn = document.getElementById('myHomeClose');
      if(closeBtn) closeBtn.click();
    } else {
      window.openMyHome();
    }
  }
  function triggerClick(id){
    const btn = document.getElementById(id);
    if(btn) btn.click();
  }
  function _isMacUI(){ try{ return /Mac/i.test(navigator.platform || '') || /Mac OS X/i.test(navigator.userAgent || ''); }catch(_){ return false; } }
  /* 🍎 mac 이면 단축키 표시를 ⌘ 로 — .fkey 글자와 title 의 (F1)… 을 바꾼다. 마크업은 그대로(Windows 표시가 원본). */
  (function _macShortcutLabels(){
    if(!_isMacUI()) return;
    const run = ()=>{
      document.querySelectorAll('.fkey').forEach(el=>{ const m = /^F([1-5])$/.exec((el.textContent||'').trim()); if(m) el.textContent = '⌘' + m[1]; });
      document.querySelectorAll('[title]').forEach(el=>{ const t = el.getAttribute('title'); if(t && /\(F[1-5]\)/.test(t)) el.setAttribute('title', t.replace(/\(F([1-5])\)/g, '(⌘$1)')); });
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
  })();
  /* 🏠/🕒 ▾ 메뉴 퀵 항목 — F4(마이홈)·[기록 열기](포커스 기록)와 같은 동작.
     항목을 누르면 더보기 캐스케이드를 닫고 실행(마이홈/기록 창이 위에 뜨는데 메뉴가 남아있으면 지저분함). */
  function _closeMoreCascade(){
    const more=document.getElementById('myChipMore'); if(more) more.classList.add('hidden');
    const mbtn=document.getElementById('myStatusChipBtn'); if(mbtn) mbtn.classList.remove('on');
  }
  const _mhMenuBtn=document.getElementById('myHomeMenuBtn');
  if(_mhMenuBtn) _mhMenuBtn.addEventListener('click', e=>{ e.stopPropagation(); _closeMoreCascade(); toggleMyHomeShortcut(); });
  const _flMenuBtn=document.getElementById('myFocusLogMenuBtn');
  if(_flMenuBtn) _flMenuBtn.addEventListener('click', e=>{ e.stopPropagation(); _closeMoreCascade(); triggerClick('fsFocusLogBtn'); });
  /* 🍎 [Mac 제보 2026-09-23] F1~F5 는 mac 에서 밝기·미션 컨트롤·Spotlight·받아쓰기 자리다(Fn 을 같이 눌러야 F 키).
     ★ mac 에서는 ⌘1~⌘5 를 같은 동작으로 받는다. F 키(Fn+F1 등)도 그대로 먹는다 — 둘 다 된다.
       e.code 를 본다(Digit1…) — 한글 자판·Shift 상태와 무관하게 같은 물리 키다. 버튼 옆 표시(.fkey)·툴팁도 ⌘ 로 바꾼다(_macShortcutLabels). */
  const _SC_MAC = _isMacUI();
  document.addEventListener('keydown', e=>{
    if(e.repeat) return;
    if(_SC_MAC && e.metaKey && !e.ctrlKey && !e.altKey && /^Digit[1-5]$/.test(e.code || '')){
      const _orig = e;
      e = { key:'F' + _orig.code.slice(5), repeat:false, preventDefault:()=>_orig.preventDefault() };   // 아래 한 벌의 분기로 보낸다
    }
    // 글자 단축키(i)는 수정키 없이 누를 때만 — 한글 상태에서도 먹게 hotkeyLetter 로 본다.
    const letter = (e.ctrlKey || e.metaKey || e.altKey) ? '' : hotkeyLetter(e);
    const isFKey = /^F[1-5]$/.test(e.key);
    if(!isFKey && letter!=='i') return;
    if(!isRunMode()) return;
    if(isTyping()) return;
    if(document.querySelector(OPEN_MODAL_SEL)) return;
    e.preventDefault();
    switch(isFKey ? e.key : letter){
      case 'F1': triggerClick('myFocusGearBtn'); break;   // ⚙ 설정
      case 'F2': triggerClick('myWardrobeBtn'); break;    // 🎨 꾸미기
      case 'F3': triggerClick('myMoveBtn'); break;        // ✥ 이동(드래그)
      case 'F4': toggleMyHomeShortcut(); break;           // 🏠 마이홈
      case 'F5':                                          // 💬 대화창 (투게더룸 전용 — 토글)
        if(window._activeChannel === 2){
          const ov=document.getElementById('chatOverlay');
          const isOpen = !!(ov && ov.style.display==='block');   // 열림=block, 닫힘=none (단순·확실)
          if(isOpen){ if(typeof chatUiMod().closeChatWindow==='function') chatUiMod().closeChatWindow(); }
          else if(typeof chatUiMod().openChatWindow==='function'){ chatUiMod().openChatWindow(); }
        }
        break;
      case 'i':                                           // 🪑 상호작용 책상 인벤토리 (방 안에서만)
        // ⏸️ 이번 릴리스에서는 비활성화 — 상호작용 책상은 다음 업데이트에 공개.
        //   기능/UI/동기화 코드는 그대로 두고 진입만 막음. 재활성화: IDESK_ENABLED=true 한 줄만 되돌리면 됨.
        if(typeof iDeskMod.IDESK_ENABLED!=='undefined' && iDeskMod.IDESK_ENABLED && typeof rideBenchMod.toggleIdeskInventory==='function') rideBenchMod.toggleIdeskInventory();
        break;
    }
  });
})();

return {

};
}

const api = { createFnKeys };
if(typeof window !== 'undefined') window.TwFnKeys = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
