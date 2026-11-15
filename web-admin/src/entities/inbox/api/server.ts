// API 판 — `GET /v2/notices`(고정 + 최신 30) · `GET /v2/notices/broadcasts?cursor&limit`(더 보기) ·
// `POST /v2/admin/notices/broadcasts` · `PATCH · DELETE …/broadcasts/{id}` · `POST …/broadcasts/bulk`.
// 고정 · 내리기는 읽을 때 받은 `version` 을 싣는다(그 사이 다른 관리자가 고쳤으면 409 → conflict).
import { adminPath, PortError, portCall, wireNumber, type Api, perApi } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import type { InboxBroadcast } from '../model/broadcast';
import type { InboxMessage, InboxTag } from '../model/message';
import { BROADCAST_PAGE, type BroadcastPage, type BroadcastPort } from './port';

const BASE = adminPath('/notices/broadcasts');
/** 서버 한 번에 받는 상한(`limit` 1~50). */
const PAGE_MAX = 50;
/** 묶음 한 번의 상한. */
const BULK_MAX = 100;

interface Wire {
  id?: unknown;
  tag?: unknown;
  title?: unknown;
  body?: unknown;
  pinned?: unknown;
  publishedAt?: unknown;
  version?: unknown;
}

interface Board {
  broadcasts?: { pinned?: Wire[]; latest?: Wire[]; nextCursor?: unknown };
}

interface BulkRow {
  id?: unknown;
  ok?: unknown;
  code?: unknown;
}

const TAG: Record<string, InboxTag> = { NOTICE: 'notice', UPDATE: 'update', REWARD: 'reward' };
const WIRE_TAG: Record<InboxTag, string> = { notice: 'NOTICE', update: 'UPDATE', reward: 'REWARD' };

function toBroadcast(w: Wire): InboxBroadcast | null {
  if (typeof w.id !== 'string') return null;
  const at = typeof w.publishedAt === 'string' ? Date.parse(w.publishedAt) : NaN;
  return {
    id: w.id,
    tag: TAG[String(w.tag)] ?? 'notice',
    title: typeof w.title === 'string' ? w.title : '',
    body: typeof w.body === 'string' ? w.body : '',
    ts: Number.isNaN(at) ? 0 : at,
    pinned: w.pinned === true,
    version: wireNumber(w.version, `공지 ${w.id} 의 version`),
  };
}

const rows = (list: Wire[] | undefined) =>
  (list ?? []).map(toBroadcast).filter((b): b is InboxBroadcast => b !== null);

function build(api: Api | null): BroadcastPort {
  const once = createPayloadRequestId();

  async function list(n = BROADCAST_PAGE): Promise<BroadcastPage> {
    return portCall(
      api,
      async (a) => {
        const board = (await a.get<Board>('/v2/notices')).broadcasts ?? {};
        const items = [...rows(board.pinned), ...rows(board.latest)];
        let recent = rows(board.latest).length;
        let cursor = typeof board.nextCursor === 'string' ? board.nextCursor : null;
        // 더 달라고 하면(n 이 늘면) 키셋으로 이어 받는다 — 받아 둔 쪽은 다시 받지 않을 수 없지만 한 번에 50개씩이다.
        while (cursor && recent < n) {
          const page = await a.get<{ items?: Wire[]; nextCursor?: unknown }>('/v2/notices/broadcasts', {
            cursor,
            limit: Math.min(PAGE_MAX, n - recent),
          });
          const more = rows(page.items);
          items.push(...more);
          recent += more.length;
          cursor = typeof page.nextCursor === 'string' && more.length ? page.nextCursor : null;
        }
        return { items, hasMore: cursor !== null };
      },
      '공지를 불러오지 못했어요',
    );
  }

  /** 화면이 읽은 공지의 번호 — API 판 목록은 늘 번호를 싣는다. 없으면 이 판의 읽기를 거치지 않은 줄이라 코드 실수다. */
  const versionOf = (b: InboxBroadcast): number => {
    if (b.version === undefined) throw new PortError('invalid', `읽은 공지에 번호가 없어요 (${b.id})`);
    return b.version;
  };

  /** 줄마다 결과가 오는 묶음 — 안 된 줄이 있으면 «n개 됨 · m개 안 됨» 으로 던진다(남은 줄은 화면이 다시 받는다). */
  async function bulk(
    action: 'PIN' | 'UNPIN' | 'DELETE',
    targets: readonly InboxBroadcast[],
    fallback: string,
  ): Promise<number> {
    let ok = 0;
    let failed = 0;
    let conflict = false;
    // 요청을 보내기 전에 version 을 다 모은다 — 중간에 모자라서 앞 묶음 결과만 남는 일이 없게.
    const all = targets.map((b) => ({ id: b.id, version: versionOf(b) }));
    for (let i = 0; i < all.length; i += BULK_MAX) {
      const items = all.slice(i, i + BULK_MAX);
      const result = await portCall(
        api,
        (a) => a.send<BulkRow[]>('POST', `${BASE}/bulk`, { body: { action, items } }),
        fallback,
      );
      for (const row of result) {
        if (row.ok === true) ok += 1;
        else {
          failed += 1;
          if (row.code === 'CONCURRENT_UPDATE') conflict = true;
        }
      }
    }
    if (failed) throw new PortError(conflict ? 'conflict' : 'invalid', `${ok}개 됨 · ${failed}개 안 됨`);
    return ok;
  }

  return {
    list,
    async send(message: InboxMessage, pinned) {
      const body = {
        tag: WIRE_TAG[message.tag],
        title: message.title.trim(),
        body: message.body.trim(),
        pinned,
      };
      await once(body, (requestId) =>
        portCall(api, (a) => a.send('POST', BASE, { body: { requestId, ...body } }), '보내지 못했어요'),
      );
    },
    async setPinned(items, pinned) {
      if (!items.length) return 0;
      if (items.length === 1) {
        const [item] = items;
        await portCall(api, (a) =>
          a.send('PATCH', `${BASE}/${encodeURIComponent(item.id)}`, {
            body: { version: versionOf(item), pinned },
          }),
        );
        return 1;
      }
      return bulk(pinned ? 'PIN' : 'UNPIN', items, '고정을 바꾸지 못했어요');
    },
    async remove(items) {
      if (!items.length) return 0;
      if (items.length === 1) {
        const [item] = items;
        await portCall(api, (a) =>
          a.send('DELETE', `${BASE}/${encodeURIComponent(item.id)}`, { query: { version: versionOf(item) } }),
        );
        return 1;
      }
      return bulk('DELETE', items, '내리지 못했어요');
    },
  };
}

/** `api` 마다 하나 — 보낸 요청 번호(같은 내용을 다시 보낼 때)만 들고 있고, 공지의 `version` 은 화면이 읽은 줄에 실려 온다. */
export const createServerBroadcastPort = perApi(build);
