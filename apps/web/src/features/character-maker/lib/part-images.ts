import type { PartImages } from './draw-front';

/** 그림 하나를 불러오는 것 — 브라우저에선 new Image(), 시험에선 가짜 */
export interface ImgLike {
  crossOrigin: string | null;
  src: string;
  onload: ((ev: Event) => unknown) | null;
  onerror: OnErrorEventHandler;
}

/** 서버 그림 파츠 불러오기 — 주소마다 한 번만 부르고, 다 불러오면 onLoad 로 알려 다시 그리게 한다. 못 불러온 그림은 그리지 않는다. */
export function createPartImages(onLoad: () => void, make: () => ImgLike = () => new Image()): PartImages {
  const cache = new Map<string, { img: ImgLike; ready: boolean }>();
  return (src) => {
    const hit = cache.get(src);
    if (hit) return hit.ready ? (hit.img as unknown as CanvasImageSource) : null;
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
