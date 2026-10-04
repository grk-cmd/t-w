import { describe, expect, it } from 'vitest';
import { dismissReports, dismissReportsMany, takeDownAwayImg } from '@/features/user/moderate-report';
import { fakeDb } from '../shared/fakeDb';
import { fakeFiles } from '../shared/fakeFiles';

const URL = 'https://firebasestorage.googleapis.com/v0/b/x/o/away%2Fu1%2Fa.webp';
const data = { 'users/u1/awayImg': URL };

describe('그림 내리기', () => {
  it('그림 칸과 신고를 한 묶음으로 지운 뒤에 파일을 지운다', async () => {
    const { db, writes } = fakeDb(data);
    let writesWhenFileDeleted = -1;
    const { files, deleted } = fakeFiles(() => {
      writesWhenFileDeleted = writes.length;
      return false;
    });
    expect(await takeDownAwayImg(db, files, 'u1', URL)).toEqual({ ok: true, fileDeleted: true });
    expect(writes).toEqual([
      ['commit', 'users/u1/awayImg', null],
      ['commit', 'reports/u1', null],
    ]);
    expect(writesWhenFileDeleted).toBe(2);
    expect(deleted).toEqual([URL]);
  });

  it('DB 쓰기가 거부되면 아무것도 지우지 않고 파일도 건드리지 않는다', async () => {
    const { db, writes } = fakeDb(data, (p) => p.startsWith('reports/'));
    const { files, deleted } = fakeFiles();
    await expect(takeDownAwayImg(db, files, 'u1', URL)).rejects.toThrow();
    expect(writes).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it('파일만 못 지우면 DB 는 지운 채로 알린다', async () => {
    const { db, writes } = fakeDb(data);
    const { files } = fakeFiles(() => true);
    expect(await takeDownAwayImg(db, files, 'u1', URL)).toEqual({ ok: true, fileDeleted: false });
    expect(writes).toHaveLength(2);
  });

  it('그 사이 주인이 그림을 바꿨으면 아무것도 지우지 않는다', async () => {
    const { db, writes } = fakeDb({ 'users/u1/awayImg': `${URL}-new` });
    const { files, deleted } = fakeFiles();
    expect(await takeDownAwayImg(db, files, 'u1', URL)).toEqual({ ok: false, reason: 'changed' });
    expect(writes).toEqual([]);
    expect(deleted).toEqual([]);
  });
});

describe('문제없음', () => {
  it('신고만 비운다', async () => {
    const { db, writes } = fakeDb(data);
    await dismissReports(db, 'u1');
    expect(writes).toEqual([['commit', 'reports/u1', null]]);
  });
});

describe('선택 문제없음', () => {
  it('여러 사람의 신고를 한 묶음으로 비운다', async () => {
    const { db, writes } = fakeDb();
    expect(await dismissReportsMany(db, ['u1', 'u2'])).toBe(2);
    expect(writes).toEqual([
      ['commit', 'reports/u1', null],
      ['commit', 'reports/u2', null],
    ]);
  });

  it('하나라도 막히면 아무것도 비우지 않는다 · 대상이 없으면 보내지 않는다', async () => {
    const denied = fakeDb({}, (p) => p === 'reports/u2');
    await expect(dismissReportsMany(denied.db, ['u1', 'u2'])).rejects.toThrow();
    expect(denied.writes).toEqual([]);

    const empty = fakeDb({}, () => true);
    expect(await dismissReportsMany(empty.db, [])).toBe(0);
    expect(empty.writes).toEqual([]);
  });
});
