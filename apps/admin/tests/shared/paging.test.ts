import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  pageForSize,
  pageNumbers,
  pageSizeKey,
  readPageSize,
  savePageSize,
} from '@/shared/lib';

function memoryStore(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const broken = () => {
  throw new Error('막힌 저장소');
};

describe('쪽 번호 줄', () => {
  it('7쪽 이하는 전부 보인다', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('많으면 처음 · 끝 · 지금 쪽 앞뒤만 두고 줄인다', () => {
    expect(pageNumbers(5, 20)).toEqual([1, 'gap', 4, 5, 6, 'gap', 20]);
    expect(pageNumbers(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageNumbers(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(pageNumbers(17, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
    expect(pageNumbers(20, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
    expect(pageNumbers(5, 8)).toEqual([1, 'gap', 4, 5, 6, 7, 8]);
  });

  it('언제나 7칸 이하이고 지금 쪽 · 처음 · 끝을 품는다', () => {
    for (let count = 1; count <= 30; count++) {
      for (let page = 1; page <= count; page++) {
        const nums = pageNumbers(page, count);
        expect(nums.length).toBeLessThanOrEqual(7);
        expect(nums).toContain(page);
        expect(nums[0]).toBe(1);
        expect(nums.at(-1)).toBe(count);
      }
    }
  });
});

describe('페이지당 개수 기억', () => {
  it('목록마다 tw. 접두사 키로 따로 기억한다', () => {
    const store = memoryStore();
    savePageSize('users', 100, () => store);
    expect(pageSizeKey('users')).toBe('tw.admin.pageSize.users');
    expect(store.data.get('tw.admin.pageSize.users')).toBe('100');
    expect(readPageSize('users', () => store)).toBe(100);
    expect(readPageSize('rooms', () => store)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('고를 수 없는 값 · 없는 저장소 · 막힌 저장소는 기본 50', () => {
    expect(readPageSize('users', () => memoryStore({ 'tw.admin.pageSize.users': '37' }))).toBe(50);
    expect(readPageSize('users', () => memoryStore({ 'tw.admin.pageSize.users': 'abc' }))).toBe(50);
    expect(readPageSize('users', () => undefined)).toBe(50);
    expect(readPageSize('users', broken)).toBe(50);
    expect(() => savePageSize('users', 20, broken)).not.toThrow();
  });
});

describe('개수를 바꿀 때 쪽 맞추기', () => {
  it('지금 보던 첫 줄이 들어 있는 쪽으로 간다', () => {
    expect(pageForSize(3, 20, 50)).toBe(1); // 41번째 줄 → 50개씩 1쪽
    expect(pageForSize(2, 50, 20)).toBe(3); // 51번째 줄 → 20개씩 3쪽
    expect(pageForSize(1, 100, 20)).toBe(1);
    expect(pageForSize(4, 20, 100)).toBe(1);
  });
});
