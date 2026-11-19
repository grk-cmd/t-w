import { describe, expect, it } from 'vitest';
import { createServerAdBannerPort } from '@/entities/ad-banner/api/server';
import { createServerBugDailyMaxPort } from '@/entities/bug-board/api/server';
import { createServerBugReportPort } from '@/entities/bug-report/api/server';
import { createServerGameConfigPort } from '@/entities/game-config/api/server';
import { createServerMinVersionPort } from '@/entities/min-version/api/server';
import { createServerRoomPort } from '@/entities/room/api/server';
import { createServerOpsConfigPort } from '@/entities/server/ops-config/api/server';
import { createServerSignupFlagPort } from '@/entities/signup-flag/api/server';
import {
  ApiError,
  isPortError,
  opsConfigClient,
  resetPortState,
  type Api,
  type ApiSendOptions,
} from '@/shared/api';
import { unusedWrites } from '../shared/fakeApi';

interface Row {
  key: string;
  value: unknown;
  default: unknown;
  version: number;
}

const DEFAULTS: Record<string, unknown> = {
  'room.limits': { workingroom: 500, togetherroom: 500 },
  'room.maxPeople': 10,
  'room.timing': {
    joinWaitMs: 10_000,
    roomStatsRefreshMs: 15_000,
    statsLogMs: 60_000,
    restoreWindowMs: 150_000,
  },
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
  'user.signupDailyMax': 2000,
  'guestbook.clapDailyMax': 5,
  'gift.dailySendMax': 10,
  'room.bannedWords': [],
  'bug.dailyMax': 5,
};

/** 설정 목록 · 한 키 쓰기 · 배너 · 카탈로그를 흉내 내는 가짜 서버. */
function fakeServer() {
  const rows = new Map<string, Row>(
    Object.entries(DEFAULTS).map(([key, def]) => [key, { key, value: null, default: def, version: 0 }]),
  );
  const calls: string[] = [];
  const puts: { path: string; body: unknown; method: string; query?: unknown }[] = [];
  let conflictOnce = false;
  let failOnce: ApiError | null = null;
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
      puts.push({ path, body: options?.body, method, query: options?.query });
      const body = options?.body as { version: number; value?: unknown; slides?: never; level?: number };
      if (failOnce) {
        const error = failOnce;
        failOnce = null;
        throw error;
      }
      if (conflictOnce) {
        conflictOnce = false;
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
      }
      const m = /^\/v2\/admin\/config\/(.+)$/.exec(path);
      if (m && method === 'DELETE') {
        const row = rows.get(m[1])!;
        if (options?.query?.version !== row.version)
          throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
        Object.assign(row, { value: null, version: row.version + 1 });
        return row as T;
      }
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
        if (body.version !== unlock.version) throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '겹침');
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
    /** 다음 쓰기 한 번을 이 서버 오류로 거절한다. */
    rejectNext: (error: ApiError) => {
      failOnce = error;
    },
    other: (key: string, value: unknown) => {
      const r = rows.get(key)!;
      Object.assign(r, { value, version: r.version + 1 });
    },
    otherBanner: () => {
      banner = { ...banner, version: banner.version + 1 };
    },
    otherUnlock: () => {
      unlock = { ...unlock, version: unlock.version + 1 };
    },
    breakWire: (key: string, value: unknown) => {
      Object.assign(rows.get(key)!, { value });
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

  it('저장은 화면이 읽은 version 으로 건다 — 그 사이 다른 관리자가 고쳤으면 conflict, 덮어쓰지 않는다', async () => {
    const s = fakeServer();
    const min = createServerMinVersionPort(s.api);
    const old = await min.get('app'); // 옛 화면이 들고 있는 값
    s.other('app.minVersion', '0.12.0'); // 다른 관리자가 먼저 고침
    const error = await min.save('app', old, '0.13.0').catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.rows.get('app.minVersion')!.value).toBe('0.12.0'); // 덮이지 않았다
    expect(lastPut(s).body).toEqual({ version: 0, value: '0.13.0' }); // 보낸 것은 옛 화면의 번호 그대로
    // 다시 받으면 새 값 · 새 번호
    expect(await min.get('app')).toMatchObject({ value: '0.12.0', version: 1 });
  });

  it('저장 전에 읽지 않는다 — 번호는 화면이 준 것뿐이다', async () => {
    const s = fakeServer();
    const min = createServerMinVersionPort(s.api);
    const read = await min.get('app');
    s.calls.length = 0;
    await min.save('app', read, '0.13.0');
    expect(s.calls).toEqual(['PUT /v2/admin/config/app.minVersion']);
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

  it('로그아웃하면 포트 상태를 버린다 — 새 포트가 만들어진다', () => {
    const s = fakeServer();
    const before = createServerMinVersionPort(s.api);
    resetPortState();
    expect(opsConfigClient(s.api)).not.toBe(opsConfigClient(null));
    const after = createServerMinVersionPort(s.api);
    expect(after).not.toBe(before);
  });
});

