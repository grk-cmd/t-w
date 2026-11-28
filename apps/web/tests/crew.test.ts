import { describe, expect, it } from 'vitest';
import {
  BOP_MS,
  BOP_PX,
  BUBBLE_EDGE,
  FLY_TAPS,
  TAIL_IN,
  TAP_WINDOW_MS,
  bopFrames,
  bubbleShift,
  nextTap,
} from '@/pages/home/model/crew';

/** 연타 판정 — 한 번씩은 말풍선, 짧은 시간에 FLY_TAPS 번이면 날아간다 */
function run(times: number[]) {
  let taps: number[] = [];
  return times.map((t) => {
    const r = nextTap(taps, t);
    taps = r.taps;
    return r.fly;
  });
}

describe('nextTap — 연타면 날아간다', () => {
  it('짧은 시간 안에 다섯 번째에서 날고, 센 것을 비운다', () => {
    const quick = Array.from({ length: FLY_TAPS }, (_, i) => i * 100);
    expect(run(quick)).toEqual([false, false, false, false, true]);
    expect(run([...quick, 600])).toEqual([false, false, false, false, true, false]); // 날고 난 뒤는 처음부터
  });

  it('느리게 누르면 몇 번을 눌러도 날지 않는다(창 밖 시각은 버린다)', () => {
    const slow = Array.from({ length: 10 }, (_, i) => i * TAP_WINDOW_MS);
    expect(run(slow).some(Boolean)).toBe(false);
  });

  it('창 경계 — 첫 누름과의 간격이 창과 같으면 이미 지난 것', () => {
    const edge = [0, 1, 2, 3, TAP_WINDOW_MS];
    expect(run(edge)).toEqual([false, false, false, false, false]);
    expect(run([0, 1, 2, 3, TAP_WINDOW_MS - 1])).toEqual([false, false, false, false, true]);
  });
});

describe('bubbleShift — 화면 끝에선 몸통만 밀고 꼬리는 머리를 가리킨다', () => {
  const vw = 360;
  it('화면 안이면 그대로', () => {
    expect(bubbleShift(100, 250, 150, vw)).toEqual({ push: 0, tail: 0 });
  });
  it('끝 여백에 딱 맞으면 그대로 · 1px 넘으면 1px 민다', () => {
    expect(bubbleShift(BUBBLE_EDGE, 200, 150, vw)).toEqual({ push: 0, tail: 0 });
    expect(bubbleShift(200, vw - BUBBLE_EDGE, 150, vw)).toEqual({ push: 0, tail: 0 });
    expect(bubbleShift(200, vw - BUBBLE_EDGE + 1, 150, vw)).toEqual({ push: -1, tail: 1 });
    expect(bubbleShift(BUBBLE_EDGE - 1, 200, 150, vw)).toEqual({ push: 1, tail: -1 });
  });
  it('오른쪽으로 넘으면 왼쪽으로 밀고 꼬리는 그만큼 오른쪽(머리 자리 그대로)', () => {
    expect(bubbleShift(212, 362, 150, vw)).toEqual({ push: -10, tail: 10 });
  });
  it('꼬리는 몸통 안쪽까지만 — 짧은 말풍선을 많이 밀어도 몸통 끝 TAIL_IN 안', () => {
    const r = bubbleShift(300, 385, 85, vw);
    expect(r.push).toBe(-33);
    expect(r.tail).toBe(42 - TAIL_IN);
  });
  it('양쪽 다 넘으면 왼쪽을 맞춘다 · 몸통이 꼬리보다 좁아도 꼬리는 가운데', () => {
    expect(bubbleShift(-5, 400, 405, vw).push).toBe(BUBBLE_EDGE + 5);
    expect(bubbleShift(-5, 20, 25, vw)).toEqual({ push: BUBBLE_EDGE + 5, tail: 0 });
  });
});

describe('bopFrames — 눌렀을 때 통통(앱 쓰다듬기 박자)', () => {
  const ys = (f: Keyframe[]) =>
    f.map((k) => Number(/translateY\((-?[\d.]+)px\)/.exec(String(k.transform))![1]));
  it('처음 · 끝은 제자리 · offset 은 0 → 1 순서', () => {
    const f = bopFrames();
    expect(f[0]!.offset).toBe(0);
    expect(f.at(-1)!.offset).toBe(1);
    expect(f.at(-1)!.transform).toBe('translateY(0px) scale(1, 1)');
    expect(f.every((k, i) => i === 0 || (k.offset as number) > (f[i - 1]!.offset as number))).toBe(true);
  });
  it('위로만 튄다(바닥을 뚫지 않음) · 높이는 BOP_PX 를 넘지 않고 점점 낮아진다', () => {
    const y = ys(bopFrames(220));
    expect(Math.max(...y)).toBeLessThanOrEqual(0);
    expect(Math.min(...y)).toBeGreaterThanOrEqual(-BOP_PX);
    const half = y.length / 2;
    expect(Math.min(...y.slice(0, half))).toBeLessThan(Math.min(...y.slice(half)) - 2); // 앞쪽 튐이 뒤쪽보다 높다
  });
  it('여러 번 튄다(통통) — 높은 점이 셋 이상', () => {
    const y = ys(bopFrames(220));
    const peaks = y.filter((v, i) => i > 0 && i < y.length - 1 && v < y[i - 1]! && v <= y[i + 1]! && v < -1);
    expect(peaks.length).toBeGreaterThanOrEqual(3);
    expect(BOP_MS).toBeGreaterThan(0);
  });
});
