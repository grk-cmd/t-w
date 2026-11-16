import { useMemo } from 'react';
import {
  useLicenseRequestPort,
  usePendingRequests,
  usePendingRequestsKeyset,
  useReloadRequests,
  type LicenseRequest,
} from '@/entities/license-request';
import { BulkApproveButton, RequestActions } from '@/features/license/approve-request';
import {
  errorMessage,
  formatDate,
  keysetView,
  useKeysetPaging,
  usePaging,
  useSelection,
  type Paging,
} from '@/shared/lib';
import { Pager, RowCheckbox, SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import styles from './RequestList.module.css';

interface ViewProps {
  /** 받아 둔 전부 — 선택 · 전체 선택의 범위. 아직 못 받았으면 undefined. */
  requests: LicenseRequest[] | undefined;
  error: unknown;
  paging: Paging<LicenseRequest>;
  /** 받아 둔 뒤에 더 있다(전체 수를 모를 때). */
  more?: boolean;
}

function RequestView({ requests, error, paging, more = false }: ViewProps) {
  const reload = useReloadRequests();
  const list = useMemo(() => requests ?? [], [requests]);
  // 발급 · 거절로 목록에서 사라진 요청은 선택에서도 빠진다.
  const ids = useMemo(() => list.map((r) => r.id), [list]);
  const pageIds = useMemo(() => paging.items.map((r) => r.id), [paging.items]);
  const selection = useSelection(ids, pageIds);
  const selected = list.filter((r) => selection.isSelected(r.id));

  return (
    <section className="card">
      {/* API 판은 30초마다 받는다 — 바로 보고 싶을 때 */}
      {reload && (
        <div className="card-head">
          <span className="soft grow">30초마다 새로 받아요</span>
          <button type="button" className="btn" onClick={reload}>
            새로고침
          </button>
        </div>
      )}
      {list.length > 0 && (
        <SelectionBar
          count={selected.length}
          onClear={selection.clear}
          selectAll={
            <SelectAllCheckbox
              allChecked={selection.allChecked}
              someChecked={selection.someChecked}
              onChange={selection.toggleAll}
            />
          }
        >
          <BulkApproveButton requests={selected} onDone={selection.clear} />
        </SelectionBar>
      )}
      <div className="list">
        {!!error && errorMessage(error, '요청 목록을 받지 못했어요')}
        {!error && !requests && '불러오는 중…'}
        {requests?.length === 0 && '대기 중인 요청이 없어요'}
        {paging.items.map((req, i) => (
          <div key={req.id} className="row">
            <RowCheckbox
              label={`${req.name} 선택`}
              checked={selection.isSelected(req.id)}
              onChange={() => selection.toggle(req.id)}
            />
            <span className="grow">
              <span className={styles.num}>{paging.start + i + 1}</span>
              <b>{req.name || '(이름 없음)'}</b>
              <code className="key">{req.friendCode ?? req.userCode}</code>
              <small className="soft">{formatDate(req.requestedAt)}</small>
              {req.ver && <small className="soft">v{req.ver}</small>}
            </span>
            <RequestActions request={req} />
          </div>
        ))}
      </div>
      <Pager paging={paging} more={more} />
    </section>
  );
}

/** 지켜보는 판(Firebase) — 통째로 받아 웹이 쪽을 자른다. */
function WatchedRequests() {
  const { data, error } = usePendingRequests();
  const paging = usePaging(data ?? [], 'requests');
  return <RequestView requests={data} error={error} paging={paging} />;
}

/** 쪽으로 받는 판(API) — 받은 쪽을 이어 두고, 전체 수는 서버 `total`. */
function PolledRequests() {
  const query = usePendingRequestsKeyset();
  const paging = useKeysetPaging(query, 'requests');
  const requests = query.data ? keysetView(query.data.pages).items : undefined;
  return <RequestView requests={requests} error={query.error} paging={paging} more={paging.more} />;
}

export function RequestList() {
  return useLicenseRequestPort().kind === 'poll' ? <PolledRequests /> : <WatchedRequests />;
}
