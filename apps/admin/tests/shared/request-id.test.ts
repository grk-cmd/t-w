import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { createPendingRequestId, newRequestId, REQUEST_ID_PATTERN, sendWithRequestId } from '@/shared/lib';

function counter() {
  let n = 0;
  return () => `req-${String(++n).padStart(4, '0')}`;
}

describe('요청 번호', () => {
  it('서버가 받는 모양(8~64 글자 · 영문 · 숫자 · - _)', () => {
    expect(newRequestId()).toMatch(REQUEST_ID_PATTERN);
    expect(newRequestId()).not.toBe(newRequestId());
  });

  it('처음 보낼 때 하나 만들고 settle 전까지 같은 번호', () => {
    const pending = createPendingRequestId(counter());
    expect(pending.take()).toBe('req-0001');
    expect(pending.take()).toBe('req-0001');
    pending.settle();
    expect(pending.take()).toBe('req-0002');
  });

  it('성공하면 버린다 — 다음 쓰기는 새 번호', async () => {
    const pending = createPendingRequestId(counter());
    const sent: string[] = [];
    await sendWithRequestId(pending, async (id) => void sent.push(id));
    await sendWithRequestId(pending, async (id) => void sent.push(id));
    expect(sent).toEqual(['req-0001', 'req-0002']);
  });

  it('서버가 거절해도(4xx) 버린다', async () => {
    const pending = createPendingRequestId(counter());
    const reject = async () => {
      throw new ApiError('request', 400, 'INVALID_REQUEST', '틀림');
    };
    await expect(sendWithRequestId(pending, reject)).rejects.toThrow('틀림');
    expect(pending.take()).toBe('req-0002');
  });

  it('닿지 못했으면(네트워크 · 5xx) 남긴다 — 다시 누르면 같은 번호', async () => {
    const pending = createPendingRequestId(counter());
    const down = async () => {
      throw new ApiError('unavailable', 0, '', '연결 안 됨');
    };
    await expect(sendWithRequestId(pending, down)).rejects.toThrow('연결 안 됨');
    const sent: string[] = [];
    await sendWithRequestId(pending, async (id) => void sent.push(id));
    expect(sent).toEqual(['req-0001']);
  });
});
