/* quiet-main.js — 시험 앱이 이 PC 의 화면 · 포커스를 건드리지 않게(조용한 창 · TW_E2E_QUIET). 감싸는 진입점(lib.js 의 wrap/main.js)이
   앱 main.js 보다 먼저 require 한다. 앱 코드는 바꾸지 않는다 — 시험 프로세스 안에서만 electron 을 감싼다.

   ・Dock · 앱 전환에 안 나오게: app.setActivationPolicy('accessory')(mac · ready 전) · app.focus / app.show / dock.show 는 아무것도 안 함
   ・앱이 require('electron') 으로 받는 BrowserWindow 를 하위 클래스로 바꾼다 — 만들 때부터 화면 밖(x,y = OFF) · 숨긴 채로 만들고,
     보이라고 했으면 포커스 없이 보인다(showInactive)
   ・창 메서드: show → showInactive · focus · moveTop · maximize · setFullScreen · setSimpleFullScreen → 아무것도 안 함 ·
     setAlwaysOnTop · setOpacity · setIgnoreMouseEvents · webContents.setAudioMuted → 값만 기억(isAlwaysOnTop · getOpacity · isAudioMuted 는 기억한 값) ·
     setBounds · setContentBounds · setPosition · center → 크기는 따르고 x,y 는 «앱이 아는 자리» 로만 기억 — 진짜 창은 화면 밖
   ・읽기: getBounds · getPosition · getContentBounds 는 앱이 아는 자리(가상 — 화면 밖 값을 마지막 자리로 저장하지 않게) ·
     진짜 값은 w.__e2eRealBounds() · w.__e2eRealOpacity() · w.webContents.__e2eRealAudioMuted() · 앱이 정한 클릭 통과는 w.__e2eIgnoreMouse()
   ・진짜 창은 투명(opacity 0) · 클릭 통과 · 소리 끔 — mac 은 화면 밖 창을 화면 끝으로 당겨 놓아 끝자락이 보이고 눌릴 수 있다
   ・창이 다른 길로 화면 안에 들어오면(move) 다시 밖으로 · 화면 밖 창도 타이머 · WebGL 이 돌게 배경 늦추기를 끈다
   Playwright 의 입력은 CDP 로 가서 OS 포커스 · 클릭 통과와 상관없다(setFocusable(false) 는 쓰지 않는다 — 입력을 막는다).
   확인: 네 묶음이 같이 쓰는 시나리오 scenarios/launcher/quiet.js(lib.js 만 씀) — 진짜 창이 화면 밖 · 투명 · 소리 끔 · 포커스 받은 창 없음 · 앱이 읽는 자리는 앱이 정한 값 */
'use strict';
const Module = require('module');
const electron = require('electron');
const { app } = electron;

const OFF = -20000;
const isOff = (x) => x <= OFF / 2;

// 화면 밖 · 투명(가려진 것으로 보이는) 창도 타이머 · 그리기 · WebGL 이 멈추지 않게
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
if(process.platform === 'darwin'){
  try { app.setActivationPolicy('accessory'); } catch(_){}
  app.whenReady().then(() => { try { app.setActivationPolicy('accessory'); } catch(_){} });
}
app.focus = () => {};
app.show = () => {};
if(app.dock){ app.dock.show = () => Promise.resolve(); }

const Base = electron.BrowserWindow;
const P = Base.prototype;
const orig = {
  setBounds: P.setBounds, setContentBounds: P.setContentBounds, setPosition: P.setPosition,
  getBounds: P.getBounds, getContentBounds: P.getContentBounds, getPosition: P.getPosition,
  showInactive: P.showInactive, setAlwaysOnTop: P.setAlwaysOnTop,
  setOpacity: P.setOpacity, setIgnoreMouseEvents: P.setIgnoreMouseEvents,
};
const num = (v) => typeof v === 'number' && isFinite(v);

