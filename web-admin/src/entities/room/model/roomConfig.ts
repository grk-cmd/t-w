import { CHANNEL_LABEL, type Channel } from './room';

// 원격 설정 — 앱 · 방 서버가 읽는 방 규칙. 범위는 규칙 .validate 와 같다.
// config/roomLimits = { workingroom, togetherroom } — 채널별 전체 방 상한(Firebase 판). API 판은 서버 설정 키 `room.limits`.
export const ROOM_LIMITS_PATH = 'config/roomLimits';
export const ROOM_TOTAL_LIMIT_MIN = 1;
export const ROOM_TOTAL_LIMIT_MAX = 10_000;
// config/roomMaxPeople — 방 하나 정원. 없으면 기본값.
export const ROOM_MAX_PEOPLE_PATH = 'config/roomMaxPeople';
export const ROOM_MAX_PEOPLE_DEFAULT = 10;
export const ROOM_MAX_PEOPLE_MIN = 2;
export const ROOM_MAX_PEOPLE_MAX = 50;

export const ROOM_LIMIT_CHANNELS: readonly Channel[] = ['workingroom', 'togetherroom'];

const intIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 입력 글자 → 정수. 숫자만이 아니거나 범위 밖이면 null. */
export function parseIntInput(text: string, min: number, max: number): number | null {
  const t = text.trim();
  if (!/^[0-9]+$/.test(t)) return null;
  const n = Number(t);
  return intIn(n, min, max) ? n : null;
}

export const isRoomTotalLimit = (v: unknown): v is number =>
  intIn(v, ROOM_TOTAL_LIMIT_MIN, ROOM_TOTAL_LIMIT_MAX);

export const isRoomMaxPeople = (v: unknown): v is number =>
  intIn(v, ROOM_MAX_PEOPLE_MIN, ROOM_MAX_PEOPLE_MAX);

/** 서버 값 → 채널별 상한. 칸이 없거나 틀리면 null(앱 · 방 서버는 기본값). */
export function parseRoomLimits(raw: unknown): Record<Channel, number | null> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    workingroom: isRoomTotalLimit(o.workingroom) ? o.workingroom : null,
    togetherroom: isRoomTotalLimit(o.togetherroom) ? o.togetherroom : null,
  };
}

/**
 * 채널별 전체 방 상한 — 저장된 값(칸이 없으면 null)과 기본값. API 판은 서버가 비운 칸도 기본값으로 채워 주어 saved 가 null 이 아니다.
 * 기본값은 서버가 알려 줄 때만 있다(API 판 `room.limits` 의 기본값). Firebase 판은 null — 칸이 비면 앱마다 자기 기본값을 쓴다.
 */
export interface RoomLimits {
  saved: Record<Channel, number | null>;
  defaults: Record<Channel, number> | null;
}

/** 지금 적용되는 전체 상한 — 칸이 없으면 기본값 · 기본값도 모르면 null. */
export const totalLimitOf = (limits: RoomLimits | null | undefined, ch: Channel): number | null =>
  limits?.saved[ch] ?? limits?.defaults?.[ch] ?? null;

export const roomMaxPeopleOf = (saved: number | null | undefined): number => saved ?? ROOM_MAX_PEOPLE_DEFAULT;

/** 바뀐 채널만 «워킹룸 400 → 500» — 전에 칸이 없었고 기본값도 모르면 «기본값 → 500». */
export function roomLimitChanges(
  before: RoomLimits | null | undefined,
  next: Record<Channel, number>,
): string[] {
  return ROOM_LIMIT_CHANNELS.filter((ch) => before?.saved[ch] !== next[ch]).map(
    (ch) => `${CHANNEL_LABEL[ch]} ${totalLimitOf(before, ch) ?? '기본값'} → ${next[ch]}`,
  );
}
