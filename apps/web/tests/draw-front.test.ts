import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, reduce, type CreatorState } from '@/features/character-maker';
import { drawFront, FACE_BOX, type DrawCtx } from '@/features/character-maker/lib/draw-front';

/** 그리기를 글로 적는 가짜 컨텍스트 — 칠할 때 그때의 색도 적는다 */
function fake() {
  const log: string[] = [];
  const ctx = {
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    translate: (x: number, y: number) => log.push(`t ${x} ${y}`),
    scale: (x: number, y: number) => log.push(`s ${x} ${y}`),
    transform: (...m: number[]) => log.push(`m ${m.map((v) => +v.toFixed(3)).join(' ')}`),
    clip: (p?: unknown) => log.push(`clip${p ? ' ' + String(p) : ''}`),
    beginPath: () => {},
    ellipse: (x: number, y: number, rx: number, ry: number) => log.push(`e ${x} ${y} ${rx} ${ry}`),
    fill(p?: unknown) {
      log.push(`fill ${this.fillStyle}${p ? ' ' + String(p) : ''}`);
    },
    stroke: (p?: unknown) => log.push(`stroke${p ? ' ' + String(p) : ''}`),
    drawImage: () => log.push('img'),
    clearRect: () => log.push('clear'),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
  };
  return { ctx: ctx as unknown as DrawCtx, log };
}
const makePath = (d: string) => `path(${d})` as unknown as Path2D;
const draw = (s: CreatorState, expr: 'open' | 'closed' = 'open') => {
  const { ctx, log } = fake();
  drawFront(ctx, s, expr, 200, { makePath });
  return log;
};
const only = (s: CreatorState, keep: string[]) => {
  let x = s;
  for (const k of ['sclera', 'pupil', 'eyeline', 'brows', 'cheek'] as const)
    if (!keep.includes(k)) x = reduce(x, { t: 'item', kind: k, id: 'none' });
  return x;
};

describe('drawFront', () => {
  it('판을 비우고 얼굴 판(200)으로 옮겨 그린다 · save/restore 짝', () => {
    const { ctx, log } = fake();
    drawFront(ctx, DEFAULT_STATE, 'open', 512, { makePath });
    expect(log[0]).toBe('clear');
    expect(log).toContain(`t ${FACE_BOX.x * 512} ${FACE_BOX.y * 512}`);
    expect(log.filter((l) => l === 'save').length).toBe(log.filter((l) => l === 'restore').length);
  });

  it('눈 폴더는 왼쪽 66,112 · 오른쪽은 좌우를 뒤집어 134,112', () => {
    const log = draw(only(DEFAULT_STATE, ['sclera']));
    expect(log).toContain('m 1 0 0 1 66 112');
    expect(log).toContain('m -1 0 0 1 134 112');
  });

  it('폴더 안 층은 폴더 위에 얹힌다 — 폴더를 옮기면 층이 같이 · 층만 옮기면 그 층만', () => {
    let s = only(DEFAULT_STATE, ['sclera', 'pupil']);
    s = reduce(s, { t: 'move', target: 'eyes', side: 'L', x: 10, y: 0 });
    let log = draw(s);
    expect(log).toContain('m 1 0 0 1 76 112'); // 흰자 · 동공 모두 폴더를 따라 76
    expect(log).toContain('m -1 0 0 1 124 112');
    s = reduce(s, { t: 'move', target: 'pupil', side: 'L', x: 4, y: 0 });
    log = draw(s);
    expect(log).toContain('m 1 0 0 1 76 112'); // 흰자는 그대로
    expect(log).toContain('m 1 0 0 1 4 0'); // 동공은 흰자 위에서 +4(흰자로 자른 뒤 상대 이동)
    // 흰자가 없으면 동공 자리가 그대로 보인다 — 왼 +4, 오른쪽은 뒤집힌 폴더 안이라 바깥으로
    log = draw(reduce(s, { t: 'item', kind: 'sclera', id: 'none' }));
    expect(log).toContain('m 1 0 0 1 80 112');
    expect(log).toContain('m -1 0 0 1 120 112');
  });

  it('동공은 흰자 모양으로 잘라 그린다 — 흰자가 없으면 자르지 않는다', () => {
    expect(draw(only(DEFAULT_STATE, ['sclera', 'pupil'])).some((l) => l === 'clip')).toBe(true);
    expect(draw(only(DEFAULT_STATE, ['pupil'])).some((l) => l.startsWith('clip'))).toBe(false);
    expect(
      draw(reduce(only(DEFAULT_STATE, ['sclera', 'pupil']), { t: 'item', kind: 'sclera', id: 'sleepy' })),
    ).toContain('clip path(M-12 -4h24v4a12 10 0 0 1-24 0z)');
  });

  it('감은눈은 흰자 · 동공을 그리지 않고 아이라인의 감은 모양만 — 아이라인 «없음» 도 감은 줄은 보인다', () => {
    const open = draw(DEFAULT_STATE).join('\n');
    const closed = draw(DEFAULT_STATE, 'closed').join('\n');
    expect(open).toContain('e 0 0 11 13'); // 흰자
    expect(closed).not.toContain('e 0 0 11 13');
    expect(closed).not.toContain('clip');
    expect(closed).toContain('path(M-11 -1q11 9 22 0)');
    const noLine = draw(reduce(DEFAULT_STATE, { t: 'item', kind: 'eyeline', id: 'none' }), 'closed').join(
      '\n',
    );
    expect(noLine).toContain('path(M-11 -1q11 9 22 0)');
  });

  it('오드아이 — 왼 동공과 오른 동공을 다른 색으로', () => {
    let s = only(DEFAULT_STATE, ['pupil']);
    s = reduce(reduce(s, { t: 'oddEye', on: true }), { t: 'pupilColor', side: 'R', color: '#C2593A' });
    const fills = draw(s).filter((l) => l.startsWith('fill #'));
    expect(fills).toContain(`fill ${s.pupilColor.L}`);
    expect(fills).toContain('fill #C2593A');
    expect(fills.indexOf(`fill ${s.pupilColor.L}`)).toBeLessThan(fills.indexOf('fill #C2593A')); // 왼쪽 먼저
  });

  it('없음을 고른 레이어는 그리지 않는다', () => {
    expect(draw(reduce(DEFAULT_STATE, { t: 'item', kind: 'brows', id: 'none' }))).not.toContain(
      'm 1 0 0 1 66 88',
    );
    expect(draw(DEFAULT_STATE)).toContain('m 1 0 0 1 66 88');
  });

  it('액세서리는 입 위(맨 나중)에 · 각자 자리로', () => {
    let s = reduce(DEFAULT_STATE, { t: 'accAdd', id: 'mole' });
    s = reduce(s, { t: 'accMove', uid: 1, x: 20, y: -10 });
    const log = draw(s); // 자리 = ACC_SLOT(100,120) + (20,−10)
    const mole = log.indexOf('m 1 0 0 1 120 110');
    expect(mole).toBeGreaterThan(log.indexOf('m 1 0 0 1 100 142')); // 입 다음
    expect(log.slice(mole).find((l) => l.startsWith('e '))).toBe('e 0 0 2.6 2.6');
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
