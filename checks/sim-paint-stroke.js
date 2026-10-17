/* sim-paint-stroke.js — 🖌 생성기 얼굴에 칠하기(creator/paint-stroke.js) 동작 · 연결
   실행:  node sim-paint-stroke.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 얼굴 칠하기는 «튀는 획»(턱 밑 · 솔기) 제보를 여러 번 고친 곳이다. app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4)
     맞히기 · 획 잇기 · 쪼개기 · 대칭 · 페인트통 · 스포이드를 가짜 THREE · 가짜 캔버스 위에서 실제로 돌려 입력 → 출력으로 고정한다.
   ・1절: 획 — 첫 점은 점 하나 · 이어지는 점은 선 · 화면 경로 쪼개기(6px 단위 · 최대 8) · 빗나가면 끊기 · 지우개 · 그리기 단계가 아니면 아무것도
   ・2절: 맞히기 — 옷이 앞에 있으면 안 칠함 · 숨은 옷 · 다른 장면의 옷은 무시 · 솔기(UV 가 크게 뛰면 잇지 않음)
   ・3절: 대칭 — 거울 자리에도 칠함 · 못 맞히면 거울 획만 끊기(거울 UV 수식은 sim-paint-geom)
   ・4절: 페인트통 · 스포이드 · 5절: app.js 연결 · 6절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/paint-stroke.js'), GEOM = read('shared/paint-geom.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !GEOM || !APP || !HTML) { say('  ? 원본 못 찾음 — paint-stroke.js · paint-geom.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const near = (a, b) => Math.abs(a - b) < 1e-6;

/* ── 가짜 THREE — 쓰는 메서드만 */
class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { return this.set(v.x, v.y, v.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; } addScaledVector(v, k) { this.x += v.x * k; this.y += v.y * k; this.z += v.z * k; return this; }
  negate() { return this.set(-this.x, -this.y, -this.z); } normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.set(this.x / l, this.y / l, this.z / l); }
  transformDirection() { return this; } distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); } }
class V2 { constructor() { this.x = 0; this.y = 0; } }
class RC { constructor() { this.ray = { origin: new V3(), direction: new V3() }; this.ndc = null; }
  set(o, d) { this.ray.origin.copy(o); this.ray.direction.copy(d); } setFromCamera(ndc) { this.ndc = { x: ndc.x, y: ndc.y }; this.ray.origin.set(0, 0, 5); }
  intersectObject(mesh) { return mesh._hits || []; } }
const THREE = { Vector3: V3, Vector2: V2, Raycaster: RC };

