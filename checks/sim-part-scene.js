/* ═══ 🧊 sim-part-scene.js — 🧊 파츠 GLB 파싱 캐시 · 도트 썸네일 굽기 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 파츠 GLB 파싱 캐시 · 썸네일 본문 을 parts/character/part-scene.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 GLB 해결 · 파싱으로 캐시 · 받기 실패 · 썸네일 광량 공식 경계 · 프레이밍).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(_forceOpaqueAlphaOutput · generatePartThumbnail · getPartScene · partSceneCache)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 9줄 그대로 · 부르는 곳은 partSceneMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · part-scene.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["part-scene.js","parts/character/part-scene.js","app/parts/character/part-scene.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — part-scene.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_applyPartMatTone","b64ToBuf","resolveCatalogGlb"];
const VAL_DEPS = ["FLAT_EMISSIVE","TONE_FRONT_TOTAL","_KEY_LIGHT_MUL","_MAIN_LIGHT_COL","_MAIN_LIGHT_INT","assetCodeMod"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["_forceOpaqueAlphaOutput","generatePartThumbnail","getPartScene","partSceneCache"];
const MOVED = ["_forceOpaqueAlphaOutput","partSceneCache","getPartScene","THUMB_SIZE","_thumbRenderer","_thumbScene","_thumbCam","_ensureThumbRig","generatePartThumbnail"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  FLAT_EMISSIVE: FLAT_EMISSIVE,","  TONE_FRONT_TOTAL: TONE_FRONT_TOTAL,","  _KEY_LIGHT_MUL: _KEY_LIGHT_MUL,","  _MAIN_LIGHT_COL: _MAIN_LIGHT_COL,","  _MAIN_LIGHT_INT: _MAIN_LIGHT_INT,","  _applyPartMatTone: (...a)=>_applyPartMatTone(...a),","  assetCodeMod: assetCodeMod,","  b64ToBuf: (...a)=>b64ToBuf(...a),","  resolveCatalogGlb: (...a)=>resolveCatalogGlb(...a),"];

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
    src + '\nreturn window.TwPartScene;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createPartScene(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwPartScene = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwPartScene(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("PART_SCENE_MOD_OFF") && app.includes("const partSceneMod = TwPartScene.createPartScene({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const partSceneMod = TwPartScene\\.createPartScene\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const partSceneMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 partSceneMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/part-scene.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/part-scene.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/part-scene.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const partSceneMod = TwPartScene.createPartScene({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const partSceneMod = TwPartScene.createPartScene({", "const partSceneMod = TwPartScene.createPartScene({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwPartScene = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const partSceneMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('partSceneMod.' + x)); if(n){ ls[i] = ls[i].replace('partSceneMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createPartScene(deps){', 'function createPartScene(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 THREE · GLB 해결 위에서 파싱 캐시 · 썸네일 굽기 · (옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 파싱 캐시 · 썸네일');
{
  const PREMOVE = !!process.env.TW_PREMOVE;   // 옮기기 전 판(app.js 의 그 자리 글)으로 같은 판정을 돌려 본다
  const mkTHREE = (log) => ({
    sRGBEncoding: 3001,
    WebGLRenderer: class { constructor(o){ this.o = o; log.renderers = (log.renderers || 0) + 1; this.domElement = { toDataURL: (t) => 'data:' + t + ';n=' + log.renders }; }
      setPixelRatio(r){ this.pr = r; } setClearColor(c, a){ log.clear = [c, a]; } render(s){ log.renders = (log.renders || 0) + 1; log.inScene = s.children.length; } },
    Scene: class { constructor(){ this.children = []; } add(o){ this.children.push(o); } remove(o){ this.children = this.children.filter(x => x !== o); } },
    AmbientLight: class { constructor(c, i){ this.color = c; this.intensity = i; log.amb = this; } },
    DirectionalLight: class { constructor(c, i){ this.color = c; this.intensity = i; this.position = { set: (...p) => { this.pos = p; } }; log.key = this; } },
    OrthographicCamera: class { constructor(l, r, t, b){ Object.assign(this, { left: l, right: r, top: t, bottom: b }); this.position = { set: () => {} }; } lookAt(){} updateProjectionMatrix(){ log.proj = { l: this.left, r: this.right, t: this.top, b: this.bottom }; } },
    Vector3: class { constructor(){ this.x = 0; this.y = 0; this.z = 0; } },
    Box3: class { setFromObject(o){ this.o = o; return this; } getSize(v){ Object.assign(v, this.o.__size); return v; } getCenter(v){ Object.assign(v, this.o.__center); return v; } },
  });
  /* 파츠 템플릿 — clone(true) 는 메쉬를 새로 만들되 머티리얼은 원본을 가리킨다(three 와 같게) */
  const mkTemplate = (size) => {
    const mat = { name: 'm', toned: 0, clone(){ return { name: 'm2', toned: 0, cloned: true }; } };
    const mk = () => { const mesh = { isMesh: true, material: mat, frustumCulled: true };
      return { mesh, __size: size, __center: { x: 1, y: 2, z: 3 }, position: { x: 0, y: 0, z: 0, sub(c){ this.x -= c.x; this.y -= c.y; this.z -= c.z; } },
        traverse(cb){ cb(this); cb(mesh); }, updateMatrixWorld(){}, clone(){ return mk(); } }; };
    const t = mk(); t.mat = mat; return t;
  };
  const C = { TONE_FRONT_TOTAL: 1.12, FLAT_EMISSIVE: 0.45, _MAIN_LIGHT_INT: 0.5, _KEY_LIGHT_MUL: 0.8, _MAIN_LIGHT_COL: 0xfff4e0 };
  const load = (over) => {
    const log = { parse: 0, resolve: 0, tone: [], published: [], toasts: [], calls: [] };
    const THREE_ = mkTHREE(log);
    const parsed = (over && over.scene) || { tag: 'scene' };
    const raw = Object.assign({
      ...C,
      _applyPartMatTone: (m) => { m.toned++; log.tone.push(m); },
      b64ToBuf: (b) => 'buf:' + b,
      resolveCatalogGlb: async (rec) => { log.resolve++; if(rec.glbUrl === 'bad') throw new Error('x'); if(rec.glbUrl !== 'none') rec.glb = 'G:' + rec.glbUrl; },
      assetCodeMod: { parseGlbFull: async (buf) => { log.parse++; log.lastBuf = buf; return { scene: parsed, animations: ['a1'] }; } },
      premiumMod: { savedParts: () => log.parts || [], persistSavedParts: () => log.calls.push('persist') },
      adminPartReg: { buildPartPublishData: (rec, ex) => ({ id: rec.id, ...ex }) },
      wardrobeMod: { renderWardrobe: () => log.calls.push('wardrobe') },
      toast: (m) => log.toasts.push(m),
      isAdmin: false,
      gachaMod: { renderGachaInv: () => log.calls.push('gacha') },
    }, over || {});
    const win = { firebaseAPI: { publishPart: async (id, d) => { log.published.push([id, d]); } } };
    const doc = { createElement: () => ({ width: 0, height: 0 }) };
    let api;
    if(!PREMOVE){
      const deps = Object.assign({}, raw, { isAdmin: () => raw.isAdmin, gachaMod: () => raw.gachaMod });
      const w = {}; new Function('window', 'module', 'THREE', 'document', MOD)(w, undefined, THREE_, doc);
      api = w.TwPartScene.createPartScene(deps);
      w.firebaseAPI = win.firebaseAPI;
      /* 모듈은 window 전역에 콘솔 함수를 건다 — 같은 window 를 다시 쓴다 */
      log.win = w;
    } else {
      const a = SRC.indexOf('/* 파츠 GLB 파싱 캐시'), b = SRC.indexOf('premiumMod.loadSavedParts();', a);
      const names = Object.keys(raw);
      api = new Function(...names, 'THREE', 'document', 'window', SRC.slice(a, b) + '\nreturn { getPartScene, generatePartThumbnail, partSceneCache, _forceOpaqueAlphaOutput };')(...names.map(n => raw[n]), THREE_, doc, win);
      log.win = win;
    }
    log.win.firebaseAPI = win.firebaseAPI;
    return { api, log, raw };
  };
  const warn = console.warn, clog = console.log; const quiet = () => { console.warn = () => {}; console.log = () => {}; }, loud = () => { console.warn = warn; console.log = clog; };
  (async () => {
    /* 파싱 캐시 */
    let { api, log } = load();
    const rec = { id: 'p1', glb: 'AAA' };
    const r1 = await api.getPartScene(rec), r2 = await api.getPartScene(rec);
    chk(r1 && r1.scene && r1.scene.tag === 'scene' && r1.animations[0] === 'a1' && log.lastBuf === 'buf:AAA', 'getPartScene — rec.glb 를 b64ToBuf → parseGlbFull 로 풀어 { scene, animations } 를 준다');
    chk(r1 === r2 && log.parse === 1 && api.partSceneCache.get('p1') === r1, '  같은 id 는 두 번째부터 캐시(파싱 1번 · 같은 객체)');
    api.partSceneCache.delete('p1'); await api.getPartScene(rec);
    chk(log.parse === 2, '  캐시를 지우면(관리자 GLB 교체) 다시 파싱한다');
    const r3 = await api.getPartScene({ id: 'p2', glbUrl: 'u2' });
    chk(log.resolve === 1 && log.lastBuf === 'buf:G:u2' && r3.scene, '  rec.glb 없고 glbUrl 만 있으면 resolveCatalogGlb 로 먼저 받는다');
    await api.getPartScene({ id: 'p0', glb: 'X' });
    chk(log.resolve === 1, '  rec.glb 가 있으면 받으러 가지 않는다');
    let e1 = null; try{ await api.getPartScene({ id: 'p3', glbUrl: 'bad' }); }catch(e){ e1 = e; }
    chk(e1 && e1.message === '파츠 GLB를 찾을 수 없어요: p3' && !api.partSceneCache.has('p3'), '  받기가 던져도 삼키고 «파츠 GLB를 찾을 수 없어요: id» 로 던진다(캐시에 안 남김)');
    let e2 = null; try{ await api.getPartScene({ id: 'p4' }); }catch(e){ e2 = e; }
    chk(e2 && /p4$/.test(e2.message) && log.resolve === 2, '  glb · glbUrl 둘 다 없으면 받으러 가지 않고 바로 던진다');
    chk(api._forceOpaqueAlphaOutput({ transparent: true }) === undefined, '_forceOpaqueAlphaOutput — 빈 함수(부르는 자리 호환)');

    /* 썸네일 굽기 */
    const tpl = mkTemplate({ x: 2, y: 4, z: 1 });
    ({ api, log } = load({ scene: tpl }));
    const url = await api.generatePartThumbnail({ id: 't1', glb: 'T' });
    const MUL = (C.TONE_FRONT_TOTAL - C.FLAT_EMISSIVE) / ((0.95 * C._MAIN_LIGHT_INT) + (C._MAIN_LIGHT_INT * C._KEY_LIGHT_MUL));
    chk(typeof url === 'string' && url.startsWith('data:image/png'), 'generatePartThumbnail — 32px 렌더 결과를 PNG dataURL 로 준다');
    chk(Math.abs(log.amb.intensity - 0.95 * C._MAIN_LIGHT_INT * MUL) < 1e-9 && Math.abs(log.key.intensity - C._MAIN_LIGHT_INT * C._KEY_LIGHT_MUL * MUL) < 1e-9 && log.key.pos.join() === '1,2.5,2', '  광량 배율 = (TONE_FRONT_TOTAL − FLAT_EMISSIVE) ÷ (0.95·I + I·K) · 키 라이트는 비스듬히 (1, 2.5, 2)');
    chk(log.proj && Math.abs(log.proj.r - 4 * 0.55) < 1e-9 && log.proj.l === -log.proj.r && log.proj.t === log.proj.r, '  가장 긴 변(4) × 0.55 로 정사각 프레이밍');
    chk(tpl.mat.toned === 0 && log.tone.length === 1 && log.tone[0].cloned, '  원본 머티리얼은 안 건드리고 복제본에만 장착 톤을 먹인다(캐시 원본 보호)');
    chk(log.inScene === 3 && log.clear.join() === '0,0', '  씬에 조명 둘 + 파츠 하나 · 투명 배경');
    await api.generatePartThumbnail({ id: 't1', glb: 'T' });
    chk(log.renderers === 1, '  렌더러 · 씬은 한 번만 만든다(두 번째 굽기는 재사용)');
    ({ api, log } = load({ scene: tpl, TONE_FRONT_TOTAL: 0.1 }));
    await api.generatePartThumbnail({ id: 't1', glb: 'T' });
    chk(log.amb.intensity === 0 && log.key.intensity === 0, '  경계 — 총합이 emissive 보다 작으면 배율 0(음수로 안 간다)');
    ({ api, log } = load({ scene: tpl, TONE_FRONT_TOTAL: 99 }));
    await api.generatePartThumbnail({ id: 't1', glb: 'T' });
    chk(Math.abs(log.amb.intensity - 0.95 * C._MAIN_LIGHT_INT * 1.5) < 1e-9, '  경계 — 배율 상한 1.5');
    ({ api, log } = load({ scene: tpl, _MAIN_LIGHT_INT: 0, _KEY_LIGHT_MUL: 0 }));
    let e3 = null; try{ await api.generatePartThumbnail({ id: 't1', glb: 'T' }); }catch(e){ e3 = e; }
    chk(!e3 && log.amb.intensity === 0, '  경계 — 씬 조명이 0 이어도 0 으로 나누지 않는다');
    ({ api, log } = load({ scene: tpl }));
    quiet(); const u0 = await api.generatePartThumbnail({ id: 'nope' }); loud();
    chk(u0 === null, '  GLB 를 못 찾으면 던지지 않고 null');

    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { loud(); chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
