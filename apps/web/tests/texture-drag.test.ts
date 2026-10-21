import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, dragTargetOf, reduce } from '@/features/character-maker';
import { ACC_SLOT, FACE_UNITS, LIMITS, SLOT } from '@/features/character-maker/model/catalog';
import { dragAccTo, dragTo, pickAcc, pickSide, sideCenter } from '@/features/character-maker/model/drag';
import { apply, invert, layerMatrix, mul, placeMatrix } from '@/features/character-maker/model/geometry';

const S = DEFAULT_STATE;
const one = { x: 0, y: 0, s: 1, r: 0 };

describe('행렬', () => {
  it('뒤집기 · 곱 · 역행렬', () => {
    const m = placeMatrix(10, 20, { x: 5, y: -3, s: 2, r: 30 }, true);
    const p = { x: 3, y: 4 };
    const back = apply(invert(m), apply(m, p));
    expect(back.x).toBeCloseTo(3, 9);
    expect(back.y).toBeCloseTo(4, 9);
    const i = mul(m, invert(m));
    [1, 0, 0, 1, 0, 0].forEach((v, k) => expect(i[k]).toBeCloseTo(v, 9));
  });
});

describe('텍스처 끌기 — 어느 짝을 잡았나', () => {
  it('짝 레이어는 가까운 쪽 · 하나짜리(입)는 늘 C', () => {
    expect(pickSide(S, 'eyes', { x: SLOT.eyes.x, y: SLOT.eyes.y })).toBe('L');
    expect(pickSide(S, 'eyes', { x: FACE_UNITS - SLOT.eyes.x + 3, y: SLOT.eyes.y })).toBe('R');
    expect(pickSide(S, 'mouth', { x: 0, y: 0 })).toBe('C');
  });

  it('폴더 안 층의 가운데는 폴더를 따라간다(오른쪽은 뒤집힌 폴더 안)', () => {
    let s = reduce(S, { t: 'move', target: 'eyes', side: 'L', x: 10, y: 5 });
    s = reduce(s, { t: 'move', target: 'pupil', side: 'L', x: 4, y: 0 });
    expect(sideCenter(s, 'pupil', 'L')).toEqual({ x: SLOT.eyes.x + 14, y: SLOT.eyes.y + 5 });
    expect(sideCenter(s, 'pupil', 'R')).toEqual({ x: FACE_UNITS - SLOT.eyes.x - 14, y: SLOT.eyes.y + 5 });
  });
});

describe('텍스처 끌기 — 끈 만큼', () => {
  it('폴더 · 레이어는 끈 만큼 더한다(반올림 · −0 없음)', () => {
    const r = dragTo(S, 'eyes', 'L', { ...one, x: 5, y: -3 }, { x: 10, y: 10 }, { x: 20.4, y: 4.6 }, false);
    expect(r).toEqual({ x: 15, y: -8, lock: null });
    expect(Object.is(dragTo(S, 'brows', 'L', one, { x: 0, y: 0 }, { x: -0.3, y: 0 }, false).x, 0)).toBe(true);
  });

  it('Shift 면 화면에서 많이 움직인 쪽 하나로만', () => {
    expect(dragTo(S, 'eyes', 'L', one, { x: 0, y: 0 }, { x: 10, y: 3 }, true)).toEqual({
      x: 10,
      y: 0,
      lock: 'x',
    });
    expect(dragTo(S, 'eyes', 'L', one, { x: 0, y: 0 }, { x: 2, y: -9 }, true)).toEqual({
      x: 0,
      y: -9,
      lock: 'y',
    });
  });

  it('폴더 안 층은 폴더의 회전 · 크기 · 뒤집기를 풀어 더한다 — 끈 대로 화면에서 움직인다', () => {
    let s = reduce(S, { t: 'sym', on: false });
    s = reduce(s, { t: 'adjust', target: 'eyes', side: 'R', key: 'r', value: 30 });
    s = reduce(s, { t: 'adjust', target: 'eyes', side: 'R', key: 's', value: 2 });
    const before = sideCenter(s, 'pupil', 'R')!;
    const to = dragTo(s, 'pupil', 'R', s.adj.pupil.R!, { x: 0, y: 0 }, { x: 12, y: -6 }, false);
    const after = sideCenter(
      reduce(s, { t: 'move', target: 'pupil', side: 'R', x: to.x, y: to.y }),
      'pupil',
      'R',
    )!;
    // 층 값은 정수로 반올림 — 2배 폴더 안에서는 화면에서 최대 √2 쯤 어긋난다
    expect(Math.hypot(after.x - before.x - 12, after.y - before.y + 6)).toBeLessThan(1.5);
  });
});

