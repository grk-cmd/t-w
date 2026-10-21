import { createBody, createFace, createTone, frontMap, type FrontMap } from '@tw/char-core';
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bodyGlbUrl, skinUrls } from 'virtual:tw-char-assets';
import { loadImage } from '@/shared/lib/image';
import { FLAT_EMISSIVE } from './lighting';
import { fixMatLighting } from './mat-fix';

/* 앱처럼 SkeletonUtils 를 THREE 에 붙인 모양 — 코어가 몸을 복제할 때 이 이름으로 찾는다 */
const THREE = { ...THREE_NS, SkeletonUtils };

const makeCanvas = () => document.createElement('canvas');
const isDrawable = (v: unknown) =>
  v instanceof HTMLCanvasElement || v instanceof HTMLImageElement || v instanceof ImageBitmap;

/** 피부 고르기 단추 색 — 피부 그림의 얼굴 자리 평균(그림과 단추 색이 어긋나지 않게 그림에서 바로 뽑는다) */
function skinSwatches(face: ReturnType<typeof createFace>, map: FrontMap): string[] {
  const sz = face.CANVAS_SZ;
  let u0 = 1,
    u1 = 0,
    v0 = 1,
    v1 = 0;
  for (const t of map.tris)
    for (let i = 0; i < 6; i += 2) {
      u0 = Math.min(u0, t.dst[i] ?? 1);
      u1 = Math.max(u1, t.dst[i] ?? 0);
      v0 = Math.min(v0, t.dst[i + 1] ?? 1);
      v1 = Math.max(v1, t.dst[i + 1] ?? 0);
    }
  const cx = Math.round(((u0 + u1) / 2) * sz),
    cy = Math.round(((v0 + v1) / 2) * sz),
    half = 6;
  return face.skinCanvases.map((cv) => {
    const d = cv.getContext('2d')?.getImageData(cx - half, cy - half, half * 2, half * 2).data;
    if (!d) return '#cccccc';
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i] ?? 0;
      g += d[i + 1] ?? 0;
      b += d[i + 2] ?? 0;
      n++;
    }
    const hex = (v: number) =>
      Math.round(v / n)
        .toString(16)
        .padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  });
}

export type CharKit = Awaited<ReturnType<typeof loadCharKit>>;

/** 몸 모델 · 피부 그림을 받아 코어(몸 · 얼굴 · 톤)를 한 벌 만든다. 페이지에 한 번. */
export async function loadCharKit() {
  const tone = createTone({ THREE, flatEmissive: FLAT_EMISSIVE, fixMatLighting });
  const body = createBody({
    THREE,
    gltf: new GLTFLoader(),
    fixMatLighting,
    setFaceMap: tone.setFaceMap,
    applyLightPreset: tone.applyLightPresetToInstance,
  });
  const face = createFace({ makeCanvas, isDrawable });
  const [glb, skins] = await Promise.all([
    fetch(bodyGlbUrl).then((r) => {
      if (!r.ok) throw new Error(`몸 모델을 못 받았다: ${r.status}`);
      return r.arrayBuffer();
    }),
    Promise.all(skinUrls.map(loadImage)),
  ]);
  if (!(await body.loadBase(glb))) throw new Error('몸 모델을 읽지 못했다');
  // 피부 캔버스 같은 칸에 그림을 얹는다(앱 loadSkins 와 같다 — 얼굴 합성이 이 배열을 본다)
  skins.forEach((img, i) => {
    const c = face.skinCanvasFor(i).getContext('2d');
    c?.drawImage(img, 0, 0, face.CANVAS_SZ, face.CANVAS_SZ);
  });
  const probe = body.instantiateBase();
  const map: FrontMap | null = probe ? frontMap(probe.faceMesh.geometry) : null;
  if (!map) throw new Error('얼굴 앞모습 자리를 못 찾았다');
  return { THREE, body, face, tone, frontMap: map, skinSwatches: skinSwatches(face, map) };
}
