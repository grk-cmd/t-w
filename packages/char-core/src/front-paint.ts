/* 🖼️ 앞모습 그림 → 얼굴 텍스처 — 정면에서 본 그림(눈 · 눈썹 · 입을 쌓은 판)을 얼굴 메쉬의 UV 자리로 옮겨 그린다(슬라이드 비추듯).
   얼굴 UV 는 정면 모양과 다르게 늘어나 있어 그림을 텍스처에 그대로 찍으면 비뚤어진다 — 그래서 정면을 보는 삼각형마다
   «앞모습 좌표 → UV 좌표» 아핀 변환으로 그 조각만 옮긴다. THREE 를 안 본다(geometry 의 position · uv · index 만 읽는다).
   좌표 규약은 붓 · 페인트통과 같다 — 텍스처 캔버스 좌표 = uv × 크기. */

import { islandIds } from './uv-fill';

export interface Vec3AttrLike {
  count: number;
  getX(i: number): number;
  getY(i: number): number;
  getZ(i: number): number;
}
export interface FrontGeometryLike {
  attributes: { position?: Vec3AttrLike; uv?: { count: number; getX(i: number): number; getY(i: number): number } };
  index?: { count: number; getX(i: number): number } | null;
}

/** 정면을 보는 얼굴 조각 하나 — src 는 앞모습 판 좌표(0~1, 왼쪽 위가 0 · 화면에서 본 그대로), dst 는 UV(0~1). [x0,y0,x1,y1,x2,y2] */
export interface FrontTri {
  src: number[];
  dst: number[];
}

/** 앞모습 판이 덮는 자리 — geometry 좌표(정면 = +z). 판은 정사각형이라 긴 쪽에 맞춘다. */
export interface FrontFrame {
  cx: number;
  cy: number;
  /** 판 한 변의 길이(geometry 단위) */
  size: number;
}

export interface FrontMap {
  frame: FrontFrame;
  tris: FrontTri[];
}

export interface FrontOptions {
  /** 이 값보다 정면(+z)을 덜 보는 삼각형은 뺀다(옆 · 뒤 · 턱 밑). 0~1 */
  minFacing?: number;
  /** 몸 높이 중 위에서 이 몫만 머리로 본다 — 얼굴 섬을 찾을 때만 쓴다 */
  headShare?: number;
}

const DEF_MIN_FACING = 0.25;
const DEF_HEAD_SHARE = 0.45;

type Tri3 = [number, number, number];

/** 얼굴 메쉬 → 앞모습 판 ↔ UV 짝 목록. 얼굴 섬은 «머리 높이에서 가장 앞(+z)으로 나온 삼각형이 든 섬» — 코가 있는 자리다.
    UV · 위치가 없거나 그런 섬이 없으면 null. */
export function frontMap(geometry: FrontGeometryLike | null | undefined, opts?: FrontOptions): FrontMap | null {
  const g = geometry, pos = g && g.attributes.position, uv = g && g.attributes.uv;
  if (!g || !pos || !uv || !pos.count || !uv.count) return null;
  const ids = islandIds(g as never);
  if (!ids) return null;
  const minFacing = opts?.minFacing ?? DEF_MIN_FACING;
  const headShare = opts?.headShare ?? DEF_HEAD_SHARE;
  const vi = (i: number) => (g.index ? g.index.getX(i) : i);
  const n = ids.length;

  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const headY = yMax - (yMax - yMin) * headShare;

  const corners = (t: number): Tri3 => [vi(t * 3), vi(t * 3 + 1), vi(t * 3 + 2)];
  const facing = (t: number) => {
    const [a, b, c] = corners(t);
    const ux = pos.getX(b) - pos.getX(a), uy = pos.getY(b) - pos.getY(a), uz = pos.getZ(b) - pos.getZ(a);
    const wx = pos.getX(c) - pos.getX(a), wy = pos.getY(c) - pos.getY(a), wz = pos.getZ(c) - pos.getZ(a);
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    return len > 0 ? nz / len : -1;
  };

  let best = -1, bestZ = -Infinity;
  for (let t = 0; t < n; t++) {
    const [a, b, c] = corners(t);
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    if (cy < headY) continue;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    if (cz > bestZ && facing(t) > minFacing) {
      bestZ = cz;
      best = t;
    }
  }
  if (best < 0) return null;
  const island = ids[best];

  const picked: number[] = [];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let t = 0; t < n; t++) {
    if (ids[t] !== island || facing(t) <= minFacing) continue;
    picked.push(t);
    for (const v of corners(t)) {
      const x = pos.getX(v), y = pos.getY(v);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const size = Math.max(x1 - x0, y1 - y0);
  if (!picked.length || !(size > 0)) return null;
  const frame: FrontFrame = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size };

  // 앞모습 판: 화면에서 본 그대로 — 캐릭터의 오른손(-x)이 판 왼쪽 · 위(+y)가 판 위(0)
  const sx = (x: number) => (x - frame.cx) / size + 0.5;
  const sy = (y: number) => 0.5 - (y - frame.cy) / size;
  const tris: FrontTri[] = picked.map((t) => {
    const src: number[] = [], dst: number[] = [];
    for (const v of corners(t)) {
      src.push(sx(pos.getX(v)), sy(pos.getY(v)));
      dst.push(uv.getX(v), uv.getY(v));
    }
    return { src, dst };
  });
  return { frame, tris };
}

