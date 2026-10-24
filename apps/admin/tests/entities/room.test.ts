import { describe, expect, it } from 'vitest';
import {
  allRoomCodes,
  closeRooms,
  closeRoomsWrite,
  filterRooms,
  formatAgo,
  getLiveRooms,
  ghostCodes,
  isMemberKey,
  isRoomAlive,
  LIVE_SERVER_LABEL,
  mergeLiveRooms,
  normalizeRoomCode,
  orphanCodes,
  parseLiveRooms,
  probeRoom,
  probeRooms,
  ROOM_LIVE_MS,
  ROOM_TOTAL_LIMITS,
  roomRows,
  roomStateOf,
  roomStatsSummary,
  serverOf,
} from '@/entities/room';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const NOW = 1_000_000;

describe('방 생존 판정', () => {
  it('마지막 신호가 90초 안이면 살아 있다 (앱 · functions 와 같은 기준)', () => {
    expect(ROOM_LIVE_MS).toBe(90_000);
    expect(isRoomAlive({ lastSeen: NOW - 89_999 }, NOW)).toBe(true);
    expect(isRoomAlive({ lastSeen: NOW - 90_000 }, NOW)).toBe(false);
  });

  it('신호가 없거나 줄이 없으면 유령이다', () => {
    expect(isRoomAlive({}, NOW)).toBe(false);
    expect(isRoomAlive(null, NOW)).toBe(false);
    expect(isRoomAlive(undefined, NOW)).toBe(false);
  });

  it('유령 방 코드만 골라 정렬한다', () => {
    const index = {
      'WORK-BBBB': { lastSeen: NOW - 100_000 },
      'WORK-AAAA': {},
      'PLAY-LIVE': { lastSeen: NOW - 10_000, channel: 'togetherroom' as const },
    };
    expect(ghostCodes(index, NOW)).toEqual(['WORK-AAAA', 'WORK-BBBB']);
  });
});

describe('방 목록 줄', () => {
  it('살아 있는 방이 위, 그 안에서는 최근 신호 순. channel 이 없으면 워킹룸', () => {
    const rows = roomRows(
      {
        'WORK-OLD': { lastSeen: NOW - 200_000 },
        'PLAY-NEW': { lastSeen: NOW - 1_000, channel: 'togetherroom', open: true },
        'WORK-MID': { lastSeen: NOW - 30_000 },
      },
      NOW,
    );
    expect(rows.map((r) => r.code)).toEqual(['PLAY-NEW', 'WORK-MID', 'WORK-OLD']);
    expect(rows[0]).toMatchObject({ channel: 'togetherroom', open: true, alive: true });
    expect(rows[2]).toMatchObject({ channel: 'workingroom', open: false, alive: false });
  });
});

describe('서버 집계 요약', () => {
  it('3분 안에 쓴 값이면 신선하다', () => {
    expect(roomStatsSummary({ workingroom: 2, togetherroom: 1, at: NOW - 60_000 }, NOW)).toEqual({
      total: 3,
      workingroom: 2,
      togetherroom: 1,
      at: NOW - 60_000,
      fresh: true,
      server: null,
    });
    expect(roomStatsSummary({ workingroom: 2, togetherroom: 1, at: NOW - 180_000 }, NOW)?.fresh).toBe(false);
  });

  it('없거나 모양이 틀리면 null', () => {
    expect(roomStatsSummary(null, NOW)).toBeNull();
    expect(roomStatsSummary({ workingroom: 1 }, NOW)).toBeNull();
  });
});

describe('표시 · 입력', () => {
  it('몇 분 전', () => {
    expect(formatAgo(5_000)).toBe('5초 전');
    expect(formatAgo(-5_000)).toBe('0초 전');
    expect(formatAgo(125_000)).toBe('2분 전');
    expect(formatAgo(2 * 3600_000)).toBe('2시간 전');
    expect(formatAgo(3 * 86400_000)).toBe('3일 전');
  });

  it('방 코드는 대문자로 맞추고 경로에 못 쓰는 글자는 막는다', () => {
    expect(normalizeRoomCode(' scrt-ab12 ')).toBe('SCRT-AB12');
    expect(normalizeRoomCode('WORK-AB12/../x')).toBeNull();
    expect(normalizeRoomCode('WORK.AB12')).toBeNull();
    expect(normalizeRoomCode('')).toBeNull();
  });
});

