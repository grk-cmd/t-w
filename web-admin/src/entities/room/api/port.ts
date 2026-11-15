import type { ChatKeep } from '../model/chatKeep';
import type { Channel, LiveRooms, RoomIndexEntry, RoomProbe, RoomStats } from '../model/room';

/** 방 쪽 — 원격 설정(전체 방 상한 · 정원 · 대화 보관 일수)과 열린 방 보기 · 닫기. */
export interface RoomPort {
  /** 이 판에서 되는 화면 일 — 유령 방 청소(Firebase 판 전용) · 방의 «마지막 신호» 칸(방이 realtime 메모리인 API 판에는 없다). */
  readonly features: { ghostCleanup: boolean; lastSeen: boolean };
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

  /** roomIndex 의 줄(방당 수십 바이트). */
  getIndex(): Promise<Record<string, RoomIndexEntry>>;
  /** rooms 의 방 코드만 — 본체(멤버 · 대화 · 사진)는 받지 않는다. */
  getCodes(): Promise<string[]>;
  /** 방마다 인원 수 · 사람 · `withSeen` 방의 마지막 신호. */
  probeRooms(codes: readonly string[], withSeen: ReadonlySet<string>): Promise<Record<string, RoomProbe>>;
  getStats(): Promise<RoomStats | null>;
  /** 방 서버에 지금 열린 방. 이 환경에 API 가 없으면 null. */
  getLive(): Promise<LiveRooms | null>;
  /** 서버 시각 − 이 PC 시각(ms). */
  serverTimeOffset(): Promise<number>;
  /** 방들을 한 묶음으로 닫고 기록 한 줄 — 하나라도 막히면 아무 방도 지워지지 않는다. */
  close(codes: readonly string[]): Promise<void>;
  /** 방을 전부 닫는다. 닫은 방 코드를 돌려준다. */
  closeAll(): Promise<string[]>;
}
