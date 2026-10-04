import { realName, useUserName, type UserLicense, type UserRow } from '@/entities/user';
import { GrantInvitesButton } from '@/features/user/grant-invites';
import { formatDate } from '@/shared/lib';
import styles from './UserTable.module.css';

const LICENSE_LABEL: Record<UserLicense, string> = {
  used: '사용 중',
  unused: '사용 중',
  revoked: '회수됨',
  unknown: '없는 키',
  none: '—',
};

function formatHours(sec: number): string {
  return sec ? `${Math.round(sec / 360) / 10}시간` : '—';
}

// 계정 요약에 이름이 없으면 그 사람 이름 한 칸만 읽는다. 화면에 보이는 줄만 읽고, 한 번 읽은 이름은 캐시에 남는다.
function NameCell({ row }: { row: UserRow }) {
  const fetched = useUserName(row.userCode, !row.name);
  const name = row.name ?? realName(fetched.data);
  if (name) return <>{name}</>;
  return <span className="soft">{fetched.isLoading ? '…' : '이름 없음'}</span>;
}

interface Props {
  rows: UserRow[];
  startIndex: number;
}

export function UserTable({ rows, startIndex }: Props) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>이름</th>
            <th>친구코드</th>
            <th>사용자코드</th>
            <th>라이선스</th>
            <th>집중</th>
            <th>마지막 갱신</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="soft">
                조건에 맞는 사용자가 없어요
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={row.userCode}>
              <td className="soft">{startIndex + i + 1}</td>
              <td>
                <NameCell row={row} />
                {!row.hasAccount && <small className={styles.tag}>계정 없음</small>}
              </td>
              <td>
                <code className="key">{row.friendCode ?? '—'}</code>
              </td>
              <td>
                <code className="key soft">{row.userCode}</code>
              </td>
              <td>
                {row.license && <code className="key">{row.license}</code>}
                <small
                  className={
                    row.licenseState === 'revoked' || row.licenseState === 'unknown' ? 'warn' : 'soft'
                  }
                >
                  {' '}
                  {LICENSE_LABEL[row.licenseState]}
                </small>
              </td>
              <td>{formatHours(row.focusTotalSec)}</td>
              <td className="soft">{row.lastSeen ? formatDate(row.lastSeen) : '—'}</td>
              <td>
                <GrantInvitesButton uid={row.userCode} who={row.name ?? row.friendCode ?? row.userCode} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
