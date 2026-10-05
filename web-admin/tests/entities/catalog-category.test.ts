import { describe, expect, it } from 'vitest';
import {
  applyCatalogWrite,
  BUILTIN_CATS,
  categoryNameProblem,
  categoryNameWrite,
  categoryViews,
} from '@/entities/catalog';

const views = categoryViews(
  { scarf: { cat: 'scarf', label: '목도리', group: 'cloth' } },
  { cape: { label: '겉옷' }, hat: { label: ' ', icon: '🧢' } },
);
const find = (cat: string) => views.find((v) => v.cat === cat)!;

describe('카테고리', () => {
  it('보이는 이름은 앱 rebuildPartCats 와 같게 — 빈 덮어쓰기 칸은 기본값', () => {
    expect(find('cape')).toMatchObject({ label: '겉옷', icon: '🧣', overridden: true, defaultLabel: '망토' });
    expect(find('hat')).toMatchObject({ label: '모자', icon: '🧢', overridden: true });
    expect(views.at(-1)).toMatchObject({ id: 'scarf', icon: '🏷️', builtin: false });
    expect(views).toHaveLength(BUILTIN_CATS.length + 1);
  });

  it('기본 카테고리 — 바꾼 값만 덮어쓰고, 기본값과 같아지면 덮어쓰기를 지운다', () => {
    expect(categoryNameWrite(find('wing'), ' 날개옷 ', '', 7)).toEqual({
      'catalog/catOverrides/wing': { label: '날개옷', updatedAt: 7 },
    });
    expect(categoryNameWrite(find('wing'), '', '🦋', 7)).toEqual({
      'catalog/catOverrides/wing': { label: '날개', icon: '🦋', updatedAt: 7 },
    });
    expect(categoryNameWrite(find('cape'), '', '', 7)).toEqual({ 'catalog/catOverrides/cape': null });
    expect(categoryNameWrite(find('cape'), '망토', '🧣', 7)).toEqual({ 'catalog/catOverrides/cape': null });
  });

  it('커스텀 카테고리 — 제 항목의 이름 · 아이콘 필드만, 아이콘을 비우면 🏷️', () => {
    expect(categoryNameWrite(find('scarf'), ' 머플러 ', ' ', 7)).toEqual({
      'catalog/customCats/scarf/label': '머플러',
      'catalog/customCats/scarf/icon': '🏷️',
    });
  });

  it('규칙에 걸릴 입력은 미리 막는다 — 빈 이름은 기본 카테고리만 받는다', () => {
    expect(categoryNameProblem(find('cape'), '', '')).toBeNull();
    expect(categoryNameProblem(find('scarf'), ' ', '')).toBe('이름을 넣어 주세요');
    expect(categoryNameProblem(find('cape'), 'ㄱ'.repeat(21), '')).toBe('이름은 20자까지예요');
    expect(categoryNameProblem(find('cape'), '겉옷', '123456789')).toBe('아이콘은 8자까지예요');
  });
});

describe('받아 둔 노드에 쓰기 반영', () => {
  it('항목 통째 · 필드 · 지우기를 반영하고 다른 노드 경로는 건너뛴다', () => {
    const current = { a: { name: 'A', order: 0 }, b: { name: 'B' } };
    const next = applyCatalogWrite(current, 'parts', {
      'catalog/parts/a/order': 3,
      'catalog/parts/b': null,
      'catalog/parts/c': { name: 'C' },
      'catalog/parts/a/glb': null,
      'catalog/gachaParts/a': null,
    });
    expect(next).toEqual({ a: { name: 'A', order: 3 }, c: { name: 'C' } });
    expect(current).toEqual({ a: { name: 'A', order: 0 }, b: { name: 'B' } });
  });

  it('이 노드 경로가 없으면 같은 객체를 돌려준다', () => {
    const current = { a: { name: 'A' } };
    expect(applyCatalogWrite(current, 'parts', { 'catalog/partsX/a': null })).toBe(current);
  });
});
