/* smoke.js — 부팅 스모크 (audit.py 검사 11)
   실행:  node smoke.js       (app.js 와 같은 폴더에서)

   ★ 무엇을 잡는가
     node --check(검사 5·10)는 **문법**만 본다. 선언 순서(TDZ), 최상위에서 아직 준비 안 된 것을
     건드리는 호출, 정의보다 먼저 쓰는 const — 전부 문법상 멀쩡하므로 절대 안 걸리고,
     그런데도 app.js 가 그 줄에서 멈춰 앱이 통째로 안 켜진다.
     이 파일은 app.js 를 **실제로 평가**해서 그걸 잡는다.
     (실제로 THREE_COLORS TDZ 로 앱이 안 켜진 적이 있고, Wine 제보의 증상도 같은 종류였다.)

   ★ 무엇을 못 잡는가 — 여기서 통과했다고 앱이 정상이라는 뜻은 아니다.
     · 브라우저 API 는 흉내만 낸다. 실제 렌더링·레이아웃·WebGL 은 확인하지 않는다.
     · 이벤트 핸들러 안쪽 코드는 안 돈다(최상위와 DOMContentLoaded 까지만).
     · 네트워크(Firebase)는 없는 것으로 친다 — app.js 가 그 경우를 가드하고 있는지까지가 검사 범위다.

   ⚠️ 스텁이 부족해서 나는 실패와 진짜 버그를 구분할 것. 새 브라우저 API 를 쓰기 시작하면
     여기 STUBS 에 한 줄 추가하는 것이 맞고, app.js 를 고치는 것이 아니다.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = ['app.js', path.join('app', 'app.js')].find(p => fs.existsSync(p));
if (!FILE) { console.error('✗ app.js 를 찾지 못했습니다 (app.js 가 있는 폴더에서 실행하세요)'); process.exit(1); }

/* ── 최소 DOM 스텁 ───────────────────────────────────────────────────
   getElementById 는 **절대 null 을 돌려주지 않는다.** app.js 곳곳이
   document.getElementById('x').style.… 처럼 가드 없이 이어 쓰기 때문에,
   null 을 주면 스텁 탓에 나는 실패가 진짜 버그를 덮어버린다.
   (HTML 에 없는 id 를 쓰는지는 audit 검사 1 이 따로 본다.) */
const EL_CACHE = new Map();
/* 진짜 DOM 요소에는 부모가 있다. parentNode 를 null 로 두면
   inp.parentNode.insertBefore(...) 같은 정상 코드가 스텁 탓에 죽는다.
   모두가 공유하는 '떠 있는 부모' 하나를 두고, 그 부모의 부모만 null 로 둔다(순회가 끝나게). */
let DETACHED = null;
function el(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    nodeType: 1,
    style: (() => {
      const props = {};
      const methods = {
        setProperty(k, v) { props[k] = v; },
        removeProperty(k) { delete props[k]; },
        getPropertyValue: k => (k in props ? props[k] : ''),
        getPropertyPriority: () => '',
        item: () => '',
      };
      return new Proxy(props, {
        get: (t, k) => (k in methods ? methods[k] : (k in t ? t[k] : '')),
        set: (t, k, v) => { t[k] = v; return true; },
      });
    })(),
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false, replace() {} },
    children: [], childNodes: [], attributes: {},
    innerHTML: '', outerHTML: '', textContent: '', innerText: '', value: '', src: '', href: '',
    checked: false, disabled: false, selected: false, files: [], options: [], selectedIndex: 0,
    width: 0, height: 0, offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0,
    scrollTop: 0, scrollLeft: 0, scrollHeight: 0, scrollWidth: 0, naturalWidth: 0, naturalHeight: 0,
    parentNode: null, parentElement: null, firstChild: null, lastChild: null,
    nextSibling: null, previousSibling: null, firstElementChild: null,
    content: { firstChild: null, cloneNode: () => el('div') },
    appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild(c) { return c; },
    replaceChild(c) { return c; }, remove() {}, append() {}, prepend() {}, insertAdjacentHTML() {},
    cloneNode() { return el(tag); },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    setAttributeNS() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {}, scrollTo() {},
    setPointerCapture() {}, releasePointerCapture() {}, animate: () => ({ finished: Promise.resolve(), cancel() {} }),
    closest: () => null, matches: () => false, contains: () => false,
    querySelector: sel => bySel('el ' + sel), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    getContext: () => ctx2d(),
    toDataURL: () => 'data:image/png;base64,', toBlob(cb) { if (cb) cb(null); },
    play: () => Promise.resolve(), pause() {}, load() {},
    requestPointerLock() {}, showPicker() {},
  };
  node.parentNode = DETACHED;
  node.parentElement = DETACHED;
  return node;
}
DETACHED = el('div');
DETACHED.parentNode = null; DETACHED.parentElement = null;

