import { describe, expect, it } from 'vitest';
import { checkMinRoomVer, getMinRoomVer, verLt } from '@/entities/min-room-ver';
import { fakeDb } from '../shared/fakeDb';

describe('방 입장 최소 버전', () => {
  it('비교는 앱 _verLt 와 같다 — 마디별 숫자 비교, 빠진 마디는 0', () => {
    expect(verLt('0.9.9', '0.10.0')).toBe(true);
    expect(verLt('0.10.0', '0.9.9')).toBe(false);
    expect(verLt('1.2.3', '1.2.3')).toBe(false);
    expect(verLt('1.2', '1.2.0')).toBe(false);
    expect(verLt('1.2', '1.2.1')).toBe(true);
    // 앱처럼 -beta 꼬리는 parseInt 로 잘려 같은 버전으로 본다
    expect(verLt('0.10.2-beta.1', '0.10.2')).toBe(false);
    // 넷째 마디는 보지 않는다
    expect(verLt('1.2.3.1', '1.2.3.9')).toBe(false);
  });

  it('형식: 숫자 세 마디, 20자 이하', () => {
    expect(checkMinRoomVer('0.10.2', null)).toEqual({ ok: true, change: 'first' });
    expect(checkMinRoomVer('0.10', null).ok).toBe(false);
    expect(checkMinRoomVer('v0.10.2', null).ok).toBe(false);
    expect(checkMinRoomVer('0.10.2-beta.1', null).ok).toBe(false);
    expect(checkMinRoomVer(' 0.10.2', null).ok).toBe(false);
    expect(checkMinRoomVer('1.2.3456789012345678', null).ok).toBe(true); // 딱 20자
    expect(checkMinRoomVer('1.2.34567890123456789', null).ok).toBe(false);
  });

  it('지금 값과 비교해 올림 · 내림 · 같음을 가린다', () => {
    expect(checkMinRoomVer('0.10.2', '0.9.9')).toEqual({ ok: true, change: 'raise' });
    expect(checkMinRoomVer('0.9.9', '0.10.2')).toEqual({ ok: true, change: 'lower' });
    expect(checkMinRoomVer('0.10.2', '0.10.2').ok).toBe(false);
    expect(checkMinRoomVer('0.10.2', '0.10.2-beta').ok).toBe(false);
  });

  it('읽은 값은 문자열로 맞춘다', async () => {
    expect(await getMinRoomVer(fakeDb().db)).toBeNull();
    expect(await getMinRoomVer(fakeDb({ 'config/minRoomVer': '0.10.2' }).db)).toBe('0.10.2');
  });
});
