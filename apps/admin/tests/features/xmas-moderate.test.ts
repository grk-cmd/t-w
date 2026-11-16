import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, LOG_GROUPS } from '@/entities/admin-log';
import {
  dismissXmasReport,
  REMOVE_FN,
  removeGotLetter,
  removeOrnament,
} from '@/features/xmas/moderate-report';
import { RETURN_FN, returnLetter } from '@/features/xmas/return-letter';
import { AUDIT_ACTIONS, type Functions } from '@/shared/api';
import { auditsOf, fakeDb, withoutAudits } from '../shared/fakeDb';

const U1 = 'authUser00001';

function fakeFns(reply: unknown = { ok: true, notified: true }, fail?: Error) {
  const calls: [string, unknown][] = [];
  const fns: Functions = {
    call: async <T>(name: string, data: unknown) => {
      calls.push([name, data]);
      if (fail) throw fail;
      return reply as T;
    },
  };
  return { fns, calls };
}

describe('편지 반송', () => {
  it('함수 xmasAdminReturn 에 본 편지(uid · lid · ts) · 사유를 보내고 작업 기록을 남긴다', async () => {
    const { fns, calls } = fakeFns();
    const { db, writes } = fakeDb();
    const r = await returnLetter(fns, db, { uid: U1, lid: 'l2', ts: 77, reason: 'etc', note: '번호' });
    expect(RETURN_FN).toBe('xmasAdminReturn');
    expect(calls).toEqual([['xmasAdminReturn', { uid: U1, lid: 'l2', ts: 77, reason: 'etc', note: '번호' }]]);
    expect(r).toEqual({ notified: true });
    expect(auditsOf(writes)).toMatchObject([
      { action: 'xmas.returnLetter', target: `${U1}/l2`, detail: '기타 — 번호' },
    ]);
    expect(withoutAudits(writes)).toEqual([]);
  });
  it('함수가 거절하면 던지고 기록하지 않는다', async () => {
    const { fns } = fakeFns(
      null,
      Object.assign(new Error('그새 고쳐 쓴 편지예요'), { code: 'functions/failed-precondition' }),
    );
    const { db, writes } = fakeDb();
    await expect(returnLetter(fns, db, { uid: U1, lid: 'l1', ts: 1, reason: 'spam' })).rejects.toThrow();
    expect(writes).toEqual([]);
  });
});

describe('신고 처리', () => {
  it('장식 지우기 — 함수 xmasAdminRemove { tree, slot }', async () => {
    const { fns, calls } = fakeFns({ ok: true });
    const { db, writes } = fakeDb();
    await removeOrnament(fns, db, 3, 12);
    expect(REMOVE_FN).toBe('xmasAdminRemove');
    expect(calls).toEqual([['xmasAdminRemove', { tree: 3, slot: 12 }]]);
    expect(auditsOf(writes)[0]).toMatchObject({ action: 'xmas.removeOrnament' });
  });
  it('받은 편지 지우기 — { got, n }', async () => {
    const { fns, calls } = fakeFns({ ok: true });
    const { db, writes } = fakeDb();
    await removeGotLetter(fns, db, U1, 2);
    expect(calls).toEqual([['xmasAdminRemove', { got: U1, n: 2 }]]);
    expect(auditsOf(writes)[0]).toMatchObject({ action: 'xmas.removeLetter' });
  });
  it('문제없음 — 신고 칸만 비우고 기록과 한 묶음', async () => {
    const { db, writes } = fakeDb();
    await dismissXmasReport(db, 'o-3-12');
    expect(withoutAudits(writes)).toEqual([['commit', 'xmasReports/o-3-12', null]]);
    expect(auditsOf(writes)).toMatchObject([{ action: 'xmas.dismiss', target: 'o-3-12' }]);
  });
  it('작업 기록 이름 · 묶음이 있다', () => {
    for (const a of [
      'xmas.returnLetter',
      'xmas.removeOrnament',
      'xmas.removeLetter',
      'xmas.dismiss',
    ] as const) {
      expect(AUDIT_ACTIONS).toContain(a);
      expect(ACTION_LABEL[a]).toBeTruthy();
    }
    expect(LOG_GROUPS.map((g) => g.id)).toContain('xmas');
  });
});