describe('방 종료 쓰기', () => {
  it('rooms · roomIndex 를 null 로 한 묶음에 담는다', async () => {
    expect(closeRoomsWrite(['A-1', 'B-2'])).toEqual({
      'rooms/A-1': null,
      'roomIndex/A-1': null,
      'rooms/B-2': null,
      'roomIndex/B-2': null,
    });
    const { db, writes } = fakeDb();
    await closeRooms(db, ['A-1']);
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'rooms/A-1', null],
      ['commit', 'roomIndex/A-1', null],
    ]);
  });

  it('대상이 없으면 아무것도 보내지 않는다', async () => {
    const { db, writes } = fakeDb();
    await closeRooms(db, []);
    expect(withoutAudits(writes)).toEqual([]);
  });
});

describe('rooms 키만 보고 — 고아 · 시크릿룸 · 인원', () => {
  const index = {
    'WORK-LIVE': { lastSeen: NOW - 1_000 },
    'WORK-DEAD': { lastSeen: NOW - 200_000 },
  };
  const codes = ['WORK-LIVE', 'WORK-DEAD', 'WORK-ORPH', 'WORK-OLDC', 'SCRT-AB12'];
  const probes = {
    'WORK-LIVE': { members: 2, lastSeen: null },
    'WORK-DEAD': { members: 0, lastSeen: null },
    'WORK-ORPH': { members: 0, lastSeen: null },
    'WORK-OLDC': { members: 1, lastSeen: NOW - 5_000 }, // 옛 앱이 연 방 — roomIndex 를 안 쓰지만 살아 있다
    'SCRT-AB12': { members: 3, lastSeen: null },
  };

  it('멤버 키는 밑줄 키 · chatLog 를 뺀다 (앱 _isMemberKey 와 같다)', () => {
    expect(['_meta', '_photo', 'chatLog', 'u1', 'm-2'].filter(isMemberKey)).toEqual(['u1', 'm-2']);
  });

  it('고아 방 = rooms 에만 있는 방, 시크릿룸은 원래 roomIndex 에 없으니 빼고', () => {
    expect(orphanCodes(index, codes)).toEqual(['WORK-OLDC', 'WORK-ORPH']);
  });

  it('유령 = 신호 끊긴 줄 + 멤버 신호가 끊긴 고아. 살펴보기 전 고아 · 시크릿룸은 넣지 않는다', () => {
    expect(ghostCodes(index, NOW, { codes, probes })).toEqual(['WORK-DEAD', 'WORK-ORPH']);
    expect(ghostCodes(index, NOW, { codes })).toEqual(['WORK-DEAD']);
    expect(ghostCodes({ 'SCRT-X': {} }, NOW)).toEqual([]);
  });

  it('목록 줄 — 인원 수를 싣고, 고아는 멤버 신호로 판정, 시크릿룸은 맨 아래', () => {
    const rows = roomRows(index, NOW, { codes, probes });
    expect(rows.map((r) => [r.code, r.kind, r.alive, r.members])).toEqual([
      ['WORK-LIVE', 'indexed', true, 2],
      ['WORK-OLDC', 'orphan', true, 1],
      ['WORK-DEAD', 'indexed', false, 0],
      ['WORK-ORPH', 'orphan', false, 0],
      ['SCRT-AB12', 'secret', false, 3],
    ]);
    expect(rows[1]).toMatchObject({ channel: null, lastSeen: NOW - 5_000 });
  });

  it('전체 종료 대상은 앱처럼 rooms 의 모든 방(시크릿룸 포함) + roomIndex 에만 남은 줄', () => {
    expect(allRoomCodes({ 'WORK-GONE': {}, 'WORK-A': {} }, ['WORK-A', 'SCRT-B'])).toEqual([
      'SCRT-B',
      'WORK-A',
      'WORK-GONE',
    ]);
  });

  it('방 살펴보기 — 키만 받아 멤버를 세고 · 멤버마다 name · userId 두 칸 · 요청한 방만 lastSeen 을 읽는다', async () => {
    const { db } = fakeDb({
      'rooms/WORK-A': { _meta: true, chatLog: true, u1: true, u2: true },
      'rooms/WORK-A/u1/lastSeen': NOW - 50_000,
      'rooms/WORK-A/u2/lastSeen': NOW - 3_000,
      'rooms/WORK-A/u1/name': '민수',
      'rooms/WORK-A/u1/userId': 'uMINSU0001',
      'rooms/WORK-A/u2/name': 42,
      'rooms/WORK-B': { _meta: true },
    });
    const read: string[] = [];
    const get = db.get;
    db.get = (path) => (read.push(path), get(path));
    const people = [
      { userId: 'uMINSU0001', name: '민수' },
      { userId: null, name: '' }, // 모양이 틀린 칸은 빈 이름 · null
    ];
    expect(await probeRoom(db, 'WORK-A', false)).toEqual({ members: 2, lastSeen: null, people });
    expect(read.sort()).toEqual([
      'rooms/WORK-A/u1/name',
      'rooms/WORK-A/u1/userId',
      'rooms/WORK-A/u2/name',
      'rooms/WORK-A/u2/userId',
    ]); // def · 얼굴 같은 큰 칸 · lastSeen 은 안 읽는다
    expect(await probeRoom(db, 'WORK-A', true)).toEqual({ members: 2, lastSeen: NOW - 3_000, people });
    expect(await probeRooms(db, ['WORK-A', 'WORK-B'], new Set())).toEqual({
      'WORK-A': { members: 2, lastSeen: null, people },
      'WORK-B': { members: 0, lastSeen: null, people: [] },
    });
  });

  it('사람 칸을 끄면(유령 방 청소) name · userId 를 읽지 않는다', async () => {
    const { db } = fakeDb({
      'rooms/WORK-D': { _meta: true, m1: true },
      'rooms/WORK-D/m1/lastSeen': NOW - 1_000,
      'rooms/WORK-D/m1/name': '민수',
    });
    const read: string[] = [];
    const get = db.get;
    db.get = (path) => (read.push(path), get(path));
    expect(await probeRoom(db, 'WORK-D', true, false)).toEqual({ members: 1, lastSeen: NOW - 1_000 });
    expect(read.some((p) => p.endsWith('/name') || p.endsWith('/userId'))).toBe(false);
  });

  it('새 하트비트 멤버 — lastSeen 이 입장 때 값이어도 roomAlive 도장이 최근이면 그 신호를 쓴다', async () => {
    const { db } = fakeDb({
      'rooms/WORK-C': { _meta: true, m1: true },
      'rooms/WORK-C/m1/lastSeen': NOW - 3_600_000,
      'roomAlive/WORK-C': { m1: NOW - 20_000 },
    });
    const probe = await probeRoom(db, 'WORK-C', true);
    expect(probe).toMatchObject({ members: 1, lastSeen: NOW - 20_000 });
    expect(ghostCodes({}, NOW, { codes: ['WORK-C'], probes: { 'WORK-C': probe } })).toEqual([]);
  });
});

