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

/** 그리기에 쓰는 2D 컨텍스트 몫 */
export interface FrontCtxLike {
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  clip(): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  drawImage(img: unknown, x: number, y: number, w: number, h: number): void;
}

/* 조각 가장자리를 이만큼(텍스처 픽셀) 넓혀 자른다 — 딱 맞게 자르면 이웃 조각 사이에 머리카락 같은 틈이 남는다. */
export const FRONT_PAD_PX = 0.8;

function padded(t: number[], px: number): number[] {
  const cx = ((t[0] as number) + (t[2] as number) + (t[4] as number)) / 3;
  const cy = ((t[1] as number) + (t[3] as number) + (t[5] as number)) / 3;
  const out: number[] = [];
  for (let i = 0; i < 6; i += 2) {
    const dx = (t[i] as number) - cx, dy = (t[i + 1] as number) - cy, l = Math.hypot(dx, dy) || 1;
    out.push((t[i] as number) + (dx / l) * px, (t[i + 1] as number) + (dy / l) * px);
  }
  return out;
}

/** 앞모습 판(src — 정사각형 그림 · 한 변 srcSize 픽셀)을 텍스처 캔버스(한 변 texSize)에 옮겨 그린다. 그린 조각 수. */
export function paintFront(ctx: FrontCtxLike, map: FrontMap, src: unknown, srcSize: number, texSize: number): number {
  if (!map || !src || !(srcSize > 0) || !(texSize > 0)) return 0;
  let drawn = 0;
  for (const t of map.tris) {
    const s = t.src.map((v) => v * srcSize);
    const d = t.dst.map((v) => v * texSize);
    const m = affineFor(s, d);
    if (!m) continue;
    const clip = padded(d, FRONT_PAD_PX);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(clip[0] as number, clip[1] as number);
    ctx.lineTo(clip[2] as number, clip[3] as number);
    ctx.lineTo(clip[4] as number, clip[5] as number);
    ctx.closePath();
    ctx.clip();
    ctx.setTransform(...m);
    ctx.drawImage(src, 0, 0, srcSize, srcSize);
    ctx.restore();
    drawn++;
  }
  return drawn;
}
