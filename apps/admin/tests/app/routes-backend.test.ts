import { describe, expect, it } from 'vitest';
import { routeGroupsFor } from '@/app/routes/routes';

const idsOf = (backend: 'firebase' | 'api') =>
  routeGroupsFor(backend).flatMap((g) => g.items.map((r) => r.id));

describe('판마다 다른 메뉴 표', () => {
  it('Firebase 판은 기능 스위치 · 방 서버가 있다', () => {
    expect(idsOf('firebase')).toEqual(expect.arrayContaining(['featureSwitch', 'roomServer']));
  });

  it('API 판은 기능 스위치 · 방 서버를 빼고 나머지는 그대로다', () => {
    const api = idsOf('api');
    expect(api).not.toContain('featureSwitch');
    expect(api).not.toContain('roomServer');
    expect(api).toEqual(idsOf('firebase').filter((id) => id !== 'featureSwitch' && id !== 'roomServer'));
  });

  it('API 판은 화면이 하나도 없는 묶음을 메뉴에 두지 않는다', () => {
    for (const g of routeGroupsFor('api')) expect(g.items.length).toBeGreaterThan(0);
  });
});
