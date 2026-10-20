/* ═══ 💡 sim-mat-tone.js — 💡 재질 톤 모듈 (2026-10-16 신설 · C 구역 떼기 · w3) ═══════════════
   app.js 의 얼굴 텍스처 갈아끼우기 · 평탄 조명 함수 을 parts/character/mat-tone.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리).
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(applyLightPresetToInstance · setFaceMap)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 만드는 줄 · deps 1줄 그대로 · 부르는 곳은 matToneMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・4절: 동작 — 진짜 코어 톤(빌드 사본) · 가짜 재질로 입력 → 결과(경계값 포함)를 본다. 🐾 동물 귀 깜빡임은 이 모듈 몫(앱)
   [실행] app.js · desk-companion-prototype.html · mat-tone.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["mat-tone.js","parts/character/mat-tone.js","app/parts/character/mat-tone.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — mat-tone.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["tone"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["applyLightPresetToInstance","setFaceMap"];
const MOVED = ["setFaceMap","applyLightPresetToInstance"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  tone: lightToneMod.toneCore,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다. */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
/* over: deps 덮어쓰기 · env: 전역 덮어쓰기(document · window · THREE …) */
function build(src, over, env){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  Object.assign(deps, over || {});
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const E = Object.assign({ window: win, document: any, localStorage: ls, navigator: any, firebaseAPI: any, companion: any, setTimeout: () => 0, setInterval: () => 0, clearTimeout: () => {}, clearInterval: () => {},
    requestAnimationFrame: () => 0, THREE: any, addEventListener: () => {}, removeEventListener: () => {}, module: undefined, MutationObserver: class { observe(){} disconnect(){} }, ResizeObserver: class { observe(){} disconnect(){} },
    performance: { now: () => 0 }, console: { log(){}, warn(){}, error(){} }, Image: any, confirm: () => true, devicePixelRatio: 1 }, env || {});
  const keys = Object.keys(E);
  const api = new Function(...keys, src + '\nreturn window.TwMatTone;')(...keys.map(k => E[k]));
  return api.createMatTone(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwMatTone = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwMatTone(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const matToneMod = TwMatTone.createMatTone({"), '만드는 줄(가드 없이 — 모듈은 늘 싣는다)');
  const mk = (app.match(new RegExp("const matToneMod = TwMatTone\\.createMatTone\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);")) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(new RegExp("const matToneMod = [\\s\\S]*?\\n\\}\\);"), '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));
  t(!bare.length, '부르는 곳은 matToneMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/mat-tone.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/mat-tone.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/mat-tone.js"></script>', '')],
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const matToneMod = TwMatTone.createMatTone({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const matToneMod = TwMatTone.createMatTone({", "const matToneMod = TwMatTone.createMatTone({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwMatTone = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith("const matToneMod =")) continue; const n = EXPORTS.filter(x => ![].includes(x)).find(x => ls[i].includes("matToneMod." + x)); if(n){ ls[i] = ls[i].replace("matToneMod." + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createMatTone(deps){', 'function createMatTone(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [nm, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), nm + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 4. 동작');
/* 동작 검사용 작은 가짜 DOM — id 로 찾은 요소를 기억하고 style · classList · onclick · 이벤트를 받는다. */
function fakeDom(absent){   // absent: 처음엔 없는(코드가 만들어 붙이는) id 목록
  const gone = new Set(absent || []);
  const els = {};
  const mkEl = (id, tag) => {
    const cls = new Set();
    const ev = {};
    const el = {
      id: id || '', tagName: (tag || 'div').toUpperCase(), style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', title: '', disabled: false, children: [], parentElement: null,
      classList: { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), contains: (c) => cls.has(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; v ? cls.add(c) : cls.delete(c); return v; } },
      addEventListener: (t, f) => { (ev[t] = ev[t] || []).push(f); }, removeEventListener: () => {},
      appendChild: (c) => { el.children.push(c); c.parentElement = el; if(c.id) els[c.id] = c; return c; },
      getContext: () => new Proxy({}, { get: () => () => {} }), querySelector: () => null, querySelectorAll: () => [],
      fire: (t, e) => { (ev[t] || []).forEach(f => f(Object.assign({ stopPropagation(){}, preventDefault(){}, currentTarget: el }, e || {}))); },
      click: () => { if(typeof el.onclick === 'function') el.onclick({ stopPropagation(){}, preventDefault(){}, currentTarget: el }); el.fire('click'); },
    };
    return el;
  };
  const docEv = {};
  const document = {
    getElementById: (id) => els[id] || (gone.has(id) ? null : (els[id] = mkEl(id))),
    createElement: (tag) => mkEl('', tag),
    querySelector: (s) => els['q:' + s] || (els['q:' + s] = mkEl('q:' + s)),
    querySelectorAll: () => [],
    addEventListener: (t, f) => { (docEv[t] = docEv[t] || []).push(f); },
    removeEventListener: () => {},
    body: mkEl('body'),
    fire: (t) => (docEv[t] || []).forEach(f => f({})),
  };
  return { document, els, mkEl };
}

/* 재질 손질 두 함수 — 가짜 재질(색 · 맵)로 입력 → 결과를 본다. 3D 엔진 없이 돈다(순수 계산). */
function col(r, g, b){ return { r, g, b, copy(c){ this.r = c.r; this.g = c.g; this.b = c.b; return this; }, multiplyScalar(k){ this.r *= k; this.g *= k; this.b *= k; return this; }, setScalar(v){ this.r = this.g = this.b = v; return this; } }; }
function mat(o){ return Object.assign({ map: null, emissiveMap: null, needsUpdate: false, color: col(1, 1, 1), emissive: col(0, 0, 0), userData: {} }, o || {}); }
const FLAT = 0.35;
/* 사람 몫(얼굴 맵 · 평탄 조명)은 캐릭터 코어(createTone · #437) — 빌드 사본으로 만든 진짜 톤을 넘긴다 */
const CORE = ['vendor/char-core/char-core.iife.js', 'app/vendor/char-core/char-core.iife.js'].map(read).find(Boolean);
if(!CORE){ say('  ? 원본 못 찾음 — vendor/char-core/char-core.iife.js'); process.exit(2); }
const charCore = new Function(CORE + '\nreturn TwCharCore;')();
const toneOf = (F) => charCore.createTone({ THREE: { Color: function(){ return col(1, 1, 1); } }, flatEmissive: F, fixMatLighting(){} });
const T = build(MOD, { tone: toneOf(FLAT) });
const near = (a, b) => Math.abs(a - b) < 1e-9;
{ let threw = false; try{ T.setFaceMap(null, {}); T.setFaceMap(mat(), null); }catch(_){ threw = true; }
  chk(!threw, 'setFaceMap — 재질 · 텍스처가 없으면 조용히 돌아간다'); }
{ const m = mat(), tex = { id: 't' }; T.setFaceMap(m, tex);
  chk(m.map === tex && m.emissiveMap === tex && m.needsUpdate === true, 'setFaceMap — map 과 emissiveMap 을 함께 갈고 needsUpdate'); }
{ const m = mat(), keep = { id: 'old' }; m.map = keep; T.setFaceMap(m, null);
  chk(m.map === keep && !m.needsUpdate, 'setFaceMap — 텍스처가 null 이면 원래 맵을 그대로 둔다'); }
{ const fT = { id: 'f' }, bT = { id: 'b' }, open = { id: 'open' }, blink = { id: 'blink' };
  const earL = mat({ map: fT }), earR = mat({ map: fT });
  const body = mat({ userData: { animalBlinkTex: blink, animalEars: [{ mat: earL, fT, bT }, { mat: earR, fT, bT }] } });
  T.setFaceMap(body, blink);
  chk(earL.map === bT && earR.map === bT && earL.emissiveMap === bT && earL.needsUpdate, '🐾 몸이 감은눈 텍스처면 귀도 감은 그림으로');
  earL.needsUpdate = false; T.setFaceMap(body, blink);
  chk(earL.needsUpdate === false, '🐾 귀가 이미 같은 그림이면 다시 갈지 않는다');
  T.setFaceMap(body, open);
  chk(earL.map === fT && earR.map === fT, '🐾 감은눈이 아닌 텍스처면 귀는 뜬 그림으로');
  const noMat = mat({ userData: { animalBlinkTex: blink, animalEars: [{ mat: null, fT, bT }] } });
  let threw = false; try{ T.setFaceMap(noMat, blink); }catch(_){ threw = true; }
  chk(!threw, '🐾 귀 재질이 빠진 항목은 건너뛴다');
  const empty = mat({ userData: { animalEars: [] } }); T.setFaceMap(empty, open);
  chk(empty.map === open, '귀 목록이 비어 있으면 몸만 간다(사람과 같다)'); }
{ let threw = false; try{ T.applyLightPresetToInstance(null); T.applyLightPresetToInstance({}); }catch(_){ threw = true; }
  chk(!threw, 'applyLightPresetToInstance — 비었거나 재질이 없어도 던지지 않는다'); }
{ const face = mat({ map: { id: 'fm' } }), up = mat({ map: { id: 'um' }, color: col(0.5, 0.2, 1) }), lo = mat({ color: col(1, 0, 0) }), hat = mat({ map: { id: 'hm' }, color: col(0, 1, 0) });
  T.applyLightPresetToInstance({ faceMat: face, upMat: up, loMat: lo, hatMat: hat });
  chk(face.emissiveMap === face.map && face.emissive.r === FLAT && face.emissive.b === FLAT && face.needsUpdate, '얼굴 — emissiveMap = map · emissive 는 흰빛 × FLAT_EMISSIVE');
  chk(up.emissiveMap === up.map && near(up.emissive.r, 0.5 * FLAT) && near(up.emissive.g, 0.2 * FLAT) && near(up.emissive.b, FLAT), '상의 — emissive = 옷색 × FLAT_EMISSIVE · 맵 맞춤');
  chk(lo.emissiveMap === null && lo.emissive.r === FLAT && lo.emissive.g === 0, '하의(맵 없음) — emissiveMap 은 비운 채 색만 평탄화');
  chk(hat.emissiveMap === hat.map && hat.emissive.g === FLAT, '모자 — 같은 규칙'); }
{ const face = mat({ map: { id: 'fm' } });
  const other = mat({ color: col(0.4, 0.4, 0.4) }), textured = mat({ map: { id: 'tm' }, color: col(1, 1, 1) }), noColor = mat({ color: null }), noEm = mat({ emissive: null });
  T.applyLightPresetToInstance({ faceMat: face, litMats: [face, other, textured, noColor, noEm, null] });
  chk(near(other.emissive.r, 0.4 * FLAT) && other.needsUpdate, '이름으로 안 갈리는 나머지 메쉬 — 텍스처가 없어도 같은 평탄화(파츠 경로와 같은 규칙)');
  chk(textured.emissiveMap === textured.map && textured.emissive.r === FLAT, '텍스처 있는 나머지 메쉬 — 맵 맞춤 + 평탄화');
  chk(noColor.emissive.r === FLAT, '색이 없는 재질 — emissive 를 FLAT_EMISSIVE 로');
  chk(noEm.emissive === null, 'emissive 가 없는 재질 · null 은 건너뛴다');
  chk(face.emissive.r === FLAT, '얼굴은 litMats 에 있어도 한 번만(위 규칙 그대로)'); }
{ const T0 = build(MOD, { tone: toneOf(0) }); const up = mat({ color: col(1, 1, 1) }); T0.applyLightPresetToInstance({ upMat: up });
  chk(up.emissive.r === 0, '경계 — FLAT_EMISSIVE 0 이면 emissive 0'); }

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
