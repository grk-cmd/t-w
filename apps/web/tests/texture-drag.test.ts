import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, layerOfTab, reduce } from '@/features/character-maker';
import { FACE_UNITS, LIMITS, SLOT } from '@/features/character-maker/model/catalog';
import { dragTo, pickSide, sideCenter } from '@/features/character-maker/model/drag';

const S = DEFAULT_STATE;
const one = { x: 0, y: 0, s: 1, r: 0 };

describe('텍스처 끌기 — 어느 짝을 잡았나', () => {
  it('짝 레이어는 가까운 쪽 · 하나짜리(입)는 늘 C', () => {
    expect(pickSide(S, 'eyes', { x: SLOT.eyes.x, y: SLOT.eyes.y })).toBe('L');
    expect(pickSide(S, 'eyes', { x: FACE_UNITS - SLOT.eyes.x + 3, y: SLOT.eyes.y })).toBe('R');
    expect(pickSide(S, 'mouth', { x: 0, y: 0 })).toBe('C');
  });

  it('옮긴 자리를 따라간다 — 오른쪽 짝은 거울 자리(200 − 왼쪽) + 조정', () => {
    const off = reduce(reduce(S, { t: 'sym', on: false }), {
      t: 'move',
      kind: 'eyes',
      side: 'R',
      x: -60,
      y: 0,
    });
    expect(sideCenter(off, 'eyes', 'R')).toEqual({ x: FACE_UNITS - SLOT.eyes.x - 60, y: SLOT.eyes.y });
    // 오른쪽 눈을 왼쪽 눈 가까이 옮겼으면 그 자리를 누르면 오른쪽이 잡힌다
    expect(pickSide(off, 'eyes', { x: FACE_UNITS - SLOT.eyes.x - 60, y: SLOT.eyes.y })).toBe('R');
  });
});

describe('텍스처 끌기 — 끈 만큼', () => {
  it('끈 만큼 더한다(반올림)', () => {
    expect(dragTo({ ...one, x: 5, y: -3 }, { x: 10, y: 10 }, { x: 20.4, y: 4.6 }, false)).toEqual({
      x: 15,
      y: -8,
      lock: null,
    });
  });
  it('반올림이 −0 을 내지 않는다', () => {
    expect(Object.is(dragTo(one, { x: 0, y: 0 }, { x: -0.3, y: -0.2 }, false).x, 0)).toBe(true);
  });
  it('Shift 면 많이 움직인 쪽 하나로만', () => {
    expect(dragTo(one, { x: 0, y: 0 }, { x: 10, y: 3 }, true)).toEqual({ x: 10, y: 0, lock: 'x' });
    expect(dragTo(one, { x: 0, y: 0 }, { x: 2, y: -9 }, true)).toEqual({ x: 0, y: -9, lock: 'y' });
  });
});

describe('move 동작', () => {
  it('x · y 를 한 번에 · 범위로 자른다 · 대칭이면 반대 짝은 거울', () => {
    const a = reduce(S, { t: 'move', kind: 'eyes', side: 'L', x: 999, y: -999 });
    expect(a.adj.eyes.L).toEqual({ ...one, x: LIMITS.x[1], y: LIMITS.y[0] });
    expect(a.adj.eyes.R).toEqual({ ...one, x: -LIMITS.x[1], y: LIMITS.y[0] });
  });
  it('오른쪽 짝을 끌어도 왼쪽이 거울로 따라간다', () => {
    const a = reduce(S, { t: 'move', kind: 'brows', side: 'R', x: 7, y: 4 });
    expect(a.adj.brows.L).toEqual({ ...one, x: -7, y: 4 });
  });
  it('같은 자리 · NaN · 없는 짝은 같은 상태(기록이 안 쌓인다)', () => {
    expect(reduce(S, { t: 'move', kind: 'eyes', side: 'L', x: 0, y: 0 })).toBe(S);
    expect(reduce(S, { t: 'move', kind: 'eyes', side: 'L', x: NaN, y: 1 })).toBe(S);
    expect(reduce(S, { t: 'move', kind: 'mouth', side: 'L', x: 3, y: 3 })).toBe(S);
  });
});

describe('탭 → 끌 레이어', () => {
  it('얼굴 레이어 탭만 레이어 · 나머지는 null', () => {
    expect(layerOfTab('eyes')).toBe('eyes');
    expect(layerOfTab('cheek')).toBe('cheek');
    expect(layerOfTab('skin')).toBeNull();
    expect(layerOfTab('image')).toBeNull();
    expect(layerOfTab('cloth')).toBeNull();
  });
});

describe('슬라이더 범위', () => {
  it('좌우 · 위아래 ±80 · 크기 0.3 ~ 2.5 · 회전 ±45', () => {
    expect(LIMITS).toEqual({ x: [-80, 80], y: [-80, 80], s: [0.3, 2.5], r: [-45, 45] });
  });
});
