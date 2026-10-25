import type { PartImages } from './draw-front';

/** 그림 하나를 불러오는 것 — 브라우저에선 new Image(), 시험에선 가짜 */
export interface ImgLike {
  crossOrigin: string | null;
  src: string;
  onload: ((ev: Event) => unknown) | null;
  onerror: OnErrorEventHandler;
  naturalWidth: number;
  naturalHeight: number;
}

/** 칠한 그림을 만들 판 — 브라우저에선 canvas, 시험에선 가짜 */
export interface TintCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): {
    drawImage(img: CanvasImageSource, x: number, y: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillStyle: string | CanvasGradient | CanvasPattern;
    globalCompositeOperation: GlobalCompositeOperation;
  } | null;
}

/** 칠한 그림 기억 개수 — 색 고르개를 끌면 색이 계속 바뀌어 오래된 것부터 버린다 */
const TINT_KEEP = 32;

/** 그림에 색을 곱해 칠한다 — 흰 부분은 그 색 · 검은 부분은 검게 · 투명은 그대로(모양은 그림의 알파) */
export function tintImage(
  img: CanvasImageSource,
  w: number,
  h: number,
  color: string,
  c: TintCanvas,
): TintCanvas | null {
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  c.width = w;
  c.height = h;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  // 곱하기는 투명한 곳도 칠한다 — 그림의 알파로 다시 오린다
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0);
  return c;
}

/** 서버 그림 파츠 불러오기 — 주소마다 한 번만 부르고, 다 불러오면 onLoad 로 알려 다시 그리게 한다. 못 불러온 그림은 그리지 않는다. */
export function createPartImages(
  onLoad: () => void,
  make: () => ImgLike = () => new Image(),
  makeCanvas: () => TintCanvas = () => document.createElement('canvas'),
): PartImages {
  const cache = new Map<string, { img: ImgLike; ready: boolean }>();
  const tinted = new Map<string, CanvasImageSource | null>();
  const paint = (src: string, color: string, base: ImgLike): CanvasImageSource | null => {
    const key = `${color}|${src}`;
    if (tinted.has(key)) return tinted.get(key) ?? null;
    const im = base as unknown as CanvasImageSource;
    const out = tintImage(
      im,
      base.naturalWidth,
      base.naturalHeight,
      color,
      makeCanvas(),
    ) as CanvasImageSource | null;
    const old = tinted.keys().next();
    if (tinted.size >= TINT_KEEP && !old.done) tinted.delete(old.value);
    tinted.set(key, out);
    return out;
  };
  return (src, tint) => {
    const hit = cache.get(src);
    if (hit) {
      if (!hit.ready) return null;
      return tint ? paint(src, tint, hit.img) : (hit.img as unknown as CanvasImageSource);
    }
    const img = make();
    const entry = { img, ready: false };
    cache.set(src, entry);
    // CORS 로 받아야 캔버스가 막히지 않는다(앱으로 가져가기 = 캔버스를 글로 꺼냄) — 서버가 허락하지 않으면 못 불러온 것으로 본다
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      entry.ready = true;
      onLoad();
    };
    img.onerror = () => {};
    img.src = src;
    return null;
  };
}