describe('방 서버 줄 — roomIndex 에 srv 가 있는 줄', () => {
  const index = {
    'WORK-SRV1': { lastSeen: NOW - 5_000, channel: 'workingroom' as const, srv: 'realtime-1' },
    'PLAY-SRV2': { lastSeen: NOW - 200_000, channel: 'togetherroom' as const, srv: 'realtime-1' },
    'WORK-FB01': { lastSeen: NOW - 200_000 },
  };

  it('전체 상한 기본값은 채널마다 300 (config/roomLimits 가 없을 때)', () => {
    expect(ROOM_TOTAL_LIMITS).toEqual({ workingroom: 300, togetherroom: 300 });
    expect(serverOf(index['WORK-SRV1'])).toBe('realtime-1');
    expect(serverOf({ srv: '' })).toBeNull();
    expect(serverOf(index['WORK-FB01'])).toBeNull();
  });

  it('Firebase 에 멤버가 없어도 유령이 아니다 — 신호가 끊겨도 정리 대상에서 뺀다(함수가 줄을 걷는다)', () => {
    expect(ghostCodes(index, NOW, { codes: [], probes: {} })).toEqual(['WORK-FB01']);
  });

  it('목록 줄 — kind server · 방 서버 이름 · 인원은 모름(null)', () => {
    const rows = roomRows(index, NOW, { codes: [], probes: { 'WORK-SRV1': { members: 0, lastSeen: null } } });
    expect(rows.find((r) => r.code === 'WORK-SRV1')).toMatchObject({
      kind: 'server',
      server: 'realtime-1',
      alive: true,
      members: null,
    });
    expect(rows.find((r) => r.code === 'WORK-FB01')).toMatchObject({ kind: 'indexed', server: null });
  });

  it('전체 종료 대상에서 뺀다 — Firebase 에서 지워도 방 서버 방은 닫히지 않는다', () => {
    expect(allRoomCodes(index, [])).toEqual(['WORK-FB01']);
    // 같은 코드가 rooms 에도 있으면(옛 Firebase 방 찌꺼기) 그 rooms 는 대상
    expect(allRoomCodes(index, ['WORK-SRV1'])).toEqual(['WORK-FB01', 'WORK-SRV1']);
  });

  it('서버 집계 — 방 서버 몫(server)이 있으면 함께, 없으면 null', () => {
    expect(
      roomStatsSummary(
        { workingroom: 5, togetherroom: 3, at: NOW, server: { workingroom: 2, togetherroom: 1 } },
        NOW,
      )?.server,
    ).toEqual({ workingroom: 2, togetherroom: 1 });
    expect(roomStatsSummary({ workingroom: 5, togetherroom: 3, at: NOW }, NOW)?.server).toBeNull();
  });
});

