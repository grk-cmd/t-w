import {
  DRAW_ORDER,
  FACE_UNITS,
  PAIRED,
  findAcc,
  findItem,
  type LayerKind,
  type Shape,
} from '../model/catalog';
import { accMatrix, layerMatrix, type Mat } from '../model/geometry';
import type { CreatorState, Side } from '../model/state';

/** 그리기에 쓰는 2D 컨텍스트 몫(시험은 가짜로) */
export interface DrawCtx {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
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

/** 서버 그림 파츠 주소 → 불러온 그림(아직이면 null — 다 불러오면 부르는 쪽이 다시 그린다) */
export type PartImages = (src: string) => CanvasImageSource | null;
const NO_IMAGES: PartImages = () => null;

/** 도형을 그리는 데 쓰는 것 — 길(Path2D) 만들기 · 그림 찾기 */
interface Pen {
  makePath: (d: string) => Path2D;
  images: PartImages;
}
export interface DrawOptions {
  /** 사용자가 붙인 그림 */
  image?: CanvasImageSource | null;
  makePath?: (d: string) => Path2D;
  images?: PartImages;
}
const penOf = (o: DrawOptions): Pen => ({
  makePath: o.makePath ?? ((d: string) => new Path2D(d)),
  images: o.images ?? NO_IMAGES,
});

function drawShape(ctx: DrawCtx, sh: Shape, pen: Pen) {
  if (sh.k === 'img') {
    const im = pen.images(sh.src);
    if (im) ctx.drawImage(im, -sh.w / 2, -sh.h / 2, sh.w, sh.h);
    return;
  }
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
    const p = pen.makePath(sh.d);
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

function drawAt(ctx: DrawCtx, m: Mat, shapes: Shape[], pen: Pen) {
  ctx.save();
  ctx.transform(...m);
  for (const sh of shapes) drawShape(ctx, sh, pen);
  ctx.restore();
}

/** 눈 한 짝 — 동공 · 하이라이트 · 아이라인을 차례로 쌓는다. 감은눈이면 아이라인의 감은 모양 — 동공 · 하이라이트는 감은 그림이 있을 때만. */
function drawEye(ctx: DrawCtx, s: CreatorState, side: Side, expr: Expr, color: string, pen: Pen) {
  const put = (k: LayerKind, shapes: Shape[]) => {
    const m = layerMatrix(s, k, side);
    if (m && shapes.length) drawAt(ctx, m, shapes, pen);
  };
  if (expr === 'open') {
    put('pupil', findItem('pupil', s.pupil).open(color));
    put('highlight', findItem('highlight', s.highlight).open(color));
    put('eyeline', findItem('eyeline', s.eyeline).open(color));
    return;
  }
  for (const k of ['pupil', 'highlight'] as const) {
    const shut = findItem(k, s[k]).closed;
    if (shut) put(k, shut);
  }
  const line = findItem('eyeline', s.eyeline);
  const closed = line.closed ?? line.open(color);
  // 아이라인 «없음» 은 뜬눈에서 안 보여 그 층 자리를 볼 수 없다 — 감은 줄은 폴더 자리에 둔다
  const m = layerMatrix(s, s.eyeline === 'none' ? 'eyes' : 'eyeline', side);
  if (m && closed.length) drawAt(ctx, m, closed, pen);
}

/** 얼굴 판(200 단위 좌표)에 레이어를 쌓는다 — 3D 텍스처(앞모습 판)와 평면 텍스처 칸이 같은 그림을 쓴다. 지우기 · 배경은 부르는 쪽 몫. */
export function drawFace(ctx: DrawCtx, s: CreatorState, expr: Expr, opts: DrawOptions = {}) {
  const pen = penOf(opts);
  const img = s.img && opts.image && (s.img.on === 'both' || s.img.on === expr) ? opts.image : null;
  if (img && s.img?.pos === 'under') ctx.drawImage(img, 0, 0, FACE_UNITS, FACE_UNITS);
  for (const kind of DRAW_ORDER) {
    const sides: Side[] = PAIRED[kind] ? ['L', 'R'] : ['C'];
    for (const side of sides) {
      if (kind === 'eyes') {
        drawEye(ctx, s, side, expr, side === 'R' ? s.pupilColor.R : s.pupilColor.L, pen);
        continue;
      }
      const it = findItem(kind, s[kind]);
      const shapes = expr === 'closed' && it.closed ? it.closed : it.open(s.pupilColor.L);
      const mx = layerMatrix(s, kind, side);
      if (mx && shapes.length) drawAt(ctx, mx, shapes, pen);
    }
  }
  for (const a of s.acc) {
    const item = findAcc(a.id);
    if (item) drawAt(ctx, accMatrix(a), (expr === 'closed' && item.closed) || item.shapes, pen);
  }
  if (img && s.img?.pos === 'top') ctx.drawImage(img, 0, 0, FACE_UNITS, FACE_UNITS);
}

/** 앞모습 판(한 변 size 픽셀)에 얼굴 레이어를 쌓아 그린다 — 판은 투명에서 시작(피부는 텍스처 합성 때 아래에 깔린다). */
export function drawFront(ctx: DrawCtx, s: CreatorState, expr: Expr, size: number, opts: DrawOptions = {}) {
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
  opts: Omit<DrawOptions, 'image'> = {},
) {
  const pen = penOf(opts);
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 44, size / 44);
  for (const sh of shapes) drawShape(ctx, sh, pen);
  ctx.restore();
}