describe('최소 버전 · 가입 스위치 · 제보 안내', () => {
  it('최소 버전: 없으면 null, 저장은 앞뒤 빈칸을 뗀 글자', async () => {
    const s = fakeServer();
    const min = createServerMinVersionPort(s.api);
    const read = await min.get('room');
    expect(read.value).toBeNull();
    await min.save('room', read, ' 0.12.3 ');
    expect(lastPut(s)).toMatchObject({
      path: '/v2/admin/config/room.minVersion',
      body: { version: 0, value: '0.12.3' },
    });
    expect((await min.get('room')).value).toBe('0.12.3');
  });

  it('가입 스위치: inviteGate 만 있고 기존 사용자 가입은 쓸 수 없다', async () => {
    const s = fakeServer();
    const flags = createServerSignupFlagPort(s.api);
    expect(flags.flags).toEqual(['inviteGate']);
    const read = await flags.get();
    expect(read.value.inviteGate).toBe(true);
    await flags.set('inviteGate', read, false);
    expect(lastPut(s).body).toEqual({ version: 0, value: false });
    const error = await flags.set('existingSignup', read, false).catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
  });

  it('제보 안내: 글과 링크를 한 키로 통째로 쓴다 · 저장 시각이 없다', async () => {
    const s = fakeServer();
    const bug = createServerBugReportPort(s.api);
    const read = await bug.get();
    expect(read.value).toEqual({ notice: '기본 안내', link: '' });
    await bug.save(read, ' 안내 ', ' https://open.kakao.com/o/x ');
    expect(lastPut(s).body).toEqual({
      version: 0,
      value: { notice: '안내', link: 'https://open.kakao.com/o/x' },
    });
  });

  it('응답 모양이 틀리면 기본값으로 덮지 않고 던진다(스위치 · 안내 · 최소 버전)', async () => {
    const s = fakeServer();
    s.breakWire('user.inviteGate', 'yes');
    s.breakWire('bug.report', { notice: 3 });
    s.breakWire('app.minVersion', 7);
    const results = await Promise.all([
      createServerSignupFlagPort(s.api)
        .get()
        .catch((e: unknown) => e),
      createServerBugReportPort(s.api)
        .get()
        .catch((e: unknown) => e),
      createServerMinVersionPort(s.api)
        .get('app')
        .catch((e: unknown) => e),
    ]);
    for (const error of results) expect(isPortError(error, 'invalid')).toBe(true);
  });
});

