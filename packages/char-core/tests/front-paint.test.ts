import { readFileSync } from 'node:fs';
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { affineFor, createBody, frontMap, paintFront, type FrontCtxLike, type FrontMap } from '../src/index';

/* 진짜 three r128 + 앱에 든 진짜 기본 몸 GLB — 얼굴 메쉬의 정면 조각이 앞모습 판과 UV 사이를 제대로 잇는지 본다. */
const THREE = { ...THREE_NS, SkeletonUtils };
const baseGlb = (): ArrayBuffer => {
  const src = readFileSync(new URL('../../../apps/desktop/app/parts/base-glb.js', import.meta.url), 'utf8');
  const b = Buffer.from(/BASE_GLB_B64="([^"]+)"/.exec(src)![1]!, 'base64');
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

let faceGeo: THREE_NS.BufferGeometry;
let map: FrontMap;
beforeAll(async () => {
  const body = createBody({ THREE, gltf: new GLTFLoader(), fixMatLighting() {}, setFaceMap() {}, applyLightPreset() {}, warn() {} });
  expect(await body.loadBase(baseGlb())).toBe(true);
  faceGeo = body.instantiateBase()!.faceMesh.geometry;
  map = frontMap(faceGeo)!;
});

const apply = (m: number[], x: number, y: number) => [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];

describe('affineFor', () => {
  it('세 꼭짓점을 그대로 옮긴다', () => {
    const src = [0, 0, 10, 0, 0, 10], dst = [5, 5, 25, 7, 3, 30];
    const m = affineFor(src, dst)!;
    for (let i = 0; i < 6; i += 2) {
      const [x, y] = apply(m, src[i]!, src[i + 1]!);
      expect(x).toBeCloseTo(dst[i]!, 9);
      expect(y).toBeCloseTo(dst[i + 1]!, 9);
    }
  });
  it('넓이 0 이면 null', () => {
    expect(affineFor([0, 0, 1, 1, 2, 2], [0, 0, 1, 0, 0, 1])).toBeNull();
    expect(affineFor([3, 3, 3, 3, 3, 3], [0, 0, 1, 0, 0, 1])).toBeNull();
  });
});

