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
try {
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
  process.exit(1);
}
say('✓ 부팅 스모크 통과 — ' + FILE + ' 최상위와 부팅 이벤트가 끝까지 실행됨'
  + ' (getElementById ' + EL_CACHE.size + '개 · 로그 ' + noisy.length + '줄)');
process.exit(0);
