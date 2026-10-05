import { afterEach, describe, expect, it, vi } from 'vitest';
import rulesText from '../../../firebase-database-rules.json?raw';
import { AUDIT_ACTIONS, auditAfter, auditEntry, countTarget, maskKey, withAudit } from '@/shared/api';
import { ADMIN_UID, auditsOf, fakeDb, NOW } from './fakeDb';

afterEach(() => vi.restoreAllMocks());

describe('작업 기록 헬퍼', () => {
  it('기록 한 줄 — 서버 시각 · 로그인 uid · 짧은 식별자, detail 은 있을 때만', () => {
    const { db } = fakeDb();
    expect(Object.values(auditEntry(db, 'room.close', 'WORK-AB12', '', 'id1'))).toEqual([
      { at: NOW, by: ADMIN_UID, action: 'room.close', target: 'WORK-AB12' },
    ]);
    expect(Object.keys(auditEntry(db, 'room.close', 'x', undefined, 'id1'))).toEqual(['adminLog/id1']);
  });

  it('규칙 길이에 맞춰 자른다 — target 60자 · detail 120자', () => {
    const { db } = fakeDb();
    const [v] = Object.values(auditEntry(db, 'notice.announce', 'a'.repeat(99), 'b'.repeat(200))) as {
      target: string;
      detail: string;
    }[];
    expect(v.target).toHaveLength(60);
    expect(v.detail).toHaveLength(120);
  });

  it('로그인 uid 를 모르면 쓰지 않는다 — 규칙이 어차피 거절한다', () => {
    const { db } = fakeDb();
    db.uid = () => null;
    expect(auditEntry(db, 'room.close', 'x')).toEqual({});
  });

  it('withAudit — 같은 묶음에 한 줄 얹고, 바꿀 것이 없으면 기록도 없다', () => {
    const { db } = fakeDb();
    const out = withAudit(db, { 'rooms/A': null }, 'room.close', 'A');
    expect(Object.keys(out)).toHaveLength(2);
    expect(out['rooms/A']).toBeNull();
    expect(withAudit(db, {}, 'room.close', 'A')).toEqual({});
  });

  it('같은 묶음이라 동작이 거절되면 기록도 남지 않는다', async () => {
    const { db, writes } = fakeDb({}, (p) => p === 'rooms/A');
    await expect(db.commit(withAudit(db, { 'rooms/A': null }, 'room.close', 'A'))).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it('auditAfter — 따로 한 줄 쓰고, 실패해도 던지지 않고 콘솔에만 남긴다', async () => {
    const ok = fakeDb();
    await auditAfter(ok.db, 'invite.codes', '3개');
    expect(auditsOf(ok.writes)).toEqual([{ at: NOW, by: ADMIN_UID, action: 'invite.codes', target: '3개' }]);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const denied = fakeDb({}, (p) => p.startsWith('adminLog/'));
    await expect(auditAfter(denied.db, 'invite.codes', '3개')).resolves.toBeUndefined();
    expect(denied.writes).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('모든 action 이 규칙의 action 모양을 통과한다 — 숫자가 섞이면 동작 묶음째 거절된다', () => {
    const rules = JSON.parse(rulesText);
    const expr: string = rules.rules.adminLog.$logId.action['.validate'];
    const re = new RegExp(/matches\(\/(.+)\/\)/.exec(expr)![1]);
    expect(AUDIT_ACTIONS.filter((a) => !re.test(a))).toEqual([]);
  });

  it('키는 첫 덩어리만, 여러 대상은 앞 몇 개와 개수', () => {
    expect(maskKey('ABCD-EFGH-JKLM-NPQR')).toBe('ABCD-…');
    expect(maskKey('KEY')).toBe('KEY');
    expect(countTarget(['a', 'b'])).toBe('a, b');
    expect(countTarget(['a', 'b', 'c', 'd', 'e'])).toBe('a, b, c 외 2개');
    expect(countTarget(['a', 'b', 'c', 'd'], '명', 2)).toBe('a, b 외 2명');
  });
});
