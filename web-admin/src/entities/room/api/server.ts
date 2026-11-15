// API 판 — 설정 키 `room.limits` · `room.maxPeople` · `chat.keepDays`. 서버는 칸이 비면 기본값을 값으로 돌려준다(null 이 없다).
// 칸을 비우는 저장(= 기본값 따르기)은 그 칸에 기본값을 써서 보낸다. 값이 여럿인 키는 받은 값에 고친 칸만 바꿔 통째로 보낸다.
import { opsConfigClient, type Api } from '@/shared/api';
import { CHAT_KEEP_PATH, parseChatKeep } from '../model/chatKeep';
import type { Channel } from '../model/room';
import { parseRoomLimits, isRoomMaxPeople } from '../model/roomConfig';
import type { RoomPort } from './port';

const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

export function createServerRoomPort(api: Api | null): RoomPort {
  const config = opsConfigClient(api);
  return {
    async getLimits() {
      return parseRoomLimits((await config.read('room.limits')).effective);
    },
    async getMaxPeople() {
      const { effective } = await config.read('room.maxPeople');
      return isRoomMaxPeople(effective) ? effective : null;
    },
    async saveLimits(_before, next: Record<Channel, number>) {
      await config.update('room.limits', () => ({
        workingroom: next.workingroom,
        togetherroom: next.togetherroom,
      }));
    },
    async saveMaxPeople(_before, next) {
      await config.update('room.maxPeople', () => next);
    },
    async getChatKeep() {
      return parseChatKeep((await config.read('chat.keepDays')).effective);
    },
    async saveChatKeep(_before, updates) {
      await config.update('chat.keepDays', (current, defaults) => {
        const next = { ...object(current) };
        for (const [path, value] of Object.entries(updates)) {
          const kind = path.slice(CHAT_KEEP_PATH.length + 1);
          next[kind] = value ?? object(defaults)[kind];
        }
        return next;
      });
    },
  };
}