/* ── 세계: 화면 200×200 · 얼굴은 화면 x/200 → uv.x, y/200 → uv.y 로 맞는다(거리 2). 옷은 o.cloth 가 있으면 그 거리로 맞는다 */
function world(src, o = {}) {
  const log = { segs: [], blits: 0, toasts: [], hist: 0, drops: 0, buckets: [], swOff: 0 };
  let cur = null;   // 선 한 조각 — 진짜 paint-geom 의 strokeSeg 가 beginPath · moveTo · lineTo · stroke 로 긋는다
  const ctx = { lineWidth: 0, strokeStyle: '', globalCompositeOperation: 'source-over', lineCap: '', lineJoin: '',
    beginPath() { cur = {}; }, moveTo(x, y) { cur.x0 = x; cur.y0 = y; }, lineTo(x, y) { cur.x1 = x; cur.y1 = y; },
    stroke() { log.segs.push(Object.assign(cur, { w: this.lineWidth, col: this.strokeStyle, op: this.globalCompositeOperation })); },
    getImageData: () => ({ data: o.pixel || [10, 20, 255, 255] }) };
  const face = { name: 'face', parent: null, visible: true, geometry: { g: 1 }, worldToLocal: (v) => v, localToWorld: (v) => v, matrixWorld: {} };
  const scene = {}; face.parent = scene;
  const up = { name: 'up', parent: o.clothOtherScene ? {} : scene, visible: !o.clothHidden };
  const st = { cBase: o.noBase ? null : { face, upMesh: up, loMesh: null, onepieceMesh: null, faceCx: 0 }, cCam: { position: new V3(0, 0, 5) },
    brushSize: 7, brushColor: '#123456', eraser: !!o.eraser, symmetry: !!o.symmetry, crStep: o.step || 2, blinkEdited: false,
    crPaintTool: o.noTool ? null : { bucket: (a) => { log.buckets.push(a); return o.bucketN === undefined ? 3 : o.bucketN; } },
    lastPX: null, lastPY: null, lastSX: null, lastSY: null, _pLastScr: null, _pLastUV: null, _pLastPt: null, _pLastSUV: null };
  let lastNdc = null;
  const partPaintMod = {
    _picIntersect: (ray, meshes) => {
      const m = meshes[0];
      if (m === face) {
        if (ray.origin.z !== 5) return o.mirrorUv ? { uv: o.mirrorUv } : null;        // 대칭 되쏘기
        if (!lastNdc) return null;
        const sx = (lastNdc.x + 1) * 100, sy = (1 - lastNdc.y) * 100;
        if (o.missX && sx > o.missX) return null;
        const uvx = (o.seamX && sx > o.seamX) ? sx / 200 + 0.5 : sx / 200;
        return { uv: { x: uvx, y: sy / 200 }, point: new V3(sx / 1000, sy / 1000, 3), object: face, faceIndex: 4, face: { normal: new V3(0, 0, 1) } };
      }
      if (m === up && o.cloth) return { point: new V3(0, 0, 5 - o.cloth) };
      return null;
    },
    _wdPicUvScale: () => 1,
  };
  const els = { creatorPreview: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) }, brushCustom: { value: '' } };
  const doc = { getElementById: (id) => els[id] || null };
  const sw = { children: [{ classList: { remove: () => { log.swOff++; } } }, { classList: { remove: () => { log.swOff++; } } }] };
  const api = new Function('window', 'document', 'THREE', 'module', src + '\nreturn window.TwPaintStroke;')({}, doc, THREE, undefined);
  const paintGeomMod = new Function('window', 'THREE', 'module', GEOM + '\nreturn window.TwPaintGeom;')({}, THREE, undefined).createPaintGeom({});
  const out = api.createPaintStroke({
    CANVAS_SZ: 512, crState: st, partPaintMod, paintGeomMod,
    _crDropEraser: () => { log.drops++; st.eraser = false; },
    actC: () => ({ getContext: () => ctx }), blit: () => { log.blits++; }, isDrawStep: () => o.drawStep !== false,
    pushHistory: () => { log.hist++; }, swEl: () => sw, toast: (m) => log.toasts.push(m),
  });
  /* setFromCamera 를 엿봐 지금 화면 점을 안다 */
  const ray = out._pray; const orig = ray.setFromCamera.bind(ray); ray.setFromCamera = (ndc, cam) => { lastNdc = { x: ndc.x, y: ndc.y }; orig(ndc, cam); };
  return { out, log, st, ctx, els, ev: (x, y) => ({ clientX: x, clientY: y }) };
}
const P = (v) => v * 512 / 200;   // 화면 px → 텍스처 px(이 세계에서)

