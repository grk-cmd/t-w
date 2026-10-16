import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import {
  API_CACHE,
  API_CORS_RE,
  getCorsOrigins,
  getIntGroup,
  getLogLevels,
  parseCorsOrigins,
  parseIntField,
  parseIntGroup,
  RESTART_NOTE,
  ROOM_FRAME,
  ROOM_TIMING,
  saveCorsOrigins,
  saveIntGroup,
  saveLogLevels,
} from '@/entities/server/ops-config';
import {
  checkCorsInput,
  checkIntGroup,
  checkLogLevels,
  corsConfirmText,
  intGroupConfirmText,
} from '@/features/settings/edit-ops-config';
import { AUDIT_ACTIONS } from '@/shared/api';
import { auditsOf, fakeDb, withoutAudits } from '../shared/fakeDb';

const brief = (writes: Parameters<typeof auditsOf>[0]) =>
  auditsOf(writes).map((a) => [a.action, a.target, a.detail]);
const range = (g: typeof API_CACHE) =>
  Object.fromEntries(g.fields.map((f) => [f.key, [f.min, f.max, f.def]]));

describe('정수 칸 묶음 — 범위는 규칙 .validate · 서버와 같다', () => {
  it('공개 캐시 · 프레임 · 타이밍 범위 · 기본값', () => {
    expect(API_CACHE.path).toBe('config/apiCache');
    expect(range(API_CACHE)).toEqual({
      config: [0, 600, 30],
      count: [0, 600, 15],
      card: [0, 600, 60],
      leaderboard: [0, 600, 60],
    });
    expect(ROOM_FRAME.path).toBe('config/roomServer/frame');
    expect(range(ROOM_FRAME)).toEqual({
      maxBytes: [65_536, 1_048_576, 1_048_576],
      maxSmallBytes: [1024, 65_536, 16_384],
    });
    expect(ROOM_TIMING.path).toBe('config/roomServer/timing');
    expect(range(ROOM_TIMING)).toEqual({
      roomStatsRefreshMs: [5000, 600_000, 15_000],
      statsLogMs: [5000, 3_600_000, 60_000],
      restoreWindowMs: [0, 1_800_000, 150_000],
    });
    expect(ROOM_TIMING.fields.find((f) => f.key === 'restoreWindowMs')?.note).toBe(RESTART_NOTE);
    expect(RESTART_NOTE).toBe('다음 재시작부터 적용');
  });

  it('서버 값 — 범위 밖 · 정수 아님 · 문자열은 없는 것으로', async () => {
    expect(parseIntGroup(API_CACHE, { config: 0, count: 600, card: 601, leaderboard: 1.5 })).toEqual({
      config: 0,
      count: 600,
    });
    expect(parseIntGroup(ROOM_FRAME, { maxBytes: 65_535, maxSmallBytes: '2048' })).toEqual({});
    expect(parseIntGroup(ROOM_TIMING, null)).toEqual({});
    const db = fakeDb({ 'config/roomServer/timing': { statsLogMs: 30_000, joinWaitMs: 10_000 } }).db;
    expect(await getIntGroup(db, ROOM_TIMING)).toEqual({ statsLogMs: 30_000 });
  });

  it('입력 — 빈 칸 null · 경계 · 밖은 undefined', () => {
    const f = ROOM_FRAME.fields[1]!;
    expect(parseIntField(f, ' 1024 ')).toBe(1024);
    expect(parseIntField(f, '65536')).toBe(65_536);
    expect(parseIntField(f, '')).toBeNull();
    for (const bad of ['1023', '65537', '2048.5', '-1', 'abc']) expect(parseIntField(f, bad)).toBeUndefined();
  });

  it('검사 — 손댄 칸만 · 같은 값 거절 · 오류 문구', () => {
    expect(checkIntGroup(API_CACHE, { config: 30 }, { config: '30' })).toEqual({
      ok: false,
      error: '지금 값과 같음',
    });
    expect(checkIntGroup(API_CACHE, {}, { count: '601' })).toEqual({
      ok: false,
      error: '방 개수 /v1/rooms/count — 0~600 사이 정수 (빈 칸 = 기본값)',
    });
    expect(checkIntGroup(API_CACHE, { config: 30 }, { config: '', card: '0' })).toEqual({
      ok: true,
      next: { 'config/apiCache/config': null, 'config/apiCache/card': 0 },
    });
  });

  it('저장 — 칸마다 따로(같은 노드의 다른 칸은 안 건드림) · 기록 한 묶음 · 바뀐 게 없으면 안 씀', async () => {
    const { db, writes } = fakeDb();
    const r = checkIntGroup(
      ROOM_TIMING,
      { statsLogMs: 60_000 },
      { statsLogMs: '30000', roomStatsRefreshMs: '5000' },
    );
    if (!r.ok) throw new Error(r.error);
    await saveIntGroup(
      db,
      ROOM_TIMING,
      'roomServer.timing',
      '방 서버 타이밍',
      { statsLogMs: 60_000 },
      r.next,
    );
    await saveIntGroup(db, ROOM_TIMING, 'roomServer.timing', '방 서버 타이밍', {}, {});
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'config/roomServer/timing/roomStatsRefreshMs', 5000],
      ['commit', 'config/roomServer/timing/statsLogMs', 30_000],
    ]);
    expect(brief(writes)).toEqual([
      ['roomServer.timing', '방 서버 타이밍', 'roomStatsRefreshMs 기본 → 5000 · statsLogMs 60000 → 30000'],
    ]);
    expect(
      intGroupConfirmText(
        '방 서버 타이밍',
        ROOM_TIMING,
        {},
        { 'config/roomServer/timing/restoreWindowMs': null },
        '적용',
      ),
    ).toBe('방 서버 타이밍 — restoreWindowMs 기본 → 기본\n적용.');
  });
});

