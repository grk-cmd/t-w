import { describe, expect, it } from 'vitest';
import {
  fetchServerHealth,
  getRoomServerConfig,
  healthUrl,
  parseLimitInput,
  isAppServerUrl,
  parseRoomServerConfig,
  removeAllow,
  removeServer,
  saveServer,
  serverInUse,
  serverProblem,
  setAllow,
  setRoomLimits,
  setRoomServerSwitch,
  uptimeLabel,
} from '@/entities/room-server';
import { auditsOf, fakeDb } from '../shared/fakeDb';

describe('방 서버 설정 읽기', () => {
  it('없으면 전부 꺼짐 · 빈 표', async () => {
    expect(await getRoomServerConfig(fakeDb().db)).toEqual({
      on: false,
      servers: {},
      allow: {},
      limits: { workingroom: null, togetherroom: null },
    });
  });

  it('형식이 틀린 칸은 버린다 — 규칙과 같은 검사', () => {
    const cfg = parseRoomServerConfig({
      on: true,
      follow: 'yes',
      servers: { 'rooms-1': 'wss://rooms.togetherworking.duckdns.org', BAD: 'wss://x', n: 3 },
      allow: { u1abc2345: 'rooms-1', 'MATE-AB12': 'rooms-1', u2abc2345: 7 },
      limits: { workingroom: 400, togetherroom: 2.5, other: 3 },
    });
    expect(cfg).toEqual({
      on: true,
      servers: { 'rooms-1': 'wss://rooms.togetherworking.duckdns.org' },
      allow: { u1abc2345: 'rooms-1' },
      limits: { workingroom: 400, togetherroom: null },
    });
  });
});

describe('방 서버 설정 바꾸기', () => {
  it('서버 이름 · 주소 형식', () => {
    expect(serverProblem('rooms-1', 'wss://rooms.togetherworking.duckdns.org')).toBeNull();
    expect(serverProblem('rooms-1', 'ws://127.0.0.1:8787')).toBeNull();
    expect(serverProblem('Rooms', 'wss://a.b')).toContain('이름');
    expect(serverProblem('rooms-1', 'https://a.b')).toContain('wss://');
    expect(serverProblem('rooms-1', 'wss://a.b/path')).toContain('wss://');
  });

  it('앱 CSP 에 든 주소만 «앱이 씀»', () => {
    expect(isAppServerUrl('wss://rooms.togetherworking.duckdns.org/')).toBe(true);
    expect(isAppServerUrl('wss://rooms-dev.togetherworking.duckdns.org')).toBe(true);
    expect(isAppServerUrl('wss://other.example')).toBe(false);
  });

  it('서버를 쓰는 시범 이용자 수', () => {
    const cfg = parseRoomServerConfig({
      allow: { u1abc2345: 'rooms-1', u2abc2345: 'rooms-1', u3abc2345: 'b' },
    });
    expect(serverInUse(cfg, 'rooms-1')).toBe(2);
    expect(serverInUse(cfg, 'none')).toBe(0);
  });

  it('쓰기마다 값과 기록을 한 묶음으로', async () => {
    const { db, writes } = fakeDb();
    await setRoomServerSwitch(db, true);
    await setRoomServerSwitch(db, false);
    await saveServer(db, 'rooms-1', ' wss://rooms.togetherworking.duckdns.org ', null);
    await saveServer(
      db,
      'rooms-1',
      'wss://rooms-dev.togetherworking.duckdns.org',
      'wss://rooms.togetherworking.duckdns.org',
    );
    await removeServer(db, 'rooms-1');
    await setAllow(db, 'u1abc2345', 'rooms-1', null);
    await removeAllow(db, 'u1abc2345', 'rooms-1');
    expect(writes.filter((w) => !w[1].startsWith('adminLog/'))).toEqual([
      ['commit', 'config/roomServer/on', true],
      ['commit', 'config/roomServer/on', false],
      ['commit', 'config/roomServer/servers/rooms-1', 'wss://rooms.togetherworking.duckdns.org'],
      ['commit', 'config/roomServer/servers/rooms-1', 'wss://rooms-dev.togetherworking.duckdns.org'],
      ['commit', 'config/roomServer/servers/rooms-1', null],
      ['commit', 'config/roomServer/allow/u1abc2345', 'rooms-1'],
      ['commit', 'config/roomServer/allow/u1abc2345', null],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['roomServer.switch', 'on', '켜기'],
      ['roomServer.switch', 'on', '끄기'],
      ['roomServer.server', 'rooms-1', 'wss://rooms.togetherworking.duckdns.org'],
      [
        'roomServer.server',
        'rooms-1',
        'wss://rooms.togetherworking.duckdns.org → wss://rooms-dev.togetherworking.duckdns.org',
      ],
      ['roomServer.serverDelete', 'rooms-1', undefined],
      ['roomServer.allow', 'u1abc2345', 'rooms-1'],
      ['roomServer.allowDelete', 'u1abc2345', 'rooms-1'],
    ]);
  });
});

