import { BUG_STATUS, type BugStatus } from '../model/bugBoard';
import styles from './StatusChip.module.css';

export function StatusChip({ status }: { status: BugStatus }) {
  return <span className={`${styles.chip} ${styles[status]}`}>{BUG_STATUS[status]}</span>;
}
