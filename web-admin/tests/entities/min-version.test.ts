import { describe, expect, it } from 'vitest';
import rulesText from '../../../firebase-database-rules.json?raw';
import {
  compareVersion,
  getMinVersion,
  MIN_VERSION_MAX,
  MIN_VERSIONS,
  minVersionProblem,
  saveMinVersion,
} from '@/entities/min-version';
import { ACTION_LABEL } from '@/entities/admin-log';
import { AUDIT_ACTIONS } from '@/shared/api';
import { fakeDb } from '../shared/fakeDb';

describe('최소 버전 읽기 — 방 입장 · 앱', () => {
  it('읽은 값은 문자열로 맞춘다', async () => {
    expect(await getMinVersion(fakeDb().db, 'room')).toBeNull();
    expect(await getMinVersion(fakeDb({ 'config/minRoomVer': '0.10.2' }).db, 'room')).toBe('0.10.2');
    expect(await getMinVersion(fakeDb().db, 'app')).toBeNull();
    expect(await getMinVersion(fakeDb({ 'config/minAppVer': '0.10.3' }).db, 'app')).toBe('0.10.3');
  });

  it('두 값은 서로 다른 칸이다 — 방 값을 앱 값으로 읽지 않는다', async () => {
    const { db } = fakeDb({ 'config/minRoomVer': '0.10.1' });
    expect(await getMinVersion(db, 'app')).toBeNull();
    expect(MIN_VERSIONS.room.path).toBe('config/minRoomVer');
    expect(MIN_VERSIONS.app.path).toBe('config/minAppVer');
  });
});

describe('최소 버전 바꾸기', () => {
  it('앱 _verLt 처럼 숫자로 비교한다 — 0.10.0 > 0.9.8', () => {
    expect(compareVersion('0.10.0', '0.9.8')).toBeGreaterThan(0);
    expect(compareVersion('v0.10.2', '0.10.2-beta.1')).toBe(0);
    expect(compareVersion('0.10.1', '0.10.2')).toBeLessThan(0);
  });

  it('최신 릴리스보다 높거나 모양이 틀리면 막는다 — 모두 막히는 값', () => {
    expect(minVersionProblem('room', '0.10.2', '0.10.1', '0.10.2')).toBeNull();
    expect(minVersionProblem('room', '0.9.0', '0.10.1', '0.10.2')).toBeNull();
    expect(minVersionProblem('room', '0.10.3', '0.10.1', '0.10.2')).toBe(
      '최신 릴리스(0.10.2)보다 높아요 — 모두 방에서 막혀요',
    );
    expect(minVersionProblem('room', '0.10', '0.10.1', '0.10.2')).toContain('숫자 세 자리');
    expect(minVersionProblem('room', '0.10.1', '0.10.1', '0.10.2')).toBe('지금 값과 같아요');
    expect(minVersionProblem('room', '0.10.2', null, null)).toContain('확인하지 못했어요');
  });

  it('앱 최소 버전도 같은 제약 — 최신 릴리스까지만, 값이 없으면(제한 없음) 처음 저장 가능', () => {
    expect(minVersionProblem('app', '0.10.3', null, '0.10.3')).toBeNull();
    expect(minVersionProblem('app', '0.10.4', null, '0.10.3')).toBe(
      '최신 릴리스(0.10.3)보다 높아요 — 모두 앱을 못 써요',
    );
    expect(minVersionProblem('app', '0.10.3', '0.10.3', '0.10.3')).toBe('지금 값과 같아요');
    expect(minVersionProblem('app', 'abc', null, '0.10.3')).toContain('숫자 세 자리');
    expect(minVersionProblem('app', '0.10.3', null, null)).toContain('확인하지 못했어요');
  });

  it('값과 기록을 한 묶음으로 — 방 입장', async () => {
    const { db, writes } = fakeDb();
    await saveMinVersion(db, 'room', ' 0.10.2 ', '0.10.1');
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

  it('값과 기록을 한 묶음으로 — 앱, 방 값은 건드리지 않는다', async () => {
    const { db, writes } = fakeDb();
    await saveMinVersion(db, 'app', '0.10.3', null);
    expect(writes.find((w) => w[1] === 'config/minAppVer')).toEqual(['commit', 'config/minAppVer', '0.10.3']);
    expect(writes.some((w) => w[1] === 'config/minRoomVer')).toBe(false);
    const log = writes.find((w) => w[1].startsWith('adminLog/'));
    expect(log?.[2]).toMatchObject({
      action: 'settings.minAppVer',
      target: '0.10.3',
      detail: '없음 → 0.10.3',
    });
  });

  it('작업 기록 이름 · 규칙 길이 상한이 맞다', () => {
    expect(AUDIT_ACTIONS).toContain('settings.minAppVer');
    expect(ACTION_LABEL['settings.minAppVer']).toBe('앱 최소 버전');
    const config = JSON.parse(rulesText).rules.config;
    for (const key of ['minRoomVer', 'minAppVer']) {
      expect(config[key]['.write']).toContain("root.child('admins').child(auth.uid).val() === true");
      expect(config[key]['.validate']).toBe(
        `newData.isString() && newData.val().length <= ${MIN_VERSION_MAX}`,
      );
    }
  });
});
