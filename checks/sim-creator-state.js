/* sim-creator-state.js — 🧍 생성기 상태(creator/creator-state.js) 처음 값 · 읽기/쓰기 · 연결
   실행:  node sim-creator-state.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — app.js 곳곳의 꼭대기 let 58개(생성기 세션 값)를 한 모듈로 모았다(C 구역 떼기 w4).
     처음 값이 하나라도 달라지거나, app.js 에 옛 let 이 다시 생겨 두 벌이 되면 생성기가 조용히 어긋난다.
   ・1절: 만들 때 — 이름 58개 · 처음 값(옮기기 전 let 초기값 그대로) · DESK_SCALE_DEFAULT 를 따른다
   ・2절: 읽기 · 쓰기 — 대입하면 읽힌다 · 안쪽을 바꾸면 같은 객체 · 만들 때마다 따로(객체 처음 값도 새것) · ++ · +=
   ・3절: app.js 연결 — 만드는 줄(가드 없이 · deps 1) · 옛 let 없음 · 맨 이름 참조 없음(crState.이름 으로만) · 부팅 순서 · html · smoke
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/creator-state.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — creator-state.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

/* 옮기기 전 app.js 의 let 초기값 그대로(DESK_SCALE_DEFAULT 는 넘긴 값) — 이 표가 바뀌면 생성기 처음 화면이 바뀐다 */
const INIT = {
  cTopColor: '#9dba8a', cBotColor: '#d98e73', editingSlot: -1, pendingSlot: 0,
  crStep: 1, brushColor: '#333333', brushSize: 11, eraser: false, blinkEdited: false, skinIndex: 0, currentCreatorDef: null,
  cXform: { s: 0.7, y: 0, z: 0, rot: 0 }, cDeskColor: '#c9a36a', cDeskScale: 'DSD', cDeskLenX: 1, cDeskPos: { x: 0, y: 0, z: 0 },
  faceCamSaved: null, deskCamSaved: null, painting: false, lastPX: null, lastPY: null, lastSX: null, lastSY: null, symmetry: false,
  crPaintTool: null, _pLastScr: null, _pLastUV: null, _pLastPt: null, _pLastSUV: null,
  stampMode: false, stampImg: null, stampDirty: false, stampPlace: { cx: 0, cy: 0, w: 120, h: 120, rot: 0, aspect: 1 },
  crItemPage: 0, _assetImpKind: 'item', _assetImpCat: null,
  cRenderer: null, cScene: null, cCam: null, cBase: null, cAmb: null, cKey: null, cFill: null, cDesk: null, cDeskMat: null, cFloor: null,
  camDist: 1.5, camYaw: 0, camPitch: 0.05, orbiting: false, lastMX: 0, lastMY: 0, _rcOrbit: null, cFaceDist: 1.15, cBodyDist: 3.9,
  activeCustomDeskId: null, cDeskTemplate: null, cDeskGlbB64: null,
};
const NAMES = Object.keys(INIT);
const load = (src) => new Function('window', 'module', src + '\nreturn window.TwCreatorState;')({}, undefined);

function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let T = null, s = null, err = null;
  try { T = load(src); s = T.createCreatorState({ DESK_SCALE_DEFAULT: 0.3 }); } catch (e) { err = e; }
  t(!err && s && Object.keys(s).length === NAMES.length && NAMES.every((n) => Object.keys(s).includes(n)), '만들 때 던지지 않고 이름 ' + NAMES.length + '개를 내놓는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!s) return r;
  const want = (n) => (INIT[n] === 'DSD' ? 0.3 : INIT[n]);
  const bad = NAMES.filter((n) => JSON.stringify(s[n]) !== JSON.stringify(want(n)));
  t(!bad.length, '처음 값 — 옮기기 전 let 초기값 그대로' + (bad.length ? ' — 다름: ' + bad.join(' · ') : ''));
  t(s.cDeskScale === 0.3 && T.createCreatorState({ DESK_SCALE_DEFAULT: 0.175 }).cDeskScale === 0.175, '책상 크기 처음 값은 넘긴 DESK_SCALE_DEFAULT 를 따른다');

  const noAcc = NAMES.filter((n) => { const d = Object.getOwnPropertyDescriptor(s, n); return !d || typeof d.get !== 'function' || typeof d.set !== 'function'; });
  t(!noAcc.length, '이름마다 읽기 · 쓰기 함수(get · set)' + (noAcc.length ? ' — 없음: ' + noAcc.join(' · ') : ''));
  const rt = NAMES.filter((n) => { const v = { mark: n }; s[n] = v; return s[n] !== v; });
  t(!rt.length, '대입하면 그 값이 읽힌다(58개 모두)' + (rt.length ? ' — 안 됨: ' + rt.join(' · ') : ''));
  const a = T.createCreatorState({ DESK_SCALE_DEFAULT: 0.175 }), b = T.createCreatorState({ DESK_SCALE_DEFAULT: 0.175 });
  a.cDeskPos.x = 5; a.cBase = 'A';
  t(a.cDeskPos.x === 5 && b.cDeskPos.x === 0 && b.cBase === null && a.cXform !== b.cXform && a.stampPlace !== b.stampPlace, '안쪽을 바꾸면 같은 객체에 남는다 · 만들 때마다 따로(객체 처음 값도 새것)');
  a.crStep++; a.camYaw += 0.5;
  t(a.crStep === 2 && a.camYaw === 0.5, '++ · += 도 그대로(읽고 다시 대입)');
  return r;
}

