import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { MIN_VERSIONS, type MinVersionKind } from '../model/minVersion';

const queryKey = (kind: MinVersionKind) => ['minVersion', kind];

/** 없으면 null(= 제한 없음). 앱 getMinRoomVer · app-version-gate.js 와 같게 문자열로 맞춘다. */
export async function getMinVersion(db: Db, kind: MinVersionKind): Promise<string | null> {
  const v = await db.get<unknown>(MIN_VERSIONS[kind].path);
  return v == null ? null : String(v);
}

export function useMinVersion(kind: MinVersionKind) {
  const db = useDb();
  return useQuery({ queryKey: queryKey(kind), queryFn: () => getMinVersion(db, kind) });
}

/** 올리면 그보다 낮은 앱이 막힌다 — room 은 방 입장 · 생성 · 초대 수락, app 은 앱 전체. 기록과 한 묶음. */
export function saveMinVersion(
  db: Db,
  kind: MinVersionKind,
  version: string,
  before: string | null,
): Promise<void> {
  const v = version.trim();
  const { path, action } = MIN_VERSIONS[kind];
  return db.commit(withAudit(db, { [path]: v }, action, v, `${before ?? '없음'} → ${v}`));
}

export function useRefreshMinVersion(kind: MinVersionKind) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKey(kind) });
}
