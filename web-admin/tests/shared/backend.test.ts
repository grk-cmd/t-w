import { describe, expect, it, vi } from 'vitest';
import { perApi, pickBackend, resetPortState, toPortError } from '@/shared/api';
import type { Api } from '@/shared/api';
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

  it('실패 봉투의 items 를 그대로 싣는다', () => {
    const items = [{ secretRoomId: 'r1' }];
    expect(toPortError(new ApiError('request', 409, 'LICENSE_SECRET_ROOM_CODE_TAKEN', '', items)).items).toBe(
      items,
    );
    expect(toPortError(new ApiError('request', 400, 'X', '')).items).toBeNull();
  });
});

describe('perApi — 로그아웃하면 포트 상태를 버린다', () => {
  const api = {} as Api;

  it('같은 api 에는 포트 하나, resetPortState 뒤에는 새 포트(받아 둔 상태 · 보낸 요청 번호가 이어지지 않는다)', () => {
    const make = perApi((a) => ({ a, state: [] as string[] }));
    const first = make(api);
    first.state.push('이전 계정이 본 것');
    expect(make(api)).toBe(first);
    expect(make(null)).toBe(make(null));
    resetPortState();
    const second = make(api);
    expect(second).not.toBe(first);
    expect(second.state).toEqual([]);
  });
});
