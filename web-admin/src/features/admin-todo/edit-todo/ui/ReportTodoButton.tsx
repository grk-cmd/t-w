import { useState } from 'react';
import { emptyDraft, sortTodos, TODO_TITLE_MAX, useTodos } from '@/entities/admin/todo';
import { bugNoLabel, useBugNo, type BugItem } from '@/entities/bug-board';
import { TodoForm } from './TodoForm';
import styles from './ReportTodoButton.module.css';

/**
 * 제보 상세 머리줄의 버튼 — 걸린 할 일이 있으면 «📋 할 일 보기»(그 할 일로), 없으면 «📋 할 일에 등록».
 * 등록은 이 제보가 연결된 새 할 일 — 제목은 제보 번호 + 공개 글 제목으로 채워 두고 고칠 수 있다.
 * 비공개 글 제목은 넣지 않는다(할 일 제목은 작업 기록 대상 칸에 남는다).
 */
export function ReportTodoButton({ item, title }: { item: BugItem; title: string }) {
  const todos = useTodos();
  const no = bugNoLabel(useBugNo(item));
  const [making, setMaking] = useState(false);
  // 진행 중 > 할 일 > 완료 순으로 첫 것.
  const linked = sortTodos(todos.data ?? []).find((t) => t.reports.includes(item.id));

  if (!todos.data) return null;
  if (linked)
    return (
      <a className={`btn ${styles.slot}`} href={`#/todos/${linked.id}`}>
        📋 할 일 보기
      </a>
    );
  const initial = emptyDraft(
    [item.id],
    `${no} ${item.vis === 'pub' ? title : ''}`.trim().slice(0, TODO_TITLE_MAX),
  );
  return (
    <span className={styles.slot}>
      <button type="button" className="btn" aria-expanded={making} onClick={() => setMaking(!making)}>
        📋 할 일에 등록
      </button>
      {making && (
        <div className={`card ${styles.pop}`}>
          <TodoForm initial={initial} onDone={() => setMaking(false)} />
        </div>
      )}
    </span>
  );
}