const NAME_RE = new RegExp('(^|[^.\\w$\'"])(' + NAMES.map((n) => n.replace(/\$/g, '\\$')).join('|') + ')\\b(?!\\s*:)', 'm');
function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  const mk = (app.match(/const crState = TwCreatorState\.createCreatorState\(\{\n([\s\S]*?)\n\}\);/) || [])[1];
  t(mk !== undefined && mk.trim() === 'DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,', '만드는 줄(가드 없이) · deps 1(DESK_SCALE_DEFAULT)');
  const reLet = new RegExp('^let [^\\n]*\\b(' + NAMES.map((n) => n.replace(/\$/g, '\\$')).join('|') + ')\\s*=', 'm');
  const lm = A.match(reLet);
  t(!lm, 'app.js 에 옛 let 이 없다(두 벌이 안 된다)' + (lm ? ' — ' + lm[0].slice(0, 60) : ''));
  const bare = A.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''").replace(/\bcrState\.[\w$]+/g, ' ').match(NAME_RE);   // 문자열 · crState.이름 은 빼고
  t(!bare, 'app.js 는 생성기 상태를 crState.이름 으로만 읽고 쓴다(맨 이름 참조 없음)' + (bare ? ' — «' + bare[2] + '»' : ''));
  const iD = app.indexOf('\nconst DESK_SCALE_DEFAULT = '), iC = app.indexOf('\nconst crState = TwCreatorState.'), iU = app.search(/\bcrState\.(?!createCreatorState)/);
  const iTop = app.indexOf('\n  crState.crPaintTool=PaintTools.createPaintTools(');
  t(iD > 0 && iC > iD && iTop > iC, '부팅 순서 — DESK_SCALE_DEFAULT → 만드는 줄 → 부팅 때 바로 쓰는 줄(붓 도구 만들기)');
  t(iU > 0, 'app.js 가 crState.이름 을 쓴다');
  const iM = html.indexOf('<script src="parts/creator/creator-state.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/creator-state.js 를 app.js 보다 먼저 싣는다');
  return r;
}

say('── 1 · 2. 처음 값 · 읽기 · 쓰기');
behave(MOD).forEach(([ok, msg]) => chk(ok, msg));
say('── 3. app.js 연결');
wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
chk(!SMOKE || /PRELOAD\.push\('creator-state\.js'\);/.test(SMOKE), 'smoke 가 creator-state.js 를 먼저 싣는다');
say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['붓 크기 처음 값 11 → 12', (m) => m.replace('brushSize=11', 'brushSize=12'), null, null],
  ['책상 크기 처음 값을 숫자로', (m) => m.replace('cDeskScale=DESK_SCALE_DEFAULT', 'cDeskScale=0.175'), null, null],
  ['setter 하나 빠짐', (m) => m.replace(', set cBase(v){ cBase = v; }', ''), null, null],
  ['getter 가 처음 값을 돌려줌', (m) => m.replace('get camYaw(){ return camYaw; }', 'get camYaw(){ return 0; }'), null, null],
  ['객체 처음 값을 같이 씀', (m) => m.replace('function createCreatorState(deps){', 'const _sharedPos = {x:0, y:0, z:0};\nfunction createCreatorState(deps){').replace('let cDeskPos = {x:0, y:0, z:0};', 'let cDeskPos = _sharedPos;'), null, null],
  ['만들 때 던짐', (m) => m.replace('function createCreatorState(deps){', 'function createCreatorState(deps){ throw new Error("깨 봄");'), null, null],
  ['app.js 에 옛 let 이 다시', null, (a) => a + '\nlet cBase=null;', null],
  ['app.js 에 맨 이름 참조', null, (a) => a.replace('crState.crPaintTool=PaintTools', 'crPaintTool=PaintTools'), null],
  ['만드는 줄 deps 빠짐', null, (a) => a.replace('createCreatorState({\n  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,\n});', 'createCreatorState({\n});'), null],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/creator-state.js"></script>', '')],
];
for (const [name, fm, fa, fh] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
  let rows; try { rows = (fm ? behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 생성기 상태는 creator/creator-state.js 에서'));
process.exit(fail ? 1 : 0);