describe('방 설정 · 대화 보관', () => {
  it('상한은 두 채널을 한 객체로, 정원은 숫자로 쓴다', async () => {
    const s = fakeServer();
    const room = createServerRoomPort(s.api);
    const limits = await room.getLimits();
    expect(limits.value).toEqual({
      saved: { workingroom: 500, togetherroom: 500 },
      defaults: { workingroom: 500, togetherroom: 500 },
    });
    await room.saveLimits(limits, { workingroom: 400, togetherroom: 300 });
    // 저장된 값과 기본값을 따로 받는다 — 화면은 저장된 값을 칸에, 기본값은 안내에
    s.other('room.limits', { workingroom: 600, togetherroom: 400 });
    expect((await room.getLimits()).value).toEqual({
      saved: { workingroom: 600, togetherroom: 400 },
      defaults: { workingroom: 500, togetherroom: 500 },
    });
    expect(lastPut(s).body).toEqual({ version: 0, value: { workingroom: 400, togetherroom: 300 } });
    const people = await room.getMaxPeople();
    await room.saveMaxPeople(people, 20);
    expect(lastPut(s).body).toEqual({ version: 0, value: 20 });
    expect((await room.getMaxPeople()).value).toBe(20);
  });

  it('대화 보관: 칸을 비우면(null) 그 칸에 기본값을 써서 보낸다', async () => {
    const s = fakeServer();
    s.other('chat.keepDays', { default: 3, togetherroom: 7, workingroom: 3, secret: 1 });
    const room = createServerRoomPort(s.api);
    const read = await room.getChatKeep();
    await room.saveChatKeep(read, {
      'config/chatKeepDays/secret': null,
      'config/chatKeepDays/workingroom': 5,
    });
    expect(lastPut(s).body).toEqual({
      version: 1,
      value: { default: 3, togetherroom: 7, workingroom: 5, secret: 3 },
    });
  });

  it('옛 화면의 값 · 번호로는 저장되지 않는다 — conflict', async () => {
    const s = fakeServer();
    const room = createServerRoomPort(s.api);
    const old = await room.getLimits();
    s.other('room.limits', { workingroom: 111, togetherroom: 222 });
    const error = await room
      .saveLimits(old, { workingroom: 400, togetherroom: 300 })
      .catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.rows.get('room.limits')!.value).toEqual({ workingroom: 111, togetherroom: 222 });
  });

  it('상한 · 정원 · 대화 보관 응답의 모양이 틀리면 던진다', async () => {
    const s = fakeServer();
    s.breakWire('room.limits', { workingroom: 'x', togetherroom: 3 });
    s.breakWire('room.maxPeople', 'ten');
    s.breakWire('chat.keepDays', { default: 'x' });
    const room = createServerRoomPort(s.api);
    for (const read of [() => room.getLimits(), () => room.getMaxPeople(), () => room.getChatKeep()]) {
      expect(isPortError(await read().catch((e: unknown) => e), 'invalid')).toBe(true);
    }
  });
});

describe('방 제목 금칙어(room.bannedWords)', () => {
  const words = () => createServerRoomPort(fakeServer().api).bannedWords!;

  it('API 판에만 있다 — 저장한 값이 없으면 서버 기본값(빈 목록)', async () => {
    expect(words()).not.toBeNull();
    const s = fakeServer();
    const read = await createServerRoomPort(s.api).bannedWords!.get();
    expect(read).toMatchObject({ value: [], version: 0 });
  });

  it('저장 — 목록을 통째로 읽은 번호와 함께 보낸다 · 다시 읽으면 새 값', async () => {
    const s = fakeServer();
    const control = createServerRoomPort(s.api).bannedWords!;
    const read = await control.get();
    await control.save(read, ['바보', '멍청']);
    expect(lastPut(s)).toMatchObject({
      method: 'PUT',
      path: '/v2/admin/config/room.bannedWords',
      body: { version: 0, value: ['바보', '멍청'] },
    });
    expect(await control.get()).toMatchObject({ value: ['바보', '멍청'], version: 1 });
  });

  it('서버가 값을 거절하면(400 OPS_INVALID_VALUE) 조용히 넘기지 않고 invalid 로 던진다', async () => {
    const s = fakeServer();
    const control = createServerRoomPort(s.api).bannedWords!;
    const read = await control.get();
    s.rejectNext(new ApiError('request', 400, 'OPS_INVALID_VALUE', '[0] 는 1~20자 글자여야 한다'));
    const error = await control.save(read, ['가'.repeat(21)]).catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(error).toMatchObject({ code: 'OPS_INVALID_VALUE', message: '설정 값이 올바르지 않아요' });
    expect(s.rows.get('room.bannedWords')!.value).toBeNull();
  });

  it('옛 화면의 번호로는 저장되지 않는다 — conflict, 덮어쓰지 않는다', async () => {
    const s = fakeServer();
    const control = createServerRoomPort(s.api).bannedWords!;
    const old = await control.get();
    s.other('room.bannedWords', ['먼저']);
    const error = await control.save(old, ['나중']).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.rows.get('room.bannedWords')!.value).toEqual(['먼저']);
  });

  it('응답 모양이 틀리면(목록이 아님 · 글자 아닌 칸) 빈 목록으로 덮지 않고 던진다', async () => {
    for (const bad of ['바보', ['바보', 3]]) {
      const s = fakeServer();
      s.breakWire('room.bannedWords', bad);
      const error = await createServerRoomPort(s.api)
        .bannedWords!.get()
        .catch((e: unknown) => e);
      expect(isPortError(error, 'invalid')).toBe(true);
    }
  });
});