describe('frontMap — 앱 기본 몸', () => {
  it('정면 얼굴 조각을 찾는다 — 가운데가 x=0 · 판은 정사각형 0~1', () => {
    expect(map).not.toBeNull();
    expect(map.tris.length).toBeGreaterThan(40);
    expect(Math.abs(map.frame.cx)).toBeLessThan(0.01);
    for (const t of map.tris) {
      for (const v of t.src) expect(v).toBeGreaterThanOrEqual(-1e-9), expect(v).toBeLessThanOrEqual(1 + 1e-9);
      for (const v of t.dst) expect(v).toBeGreaterThanOrEqual(0), expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('왼쪽 · 오른쪽이 고르게 — 판 가운데 선 양쪽 조각 수가 비슷하다(얼굴이 한쪽만 잡히지 않음)', () => {
    let l = 0, r = 0;
    for (const t of map.tris) ((t.src[0]! + t.src[2]! + t.src[4]!) / 3 < 0.5 ? l++ : r++);
    expect(Math.abs(l - r) / (l + r)).toBeLessThan(0.15);
  });

  it('판 위(눈 높이)가 UV 에서도 같은 쪽 — 위아래가 뒤집히지 않았다', () => {
    const top = map.tris.filter((t) => t.src[1]! < 0.4), bot = map.tris.filter((t) => t.src[1]! > 0.6);
    const avg = (ts: typeof top) => ts.reduce((s, t) => s + (t.dst[1]! + t.dst[3]! + t.dst[5]!) / 3, 0) / ts.length;
    expect(top.length).toBeGreaterThan(0);
    expect(bot.length).toBeGreaterThan(0);
    expect(avg(top)).not.toBeCloseTo(avg(bot), 2);
  });

  it('조각마다 아핀 변환이 꼭짓점을 UV 로 보낸다', () => {
    for (const t of map.tris.slice(0, 30)) {
      const m = affineFor(t.src, t.dst);
      if (!m) continue;
      for (let i = 0; i < 6; i += 2) {
        const [x, y] = apply(m, t.src[i]!, t.src[i + 1]!);
        expect(x).toBeCloseTo(t.dst[i]!, 6);
        expect(y).toBeCloseTo(t.dst[i + 1]!, 6);
      }
    }
  });

  it('위치 · UV 가 없으면 null(깨 보기)', () => {
    expect(frontMap(null)).toBeNull();
    const noUv = faceGeo.clone();
    noUv.deleteAttribute('uv');
    expect(frontMap(noUv)).toBeNull();
    const noPos = faceGeo.clone();
    noPos.deleteAttribute('position');
    expect(frontMap(noPos)).toBeNull();
  });

  it('머리 높이에 정면을 보는 조각이 없으면 null — 뒤를 보는 얼굴(깨 보기)', () => {
    // 위: 얼굴 자리 삼각형 · 아래: 정면을 보지만 머리 높이가 아닌 몸 삼각형(다른 UV 섬)
    const body = [0, -10, 0, 1, -10, 0, 0, -9, 0];
    const mk = (face: number[]) => {
      const g = new THREE_NS.BufferGeometry();
      g.setAttribute('position', new THREE_NS.Float32BufferAttribute([...face, ...body], 3));
      g.setAttribute('uv', new THREE_NS.Float32BufferAttribute([0, 1, 0.2, 0.8, 0, 0.8, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6], 2));
      return g;
    };
    expect(frontMap(mk([0, 1, 0, 1, 0, 0, 0, 0, 0]))).toBeNull(); // 시계 방향 — 법선이 뒤(-z)
    const m = frontMap(mk([0, 0, 0, 1, 0, 0, 0, 1, 0]))!; // 반시계 — 앞(+z)
    expect(m.tris.length).toBe(1); // 몸 삼각형은 다른 섬이라 안 들어간다
    const want = [0, 1, 0.2, 0.8, 0, 0.8];
    m.tris[0]!.dst.forEach((v, k) => expect(v).toBeCloseTo(want[k]!, 6)); // 얼굴 삼각형의 UV 가 그대로
  });
});

describe('paintFront', () => {
  function recorder() {
    const log: string[] = [];
    const ctx: FrontCtxLike = {
      save: () => log.push('save'),
      restore: () => log.push('restore'),
      beginPath: () => log.push('begin'),
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      clip: () => log.push('clip'),
      setTransform: (...m) => log.push('tf:' + m.map((v) => v.toFixed(3)).join(',')),
      drawImage: (_i, x, y, w, h) => log.push(`draw:${x},${y},${w},${h}`),
    };
    return { ctx, log };
  }

  it('조각마다 잘라서 한 번씩 그린다 · save/restore 짝이 맞는다', () => {
    const { ctx, log } = recorder();
    const n = paintFront(ctx, map, {}, 512, 512);
    expect(n).toBe(map.tris.filter((t) => affineFor(t.src.map((v) => v * 512), t.dst.map((v) => v * 512))).length);
    expect(log.filter((l) => l === 'clip').length).toBe(n);
    expect(log.filter((l) => l.startsWith('draw:0,0,512,512')).length).toBe(n);
    expect(log.filter((l) => l === 'save').length).toBe(log.filter((l) => l === 'restore').length);
  });

  it('그림 · 크기가 없으면 아무것도 안 한다', () => {
    const { ctx, log } = recorder();
    expect(paintFront(ctx, map, null, 512, 512)).toBe(0);
    expect(paintFront(ctx, map, {}, 0, 512)).toBe(0);
    expect(paintFront(ctx, map, {}, 512, 0)).toBe(0);
    expect(log).toEqual([]);
  });
});
