import { describe, expect, it } from 'vitest';
import { approveRequest, approveRequests } from '@/features/license/approve-request';
import { fakeDb } from '../shared/fakeDb';

const req = { id: 'r1', name: '테스터', friendCode: 'MATE-AB12', requestedAt: 1 };
const paths = (writes: { 1: string }[]) => writes.map((w) => w[1]);

describe('요청 승인', () => {
  it('키 생성 · 요청 승인 · 수령함 발송을 한 묶음으로 쓴다', async () => {
    const { db, writes } = fakeDb({ 'friendCodes/MATE-AB12': { userId: 'u1' } });
    expect(await approveRequest(db, req, () => 'KEY')).toEqual({ key: 'KEY', delivered: true });

    expect(writes.every(([op]) => op === 'commit')).toBe(true);
    expect(writes[0]).toEqual([
      'commit',
      'licenses/KEY',
      expect.objectContaining({ note: '요청: 테스터 · 친구코드 MATE-AB12' }),
    ]);
    expect(paths(writes).slice(1, 4)).toEqual([
      'licenseRequests/r1/status',
      'licenseRequests/r1/issuedKey',
      'licenseRequests/r1/approvedAt',
    ]);
    expect(writes[4][1]).toMatch(/^inbox\/u1\//);
    expect((writes[4][2] as { body: string }).body).toContain('KEY');
  });

  it('친구코드 주인이 없으면 수령함만 빼고 발급한다', async () => {
    const { db, writes } = fakeDb();
    expect(await approveRequest(db, req, () => 'KEY')).toEqual({ key: 'KEY', delivered: false });
    expect(paths(writes).some((p) => p.startsWith('inbox/'))).toBe(false);
  });

  it('묶음 중 하나라도 거부되면 키도 남지 않는다', async () => {
    const { db, writes } = fakeDb({ 'friendCodes/MATE-AB12': { userId: 'u1' } }, (p) =>
      p.startsWith('inbox/'),
    );
    await expect(approveRequest(db, req, () => 'KEY')).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});

describe('선택 발급', () => {
  it('하나가 실패해도 나머지는 발급하고 결과를 센다', async () => {
    const { db, writes } = fakeDb({ 'friendCodes/MATE-AB12': { userId: 'u1' } }, (p) =>
      p.startsWith('licenseRequests/r2/'),
    );
    const reqs = [req, { ...req, id: 'r2' }, { ...req, id: 'r3', friendCode: 'MATE-ZZZZ' }];
    let n = 0;
    expect(await approveRequests(db, reqs, () => `KEY${++n}`)).toEqual({
      issued: 2,
      failed: 1,
      notDelivered: 1,
    });
    expect(paths(writes).filter((p) => p.startsWith('licenses/'))).toEqual([
      'licenses/KEY1',
      'licenses/KEY3',
    ]);
  });
});
