import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, histReduce, randomState, reduce, type Hist } from '@/features/character-maker';

const S = DEFAULT_STATE;

describe('reduce — 생성기 상태', () => {
  it('아는 그림만 고른다(모르는 id 는 그대로)', () => {
    expect(reduce(S, { t: 'item', kind: 'pupil', id: 'dot' }).pupil).toBe('dot');
    expect(reduce(S, { t: 'item', kind: 'pupil', id: 'nope' })).toBe(S);
    expect(reduce(S, { t: 'item', kind: 'mouth', id: 'arc' })).toBe(S); // 눈썹 그림을 입에 — 안 받는다
  });

  it('색은 #rrggbb 만 · 옷 색은 소문자로', () => {
    expect(reduce(S, { t: 'cloth', part: 'top', color: '#FFAA00' }).top).toBe('#ffaa00');
    for (const bad of ['red', '#fff', '#12345g', '', 'url(x)']) {
      expect(reduce(S, { t: 'cloth', part: 'bot', color: bad })).toBe(S);
      expect(reduce(S, { t: 'pupilColor', side: 'L', color: bad })).toBe(S);
    }
  });

  it('피부는 0~4 정수만', () => {
    expect(reduce(S, { t: 'skin', skin: 4 }).skin).toBe(4);
    expect(reduce(S, { t: 'skin', skin: 0 }).skin).toBe(0);
    for (const bad of [-1, 5, 1.5, NaN]) expect(reduce(S, { t: 'skin', skin: bad })).toBe(S);
  });

  it('조정은 범위로 자르고, 대칭이면 반대 짝이 거울로 따라간다', () => {
    const a = reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 999 });
    expect(a.adj.eyes.L?.x).toBe(80);
    expect(a.adj.eyes.R?.x).toBe(-80);
    const r = reduce(a, { t: 'adjust', target: 'eyes', side: 'L', key: 'r', value: 20 });
    expect(r.adj.eyes.R?.r).toBe(-20);
    expect(reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 's', value: 0 }).adj.eyes.L?.s).toBe(0.3);
    expect(reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 'y', value: NaN })).toBe(S);
  });

  it('대칭을 끄면 한쪽만 바뀐다 · 하나짜리(입)는 C 만', () => {
    const off = reduce(S, { t: 'sym', on: false });
    const a = reduce(off, { t: 'adjust', target: 'eyes', side: 'R', key: 'y', value: 10 });
    expect(a.adj.eyes.R?.y).toBe(10);
    expect(a.adj.eyes.L?.y).toBe(0);
    expect(reduce(S, { t: 'adjust', target: 'mouth', side: 'L', key: 'x', value: 5 })).toBe(S);
    expect(reduce(S, { t: 'adjust', target: 'mouth', side: 'C', key: 'x', value: 5 }).adj.mouth.C?.x).toBe(5);
  });

  it('조정 초기화는 그 레이어만', () => {
    const a = reduce(reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 9 }), {
      t: 'adjust',
      target: 'brows',
      side: 'L',
      key: 'x',
      value: 9,
    });
    const b = reduce(a, { t: 'resetAdjust', target: 'eyes' });
    expect(b.adj.eyes.L?.x).toBe(0);
    expect(b.adj.brows.L?.x).toBe(9);
  });

  it('대칭을 끄고 오른쪽을 고친 뒤 다시 켜면 오른쪽이 왼쪽의 거울로 맞춰진다', () => {
    let s = reduce(S, { t: 'sym', on: false });
    s = reduce(s, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 5 });
    s = reduce(s, { t: 'adjust', target: 'eyes', side: 'R', key: 'x', value: -30 });
    s = reduce(s, { t: 'sym', on: true });
    expect(s.adj.eyes.R).toEqual({ ...s.adj.eyes.L, x: -5, r: 0 - (s.adj.eyes.L?.r ?? 0) });
    // 그 뒤 왼쪽을 고치면 오른쪽이 튀지 않고 거울로 따라간다
    s = reduce(s, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 6 });
    expect(s.adj.eyes.R?.x).toBe(-6);
  });

  it('같은 값이면 상태를 새로 만들지 않는다(되돌리기 기록이 안 쌓인다)', () => {
    expect(reduce(S, { t: 'skin', skin: S.skin })).toBe(S);
    expect(reduce(S, { t: 'item', kind: 'pupil', id: S.pupil })).toBe(S);
    expect(reduce(S, { t: 'cloth', part: 'top', color: S.top.toUpperCase() })).toBe(S);
    expect(reduce(S, { t: 'pupilColor', side: 'R', color: S.pupilColor.L })).toBe(S);
    expect(reduce(S, { t: 'oddEye', on: false })).toBe(S);
    expect(reduce(S, { t: 'sym', on: S.sym })).toBe(S);
    expect(reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 0 })).toBe(S);
  });

  it('무작위는 그림 · 색만 바꾸고 자리 · 옷 색은 둔다', () => {
    const moved = reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 7 });
    const r = randomState(moved, () => 0.999);
    expect(r.adj).toBe(moved.adj);
    expect(r.top).toBe(moved.top);
    expect(r.skin).toBe(4);
  });
});

