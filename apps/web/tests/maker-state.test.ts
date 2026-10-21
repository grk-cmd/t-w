import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, histReduce, randomState, reduce, type Hist } from '@/features/character-maker';

const S = DEFAULT_STATE;

describe('reduce — 생성기 상태', () => {
  it('아는 그림만 고른다(모르는 id 는 그대로)', () => {
    expect(reduce(S, { t: 'item', kind: 'eyes', id: 'dot' }).eyes).toBe('dot');
    expect(reduce(S, { t: 'item', kind: 'eyes', id: 'nope' })).toBe(S);
    expect(reduce(S, { t: 'item', kind: 'mouth', id: 'arc' })).toBe(S); // 눈썹 그림을 입에 — 안 받는다
  });

  it('색은 #rrggbb 만 · 옷 색은 소문자로', () => {
    expect(reduce(S, { t: 'cloth', part: 'top', color: '#FFAA00' }).top).toBe('#ffaa00');
    for (const bad of ['red', '#fff', '#12345g', '', 'url(x)']) {
      expect(reduce(S, { t: 'cloth', part: 'bot', color: bad })).toBe(S);
      expect(reduce(S, { t: 'eyeColor', color: bad })).toBe(S);
    }
  });

  it('피부는 0~4 정수만', () => {
    expect(reduce(S, { t: 'skin', skin: 4 }).skin).toBe(4);
    expect(reduce(S, { t: 'skin', skin: 0 }).skin).toBe(0);
    for (const bad of [-1, 5, 1.5, NaN]) expect(reduce(S, { t: 'skin', skin: bad })).toBe(S);
  });

  it('조정은 범위로 자르고, 대칭이면 반대 짝이 거울로 따라간다', () => {
    const a = reduce(S, { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: 999 });
    expect(a.adj.eyes.L?.x).toBe(80);
    expect(a.adj.eyes.R?.x).toBe(-80);
    const r = reduce(a, { t: 'adjust', kind: 'eyes', side: 'L', key: 'r', value: 20 });
    expect(r.adj.eyes.R?.r).toBe(-20);
    expect(reduce(S, { t: 'adjust', kind: 'eyes', side: 'L', key: 's', value: 0 }).adj.eyes.L?.s).toBe(0.3);
    expect(reduce(S, { t: 'adjust', kind: 'eyes', side: 'L', key: 'y', value: NaN })).toBe(S);
  });

  it('대칭을 끄면 한쪽만 바뀐다 · 하나짜리(입)는 C 만', () => {
    const off = reduce(S, { t: 'sym', on: false });
    const a = reduce(off, { t: 'adjust', kind: 'eyes', side: 'R', key: 'y', value: 10 });
    expect(a.adj.eyes.R?.y).toBe(10);
    expect(a.adj.eyes.L?.y).toBe(0);
    expect(reduce(S, { t: 'adjust', kind: 'mouth', side: 'L', key: 'x', value: 5 })).toBe(S);
    expect(reduce(S, { t: 'adjust', kind: 'mouth', side: 'C', key: 'x', value: 5 }).adj.mouth.C?.x).toBe(5);
  });

  it('조정 초기화는 그 레이어만', () => {
    const a = reduce(reduce(S, { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: 9 }), {
      t: 'adjust',
      kind: 'brows',
      side: 'L',
      key: 'x',
      value: 9,
    });
    const b = reduce(a, { t: 'resetAdjust', kind: 'eyes' });
    expect(b.adj.eyes.L?.x).toBe(0);
    expect(b.adj.brows.L?.x).toBe(9);
  });

  it('대칭을 끄고 오른쪽을 고친 뒤 다시 켜면 오른쪽이 왼쪽의 거울로 맞춰진다', () => {
    let s = reduce(S, { t: 'sym', on: false });
    s = reduce(s, { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: 5 });
    s = reduce(s, { t: 'adjust', kind: 'eyes', side: 'R', key: 'x', value: -30 });
    s = reduce(s, { t: 'sym', on: true });
    expect(s.adj.eyes.R).toEqual({ ...s.adj.eyes.L, x: -5, r: 0 - (s.adj.eyes.L?.r ?? 0) });
    // 그 뒤 왼쪽을 고치면 오른쪽이 튀지 않고 거울로 따라간다
    s = reduce(s, { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: 6 });
    expect(s.adj.eyes.R?.x).toBe(-6);
  });

  it('같은 값이면 상태를 새로 만들지 않는다(되돌리기 기록이 안 쌓인다)', () => {
    expect(reduce(S, { t: 'skin', skin: S.skin })).toBe(S);
    expect(reduce(S, { t: 'item', kind: 'eyes', id: S.eyes })).toBe(S);
    expect(reduce(S, { t: 'cloth', part: 'top', color: S.top.toUpperCase() })).toBe(S);
    expect(reduce(S, { t: 'eyeColor', color: S.eyeColor })).toBe(S);
    expect(reduce(S, { t: 'sym', on: S.sym })).toBe(S);
    expect(reduce(S, { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: 0 })).toBe(S);
  });

  it('무작위는 그림 · 색만 바꾸고 자리 · 옷 색은 둔다', () => {
    const moved = reduce(S, { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: 7 });
    const r = randomState(moved, () => 0.999);
    expect(r.adj).toBe(moved.adj);
    expect(r.top).toBe(moved.top);
    expect(r.skin).toBe(4);
  });
});

