import { useState } from 'react';
import { useAdminNames } from '@/entities/admin/name';
import { TodoBadge, useTodos } from '@/entities/admin/todo';
import { useDb } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { resultMessage } from '../model/saveTodo';
import { useLinkReport } from '../model/useSaveTodo';
import styles from './ReportTodos.module.css';

/**
 * 제보 상세의 «할 일» 칸 — 걸린 할 일(상태만 · 누르면 할 일 화면으로) · 기존 할 일에 연결하는 작은 선택.
 * 새로 만들기는 머리줄의 «📋 할 일에 등록». 할 일 전체는 제보 목록과 같은 한 번 받은 것을 쓴다.
 */
export function ReportTodos({ reportId }: { reportId: string }) {
  const toast = useToast();
  const me = useDb().uid();
  const todos = useTodos();
  const names = useAdminNames().data ?? new Map<string, string>();
  const link = useLinkReport(reportId, names);
  const [pick, setPick] = useState('');

  const all = todos.data ?? [];
  const linked = all.filter((t) => t.reports.includes(reportId));
  const open = all.filter((t) => t.status !== 'done' && !t.reports.includes(reportId));

  const onLink = () => {
    const todo = open.find((t) => t.id === pick);
    if (!todo) return;
    link.mutate(todo, {
      onSuccess: (r) => {
        toast(r.ok ? `할 일 «${todo.title}» 에 연결` : resultMessage(r, names, me));
        if (r.ok) setPick('');
      },
      onError: (e) => toast(errorMessage(e, '연결 실패')),
    });
  };

  if (todos.error) return <p className="msg err">{errorMessage(todos.error, '할 일 불러오기 실패')}</p>;
  if (!todos.data) return <p className="soft">불러오는 중…</p>;

  return (
    <div className={styles.box}>
      {linked.length === 0 && <p className="soft">걸린 할 일 없음</p>}
      {linked.map((t) => (
        <div key={t.id} className={styles.line}>
          <TodoBadge todo={t} />
          <a href={`#/todos/${t.id}`}>{t.title}</a>
        </div>
      ))}
      {open.length > 0 && (
        <div className={styles.tools}>
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="연결할 할 일">
            <option value="">기존 할 일에 연결…</option>
            {open.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button type="button" className="btn" disabled={!pick || link.isPending} onClick={onLink}>
            연결
          </button>
        </div>
      )}
    </div>
  );
}
