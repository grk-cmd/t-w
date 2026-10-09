import { describe, expect, it } from 'vitest';
import { ACTION_LABEL } from '@/entities/admin-log';
import { parseRoomServerConfig, setDefaultRouting } from '@/entities/room-server';
import {
  checkDefault,
  defaultConfirmText,
  defaultOptions,
  NO_DEFAULT,
  parsePercentInput,
  PERCENT_STEPS,
  toDefaultInputs,
} from '@/features/room-server/edit-default';
import { auditsOf, fakeDb } from '../shared/fakeDb';

describe('기본 서버 · 비율 카드', () => {
  it('드롭다운 — «없음» + 등록된 서버(정렬) · 표에 없는 지금 값도 남긴다', () => {
    expect(defaultOptions(['realtime-2', 'realtime-1'], null)).toEqual([
      { value: NO_DEFAULT, label: '없음 (모두 Firebase)' },
      { value: 'realtime-1', label: 'realtime-1' },
      { value: 'realtime-2', label: 'realtime-2' },
    ]);
    expect(defaultOptions(['realtime-1'], 'rooms-9').at(-1)).toEqual({
      value: 'rooms-9',
      label: 'rooms-9 (표에 없음 — Firebase)',
    });
  });

  it('빠른 버튼 0 · 10 · 50 · 100', () => {
    expect([...PERCENT_STEPS]).toEqual([0, 10, 50, 100]);
  });

  it('입력 칸 처음 값 — 칸이 없으면 «없음» · 0', () => {
    expect(toDefaultInputs(parseRoomServerConfig({}))).toEqual({ server: NO_DEFAULT, percent: '0' });
    expect(toDefaultInputs(parseRoomServerConfig({ default: 'realtime-1', defaultPercent: 10 }))).toEqual({
      server: 'realtime-1',
      percent: '10',
    });
  });

  it('비율 글자 — 정수 0~100 만', () => {
    expect(parsePercentInput(' 0 ')).toBe(0);
    expect(parsePercentInput('100')).toBe(100);
    for (const bad of ['101', '-1', '2.5', '', 'abc', '1e1']) expect(parsePercentInput(bad)).toBeNull();
  });

  it('입력 검사 — 범위 밖 · 같은 값은 저장하지 않는다 · «없음» 은 비율을 안 본다', () => {
    const empty = parseRoomServerConfig({});
    expect(checkDefault(empty, { server: 'realtime-1', percent: '150' })).toEqual({
      ok: false,
      error: '비율 — 0~100 사이 정수',
    });
    expect(checkDefault(empty, { server: NO_DEFAULT, percent: 'x' })).toEqual({
      ok: false,
      error: '지금 값과 같음',
    });
    expect(checkDefault(empty, { server: 'realtime-1', percent: '10' })).toEqual({
      ok: true,
      next: { server: 'realtime-1', percent: 10 },
    });
    const set = parseRoomServerConfig({ default: 'realtime-1', defaultPercent: 10 });
    expect(checkDefault(set, { server: 'realtime-1', percent: '10' })).toEqual({
      ok: false,
      error: '지금 값과 같음',
    });
    expect(checkDefault(set, { server: 'realtime-1', percent: '50' })).toEqual({
      ok: true,
      next: { server: 'realtime-1', percent: 50 },
    });
    expect(checkDefault(set, { server: NO_DEFAULT, percent: '50' })).toEqual({
      ok: true,
      next: { server: null, percent: 0 },
    });
  });

  it('확인 창 글 — 지금 → 새 값 · 꺼져 있으면 그 사실도', () => {
    const off = parseRoomServerConfig({});
    expect(defaultConfirmText(off, { server: 'realtime-1', percent: 10 })).toBe(
      '기본 서버 바꾸기 — 없음 → realtime-1 10%. 허용 목록에 없는 사람 중 약 10% 가 다음에 만드는 방부터 realtime-1 에 열려요. (지금 스위치가 꺼져 있어 켜기 전까지는 모두 Firebase)',
    );
    const on = parseRoomServerConfig({ on: true, default: 'realtime-1', defaultPercent: 50 });
    expect(defaultConfirmText(on, { server: null, percent: 0 })).toBe(
      '기본 서버 바꾸기 — realtime-1 50% → 없음. 허용 목록에 없는 사람은 다음에 만드는 방부터 모두 Firebase 에 열려요.',
    );
  });

  it('두 칸을 기록과 한 묶음으로 · «없음» 이면 두 칸 다 지운다', async () => {
    const { db, writes } = fakeDb();
    await setDefaultRouting(db, parseRoomServerConfig({}), { server: 'realtime-1', percent: 10 });
    const set = parseRoomServerConfig({ default: 'realtime-1', defaultPercent: 10 });
    await setDefaultRouting(db, set, { server: null, percent: 0 });
    expect(writes.filter((w) => !w[1].startsWith('adminLog/'))).toEqual([
      ['commit', 'config/roomServer/default', 'realtime-1'],
      ['commit', 'config/roomServer/defaultPercent', 10],
      ['commit', 'config/roomServer/default', null],
      ['commit', 'config/roomServer/defaultPercent', null],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['roomServer.default', 'default', '없음 → realtime-1 10%'],
      ['roomServer.default', 'default', 'realtime-1 10% → 없음'],
    ]);
    expect(ACTION_LABEL['roomServer.default']).toBe('방 서버 기본 · 비율');
  });
});
