// API 판 — `POST /v2/admin/notices/announcements { requestId, text ≤140 }` · `DELETE …/announcements/current`.
// 서버에는 «지금 떠 있는 확성기» 를 읽는 길이 없다(realtime 이 60초 들고 보낼 뿐) — 이 화면에서 보낸 것만 기억해 남은 시간을 보인다.
// 서버 시계를 따로 받지 않으므로 시각 차는 0 이다(이 PC 시계 기준).
import { adminPath, portCall, type Api, perApi } from '@/shared/api';
import { createPayloadRequestId } from '@/shared/lib';
import { ANNOUNCE_DURATION, ANNOUNCE_TEXT_MAX, type Announce } from '../model/announce';
import type { AnnouncePort } from './port';

const BASE = adminPath('/notices/announcements');

function build(api: Api | null): AnnouncePort {
  const once = createPayloadRequestId();
  let sent: Announce | null = null;

  return {
    readsCurrent: false,
    async get() {
      return sent;
    },
    async publish(text) {
      const body = { text: text.trim().slice(0, ANNOUNCE_TEXT_MAX) };
      await once(body, (requestId) =>
        portCall(api, (a) => a.send('POST', BASE, { body: { requestId, ...body } }), '보내지 못했어요'),
      );
      sent = { text: body.text, ts: Date.now(), duration: ANNOUNCE_DURATION };
    },
    async clear() {
      await portCall(api, (a) => a.send('DELETE', `${BASE}/current`), '끄지 못했어요');
      sent = null;
    },
    async serverTimeOffset() {
      return 0;
    },
  };
}

/** `api` 마다 하나 — 읽는 훅 · 쓰는 훅이 같은 포트(같은 version · 기억)를 쓴다. */
export const createServerAnnouncePort = perApi(build);
