import { describe, expect, it } from 'vitest';
import { fakeCanvas } from './fake-canvas';

describe('가짜 캔버스', () => {
  it('그리기 호출과 속성 쓰기를 순서대로 기록한다', () => {
    const c = fakeCanvas(8, 4);
    const ctx = c.getContext('2d') as { fillStyle: string; fillRect(...a: number[]): void };
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 8, 4);
    expect([c.width, c.height]).toEqual([8, 4]);
    expect(c.calls).toEqual([
      { op: 'set:fillStyle', args: ['#fff'] },
      { op: 'fillRect', args: [0, 0, 8, 4] },
    ]);
  });
});
