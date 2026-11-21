import { describe, expect, it } from 'vitest';
import { announceRemaining, clearAnnounce, getAnnounce, publishAnnounce } from '@/entities/notice/announce';
import { fakeDb, withoutAudits, NOW } from '../shared/fakeDb';

describe('확성기 공지', () => {
  it('앱이 읽는 모양(text · ts · duration 1분)으로 통째로 쓴다', async () => {
    const { db, writes } = fakeDb();
    await publishAnnounce(db, '  점검 5분 전  ');
    expect(withoutAudits(writes)).toEqual([
      ['commit', 'announce/current', { text: '점검 5분 전', ts: NOW, duration: 60_000 }],
    ]);
  });

  it('140자를 넘으면 자른다(규칙 한도)', async () => {
    const { db, writes } = fakeDb();
    await publishAnnounce(db, 'ㄱ'.repeat(200));
    expect((writes[0][2] as { text: string }).text).toHaveLength(140);
  });

  it('끄기는 노드를 지운다', async () => {
    const { db, writes } = fakeDb();
    await clearAnnounce(db);
    expect(withoutAudits(writes)).toEqual([['commit', 'announce/current', null]]);
  });

  it('현재 값은 announce/current 한 노드만 읽는다', async () => {
    const cur = { text: '안녕', ts: 1, duration: 60_000 };
    const { db } = fakeDb({ 'announce/current': cur });
    expect(await getAnnounce(db)).toEqual(cur);
    expect(await getAnnounce(fakeDb().db)).toBeNull();
  });

  it('남은 시간 — ts + duration 까지, 지나면 0', () => {
    const a = { text: '안녕', ts: 1_000, duration: 60_000 };
    expect(announceRemaining(a, 1_000)).toBe(60_000);
    expect(announceRemaining(a, 31_000)).toBe(30_000);
    expect(announceRemaining(a, 61_000)).toBe(0);
    expect(announceRemaining(null, 0)).toBe(0);
    expect(announceRemaining({ text: '', ts: 0, duration: 60_000 }, 0)).toBe(0);
  });
});
