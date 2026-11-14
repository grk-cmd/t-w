/* ═══ 🎬 sim-stage.js — 3D 무대 한 벌(shared/stage.js · app.js 분리 M1) ═══════════════
   [왜] app.js SETUP 의 «무대 만들기»(렌더러 · 연결 끊김 감시 · 씬 · 카메라 · 바닥 · GLTF 로더)를 모듈로 옮겼다. 동작은 그대로여야 한다.
   ・1절: 만들기 — 가짜 렌더러(옵션을 기록)와 진짜 three(r128)로 돌려 렌더러 옵션 · 배율 · 그림자 · 카메라 · 바닥 · 로더를 본다
   ・2절: 바닥 맞춤 sizeFloorTo — 입력 → 크기 · 자리(경계값: 작은 콘텐츠 · 빈 메시)
   ・3절: 실패 길 — 렌더러를 못 만들면 안내(glFail.show) 후 같은 오류를 던진다 · 감시 붙이기가 던져도 무대는 만들어진다 · DRACO 가 던져도 로더는 있다
   ・4절: 연결 — html 이 app.js 보다 먼저 싣는다 · app.js 가 _renderAA 를 넘겨 만들고 옛 이름을 받는다 · app.js 에 렌더러 · 씬 · 로더를 직접 만드는 줄이 없다
   ・5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. three 는 vendor/three/three.min.js. */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('shared/stage.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — stage.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!threePath){ say('  ? 원본 못 찾음 — three.min.js'); process.exit(2); }
const THREE0 = require(path.resolve(threePath));

let lastLog = null;
/* 가짜 환경 — 렌더러 · 로더는 기록만 하고, 나머지(Scene · Camera · Mesh · ShadowMaterial)는 진짜 three */
function build(src, o){
  o = o || {};
  const log = { renderers: [], warns: [], shows: [], attaches: [], draco: [], notes: [] };
  lastLog = log;
  class FakeRenderer {
    constructor(opts){
      if(o.rendererThrows) throw new Error('no webgl');
      this.opts = opts; this.clear = null; this.pr = null; log.renderers.push(this);
      this.shadowMap = { enabled: false, type: null };
    }
    setPixelRatio(v){ this.pr = v; }
    setClearColor(c, a){ this.clear = [c, a]; }
  }
  class FakeLoader { constructor(){ this.draco = null; } setDRACOLoader(d){ this.draco = d; } }
  class FakeDraco { constructor(){ if(o.dracoThrows) throw new Error('draco'); } setDecoderPath(p){ log.draco.push(p); } }
  const THREE = Object.assign({}, THREE0, { WebGLRenderer: FakeRenderer, GLTFLoader: FakeLoader, DRACOLoader: FakeDraco });
  const canvas = { id: 'scene' };
  const document = { getElementById: (id) => (id === 'scene' ? canvas : null) };
  const store = {};
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
  const TwGlFailNotice = { createGlFailNotice: () => ({
    show: (k, e) => { log.shows.push(k); },
    guard: (fn) => { try{ return fn(); }catch(e){ log.shows.push('create'); throw e; } },
  }) };
  const GlRecover = { createGlRecover: (d) => ({ attach: (c) => { if(o.attachThrows) throw new Error('attach'); log.attaches.push({ c, d }); } }) };
  const win = {};
  const con = { warn: (...a) => log.warns.push(a.join(' ')), log: () => {} };
  const companion = { diagNote: (m) => log.notes.push(m), relaunchApp: () => {}, quitApp: () => {} };
  const run = new Function('THREE', 'TwGlFailNotice', 'GlRecover', 'TwErrorCodes', 'companion', 'document', 'devicePixelRatio', 'localStorage', 'window', 'console', src);
  run(THREE, TwGlFailNotice, GlRecover, { notify: () => {} }, companion, document, o.dpr == null ? 3 : o.dpr, localStorage, win, con);
  const stage = win.TwStage.createStage({ _renderAA: o.aa == null ? true : o.aa });
  return { stage, log, canvas, THREE, store };
}
const tryBuild = (src, o) => { try{ return build(src, o); }catch(e){ return { err: e, log: lastLog }; } };

say('§1 만들기');
{
  const b = build(SRC);
  const r = b.log.renderers[0], s = b.stage;
  chk(b.log.renderers.length === 1 && s.canvas === b.canvas && r.opts.canvas === b.canvas, '렌더러는 하나 · #scene 캔버스에 만든다');
  chk(r.opts.antialias === true && r.opts.alpha === true && r.opts.premultipliedAlpha === false && r.opts.logarithmicDepthBuffer === true, '렌더러 옵션 — antialias 는 deps · alpha · premultipliedAlpha 끔 · 로그 깊이');
  chk(build(SRC, { aa: false }).log.renderers[0].opts.antialias === false, '  antialias 는 app.js 가 정한 값(_renderAA)을 따른다');
  chk(r.pr === 2 && build(SRC, { dpr: 1 }).log.renderers[0].pr === 1 && build(SRC, { dpr: 1.5 }).log.renderers[0].pr === 1.5, '화면 배율은 min(devicePixelRatio, 2) — 3 → 2 · 1 → 1 · 1.5 → 1.5');
  chk(r.clear && r.clear[0] === 0 && r.clear[1] === 0, '항상 투명 배경으로 클리어(0x000000, 0)');
  chk(r.shadowMap.enabled === true && r.shadowMap.type === b.THREE.PCFSoftShadowMap && r.outputEncoding === b.THREE.sRGBEncoding, '그림자 켬(PCFSoft) · sRGB 출력');
  chk(s.scene instanceof b.THREE.Scene && s.renderer === r, '씬 · 렌더러를 내놓는다');
  chk(s.camera instanceof b.THREE.PerspectiveCamera && s.camera.fov === 34 && s.camera.aspect === 1 && s.camera.near === 0.1 && s.camera.far === 100, '카메라 — 원근 34 · 1 · 0.1 · 100(생성기와 같은 렌즈)');
  const f = s.floor;
  chk(f instanceof b.THREE.Mesh && f.material instanceof b.THREE.ShadowMaterial && f.material.opacity === 0.3, '바닥 — 그림자만 남기는 ShadowMaterial(진하기 0.3)');
  chk(f.scale.x === 2.4 && f.scale.y === 0.125 && f.scale.z === 2.2 && f.position.length() === 0 && f.receiveShadow === true && f.castShadow === false, '  크기 2.4 × 0.125 × 2.2 · 원점 · 그림자 받기만');
  chk(s.scene.children.includes(f), '  바닥은 씬에 올라 있다');
  chk(b.log.draco.length === 1 && b.log.draco[0] === 'vendor/draco/' && s.loader.draco && s.loader.draco.constructor.name === 'FakeDraco', '로더 — DRACO 해제기(vendor/draco/)를 달았다');
  chk(b.log.attaches.length === 1 && b.log.attaches[0].c === b.canvas, '연결 끊김 감시를 같은 캔버스에 붙인다');
  const d = b.log.attaches[0].d;
  d.store.set('k', 'v');
  chk(d.store.get('k') === 'v' && b.store.k === 'v', '  감시가 시각을 저장하는 곳은 localStorage(앱을 다시 켜도 남는다)');
  chk(typeof d.relaunch === 'function' && typeof d.notice === 'function', '  다시 켜기 · 안내를 건다');
  d.notice();
  chk(b.log.shows.includes('lost'), '  안내는 glFail.show(lost)');
}

say('§2 바닥 맞춤 sizeFloorTo');
{
  const { stage, THREE } = build(SRC);
  const m = () => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  const cases = [
    [[0, 0, 0.2, 0.2], [1.0, 1.5]],       // 작은 콘텐츠 → 하한(가로 1.0 · 깊이 1.5)
    [[1, -2, 2.0, 1.0], [2.6, 1.5]],      // 가로 sx+0.6 · 깊이는 하한
    [[0, 0, 0.4, 0.4], [1.0, 1.5]],       // 경계 — sx+0.6 = 1.0
    [[0, 0, 3, 4], [3.6, 4.5]],           // 큰 콘텐츠 → sx+0.6 · sz+0.5
  ];
  for(const [a, [w, d]] of cases){
    const x = m(); stage.sizeFloorTo(x, ...a);
    chk(Math.abs(x.scale.x - w) < 1e-9 && x.scale.y === 0.125 && Math.abs(x.scale.z - d) < 1e-9 && x.position.x === a[0] && x.position.y === 0 && x.position.z === a[1], 'sizeFloorTo(' + a.join(', ') + ') → 가로 ' + w + ' · 깊이 ' + d + ' · 자리 (' + a[0] + ', 0, ' + a[1] + ')');
  }
  let threw = false; try{ stage.sizeFloorTo(null, 0, 0, 1, 1); stage.sizeFloorTo(undefined, 0, 0, 1, 1); }catch(_){ threw = true; }
  chk(!threw, '빈 메시는 조용히 지나간다(던지지 않음)');
}

say('§3 실패 길');
{
  const e1 = tryBuild(SRC, { rendererThrows: true });
  chk(e1.err && e1.err.message === 'no webgl', '★ 렌더러를 못 만들면 같은 오류를 다시 던진다(죽은 렌더러로 계속하지 않음)');
  chk(e1.log.shows.includes('create'), '  못 만들면 «안내» 를 먼저 띄운다(glFail.guard)');
  const b2 = tryBuild(SRC, { attachThrows: true });
  chk(!b2.err && b2.log.warns.some(w => w.includes('복구 감시를 못 붙였다')) && b2.stage.renderer, '감시 붙이기가 던져도 무대는 만들어지고 경고만 남긴다');
  const b3 = tryBuild(SRC, { dracoThrows: true });
  chk(!b3.err && b3.stage.loader && b3.stage.loader.draco === null && b3.log.warns.some(w => w.includes('DRACO init')), 'DRACO 가 던져도 로더는 있고(해제기 없이) 경고만 남긴다');
}

say('§4 연결');
{
  const iS = HTML.indexOf('<script src="parts/shared/stage.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  const iF = HTML.indexOf('<script src="parts/shared/gl-fail-notice.js"></script>'), iG = HTML.indexOf('<script src="parts/shared/gl-recover.js"></script>');
  chk(iS > 0 && iA > iS, 'html — stage.js 를 app.js 보다 먼저 싣는다');
  chk(iS > 0 && iF > 0 && iG > 0, 'html — 무대가 부르는 gl-fail-notice · gl-recover 도 실린다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const stageMod = TwStage\.createStage\(\{\s*_renderAA: _renderAA,\s*\}\);/.test(code), 'app.js — _renderAA 를 넘겨 무대를 만든다');
  const names = ['canvas', 'renderer', 'scene', 'camera', 'floor', 'sizeFloorTo', 'loader'];
  chk(names.every(n => new RegExp('^const ' + n + ' = stageMod\\.' + n + ';', 'm').test(code)), '  옛 이름 일곱(canvas · renderer · scene · camera · floor · sizeFloorTo · loader)을 const 로 받는다');
  chk(!/new THREE\.WebGLRenderer|new THREE\.Scene\(|new THREE\.GLTFLoader|new THREE\.DRACOLoader|GlRecover\.|TwGlFailNotice/.test(code), '  app.js 에 렌더러 · 씬 · 로더 · 감시 · 안내를 직접 만드는 줄이 없다');
  const iQ = code.indexOf('let _renderQuality'), iM = code.indexOf('const stageMod');
  chk(iQ >= 0 && iM > iQ, '  화질(_renderQuality)을 읽은 다음에 무대를 만든다(antialias 는 만들 때만 정해진다)');
}

say('§5 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('antialias:_renderAA', 'antialias:true');
  chk(!!m1 && build(m1, { aa: false }).log.renderers[0].opts.antialias !== false, 'antialias 를 deps 대신 박으면 빨강');
  const m2 = brk('Math.min(devicePixelRatio,2)', 'devicePixelRatio');
  chk(!!m2 && build(m2).log.renderers[0].pr !== 2, '배율 상한 2 를 빼면 빨강');
  const m3 = brk('floor.receiveShadow = true;', 'floor.receiveShadow = false;');
  chk(!!m3 && build(m3).stage.floor.receiveShadow !== true, '바닥이 그림자를 못 받으면 빨강');
  const m4 = brk('d=Math.max(sz+0.5,1.5)', 'd=sz+0.5');
  chk(!!m4 && (() => { const b = build(m4); const x = new b.THREE.Mesh(new b.THREE.BoxGeometry(1, 1, 1)); b.stage.sizeFloorTo(x, 0, 0, 0.2, 0.2); return Math.abs(x.scale.z - 1.5) > 1e-9; })(), '바닥 깊이 하한을 빼면 빨강');
  const m5 = brk('const renderer=glFail.guard(', 'const renderer=((f)=>f())(');
  chk(!!m5 && !tryBuild(m5, { rendererThrows: true }).log.shows.includes('create'), 'guard 를 빼면(안내 없이 죽으면) 빨강');
  const m6 = brk('scene.add(floor);', '');
  chk(!!m6 && !build(m6).stage.scene.children.includes(build(m6).stage.floor), '바닥을 씬에 안 올리면 빨강');
  const m7 = brk("draco.setDecoderPath('vendor/draco/');", '');
  chk(!!m7 && build(m7).log.draco.length === 0, 'DRACO 경로를 안 걸면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