// 이름은 BrowserWindow 여야 한다 — electron 의 getAllWindows · getFocusedWindow · fromWebContents 가 constructor.name 으로 BrowserWindow 를 가린다
const QuietWindow = class BrowserWindow extends Base {
  constructor(options = {}){
    const wantShow = options.show !== false;
    super(Object.assign({}, options, { x: OFF, y: OFF, show: false }));
    // 앱이 아는 자리(가상) — 앱이 정한 x,y 를 기억해 getBounds 등으로 돌려준다(진짜 화면 밖 값을 저장하지 않게). 크기는 진짜 그대로
    const r = orig.getBounds.call(this);
    let vx = options.x, vy = options.y;
    if(!num(vx) || !num(vy)){
      try { const wa = electron.screen.getPrimaryDisplay().workArea; vx = Math.round(wa.x + (wa.width - r.width) / 2); vy = Math.round(wa.y + (wa.height - r.height) / 2); }
      catch(_){ vx = 0; vy = 0; }
    }
    this.__twV = { x: vx, y: vy };
    this.__twAot = false;
    this.__twOpacity = num(options.opacity) ? options.opacity : 1;
    this.__twIgnore = false;
    try { orig.setAlwaysOnTop.call(this, false); } catch(_){}
    // 안 보이고 · 눌리지 않게 — mac 은 화면 밖 창을 화면 끝으로 당겨 놓아 끝자락이 보이고 눌린다. Playwright 입력은 CDP 로 가서 막히지 않는다
    try { orig.setOpacity.call(this, 0); } catch(_){}
    try { orig.setIgnoreMouseEvents.call(this, true, { forward: false }); } catch(_){}
    // 소리 끔(듣기 · 유튜브 · 채팅 알림음) — 앱이 다시 켜지 못하게 이 창의 setAudioMuted 는 값만 기억
    const wc = this.webContents;
    try { wc.setAudioMuted(true); } catch(_){}
    let muted = false;
    wc.setAudioMuted = (m) => { muted = !!m; };
    wc.isAudioMuted = () => muted;
    wc.__e2eRealAudioMuted = () => Object.getPrototypeOf(wc).isAudioMuted.call(wc);
    try { wc.setBackgroundThrottling(false); } catch(_){}
    this.__twPushOff();
    // 다른 길로 화면 안에 들어오면 다시 밖으로 — 밖으로 민 뒤 mac 이 당겨 놓은 자리면 그대로 둔다(끝없이 되밀지 않게)
    this.on('move', () => { try { const [x, y] = orig.getPosition.call(this); const l = this.__twLast; if(!l || l[0] !== x || l[1] !== y) this.__twPushOff(); } catch(_){} });
    if(wantShow) orig.showInactive.call(this);
  }
  __twPushOff(){ orig.setPosition.call(this, OFF, OFF); this.__twLast = orig.getPosition.call(this); }
  show(){ return orig.showInactive.call(this); }
  focus(){}
  moveTop(){}
  center(){
    try { const r = orig.getBounds.call(this); const wa = electron.screen.getDisplayMatching(this.getBounds()).workArea; this.__twV = { x: Math.round(wa.x + (wa.width - r.width) / 2), y: Math.round(wa.y + (wa.height - r.height) / 2) }; } catch(_){}
  }
  maximize(){}
  setFullScreen(){}
  setSimpleFullScreen(){}
  setAlwaysOnTop(flag){ this.__twAot = !!flag; }
  isAlwaysOnTop(){ return !!this.__twAot; }
  setOpacity(v){ this.__twOpacity = Number(v); }
  getOpacity(){ return this.__twOpacity; }
  setIgnoreMouseEvents(v){ this.__twIgnore = !!v; }
  /** 앱이 마지막으로 정한 클릭 통과(Electron 에는 읽는 API 가 없어 시험용 이름) */
  __e2eIgnoreMouse(){ return this.__twIgnore; }
  setBounds(b = {}, animate){
    if(num(b.x)) this.__twV.x = b.x;
    if(num(b.y)) this.__twV.y = b.y;
    const r = orig.setBounds.call(this, Object.assign({}, b, { x: OFF, y: OFF }), animate);
    this.__twLast = orig.getPosition.call(this);
    return r;
  }
  setContentBounds(b = {}, animate){
    const rb = orig.getBounds.call(this), rc = orig.getContentBounds.call(this);
    if(num(b.x)) this.__twV.x = b.x - (rc.x - rb.x);
    if(num(b.y)) this.__twV.y = b.y - (rc.y - rb.y);
    const r = orig.setContentBounds.call(this, Object.assign({}, b, { x: OFF, y: OFF }), animate);
    this.__twLast = orig.getPosition.call(this);
    return r;
  }
  setPosition(x, y){ if(num(x)) this.__twV.x = x; if(num(y)) this.__twV.y = y; this.__twPushOff(); }
  getPosition(){ return [this.__twV.x, this.__twV.y]; }
  getBounds(){ const r = orig.getBounds.call(this); return { x: this.__twV.x, y: this.__twV.y, width: r.width, height: r.height }; }
  getContentBounds(){
    const rb = orig.getBounds.call(this), rc = orig.getContentBounds.call(this);
    return { x: this.__twV.x + (rc.x - rb.x), y: this.__twV.y + (rc.y - rb.y), width: rc.width, height: rc.height };
  }
  /** 진짜 창 자리 · 크기(감싸지 않은 getBounds) — 시험이 «화면 밖인가» 를 볼 때 */
  __e2eRealBounds(){ return orig.getBounds.call(this); }
  /** 진짜 창 투명도 */
  __e2eRealOpacity(){ return P.getOpacity.call(this); }
};

// 앱의 require('electron') 에 BrowserWindow 만 바꾼 겉 객체를 준다 — 나머지 이름은 진짜 electron 을 그때그때 읽는 게터.
// Proxy 는 쓰지 않는다(바꿀 수 없는 칸이면 다른 값을 돌려줄 때 TypeError)
const shim = {};
for(const k of Object.getOwnPropertyNames(electron)){
  Object.defineProperty(shim, k, { enumerable: true, get: k === 'BrowserWindow' ? () => QuietWindow : () => electron[k] });
}
const load = Module._load;
Module._load = function(request, parent, isMain){
  if(request === 'electron') return shim;
  return load.call(this, request, parent, isMain);
};

module.exports = { OFF, QuietWindow };
