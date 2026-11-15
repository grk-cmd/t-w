// API 판 — `GET · PUT /v2/admin/notices/launcher-banner`. 읽을 때 받은 `version` 을 저장에 싣는다(그 사이 다른 관리자가 고쳤으면 409).
// 서버 칸 이름은 `imageUrl` · `linkUrl`(없으면 null) — 화면 칸(`img` · `link`)으로 바꿔 준다.
import { adminPath, NO_API_TEXT, PortError, toPortError, type Api, perApi } from '@/shared/api';
import type { AdSlide } from '../model/adBanner';
import type { AdBannerPort } from './port';

interface Banner {
  version?: unknown;
  slides?: unknown;
}

const PATH = adminPath('/notices/launcher-banner');

function build(api: Api | null): AdBannerPort {
  let version: number | null = null;

  async function load(): Promise<AdSlide[]> {
    if (!api) throw new PortError('unreachable', NO_API_TEXT);
    try {
      const banner = await api.get<Banner>(PATH);
      version = typeof banner.version === 'number' ? banner.version : 0;
      const list = Array.isArray(banner.slides) ? banner.slides : [];
      return list.map((s: { imageUrl?: unknown; linkUrl?: unknown }) => ({
        img: String(s.imageUrl ?? ''),
        link: typeof s.linkUrl === 'string' ? s.linkUrl : '',
      }));
    } catch (error) {
      throw toPortError(error, '배너를 불러오지 못했어요');
    }
  }

  return {
    get: load,
    async save(slides) {
      if (!api) throw new PortError('unreachable', NO_API_TEXT);
      if (version === null) await load();
      try {
        await api.send('PUT', PATH, {
          body: {
            version,
            slides: slides.map((s) => ({ imageUrl: s.img, linkUrl: s.link || null })),
          },
        });
        version = null; // 저장 뒤 version 이 올라갔다 — 다음 저장 전에 다시 받는다
      } catch (error) {
        const failure = toPortError(error, '저장하지 못했어요');
        if (failure.kind === 'conflict') version = null;
        throw failure;
      }
    },
  };
}

/** `api` 마다 하나 — 읽는 훅 · 쓰는 훅이 같은 포트(같은 version · 기억)를 쓴다. */
export const createServerAdBannerPort = perApi(build);
