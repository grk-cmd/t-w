import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { isIndexMissing, isPermissionDenied, useDb, withAudit, type Db } from '@/shared/api';
import {
  BROADCAST_ROOT,
  sortBroadcasts,
  withBroadcastVersion,
  type InboxBroadcast,
  type RawBroadcast,
} from '../model/broadcast';
import { INBOX_BODY_MAX, INBOX_TAG_LABEL, INBOX_TITLE_MAX, type InboxMessage } from '../model/message';

const BROADCAST_KEY = ['inboxBroadcast'];
const ROOT = BROADCAST_ROOT;

function broadcastId(): string {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 받을 개수를 주지 않을 때 받는 최근 공지 수. */
export const BROADCAST_PAGE = 30;

export interface BroadcastPage {
  items: InboxBroadcast[];
  /** 최근 n 개를 꽉 채워 받았다 — 더 오래된 공지가 남아 있을 수 있다. */
  hasMore: boolean;
}

/**
 * 최근 n 개 + 고정 공지(오래됐어도 맨 위라 개수와 상관없이). 요금 = 내려받은 바이트라 통째로 받지 않는다.
 * 구독하지 않고 쓰기 직후 · 새로고침 · 받아 둔 것보다 뒤쪽으로 갈 때만 다시 받는다.
 */
export async function listBroadcasts(db: Db, n = BROADCAST_PAGE): Promise<BroadcastPage> {
  const [recent, pinned] = await Promise.all([
    db.getLast<RawBroadcast>(ROOT, 'ts', n),
    db.getEqual<RawBroadcast>(ROOT, 'pinned', true),
  ]).catch(async (error: unknown) => {
    // TODO: 규칙에 inboxBroadcast ".indexOn": ["ts", "pinned"] 가 들어가면 이 갈래는 안 탄다 — 그때 지운다.
    //   지금은 서버가 범위 조회를 거절하므로 통째로 받아 여기서 자른다(내려받는 양은 예전과 같다).
    if (!isIndexMissing(error)) throw error;
    return splitBroadcasts((await db.get<Record<string, RawBroadcast>>(ROOT)) ?? {}, n);
  });
  return { items: sortBroadcasts({ ...recent, ...pinned }), hasMore: Object.keys(recent).length >= n };
}

function splitBroadcasts(all: Record<string, RawBroadcast>, n: number) {
  const entries = Object.entries(all).filter(([, b]) => b && typeof b === 'object');
  const recent = [...entries].sort(([, a], [, b]) => (a.ts ?? 0) - (b.ts ?? 0)).slice(-n);
  const pinned = entries.filter(([, b]) => b.pinned === true);
  return [Object.fromEntries(recent), Object.fromEntries(pinned)] as const;
}

export function useBroadcasts(n = BROADCAST_PAGE) {
  const db = useDb();
  return useQuery({
    queryKey: [...BROADCAST_KEY, n],
    queryFn: () => listBroadcasts(db, n),
    // 더 받는 동안 지금 목록을 둔 채 받는다.
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

/**
 * 공용 공지 쓰기(보내기 · 고정 · 삭제)는 전부 여기를 지난다 — 공지 버전(inboxBroadcastMeta)도 같은 묶음으로 올린다.
 * 한 묶음이라 규칙에 하나라도 막히면 아무것도 바뀌지 않는다.
 */
export async function broadcastCommit(db: Db, updates: Record<string, unknown>): Promise<void> {
  if (!Object.keys(updates).length) return;
  const versioned = withBroadcastVersion(updates, db.now());
  if (versioned === updates) return db.commit(updates);
  try {
    await db.commit(versioned);
  } catch (error) {
    // 규칙에 inboxBroadcastMeta 가 아직 없는 DB(운영 규칙 배포 전)는 묶음째 거절한다 — 그때만 버전 없이 다시 쓴다.
    // 그 DB 를 쓰는 앱은 버전을 못 읽어 통째 구독으로 돌고 있으니 버전 없이도 바로 반영된다.
    if (!isPermissionDenied(error)) throw error;
    await db.commit(updates);
    console.warn('[inbox] inboxBroadcastMeta 규칙이 없어 버전 없이 공지만 썼다');
  }
}

export function sendBroadcast(db: Db, message: InboxMessage, pinned: boolean, id?: string): Promise<void> {
  const detail = `${INBOX_TAG_LABEL[message.tag] ?? message.tag}${pinned ? ' · 고정' : ''}`;
  return broadcastCommit(
    db,
    withAudit(db, broadcastWrite(db, message, pinned, id), 'notice.broadcast', message.title.trim(), detail),
  );
}

/** 여러 공지의 고정을 한 묶음으로 바꾸는 쓰기 — 풀 때는 키를 지운다(앱과 같은 모양). */
export function broadcastsPinnedWrite(ids: readonly string[], pinned: boolean): Record<string, true | null> {
  return Object.fromEntries(ids.map((id) => [`${ROOT}/${id}/pinned`, pinned ? true : null]));
}

export function deleteBroadcastsWrite(ids: readonly string[]): Record<string, null> {
  return Object.fromEntries(ids.map((id) => [`${ROOT}/${id}`, null]));
}
