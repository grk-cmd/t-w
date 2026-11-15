import { describe, expect, it } from 'vitest';
import { createServerApproveRequestPort } from '@/features/license/approve-request/api/server';
import { createServerBulkGrantPort } from '@/features/license/bulk-grant/api/server';
import { judge, type PlanRow } from '@/features/license/bulk-grant';
import type { SheetRow } from '@/features/license/bulk-grant/model/rows';
import { createServerGrantByCodePort } from '@/features/license/grant-by-code/api/server';
import { createServerGrantSecretRoomPort } from '@/features/license/grant-secret-room/api/server';
import { createServerIssueKeyPort } from '@/features/license/issue-key/api/server';
import { createServerRevokeKeyPort } from '@/features/license/revoke-key/api/server';
import { ApiError, isPortError, PortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);

describe('키 한 장 발급 — API 판', () => {
  it('주인 없는 키를 요청 번호와 함께 보내고 키를 돌려준다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses': () => [
        { friendCode: null, ok: true, code: null, licenseId: 'i1', key: 'AAAA-BBBB' },
      ],
    });
    expect(await createServerIssueKeyPort(s.api).issue('후원')).toBe('AAAA-BBBB');
    expect(s.calls[0].body).toMatchObject({ reissue: false, grants: [{ note: '후원' }] });
    expect(s.calls[0].body).toHaveProperty('requestId');
  });

  it('줄이 실패하면 서버 code 를 문구로 던진다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses': () => [
        { friendCode: null, ok: false, code: 'LICENSE_ALREADY_HAVE', licenseId: null, key: null },
      ],
    });
    const e = await caught(createServerIssueKeyPort(s.api).issue(''));
    expect(isPortError(e, 'invalid') && e.code).toBe('LICENSE_ALREADY_HAVE');
    expect((e as Error).message).toBe('이미 유효한 키가 있어요');
    expect(s.calls[0].body).toMatchObject({ grants: [{}] });
  });

  it('닿지 못해 답을 못 받으면 다시 눌러도 같은 요청 번호로 보낸다', async () => {
    let n = 0;
    const s = fakeApiOf({
      'POST /v2/admin/licenses': () => {
        if (++n === 1) throw new ApiError('unavailable', 0, '', '연결 안 됨');
        return [{ friendCode: null, ok: true, code: null, licenseId: 'i1', key: 'K' }];
      },
    });
    const port = createServerIssueKeyPort(s.api);
    await caught(port.issue('x'));
    await port.issue('x');
    const ids = s.calls.map((c) => (c.body as { requestId: string }).requestId);
    expect(ids[0]).toBe(ids[1]);
  });

  it('결과 줄 수가 다르면 약속과 다른 응답', async () => {
    const s = fakeApiOf({ 'POST /v2/admin/licenses': () => [] });
    const e = await caught(createServerIssueKeyPort(s.api).issue('x'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('친구코드로 발급 — API 판', () => {
  const answer = (row: object) => fakeApiOf({ 'POST /v2/admin/licenses': () => [row] });

  it('친구코드 · 재발급 허용으로 보내고 키를 돌려준다', async () => {
    const s = answer({ friendCode: 'MATE-AB12', ok: true, code: null, licenseId: 'i', key: 'K-1' });
    expect(await createServerGrantByCodePort(s.api).grant(' mate-ab12 ')).toEqual({
      ok: true,
      key: 'K-1',
      code: 'MATE-AB12',
      name: null,
    });
    expect(s.calls[0].body).toMatchObject({ reissue: true, grants: [{ friendCode: 'MATE-AB12' }] });
  });

  it('없는 사람은 not-found · 다른 실패는 던진다', async () => {
    const miss = answer({
      friendCode: 'MATE-AB12',
      ok: false,
      code: 'USER_NOT_FOUND',
      licenseId: null,
      key: null,
    });
    expect(await createServerGrantByCodePort(miss.api).grant('MATE-AB12')).toEqual({
      ok: false,
      reason: 'not-found',
    });
    const dup = answer({
      friendCode: 'MATE-AB12',
      ok: false,
      code: 'LICENSE_GRANT_DUPLICATE',
      licenseId: null,
      key: null,
    });
    expect(isPortError(await caught(createServerGrantByCodePort(dup.api).grant('MATE-AB12')))).toBe(true);
  });
});

describe('요청 승인 · 거절 — API 판', () => {
  const req = { id: 'r1', name: '철수', userCode: 'u1', requestedAt: 1 };

  it('승인 · 거절은 길 하나씩, 우편은 서버가 보내 모른다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/license-requests/r1/approve': () => null,
      'POST /v2/admin/license-requests/r1/reject': () => null,
    });
    const port = createServerApproveRequestPort(s.api);
    expect(await port.approve(req)).toEqual({ delivered: null });
    await port.reject(req);
    expect(s.calls.map((c) => c.path)).toEqual([
      '/v2/admin/license-requests/r1/approve',
      '/v2/admin/license-requests/r1/reject',
    ]);
  });

  it('한 번에 승인 — 줄마다 결과를 센다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/license-requests/bulk-approve': () => [
        { id: 'a', ok: true, code: null },
        { id: 'b', ok: false, code: 'LICENSE_REQUEST_NOT_FOUND' },
      ],
    });
    const result = await createServerApproveRequestPort(s.api).approveAll([
      { ...req, id: 'a' },
      { ...req, id: 'b' },
    ]);
    expect(result).toEqual({ issued: 1, failed: 1, notDelivered: null });
    expect(s.calls[0].body).toEqual({ ids: ['a', 'b'] });
  });

  it('결과 줄 수가 다르면 던진다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/license-requests/bulk-approve': () => [{ id: 'a', ok: true, code: null }],
    });
    const e = await caught(createServerApproveRequestPort(s.api).approveAll([req, { ...req, id: 'b' }]));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('키 회수 · 삭제 — API 판', () => {
  const row = (n: number, status: 'unused' | 'revoked' = 'unused') => ({
    key: `K${n}`,
    status,
    licenseId: `id-${n}`,
    version: n,
  });

  it('한 장은 PATCH · DELETE 에 읽은 번호를 싣는다', async () => {
    const s = fakeApiOf({
      'PATCH /v2/admin/licenses/id-1': () => null,
      'DELETE /v2/admin/licenses/id-2': () => null,
    });
    const port = createServerRevokeKeyPort(s.api);
    expect(await port.revoke([row(1)])).toBe(1);
    expect(await port.remove([row(2, 'revoked')])).toBe(1);
    expect(s.calls[0].body).toEqual({ version: 1, status: 'REVOKED' });
    expect(s.calls[1].query).toEqual({ version: 2 });
  });

  it('여러 장은 묶음 한 번 — 줄마다 결과', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/bulk': () => [
        { id: 'id-1', ok: true, code: null },
        { id: 'id-2', ok: true, code: null },
      ],
    });
    expect(await createServerRevokeKeyPort(s.api).revoke([row(1), row(2)])).toBe(2);
    expect(s.calls[0].body).toEqual({
      action: 'REVOKE',
      items: [
        { licenseId: 'id-1', version: 1 },
        { licenseId: 'id-2', version: 2 },
      ],
    });
  });

  it('일부가 안 되면 «n개 됨 · m개 안 됨» — 번호가 낡았으면 conflict', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/bulk': () => [
        { id: 'id-1', ok: true, code: null },
        { id: 'id-2', ok: false, code: 'CONCURRENT_UPDATE' },
      ],
    });
    const e = await caught(createServerRevokeKeyPort(s.api).remove([row(1, 'revoked'), row(2, 'revoked')]));
    expect(isPortError(e, 'conflict')).toBe(true);
    expect((e as Error).message).toBe('1개 됨 · 1개 안 됨');
  });

  it('id · 번호가 없는 줄이면 아무것도 보내기 전에 던진다', async () => {
    const s = fakeApiOf({});
    const e = await caught(
      createServerRevokeKeyPort(s.api).revoke([row(1), { key: 'K2', status: 'unused' }]),
    );
    expect(e).toBeInstanceOf(PortError);
    expect(s.calls).toEqual([]);
  });
});

