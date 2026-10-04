import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { sortBroadcasts, type InboxBroadcast, type RawBroadcast } from '../model/broadcast';
import { INBOX_BODY_MAX, INBOX_TITLE_MAX, type InboxMessage } from '../model/message';

const BROADCAST_KEY = ['inboxBroadcast'];
const ROOT = 'inboxBroadcast';

function broadcastId(): string {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// 공지 목록은 통째로 받는 노드다(요금 = 내려받은 바이트) — 구독하지 않고 쓰기 직후 · 새로고침 때만 다시 받는다.
export async function listBroadcasts(db: Db): Promise<InboxBroadcast[]> {
  return sortBroadcasts((await db.get<Record<string, RawBroadcast>>(ROOT)) ?? {});
}

export function useBroadcasts() {
  const db = useDb();
  return useQuery({ queryKey: BROADCAST_KEY, queryFn: () => listBroadcasts(db) });
}

export function useRefreshBroadcasts() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BROADCAST_KEY });
}

/** 공용 공지 한 통을 쓸 내용. 고정이 아니면 pinned 키를 아예 두지 않는다(앱과 같은 모양). */
export function broadcastWrite(db: Db, message: InboxMessage, pinned: boolean, id = broadcastId()) {
  return {
    [`${ROOT}/${id}`]: {
      tag: message.tag,
      title: message.title.trim().slice(0, INBOX_TITLE_MAX),
      body: message.body.trim().slice(0, INBOX_BODY_MAX),
      ts: db.now(),
      ...(pinned ? { pinned: true } : {}),
    },
  };
}

export function sendBroadcast(db: Db, message: InboxMessage, pinned: boolean, id?: string): Promise<void> {
  return db.commit(broadcastWrite(db, message, pinned, id));
}

// 내용은 두고 pinned 만 바꾼다. 풀 때는 false 를 쓰지 않고 키를 지운다(앱과 같은 모양).
export function setBroadcastPinned(db: Db, id: string, pinned: boolean): Promise<void> {
  const path = `${ROOT}/${id}/pinned`;
  return pinned ? db.set(path, true) : db.remove(path);
}

export function deleteBroadcast(db: Db, id: string): Promise<void> {
  return db.remove(`${ROOT}/${id}`);
}
