import { describe, expect, it, vi } from 'vitest';
import { notPorted, pickBackend, PortError, toPortError } from '@/shared/api';
import { ApiError } from '@/shared/api';
import { BACKENDS, parseBackend } from '@/shared/config';

describe('VITE_ADMIN_BACKEND', () => {
  it('firebase · api 만 받고, 없거나 다른 글자면 던진다 — 기본값을 두지 않는다', () => {
    expect(parseBackend('firebase')).toBe('firebase');
    expect(parseBackend('api')).toBe('api');
    for (const bad of [undefined, '', 'API', 'server', 'firebase ', null]) {
      expect(() => parseBackend(bad)).toThrow(/VITE_ADMIN_BACKEND/);
    }
  });
});

describe('pickBackend', () => {
  it('그 판의 것만 만든다 — 다른 판 공장은 부르지 않는다', () => {
    for (const backend of BACKENDS) {
      const made = { firebase: vi.fn(() => 'F'), api: vi.fn(() => 'A') };
      const got = pickBackend(made, backend);
      expect(got).toBe(backend === 'api' ? 'A' : 'F');
      expect(made[backend]).toHaveBeenCalledTimes(1);
      expect(made[backend === 'api' ? 'firebase' : 'api']).not.toHaveBeenCalled();
    }
  });
});

describe('notPorted', () => {
  it('만들 때는 던지지 않고, 어떤 일이든 부르면 PortError', () => {
    const port = notPorted<{ list(): Promise<string[]> }>('license');
    expect(() => port.list()).toThrow(PortError);
    expect(() => port.list()).toThrow(/아직 API 판이 없어요 \(license\)/);
  });

  it('await 해도 then 으로 오해받지 않는다', async () => {
    const port = notPorted<object>('x');
    await expect(Promise.resolve(port)).resolves.toBe(port);
  });
});

describe('toPortError', () => {
  it('서버 오류를 포트 실패 다섯 갈래로 옮긴다', () => {
    const kind = (e: ApiError) => toPortError(e).kind;
    expect(kind(new ApiError('auth', 403, 'ACCESS_DENIED', ''))).toBe('denied');
    expect(kind(new ApiError('notFound', 404, 'BUG_NOT_FOUND', ''))).toBe('notFound');
    expect(kind(new ApiError('request', 409, 'CONCURRENT_UPDATE', ''))).toBe('conflict');
    expect(kind(new ApiError('request', 400, 'OPS_INVALID_VALUE', ''))).toBe('invalid');
    expect(kind(new ApiError('unavailable', 502, '', ''))).toBe('unreachable');
    expect(kind(new ApiError('notReady', 501, '', ''))).toBe('unreachable');
    expect(toPortError(new TypeError('x')).kind).toBe('unreachable');
    const known = toPortError(new ApiError('request', 409, 'CONCURRENT_UPDATE', ''));
    expect(known.code).toBe('CONCURRENT_UPDATE');
  });
});
