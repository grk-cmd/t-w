import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, LOG_GROUPS } from '@/entities/admin-log';
import { getUserLicense } from '@/entities/user';
import { resolveUserCode } from '@/features/room-server/manage-allow';
import { fakeDb } from '../shared/fakeDb';

describe('시범 이용자 — 코드 찾기', () => {
  it('사용자 코드는 그대로, 친구 코드 · 뒤 4자리는 friendCodes 로', async () => {
    const { db } = fakeDb({ 'friendCodes/COZY-AB12': { userId: 'u9abc2345' } });
    expect(await resolveUserCode(db, ' u1abc2345 ')).toEqual({ userCode: 'u1abc2345', friendCode: null });
    expect(await resolveUserCode(db, 'cozy-ab12')).toEqual({
      userCode: 'u9abc2345',
      friendCode: 'COZY-AB12',
    });
    expect(await resolveUserCode(db, 'AB12')).toEqual({ userCode: 'u9abc2345', friendCode: 'COZY-AB12' });
    expect(await resolveUserCode(db, 'ZZ99')).toBeNull();
    expect(await resolveUserCode(db, '')).toBeNull();
  });

  it('작업 기록 — «방 서버» 묶음 · 이름', () => {
    expect(LOG_GROUPS.some((g) => g.id === 'roomServer' && g.label === '방 서버')).toBe(true);
    expect(ACTION_LABEL['roomServer.allow']).toBe('방 서버 시범 이용자');
  });

  it('라이선스 표시 — 계정 요약의 키 한 칸 + 그 키 한 건만 읽는다', async () => {
    const { db } = fakeDb({
      'accountSnap/u1abc2345/license': ' abcd-efgh ',
      'licenses/ABCD-EFGH': { valid: true, redeemedAt: 1 },
      'accountSnap/u2abc2345/license': 'GONE-KEY',
      'accountSnap/u3abc2345/license': 'OFF0-KEY0',
      'licenses/OFF0-KEY0': { valid: false },
    });
    expect(await getUserLicense(db, 'u1abc2345')).toBe('used');
    expect(await getUserLicense(db, 'u2abc2345')).toBe('unknown');
    expect(await getUserLicense(db, 'u3abc2345')).toBe('revoked');
    expect(await getUserLicense(db, 'u4abc2345')).toBe('none');
  });
});
