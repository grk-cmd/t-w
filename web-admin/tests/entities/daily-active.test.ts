import { describe, expect, it } from 'vitest';
import {
  getDayMetrics,
  getRecentMetrics,
  kstDateKey,
  lastDateKeys,
  metricsSummary,
  toDaySummary,
  toVisits,
  uniqueUsers,
  type DayMetrics,
} from '@/entities/daily-active';
import { fakeDb } from '../shared/fakeDb';

const day = (date: string, users: string[] = [], visits = 0, ipVisitors = 0, pings = 0): DayMetrics => ({
  date,
  users,
  dau: users.length,
  visits,
  ipVisitors,
  pings,
});

describe('서울 날짜', () => {
  it('UTC 15시가 서울 자정 — 함수(daily-active.js)와 같은 경계', () => {
    expect(kstDateKey(Date.parse('2026-10-06T14:59:59Z'))).toBe('2026-10-06');
    expect(kstDateKey(Date.parse('2026-10-06T15:00:00Z'))).toBe('2026-10-07');
  });

  it('최근 n 일 — 오래된 날부터 오늘까지, 달을 넘어도', () => {
    expect(lastDateKeys(Date.parse('2026-10-01T03:00:00Z'), 3)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
    expect(lastDateKeys(Date.parse('2026-10-06T15:30:00Z'), 30)).toHaveLength(30);
    expect(lastDateKeys(Date.parse('2026-10-06T15:30:00Z'), 30).at(-1)).toBe('2026-10-07');
  });
});

describe('요약', () => {
  it('DAU · 어제 · 방문 수 · WAU(7일) · MAU(30일)는 고유 사용자 합집합으로', () => {
    const dates = lastDateKeys(Date.parse('2026-10-07T03:00:00Z'), 30);
    const days = dates.map((d) => day(d));
    days[0] = day(dates[0], ['uold00001'], 1); // 30일 전 — MAU 에만
    days[22] = day(dates[22], ['ua0000001', 'ub0000001'], 3); // 8일 전 — WAU 밖
    days[23] = day(dates[23], ['ua0000001'], 2); // 7일 전(오늘 포함 7일의 첫날)
    days[28] = day(dates[28], ['ua0000001', 'uc0000001'], 5); // 어제
    days[29] = day(dates[29], ['uc0000001', 'ud0000001'], 9); // 오늘

    const s = metricsSummary(days)!;
    expect(s.today.users).toHaveLength(2);
    expect(s.today.visits).toBe(9);
    expect(s.yesterday?.users).toHaveLength(2);
    expect(s.wau).toBe(3); // a · c · d
    expect(s.mau).toBe(5); // old · a · b · c · d
    expect(s.firstDate).toBe(dates[0]);
    expect(s.days.map((d) => d.date)).toEqual(dates);
  });

  it('기록이 없으면 firstDate · ipFirstDate 는 null, 빈 목록이면 요약도 null', () => {
    expect(metricsSummary([day('2026-10-06'), day('2026-10-07')])!.firstDate).toBeNull();
    expect(metricsSummary([day('2026-10-06'), day('2026-10-07')])!.ipFirstDate).toBeNull();
    expect(metricsSummary([])).toBeNull();
  });

  it('첫 기록 날짜는 범위 안에서 기록이 처음 있는 날 — 방문 수만 있어도', () => {
    expect(
      metricsSummary([day('2026-10-05'), day('2026-10-06', [], 2), day('2026-10-07', ['ua0000001'], 1)])!
        .firstDate,
    ).toBe('2026-10-06');
  });

  it('IP 기준 첫 기록 날짜는 로그인 기준과 따로 — IP 기록이 늦게 시작해도', () => {
    const s = metricsSummary([
      day('2026-10-05', ['ua0000001'], 1),
      day('2026-10-06', [], 0, 0, 2),
      day('2026-10-07', ['ua0000001'], 1, 4, 6),
    ])!;
    expect(s.firstDate).toBe('2026-10-05');
    expect(s.ipFirstDate).toBe('2026-10-06');
    expect(s.today.ipVisitors).toBe(4);
    expect(s.yesterday?.ipVisitors).toBe(0);
  });

  it('요약만 있는 날(사용자 목록 없음)도 기록이 있는 날로 본다', () => {
    const only: DayMetrics = { date: '2026-10-06', users: [], dau: 3, visits: 5, ipVisitors: 4, pings: 7 };
    expect(metricsSummary([day('2026-10-05'), only, day('2026-10-07')])!.firstDate).toBe('2026-10-06');
  });

  it('합집합은 같은 사람을 한 번만 센다', () => {
    expect(uniqueUsers([day('a', ['u1', 'u2']), day('b', ['u2', 'u3'])])).toBe(3);
  });

  it('방문 수가 숫자가 아니면 0', () => {
    expect(toVisits(4)).toBe(4);
    expect(toVisits(null)).toBe(0);
    expect(toVisits('3')).toBe(0);
    expect(toVisits(-1)).toBe(0);
  });

  it('요약 노드 — at 이 없으면 없는 것으로 · 숫자가 아니면 0', () => {
    expect(toDaySummary({ dau: 2, ipVisitors: 3, visits: 4, pings: 5, wau: 9, mau: 9, at: 1 })).toEqual({
      dau: 2,
      ipVisitors: 3,
      visits: 4,
      pings: 5,
    });
    expect(toDaySummary({ dau: 2 })).toBeNull();
    expect(toDaySummary(null)).toBeNull();
    expect(toDaySummary({ dau: 'x', at: 1 })?.dau).toBe(0);
  });
});

describe('읽기', () => {
  const spyOn = (db: ReturnType<typeof fakeDb>['db']) => {
    const asked: string[] = [];
    const spy = {
      ...db,
      get: <T>(p: string) => (asked.push(`get ${p}`), db.get<T>(p)),
      shallowKeys: (p: string) => (asked.push(`shallow ${p}`), db.shallowKeys(p)),
    };
    return { spy, asked };
  };

  it('오늘 = 사용자 · IP 키만(shallow) + 숫자 두 칸 — 날짜 노드를 통째로 받지 않고 요약도 안 본다', async () => {
    const { db } = fakeDb({
      'metrics/daily/2026-10-07/u': { ua0000001: true, ub0000001: true },
      'metrics/daily/2026-10-07/ip': { h1: true, h2: true, h3: true },
      'metrics/daily/2026-10-07/visits': 5,
      'metrics/daily/2026-10-07/pings': 9,
      'metrics/daily/2026-10-07': { boom: 'get 으로 통째 받으면 안 된다' },
    });
    const { spy, asked } = spyOn(db);
    expect(await getDayMetrics(spy, '2026-10-07', true)).toEqual({
      date: '2026-10-07',
      users: ['ua0000001', 'ub0000001'],
      dau: 2,
      visits: 5,
      ipVisitors: 3,
      pings: 9,
    });
    expect(asked.sort()).toEqual([
      'get metrics/daily/2026-10-07/pings',
      'get metrics/daily/2026-10-07/visits',
      'shallow metrics/daily/2026-10-07/ip',
      'shallow metrics/daily/2026-10-07/u',
    ]);
  });

  it('지난날 요약이 있으면 숫자는 요약에서 — IP 목록 · 숫자 칸은 받지 않고 사용자 목록만(WAU · MAU 용)', async () => {
    const { db } = fakeDb({
      'metrics/summary/2026-10-06': { dau: 7, ipVisitors: 11, visits: 20, pings: 30, wau: 9, mau: 9, at: 1 },
      'metrics/daily/2026-10-06/u': { ua0000001: true },
      'metrics/daily/2026-10-06/ip': { h1: true },
      'metrics/daily/2026-10-06/visits': 1,
    });
    const { spy, asked } = spyOn(db);
    expect(await getDayMetrics(spy, '2026-10-06')).toEqual({
      date: '2026-10-06',
      users: ['ua0000001'],
      dau: 7,
      visits: 20,
      ipVisitors: 11,
      pings: 30,
    });
    expect(asked.sort()).toEqual(['get metrics/summary/2026-10-06', 'shallow metrics/daily/2026-10-06/u']);
  });

  it('지난날 요약이 없으면 목록에서 센다', async () => {
    const { db } = fakeDb({
      'metrics/daily/2026-10-06/u': { ua0000001: true },
      'metrics/daily/2026-10-06/ip': { h1: true, h2: true },
      'metrics/daily/2026-10-06/pings': 3,
    });
    expect(await getDayMetrics(db, '2026-10-06')).toEqual(day('2026-10-06', ['ua0000001'], 0, 2, 3));
  });

  it('기록 없는 날은 빈 값, 순서는 받은 날짜 그대로 · 마지막 날(오늘)만 요약을 안 본다', async () => {
    const { db } = fakeDb({
      'metrics/daily/2026-10-06/u': { ua0000001: true },
      'metrics/daily/2026-10-06/visits': 2,
      'metrics/summary/2026-10-07': { dau: 99, at: 1 },
    });
    const { spy, asked } = spyOn(db);
    expect(await getRecentMetrics(spy, ['2026-10-05', '2026-10-06', '2026-10-07'])).toEqual([
      day('2026-10-05'),
      day('2026-10-06', ['ua0000001'], 2),
      day('2026-10-07'),
    ]);
    expect(asked.filter((a) => a.startsWith('get metrics/summary'))).toEqual([
      'get metrics/summary/2026-10-05',
      'get metrics/summary/2026-10-06',
    ]);
  });
});