describe('제보 하루 상한(bug.dailyMax)', () => {
  it('저장한 값이 없으면 null(화면은 «서버 값 없음 → 기본 5건») · 있으면 그 수', async () => {
    const s = fakeServer();
    const port = createServerBugDailyMaxPort(s.api);
    expect(await port.get()).toMatchObject({ value: null, version: 0 });
    s.other('bug.dailyMax', 9);
    expect(await port.get()).toMatchObject({ value: 9, version: 1 });
  });

  it('저장 — 숫자 하나를 읽은 번호와 함께 PUT', async () => {
    const s = fakeServer();
    const port = createServerBugDailyMaxPort(s.api);
    await port.save(await port.get(), 8);
    expect(lastPut(s)).toMatchObject({
      method: 'PUT',
      path: '/v2/admin/config/bug.dailyMax',
      body: { version: 0, value: 8 },
    });
    expect((await port.get()).value).toBe(8);
  });

  it('서버 오류(400)는 invalid 로 던진다 · 값은 그대로', async () => {
    const s = fakeServer();
    const port = createServerBugDailyMaxPort(s.api);
    const read = await port.get();
    s.rejectNext(new ApiError('request', 400, 'OPS_INVALID_VALUE', '1~100'));
    const error = await port.save(read, 101).catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(s.rows.get('bug.dailyMax')!.value).toBeNull();
  });

  it('옛 번호면 conflict · 숫자가 아닌 응답은 던진다 · 안내는 서버가 막는다고 말한다', async () => {
    const s = fakeServer();
    const port = createServerBugDailyMaxPort(s.api);
    const old = await port.get();
    s.other('bug.dailyMax', 7);
    expect(isPortError(await port.save(old, 3).catch((e: unknown) => e), 'conflict')).toBe(true);
    s.breakWire('bug.dailyMax', '7');
    expect(isPortError(await port.get().catch((e: unknown) => e), 'invalid')).toBe(true);
    expect(port.enforcedBy).toContain('서버');
  });
});

