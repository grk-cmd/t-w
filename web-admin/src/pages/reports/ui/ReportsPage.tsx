import { useMemo } from 'react';
import { REPORT_ADMIN_MIN, reportTargets, useRefreshReports, useReports } from '@/entities/report';
import { useRefreshUserBrief } from '@/entities/user';
import { errorMessage } from '@/shared/lib';
import { ReportList } from '@/widgets/report-list';

export function ReportsPage() {
  const { data, error } = useReports();
  const refreshReports = useRefreshReports();
  const refreshBrief = useRefreshUserBrief();
  const items = useMemo(() => (data ? reportTargets(data) : null), [data]);

  const refresh = () => {
    refreshReports();
    for (const item of items ?? []) refreshBrief(item.target);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow">
          서로 다른 {REPORT_ADMIN_MIN}명 이상이 신고한 사람만 보여요{items && ` · ${items.length}명`}
        </span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      {error && <p className="msg err">{errorMessage(error, '신고 목록을 불러오지 못했어요')}</p>}
      {!error && !items && <p className="soft">불러오는 중…</p>}
      {items?.length === 0 && <p className="soft">살펴볼 신고가 없어요</p>}
      {items && items.length > 0 && <ReportList items={items} />}
    </section>
  );
}
