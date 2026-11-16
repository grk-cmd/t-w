import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTodoPort } from './index';

const TODOS_KEY = ['adminTodos'];
const TODO_NOTE_KEY = ['adminTodoNote'];

/** 관리자 몇 명이 쓰는 수십~수백 건이라 통째로 한 번 — 제보 목록도 이 한 번을 같이 쓴다. */
export function useTodos() {
  const port = useTodoPort();
  return useQuery({ queryKey: TODOS_KEY, queryFn: () => port.list(), staleTime: 30_000 });
}

export function useRefreshTodos() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: TODOS_KEY });
}

/** 할 일 화면을 열 때 한 번 — 2000자 이하 한 칸이라 통째로. 다시 받기는 할 일 «새로고침» 과 같이. */
export function useTodoNote() {
  const port = useTodoPort();
  return useQuery({ queryKey: TODO_NOTE_KEY, queryFn: () => port.note(), staleTime: 30_000 });
}

export function useRefreshTodoNote() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: TODO_NOTE_KEY });
}
