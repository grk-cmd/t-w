import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_GB,
  changePct,
  deleteImprovement,
  fromKstInput,
  getImprovements,
  improvementResult,
  improvementWindows,
  mbPerConnOf,
  PRICES,
  saveImprovement,
  toImprovements,
  toKstInput,
  windowStat,
  type DayUsage,
} from '@/entities/metrics/usage';
import { auditsOf, fakeDb, withoutAudits } from '../shared/fakeDb';

// 0.10.2 — 2026-10-05 17:44(서울)
const RELEASED = Date.parse('2026-10-05T17:44:00+09:00');
const entry = { releasedAt: RELEASED, adoptDays: 3 };

const day = (date: string, gb: number, peak: number): DayUsage => ({
  date,
  db: { sentBytes: gb * BYTES_PER_GB, storedBytes: null, peakConnections: peak, at: 0 },
  functions: null,
  storage: null,
  hosting: null,
});
const mapOf = (days: DayUsage[]) => new Map(days.map((d) => [d.date, d]));
const range = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
  );

describe('견줄 날짜', () => {
  it('전 = 릴리스 날 앞 7일(릴리스 날 빼고), 후 = 릴리스 + 적용 기간이 든 날부터 7일', () => {
    const w = improvementWindows(entry);
    expect(w.before).toEqual(range('2026-09-28', 7));
    expect(w.after).toEqual(range('2026-10-08', 7));
  });

  it('서울 날짜로 — 릴리스가 UTC 로는 전날이어도(서울 새벽 1시)', () => {
    const w = improvementWindows({ releasedAt: Date.parse('2026-10-05T01:00:00+09:00'), adoptDays: 0 });
    expect(w.before.at(-1)).toBe('2026-10-04');
    expect(w.after[0]).toBe('2026-10-05');
  });

  it('릴리스 시각 입력칸은 서울 시각으로 읽고 쓴다', () => {
    expect(fromKstInput('2026-10-05T17:44')).toBe(RELEASED);
    expect(toKstInput(RELEASED)).toBe('2026-10-05T17:44');
    expect(fromKstInput('2026-10-05')).toBeNull();
    expect(fromKstInput('어제')).toBeNull();
  });
});

describe('구간 평균', () => {
  it('하루 GB · 접속당 MB(날마다 나눈 뒤 평균) · 최대 동시 접속 평균', () => {
    const s = windowStat(
      ['2026-10-01', '2026-10-02'],
      mapOf([day('2026-10-01', 10, 2048), day('2026-10-02', 20, 1024)]),
      '2026-10-09',
    );
    expect(s.days).toBe(2);
    expect(s.gbPerDay).toBe(15);
    // 10GB/2048 = 5MB · 20GB/1024 = 20MB → 평균 12.5MB (합 ÷ 합이 아니다)
    expect(s.mbPerConn).toBe(12.5);
    expect(s.peakAvg).toBe(1536);
  });

  it('기록 없는 날 · 오늘 · 아직 안 온 날은 뺀다', () => {
    const s = windowStat(
      range('2026-10-06', 5),
      mapOf([
        day('2026-10-06', 10, 100),
        { ...day('2026-10-07', 0, 0), db: null },
        day('2026-10-08', 30, 100),
        day('2026-10-09', 99, 100), // 오늘 — 덜 찬 날
      ]),
      '2026-10-09',
    );
    expect(s.days).toBe(2);
    expect(s.gbPerDay).toBe(20);
  });

  it('최대 동시 접속이 0 인 날은 접속당에서만 뺀다', () => {
    const s = windowStat(['a', 'b'], mapOf([day('a', 10, 0), day('b', 10, 1024)]), 'z');
    expect(s.gbPerDay).toBe(10);
    expect(s.mbPerConn).toBe(10);
    expect(mbPerConnOf(day('a', 10, 0))).toBeNull();
    expect(mbPerConnOf(undefined)).toBeNull();
  });

  it('기록이 하나도 없으면 null', () => {
    expect(windowStat(['a'], new Map(), 'z')).toEqual({
      days: 0,
      gbPerDay: null,
      mbPerConn: null,
      peakAvg: null,
    });
  });
});

