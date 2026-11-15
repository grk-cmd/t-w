import { describe, expect, it } from 'vitest';
import { createServerAdBannerPort } from '@/entities/ad-banner/api/server';
import { createServerBugReportPort } from '@/entities/bug-report/api/server';
import { createServerGameConfigPort } from '@/entities/game-config/api/server';
import { createServerMinVersionPort } from '@/entities/min-version/api/server';
import { createServerRoomPort } from '@/entities/room/api/server';
import { createServerOpsConfigPort } from '@/entities/server/ops-config/api/server';
import { createServerSignupFlagPort } from '@/entities/signup-flag/api/server';
import { ApiError, isPortError, type Api, type ApiSendOptions } from '@/shared/api';
import { unusedWrites } from '../shared/fakeApi';

interface Row {
  key: string;
  value: unknown;
  default: unknown;
  version: number;
}

const DEFAULTS: Record<string, unknown> = {
  'room.limits': { workingroom: 300, togetherroom: 300 },
  'room.maxPeople': 10,
  'room.serverLimits': { workingroom: 250, togetherroom: 250 },
  'room.timing': { joinWaitMs: 10_000, statsLogMs: 60_000, restoreWindowMs: 150_000 },
  'room.frame': { maxBytes: 1_048_576, maxSmallBytes: 16_384 },
  'room.minVersion': null,
  'app.minVersion': null,
  'user.inviteGate': true,
  'bug.report': { notice: '기본 안내', link: '' },
  'app.maintenance': { on: false, endsAt: null, message: null },
  'chat.keepDays': { default: 3, togetherroom: 3, workingroom: 3, secret: 3 },
  'api.cacheSec': { config: 30, card: 60, ranking: 60 },
  'api.cors': [],
  'log.level': { api: 'info', realtime: 'info' },
};

/** 설정 목록 · 한 키 쓰기 · 배너 · 카탈로그를 흉내 내는 가짜 서버. */
function fakeServer() {
  const rows = new Map<string, Row>(
    Object.entries(DEFAULTS).map(([key, def]) => [key, { key, value: null, default: def, version: 0 }]),
  );
  const calls: string[] = [];
  const puts: { path: string; body: unknown }[] = [];
  let conflictOnce = false;
  let banner = { version: 4, slides: [{ imageUrl: 'https://a.test/1.png', linkUrl: null as string | null }] };
  let unlock = { kind: 'ANIMAL_CHARACTER', key: 'animal', level: 50, label: '동물 캐릭터', version: 2 };

  const api: Api = {
    ...unusedWrites,
    async get<T>(path: string) {
      calls.push(`GET ${path}`);
      if (path === '/v2/admin/config') return [...rows.values()] as T;
      if (path === '/v2/admin/notices/launcher-banner') return banner as T;
      if (path === '/v2/admin/catalog') return { unlocks: [unlock] } as T;
      throw new Error(`모르는 길 ${path}`);
    },
    async send<T>(method: string, path: string, options?: ApiSendOptions) {
      calls.push(`${method} ${path}`);
      puts.push({ path, body: options?.body });
      const body = options?.body as { version: number; value?: unknown; slides?: never; level?: number };
      if (conflictOnce) {
        conflictOnce = false;
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
      }
      const m = /^\/v2\/admin\/config\/(.+)$/.exec(path);
      if (m) {
        const row = rows.get(m[1])!;
        if (body.version !== row.version) throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
        Object.assign(row, { value: body.value, version: row.version + 1 });
        return row as T;
      }
      if (path === '/v2/admin/notices/launcher-banner') {
        if (body.version !== banner.version) throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
        banner = { version: banner.version + 1, slides: (options!.body as typeof banner).slides };
        return undefined as T;
      }
      if (path === '/v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal') {
        unlock = { ...unlock, level: body.level!, version: unlock.version + 1 };
        return unlock as T;
      }
      throw new Error(`모르는 길 ${path}`);
    },
  };
  return {
    api,
    rows,
    calls,
    puts,
    failNext: () => {
      conflictOnce = true;
    },
    other: (key: string, value: unknown) => {
      const r = rows.get(key)!;
      Object.assign(r, { value, version: r.version + 1 });
    },
  };
}

const lastPut = (s: ReturnType<typeof fakeServer>) => s.puts.at(-1)!;

