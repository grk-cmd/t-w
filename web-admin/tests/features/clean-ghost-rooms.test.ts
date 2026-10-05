import { describe, expect, it } from 'vitest';
import { cleanGhostRooms } from '@/features/room/clean-ghost-rooms';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const NOW = 1_000_000;
const clock = () => NOW;

describe('유령 방 청소', () => {
  it('지우기 직전에 다시 확인해 아직 유령인 방만 한 묶음으로 지운다', async () => {
    const { db, writes } = fakeDb({
      roomIndex: {
        'WORK-DEAD': { lastSeen: NOW - 100_000 },
        'WORK-BACK': { lastSeen: NOW - 5_000 }, // 미리보기 뒤에 다시 살아남
      },
    });
    const r = await cleanGhostRooms(db, ['WORK-DEAD', 'WORK-BACK', 'WORK-GONE'], clock);
    expect(r).toEqual({ removed: ['WORK-DEAD', 'WORK-GONE'], revived: ['WORK-BACK'] });
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'rooms/WORK-DEAD', null],
      ['commit', 'roomIndex/WORK-DEAD', null],
      ['commit', 'rooms/WORK-GONE', null],
      ['commit', 'roomIndex/WORK-GONE', null],
    ]);
  });

  it('서버 시각 차를 더해 판정한다 — PC 시계가 앞서도 살아 있는 방을 지우지 않는다', async () => {
    const { db, writes } = fakeDb({ roomIndex: { 'WORK-LIVE': { lastSeen: NOW - 10_000 } } });
    db.serverTimeOffset = async () => -120_000; // 이 PC 시계가 2분 빠르다
    const r = await cleanGhostRooms(db, ['WORK-LIVE'], () => NOW + 120_000);
    expect(r.removed).toEqual([]);
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('묶음이 거부되면 아무것도 지워지지 않는다', async () => {
    const { db, writes } = fakeDb({ roomIndex: {} }, (p) => p === 'rooms/WORK-B');
    await expect(cleanGhostRooms(db, ['WORK-A', 'WORK-B'], clock)).rejects.toThrow();
    expect(withoutAudits(writes)).toEqual([]);
  });

  it('고아 방은 지우기 직전 멤버 신호를 읽어 그새 살아났으면 남긴다', async () => {
    const { db, writes } = fakeDb({
      roomIndex: {},
      'rooms/WORK-ORPH': { _meta: true, chatLog: true },
      'rooms/WORK-OLDC': { u1: true },
      'rooms/WORK-OLDC/u1/lastSeen': NOW - 1_000,
    });
    const r = await cleanGhostRooms(db, ['WORK-ORPH', 'WORK-OLDC'], clock);
    expect(r).toEqual({ removed: ['WORK-ORPH'], revived: ['WORK-OLDC'] });
    expect(withoutAudits(writes).map((w) => w[1])).toEqual(['rooms/WORK-ORPH', 'roomIndex/WORK-ORPH']);
  });

  it('시크릿룸은 넘겨받아도 지우지 않는다', async () => {
    const { db, writes } = fakeDb({ roomIndex: {}, 'rooms/SCRT-AB12': {} });
    expect(await cleanGhostRooms(db, ['SCRT-AB12'], clock)).toEqual({ removed: [], revived: [] });
    expect(withoutAudits(writes)).toEqual([]);
  });
});
