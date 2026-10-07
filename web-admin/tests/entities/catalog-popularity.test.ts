import { describe, expect, it } from 'vitest';
import {
  byPopularity,
  equipCountOf,
  equipKindOf,
  equipPath,
  getEquipCounts,
  toEquipCounts,
} from '@/entities/catalog';
import { fakeDb } from '../shared/fakeDb';

describe('카탈로그 장착 사용자 수', () => {
  it('파츠 · 가챠 파츠는 같은 parts 칸을, 책상 · 아이템은 제 칸을 읽는다', () => {
    expect(equipKindOf('parts')).toBe('parts');
    expect(equipKindOf('gachaParts')).toBe('parts');
    expect(equipKindOf('desks')).toBe('desks');
    expect(equipKindOf('items')).toBe('items');
    expect(equipPath('desks')).toBe('metrics/parts/equipped/desks');
  });

  it('숫자가 아니거나 0 이하인 값은 버리고, 없는 항목은 0', () => {
    const counts = toEquipCounts({ a: 3, b: 0, c: -1, d: 'x', e: 2.7, f: null, g: Number.NaN });
    expect(counts).toEqual({ a: 3, e: 2 });
    expect(equipCountOf(counts, 'a')).toBe(3);
    expect(equipCountOf(counts, 'zz')).toBe(0);
    expect(equipCountOf(undefined, 'a')).toBe(0);
    expect(toEquipCounts(null)).toEqual({});
    expect(toEquipCounts(5)).toEqual({});
  });

  it('많이 쓰는 순 — 같으면 진열 순서 그대로, 원본은 안 바뀐다', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const sorted = byPopularity(list, { c: 5, b: 2, d: 2 });
    expect(sorted.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(byPopularity(list, undefined).map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('종류마다 작은 숫자 노드 하나만 읽는다', async () => {
    const { db } = fakeDb({ 'metrics/parts/equipped/items': { i1: 4, plant: 1 } });
    expect(await getEquipCounts(db, 'items')).toEqual({ i1: 4, plant: 1 });
    expect(await getEquipCounts(db, 'desks')).toEqual({});
  });
});
