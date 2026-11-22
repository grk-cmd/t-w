// API 판 — 설정 키 `room.limits` · `room.maxPeople` · `chat.keepDays`. 서버는 칸이 비면 기본값을 값으로 돌려준다(null 이 없다).
// 칸을 비우는 저장(= 기본값 따르기)은 그 칸에 기본값을 써서 보낸다. 값이 여럿인 키는 화면이 읽은 값에 고친 칸만 바꿔 통째로 보낸다.
// 읽은 번호(`version`)는 화면이 들고 있다가 저장에 돌려준다 — 포트는 기억하지 않는다.
import { opsConfigClient, PortError, wireNumber, wireObject, type Api, type Versioned } from '@/shared/api';
import { CHAT_KEEP_PATH, type ChatKeep } from '../model/chatKeep';
import type { Channel } from '../model/room';
import type { RoomLimits } from '../model/roomConfig';
import { CLOSE_MAX, type RoomPort } from './port';
import { createServerRoomBoard } from './serverBoard';

type Raw = NonNullable<Versioned<unknown>['raw']>;

/** 화면이 읽을 때 붙인 통째 값 — 없으면 이 판의 읽기를 거치지 않은 것이라 코드 실수다. */
function rawOf(from: Versioned<unknown>, key: string): Raw {
  if (!from.raw) throw new PortError('invalid', `읽은 값이 이 판의 것이 아니에요 (${key})`);
  return from.raw;
}

/** `room.limits` 값 — 채널마다 숫자(서버는 비운 칸에도 기본값을 값으로 준다). */
function limitsOf(raw: unknown, name: string): Record<Channel, number> {
  const o = wireObject(raw, name);
  return {
    workingroom: wireNumber(o.workingroom, `${name}.workingroom`),
    togetherroom: wireNumber(o.togetherroom, `${name}.togetherroom`),
  };
}

export function createServerRoomPort(api: Api | null): RoomPort {
  const config = opsConfigClient(api);
  const board = createServerRoomBoard(api);
  return {
    async getLimits() {
      const { effective, default: defaults, version } = await config.read('room.limits');
      const value: RoomLimits = {
        saved: limitsOf(effective, 'room.limits'),
        defaults: limitsOf(defaults, 'room.limits 기본값'),
      };
      return { value, version, raw: { effective, defaults } };
    },
    async getMaxPeople() {
      const { effective, default: defaults, version } = await config.read('room.maxPeople');
      return { value: wireNumber(effective, 'room.maxPeople'), version, raw: { effective, defaults } };
    },
    async saveLimits(from, next) {
      await config.write('room.limits', from.version, {
        workingroom: next.workingroom,
        togetherroom: next.togetherroom,
      });
    },
    async saveMaxPeople(from, next) {
      await config.write('room.maxPeople', from.version, next);
    },
    async getChatKeep() {
      const { effective, default: defaults, version } = await config.read('chat.keepDays');
      const value: ChatKeep = Object.fromEntries(
        Object.entries(wireObject(effective, 'chat.keepDays')).map(([k, d]) => [
          k,
          wireNumber(d, `chat.keepDays.${k}`),
        ]),
      );
      return { value, version, raw: { effective, defaults } };
    },
    ...board,
    features: { ghostCleanup: false, lastSeen: false, liveLoad: true },
    closeMax: CLOSE_MAX,
    limitsNote: '',
    async saveChatKeep(from, updates) {
      const { effective, defaults } = rawOf(from, 'chat.keepDays');
      const base = wireObject(effective, 'chat.keepDays');
      const fallback = wireObject(defaults, 'chat.keepDays 기본값');
      const next = { ...base };
      for (const [path, value] of Object.entries(updates)) {
        const kind = path.slice(CHAT_KEEP_PATH.length + 1);
        next[kind] = value ?? wireNumber(fallback[kind], `chat.keepDays 기본값의 ${kind}`);
      }
      await config.write('chat.keepDays', from.version, next);
    },
  };
}