describe('설정 통로 — 목록은 한 번에 받아 카드마다 자기 키를 돌려준다', () => {
  it('카드 여럿이 한꺼번에 읽어도 목록 요청은 한 번이다', async () => {
    const s = fakeServer();
    const min = createServerMinVersionPort(s.api);
    const flags = createServerSignupFlagPort(s.api);
    const room = createServerRoomPort(s.api);
    await Promise.all([min.get('room'), min.get('app'), flags.get(), room.getMaxPeople(), room.getLimits()]);
    expect(s.calls.filter((c) => c === 'GET /v2/admin/config')).toHaveLength(1);
  });

  it('저장은 그 키를 마지막에 본 version 으로 건다 — 그 사이 다른 관리자가 고쳤으면 conflict 로 던진다', async () => {
    const s = fakeServer();
    const min = createServerMinVersionPort(s.api);
    await min.get('app');
    s.other('app.minVersion', '0.12.0');
    const error = await min.save('app', '0.13.0', null).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    // 낡은 값을 버렸으니 다음 읽기는 새 값이다
    expect(await min.get('app')).toBe('0.12.0');
  });

  it('API 주소가 없으면 «주소 없음» 으로 실패한다', async () => {
    const error = await createServerMinVersionPort(null)
      .get('app')
      .catch((e: unknown) => e);
    expect(isPortError(error, 'unreachable')).toBe(true);
  });

  it('서버가 모르는 키는 notFound', async () => {
    const s = fakeServer();
    s.rows.delete('app.minVersion');
    const error = await createServerMinVersionPort(s.api)
      .get('app')
      .catch((e: unknown) => e);
    expect(isPortError(error, 'notFound')).toBe(true);
  });
});

describe('최소 버전 · 가입 스위치 · 제보 안내', () => {
  it('최소 버전: 없으면 null, 저장은 앞뒤 빈칸을 뗀 글자', async () => {
    const s = fakeServer();
    const min = createServerMinVersionPort(s.api);
    expect(await min.get('room')).toBeNull();
    await min.save('room', ' 0.12.3 ', null);
    expect(lastPut(s)).toEqual({
      path: '/v2/admin/config/room.minVersion',
      body: { version: 0, value: '0.12.3' },
    });
    expect(await min.get('room')).toBe('0.12.3');
  });

  it('가입 스위치: inviteGate 만 있고 기존 사용자 가입은 쓸 수 없다', async () => {
    const s = fakeServer();
    const flags = createServerSignupFlagPort(s.api);
    expect(flags.flags).toEqual(['inviteGate']);
    expect((await flags.get()).inviteGate).toBe(true);
    await flags.set('inviteGate', false);
    expect(lastPut(s).body).toEqual({ version: 0, value: false });
    const error = await flags.set('existingSignup', false).catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
  });

  it('제보 안내: 글과 링크를 한 키로 통째로 쓴다 · 저장 시각이 없다', async () => {
    const s = fakeServer();
    const bug = createServerBugReportPort(s.api);
    expect(await bug.get()).toEqual({ notice: '기본 안내', link: '' });
    await bug.save(' 안내 ', ' https://open.kakao.com/o/x ');
    expect(lastPut(s).body).toEqual({
      version: 0,
      value: { notice: '안내', link: 'https://open.kakao.com/o/x' },
    });
  });
});

describe('방 설정 · 대화 보관', () => {
  it('상한은 두 채널을 한 객체로, 정원은 숫자로 쓴다', async () => {
    const s = fakeServer();
    const room = createServerRoomPort(s.api);
    expect(await room.getLimits()).toEqual({ workingroom: 300, togetherroom: 300 });
    await room.saveLimits(null, { workingroom: 400, togetherroom: 300 });
    expect(lastPut(s).body).toEqual({ version: 0, value: { workingroom: 400, togetherroom: 300 } });
    await room.saveMaxPeople(null, 20);
    expect(lastPut(s).body).toEqual({ version: 0, value: 20 });
    expect(await room.getMaxPeople()).toBe(20);
  });

  it('대화 보관: 칸을 비우면(null) 그 칸에 기본값을 써서 보낸다', async () => {
    const s = fakeServer();
    s.other('chat.keepDays', { default: 3, togetherroom: 7, workingroom: 3, secret: 1 });
    const room = createServerRoomPort(s.api);
    await room.getChatKeep();
    await room.saveChatKeep({}, { 'config/chatKeepDays/secret': null, 'config/chatKeepDays/workingroom': 5 });
    expect(lastPut(s).body).toEqual({
      version: 1,
      value: { default: 3, togetherroom: 7, workingroom: 5, secret: 3 },
    });
  });
});

