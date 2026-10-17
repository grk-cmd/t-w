/* ═══ 🕹️ sim-dot-render.js — 🕹️ 도트 모드 머티리얼 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 도트 텍스처 필터 · PS1 셰이더 본문 을 parts/shared/dot-render.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 씬으로 켜고 끄기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(applyDotTextureFilter · applyPS1Shader)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 1줄 그대로 · 부르는 곳은 dotRenderMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   ・5절: 켠 뒤 들어온 것 — 새 메쉬 · 가짜 표식(clone) · 덮어쓴 색조 셰이더 · 셰이더 캐시 키 · 프레임 루프 훑기(fix · CONFIRM w1 1번)
   [실행] app.js · desk-companion-prototype.html · dot-render.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["dot-render.js","parts/shared/dot-render.js","app/parts/shared/dot-render.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — dot-render.js'); process.exit(2); }
/* 🕹️ PS1 디더 규칙(색 단계 · Bayer 표) — dot-render.js 가 만들 때 읽는다 */
const PS1D = (() => { const src = ["ps1-dither.js","parts/shared/ps1-dither.js","app/parts/shared/ps1-dither.js"].map(read).find(Boolean); if(!src) return null; const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; })();
if(!PS1D){ say('  ? 원본 못 찾음 — ps1-dither.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["scene","ps1Dither"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["applyDotTextureFilter","applyPS1Shader","sweepIfOn"];
const MOVED = ["_dotFilterState","applyDotTextureFilter","_PS1_LEVELS","_PS1_FRAG_INJECT","_ps1State","applyPS1Shader"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  scene: scene,","  ps1Dither: TwPs1Dither,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwDotRender;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createDotRender(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwDotRender = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwDotRender(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("DOT_RENDER_MOD_OFF") && app.includes("const dotRenderMod = TwDotRender.createDotRender({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const dotRenderMod = TwDotRender\\.createDotRender\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const dotRenderMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 dotRenderMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/shared/dot-render.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/shared/dot-render.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/shared/dot-render.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const dotRenderMod = TwDotRender.createDotRender({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const dotRenderMod = TwDotRender.createDotRender({", "const dotRenderMod = TwDotRender.createDotRender({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDotRender = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const dotRenderMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('dotRenderMod.' + x)); if(n){ ls[i] = ls[i].replace('dotRenderMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createDotRender(deps){', 'function createDotRender(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 씬 위에서 도트 필터 · PS1 셰이더를 켜고 끈다(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 텍스처 필터 · PS1 셰이더 켜고 끄기');
{
  const THREE_ = { NearestFilter: 1003, LinearFilter: 1006, LinearMipmapLinearFilter: 1008 };
  const loadDot = (scene) => {
    if(typeof MOD === 'string' && MOD){
      const win = {};
      new Function('window', 'module', 'THREE', MOD)(win, undefined, THREE_);
      return win.TwDotRender.createDotRender({ scene, ps1Dither: PS1D });
    }
    /* 옮기기 전 — app.js 의 그 자리 글을 그대로 굴린다 */
    const a = SRC.indexOf('/* 도트 렌더 모드일 때 씬의'), b = SRC.indexOf('/* ============================================================ FIT */');
    return new Function('scene', 'THREE', SRC.slice(a, b) + '\nreturn { applyDotTextureFilter, applyPS1Shader };')(scene, THREE_);
  };
  const tex = (f) => ({ minFilter: f, magFilter: f, needsUpdate: false, userData: {} });
  const mkScene = () => {
    const t1 = tex(1008), t2 = tex(1006), t3 = { minFilter: 1006, magFilter: 1006, needsUpdate: false };   // t3 — userData 없는 텍스처
    const prevObc = function(sh){ sh._prev = (sh._prev || 0) + 1; };
    const m1 = { map: t1, normalMap: t2, userData: {} }, m2 = { emissiveMap: t3, onBeforeCompile: prevObc }, m3 = { map: tex(1006), userData: {} };
    const objs = [
      { isMesh: true, material: m1 },
      { isMesh: true, material: [m2, null] },
      { isMesh: false, material: m3 },          // 메쉬가 아니면 안 건드린다
      { isMesh: true, material: null },
    ];
    return { scene: { traverse: (cb) => objs.forEach(cb) }, t1, t2, t3, m1, m2, m3, prevObc };
  };
  let S = mkScene(), D = loadDot(S.scene);
  D.applyDotTextureFilter(true);
  chk(S.t1.minFilter === 1003 && S.t1.magFilter === 1003 && S.t2.minFilter === 1003 && S.t1.needsUpdate && S.t2.needsUpdate, '도트 필터 켬 — 메쉬 텍스처(map · normalMap)가 Nearest · needsUpdate');
  chk(S.t3.minFilter === 1003 && S.t3.userData && S.t3.userData._origMinFilter === 1006, '  userData 없는 텍스처도 원래 값을 적어 두고 바꾼다');
  chk(S.m3.map.minFilter === 1006, '  메쉬가 아닌 것 · 빈 머티리얼은 그대로');
  S.t1.needsUpdate = false; D.applyDotTextureFilter(true);
  chk(S.t1.needsUpdate === false, '  다시 불러도 이미 Nearest 인 텍스처는 다시 올리지 않는다(needsUpdate 안 함)');
  D.applyDotTextureFilter(false);
  chk(S.t1.minFilter === 1008 && S.t1.magFilter === 1008 && S.t2.minFilter === 1006 && S.t3.minFilter === 1006, '도트 필터 끔 — 원래 필터로 되돌린다');

  S = mkScene(); D = loadDot(S.scene);
  D.applyPS1Shader(true);
  chk(S.m1.userData._ps1Hooked === true && S.m2.userData._ps1Hooked === true && typeof S.m1.onBeforeCompile === 'function' && S.m1.needsUpdate === true, 'PS1 켬 — 메쉬 머티리얼마다 onBeforeCompile 을 걸고 다시 컴파일');
  chk(S.m3.userData._ps1Hooked === undefined, '  메쉬가 아닌 것은 그대로');
  let sh = { fragmentShader: 'void main(){\n#include <dithering_fragment>\n}' };
  S.m2.onBeforeCompile(sh, null);
  chk(sh._prev === 1 && sh.fragmentShader.split('#include <dithering_fragment>').length === 2 && sh.fragmentShader.includes('#include <dithering_fragment>\n{') && sh.fragmentShader.includes('float _levels = 16.0;') && sh.fragmentShader.includes('_bayer[15]=5.0;'), '  셰이더 — 원래 onBeforeCompile 을 먼저 부르고 dithering_fragment 뒤에 16단계 Bayer 디더를 붙인다(three 기본 디더 줄은 남김)');
  sh = { fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }' };
  S.m1.onBeforeCompile(sh, null);
  chk(/_snapped[\s\S]*\n\}$/.test(sh.fragmentShader) && !sh.fragmentShader.includes('#include'), '  훅이 없는 셰이더면 마지막 } 앞에 넣는다');
  const obc1 = S.m1.onBeforeCompile; S.m1.needsUpdate = false; D.applyPS1Shader(true);
  chk(S.m1.onBeforeCompile === obc1 && S.m1.needsUpdate === false, '  다시 불러도 이미 건 머티리얼은 그대로(다시 컴파일 안 함)');
  D.applyPS1Shader(false);
  chk(S.m2.onBeforeCompile === S.prevObc && S.m2.userData._ps1Hooked === false && typeof S.m1.onBeforeCompile === 'function' && S.m1.userData._ps1Hooked === false, 'PS1 끔 — 원래 onBeforeCompile(없으면 빈 함수)으로 되돌린다');
  sh = { fragmentShader: 'x' }; S.m1.onBeforeCompile(sh); chk(sh.fragmentShader === 'x', '  끈 뒤 빈 함수는 셰이더를 안 건드린다');
  D.applyPS1Shader(true);
  chk(S.m1.userData._ps1Hooked === true, '  다시 켜면 또 건다');
  let threw = null; try{ const E = loadDot({ traverse: () => {} }); E.applyDotTextureFilter(true); E.applyPS1Shader(true); E.applyPS1Shader(false); }catch(e){ threw = e; }
  chk(!threw, '빈 씬이면 아무 일 없이 지나간다');
}
/* ── 5. 켠 뒤 들어온 것 — 예전엔 «마지막 상태와 같으면 돌아감» 이라 켠 뒤 더해진 메쉬는 껐다 켤 때까지 매끈했다 */
say('── 5. 켠 뒤 들어온 메쉬 · 텍스처 · 셰이더');
{
  const THREE_ = { NearestFilter: 1003, LinearFilter: 1006, LinearMipmapLinearFilter: 1008 };
  const objs = [];
  const scene = { traverse: (cb) => { scene.n++; objs.forEach(cb); }, n: 0 };
  const win = {}; new Function('window', 'module', 'THREE', MOD)(win, undefined, THREE_);
  const D = win.TwDotRender.createDotRender({ scene, ps1Dither: PS1D });
  const tex = () => ({ minFilter: 1008, magFilter: 1006, needsUpdate: false, userData: {} });
  const mesh = (m) => { const o = { isMesh: true, material: m }; objs.push(o); return o; };
  const DEFAULT_OBC = function(){};   // three 기본 onBeforeCompile 자리
  const mat = (extra) => Object.assign({ map: tex(), userData: {}, onBeforeCompile: DEFAULT_OBC }, extra || {});

  D.applyDotTextureFilter(false); D.applyPS1Shader(false);
  chk(scene.n === 0, '켠 적 없이 끄면 씬을 훑지 않는다');
  D.sweepIfOn(1e6);
  chk(scene.n === 0, '  꺼져 있으면 sweepIfOn 도 아무것도 안 한다');

  const a = mat(); mesh(a);
  D.applyDotTextureFilter(true); D.applyPS1Shader(true);
  const b = mat(); mesh(b);   // 켠 뒤 친구 입장
  D.applyDotTextureFilter(true); D.applyPS1Shader(true);
  chk(b.map.minFilter === 1003 && b.map.magFilter === 1003 && b.userData._ps1Hooked === true && b.onBeforeCompile !== DEFAULT_OBC, '켠 뒤 들어온 메쉬도 다시 부르면 도트 필터 · PS1 이 걸린다');

  /* m.clone() 사본 — userData 표식은 JSON 으로 따라오고 onBeforeCompile 은 안 따라온다 */
  const c = mat({ userData: JSON.parse(JSON.stringify(a.userData)) }); mesh(c);
  chk(c.userData._ps1Hooked === true, '  (준비) 사본에 가짜 표식이 따라왔다');
  D.applyPS1Shader(true);
  let sh = { fragmentShader: 'void main(){\n#include <dithering_fragment>\n}' }; c.onBeforeCompile(sh);
  chk(c.onBeforeCompile !== DEFAULT_OBC && sh.fragmentShader.includes('_snapped'), '가짜 표식만 있는 사본에도 실제로 셰이더를 건다');

  /* 색조 셰이더가 나중에 덮어씀(_ensureHueUniforms) */
  const hue = (shader) => { shader.fragmentShader = 'HUE;' + shader.fragmentShader; };
  a.onBeforeCompile = hue; a.needsUpdate = false;
  D.applyPS1Shader(true);
  sh = { fragmentShader: 'void main(){\n#include <dithering_fragment>\n}' }; a.onBeforeCompile(sh);
  chk(a.needsUpdate === true && sh.fragmentShader.startsWith('HUE;') && sh.fragmentShader.includes('_snapped'), '덮어쓴 색조 셰이더 위에 다시 건다(색조 먼저 · PS1 뒤)');
  chk(typeof a.customProgramCacheKey === 'function' && typeof b.customProgramCacheKey === 'function' && a.customProgramCacheKey() !== b.customProgramCacheKey(), '셰이더 캐시 키가 색조 재질과 보통 재질에서 다르다(한 셰이더를 나눠 쓰다 염색이 빠지지 않게)');
  chk(b.customProgramCacheKey() === c.customProgramCacheKey(), '  같은 원래 훅이면 키도 같다(셰이더를 쓸데없이 늘리지 않음)');

  /* 끌 때 — 그새 색조 셰이더가 덮어쓴 재질은 그 셰이더를 지우지 않는다 */
  const d = mat(); mesh(d); D.applyPS1Shader(true);
  const hue2 = function(sh){ sh.h2 = 1; }; d.onBeforeCompile = hue2;
  D.applyPS1Shader(false);
  chk(d.onBeforeCompile === hue2 && d.userData._ps1Hooked === false && !('customProgramCacheKey' in d && Object.prototype.hasOwnProperty.call(d, 'customProgramCacheKey')), '끌 때 남이 덮어쓴 onBeforeCompile 은 그대로 두고 표식 · 캐시 키만 걷는다');
  chk(b.onBeforeCompile === DEFAULT_OBC && !Object.prototype.hasOwnProperty.call(b, 'customProgramCacheKey'), '  우리 훅이면 원래 것으로 되돌리고 캐시 키도 걷는다');
  D.applyDotTextureFilter(false);
  chk(b.map.minFilter === 1008 && b.map.magFilter === 1006, '  나중에 들어온 메쉬의 텍스처도 원래 필터로 되돌린다');

  /* 프레임 루프 훑기 — 켜져 있을 때만 · SWEEP_MS 마다 한 번 */
  D.applyDotTextureFilter(true); D.applyPS1Shader(true);
  const e = mat(); mesh(e);
  const n0 = scene.n; D.sweepIfOn(5000); const n1 = scene.n; D.sweepIfOn(5100); const n2 = scene.n; D.sweepIfOn(5500);
  chk(n1 - n0 === 2 && n2 === n1 && scene.n - n2 === 2, 'sweepIfOn — 0.5초에 한 번만 훑는다(두 함수 한 번씩)');
  chk(e.map.minFilter === 1003 && e.userData._ps1Hooked === true, '  훑으면 그새 들어온 메쉬에 걸린다');
  e.map = tex(); D.sweepIfOn(6100);
  chk(e.map.minFilter === 1003, '  바꿔 낀 텍스처(표정 · 깜빡임)도 다음 훑기에 Nearest');
  D.applyDotTextureFilter(false); D.applyPS1Shader(false);
  const n3 = scene.n; D.sweepIfOn(9000);
  chk(scene.n === n3, '  끈 뒤에는 훑지 않는다');

  const frameSrc = (SRC.match(/\nfunction frame\(now, manual\)\{[\s\S]*?\n\}\n/) || [''])[0];
  chk(/\n  dotRenderMod\.sweepIfOn\(now\);/.test(frameSrc), 'app.js 프레임 루프가 dotRenderMod.sweepIfOn(now) 를 부른다');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
