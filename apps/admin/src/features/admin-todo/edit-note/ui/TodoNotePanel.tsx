import { useState, type FormEvent } from 'react';
import { adminNameOf, useAdminNames } from '@/entities/admin/name';
import { checkTodoNote, TODO_NOTE_MAX, useTodoNote, type TodoNote } from '@/entities/admin/todo';
import { useDb } from '@/shared/api';
import { errorMessage, formatDate } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { noteConflictMessage } from '../model/saveNote';
import { useSaveTodoNote } from '../model/useSaveNote';
import styles from './TodoNotePanel.module.css';

function Editor({ note, onDone }: { note: TodoNote | null; onDone: () => void }) {
  const toast = useToast();
  const me = useDb().uid();
  const names = useAdminNames().data ?? new Map<string, string>();
  const save = useSaveTodoNote();
  const [seen, setSeen] = useState(note);
  const [text, setText] = useState(note?.text ?? '');
  const [error, setError] = useState<string | null>(null);
  // 충돌로 최신 내용을 다시 채울 때 내가 쓰던 글 — 잃지 않게 보여 준다.
  const [mine, setMine] = useState<string | null>(null);
  const bad = checkTodoNote(text);
  const unchanged = text.trimEnd() === (seen?.text ?? '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate(
      { seen, text },
      {
        onSuccess: (r) => {
          if (r.ok) {
            toast('메모 저장');
            onDone();
            return;
          }
          if (!('conflict' in r)) return setError(r.reason);
          setError(noteConflictMessage(r.latest, names, me));
          setMine(text);
          setSeen(r.latest);
          setText(r.latest?.text ?? '');
        },
        onError: (err) => setError(errorMessage(err, '메모 저장 실패')),
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <textarea
        rows={5}
        aria-label="할 일 공용 메모"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <small className={`soft ${styles.count}`}>
        {text.trimEnd().length} / {TODO_NOTE_MAX}
      </small>
      {(error ?? bad) && <p className="msg err">{error ?? bad}</p>}
      {mine !== null && (
        <details className={styles.mine}>
          <summary>내가 쓰던 내용 보기</summary>
          <textarea readOnly rows={4} aria-label="내가 쓰던 메모" value={mine} />
        </details>
      )}
      <div className={styles.foot}>
        <button type="button" className="btn" onClick={onDone} disabled={save.isPending}>
          취소
        </button>
        <button type="submit" className="btn primary" disabled={save.isPending || !!bad || unchanged}>
          {save.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}

/** 📝 공용 메모 — 관리자끼리 같이 보는 자유 메모(adminTodoNote). 평소엔 읽기, 누르거나 [편집] 이면 고치기. */
export function TodoNotePanel() {
  const note = useTodoNote();
  const me = useDb().uid();
  const names = useAdminNames().data ?? new Map<string, string>();
  const [editing, setEditing] = useState(false);
  const data = note.data ?? null;
  const who = data?.updatedBy ? (data.updatedBy === me ? '나' : adminNameOf(data.updatedBy, names)) : '';

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <b>📝 공용 메모</b>
        {data && data.updatedAt > 0 && (
          <small className="soft">
            {who} · {formatDate(data.updatedAt)}
          </small>
        )}
        {!editing && note.isSuccess && (
          <button type="button" className={`btn ${styles.edit}`} onClick={() => setEditing(true)}>
            편집
          </button>
        )}
      </div>
      {note.error && <p className="msg err">{errorMessage(note.error, '메모 불러오기 실패')}</p>}
      {note.isLoading && <p className="soft">불러오는 중…</p>}
      {note.isSuccess &&
        (editing ? (
          <Editor note={data} onDone={() => setEditing(false)} />
        ) : (
          <button
            type="button"
            className={styles.view}
            onClick={() => setEditing(true)}
            title="눌러서 고치기"
          >
            {data?.text ? data.text : <span className="soft">관리자끼리 같이 보는 메모 — 눌러서 쓰기</span>}
          </button>
        ))}
    </div>
  );
}
