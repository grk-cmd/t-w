import { useAdminNames } from '@/entities/admin/name';
import type { Todo } from '@/entities/admin/todo';
import { useDb } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { resultMessage } from '../model/saveTodo';
import { useDeleteTodo } from '../model/useSaveTodo';

export function DeleteTodoButton({ todo }: { todo: Todo }) {
  const toast = useToast();
  const me = useDb().uid();
  const names = useAdminNames().data ?? new Map<string, string>();
  const del = useDeleteTodo();
  const onClick = () => {
    if (!confirm(`할 일 «${todo.title}» 을 지울까요? 연결된 제보는 그대로 남아요.`)) return;
    del.mutate(todo, {
      onSuccess: (r) => toast(r.ok ? '할 일 삭제' : resultMessage(r, names, me)),
      onError: (e) => toast(errorMessage(e, '삭제 실패')),
    });
  };
  return (
    <button type="button" className="btn danger" onClick={onClick} disabled={del.isPending}>
      삭제
    </button>
  );
}
