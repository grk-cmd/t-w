import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { BANNED_WORDS_PATH, bannedWordsDetail, parseBannedWords } from '../model/bannedWords';

const KEY = ['bannedWords'];

export async function getBannedWords(db: Db): Promise<string[]> {
  return parseBannedWords(await db.get<unknown>(BANNED_WORDS_PATH));
}

export function useBannedWords() {
  const db = useDb();
  return useQuery({ queryKey: KEY, queryFn: () => getBannedWords(db) });
}

export function useRefreshBannedWords() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: KEY });
}

/** 목록 통째 + 작업 기록 한 묶음. 빈 목록은 칸을 지운다(규칙은 목록만 받는다). */
export function saveBannedWords(db: Db, before: string[], words: string[]): Promise<void> {
  const value = words.length ? words : null;
  return db.commit(
    withAudit(
      db,
      { [BANNED_WORDS_PATH]: value },
      'settings.bannedWords',
      '방 제목 금칙어',
      bannedWordsDetail(before, words),
    ),
  );
}
