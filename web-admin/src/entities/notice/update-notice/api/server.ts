// API 판 — 읽기 `GET /v2/notices` 의 `updateNotice`(없으면 null) · 올리기 `POST /v2/admin/notices/update-notices { requestId, title, body }` ·
// 내리기 `DELETE …/update-notices/{id}`(지금 것이 아니라 본 id 로 — 그 사이 새 공지가 오면 엉뚱한 것을 내리지 않게).
import { adminPath, PortError, portCall, type Api, perApi } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, type UpdateNotice } from '../model/updateNotice';
import type { UpdateNoticePort } from './port';

const BASE = adminPath('/notices/update-notices');

interface Wire {
  id?: unknown;
  title?: unknown;
  body?: unknown;
  publishedAt?: unknown;
}

function build(api: Api | null): UpdateNoticePort {
  const once = createPayloadRequestId();
  let seenId: string | null = null;

  const toNotice = (w: Wire): UpdateNotice => {
    const at = typeof w.publishedAt === 'string' ? Date.parse(w.publishedAt) : NaN;
    return {
      title: typeof w.title === 'string' ? w.title : '',
      body: typeof w.body === 'string' ? w.body : '',
      ts: Number.isNaN(at) ? 0 : at,
    };
  };

  async function get(): Promise<UpdateNotice | null> {
    const board = await portCall(
      api,
      (a) => a.get<{ updateNotice?: Wire | null }>('/v2/notices'),
      '업데이트 공지를 불러오지 못했어요',
    );
    const wire = board.updateNotice;
    seenId = wire && typeof wire.id === 'string' ? wire.id : null;
    return wire ? toNotice(wire) : null;
  }

  return {
    get,
    async publish(title, body) {
      const payload = {
        title: title.trim().slice(0, NOTICE_TITLE_MAX),
        body: body.trim().slice(0, NOTICE_BODY_MAX),
      };
      const wire = await once(payload, (requestId) =>
        portCall(
          api,
          (a) => a.send<Wire>('POST', BASE, { body: { requestId, ...payload } }),
          '올리지 못했어요',
        ),
      );
      seenId = typeof wire?.id === 'string' ? wire.id : null;
    },
    async clear() {
      if (seenId === null) await get();
      if (seenId === null) throw new PortError('notFound', '이미 내려갔어요');
      const id = seenId;
      await portCall(api, (a) => a.send('DELETE', `${BASE}/${encodeURIComponent(id)}`), '내리지 못했어요');
      seenId = null;
    },
  };
}

/** `api` 마다 하나 — 읽는 훅 · 쓰는 훅이 같은 포트(같은 version · 기억)를 쓴다. */
export const createServerUpdateNoticePort = perApi(build);