describe('로그 수준 — config/logLevel', () => {
  it('서버 값 — 네 이름만', async () => {
    const db = fakeDb({ 'config/logLevel': { api: 'debug', realtime: 'TRACE', x: 'info' } }).db;
    expect(await getLogLevels(db)).toEqual({ api: 'debug' });
  });

  it('검사 · 저장 — 빈 값은 지움(기본 info) · 같은 값 거절', async () => {
    expect(checkLogLevels({ api: 'warn' }, { api: 'warn' })).toEqual({ ok: false, error: '지금 값과 같음' });
    const r = checkLogLevels({ api: 'warn' }, { api: '', realtime: 'error' });
    expect(r).toEqual({
      ok: true,
      next: { 'config/logLevel/api': null, 'config/logLevel/realtime': 'error' },
    });
    const { db, writes } = fakeDb();
    if (r.ok) await saveLogLevels(db, { api: 'warn' }, r.next);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'config/logLevel/api', null],
      ['commit', 'config/logLevel/realtime', 'error'],
    ]);
    expect(brief(writes)).toEqual([
      ['settings.logLevel', '로그 수준', 'api warn → 기본 · realtime 기본 → error'],
    ]);
  });
});

describe('CORS 허용 출처 — config/apiCors', () => {
  it('규칙과 같은 식 · 서버 값(배열 · 0..19 키) → 목록, 틀린 줄은 버림', async () => {
    expect(API_CORS_RE.source).toBe('^https:\\/\\/[a-z0-9.-]+$');
    expect(parseCorsOrigins(['https://a.com', 'http://b.com', 'https://c.com'])).toEqual([
      'https://a.com',
      'https://c.com',
    ]);
    expect(parseCorsOrigins({ 1: 'https://b.com', 0: 'https://a.com' })).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
    expect(parseCorsOrigins('https://a.com')).toEqual([]);
    expect(await getCorsOrigins(fakeDb().db)).toEqual([]);
  });

  it('입력 검사 — 줄 · 쉼표로 나눔 · 끝 / 뗌 · 같은 줄 하나로 · 금지 모양 · 20개', () => {
    expect(checkCorsInput([], 'https://a.com/\nhttps://b.com, https://a.com\n\n')).toEqual({
      ok: true,
      next: ['https://a.com', 'https://b.com'],
    });
    for (const bad of [
      'http://a.com',
      'https://*.a.com',
      'https://a.com:8443',
      'https://a.com/admin',
      'https://A.com',
    ])
      expect(checkCorsInput([], bad).ok).toBe(false);
    expect(checkCorsInput([], 'https://a.com:8443')).toEqual({
      ok: false,
      error: '«https://a.com:8443» — https://호스트 (소문자 · 와일드카드 · 포트 · 경로 없이 · 200자까지)',
    });
    const many = Array.from({ length: 21 }, (_, i) => `https://a${i}.com`);
    expect(checkCorsInput([], many.slice(0, 20).join('\n')).ok).toBe(true);
    expect(checkCorsInput([], many.join('\n'))).toEqual({ ok: false, error: '20개까지 (지금 21개)' });
    expect(checkCorsInput(['https://a.com'], 'https://a.com')).toEqual({
      ok: false,
      error: '지금 값과 같음',
    });
    expect(checkCorsInput(['https://a.com'], '')).toEqual({ ok: true, next: [] });
  });

  it('저장 — 목록을 통째로 · 비우면 지움 · 기록에 더한 것 · 뺀 것', async () => {
    const { db, writes } = fakeDb();
    await saveCorsOrigins(db, ['https://a.com'], ['https://a.com', 'https://b.com']);
    await saveCorsOrigins(db, ['https://a.com', 'https://b.com'], []);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'config/apiCors', ['https://a.com', 'https://b.com']],
      ['commit', 'config/apiCors', null],
    ]);
    expect(brief(writes)).toEqual([
      ['settings.apiCors', 'CORS 출처 2개', '+b.com'],
      ['settings.apiCors', 'CORS 출처 0개', '-a.com, b.com'],
    ]);
    expect(corsConfirmText([])).toContain('env');
    expect(corsConfirmText(['https://a.com'])).toContain('웹 관리자 주소');
  });
});

describe('작업 기록 이름', () => {
  it('새 동작은 규칙 형식 · 화면 이름이 있다', () => {
    const added = [
      'settings.apiCors',
      'settings.apiCache',
      'settings.logLevel',
      'roomServer.frame',
      'roomServer.timing',
    ] as const;
    for (const a of added) {
      expect(AUDIT_ACTIONS).toContain(a);
      expect(a).toMatch(/^[a-z][A-Za-z]{0,19}[.][a-z][A-Za-z]{0,19}$/);
      expect(ACTION_LABEL[a]).toBeTruthy();
    }
  });
});
