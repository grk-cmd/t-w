import { useEffect, useRef } from 'react';
import styles from './SelectCheckbox.module.css';

interface RowProps {
  checked: boolean;
  onChange: () => void;
  /** 읽어 주는 이름 — «민수 선택» 처럼. */
  label: string;
}

export function RowCheckbox({ checked, onChange, label }: RowProps) {
  return (
    <input
      type="checkbox"
      className={styles.check}
      aria-label={label}
      checked={checked}
      onChange={onChange}
    />
  );
}

interface AllProps {
  allChecked: boolean;
  someChecked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

// indeterminate 는 HTML 속성이 없어 DOM 에 직접 넣는다.
export function SelectAllCheckbox({
  allChecked,
  someChecked,
  onChange,
  disabled,
  label = '이 쪽 전체 선택',
}: AllProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={styles.check}
      aria-label={label}
      checked={allChecked}
      disabled={disabled}
      onChange={onChange}
    />
  );
}
