/* ═══ 🙂 sim-creator-face.js — 생성기 얼굴 · 피부 캔버스 · 몸 만들기(creator/creator-face.js · app.js 분리 T7) ═══════════════
   [왜] app.js 의 얼굴 · 피부 그림판 · 사람 몸 조립 자리를 0.13 글 그대로 모듈로 옮겼다. 본문은 코어(createFace · createBody.assemble)가 하고 여기는 얇은 이름이다.
        0.12.4 의 #830 줄(shareSkeletons)은 defToBase 의 onRoot 에 남아야 한다.
   ・1절: 코어 얼굴 만들기 — 캔버스 만들기 · «그릴 수 있나» 판정을 넘긴다 · 얇은 이름이 코어로 간다
   ・2절: defToBase — 동물 길 · 사람 몸 조립 인자(커미션 배율 · 색 입힘) · onRoot(뼈대 하나로 + 귀) · charDef
   ・3절: 연결(html 순서 · 만드는 줄 · 옛 이름 · 걷은 본문) · 4절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('creator/creator-face.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음 — creator-face.js · app.js · desk-companion-prototype.html'); process.exit(2); }

function build(src, o){
  o = o || {};
  const log = { createFace: null, assemble: [], cb: [], share: [], ears: [], mk: [], animal: [] };
  const faceCore = {
    CANVAS_SZ: 512, FACE_SYM_SUM: 0.36, SKIN_COLORS: ['#a', '#b'], skinCanvases: [{ id: 's0' }, { id: 's1' }],
    newCanvas: () => 'nc', isBlankDraw: (c) => 'blank:' + c, snapCanvas: (c) => 'snap:' + c,
    skinCanvasFor: (i) => 'sc' + i, skinColorFor: (i) => 'col' + i, compositeFace: (s, d) => 'cf:' + s + ':' + d,
  };
  const TwCharCore = { createFace: (d) => { log.createFace = d; return faceCore; } };
  const bodyCore = { buildCreatorBase: (...a) => { log.cb.push(a); return 'base'; }, assemble: (opt) => { log.assemble.push(opt); return { group: 'g' }; } };
  const win = { buildAnimalBase: o.noAnimal ? undefined : (def) => { log.animal.push(def); return o.animalResult === undefined ? { animal: true } : o.animalResult; } };
  const doc = { createElement: (t) => ({ tag: t }) };
  function HTMLCanvasElement(){} function HTMLImageElement(){}
  new Function('window', 'TwCharCore', 'document', 'HTMLCanvasElement', 'HTMLImageElement', src)(win, TwCharCore, doc, HTMLCanvasElement, HTMLImageElement);
  const deps = {
    bodyCore, mkFaceTex: (c) => { log.mk.push(c); return 'tex:' + c; },
    skelShare: { shareSkeletons: (m) => log.share.push(m), skinnedMeshesOf: (r) => ['m:' + r.n] },
    COMMISSION_SCALE_CORRECTION: 1.25, _attachHumanEars: (r, d) => log.ears.push([r, d]),
    animalBuilder: () => win.buildAnimalBase,
  };
  const mod = win.TwCreatorFace.createCreatorFace(deps);
  return { mod, log, win, HTMLCanvasElement, HTMLImageElement };
}

say('§1 코어 얼굴 만들기');
{
  const { mod, log, HTMLCanvasElement, HTMLImageElement } = build(SRC);
  const d = log.createFace;
  chk(d && d.makeCanvas().tag === 'canvas', '캔버스 만들기는 document.createElement(canvas)');
  chk(d.isDrawable(new HTMLCanvasElement()) && d.isDrawable(new HTMLImageElement()) && !d.isDrawable('data:url') && !d.isDrawable(null), '그릴 수 있는 것은 캔버스 · 이미지뿐(문자열 · null 은 건너뜀)');
  chk(mod.CANVAS_SZ === 512 && mod.FACE_SYM_SUM === 0.36 && Math.abs(mod.SYM_PX - 0.36 * 512) < 1e-9, 'CANVAS_SZ · FACE_SYM_SUM · SYM_PX(픽셀 미러 합)');
  chk(mod.newCanvas() === 'nc' && mod._isBlankDraw('x') === 'blank:x' && mod.snapCanvas('y') === 'snap:y' && mod.skinCanvasFor(1) === 'sc1' && mod.skinColorFor(1) === 'col1' && mod.compositeFace(2, 'z') === 'cf:2:z', '얇은 이름이 코어로 간다');
  chk(mod.SKIN_COLORS === mod.SKIN_COLORS && mod.skinCanvases.length === 2 && mod.skinCanvases[0].id === 's0', '피부 칸은 코어의 같은 배열(얼굴 자동 복구 · 피부 불러오기가 같은 칸에 넣는다)');
}
say('§2 defToBase · charDef · buildCreatorBase');
{
  const { mod, log } = build(SRC);
  const r = mod.defToBase({ skin: 1, face: 'F', blink: 'B', top: 't', bot: 'b' }, 'custom');
  const o = log.assemble[0];
  chk(r.group === 'g' && o.customScene === 'custom' && o.faceTex === 'tex:cf:1:F' && o.blinkTex === 'tex:cf:1:B' && o.top === 't' && o.bot === 'b', '사람 몸 — 얼굴 · 감은눈 합성을 텍스처로 만들어 코어 assemble 에 넘긴다');
  chk(o.recolor === true && o.scaleMul === 1 && o.skinColor === 'col1', '일반 캐릭터는 옷 색 입힘 · 배율 1 · 피부색');
  mod.defToBase({ skin: 0, face: 'F', blink: 'B', isCommission: true }, null);
  chk(log.assemble[1].recolor === false && log.assemble[1].scaleMul === 1.25, '커미션은 색을 안 입히고 보정 배율');
  o.onRoot({ n: 'root' });
  chk(log.share.length === 1 && log.share[0].join() === 'm:root' && log.ears.length === 1 && log.ears[0][0].n === 'root' && log.ears[0][1].skin === 1, '★ onRoot — 뼈대 하나로(#830) 뒤 귀 붙이기');
  const a = mod.defToBase({ animal: 'cat' });
  chk(a.animal === true && log.assemble.length === 2, '동물은 animal.js 가 조립하고 코어를 안 부른다');
  const f = build(SRC, { animalResult: null }); f.mod.defToBase({ animal: 'cat', skin: 0 });
  chk(f.log.assemble.length === 1, '동물 조립이 실패(null)하면 사람 몸으로');
  const n = build(SRC, { noAnimal: true }); n.mod.defToBase({ animal: 'cat', skin: 0 });
  chk(n.log.assemble.length === 1, 'animal.js 가 안 실렸어도 사람 몸으로');
  chk(JSON.stringify(mod.charDef(1, 'f', 'b', 't', 'o')) === JSON.stringify({ type: 'creator', skin: 1, face: 'f', blink: 'b', top: 't', bot: 'o' }), 'charDef 모양');
  mod.buildCreatorBase(1, 2, 3); chk(log.cb[0].join() === '1,2,3', 'buildCreatorBase 는 코어로');
}
say('§3 연결');
{
  const iO = HTML.indexOf('<script src="parts/creator/creator-face.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iO > 0 && iA > iO, 'html — creator-face.js 를 app.js 보다 먼저 싣는다');
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
  chk(/const creatorFaceMod = TwCreatorFace\.createCreatorFace\(\{\s*bodyCore: bodyCore,\s*mkFaceTex: mkFaceTex,\s*skelShare: skelShare,\s*COMMISSION_SCALE_CORRECTION: COMMISSION_SCALE_CORRECTION,\s*_attachHumanEars: \(\.\.\.a\)=>_attachHumanEars\(\.\.\.a\),\s*animalBuilder: \(\)=>window\.buildAnimalBase,\s*\}\);/.test(code), '만드는 줄 — deps 6개(값 4 · 함수 1 · 읽는 함수 1)');
  const names = ['CANVAS_SZ', 'FACE_SYM_SUM', 'SYM_PX', 'newCanvas', '_isBlankDraw', 'snapCanvas', 'SKIN_COLORS', 'skinCanvases', 'skinCanvasFor', 'skinColorFor', 'compositeFace', 'charDef', 'buildCreatorBase', 'defToBase'];
  chk(names.every((n) => new RegExp('^const ' + n + ' = creatorFaceMod\\.' + n + ';', 'm').test(APP)), '옛 이름 ' + names.length + '개를 같은 이름 const 로 받는다');
  chk(!/function (newCanvas|_isBlankDraw|snapCanvas|skinCanvasFor|skinColorFor|compositeFace|charDef|buildCreatorBase|defToBase|buildFacePatchGeo)\b|_faceSkipWarned|_blankProbeCv/.test(code), 'app.js 에 본문이 안 남음');
  const iMod = APP.indexOf('const creatorFaceMod = '), iUse = APP.indexOf('const faceC=newCanvas()');
  chk(iMod > 0 && iUse > iMod, '만드는 줄은 처음 쓰는 곳(faceC)보다 앞 — TDZ 안 남');
}
say('§4 일부러 깨 보기');
{
  const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
  const m1 = brk('skelShare.shareSkeletons(skelShare.skinnedMeshesOf(root)); ', '');
  chk(!!m1 && (() => { const x = build(m1); x.mod.defToBase({ skin: 0 }); x.log.assemble[0].onRoot({ n: 'r' }); return x.log.share.length === 0; })(), '뼈대 하나로 줄을 빼면 빨강(#830)');
  const m2 = brk('recolor:!def.isCommission', 'recolor:true');
  chk(!!m2 && (() => { const x = build(m2); x.mod.defToBase({ skin: 0, isCommission: true }); return x.log.assemble[0].recolor === true; })(), '커미션 색 입힘 가르기를 빼면 빨강');
  const m3 = brk('if(buildAnimal){', 'if(false){');
  chk(!!m3 && (() => { const x = build(m3); x.mod.defToBase({ animal: 1, skin: 0 }); return x.log.assemble.length === 1 && x.log.animal.length === 0; })(), '동물 길을 빼면 빨강');
  const m4 = brk('v instanceof HTMLCanvasElement || v instanceof HTMLImageElement', 'true');
  chk(!!m4 && build(m4).log.createFace.isDrawable('str') === true, '그릴 수 있나 판정을 빼면 빨강');
}
say('');
say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
