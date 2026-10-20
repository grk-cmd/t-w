import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { describe, expect, it } from 'vitest';

/* 코어 경계 — 코어는 앱 · 웹 어느 쪽 전역에도 기대지 않는다(#430 3.2 · 4절).
   글자 찾기가 아니라 앱이 싣는 빌드 사본(apps/desktop/app/vendor/char-core/)을 덫 전역 위에서 실제로 돌려 본다.
   ⚠️ 사본이 빌드와 같은지는 CI «앱 사본이 빌드와 같은가» 가 본다 — 여기는 그 사본의 행동을 본다. */
const IIFE_PATH = new URL('../../../apps/desktop/app/vendor/char-core/char-core.iife.js', import.meta.url);
const ESM_PATH = new URL('../dist/char-core.mjs', import.meta.url);
const FORBIDDEN_GLOBALS = ['window', 'localStorage', 'sessionStorage', 'indexedDB', 'firebaseAPI', 'companion', 'firebase', 'fetch', 'XMLHttpRequest'];
/* 유료 자산을 해석 · 조립하는 모듈 이름 — 코어(그래서 웹 번들)에 들어오면 안 된다. DCC1 이 그대로 싣는 칸 이름(isCommission · commGlb)은 해석이 아니라 통과라 뺀다. */
const PAID_MODULE_WORDS = ['gacha', 'DCK1', 'licenseOnly', 'asset-code', 'assetCode', 'parseGlbFull', 'commission.js', 'catalog-glb', '.dcc'];

function trapContext(touched: string[]) {
  const ctx: Record<string, unknown> = { console, Math, JSON, Promise, Uint8Array, Int16Array, Int32Array, Uint8ClampedArray, WeakMap, Map, Set, Array, Object, Number, String, Error, RegExp, isFinite, atob, btoa, TextEncoder, TextDecoder, crypto };
  for (const g of FORBIDDEN_GLOBALS) Object.defineProperty(ctx, g, { get() { touched.push(g); return undefined; }, configurable: true });
  return ctx;
}
function loadCore(src: string, touched: string[]) {
  return runInNewContext(src + '\n;TwCharCore', trapContext(touched)) as any;
}
const THREE = { ...THREE_NS, SkeletonUtils };
const fakeCanvas = () => { const c: any = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, clearRect() {}, drawImage() {}, getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) }) }; return c; };

async function exercise(core: any) {
  core.createCharCore({ THREE: { REVISION: '128' } });
  const tone = core.createTone({ THREE, flatEmissive: 0.3, fixMatLighting() {} });
  const face = core.createFace({ makeCanvas: fakeCanvas, isDrawable: () => true, warn() {} });
  face.compositeFace(1, fakeCanvas()); face.isBlankDraw(face.newCanvas()); face.snapCanvas(fakeCanvas());
  const body = core.createBody({ THREE, gltf: new GLTFLoader(), fixMatLighting() {}, setFaceMap: tone.setFaceMap, applyLightPreset: tone.applyLightPresetToInstance, warn() {} });
  const src = readFileSync(new URL('../../../apps/desktop/app/parts/base-glb.js', import.meta.url), 'utf8');
  const b = Buffer.from(/BASE_GLB_B64="([^"]+)"/.exec(src)![1]!, 'base64');
  await body.loadBase(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const ch = body.assemble({ faceTex: null, blinkTex: null, top: '#ff0000', bot: '#00ff00', recolor: true, skinColor: '#fff' });
  const parts = core.createParts({ THREE, tone, applyPartMatTone: tone.applyPartMatTone, forceOpaqueAlphaOutput() {}, meshIsPic: () => false, picRepairUV: () => false, uvLooksBroken: () => false, log() {}, warn() {} });
  const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ name: 'x_col' })));
  const pr = parts.prepareScene(g, 'hat');
  const w = parts.wrapPart(pr.obj, 'hat', false);
  const bones = parts.collectCharBones(ch.root);
  w.wrapper.userData.colorGroups = pr.colorGroups;
  parts.computeAuthorOffset(w.bb, w.center, bones.head, ch.root, 'hat', bones, {});
  parts.applyXfToWrapper(w.wrapper, { scale: 1, pos: [0, 0, 0], rot: [0, 0, 0], color: { col1: '#ff0000' } }, 'hat', { defaultXf: () => null, defaultOffsets: {} });
  const code = await core.encodeCloneCode({ face: { toDataURL: () => 'F' }, blink: { toDataURL: () => 'B' }, top: 't', bot: 'b' }, 'pw', { shrinkDataUrl: async (u: unknown) => u });
  await core.decodeCloneCode(code, 'pw');
  const geo = { attributes: { uv: { count: 3, getX: (i: number) => [0, 1, 0][i]!, getY: (i: number) => [0, 0, 1][i]! } }, index: null };
  core.uvFill.canvasLayout(8, [geo]);
}

describe('코어 경계 — 덫 전역 위에서 돌려 본다', () => {
  it('앱이 싣는 빌드 사본은 window · 저장소 · firebase · companion · 네트워크를 건드리지 않는다', async () => {
    const touched: string[] = [];
    await exercise(loadCore(readFileSync(IIFE_PATH, 'utf8'), touched));
    expect(touched).toEqual([]);
  });
  it('깨 보기 — 코어가 localStorage 를 읽으면 잡힌다', async () => {
    const touched: string[] = [];
    const src = readFileSync(IIFE_PATH, 'utf8').replace('function createTone(deps) {', 'function createTone(deps) { void localStorage;');
    await exercise(loadCore(src, touched));
    expect(touched).toContain('localStorage');
  });
  it('깨 보기 — window 에 이름을 걸면 잡힌다', async () => {
    const touched: string[] = [];
    const src = readFileSync(IIFE_PATH, 'utf8').replace('function createFace(deps) {', 'function createFace(deps) { try { window.x = 1; } catch (_) {}');
    await exercise(loadCore(src, touched));
    expect(touched).toContain('window');
  });
});

describe('유료 자산 모듈 이름이 번들에 없다', () => {
  const find = (txt: string) => PAID_MODULE_WORDS.filter((w) => txt.includes(w));
  it('앱 사본(IIFE) · 웹용 ESM', () => {
    expect(find(readFileSync(IIFE_PATH, 'utf8'))).toEqual([]);
    let esm = '';
    try { esm = readFileSync(ESM_PATH, 'utf8'); } catch (_) { /* 빌드 전(시험이 빌드보다 먼저 도는 CI 차례) — 앱 사본으로 본다 */ }
    if (esm) expect(find(esm)).toEqual([]);
  });
  it('깨 보기 — 가챠 모듈 이름이 섞이면 잡힌다', () => {
    expect(find('var x = require("./gacha");')).toEqual(['gacha']);
  });
});
