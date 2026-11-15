// API 판 — 설정 키 `api.cacheSec` · `room.frame` · `room.timing` · `log.level` · `api.cors`, 그리고 API 판에만 있는 `app.maintenance` · `room.serverLimits`.
// 값이 여럿인 키는 화면이 읽은 값에 고친 칸만 바꿔 통째로 보낸다(칸을 비우면 그 칸에 기본값). 하루 한도는 키 하나가 값 하나라
// 키마다 따로 저장하고, 비우면 `DELETE …?version=` 으로 값을 비워 기본값을 따르게 한다.
// 읽은 번호(`version`)는 화면이 들고 있다가 저장에 돌려준다 — 포트는 기억하지 않는다.
import {
  opsConfigClient,
  PortError,
  wireArray,
  wireBool,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  type Api,
  type Versioned,
} from '@/shared/api';
import {
  isLogLevel,
  LOG_LEVEL_PATH,
  LOG_TARGETS,
  MAINTENANCE_MESSAGE_MAX,
  ROOM_FRAME,
  ROOM_TIMING,
  type IntGroup,
  type IntValues,
  type LogLevels,
  type Maintenance,
  type ServerLimits,
} from '../model/opsConfig';
import type { OpsConfigPort, OpsGroups } from './port';

/** 값 하나짜리 키를 칸 하나인 묶음으로 — 칸 이름은 `value`, 묶음의 `path` 가 키 이름이다. */
function dailyLimit(
  key: string,
  label: string,
  min: number,
  max: number,
  def: number,
  unit: string,
): IntGroup {
  return { path: key, fields: [{ key: 'value', label, min, max, def, unit }] };
}

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
  roomTiming: { ...ROOM_TIMING, path: 'room.timing' },
  // 하루 한도 — 서버 설정 키 `user.signupDailyMax` · `guestbook.clapDailyMax` · `gift.dailySendMax`. 키 하나 = 묶음 하나 = 저장 한 번.
  dailyLimits: [
    dailyLimit('user.signupDailyMax', '가입 하루 상한', 1, 100_000, 2000, '명'),
    dailyLimit('guestbook.clapDailyMax', '웹박수 하루 횟수', 1, 100, 5, '번'),
    dailyLimit('gift.dailySendMax', '선물 하루 보내기', 1, 100, 10, '번'),
  ],
};

type Raw = NonNullable<Versioned<unknown>['raw']>;

/** 화면이 읽을 때 붙인 통째 값 — 없으면 이 판의 읽기를 거치지 않은 것이라 코드 실수다. */
function rawOf(from: Versioned<unknown>, key: string): Raw {
  if (!from.raw) throw new PortError('invalid', `읽은 값이 이 판의 것이 아니에요 (${key})`);
  return from.raw;
}

/** `<키>/<칸>` → 칸 이름. */
const fieldOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** 묶음의 칸마다 숫자여야 한다 — 서버는 비운 칸에도 기본값을 값으로 준다. */
function intsOf(group: IntGroup, effective: unknown): IntValues {
  const o = wireObject(effective, group.path);
  return Object.fromEntries(group.fields.map((f) => [f.key, wireNumber(o[f.key], `${group.path}.${f.key}`)]));
}

function logLevelsOf(effective: unknown): LogLevels {
  const o = wireObject(effective, 'log.level');
  const out: LogLevels = {};
  for (const { key } of LOG_TARGETS) {
    const v = o[key];
    if (!isLogLevel(v)) throw wireError(`log.level.${key}`, 'debug · info · warn · error');
    out[key] = v;
  }
  return out;
}

function maintenanceOf(effective: unknown): Maintenance {
  const o = wireObject(effective, 'app.maintenance');
  return {
    on: wireBool(o.on, 'app.maintenance.on'),
    endsAt: wireNullableString(o.endsAt, 'app.maintenance.endsAt'),
    message: wireNullableString(o.message, 'app.maintenance.message'),
  };
}

function serverLimitsOf(effective: unknown): ServerLimits {
  const o = wireObject(effective, 'room.serverLimits');
  return {
    workingroom: wireNumber(o.workingroom, 'room.serverLimits.workingroom'),
    togetherroom: wireNumber(o.togetherroom, 'room.serverLimits.togetherroom'),
  };
}

export function createServerOpsConfigPort(api: Api | null): OpsConfigPort {
  const config = opsConfigClient(api);

  /** 키 하나를 읽어 `parse` 한 값에 번호 · 통째 값을 붙인다. */
  async function read<T>(key: string, parse: (effective: unknown) => T): Promise<Versioned<T>> {
    const { effective, default: defaults, version } = await config.read(key);
    return { value: parse(effective), version, raw: { effective, defaults } };
  }

  return {
    groups: SERVER_GROUPS,
    getIntGroup: (group) =>
      read(group.path, (effective) =>
        // 하루 한도는 키 하나가 숫자 하나 — 칸 이름 `value` 로 담는다.
        SERVER_GROUPS.dailyLimits?.includes(group)
          ? { value: wireNumber(effective, group.path) }
          : intsOf(group, effective),
      ),
    getLogLevels: () => read('log.level', logLevelsOf),
    getCorsOrigins: () =>
      read('api.cors', (effective) =>
        wireArray(effective, 'api.cors').map((o, i) => wireString(o, `api.cors[${i}]`)),
      ),
    async saveIntGroup(group, _action, _target, from, updates) {
      const changed = Object.entries(updates);
      if (!changed.length) return;
      if (SERVER_GROUPS.dailyLimits?.includes(group)) {
        // 키 하나 = 저장 한 번 — 여러 키를 이어 보내면 앞 것만 저장되고 뒤 것이 실패하는 일이 생긴다.
        if (changed.length !== 1) throw new PortError('invalid', '하루 한도는 한 번에 한 가지만 저장해요');
        const [[, value]] = changed;
        if (value === null) await config.clear(group.path, from.version);
        else await config.write(group.path, from.version, value);
        return;
      }
      const { effective, defaults } = rawOf(from, group.path);
      const next = { ...wireObject(effective, group.path) };
      const fallback = wireObject(defaults, `${group.path} 기본값`);
      for (const [path, value] of changed) {
        const field = fieldOf(path);
        next[field] = value ?? fallback[field];
      }
      await config.write(group.path, from.version, next);
    },
    async saveLogLevels(from, updates) {
      if (!Object.keys(updates).length) return;
      const { effective, defaults } = rawOf(from, 'log.level');
      const next = { ...wireObject(effective, 'log.level') };
      const fallback = wireObject(defaults, 'log.level 기본값');
      for (const [path, value] of Object.entries(updates)) {
        const target = path.slice(LOG_LEVEL_PATH.length + 1);
        next[target] = value ?? fallback[target];
      }
      await config.write('log.level', from.version, next);
    },
    async saveCorsOrigins(from, next) {
      await config.write('api.cors', from.version, next);
    },
    maintenance: {
      get: () => read('app.maintenance', maintenanceOf),
      async save(from, next: Maintenance) {
        await config.write('app.maintenance', from.version, {
          on: next.on,
          endsAt: next.endsAt,
          message: next.message?.trim().slice(0, MAINTENANCE_MESSAGE_MAX) || null,
        });
      },
    },
    serverLimits: {
      get: () => read('room.serverLimits', serverLimitsOf),
      async save(from, next) {
        await config.write('room.serverLimits', from.version, {
          workingroom: next.workingroom,
          togetherroom: next.togetherroom,
        });
      },
    },
  };
}
