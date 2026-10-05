import { formatDate } from '@/shared/lib';
import { isRateLimited, useRefreshReleaseDownloads, useReleaseDownloads } from '../api/releases';
import { formatAge } from '../model/release';
import styles from './ReleaseDownloadsView.module.css';

const n = (v: number) => v.toLocaleString();

// GitHub 공개 API 를 인증 없이 부른다 — 시간당 한도가 작아 자동으로 다시 받지 않고 새로고침 버튼으로만 받는다.
export function ReleaseDownloadsView() {
  const { data, error, isFetching, dataUpdatedAt } = useReleaseDownloads();
  const refresh = useRefreshReleaseDownloads();

  return (
    <section className="card">
      <div className="card-head">
        <h2>릴리스 다운로드</h2>
        <button type="button" className="btn" disabled={isFetching} onClick={() => refresh()}>
          새로고침
        </button>
      </div>
      {error ? (
        <p className="msg err">
          {isRateLimited(error) ? 'GitHub 요청 한도 — 잠시 뒤 새로고침' : '불러오지 못했어요'}
        </p>
      ) : !data ? (
        <p className="soft">불러오는 중…</p>
      ) : data.length === 0 ? (
        <p className="soft">공개된 릴리스가 없어요</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>버전</th>
              <th>공개</th>
              <th>윈도우</th>
              <th>맥</th>
              <th title="latest.yml — Windows 자동 업데이트 확인">업데이트 확인</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.version}>
                <td>
                  <code className="key">{r.version}</code>
                  {i === 0 && <small className={styles.latest}>Latest</small>}
                </td>
                <td>
                  {r.publishedAt === null ? '—' : formatDate(r.publishedAt).slice(0, 10)}
                  {i === 0 && r.publishedAt !== null && (
                    <small className="soft"> · 공개 후 {formatAge(r.publishedAt, dataUpdatedAt)}</small>
                  )}
                </td>
                <td>{n(r.exe)}</td>
                <td>
                  {n(r.dmg)}
                  <small className="soft">
                    {' '}
                    (arm64 {n(r.dmgArm64)} · x64 {n(r.dmgX64)})
                  </small>
                </td>
                <td>{n(r.updateChecks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
