import { broadcastsPinnedWrite, deleteBroadcastsWrite, type InboxBroadcast } from '@/entities/inbox';
import { countTarget, withAudit, type Db } from '@/shared/api';

/** 고정을 바꿔야 하는 공지만 — 이미 그 상태인 것은 쓰지 않는다. */
export const pinTargets = (selected: readonly InboxBroadcast[], pinned: boolean) =>
  selected.filter((b) => b.pinned !== pinned).map((b) => b.id);

// 하나든 여럿이든 기록은 한 줄 — 하나면 그 id, 여럿이면 개수.
const idsTarget = (ids: readonly string[]) => (ids.length === 1 ? ids[0] : `${ids.length}개`);
const idsDetail = (ids: readonly string[]) => (ids.length === 1 ? undefined : countTarget(ids));

// 관리자만 쓰는 노드라 한 묶음으로 — 하나라도 막히면 아무것도 바뀌지 않는다(기록도).
export async function setBroadcastsPinned(db: Db, ids: readonly string[], pinned: boolean): Promise<number> {
  if (ids.length)
    await db.commit(
      withAudit(
        db,
        broadcastsPinnedWrite(ids, pinned),
        pinned ? 'notice.pin' : 'notice.unpin',
        idsTarget(ids),
        idsDetail(ids),
      ),
    );
  return ids.length;
}

export async function deleteBroadcasts(db: Db, ids: readonly string[]): Promise<number> {
  if (ids.length)
    await db.commit(
      withAudit(db, deleteBroadcastsWrite(ids), 'notice.broadcastDelete', idsTarget(ids), idsDetail(ids)),
    );
  return ids.length;
}
