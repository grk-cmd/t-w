// 하루 제보 상한 — 판마다 키가 다르다(Firebase 판 `config/bugDailyMax` · API 판 서버 키 `bug.dailyMax`). 포트 뒤로만 읽고 쓴다.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBugDailyMaxPort } from './index';
import { BUG_KEY } from './keys';

const DAILY_MAX_KEY = [...BUG_KEY, 'dailyMax'];

export function useBugDailyMax() {
  const port = useBugDailyMaxPort();
  return useQuery({ queryKey: DAILY_MAX_KEY, queryFn: () => port.get() });
}

export function useRefreshBugDailyMax() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: DAILY_MAX_KEY });
}
