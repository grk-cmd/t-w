// API 판 — 읽기 `GET /v2/notices` 의 `updateNotice`(없으면 null) · 올리기 `POST /v2/admin/notices/update-notices { requestId, title, body }` ·
// 내리기 `DELETE …/update-notices/{id}`(지금 것이 아니라 본 id 로 — 그 사이 새 공지가 오면 엉뚱한 것을 내리지 않게).
import {
  adminPath,
  perApi,
  PortError,
  portCall,
  wireError,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import { NOTICE_BODY_MAX, NOTICE_TITLE_MAX, type UpdateNotice } from '../model/updateNotice';
import type { UpdateNoticePort } from './port';

const BASE = adminPath('/notices/update-notices');

function build(api: Api | null): UpdateNoticePort {
  const once = createPayloadRequestId();

  /** 서버가 준 공지 한 건 — 칸이 약속과 다르면 던진다. */
  const toNotice = (w: unknown): UpdateNotice => {
    const o = wireObject(w, '업데이트 공지');
    const at = Date.parse(wireString(o.publishedAt, '업데이트 공지의 publishedAt'));
    if (Number.isNaN(at)) throw wireError('업데이트 공지의 publishedAt', 'ISO 시각');
    return {
      id: wireString(o.id, '업데이트 공지의 id'),
      title: wireString(o.title, '업데이트 공지의 title'),
      body: wireString(o.body, '업데이트 공지의 body'),
      ts: at,
    };
  };

  return {
    async get() {
      const board = wireObject(
        await portCall(api, (a) => a.get<unknown>('/v2/notices'), '업데이트 공지를 불러오지 못했어요'),
        '공지 판',
      );
      if (!('updateNotice' in board)) throw wireError('공지 판', 'updateNotice 칸(없으면 null)');
      return board.updateNotice === null ? null : toNotice(board.updateNotice);
    },
    async publish(title, body) {
      const payload = {
        title: title.trim().slice(0, NOTICE_TITLE_MAX),
        body: body.trim().slice(0, NOTICE_BODY_MAX),
      };
      await once(payload, (requestId) =>
        portCall(api, (a) => a.send('POST', BASE, { body: { requestId, ...payload } }), '올리지 못했어요'),
      );
    },
    async clear(notice) {
      // 화면이 읽은 공지의 id 로만 내린다 — 포트가 따로 기억하거나 먼저 읽지 않는다.
      if (!notice.id) throw new PortError('invalid', '읽은 공지에 id 가 없어요');
      const { id } = notice;
      await portCall(api, (a) => a.send('DELETE', `${BASE}/${encodeURIComponent(id)}`), '내리지 못했어요');
    },
  };
}

/** `api` 마다 하나 — 보낸 요청 번호(같은 내용을 다시 보낼 때)만 들고 있다. 공지 id 는 화면이 읽은 것을 넘긴다. */
export const createServerUpdateNoticePort = perApi(build);
