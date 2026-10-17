/* sim-cr-stamp.js — 🖼 생성기 이미지 도장(creator/stamp.js) 동작 · 연결
   실행:  node sim-cr-stamp.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 도장은 «격자 · 빗금 자국» · «턱이 덜 찍힘» · «밖으로 나가 손잡이를 못 누름» 제보를 여러 번 고친 곳이다.
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) 켜기 · 불러오기 · 초기화 · 찍기(진짜 래스터) · 손잡이를 가짜 DOM 위에서 돌려 고정한다.
   ・1절: 모드 — 켜기(지우개 끄기 · 버튼 · 패널 · 띄운 그림 자리 · 커서) · 끄기 · clearStampState(그림 · 배치는 남김)
   ・2절: 불러오기 · 초기화 — 그림 아님 무시 · 처음 배치(짧은 변 × 0.4 · 가운데 · 회전 0) · 만진 뒤(dirty)면 비율만 · (true) 는 위치까지
   ・3절: 찍기 — 얼굴 위 픽셀만 칠함 · 되돌리기 한 칸 · 감은눈 표시 · 90% 밖이면 안 찍음 · 20% 넘게 밖이면 알림 · 대칭(치우치면 거울 · 가운데면 생략)
   ・4절: 손잡이 — 끌기 이동 · Shift 가운데 맞춤 · 회전 Shift 15° · 모서리 최소 20 · dirty
   ・5절: 입구 전제 · 6절: app.js 연결 · 7절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => process.stdout.write(s + '\n');
console.log = () => {};   // 모듈이 남기는 진단 로그([도장] 얼굴 밖 격자점 …)는 판정과 무관 — 출력만 줄인다
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('creator/stamp.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !APP || !HTML) { say('  ? 원본 못 찾음 — stamp.js · app.js · desk-companion-prototype.html'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const SZ = 64;   // 그림 층 한 변(작게 — 래스터를 빨리)

function el(id, extra) {
  const L = {};
  return Object.assign({ id, style: {}, src: '', value: '', classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); } },
    addEventListener(t, f) { (L[t] = L[t] || []).push(f); }, fire(t, e) { (L[t] || []).forEach((f) => f(Object.assign({ preventDefault() {}, stopPropagation() {}, pointerId: 1 }, e))); },
    setPointerCapture() {}, click() { this.fire('click', {}); } }, extra || {});
}
/* 그림 층 · 오프스크린 캔버스 — 쓴 픽셀을 그대로 들고 있다 */
function canvas2d(w, h) {
  const c = { width: w, height: h };
  const ctx = { imageSmoothingEnabled: false, imageSmoothingQuality: '', globalCompositeOperation: 'source-over', _img: null, draws: [],
    drawImage(src) { this.draws.push(src); if (src && src.srcData) this._src = src.srcData; },
    getImageData(x, y, W, H) { return { data: this._src ? this._src(W, H) : new Uint8ClampedArray(W * H * 4) }; },
    createImageData(W, H) { return { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }; },
    putImageData(img) { this._img = img; }, save() {}, restore() {}, translate() {}, scale() {} };
  c.getContext = () => ctx; c.ctx = ctx;
  return c;
}
class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } clone() { return new V3(this.x, this.y, this.z); } distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); } }

