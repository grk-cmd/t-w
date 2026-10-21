import { readFileSync } from 'node:fs';
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SkeletonUtils } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { FRONT_PAD_PX, affineFor, createBody, frontMap, padTriangle, rasterFront, type FrontMap, type PixelsLike } from '../src/index';

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
    expect(avg(top)).toBeGreaterThan(avg(bot)); // 이 몸의 UV 는 이마 쪽 v 가 크다(재 보니 약 0.41~0.48 · 턱 쪽 약 0.31)
  });

  it('앞모습 판 위에서 조각끼리 겹치지 않는다 — 옆 · 뒤를 보는 조각이 섞이지 않았다', () => {
    const inTri = (t: number[], x: number, y: number) => {
      const [ax, ay, bx, by, cx, cy] = t as [number, number, number, number, number, number];
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d;
      const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      return l1 > 1e-6 && l2 > 1e-6 && 1 - l1 - l2 > 1e-6;
    };
    let worst = 0;
    for (let gy = 0.01; gy < 1; gy += 0.02)
      for (let gx = 0.01; gx < 1; gx += 0.02) worst = Math.max(worst, map.tris.filter((t) => inTri(t.src, gx, gy)).length);
    expect(worst).toBe(1);
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

  it('판 좌표 방향 — 오른쪽(+x)이 판 오른쪽 · 위(+y)가 판 위(0)', () => {
    const g = new THREE_NS.BufferGeometry();
    // 머리: (0,0)-(1,0)-(0,1) 앞을 보는 삼각형 · 아래: 머리 높이가 아닌 몸 삼각형
    g.setAttribute('position', new THREE_NS.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -10, 0, 1, -10, 0, 0, -9, 0], 3));
    g.setAttribute('uv', new THREE_NS.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6], 2));
    const m = frontMap(g)!;
    expect(m.frame).toEqual({ cx: 0.5, cy: 0.5, size: 1 });
    expect(m.tris[0]!.src).toEqual([0, 1, 1, 1, 0, 0]); // (0,0)→왼쪽 아래 · (1,0)→오른쪽 아래 · (0,1)→왼쪽 위
  });

  it('머리 높이에서 가장 앞(+z)으로 나온 섬을 고른다 — 뒤쪽 섬이 아니라', () => {
    const g = new THREE_NS.BufferGeometry();
    // 같은 높이 · 둘 다 앞을 보는 두 섬: 앞(z=+1, uv 0.1 언저리) · 뒤(z=-1, uv 0.9 언저리) — 그리고 아래 몸
    g.setAttribute('position', new THREE_NS.Float32BufferAttribute([
      0, 0, 1, 1, 0, 1, 0, 1, 1,
      0, 0, -1, 1, 0, -1, 0, 1, -1,
      0, -10, 0, 1, -10, 0, 0, -9, 0,
    ], 3));
    g.setAttribute('uv', new THREE_NS.Float32BufferAttribute([0.1, 0.1, 0.2, 0.1, 0.1, 0.2, 0.9, 0.9, 0.8, 0.9, 0.9, 0.8, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6], 2));
    const m = frontMap(g)!;
    expect(m.tris.length).toBe(1);
    expect(m.tris[0]!.dst[0]).toBeCloseTo(0.1, 6);
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

describe('rasterFront', () => {
  const pixels = (w: number, h: number, fill?: [number, number, number, number]): PixelsLike => {
    const data = new Uint8ClampedArray(w * h * 4);
    if (fill) for (let i = 0; i < data.length; i += 4) data.set(fill, i);
    return { width: w, height: h, data };
  };
  const alphaAt = (p: PixelsLike, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3]!;

  it('반투명 판도 얼굴 어디서나 같은 값 — 이웃 조각과 겹친 띠에서 두 번 칠해지거나 가장자리가 옅어지지 않는다', () => {
    const src = pixels(512, 512, [255, 0, 0, 153]);
    const dst = pixels(512, 512);
    const n = rasterFront(dst, map, src);
    expect(n).toBe(map.tris.filter((t) => affineFor(t.src.map((v) => v * 512), t.dst.map((v) => v * 512))).length);
    const seen = new Set<string>();
    for (let i = 0; i < dst.data.length; i += 4)
      if (dst.data[i + 3]) seen.add(Array.from(dst.data.subarray(i, i + 4)).join(','));
    expect([...seen]).toEqual(['255,0,0,153']);
  });

  it('조각 사이에 빈 픽셀이 없다 — 원래 삼각형 안 픽셀은 모두 칠한다', () => {
    const dst = pixels(512, 512);
    rasterFront(dst, map, pixels(512, 512, [0, 0, 0, 255]));
    let missing = 0;
    for (const t of map.tris) {
      const d = t.dst.map((v) => v * 512);
      const cx = (d[0]! + d[2]! + d[4]!) / 3, cy = (d[1]! + d[3]! + d[5]!) / 3;
      // 삼각형 모서리 위 점(꼭짓점 사이 가운데)도 — 이웃 조각과의 경계
      for (const [x, y] of [[cx, cy], [(d[0]! + d[2]!) / 2, (d[1]! + d[3]!) / 2], [(d[2]! + d[4]!) / 2, (d[3]! + d[5]!) / 2]])
        if (!alphaAt(dst, Math.min(511, Math.floor(x!)), Math.min(511, Math.floor(y!)))) missing++;
    }
    expect(missing).toBe(0);
  });

  it('앞모습 판의 자리를 UV 자리로 옮긴다 — 판 왼쪽 반만 칠하면 텍스처에서도 그 조각들만', () => {
    const src = pixels(512, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 256; x++) src.data.set([0, 0, 255, 255], (y * 512 + x) * 4);
    const dst = pixels(512, 512);
    rasterFront(dst, map, src);
    // 판에서 완전히 왼쪽(< 0.45)인 조각의 무게중심은 칠해지고, 완전히 오른쪽(> 0.55)인 조각은 비어 있다
    let leftOk = 0, rightOk = 0, left = 0, right = 0;
    for (const t of map.tris) {
      const xs = [t.src[0]!, t.src[2]!, t.src[4]!];
      const d = t.dst.map((v) => v * 512);
      const a = alphaAt(dst, Math.floor((d[0]! + d[2]! + d[4]!) / 3), Math.floor((d[1]! + d[3]! + d[5]!) / 3));
      if (Math.max(...xs) < 0.45) (left++, a === 255 && leftOk++);
      if (Math.min(...xs) > 0.55) (right++, a === 0 && rightOk++);
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
    expect(leftOk).toBe(left);
    expect(rightOk).toBe(right);
  });

  it('판 · 텍스처 크기가 달라도 같은 자리 — 판 256 · 텍스처 512', () => {
    const big = pixels(512, 512);
    rasterFront(big, map, pixels(512, 512, [10, 20, 30, 200]));
    const small = pixels(512, 512);
    rasterFront(small, map, pixels(256, 256, [10, 20, 30, 200]));
    expect(Array.from(small.data)).toEqual(Array.from(big.data));
  });

  it('크기가 없으면 아무것도 안 한다', () => {
    const dst = pixels(4, 4);
    expect(rasterFront(dst, map, pixels(0, 0))).toBe(0);
    expect(rasterFront(pixels(0, 0), map, pixels(4, 4))).toBe(0);
    expect(dst.data.every((v) => v === 0)).toBe(true);
  });
});

/* 모서리마다 바깥으로 민 거리 — 꼭짓점이 상한(MITER_MAX)에 잘리지 않은 모서리는 정확히 px */
function edgeOffsets(t: number[], p: number[]) {
  const out: number[] = [];
  for (let e = 0; e < 3; e++) {
    const a = e * 2, b = ((e + 1) % 3) * 2;
    const ex = t[b]! - t[a]!, ey = t[b + 1]! - t[a + 1]!, L = Math.hypot(ex, ey);
    const dist = (x: number, y: number) => Math.abs((x - t[a]!) * ey - (y - t[a + 1]!) * ex) / L;
    out.push(Math.min(dist(p[a]!, p[a + 1]!), dist(p[b]!, p[b + 1]!)));
  }
  return out;
}

describe('padTriangle — 모서리마다 바깥으로 민다', () => {
  it('정삼각형은 세 모서리 모두 정확히 px 만큼(돌림 방향과 상관없이)', () => {
    const t = [0, 0, 100, 0, 50, 86.6025403784];
    for (const tri of [t, [t[0]!, t[1]!, t[4]!, t[5]!, t[2]!, t[3]!]]) {
      const offs = edgeOffsets(tri, padTriangle(tri, 1.5));
      for (const o of offs) expect(o).toBeCloseTo(1.5, 6);
    }
  });

  it('돌림 방향(시계 · 반시계)과 상관없이 바깥으로 — 원래 꼭짓점이 밀린 삼각형의 모서리마다 px 만큼 안쪽', () => {
    const ccw = [10, 10, 60, 12, 30, 40];
    const cw = [ccw[0]!, ccw[1]!, ccw[4]!, ccw[5]!, ccw[2]!, ccw[3]!];
    for (const t of [ccw, cw]) {
      const p = padTriangle(t, 1);
      const area2 = (p[2]! - p[0]!) * (p[5]! - p[1]!) - (p[4]! - p[0]!) * (p[3]! - p[1]!);
      const s = Math.sign(area2);
      // 밀린 삼각형의 모서리마다, 원래 삼각형의 맞은 모서리 두 끝이 안쪽으로 1 이상 떨어져 있다
      for (let e = 0; e < 3; e++) {
        const a = e * 2, b = ((e + 1) % 3) * 2;
        const ex = p[b]! - p[a]!, ey = p[b + 1]! - p[a + 1]!, L = Math.hypot(ex, ey);
        const inside = (x: number, y: number) => (s * (ex * (y - p[a + 1]!) - ey * (x - p[a]!))) / L;
        expect(inside(t[a]!, t[a + 1]!)).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(inside(t[b]!, t[b + 1]!)).toBeGreaterThanOrEqual(1 - 1e-9);
      }
    }
  });

  it('진짜 얼굴 메쉬(512 텍스처) — 가는 조각도 모서리마다 FRONT_PAD_PX 만큼 밀린다(가운데에서 키우던 옛 방식은 0.19)', () => {
    let min = Infinity;
    for (const tr of map.tris) {
      const d = tr.dst.map((v) => v * 512);
      for (const o of edgeOffsets(d, padTriangle(d, FRONT_PAD_PX))) min = Math.min(min, o);
    }
    expect(FRONT_PAD_PX).toBeGreaterThanOrEqual(1);
    expect(min).toBeGreaterThanOrEqual(FRONT_PAD_PX - 1e-6);
  });

  it('넓이 0 · px 0 이면 그대로', () => {
    expect(padTriangle([0, 0, 1, 1, 2, 2], 1)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(padTriangle([0, 0, 5, 0, 0, 5], 0)).toEqual([0, 0, 5, 0, 0, 5]);
  });
});