describe('방 개수 상한', () => {
  it('입력 글자 — 정수 1~100000 만', () => {
    expect(parseLimitInput(' 400 ')).toBe(400);
    expect(parseLimitInput('100000')).toBe(100_000);
    for (const bad of ['0', '100001', '2.5', '-1', '', 'abc', '1e3']) expect(parseLimitInput(bad)).toBeNull();
  });

  it('바뀐 채널만 쓰고 기록은 «지금(없으면 기본 250) → 새 값»', async () => {
    const { db, writes } = fakeDb();
    const empty = parseRoomServerConfig({});
    await setRoomLimits(db, empty, { workingroom: 400, togetherroom: 250 });
    const set = parseRoomServerConfig({ limits: { workingroom: 400, togetherroom: 250 } });
    await setRoomLimits(db, set, { workingroom: 400, togetherroom: 300 });
    expect(writes.filter((w) => !w[1].startsWith('adminLog/'))).toEqual([
      ['commit', 'config/roomServer/limits/workingroom', 400],
      ['commit', 'config/roomServer/limits/togetherroom', 250],
      ['commit', 'config/roomServer/limits/togetherroom', 300],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['roomServer.limits', 'limits', '워킹룸 250 → 400 · 투게더룸 250 → 250'],
      ['roomServer.limits', 'limits', '투게더룸 250 → 300'],
    ]);
  });

  it('서버 상태 주소 · /health 읽기(옛 서버는 limits 없음)', async () => {
    expect(healthUrl('wss://rooms.togetherworking.duckdns.org/')).toBe(
      'https://rooms.togetherworking.duckdns.org/health',
    );
    expect(healthUrl('ws://127.0.0.1:8787')).toBe('http://127.0.0.1:8787/health');
    expect(healthUrl('https://x')).toBeNull();
    const asked: string[] = [];
    const ok = (body: unknown) =>
      (async (u: string | URL | Request) => {
        asked.push(String(u));
        return new Response(JSON.stringify(body), { status: 200 });
      }) as typeof fetch;
    expect(
      await fetchServerHealth(
        'wss://a.b',
        ok({
          rooms: 3,
          workingroom: 2,
          togetherroom: 1,
          conns: 9,
          limits: { workingroom: 400, togetherroom: 250 },
          uptimeS: 7980,
          version: 'v0.1.0 (8998273)',
        }),
      ),
    ).toEqual({
      rooms: 3,
      workingroom: 2,
      togetherroom: 1,
      conns: 9,
      limits: { workingroom: 400, togetherroom: 250 },
      version: 'v0.1.0 (8998273)',
      uptimeS: 7980,
    });
    // 옛 방 서버 — limits · version 칸이 없다
    expect(await fetchServerHealth('wss://a.b', ok({ rooms: 1 }))).toMatchObject({
      limits: null,
      version: null,
      uptimeS: null,
    });
    expect((await fetchServerHealth('wss://a.b', ok({ version: 7 }))).version).toBeNull();
    expect(asked[0]).toBe('https://a.b/health');
    const bad = (async () => new Response('', { status: 502 })) as typeof fetch;
    await expect(fetchServerHealth('wss://a.b', bad)).rejects.toThrow('502');
  });
});

describe('방 서버 켜진 시간', () => {
  it('초 → «켜진 지 …»', () => {
    expect(uptimeLabel(30)).toBe('켜진 지 1분 미만');
    expect(uptimeLabel(5 * 60 + 59)).toBe('켜진 지 5분');
    expect(uptimeLabel(2 * 3600 + 13 * 60)).toBe('켜진 지 2시간 13분');
    expect(uptimeLabel(3 * 86400 + 4 * 3600 + 59 * 60)).toBe('켜진 지 3일 4시간');
  });
});
