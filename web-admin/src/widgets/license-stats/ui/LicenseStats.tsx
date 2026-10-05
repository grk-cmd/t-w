import { useMemo } from 'react';
import { countLicenses, useLicenses } from '@/entities/license';
import { useUserCount } from '@/entities/user-count';
import { errorMessage } from '@/shared/lib';
import styles from './LicenseStats.module.css';

// 키 목록은 아래 «발급된 키» 와 같은 캐시를 쓴다 — 요약 때문에 licenses 를 한 번 더 받지 않는다.
export function LicenseStats() {
  const users = useUserCount();
  const licenses = useLicenses();
  const counts = useMemo(() => (licenses.data ? countLicenses(licenses.data) : null), [licenses.data]);
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
          {licenses.error
            ? errorMessage(licenses.error, '불러오지 못했어요')
            : `사용 ${n(counts?.used)} · 미사용 ${n(counts?.unused)} · 회수 ${n(counts?.revoked)}`}
        </small>
      </div>
    </section>
  );
}
