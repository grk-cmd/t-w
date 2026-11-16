import { useMemo } from 'react';
import {
  REPORT_ADMIN_MIN,
  useRefreshReports,
  useReportPort,
  useReports,
  useReportsKeyset,
  type ReportTarget,
} from '@/entities/report';
import { useRefreshUserBrief } from '@/entities/user';
import { BulkDismissButton } from '@/features/user/moderate-report';
import {
  errorMessage,
  keysetView,
  usePaging,
  useKeysetPaging,
  useSelection,
  type Paging,
} from '@/shared/lib';
import { Pager, SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import { ReportList } from '@/widgets/report-list';

interface ViewProps {
  /** 받아 둔 전부 — 선택 · 전체 선택의 범위. */
  items: ReportTarget[] | null;
  error: unknown;
  paging: Paging<ReportTarget>;
  /** 머리 줄의 «n명» — 전체 수를 모르면 null. */
  count: number | null;
  /** 받아 둔 뒤에 더 있다(전체 수를 모를 때). */
  more?: boolean;
}

function ReportsView({ items, error, paging, count, more = false }: ViewProps) {
  const refreshReports = useRefreshReports();
  const refreshBrief = useRefreshUserBrief();
  const ids = useMemo(() => (items ?? []).map((item) => item.target), [items]);
  const pageIds = useMemo(() => paging.items.map((item) => item.target), [paging.items]);
  const selection = useSelection(ids, pageIds);

  const refresh = () => {
    refreshReports();
    for (const item of items ?? []) refreshBrief(item.target);
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="soft grow" title={`서로 다른 ${REPORT_ADMIN_MIN}명 이상이 신고한 사람만`}>
          신고 {REPORT_ADMIN_MIN}명 이상{count !== null && ` · ${count}명`}
        </span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      {!!error && <p className="msg err">{errorMessage(error, '신고 목록을 불러오지 못했어요')}</p>}
      {!error && !items && <p className="soft">불러오는 중…</p>}
      {items?.length === 0 && <p className="soft">살펴볼 신고가 없어요</p>}
      {items && items.length > 0 && (
        <>
          <SelectionBar
            count={selection.selected.length}
            onClear={selection.clear}
            selectAll={
              <SelectAllCheckbox
                allChecked={selection.allChecked}
                someChecked={selection.someChecked}
                onChange={selection.toggleAll}
              />
            }
          >
            <BulkDismissButton targets={selection.selected} onDone={selection.clear} />
          </SelectionBar>
          <ReportList items={paging.items} selection={selection} />
          <Pager paging={paging} more={more} />
        </>
      )}
    </section>
  );
}

/** 통째로 받아 웹이 쪽을 자르는 판(Firebase). */
function AllReports() {
  const { data, error } = useReports();
  const items = data ?? null;
  const paging = usePaging(items ?? [], 'reports');
  return <ReportsView items={items} error={error} paging={paging} count={items ? items.length : null} />;
}

/** 서버 키셋을 쪽으로 받는 판(API) — 받은 쪽을 이어 두고, 전체 수는 서버 `total`. */
function KeysetReports() {
  const query = useReportsKeyset();
  const paging = useKeysetPaging(query, 'reports');
  const view = query.data ? keysetView(query.data.pages) : null;
  return (
    <ReportsView
      items={view ? view.items : null}
      error={query.error}
      paging={paging}
      count={view ? view.total : null}
      more={paging.more}
    />
  );
}

export function ReportsPage() {
  return useReportPort().kind === 'keyset' ? <KeysetReports /> : <AllReports />;
}