describe('액세서리 끌기', () => {
  it('가장 가까운 것을 잡는다 · 없으면 null', () => {
    expect(pickAcc(S, { x: 0, y: 0 })).toBeNull();
    let s = reduce(reduce(S, { t: 'accAdd', id: 'mole' }), { t: 'accAdd', id: 'star' });
    s = reduce(s, { t: 'accMove', uid: 2, x: 40, y: 0 });
    expect(pickAcc(s, { x: ACC_SLOT.x + 35, y: ACC_SLOT.y })).toBe(2);
    expect(pickAcc(s, { x: ACC_SLOT.x, y: ACC_SLOT.y })).toBe(1);
  });
  it('얼굴 판 그대로 더한다', () => {
    expect(dragAccTo(one, { x: 0, y: 0 }, { x: 7.4, y: -2.6 }, false)).toEqual({ x: 7, y: -3, lock: null });
  });
});

describe('고른 것 → 끌 대상', () => {
  it('눈 탭은 고른 마디 · 눈썹 · 입 · 볼은 그 레이어 · 액세서리는 가까운 것 · 나머지 null', () => {
    expect(dragTargetOf({ tab: 'eyes', eyeNode: 'eyes', acc: null })).toEqual({ t: 'adj', target: 'eyes' });
    expect(dragTargetOf({ tab: 'eyes', eyeNode: 'pupil', acc: null })).toEqual({ t: 'adj', target: 'pupil' });
    expect(dragTargetOf({ tab: 'cheek', eyeNode: 'eyes', acc: null })).toEqual({ t: 'adj', target: 'cheek' });
    expect(dragTargetOf({ tab: 'acc', eyeNode: 'eyes', acc: 3 })).toEqual({ t: 'acc-any' });
    for (const tab of ['skin', 'image', 'cloth'] as const)
      expect(dragTargetOf({ tab, eyeNode: 'eyes', acc: null })).toBeNull();
  });
});

describe('move 동작', () => {
  it('x · y 를 한 번에 · 범위로 자른다 · 대칭이면 폴더는 거울', () => {
    const a = reduce(S, { t: 'move', target: 'eyes', side: 'L', x: 999, y: -999 });
    expect(a.adj.eyes.L).toEqual({ ...one, x: LIMITS.x[1], y: LIMITS.y[0] });
    expect(a.adj.eyes.R).toEqual({ ...one, x: -LIMITS.x[1], y: LIMITS.y[0] });
  });
  it('같은 자리 · NaN · 없는 짝은 같은 상태(기록이 안 쌓인다)', () => {
    expect(reduce(S, { t: 'move', target: 'eyes', side: 'L', x: 0, y: 0 })).toBe(S);
    expect(reduce(S, { t: 'move', target: 'eyes', side: 'L', x: NaN, y: 1 })).toBe(S);
    expect(reduce(S, { t: 'move', target: 'mouth', side: 'L', x: 3, y: 3 })).toBe(S);
  });
  it('그리기 행렬과 가운데가 같은 규칙', () => {
    const s = reduce(S, { t: 'move', target: 'brows', side: 'L', x: 3, y: 2 });
    expect(apply(layerMatrix(s, 'brows', 'R')!, { x: 0, y: 0 })).toEqual(sideCenter(s, 'brows', 'R'));
  });
});

describe('슬라이더 범위', () => {
  it('좌우 · 위아래 ±80 · 크기 0.3 ~ 2.5 · 회전 ±45', () => {
    expect(LIMITS).toEqual({ x: [-80, 80], y: [-80, 80], s: [0.3, 2.5], r: [-45, 45] });
  });
});
