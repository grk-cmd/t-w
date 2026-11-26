import { afterEach, describe, expect, it } from 'vitest';
import { actionLabel } from '@/entities/admin-log';
import {
  createServerStorageOwnersPort,
  DEFAULT_BACKFILL_MEMO,
  STORAGE_OWNERS_TIMEOUT_MS,
  storageOwnersReport,
  type StorageOwnersResult,
} from '@/features/settings/check-storage-owners';
import {
  ApiError,
  isPortError,
  resetPortState,
  type Api,
  type ApiGetOptions,
  type ApiParams,
  type ApiSendOptions,
} from '@/shared/api';

const READY: StorageOwnersResult = {
  users: 3,
  documents: 3,
  written: 0,
  missing: 0,
  orphans: 0,
  ready: true,
};

interface Call {
  method: string;
  path: string;
  body?: unknown;
  timeoutMs?: number;
}

/** 확인 · 채우기만 아는 가짜 서버 — 대기 시간까지 받아 둔다. */
function fakeServer(answer: (call: Call) => unknown) {
  const calls: Call[] = [];
  const api: Api = {
    baseUrl: 'https://api.test',
    async get<T>(path: string, _q?: ApiParams, o?: ApiGetOptions) {
      const call = { method: 'GET', path, timeoutMs: o?.timeoutMs };
      calls.push(call);
      return answer(call) as T;
    },
    async send<T>(method: string, path: string, o?: ApiSendOptions) {
      const call = { method, path, body: o?.body, timeoutMs: o?.timeoutMs };
      calls.push(call);
      return answer(call) as T;
    },
    async upload() {
      throw new Error('upload 안 씀');
    },
  };
  return { api, calls };
}

afterEach(() => resetPortState());

describe('Storage 주인 — API 판 포트', () => {
  it('확인은 GET /v2/admin/storage-owners — 120초 기다린다', async () => {
    const { api, calls } = fakeServer(() => READY);
    expect(await createServerStorageOwnersPort(api).check()).toEqual(READY);
    expect(calls).toEqual([
      { method: 'GET', path: '/v2/admin/storage-owners', timeoutMs: STORAGE_OWNERS_TIMEOUT_MS },
    ]);
    expect(STORAGE_OWNERS_TIMEOUT_MS).toBe(120_000);
  });

  it('채우기는 POST …/backfill { memo } — 앞뒤 공백을 떼고 120초 기다린다', async () => {
    const { api, calls } = fakeServer(() => ({ ...READY, written: 3 }));
    const r = await createServerStorageOwnersPort(api).backfill(`  ${DEFAULT_BACKFILL_MEMO} `);
    expect(r.written).toBe(3);
    expect(calls).toEqual([
      {
        method: 'POST',
        path: '/v2/admin/storage-owners/backfill',
        body: { memo: '규칙 올리기 전' },
        timeoutMs: STORAGE_OWNERS_TIMEOUT_MS,
      },
    ]);
  });

  it('답 모양이 틀리면(칸 빠짐 · ready 가 글자) 실패 — 숫자를 짐작하지 않는다', async () => {
    for (const bad of [{ ...READY, missing: undefined }, { ...READY, ready: 'true' }, null]) {
      const { api } = fakeServer(() => bad);
      await expect(createServerStorageOwnersPort(api).check()).rejects.toThrow();
      resetPortState();
    }
  });

  it('서버 오류는 포트 실패로 — 권한 · 닿지 못함을 가른다', async () => {
    const denied = fakeServer(() => {
      throw new ApiError('auth', 403, 'ACCESS_DENIED', '');
    });
    const e1 = await createServerStorageOwnersPort(denied.api)
      .backfill('메모')
      .catch((e: unknown) => e);
    expect(isPortError(e1, 'denied')).toBe(true);
    resetPortState();
    const slow = fakeServer(() => {
      throw new ApiError('unavailable', 0, '', 'API 응답이 늦어요');
    });
    const e2 = await createServerStorageOwnersPort(slow.api)
      .check()
      .catch((e: unknown) => e);
    expect(isPortError(e2, 'unreachable')).toBe(true);
  });

  it('API 주소가 없으면 부르지 않고 실패', async () => {
    await expect(createServerStorageOwnersPort(null).check()).rejects.toSatisfy((e) =>
      isPortError(e, 'unreachable'),
    );
  });
});

describe('Storage 주인 — 결과 글', () => {
  it('ready 면 «✓ ready — 규칙을 올려도 돼요»', () => {
    const lines = storageOwnersReport(READY);
    expect(lines[0]).toBe('계정 3 · 문서 3 · 이번에 쓴 것 0 · 빠진 계정 0 · DB 에 없는 문서 0');
    expect(lines[1]).toContain('✓ ready — 규칙을 올려도 돼요');
    expect(lines).toHaveLength(2);
  });

  it('빠진 계정이 있으면 몇 명인지 · 채우기를 다시', () => {
    const lines = storageOwnersReport({ ...READY, documents: 1, missing: 2, ready: false });
    expect(lines[1]).toBe('✗ 아직 안 돼요 — 빠진 계정 2 명(채우기를 다시)');
  });

  it('빠진 계정은 0 인데 수가 다르면 두 수를 보인다', () => {
    const lines = storageOwnersReport({ ...READY, users: 4, ready: false });
    expect(lines[1]).toBe('✗ 아직 안 돼요 — 계정 수와 문서 수가 달라요(4 ≠ 3)');
  });

  it('DB 에 없는 문서는 ready 를 막지 않고 «규칙에는 영향이 없어요» 를 덧붙인다', () => {
    const lines = storageOwnersReport({ ...READY, documents: 5, orphans: 2 });
    expect(lines[1]).toContain('✓ ready');
    expect(lines[2]).toContain('DB 에 없는 문서 2 개');
    expect(lines[2]).toContain('규칙에는 영향이 없어요');
  });
});

describe('작업 기록', () => {
  it('서버가 남기는 채우기 기록에 이름표가 있다', () => {
    expect(actionLabel('user.storageBackfill')).toBe('Storage 주인 채우기');
  });
});
