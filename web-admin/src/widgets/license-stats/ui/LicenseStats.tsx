import { sourceNote, useLicenseStats } from '@/entities/license';
import { useUserCount } from '@/entities/user-count';
import { errorMessage } from '@/shared/lib';
import styles from './LicenseStats.module.css';

// 숫자는 API(읽기 사본)의 집계 — 닿지 못하면 예전처럼 licenses 를 통째로 받아 센다(아래 목록과 같은 한 번을 나눠 쓴다).
export function LicenseStats() {
  const users = useUserCount();
  const stats = useLicenseStats();
  const counts = stats.data?.counts;
  const n = (v: number | undefined) => (v === undefined ? '…' : v.toLocaleString());

  return (
    <section className={styles.stats} aria-label="전체 통계">
      <div className="card">
        <span className="meta" title="가입 카운터라 탈퇴 · 테스트 계정도 포함돼요">
          👥 가입 유저
        </span>
        <strong className={styles.num}>{users.error ? '—' : n(users.data)}명</strong>
        {users.error && <small className="soft">{errorMessage(users.error, '불러오지 못했어요')}</small>}
      </div>
      <div className="card">
        <span className="meta" title="회수 안 된 등록 키 수. 한 사람이 여러 키를 쓰면 겹쳐 세요">
          👑 사용 중인 키
        </span>
        <strong className={styles.num}>{n(counts?.used)}개</strong>
      </div>
      <div className="card">
        <span className="meta">🎟️ 발급된 키</span>
        <strong className={styles.num}>{n(counts?.total)}개</strong>
        <small className="soft">
          {stats.error
            ? errorMessage(stats.error, '불러오지 못했어요')
            : `사용 ${n(counts?.used)} · 미사용 ${n(counts?.unused)} · 회수 ${n(counts?.revoked)}`}
        </small>
        {stats.data && (
          <small className={styles.source}>{sourceNote(stats.data.source, stats.data.syncedAt)}</small>
        )}
      </div>
    </section>
  );
}
