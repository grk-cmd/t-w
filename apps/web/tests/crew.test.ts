import { describe, expect, it } from 'vitest';
import { FLY_TAPS, TAP_WINDOW_MS, nextTap } from '@/pages/home/model/crew';

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
