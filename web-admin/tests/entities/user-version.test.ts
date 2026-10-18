import { describe, expect, it } from 'vitest';
import {
  buildUserRows,
  compareVerDesc,
  currentVer,
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

  it('presence 를 못 받으면 계정 요약 — 계정은 있는데 버전이 없으면 «0.10.2 이하», 계정이 없으면 —', () => {
    const by = (id: string) => rows.find((r) => r.userCode === id)!;
    expect(verLabel(currentVer(null, by('a')))).toBe('0.10.3');
    expect(verLabel(currentVer(null, by('d')))).toBe(OLD_VER_LABEL);
    expect(OLD_VER_LABEL).toBe('0.10.2 이하');
    expect(verLabel(currentVer(null, by('z')))).toBe('—');
  });

  it('presence 가 있으면 그것만 — 계정 요약에 남은 옛 값은 안 본다', () => {
    const by = (id: string) => rows.find((r) => r.userCode === id)!;
    // 요약은 비었는데(로그인 기기가 다시 안 올림) 지금 앱은 0.11.3
    expect(currentVer({ ver: '0.11.3' }, by('d'))).toEqual({ ver: '0.11.3', old: false });
    // 요약엔 0.10.3 이 남았는데 지금 켠 앱은 버전을 안 남기는 옛 앱
    expect(currentVer({ ver: null }, by('a'))).toEqual({ ver: null, old: true });
    // 계정이 없어도 presence 로 안다
    expect(verLabel(currentVer({ ver: '0.11.0' }, by('z')))).toBe('0.11.0');
    expect(verLabel(currentVer({ ver: null }, by('z')))).toBe(OLD_VER_LABEL);
  });

  it('버전 비교 — 숫자 자리로, 정식판이 베타보다 크다', () => {
    const sorted = ['0.9.9', '0.10.3', '0.10.10', '0.10.4-beta.1', '0.10.4', '0.10.4-beta.2'].sort(
      compareVerDesc,
    );
    expect(sorted).toEqual(['0.10.10', '0.10.4', '0.10.4-beta.2', '0.10.4-beta.1', '0.10.3', '0.9.9']);
  });

  it('계정마다 가장 최근 값으로 버전별로(기간 없음) — 큰 버전부터, 기록 없음은 맨 뒤', () => {
    const counts = versionCounts(rows);
    expect(counts.map((c) => [c.ver, c.count])).toEqual([
      ['0.10.10', 1],
      ['0.10.4', 1], // e — 8일 전이어도 센다
      ['0.10.4-beta.1', 1],
      ['0.10.3', 2],
      [null, 2], // d(옛 앱) + g(이상한 값)
    ]);
    expect(counts.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
    expect(counts.find((c) => c.ver === '0.10.3')?.share).toBeCloseTo(2 / 7);
  });

  it('아무도 없으면 빈 목록', () => {
    expect(versionCounts([])).toEqual([]);
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