function ctx2d() {
  const c = {};
  const noop = () => c;
  ['clearRect', 'fillRect', 'strokeRect', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo',
    'rect', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'clip', 'save', 'restore',
    'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'drawImage', 'putImageData',
    'setLineDash', 'fillText', 'strokeText'].forEach(k => { c[k] = noop; });
  c.measureText = () => ({ width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
  c.createImageData = () => ({ data: new Uint8ClampedArray(4) });
  c.getImageData = () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
  c.createLinearGradient = c.createRadialGradient = () => ({ addColorStop() {} });
  c.createPattern = () => null;
  return c;
}
function byId(id) {
  if (!EL_CACHE.has(id)) { const n = el('div'); n.id = id; EL_CACHE.set(id, n); }
  return EL_CACHE.get(id);
}
/* querySelector 도 null 을 안 돌려준다 — getElementById 와 같은 이유다.
   ⚠️ 대신 `if(document.querySelector('#어떤모달.on')) return;` 같은 판정은 여기서 항상 참이 된다.
     그런 코드는 대개 이벤트 핸들러 안에 있어 부팅 검사 범위 밖이지만, 최상위에 그런 분기를 두면
     스모크에서는 '모달이 열려 있는 쪽'으로 흘러간다는 것을 알고 볼 것.
   querySelectorAll 은 빈 배열 그대로 둔다 — 없는 걸 있다고 하면 순회가 스텁 위에서 돌아
   최상위와 무관한 실패가 쏟아진다. */
const SEL_CACHE = new Map();
function bySel(sel) {
  const k = String(sel);
  if (!SEL_CACHE.has(k)) SEL_CACHE.set(k, el('div'));
  return SEL_CACHE.get(k);
}

/* ── THREE 스텁 ──────────────────────────────────────────────────────
   무엇을 꺼내 쓰든, 무엇으로 new 하든 받아준다. 속성은 읽고 쓰는 대로 기억한다.
   ⚠️ 진짜 three.js 를 로드하지 않는 이유: WebGL 컨텍스트가 필요해서 Node 에서는 어차피 못 만든다.
     여기서 보는 것은 "그 줄까지 도달하는가"이지 렌더링 결과가 아니다. */
function threeNode(name) {
  const store = {
    isObject3D: true, type: name, name: '', uuid: 'stub',
    children: [], parent: null, userData: {},
    position: vec3(), rotation: vec3(), scale: vec3(1, 1, 1), quaternion: vec3(),
    matrix: mat4(), matrixWorld: mat4(), up: vec3(),
    visible: true, castShadow: false, receiveShadow: false, frustumCulled: true, renderOrder: 0,
    material: null, geometry: null, skeleton: null, morphTargetInfluences: [],
    shadow: { mapSize: { width: 0, height: 0, set() {} }, camera: {}, bias: 0, radius: 0 },
    domElement: byId('__three_canvas'),
    capabilities: { getMaxAnisotropy: () => 1, isWebGL2: true },
    info: { render: {}, memory: {} },
    shadowMap: { enabled: false, type: 0 },
    outputEncoding: 0, toneMapping: 0, physicallyCorrectLights: false,
  };
  return new Proxy(function stub() {}, {
    get(_t, k) {
      if (typeof k === 'symbol') {
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === Symbol.iterator) return function* () {};
        return undefined;
      }
      if (k in store) return store[k];
      // 못 보던 이름은 "불러도 되고 new 해도 되고 속성도 있는" 것으로 돌려준다
      const child = threeNode(name + '.' + k);
      store[k] = child;
      return child;
    },
    set(_t, k, v) { store[k] = v; return true; },
    has() { return true; },
    apply() { return threeNode(name + '()'); },
    construct() { return threeNode('new ' + name); },
  });
}
function vec3(x, y, z) {
  const v = { x: x || 0, y: y || 0, z: z || 0, w: 0 };
  const self = () => v;
  ['set', 'copy', 'add', 'sub', 'multiply', 'divide', 'multiplyScalar', 'divideScalar', 'addScalar',
    'normalize', 'applyQuaternion', 'applyMatrix4', 'applyEuler', 'setScalar', 'setFromEuler',
    'lerp', 'clamp', 'negate', 'cross', 'crossVectors', 'subVectors', 'addVectors', 'setFromMatrixPosition',
  ].forEach(k => { v[k] = function () { return v; }; });
  v.clone = () => vec3(v.x, v.y, v.z);
  v.length = () => 0; v.lengthSq = () => 0; v.distanceTo = () => 0; v.dot = () => 0;
  v.toArray = () => [v.x, v.y, v.z];
  v.setFromSpherical = self;
  return v;
}
function mat4() {
  const m = { elements: new Array(16).fill(0) };
  ['identity', 'copy', 'multiply', 'premultiply', 'multiplyMatrices', 'makeRotationFromEuler',
    'compose', 'decompose', 'invert', 'getInverse', 'setPosition', 'lookAt', 'extractRotation',
  ].forEach(k => { m[k] = () => m; });
  m.clone = () => mat4();
  return m;
}

/* ── 전역 ────────────────────────────────────────────────────────────
   ⚠️ setTimeout / setInterval / requestAnimationFrame 은 **등록만 하고 실행하지 않는다.**
     실제로 돌리면 부팅 이후의 코드(렌더 루프 등)가 스텁 위에서 무한히 돌면서
     최상위와 무관한 실패를 쏟아낸다. 여기서 보는 것은 부팅까지다. */
const listeners = {};
const g = globalThis;
/* Node 22 는 navigator·crypto·performance 를 getter 전용 전역으로 갖고 있다.
   그냥 대입하면 "which has only a getter" 로 죽으므로 defineProperty 로 덮는다. */
function def(name, value){
  try{ g[name] = value; if(g[name] === value) return; }catch(_){}
  try{ Object.defineProperty(g, name, { value, writable:true, configurable:true, enumerable:true }); }catch(_){}
}
g.window = g;
g.self = g;
g.globalThis = g;
g.document = {
  nodeType: 9,
  readyState: 'complete',
  documentElement: el('html'),
  head: el('head'),
  body: el('body'),
  createElement: t => el(t),
  createElementNS: (_ns, t) => el(t),
  createTextNode: t => ({ nodeType: 3, textContent: String(t == null ? '' : t) }),
  createDocumentFragment: () => el('fragment'),
  getElementById: byId,
  querySelector: bySel,
  querySelectorAll: () => [],
  getElementsByClassName: () => [],
  getElementsByTagName: () => [],
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  removeEventListener() {},
  dispatchEvent: () => true,
  execCommand: () => true,
  hasFocus: () => true,
  exitPointerLock() {},
  activeElement: null,
  fonts: { ready: Promise.resolve(), add() {}, load: () => Promise.resolve() },
  visibilityState: 'visible',
  hidden: false,
  cookie: '',
  title: '',
};
g.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
g.removeEventListener = () => {};
g.dispatchEvent = () => true;

const store = {};
g.localStorage = {
  getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
  key: i => Object.keys(store)[i] || null,
  get length() { return Object.keys(store).length; },
};
g.sessionStorage = g.localStorage;

g.innerWidth = 1920; g.innerHeight = 1080;
g.devicePixelRatio = 1;
g.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1080 };
g.location = { href: 'file:///app/index.html', origin: 'file://', protocol: 'file:', search: '', hash: '', reload() {} };
def('navigator', { userAgent: 'smoke', platform: 'Win32', language: 'ko-KR', languages: ['ko-KR'], onLine: true, clipboard: { writeText: () => Promise.resolve() } });
g.history = { pushState() {}, replaceState() {}, back() {} };
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
g.getComputedStyle = () => new Proxy({}, { get: (_t, k) => (k === 'getPropertyValue' ? () => '' : '') });

g.setTimeout = () => 0;
g.setInterval = () => 0;
g.clearTimeout = () => {};
g.clearInterval = () => {};
g.requestAnimationFrame = () => 0;
g.cancelAnimationFrame = () => {};
g.queueMicrotask = () => {};
g.requestIdleCallback = () => 0;

g.THREE = threeNode('THREE');
g.Image = function () { return el('img'); };
g.Audio = function () { const a = el('audio'); a.volume = 1; a.loop = false; a.currentTime = 0; return a; };
g.FileReader = function () {
  return { readAsDataURL() {}, readAsText() {}, readAsArrayBuffer() {}, addEventListener() {}, result: null, onload: null, onerror: null };
};
g.Blob = function () { return { size: 0, type: '', arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }; };
g.File = g.Blob;
g.FormData = function () { return { append() {}, get: () => null }; };
g.XMLHttpRequest = function () { return { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} }; };
g.fetch = () => Promise.reject(new Error('smoke: network disabled'));
g.WebSocket = function () { return { send() {}, close() {}, addEventListener() {} }; };
g.ResizeObserver = function () { return { observe() {}, unobserve() {}, disconnect() {} }; };
g.MutationObserver = function () { return { observe() {}, disconnect() {}, takeRecords: () => [] }; };
g.IntersectionObserver = g.ResizeObserver;
g.Event = function (t) { return { type: t, preventDefault() {}, stopPropagation() {} }; };
g.CustomEvent = g.Event;
g.MouseEvent = g.Event; g.KeyboardEvent = g.Event; g.PointerEvent = g.Event;
g.DOMParser = function () { return { parseFromString: () => g.document }; };
g.URL = g.URL || {};
if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:stub';
if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = () => {};
g.atob = s => Buffer.from(String(s), 'base64').toString('binary');
g.btoa = s => Buffer.from(String(s), 'binary').toString('base64');
def('crypto', g.crypto || {});
if (!g.crypto.subtle) g.crypto.subtle = { digest: () => Promise.resolve(new ArrayBuffer(32)) };
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = a => a;
if (!g.crypto.randomUUID) g.crypto.randomUUID = () => 'stub-uuid';
g.alert = () => {}; g.confirm = () => false; g.prompt = () => null;
g.open = () => null; g.close = () => {}; g.focus = () => {}; g.blur = () => {};
g.scrollTo = () => {}; g.getSelection = () => ({ toString: () => '', removeAllRanges() {} });

