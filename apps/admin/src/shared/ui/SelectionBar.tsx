import type { ReactNode } from 'react';
import styles from './SelectionBar.module.css';

interface Props {
  count: number;
  onClear: () => void;
  /** 맨 앞에 둘 «이 쪽 전체 선택» — 표처럼 머리줄에 따로 두는 목록은 비운다. */
  selectAll?: ReactNode;
  /** 동작 버튼들. 선택이 0 이면 통째로 비활성. */
  children: ReactNode;
}

export function SelectionBar({ count, onClear, selectAll, children }: Props) {
  return (
    <div className={styles.bar} role="toolbar" aria-label="선택한 항목 동작">
      {selectAll}
      <span className={styles.count} aria-live="polite">
        {count}개 선택
      </span>
      <fieldset className={styles.actions} disabled={count === 0}>
        {children}
      </fieldset>
      <button type="button" className="btn" disabled={count === 0} onClick={onClear}>
        선택 해제
      </button>
    </div>
  );
}
