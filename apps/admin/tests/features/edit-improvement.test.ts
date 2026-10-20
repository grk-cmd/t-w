import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, LOG_GROUPS } from '@/entities/admin-log';
import { draftProblem, saveImprovement } from '@/entities/metrics/usage';
import { draftOf, emptyForm, formOf, hasVersion, SEED_0_10_2 } from '@/features/metrics/edit-improvement';
import { fakeDb, withoutAudits } from '../shared/fakeDb';

const T = Date.parse('2026-10-09T10:00:00+09:00');

describe('개선 기록 입력', () => {
  it('0.10.2 씨앗 — 10/5 17:44(서울) · 바뀐 것 넷 · 규칙에 맞는 모양', () => {
    expect(SEED_0_10_2.releasedAt).toBe(Date.parse('2026-10-05T08:44:00Z'));
    expect(SEED_0_10_2.items).toHaveLength(4);
    expect(draftProblem(SEED_0_10_2)).toBeNull();
  });

  it('씨앗 단추는 같은 버전이 있으면 숨긴다', () => {
    expect(hasVersion([], '0.10.2')).toBe(false);
    expect(hasVersion([{ ...SEED_0_10_2, id: 'x' }], '0.10.2')).toBe(true);
  });

  it('입력칸 → 저장값 — 한 줄에 하나 · 빈 줄 무시 · 되돌리면 같은 값', () => {
    const r = draftOf(formOf(SEED_0_10_2));
    expect(r).toEqual({ draft: SEED_0_10_2 });
    const f = { ...emptyForm(T), version: '0.10.3', title: '줄이기', items: 'a\n\n b \n' };
    expect(draftOf(f)).toEqual({
      draft: { version: '0.10.3', releasedAt: T, title: '줄이기', items: ['a', 'b'], adoptDays: 3 },
    });
  });

  it('틀린 입력은 까닭을 돌려준다', () => {
    const f = formOf(SEED_0_10_2);
    expect(draftOf({ ...f, releasedAt: '' })).toEqual({ error: '릴리스 시각 확인' });
    expect(draftOf({ ...f, adoptDays: '-1' })).toEqual({ error: '적용 기간 0~30일' });
    expect(draftOf({ ...f, adoptDays: '31' })).toEqual({ error: '적용 기간 0~30일' });
    expect(draftOf({ ...f, items: '\n' })).toEqual({ error: '바뀐 것 1개 이상' });
    expect(draftOf({ ...f, version: '' })).toEqual({ error: '버전 1~20자' });
  });

  it('씨앗을 그대로 저장하면 metrics/improvements 아래 한 칸', async () => {
    const { db, writes } = fakeDb();
    await saveImprovement(db, SEED_0_10_2, undefined, () => 'seed');
    expect(withoutAudits(writes)).toEqual([['commit', 'metrics/improvements/seed', SEED_0_10_2]]);
  });

  it('작업 기록 이름 · 묶음', () => {
    expect(ACTION_LABEL['improvements.add']).toBe('개선 기록 추가');
    expect(ACTION_LABEL['improvements.edit']).toBe('개선 기록 수정');
    expect(ACTION_LABEL['improvements.delete']).toBe('개선 기록 삭제');
    expect(LOG_GROUPS.map((g) => g.id)).toContain('improvements');
  });
});
