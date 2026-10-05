import { broadcastsPinnedWrite, deleteBroadcastsWrite, type InboxBroadcast } from '@/entities/inbox';
import type { Db } from '@/shared/api';

/** 고정을 바꿔야 하는 공지만 — 이미 그 상태인 것은 쓰지 않는다. */
export const pinTargets = (selected: readonly InboxBroadcast[], pinned: boolean) =>
  selected.filter((b) => b.pinned !== pinned).map((b) => b.id);

// 관리자만 쓰는 노드라 한 묶음으로 — 하나라도 막히면 아무것도 바뀌지 않는다.
export async function setBroadcastsPinned(db: Db, ids: readonly string[], pinned: boolean): Promise<number> {
  if (ids.length) await db.commit(broadcastsPinnedWrite(ids, pinned));
  return ids.length;
}

export async function deleteBroadcasts(db: Db, ids: readonly string[]): Promise<number> {
  if (ids.length) await db.commit(deleteBroadcastsWrite(ids));
  return ids.length;
}
