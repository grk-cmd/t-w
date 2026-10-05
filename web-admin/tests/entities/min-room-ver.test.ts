import { describe, expect, it } from 'vitest';
import { compareVersion, getMinRoomVer, minRoomVerProblem, saveMinRoomVer } from '@/entities/min-room-ver';
import { fakeDb } from '../shared/fakeDb';

describe('방 입장 최소 버전', () => {
  it('읽은 값은 문자열로 맞춘다', async () => {
    expect(await getMinRoomVer(fakeDb().db)).toBeNull();
    expect(await getMinRoomVer(fakeDb({ 'config/minRoomVer': '0.10.2' }).db)).toBe('0.10.2');
  });
});

describe('방 입장 최소 버전 바꾸기', () => {
  it('앱 _verLt 처럼 숫자로 비교한다 — 0.10.0 > 0.9.8', () => {
    expect(compareVersion('0.10.0', '0.9.8')).toBeGreaterThan(0);
    expect(compareVersion('v0.10.2', '0.10.2-beta.1')).toBe(0);
    expect(compareVersion('0.10.1', '0.10.2')).toBeLessThan(0);
  });

  it('최신 릴리스보다 높거나 모양이 틀리면 막는다 — 모두 방에서 막히는 값', () => {
    expect(minRoomVerProblem('0.10.2', '0.10.1', '0.10.2')).toBeNull();
    expect(minRoomVerProblem('0.9.0', '0.10.1', '0.10.2')).toBeNull();
    expect(minRoomVerProblem('0.10.3', '0.10.1', '0.10.2')).toContain('최신 릴리스(0.10.2)보다 높아요');
    expect(minRoomVerProblem('0.10', '0.10.1', '0.10.2')).toContain('숫자 세 자리');
    expect(minRoomVerProblem('0.10.1', '0.10.1', '0.10.2')).toBe('지금 값과 같아요');
    expect(minRoomVerProblem('0.10.2', null, null)).toContain('확인하지 못했어요');
  });

  it('값과 기록을 한 묶음으로', async () => {
    const { db, writes } = fakeDb();
    await saveMinRoomVer(db, ' 0.10.2 ', '0.10.1');
    expect(writes.find((w) => w[1] === 'config/minRoomVer')).toEqual([
      'commit',
      'config/minRoomVer',
      '0.10.2',
    ]);
    const log = writes.find((w) => w[1].startsWith('adminLog/'));
    expect(log?.[2]).toMatchObject({
      action: 'settings.minRoomVer',
      target: '0.10.2',
      detail: '0.10.1 → 0.10.2',
    });
  });
});