describe('서버 운영 설정', () => {
  it('정수 묶음: 고친 칸만 바꾸고 묶음 밖의 칸은 받은 그대로 보낸다', async () => {
    const s = fakeServer();
    const ops = createServerOpsConfigPort(s.api);
    const timing = ops.groups.roomTiming;
    expect(timing.path).toBe('room.timing');
    const read = await ops.getIntGroup(timing);
    expect(read.value).toMatchObject({ statsLogMs: 60_000 });
    await ops.saveIntGroup(timing, 'roomServer.timing', 't', read, { 'room.timing/statsLogMs': 30_000 });
    expect(lastPut(s).body).toEqual({
      version: 0,
      value: { joinWaitMs: 10_000, roomStatsRefreshMs: 15_000, statsLogMs: 30_000, restoreWindowMs: 150_000 },
    });
  });

  it('정수 묶음: 칸을 비우면 서버 기본값을 쓴다 · 바뀐 게 없으면 요청이 없다', async () => {
    const s = fakeServer();
    s.other('api.cacheSec', { config: 10, card: 60, ranking: 60 });
    const ops = createServerOpsConfigPort(s.api);
    const read = await ops.getIntGroup(ops.groups.apiCache);
    await ops.saveIntGroup(ops.groups.apiCache, 'settings.apiCache', 't', read, {});
    expect(s.puts).toHaveLength(0);
    await ops.saveIntGroup(ops.groups.apiCache, 'settings.apiCache', 't', read, {
      'api.cacheSec/config': null,
    });
    expect(lastPut(s).body).toEqual({ version: 1, value: { config: 30, card: 60, ranking: 60 } });
  });

  it('하루 한도: 키마다 따로 읽고 한 키에 한 번만 저장한다 · 비운 칸은 DELETE ?version=', async () => {
    const s = fakeServer();
    s.other('gift.dailySendMax', 20);
    const ops = createServerOpsConfigPort(s.api);
    const [signup, clap, gift] = ops.groups.dailyLimits!;
    const reads = await Promise.all([signup, clap, gift].map((g) => ops.getIntGroup(g)));
    expect(reads.map((r) => r.value)).toEqual([{ value: 2000 }, { value: 5 }, { value: 20 }]);
    expect(reads.map((r) => r.version)).toEqual([0, 0, 1]);
    await ops.saveIntGroup(clap, 'settings.apiCache', 't', reads[1], { 'guestbook.clapDailyMax/value': 9 });
    expect(s.puts.at(-1)).toMatchObject({
      method: 'PUT',
      path: '/v2/admin/config/guestbook.clapDailyMax',
      body: { version: 0, value: 9 },
    });
    await ops.saveIntGroup(gift, 'settings.apiCache', 't', reads[2], { 'gift.dailySendMax/value': null });
    expect(s.puts.at(-1)).toMatchObject({
      method: 'DELETE',
      path: '/v2/admin/config/gift.dailySendMax',
      query: { version: 1 },
    });
    expect(s.rows.get('gift.dailySendMax')!.value).toBeNull();
  });

  it('하루 한도: 한 묶음에 두 키를 한꺼번에 저장하려 하면 하나도 보내지 않고 던진다', async () => {
    const s = fakeServer();
    const ops = createServerOpsConfigPort(s.api);
    const [signup] = ops.groups.dailyLimits!;
    const read = await ops.getIntGroup(signup);
    s.puts.length = 0;
    const error = await ops
      .saveIntGroup(signup, 'settings.apiCache', 't', read, { 'a/value': 1, 'b/value': 2 })
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
    expect(s.puts).toHaveLength(0);
  });

  it('하루 한도: 옛 번호로 비우면 409 → conflict, 값은 그대로', async () => {
    const s = fakeServer();
    const ops = createServerOpsConfigPort(s.api);
    const gift = ops.groups.dailyLimits![2];
    const old = await ops.getIntGroup(gift);
    s.other('gift.dailySendMax', 30);
    const error = await ops
      .saveIntGroup(gift, 'settings.apiCache', 't', old, { 'gift.dailySendMax/value': null })
      .catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.rows.get('gift.dailySendMax')!.value).toBe(30);
  });

  it('캐시 초 묶음은 서버 키 표를 따른다(랭킹이 있고 방 개수는 없다)', () => {
    const ops = createServerOpsConfigPort(fakeServer().api);
    expect(ops.groups.apiCache.fields.map((f) => f.key)).toEqual(['config', 'card', 'ranking']);
  });

  it('로그 수준: 비운 칸은 기본(info)으로 · 허용 출처는 목록 통째', async () => {
    const s = fakeServer();
    const ops = createServerOpsConfigPort(s.api);
    const levels = await ops.getLogLevels();
    await ops.saveLogLevels(levels, { 'config/logLevel/api': 'debug', 'config/logLevel/realtime': null });
    expect(lastPut(s).body).toEqual({ version: 0, value: { api: 'debug', realtime: 'info' } });
    const cors = await ops.getCorsOrigins();
    await ops.saveCorsOrigins(cors, ['https://a.example.com']);
    expect(lastPut(s).body).toEqual({ version: 0, value: ['https://a.example.com'] });
    expect((await ops.getCorsOrigins()).value).toEqual(['https://a.example.com']);
  });

  it('점검 안내: 켜기 · 끝 시각 · 문구를 세 칸 모두 보낸다', async () => {
    const s = fakeServer();
    const { maintenance } = createServerOpsConfigPort(s.api);
    const read = await maintenance!.get();
    expect(read.value).toEqual({ on: false, endsAt: null, message: null });
    await maintenance!.save(read, { on: true, endsAt: '2026-11-20T03:00:00.000Z', message: ' 점검 중 ' });
    expect(lastPut(s)).toMatchObject({
      path: '/v2/admin/config/app.maintenance',
      body: { version: 0, value: { on: true, endsAt: '2026-11-20T03:00:00.000Z', message: '점검 중' } },
    });
    const again = await maintenance!.get();
    await maintenance!.save(again, { on: false, endsAt: null, message: '  ' });
    expect(lastPut(s).body).toEqual({ version: 1, value: { on: false, endsAt: null, message: null } });
  });

  it('점검 안내: on 이 참 · 거짓이 아니면 꺼진 것으로 보지 않고 던진다', async () => {
    const s = fakeServer();
    s.breakWire('app.maintenance', { on: 'true', endsAt: null, message: null });
    const error = await createServerOpsConfigPort(s.api)
      .maintenance!.get()
      .catch((e: unknown) => e);
    expect(isPortError(error, 'invalid')).toBe(true);
  });

  it('정수 묶음 · 로그 수준 응답의 모양이 틀리면 던진다', async () => {
    const s = fakeServer();
    s.breakWire('api.cacheSec', { config: 'x', card: 1, ranking: 2 });
    s.breakWire('log.level', { api: 'loud', realtime: 'info' });
    s.breakWire('api.cors', 'https://a.example.com');
    const ops = createServerOpsConfigPort(s.api);
    const reads = [
      () => ops.getIntGroup(ops.groups.apiCache),
      () => ops.getLogLevels(),
      () => ops.getCorsOrigins(),
    ];
    for (const read of reads)
      expect(isPortError(await read().catch((e: unknown) => e), 'invalid')).toBe(true);
  });
});

