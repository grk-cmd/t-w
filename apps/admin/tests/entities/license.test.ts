import { describe, expect, it } from 'vitest';
import { createLicense, filterLicenses, genLicenseKey, licenseStatus } from '@/entities/license';
import { ADMIN_UID, auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

describe('라이선스 키', () => {
  it('4자리씩 네 덩어리, 헷갈리는 글자 없음', () => {
    expect(genLicenseKey()).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/);
  });

  it('상태: 회수 · 사용됨 · 미사용', () => {
    expect(licenseStatus({ valid: false })).toBe('revoked');
    expect(licenseStatus({ valid: true, redeemedAt: 5 })).toBe('used');
    expect(licenseStatus({ valid: true, redeemedAt: null })).toBe('unused');
  });

  it('검색은 키 · 메모, 정렬은 최근 발급부터', () => {
    const all = {
      'AAAA-1': { valid: true, note: '철수', createdAt: 1 },
      'BBBB-2': { valid: true, createdAt: 2 },
    };
    expect(filterLicenses(all, '').map(([k]) => k)).toEqual(['BBBB-2', 'AAAA-1']);
    expect(filterLicenses(all, '철수').map(([k]) => k)).toEqual(['AAAA-1']);
  });

  it('발급은 앱이 검증하는 모양으로 쓴다', async () => {
    const { db, writes } = fakeDb();
    await createLicense(db, '메모', () => 'KEY');
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'licenses/KEY', { valid: true, note: '메모', createdAt: NOW, redeemedAt: null }],
    ]);
    // 같은 묶음에 기록 한 줄 — 키 원문은 남기지 않는다.
    expect(auditsOf(writes)).toEqual([{ at: NOW, by: ADMIN_UID, action: 'license.issue', target: 'KEY' }]);
  });
});
