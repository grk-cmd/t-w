import { useMutation } from '@tanstack/react-query';
import {
  CHANNEL_LABEL,
  parseIntInput,
  ROOM_LIMIT_CHANNELS,
  ROOM_MAX_PEOPLE_MAX,
  ROOM_MAX_PEOPLE_MIN,
  ROOM_TOTAL_LIMIT_MAX,
  ROOM_TOTAL_LIMIT_MIN,
  roomLimitChanges,
  roomMaxPeopleOf,
  saveRoomLimits,
  saveRoomMaxPeople,
  useRefreshRoomConfig,
  type Channel,
} from '@/entities/room';
import { useDb } from '@/shared/api';

export type RoomLimitInputs = Record<Channel, string>;
type Saved = Record<Channel, number | null> | null | undefined;
type Check<T> = { ok: true; next: T } | { ok: false; error: string };

/** 저장 뒤 안내 — 앱은 다음에 읽을 때 바로, 방 서버는 1분마다 다시 읽는다. */
export const APPLY_NOTE = '앱은 바로 · 방 서버는 1분 안에 반영';

export function checkRoomLimits(saved: Saved, inputs: RoomLimitInputs): Check<Record<Channel, number>> {
  const next = {} as Record<Channel, number>;
  for (const ch of ROOM_LIMIT_CHANNELS) {
    const n = parseIntInput(inputs[ch], ROOM_TOTAL_LIMIT_MIN, ROOM_TOTAL_LIMIT_MAX);
    if (n === null)
      return {
        ok: false,
        error: `${CHANNEL_LABEL[ch]} — ${ROOM_TOTAL_LIMIT_MIN}~${ROOM_TOTAL_LIMIT_MAX} 사이 정수`,
      };
    next[ch] = n;
  }
  if (!roomLimitChanges(saved, next).length) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next };
}

export function roomLimitsConfirmText(saved: Saved, next: Record<Channel, number>): string {
  return `전체 방 상한 ${roomLimitChanges(saved, next).join(' · ')} — 이미 열린 방은 그대로이고 새 방부터 적용돼요. ${APPLY_NOTE}.`;
}

export function checkRoomMaxPeople(saved: number | null | undefined, input: string): Check<number> {
  const n = parseIntInput(input, ROOM_MAX_PEOPLE_MIN, ROOM_MAX_PEOPLE_MAX);
  if (n === null) return { ok: false, error: `${ROOM_MAX_PEOPLE_MIN}~${ROOM_MAX_PEOPLE_MAX} 사이 정수` };
  if (n === saved) return { ok: false, error: '지금 값과 같음' };
  return { ok: true, next: n };
}

export function roomMaxPeopleConfirmText(saved: number | null | undefined, next: number): string {
  return `방 정원 ${roomMaxPeopleOf(saved)}명 → ${next}명 — 이미 방에 있는 사람은 그대로이고 새로 들어오는 사람부터 적용돼요. ${APPLY_NOTE}.`;
}

export function useSaveRoomLimits() {
  const db = useDb();
  const refresh = useRefreshRoomConfig();
  return useMutation({
    mutationFn: ({ saved, next }: { saved: Saved; next: Record<Channel, number> }) =>
      saveRoomLimits(db, saved, next),
    onSuccess: refresh,
  });
}

export function useSaveRoomMaxPeople() {
  const db = useDb();
  const refresh = useRefreshRoomConfig();
  return useMutation({
    mutationFn: ({ saved, next }: { saved: number | null | undefined; next: number }) =>
      saveRoomMaxPeople(db, saved, next),
    onSuccess: refresh,
  });
}
