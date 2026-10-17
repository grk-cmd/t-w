/* gamepad-activity.js — 🎮 게임패드도 «사람이 만지고 있다» 로 친다(제보: 패드로만 게임하면 기록이 멈추고 잠든다).
   [왜 따로 읽나] 활동 신호는 uiohook(키 · 클릭 · 휠)과 커서 이동뿐이라 XInput · DirectInput 패드는 어디에도 안 잡힌다.
     OS 유휴시간(powerMonitor)은 센서 떨림 · 펜 호버까지 입력으로 쳐서 걷어 낸 방식이라 되살리지 않는다(app.js
     USE_OS_IDLE_FOR_FOCUS 주석). 여기서는 **버튼 · 스틱 값이 실제로 바뀐 것**만 센다 — 가만히 둔 패드는 아무 신호도 없다.
   [어떻게] 크로미움 Gamepad API(navigator.getGamepads)를 0.5초마다 읽어 직전 값과 비교한다.
     ・버튼: pressed 가 바뀌었거나 value(트리거)가 BTN_EPS 넘게 바뀜
     ・스틱: 축 값이 AXIS_EPS 넘게 바뀜 — 아날로그 스틱의 미세 떨림(±0.05 안팎)을 거른다
     ・처음 보는 패드(연결 · 다시 연결)는 기준만 잡고 신호로 치지 않는다 — 꽂는 순간을 «활동» 으로 세지 않게
   ⚠️ 창이 뒤에 있으면(게임이 앞) 크로미움은 패드 값을 주지 않는다 — Xbox 패드로만 게임하면 잠들었다.
     그래서 Windows 는 main 이 XInput 을 직접 읽어(sysinput-win.js readPads) **이 판정을 그대로 써서** penActivity 로 보낸다.
     렌더러 쪽(아래)은 창이 앞일 때 · mac 몫으로 남는다. main 에서도 require 하므로 module.exports 를 지우지 말 것.
   ⚠️ 패드를 한 번도 누르지 않았으면 크로미움이 목록에 안 넣는다(스펙 — 지문 방지). 처음 한 번은 «꽂고 누르기» 가 필요하다.
   검사: checks/sim-gamepad-activity.js */
(function(){
'use strict';

const POLL_MS = 500;
const AXIS_EPS = 0.2;     // 스틱 · 축 — 이만큼 넘게 움직여야 «만졌다»
const BTN_EPS = 0.1;      // 아날로그 버튼(트리거) — 이만큼 넘게 눌러야

/* 패드 한 개 → 비교용 값 */
function snap(pad){
  return {
    b: Array.from(pad.buttons || [], x => ({ p: !!(x && x.pressed), v: (x && typeof x.value === 'number') ? x.value : 0 })),
    a: Array.from(pad.axes || [], v => (typeof v === 'number' && isFinite(v)) ? v : 0),
  };
}
/* 두 값 사이에 «사람이 만진» 차이가 있나 */
function changed(prev, cur){
  const nb = Math.max(prev.b.length, cur.b.length);
  for(let i = 0; i < nb; i++){
    const p = prev.b[i] || { p: false, v: 0 }, c = cur.b[i] || { p: false, v: 0 };
    if(p.p !== c.p || Math.abs(p.v - c.v) > BTN_EPS) return true;
  }
  const na = Math.max(prev.a.length, cur.a.length);
  for(let i = 0; i < na; i++){
    if(Math.abs((prev.a[i] || 0) - (cur.a[i] || 0)) > AXIS_EPS) return true;
  }
  return false;
}

/* deps: getPads() → navigator.getGamepads() 결과 · onActivity() · setInterval/clearInterval(검사용 · 없으면 전역) */
function createGamepadActivity(deps){
  const last = {};     // 패드 id + 자리 → snap
  let timer = null;
  function poll(){
    let pads;
    try{ pads = deps.getPads() || []; }catch(_){ return false; }
    let hit = false;
    const seen = {};
    for(const pad of Array.from(pads)){
      if(!pad || pad.connected === false) continue;
      const key = pad.index + ':' + pad.id;
      seen[key] = true;
      const cur = snap(pad);
      if(last[key] && changed(last[key], cur)) hit = true;
      last[key] = cur;
    }
    Object.keys(last).forEach(k => { if(!seen[k]) delete last[k]; });   // 뺀 패드는 잊는다 — 다시 꽂으면 기준부터
    if(hit){ try{ deps.onActivity(); }catch(_){} }
    return hit;
  }
  function start(){
    if(timer) return;
    const si = deps.setInterval || setInterval;
    timer = si(poll, POLL_MS);
  }
  function stop(){
    if(!timer) return;
    const ci = deps.clearInterval || clearInterval;
    ci(timer); timer = null;
  }
  return { start, stop, poll };
}

const api = { createGamepadActivity, POLL_MS, AXIS_EPS, BTN_EPS };
if(typeof window !== 'undefined') window.TwGamepadActivity = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
