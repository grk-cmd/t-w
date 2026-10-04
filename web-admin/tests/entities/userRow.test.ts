import { describe, expect, it } from 'vitest';
import { buildUserRows, realName } from '@/entities/user';

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
