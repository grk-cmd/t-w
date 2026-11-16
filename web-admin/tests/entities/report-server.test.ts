import { describe, expect, it } from 'vitest';
import { createServerReportPort } from '@/entities/report/api/server';
import { isPortError, WIRE_SHAPE_CODE } from '@/shared/api';
import { fakeApiOf } from '../shared/fakeApi';

const caught = (promise: Promise<unknown>) => promise.catch((e: unknown) => e);
const LIST = 'GET /v2/admin/reports';
const targets = async (port: ReturnType<typeof createServerReportPort>) =>
  (await port.page(undefined, 100)).items;

const reporter = (extra: Record<string, unknown> = {}) => ({
  userCode: 'r1',
  displayName: '지금이름',
  friendCode: 'ABCD-1234',
  nameSnapshot: '그때이름',
  kind: 'ETC',
  note: '욕설',
  at: '2026-11-01T03:00:00Z',
  ...extra,
});

const target = (extra: Record<string, unknown> = {}) => ({
  target: 'u1',
  displayName: '철수',
  friendCode: 'WXYZ-0001',
  awayImage: { url: 'https://img/a.png', size: 10 },
  openCount: 3,
  byKind: { ETC: 3 },
  reporters: [reporter(), reporter({ userCode: 'r2' }), reporter({ userCode: 'r3' })],
  ...extra,
});

describe('신고 목록 — API 판', () => {
  it('서버가 거른 대상을 이름 · 친구코드 · 그림과 신고자 줄로 읽고, minReporters 는 보내지 않는다', async () => {
    const s = fakeApiOf({ [LIST]: () => ({ items: [target()], nextCursor: null, total: 1 }) });
    const [row] = await targets(createServerReportPort(s.api));
    expect(row.target).toBe('u1');
    expect(row.openCount).toBe(3);
    expect(row.card).toEqual({ name: '철수', friendCode: 'WXYZ-0001', awayImg: 'https://img/a.png' });
    expect(row.reports).toHaveLength(3);
    expect(row.reports[0]).toMatchObject({
      kind: 'etc',
      nick: '그때이름',
      code4: '1234',
      note: '욕설',
      ts: Date.parse('2026-11-01T03:00:00Z'),
    });
    expect(s.calls[0].query).toEqual({ cursor: undefined, limit: 100 });
  });

  it('한 쪽씩 — 커서 · limit 을 그대로 보내고 첫 쪽 total · 다음 쪽 null 을 읽는다', async () => {
    const s = fakeApiOf({
      [LIST]: (c) =>
        c.query?.cursor === undefined
          ? { items: [target()], nextCursor: 'c2', total: 2 }
          : { items: [target({ target: 'u2' })], nextCursor: null, total: null },
    });
    const port = createServerReportPort(s.api);
    const first = await port.page(undefined, 100);
    expect(first).toMatchObject({ nextCursor: 'c2', total: 2 });
    const next = await port.page('c2', 100);
    expect(next.items.map((r) => r.target)).toEqual(['u2']);
    expect(next).toMatchObject({ nextCursor: null, total: null });
    expect(s.calls[1].query).toEqual({ cursor: 'c2', limit: 100 });
  });

  it('첫 쪽에 total 이 없으면 약속과 다른 응답', async () => {
    const s = fakeApiOf({ [LIST]: () => ({ items: [], nextCursor: null, total: null }) });
    const e = await caught(createServerReportPort(s.api).page(undefined, 100));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });

  it('탈퇴한 사람(이름 · 친구코드 · 그림 null)은 null 그대로 — 지어내지 않는다', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [target({ displayName: null, friendCode: null, awayImage: null })],
        nextCursor: null,
        total: 1,
      }),
    });
    const [row] = await targets(createServerReportPort(s.api));
    expect(row.card).toEqual({ name: null, friendCode: null, awayImg: null });
  });

  it('옛 신고 줄(nameSnapshot null)은 지금 이름, 둘 다 없으면 이름 칸 없음', async () => {
    const s = fakeApiOf({
      [LIST]: () => ({
        items: [
          target({
            reporters: [
              reporter({ nameSnapshot: null }),
              reporter({ nameSnapshot: null, displayName: null, note: null }),
            ],
          }),
        ],
        nextCursor: null,
        total: 1,
      }),
    });
    const [row] = await targets(createServerReportPort(s.api));
    expect(row.reports[0].nick).toBe('지금이름');
    expect(row.reports[1]).not.toHaveProperty('nick');
    expect(row.reports[1]).not.toHaveProperty('note');
  });

  it('모르는 종류 · 칸 모양이 다르면 줄을 버리지 않고 약속과 다른 응답', async () => {
    for (const bad of [
      target({ reporters: [reporter({ kind: 'SPAM' })] }),
      target({ reporters: [reporter({ at: '어제' })] }),
      target({ target: 7 }),
      target({ openCount: null }),
      target({ awayImage: { size: 1 } }),
    ]) {
      const s = fakeApiOf({ [LIST]: () => ({ items: [bad], nextCursor: null, total: 1 }) });
      const e = await caught(targets(createServerReportPort(s.api)));
      expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
    }
  });

  it('쪽이 객체가 아니면 약속과 다른 응답', async () => {
    const s = fakeApiOf({ [LIST]: () => [] });
    const e = await caught(targets(createServerReportPort(s.api)));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});

describe('한 사람이 받은 신고 수 — API 판', () => {
  it('사용자 상세의 openReports 를 읽는다', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1': () => ({ userCode: 'u1', openReports: 4 }) });
    expect(await createServerReportPort(s.api).countFor('u1')).toBe(4);
  });

  it('칸이 없으면 0 으로 덮지 않고 약속과 다른 응답', async () => {
    const s = fakeApiOf({ 'GET /v2/admin/users/u1': () => ({ userCode: 'u1' }) });
    const e = await caught(createServerReportPort(s.api).countFor('u1'));
    expect(isPortError(e) && e.code).toBe(WIRE_SHAPE_CODE);
  });
});
