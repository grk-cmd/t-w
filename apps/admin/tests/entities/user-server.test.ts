import { describe, expect, it } from 'vitest';
import { createServerUserPort } from '@/entities/user/api/server';
import { isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';
import { serverRow } from '../shared/serverUserFixtures';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);

const detail = (userCode: string, over: Record<string, unknown> = {}) => ({
  ...serverRow(userCode),
  authUid: 'Gx7kQ2pLm9VbR4tY1sWz3aHc8dE5',
  room: { code: 'WORK-AAAA' },
  hasPasswordLogin: true,
  awayImage: { url: 'https://x/away.png', size: 12 },
  openReports: 1,
  secretRoom: { code: 'SECR-1', name: '비밀', expiresAt: null },
  issuedInvites: [{ code: 'INVT-AAAA-BBBB', createdAt: '2026-10-02T00:00:00Z', usedBy: ['ufriend001'] }],
  issuedInviteCount: 3,
  usedInviteCount: 1,
  ...over,
});

describe('사용자 한 사람 — API 판', () => {
  it('상세 한 번으로 줄 칸 · 접속 · 방 · 초대 수를 모두 읽는다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1': () => detail('u1') });
    const d = await createServerUserPort(s.api).detail('u1');
    expect(d.row).toMatchObject({
      userCode: 'u1',
      name: '민트',
      license: 'KEY-1',
      licenseState: 'used',
      ver: '0.13.0',
      focusTotalSec: 7200,
    });
    expect(d.row.live.presence).toEqual({
      online: true,
      lastSeen: Date.parse('2026-11-10T00:00:00Z'),
      room: 'WORK-AAAA',
      ver: '0.13.0',
      verUnknown: false,
    });
    expect(d.row.live.invite).toEqual({
      joinedAt: Date.parse('2026-10-01T00:00:00Z'),
      invitedBy: 'uboss0001',
      invitesLeft: 2,
      inviteCode: 'INVT-AB2C-DE3F',
      inviteMemo: null,
    });
    expect(d).toMatchObject({
      authUid: 'Gx7kQ2pLm9VbR4tY1sWz3aHc8dE5',
      room: 'WORK-AAAA',
      hasPasswordLogin: true,
      awayImage: { url: 'https://x/away.png', size: 12 },
      openReports: 1,
      issuedInviteCount: 3,
      usedInviteCount: 1,
    });
    expect(s.calls).toHaveLength(1);
  });

  it('이름이 없는 사람(name: null)은 null 그대로', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1': () => detail('u1', { name: null }) });
    expect((await createServerUserPort(s.api).detail('u1')).row.name).toBeNull();
  });

  it('online null 은 «모름» 으로 남는다 — false 로 바꾸지 않는다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1': () => detail('u1', { online: null, room: null }) });
    const p = await createServerUserPort(s.api).presence('u1');
    expect(p?.online).toBeNull();
    expect(p?.room).toBeNull();
  });

  it('관리자가 만든 코드로 들어온 사람은 invitedBy 가 «admin», 제도 전부터 쓰던 사람은 null', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users/u1': () =>
        detail('u1', {
          invite: {
            joinedAt: '2026-10-01T00:00:00Z',
            invited: true,
            invitedByAdmin: true,
            invitedBy: null,
            invitesLeft: 0,
            inviteCode: 'INVT-FZFJ-6H5J',
            inviteMemo: '외부 행사',
          },
        }),
      'GET /v2/admin/users/u2': () =>
        detail('u2', {
          invite: {
            joinedAt: '2026-10-01T00:00:00Z',
            invited: false,
            invitedByAdmin: false,
            invitedBy: null,
            invitesLeft: 5,
            inviteCode: null,
            inviteMemo: null,
          },
        }),
    });
    const port = createServerUserPort(s.api);
    const u1 = (await port.detail('u1')).row.live.invite;
    expect(u1.invitedBy).toBe('admin');
    // 가입에 쓴 코드 · 그 메모가 그대로 온다 — 이름으로 찾은 사람이 어느 초대장으로 들어왔는지 보인다
    expect(u1).toMatchObject({ inviteCode: 'INVT-FZFJ-6H5J', inviteMemo: '외부 행사' });
    const u2 = (await port.detail('u2')).row.live.invite;
    expect(u2.invitedBy).toBeNull();
    expect(u2.inviteCode).toBeNull();
  });

  it('작은 읽기(이름 · 소개 · 집중)는 모두 상세의 한 칸이고 같은 때의 요청은 한 번만 보낸다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users/u1': () => detail('u1', { license: { key: 'KEY-1', state: 'revoked' } }),
    });
    const port = createServerUserPort(s.api);
    const [name, brief, focus] = await Promise.all([port.name('u1'), port.brief('u1'), port.focusSec('u1')]);
    expect(name).toBe('민트');
    expect(brief).toEqual({ name: '민트', friendCode: 'MATE-AB12', awayImg: 'https://x/away.png' });
    expect(focus).toBe(7200);
    expect(s.calls).toHaveLength(1);
  });

  it('칸이 약속과 다르면 짐작으로 채우지 않고 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users/u1': () => detail('u1', { focusTotalSec: '7200' }),
      'GET /v2/admin/users/u2': () => detail('u2', { online: 'yes' }),
      'GET /v2/admin/users/u3': () => detail('u3', { authUid: undefined }),
      'GET /v2/admin/users/u4': () => detail('u4', { authUid: null }),
    });
    const port = createServerUserPort(s.api);
    for (const uid of ['u1', 'u2', 'u3', 'u4']) {
      const e = await caught(port.detail(uid));
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });
});

