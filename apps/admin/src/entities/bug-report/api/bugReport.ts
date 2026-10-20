import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDb, withAudit, type Db } from '@/shared/api';
import { BUG_LINK_MAX, BUG_NOTICE_MAX, type BugReport } from '../model/bugReport';

const BUG_REPORT_KEY = ['bugReport'];
const PATH = 'bugReport/current';

export function getBugReport(db: Db): Promise<BugReport | null> {
  return db.get<BugReport>(PATH);
}

export function useBugReport() {
  const db = useDb();
  return useQuery({ queryKey: BUG_REPORT_KEY, queryFn: () => getBugReport(db) });
}

export function useRefreshBugReport() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: BUG_REPORT_KEY });
}

// 앱처럼 link 를 늘 함께 쓴다 — 빈 문자열이면 앱의 [제보하기] 버튼이 꺼진다.
export function saveBugReport(db: Db, notice: string, link: string): Promise<void> {
  const value = {
    notice: notice.trim().slice(0, BUG_NOTICE_MAX),
    link: link.trim().slice(0, BUG_LINK_MAX),
    ts: db.now(),
  };
  return db.commit(
    withAudit(db, { [PATH]: value }, 'notice.bugReport', value.notice || '(안내 없음)', value.link),
  );
}
