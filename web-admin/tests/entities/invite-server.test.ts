import { describe, expect, it } from 'vitest';
import { createServerInvitePort } from '@/entities/invite/api/server';
import { isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
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
  it('끝까지 이어 받고 줄을 화면 모양으로 바꾼다(번호 · 중지 시각 · 메모)', async () => {
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
            }
          : { items: [row('INVT-CCCC-DDDD')], nextCursor: null },
    });
    const list = await createServerInvitePort(s.api).groups();
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

  it('칸이 약속과 다르면 줄을 버리지 않고 던진다', async () => {
    const s = fakeApiOf({
      'GET /v2/admin/invites': () => ({ items: [row('INVT-AAAA-BBBB', { version: '4' })], nextCursor: null }),
    });
    const e = await caught(createServerInvitePort(s.api).groups());
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
