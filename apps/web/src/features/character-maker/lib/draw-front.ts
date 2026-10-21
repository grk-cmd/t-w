import { FACE_UNITS, LAYER_ORDER, PAIRED, SLOT, findItem, type Shape } from '../model/catalog';
import type { Adjust, CreatorState } from '../model/state';

/** 그리기에 쓰는 2D 컨텍스트 몫(시험은 가짜로) */
export interface DrawCtx {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(a: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  fill(path?: Path2D): void;
  stroke(path?: Path2D): void;
  drawImage(img: CanvasImageSource, x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
}

/** 200 얼굴 판이 앞모습 판(0~1) 어디에 놓이는가 — 실제 머리에 비춰 보고 맞춘 값(눈 · 입이 얼굴 앞에 오도록) */
export const FACE_BOX = { x: 0.14, y: 0.2, size: 0.72 } as const;

export type Expr = 'open' | 'closed';

function drawShape(ctx: DrawCtx, sh: Shape, makePath: (d: string) => Path2D) {
  ctx.save();
  if (sh.k === 'ellipse') {
    ctx.globalAlpha = sh.alpha ?? 1;
    ctx.beginPath();
    ctx.ellipse(sh.cx ?? 0, sh.cy ?? 0, sh.rx, sh.ry, 0, 0, Math.PI * 2);
    if (sh.fill) {
      ctx.fillStyle = sh.fill;
      ctx.fill();
    }
    if (sh.stroke) {
      ctx.strokeStyle = sh.stroke;
      ctx.lineWidth = sh.w ?? 1;
      ctx.stroke();
    }
  } else {
    const p = makePath(sh.d);
    if (sh.fill) {
      ctx.fillStyle = sh.fill;
      ctx.fill(p);
    }
    if (sh.stroke) {
      ctx.strokeStyle = sh.stroke;
      ctx.lineWidth = sh.w ?? 1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

function placed(
  ctx: DrawCtx,
  x: number,
  y: number,
  a: Adjust,
  flip: boolean,
  shapes: Shape[],
  makePath: (d: string) => Path2D,
) {
  ctx.save();
  ctx.translate(x + a.x, y + a.y);
  ctx.rotate((a.r * Math.PI) / 180);
  ctx.scale(flip ? -a.s : a.s, a.s);
  for (const sh of shapes) drawShape(ctx, sh, makePath);
  ctx.restore();
}

/** 얼굴 판(200 단위 좌표)에 레이어를 쌓는다 — 3D 텍스처(앞모습 판)와 평면 텍스처 칸이 같은 그림을 쓴다. 지우기 · 배경은 부르는 쪽 몫. */
export function drawFace(
  ctx: DrawCtx,
  s: CreatorState,
  expr: Expr,
  opts: { image?: CanvasImageSource | null; makePath?: (d: string) => Path2D } = {},
) {
  const makePath = opts.makePath ?? ((d: string) => new Path2D(d));
  const img = s.img && opts.image && (s.img.on === 'both' || s.img.on === expr) ? opts.image : null;
  if (img && s.img?.pos === 'under') ctx.drawImage(img, 0, 0, FACE_UNITS, FACE_UNITS);
  for (const kind of LAYER_ORDER) {
    const item = findItem(kind, s[kind]);
    const shapes =
      kind === 'eyes' && expr === 'closed' ? (item.closed ?? item.open(s.eyeColor)) : item.open(s.eyeColor);
    if (!shapes.length) continue;
    const at = SLOT[kind];
    const adj = s.adj[kind];
    if (PAIRED[kind]) {
      if (adj.L) placed(ctx, at.x, at.y, adj.L, false, shapes, makePath);
      if (adj.R) placed(ctx, FACE_UNITS - at.x, at.y, adj.R, true, shapes, makePath);
    } else if (adj.C) placed(ctx, at.x, at.y, adj.C, false, shapes, makePath);
  }
  if (img && s.img?.pos === 'top') ctx.drawImage(img, 0, 0, FACE_UNITS, FACE_UNITS);
}

/** 앞모습 판(한 변 size 픽셀)에 얼굴 레이어를 쌓아 그린다 — 판은 투명에서 시작(피부는 텍스처 합성 때 아래에 깔린다). */
export function drawFront(
  ctx: DrawCtx,
  s: CreatorState,
  expr: Expr,
  size: number,
  opts: { image?: CanvasImageSource | null; makePath?: (d: string) => Path2D } = {},
) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  // 200 얼굴 판 좌표로
  ctx.translate(FACE_BOX.x * size, FACE_BOX.y * size);
  ctx.scale((FACE_BOX.size * size) / FACE_UNITS, (FACE_BOX.size * size) / FACE_UNITS);
  drawFace(ctx, s, expr, opts);
  ctx.restore();
}

/** 고르기 단추 그림 — 그림 하나를 size 칸 가운데에 맞춰 그린다(그림 좌표 ±20 이 칸에 차도록) */
export function drawItemThumb(
  ctx: DrawCtx,
  shapes: Shape[],
  size: number,
  makePath: (d: string) => Path2D = (d) => new Path2D(d),
) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 44, size / 44);
  for (const sh of shapes) drawShape(ctx, sh, makePath);
  ctx.restore();
}