describe('전 · 후 견주기 — 0.10.2 실측과 비슷한 값', () => {
  const before = range('2026-09-28', 7).map((d) => day(d, 15.1, 3091));
  const after = range('2026-10-08', 7).map((d) => day(d, 11, 3100));

  it('7일씩 다 있으면 변화율 · 한 달 절감 추정', () => {
    const r = improvementResult(entry, mapOf([...before, ...after]), '2026-10-20', PRICES.dbDownloadPerGB);
    expect(r.measuring).toBe(false);
    expect(r.before.gbPerDay).toBeCloseTo(15.1);
    expect(r.after.gbPerDay).toBeCloseTo(11);
    expect(r.before.mbPerConn).toBeCloseTo((15.1 * 1024) / 3091);
    expect(r.gbChangePct).toBeCloseTo(-27.15, 1);
    // (15.1 − 11) × 30일 × $1/GB
    expect(r.monthlySavingUsd).toBeCloseTo(123);
  });

  it('후가 7일 안 찼으면 측정 중 — 있는 날(10-08 · 09)만으로', () => {
    const r = improvementResult(entry, mapOf([...before, ...after]), '2026-10-10', PRICES.dbDownloadPerGB);
    expect(r.measuring).toBe(true);
    expect(r.after.days).toBe(2);
    expect(r.after.gbPerDay).toBeCloseTo(11);
  });

  it('후 기록이 없으면 절감 추정 보류(null)', () => {
    const r = improvementResult(entry, mapOf(before), '2026-10-08', PRICES.dbDownloadPerGB);
    expect(r.after.days).toBe(0);
    expect(r.monthlySavingUsd).toBeNull();
    expect(r.gbChangePct).toBeNull();
  });

  it('늘었으면 절감이 음수', () => {
    const more = range('2026-10-08', 7).map((d) => day(d, 20, 3100));
    const r = improvementResult(entry, mapOf([...before, ...more]), '2026-10-20', 1);
    expect(r.monthlySavingUsd).toBeLessThan(0);
    expect(changePct(10, 12)).toBeCloseTo(20);
    expect(changePct(0, 12)).toBeNull();
  });
});

describe('기록 읽기 · 쓰기', () => {
  const draft = {
    version: ' 0.10.2 ',
    releasedAt: RELEASED,
    title: '0.10.2 — DB 다운로드 줄이기',
    items: ['방 개수 표시', '  ', '규칙 잠금'],
    adoptDays: 3,
  };

  it('최근 릴리스부터 · 모양이 틀린 칸은 빼고 · items 는 {0:…} 모양도 · 적용 기간 없으면 3일', async () => {
    const { db } = fakeDb({
      'metrics/improvements': {
        a: { version: '0.10.1', releasedAt: 1, title: 'A', items: ['x'] },
        b: { version: '0.10.2', releasedAt: 2, title: 'B', items: { 0: 'y', 1: 'z' }, adoptDays: 5 },
        bad: { version: '', releasedAt: 3, title: 'C', items: [] },
      },
    });
    const list = await getImprovements(db);
    expect(list.map((e) => e.id)).toEqual(['b', 'a']);
    expect(list[0].items).toEqual(['y', 'z']);
    expect(list[1].adoptDays).toBe(3);
    expect(toImprovements(null)).toEqual([]);
  });

  it('추가 — 한 칸 통째로 · 공백 걷기 · 작업 기록 improvements.add 와 한 묶음', async () => {
    const { db, writes } = fakeDb();
    const id = await saveImprovement(db, draft, undefined, () => 'i1');
    expect(id).toBe('i1');
    expect(withoutAudits(writes)).toEqual([
      [
        'commit',
        'metrics/improvements/i1',
        { ...draft, version: '0.10.2', items: ['방 개수 표시', '규칙 잠금'] },
      ],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['improvements.add', '0.10.2', '0.10.2 — DB 다운로드 줄이기'],
    ]);
  });

  it('수정 · 삭제도 작업 기록과 함께', async () => {
    const { db, writes } = fakeDb();
    await saveImprovement(db, draft, 'i1');
    await deleteImprovement(db, { ...draft, id: 'i1' });
    expect(auditsOf(writes).map((a) => a.action)).toEqual(['improvements.edit', 'improvements.delete']);
    expect(withoutAudits(writes).at(-1)).toEqual(['commit', 'metrics/improvements/i1', null]);
  });

  it('규칙이 받지 않을 값이면 쓰지 않는다', async () => {
    const { db, writes } = fakeDb();
    await expect(saveImprovement(db, { ...draft, items: [] })).rejects.toThrow('바뀐 것');
    await expect(saveImprovement(db, { ...draft, items: Array(21).fill('x') })).rejects.toThrow('20개');
    await expect(saveImprovement(db, { ...draft, title: 'x'.repeat(81) })).rejects.toThrow('제목');
    await expect(saveImprovement(db, { ...draft, adoptDays: 31 })).rejects.toThrow('적용 기간');
    expect(writes).toEqual([]);
  });
});
