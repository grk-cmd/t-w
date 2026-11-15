import type { InboxBroadcast } from '../model/broadcast';
import type { InboxMessage } from '../model/message';

/** 받을 개수를 주지 않을 때 받는 최근 공지 수. */
export const BROADCAST_PAGE = 30;

export interface BroadcastPage {
  items: InboxBroadcast[];
  /** 최근 n 개를 꽉 채워 받았다 — 더 오래된 공지가 남아 있을 수 있다. */
  hasMore: boolean;
}

/** 알림함 «소식» — 모두가 읽는 공용 공지. 고정 공지는 개수와 상관없이 맨 위에 온다. */
export interface BroadcastPort {
  /** 최근 `n` 개 + 고정 공지. */
  list(n?: number): Promise<BroadcastPage>;
  send(message: InboxMessage, pinned: boolean): Promise<void>;
  /** 고정을 바꾼다. 한 묶음으로 — 하나라도 막히면 아무것도 바뀌지 않는다. 바꾼 개수를 돌려준다. */
  setPinned(ids: readonly string[], pinned: boolean): Promise<number>;
  /** 내린다. 한 묶음으로 — 하나라도 막히면 아무것도 바뀌지 않는다. 내린 개수를 돌려준다. */
  remove(ids: readonly string[]): Promise<number>;
}