/* ── 다른 script 가 거는 이름 ────────────────────────────────────────
   app.js 는 HTML 이 먼저 싣는 파일들이 거는 이름(window.X = … · 맨 위 function)을 typeof 가드 없이 바로 부른다(개정 239).
   여기서는 app.js 만 돌리므로, HTML 의 <script src="parts/…"> 목록에서 app.js 앞 파일을 **진짜로 실어** 둔다(못 실으면 그대로 실패).
   ⚠️ 목록을 손으로 적지 않는다 — 파일이 늘면 조용히 낡는다. */
(function loadSiblingScripts(){
  /* require 줄은 스텁을 빌려 쓰는 검사들이 걸러 내므로 process.getBuiltinModule 로 받는다 */
  const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path'), vm = process.getBuiltinModule('vm');
  const htmlPath = ['desk-companion-prototype.html', path.join('app', 'desk-companion-prototype.html')].find(p => fs.existsSync(p));
  if (!htmlPath) return;
  const html = fs.readFileSync(htmlPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  /* app.js **보다 먼저** 실리는 파일만 — 진짜 앱에서도 app.js 를 싣는 순간 뒤 파일의 이름은 아직 없다 */
  const all = [...html.matchAll(/<script\b([^>]*)\bsrc="parts\/([^"]+\.js)"/g)].filter(m => !/type="module"/.test(m[1])).map(m => m[2]);
  const iApp = all.findIndex(s => /(^|\/)app\.js$/.test(s));
  const srcs = all.slice(0, iApp < 0 ? 0 : iApp);
  /* app.js 가 아직 «typeof 이름 === 'undefined' 면 빈 껍데기» 로 받는 모듈은 싣지 않는다 — 실으면 검사마다 따로 다루던 그 갈래가 바뀐다 */
  const appPath = ['app.js', path.join('parts', 'app.js'), path.join('app', 'parts', 'app.js')].find(x => fs.existsSync(x));
  const appSrc = appPath ? fs.readFileSync(appPath, 'utf8') : '';
  const shellGuarded = (n) => new RegExp('typeof\\s+' + n.replace(/\$/g, '\\$') + "\\s*===\\s*'undefined'").test(appSrc);
  for (const s of srcs) {
    const p = [s, path.basename(s), path.join('parts', s), path.join('app', 'parts', s)].find(x => fs.existsSync(x));
    if (!p) continue;
    const t = fs.readFileSync(p, 'utf8');
    const exp = [...t.matchAll(/(?:window|root)\.([A-Za-z_$][\w$]*)\s*=\s*api\b/g)].map(m => m[1]);
    if (exp.length && exp.every(shellGuarded)) continue;
    /* 진짜로 싣는다(진짜 앱과 같은 구현). 못 실으면 대역으로 넘기지 않고 그대로 던진다 — 조용히 넘어가는 자리를 만들지 않는다 */
    vm.runInThisContext(t, { filename: path.basename(p) });
  }
})();

/* firebaseAPI / companion 은 **일부러 안 만든다.**
   app.js 는 둘 다 없을 수 있다고 보고 가드해야 한다(웹 미리보기·초기 로딩 순간이 실제로 그렇다).
   여기서 스텁을 깔아버리면 그 가드가 빠진 곳을 영영 못 잡는다. */

/* ── 실행 ────────────────────────────────────────────────────────── */
const say = console.log;
const noisy = [];
console.log = (...a) => { noisy.push(a.join(' ')); };
console.warn = () => {};
console.info = () => {};
console.debug = () => {};

let failed = null;
/* html 이 app.js **앞에** 싣고 app.js 가 최상위에서 바로 쓰는 모듈 — 같은 순서로 먼저 평가한다.
   (스텁이 아니라 진짜 파일이다. 빠지면 app.js 가 첫 줄에서 «정의 안 됨» 으로 서는데, 그건 앱의 버그가 아니다) */
const PRELOAD = ['human-ear.js', 'wd-ear.js'];
/* safe-html.js — 🛡️ 화면에 넣는 값 씻기(window.TwSafeHtml). app.js escHtml · 모듈들이 부를 때 읽는다 — 맨 먼저. */
PRELOAD.push('safe-html.js');
/* scheduler.js — 📅 스케줄러 · 🔔 일정 알림(앱 FSD 1번). app.js 는 없어도 빈 껍데기로 돌지만, 그러면 모듈이 만들 때 하는 일
   (버튼 연결 · 알림 구독 · 자정 타이머)을 아무도 안 굴린다 — 여기서 같이 싣고 굴린다.
   ⚠️ 윗줄 모양은 sim-wd-ear.js 가 글자 그대로 본다 — 목록에 끼우지 말고 여기서 붙인다. */
PRELOAD.push('scheduler.js');
/* weekly-challenge.js — 👑 달성표(앱 FSD 2번). 같은 까닭 — 만들 때 하는 일(로컬 기록 읽기 · 부팅 동기화 · 20초 tick · 버튼 연결)을 같이 굴린다. */
PRELOAD.push('weekly-challenge.js');
/* pk-bgm.js — 🎵 스티커사진 창 BGM. purikura-ui.js 가 만들 때 부르므로 그보다 먼저. */
PRELOAD.push('pk-bgm.js');
/* purikura-ui.js — 📷 스티커사진 창(앱 FSD 3번). 같은 까닭 — 만들 때 하는 일(_pkWire: 버튼 · 창 끌기 · ⎋ 사다리 등록)을 같이 굴린다. */
PRELOAD.push('purikura-ui.js');
/* guestbook.js — 📖 방명록(앱 FSD 4번). 같은 까닭 — 만들 때 하는 일(#mhGuestbookBtn 연결 · window 고리 등록)을 같이 굴린다. */
PRELOAD.push('guestbook.js');
/* friend-manage.js — 👥 친구 관리 · 👋 새 친구 요청 팝업(앱 FSD 5번). 같은 까닭 — 만들 때 하는 일은 없지만(상태 초기값뿐) 부르는 곳이 빈 껍데기가 아닌 진짜를 부르게 같이 싣는다. */
PRELOAD.push('friend-manage.js');
/* pomodoro.js — 🍅 뽀모도로(앱 FSD 6번). 같은 까닭 — 만들 때 하는 일(tw.pomo 읽기 · 버튼 연결 · 1초 tick · window._pomoShowText 고리)을 같이 굴린다. */
PRELOAD.push('pomodoro.js');
/* myhome-sticker.js — 🎨 마이홈 스티커 관리 창 · 편집모드 · 드래그 · 회전 · 크기(앱 FSD 7번). 같은 까닭 — 만들 때 하는 일(#stMgrClose · #stMgrBringAll 연결)을 같이 굴린다. */
/* myhome-sticker-rules.js — 🔒 스티커 잠금 · 순서 규칙(순수 함수). 관리 창 · 편집 묶음이 만들 때 TwMyHomeStickerRules 를 받으므로 먼저. */
PRELOAD.push('myhome-sticker-rules.js');
PRELOAD.push('myhome-sticker.js');
/* gacha.js — 🎰 파츠 가챠 코어 · 파츠 보관함(T) · 뽑기 창(앱 FSD 8번). 같은 까닭 — 만들 때 하는 일(보유분 · 보너스 읽기 · 부팅 동기화 4.2초 · 10분 tick · 창 버튼 · ESC · 바깥 클릭 연결)을 같이 굴린다. */
PRELOAD.push('gacha.js');
/* myhome-edit.js — 🏠 마이홈 페이지 편집 묶음 · 👑 디자인 스튜디오 · 프리셋(앱 FSD 7-2). 같은 까닭 — 만들 때 하는 일(버튼 · 입력칸 연결 · window 고리 · BGM 창 구독)을 같이 굴린다. */
PRELOAD.push('myhome-edit.js');
/* room-invite-ui.js — 🙋 투게더룸 친구 초대 · 🚪 방 초대 받기 팝업(앱 FSD 10번). 같은 까닭 — 만들 때 하는 일(친구 고르기 창 버튼 · 끌기 · resize 연결 · 초대 수신 구독 또는 firebase-ready 기다림)을 같이 굴린다. */
PRELOAD.push('room-invite-ui.js');
/* focus-log.js — 🕒 포커스 기록 팝업(앱 FSD 13번). 같은 까닭 — 만들 때 하는 일(버튼 · ESC 등록 · window._focusLogClamp · 매초 갱신 · 타이틀바 끌기 연결)을 같이 굴린다. */
PRELOAD.push('focus-log.js');
/* chat-window.js — 💬 대화창 배선(앱 FSD 14번). 같은 까닭 — 만들 때 하는 일(버튼 · 메뉴 · 끌기 · 크기 손잡이 · ESC · 입력 · 이모티콘 그리드 연결 · 저장값 반영 · 복사 · 탭 묶기)을 같이 굴린다. */
PRELOAD.push('chat-window.js');
/* drag-scroll.js — 🖱 목록 끌어 움직이기. myhome-ui.js 가 만들 때 건다. */
PRELOAD.push('drag-scroll.js');
/* myhome-inbox.js — 📩 수령함 · 💝 선물함 · 👥 마이홈 친구 목록(앱 FSD 15번). 같은 까닭 — 만들 때 하는 일(상태 초기값)과 app.js 가 원래 자리에서 부르는 createMyHomeInbox 를 같이 굴린다. */
/* inbox-sections.js — 📩 우편함 칸 나누기 규칙(순수 함수). 수령함 모듈이 만들 때 TwInboxSections 를 받으므로 진짜가 먼저 있게. */
PRELOAD.push('inbox-sections.js');
PRELOAD.push('myhome-inbox.js');
/* help-site.js · help-tab.js — 📘 도움말 탭. app.js 가 만들 때 TwHelpTab 을 부르고, 그 모듈이 TwHelpSite 를 받으므로 진짜가 먼저 있게. */
PRELOAD.push('help-site.js');
PRELOAD.push('help-tab.js');
/* playlist.js — 🎵 상태칩 플레이리스트(앱 FSD 16번). 같은 까닭 — 만들 때 하는 일(🪟 창 위치 초기화 등록 · 저장값 읽기 · 버튼 · ESC · 끌기 연결 · 미니미 ·
   300ms 폴링 · BGM 신호 구독 · 음량 한 번 · window 고리)과 app.js 가 원래 자리에서 부르는 createPlaylist 를 같이 굴린다. */
PRELOAD.push('playlist.js');
/* admin/admin-license-bulk.js — 🛠️ 📄 엑셀 라이선스 일괄 발급 · 🔒 시크릿룸 발급(관리자 코드 admin 폴더 1번). 같은 까닭 — 만들 때 하는 일
   (버튼 연결 · window._lxHideWin)과 app.js 가 원래 자리에서 부르는 createAdminLicenseBulk 를 같이 굴린다. 관리자 모듈은 parts/admin/ 에 있다. */
PRELOAD.push('admin-license-bulk.js');
/* admin/admin-console.js — 🛠️ 🧹 F12 콘솔 도구 일곱(관리자 코드 admin 폴더 2번). 같은 까닭 — 만들 때 하는 일(window 에 콘솔 함수 걸기)과
   app.js 가 원래 자리에서 부르는 createAdminConsole 을 같이 굴린다. */
PRELOAD.push('admin-console.js');
/* admin/admin-license.js · admin-notice.js · admin-category.js — 🛠️ 라이선스 발급 · 공지 · 카테고리 관리(관리자 코드 admin 폴더 3번).
   같은 까닭 — 만들 때 하는 일(버튼 연결)과 app.js 가 원래 자리에서 부르는 create 셋을 같이 굴린다. */
PRELOAD.push('admin-license.js', 'admin-notice.js', 'admin-category.js');
/* admin/admin-part-register.js — 🛠️ 파츠 · 책상 · 아이템 등록 창(관리자 코드 admin 폴더 4번). 같은 까닭 — 만들 때 하는 일(버튼 · 파일 칸 연결)과
   app.js 가 원래 자리에서 부르는 createAdminPartRegister 를 같이 굴린다. */
PRELOAD.push('admin-part-register.js');
/* admin/admin-users.js · admin-launcher.js — 🛠️ 통계 · 초대권 지급 · 방 종료 · 유령 방 · 게임 설정 · 광고 배너 편집(관리자 코드 admin 폴더 5번).
   같은 까닭 — 만들 때 하는 일(버튼 연결)과 app.js 가 원래 자리에서 부르는 create 둘을 같이 굴린다. */
PRELOAD.push('admin-users.js', 'admin-launcher.js');
/* admin/admin-asset.js — 🛠️ 📦 책상·아이템 코드 · 🎁 커미션 캐릭터 · 🔐 암호화 GLB 불러오기(관리자 코드 admin 폴더 6번). 같은 까닭 — 만들 때 버튼 연결과 createAdminAsset. */
PRELOAD.push('admin-asset.js');
/* admin/admin-mode.js — 🛠️ 🔐 관리자 모드 진입(관리자 코드 admin 폴더 7번). 같은 까닭 — 만들 때 하는 일(비밀번호 창 연결 · Ctrl+E · Ctrl·⌘+클릭 가로채기)과
   app.js 가 원래 자리에서 부르는 createAdminMode · 부팅 때 adminMode.refreshAdminVisibility 를 같이 굴린다. */
PRELOAD.push('admin-mode.js');
/* report.js · admin/admin-report.js — 🚩 신고하기 · 관리자 신고 목록(앱 FSD 11번). 같은 까닭 — 만들 때 하는 일(관리자 버튼 연결)과 create 둘. */
PRELOAD.push('report.js', 'admin-report.js');
/* my-info.js — 🪪 [내 정보] 화면 · 🏆 랭킹(앱 FSD 17번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyInfo 를 같이 굴린다. */
PRELOAD.push('my-info.js');
/* chars.js — 🧬 캐릭터 보관함(chars) — 병합 · 이관 · 조율(앱 FSD 18번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createChars 를 같이 굴린다. */
PRELOAD.push('chars.js');
/* slot-sync.js — ☁️ 슬롯 기기 간 동기화 · 연동 UI(앱 FSD 19번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSlotSync 를 같이 굴린다. */
PRELOAD.push('slot-sync.js');
/* away-pic.js — 🫧 자리비움 그림(앱 FSD 22번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAwayPic 를 같이 굴린다. */
PRELOAD.push('away-pic.js');
/* myhome-ui.js — 🏠 마이홈 창 버튼 연결(앱 FSD 22번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomeUi 를 같이 굴린다. */
PRELOAD.push('myhome-ui.js');
/* tricks.js — 💃 깜짝쇼 · 🪄 때리기(앱 FSD 25번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createTricks 를 같이 굴린다. */
PRELOAD.push('tricks.js');
/* ride-bench.js — 🗼 올라타기 · 🪑 멀티좌석 책상(앱 FSD 30번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRideBench 를 같이 굴린다. */
PRELOAD.push('ride-bench.js');
/* ride-chain.js — 🗼 탑 바닥 찾기(구역 떼기 C · w1). 같은 까닭 — app.js 가 부르는 createRideChain 을 같이 굴린다. */
PRELOAD.push('ride-chain.js');
/* part-paint.js — 🖍️ 파츠에 직접 그리기 · 그림칸(앱 FSD 21번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createPartPaint 를 같이 굴린다. */
PRELOAD.push('part-paint.js');
/* focus-level.js — ⭐ 포커스 레벨 · 공유 · 태블릿(앱 FSD 26번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFocusLevel 를 같이 굴린다. */
PRELOAD.push('focus-level.js');
/* chat-ui.js — 💬 채팅 — 날리기 · 읽음 · 탭 · 복사 · 이모티콘(앱 FSD 24번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createChatUi 를 같이 굴린다. */
PRELOAD.push('chat-ui.js');
/* nav.js — 🧭 창 열기 통로(모듈 순환 끊기 6). 같은 까닭 — 창 모듈이 만들 때 여는 함수를 걸고 부르는 쪽이 이름으로 부탁한다(빈 껍데기면 부탁이 아무 일도 안 한다). */
PRELOAD.push('nav.js');
/* demoji-catalog.js — 😊 기본 이모티콘 목록(맨 아래 고정 표). chat-ui 를 만드는 줄이 TwDemojiCatalog 를 넘기므로 먼저 싣는다. */
PRELOAD.push('demoji-catalog.js');
/* account-state.js — 🪪 계정 핵심 상태(모듈 순환 끊기 5). 같은 까닭 — 초대 게이트 · 계정 · 내 정보 · 포커스 레벨이 만들 때 이 모듈의 알림 자리(onPremiumChanged)를 받는다. */
PRELOAD.push('account-state.js');
/* license-gate.js — 🎟️ 초대장 · 라이선스(앱 FSD 31번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLicenseGate 를 같이 굴린다. */
PRELOAD.push('license-gate.js');
/* account.js — 🔑 계정(앱 FSD 23번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAccount 를 같이 굴린다. */
PRELOAD.push('account.js');
/* wardrobe.js — 🎨 꾸미기 창(앱 FSD 29번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createWardrobe 를 같이 굴린다. */
PRELOAD.push('wardrobe.js');
/* settings-panel.js — ⚙ 설정 패널(앱 FSD 27번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSettingsPanel 를 같이 굴린다. */
PRELOAD.push('settings-panel.js');
/* desktop-run.js — 🖥️ 데스크탑 실행 화면(앱 FSD 32번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDesktopRun 를 같이 굴린다. */
/* click-through-policy.js — 클릭 통과 판단 규칙(순수 함수). desktop-run.js 가 deps.clickPolicy 로 받으므로 먼저 싣는다. */
PRELOAD.push('click-through-policy.js');
PRELOAD.push('desktop-run.js');
/* room-entry.js — 🛰 방 서버 · 입장 · 방 개수(앱 FSD 33번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRoomEntry 를 같이 굴린다. */
PRELOAD.push('room-entry.js');
/* label-measure.js — 📐 라벨 잰 값 기억. overhead.js 가 만들 때 부르므로 그보다 먼저. */
PRELOAD.push('label-measure.js');
/* overhead.js — 💬 머리 위 말풍선 · 🏷️ 이름표(앱 FSD 34번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createOverhead 를 같이 굴린다. */
PRELOAD.push('overhead.js');
/* room-sync.js — 📦 방 def 전송 · poke · 자동 퇴장 · 감시견(앱 FSD 35번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRoomSync 를 같이 굴린다. */
PRELOAD.push('room-sync.js');
/* status-chip.js — 📍 상태칩 자리 · 팝업 · 상태 이모지(앱 FSD 36번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createStatusChip 를 같이 굴린다. */
PRELOAD.push('status-chip.js');
/* premium-assets.js — 🎀 프리미엄 파츠 · 라이선스 책상(앱 FSD 37번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createPremiumAssets 를 같이 굴린다. */
PRELOAD.push('premium-assets.js');
/* char-code.js — 📦 캐릭터 복제 코드(앱 FSD 38번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCharCode 를 같이 굴린다. */
PRELOAD.push('char-code.js');
/* dice-games.js — 🎲 주사위 · 하루 횟수(앱 FSD 39번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDiceGames 를 같이 굴린다. */
PRELOAD.push('dice-games.js');
/* user-name.js — 🏷️ 닉네임 저장(모듈 순환 끊기 7 — 설정 창에서 떼어 냄). 같은 까닭 — app.js 가 원래 자리에서 부르는 createUserName 을 같이 굴린다. */
PRELOAD.push('user-name.js');
/* program-settings.js — ⚙️ 프로그램 설정 창(앱 FSD 40번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createProgramSettings 를 같이 굴린다. */
PRELOAD.push('program-settings.js');
/* oss-licenses.js — 📄 오픈소스 라이선스 창. 만들 때 링크 둘에 클릭을 건다 — app.js 가 부르는 createOssLicenses 를 같이 굴린다. */
PRELOAD.push('oss-licenses.js');
/* chat-prefs.js — 💬 채팅 투명도 · 알림음 · 기록 삭제(앱 FSD 41번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createChatPrefs 를 같이 굴린다. */
PRELOAD.push('chat-prefs.js');
/* rich-text.js — 🛡️ 리치 텍스트 sanitize(앱 FSD 42번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRichText 를 같이 굴린다. */
PRELOAD.push('rich-text.js');
/* win-stack.js — 🪟 창 겹침 · ESC 스택(앱 FSD 42번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createWinStack 를 같이 굴린다. */
PRELOAD.push('win-stack.js');
/* sfx.js — 🔊 효과음 공장(앱 FSD 42번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSfx 를 같이 굴린다. */
PRELOAD.push('sfx.js');
/* face-heal.js — 얼굴 자동 복구(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFaceHeal 를 같이 굴린다. */
PRELOAD.push('face-heal.js');
/* slot-save.js — 슬롯 저장(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSlotSave 를 같이 굴린다. */
PRELOAD.push('slot-save.js');
/* interaction-desk.js — 상호작용 책상 카탈로그(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createInteractionDesk 를 같이 굴린다. */
PRELOAD.push('interaction-desk.js');
/* ad-banner.js — 광고 배너 · 게임 설정(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAdBanner 를 같이 굴린다. */
PRELOAD.push('ad-banner.js');
/* license-request.js — 라이선스 요청(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLicenseRequest 를 같이 굴린다. */
PRELOAD.push('license-request.js');
/* fn-keys.js — 함수키 단축키(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFnKeys 를 같이 굴린다. */
PRELOAD.push('fn-keys.js');
/* hidden-seats.js — 워킹룸 숨기기(앱 FSD 43번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createHiddenSeats 를 같이 굴린다. */
PRELOAD.push('hidden-seats.js');
/* theme-ui.js — 테마(앱 FSD 44번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createThemeUi 를 같이 굴린다. */
PRELOAD.push('theme-ui.js');
/* myhome-sticker-layout.js — 마이홈 스티커 배치(앱 FSD 44번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomeStickerLayout 를 같이 굴린다. */
PRELOAD.push('myhome-sticker-layout.js');
/* myhome-diag.js — 마이홈 클릭 진단(앱 FSD 44번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomeDiag 를 같이 굴린다. */
PRELOAD.push('myhome-diag.js');
/* myhome-state.js — 🏠 마이홈 공용 상태(모듈 순환 끊기 4). 같은 까닭 — 친구 홈 구경 · 페이지가 읽고 쓰는 값이 빈 껍데기가 아닌 진짜에 있게. */
PRELOAD.push('myhome-state.js');
/* myhome-hooks.js — 🪝 마이홈 고리판(모듈 순환 끊기 8). 같은 까닭 — 편집 묶음 · 마이홈 창이 만들 때 거는 저장 · 배경 · 테마 · BGM 함수를 부르는 쪽이 진짜에서 찾게. */
PRELOAD.push('myhome-hooks.js');
/* myhome-preset.js — 👑 디자인 프리셋 규칙(순수 함수). 같은 까닭 — 편집 묶음이 만들 때 TwMyHomePreset 을 받으므로 진짜가 먼저 있게. */
PRELOAD.push('myhome-preset.js');
/* myhome-visit.js — 마이홈 데이터 · 친구 홈 구경(앱 FSD 44번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomeVisit 를 같이 굴린다. */
PRELOAD.push('myhome-visit.js');
/* exp-bar.js — 경험치 바(앱 FSD 45번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createExpBar 를 같이 굴린다. */
PRELOAD.push('exp-bar.js');
/* focus-share.js — 오늘 기록 전시(앱 FSD 45번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFocusShare 를 같이 굴린다. */
PRELOAD.push('focus-share.js');
/* focus-total.js — 포커스 누적(앱 FSD 45번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFocusTotal 를 같이 굴린다. */
PRELOAD.push('focus-total.js');
/* commission.js — 커미션 · 저장 에셋(앱 FSD 45번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCommission 를 같이 굴린다. */
PRELOAD.push('commission.js');
/* code-crypto.js — 캐릭터 코드 암호화(앱 FSD 45번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCodeCrypto 를 같이 굴린다. */
PRELOAD.push('code-crypto.js');
/* add-friend.js — 책상에서 친구 추가(앱 FSD 46번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAddFriend 를 같이 굴린다. */
PRELOAD.push('add-friend.js');
/* floaters.js — 이모지 떠오르기(앱 FSD 46번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFloaters 를 같이 굴린다. */
PRELOAD.push('floaters.js');
/* roulette.js — 러시안룰렛(앱 FSD 46번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRoulette 를 같이 굴린다. */
PRELOAD.push('roulette.js');
/* chat-lock.js — 시크릿룸 채팅 잠금(앱 FSD 46번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createChatLock 를 같이 굴린다. */
PRELOAD.push('chat-lock.js');
/* device-lost.js — 밀려난 기기 처리(앱 FSD 46번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeviceLost 를 같이 굴린다. */
PRELOAD.push('device-lost.js');
/* demoji-palette.js — 기본 이모티콘 팔레트(앱 FSD 46번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDemojiPalette 를 같이 굴린다. */
PRELOAD.push('demoji-palette.js');
/* outside-close.js — 팝업 바깥 클릭으로 닫기(앱 FSD 47번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createOutsideClose 를 같이 굴린다. */
PRELOAD.push('outside-close.js');
/* launcher-chrome.js — 런처 타이틀바 · 팝업 흐림(앱 FSD 47번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLauncherChrome 를 같이 굴린다. */
PRELOAD.push('launcher-chrome.js');
/* myhome-links.js — 마이홈 본문 링크(앱 FSD 47번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomeLinks 를 같이 굴린다. */
PRELOAD.push('myhome-links.js');
/* async-prompt.js — 인앱 프롬프트(앱 FSD 47번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAsyncPrompt 를 같이 굴린다. */
PRELOAD.push('async-prompt.js');
/* myhome-page.js — 마이홈 불러오기 · 그리기(앱 FSD 47번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomePage 를 같이 굴린다. */
PRELOAD.push('myhome-page.js');
/* theme.js — 디자인 테마(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createTheme 를 같이 굴린다. */
PRELOAD.push('theme.js');
/* asset-code.js — 에셋 코드 암호화(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAssetCode 를 같이 굴린다. */
PRELOAD.push('asset-code.js');
/* license-key.js — 라이선스 키 등록 · 해제(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLicenseKey 를 같이 굴린다. */
PRELOAD.push('license-key.js');
/* license-ui.js — 라이선스 등록 화면(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLicenseUi 를 같이 굴린다. */
PRELOAD.push('license-ui.js');
/* race-picker.js — 종족 선택창(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRacePicker 를 같이 굴린다. */
PRELOAD.push('race-picker.js');
/* wardrobe-panel.js — 꾸미기 사이드 패널(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createWardrobePanel 를 같이 굴린다. */
PRELOAD.push('wardrobe-panel.js');
/* lv-tier.js — 레벨 티어(앱 FSD 48번). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLvTier 를 같이 굴린다. */
PRELOAD.push('lv-tier.js');
/* friends-sub.js — 친구 목록 구독 한 벌(상태 · 자동 다시 걸기). 같은 까닭 — app.js 가 원래 자리에서 부르는 createFriendsSub 를 같이 굴린다. */
/* friends-firebase.js · friends-api.js · friends-port.js — 친구 데이터 provider · 포트. 같은 까닭 — app.js 가 원래 자리에서 부르는 create 를 같이 굴린다. */
PRELOAD.push('friends-firebase.js');
PRELOAD.push('friends-api.js');
PRELOAD.push('friends-port.js');
/* source-switch.js — 기능별 받는 곳 고르기(서버 / 파이어베이스). app.js 가 친구 포트를 만들 때 TwSourceSwitch.serverFirst 를 넘긴다. */
PRELOAD.push('source-switch.js');
/* data-gateway.js — 범용 데이터 통로(firebase-init.js 가 기본 동작 앞에 둔다). 표가 비면 모든 동작이 Firebase 그대로. */
PRELOAD.push('data-gateway.js');
PRELOAD.push('friends-sub.js');
/* myhome-init.js — 마이홈 처음 준비(앱 FSD 44번 남은 몫). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMyHomeInit 를 같이 굴린다. */
PRELOAD.push('myhome-init.js');
/* dot-render.js — 🕹️ 도트 모드 머티리얼(텍스처 필터 · PS1 셰이더)(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDotRender 를 같이 굴린다. */
PRELOAD.push('ps1-dither.js');   // 🕹️ PS1 디더 규칙 — dot-render.js 가 만들 때 읽는다
PRELOAD.push('dot-render.js');
/* launcher-controls.js — 🎛️ 런처 컨트롤(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLauncherControls 를 같이 굴린다. */
PRELOAD.push('launcher-controls.js');
/* seat-camera.js — 🎥 좌석 줄 카메라 · 캔버스 맞춤(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatCamera 를 같이 굴린다. */
PRELOAD.push('seat-camera.js');
/* presence.js — 🛰 방 접속 상태(Presence)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createPresence 를 같이 굴린다. */
PRELOAD.push('presence.js');
/* launcher-preview.js — 🖼️ 런처 미리보기(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLauncherPreview 를 같이 굴린다. */
PRELOAD.push('launcher-preview.js');
/* part-scene.js — 🧊 파츠 GLB 파싱 캐시 · 썸네일(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createPartScene 를 같이 굴린다. */
PRELOAD.push('part-scene.js');
/* catalog-source.js — 🔌 카탈로그 데이터 provider(구역 떼기 C · w2 · 서버 이관). 같은 까닭 — app.js 가 고르는 줄의 createCatalogSource 를 같이 굴린다. */
PRELOAD.push('catalog-source.js');
/* admin-thumbs.js — 🖼️ 관리자 콘솔 — 파츠 썸네일 다시 굽기(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAdminThumbs 를 같이 굴린다. */
PRELOAD.push('admin-thumbs.js');
/* mat-tone.js — 💡 재질 톤(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createMatTone 를 같이 굴린다. */
PRELOAD.push('mat-tone.js');
/* seat-friend-req.js — 🙋 좌석 우클릭 친구 신청(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatFriendReq 를 같이 굴린다. */
PRELOAD.push('seat-friend-req.js');
/* glb-idb-cache.js — 💾 GLB 영구 캐시(IndexedDB)(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createGlbIdbCache 를 같이 굴린다. */
PRELOAD.push('glb-idb-cache.js');
/* catalog-glb.js — 🔗 카탈로그 GLB 해결(glbUrl → rec.glb)(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCatalogGlb 를 같이 굴린다. */
PRELOAD.push('catalog-glb.js');
/* catalog-sync.js — 🔄 카탈로그 실시간 동기화(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCatalogSync 를 같이 굴린다. */
PRELOAD.push('catalog-sync.js');
/* seat-layout.js — 🪑 좌석 줄 배치(layoutSeats 본문)(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatLayout 를 같이 굴린다. */
PRELOAD.push('seat-layout.js');
/* seat-refit.js — 🪑 파츠 구성이 바뀐 뒤 좌석 다시 맞추기 한 벌. 같은 까닭 — app.js 가 좌석 배치 자리에서 부르는 createSeatRefit 을 같이 굴린다. */
PRELOAD.push('seat-refit.js');
/* desk-items.js — 🧸 책상 위 아이템 등록부(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeskItems 를 같이 굴린다. */
PRELOAD.push('desk-items.js');
/* light-tone.js — 💡 재질 톤(조명 예산 · 파츠 · 아이템 · 책상 emissive)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createLightTone 를 같이 굴린다. */
PRELOAD.push('light-tone.js');
/* creator-preview.js — 🧍 생성기 미리보기(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCreatorPreview 를 같이 굴린다. */
PRELOAD.push('creator-preview.js');
/* creator-flow.js — 🧍 생성기 흐름(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCreatorFlow 를 같이 굴린다. */
PRELOAD.push('creator-flow.js');
/* creator-save.js — 🧍 생성기 완료(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCreatorSave 를 같이 굴린다. */
PRELOAD.push('creator-save.js');
/* desk-visual.js — 🪑 책상 모양(바꿔 끼기 · 색 · 좌석 책상)(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeskVisual 를 같이 굴린다. */
PRELOAD.push('desk-visual.js');
/* seat-equalize.js — 🪑 좌석 크기 평준화(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatEqualize 를 같이 굴린다. */
PRELOAD.push('seat-equalize.js');
/* commission-import.js — 🎨 커미션 코드 입력(C 구역 떼기 · w3). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCommissionImport 를 같이 굴린다. */
PRELOAD.push('commission-import.js');
/* deco-parts-visibility.js — 🎁 꾸미기 파츠 표시(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDecoPartsVisibility 를 같이 굴린다. */
PRELOAD.push('deco-parts-visibility.js');
/* creator-xform.js — 🧭 생성기 변형 — 아이템 3D 기즈모 · 좌석 세팅(6단계)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCreatorXform 를 같이 굴린다. */
PRELOAD.push('creator-xform.js');
/* ride-measure.js — 📏 올라타기 실측(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRideMeasure 를 같이 굴린다. */
PRELOAD.push('ride-measure.js');
/* toast.js — 🍞 토스트 · 저장 실패 문구(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createToast 를 같이 굴린다. */
PRELOAD.push('toast.js');
/* ride-tuning.js — 🎛️ 올라타기 · 묘기 튜닝 값(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createRideTuning 를 같이 굴린다. */
PRELOAD.push('ride-tuning.js');
/* char-measure.js — 📐 캐릭터 실측(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCharMeasure 를 같이 굴린다. */
PRELOAD.push('char-measure.js');
/* floor-snap-diag.js — 🩺 바닥 맞춤 진단(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createFloorSnapDiag 를 같이 굴린다. */
PRELOAD.push('floor-snap-diag.js');
/* seat-model-load.js — 📦 좌석 모델 싣기(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatModelLoad 를 같이 굴린다. */
PRELOAD.push('seat-model-load.js');
/* seat-panel.js — 🎚️ 좌석 패널(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatPanel 를 같이 굴린다. */
PRELOAD.push('seat-panel.js');
/* user-status-table.js — 🍚 상태 표 · 커스텀 상태 저장값(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createUserStatusTable 를 같이 굴린다. */
PRELOAD.push('user-status-table.js');
/* chip-popups.js — 🗂️ 상태칩 팝업 «한 번에 하나»(구역 떼기 C · w1). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createChipPopups 를 같이 굴린다. */
PRELOAD.push('chip-popups.js');
/* creator-state.js — 🧍 생성기 상태(C 구역 떼기 w4). 같은 까닭 — app.js 가 createCreatorState 로 만든 crState 를 곳곳이 읽는다. */
PRELOAD.push('creator-state.js');
/* paint-geom.js — ✏️ 그리기 공용 기하(획 조각 · 거울 UV — 생성기 · 꾸미기 파츠)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createPaintGeom 를 같이 굴린다. */
PRELOAD.push('paint-geom.js');
/* paint-stroke.js — 🖌 얼굴에 칠하기(획 · 대칭 · 페인트통 · 스포이드)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createPaintStroke 를 같이 굴린다. */
PRELOAD.push('paint-stroke.js');
/* stamp.js — 🖼 생성기 이미지 도장(띄워 놓고 확정 박기)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createCrStamp 를 같이 굴린다. */
PRELOAD.push('stamp.js');
/* asset-import.js — 📥 코드로 추가하기(책상 · 아이템 · 파츠 — 생성기 · 꾸미기 안에서)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAssetImport 를 같이 굴린다. */
PRELOAD.push('asset-import.js');
/* desk-preset-store.js — 💾 책상 프리셋 저장(5칸 · localStorage)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeskPresetStore 를 같이 굴린다. */
/* json-store.js — localStorage JSON 읽기 · 쓰기 한 곳(TwJsonStore). 책상 프리셋 저장 · animal.js 가 쓴다. */
PRELOAD.push('json-store.js');
PRELOAD.push('desk-preset-store.js');
/* desk-preset.js — 🗂 책상 · 좌석 세팅 프리셋(담기 · 적용 · 5칸 화면)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeskPreset 를 같이 굴린다. */
PRELOAD.push('desk-preset.js');
/* asset-cards.js — 🃏 자산 카드(썸네일 카드 · 도트 썸네일 · 순서 손잡이 — 생성기 · 꾸미기)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createAssetCards 를 같이 굴린다. */
PRELOAD.push('asset-cards.js');
/* desk-setup.js — 🪑 생성기 책상 세팅(5단계 — 책상 · 아이템 카드 · 순서 · 색 · 크기 · 아이템 고르기)(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeskSetup 를 같이 굴린다. */
PRELOAD.push('desk-setup.js');
/* seat-menu.js — 🖱 좌석 우클릭 메뉴(C 구역 떼기 w4). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatMenu 를 같이 굴린다. */
PRELOAD.push('seat-menu.js');
/* net-ready.js — 🛰 «네트워크(provider) 준비됨» 기다리기 한 곳(firebase-ready 묶기). 같은 까닭 — 스케줄러 · 방 · 계정 · 카탈로그 모듈이 만들 때 TwNetReady.whenNetReady 를 부른다. */
PRELOAD.push('net-ready.js');
/* upload-cache.js — 🗂️ 업로드 캐시 상한 규칙 한 곳. app.js 가 만들 때 TwUploadCache.createUploadCache 를 부른다. */
PRELOAD.push('upload-cache.js');
/* seat-eq-clamp.js — 🪑 평준화 가두기(책상 위 파츠를 자기 자리 안으로)(구역 떼기 C · wAC). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createSeatEqClamp 를 같이 굴린다. */
PRELOAD.push('seat-eq-clamp.js');
/* desk-place.js — 📐 책상 자리 · 크기(크기 · 위치 · z 보정 · 파츠 핀)(구역 떼기 C · w2). 같은 까닭 — 만들 때 하는 일과 app.js 가 원래 자리에서 부르는 createDeskPlace 를 같이 굴린다. */
PRELOAD.push('desk-place.js');
/* body-measure.js — 캐릭터 몸 박스 재기 한 규칙. app.js 가 맨 앞(SETUP)에서 createBodyMeasure 로 만든다. */
PRELOAD.push('body-measure.js');
for (const f of PRELOAD) {
  const p = [f, path.join(path.dirname(FILE), f), path.join(path.dirname(FILE), 'admin', f), path.join(path.dirname(FILE), 'parts', 'admin', f)].find(x => fs.existsSync(x));
  if (!p) { say('? 원본 못 찾음 — ' + f); process.exit(2); }
  try { vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p }); }
  catch (e) { failed = failed || { where: f, err: e }; }
}
if (!failed) try {
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
} catch (e) {
  failed = { where: '최상위', err: e };
}