function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  const NAMES = ['_paintBreak', '_pndc', '_pray', 'bucketFromEvent', 'eyedropFromEvent', 'paintFromEvent'];
  t(!err && w && Object.keys(w.out).sort().join() === NAMES.join(), '만들 때 던지지 않고 내놓는 이름 여섯' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;

  w.out.paintFromEvent(w.ev(100, 50));
  let s = w.log.segs[0];
  t(w.log.segs.length === 1 && near(s.x0, P(100)) && near(s.y0, P(50)) && near(s.x1, P(100) + 0.01) && s.w === 7 && s.col === '#123456' && s.op === 'source-over' && w.log.blits === 1,
    '첫 점 — 점 하나(0.01 짧은 선) · 붓 크기 · 색 · 덧칠 · 화면 갱신');
  w.out.paintFromEvent(w.ev(130, 50));
  t(w.log.segs.length === 6 && w.log.segs.slice(1).every((g, i) => near(g.x1, P(100 + 6 * (i + 1))) && near(g.x0, P(100 + 6 * i))), '30px 움직임 — 6px 단위로 5번 맞혀 앞 점과 잇는다');
  w.out.paintFromEvent(w.ev(330, 50));
  t(w.log.segs.length === 14, '200px 움직임 — 최대 8번까지만 쪼갠다');
  w.out._paintBreak(); w.st._pLastScr = null;
  w.out.paintFromEvent(w.ev(20, 20));
  s = w.log.segs[w.log.segs.length - 1];
  t(near(s.x1 - s.x0, 0.01), '끊은 뒤(_paintBreak) 다음 점은 다시 점 하나');

  w = world(src, { missX: 115 });
  w.out.paintFromEvent(w.ev(100, 50)); w.out.paintFromEvent(w.ev(130, 50));
  const segs = w.log.segs;
  t(segs.length === 3 && w.st.lastPX === null, '빗나간 곳(얼굴 밖)에서 획을 끊는다 — 그 뒤 점은 잇지 않는다');
  w = world(src, { eraser: true });
  w.out.paintFromEvent(w.ev(100, 50));
  t(w.log.segs[0].op === 'destination-out' && w.ctx.globalCompositeOperation === 'source-over', '지우개 — destination-out 으로 긋고 끝나면 source-over 로 되돌린다');
  w = world(src, { drawStep: false }); w.out.paintFromEvent(w.ev(100, 50));
  const w2 = world(src, { noBase: true }); w2.out.paintFromEvent(w2.ev(100, 50));
  t(!w.log.segs.length && !w2.log.segs.length, '그리기 단계가 아니거나 캐릭터가 없으면 아무것도 안 한다');

  w = world(src, { cloth: 1 }); w.out.paintFromEvent(w.ev(100, 50));
  t(!w.log.segs.length, '옷이 얼굴보다 앞에서 맞으면 안 칠한다(안 보이는 곳)');
  w = world(src, { cloth: 1, clothHidden: true }); w.out.paintFromEvent(w.ev(100, 50));
  const w3 = world(src, { cloth: 1, clothOtherScene: true }); w3.out.paintFromEvent(w3.ev(100, 50));
  const w4 = world(src, { cloth: 4 }); w4.out.paintFromEvent(w4.ev(100, 50));
  t(w.log.segs.length === 1 && w3.log.segs.length === 1 && w4.log.segs.length === 1, '숨은 옷 · 다른 장면에 붙은 옷 · 얼굴 뒤의 옷은 가리지 않는다');
  w = world(src, { seamX: 105 });
  w.out.paintFromEvent(w.ev(100, 50)); w.out.paintFromEvent(w.ev(110, 50));   // 105 까지는 잇고, 110 에서 UV 가 0.5 뛴다
  s = w.log.segs[2];
  t(w.log.segs.length === 3 && !near(w.log.segs[1].x1 - w.log.segs[1].x0, 0.01) && near(s.x1 - s.x0, 0.01), '솔기 — 3D 로는 가까운데 UV 가 크게 뛰면 잇지 않고 새 점으로');

  w = world(src, { symmetry: true, mirrorUv: { x: 0.2, y: 0.25 } });
  w.out.paintFromEvent(w.ev(100, 50));
  t(w.log.segs.length === 2 && near(w.log.segs[1].x0, 0.2 * 512) && near(w.log.segs[1].y0, 0.25 * 512) && near(w.st.lastSX, 0.2 * 512), '대칭 — 거울 자리(되쏘아 맞힌 UV)에도 점을 찍고 기억한다');
  w = world(src, { symmetry: true });
  w.out.paintFromEvent(w.ev(100, 50));
  t(w.log.segs.length === 1 && w.st.lastSX === null && w.st._pLastSUV === null, '대칭 — 거울 자리를 못 맞히면 거울 획만 끊는다');
  w = world(src, { noTool: true });
  t(w.out.bucketFromEvent(w.ev(100, 50), false) === false && !w.log.buckets.length, '페인트통 — 도구가 없으면 false');
  w = world(src, { missX: 10 });
  t(w.out.bucketFromEvent(w.ev(100, 50), false) === false && w.log.toasts[0] === '얼굴을 눌러 채워요', '페인트통 — 빈 곳이면 «얼굴을 눌러 채워요»');
  w = world(src, { bucketN: 0 });
  t(w.out.bucketFromEvent(w.ev(100, 50), false) === false && /채울 자리가 없어요/.test(w.log.toasts[0]), '페인트통 — 채운 칸이 0 이면 안내');
  w = world(src, { symmetry: true, mirrorUv: { x: 0.2, y: 0.25 }, step: 3 });
  const okB = w.out.bucketFromEvent(w.ev(100, 50), true);
  const b0 = w.log.buckets[0], b1 = w.log.buckets[1];
  t(okB === true && b0 && b0.size === 512 && b0.color === '#123456' && b0.erase === true && b0.faceIndex === 4 && typeof b0.pushHistory === 'function' && b1 && b1.uv.x === 0.2 && !b1.pushHistory && w.st.blinkEdited && w.log.blits === 1,
    '페인트통 — 크기 · 색 · 지우기 · 조각을 넘기고, 대칭이면 거울 자리도 같은 되돌리기 한 칸 · 감은눈(3단계)이면 표시');

  w = world(src, { pixel: [10, 20, 255, 200] }); w.st.eraser = true;
  t(w.out.eyedropFromEvent(w.ev(100, 50)) === true && w.st.brushColor === '#0a14ff' && w.log.drops === 1 && w.els.brushCustom.value === '#0a14ff' && w.log.swOff === 2, '스포이드 — 픽셀 색을 붓 색으로 · 지우개 끄기 · 직접 고른 색 칸 · 견본 선택 풀기');
  /* 입구 전제 — 얼굴 메쉬 · 미리보기 캔버스가 없을 때 세 입구 모두 던지지 않고 아무것도 안 한다 */
  const pre = (mut) => { const x = world(src); mut(x); let threw = false, res = []; try { res = [x.out.paintFromEvent(x.ev(100, 50)), x.out.bucketFromEvent(x.ev(100, 50), false), x.out.eyedropFromEvent(x.ev(100, 50))]; } catch (_) { threw = true; } return !threw && !x.log.segs.length && !x.log.buckets.length && res[2] === false && x.st.brushColor === '#123456'; };
  t(pre((x) => { x.st.cBase.face = null; }) && pre((x) => { delete x.els.creatorPreview; }), '입구 전제 — 얼굴 메쉬나 미리보기 캔버스가 없으면 붓 · 페인트통 · 스포이드 모두 던지지 않고 아무것도 안 한다');
  w = world(src, { pixel: [10, 20, 255, 7] });
  t(w.out.eyedropFromEvent(w.ev(100, 50)) === false && w.st.brushColor === '#123456', '스포이드 — 거의 투명한 픽셀(알파 < 8)은 무시');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function paintAt\b|function _paintHitAt\b|function mirrorUV\b|const CR_PAINT_STEP_PX\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const paintStrokeMod = TwPaintStroke\.createPaintStroke\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim().split(':')[0]).join() === 'CANVAS_SZ,_crDropEraser,actC,blit,crState,isDrawStep,paintGeomMod,partPaintMod,pushHistory,swEl,toast'
    && /  crState: crState,/.test(mk) && /  swEl: \(\)=>swEl,/.test(mk), '만드는 줄(가드 없이) · deps 11 — crState · paintGeomMod 는 값 하나로 · swEl 는 읽는 함수');
  t(/paintStrokeMod\.paintFromEvent\(/.test(A) && !/(^|[^.\w$])(paintFromEvent|bucketFromEvent|eyedropFromEvent)\(/.test(A), '부르는 곳은 paintStrokeMod.이름');
  const iM = html.indexOf('<script src="parts/creator/paint-stroke.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/paint-stroke.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const B = behave(MOD);
B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 획', 8: '── 2. 맞히기 · 솔기', 11: '── 3. 대칭', 13: '── 4. 페인트통 · 스포이드' }; if (s[i]) say(s[i]); chk(ok, msg); });
say('── 5. app.js 연결');
wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
chk(!SMOKE || /PRELOAD\.push\('paint-stroke\.js'\);/.test(SMOKE), 'smoke 가 paint-stroke.js 를 먼저 싣는다');
say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['쪼개기 최대 8 → 9', (m) => m.replace('CR_PAINT_MAX_STEPS = 8', 'CR_PAINT_MAX_STEPS = 9'), null, null],
  ['쪼개기 6px → 5px', (m) => m.replace('CR_PAINT_STEP_PX = 6', 'CR_PAINT_STEP_PX = 5'), null, null],
  ['옷 가려짐 없앰', (m) => m.replace('< hit.distance - 1e-3) return null;', '< -1) return null;'), null, null],
  ['솔기 판정 없앰', (m) => m.replace('> allow){ crState.lastPX=crState.lastPY=null; }', '> 99){ crState.lastPX=crState.lastPY=null; }'), null, null],
  ['대칭 없앰', (m) => m.replace('if(crState.symmetry){ const m=mirrorUV(hit);\n', 'if(false){ const m=mirrorUV(hit);\n'), null, null],
  ['스포이드 입구 전제 없앰', (m) => m.replace("  if(!crState.cBase.face || !document.getElementById('creatorPreview')) return false;\n", ''), null, null],
  ['스포이드 알파 8 → 0', (m) => m.replace('if(d[3]<8) return false;', 'if(d[3]<0) return false;'), null, null],
  ['지우개 되돌리기 없앰', (m) => m.replace("ctx.globalCompositeOperation='source-over'; blit(); }", 'blit(); }'), null, null],
  ['만들 때 던짐', (m) => m.replace('function createPaintStroke(deps){', 'function createPaintStroke(deps){ throw new Error("깨 봄");'), null, null],
  ['app.js 에 본문이 남음', null, (a) => a + '\nfunction paintAt(hit){}', null],
  ['deps 하나 빠짐', null, (a) => a.replace('  crState: crState,\n  isDrawStep:', '  isDrawStep:'), null],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/paint-stroke.js"></script>', '')],
];
for (const [name, fm, fa, fh] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
  let rows; try { rows = (fm ? behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 얼굴 칠하기는 creator/paint-stroke.js 에서'));
process.exit(fail ? 1 : 0);
