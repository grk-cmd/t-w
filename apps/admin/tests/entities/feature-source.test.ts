import { describe, expect, it } from 'vitest';
import {
  effectiveSource,
  FEATURES,
  getFeatureSources,
  setFeatureSource,
  sourceConfirmText,
  sourceUpdates,
} from '@/entities/server/feature-source';
import { auditsOf, fakeDb } from '../shared/fakeDb';

describe('🎚️ 기능 스위치 — 받는 곳', () => {
  it('기능 표 — 앱 source-switch.js 와 같은 네 기능', () => {
    expect([...FEATURES]).toEqual(['friends', 'rooms', 'catalog', 'gacha']);
  });

  it('새 칸이 없으면 옛 스위치(앱 pickSource 와 같은 규칙)', () => {
    expect(effectiveSource('friends', null, undefined)).toBe('server');
    expect(effectiveSource('friends', null, false)).toBe('firebase');
    expect(effectiveSource('rooms', null, true)).toBe('server');
    expect(effectiveSource('rooms', null, null)).toBe('firebase');
    expect(effectiveSource('catalog', null, undefined)).toBe('server');
    expect(effectiveSource('gacha', null, undefined)).toBe('firebase');
    expect(effectiveSource('gacha', 'server', undefined)).toBe('server');
  });

  it('새 칸이 있으면 그쪽이 이기고, 모르는 값은 칸 없음으로', () => {
    expect(effectiveSource('friends', 'firebase', true)).toBe('firebase');
    expect(effectiveSource('rooms', 'server', false)).toBe('server');
    expect(effectiveSource('rooms', 'on', true)).toBe('server');
  });

  it('읽기 — 기능마다 새 칸 · 옛 칸 한 칸씩', async () => {
    const { db } = fakeDb({
      'config/sources/catalog': 'firebase',
      'config/flags/friendsApi': false,
      'config/roomServer/on': true,
    });
    expect(await getFeatureSources(db)).toEqual({
      friends: 'firebase',
      rooms: 'server',
      catalog: 'firebase',
      gacha: 'firebase',
    });
  });

  it('쓰기 — 새 칸과 옛 칸(옛 앱용)을 한 묶음 · 기록 한 줄', async () => {
    expect(sourceUpdates('catalog', 'server')).toEqual({ 'config/sources/catalog': 'server' });
    expect(sourceUpdates('gacha', 'server')).toEqual({ 'config/sources/gacha': 'server' });
    const { db, writes } = fakeDb();
    await setFeatureSource(db, 'friends', 'firebase');
    await setFeatureSource(db, 'rooms', 'server');
    expect(writes.filter((w) => !w[1].startsWith('adminLog/'))).toEqual([
      ['commit', 'config/sources/friends', 'firebase'],
      ['commit', 'config/flags/friendsApi', false],
      ['commit', 'config/sources/rooms', 'server'],
      ['commit', 'config/roomServer/on', true],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['settings.featureSource', 'friends', 'firebase'],
      ['settings.featureSource', 'rooms', 'server'],
    ]);
  });

  it('확인 창 글 — 무엇이 바뀌는지 · 언제 반영되는지', () => {
    expect(sourceConfirmText('rooms', 'firebase')).toContain('비상 정지');
    expect(sourceConfirmText('friends', 'server')).toContain('다시 읽을 때');
  });
});
