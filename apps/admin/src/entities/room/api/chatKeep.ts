import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { CHAT_KEEP_PATH, chatKeepDetail, parseChatKeep, type ChatKeep } from '../model/chatKeep';

const KEY = ['chatKeepDays'];

export async function getChatKeep(db: Db): Promise<ChatKeep> {
  return parseChatKeep(await db.get<unknown>(CHAT_KEEP_PATH));
}

export function useChatKeep() {
  const db = useDb();
  return useQuery({ queryKey: KEY, queryFn: () => getChatKeep(db) });
}

export function useRefreshChatKeep() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

/** 바뀐 칸 + 작업 기록 한 묶음. */
export function saveChatKeep(
  db: Db,
  before: ChatKeep,
  updates: Record<string, number | null>,
): Promise<void> {
  const detail = chatKeepDetail(before, updates);
  return db.commit(withAudit(db, updates, 'settings.chatKeepDays', '대화 보관 일수', detail));
}
