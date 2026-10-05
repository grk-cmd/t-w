import { describe, expect, it } from 'vitest';
import { entryInfoProblem, toEntry } from '@/entities/catalog';
import { saveEntryInfo } from '@/features/catalog/edit-entry-info';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const desk = toEntry('desks', 'd1', {
  name: '나무책상',
  icon: '🪵',
  glbUrl: 'https://x/catalog/desks/d1.glb',
});

describe('책상 · 아이템 정보 수정', () => {
  it('바뀐 필드만 한 묶음으로 쓴다 — 나머지 필드는 그대로라 규칙을 통과한다', async () => {
    const { db, writes } = fakeDb();
    expect(await saveEntryInfo(db, desk, ' 큰 나무책상 ', '🪵')).toEqual({
      'catalog/desks/d1/name': '큰 나무책상',
    });
    expect(withoutAudits(writes)).toEqual([['commit', 'catalog/desks/d1/name', '큰 나무책상']]);
  });

  it('아이콘을 비우면 키를 지우지 않고 빈 글자로 쓴다(규칙이 icon 없는 항목을 거절)', async () => {
    const { db, writes } = fakeDb();
    await saveEntryInfo(db, toEntry('items', 'i1', { name: '컵', icon: '☕' }), '컵', '');
    expect(withoutAudits(writes)).toEqual([['commit', 'catalog/items/i1/icon', '']]);
  });

  it('바뀐 게 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb({}, () => true);
    expect(await saveEntryInfo(db, desk, '나무책상', '🪵')).toEqual({});
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('규칙 길이를 넘는 입력은 미리 막는다', () => {
    expect(entryInfoProblem(' ', '')).toBe('이름을 넣어 주세요');
    expect(entryInfoProblem('ㄱ'.repeat(31), '')).toBe('이름은 30자까지예요');
    expect(entryInfoProblem('책상', '123456789')).toBe('아이콘은 8자까지예요');
    expect(entryInfoProblem('ㄱ'.repeat(30), '12345678')).toBeNull();
  });
});
