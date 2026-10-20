import { describe, expect, it } from 'vitest';
import { paginate } from '@/shared/lib';

describe('페이징', () => {
  it('범위를 벗어난 쪽 번호는 끝 쪽으로 맞춘다', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({ items: [3, 4], page: 2, pageCount: 3 });
    expect(paginate([1, 2, 3], 9, 2)).toEqual({ items: [3], page: 2, pageCount: 2 });
    expect(paginate([], 1, 2)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});
