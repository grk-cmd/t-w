// Firebase 판 — 지금 코드 그대로: config/roomLimits · roomMaxPeople · chatKeepDays 를 읽고 쓴다.
import { withAudit, type Db } from '@/shared/api';
import { CHAT_KEEP_PATH, chatKeepDetail, parseChatKeep, type ChatKeep } from '../model/chatKeep';
import type { Channel } from '../model/room';
import {
  isRoomMaxPeople,
  parseRoomLimits,
  roomLimitChanges,
  roomMaxPeopleOf,
  ROOM_LIMITS_PATH,
  ROOM_MAX_PEOPLE_PATH,
} from '../model/roomConfig';
import type { RoomPort } from './port';

export async function getRoomLimits(db: Db): Promise<Record<Channel, number | null>> {
  return parseRoomLimits(await db.get<unknown>(ROOM_LIMITS_PATH));
}

/** 정원 — 서버에 정해 둔 값. 없거나 범위 밖이면 null(앱 · 방 서버는 기본값). */
export async function getRoomMaxPeople(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(ROOM_MAX_PEOPLE_PATH);
  return isRoomMaxPeople(v) ? v : null;
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

export async function getChatKeep(db: Db): Promise<ChatKeep> {
  return parseChatKeep(await db.get<unknown>(CHAT_KEEP_PATH));
}

/** 바뀐 칸 + 작업 기록 한 묶음. */
export function saveChatKeep(
  db: Db,
  before: ChatKeep,
  updates: Record<string, number | null>,
): Promise<void> {
  const detail = chatKeepDetail(before, updates);
  return db.commit(withAudit(db, updates, 'settings.chatKeepDays', '대화 보관 일수', detail));
}

export function createFirebaseRoomPort(db: Db): RoomPort {
  return {
    getLimits: () => getRoomLimits(db),
    getMaxPeople: () => getRoomMaxPeople(db),
    saveLimits: (before, next) => saveRoomLimits(db, before, next),
    saveMaxPeople: (before, next) => saveRoomMaxPeople(db, before, next),
    getChatKeep: () => getChatKeep(db),
    saveChatKeep: (before, updates) => saveChatKeep(db, before, updates),
  };
}
