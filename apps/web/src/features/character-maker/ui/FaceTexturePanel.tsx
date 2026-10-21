import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useI18n } from '@/shared/i18n';
import { FACE_UNITS, type AdjTarget } from '../model/catalog';
import { dragAccTo, dragTo, pickAcc, pickSide, type Lock, type Pt } from '../model/drag';
import { accCenter, centerOf } from '../model/geometry';
import type { Adjust, CreatorState, Side } from '../model/state';
import type { DragTarget } from '../model/tabs';
import { drawFace, type Expr } from '../lib/draw-front';
import type { MakerActions } from './MakerPanel';

/** 칸 한 변(화면 픽셀) — 두 장이 옆 칸(300)에 나란히 들어간다 */
const VIEW = 146;
const GUIDE = '#C2185B';

/** 누를 때 잡은 것 — 끄는 중에 탭 · 고른 것이 바뀌어도 잡은 것을 옮긴다 */
type Grab = { t: 'adj'; target: AdjTarget; side: Side } | { t: 'acc'; uid: number };

interface Drag {
  grab: Grab;
  from: Pt;
  start: Adjust;
  lock: Lock;
}

export type PanelTarget = DragTarget | null;

function grabCenter(s: CreatorState, g: Grab): Pt | null {
  if (g.t === 'adj') return centerOf(s, g.target, g.side);
  const a = s.acc.find((x) => x.uid === g.uid);
  return a ? accCenter(a) : null;
}

function FaceCanvas({
  s,
  expr,
  target,
  ops,
  onGrabAcc,
  skinColor,
  image,
  label,
}: {
  s: CreatorState;
  expr: Expr;
  target: PanelTarget;
  ops: MakerActions;
  onGrabAcc: (uid: number) => void;
  skinColor: string;
  image: CanvasImageSource | null;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = Math.round(VIEW * dpr);
    if (c.width !== px) c.width = c.height = px;
    ctx.setTransform(px / FACE_UNITS, 0, 0, px / FACE_UNITS, 0, 0);
    ctx.clearRect(0, 0, FACE_UNITS, FACE_UNITS);
    ctx.fillStyle = skinColor;
    ctx.fillRect(0, 0, FACE_UNITS, FACE_UNITS);
    drawFace(ctx, s, expr, { image });
    // Shift 로 곧게 끌 때 — 움직이는 줄을 보여 준다
    if (drag?.lock) {
      const p = grabCenter(s, drag.grab);
      if (p) {
        ctx.strokeStyle = GUIDE;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        if (drag.lock === 'x') {
          ctx.moveTo(0, p.y);
          ctx.lineTo(FACE_UNITS, p.y);
        } else {
          ctx.moveTo(p.x, 0);
          ctx.lineTo(p.x, FACE_UNITS);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [s, expr, image, skinColor, drag]);

  const toUnits = (e: PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * FACE_UNITS,
      y: ((e.clientY - r.top) / r.height) * FACE_UNITS,
    };
  };

  /** 누른 곳 → 잡을 것과 그 시작 자리 */
  function grabAt(p: Pt): { grab: Grab; start: Adjust } | null {
    if (!target) return null;
    if (target.t === 'adj') {
      const side = pickSide(s, target.target, p);
      const start = s.adj[target.target][side];
      return start ? { grab: { t: 'adj', target: target.target, side }, start } : null;
    }
    const uid = pickAcc(s, p);
    const a = s.acc.find((x) => x.uid === uid);
    return a ? { grab: { t: 'acc', uid: a.uid }, start: a.a } : null;
  }

  const canDrag = !!target && (target.t === 'adj' || s.acc.length > 0);
  const end = () => {
    if (!drag) return;
    setDrag(null);
    ops.commit();
  };

  return (
    <figure className="tex-face">
      <canvas
        ref={ref}
        width={VIEW}
        height={VIEW}
        className={canDrag ? 'can-drag' : undefined}
        aria-label={label}
        role="img"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const from = toUnits(e);
          const g = grabAt(from);
          if (!g) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
          if (g.grab.t === 'acc') onGrabAcc(g.grab.uid);
          setDrag({ grab: g.grab, from, start: g.start, lock: null });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const g = drag.grab;
          const to =
            g.t === 'adj'
              ? dragTo(s, g.target, g.side, drag.start, drag.from, toUnits(e), e.shiftKey)
              : dragAccTo(drag.start, drag.from, toUnits(e), e.shiftKey);
          if (to.lock !== drag.lock) setDrag({ ...drag, lock: to.lock });
          if (g.t === 'adj') ops.live({ t: 'move', target: g.target, side: g.side, x: to.x, y: to.y });
          else ops.live({ t: 'accMove', uid: g.uid, x: to.x, y: to.y });
        }}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** 평면 얼굴 텍스처 두 장(기본 · 감은눈) — 고른 것(눈 폴더 · 층 · 레이어 · 액세서리)을 끌어 옮긴다(Shift: 가로 · 세로만). 손을 떼면 되돌리기 한 칸. */
export function FaceTexturePanel({
  s,
  target,
  ops,
  onGrabAcc,
  skinColor,
  image,
}: {
  s: CreatorState;
  /** 끌 대상 — 피부 · 내 그림 · 옷 탭이면 null(보기만) */
  target: PanelTarget;
  ops: MakerActions;
  /** 액세서리를 잡으면 그것을 고른 것으로 */
  onGrabAcc: (uid: number) => void;
  skinColor: string;
  image: CanvasImageSource | null;
}) {
  const { m } = useI18n();
  const c = m.creator;
  return (
    <div className="tex-panel">
      <p className="group-l">{c.texLabel}</p>
      <div className="tex-pair">
        {(['open', 'closed'] as const).map((e) => (
          <FaceCanvas
            key={e}
            s={s}
            expr={e}
            target={target}
            ops={ops}
            onGrabAcc={onGrabAcc}
            skinColor={skinColor}
            image={image}
            label={e === 'open' ? c.exprOpen : c.exprClosed}
          />
        ))}
      </div>
      <p className="hint">{target ? c.texHint : c.texIdle}</p>
    </div>
  );
}
