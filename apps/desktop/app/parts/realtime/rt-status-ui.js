/* rt-status-ui.js — 🛰 realtime 연결 상태 → 사용자에게 보이는 것(설계 04-realtime-disconnect 4-D-7 V1~V6) (검사 sim-rt-status-ui.js)
   [왜] 연결 하나(rt-hub.js)는 닫힘 번호로 «다시 붙기 · 멈춤» 만 가른다. 멈춘 뒤 무엇을 보일지 · 어디로 보낼지는 화면 몫이라 여기 한 곳에 둔다.
   [상태별] retrying 이 RETRY_BAND_MS(15초) 넘게 이어지고 방 밖이면 런처 위 작은 띠 «서버에 다시 연결하는 중…»(V1 — 붙으면 사라짐 · 방 안은 방 화면이 알린다)
     authFailed → E-RT-01 · 로그인 화면(V2) · accountGone → E-RT-02 · 로그아웃 처리 · 로그인 화면(V3 — 탈퇴 중이면 그 흐름이 이미 하므로 건너뜀)
     update → 업데이트 강제 창(V4 — update-flow.js forceProtocol) · maintenance → 점검 창 + [다시 시도](V5 — maintenance-gate.js serverClosed)
     closed(모르는 4000번대) → E-RT-03 · 띠에 [다시 연결](V6). 다시 붙기는 사용자 누름 · 점검 해제 때만 — 타이머로 되풀이하지 않는다.
     sessionLost 는 로그인 흐름(login-flow.js)이 밀려난 기기 화면을 띄운다 — 여기선 안 한다.
   classic script — rt-hub.js 다음 · app.js 보다 먼저 싣는다(window.TwRtStatusUi). app.js 가 createRtStatusUi(deps) 로 만든다. */
