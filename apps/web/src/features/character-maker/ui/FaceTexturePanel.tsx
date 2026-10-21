import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useI18n } from '@/shared/i18n';
import { FACE_UNITS, type LayerKind } from '../model/catalog';
import { dragTo, pickSide, sideCenter, type Lock, type Pt } from '../model/drag';
import type { Adjust, CreatorState, Side } from '../model/state';
import { drawFace, type Expr } from '../lib/draw-front';
import type { MakerActions } from './MakerPanel';

/** 칸 한 변(화면 픽셀) — 두 장이 옆 칸(300)에 나란히 들어간다 */
const VIEW = 146;
const GUIDE = '#C2185B';

interface Drag {
  side: Side;
  from: Pt;
  start: Adjust;
  lock: Lock;
}

function FaceCanvas({
  s,
  expr,
  kind,
  ops,
  skinColor,
  image,
  label,
}: {
  s: CreatorState;
  expr: Expr;
  kind: LayerKind | null;
  ops: MakerActions;
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
    if (drag?.lock && kind) {
      const p = sideCenter(s, kind, drag.side);
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
  }, [s, expr, image, skinColor, drag, kind]);

  const toUnits = (e: PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * FACE_UNITS,
      y: ((e.clientY - r.top) / r.height) * FACE_UNITS,
    };
  };

  return (
    <figure className="tex-face">
      <canvas
        ref={ref}
        width={VIEW}
        height={VIEW}
        className={kind ? 'can-drag' : undefined}
        aria-label={label}
        role="img"
        onPointerDown={(e) => {
          if (!kind || e.button !== 0) return;
          const from = toUnits(e);
          const side = pickSide(s, kind, from);
          const start = s.adj[kind][side];
          if (!start) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
          setDrag({ side, from, start, lock: null });
        }}
        onPointerMove={(e) => {
          if (!drag || !kind) return;
          const to = dragTo(drag.start, drag.from, toUnits(e), e.shiftKey);
          if (to.lock !== drag.lock) setDrag({ ...drag, lock: to.lock });
          ops.live({ t: 'move', kind, side: drag.side, x: to.x, y: to.y });
        }}
        onPointerUp={() => {
          if (!drag) return;
          setDrag(null);
          ops.commit();
        }}
        onPointerCancel={() => {
          if (!drag) return;
          setDrag(null);
          ops.commit();
        }}
      />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** 평면 얼굴 텍스처 두 장(기본 · 감은눈) — 고른 탭의 레이어를 끌어 옮긴다(Shift: 가로 · 세로만). 손을 떼면 되돌리기 한 칸. */
export function FaceTexturePanel({
  s,
  kind,
  ops,
  skinColor,
  image,
}: {
  s: CreatorState;
  /** 끌어 옮길 레이어 — 눈 · 눈썹 · 입 · 볼 탭일 때만, 그 밖이면 null(보기만) */
  kind: LayerKind | null;
  ops: MakerActions;
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
            kind={kind}
            ops={ops}
            skinColor={skinColor}
            image={image}
            label={e === 'open' ? c.exprOpen : c.exprClosed}
          />
        ))}
      </div>
      <p className="hint">{kind ? c.texHint : c.texIdle}</p>
    </div>
  );
}
