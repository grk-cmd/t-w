// 하루 제보 상한(`config/bugDailyMax`) — Firebase 판 설정 카드(D12-1) 몫이라 포트 없이 둔다.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { BUG_DAILY_MAX_DEFAULT, BUG_DAILY_MAX_PATH } from '../model/bugBoard';
import { BUG_KEY } from './keys';

const DAILY_MAX_KEY = [...BUG_KEY, 'dailyMax'];

/** 하루 제보 상한 — 서버에 정해 둔 값. 없으면 null(앱은 기본값 5). */
export async function getBugDailyMax(db: Db): Promise<number | null> {
  const v = await db.get<unknown>(BUG_DAILY_MAX_PATH);
  return typeof v === 'number' ? v : null;
}

export function useBugDailyMax() {
  const db = useDb();
  return useQuery({ queryKey: DAILY_MAX_KEY, queryFn: () => getBugDailyMax(db) });
}

export function useRefreshBugDailyMax() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: DAILY_MAX_KEY });
}

/** 상한 저장 + 작업 기록(이전 → 다음) 한 묶음. */
export function saveBugDailyMax(db: Db, max: number, before: number | null): Promise<void> {
  const detail = `${before ?? `기본 ${BUG_DAILY_MAX_DEFAULT}`} → ${max}`;
  return db.commit(
    withAudit(db, { [BUG_DAILY_MAX_PATH]: max }, 'settings.bugDailyMax', `하루 ${max}건`, detail),
  );
}
