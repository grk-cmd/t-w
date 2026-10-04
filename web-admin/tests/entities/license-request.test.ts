import { describe, expect, it } from 'vitest';
import { pendingRequests } from '@/entities/license-request';

describe('대기 요청', () => {
  it('pending 만 오래된 순으로', () => {
    const list = pendingRequests({
      b: { name: 'B', status: 'pending', requestedAt: 2, friendCode: 'MATE-AAAA' },
      a: { name: 'A', status: 'pending', requestedAt: 1, friendCode: 'COZY-BBBB' },
      c: { name: 'C', status: 'approved', requestedAt: 0 },
    });
    expect(list.map((r) => r.id)).toEqual(['a', 'b']);
    expect(list[0].friendCode).toBe('COZY-BBBB');
  });
});
