// API 판 — 설정 키 `api.cacheSec` · `room.frame` · `room.timing` · `log.level` · `api.cors`, 그리고 API 판에만 있는 `app.maintenance` · `room.serverLimits`.
// 정수 묶음 칸을 비운 저장(= 기본값 따르기)은 그 칸에 기본값을 써서 보낸다. 값이 여럿인 키는 받은 값에 고친 칸만 바꿔 통째로 보낸다.
import { opsConfigClient, type Api } from '@/shared/api';
import {
  LOG_LEVEL_PATH,
  MAINTENANCE_MESSAGE_MAX,
  parseCorsOrigins,
  parseIntGroup,
  parseLogLevels,
  ROOM_FRAME,
  ROOM_TIMING,
  SERVER_LIMIT_CHANNELS,
  SERVER_LIMIT_DEFAULT,
  type IntGroup,
  type Maintenance,
  type ServerLimits,
} from '../model/opsConfig';
import type { OpsConfigPort, OpsGroups } from './port';

/** 서버 칸 이름이 길 이름이다 — 묶음의 `path` 에 키 이름을 적어 두고 `<키>/<칸>` 으로 쓴다. */
const SERVER_GROUPS: OpsGroups = {
  apiCache: {
    path: 'api.cacheSec',
    fields: [
      { key: 'config', label: '원격 설정 /v2/config', min: 0, max: 600, def: 30, unit: '초' },
      { key: 'card', label: '명함', min: 0, max: 600, def: 60, unit: '초' },
      { key: 'ranking', label: '랭킹', min: 0, max: 600, def: 60, unit: '초' },
    ],
  },
  roomFrame: { ...ROOM_FRAME, path: 'room.frame' },
  // 방 타이밍 — 서버에는 아홉 칸이 있다. Firebase 판 화면의 세 칸에 나머지 여섯 칸(앱 · 방 서버가 읽는 값)을 더했다.
  roomTiming: {
    path: 'room.timing',
    fields: [
      { key: 'joinWaitMs', label: '입장 대기', min: 3000, max: 60_000, def: 10_000, unit: 'ms' },
      {
        key: 'clientGiveUpMs',
        label: '앱이 다시 붙기를 포기하는 시간',
        min: 15_000,
        max: 600_000,
        def: 90_000,
        unit: 'ms',
      },
      { key: 'graceMs', label: '끊긴 뒤 자리를 붙잡는 시간', min: 0, max: 600_000, def: 20_000, unit: 'ms' },
      { key: 'pingIntervalMs', label: 'ping 주기', min: 1000, max: 120_000, def: 25_000, unit: 'ms' },
      { key: 'refreshMs', label: '설정 다시 읽기', min: 5000, max: 600_000, def: 60_000, unit: 'ms' },
      ...ROOM_TIMING.fields,
      { key: 'chatBatchMs', label: '채팅 묶음 간격', min: 0, max: 1000, def: 200, unit: 'ms' },
    ],
  },
  // 하루 한도 — 키마다 따로(서버 설정 키 `user.signupDailyMax` · `guestbook.clapDailyMax` · `gift.dailySendMax`). 묶음의 칸 이름이 키 이름이다.
  dailyLimits: {
    path: 'daily',
    fields: [
      { key: 'user.signupDailyMax', label: '가입 하루 상한', min: 1, max: 100_000, def: 2000, unit: '명' },
      { key: 'guestbook.clapDailyMax', label: '웹박수 하루 횟수', min: 1, max: 100, def: 5, unit: '번' },
      { key: 'gift.dailySendMax', label: '선물 하루 보내기', min: 1, max: 100, def: 10, unit: '번' },
    ],
  },
};

const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

/** `<키>/<칸>` → 칸 이름. */
const fieldOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function createServerOpsConfigPort(api: Api | null): OpsConfigPort {
  const config = opsConfigClient(api);
  // 묶음 밖의 칸(방 타이밍의 나머지 여섯 칸 등)은 받은 값 그대로 둔다.
  const keyOf = (group: IntGroup) => group.path;

  return {
    groups: SERVER_GROUPS,
    async getIntGroup(group) {
      if (group === SERVER_GROUPS.dailyLimits) {
        // 키마다 따로인 묶음 — 칸 이름이 키 이름이다.
        const rows = await Promise.all(group.fields.map((f) => config.read(f.key)));
        return parseIntGroup(
          group,
          Object.fromEntries(group.fields.map((f, i) => [f.key, rows[i].effective])),
        );
      }
      return parseIntGroup(group, (await config.read(keyOf(group))).effective);
    },
    async getLogLevels() {
      return parseLogLevels((await config.read('log.level')).effective);
    },
    async getCorsOrigins() {
      return parseCorsOrigins((await config.read('api.cors')).effective);
    },
    async saveIntGroup(group, _action, _target, _before, updates) {
      if (!Object.keys(updates).length) return;
      if (group === SERVER_GROUPS.dailyLimits) {
        // 키마다 한 번씩 — 비운 칸(null)은 그 키의 기본값으로
        for (const [path, value] of Object.entries(updates)) {
          const key = fieldOf(path);
          await config.update(key, (_current, defaults) => value ?? defaults);
        }
        return;
      }
      await config.update(keyOf(group), (current, defaults) => {
        const next = { ...object(current) };
        for (const [path, value] of Object.entries(updates)) {
          const field = fieldOf(path);
          next[field] = value ?? object(defaults)[field];
        }
        return next;
      });
    },
    async saveLogLevels(_before, updates) {
      if (!Object.keys(updates).length) return;
      await config.update('log.level', (current, defaults) => {
        const next = { ...object(current) };
        for (const [path, value] of Object.entries(updates)) {
          const target = path.slice(LOG_LEVEL_PATH.length + 1);
          next[target] = value ?? object(defaults)[target];
        }
        return next;
      });
    },
    async saveCorsOrigins(_before, next) {
      await config.update('api.cors', () => next);
    },
    maintenance: {
      async get() {
        const v = object((await config.read('app.maintenance')).effective);
        return {
          on: v.on === true,
          endsAt: typeof v.endsAt === 'string' ? v.endsAt : null,
          message: typeof v.message === 'string' ? v.message : null,
        };
      },
      async save(next: Maintenance) {
        await config.update('app.maintenance', () => ({
          on: next.on,
          endsAt: next.endsAt,
          message: next.message?.trim().slice(0, MAINTENANCE_MESSAGE_MAX) || null,
        }));
      },
    },
    serverLimits: {
      async get(): Promise<ServerLimits> {
        const v = object((await config.read('room.serverLimits')).effective);
        const pick = (ch: (typeof SERVER_LIMIT_CHANNELS)[number]) =>
          typeof v[ch] === 'number' ? (v[ch] as number) : SERVER_LIMIT_DEFAULT;
        return { workingroom: pick('workingroom'), togetherroom: pick('togetherroom') };
      },
      async save(next) {
        await config.update('room.serverLimits', () => ({
          workingroom: next.workingroom,
          togetherroom: next.togetherroom,
        }));
      },
    },
  };
}
