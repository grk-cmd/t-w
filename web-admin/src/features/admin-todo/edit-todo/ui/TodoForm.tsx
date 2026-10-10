import { useState, type FormEvent } from 'react';
import { adminNameOf, adminOptions, useAdminNames } from '@/entities/admin/name';
import {
  becomesDone,
  draftOf,
  emptyDraft,
  nextRelease,
  TODO_MEMO_MAX,
  TODO_RELEASE_MAX,
  TODO_STATUS,
  TODO_STATUSES,
  TODO_TITLE_MAX,
  TODO_TYPE,
  TODO_TYPE_NONE,
  TODO_TYPES,
  todoId,
  type Todo,
  type TodoDraft,
  type TodoStatus,
  type TodoType,
} from '@/entities/admin/todo';
import { useReleaseDownloads } from '@/entities/release';
import { useDb } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { resultMessage } from '../model/saveTodo';
import { useSaveTodo } from '../model/useSaveTodo';
import styles from './TodoForm.module.css';

interface Props {
  /** 고칠 할 일 — 없으면 새로 만든다. */
  todo?: Todo;
  /** 새로 만들 때 처음 채울 값(제보에서 만들 때 제보 연결 · 제목). */
  initial?: TodoDraft;
  onDone: (id?: string) => void;
}

/** 만들기 · 고치기. 남이 먼저 고쳤으면 쓰지 않고 최신 값으로 다시 채운다. */
export function TodoForm({ todo, initial, onDone }: Props) {
  const toast = useToast();
  const me = useDb().uid();
  const names = useAdminNames().data ?? new Map<string, string>();
  const save = useSaveTodo();
  // 새로 만들 때 id 를 미리 정해 둔다 — 충돌 뒤 다시 저장해도 같은 자리.
  const [id] = useState(() => todo?.id ?? todoId());
  const [seen, setSeen] = useState<Todo | null>(todo ?? null);
  const [draft, setDraft] = useState<TodoDraft>(() => (todo ? draftOf(todo) : (initial ?? emptyDraft())));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TodoDraft>(k: K, v: TodoDraft[K]) => setDraft({ ...draft, [k]: v });
  // 다음 버전 제안 — 최신 공개 릴리스의 다음 patch. 조회 실패 · 아직이면 ''.
  const suggest = nextRelease(useReleaseDownloads().data?.[0]?.version);
  // 완료로 바꿀 때 버전이 비어 있으면 제안값을 채워 둔다(고쳐 쓸 수 있다).
  const setStatus = (status: TodoStatus) =>
    setDraft({
      ...draft,
      status,
      release: status === 'done' && !draft.release.trim() && suggest ? suggest : draft.release,
    });

  const options = adminOptions(names);
  // 이름표에 없는 작업자(이름을 아직 안 남긴 관리자)도 고를 수 있게 남겨 둔다.
  if (draft.assignee && !names.has(draft.assignee))
    options.push({
      uid: draft.assignee,
      name:
        seen?.assignee === draft.assignee && seen.assigneeName
          ? seen.assigneeName
          : adminNameOf(draft.assignee, names),
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const markFixed =
      becomesDone(seen, draft) &&
      draft.reports.length > 0 &&
      confirm(
        `연결된 제보 ${draft.reports.length}건을 «수정 완료» 로 바꿀까요?\n(취소하면 할 일만 완료 — 이미 해결된 제보는 그대로)`,
      );
    setError(null);
    save.mutate(
      { id, seen, draft, names, markFixed },
      {
        onSuccess: (r) => {
          if (r.ok) {
            toast((seen ? '할 일 저장' : '할 일 추가') + (r.fixed ? ` · 제보 ${r.fixed}건 수정 완료` : ''));
            onDone(r.id);
            return;
          }
          setError(resultMessage(r, names, me));
          if (!('conflict' in r)) return;
          if (!r.latest) {
            toast(resultMessage(r, names, me));
            onDone();
            return;
          }
          setSeen(r.latest);
          setDraft(draftOf(r.latest));
        },
        onError: (err) => setError(errorMessage(err, '저장 실패')),
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        제목
        <input
          type="text"
          maxLength={TODO_TITLE_MAX}
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          autoFocus
        />
      </label>
      <div className={styles.row}>
        <label>
          상태
          <select value={draft.status} onChange={(e) => setStatus(e.target.value as TodoStatus)}>
            {TODO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TODO_STATUS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          종류
          <select
            value={draft.type ?? ''}
            onChange={(e) => set('type', (e.target.value || null) as TodoType | null)}
          >
            <option value="">{TODO_TYPE_NONE}</option>
            {TODO_TYPES.map((t) => (
              <option key={t} value={t}>
                {TODO_TYPE[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          작업자
          <select value={draft.assignee ?? ''} onChange={(e) => set('assignee', e.target.value || null)}>
            <option value="">없음</option>
            {options.map((o) => (
              <option key={o.uid} value={o.uid}>
                {o.uid === me ? `${o.name} (나)` : o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          릴리스 버전 — 선택
          <input
            type="text"
            inputMode="decimal"
            maxLength={TODO_RELEASE_MAX}
            placeholder={`예: ${suggest || '0.11.3'}`}
            value={draft.release}
            onChange={(e) => set('release', e.target.value)}
          />
        </label>
      </div>
      <label>
        메모 — 선택 · {TODO_MEMO_MAX}자까지
        <textarea
          rows={3}
          maxLength={TODO_MEMO_MAX}
          value={draft.memo}
          onChange={(e) => set('memo', e.target.value)}
        />
      </label>
      {draft.reports.length > 0 && (
        <div className={styles.reports}>
          <span className="soft">연결된 제보 {draft.reports.length}</span>
          {draft.reports.map((rid) => (
            <span key={rid} className={styles.report}>
              <span className="key">{rid}</span>
              <button
                type="button"
                className={styles.x}
                aria-label="연결 끊기"
                title="연결 끊기"
                onClick={() =>
                  set(
                    'reports',
                    draft.reports.filter((r) => r !== rid),
                  )
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="msg err">{error}</p>}
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={() => onDone()} disabled={save.isPending}>
          취소
        </button>
        <button type="submit" className="btn primary" disabled={save.isPending}>
          {save.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}
