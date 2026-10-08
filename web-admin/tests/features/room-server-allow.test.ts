import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, LOG_GROUPS } from '@/entities/admin-log';
import { parseRoomServerConfig } from '@/entities/room-server';
import { getUserLicense } from '@/entities/user';
import { checkLimits, limitsConfirmText } from '@/features/room-server/edit-limits';
import {
  allowChange,
  allowConfirmText,
  FIREBASE_OPTION,
  serverOptions,
} from '@/features/room-server/manage-allow';
import { fakeDb } from '../shared/fakeDb';

describe('사용자별 서버 드롭다운', () => {
  it('«Firebase(기본)» + 등록된 서버 이름(정렬)', () => {
    expect(serverOptions(['realtime-2', 'realtime-1'], null)).toEqual([
      { value: FIREBASE_OPTION, label: 'Firebase(기본)' },
      { value: 'realtime-1', label: 'realtime-1' },
      { value: 'realtime-2', label: 'realtime-2' },
    ]);
  });

  it('지금 값이 표에 없는 서버면 그 이름도 남긴다(앱은 Firebase 로 보냄)', () => {
    expect(serverOptions(['realtime-1'], 'rooms-1').at(-1)).toEqual({
      value: 'rooms-1',
      label: 'rooms-1 (표에 없음 — Firebase)',
    });
    expect(serverOptions(['realtime-1'], 'realtime-1')).toHaveLength(2);
  });

  it('고른 값 → 할 일: 서버 = 쓰기 · Firebase(기본) = 지우기 · 같으면 없음', () => {
    expect(allowChange(null, 'realtime-1')).toEqual({ kind: 'set', server: 'realtime-1' });
    expect(allowChange('realtime-1', 'realtime-2')).toEqual({ kind: 'set', server: 'realtime-2' });
    expect(allowChange('realtime-1', FIREBASE_OPTION)).toEqual({ kind: 'remove' });
    expect(allowChange(null, FIREBASE_OPTION)).toEqual({ kind: 'none' });
    expect(allowChange('realtime-1', 'realtime-1')).toEqual({ kind: 'none' });
  });

  it('확인 창 글', () => {
    expect(allowConfirmText('하나(COZY-AB12)', null, { kind: 'set', server: 'realtime-1' })).toBe(
      '하나(COZY-AB12) — Firebase(기본) → realtime-1. 다음에 만드는 방부터 이 서버로',
    );
    expect(allowConfirmText('하나(COZY-AB12)', 'realtime-1', { kind: 'remove' })).toBe(
      '하나(COZY-AB12) — realtime-1 → Firebase(기본). 다음에 만드는 방부터 Firebase',
    );
  });

  it('작업 기록 — «방 서버» 묶음 · 이름', () => {
    expect(LOG_GROUPS.some((g) => g.id === 'roomServer' && g.label === '방 서버')).toBe(true);
    expect(ACTION_LABEL['roomServer.allow']).toBe('방 서버 시범 이용자');
    expect(ACTION_LABEL['roomServer.limits']).toBe('방 개수 상한');
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

describe('방 개수 상한 카드', () => {
  it('확인 창 — 두 채널 모두 «지금 → 새 값» (칸이 없으면 기본 250)', () => {
    const cfg = parseRoomServerConfig({});
    expect(limitsConfirmText(cfg, { workingroom: 400, togetherroom: 400 })).toBe(
      '방 개수 상한을 워킹룸 250 → 400 · 투게더룸 250 → 400 으로 바꿀까요? 이미 열린 방은 그대로이고 새 방부터 적용돼요.',
    );
  });

  it('입력 검사 — 범위 밖 · 같은 값은 저장하지 않는다', () => {
    const cfg = parseRoomServerConfig({ limits: { workingroom: 300, togetherroom: 250 } });
    expect(checkLimits(cfg, { workingroom: '0', togetherroom: '250' })).toEqual({
      ok: false,
      error: '워킹룸 — 1~100000 사이 정수',
    });
    expect(checkLimits(cfg, { workingroom: '300', togetherroom: '250' })).toEqual({
      ok: false,
      error: '지금 값과 같음',
    });
    expect(checkLimits(cfg, { workingroom: '300', togetherroom: '400' })).toEqual({
      ok: true,
      next: { workingroom: 300, togetherroom: 400 },
    });
    // 칸이 비어 있으면(기본값을 보여 주는 중) 같은 숫자라도 처음 저장은 된다
    expect(checkLimits(parseRoomServerConfig({}), { workingroom: '250', togetherroom: '250' }).ok).toBe(true);
  });
});
