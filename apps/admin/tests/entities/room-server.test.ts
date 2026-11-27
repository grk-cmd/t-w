import { describe, expect, it } from 'vitest';
import { fetchServerHealth, healthUrl, uptimeLabel } from '@/entities/room-server';

describe('방 서버 상태(/health)', () => {
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
          secret: 1,
          members: 6,
          presence: { users: 12, online: 11, watchers: 0 },
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
      secret: 1,
      members: 6,
      online: 11,
      limits: { workingroom: 400, togetherroom: 250 },
      version: 'v0.1.0 (8998273)',
      uptimeS: 7980,
    });
    // 옛 방 서버 — limits · version · secret · members 칸이 없다
    expect(await fetchServerHealth('wss://a.b', ok({ rooms: 1 }))).toMatchObject({
      secret: null,
      members: null,
      online: null,
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
