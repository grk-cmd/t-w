import { describe, expect, it } from 'vitest';
import { centerSquare } from '@/features/character-maker/lib/load-image';

describe('내 그림 — 가운데 정사각형 자르기', () => {
  it('가로가 길면 양옆을 같이 자른다', () => {
    expect(centerSquare(400, 200)).toEqual([100, 0, 200]);
  });
  it('세로가 길면 위아래를 같이 자른다', () => {
    expect(centerSquare(300, 900)).toEqual([0, 300, 300]);
  });
  it('정사각형은 그대로', () => {
    expect(centerSquare(256, 256)).toEqual([0, 0, 256]);
  });
  it('홀수 차이는 반 픽셀로 나눈다', () => {
    expect(centerSquare(101, 100)).toEqual([0.5, 0, 100]);
  });
  it('크기가 0 · 음수 · NaN 이면 null', () => {
    expect(centerSquare(0, 100)).toBeNull();
    expect(centerSquare(100, -1)).toBeNull();
    expect(centerSquare(Number.NaN, 100)).toBeNull();
  });
});
