import { describe, expect, it } from 'vitest';
import { getAnimalUnlockLevel, parseUnlockLevel, saveAnimalUnlockLevel } from '@/entities/game-config';
import { fakeDb } from '../shared/fakeDb';

describe('게임 설정', () => {
  it('해금 레벨 입력은 1~999 정수만', () => {
    expect(parseUnlockLevel(' 50 ')).toBe(50);
    expect(parseUnlockLevel('1')).toBe(1);
    expect(parseUnlockLevel('999')).toBe(999);
    expect(parseUnlockLevel('0')).toBeNull();
    expect(parseUnlockLevel('1000')).toBeNull();
    expect(parseUnlockLevel('12abc')).toBeNull();
    expect(parseUnlockLevel('-3')).toBeNull();
    expect(parseUnlockLevel('')).toBeNull();
  });

  it('필드 하나만 읽고, 없거나 숫자가 아니면 null', async () => {
    expect(await getAnimalUnlockLevel(fakeDb({ 'catalog/gameConfig/animalUnlockLevel': 30 }).db)).toBe(30);
    expect(await getAnimalUnlockLevel(fakeDb().db)).toBeNull();
    expect(
      await getAnimalUnlockLevel(fakeDb({ 'catalog/gameConfig/animalUnlockLevel': '30' }).db),
    ).toBeNull();
  });

  it('저장은 그 필드만 update — 다른 설정을 지우지 않는다', async () => {
    const { db, writes } = fakeDb();
    await saveAnimalUnlockLevel(db, 40);
    expect(writes).toEqual([['update', 'catalog/gameConfig', { animalUnlockLevel: 40 }]]);
  });
});
