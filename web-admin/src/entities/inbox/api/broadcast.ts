import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { sortBroadcasts, type InboxBroadcast, type RawBroadcast } from '../model/broadcast';
import { INBOX_BODY_MAX, INBOX_TITLE_MAX, type InboxMessage } from '../model/message';

const BROADCAST_KEY = ['inboxBroadcast'];
const ROOT = 'inboxBroadcast';

function broadcastId(): string {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 처음에 받는 최근 공지 수 · «더 보기» 한 번에 늘리는 수. */
export const BROADCAST_PAGE = 30;

export interface BroadcastPage {
  items: InboxBroadcast[];
  /** 최근 n 개를 꽉 채워 받았다 — 더 오래된 공지가 남아 있을 수 있다. */
  hasMore: boolean;
}

/**
 * 최근 n 개 + 고정 공지(오래됐어도 맨 위라 개수와 상관없이). 요금 = 내려받은 바이트라 통째로 받지 않는다.
 * 구독하지 않고 쓰기 직후 · 새로고침 · 더 보기 때만 다시 받는다.
 */
export async function listBroadcasts(db: Db, n = BROADCAST_PAGE): Promise<BroadcastPage> {
  const [recent, pinned] = await Promise.all([
    db.getLast<RawBroadcast>(ROOT, 'ts', n),
    db.getEqual<RawBroadcast>(ROOT, 'pinned', true),
  ]);
  return { items: sortBroadcasts({ ...recent, ...pinned }), hasMore: Object.keys(recent).length >= n };
}

export function useBroadcasts(n = BROADCAST_PAGE) {
  const db = useDb();
  return useQuery({
    queryKey: [...BROADCAST_KEY, n],
    queryFn: () => listBroadcasts(db, n),
    // 더 보기 동안 지금 목록을 둔 채 받는다.
    placeholderData: keepPreviousData,
  });
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

/** 여러 공지의 고정을 한 묶음으로 바꾸는 쓰기 — 풀 때는 키를 지운다(앱과 같은 모양). */
export function broadcastsPinnedWrite(ids: readonly string[], pinned: boolean): Record<string, true | null> {
  return Object.fromEntries(ids.map((id) => [`${ROOT}/${id}/pinned`, pinned ? true : null]));
}

export function deleteBroadcastsWrite(ids: readonly string[]): Record<string, null> {
  return Object.fromEntries(ids.map((id) => [`${ROOT}/${id}`, null]));
}