// 최상위가 끝났으면, 부팅 이벤트 핸들러까지 한 번 돌려본다 —
// 실제 초기화가 DOMContentLoaded 안에 있는 경우를 여기서 잡는다.
if (!failed) {
  for (const type of ['DOMContentLoaded', 'load']) {
    for (const fn of listeners[type] || []) {
      try { fn({ type, preventDefault() {}, stopPropagation() {} }); }
      catch (e) { failed = { where: type, err: e }; break; }
    }
    if (failed) break;
  }
}

console.log = say;
if (failed) {
  const e = failed.err;
  const stack = (e && e.stack ? String(e.stack) : String(e)).split('\n').slice(0, 6).join('\n');
  say('✗ ' + failed.where + ' 실행 중단 — 앱이 안 켜집니다');
  say(stack);
  if (noisy.length) say('\n--- 중단 직전 로그 ' + Math.min(5, noisy.length) + '줄 ---\n' + noisy.slice(-5).join('\n'));
  say('✗ 실패 1건');
  process.exit(1);
}
/* ⚠️ 마지막 줄은 러너가 읽는다(run.js 의 PASS_LINE·FAIL_LINE). 설명은 윗줄, 판정만 끝줄.
     옛 판은 `✓ 부팅 스모크 통과 —…` 라 「전부 통과」가 없어 `종료코드 0` 으로 찍혔다.
   ★ 이 아래는 **290줄 `/* ── 실행` 표식보다 뒤**다. 이 파일을 읽는 검사 19개는 전부
     그 표식 앞에서 잘라 스텁만 쓰므로 여기를 고쳐도 그쪽은 안 움직인다.
     ⚠️ 거꾸로 **표식 앞은 한 줄도 건드리지 말 것** — 19개가 통째로 흔들린다. */
say('  ' + FILE + ' 최상위와 부팅 이벤트가 끝까지 실행됨'
  + ' (getElementById ' + EL_CACHE.size + '개 · 로그 ' + noisy.length + '줄)');
say('전부 통과 ✅');
process.exit(0);
