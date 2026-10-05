import { describe, expect, it } from 'vitest';
import {
  applyCatalogWrite,
  BUILTIN_CATS,
  categoryViews,
  customCatProblem,
  customCatWrite,
  normalizeCatId,
  overrideProblem,
  overrideWrite,
  type CustomCatInput,
} from '@/entities/catalog';

const input = (over: Partial<CustomCatInput> = {}): CustomCatInput => ({
  id: 'scarf',
  label: '목도리',
  icon: '🧣',
  group: 'cloth',
  bone: 'spine',
  ...over,
});
const taken = new Set(BUILTIN_CATS.map((c) => c.cat));

describe('카테고리', () => {
  it('ID 는 앱과 같이 소문자로 바꾸고 허용 밖 글자는 버린다', () => {
    expect(normalizeCatId('  My-Scarf 2 ')).toBe('myscarf2');
  });

  it('규칙 customCats .validate 에 걸릴 입력은 미리 막는다', () => {
    expect(customCatProblem(input(), taken)).toBeNull();
    expect(customCatProblem(input({ label: '  ' }), taken)).toBe('이름을 넣어 주세요');
    expect(customCatProblem(input({ label: 'ㄱ'.repeat(21) }), taken)).toBe('이름은 20자까지예요');
    expect(customCatProblem(input({ id: '' }), taken)).toBe('ID 를 넣어 주세요');
    expect(customCatProblem(input({ id: '1scarf' }), taken)).toBe('ID 는 영문 소문자로 시작해요');
    expect(customCatProblem(input({ id: 'a'.repeat(21) }), taken)).toBe('ID 는 20자까지예요');
    expect(customCatProblem(input({ id: 'hat' }), taken)).toBe('이미 있는 ID 예요');
    expect(customCatProblem(input({ icon: '123456789' }), taken)).toBe('아이콘은 8자까지예요');
  });

  it('커스텀 카테고리는 앱 publishCustomCat 과 같은 모양 — 아이콘을 비우면 🏷️', () => {
    expect(customCatWrite(input({ icon: ' ', label: ' 목도리 ' }), 5)).toEqual({
      'catalog/customCats/scarf': {
        cat: 'scarf',
        label: '목도리',
        icon: '🏷️',
        group: 'cloth',
        bone: 'spine',
        createdAt: 5,
      },
    });
  });

  it('덮어쓰기는 아이콘을 비우면 icon 키를 두지 않는다', () => {
    expect(overrideWrite('cape', ' 겉옷 ', '', 7)).toEqual({
      'catalog/catOverrides/cape': { label: '겉옷', updatedAt: 7 },
    });
    expect(overrideWrite('cape', '겉옷', '🧥', 7)).toEqual({
      'catalog/catOverrides/cape': { label: '겉옷', icon: '🧥', updatedAt: 7 },
    });
    expect(overrideProblem('', '')).toBe('이름을 넣어 주세요');
    expect(overrideProblem('겉옷', '123456789')).toBe('아이콘은 8자까지예요');
  });

  it('보이는 이름은 앱 rebuildPartCats 와 같게 — 빈 덮어쓰기 칸은 기본값', () => {
    const views = categoryViews(
      { scarf: { cat: 'scarf', label: '목도리', group: 'cloth' } },
      { cape: { label: '겉옷' }, hat: { label: ' ', icon: '🧢' } },
    );
    expect(views.find((v) => v.cat === 'cape')).toMatchObject({
      label: '겉옷',
      icon: '🧣',
      overridden: true,
    });
    expect(views.find((v) => v.cat === 'hat')).toMatchObject({ label: '모자', icon: '🧢', overridden: true });
    expect(views.at(-1)).toMatchObject({ cat: 'scarf', icon: '🏷️', builtin: false });
    expect(views).toHaveLength(BUILTIN_CATS.length + 1);
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
