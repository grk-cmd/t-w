import type { Versioned } from '@/shared/api';
import type { ChatKeep } from '../model/chatKeep';
import type { Channel, LiveRooms, RoomIndexEntry, RoomProbe, RoomStats } from '../model/room';
import type { RoomLimits } from '../model/roomConfig';

/** 서버가 한 번에 받는 방 코드 수(API 판). */
export const CLOSE_MAX = 500;

/** 방 닫기 결과 — 닫은 방과, 이미 없어서 못 닫은 방. */
export interface CloseResult {
  closed: string[];
  missing: string[];
}

/** 방 제목 금칙어 — API 판에만 있다(서버 키 `room.bannedWords`). Firebase 판은 null(0.13 판의 Firebase 카드는 이 판에 넣지 않는다 — D12-M). */
export interface BannedWordsControl {
  /** 지금 먹는 목록 — 저장한 값이 없으면 서버 기본값(빈 목록). */
  get(): Promise<Versioned<string[]>>;
  /** 목록을 통째로 쓴다(빈 목록 = 거르지 않음). 그 사이 다른 곳이 고쳤으면 `conflict`. */
  save(from: Versioned<string[]>, next: readonly string[]): Promise<void>;
}

/** 방 쪽 — 원격 설정(전체 방 상한 · 정원 · 대화 보관 일수)과 열린 방 보기 · 닫기. */
export interface RoomPort {
  /** 이 판에서 되는 화면 일 — 유령 방 청소(Firebase 판 전용) · 방의 «마지막 신호» 칸(방이 realtime 메모리인 API 판에는 없다). */
  readonly features: { ghostCleanup: boolean; lastSeen: boolean };
  /** 한 번에 닫을 수 있는 방 수 — 제한이 없는 판은 null. 화면이 고르는 수를 여기에 맞춘다. */
  readonly closeMax: number | null;
  /** 상한 카드 안내 끝에 붙일 이 판만의 설명(없으면 ''). Firebase 판은 방 서버 장부 등록에 따라 세는 법이 달라 그것을 적는다. */
  readonly limitsNote: string;
  readonly bannedWords: BannedWordsControl | null;
  /** 채널별 전체 방 상한 — 저장된 값 · 기본값(API 판은 서버 기본값 · Firebase 판은 옛 앱 기본값). */
  getLimits(): Promise<Versioned<RoomLimits>>;
  /** 방 하나 정원 — 서버에 정해 둔 값. 없으면 null. */
  getMaxPeople(): Promise<Versioned<number | null>>;
  /** 저장은 화면이 읽은 값 · 번호(`from`)로 한다 — 그 사이 바뀌었으면 `conflict`. 바뀐 게 없으면 쓰지 않는다. */
  saveLimits(from: Versioned<RoomLimits>, next: Record<Channel, number>): Promise<void>;
  saveMaxPeople(from: Versioned<number | null>, next: number): Promise<void>;
  getChatKeep(): Promise<Versioned<ChatKeep>>;
  /** `updates` 는 바뀐 칸만(null = 지움). */
  saveChatKeep(from: Versioned<ChatKeep>, updates: Record<string, number | null>): Promise<void>;

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
  /** 방들을 닫고 기록 한 줄 — `closeMax` 를 넘으면 `invalid`. Firebase 판은 한 묶음이라 하나라도 막히면 아무 방도 지워지지 않는다. */
  close(codes: readonly string[]): Promise<CloseResult>;
  /** 방을 전부 닫는다. */
  closeAll(): Promise<CloseResult>;
}
