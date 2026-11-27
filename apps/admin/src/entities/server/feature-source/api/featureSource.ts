import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import {
  effectiveSource,
  FEATURE_META,
  FEATURES,
  sourcePath,
  sourceUpdates,
  type Feature,
  type FeatureSources,
  type Source,
} from '../model/featureSource';

const KEY = ['featureSources'];

// config 통째 읽기는 무거워(그리고 규칙상 관리자만) 기능마다 새 칸 · 옛 칸 한 칸씩만 읽는다.
export async function getFeatureSources(db: Db): Promise<FeatureSources> {
  const pairs = await Promise.all(
    FEATURES.map(async (f) => {
      const legacyPath = FEATURE_META[f].legacyPath;
      const [value, legacy] = await Promise.all([
        db.get<unknown>(sourcePath(f)),
        legacyPath ? db.get<unknown>(legacyPath) : Promise.resolve(undefined),
      ]);
      return [f, effectiveSource(f, value, legacy)] as const;
    }),
  );
  return Object.fromEntries(pairs) as FeatureSources;
}

export function useFeatureSources() {
  const db = useDb();
  return useQuery({ queryKey: KEY, queryFn: () => getFeatureSources(db) });
}

export function useRefreshFeatureSources() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

export function setFeatureSource(db: Db, f: Feature, s: Source): Promise<void> {
  return db.commit(withAudit(db, sourceUpdates(f, s), 'settings.featureSource', f, s));
}
