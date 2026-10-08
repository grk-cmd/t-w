import { describe, expect, it } from 'vitest';
import {
  getRoomServerConfig,
  isAppServerUrl,
  parseRoomServerConfig,
  removeAllow,
  removeServer,
  saveServer,
  serverInUse,
  serverProblem,
  setAllow,
  setRoomServerSwitch,
} from '@/entities/room-server';
import { auditsOf, fakeDb } from '../shared/fakeDb';

describe('방 서버 설정 읽기', () => {
  it('없으면 전부 꺼짐 · 빈 표', async () => {
    expect(await getRoomServerConfig(fakeDb().db)).toEqual({
      on: false,
      follow: false,
      servers: {},
      allow: {},
    });
  });

  it('형식이 틀린 칸은 버린다 — 규칙과 같은 검사', () => {
    const cfg = parseRoomServerConfig({
      on: true,
      follow: 'yes',
      servers: { 'rooms-1': 'wss://rooms.togetherworking.duckdns.org', BAD: 'wss://x', n: 3 },
      allow: { u1abc2345: 'rooms-1', 'MATE-AB12': 'rooms-1', u2abc2345: 7 },
    });
    expect(cfg).toEqual({
      on: true,
      follow: false,
      servers: { 'rooms-1': 'wss://rooms.togetherworking.duckdns.org' },
      allow: { u1abc2345: 'rooms-1' },
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
    await setRoomServerSwitch(db, 'on', true);
    await setRoomServerSwitch(db, 'follow', false);
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
      ['commit', 'config/roomServer/follow', false],
      ['commit', 'config/roomServer/servers/rooms-1', 'wss://rooms.togetherworking.duckdns.org'],
      ['commit', 'config/roomServer/servers/rooms-1', 'wss://rooms-dev.togetherworking.duckdns.org'],
      ['commit', 'config/roomServer/servers/rooms-1', null],
      ['commit', 'config/roomServer/allow/u1abc2345', 'rooms-1'],
      ['commit', 'config/roomServer/allow/u1abc2345', null],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['roomServer.switch', 'on', '켜기'],
      ['roomServer.switch', 'follow', '끄기'],
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