/** 삼각형 src → dst 로 보내는 아핀 변환 [a, b, c, d, e, f](canvas setTransform 순서). 넓이 0 이면 null. */
export function affineFor(src: number[], dst: number[]): [number, number, number, number, number, number] | null {
  const [x0, y0, x1, y1, x2, y2] = src as [number, number, number, number, number, number];
  const [u0, v0, u1, v1, u2, v2] = dst as [number, number, number, number, number, number];
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (!(Math.abs(det) > 1e-12)) return null;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
  const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det;
  const d = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  return [a, b, c, d, u0 - a * x0 - c * y0, v0 - b * x0 - d * y0];
}

/** 픽셀 판 — ImageData 와 같은 모양(RGBA · 한 줄 width × 4 · 색은 미리 곱하지 않은 값) */
export interface PixelsLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/* 조각 모서리마다 이만큼(텍스처 픽셀) 바깥으로 밀어 쓴다 — 딱 맞게 쓰면 이웃 조각 사이 픽셀이 비어 줄로 남는다.
   ⚠️ 가운데에서 키우는 방식으로 되돌리지 말 것 — 가는 조각은 모서리가 거의 안 밀려 줄이 다시 보인다. */
export const FRONT_PAD_PX = 1;
/* 뾰족한 꼭짓점은 밀린 두 모서리가 멀리서 만난다 — 꼭짓점이 이 배수보다 멀리 가지 않게 자른다 */
const MITER_MAX = 4;

/** 삼각형 모서리 셋을 각각 px 만큼 바깥으로 민 삼각형(꼭짓점 = 밀린 모서리끼리 만나는 곳). 넓이 0 이면 그대로. */
export function padTriangle(t: number[], px: number): number[] {
  const P = [0, 2, 4].map((i) => [t[i] as number, t[i + 1] as number] as const);
  const area2 = (P[1]![0] - P[0]![0]) * (P[2]![1] - P[0]![1]) - (P[2]![0] - P[0]![0]) * (P[1]![1] - P[0]![1]);
  if (!(Math.abs(area2) > 1e-12) || !(px > 0)) return t.slice(0, 6);
  const sign = area2 > 0 ? 1 : -1;
  const normal = (i: number) => {
    const a = P[i]!, b = P[(i + 1) % 3]!;
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
    return [(ey / l) * sign, (-ex / l) * sign] as const;
  };
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    // 꼭짓점 i = 모서리 i−1 과 모서리 i 를 px 씩 민 두 선이 만나는 곳 — 두 법선 합 방향으로 2·px / |n1 + n2|
    const n1 = normal((i + 2) % 3), n2 = normal(i);
    const bx = n1[0] + n2[0], by = n1[1] + n2[1], bl = Math.hypot(bx, by);
    const len = bl > 1e-6 ? Math.min((2 * px) / bl, px * MITER_MAX) : px * MITER_MAX;
    const ux = bl > 1e-6 ? bx / bl : n2[0], uy = bl > 1e-6 ? by / bl : n2[1];
    out.push(P[i]![0] + ux * len, P[i]![1] + uy * len);
  }
  return out;
}

