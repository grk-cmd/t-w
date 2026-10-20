import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { toSlides, type AdSlide } from '../model/adBanner';

const PATH = 'catalog/adBanner';
const AD_BANNER_KEY = ['adBanner'];

export async function getAdBanner(db: Db): Promise<AdSlide[]> {
  return toSlides(await db.get(PATH));
}

export function useAdBanner() {
  const db = useDb();
  return useQuery({ queryKey: AD_BANNER_KEY, queryFn: () => getAdBanner(db) });
}

export function useRefreshAdBanner() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: AD_BANNER_KEY });
}

// 앱이 배열을 통째로 쓰고 통째로 읽는 노드라 부분 수정 없이 통째로 바꾼다. 빈 배열이면 노드가 지워져 배너가 숨겨진다.
export function saveAdBanner(db: Db, slides: AdSlide[]): Promise<void> {
  return db.commit(withAudit(db, { [PATH]: slides }, 'settings.adBanner', `${slides.length}장`));
}
