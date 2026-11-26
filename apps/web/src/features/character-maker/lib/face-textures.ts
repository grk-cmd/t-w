import { rasterFront } from '@tw/char-core';
import type { CharKit } from '@/entities/character';
import type { CreatorState } from '../model/state';
import { drawFront, type Expr, type PartImages } from './draw-front';

/** 앞모습 판 크기 — 얼굴 텍스처(512)와 같게 둬야 옮겨 그릴 때 흐려지지 않는다 */
const PANEL = 512;

const canvas2d = (size: number, readBack = false) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: readBack });
  if (!ctx) throw new Error('2D 캔버스를 못 만들었다');
  return { c, ctx };
};

/** 얼굴 텍스처 한 벌 — face · blink 는 앱 def 와 같은 «피부 없는 그림 층»(512 · 투명), display 는 미리보기용(피부 + 지금 표정). */
export function createFaceTextures(kit: CharKit) {
  const size = kit.face.CANVAS_SZ;
  const panel = canvas2d(PANEL, true);
  const layers: Record<Expr, ReturnType<typeof canvas2d>> = { open: canvas2d(size), closed: canvas2d(size) };
  const display = canvas2d(size);

  function paint(s: CreatorState, expr: Expr, image: CanvasImageSource | null, images: PartImages) {
    drawFront(panel.ctx, s, expr, PANEL, { image, images });
    const l = layers[expr];
    const out = l.ctx.createImageData(size, size);
    rasterFront(out, kit.frontMap, panel.ctx.getImageData(0, 0, PANEL, PANEL));
    l.ctx.putImageData(out, 0, 0);
  }

  return {
    face: layers.open.c,
    blink: layers.closed.c,
    display: display.c,
    /** 상태 → 두 그림 층을 다시 그리고, 미리보기는 show 표정으로 */
    render(s: CreatorState, show: Expr, image: CanvasImageSource | null, images: PartImages) {
      paint(s, 'open', image, images);
      paint(s, 'closed', image, images);
      display.ctx.clearRect(0, 0, size, size);
      display.ctx.drawImage(kit.face.skinCanvasFor(s.skin) as unknown as CanvasImageSource, 0, 0);
      display.ctx.drawImage(layers[show].c, 0, 0);
    },
  };
}
