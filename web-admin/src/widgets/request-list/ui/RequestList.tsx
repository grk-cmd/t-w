import { useState } from 'react';
import { usePendingRequests } from '@/entities/license-request';
import { BulkApproveButton, RequestActions } from '@/features/license/approve-request';
import { errorMessage, formatDate } from '@/shared/lib';
import styles from './RequestList.module.css';

export function RequestList() {
  const { data: requests, error } = usePendingRequests();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // 발급 · 거절로 목록에서 사라진 요청은 선택에서도 빠진다.
  const list = requests ?? [];
  const selected = list.filter((r) => checked.has(r.id));
  const allChecked = list.length > 0 && selected.length === list.length;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(list.map((r) => r.id)));

  return (
    <section className="card">
      <div className="card-head">
        <span className="grow" />
        <BulkApproveButton requests={selected} onDone={() => setChecked(new Set())} />
      </div>
      <div className="list">
        {error && errorMessage(error, '요청 목록을 받지 못했어요')}
        {!error && !requests && '불러오는 중…'}
        {requests?.length === 0 && '대기 중인 요청이 없어요'}
        {list.length > 0 && (
          <label className={`row ${styles.checkAll}`}>
            <input type="checkbox" className={styles.check} checked={allChecked} onChange={toggleAll} />
            <span className="soft">전체 선택</span>
          </label>
        )}
        {list.map((req, i) => (
          <div key={req.id} className="row">
            <input
              type="checkbox"
              className={styles.check}
              aria-label={`${req.name} 선택`}
              checked={checked.has(req.id)}
              onChange={() => toggle(req.id)}
            />
            <span className="grow">
              <span className={styles.num}>{i + 1}</span>
              <b>{req.name || '(이름 없음)'}</b>
              <code className="key">{req.friendCode}</code>
              <small className="soft">{formatDate(req.requestedAt)}</small>
            </span>
            <RequestActions request={req} />
          </div>
        ))}
      </div>
    </section>
  );
}