describe('방 서버 목록 — 시크릿룸 · 사람 합치기 · 찾기', () => {
  const live = {
    at: NOW - 2_000,
    rooms: [
      {
        code: 'WORK-SRV1',
        channel: 'workingroom',
        secret: false,
        open: true,
        host: 'uHOST',
        members: [{ userId: 'uA', name: '가영' }],
      },
      {
        code: 'SCRT-Q1W2',
        channel: 'togetherroom',
        secret: true,
        open: false,
        host: null,
        members: [
          { userId: 'uB', name: 'Bori' },
          { userId: null, name: '익명' },
        ],
      },
    ],
  };

  it('응답 모양 검사 — 틀린 줄만 버리고, 전체가 틀리면 null', () => {
    const p = parseLiveRooms({
      ...live,
      rooms: [...live.rooms, { code: '', channel: 'workingroom' }, { code: 'X', channel: 'bad' }, null],
    });
    expect(p?.rooms.map((r) => r.code)).toEqual(['WORK-SRV1', 'SCRT-Q1W2']);
    expect(p?.rooms[1]).toMatchObject({
      secret: true,
      host: null,
      members: [
        { userId: 'uB', name: 'Bori' },
        { userId: null, name: '익명' },
      ],
    });
    expect(parseLiveRooms({ at: 'x', rooms: [] })).toBeNull();
    expect(parseLiveRooms({ at: 1 })).toBeNull();
    expect(parseLiveRooms(null)).toBeNull();
    expect(parseLiveRooms({ at: 1, rooms: [{ code: 'WORK-A', channel: 'workingroom' }] })?.rooms[0]).toEqual({
      code: 'WORK-A',
      channel: 'workingroom',
      secret: false,
      open: false,
      host: null,
      members: [],
    });
  });

  it('합치기 — srv 줄은 인원 · 사람을 채우고, roomIndex 에 없는 시크릿룸은 새 줄(맨 아래)', () => {
    const base = roomRows(
      { 'WORK-SRV1': { lastSeen: NOW - 5_000, srv: 'realtime-1' }, 'WORK-FB01': { lastSeen: NOW - 1_000 } },
      NOW,
      {
        codes: ['WORK-FB01'],
        probes: { 'WORK-FB01': { members: 1, lastSeen: null, people: [{ userId: 'uC', name: '철수' }] } },
      },
    );
    const rows = mergeLiveRooms(base, parseLiveRooms(live));
    expect(rows.map((r) => [r.code, r.kind, r.secret, r.server, r.members])).toEqual([
      ['WORK-FB01', 'indexed', false, null, 1],
      ['WORK-SRV1', 'server', false, 'realtime-1', 1],
      ['SCRT-Q1W2', 'secret', true, LIVE_SERVER_LABEL, 2],
    ]);
    expect(rows[2]).toMatchObject({ channel: 'togetherroom', alive: true, lastSeen: NOW - 2_000 });
    expect(rows[1].people).toEqual([{ userId: 'uA', name: '가영' }]);
    expect(mergeLiveRooms(base, null)).toEqual(base); // 못 받으면 Firebase 방만 그대로
  });

  it('같은 코드가 Firebase 방(srv 없음)에도 있으면 덮지 않고 방 서버 방을 따로 — Firebase 쪽은 닫을 수 있다', () => {
    const base = roomRows({}, NOW, {
      codes: ['SCRT-Q1W2'],
      probes: { 'SCRT-Q1W2': { members: 1, lastSeen: null, people: [{ userId: 'uOld', name: '옛앱' }] } },
    });
    const rows = mergeLiveRooms(base, parseLiveRooms(live)).filter((r) => r.code === 'SCRT-Q1W2');
    // 살아 있는 방 서버 방이 위(정렬 규칙) · Firebase 쪽은 server 가 null 이라 고르기 · 종료가 된다
    expect(rows.map((r) => [r.server, r.members, r.people?.[0]?.name])).toEqual([
      [LIVE_SERVER_LABEL, 2, 'Bori'],
      [null, 1, '옛앱'],
    ]);
  });

  it('찾기 — 방 코드 · 사람 이름 · 사용자 코드, 대소문자 무시 · 빈 검색은 전부', () => {
    const rows = mergeLiveRooms(roomRows({}, NOW), parseLiveRooms(live));
    const codes = (q: string) => filterRooms(rows, q).map((r) => r.code);
    expect(codes('')).toEqual(['WORK-SRV1', 'SCRT-Q1W2']);
    expect(codes('  ')).toEqual(['WORK-SRV1', 'SCRT-Q1W2']);
    expect(codes('scrt')).toEqual(['SCRT-Q1W2']);
    expect(codes('bori')).toEqual(['SCRT-Q1W2']);
    expect(codes('가영')).toEqual(['WORK-SRV1']);
    expect(codes('ub')).toEqual(['SCRT-Q1W2']);
    expect(codes('없는사람')).toEqual([]);
    expect(filterRooms(roomRows({ 'WORK-X': { lastSeen: NOW } }, NOW), 'work-x').map((r) => r.code)).toEqual([
      'WORK-X',
    ]); // 사람을 아직 못 읽은 줄도 코드로는 찾는다
  });

  it('API 가 없는 환경(dev)은 null · 모양이 틀리면 던진다', async () => {
    expect(await getLiveRooms(null)).toBeNull();
    const api = (data: unknown) => ({
      get: async () => data as never,
      send: async () => data as never,
      upload: async () => data as never,
    });
    expect((await getLiveRooms(api(live)))?.rooms.length).toBe(2);
    await expect(getLiveRooms(api({ nope: 1 }))).rejects.toThrow('모양');
  });
});

