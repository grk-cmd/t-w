import { describe, expect, it } from 'vitest';
import { removeKeys, removeTargets, revokeKeys, revokeTargets } from '@/features/license/revoke-key';
import { fakeDb, NOW } from '../shared/fakeDb';

const selected = [
  { key: 'A', status: 'unused' as const },
  { key: 'B', status: 'revoked' as const },
  { key: 'C', status: 'used' as const },
];

describe('선택 회수 · 삭제', () => {
  it('회수 대상은 살아 있는 키, 삭제 대상은 회수된 키만', () => {
    expect(revokeTargets(selected)).toEqual(['A', 'C']);
    expect(removeTargets(selected)).toEqual(['B']);
  });

  it('회수 — 여러 키를 한 묶음으로 쓴다', async () => {
    const { db, writes } = fakeDb();
    expect(await revokeKeys(db, ['A', 'C'])).toBe(2);
    expect(writes).toEqual([
      ['commit', 'licenses/A/valid', false],
      ['commit', 'licenses/A/revokedAt', NOW],
      ['commit', 'licenses/C/valid', false],
      ['commit', 'licenses/C/revokedAt', NOW],
    ]);
  });

  it('삭제 — 키 노드를 한 묶음으로 지운다', async () => {
    const { db, writes } = fakeDb();
    expect(await removeKeys(db, ['B', 'D'])).toBe(2);
    expect(writes).toEqual([
      ['commit', 'licenses/B', null],
      ['commit', 'licenses/D', null],
    ]);
  });

  it('하나라도 막히면 아무것도 바뀌지 않는다', async () => {
    const { db, writes } = fakeDb({}, (p) => p.startsWith('licenses/C'));
    await expect(revokeKeys(db, ['A', 'C'])).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it('대상이 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb({}, () => true);
    expect(await revokeKeys(db, [])).toBe(0);
    expect(await removeKeys(db, [])).toBe(0);
    expect(writes).toEqual([]);
  });
});
