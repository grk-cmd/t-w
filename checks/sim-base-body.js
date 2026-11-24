/* ═══ 🧍 sim-base-body.js — 기본 몸 모델 공급 · 복제 · 크기(character/base-body.js · app.js 분리 T2) ═══════════════
   [왜] app.js «기본 캐릭터 GLB» 구역을 0.13 글 그대로 모듈로 옮겼다. 몸 읽기 · 복제 · 크기는 코어(createBody)가 하고 여기는 자산 공급과 옛 이름 잇기다.
        0.12.4 의 #830 줄(복제한 뒤 같은 뼈대는 하나로)은 instantiateBase 에 남아야 한다.
   ・1절: 코어 몸 만들기 — THREE · 로더 · 재질 고치기 · 얼굴 맵 · 조명 프리셋을 그대로 넘긴다(뒤에서 만들어지는 것은 부를 때 찾는다)
   ・2절: loadBaseGLB — 자리표(@@)나 없음이면 false · 있으면 바이트를 풀어 코어에 넘기고 결과 그대로
   ・3절: instantiateBase — 코어 복제 + 뼈대 하나로(빈 결과면 안 부름) · normalizeModel 배율 · getCommissionScene 캐시 · mkFaceTex
   ・4절: 연결(html 순서 · 만드는 줄 · 옛 이름 · 걷은 본문) · 5절: mutation test
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/base-body.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — base-body.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function build(src, o){
  o = o || {};
  const log = { createBody: null, loadBase: [], inst: [], share: [], norm: [], parse: [] };
  const THREE = { CanvasTexture: function(c){ this.canvas = c; this.needsUpdate = false; }, sRGBEncoding: 3001 };
  const coreBody = {
    loadBase: (buf) => { log.loadBase.push(buf); return Promise.resolve(o.loadResult !== undefined ? o.loadResult : true); },
    instantiateBase: (cs) => { log.inst.push(cs); return o.instResult === undefined ? { root: { n: 'root' } } : o.instResult; },
    normalizeModel: (g, h, mul) => { log.norm.push([g, h, mul]); return 7; },
  };
  const TwCharCore = { createBody: (d) => { log.createBody = d; return coreBody; } };
  const win = { BASE_GLB_B64: o.b64 };
  new Function('window', 'module', 'TwCharCore', 'THREE', 'atob', src)(win, undefined, TwCharCore, THREE, (s) => Buffer.from(s, 'base64').toString('binary'));
  const deps = {
    loader: { id: 'L' }, skelShare: { shareSkeletons: (m) => log.share.push(m), skinnedMeshesOf: (r) => ['m:' + r.n] },
    _fixGlbMatLighting: (m) => log.fix = m, setFaceMap: (...a) => log.face = a, applyLightPreset: (...a) => log.preset = a,
    assetCodeMod: () => ({ parseGlbBytes: async (b) => { log.parse.push(b); return { scene: 'S' + log.parse.length }; } }),
  };
  const mod = win.TwBaseBody.createBaseBody(deps);
  return { mod, log, win };
}

(async () => {
  say('§1 코어 몸 만들기');
  {
    const { mod, log } = build(SRC);
    const d = log.createBody;
    chk(d && d.gltf && d.gltf.id === 'L' && d.THREE && typeof d.fixMatLighting === 'function', '로더 · THREE · 재질 고치기를 코어에 넘긴다');
    d.fixMatLighting('m'); d.setFaceMap(1, 2); d.applyLightPreset('i');
    chk(log.fix === 'm' && log.face.join() === '1,2' && log.preset[0] === 'i', '재질 고치기 · 얼굴 맵 · 조명 프리셋은 부를 때 deps 로 간다');
    chk(mod.bodyCore && typeof mod.bodyCore.loadBase === 'function', 'bodyCore 를 내놓는다');
  }
  say('§2 loadBaseGLB');
  {
    for(const b of [undefined, '@@BASE@@']){
      const { mod, log } = build(SRC, { b64: b });
      chk((await mod.loadBaseGLB()) === false && log.loadBase.length === 0, '몸 자산이 ' + (b === undefined ? '없으면' : '자리표(@@)면') + ' 코어를 안 부르고 false');
    }
    const { mod, log } = build(SRC, { b64: Buffer.from([1, 2, 3, 250]).toString('base64') });
    const r = await mod.loadBaseGLB();
    chk(r === true && log.loadBase.length === 1 && Array.from(new Uint8Array(log.loadBase[0])).join() === '1,2,3,250', '있으면 바이트를 풀어 코어에 넘기고 결과를 그대로 돌려준다');
    const t = build(SRC, { b64: 'AA==', loadResult: false });
    chk((await t.mod.loadBaseGLB()) === false, '코어가 false 면 false');
  }
  say('§3 복제 · 크기 · 커미션 · 얼굴 텍스처');
  {
    const { mod, log } = build(SRC);
    const inst = mod.instantiateBase('custom');
    chk(log.inst[0] === 'custom' && inst.root.n === 'root', '코어 복제에 customScene 을 그대로 넘기고 결과를 돌려준다');
    chk(log.share.length === 1 && log.share[0].join() === 'm:root', '★ 복제한 뒤 같은 뼈대는 하나로(#830 — shareSkeletons)');
    const e = build(SRC, { instResult: null });
    chk(e.mod.instantiateBase() === null && e.log.share.length === 0, '복제가 없음(null)이면 뼈대 일을 안 하고 null');
    chk(mod.normalizeModel('g', 1.4, true) === 7 && log.norm[0][2] === mod.COMMISSION_SCALE_CORRECTION, '커미션이면 보정 배율을 넘긴다');
    mod.normalizeModel('g', 1.4); chk(log.norm[1][2] === 1, '아니면 1');
    chk(mod.COMMISSION_SCALE_CORRECTION === 1, '커미션 보정은 지금 1(보정 없음)');
    const a = await mod.getCommissionScene('X'), b = await mod.getCommissionScene('X'), c = await mod.getCommissionScene('Y');
    chk(a === b && a !== c && log.parse.length === 2 && mod.commSceneCache.get('X') === a, '커미션 GLB 는 같은 코드면 한 번만 파싱하고 캐시한다');
    const tex = mod.mkFaceTex('cv');
    chk(tex.flipY === false && tex.encoding === 3001 && tex.needsUpdate === true && tex.canvas === 'cv', '얼굴 텍스처 — flipY 끔 · sRGB · 갱신 표시');
    const buf = mod.b64ToBuf(Buffer.from([9, 8]).toString('base64'));
    chk(Array.from(new Uint8Array(buf)).join() === '9,8', 'b64ToBuf');
  }
  say('§4 연결');
  {
    const iO = HTML.indexOf('<script src="parts/character/base-body.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iO > 0 && iA > iO, 'html — base-body.js 를 app.js 보다 먼저 싣는다');
    const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    chk(/const baseBodyMod = TwBaseBody\.createBaseBody\(\{\s*loader: loader,\s*skelShare: skelShare,\s*_fixGlbMatLighting: \(\.\.\.a\)=>_fixGlbMatLighting\(\.\.\.a\),\s*setFaceMap: \(\.\.\.a\)=>matToneMod\.setFaceMap\(\.\.\.a\),\s*applyLightPreset: \(\.\.\.a\)=>matToneMod\.applyLightPresetToInstance\(\.\.\.a\),\s*assetCodeMod: \(\)=>assetCodeMod,\s*\}\);/.test(code), 'app.js — 만드는 줄 deps 여섯 그대로');
    chk(['bodyCore', 'b64ToBuf', 'loadBaseGLB', 'instantiateBase', 'commSceneCache', 'getCommissionScene', 'mkFaceTex', 'COMMISSION_SCALE_CORRECTION', 'normalizeModel'].every((n) => new RegExp('^const ' + n + ' = baseBodyMod\\.' + n + ';', 'm').test(APP)), '  옛 이름 const 아홉');
    chk(!/function (instantiateBase|normalizeModel|loadBaseGLB|b64ToBuf|getCommissionScene|mkFaceTex|measureBaseGeometry|calcMeshBox)\b|let BASE_SCENE|BASE_ANIMS\s*=/.test(code), '  app.js 에 본문이 안 남음(기본 몸 장면 · 애니메이션은 bodyCore 에서 읽는다)');
    chk(/BASE_SCENE: \(\)=>bodyCore\.baseScene\(\)/.test(code) && /BASE_ANIMS: \(\)=>bodyCore\.baseAnims\(\)/.test(code), '  장면 · 애니메이션은 읽는 함수로 코어에서');
  }
  say('§5 mutation test');
  {
    const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
    const m1 = brk('if(inst) skelShare.shareSkeletons(skelShare.skinnedMeshesOf(inst.root));', '');
    chk(!!m1 && build(m1).log.share.length === 0 && (() => { const x = build(m1); x.mod.instantiateBase(); return x.log.share.length === 0; })(), '뼈대 하나로 줄을 빼면 빨강(#830)');
    const m2 = brk("window.BASE_GLB_B64.indexOf('@@')===0", 'false');
    chk(!!m2 && (await (async () => { const x = build(m2, { b64: '@@' }); try{ await x.mod.loadBaseGLB(); }catch(_){} return x.log.loadBase.length === 1; })()), '자리표 검사를 빼면 빨강');
    const m3 = brk('if(commSceneCache.has(glbB64)) return commSceneCache.get(glbB64);', '');
    chk(!!m3 && await (async () => { const x = build(m3); await x.mod.getCommissionScene('X'); await x.mod.getCommissionScene('X'); return x.log.parse.length === 2; })(), '커미션 캐시를 빼면 빨강');
    const m5 = brk('t.flipY=false;', '');
    chk(!!m5 && build(m5).mod.mkFaceTex('c').flipY !== false, '얼굴 텍스처 flipY 를 빼면 빨강');
  }
  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
