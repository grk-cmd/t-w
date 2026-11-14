// Firebase 판 — 지금 코드 그대로: catalog/adBanner 를 읽고 쓴다.
import { withAudit, type Db } from '@/shared/api';
import { toSlides, type AdSlide } from '../model/adBanner';
import type { AdBannerPort } from './port';

const PATH = 'catalog/adBanner';

export async function getAdBanner(db: Db): Promise<AdSlide[]> {
  return toSlides(await db.get(PATH));
}

// 앱이 배열을 통째로 쓰고 통째로 읽는 노드라 부분 수정 없이 통째로 바꾼다. 빈 배열이면 노드가 지워져 배너가 숨겨진다.
export function saveAdBanner(db: Db, slides: AdSlide[]): Promise<void> {
  return db.commit(withAudit(db, { [PATH]: slides }, 'settings.adBanner', `${slides.length}장`));
}

export function createFirebaseAdBannerPort(db: Db): AdBannerPort {
  return {
    get: () => getAdBanner(db),
    save: (slides) => saveAdBanner(db, slides),
  };
}
