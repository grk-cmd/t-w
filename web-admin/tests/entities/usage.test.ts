import { describe, expect, it } from 'vitest';
import {
  byteUnit,
  BYTES_PER_GB,
  formatUsd,
  getDayUsage,
  overAverage,
  toDayUsage,
  usageStats,
  type DayUsage,
} from '@/entities/metrics/usage';
import { fakeDb } from '../shared/fakeDb';

const day = (date: string, sentBytes: number | null, at = 0): DayUsage => ({
  date,
  db: sentBytes === null ? null : { sentBytes, storedBytes: null, peakConnections: 0, at },
  functions: null,
  storage: null,
  hosting: null,
});
const sent = (d: DayUsage) => d.db?.sentBytes ?? null;

describe('날짜 노드 읽기', () => {
  it('무리 넷을 숫자로 — at 이 없는 무리는 null, 이상한 숫자는 0', () => {
    const u = toDayUsage('2026-10-07', {
      db: { sentBytes: 100, storedBytes: 50, peakConnections: 3, at: 1 },
      functions: { calls: 7, byName: { roomStats: 5, idle: 0, bad: 'x' }, at: 2 },
      storage: { bucket: 'b', sentBytes: -1, at: 3 },
      hosting: { sentBytes: 9 },
    });
    expect(u.db).toEqual({ sentBytes: 100, storedBytes: 50, peakConnections: 3, at: 1 });
    expect(u.functions).toEqual({ calls: 7, byName: { roomStats: 5 }, at: 2 });
    expect(u.storage).toEqual({ sentBytes: 0, storedBytes: null, at: 3 });
    expect(u.hosting).toBeNull();
    expect(toDayUsage('2026-10-07', null)).toEqual({
      date: '2026-10-07',
      db: null,
      functions: null,
      storage: null,
      hosting: null,
    });
  });

  it('하루 = 날짜 노드 한 칸만 받는다 — metrics/usage 를 통째로 받지 않는다', async () => {
    const { db } = fakeDb({
      'metrics/usage/2026-10-07': { db: { sentBytes: 1, storedBytes: 2, peakConnections: 3, at: 4 } },
      'metrics/usage': { boom: '통째로 받으면 안 된다' },
    });
    const asked: string[] = [];
    const spy = { ...db, get: <T>(p: string) => (asked.push(p), db.get<T>(p)) };
    expect((await getDayUsage(spy, '2026-10-07')).db?.sentBytes).toBe(1);
    expect(asked).toEqual(['metrics/usage/2026-10-07']);
  });
});

describe('단위 · 금액', () => {
  it('최댓값에 맞춰 GB · MB · KB', () => {
    expect(byteUnit(3 * BYTES_PER_GB).unit).toBe('GB');
    expect(byteUnit(5 * 2 ** 20).unit).toBe('MB');
    expect(byteUnit(500).unit).toBe('KB');
    expect(byteUnit(0).unit).toBe('KB');
  });

  it('달러 — 소수 둘째 자리, 아주 작으면 «미만»', () => {
    expect(formatUsd(11.468)).toBe('$11.47');
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0.004)).toBe('$0.01 미만');
    expect(formatUsd(0)).toBe('$0');
  });
});

describe('일평균 · 오늘 환산 · 경고', () => {
  // 오래된 날 → 오늘. 지난날 셋은 10, 어제 50, 오늘 6시간 동안 15.
  const today = '2026-10-07';
  const sixAm = Date.parse('2026-10-06T21:00:00Z'); // 서울 10-07 06:00
  const days = [
    day('2026-10-02', 10),
    day('2026-10-03', null),
    day('2026-10-04', 10),
    day('2026-10-05', 10),
    day('2026-10-06', 50),
    day(today, 15, sixAm),
  ];

  it('평균은 오늘 · 어제와 기록 없는 날을 빼고, 최대는 오늘까지', () => {
    const s = usageStats(days, sent, sixAm);
    expect(s.avg).toBe(10);
    expect(s.avgDays).toBe(3);
    expect(s.max).toBe(50);
    expect(s.maxDate).toBe('2026-10-06');
  });

  it('오늘은 지난 시간 비례로 하루치 환산 — 6시간에 15 → 60', () => {
    expect(usageStats(days, sent, sixAm).todayProjected).toBe(60);
  });

  it('자정 뒤 2시간이 안 됐으면 환산하지 않는다(들쭉날쭉)', () => {
    const early = Date.parse('2026-10-06T16:00:00Z'); // 서울 01:00
    expect(usageStats(days, sent, early).todayProjected).toBeNull();
    expect(usageStats(days, sent, null).todayProjected).toBeNull();
  });

  it('평균의 2배를 넘으면 경고 — 오늘(환산 60) · 어제(50) 모두', () => {
    const s = usageStats(days, sent, sixAm);
    expect(overAverage(s.todayProjected, s)).toBe(true);
    expect(overAverage(50, s)).toBe(true);
    expect(overAverage(20, s)).toBe(false); // 딱 2배는 넘지 않음
    expect(overAverage(null, s)).toBe(false);
  });

  it('지난날 기록이 3일보다 적으면 경고하지 않는다', () => {
    const few = [day('2026-10-05', 10), day('2026-10-06', 90), day(today, 90, sixAm)];
    const s = usageStats(few, sent, sixAm);
    expect(s.avgDays).toBe(1);
    expect(overAverage(90, s)).toBe(false);
  });
});
