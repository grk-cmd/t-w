import { useMemo } from 'react';
import { usePendingRequests } from '@/entities/license-request';
import { BulkApproveButton, RequestActions } from '@/features/license/approve-request';
import { errorMessage, formatDate, usePaging, useSelection } from '@/shared/lib';
import { Pager, RowCheckbox, SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import styles from './RequestList.module.css';

export function RequestList() {
  const { data: requests, error } = usePendingRequests();
  const list = useMemo(() => requests ?? [], [requests]);
  // 발급 · 거절로 목록에서 사라진 요청은 선택에서도 빠진다.
  const ids = useMemo(() => list.map((r) => r.id), [list]);
  const paging = usePaging(list, 'requests');
  const pageIds = useMemo(() => paging.items.map((r) => r.id), [paging.items]);
  const selection = useSelection(ids, pageIds);
  const selected = list.filter((r) => selection.isSelected(r.id));

  return (
    <section className="card">
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
        {error && errorMessage(error, '요청 목록을 받지 못했어요')}
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
              <code className="key">{req.friendCode}</code>
              <small className="soft">{formatDate(req.requestedAt)}</small>
            </span>
            <RequestActions request={req} />
          </div>
        ))}
      </div>
      <Pager paging={paging} />
    </section>
  );
}