/* 세계: 미리보기 200×200. 얼굴은 화면 [faceL, faceR] 가로 범위 — 그 안이면 uv = 화면/200(같은 비율), 3D 점은 화면/100 */
function world(src, o = {}) {
  const log = { toasts: [], hist: 0, blits: 0, drops: 0, listeners: {} };
  const ids = ['stampOverlay', 'stampOverlayImg', 'stampBtn', 'stampPanel', 'stampApply', 'stampCancel', 'stampReset', 'stampThumb'];
  const E = {}; ids.forEach((i) => { E[i] = el(i); });
  E.creatorPreview = el('creatorPreview', { offsetLeft: 10, offsetTop: 20, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) });
  const handles = {}; ['tl', 'tr', 'bl', 'br', 'rot', 'reset'].forEach((k) => { handles[k] = el('h-' + k); });
  E.stampOverlay.querySelector = (q) => handles[q.replace('.stamp-h-', '')] || null;
  (o.drop || []).forEach((k) => { delete E[k]; });
  const created = [];
  const doc = { getElementById: (i) => E[i] || null, createElement: () => { const c = canvas2d(0, 0); created.push(c); return c; } };
  const layer = canvas2d(SZ, SZ);
  const faceL = o.faceL === undefined ? 0 : o.faceL, faceR = o.faceR === undefined ? 200 : o.faceR;
  let ndc = null;
  const paintStrokeMod = { _pndc: { x: 0, y: 0 }, _pray: { ray: { origin: new V3(0, 0, 5), direction: new V3(0, 0, -1) }, setFromCamera(n) { ndc = { x: n.x, y: n.y }; } } };
  const face = {};
  const partPaintMod = {
    _picIntersect: (ray, ms) => { if (ms[0] !== face || !ndc) return null; const sx = (ndc.x + 1) * 100, sy = (1 - ndc.y) * 100; if (sx < faceL || sx > faceR) return null;
      return { uv: { x: sx / 200, y: sy / 200 }, point: new V3(sx / 100, sy / 100, 0) }; },
    _stampWrapCenter: () => null, _stampWrapFill: () => 0, _wdPicUvScale: () => 1,
  };
  const st = { stampMode: false, stampImg: null, stampDirty: !!o.dirty, stampPlace: { cx: 0, cy: 0, w: 120, h: 120, rot: 0, aspect: 1 },
    cBase: o.noBase ? null : { face }, cCam: {}, symmetry: !!o.symmetry, crStep: o.step || 2, blinkEdited: false };
  /* 도장 그림 — 8×8 빨강(알파 255) */
  const img = { naturalWidth: 8, naturalHeight: o.imgH || 8, srcData: (W, H) => { const d = new Uint8ClampedArray(W * H * 4); for (let k = 0; k < d.length; k += 4) { d[k] = 255; d[k + 3] = 255; } return d; } };
  class FR { readAsDataURL(f) { this.onload({ target: { result: 'data:' + f.name } }); } }
  class Img { set src(v) { this._s = v; this.naturalWidth = o.loadW || 100; this.naturalHeight = o.loadH || 50; this.onload(); } get src() { return this._s; } }
  const winL = (t, f) => { (log.listeners[t] = log.listeners[t] || []).push(f); };
  const T = new Function('window', 'document', 'FileReader', 'Image', 'addEventListener', 'module', src + '\nreturn window.TwCrStamp;')({}, doc, FR, Img, winL, undefined);
  const out = T.createCrStamp({
    CANVAS_SZ: SZ, crState: st, paintStrokeMod, partPaintMod,
    _crDropEraser: () => { log.drops++; }, actC: () => layer, blit: () => { log.blits++; }, isDrawStep: () => o.drawStep !== false,
    pushHistory: () => { log.hist++; }, toast: (m) => log.toasts.push(m),
  });
  const px = (x, y) => { const off = created.find((c) => c.ctx._img); if (!off || !layer.ctx.draws.includes(off)) return null; const d = off.ctx._img.data, k = (y * SZ + x) * 4; return [d[k], d[k + 3]]; };
  const win = (t, e) => (log.listeners[t] || []).forEach((f) => f(Object.assign({ shiftKey: false }, e)));
  return { out, log, st, E, handles, img, layer, px, win, created };
}

