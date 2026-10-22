import type { ReactNode } from 'react';
import { INVITE_GRANT_MAX } from '@/entities/invite';
import { useModalDialog } from '@/shared/ui';
import styles from './InviteDialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  /** 참이면 Esc · 바깥 클릭으로 닫히지 않는다 — 전체 지급이 도는 중에 창이 사라지면 진행 상황을 볼 수 없다. */
  locked?: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function InviteDialog({ open, title, locked, onClose, children }: DialogProps) {
  const { dialogProps } = useModalDialog({ open, onClose, locked });

  return (
    <dialog {...dialogProps} className={styles.dialog}>
      <h2>{title}</h2>
      {open && children}
    </dialog>
  );
}

export function CountStepper({
  value,
  onChange,
  max = INVITE_GRANT_MAX,
  unit = '장',
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  unit?: string;
}) {
  return (
    <div className={styles.stepper}>
      <button type="button" className="btn" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b className={styles.count}>
        {value}
        {unit}
      </b>
      <button type="button" className="btn" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
      <small className="soft">
        최대 {max}
        {unit}
      </small>
    </div>
  );
}
