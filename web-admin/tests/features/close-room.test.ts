import { describe, expect, it } from 'vitest';
import {
  closeAllRooms,
  closeRoom,
  closeSelectedRooms,
  isCloseAllConfirmed,
} from '@/features/room/close-room';
import { fakeDb } from '../shared/fakeDb';

describe('방 종료', () => {
  it('방 하나 — rooms · roomIndex 를 함께 지운다', async () => {
    const { db, writes } = fakeDb();
    await closeRoom(db, 'SCRT-AB12');
    expect(writes).toEqual([
      ['commit', 'rooms/SCRT-AB12', null],
      ['commit', 'roomIndex/SCRT-AB12', null],
    ]);
  });

  it('전체 — 실행 직전의 roomIndex 키 전부를 한 묶음으로 지운다', async () => {
    const { db, writes } = fakeDb({
      roomIndex: { 'WORK-B': { lastSeen: 1 }, 'PLAY-A': { lastSeen: 2 } },
    });
    expect(await closeAllRooms(db)).toEqual(['PLAY-A', 'WORK-B']);
    expect(writes.every(([op, , v]) => op === 'commit' && v === null)).toBe(true);
    expect(writes.map((w) => w[1])).toEqual([
      'rooms/PLAY-A',
      'roomIndex/PLAY-A',
      'rooms/WORK-B',
      'roomIndex/WORK-B',
    ]);
  });

  it('전체 — 방이 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb();
    expect(await closeAllRooms(db)).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('전체 종료는 «종료» 를 정확히 입력해야 한다', () => {
    expect(isCloseAllConfirmed('종료')).toBe(true);
    expect(isCloseAllConfirmed(' 종료 ')).toBe(true);
    expect(isCloseAllConfirmed('')).toBe(false);
    expect(isCloseAllConfirmed('종료함')).toBe(false);
  });
});

describe('선택 종료', () => {
  it('고른 방의 rooms · roomIndex 를 한 묶음으로 지운다', async () => {
    const { db, writes } = fakeDb();
    expect(await closeSelectedRooms(db, ['WORK-A', 'PLAY-B'])).toBe(2);
    expect(writes).toEqual([
      ['commit', 'rooms/WORK-A', null],
      ['commit', 'roomIndex/WORK-A', null],
      ['commit', 'rooms/PLAY-B', null],
      ['commit', 'roomIndex/PLAY-B', null],
    ]);
  });

  it('하나라도 막히면 아무 방도 지우지 않는다', async () => {
    const { db, writes } = fakeDb({}, (p) => p === 'rooms/PLAY-B');
    await expect(closeSelectedRooms(db, ['WORK-A', 'PLAY-B'])).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});
