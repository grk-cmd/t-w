import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';

const PATH = 'config/minRoomVer';
const MIN_ROOM_VER_KEY = ['minRoomVer'];

/** 없으면 null(= 제한 없음). 앱 getMinRoomVer 와 같게 문자열로 맞춘다. */
export async function getMinRoomVer(db: Db): Promise<string | null> {
  const v = await db.get<unknown>(PATH);
  return v == null ? null : String(v);
}

export function useMinRoomVer() {
  const db = useDb();
  return useQuery({ queryKey: MIN_ROOM_VER_KEY, queryFn: () => getMinRoomVer(db) });
}

/** 올리면 그보다 낮은 앱은 방 입장 · 생성 · 초대 수락이 막힌다(앱 _ensureRoomVersionOk). 기록과 한 묶음. */
export function saveMinRoomVer(db: Db, version: string, before: string | null): Promise<void> {
  const v = version.trim();
  return db.commit(withAudit(db, { [PATH]: v }, 'settings.minRoomVer', v, `${before ?? '없음'} → ${v}`));
}

export function useRefreshMinRoomVer() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: MIN_ROOM_VER_KEY });
}