describe('엑셀 일괄 발급 — API 판', () => {
  const sheet = (line: number, code: string, memo = ''): SheetRow => ({
    line,
    cells: [code, memo],
    code,
    memo,
    hasKey: false,
  });
  const preview = (friendCode: string, found: boolean, hasValidLicense = false) =>
    found
      ? { friendCode, found, name: `이름-${friendCode}`, hasValidLicense }
      : { friendCode, found, hasValidLicense };

  it('미리 보기 — 생김새가 맞는 코드만 한 번에 묻고, 이미 받은 사람은 issued() 로 가른다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/preview': () => [
        preview('MATE-AAAA', true, true),
        preview('MATE-BBBB', false),
        preview('MATE-CCCC', true),
      ],
    });
    const port = createServerBulkGrantPort(s.api);
    const rows = await port.lookup([
      sheet(2, 'mate-aaaa'),
      sheet(3, 'MATE-BBBB'),
      sheet(4, '엉터리'),
      sheet(5, ''),
      sheet(6, 'MATE-CCCC'),
      sheet(7, 'MATE-AAAA'),
    ]);
    expect(s.calls[0].body).toEqual({ friendCodes: ['MATE-AAAA', 'MATE-BBBB', 'MATE-CCCC'] });
    expect(rows.map((r) => [r.base, r.code, r.name, r.hasLicense])).toEqual([
      ['send', 'MATE-AAAA', '이름-MATE-AAAA', true],
      ['nouser', '', '', false],
      ['badcode', '', '', false],
      ['key', '', '', false],
      ['send', 'MATE-CCCC', '이름-MATE-CCCC', false],
      ['send', 'MATE-AAAA', '이름-MATE-AAAA', true],
    ]);
    const issued = await port.issued();
    expect(judge(rows, { dupFirst: false, reissue: false }, issued).map((r) => r.st)).toEqual([
      'issued',
      'nouser',
      'badcode',
      'key',
      'send',
      'issued',
    ]);
    expect(judge(rows, { dupFirst: false, reissue: true }, issued)[0].st).toBe('send');
  });

  it('발급 — 줄마다 한 요청으로 보내고 결과를 행에 싣는다(재발급 체크는 reissue)', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses': () => [
        { friendCode: 'MATE-AAAA', ok: true, code: null, licenseId: 'i1', key: 'K1' },
        { friendCode: null, ok: true, code: null, licenseId: 'i2', key: 'K2' },
        { friendCode: 'MATE-CCCC', ok: false, code: 'LICENSE_ALREADY_HAVE', licenseId: null, key: null },
      ],
    });
    const base = { line: 0, cells: [] as string[], raw: '', memo: '', uid: null, name: '' };
    const plan: PlanRow[] = [
      { ...base, line: 2, code: 'MATE-AAAA', base: 'send', st: 'send' },
      { ...base, line: 3, code: '', base: 'nouser', st: 'nouser' },
      { ...base, line: 4, code: '', base: 'key', st: 'key' },
      { ...base, line: 5, code: 'MATE-CCCC', base: 'send', st: 'send' },
    ];
    const progress: Array<[number, number]> = [];
    const out = await createServerBulkGrantPort(s.api).run(plan, { reissue: true }, (n, t) =>
      progress.push([n, t]),
    );
    expect(s.calls[0].body).toMatchObject({
      reissue: true,
      grants: [{ friendCode: 'MATE-AAAA' }, {}, { friendCode: 'MATE-CCCC' }].map((g) =>
        expect.objectContaining(g),
      ),
    });
    expect(out.map((r) => [r.st, r.res, r.key, r.why])).toEqual([
      ['send', 'ok', 'K1', undefined],
      ['nouser', undefined, undefined, undefined],
      ['key', 'okkey', 'K2', undefined],
      ['send', 'fail', undefined, '이미 유효한 키가 있어요'],
    ]);
    expect(progress).toEqual([
      [0, 3],
      [3, 3],
    ]);
  });
});

