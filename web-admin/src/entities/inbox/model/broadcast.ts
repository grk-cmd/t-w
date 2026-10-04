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