describe('histReduce — 되돌리기', () => {
  const init: Hist = { cur: S, past: [], liveFrom: null };
  it('바뀐 것만 쌓고 되돌린다', () => {
    const h1 = histReduce(init, { t: 'do', a: { t: 'skin', skin: 3 } });
    expect(h1.past.length).toBe(1);
    const same = histReduce(h1, { t: 'do', a: { t: 'skin', skin: 99 } }); // 안 받는 값 — 쌓지 않는다
    expect(same).toBe(h1);
    const back = histReduce(h1, { t: 'undo' });
    expect(back.cur).toBe(S);
    expect(histReduce(back, { t: 'undo' })).toBe(back); // 더 없으면 그대로
  });

  it('최근 40번까지만 기억한다', () => {
    let h = init;
    for (let i = 0; i < 60; i++) h = histReduce(h, { t: 'do', a: { t: 'skin', skin: i % 2 ? 0 : 4 } });
    expect(h.past.length).toBe(40);
  });

  it('끄는 동안(live)은 기록이 안 쌓이고, 놓을 때(commit) 한 칸 — 되돌리기 한 번에 끌기 전으로', () => {
    let h = histReduce(init, { t: 'do', a: { t: 'skin', skin: 3 } });
    for (let v = 1; v <= 10; v++)
      h = histReduce(h, { t: 'live', a: { t: 'adjust', kind: 'eyes', side: 'L', key: 'x', value: v } });
    expect(h.past.length).toBe(1);
    expect(h.cur.adj.eyes.L?.x).toBe(10);
    h = histReduce(h, { t: 'commit' });
    expect(h.past.length).toBe(2);
    h = histReduce(h, { t: 'undo' });
    expect(h.cur.adj.eyes.L?.x).toBe(0);
    expect(h.cur.skin).toBe(3); // 그 전 기록은 남아 있다
  });

  it('끄다가 놓지 않고 다른 걸 해도 끈 것은 한 칸으로 남는다 · 바뀐 게 없으면 안 쌓인다', () => {
    let h = histReduce(init, { t: 'live', a: { t: 'adjust', kind: 'eyes', side: 'L', key: 'y', value: 7 } });
    h = histReduce(h, { t: 'do', a: { t: 'skin', skin: 4 } });
    expect(h.past.length).toBe(2);
    expect(histReduce(init, { t: 'commit' })).toEqual(init);
    const back = histReduce(
      histReduce(init, { t: 'live', a: { t: 'adjust', kind: 'eyes', side: 'L', key: 'y', value: 7 } }),
      { t: 'undo' },
    );
    expect(back.cur).toBe(S); // 놓기 전에 되돌려도 끌기 전으로
  });

  it('처음부터 · 무작위도 되돌릴 수 있다', () => {
    const r = histReduce(init, { t: 'random', rnd: () => 0 });
    expect(histReduce(r, { t: 'undo' }).cur).toBe(S);
  });
});
