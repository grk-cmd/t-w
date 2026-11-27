import { describe, expect, it } from 'vitest';
import { checkTodoNote, TODO_NOTE_MAX, todoNoteValue, toTodoNote } from '@/entities/admin/todo';
import { noteChange, noteConflictMessage, saveTodoNote } from '@/features/admin-todo/edit-note';
import type { Db } from '@/shared/api';
import { ADMIN_UID, auditsOf, fakeDb, NOW, withoutAudits } from '../shared/fakeDb';

const PATH = 'adminTodoNote';
const names = new Map([['other', '다른이']]);
const stored = (extra: Record<string, unknown> = {}) => ({
  text: '이번 주는 0.11.3',
  rev: 4,
  updatedBy: 'other',
  updatedAt: 10,
  ...extra,
});

/** 규칙처럼 구는 commit — adminTodoNote 는 «지금 rev + 1»(처음이면 0)만. beforeCommit 으로 남의 쓰기를 끼워 넣는다. */
function rulesDb(data: Record<string, unknown>, beforeCommit?: () => void) {
  const fake = fakeDb(data);
  const db: Db = {
    ...fake.db,
    commit: async (updates) => {
      beforeCommit?.();
      const value = updates[PATH] as { rev?: number } | undefined;
      if (value) {
        const cur = data[PATH] as { rev?: number } | undefined;
        if (value.rev !== (cur ? (cur.rev ?? 0) + 1 : 0))
          throw Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' });
      }
      await fake.db.commit(updates);
      for (const [p, v] of Object.entries(updates)) data[p] = v;
    },
  };
  return { db, writes: fake.writes };
}

describe('할 일 공용 메모 — 모양', () => {
  it('읽기 — 글자 · rev 가 있어야, 없으면 null', () => {
    expect(toTodoNote(null)).toBeNull();
    expect(toTodoNote({ text: 'x' })).toBeNull();
    expect(toTodoNote({ rev: 1 })).toBeNull();
    expect(toTodoNote(stored())).toEqual(stored());
    expect(toTodoNote({ text: '', rev: 0 })).toEqual({ text: '', rev: 0, updatedBy: '', updatedAt: 0 });
  });

  it('길이 — 2000자까지(끝 공백은 안 셈) · 빈 메모도 된다', () => {
    expect(checkTodoNote('')).toBeNull();
    expect(checkTodoNote('x'.repeat(TODO_NOTE_MAX) + '   \n')).toBeNull();
    expect(checkTodoNote('x'.repeat(TODO_NOTE_MAX + 1))).toMatch(/2000자까지/);
  });

  it('저장 값 — 처음 rev 0 · 고치면 rev + 1 · 끝 공백만 정리', () => {
    expect(todoNoteValue('  들여쓰기\n둘째 줄 \n\n', null, 'a1', NOW)).toEqual({
      text: '  들여쓰기\n둘째 줄',
      rev: 0,
      updatedBy: 'a1',
      updatedAt: NOW,
    });
    expect(todoNoteValue('x', { rev: 4 }, 'a1', NOW).rev).toBe(5);
  });

  it('작업 기록 — 본문 대신 길이만', () => {
    expect(noteChange(null, 'abc')).toBe('처음 작성 · 3자');
    expect(noteChange(toTodoNote(stored()), 'ab  ')).toBe('12자 → 2자');
  });
});

describe('할 일 공용 메모 — 저장', () => {
  it('처음 쓰기 — 메모 · 작업 기록(todo.note)을 한 묶음으로', async () => {
    const { db, writes } = rulesDb({});
    expect(await saveTodoNote(db, null, '첫 메모')).toEqual({ ok: true });
    expect(withoutAudits(writes)).toEqual([
      ['commit', PATH, { text: '첫 메모', rev: 0, updatedBy: ADMIN_UID, updatedAt: NOW }],
    ]);
    expect(auditsOf(writes).map((a) => [a.action, a.target, a.detail])).toEqual([
      ['todo.note', '할 일 공용 메모', '처음 작성 · 4자'],
    ]);
  });

  it('고치기 — 본 rev + 1', async () => {
    const { db, writes } = rulesDb({ [PATH]: stored() });
    expect(await saveTodoNote(db, toTodoNote(stored()), '')).toEqual({ ok: true });
    expect(withoutAudits(writes)[0][2]).toMatchObject({ text: '', rev: 5 });
  });

  it('★ 본 뒤 남이 먼저 고쳤으면 쓰지 않고 최신 값을 돌려준다', async () => {
    const data: Record<string, unknown> = { [PATH]: stored({ rev: 5, text: '남이 고침' }) };
    const { db, writes } = rulesDb(data);
    const r = await saveTodoNote(db, toTodoNote(stored()), '내 글');
    expect(r).toEqual({ ok: false, conflict: true, latest: toTodoNote(data[PATH]) });
    expect(writes).toEqual([]);
  });

  it('★ 읽은 뒤 · 쓰기 전에 남이 끼면 규칙이 거절 → 충돌로', async () => {
    const data: Record<string, unknown> = { [PATH]: stored() };
    const { db, writes } = rulesDb(data, () => {
      data[PATH] = stored({ rev: 5, text: '끼어듦' });
    });
    const r = await saveTodoNote(db, toTodoNote(stored()), '내 글');
    expect(r).toMatchObject({ ok: false, conflict: true, latest: { rev: 5, text: '끼어듦' } });
    expect(writes).toEqual([]);
  });

  it('너무 길면 쓰지 않는다', async () => {
    const { db, writes } = rulesDb({});
    expect(await saveTodoNote(db, null, 'x'.repeat(TODO_NOTE_MAX + 1))).toMatchObject({ ok: false });
    expect(writes).toEqual([]);
  });

  it('충돌 안내 — 누가 고쳤는지', () => {
    expect(noteConflictMessage(toTodoNote(stored()), names, ADMIN_UID)).toBe(
      '방금 다른이님이 메모를 고쳤어요 — 최신 내용으로 다시 불러왔어요',
    );
    expect(noteConflictMessage(toTodoNote(stored({ updatedBy: ADMIN_UID })), names, ADMIN_UID)).toMatch(
      /다른 창에서 내가/,
    );
  });
});
