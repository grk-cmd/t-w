import { paintFront } from '@tw/char-core';
import type { CharKit } from '@/entities/character';
import type { CreatorState } from '../model/state';
import { drawFront, type Expr } from './draw-front';

/** 앞모습 판 크기 — 얼굴 텍스처(512)와 같게 둬야 옮겨 그릴 때 흐려지지 않는다 */
const PANEL = 512;

const canvas2d = (size: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D 캔버스를 못 만들었다');
  return { c, ctx };
};

/** 얼굴 텍스처 한 벌 — face · blink 는 앱 def 와 같은 «피부 없는 그림 층»(512 · 투명), display 는 미리보기용(피부 + 지금 표정). */
export function createFaceTextures(kit: CharKit) {
  const size = kit.face.CANVAS_SZ;
  const panel = canvas2d(PANEL);
  const layers: Record<Expr, ReturnType<typeof canvas2d>> = { open: canvas2d(size), closed: canvas2d(size) };
  const display = canvas2d(size);

  function paint(s: CreatorState, expr: Expr, image: CanvasImageSource | null) {
    drawFront(panel.ctx, s, expr, PANEL, { image });
    const l = layers[expr];
    l.ctx.clearRect(0, 0, size, size);
    paintFront(l.ctx, kit.frontMap, panel.c, PANEL, size);
  }

  return {
    face: layers.open.c,
    blink: layers.closed.c,
    display: display.c,
    /** 상태 → 두 그림 층을 다시 그리고, 미리보기는 show 표정으로 */
    render(s: CreatorState, show: Expr, image: CanvasImageSource | null) {
      paint(s, 'open', image);
      paint(s, 'closed', image);
      display.ctx.clearRect(0, 0, size, size);
      display.ctx.drawImage(kit.face.skinCanvasFor(s.skin) as unknown as CanvasImageSource, 0, 0);
      display.ctx.drawImage(layers[show].c, 0, 0);
    },
  };
}
