import type { InboxMessage, InboxTag } from './message';

// inboxBroadcast/{id} = { tag, title, body, ts, pinned? } — 모두가 읽는 공용 공지. 읽음은 각자 기기에 남는다.
export interface InboxBroadcast extends InboxMessage {
  id: string;
  ts: number;
  pinned: boolean;
}

export interface RawBroadcast {
  tag?: string;
  title?: string;
  body?: string;
  ts?: number;
  pinned?: boolean;
}

const TAGS: InboxTag[] = ['notice', 'update', 'reward'];

export const BROADCAST_ROOT = 'inboxBroadcast';

/**
 * 공용 공지 버전(서버 시각) — 앱이 이걸 보고 로컬 캐시를 버린다(app/parts/broadcast-cache.js).
 * 공지를 쓰는 · 고정을 바꾸는 · 지우는 묶음에 같이 올리지 않으면 앱은 옛 공지를 캐시 수명(24시간)까지 보여 준다.
 */
export const BROADCAST_META = 'inboxBroadcastMeta';

const BROADCAST_PATH = new RegExp(`^${BROADCAST_ROOT}(?:/|$)`);

/** 같은 묶음에 공지 버전을 얹는다. 공지 경로를 안 건드리면 묶음을 그대로 돌려준다. */
export function withBroadcastVersion(
  updates: Record<string, unknown>,
  stamp: object,
): Record<string, unknown> {
  if (!Object.keys(updates).some((path) => BROADCAST_PATH.test(path))) return updates;
  return { ...updates, [BROADCAST_META]: stamp };
}

// 앱 수령함과 같은 순서 — 고정이 맨 위, 그 안에서는 최근 것부터.
export function sortBroadcasts(all: Record<string, RawBroadcast>): InboxBroadcast[] {
  return Object.entries(all)
    .filter(([, b]) => b && typeof b === 'object')
    .map(([id, b]) => ({
      id,
      tag: TAGS.includes(b.tag as InboxTag) ? (b.tag as InboxTag) : 'notice',
      title: b.title ?? '',
      body: b.body ?? '',
      ts: b.ts ?? 0,
      pinned: b.pinned === true,
    }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts - a.ts);
}

/** 입력이 모자라면 알려 줄 문장, 괜찮으면 null. */
export function checkBroadcast(message: InboxMessage): string | null {
  if (!message.title.trim()) return '제목을 입력해 주세요';
  if (!message.body.trim()) return '내용을 입력해 주세요';
  return null;
}
