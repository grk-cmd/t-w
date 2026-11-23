import { describe, expect, it } from 'vitest';
import { createServerInvitePort } from '@/entities/invite/api/server';
import { ApiError, isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);

const row = (code: string, over: Record<string, unknown> = {}) => ({
  code,
  maxUses: 100,
  usedCount: 3,
  expiresAt: null,
  pausedAt: null,
  memo: null,
  createdAt: '2026-11-01T00:00:00Z',
  version: 4,
  status: 'USABLE',
  ...over,
});

describe('여러 명 코드 목록 — API 판', () => {
  it('한 쪽씩 받고 첫 쪽 total 을 쓰며 줄을 화면 모양으로 바꾼다(번호 · 중지 시각 · 메모)', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/invites': (c) =>
        c.query?.cursor === undefined
          ? {
              items: [
                row('INVT-AAAA-BBBB', {
                  pausedAt: '2026-11-02T00:00:00Z',
                  memo: '봄',
                  expiresAt: '2026-12-01T00:00:00Z',
                }),
              ],
              nextCursor: 'c1',
              total: 2,
            }
          : { items: [row('INVT-CCCC-DDDD')], nextCursor: null, total: null },
    });
    const port = createServerInvitePort(s.api);
    const first = await port.groups(undefined, 100);
    const second = await port.groups('c1', 100);
    expect(first).toMatchObject({ nextCursor: 'c1', total: 2 });
    expect(second).toMatchObject({ nextCursor: null, total: null });
    const list = [...first.items, ...second.items];
    expect(list.map((g) => g.code)).toEqual(['INVT-AAAA-BBBB', 'INVT-CCCC-DDDD']);
    expect(list[0]).toMatchObject({
      note: '봄',
      version: 4,
      stoppedAt: Date.parse('2026-11-02T00:00:00Z'),
      expiresAt: Date.parse('2026-12-01T00:00:00Z'),
      createdAt: Date.parse('2026-11-01T00:00:00Z'),
    });
    expect(list[1]).toMatchObject({ note: '', stoppedAt: null, expiresAt: null });
    expect(s.calls.map((c) => c.query)).toEqual([
      { group: 'true', cursor: undefined, limit: 100 },
      { group: 'true', cursor: 'c1', limit: 100 },
    ]);
  });

  it('첫 쪽에 total 이 없으면 약속과 다른 응답', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/invites': () => ({ items: [row('INVT-AAAA-BBBB')], nextCursor: null }),
    });
    const e = await caught(createServerInvitePort(s.api).groups(undefined, 100));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('칸이 약속과 다르면 줄을 버리지 않고 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/invites': () => ({
        items: [row('INVT-AAAA-BBBB', { version: '4' })],
        nextCursor: null,
        total: 1,
      }),
    });
    const e = await caught(createServerInvitePort(s.api).groups(undefined, 100));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('한 사람의 남은 초대권 — API 판', () => {
  const detail = (invitesLeft: number | null) =>
    fakeApiOf({ 'GET /v2/admin/users/u1': () => ({ userCode: 'u1', invite: { invitesLeft } }) });

  it('사용자 상세의 invite.invitesLeft 를 읽는다', async () => {
    expect(await createServerInvitePort(detail(4).api).invitesLeft('u1')).toBe(4);
  });

  it('줄이 없는 사람은 null — 초대 정보 없음', async () => {
    expect(await createServerInvitePort(detail(null).api).invitesLeft('u1')).toBeNull();
  });

  it('invite 칸이 없으면 약속과 다른 응답', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1': () => ({ userCode: 'u1' }) });
    const e = await caught(createServerInvitePort(s.api).invitesLeft('u1'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('코드마다 가입한 사람 — API 판', () => {
  const PATH = 'GET /v2/admin/invites/INVT-AAAA-BBBB/uses';
  const use = (seq: number, over: Record<string, unknown> = {}) => ({
    seq,
    joinedAt: '2026-11-03T00:00:00Z',
    userCode: `u0000000${seq}`,
    name: `사람${seq}`,
    ...over,
  });

  it('쪽으로 받고 첫 쪽 total · 유저코드 · 이름의 null 은 «없음»', async () => {
    const s = fakeApiOf({
      [PATH]: (c) =>
        c.query?.cursor === undefined
          ? { items: [use(1), use(2, { userCode: null, name: null })], nextCursor: 'c1', total: 3 }
          : { items: [use(3)], nextCursor: null, total: null },
    });
    const port = createServerInvitePort(s.api);
    const first = await port.uses('INVT-AAAA-BBBB', undefined, 100);
    const second = await port.uses('INVT-AAAA-BBBB', 'c1', 100);
    expect(first).toMatchObject({ nextCursor: 'c1', total: 3 });
    expect([...first.items, ...second.items]).toEqual([
      { n: 1, joinedAt: Date.parse('2026-11-03T00:00:00Z'), userCode: 'u00000001', name: '사람1' },
      { n: 2, joinedAt: Date.parse('2026-11-03T00:00:00Z'), userCode: null, name: null },
      { n: 3, joinedAt: Date.parse('2026-11-03T00:00:00Z'), userCode: 'u00000003', name: '사람3' },
    ]);
    expect(s.calls.map((c) => c.query)).toEqual([
      { cursor: undefined, limit: 100 },
      { cursor: 'c1', limit: 100 },
    ]);
  });

  it('첫 쪽에 total 이 없으면 약속과 다른 응답', async () => {
    const s = fakeApiOf({ [PATH]: () => ({ items: [use(1)], nextCursor: null }) });
    const e = await caught(createServerInvitePort(s.api).uses('INVT-AAAA-BBBB', undefined, 100));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('칸이 약속과 다르면 던진다(seq 가 글자)', async () => {
    const s = fakeApiOf({ [PATH]: () => ({ items: [use(1, { seq: '1' })], nextCursor: null, total: 1 }) });
    const e = await caught(createServerInvitePort(s.api).uses('INVT-AAAA-BBBB', undefined, 100));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('없는 코드(404 INVITE_NOT_FOUND)는 notFound · 서버 code 와 표 문구를 싣는다', async () => {
    const s = fakeApiOf({
      [PATH]: () => {
        throw new ApiError('notFound', 404, 'INVITE_NOT_FOUND', '없는 초대예요');
      },
    });
    const e = await caught(createServerInvitePort(s.api).uses('INVT-AAAA-BBBB', undefined, 100));
    expect(isPortError(e, 'notFound') && [e.code, e.message]).toEqual([
      'INVITE_NOT_FOUND',
      '없는 초대 코드예요 — 목록을 새로고침해 주세요',
    ]);
  });

  it('서버가 이 주소를 모르면(404 NOT_FOUND) «없음» 이 아니라 닿지 못함', async () => {
    const s = fakeApiOf({
      [PATH]: () => {
        throw new ApiError('unavailable', 404, 'NOT_FOUND', '요청한 주소가 없습니다.');
      },
    });
    const e = await caught(createServerInvitePort(s.api).uses('INVT-AAAA-BBBB', undefined, 100));
    expect(isPortError(e, 'unreachable')).toBe(true);
    expect(isPortError(e, 'notFound')).toBe(false);
  });
});

describe('코드 하나 찾기 — API 판', () => {
  const PATH = 'GET /v2/admin/invites/INVT-AAAA-BBBB';
  const found = (over: Record<string, unknown> = {}) => ({
    code: 'INVT-AAAA-BBBB',
    kind: 'user',
    issuerUserCode: 'uboss0001',
    issuerName: '민트',
    maxUses: 1,
    usedCount: 1,
    expiresAt: null,
    pausedAt: null,
    memo: null,
    createdAt: '2026-11-01T00:00:00Z',
    status: 'FULL',
    ...over,
  });

  it('개인 초대는 만든 사람을 · 관리자 코드는 메모 · 마감을 화면 모양으로 바꾼다', async () => {
    const s = fakeApiOf({
      [PATH]: () => found(),
      'GET /v2/admin/invites/INVT-CCCC-DDDD': () =>
        found({
          code: 'INVT-CCCC-DDDD',
          kind: 'admin',
          issuerUserCode: null,
          issuerName: null,
          maxUses: 600,
          usedCount: 589,
          expiresAt: '2026-11-01T14:59:59Z',
          memo: '외부 행사',
          status: 'EXPIRED',
        }),
    });
    const port = createServerInvitePort(s.api);
    expect(port.features.find).toBe(true);
    expect(await port.find('INVT-AAAA-BBBB')).toEqual({
      code: 'INVT-AAAA-BBBB',
      kind: 'user',
      issuerUserCode: 'uboss0001',
      issuerName: '민트',
      maxUses: 1,
      usedCount: 1,
      expiresAt: null,
      stoppedAt: null,
      note: '',
      createdAt: Date.parse('2026-11-01T00:00:00Z'),
    });
    expect(await port.find('INVT-CCCC-DDDD')).toMatchObject({
      kind: 'admin',
      issuerUserCode: null,
      note: '외부 행사',
      expiresAt: Date.parse('2026-11-01T14:59:59Z'),
    });
  });

  it('모르는 kind 는 짐작하지 않고 던진다 · 중지 시각은 stoppedAt 으로', async () => {
    const paused = fakeApiOf({ [PATH]: () => found({ pausedAt: '2026-11-02T00:00:00Z' }) });
    expect((await createServerInvitePort(paused.api).find('INVT-AAAA-BBBB')).stoppedAt).toBe(
      Date.parse('2026-11-02T00:00:00Z'),
    );
    for (const over of [{ kind: 'group' }, { kind: null }, { issuerUserCode: undefined }]) {
      const s = fakeApiOf({ [PATH]: () => found(over) });
      const e = await caught(createServerInvitePort(s.api).find('INVT-AAAA-BBBB'));
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });

  it('없는 코드(404 INVITE_NOT_FOUND)는 notFound · 표 문구', async () => {
    const s = fakeApiOf({
      [PATH]: () => {
        throw new ApiError('notFound', 404, 'INVITE_NOT_FOUND', '없는 초대예요');
      },
    });
    const e = await caught(createServerInvitePort(s.api).find('INVT-AAAA-BBBB'));
    expect(isPortError(e, 'notFound') && e.code).toBe('INVITE_NOT_FOUND');
  });
});
