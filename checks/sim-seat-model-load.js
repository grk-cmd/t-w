/* ═══ 📦 sim-seat-model-load.js — 📦 좌석 모델 싣기 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 좌석 모델 싣기 본문 을 parts/character/seat-model-load.js 로 옮겼다(글자 그대로 · 바뀐 줄 4 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 실제 three 로 붙이기 · 클립 · 본 · 비우기 · 파일 고르기).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(handleFiles · loadCharGLB · pickClip · prepBlink · resetSeat · setupSeatModel)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 10줄 그대로 · 부르는 곳은 seatModelLoadMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · seat-model-load.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["seat-model-load.js","parts/character/seat-model-load.js","app/parts/character/seat-model-load.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — seat-model-load.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["boneSide","fitDesk","fitModel","layoutSeats","setInfo","toast"];
const VAL_DEPS = ["loader"];
const GET_DEPS = ["assetCodeMod","selected","sliders"];
const SET_DEPS = [];
const EXPORTS = ["handleFiles","loadCharGLB","pickClip","prepBlink","resetSeat","setupSeatModel"];
const MOVED = ["STATE_KW","pickClip","setupSeatModel","loadCharGLB","loadDeskGLB","setBlinkTexture","prepBlink","resetSeat","handleFiles"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  assetCodeMod: ()=>assetCodeMod,","  boneSide: (...a)=>boneSide(...a),","  fitDesk: (...a)=>fitDesk(...a),","  fitModel: (...a)=>fitModel(...a),","  layoutSeats: (...a)=>layoutSeats(...a),","  loader: loader,","  selected: ()=>selected,","  setInfo: (...a)=>setInfo(...a),","  sliders: ()=>sliders,","  toast: (...a)=>toast(...a),"];

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
    src + '\nreturn window.TwSeatModelLoad;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createSeatModelLoad(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSeatModelLoad = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSeatModelLoad(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SEAT_MODEL_LOAD_MOD_OFF") && app.includes("const seatModelLoadMod = TwSeatModelLoad.createSeatModelLoad({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const seatModelLoadMod = TwSeatModelLoad\\.createSeatModelLoad\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const seatModelLoadMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 seatModelLoadMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/seat-model-load.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/seat-model-load.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/seat-model-load.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const seatModelLoadMod = TwSeatModelLoad.createSeatModelLoad({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const seatModelLoadMod = TwSeatModelLoad.createSeatModelLoad({", "const seatModelLoadMod = TwSeatModelLoad.createSeatModelLoad({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwSeatModelLoad = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const seatModelLoadMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('seatModelLoadMod.' + x)); if(n){ ls[i] = ls[i].replace('seatModelLoadMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createSeatModelLoad(deps){', 'function createSeatModelLoad(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 실제 three 로 좌석에 모델 붙이기 · 클립 고르기 · 깜빡임 · 비우기 · 파일 고르기(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 좌석 모델 싣기');
{
  const tp = ['vendor/three/three.min.js', 'three.min.js', 'app/vendor/three/three.min.js'].find(p => fs.existsSync(p));
  const THREE0 = require(require('path').resolve(tp));
  const texLog = [];
  /* 텍스처 로더만 가짜 — 진짜는 브라우저 document 가 있어야 한다 */
  const THREE = Object.assign({}, THREE0, { TextureLoader: function(){ this.load = (url, ok) => { texLog.push(url); ok({ needsUpdate: false }); }; } });
  function mk(){
    const log = [];
    const el = {}; const doc = { getElementById: (id) => (el[id] = el[id] || { value: null }) };
    const sl = { cls: new Set(), classList: { add: (c) => sl.cls.add(c), remove: (c) => sl.cls.delete(c) } };
    const V = {
      selected: null, sliders: sl, assetCodeMod: { decryptBytes: async (buf, pass) => { log.push('dec:' + pass); if(pass === 'bad') throw new Error('x'); return 'DEC'; } },
      loader: { parse: (buf, p, ok, bad) => { log.push('parse:' + buf); if(buf === 'BAD') bad(new Error('Failed to fetch')); else ok({ scene: new THREE.Group(), animations: [] }); } },
      fitModel: (s) => log.push('fit'), fitDesk: (s) => log.push('fitDesk'), setInfo: (s, h) => log.push('info:' + h.replace(/<[^>]+>/g, '')),
      layoutSeats: () => log.push('layout'), toast: (m) => log.push('toast:' + m), boneSide: (n) => /left|_l\b|\.l\b/.test(n) ? 'l' : /right|_r\b|\.r\b/.test(n) ? 'r' : null,
    };
    const G = { THREE, document: doc, requestAnimationFrame: (f) => { log.push('raf'); }, console: { error(){}, log(){}, warn(){} },
      window: { prompt: () => G.__pass }, FileReader: function(){ this.readAsDataURL = (f) => { this.result = 'data:' + f.name; this.onload(); }; } };
    let api;
    if(typeof MOD === 'string' && MOD){
      const deps = {};
      for(const m of MOD.matchAll(/^const ([\w$]+) = deps\.([\w$]+);(.*)$/gm)) deps[m[2]] = /읽는 함수/.test(m[3]) ? (() => V[m[1]]) : V[m[1]];
      const win = G.window;
      new Function('window', 'module', 'THREE', 'document', 'requestAnimationFrame', 'console', 'FileReader', MOD)(win, undefined, THREE, doc, G.requestAnimationFrame, G.console, G.FileReader);
      api = win.TwSeatModelLoad.createSeatModelLoad(deps);
    } else {
      const a = SRC.indexOf('const STATE_KW='), b = SRC.indexOf('\n}\n', SRC.indexOf('async function handleFiles(')) + 3;
      const names = Object.keys(V).filter(n => n !== 'selected');   // selected 는 다시 대입되는 값 — 아래 setSel 로 바꾼다
      api = new Function(...names, 'THREE', 'document', 'requestAnimationFrame', 'console', 'window', 'FileReader', 'let selected = null;\n' + SRC.slice(a, b) + '\nreturn { pickClip, setupSeatModel, loadCharGLB, resetSeat, handleFiles, prepBlink, setSel: (v) => { selected = v; } };')(...names.map(n => V[n]), THREE, doc, G.requestAnimationFrame, G.console, G.window, G.FileReader);
    }
    const sel = (v) => { V.selected = v; if(api.setSel) api.setSel(v); };
    return { api, V, G, log, el, sel };
  }
  const T = mk();
  /* 클립 고르기 */
  if(T.api.pickClip){
    const cl = (n) => ({ name: n });
    const clips = [cl('Armature|Type_Loop'), cl('IDLE_breathe'), cl('Happy')];
    chk(T.api.pickClip(clips, 'focus') === clips[0] && T.api.pickClip(clips, 'idle') === clips[1] && T.api.pickClip(clips, 'pet') === clips[2], '클립 고르기 — 상태별 낱말(대소문자 무시)로 첫 클립');
    chk(T.api.pickClip(clips, 'sleep') === null && T.api.pickClip([], 'idle') === null && T.api.pickClip([cl('walk')], 'walk').name === 'walk', '  없으면 null · 표에 없는 상태는 그 이름 그대로 찾는다');
  } else chk(false, 'pickClip 을 내놓지 않음');
  /* 좌석에 모델 붙이기 */
  const seat = () => { const s = { bodyWrap: new THREE.Group(), placeholder: { root: { visible: true } }, headAnchor: new THREE.Object3D(), bodyAnchor: new THREE.Object3D(), group: new THREE.Group(), desk: { visible: true } }; return s; };
  const model = () => {
    const m = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial(); mat.name = 'Face_Mat'; mat.map = { flipY: true, wrapS: 1, wrapT: 2, encoding: 3 };
    m.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    const sp = new THREE.Bone(); sp.name = 'Spine'; const hd = new THREE.Bone(); hd.name = 'Head'; const hl = new THREE.Bone(); hl.name = 'hand_L'; const lr = new THREE.Bone(); lr.name = 'Leg_R'; const e1 = new THREE.Bone(); e1.name = 'Ear.001'; const e2 = new THREE.Bone(); e2.name = 'ear.002';
    [sp, hd, hl, lr, e1, e2].forEach(b => m.add(b)); return m;
  };
  const s1 = seat(); T.sel(s1); T.log.length = 0;
  const old = new THREE.Group(); s1.bodyWrap.add(old); s1.gltfRoot = old;
  const m1 = model(); s1.blinkTex = { needsUpdate: false };
  T.api.setupSeatModel(s1, m1, [], 'cat.glb');
  chk(s1.gltfRoot && s1.gltfRoot.children[0] === m1 && s1.bodyWrap.children.length === 1 && s1.modelRoot === m1 && s1.isPlaceholder === false && s1.placeholder.root.visible === false, '붙이기 — 옛 모델을 빼고 보호 wrap 에 넣는다 · 자리 표시 숨김');
  chk(s1.userScale === 1 && s1.userY === 0 && s1.userZ === 0 && s1.userRot === Math.PI && s1.userX === 0 && T.el.sScale.value === 1 && T.el.sRot.value === Math.PI, '  기본값(크기 1 · 높이 0 · 회전 π) · 고른 좌석이면 슬라이더도');
  chk(Math.abs(s1.headAnchor.position.y - 1.2 * 0.82) < 1e-9 && Math.abs(s1.bodyAnchor.position.y - 0.6) < 1e-9, '  머리 · 몸 앵커 높이(1.2 × 0.82 · × 0.5)');
  chk(s1.faceMat && s1.faceMat.name === 'Face_Mat' && s1.blinkTex.flipY === true && s1.blinkTex.encoding === 3 && s1.blinkTex.needsUpdate === true, '  얼굴 머티리얼을 찾고 깜빡임 텍스처를 그 맵에 맞춘다');
  chk(s1.bones.spine && s1.bones.head && s1.bones.handL && !s1.bones.handR && s1.bones.legR && s1.bones.ear.length === 2 && s1.boneRest.ear.length === 2 && s1.hasRig === true, '  본 찾기 — 척추 · 머리 · 왼손 · 오른다리 · 귀 둘 · 쉬는 자세');
  chk(s1.mixer === null && JSON.stringify(s1.actions) === '{}' && T.log.filter(l => l === 'fit').length === 2 && T.log.filter(l => l === 'raf').length === 1 && T.log.includes('layout') && T.V.sliders.cls.has('on'), '  클립 없음 → mixer 없음 · fitModel 두 번 · 배치 + 다음 프레임 다시 · 슬라이더 켬');
  const s2 = seat(); const m2 = model(); const clipI = new THREE.AnimationClip('Idle', 1, []), clipF = new THREE.AnimationClip('work', 1, []);
  T.api.setupSeatModel(s2, m2, [clipI, clipF], 'b.glb');
  chk(s2.mixer && s2.actions.idle && s2.actions.focus && s2.actions.pet && s2.actions.sleep && s2.actions.pet.getClip() === clipI && s2.actions.focus.getClip() === clipF, '  클립 있음 → 상태 넷 모두(없는 상태는 idle 로)');
  /* 비우기 */
  T.sel(s1); T.log.length = 0; s1.deskGltf = new THREE.Group(); s1.group.add(s1.deskGltf); s1.desk.visible = false;
  T.api.resetSeat(s1);
  chk(s1.gltfRoot === null && s1.modelRoot === null && s1.deskGltf === null && s1.desk.visible === true && s1.isPlaceholder === true && s1.mixer === null && s1.faceMat === null && s1.blinkTex === null && s1.placeholder.root.visible === true, '비우기 — 모델 · 책상 GLB 빼고 기본 도형 · 상태 초기화');
  chk(Math.abs(s1.headAnchor.position.y - 1.08) < 1e-9 && !T.V.sliders.cls.has('on'), '  앵커 높이 · 슬라이더 끔');
  /* 깜빡임 */
  const b = { blinkTex: { needsUpdate: false }, faceMapOrig: null };
  T.api.prepBlink(b);
  chk(b.blinkTex.flipY === false && b.blinkTex.encoding === THREE.sRGBEncoding && b.blinkTex.needsUpdate === true, '깜빡임 — 원래 얼굴 맵이 없으면 flipY false · sRGB');
  T.api.prepBlink({});   // 텍스처 없음 — 아무 일 없음
  /* 파일 고르기(비동기) */
  globalThis.__behav = (async () => {
    const S = seat(); const file = (name, type, buf) => ({ name, type: type || '', arrayBuffer: async () => buf || name });
    T.log.length = 0; T.G.__pass = 'pw';
    await T.api.handleFiles([file('My_Desk.glb'), file('char.glb'), file('x.DCC', '', 'ENC'), file('blink.png', 'image/png'), file('note.txt', 'text/plain')], S);
    const parses = T.log.filter(l => l.startsWith('parse:'));
    chk(JSON.stringify(parses) === JSON.stringify(['parse:My_Desk.glb', 'parse:char.glb', 'parse:DEC']) && T.log.includes('dec:pw') && T.log.includes('fitDesk'), '파일 — 이름에 desk 면 책상 · 아니면 캐릭터 · .dcc 는 비밀번호로 풀어 캐릭터 · 그 밖은 무시');
    T.log.length = 0; T.G.__pass = 'bad';
    await T.api.handleFiles([file('y.dcc')], S);
    chk(T.log.some(l => l.startsWith('toast:비밀번호가 틀렸')), '  비밀번호가 틀리면 토스트');
    T.log.length = 0; T.G.__pass = '';
    await T.api.handleFiles([file('z.dcc')], S);
    chk(!T.log.some(l => l.startsWith('dec:')), '  비밀번호를 안 넣으면 건너뛴다');
    T.log.length = 0; T.api.loadCharGLB('BAD', 'b.glb', S);
    chk(T.log.some(l => l.startsWith('info:⚠️ "Failed to fetch"')), '  읽기 실패 문구(fetch)');
    chk(JSON.stringify(texLog) === JSON.stringify(['data:blink.png']), '  이미지는 깜빡임 텍스처로(data URL)');
  })();   // 끝 줄(통과 · 실패)은 이 약속이 풀린 뒤에 찍는다
}

Promise.resolve(globalThis.__behav).then(() => {   // 4절의 비동기 판정이 끝난 뒤에 센다
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
});