describe('초대로 들어온 사람 — API 판', () => {
  const invitee = (userCode: string, over: Record<string, unknown> = {}) => ({
    userCode,
    name: `이름 ${userCode}`,
    friendCode: `MATE-${userCode}`,
    code: 'INVT-AAAA-BBBB',
    joinedAt: '2026-10-05T00:00:00Z',
    ...over,
  });

  it('한 쪽씩 받고 첫 쪽 total 을 쓴다 · 이름은 서버가 준 그대로', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/users/u1/invitees': ({ query }) =>
        query?.cursor
          ? { items: [invitee('u3', { name: null, friendCode: null })], nextCursor: null, total: null }
          : { items: [invitee('u2')], nextCursor: 'c1', total: 2 },
    });
    const port = createServerUserPort(s.api);
    const first = await port.invitees('u1', undefined, 100);
    expect(first).toEqual({
      items: [
        {
          userCode: 'u2',
          name: '이름 u2',
          friendCode: 'MATE-u2',
          code: 'INVT-AAAA-BBBB',
          joinedAt: Date.parse('2026-10-05T00:00:00Z'),
        },
      ],
      nextCursor: 'c1',
      total: 2,
    });
    const second = await port.invitees('u1', 'c1', 100);
    expect(second.items[0]).toMatchObject({ userCode: 'u3', name: null, friendCode: null });
    expect(second.total).toBeNull();
    expect(s.calls.map((c) => c.query)).toEqual([
      { cursor: undefined, limit: 100 },
      { cursor: 'c1', limit: 100 },
    ]);
  });

  it('첫 쪽에 total 이 없거나 칸이 틀리면 약속과 다른 응답', async () => {
    const noTotal = fakeApiOf({
      'GET /v2/admin/users/u1/invitees': () => ({ items: [], nextCursor: null }),
    });
    const e1 = await caught(createServerUserPort(noTotal.api).invitees('u1', undefined, 100));
    expect(isPortError(e1) && e1.code).toBe(WIRE_SHAPE_CODE);
    const bad = fakeApiOf({
      'GET /v2/admin/users/u1/invitees': () => ({
        items: [invitee('u2', { joinedAt: 'x' })],
        nextCursor: null,
        total: 1,
      }),
    });
    const e2 = await caught(createServerUserPort(bad.api).invitees('u1', undefined, 100));
    expect(isPortError(e2) && e2.code).toBe(WIRE_SHAPE_CODE);
  });
});
