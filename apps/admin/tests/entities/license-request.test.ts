import { describe, expect, it } from 'vitest';
import { pendingRequests } from '@/entities/license-request';

describe('대기 요청', () => {
  it('pending 만 오래된 순으로', () => {
    const list = pendingRequests({
      b: { name: 'B', status: 'pending', requestedAt: 2, friendCode: 'MATE-AAAA', ver: '0.10.3' },
      a: { name: 'A', status: 'pending', requestedAt: 1, friendCode: 'COZY-BBBB' },
      c: { name: 'C', status: 'approved', requestedAt: 0 },
    });
    expect(list.map((r) => r.id)).toEqual(['a', 'b']);
    expect(list[0].friendCode).toBe('COZY-BBBB');
    // 앱 버전 — 옛 앱 요청은 없다.
    expect(list.map((r) => r.ver)).toEqual([null, '0.10.3']);
  });
});
