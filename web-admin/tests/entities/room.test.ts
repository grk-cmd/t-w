import { describe, expect, it } from 'vitest';
import {
  closeRooms,
  closeRoomsWrite,
  formatAgo,
  ghostCodes,
  isRoomAlive,
  normalizeRoomCode,
  ROOM_LIVE_MS,
  roomRows,
  roomStatsSummary,
} from '@/entities/room';
import { fakeDb } from '../shared/fakeDb';

const NOW = 1_000_000;

describe('방 생존 판정', () => {
  it('마지막 신호가 90초 안이면 살아 있다 (앱 · functions 와 같은 기준)', () => {
    expect(ROOM_LIVE_MS).toBe(90_000);
    expect(isRoomAlive({ lastSeen: NOW - 89_999 }, NOW)).toBe(true);
    expect(isRoomAlive({ lastSeen: NOW - 90_000 }, NOW)).toBe(false);
  });

  it('신호가 없거나 줄이 없으면 유령이다', () => {
    expect(isRoomAlive({}, NOW)).toBe(false);
    expect(isRoomAlive(null, NOW)).toBe(false);
    expect(isRoomAlive(undefined, NOW)).toBe(false);
  });

  it('유령 방 코드만 골라 정렬한다', () => {
    const index = {
      'WORK-BBBB': { lastSeen: NOW - 100_000 },
      'WORK-AAAA': {},
      'PLAY-LIVE': { lastSeen: NOW - 10_000, channel: 'togetherroom' as const },
    };
    expect(ghostCodes(index, NOW)).toEqual(['WORK-AAAA', 'WORK-BBBB']);
  });
});

describe('방 목록 줄', () => {
  it('살아 있는 방이 위, 그 안에서는 최근 신호 순. channel 이 없으면 워킹룸', () => {
    const rows = roomRows(
      {
        'WORK-OLD': { lastSeen: NOW - 200_000 },
        'PLAY-NEW': { lastSeen: NOW - 1_000, channel: 'togetherroom', open: true },
        'WORK-MID': { lastSeen: NOW - 30_000 },
      },
      NOW,
    );
    expect(rows.map((r) => r.code)).toEqual(['PLAY-NEW', 'WORK-MID', 'WORK-OLD']);
    expect(rows[0]).toMatchObject({ channel: 'togetherroom', open: true, alive: true });
    expect(rows[2]).toMatchObject({ channel: 'workingroom', open: false, alive: false });
  });
});

describe('서버 집계 요약', () => {
  it('3분 안에 쓴 값이면 신선하다', () => {
    expect(roomStatsSummary({ workingroom: 2, togetherroom: 1, at: NOW - 60_000 }, NOW)).toEqual({
      total: 3,
      workingroom: 2,
      togetherroom: 1,
      at: NOW - 60_000,
      fresh: true,
    });
    expect(roomStatsSummary({ workingroom: 2, togetherroom: 1, at: NOW - 180_000 }, NOW)?.fresh).toBe(false);
  });

  it('없거나 모양이 틀리면 null', () => {
    expect(roomStatsSummary(null, NOW)).toBeNull();
    expect(roomStatsSummary({ workingroom: 1 }, NOW)).toBeNull();
  });
});

describe('표시 · 입력', () => {
  it('몇 분 전', () => {
    expect(formatAgo(5_000)).toBe('5초 전');
    expect(formatAgo(-5_000)).toBe('0초 전');
    expect(formatAgo(125_000)).toBe('2분 전');
    expect(formatAgo(2 * 3600_000)).toBe('2시간 전');
    expect(formatAgo(3 * 86400_000)).toBe('3일 전');
  });

  it('방 코드는 대문자로 맞추고 경로에 못 쓰는 글자는 막는다', () => {
    expect(normalizeRoomCode(' scrt-ab12 ')).toBe('SCRT-AB12');
    expect(normalizeRoomCode('WORK-AB12/../x')).toBeNull();
    expect(normalizeRoomCode('WORK.AB12')).toBeNull();
    expect(normalizeRoomCode('')).toBeNull();
  });
});

describe('방 종료 쓰기', () => {
  it('rooms · roomIndex 를 null 로 한 묶음에 담는다', async () => {
    expect(closeRoomsWrite(['A-1', 'B-2'])).toEqual({
      'rooms/A-1': null,
      'roomIndex/A-1': null,
      'rooms/B-2': null,
      'roomIndex/B-2': null,
    });
    const { db, writes } = fakeDb();
    await closeRooms(db, ['A-1']);
    expect(writes).toEqual([
      ['commit', 'rooms/A-1', null],
      ['commit', 'roomIndex/A-1', null],
    ]);
  });

  it('대상이 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb();
    await closeRooms(db, []);
    expect(writes).toEqual([]);
  });
});
