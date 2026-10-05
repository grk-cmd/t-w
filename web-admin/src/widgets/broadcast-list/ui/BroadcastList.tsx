import { useMemo, useState } from 'react';
import { INBOX_TAG_LABEL, useBroadcasts, useRefreshBroadcasts } from '@/entities/inbox';
import { BroadcastActions, BulkBroadcastActions } from '@/features/notice/manage-broadcast';
import { errorMessage, formatDate, readPageSize, usePaging, useSelection } from '@/shared/lib';
import { Pager, RowCheckbox, SelectAllCheckbox, SelectionBar } from '@/shared/ui';
import styles from './BroadcastList.module.css';

const LIST_KEY = 'broadcasts';

export function BroadcastList() {
  const [limit, setLimit] = useState(() => readPageSize(LIST_KEY));
  const { data, error } = useBroadcasts(limit);
  const broadcasts = data?.items;
  const refresh = useRefreshBroadcasts();
  const list = useMemo(() => broadcasts ?? [], [broadcasts]);
  const paging = usePaging(list, LIST_KEY);
  // 통째로 받지 않는다 — 처음엔 첫 쪽만큼, 받아 둔 것보다 뒤쪽으로 가거나 개수를 늘리면 그 쪽까지만 더 받는다.
  const need = paging.want * paging.size;
  if (need > limit && data?.hasMore) setLimit(need);
  const ids = useMemo(() => list.map((b) => b.id), [list]);
  const pageIds = useMemo(() => paging.items.map((b) => b.id), [paging.items]);
  const selection = useSelection(ids, pageIds);
  const selected = list.filter((b) => selection.isSelected(b.id));

  return (
    <section className="card">
      <div className="card-head">
        <h2>보낸 전체 공지</h2>
        <span className="soft">{broadcasts && `${broadcasts.length}건${data.hasMore ? '+' : ''}`}</span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
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
          <BulkBroadcastActions broadcasts={selected} onDone={selection.clear} />
        </SelectionBar>
      )}
      <div className="list tall">
        {error && errorMessage(error, '공지 목록을 불러오지 못했어요')}
        {!error && !broadcasts && '불러오는 중…'}
        {broadcasts?.length === 0 && '보낸 공지가 없어요'}
        {paging.items.map((b) => (
          <div key={b.id} className="row">
            <RowCheckbox
              label={`${b.title || '제목 없음'} 선택`}
              checked={selection.isSelected(b.id)}
              onChange={() => selection.toggle(b.id)}
            />
            <span className="grow">
              {b.pinned && <span title="맨 위 고정">📌</span>}
              <span className="meta">{INBOX_TAG_LABEL[b.tag]}</span>
              <b>{b.title || '제목 없음'}</b>
              <small className="soft">{formatDate(b.ts)}</small>
              <span className={`note ${styles.body}`}>{b.body || '내용 없음'}</span>
            </span>
            <BroadcastActions broadcast={b} />
          </div>
        ))}
      </div>
      <Pager paging={paging} more={data?.hasMore} />
    </section>
  );
}
