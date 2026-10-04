import { describe, expect, it } from 'vitest';
import { getMinRoomVer } from '@/entities/min-room-ver';
import { fakeDb } from '../shared/fakeDb';

describe('방 입장 최소 버전', () => {
  it('읽은 값은 문자열로 맞춘다', async () => {
    expect(await getMinRoomVer(fakeDb().db)).toBeNull();
    expect(await getMinRoomVer(fakeDb({ 'config/minRoomVer': '0.10.2' }).db)).toBe('0.10.2');
  });
});
