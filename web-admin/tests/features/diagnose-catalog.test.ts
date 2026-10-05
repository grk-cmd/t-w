import { describe, expect, it } from 'vitest';
import { analyzeKind, base64CleanupWrite, planBase64Cleanup } from '@/entities/catalog';
import { cleanBase64 } from '@/features/catalog/diagnose-catalog';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const BIG = 'A'.repeat(3000);
const THUMB = 'data:image/png;base64,' + 'B'.repeat(2100);

describe('카탈로그 용량 진단', () => {
  it('앱 analyzeCatalog 와 같게 항목 크기 · 2000자 넘는 필드 · data: base64 필드를 센다', () => {
    const r = analyzeKind({
      small: { name: '작은', icon: '🎩' },
      heavy: { name: '무거운', glb: BIG, thumbnail: THUMB },
    });
    expect(r.count).toBe(2);
    expect(r.base64Fields).toBe(1);
    expect(r.top[0].id).toBe('heavy');
    expect(r.top[0].heavy).toEqual(['glb(3KB)', 'thumbnail(2KB, base64)']);
    expect(r.top[1].heavy).toEqual([]);
  });

  it('정리 대상은 glb 와 glbUrl 이 둘 다 있는 항목뿐 — glbUrl 이 없으면 건너뛴다', () => {
    const plan = planBase64Cleanup({
      parts: { a: { glb: 'AAAA', glbUrl: 'https://x' }, b: { glb: 'BB' }, c: { glbUrl: 'https://x' } },
      desks: { d: { glb: 'DDD', glbUrl: 'https://y' } },
    });
    expect(plan.targets).toEqual([
      { kind: 'parts', id: 'a', bytes: 4 },
      { kind: 'desks', id: 'd', bytes: 3 },
    ]);
    expect(plan.skipped).toEqual([{ kind: 'parts', id: 'b', bytes: 2 }]);
    expect(plan.alreadyClean).toBe(1);
    expect(plan.bytes).toBe(7);
    expect(base64CleanupWrite(plan.targets)).toEqual({
      'catalog/parts/a/glb': null,
      'catalog/desks/d/glb': null,
    });
  });
});

describe('base64 정리', () => {
  it('지우기 직전 glbUrl 을 다시 읽어 아직 있는 항목의 glb 만 한 묶음으로 지운다', async () => {
    const { db, writes } = fakeDb({
      'catalog/parts/a/glbUrl': 'https://x',
      'catalog/items/i/glbUrl': '',
    });
    const r = await cleanBase64(db, [
      { kind: 'parts', id: 'a', bytes: 4 },
      { kind: 'items', id: 'i', bytes: 2 },
      { kind: 'desks', id: 'gone', bytes: 1 },
    ]);
    expect(withoutAudits(writes)).toEqual([['commit', 'catalog/parts/a/glb', null]]);
    expect(r.cleaned.map((t) => t.id)).toEqual(['a']);
    expect(r.skipped.map((t) => t.id)).toEqual(['i', 'gone']);
  });

  it('묶음이 거절되면 아무것도 지워지지 않는다', async () => {
    const { db, writes } = fakeDb(
      { 'catalog/parts/a/glbUrl': 'https://x', 'catalog/parts/b/glbUrl': 'https://x' },
      (p) => p === 'catalog/parts/b/glb',
    );
    await expect(
      cleanBase64(db, [
        { kind: 'parts', id: 'a', bytes: 1 },
        { kind: 'parts', id: 'b', bytes: 1 },
      ]),
    ).rejects.toThrow();
    expect(withoutAudits(writes)).toEqual([]);
  });
});
