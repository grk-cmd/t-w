import { describe, expect, it } from 'vitest';
import { BUG_DAILY_MAX_DEFAULT, BUG_DAILY_MAX_MAX, BUG_DAILY_MAX_MIN } from '@/entities/bug-board';
import { intGroupChanges } from '@/entities/server/ops-config';
import { createFirebaseOpsConfigPort } from '@/entities/server/ops-config/api/firebase';
import { createServerOpsConfigPort } from '@/entities/server/ops-config/api/server';
import { bugDailyMaxConfirmText, checkBugDailyMax } from '@/features/settings/set-bug-daily-max';
import { fakeApiOf } from '../shared/fakeApi';
import { fakeDb } from '../shared/fakeDb';

const RANGE = { min: BUG_DAILY_MAX_MIN, max: BUG_DAILY_MAX_MAX, def: BUG_DAILY_MAX_DEFAULT };

describe('버그 제보 하루 상한 카드 — 판이 통로를 고른다', () => {
  it('API 판은 서버 키 bug.dailyMax 묶음이 있고 범위 · 기본값이 Firebase 판(규칙)과 같다', () => {
    const group = createServerOpsConfigPort(fakeApiOf({}).api).groups.bugDailyMax;
    expect(group?.path).toBe('bug.dailyMax');
    const [field] = group!.fields;
    expect({ min: field.min, max: field.max, def: field.def }).toEqual(RANGE);
  });

  it('Firebase 판 포트에는 묶음이 없다 — 카드가 config/bugDailyMax 로 간다', () => {
    expect(createFirebaseOpsConfigPort(fakeDb({}).db).groups.bugDailyMax).toBeNull();
  });

  it('API 판 저장 묶음 — 칸 value 하나를 `bug.dailyMax/value` 로(서버 포트가 키 하나 PUT 으로 바꾼다)', () => {
    const group = createServerOpsConfigPort(fakeApiOf({}).api).groups.bugDailyMax!;
    expect(intGroupChanges(group, { value: 5 }, { value: 8 })).toEqual({ 'bug.dailyMax/value': 8 });
  });

  it('입력 검사 — 범위 안 정수만 · 지금 값과 같으면 거절', () => {
    expect(checkBugDailyMax(RANGE, ' 7 ', 5)).toEqual({ ok: true, max: 7 });
    expect(checkBugDailyMax(RANGE, '100', null)).toEqual({ ok: true, max: 100 });
    for (const bad of ['0', '101', '2.5', '-1', 'x', ''])
      expect(checkBugDailyMax(RANGE, bad, 5)).toEqual({ ok: false, error: '1~100 사이 숫자' });
    expect(checkBugDailyMax(RANGE, '5', 5)).toEqual({ ok: false, error: '지금 값과 같음' });
    expect(checkBugDailyMax(RANGE, '5', null)).toEqual({ ok: true, max: 5 });
  });

  it('확인 창 글', () => {
    expect(bugDailyMaxConfirmText(5, 8, '다음 제보부터')).toBe(
      '버그 제보 하루 상한 5건 → 8건 — 다음 제보부터',
    );
  });
});
