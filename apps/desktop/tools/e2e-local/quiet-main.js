/* quiet-main.js — 시험 앱이 이 PC 의 화면 · 포커스를 건드리지 않게(조용한 창 · TW_E2E_QUIET). 감싸는 진입점(lib.js 의 wrap/main.js)이
   앱 main.js 보다 먼저 require 한다. 앱 코드는 바꾸지 않는다 — 시험 프로세스 안에서만 electron 을 감싼다.

   ・Dock · 앱 전환에 안 나오게: app.setActivationPolicy('accessory')(mac · ready 전) · app.focus / app.show / dock.show 는 아무것도 안 함
   ・앱이 require('electron') 으로 받는 BrowserWindow 를 하위 클래스로 바꾼다 — 만들 때부터 화면 밖(x,y = OFF) · 숨긴 채로 만들고,
     보이라고 했으면 포커스 없이 보인다(showInactive)
   ・창 메서드: show → showInactive · focus · moveTop · center · maximize · setFullScreen · setSimpleFullScreen → 아무것도 안 함 ·
     setAlwaysOnTop → 값만 기억(isAlwaysOnTop 은 기억한 값 — 앱 판단은 그대로 · 진짜 창은 늘 위가 아님) ·
     setBounds · setContentBounds · setPosition → 폭 · 높이는 따르고 x,y 는 화면 밖 · 진짜 자리는 w.__e2eRealBounds()
   ・창이 다른 길로 화면 안에 들어오면(move) 다시 밖으로 · 화면 밖 창도 타이머 · WebGL 이 돌게 배경 늦추기를 끈다
   창은 누를 수 있게 둔다(setFocusable(false) 는 입력을 막는다). Playwright 의 입력은 OS 포커스 없이도 간다.
   확인: 네 묶음이 같이 쓰는 시나리오 scenarios/launcher/quiet.js(lib.js 만 씀) — 창 자리가 늘 화면 밖 · 포커스 받은 창 없음 */
'use strict';
const Module = require('module');
const electron = require('electron');
const { app } = electron;

const OFF = -20000;
const isOff = (x) => x <= OFF / 2;

if(process.platform === 'darwin'){
  try { app.setActivationPolicy('accessory'); } catch(_){}
}
app.focus = () => {};
app.show = () => {};
if(app.dock){ app.dock.show = () => Promise.resolve(); }

const Base = electron.BrowserWindow;
const orig = {
  setBounds: Base.prototype.setBounds,
  setContentBounds: Base.prototype.setContentBounds,
  setPosition: Base.prototype.setPosition,
  showInactive: Base.prototype.showInactive,
  setAlwaysOnTop: Base.prototype.setAlwaysOnTop,
  getBounds: Base.prototype.getBounds,
};

class QuietWindow extends Base {
  constructor(options = {}){
    const wantShow = options.show !== false;
    super(Object.assign({}, options, { x: OFF, y: OFF, show: false }));
    this.__twAot = false;
    try { orig.setAlwaysOnTop.call(this, false); } catch(_){}
    try { this.webContents.setBackgroundThrottling(false); } catch(_){}
    this.on('move', () => { try { const [x] = this.getPosition(); if(!isOff(x)) orig.setPosition.call(this, OFF, OFF); } catch(_){} });
    if(wantShow) orig.showInactive.call(this);
  }
  show(){ return orig.showInactive.call(this); }
  focus(){}
  moveTop(){}
  center(){}
  maximize(){}
  setFullScreen(){}
  setSimpleFullScreen(){}
  setAlwaysOnTop(flag){ this.__twAot = !!flag; }
  isAlwaysOnTop(){ return !!this.__twAot; }
  setBounds(b = {}, animate){ return orig.setBounds.call(this, Object.assign({}, b, { x: OFF, y: OFF }), animate); }
  setContentBounds(b = {}, animate){ return orig.setContentBounds.call(this, Object.assign({}, b, { x: OFF, y: OFF }), animate); }
  setPosition(){ return orig.setPosition.call(this, OFF, OFF); }
  /** 진짜 창 자리 · 크기(감싸지 않은 getBounds) — 시험이 «화면 밖인가» 를 볼 때 */
  __e2eRealBounds(){ return orig.getBounds.call(this); }
}

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
