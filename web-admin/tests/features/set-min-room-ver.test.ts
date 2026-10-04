import { describe, expect, it } from 'vitest';
import { setMinRoomVer } from '@/features/set-min-room-ver';
import { fakeDb } from '../shared/fakeDb';

describe('방 입장 최소 버전 바꾸기', () => {
  it('확인한 현재 값 그대로면 새 값을 쓴다', async () => {
    const { db, writes } = fakeDb({ 'config/minRoomVer': '0.9.0' });
    expect(await setMinRoomVer(db, '0.10.2', '0.9.0')).toEqual({ ok: true });
    expect(writes).toEqual([['set', 'config/minRoomVer', '0.10.2']]);
  });

  it('처음 정할 때(값 없음)도 쓴다', async () => {
    const { db, writes } = fakeDb();
    expect(await setMinRoomVer(db, '0.10.2', null)).toEqual({ ok: true });
    expect(writes).toHaveLength(1);
  });

  it('그 사이 값이 바뀌었으면 쓰지 않는다', async () => {
    const { db, writes } = fakeDb({ 'config/minRoomVer': '0.11.0' });
    expect(await setMinRoomVer(db, '0.10.2', '0.9.0')).toEqual({
      ok: false,
      reason: 'changed',
      current: '0.11.0',
    });
    expect(writes).toEqual([]);
  });

  it('형식이 틀리면 쓰지 않는다', async () => {
    const { db, writes } = fakeDb();
    expect((await setMinRoomVer(db, '0.10', null)).ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it('쓰기가 거부되면 오류를 그대로 올린다', async () => {
    const { db } = fakeDb({}, (p) => p === 'config/minRoomVer');
    await expect(setMinRoomVer(db, '0.10.2', null)).rejects.toThrow();
  });
});
