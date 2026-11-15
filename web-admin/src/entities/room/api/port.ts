import type { ChatKeep } from '../model/chatKeep';
import type { Channel } from '../model/room';

/** 방 쪽 원격 설정(전체 방 상한 · 정원 · 대화 보관 일수). 방 읽기 · 닫기는 D12-2 에서 이 포트에 더한다. */
export interface RoomPort {
  /** 채널별 전체 방 상한 — 칸이 없으면 null(앱 · 방 서버는 기본값). */
  getLimits(): Promise<Record<Channel, number | null>>;
  /** 방 하나 정원 — 서버에 정해 둔 값. 없거나 범위 밖이면 null. */
  getMaxPeople(): Promise<number | null>;
  /** 바뀐 게 없으면 쓰지 않는다. */
  saveLimits(
    before: Record<Channel, number | null> | null | undefined,
    next: Record<Channel, number>,
  ): Promise<void>;
  saveMaxPeople(before: number | null | undefined, next: number): Promise<void>;
  getChatKeep(): Promise<ChatKeep>;
  /** `updates` 는 바뀐 칸만(null = 지움). */
  saveChatKeep(before: ChatKeep, updates: Record<string, number | null>): Promise<void>;
}
