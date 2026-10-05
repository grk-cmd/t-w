import { describe, expect, it } from 'vitest';
import { getUserPresence } from '@/entities/user';
import { fakeDb } from '../shared/fakeDb';

describe('마지막 접속', () => {
  it('presence 한 칸만 읽고, 모양이 이상한 값은 없는 것으로', async () => {
    const { db } = fakeDb({
      'users/u1/presence': { online: true, lastSeen: 5, room: 'WORK-AAAA', ver: '0.10.3' },
      'users/u2/presence': { online: 'yes', lastSeen: '어제', ver: 103 },
      'users/u4/presence': { online: false, lastSeen: 7, room: 'WORK-OLD1' },
    });
    expect(await getUserPresence(db, 'u1')).toEqual({
      online: true,
      lastSeen: 5,
      room: 'WORK-AAAA',
      ver: '0.10.3',
    });
    expect(await getUserPresence(db, 'u2')).toEqual({ online: false, lastSeen: null, room: null, ver: null });
    // 접속이 끊긴 사람의 room 은 지워지지 않고 남은 값일 수 있어 버린다. 옛 앱은 ver 가 없다.
    expect(await getUserPresence(db, 'u4')).toEqual({ online: false, lastSeen: 7, room: null, ver: null });
    expect(await getUserPresence(db, 'u3')).toBeNull();
  });
});