describe('시크릿룸 발급 — API 판', () => {
  const found = (over: object = {}) => ({
    friendCode: 'MATE-AB12',
    found: true,
    name: '철수',
    hasValidLicense: false,
    ...over,
  });
  const roomAnswer = (over: object = {}) => ({
    secretRoomId: 'r1',
    code: 'SCRT-WXYZ',
    ownerUserCode: 'u1',
    name: '철수',
    expiresAt: '2027-02-16T00:00:00Z',
    endedAt: null,
    version: 1,
    ...over,
  });
  const prepared = async (
    s: ReturnType<typeof fakeApiOf>,
    over: { target?: string; want?: string; months?: string } = {},
  ) => {
    const port = createServerGrantSecretRoomPort(s.api);
    const r = await port.prepare({ target: 'MATE-AB12', want: '', months: '3', ...over });
    return { port, r };
  };

  it('열쇠를 받지 않는다', () => {
    expect(createServerGrantSecretRoomPort(fakeApiOf({}).api).needsKey).toBe(false);
  });

  it('받는 사람 확인 — 유저 코드는 받지 않고, 없는 사람은 알린다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/preview': () => [found({ found: false, name: undefined })],
    });
    const user = await prepared(s, { target: 'u1234567890abcd' });
    expect(user.r.ok).toBe(false);
    expect(s.calls).toEqual([]);
    const none = await prepared(s);
    expect(none.r).toEqual({ ok: false, error: '해당 친구코드를 가진 유저를 찾을 수 없어요' });
    const badMonths = await prepared(s, { months: '삼' });
    expect(badMonths.r.ok).toBe(false);
  });

  it('발급 — 친구코드 · 이름 · 개월 수만 보내고 끝나는 날은 서버가 준 것을 쓴다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/preview': () => [found()],
      'GET /v2/admin/secret-rooms': () => [],
      'POST /v2/admin/secret-rooms': () => roomAnswer(),
    });
    const { port, r } = await prepared(s, { want: 'wxyz' });
    if (!r.ok) throw new Error('확인이 통과해야 해요');
    expect(r.plan.warnings).toEqual([]);
    const result = await port.grant(r.plan);
    expect(s.calls[2].body).toMatchObject({
      friendCode: 'MATE-AB12',
      code: 'SCRT-WXYZ',
      name: '철수',
      months: 3,
      confirmTakeover: false,
    });
    expect(result).toMatchObject({ ok: true, code: 'SCRT-WXYZ', recipient: 'u1', sent: null, linked: null });
    expect(result.ok && result.period).toMatch(/^3개월 · \d{4}-\d{2}-\d{2} 까지$/);
  });

  it('영구는 months: null · 코드를 비우면 code 를 보내지 않는다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/preview': () => [found()],
      'GET /v2/admin/secret-rooms': () => [],
      'POST /v2/admin/secret-rooms': () => roomAnswer({ expiresAt: null }),
    });
    const { port, r } = await prepared(s, { months: '' });
    if (!r.ok) throw new Error('확인이 통과해야 해요');
    const result = await port.grant(r.plan);
    expect(s.calls[2].body).not.toHaveProperty('code');
    expect(s.calls[2].body).toMatchObject({ months: null });
    expect(result.ok && result.period).toBe('영구');
  });

  it('남이 가진 코드(409)는 겹친 방을 알려 주고, 확인받으면 confirmTakeover 로 다시 보낸다', async () => {
    let takeover = false;
    const s = fakeApiOf({
      'POST /v2/admin/licenses/preview': () => [found()],
      'GET /v2/admin/secret-rooms': () => [],
      'POST /v2/admin/secret-rooms': ({ body }) => {
        takeover = (body as { confirmTakeover: boolean }).confirmTakeover;
        if (!takeover)
          throw new ApiError('request', 409, 'LICENSE_SECRET_ROOM_CODE_TAKEN', '겹쳐요', [
            { secretRoomId: 'x', ownerUserCode: 'u9', expiresAt: null, endedAt: null },
          ]);
        return roomAnswer();
      },
    });
    const { port, r } = await prepared(s, { want: 'WXYZ' });
    if (!r.ok) throw new Error('확인이 통과해야 해요');
    const first = await port.grant(r.plan);
    expect(first).toEqual({
      ok: false,
      denied: false,
      taken: [{ secretRoomId: 'x', ownerUserCode: 'u9', expiresAt: null, endedAt: null }],
    });
    const second = await port.grant({ ...r.plan, takeover: true } as typeof r.plan);
    expect(second.ok).toBe(true);
    const ids = s.calls
      .filter((c) => c.method === 'POST' && c.path.endsWith('/secret-rooms'))
      .map((c) => (c.body as { requestId: string }).requestId);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('이미 방이 있는 사람 — 연장 · 영구 해제 · 코드 바꿈을 경고로 알린다', async () => {
    const mine = (over: object = {}) => ({
      secretRoomId: 'm1',
      code: 'SCRT-MINE',
      ownerUserCode: 'u1',
      ownerName: '철수',
      name: '철수',
      expiresAt: null,
      endedAt: null,
      version: 1,
      ...over,
    });
    const warn = async (room: object, over: { want?: string; months?: string }) => {
      const s = fakeApiOf({
        'POST /v2/admin/licenses/preview': () => [found()],
        'GET /v2/admin/secret-rooms': () => [
          mine({ secretRoomId: 'old', code: null, endedAt: '2026-01-01T00:00:00Z' }),
          room,
        ],
      });
      const { r } = await prepared(s, over);
      if (!r.ok) throw new Error('확인이 통과해야 해요');
      expect(s.calls[1].query).toEqual({ friendCode: 'MATE-AB12' });
      return r.plan.warnings;
    };
    expect(await warn(mine(), { want: 'mine', months: '3' })).toEqual([
      expect.stringContaining('영구가 풀리고'),
    ]);
    expect(await warn(mine({ expiresAt: '2099-01-01T00:00:00Z' }), { want: 'MINE', months: '3' })).toEqual([
      expect.stringContaining('남은 기간에 이어붙입니다'),
    ]);
    expect(await warn(mine(), { want: 'NEW1', months: '3' })).toEqual([
      expect.stringMatching(/SCRT-NEW1 로 발급하면 SCRT-MINE 는 바로 끝나고/),
    ]);
    expect(await warn(mine(), { months: '3' })).toEqual([expect.stringContaining('새 코드 로 발급하면')]);
  });

  it('겹침이 아닌 실패는 던진다', async () => {
    const s = fakeApiOf({
      'POST /v2/admin/licenses/preview': () => [found()],
      'GET /v2/admin/secret-rooms': () => [],
      'POST /v2/admin/secret-rooms': () => {
        throw new ApiError('request', 409, 'CONCURRENT_UPDATE', '');
      },
    });
    const { port, r } = await prepared(s);
    if (!r.ok) throw new Error('확인이 통과해야 해요');
    expect(isPortError(await caught(port.grant(r.plan)), 'conflict')).toBe(true);
  });
});
