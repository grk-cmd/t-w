// API 판 — `GET · PUT /v2/admin/notices/launcher-banner`. 읽을 때 받은 `version` 은 화면이 들고 있다가 저장에 싣는다
// (그 사이 다른 관리자가 고쳤으면 409 → `conflict`). 서버 칸 이름은 `imageUrl` · `linkUrl`(없으면 null) — 화면 칸(`img` · `link`)으로 바꿔 준다.
import {
  adminPath,
  perApi,
  portCall,
  wireArray,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
} from '@/shared/api';
import type { AdSlide } from '../model/adBanner';
import type { AdBannerPort } from './port';

const PATH = adminPath('/notices/launcher-banner');

function build(api: Api | null): AdBannerPort {
  return {
    async get() {
      const banner = wireObject(
        await portCall(api, (a) => a.get<unknown>(PATH), '배너를 불러오지 못했어요'),
        '런처 배너',
      );
      const slides: AdSlide[] = wireArray(banner.slides, '런처 배너의 slides').map((s, i) => {
        const slide = wireObject(s, `slides[${i}]`);
        return {
          img: wireString(slide.imageUrl, `slides[${i}].imageUrl`),
          link: wireNullableString(slide.linkUrl, `slides[${i}].linkUrl`) ?? '',
        };
      });
      return { value: slides, version: wireNumber(banner.version, '런처 배너의 version') };
    },
    async save(from, slides) {
      await portCall(
        api,
        (a) =>
          a.send('PUT', PATH, {
            body: {
              version: from.version,
              slides: slides.map((s) => ({ imageUrl: s.img, linkUrl: s.link || null })),
            },
          }),
        '저장하지 못했어요',
      );
    },
  };
}

export const createServerAdBannerPort = perApi(build);
