import { describe, expect, it } from 'vitest';
import { actionLabel, inGroup, listAdminLog, toLogEntries, whoLabel } from '@/entities/admin-log';
import { fakeDb } from '../shared/fakeDb';

const line = (at: number, action = 'room.close') => ({ at, by: 'uadmin123', action, target: 'T' });

describe('작업 기록 목록', () => {
  it('최근 것부터 · 모양이 틀린 줄은 뺀다', () => {
    const list = toLogEntries({ a: line(1), b: line(3), bad: { by: 'x' }, c: line(2, 'license.issue') });
    expect(list.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(list[0]).toEqual({
      id: 'b',
      at: 3,
      by: 'uadmin123',
      action: 'room.close',
      target: 'T',
      detail: '',
    });
  });

  it('최근 n 개만 받고, 꽉 찼으면 더 있을 수 있다고 알린다', async () => {
    const { db } = fakeDb({ adminLog: { a: line(1), b: line(2), c: line(3) } });
    const page = await listAdminLog(db, 2);
    expect(page.items.map((e) => e.id)).toEqual(['c', 'b']);
    expect(page.hasMore).toBe(true);
    expect((await listAdminLog(db, 5)).hasMore).toBe(false);
  });

  it('나면 «나», 아니면 uid 앞부분 — 이메일은 쓰지 않는다', () => {
    expect(whoLabel('uadmin123', 'uadmin123')).toBe('나');
    expect(whoLabel('uadmin123', 'other')).toBe('uadmin…');
    expect(whoLabel('abc', null)).toBe('abc');
  });

  it('종류 칩 · 화면 이름', () => {
    const [e] = toLogEntries({ a: line(1, 'license.revoke') });
    expect(inGroup(e, 'all')).toBe(true);
    expect(inGroup(e, 'license')).toBe(true);
    expect(inGroup(e, 'room')).toBe(false);
    expect(actionLabel('license.revoke')).toBe('키 회수');
    expect(actionLabel('future.thing')).toBe('future.thing');
  });
});
