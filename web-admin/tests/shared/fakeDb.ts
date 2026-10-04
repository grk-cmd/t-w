import type { Db } from '@/shared/api';

export const NOW = { '.sv': 'timestamp' };

export type Write = [op: 'set' | 'update' | 'remove' | 'commit', path: string, value?: unknown];

// 경로 → 값 지도로 흉내 낸 Db. 쓴 것은 writes 에 순서대로 남는다. failOn 이 참인 경로의 쓰기는 실패한다.
export function fakeDb(data: Record<string, unknown> = {}, failOn: (path: string) => boolean = () => false) {
  const writes: Write[] = [];
  const write = async (op: Write[0], path: string, value?: unknown) => {
    if (failOn(path)) throw new Error('write failed');
    writes.push([op, path, value]);
  };
  const db: Db = {
    get: async <T>(path: string) => (data[path] ?? null) as T | null,
    set: (path, value) => write('set', path, value),
    update: (path, value) => write('update', path, value),
    remove: (path) => write('remove', path),
    // 한 묶음 — 실패 경로가 하나라도 있으면 아무것도 남기지 않는다(실제 RTDB 다중 경로 update 와 같다).
    commit: async (updates) => {
      if (Object.keys(updates).some(failOn)) throw new Error('commit failed');
      for (const [path, value] of Object.entries(updates)) writes.push(['commit', path, value]);
    },
    watch: () => () => {},
    probe: async () => {},
    now: () => NOW,
    serverTimeOffset: async () => 0,
  };
  return { db, writes };
}