describe('reduce — 눈 폴더 · 오드아이 · 액세서리', () => {
  it('눈 폴더 안 층은 대칭이면 오른쪽이 같은 값(폴더가 이미 뒤집어 그린다) · 폴더와 다른 레이어는 거울', () => {
    const a = reduce(S, { t: 'adjust', target: 'pupil', side: 'L', key: 'x', value: 4 });
    expect(a.adj.pupil.R).toEqual(a.adj.pupil.L);
    const r = reduce(S, { t: 'adjust', target: 'eyeline', side: 'R', key: 'r', value: 12 });
    expect(r.adj.eyeline.L?.r).toBe(12);
    expect(reduce(S, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 4 }).adj.eyes.R?.x).toBe(-4);
  });

  it('대칭을 다시 켜면 층은 같은 값 · 폴더는 거울로 맞춘다', () => {
    let s = reduce(S, { t: 'sym', on: false });
    s = reduce(s, { t: 'adjust', target: 'pupil', side: 'L', key: 'y', value: 3 });
    s = reduce(s, { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: 5 });
    s = reduce(s, { t: 'sym', on: true });
    expect(s.adj.pupil.R).toEqual(s.adj.pupil.L);
    expect(s.adj.eyes.R?.x).toBe(-5);
  });

  it('동공 색 — 오드아이가 아니면 양쪽 · 켜면 한쪽만 · 끄면 오른쪽을 왼쪽 색으로', () => {
    const both = reduce(S, { t: 'pupilColor', side: 'R', color: '#2E5E9C' });
    expect(both.pupilColor).toEqual({ L: '#2E5E9C', R: '#2E5E9C' });
    const odd = reduce(reduce(both, { t: 'oddEye', on: true }), {
      t: 'pupilColor',
      side: 'R',
      color: '#C2593A',
    });
    expect(odd.pupilColor).toEqual({ L: '#2E5E9C', R: '#C2593A' });
    expect(reduce(odd, { t: 'oddEye', on: false }).pupilColor).toEqual({ L: '#2E5E9C', R: '#2E5E9C' });
  });

  it('액세서리 — 아는 것만 · 최대 5개 · 번호는 지워도 겹치지 않는다', () => {
    let s = reduce(S, { t: 'accAdd', id: 'nope' });
    expect(s).toBe(S);
    for (let i = 0; i < 7; i++) s = reduce(s, { t: 'accAdd', id: 'mole' });
    expect(s.acc.map((a) => a.uid)).toEqual([1, 2, 3, 4, 5]);
    s = reduce(s, { t: 'accRemove', uid: 2 });
    s = reduce(s, { t: 'accAdd', id: 'star' });
    expect(s.acc.map((a) => a.uid)).toEqual([1, 3, 4, 5, 6]);
    expect(reduce(s, { t: 'accRemove', uid: 99 })).toBe(s);
  });

  it('액세서리 옮기기 — 범위로 자르고 같은 자리 · 없는 번호 · NaN 은 같은 상태', () => {
    const s = reduce(S, { t: 'accAdd', id: 'bandage' });
    const m = reduce(s, { t: 'accMove', uid: 1, x: 999, y: -999 });
    expect(m.acc[0]?.a).toEqual({ x: 100, y: -120, s: 1, r: 0 });
    expect(reduce(s, { t: 'accMove', uid: 1, x: s.acc[0]!.a.x, y: 0 })).toBe(s);
    expect(reduce(s, { t: 'accMove', uid: 7, x: 3, y: 3 })).toBe(s);
    expect(reduce(s, { t: 'accAdjust', uid: 1, key: 'r', value: NaN })).toBe(s);
    expect(reduce(s, { t: 'accAdjust', uid: 1, key: 'r', value: 90 }).acc[0]?.a.r).toBe(90);
  });

  it('새 액세서리는 붙어 있는 수만큼 옆으로 비켜 붙는다(겹치지 않게)', () => {
    let s = S;
    for (let i = 0; i < 3; i++) s = reduce(s, { t: 'accAdd', id: 'mole' });
    const xs = s.acc.map((a) => a.a.x);
    expect(new Set(xs).size).toBe(3);
  });

  it('무작위는 동공을 «없음» 으로 고르지 않는다 · 오드아이를 끈다', () => {
    const r = randomState(reduce(S, { t: 'oddEye', on: true }), () => 0);
    expect(r.pupil).not.toBe('none');
    expect(r.oddEye).toBe(false);
    expect(r.pupilColor.L).toBe(r.pupilColor.R);
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
      h = histReduce(h, { t: 'live', a: { t: 'adjust', target: 'eyes', side: 'L', key: 'x', value: v } });
    expect(h.past.length).toBe(1);
    expect(h.cur.adj.eyes.L?.x).toBe(10);
    h = histReduce(h, { t: 'commit' });
    expect(h.past.length).toBe(2);
    h = histReduce(h, { t: 'undo' });
    expect(h.cur.adj.eyes.L?.x).toBe(0);
    expect(h.cur.skin).toBe(3); // 그 전 기록은 남아 있다
  });

  it('끄다가 놓지 않고 다른 걸 해도 끈 것은 한 칸으로 남는다 · 바뀐 게 없으면 안 쌓인다', () => {
    let h = histReduce(init, {
      t: 'live',
      a: { t: 'adjust', target: 'eyes', side: 'L', key: 'y', value: 7 },
    });
    h = histReduce(h, { t: 'do', a: { t: 'skin', skin: 4 } });
    expect(h.past.length).toBe(2);
    expect(histReduce(init, { t: 'commit' })).toEqual(init);
    const back = histReduce(
      histReduce(init, { t: 'live', a: { t: 'adjust', target: 'eyes', side: 'L', key: 'y', value: 7 } }),
      { t: 'undo' },
    );
    expect(back.cur).toBe(S); // 놓기 전에 되돌려도 끌기 전으로
  });

  it('처음부터 · 무작위도 되돌릴 수 있다', () => {
    const r = histReduce(init, { t: 'random', rnd: () => 0 });
    expect(histReduce(r, { t: 'undo' }).cur).toBe(S);
  });
});
