import { describe, expect, it } from 'vitest';
import { createServerGrantInvitesPort } from '@/features/user/grant-invites/api/server';
import { ApiError, isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);
const GRANTS = 'POST /v2/admin/invite-quotas/grants';
const REVOKES = 'POST /v2/admin/invite-quotas/revocations';
const bodyOf = (c: { body?: unknown }) => c.body as { requestId?: string; targets?: string[] };

describe('초대권 한 명 지급 — API 판', () => {
  it('사용자코드 · 장수와 요청 번호를 보내고 바꾼 뒤 장수를 돌려준다', async () => {
    const s = fakeApiOf({ [GRANTS]: () => ({ changed: 1, invitesLeft: 5 }) });
    expect(await createServerGrantInvitesPort(s.api).grantOne('u1', 3)).toEqual({ ok: true, after: 5 });
    expect(s.calls[0].body).toMatchObject({ target: 'u1', n: 3 });
    expect(s.calls[0].body).toHaveProperty('requestId');
  });

  it('안 바뀌었고 남은 장이 오면 상한 · 안 오면 초대 칸 없음', async () => {
    const full = fakeApiOf({ [GRANTS]: () => ({ changed: 0, invitesLeft: 999 }) });
    expect(await createServerGrantInvitesPort(full.api).grantOne('u1', 1)).toEqual({
      ok: false,
      reason: 'full',
    });
    const none = fakeApiOf({ [GRANTS]: () => ({ changed: 0 }) });
    expect(await createServerGrantInvitesPort(none.api).grantOne('u1', 1)).toEqual({
      ok: false,
      reason: 'no-invite',
    });
  });

  it('바뀌었다는데 남은 장이 없으면 약속과 다른 응답', async () => {
    const s = fakeApiOf({ [GRANTS]: () => ({ changed: 1 }) });
    const e = await caught(createServerGrantInvitesPort(s.api).grantOne('u1', 1));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('1~3장 밖은 보내지 않는다', async () => {
    const s = fakeApiOf({});
    await expect(createServerGrantInvitesPort(s.api).grantOne('u1', 4)).rejects.toThrow();
    expect(s.calls).toEqual([]);
  });

  it('닿지 못해 답을 못 받으면 다시 눌러도 같은 요청 번호로 보낸다', async () => {
    let n = 0;
    const s = fakeApiOf({
      [GRANTS]: () => {
        if (++n === 1) throw new ApiError('unavailable', 0, '', '연결 안 됨');
        return { changed: 1, invitesLeft: 2 };
      },
    });
    const port = createServerGrantInvitesPort(s.api);
    await caught(port.grantOne('u1', 1));
    await port.grantOne('u1', 1);
    expect(bodyOf(s.calls[0]).requestId).toBe(bodyOf(s.calls[1]).requestId);
  });
});

describe('초대권 지급 — 전체 · 고른 사람들 — API 판', () => {
  it('전체는 target "all" 한 번 — 바뀐 사람 수만 알고 나머지는 모른다(null)', async () => {
    const s = fakeApiOf({ [GRANTS]: () => ({ changed: 42 }) });
    const port = createServerGrantInvitesPort(s.api);
    expect(await port.countAll()).toBeNull();
    expect(await port.grant({ kind: 'all' }, 2)).toEqual({
      total: null,
      granted: 42,
      skipped: null,
      failed: 0,
      stopped: false,
    });
    expect(s.calls[0].body).toMatchObject({ target: 'all', n: 2 });
  });

  it('고른 사람들은 100명씩 나눠 보내고 줄마다 결과를 센다 · 진행을 알린다', async () => {
    const uids = Array.from({ length: 230 }, (_, i) => `u${i}`);
    const s = fakeApiOf({
      [GRANTS]: (c) => {
        const targets = bodyOf(c).targets!;
        return {
          changed: 0,
          results: targets.map((id, i) =>
            i % 10 === 0
              ? { id, ok: false, code: i % 20 === 0 ? 'NO_CHANGE' : 'USER_NOT_FOUND' }
              : { id, ok: true, left: 3 },
          ),
        };
      },
    });
    const seen: Array<[number, number]> = [];
    const r = await createServerGrantInvitesPort(s.api).grant({ kind: 'picked', uids }, 1, {
      onProgress: (d, t) => seen.push([d, t]),
    });
    expect(s.calls.map((c) => bodyOf(c).targets!.length)).toEqual([100, 100, 30]);
    expect(new Set(s.calls.map((c) => bodyOf(c).requestId)).size).toBe(3);
    expect(r).toEqual({ total: 230, granted: 207, skipped: 23, failed: 0, stopped: false });
    expect(seen).toEqual([
      [0, 230],
      [100, 230],
      [200, 230],
      [230, 230],
    ]);
  });

  it('멈추면 다음 묶음부터 서고 멈췄다고 알린다', async () => {
    const s = fakeApiOf({
      [GRANTS]: (c) => ({ changed: 0, results: bodyOf(c).targets!.map((id) => ({ id, ok: true, left: 1 })) }),
    });
    let calls = 0;
    const uids = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const r = await createServerGrantInvitesPort(s.api).grant({ kind: 'picked', uids }, 1, {
      shouldStop: () => calls++ >= 1,
    });
    expect(s.calls).toHaveLength(1);
    expect(r).toMatchObject({ granted: 100, stopped: true });
  });

  it('줄이 어긋나거나 모르는 까닭이면 약속과 다른 응답', async () => {
    const short = fakeApiOf({ [GRANTS]: () => ({ changed: 0, results: [] }) });
    const e1 = await caught(
      createServerGrantInvitesPort(short.api).grant({ kind: 'picked', uids: ['u1'] }, 1),
    );
    expect(isPortError(e1) && e1.code).toBe(WIRE_SHAPE_CODE);
    const odd = fakeApiOf({
      [GRANTS]: () => ({ changed: 0, results: [{ id: 'u1', ok: false, code: 'WHAT' }] }),
    });
    const e2 = await caught(createServerGrantInvitesPort(odd.api).grant({ kind: 'picked', uids: ['u1'] }, 1));
    expect(isPortError(e2) && e2.code).toBe(WIRE_SHAPE_CODE);
  });

  it('중간 묶음이 실패하면 «n명 됨 · m명 안 됨» 으로 던진다', async () => {
    let n = 0;
    const s = fakeApiOf({
      [GRANTS]: (c) => {
        if (++n === 2) throw new ApiError('unavailable', 0, '', '연결 안 됨');
        return { changed: 0, results: bodyOf(c).targets!.map((id) => ({ id, ok: true, left: 1 })) };
      },
    });
    const uids = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const e = await caught(createServerGrantInvitesPort(s.api).grant({ kind: 'picked', uids }, 1));
    expect(isPortError(e, 'unreachable')).toBe(true);
    expect((e as Error).message).toContain('100명 지급 · 50명 안 됨');
  });
});

describe('초대권 회수 — API 판', () => {
  it('전체는 target "all" — 요청 번호 없이 보내고 바뀐 사람 수만 안다', async () => {
    const s = fakeApiOf({ [REVOKES]: () => ({ changed: 7 }) });
    expect(await createServerGrantInvitesPort(s.api).revoke({ kind: 'all' })).toEqual({
      total: null,
      revoked: 7,
      taken: null,
      skipped: null,
      failed: 0,
      stopped: false,
    });
    expect(s.calls[0].body).toEqual({ target: 'all' });
  });

  it('고른 사람들은 줄마다 결과 — 안 된 줄은 건너뜀', async () => {
    const s = fakeApiOf({
      [REVOKES]: () => ({
        changed: 1,
        results: [
          { id: 'u1', ok: true, left: 0 },
          { id: 'u2', ok: false, code: 'NO_CHANGE', left: 0 },
        ],
      }),
    });
    expect(await createServerGrantInvitesPort(s.api).revoke({ kind: 'picked', uids: ['u1', 'u2'] })).toEqual({
      total: 2,
      revoked: 1,
      taken: null,
      skipped: 1,
      failed: 0,
      stopped: false,
    });
    expect(s.calls[0].body).toEqual({ targets: ['u1', 'u2'] });
  });
});

describe('한 명짜리 코드 · 여러 명 코드 — API 판', () => {
  const INVITES = 'POST /v2/admin/invites';

  it('한 명짜리는 maxUses 1 · count n 으로 한 번에 만들고 코드를 하나씩 알린다', async () => {
    const s = fakeApiOf({ [INVITES]: () => ({ code: 'INVT-A', codes: ['INVT-A', 'INVT-B'] }) });
    const got: string[] = [];
    expect(await createServerGrantInvitesPort(s.api).createCodes(2, (c) => got.push(c))).toEqual([
      'INVT-A',
      'INVT-B',
    ]);
    expect(got).toEqual(['INVT-A', 'INVT-B']);
    expect(s.calls[0].body).toMatchObject({ maxUses: 1, count: 2 });
    expect(s.calls[0].body).toHaveProperty('requestId');
  });

  it('개수가 틀리면 약속과 다른 응답 · 범위 밖이면 보내지 않는다', async () => {
    const s = fakeApiOf({ [INVITES]: () => ({ code: 'INVT-A', codes: ['INVT-A'] }) });
    const e = await caught(createServerGrantInvitesPort(s.api).createCodes(2));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    await expect(createServerGrantInvitesPort(s.api).createCodes(11)).rejects.toThrow();
    expect(s.calls).toHaveLength(1);
  });

  it('여러 명 코드는 인원 · 마감(ISO) · 메모를 보내고 코드를 돌려준다', async () => {
    const s = fakeApiOf({ [INVITES]: () => ({ code: 'INVT-Z', codes: null }) });
    const at = Date.parse('2026-12-01T00:00:00Z');
    expect(
      await createServerGrantInvitesPort(s.api).createGroup({ maxUses: 50, expiresAt: at, note: ' 봄 ' }),
    ).toBe('INVT-Z');
    expect(s.calls[0].body).toMatchObject({ maxUses: 50, expiresAt: '2026-12-01T00:00:00.000Z', memo: '봄' });
  });

  it('중지 · 다시 열기는 목록이 읽은 번호로 PATCH — 번호가 없으면 보내지 않는다', async () => {
    const s = fakeApiOf({ 'PATCH /v2/admin/invites/INVT-A': () => null });
    const port = createServerGrantInvitesPort(s.api);
    const g = {
      code: 'INVT-A',
      createdAt: 1,
      maxUses: 5,
      usedCount: 0,
      expiresAt: null,
      stoppedAt: null,
      note: '',
    };
    await port.setGroupStopped({ ...g, version: 4 }, true);
    expect(s.calls[0].body).toEqual({ version: 4, paused: true });
    const e = await caught(port.setGroupStopped(g, true));
    expect(isPortError(e, 'invalid')).toBe(true);
    expect(s.calls).toHaveLength(1);
  });

  it('다른 관리자가 먼저 고쳤으면(409) conflict', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/invites/INVT-A': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '먼저 처리됨');
      },
    });
    const g = {
      code: 'INVT-A',
      createdAt: 1,
      maxUses: 5,
      usedCount: 0,
      expiresAt: null,
      stoppedAt: null,
      note: '',
      version: 1,
    };
    const e = await caught(createServerGrantInvitesPort(s.api).setGroupStopped(g, false));
    expect(isPortError(e, 'conflict')).toBe(true);
  });
});
