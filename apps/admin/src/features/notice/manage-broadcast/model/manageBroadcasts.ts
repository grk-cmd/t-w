import type { InboxBroadcast } from '@/entities/inbox';

/** 고정을 바꿔야 하는 공지만 — 이미 그 상태인 것은 쓰지 않는다. */
export const pinTargets = (selected: readonly InboxBroadcast[], pinned: boolean) =>
  selected.filter((b) => b.pinned !== pinned);
