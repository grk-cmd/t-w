import type { Db } from '@/shared/api';

export const NOW = { '.sv': 'timestamp' };
export const ADMIN_UID = 'admin-uid';

export type Write = [
  op: 'set' | 'update' | 'remove' | 'commit' | 'transaction',
  path: string,
  value?: unknown,
];

// 경로 → 값 지도로 흉내 낸 Db. 쓴 것은 writes 에 순서대로 남는다. failOn 이 참인 경로의 쓰기는 실패한다.
export function fakeDb(data: Record<string, unknown> = {}, failOn: (path: string) => boolean = () => false) {
  const writes: Write[] = [];
  const write = async (op: Write[0], path: string, value?: unknown) => {
    if (failOn(path)) throw new Error('write failed');
    writes.push([op, path, value]);
  };
  const db: Db = {
    get: async <T>(path: string) => (data[path] ?? null) as T | null,
    getLast: async <T>(path: string, child: string, n: number) => {
      const all = Object.entries((data[path] ?? {}) as Record<string, Record<string, unknown>>);
      all.sort(([, a], [, b]) => Number(a?.[child] ?? 0) - Number(b?.[child] ?? 0));
      return Object.fromEntries(all.slice(-n)) as Record<string, T>;
    },
    getEqual: async <T>(path: string, child: string, value: unknown) => {
      const all = Object.entries((data[path] ?? {}) as Record<string, Record<string, unknown>>);
      return Object.fromEntries(all.filter(([, v]) => v?.[child] === value)) as Record<string, T>;
    },
    set: (path, value) => write('set', path, value),
    update: (path, value) => write('update', path, value),
    remove: (path) => write('remove', path),
    // 끼어드는 쓰기가 없는 한 번짜리 — 쓴 값은 data 에도 남겨 다음 읽기에 보이게 한다.
    transaction: async <T>(path: string, change: (current: T | null) => T | undefined) => {
      const current = (data[path] ?? null) as T | null;
      const next = change(current);
      if (next === undefined) return { committed: false, value: current };
      await write('transaction', path, next);
      data[path] = next;
      return { committed: true, value: next };
    },
    // 한 묶음 — 실패 경로가 하나라도 있으면 아무것도 남기지 않는다(실제 RTDB 다중 경로 update 와 같다).
    commit: async (updates) => {
      if (Object.keys(updates).some(failOn)) throw new Error('commit failed');
      for (const [path, value] of Object.entries(updates)) writes.push(['commit', path, value]);
    },
    shallowKeys: async (path) => {
      const v = data[path];
      return v && typeof v === 'object' ? Object.keys(v) : [];
    },
    watch: () => () => {},
    probe: async () => {},
    now: () => NOW,
    uid: () => ADMIN_UID,
    serverTimeOffset: async () => 0,
  };
  return { db, writes };
}

const isAudit = (w: Write) => w[1].startsWith('adminLog/');

/** 작업 기록 줄을 뺀 쓰기 — 기록 id 는 무작위라 동작 쓰기만 견줄 때. */
export const withoutAudits = (writes: Write[]) => writes.filter((w) => !isAudit(w));

/** 남긴 작업 기록(값만) — 순서대로. */
export const auditsOf = (writes: Write[]) =>
  writes
    .filter(isAudit)
    .map((w) => w[2] as { at: unknown; by: string; action: string; target: string; detail?: string });
