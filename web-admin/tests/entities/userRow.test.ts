import { describe, expect, it } from 'vitest';
import { buildUserRows, licenseUseCounts, realName } from '@/entities/user';

import { accounts, friendCodes, licenses } from '../shared/userFixtures';

describe('사용자 한 줄', () => {
  const rows = buildUserRows(accounts, friendCodes, licenses);

  it('계정 + 친구코드 명단을 사용자코드로 합치고 최근 순으로', () => {
    expect(rows.map((r) => r.userCode)).toEqual(['u1', 'u2', 'u3', 'u4', 'u9']);
    expect(rows.find((r) => r.userCode === 'u9')).toMatchObject({
      hasAccount: false,
      friendCode: 'COZY-DDDD',
    });
  });

  it('쓰는 키의 상태를 발급 목록과 맞춰 본다', () => {
    const state = Object.fromEntries(rows.map((r) => [r.userCode, r.licenseState]));
    expect(state).toEqual({ u1: 'used', u2: 'revoked', u3: 'none', u4: 'unknown', u9: 'none' });
  });

  it('앱의 기본값 «(이름 없음)» 은 이름이 없는 것으로 본다', () => {
    expect(rows.find((r) => r.userCode === 'u3')?.name).toBeNull();
    expect(realName('  ')).toBeNull();
    expect(realName('가나')).toBe('가나');
  });
});

describe('키별 사용자 수', () => {
  it('정규화한 키로 세고, 키 없는 사람 · 계정 없는 사람은 빠진다', () => {
    const rows = buildUserRows(
      {
        ...accounts,
        u5: { name: '자차', license: ' key-1 ', ts: 1 },
        u6: { name: '카타', license: 'KEY-1', ts: 0 },
      },
      friendCodes,
      licenses,
    );
    expect(licenseUseCounts(rows)).toEqual(
      new Map([
        ['KEY-1', 3],
        ['KEY-2', 1],
        ['GONE', 1],
      ]),
    );
    expect(licenseUseCounts([])).toEqual(new Map());
  });
});