describe('상태 칸 — 사람이 있는 고아만 «목록에 없음»', () => {
  const index = {
    'WORK-LIVE': { lastSeen: NOW - 1_000 },
    'WORK-DEAD': { lastSeen: NOW - 200_000 },
    'WORK-SRVA': { lastSeen: NOW - 1_000, srv: 'realtime-1' },
    'WORK-SRVD': { lastSeen: NOW - 200_000, srv: 'realtime-1' },
  };
  const codes = ['WORK-LIVE', 'WORK-DEAD', 'WORK-ORPH', 'WORK-OLDC', 'SCRT-AB12'];
  const probes = {
    'WORK-LIVE': { members: 2, lastSeen: null },
    'WORK-DEAD': { members: 0, lastSeen: null },
    'WORK-ORPH': { members: 0, lastSeen: null },
    'WORK-OLDC': { members: 1, lastSeen: NOW - 5_000 },
    'SCRT-AB12': { members: 3, lastSeen: null },
  };
  const states = () =>
    Object.fromEntries(roomRows(index, NOW, { codes, probes }).map((r) => [r.code, roomStateOf(r)]));

  it('빈 고아는 유령과 같고, 사람이 있는 고아만 따로', () => {
    expect(states()).toEqual({
      'WORK-LIVE': 'alive',
      'WORK-OLDC': 'unlisted',
      'WORK-DEAD': 'ghost',
      'WORK-ORPH': 'ghost',
      'WORK-SRVA': 'server',
      'WORK-SRVD': 'serverLost',
      'SCRT-AB12': 'secret',
    });
  });

  it('경계 — 고아 신호가 90초 안이면 목록에 없음, 넘으면 유령', () => {
    const at = (lastSeen: number) =>
      roomStateOf(
        roomRows({}, NOW, { codes: ['WORK-EDGE'], probes: { 'WORK-EDGE': { members: 1, lastSeen } } })[0],
      );
    expect(at(NOW - ROOM_LIVE_MS + 1)).toBe('unlisted');
    expect(at(NOW - ROOM_LIVE_MS - 1)).toBe('ghost');
  });

  it('방 서버 시크릿룸은 시크릿 · 방 서버 둘 다', () => {
    const rows = mergeLiveRooms(roomRows({}, NOW), {
      at: NOW,
      rooms: [
        { code: 'SCRT-ZZ99', channel: 'togetherroom', secret: true, open: false, host: null, members: [] },
      ],
    });
    expect(rows.map(roomStateOf)).toEqual(['secretServer']);
  });
});
