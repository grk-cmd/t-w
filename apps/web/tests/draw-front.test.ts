import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, reduce } from '@/features/character-maker';
import { drawFront, FACE_BOX, type DrawCtx } from '@/features/character-maker/lib/draw-front';

/** 그리기를 글로 적는 가짜 컨텍스트 */
function fake() {
  const log: string[] = [];
  const ctx = {
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    translate: (x: number, y: number) => log.push(`t ${x} ${y}`),
    rotate: (a: number) => log.push(`r ${a.toFixed(3)}`),
    scale: (x: number, y: number) => log.push(`s ${x} ${y}`),
    beginPath: () => {},
    ellipse: (x: number, y: number, rx: number, ry: number) => log.push(`e ${x} ${y} ${rx} ${ry}`),
    fill: (p?: unknown) => log.push(`fill${p ? ' ' + String(p) : ''}`),
    stroke: (p?: unknown) => log.push(`stroke${p ? ' ' + String(p) : ''}`),
    drawImage: () => log.push('img'),
    clearRect: () => log.push('clear'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
  } as unknown as DrawCtx;
  return { ctx, log };
}
const makePath = (d: string) => `path(${d})` as unknown as Path2D;

describe('drawFront', () => {
  it('판을 비우고 얼굴 판(200)으로 옮겨 그린다 · save/restore 짝', () => {
    const { ctx, log } = fake();
    drawFront(ctx, DEFAULT_STATE, 'open', 512, { makePath });
    expect(log[0]).toBe('clear');
    expect(log).toContain(`t ${FACE_BOX.x * 512} ${FACE_BOX.y * 512}`);
    expect(log.filter((l) => l === 'save').length).toBe(log.filter((l) => l === 'restore').length);
  });

  it('짝 레이어는 오른쪽을 좌우로 뒤집어 200 − x 에 놓는다', () => {
    const { ctx, log } = fake();
    const s = reduce(reduce(DEFAULT_STATE, { t: 'item', kind: 'eyes', id: 'dot' }), {
      t: 'item',
      kind: 'cheek',
      id: 'none',
    });
    drawFront(ctx, s, 'open', 200, { makePath });
    expect(log).toContain('t 66 112'); // 왼눈
    expect(log).toContain('t 134 112'); // 오른눈
    expect(log).toContain('s -1 1'); // 오른쪽은 뒤집힘
  });

  it('감은눈은 눈 그림만 바뀐다 — 감은 모양이 없는 눈은 뜬 모양 그대로', () => {
    const run = (eyes: string, expr: 'open' | 'closed') => {
      const { ctx, log } = fake();
      drawFront(ctx, reduce(DEFAULT_STATE, { t: 'item', kind: 'eyes', id: eyes }), expr, 200, { makePath });
      return log.join('\n');
    };
    expect(run('dot', 'closed')).toContain('path(M-8 0h16)');
    expect(run('dot', 'open')).not.toContain('path(M-8 0h16)');
    expect(run('smile', 'closed')).toBe(run('smile', 'open'));
  });

  it('없음을 고른 레이어는 그리지 않는다', () => {
    const { ctx, log } = fake();
    const s = reduce(DEFAULT_STATE, { t: 'item', kind: 'brows', id: 'none' });
    drawFront(ctx, s, 'open', 200, { makePath });
    expect(log.join('\n')).not.toContain('t 66 88');
  });

  it('내 그림은 고른 얼굴에만 · 아래 / 맨 위 자리', () => {
    const img = {} as CanvasImageSource;
    const withImg = (on: 'both' | 'open' | 'closed', pos: 'under' | 'top') =>
      reduce(DEFAULT_STATE, { t: 'image', img: { dataUrl: 'data:', pos, on } });
    const count = (on: 'both' | 'open' | 'closed', expr: 'open' | 'closed') => {
      const { ctx, log } = fake();
      drawFront(ctx, withImg(on, 'top'), expr, 200, { makePath, image: img });
      return log.filter((l) => l === 'img').length;
    };
    expect(count('both', 'closed')).toBe(1);
    expect(count('open', 'closed')).toBe(0);
    expect(count('closed', 'closed')).toBe(1);
    const order = (pos: 'under' | 'top') => {
      const { ctx, log } = fake();
      drawFront(ctx, withImg('both', pos), 'open', 200, { makePath, image: img });
      return log.indexOf('img') < log.findIndex((l) => l.startsWith('e '));
    };
    expect(order('under')).toBe(true);
    expect(order('top')).toBe(false);
  });
});
