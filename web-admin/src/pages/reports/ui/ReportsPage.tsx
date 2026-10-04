import { useMemo } from 'react';
import { REPORT_ADMIN_MIN, reportTargets, useRefreshReports, useReports } from '@/entities/report';
import { useRefreshUserBrief } from '@/entities/user';
import { BulkDismissButton } from '@/features/user/moderate-report';
import { errorMessage, useSelection } from '@/shared/lib';
import { SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import { ReportList } from '@/widgets/report-list';

export function ReportsPage() {
  const { data, error } = useReports();
  const refreshReports = useRefreshReports();
  const refreshBrief = useRefreshUserBrief();
  const items = useMemo(() => (data ? reportTargets(data) : null), [data]);
  const ids = useMemo(() => (items ?? []).map((item) => item.target), [items]);
  const selection = useSelection(ids);

  const refresh = () => {
    refreshReports();
    for (const item of items ?? []) refreshBrief(item.target);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow" title={`서로 다른 ${REPORT_ADMIN_MIN}명 이상이 신고한 사람만`}>
          신고 {REPORT_ADMIN_MIN}명 이상{items && ` · ${items.length}명`}
        </span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      {error && <p className="msg err">{errorMessage(error, '신고 목록을 불러오지 못했어요')}</p>}
      {!error && !items && <p className="soft">불러오는 중…</p>}
      {items?.length === 0 && <p className="soft">살펴볼 신고가 없어요</p>}
      {items && items.length > 0 && (
        <>
          <SelectionBar
            count={selection.selected.length}
            onClear={selection.clear}
            selectAll={
              <SelectAllCheckbox
                label="전체 선택"
                allChecked={selection.allChecked}
                someChecked={selection.someChecked}
                onChange={selection.toggleAll}
              />
            }
          >
            <BulkDismissButton targets={selection.selected} onDone={selection.clear} />
          </SelectionBar>
          <ReportList items={items} selection={selection} />
        </>
      )}
    </section>
  );
}
