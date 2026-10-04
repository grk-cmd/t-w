import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import { ANNOUNCE_DURATION, ANNOUNCE_TEXT_MAX, type Announce } from '../model/announce';

const ANNOUNCE_KEY = ['announce'];
const OFFSET_KEY = ['serverTimeOffset'];
const PATH = 'announce/current';

export function getAnnounce(db: Db): Promise<Announce | null> {
  return db.get<Announce>(PATH);
}

export function useAnnounce() {
  const db = useDb();
  return useQuery({ queryKey: ANNOUNCE_KEY, queryFn: () => getAnnounce(db) });
}

export function useRefreshAnnounce() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ANNOUNCE_KEY });
}

// ts 가 서버 시각이라 남은 시간도 서버 시계로 잰다.
export function useServerTimeOffset() {
  const db = useDb();
  return useQuery({ queryKey: OFFSET_KEY, queryFn: () => db.serverTimeOffset() });
}

// ts 는 서버 시각 — 관리자 PC 시계가 틀려도 모두에게 같은 1분이 되게.
export function publishAnnounce(db: Db, text: string): Promise<void> {
  return db.set(PATH, {
    text: text.trim().slice(0, ANNOUNCE_TEXT_MAX),
    ts: db.now(),
    duration: ANNOUNCE_DURATION,
  });
}

export function clearAnnounce(db: Db): Promise<void> {
  return db.remove(PATH);
}
