// API 판 — `GET /v2/notices`(고정 + 최신 30) · `GET /v2/notices/broadcasts?cursor&limit`(더 보기) ·
// `POST /v2/admin/notices/broadcasts` · `PATCH · DELETE …/broadcasts/{id}` · `POST …/broadcasts/bulk`.
// 고정 · 내리기는 읽을 때 받은 `version` 을 싣는다(그 사이 다른 관리자가 고쳤으면 409 → conflict).
import {
  adminPath,
  perApi,
  PortError,
  portCall,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import type { InboxBroadcast } from '../model/broadcast';
import type { InboxMessage, InboxTag } from '../model/message';
import { BROADCAST_PAGE, type BroadcastPage, type BroadcastPort } from './port';

const BASE = adminPath('/notices/broadcasts');
/** 서버 한 번에 받는 상한(`limit` 1~50). */
const PAGE_MAX = 50;
/** 묶음 한 번의 상한. */
const BULK_MAX = 100;

const TAG: Record<string, InboxTag> = { NOTICE: 'notice', UPDATE: 'update', REWARD: 'reward' };
const WIRE_TAG: Record<InboxTag, string> = { notice: 'NOTICE', update: 'UPDATE', reward: 'REWARD' };

/** 공지 한 건 — 칸이 약속과 다르면 줄을 버리거나 빈 값으로 덮지 않고 던진다. */
function toBroadcast(w: unknown): InboxBroadcast {
  const o = wireObject(w, '공지');
  const id = wireString(o.id, '공지의 id');
  const tag = TAG[wireString(o.tag, `공지 ${id} 의 tag`)];
  if (!tag) throw wireError(`공지 ${id} 의 tag`, 'NOTICE · UPDATE · REWARD');
  const at = Date.parse(wireString(o.publishedAt, `공지 ${id} 의 publishedAt`));
  if (Number.isNaN(at)) throw wireError(`공지 ${id} 의 publishedAt`, 'ISO 시각');
  return {
    id,
    tag,
    title: wireString(o.title, `공지 ${id} 의 title`),
    body: wireString(o.body, `공지 ${id} 의 body`),
    ts: at,
    pinned: wireBool(o.pinned, `공지 ${id} 의 pinned`),
    version: wireNumber(o.version, `공지 ${id} 의 version`),
  };
}

const rows = (list: unknown, what: string) => wireArray(list, what).map(toBroadcast);

/** 다음 쪽 커서 — 없으면 null. 글자도 null 도 아니면 던진다. */
const cursorOf = (v: unknown, what: string): string | null => wireNullableString(v, what);

/** 묶음 결과의 한 줄 — `{ id, ok, code? }`. */
function toBulkRow(r: unknown): { ok: boolean; code: string | null } {
  const o = wireObject(r, '묶음 결과 줄');
  const ok = wireBool(o.ok, '묶음 결과 줄의 ok');
  return { ok, code: ok ? null : wireString(o.code, '묶음 결과 줄의 code') };
}

function build(api: Api | null): BroadcastPort {
  const once = createPayloadRequestId();

  async function list(n = BROADCAST_PAGE): Promise<BroadcastPage> {
    return portCall(
      api,
      async (a) => {
        const board = wireObject(
          wireObject(await a.get<unknown>('/v2/notices'), '공지 판').broadcasts,
          '공지 판의 broadcasts',
        );
        const latest = rows(board.latest, 'broadcasts.latest');
        const items = [...rows(board.pinned, 'broadcasts.pinned'), ...latest];
        let recent = latest.length;
        let cursor = cursorOf(board.nextCursor, 'broadcasts.nextCursor');
        // 더 달라고 하면(n 이 늘면) 키셋으로 이어 받는다 — 받아 둔 쪽은 다시 받지 않을 수 없지만 한 번에 50개씩이다.
        while (cursor && recent < n) {
          const page = wireObject(
            await a.get<unknown>('/v2/notices/broadcasts', { cursor, limit: Math.min(PAGE_MAX, n - recent) }),
            '공지 쪽',
          );
          const more = rows(page.items, '공지 쪽의 items');
          items.push(...more);
          recent += more.length;
          cursor = more.length ? cursorOf(page.nextCursor, '공지 쪽의 nextCursor') : null;
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
        (a) => a.send<unknown>('POST', `${BASE}/bulk`, { body: { action, items } }),
        fallback,
      );
      for (const row of wireArray(result, '묶음 결과').map(toBulkRow)) {
        if (row.ok) ok += 1;
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
