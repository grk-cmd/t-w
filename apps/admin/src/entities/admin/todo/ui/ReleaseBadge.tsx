import { releaseState } from '../model/adminTodo';
import styles from './TodoBadge.module.css';

const STATE_TEXT = { released: '출시됨', pending: '출시 전' } as const;

/** 릴리스 버전 — latest(GitHub 최신 공개 릴리스)를 알면 «출시 전 · 출시됨» 을 붙인다. 모르면 버전만. */
export function ReleaseBadge({ release, latest }: { release: string; latest: string | null | undefined }) {
  if (!release) return null;
  const state = releaseState(release, latest);
  const cls = state ? styles[state] : '';
  return (
    <span
      className={`${styles.badge} ${cls}`}
      title={latest ? `최신 공개 릴리스 ${latest}` : '최신 릴리스를 몰라 버전만'}
    >
      🏷 {release}
      {state && ` · ${STATE_TEXT[state]}`}
    </span>
  );
}
