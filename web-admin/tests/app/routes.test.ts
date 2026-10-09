import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTE_ID, ROUTE_GROUPS, ROUTES } from '@/app/routes/routes';

const ids = (g: (typeof ROUTE_GROUPS)[number]) => g.items.map((r) => r.id);

describe('좌측 메뉴 묶음', () => {
  it('묶음과 항목 순서가 정한 그대로다', () => {
    expect(ROUTE_GROUPS.map((g) => [g.label, ids(g)])).toEqual([
      ['👥 사용자 · 운영', ['users', 'license', 'reports', 'bugs', 'notices']],
      ['🏠 방 · 서버', ['rooms', 'roomServer']],
      ['🗂️ 콘텐츠', ['catalog']],
      ['📊 성능 · 비용', ['metrics', 'usage', 'improvements']],
      ['⚙️ 시스템', ['settings', 'log']],
    ]);
  });

  it('모든 화면이 정확히 한 묶음에만 들어 있다', () => {
    const all = ROUTE_GROUPS.flatMap(ids);
    expect(new Set(all).size).toBe(all.length);
    expect(ROUTES.map((r) => r.id)).toEqual(all);
    for (const r of ROUTES) expect(ROUTE_GROUPS.filter((g) => ids(g).includes(r.id))).toHaveLength(1);
  });

  it('예전 주소(#/<id>)가 그대로 열리고, 첫 화면은 라이선스다', () => {
    const before = [
      'license',
      'users',
      'reports',
      'bugs',
      'notices',
      'settings',
      'roomServer',
      'rooms',
      'catalog',
      'log',
      'metrics',
      'usage',
      'improvements',
    ];
    expect(ROUTES.map((r) => r.id).sort()).toEqual([...before].sort());
    expect(DEFAULT_ROUTE_ID).toBe('license');
  });

  it('빈 묶음이 없다', () => {
    for (const g of ROUTE_GROUPS) expect(g.items.length).toBeGreaterThan(0);
  });
});
