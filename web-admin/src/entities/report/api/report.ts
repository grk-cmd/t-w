import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, type Db } from '@/shared/api';
import type { ReportTree } from '../model/report';

const REPORTS_KEY = ['reports'];

// 신고는 한 줄에 100바이트 남짓이고 쌓이면 관리자가 비우는 노드라 통째로 받는다.
export async function listReports(db: Db): Promise<ReportTree> {
  return (await db.get<ReportTree>('reports')) ?? {};
}

export function useReports() {
  const db = useDb();
  return useQuery({ queryKey: REPORTS_KEY, queryFn: () => listReports(db) });
}

export function useRefreshReports() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: REPORTS_KEY });
}

/** 한 사람이 받은 신고 수(= 서로 다른 신고자 수). 키 이름만 받는다 — 사유 · 닉네임은 내려받지 않는다. */
export async function countUserReports(db: Db, uid: string): Promise<number> {
  return (await db.shallowKeys(`reports/${uid}`)).length;
}

/** 열쇠가 ['reports', …] 로 시작해 신고 목록을 새로 받을 때 함께 다시 센다. */
export function useUserReportCount(uid: string) {
  const db = useDb();
  return useQuery({ queryKey: [...REPORTS_KEY, 'count', uid], queryFn: () => countUserReports(db, uid) });
}

/** 한 사람에 대한 신고를 전부 비우는 쓰기 — 다른 쓰기와 한 묶음(db.commit)으로 보낼 수 있다. */
export function clearReportsWrite(target: string): Record<string, null> {
  return { [`reports/${target}`]: null };
}

/** 비운 사람을 캐시에서만 뺀다 — 목록을 다시 받지 않아도 된다. */
export function useForgetReports() {
  const client = useQueryClient();
  return (target: string) =>
    client.setQueryData<ReportTree>(REPORTS_KEY, (all) => {
      if (!all) return all;
      const { [target]: _gone, ...rest } = all;
      return rest;
    });
}
