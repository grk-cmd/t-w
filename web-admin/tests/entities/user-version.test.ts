import { describe, expect, it } from 'vitest';
import {
  buildUserRows,
  compareVerDesc,
  matchesVer,
  OLD_VER_LABEL,
  verLabel,
  versionCounts,
} from '@/entities/user';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 6);

const rows = buildUserRows(
  {
    a: { name: 'A', ts: NOW - DAY, ver: '0.10.3' },
    b: { name: 'B', ts: NOW - 2 * DAY, ver: '0.10.3' },
    c: { name: 'C', ts: NOW - DAY, ver: '0.10.10' },
    d: { name: 'D', ts: NOW - DAY }, // 옛 앱 — 버전 기록 없음
    e: { name: 'E', ts: NOW - 8 * DAY, ver: '0.10.4' }, // 7일 넘음 — 세지 않는다
    f: { name: 'F', ts: NOW - DAY, ver: '0.10.4-beta.1' },
    g: { name: 'G', ts: NOW - DAY, ver: 'x'.repeat(21) }, // 규칙 밖 값 — 없는 것으로
  },
  { 'MATE-ZZZZ': { userId: 'z' } }, // 계정 없는 사람 — 버전을 알 수 없다
  {},
);

describe('사용자 버전', () => {
  it('계정 요약의 ver 를 그대로, 없거나 이상하면 null', () => {
    const ver = Object.fromEntries(rows.map((r) => [r.userCode, r.ver]));
    expect(ver).toMatchObject({ a: '0.10.3', d: null, g: null, z: null });
  });

  it('표시 — 계정은 있는데 버전이 없으면 «0.10.2 이하», 계정이 없으면 —', () => {
    const by = (id: string) => rows.find((r) => r.userCode === id)!;
    expect(verLabel(by('a'))).toBe('0.10.3');
    expect(verLabel(by('d'))).toBe(OLD_VER_LABEL);
    expect(OLD_VER_LABEL).toBe('0.10.2 이하');
    expect(verLabel(by('z'))).toBe('—');
  });

  it('버전 비교 — 숫자 자리로, 정식판이 베타보다 크다', () => {
    const sorted = ['0.9.9', '0.10.3', '0.10.10', '0.10.4-beta.1', '0.10.4', '0.10.4-beta.2'].sort(
      compareVerDesc,
    );
    expect(sorted).toEqual(['0.10.10', '0.10.4', '0.10.4-beta.2', '0.10.4-beta.1', '0.10.3', '0.9.9']);
  });

  it('최근 7일 접속한 계정만 버전별로 — 큰 버전부터, 기록 없음은 맨 뒤', () => {
    const counts = versionCounts(rows, NOW);
    expect(counts.map((c) => [c.ver, c.count])).toEqual([
      ['0.10.10', 1],
      ['0.10.4-beta.1', 1],
      ['0.10.3', 2],
      [null, 2], // d(옛 앱) + g(이상한 값)
    ]);
    expect(counts.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
    expect(counts.find((c) => c.ver === '0.10.3')?.share).toBeCloseTo(2 / 6);
  });

  it('아무도 없으면 빈 목록', () => {
    expect(versionCounts([], NOW)).toEqual([]);
  });

  it('버전으로 좁히기 — null 은 기록 없는 계정만(계정 없는 사람은 빠진다)', () => {
    expect(rows.filter((r) => matchesVer(r, '0.10.3')).map((r) => r.userCode)).toEqual(['a', 'b']);
    expect(
      rows
        .filter((r) => matchesVer(r, null))
        .map((r) => r.userCode)
        .sort(),
    ).toEqual(['d', 'g']);
  });
});
