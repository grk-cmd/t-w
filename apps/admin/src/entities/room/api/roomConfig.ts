import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { CHANNEL_LABEL, type Channel } from '../model/room';
import {
  isRoomMaxPeople,
  parseRoomLimits,
  ROOM_LIMIT_CHANNELS,
  ROOM_LIMITS_PATH,
  ROOM_MAX_PEOPLE_PATH,
  roomMaxPeopleOf,
  totalLimitOf,
} from '../model/roomConfig';

const ROOM_CONFIG_KEY = ['roomConfig'];
const ROOM_LIMITS_KEY = [...ROOM_CONFIG_KEY, 'limits'];
const ROOM_MAX_PEOPLE_KEY = [...ROOM_CONFIG_KEY, 'maxPeople'];

export async function getRoomLimits(db: Db): Promise<Record<Channel, number | null>> {
  return parseRoomLimits(await db.get<unknown>(ROOM_LIMITS_PATH));
}

export function useRoomLimits() {
  const db = useDb();
  return useQuery({ queryKey: ROOM_LIMITS_KEY, queryFn: () => getRoomLimits(db) });
}

/** 정원 — 서버에 정해 둔 값. 없거나 범위 밖이면 null(앱 · 방 서버는 기본값). */
export async function getRoomMaxPeople(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(ROOM_MAX_PEOPLE_PATH);
  return isRoomMaxPeople(v) ? v : null;
}

export function useRoomMaxPeople() {
  const db = useDb();
  return useQuery({ queryKey: ROOM_MAX_PEOPLE_KEY, queryFn: () => getRoomMaxPeople(db) });
}

export function useRefreshRoomConfig() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ROOM_CONFIG_KEY });
}

/** 바뀐 채널만 «워킹룸 300 → 400» — 전에 칸이 없었으면 기본값으로 보여 준다. */
export function roomLimitChanges(
  before: Record<Channel, number | null> | null | undefined,
  next: Record<Channel, number>,
): string[] {
  return ROOM_LIMIT_CHANNELS.filter((ch) => before?.[ch] !== next[ch]).map(
    (ch) => `${CHANNEL_LABEL[ch]} ${totalLimitOf(before, ch)} → ${next[ch]}`,
  );
}

/** 전체 방 상한 — 두 채널을 한 객체로 쓴다(한쪽만 있는 모양이 남지 않게). 바뀐 게 없으면 쓰지 않는다. */
export function saveRoomLimits(
  db: Db,
  before: Record<Channel, number | null> | null | undefined,
  next: Record<Channel, number>,
): Promise<void> {
  const changes = roomLimitChanges(before, next);
  if (!changes.length) return Promise.resolve();
  const value = { workingroom: next.workingroom, togetherroom: next.togetherroom };
  return db.commit(
    withAudit(db, { [ROOM_LIMITS_PATH]: value }, 'settings.roomLimits', 'roomLimits', changes.join(' · ')),
  );
}

export function saveRoomMaxPeople(db: Db, before: number | null | undefined, next: number): Promise<void> {
  return db.commit(
    withAudit(
      db,
      { [ROOM_MAX_PEOPLE_PATH]: next },
      'settings.roomMaxPeople',
      `정원 ${next}명`,
      `${before ?? `기본 ${roomMaxPeopleOf(null)}`} → ${next}`,
    ),
  );
}
