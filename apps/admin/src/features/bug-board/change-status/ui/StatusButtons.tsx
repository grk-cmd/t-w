import { BUG_STATUS, BUG_STATUSES, type BugItem, type BugStatus } from '@/entities/bug-board';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useChangeStatus } from '../model/useChangeStatus';
import styles from './StatusButtons.module.css';

/** 답변과 따로 상태만 바꾼다 — 지금 상태 버튼은 눌린 채로 꺼 둔다. */
export function StatusButtons({ item, label }: { item: BugItem; label: string }) {
  const toast = useToast();
  const change = useChangeStatus(item, label);

  const onPick = (status: BugStatus) => {
    if (!confirm(`${label} 상태 변경 — «${BUG_STATUS[status]}»?`)) return;
    change.mutate(status, {
      onSuccess: () => toast(`상태 변경 — ${BUG_STATUS[status]}`),
      onError: (e) => toast(errorMessage(e, '상태 변경 실패')),
    });
  };

  return (
    <div className={styles.buttons} role="group" aria-label="상태 변경">
      {BUG_STATUSES.map((st) => (
        <button
          key={st}
          type="button"
          className={st === item.status ? 'btn primary' : 'btn'}
          aria-pressed={st === item.status}
          disabled={st === item.status || change.isPending}
          onClick={() => onPick(st)}
        >
          {BUG_STATUS[st]}
        </button>
      ))}
    </div>
  );
}