describe('런처 배너 · 동물 해금 레벨', () => {
  it('배너: 서버 칸 이름을 화면 칸으로 바꿔 읽고, 읽은 version 으로 쓴다', async () => {
    const s = fakeServer();
    const ad = createServerAdBannerPort(s.api);
    const read = await ad.get();
    expect(read.value).toEqual([{ img: 'https://a.test/1.png', link: '' }]);
    await ad.save(read, [
      { img: 'https://a.test/2.png', link: 'https://l.test' },
      { img: 'https://a.test/3.png', link: '' },
    ]);
    expect(lastPut(s)).toMatchObject({
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

  it('배너: 읽은 뒤 다른 곳이 먼저 고쳤으면 conflict — 저장 전에 다시 읽어 덮지 않는다', async () => {
    const s = fakeServer();
    const ad = createServerAdBannerPort(s.api);
    const old = await ad.get();
    s.otherBanner();
    s.calls.length = 0;
    const error = await ad.save(old, []).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.calls).toEqual(['PUT /v2/admin/notices/launcher-banner']); // 읽기 없이 곧바로 PUT 한 번
    expect(lastPut(s).body).toEqual({ version: 4, slides: [] });
  });

  it('배너: version · 슬라이드 칸이 틀리면 0 이나 빈 값으로 덮지 않고 던진다', async () => {
    for (const bad of [
      { version: '4', slides: [] },
      { version: 4, slides: 'x' },
      { version: 4, slides: [{ imageUrl: 3, linkUrl: null }] },
    ]) {
      const s = fakeServer();
      Object.assign(s.api, {
        get: async () => bad,
      });
      const error = await createServerAdBannerPort(s.api)
        .get()
        .catch((e: unknown) => e);
      expect(isPortError(error, 'invalid')).toBe(true);
    }
  });

  it('해금 레벨: 카탈로그 unlocks 에서 읽고, label · version 을 실어 쓴다', async () => {
    const s = fakeServer();
    const game = createServerGameConfigPort(s.api);
    const read = await game.getAnimalUnlockLevel();
    expect(read.value).toBe(50);
    await game.saveAnimalUnlockLevel(read, 30);
    expect(lastPut(s)).toMatchObject({
      path: '/v2/admin/catalog/unlocks/ANIMAL_CHARACTER/animal',
      body: { version: 2, level: 30, label: '동물 캐릭터' },
    });
  });

  it('해금 레벨: 옛 화면의 번호로는 저장되지 않고(conflict) 0 번으로 덮지도 않는다', async () => {
    const s = fakeServer();
    const game = createServerGameConfigPort(s.api);
    const old = await game.getAnimalUnlockLevel();
    s.otherUnlock();
    s.calls.length = 0;
    const error = await game.saveAnimalUnlockLevel(old, 30).catch((e: unknown) => e);
    expect(isPortError(error, 'conflict')).toBe(true);
    expect(s.calls).toHaveLength(1);
    expect(lastPut(s).body).toMatchObject({ version: 2 });
  });
});
