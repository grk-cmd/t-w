import { describe, expect, it } from 'vitest';
import {
  BOP_MS,
  BOP_PX,
  BUBBLE_EDGE,
  FLY_TAPS,
  FUSE_TAPS,
  TAIL_IN,
  TAP_WINDOW_MS,
  bopFrames,
  bubbleShift,
  launchFrames,
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

describe('nextTap — 셋째부터 💣 예고 (시안 운영진 날리기)', () => {
  it('시안 값 그대로 — 1.6초 안에 다섯 번 · 셋째부터 예고', () => {
    expect(TAP_WINDOW_MS).toBe(1600);
    expect(FLY_TAPS).toBe(5);
    expect(FUSE_TAPS).toBe(3);
  });
  it('첫째 · 둘째는 예고 없음 · 셋째 · 넷째는 예고 · 다섯째는 날기(예고 아님)', () => {
    let taps: number[] = [];
    const got = [0, 100, 200, 300, 400].map((t) => {
      const r = nextTap(taps, t);
      taps = r.taps;
      return [r.fuse, r.fly];
    });
    expect(got).toEqual([
      [false, false],
      [false, false],
      [true, false],
      [true, false],
      [false, true],
    ]);
  });
  it('창 밖으로 밀린 누름은 세지 않는다 — 느린 셋째는 예고 없음', () => {
    const r1 = nextTap([], 0);
    const r2 = nextTap(r1.taps, 100);
    expect(nextTap(r2.taps, TAP_WINDOW_MS).fuse).toBe(false);
    expect(nextTap(r2.taps, TAP_WINDOW_MS - 1).fuse).toBe(true);
  });
});

describe('launchFrames — 위로 솟으며 돌다 떨어져 찌그러진다', () => {
  const tf = (k: Keyframe) => String(k.transform);
  it('처음 · 끝은 제자리 · 오프셋은 차례로 늘어난다', () => {
    const f = launchFrames(1);
    expect(tf(f[0]!)).toBe('translate(0, 0) rotate(0deg)');
    expect(tf(f[f.length - 1]!)).toBe('translate(0, 0)');
    const offs = f.map((k) => k.offset).filter((o): o is number => typeof o === 'number');
    expect(offs).toEqual([0.08, 0.45, 0.46, 0.7, 0.9, 0.95]);
  });
  it('가장 높은 곳은 그림 높이 4.2배 위 · 방향(side)대로 옆으로 돌며 솟는다', () => {
    expect(tf(launchFrames(1)[2]!)).toBe('translate(60%, -420%) rotate(900deg)');
    expect(tf(launchFrames(-1)[2]!)).toBe('translate(-60%, -420%) rotate(-900deg)');
    expect(launchFrames(1)[2]!.easing).toBe('ease-in');
  });
  it('꼭대기에서 바로 서서 떨어지고 · 땅에서 찌그러졌다 튄다', () => {
    const f = launchFrames(-1);
    expect(tf(f[3]!)).toBe('translate(0, -420%) rotate(0deg)');
    expect(tf(f[5]!)).toBe('translate(0, 0) scale(1.1, 0.85)');
    expect(tf(f[6]!)).toBe('translate(0, -8%) scale(0.95, 1.05)');
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
  // 1ms 마다 한 프레임 — 박자 · 높이를 시각으로 견준다
  const fine = () => bopFrames(BOP_MS);
  const parse = (k: Keyframe) => {
    const m = /translateY\((-?[\d.]+)px\) scale\(([\d.]+), ([\d.]+)\)/.exec(String(k.transform))!;
    return { y: Number(m[1]), sx: Number(m[2]), sy: Number(m[3]) };
  };
  /** 튐(높은 점) — 오르다 내려가기 시작하는 곳. 같은 값이 이어지면 하나로 · 땅(−0.5px 위)에 돌아온 뒤에만 새로 센다 ·
      1px 보다 낮은 끝자락 떨림은 튐으로 세지 않는다 */
  const peaks = (y: number[]) => {
    const out: number[] = [];
    let best = 0;
    let at = -1;
    for (let i = 0; i < y.length; i++) {
      if (y[i]! < best) {
        best = y[i]!;
        at = i;
      } else if (y[i]! > -0.5 && at >= 0) {
        if (best < -1) out.push(at);
        best = 0;
        at = -1;
      }
    }
    if (at >= 0 && best < -1) out.push(at);
    return out;
  };

  it('정한 값 — 최대 12px · 1.1초', () => {
    expect(BOP_PX).toBe(12);
    expect(BOP_MS).toBe(1100);
  });
  it('처음 · 끝은 제자리 · offset 은 0 → 1 순서', () => {
    const f = bopFrames();
    expect(f[0]!.offset).toBe(0);
    expect(f.at(-1)!.offset).toBe(1);
    expect(f.at(-1)!.transform).toBe('translateY(0px) scale(1, 1)');
    expect(f.every((k, i) => i === 0 || (k.offset as number) > (f[i - 1]!.offset as number))).toBe(true);
  });
  it('위로만 튄다(바닥을 뚫지 않음) · 첫 튐이 가장 높고(약 −9.4px · 약 88ms) 점점 낮아진다', () => {
    const y = fine().map((k) => parse(k).y);
    expect(Math.max(...y)).toBeLessThanOrEqual(0);
    const p = peaks(y);
    expect(y[p[0]!]).toBeCloseTo(-9.4, 0);
    expect(p[0]).toBeGreaterThanOrEqual(80);
    expect(p[0]).toBeLessThanOrEqual(100);
    for (let i = 1; i < p.length; i++) expect(y[p[i]!]!).toBeGreaterThan(y[p[i - 1]!]!);
  });
  it('통통 다섯 번 — 박자는 앱 쓰다듬기(반 주기 약 196ms)', () => {
    const p = peaks(fine().map((k) => parse(k).y));
    expect(p).toHaveLength(5);
    expect(p[1]! - p[0]!).toBeGreaterThan(180);
    expect(p[1]! - p[0]!).toBeLessThan(215);
  });
  it('땅에 닿을 때 살짝 납작 — 옆으로 넓고 위아래로 낮게 · 6% 안', () => {
    const f = fine().map(parse);
    const land = f.slice(1, -1).filter((k) => k.y > -0.2);
    expect(land.length).toBeGreaterThan(0);
    for (const k of land) {
      expect(k.sx).toBeGreaterThanOrEqual(1);
      expect(k.sy).toBeLessThanOrEqual(1);
      expect(k.sx - 1).toBeLessThanOrEqual(0.06);
    }
    expect(Math.max(...land.map((k) => k.sx))).toBeGreaterThan(1.03); // 처음 닿을 때(약 196ms)는 눈에 띄게
  });
});
