import { useMemo, useState } from 'react';
import {
  actionLabel,
  inGroup,
  LOG_GROUPS,
  useAdminLog,
  useRefreshAdminLog,
  whoLabel,
  type LogGroup,
} from '@/entities/admin-log';
import { useDb } from '@/shared/api';
import { errorMessage, formatDate, readPageSize, usePaging } from '@/shared/lib';
import { Pager } from '@/shared/ui';
import styles from './AdminLogList.module.css';

const LIST_KEY = 'adminLog';

export function AdminLogList() {
  const me = useDb().uid();
  const [group, setGroup] = useState<LogGroup>('all');
  const [limit, setLimit] = useState(() => readPageSize(LIST_KEY));
  const { data, error, isPlaceholderData } = useAdminLog(limit);
  const refresh = useRefreshAdminLog();
  const items = data?.items;
  const list = useMemo(() => (items ?? []).filter((e) => inGroup(e, group)), [items, group]);
  const paging = usePaging(list, LIST_KEY);
  // 통째로 받지 않는다 — 보려는 쪽까지 모자랄 때만(필터로 줄었을 때도) 한 쪽만큼 더 받는다.
  const need = paging.want * paging.size;
  if (data && !isPlaceholderData && data.hasMore && list.length < need) setLimit(limit + paging.size);

  const pick = (next: LogGroup) => {
    setGroup(next);
    paging.setPage(1);
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>관리자 작업 기록</h2>
        <button type="button" className="btn" onClick={refresh}>
          새로고침
        </button>
      </div>
      <div className={styles.chips}>
        {LOG_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={g.id === group}
            className={g.id === group ? `${styles.chip} ${styles.on}` : styles.chip}
            onClick={() => pick(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="list tall">
        {error && errorMessage(error, '기록을 불러오지 못했어요')}
        {!error && !items && '불러오는 중…'}
        {items && list.length === 0 && !data?.hasMore && '기록이 없어요'}
        {paging.items.map((e) => (
          <div key={e.id} className="row">
            <span className="grow">
              <small className="soft">{formatDate(e.at)}</small>
              <span className="meta">{actionLabel(e.action)}</span>
              <b>{e.target}</b>
              {e.detail && <span className="note">{e.detail}</span>}
            </span>
            <small className="soft" title={e.by}>
              {whoLabel(e.by, me)}
            </small>
          </div>
        ))}
      </div>
      <Pager paging={paging} more={data?.hasMore} />
    </section>
  );
}
