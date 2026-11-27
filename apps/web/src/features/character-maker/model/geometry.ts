import { ACC_SLOT, FACE_UNITS, SLOT, isEyePart, type AdjTarget } from './catalog';
import type { Acc, Adjust, CreatorState, Side } from './state';

/* 얼굴 판(200) 위의 자리 계산 — 그리기(drawFace)와 끌기(drag)가 같은 행렬을 쓴다.
   행렬은 canvas setTransform 순서 [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f */
export type Mat = readonly [number, number, number, number, number, number];
export interface Pt {
  x: number;
  y: number;
}

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det,
    b = -m[1] / det,
    c = -m[2] / det,
    d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export const apply = (m: Mat, p: Pt): Pt => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});
/** 옮김 없이 방향 · 크기만(끈 거리 바꾸기) */
export const applyLinear = (m: Mat, v: Pt): Pt => ({
  x: m[0] * v.x + m[2] * v.y,
  y: m[1] * v.x + m[3] * v.y,
});

/** (x + a.x, y + a.y) 로 옮기고 → a.r 도 돌리고 → a.s 배(flip 이면 좌우 뒤집어) — 한 짝을 놓는 행렬 */
export function placeMatrix(x: number, y: number, a: Adjust, flip: boolean): Mat {
  const r = (a.r * Math.PI) / 180,
    cos = Math.cos(r),
    sin = Math.sin(r);
  const sx = flip ? -a.s : a.s,
    sy = a.s;
  return [cos * sx, sin * sx, -sin * sy, cos * sy, x + a.x, y + a.y];
}

type Slotted = 'eyes' | 'brows' | 'mouth' | 'cheek';
function slotMatrix(s: CreatorState, target: Slotted, side: Side): Mat | null {
  const a = s.adj[target][side];
  if (!a) return null;
  const slot = SLOT[target];
  return placeMatrix(side === 'R' ? FACE_UNITS - slot.x : slot.x, slot.y, a, side === 'R');
}

/** 한 짝을 그리는 행렬(얼굴 판 좌표) — 눈 폴더 안 층은 폴더 행렬 위에 층 조정을 얹는다(폴더가 오른쪽에서 이미 뒤집혀 있어 층은 뒤집지 않는다) */
export function layerMatrix(s: CreatorState, target: AdjTarget, side: Side): Mat | null {
  if (!isEyePart(target)) return slotMatrix(s, target, side);
  const g = slotMatrix(s, 'eyes', side);
  const a = s.adj[target][side];
  return g && a ? mul(g, placeMatrix(0, 0, a, false)) : null;
}

/** 한 짝의 가운데 */
export function centerOf(s: CreatorState, target: AdjTarget, side: Side): Pt | null {
  const m = layerMatrix(s, target, side);
  return m ? apply(m, { x: 0, y: 0 }) : null;
}

/** 끈 거리(얼굴 판) → 그 대상의 x · y 가 움직일 거리 — 폴더 안 층은 폴더의 회전 · 크기 · 뒤집기를 거꾸로 푼다 */
export function deltaFor(s: CreatorState, target: AdjTarget, side: Side, d: Pt): Pt {
  if (!isEyePart(target)) return d;
  const g = slotMatrix(s, 'eyes', side);
  return g ? applyLinear(invert(g), d) : d;
}

/** 액세서리를 그리는 행렬 */
export const accMatrix = (acc: Acc): Mat => placeMatrix(ACC_SLOT.x, ACC_SLOT.y, acc.a, false);
export const accCenter = (acc: Acc): Pt => ({ x: ACC_SLOT.x + acc.a.x, y: ACC_SLOT.y + acc.a.y });
