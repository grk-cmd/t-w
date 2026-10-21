import { FACE_UNITS, PAIRED, SLOT, type LayerKind } from './catalog';
import type { Adjust, CreatorState, Side } from './state';

/** 얼굴 판(200) 좌표 */
export interface Pt {
  x: number;
  y: number;
}

/** 한 짝의 지금 가운데 */
export function sideCenter(s: CreatorState, kind: LayerKind, side: Side): Pt | null {
  const a = s.adj[kind][side];
  if (!a) return null;
  const slot = SLOT[kind];
  const base = side === 'R' ? FACE_UNITS - slot.x : slot.x;
  return { x: base + a.x, y: slot.y + a.y };
}

/** 누른 곳에서 가까운 짝 — 하나짜리(입)는 늘 C */
export function pickSide(s: CreatorState, kind: LayerKind, p: Pt): Side {
  if (!PAIRED[kind]) return 'C';
  const d = (side: Side) => {
    const c = sideCenter(s, kind, side);
    return c ? Math.hypot(c.x - p.x, c.y - p.y) : Infinity;
  };
  return d('R') < d('L') ? 'R' : 'L';
}

export type Lock = 'x' | 'y' | null;

/** 끈 만큼 옮긴 자리 — straight 면 많이 움직인 쪽(가로 · 세로) 하나로만. 범위 자르기는 상태(reduce)가 한다. */
export function dragTo(
  start: Adjust,
  from: Pt,
  to: Pt,
  straight: boolean,
): { x: number; y: number; lock: Lock } {
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  let lock: Lock = null;
  if (straight) {
    lock = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    if (lock === 'x') dy = 0;
    else dx = 0;
  }
  // + 0: 반올림이 −0 을 내도 0 으로(거울 계산과 같은 규칙)
  return { x: Math.round(start.x + dx) + 0, y: Math.round(start.y + dy) + 0, lock };
}