describe('서버 운영 설정', () => {
  it('정수 묶음: 고친 칸만 바꾸고 묶음 밖의 칸은 받은 그대로 보낸다', async () => {
    const s = fakeServer();
    const ops = createServerOpsConfigPort(s.api);
    const timing = ops.groups.roomTiming;
    expect(timing.path).toBe('room.timing');
    expect(await ops.getIntGroup(timing)).toMatchObject({ statsLogMs: 60_000 });
    await ops.saveIntGroup(timing, 'roomServer.timing', 't', {}, { 'room.timing/statsLogMs': 30_000 });
    expect(lastPut(s).body).toEqual({
      version: 0,
      value: { joinWaitMs: 10_000, statsLogMs: 30_000, restoreWindowMs: 150_000 },
    });
  });

  it('정수 묶음: 칸을 비우면 서버 기본값을 쓴다 · 바뀐 게 없으면 요청이 없다', async () => {
    const s = fakeServer();
    s.other('api.cacheSec', { config: 10, card: 60, ranking: 60 });
    const ops = createServerOpsConfigPort(s.api);
    await ops.getIntGroup(ops.groups.apiCache);
    await ops.saveIntGroup(ops.groups.apiCache, 'settings.apiCache', 't', {}, {});
    expect(s.puts).toHaveLength(0);
    await ops.saveIntGroup(
      ops.groups.apiCache,
      'settings.apiCache',
      't',
      {},
      { 'api.cacheSec/config': null },
    );
    expect(lastPut(s).body).toEqual({ version: 1, value: { config: 30, card: 60, ranking: 60 } });
  });

  it('캐시 초 묶음은 서버 키 표를 따른다(랭킹이 있고 방 개수는 없다)', () => {
    const ops = createServerOpsConfigPort(fakeServer().api);
    expect(ops.groups.apiCache.fields.map((f) => f.key)).toEqual(['config', 'card', 'ranking']);
  });

  it('로그 수준: 비운 칸은 기본(info)으로 · 허용 출처는 목록 통째', async () => {
    const s = fakeServer();
    const ops = createServerOpsConfigPort(s.api);
    await ops.getLogLevels();
    await ops.saveLogLevels({}, { 'config/logLevel/api': 'debug', 'config/logLevel/realtime': null });
    expect(lastPut(s).body).toEqual({ version: 0, value: { api: 'debug', realtime: 'info' } });
    await ops.saveCorsOrigins([], ['https://a.example.com']);
    expect(lastPut(s).body).toEqual({ version: 0, value: ['https://a.example.com'] });
    expect(await ops.getCorsOrigins()).toEqual(['https://a.example.com']);
  });

  it('점검 안내: 켜기 · 끝 시각 · 문구를 세 칸 모두 보낸다', async () => {
    const s = fakeServer();
    const { maintenance } = createServerOpsConfigPort(s.api);
    expect(await maintenance!.get()).toEqual({ on: false, endsAt: null, message: null });
    await maintenance!.save({ on: true, endsAt: '2026-11-20T03:00:00.000Z', message: ' 점검 중 ' });
    expect(lastPut(s)).toEqual({
      path: '/v2/admin/config/app.maintenance',
      body: { version: 0, value: { on: true, endsAt: '2026-11-20T03:00:00.000Z', message: '점검 중' } },
    });
    await maintenance!.save({ on: false, endsAt: null, message: '  ' });
    expect(lastPut(s).body).toEqual({ version: 1, value: { on: false, endsAt: null, message: null } });
  });

  it('방 서버 한 대의 방 상한: 기본 250 · 두 채널을 한 객체로', async () => {
    const s = fakeServer();
    const { serverLimits } = createServerOpsConfigPort(s.api);
    expect(await serverLimits!.get()).toEqual({ workingroom: 250, togetherroom: 250 });
    await serverLimits!.save({ workingroom: 100, togetherroom: 250 });
    expect(lastPut(s).body).toEqual({ version: 0, value: { workingroom: 100, togetherroom: 250 } });
  });
});

describe('런처 배너 · 동물 해금 레벨', () => {
  it('배너: 서버 칸 이름을 화면 칸으로 바꿔 읽고, 읽은 version 으로 쓴다', async () => {
    const s = fakeServer();
    const ad = createServerAdBannerPort(s.api);
    expect(await ad.get()).toEqual([{ img: 'https://a.test/1.png', link: '' }]);
    await ad.save([
      { img: 'https://a.test/2.png', link: 'https://l.test' },
      { img: 'https://a.test/3.png', link: '' },
    ]);
    expect(lastPut(s)).toEqual({
      path: '/v2/admin/notices/launcher-banner',
      body: {
        version: 4,
        slides: [
          { imageUrl: 'https://a.test/2.png', linkUrl: 'https://l.test' },
          { imageUrl: 'https://a.test/3.png', linkUrl: null },
        ],
      },
    });
  });

  it('배너: 다른 곳에서 먼저 고쳤으면 conflict', async () => {
    const s = fakeServer();
    const ad = createServerAdBannerPort(s.api);
    await ad.get();
    s.failNext();
    const error = await ad.save([]).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
  });

  it('해금 레벨: 카탈로그 unlocks 에서 읽고, label · version 을 실어 쓴다', async () => {
    const s = fakeServer();
    const game = createServerGameConfigPort(s.api);
    expect(await game.getAnimalUnlockLevel()).toBe(50);
    await game.saveAnimalUnlockLevel(30);
    expect(lastPut(s)).toEqual({
      path: '/v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal',
      body: { version: 2, level: 30, label: '동물 캐릭터' },
    });
  });
});
