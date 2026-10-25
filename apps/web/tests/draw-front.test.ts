import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, reduce, type CreatorState } from '@/features/character-maker';
import { drawFront, FACE_BOX, type DrawCtx } from '@/features/character-maker/lib/draw-front';
import { MOLE, useTestAccs } from './fixtures/test-accs';

/** 그리기를 글로 적는 가짜 컨텍스트 — 칠할 때 그때의 색도 적는다 */
function fake() {
  const log: string[] = [];
  const ctx = {
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    translate: (x: number, y: number) => log.push(`t ${x} ${y}`),
    scale: (x: number, y: number) => log.push(`s ${x} ${y}`),
    transform: (...m: number[]) => log.push(`m ${m.map((v) => +v.toFixed(3)).join(' ')}`),
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
  for (const k of ['pupil', 'highlight', 'eyeline', 'brows', 'cheek'] as const)
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
    const log = draw(only(DEFAULT_STATE, ['pupil']));
    expect(log).toContain('m 1 0 0 1 66 112');
    expect(log).toContain('m -1 0 0 1 134 112');
  });

  it('폴더 안 층은 폴더 위에 얹힌다 — 폴더를 옮기면 층이 같이 · 층만 옮기면 그 층만', () => {
    let s = only(DEFAULT_STATE, ['pupil', 'highlight']);
    s = reduce(s, { t: 'move', target: 'eyes', side: 'L', x: 10, y: 0 });
    let log = draw(s);
    expect(log.filter((l) => l === 'm 1 0 0 1 76 112').length).toBe(2); // 동공 · 하이라이트 모두 폴더를 따라 76
    expect(log).toContain('m -1 0 0 1 124 112');
    s = reduce(s, { t: 'move', target: 'highlight', side: 'L', x: 4, y: 0 });
    log = draw(s);
    expect(log.filter((l) => l === 'm 1 0 0 1 76 112').length).toBe(1); // 동공은 그대로
    // 하이라이트만 +4 — 오른쪽은 뒤집힌 폴더 안이라 바깥으로
    expect(log).toContain('m 1 0 0 1 80 112');
    expect(log).toContain('m -1 0 0 1 120 112');
  });

  it('동공 → 하이라이트 → 아이라인 차례로 쌓는다 — 하이라이트는 동공 위(동공 밖으로 옮겨도 그대로 그린다)', () => {
    let s = reduce(DEFAULT_STATE, { t: 'move', target: 'highlight', side: 'L', x: 30, y: 0 });
    s = only(s, ['pupil', 'highlight', 'eyeline']);
    const log = draw(s);
    const pupil = log.indexOf(`fill ${s.pupilColor.L}`);
    const shine = log.indexOf('fill #fff');
    const line = log.findIndex((l, i) => i > shine && l.startsWith('stroke path('));
    expect(pupil).toBeGreaterThanOrEqual(0);
    expect(shine).toBeGreaterThan(pupil);
    expect(line).toBeGreaterThan(shine);
    expect(log).toContain('m 1 0 0 1 96 112'); // 동공 밖(66 + 30)에도 그린다
  });

  it('감은눈은 동공 · 하이라이트를 그리지 않고 아이라인의 감은 모양만 — 아이라인 «없음» 도 감은 줄은 보인다', () => {
    const open = draw(DEFAULT_STATE).join('\n');
    const closed = draw(DEFAULT_STATE, 'closed').join('\n');
    expect(open).toContain('e 0 0 8 9.5'); // 동공
    expect(open).toContain('fill #fff'); // 하이라이트
    expect(closed).not.toContain('e 0 0 8 9.5');
    expect(closed).not.toContain('fill #fff');
    expect(open).not.toContain('path(M-11 -1q11 9 22 0)'); // 뜬눈엔 감은 줄을 겹쳐 그리지 않는다
    expect(closed).toContain('path(M-11 -1q11 9 22 0)');
    const noLine = draw(reduce(DEFAULT_STATE, { t: 'item', kind: 'eyeline', id: 'none' }), 'closed').join(
      '\n',
    );
    expect(noLine).toContain('path(M-11 -1q11 9 22 0)');
  });

  it('아이라인 «없음» 의 감은 줄은 폴더 자리에 — 안 보이는 아이라인 층을 옮겨 둬도 따라가지 않는다', () => {
    let s = reduce(DEFAULT_STATE, { t: 'item', kind: 'eyeline', id: 'none' });
    s = reduce(s, { t: 'move', target: 'eyeline', side: 'L', x: -40, y: 0 });
    let log = draw(s, 'closed');
    expect(log).toContain('m 1 0 0 1 66 112');
    expect(log).toContain('m -1 0 0 1 134 112'); // 오른쪽은 뒤집힌 폴더 자리
    expect(log).not.toContain('m 1 0 0 1 26 112');
    // 보이는 아이라인이면 감은 줄도 그 층 자리로
    log = draw(reduce(s, { t: 'item', kind: 'eyeline', id: 'thin' }), 'closed');
    expect(log).toContain('m 1 0 0 1 26 112');
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

  describe('액세서리', () => {
    useTestAccs();
    it('입 위(맨 나중)에 · 각자 자리로', () => {
      let s = reduce(DEFAULT_STATE, { t: 'accAdd', id: MOLE });
      s = reduce(s, { t: 'accMove', uid: 1, x: 20, y: -10 });
      const { ctx, log } = fake();
      drawFront(ctx, s, 'open', 200, { makePath, images: () => ({}) as CanvasImageSource });
      const mole = log.indexOf('m 1 0 0 1 120 110'); // 자리 = ACC_SLOT(100,120) + (20,−10)
      expect(mole).toBeGreaterThan(log.indexOf('m 1 0 0 1 100 142')); // 입 다음
      expect(log.slice(mole)).toContain('img');
    });
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
