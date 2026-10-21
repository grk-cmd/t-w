import { PAIRED, type AdjTarget } from './catalog';
import { accCenter, centerOf, deltaFor, type Pt } from './geometry';
import type { Adjust, CreatorState, Side } from './state';

export type { Pt } from './geometry';

/** 한 짝의 지금 가운데 */
export const sideCenter = (s: CreatorState, target: AdjTarget, side: Side): Pt | null =>
  centerOf(s, target, side);

/** 누른 곳에서 가까운 짝 — 하나짜리(입)는 늘 C */
export function pickSide(s: CreatorState, target: AdjTarget, p: Pt): Side {
  if (!PAIRED[target]) return 'C';
  const d = (side: Side) => {
    const c = centerOf(s, target, side);
    return c ? Math.hypot(c.x - p.x, c.y - p.y) : Infinity;
  };
  return d('R') < d('L') ? 'R' : 'L';
}

/** 누른 곳에서 가장 가까운 액세서리 — 없으면 null */
export function pickAcc(s: CreatorState, p: Pt): number | null {
  let best: number | null = null,
    bestD = Infinity;
  for (const a of s.acc) {
    const c = accCenter(a);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = a.uid;
    }
  }
  return best;
}

export type Lock = 'x' | 'y' | null;

/** 끈 거리 — straight 면 많이 움직인 쪽(화면의 가로 · 세로) 하나로만 */
export function dragDelta(from: Pt, to: Pt, straight: boolean): { d: Pt; lock: Lock } {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let lock: Lock = null;
  if (straight) {
    lock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    if (lock === 'x') dy = 0;
    else dx = 0;
  }
  return { d: { x: dx, y: dy }, lock };
}

/** 끈 만큼 옮긴 자리 — 폴더 안 층은 폴더 기준으로 바꿔 더한다. 범위 자르기는 상태(reduce)가 한다. */
export function dragTo(
  s: CreatorState,
  target: AdjTarget,
  side: Side,
  start: Adjust,
  from: Pt,
  to: Pt,
  straight: boolean,
): { x: number; y: number; lock: Lock } {
  const { d, lock } = dragDelta(from, to, straight);
  const local = deltaFor(s, target, side, d);
  // + 0: 반올림이 −0 을 내도 0 으로(거울 계산과 같은 규칙)
  return { x: Math.round(start.x + local.x) + 0, y: Math.round(start.y + local.y) + 0, lock };
}

/** 액세서리는 얼굴 판 그대로 더한다 */
export function dragAccTo(
  start: Adjust,
  from: Pt,
  to: Pt,
  straight: boolean,
): { x: number; y: number; lock: Lock } {
  const { d, lock } = dragDelta(from, to, straight);
  return { x: Math.round(start.x + d.x) + 0, y: Math.round(start.y + d.y) + 0, lock };
}
