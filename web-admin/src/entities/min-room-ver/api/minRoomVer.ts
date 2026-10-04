import { useQuery } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';

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