(function(){
'use strict';

const RETRY_BAND_MS = 15000;   // 방 안 «다시 연결 중» 과 같은 값(서버 PROTOCOL 1장 · ops) — 짧은 끊김엔 아무것도 안 보인다
const BAND_ID = 'rtBand';      // desktop-run.js UI_HIT_SEL 에도 있어야 [다시 연결] 을 누른다
const TEXT = Object.freeze({ RETRYING: '서버에 다시 연결하는 중…', CLOSED: '서버 연결이 끊겼어요', RECONNECT: '다시 연결' });
const S = Object.freeze({ READY: 'ready', OFF: 'off', CONNECTING: 'connecting', RETRYING: 'retrying', AUTH_FAILED: 'authFailed',
  ACCOUNT_GONE: 'accountGone', UPDATE: 'update', MAINTENANCE: 'maintenance', CLOSED: 'closed' });   // rt-hub.js STATE 이름

/** @param {{
 *   rt: { onState: (fn: (s: string) => void) => Function, state: () => string, start: (o: { claim: boolean }) => void },
 *   inRoom: () => boolean,
 *   band: { show: (view: { text: string, button: string | null }, onPress: () => void) => void, hide: () => void },
 *   notifyError: (code: string) => void,
 *   toLogin: () => void,            // 로그아웃 처리(이 PC 계정 몫 지움 · 로그인 놓음) 뒤 로그인 화면으로
 *   withdrawing: () => boolean,     // 탈퇴 흐름이 도는 중(그 흐름이 로그아웃 · 다시 켜기를 한다)
 *   forceUpdate: () => void,        // 업데이트 강제 창(update-flow.js forceProtocol)
 *   maintenance: (retry: () => void) => void,   // 점검 창 + [다시 시도](maintenance-gate.js serverClosed)
 *   setTimeout: Function, clearTimeout: Function,
 * }} deps */
function createRtStatusUi(deps){
  const rt = deps.rt;
  const band = deps.band;
  const notifyError = deps.notifyError;
  let bandTimer = null, sawReady = false, signingOut = false;

  /* 멈춘 뒤 다시 붙기 — 사용자 누름 · 점검 해제. 이 기기가 지금 세션이므로 claim 없이(남을 밀지 않는다) */
  const reconnect = () => { band.hide(); rt.start({ claim: false }); };
  function clearBand(){
    if(bandTimer){ deps.clearTimeout(bandTimer); bandTimer = null; }
    band.hide();
  }
  /* 로그인 화면으로 보내기는 한 번만(그 뒤 앱이 다시 켜진다) — 처음이면 true */
  function beginSignOut(){
    if(signingOut) return false;
    signingOut = true;
    return true;
  }
  /* 상태 → 할 일 표 */
  const ON = {
    [S.READY]: () => { sawReady = true; clearBand(); },
    [S.OFF]: () => { sawReady = false; clearBand(); },
    [S.CONNECTING]: () => { clearBand(); },
    [S.RETRYING]: () => {
      if(bandTimer || !sawReady) return;   // 한 번도 붙지 못한 켜는 중엔 «다시» 연결이 아니다(서버에 닿지 못한 화면이 따로 있다)
      bandTimer = deps.setTimeout(() => {
        bandTimer = null;
        if(rt.state() === S.RETRYING && !deps.inRoom()) band.show({ text: TEXT.RETRYING, button: null }, () => {});
      }, RETRY_BAND_MS);
    },
    [S.AUTH_FAILED]: () => { clearBand(); if(beginSignOut()){ notifyError('E-RT-01'); deps.toLogin(); } },
    [S.ACCOUNT_GONE]: () => { clearBand(); if(!deps.withdrawing() && beginSignOut()){ notifyError('E-RT-02'); deps.toLogin(); } },
    [S.UPDATE]: () => { clearBand(); deps.forceUpdate(); },
    [S.MAINTENANCE]: () => { clearBand(); deps.maintenance(() => rt.start({ claim: false })); },
    [S.CLOSED]: () => {
      clearBand();
      notifyError('E-RT-03');
      band.show({ text: TEXT.CLOSED, button: TEXT.RECONNECT }, reconnect);
    },
  };
  const off = rt.onState((s) => { const fn = ON[s]; if(fn) fn(); });
  return { dispose(){ off(); clearBand(); } };
}

/* 띠 — 런처 위 가운데 작은 창 한 줄(업데이트 띠 updateReadyBanner 와 같은 창 모양 · 그 띠는 아래라 겹치지 않게 위에).
   글은 고정 문구만 textContent 로. 단추가 없으면 띠는 마우스를 통과시키지 않아도 된다(UI_HIT_SEL 은 단추 때문). */
function createRtBandDom(doc){
  let els = null;
  function build(){
    const b = doc.createElement('div');
    b.id = BAND_ID;
    b.setAttribute('role', 'status');
    b.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;-webkit-app-region:no-drag;'
      + 'background:var(--win-face,#d4d0c8);border:2px solid;border-color:var(--win-hi,#fff) var(--win-lo-2,#404040) var(--win-lo-2,#404040) var(--win-hi,#fff);'
      + 'box-shadow:2px 2px 0 rgba(0,0,0,.3);padding:6px 10px;display:flex;align-items:center;gap:8px;font-size:12px;color:var(--ink,#222);'
      + "font-family:Tahoma,'Malgun Gothic',sans-serif;";
    const text = doc.createElement('span');
    const btn = doc.createElement('button');
    btn.className = 'lc-btn';
    btn.style.cssText = 'margin-top:0;padding:3px 8px;';
    b.appendChild(text); b.appendChild(btn);
    (doc.body || doc.documentElement).appendChild(b);
    els = { b, text, btn };
  }
  return {
    show(v, onPress){
      if(!els) build();
      els.text.textContent = v.text;
      els.btn.textContent = v.button || '';
      els.btn.style.display = v.button ? '' : 'none';
      els.btn.onclick = () => onPress();
      els.b.style.display = 'flex';
    },
    hide(){ if(els) els.b.style.display = 'none'; },
  };
}

const api = { RETRY_BAND_MS, BAND_ID, TEXT, createRtStatusUi, createRtBandDom };
if(typeof window !== 'undefined') window.TwRtStatusUi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
