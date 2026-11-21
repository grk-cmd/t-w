import { describe, expect, it } from 'vitest';
import { pruneSelection, selectionState, toggleAllIds, toggleId } from '@/shared/lib';

const set = (...ids: string[]) => new Set(ids);
const sorted = (s: Set<string>) => [...s].sort();

describe('선택', () => {
  it('목록에서 사라진 id 는 빠지고, 목록 순서로 돌려준다', () => {
    expect(pruneSelection(set('c', 'gone', 'a'), ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  it('한 줄 토글 — 고르고 풀고, 목록에 없는 id 는 고르지 않는다', () => {
    const ids = ['a', 'b'];
    expect(sorted(toggleId(set(), ids, 'a'))).toEqual(['a']);
    expect(sorted(toggleId(set('a'), ids, 'a'))).toEqual([]);
    expect(sorted(toggleId(set(), ids, 'zz'))).toEqual([]);
  });

  it('토글하면 사라진 id 는 집합에서도 지워진다', () => {
    expect(sorted(toggleId(set('gone'), ['a'], 'a'))).toEqual(['a']);
  });

  it('이 쪽 전체 선택은 이 쪽만 고르고, 다른 쪽 선택은 남긴다', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(sorted(toggleAllIds(set('a'), ids, ['c', 'd']))).toEqual(['a', 'c', 'd']);
  });

  it('이 쪽이 다 골라져 있으면 이 쪽만 푼다', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(sorted(toggleAllIds(set('a', 'c', 'd'), ids, ['c', 'd']))).toEqual(['a']);
  });

  it('일부만 골라졌으면 이 쪽을 마저 고른다', () => {
    expect(sorted(toggleAllIds(set('a'), ['a', 'b'], ['a', 'b']))).toEqual(['a', 'b']);
  });

  it('빈 쪽에서 전체 선택은 아무것도 하지 않는다', () => {
    expect(sorted(toggleAllIds(set(), [], []))).toEqual([]);
  });

  it('전체 · 일부 상태는 이 쪽 기준이다', () => {
    expect(selectionState(set(), ['a', 'b'])).toEqual({ allChecked: false, someChecked: false });
    expect(selectionState(set('a'), ['a', 'b'])).toEqual({ allChecked: false, someChecked: true });
    expect(selectionState(set('a', 'b'), ['a', 'b'])).toEqual({ allChecked: true, someChecked: false });
    // 다른 쪽에서 고른 것은 이 쪽 상태에 영향이 없다.
    expect(selectionState(set('x'), ['a', 'b'])).toEqual({ allChecked: false, someChecked: false });
    expect(selectionState(set(), [])).toEqual({ allChecked: false, someChecked: false });
  });
});