/** 앞모습 판(src 픽셀)을 얼굴 텍스처(dst 픽셀)로 옮겨 쓴다. 쓴 조각 수.
    조각마다 padTriangle 로 민 삼각형 안의 픽셀을 «덮어쓴다»(섞지 않는다) — 캔버스로 잘라 그리면 겹친 띠에서 반투명 그림(볼터치 등)이
    두 번 칠해지거나, 자른 가장자리가 반쯤 칠해져 줄이 남는다. 겹친 띠는 이웃 조각이 같은 자리를 거의 같은 값으로 다시 쓸 뿐이다. */
export function rasterFront(dst: PixelsLike, map: FrontMap, src: PixelsLike): number {
  if (!map || !(src.width > 0) || !(src.height > 0) || !(dst.width > 0) || !(dst.height > 0)) return 0;
  const tw = dst.width, th = dst.height, out = dst.data;
  const px = [0, 0, 0, 0];
  let drawn = 0;
  for (const t of map.tris) {
    const d = [0, 2, 4].flatMap((i) => [(t.dst[i] as number) * tw, (t.dst[i + 1] as number) * th]);
    const s = [0, 2, 4].flatMap((i) => [(t.src[i] as number) * src.width, (t.src[i + 1] as number) * src.height]);
    const back = affineFor(d, s);
    if (!back) continue;
    const p = padTriangle(d, FRONT_PAD_PX) as [number, number, number, number, number, number];
    const area = (p[2] - p[0]) * (p[5] - p[1]) - (p[4] - p[0]) * (p[3] - p[1]);
    const sign = area > 0 ? 1 : -1;
    const x0 = Math.max(0, Math.floor(Math.min(p[0], p[2], p[4]))), x1 = Math.min(tw - 1, Math.ceil(Math.max(p[0], p[2], p[4])));
    const y0 = Math.max(0, Math.floor(Math.min(p[1], p[3], p[5]))), y1 = Math.min(th - 1, Math.ceil(Math.max(p[1], p[3], p[5])));
    // 모서리마다 «안쪽이면 0 이상» 인 일차식 ex·x + ey·y + ec
    const E: number[] = [];
    for (let i = 0; i < 3; i++) {
      const ax = p[i * 2]!, ay = p[i * 2 + 1]!, bx = p[((i + 1) % 3) * 2]!, by = p[((i + 1) % 3) * 2 + 1]!;
      E.push(-(by - ay) * sign, (bx - ax) * sign, ((by - ay) * ax - (bx - ax) * ay) * sign);
    }
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5;
        if (E[0]! * cx + E[1]! * cy + E[2]! < 0 || E[3]! * cx + E[4]! * cy + E[5]! < 0 || E[6]! * cx + E[7]! * cy + E[8]! < 0)
          continue;
        sample(src, back[0] * cx + back[2] * cy + back[4], back[1] * cx + back[3] * cy + back[5], px);
        const o = (y * tw + x) * 4;
        out[o] = px[0]!;
        out[o + 1] = px[1]!;
        out[o + 2] = px[2]!;
        out[o + 3] = px[3]!;
      }
    }
    drawn++;
  }
  return drawn;
}

/** 판 좌표(픽셀 가장자리 기준)의 색 — 이웃 넷을 섞되 알파를 곱해 섞는다(투명한 이웃의 색이 테두리에 번지지 않게) */
function sample(src: PixelsLike, x: number, y: number, out: number[]) {
  const fx = x - 0.5, fy = y - 0.5;
  const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
  let r = 0, g = 0, b = 0, a = 0;
  for (let k = 0; k < 4; k++) {
    const sx = Math.min(src.width - 1, Math.max(0, ix + (k & 1)));
    const sy = Math.min(src.height - 1, Math.max(0, iy + (k >> 1)));
    const w = (k & 1 ? ax : 1 - ax) * (k >> 1 ? ay : 1 - ay);
    const o = (sy * src.width + sx) * 4;
    const wa = (src.data[o + 3] as number) * w;
    r += (src.data[o] as number) * wa;
    g += (src.data[o + 1] as number) * wa;
    b += (src.data[o + 2] as number) * wa;
    a += wa;
  }
  if (a > 0) {
    out[0] = r / a;
    out[1] = g / a;
    out[2] = b / a;
  } else out[0] = out[1] = out[2] = 0;
  out[3] = a;
}
