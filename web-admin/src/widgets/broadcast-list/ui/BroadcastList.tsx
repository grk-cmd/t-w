import { useState } from 'react';
import { INBOX_TAG_LABEL, useBroadcasts, useRefreshBroadcasts } from '@/entities/inbox';
import { BroadcastActions } from '@/features/manage-broadcast';
import { errorMessage, formatDate, paginate } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './BroadcastList.module.css';

const PAGE_SIZE = 30;

export function BroadcastList() {
  const { data: broadcasts, error } = useBroadcasts();
  const refresh = useRefreshBroadcasts();
  const [page, setPage] = useState(1);
  const view = paginate(broadcasts ?? [], page, PAGE_SIZE);

  return (
    <section className="card">
      <div className="card-head">
        <h2>보낸 전체 공지</h2>
        <span className="soft">{broadcasts && `${broadcasts.length}건`}</span>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <div className="list tall">
        {error && errorMessage(error, '공지 목록을 불러오지 못했어요')}
        {!error && !broadcasts && '불러오는 중…'}
        {broadcasts?.length === 0 && '보낸 공지가 없어요'}
        {view.items.map((b) => (
          <div key={b.id} className="row">
            <span className="grow">
              {b.pinned && <span title="맨 위 고정">📌</span>}
              <span className="meta">{INBOX_TAG_LABEL[b.tag]}</span>
              <b>{b.title || '(제목 없음)'}</b>
              <small className="soft">{formatDate(b.ts)}</small>
              <span className={`note ${styles.body}`}>{b.body || '(내용 없음)'}</span>
            </span>
            <BroadcastActions broadcast={b} />
          </div>
        ))}
      </div>
      <Pager page={view.page} pageCount={view.pageCount} onChange={setPage} />
    </section>
  );
}