function behave(src) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = world(src); } catch (e) { err = e; }
  const NAMES = ['bindStampOverlay', 'cancelStamp', 'clearStampState', 'commitStamp', 'loadStampFromFile', 'resetStampPlacement', 'setStampMode'];
  t(!err && w && Object.keys(w.out).sort().join() === NAMES.join(), '만들 때 던지지 않고 내놓는 이름 일곱' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;

  w.st.stampImg = w.img; w.st.stampPlace = { cx: 100, cy: 80, w: 40, h: 30, rot: 0.5, aspect: 1 };
  w.out.setStampMode(true);
  const ov = w.E.stampOverlay.style;
  t(w.st.stampMode && w.log.drops === 1 && w.E.stampBtn.classList.contains('on') && w.E.stampPanel.style.display === 'flex' && w.E.stampApply.style.display === 'inline-block' && w.E.stampReset.style.display === 'inline-block'
    && w.E.creatorPreview.style.cursor === 'crosshair', '켜기 — 지우개 끄기 · 버튼 on · 패널 · (그림이 있으면) 찍기 · 취소 · 초기화 버튼 · 커서 crosshair');
  t(ov.display === 'block' && ov.left === (10 + 100 - 20) + 'px' && ov.top === (20 + 80 - 15) + 'px' && ov.width === '40px' && ov.height === '30px' && ov.transform === 'rotate(0.5rad)', '띄운 그림 — 캔버스 오프셋 + 배치(가운데 기준) · 크기 · 회전');
  w.out.cancelStamp();
  t(!w.st.stampMode && !w.E.stampBtn.classList.contains('on') && w.E.stampPanel.style.display === 'none' && ov.display === 'none', '끄기(cancelStamp) — 모드 · 버튼 · 패널 · 띄운 그림 끔');
  w.out.setStampMode(true); w.out.clearStampState();
  t(!w.st.stampMode && w.E.stampApply.style.display === 'none' && w.E.stampOverlay.style.display === 'none' && w.st.stampImg === w.img && w.st.stampPlace.w === 40, 'clearStampState — 화면은 닫고 그림 · 배치는 남긴다(다음 캐릭터에서 다시 쓰게)');
  const w0 = world(src, { drawStep: false }); w0.out.setStampMode(true);
  t(w0.E.creatorPreview.style.cursor === 'default', '그리기 단계가 아니면 커서 default');

  w = world(src);
  w.out.loadStampFromFile({ type: 'text/plain', name: 'a.txt' });
  t(!w.st.stampImg && !w.st.stampMode, '그림이 아닌 파일은 무시');
  w.out.loadStampFromFile({ type: 'image/png', name: 'a.png' });
  let p = w.st.stampPlace;
  t(w.st.stampImg && near(p.aspect, 2) && near(p.w, 80) && near(p.h, 40) && p.cx === 100 && p.cy === 100 && p.rot === 0 && w.st.stampMode && w.E.stampOverlayImg.src === 'data:a.png' && w.E.stampThumb.style.display === 'inline-block',
    '처음 불러오기 — 짧은 변 × 0.4 너비 · 비율대로 높이 · 가운데 · 회전 0 · 모드 켬 · 미리보기 그림');
  w = world(src, { dirty: true }); w.st.stampPlace = { cx: 30, cy: 40, w: 50, h: 60, rot: 1, aspect: 1 };
  w.out.loadStampFromFile({ type: 'image/png', name: 'b.png' });
  p = w.st.stampPlace;
  t(p.cx === 30 && p.w === 50 && p.rot === 1 && near(p.aspect, 2), '크기 · 회전을 만진 뒤(dirty)면 그림만 바꾸고 배치는 그대로(비율만 새로)');
  w.st.stampImg = { naturalWidth: 100, naturalHeight: 25 };
  w.out.resetStampPlacement();
  p = w.st.stampPlace;
  t(near(p.w, 80) && near(p.h, 20) && p.rot === 0 && p.cx === 30 && !w.st.stampDirty, '초기화(↺) — 크기 · 회전만 처음대로 · 위치는 그대로 · dirty 풀기');
  w.out.resetStampPlacement(true);
  t(w.st.stampPlace.cx === 100 && w.st.stampPlace.cy === 100, '초기화(true · 패널 버튼) — 위치까지 가운데로');

  /* 찍기 — 화면 (80~120, 80~120) 정사각형 = uv 0.4~0.6 = 그림 층 25.6~38.4 px */
  const stamp = (o2, place) => { const x = world(src, o2); x.st.stampImg = x.img; x.st.stampPlace = Object.assign({ cx: 100, cy: 100, w: 40, h: 40, rot: 0, aspect: 1 }, place || {}); x.out.commitStamp(); return x; };
  w = stamp({ step: 3 });
  const inP = w.px(32, 32), outP = w.px(5, 5);
  t(inP && inP[0] === 255 && inP[1] === 255 && outP && outP[1] === 0, '찍기 — 도장 자리 픽셀은 그림 색 · 알파 그대로, 밖은 그대로(투명)');
  t(w.log.hist === 1 && w.log.blits === 1 && w.st.blinkEdited && w.layer.ctx.draws.length === 1 && w.layer.ctx.globalCompositeOperation === 'source-over', '되돌리기 한 칸 · 그림 층에 한 번 얹기 · 화면 갱신 · 감은눈(3단계)이면 표시');
  t(w.px(24, 32)[1] === 0 && w.px(40, 32)[1] === 0, '가장자리 바깥(도장 자리 밖 1~2px)은 칠하지 않는다');
  w = stamp({ faceL: 300 });
  t(w.log.toasts[0] === '도장이 캐릭터 밖에 있어요 — 얼굴 위로 옮겨주세요' && !w.layer.ctx.draws.length && w.log.blits === 0, '격자점 90% 넘게 얼굴 밖 — 안 찍고 알린다');
  w = stamp({ faceL: 100 });
  t(/^도장 일부가 얼굴을 벗어나 잘렸어요 \(\d+%만 찍힘\)$/.test(w.log.toasts[0] || '') && w.px(36, 32)[1] === 255 && w.px(28, 32)[1] === 0, '20% 넘게 밖 — 찍고 «n%만 찍힘» 알림 · 얼굴 위만 칠함');
  w = stamp({ symmetry: true }, { cx: 60 });
  t(w.px(19, 32)[1] === 255 && w.px(45, 32)[1] === 255 && w.st.stampPlace.cx === 60 && w.st.stampImg === w.img, '대칭 — 한쪽으로 치우치면 거울 자리에도 · 끝나면 배치 · 그림 되돌림');
  w = stamp({ symmetry: true }, { cx: 110 });
  t(w.px(32, 32)[1] === 255 && w.px(24, 32)[1] === 0, '대칭 — 가운데 근처(반너비 안)면 거울을 생략(반전 이중상 방지)');   // 24px = 거울 자리에만 드는 칸
  w = stamp({ noBase: true });
  const w5 = world(src); w5.out.commitStamp();
  t(!w.log.hist && !w5.log.hist, '그림 · 캐릭터 얼굴이 없으면 찍지 않는다');

  w = world(src); w.st.stampPlace = { cx: 100, cy: 100, w: 40, h: 40, rot: 0, aspect: 2 };
  w.out.bindStampOverlay();
  w.E.stampOverlayImg.fire('pointerdown', { clientX: 100, clientY: 100 }); w.win('pointermove', { clientX: 130, clientY: 90 }); w.win('pointerup', {});
  t(w.st.stampPlace.cx === 130 && w.st.stampPlace.cy === 90 && !w.st.stampDirty, '끌기 — 그만큼 옮긴다(옮기기는 dirty 아님)');
  w.E.stampOverlayImg.fire('pointerdown', { clientX: 130, clientY: 90 }); w.win('pointermove', { clientX: 150, clientY: 70, shiftKey: true }); w.win('pointerup', {});
  t(w.st.stampPlace.cx === 100 && w.st.stampPlace.cy === 70, 'Shift 끌기 — 가로 가운데에 붙이고 세로만 따라간다');
  w.handles.rot.fire('pointerdown', { clientX: 140, clientY: 70 }); w.win('pointermove', { clientX: 100 + 40 * Math.cos(0.3), clientY: 70 + 40 * Math.sin(0.3), shiftKey: true }); w.win('pointerup', {});
  t(near(w.st.stampPlace.rot, 15 * Math.PI / 180) && w.st.stampDirty, '회전 — Shift 면 15° 단위로 · dirty');
  w.st.stampPlace = { cx: 100, cy: 100, w: 40, h: 40, rot: 0, aspect: 2 };
  w.handles.br.fire('pointerdown', { clientX: 120, clientY: 120 }); w.win('pointermove', { clientX: 85, clientY: 85 }); w.win('pointerup', {});
  t(w.st.stampPlace.w === 20 && w.st.stampPlace.h === 20 && w.st.stampPlace.cx === 90 && w.st.stampPlace.cy === 90, '모서리 — 맞은편 모서리를 고정하고 크기 · 가운데를 다시 · 최소 20');
  w.handles.br.fire('pointerdown', { clientX: 100, clientY: 100 }); w.win('pointermove', { clientX: 160, clientY: 100, shiftKey: true }); w.win('pointerup', {});
  t(near(w.st.stampPlace.w / w.st.stampPlace.h, 2), '모서리 Shift — 처음 비율(aspect) 유지');
  w.handles.reset.fire('click', {});
  t(w.st.stampPlace.rot === 0 || !w.st.stampImg, '↺ 손잡이 — 초기화를 부른다(그림이 없으면 아무 일 없음)');

  /* 입구 전제 */
  let threw = false;
  try {
    const a = world(src, { drop: ['creatorPreview'] }); a.st.stampImg = a.img; a.out.loadStampFromFile({ type: 'image/png', name: 'c.png' }); a.out.resetStampPlacement(true); a.out.commitStamp(); a.out.bindStampOverlay();
    const b = world(src, { drop: ['stampOverlayImg'] }); b.out.loadStampFromFile({ type: 'image/png', name: 'c.png' }); b.out.bindStampOverlay();
    t(!a.log.hist && !a.st.stampMode && !Object.keys(a.log.listeners).length && !b.st.stampImg && !Object.keys(b.log.listeners).length, '입구 전제 — 미리보기 캔버스 · 띄운 그림이 없으면 불러오기 · 초기화 · 찍기 · 손잡이 모두 아무것도 안 한다');
  } catch (e) { threw = true; }
  if (threw) t(false, '입구 전제 — 미리보기 캔버스 · 띄운 그림이 없을 때 던졌다');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  t(!/function commitStamp\b|function setStampMode\b|function bindStampOverlay\b|function refreshStampOverlay\b/.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const crStampMod = TwCrStamp\.createCrStamp\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim().split(':')[0]).join() === 'CANVAS_SZ,_crDropEraser,actC,blit,crState,isDrawStep,paintStrokeMod,partPaintMod,pushHistory,toast' && /  crState: crState,/.test(mk),
    '만드는 줄(가드 없이) · deps 10 — 생성기 상태는 crState 하나');
  t(/crStampMod\.commitStamp\(\)/.test(A) && /crStampMod\.setStampMode\(/.test(A) && !/(^|[^.\w$])(commitStamp|setStampMode|clearStampState)\(/.test(A), '부르는 곳은 crStampMod.이름');
  const iM = html.indexOf('<script src="parts/creator/stamp.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — creator/stamp.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const B = behave(MOD);
B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 모드', 6: '── 2. 불러오기 · 초기화', 11: '── 3. 찍기', 19: '── 4. 손잡이', 25: '── 5. 입구 전제' }; if (s[i]) say(s[i]); chk(ok, msg); });
say('── 6. app.js 연결');
wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
chk(!SMOKE || /PRELOAD\.push\('stamp\.js'\);/.test(SMOKE), 'smoke 가 stamp.js 를 먼저 싣는다');
say('── 7. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['처음 너비 0.4 → 0.5', (m) => m.replace('const STAMP_FIRST_W = 0.4;', 'const STAMP_FIRST_W = 0.5;'), null, null],
  ['dirty 무시', (m) => m.replace('    if(!crState.stampDirty){', '    if(true){'), null, null],
  ['초기화가 위치도 옮김', (m) => m.replace('  if(alsoPos){ crState.stampPlace.cx = r.width/2; crState.stampPlace.cy = r.height/2; }', '  { crState.stampPlace.cx = r.width/2; crState.stampPlace.cy = r.height/2; }'), null, null],
  ['clearStampState 가 그림을 지움', (m) => m.replace('function clearStampState(){\n  crState.stampMode=false;', 'function clearStampState(){\n  crState.stampMode=false; crState.stampImg=null;'), null, null],
  ['90% 밖이어도 찍음', (m) => m.replace('STAMP_SKIP_RATIO = 0.9,', 'STAMP_SKIP_RATIO = 9,'), null, null],
  ['되돌리기 안 남김', (m) => m.replace('  pushHistory();\n  // 가장자리', '  // 가장자리'), null, null],
  ['대칭 생략 조건 없앰', (m) => m.replace('if(crState.symmetry && Math.abs(crState.stampPlace.cx - r.width/2) >= crState.stampPlace.w*0.5){', 'if(crState.symmetry){'), null, null],
  ['회전 스냅 15° → 10°', (m) => m.replace('const STAMP_ROT_SNAP_DEG = 15;', 'const STAMP_ROT_SNAP_DEG = 10;'), null, null],
  ['모서리 최소 20 → 10', (m) => m.replace('const STAMP_MIN_PX = 20;', 'const STAMP_MIN_PX = 10;'), null, null],
  ['입구 전제 없앰(찍기)', (m) => m.replace("  if(!document.getElementById('creatorPreview')) return;   // 입구 전제 — 미리보기 캔버스\n  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();\n  // 도장", "  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();\n  // 도장"), null, null],
  ['만들 때 던짐', (m) => m.replace('function createCrStamp(deps){', 'function createCrStamp(deps){ throw new Error("깨 봄");'), null, null],
  ['app.js 에 본문이 남음', null, (a) => a + '\nfunction commitStamp(){}', null],
  ['deps 하나 빠짐', null, (a) => a.replace('createCrStamp({\n  CANVAS_SZ: CANVAS_SZ,\n', 'createCrStamp({\n'), null],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/creator/stamp.js"></script>', '')],
];
for (const [name, fm, fa, fh] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML;
  let rows; try { rows = (fm ? behave(m2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 이미지 도장은 creator/stamp.js 에서'));
process.exit(fail ? 1 : 0);
