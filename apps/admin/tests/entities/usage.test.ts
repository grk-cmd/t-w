import { describe, expect, it } from 'vitest';
import {
  byteUnit,
  BYTES_PER_GB,
  formatUsd,
  getDayUsage,
  monthEstimate,
  overAverage,
  toDayUsage,
  usageDayCount,
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
    expect(formatUsd(11.468)).toBe('$11.47 (약 1.6만 원)');
    expect(formatUsd(1234.5)).toBe('$1,234.50 (약 173만 원)');
    expect(formatUsd(316.05)).toBe('$316.05 (약 44.2만 원)');
    expect(formatUsd(1)).toBe('$1.00 (약 1,400원)');
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

describe('이번 달 예상 청구액 — 서울 달력 1일 0시부터', () => {
  const G = 2 ** 30;
  // 서울 정오(그날 12:00) — 오늘이 반나절 지났다
  const noon = (date: string) => Date.parse(`${date}T03:00:00Z`);
  const d = (date: string, dbGB: number | null, at = 1, calls = 0): DayUsage => ({
    date,
    db: dbGB === null ? null : { sentBytes: dbGB * G, storedBytes: 2 * G, peakConnections: 0, at },
    functions: dbGB === null ? null : { calls, byName: {}, at },
    storage: null,
    hosting: null,
  });
  const dbLine = (est: NonNullable<ReturnType<typeof monthEstimate>>) =>
    est.lines.find((l) => l.label === 'DB 다운로드')!;

  it('지난달 값은 섞지 않는다 — 1일부터 지금까지 실제를 한 달로 늘림(오늘은 지난 시간만큼)', () => {
    // 9월 말 하루 30GB, 10월은 하루 10GB. 오늘 10-03 정오까지 5GB.
    // 예전 방식(지난날 + 남은 날 × 최근 7일 평균 — 9월 다섯 날이 섞임)은 20 + 29 × 24.3 ≈ 724GB → $714 였다.
    const est = monthEstimate([
      d('2026-09-26', 30),
      d('2026-09-27', 30),
      d('2026-09-28', 30),
      d('2026-09-29', 30),
      d('2026-09-30', 30),
      d('2026-10-01', 10),
      d('2026-10-02', 10),
      d('2026-10-03', 5, noon('2026-10-03')),
    ])!;
    expect(est.month).toBe('2026-10');
    expect(est.monthDays).toBe(31);
    expect(est.since).toBe('2026-10-01');
    expect(est.fullMonth).toBe(true);
    expect(est.coveredDays).toBeCloseTo(2.5, 5);
    // 지금까지 25GB → 무료 10GB 빼고 $15 · 월말 25 ÷ 2.5 × 31 = 310GB → $300
    expect(dbLine(est).toDateUsd).toBeCloseTo(15, 5);
    expect(dbLine(est).usd).toBeCloseTo(300, 5);
    // DB 저장 2GB − 무료 1GB = $5/월, 지금까지는 2.5/31 만큼
    const stored = est.lines.find((l) => l.label === 'DB 저장')!;
    expect(stored.usd).toBeCloseTo(5, 5);
    expect(stored.toDateUsd).toBeCloseTo((5 * 2.5) / 31, 5);
    expect(est.total).toBeCloseTo(305, 5);
    expect(est.toDate).toBeCloseTo(15 + (5 * 2.5) / 31, 5);
  });

  it('달 중간부터 기록이면 있는 날로만 추정하고 표시한다 — 빈 날을 지난달 평균으로 채우지 않음', () => {
    // 함수가 10-05 에 배포 — 10-01~04 칸은 비어 있다
    const est = monthEstimate([
      d('2026-09-30', 50),
      d('2026-10-01', null),
      d('2026-10-02', null),
      d('2026-10-03', null),
      d('2026-10-04', null),
      d('2026-10-05', 10),
      d('2026-10-06', 10),
      d('2026-10-07', 10),
      d('2026-10-08', 10),
      d('2026-10-09', 5, noon('2026-10-09')),
    ])!;
    expect(est.since).toBe('2026-10-05');
    expect(est.fullMonth).toBe(false);
    expect(est.coveredDays).toBeCloseTo(4.5, 5);
    expect(dbLine(est).toDateAmount).toBe('약 45GB');
    expect(dbLine(est).amount).toBe('약 310GB'); // 45 ÷ 4.5 × 31
    expect(dbLine(est).usd).toBeCloseTo(300, 5);
  });

  it('무료 한도는 달 합계에서 한 번 — 함수 호출', () => {
    // 10-02 정오: 1일 100만 + 오늘 50만 = 150만 → 무료 안, 월말 150만 ÷ 1.5 × 31 = 3,100만 → (3,100만 − 200만) × $0.4/100만
    const est = monthEstimate([
      d('2026-10-01', 0, 1, 1_000_000),
      d('2026-10-02', 0, noon('2026-10-02'), 500_000),
    ])!;
    const fn = est.lines.find((l) => l.label === '함수 호출')!;
    expect(fn.toDateUsd).toBe(0);
    expect(fn.usd).toBeCloseTo(29 * 0.4, 5);
  });

  it('1일 자정 직후(2시간 미만)는 월말 예상 보류, 지금까지 실제만', () => {
    const est = monthEstimate([d('2026-09-30', 30), d('2026-10-01', 1, Date.parse('2026-09-30T16:00:00Z'))])!;
    expect(est.coveredDays).toBeCloseTo(1 / 24, 5);
    expect(est.total).toBeNull();
    expect(est.toDate).toBeGreaterThanOrEqual(0);
  });

  it('이번 달 기록이 없으면 since 는 null', () => {
    const est = monthEstimate([d('2026-09-30', 30), d('2026-10-01', null)])!;
    expect(est.since).toBeNull();
    expect(est.fullMonth).toBe(false);
    expect(est.total).toBeNull();
  });

  it('비어 있으면 null', () => {
    expect(monthEstimate([])).toBeNull();
  });

  it('31일 달의 31일엔 1일까지 받도록 31일치를 받는다', () => {
    expect(usageDayCount(Date.parse('2026-10-31T03:00:00Z'))).toBe(31);
    expect(usageDayCount(Date.parse('2026-10-09T03:00:00Z'))).toBe(30);
  });
});
